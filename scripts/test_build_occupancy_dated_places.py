"""Tests for the per-occupancy dated-places builder (python3 -m unittest scripts/test_build_occupancy_dated_places.py)."""

from __future__ import annotations

import json
import copy
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


ORIGINAL = [174.7800, -41.2900]  # the record's point, where the source task's pin sits
MOVED = [174.7900, -41.2800]     # the contributor's moved pin on the revision task
DISTINCT = [174.6000, -41.4000]  # a period with its own asserted location, not on any pin


class LocationRulingTests(unittest.TestCase):
    """A reviewer's location ruling decides where a revised record's pin stands on the public map."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.regions = root / "regions"
        (self.regions / "nz" / "data").mkdir(parents=True)
        self.export = root / "export-2"
        self.export.mkdir()
        write_jsonl(self.export / "tasks.jsonl", [
            {"task_id": "nz-src", "country_code": "NZ", "name": "St Ruled", "candidate_site_id": "site-nz-9",
             "geometry": {"type": "Point", "coordinates": ORIGINAL}},
            {"task_id": "nz-rev", "country_code": "NZ", "name": "St Ruled", "matched_current_site_id": "site-nz-9",
             "geometry": {"type": "Point", "coordinates": MOVED},
             "source_context": {"issue_report": {"issue_type": "geometry_check", "original_point": ORIGINAL, "source_task_id": "nz-src"}}},
        ])
        write_jsonl(self.export / "site_occupancies.jsonl", [
            # the source task: one period on its pin, then a relocation to a period with its own point
            {**BASE_ROW, "task_id": "nz-src", "parent_evidence_draft_id": "ed-src", "occupancy_id": "s1", "segment_index": 0,
             "start_mode": "known", "start_date": "1900", "start_basis": "founding_stated", "end_mode": "known", "end_date": "1950",
             "end_basis": "closure_stated", "end_reason": "relocated", "location_relation": "same_as_task_point",
             "longitude": ORIGINAL[0], "latitude": ORIGINAL[1]},
            {**BASE_ROW, "task_id": "nz-src", "parent_evidence_draft_id": "ed-src", "occupancy_id": "s2", "segment_index": 1,
             "start_mode": "known", "start_date": "1951", "start_basis": "building_dedication", "end_mode": "still_active",
             "end_basis": "unknown", "still_active_asof": "2026-01-01", "location_relation": "distinct",
             "location_mode": "approximate_area", "location_basis": "address_or_locality",
             "longitude": DISTINCT[0], "latitude": DISTINCT[1]},
            # the revision task re-records the first period on the moved pin
            {**BASE_ROW, "task_id": "nz-rev", "parent_evidence_draft_id": "ed-rev", "occupancy_id": "r1", "segment_index": 0,
             "start_mode": "known", "start_date": "1900", "start_basis": "founding_stated", "end_mode": "known", "end_date": "1950",
             "end_basis": "closure_stated", "location_relation": "same_as_task_point",
             "longitude": MOVED[0], "latitude": MOVED[1]},
        ])
        write_jsonl(self.export / "derived_year_locations.jsonl", [
            {"occupancy_id": "s1", "review_state": "reviewer_confirmed", "target_year": 1936},
            {"occupancy_id": "s2", "review_state": "reviewer_confirmed", "target_year": 2013},
            {"occupancy_id": "r1", "review_state": "reviewer_confirmed", "target_year": 1936},
        ])

    def tearDown(self):
        self.tmp.cleanup()

    def decide(self, *decisions: dict) -> None:
        base = {"task_id": "nz-rev", "evidence_draft_id": "ed-rev", "decision_status": "accepted_for_export", "created_at": 100}
        write_jsonl(self.export / "review_decisions.jsonl", [{**base, **d} for d in decisions])

    def features(self) -> dict[str, dict]:
        summary = builder.build_products([self.export], self.regions)
        nz = json.loads((self.regions / "nz" / "data" / "dated_places.geojson").read_text(encoding="utf-8"))
        by_id = {f["properties"].get("occupancy_id") or f["properties"].get("kind"): f for f in nz["features"]}
        by_id["_summary"] = summary["countries"]["NZ"]
        return by_id

    def test_no_decisions_file_leaves_every_row_on_its_own_point(self):
        f = self.features()
        self.assertEqual(f["s1"]["geometry"]["coordinates"], ORIGINAL)
        self.assertEqual(f["r1"]["geometry"]["coordinates"], MOVED)
        self.assertNotIn("location_outcome", f["s1"]["properties"])
        self.assertNotIn("location_uncertain_dropped", f["_summary"])

    def test_accept_moved_point_moves_the_whole_site_to_the_new_pin(self):
        self.decide({"location_outcome": "accept_moved_point"})
        f = self.features()
        # both rows that sat on the pin now stand at the moved point; the asserted period keeps its own
        self.assertEqual(f["s1"]["geometry"]["coordinates"], MOVED)
        self.assertEqual(f["r1"]["geometry"]["coordinates"], MOVED)
        self.assertEqual(f["s2"]["geometry"]["coordinates"], DISTINCT)
        self.assertEqual(f["s1"]["properties"]["location_outcome"], "accept_moved_point")
        self.assertEqual(f["s1"]["properties"]["location_ruled_by_task_id"], "nz-rev")
        self.assertNotIn("location_ruled_by_task_id", f["r1"]["properties"])
        self.assertNotIn("location_outcome", f["s2"]["properties"])
        # the relocation line now starts from the ruled point
        self.assertEqual(f["transition"]["geometry"]["coordinates"], [MOVED, DISTINCT])

    def test_keep_original_point_returns_the_revision_to_the_record(self):
        self.decide({"location_outcome": "keep_original_point"})
        f = self.features()
        self.assertEqual(f["r1"]["geometry"]["coordinates"], ORIGINAL)
        self.assertEqual(f["s1"]["geometry"]["coordinates"], ORIGINAL)
        self.assertEqual(f["r1"]["properties"]["location_outcome"], "keep_original_point")

    def test_uncertain_takes_the_pinned_rows_off_the_map(self):
        self.decide({"location_outcome": "uncertain"})
        f = self.features()
        self.assertNotIn("s1", f)
        self.assertNotIn("r1", f)
        self.assertNotIn("transition", f)
        self.assertEqual(f["s2"]["geometry"]["coordinates"], DISTINCT)
        self.assertEqual(f["_summary"]["occupancy_features"], 1)
        self.assertEqual(f["_summary"]["location_uncertain_dropped"], 2)

    def test_latest_accepting_decision_rules(self):
        self.decide({"location_outcome": "accept_moved_point", "created_at": 100},
                    {"location_outcome": "keep_original_point", "created_at": 200})
        f = self.features()
        self.assertEqual(f["r1"]["geometry"]["coordinates"], ORIGINAL)

    def test_decisions_without_a_ruling_or_not_accepted_are_ignored(self):
        self.decide({"decision_status": "accepted_for_export"},
                    {"location_outcome": "keep_original_point", "decision_status": "needs_more_evidence", "created_at": 300})
        f = self.features()
        self.assertEqual(f["r1"]["geometry"]["coordinates"], MOVED)
        self.assertNotIn("location_outcome", f["r1"]["properties"])

    def test_ruling_applies_only_to_rows_on_one_of_the_two_points(self):
        ruling = {"outcome": "accept_moved_point", "original": tuple(ORIGINAL), "moved": tuple(MOVED),
                  "accepted": tuple(MOVED), "task_id": "nz-rev", "created_at": 1}
        on_pin = {"location_relation": "same_as_task_point", "longitude": ORIGINAL[0], "latitude": ORIGINAL[1]}
        elsewhere = {"location_relation": "same_as_task_point", "longitude": 170.0, "latitude": -45.0}
        asserted = {"location_relation": "distinct", "longitude": ORIGINAL[0], "latitude": ORIGINAL[1]}
        self.assertTrue(builder.ruling_applies(on_pin, ruling))
        self.assertFalse(builder.ruling_applies(elsewhere, ruling))
        self.assertFalse(builder.ruling_applies(asserted, ruling))
        self.assertFalse(builder.ruling_applies(on_pin, None))
        self.assertEqual(builder.ruled_point(on_pin, ruling), tuple(MOVED))
        self.assertEqual(builder.ruled_point(elsewhere, ruling), (170.0, -45.0))

    # split the fixture by task while preserving each row's export batch
    def split_exports(self):
        data = builder.load_export(self.export)
        paths = []
        for task_id, task in data["tasks"].items():
            path = self.export.parent / task_id
            path.mkdir(exist_ok=True)
            rows = [row for row in data["occupancies"] if row["task_id"] == task_id]
            ids = {row["occupancy_id"] for row in rows}
            write_jsonl(path / "tasks.jsonl", [task])
            write_jsonl(path / "site_occupancies.jsonl", rows)
            write_jsonl(path / "derived_year_locations.jsonl", [row for row in data["derived_locations"] if row["occupancy_id"] in ids])
            write_jsonl(path / "review_decisions.jsonl", [row for row in data["review_decisions"] if row["task_id"] == task_id])
            paths.append(path)
        return paths

    # public features with only the input batch label removed for partition comparisons
    def product_without_batches(self, paths):
        summary = builder.build_products(paths, self.regions)
        product = json.loads((self.regions / "nz" / "data" / "dated_places.geojson").read_text())
        for feature in product["features"]:
            feature["properties"].pop("export_batch_id")
        summary["countries"]["NZ"].pop("wiring_needed", None)
        return product, summary["countries"]["NZ"]

    def test_location_outcomes_do_not_depend_on_export_partition_or_order(self):
        for outcome in builder.LOCATION_OUTCOMES:
            with self.subTest(outcome=outcome):
                self.decide({"location_outcome": outcome})
                expected, expected_summary = self.product_without_batches([self.export])
                paths = self.split_exports()
                for ordered in (paths, list(reversed(paths))):
                    actual, summary = self.product_without_batches(ordered)
                    self.assertEqual(actual, expected)
                    self.assertEqual(summary, expected_summary)

    def test_split_exports_retain_feature_batch_ids(self):
        self.decide({"location_outcome": "accept_moved_point"})
        builder.build_products(self.split_exports(), self.regions)
        product = json.loads((self.regions / "nz" / "data" / "dated_places.geojson").read_text())
        for feature in product["features"]:
            self.assertEqual(feature["properties"]["export_batch_id"], feature["properties"]["task_id"])

    def test_location_only_revision_resolves_a_nomination_through_its_source(self):
        tasks = builder.read_jsonl(self.export / "tasks.jsonl")
        tasks[1].pop("matched_current_site_id")
        write_jsonl(self.export / "tasks.jsonl", tasks)
        write_jsonl(self.export / "site_occupancies.jsonl", [row for row in builder.read_jsonl(self.export / "site_occupancies.jsonl") if row["task_id"] == "nz-src"])
        self.decide({"location_outcome": "accept_moved_point"})
        features = self.features()
        self.assertEqual(features["s1"]["geometry"]["coordinates"], MOVED)
        self.assertEqual(features["s1"]["properties"]["location_ruled_by_task_id"], "nz-rev")
        self.assertEqual(features["s2"]["geometry"]["coordinates"], DISTINCT)

    def test_repeated_pin_only_revisions_apply_to_the_original_occupancy(self):
        third = [174.8, -41.27]
        tasks = builder.read_jsonl(self.export / "tasks.jsonl")
        tasks.append({"task_id": "nz-rev2", "country_code": "NZ", "name": "St Ruled",
                      "geometry": {"type": "Point", "coordinates": third},
                      "source_context": {"issue_report": {"source_task_id": "nz-rev", "original_point": MOVED}}})
        write_jsonl(self.export / "tasks.jsonl", tasks)
        write_jsonl(self.export / "site_occupancies.jsonl", [row for row in builder.read_jsonl(self.export / "site_occupancies.jsonl") if row["task_id"] == "nz-src"])
        for first_outcome in builder.LOCATION_OUTCOMES:
            for outcome, expected in (("accept_moved_point", third), ("keep_original_point", MOVED), ("uncertain", None)):
                with self.subTest(first=first_outcome, last=outcome):
                    self.decide({"location_outcome": first_outcome},
                                {"task_id": "nz-rev2", "location_outcome": outcome, "created_at": 200})
                    features = self.features()
                    if expected is None:
                        self.assertNotIn("s1", features)
                        self.assertNotIn("transition", features)
                    else:
                        self.assertEqual(features["s1"]["geometry"]["coordinates"], expected)
                        self.assertEqual(features["transition"]["geometry"]["coordinates"], [expected, DISTINCT])
                        self.assertEqual(features["s1"]["properties"]["location_ruled_by_task_id"], "nz-rev2")
                    self.assertEqual(features["s2"]["geometry"]["coordinates"], DISTINCT)

    def test_overlapping_exports_use_the_latest_task_snapshot_once(self):
        self.decide({"location_outcome": "accept_moved_point"})
        old = builder.load_export(self.export)
        old.update(exported_at=100, export_batch_id="old")
        new = copy.deepcopy(old)
        new.update(exported_at=200, export_batch_id="new")
        new["review_decisions"][0]["location_outcome"] = "uncertain"
        for exports in ([old, new], [new, old], [old, new, new]):
            combined = builder.combine_exports(exports)
            self.assertEqual(len(combined["occupancies"]), len(new["occupancies"]))
            features = builder.features_from_export(combined, {})["NZ"]
            self.assertFalse(any(f["properties"].get("occupancy_id") in ("s1", "r1") for f in features))
            self.assertTrue(all(f["properties"]["export_batch_id"] == "new" for f in features))

    def test_conflicting_undated_exports_refuse_before_writing(self):
        self.decide({"location_outcome": "accept_moved_point"})
        self.features()
        product = self.regions / "nz" / "data" / "dated_places.geojson"
        before = product.read_bytes()
        paths = self.split_exports()
        write_jsonl(paths[1] / "review_decisions.jsonl", [{"task_id": "nz-rev", "decision_status": "accepted_for_export", "location_outcome": "uncertain"}])
        with self.assertRaisesRegex(ValueError, "Conflicting export snapshots"):
            builder.build_products([self.export, *paths], self.regions)
        self.assertEqual(product.read_bytes(), before)

    def test_invalid_revision_lineage_refuses_the_build(self):
        data = builder.load_export(self.export)
        data["tasks"]["nz-src"]["source_context"] = {"issue_report": {"source_task_id": "nz-rev"}}
        with self.assertRaisesRegex(ValueError, "cycle"):
            builder.combine_exports([data])
        data["tasks"]["nz-src"].pop("source_context")
        data["tasks"]["nz-src"]["country_code"] = "VU"
        with self.assertRaisesRegex(ValueError, "different countries"):
            builder.combine_exports([data])


if __name__ == "__main__":
    unittest.main()
