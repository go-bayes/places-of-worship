"""Tests for scripts/build_area_summary_columns.py (columnar area-summary transport)."""
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_area_summary_columns as cols  # noqa: E402


def product(rows=None):
    rows = rows if rows is not None else [
        {"area_code": "a", "year": 2020, "pct": 1.0, "n": None, "ids": ["x", "y"], "note": "same"},
        {"area_code": "b", "year": 2020, "pct": 2.5, "n": 3, "ids": ["x", "y"], "note": "same"},
        {"area_code": "c", "year": 2021, "pct": 1, "n": None, "ids": ["z"], "note": "same"},
    ]
    return {"schema_version": "area-summary.v2", "domain": "religion", "rows": rows}


class RoundTrip(unittest.TestCase):
    def test_decode_reproduces_the_product(self):
        p = product()
        packed = cols.encode(p, "area_summary_x.json", "0" * 64)
        self.assertIsNone(cols.identical(p, cols.decode(json.loads(cols.dump(packed)))))
        self.assertEqual(packed["n"], 3)
        self.assertEqual(packed["constants"], {"note": "same"})

    def test_types_and_key_order_are_kept(self):
        p = product()
        decoded = cols.decode(cols.encode(p, "area_summary_x.json", "0" * 64))
        self.assertEqual([type(r["pct"]).__name__ for r in decoded["rows"]], ["float", "float", "int"])
        self.assertEqual(list(decoded["rows"][0]), list(p["rows"][0]))

    def test_identical_reports_a_changed_cell_or_type(self):
        a, b = product(), product()
        b["rows"][1]["pct"] = 2.6
        self.assertIsNotNone(cols.identical(a, b))
        c = product()
        c["rows"][0]["pct"] = 1  # equal as numbers, different JSON type
        self.assertIsNotNone(cols.identical(a, c))
        d = product()
        d["domain"] = "other"
        self.assertEqual(cols.identical(a, d), "header differs")

    def test_rows_with_different_keys_are_refused(self):
        rows = product()["rows"]
        rows[1] = {k: v for k, v in rows[1].items() if k != "n"}
        with self.assertRaises(ValueError):
            cols.encode(product(rows), "area_summary_x.json", "0" * 64)

    def test_malformed_transport_is_refused(self):
        packed = cols.encode(product(), "area_summary_x.json", "0" * 64)
        short = json.loads(cols.dump(packed))
        short["columns"]["area_code"] = short["columns"]["area_code"][:2]
        with self.assertRaises(ValueError):
            cols.decode(short)
        wrong = json.loads(cols.dump(packed))
        wrong["schema_version"] = "area-summary-columns.v2"
        with self.assertRaises(ValueError):
            cols.decode(wrong)

    def test_deterministic_bytes(self):
        a = cols.dump(cols.encode(product(), "area_summary_x.json", "0" * 64))
        b = cols.dump(cols.encode(product(), "area_summary_x.json", "0" * 64))
        self.assertEqual(a, b)


class ShippedFiles(unittest.TestCase):
    def test_every_target_exists_and_matches_its_manifest_entry(self):
        manifest = json.loads(cols.MANIFEST_PATH.read_text())
        listed = {f["uri"]: f for f in manifest["durable_files"]}
        self.assertEqual(sorted(listed), sorted(cols.columns_path(s) for s in cols.TARGETS))
        for source in cols.TARGETS:
            body, entry = cols.build_one(source)
            self.assertEqual((cols.REPO / entry["columns"]).read_bytes(), body, entry["columns"])
            self.assertEqual(listed[entry["columns"]]["sha256"], entry["columns_sha256"])
            self.assertEqual(listed[entry["columns"]]["row_count"], entry["rows"])


if __name__ == "__main__":
    unittest.main()
