"""The python copies of the partial-date validators against the shared fixture.

Stage 1 of the deep-time dates (docs/development/deep-time-date-format-brief-2026-11-24.md):
every copy of the validators runs against schemas/fixtures/partial-dates.v1.json.
The node copies run in convex/lib/partialDates.node-test.mjs and the rust copies in
crates/pow-cli.
"""
import importlib.util
import json
import sys
import unittest
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))
import intake  # noqa: E402
import lib  # noqa: E402

FIXTURE = json.loads((ROOT / "schemas" / "fixtures" / "partial-dates.v1.json").read_text())
ROWS = FIXTURE["dates"]


def load_builder():
    spec = importlib.util.spec_from_file_location("build_occupancy_dated_places", ROOT / "scripts" / "build_occupancy_dated_places.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class PartialDatesTest(unittest.TestCase):
    def test_intake_date_bounds_is_a_historical_check(self):
        # scripts/agent_research/intake.py, the agent intake's pre-submit validator
        for row in ROWS:
            with self.subTest(value=row["value"], note=row["note"]):
                try:
                    start, end = intake.date_bounds(row["value"])
                    bounds = [start.isoformat(), end.isoformat()]
                except (ValueError, TypeError):
                    bounds = None
                expected = row["bounds"] if row["historical"] else None
                # date.isoformat writes years below 1000 with four digits, as the fixture does
                self.assertEqual(bounds, expected)

    def test_reader_agreement_bounds_accept_historical_dates(self):
        # scripts/agent_research/lib.py compares readers' explicit date bounds
        for row in ROWS:
            with self.subTest(value=row["value"], note=row["note"]):
                result = lib._date_bounds({"date_start": row["value"], "date_precision": "year"})
                self.assertEqual(result is not None, row["historical"])

    def test_schema_properties_check_the_form(self):
        # the agent schemas' partial-date properties themselves, as lib.validate applies them
        properties = {
            "agent-dossier.v1.json": [
                "#/properties/status_assessment/properties/asof_date",
                "#/$defs/claim/properties/date_start",
                "#/$defs/claim/properties/date_end",
                "#/$defs/claim/properties/confirmed_dates/items/properties/date",
            ],
            "agent-review-bundle.v1.json": [
                "#/$defs/dossier/properties/status_assessment/properties/asof_date",
                "#/$defs/dossier/$defs/claim/properties/date_start",
                "#/$defs/dossier/$defs/claim/properties/date_end",
                "#/$defs/dossier/$defs/claim/properties/confirmed_dates/items/properties/date",
            ],
        }
        for name, pointers in properties.items():
            root = json.loads((HERE / "schemas" / name).read_text())
            for pointer in pointers:
                for row in ROWS:
                    with self.subTest(schema=name, pointer=pointer, value=row["value"]):
                        self.assertEqual(lib.validate(row["value"], {"$ref": pointer}, root) == [], row["form"])

    def test_dated_places_builder_reads_padded_years(self):
        # scripts/build_occupancy_dated_places.py takes the year from the first four characters,
        # which reads a padded year as written; stage 1 leaves the reader as it was
        builder = load_builder()
        for row in ROWS:
            if row["historical"]:
                with self.subTest(value=row["value"]):
                    self.assertEqual(builder.year_of(row["value"]), int(row["value"][:4]))

    def test_dated_places_feature_draws_padded_years_and_keeps_stored_projections(self):
        # the generated map feature: a period from 0920 draws from the year 920, and a period
        # stored before stage 1 with an end the stage 1 rules would refuse draws as it did
        builder = load_builder()
        task = {"task_id": "t1", "name": "Mission church", "country_code": "CZ", "geometry": {"type": "Point", "coordinates": [14.4, 50.09]}}
        base = {"task_id": "t1", "occupancy_id": "o1", "segment_index": 0, "location_relation": "same_as_task_point",
                "latitude": 50.09, "longitude": 14.4, "location_mode": "building_identified", "start_basis": "founding_stated"}
        padded = builder.occupancy_feature({**base, "start_mode": "known", "start_date": "0920", "end_mode": "known", "end_date": "1421", "end_basis": "closure_stated"}, task, "b1", {})
        self.assertEqual((padded["properties"]["start_year"], padded["properties"]["end_year"]), (920, 1421))
        stored = builder.occupancy_feature({**base, "start_mode": "known", "start_date": "1910", "end_mode": "known", "end_date": "2020-02-30", "end_basis": "closure_stated"}, task, "b1", {})
        self.assertEqual((stored["properties"]["start_year"], stored["properties"]["end_year"]), (1910, 2020))

    def test_fixture_bounds_agree_with_the_python_calendar(self):
        for row in ROWS:
            if row["historical"]:
                with self.subTest(value=row["value"]):
                    lower, upper = (date.fromisoformat(value) for value in row["bounds"])
                    self.assertLessEqual(lower, upper)


if __name__ == "__main__":
    unittest.main()
