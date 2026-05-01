#!/usr/bin/env python3
"""Build static NZ master-verification task GeoJSON.

The output is a read-only reviewer layer derived from the current NZ site
snapshot. It does not make review decisions or edit the master data.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import quote_plus


REPO_ROOT = Path(__file__).resolve().parents[1]
INPUT_PATH = REPO_ROOT / "apps" / "regions" / "nz" / "data" / "nz_places.json"
OUTPUT_PATH = REPO_ROOT / "apps" / "regions" / "nz" / "data" / "verification_tasks.geojson"

PLACEHOLDER_PATTERN = re.compile(r"^Place of Worship \d+$", re.IGNORECASE)
GENERIC_WORSHIP_PATTERN = re.compile(
    r"^(Christian|Anglican|Roman_Catholic|Jewish|Sikh|Mormon|Methodist|Lutheran) Place of Worship$",
    re.IGNORECASE,
)


def normalise_text(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip().lower())


def haversine_metres(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6_371_000
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    )
    return 2 * radius * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def osm_object_url(osm_type: str | None, osm_id: object) -> str:
    if not osm_type or not osm_id:
        return ""
    clean_type = str(osm_type).lower()
    if clean_type not in {"node", "way", "relation"}:
        return ""
    return f"https://www.openstreetmap.org/{clean_type}/{osm_id}"


def tags_summary(tags: dict) -> str:
    keys = [
        "amenity",
        "building",
        "religion",
        "denomination",
        "start_date",
        "old_start_date",
        "end_date",
    ]
    return "; ".join(f"{key}={tags[key]}" for key in keys if tags.get(key))


def review_checks(record: dict, duplicate_by_coord: bool, duplicate_by_name_near: bool) -> list[dict]:
    checks: list[dict] = []
    tags = record.get("tags_raw") or {}
    name = str(record.get("name") or "").strip()
    confidence = float(record.get("confidence") or 0)
    lat = record.get("lat")
    lng = record.get("lng")
    amenity = tags.get("amenity")
    building = tags.get("building")

    def add(check_id: str, severity: str, message: str, suggested_action: str) -> None:
        checks.append(
            {
                "check_id": check_id,
                "severity": severity,
                "message": message,
                "suggested_action": suggested_action,
            }
        )

    if not name:
        add("missing_name", "error", "No site name is present.", "review_identity")
    elif PLACEHOLDER_PATTERN.match(name) or GENERIC_WORSHIP_PATTERN.match(name):
        add("generic_name", "warning", "Name looks generic or placeholder-like.", "review_identity")

    if confidence < 0.6:
        add("low_confidence", "warning", "Master confidence is below 0.60.", "review_record")

    if not record.get("address"):
        add("missing_address", "info", "No address is recorded.", "review_if_needed")

    if not record.get("denomination"):
        add("missing_denomination", "info", "No denomination is recorded.", "review_if_needed")

    if lat is None or lng is None:
        add("missing_coordinates", "blocker", "Coordinates are missing.", "review_location")
    elif not (-48 <= float(lat) <= -33 and 165 <= float(lng) <= 180):
        add("coordinate_outside_nz_bounds", "blocker", "Coordinates fall outside broad NZ bounds.", "review_location")

    if amenity != "place_of_worship" and building not in {
        "church",
        "chapel",
        "mosque",
        "synagogue",
        "temple",
        "cathedral",
        "shrine",
    }:
        add("weak_worship_tags", "warning", "OSM tags do not strongly establish worship use.", "review_inclusion")

    if not (record.get("start_date") or tags.get("start_date") or tags.get("old_start_date")):
        add("missing_osm_lifecycle_date", "info", "No OSM start_date or old_start_date is recorded.", "seek_lifecycle_evidence")

    if duplicate_by_coord:
        add("same_coordinate_cluster", "warning", "Another record shares nearly identical coordinates.", "review_duplicate")

    if duplicate_by_name_near:
        add("near_duplicate_name", "warning", "A similarly named record is nearby.", "review_duplicate")

    return checks


def task_priority(checks: list[dict]) -> str:
    severities = {check["severity"] for check in checks}
    high_risk = {
        "missing_name",
        "generic_name",
        "low_confidence",
        "missing_coordinates",
        "coordinate_outside_nz_bounds",
        "weak_worship_tags",
        "same_coordinate_cluster",
        "near_duplicate_name",
    }
    check_ids = {check["check_id"] for check in checks}
    if "blocker" in severities or check_ids & high_risk:
        return "high"
    if checks:
        return "medium"
    return "low"


def suggested_action(priority: str) -> str:
    if priority == "high":
        return "needs_human_review"
    if priority == "medium":
        return "review_when_sampling"
    return "candidate_no_action"


def build_search_queries(record: dict) -> dict:
    name = str(record.get("name") or "").strip()
    address = str(record.get("address") or "").strip()
    religion = str(record.get("religion") or "").strip()
    denomination = str(record.get("denomination") or "").strip()
    locality_hint = "New Zealand"

    queries = {
        "name_locality": " ".join(part for part in [name, locality_hint] if part),
        "name_address": " ".join(part for part in [name, address] if part),
        "denomination_locality": " ".join(part for part in [denomination or religion, locality_hint] if part),
    }
    return {
        key: {
            "query": query,
            "google_url": f"https://www.google.com/search?q={quote_plus(query)}" if query else "",
        }
        for key, query in queries.items()
    }


def feature_for_record(record: dict, checks: list[dict], master_snapshot_id: str) -> dict:
    lat = float(record["lat"])
    lng = float(record["lng"])
    osm_id = record.get("osm_id")
    osm_type = record.get("osm_type")
    osm_url = osm_object_url(osm_type, osm_id)
    tags = record.get("tags_raw") or {}
    priority = task_priority(checks)

    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [lng, lat]},
        "properties": {
            "task_id": f"nz-verify-{record.get('id')}",
            "master_snapshot_id": master_snapshot_id,
            "master_site_id": record.get("id"),
            "country_code": record.get("country_code", "NZ"),
            "name": record.get("name") or "",
            "religion": record.get("religion") or "",
            "denomination": record.get("denomination") or "",
            "site_type": record.get("type") or "",
            "address": record.get("address") or "",
            "confidence": record.get("confidence"),
            "osm_id": osm_id,
            "osm_type": osm_type,
            "osm_object_url": osm_url,
            "osm_history_url": f"{osm_url}/history" if osm_url else "",
            "osm_start_date": record.get("start_date") or tags.get("start_date") or "",
            "osm_old_start_date": tags.get("old_start_date") or "",
            "osm_end_date": tags.get("end_date") or "",
            "osm_tags_summary": tags_summary(tags),
            "osm_tags_raw": tags,
            "google_maps_url": f"https://www.google.com/maps?q={lat},{lng}",
            "street_view_url": f"https://www.google.com/maps/@{lat},{lng},3a,75y,0h,90t/data=!3m4!1e1!3m2!1s0x0:0x0!2e0",
            "osm_map_url": f"https://www.openstreetmap.org/?mlat={lat}&mlon={lng}#map=18/{lat}/{lng}",
            "search_queries": build_search_queries(record),
            "verification_priority": priority,
            "verification_status": "unreviewed",
            "automated_suggested_action": suggested_action(priority),
            "automated_checks": checks,
            "automated_check_count": len(checks),
            "target_year_2013_status": "not_assessed",
            "target_year_2018_status": "not_assessed",
            "target_year_2023_status": "not_assessed",
        },
    }


def main() -> None:
    source_bytes = INPUT_PATH.read_bytes()
    source_sha256 = hashlib.sha256(source_bytes).hexdigest()
    records = json.loads(source_bytes)

    records = sorted(records, key=lambda row: str(row.get("id") or ""))
    coord_counts = Counter(
        (round(float(row["lat"]), 5), round(float(row["lng"]), 5))
        for row in records
        if row.get("lat") is not None and row.get("lng") is not None
    )

    by_name: dict[str, list[dict]] = defaultdict(list)
    for row in records:
        name_key = normalise_text(row.get("name"))
        if name_key:
            by_name[name_key].append(row)

    near_duplicate_ids: set[str] = set()
    for candidates in by_name.values():
        if len(candidates) < 2:
            continue
        for index, left in enumerate(candidates):
            if left.get("lat") is None or left.get("lng") is None:
                continue
            for right in candidates[index + 1 :]:
                if right.get("lat") is None or right.get("lng") is None:
                    continue
                distance = haversine_metres(
                    float(left["lat"]),
                    float(left["lng"]),
                    float(right["lat"]),
                    float(right["lng"]),
                )
                if distance <= 200:
                    near_duplicate_ids.add(str(left.get("id")))
                    near_duplicate_ids.add(str(right.get("id")))

    master_snapshot_id = f"nz_places:{source_sha256[:12]}"
    features = []
    for record in records:
        coord_key = (round(float(record["lat"]), 5), round(float(record["lng"]), 5))
        checks = review_checks(
            record,
            duplicate_by_coord=coord_counts[coord_key] > 1,
            duplicate_by_name_near=str(record.get("id")) in near_duplicate_ids,
        )
        features.append(feature_for_record(record, checks, master_snapshot_id))

    priority_counts = Counter(feature["properties"]["verification_priority"] for feature in features)
    action_counts = Counter(feature["properties"]["automated_suggested_action"] for feature in features)

    output = {
        "type": "FeatureCollection",
        "metadata": {
            "title": "NZ master verification tasks",
            "source": str(INPUT_PATH.relative_to(REPO_ROOT)),
            "master_snapshot_id": master_snapshot_id,
            "source_sha256": source_sha256,
            "feature_count": len(features),
            "priority_counts": dict(sorted(priority_counts.items())),
            "suggested_action_counts": dict(sorted(action_counts.items())),
            "schema_version": "0.1.0",
        },
        "features": features,
    }

    OUTPUT_PATH.write_text(
        json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(features)} verification tasks to {OUTPUT_PATH.relative_to(REPO_ROOT)}")
    print(f"Master snapshot: {master_snapshot_id}")
    print(f"Priority counts: {dict(sorted(priority_counts.items()))}")
    print(f"Suggested actions: {dict(sorted(action_counts.items()))}")


if __name__ == "__main__":
    main()
