#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["pmtiles", "jsonschema"]
# ///
"""Build one census boundary archive: census-<cc>-<slug>-<vintage>-<id12>.pmtiles, a PMTiles
archive with one layer, `census`, holding the polygons of a governed boundary GeoJSON and two
attributes, the level's code property and name property.

Why: the country pages fetch a whole boundary GeoJSON (737 KB gzip for the US counties) before the
choropleth draws. Vector tiles send only the tiles under the window. See the design brief
(census boundaries as vector tiles, 2026-10-14) and tools/tiles-r2/README.md.

How: tippecanoe builds z0-10 from the GeoJSON with every feature kept at every zoom it covers
(`--no-feature-limit --no-tile-size-limit`), shared nodes fixed, tiny polygons kept, and
`--low-detail=10` below the maximum zoom (1,024 units per tile, half a css pixel at an integer
zoom). The stage then replaces tippecanoe's metadata table with a fixed public set before
`pmtiles convert`. tippecanoe's own metadata records its command line with the input and output
paths, which must stay off R2; the replacement also makes a rebuild byte-identical whatever the
work directory.

The archive name derives from content: `<id12>` is the first 12 hex digits of a digest over the
boundary file's sha256, the build parameters and the tippecanoe version, so changed geometry,
changed options or a changed tippecanoe give a new name (a versioned key is never overwritten).

Stages (run all with `all`, or one at a time):

  build     check the boundary, derive the name, run tippecanoe, replace the metadata, convert;
            `--verify-rebuild` builds a second time in a fresh directory and compares digests
  validate  six facts about the archive (exit 5 on a problem, 6 on a missing precondition):
            1 every code with geometry is present from the landing zoom up, and units of empty
              geometry are listed;
            2 the attributes are exactly the level's code and name properties;
            3 the header, the metadata and the tiles agree with the build zooms;
            4 the largest tile at each zoom is below 150 KB (stored gzip bytes);
            5 no two codes share a feature-state key (the key MapLibre derives from an id);
            6 the archive metadata holds only the public set, free of absolute paths, user names
              and host names
  manifest  the data manifest (schemas/data-manifest.schema.json, family census-tiles) and the
            validation report, only after validation passed and the digests still match

Nothing here reads or writes R2. Public records hold aggregates, hashes and counts only; the work
directory holds the private paths. There is no upload stage.
"""

from __future__ import annotations

import argparse
import getpass
import gzip
import hashlib
import json
import math
import multiprocessing as mp
import os
import re
import socket
import sqlite3
import struct
import subprocess
import sys
import time
import zlib
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_tiles_v2 import _run, _sha256  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
LAYER = "census"
MIN_ZOOM = 0
MAX_ZOOM = 10
LOW_DETAIL = 10
TILE_CAP_BYTES = 150_000  # fact 4: stored (gzip) bytes of the largest tile at each zoom
TILE_PX = 512
VIEWS = {"desktop": (1440, 900), "phone": (390, 844)}
TIPPECANOE_FLAGS = ["--no-feature-limit", "--no-tile-size-limit", "--no-tiny-polygon-reduction",
                    "--no-simplification-of-shared-nodes"]
# the Worker's versioned pattern for these archives (tools/tiles-r2/worker/src/index.js gains the same
# alternative); every generated name must match it
NAME_PATTERN = r"census-[a-z]{2}-[a-z0-9]+-\d{4}-[0-9a-f]{12}"
NAME_RE = re.compile(rf"^{NAME_PATTERN}$")
# the only keys the archive metadata may hold
PUBLIC_META_KEYS = ["name", "description", "version", "type", "format", "minzoom", "maxzoom",
                    "bounds", "center", "generator", "json"]
PUBLIC_JSON_KEYS = {"vector_layers", "tilestats"}
PUBLIC_LAYER_KEYS = {"id", "description", "minzoom", "maxzoom", "fields"}
PUBLIC_TILESTATS_KEYS = {"layerCount", "layers"}
PUBLIC_TILESTATS_LAYER_KEYS = {"layer", "count", "geometry", "attributeCount", "attributes"}
PUBLIC_TILESTATS_ATTR_KEYS = {"attribute", "count", "type", "min", "max"}


# ------------------------------------------------------------------- names

def build_params(code_prop, name_prop):
    """The build parameters that enter the archive name, in a fixed order."""
    return {"layer": LAYER, "minzoom": MIN_ZOOM, "maxzoom": MAX_ZOOM, "low_detail": LOW_DETAIL,
            "tippecanoe_flags": TIPPECANOE_FLAGS, "attributes": [code_prop, name_prop], "tile_px": TILE_PX}


