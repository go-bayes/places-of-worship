"""checks the grid thinning: cells follow the screen-pixel grid of a 512-pixel
tile, one representative survives per cell, religion and denomination with
n the places it stands for, sparse input is untouched, and the validator's
count checks hold the thin report to the archive"""
import collections
import unittest
from pathlib import Path

import build_tiles_grid as g


def row(lon, lat, religion="christian", denomination="", **props):
    p = {"religion": religion, "denomination": denomination, "name": props.get("name", "x"), "osm_id": props.get("osm_id", 1),
         "osm_type": "node", "country_code": props.get("country_code", "NZ")}
    return (lon, lat, religion, denomination, p)


class GridThinTest(unittest.TestCase):
    def test_mercator_pixels_cover_the_world(self):
        self.assertEqual(g.mercator_px(-180, 0, 0), (0.0, 256.0))
        x, y = g.mercator_px(180, 0, 1)
        self.assertEqual((round(x), round(y)), (1024, 512))
        # latitudes beyond the mercator limit clamp instead of blowing up
        _, y = g.mercator_px(0, 89.9, 0)
        self.assertAlmostEqual(y, 0.0, places=6)

    def test_cell_key_scales_with_zoom_and_cell_size(self):
        self.assertEqual(g.cell_key(0, 0, 0, 2), (128, 128))
        self.assertEqual(g.cell_key(0, 0, 0, 1), (256, 256))
        self.assertEqual(g.cell_key(0, 0, 3, 2), (1024, 1024))

    def test_thin_keeps_one_per_cell_religion_and_denomination(self):
        rows = [
            row(174.0, -41.0, "christian", "anglican", osm_id=1),
            row(174.0001, -41.0001, "christian", "anglican", osm_id=2),  # same cell at z0, same group
            row(174.0002, -41.0002, "christian", "catholic", osm_id=3),  # same cell, other denomination
            row(174.0003, -41.0003, "muslim", "", osm_id=4),            # same cell, other religion
            row(170.0, -45.0, "christian", "anglican", osm_id=5),       # another cell
        ]
        first, counts = g.thin_rows(rows, 0, 2)
        self.assertEqual(len(first), 4)
        key = g.group_key(174.0, -41.0, "christian", "anglican", 0, 2)
        self.assertEqual(first[key], 0)
        self.assertEqual(counts[key], 2)
        self.assertEqual(sum(counts.values()), len(rows))
        # at a deep zoom the near neighbours separate and nothing is grouped
        first18, counts18 = g.thin_rows(rows, 18, 1)
        self.assertEqual(len(first18), 5)
        self.assertTrue(all(v == 1 for v in counts18.values()))

    def test_thinned_properties_select_attributes_and_count(self):
        p = row(1, 2, "christian", "anglican", name="St Mary", osm_id=7, country_code="GB")[4]
        self.assertEqual(g.thinned_properties(p, "christian", "anglican", g.THIN_ATTRS, 3),
                         {"religion": "christian", "denomination": "anglican", "country_code": "GB", "n": 3})
        self.assertEqual(g.thinned_properties(p, "christian", "", g.THIN_ATTRS, 1),
                         {"religion": "christian", "country_code": "GB"})
        full = g.thinned_properties(p, "christian", "anglican", g.SLIM_ATTRS, 1)
        self.assertEqual(full["name"], "St Mary")
        self.assertEqual(full["osm_id"], 7)
        self.assertNotIn("n", full)

    def test_zoom_spec_covers_the_two_tiers(self):
        self.assertEqual(g.OVERVIEW_ZOOMS, [0, 1, 2, 3, 4, 5])
        self.assertEqual(g.PLACES_THIN_ZOOMS, [6, 7])
        self.assertEqual(g.COPY_FROM_ZOOM, 8)
        for z, spec in g.ZOOM_SPEC.items():
            self.assertIn(spec["cell_px"], (1, 2), z)
            self.assertIn("religion", spec["attrs"])
        self.assertEqual(g.overview_name(), "places-overview-v2-20260722-grid")
        self.assertEqual(g.places_name(), "places-v2-20260722-grid")

    def test_check_thin_zoom_holds_the_archive_to_the_report(self):
        exp = {"kept": 1000, "attrs": g.THIN_ATTRS}
        religion = {"christian": 1500, "muslim": 500}
        good = {"tiles": 3, "sizes": [10, 20, 30], "points": 1000, "n_sum": 2000,
                "religion": collections.Counter(religion), "attrs": collections.Counter({"religion": 1000, "n": 300}),
                "missing_religion": 0, "layers": collections.Counter({g.OVERVIEW_LAYER: 3})}
        self.assertEqual(g.check_thin_zoom(3, good, exp, g.OVERVIEW_LAYER, 100, religion, 2000), ([], []))
        # a few edge points lost to a neighbour's buffer are within the slack; a hundred are not
        slack = dict(good, points=999, n_sum=1998, religion=collections.Counter({"christian": 1498, "muslim": 500}))
        self.assertEqual(g.check_thin_zoom(3, slack, exp, g.OVERVIEW_LAYER, 100, religion, 2000), ([], []))
        bad = dict(good, points=900)
        problems, _ = g.check_thin_zoom(3, bad, exp, g.OVERVIEW_LAYER, 100, religion, 2000)
        self.assertEqual(len(problems), 1)
        # an unexpected attribute, a wrong layer and a missing religion are problems; a big tile is a criterion
        bad = dict(good, attrs=collections.Counter({"religion": 1000, "name": 5}), layers=collections.Counter({"places": 3}),
                   missing_religion=2, sizes=[10, 200])
        problems, unmet = g.check_thin_zoom(3, bad, exp, g.OVERVIEW_LAYER, 100, religion, 2000)
        self.assertEqual(len(problems), 3)
        self.assertEqual(len(unmet), 1)

    def test_religion_summary_folds_the_long_tail(self):
        totals = {"christian": 900, "muslim": 60, "odd free text": 2, "other": 1}
        self.assertEqual(g.religion_summary(totals, 963), {"christian": 900, "muslim": 60, g.TAIL_KEY: 3})
        self.assertEqual(g.religion_summary({"christian": 10}, 10), {"christian": 10, g.TAIL_KEY: 0})
        # a source religion literally named "other" above the floor keeps its own key
        self.assertEqual(g.religion_summary({"other": 990, "x": 1}, 1000), {"other": 990, g.TAIL_KEY: 1})

    def test_within_slack(self):
        self.assertTrue(g.within_slack(1000, 1000))
        self.assertTrue(g.within_slack(990, 1000))
        self.assertFalse(g.within_slack(900, 1000))
        self.assertFalse(g.within_slack(2072000, 2072349))

    def test_committed_manifests_name_the_grid_archives(self):
        here = Path(__file__).resolve().parent / "manifests"
        for name in (g.overview_name(), g.places_name()):
            path = here / f"{name}.manifest.json"
            self.assertTrue(path.is_file(), f"{path.name} is not committed")
            text = path.read_text(encoding="utf-8")
            self.assertIn('"dataset_id": "%s"' % name, text)
            self.assertIn(f'"uri": "r2://pow-tiles/{name}.pmtiles"', text, "the durable R2 object is recorded")
            self.assertNotIn('"values"', text)
            self.assertNotIn("/Users/", text, "no private absolute paths in the public record")
            self.assertTrue((here / f"validation-report-{name}.md").is_file())


if __name__ == "__main__":
    unittest.main()
