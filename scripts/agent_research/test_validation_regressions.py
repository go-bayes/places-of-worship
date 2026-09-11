"""offline regressions for public fetching and conservative agreement."""
import copy
import socket
import tempfile
from pathlib import Path
import unittest
from unittest.mock import Mock, patch

import lib
import safe_http
import validate_dossier as validator
from test_agent_research import reader_dossier


class FetchBoundaryTest(unittest.TestCase):
    # reject local, mapped, multicast, and special-use literal addresses.
    def test_blocked_literals(self):
        for host in ("localhost.", "service.localhost", "127.1", "::1", "::ffff:127.0.0.1", "169.254.169.254", "224.0.0.1", "fe90::1", "64:ff9b::7f00:1", "2002:7f00:1::"):
            if host == "127.1":
                continue  # resolved by getaddrinfo; checked below as an abbreviated address
            self.assertTrue(safe_http.is_blocked_host(host), host)
        self.assertFalse(safe_http.is_blocked_host("fda.gov"))

    # check all DNS answers before opening a socket, including unusual numeric hostnames.
    def test_private_and_mixed_dns(self):
        public = (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("8.8.8.8", 443))
        private = (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", 443))
        for host, answers in (("example.org", [public, private]), ("127.1", [private]), ("2130706433", [private])):
            with patch.object(socket, "getaddrinfo", return_value=answers), patch.object(socket, "socket") as create:
                with self.assertRaises(safe_http.UnsafeURL):
                    safe_http.public_socket(host, 443, 10)
                create.assert_not_called()

    # pin the checked numeric destination so a second DNS answer cannot change the connection.
    def test_dns_pinning(self):
        answer = [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("8.8.8.8", 443))]
        with patch.object(socket, "getaddrinfo", return_value=answer) as resolve, patch.object(socket, "socket") as create:
            sock = safe_http.public_socket("example.org", 443, 10)
            resolve.assert_called_once()
            sock.connect.assert_called_once_with(("8.8.8.8", 443))
            self.assertIs(sock, create.return_value)

    # retain certificate hostname verification and SNI while connecting to a pinned address.
    def test_tls_original_hostname(self):
        with patch.object(safe_http, "public_socket") as connect, patch.object(safe_http.ssl, "create_default_context") as context:
            connection = safe_http.PublicConnection("example.org", 443, 10, True)
            connection.connect()
            context.return_value.wrap_socket.assert_called_once_with(connect.return_value, server_hostname="example.org")

    # reject credentials, alternate protocols, and control characters before fetching.
    def test_url_boundary(self):
        for url in ("file:///etc/passwd", "https://user:pass@example.org", "https://example.org:0", "https://example.org/\nsecret"):
            with self.assertRaises(safe_http.UnsafeURL):
                safe_http.parse_public_url(url)

    # check a redirect destination before the next request or its robots read.
    def test_private_redirect(self):
        fetcher = validator.Fetcher()
        with patch.object(fetcher, "_wait"), patch.object(fetcher, "robots_allows", return_value=True), patch.object(validator, "request_once", return_value=(302, b"", {"Location": "http://127.0.0.1/secret"})) as request:
            result = fetcher.get("https://example.org/start")
        self.assertEqual(result["outcome"], "blocked_host")
        self.assertEqual(request.call_count, 1)

    # respect robots on a public redirected host and refuse unknown robots policies.
    def test_redirect_robots(self):
        fetcher = validator.Fetcher()
        with patch.object(fetcher, "_wait"), patch.object(fetcher, "robots_allows", side_effect=[True, False]), patch.object(validator, "request_once", return_value=(302, b"", {"Location": "https://other.example/path"})) as request:
            self.assertEqual(fetcher.get("https://example.org/start")["outcome"], "robots_disallowed")
            self.assertEqual(request.call_count, 1)
        with patch.object(fetcher, "robots_allows", return_value=None), patch.object(validator, "request_once") as request:
            self.assertEqual(fetcher.get("https://example.org/unknown")["outcome"], "robots_disallowed")
            request.assert_not_called()

    # robots redirects receive the same address checks and cannot reach a private host.
    def test_robots_redirect(self):
        fetcher = validator.Fetcher()
        with patch.object(fetcher, "_wait"), patch.object(validator, "request_once", return_value=(302, b"", {"Location": "http://10.0.0.1/robots.txt"})) as request:
            self.assertEqual(fetcher.get("https://example.org/page")["outcome"], "blocked_host")
            self.assertEqual(request.call_count, 1)

    # bound redirect chains even when every host and robots policy is allowed.
    def test_redirect_limit(self):
        fetcher = validator.Fetcher()
        with patch.object(fetcher, "_wait"), patch.object(fetcher, "robots_allows", return_value=True), patch.object(validator, "request_once", return_value=(302, b"", {"Location": "/again"})) as request:
            self.assertEqual(fetcher.get("https://example.org/start")["outcome"], "unreachable")
            self.assertEqual(request.call_count, 6)

    # follow a permitted relative redirect and return the destination content.
    def test_public_redirect(self):
        fetcher = validator.Fetcher()
        with patch.object(fetcher, "_wait"), patch.object(fetcher, "robots_allows", return_value=True), patch.object(validator, "request_once", side_effect=[(302, b"", {"Location": "/next"}), (200, b"public evidence " * 30, {"Content-Type": "text/plain"})]) as request:
            self.assertEqual(fetcher.get("https://example.org/start")["outcome"], "fetched")
            self.assertEqual(request.call_args.args[0], "https://example.org/next")

    # reject oversized responses rather than treating truncated text as complete evidence.
    def test_response_limit(self):
        with patch.object(safe_http, "PublicConnection") as connection:
            connection.return_value.getresponse.return_value.read.return_value = b"too long"
            with self.assertRaises(ValueError):
                safe_http.request_once("https://example.org", {}, 10, 2)
            connection.return_value.close.assert_called_once()



