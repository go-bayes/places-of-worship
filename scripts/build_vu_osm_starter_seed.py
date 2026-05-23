#!/usr/bin/env python3
"""Build a small Convex task seed from the sparse Vanuatu OSM extract."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_BATCH_ID = "vu-source-first-test-001"
DEFAULT_INPUT = REPO_ROOT / "data" / "global" / "vu_places.json"
DEFAULT_OUTPUT = REPO_ROOT / "exports" / "convex-task-seed" / f"{DEFAULT_BATCH_ID}.json"
TARGET_YEARS = [1989, 1999, 2009, 2020]


# Return trimmed text for one source field.
def text(record: dict[str, Any], key: str) -> str:
    return str(record.get(key) or "").strip()


# Compute a file digest for the seed manifest reference.
def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


# Make stable slugs for task and candidate ids.
def slug(value: str, max_length: int = 54) -> str:
    cleaned = "".join(char.lower() if char.isalnum() else "-" for char in value)
    parts = [part for part in cleaned.split("-") if part]
    return "-".join(parts)[:max_length] or "unnamed"


# Make a short stable hash from source content.
def record_hash(record: dict[str, Any]) -> str:
    keys = ["name", "denomination", "religion", "lat", "lng"]
    encoded = "|".join(str(record.get(key, "")) for key in keys).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()[:12]


# Classify why this OSM-derived lead is worth checking.
def case_type(record: dict[str, Any]) -> str:
    has_name = text(record, "name").lower() != "unnamed"
    has_denomination = bool(text(record, "denomination"))
    if has_name and has_denomination:
        return "named_denomination_lead"
    if has_name:
        return "named_missing_denomination"
    if has_denomination:
        return "unnamed_denomination_lead"
    return "unnamed_sparse_osm_lead"


# Rank records so the starter batch is useful without overwhelming the RA.
def rank_key(indexed_record: tuple[int, dict[str, Any]]) -> tuple[int, str, float, float]:
    index, record = indexed_record
    priority_by_case = {
        "named_denomination_lead": 0,
        "named_missing_denomination": 1,
        "unnamed_denomination_lead": 2,
        "unnamed_sparse_osm_lead": 3,
    }
    case = case_type(record)
    return (
        priority_by_case[case],
        slug(text(record, "denomination") or text(record, "name") or f"row-{index}"),
        float(record.get("lat") or 0),
        float(record.get("lng") or 0),
    )


# Select a deterministic starter list, favouring source-checkable rows.
def select_records(records: list[dict[str, Any]], limit: int) -> list[tuple[int, dict[str, Any]]]:
    indexed = list(enumerate(records, start=1))
    quotas = {
        "named_denomination_lead": round(limit * 0.40),
        "named_missing_denomination": round(limit * 0.30),
        "unnamed_denomination_lead": round(limit * 0.20),
        "unnamed_sparse_osm_lead": limit,
    }
    selected: list[tuple[int, dict[str, Any]]] = []
    used: set[int] = set()
    for case, quota in quotas.items():
        bucket = [
            item
            for item in sorted(indexed, key=rank_key)
            if case_type(item[1]) == case and item[0] not in used
        ]
        take = bucket[: max(0, min(quota, limit - len(selected)))]
        selected.extend(take)
        used.update(index for index, _ in take)
        if len(selected) >= limit:
            return selected[:limit]

    remainder = [item for item in sorted(indexed, key=rank_key) if item[0] not in used]
    return (selected + remainder)[:limit]


# Build the task prompt shown in the RA portal.
def task_brief(record: dict[str, Any]) -> str:
    name = text(record, "name")
    label = name if name.lower() != "unnamed" else "this unnamed Vanuatu place-of-worship lead"
    return (
        f"Check source-backed evidence for {label}. Treat the sparse OSM-derived "
        "point as a prompt only: verify site identity, name, denomination, "
        "location confidence, and any 1989/1999/2009/2020 worship-use status."
    )


# Convert one source record into the Convex task input shape.
def record_to_task(index: int, record: dict[str, Any], batch_id: str) -> dict[str, Any]:
    name = text(record, "name")
    display_name = name if name.lower() != "unnamed" else f"Vanuatu PoW lead {index:03d}"
    task_id = f"vu-osm-check-{index:03d}-{record_hash(record)}"
    source_record_id = f"data/global/vu_places.json:{index}"
    case = case_type(record)
    checks = [
        {
            "check_id": case,
            "severity": "warning" if case != "named_denomination_lead" else "info",
            "message": "Use independent source evidence before accepting this OSM-derived Vanuatu lead.",
            "suggested_action": "seek_source_evidence",
        }
    ]
    if name.lower() == "unnamed":
        checks.append({
            "check_id": "missing_name",
            "severity": "warning",
            "message": "The OSM-derived record has no useful name.",
            "suggested_action": "find_name_or_mark_uncertain",
        })
    if not text(record, "denomination"):
        checks.append({
            "check_id": "missing_denomination",
            "severity": "info",
            "message": "The OSM-derived record has no denomination or tradition.",
            "suggested_action": "find_denomination_if_source_supports_it",
        })

    return {
        "task_id": task_id,
        "batch_id": batch_id,
        "country_code": "VU",
        "task_type": "missing_from_project_map",
        "priority": "high" if case != "named_denomination_lead" else "medium",
        "status": "open",
        "target_years": TARGET_YEARS,
        "candidate_site_id": f"candidate:{task_id}",
        "source_record_id": source_record_id,
        "name": display_name,
        "locality": "",
        "geometry": {
            "type": "Point",
            "coordinates": [float(record["lng"]), float(record["lat"])],
        },
        "nearby_site_refs": [],
        "automated_checks": checks,
        "task_brief": task_brief(record),
        "source_context": {
            "source_file": "data/global/vu_places.json",
            "source_row": index,
            "case_type": case,
            "latest_name": name,
            "religion": text(record, "religion"),
            "denomination": text(record, "denomination"),
            "source_hints": (
                "Start with Google Maps/imagery and independent church, mission, "
                "directory, census-context, or local source evidence. Do not treat "
                "the OSM-derived point as final evidence."
            ),
            "selection_reason": "Initial 50-case Vanuatu source-first test from the sparse OSM-derived extract.",
            "target_year_statuses": {
                str(year): {
                    "status": "not_assessed",
                    "basis": "",
                    "evidence": "",
                }
                for year in TARGET_YEARS
            },
        },
    }


# Read the cleaned Vanuatu extract from local ignored data.
def read_records(path: Path) -> list[dict[str, Any]]:
    records = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(records, list):
        raise ValueError("Vanuatu input must be a JSON array")
    return records


# Build the Convex upsert payload for the selected records.
def build_payload(input_path: Path, *, batch_id: str, limit: int) -> dict[str, Any]:
    records = read_records(input_path)
    selected = select_records(records, limit)
    input_sha256 = sha256_file(input_path)
    return {
        "batch": {
            "batch_id": batch_id,
            "country_code": "VU",
            "source_kind": "osm_refresh",
            "source_manifest_id": input_sha256,
            "target_years": TARGET_YEARS,
            "status": "active",
            "notes": (
                "Initial Vanuatu source-first test batch from the sparse "
                "OSM-derived extract. These tasks are prompts for independent "
                "source checking, not accepted project records. "
                f"Input SHA-256: {input_sha256}."
            ),
        },
        "tasks": [record_to_task(index, record, batch_id) for index, record in selected],
    }


# Parse command-line options for reproducible seed generation.
def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--batch-id", default=DEFAULT_BATCH_ID)
    parser.add_argument("--limit", type=int, default=50)
    parser.add_argument("--compact", action="store_true", help="Write compact JSON instead of indented JSON.")
    return parser.parse_args()


# Write the seed payload or print it to stdout.
def main() -> None:
    args = parse_args()
    payload = build_payload(args.input, batch_id=args.batch_id, limit=args.limit)
    indent = None if args.compact else 2
    text_output = json.dumps(payload, ensure_ascii=False, indent=indent)
    if args.output is None:
        print(text_output)
        return
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(text_output + "\n", encoding="utf-8")
    print(f"wrote {len(payload['tasks'])} Vanuatu starter tasks to {args.output}")


if __name__ == "__main__":
    main()
