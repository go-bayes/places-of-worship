#!/usr/bin/env python3
"""Build and check the columnar transport files for large area summaries.

A columnar file (``area_summary_<level>.columns.json``) is a derived,
download-sized copy of a governed area-summary product. It is generated here
from the committed product, never edited by hand, and never replaces it: the
governed ``area_summary_<level>.json`` stays canonical, and the map runtime
falls back to it whenever the columnar file is absent or unreadable.

Layout (schemas/area-summary-columns.v1.schema.json):

    schema_version   "area-summary-columns.v1"
    source_file      file name of the governed product
    source_sha256    SHA-256 of that product's bytes
    n                number of rows
    header           every top-level field of the product except "rows",
                     copied verbatim
    keys             the row keys, in row order
    constants        keys whose value is identical on every row (stored once)
    encoded          keys with few distinct values, as {values, index}: the
                     distinct values once, then n integer positions into them
    columns          every other key, as an array of n values

Decoding rebuilds the product exactly: ``{**header, "rows": rows}`` with each
row's keys in ``keys`` order. Every row must carry the same keys in the same
order, otherwise the product is refused rather than approximated.

Usage, from the repo root:

    python3 scripts/build_area_summary_columns.py            # write files and manifest
    python3 scripts/build_area_summary_columns.py --check    # CI: regenerate in memory,
                                                             # compare with the tracked files,
                                                             # and round-trip every file

The stdlib is enough; no packages are needed.
"""
from __future__ import annotations

import argparse
import datetime as dt
import gzip
import hashlib
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SCHEMA_VERSION = "area-summary-columns.v1"
MANIFEST_PATH = REPO / "docs" / "manifests" / "area-summary-columns.manifest.json"
MANIFEST_ID = "area-summary-columns"

# the levels of the six pages (US, BR, DK, MX, NZ, AU) whose governed summary
# is 75 KB gzip or more. smaller levels on these pages (NZ ta, BR uf, DK
# region) stay as they are. two other pages' levels are also large (RO
# lau_2021, 183 KB gz; SK municipality, 132 KB gz) and are not opted in: the
# scope was set to the six pages. a page opts a level in with `summaryColumns`
# in its REGION_CONFIG; this list says which files exist.
TARGETS = [
    "apps/regions/us/data/area_summary_county.json",
    "apps/regions/us/data/area_summary_county_1930.json",
    "apps/regions/us/data/area_summary_county_1890.json",
    "apps/regions/us/data/area_summary_county_1870.json",
    "apps/regions/us/data/area_summary_county_1860.json",
    "apps/regions/us/data/area_summary_county_1850.json",
    "apps/regions/br/data/area_summary_municipality.json",
    "apps/regions/dk/data/area_summary_kommune.json",
    "apps/regions/dk/data/area_summary_sogn.json",
    "apps/regions/mx/data/area_summary_municipality.json",
    "apps/regions/nz/data/area_summary_sa2.json",
    "apps/regions/au/data/area_summary_sa2.json",
]


def columns_path(source: str) -> str:
    assert source.endswith(".json")
    return source[: -len(".json")] + ".columns.json"


def dump(value) -> str:
    # compact, deterministic, strict (no NaN/Infinity), UTF-8 left as is
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False)


def encode(product: dict, source_name: str, source_sha256: str) -> dict:
    """Return the columnar form of an area-summary product."""
    rows = product.get("rows")
    if not isinstance(rows, list) or not rows:
        raise ValueError("product has no rows")
    keys = list(rows[0].keys())
    for i, row in enumerate(rows):
        if list(row.keys()) != keys:
            raise ValueError(f"row {i} has different keys or key order from row 0")
    header = {k: v for k, v in product.items() if k != "rows"}
    constants: dict = {}
    encoded: dict = {}
    columns: dict = {}
    for key in keys:
        values = [row[key] for row in rows]
        texts = [dump(v) for v in values]
        if len(set(texts)) == 1:
            constants[key] = values[0]
            continue
        # dictionary-encode a column when that is smaller as written
        position: dict = {}
        distinct: list = []
        index: list = []
        for value, text in zip(values, texts):
            if text not in position:
                position[text] = len(distinct)
                distinct.append(value)
            index.append(position[text])
        packed_form = {"values": distinct, "index": index}
        if len(dump(packed_form)) < len(dump(values)):
            encoded[key] = packed_form
        else:
            columns[key] = values
    return {
        "schema_version": SCHEMA_VERSION,
        "source_file": source_name,
        "source_sha256": source_sha256,
        "n": len(rows),
        "header": header,
        "keys": keys,
        "constants": constants,
        "encoded": encoded,
        "columns": columns,
    }


