"""Tests for the audit and validation logic of build_tiles_v2.py (standard library only).

Run from the repository root:

    python3 -m unittest discover -s tools/tiles-r2 -p "test_*.py"
"""

from __future__ import annotations

import collections
import importlib.util
import json
import unittest
from pathlib import Path

_spec = importlib.util.spec_from_file_location("build_tiles_v2", Path(__file__).with_name("build_tiles_v2.py"))
b = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(b)


def props(name, religion="christian", osm_id=None, cc="NZ"):
    p = {"name": name, "religion": religion, "country_code": cc}
    if osm_id is not None:
        p.update({"osm_id": osm_id, "osm_type": "node"})
    return p


class CoordinateAudit(unittest.TestCase):
    def test_identical_extractions_pass(self):
        kept = [(0.0, 0.0, props("a")), (50.0, 10.0, props("a")), (100.0, 20.0, props("a"))]
        res = b._coordinate_audit(kept, list(kept))
        self.assertEqual(res[2], 0)

    def test_distant_occurrence_replaced_by_copy_at_first_location_fails(self):
        # three places share every attribute; the audit zoom holds the same attribute multiset, but the
        # distant occurrence has been replaced by a second copy at the first location
        kept = [(0.0, 0.0, props("a")), (50.0, 10.0, props("a")), (100.0, 20.0, props("a"))]
        other = [(0.0, 0.0, props("a")), (0.0, 0.0, props("a")), (100.0, 20.0, props("a"))]
        self.assertEqual(collections.Counter(b._attr_key(p) for _, _, p in kept),
                         collections.Counter(b._attr_key(p) for _, _, p in other))
        groups, occ, unmatched, bad, _ex = b._coordinate_audit(kept, other)
        self.assertEqual((groups, occ), (1, 3))
        self.assertEqual(unmatched, 1)
        self.assertEqual(bad, 1)

    def test_quantisation_within_tolerance_passes(self):
        kept = [(10.0, 5.0, props("a")), (20.0, 6.0, props("a"))]
        other = [(10.0012, 5.0011, props("a")), (19.9988, 6.0013, props("a"))]
        self.assertEqual(b._coordinate_audit(kept, other)[2], 0)

    def test_displacement_beyond_tolerance_fails(self):
        kept = [(10.0, 5.0, props("a")), (20.0, 6.0, props("a"))]
        other = [(10.0, 5.0, props("a")), (20.01, 6.0, props("a"))]
        self.assertEqual(b._coordinate_audit(kept, other)[2], 1)

    def test_longitude_wrapping(self):
        kept = [(179.9995, 5.0, props("a")), (-179.9995, 5.0, props("a"))]
        other = [(-179.9995, 5.0, props("a")), (179.9995, 5.0, props("a"))]
        self.assertEqual(b._coordinate_audit(kept, other)[2], 0)
        kept1 = [(180.0, 5.0, props("a"))]
        other1 = [(-179.9990, 5.0, props("a"))]
        self.assertEqual(b._coordinate_audit(kept1, other1)[2], 0)

    def test_singleton_group_far_apart_fails(self):
        kept = [(1.0, 1.0, props("only"))]
        other = [(1.5, 1.0, props("only"))]
        self.assertEqual(b._coordinate_audit(kept, other)[2], 1)

    def test_matching_needs_augmenting_paths(self):
        # the first a point is adjacent to both b points, the second only to the first b point; a greedy
        # pairing that takes the first b point for the first a point would leave one unmatched
        a_pts = [(0.002, 0.0), (-0.0025, 0.0)]
        b_pts = [(0.0, 0.0), (0.0035, 0.0)]
        self.assertEqual(b._match_coordinates(a_pts, b_pts), 0)

    def test_large_cluster_of_identical_places(self):
        a_pts = [(0.0001 * i, 0.0) for i in range(200)]
        b_pts = [(0.0001 * i + 0.0007, 0.0) for i in range(200)]
        self.assertEqual(b._match_coordinates(a_pts, b_pts), 0)


