"""tests for the agent research pilot: the spreadsheet import, schema
validation, quote matching, personal-details quarantine, the offline
validator, and the agreement computation. no network, no openpyxl.

run from the repository root:
  uv run python -m unittest scripts/agent_research/test_agent_research.py
"""
from __future__ import annotations

import copy
import json
import re
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import lib  # noqa: E402
import import_watts_xlsx as importer  # noqa: E402
import validate_dossier as validator  # noqa: E402
from research_place import assemble_dossier  # noqa: E402

FIXTURE = HERE / "fixtures" / "watts-st-martins-loburn-2026-09-09.dossier.json"

# a synthetic three-sheet workbook in the shape of the watts file; names and
# numbers here are invented for the test and belong to no real person
SUMMARY = {
    "Name": "St Test's Anglican Church",
    "Address": "1 Example Road, Testville 0000, New Zealand",
    "Religion": "Christian",
    "Denomination": "Anglican",
    "Construction / start date": "1891",
    "Current status assessment": "Likely inactive / closed as a place of worship",
    "Status evidence": "Approved for sale in May 2026; parish site lists it as closed.",
    "OSM status": "Appears stale: current OSM record still represents the site as active.",
    "Assessment date": "9 Sep 2026",
}
ROWS = [
    {
        "Record type": "OSM edit",
        "Version / source date": "Version 1 — late 2018 (approx.); changeset 111",
        "Complete state or information supplied": "name=St Test's; amenity=place_of_worship; phone=+64 3 000 0000",
        "Change / additional information supplied": "Initial creation. Edit comment: “add St Test's”. Editor Ann Example.",
        "Source name": "OpenStreetMap — version 1",
        "Source URL": "https://www.openstreetmap.org/way/1/history/1",
        "Retrieved": "9 Sep 2026",
    },
    {
        "Record type": "External — historic photograph",
        "Version / source date": "Photo taken 2 Sep 2011; uploaded 17 Sep 2011",
        "Complete state or information supplied": "Caption states the church was built in 1891 and underwent renovations in 1988–89.",
        "Change / additional information supplied": "Corroborates start_date=1891. User-contributed, so moderate evidential weight.",
        "Source name": "Flickr historical photograph",
        "Source URL": "https://www.flickr.com/photos/example/1/",
        "Retrieved": "9 Sep 2026",
    },
    {
        "Record type": "External — diocesan/parish directory",
        "Version / source date": "Page modification date not stated",
        "Complete state or information supplied": "Directory identifies St Test's – Testville Parish. It lists Rev'd Pat Example as vicar, mobile 021 000 0000, and office@example.church.",
        "Change / additional information supplied": "Establishes organisational relationship to the parish.",
        "Source name": "Diocese directory",
        "Source URL": "https://www.example.org.nz/church/st-tests/",
        "Retrieved": "9 Sep 2026",
    },
    {
        "Record type": "External — current parish website",
        "Version / source date": "Current state retrieved 9 Sep 2026",
        "Complete state or information supplied": "Parish website currently lists “St Test's - Testville Closed.”",
        "Change / additional information supplied": "Best evidence of current status.",
        "Source name": "Parish website",
        "Source URL": "https://example.church/",
        "Retrieved": "9 Sep 2026",
    },
]
NOTES = {"Sale status": "Approved for sale; completion not established."}


def synthetic_import() -> dict:
    return importer.build_dossier(copy.deepcopy(SUMMARY), copy.deepcopy(ROWS), dict(NOTES), "osm:way/1", -43.0, 172.0, "TT", "test.xlsx",
                                  extra_names=["Ann Example"])


