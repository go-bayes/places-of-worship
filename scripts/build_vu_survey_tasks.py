#!/usr/bin/env python3
"""Seed Vanuatu verification tasks from the tabulated Port Vila church survey.

Input: apps/regions/vu/data/source/vu_port_vila_churches_2010.csv (batch-import format,
one row per worship site attested by Eriksen & Andrew 2010) and the archived OSM Vanuatu
place-of-worship extract for nearby-site hints. Output: a JSON payload for the Convex
mutation tasks:upsertTasksFromStaticMap ({"batch": ..., "tasks": [...]}) written to
exports/convex-task-seed/vu-port-vila-survey-2010-001.json (ignored local data, like the earlier
VU batches), plus a summary on stdout.

Every task records its provenance in source_record_id (the CSV row and survey locator) and
source_context.survey (citation, page locator, transcription notes), so the origin of any
task seeded from the survey can be queried. The mutation is idempotent on task_id, so the
payload can be re-run after corrections to the CSV without duplicating tasks.

Run: python3 scripts/build_vu_survey_tasks.py
Then (admin or service account on the portal deployment):
  paste the file's "batch" and "tasks" into the Convex dashboard function runner for
  tasks:upsertTasksFromStaticMap (docs/development/convex-task-layer-setup.md), or run it
  through an authenticated CLI on the portal deployment.
"""

from __future__ import annotations

import csv
import hashlib
import json
import math
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
CSV_PATH = REPO / "apps" / "regions" / "vu" / "data" / "source" / "vu_port_vila_churches_2010.csv"
OSM_PATH = REPO / "archive" / "osm-vu-pow" / "pow_vu.json"
OUT_PATH = REPO / "exports" / "convex-task-seed" / "vu-port-vila-survey-2010-001.json"

BATCH_ID = "vu-port-vila-survey-2010-001"
COUNTRY = "VU"
TARGET_YEARS = [1989, 1999, 2009, 2020]
SURVEY_CITATION = (
    "Eriksen, Annelin and Rose Andrew (2010). Churches in Port Vila. Bergen Pacific Studies "
    "Group / University of Bergen, under research agreement with the Vanuatu Cultural Centre."
)
PORT_VILA_CENTROID = (-17.7415, 168.3150)
NEARBY_RADIUS_M = 400


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def load_osm_points() -> list[dict]:
    if not OSM_PATH.exists():
        return []
    data = json.loads(OSM_PATH.read_text(encoding="utf-8"))
    elements = data.get("elements", data) if isinstance(data, dict) else data
    points = []
    for el in elements:
        lat = el.get("lat") or (el.get("center") or {}).get("lat")
        lng = el.get("lon") or (el.get("center") or {}).get("lon")
        if lat is None or lng is None:
            continue
        tags = el.get("tags", {})
        points.append({
            "osm_id": f"{el.get('type', 'node')}/{el.get('id')}",
            "name": tags.get("name") or "",
            "denomination": tags.get("denomination") or "",
            "lat": float(lat),
            "lng": float(lng),
        })
    return points


def task_id_for(row: dict, index: int) -> str:
    digest = hashlib.sha256(f"{row['source_locator']}|{row['name']}".encode("utf-8")).hexdigest()[:12]
    return f"vu-survey2010-{index:03d}-{digest}"


def priority_for(row: dict) -> str:
    # field verification order: located sites with a founding date or a direct OSM match
    # first, locality-only rows next, unlocated rows last
    if row["geocoding_basis"] == "map_georeference":
        return "high"
    if row["geocoding_basis"] == "regional_only":
        return "low"
    return "high" if row["first_date"] else "medium"


def checks_for(row: dict, nearby: list[dict]) -> list[dict]:
    checks = [{
        "check_id": "survey_derived_lead",
        "severity": "info",
        "message": "Site attested by Eriksen & Andrew (2010) interviews 2006-2010. Confirm on the ground: does worship use continue at this location, and where exactly is it?",
        "suggested_action": "seek_source_evidence",
    }]
    if row["geocoding_basis"] == "described_locality":
        checks.append({
            "check_id": "location_is_locality_centroid",
            "severity": "warning",
            "message": f"Point is the OSM centroid of '{row['locality']}', not the site. Record the actual location.",
            "suggested_action": "review_location",
        })
    elif row["geocoding_basis"] == "regional_only":
        checks.append({
            "check_id": "location_regional_only",
            "severity": "blocker",
            "message": "The survey gives no locality; the point is the Port Vila centroid. Locate the site or mark it unlocatable.",
            "suggested_action": "review_location",
        })
    if not row["denomination_code"]:
        checks.append({
            "check_id": "denomination_unmatched",
            "severity": "info",
            "message": f"'{row['religion']}' has no code in the project denomination taxonomy; record the body's own description.",
            "suggested_action": "review_if_needed",
        })
    if nearby:
        names = ", ".join(f"{n['name']} ({n['distance_m']} m)" for n in nearby[:3])
        checks.append({
            "check_id": "nearby_osm_place_of_worship",
            "severity": "info",
            "message": f"OSM place(s) of worship within {NEARBY_RADIUS_M} m: {names}. Check whether one is this site.",
            "suggested_action": "review_duplicate",
        })
    if "planned" in row["name"].lower() or "no worship site given" in row["notes"]:
        checks.append({
            "check_id": "site_status_uncertain",
            "severity": "warning",
            "message": "The survey does not attest a worship site here (planned church, programme, or order). Confirm whether a place of worship exists.",
            "suggested_action": "review_inclusion",
        })
    return checks


