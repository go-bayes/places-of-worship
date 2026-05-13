#!/usr/bin/env python3
"""Build a Convex task import payload from a curated RA workpack CSV."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_WORKPACK_ID = "nz-temporal-ra-workpack-001"
DEFAULT_INPUT = REPO_ROOT / "exports" / "nz_temporal_ra_workpack" / f"{DEFAULT_WORKPACK_ID}.csv"
DEFAULT_SUMMARY = (
    REPO_ROOT
    / "exports"
    / "nz_temporal_ra_workpack"
    / f"{DEFAULT_WORKPACK_ID}-summary.json"
)
DEFAULT_OUTPUT = REPO_ROOT / "exports" / "convex-task-seed" / f"{DEFAULT_WORKPACK_ID}.json"
TARGET_YEAR_DEFAULTS = [2013, 2018, 2023]


# Return trimmed text so optional Convex fields can be omitted when blank.
def text(row: dict[str, str], key: str) -> str:
    return str(row.get(key) or "").strip()


# Compute a stable file hash for manifests and reviewer checks.
def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


# Keep task ids deterministic so rerunning the seed is an update, not a new task.
def task_id_for(row: dict[str, str], fallback_workpack_id: str) -> str:
    workpack_id = text(row, "workpack_id") or fallback_workpack_id
    row_number = int(text(row, "workpack_row") or "0")
    return f"{workpack_id}-row-{row_number:03d}"


# Parse OSM keys such as way/187749097 into Convex task fields.
def osm_fields(osm_key: str) -> dict[str, str]:
    if "/" not in osm_key:
        return {}
    osm_type, osm_id = osm_key.split("/", 1)
    if osm_type not in {"node", "way", "relation"} or not osm_id:
        return {}
    return {
        "osm_object_type": osm_type,
        "matched_osm_id": osm_id,
    }


# Map workpack case categories into the small task-type vocabulary.
def task_type_for(case_type: str) -> str:
    if case_type == "possible_opening_from_osm_date_tag":
        return "lifecycle_date_needed"
    if case_type == "likely_osm_object_churn_loss":
        return "osm_identity_link"
    if case_type == "control_confirmation":
        return "verify_existing_site"
    if case_type == "ambiguous_date_or_status":
        return "target_year_status"
    return "target_year_status"


# Map the workpack's control label into the Convex priority vocabulary.
def priority_for(priority: str) -> str:
    if priority in {"high", "medium", "low"}:
        return priority
    if priority == "control":
        return "low"
    return "medium"


# Choose the map-side suggested action without turning OSM prompts into facts.
def suggested_action_for(case_type: str) -> str:
    if case_type == "control_confirmation":
        return "review_when_sampling"
    return "needs_human_review"


# Convert target-year columns into a structured context block.
def target_year_statuses(row: dict[str, str], years: list[int]) -> dict[str, dict[str, str]]:
    statuses: dict[str, dict[str, str]] = {}
    for year in years:
        year_key = str(year)
        statuses[year_key] = {
            "status": text(row, f"target_year_{year}_status") or "not_assessed",
            "basis": text(row, f"target_year_{year}_basis"),
            "evidence": text(row, f"target_year_{year}_evidence"),
        }
    return statuses


# Build the automated checks shown in the task panel.
def automated_checks(row: dict[str, str]) -> list[dict[str, str]]:
    case_type = text(row, "case_type")
    checks = [
        {
            "check_id": f"workpack_{case_type or 'case'}",
            "severity": "warning" if case_type != "control_confirmation" else "info",
            "message": text(row, "main_question") or "Check this workpack row.",
            "suggested_action": suggested_action_for(case_type),
        },
        {
            "check_id": "non_osm_evidence_needed",
            "severity": "warning",
            "message": "Use OSM as the starting prompt. Prefer independent source evidence for review decisions.",
            "suggested_action": "seek_source_evidence",
        },
    ]

    hints = text(row, "source_hints")
    if hints:
        checks.append({
            "check_id": "source_hints",
            "severity": "info",
            "message": hints,
            "suggested_action": "search_sources",
        })

    for key in ("origin_parser_warning", "closure_parser_warning"):
        warning = text(row, key)
        if warning:
            checks.append({
                "check_id": key,
                "severity": "warning",
                "message": warning,
                "suggested_action": "record_uncertainty",
            })

    return checks


# Preserve the source row details the map needs without changing master data.
def source_context(row: dict[str, str], years: list[int]) -> dict[str, Any]:
    keep = [
        "workpack_id",
        "workpack_row",
        "case_type",
        "source_file",
        "source_row_id",
        "source_record_id",
        "osm_key",
        "osm_object_url",
        "matched_current_project_id",
        "matched_current_name",
        "latest_name",
        "religion",
        "denomination",
        "target_years_to_check",
        "main_question",
        "source_hints",
        "selection_reason",
        "andre_check",
        "evidence_basis",
        "osm_date_tags_by_year",
        "former_use_tags_by_year",
        "origin_tag",
        "origin_raw",
        "origin_source_year",
        "origin_not_earlier_than",
        "origin_not_later_than",
        "origin_date_precision",
        "origin_parser_warning",
        "closure_tag",
        "closure_raw",
        "closure_source_year",
        "closure_not_earlier_than",
        "closure_not_later_than",
        "closure_date_precision",
        "closure_parser_warning",
        "candidate_date_tag_windows",
        "transition_types",
        "transition_windows",
        "task_year_presence",
        "nearby_replacement_osm_key",
        "nearby_replacement_name",
        "nearby_replacement_distance_m",
    ]
    context = {key: text(row, key) for key in keep if text(row, key)}
    context["target_year_statuses"] = target_year_statuses(row, years)
    return context


# Convert one curated workpack row into the Convex task input shape.
def row_to_task(row: dict[str, str], *, batch_id: str, years: list[int]) -> dict[str, Any]:
    lat = float(text(row, "lat"))
    lng = float(text(row, "lng"))
    case_type = text(row, "case_type")
    name = text(row, "latest_name") or text(row, "matched_current_name") or "Unnamed place of worship"
    task = {
        "task_id": task_id_for(row, batch_id),
        "batch_id": batch_id,
        "country_code": "NZ",
        "task_type": task_type_for(case_type),
        "priority": priority_for(text(row, "priority")),
        "status": "open",
        "selected_target_year": 2018 if case_type == "possible_opening_from_osm_date_tag" else 2023,
        "target_years": years,
        "matched_current_site_id": text(row, "matched_current_project_id"),
        "source_record_id": text(row, "source_record_id") or text(row, "source_row_id"),
        "name": name,
        "geometry": {
            "type": "Point",
            "coordinates": [lng, lat],
        },
        "nearby_site_refs": [],
        "automated_checks": automated_checks(row),
        "task_brief": text(row, "main_question") or f"Check target-year worship-use evidence for {name}.",
        "source_context": source_context(row, years),
    }

    if text(row, "nearby_replacement_osm_key"):
        task["nearby_site_refs"] = [{
            "name": text(row, "nearby_replacement_name") or text(row, "nearby_replacement_osm_key"),
            "distance_m": float(text(row, "nearby_replacement_distance_m") or "0"),
        }]

    task.update(osm_fields(text(row, "osm_key")))
    return {
        key: value
        for key, value in task.items()
        if value != "" and value != [] and value != {}
    }


# Read workpack rows with predictable field names.
def read_workpack(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


# Build the full mutation payload for tasks:upsertTasksFromStaticMap.
def build_payload(input_path: Path, summary_path: Path, *, batch_id: str) -> dict[str, Any]:
    rows = read_workpack(input_path)
    years = TARGET_YEAR_DEFAULTS
    csv_sha256 = sha256_file(input_path)
    summary_sha256 = sha256_file(summary_path) if summary_path.exists() else ""
    return {
        "batch": {
            "batch_id": batch_id,
            "country_code": "NZ",
            "source_kind": "osm_refresh",
            "source_manifest_id": csv_sha256,
            "target_years": years,
            "status": "active",
            "notes": (
                "Seeded from the first 50-row New Zealand temporal RA workpack. "
                "Task state is provisional and does not change the master map. "
                f"Workpack CSV SHA-256: {csv_sha256}. "
                f"Summary SHA-256: {summary_sha256 or 'not available'}."
            ),
        },
        "tasks": [row_to_task(row, batch_id=batch_id, years=years) for row in rows],
    }


# Parse command-line options for reproducible seed generation.
def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--summary", type=Path, default=DEFAULT_SUMMARY)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--batch-id", default=DEFAULT_WORKPACK_ID)
    parser.add_argument("--compact", action="store_true", help="Write compact JSON instead of indented JSON.")
    return parser.parse_args()


# Write the seed payload or print it to stdout.
def main() -> None:
    args = parse_args()
    payload = build_payload(args.input, args.summary, batch_id=args.batch_id)
    indent = None if args.compact else 2
    text_output = json.dumps(payload, ensure_ascii=False, indent=indent)
    if args.output is None:
        print(text_output)
        return
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(text_output + "\n", encoding="utf-8")
    print(f"wrote {len(payload['tasks'])} Convex workpack tasks to {args.output}")


if __name__ == "__main__":
    main()