def decode(packed: dict) -> dict:
    """Rebuild the governed product from its columnar form (header, then rows)."""
    if packed.get("schema_version") != SCHEMA_VERSION:
        raise ValueError("unsupported columnar schema_version")
    n, keys = packed["n"], packed["keys"]
    constants, encoded, columns = packed["constants"], packed["encoded"], packed["columns"]
    groups = [set(constants), set(encoded), set(columns)]
    if set().union(*groups) != set(keys) or sum(len(g) for g in groups) != len(keys):
        raise ValueError("keys, constants, encoded and columns disagree")
    for key, col in columns.items():
        if len(col) != n:
            raise ValueError(f"column {key} has {len(col)} values, expected {n}")
    for key, enc in encoded.items():
        if len(enc["index"]) != n:
            raise ValueError(f"encoded column {key} has {len(enc['index'])} positions, expected {n}")
    # a decoded column is a plain list per key; shared dictionary values are
    # copied by the JSON round trip in the reader, so rows never alias
    lookup = {k: ([e["values"][j] for j in e["index"]]) for k, e in encoded.items()}
    rows = [
        {k: (constants[k] if k in constants else lookup[k][i] if k in lookup else columns[k][i]) for k in keys}
        for i in range(n)
    ]
    return {**packed["header"], "rows": rows}


def identical(a: dict, b: dict) -> str | None:
    """Return None when two products match in every row and field, else why.

    Strict about types (1 is not 1.0, null is not absent) and about the key
    order of rows, by comparing canonical serialisations.
    """
    if a["rows"] != b["rows"] or len(a["rows"]) != len(b["rows"]):
        return "rows differ"
    for i, (ra, rb) in enumerate(zip(a["rows"], b["rows"])):
        if dump(ra) != dump(rb):
            return f"row {i} differs in value type or key order"
    ha = {k: v for k, v in a.items() if k != "rows"}
    hb = {k: v for k, v in b.items() if k != "rows"}
    if json.dumps(ha, sort_keys=True, allow_nan=False) != json.dumps(hb, sort_keys=True, allow_nan=False):
        return "header differs"
    return None


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def build_one(source: str) -> tuple[bytes, dict]:
    raw = (REPO / source).read_bytes()
    product = json.loads(raw)
    sha = sha256_bytes(raw)
    packed = encode(product, Path(source).name, sha)
    body = (dump(packed) + "\n").encode("utf-8")
    # the round trip is part of building: a file that does not decode back to
    # the product is never written
    why = identical(product, decode(json.loads(body)))
    if why:
        raise ValueError(f"{source}: round trip failed: {why}")
    entry = {
        "source": source,
        "source_sha256": sha,
        "source_bytes": len(raw),
        "source_gzip_bytes": len(gzip.compress(raw, 6, mtime=0)),
        "columns": columns_path(source),
        "columns_sha256": sha256_bytes(body),
        "columns_bytes": len(body),
        "columns_gzip_bytes": len(gzip.compress(body, 6, mtime=0)),
        "rows": packed["n"],
        "constant_keys": len(packed["constants"]),
        "encoded_keys": len(packed["encoded"]),
        "column_keys": len(packed["columns"]),
    }
    return body, entry


