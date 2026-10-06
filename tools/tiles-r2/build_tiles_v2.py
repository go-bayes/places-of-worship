#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["mapbox-vector-tile", "pmtiles", "jsonschema"]
# ///
"""Build the v2 public overview tileset and the per-country RA dot archives.

Stages (run all with `all`, or one at a time):

  extract   decode every feature from a zoom of the live places.mbtiles,
            remove tile-buffer duplicates, check the count, write slim NDJSON
  build     run tippecanoe for the overview and for each country
  validate  check counts, sizes, shares and attributes; write the report
  manifest  write the data manifest (schemas/data-manifest.schema.json)

Nothing here reads or writes R2, and the source archive is opened read-only.
See tools/tiles-r2/README.md.
"""

from __future__ import annotations

import argparse
import collections
import concurrent.futures as cf
import gzip
import hashlib
import json
import math
import mmap
import multiprocessing as mp
import os
import random
import re
import shutil
import sqlite3
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

SNAPSHOT = "20260722"
EXPECTED_COUNT = 2_072_349
OVERVIEW_LAYER = "places_overview"
OVERVIEW_ATTRS = ["religion", "denomination", "name", "name:en", "osm_id", "osm_type", "country_code"]
RA_ATTRS = ["religion", "denomination", "name", "osm_id", "osm_type", "country_code"]
CC_RE = re.compile(r"^[A-Za-z]{2}$")
SHARE_FLOOR = 0.005  # religions above this share of the input are compared
SHARE_TOLERANCE_PP = 0.3
Z0_LIMIT_BYTES = 250_000

OVERVIEW_FLAGS = ["-Z0", "-z5", "--drop-fraction-as-needed", "-M", "250000", "-l", OVERVIEW_LAYER]
# the overview is built in three parts and joined: z2-5 as briefed, and z0 and z1 each from a religion-stratified
# uniform sample, because z0 and z1 have one and four tiles and drop fractions applied along the spatial index
# shift the religion shares by more than the tolerance (0.449 pp at z1, 1.8 pp at z0 measured with the briefed
# flags alone)
OVERVIEW_PART_FLAGS = ["--drop-fraction-as-needed", "-M", "250000", "-l", OVERVIEW_LAYER]
def overview_uniform_flags(zoom):
    return [f"-Z{zoom}", f"-z{zoom}", "-r1", "--no-feature-limit", "--no-tile-size-limit", "-l", OVERVIEW_LAYER]


Z1_SEED = 20260722
UNIFORM_TARGET_MAX_BYTES = (215_000, 245_000)
RA_FLAGS = ["-Z3", "-z7", "-r1", "--no-feature-limit", "--no-tile-size-limit", "-l", OVERVIEW_LAYER]


# ---------------------------------------------------------------- extract

def _tile_to_lonlat(z, x, y, px, py, extent):
    n = 2 ** z
    lon = (x + px / extent) / n * 360.0 - 180.0
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (y + py / extent) / n))))
    return lon, lat


def _extract_chunk(args):
    """Decode a list of (z, col, tms_row) tiles; return slim records.

    A record is (inside, edge, lon, lat, props, tile) where props holds only the
    attributes the source feature has. inside means the point lies in the
    tile proper (0 <= x < extent, 0 <= y < extent); edge means it lies on
    the far edge of the tile buffer's inner boundary (x or y equal to
    extent), where tippecanoe sometimes keeps it in the lower-numbered
    tile only.
    """
    import mapbox_vector_tile

    src, layer, tiles = args
    db = sqlite3.connect(f"file:{src}?mode=ro", uri=True)
    out = []
    for z, col, row in tiles:
        data = db.execute(
            "select tile_data from tiles where zoom_level=? and tile_column=? and tile_row=?",
            (z, col, row),
        ).fetchone()[0]
        try:
            data = gzip.decompress(data)
        except OSError:
            pass
        decoded = mapbox_vector_tile.decode(data, default_options={"y_coord_down": True})
        lyr = decoded.get(layer)
        if not lyr:
            continue
        extent = lyr["extent"]
        y = (1 << z) - 1 - row
        for f in lyr["features"]:
            p = f["properties"]
            px, py = f["geometry"]["coordinates"]
            inside = 0 <= px < extent and 0 <= py < extent
            edge = (not inside) and 0 <= px <= extent and 0 <= py <= extent
            if not (inside or edge):
                continue
            lon, lat = _tile_to_lonlat(z, col, y, px, py, extent)
            props = {k: p[k] for k in ("religion", "denomination", "name", "osm_id", "osm_type", "country_code") if k in p}
            if "country" in p:
                props["_country"] = p["country"]
            name_en = p.get("name:en")
            if name_en is None:
                tags = p.get("tags_raw")
                if tags and "name:en" in tags:
                    try:
                        name_en = json.loads(tags).get("name:en")
                    except ValueError:
                        name_en = None
            if name_en:
                props["name:en"] = name_en
            out.append((inside, edge, lon, lat, props, (z, col, row)))
    return out


def _tile_list(src, zoom):
    db = sqlite3.connect(f"file:{src}?mode=ro", uri=True)
    return db.execute(
        "select zoom_level, tile_column, tile_row from tiles where zoom_level=? order by tile_column, tile_row",
        (zoom,),
    ).fetchall()


def _point_key(lon, lat, props):
    # lon 180 and lon -180 are the same meridian: the east edge of the last tile column and the west edge of the
    # first are one point (at z6 a far-edge point of a Fijian church was otherwise counted twice)
    lon = round(lon, 7)
    if lon >= 180.0:
        lon -= 360.0
    return (lon, round(lat, 7), props.get("osm_type"), props.get("osm_id"), props.get("name"),
            props.get("religion"), props.get("denomination"), props.get("country_code"), props.get("_country"))


def _feature_line(lon, lat, props, attrs):
    p = {k: props[k] for k in attrs if k in props}
    return json.dumps(
        {"type": "Feature", "properties": p,
         "geometry": {"type": "Point", "coordinates": [round(lon, 6), round(lat, 6)]}},
        ensure_ascii=False, separators=(",", ":"),
    ) + "\n"


def _sort_key(rec):
    return tuple("" if v is None else str(v) for v in _point_key(*rec[:3]))


