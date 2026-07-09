#!/usr/bin/env python3
"""assemble the polish latin diocese boundary layer from osm relation members."""

from __future__ import annotations

import argparse
import csv
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from pyproj import Transformer
from shapely import make_valid
from shapely.geometry import GeometryCollection, MultiPolygon, Polygon, mapping, shape
from shapely.ops import transform, unary_union


ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data/raw/pl_practice"
APP_GEOJSON = ROOT / "apps/regions/pl/data/pl_diocese_2004.geojson"
NAMES_CSV = RAW_DIR / "diocese_names.csv"
META_JSON = RAW_DIR / "pl_diocese_2004_meta.json"
BASE_CLEAN_GEOJSON = RAW_DIR / "pl_diocese_2004_reliable_clean.geojson"
WORK_DIR = RAW_DIR / "pl_diocese_2004_recursive_osm"
LEAF_DIR = RAW_DIR / "pl_diocese_2004_relation_parts"
ASSEMBLED_DIR = RAW_DIR / "pl_diocese_2004_assembled_missing"
UNSIMPLIFIED_GEOJSON = RAW_DIR / "pl_diocese_2004_complete_unsimplified.geojson"
POLAND_GEOJSON = RAW_DIR / "pl_osm_relation_49715.geojson"
REPORT_JSON = RAW_DIR / "pl_diocese_2004_assembly_report.json"
POLAND_RELATION_ID = 49715
POLAND_REFERENCE_AREA_KM2 = 312_700
MAX_OUTPUT_BYTES = 1_500_000
BOUNDARY_SET_ID = "pl_diocese_2004"
BOUNDARY_LEVEL = "diocese"
OSM_API = "https://api.openstreetmap.org/api/0.6"
USER_AGENT = "places-of-worship-boundary-assembly/0.2 (research data preparation)"
BOUNDARY_WAY_ROLES = {"outer", "inner", ""}
NON_BOUNDARY_WAY_ROLES = {"admin_centre", "admin_center", "label", "place_of_worship"}
TARGET_CODES = {
    "bialystok",
    "bydgoszcz",
    "czestochowa",
    "elblag",
    "gdansk",
    "gniezno",
    "kielce",
    "lodz",
    "lomza",
    "lublin",
    "sandomierz",
    "swidnica",
    "wloclawek",
    "wroclaw",
    "zamosc_lubaczow",
    "zielona_gora_gorzow",
}
SOSNOWIEC_CODE = "sosnowiec"
SIMPLIFICATION_KEEP_LADDER = [45, 40, 35, 30, 25, 20, 15, 12, 10, 8, 6, 5, 4, 3]

PROJECT_TO_POLAND = Transformer.from_crs(4326, 2180, always_xy=True).transform


@dataclass
class DioceseName:
    """store the canonical names for one area code from csv input."""

    area_code: str
    osm_name: str
    polish_official_name: str
    english_name: str


@dataclass
class AssemblyResult:
    """store one diocese assembly outcome for reports and final merging."""

    area_code: str
    route: str
    status: str
    relation_id: int | None
    candidate_relation_ids: list[int]
    area_km2: float | None
    feature_path: str | None
    note: str


def parse_args() -> argparse.Namespace:
    """parse command-line controls and return the selected run options."""

    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--reuse-cache",
        action="store_true",
        help="reuse cached osm api responses before fetching",
    )
    parser.add_argument(
        "--skip-simplify",
        action="store_true",
        help="write the merged unsimplified layer without replacing the app layer",
    )
    return parser.parse_args()


def read_json(path: Path) -> Any:
    """read a json file from path and return the decoded object."""

    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: Any) -> None:
    """write value as stable utf-8 json to path for generated artefacts."""

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def read_names() -> dict[str, DioceseName]:
    """read diocese name concordance rows keyed by area_code."""

    with NAMES_CSV.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        return {
            row["area_code"]: DioceseName(
                area_code=row["area_code"],
                osm_name=row["osm_name"],
                polish_official_name=row["polish_official_name"],
                english_name=row["english_name"],
            )
            for row in reader
        }


def relation_ids_by_area_code(meta: dict[str, Any]) -> dict[str, int]:
    """extract known osm level-6 relation ids from the existing metadata."""

    out: dict[str, int] = {}
    for item in meta.get("unresolved_latin_dioceses", []):
        if item.get("relation_id") is not None:
            out[item["area_code"]] = int(item["relation_id"])
    return out