def empty_zoom():
    return {"core": 0, "religion": collections.Counter(), "cc": collections.Counter(), "keys": set(),
            "core_keys": collections.Counter(), "occ_buf": {}, "occ_core": collections.Counter()}


def zoom_from(points, buffer_only=()):
    """A decoded zoom from (props, (gx, gy)) points held in tile propers, plus buffer points. A buffer point
    may carry a tile as a third element, (props, (gx, gy), tile); the default tile is (0, 0)."""
    e = empty_zoom()
    for p, pos in points:
        ak = b._occ_key(p)
        e["occ_core"][(ak, pos)] += 1
        e["core"] += 1
        e["religion"][p.get("religion")] += 1
        e["cc"][p.get("country_code")] += 1
        if p.get("osm_id") is not None:
            e["keys"].add((p["osm_type"], p["osm_id"]))
            e["core_keys"][(p["osm_type"], p["osm_id"])] += 1
    for item in buffer_only:
        p, pos = item[0], item[1]
        tile = item[2] if len(item) > 2 else (len(e["occ_buf"]), 0)
        ak = b._occ_key(p)
        e["occ_buf"].setdefault(tile, {}).setdefault(ak, []).append(pos)
        if p.get("osm_id") is not None:
            e["keys"].add((p["osm_type"], p["osm_id"]))
    return e


def reconcile(e, placed, z, final=7):
    """placed is a list of (props, (gx, gy)): the expected places and where the zoom's grid puts them."""
    occ = collections.Counter(b._occ_key(p) for p, _ in placed)
    grid = collections.defaultdict(list)
    for p, pos in placed:
        grid[b._occ_key(p)].append(pos)
    rel = collections.Counter(p.get("religion") for p, _ in placed)
    return b._reconcile_zoom(e, grid, b._key_multiplicities(occ), dict(rel), len(placed), "NZ", z, final)


