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
RA_FLAGS = ["-Z3", "-z7", "-r1", "--no-feature-limit", "--no-tile-size-limit", "-l", OVERVIEW_LAYER]


# ---------------------------------------------------------------- extract

def _tile_to_lonlat(z, x, y, px, py, extent):
    n = 2 ** z
    lon = (x + px / extent) / n * 360.0 - 180.0
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (y + py / extent) / n))))
    return lon, lat


def _extract_chunk(args):
    """Decode a list of (z, col, tms_row) tiles; return slim records.

    A record is (inside, edge, lon, lat, props) where props holds only the
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
            out.append((inside, edge, lon, lat, props))
    return out


def _tile_list(src, zoom):
    db = sqlite3.connect(f"file:{src}?mode=ro", uri=True)
    return db.execute(
        "select zoom_level, tile_column, tile_row from tiles where zoom_level=? order by tile_column, tile_row",
        (zoom,),
    ).fetchall()


def _point_key(lon, lat, props):
    return (round(lon, 7), round(lat, 7), props.get("osm_type"), props.get("osm_id"), props.get("name"),
            props.get("religion"), props.get("denomination"), props.get("country_code"), props.get("_country"))


def _feature_line(lon, lat, props, attrs):
    p = {k: props[k] for k in attrs if k in props}
    return json.dumps(
        {"type": "Feature", "properties": p,
         "geometry": {"type": "Point", "coordinates": [round(lon, 6), round(lat, 6)]}},
        ensure_ascii=False, separators=(",", ":"),
    ) + "\n"


def cmd_extract(a):
    """Every point lies in exactly one tile proper, so counting the features
    inside the tiles proper removes the tile-buffer duplicates. The source has
    no usable unique key: 701,348 features carry no osm_id, osm_type or id, and
    five osm keys occur twice at identical coordinates in the source itself.
    Points on a tile's far edge are kept from the buffer when no tile claims
    them; the count check below is the test."""
    work = Path(a.work)
    work.mkdir(parents=True, exist_ok=True)
    src = str(Path(a.source).resolve())
    t0 = time.time()
    tiles = _tile_list(src, a.zoom)
    print(f"extract: {len(tiles)} tiles at z{a.zoom} from {src}", flush=True)
    chunks = [(src, a.source_layer, tiles[i:i + 100]) for i in range(0, len(tiles), 100)]

    core = []
    edge = {}
    raw_rows = 0
    with mp.Pool(a.jobs) as pool:
        for n, rows in enumerate(pool.imap_unordered(_extract_chunk, chunks), 1):
            for inside, is_edge, lon, lat, props in rows:
                raw_rows += 1
                if inside:
                    core.append((lon, lat, props))
                else:
                    edge.setdefault(_point_key(lon, lat, props), (lon, lat, props))
            if n % 100 == 0:
                print(f"  chunks {n}/{len(chunks)} core {len(core)}", flush=True)
    core_keys = {_point_key(*r) for r in core}
    edge_added = [r for k, r in edge.items() if k not in core_keys]
    kept = core + edge_added
    total = len(kept)

    osm_keys = collections.Counter((p["osm_type"], p["osm_id"]) for _, _, p in kept if "osm_id" in p)
    keyless = sum(1 for _, _, p in kept if "osm_id" not in p)
    dup_osm_keys = sum(1 for v in osm_keys.values() if v > 1)
    report = {
        "source": src, "zoom": a.zoom, "tiles": len(tiles),
        "rows_decoded_in_tile_or_edge": raw_rows,
        "features_in_tile_proper": len(core), "edge_points_added": len(edge_added),
        "unique": total, "expected": EXPECTED_COUNT,
        "dedup_rule": "keep a feature only from the tile whose proper area holds it; add far-edge points no tile holds",
        "features_with_osm_key": sum(osm_keys.values()), "features_without_osm_key": keyless,
        "osm_keys_occurring_more_than_once": dup_osm_keys,
        "seconds": round(time.time() - t0, 1),
    }
    (work / "extract-report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report), flush=True)
    if total != EXPECTED_COUNT:
        print(f"extract: STOP. count {total} vs expected {EXPECTED_COUNT}. "
              "Try --zoom 6, 14 or 18 and investigate before building.", file=sys.stderr)
        sys.exit(3)

    by_religion = collections.Counter()
    by_country = collections.Counter()
    country_attr_only = collections.Counter()
    invalid_cc = collections.Counter()
    name_en_count = 0
    ra_country: dict[str, list] = collections.defaultdict(list)
    ra_keys: dict[str, set] = collections.defaultdict(set)
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
                    eff = str(alt).upper() if a.country_fallback else None
                else:
                    eff = None
            if eff:
                ra_country[eff].append(_feature_line(lon, lat, props, RA_ATTRS))
                if "osm_id" in props:
                    ra_keys[eff].add((props["osm_type"], props["osm_id"]))
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
        "country_fallback": bool(a.country_fallback),
        "by_country": by_ra,
        "osm_keys_by_country": {cc: len(ra_keys[cc]) for cc in sorted(by_ra)},
        "countries": len(by_ra),
        "no_valid_country_code_count": sum(invalid_cc.values()),
        "no_valid_country_code_values": dict(invalid_cc.most_common(20)),
        "no_valid_country_code_but_country_attribute": sum(country_attr_only.values()),
        "no_valid_country_code_but_country_attribute_by_country": dict(sorted(country_attr_only.items())),
        "excluded_from_every_ra_archive": ra_excluded,
    }
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
    cmd = ["tippecanoe", *OVERVIEW_FLAGS, "-P", "--force", "--temporary-directory", str(tmp),
           "-o", str(ov), str(work / "slim.ndjson")]
    commands[ov.name] = " ".join(cmd)
    print("build overview:", " ".join(cmd), flush=True)
    rc, secs = _run(cmd, logs / "overview.log")
    print(f"overview rc={rc} {secs}s", flush=True)
    if rc:
        sys.exit(rc)

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
        {"tippecanoe": version, "commands": commands, "built_at": datetime.now(timezone.utc).isoformat()},
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
    return z, layers, core, religion, cc_counts, attrs, pts_seen


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
                                           "cc": collections.Counter(), "keys": set()})
    attrs, layers = set(), set()
    it = pool.imap_unordered(_decode_tile, jobs, chunksize=4) if pool else map(_decode_tile, jobs)
    for z, lys, core, rel, cc, at, pts_seen in it:
        e = res[z]
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


def _validate_ra(args):
    path, cc, expected, expected_keys = args
    r = _archive_scan(path, {3, 7}, want_keys=True)
    out = {"file": Path(path).name, "country": cc, "expected": expected, "sizes": r["sizes"],
           "attributes": r["attributes"], "layers": r["layers"], "zooms": {}, "problems": []}
    for z in (3, 7):
        e = r["decoded"][z]
        other = {k: v for k, v in e["cc"].items() if k is not None and str(k).upper() != cc.upper()}
        out["zooms"][str(z)] = {"points_in_tile_proper": e["core"], "osm_keys_in_any_tile": len(e["keys"]),
                                "foreign_country": other}
        # z7 is the archive's maximum zoom: every point is held by the tile whose proper area contains it.
        # z3 holds coarser coordinates: a point rounded onto a tile's far edge can sit only in a neighbour's
        # buffer, so there the test is that every osm key is present in some tile
        if z == 7 and e["core"] != expected:
            out["problems"].append(f"z7: {e['core']} points in tile proper, expected {expected}")
        if z == 3 and e["core"] > expected:
            out["problems"].append(f"z3: {e['core']} points in tile proper, more than {expected}")
        if len(e["keys"]) != expected_keys:
            out["problems"].append(f"z{z}: {len(e['keys'])} distinct osm keys, expected {expected_keys}")
        if other:
            out["problems"].append(f"z{z}: foreign country codes {other}")
    out["z3_shortfall_in_tile_proper"] = expected - out["zooms"]["3"]["points_in_tile_proper"]
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
    tasks = [(str(out / f"ra-dots-{cc.lower()}-{SNAPSHOT}.pmtiles"), cc, n, stats["osm_keys_by_country"][cc])
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
        "points_found_z3": sum(r["zooms"]["3"]["points_in_tile_proper"] for r in ra),
        "archives_with_matching_counts": sum(1 for r in ra if not r["problems"]),
        "points_without_valid_country_code": stats["no_valid_country_code_count"],
        "points_in_no_ra_archive": stats["excluded_from_every_ra_archive"],
        "no_valid_country_code_values": stats["no_valid_country_code_values"],
        "no_valid_country_code_but_country_attribute": stats["no_valid_country_code_but_country_attribute"],
        "country_fallback": stats["country_fallback"],
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
    report["status"] = ("failed" if problems else "passed_with_warnings" if report["criteria_not_met"] else "passed")
    (work / "validation-report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    print(f"validate: status {report['status']}; {len(problems)} problems", flush=True)
    for p in problems[:50]:
        print("  -", p)
    if problems:
        sys.exit(5)


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


def cmd_manifest(a):
    import jsonschema

    work, out = Path(a.work), Path(a.work) / "out"
    stats = json.loads((work / "input-stats.json").read_text())
    ex = json.loads((work / "extract-report.json").read_text())
    info = json.loads((work / "build-info.json").read_text())
    rep = json.loads((work / "validation-report.json").read_text())
    ra_counts = {r["file"]: r["expected"] for r in rep["ra_dots"]}
    files = []
    for p in sorted(out.glob("*.pmtiles")):
        is_ov = p.name.startswith("places-overview")
        feats = None if is_ov else ra_counts.get(p.name)
        note = (f"public overview tier, z0-5, layer {OVERVIEW_LAYER}, fraction-preserving sample "
                f"(tippecanoe {' '.join(OVERVIEW_FLAGS)}); command: {info['commands'][p.name]}"
                if is_ov else
                f"RA dots for one country, z3-7, every point kept; command: {info['commands'][p.name]}")
        files.append({
            "uri": f"green:~/tiles-build-2026-10-07/out/{p.name}", "storage_provider": "other",
            "format": "pmtiles", "bytes": p.stat().st_size, "sha256": _sha256(p),
            "feature_count": feats if feats is not None else stats["total"] if is_ov else None,
            "privacy": "public", "licence_status": "needs_review",
            "notes": note + (" feature_count is the input count; the tiles hold a sample." if is_ov else ""),
        })
    version_id = f"tiles-v2-{SNAPSHOT}:{stats['slim_sha256'][:16]}"
    manifest = {
        "$schema": "../../../schemas/data-manifest.schema.json",
        "schema_version": "data-manifest.v2",
        "manifest_id": f"manifest:tiles-v2-{SNAPSHOT}",
        "dataset_id": f"tiles-v2-{SNAPSHOT}",
        "dataset_version_id": version_id,
        "dataset_family": "places-tiles",
        "dataset_role": "public_product",
        "scope": {"level": "global", "snapshot_date": "2026-07-22", "pipeline_stage": "staged"},
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "created_by": a.created_by,
        "pipeline": {
            "script": "tools/tiles-r2/build_tiles_v2.py",
            "git_commit": a.git_commit or None,
            "command": "uv run tools/tiles-r2/build_tiles_v2.py all --work <dir> --source <places.mbtiles>",
            "parameters": {
                "extract_zoom": ex["zoom"], "overview_flags": OVERVIEW_FLAGS, "ra_dots_flags": RA_FLAGS,
                "overview_attributes": [k for k in OVERVIEW_ATTRS if k != "name:en" or stats["name_en_features"]],
                "ra_dots_attributes": RA_ATTRS, "name_en": stats["name_en_note"],
            },
            "software_versions": {"tippecanoe": info["tippecanoe"], "python": sys.version.split()[0]},
        },
        "source": {
            "provider": "places.mbtiles, the live places tileset built 2026-07-22 (all_places.ndjson, no longer retained)",
            "licence": None,
            "local_cache_hint": "green:~/tiles-archive-2026-07/tiles-migration/places.mbtiles",
            "citation": (f"tippecanoe tilestats count {EXPECTED_COUNT} features, layer places; "
                      f"generator_options: tippecanoe -Z0 -z18 --drop-densest-as-needed "
                      f"--extend-zooms-if-still-dropping --no-feature-limit --no-tile-size-limit -r1 -l places; "
                      f"decoded at z{ex['zoom']}: {ex['features_in_tile_proper']} features in tile proper plus "
                      f"{ex['edge_points_added']} far-edge points no tile held = {ex['unique']}; "
                      f"{ex['features_without_osm_key']} features carry no osm_id, osm_type or id; "
                      f"{ex['osm_keys_occurring_more_than_once']} osm keys occur twice at identical coordinates in the source"),
        },
        "durable_files": files,
        "validation": {
            "status": rep["status"],
            "commands": ["uv run tools/tiles-r2/build_tiles_v2.py validate --work <dir> --live-overview <places-overview.pmtiles>"],
            "warnings": rep.get("criteria_not_met", []) + [f"{stats['excluded_from_every_ra_archive']} places are in no ra-dots archive ({stats['no_valid_country_code_count']} have no valid country_code; country_fallback={stats['country_fallback']})"],
            "notes": "full report in tools/tiles-r2/manifests/validation-report-tiles-v2-20260722.md",
            "input_features": stats["total"],
            "ra_dots_points": rep["ra_dots_summary"]["points_expected"],
        },
        "downstream_status": "staged",
    }
    schema_path = Path(a.schema) if a.schema else Path(__file__).resolve().parents[2] / "schemas/data-manifest.schema.json"
    schema = json.loads(schema_path.read_text())
    jsonschema.validate(manifest, schema)
    dest = Path(a.manifest_dir)
    dest.mkdir(parents=True, exist_ok=True)
    (dest / f"tiles-v2-{SNAPSHOT}.manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    (dest / f"validation-report-tiles-v2-{SNAPSHOT}.json").write_text(
        json.dumps(rep, indent=2, ensure_ascii=False) + "\n")
    (dest / f"input-stats-tiles-v2-{SNAPSHOT}.json").write_text(
        json.dumps({**stats, "extract": ex}, indent=2, ensure_ascii=False) + "\n")
    print(f"manifest: wrote {dest}", flush=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("stage", choices=["extract", "build", "validate", "manifest", "all"])
    ap.add_argument("--work", required=True, help="build directory (created if absent)")
    ap.add_argument("--source", help="places.mbtiles (opened read-only)")
    ap.add_argument("--source-layer", default="places")
    ap.add_argument("--zoom", type=int, default=10)
    ap.add_argument("--jobs", type=int, default=max(1, (os.cpu_count() or 4) - 2))
    ap.add_argument("--live-overview", help="live places-overview.pmtiles for the size comparison")
    ap.add_argument("--manifest-dir", default=str(Path(__file__).resolve().parent / "manifests"))
    ap.add_argument("--country-fallback", action="store_true",
                    help="route places without a valid country_code by their `country` attribute "
                         "(off by default: the brief routes by country_code only)")
    ap.add_argument("--schema", help="path to schemas/data-manifest.schema.json (default: this repository's)")
    ap.add_argument("--git-commit")
    ap.add_argument("--created-by", default="claude-sonnet-5-5 (workflow agent)")
    a = ap.parse_args()
    stages = ["extract", "build", "validate", "manifest"] if a.stage == "all" else [a.stage]
    for s in stages:
        if s == "extract" and not a.source:
            ap.error("extract needs --source")
        globals()[f"cmd_{s}"](a)


if __name__ == "__main__":
    main()
