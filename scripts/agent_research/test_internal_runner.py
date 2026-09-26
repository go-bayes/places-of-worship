"""Unit tests for the bounded internal research/review runner.

Provider processes are mocked or replaced by small local fakes.  These tests
must never spend a provider budget or make a web request.
"""
from __future__ import annotations

import io
import json
import os
import signal
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import internal_runner as runner  # noqa: E402


SEED = {
    "place_ref": "osm:way/123",
    "name": "Test Church",
    "country_code": "NZ",
    "seed_latitude": -43.0,
    "seed_longitude": 172.0,
    "seed_source": "test edition",
    "seed_tags": {"amenity": "place_of_worship"},
}


class CommandPolicyTest(unittest.TestCase):
    def test_codex_command_has_read_only_and_every_disable(self):
        command = runner.build_codex_command(Path("reader.json"), Path("/tmp/empty"), "gpt-5.6-luna")
        self.assertIn("--ignore-user-config", command)
        self.assertIn("--ignore-rules", command)
        self.assertIn("--strict-config", command)
        self.assertIn("--ephemeral", command)
        self.assertEqual(command[command.index("--sandbox") + 1], "read-only")
        for feature in runner.CODEX_DISABLED_FEATURES:
            self.assertEqual(command[command.index(feature) - 1], "--disable")
        self.assertIn("view_image", runner.CODEX_DISABLED_FEATURES)
        self.assertIn("image_generation", runner.CODEX_DISABLED_FEATURES)
        self.assertIn("web_search=\"live\"", command)
        self.assertIn("skip_host_skill_discovery", command)
        self.assertEqual(command[command.index("skip_host_skill_discovery") - 1], "--enable")
        self.assertIn("project_doc_max_bytes=0", command)
        self.assertEqual(command[-1], "-")

    def test_claude_command_is_web_only_and_has_no_fallback(self):
        command = runner.build_claude_command({"type": "object"}, "system", "sonnet", 2.0)
        self.assertEqual(command[0:2], ["claude", "-p"])
        self.assertIn("--tools", command)
        self.assertEqual(command[command.index("--tools") + 1], "WebSearch,WebFetch")
        self.assertEqual(command[command.index("--allowedTools") + 1], "WebSearch,WebFetch")
        self.assertIn("--strict-mcp-config", command)
        self.assertIn("--no-session-persistence", command)
        self.assertNotIn("--fallback-model", command)
        self.assertNotIn("--dangerously-skip-permissions", command)
        with self.assertRaises(runner.RunnerError):
            runner.build_claude_command({}, "system", "opus", 2.0)
        with self.assertRaises(runner.RunnerError):
            runner.build_codex_command(Path("x"), Path("."), "gpt-5.6-sol")

    def test_sensitive_environment_is_removed_without_changing_home(self):
        with patch.dict(os.environ, {
            "OPENROUTER_API_KEY": "or-secret",
            "AWS_SECRET_ACCESS_KEY": "aws-secret",
            "ANTHROPIC_API_KEY": "anthropic-secret",
            "CONVEX_DEPLOY_KEY": "convex-secret",
            "VITE_CONVEX_URL": "https://convex.example",
            "CODEX_HOME": "/tmp/codex-home",
        }, clear=False):
            env = runner.child_environment()
        self.assertNotIn("OPENROUTER_API_KEY", env)
        self.assertNotIn("AWS_SECRET_ACCESS_KEY", env)
        self.assertNotIn("ANTHROPIC_API_KEY", env)
        self.assertNotIn("CONVEX_DEPLOY_KEY", env)
        self.assertNotIn("VITE_CONVEX_URL", env)
        self.assertEqual(env["CODEX_HOME"], "/tmp/codex-home")
        self.assertEqual(env["HOME"], os.environ["HOME"])


