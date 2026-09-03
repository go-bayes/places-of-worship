"""Size the corpus for the annual OSM places-of-worship audit.

Inputs:
  - Natural Earth 1:110m admin-0 country polygons (downloaded, cached locally).
  - ohsome API `elements/count/groupBy/boundary` endpoint, queried per country
    batch for two anchor dates: 2025-09-01 and the latest timestamp ohsome
    holds on or before 2026-09-01 (read from /v1/metadata).

Outputs:
  - docs/development/assets/osm-pow-counts-2026-09-03.csv
    (iso_a2, name, count_2025_09_01, count_latest, latest_timestamp, delta)
  - printed summary (totals, top-15, failures) for the accompanying method note.

Usage:
  uv run --with requests python3 scripts/osm_pow_country_counts.py
"""

from __future__ import annotations

import csv
import json
import sys
import time
from pathlib import Path

import requests

NE_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson"
OHSOME_METADATA_URL = "https://api.ohsome.org/v1/metadata"
OHSOME_COUNT_URL = "https://api.ohsome.org/v1/elements/count/groupBy/boundary"
FILTER = "amenity=place_of_worship and (type:node or type:way)"
ANCHOR_EARLY = "2025-09-01"
LATEST_CEILING = "2026-09-01T00:00:00Z"  # pick the latest ohsome timestamp on or before this

SCRATCH = Path("/private/tmp/claude-503/-Users-joseph-GIT-places-of-worship/cbb02a28-d8d7-4c2f-aab3-2b2a83b155b3/scratchpad")
NE_CACHE = SCRATCH / "ne_110m_admin_0_countries.geojson"

REPO_ROOT = Path(__file__).resolve().parents[1]
OUT_CSV = REPO_ROOT / "docs/development/assets/osm-pow-counts-2026-09-03.csv"
# per-country progress so an interrupted overnight run resumes where it stopped
PROGRESS_JSONL = REPO_ROOT / "data/intermediate/osm_pow_counts_progress.jsonl"

BATCH_SIZE = 1  # one country per request: ohsome 500s on multi-country batches (2026-09-03)
REQUEST_TIMEOUT_S = 900
SLEEP_BETWEEN_BATCHES_S = 2
MAX_RETRIES = 4


def fetch_country_polygons() -> list[dict]:
    """download (or reuse cached) natural earth 110m admin-0 polygons.

    returns a list of {id, iso_a2, name, geometry} dicts, ready to slot into
    an ohsome bpolys FeatureCollection. id is ADM0_A3 (always unique, always
    populated); iso_a2 comes from ISO_A2_EH and is blank for the handful of
    unrecognised-state polygons (N. Cyprus, Somaliland) that lack one.
    """
    if NE_CACHE.exists():
        raw = json.loads(NE_CACHE.read_text())
    else:
        resp = requests.get(NE_URL, timeout=60)
        resp.raise_for_status()
        NE_CACHE.write_text(resp.text)
        raw = json.loads(resp.text)

    countries = []
    for feat in raw["features"]:
        props = feat["properties"]
        iso_a2 = props.get("ISO_A2_EH") or ""
        if iso_a2 in ("-99", None):
            iso_a2 = ""
        countries.append(
            {
                "id": props["ADM0_A3"],
                "iso_a2": iso_a2,
                "name": props["NAME"],
                "geometry": feat["geometry"],
            }
        )
    return countries


def latest_ohsome_timestamp() -> str:
    """read ohsome /v1/metadata and return its toTimestamp (the latest state it holds).

    the scoping brief asks for the latest timestamp on or before 2026-09-01;
    ohsome's temporal extent already ends before that date (checked live on
    2026-09-03: toTimestamp 2026-07-27T09:00Z), so the metadata ceiling *is*
    the answer here. if a future rerun finds ohsome's extent past the 2026-09-01
    ceiling, this function still returns the metadata ceiling, which would then
    need capping — left as a loud assertion below rather than a silent wrong answer.
    """
    resp = requests.get(OHSOME_METADATA_URL, timeout=30)
    resp.raise_for_status()
    meta = resp.json()
    to_ts = meta["extractRegion"]["temporalExtent"]["toTimestamp"]
    # normalise "...09:00Z" to "...09:00:00Z" for the time parameter
    if to_ts.count(":") == 1:
        to_ts = to_ts.replace("Z", ":00Z")
    if to_ts > LATEST_CEILING:
        raise AssertionError(
            f"ohsome extent {to_ts} now exceeds the 2026-09-01 ceiling; "
            "re-derive the anchor instead of silently using metadata ceiling"
        )
    return to_ts


def post_with_retry(payload: dict) -> dict:
    """POST to the ohsome groupBy/boundary endpoint with backoff on 429/503."""
    delay = 5
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = requests.post(OHSOME_COUNT_URL, data=payload, timeout=REQUEST_TIMEOUT_S)
        except requests.exceptions.RequestException as exc:
            if attempt == MAX_RETRIES:
                raise
            print(f"  request error ({exc}); retry {attempt}/{MAX_RETRIES} after {delay}s", file=sys.stderr)
            time.sleep(delay)
            delay *= 2
            continue

        if resp.status_code in (429, 503):
            if attempt == MAX_RETRIES:
                resp.raise_for_status()
            print(f"  status {resp.status_code}; retry {attempt}/{MAX_RETRIES} after {delay}s", file=sys.stderr)
            time.sleep(delay)
            delay *= 2
            continue

        resp.raise_for_status()
        return resp.json()

    raise RuntimeError("unreachable")