def reader_dossier(backend: str, start_year: str, status: str, lat: float, lon: float, quote: str = "built in 1891") -> dict:
    output = {
        "name": "St Test's",
        "candidate_location": {"latitude": lat, "longitude": lon, "basis": "osm_object", "basis_note": "", "uncertainty_radius_m": 20, "address": None},
        "claims": [
            {"claim_type": "start_date", "value": f"opened {start_year}", "date_start": start_year, "date_end": None, "date_precision": "year",
             "source": {"locator": "https://example.org/history", "source_name": "History", "source_type": "archive_collection", "source_date": None, "source_date_basis": "not_stated"},
             "quoted_support": quote, "evidential_weight": "secondary", "confidence": "medium", "note": ""},
            {"claim_type": "denomination", "value": "Anglican", "date_start": None, "date_end": None, "date_precision": "unknown",
             "source": {"locator": "https://example.org/history", "source_name": "History", "source_type": "archive_collection", "source_date": None, "source_date_basis": "not_stated"},
             "quoted_support": "an Anglican church", "evidential_weight": "secondary", "confidence": "high", "note": ""},
        ],
        "status_assessment": {"current_status": status, "basis": "test", "asof_date": "2026-09-10", "osm_stale": None, "osm_stale_basis": ""},
        "osm_version_chain": [{"version": 1, "changeset": 111, "timestamp": "2018", "timestamp_basis": "approximate", "tags_summary": "", "change_note": "", "locator": "https://www.openstreetmap.org/way/1/history/1"}],
        "sources_consulted": [],
        "notes": "",
    }
    place = {"place_ref": "osm:way/1", "name": "St Test's", "country_code": "NZ", "seed_latitude": -43.0, "seed_longitude": 172.0, "seed_source": "test edition"}
    return assemble_dossier(place, output, backend, "model-x", {"model_id_reported": "model-x-2026", "usage": {"input_tokens": 10, "output_tokens": 5}, "cost_usd_reported": 0.01, "cost_basis": "tool_list_price"},
                            "2026-09-10T00:00:00+00:00", "2026-09-10T00:01:00+00:00", 60.0, "test-run", "nz-v1")


class ImportTest(unittest.TestCase):
    def test_import_maps_rows_to_claims_and_chain(self):
        dossier = synthetic_import()
        self.assertEqual(lib.validate_dossier(dossier), [])
        types = [c["claim_type"] for c in dossier["claims"]]
        self.assertIn("osm_object_version", types)
        self.assertIn("building_date", types)
        self.assertIn("renovation", types)
        self.assertIn("organisation_link", types)
        self.assertIn("closure_event", types)
        self.assertEqual(len(dossier["osm_version_chain"]), 1)
        self.assertEqual(dossier["osm_version_chain"][0]["changeset"], 111)
        self.assertEqual(dossier["status_assessment"]["current_status"], "likely_inactive")
        self.assertTrue(dossier["status_assessment"]["osm_stale"])
        self.assertEqual(dossier["provenance"]["producer"], "collaborator_import")
        self.assertEqual(dossier["provenance"]["lane"], "agent_assisted")

    def test_import_dates_and_types(self):
        dossier = synthetic_import()
        by_type = {c["claim_type"]: c for c in dossier["claims"]}
        self.assertEqual(by_type["building_date"]["date_start"], "1891")
        self.assertEqual(by_type["renovation"]["date_start"], "1988")
        self.assertEqual(by_type["building_date"]["source"]["source_type"], "photograph_caption")
        self.assertEqual(by_type["building_date"]["source"]["source_date"], "2011-09-02")
        self.assertEqual(by_type["building_date"]["evidential_weight"], "user_contributed")
        self.assertEqual(by_type["closure_event"]["quoted_support"], "St Test's - Testville Closed.")
        self.assertEqual(by_type["osm_object_version"]["source"]["source_type"], "osm")

    def test_import_quarantines_personal_details(self):
        dossier = synthetic_import()
        block = dossier["personal_details_quarantine"]
        self.assertFalse(block["redacted"])
        kinds = sorted(i["kind"] for i in block["items"])
        self.assertIn("phone", kinds)
        self.assertIn("email", kinds)
        self.assertIn("person_name", kinds)
        text = json.dumps({k: v for k, v in dossier.items() if k != "personal_details_quarantine"})
        self.assertNotIn("Pat Example", text)
        self.assertNotIn("Ann Example", text)
        self.assertNotIn("021 000 0000", text)
        self.assertNotIn("office@example.church", text)
        self.assertIn("[phone withheld]", text)
        lib.redact_quarantine(dossier)
        self.assertTrue(dossier["personal_details_quarantine"]["redacted"])
        self.assertNotIn("Pat Example", json.dumps(dossier))
        self.assertTrue(all("value" not in i for i in dossier["personal_details_quarantine"]["items"]))
        self.assertTrue(all(re.fullmatch(r"[0-9a-f]{64}", i["value_sha256"]) for i in dossier["personal_details_quarantine"]["items"]))
        self.assertEqual(lib.validate_dossier(dossier), [])

    def test_committed_fixture_is_valid_and_redacted(self):
        dossier = lib.read_json(FIXTURE)
        self.assertEqual(lib.validate_dossier(dossier), [])
        self.assertTrue(dossier["personal_details_quarantine"]["redacted"])
        self.assertGreater(dossier["personal_details_quarantine"]["item_count"], 0)
        text = json.dumps(dossier)
        self.assertIsNone(lib._PHONE.search(text))
        self.assertIsNone(lib._EMAIL.search(text))
        self.assertIsNone(lib._HONORIFIC_NAME.search(text))
        self.assertEqual(len(dossier["osm_version_chain"]), 4)
        self.assertEqual(dossier["status_assessment"]["current_status"], "likely_inactive")


