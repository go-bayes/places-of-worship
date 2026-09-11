# /// script
# requires-python = ">=3.11"
# dependencies = ["jsonschema==4.26.0"]
# ///
"""regression checks for indicator vocabulary and legacy consumer isolation."""
import json
import unittest
from pathlib import Path

from jsonschema import Draft202012Validator

SCHEMAS = Path(__file__).resolve().parents[1] / "schemas"


# read a schema by filename and return its parsed contract.
def schema(name):
    return json.loads((SCHEMAS / name).read_text())


class IndicatorSchemaTests(unittest.TestCase):
    # prepare validators and a minimal declaration for each independent case.
    def setUp(self):
        self.current = Draft202012Validator(schema("indicator.v2.schema.json"))
        self.legacy = Draft202012Validator(schema("indicator.schema.json"))
        self.indicator = {
            "indicator_id": "example",
            "label": "Example",
            "description": "Synthetic indicator for validation.",
            "unit": "count",
            "method": "Synthetic fixture.",
        }

    # validate the schema documents themselves against their declared dialect.
    def test_schema_documents(self):
        for name in ("indicator.schema.json", "indicator.v2.schema.json"):
            Draft202012Validator.check_schema(schema(name))

    # verify all approved units and reject undeclared or non-string units.
    def test_closed_units(self):
        for unit in ("count", "percent", "rate", "currency", "code", "year", "index", "percent_point"):
            with self.subTest(unit=unit):
                self.current.validate({**self.indicator, "unit": unit})
        for unit in ("people", "percentage points", "places_per_sq_km", "years", "", None, 1):
            with self.subTest(unit=unit):
                self.assertFalse(self.current.is_valid({**self.indicator, "unit": unit}))

    # retain the earlier free-text contract for legacy products.
    def test_legacy_units(self):
        for unit in ("people", "percentage points", "places_per_sq_km"):
            self.legacy.validate({**self.indicator, "unit": unit})

    # accept absent, null, and declared metadata while rejecting vocabulary drift.
    def test_optional_metadata(self):
        self.current.validate(self.indicator)
        fields = {
            "construct_id": (None, "population_total"),
            "variable_kind": (None, "intensive", "extensive", "code"),
            "native_period_type": (None, "calendar_year", "fieldwork_span", "pooled", "reference_date"),
        }
        for field, values in fields.items():
            for value in values:
                self.current.validate({**self.indicator, field: value})
        for field, value in (("construct_id", "Bad ID"), ("variable_kind", "weighted_mean"), ("native_period_type", "annual")):
            self.assertFalse(self.current.is_valid({**self.indicator, field: value}))

    # preserve required declaration fields and reject unknown properties.
    def test_required_fields_and_unknown_properties(self):
        for field in self.indicator:
            row = dict(self.indicator)
            del row[field]
            self.assertFalse(self.current.is_valid(row))
        self.assertFalse(self.current.is_valid({**self.indicator, "unexpected": True}))

    # pin each consumer to its intended generation rather than a moving alias.
    def test_consumer_references(self):
        self.assertEqual(schema("area-summary.v2.schema.json")["properties"]["indicators"]["items"]["$ref"], "indicator.v2.schema.json")
        self.assertEqual(schema("area-summary.schema.json")["properties"]["indicators"]["items"]["$ref"], "indicator.schema.json")
        self.assertTrue(schema("indicator.v2.schema.json")["$id"].endswith("/indicator.v2.schema.json"))


if __name__ == "__main__":
    unittest.main()