def query_batch(batch: list[dict], latest_ts: str) -> tuple[dict, list[str]]:
    """query one country batch; returns (results by country id, list of failed ids)."""
    fc = {
        "type": "FeatureCollection",
        "features": [
            {"type": "Feature", "id": c["id"], "geometry": c["geometry"], "properties": {}}
            for c in batch
        ],
    }
    payload = {
        "bpolys": json.dumps(fc),
        "filter": FILTER,
        "time": f"{ANCHOR_EARLY},{latest_ts}",
    }
    try:
        body = post_with_retry(payload)
    except Exception as exc:  # noqa: BLE001 - record and move on, don't abort the whole run
        print(f"  BATCH FAILED ({[c['id'] for c in batch]}): {exc}", file=sys.stderr)
        return {}, [c["id"] for c in batch]

    results = {}
    seen_ids = set()
    for group in body.get("groupByResult", []):
        gid = group["groupByObject"]
        seen_ids.add(gid)
        counts_by_ts = {r["timestamp"]: r["value"] for r in group["result"]}
        results[gid] = counts_by_ts

    failed = [c["id"] for c in batch if c["id"] not in seen_ids]
    return results, failed


def main() -> None:
    print("fetching country polygons ...")
    countries = fetch_country_polygons()
    print(f"  {len(countries)} countries loaded")

    print("checking ohsome metadata for the latest timestamp <= 2026-09-01 ...")
    latest_ts = latest_ohsome_timestamp()
    print(f"  latest ohsome timestamp: {latest_ts}")

    start = time.monotonic()
    all_results: dict[str, dict[str, int]] = {}
    failed_ids: list[str] = []
    PROGRESS_JSONL.parent.mkdir(parents=True, exist_ok=True)
    if PROGRESS_JSONL.exists():
        for line in PROGRESS_JSONL.read_text().splitlines():
            if line.strip():
                rec = json.loads(line)
                all_results[rec["id"]] = rec["counts"]
        print(f"  resumed {len(all_results)} countries from {PROGRESS_JSONL}")
    countries = [c for c in countries if c["id"] not in all_results]

    batches = [countries[i : i + BATCH_SIZE] for i in range(0, len(countries), BATCH_SIZE)]
    for i, batch in enumerate(batches, start=1):
        ids = [c["id"] for c in batch]
        print(f"batch {i}/{len(batches)}: {ids}")
        results, failed = query_batch(batch, latest_ts)
        all_results.update(results)
        with PROGRESS_JSONL.open("a") as pf:
            for cid, counts in results.items():
                pf.write(json.dumps({"id": cid, "counts": counts}) + "\n")
        failed_ids.extend(failed)
        if failed:
            print(f"  failed in this batch: {failed}", file=sys.stderr)
        time.sleep(SLEEP_BETWEEN_BATCHES_S)

    # retry failed countries one at a time (smaller payload, more forgiving)
    still_failed = []
    for fid in failed_ids:
        country = next(c for c in countries if c["id"] == fid)
        print(f"retrying single country: {fid}")
        results, failed = query_batch([country], latest_ts)
        all_results.update(results)
        if failed:
            still_failed.extend(failed)
        time.sleep(SLEEP_BETWEEN_BATCHES_S)

    elapsed = time.monotonic() - start

    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    rows = []
    for c in countries:
        counts = all_results.get(c["id"])
        if counts is None:
            rows.append(
                {
                    "iso_a2": c["iso_a2"],
                    "name": c["name"],
                    "count_2025_09_01": "",
                    "count_latest": "",
                    "latest_timestamp": latest_ts,
                    "delta": "",
                }
            )
            continue
        c_early = counts.get(ANCHOR_EARLY, counts.get(f"{ANCHOR_EARLY}T00:00:00Z"))
        c_late = counts.get(latest_ts)
        # ohsome may echo timestamps in a slightly different format; fall back to positional match
        if c_early is None or c_late is None:
            vals = list(counts.values())
            if len(vals) == 2:
                c_early, c_late = vals[0], vals[1]
        rows.append(
            {
                "iso_a2": c["iso_a2"],
                "name": c["name"],
                "count_2025_09_01": int(c_early) if c_early is not None else "",
                "count_latest": int(c_late) if c_late is not None else "",
                "latest_timestamp": latest_ts,
                "delta": (int(c_late) - int(c_early)) if (c_early is not None and c_late is not None) else "",
            }
        )

    with OUT_CSV.open("w", newline="") as f:
        writer = csv.DictWriter(
            f, fieldnames=["iso_a2", "name", "count_2025_09_01", "count_latest", "latest_timestamp", "delta"]
        )
        writer.writeheader()
        writer.writerows(rows)

    print(f"\nwrote {OUT_CSV} ({len(rows)} rows)")
    print(f"elapsed: {elapsed:.0f}s")
    if still_failed:
        print(f"still failed after retry: {still_failed}", file=sys.stderr)

    total_early = sum(r["count_2025_09_01"] for r in rows if r["count_2025_09_01"] != "")
    total_late = sum(r["count_latest"] for r in rows if r["count_latest"] != "")
    print(f"total count_2025_09_01: {total_early}")
    print(f"total count_latest: {total_late}")

    top15 = sorted(
        (r for r in rows if r["count_latest"] != ""), key=lambda r: r["count_latest"], reverse=True
    )[:15]
    print("\ntop 15 by count_latest:")
    for r in top15:
        print(f"  {r['iso_a2']:>2}  {r['name']:<30} {r['count_latest']:>7}")


if __name__ == "__main__":
    main()
