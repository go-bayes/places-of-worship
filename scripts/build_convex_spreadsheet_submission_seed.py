#!/usr/bin/env python3
"""Build a Convex import payload from an RA site-evidence spreadsheet CSV."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = (
    REPO_ROOT
    / "docs"
    / "templates"
    / "ra-historical-site-evidence"
    / "site_evidence_wide.csv"
)
DEFAULT_BATCH_ID = "vu-source-first-test-001"
DEFAULT_OUTPUT = REPO_ROOT / "exports" / "convex-task-seed" / f"{DEFAULT_BATCH_ID}.json"
DEFAULT_TARGET_YEARS = [1989, 1999, 2009, 2020]
COUNTRY_CENTRES = {
    "NZ": [172.5118422, -41.235726],
    "VU": [167.7019, -16.2902],
}
SOURCE_TYPES = {
    "official_register",
    "denominational_directory",
    "charity_register",
    "charities_register",
    "incorporated_societies",
    "historic_map",
    "aerial_or_street_imagery",
    "street_imagery",
    "aerial_imagery",
    "field_observation",
    "osm",
    "osm_history",
    "osm_date_tags",
    "archived_website",
    "local_council",
    "heritage_list",
    "linz_building_outlines",
    "linz_property",
    "news_or_web",
    "other",
}
TARGET_STATUSES = {"present", "absent", "uncertain", "not_assessed"}
FLAGS = {"clear", "needs_review", "restricted"}
LIFECYCLE_FIELDS = [
    ("organisation_founded", "organisation_founded_date", "organisation_founded_date_precision"),
    ("site_opened", "site_opened_date", "site_opened_date_precision"),
    ("building_opened_or_dedicated", "building_opened_or_dedicated_date", "building_opened_or_dedicated_date_precision"),
    ("origin_not_earlier_than", "origin_not_earlier_than_date", "origin_not_earlier_than_date_precision"),
    ("origin_not_later_than", "origin_not_later_than_date", "origin_not_later_than_date_precision"),
    ("first_seen", "first_seen_date", "first_seen_date_precision"),
    ("last_seen", "last_seen_date", "last_seen_date_precision"),
    ("site_closed", "site_closed_date", "site_closed_date_precision"),
    ("closure_not_earlier_than", "closure_not_earlier_than_date", "closure_not_earlier_than_date_precision"),
    ("closure_not_later_than", "closure_not_later_than_date", "closure_not_later_than_date_precision"),
    ("building_demolished", "building_demolished_date", "building_demolished_date_precision"),
    ("use_changed", "use_changed_date", "use_changed_date_precision"),
    ("relocated", "relocated_date", "relocated_date_precision"),
]


# return trimmed text for one spreadsheet cell.
def text(row: dict[str, str], key: str) -> str:
    return str(row.get(key) or "").strip()


# return the first non-empty cell among candidate field names.
def first_text(row: dict[str, str], keys: list[str]) -> str:
    for key in keys:
        value = text(row, key)
        if value:
            return value
    return ""


# decide whether an optional value should be included in Convex JSON.
def keep_value(value: Any) -> bool:
    return value is not None and value != "" and value != [] and value != {}


# remove blank optional values from one level of a JSON object.
def compact_dict(values: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in values.items() if keep_value(value)}


# make a stable lowercase slug for ids.
def slug(value: str, max_length: int = 60) -> str:
    cleaned = "".join(char.lower() if char.isalnum() else "-" for char in value)
    parts = [part for part in cleaned.split("-") if part]
    return "-".join(parts)[:max_length] or "row"


# compute a stable hash for a row or source file.
def stable_hash(value: Any) -> str:
    encoded = json.dumps(value, sort_keys=True, ensure_ascii=False).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()[:16]


# compute a sha256 file digest for the batch manifest id.
def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


# parse comma-separated target years from the command line.
def parse_target_years(value: str) -> list[int]:
    years = [int(part.strip()) for part in value.split(",") if part.strip()]
    if not years:
        raise ValueError("at least one target year is required")
    return years


# parse a numeric cell, returning none for blank or invalid values.
def parse_float(value: str) -> float | None:
    try:
        return float(value)
    except ValueError:
        return None


# normalise a Convex source type, keeping unexpected values reviewable.
def source_type(value: str) -> str:
    return value if value in SOURCE_TYPES else "other"


# normalise target-year status values to the small controlled vocabulary.
def target_status(value: str) -> str:
    return value if value in TARGET_STATUSES else "not_assessed"


# normalise privacy and licence flags for Convex evidence drafts.
def review_flag(value: str, default: str) -> str:
    return value if value in FLAGS else default


# normalise OSM object types to the Convex task vocabulary.
def osm_object_type(value: str) -> str:
    return value if value in {"node", "way", "relation"} else ""


# create a deterministic task id from row identifiers or row content.
def task_id_for(row: dict[str, str], country_code: str, row_number: int) -> str:
    explicit = first_text(row, ["evidence_row_id", "source_record_id", "candidate_site_id", "matched_current_site_id"])
    suffix = slug(explicit) if explicit else f"row-{row_number:04d}-{stable_hash(row)}"
    return f"{country_code.lower()}-spreadsheet-{suffix}"


# create a deterministic evidence draft id from the task and row id.
def draft_id_for(task_id: str, row: dict[str, str], row_number: int) -> str:
    explicit = first_text(row, ["evidence_row_id", "source_record_id"])
    suffix = slug(explicit) if explicit else f"row-{row_number:04d}-{stable_hash(row)}"
    return f"{task_id}:spreadsheet:{suffix}"


# choose a review task type from match fields.
def task_type_for(row: dict[str, str]) -> str:
    if text(row, "matched_current_site_id"):
        return "verify_existing_site"
    if text(row, "candidate_site_id") or first_text(row, ["latitude", "longitude", "historical_locality_raw", "locality_raw"]):
        return "missing_from_project_map"
    return "other"


# choose a provisional action label for the reviewer portal.
def action_for(row: dict[str, str]) -> str:
    if not text(row, "matched_current_site_id"):
        return "missing_current_site"
    if text(row, "worship_use_status") in {"not_worship", "no_building_present"}:
        return "closed_or_changed_use"
    if text(row, "denomination_or_tradition_raw"):
        return "denomination_or_shared_use"
    return "needs_review"


# build a GeoJSON geometry without inventing exact coordinates.
def geometry_for(row: dict[str, str], country_code: str) -> dict[str, Any]:
    latitude = parse_float(text(row, "latitude"))
    longitude = parse_float(text(row, "longitude"))
    if latitude is not None and longitude is not None:
        return {"type": "Point", "coordinates": [longitude, latitude]}
    return {
        "type": "Point",
        "coordinates": [],
        "properties": {
            "country_centre_hint": COUNTRY_CENTRES.get(country_code, []),
            "geocoding_basis": text(row, "geocoding_basis") or "not_geocoded",
        },
    }


# collect target-year status and evidence cells for the requested country.
def target_year_fields(row: dict[str, str], target_years: list[int]) -> tuple[dict[str, str], dict[str, str]]:
    statuses: dict[str, str] = {}
    evidence: dict[str, str] = {}
    for year in target_years:
        year_key = str(year)
        statuses[year_key] = target_status(text(row, f"target_year_{year}_status"))
        year_evidence = text(row, f"target_year_{year}_evidence")
        if year_evidence:
            evidence[year_key] = year_evidence
    return statuses, evidence


# choose the first lifecycle date represented by the wide row.
def lifecycle_from_row(row: dict[str, str]) -> dict[str, str]:
    for event, date_field, precision_field in LIFECYCLE_FIELDS:
        date = text(row, date_field)
        if date:
            return {
                "event": event,
                "date": date,
                "precision": text(row, precision_field) or "unknown",
            }
    return {}


# preserve the spreadsheet row as both structured JSON and TSV.
def generated_wide_row(row: dict[str, str], fieldnames: list[str]) -> dict[str, Any]:
    ordered = {field: text(row, field) for field in fieldnames}
    return {
        "fields": fieldnames,
        "row": ordered,
        "tsv": "\t".join(ordered[field] for field in fieldnames),
    }


# convert one spreadsheet row into an evidence draft input.
def draft_from_row(
    row: dict[str, str],
    *,
    fieldnames: list[str],
    target_years: list[int],
    imported_at: str,
    source_file: Path,
    submitter_email: str,
    submitter_name: str,
) -> dict[str, Any]:
    statuses, evidence = target_year_fields(row, target_years)
    lifecycle = lifecycle_from_row(row)
    evidence_note = first_text(row, ["review_note", "date_evidence_summary", "visual_verification_summary", "source_notes"])
    draft = {
        "source_type": source_type(text(row, "source_type")),
        "provider": text(row, "provider") or undefined_none(text(row, "visual_verification_source")),
        "source_title": text(row, "source_title"),
        "source_url_or_file": first_text(row, ["source_url_or_file", "raw_file_location", "visual_verification_url_or_file"]),
        "source_date_or_capture_date": first_text(row, ["retrieval_date", "visual_verification_capture_date", "extracted_at"]),
        "address_raw": first_text(row, ["address_raw", "historical_address_raw", "modern_address_candidate"]),
        "locality_raw": first_text(row, ["locality_raw", "historical_locality_raw", "area_hint"]),
        "address_change_note": text(row, "address_change_note"),
        "source_notes": text(row, "source_notes"),
        "action": action_for(row),
        "target_year_statuses": statuses,
        "target_year_evidence": evidence,
        "existence_status": text(row, "existence_status") or "uncertain",
        "worship_use_status": text(row, "worship_use_status") or "uncertain",
        "assessment_confidence": text(row, "quality_flag"),
        "match_confidence": text(row, "match_confidence") or "medium",
        "geocoding_confidence": text(row, "geocoding_confidence") or "low",
        "lifecycle_event": lifecycle.get("event"),
        "lifecycle_date": lifecycle.get("date"),
        "lifecycle_date_precision": lifecycle.get("precision"),
        "lifecycle_note": first_text(row, ["date_evidence_raw", "date_evidence_summary"]),
        "related_ids_or_note": first_text(row, ["candidate_match_notes", "matched_osm_id", "matched_current_site_id"]),
        "evidence_note": evidence_note or "Imported spreadsheet row for reviewer triage.",
        "generated_wide_row": generated_wide_row(row, fieldnames),
        "privacy_flag": review_flag(text(row, "privacy_flag"), "clear"),
        "licence_flag": review_flag(text(row, "licence_flag"), "needs_review"),
        "validation_summary": {
            "status": "spreadsheet_imported",
            "imported_at": imported_at,
            "source_file": str(source_file),
            "submitter_email": submitter_email or None,
            "submitter_name": submitter_name or None,
            "messages": ["Imported from an RA spreadsheet export; reviewer must validate before export."],
        },
    }
    return compact_dict(draft)


# return none for blank strings so optional fields can be omitted.
def undefined_none(value: str) -> str | None:
    return value or None


# convert one spreadsheet row into a Convex task input.
def task_from_row(
    row: dict[str, str],
    *,
    batch_id: str,
    country_code: str,
    target_years: list[int],
    row_number: int,
) -> dict[str, Any]:
    task_id = task_id_for(row, country_code, row_number)
    name = first_text(row, ["name_standardised", "name_raw", "source_title"]) or "Unnamed place of worship"
    candidate_site_id = text(row, "candidate_site_id") or ("" if text(row, "matched_current_site_id") else f"candidate:{task_id}")
    task = {
        "task_id": task_id,
        "batch_id": batch_id,
        "country_code": country_code,
        "task_type": task_type_for(row),
        "priority": "medium",
        "status": "needs_review",
        "target_years": target_years,
        "matched_current_site_id": text(row, "matched_current_site_id"),
        "candidate_site_id": candidate_site_id,
        "source_record_id": first_text(row, ["source_record_id", "evidence_row_id"]),
        "matched_osm_id": text(row, "matched_osm_id"),
        "osm_object_type": osm_object_type(text(row, "osm_object_type")),
        "name": name,
        "address": first_text(row, ["address_standardised", "modern_address_candidate", "address_raw"]),
        "locality": first_text(row, ["locality_raw", "historical_locality_raw", "area_hint"]),
        "geometry": geometry_for(row, country_code),
        "nearby_site_refs": [],
        "automated_checks": [
            {
                "check_id": "spreadsheet_submission",
                "severity": "warning",
                "message": "Imported from an RA spreadsheet; validate source, identity, target-year statuses, and licence before export.",
                "suggested_action": "review_evidence",
            }
        ],
        "task_brief": f"Review spreadsheet-submitted evidence for {name}.",
        "source_context": {
            "interface_type": "google_sheet_or_csv",
            "spreadsheet_row_number": row_number,
            "latest_name": name,
            "denomination": text(row, "denomination_or_tradition_raw"),
            "source_title": text(row, "source_title"),
            "source_dataset_id": text(row, "source_dataset_id"),
            "source_hints": first_text(row, ["source_notes", "date_evidence_summary"]),
            "review_status": text(row, "review_status"),
            "target_year_statuses": target_year_fields(row, target_years)[0],
        },
    }
    return compact_dict(task)


# read rows while preserving the CSV header order for generated wide rows.
def read_rows(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        fieldnames = reader.fieldnames or []
        rows = [
            {key: value for key, value in row.items() if key is not None}
            for row in reader
            if any(str(value or "").strip() for value in row.values())
        ]
    return fieldnames, rows


# build the full Convex mutation payload.
def build_payload(
    input_path: Path,
    *,
    batch_id: str,
    country_code: str,
    target_years: list[int],
    submitter_email: str,
    submitter_name: str,
) -> dict[str, Any]:
    fieldnames, rows = read_rows(input_path)
    imported_at = datetime.now(UTC).isoformat()
    file_hash = sha256_file(input_path)
    tasks = [
        task_from_row(
            row,
            batch_id=batch_id,
            country_code=country_code,
            target_years=target_years,
            row_number=index,
        )
        for index, row in enumerate(rows, start=1)
    ]
    drafts = [
        compact_dict({
            "task_id": task["task_id"],
            "evidence_draft_id": draft_id_for(task["task_id"], row, index),
            "draft": draft_from_row(
                row,
                fieldnames=fieldnames,
                target_years=target_years,
                imported_at=imported_at,
                source_file=input_path,
                submitter_email=submitter_email,
                submitter_name=submitter_name,
            ),
            "submit_note": "Imported from an RA spreadsheet export.",
            "submitter_email": submitter_email or None,
            "submitter_name": submitter_name or None,
        })
        for index, (row, task) in enumerate(zip(rows, tasks, strict=True), start=1)
    ]
    return {
        "batch": {
            "batch_id": batch_id,
            "country_code": country_code,
            "source_kind": "spreadsheet_submission",
            "source_manifest_id": file_hash,
            "target_years": target_years,
            "status": "active",
            "notes": (
                "Seeded from an RA spreadsheet export. Task state and submitted "
                "evidence are provisional until reviewer acceptance and pow validation. "
                f"Input SHA-256: {file_hash}."
            ),
        },
        "tasks": tasks,
        "drafts": drafts,
    }


# parse command-line options for the spreadsheet import builder.
def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--batch-id", default=DEFAULT_BATCH_ID)
    parser.add_argument("--country-code", default="VU")
    parser.add_argument("--target-years", default=",".join(str(year) for year in DEFAULT_TARGET_YEARS))
    parser.add_argument("--submitter-email", default="")
    parser.add_argument("--submitter-name", default="")
    parser.add_argument("--compact", action="store_true", help="Write compact JSON instead of indented JSON.")
    return parser.parse_args()


# write the payload to disk or stdout.
def main() -> None:
    args = parse_args()
    target_years = parse_target_years(args.target_years)
    payload = build_payload(
        args.input,
        batch_id=args.batch_id,
        country_code=args.country_code.upper(),
        target_years=target_years,
        submitter_email=args.submitter_email.strip().lower(),
        submitter_name=args.submitter_name.strip(),
    )
    indent = None if args.compact else 2
    output = json.dumps(payload, ensure_ascii=False, indent=indent)
    if args.output is None:
        print(output)
        return
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(output + "\n", encoding="utf-8")
    print(f"wrote {len(payload['tasks'])} spreadsheet submissions to {args.output}")


if __name__ == "__main__":
    main()
