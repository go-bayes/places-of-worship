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

Runtime pins. A page that opts a level in also pins, in its REGION_CONFIG, the
SHA-256 of the columnar file (``summaryColumnsSha256``) and of the governed
product it was derived from (``summarySha256``). The loader verifies the fetched
bytes against the first and the file's recorded source against the second, and
falls back to the governed product on any mismatch. Regenerating writes the
pins into the pages; ``--check`` requires them to be current.

Manifest. ``pipeline.git_commit`` is the last commit that touched this script
(the build refuses to write while the script has uncommitted changes), and
``manifest_sha256`` is the SHA-256 of the manifest serialised with sorted keys,
compact separators and ``manifest_sha256`` set to null. A regeneration that
leaves the outputs unchanged keeps ``created_at``. One that changes them gets a
new ``created_at``, links ``supersedes_manifest_id`` to the previous manifest,
and archives that manifest, marked superseded, under docs/manifests/superseded/.

The stdlib is enough; no packages are needed.
"""
from __future__ import annotations

import argparse
import datetime as dt
import gzip
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SCHEMA_VERSION = "area-summary-columns.v1"
MANIFEST_PATH = REPO / "docs" / "manifests" / "area-summary-columns.manifest.json"
MANIFEST_ID = "area-summary-columns"
SUPERSEDED_DIR = REPO / "docs" / "manifests" / "superseded"
SCRIPT_REL = "scripts/build_area_summary_columns.py"
COMMIT_RE = re.compile(r"^[0-9a-f]{40}$")

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


def manifest_hash(manifest: dict) -> str:
    """SHA-256 of the canonical manifest with its own hash field set to null."""
    body = {**manifest, "manifest_sha256": None}
    text = json.dumps(body, sort_keys=True, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    return sha256_bytes(text.encode("utf-8"))


def script_commit() -> tuple[str | None, bool]:
    """The last commit that touched this script, and whether it has uncommitted changes."""
    def run(*args: str) -> str:
        done = subprocess.run(["git", *args], cwd=REPO, capture_output=True, text=True)
        return done.stdout.strip() if done.returncode == 0 else ""
    commit = run("log", "-1", "--format=%H", "--", SCRIPT_REL)
    dirty = bool(run("status", "--porcelain", "--", SCRIPT_REL))
    return (commit if COMMIT_RE.match(commit) else None), dirty


def build_manifest(entries: list[dict], created_at: str, git_commit: str | None) -> dict:
    digest = sha256_bytes("".join(e["columns_sha256"] + e["source_sha256"] for e in entries).encode())
    return {
        "$schema": "../../schemas/data-manifest.schema.json",
        "schema_version": "data-manifest.v2",
        "manifest_id": f"manifest:{MANIFEST_ID}-{digest[:12]}",
        "manifest_sha256": None,
        "supersedes_manifest_id": None,
        "superseded_by_manifest_id": None,
        "dataset_id": MANIFEST_ID,
        "dataset_version_id": f"{MANIFEST_ID}:{digest[:16]}",
        "dataset_family": "area-summary-columns",
        "dataset_role": "public_product",
        "scope": {"level": "area", "pipeline_stage": "public"},
        "created_at": created_at,
        "created_by": "claude-sonnet-5-5 (workflow agent)",
        "pipeline": {
            "script": "scripts/build_area_summary_columns.py",
            "git_commit": git_commit,
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


def plan_manifest(entries: list[dict], existing: dict | None, git_commit: str | None, now: str) -> tuple[dict, dict | None]:
    """The manifest to write, and the previous manifest to archive (or None).

    Unchanged outputs (the same dataset_version_id) keep their creation time.
    Changed outputs get a new one and a supersession link to the previous
    manifest, which is returned marked superseded.
    """
    manifest = build_manifest(entries, now, git_commit)
    archived = None
    if existing and existing.get("dataset_version_id") == manifest["dataset_version_id"]:
        manifest["created_at"] = existing["created_at"]
        manifest["supersedes_manifest_id"] = existing.get("supersedes_manifest_id")
    elif existing:
        manifest["supersedes_manifest_id"] = existing["manifest_id"]
        archived = {**existing, "downstream_status": "superseded", "superseded_by_manifest_id": manifest["manifest_id"]}
        archived["manifest_sha256"] = manifest_hash(archived)
    manifest["manifest_sha256"] = manifest_hash(manifest)
    return manifest, archived


def stable_part(manifest: dict) -> dict:
    # pipeline.git_commit moves whenever the script is touched and a shallow CI
    # clone cannot recompute it, and manifest_sha256 follows it, so the
    # comparison leaves both out; --check verifies each on its own
    out = {k: v for k, v in manifest.items() if k != "manifest_sha256"}
    out["pipeline"] = {k: v for k, v in manifest["pipeline"].items() if k != "git_commit"}
    return out


# a level's opt-in in a page's REGION_CONFIG, with or without its two pins
PIN_RE = re.compile(
    r'(?P<head>(?P<indent>[ \t]*)summary: "data/(?P<name>[^"/]+)\.json",)\n'
    r'(?P=indent)summaryColumns: "data/(?P=name)\.columns\.json",'
    r'(?:\n(?P=indent)summaryColumnsSha256: "[^"]*",)?'
    r'(?:\n(?P=indent)summarySha256: "[^"]*",)?'
)


def page_pins(entries: list[dict]) -> dict[Path, str]:
    """Each page's expected text, with the two pins written under every opted-in level."""
    pages: dict[Path, str] = {}
    for e in entries:
        country = e["source"].split("/")[2]
        page = REPO / "apps" / "regions" / country / "index.html"
        text = pages.get(page)
        if text is None:
            text = page.read_text(encoding="utf-8")
        name = Path(e["source"]).stem
        if not any(m.group("name") == name for m in PIN_RE.finditer(text)):
            raise ValueError(f"{page.relative_to(REPO)} does not opt {name} in with summaryColumns")

        def pin(m: re.Match, e=e, name=name) -> str:
            if m.group("name") != name:
                return m.group(0)
            ind = m.group("indent")
            return (f'{m.group("head")}\n{ind}summaryColumns: "data/{name}.columns.json",'
                    f'\n{ind}summaryColumnsSha256: "{e["columns_sha256"]}",'
                    f'\n{ind}summarySha256: "{e["source_sha256"]}",')

        pages[page] = PIN_RE.sub(pin, text)
    return pages


