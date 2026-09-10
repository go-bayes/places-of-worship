#!/usr/bin/env python3
"""run one independent researcher backend over one place and write an
agent-dossier.v1 json file.

backends:
  claude      `claude -p` headless on the user's subscription; only the
              WebSearch and WebFetch tools are enabled; structured output
              through --json-schema.
  codex       `codex exec` with live web search, read-only sandbox, an empty
              working directory, structured output through --output-schema.
  openrouter  an https call to openrouter.ai (OPENROUTER_API_KEY); untested
              on this machine because the key is not set.

every backend records provenance: backend, the model id the tool reported,
prompt version, start and end time, usage and cost where the tool reports
them, an idempotency key (place ref, prompt version, model, seed edition),
and the tool permissions granted. personal details found in the reader's
text are quarantined; pass --redact for a copy fit to commit.

usage:
  uv run python scripts/agent_research/research_place.py \\
      --place-ref osm:way/643590665 --name "St Martin's Anglican Church" \\
      --lat -43.2492 --lon 172.5286 --country NZ --backend claude \\
      --out scripts/agent_research/runs/pilot/

nothing here touches convex or any live surface.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import lib  # noqa: E402

HERE = Path(__file__).resolve().parent
PROMPT_VERSION = "researcher.v1"
PROMPT_PATH = HERE / "prompts" / f"{PROMPT_VERSION}.md"
READER_SCHEMA_PATH = HERE / "schemas" / "reader-output.v1.json"
ALLOWLIST_PATH = HERE / "fixtures" / "allowlist-nz-v1.json"
SEED_SOURCE_DEFAULT = "nz_places.geojson (overpass extract 2025-08-20)"

# model ids are requested by alias where the tool takes one; the reported id
# is what the tool says it ran. r-a9 (which models) is an open ruling.
DEFAULT_MODELS = {
    "claude": "opus",
    "codex": "gpt-5.6-luna",  # jb ruling 2026-09-10: luna may be used, sol is too expensive
    "openrouter": "z-ai/glm-5.3-flash",
}
DEFAULT_TIMEOUT_S = 1200
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


class BackendError(RuntimeError):
    pass


def load_prompt(place: dict, allowlist: dict) -> tuple[str, str]:
    text = PROMPT_PATH.read_text(encoding="utf-8")
    system_part, user_part = text.split("## user", 1)
    system_part = system_part.split("## system", 1)[1]
    osm_type, osm_id = "", ""
    m = re.fullmatch(r"osm:(node|way|relation)/(\d+)", place["place_ref"])
    if m:
        osm_type, osm_id = m.group(1), m.group(2)
    fill = {
        "{{allowlist_version}}": allowlist["allowlist_version"],
        "{{allowlist}}": ", ".join(allowlist["domains"]),
        "{{name}}": place["name"],
        "{{place_ref}}": place["place_ref"],
        "{{lat}}": f"{place['seed_latitude']:.6f}",
        "{{lon}}": f"{place['seed_longitude']:.6f}",
        "{{country}}": place["country_code"],
        "{{seed_tags}}": json.dumps(place.get("seed_tags") or {}, ensure_ascii=False),
        "{{today}}": date.today().isoformat(),
        "{{osm_type}}": osm_type or "<type>",
        "{{osm_id}}": osm_id or "<id>",
    }
    for key, value in fill.items():
        system_part = system_part.replace(key, value)
        user_part = user_part.replace(key, value)
    return system_part.strip(), user_part.strip()


def _extract_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start >= 0 and end > start:
            return json.loads(text[start:end + 1])
        raise


# ---------------------------------------------------------------------------
# backends: each returns (reader_output, manifest_fields)


def run_claude(system_prompt: str, user_prompt: str, model: str, timeout_s: int, budget_usd: float) -> tuple[dict, dict]:
    # the cli's validator rejects the draft-2020 $schema key; strip the metadata keys
    schema_doc = json.loads(READER_SCHEMA_PATH.read_text(encoding="utf-8"))
    schema = json.dumps({k: v for k, v in schema_doc.items() if not k.startswith("$")})
    cmd = [
        "claude", "-p",
        "--output-format", "json",
        "--json-schema", schema,
        "--tools", "WebSearch,WebFetch",
        "--allowedTools", "WebSearch,WebFetch",
        "--permission-mode", "dontAsk",
        "--permission-prompts", "none",
        "--strict-mcp-config",
        "--disable-slash-commands",
        "--no-session-persistence",
        "--system-prompt", system_prompt,
        "--model", model,
        "--max-budget-usd", str(budget_usd),
        user_prompt,
    ]
    # an empty working directory: no CLAUDE.md, no project context, no files to read
    with tempfile.TemporaryDirectory(prefix="pow-reader-claude-") as workdir:
        try:
            proc = subprocess.run(cmd, cwd=workdir, capture_output=True, text=True, timeout=timeout_s, stdin=subprocess.DEVNULL)
        except subprocess.TimeoutExpired as exc:
            raise BackendError(f"claude timed out after {timeout_s}s; stderr tail: {(exc.stderr or '')[-500:]}") from exc
    if proc.returncode != 0 and not proc.stdout.strip():
        raise BackendError(f"claude exited {proc.returncode}: {proc.stderr[-1000:]}")
    try:
        envelope = json.loads(proc.stdout.strip().splitlines()[-1])
    except (json.JSONDecodeError, IndexError) as exc:
        raise BackendError(f"claude returned no json envelope: {proc.stdout[-800:]} {proc.stderr[-500:]}") from exc
    if envelope.get("is_error"):
        raise BackendError(f"claude reported an error: {json.dumps(envelope)[:1200]}")
    output = envelope.get("structured_output")
    if output is None:
        output = _extract_json(envelope.get("result", ""))
    usage = envelope.get("usage", {})
    model_usage = envelope.get("modelUsage", {})
    reported = None
    for name, row in model_usage.items():
        reported = row.get("canonicalModel") or name
        break
    server_tools = usage.get("server_tool_use", {})
    manifest = {
        "model_id_reported": reported,
        "usage": {
            "input_tokens": usage.get("input_tokens"),
            "cached_input_tokens": (usage.get("cache_read_input_tokens") or 0) + (usage.get("cache_creation_input_tokens") or 0),
            "output_tokens": usage.get("output_tokens"),
            "reasoning_tokens": (usage.get("output_tokens_details") or {}).get("thinking_tokens"),
            "web_search_requests": server_tools.get("web_search_requests"),
            "web_fetch_requests": server_tools.get("web_fetch_requests"),
        },
        "cost_usd_reported": envelope.get("total_cost_usd"),
        # the cli prices at list; the run itself is on a subscription
        "cost_basis": "tool_list_price",
        "tool_permissions": ["WebSearch", "WebFetch"],
        "notes": f"claude session {envelope.get('session_id')}; num_turns {envelope.get('num_turns')}; permission_denials {len(envelope.get('permission_denials', []))}",
    }
    return output, manifest


def run_codex(system_prompt: str, user_prompt: str, model: str, timeout_s: int, effort: str = "medium") -> tuple[dict, dict]:
    prompt = f"{system_prompt}\n\n---\n\n{user_prompt}"
    with tempfile.TemporaryDirectory(prefix="pow-reader-codex-") as workdir:
        last_message = Path(workdir) / "last-message.json"
        cmd = [
            "codex", "exec",
            "--skip-git-repo-check",
            "--sandbox", "read-only",
            "--ephemeral",
            "-C", workdir,
            "-c", 'web_search="live"',
            "-c", f'model_reasoning_effort="{effort}"',
            "-m", model,
            "--output-schema", str(READER_SCHEMA_PATH),
            "--json",
            "-o", str(last_message),
            prompt,
        ]
        try:
            proc = subprocess.run(cmd, cwd=workdir, capture_output=True, text=True, timeout=timeout_s, stdin=subprocess.DEVNULL)
        except subprocess.TimeoutExpired as exc:
            raise BackendError(f"codex timed out after {timeout_s}s; stdout tail: {(exc.stdout or '')[-500:]}") from exc
        events = []
        for line in proc.stdout.splitlines():
            line = line.strip()
            if line.startswith("{"):
                try:
                    events.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
        errors = [e for e in events if e.get("type") in ("error", "turn.failed")]
        if errors:
            raise BackendError(f"codex reported: {json.dumps(errors)[:1200]}")
        if not last_message.exists():
            raise BackendError(f"codex wrote no final message (exit {proc.returncode}): {proc.stderr[-800:]}")
        output = _extract_json(last_message.read_text(encoding="utf-8"))
    usage = {}
    for event in events:
        if event.get("type") == "turn.completed":
            usage = event.get("usage", {})
    searches = sum(1 for e in events if e.get("type") == "item.completed" and e.get("item", {}).get("type") == "web_search")
    thread = next((e for e in events if e.get("type") == "thread.started"), {})
    manifest = {
        # codex's jsonl names no model; the request id is the only reported identity
        "model_id_reported": thread.get("model") or None,
        "usage": {
            "input_tokens": usage.get("input_tokens"),
            "cached_input_tokens": usage.get("cached_input_tokens"),
            "output_tokens": usage.get("output_tokens"),
            "reasoning_tokens": usage.get("reasoning_output_tokens"),
            "web_search_requests": searches,
            "web_fetch_requests": None,
        },
        "cost_usd_reported": None,
        "cost_basis": "subscription_unmetered",
        "tool_permissions": ["web_search (live)", "sandbox read-only, empty workdir"],
        "notes": f"codex thread {thread.get('thread_id')}; reasoning effort {effort}; exit {proc.returncode}",
    }
    return output, manifest


def run_openrouter(system_prompt: str, user_prompt: str, model: str, timeout_s: int) -> tuple[dict, dict]:
    """untested: OPENROUTER_API_KEY is not set on the development machine.
    the web plugin gives the model search results as context; it is the
    route joseph watts used with glm 5.3 flash."""
    key = os.environ.get("OPENROUTER_API_KEY")
    if not key:
        raise BackendError("OPENROUTER_API_KEY is not set; openrouter backend not run")
    schema = json.loads(READER_SCHEMA_PATH.read_text(encoding="utf-8"))
    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "plugins": [{"id": "web"}],
        "response_format": {"type": "json_schema", "json_schema": {"name": "reader_output", "strict": True, "schema": schema}},
        "temperature": 0,
    }
    request = urllib.request.Request(
        OPENROUTER_URL,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://religionmap.org",
            "X-Title": "religionmap agent research pilot",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout_s) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise BackendError(f"openrouter http {exc.code}: {exc.read()[:500]!r}") from exc
    except urllib.error.URLError as exc:
        raise BackendError(f"openrouter unreachable: {exc}") from exc
    content = payload["choices"][0]["message"]["content"]
    output = _extract_json(content)
    usage = payload.get("usage", {})
    manifest = {
        "model_id_reported": payload.get("model"),
        "usage": {
            "input_tokens": usage.get("prompt_tokens"),
            "cached_input_tokens": (usage.get("prompt_tokens_details") or {}).get("cached_tokens"),
            "output_tokens": usage.get("completion_tokens"),
            "reasoning_tokens": (usage.get("completion_tokens_details") or {}).get("reasoning_tokens"),
            "web_search_requests": None,
            "web_fetch_requests": None,
        },
        "cost_usd_reported": usage.get("cost"),
        "cost_basis": "api_invoice" if usage.get("cost") is not None else "unknown",
        "tool_permissions": ["openrouter web plugin"],
        "notes": f"openrouter id {payload.get('id')}",
    }
    return output, manifest


# ---------------------------------------------------------------------------
# assembly


def assemble_dossier(place: dict, output: dict, backend: str, model_requested: str, manifest_fields: dict,
                     started_at: str, ended_at: str, duration_s: float, run_id: str, allowlist_version: str,
                     exit_status: str = "completed") -> dict:
    reader_id = f"{backend}:{model_requested}:{PROMPT_VERSION}"
    reader = {
        "reader_id": reader_id,
        "backend": backend,
        "model_id": manifest_fields.get("model_id_reported") or model_requested,
        "prompt_version": PROMPT_VERSION,
    }
    claims = []
    for index, raw in enumerate(output.get("claims", []), start=1):
        source = dict(raw.get("source", {}))
        source["retrieved_at"] = ended_at[:10]
        claim = {
            "claim_id": f"{place['place_ref']}:{backend}:c{index:02d}",
            "claim_type": raw.get("claim_type", "other"),
            "value": raw.get("value") or "(empty)",
            "date_start": raw.get("date_start") or None,
            "date_end": raw.get("date_end") or None,
            "date_precision": raw.get("date_precision", "unknown"),
            "source": source,
            "quoted_support": (raw.get("quoted_support") or "")[:600],
            "evidential_weight": raw.get("evidential_weight", "inferred"),
            "reader": reader,
            "confidence": raw.get("confidence", "low"),
            "note": raw.get("note", ""),
        }
        # a date the schema cannot parse is kept in the note rather than dropped
        for field in ("date_start", "date_end"):
            value = claim[field]
            if value is not None and not re.fullmatch(r"[0-9]{4}(-[0-9]{2}(-[0-9]{2})?)?", value):
                claim["note"] = f"{claim['note']} [{field} as given: {value}]".strip()
                claim[field] = None
        claims.append(claim)
    assessment = output.get("status_assessment", {})
    asof = assessment.get("asof_date") or ended_at[:10]
    if not re.fullmatch(r"[0-9]{4}(-[0-9]{2}(-[0-9]{2})?)?", asof):
        asof = ended_at[:10]
    location = output.get("candidate_location", {})
    dossier = {
        "schema_version": lib.SCHEMA_VERSION,
        "dossier_id": f"{place['place_ref']}:{reader_id}:{run_id}",
        "place": {
            "place_ref": place["place_ref"],
            "name": place["name"],
            "country_code": place["country_code"],
            "seed_latitude": place["seed_latitude"],
            "seed_longitude": place["seed_longitude"],
            "seed_source": place.get("seed_source", SEED_SOURCE_DEFAULT),
            "seed_tags": place.get("seed_tags") or {},
        },
        "candidate_location": {
            "latitude": location.get("latitude"),
            "longitude": location.get("longitude"),
            "basis": location.get("basis", "not_assessed"),
            "basis_note": location.get("basis_note", ""),
            "uncertainty_radius_m": location.get("uncertainty_radius_m"),
            "address": location.get("address"),
        },
        "claims": claims,
        "status_assessment": {
            "current_status": assessment.get("current_status", "unknown"),
            "basis": assessment.get("basis") or "(no basis given)",
            "asof_date": asof,
            "supporting_claim_ids": [],
            "osm_stale": assessment.get("osm_stale"),
            "osm_stale_basis": assessment.get("osm_stale_basis", ""),
        },
        "osm_version_chain": [
            {
                "version": int(entry.get("version") or 0) or 1,
                "changeset": entry.get("changeset"),
                "timestamp": entry.get("timestamp"),
                "timestamp_basis": entry.get("timestamp_basis", "unknown"),
                "tags_summary": entry.get("tags_summary", ""),
                "change_note": entry.get("change_note", ""),
                "locator": entry.get("locator", ""),
            }
            for entry in output.get("osm_version_chain", [])
        ],
        "personal_details_quarantine": {"redacted": False, "item_count": 0, "items": []},
        "provenance": {
            "producer": "agent_reader",
            "ai_generated": True,
            "produced_by": reader_id,
            "lane": "agent_autonomous",
        },
        "run_manifest": {
            "run_id": run_id,
            "backend": backend,
            "model_id_requested": model_requested,
            "model_id_reported": manifest_fields.get("model_id_reported"),
            "prompt_version": PROMPT_VERSION,
            "started_at": started_at,
            "ended_at": ended_at,
            "duration_s": round(duration_s, 1),
            "usage": manifest_fields.get("usage", {}),
            "cost_usd_reported": manifest_fields.get("cost_usd_reported"),
            "cost_basis": manifest_fields.get("cost_basis", "unknown"),
            "idempotency_key": lib.idempotency_key(place["place_ref"], PROMPT_VERSION, model_requested,
                                                  place.get("seed_source", SEED_SOURCE_DEFAULT)),
            "allowlist_version": allowlist_version,
            "tool_permissions": manifest_fields.get("tool_permissions", []),
            "exit_status": exit_status,
            "notes": " | ".join(filter(None, [manifest_fields.get("notes", ""), output.get("notes", "")]))[:2000],
        },
    }
    # the reader's sources_consulted are kept in the manifest notes as a count and list
    consulted = output.get("sources_consulted", [])
    if consulted:
        dossier["run_manifest"]["notes"] = (
            dossier["run_manifest"]["notes"] + f" | sources_consulted ({len(consulted)}): "
            + "; ".join(f"{s.get('locator')} [{s.get('outcome')}]" for s in consulted)
        )[:4000]
    lib.quarantine_dossier(dossier)
    return dossier


def slug(place_ref: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", place_ref.lower()).strip("-")


def research(place: dict, backend: str, model: str | None, out_dir: Path, run_id: str, timeout_s: int,
             budget_usd: float, redact_dir: Path | None = None, effort: str = "medium") -> Path:
    allowlist = json.loads(ALLOWLIST_PATH.read_text(encoding="utf-8"))
    model = model or DEFAULT_MODELS[backend]
    system_prompt, user_prompt = load_prompt(place, allowlist)
    started = time.time()
    started_at = lib.utc_now()
    try:
        if backend == "claude":
            output, fields = run_claude(system_prompt, user_prompt, model, timeout_s, budget_usd)
        elif backend == "codex":
            output, fields = run_codex(system_prompt, user_prompt, model, timeout_s, effort)
        elif backend == "openrouter":
            output, fields = run_openrouter(system_prompt, user_prompt, model, timeout_s)
        else:
            raise BackendError(f"unknown backend {backend}")
        exit_status = "completed"
    except BackendError as exc:
        output, fields = {"claims": [], "status_assessment": {}, "notes": str(exc)}, {"notes": str(exc)}
        exit_status = "timed_out" if "timed out" in str(exc) else "failed"
    ended_at = lib.utc_now()
    dossier = assemble_dossier(place, output, backend, model, fields, started_at, ended_at, time.time() - started,
                               run_id, allowlist["allowlist_version"], exit_status)
    errors = lib.validate_dossier(dossier)
    if errors:
        dossier["run_manifest"]["notes"] = (dossier["run_manifest"]["notes"] + " | schema: " + "; ".join(errors[:10]))[:4000]
    out_path = out_dir / f"{slug(place['place_ref'])}.{backend}.dossier.json"
    lib.write_json(out_path, dossier)
    if redact_dir is not None:
        lib.write_json(redact_dir / out_path.name, lib.redact_quarantine(json.loads(json.dumps(dossier))))
    return out_path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--place-ref", required=True, help="osm:<type>/<id> or new:<slug>")
    parser.add_argument("--name", required=True)
    parser.add_argument("--lat", type=float, required=True)
    parser.add_argument("--lon", type=float, required=True)
    parser.add_argument("--country", default="NZ")
    parser.add_argument("--seed-tags", default="{}", help="json object of osm tags at seed time")
    parser.add_argument("--seed-source", default=SEED_SOURCE_DEFAULT)
    parser.add_argument("--backend", choices=sorted(DEFAULT_MODELS), required=True)
    parser.add_argument("--model", default=None, help="model id or alias; default per backend")
    parser.add_argument("--effort", default="medium", help="codex reasoning effort")
    parser.add_argument("--out", type=Path, required=True, help="run directory for the unredacted dossier")
    parser.add_argument("--redact-dir", type=Path, default=None, help="where to write a redacted copy")
    parser.add_argument("--run-id", default=None)
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT_S)
    parser.add_argument("--budget-usd", type=float, default=6.0, help="claude only: --max-budget-usd")
    args = parser.parse_args(argv)

    place = {
        "place_ref": args.place_ref,
        "name": args.name,
        "country_code": args.country,
        "seed_latitude": args.lat,
        "seed_longitude": args.lon,
        "seed_source": args.seed_source,
        "seed_tags": json.loads(args.seed_tags),
    }
    run_id = args.run_id or f"run-{lib.utc_now().replace(':', '').replace('-', '')}"
    path = research(place, args.backend, args.model, args.out, run_id, args.timeout, args.budget_usd, args.redact_dir, args.effort)
    dossier = lib.read_json(path)
    manifest = dossier["run_manifest"]
    print(f"{args.backend}: {manifest['exit_status']} in {manifest['duration_s']}s, {len(dossier['claims'])} claims, "
          f"model {manifest['model_id_reported']}, cost {manifest['cost_usd_reported']} ({manifest['cost_basis']}), "
          f"quarantined {dossier['personal_details_quarantine']['item_count']} -> {path}")
    return 0 if manifest["exit_status"] == "completed" else 1


if __name__ == "__main__":
    sys.exit(main())