class ValidationAndAuditTest(unittest.TestCase):
    def test_seed_requires_explicit_public_approval_and_nz(self):
        with self.assertRaisesRegex(runner.RunnerError, "public"):
            runner._validate_seed(SEED, False)
        with self.assertRaisesRegex(runner.RunnerError, "NZ"):
            runner._validate_seed({**SEED, "country_code": "AU"}, True)
        with self.assertRaises(runner.RunnerError):
            runner._validate_seed({**SEED, "seed_tags": []}, True)
        with self.assertRaisesRegex(runner.RunnerError, "sensitive"):
            runner._validate_seed({**SEED, "seed_tags": {"contact:phone": "021 000 0000"}}, True)
        self.assertEqual(runner._validate_seed(SEED, True)["place_ref"], "osm:way/123")

    def test_refusal_and_invalid_json_are_rejected(self):
        with self.assertRaises(runner.RunnerError):
            runner._parse_claude("not json")
        with self.assertRaises(runner.RunnerError):
            runner._parse_claude(json.dumps({"is_error": True, "result": "refused"}))
        with self.assertRaises(runner.DuplicateJSONKey):
            runner._parse_claude('{"structured_output":{"schema_version":"x"},"structured_output":{}}')

    def test_claude_mixed_model_usage_selects_requested_sonnet_and_keeps_helpers(self):
        envelope = {
            "structured_output": {},
            "usage": {"input_tokens": 10, "cache_read_input_tokens": 20, "output_tokens": 30,
                       "output_tokens_details": {"thinking_tokens": 4}},
            "total_cost_usd": 0.75,
            "modelUsage": {
                "claude-haiku-4-5-20251001": {"canonicalModel": "claude-haiku-4-5", "inputTokens": 100, "costUSD": 0.5},
                "claude-sonnet-5": {"canonicalModel": "claude-sonnet-5", "inputTokens": 200, "costUSD": 0.25},
            },
        }
        output, fields = runner._parse_claude(json.dumps(envelope), "sonnet")
        self.assertEqual(output, {})
        self.assertEqual(fields["model_id_reported"], "claude-sonnet-5")
        self.assertEqual(fields["usage_full"]["total_cost_usd"], 0.75)
        self.assertIn("claude-haiku-4-5-20251001", fields["usage_full"]["modelUsage"])
        manifest = runner._manifest("review", "claude", "sonnet", "2026-09-11T00:00:00+00:00",
                                     "2026-09-11T00:00:01+00:00", runner.ProcessResult(0, b"{}", b"", False, False),
                                     fields, "prompt", {"version": "test"}, exit_status="completed")
        self.assertEqual(manifest["usage"]["provider_usage"]["total_cost_usd"], 0.75)
        self.assertEqual(manifest["usage"]["cached_input_tokens"], 20)
        self.assertEqual(manifest["usage"]["reasoning_tokens"], 4)

    def test_codex_forbidden_tool_trace_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            final = Path(tmp) / "last.json"
            final.write_text("{}", encoding="utf-8")
            trace = json.dumps({"type": "item.completed", "item": {"type": "command_execution"}})
            with self.assertRaisesRegex(runner.RunnerError, "unexpected tool"):
                runner._parse_codex(trace, final)

    def test_codex_web_search_duplicate_ids_are_trace_metadata_only(self):
        with tempfile.TemporaryDirectory() as tmp:
            final = Path(tmp) / "last.json"
            final.write_text("{}", encoding="utf-8")
            trace = '{"type":"item.completed","item":{"type":"web_search","id":"item-1","id":"exec-1"}}'
            trace = '\n'.join([json.dumps({"type": "thread.started", "thread_id": "test"}), trace,
                                json.dumps({"type": "item.completed", "item": {"type": "agent_message", "text": "{}"}}),
                                json.dumps({"type": "turn.completed", "usage": {}})])
            output, fields = runner._parse_codex(trace, final)
            self.assertEqual(output, {})
            self.assertEqual(fields["events"][1]["item"]["_duplicate_id_warning"]["values"], ["item-1", "exec-1"])
            self.assertEqual(len(fields["tool_audit"]["duplicate_id_warnings"]), 1)

    def test_codex_requires_complete_trace_bound_to_final_message(self):
        events = [{"type": "thread.started", "thread_id": "test"},
                  {"type": "item.completed", "item": {"type": "agent_message", "text": "{}"}},
                  {"type": "turn.completed", "usage": {}}]
        with tempfile.TemporaryDirectory() as tmp:
            final = Path(tmp) / "last.json"
            final.write_text("{}", encoding="utf-8")
            valid = "\n".join(map(json.dumps, events))
            self.assertEqual(runner._parse_codex(valid, final)[0], {})
            for trace in ["", "\n".join(map(json.dumps, events[1:])),
                          "\n".join(map(json.dumps, events[:-1])),
                          valid + "\nnot json", valid + "\n{", valid.replace('"test"', '""')]:
                with self.subTest(trace=trace), self.assertRaises(runner.RunnerError):
                    runner._parse_codex(trace, final)
            final.write_text('{"changed": true}', encoding="utf-8")
            with self.assertRaisesRegex(runner.RunnerError, "does not match"):
                runner._parse_codex(valid, final)

    def test_manifest_does_not_duplicate_unredacted_trace_events(self):
        secret = "test-secret-value"
        result = runner.ProcessResult(0, secret.encode(), b"", False, False)
        with patch.object(runner, "_redact_secrets", return_value="[REDACTED]"):
            manifest = runner._manifest("research", "codex", "gpt-5.6-luna",
                "2026-09-11T00:00:00+00:00", "2026-09-11T00:00:01+00:00",
                result, {"events": [{"text": secret}]}, "prompt", {"version": "test"},
                exit_status="completed")
        self.assertNotIn("events", manifest)
        self.assertNotIn(secret, json.dumps(manifest))

    def test_output_limit_refuses_before_structured_parse(self):
        result = runner.ProcessResult(0, b"{}", b"", False, True)
        with tempfile.TemporaryDirectory() as tmp:
            raw = Path(tmp) / "attempts.jsonl"
            with patch.object(runner, "_run_process", return_value=result):
                with self.assertRaisesRegex(runner.RunnerError, "output limit"):
                    runner._invoke("research", "claude", "sonnet", "system", "user", 1, 1.0, None, raw, {"version": "test"})
            self.assertEqual(json.loads(raw.read_text())['manifest']['exit_status'], "failed")

    def test_preflight_refuses_missing_mandatory_capability(self):
        def fake_run(command, **kwargs):
            if command[-1] == "--help":
                return type("Completed", (), {"returncode": 0, "stdout": "Usage: claude", "stderr": ""})()
            return type("Completed", (), {"returncode": 0, "stdout": "claude 1", "stderr": ""})()

        with self.assertRaisesRegex(runner.CapabilityError, "missing mandatory"):
            runner._preflight("claude", runner=fake_run)

    def test_pause_file_is_checked_before_spend(self):
        with tempfile.TemporaryDirectory() as tmp:
            pause = Path(tmp) / "PAUSE"
            pause.touch()
            with self.assertRaises(runner.PauseRequested):
                runner._check_pause(pause)
            raw = Path(tmp) / "attempts.jsonl"
            with self.assertRaises(runner.PauseRequested):
                runner._invoke("research", "claude", "sonnet", "system", "user", 1, 1.0, pause, raw, {"version": "test"})
            self.assertTrue(raw.exists())
            self.assertEqual(json.loads(raw.read_text())['manifest']['exit_status'], "failed")

    def test_same_provider_review_is_refused(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaisesRegex(runner.RunnerError, "other provider"):
                runner.run(SEED, "claude", "claude", Path(tmp), public_nonsensitive=True)

    def test_manifest_has_required_audit_fields_and_bounded_output(self):
        result = runner.ProcessResult(0, b"x" * (runner.MAX_OUTPUT_BYTES + 10), b"err", False, True)
        manifest = runner._manifest(
            "research", "codex", "gpt-5.6-luna", "2026-09-11T00:00:00+00:00",
            "2026-09-11T00:00:01+00:00", result, {"usage": {"output_tokens": 1}}, "prompt", {"version": "codex 1"},
            exit_status="completed",
        )
        for key in ("backend", "model_requested", "model_id_reported", "started_at", "ended_at", "duration_seconds",
                    "usage", "raw_trace_sha256", "prompt_sha256", "cli_version", "tool_policy_version", "exit_code"):
            self.assertIn(key, manifest)
        self.assertEqual(manifest["model_requested"], "gpt-5.6-luna")
        self.assertTrue(manifest["output_limited"])
        self.assertLessEqual(len(manifest["stdout"].encode()), runner.MAX_OUTPUT_BYTES + 100)
        self.assertEqual(manifest["tool_policy_version"], "public-web-only.v1")

    # synthetic usage: a helper model the client chose bills beside the requested Sonnet.
    CLAUDE_ENVELOPE = {
        "structured_output": {},
        "total_cost_usd": 0.4,
        "usage": {"input_tokens": 7, "cache_read_input_tokens": 4321, "output_tokens": 8765,
                   "output_tokens_details": {"thinking_tokens": 1234},
                   "server_tool_use": {"web_search_requests": 0, "web_fetch_requests": 0}},
        "modelUsage": {
            "claude-haiku-4-5-20251001": {"canonicalModel": "claude-haiku-4-5", "costBasis": "list", "costUSD": 0.3,
                                          "inputTokens": 200000, "cacheReadInputTokens": 0, "cacheCreationInputTokens": 0,
                                          "outputTokens": 1111, "thinkingTokens": 0, "webSearchRequests": 2},
            "claude-sonnet-5": {"canonicalModel": "claude-sonnet-5", "costBasis": "list", "costUSD": 0.1,
                                "inputTokens": 7, "cacheReadInputTokens": 4321, "cacheCreationInputTokens": 3333,
                                "outputTokens": 8765, "thinkingTokens": 1234, "webSearchRequests": 0},
        },
    }

    def _claude_manifest(self, stage: str, envelope: dict | None = None) -> dict:
        _, fields = runner._parse_claude(json.dumps(envelope or self.CLAUDE_ENVELOPE), "sonnet")
        return runner._manifest(stage, "claude", "sonnet", "2026-09-11T00:00:00+00:00", "2026-09-11T00:00:01+00:00",
                                runner.ProcessResult(0, b"{}", b"", False, False), fields, "prompt", {"version": "test"},
                                exit_status="completed")

    def _codex_manifest(self, stage: str, model_id_reported: str | None) -> dict:
        return runner._manifest(stage, "codex", "gpt-5.6-luna", "2026-09-11T00:00:02+00:00", "2026-09-11T00:00:03+00:00",
                                runner.ProcessResult(0, b"{}", b"", False, False),
                                {"usage": {"output_tokens": 1}, "usage_full": {"output_tokens": 1},
                                 "model_id_reported": model_id_reported}, "prompt", {"version": "test"},
                                exit_status="completed")

    def _run_pair(self, tmp: Path, source_url: str, research_manifest: dict, review_manifest: dict,
                  research_backend: str = "claude", review_error: Exception | None = None,
                  review_source_url: str | None = None, claim_note: str = "", source_name: str = "Test source",
                  prompts: list[str] | None = None, review_changes: dict | None = None,
                  research_value: str = "Test Church", research_quote: str = "Test Church") -> tuple[list[str], dict | None]:
        """Run the runner with mocked providers; return the stages invoked and the run() result."""
        review_backend = "codex" if research_backend == "claude" else "claude"
        reader_output = {
            "name": "Test Church",
            "candidate_location": {"latitude": -43.0, "longitude": 172.0, "basis": "osm_object", "basis_note": "",
                                    "uncertainty_radius_m": 10, "address": None},
            "claims": [{
                "claim_type": "name", "value": research_value, "date_start": None, "date_end": None,
                "date_precision": "unknown", "source": {"locator": source_url, "source_name": source_name,
                "source_type": "church_website", "source_date": None, "source_date_basis": "not_stated"},
                "quoted_support": research_quote, "evidential_weight": "primary_institutional", "confidence": "high", "note": claim_note,
            }],
            "status_assessment": {"current_status": "unknown", "basis": "test", "asof_date": "2026-09-11",
                                  "osm_stale": None, "osm_stale_basis": ""},
            "osm_version_chain": [], "sources_consulted": [{"locator": source_url, "outcome": "relevant"}], "notes": "",
        }
        stages: list[str] = []

        def fake_invoke(stage, provider, model, system, user, timeout_s, budget_usd, pause_file, raw_path, preflight):
            stages.append(stage)
            if prompts is not None:
                prompts.append(system + "\n" + user)
            if stage == "research":
                return reader_output, research_manifest
            if review_error is not None:
                raise review_error
            review = {"schema_version": "agent-review.v1", "recommendation": "revise", "reasoning": "test",
                    "claim_checks": [{"claim_id": f"osm:way/123:{research_backend}:c01", "outcome": "supported",
                                       "source_url": review_source_url or source_url, "note": "test",
                                       "access_method": "opened"}],
                    "cultural_sensitivity": {"flagged": False, "basis": "none"}, "limitations": []}
            for key, value in (review_changes or {}).items():
                if key == "claim_note":
                    review["claim_checks"][0]["note"] = value
                else:
                    review[key] = value
            return review, review_manifest

        seed_path = tmp / "seed.json"
        seed_path.write_text(json.dumps(SEED), encoding="utf-8")
        out = tmp / "out"
        with patch.object(runner, "_preflight", return_value={"provider": "test", "version": "test"}), \
             patch.object(runner, "_invoke", side_effect=fake_invoke), \
             patch("sys.stdout", new_callable=io.StringIO), patch("sys.stderr", new_callable=io.StringIO):
            code = runner.main(["--backend", research_backend, "--review-backend", review_backend, "--seed", str(seed_path),
                                "--out", str(out), "--public-nonsensitive"])
        run_result = json.loads((out / "run-result.json").read_text())
        run_result["exit_code"] = code
        return stages, run_result

    def test_mocked_pair_reaches_real_intake_bundle_validation(self):
        with tempfile.TemporaryDirectory() as tmp:
            stages, run_result = self._run_pair(Path(tmp), "https://www.anglicanlife.org.nz/test-church",
                                                self._claude_manifest("research"), self._codex_manifest("review", "gpt-5.6-luna"))
            self.assertEqual(stages, ["research", "review"])
            self.assertEqual(run_result["status"], "completed")
            self.assertEqual(run_result["exit_code"], 0)
            self.assertEqual(run_result["bundle"]["provisional"], True)
            self.assertEqual((run_result["allowlist_version"], run_result["allowlist_violations"],
                              run_result["allowlist_violation_domains"]), ("nz-v1", 0, []))
            bundle = json.loads((Path(tmp) / "out" / "bundle.json").read_text())
            manifest = bundle["dossier"]["run_manifest"]
            # the dossier's cost is the sum over billing models, not the requested model's share.
            self.assertAlmostEqual(manifest["cost_usd_reported"], 0.4, places=7)
            self.assertEqual(manifest["cost_basis"], "tool_list_price")
            self.assertEqual(bundle["research_run"]["usage"]["per_model"]["web_search_requests"], 2)

    def test_cited_name_reaches_review_and_unadmitted_name_is_refused(self):
        for reasoning, expected in [
            ("Rev'd Pat Example is named on the page.", "completed"),
            ("Rev'd Jo Sample also served.", "failed"),
        ]:
            with self.subTest(reasoning), tempfile.TemporaryDirectory() as tmp:
                out = Path(tmp) / "out"
                stages, result = self._run_pair(Path(tmp), "https://nzhistory.govt.nz/history",
                                                self._claude_manifest("research"),
                                                self._codex_manifest("review", "gpt-5.6-luna"),
                                                research_value="Test Church under Rev'd Pat Example",
                                                research_quote="Test Church under Rev'd Pat Example",
                                                review_changes={"reasoning": reasoning})
                self.assertEqual(stages, ["research", "review"])
                self.assertEqual(result["status"], expected, result.get("error"))
                if expected == "completed":
                    bundle = json.loads((out / "bundle.json").read_text())
                    self.assertIn("Rev'd Pat Example", bundle['review']['reasoning'])
                    self.assertEqual(bundle['dossier']['personal_details_quarantine']['items'][0]['admitted_by_rule'],
                                     'public_source_cited.v1')
                else:
                    self.assertFalse((out / 'bundle.json').exists())
            self.assertEqual(bundle["research_run"]["model_id_reported"], "claude-sonnet-5")
            self.assertEqual(bundle["review_run"]["model_id_reported"], "gpt-5.6-luna")

    def test_quarantine_hashes_stay_in_the_private_dossier_copy(self):
        prompts: list[str] = []
        with tempfile.TemporaryDirectory() as tmp:
            stages, run_result = self._run_pair(Path(tmp), "https://www.anglicanlife.org.nz/test-church",
                                                self._claude_manifest("research"), self._codex_manifest("review", "gpt-5.6-luna"),
                                                claim_note="The directory lists Rev'd Pat Example as vicar.",
                                                source_name="Parish directory: Rev'd Pat Example", prompts=prompts)
            self.assertEqual(stages, ["research", "review"])
            self.assertEqual(run_result["status"], "completed", run_result["error"])
            out = Path(tmp) / "out"
            private = json.loads((out / "dossier.json").read_text())["personal_details_quarantine"]
            # the same name in the note and the source name is one detail of one claim.
            self.assertEqual(private["item_count"], 1)
            digest = private["items"][0]["value_sha256"]
            self.assertRegex(digest, r"^[0-9a-f]{64}$")
            bundle_text = (out / "bundle.json").read_text()
            block = json.loads(bundle_text)["dossier"]["personal_details_quarantine"]
            self.assertEqual(block["items"], [{"kind": "person_name", "context_claim_id": "osm:way/123:claude:c01"}])
            self.assertEqual(block["item_count"], 1)
            bundled_claim = json.loads(bundle_text)["dossier"]["claims"][0]
            self.assertEqual(bundled_claim["source"]["source_name"], "Parish directory: [person_name withheld]")
            # neither the bundle nor the reviewer's prompt carries the value or its hash.
            for text in (bundle_text, prompts[1]):
                self.assertNotIn(digest, text)
                self.assertNotIn("Pat Example", text)
                self.assertNotIn("value_sha256", text)

    def test_contaminated_review_is_refused_kept_privately_and_recorded(self):
        cases = [
            ("email in the reasoning", {"reasoning": "Confirmed with office@example.org."}, "", "review.reasoning"),
            ("known name in a check note", {"claim_note": "Pat Example confirmed the services."},
             "The directory lists Rev'd Pat Example as vicar.", "review.claim_checks[0].note"),
            ("hash of a known name", {"limitations": ["ref " + runner.lib.sha256("Rev'd Pat Example")]},
             "The directory lists Rev'd Pat Example as vicar.", "review.limitations[0]"),
        ]
        for name, changes, claim_note, path in cases:
            with self.subTest(name), tempfile.TemporaryDirectory() as tmp:
                stages, run_result = self._run_pair(Path(tmp), "https://www.anglicanlife.org.nz/test-church",
                                                    self._claude_manifest("research"),
                                                    self._codex_manifest("review", "gpt-5.6-luna"),
                                                    claim_note=claim_note, review_changes=changes)
                out = Path(tmp) / "out"
                self.assertEqual(stages, ["research", "review"])
                self.assertEqual(run_result["status"], "failed")
                self.assertEqual(run_result["personal_detail_refusal"]["stage"], "bundle")
                refusal = run_result["personal_detail_refusal"]
                self.assertIn(path, refusal["paths"])
                self.assertEqual((refusal["policy"], refusal["offset_unit"]), ("interim_refuse_before_transport", "unicode_code_point"))
                finding = next(f for f in refusal["findings"] if f["path"] == path)
                self.assertEqual(set(finding), {"path", "detector", "start", "end"})
                self.assertIn(finding["detector"], {"email", "known_value", "known_value_hash", "hash_outside_field"})
                refused_text = json.loads((Path(tmp) / "out" / "review.refused.json").read_text())
                field = {"review.reasoning": lambda r: r["reasoning"],
                         "review.claim_checks[0].note": lambda r: r["claim_checks"][0]["note"],
                         "review.limitations[0]": lambda r: r["limitations"][0]}[path](refused_text)
                # the span locates the detail in the privately kept original
                self.assertTrue(field[finding["start"]:finding["end"]])
                self.assertIn(field[finding["start"]:finding["end"]].lower(),
                              {"office@example.org", "pat example", runner.lib.sha256("Rev'd Pat Example")})
                # the run row names paths, never the refused text; the original stays private.
                self.assertNotIn("example.org", json.dumps(run_result))
                self.assertNotIn("Pat Example", json.dumps(run_result))
                refused = out / "review.refused.json"
                self.assertEqual(refused.stat().st_mode & 0o777, 0o600)
                self.assertFalse((out / "bundle.json").exists())
                self.assertFalse((out / "review.json").exists())

    def test_schema_invalid_review_is_screened_first_and_never_echoed(self):
        # an email in an enum field fails the review schema; the privacy screen still runs first
        for name, error in [("semantic schema check", None),
                            ("provider schema check", "schema")]:
            with self.subTest(name), tempfile.TemporaryDirectory() as tmp:
                if error == "schema":
                    review = {"schema_version": "agent-review.v1", "recommendation": "office@example.org"}
                    raised = runner.SchemaRejected("structured output failed schema: recommendation: not in enum", review)
                    stages, run_result = self._run_pair(Path(tmp), "https://www.anglicanlife.org.nz/test-church",
                                                        self._claude_manifest("research"),
                                                        self._codex_manifest("review", "gpt-5.6-luna"), review_error=raised)
                else:
                    stages, run_result = self._run_pair(Path(tmp), "https://www.anglicanlife.org.nz/test-church",
                                                        self._claude_manifest("research"),
                                                        self._codex_manifest("review", "gpt-5.6-luna"),
                                                        review_changes={"recommendation": "office@example.org"})
                self.assertEqual(run_result["status"], "failed")
                refusal = run_result["personal_detail_refusal"]
                self.assertIn("review.recommendation", refusal["paths"])
                self.assertNotIn("example.org", json.dumps(run_result))
                self.assertTrue((Path(tmp) / "out" / "review.refused.json").exists())

    def test_refusal_record_names_undeclared_keys_by_position(self):
        review_manifest = self._codex_manifest("review", "gpt-5.6-luna")
        review_manifest["usage"]["office@example.org"] = 1
        with tempfile.TemporaryDirectory() as tmp:
            _, run_result = self._run_pair(Path(tmp), "https://www.anglicanlife.org.nz/test-church",
                                           self._claude_manifest("research"), review_manifest)
            refusal = run_result["personal_detail_refusal"]
            self.assertEqual(run_result["status"], "failed")
            self.assertNotIn("example.org", json.dumps(run_result))
            self.assertTrue(any(path.startswith("review_run.usage.<key#") and path.endswith(" (key)")
                                for path in refusal["paths"]), refusal["paths"])

    def test_schema_messages_never_echo_values_or_undeclared_keys(self):
        schema = {"type": "object", "additionalProperties": False,
                  "properties": {"kind": {"enum": ["a"]}, "code": {"type": "string", "pattern": "^x$"}, "n": {"type": "number", "maximum": 1}}}
        errors = runner.lib.validate({"kind": "office@example.org", "code": "021 123 4567", "n": 99, "Rev'd Pat Example": 1}, schema)
        self.assertEqual(len(errors), 4)
        text = "; ".join(errors)
        for leaked in ("office@example.org", "021 123 4567", "99", "Pat Example"):
            self.assertNotIn(leaked, text)
        self.assertIn("unexpected property <key#0>", text)

    def test_off_allowlist_locator_is_refused_before_review_and_counted(self):
        with tempfile.TemporaryDirectory() as tmp:
            stages, run_result = self._run_pair(Path(tmp), "https://www.example-parish.nz/pages/about",
                                                self._claude_manifest("research"), self._codex_manifest("review", "gpt-5.6-luna"))
            self.assertEqual(stages, ["research"])
            self.assertEqual(run_result["status"], "failed")
            self.assertEqual(run_result["exit_code"], 2)
            self.assertIn("not on allowlist nz-v1", run_result["error"])
            self.assertEqual(run_result["allowlist_violations"], 1)
            self.assertEqual(run_result["allowlist_violation_domains"], ["example-parish.nz"])
            self.assertFalse((Path(tmp) / "out" / "bundle.json").exists())

    def test_allowlist_counter_never_records_text_from_a_host(self):
        digest = __import__("hashlib").sha1(b"office@example.org").hexdigest()
        # a digest label falls outside the registrable domain; a phone-number label is redacted
        # out of the locator by the quarantine before counting, leaving no host to record
        for host, expected in ((f"{digest}.example.org", "example.org"),
                               ("021-123-4567.parish.example.co.nz", "<unparsed host>"),
                               ("www.stjohns.org.nz", "stjohns.org.nz")):
            with self.subTest(host), tempfile.TemporaryDirectory() as tmp:
                _, run_result = self._run_pair(Path(tmp), f"https://{host}/about",
                                               self._claude_manifest("research"), self._codex_manifest("review", "gpt-5.6-luna"))
                self.assertEqual(run_result["allowlist_violations"], 1)
                self.assertEqual(run_result["allowlist_violation_domains"], [expected])
                self.assertNotIn(digest, json.dumps(run_result))
                self.assertNotIn("021-123-4567", json.dumps(run_result))
        screened = runner.lib.screened_domain
        self.assertEqual(screened("021-123-4567.nz"), "<label#0>.nz")
        self.assertEqual(screened(f"www.{digest}.co.nz"), "<label#0>.co.nz")
        self.assertEqual(screened(f"{digest.upper()}.ORG"), "<label#0>.org")
        self.assertEqual(screened("parish.example.co.nz"), "example.co.nz")
        self.assertEqual(screened(""), "<unparsed host>")

    def test_unreported_research_model_is_refused_before_review(self):
        with tempfile.TemporaryDirectory() as tmp:
            stages, run_result = self._run_pair(Path(tmp), "https://nzhistory.govt.nz/test-church",
                                                self._codex_manifest("research", None), self._claude_manifest("review"),
                                                research_backend="codex")
            self.assertEqual(stages, ["research"])
            self.assertEqual(run_result["status"], "failed")
            self.assertIn("reported no model id", run_result["error"])
            self.assertEqual(run_result["allowlist_violations"], 0)

    def test_unreported_review_model_is_refused_at_the_bundle(self):
        with tempfile.TemporaryDirectory() as tmp:
            stages, run_result = self._run_pair(Path(tmp), "https://www.anglicanlife.org.nz/test-church",
                                                self._claude_manifest("research"), self._codex_manifest("review", None))
            self.assertEqual(stages, ["research", "review"])
            self.assertEqual(run_result["status"], "failed")
            self.assertIn("bundle rejected", run_result["error"])
            self.assertIn("model_id_reported", run_result["error"])
            self.assertFalse((Path(tmp) / "out" / "bundle.json").exists())

    def test_review_failures_keep_the_allowlist_counters(self):
        cases = [
            ("rejected review", {"review_source_url": "https://www.anglicanlife.org.nz/other-page"}, "review rejected"),
            ("review provider error", {"review_error": runner.RunnerError("codex timed out after 1s")}, "timed out"),
        ]
        for name, options, message in cases:
            with self.subTest(name), tempfile.TemporaryDirectory() as tmp:
                stages, run_result = self._run_pair(Path(tmp), "https://www.anglicanlife.org.nz/test-church",
                                                    self._claude_manifest("research"),
                                                    self._codex_manifest("review", "gpt-5.6-luna"), **options)
                self.assertEqual(stages, ["research", "review"])
                self.assertEqual(run_result["status"], "failed")
                self.assertIn(message, run_result["error"])
                self.assertEqual((run_result["allowlist_version"], run_result["allowlist_violations"],
                                  run_result["allowlist_violation_domains"]), ("nz-v1", 0, []))

    def test_incomplete_or_absent_per_model_cost_is_unknown_not_unmetered(self):
        envelope = json.loads(json.dumps(self.CLAUDE_ENVELOPE))
        del envelope["modelUsage"]["claude-haiku-4-5-20251001"]["costUSD"]
        for name, research_manifest, backend in [
            ("claude with a missing model cost", self._claude_manifest("research", envelope), "claude"),
            ("codex with no per-model block", self._codex_manifest("research", "gpt-5.6-luna"), "codex"),
        ]:
            review_manifest = self._codex_manifest("review", "gpt-5.6-luna") if backend == "claude" \
                else self._claude_manifest("review")
            with self.subTest(name), tempfile.TemporaryDirectory() as tmp:
                _, run_result = self._run_pair(Path(tmp), "https://www.anglicanlife.org.nz/test-church",
                                               research_manifest, review_manifest, research_backend=backend)
                self.assertEqual(run_result["status"], "completed", run_result["error"])
                manifest = json.loads((Path(tmp) / "out" / "bundle.json").read_text())["dossier"]["run_manifest"]
                self.assertIsNone(manifest["cost_usd_reported"])
                self.assertEqual(manifest["cost_basis"], "unknown")

    def test_provider_failure_leaves_allowlist_counters_null(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "out"
            seed = Path(tmp) / "seed.json"
            seed.write_text(json.dumps(SEED), encoding="utf-8")
            with patch.object(runner, "_preflight", return_value={"provider": "test", "version": "test"}), \
                 patch.object(runner, "_invoke", side_effect=runner.RunnerError("claude exited 1")), \
                 patch("sys.stderr", new_callable=io.StringIO):
                self.assertEqual(runner.main(["--seed", str(seed), "--out", str(out), "--public-nonsensitive"]), 2)
            run_result = json.loads((out / "run-result.json").read_text())
            self.assertIsNone(run_result["allowlist_violations"])

    def test_cost_is_read_per_billing_model(self):
        usage = self._claude_manifest("review")["usage"]
        per_model = usage["per_model"]
        self.assertEqual(per_model["source"], "provider_usage.modelUsage")
        self.assertEqual([m["model_id_reported"] for m in per_model["models"]], ["claude-haiku-4-5", "claude-sonnet-5"])
        self.assertAlmostEqual(per_model["cost_usd_reported"], 0.4, places=7)
        self.assertAlmostEqual(per_model["provider_total_cost_usd"], 0.4, places=7)
        self.assertEqual(per_model["cost_basis"], "tool_list_price")
        self.assertEqual(per_model["input_tokens"], 200007)
        self.assertEqual(per_model["web_search_requests"], 2)
        # the flat block still describes the requested model alone, which is why cost is not read from it.
        self.assertEqual(usage["input_tokens"], 7)
        sonnet = next(m for m in per_model["models"] if m["model_key"] == "claude-sonnet-5")
        self.assertAlmostEqual(per_model["cost_usd_reported"] / sonnet["cost_usd_reported"], 4.0, places=7)

    def test_per_model_totals_are_null_not_zero_when_a_model_omits_them(self):
        envelope = json.loads(json.dumps(self.CLAUDE_ENVELOPE))
        del envelope["modelUsage"]["claude-haiku-4-5-20251001"]["costUSD"]
        del envelope["modelUsage"]["claude-sonnet-5"]["webSearchRequests"]
        per_model = self._claude_manifest("review", envelope)["usage"]["per_model"]
        self.assertIsNone(per_model["cost_usd_reported"])
        self.assertEqual(per_model["cost_basis"], "unknown")
        self.assertIsNone(per_model["web_search_requests"])
        self.assertNotIn("per_model", self._codex_manifest("review", "gpt-5.6-luna")["usage"])

    def test_existing_bundle_refuses_before_provider_preflight(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp)
            (output / "bundle.json").write_text("{}", encoding="utf-8")
            with patch.object(runner, "_preflight", side_effect=AssertionError("provider spend")):
                with self.assertRaisesRegex(runner.RunnerError, "existing bundle"):
                    runner.run(SEED, "claude", "codex", output, public_nonsensitive=True)


class ProcessBoundTest(unittest.TestCase):
    class FakePipe(io.BytesIO):
        def close(self):
            super().close()

    class FakeProcess:
        pid = 99
        returncode = 0

        def __init__(self):
            self.stdin = ProcessBoundTest.FakePipe()
            self.stdout = ProcessBoundTest.FakePipe(b"{}")
            self.stderr = ProcessBoundTest.FakePipe(b"")
            self.killed = False

        def wait(self, timeout=None):
            return self.returncode

        def kill(self):
            self.killed = True

    def test_process_uses_fresh_cwd_and_clean_env(self):
        captured = {}
        process = self.FakeProcess()

        def fake_popen(command, **kwargs):
            captured.update(kwargs)
            captured["command"] = command
            return process

        with tempfile.TemporaryDirectory() as tmp:
            result = runner._run_process(["provider", "-"], "prompt", Path(tmp), 1, popen=fake_popen)
        self.assertEqual(result.returncode, 0)
        self.assertEqual(captured["cwd"], tmp)
        self.assertTrue(captured["start_new_session"])
        self.assertNotIn("OPENROUTER_API_KEY", captured["env"])

    def test_timeout_kills_the_provider_process(self):
        process = self.FakeProcess()
        waits = iter([subprocess.TimeoutExpired(["provider"], 1), 0])

        def wait(timeout=None):
            value = next(waits)
            if isinstance(value, BaseException):
                raise value
            return value

        process.wait = wait
        with tempfile.TemporaryDirectory() as tmp, patch.object(runner.os, "killpg", side_effect=ProcessLookupError):
            result = runner._run_process(["provider", "-"], "prompt", Path(tmp), 1, popen=lambda *a, **k: process)
        self.assertTrue(result.timed_out)
        self.assertTrue(process.killed)


if __name__ == "__main__":
    unittest.main()
