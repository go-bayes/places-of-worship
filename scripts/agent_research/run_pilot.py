#!/usr/bin/env python3
"""run the pilot set through two or more independent readers, validate every
dossier, compute agreement per place, and write a markdown report.

each (place, backend) pair runs research_place.py as a subprocess so one
reader's failure cannot take the run down; the collaborator fixture joins
as a reader for the place it covers. the run directory keeps unredacted
dossiers (git-ignored); redacted copies and the validation reports go
under reports/<run id>/ for commit. an existing dossier for the same
idempotency key is reused unless --force.

usage:
  uv run python scripts/agent_research/run_pilot.py --run-id pilot-2026-09-10 \\
      --backends claude,codex

nothing here touches convex or any live surface.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import lib  # noqa: E402
import validate_dossier as validator  # noqa: E402
from research_place import DEFAULT_MODELS, PROMPT_VERSION, slug  # noqa: E402

HERE = Path(__file__).resolve().parent
PILOT_SET = HERE / "fixtures" / "pilot-set.json"
COLLABORATOR_FIXTURES = {
    "osm:way/643590665": HERE / "fixtures" / "watts-st-martins-loburn-2026-09-09.dossier.json",
}

# list prices for the estimate column, usd per million tokens, verified
# 2026-09-10 (docs/development/agent-research-pipeline-brief-2026-09-10.md
# section 8 gives the pages). codex runs on a chatgpt plan and reports no
# cost, so its column is an estimate at openai's list price; claude's
# column is the cli's own list-price figure.
LIST_PRICES = {
    "gpt-5.6-sol": {"input": 4.0, "cached": 0.40, "output": 20.0, "source": "developers.openai.com/api/docs/pricing, 2026-09-10"},
    "gpt-5.6-terra": {"input": 2.0, "cached": 0.20, "output": 12.0, "source": "developers.openai.com/api/docs/pricing, 2026-09-10"},
    "gpt-5.6-luna": {"input": 0.20, "cached": 0.02, "output": 1.20, "source": "developers.openai.com/api/docs/pricing, 2026-09-10"},
    "z-ai/glm-5.3-flash": {"input": 0.075, "cached": 0.015, "output": 0.25, "source": "openrouter.ai/z-ai, 2026-09-10 (z.ai list is 0.15/0.50)"},
}


def estimate_cost(manifest: dict) -> float | None:
    if manifest.get("cost_usd_reported") is not None:
        return manifest["cost_usd_reported"]
    prices = LIST_PRICES.get(manifest.get("model_id_requested", ""))
    usage = manifest.get("usage") or {}
    if not prices or usage.get("input_tokens") is None:
        return None
    cached = usage.get("cached_input_tokens") or 0
    uncached = max((usage.get("input_tokens") or 0) - cached, 0)
    output = usage.get("output_tokens") or 0
    return round((uncached * prices["input"] + cached * prices["cached"] + output * prices["output"]) / 1_000_000, 4)


def run_reader(place: dict, backend: str, run_dir: Path, redact_dir: Path, run_id: str, timeout: int, force: bool, effort: str) -> Path:
    out_path = run_dir / f"{slug(place['place_ref'])}.{backend}.dossier.json"
    if out_path.exists() and not force:
        existing = lib.read_json(out_path)
        key = lib.idempotency_key(place["place_ref"], PROMPT_VERSION, DEFAULT_MODELS[backend], place["seed_source"])
        if existing["run_manifest"]["idempotency_key"] == key and existing["run_manifest"]["exit_status"] == "completed":
            print(f"  {backend}: reusing {out_path.name}")
            lib.write_json(redact_dir / out_path.name, lib.redact_quarantine(json.loads(json.dumps(existing))))
            return out_path
    cmd = [
        sys.executable, str(HERE / "research_place.py"),
        "--place-ref", place["place_ref"],
        "--name", place["name"],
        "--lat", str(place["seed_latitude"]),
        "--lon", str(place["seed_longitude"]),
        "--country", place["country_code"],
        "--seed-tags", json.dumps(place.get("seed_tags") or {}),
        "--seed-source", place["seed_source"],
        "--backend", backend,
        "--effort", effort,
        "--out", str(run_dir),
        "--redact-dir", str(redact_dir),
        "--run-id", run_id,
        "--timeout", str(timeout),
    ]
    started = time.time()
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout + 60)
    print(f"  {backend}: {proc.stdout.strip()[-300:]}" + (f" [stderr: {proc.stderr.strip()[-300:]}]" if proc.returncode else ""))
    if not out_path.exists():
        # the subprocess died before writing: record a failed dossier so the report can say so
        failed = {
            "schema_version": lib.SCHEMA_VERSION,
            "dossier_id": f"{place['place_ref']}:{backend}:{run_id}:failed",
            "place": {k: place[k] for k in ("place_ref", "name", "country_code", "seed_latitude", "seed_longitude", "seed_source")},
            "candidate_location": {"latitude": None, "longitude": None, "basis": "not_assessed"},
            "claims": [],
            "status_assessment": {"current_status": "unknown", "basis": "reader failed", "asof_date": run_id[-10:] if run_id[-10:].count("-") == 2 else "2026", "supporting_claim_ids": [], "osm_stale": None},
            "osm_version_chain": [],
            "personal_details_quarantine": {"redacted": True, "item_count": 0, "items": []},
            "provenance": {"producer": "agent_reader", "ai_generated": True, "produced_by": f"{backend}:{DEFAULT_MODELS[backend]}:{PROMPT_VERSION}", "lane": "agent_autonomous"},
            "run_manifest": {
                "run_id": run_id, "backend": backend, "model_id_requested": DEFAULT_MODELS[backend], "model_id_reported": None,
                "prompt_version": PROMPT_VERSION, "started_at": lib.utc_now(), "ended_at": lib.utc_now(), "duration_s": round(time.time() - started, 1),
                "idempotency_key": lib.idempotency_key(place["place_ref"], PROMPT_VERSION, DEFAULT_MODELS[backend], place["seed_source"]),
                "cost_basis": "unknown", "exit_status": "failed",
                "notes": f"subprocess exit {proc.returncode}: {proc.stderr.strip()[-800:]}",
            },
        }
        lib.write_json(out_path, failed)
        lib.write_json(redact_dir / out_path.name, failed)
    return out_path


def fmt(value, digits=2):
    if value is None:
        return "—"
    if isinstance(value, float):
        return f"{value:.{digits}f}"
    return str(value)


def pct(value):
    return "—" if value is None else f"{100 * value:.0f}%"


def write_report(run_id: str, backends: list[str], results: list[dict], report_path: Path, started_at: str, ended_at: str) -> None:
    lines = [f"# Agent research pilot report: {run_id}", ""]
    lines.append(f"Run started {started_at}, finished {ended_at}. Readers per place: {', '.join(backends)}, plus the collaborator dossier where one exists. Prompt {PROMPT_VERSION}; allowlist nz-v1. Every number here is computed from the run's dossiers and the validator's fetches; nothing is estimated except the cost column where the tool reported none (marked est.).")
    lines.append("")
    lines.append("Locator validity is the share of distinct locators that returned a page (HTTP 200); quote support is the share of claims with a verbatim quote whose quote was found on the fetched page, exactly or as at least 60 percent of its word bigrams; agreement is the share of claim types made by two or more readers on which every pair agreed within tolerance (a year for dates, 75 m for coordinates, token overlap for text).")
    lines.append("")
    lines.append("## Per place and reader")
    lines.append("")
    lines.append("| Place | Reader | Status | Claims | Locators | Validity | Quote support (exact) | Tokens in / out | Cost USD | Time s | Status assessment | OSM stale |")
    lines.append("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |")
    totals: dict[str, dict] = {}
    for result in results:
        for dossier, validation in zip(result["dossiers"], result["validation"]["dossiers"]):
            manifest = dossier["run_manifest"]
            summary = validation["summary"]
            backend = manifest["backend"]
            usage = manifest.get("usage") or {}
            cost = estimate_cost(manifest)
            cost_label = fmt(cost, 3) + ("" if manifest.get("cost_usd_reported") is not None else " est." if cost is not None else "")
            lines.append(
                f"| {result['place']['name']} | {backend} | {manifest['exit_status']} | {summary['claims']} | {summary['distinct_locators']} | "
                f"{pct(summary['locator_validity_rate'])} | {pct(summary['quote_support_rate'])} ({pct(summary['quote_exact_rate'])}) | "
                f"{fmt(usage.get('input_tokens'))} / {fmt(usage.get('output_tokens'))} | {cost_label} | {fmt(manifest.get('duration_s'), 0)} | "
                f"{dossier['status_assessment']['current_status']} | {dossier['status_assessment'].get('osm_stale')} |"
            )
            t = totals.setdefault(backend, {"runs": 0, "completed": 0, "claims": 0, "locators": 0, "reachable": 0, "quoted": 0, "supported": 0, "exact": 0, "cost": 0.0, "cost_n": 0, "time": 0.0, "in": 0, "out": 0})
            t["runs"] += 1
            t["completed"] += manifest["exit_status"] == "completed"
            t["claims"] += summary["claims"]
            t["locators"] += summary["distinct_locators"]
            t["reachable"] += summary["distinct_reachable"]
            t["quoted"] += summary["quote_supported"] + summary["quote_partial"] + summary["quote_not_found"]
            t["supported"] += summary["quote_supported"] + summary["quote_partial"]
            t["exact"] += summary["quote_supported"]
            if cost is not None:
                t["cost"] += cost
                t["cost_n"] += 1
            t["time"] += manifest.get("duration_s") or 0
            t["in"] += usage.get("input_tokens") or 0
            t["out"] += usage.get("output_tokens") or 0
    lines.append("")
    lines.append("## Per reader totals")
    lines.append("")
    lines.append("| Reader | Runs (completed) | Claims | Distinct locators | Validity | Quote support (exact) | Mean tokens in / out | Mean cost USD | Mean time s |")
    lines.append("| --- | --- | --- | --- | --- | --- | --- | --- | --- |")
    for backend, t in totals.items():
        n = max(t["runs"], 1)
        lines.append(
            f"| {backend} | {t['runs']} ({t['completed']}) | {t['claims']} | {t['locators']} | {pct(t['reachable'] / t['locators'] if t['locators'] else None)} | "
            f"{pct(t['supported'] / t['quoted'] if t['quoted'] else None)} ({pct(t['exact'] / t['quoted'] if t['quoted'] else None)}) | "
            f"{t['in'] // n} / {t['out'] // n} | {fmt(t['cost'] / t['cost_n'], 3) if t['cost_n'] else '—'} | {fmt(t['time'] / n, 0)} |"
        )
    lines.append("")
    lines.append("## Agreement between readers")
    lines.append("")
    lines.append("| Place | Readers | Claim types compared | Agreed | Disagreed | Rate | Escalate to human |")
    lines.append("| --- | --- | --- | --- | --- | --- | --- |")
    for result in results:
        agreement = result["validation"]["agreement"]
        if "agreement_rate" not in agreement:
            lines.append(f"| {result['place']['name']} | {len(result['dossiers'])} | — | — | — | — | {agreement.get('note', '')} |")
            continue
        lines.append(
            f"| {result['place']['name']} | {len(agreement['readers'])} | {agreement['claim_types_compared']} | {agreement['agreed']} | "
            f"{agreement['disagreed']} | {pct(agreement['agreement_rate'])} | {', '.join(agreement['escalate_to_human']) or 'none'} |"
        )
    lines.append("")
    lines.append("## Location and OSM checks")
    lines.append("")
    lines.append("| Place | Seed to OSM centroid m | Reader | Candidate to OSM m | Within 75 m | Version chain claimed / actual / confirmed / contradicted | OSM still says place_of_worship |")
    lines.append("| --- | --- | --- | --- | --- | --- | --- |")
    for result in results:
        osm = result["validation"].get("osm") or {}
        for dossier, validation in zip(result["dossiers"], result["validation"]["dossiers"]):
            loc = validation["location"]
            chain = validation["version_chain"]
            stale = validation["stale_check"]
            lines.append(
                f"| {result['place']['name']} | {fmt(osm.get('seed_to_osm_m'), 1)} | {dossier['run_manifest']['backend']} | {fmt(loc.get('candidate_to_osm_m'), 1)} | "
                f"{loc.get('within_tolerance', '—')} | {chain.get('claimed_versions', '—')} / {chain.get('actual_versions', '—')} / {chain.get('confirmed', '—')} / {chain.get('contradicted', '—')} | "
                f"{stale.get('osm_current_tags_say_place_of_worship', '—')} |"
            )
    lines.append("")
    lines.append("## Disagreements and leads")
    lines.append("")
    for result in results:
        agreement = result["validation"]["agreement"]
        rows = [r for r in agreement.get("rows", []) if r["outcome"] == "disagree"]
        if not rows:
            continue
        lines.append(f"### {result['place']['name']}")
        lines.append("")
        for row in rows:
            values = "; ".join(f"{v['reader']}: {str(v['value'])[:160]}" for v in row["values"])
            lines.append(f"- {row['claim_type']}: {values} ({row['detail'][:200]})")
        lines.append("")
    lines.append("## Failures and notes")
    lines.append("")
    any_failure = False
    for result in results:
        for dossier, validation in zip(result["dossiers"], result["validation"]["dossiers"]):
            manifest = dossier["run_manifest"]
            if manifest["exit_status"] != "completed":
                any_failure = True
                lines.append(f"- {result['place']['name']} / {manifest['backend']}: {manifest['exit_status']}: {manifest.get('notes', '')[:600]}")
            for note in validation.get("internal_contradictions", []):
                any_failure = True
                lines.append(f"- {result['place']['name']} / {manifest['backend']}: internal contradiction {note}")
            dead = [r for r in validation["claims"] if r["fetch"] in ("dead", "http_error", "unreachable", "robots_disallowed")]
            for row in dead:
                any_failure = True
                lines.append(f"- {result['place']['name']} / {manifest['backend']}: {row['fetch']} {row.get('status') or ''} {row['locator']}")
            not_found = [r for r in validation["claims"] if r.get("support") == "not_found"]
            for row in not_found:
                any_failure = True
                lines.append(f"- {result['place']['name']} / {manifest['backend']}: quote not found on page for {row['claim_id']} ({row['locator']})")
    if not any_failure:
        lines.append("None.")
    lines.append("")
    lines.append("## Files")
    lines.append("")
    lines.append(f"Redacted dossiers and validation reports: `scripts/agent_research/reports/{run_id}/`. Unredacted dossiers stay in `scripts/agent_research/runs/{run_id}/` (git-ignored).")
    report_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--pilot-set", type=Path, default=PILOT_SET)
    parser.add_argument("--backends", default="claude,codex")
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--places", default=None, help="comma-separated place refs to run; default all")
    parser.add_argument("--timeout", type=int, default=1200)
    parser.add_argument("--effort", default="medium")
    parser.add_argument("--force", action="store_true", help="re-run readers even when a dossier exists")
    parser.add_argument("--no-fetch", action="store_true", help="skip validator fetches (report from existing dossiers only)")
    parser.add_argument("--parallel", type=int, default=4, help="reader processes to run at once")
    args = parser.parse_args(argv)

    backends = [b.strip() for b in args.backends.split(",") if b.strip()]
    pilot = lib.read_json(args.pilot_set)
    places = pilot["places"]
    if args.places:
        wanted = {p.strip() for p in args.places.split(",")}
        places = [p for p in places if p["place_ref"] in wanted]
    run_dir = HERE / "runs" / args.run_id
    report_dir = HERE / "reports" / args.run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    report_dir.mkdir(parents=True, exist_ok=True)
    started_at = lib.utc_now()
    # readers run concurrently (each is its own cli process with its own
    # rate limits); validation runs afterwards, one request per second
    jobs = [(place, backend) for place in places for backend in backends]
    paths_by_job: dict[tuple[str, str], Path] = {}
    with ThreadPoolExecutor(max_workers=max(1, args.parallel)) as pool:
        futures = {
            pool.submit(run_reader, place, backend, run_dir, report_dir, args.run_id, args.timeout, args.force, args.effort): (place["place_ref"], backend)
            for place, backend in jobs
        }
        for future in as_completed(futures):
            paths_by_job[futures[future]] = future.result()
    results = []
    for place in places:
        print(f"{place['name']} ({place['place_ref']})")
        paths = [paths_by_job[(place["place_ref"], backend)] for backend in backends]
        dossiers = [lib.read_json(p) for p in paths]
        fixture = COLLABORATOR_FIXTURES.get(place["place_ref"])
        if fixture and fixture.exists():
            dossiers.append(lib.read_json(fixture))
        validation = validator.validate_place(dossiers, fetch=not args.no_fetch, check_osm=not args.no_fetch)
        lib.write_json(report_dir / f"{slug(place['place_ref'])}.validation.json", validation)
        for row in validation["dossiers"]:
            s = row["summary"]
            print(f"  validated {row['reader']}: locators {s['distinct_locators']} validity {s['locator_validity_rate']} quote support {s['quote_support_rate']}")
        if "agreement_rate" in validation["agreement"]:
            print(f"  agreement {validation['agreement']['agreement_rate']} escalate {validation['agreement']['escalate_to_human']}")
        results.append({"place": place, "dossiers": dossiers, "validation": validation})
    ended_at = lib.utc_now()
    report_path = HERE / "reports" / f"{args.run_id}.md"
    write_report(args.run_id, backends, results, report_path, started_at, ended_at)
    print(f"report: {report_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
