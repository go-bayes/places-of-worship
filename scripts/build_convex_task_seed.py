#!/usr/bin/env python3
"""Build a Convex task import payload from the static NZ verification GeoJSON."""

from __future__ import annotations

import argparse
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = REPO_ROOT / "apps" / "regions" / "nz" / "data" / "verification_tasks.geojson"
DEFAULT_TARGET_YEARS = [2013, 2018, 2023]


def priority(value: Any) -> str:
    if value in {"high", "medium", "low"}:
        return str(value)
    return "medium"


def osm_object_type(value: Any) -> str | None:
    if value in {"node", "way", "relation"}:
        return str(value)
    return None


def derive_task_type(properties: dict[str, Any]) -> str:
    checks = properties.get("automated_checks") or []
    check_ids = {check.get("check_id") for check in checks if isinstance(check, dict)}
    suggested_action = properties.get("automated_suggested_action")

    if "near_duplicate_name" in check_ids:
        return "possible_duplicate"
    if "missing_osm_lifecycle_date" in check_ids:
        return "lifecycle_date_needed"
    if "missing_denomination" in check_ids:
        return "denomination_or_shared_use"
    if "low_confidence" in check_ids or "weak_worship_tags" in check_ids:
        return "verify_existing_site"
    if suggested_action == "needs_human_review":
        return "verify_existing_site"
    return "target_year_status"


def task_brief(properties: dict[str, Any]) -> str:
    name = properties.get("name") or "this place of worship"
    checks = properties.get("automated_checks") or []
    messages = [
        str(check.get("message"))
        for check in checks
        if isinstance(check, dict) and check.get("message")
    ]
    if messages:
        return f"Check {name}. " + " ".join(messages[:3])
    return f"Spot-check {name} for 2013, 2018, and 2023 worship-use evidence."


def feature_to_task(feature: dict[str, Any], batch_id: str) -> dict[str, Any]:
    properties = feature.get("properties") or {}
    geometry = feature.get("geometry") or {"type": "Point", "coordinates": []}
    osm_id = properties.get("osm_id")
    matched_osm_id = "" if osm_id in {None, ""} else str(osm_id)

    task: dict[str, Any] = {
        "task_id": str(properties.get("task_id")),
        "batch_id": batch_id,
        "country_code": str(properties.get("country_code") or "NZ"),
        "task_type": derive_task_type(properties),
        "priority": priority(properties.get("verification_priority")),
        "status": "open",
        "target_years": DEFAULT_TARGET_YEARS,
        "matched_current_site_id": str(properties.get("master_site_id") or ""),
        "source_record_id": str(properties.get("task_id") or ""),
        "matched_osm_id": matched_osm_id,
        "name": str(properties.get("name") or "Unnamed place of worship"),
        "address": str(properties.get("address") or ""),
        "locality": "",
        "geometry": geometry,
        "nearby_site_refs": [],
        "automated_checks": properties.get("automated_checks") or [],
        "task_brief": task_brief(properties),
    }

    osm_type = osm_object_type(properties.get("osm_type"))
    if osm_type is not None:
        task["osm_object_type"] = osm_type

    # Keep optional fields absent when they are blank so Convex indexes can
    # distinguish "unknown" from a literal empty-string value.
    return {key: value for key, value in task.items() if value != ""}


def build_payload(input_path: Path, *, batch_id: str, limit: int | None) -> dict[str, Any]:
    data = json.loads(input_path.read_text(encoding="utf-8"))
    metadata = data.get("metadata") or {}
    features = data.get("features") or []
    if limit is not None:
        features = features[:limit]

    payload = {
        "batch": {
            "batch_id": batch_id,
            "country_code": "NZ",
            "source_kind": "static_map_import",
            "source_manifest_id": metadata.get("master_snapshot_id")
            or metadata.get("source_sha256")
            or "static-verification-tasks",
            "target_years": DEFAULT_TARGET_YEARS,
            "status": "active",
            "notes": (
                "Seeded from apps/regions/nz/data/verification_tasks.geojson. "
                "Task state is provisional and does not change the master map."
            ),
        },
        "tasks": [feature_to_task(feature, batch_id) for feature in features],
    }
    return payload


def parse_args() -> argparse.Namespace:
    today = datetime.now(UTC).date().isoformat()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--limit", type=int)
    parser.add_argument("--batch-id", default=f"nz-static-verification-{today}")
    parser.add_argument("--compact", action="store_true", help="Write compact JSON instead of indented JSON.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    payload = build_payload(args.input, batch_id=args.batch_id, limit=args.limit)
    indent = None if args.compact else 2
    text = json.dumps(payload, ensure_ascii=False, indent=indent)
    if args.output is None:
        print(text)
        return
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(text + "\n", encoding="utf-8")
    print(f"wrote {len(payload['tasks'])} Convex task records to {args.output}")


if __name__ == "__main__":
    main()
