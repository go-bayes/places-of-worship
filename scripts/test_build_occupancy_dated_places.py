"""Tests for the per-occupancy dated-places builder (python3 -m unittest scripts/test_build_occupancy_dated_places.py)."""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import build_occupancy_dated_places as builder  # noqa: E402


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.write_text("".join(json.dumps(row) + "\n" for row in rows), encoding="utf-8")


BASE_ROW = {
    "task_id": "nz-t1",
    "parent_evidence_draft_id": "ed1",
    "claim_status": "submitted",
    "contract_version": "occupancy_v1",
    "location_mode": "building_identified",
    "location_basis": "map_placement",
    "location_confidence": "high",
    "confidence": "moderate",
    "confidence_basis": "b",
    "source_basis": "named_public_source",
    "source_title": "t",
    "source_account": "a",
    "privacy_flag": "clear",
    "created_by": "u1",
    "created_at": 1,
    "updated_at": 1,
}


class BoundsTests(unittest.TestCase):
    def test_known_dates_pin_both_bounds(self):
        bounds = builder.occupancy_bounds({**BASE_ROW, "start_mode": "known", "start_date": "1899-05", "end_mode": "known", "end_date": "1960"})
        self.assertEqual((bounds["start_lower"], bounds["start_upper"]), (1899, 1899))
        self.assertEqual((bounds["end_lower"], bounds["end_upper"]), (1960, 1960))
        self.assertEqual(builder.predicate_years(bounds), (1899, 1960))

    def test_between_and_after_leave_the_right_bound_open(self):
        bounds = builder.occupancy_bounds({**BASE_ROW, "start_mode": "between", "start_not_earlier_than": "1899", "start_not_later_than": "1901", "end_mode": "after", "end_not_earlier_than": "1955"})
        self.assertEqual((bounds["start_lower"], bounds["start_upper"]), (1899, 1901))
        self.assertEqual((bounds["end_lower"], bounds["end_upper"]), (1955, None))
        # start_year is the earliest possible start; an open end renders as still standing
        self.assertEqual(builder.predicate_years(bounds), (1899, None))

    def test_by_start_uses_the_upper_bound_for_start_year(self):
        bounds = builder.occupancy_bounds({**BASE_ROW, "start_mode": "by", "start_not_later_than": "1920", "end_mode": "still_active", "still_active_asof": "2010-06-01"})
        self.assertEqual((bounds["start_lower"], bounds["start_upper"]), (None, 1920))
        self.assertEqual(builder.predicate_years(bounds), (1920, None))

    def test_unknown_start_never_renders_and_unknown_end_is_flagged(self):
        bounds = builder.occupancy_bounds({**BASE_ROW, "start_mode": "unknown", "end_mode": "unknown"})
        self.assertEqual(builder.predicate_years(bounds), (None, None))
        self.assertTrue(bounds["end_unknown"])


class BuildTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.regions = root / "regions"
        (self.regions / "nz" / "data").mkdir(parents=True)
        (self.regions / "vu" / "data").mkdir(parents=True)
        # nz already carries an osm feature and a stale reviewed feature to be replaced
        (self.regions / "nz" / "data" / "dated_places.geojson").write_text(json.dumps({
            "type": "FeatureCollection",
            "attribution": "osm",
            "features": [
                {"type": "Feature", "geometry": {"type": "Point", "coordinates": [174.1, -35.2]},
                 "properties": {"osm_type": "way", "osm_id": 156937962, "name": "Christ Church", "religion": "christian", "denomination": "anglican", "start_year": 1835, "end_year": None}},
                {"type": "Feature", "geometry": {"type": "Point", "coordinates": [0, 0]},
                 "properties": {"source": "reviewed_occupancy", "kind": "occupancy", "name": "stale", "start_year": 1, "end_year": 2}},
            ],
        }), encoding="utf-8")
        (self.regions / "vu" / "data" / "dated_places.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": []}), encoding="utf-8")
        self.export = root / "export-1"
        self.export.mkdir()
        (self.export / "export_manifest.json").write_text(json.dumps({"export_batch_id": "batch-7"}), encoding="utf-8")
        write_jsonl(self.export / "tasks.jsonl", [
            {"task_id": "nz-t1", "country_code": "NZ", "name": "St Test", "candidate_site_id": "site-nz-1", "matched_osm_id": "156937962", "osm_object_type": "way"},
            {"task_id": "vu-t1", "country_code": "VU", "name": "Port Vila Chapel"},
        ])
        write_jsonl(self.export / "site_occupancies.jsonl", [
            {**BASE_ROW, "occupancy_id": "o1", "segment_index": 0, "start_mode": "between", "start_not_earlier_than": "1899", "start_not_later_than": "1901", "start_basis": "founding_stated", "end_mode": "known", "end_date": "1960", "end_basis": "closure_stated", "end_reason": "relocated", "location_relation": "distinct", "latitude": -41.30, "longitude": 174.79, "location_mode": "approximate_area", "location_basis": "address_or_locality", "uncertainty_radius_m": 300},
            {**BASE_ROW, "occupancy_id": "o2", "segment_index": 1, "start_mode": "known", "start_date": "1961", "start_basis": "building_dedication", "end_mode": "still_active", "end_basis": "unknown", "still_active_asof": "2026-08-15", "location_relation": "same_as_task_point", "latitude": -41.29, "longitude": 174.78},
            {**BASE_ROW, "occupancy_id": "o3", "segment_index": 2, "start_mode": "known", "start_date": "1970", "start_basis": "founding_stated", "end_mode": "unknown", "end_basis": "unknown", "location_relation": "same_as_task_point", "latitude": -41.29, "longitude": 174.78},
            {**BASE_ROW, "occupancy_id": "old", "segment_index": 0, "claim_status": "superseded", "start_mode": "known", "start_date": "1900", "start_basis": "founding_stated", "end_mode": "unknown", "end_basis": "unknown", "location_relation": "same_as_task_point", "latitude": -41.29, "longitude": 174.78},
            {**BASE_ROW, "task_id": "vu-t1", "parent_evidence_draft_id": "ed9", "occupancy_id": "v1", "segment_index": 0, "start_mode": "known", "start_date": "1950", "start_basis": "founding_stated", "end_mode": "still_active", "end_basis": "unknown", "still_active_asof": "2020-01-01", "location_relation": "same_as_task_point", "latitude": -17.74, "longitude": 168.32},
        ])
        write_jsonl(self.export / "derived_year_locations.jsonl", [
            {"occupancy_id": "o1", "review_state": "reviewer_confirmed", "target_year": 1950},
            {"occupancy_id": "o2", "review_state": "reviewer_confirmed", "target_year": 2013},
            {"occupancy_id": "o3", "review_state": "derived_unconfirmed", "target_year": 2018},
            {"occupancy_id": "old", "review_state": "reviewer_confirmed", "target_year": 2013},
            {"occupancy_id": "v1", "review_state": "reviewer_overridden", "target_year": 1989},
        ])

    def tearDown(self):
        self.tmp.cleanup()

    def test_build_writes_accepted_occupancies_and_keeps_osm(self):
        summary = builder.build_products([self.export], self.regions)
        nz = json.loads((self.regions / "nz" / "data" / "dated_places.geojson").read_text(encoding="utf-8"))
        props = [f["properties"] for f in nz["features"]]
        # osm feature kept, stale reviewed feature gone, unconfirmed and superseded rows excluded
        self.assertEqual(props[0]["osm_id"], 156937962)
        self.assertNotIn("stale", [p.get("name") for p in props])
        kinds = [(p.get("kind"), p.get("occupancy_id")) for p in props[1:]]
        self.assertEqual(kinds, [("occupancy", "o1"), ("occupancy", "o2"), ("transition", None)])
        self.assertEqual(nz["attribution"], "osm")
        self.assertEqual(summary["countries"]["NZ"]["occupancy_features"], 2)
        self.assertEqual(summary["countries"]["NZ"]["transition_features"], 1)
        self.assertTrue(summary["countries"]["NZ"]["written"])

    def test_occupancy_feature_properties(self):
        builder.build_products([self.export], self.regions)
        nz = json.loads((self.regions / "nz" / "data" / "dated_places.geojson").read_text(encoding="utf-8"))
        first = next(f for f in nz["features"] if f["properties"].get("occupancy_id") == "o1")
        p = first["properties"]
        self.assertEqual(first["geometry"]["coordinates"], [174.79, -41.3])
        self.assertEqual((p["start_year"], p["end_year"]), (1899, 1960))
        self.assertEqual((p["start_lower"], p["start_upper"], p["end_lower"], p["end_upper"]), (1899, 1901, 1960, 1960))
        self.assertEqual(p["radius_m"], 300)
        self.assertEqual(p["pow_site_id"], "site-nz-1")
        self.assertEqual(p["end_reason"], "relocated")
        self.assertEqual(p["source"], "reviewed_occupancy")
        self.assertEqual(p["export_batch_id"], "batch-7")
        self.assertEqual((p["religion"], p["denomination"]), ("christian", "anglican"))
        self.assertAlmostEqual(p["cos_lat"], 0.751264, places=5)
        second = next(f for f in nz["features"] if f["properties"].get("occupancy_id") == "o2")
        self.assertEqual((second["properties"]["start_year"], second["properties"]["end_year"]), (1961, None))
        self.assertEqual(second["properties"]["still_active_asof"], "2026-08-15")
        self.assertNotIn("radius_m", second["properties"])
        self.assertNotIn("end_lower", second["properties"])

    def test_transition_line_spans_both_windows(self):
        builder.build_products([self.export], self.regions)
        nz = json.loads((self.regions / "nz" / "data" / "dated_places.geojson").read_text(encoding="utf-8"))
        line = next(f for f in nz["features"] if f["properties"].get("kind") == "transition")
        self.assertEqual(line["geometry"]["type"], "LineString")
        self.assertEqual(line["geometry"]["coordinates"], [[174.79, -41.3], [174.78, -41.29]])
        self.assertEqual((line["properties"]["year_lower"], line["properties"]["year_upper"]), (1960, 1961))
        self.assertEqual((line["properties"]["from_occupancy_id"], line["properties"]["to_occupancy_id"]), ("o1", "o2"))

    def test_overridden_rows_do_not_reach_the_map_and_empty_products_stay_unwired(self):
        summary = builder.build_products([self.export], self.regions)
        vu = json.loads((self.regions / "vu" / "data" / "dated_places.geojson").read_text(encoding="utf-8"))
        self.assertEqual(vu["features"], [])
        self.assertNotIn("wiring_needed", summary["countries"]["VU"])

    def test_first_feature_flags_the_wiring_rule(self):
        write_jsonl(self.export / "derived_year_locations.jsonl", [
            {"occupancy_id": "v1", "review_state": "reviewer_confirmed", "target_year": 1989},
        ])
        summary = builder.build_products([self.export], self.regions)
        self.assertTrue(summary["countries"]["VU"]["wiring_needed"])
        self.assertEqual(summary["countries"]["VU"]["occupancy_features"], 1)

    def test_dry_run_writes_nothing(self):
        before = (self.regions / "nz" / "data" / "dated_places.geojson").read_text(encoding="utf-8")
        summary = builder.build_products([self.export], self.regions, dry_run=True)
        self.assertEqual(before, (self.regions / "nz" / "data" / "dated_places.geojson").read_text(encoding="utf-8"))
        self.assertTrue(summary["dry_run"])
        self.assertNotIn("written", summary["countries"]["NZ"])

    def test_rerun_is_idempotent(self):
        builder.build_products([self.export], self.regions)
        once = (self.regions / "nz" / "data" / "dated_places.geojson").read_text(encoding="utf-8")
        builder.build_products([self.export], self.regions)
        self.assertEqual(once, (self.regions / "nz" / "data" / "dated_places.geojson").read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
