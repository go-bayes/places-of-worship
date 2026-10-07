"""Tests for the pure helpers of build_places_v2.py (standard library only).

Run from the repository root:

    python3 -m unittest discover -s tools/tiles-r2 -p "test_*.py"
"""

from __future__ import annotations

import importlib.util
import json
import unittest
from pathlib import Path

_here = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location("build_places_v2", _here / "build_places_v2.py")
b = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(b)


class Percentile(unittest.TestCase):
    def test_p95_of_twenty_is_the_nineteenth(self):
        self.assertEqual(b._p95(list(range(1, 21))), 19)

    def test_p95_of_one_and_empty(self):
        self.assertEqual(b._p95([7]), 7)
        self.assertIsNone(b._p95([]))

    def test_size_table_skips_empty_zooms(self):
        t = b.size_table({6: [10, 20, 30], 7: []})
        self.assertEqual(list(t), ["6"])
        self.assertEqual((t["6"]["tiles"], t["6"]["max_bytes"], t["6"]["total_bytes"]), (3, 30, 60))


class TileCover(unittest.TestCase):
    def test_covers_the_centre_tile(self):
        # Greenwich, equator, zoom 6.0: the centre is the corner of four tiles at z6 (32, 32)
        cover = b._tile_cover(0.0, 0.0, 6.0, 6, 100, 100)
        self.assertEqual(sorted(cover), [(31, 31), (31, 32), (32, 31), (32, 32)])

    def test_fractional_zoom_uses_larger_tiles_on_screen(self):
        # at zoom 6.9 a z6 tile is about 957 px wide, so a 1440 x 900 viewport needs at most three columns
        cover = b._tile_cover(10.0, 51.0, 6.9, 6, 1440, 900)
        xs = {x for x, _ in cover}
        self.assertLessEqual(len(xs), 3)
        self.assertTrue(all(0 <= x < 64 for x, _ in cover))

    def test_longitude_wraps(self):
        cover = b._tile_cover(179.9, 0.0, 6.0, 6, 1440, 900)
        self.assertTrue(all(0 <= x < 64 for x, _ in cover))


class Sampling(unittest.TestCase):
    def _write(self, tmp, rows):
        src = Path(tmp) / "in.ndjson"
        with src.open("w") as fh:
            for lon, lat, religion in rows:
                fh.write(json.dumps({"type": "Feature", "properties": {"religion": religion},
                                     "geometry": {"type": "Point", "coordinates": [lon, lat]}}) + "\n")
        return src

    def test_tile_of_known_points(self):
        self.assertEqual(b._tile_of(0.0, 0.0, 1), (1, 1))
        self.assertEqual(b._tile_of(-179.9, 84.0, 3), (0, 0))
        self.assertEqual(b._tile_of(179.9, -84.0, 3), (7, 7))

    def test_sample_keeps_religion_fractions_and_tile_coverage(self):
        import tempfile

        rows = [(10.0 + i * 0.001, 50.0, "christian") for i in range(100)] + \
               [(10.0 + i * 0.001, 50.0, "muslim") for i in range(50)] + \
               [(100.0, -30.0, "hindu"), (-60.0, 10.0, "buddhist")]
        with tempfile.TemporaryDirectory() as tmp:
            src = self._write(tmp, rows)
            dst = Path(tmp) / "out.ndjson"
            n, added = b.sample_with_coverage(src, dst, 0.2, 1, 7)
            kept = [json.loads(line)["properties"]["religion"] for line in dst.read_text().splitlines()]
        self.assertEqual(kept.count("christian"), 20)
        self.assertEqual(kept.count("muslim"), 10)
        # the two lone points would be dropped at 20% (round(0.2) = 0), so each gets its tile's one dot
        self.assertEqual(kept.count("hindu"), 1)
        self.assertEqual(kept.count("buddhist"), 1)
        self.assertEqual((n, added), (32, 2))

    def test_sample_is_deterministic(self):
        import tempfile

        rows = [(float(i % 50), float(i % 30), "christian") for i in range(500)]
        with tempfile.TemporaryDirectory() as tmp:
            src = self._write(tmp, rows)
            b.sample_with_coverage(src, Path(tmp) / "a", 0.3, 5, 7)
            b.sample_with_coverage(src, Path(tmp) / "b", 0.3, 5, 7)
            self.assertEqual((Path(tmp) / "a").read_text(), (Path(tmp) / "b").read_text())


class Constants(unittest.TestCase):
    def test_flags_match_the_brief(self):
        self.assertEqual(b.TIPPECANOE_FLAGS, ["-Z6", "-z7", "--drop-fraction-as-needed", "-M", "500000", "-r1", "-l", "places"])
        self.assertEqual((b.MIN_ZOOM, b.MAX_ZOOM, b.COPY_FROM_ZOOM), (6, 18, 8))

    def test_six_attributes(self):
        self.assertEqual(set(b.ATTRS), {"religion", "denomination", "name", "osm_id", "osm_type", "country_code"})

    def test_landing_pages_file(self):
        pages = json.loads((_here / "manifests" / "landing-pages-z6-7.json").read_text())
        self.assertEqual(len(pages), 42)
        self.assertTrue(all(6 <= p["initial_zoom"] < 8 for p in pages))


if __name__ == "__main__":
    unittest.main()
