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
# the occupancy lane's files (PR-B′, 2026-09-02) and the content-addressed
# review lane's files (byte-level freezing, 2026-09-12); bundles frozen
# before the relevant lane existed lack them, so their absence is reported
# rather than fatal
OPTIONAL_FILE_KEYS = {
    "site_occupancies_jsonl": "site_occupancies.jsonl",
    "derived_target_year_states_jsonl": "derived_target_year_states.jsonl",
    "derived_year_locations_jsonl": "derived_year_locations.jsonl",
    "derived_target_year_functions_jsonl": "derived_target_year_functions.jsonl",
    "derived_state_events_jsonl": "derived_state_events.jsonl",
    "evidence_versions_jsonl": "evidence_versions.jsonl",
    "evidence_head_changes_jsonl": "evidence_head_changes.jsonl",
    "task_acceptances_jsonl": "task_acceptances.jsonl",
    "review_snapshots_jsonl": "review_snapshots.jsonl",
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
    for key, filename in OPTIONAL_FILE_KEYS.items():
        value = files.get(key)
        if isinstance(value, str):
            selected[filename] = value
    return selected


# Keys present in the bundle's file block (for reporting absent optional files).
def contents_keys(bundle: dict[str, Any]) -> set[str]:
    files = bundle.get("files")
    return set(files.keys()) if isinstance(files, dict) else set()


# Build a manifest with local hashes for every materialised file (pre-freeze
# bundle shape: no export_manifest_json, so there is nothing frozen to echo).
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


# Choose the export_manifest.json bytes to write: the frozen manifest's own
# bytes verbatim when the action returned them (their hash must reproduce
# the frozen manifest_hash, so they must not be re-serialised or annotated),
# otherwise the pre-frozen-bundle rebuild with local materialisation notes.
def manifest_payload(
    bundle: dict[str, Any],
    file_entries: list[dict[str, Any]],
    missing_optional: list[str],
) -> tuple[bytes, dict[str, Any]]:
    files = bundle.get("files")
    verbatim = files.get("export_manifest_json") if isinstance(files, dict) else None
    if isinstance(verbatim, str):
        manifest = json.loads(verbatim)
        if not isinstance(manifest, dict):
            raise ValueError("files.export_manifest_json is not a JSON object.")
        return verbatim.encode("utf-8"), manifest

    manifest = local_manifest(bundle, file_entries)
    if missing_optional:
        manifest["optional_files_absent"] = missing_optional
    payload = (json.dumps(manifest, indent=2, sort_keys=True) + "\n").encode("utf-8")
    return payload, manifest


# A frozen manifest's files[] entries are the authority on what a curator
# received; refuse to write SHA256SUMS over materialised bytes that drifted
# from them (naming the file that failed, so the curator knows what to redo).
def verify_against_manifest(manifest: dict[str, Any], file_entries: list[dict[str, Any]]) -> None:
    if not manifest.get("manifest_hash"):
        return
    declared = {
        entry["filename"]: entry
        for entry in manifest.get("files", [])
        if isinstance(entry, dict) and isinstance(entry.get("filename"), str)
    }
    # every file the frozen manifest declares must have been materialised;
    # a file the bundle carried under a key this script does not map (the
    # derived_target_year_functions.jsonl omission found in review, 2026-09-12)
    # must fail here, not later in `pow export verify`
    materialised = {entry["filename"] for entry in file_entries}
    missing = sorted(filename for filename in declared if filename != "export_manifest.json" and filename not in materialised)
    if missing:
        raise ValueError(
            "the frozen manifest declares files this materialisation did not write: " + ", ".join(missing),
        )
    for entry in file_entries:
        expected = declared.get(entry["filename"])
        if expected is None:
            continue
        if expected.get("sha256") != entry["sha256"]:
            raise ValueError(
                f"materialised file {entry['filename']} does not match the frozen manifest: "
                f"sha256 {entry['sha256']!r} != manifest {expected.get('sha256')!r}",
            )
        if expected.get("byte_length") != entry["bytes"]:
            raise ValueError(
                f"materialised file {entry['filename']} does not match the frozen manifest: "
                f"byte length {entry['bytes']!r} != manifest {expected.get('byte_length')!r}",
            )


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

    missing_optional = [
        filename for key, filename in OPTIONAL_FILE_KEYS.items() if key not in contents_keys(bundle)
    ]
    manifest_bytes, manifest = manifest_payload(bundle, file_entries, missing_optional)
    verify_against_manifest(manifest, file_entries)

    manifest_path = destination / "export_manifest.json"
    manifest_path.write_bytes(manifest_bytes)
    file_entries.append(
        {
            "filename": "export_manifest.json",
            "bytes": len(manifest_bytes),
            "sha256": sha256_bytes(manifest_bytes),
        },
    )

    sums = "".join(f"{entry['sha256']}  {entry['filename']}\n" for entry in file_entries)
    (destination / "SHA256SUMS").write_text(sums, encoding="utf-8")
    summary: dict[str, Any] = {
        "output_dir": str(destination),
        "files": file_entries,
    }
    disposition = bundle.get("disposition")
    if disposition is not None:
        summary["disposition"] = disposition
    return summary


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
