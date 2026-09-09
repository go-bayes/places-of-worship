#!/usr/bin/env python3
"""Emit one dated-places feature per reviewer-accepted occupancy.

PR-C of the ruled location-and-occupancy plan (docs/portal-location-and-occupancy-plan.md
section 3.5; build brief docs/development/public-map-occupancy-slider-brief-2026-09-02.md).

Reads one or more materialised Convex export directories (scripts/materialise_convex_export.py)
and merges reviewed occupancy features into each country's apps/regions/<cc>/data/dated_places.geojson,
beside the OpenStreetMap date-tag features that file already carries. Features written by this
script carry source "reviewed_occupancy" and are replaced wholesale on every run; OSM features are
never touched.

An occupancy is accepted when a reviewer has confirmed at least one derived census-year location
that cites it (derived_year_locations.review_state == "reviewer_confirmed"). Overridden and
unconfirmed derivations do not reach the public map.

A reviewer's location ruling (JB, 2026-09-07; convex/lib/locationOutcome.ts) decides where a
revised record's pin stands. The latest accepting decision that carries a `location_outcome` rules
for the whole site: rows that sit on the task's pin (`location_relation == "same_as_task_point"`)
move to the accepted point under `accept_moved_point`, return to the record's original point under
`keep_original_point`, and leave the public map under `uncertain`, because no point stands. Rows
with their own asserted location are untouched. The rebuild reads the ruling; it never infers one
from two points.

A revision task made through "Move the pin" or "Revise this place" names the record it revises in
`issue_report.source_task_id`. Once a reviewer accepts that revision for export and it holds at least
one accepted occupancy, the source task's whole occupancy set leaves the map: the revision's set
replaces it, as `supersedeEarlierOccupancySets` in convex/occupancies.ts retires an author's earlier
set within one task. Replacement is set-level; the builder never matches rows across tasks.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_REGIONS_ROOT = REPO_ROOT / "apps" / "regions"
SOURCE_TAG = "reviewed_occupancy"
REQUIRED_FILES = ("tasks.jsonl", "site_occupancies.jsonl", "derived_year_locations.jsonl")
LOCATION_OUTCOMES = ("accept_moved_point", "keep_original_point", "uncertain")
# two points closer than this are the same pin (about a decimetre)
SAME_POINT_DEGREES = 1e-6


# Read newline-delimited JSON into a list of dicts; a missing file is an empty list.
def read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


# The year of a partial date (YYYY, YYYY-MM, or YYYY-MM-DD); None for blanks.
def year_of(value: Any) -> int | None:
    if value is None:
        return None
    text = str(value).strip()
    if len(text) < 4 or not text[:4].isdigit():
        return None
    return int(text[:4])


# Year bounds of one occupancy: where its start and end can fall, by the entry mode.
# start_lower/start_upper bound the start; end_lower/end_upper bound the end. A bound the
# mode does not fix is None. end_unknown marks rule 10 (the end is not dated at all).
def occupancy_bounds(row: dict[str, Any]) -> dict[str, int | bool | None]:
    start_mode = row.get("start_mode")
    end_mode = row.get("end_mode")
    bounds: dict[str, int | bool | None] = {
        "start_lower": None,
        "start_upper": None,
        "end_lower": None,
        "end_upper": None,
        "end_unknown": False,
    }
    if start_mode == "known":
        year = year_of(row.get("start_date"))
        bounds["start_lower"] = year
        bounds["start_upper"] = year
    elif start_mode == "between":
        bounds["start_lower"] = year_of(row.get("start_not_earlier_than"))
        bounds["start_upper"] = year_of(row.get("start_not_later_than"))
    elif start_mode == "by":
        bounds["start_upper"] = year_of(row.get("start_not_later_than"))
    if end_mode == "known":
        year = year_of(row.get("end_date"))
        bounds["end_lower"] = year
        bounds["end_upper"] = year
    elif end_mode == "between":
        bounds["end_lower"] = year_of(row.get("end_not_earlier_than"))
        bounds["end_upper"] = year_of(row.get("end_not_later_than"))
    elif end_mode == "after":
        bounds["end_lower"] = year_of(row.get("end_not_earlier_than"))
    elif end_mode == "unknown":
        bounds["end_unknown"] = True
    # still_active leaves every end bound open: the place is presumed to continue
    return bounds


# The public-map predicate reads start_year and end_year. start_year is the earliest possible
# start (so the feature is visible through its start window); end_year is the latest possible
# end. A start no mode dates leaves start_year None and the feature never renders in period mode.
def predicate_years(bounds: dict[str, int | bool | None]) -> tuple[int | None, int | None]:
    start_year = bounds["start_lower"] if bounds["start_lower"] is not None else bounds["start_upper"]
    end_year = bounds["end_upper"]
    return (start_year if isinstance(start_year, int) else None, end_year if isinstance(end_year, int) else None)


# The stable public identifier of the place: the site id when the task carries one, else the task id.
def site_identifier(task: dict[str, Any]) -> str:
    for key in ("candidate_site_id", "matched_current_site_id"):
        value = task.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return str(task.get("task_id") or "")


# A [longitude, latitude] pair as floats; None for anything else.
def point_of(value: Any) -> tuple[float, float] | None:
    if not isinstance(value, (list, tuple)) or len(value) < 2:
        return None
    try:
        longitude, latitude = float(value[0]), float(value[1])
    except (TypeError, ValueError):
        return None
    if not (math.isfinite(longitude) and math.isfinite(latitude)):
        return None
    return (longitude, latitude)


# The contributor's pin: the task geometry.
def task_point(task: dict[str, Any]) -> tuple[float, float] | None:
    geometry = task.get("geometry")
    return point_of(geometry.get("coordinates")) if isinstance(geometry, dict) else None


# The record's original point, present only on a revision filed from an existing record.
def original_point(task: dict[str, Any]) -> tuple[float, float] | None:
    context = task.get("source_context")
    report = context.get("issue_report") if isinstance(context, dict) else None
    return point_of(report.get("original_point")) if isinstance(report, dict) else None


def same_point(a: tuple[float, float] | None, b: tuple[float, float] | None) -> bool:
    if a is None or b is None:
        return False
    return abs(a[0] - b[0]) <= SAME_POINT_DEGREES and abs(a[1] - b[1]) <= SAME_POINT_DEGREES


# The location ruling in force for each site: the latest accepting decision that carries a
# location_outcome, from a revision task that holds the record's original point. Mirrors
# acceptedPoint in convex/lib/locationOutcome.ts: the moved pin under accept_moved_point, the
# original under keep_original_point, and no point at all under uncertain.
def location_rulings(tasks: dict[str, dict[str, Any]], decisions: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    rulings: dict[str, dict[str, Any]] = {}
    for decision in decisions:
        outcome = decision.get("location_outcome")
        if decision.get("decision_status") != "accepted_for_export" or outcome not in LOCATION_OUTCOMES:
            continue
        task = tasks.get(str(decision.get("task_id")))
        if not task:
            continue
        original = original_point(task)
        moved = task_point(task)
        if original is None or moved is None:
            continue
        accepted = moved if outcome == "accept_moved_point" else original if outcome == "keep_original_point" else None
        ruling = {
            "outcome": outcome,
            "original": original,
            "moved": moved,
            "accepted": accepted,
            "task_id": task.get("task_id"),
            "created_at": decision.get("created_at") or 0,
        }
        site_id = site_identifier(task)
        current = rulings.get(site_id)
        if current is None or ruling["created_at"] >= current["created_at"]:
            rulings[site_id] = ruling
    return rulings


# The revision task that names this task as its source in issue_report.source_task_id.
def source_task_of(task: dict[str, Any]) -> str | None:
    context = task.get("source_context")
    report = context.get("issue_report") if isinstance(context, dict) else None
    source = report.get("source_task_id") if isinstance(report, dict) else None
    return str(source).strip() if isinstance(source, str) and source.strip() else None


# Tasks whose occupancy set an accepted revision replaced, keyed by the superseded task id with the
# revision that replaced it as value. A revision supersedes its source only when a reviewer has
# accepted the revision for export and it contributes at least one accepted occupancy row
# (`recording_task_ids`); a revision that recorded nothing leaves the source on the map. A chain of
# revisions retires every earlier link, whether or not the middle links still draw.
def superseded_tasks(
    tasks: dict[str, dict[str, Any]],
    decisions: list[dict[str, Any]],
    recording_task_ids: set[str],
) -> dict[str, str]:
    accepted = {str(d.get("task_id")) for d in decisions if d.get("decision_status") == "accepted_for_export"}
    out: dict[str, str] = {}
    for task_id, task in tasks.items():
        source = source_task_of(task)
        if source is None or source == task_id or task_id not in accepted or task_id not in recording_task_ids:
            continue
        out[source] = task_id
    return out


# Whether a ruling governs this row: the row sits on its task's pin and that pin is one of the two
# points the ruling chose between. A row with its own asserted location keeps it.
def ruling_applies(row: dict[str, Any], ruling: dict[str, Any] | None) -> bool:
    if ruling is None or row.get("location_relation") != "same_as_task_point":
        return False
    here = point_of([row.get("longitude"), row.get("latitude")])
    return same_point(here, ruling["original"]) or same_point(here, ruling["moved"])


# The point a row is drawn at once the ruling is read: the row's own point when no ruling
# governs it, the accepted point when one does, and None when the location is ruled uncertain.
def ruled_point(row: dict[str, Any], ruling: dict[str, Any] | None) -> tuple[float, float] | None:
    if not ruling_applies(row, ruling):
        return point_of([row.get("longitude"), row.get("latitude")])
    return ruling["accepted"]


# Religion and denomination for colouring, borrowed from the OSM feature the task matched.
def osm_attributes(task: dict[str, Any], osm_features: dict[str, dict[str, Any]]) -> dict[str, Any]:
    osm_id = task.get("matched_osm_id")
    if osm_id is None:
        return {}
    props = osm_features.get(str(osm_id))
    if not props:
        return {}
    out: dict[str, Any] = {}
    for key in ("religion", "denomination"):
        if props.get(key):
            out[key] = props[key]
    return out


# One point feature for an accepted occupancy row.
def occupancy_feature(
    row: dict[str, Any],
    task: dict[str, Any],
    export_batch_id: str,
    osm_features: dict[str, dict[str, Any]],
    ruling: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    point = ruled_point(row, ruling)
    if point is None:
        return None
    longitude, latitude = point
    bounds = occupancy_bounds(row)
    start_year, end_year = predicate_years(bounds)
    properties: dict[str, Any] = {
        "kind": "occupancy",
        "source": SOURCE_TAG,
        "tier": "accepted",
        "pow_site_id": site_identifier(task),
        "task_id": row.get("task_id"),
        "occupancy_id": row.get("occupancy_id"),
        "segment_index": row.get("segment_index"),
        "name": task.get("name") or "Unnamed place",
        "start_year": start_year,
        "end_year": end_year,
        "location_mode": row.get("location_mode"),
        "cos_lat": round(math.cos(math.radians(float(latitude))), 6),
        "export_batch_id": export_batch_id,
    }
    properties.update(osm_attributes(task, osm_features))
    if ruling_applies(row, ruling):
        properties["location_outcome"] = ruling["outcome"]
        if ruling["task_id"] != row.get("task_id"):
            properties["location_ruled_by_task_id"] = ruling["task_id"]
    for key in ("start_lower", "start_upper", "end_lower", "end_upper"):
        if isinstance(bounds[key], int):
            properties[key] = bounds[key]
    if bounds["end_unknown"]:
        properties["end_unknown"] = True
    if row.get("end_mode") == "still_active" and row.get("still_active_asof"):
        properties["still_active_asof"] = str(row["still_active_asof"])
    if row.get("end_reason"):
        properties["end_reason"] = row["end_reason"]
    radius = row.get("uncertainty_radius_m")
    if isinstance(radius, (int, float)) and radius > 0:
        properties["radius_m"] = radius
    if task.get("matched_osm_id") is not None:
        properties["osm_id"] = task.get("matched_osm_id")
        if task.get("osm_object_type"):
            properties["osm_type"] = task.get("osm_object_type")
    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [round(float(longitude), 6), round(float(latitude), 6)]},
        "properties": properties,
    }


# The years a transition between two consecutive occupancies can fall in: the union of the
# first period's end window and the second period's start window.
def transition_years(first: dict[str, int | bool | None], second: dict[str, int | bool | None]) -> tuple[int, int] | None:
    candidates = [
        value
        for value in (first["end_lower"], first["end_upper"], second["start_lower"], second["start_upper"])
        if isinstance(value, int)
    ]
    if not candidates:
        return None
    return (min(candidates), max(candidates))


# A dashed-line feature joining a relocation's two members while the transition is in progress.
def transition_feature(
    first: dict[str, Any],
    second: dict[str, Any],
    task: dict[str, Any],
    export_batch_id: str,
    ruling: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    years = transition_years(occupancy_bounds(first), occupancy_bounds(second))
    if years is None:
        return None
    start = ruled_point(first, ruling)
    end = ruled_point(second, ruling)
    if start is None or end is None:
        return None
    return {
        "type": "Feature",
        "geometry": {
            "type": "LineString",
            "coordinates": [
                [round(start[0], 6), round(start[1], 6)],
                [round(end[0], 6), round(end[1], 6)],
            ],
        },
        "properties": {
            "kind": "transition",
            "source": SOURCE_TAG,
            "pow_site_id": site_identifier(task),
            "task_id": first.get("task_id"),
            "from_occupancy_id": first.get("occupancy_id"),
            "to_occupancy_id": second.get("occupancy_id"),
            "name": task.get("name") or "Unnamed place",
            "year_lower": years[0],
            "year_upper": years[1],
            "export_batch_id": export_batch_id,
        },
    }


# Load one materialised export directory into the pieces the builder needs.
def load_export(export_dir: Path) -> dict[str, Any]:
    missing = [name for name in REQUIRED_FILES if not (export_dir / name).exists()]
    if missing:
        raise FileNotFoundError(f"{export_dir} lacks {', '.join(missing)}")
    manifest_path = export_dir / "export_manifest.json"
    export_batch_id = export_dir.name
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if isinstance(manifest, dict) and manifest.get("export_batch_id"):
            export_batch_id = str(manifest["export_batch_id"])
    return {
        "export_batch_id": export_batch_id,
        "tasks": {row["task_id"]: row for row in read_jsonl(export_dir / "tasks.jsonl") if row.get("task_id")},
        "occupancies": read_jsonl(export_dir / "site_occupancies.jsonl"),
        "derived_locations": read_jsonl(export_dir / "derived_year_locations.jsonl"),
        # optional: an export made before location rulings existed carries no decisions file
        "review_decisions": read_jsonl(export_dir / "review_decisions.jsonl"),
    }


# Add one to a per-reason, per-country count of rows that do not reach the map.
def count_dropped(dropped: dict[str, dict[str, int]] | None, reason: str, country: str) -> None:
    if dropped is None:
        return
    counts = dropped.setdefault(reason, {})
    counts[country] = counts.get(country, 0) + 1


# Features per country from one export: accepted occupancy points and their transition lines.
# Rows that do not reach the map are counted in `dropped` by reason: "uncertain" for rows whose
# location a reviewer ruled uncertain, "superseded" for rows on a task an accepted revision replaced.
def features_from_export(
    export: dict[str, Any],
    osm_by_country: dict[str, dict[str, dict[str, Any]]],
    dropped: dict[str, dict[str, int]] | None = None,
) -> dict[str, list[dict[str, Any]]]:
    accepted = {
        row.get("occupancy_id")
        for row in export["derived_locations"]
        if row.get("review_state") == "reviewer_confirmed" and row.get("occupancy_id")
    }
    decisions = export.get("review_decisions", [])
    rulings = location_rulings(export["tasks"], decisions)
    by_parent: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in export["occupancies"]:
        if row.get("claim_status") != "submitted" or row.get("occupancy_id") not in accepted:
            continue
        by_parent[str(row.get("parent_evidence_draft_id"))].append(row)
    recording = {str(rows[0].get("task_id")) for rows in by_parent.values()}
    superseded = superseded_tasks(export["tasks"], decisions, recording)
    out: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for rows in by_parent.values():
        rows.sort(key=lambda r: (r.get("segment_index") or 0))
        task = export["tasks"].get(rows[0].get("task_id"))
        if not task:
            continue
        country = str(task.get("country_code") or "").upper()
        if not country:
            continue
        if str(task.get("task_id")) in superseded:
            for _ in rows:
                count_dropped(dropped, "superseded", country)
            continue
        osm_features = osm_by_country.get(country, {})
        ruling = rulings.get(site_identifier(task))
        for row in rows:
            feature = occupancy_feature(row, task, export["export_batch_id"], osm_features, ruling)
            if feature:
                out[country].append(feature)
            elif ruling_applies(row, ruling) and ruling["accepted"] is None:
                count_dropped(dropped, "uncertain", country)
        for first, second in zip(rows, rows[1:]):
            if first.get("end_reason") != "relocated":
                continue
            line = transition_feature(first, second, task, export["export_batch_id"], ruling)
            if line:
                out[country].append(line)
    return out


# Read a country's current dated-places file; an absent file is an empty collection.
def load_country_file(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"type": "FeatureCollection", "features": []}
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or not isinstance(data.get("features"), list):
        raise ValueError(f"{path} is not a GeoJSON FeatureCollection")
    return data


# OSM features by osm id, for borrowing religion and denomination.
def osm_index(collection: dict[str, Any]) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for feature in collection.get("features", []):
        props = feature.get("properties") or {}
        if props.get("source") == SOURCE_TAG:
            continue
        if props.get("osm_id") is not None:
            out[str(props["osm_id"])] = props
    return out


# Replace the reviewed tier of a collection with new features; OSM features stay as they were.
def merge_features(collection: dict[str, Any], reviewed: list[dict[str, Any]]) -> dict[str, Any]:
    kept = [f for f in collection.get("features", []) if (f.get("properties") or {}).get("source") != SOURCE_TAG]
    ordered = sorted(reviewed, key=lambda f: (
        f["properties"].get("kind") != "occupancy",
        str(f["properties"].get("pow_site_id")),
        f["properties"].get("segment_index") if f["properties"].get("segment_index") is not None else -1,
        str(f["properties"].get("from_occupancy_id") or ""),
    ))
    return {**collection, "type": "FeatureCollection", "features": kept + ordered}


# Build every country's product from the given exports; returns a per-country summary.
def build_products(export_dirs: list[Path], regions_root: Path, dry_run: bool = False) -> dict[str, Any]:
    exports = [load_export(path) for path in export_dirs]
    countries = sorted({
        str(task.get("country_code") or "").upper()
        for export in exports
        for task in export["tasks"].values()
        if task.get("country_code")
    })
    collections: dict[str, dict[str, Any]] = {}
    osm_by_country: dict[str, dict[str, dict[str, Any]]] = {}
    for country in countries:
        path = regions_root / country.lower() / "data" / "dated_places.geojson"
        collections[country] = load_country_file(path)
        osm_by_country[country] = osm_index(collections[country])
    reviewed: dict[str, list[dict[str, Any]]] = defaultdict(list)
    dropped: dict[str, dict[str, int]] = {}
    for export in exports:
        for country, features in features_from_export(export, osm_by_country, dropped).items():
            reviewed[country].extend(features)
    summary: dict[str, Any] = {"countries": {}, "dry_run": dry_run}
    for country in countries:
        path = regions_root / country.lower() / "data" / "dated_places.geojson"
        before = collections[country]
        after = merge_features(before, reviewed.get(country, []))
        points = sum(1 for f in reviewed.get(country, []) if f["properties"].get("kind") == "occupancy")
        lines = sum(1 for f in reviewed.get(country, []) if f["properties"].get("kind") == "transition")
        entry = {
            "path": str(path.relative_to(REPO_ROOT)) if path.is_relative_to(REPO_ROOT) else str(path),
            "osm_features": len(after["features"]) - points - lines,
            "occupancy_features": points,
            "transition_features": lines,
            "total_features": len(after["features"]),
        }
        if dropped.get("uncertain", {}).get(country):
            entry["location_uncertain_dropped"] = dropped["uncertain"][country]
        if dropped.get("superseded", {}).get(country):
            entry["superseded_by_revision_dropped"] = dropped["superseded"][country]
        # the wiring rule (docs/development/temporal-place-layer.md): a product that gains
        # its first feature must be wired in the region config and the portal together
        if not before.get("features") and after["features"]:
            entry["wiring_needed"] = True
        if not dry_run and path.parent.exists():
            path.write_text(json.dumps(after, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
            entry["written"] = True
        elif not path.parent.exists():
            entry["skipped"] = f"no region directory {path.parent}"
        summary["countries"][country] = entry
    return summary


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("export_dirs", nargs="+", type=Path, help="materialised export directories")
    parser.add_argument("--regions-root", type=Path, default=DEFAULT_REGIONS_ROOT, help="apps/regions by default")
    parser.add_argument("--dry-run", action="store_true", help="report what would change without writing")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    summary = build_products(args.export_dirs, args.regions_root, dry_run=args.dry_run)
    print(json.dumps(summary, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
