"""Extract a sorted OSM candidate PBF into private and public edition records."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
from array import array
from collections import Counter, defaultdict
from contextlib import ExitStack
from dataclasses import dataclass
from datetime import datetime, timezone
from itertools import combinations
from pathlib import Path
from tempfile import TemporaryFile

from build_tiles_v2 import _sha256

OSM_TYPES = {"node": "n", "way": "w", "relation": "r"}
BUILDINGS = frozenset({"church", "mosque", "temple", "synagogue", "chapel"})
LIFECYCLE = tuple(f"{prefix}:amenity" for prefix in
                  ("disused", "abandoned", "was", "demolished", "removed", "razed", "ruins"))
WORSHIP = "place_of_worship"
FILTER_RULES = {
    "tag": [f"amenity={WORSHIP}"],
    "building": [f"building={value}" for value in sorted(BUILDINGS)],
    "lifecycle": [f"{key}={WORSHIP}" for key in LIFECYCLE],
}
PUBLIC_REQUIRED = frozenset({"id", "osm_id", "osm_type", "name", "religion",
                             "denomination", "country_code"})
PUBLIC_OPTIONAL = frozenset({"name_en", "start_date"})
FILES = {"edition": "edition.ndjson", "tag": "places.ndjson", "building": "places-possible.ndjson"}
UNKNOWN_COUNTRY = "ZZ"
BOUNDARY_NAME = "ne_10m_admin_0_map_units"
BOUNDARY_CHOICES = ("ne_10m_admin_0_countries", BOUNDARY_NAME)
JULY_STATS = Path(__file__).parent / "manifests/input-stats-tiles-v2-20260722-0ce3c532af1e.json"
EDITION_TIMESTAMP = "2026-09-01T00:00:00Z"
EDITION_CUTOFF = datetime.fromisoformat(EDITION_TIMESTAMP)
SOURCE_DIGESTS = ("candidates_pbf", "osm_iso_boundaries")
SHA256_RE = re.compile(r"[a-f0-9]{64}")
NEAREST_KM = 25
TAGGED_BUFFER_M = 10
ISO_CODE = re.compile(r"[A-Z]{2}")
ISO_TAGS = ("ISO3166-1", "ISO3166-1:alpha2")
# osmium export emits literal tag names; avoid decoding the other features.
ISO_LINE = re.compile(rb'"ISO3166-1(?::alpha2)?"\s*:\s*"[A-Z]{2}"')
KM_PER_DEGREE = math.pi * 6371.0088 / 180


def json_line(data):
    return json.dumps(data, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False) + "\n"


def write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, sort_keys=True, indent=2, allow_nan=False) + "\n",
                    encoding="utf-8")


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def check_release_version(value, field):
    if not isinstance(value, str) or not re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+", value):
        raise ValueError(f"{field} must be a numeric release version")


def edition_source(provenance):
    kind = provenance.get("source_kind")
    stamp = provenance.get("edition_timestamp")
    if kind not in ("planet", "sample"):
        raise ValueError("invalid edition source kind")
    if not isinstance(stamp, str):
        raise ValueError("missing edition timestamp")
    datetime.strptime(stamp, "%Y-%m-%dT%H:%M:%SZ")
    if kind == "planet":
        if stamp != EDITION_TIMESTAMP:
            raise ValueError(f"planet edition timestamp must equal {EDITION_TIMESTAMP}")
        hashes = provenance.get("input_sha256")
        if (not isinstance(hashes, dict) or set(hashes) != set(SOURCE_DIGESTS)
                or any(not isinstance(value, str) or not SHA256_RE.fullmatch(value) for value in hashes.values())):
            raise ValueError("planet provenance requires both reconstruction SHA-256 digests")
    return {"source_kind": kind, "edition_timestamp": stamp}


def check_reconstruction(provenance, hashes):
    if provenance["source_kind"] == "planet" and any(
        hashes[key] != provenance["input_sha256"][key] for key in SOURCE_DIGESTS
    ):
        raise ValueError("candidate or boundary digest differs from the reconstruction record")


def check_timestamp(timestamp, key):
    # pyosmium timestamps are UTC; normalise a naive timestamp from older versions.
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=timezone.utc)
    if timestamp > EDITION_CUTOFF:
        raise ValueError(f"{key}: object timestamp is after the planet cutoff")


def classify(tags):
    former = any(key in tags for key in LIFECYCLE)
    if tags.get("amenity") == WORSHIP:
        return "tag", former
    if tags.get("building") in BUILDINGS:
        return "building", former
    if any(tags.get(key) == WORSHIP for key in LIFECYCLE):
        return "lifecycle", former
    return None, former


def public_properties(props):
    tags = props["tags"]
    result = {key: props[key] for key in ("id", "osm_id", "osm_type", "country_code")}
    result.update(
        name=tags.get("name") or tags.get("official_name") or "",
        religion=tags.get("religion") or "unknown",
        denomination=tags.get("denomination") or "",
    )
    for tag, key in (("name:en", "name_en"), ("start_date", "start_date")):
        if tag in tags:
            result[key] = tags[tag]
    return result


def iso_code(record):
    if record["ADM0_A3"] == "UMI":
        return "UM"
    # the equivalency field also resolves qualified codes such as CN-TW and FR-973.
    for field in ("ISO_A2_EH", "ISO_A2"):
        code = record[field]
        if re.fullmatch(r"[A-Z]{2}", code) and code != "XD":
            return code
    return UNKNOWN_COUNTRY


def boundary_path(root, name):
    return root / name / f"{name}.shp"


def boundary_comparison(root, previous):
    import shapefile

    result = {}
    for name in BOUNDARY_CHOICES:
        with shapefile.Reader(str(boundary_path(root, name))) as reader:
            codes = Counter(iso_code(record) for record in reader.iterRecords())
        available = set(codes) - {UNKNOWN_COUNTRY}
        result[name] = {
            "matches": len(available & previous.keys()),
            "additional_boundary_codes": {cc: codes[cc] for cc in available - previous.keys()},
            "missing_july_codes": {cc: previous[cc] for cc in previous.keys() - available},
            "unassigned_boundary_records": codes[UNKNOWN_COUNTRY],
        }
    return result


def polygon_parts(geometry):
    if geometry.geom_type == "Polygon" and not geometry.is_empty:
        yield geometry
    elif hasattr(geometry, "geoms"):
        for part in geometry.geoms:
            yield from polygon_parts(part)


def check_polygon_seams(geometry, code):
    import numpy as np
    from shapely import get_coordinates

    for polygon in polygon_parts(geometry):
        for ring in (polygon.exterior, *polygon.interiors):
            if np.any(np.abs(np.diff(get_coordinates(ring)[:, 0])) > 180):
                raise ValueError(f"{code}: country ring crosses the antimeridian without a split")


def iso_tag(tags):
    for key in ISO_TAGS:
        code = tags.get(key)
        if isinstance(code, str) and ISO_CODE.fullmatch(code):
            return code
    return None


def spherical_area(geometry):
    import numpy as np
    from shapely import transform

    # the cylindrical equal-area projection on a unit sphere preserves area ranking.
    def project(coords):
        lon, lat = np.radians(coords).T
        return np.column_stack((lon, np.sin(lat)))

    return transform(geometry, project).area


class OsmBoundaries:
    def __init__(self, entries):
        from shapely import STRtree, prepare

        polygons, self.codes, self.areas = [], [], []
        for code, parts in entries:
            area = sum(spherical_area(part) for part in parts)
            for part in parts:
                prepare(part)
                polygons.append(part)
                self.codes.append(code)
                self.areas.append(area)
        self.tree = STRtree(polygons)

    @classmethod
    def load(cls, path, july):
        from shapely import get_num_coordinates, make_valid
        from shapely.geometry import shape

        entries, codes = [], Counter()
        digest = hashlib.sha256()
        features = selected = invalid = vertices = size = 0
        with path.open("rb") as source:
            for line in source:
                digest.update(line)
                size += len(line)
                if len(line) < 16 and not line.strip(b"\x1e \t\r\n"):
                    continue
                features += 1
                if not ISO_LINE.search(line):
                    continue
                feature = json.loads(line.lstrip(b"\x1e \t"))
                code = iso_tag(feature["properties"])
                if code is None:
                    continue
                selected += 1
                geometry = feature["geometry"]
                if not geometry or geometry["type"] not in ("Polygon", "MultiPolygon"):
                    continue
                geom = shape(geometry)
                check_polygon_seams(geom, code)
                vertices += int(get_num_coordinates(geom))
                if not geom.is_valid:
                    invalid += 1
                    geom = make_valid(geom)
                parts = list(polygon_parts(geom))
                if parts:
                    codes[code] += 1
                    entries.append((code, parts))
        if not entries:
            raise ValueError("OSM boundary input has no usable ISO polygons")
        available = codes.keys()
        metadata = {
            "sha256": digest.hexdigest(), "bytes": size, "feature_count": features,
            "iso_feature_count": selected, "usable_feature_count": sum(codes.values()),
            "invalid_polygons": invalid, "vertex_count": vertices, "by_code": codes,
            "missing_july_codes": {cc: july[cc] for cc in july.keys() - available},
            "additional_boundary_codes": {cc: codes[cc] for cc in available - july.keys()},
        }
        return cls(entries), metadata

    def locate(self, lon, lat):
        from shapely import Point

        point = Point(lon, lat)
        covering = [i for i in self.tree.query(point) if self.tree.geometries[i].covers(point)]
        if lon in (-180, 180):
            other = Point(-lon, lat)
            covering.extend(i for i in self.tree.query(other) if self.tree.geometries[i].covers(other))
        if not covering:
            return None, ()
        codes = sorted({self.codes[i] for i in covering}) if len(covering) > 1 else ()
        index = min(covering, key=lambda i: (self.areas[i], self.codes[i]))
        return self.codes[index], codes if len(codes) > 1 else ()


def seam_shifts(west, east):
    yield 0
    if west <= -180:
        yield 360
    if east >= 180:
        yield -360


class Countries:
    def __init__(self, entries):
        from shapely import STRtree

        self.polygons = [polygon for _, polygon in entries]
        self.codes = [code for code, _ in entries]
        self.areas = [polygon.area for polygon in self.polygons]
        self.tree = STRtree(self.polygons)

    @classmethod
    def from_shapefile(cls, path):
        import shapefile
        from shapely.geometry import shape
        from shapely import make_valid, prepare

        entries = []
        with shapefile.Reader(str(path)) as reader:
            for entry in reader.iterShapeRecords():
                geom = shape(entry.shape.__geo_interface__)
                code = iso_code(entry.record)
                check_polygon_seams(geom, code)
                for part in polygon_parts(geom if geom.is_valid else make_valid(geom)):
                    prepare(part)
                    entries.append((code, part))
        return cls(entries)

    def locate(self, lon, lat):
        from shapely import Point, box, clip_by_rect
        from shapely.affinity import scale

        lon = (lon + 180) % 360 - 180 if not -180 <= lon < 180 else lon
        point = Point(lon, lat)
        aliases = (point, Point(180, lat)) if lon == -180 else (point,)
        covering = [i for p in aliases for i in self.tree.query(p)
                    if self.codes[i] != UNKNOWN_COUNTRY and self.polygons[i].covers(p)]
        if covering:
            index = min(covering, key=lambda i: (self.areas[i], self.codes[i]))
            return self.codes[index], "natural_earth"

        dy = NEAREST_KM / KM_PER_DEGREE
        lon_scale = max(math.cos(math.radians(lat)), dy / 180)
        dx = dy / lon_scale
        candidates = []
        for shift in seam_shifts(lon - dx, lon + dx):
            x = lon + shift
            search = (x - dx, lat - dy, x + dx, lat + dy)
            centre = Point(x, lat)
            for i in self.tree.query(box(*search)):
                code = self.codes[i]
                if code == UNKNOWN_COUNTRY:
                    continue
                part = clip_by_rect(self.polygons[i], *search)
                if not part.is_empty:
                    distance = scale(part, xfact=lon_scale, origin=(x, lat)).distance(centre)
                    if distance <= dy:
                        candidates.append((distance, code))
        if candidates:
            return min(candidates)[1], "nearest"
        return UNKNOWN_COUNTRY, "fallback"


class CountryAssignment:
    def __init__(self, osm, natural_earth):
        self.osm = osm
        self.natural_earth = natural_earth

    def locate(self, lon, lat):
        code, overlapping_codes = self.osm.locate(lon, lat)
        if code is not None:
            return code, "osm", overlapping_codes
        return (*self.natural_earth.locate(lon, lat), ())


class TaggedPlaces:
    def __init__(self, coordinates):
        import numpy as np
        from shapely import STRtree, points

        self.coords = np.frombuffer(coordinates, dtype=np.float64).reshape(-1, 2)
        self.tree = STRtree(points(self.coords))

    def within(self, bounds):
        from shapely import box

        west, south, east, north = bounds
        dy = TAGGED_BUFFER_M / (1000 * KM_PER_DEGREE)
        poleward = min(90, max(abs(south), abs(north)) + dy)
        dx = min(180, dy / max(math.cos(math.radians(poleward)), 1e-12))
        for shift in seam_shifts(west - dx, east + dx):
            lo, hi = west + shift, east + shift
            window_west, window_east = max(-180, lo - dx), min(180, hi + dx)
            if window_west > window_east:
                continue
            window = box(window_west, south - dy, window_east, north + dy)
            for i in self.tree.query(window):
                lon, lat = self.coords[i]
                lon_gap = max(lo - lon, lon - hi, 0)
                if lon_gap * math.cos(math.radians(lat)) <= dy:
                    return True
        return False


def wrapped_bounds(lons, south, north):
    if not lons:
        return None
    west, east = min(lons), max(lons)
    if east - west > 180:
        ordered = sorted(lons)
        largest = west + 360 - east
        for left, right in zip(ordered, ordered[1:]):
            if right - left > largest:
                largest = right - left
                west, east = right, left + 360
    return west, south, east, north


def node_coords(locations, ref):
    try:
        loc = locations.get(ref)
    except (KeyError, RuntimeError):
        return None
    return (loc.lon, loc.lat) if loc.valid() else None


@dataclass(slots=True)
class MemberGeometry:
    lons: list
    south: float = 90
    north: float = -90
    missing: bool = False

    def add_node(self, coords):
        if coords is None:
            self.missing = True
        else:
            lon, lat = coords
            self.lons.append(lon)
            self.south = min(self.south, lat)
            self.north = max(self.north, lat)

    def add_way(self, way):
        if way is None:
            self.missing = True
        else:
            self.lons.extend(way.lons)
            self.south = min(self.south, way.south)
            self.north = max(self.north, way.north)
            self.missing |= way.missing

    def bounds(self):
        return wrapped_bounds(self.lons, self.south, self.north)


def way_geometry(nodes, locations):
    result = MemberGeometry([])
    for node in nodes:
        result.add_node(node_coords(locations, node.ref))
    return result


def relation_geometry(relations, ways, locations, root):
    geometry = MemberGeometry([])
    cycle = False
    active, done, used_ways = {root}, set(), set()
    stack = [(root, iter(relations[root]))]
    while stack:
        ref, members = stack[-1]
        member = next(members, None)
        if member is None:
            stack.pop()
            active.remove(ref)
            done.add(ref)
            continue
        kind, member_ref = member
        if kind == "n":
            geometry.add_node(node_coords(locations, member_ref))
        elif kind == "w":
            if member_ref not in used_ways:
                used_ways.add(member_ref)
                geometry.add_way(ways.get(member_ref))
        elif member_ref in active:
            cycle = True
        elif member_ref not in relations:
            geometry.missing = True
        elif member_ref not in done:
            active.add(member_ref)
            stack.append((member_ref, iter(relations[member_ref])))
    return geometry.bounds(), geometry.missing, cycle


def collect_relations(path):
    import osmium

    relations, candidates = {}, []
    for obj in osmium.FileProcessor(str(path), osmium.osm.RELATION):
        relations[obj.id] = tuple((member.type, member.ref) for member in obj.members)
        tags = dict(obj.tags)
        basis, former = classify(tags)
        if basis:
            candidates.append(properties("relation", obj, tags, basis, former))

    wanted_ways, visited = set(), set()
    pending = [int(candidate["osm_id"]) for candidate in candidates]
    while pending:
        ref = pending.pop()
        if ref in visited:
            continue
        visited.add(ref)
        for kind, member in relations.get(ref, ()):
            if kind == "w":
                wanted_ways.add(member)
            elif kind == "r" and member not in visited:
                pending.append(member)
    return relations, candidates, wanted_ways


def properties(osm_type, obj, tags, basis, former):
    return {
        "id": f"{OSM_TYPES[osm_type]}{obj.id}", "osm_id": obj.id, "osm_type": osm_type,
        "basis": basis, "former": former, "version": obj.version,
        "timestamp": obj.timestamp.strftime("%Y-%m-%dT%H:%M:%SZ"), "tags": tags,
    }


def candidate_records(path, planet=False):
    import osmium

    relations, candidates, wanted_ways = collect_relations(path)
    ways = {}
    # a sparse index uses space proportional to the nodes in the filtered PBF.
    locations = osmium.index.create_map("sparse_mem_array")
    previous = (0, 0)
    for obj in osmium.FileProcessor(str(path)):
        osm_type = obj.type_str()
        order = ("nwr".index(osm_type), obj.id)
        if order <= previous:
            raise ValueError("PBF must have unique positive IDs in type and numeric ID order")
        previous = order
        if planet:
            check_timestamp(obj.timestamp, f"{osm_type}{obj.id}")
        if osm_type == "r":
            continue
        tags = dict(obj.tags) if len(obj.tags) else {}
        basis, former = classify(tags)
        if osm_type == "n":
            if obj.location.valid():
                locations.set(obj.id, obj.location)
            if basis:
                coords = node_coords(locations, obj.id)
                bounds = (*coords, *coords) if coords is not None else None
                yield properties("node", obj, tags, basis, former), bounds, False, False
        elif basis or obj.id in wanted_ways:
            geometry = way_geometry(obj.nodes, locations)
            if obj.id in wanted_ways:
                ways[obj.id] = geometry
            if basis:
                yield properties("way", obj, tags, basis, former), geometry.bounds(), geometry.missing, False

    for props in candidates:
        yield props, *relation_geometry(relations, ways, locations, props["osm_id"])


def write_edition(path, countries, output, planet=False):
    stats = {
        "by_basis": Counter(), "by_object_type": Counter(), "by_country_and_basis": defaultdict(Counter),
        "by_country_method": Counter(dict.fromkeys(("osm", "natural_earth", "nearest", "fallback"), 0)),
        "by_religion": Counter(), "published_by_basis": Counter(),
        "without_geometry": defaultdict(list), "incomplete_geometry": defaultdict(list),
        "missing_member_geometry": defaultdict(list), "cyclic_geometry": defaultdict(list),
        "osm_overlaps": {"records": 0, "by_pair": Counter()},
    }
    tagged = array("d")
    withheld = Counter()
    with TemporaryFile(mode="w+t", encoding="utf-8", dir=output) as staged, ExitStack() as stack:
        out = {key: stack.enter_context((output / name).open("w", encoding="utf-8"))
               for key, name in FILES.items()}
        for props, bounds, missing, cycle in candidate_records(path, planet=planet):
            geometry = None
            cc, method = UNKNOWN_COUNTRY, "fallback"
            basis = props["basis"]
            if bounds is None:
                stats["without_geometry"][basis].append(props["id"])
            else:
                lon = (bounds[0] + bounds[2]) / 2
                if lon >= 180:
                    lon -= 360
                lat = (bounds[1] + bounds[3]) / 2
                cc, method, overlapping_codes = countries.locate(lon, lat)
                if overlapping_codes:
                    overlap = stats["osm_overlaps"]
                    overlap["records"] += 1
                    overlap["by_pair"].update(f"{a}/{b}" for a, b in combinations(overlapping_codes, 2))
                geometry = {"type": "Point", "coordinates": [round(lon, 6), round(lat, 6)]}
                if missing:
                    stats["incomplete_geometry"][basis].append(props["id"])
                if basis == "tag":
                    tagged.extend((lon, lat))

            if missing:
                props["missing_geometry_members"] = True
                stats["missing_member_geometry"][basis].append(props["id"])
            if cycle:
                props["cyclic_relation"] = True
                stats["cyclic_geometry"][basis].append(props["id"])
            props.update(country_code=cc, country_method=method)
            stats["by_basis"][basis] += 1
            stats["by_object_type"][props["osm_type"]] += 1
            stats["by_country_and_basis"][cc][basis] += 1
            stats["by_country_method"][method] += 1
            feature = {"type": "Feature", "geometry": geometry, "properties": props}
            if basis == "building":
                feature["bbox"] = bounds
            # only building lines need decoding once all tagged centres are available.
            staged.write(basis[0] + json_line(feature))
            if basis == "tag":
                stats["by_religion"][props["tags"].get("religion") or "unknown"] += 1
                if geometry is not None:
                    stats["published_by_basis"][basis] += 1
                    feature["properties"] = public_properties(props)
                    out[basis].write(json_line(feature))

        neighbours = TaggedPlaces(tagged)
        staged.seek(0)
        for line in staged:
            if line[0] != "b":
                out["edition"].write(line[1:])
                continue
            feature = json.loads(line[1:])
            bounds = feature.pop("bbox")
            props = feature["properties"]
            held = bounds is not None and neighbours.within(bounds)
            props["holds_tagged_place"] = held
            out["edition"].write(json_line(feature))
            if held:
                withheld[props["country_code"]] += 1
            elif bounds is not None:
                stats["published_by_basis"]["building"] += 1
                feature["properties"] = public_properties(props)
                out["building"].write(json_line(feature))

    stats["buildings_withheld"] = {"total": sum(withheld.values()), "by_country": withheld,
                                  "buffer_metres": TAGGED_BUFFER_M}
    stats["hashes"] = {"candidates_pbf": _sha256(path)}
    stats["hashes"].update({name: _sha256(output / name) for name in FILES.values()})
    return stats


def extract(pbf, boundaries, osm_boundaries, work, provenance):
    import platform
    from importlib.metadata import version

    source = edition_source(provenance)
    selected = boundary_path(boundaries, BOUNDARY_NAME)
    boundary_version = selected.with_suffix(".VERSION.txt").read_text(encoding="utf-8").strip()
    check_release_version(boundary_version, "boundary_version")
    check_release_version(provenance.get("boundary_version"), "boundary_version")
    if provenance["boundary_version"] != boundary_version:
        raise ValueError("boundary version differs from Natural Earth release")
    work.mkdir(parents=True, exist_ok=True)
    july = read_json(JULY_STATS)["by_country"]
    osm, osm_metadata = OsmBoundaries.load(osm_boundaries, july)
    countries = Countries.from_shapefile(selected)
    stats = write_edition(pbf, CountryAssignment(osm, countries), work, planet=source["source_kind"] == "planet")
    stats["source"] = source
    stats["boundary_comparison"] = boundary_comparison(boundaries, july)
    stats["hashes"]["osm_iso_boundaries"] = osm_metadata["sha256"]
    check_reconstruction(provenance, stats["hashes"])
    stats["boundary"] = {
        "osm": osm_metadata,
        "dataset": BOUNDARY_NAME,
        "version": boundary_version,
        "sha256": {selected.with_suffix(ext).name: _sha256(selected.with_suffix(ext))
                   for ext in (".shp", ".dbf")},
        "nearest_km": NEAREST_KM, "unassigned_code": UNKNOWN_COUNTRY,
    }
    stats["software_versions"] = {"python": platform.python_version()}
    stats["software_versions"].update({name: version(name) for name in ("osmium", "shapely", "pyshp")})
    stats["filter_rules"] = FILTER_RULES
    write_json(work / "edition-stats.json", stats)
    print(f"extract: {sum(stats['by_basis'].values()):,} candidates, "
          f"{dict(stats['published_by_basis'])} public, "
          f"{stats['buildings_withheld']['total']:,} building candidates withheld, "
          f"{sum(map(len, stats['without_geometry'].values())):,} without geometry", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pbf", type=Path, required=True)
    parser.add_argument("--boundaries", type=Path, required=True, help="parent of both Natural Earth folders")
    parser.add_argument("--osm-boundaries", type=Path, required=True, help="edition OSM ISO polygon GeoJSON sequence")
    parser.add_argument("--work", type=Path, required=True)
    parser.add_argument("--provenance", type=Path, required=True)
    args = parser.parse_args()
    try:
        extract(args.pbf, args.boundaries, args.osm_boundaries, args.work, read_json(args.provenance))
    except (ValueError, OSError) as error:
        parser.exit(1, f"extract: {error}\n")


if __name__ == "__main__":
    main()
