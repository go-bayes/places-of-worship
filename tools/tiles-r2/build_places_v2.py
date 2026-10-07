#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["mapbox-vector-tile", "pmtiles", "jsonschema"]
# ///
"""Build places-v2-<snapshot>: the public places tier with a sampled z6-7 and unchanged z8-18.

Stages (run all with `all`, or one at a time):

  build     tippecanoe z6-7 from the slim input of the v2 build, copy z8-18 from the
            live places.mbtiles through SQLite, write the merged mbtiles, pmtiles convert
  validate  z8-18 byte equality with the source, z6-7 size cap, religion shares, counts,
            attributes, header; write the report (exit 5 on a problem, 6 on a criterion)
  measure   z6-7 size table against the live tiles, a curl sample of live tiles, and the
            tiles under the 42 country pages that open at z6-7
  manifest  write the data manifest (schemas/data-manifest.schema.json)

Nothing here reads or writes R2, and the source archive is opened read-only. The z6-7 input is
the slim.ndjson that `build_tiles_v2.py extract` wrote; it is reused, not re-extracted.
Public records hold aggregates, hashes and counts only. See tools/tiles-r2/README.md.
"""

from __future__ import annotations

import argparse
import collections
import concurrent.futures as cf
import gzip
import hashlib
import json
import math
import multiprocessing as mp
import os
import shutil
import sqlite3
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_tiles_v2 import _cmd_text, _public_metadata, _run, _sha256  # noqa: E402

SNAPSHOT = "20260722"
LAYER = "places"
# the six attributes the public map and the RA popups read from the places tier at z6-7
ATTRS = ["religion", "denomination", "name", "osm_id", "osm_type", "country_code"]
MIN_ZOOM, MAX_ZOOM = 6, 18
THIN_ZOOMS = (6, 7)
COPY_FROM_ZOOM = 8
TIPPECANOE_FLAGS = ["-Z6", "-z7", "--drop-fraction-as-needed", "-M", "500000", "-r1", "-l", LAYER]
TILE_CAP_BYTES = 500_000
# z6 is built with the briefed flags, which meet the share criterion (0.048 pp). The briefed flags at z7 shift the
# religion shares by 0.459 pp (christian -0.459, muslim +0.262: the drop runs along the spatial index, so a
# religion's share changes with where it lies), which fails the 0.3 pp criterion. z7 is therefore built, as z0 and z1
# of the overview were, from a seeded sample stratified by religion at one fraction, adjusted until the largest tile
# is just under the cap
STRATIFIED_ZOOMS = (7,)
SAMPLE_SEED = 20261007
SAMPLE_START_FRACTION = 0.70
SAMPLE_TARGET_BYTES = (470_000, 499_000)
SAMPLE_FLAGS = ["-Z7", "-z7", "-r1", "--no-feature-limit", "--no-tile-size-limit", "-l", LAYER]
SHARE_FLOOR = 0.005
SHARE_TOLERANCE_PP = 0.3
LIVE_URL = "https://tiles.placemap.org/places/{z}/{x}/{y}"
VIEWPORT = (1440, 900)  # css pixels, for the tiles under a country page


def name(a):
    return f"places-v2-{a.snapshot}"