class SchemaTest(unittest.TestCase):
    def test_reader_dossier_valid(self):
        dossier = reader_dossier("claude", "1891", "likely_inactive", -43.0001, 172.0001)
        self.assertEqual(lib.validate_dossier(dossier), [])
        self.assertEqual(dossier["claims"][0]["reader"]["model_id"], "model-x-2026")
        self.assertEqual(dossier["run_manifest"]["cost_basis"], "tool_list_price")
        self.assertEqual(len(dossier["run_manifest"]["idempotency_key"]), 64)

    def test_schema_rejects_bad_values(self):
        dossier = reader_dossier("claude", "1891", "likely_inactive", -43.0, 172.0)
        bad = copy.deepcopy(dossier)
        bad["claims"][0]["claim_type"] = "rumour"
        self.assertTrue(any("not in enum" in e for e in lib.validate_dossier(bad)))
        bad = copy.deepcopy(dossier)
        del bad["run_manifest"]["idempotency_key"]
        self.assertTrue(any("idempotency_key" in e for e in lib.validate_dossier(bad)))
        bad = copy.deepcopy(dossier)
        bad["place"]["place_ref"] = "way/1"
        self.assertTrue(any("place_ref" in e for e in lib.validate_dossier(bad)))
        bad = copy.deepcopy(dossier)
        bad["claims"][0]["extra"] = 1
        self.assertTrue(any("unexpected property" in e for e in lib.validate_dossier(bad)))

    def test_idempotency_key_changes_with_edition_and_prompt(self):
        a = lib.idempotency_key("osm:way/1", "researcher.v1", "opus", "edition-1")
        b = lib.idempotency_key("osm:way/1", "researcher.v1", "opus", "edition-2")
        c = lib.idempotency_key("osm:way/1", "researcher.v2", "opus", "edition-1")
        self.assertNotEqual(a, b)
        self.assertNotEqual(a, c)
        self.assertEqual(a, lib.idempotency_key("osm:way/1", "researcher.v1", "opus", "edition-1"))


class QuoteTest(unittest.TestCase):
    PAGE = "<html><body><p>The one-room weatherboard Anglican church was built in 1891 and underwent renovations in 1988–89.</p><script>x=1</script></body></html>"

    def test_exact_partial_absent(self):
        text = lib.strip_html(self.PAGE)
        self.assertNotIn("x=1", text)
        self.assertEqual(lib.quote_support("Anglican church was built in 1891", text), ("supported", 1.0))
        outcome, share = lib.quote_support("the weatherboard Anglican church was built in 1891 and underwent renovations in 1988-89 after a fire", text)
        self.assertEqual(outcome, "partially_supported")
        self.assertGreater(share, 0.6)
        self.assertEqual(lib.quote_support("demolished in 1950 by the council", text)[0], "not_found")
        self.assertEqual(lib.quote_support("", text)[0], "no_quote")

    def test_curly_quotes_normalise(self):
        self.assertEqual(lib.normalise_text("“St. Martin’s – Loburn Closed”"), "st martin s loburn closed")


