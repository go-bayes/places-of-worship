"""Exercise the versioned uploader with local files and in-memory S3 doubles."""

import contextlib
import io
import json
import re
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

import upload_versioned_r2 as uploader


ARCHIVE = "places-v2-20260901-grid"


class VersionedUploadTest(unittest.TestCase):
    def test_matches_worker_name_pattern(self):
        worker = Path(__file__).with_name("worker") / "src/index.js"
        expression = re.search(r"^const VERSIONED = /(.*)/;$", worker.read_text(encoding="utf-8"), re.M)[1]
        self.assertEqual(uploader.VERSIONED.pattern, expression)
        for name in ("places-v2-20260901-possible", "places-overview-v2-2026-09-01", "ra-dots-nz-20260901"):
            self.assertIsNotNone(uploader.VERSIONED.fullmatch(name))
        for name in ("places", "places-v2-٢٠٢٦٠٩٠١", "ra-dots-NZ-20260901", "places-v2-20260901-a-b"):
            self.assertIsNone(uploader.VERSIONED.fullmatch(name))

    def test_refuses_unversioned_name_before_creating_client(self):
        with tempfile.TemporaryDirectory() as folder:
            (Path(folder) / "places.pmtiles").write_bytes(b"test")
            with patch("sys.argv", ["uploader", "--dir", folder]), patch.object(uploader, "client") as client:
                with self.assertRaisesRegex(SystemExit, "not versioned names, refused"):
                    uploader.main()
                client.assert_not_called()

    def test_dry_run_lists_selected_file_without_r2_or_ledger(self):
        with tempfile.TemporaryDirectory() as folder:
            (Path(folder) / f"{ARCHIVE}.pmtiles").write_bytes(b"test")
            (Path(folder) / "ra-dots-nz-20260901.pmtiles").write_bytes(b"other")
            stdout = io.StringIO()
            args = ["uploader", "--dir", folder, "--dry-run", "--only", ARCHIVE]
            with patch("sys.argv", args), contextlib.redirect_stdout(stdout), patch.object(uploader, "client") as client:
                uploader.main()
                client.assert_not_called()
            self.assertIn(f"{ARCHIVE}.pmtiles 4", stdout.getvalue())
            self.assertNotIn("ra-dots", stdout.getvalue())
            self.assertFalse((Path(folder) / "uploads.jsonl").exists())

    def test_conditional_put_streams_and_refuses_oversize(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / f"{ARCHIVE}.pmtiles"
            path.write_bytes(b"test")
            s3 = Mock()

            def check_put(**request):
                self.assertEqual(request["IfNoneMatch"], "*")
                self.assertEqual(request["ContentLength"], 4)
                self.assertEqual(request["Body"].read(), b"test")

            s3.put_object.side_effect = check_put
            uploader.upload(s3, path, path.name)
            s3.put_object.assert_called_once()
            s3.reset_mock()
            with patch.object(uploader, "SINGLE_PUT_LIMIT", 3):
                with self.assertRaisesRegex(ValueError, "conditional single PUT limit"):
                    uploader.upload(s3, path, path.name)
            s3.put_object.assert_not_called()

    def test_resume_refuses_same_size_remote_with_different_digest(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / f"{ARCHIVE}.pmtiles"
            path.write_bytes(b"test")
            ledger = Path(folder) / "uploads.jsonl"
            entry = json.dumps({"key": path.name, "bytes": 4, "sha256": uploader.sha256_file(path), "etag": "etag"})
            ledger.write_text(entry + "\n", encoding="utf-8")
            s3, body = Mock(), Mock()
            s3.get_object.return_value = {"Body": body}
            body.iter_chunks.return_value = [b"else"]
            with patch("sys.argv", ["uploader", "--dir", folder]), contextlib.redirect_stdout(io.StringIO()):
                with patch.object(uploader, "client", return_value=s3), patch.object(uploader, "head", return_value={"ContentLength": 4}):
                    with self.assertRaisesRegex(SystemExit, "differs from this run's verified upload"):
                        uploader.main()
                    s3.get_object.assert_called_once()
                    body.close.assert_called_once()
                    s3.put_object.assert_not_called()
            self.assertEqual(ledger.read_text(encoding="utf-8"), entry + "\n")
