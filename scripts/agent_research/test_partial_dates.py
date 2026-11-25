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

    def test_dated_places_builder_reads_padded_years_and_nothing_else(self):
        # scripts/build_occupancy_dated_places.py reads the year of a real historical date,
        # padded years included, and no year from anything else (0000, other digits, an
        # impossible day)
        builder = load_builder()
        historical = {row["value"] for row in ROWS if row["historical"]}
        for row in ROWS:
            # the builder trims a value before reading it, as the backend did before storing it
            text = row["value"].strip()
            with self.subTest(value=row["value"]):
                if text != row["value"]:
                    self.assertEqual(builder.year_of(row["value"]), builder.year_of(text))
                else:
                    self.assertEqual(builder.year_of(row["value"]), int(text[:4]) if text in historical else None)

    def test_fixture_bounds_agree_with_the_python_calendar(self):
        for row in ROWS:
            if row["historical"]:
                with self.subTest(value=row["value"]):
                    lower, upper = (date.fromisoformat(value) for value in row["bounds"])
                    self.assertLessEqual(lower, upper)


if __name__ == "__main__":
    unittest.main()
