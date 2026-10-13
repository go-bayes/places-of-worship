#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["mapbox-vector-tile", "pmtiles", "jsonschema"]
# ///
"""Build the grid-thinned public tiers: places-overview-v2-<snapshot>-grid (z0-5) and
places-v2-<snapshot>-grid (z6-7 thinned, z8-18 unchanged).

Why: the 2026-10-07 tiers thinned every zoom by one global fraction chosen so that the
densest European tile fit a byte cap. That fraction removed about 98 percent of the places
everywhere, including sparse countries where no thinning was needed (New Zealand's z4 tile kept
31 of 1,596 places), so the maps appeared to hold far fewer places than they do.

How: at each zoom a place is drawn as a dot a few css pixels wide, so places closer together
than a screen pixel are indistinguishable. Each zoom keeps one representative per screen-pixel
cell, religion and denomination (`cell_px` css pixels of a 512-pixel tile), and no place that
would be visible on its own is dropped. The representative is the first place of its group in the
sorted input, so the build is reproducible; it carries `n`, the number of input places it stands
for, when that number exceeds one. Thinning is strongest where dots overlap and absent where
they do not, so a sparse country keeps every place.

Stages (run all with `all`, or one at a time):

  thin      per-zoom NDJSON parts from slim.ndjson (the extract of build_tiles_v2.py),
            and thin-report.json with the kept counts
  build     tippecanoe per zoom and tile-join for the overview; tippecanoe z6 and z7, then
            z8-18 copied from the live places.mbtiles through SQLite, for the places tier
  validate  every z0-7 tile decoded: counts, the sum of n, religion totals, attributes,
            layer names and header zooms against the thin report; z8-18 byte equality with
            the source in both directions; tile sizes (exit 5 on a problem, 6 on a criterion)
  manifest  the two data manifests (schemas/data-manifest.schema.json) and the report

Nothing here reads or writes R2, and the source archive is opened read-only. Public records hold
aggregates, hashes and counts only. See tools/tiles-r2/README.md.
"""

from __future__ import annotations

import argparse
import collections
import gzip
import hashlib
import json
import math
import multiprocessing as mp
import sqlite3
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_tiles_v2 import _public_metadata, _run, _sha256  # noqa: E402

SNAPSHOT = "20260722"
SUFFIX = "grid"
EXPECTED_COUNT = 2_072_349
OVERVIEW_LAYER = "places_overview"
PLACES_LAYER = "places"
TILE_PX = 512  # css pixels per tile: maplibre draws a vector tile over 512 css pixels
MAX_LAT = 85.05112878
SLIM_ATTRS = ["religion", "denomination", "name", "osm_id", "osm_type", "country_code"]
THIN_ATTRS = ["religion", "denomination", "country_code"]
COPY_FROM_ZOOM = 8
MAX_ZOOM = 18

# per zoom: cell size in css pixels, tippecanoe detail (coordinate units are
# TILE_PX / 2**detail css pixels, so detail 9 keeps positions to one pixel and
# detail 10 to half a pixel), and the attributes the tier carries. the dot
# radius at these zooms is 1.4-3.5 px on the overview and 2.1-2.5 px on the
# places tier, so a two-pixel cell never leaves a gap a dot would have covered
ZOOM_SPEC = {
    0: {"tier": "overview", "cell_px": 2, "detail": 9, "attrs": THIN_ATTRS},
    1: {"tier": "overview", "cell_px": 2, "detail": 9, "attrs": THIN_ATTRS},
    2: {"tier": "overview", "cell_px": 2, "detail": 9, "attrs": THIN_ATTRS},
    3: {"tier": "overview", "cell_px": 2, "detail": 9, "attrs": THIN_ATTRS},
    4: {"tier": "overview", "cell_px": 2, "detail": 9, "attrs": THIN_ATTRS},
    5: {"tier": "overview", "cell_px": 2, "detail": 9, "attrs": THIN_ATTRS},
    6: {"tier": "places", "cell_px": 2, "detail": 9, "attrs": THIN_ATTRS},
    7: {"tier": "places", "cell_px": 1, "detail": 10, "attrs": SLIM_ATTRS},
}
OVERVIEW_ZOOMS = [z for z, s in ZOOM_SPEC.items() if s["tier"] == "overview"]
PLACES_THIN_ZOOMS = [z for z, s in ZOOM_SPEC.items() if s["tier"] == "places"]
# acceptance criteria on stored (gzip) tile bytes, per tier
TILE_CAP_BYTES = {"overview": 750_000, "places": 1_250_000}
# a point on a tile edge can round into the neighbouring tile's buffer; counts
# over tile-proper points are allowed this fraction of slack against the input
EDGE_SLACK = 0.001
COUNT_FLOOR = 0.005  # religions above this share of the input are checked for totals


def overview_name(snapshot=SNAPSHOT, suffix=SUFFIX):
    return f"places-overview-v2-{snapshot}-{suffix}"


def places_name(snapshot=SNAPSHOT, suffix=SUFFIX):
    return f"places-v2-{snapshot}-{suffix}"