def _attr_key(props):
    return (props.get("osm_type"), props.get("osm_id"), props.get("name"), props.get("religion"),
            props.get("denomination"), props.get("country_code"), props.get("_country"))


def _collect(src, layer, zoom, jobs):
    """Decode every feature at one zoom and return (kept, report).

    Every point lies in exactly one tile proper, so counting the features
    inside the tiles proper removes the tile-buffer duplicates. Points on a
    tile's far edge (x or y equal to the extent) are kept from the buffer
    only when the tile proper of the neighbour does not hold them: for each
    point key the number added is the largest number of occurrences in any
    single tile's far edge minus the number already held in tile propers, so
    coincident points on an edge are not collapsed. kept is sorted, so the
    order does not depend on how the pool schedules chunks."""
    t0 = time.time()
    tiles = _tile_list(src, zoom)
    print(f"extract: {len(tiles)} tiles at z{zoom} from {src}", flush=True)
    chunks = [(src, layer, tiles[i:i + 100]) for i in range(0, len(tiles), 100)]
    core = []
    edge_first = {}
    edge_in_tile = collections.Counter()
    raw_rows = 0
    with mp.Pool(jobs) as pool:
        for n, rows in enumerate(pool.imap_unordered(_extract_chunk, chunks), 1):
            for inside, is_edge, lon, lat, props, tile in rows:
                raw_rows += 1
                if inside:
                    core.append((lon, lat, props))
                else:
                    k = _point_key(lon, lat, props)
                    edge_first.setdefault(k, (lon, lat, props))
                    edge_in_tile[(k, tile)] += 1
            if n % 100 == 0:
                print(f"  chunks {n}/{len(chunks)} core {len(core)}", flush=True)
    core_count = collections.Counter(_point_key(*r) for r in core)
    edge_max = {}
    for (k, _tile), c in edge_in_tile.items():
        edge_max[k] = max(edge_max.get(k, 0), c)
    edge_added = []
    for k, m in edge_max.items():
        for _ in range(max(0, m - core_count.get(k, 0))):
            edge_added.append(edge_first[k])
    kept = core + edge_added
    kept.sort(key=_sort_key)
    report = {
        "zoom": zoom, "tiles": len(tiles), "rows_decoded_in_tile_or_edge": raw_rows,
        "features_in_tile_proper": len(core), "edge_points_added": len(edge_added),
        "unique": len(kept),
        "edge_points_added_detail": [
            {"lon": round(lon, 6), "lat": round(lat, 6), "osm_type": p.get("osm_type"), "osm_id": p.get("osm_id"),
             "name": p.get("name"), "religion": p.get("religion")}
            for lon, lat, p in edge_added[:50]],
        "seconds": round(time.time() - t0, 1),
    }
    return kept, report


def _source_info(src):
    """Byte hash, size and the metadata table of the source archive (read-only)."""
    h = hashlib.sha256()
    with open(src, "rb") as fh:
        for blk in iter(lambda: fh.read(1 << 24), b""):
            h.update(blk)
    db = sqlite3.connect(f"file:{src}?mode=ro", uri=True)
    meta = dict(db.execute("select name, value from metadata").fetchall())
    return {"path": src, "bytes": Path(src).stat().st_size, "sha256": h.hexdigest(), "metadata": meta}


def _audit(kept, kept_report, src, layer, a):
    """Compare the feature multiset at the extraction zoom with an independent zoom.

    The two zooms quantise coordinates differently and place tile edges at
    different points, so agreement of the attribute multisets (osm key, name,
    religion, denomination, country; with multiplicities) and of the
    coordinates of every attribute key that occurs once shows that the
    extraction holds the same features, not only the same number."""
    other, other_report = _collect(src, layer, a.audit_zoom, a.jobs)
    ca = collections.Counter(_attr_key(p) for _, _, p in kept)
    cb = collections.Counter(_attr_key(p) for _, _, p in other)
    only_a = ca - cb
    only_b = cb - ca
    first = {}
    for lon, lat, p in kept:
        first.setdefault(_attr_key(p), (lon, lat))
    second = {}
    for lon, lat, p in other:
        second.setdefault(_attr_key(p), (lon, lat))
    tol = 0.003
    far = [k for k, c in ca.items() if c == 1 and cb.get(k) == 1
           and (abs(first[k][0] - second[k][0]) > tol or abs(first[k][1] - second[k][1]) > tol)]
    return {
        "audit_zoom": a.audit_zoom, "audit_zoom_unique": len(other),
        "audit_zoom_report": {k: v for k, v in other_report.items() if k != "edge_points_added_detail"},
        "attribute_multiset_equal": not only_a and not only_b,
        "occurrences_only_at_extraction_zoom": sum(only_a.values()),
        "occurrences_only_at_audit_zoom": sum(only_b.values()),
        "examples_only_at_extraction_zoom": [list(map(str, k)) for k in list(only_a)[:10]],
        "examples_only_at_audit_zoom": [list(map(str, k)) for k in list(only_b)[:10]],
        "single_occurrence_keys_compared": sum(1 for k, c in ca.items() if c == 1 and cb.get(k) == 1),
        "single_occurrence_keys_more_than_0_003_degrees_apart": len(far),
        "distinct_attribute_keys": len(ca),
        "keys_occurring_more_than_once": sum(1 for c in ca.values() if c > 1),
    }


