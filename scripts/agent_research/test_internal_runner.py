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
            "total_cost_usd": 0.62,
            "modelUsage": {
                "claude-haiku-4-5-20251001": {"canonicalModel": "claude-haiku-4-5", "inputTokens": 100, "costUSD": 0.4},
                "claude-sonnet-5": {"canonicalModel": "claude-sonnet-5", "inputTokens": 200, "costUSD": 0.22},
            },
        }
        output, fields = runner._parse_claude(json.dumps(envelope), "sonnet")
        self.assertEqual(output, {})
        self.assertEqual(fields["model_id_reported"], "claude-sonnet-5")
        self.assertEqual(fields["usage_full"]["total_cost_usd"], 0.62)
        self.assertIn("claude-haiku-4-5-20251001", fields["usage_full"]["modelUsage"])
        manifest = runner._manifest("review", "claude", "sonnet", "2026-09-11T00:00:00+00:00",
                                     "2026-09-11T00:00:01+00:00", runner.ProcessResult(0, b"{}", b"", False, False),
                                     fields, "prompt", {"version": "test"}, exit_status="completed")
        self.assertEqual(manifest["usage"]["provider_usage"]["total_cost_usd"], 0.62)
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

    def test_mocked_pair_reaches_real_intake_bundle_validation(self):
        source_url = "https://example.org/test-church"
        reader_output = {
            "name": "Test Church",
            "candidate_location": {"latitude": -43.0, "longitude": 172.0, "basis": "osm_object", "basis_note": "",
                                    "uncertainty_radius_m": 10, "address": None},
            "claims": [{
                "claim_type": "name", "value": "Test Church", "date_start": None, "date_end": None,
                "date_precision": "unknown", "source": {"locator": source_url, "source_name": "Test source",
                "source_type": "church_website", "source_date": None, "source_date_basis": "not_stated"},
                "quoted_support": "Test Church", "evidential_weight": "primary_institutional", "confidence": "high", "note": "",
            }],
            "status_assessment": {"current_status": "unknown", "basis": "test", "asof_date": "2026-09-11",
                                  "osm_stale": None, "osm_stale_basis": ""},
            "osm_version_chain": [], "sources_consulted": [{"locator": source_url, "outcome": "relevant"}], "notes": "",
        }
        research_manifest = runner._manifest("research", "claude", "sonnet", "2026-09-11T00:00:00+00:00",
                                             "2026-09-11T00:00:01+00:00", runner.ProcessResult(0, b"{}", b"", False, False),
                                             {"usage": {"input_tokens": 1}, "model_id_reported": None}, "prompt", {"version": "test"},
                                             exit_status="completed")
        review_manifest = runner._manifest("review", "codex", "gpt-5.6-luna", "2026-09-11T00:00:02+00:00",
                                           "2026-09-11T00:00:03+00:00", runner.ProcessResult(0, b"{}", b"", False, False),
                                           {"usage": {"output_tokens": 1}, "model_id_reported": None}, "prompt", {"version": "test"},
                                           exit_status="completed")

        def fake_invoke(stage, provider, model, system, user, timeout_s, budget_usd, pause_file, raw_path, preflight):
            if stage == "research":
                return reader_output, research_manifest
            return {"schema_version": "agent-review.v1", "recommendation": "revise", "reasoning": "test",
                    "claim_checks": [{"claim_id": "osm:way/123:claude:c01", "outcome": "supported",
                                       "source_url": source_url, "note": "test", "access_method": "opened"}],
                    "cultural_sensitivity": {"flagged": False, "basis": "none"}, "limitations": []}, review_manifest

        with tempfile.TemporaryDirectory() as tmp:
            with patch.object(runner, "_preflight", return_value={"provider": "test", "version": "test"}), \
                 patch.object(runner, "_invoke", side_effect=fake_invoke):
                result = runner.run(SEED, "claude", "codex", Path(tmp), public_nonsensitive=True)
            self.assertTrue((Path(tmp) / "bundle.json").exists())
            run_result = json.loads((Path(tmp) / "run-result.json").read_text())
            self.assertEqual(run_result["status"], "completed")
            self.assertEqual(result["bundle"]["provisional"], True)

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