def build_manifest(entries: list[dict], created_at: str) -> dict:
    digest = sha256_bytes("".join(e["columns_sha256"] + e["source_sha256"] for e in entries).encode())
    return {
        "$schema": "../../schemas/data-manifest.schema.json",
        "schema_version": "data-manifest.v2",
        "manifest_id": f"manifest:{MANIFEST_ID}-{digest[:12]}",
        "dataset_id": MANIFEST_ID,
        "dataset_version_id": f"{MANIFEST_ID}:{digest[:16]}",
        "dataset_family": "area-summary-columns",
        "dataset_role": "public_product",
        "scope": {"level": "area", "pipeline_stage": "public"},
        "created_at": created_at,
        "created_by": "claude-sonnet-5-5 (workflow agent)",
        "pipeline": {
            "script": "scripts/build_area_summary_columns.py",
            "git_commit": None,
            "command": "python3 scripts/build_area_summary_columns.py",
            "parameters": {"schema": "schemas/area-summary-columns.v1.schema.json", "targets": [e["source"] for e in entries]},
            "software_versions": {"python": "stdlib only"},
        },
        "source": {"source_dataset_ids": [], "licence": None},
        "durable_files": [
            {
                "uri": e["columns"],
                "storage_provider": "git_repository",
                "format": "json",
                "bytes": e["columns_bytes"],
                "sha256": e["columns_sha256"],
                "row_count": e["rows"],
                "content": f"derived columnar transport of {e['source']} (source sha256 {e['source_sha256']}); regenerable, decodes to the governed product exactly",
                "privacy": "public",
            }
            for e in entries
        ],
        "stats": {"files": entries},
        "validation": {
            "status": "passed",
            "commands": ["python3 scripts/build_area_summary_columns.py --check"],
            "notes": "each columnar file decodes to its governed product with every row and field equal (types and key order included)",
        },
        "privacy": "public",
        "downstream_status": "public",
        "notes": "Derived transport files for the map runtime. The governed area-summary products are unchanged and remain canonical; a page that opts a level in with summaryColumns falls back to the governed file on any error.",
    }


def stable_part(manifest: dict) -> dict:
    # created_at is the only field that changes without the content changing
    return {k: v for k, v in manifest.items() if k != "created_at"}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true", help="regenerate in memory and compare with the tracked files")
    args = ap.parse_args()

    bodies, entries = {}, []
    for source in TARGETS:
        body, entry = build_one(source)
        bodies[entry["columns"]] = body
        entries.append(entry)

    existing = json.loads(MANIFEST_PATH.read_text()) if MANIFEST_PATH.exists() else None
    created_at = existing["created_at"] if existing else dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    manifest = build_manifest(entries, created_at)

    if args.check:
        bad = []
        for path, body in bodies.items():
            f = REPO / path
            if not f.exists():
                bad.append(f"missing {path}")
            elif f.read_bytes() != body:
                bad.append(f"stale {path} (regenerate with scripts/build_area_summary_columns.py)")
        if existing is None:
            bad.append(f"missing {MANIFEST_PATH.relative_to(REPO)}")
        elif stable_part(existing) != stable_part(manifest):
            bad.append(f"stale {MANIFEST_PATH.relative_to(REPO)}")
        for path in bad:
            print("FAIL", path)
        for e in entries:
            print(f"ok   {e['columns']}  {e['rows']} rows, {e['columns_gzip_bytes']:,} B gz (source {e['source_gzip_bytes']:,} B gz)")
        print(f"{len(bodies)} columnar files round-trip to their governed products")
        return 1 if bad else 0

    for path, body in bodies.items():
        (REPO / path).write_bytes(body)
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    for e in entries:
        print(f"{e['columns']}: {e['rows']} rows, {e['source_bytes']:,} -> {e['columns_bytes']:,} B raw, "
              f"{e['source_gzip_bytes']:,} -> {e['columns_gzip_bytes']:,} B gz")
    return 0


if __name__ == "__main__":
    sys.exit(main())
