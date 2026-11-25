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
PATTERN = "^[0-9]{4}(-[0-9]{2}(-[0-9]{2})?)?$"


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

    def test_schema_patterns_check_the_form(self):
        # the json schemas' partial-date pattern, as lib.validate applies it
        schema = {"type": "string", "pattern": PATTERN}
        for row in ROWS:
            with self.subTest(value=row["value"]):
                self.assertEqual(lib.validate(row["value"], schema) == [], row["form"])

    def test_dated_places_builder_reads_padded_years(self):
        # scripts/build_occupancy_dated_places.py takes the year from the first four characters
        builder = load_builder()
        for row in ROWS:
            if row["historical"]:
                with self.subTest(value=row["value"]):
                    self.assertEqual(builder.year_of(row["value"]), int(row["value"][:4]))

    def test_fixture_bounds_agree_with_the_python_calendar(self):
        for row in ROWS:
            if row["historical"]:
                with self.subTest(value=row["value"]):
                    lower, upper = (date.fromisoformat(value) for value in row["bounds"])
                    self.assertLessEqual(lower, upper)


if __name__ == "__main__":
    unittest.main()
