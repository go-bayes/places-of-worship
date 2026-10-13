"""the public tile records carry no build-machine identity or private path:
manifests, validation reports, the README, the build scripts and the
changelog name locations by placeholder (build-cache, <work>, <archive>)"""
import re
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
RECORDS = [
    REPO / "CHANGELOG.md",
    REPO / "tools/tiles-r2/README.md",
    *sorted((REPO / "tools/tiles-r2").glob("*.py")),
    *sorted((REPO / "tools/tiles-r2").glob("*.sh")),
    *sorted((REPO / "tools/tiles-r2/manifests").glob("*")),
]
# the scrub script and this test name the patterns they look for
EXEMPT = {REPO / "tools/tiles-r2/scrub_build_records.py", Path(__file__).resolve()}
PRIVATE = re.compile(r"/Users/[A-Za-z]|green:/|green:~|~/tiles-|\$\{HOME\}/tiles-|suit green|\bon green\b|\bfrom green\b")


class PublicRecordsTest(unittest.TestCase):
    def test_no_private_strings(self):
        leaks = []
        for path in RECORDS:
            if path in EXEMPT or not path.is_file():
                continue
            for i, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
                if PRIVATE.search(line):
                    leaks.append(f"{path.relative_to(REPO)}:{i}")
        self.assertEqual(leaks, [], "run tools/tiles-r2/scrub_build_records.py")

    def test_manifest_uris_are_placeholders_or_r2(self):
        import json
        for path in sorted((REPO / "tools/tiles-r2/manifests").glob("*.manifest.json")):
            doc = json.loads(path.read_text(encoding="utf-8"))
            for f in doc.get("durable_files", []):
                uri = f.get("uri", "")
                self.assertTrue(uri.startswith(("build-cache:", "r2://pow-tiles/")), f"{path.name}: {uri}")


if __name__ == "__main__":
    unittest.main()