# ---------------------------------------------------------------- thinning

def mercator_px(lon, lat, z, tile_px=TILE_PX):
    """Web Mercator pixel coordinates at a zoom, with tile_px pixels per tile."""
    lat = max(-MAX_LAT, min(MAX_LAT, lat))
    n = tile_px * (1 << z)
    x = (lon + 180.0) / 360.0 * n
    s = math.sin(math.radians(lat))
    y = (0.5 - math.log((1 + s) / (1 - s)) / (4 * math.pi)) * n
    return x, y


def cell_key(lon, lat, z, cell_px):
    x, y = mercator_px(lon, lat, z)
    return int(x // cell_px), int(y // cell_px)


def group_key(lon, lat, religion, denomination, z, cell_px):
    cx, cy = cell_key(lon, lat, z, cell_px)
    return cx, cy, religion, denomination


def load_slim(path):
    """Rows of (lon, lat, religion, denomination, properties) in file order."""
    rows = []
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            f = json.loads(line)
            p = f["properties"]
            lon, lat = f["geometry"]["coordinates"]
            rows.append((float(lon), float(lat), p.get("religion") or "unknown", p.get("denomination") or "", p))
    return rows


def thin_rows(rows, z, cell_px):
    """First row index per group and the group sizes, in first-seen order."""
    first = {}
    counts = collections.Counter()
    for i, (lon, lat, rel, den, _p) in enumerate(rows):
        k = group_key(lon, lat, rel, den, z, cell_px)
        counts[k] += 1
        if k not in first:
            first[k] = i
    return first, counts


def thinned_properties(props, religion, denomination, attrs, n):
    out = {}
    for a in attrs:
        if a == "religion":
            out["religion"] = religion
        elif a == "denomination":
            if denomination:
                out["denomination"] = denomination
        elif props.get(a) not in (None, ""):
            out[a] = props[a]
    if n > 1:
        out["n"] = n
    return out


def write_part(rows, first, counts, attrs, path):
    kept = 0
    religion_totals = collections.Counter()
    with open(path, "w", encoding="utf-8") as out:
        for k, i in first.items():
            lon, lat, rel, den, p = rows[i]
            n = counts[k]
            props = thinned_properties(p, rel, den, attrs, n)
            out.write(json.dumps({"type": "Feature", "properties": props,
                                  "geometry": {"type": "Point", "coordinates": [lon, lat]}},
                                 ensure_ascii=False) + "\n")
            kept += 1
            religion_totals[rel] += n
    return kept, religion_totals


def cmd_thin(a):
    work = Path(a.work)
    parts = work / "parts"
    parts.mkdir(parents=True, exist_ok=True)
    slim = Path(a.slim)
    stats = json.loads((Path(a.extract_work) / "input-stats.json").read_text())
    slim_sha = _sha256(slim)
    if slim_sha != stats["slim_sha256"]:
        print(f"thin: STOP. slim.ndjson digest {slim_sha} differs from input-stats {stats['slim_sha256']}", file=sys.stderr)
        sys.exit(3)
    t0 = time.time()
    rows = load_slim(slim)
    if len(rows) != EXPECTED_COUNT:
        print(f"thin: STOP. {len(rows)} rows, expected {EXPECTED_COUNT}", file=sys.stderr)
        sys.exit(3)
    input_religion = collections.Counter(r[2] for r in rows)
    print(f"thin: loaded {len(rows)} rows in {time.time() - t0:.1f}s", flush=True)
    report = {"slim_sha256": slim_sha, "input_features": len(rows), "input_religion": dict(input_religion),
              "tile_px": TILE_PX, "zooms": {}}
    for z, spec in ZOOM_SPEC.items():
        t = time.time()
        first, counts = thin_rows(rows, z, spec["cell_px"])
        kept, totals = write_part(rows, first, counts, spec["attrs"], parts / f"z{z}.ndjson")
        if sum(counts.values()) != len(rows) or sum(totals.values()) != len(rows):
            print(f"thin: STOP. z{z} group sizes do not sum to the input", file=sys.stderr)
            sys.exit(3)
        report["zooms"][str(z)] = {
            "tier": spec["tier"], "cell_px": spec["cell_px"], "detail": spec["detail"], "attrs": spec["attrs"],
            "kept": kept, "kept_fraction": round(kept / len(rows), 6),
            "groups_with_n_over_1": sum(1 for v in counts.values() if v > 1),
            "religion_totals": dict(totals), "seconds": round(time.time() - t, 1)}
        print(f"thin: z{z} kept {kept} of {len(rows)} ({kept / len(rows):.1%}), cell {spec['cell_px']} px, {time.time() - t:.1f}s", flush=True)
    (work / "thin-report.json").write_text(json.dumps(report, indent=2) + "\n")


# ------------------------------------------------------------------- build

def tippecanoe_cmd(z, spec, layer, src, dst, tmp):
    return ["tippecanoe", f"-Z{z}", f"-z{z}", "-r1", "--no-feature-limit", "--no-tile-size-limit",
            "-d", str(spec["detail"]), "-l", layer, "--force", "--temporary-directory", str(tmp), "-o", str(dst), str(src)]


def cmd_build(a):
    work = Path(a.work)
    out, parts, logs, tmp = work / "out", work / "parts", work / "logs", work / "tmp"
    for d in (out, parts, logs, tmp):
        d.mkdir(parents=True, exist_ok=True)
    rep = json.loads((work / "thin-report.json").read_text())
    version = subprocess.run(["tippecanoe", "--version"], capture_output=True, text=True)
    tippecanoe_version = (version.stdout + version.stderr).strip()
    pm = subprocess.run(["pmtiles", "version"], capture_output=True, text=True)
    pm_version = ((pm.stdout + pm.stderr).strip().splitlines() or ["unknown"])[0]
    commands = {}

    def tip(z, layer):
        spec = ZOOM_SPEC[z]
        dst = parts / f"z{z}.mbtiles"
        cmd = tippecanoe_cmd(z, spec, layer, parts / f"z{z}.ndjson", dst, tmp)
        commands[f"z{z}"] = " ".join(["tippecanoe", *cmd[1:-1], f"<parts/z{z}.ndjson>"]).replace(str(tmp), "<tmp>").replace(str(parts), "<parts>")
        print(f"build: {' '.join(cmd)}", flush=True)
        rc, secs = _run(cmd, logs / f"tippecanoe-z{z}.log")
        print(f"build: z{z} rc={rc} {secs}s", flush=True)
        if rc:
            sys.exit(rc)
        return dst

    ov_parts = [tip(z, OVERVIEW_LAYER) for z in OVERVIEW_ZOOMS]
    ov = out / f"{overview_name(a.snapshot)}.pmtiles"
    cmd = ["tile-join", "-pk", "-f", "-o", str(ov), *map(str, ov_parts)]
    commands["overview_join"] = " ".join(["tile-join", "-pk", "-f", "-o", "<out>/" + ov.name, *(f"<parts>/z{z}.mbtiles" for z in OVERVIEW_ZOOMS)])
    rc, secs = _run(cmd, logs / "overview-join.log")
    print(f"build: overview join rc={rc} {secs}s", flush=True)
    if rc:
        sys.exit(rc)

    if a.skip_places:
        print("build: places tier skipped (--skip-places)", flush=True)
        (work / "build-info.json").write_text(json.dumps({
            "tippecanoe": tippecanoe_version, "pmtiles_cli": pm_version, "commands": commands,
            "slim_sha256": rep["slim_sha256"], "places_built": False,
            "built_at": datetime.now(timezone.utc).isoformat()}, indent=2) + "\n")
        return

    pl_parts = {z: tip(z, PLACES_LAYER) for z in PLACES_THIN_ZOOMS}
    src = str(Path(a.source).resolve())
    merged = out / f"{places_name(a.snapshot)}.mbtiles"
    partial = out / f"{merged.name}.partial"
    for p in (partial, merged):
        if p.exists():
            p.unlink()
    t0 = time.time()
    db = sqlite3.connect(f"file:{partial}?mode=rwc", uri=True)
    db.executescript(
        "pragma journal_mode=off; pragma synchronous=off;"
        "create table metadata (name text, value text);"
        "create table tiles (zoom_level integer, tile_column integer, tile_row integer, tile_data blob);")
    db.execute("attach database ? as src", (f"file:{src}?mode=ro",))
    n_thin = 0
    for z, part in pl_parts.items():
        db.execute(f"attach database ? as part{z}", (f"file:{part}?mode=ro",))
        n_thin += db.execute(
            f"insert into tiles select zoom_level, tile_column, tile_row, tile_data from part{z}.tiles where zoom_level = ?",
            (z,)).rowcount
    n_copy = db.execute(
        "insert into tiles select zoom_level, tile_column, tile_row, tile_data from src.tiles where zoom_level >= ?",
        (COPY_FROM_ZOOM,)).rowcount
    db.commit()
    db.execute("create unique index tile_index on tiles (zoom_level, tile_column, tile_row)")
    sm = dict(db.execute("select name, value from src.metadata").fetchall())
    src_json = json.loads(sm["json"])
    src_layer = src_json["vector_layers"][0]
    fields = dict(src_layer["fields"])
    fields["n"] = "Number"
    min_zoom = min(PLACES_THIN_ZOOMS)
    layer = {"id": PLACES_LAYER, "description": "", "minzoom": min_zoom, "maxzoom": MAX_ZOOM, "fields": fields}
    ts = json.loads(_public_metadata({"json": sm["json"]})["json"])["tilestats"]
    meta = {
        "name": places_name(a.snapshot),
        "description": (f"{places_name(a.snapshot)}: z6-7 thinned to one place per screen-pixel cell, religion and denomination "
                        f"(n = places represented), z8-18 byte-for-byte from places.mbtiles"),
        "version": "2", "type": "overlay", "format": "pbf",
        "minzoom": str(min_zoom), "maxzoom": str(MAX_ZOOM),
        "bounds": sm.get("bounds"), "center": sm.get("center"),
        "generator": f"build_tiles_grid.py ({tippecanoe_version} for z6-7; z8-18 copied from places.mbtiles)",
        "json": json.dumps({"vector_layers": [layer], "tilestats": ts}, ensure_ascii=False, separators=(",", ":")),
    }
    db.executemany("insert into metadata values (?, ?)", [(k, v) for k, v in meta.items() if v is not None])
    db.execute("create unique index name on metadata (name)")
    db.commit()
    db.close()
    partial.rename(merged)
    print(f"build: merged {n_thin} thin tiles and {n_copy} copied tiles in {round(time.time() - t0)}s", flush=True)
    pmt = out / f"{places_name(a.snapshot)}.pmtiles"
    if pmt.exists():
        pmt.unlink()
    cmd = ["pmtiles", "convert", str(merged), str(pmt), f"--tmpdir={tmp}"]
    commands["places_copy"] = f"sqlite insert into tiles select ... from places.mbtiles.tiles where zoom_level >= {COPY_FROM_ZOOM} (read-only attach)"
    commands["places_convert"] = f"pmtiles convert {merged.name} {pmt.name}"
    rc, secs = _run(cmd, logs / "pmtiles-convert.log")
    print(f"build: pmtiles convert rc={rc} {secs}s", flush=True)
    if rc:
        sys.exit(rc)
    (work / "build-info.json").write_text(json.dumps({
        "tippecanoe": tippecanoe_version, "pmtiles_cli": pm_version, "commands": commands,
        "slim_sha256": rep["slim_sha256"], "places_built": True,
        "thin_tiles_inserted": n_thin, "copied_tiles_inserted": n_copy,
        "built_at": datetime.now(timezone.utc).isoformat()}, indent=2) + "\n")


# ---------------------------------------------------------------- validate

def _decode_tile(args):
    """Tile-proper points of one tile: count, sum of n, religion totals (by n), attribute keys, layers."""
    import mapbox_vector_tile

    z, x, y, data = args
    d = mapbox_vector_tile.decode(gzip.decompress(data), default_options={"y_coord_down": True})
    points = 0
    n_sum = 0
    religion = collections.Counter()
    attrs = collections.Counter()
    missing_religion = 0
    for lyr in d.values():
        ext = lyr["extent"]
        for f in lyr["features"]:
            g = f["geometry"]
            pts = g["coordinates"] if g["type"] == "MultiPoint" else [g["coordinates"]]
            p = f["properties"]
            n = p.get("n")
            n = int(n) if isinstance(n, (int, float)) else 1
            for px, py in pts:
                if 0 <= px < ext and 0 <= py < ext:
                    points += 1
                    n_sum += n
                    religion[p.get("religion")] += n
                    attrs.update(k for k, v in p.items() if v is not None)
                    if not p.get("religion"):
                        missing_religion += 1
    return z, x, y, len(data), list(d), points, n_sum, religion, attrs, missing_religion


def _iter_archive(path, zooms):
    from pmtiles.reader import MmapSource, all_tiles

    with open(path, "rb") as fh:
        for (z, x, y), data in all_tiles(MmapSource(fh)):
            if z in zooms:
                yield z, x, y, data


def _header(path):
    from pmtiles.reader import MmapSource, Reader

    with open(path, "rb") as fh:
        r = Reader(MmapSource(fh))
        h = r.header()
        return {"minzoom": h["min_zoom"], "maxzoom": h["max_zoom"]}, r.metadata()


def _scan_thin(path, zooms, pool):
    per_zoom = {z: {"tiles": 0, "sizes": [], "points": 0, "n_sum": 0, "religion": collections.Counter(),
                    "attrs": collections.Counter(), "missing_religion": 0, "layers": collections.Counter()} for z in zooms}
    for z, x, y, size, layers, points, n_sum, religion, attrs, missing in pool.imap_unordered(
            _decode_tile, _iter_archive(path, set(zooms)), chunksize=8):
        s = per_zoom[z]
        s["tiles"] += 1
        s["sizes"].append(size)
        s["points"] += points
        s["n_sum"] += n_sum
        s["religion"].update(religion)
        s["attrs"].update(attrs)
        s["missing_religion"] += missing
        s["layers"].update(layers)
    return per_zoom


def _p95(v):
    v = sorted(v)
    return v[int(0.95 * (len(v) - 1))] if v else 0


def size_table(sizes):
    return {"tiles": len(sizes), "max": max(sizes) if sizes else 0, "p95": _p95(sizes), "total": sum(sizes)}


def within_slack(observed, expected, slack=EDGE_SLACK):
    return abs(observed - expected) <= max(1, slack * expected)


def check_thin_zoom(z, s, exp, layer, cap, input_religion, input_total):
    """Problems and unmet criteria for one thinned zoom against the thin report."""
    problems, unmet = [], []
    if s["tiles"] == 0:
        problems.append(f"z{z}: no tiles")
        return problems, unmet
    if set(s["layers"]) != {layer}:
        problems.append(f"z{z}: layers {sorted(s['layers'])}, expected [{layer}]")
    if not within_slack(s["points"], exp["kept"]):
        problems.append(f"z{z}: {s['points']} tile-proper points, thin report kept {exp['kept']}")
    if not within_slack(s["n_sum"], input_total):
        problems.append(f"z{z}: the sum of n over tile-proper points is {s['n_sum']}, input {input_total}")
    for rel, total in input_religion.items():
        if total / input_total < COUNT_FLOOR:
            continue
        if not within_slack(s["religion"].get(rel, 0), total):
            problems.append(f"z{z}: religion {rel} sums to {s['religion'].get(rel, 0)} by n, input {total}")
    allowed = set(exp["attrs"]) | {"n"}
    extra = set(s["attrs"]) - allowed
    if extra:
        problems.append(f"z{z}: unexpected attributes {sorted(extra)}")
    if s["missing_religion"]:
        problems.append(f"z{z}: {s['missing_religion']} points without religion")
    mx = max(s["sizes"])
    if mx > cap:
        unmet.append(f"z{z}: largest tile {mx} bytes exceeds the {cap} byte criterion")
    return problems, unmet


def _scan_src_zoom(args):
    """Digests of every source tile at one zoom, keyed z/x/y (xyz), into a sqlite file."""
    src, z, dest = args
    db = sqlite3.connect(f"file:{src}?mode=ro", uri=True)
    out = sqlite3.connect(dest)
    out.execute("drop table if exists d")
    out.execute("create table d (z integer, x integer, y integer, sha text, n integer)")
    batch = []
    for col, row, data in db.execute("select tile_column, tile_row, tile_data from tiles where zoom_level=?", (z,)):
        batch.append((z, col, (1 << z) - 1 - row, hashlib.sha256(data).hexdigest(), len(data)))
        if len(batch) >= 20000:
            out.executemany("insert into d values (?,?,?,?,?)", batch)
            batch = []
    out.executemany("insert into d values (?,?,?,?,?)", batch)
    out.commit()
    out.execute("create unique index i on d (z, x, y)")
    out.commit()
    n = out.execute("select count(*) from d").fetchone()[0]
    out.close()
    db.close()
    return z, n


def _digest_batch(batch):
    return [(z, x, y, hashlib.sha256(data).hexdigest(), len(data)) for z, x, y, data in batch]


def check_copied_zooms(archive, source, work, pool, zooms):
    """z8-18 byte equality in both directions: per zoom, the tile sets and digests must be the same."""
    digests_dir = work / "digests-src"
    digests_dir.mkdir(exist_ok=True)
    src_counts = dict(pool.map(_scan_src_zoom, [(source, z, str(digests_dir / f"z{z}.sqlite")) for z in zooms]))
    per_zoom = {z: {"source_tiles": src_counts[z], "archive_tiles": 0, "mismatched": 0, "missing_in_source": 0} for z in zooms}
    conns = {z: sqlite3.connect(str(digests_dir / f"z{z}.sqlite")) for z in zooms}
    seen = {z: set() for z in zooms}
    batch = []

    def flush():
        for z, x, y, sha, n in _digest_batch(batch):
            s = per_zoom[z]
            s["archive_tiles"] += 1
            row = conns[z].execute("select sha, n from d where z=? and x=? and y=?", (z, x, y)).fetchone()
            if row is None:
                s["missing_in_source"] += 1
            elif row[0] != sha or row[1] != n:
                s["mismatched"] += 1
            seen[z].add((x, y))
        batch.clear()

    for z, x, y, data in _iter_archive(archive, set(zooms)):
        batch.append((z, x, y, data))
        if len(batch) >= 5000:
            flush()
    flush()
    problems = []
    for z in zooms:
        s = per_zoom[z]
        s["missing_in_archive"] = s["source_tiles"] - len(seen[z])
        if s["mismatched"] or s["missing_in_source"] or s["missing_in_archive"]:
            problems.append(f"z{z}: {s['mismatched']} mismatched, {s['missing_in_source']} not in source, {s['missing_in_archive']} not in archive")
    for c in conns.values():
        c.close()
    return per_zoom, problems


def source_tile_sets(source, zooms):
    db = sqlite3.connect(f"file:{source}?mode=ro", uri=True)
    sets = {z: {(c, (1 << z) - 1 - r) for c, r in db.execute("select tile_column, tile_row from tiles where zoom_level=?", (z,))} for z in zooms}
    db.close()
    return sets


def cmd_validate(a):
    work, out = Path(a.work), Path(a.work) / "out"
    rep = json.loads((work / "thin-report.json").read_text())
    info = json.loads((work / "build-info.json").read_text())
    input_total = rep["input_features"]
    input_religion = rep["input_religion"]
    problems, unmet, warnings = [], [], []
    report = {"status": None, "inputs": {"slim_sha256": rep["slim_sha256"]}, "archives": {}}
    t0 = time.time()
    with mp.Pool(a.jobs) as pool:
        ov = out / f"{overview_name(a.snapshot)}.pmtiles"
        header, meta = _header(ov)
        ov_scan = _scan_thin(ov, OVERVIEW_ZOOMS, pool)
        ov_rep = {"sha256": _sha256(ov), "bytes": ov.stat().st_size, "header": header, "zooms": {}}
        if header["minzoom"] != min(OVERVIEW_ZOOMS) or header["maxzoom"] != max(OVERVIEW_ZOOMS):
            problems.append(f"overview header zooms {header}, expected {min(OVERVIEW_ZOOMS)}-{max(OVERVIEW_ZOOMS)}")
        for z in OVERVIEW_ZOOMS:
            s = ov_scan[z]
            p, u = check_thin_zoom(z, s, rep["zooms"][str(z)], OVERVIEW_LAYER, TILE_CAP_BYTES["overview"], input_religion, input_total)
            problems += [f"overview {m}" for m in p]
            unmet += [f"overview {m}" for m in u]
            ov_rep["zooms"][str(z)] = {"sizes": size_table(s["sizes"]), "points": s["points"], "n_sum": s["n_sum"],
                                       "kept_in_thin_report": rep["zooms"][str(z)]["kept"],
                                       "religion_by_n": dict(s["religion"]), "attributes": sorted(s["attrs"])}
        report["archives"][overview_name(a.snapshot)] = ov_rep
        print(f"validate: overview scanned in {round(time.time() - t0)}s", flush=True)

        if info.get("places_built"):
            pl = out / f"{places_name(a.snapshot)}.pmtiles"
            header, meta = _header(pl)
            pl_scan = _scan_thin(pl, PLACES_THIN_ZOOMS, pool)
            pl_rep = {"sha256": _sha256(pl), "bytes": pl.stat().st_size, "header": header, "zooms": {}}
            if header["minzoom"] != min(PLACES_THIN_ZOOMS) or header["maxzoom"] != MAX_ZOOM:
                problems.append(f"places header zooms {header}, expected {min(PLACES_THIN_ZOOMS)}-{MAX_ZOOM}")
            src_sets = source_tile_sets(a.source, PLACES_THIN_ZOOMS)
            for z in PLACES_THIN_ZOOMS:
                s = pl_scan[z]
                p, u = check_thin_zoom(z, s, rep["zooms"][str(z)], PLACES_LAYER, TILE_CAP_BYTES["places"], input_religion, input_total)
                problems += [f"places {m}" for m in p]
                unmet += [f"places {m}" for m in u]
                pl_rep["zooms"][str(z)] = {"sizes": size_table(s["sizes"]), "points": s["points"], "n_sum": s["n_sum"],
                                           "kept_in_thin_report": rep["zooms"][str(z)]["kept"],
                                           "religion_by_n": dict(s["religion"]), "attributes": sorted(s["attrs"]),
                                           "source_tiles": len(src_sets[z])}
            print(f"validate: places z6-7 scanned in {round(time.time() - t0)}s", flush=True)
            copied = list(range(COPY_FROM_ZOOM, MAX_ZOOM + 1))
            per_zoom, p = check_copied_zooms(str(pl), str(Path(a.source).resolve()), work, pool, copied)
            problems += [f"places copied {m}" for m in p]
            pl_rep["copied_zooms"] = per_zoom
            pl_rep["source_sha256"] = _sha256(Path(a.source))
            report["archives"][places_name(a.snapshot)] = pl_rep
            print(f"validate: places z8-18 compared in {round(time.time() - t0)}s", flush=True)
            # a thinned zoom must keep a tile wherever the source had one with points in its proper
            # area; tiles the source held only as a neighbour's buffer copy may lawfully disappear
            for z in PLACES_THIN_ZOOMS:
                archive_tiles = pl_scan[z]["tiles"]
                if archive_tiles < len(src_sets[z]):
                    warnings.append(f"places z{z}: {len(src_sets[z]) - archive_tiles} source tiles have no archive tile (buffer-only tiles)")
        else:
            warnings.append("places tier not built in this work directory (--skip-places)")
    report["status"] = "failed" if problems else ("criteria_not_met" if unmet else "passed")
    report["problems"], report["criteria_not_met"], report["warnings"] = problems, unmet, warnings
    report["seconds"] = round(time.time() - t0)
    (work / "validation-report.json").write_text(json.dumps(report, indent=2) + "\n")
    for m in problems:
        print("validate: PROBLEM", m, file=sys.stderr)
    for m in unmet:
        print("validate: CRITERION", m, file=sys.stderr)
    for m in warnings:
        print("validate: warning", m)
    print(f"validate: {report['status']}", flush=True)
    if problems:
        sys.exit(5)
    if unmet:
        sys.exit(6)


# ---------------------------------------------------------------- manifest

def _md_report(rep, thin):
    lines = ["# Grid-thinned tiles: validation report", "",
             f"Status: **{rep['status']}**. Input: {thin['input_features']:,} places (slim.ndjson sha256 `{thin['slim_sha256']}`).", "",
             "Each zoom keeps one place per screen-pixel cell, religion and denomination; `n` on a dot is the number of input places it stands for.", "",
             "| archive | zoom | cell px | kept | of input | tiles | max bytes | p95 bytes | total MB |", "|---|---|---|---|---|---|---|---|---|"]
    for name, arch in rep["archives"].items():
        for z, zr in arch["zooms"].items():
            t = thin["zooms"][z]
            s = zr["sizes"]
            lines.append(f"| {name} | {z} | {t['cell_px']} | {t['kept']:,} | {t['kept_fraction']:.1%} | {s['tiles']:,} | {s['max']:,} | {s['p95']:,} | {s['total'] / 1e6:.1f} |")
        if "copied_zooms" in arch:
            lines += ["", f"`{name}` z{COPY_FROM_ZOOM}-{MAX_ZOOM}: copied from places.mbtiles and compared by digest in both directions.", "",
                      "| zoom | source tiles | archive tiles | mismatched | missing |", "|---|---|---|---|---|"]
            for z, c in arch["copied_zooms"].items():
                lines.append(f"| {z} | {c['source_tiles']:,} | {c['archive_tiles']:,} | {c['mismatched']} | {c['missing_in_source'] + c['missing_in_archive']} |")
    for key in ("problems", "criteria_not_met", "warnings"):
        if rep.get(key):
            lines += ["", f"## {key.replace('_', ' ')}", ""] + [f"- {m}" for m in rep[key]]
    return "\n".join(lines) + "\n"


def _manifest(a, name, archive, rep_arch, thin, info, zooms, description, uploads):
    params = {
        "method": "screen-pixel grid thinning: one representative per cell, religion and denomination at each zoom; n = places represented",
        "tile_px": TILE_PX,
        "zooms": {str(z): {k: v for k, v in ZOOM_SPEC[z].items()} for z in zooms},
        "kept": {str(z): thin["zooms"][str(z)]["kept"] for z in zooms},
        "tippecanoe_flags": "-Z<z> -z<z> -r1 --no-feature-limit --no-tile-size-limit -d <detail> -l <layer>, one run per zoom",
        "commands": {k: v for k, v in info["commands"].items()
                     if k in {f"z{z}" for z in zooms} or k.startswith("overview" if "overview" in name else "places")},
        "slim_sha256": thin["slim_sha256"], "input_features": thin["input_features"],
    }
    if "copied_zooms" in rep_arch:
        params["z8_18"] = "rows copied byte for byte from places.mbtiles (read-only attach), verified by digest in both directions"
        params["source_sha256"] = rep_arch["source_sha256"]
    files = [{
        "uri": f"green:{archive.resolve()}", "storage_provider": "other", "format": "pmtiles", "bytes": archive.stat().st_size,
        "sha256": rep_arch["sha256"], "feature_count": None, "privacy": "public", "licence_status": "needs_review",
        "notes": description + " Location is a machine-local build output on green, a cache and not a durable store; the durable copy is the R2 object, once uploaded and recorded."}]
    for u in uploads:
        if u.get("key") == f"{name}.pmtiles" and u.get("match"):
            files.append({"uri": f"r2://pow-tiles/{u['key']}", "storage_provider": "other", "format": "pmtiles", "bytes": u["bytes"],
                          "sha256": u["sha256_readback"], "feature_count": None, "privacy": "public", "licence_status": "needs_review",
                          "notes": f"durable R2 object, served at https://tiles.placemap.org/{name}/{{z}}/{{x}}/{{y}}; r2 etag {u.get('r2_etag')}; uploaded with a refusal on an existing key and verified by a full read-back sha256"})
    ident = hashlib.sha256(json.dumps({"files": [(archive.name, rep_arch["sha256"])], "params": params}, sort_keys=True, default=str).encode()).hexdigest()
    return {
        "$schema": "../../../schemas/data-manifest.schema.json",
        "schema_version": "data-manifest.v2",
        "manifest_id": f"manifest:{name}-{ident[:12]}",
        "dataset_id": name,
        "dataset_version_id": f"{name}:{ident[:16]}",
        "dataset_family": "places-tiles",
        "dataset_role": "public_product",
        "scope": {"level": "global", "snapshot_date": "2026-07-22", "pipeline_stage": "staged"},
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "created_by": a.created_by,
        "pipeline": {
            "script": "tools/tiles-r2/build_tiles_grid.py", "git_commit": a.git_commit or None,
            "command": "uv run tools/tiles-r2/build_tiles_grid.py all --work <dir> --source <places.mbtiles> --slim <slim.ndjson> --extract-work <dir>",
            "parameters": params,
            "software_versions": {"tippecanoe": info["tippecanoe"], "pmtiles_cli": info["pmtiles_cli"], "python": sys.version.split()[0]}},
        "source": {
            "provider": "slim.ndjson of tiles-v2-20260722 (the extract of places.mbtiles, the live places tileset built 2026-07-22)" + ("; places.mbtiles for z8-18" if "copied_zooms" in rep_arch else ""),
            "licence": None,
            "citation": (f"slim.ndjson sha256 {thin['slim_sha256']}, {thin['input_features']} features, extracted by build_tiles_v2.py "
                         f"(see the tiles-v2-{SNAPSHOT} manifests)."),
            "licence_todo": "licence and attribution of the 701,349 places without an OSM key are not established; the archive adds no place and no attribute to what the live tiers already serve"},
        "durable_files": files,
        "validation": {
            "status": "passed",
            "commands": ["uv run tools/tiles-r2/build_tiles_grid.py validate --work <dir> --source <places.mbtiles> --slim <slim.ndjson> --extract-work <dir>"],
            "warnings": ["licence_status needs_review: licence of the places without an OSM key is not established"] + a_warnings(a),
            "notes": f"full report in tools/tiles-r2/manifests/validation-report-{name}.md",
            "input_features": thin["input_features"], "criteria_not_met": []},
        "downstream_status": "staged"}


def a_warnings(a):
    rep = json.loads((Path(a.work) / "validation-report.json").read_text())
    return rep.get("warnings", [])


def cmd_manifest(a):
    import jsonschema

    work, out = Path(a.work), Path(a.work) / "out"
    thin = json.loads((work / "thin-report.json").read_text())
    info = json.loads((work / "build-info.json").read_text())
    rep = json.loads((work / "validation-report.json").read_text())
    if rep["status"] != "passed":
        print(f"manifest: the validation report says {rep['status']}; no manifest is written", file=sys.stderr)
        sys.exit(6)
    if rep["inputs"]["slim_sha256"] != thin["slim_sha256"] or info["slim_sha256"] != thin["slim_sha256"]:
        print("manifest: the reports describe different slim inputs; thin, build and validate again", file=sys.stderr)
        sys.exit(7)
    uploads = []
    if a.uploads:
        for line in Path(a.uploads).read_text().splitlines():
            line = line.strip()
            if line.startswith("{"):
                uploads.append(json.loads(line))
    schema_path = Path(a.schema) if a.schema else Path(__file__).resolve().parents[2] / "schemas/data-manifest.schema.json"
    schema = json.loads(schema_path.read_text())
    dest = Path(a.manifest_dir)
    dest.mkdir(parents=True, exist_ok=True)
    targets = [(overview_name(a.snapshot), OVERVIEW_ZOOMS,
                "public overview tier, z0-5, layer places_overview: one dot per screen-pixel cell, religion and denomination, with n the places represented; attributes religion, denomination, country_code, n.")]
    if info.get("places_built"):
        targets.append((places_name(a.snapshot), PLACES_THIN_ZOOMS,
                        "public places tier, z6-18, layer places: z6 one dot per 2 px cell, religion and denomination (religion, denomination, country_code, n); z7 one dot per 1 px cell with the six slim attributes and n; z8-18 byte-identical to the live places tileset."))
    for name, zooms, description in targets:
        archive = out / f"{name}.pmtiles"
        current = _sha256(archive)
        if current != rep["archives"][name]["sha256"]:
            print(f"manifest: {archive.name} digest {current} differs from the validated {rep['archives'][name]['sha256']}; validate again", file=sys.stderr)
            sys.exit(7)
        manifest = _manifest(a, name, archive, rep["archives"][name], thin, info, zooms, description, uploads)
        jsonschema.validate(manifest, schema)
        (dest / f"{name}.manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
        (dest / f"validation-report-{name}.json").write_text(json.dumps({"validation": rep, "thin": thin}, indent=2, ensure_ascii=False) + "\n")
        (dest / f"validation-report-{name}.md").write_text(_md_report(rep, thin))
        print(f"manifest: wrote {dest / (name + '.manifest.json')} (version {manifest['dataset_version_id']})", flush=True)


# -------------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("stage", choices=["thin", "build", "validate", "manifest", "all"])
    ap.add_argument("--work", required=True)
    ap.add_argument("--slim", required=True, help="slim.ndjson of the v2 extract")
    ap.add_argument("--extract-work", required=True, help="work directory of the v2 extract (input-stats.json)")
    ap.add_argument("--source", help="places.mbtiles, opened read-only (z8-18 of the places tier)")
    ap.add_argument("--skip-places", action="store_true", help="build and validate the overview only")
    ap.add_argument("--snapshot", default=SNAPSHOT)
    ap.add_argument("--manifest-dir", default=None)
    ap.add_argument("--schema", default=None)
    ap.add_argument("--git-commit", default=None)
    ap.add_argument("--created-by", default="claude-fable-5-1 (claude code)")
    ap.add_argument("--uploads", default=None, help="file of JSON lines printed by the upload script")
    ap.add_argument("--jobs", type=int, default=max(2, (mp.cpu_count() or 4) - 2))
    a = ap.parse_args()
    if a.manifest_dir is None:
        a.manifest_dir = str(Path(a.work) / "manifests")
    if not a.skip_places and a.stage in ("build", "validate", "all") and not a.source:
        ap.error("--source is required unless --skip-places")
    stages = ["thin", "build", "validate", "manifest"] if a.stage == "all" else [a.stage]
    for stage in stages:
        {"thin": cmd_thin, "build": cmd_build, "validate": cmd_validate, "manifest": cmd_manifest}[stage](a)


if __name__ == "__main__":
    main()
