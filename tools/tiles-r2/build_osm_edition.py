"""Build and validate versioned PMTiles from the public OSM edition NDJSON."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import re
import sqlite3
import subprocess
import sys
from collections import Counter
from contextlib import ExitStack, closing
from dataclasses import dataclass
from datetime import datetime, timezone
from importlib.metadata import version
from pathlib import Path

import build_tiles_grid as grid
from build_census_tiles import replace_metadata
from build_tiles_v2 import _sha256
from extract_osm_edition import (
    FILES, FILTER_RULES, JULY_STATS, OSM_TYPES, PUBLIC_OPTIONAL, PUBLIC_REQUIRED,
    UNKNOWN_COUNTRY, check_reconstruction, check_release_version, check_timestamp, classify, edition_source,
    json_line, public_properties, read_json, write_json,
)
from scrub_build_records import LEAK

POSSIBLE_LAYER = "places_possible"
RA_ZOOMS = range(3, 8)
HIGH_ZOOMS = range(grid.COPY_FROM_ZOOM, grid.MAX_ZOOM + 1)
RECORD_RE = re.compile(r"[1-9][0-9]{0,18}")
CODE_RE = re.compile(r"[A-Z]{2}")
FILE_RE = re.compile(r"planet-[0-9]{6,8}\.osm\.pbf")
PUBLIC_RELIGIONS = frozenset({
    "bahai", "buddhist", "christian", "confucian", "hindu", "jain", "jewish", "muslim",
    "shinto", "sikh", "spiritualist", "taoist", "unknown",
})
SCHEMA = Path(__file__).resolve().parents[2] / "schemas/data-manifest.schema.json"
REPORT_SCHEMA = Path(__file__).with_name("edition-report.schema.json")
VERSION = re.compile(r"v?[0-9]+\.[0-9]+\.[0-9]+(?:[a-z]+[0-9]+|[.][a-z0-9]+|[-+][a-z0-9.]+)?")
VERSION_FIELDS = frozenset({
    "osmium_cli", "python", "osmium", "shapely", "pyshp", "tippecanoe",
    "pmtiles_cli", "pmtiles_cli_package", "validation_python", "mapbox-vector-tile", "pmtiles", "jsonschema",
})
PRIVATE_KEY = re.compile(r"(?:build[_-])?host(?:name)?|(?:user|account)[_-]?(?:id|name)")
PRIVATE_PATH = re.compile(r"/(?:Users|home|private|var|tmp|Volumes|mnt|root|opt|srv|etc)/|(?<![\w.])~/|[A-Za-z]:\\")
WORLD = 1 << 32
HIGH_DETAIL = 12
# a few world-grid units keep the poles inside the half-open tile grid.
SAFE_LAT = 85.0511287
SAFE_LON = 179.999999
TIP_FLAGS = ("-r1", "--no-feature-limit", "--no-tile-size-limit", "--buffer=0")


@dataclass(slots=True)
class Place:
    coords: tuple[float, float]
    world: tuple[float, float]
    props: dict

    def feature(self, props=None):
        return {"type": "Feature", "geometry": {"type": "Point", "coordinates": self.coords},
                "properties": self.props if props is None else props}


def osm_key(props, combined=False):
    if combined:
        key = props.get("id")
        if isinstance(key, str) and key[:1] in ("n", "w", "r") and RECORD_RE.fullmatch(key[1:]):
            return key
        raise ValueError("record without a valid OSM key")
    osm_type = props.get("osm_type")
    osm_id = props.get("osm_id")
    if osm_type not in OSM_TYPES or type(osm_id) is not int or not 0 < osm_id < (1 << 53):
        raise ValueError("record without a valid OSM key (osm_id must be an integer)")
    key = f"{OSM_TYPES[osm_type]}{osm_id}"
    if props.get("id", key) != key:
        raise ValueError("record whose id disagrees with its OSM key")
    return props.get("id", key)


def tile_coordinates(feature):
    lon, lat = feature["geometry"]["coordinates"]
    if (feature["type"] != "Feature" or feature["geometry"]["type"] != "Point"
            or not -180 <= lon <= 180 or not -90 <= lat <= 90):
        raise ValueError("unusable public point")
    lon = -180 if lon == 180 else lon
    return max(-SAFE_LON, min(SAFE_LON, lon)), max(-SAFE_LAT, min(SAFE_LAT, lat))


def read_places(path, seen):
    places = {}
    with path.open(encoding="utf-8") as source:
        for line in source:
            feature = json.loads(line)
            props = feature["properties"]
            key = osm_key(props)
            if key in seen or key in places:
                raise ValueError("repeated OSM key in the public edition")
            if not PUBLIC_REQUIRED <= props.keys() <= PUBLIC_REQUIRED | PUBLIC_OPTIONAL:
                raise ValueError("invalid public attribute set")
            if not all(isinstance(value, str) for attr, value in props.items() if attr != "osm_id"):
                raise ValueError("public attributes other than osm_id must be strings")
            if not CODE_RE.fullmatch(props["country_code"]) or not props["religion"]:
                raise ValueError("invalid country code or religion")
            # reuse the fixed field names and repeated categories across records.
            props = {sys.intern(attr): value for attr, value in props.items()}
            for attr in ("osm_type", "country_code", "religion", "denomination"):
                props[attr] = sys.intern(props[attr])
            coords = tile_coordinates(feature)
            places[key] = Place(coords, grid.mercator_px(*coords, 0, WORLD), props)
    return places


def bound_inputs(a, audit_pbf=False):
    paths = {name: a.edition / name for name in (*FILES.values(), "edition-stats.json")}
    paths["provenance"] = a.provenance
    hashes = {name: _sha256(path) for name, path in paths.items()}
    stats = read_json(paths["edition-stats.json"])
    if any(hashes[name] != stats["hashes"][name] for name in FILES.values()):
        raise ValueError("edition files differ from their extraction digests")
    source = provenance(a, stats)
    if source["source_kind"] == "planet":
        for key, attr in (("candidates_pbf", "pbf"), ("osm_iso_boundaries", "osm_boundaries")):
            path = getattr(a, attr, None)
            if path is None:
                raise ValueError("planet build requires --pbf and --osm-boundaries")
            digest = _sha256(path)
            if digest != stats["hashes"][key]:
                raise ValueError("candidate or boundary input differs from the extraction digest")
            hashes[key] = digest
        if audit_pbf:
            check_candidate_pbf(a.pbf)
    return hashes, stats


def check_candidate_pbf(path):
    latest = tool_version("osmium", "fileinfo", "-e", "-g", "data.timestamp.last", str(path))
    check_timestamp(datetime.fromisoformat(latest), "candidates PBF")


def check_private_membership(path, main, possible, stats):
    published = Counter()
    without, partial, missing, cyclic = {}, {}, {}, {}
    previous = (-1, 0)
    planet = stats["source"]["source_kind"] == "planet"
    with path.open(encoding="utf-8") as source:
        for line in source:
            feature = json.loads(line)
            props = feature["properties"]
            key = osm_key(props)
            order = ("nwr".index(key[0]), props["osm_id"])
            if order <= previous:
                raise ValueError("private edition keys repeat or are out of order")
            previous = order
            if planet:
                check_timestamp(datetime.fromisoformat(props["timestamp"]), key)
            basis, _ = classify(props["tags"])
            if basis is None or basis != props["basis"]:
                raise ValueError("private edition basis disagrees with raw tags")
            held = props.get("holds_tagged_place")
            if basis == "building" and type(held) is not bool:
                raise ValueError("private building lacks a Boolean withholding flag")
            geometry = feature["geometry"]
            if geometry is None:
                without.setdefault(basis, []).append(key)
            if props.get("missing_geometry_members"):
                missing.setdefault(basis, []).append(key)
                if geometry is not None:
                    partial.setdefault(basis, []).append(key)
            if props.get("cyclic_relation"):
                cyclic.setdefault(basis, []).append(key)
            if basis == "tag" and geometry is not None:
                record = main.get(key)
            elif basis == "building" and geometry is not None and not held:
                record = possible.get(key)
            else:
                continue
            if record is None:
                raise ValueError(f"public key sets disagree with private edition at {key}")
            if record.props != public_properties(props) or record.coords != tile_coordinates(feature):
                raise ValueError(f"public record disagrees with private edition at {key}")
            published[basis] += 1
    # membership and unique private keys make equality of counts sufficient for exact sets.
    if published["tag"] != len(main) or published["building"] != len(possible):
        raise ValueError("public key sets disagree with private edition")
    for key, expected in (("without_geometry", without), ("incomplete_geometry", partial),
                          ("missing_member_geometry", missing), ("cyclic_geometry", cyclic)):
        if stats[key] != expected:
            raise ValueError(f"{key} disagrees with private edition")


def input_sets(a, stats):
    main = read_places(a.edition / FILES["tag"], {})
    possible = read_places(a.edition / FILES["building"], main)
    if not main or any(len(records) != stats["published_by_basis"].get(basis, 0)
                       for basis, records in (("tag", main), ("building", possible))):
        raise ValueError("public record counts differ from extraction, or the main set is empty")
    check_private_membership(a.edition / FILES["edition"], main, possible, stats)
    return main, possible


def groups(places, zoom, cell_px):
    scale = grid.TILE_PX * (1 << zoom) / (WORLD * cell_px)
    cells = {}
    for key, place in places.items():
        x, y = place.world
        p = place.props
        cell = (int(x * scale), int(y * scale), p["religion"], p["denomination"], p["country_code"])
        if cell in cells:
            cells[cell][1] += 1
        else:
            cells[cell] = [key, 1]
    return cells.values()


def thin_properties(place, count, zoom):
    props = place.props
    if zoom < 7:
        attrs = (*grid.THIN_ATTRS, "id")
        props = grid.thinned_properties(props, props["religion"], props["denomination"], attrs, 1)
    return {**props, "n": count} if count > 1 else props


def write_zoom(places, zoom, cell_px, path):
    members = groups(places, zoom, cell_px)
    with path.open("w", encoding="utf-8") as out:
        for key, count in members:
            place = places[key]
            out.write(json_line(place.feature(thin_properties(place, count, zoom))))
    return len(members)


def country_counts(main):
    return dict(sorted(Counter(place.props["country_code"] for place in main.values()).items()))


def prepare(a):
    hashes, stats = bound_inputs(a, audit_pbf=True)
    main, possible = input_sets(a, stats)
    parts = a.work / "parts"
    parts.mkdir(parents=True, exist_ok=True)
    counts = country_counts(main)
    thin = {}
    for zoom, spec in grid.ZOOM_SPEC.items():
        thin[str(zoom)] = write_zoom(main, zoom, spec["cell_px"], parts / f"z{zoom}.ndjson")

    for layer, records in ((grid.PLACES_LAYER, main), (POSSIBLE_LAYER, possible)):
        with (parts / f"{layer}.ndjson").open("w", encoding="utf-8") as out:
            for place in records.values():
                out.write(json_line(place.feature()))

    # write bounded batches of country files to stay under the open-file limit.
    for start in range(0, len(counts), 64):
        with ExitStack() as stack:
            outputs = {cc: stack.enter_context((parts / f"ra-{cc}.ndjson").open("w", encoding="utf-8"))
                       for cc in list(counts)[start:start + 64]}
            for place in main.values():
                out = outputs.get(place.props["country_code"])
                if out is not None:
                    out.write(json_line(place.feature()))

    write_json(a.work / "thin-report.json", {"hashes": hashes, "by_country": counts, "kept": thin,
                                            "possible": len(possible)})
    print(f"thin: kept by zoom {thin}, {len(counts)} RA archives", flush=True)


def run(args, log):
    with log.open("w", encoding="utf-8") as out:
        result = subprocess.run(args, stdout=out, stderr=subprocess.STDOUT)
    if result.returncode:
        raise ValueError(f"{args[0]} failed with exit {result.returncode}. See {log}")


def tool_version(*args):
    result = subprocess.run(args, check=True, capture_output=True, text=True)
    return (result.stdout or result.stderr).splitlines()[0].strip()


def edition_names(snapshot, sample):
    return (grid.overview_name(snapshot, "samplegrid" if sample else "grid"),
            grid.places_name(snapshot, "samplegrid" if sample else "grid"),
            grid.places_name(snapshot, "samplepossible" if sample else "possible"))


def ra_name(snapshot, code, sample):
    return f"ra-dots-{code.lower()}-{snapshot}" + ("-sample" if sample else "")


def layout(snapshot, countries, has_possible, sample=False):
    overview_name, places_name, possible_name = edition_names(snapshot, sample)
    overview = {z: {grid.OVERVIEW_LAYER: "thin"} for z in grid.OVERVIEW_ZOOMS}
    places = {z: {grid.PLACES_LAYER: "thin"} for z in grid.PLACES_THIN_ZOOMS}
    places.update({z: {grid.PLACES_LAYER: "tag"} for z in HIGH_ZOOMS})
    archives = {overview_name: overview, places_name: places}
    if has_possible:
        archives[possible_name] = {z: {POSSIBLE_LAYER: "building"} for z in HIGH_ZOOMS}
    for code in countries:
        archives[ra_name(snapshot, code, sample)] = {z: {grid.OVERVIEW_LAYER: code} for z in RA_ZOOMS}
    return archives


def layer_metadata(zooms):
    fields = sorted(PUBLIC_REQUIRED | PUBLIC_OPTIONAL)
    result = []
    for layer in sorted({layer for layers in zooms.values() for layer in layers}):
        covered = [z for z in zooms if layer in zooms[z]]
        modes = {zooms[z][layer] for z in covered}
        attrs = dict.fromkeys(fields, "String")
        attrs["osm_id"] = "Number"
        if max(covered) < 7:
            attrs = dict.fromkeys((*grid.THIN_ATTRS, "id"), "String")
        if "thin" in modes:
            attrs["n"] = "Number"
        result.append({"id": layer, "minzoom": min(covered), "maxzoom": max(covered),
                       "description": "", "fields": attrs})
    return result


def mvt_tile(raw):
    from mapbox_vector_tile.Mapbox.vector_tile_pb2 import tile

    message = tile()
    message.ParseFromString(gzip.decompress(raw))
    return message


def point_geometry(feature):
    # a point is a single MoveTo command followed by two zigzag integers.
    if feature.type != 1 or len(feature.geometry) != 3 or feature.geometry[0] != 9:
        raise ValueError("expected one point per tile feature")
    return feature.geometry


def resolve_edge(feature, keys, values, records, z, x, y, extent):
    tags = iter(feature.tags)
    props = {keys[k]: values[v].ListFields()[0][1] for k, v in zip(tags, tags, strict=True)}
    place = records[osm_key(props, combined="osm_id" not in props)]
    units = extent * (1 << z)
    gx, gy = (coord * units / WORLD for coord in place.world)
    if (int(gx // extent), int(gy // extent)) != (x, y):
        return False
    # points can carry a second MoveTo coordinate across the world seam.
    # write the nearest integer coordinate in the owning tile in either case.
    px = min(extent - 1, max(0, round(gx - x * extent)))
    py = min(extent - 1, max(0, round(gy - y * extent)))
    feature.geometry[:] = [9, 2 * px, 2 * py]
    return True


def repair_edges(mbtiles, main, possible):
    repaired = 0
    with closing(sqlite3.connect(mbtiles)) as conn, conn:
        for z, x, row, raw in conn.execute("SELECT zoom_level, tile_column, tile_row, tile_data FROM tiles"):
            tile = mvt_tile(raw)
            changed = False
            y = (1 << z) - 1 - row
            for layer_index in reversed(range(len(tile.layers))):
                layer = tile.layers[layer_index]
                edge = 2 * layer.extent
                records = possible if layer.name == POSSIBLE_LAYER else main
                drop = []
                for index, feature in enumerate(layer.features):
                    geom = feature.geometry
                    if (feature.type == 1 and len(geom) == 3 and geom[0] == 9
                            and 0 < geom[1] < edge and 0 < geom[2] < edge
                            and not (geom[1] & 1 or geom[2] & 1)):
                        continue
                    if not resolve_edge(feature, layer.keys, layer.values, records, z, x, y, layer.extent):
                        drop.append(index)
                    repaired += 1
                    changed = True
                for index in reversed(drop):
                    del layer.features[index]
                if not layer.features:
                    del tile.layers[layer_index]
            if changed:
                if tile.layers:
                    conn.execute("UPDATE tiles SET tile_data = ? WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?",
                                 (gzip.compress(tile.SerializeToString(), mtime=0), z, x, row))
                else:
                    conn.execute("DELETE FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?", (z, x, row))
    return repaired


def zigzag(value):
    return (value >> 1) ^ -(value & 1)


def metadata(mbtiles, name, zooms, tip_version):
    with closing(sqlite3.connect(mbtiles)) as conn:
        prior = dict(conn.execute("SELECT name, value FROM metadata"))
    bounds = [float(coord) for coord in prior["bounds"].split(",")]
    for axis, limit in enumerate((180, grid.MAX_LAT)):
        if bounds[axis] == bounds[axis + 2]:
            # the converter requires an area even for a one-point country.
            bounds[axis] = max(-limit, bounds[axis] - 0.00001)
            bounds[axis + 2] = min(limit, bounds[axis + 2] + 0.00001)
    meta = {"bounds": ",".join(f"{coord:.8f}" for coord in bounds), "center": prior["center"]}
    meta.update(name=name, description="OpenStreetMap places of worship edition", version="2",
                type="overlay", format="pbf", minzoom=str(min(zooms)), maxzoom=str(max(zooms)),
                generator=tip_version, attribution="© OpenStreetMap contributors",
                json=json_line({"vector_layers": layer_metadata(zooms)}).strip())
    replace_metadata(mbtiles, meta)


def join_zoom_parts(destination, paths):
    # these inputs cover disjoint zooms, so sqlite can preserve their tile bytes.
    destination.unlink(missing_ok=True)
    with closing(sqlite3.connect(destination.resolve().as_uri(), uri=True)) as conn, conn:
        conn.executescript(
            "PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF;"
            "CREATE TABLE tiles (zoom_level INTEGER, tile_column INTEGER, tile_row INTEGER, tile_data BLOB);"
            "CREATE TABLE metadata (name TEXT, value TEXT);")
        for path in paths:
            conn.execute("ATTACH DATABASE ? AS part", (path.resolve().as_uri() + "?mode=ro",))
            conn.execute("INSERT INTO tiles SELECT * FROM part.tiles")
            if path == paths[-1]:
                conn.execute("INSERT INTO metadata SELECT * FROM part.metadata")
            conn.commit()
            conn.execute("DETACH DATABASE part")
        conn.execute("CREATE UNIQUE INDEX tile_index ON tiles (zoom_level, tile_column, tile_row)")


def build(a):
    hashes, stats = bound_inputs(a, audit_pbf=True)
    thin = read_json(a.work / "thin-report.json")
    if hashes != thin["hashes"]:
        raise ValueError("edition inputs changed after thinning")
    out, parts, logs, tmp = (a.work / name for name in ("out", "parts", "logs", "tmp"))
    for folder in (out, logs, tmp):
        folder.mkdir(parents=True, exist_ok=True)
    tip_version = tool_version("tippecanoe", "--version").removeprefix("tippecanoe ")
    pm_version = tool_version("pmtiles", "version").removeprefix("pmtiles ").split(",")[0].strip()
    check_versions({"tippecanoe": tip_version, "pmtiles_cli": pm_version}, VERSION_FIELDS)
    sample = stats["source"]["source_kind"] == "sample"
    possible_name = edition_names(a.snapshot, sample)[2]
    plans = layout(a.snapshot, thin["by_country"], bool(thin["possible"]), sample)

    def tip(name, low, high, detail, layers):
        target = parts / f"{name}.mbtiles"
        cmd = ["tippecanoe", f"-Z{low}", f"-z{high}", f"-d{detail}", f"-D{detail}", f"-m{detail}",
               *TIP_FLAGS, "--force", "--temporary-directory", str(tmp), "-o", str(target)]
        for layer, input_file in layers.items():
            cmd.extend(("-L", f"{layer}:{parts / input_file}"))
        run(cmd, logs / f"tip-{name}.log")
        return target

    zoom_parts, cells = {}, {}
    main = None
    for z, spec in grid.ZOOM_SPEC.items():
        layer = grid.OVERVIEW_LAYER if z in grid.OVERVIEW_ZOOMS else grid.PLACES_LAYER
        cell_px = spec["cell_px"]
        input_file = f"z{z}.ndjson"
        while True:
            part = tip(f"z{z}", z, z, spec["detail"], {layer: input_file})
            with closing(sqlite3.connect(part)) as conn:
                maximum = conn.execute("SELECT max(length(tile_data)) FROM tiles").fetchone()[0]
            cap = grid.TILE_CAP_BYTES[spec["tier"]]
            if maximum <= cap:
                break
            cell_px *= 2
            if cell_px > grid.TILE_PX * (1 << z):
                raise ValueError(f"z{z}: cannot meet the tile byte cap at world-sized grid cells")
            if main is None:
                main = read_places(a.edition / FILES["tag"], {})
            input_file = f"z{z}-retry.ndjson"
            kept = write_zoom(main, z, cell_px, parts / input_file)
            print(f"build: z{z} exceeded {cap:,} bytes, retry with {cell_px}px cells and {kept:,} representatives",
                  flush=True)
        zoom_parts[z] = part
        cells[str(z)] = cell_px
    high = tip("high", min(HIGH_ZOOMS), max(HIGH_ZOOMS), HIGH_DETAIL,
               {grid.PLACES_LAYER: f"{grid.PLACES_LAYER}.ndjson"})

    mbtiles_by_name = {}
    for name, plan in plans.items():
        if name.startswith("ra-dots-"):
            cc = plan[min(plan)][grid.OVERVIEW_LAYER]
            inputs = [tip(f"ra-source-{cc}", min(plan), max(plan), HIGH_DETAIL,
                          {grid.OVERVIEW_LAYER: f"ra-{cc}.ndjson"})]
        elif name == possible_name:
            inputs = [tip("possible", min(HIGH_ZOOMS), max(HIGH_ZOOMS), HIGH_DETAIL,
                          {POSSIBLE_LAYER: f"{POSSIBLE_LAYER}.ndjson"})]
        else:
            inputs = [zoom_parts[z] for z in plan if z in zoom_parts]
            if max(plan) in HIGH_ZOOMS:
                inputs.append(high)
        mbtiles = parts / f"{name}.mbtiles"
        join_zoom_parts(mbtiles, inputs)
        mbtiles_by_name[name] = mbtiles

    main = main if main is not None else read_places(a.edition / FILES["tag"], {})
    possible = read_places(a.edition / FILES["building"], main)
    repairs = {name: repair_edges(mbtiles, main, possible) for name, mbtiles in mbtiles_by_name.items()}
    del main, possible
    for name, mbtiles in mbtiles_by_name.items():
        metadata(mbtiles, name, plans[name], f"tippecanoe {tip_version}")
        archive = out / f"{name}.pmtiles"
        pending = tmp / archive.name
        pending.unlink(missing_ok=True)
        run(["pmtiles", "convert", str(mbtiles), str(pending), f"--tmpdir={tmp}"],
            logs / f"convert-{name}.log")
        pending.replace(archive)
    write_json(a.work / "build-info.json", {"hashes": hashes, "snapshot": a.snapshot,
                                           "cell_px": cells, "repairs": repairs, "software_versions": {"tippecanoe": tip_version, "pmtiles_cli": pm_version}})
    print(f"build: converted {len(plans)} PMTiles archives", flush=True)


def public_religions(counts):
    common = {key: value for key, value in counts.items() if key in PUBLIC_RELIGIONS}
    common["other"] = sum(counts.values()) - sum(common.values())
    return common


def composition(places):
    return Counter(place.props["religion"] for place in places.values())


def check_point(geometry, place, z, x, y, extent):
    px, py = zigzag(geometry[1]), zigzag(geometry[2])
    if not 0 <= px < extent or not 0 <= py < extent:
        raise ValueError(f"z{z}: point outside its tile proper")
    units = extent * (1 << z)
    ex, ey = (coord * units / WORLD for coord in place.world)
    if (int(ex // extent), int(ey // extent)) != (x, y):
        raise ValueError(f"z{z}: point is in the wrong owning tile")
    if abs(x * extent + px - ex) > 1.01 or abs(y * extent + py - ey) > 1.01:
        raise ValueError(f"z{z}: point is displaced from the edition centre")


def scan_archive(path, plan, main, possible, by_country, cells):
    from pmtiles.reader import MmapSource, Reader, all_tiles
    from pmtiles.tile import Compression, TileType

    with path.open("rb") as source:
        reader = Reader(MmapSource(source))
        header, meta = reader.header(), reader.metadata()
    if header["tile_type"] != TileType.MVT or header["tile_compression"] != Compression.GZIP:
        raise ValueError(f"{path.name}: PMTiles header must declare MVT and gzip")
    if (header["min_zoom"], header["max_zoom"]) != (min(plan), max(plan)):
        raise ValueError(f"{path.name}: incorrect zoom bounds")
    if meta.get("vector_layers") != layer_metadata(plan):
        raise ValueError(f"{path.name}: incorrect layer metadata")
    if set(meta) - {"name", "description", "version", "type", "format", "minzoom", "maxzoom",
                    "bounds", "center", "generator", "attribution", "vector_layers"}:
        raise ValueError(f"{path.name}: unexpected archive metadata")

    def init_zoom(z):
        modes = plan[z]
        tally = {layer: {"features": 0, "represented": 0, "by_religion": Counter(),
                         "by_country": Counter(), "keys": set()} for layer in modes}
        counted = {key: n for key, n in groups(main, z, cells[str(z)])} if "thin" in modes.values() else {}
        return tally, counted

    def finish_zoom(z, tallies, counted, tiles, maximum):
        details = {}
        for layer, mode in plan[z].items():
            seen = tallies[layer]
            expected = (len(counted) if mode == "thin" else len(main) if mode == "tag" else
                        len(possible) if mode == "building" else by_country[mode])
            if seen["features"] != expected:
                raise ValueError(f"{path.name} z{z} {layer}: {seen['features']} points, expected {expected}")
            if mode == "thin":
                if seen["represented"] != len(main) or seen["by_religion"] != religion:
                    raise ValueError(f"{path.name} z{z}: represented counts disagree with the main set")
                if seen["by_country"] != by_country:
                    raise ValueError(f"{path.name} z{z}: represented country counts disagree with the main set")
            details[layer] = {"features": expected}
            if mode != "building":
                details[layer].update(represented=seen["represented"],
                                      by_religion=public_religions(seen["by_religion"]))
        if "thin" in plan[z].values():
            cap = grid.TILE_CAP_BYTES[grid.ZOOM_SPEC[z]["tier"]]
            if maximum > cap:
                raise ValueError(f"{path.name} z{z}: {maximum} stored bytes exceeds the {cap} byte cap")
        return {"tiles": tiles, "largest_tile_bytes": maximum, "layers": details}

    religion = composition(main) if min(plan) in (0, 6) else None
    report = {}
    expected_zooms = iter(plan)
    current = next(expected_zooms)
    tallies, counted = init_zoom(current)
    max_size, tile_count = 0, 0
    addresses = set()
    with path.open("rb") as source:
        for (z, x, y), raw in all_tiles(MmapSource(source)):
            if z != current:
                report[str(current)] = finish_zoom(current, tallies, counted, tile_count, max_size)
                current = next(expected_zooms, None)
                if z != current:
                    raise ValueError(f"{path.name}: unexpected or missing zoom at z{z}")
                del tallies, counted
                tallies, counted = init_zoom(current)
                max_size, tile_count = 0, 0
                addresses.clear()
            address = (x << z) | y
            if address in addresses:
                raise ValueError(f"{path.name}: repeated tile address {z}/{x}/{y}")
            addresses.add(address)
            max_size = max(max_size, len(raw))
            tile_count += 1
            layers = mvt_tile(raw).layers
            names = {layer.name for layer in layers}
            if len(layers) != len(names) or names != plan[z].keys():
                raise ValueError(f"{path.name} z{z}: unexpected tile layer")
            for data in layers:
                layer = data.name
                mode = plan[z][layer]
                seen = tallies[layer]
                expected_extent = 1 << (grid.ZOOM_SPEC[z]["detail"] if mode == "thin" else HIGH_DETAIL)
                if data.extent != expected_extent:
                    raise ValueError(f"{path.name} z{z}: incorrect tile extent")
                if not data.features:
                    raise ValueError(f"{path.name} z{z}: empty tile layer")
                values = [value.ListFields()[0][1] for value in data.values]
                for feature in data.features:
                    tags = iter(feature.tags)
                    actual = {data.keys[k]: values[v] for k, v in zip(tags, tags, strict=True)}
                    key = osm_key(actual, combined=mode == "thin" and z < 7)
                    records = possible if mode == "building" else main
                    place = records.get(key)
                    if place is None:
                        raise ValueError(f"{path.name} z{z}: unexpected OSM key in {layer}")
                    if key in seen["keys"]:
                        raise ValueError(f"{path.name} z{z}: repeated OSM key in {layer}")
                    seen["keys"].add(key)
                    code = place.props["country_code"]
                    count, props = 1, place.props
                    if mode == "thin":
                        count = counted.get(key)
                        if count is None:
                            raise ValueError(f"{path.name} z{z}: unexpected representative OSM key")
                        props = thin_properties(place, count, z)
                    elif mode not in ("tag", "building") and code != mode:
                        raise ValueError(f"{path.name} z{z}: point is routed to the wrong RA archive")
                    if actual != props:
                        raise ValueError(f"{path.name} z{z}: wrong feature attributes")
                    check_point(point_geometry(feature), place, z, x, y, data.extent)
                    seen["features"] += 1
                    if mode != "building":
                        seen["represented"] += count
                        seen["by_religion"][place.props["religion"]] += count
                        seen["by_country"][code] += count
    report[str(current)] = finish_zoom(current, tallies, counted, tile_count, max_size)
    if next(expected_zooms, None) is not None:
        raise ValueError(f"{path.name}: missing zooms")
    return report


def check_versions(versions, permitted):
    if not isinstance(versions, dict) or set(versions) - permitted:
        raise ValueError("invalid tool name in provenance")
    for key, value in versions.items():
        if not isinstance(value, str):
            raise ValueError("invalid tool version format in provenance")
        if key == "pmtiles_cli_package":
            check_release_version(value, key)
            continue
        if key == "osmium_cli":
            valid = re.fullmatch(r"v?[0-9]+\.[0-9]+\.[0-9]+", value)
        else:
            valid = VERSION.fullmatch(value) or (key == "pmtiles_cli" and value == "dev")
        if not valid:
            raise ValueError("invalid tool version format in provenance")


def check_public_record(value):
    if isinstance(value, dict):
        for key, child in value.items():
            if PRIVATE_KEY.fullmatch(key):
                raise ValueError("public record contains a private identity field")
            check_public_record(key)
            check_public_record(child)
    elif isinstance(value, (list, tuple)):
        for item in value:
            check_public_record(item)
    elif isinstance(value, str) and (LEAK.search(value) or PRIVATE_PATH.search(value)):
        raise ValueError("public record contains a private path or identity")


def provenance(a, stats):
    p = read_json(a.provenance)
    common = {"source_kind", "edition_timestamp", "filter_rules", "boundary_source",
              "boundary_version", "tool_versions"}
    source = edition_source(p)
    if source != stats["source"]:
        raise ValueError("provenance source or timestamp differs from the extraction")
    fields = {"planet_file", "planet_md5", "change_sequences", "input_sha256"} if p["source_kind"] == "planet" else {"sample_source"}
    if set(p) - {"pmtiles_package_release"} != common | fields:
        raise ValueError("invalid edition provenance fields")
    if "pmtiles_package_release" in p:
        check_release_version(p["pmtiles_package_release"], "pmtiles_package_release")
    check_release_version(p["boundary_version"], "boundary_version")
    check_versions(p["tool_versions"], {"osmium_cli"})
    if (p["filter_rules"] != stats["filter_rules"] or p["filter_rules"] != FILTER_RULES
            or p["boundary_version"] != stats["boundary"]["version"]):
        raise ValueError("provenance filter or boundary version differs from the extraction")
    if p["boundary_source"] != "Natural Earth 1:10m":
        raise ValueError("boundary source must identify Natural Earth 1:10m")
    if p["source_kind"] == "planet":
        seq = p["change_sequences"]
        if (not FILE_RE.fullmatch(p["planet_file"]) or not re.fullmatch(r"[a-f0-9]{32}", p["planet_md5"])
                or not seq or any(type(n) is not int or n < 1 for n in seq)
                or any(right != left + 1 for left, right in zip(seq, seq[1:]))
                or p["edition_timestamp"][:10].replace("-", "") != a.snapshot
                or "osmium_cli" not in p["tool_versions"]):
            raise ValueError("invalid planet filename, checksum, change sequences, snapshot or tool versions")
        check_reconstruction(p, stats["hashes"])
    elif not isinstance(p["sample_source"], str) or not re.fullmatch(r"[A-Za-z0-9_.-]+\.osm\.pbf", p["sample_source"]):
        raise ValueError("invalid sample filename")
    # sample filenames can contain local identifiers and are unnecessary in a public record.
    p.pop("sample_source", None)
    boundary = stats["boundary"]["osm"]
    return {**p, "osm_boundaries": {
        "source": "OpenStreetMap",
        "sha256": boundary["sha256"],
        "feature_count": boundary["feature_count"],
        "iso_feature_count": boundary["iso_feature_count"],
        "usable_feature_count": boundary["usable_feature_count"],
    }}


def summary(stats, main, possible):
    by_country = country_counts(main)
    july = read_json(JULY_STATS)["by_country"]
    return {
        "edition_candidates_by_basis": stats["by_basis"],
        "edition_candidates_by_type": stats["by_object_type"],
        "edition_candidates_by_country_and_basis": stats["by_country_and_basis"],
        "edition_candidates_by_country_method": stats["by_country_method"],
        "without_geometry_by_basis": {basis: len(ids) for basis, ids in stats["without_geometry"].items()},
        "incomplete_geometry_by_basis": {basis: len(ids) for basis, ids in stats["incomplete_geometry"].items()},
        "missing_member_geometry_by_basis": {basis: len(ids) for basis, ids in stats["missing_member_geometry"].items()},
        "cyclic_geometry_by_basis": {basis: len(ids) for basis, ids in stats["cyclic_geometry"].items()},
        "main": {"total": len(main), "by_country": by_country, "by_religion": public_religions(composition(main))},
        "possible_layer_features": len(possible),
        "possible_by_country": country_counts(possible),
        "country_comparison": {
            "july_codes": len(july), "edition_codes": len(by_country),
            "retained_codes": len(by_country.keys() & july.keys()),
            "gained": {cc: by_country[cc] for cc in by_country.keys() - july.keys()},
            "lost": {cc: july[cc] for cc in july.keys() - by_country.keys()},
            "unassigned_code": UNKNOWN_COUNTRY,
        },
        "boundary_comparison": stats["boundary_comparison"],
        "osm_boundary": stats["boundary"]["osm"],
        "osm_overlaps": stats["osm_overlaps"],
        "buildings_withheld": stats["buildings_withheld"],
        "extract_hashes": stats["hashes"],
    }


def validate(a):
    import platform

    hashes, stats = bound_inputs(a, audit_pbf=True)
    edition_provenance = provenance(a, stats)
    info = read_json(a.work / "build-info.json")
    if info["hashes"] != hashes or info["snapshot"] != a.snapshot:
        raise ValueError("build and validation inputs differ")
    main, possible = input_sets(a, stats)
    inputs = summary(stats, main, possible)
    by_country = inputs["main"]["by_country"]
    sample = edition_provenance["source_kind"] == "sample"
    names = layout(a.snapshot, by_country, bool(possible), sample)
    files = {}
    for name, plan in names.items():
        path = a.work / "out" / f"{name}.pmtiles"
        digest = _sha256(path)
        zooms = scan_archive(path, plan, main, possible, by_country, info["cell_px"])
        if digest != _sha256(path):
            raise ValueError(f"{name}: archive changed during validation")
        files[name] = {"sha256": digest, "bytes": path.stat().st_size, "zooms": zooms,
                       "edge_features_processed": info["repairs"][name]}
        print(f"validate: {name}, z{min(plan)}-{max(plan)}", flush=True)
    if hashes != bound_inputs(a)[0]:
        raise ValueError("edition inputs changed during validation")

    tools = {**edition_provenance["tool_versions"], **stats["software_versions"], **info["software_versions"],
             "validation_python": platform.python_version(),
             **{package: version(package) for package in ("mapbox-vector-tile", "pmtiles", "jsonschema")}}
    if "pmtiles_package_release" in edition_provenance:
        tools["pmtiles_cli_package"] = edition_provenance["pmtiles_package_release"]
    check_versions(tools, VERSION_FIELDS)
    report = {
        "status": "passed", "snapshot": a.snapshot, "sample_only": sample, "provenance": edition_provenance,
        "boundary": stats["boundary"],
        "software_versions": tools, "inputs": inputs, "archives": files, "grid_cell_css_pixels": info["cell_px"],
    }
    check_edition_records({"validation-report": report})
    report_path = a.work / "validation-report.json"
    write_json(report_path, report)
    write_json(a.work / "validation-receipt.json", {"inputs": hashes, "report_sha256": _sha256(report_path)})


def check_edition_records(documents):
    import jsonschema

    definitions = read_json(REPORT_SCHEMA)["$defs"]
    for kind, document in documents.items():
        jsonschema.Draft202012Validator({"$ref": f"#/$defs/{kind}", "$defs": definitions}).validate(document)
        check_public_record(document)


def country_counts_from_ndjson(path):
    with path.open(encoding="utf-8") as source:
        return Counter(json.loads(line)["properties"]["country_code"] for line in source)


def manifest_records(a):
    import jsonschema

    hashes, stats = bound_inputs(a)
    report_path = a.work / "validation-report.json"
    report = read_json(report_path)
    receipt = read_json(a.work / "validation-receipt.json")
    if (report["status"] != "passed" or report["snapshot"] != a.snapshot
            or receipt != {"inputs": hashes, "report_sha256": _sha256(report_path)}):
        raise ValueError("edition inputs changed after validation")
    # earlier sample reports retained the basename. the receipt binds the original input file.
    report["provenance"].pop("sample_source", None)
    if report["provenance"] != provenance(a, stats) or report["boundary"] != stats["boundary"]:
        raise ValueError("edition provenance differs from the validation report")
    release = getattr(a, "pmtiles_package_release", None)
    if release is not None:
        check_release_version(release, "pmtiles_package_release")
        recorded = report["provenance"].get("pmtiles_package_release", release)
        if recorded != release:
            raise ValueError("PMTiles package release differs from the validation record")
        report["provenance"]["pmtiles_package_release"] = release
        report["software_versions"]["pmtiles_cli_package"] = release
    check_versions(report["software_versions"], VERSION_FIELDS)
    tracked = Path(__file__).resolve().parent / "manifests"
    if report["provenance"]["source_kind"] == "sample" and a.manifest_dir.resolve().is_relative_to(tracked):
        raise ValueError("sample manifests require a work directory outside the tracked manifest directory")
    for name, record in report["archives"].items():
        if _sha256(a.work / "out" / f"{name}.pmtiles") != record["sha256"]:
            raise ValueError(f"{name}: archive changed after validation")

    inputs = report["inputs"]
    by_country = country_counts_from_ndjson(a.edition / FILES["tag"])
    possible_by_country = country_counts_from_ndjson(a.edition / FILES["building"])
    if by_country != inputs["main"]["by_country"] or sum(by_country.values()) != inputs["main"]["total"]:
        raise ValueError("published main countries disagree with validation")
    if (sum(possible_by_country.values()) != inputs["possible_layer_features"]
            or possible_by_country != inputs.get("possible_by_country", possible_by_country)):
        raise ValueError("published extras countries disagree with validation")
    inputs["possible_by_country"] = dict(possible_by_country)
    sample = report["sample_only"]
    archive_stats = report["archives"]
    if set(archive_stats) != set(layout(a.snapshot, by_country, bool(possible_by_country), sample)):
        raise ValueError("validated archive names disagree with the published country coverage")
    overview, places, possible = edition_names(a.snapshot, sample)

    def make_manifest(dataset, counts, countries):
        archives = {name: archive_stats[name] for name in counts}
        snapshot_date = report["provenance"]["edition_timestamp"][:10]
        scope = {"level": "global", "snapshot_date": snapshot_date, "pipeline_stage": "staged",
                 "country_codes": sorted(countries)}
        missing = report["inputs"]["without_geometry_by_basis"]
        warnings = [f"{missing[basis]} {basis} candidates have no usable geometry and remain in the private edition."
                    for basis in ("tag", "building") if missing.get(basis)]
        parameters = {
            "provenance": report["provenance"], "boundary": report["boundary"],
            "sample_only": report["sample_only"],
            "tagged_neighbour_buffer_metres": report["inputs"]["buildings_withheld"]["buffer_metres"],
            "input_sha256": report["inputs"]["extract_hashes"],
            "archive_names": list(archives), "tippecanoe_flags": list(TIP_FLAGS),
            "grid_cell_css_pixels": report["grid_cell_css_pixels"], "tile_detail_high_and_ra": HIGH_DETAIL,
            "tile_detail_thin": {str(z): s["detail"] for z, s in grid.ZOOM_SPEC.items()},
            "tile_caps_bytes": grid.TILE_CAP_BYTES,
        }
        files = [{
            "uri": f"build-cache:{name}.pmtiles", "storage_provider": "other", "format": "pmtiles",
            "bytes": record["bytes"], "sha256": record["sha256"], "feature_count": counts[name],
            "notes": "Validated build output. Archive availability is recorded separately.",
        } for name, record in archives.items()]
        identity = {"scope": scope, "parameters": parameters, "files": files, "hashes": hashes,
                    "software_versions": report["software_versions"]}
        ident = hashlib.sha256(json_line(identity).encode("utf-8")).hexdigest()
        return {
            "$schema": "../../../schemas/data-manifest.schema.json", "schema_version": "data-manifest.v2",
            "manifest_id": f"manifest:{dataset}-{ident[:12]}", "dataset_id": dataset,
            "dataset_version_id": f"{dataset}:{ident[:16]}", "dataset_family": "places-tiles",
            "dataset_role": "public_product",
            "scope": scope,
            "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "created_by": "Places of Worship project",
            "source": {"provider": "OpenStreetMap and Natural Earth", "licence": "ODbL 1.0 (OpenStreetMap)"},
            "pipeline": {
                "script": "tools/tiles-r2/build_osm_edition.py", "git_commit": a.git_commit,
                "command": "python tools/tiles-r2/build_osm_edition.py all --edition <edition> --work <work> --provenance <provenance.json> --pbf <candidates.pbf> "
                           "--osm-boundaries <osm.geojsonseq> --snapshot <yyyymmdd>",
                "parameters": parameters, "software_versions": report["software_versions"],
            },
            "durable_files": files,
            "stats": {"main_features": 0 if dataset == possible else sum(counts.values()),
                      "possible_layer_features": sum(counts.values()) if dataset == possible else 0},
            "validation": {"status": "passed", "warnings": warnings,
                           "notes": f"validation-report-osm-edition-{a.snapshot}.json"},
            "privacy": "public", "licence_status": "needs_review", "downstream_status": "staged",
        }

    schema = read_json(SCHEMA)
    validator = jsonschema.Draft202012Validator(schema, format_checker=jsonschema.FormatChecker())
    ra_counts = {ra_name(a.snapshot, cc, sample): by_country[cc] for cc in sorted(by_country)}
    archives = [(overview, {overview: inputs["main"]["total"]}, by_country),
                (places, {places: inputs["main"]["total"]}, by_country),
                (f"ra-dots-{a.snapshot}" + ("-sample" if sample else ""), ra_counts, by_country)]
    if possible in archive_stats:
        archives.append((possible, {possible: inputs["possible_layer_features"]}, possible_by_country))
    records = {}
    for dataset, counts, countries in archives:
        doc = make_manifest(dataset, counts, countries)
        validator.validate(doc)
        records[f"{dataset}.manifest.json"] = doc

    reports = {"input-stats": inputs, "validation-report": report}
    check_edition_records(reports)
    for kind, document in reports.items():
        records[f"{kind}-osm-edition-{a.snapshot}.json"] = document
    check_public_record(records)
    return records


def manifest(a):
    records = manifest_records(a)
    a.manifest_dir.mkdir(parents=True, exist_ok=True)
    for filename, document in records.items():
        write_json(a.manifest_dir / filename, document)
    print(f"manifest: validated and wrote {len(records)} aggregate records", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("stage", choices=("thin", "build", "validate", "manifest", "all"))
    parser.add_argument("--edition", type=Path, required=True)
    parser.add_argument("--work", type=Path, required=True)
    parser.add_argument("--snapshot", required=True)
    parser.add_argument("--provenance", type=Path, required=True)
    parser.add_argument("--pbf", type=Path, help="candidate PBF required for planet builds")
    parser.add_argument("--osm-boundaries", type=Path, help="OSM boundaries required for planet builds")
    parser.add_argument("--manifest-dir", type=Path,
                        default=Path(__file__).parent / "manifests")
    parser.add_argument("--git-commit")
    parser.add_argument("--pmtiles-package-release", help="installed PMTiles converter release for manifest provenance")
    a = parser.parse_args()
    if a.pmtiles_package_release is not None and a.stage not in ("manifest", "all"):
        parser.error("--pmtiles-package-release applies to manifest generation")
    try:
        if not re.fullmatch(r"[0-9]{8}", a.snapshot):
            raise ValueError("snapshot must be yyyymmdd")
        datetime.strptime(a.snapshot, "%Y%m%d")
        stages = {"thin": prepare, "build": build, "validate": validate, "manifest": manifest}
        for name, stage in stages.items():
            if a.stage in (name, "all"):
                stage(a)
    except (ValueError, OSError) as error:
        sys.exit(f"{a.stage}: {error}")


if __name__ == "__main__":
    main()