def check_manifest(existing: dict | None, entries: list[dict]) -> list[str]:
    rel = MANIFEST_PATH.relative_to(REPO)
    if existing is None:
        return [f"missing {rel}"]
    bad = []
    planned, _ = plan_manifest(entries, existing, None, "")
    if stable_part(existing) != stable_part(planned):
        bad.append(f"stale {rel}")
    recorded = existing["pipeline"].get("git_commit")
    if not (isinstance(recorded, str) and COMMIT_RE.match(recorded)):
        bad.append(f"{rel}: pipeline.git_commit is not a full commit hash")
    if existing.get("manifest_sha256") != manifest_hash(existing):
        bad.append(f"{rel}: manifest_sha256 does not match the manifest")
    prior = existing.get("supersedes_manifest_id")
    if prior:
        old = SUPERSEDED_DIR / (prior.removeprefix("manifest:") + ".manifest.json")
        if not old.exists():
            bad.append(f"{rel}: superseded manifest {old.relative_to(REPO)} is missing")
        else:
            record = json.loads(old.read_text())
            if (record.get("superseded_by_manifest_id") != existing["manifest_id"]
                    or record.get("downstream_status") != "superseded"
                    or record.get("manifest_sha256") != manifest_hash(record)):
                bad.append(f"{old.relative_to(REPO)}: supersession link or manifest_sha256 is wrong")
    return bad


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
    pages = page_pins(entries)

    if args.check:
        bad = []
        for path, body in bodies.items():
            f = REPO / path
            if not f.exists():
                bad.append(f"missing {path}")
            elif f.read_bytes() != body:
                bad.append(f"stale {path} (regenerate with scripts/build_area_summary_columns.py)")
        for page, text in pages.items():
            if page.read_text(encoding="utf-8") != text:
                bad.append(f"stale pins in {page.relative_to(REPO)} (regenerate with scripts/build_area_summary_columns.py)")
        bad += check_manifest(existing, entries)
        for path in bad:
            print("FAIL", path)
        for e in entries:
            print(f"ok   {e['columns']}  {e['rows']} rows, {e['columns_gzip_bytes']:,} B gz (source {e['source_gzip_bytes']:,} B gz)")
        print(f"{len(bodies)} columnar files round-trip to their governed products")
        return 1 if bad else 0

    commit, dirty = script_commit()
    if commit is None or dirty:
        print(f"refusing to write: commit {SCRIPT_REL} first, so the manifest can name the commit that generated it", file=sys.stderr)
        return 2
    now = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    manifest, archived = plan_manifest(entries, existing, commit, now)
    for path, body in bodies.items():
        (REPO / path).write_bytes(body)
    for page, text in pages.items():
        page.write_text(text, encoding="utf-8")
    if archived:
        SUPERSEDED_DIR.mkdir(parents=True, exist_ok=True)
        target = SUPERSEDED_DIR / (archived["manifest_id"].removeprefix("manifest:") + ".manifest.json")
        target.write_text(json.dumps(archived, indent=2, ensure_ascii=False) + "\n")
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    for e in entries:
        print(f"{e['columns']}: {e['rows']} rows, {e['source_bytes']:,} -> {e['columns_bytes']:,} B raw, "
              f"{e['source_gzip_bytes']:,} -> {e['columns_gzip_bytes']:,} B gz")
    return 0


if __name__ == "__main__":
    sys.exit(main())