class ValidatorOfflineTest(unittest.TestCase):
    class FakeFetcher(validator.Fetcher):
        def __init__(self, pages: dict[str, tuple[int, str]]):
            super().__init__(enabled=True)
            self.pages = pages

        def get(self, url: str) -> dict:
            self.request_count += 1
            if url not in self.pages:
                return {"url": url, "status": 404, "outcome": "dead", "text": "", "content_type": "", "error": "404"}
            status, text = self.pages[url]
            return {"url": url, "status": status, "outcome": "fetched", "text": text, "content_type": "text/html", "error": None}

    def test_claim_checks_and_agreement(self):
        a = reader_dossier("claude", "1891", "likely_inactive", -43.0001, 172.0001, quote="built in 1891")
        b = reader_dossier("codex", "1892", "active", -43.0003, 172.0003, quote="opened its doors in 1877")
        fetcher = self.FakeFetcher({"https://example.org/history": (200, "The church, an Anglican church, was built in 1891.")})
        report = validator.validate_place([a, b], fetch=True, check_osm=False, fetcher=fetcher)
        rows_a = report["dossiers"][0]["claims"]
        self.assertEqual(rows_a[0]["support"], "supported")
        self.assertEqual(rows_a[1]["support"], "supported")
        rows_b = report["dossiers"][1]["claims"]
        self.assertEqual(rows_b[0]["support"], "not_found")
        self.assertEqual(report["dossiers"][0]["summary"]["locator_verified_rate"], 1.0)
        self.assertEqual(report["dossiers"][0]["summary"]["locator_reachable_rate"], 1.0)
        self.assertEqual(report["dossiers"][0]["summary"]["quote_exact_rate"], 1.0)
        self.assertEqual(report["dossiers"][1]["summary"]["quote_support_rate"], 0.5)
        agreement = report["agreement"]
        by_type = {r["claim_type"]: r["outcome"] for r in agreement["rows"]}
        self.assertEqual(by_type["start_date"], "agree")  # 1891 vs 1892: within a year
        self.assertEqual(by_type["denomination"], "agree")
        self.assertEqual(by_type["current_status"], "disagree")
        self.assertEqual(agreement["majority"], 0)
        self.assertEqual(by_type["candidate_location"], "agree")  # about 28 m apart
        self.assertIn("current_status", agreement["escalate_to_human"])
        self.assertEqual(agreement["claim_types_compared"], 4)
        self.assertEqual(agreement["agreement_rate"], 0.75)

    def test_dead_locator_counted(self):
        a = reader_dossier("claude", "1891", "active", -43.0, 172.0)
        a["claims"][1]["source"]["locator"] = "https://example.org/missing"
        fetcher = self.FakeFetcher({"https://example.org/history": (200, "built in 1891")})
        report = validator.validate_place([a], fetch=True, check_osm=False, fetcher=fetcher)
        summary = report["dossiers"][0]["summary"]
        self.assertEqual(summary["dead"], 1)
        self.assertEqual(summary["distinct_locators"], 2)
        self.assertEqual(summary["locator_verified_rate"], 0.5)
        self.assertEqual(summary["locator_reachable_rate"], 0.5)
        self.assertEqual(summary["distinct_blocked"], 0)
        self.assertIn("note", report["agreement"])

    def test_location_disagreement_beyond_tolerance(self):
        a = reader_dossier("claude", "1891", "active", -43.0, 172.0)
        b = reader_dossier("codex", "1891", "active", -43.002, 172.0)  # about 220 m south
        agreement = lib.compute_agreement([a, b])
        by_type = {r["claim_type"]: r["outcome"] for r in agreement["rows"]}
        self.assertEqual(by_type["candidate_location"], "disagree")

    def test_version_chain_check(self):
        chain = [{"version": 1, "changeset": 111, "timestamp": "2018"}, {"version": 2, "changeset": 999, "timestamp": "2019"}]
        history = [{"version": 1, "changeset": 111, "timestamp": "2018-11-02T00:00:00Z"}, {"version": 2, "changeset": 222, "timestamp": "2019-11-02T00:00:00Z"}]
        result = validator.check_version_chain(chain, history)
        self.assertEqual(result["confirmed"], 1)
        self.assertEqual(result["contradicted"], 1)

    def test_blocked_hosts(self):
        self.assertTrue(validator.is_blocked_host("localhost"))
        self.assertTrue(validator.is_blocked_host("10.0.0.1"))
        self.assertTrue(validator.is_blocked_host("172.16.5.5"))
        self.assertFalse(validator.is_blocked_host("paperspast.natlib.govt.nz"))


if __name__ == "__main__":
    unittest.main()
