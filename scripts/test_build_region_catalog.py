#!/usr/bin/env python3
"""Tests for the columnar summary record in build_region_catalog.py:

    python3 -m unittest scripts/test_build_region_catalog.py
"""

import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_region_catalog as brc  # noqa: E402

GOVERNED = {"rows": [{"year": 2018}, {"year": 2013}, {"year": 2018}]}
COLUMNS = b'{"columns":["a","b"]}'


def page_html(columns_sha=None, with_columns=True):
    extra = ""
    if with_columns:
        extra = (
            'summaryColumns: "data/summary.columns.json",\n'
            f'summaryColumnsSha256: "{columns_sha}",\n'
        )
    return f"""<script>
window.REGION_CONFIG = {{
  defaultLevel: "area",
  censusLevels: {{
    area: {{
      boundaries: "data/boundary.geojson",
      summary: "data/summary.json",
      {extra}
    }}
  }}
}};
</script>"""


class CatalogueSummaryTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.dir = Path(self._tmp.name) / "xx"
        (self.dir / "data").mkdir(parents=True)
        (self.dir / "data" / "boundary.geojson").write_bytes(b'{"type":"FeatureCollection"}')
        (self.dir / "data" / "summary.json").write_text(json.dumps(GOVERNED), encoding="utf-8")
        (self.dir / "data" / "summary.columns.json").write_bytes(COLUMNS)
        self.sha = hashlib.sha256(COLUMNS).hexdigest()

    def entry(self, html):
        page = self.dir / "index.html"
        page.write_text(html, encoding="utf-8")
        return brc.region_entry("xx", "Xland", page, {"xx": [[0, 0, 1, 1]]})

    def test_columns_with_matching_sha_become_the_summary_record(self):
        entry = self.entry(page_html(self.sha))
        self.assertEqual(entry["summary"][0], "data/summary.columns.json")
        self.assertEqual(entry["summary"][1], len(COLUMNS))
        self.assertEqual(entry["summary"][2], self.sha)
        self.assertEqual(entry["boundary"][0], "data/boundary.geojson")

    def test_columns_with_mismatching_sha_fail_loudly(self):
        with self.assertRaisesRegex(ValueError, "differs from the page's declared"):
            self.entry(page_html("0" * 64))

    def test_columns_without_declared_sha_fail(self):
        html = page_html(self.sha).replace(f'summaryColumnsSha256: "{self.sha}",', "")
        with self.assertRaisesRegex(ValueError, "without summaryColumnsSha256"):
            self.entry(html)

    def test_page_without_columns_records_the_governed_summary(self):
        entry = self.entry(page_html(with_columns=False))
        governed = (self.dir / "data" / "summary.json").read_bytes()
        self.assertEqual(entry["summary"][0], "data/summary.json")
        self.assertEqual(entry["summary"][2], hashlib.sha256(governed).hexdigest())

    def test_waves_come_from_the_governed_summary_either_way(self):
        self.assertEqual(self.entry(page_html(self.sha))["waves"], [2013, 2018])
        self.assertEqual(self.entry(page_html(with_columns=False))["waves"], [2013, 2018])


if __name__ == "__main__":
    unittest.main()
