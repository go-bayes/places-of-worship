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
            n, added, added_buffer, unreachable = b.sample_with_coverage(src, dst, 0.2, 1, 7)
            kept = [json.loads(line)["properties"]["religion"] for line in dst.read_text().splitlines()]
        self.assertEqual(kept.count("christian"), 20)
        self.assertEqual(kept.count("muslim"), 10)
        # the two lone points would be dropped at 20% (round(0.2) = 0), so each gets its tile's one dot
        self.assertEqual(kept.count("hindu"), 1)
        self.assertEqual(kept.count("buddhist"), 1)
        self.assertEqual((n, added, added_buffer, unreachable), (32, 2, 0, 0))

    def test_sample_is_deterministic(self):
        import tempfile

        rows = [(float(i % 50), float(i % 30), "christian") for i in range(500)]
        with tempfile.TemporaryDirectory() as tmp:
            src = self._write(tmp, rows)
            b.sample_with_coverage(src, Path(tmp) / "a", 0.3, 5, 7)
            b.sample_with_coverage(src, Path(tmp) / "b", 0.3, 5, 7)
            self.assertEqual((Path(tmp) / "a").read_text(), (Path(tmp) / "b").read_text())

    def test_buffer_only_source_tile_gets_a_point(self):
        import tempfile

        # a point 0.0005 of a tile inside tile (68, y), so not clear of the edge: it lies in the buffer of tile (67, y)
        lon = (68.0005 / 128) * 360 - 180
        lat = 50.0
        (px, py), clear = b._interior(lon, lat, 7)
        self.assertEqual((px, clear), (68, False))
        self.assertIn((67, py), b._buffered_tiles(lon, lat, 7))
        # a second point deep in tile (68, y) is the one the proper-area step picks
        rows = [(lon, lat, "christian"), (lon + 1.0, lat, "christian")] + [(10.0 + i * 0.001, 30.0, "christian") for i in range(50)]
        with tempfile.TemporaryDirectory() as tmp:
            src = self._write(tmp, rows)
            dst = Path(tmp) / "out.ndjson"
            # at fraction 0 nothing is sampled except what coverage adds
            n0, _, added_b0, unr0 = b.sample_with_coverage(src, dst, 0.0, 3, 7, required_tiles={(67, py)})
            self.assertEqual((added_b0, unr0), (1, 0))
            self.assertEqual(sum(1 for line in dst.read_text().splitlines() if b._buffered_tiles(*json.loads(line)["geometry"]["coordinates"], 7).count((67, py))), 1)
            # a required tile with no point in its buffer is reported, not invented
            _, _, added_b1, unr1 = b.sample_with_coverage(src, dst, 0.0, 3, 7, required_tiles={(0, 0)})
            self.assertEqual((added_b1, unr1), (0, 1))

    def test_buffered_tiles_contain_the_proper_tile_unless_on_the_edge(self):
        self.assertIn(b._tile_of(10.0, 50.0, 7), b._buffered_tiles(10.0, 50.0, 7))
        self.assertEqual(b._buffered_tiles(10.0, 50.0, 7), [b._tile_of(10.0, 50.0, 7)])


class Validation(unittest.TestCase):
    slim_counts = {"religion": 100, "country_code": 100, "name": 80, "osm_id": 60, "osm_type": 60, "denomination": 50}

    def _problems(self, zoom, carrying, core=10, seen=None):
        return b.attribute_problems(zoom, seen if seen is not None else set(carrying), carrying, core, self.slim_counts, 100)

    def test_complete_zoom_passes(self):
        self.assertEqual(self._problems(6, {"religion": 10, "country_code": 10, "name": 7, "osm_id": 5, "osm_type": 5, "denomination": 4}), [])

    def test_a_field_missing_at_one_zoom_fails_even_if_the_other_zoom_has_it(self):
        z6 = {"religion": 10, "name": 7, "osm_id": 5, "osm_type": 5, "denomination": 4}
        z7 = {**z6, "country_code": 10}
        self.assertEqual(self._problems(7, z7), [])
        found = self._problems(6, z6)
        self.assertEqual(len(found), 1)
        self.assertIn("country_code", found[0])

    def test_universal_field_on_some_points_only_fails(self):
        found = self._problems(7, {"religion": 9, "country_code": 10, "name": 7, "osm_id": 5, "osm_type": 5, "denomination": 4})
        self.assertTrue(any("religion" in f for f in found))

    def test_optional_field_on_no_point_fails_but_may_be_partial(self):
        found = self._problems(7, {"religion": 10, "country_code": 10, "name": 7, "osm_id": 5, "osm_type": 5})
        self.assertTrue(any("denomination" in f for f in found))

    def test_field_the_input_never_has_may_be_absent_and_extras_fail(self):
        counts = {"religion": 100, "country_code": 100}
        self.assertEqual(b.attribute_problems(7, {"religion", "country_code"}, {"religion": 10, "country_code": 10}, 10, counts, 100), [])
        found = b.attribute_problems(7, {"religion", "country_code", "tags_raw"}, {"religion": 10, "country_code": 10}, 10, counts, 100)
        self.assertTrue(any("tags_raw" in f for f in found))

    def test_missing_source_tile_is_an_unmet_criterion(self):
        self.assertIsNone(b.coverage_unmet(7, {(1, 1), (2, 2)}, {(1, 1), (2, 2), (3, 3)}))
        gap = b.coverage_unmet(7, {(1, 1), (2, 2)}, {(1, 1)})
        self.assertIn("1 source tiles", gap)

    def test_manifest_binding_refuses_a_changed_or_unrecorded_input(self):
        rec = {"archive_sha256": "a", "source_sha256": "s", "slim_sha256": "m"}
        self.assertEqual(b.binding_mismatches(rec, dict(rec)), [])
        self.assertEqual(b.binding_mismatches(rec, {**rec, "archive_sha256": "z"}), ["archive_sha256"])
        self.assertEqual(b.binding_mismatches(rec, {**rec, "slim_sha256": "z", "source_sha256": "y"}), ["source_sha256", "slim_sha256"])
        self.assertEqual(b.binding_mismatches(None, rec), list(b.BOUND_INPUTS))
        self.assertEqual(b.binding_mismatches({"archive_sha256": "a"}, rec), ["source_sha256", "slim_sha256"])

    def test_per_tile_religion_rows(self):
        import collections

        religions = ["christian", "muslim", "other"]
        inp = {(1, 1): collections.Counter(christian=60, muslim=30, hindu=10), (2, 2): collections.Counter(christian=5)}
        out = {(1, 1): collections.Counter(christian=30, muslim=10, hindu=10)}
        rows = b.per_tile_religion_rows(inp, out, religions)
        self.assertEqual(rows[0], [1, 1, 100, 50, [60, 30, 10], [30, 10, 10], 10.0])
        self.assertEqual(rows[1], [2, 2, 5, 0, [5, 0, 0], [0, 0, 0], None])
        s = b.per_tile_summary(rows, min_points=50)
        self.assertEqual((s["tiles"], s["tiles_without_archive_points"], s["tiles_at_or_above_min_points"]), (2, 1, 1))
        self.assertEqual(s["max_max_abs_diff_pp"], 10.0)


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