class RaReconciliation(unittest.TestCase):
    def setUp(self):
        self.keyed = props("keyed", osm_id=1)
        self.keyless = props("keyless")
        self.keyless2 = props("keyless two")
        self.placed = [(self.keyed, (1, 1)), (self.keyless, (2, 2)), (self.keyless2, (3, 3))]

    def test_complete_zoom_has_no_problems(self):
        e = zoom_from(self.placed)
        row, problems = reconcile(e, self.placed, 7)
        self.assertEqual(problems, [])
        self.assertEqual(row["places_missing"], 0)

    def test_removed_keyless_place_fails_at_z3(self):
        e = zoom_from([self.placed[0], self.placed[2]])
        row, problems = reconcile(e, self.placed, 3)
        self.assertTrue(problems)
        self.assertEqual(row["places_missing"], 1)
        self.assertEqual(row["keyless_places_missing"], 1)

    def test_a_place_moved_onto_another_fails_even_when_the_count_matches(self):
        # a keyless place lost and a second copy of another kept: the attribute multiset differs only
        # in position, and the tile-proper count is unchanged
        twin = props("twin")
        placed = [(self.keyed, (1, 1)), (twin, (100, 100)), (twin, (900, 900))]
        e = zoom_from([(self.keyed, (1, 1)), (twin, (100, 100)), (twin, (100, 100))])
        row, problems = reconcile(e, placed, 4)
        self.assertEqual(row["points_in_tile_proper"], 3)
        self.assertTrue(problems)
        self.assertEqual(row["places_missing"], 1)
        self.assertEqual(row["tile_proper_points_without_an_expected_place"], 1)

    def test_displaced_point_fails(self):
        e = zoom_from([self.placed[0], self.placed[1], (self.keyless2, (300, 3))])
        _row, problems = reconcile(e, self.placed, 5)
        self.assertTrue(problems)

    def test_buffer_only_keyless_place_is_reported_below_the_final_zoom(self):
        e = zoom_from([self.placed[0], self.placed[2]], buffer_only=[(self.keyless, (2, 2))])
        row, problems = reconcile(e, self.placed, 5)
        self.assertEqual(problems, [])
        self.assertEqual(row["places_held_only_in_tile_buffers"], 1)
        self.assertEqual(row["keyless_places_held_only_in_tile_buffers"], 1)
        self.assertEqual(row["shortfall_in_tile_proper"], 1)

    def test_buffer_only_place_fails_at_the_final_zoom(self):
        e = zoom_from([self.placed[0], self.placed[2]], buffer_only=[(self.keyless, (2, 2))])
        _row, problems = reconcile(e, self.placed, 7)
        self.assertTrue(problems)

    def test_buffer_copy_rounded_one_unit_away_is_not_a_second_place(self):
        e = zoom_from([(self.keyed, (100, 100)), self.placed[1], self.placed[2]],
                      buffer_only=[(self.keyed, (101, 100)), (self.keyless, (2, 1))])
        placed = [(self.keyed, (100, 100)), self.placed[1], self.placed[2]]
        row, problems = reconcile(e, placed, 7)
        self.assertEqual(problems, [])
        self.assertEqual(row["places_held_only_in_tile_buffers"], 0)
        self.assertEqual(row["tile_proper_points_without_an_expected_place"], 0)

    def test_buffer_only_copies_from_neighbouring_tiles_are_one_place(self):
        placed = [self.placed[0], (self.keyless, (500, 500)), self.placed[2]]
        e = zoom_from([self.placed[0], self.placed[2]],
                      buffer_only=[(self.keyless, (500, 500)), (self.keyless, (501, 500)), (self.keyless, (500, 499))])
        row, problems = reconcile(e, placed, 5)
        self.assertEqual(problems, [])
        self.assertEqual(row["places_held_only_in_tile_buffers"], 1)

    def test_adjacent_buffer_only_places_with_copies_in_two_tiles_are_two_places(self):
        # two places of one group within the tolerance of each other, each held in the buffers of two tiles
        placed = [self.placed[0], (self.keyless, (500, 500)), (self.keyless, (500.5, 500)), self.placed[2]]
        e = zoom_from([self.placed[0], self.placed[2]],
                      buffer_only=[(self.keyless, (500, 500), (1, 1)), (self.keyless, (501, 500), (1, 1)),
                                   (self.keyless, (500, 499), (1, 2)), (self.keyless, (501, 499), (1, 2))])
        row, problems = reconcile(e, placed, 5)
        self.assertEqual(problems, [])
        self.assertEqual(row["places_held_only_in_tile_buffers"], 2)
        # with one place lost, the same buffers cannot account for both
        row1, problems1 = reconcile(zoom_from([self.placed[0], self.placed[2]],
                                              buffer_only=[(self.keyless, (500, 500), (1, 1)),
                                                           (self.keyless, (500, 499), (1, 2))]), placed, 5)
        self.assertEqual(row1["places_missing"], 1)
        self.assertTrue(problems1)

    def test_a_copy_of_another_place_cannot_stand_in_for_a_lost_one(self):
        # two places of one group far apart; the second is lost, and the first has a buffer copy elsewhere
        twin = props("twin")
        placed = [(twin, (100, 100)), (twin, (900, 900))]
        e = zoom_from([(twin, (100, 100))], buffer_only=[(twin, (101, 100))])
        row, problems = reconcile(e, placed, 5)
        self.assertEqual(row["places_missing"], 1)
        self.assertTrue(problems)

    def test_buffer_copy_across_the_antimeridian(self):
        world = (1 << 4) * 4096
        placed = [(self.keyed, (0, 10)), self.placed[1], self.placed[2]]
        e = zoom_from([(self.keyed, (0, 10)), self.placed[1], self.placed[2]],
                      buffer_only=[(self.keyed, (world - 1, 10))])
        row, problems = reconcile(e, placed, 4)
        self.assertEqual(problems, [])
        self.assertEqual(row["places_held_only_in_tile_buffers"], 0)
        # a place at the far side of the antimeridian is paired with its wrapped position
        placed2 = [(self.keyed, (world - 1, 10)), self.placed[1], self.placed[2]]
        self.assertEqual(reconcile(e, placed2, 4)[1], [])

    def test_coincident_places_are_two_places(self):
        twin = props("twin")
        placed = [(twin, (5, 5)), (twin, (5, 5))]
        e = zoom_from(placed)
        self.assertEqual(reconcile(e, placed, 7)[1], [])
        e1 = zoom_from([(twin, (5, 5))])
        self.assertTrue(reconcile(e1, placed, 7)[1])


