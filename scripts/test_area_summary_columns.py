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


    def test_shipped_manifest_is_complete_and_current(self):
        manifest = json.loads(cols.MANIFEST_PATH.read_text())
        entries = [cols.build_one(s)[1] for s in cols.TARGETS]
        self.assertEqual(cols.check_manifest(manifest, entries), [])
        self.assertRegex(manifest["pipeline"]["git_commit"], r"^[0-9a-f]{40}$")
        self.assertEqual(manifest["manifest_sha256"], cols.manifest_hash(manifest))

    def test_pages_pin_the_current_hashes(self):
        entries = [cols.build_one(s)[1] for s in cols.TARGETS]
        for page, text in cols.page_pins(entries).items():
            self.assertEqual(page.read_text(encoding="utf-8"), text, str(page))


def fake_entries(tag):
    return [{"source": "apps/regions/xx/data/area_summary_a.json", "source_sha256": tag * 64, "source_bytes": 1,
             "source_gzip_bytes": 1, "columns": "apps/regions/xx/data/area_summary_a.columns.json",
             "columns_sha256": tag * 64, "columns_bytes": 1, "columns_gzip_bytes": 1, "rows": 1,
             "constant_keys": 0, "encoded_keys": 0, "column_keys": 1}]


class ManifestVersioning(unittest.TestCase):
    commit = "1" * 40

    def test_unchanged_content_keeps_its_timestamp(self):
        first, _ = cols.plan_manifest(fake_entries("a"), None, self.commit, "2026-01-01T00:00:00Z")
        again, archived = cols.plan_manifest(fake_entries("a"), first, "2" * 40, "2026-06-01T00:00:00Z")
        self.assertEqual(again["created_at"], "2026-01-01T00:00:00Z")
        self.assertIsNone(archived)
        self.assertIsNone(again["supersedes_manifest_id"])
        self.assertEqual(again["manifest_sha256"], cols.manifest_hash(again))

    def test_changed_content_gets_a_new_timestamp_and_supersedes_the_old(self):
        first, _ = cols.plan_manifest(fake_entries("a"), None, self.commit, "2026-01-01T00:00:00Z")
        second, archived = cols.plan_manifest(fake_entries("b"), first, self.commit, "2026-06-01T00:00:00Z")
        self.assertEqual(second["created_at"], "2026-06-01T00:00:00Z")
        self.assertNotEqual(second["dataset_version_id"], first["dataset_version_id"])
        self.assertEqual(second["supersedes_manifest_id"], first["manifest_id"])
        self.assertIsNone(second["superseded_by_manifest_id"])
        # the previous record is preserved, marked superseded, with its own valid hash
        self.assertEqual(archived["manifest_id"], first["manifest_id"])
        self.assertEqual(archived["created_at"], "2026-01-01T00:00:00Z")
        self.assertEqual(archived["downstream_status"], "superseded")
        self.assertEqual(archived["superseded_by_manifest_id"], second["manifest_id"])
        self.assertEqual(archived["manifest_sha256"], cols.manifest_hash(archived))
        self.assertEqual(second["manifest_sha256"], cols.manifest_hash(second))

    def test_manifest_hash_ignores_only_its_own_field(self):
        m, _ = cols.plan_manifest(fake_entries("a"), None, self.commit, "2026-01-01T00:00:00Z")
        self.assertEqual(cols.manifest_hash(m), cols.manifest_hash({**m, "manifest_sha256": "f" * 64}))
        self.assertNotEqual(cols.manifest_hash(m), cols.manifest_hash({**m, "created_at": "2027-01-01T00:00:00Z"}))


if __name__ == "__main__":
    unittest.main()