class EvidenceValidationTest(unittest.TestCase):
    # skipped, blocked, and failed fetches remain unresolved rather than verified.
    def test_locator_partition(self):
        dossier = reader_dossier("claude", "1891", "active", -43, 172)
        for outcome in ("not_fetched", "requires_human_access", "unreachable", "http_error", "blocked_host"):
            fetcher = validator.Fetcher(enabled=False)
            with patch.object(fetcher, "get", return_value={"outcome": outcome, "status": None, "error": None}):
                summary = validator.validate_one(dossier, fetcher, None)["summary"]
            self.assertEqual(summary["locator_verified_rate"], 0)
            self.assertEqual(summary["distinct_unresolved"], summary["distinct_locators"])
            self.assertEqual(summary["distinct_verified"] + summary["distinct_dead"] + summary["distinct_unresolved"], summary["distinct_locators"])

    # use the matching object identity before interpreting a version number.
    def test_osm_identity(self):
        claim = {"claim_id": "c1", "claim_type": "osm_object_version", "source": {"locator": "https://www.openstreetmap.org/way/2/history/1"}}
        fetcher = validator.Fetcher(enabled=False)
        osm = {"place_ref": "osm:way/1", "history": [{"version": 1}]}
        self.assertEqual(validator.check_claim(claim, fetcher, osm)["fetch"], "osm_identity_mismatch")
        osm["place_ref"] = "osm:way/2"
        self.assertEqual(validator.check_claim(claim, fetcher, osm)["fetch"], "verified_via_osm_api")
        osm["place_ref"] = "osm:node/2"
        self.assertEqual(validator.check_claim(claim, fetcher, osm)["fetch"], "osm_identity_mismatch")

    # explicit worship-end dates outrank incidental sale years in prose.
    def test_incidental_year(self):
        a = {"claim_type": "worship_ended", "date_start": "2011", "value": "Worship ended in 2011; sold in 2019"}
        b = {"claim_type": "worship_ended", "date_start": "2019", "value": "Worship ended in 2019"}
        self.assertFalse(lib.claims_agree(a, b)[0])
        del a["date_start"]
        self.assertIsNone(lib.claims_agree(a, b)[0])

    # compare both bounds and preserve precision rather than matching a shared endpoint.
    def test_date_bounds(self):
        a = {"claim_type": "start_date", "date_start": "1855", "date_end": "1860"}
        b = {"claim_type": "start_date", "date_start": "1860"}
        self.assertFalse(lib.claims_agree(a, b)[0])
        a.update(date_start="1860-01-01", date_end=None)
        self.assertIsNone(lib.claims_agree(a, b)[0])
        b["date_start"] = "1860-12-01"
        self.assertFalse(lib.claims_agree(a, b)[0])
        a["date_start"] = "1860-99-99"
        self.assertIsNone(lib.claims_agree(a, b)[0])

    # keep competing claims and make the result independent of dossier claim order.
    def test_competing_claims(self):
        a = reader_dossier("claude", "1855", "active", -43, 172)
        b = reader_dossier("codex", "1855", "active", -43, 172)
        extra = copy.deepcopy(a["claims"][0])
        extra.update(claim_id="later", date_start="1860", value="Present site from 1860")
        a["claims"].append(extra)
        for _ in range(2):
            report = lib.compute_agreement([a, b])
            row = next(r for r in report["rows"] if r["claim_type"] == "start_date")
            self.assertEqual(row["outcome"], "disagree")
            self.assertEqual(len(row["values"]), 3)
            a["claims"].reverse()

    # repeated claims by a reader cannot substitute for independent readings.
    def test_missing_reader(self):
        a = reader_dossier("claude", "1891", "active", -43, 172)
        b = reader_dossier("codex", "1891", "active", -43, 172)
        b["claims"] = []
        a["claims"].append(copy.deepcopy(a["claims"][0]))
        report = lib.compute_agreement([a, b])
        self.assertIn("start_date", report["escalate_to_human"])
        row = next(r for r in report["rows"] if r["claim_type"] == "start_date")
        self.assertEqual(row["outcome"], "single_reader")

    # a third reader's unparseable dates prevent an all-reader agreement verdict.
    def test_incomparable_third_reader(self):
        dossiers = [reader_dossier(b, "1891", "unknown", -43, 172) for b in ("claude", "codex", "openrouter")]
        dossiers[2]["claims"][0]["date_start"] = None
        report = lib.compute_agreement(dossiers)
        outcomes = {r["claim_type"]: r["outcome"] for r in report["rows"]}
        self.assertEqual(outcomes["start_date"], "not_comparable")
        self.assertEqual(outcomes["current_status"], "not_comparable")
        self.assertIn("start_date", report["escalate_to_human"])

    # invalid dossiers fail before a fetch can consume an unvalidated locator.
    def test_invalid_schema_refuses_fetch(self):
        dossier = reader_dossier("claude", "1891", "active", -43, 172)
        del dossier["place"]
        fetcher = Mock()
        with self.assertRaises(ValueError):
            validator.validate_place([dossier], fetcher=fetcher)
        fetcher.get.assert_not_called()

    # generated reports preserve unresolved counts and display the new partition.
    def test_report_partition(self):
        import run_pilot
        a = reader_dossier("claude", "1891", "active", -43, 172)
        b = reader_dossier("codex", "1891", "unknown", -43, 172)
        report = validator.validate_place([a, b], fetch=False)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "report.md"
            run_pilot.write_report("test", ["claude", "codex"], [{"place": a["place"], "dossiers": [a, b], "validation": report}], path, "test", "test")
            text = path.read_text()
        self.assertIn("| Verified | Dead | Unresolved |", text)
        self.assertIn("| 0% | 0% | 100% |", text)
        self.assertIn("Missing or incomparable", text)
        self.assertNotIn("Locator validity", text)



if __name__ == "__main__":
    unittest.main()