def overview(zooms, header=(0, 5)):
    decoded, sizes = {}, {}
    for z, (kept, rel) in zooms.items():
        decoded[z] = {"core": kept, "religion": collections.Counter(rel)}
        sizes[z] = {"tiles": 1}
    return {"header_min_zoom": header[0], "header_max_zoom": header[1], "decoded": decoded, "sizes": sizes}


class OverviewChecks(unittest.TestCase):
    in_share = {"christian": 0.5, "muslim": 0.5}

    def ok_zooms(self):
        return {z: (100, {"christian": 50, "muslim": 50}) for z in range(6)}

    def test_complete_overview_passes(self):
        shares, problems, unmet = b._check_overview(overview(self.ok_zooms()), self.in_share, 1000)
        self.assertEqual((problems, unmet), ([], []))
        self.assertTrue(all(r["within_tolerance"] for r in shares.values()))

    def test_empty_zoom_fails(self):
        z = self.ok_zooms()
        del z[1]
        shares, problems, _unmet = b._check_overview(overview(z), self.in_share, 1000)
        self.assertTrue(any("z1" in p and "no tiles" in p for p in problems))
        self.assertTrue(any("z1" in p and "no features" in p for p in problems))
        self.assertFalse(shares["1"]["within_tolerance"])

    def test_zoom_with_tiles_but_no_features_fails(self):
        z = self.ok_zooms()
        z[2] = (0, {})
        shares, problems, _unmet = b._check_overview(overview(z), self.in_share, 1000)
        self.assertTrue(any("z2" in p for p in problems))
        self.assertFalse(shares["2"]["within_tolerance"])

    def test_header_zooms_must_be_0_to_5(self):
        _s, problems, _u = b._check_overview(overview(self.ok_zooms(), header=(1, 5)), self.in_share, 1000)
        self.assertTrue(any("header zooms" in p for p in problems))
        _s, problems, _u = b._check_overview(overview(self.ok_zooms(), header=(0, 4)), self.in_share, 1000)
        self.assertTrue(any("header zooms" in p for p in problems))

    def test_share_violation_is_a_criterion_not_a_problem(self):
        z = self.ok_zooms()
        z[3] = (100, {"christian": 60, "muslim": 40})
        _s, problems, unmet = b._check_overview(overview(z), self.in_share, 1000)
        self.assertEqual(problems, [])
        self.assertEqual(len(unmet), 1)


class PublicRecords(unittest.TestCase):
    def test_metadata_drops_value_samples_and_keeps_counts(self):
        tilestats = {"layerCount": 1, "layers": [{"layer": "places", "count": 3, "attributes": [
            {"attribute": "phone", "count": 3, "type": "string", "values": ["+64 1 234", "+64 5 678"]},
            {"attribute": "confidence", "count": 2, "type": "number", "min": 0.5, "max": 1}]}]}
        meta = {"name": "places.mbtiles", "json": json.dumps({"vector_layers": [{"id": "places"}],
                                                              "tilestats": tilestats})}
        out = b._public_metadata(meta)
        self.assertNotIn("+64", json.dumps(out))
        doc = json.loads(out["json"])
        attrs = doc["tilestats"]["layers"][0]["attributes"]
        self.assertEqual([a["count"] for a in attrs], [3, 2])
        self.assertEqual(attrs[1]["max"], 1)
        self.assertEqual(b._public_metadata(out), out)

    def test_extract_drops_feature_detail(self):
        ex = {"source": {"metadata": {}}, "edge_points_added_detail": [{"name": "x"}],
              "audit": {"examples_only_at_extraction_zoom": [["x"]], "examples_only_at_audit_zoom": []}}
        out = b._public_extract(ex)
        self.assertNotIn("edge_points_added_detail", out)
        self.assertEqual(out["edge_points_added_detail_omitted"], 1)
        self.assertNotIn("examples_only_at_extraction_zoom", out["audit"])


if __name__ == "__main__":
    unittest.main()