def cmd_extract(a):
    """See _collect for the deduplication rule. The source has no usable unique
    key: 701,349 features carry no osm_id, osm_type or id, and five osm keys
    occur twice at identical coordinates in the source itself. The count and
    the cross-zoom audit are the tests; either failing stops the build."""
    work = Path(a.work)
    work.mkdir(parents=True, exist_ok=True)
    src = str(Path(a.source).resolve())
    t0 = time.time()
    kept, rep = _collect(src, a.source_layer, a.zoom, a.jobs)
    total = len(kept)
    osm_keys = collections.Counter((p["osm_type"], p["osm_id"]) for _, _, p in kept if "osm_id" in p)
    keyless = sum(1 for _, _, p in kept if "osm_id" not in p)
    dup_osm_keys = sum(1 for v in osm_keys.values() if v > 1)
    report = {
        "source": _source_info(src), **rep,
        "expected": EXPECTED_COUNT,
        "dedup_rule": "keep a feature only from the tile whose proper area holds it; add far-edge points no tile holds "
                      "(per key, the largest single-tile far-edge multiplicity minus the tile-proper count)",
        "features_with_osm_key": sum(osm_keys.values()), "features_without_osm_key": keyless,
        "osm_keys_occurring_more_than_once": dup_osm_keys,
        "seconds": round(time.time() - t0, 1),
    }
    if a.audit_zoom is not None and a.audit_zoom >= 0:
        report["audit"] = _audit(kept, rep, src, a.source_layer, a)
    (work / "extract-report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({k: v for k, v in report.items() if k not in ("source", "edge_points_added_detail")}), flush=True)
    if total != EXPECTED_COUNT:
        print(f"extract: STOP. count {total} vs expected {EXPECTED_COUNT}. "
              "Try --zoom 6, 14 or 18 and investigate before building.", file=sys.stderr)
        sys.exit(3)
    au = report.get("audit")
    if au and not (au["attribute_multiset_equal"] and au["single_occurrence_keys_more_than_0_003_degrees_apart"] == 0):
        print("extract: STOP. the feature multiset at the extraction zoom differs from the audit zoom; "
              "see extract-report.json.", file=sys.stderr)
        sys.exit(3)

    by_religion = collections.Counter()
    by_country = collections.Counter()
    country_attr_only = collections.Counter()
    invalid_cc = collections.Counter()
    name_en_count = 0
    ra_country: dict[str, list] = collections.defaultdict(list)
    ra_keys: dict[str, collections.Counter] = collections.defaultdict(collections.Counter)
    ra_religion: dict[str, collections.Counter] = collections.defaultdict(collections.Counter)
    ra_excluded = 0
    slim_path = work / "slim.ndjson"
    sha = hashlib.sha256()
    with slim_path.open("w", encoding="utf-8") as fh:
        for lon, lat, props in kept:
            line = _feature_line(lon, lat, props, OVERVIEW_ATTRS)
            fh.write(line)
            sha.update(line.encode("utf-8"))
            by_religion[props.get("religion", "(missing)")] += 1
            name_en_count += "name:en" in props
            cc = props.get("country_code")
            alt = props.get("_country")
            if cc is not None and CC_RE.match(cc):
                eff = cc.upper()
                by_country[eff] += 1
            else:
                invalid_cc[cc if cc is not None else "(absent)"] += 1
                if alt is not None and CC_RE.match(str(alt)):
                    country_attr_only[str(alt).upper()] += 1
                    eff = str(alt).upper() if a.country_routing == "fallback" else None
                else:
                    eff = None
            if eff:
                ra_country[eff].append(_feature_line(lon, lat, props, RA_ATTRS))
                if "osm_id" in props:
                    ra_keys[eff][(props["osm_type"], props["osm_id"])] += 1
                ra_religion[eff][props.get("religion")] += 1
            else:
                ra_excluded += 1

    cdir = work / "country-ndjson"
    if cdir.exists():
        shutil.rmtree(cdir)
    cdir.mkdir()
    for cc, lines in ra_country.items():
        (cdir / f"{cc.lower()}.ndjson").write_text("".join(lines), encoding="utf-8")
    by_ra = {cc: len(v) for cc, v in sorted(ra_country.items())}

    stats = {
        "total": total, "slim_sha256": sha.hexdigest(),
        "name_en_features": name_en_count,
        "name_en_note": ("name:en found in tags_raw and kept" if name_en_count
                         else "name:en is absent from attributes and tags_raw; omitted"),
        "by_religion": dict(by_religion.most_common()),
        "by_country_code": dict(sorted(by_country.items())),
        "country_routing": a.country_routing,
        "by_country": by_ra,
        "osm_keys_by_country": {cc: len(ra_keys[cc]) for cc in sorted(by_ra)},
        "osm_key_occurrences_by_country": {cc: sum(ra_keys[cc].values()) for cc in sorted(by_ra)},
        "osm_keys_repeated_by_country": {cc: sum(1 for v in ra_keys[cc].values() if v > 1) for cc in sorted(by_ra) if any(v > 1 for v in ra_keys[cc].values())},
        "religion_by_country": {cc: {str(k): v for k, v in sorted(ra_religion[cc].items(), key=lambda kv: str(kv[0]))} for cc in sorted(by_ra)},
        "countries": len(by_ra),
        "no_valid_country_code_count": sum(invalid_cc.values()),
        "no_valid_country_code_values": dict(invalid_cc.most_common(20)),
        "no_valid_country_code_but_country_attribute": sum(country_attr_only.values()),
        "no_valid_country_code_but_country_attribute_by_country": dict(sorted(country_attr_only.items())),
        "excluded_from_every_ra_archive": ra_excluded,
    }
    stats["slim_sha256_note"] = "sha256 of slim.ndjson, the overview input; the file is sorted, so the digest is stable"
    (work / "input-stats.json").write_text(json.dumps(stats, indent=2, ensure_ascii=False) + "\n")
    print(f"extract: wrote {slim_path} ({total} features), {len(by_ra)} country files, "
          f"{ra_excluded} in no per-country archive", flush=True)


# ------------------------------------------------------------------ build

def _run(cmd, log):
    t0 = time.time()
    with open(log, "w") as lf:
        lf.write(" ".join(cmd) + "\n")
        lf.flush()
        rc = subprocess.run(cmd, stdout=lf, stderr=subprocess.STDOUT).returncode
    return rc, round(time.time() - t0, 1)


def _stratified_sample(src, dst, fraction, seed):
    """Write a seeded sample of an NDJSON feature file, keeping round(fraction * n) of each religion."""
    rows = collections.defaultdict(list)
    with open(src, encoding="utf-8") as fh:
        for i, line in enumerate(fh):
            rows[json.loads(line)["properties"].get("religion")].append(i)
    chosen = set()
    for rel in sorted(rows, key=str):
        idx = rows[rel]
        k = round(len(idx) * fraction)
        chosen.update(random.Random(f"{seed}:{rel}").sample(idx, k))
    n = 0
    with open(src, encoding="utf-8") as fh, open(dst, "w", encoding="utf-8") as out:
        for i, line in enumerate(fh):
            if i in chosen:
                out.write(line)
                n += 1
    return n


def _max_tile_bytes(path):
    from pmtiles.reader import MmapSource, Reader, all_tiles

    with open(path, "rb") as fh:
        return max((len(d) for _, d in all_tiles(MmapSource(fh))), default=0)


def cmd_build(a):
    work, out = Path(a.work), Path(a.work) / "out"
    out.mkdir(exist_ok=True)
    logs = work / "logs"
    logs.mkdir(exist_ok=True)
    tmp = work / "tmp"
    tmp.mkdir(exist_ok=True)
    version = subprocess.run(["tippecanoe", "--version"], capture_output=True, text=True)
    version = (version.stdout + version.stderr).strip()
    commands = {}

    ov = out / f"places-overview-v2-{SNAPSHOT}.pmtiles"
    parts = work / "overview-parts"
    parts.mkdir(exist_ok=True)
    slim = str(work / "slim.ndjson")
    ov_cmds = []

    def tip(name, extra, src):
        o = parts / name
        c = ["tippecanoe", *extra, "--force", "--temporary-directory", str(tmp), "-o", str(o), src]
        ov_cmds.append(" ".join(c))
        print("build overview part:", " ".join(c), flush=True)
        rc, secs = _run(c, logs / f"overview-{name}.log")
        print(f"overview part {name} rc={rc} {secs}s", flush=True)
        if rc:
            sys.exit(rc)
        return o

    z25 = tip("z2-5.pmtiles", ["-Z2", "-z5", *OVERVIEW_PART_FLAGS], slim)

    # z0 and z1: a seeded sample, stratified by religion, thinned to one global fraction so every religion keeps
    # its share; the fraction is adjusted until the largest tile is under the cap
    def uniform_part(zoom, frac):
        trace = []
        for attempt in range(8):
            sample = parts / f"z{zoom}-sample.ndjson"
            kept_n = _stratified_sample(slim, sample, frac, Z1_SEED)
            o = tip(f"z{zoom}.pmtiles", overview_uniform_flags(zoom), str(sample))
            mx = _max_tile_bytes(o)
            trace.append({"fraction": round(frac, 6), "points": kept_n, "max_tile_bytes": mx})
            print(f"z{zoom} attempt {attempt}: fraction {frac:.5f}, {kept_n} points, max tile {mx} bytes", flush=True)
            lo, hi = UNIFORM_TARGET_MAX_BYTES
            if lo <= mx <= hi:
                return o, trace
            frac *= (lo + hi) / 2 / mx
            ov_cmds.pop()
        print(f"build: z{zoom} fraction did not settle", file=sys.stderr)
        sys.exit(4)

    z0, z0_trace = uniform_part(0, 0.0050)
    z1, uniform_trace = uniform_part(1, 0.0075)
    uniform_trace = {"z0": z0_trace, "z1": uniform_trace}
    cmd = ["tile-join", "-pk", "-f", "-o", str(ov), str(z0), str(z1), str(z25)]
    ov_cmds.append(" ".join(cmd))
    print("join overview:", " ".join(cmd), flush=True)
    rc, secs = _run(cmd, logs / "overview-join.log")
    print(f"overview join rc={rc} {secs}s", flush=True)
    if rc:
        sys.exit(rc)
    commands[ov.name] = ov_cmds

    files = sorted((work / "country-ndjson").glob("*.ndjson"), key=lambda p: -p.stat().st_size)

    def one(p):
        cc = p.stem
        o = out / f"ra-dots-{cc}-{SNAPSHOT}.pmtiles"
        td = tmp / cc
        td.mkdir(exist_ok=True)
        c = ["tippecanoe", *RA_FLAGS, "--force", "--temporary-directory", str(td), "-o", str(o), str(p)]
        rc, secs = _run(c, logs / f"ra-dots-{cc}.log")
        shutil.rmtree(td, ignore_errors=True)
        return o.name, " ".join(c), rc, secs

    failed = []
    with cf.ThreadPoolExecutor(a.jobs) as ex:
        for name, c, rc, secs in ex.map(one, files):
            commands[name] = c
            if rc:
                failed.append(name)
            print(f"{name} rc={rc} {secs}s", flush=True)
    (work / "build-info.json").write_text(json.dumps(
        {"tippecanoe": version, "commands": commands, "overview_uniform_calibration": uniform_trace,
         "built_at": datetime.now(timezone.utc).isoformat()},
        indent=2) + "\n")
    if failed:
        print("build: failed:", failed, file=sys.stderr)
        sys.exit(4)


# --------------------------------------------------------------- validate

def _decode_tile(args):
    import mapbox_vector_tile

    z, x, y, data, compressed, want_keys = args
    if compressed:
        data = gzip.decompress(data)
    d = mapbox_vector_tile.decode(data, default_options={"y_coord_down": True})
    layers = list(d)
    religion, cc_counts = collections.Counter(), collections.Counter()
    attrs, core, pts_seen = set(), 0, set()
    core_keys = collections.Counter()
    for lname, lyr in d.items():
        ext = lyr["extent"]
        for f in lyr["features"]:
            g = f["geometry"]
            # a MultiPoint holds one point and its wrapped copy near the
            # antimeridian, or coincident points; count each point in its tile proper
            pts = g["coordinates"] if g["type"] == "MultiPoint" else [g["coordinates"]]
            p = f["properties"]
            attrs.update(p.keys())
            if want_keys and p.get("osm_id") is not None:
                pts_seen.add((p.get("osm_type"), p.get("osm_id")))
            for px, py in pts:
                if 0 <= px < ext and 0 <= py < ext:
                    core += 1
                    religion[p.get("religion")] += 1
                    cc_counts[p.get("country_code")] += 1
                    if want_keys and p.get("osm_id") is not None:
                        core_keys[(p.get("osm_type"), p.get("osm_id"))] += 1
    return z, layers, core, religion, cc_counts, attrs, pts_seen, core_keys


def _open_pm(path):
    from pmtiles.reader import MmapSource, Reader, all_tiles, Compression

    fh = open(path, "rb")
    src = MmapSource(fh)
    r = Reader(src)
    h = r.header()
    return fh, src, r, h, all_tiles, Compression


def _archive_scan(path, decode_zooms, want_keys=False, pool=None, sample_sizes=False):
    """Walk an archive: tile bytes per zoom, and decoded core counts at some zooms."""
    fh, src, r, h, all_tiles, Compression = _open_pm(path)
    compressed = h["tile_compression"] == Compression.GZIP
    sizes = collections.defaultdict(list)
    jobs = []
    seen = set()
    for (z, x, y), data in all_tiles(src):
        if (z, x, y) in seen:
            continue
        seen.add((z, x, y))
        sizes[z].append(len(data))
        if z in decode_zooms:
            jobs.append((z, x, y, bytes(data), compressed, want_keys))
    res = collections.defaultdict(lambda: {"core": 0, "religion": collections.Counter(),
                                           "cc": collections.Counter(), "keys": set(),
                                           "core_keys": collections.Counter()})
    attrs, layers = set(), set()
    it = pool.imap_unordered(_decode_tile, jobs, chunksize=4) if pool else map(_decode_tile, jobs)
    for z, lys, core, rel, cc, at, pts_seen, core_keys in it:
        e = res[z]
        e["core_keys"].update(core_keys)
        e["core"] += core
        e["religion"].update(rel)
        e["cc"].update(cc)
        e["keys"] |= pts_seen
        attrs |= at
        layers |= set(lys)
    meta = r.metadata()
    fh.close()
    size_tbl = {z: {"tiles": len(v), "max_bytes": max(v), "mean_bytes": round(sum(v) / len(v)),
                    "total_bytes": sum(v)} for z, v in sorted(sizes.items())}
    return {"header_min_zoom": h["min_zoom"], "header_max_zoom": h["max_zoom"], "sizes": size_tbl,
            "decoded": res, "attributes": sorted(attrs), "layers": sorted(layers), "metadata": meta}


RA_ZOOMS = (3, 4, 5, 6, 7)


def _expected_key_counters(work):
    """osm-key multiplicities per country, read back from the per-country NDJSON the archives were built from."""
    out = {}
    for p in sorted((work / "country-ndjson").glob("*.ndjson")):
        c = collections.Counter()
        with p.open(encoding="utf-8") as fh:
            for line in fh:
                pr = json.loads(line)["properties"]
                if "osm_id" in pr:
                    c[(pr["osm_type"], pr["osm_id"])] += 1
        out[p.stem.upper()] = c
    return out


def _validate_ra(args):
    path, cc, expected, expected_keys, expected_religion = args
    r = _archive_scan(path, set(RA_ZOOMS), want_keys=True)
    out = {"file": Path(path).name, "country": cc, "expected": expected, "sizes": r["sizes"],
           "attributes": r["attributes"], "layers": r["layers"], "zooms": {}, "problems": []}
    want_set = set(expected_keys)
    for z in RA_ZOOMS:
        e = r["decoded"][z]
        other = {k: v for k, v in e["cc"].items() if k is not None and str(k).upper() != cc.upper()}
        missing_keys = len(want_set - e["keys"])
        extra_keys = len(e["keys"] - want_set)
        excess_key_mult = sum(max(0, c - expected_keys.get(k, 0)) for k, c in e["core_keys"].items())
        short_key_mult = sum(max(0, c - e["core_keys"].get(k, 0)) for k, c in expected_keys.items())
        excess_rel = {str(k): v - expected_religion.get(str(k), 0) for k, v in e["religion"].items()
                      if v > expected_religion.get(str(k), 0)}
        short_rel = {k: expected_religion[k] - e["religion"].get(k, 0) for k in expected_religion
                     if e["religion"].get(k, 0) < expected_religion[k]}
        out["zooms"][str(z)] = {
            "points_in_tile_proper": e["core"], "shortfall_in_tile_proper": expected - e["core"],
            "osm_keys_in_any_tile": len(e["keys"]), "osm_keys_missing_from_every_tile": missing_keys,
            "osm_keys_not_expected": extra_keys, "osm_key_occurrences_short_in_tile_proper": short_key_mult,
            "religion_short_in_tile_proper": short_rel,
            "foreign_country": {str(k): v for k, v in other.items()},
        }
        if e["core"] > expected:
            out["problems"].append(f"z{z}: {e['core']} points in tile proper, more than {expected}")
        if missing_keys or extra_keys:
            out["problems"].append(f"z{z}: osm key sets differ (missing {missing_keys}, unexpected {extra_keys})")
        if excess_key_mult or excess_rel:
            out["problems"].append(f"z{z}: more occurrences than expected (osm keys {excess_key_mult}, religion {excess_rel})")
        if other:
            out["problems"].append(f"z{z}: foreign country codes {other}")
        if z == RA_ZOOMS[-1]:
            # z7 is the archive's maximum zoom: every point is held by the tile whose proper area contains it,
            # so counts, osm-key multiplicities and religion composition must all be exact
            if e["core"] != expected:
                out["problems"].append(f"z7: {e['core']} points in tile proper, expected {expected}")
            if short_key_mult:
                out["problems"].append(f"z7: {short_key_mult} osm key occurrences short in tile proper")
            if short_rel:
                out["problems"].append(f"z7: religion composition short {short_rel}")
    # below z7 a point rounded onto a tile's far edge can sit only in the neighbour's buffer; the shortfall in
    # tile proper areas is reported per zoom, and osm-keyed points are checked present in some tile
    out["shortfall_in_tile_proper_by_zoom"] = {str(z): expected - out["zooms"][str(z)]["points_in_tile_proper"]
                                               for z in RA_ZOOMS}
    if r["layers"] != [OVERVIEW_LAYER]:
        out["problems"].append(f"layers {r['layers']}")
    if not set(r["attributes"]) <= set(RA_ATTRS) or "religion" not in r["attributes"]:
        out["problems"].append(f"attributes {r['attributes']}")
    if (r["header_min_zoom"], r["header_max_zoom"]) != (3, 7):
        out["problems"].append(f"zoom range {r['header_min_zoom']}-{r['header_max_zoom']}")
    return out


def cmd_validate(a):
    work = Path(a.work)
    out = work / "out"
    stats = json.loads((work / "input-stats.json").read_text())
    report = {"generated_at": datetime.now(timezone.utc).isoformat(), "problems": [], "criteria_not_met": []}
    problems = report["problems"]

    # per-country archives
    expected_keys = _expected_key_counters(work)
    tasks = [(str(out / f"ra-dots-{cc.lower()}-{SNAPSHOT}.pmtiles"), cc, n, expected_keys.get(cc, {}),
              stats["religion_by_country"][cc])
             for cc, n in sorted(stats["by_country"].items(), key=lambda kv: -kv[1])]
    missing = [t[0] for t in tasks if not Path(t[0]).exists()]
    if missing:
        problems.append(f"missing archives: {missing}")
    tasks = [t for t in tasks if Path(t[0]).exists()]
    ra = []
    with mp.Pool(a.jobs) as pool:
        for i, res in enumerate(pool.imap_unordered(_validate_ra, tasks), 1):
            ra.append(res)
            if res["problems"]:
                problems.extend(f"{res['file']}: {p}" for p in res["problems"])
            if i % 20 == 0:
                print(f"  ra-dots validated {i}/{len(tasks)}", flush=True)
    ra.sort(key=lambda r: -r["expected"])
    report["ra_dots"] = ra
    report["ra_dots_summary"] = {
        "archives": len(ra),
        "points_expected": sum(r["expected"] for r in ra),
        "points_found_z7": sum(r["zooms"]["7"]["points_in_tile_proper"] for r in ra),
        "points_found_by_zoom": {str(z): sum(r["zooms"][str(z)]["points_in_tile_proper"] for r in ra) for z in RA_ZOOMS},
        "shortfall_in_tile_proper_by_zoom": {str(z): sum(r["shortfall_in_tile_proper_by_zoom"][str(z)] for r in ra)
                                             for z in RA_ZOOMS},
        "archives_with_matching_counts": sum(1 for r in ra if not r["problems"]),
        "points_without_valid_country_code": stats["no_valid_country_code_count"],
        "points_in_no_ra_archive": stats["excluded_from_every_ra_archive"],
        "no_valid_country_code_values": stats["no_valid_country_code_values"],
        "no_valid_country_code_but_country_attribute": stats["no_valid_country_code_but_country_attribute"],
        "country_routing": stats["country_routing"],
    }

    # overview
    ov_path = out / f"places-overview-v2-{SNAPSHOT}.pmtiles"
    with mp.Pool(a.jobs) as pool:
        ov = _archive_scan(str(ov_path), set(range(0, 6)), pool=pool)
    total_in = stats["total"]
    in_share = {k: v / total_in for k, v in stats["by_religion"].items()}
    shares = {}
    worst = {}
    for z in range(0, 6):
        e = ov["decoded"][z]
        kept = e["core"]
        row = {"kept_features": kept, "fraction_kept": kept / total_in, "religions": {}}
        w = 0.0
        for rel, s in in_share.items():
            if s <= SHARE_FLOOR:
                continue
            ks = e["religion"].get(rel, 0) / kept if kept else float("nan")
            d = (ks - s) * 100
            row["religions"][rel] = {"input_pct": round(s * 100, 3), "kept_pct": round(ks * 100, 3),
                                     "diff_pp": round(d, 3)}
            if not math.isnan(d):
                w = max(w, abs(d))
        worst[z] = w
        row["max_abs_diff_pp"] = round(w, 3)
        row["within_tolerance"] = w <= SHARE_TOLERANCE_PP
        shares[str(z)] = row
        if w > SHARE_TOLERANCE_PP:
            report["criteria_not_met"].append(
                f"overview z{z}: religion share deviates by {w:.3f} pp from the input (tolerance {SHARE_TOLERANCE_PP} pp)")
    report["overview"] = {
        "file": ov_path.name, "bytes": ov_path.stat().st_size, "sizes": ov["sizes"],
        "attributes": ov["attributes"], "layers": ov["layers"], "shares": shares,
        "metadata_vector_layers": ov["metadata"].get("vector_layers"),
        "header_zoom": [ov["header_min_zoom"], ov["header_max_zoom"]],
    }
    if ov["layers"] != [OVERVIEW_LAYER]:
        problems.append(f"overview layers {ov['layers']}")
    allowed = set(OVERVIEW_ATTRS)
    if not set(ov["attributes"]) <= allowed or not {"religion", "osm_id", "osm_type", "country_code"} <= set(ov["attributes"]):
        problems.append(f"overview attributes {ov['attributes']}")
    z0 = ov["sizes"].get(0, {}).get("max_bytes")
    report["overview"]["z0_tile_bytes"] = z0
    if z0 is None or z0 >= Z0_LIMIT_BYTES:
        problems.append(f"overview z0 tile {z0} bytes (limit {Z0_LIMIT_BYTES})")
    fh, src, rd, h, _all, Compression = _open_pm(str(ov_path))
    z0data = rd.get(0, 0, 0)
    try:
        d = gzip.decompress(z0data) if h["tile_compression"] == Compression.GZIP else z0data
        report["overview"]["z0_decodes_cleanly"] = len(d) > 0
    except Exception as exc:  # noqa: BLE001
        report["overview"]["z0_decodes_cleanly"] = False
        problems.append(f"z0 decode failed: {exc}")
    fh.close()

    # comparison with the live tiles (read-only rollback copy)
    if a.live_overview:
        report["live_comparison"] = _compare_live(str(ov_path), a.live_overview)

    # max tile bytes for ra-dots by zoom
    mx = collections.defaultdict(int)
    for r in ra:
        for z, s in r["sizes"].items():
            mx[z] = max(mx[z], s["max_bytes"])
    report["ra_dots_max_tile_bytes_by_zoom"] = dict(mx)
    big = {}
    for z in RA_ZOOMS:
        over = sorted(((r["country"], r["sizes"][z]["max_bytes"]) for r in ra if r["sizes"][z]["max_bytes"] > 1_000_000),
                      key=lambda t: -t[1])
        if over:
            big[z] = over
    report["ra_dots_tiles_over_1mb"] = {str(z): [{"country": c, "max_bytes": n} for c, n in v] for z, v in big.items()}
    report["warnings"] = [
        f"ra-dots z{z}: {len(v)} archives have a tile over 1 MB ({', '.join(c for c, _ in v)}); largest {v[0][1]:,} bytes. "
        "The client must not request these zooms without a minimum zoom (plan item R2); phone performance is unmeasured."
        for z, v in big.items()]
    report["status"] = ("failed" if problems or report["criteria_not_met"]
                        else "passed_with_warnings" if report["warnings"] else "passed")
    (work / "validation-report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    print(f"validate: status {report['status']}; {len(problems)} problems; "
          f"{len(report['criteria_not_met'])} criteria not met", flush=True)
    for p in problems[:50]:
        print("  -", p)
    for c in report["criteria_not_met"]:
        print("  - criterion not met:", c)
    if problems:
        sys.exit(5)
    if report["criteria_not_met"]:
        sys.exit(6)


def _compare_live(new_path, live_path, seed=20260722):
    fh1, s1, r1, h1, _, _ = _open_pm(new_path)
    fh2, s2, r2, h2, all2, _ = _open_pm(live_path)
    rng = random.Random(seed)
    live_tiles = collections.defaultdict(list)
    for (z, x, y), data in all2(s2):
        live_tiles[z].append((x, y, len(data)))
    out = {"live_file": Path(live_path).name, "live_bytes": Path(live_path).stat().st_size,
           "new_bytes": Path(new_path).stat().st_size, "seed": seed, "zooms": {}}
    sample_n = {0: 1, 1: 4, 2: 16, 3: 64, 4: 60, 5: 60}
    for z in range(0, 6):
        tiles = live_tiles[z]
        pick = tiles if len(tiles) <= sample_n[z] else rng.sample(tiles, sample_n[z])
        live_sum = new_sum = n_new = 0
        for x, y, ln in pick:
            nb = r1.get(z, x, y)
            live_sum += ln
            if nb:
                new_sum += len(nb)
                n_new += 1
        out["zooms"][str(z)] = {
            "sampled": len(pick), "present_in_new": n_new, "live_bytes": live_sum, "new_bytes": new_sum,
            "reduction": round(1 - new_sum / live_sum, 4) if live_sum else None,
            "live_max_tile_bytes": max(t[2] for t in tiles) if tiles else None,
        }
    fh1.close()
    fh2.close()
    return out


# --------------------------------------------------------------- manifest

def _sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for blk in iter(lambda: fh.read(1 << 22), b""):
            h.update(blk)
    return h.hexdigest()


def _cmd_text(c):
    return "; ".join(c) if isinstance(c, list) else c


def cmd_manifest(a):
    import jsonschema

    work, out = Path(a.work), Path(a.work) / "out"
    stats = json.loads((work / "input-stats.json").read_text())
    ex = json.loads((work / "extract-report.json").read_text())
    info = json.loads((work / "build-info.json").read_text())
    rep = json.loads((work / "validation-report.json").read_text())
    if rep["status"] == "failed":
        print("manifest: the validation report says failed; no manifest is written", file=sys.stderr)
        sys.exit(6)
    ra_counts = {r["file"]: r["expected"] for r in rep["ra_dots"]}
    files = []
    for p in sorted(out.glob("*.pmtiles")):
        is_ov = p.name.startswith("places-overview")
        feats = None if is_ov else ra_counts.get(p.name)
        note = (f"public overview tier, z0-5, layer {OVERVIEW_LAYER}, fraction-preserving sample "
                f"(z2-5 tippecanoe {' '.join(OVERVIEW_PART_FLAGS)}; z0 and z1 religion-stratified uniform samples); "
                f"commands: {_cmd_text(info['commands'][p.name])}"
                if is_ov else
                f"RA dots for one country, z3-7, every point kept; command: {_cmd_text(info['commands'][p.name])}")
        files.append({
            "uri": f"green:{p.resolve()}", "storage_provider": "other",
            "format": "pmtiles", "bytes": p.stat().st_size, "sha256": _sha256(p),
            "feature_count": feats if feats is not None else stats["total"] if is_ov else None,
            "privacy": "public", "licence_status": "needs_review",
            "notes": note + (" feature_count is the input count; the tiles hold a sample." if is_ov else "")
                     + " Location is a machine-local build output on green, a cache and not a durable store;"
                     " the durable copy is the R2 object, once uploaded and recorded.",
        })
    params = {
        "extract_zoom": ex["zoom"], "audit_zoom": a.audit_zoom, "country_routing": stats["country_routing"],
        "overview_flags": OVERVIEW_FLAGS, "overview_part_flags": OVERVIEW_PART_FLAGS,
        "overview_uniform_flags": "tippecanoe -Z<z> -z<z> -r1 --no-feature-limit --no-tile-size-limit, z in (0, 1)", "overview_uniform_seed": Z1_SEED,
        "overview_uniform_calibration": info.get("overview_uniform_calibration"), "ra_dots_flags": RA_FLAGS,
        "overview_attributes": [k for k in OVERVIEW_ATTRS if k != "name:en" or stats["name_en_features"]],
        "ra_dots_attributes": RA_ATTRS, "name_en": stats["name_en_note"],
        "source_sha256": ex["source"]["sha256"], "source_bytes": ex["source"]["bytes"],
    }
    # identity: the output digests and the build parameters, so a different overview, a different routing
    # mode or different flags cannot share a version
    ident = hashlib.sha256(json.dumps(
        {"files": sorted((f["uri"].rsplit("/", 1)[-1], f["sha256"]) for f in files),
         "params": {k: v for k, v in params.items() if k != "overview_uniform_calibration"}},
        sort_keys=True).encode()).hexdigest()
    version_id = f"tiles-v2-{SNAPSHOT}:{ident[:16]}"
    manifest_id = f"manifest:tiles-v2-{SNAPSHOT}-{ident[:12]}"
    au = ex.get("audit", {})
    manifest = {
        "$schema": "../../../schemas/data-manifest.schema.json",
        "schema_version": "data-manifest.v2",
        "manifest_id": manifest_id,
        "dataset_id": f"tiles-v2-{SNAPSHOT}",
        "dataset_version_id": version_id,
        **({"supersedes_manifest_id": a.supersedes} if a.supersedes else {}),
        "dataset_family": "places-tiles",
        "dataset_role": "public_product",
        "scope": {"level": "global", "snapshot_date": "2026-07-22", "pipeline_stage": "staged"},
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "created_by": a.created_by,
        "pipeline": {
            "script": "tools/tiles-r2/build_tiles_v2.py",
            "git_commit": a.git_commit or None,
            "command": "uv run tools/tiles-r2/build_tiles_v2.py all --work <dir> --source <places.mbtiles>",
            "parameters": params,
            "software_versions": {"tippecanoe": info["tippecanoe"], "python": sys.version.split()[0]},
        },
        "source": {
            "provider": "places.mbtiles, the live places tileset built 2026-07-22 (all_places.ndjson, no longer retained)",
            "licence": None,
            "local_cache_hint": f"green:{ex['source']['path']}",
            "citation": (f"sha256 {ex['source']['sha256']}, {ex['source']['bytes']} bytes; "
                         f"mbtiles metadata: {json.dumps(ex['source']['metadata'], ensure_ascii=False)[:1500]}; "
                         f"tippecanoe tilestats count {EXPECTED_COUNT} features, layer places; "
                         f"decoded at z{ex['zoom']}: {ex['features_in_tile_proper']} features in tile proper plus "
                         f"{ex['edge_points_added']} far-edge points no tile held = {ex['unique']}; "
                         f"{ex['features_without_osm_key']} features carry no osm_id, osm_type or id; "
                         f"{ex['osm_keys_occurring_more_than_once']} osm keys occur twice at identical coordinates in the source. "
                         f"Original dataset links and retrieval date are not recorded in the source archive."),
            "licence_todo": "licence and attribution of the 701,349 places without an OSM key are not established; "
                            "publication gate (serving the archives) stays open until documented",
        },
        "durable_files": files,
        "validation": {
            "status": rep["status"],
            "commands": ["uv run tools/tiles-r2/build_tiles_v2.py validate --work <dir> --live-overview <places-overview.pmtiles>"],
            "warnings": rep.get("warnings", []) + [
                "licence_status needs_review: licence of the places without an OSM key is not established",
                f"{stats['no_valid_country_code_count']} places carry no country_code (country routing: "
                f"{stats['country_routing']}); in fallback routing they are in the archive of their `country` attribute "
                "but still carry no osm_id, osm_type or country_code, so they cannot be revised by OSM key"],
            "notes": f"full report in tools/tiles-r2/manifests/validation-report-tiles-v2-{SNAPSHOT}-{ident[:12]}.md",
            "input_features": stats["total"],
            "ra_dots_points": rep["ra_dots_summary"]["points_expected"],
            "extraction_audit": au,
            "criteria_not_met": rep.get("criteria_not_met", []),
        },
        "downstream_status": "staged",
    }
    schema_path = Path(a.schema) if a.schema else Path(__file__).resolve().parents[2] / "schemas/data-manifest.schema.json"
    schema = json.loads(schema_path.read_text())
    jsonschema.validate(manifest, schema)
    dest = Path(a.manifest_dir)
    dest.mkdir(parents=True, exist_ok=True)
    tag = f"{SNAPSHOT}-{ident[:12]}"
    (dest / f"tiles-v2-{tag}.manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    (dest / f"validation-report-tiles-v2-{tag}.json").write_text(json.dumps(rep, indent=2, ensure_ascii=False) + "\n")
    (dest / f"input-stats-tiles-v2-{tag}.json").write_text(
        json.dumps({**stats, "extract": ex}, indent=2, ensure_ascii=False) + "\n")
    print(f"manifest: wrote {dest} (version {version_id})", flush=True)


def cmd_record_uploads(a):
    """Add the verified R2 objects to a manifest: --uploads is a JSON list of {key, bytes, sha256, ...}."""
    import jsonschema

    path = Path(a.manifest)
    manifest = json.loads(path.read_text())
    uploads = json.loads(Path(a.uploads).read_text())
    by_name = {f["uri"].rsplit("/", 1)[-1]: f for f in manifest["durable_files"] if f["uri"].startswith("green:")}
    added = []
    for u in uploads:
        src = by_name[u["key"]]
        if u["bytes"] != src["bytes"] or u["sha256"] != src["sha256"]:
            raise SystemExit(f"upload record for {u['key']} does not match the built file")
        added.append({
            "uri": f"r2://pow-tiles/{u['key']}", "storage_provider": "other", "format": "pmtiles",
            "bytes": u["bytes"], "sha256": u["sha256"], "feature_count": src.get("feature_count"),
            "privacy": "public", "licence_status": "needs_review",
            "notes": f"object in the Cloudflare R2 bucket pow-tiles under its file name; put on {u['uploaded_at']}; "
                     f"{u['verification']}. Not served: the Worker does not route versioned names until it is deployed.",
        })
    manifest["durable_files"] = [f for f in manifest["durable_files"] if not f["uri"].startswith("r2://")] + added
    schema_path = Path(a.schema) if a.schema else Path(__file__).resolve().parents[2] / "schemas/data-manifest.schema.json"
    jsonschema.validate(manifest, json.loads(schema_path.read_text()))
    path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    print(f"record-uploads: {len(added)} objects recorded in {path}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("stage", choices=["extract", "build", "validate", "manifest", "all", "record_uploads"])
    ap.add_argument("--work", help="build directory (created if absent)")
    ap.add_argument("--manifest", help="record_uploads: manifest to update")
    ap.add_argument("--uploads", help="record_uploads: JSON list of verified uploads")
    ap.add_argument("--source", help="places.mbtiles (opened read-only)")
    ap.add_argument("--source-layer", default="places")
    ap.add_argument("--zoom", type=int, default=10)
    ap.add_argument("--jobs", type=int, default=max(1, (os.cpu_count() or 4) - 2))
    ap.add_argument("--live-overview", help="live places-overview.pmtiles for the size comparison")
    ap.add_argument("--manifest-dir", default=str(Path(__file__).resolve().parent / "manifests"))
    ap.add_argument("--country-routing", choices=["fallback", "strict"], default="fallback",
                    help="fallback (default): a place without a valid country_code is routed by its `country` "
                         "attribute, so every place is in a per-country archive (2026-09-04 ruling); "
                         "strict: country_code only, which leaves 701,349 places out")
    ap.add_argument("--audit-zoom", type=int, default=6,
                    help="independent source zoom for the feature-multiset audit (-1 skips it)")
    ap.add_argument("--supersedes", help="manifest_id of the manifest this build supersedes")
    ap.add_argument("--schema", help="path to schemas/data-manifest.schema.json (default: this repository's)")
    ap.add_argument("--git-commit")
    ap.add_argument("--created-by", default="claude-sonnet-5-5 (workflow agent)")
    a = ap.parse_args()
    stages = ["extract", "build", "validate", "manifest"] if a.stage == "all" else [a.stage]
    for s in stages:
        if s != "record_uploads" and not a.work:
            ap.error("--work is required")
        if s == "extract" and not a.source:
            ap.error("extract needs --source")
        globals()[f"cmd_{s}"](a)


if __name__ == "__main__":
    main()
