"""End-to-end check that the materialiser writes every file a frozen manifest declares.

The committed fixture (schemas/fixtures/pow-export-bundle.v1) is the byte-exact
output of the real TypeScript freeze; this test folds it back into the shape
`exports:getExportBundle` returns, materialises it, and checks the written
directory against the frozen manifest. The Rust side of the same path
(materialise, then `pow export verify`) lives in crates/pow-cli/src/export.rs.
"""

from __future__ import annotations

import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import materialise_convex_export as materialiser  # noqa: E402


REPO_ROOT = Path(__file__).resolve().parents[1]
FIXTURE_DIR = REPO_ROOT / "schemas" / "fixtures" / "pow-export-bundle.v1"


# Fold a materialised fixture directory back into the action's result shape:
# one `files.<key>` string per declared file, with the manifest verbatim.
def action_bundle_from_directory(directory: Path) -> dict[str, object]:
    manifest_text = (directory / "export_manifest.json").read_text(encoding="utf-8")
    manifest = json.loads(manifest_text)
    files: dict[str, str] = {"export_manifest_json": manifest_text}
    for entry in manifest["files"]:
        filename = entry["filename"]
        if filename == "export_manifest.json":
            continue
        files[filename.replace(".", "_")] = (directory / filename).read_text(encoding="utf-8")
    return {
        "export_manifest": manifest,
        "files": files,
        "disposition": {"status": "frozen", "stored_bytes": True, "verified": True, "processing_allowed": True},
    }


class MaterialiseFixtureTest(unittest.TestCase):
    def test_every_declared_file_is_written_byte_for_byte(self) -> None:
        bundle = action_bundle_from_directory(FIXTURE_DIR)
        manifest = bundle["export_manifest"]
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "bundle"
            summary = materialiser.materialise(bundle, out)

            # the manifest lists every file but itself
            declared = {entry["filename"] for entry in manifest["files"]}
            written = {path.name for path in out.iterdir()}
            self.assertEqual(written, declared | {"export_manifest.json", "SHA256SUMS"})

            for entry in manifest["files"]:
                payload = (out / entry["filename"]).read_bytes()
                self.assertEqual(hashlib.sha256(payload).hexdigest(), entry["sha256"], entry["filename"])
                self.assertEqual(len(payload), entry["byte_length"], entry["filename"])
            self.assertEqual(
                (out / "export_manifest.json").read_bytes(),
                (FIXTURE_DIR / "export_manifest.json").read_bytes(),
            )
            sums = (out / "SHA256SUMS").read_text(encoding="utf-8").splitlines()
            self.assertEqual(len(sums), len(declared) + 1)
            self.assertEqual({entry["filename"] for entry in summary["files"]}, declared | {"export_manifest.json"})

    def test_a_bundle_missing_a_declared_file_is_refused_before_anything_is_signed(self) -> None:
        bundle = action_bundle_from_directory(FIXTURE_DIR)
        del bundle["files"]["derived_target_year_functions_jsonl"]
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "bundle"
            with self.assertRaisesRegex(ValueError, "derived_target_year_functions.jsonl"):
                materialiser.materialise(bundle, out)
            self.assertFalse((out / "SHA256SUMS").exists())
            self.assertFalse((out / "export_manifest.json").exists())

    def test_the_materialiser_maps_every_key_the_freeze_emits(self) -> None:
        manifest = json.loads((FIXTURE_DIR / "export_manifest.json").read_text(encoding="utf-8"))
        declared = {entry["filename"] for entry in manifest["files"]} - {"export_manifest.json"}
        mapped = set(materialiser.FILE_KEYS.values()) | set(materialiser.OPTIONAL_FILE_KEYS.values())
        self.assertEqual(declared - mapped, set())


if __name__ == "__main__":
    unittest.main()