def brief_for(row: dict) -> str:
    when = row["last_date"] or "2010"
    founded = f" The survey dates it {row['first_date']} (see the transcription notes for what the date is)." if row["first_date"] else ""
    return (
        f"Verify {row['name']} ({row['religion']}) in {row['locality'] or row['containing_area']}, "
        f"attested by Eriksen & Andrew's Port Vila church survey ({when}).{founded} "
        f"Confirm whether worship use continues at this site in 2026, record the exact location, "
        f"and note any closure, move, rename, or change of use since the survey. "
        f"Survey locator: {row['source_locator']}."
    )


def build() -> dict:
    rows = list(csv.DictReader(CSV_PATH.open(encoding="utf-8")))
    csv_sha = hashlib.sha256(CSV_PATH.read_bytes()).hexdigest()
    osm_points = load_osm_points()
    tasks = []
    for index, row in enumerate(rows, start=1):
        if row["lat"]:
            lat, lng = float(row["lat"]), float(row["lng"])
        else:
            lat, lng = PORT_VILA_CENTROID
        nearby = []
        for p in osm_points:
            d = haversine_m(lat, lng, p["lat"], p["lng"])
            if d <= NEARBY_RADIUS_M:
                label = f"{p['name'] or 'unnamed place of worship'} (OSM {p['osm_id']})"
                nearby.append({"name": label, "distance_m": round(d)})
        nearby.sort(key=lambda n: n["distance_m"])
        checks = checks_for(row, nearby)
        tid = task_id_for(row, index)
        tasks.append({
            "task_id": tid,
            "batch_id": BATCH_ID,
            "country_code": COUNTRY,
            "task_type": "missing_from_project_map",
            "priority": priority_for(row),
            "status": "open",
            "target_years": TARGET_YEARS,
            "candidate_site_id": f"candidate:{tid}",
            "source_record_id": f"{CSV_PATH.relative_to(REPO)}:{index}",
            "name": row["name"],
            "locality": row["locality"],
            "geometry": {"type": "Point", "coordinates": [round(lng, 6), round(lat, 6)]},
            "nearby_site_refs": nearby[:5],
            "automated_checks": checks,
            "task_brief": brief_for(row),
            "source_context": {
                "case_type": "survey_derived_lead",
                "selection_reason": "Seeded from the tabulated Eriksen & Andrew (2010) Port Vila church survey for Guy Lavender Forsyth's field verification, August-September 2026.",
                "survey": {
                    "citation": SURVEY_CITATION,
                    "locator": row["source_locator"],
                    "religion_as_given": row["religion"],
                    "denomination_code": row["denomination_code"] or None,
                    "first_date": row["first_date"] or None,
                    "last_date": row["last_date"] or None,
                    "transcription_notes": row["notes"],
                },
                "location": {
                    "geocoding_basis": row["geocoding_basis"],
                    "location_confidence": row["location_confidence"],
                    "containing_area": row["containing_area"],
                },
                "source_file": str(CSV_PATH.relative_to(REPO)),
                "source_file_sha256": csv_sha,
                "source_row": index,
                "source_hints": "Start from the survey entry (page in the locator). Confirm on site or with the congregation; use Google Maps/imagery only as a secondary aid. Answer the cultural-sensitivity prompt before submitting.",
                "target_year_statuses": {str(y): {"status": "not_assessed", "basis": "", "evidence": ""} for y in TARGET_YEARS},
            },
        })
    batch = {
        "batch_id": BATCH_ID,
        "country_code": COUNTRY,
        "source_kind": "spreadsheet_submission",
        "source_manifest_id": f"vu_port_vila_churches_2010.csv:{csv_sha[:12]}",
        "target_years": TARGET_YEARS,
        "status": "active",
        "notes": (
            f"Port Vila worship sites seeded from {SURVEY_CITATION} Tabulated 2026-08-22 "
            f"(scripts/build_vu_port_vila_survey_2010.py); {len(tasks)} tasks; input SHA-256 {csv_sha}. "
            "Tasks are prompts for field verification by the Vanuatu RA, not accepted project records."
        ),
    }
    return {"batch": batch, "tasks": tasks}


SERVICE_ACTOR_EMAIL = "service+claude@religionmap.org"
RUN_PATH = OUT_PATH.with_suffix(".run.json")


def main() -> None:
    payload = build()
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    # compact args for the admin-key path, acting as the seeding service user:
    #   npx convex run tasks:adminUpsertTasksFromStaticMap "$(cat <RUN_PATH>)"
    RUN_PATH.write_text(
        json.dumps({"actor_email": SERVICE_ACTOR_EMAIL, **payload}, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    tasks = payload["tasks"]
    by_priority = {}
    for t in tasks:
        by_priority[t["priority"]] = by_priority.get(t["priority"], 0) + 1
    with_nearby = sum(1 for t in tasks if t["nearby_site_refs"])
    print(f"wrote {len(tasks)} tasks for batch {BATCH_ID} to {OUT_PATH.relative_to(REPO)}")
    print(f"wrote run args (actor {SERVICE_ACTOR_EMAIL}) to {RUN_PATH.relative_to(REPO)}")
    print(f"priority: {by_priority}; tasks with an OSM place of worship within {NEARBY_RADIUS_M} m: {with_nearby}")


if __name__ == "__main__":
    main()