def _tile_of(lon, lat, z):
    """The z/x/y tile (y down) whose proper area holds a longitude and latitude."""
    n = 1 << z
    x = math.floor((lon + 180.0) / 360.0 * n)
    y = math.floor((1.0 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2.0 * n)
    return min(max(x, 0), n - 1), min(max(y, 0), n - 1)


EDGE_MARGIN = 0.001  # of a tile's width; tippecanoe rounds to a 4096 grid, so a point this close to an edge may fall in the neighbour


def _interior(lon, lat, z):
    """The tile holding a point and whether the point lies clear of the tile's edges (by EDGE_MARGIN)."""
    n = 1 << z
    fx = (lon + 180.0) / 360.0 * n
    fy = (1.0 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2.0 * n
    x, y = min(max(math.floor(fx), 0), n - 1), min(max(math.floor(fy), 0), n - 1)
    clear = EDGE_MARGIN <= fx - x <= 1 - EDGE_MARGIN and EDGE_MARGIN <= fy - y <= 1 - EDGE_MARGIN
    return (x, y), clear


BUFFER_FRACTION = 5 / 256  # tippecanoe's default buffer (5 of 256 screen pixels), as a fraction of the tile width


def _buffered_tiles(lon, lat, z):
    """Tiles whose buffered area holds a point, clear of the buffer's edge by EDGE_MARGIN (a tile's width)."""
    n = 1 << z
    fx = (lon + 180.0) / 360.0 * n
    fy = (1.0 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2.0 * n
    reach = BUFFER_FRACTION - EDGE_MARGIN
    xs = range(max(0, math.ceil(fx - 1 - reach)), min(n - 1, math.floor(fx + reach)) + 1)
    ys = range(max(0, math.ceil(fy - 1 - reach)), min(n - 1, math.floor(fy + reach)) + 1)
    return [(x, y) for x in xs for y in ys]


def sample_with_coverage(src, dst, fraction, seed, zoom, required_tiles=None):
    """Write a seeded sample of an NDJSON feature file at one fraction.

    Each religion keeps round(fraction * n) features, drawn at random, so the shares follow the input. Then
    every zoom-`zoom` tile that holds input points but no sampled point gets one, drawn at random from the
    points in its proper area, so no place's neighbourhood loses every dot. Then every tile in `required_tiles`
    (the zoom-`zoom` tiles of the live source, a set of (x, y)) that no sampled point reaches, buffer included,
    gets one point drawn at random from the points in its buffered area, so every source tile has an archive
    tile. Returns (points written, points added for proper-area coverage, points added for source-tile coverage,
    required tiles with no point in their buffered area)."""
    import random

    required = set(required_tiles or ())
    by_religion = collections.defaultdict(list)
    tile_members = collections.defaultdict(list)
    buffer_members = collections.defaultdict(list)
    with open(src, encoding="utf-8") as fh:
        for i, line in enumerate(fh):
            f = json.loads(line)
            by_religion[f["properties"].get("religion")].append(i)
            lon, lat = f["geometry"]["coordinates"]
            tile, clear = _interior(lon, lat, zoom)
            tile_members[tile].append((i, clear))
            if required:
                for t in _buffered_tiles(lon, lat, zoom):
                    if t in required:
                        buffer_members[t].append(i)
    chosen = set()
    for rel in sorted(by_religion, key=str):
        idx = by_religion[rel]
        chosen.update(random.Random(f"{seed}:{rel}").sample(idx, round(len(idx) * fraction)))
    added = 0
    for tile in sorted(tile_members):
        members = tile_members[tile]
        # a tile counts as covered by a sampled point clear of its edges; an edge point may be rounded into the neighbour
        clear = [i for i, c in members if c]
        if clear and not any(i in chosen for i in clear):
            chosen.add(random.Random(f"{seed}:cover:{tile}").choice(clear))
            added += 1
    added_buffer, unreachable = 0, 0
    for tile in sorted(required):
        reach = buffer_members.get(tile, [])
        if not reach:
            unreachable += 1
        elif not any(i in chosen for i in reach):
            chosen.add(random.Random(f"{seed}:source:{tile}").choice(reach))
            added_buffer += 1
    n = 0
    with open(src, encoding="utf-8") as fh, open(dst, "w", encoding="utf-8") as out:
        for i, line in enumerate(fh):
            if i in chosen:
                out.write(line)
                n += 1
    return n, added, added_buffer, unreachable


# ------------------------------------------------------------------ build

def _source_fields(src):
    db = sqlite3.connect(f"file:{src}?mode=ro", uri=True)
    meta = dict(db.execute("select name, value from metadata").fetchall())
    db.close()
    return meta


def cmd_build(a):
    work = Path(a.work)
    out, parts, logs, tmp = work / "out", work / "parts", work / "logs", work / "tmp"
    for d in (out, parts, logs, tmp):
        d.mkdir(parents=True, exist_ok=True)
    src = str(Path(a.source).resolve())
    slim = Path(a.slim)
    stats = json.loads((Path(a.extract_work) / "input-stats.json").read_text())
    slim_sha = _sha256(slim)
    if slim_sha != stats["slim_sha256"]:
        print(f"build: STOP. slim.ndjson digest {slim_sha} differs from input-stats {stats['slim_sha256']}", file=sys.stderr)
        sys.exit(3)

    version = subprocess.run(["tippecanoe", "--version"], capture_output=True, text=True)
    tippecanoe_version = (version.stdout + version.stderr).strip()
    pm_version = subprocess.run(["pmtiles", "version"], capture_output=True, text=True)
    pm_version = (pm_version.stdout + pm_version.stderr).strip().splitlines()[0] if (pm_version.stdout + pm_version.stderr).strip() else "unknown"

    thin = parts / "z6-7.mbtiles"
    cmd = ["tippecanoe", *TIPPECANOE_FLAGS, "--force", "--temporary-directory", str(tmp), "-o", str(thin), str(slim)]
    print("build z6-7:", " ".join(cmd), flush=True)
    rc, secs = _run(cmd, logs / "tippecanoe-z6-7.log")
    print(f"tippecanoe rc={rc} {secs}s", flush=True)
    if rc:
        sys.exit(rc)

    def max_bytes(path, z):
        c = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
        r = c.execute("select max(length(tile_data)), count(*), sum(length(tile_data)) from tiles where zoom_level=?", (z,)).fetchone()
        c.close()
        return r

    briefed_z7 = max_bytes(thin, 7)
    print(f"briefed flags at z7: max tile {briefed_z7[0]} bytes, {briefed_z7[1]} tiles (discarded for the share criterion)", flush=True)
    z7 = parts / "z7.mbtiles"
    sample = parts / "z7-sample.ndjson"
    sdb = sqlite3.connect(f"file:{src}?mode=ro", uri=True)
    source_z7 = {(c, (1 << 7) - 1 - r) for c, r in sdb.execute("select tile_column, tile_row from tiles where zoom_level=7")}
    sdb.close()
    frac, trace, settled = SAMPLE_START_FRACTION, [], False
    for attempt in range(10):
        kept_n, cover_added, source_added, unreachable = sample_with_coverage(
            str(slim), str(sample), frac, SAMPLE_SEED, 7, required_tiles=source_z7)
        cmd7 = ["tippecanoe", *SAMPLE_FLAGS, "--force", "--temporary-directory", str(tmp), "-o", str(z7), str(sample)]
        rc, secs = _run(cmd7, logs / "tippecanoe-z7.log")
        if rc:
            sys.exit(rc)
        mx = max_bytes(z7, 7)[0]
        trace.append({"fraction": round(frac, 6), "points": kept_n, "added_for_tile_coverage": cover_added,
                      "added_for_source_tile_coverage": source_added, "source_tiles_without_a_reachable_point": unreachable,
                      "max_tile_bytes": mx})
        print(f"z7 attempt {attempt}: fraction {frac:.5f}, {kept_n} points ({cover_added} added for tile coverage, "
              f"{source_added} for source tiles, {unreachable} source tiles unreachable), max tile {mx} bytes", flush=True)
        lo, hi = SAMPLE_TARGET_BYTES
        if lo <= mx <= hi:
            settled = True
            break
        if frac >= 1.0 and mx < lo:
            settled = True
            break
        frac = min(1.0, frac * (lo + hi) / 2 / mx)
    if not settled:
        print("build: the z7 fraction did not settle", file=sys.stderr)
        sys.exit(4)
    cmd7_text = " ".join(["tippecanoe", *SAMPLE_FLAGS, "-o", "<work>/parts/z7.mbtiles", "<z7-sample.ndjson>"])

    merged = out / f"{name(a)}.mbtiles"
    partial = out / f"{name(a)}.mbtiles.partial"
    for p in (partial, merged):
        if p.exists():
            p.unlink()
    t0 = time.time()
    db = sqlite3.connect(f"file:{partial}?mode=rwc", uri=True)
    db.executescript(
        "pragma journal_mode=off; pragma synchronous=off;"
        "create table metadata (name text, value text);"
        "create table tiles (zoom_level integer, tile_column integer, tile_row integer, tile_data blob);")
    db.execute("pragma synchronous=off")
    db.execute("attach database ? as thin", (f"file:{thin}?mode=ro",))
    db.execute("attach database ? as src", (f"file:{src}?mode=ro",))
    db.execute("attach database ? as z7part", (f"file:{z7}?mode=ro",))
    n_thin = db.execute(
        "insert into tiles select zoom_level, tile_column, tile_row, tile_data from thin.tiles where zoom_level = 6").rowcount
    n_thin += db.execute(
        "insert into tiles select zoom_level, tile_column, tile_row, tile_data from z7part.tiles where zoom_level = 7").rowcount
    n_thin_other = (db.execute("select count(*) from z7part.tiles where zoom_level != 7").fetchone()[0]
                    + db.execute("select count(*) from thin.tiles where zoom_level not in (6, 7)").fetchone()[0])
    n_copy = db.execute(
        "insert into tiles select zoom_level, tile_column, tile_row, tile_data from src.tiles where zoom_level >= ?",
        (COPY_FROM_ZOOM,)).rowcount
    db.commit()
    db.execute("create unique index tile_index on tiles (zoom_level, tile_column, tile_row)")

    sm = dict(db.execute("select name, value from src.metadata").fetchall())
    tm = dict(db.execute("select name, value from thin.metadata").fetchall())
    src_json = json.loads(sm["json"])
    src_layer = src_json["vector_layers"][0]
    # field names and types only: the z8-18 tiles keep every source attribute, z6-7 carry the six
    layer = {"id": LAYER, "description": "", "minzoom": MIN_ZOOM, "maxzoom": MAX_ZOOM, "fields": src_layer["fields"]}
    ts = json.loads(_public_metadata({"json": sm["json"]})["json"])["tilestats"]
    meta = {
        "name": name(a),
        "description": f"{name(a)}: z6-7 sampled and slimmed to six attributes, z8-18 byte-for-byte from places.mbtiles",
        "version": "2",
        "type": "overlay",
        "format": "pbf",
        "minzoom": str(MIN_ZOOM),
        "maxzoom": str(MAX_ZOOM),
        "bounds": sm.get("bounds", tm.get("bounds")),
        "center": sm.get("center", tm.get("center")),
        "generator": f"build_places_v2.py ({tippecanoe_version} for z6-7; z8-18 copied from places.mbtiles)",
        "json": json.dumps({"vector_layers": [layer], "tilestats": ts}, ensure_ascii=False, separators=(",", ":")),
    }
    db.executemany("insert into metadata values (?, ?)", [(k, v) for k, v in meta.items() if v is not None])
    db.execute("create unique index name on metadata (name)")
    db.commit()
    db.close()
    partial.rename(merged)
    print(f"merge: {n_thin} thin tiles, {n_copy} copied tiles, {n_thin_other} thin-build tiles outside z6-7 ignored, {round(time.time()-t0)}s", flush=True)

    pm = out / f"{name(a)}.pmtiles"
    if pm.exists():
        pm.unlink()
    cmd = ["pmtiles", "convert", str(merged), str(pm), f"--tmpdir={tmp}"]
    print("convert:", " ".join(cmd), flush=True)
    rc, secs = _run(cmd, logs / "pmtiles-convert.log")
    print(f"pmtiles convert rc={rc} {secs}s", flush=True)
    if rc:
        sys.exit(rc)
    (work / "build-info.json").write_text(json.dumps({
        "tippecanoe": tippecanoe_version, "pmtiles_cli": pm_version,
        "commands": {
            "z6": " ".join(["tippecanoe", *TIPPECANOE_FLAGS, "-o", "<work>/parts/z6-7.mbtiles", "<slim.ndjson>"]) + " (only z6 is kept)",
            "z7": cmd7_text,
            "copy": f"sqlite insert into tiles select ... from places.mbtiles.tiles where zoom_level >= {COPY_FROM_ZOOM} (read-only attach)",
            "convert": f"pmtiles convert {merged.name} {pm.name}"},
        "z7_briefed_flags_discarded": {"max_tile_bytes": briefed_z7[0], "tiles": briefed_z7[1], "total_bytes": briefed_z7[2]},
        "z7_calibration": {"seed": SAMPLE_SEED, "attempts": trace, "target_bytes": list(SAMPLE_TARGET_BYTES)},
        "thin_tiles_inserted": n_thin, "copied_tiles_inserted": n_copy,
        "slim_sha256": slim_sha, "built_at": datetime.now(timezone.utc).isoformat()}, indent=2) + "\n")


# --------------------------------------------------------------- validate

def _decode_thin(args):
    import mapbox_vector_tile

    z, x, y, data = args
    d = mapbox_vector_tile.decode(gzip.decompress(data), default_options={"y_coord_down": True})
    religion, keys, attrs, attr_core = collections.Counter(), collections.Counter(), set(), collections.Counter()
    core = 0
    for lyr in d.values():
        ext = lyr["extent"]
        for f in lyr["features"]:
            g = f["geometry"]
            pts = g["coordinates"] if g["type"] == "MultiPoint" else [g["coordinates"]]
            p = f["properties"]
            attrs.update(p.keys())
            present = [k for k, v in p.items() if v is not None]
            for px, py in pts:
                if 0 <= px < ext and 0 <= py < ext:
                    core += 1
                    attr_core.update(present)
                    religion[p.get("religion")] += 1
                    if p.get("osm_id") is not None:
                        keys[(p.get("osm_type"), p.get("osm_id"))] += 1
    return z, x, y, list(d), core, religion, keys, attrs, attr_core


def _scan_src_zoom(args):
    """Digest every tile of the source at one zoom into a sqlite file keyed by z, x, y (xyz)."""
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
    n = out.execute("select count(*) from d").fetchone()[0]
    out.close()
    db.close()
    return z, n


def _p95(v):
    v = sorted(v)
    return v[min(len(v) - 1, math.ceil(0.95 * len(v)) - 1)] if v else None


def size_table(sizes):
    return {str(z): {"tiles": len(v), "max_bytes": max(v), "p95_bytes": _p95(v), "mean_bytes": round(sum(v) / len(v)),
                     "total_bytes": sum(v)} for z, v in sorted(sizes.items()) if v}


def attribute_problems(zoom, seen, core_counts, core, slim_counts, slim_total, expected=ATTRS):
    """Problems with the attributes of one zoom's tiles, judged on that zoom alone.

    `seen` is the set of attribute names on any feature of the zoom, `core_counts` the number of tile-proper points
    carrying each attribute, `core` the number of tile-proper points, `slim_counts` the number of input features
    carrying each attribute (value not null) and `slim_total` the input's feature count. An attribute the input
    carries on every feature must be on every tile-proper point; one the input carries on some features must be on
    some points; one the input never carries may be absent."""
    found = []
    if set(seen) - set(expected):
        found.append(f"z{zoom}: attributes {sorted(set(seen) - set(expected))} are not among the expected six")
    for attr in expected:
        have, want = core_counts.get(attr, 0), slim_counts.get(attr, 0)
        if want == 0:
            continue
        if want == slim_total and have != core:
            found.append(f"z{zoom}: attribute {attr} is on {have} of {core} tile points, but the input has it on every feature")
        elif have == 0:
            found.append(f"z{zoom}: attribute {attr} is on no tile point, but the input has it on {want} features")
    return found


def coverage_unmet(zoom, source_tiles, archive_tiles):
    """Source tiles with features that the archive lacks, as an unmet L1 criterion (or None)."""
    absent = set(source_tiles) - set(archive_tiles)
    if absent:
        return f"z{zoom}: {len(absent)} source tiles that hold features have no archive tile (L1 requires one for each)"
    return None


BOUND_INPUTS = ("archive_sha256", "source_sha256", "slim_sha256")


def binding_mismatches(recorded, current):
    """Names of the bound inputs whose recorded digest is missing or differs from the current digest."""
    return [k for k in BOUND_INPUTS if not recorded or not recorded.get(k) or recorded.get(k) != current.get(k)]


PER_TILE_COLUMNS = ["x", "y", "input_points", "archive_points", "input_counts", "archive_counts", "max_abs_diff_pp"]


def per_tile_religion_rows(in_rel, out_rel, religions):
    """Per-tile religion counts of the input and the archive, and the largest share difference, for one zoom.

    `in_rel` and `out_rel` map (x, y) to a Counter of religion; `religions` is the ordered list of reported
    religions, the last entry being "other" for every religion outside the list. A row is
    [x, y, input points, archive points, input counts, archive counts, largest absolute share difference in
    percentage points]; the difference is None when either side has no points."""
    keep = set(religions[:-1])

    def fold(counter):
        row = [0] * len(religions)
        for rel, n in counter.items():
            row[religions.index(rel) if rel in keep else len(religions) - 1] += n
        return row

    rows = []
    for tile in sorted(set(in_rel) | set(out_rel)):
        ci, co = fold(in_rel.get(tile, {})), fold(out_rel.get(tile, {}))
        ni, no = sum(ci), sum(co)
        diff = max(abs(co[k] / no - ci[k] / ni) for k in range(len(religions))) * 100 if ni and no else None
        rows.append([tile[0], tile[1], ni, no, ci, co, None if diff is None else round(diff, 3)])
    return rows


def per_tile_summary(rows, min_points=100):
    """Summary of the per-tile differences over tiles with at least `min_points` input points."""
    diffs = sorted(r[6] for r in rows if r[2] >= min_points and r[6] is not None)
    out = {"tiles": len(rows), "tiles_without_archive_points": sum(1 for r in rows if r[3] == 0),
           "min_points": min_points, "tiles_at_or_above_min_points": len(diffs)}
    if diffs:
        out.update({"median_max_abs_diff_pp": diffs[len(diffs) // 2], "p95_max_abs_diff_pp": _p95(diffs), "max_max_abs_diff_pp": diffs[-1],
                    "tiles_over_5_pp": sum(1 for d in diffs if d > 5), "tiles_over_10_pp": sum(1 for d in diffs if d > 10)})
    return out


def cmd_validate(a):
    from pmtiles.reader import Compression, MmapSource, Reader, all_tiles

    work = Path(a.work)
    out = work / "out"
    pm_path = out / f"{name(a)}.pmtiles"
    src = str(Path(a.source).resolve())
    stats = json.loads((Path(a.extract_work) / "input-stats.json").read_text())
    total_in = stats["total"]
    in_share = {k: v / total_in for k, v in stats["by_religion"].items()}
    report = {"generated_at": datetime.now(timezone.utc).isoformat(), "archive": pm_path.name,
              "problems": [], "criteria_not_met": []}
    problems, unmet = report["problems"], report["criteria_not_met"]
    warnings = report.setdefault("warnings", [])
    t0 = time.time()

    # --- bind this report to the archive, the source and the slim input it examined
    ex = json.loads((Path(a.extract_work) / "extract-report.json").read_text())
    inputs = {"archive_sha256": _sha256(pm_path), "archive_bytes": pm_path.stat().st_size,
              "source_sha256": _sha256(Path(src)), "source_bytes": Path(src).stat().st_size, "slim_sha256": _sha256(Path(a.slim))}
    report["inputs"] = inputs
    if inputs["slim_sha256"] != stats["slim_sha256"]:
        problems.append("slim.ndjson digest differs from input-stats")
    if inputs["source_sha256"] != ex["source"]["sha256"]:
        problems.append("places.mbtiles digest differs from the extract report")

    # --- header and metadata
    with open(pm_path, "rb") as fh:
        src_pm = MmapSource(fh)
        reader = Reader(src_pm)
        h = reader.header()
        meta = reader.metadata()
        report["header"] = {"min_zoom": h["min_zoom"], "max_zoom": h["max_zoom"],
                            "tile_type": str(h["tile_type"]), "tile_compression": str(h["tile_compression"]),
                            "addressed_tiles": h.get("addressed_tiles_count"), "tile_contents": h.get("tile_contents_count")}
        if (h["min_zoom"], h["max_zoom"]) != (MIN_ZOOM, MAX_ZOOM):
            problems.append(f"header zooms {h['min_zoom']}-{h['max_zoom']}, expected {MIN_ZOOM}-{MAX_ZOOM}")
        if h["tile_compression"] != Compression.GZIP:
            problems.append("tile compression is not gzip")
        layers_meta = [l["id"] for l in meta.get("vector_layers", [])]
        report["metadata_layers"] = layers_meta
        if layers_meta != [LAYER]:
            problems.append(f"metadata vector_layers {layers_meta}, expected [{LAYER!r}]")
        if "tilestats" in meta:
            for lyr in meta["tilestats"].get("layers", []):
                for at in lyr.get("attributes", []):
                    if "values" in at:
                        problems.append("metadata tilestats carry attribute value samples")
                        break

        # --- one pass over the archive: digests for z>=8, bytes and tiles for z6-7
        digest_db = work / "digests-pm.sqlite"
        if digest_db.exists():
            digest_db.unlink()
        dd = sqlite3.connect(digest_db)
        dd.execute("create table d (z integer, x integer, y integer, sha text, n integer)")
        batch, thin_jobs, sizes = [], [], collections.defaultdict(list)
        seen_thin, below_min = set(), 0
        count_z = collections.Counter()
        for (z, x, y), data in all_tiles(src_pm):
            count_z[z] += 1
            if z < MIN_ZOOM:
                below_min += 1
            if z in THIN_ZOOMS:
                if (z, x, y) in seen_thin:
                    continue
                seen_thin.add((z, x, y))
                b = bytes(data)
                sizes[z].append(len(b))
                thin_jobs.append((z, x, y, b))
            elif z >= COPY_FROM_ZOOM:
                b = bytes(data)
                batch.append((z, x, y, hashlib.sha256(b).hexdigest(), len(b)))
                if len(batch) >= 20000:
                    dd.executemany("insert into d values (?,?,?,?,?)", batch)
                    batch = []
        dd.executemany("insert into d values (?,?,?,?,?)", batch)
        dd.commit()
    report["tiles_per_zoom"] = {str(z): n for z, n in sorted(count_z.items())}
    report["scan_seconds"] = round(time.time() - t0)
    if below_min:
        problems.append(f"{below_min} tiles below z{MIN_ZOOM}")

    # --- z8-18 against the source, byte for byte
    tmpd = work / "digests-src"
    tmpd.mkdir(exist_ok=True)
    zooms = list(range(COPY_FROM_ZOOM, MAX_ZOOM + 1))
    jobs = a.jobs
    with mp.Pool(jobs) as pool:
        res = pool.map(_scan_src_zoom, [(src, z, str(tmpd / f"z{z}.sqlite")) for z in sorted(zooms, reverse=True)], chunksize=1)
        thin = list(pool.imap_unordered(_decode_thin, thin_jobs, chunksize=4))
    src_counts = dict(res)
    copy_rows = {}
    for z in zooms:
        s = sqlite3.connect(tmpd / f"z{z}.sqlite")
        s.execute("attach database ? as p", (str(digest_db),))
        only_src = s.execute("select count(*) from (select x, y, sha, n from d except select x, y, sha, n from p.d where z=?)", (z,)).fetchone()[0]
        only_pm = s.execute("select count(*) from (select x, y, sha, n from p.d where z=? except select x, y, sha, n from d)", (z,)).fetchone()[0]
        n_pm = s.execute("select count(*) from p.d where z=?", (z,)).fetchone()[0]
        copy_rows[str(z)] = {"source_tiles": src_counts[z], "archive_tiles": n_pm,
                             "in_source_not_identical_in_archive": only_src, "in_archive_not_identical_in_source": only_pm}
        if only_src or only_pm or n_pm != src_counts[z]:
            unmet.append(f"z{z}: tile set or bytes differ from the source (source {src_counts[z]}, archive {n_pm}, "
                         f"source-only {only_src}, archive-only {only_pm})")
        s.close()
    report["z8_18_byte_identity"] = {
        "per_zoom": copy_rows,
        "source_tiles": sum(v["source_tiles"] for v in copy_rows.values()),
        "archive_tiles": sum(v["archive_tiles"] for v in copy_rows.values()),
        "mismatched_or_missing": sum(v["in_source_not_identical_in_archive"] + v["in_archive_not_identical_in_source"]
                                     for v in copy_rows.values()),
        "method": "sha256 and length of every stored tile, compared per (z, x, y) in both directions; the archive is read "
                  "through the pmtiles reader and the source through its tiles view, read-only"}

    # --- z6-7: size cap, shares, counts, attributes, keys
    slim_keys = collections.Counter()
    input_tiles = {z: collections.Counter() for z in THIN_ZOOMS}
    input_rel = {z: collections.defaultdict(collections.Counter) for z in THIN_ZOOMS}
    slim_attr_counts, slim_total = collections.Counter(), 0
    with open(a.slim, encoding="utf-8") as fh:
        for line in fh:
            f = json.loads(line)
            p = f["properties"]
            slim_total += 1
            slim_attr_counts.update(k for k, v in p.items() if v is not None)
            if "osm_id" in p:
                slim_keys[(p.get("osm_type"), p.get("osm_id"))] += 1
            lon, lat = f["geometry"]["coordinates"]
            for z in THIN_ZOOMS:
                tile, clear = _interior(lon, lat, z)
                input_rel[z][tile][p.get("religion")] += 1
                if clear:
                    input_tiles[z][tile] += 1
    agg = {z: {"core": 0, "religion": collections.Counter(), "keys": collections.Counter(), "attrs": set(),
               "attr_core": collections.Counter()} for z in THIN_ZOOMS}
    attrs, layers = set(), set()
    core_by_tile = {}
    out_rel = {z: {} for z in THIN_ZOOMS}
    for z, x, y, lys, core, rel, keys, at, attr_core in thin:
        core_by_tile[(z, x, y)] = core
        out_rel[z][(x, y)] = rel
        e = agg[z]
        e["core"] += core
        e["religion"].update(rel)
        e["keys"].update(keys)
        e["attrs"] |= at
        e["attr_core"].update(attr_core)
        attrs |= at
        layers |= set(lys)
    report["z6_7_size_bytes"] = size_table(sizes)
    for z in THIN_ZOOMS:
        mx = max(sizes[z]) if sizes[z] else None
        if mx is None:
            problems.append(f"no tiles at z{z}")
        elif mx > TILE_CAP_BYTES:
            unmet.append(f"z{z}: largest tile {mx} bytes exceeds {TILE_CAP_BYTES}")
    report["z6_7_attributes"] = sorted(attrs)
    report["z6_7_layers"] = sorted(layers)
    # each zoom is judged alone, so a field missing at one zoom is not hidden by the other
    report["z6_7_attributes_by_zoom"] = {}
    for z in THIN_ZOOMS:
        e = agg[z]
        report["z6_7_attributes_by_zoom"][str(z)] = {
            "seen": sorted(e["attrs"]), "tile_points": e["core"],
            "points_carrying": {k: e["attr_core"].get(k, 0) for k in ATTRS},
            "input_features_carrying": {k: slim_attr_counts.get(k, 0) for k in ATTRS}}
        problems += attribute_problems(z, e["attrs"], e["attr_core"], e["core"], slim_attr_counts, slim_total)
    if layers != {LAYER}:
        problems.append(f"z6-7 layers {sorted(layers)}, expected [{LAYER!r}]")

    shares = {}
    for z in THIN_ZOOMS:
        e = agg[z]
        kept = e["core"]
        row = {"kept_features": kept, "input_features": total_in, "fraction_kept": round(kept / total_in, 5), "religions": {}}
        worst, finite = 0.0, kept >= 1
        for rel, s in in_share.items():
            if s <= SHARE_FLOOR:
                continue
            ks = e["religion"].get(rel, 0) / kept if kept else float("nan")
            d = (ks - s) * 100
            if not math.isfinite(d):
                finite = False
                continue
            row["religions"][rel] = {"input_pct": round(s * 100, 3), "kept_pct": round(ks * 100, 3), "diff_pp": round(d, 3)}
            worst = max(worst, abs(d))
        row["max_abs_diff_pp"] = round(worst, 3) if finite else None
        row["within_tolerance"] = bool(finite and worst <= SHARE_TOLERANCE_PP)
        shares[str(z)] = row
        if not finite:
            problems.append(f"z{z}: no features or religion shares not finite")
        elif worst > SHARE_TOLERANCE_PP:
            unmet.append(f"z{z}: religion share deviates by {worst:.3f} pp from the input (tolerance {SHARE_TOLERANCE_PP} pp)")
        over = sum(1 for k, v in e["keys"].items() if v > slim_keys.get(k, 0))
        row["osm_keys_in_tiles"] = len(e["keys"])
        row["osm_keys_over_input_multiplicity"] = over
        row["features_with_osm_key"] = sum(e["keys"].values())
        if over:
            problems.append(f"z{z}: {over} osm keys occur more often than in the input")
        if kept > total_in:
            problems.append(f"z{z}: more features than the input")
    report["z6_7_religion_shares"] = shares

    # --- z6-7 tile set against the source tile set
    sdb = sqlite3.connect(f"file:{src}?mode=ro", uri=True)
    src_tiles = {z: {(c, (1 << z) - 1 - r): n for c, r, n in sdb.execute(
        "select tile_column, tile_row, length(tile_data) from tiles where zoom_level=?", (z,))} for z in THIN_ZOOMS}
    sdb.close()
    out_tiles = collections.defaultdict(set)
    for z, x, y, _ in thin_jobs:
        out_tiles[z].add((x, y))
    cover = {}
    for z in THIN_ZOOMS:
        extra = out_tiles[z] - set(src_tiles[z])
        # a tile that holds only a neighbour's buffer copy has no point in its proper area: no client sees a dot there
        outside = sum(1 for t in extra if core_by_tile[(z, *t)] > 0)
        absent = set(src_tiles[z]) - out_tiles[z]
        lost = [t for t in input_tiles[z] if core_by_tile.get((z, *t), 0) == 0]
        cover[str(z)] = {"source_tiles": len(src_tiles[z]), "archive_tiles": len(out_tiles[z]),
                         "archive_tiles_not_in_source": len(extra),
                         "archive_tiles_not_in_source_with_points_in_proper_area": outside,
                         "source_tiles_absent_from_archive": len(absent),
                         "input_tiles_with_points": len(input_tiles[z]),
                         "input_tiles_without_a_dot_in_archive": len(lost)}
        gap = coverage_unmet(z, src_tiles[z], out_tiles[z])
        if gap:
            unmet.append(gap)
        if lost and z in STRATIFIED_ZOOMS:
            problems.append(f"z{z}: {len(lost)} tiles that hold input points have no dot in the archive")
        elif lost:
            warnings.append(f"z{z}: {len(lost)} of {len(input_tiles[z])} tiles that hold input points have no dot in their proper "
                            "area (the briefed drop-fraction flags thin sparse tiles to nothing; the tile exists with a neighbour's buffer copy)")
        if outside:
            problems.append(f"z{z}: {outside} tiles that the source does not have hold points in their proper area")
    report["z6_7_tile_coverage"] = cover
    live = {str(z): {"tiles": len(src_tiles[z]), "max_bytes": max(src_tiles[z].values()),
                     "p95_bytes": _p95(list(src_tiles[z].values())), "total_bytes": sum(src_tiles[z].values())} for z in THIN_ZOOMS}
    report["z6_7_live_source_size_bytes"] = live

    # --- per-tile religion diagnostics (reported, not gated: small tiles are noisy; the global shares above are the gate)
    reported = [r for r, s in sorted(in_share.items(), key=lambda kv: -kv[1]) if s > SHARE_FLOOR]
    religions = [str(r) for r in reported] + ["other"]
    rows_by_zoom = {}
    for z in THIN_ZOOMS:
        rows_by_zoom[str(z)] = per_tile_religion_rows(input_rel[z], out_rel[z], religions)
    report["z6_7_per_tile_religion"] = {
        "file": f"per-tile-religion-{name(a)}.json",
        "method": "for each z6 and z7 tile, religion counts of the input points in the tile's area against the points in the "
                  "archive tile's proper area, over the religions above 0.5 percent of the input and one 'other' bucket, with the "
                  "largest absolute difference in share (percentage points); diagnostic only, so tiles with few points are noisy",
        "summary": {str(z): per_tile_summary(rows_by_zoom[str(z)]) for z in THIN_ZOOMS}}
    (work / "per-tile-religion.json").write_text(
        '{"archive": ' + json.dumps(pm_path.name) + ', "archive_sha256": ' + json.dumps(inputs["archive_sha256"]) +
        ', "religions": ' + json.dumps(religions, ensure_ascii=False) + ', "columns": ' + json.dumps(PER_TILE_COLUMNS) +
        ', "rows": {' + ", ".join(f'"{z}": [\n' + ",\n".join(json.dumps(r, separators=(",", ":")) for r in rows) + "\n]"
                                  for z, rows in rows_by_zoom.items()) + "}}\n")

    # the archive must be the one hashed at the start
    if _sha256(pm_path) != inputs["archive_sha256"]:
        problems.append("the archive changed while it was being validated")
    report["status"] = "failed" if problems else ("criteria_not_met" if unmet else "passed")
    report["seconds"] = round(time.time() - t0)
    (work / "validation-report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({k: report[k] for k in ("status", "problems", "criteria_not_met")}, indent=2), flush=True)
    if problems:
        sys.exit(5)
    if unmet:
        sys.exit(6)


# ---------------------------------------------------------------- measure

def _tile_cover(lon, lat, zoom, tile_zoom, width, height):
    """Tiles of zoom tile_zoom (512 px, MapLibre vector) under a viewport centred on lon, lat at map zoom `zoom`."""
    scale = 512 * 2 ** zoom
    cx = (lon + 180) / 360 * scale
    cy = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * scale
    per_tile = 512 * 2 ** (zoom - tile_zoom)
    n = 2 ** tile_zoom
    x0, x1 = int((cx - width / 2) // per_tile), int((cx + width / 2) // per_tile)
    y0, y1 = int((cy - height / 2) // per_tile), int((cy + height / 2) // per_tile)
    return [(x % n, y) for x in range(x0, x1 + 1) for y in range(max(0, y0), min(n - 1, y1) + 1)]


def _curl(url):
    for _ in range(3):
        r = subprocess.run(["curl", "-sS", "-o", "/dev/null", "-m", "30", "-H", "Accept-Encoding: gzip",
                            "-w", "%{http_code} %{size_download} %{time_total}", url], capture_output=True, text=True)
        try:
            code, size, secs = r.stdout.split()
            if int(code) == 200:
                return int(code), int(size), float(secs)
        except ValueError:
            pass
    return None, None, None


def cmd_measure(a):
    work = Path(a.work)
    pm_mb = work / "out" / f"{name(a)}.mbtiles"
    src = str(Path(a.source).resolve())
    pages = json.loads(Path(a.pages).read_text())
    s_db = sqlite3.connect(f"file:{src}?mode=ro", uri=True)
    n_db = sqlite3.connect(f"file:{pm_mb}?mode=ro", uri=True)

    def tile_len(db, z, x, y):
        r = db.execute("select length(tile_data) from tiles where zoom_level=? and tile_column=? and tile_row=?",
                       (z, x, (1 << z) - 1 - y)).fetchone()
        return r[0] if r else 0

    rep = {"generated_at": datetime.now(timezone.utc).isoformat(), "archive": f"{name(a)}.pmtiles"}
    zt = {}
    for z in THIN_ZOOMS:
        live = [r[0] for r in s_db.execute("select length(tile_data) from tiles where zoom_level=?", (z,))]
        new = [r[0] for r in n_db.execute("select length(tile_data) from tiles where zoom_level=?", (z,))]
        zt[str(z)] = {
            "live": {"tiles": len(live), "max_bytes": max(live), "p95_bytes": _p95(live), "total_bytes": sum(live)},
            "new": {"tiles": len(new), "max_bytes": max(new), "p95_bytes": _p95(new), "total_bytes": sum(new)}}
        zt[str(z)]["total_reduction"] = round(1 - sum(new) / sum(live), 4)
    rep["size_table"] = zt

    # curl sample of live tiles: the five largest and a seeded random sample per zoom; sizes are compared with the stored bytes
    import random
    rng = random.Random(20261007)
    sample = []
    for z in THIN_ZOOMS:
        rows = s_db.execute("select tile_column, tile_row, length(tile_data) from tiles where zoom_level=? order by 3 desc", (z,)).fetchall()
        picks = rows[:5] + rng.sample(rows[5:], min(a.curl_sample, len(rows) - 5))
        sample += [(z, c, (1 << z) - 1 - r, n) for c, r, n in picks]
    results = []
    with cf.ThreadPoolExecutor(4) as ex:
        for (z, x, y, stored), (code, size, secs) in zip(
                sample, ex.map(lambda t: _curl(LIVE_URL.format(z=t[0], x=t[1], y=t[2])), sample)):
            results.append({"z": z, "x": x, "y": y, "stored_bytes": stored, "http": code, "served_bytes": size, "seconds": secs})
    ok = [r for r in results if r["http"] == 200]
    ratios = [r["served_bytes"] / r["stored_bytes"] for r in ok if r["stored_bytes"] > 1000]
    rep["curl_sample"] = {
        "tiles": len(results), "http_200": len(ok), "failed": len(results) - len(ok),
        "served_over_stored_min": round(min(ratios), 4), "served_over_stored_max": round(max(ratios), 4),
        "per_zoom": {str(z): {"tiles": sum(1 for r in ok if r["z"] == z),
                              "max_served_bytes": max(r["served_bytes"] for r in ok if r["z"] == z),
                              "p95_served_bytes": _p95([r["served_bytes"] for r in ok if r["z"] == z]),
                              "max_seconds": max(r["seconds"] for r in ok if r["z"] == z)} for z in THIN_ZOOMS},
        "note": "served_bytes is the body the live edge sent with Accept-Encoding: gzip; the edge recompresses what the Worker "
                "decompresses, so it differs slightly from the stored bytes of the same tile in places.mbtiles. The sample is the "
                "five largest tiles and a seeded random sample at each zoom, so its p95 is not the archive's p95"}

    pg = []
    for p in pages:
        zoom, lon, lat = p["initial_zoom"], p["center"][0], p["center"][1]
        tz = max(6, min(18, int(zoom)))
        cover = _tile_cover(lon, lat, zoom, tz, *VIEWPORT)
        live = [tile_len(s_db, tz, x, y) for x, y in cover]
        new = [tile_len(n_db, tz, x, y) for x, y in cover]
        pg.append({"country": p["country"], "initial_zoom": zoom, "tile_zoom": tz, "viewport_tiles": len(cover),
                   "live_bytes": sum(live), "new_bytes": sum(new), "live_max_tile": max(live), "new_max_tile": max(new),
                   "reduction": round(1 - sum(new) / sum(live), 4) if sum(live) else None})
    rep["landing_pages"] = {
        "viewport_css_px": list(VIEWPORT), "pages": pg,
        "total_live_bytes": sum(p["live_bytes"] for p in pg), "total_new_bytes": sum(p["new_bytes"] for p in pg),
        "pages_over_500k_live": sum(1 for p in pg if p["live_max_tile"] > TILE_CAP_BYTES),
        "pages_over_500k_new": sum(1 for p in pg if p["new_max_tile"] > TILE_CAP_BYTES),
        "method": "tiles of the page's initial zoom (floor, at least 6) under a 1440 x 900 css-pixel viewport centred on the "
                  "configured centre, 512-pixel vector tiles; stored (gzip) bytes of the live places.mbtiles against the new archive"}
    (work / "measure-report.json").write_text(json.dumps(rep, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({"size_table": zt, "curl": {k: rep["curl_sample"][k] for k in ("tiles", "http_200", "served_over_stored_min", "served_over_stored_max")},
                      "pages_over_500k": [rep["landing_pages"]["pages_over_500k_live"], rep["landing_pages"]["pages_over_500k_new"]]}, indent=2))


# --------------------------------------------------------------- manifest

def _md_report(rep, meas):
    L = [f"# Validation report, {rep['archive']}", "",
         f"Status: **{rep['status']}**. Generated {rep['generated_at']}. Aggregates only: no attribute values appear here.", ""]
    if rep["problems"] or rep["criteria_not_met"]:
        L += ["## Problems", ""] + [f"- {p}" for p in rep["problems"] + rep["criteria_not_met"]] + [""]
    if rep.get("warnings"):
        L += ["## Warnings", ""] + [f"- {w}" for w in rep["warnings"]] + [""]
    h = rep["header"]
    L += ["## Header", "", f"- zooms {h['min_zoom']}-{h['max_zoom']}, tile type {h['tile_type']}, compression {h['tile_compression']}",
          f"- addressed tiles {h['addressed_tiles']}, distinct tile contents {h['tile_contents']}",
          f"- metadata layers: {', '.join(rep['metadata_layers'])}; tiles per zoom: " + ", ".join(f"z{z} {n}" for z, n in rep["tiles_per_zoom"].items()), ""]
    b = rep["z8_18_byte_identity"]
    L += ["## z8-18 against the source", "",
          f"{b['archive_tiles']} archive tiles, {b['source_tiles']} source tiles, {b['mismatched_or_missing']} mismatched or missing ({b['method']}).", "",
          "| zoom | source tiles | archive tiles | source-only | archive-only |", "|---|---|---|---|---|"]
    L += [f"| {z} | {v['source_tiles']} | {v['archive_tiles']} | {v['in_source_not_identical_in_archive']} | {v['in_archive_not_identical_in_source']} |"
          for z, v in b["per_zoom"].items()]
    L += ["", "## z6-7 tile sizes (stored bytes)", "", "| zoom | tiles | max | p95 | mean | total | live max | live p95 |", "|---|---|---|---|---|---|---|---|"]
    for z, v in rep["z6_7_size_bytes"].items():
        lv = rep["z6_7_live_source_size_bytes"][z]
        L.append(f"| {z} | {v['tiles']} | {v['max_bytes']} | {v['p95_bytes']} | {v['mean_bytes']} | {v['total_bytes']} | {lv['max_bytes']} | {lv['p95_bytes']} |")
    L += ["", f"Attributes in z6-7 tiles: {', '.join(rep['z6_7_attributes'])}. Layers: {', '.join(rep['z6_7_layers'])}.", "",
          "## z6-7 religion shares (tile-proper points, religions above 0.5% of the input)", ""]
    for z, v in rep["z6_7_religion_shares"].items():
        L += [f"z{z}: {v['kept_features']} of {v['input_features']} features kept ({v['fraction_kept']*100:.2f}%); maximum absolute difference "
              f"{v['max_abs_diff_pp']} pp; osm keys over the input multiplicity: {v['osm_keys_over_input_multiplicity']}.", "",
              "| religion | input % | kept % | diff pp |", "|---|---|---|---|"]
        L += [f"| {r} | {d['input_pct']} | {d['kept_pct']} | {d['diff_pp']} |" for r, d in v["religions"].items()] + [""]
    pt = rep["z6_7_per_tile_religion"]
    L += ["## z6-7 per-tile religion shares (diagnostic)", "", f"{pt['method']}. Counts for every tile are in `{pt['file']}`.", "",
          "| zoom | tiles | tiles with no archive point | tiles with at least {} input points | median largest diff pp | p95 | max | tiles over 5 pp | tiles over 10 pp |".format(
              next(iter(pt["summary"].values()))["min_points"]), "|---|---|---|---|---|---|---|---|---|"]
    L += [f"| {z} | {v['tiles']} | {v['tiles_without_archive_points']} | {v['tiles_at_or_above_min_points']} | "
          f"{v.get('median_max_abs_diff_pp')} | {v.get('p95_max_abs_diff_pp')} | {v.get('max_max_abs_diff_pp')} | "
          f"{v.get('tiles_over_5_pp')} | {v.get('tiles_over_10_pp')} |" for z, v in pt["summary"].items()]
    L += ["", "## z6-7 attributes by zoom", ""]
    L += [f"- z{z}: {v['tile_points']} tile points; carrying: " + ", ".join(f"{k} {n}" for k, n in v["points_carrying"].items()) +
          "; input features carrying: " + ", ".join(f"{k} {n}" for k, n in v["input_features_carrying"].items()) for z, v in rep["z6_7_attributes_by_zoom"].items()]
    L += ["", "## Bound inputs", "", "Digests the report was made from; the manifest stage recomputes them and refuses on a difference.", ""]
    L += [f"- {k}: {v}" for k, v in rep["inputs"].items()]
    L += ["", "## z6-7 tile coverage", ""]
    L += [f"- z{z}: {v['archive_tiles']} archive tiles of {v['source_tiles']} source tiles; {v['source_tiles_absent_from_archive']} source tiles have no archive tile; "
          f"{v['archive_tiles_not_in_source']} archive tiles are not in the source ({v['archive_tiles_not_in_source_with_points_in_proper_area']} of them with points in the proper area; the others hold only a neighbour's buffer copy). {v['input_tiles_with_points']} tiles hold input points clear of their edges; {v['input_tiles_without_a_dot_in_archive']} of them have no dot in the archive." for z, v in rep["z6_7_tile_coverage"].items()]
    if meas:
        L += ["", "## Measurement", "", "| zoom | live max | live p95 | live total | new max | new p95 | new total |", "|---|---|---|---|---|---|---|"]
        for z, v in meas["size_table"].items():
            L.append(f"| {z} | {v['live']['max_bytes']} | {v['live']['p95_bytes']} | {v['live']['total_bytes']} | {v['new']['max_bytes']} | {v['new']['p95_bytes']} | {v['new']['total_bytes']} |")
        c = meas["curl_sample"]
        L += ["", f"Curl sample of live tiles: {c['http_200']} of {c['tiles']} returned 200; served bytes were {c['served_over_stored_min']} to {c['served_over_stored_max']} of the stored bytes (the edge recompresses). Largest served tile: " + ", ".join(f"z{z} {v['max_served_bytes']} bytes" for z, v in c['per_zoom'].items()) + ".", "",
              "### Country pages that open at z6-7", "", "| country | zoom | viewport tiles | live bytes | new bytes | live max tile | new max tile |", "|---|---|---|---|---|---|---|"]
        L += [f"| {p['country'].upper()} | {p['initial_zoom']} | {p['viewport_tiles']} | {p['live_bytes']} | {p['new_bytes']} | {p['live_max_tile']} | {p['new_max_tile']} |"
              for p in meas["landing_pages"]["pages"]]
        lp = meas["landing_pages"]
        L += ["", f"Totals: live {lp['total_live_bytes']} bytes, new {lp['total_new_bytes']} bytes. Pages with a tile over 500,000 bytes: {lp['pages_over_500k_live']} live, {lp['pages_over_500k_new']} new. {lp['method']}."]
    return "\n".join(L) + "\n"


def cmd_manifest(a):
    import jsonschema

    work, out = Path(a.work), Path(a.work) / "out"
    stats = json.loads((Path(a.extract_work) / "input-stats.json").read_text())
    ex = json.loads((Path(a.extract_work) / "extract-report.json").read_text())
    info = json.loads((work / "build-info.json").read_text())
    rep = json.loads((work / "validation-report.json").read_text())
    meas_path = work / "measure-report.json"
    meas = json.loads(meas_path.read_text()) if meas_path.exists() else None
    if rep["status"] != "passed":
        print(f"manifest: the validation report says {rep['status']}; no manifest is written", file=sys.stderr)
        sys.exit(6)
    pm = out / f"{name(a)}.pmtiles"
    # the report must describe these files: recompute the digests it recorded and refuse on any difference
    current = {"archive_sha256": _sha256(pm), "source_sha256": _sha256(Path(a.source)), "slim_sha256": _sha256(Path(a.slim))}
    bad = binding_mismatches(rep.get("inputs"), current)
    if bad:
        print(f"manifest: the validation report was not made from the current {', '.join(bad)}; validate again", file=sys.stderr)
        sys.exit(7)
    if info["slim_sha256"] != current["slim_sha256"]:
        print("manifest: build-info records a different slim input than the current one; build again", file=sys.stderr)
        sys.exit(7)
    params = {
        "z6_flags": ["tippecanoe", *TIPPECANOE_FLAGS], "z7_flags": ["tippecanoe", *SAMPLE_FLAGS],
        "z7_sample": {"seed": SAMPLE_SEED, "stratified_by": "religion", "calibration": info["z7_calibration"],
                      "briefed_flags_discarded": info["z7_briefed_flags_discarded"],
                      "reason": "the briefed flags at z7 shift the christian share by -0.459 pp, beyond the 0.3 pp criterion"},
        "thin_zooms": list(THIN_ZOOMS), "copy_from_zoom": COPY_FROM_ZOOM,
        "layer": LAYER, "z6_7_attributes": ATTRS, "z0_5": "not built: the public map's places source has minzoom 6 and the RA layers read this tier from z8",
        "z8_18": "rows copied byte for byte from places.mbtiles (read-only attach), verified by digest in both directions",
        "source_sha256": ex["source"]["sha256"], "source_bytes": ex["source"]["bytes"], "slim_sha256": info["slim_sha256"],
        "input_features": stats["total"]}
    files = [{
        "uri": f"green:{pm.resolve()}", "storage_provider": "other", "format": "pmtiles", "bytes": pm.stat().st_size,
        "sha256": current["archive_sha256"], "feature_count": None, "privacy": "public", "licence_status": "needs_review",
        "notes": ("public places tier, z6-18, layer places. z6-7 are a fraction-preserving sample of the 2,072,349 input places, "
                  "six attributes, capped at 500,000 bytes per tile; z8-18 are byte-identical to the live places tileset. "
                  f"commands: {_cmd_text(info['commands']['z6'])}; {_cmd_text(info['commands']['z7'])} (seeded religion-stratified sample, fraction in the parameters);{info['commands']['copy']}; {info['commands']['convert']}. "
                  "Location is a machine-local build output on green, a cache and not a durable store; the durable copy is the R2 object, once uploaded and recorded.")}]
    ident = hashlib.sha256(json.dumps({"files": [(pm.name, files[0]["sha256"])], "params": params}, sort_keys=True).encode()).hexdigest()
    manifest = {
        "$schema": "../../../schemas/data-manifest.schema.json",
        "schema_version": "data-manifest.v2",
        "manifest_id": f"manifest:{name(a)}-{ident[:12]}",
        "dataset_id": name(a),
        "dataset_version_id": f"{name(a)}:{ident[:16]}",
        "dataset_family": "places-tiles",
        "dataset_role": "public_product",
        "scope": {"level": "global", "snapshot_date": "2026-07-22", "pipeline_stage": "staged"},
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "created_by": a.created_by,
        "pipeline": {
            "script": "tools/tiles-r2/build_places_v2.py", "git_commit": a.git_commit or None,
            "command": "uv run tools/tiles-r2/build_places_v2.py all --work <dir> --source <places.mbtiles> --slim <slim.ndjson> --extract-work <dir>",
            "parameters": params,
            "software_versions": {"tippecanoe": info["tippecanoe"], "pmtiles_cli": info["pmtiles_cli"], "python": sys.version.split()[0]}},
        "source": {
            "provider": "places.mbtiles, the live places tileset built 2026-07-22 (z8-18 copied from it); slim.ndjson of tiles-v2-20260722 (z6-7 input)",
            "licence": None,
            "local_cache_hint": f"green:{ex['source']['path']}",
            "citation": (f"places.mbtiles sha256 {ex['source']['sha256']}, {ex['source']['bytes']} bytes; slim.ndjson sha256 {info['slim_sha256']}, "
                         f"{stats['total']} features, extracted by build_tiles_v2.py (see the tiles-v2-{SNAPSHOT} manifests). "
                         "This is a new dataset family member, not a replacement of the overview manifest."),
            "licence_todo": "licence and attribution of the 701,349 places without an OSM key are not established; publication gate (serving the archive) stays open until documented"},
        "durable_files": files,
        "validation": {
            "status": rep["status"],
            "commands": ["uv run tools/tiles-r2/build_places_v2.py validate --work <dir> --source <places.mbtiles> --slim <slim.ndjson> --extract-work <dir>"],
            "warnings": ["licence_status needs_review: licence of the places without an OSM key is not established",
                         "z6-7 hold a sample, and a place can be absent there that appears at z8 (z7 keeps a dot in every tile that holds a point; "
                         "z6 does not, see the coverage counts in the validation report)"] + rep.get("warnings", []),
            "notes": f"full report in tools/tiles-r2/manifests/validation-report-{name(a)}.md",
            "input_features": stats["total"], "criteria_not_met": rep["criteria_not_met"]},
        "downstream_status": "staged"}
    schema_path = Path(a.schema) if a.schema else Path(__file__).resolve().parents[2] / "schemas/data-manifest.schema.json"
    jsonschema.validate(manifest, json.loads(schema_path.read_text()))
    dest = Path(a.manifest_dir)
    dest.mkdir(parents=True, exist_ok=True)
    (dest / f"{name(a)}.manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    (dest / f"validation-report-{name(a)}.json").write_text(json.dumps({"validation": rep, "measurement": meas}, indent=2, ensure_ascii=False) + "\n")
    (dest / f"validation-report-{name(a)}.md").write_text(_md_report(rep, meas))
    shutil.copyfile(work / "per-tile-religion.json", dest / rep["z6_7_per_tile_religion"]["file"])
    print(f"manifest: wrote {dest} (version {manifest['dataset_version_id']})", flush=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("stage", choices=["build", "validate", "measure", "manifest", "all"])
    ap.add_argument("--work", required=True)
    ap.add_argument("--source", required=True, help="places.mbtiles (opened read-only)")
    ap.add_argument("--slim", required=True, help="slim.ndjson of the v2 build")
    ap.add_argument("--extract-work", required=True, help="directory holding input-stats.json and extract-report.json of the v2 build")
    ap.add_argument("--snapshot", default=SNAPSHOT)
    ap.add_argument("--jobs", type=int, default=max(1, (os.cpu_count() or 4) - 2))
    ap.add_argument("--pages", help="measure: JSON list of {country, initial_zoom, center} for the pages that open at z6-7")
    ap.add_argument("--curl-sample", type=int, default=25, help="measure: random live tiles per zoom besides the five largest")
    ap.add_argument("--manifest-dir", default=str(Path(__file__).resolve().parent / "manifests"))
    ap.add_argument("--schema")
    ap.add_argument("--git-commit")
    ap.add_argument("--created-by", default="claude-sonnet-5-5 (workflow agent)")
    a = ap.parse_args()
    stages = ["build", "validate", "measure", "manifest"] if a.stage == "all" else [a.stage]
    for s in stages:
        if s == "measure" and not a.pages:
            print("measure: --pages is required; skipped", file=sys.stderr)
            continue
        print(f"{datetime.now(timezone.utc).isoformat(timespec='seconds')} stage {s}", flush=True)
        {"build": cmd_build, "validate": cmd_validate, "measure": cmd_measure, "manifest": cmd_manifest}[s](a)


if __name__ == "__main__":
    main()