def archive_name(country, slug, vintage, boundary_sha256, params, tippecanoe_version):
    """census-<cc>-<slug>-<vintage>-<id12>; raises ValueError on a part the Worker pattern would refuse."""
    if not re.fullmatch(r"[a-z]{2}", country):
        raise ValueError(f"country {country!r}: two lower-case letters")
    if not re.fullmatch(r"[a-z0-9]+", slug):
        raise ValueError(f"slug {slug!r}: lower-case letters and digits only")
    if not re.fullmatch(r"\d{4}", str(vintage)):
        raise ValueError(f"vintage {vintage!r}: four digits")
    digest = hashlib.sha256(json.dumps(
        {"boundary_sha256": boundary_sha256, "params": params, "tippecanoe": tippecanoe_version},
        sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    name = f"census-{country}-{slug}-{vintage}-{digest[:12]}"
    assert NAME_RE.match(name), name
    return name


# --------------------------------------------------------------- boundary

def has_geometry(g):
    """True when a GeoJSON geometry holds at least one drawable part (null, empty arrays and
    rings of fewer than four positions are empty)."""
    if not isinstance(g, dict):
        return False
    t, c = g.get("type"), g.get("coordinates")
    if t == "GeometryCollection":
        return any(has_geometry(x) for x in g.get("geometries") or [])
    if not c:
        return False
    if t == "Polygon":
        return any(isinstance(r, list) and len(r) >= 4 for r in c)
    if t == "MultiPolygon":
        return any(isinstance(p, list) and any(isinstance(r, list) and len(r) >= 4 for r in p) for p in c)
    if t in ("LineString", "MultiPoint"):
        return len(c) >= 1
    if t == "MultiLineString":
        return any(len(line) >= 2 for line in c)
    return t == "Point"


def read_boundary(doc, code_prop, name_prop):
    """Codes of a parsed boundary FeatureCollection: all codes, codes with geometry, codes whose
    every feature is empty, and the problems that stop a build (a missing or non-string code)."""
    problems, all_codes, drawn = [], set(), set()
    features = doc.get("features") if isinstance(doc, dict) else None
    if not isinstance(features, list):
        return {"features": 0, "codes": [], "with_geometry": [], "empty_geometry": [], "named": 0,
                "problems": ["not a FeatureCollection"]}
    named = 0
    for i, f in enumerate(features):
        props = f.get("properties") or {}
        code = props.get(code_prop)
        if not isinstance(code, str) or code == "":
            problems.append(f"feature {i}: {code_prop} is {code!r}, not a non-empty string")
            continue
        all_codes.add(code)
        if props.get(name_prop) not in (None, ""):
            named += 1
        if has_geometry(f.get("geometry")):
            drawn.add(code)
    return {"features": len(features), "codes": sorted(all_codes), "with_geometry": sorted(drawn),
            "empty_geometry": sorted(all_codes - drawn), "named": named, "problems": problems}


# ----------------------------------------------------------- feature state

_JS_SPACE = "\t\n\v\f\r                  　﻿"
_DEC = re.compile(r"[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?")
MAX_SAFE = 2 ** 53 - 1


def js_number(s):
    """JavaScript `+s` for a string: NaN as float('nan')."""
    t = s.strip(_JS_SPACE)
    if t == "":
        return 0.0
    if t in ("Infinity", "+Infinity"):
        return math.inf
    if t == "-Infinity":
        return -math.inf
    for prefix, base in (("0x", 16), ("0o", 8), ("0b", 2)):
        if t[:2].lower() == prefix:
            try:
                return float(int(t[2:], base)) if t[2:] and t[2:].isalnum() else math.nan
            except ValueError:
                return math.nan
    return float(t) if _DEC.fullmatch(t) else math.nan


def murmur3_32(key, seed=0):
    """MurmurHash3 x86 32-bit over the low byte of each UTF-16 code unit, as MapLibre's util does."""
    b = key.encode("utf-16-le")
    units = [u & 0xFF for u in struct.unpack(f"<{len(b) // 2}H", b)]
    n = len(units)
    c1, c2 = 0xCC9E2D51, 0x1B873593
    h = seed & 0xFFFFFFFF
    rem = n & 3
    for i in range(0, n - rem, 4):
        k = units[i] | units[i + 1] << 8 | units[i + 2] << 16 | units[i + 3] << 24
        k = (k * c1) & 0xFFFFFFFF
        k = ((k << 15) | (k >> 17)) & 0xFFFFFFFF
        k = (k * c2) & 0xFFFFFFFF
        h ^= k
        h = ((h << 13) | (h >> 19)) & 0xFFFFFFFF
        h = (h * 5 + 0xE6546B64) & 0xFFFFFFFF
    k = 0
    base = n - rem
    if rem >= 3:
        k ^= units[base + 2] << 16
    if rem >= 2:
        k ^= units[base + 1] << 8
    if rem >= 1:
        k ^= units[base]
        k = (k * c1) & 0xFFFFFFFF
        k = ((k << 15) | (k >> 17)) & 0xFFFFFFFF
        k = (k * c2) & 0xFFFFFFFF
        h ^= k
    h ^= n
    h ^= h >> 16
    h = (h * 0x85EBCA6B) & 0xFFFFFFFF
    h ^= h >> 13
    h = (h * 0xC2B2AE35) & 0xFFFFFFFF
    h ^= h >> 16
    return h


def feature_state_key(code):
    """The number MapLibre keys feature state on for a string id: the number itself when the string
    converts to a safe integer-range number, else the 32-bit murmur3 hash of the string."""
    v = js_number(code)
    if not math.isnan(v) and -MAX_SAFE <= v <= MAX_SAFE:
        return v
    return float(murmur3_32(code))


def state_key_collisions(codes):
    """Groups of distinct codes that share a feature-state key."""
    by_key = {}
    for c in codes:
        by_key.setdefault(feature_state_key(c), []).append(c)
    return [sorted(v) for v in by_key.values() if len(v) > 1]


# ------------------------------------------------------------ tile geometry

def view_tiles(lon, lat, zoom, width, height, maxzoom=MAX_ZOOM):
    """Tiles (z, x, y) that MapLibre loads under a window of width x height css pixels centred on
    (lon, lat) at a fractional zoom: tiles of floor(zoom), 512 css pixels each at an integer zoom."""
    tz = min(int(math.floor(zoom)), maxzoom)
    scale = TILE_PX * 2 ** zoom
    cx = (lon + 180) / 360 * scale
    cy = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * scale
    tile_px = TILE_PX * 2 ** (zoom - tz)
    xs = range(int((cx - width / 2) // tile_px), int((cx + width / 2) // tile_px) + 1)
    ys = range(max(0, int((cy - height / 2) // tile_px)), min((1 << tz) - 1, int((cy + height / 2) // tile_px)) + 1)
    seen, out = set(), []
    for x in xs:
        for y in ys:
            k = (tz, x % (1 << tz), y)
            if k not in seen:
                seen.add(k)
                out.append(k)
    return out


# ------------------------------------------------------- vector tile reader

def _varint(buf, i):
    shift = result = 0
    while True:
        b = buf[i]
        i += 1
        result |= (b & 0x7F) << shift
        if b < 0x80:
            return result, i
        shift += 7


def _fields(buf):
    """(field number, wire type, value) of a protobuf message; length-delimited values are bytes."""
    i, n = 0, len(buf)
    while i < n:
        key, i = _varint(buf, i)
        field, wire = key >> 3, key & 7
        if wire == 0:
            v, i = _varint(buf, i)
        elif wire == 2:
            ln, i = _varint(buf, i)
            if i + ln > n:
                raise ValueError("length-delimited field runs past the end of the message")
            v, i = buf[i:i + ln], i + ln
        elif wire == 1:
            v, i = buf[i:i + 8], i + 8
        elif wire == 5:
            v, i = buf[i:i + 4], i + 4
        else:
            raise ValueError(f"unsupported wire type {wire}")
        yield field, wire, v


def _value(buf):
    for field, wire, v in _fields(buf):
        if field == 1:
            return bytes(v).decode("utf-8")
        if field == 2:
            return struct.unpack("<f", v)[0]
        if field == 3:
            return struct.unpack("<d", v)[0]
        if field in (4, 5):
            return v
        if field == 6:
            return (v >> 1) ^ -(v & 1)
        if field == 7:
            return bool(v)
    return None


def decode_tile(raw):
    """Layers of a vector tile (gzip or plain): {layer name: [feature properties, ...]}. Geometry is
    not decoded; the checks here read attributes only. Raises ValueError on a corrupt tile (a tag
    index past the key or value table, a truncated message, bad gzip or UTF-8)."""
    try:
        return _decode_tile(raw)
    except (ValueError, IndexError, struct.error, UnicodeDecodeError, OSError, EOFError, zlib.error) as e:
        raise ValueError(f"corrupt tile: {type(e).__name__}: {e}") from e


def _decode_tile(raw):
    if raw[:2] == b"\x1f\x8b":
        raw = gzip.decompress(raw)
    layers = {}
    for field, wire, body in _fields(raw):
        if field != 3 or wire != 2:
            continue
        name, keys, values, feats = "", [], [], []
        for f, w, v in _fields(body):
            if f == 1:
                name = bytes(v).decode("utf-8")
            elif f == 2:
                feats.append(v)
            elif f == 3:
                keys.append(bytes(v).decode("utf-8"))
            elif f == 4:
                values.append(_value(v))
        out = layers.setdefault(name, [])
        for fb in feats:
            props = {}
            for f, w, v in _fields(fb):
                if f == 2 and w == 2:
                    tags, j = [], 0
                    while j < len(v):
                        t, j = _varint(v, j)
                        tags.append(t)
                    for a in range(0, len(tags) - 1, 2):
                        props[keys[tags[a]]] = values[tags[a + 1]]
            out.append(props)
    return layers


# ------------------------------------------------------------------ metadata

def strip_values(tilestats):
    """tilestats without value samples (keeps counts, attribute names and types)."""
    out = json.loads(json.dumps(tilestats))
    for layer in out.get("layers", []):
        for attr in layer.get("attributes", []):
            attr.pop("values", None)
    return out


def public_metadata(src, name, code_prop, name_prop, tippecanoe_version):
    """The fixed public metadata set for an archive, from tippecanoe's mbtiles metadata `src` (a dict).

    Only the data-derived `bounds` and `center` and the tilestats counts come from tippecanoe;
    its command line (`generator_options`), strategies and every other key are dropped."""
    try:
        doc = json.loads(src["json"])
    except (KeyError, TypeError, ValueError) as e:
        raise ValueError(f"tippecanoe metadata has no usable json entry ({type(e).__name__}); the layer definition and tilestats cannot be rebuilt") from e
    stats = strip_values(doc.get("tilestats") or {"layerCount": 1, "layers": []})
    stats = {k: v for k, v in stats.items() if k in PUBLIC_TILESTATS_KEYS}
    stats["layers"] = [{k: v for k, v in layer.items() if k in PUBLIC_TILESTATS_LAYER_KEYS} for layer in stats.get("layers", [])]
    for layer in stats["layers"]:
        layer["attributes"] = [{k: v for k, v in a.items() if k in PUBLIC_TILESTATS_ATTR_KEYS} for a in layer.get("attributes", [])]
    layer_def = {"id": LAYER, "description": "", "minzoom": MIN_ZOOM, "maxzoom": MAX_ZOOM,
                 "fields": {code_prop: "String", name_prop: "String"}}
    meta = {
        "name": name,
        "description": f"{name}: census boundary polygons, layer {LAYER}, attributes {code_prop} and {name_prop}, z{MIN_ZOOM}-{MAX_ZOOM}",
        "version": "2", "type": "overlay", "format": "pbf",
        "minzoom": str(MIN_ZOOM), "maxzoom": str(MAX_ZOOM),
        "bounds": src.get("bounds"), "center": src.get("center"),
        "generator": f"build_census_tiles.py ({tippecanoe_version})",
        "json": json.dumps({"vector_layers": [layer_def], "tilestats": stats}, ensure_ascii=False, separators=(",", ":")),
    }
    return {k: meta[k] for k in PUBLIC_META_KEYS if meta[k] is not None}


def replace_metadata(mbtiles, meta):
    """Replace the metadata table of an mbtiles file with `meta`, in fixed key order."""
    db = sqlite3.connect(str(mbtiles))
    try:
        db.execute("delete from metadata")
        db.executemany("insert into metadata (name, value) values (?, ?)", list(meta.items()))
        db.commit()
    finally:
        db.close()


def read_metadata(mbtiles):
    db = sqlite3.connect(f"file:{mbtiles}?mode=ro", uri=True)
    try:
        return dict(db.execute("select name, value from metadata").fetchall())
    finally:
        db.close()


# ---------------------------------------------------------------------- build

def _tool_version(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    return ((r.stdout + r.stderr).strip().splitlines() or ["unknown"])[0].strip()


def tippecanoe_cmd(spec, boundary, dst, tmp):
    return ["tippecanoe", *TIPPECANOE_FLAGS, "--force", "-l", LAYER, "-y", spec["code_prop"], "-y", spec["name_prop"],
            f"-Z{MIN_ZOOM}", f"-z{MAX_ZOOM}", f"--low-detail={LOW_DETAIL}", "--temporary-directory", str(tmp),
            "-o", str(dst), str(boundary)]


def build_archive(spec, boundary, parts, out, logs):
    """One build into the given directories; returns the archive path. Exits with tippecanoe's code on failure."""
    for d in (parts, out, logs):
        Path(d).mkdir(parents=True, exist_ok=True)
    tmp = Path(parts) / "tmp"
    tmp.mkdir(exist_ok=True)
    mb = Path(parts) / "census.mbtiles"
    cmd = tippecanoe_cmd(spec, boundary, mb, tmp)
    print(f"build: {' '.join(cmd)}", flush=True)
    rc, secs = _run(cmd, Path(logs) / "tippecanoe.log")
    print(f"build: tippecanoe rc={rc} {secs}s", flush=True)
    if rc:
        sys.exit(rc)
    try:
        meta = public_metadata(read_metadata(mb), spec["name"], spec["code_prop"], spec["name_prop"], spec["tippecanoe"])
    except ValueError as e:
        print(f"build: STOP. {e}", file=sys.stderr)
        sys.exit(3)
    replace_metadata(mb, meta)
    pmt = Path(out) / f"{spec['name']}.pmtiles"
    if pmt.exists():
        pmt.unlink()
    cmd = ["pmtiles", "convert", str(mb), str(pmt), f"--tmpdir={tmp}"]
    rc, secs = _run(cmd, Path(logs) / "pmtiles-convert.log")
    print(f"build: pmtiles convert rc={rc} {secs}s", flush=True)
    if rc:
        sys.exit(rc)
    return pmt


def boundary_label(path):
    """The boundary file's repository-relative path when it lies in the repository, else its file name."""
    p = Path(path).resolve()
    try:
        return p.relative_to(REPO).as_posix()
    except ValueError:
        return p.name


def public_commands(spec):
    """The build commands with private locations replaced by placeholders."""
    tip = ["tippecanoe", *TIPPECANOE_FLAGS, "--force", "-l", LAYER, "-y", spec["code_prop"], "-y", spec["name_prop"],
           f"-Z{MIN_ZOOM}", f"-z{MAX_ZOOM}", f"--low-detail={LOW_DETAIL}", "-o", "<work>/census.mbtiles", "<boundary.geojson>"]
    return {"tippecanoe": " ".join(tip),
            "metadata": "replace the mbtiles metadata table with the fixed public set (name, description, version, type, format, "
                        "minzoom, maxzoom, bounds, center, generator, json with vector_layers and tilestats without value samples)",
            "convert": f"pmtiles convert <work>/census.mbtiles <work>/{spec['name']}.pmtiles"}


def cmd_build(a):
    work = Path(a.work)
    work.mkdir(parents=True, exist_ok=True)
    boundary = Path(a.boundary).resolve()
    doc = json.loads(boundary.read_text(encoding="utf-8"))
    info = read_boundary(doc, a.code_prop, a.name_prop)
    if info["problems"]:
        for m in info["problems"][:10]:
            print(f"build: STOP. {m}", file=sys.stderr)
        sys.exit(3)
    if not info["with_geometry"]:
        print("build: STOP. the boundary holds no feature with geometry", file=sys.stderr)
        sys.exit(3)
    lon, lat, zoom = (float(v) for v in a.landing.split(","))
    boundary_sha = _sha256(boundary)
    tipv, pmv = _tool_version(["tippecanoe", "--version"]), _tool_version(["pmtiles", "version"])
    params = build_params(a.code_prop, a.name_prop)
    try:
        name = archive_name(a.country, a.slug, a.vintage, boundary_sha, params, tipv)
    except ValueError as e:
        print(f"build: STOP. {e}", file=sys.stderr)
        sys.exit(3)
    spec = {"name": name, "country": a.country, "slug": a.slug, "vintage": str(a.vintage), "level_ids": sorted(a.level_id or []),
            "code_prop": a.code_prop, "name_prop": a.name_prop, "landing": {"lon": lon, "lat": lat, "zoom": zoom},
            "boundary_path": str(boundary), "boundary_label": boundary_label(boundary), "boundary_sha256": boundary_sha,
            "boundary_bytes": boundary.stat().st_size, "tippecanoe": tipv, "pmtiles_cli": pmv, "params": params,
            "units": len(info["codes"]), "units_with_geometry": len(info["with_geometry"]),
            "units_empty_geometry": info["empty_geometry"], "features": info["features"]}
    (work / "spec.json").write_text(json.dumps(spec, indent=2) + "\n")
    print(f"build: {name} from {spec['boundary_label']} ({len(info['codes'])} codes, {len(info['empty_geometry'])} with empty geometry)", flush=True)
    pmt = build_archive(spec, boundary, work / "parts", work / "out", work / "logs")
    sha = _sha256(pmt)
    record = {"name": name, "archive_sha256": sha, "archive_bytes": pmt.stat().st_size,
              "built_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "rebuild_identical": None}
    if a.verify_rebuild:
        pmt2 = build_archive(spec, boundary, work / "rebuild" / "parts", work / "rebuild" / "out", work / "rebuild" / "logs")
        sha2 = _sha256(pmt2)
        record["rebuild_identical"] = sha2 == sha
        print(f"build: rebuild {'identical' if sha2 == sha else 'DIFFERS'} ({sha[:12]} / {sha2[:12]})", flush=True)
    (work / "build-info.json").write_text(json.dumps(record, indent=2) + "\n")
    if record["rebuild_identical"] is False:
        sys.exit(5)


# ------------------------------------------------------------------ validate

def _scan_tile(args):
    z, x, y, data, code_prop = args
    try:
        layers = decode_tile(data)
    except ValueError as e:
        return z, x, y, len(data), [], [], [], 0, 0, str(e)
    codes, keys, no_code, features = set(), set(), 0, 0
    for feats in layers.values():
        for props in feats:
            features += 1
            keys.update(props)
            c = props.get(code_prop)
            if isinstance(c, str) and c:
                codes.add(c)
            else:
                no_code += 1
    return z, x, y, len(data), sorted(layers), sorted(codes), sorted(keys), no_code, features


def _iter_tiles(path, code_prop):
    from pmtiles.reader import MmapSource, all_tiles

    with open(path, "rb") as fh:
        for (z, x, y), data in all_tiles(MmapSource(fh)):
            yield z, x, y, data, code_prop


def read_archive_meta(path):
    from pmtiles.reader import MmapSource, Reader

    with open(path, "rb") as fh:
        r = Reader(MmapSource(fh))
        h = r.header()
        return {"minzoom": h["min_zoom"], "maxzoom": h["max_zoom"]}, r.metadata()


def new_scan():
    return {"zooms": {}, "layers": set(), "keys": set(), "no_code": 0, "features": 0, "landing_sizes": {}, "errors": []}


def add_tile(scan, result, landing_zoom):
    """Fold one scanned tile (the _scan_tile result) into the scan."""
    z, x, y, size, layers, codes, keys, no_code, features, *error = result
    if error:
        scan["errors"].append([z, x, y, error[0]])
    zs = scan["zooms"].setdefault(z, {"tiles": 0, "bytes": 0, "max": 0, "max_tile": None, "codes": set()})
    zs["tiles"] += 1
    zs["bytes"] += size
    if size > zs["max"]:
        zs["max"], zs["max_tile"] = size, [z, x, y]
    zs["codes"].update(codes)
    scan["layers"].update(layers)
    scan["keys"].update(keys)
    scan["no_code"] += no_code
    scan["features"] += features
    if z == landing_zoom:
        scan["landing_sizes"][(z, x, y)] = size


def scan_archive(path, code_prop, landing_zoom, jobs):
    scan = new_scan()
    with mp.Pool(jobs) as pool:
        for result in pool.imap_unordered(_scan_tile, _iter_tiles(path, code_prop), chunksize=16):
            add_tile(scan, result, landing_zoom)
    return scan


def landing_zoom_of(spec):
    return min(int(math.floor(spec["landing"]["zoom"])), MAX_ZOOM)


def leak_findings(strings, forbidden):
    """Absolute paths, command-line options, user names and host names in the given strings."""
    patterns = [
        ("absolute path", re.compile(r"/(?:Users|home|private|var|tmp|Volumes|mnt|root|opt|srv|etc)/|(?<![\w.])~/|[A-Za-z]:\\")),
        ("command-line option", re.compile(r"(?:^|\s)(?:--[A-Za-z][\w-]+|-[A-Za-z]\d*(?=\s|$))")),
        ("tool invocation", re.compile(r"\btippecanoe\s+-|\bpmtiles\s+convert\b")),
    ]
    out = []
    for s in strings:
        for label, rx in patterns:
            if rx.search(s):
                out.append(f"{label} in {s[:60]!r}")
        for lit in forbidden:
            if lit and re.search(rf"(?<![A-Za-z0-9]){re.escape(lit)}(?![A-Za-z0-9])", s, re.I):
                out.append(f"private identifier {lit!r} in {s[:60]!r}")
    return out


def _strings(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for k, v in value.items():
            yield from _strings(k)
            yield from _strings(v)
    elif isinstance(value, (list, tuple)):
        for v in value:
            yield from _strings(v)


def check_metadata(meta, spec, forbidden):
    """Fact 6: the metadata holds only the public set and no private string. Returns problems."""
    problems = []
    # a PMTiles reader unfolds the mbtiles `json` entry into top-level keys; accept either form
    extra = sorted(set(meta) - set(PUBLIC_META_KEYS) - PUBLIC_JSON_KEYS)
    if extra:
        problems.append(f"metadata keys outside the public set: {extra}")
    doc = meta.get("json")
    if doc is None:
        doc = {k: meta[k] for k in PUBLIC_JSON_KEYS if k in meta}
    if isinstance(doc, str):
        try:
            doc = json.loads(doc)
        except ValueError:
            problems.append("metadata json is not valid JSON")
            doc = {}
    doc = doc or {}
    if set(doc) - PUBLIC_JSON_KEYS:
        problems.append(f"metadata json keys outside the public set: {sorted(set(doc) - PUBLIC_JSON_KEYS)}")
    for lyr in doc.get("vector_layers", []):
        if set(lyr) - PUBLIC_LAYER_KEYS:
            problems.append(f"vector layer keys outside the public set: {sorted(set(lyr) - PUBLIC_LAYER_KEYS)}")
    ts = doc.get("tilestats") or {}
    if set(ts) - PUBLIC_TILESTATS_KEYS:
        problems.append(f"tilestats keys outside the public set: {sorted(set(ts) - PUBLIC_TILESTATS_KEYS)}")
    for lyr in ts.get("layers", []):
        if set(lyr) - PUBLIC_TILESTATS_LAYER_KEYS:
            problems.append(f"tilestats layer keys outside the public set: {sorted(set(lyr) - PUBLIC_TILESTATS_LAYER_KEYS)}")
        for at in lyr.get("attributes", []):
            if "values" in at or set(at) - PUBLIC_TILESTATS_ATTR_KEYS:
                problems.append(f"tilestats attribute keys outside the public set: {sorted(set(at) - PUBLIC_TILESTATS_ATTR_KEYS)}")
    if meta.get("name") != spec["name"]:
        problems.append(f"metadata name {meta.get('name')!r}, expected {spec['name']!r}")
    problems += [f"metadata: {m}" for m in leak_findings(_strings(meta), forbidden)]
    return problems


def check_scan(scan, header, meta, spec, codes_with_geometry, all_codes, forbidden):
    """The six facts, as a list of problems and a report. Pure: the scan, header and metadata are inputs."""
    problems, report = [], {}
    lz = landing_zoom_of(spec)
    want = set(codes_with_geometry)
    cov = {}
    for z in range(MIN_ZOOM, MAX_ZOOM + 1):
        have = scan["zooms"].get(z, {}).get("codes", set())
        cov[str(z)] = {"present": len(want & have), "of": len(want), "missing": len(want - have)}
        if z >= lz and want - have:
            miss = sorted(want - have)
            problems.append(f"fact 1: z{z} lacks {len(miss)} of {len(want)} codes with geometry (for example {miss[:4]})")
    unknown = set().union(*(s["codes"] for s in scan["zooms"].values())) - set(all_codes) if scan["zooms"] else set()
    if unknown:
        problems.append(f"fact 1: {len(unknown)} tile codes are not in the boundary (for example {sorted(unknown)[:4]})")
    report["code_coverage"] = cov
    report["empty_geometry_codes"] = list(spec["units_empty_geometry"])

    if scan["errors"]:
        e = scan["errors"][0]
        problems.append(f"fact 2: {len(scan['errors'])} tiles could not be decoded (first: tile {e[:3]}, {e[3]})")
    allowed = {spec["code_prop"], spec["name_prop"]}
    if scan["keys"] != allowed:
        problems.append(f"fact 2: tile attributes {sorted(scan['keys'])}, expected exactly {sorted(allowed)}")
    if scan["no_code"]:
        problems.append(f"fact 2: {scan['no_code']} tile features carry no {spec['code_prop']}")
    if scan["layers"] != {LAYER}:
        problems.append(f"fact 2: layers {sorted(scan['layers'])}, expected [{LAYER}]")
    report["attributes"] = sorted(scan["keys"])

    observed = sorted(scan["zooms"])
    if header != {"minzoom": MIN_ZOOM, "maxzoom": MAX_ZOOM}:
        problems.append(f"fact 3: header zooms {header}, build z{MIN_ZOOM}-{MAX_ZOOM}")
    if (meta.get("minzoom"), meta.get("maxzoom")) != (str(MIN_ZOOM), str(MAX_ZOOM)):
        problems.append(f"fact 3: metadata zooms {meta.get('minzoom')}-{meta.get('maxzoom')}, build z{MIN_ZOOM}-{MAX_ZOOM}")
    if not observed or observed[0] != MIN_ZOOM or observed[-1] != MAX_ZOOM:
        problems.append(f"fact 3: tiles span z{observed[0] if observed else '-'}-{observed[-1] if observed else '-'}, build z{MIN_ZOOM}-{MAX_ZOOM}")

    zooms = {}
    for z in observed:
        s = scan["zooms"][z]
        zooms[str(z)] = {"tiles": s["tiles"], "total_bytes": s["bytes"], "largest_tile_bytes": s["max"], "largest_tile": s["max_tile"]}
        if s["max"] >= TILE_CAP_BYTES:
            problems.append(f"fact 4: z{z} largest tile {s['max']} bytes (tile {s['max_tile']}) is not below {TILE_CAP_BYTES}")
    report["zooms"] = zooms

    clashes = state_key_collisions(all_codes)
    for grp in clashes[:5]:
        problems.append(f"fact 5: codes share a feature-state key: {grp}")
    report["feature_state_key_collisions"] = len(clashes)

    problems += [f"fact 6: {m}" for m in check_metadata(meta, spec, forbidden)]
    return problems, report


def landing_view(spec, scan):
    """Tiles under each reference window at the landing view, with stored bytes."""
    out = {}
    lon, lat, zoom = spec["landing"]["lon"], spec["landing"]["lat"], spec["landing"]["zoom"]
    for label, (w, h) in VIEWS.items():
        tiles = view_tiles(lon, lat, zoom, w, h)
        rows = [[z, x, y, scan["landing_sizes"][(z, x, y)]] for z, x, y in tiles if (z, x, y) in scan["landing_sizes"]]
        out[label] = {"window": [w, h], "tiles_in_view": len(tiles), "tiles": rows, "total_bytes": sum(r[3] for r in rows)}
    return out


def forbidden_identifiers(spec, extra):
    names = set()
    try:
        names.add(getpass.getuser())
    except Exception:
        pass
    host = socket.gethostname()
    names.update({host, host.split(".")[0]})
    names.update(extra or [])
    lits = {n for n in names if n and len(n) >= 3}
    lits.update({str(Path.home()), spec["boundary_path"], str(Path(spec["boundary_path"]).parent)})
    return sorted(lits)


def cmd_validate(a):
    work = Path(a.work)
    spec = json.loads((work / "spec.json").read_text())
    info = json.loads((work / "build-info.json").read_text())
    if info.get("rebuild_identical") is False:
        print("validate: the rebuild differed; build again", file=sys.stderr)
        sys.exit(6)
    pmt = work / "out" / f"{spec['name']}.pmtiles"
    boundary = Path(spec["boundary_path"])
    if _sha256(boundary) != spec["boundary_sha256"]:
        print("validate: the boundary file changed since the build; build again", file=sys.stderr)
        sys.exit(6)
    sha = _sha256(pmt)
    if sha != info["archive_sha256"]:
        print("validate: the archive differs from the build record; build again", file=sys.stderr)
        sys.exit(6)
    bd = read_boundary(json.loads(boundary.read_text(encoding="utf-8")), spec["code_prop"], spec["name_prop"])
    t0 = time.time()
    header, meta = read_archive_meta(pmt)
    scan = scan_archive(pmt, spec["code_prop"], landing_zoom_of(spec), a.jobs)
    print(f"validate: scanned {sum(z['tiles'] for z in scan['zooms'].values())} tiles in {round(time.time() - t0)}s", flush=True)
    forbidden = forbidden_identifiers(spec, a.forbid)
    problems, rep = check_scan(scan, header, meta, spec, bd["with_geometry"], bd["codes"], forbidden)
    if _sha256(pmt) != sha:
        problems.append("the archive changed during validation")
    report = {"status": "failed" if problems else "passed", "name": spec["name"], "archive_sha256": sha,
              "archive_bytes": pmt.stat().st_size, "boundary_sha256": spec["boundary_sha256"], "header": header,
              "units": spec["units"], "units_with_geometry": spec["units_with_geometry"],
              "landing_tile_zoom": landing_zoom_of(spec), "landing_view": landing_view(spec, scan),
              "problems": problems, **rep, "seconds": round(time.time() - t0)}
    (work / "validation-report.json").write_text(json.dumps(report, indent=2) + "\n")
    for m in problems:
        print("validate: PROBLEM", m, file=sys.stderr)
    print(f"validate: {report['status']}", flush=True)
    if problems:
        sys.exit(5)


# ------------------------------------------------------------------ manifest

def _md_report(rep, spec):
    lines = [f"# Census tiles: validation report, {rep['name']}", "",
             f"Status: **{rep['status']}**. Boundary `{spec['boundary_label']}` (sha256 `{spec['boundary_sha256']}`), "
             f"{spec['units']:,} codes, {spec['units_with_geometry']:,} with geometry. Archive {rep['archive_bytes']:,} bytes "
             f"(sha256 `{rep['archive_sha256']}`).", "",
             "| zoom | tiles | total KB | largest tile KB | codes present |", "|---|---|---|---|---|"]
    for z, s in rep["zooms"].items():
        c = rep["code_coverage"][z]
        lines.append(f"| {z} | {s['tiles']:,} | {s['total_bytes'] / 1e3:,.0f} | {s['largest_tile_bytes'] / 1e3:.1f} | {c['present']:,} of {c['of']:,} |")
    for label, v in rep["landing_view"].items():
        lines += ["", f"Landing view, {v['window'][0]} x {v['window'][1]}: {len(v['tiles'])} tiles, {v['total_bytes'] / 1e3:.0f} KB stored."]
    if rep["empty_geometry_codes"]:
        lines += ["", f"Codes of empty geometry in the boundary, absent from every zoom: {len(rep['empty_geometry_codes'])}."]
    return "\n".join(lines) + "\n"


def make_manifest(a, spec, info, rep, uploads):
    name = spec["name"]
    params = {
        "method": "tippecanoe z0-10 from the governed boundary GeoJSON, every feature kept at every zoom it covers; metadata replaced by the fixed public set",
        "boundary_file": spec["boundary_label"], "boundary_sha256": spec["boundary_sha256"], "boundary_bytes": spec["boundary_bytes"],
        "slug": spec["slug"], "vintage": spec["vintage"], "level_ids": spec["level_ids"],
        "layer": LAYER, "attributes": [spec["code_prop"], spec["name_prop"]], "minzoom": MIN_ZOOM, "maxzoom": MAX_ZOOM,
        "low_detail": LOW_DETAIL, "tippecanoe_flags": TIPPECANOE_FLAGS, "tile_px": TILE_PX,
        "commands": public_commands(spec),
        "units": spec["units"], "units_with_geometry": spec["units_with_geometry"],
        "units_empty_geometry": spec["units_empty_geometry"],
        "code_coverage_by_zoom": rep["code_coverage"],
        "largest_tile_by_zoom": {z: {"bytes": s["largest_tile_bytes"], "tile": s["largest_tile"]} for z, s in rep["zooms"].items()},
        "landing_view": {"center": [spec["landing"]["lon"], spec["landing"]["lat"]], "zoom": spec["landing"]["zoom"], **rep["landing_view"]},
        "tile_cap_bytes": TILE_CAP_BYTES,
    }
    files = [{
        "uri": f"build-cache:{name}.pmtiles", "storage_provider": "other", "format": "pmtiles", "bytes": rep["archive_bytes"],
        "sha256": rep["archive_sha256"], "feature_count": None, "privacy": "public", "licence_status": "needs_review",
        "notes": "A machine-local build output, a cache and not a durable store; the durable copy is the R2 object, once uploaded and recorded."}]
    for u in uploads:
        if u.get("key") == f"{name}.pmtiles":
            if not u.get("match"):
                print(f"manifest: the upload record for {u['key']} did not verify (match false); not recording it", file=sys.stderr)
                sys.exit(7)
            if u.get("sha256_readback") != rep["archive_sha256"]:
                print(f"manifest: the upload record for {u['key']} carries sha256 {u.get('sha256_readback')}, the validated archive {rep['archive_sha256']}", file=sys.stderr)
                sys.exit(7)
            files.append({"uri": f"r2://pow-tiles/{u['key']}", "storage_provider": "other", "format": "pmtiles", "bytes": u["bytes"],
                          "sha256": u["sha256_readback"], "feature_count": None, "privacy": "public", "licence_status": "needs_review",
                          "notes": f"durable R2 object, served at https://tiles.placemap.org/{name}/{{z}}/{{x}}/{{y}}; r2 etag {u.get('r2_etag')}; uploaded with a refusal on an existing key and verified by a full read-back sha256"})
    ident = hashlib.sha256(json.dumps({"files": [(f"{name}.pmtiles", rep["archive_sha256"])], "params": params}, sort_keys=True, default=str).encode()).hexdigest()
    return {
        "$schema": "../../../schemas/data-manifest.schema.json",
        "schema_version": "data-manifest.v2",
        "manifest_id": f"manifest:{name}-{ident[:12]}",
        "dataset_id": name,
        "dataset_version_id": f"{name}:{ident[:16]}",
        "dataset_family": "census-tiles",
        "dataset_role": "public_product",
        "scope": {"level": "country", "country_codes": [spec["country"].upper()], "snapshot_date": None, "pipeline_stage": "staged"},
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "created_by": a.created_by,
        "pipeline": {
            "script": "tools/tiles-r2/build_census_tiles.py", "git_commit": a.git_commit or None,
            "command": "uv run tools/tiles-r2/build_census_tiles.py all --work <dir> --boundary <boundary.geojson> --country <cc> --slug <slug> --vintage <yyyy> "
                       "--code-prop <codeProp> --name-prop <nameProp> --landing <lon,lat,zoom>",
            "parameters": params,
            "software_versions": {"tippecanoe": spec["tippecanoe"], "pmtiles_cli": spec["pmtiles_cli"], "python": sys.version.split()[0]}},
        "source": {
            "provider": f"the governed boundary GeoJSON {spec['boundary_label']}",
            "licence": None,
            "citation": f"{spec['boundary_label']} sha256 {spec['boundary_sha256']}, {spec['features']} features, {spec['units']} codes.",
            "licence_todo": "the tiles add no geometry or attribute beyond the governed boundary file and inherit its licence position"},
        "durable_files": files,
        "validation": {
            "status": "passed",
            "commands": ["uv run tools/tiles-r2/build_census_tiles.py validate --work <dir>"],
            "warnings": ["licence_status needs_review: inherited from the governed boundary file"] + (
                [f"{len(spec['units_empty_geometry'])} codes have empty geometry in the boundary and are absent from every zoom"]
                if spec["units_empty_geometry"] else []),
            "notes": f"full report in tools/tiles-r2/manifests/validation-report-{name}.md",
            "criteria_not_met": []},
        "downstream_status": "staged"}


def cmd_manifest(a):
    import jsonschema

    work = Path(a.work)
    spec = json.loads((work / "spec.json").read_text())
    info = json.loads((work / "build-info.json").read_text())
    rep = json.loads((work / "validation-report.json").read_text())
    if rep["status"] != "passed":
        print(f"manifest: the validation report says {rep['status']}; no manifest is written", file=sys.stderr)
        sys.exit(6)
    pmt = work / "out" / f"{spec['name']}.pmtiles"
    current = _sha256(pmt)
    if not (current == rep["archive_sha256"] == info["archive_sha256"]):
        print(f"manifest: {pmt.name} digest {current} differs from the validated {rep['archive_sha256']}; build and validate again", file=sys.stderr)
        sys.exit(7)
    if _sha256(Path(spec["boundary_path"])) != rep["boundary_sha256"]:
        print("manifest: the boundary file changed since validation; build and validate again", file=sys.stderr)
        sys.exit(7)
    uploads = []
    if a.uploads:
        for line in Path(a.uploads).read_text().splitlines():
            line = line.strip()
            if line.startswith("{"):
                uploads.append(json.loads(line))
    schema_path = Path(a.schema) if a.schema else REPO / "schemas/data-manifest.schema.json"
    manifest = make_manifest(a, spec, info, rep, uploads)
    jsonschema.validate(manifest, json.loads(schema_path.read_text()))
    dest = Path(a.manifest_dir or work / "manifests")
    dest.mkdir(parents=True, exist_ok=True)
    name = spec["name"]
    (dest / f"{name}.manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    (dest / f"validation-report-{name}.json").write_text(json.dumps(rep, indent=2, ensure_ascii=False) + "\n")
    (dest / f"validation-report-{name}.md").write_text(_md_report(rep, spec))
    print(f"manifest: wrote {dest / (name + '.manifest.json')} (version {manifest['dataset_version_id']})", flush=True)


# ---------------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("stage", choices=["build", "validate", "manifest", "all"])
    ap.add_argument("--work", required=True)
    ap.add_argument("--boundary", help="the governed boundary GeoJSON (build)")
    ap.add_argument("--country", help="two-letter lower-case country code (build)")
    ap.add_argument("--slug", help="lower-case alphanumeric name of the boundary set, such as county or sa2 (build)")
    ap.add_argument("--vintage", help="four-digit vintage of the boundary (build)")
    ap.add_argument("--code-prop", help="the level's codeProp (build)")
    ap.add_argument("--name-prop", help="the level's nameProp (build)")
    ap.add_argument("--landing", help="lon,lat,zoom of the landing view (build)")
    ap.add_argument("--level-id", action="append", help="a level id this archive serves; repeat for several (build)")
    ap.add_argument("--verify-rebuild", action="store_true", help="build a second time in a fresh directory and compare digests (build)")
    ap.add_argument("--forbid", action="append", help="an extra private identifier the metadata must not hold (validate)")
    ap.add_argument("--manifest-dir", default=None)
    ap.add_argument("--schema", default=None)
    ap.add_argument("--git-commit", default=None)
    ap.add_argument("--created-by", default="claude-sonnet-5-5 (claude code)")
    ap.add_argument("--uploads", default=None, help="file of JSON lines printed by the upload script")
    ap.add_argument("--jobs", type=int, default=max(2, (mp.cpu_count() or 4) - 2))
    a = ap.parse_args()
    stages = ["build", "validate", "manifest"] if a.stage == "all" else [a.stage]
    if "build" in stages:
        for opt in ("boundary", "country", "slug", "vintage", "code_prop", "name_prop", "landing"):
            if not getattr(a, opt):
                ap.error(f"--{opt.replace('_', '-')} is required for build")
    for stage in stages:
        {"build": cmd_build, "validate": cmd_validate, "manifest": cmd_manifest}[stage](a)


if __name__ == "__main__":
    main()
