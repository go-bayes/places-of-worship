#!/usr/bin/env python3
"""deterministic checks over one or more agent-dossier.v1 files for one place.

for every claim: fetch the locator (robots respected, 10 s timeout, one
request per second, private hosts refused), record the http status, and
test whether the quoted support appears on the page after normalisation.
for the place: read the osm object from the osm api, compare its centroid
with the seed and with each reader's candidate location, and compare each
reader's version chain with the api's history (exact timestamps replace
approximate ones in the report, never in the dossier). with two or more
dossiers, compute per-claim-type agreement between readers.

the validator is not a reader: it runs no model and follows no instruction
found on a page. fetched text is data.

usage:
  uv run python scripts/agent_research/validate_dossier.py \\
      runs/pilot/osm-way-643590665.claude.dossier.json \\
      runs/pilot/osm-way-643590665.codex.dossier.json \\
      fixtures/watts-st-martins-loburn-2026-09-09.dossier.json \\
      --out runs/pilot/osm-way-643590665.validation.json

--no-fetch skips every network call (unit tests); --no-osm skips the osm api.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import lib  # noqa: E402

USER_AGENT = "religionmap-agent-research-pilot/0.1 (+https://religionmap.org; research pilot, one request per second)"
FETCH_TIMEOUT_S = 10
MIN_INTERVAL_S = 1.0
MAX_BYTES = 2_000_000
OSM_API = "https://api.openstreetmap.org/api/0.6"
LOCATION_TOLERANCE_M = lib.LOCATION_TOLERANCE_M


def is_blocked_host(hostname: str) -> bool:
    # mirrors isBlockedHost in convex/claudeReviews.ts
    host = (hostname or "").lower().strip("[]")
    if host in ("localhost", "") or host.endswith(".local") or host.endswith(".internal"):
        return True
    if re.match(r"^(127\.|10\.|0\.|169\.254\.|192\.168\.)", host):
        return True
    if re.match(r"^172\.(1[6-9]|2\d|3[01])\.", host):
        return True
    if host == "::1" or re.match(r"^(fc|fd|fe8)", host):
        return True
    return False


class Fetcher:
    """polite http fetcher: one request per second overall, robots cached per
    host, results cached per url within a run."""

    def __init__(self, enabled: bool = True):
        self.enabled = enabled
        self.last_request = 0.0
        self.robots: dict[str, urllib.robotparser.RobotFileParser | None] = {}
        self.cache: dict[str, dict] = {}
        self.request_count = 0

    def _wait(self):
        elapsed = time.time() - self.last_request
        if elapsed < MIN_INTERVAL_S:
            time.sleep(MIN_INTERVAL_S - elapsed)
        self.last_request = time.time()

    def _raw_get(self, url: str) -> tuple[int, bytes, str]:
        self._wait()
        self.request_count += 1
        request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml,application/xml,text/plain;q=0.9,*/*;q=0.5"})
        with urllib.request.urlopen(request, timeout=FETCH_TIMEOUT_S) as response:
            body = response.read(MAX_BYTES)
            return response.status, body, response.headers.get("Content-Type", "")

    def robots_allows(self, url: str) -> bool | None:
        parsed = urllib.parse.urlsplit(url)
        host = f"{parsed.scheme}://{parsed.netloc}"
        if host not in self.robots:
            parser = urllib.robotparser.RobotFileParser()
            try:
                status, body, _ = self._raw_get(host + "/robots.txt")
                if status == 200:
                    parser.parse(body.decode("utf-8", "replace").splitlines())
                    self.robots[host] = parser
                else:
                    self.robots[host] = None
            except Exception:  # noqa: BLE001 - any failure means no rules known
                self.robots[host] = None
        parser = self.robots[host]
        if parser is None:
            return None
        return parser.can_fetch(USER_AGENT, url)

    def get(self, url: str) -> dict:
        """returns {status, outcome, text, content_type, error}"""
        if url in self.cache:
            return self.cache[url]
        result = {"url": url, "status": None, "outcome": "not_fetched", "text": "", "content_type": "", "error": None}
        if not self.enabled:
            result["outcome"] = "not_fetched"
            self.cache[url] = result
            return result
        parsed = urllib.parse.urlsplit(url)
        if parsed.scheme not in ("http", "https"):
            result["outcome"] = "not_http"
            self.cache[url] = result
            return result
        if is_blocked_host(parsed.hostname or ""):
            result["outcome"] = "blocked_host"
            self.cache[url] = result
            return result
        allowed = self.robots_allows(url)
        if allowed is False:
            result["outcome"] = "robots_disallowed"
            self.cache[url] = result
            return result
        try:
            status, body, content_type = self._raw_get(url)
            result["status"] = status
            result["content_type"] = content_type
            text = body.decode("utf-8", "replace")
            result["text"] = lib.strip_html(text) if "html" in content_type or "<html" in text[:2000].lower() else text
            result["outcome"] = "fetched"
        except urllib.error.HTTPError as exc:
            result["status"] = exc.code
            result["outcome"] = "dead" if exc.code in (404, 410) else "http_error"
            result["error"] = str(exc)
        except Exception as exc:  # noqa: BLE001 - timeouts, dns, tls all count as unreachable
            result["outcome"] = "unreachable"
            result["error"] = f"{type(exc).__name__}: {exc}"[:200]
        self.cache[url] = result
        return result


# ---------------------------------------------------------------------------
# osm


def osm_ref(place_ref: str) -> tuple[str, int] | None:
    m = re.fullmatch(r"osm:(node|way|relation)/(\d+)", place_ref)
    return (m.group(1), int(m.group(2))) if m else None


def fetch_osm_object(fetcher: Fetcher, osm_type: str, osm_id: int) -> dict:
    """centroid, current tags and version from the api; the history for the chain"""
    out = {"centroid": None, "tags": {}, "version": None, "history": [], "error": None, "deleted": False}
    suffix = "/full" if osm_type in ("way", "relation") else ""
    current = fetcher.get(f"{OSM_API}/{osm_type}/{osm_id}{suffix}")
    if current["outcome"] != "fetched":
        if current["status"] == 410:
            out["deleted"] = True
        out["error"] = f"current: {current['outcome']} {current.get('error') or current.get('status')}"
    else:
        try:
            root = ET.fromstring(current["text"])
            nodes = {n.get("id"): (float(n.get("lat")), float(n.get("lon"))) for n in root.findall("node")}
            element = root.find(osm_type)
            if element is not None:
                out["version"] = int(element.get("version"))
                out["tags"] = {t.get("k"): t.get("v") for t in element.findall("tag")}
                if osm_type == "node":
                    out["centroid"] = (float(element.get("lat")), float(element.get("lon")))
                elif osm_type == "way":
                    refs = [n.get("ref") for n in element.findall("nd")]
                    pts = [nodes[r] for r in refs if r in nodes]
                    if len(pts) > 1 and pts[0] == pts[-1]:
                        pts = pts[:-1]
                    if pts:
                        out["centroid"] = (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))
                else:
                    pts = list(nodes.values())
                    if pts:
                        out["centroid"] = (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))
        except ET.ParseError as exc:
            out["error"] = f"current: parse {exc}"
    history = fetcher.get(f"{OSM_API}/{osm_type}/{osm_id}/history")
    if history["outcome"] == "fetched":
        try:
            root = ET.fromstring(history["text"])
            for element in root.findall(osm_type):
                out["history"].append({
                    "version": int(element.get("version")),
                    "changeset": int(element.get("changeset")),
                    "timestamp": element.get("timestamp"),
                    "visible": element.get("visible", "true") == "true",
                    "tags": {t.get("k"): t.get("v") for t in element.findall("tag")},
                })
        except ET.ParseError as exc:
            out["error"] = (out["error"] or "") + f" history: parse {exc}"
    else:
        out["error"] = (out["error"] or "") + f" history: {history['outcome']}"
    return out


def check_version_chain(chain: list[dict], history: list[dict]) -> dict:
    by_version = {h["version"]: h for h in history}
    rows = []
    for entry in chain:
        actual = by_version.get(entry.get("version"))
        row = {"version": entry.get("version"), "claimed_changeset": entry.get("changeset"), "claimed_timestamp": entry.get("timestamp")}
        if actual is None:
            row["outcome"] = "no_such_version"
        else:
            row["actual_changeset"] = actual["changeset"]
            row["actual_timestamp"] = actual["timestamp"]
            changeset_ok = entry.get("changeset") in (None, actual["changeset"])
            claimed = str(entry.get("timestamp") or "")
            year_ok = claimed[:4] == actual["timestamp"][:4] if claimed[:4].isdigit() else None
            if changeset_ok and year_ok in (True, None):
                row["outcome"] = "confirmed" if entry.get("changeset") is not None else "year_only"
            else:
                row["outcome"] = "contradicted"
        rows.append(row)
    return {
        "claimed_versions": len(chain),
        "actual_versions": len(history),
        "confirmed": sum(1 for r in rows if r["outcome"] in ("confirmed", "year_only")),
        "contradicted": sum(1 for r in rows if r["outcome"] == "contradicted"),
        "rows": rows,
    }


# ---------------------------------------------------------------------------
# claims


def check_claim(claim: dict, fetcher: Fetcher) -> dict:
    locator = claim["source"]["locator"]
    row = {
        "claim_id": claim["claim_id"],
        "claim_type": claim["claim_type"],
        "locator": locator,
        "has_quote": bool((claim.get("quoted_support") or "").strip()),
    }
    if locator.startswith("archive:"):
        row.update({"fetch": "offline_source", "status": None, "support": "not_checked", "support_share": None})
        return row
    page = fetcher.get(locator)
    row["fetch"] = page["outcome"]
    row["status"] = page["status"]
    if page["error"]:
        row["error"] = page["error"]
    if page["outcome"] != "fetched":
        row["support"] = "not_checked"
        row["support_share"] = None
        return row
    outcome, share = lib.quote_support(claim.get("quoted_support") or "", page["text"])
    row["support"] = outcome
    row["support_share"] = share
    if outcome == "no_quote":
        # a claim without a quote is a lead; test whether its value at least appears
        value_outcome, value_share = lib.quote_support(claim.get("value") or "", page["text"])
        row["value_on_page"] = value_outcome
        row["value_share"] = value_share
    row["page_chars"] = len(page["text"])
    return row


def internal_contradictions(dossier: dict) -> list[str]:
    """two claims of one date type in one dossier more than a year apart"""
    notes = []
    by_type: dict[str, list[dict]] = {}
    for claim in dossier.get("claims", []):
        if claim["claim_type"] in lib.DATE_TYPES:
            by_type.setdefault(claim["claim_type"], []).append(claim)
    for ctype, claims in by_type.items():
        for i in range(len(claims)):
            for j in range(i + 1, len(claims)):
                ok, note = lib.claims_agree(claims[i], claims[j])
                if not ok and "no parseable" not in note:
                    notes.append(f"{ctype}: {claims[i]['claim_id']} vs {claims[j]['claim_id']} ({note})")
    return notes


def validate_one(dossier: dict, fetcher: Fetcher, osm: dict | None) -> dict:
    rows = [check_claim(c, fetcher) for c in dossier.get("claims", [])]
    locators = [r for r in rows if r["fetch"] != "offline_source"]
    reachable = [r for r in locators if r["fetch"] == "fetched"]
    quoted = [r for r in reachable if r["has_quote"]]
    supported = [r for r in quoted if r["support"] == "supported"]
    partial = [r for r in quoted if r["support"] == "partially_supported"]
    distinct = {r["locator"] for r in locators}
    distinct_reachable = {r["locator"] for r in reachable}
    summary = {
        "claims": len(rows),
        "locators": len(locators),
        "distinct_locators": len(distinct),
        "reachable": len(reachable),
        "distinct_reachable": len(distinct_reachable),
        "dead": sum(1 for r in locators if r["fetch"] == "dead"),
        "http_error": sum(1 for r in locators if r["fetch"] == "http_error"),
        "unreachable": sum(1 for r in locators if r["fetch"] == "unreachable"),
        "robots_disallowed": sum(1 for r in locators if r["fetch"] == "robots_disallowed"),
        "not_fetched": sum(1 for r in locators if r["fetch"] == "not_fetched"),
        "with_quote": sum(1 for r in rows if r["has_quote"]),
        "quote_supported": len(supported),
        "quote_partial": len(partial),
        "quote_not_found": sum(1 for r in quoted if r["support"] == "not_found"),
        "locator_validity_rate": round(len(distinct_reachable) / len(distinct), 3) if distinct else None,
        "quote_support_rate": round((len(supported) + len(partial)) / len(quoted), 3) if quoted else None,
        "quote_exact_rate": round(len(supported) / len(quoted), 3) if quoted else None,
    }
    location = {}
    cand = dossier.get("candidate_location", {})
    place = dossier["place"]
    if cand.get("latitude") is not None and cand.get("longitude") is not None:
        location["candidate_to_seed_m"] = round(lib.haversine_m(cand["latitude"], cand["longitude"], place["seed_latitude"], place["seed_longitude"]), 1)
        if osm and osm.get("centroid"):
            location["candidate_to_osm_m"] = round(lib.haversine_m(cand["latitude"], cand["longitude"], *osm["centroid"]), 1)
            location["within_tolerance"] = location["candidate_to_osm_m"] <= LOCATION_TOLERANCE_M
    else:
        location["note"] = "no candidate coordinate"
    chain = check_version_chain(dossier.get("osm_version_chain", []), osm["history"]) if osm else {"note": "osm not checked"}
    stale = {}
    if osm and osm.get("tags"):
        stale["osm_current_tags_say_place_of_worship"] = osm["tags"].get("amenity") == "place_of_worship"
        stale["osm_current_version"] = osm.get("version")
        stale["reader_osm_stale"] = dossier.get("status_assessment", {}).get("osm_stale")
        stale["reader_status"] = dossier.get("status_assessment", {}).get("current_status")
    return {
        "dossier_id": dossier["dossier_id"],
        "reader": dossier["run_manifest"]["backend"] + ":" + dossier["provenance"].get("produced_by", ""),
        "validated_at": lib.utc_now(),
        "validator_version": "validate_dossier.v1",
        "summary": summary,
        "location": location,
        "version_chain": chain,
        "stale_check": stale,
        "internal_contradictions": internal_contradictions(dossier),
        "claims": rows,
    }


def validate_place(dossiers: list[dict], fetch: bool = True, check_osm: bool = True, fetcher: Fetcher | None = None) -> dict:
    fetcher = fetcher or Fetcher(enabled=fetch)
    place_refs = {d["place"]["place_ref"] for d in dossiers}
    if len(place_refs) != 1:
        raise SystemExit(f"dossiers must share one place; got {sorted(place_refs)}")
    place_ref = place_refs.pop()
    osm = None
    ref = osm_ref(place_ref)
    if check_osm and fetch and ref:
        osm = fetch_osm_object(fetcher, *ref)
    per_dossier = [validate_one(d, fetcher, osm) for d in dossiers]
    report = {
        "place_ref": place_ref,
        "name": dossiers[0]["place"]["name"],
        "validated_at": lib.utc_now(),
        "osm": None if osm is None else {
            "centroid": osm["centroid"],
            "version": osm["version"],
            "amenity": osm["tags"].get("amenity"),
            "history_versions": [(h["version"], h["changeset"], h["timestamp"]) for h in osm["history"]],
            "seed_to_osm_m": round(lib.haversine_m(dossiers[0]["place"]["seed_latitude"], dossiers[0]["place"]["seed_longitude"], *osm["centroid"]), 1) if osm.get("centroid") else None,
            "error": osm["error"],
        },
        "dossiers": per_dossier,
        "agreement": lib.compute_agreement(dossiers) if len(dossiers) >= 2 else {"note": "one dossier; no agreement to compute"},
        "requests_made": fetcher.request_count,
    }
    return report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("dossiers", nargs="+", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--no-fetch", action="store_true")
    parser.add_argument("--no-osm", action="store_true")
    args = parser.parse_args(argv)
    dossiers = [lib.read_json(p) for p in args.dossiers]
    for path, dossier in zip(args.dossiers, dossiers):
        errors = lib.validate_dossier(dossier)
        if errors:
            print(f"{path}: schema errors: {errors[:5]}", file=sys.stderr)
    report = validate_place(dossiers, fetch=not args.no_fetch, check_osm=not args.no_osm)
    lib.write_json(args.out, report)
    for row in report["dossiers"]:
        s = row["summary"]
        print(f"{row['reader']}: {s['claims']} claims, {s['distinct_locators']} locators, validity {s['locator_validity_rate']}, "
              f"quote support {s['quote_support_rate']} (exact {s['quote_exact_rate']})")
    agreement = report["agreement"]
    if "agreement_rate" in agreement:
        print(f"agreement: {agreement['agreed']}/{agreement['claim_types_compared']} claim types ({agreement['agreement_rate']}); "
              f"escalate {agreement['escalate_to_human']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