def osm_api_cache_path(relation_id: int) -> Path:
    """return the cache path for one osm api relation/full json response."""

    return WORK_DIR / f"relation_{relation_id}.osm_api_full.json"


def fetch_url_json(url: str, cache_path: Path, reuse_cache: bool) -> dict[str, Any]:
    """fetch url as json into cache_path and return the decoded response."""

    if reuse_cache and cache_path.exists() and cache_path.stat().st_size > 0:
        return read_json(cache_path)

    cache_path.parent.mkdir(parents=True, exist_ok=True)
    last_error: Exception | None = None
    for attempt in range(1, 5):
        request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(request, timeout=90) as response:
                payload = response.read()
            cache_path.write_bytes(payload)
            return json.loads(payload.decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            last_error = exc
            time.sleep(min(12, attempt * 3))
    raise RuntimeError(f"failed to fetch {url}: {last_error}")


def fetch_relation_full(relation_id: int, reuse_cache: bool) -> dict[str, Any]:
    """fetch one osm relation/full response and return its json payload."""

    url = f"{OSM_API}/relation/{relation_id}/full.json"
    return fetch_url_json(url, osm_api_cache_path(relation_id), reuse_cache)


def elements_by_type_id(data: dict[str, Any]) -> dict[tuple[str, int], dict[str, Any]]:
    """index osm elements by type and id for relation, way, and node lookup."""

    return {
        (element["type"], int(element["id"])): element
        for element in data.get("elements", [])
        if "type" in element and "id" in element
    }


def relation_from_payload(data: dict[str, Any], relation_id: int) -> dict[str, Any]:
    """return a relation element from a relation/full payload."""

    for element in data.get("elements", []):
        if element.get("type") == "relation" and int(element.get("id")) == relation_id:
            return element
    raise RuntimeError(f"relation {relation_id} missing from osm api payload")


def relation_member_ids(relation: dict[str, Any]) -> list[int]:
    """return relation-member ids in their osm member order."""

    return [
        int(member["ref"])
        for member in relation.get("members", [])
        if member.get("type") == "relation"
    ]


def boundary_way_members(relation: dict[str, Any]) -> list[dict[str, Any]]:
    """return way members that can contribute boundary rings."""

    members: list[dict[str, Any]] = []
    for member in relation.get("members", []):
        if member.get("type") != "way":
            continue
        role = member.get("role", "")
        if role in NON_BOUNDARY_WAY_ROLES:
            continue
        if role in BOUNDARY_WAY_ROLES or role is None:
            members.append(member)
    return members


def choose_polygon_relations(
    relation_id: int,
    reuse_cache: bool,
    is_root: bool = True,
    visiting: set[int] | None = None,
) -> list[int]:
    """select highest available descendant relations that carry boundary ways."""

    if visiting is None:
        visiting = set()
    if relation_id in visiting:
        return []
    visiting.add(relation_id)

    data = fetch_relation_full(relation_id, reuse_cache)
    relation = relation_from_payload(data, relation_id)
    child_ids = relation_member_ids(relation)
    has_boundary_ways = bool(boundary_way_members(relation))

    if has_boundary_ways and not is_root:
        return [relation_id]
    if has_boundary_ways and is_root and not child_ids:
        return [relation_id]

    candidates: list[int] = []
    for child_id in child_ids:
        candidates.extend(
            choose_polygon_relations(
                child_id,
                reuse_cache=reuse_cache,
                is_root=False,
                visiting=visiting,
            )
        )
    if candidates:
        return unique_ints(candidates)
    if has_boundary_ways:
        return [relation_id]
    return []


def unique_ints(values: list[int]) -> list[int]:
    """deduplicate integer ids while preserving their first-seen order."""

    seen: set[int] = set()
    out: list[int] = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        out.append(value)
    return out


def relation_subset_for_osmtogeojson(
    relation_id: int,
    data: dict[str, Any],
) -> dict[str, Any]:
    """build a compact osm json payload for one polygonisable relation."""

    index = elements_by_type_id(data)
    relation = dict(relation_from_payload(data, relation_id))
    kept_members = boundary_way_members(relation)
    relation["members"] = kept_members

    elements: list[dict[str, Any]] = [relation]
    node_ids: set[int] = set()
    for member in kept_members:
        way = index.get(("way", int(member["ref"])))
        if way is None:
            continue
        elements.append(way)
        node_ids.update(int(node_id) for node_id in way.get("nodes", []))
    for node_id in node_ids:
        node = index.get(("node", node_id))
        if node is not None:
            elements.append(node)

    return {
        "version": data.get("version", "0.6"),
        "generator": "places-of-worship recursive diocese assembler",
        "elements": elements,
    }


def run_osmtogeojson(osm_json_path: Path, geojson_path: Path) -> dict[str, Any]:
    """run osmtogeojson for one osm json file and return parsed geojson."""

    env = os.environ.copy()
    env.setdefault("NPM_CONFIG_CACHE", "/private/tmp/npm-cache")
    command = ["npx", "--yes", "osmtogeojson", "-m", str(osm_json_path)]
    result = subprocess.run(
        command,
        cwd=ROOT,
        env=env,
        check=True,
        capture_output=True,
        text=True,
    )
    geojson_path.parent.mkdir(parents=True, exist_ok=True)
    geojson_path.write_text(result.stdout, encoding="utf-8")
    return json.loads(result.stdout)


def polygonal_part(geometry: Any) -> Polygon | MultiPolygon:
    """extract polygonal content from a shapely geometry after repair."""

    repaired = make_valid(geometry)
    if isinstance(repaired, (Polygon, MultiPolygon)):
        return repaired
    if isinstance(repaired, GeometryCollection):
        polygons: list[Polygon] = []
        for part in repaired.geoms:
            if isinstance(part, Polygon):
                polygons.append(part)
            elif isinstance(part, MultiPolygon):
                polygons.extend(part.geoms)
        if polygons:
            return MultiPolygon(polygons)
    return MultiPolygon([])


def area_km2(geometry: Any) -> float:
    """calculate square kilometres for lon-lat polygonal geometry."""

    projected = transform(PROJECT_TO_POLAND, geometry)
    return float(projected.area / 1_000_000)


def feature_for_geometry(
    geometry: Polygon | MultiPolygon,
    names: DioceseName,
    relation_id: int | None,
) -> dict[str, Any]:
    """build a final feature with the app layer's property schema."""

    return {
        "type": "Feature",
        "properties": {
            "area_code": names.area_code,
            "area_name": names.polish_official_name,
            "area_name_en": names.english_name,
            "osm_relation_id": relation_id,
            "boundary_set_id": BOUNDARY_SET_ID,
            "boundary_level": BOUNDARY_LEVEL,
        },
        "geometry": mapping(geometry),
    }


def polygonise_relation(
    relation_id: int,
    area_code: str,
    reuse_cache: bool,
) -> Polygon | MultiPolygon:
    """polygonise one candidate relation and return its polygon geometry."""

    data = fetch_relation_full(relation_id, reuse_cache)
    subset = relation_subset_for_osmtogeojson(relation_id, data)
    osm_path = LEAF_DIR / area_code / f"relation_{relation_id}.osm.json"
    geojson_path = LEAF_DIR / area_code / f"relation_{relation_id}.geojson"
    write_json(osm_path, subset)
    converted = run_osmtogeojson(osm_path, geojson_path)

    target_id = f"relation/{relation_id}"
    matching = [
        feature
        for feature in converted.get("features", [])
        if feature.get("properties", {}).get("id") == target_id
        and feature.get("geometry", {}).get("type") in {"Polygon", "MultiPolygon"}
    ]
    if not matching:
        matching = [
            feature
            for feature in converted.get("features", [])
            if feature.get("geometry", {}).get("type") in {"Polygon", "MultiPolygon"}
        ]
    if not matching:
        raise RuntimeError(f"osmtogeojson produced no polygon for relation {relation_id}")

    geometries = [polygonal_part(shape(feature["geometry"])) for feature in matching]
    return polygonal_part(unary_union(geometries))


def assemble_missing_diocese(
    area_code: str,
    root_relation_id: int,
    names: DioceseName,
    reuse_cache: bool,
) -> tuple[AssemblyResult, dict[str, Any] | None]:
    """assemble one missing diocese from its recursive osm relation members."""

    candidate_ids = choose_polygon_relations(root_relation_id, reuse_cache)
    if not candidate_ids:
        return (
            AssemblyResult(
                area_code=area_code,
                route="missing",
                status="missing",
                relation_id=root_relation_id,
                candidate_relation_ids=[],
                area_km2=None,
                feature_path=None,
                note="no descendant relation with boundary way members was available",
            ),
            None,
        )

    geometries: list[Polygon | MultiPolygon] = []
    failures: list[str] = []
    for candidate_id in candidate_ids:
        try:
            geometry = polygonise_relation(candidate_id, area_code, reuse_cache)
        except Exception as exc:  # noqa: BLE001
            failures.append(f"{candidate_id}: {exc}")
            continue
        if not geometry.is_empty:
            geometries.append(geometry)

    if not geometries:
        return (
            AssemblyResult(
                area_code=area_code,
                route="missing",
                status="missing",
                relation_id=root_relation_id,
                candidate_relation_ids=candidate_ids,
                area_km2=None,
                feature_path=None,
                note="; ".join(failures) or "candidate relations did not polygonise",
            ),
            None,
        )

    geometry = polygonal_part(unary_union(geometries))
    km2 = area_km2(geometry)
    route = "direct" if candidate_ids == [root_relation_id] else "member-union"
    if km2 < 500:
        return (
            AssemblyResult(
                area_code=area_code,
                route="missing",
                status="rejected",
                relation_id=root_relation_id,
                candidate_relation_ids=candidate_ids,
                area_km2=round(km2, 2),
                feature_path=None,
                note=f"assembled area {km2:.2f} km2 is below the 500 km2 hard floor",
            ),
            None,
        )

    feature = feature_for_geometry(geometry, names, root_relation_id)
    feature_path = ASSEMBLED_DIR / f"{area_code}.geojson"
    write_json(feature_path, {"type": "FeatureCollection", "features": [feature]})
    return (
        AssemblyResult(
            area_code=area_code,
            route=route,
            status="ok",
            relation_id=root_relation_id,
            candidate_relation_ids=candidate_ids,
            area_km2=round(km2, 2),
            feature_path=str(feature_path.relative_to(ROOT)),
            note=f"union of {len(candidate_ids)} relation polygon(s)",
        ),
        feature,
    )


def load_base_features() -> list[dict[str, Any]]:
    """load the 24 reliable features from the previous accepted layer."""

    data = read_json(BASE_CLEAN_GEOJSON)
    features = data.get("features", [])
    if len(features) != 24:
        raise RuntimeError(f"expected 24 reliable base features, found {len(features)}")
    return features


def fetch_poland_boundary(reuse_cache: bool) -> Polygon | MultiPolygon:
    """fetch and polygonise the osm national boundary for poland."""

    data = fetch_relation_full(POLAND_RELATION_ID, reuse_cache)
    osm_path = WORK_DIR / f"relation_{POLAND_RELATION_ID}.osm_api_full.json"
    geojson_path = POLAND_GEOJSON
    converted = run_osmtogeojson(osm_path, geojson_path)
    matching = [
        feature
        for feature in converted.get("features", [])
        if feature.get("properties", {}).get("id") == f"relation/{POLAND_RELATION_ID}"
        and feature.get("geometry", {}).get("type") in {"Polygon", "MultiPolygon"}
    ]
    if not matching:
        matching = [
            feature
            for feature in converted.get("features", [])
            if feature.get("geometry", {}).get("type") in {"Polygon", "MultiPolygon"}
        ]
    if not matching:
        raise RuntimeError("poland national boundary did not polygonise")
    return polygonal_part(shape(matching[0]["geometry"]))


def split_polygons(geometry: Polygon | MultiPolygon) -> list[Polygon]:
    """return polygon parts from a polygon or multipolygon geometry."""

    if isinstance(geometry, Polygon):
        return [geometry]
    return list(geometry.geoms)


def derive_sosnowiec_hole(
    features_without_sosnowiec: list[dict[str, Any]],
    names: DioceseName,
    reuse_cache: bool,
) -> tuple[AssemblyResult, dict[str, Any] | None]:
    """derive sosnowiec as the coherent remaining national-boundary hole."""

    poland = fetch_poland_boundary(reuse_cache)
    union_40 = polygonal_part(
        unary_union([shape(feature["geometry"]) for feature in features_without_sosnowiec])
    )
    remainder = polygonal_part(poland.difference(union_40))
    components = sorted(
        split_polygons(remainder),
        key=lambda geom: area_km2(geom),
        reverse=True,
    )
    substantial = [component for component in components if area_km2(component) >= 100]
    component_report = [
        {
            "area_km2": round(area_km2(component), 2),
            "centroid_lon": round(component.centroid.x, 5),
            "centroid_lat": round(component.centroid.y, 5),
        }
        for component in components[:12]
    ]

    if len(substantial) != 1:
        return (
            AssemblyResult(
                area_code=SOSNOWIEC_CODE,
                route="missing",
                status="missing",
                relation_id=None,
                candidate_relation_ids=[],
                area_km2=round(area_km2(remainder), 2) if not remainder.is_empty else 0,
                feature_path=None,
                note=f"national-boundary remainder was fragmented: {component_report}",
            ),
            None,
        )

    candidate = polygonal_part(substantial[0])
    km2 = area_km2(candidate)
    centroid = candidate.centroid
    in_sosnowiec_region = 18.4 <= centroid.x <= 20.3 and 49.6 <= centroid.y <= 50.8
    plausible_area = 1_200 <= km2 <= 3_500
    if not in_sosnowiec_region or not plausible_area:
        return (
            AssemblyResult(
                area_code=SOSNOWIEC_CODE,
                route="missing",
                status="missing",
                relation_id=None,
                candidate_relation_ids=[],
                area_km2=round(km2, 2),
                feature_path=None,
                note=f"hole candidate failed plausibility checks: {component_report}",
            ),
            None,
        )

    feature = feature_for_geometry(candidate, names, None)
    feature_path = ASSEMBLED_DIR / f"{SOSNOWIEC_CODE}.geojson"
    write_json(feature_path, {"type": "FeatureCollection", "features": [feature]})
    return (
        AssemblyResult(
            area_code=SOSNOWIEC_CODE,
            route="hole",
            status="ok",
            relation_id=None,
            candidate_relation_ids=[],
            area_km2=round(km2, 2),
            feature_path=str(feature_path.relative_to(ROOT)),
            note=(
                "derived as Poland national boundary minus the 40 other Latin "
                "diocese polygons; osm has only parish-level Sosnowiec fragments"
            ),
        ),
        feature,
    )


def validate_features(features: list[dict[str, Any]]) -> dict[str, Any]:
    """calculate coverage and pairwise overlap metrics for output features."""

    geometries = [polygonal_part(shape(feature["geometry"])) for feature in features]
    areas = [area_km2(geometry) for geometry in geometries]
    dissolved = polygonal_part(unary_union(geometries))
    dissolved_area = area_km2(dissolved)
    pairwise_total = 0.0
    max_pairwise = {
        "area_code_a": None,
        "area_code_b": None,
        "overlap_km2": 0.0,
        "percent_of_smaller": 0.0,
    }

    for i, geom_a in enumerate(geometries):
        for j in range(i + 1, len(geometries)):
            geom_b = geometries[j]
            if not geom_a.intersects(geom_b):
                continue
            overlap = area_km2(geom_a.intersection(geom_b))
            if overlap <= 0.001:
                continue
            pairwise_total += overlap
            percent = overlap / min(areas[i], areas[j]) * 100 if min(areas[i], areas[j]) else 0
            if percent > max_pairwise["percent_of_smaller"]:
                max_pairwise = {
                    "area_code_a": features[i]["properties"]["area_code"],
                    "area_code_b": features[j]["properties"]["area_code"],
                    "overlap_km2": round(overlap, 4),
                    "percent_of_smaller": round(percent, 4),
                }

    return {
        "feature_count": len(features),
        "sum_area_km2": round(sum(areas), 2),
        "dissolved_area_km2": round(dissolved_area, 2),
        "percent_of_poland_reference_area_312700_km2": round(
            dissolved_area / POLAND_REFERENCE_AREA_KM2 * 100,
            2,
        ),
        "pairwise_overlap_total_km2": round(pairwise_total, 4),
        "pairwise_overlap_total_percent_of_reference": round(
            pairwise_total / POLAND_REFERENCE_AREA_KM2 * 100,
            4,
        ),
        "max_pairwise_overlap": max_pairwise,
        "areas_km2": {
            feature["properties"]["area_code"]: round(area, 2)
            for feature, area in zip(features, areas, strict=True)
        },
    }


def simplify_with_mapshaper(input_path: Path, output_path: Path) -> dict[str, Any]:
    """simplify the merged layer with mapshaper and keep it under the byte cap."""

    env = os.environ.copy()
    env.setdefault("NPM_CONFIG_CACHE", "/private/tmp/npm-cache")
    attempts: list[dict[str, Any]] = []
    chosen: dict[str, Any] | None = None
    for keep in SIMPLIFICATION_KEEP_LADDER:
        temp_path = output_path.with_name(f"{output_path.stem}.keep_{keep}.geojson")
        command = [
            "npx",
            "--yes",
            "mapshaper",
            str(input_path),
            "-clean",
            "-simplify",
            "weighted",
            "keep-shapes",
            f"{keep}%",
            "-clean",
            "-o",
            "precision=0.00001",
            "format=geojson",
            str(temp_path),
        ]
        subprocess.run(command, cwd=ROOT, env=env, check=True, capture_output=True, text=True)
        byte_size = temp_path.stat().st_size
        attempts.append({"keep_percentage": keep, "byte_size": byte_size})
        if byte_size <= MAX_OUTPUT_BYTES:
            temp_path.replace(output_path)
            chosen = {
                "keep_percentage": keep,
                "byte_size": byte_size,
                "command": " ".join(command),
                "attempts": attempts,
            }
            break
        if keep != SIMPLIFICATION_KEEP_LADDER[-1]:
            temp_path.unlink()

    if chosen is None:
        keep = SIMPLIFICATION_KEEP_LADDER[-1]
        temp_path = output_path.with_name(f"{output_path.stem}.keep_{keep}.geojson")
        temp_path.replace(output_path)
        chosen = {
            "keep_percentage": keep,
            "byte_size": output_path.stat().st_size,
            "command": "last simplification attempt from ladder",
            "attempts": attempts,
        }
    return chosen


def result_to_dict(result: AssemblyResult) -> dict[str, Any]:
    """serialise one assembly result for json reports."""

    return {
        "area_code": result.area_code,
        "route": result.route,
        "status": result.status,
        "osm_relation_id": result.relation_id,
        "candidate_relation_ids": result.candidate_relation_ids,
        "area_km2": result.area_km2,
        "feature_path": result.feature_path,
        "note": result.note,
    }


def update_meta(
    meta: dict[str, Any],
    results: list[AssemblyResult],
    validation_unsimplified: dict[str, Any],
    validation_final: dict[str, Any] | None,
    simplification: dict[str, Any] | None,
    final_features: list[dict[str, Any]],
) -> dict[str, Any]:
    """update existing metadata with recursive assembly routes and validation."""

    unresolved = [
        {
            "relation_id": result.relation_id,
            "area_code": result.area_code,
            "reason": result.note,
        }
        for result in results
        if result.status != "ok"
    ]
    meta["status"] = "complete_osm_recursive_assembly" if not unresolved else "incomplete_osm_recursive_assembly"
    meta["retrieval_timestamp_utc"] = datetime.now(timezone.utc).isoformat()
    meta.setdefault("raw_files", {})
    meta["raw_files"].update(
        {
            "recursive_osm_api_dir": str(WORK_DIR.relative_to(ROOT)),
            "relation_parts_dir": str(LEAF_DIR.relative_to(ROOT)),
            "assembled_missing_dir": str(ASSEMBLED_DIR.relative_to(ROOT)),
            "complete_unsimplified_geojson": str(UNSIMPLIFIED_GEOJSON.relative_to(ROOT)),
            "assembly_report": str(REPORT_JSON.relative_to(ROOT)),
            "poland_osm_boundary_geojson": str(POLAND_GEOJSON.relative_to(ROOT)),
            "name_concordance_csv": str(NAMES_CSV.relative_to(ROOT)),
        }
    )
    meta["retained_feature_count"] = len(final_features)
    meta["retained_relation_ids"] = [
        feature["properties"].get("osm_relation_id")
        for feature in final_features
        if feature["properties"].get("osm_relation_id") is not None
    ]
    meta["assembly_routes"] = [result_to_dict(result) for result in results]
    meta["unresolved_latin_dioceses"] = unresolved
    meta["validation"] = {
        "unsimplified": validation_unsimplified,
        "final_simplified": validation_final,
    }
    if simplification is not None:
        meta["output"] = {
            "path": str(APP_GEOJSON.relative_to(ROOT)),
            "byte_size": simplification["byte_size"],
            "chosen_keep_percentage": simplification["keep_percentage"],
            "simplification_command": simplification["command"],
            "simplification_attempts": simplification["attempts"],
            "property_keys": [
                "area_code",
                "area_name",
                "area_name_en",
                "osm_relation_id",
                "boundary_set_id",
                "boundary_level",
            ],
        }
    return meta


def main() -> int:
    """run the full assembly, validation, simplification, and report update."""

    args = parse_args()
    names_by_code = read_names()
    meta = read_json(META_JSON)
    relation_ids = relation_ids_by_area_code(meta)

    base_features = load_base_features()
    base_codes = {feature["properties"]["area_code"] for feature in base_features}
    if base_codes & TARGET_CODES:
        raise RuntimeError(f"base layer unexpectedly contains target codes: {base_codes & TARGET_CODES}")

    results: list[AssemblyResult] = []
    assembled_features: list[dict[str, Any]] = []
    for area_code in sorted(TARGET_CODES):
        relation_id = relation_ids.get(area_code)
        if relation_id is None:
            results.append(
                AssemblyResult(
                    area_code=area_code,
                    route="missing",
                    status="missing",
                    relation_id=None,
                    candidate_relation_ids=[],
                    area_km2=None,
                    feature_path=None,
                    note="no level-6 relation id available in metadata",
                )
            )
            continue
        print(f"assembling {area_code} from relation {relation_id}", flush=True)
        result, feature = assemble_missing_diocese(
            area_code=area_code,
            root_relation_id=relation_id,
            names=names_by_code[area_code],
            reuse_cache=args.reuse_cache,
        )
        results.append(result)
        if feature is not None:
            assembled_features.append(feature)
        print(
            f"  {result.route}: {result.status}; area={result.area_km2}; "
            f"candidates={len(result.candidate_relation_ids)}",
            flush=True,
        )

    merged_without_sosnowiec = base_features + assembled_features
    ok_without_sosnowiec = [result for result in results if result.status == "ok"]
    if len(base_features) + len(ok_without_sosnowiec) == 40:
        print("deriving sosnowiec as national-boundary hole", flush=True)
        sosnowiec_result, sosnowiec_feature = derive_sosnowiec_hole(
            merged_without_sosnowiec,
            names_by_code[SOSNOWIEC_CODE],
            reuse_cache=args.reuse_cache,
        )
    else:
        sosnowiec_result, sosnowiec_feature = (
            AssemblyResult(
                area_code=SOSNOWIEC_CODE,
                route="missing",
                status="missing",
                relation_id=None,
                candidate_relation_ids=[],
                area_km2=None,
                feature_path=None,
                note="not derived because fewer than 40 other dioceses assembled",
            ),
            None,
        )
    results.append(sosnowiec_result)

    final_unsimplified_features = merged_without_sosnowiec
    if sosnowiec_feature is not None:
        final_unsimplified_features = merged_without_sosnowiec + [sosnowiec_feature]

    final_unsimplified_features = sorted(
        final_unsimplified_features,
        key=lambda feature: feature["properties"]["area_code"],
    )
    write_json(
        UNSIMPLIFIED_GEOJSON,
        {"type": "FeatureCollection", "features": final_unsimplified_features},
    )
    validation_unsimplified = validate_features(final_unsimplified_features)

    simplification = None
    validation_final = None
    if not args.skip_simplify:
        simplification = simplify_with_mapshaper(UNSIMPLIFIED_GEOJSON, APP_GEOJSON)
        validation_final = validate_features(read_json(APP_GEOJSON)["features"])

    report = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "feature_count": len(final_unsimplified_features),
        "routes": [result_to_dict(result) for result in results],
        "validation_unsimplified": validation_unsimplified,
        "validation_final_simplified": validation_final,
        "simplification": simplification,
        "sample_feature": final_unsimplified_features[0],
    }
    write_json(REPORT_JSON, report)

    updated_meta = update_meta(
        meta=meta,
        results=results,
        validation_unsimplified=validation_unsimplified,
        validation_final=validation_final,
        simplification=simplification,
        final_features=read_json(APP_GEOJSON)["features"] if APP_GEOJSON.exists() else final_unsimplified_features,
    )
    write_json(META_JSON, updated_meta)
    print(json.dumps(report["validation_final_simplified"] or validation_unsimplified, indent=2), flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
