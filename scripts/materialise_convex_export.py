#!/usr/bin/env python3
"""Materialise a Convex export bundle into pow-ready files."""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT_ROOT = REPO_ROOT / "exports" / "convex-roundtrip"
FILE_KEYS = {
    "tasks_jsonl": "tasks.jsonl",
    "task_events_jsonl": "task_events.jsonl",
    "evidence_drafts_jsonl": "evidence_drafts.jsonl",
    "historical_claims_jsonl": "historical_claims.jsonl",
    "review_decisions_jsonl": "review_decisions.jsonl",
    "site_evidence_wide_csv": "site_evidence_wide.csv",
}


# Return a stable hash for bytes written into the export directory.
def sha256_bytes(data: bytes) -> str:
    digest = hashlib.sha256()
    digest.update(data)
    return digest.hexdigest()


# Load the JSON bundle copied from `exports:getExportBundle`.
def load_bundle(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, dict):
        raise ValueError("Convex export bundle must be a JSON object.")
    return data


# Choose the output directory from the bundle id unless the caller supplied one.
def output_directory(bundle: dict[str, Any], explicit: Path | None) -> Path:
    if explicit is not None:
        return explicit
    manifest = bundle.get("export_manifest")
    export_batch_id = "convex-export"
    if isinstance(manifest, dict) and manifest.get("export_batch_id"):
        export_batch_id = str(manifest["export_batch_id"])
    return DEFAULT_OUTPUT_ROOT / export_batch_id


# Extract file contents from the Convex bundle's file block.
def bundle_files(bundle: dict[str, Any]) -> dict[str, str]:
    files = bundle.get("files")
    if not isinstance(files, dict):
        raise ValueError("Convex export bundle does not contain a files object.")

    selected: dict[str, str] = {}
    for key, filename in FILE_KEYS.items():
        value = files.get(key)
        if not isinstance(value, str):
            raise ValueError(f"Convex export bundle is missing files.{key}.")
        selected[filename] = value
    return selected


# Build a manifest with local hashes for every materialised file.
def local_manifest(bundle: dict[str, Any], file_entries: list[dict[str, Any]]) -> dict[str, Any]:
    manifest = bundle.get("export_manifest")
    if not isinstance(manifest, dict):
        manifest = {}
    return {
        **manifest,
        "materialised_at": datetime.now(UTC).isoformat(),
        "materialised_by": "scripts/materialise_convex_export.py",
        "output_files": file_entries,
    }


# Write export files, then add an audited manifest and SHA256SUMS file.
def materialise(bundle: dict[str, Any], destination: Path) -> dict[str, Any]:
    destination.mkdir(parents=True, exist_ok=True)
    contents = bundle_files(bundle)
    file_entries: list[dict[str, Any]] = []

    for filename, text in contents.items():
        payload = text.encode("utf-8")
        path = destination / filename
        path.write_bytes(payload)
        file_entries.append(
            {
                "filename": filename,
                "bytes": len(payload),
                "sha256": sha256_bytes(payload),
            },
        )

    manifest = local_manifest(bundle, file_entries)
    manifest_payload = (json.dumps(manifest, indent=2, sort_keys=True) + "\n").encode("utf-8")
    manifest_path = destination / "export_manifest.json"
    manifest_path.write_bytes(manifest_payload)
    file_entries.append(
        {
            "filename": "export_manifest.json",
            "bytes": len(manifest_payload),
            "sha256": sha256_bytes(manifest_payload),
        },
    )

    sums = "".join(f"{entry['sha256']}  {entry['filename']}\n" for entry in file_entries)
    (destination / "SHA256SUMS").write_text(sums, encoding="utf-8")
    return {
        "output_dir": str(destination),
        "files": file_entries,
    }


# Parse command-line arguments for curator export materialisation.
def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bundle", type=Path, help="JSON output from exports:getExportBundle")
    parser.add_argument(
        "--output-dir",
        type=Path,
        help="Directory for materialised files. Defaults to exports/convex-roundtrip/<export_batch_id>.",
    )
    return parser.parse_args()


# Run the materialiser and print a compact JSON summary for logs.
def main() -> None:
    args = parse_args()
    bundle = load_bundle(args.bundle)
    destination = output_directory(bundle, args.output_dir)
    summary = materialise(bundle, destination)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
