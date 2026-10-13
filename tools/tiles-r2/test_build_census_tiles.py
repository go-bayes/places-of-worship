"""checks the census tile builder without tippecanoe: archive names match the Worker's pattern and
change with the inputs, the metadata replacement keeps only the public set, the six validation facts
fail on synthetic scans, MapLibre's feature-state key and the vector-tile reader behave as specified.
One integration test builds a small boundary twice when tippecanoe, pmtiles and the pmtiles Python
package are installed, and is skipped otherwise"""
import copy
import gzip
import json
import os
import re
import shutil
import sqlite3
import struct
import tempfile
import unittest
from pathlib import Path

import build_census_tiles as c

WORKER_SRC = Path(__file__).resolve().parent / "worker/src/index.js"


def poly(x, y, size=1.0):
    return {"type": "Polygon", "coordinates": [[[x, y], [x + size, y], [x + size, y + size], [x, y + size], [x, y]]]}


def feat(code, name, geom):
    return {"type": "Feature", "properties": {"GEOID": code, "NAME": name}, "geometry": geom}


def fc(*features):
    return {"type": "FeatureCollection", "features": list(features)}


# a vector tile built by hand: layer "census" with the given feature property dicts
def _v(n):
    out = b""
    while True:
        b = n & 0x7F
        n >>= 7
        out += bytes([b | (0x80 if n else 0)])
        if not n:
            return out


def _ld(field, payload):
    return _v(field << 3 | 2) + _v(len(payload)) + payload


def make_tile(feature_props, layer="census", compress=True):
    keys, values, feats = [], [], b""
    for props in feature_props:
        tags = b""
        for k, v in props.items():
            if k not in keys:
                keys.append(k)
            if isinstance(v, str):
                val = _ld(1, v.encode())
            elif isinstance(v, bool):
                val = _v(7 << 3) + _v(int(v))
            elif isinstance(v, int):
                val = _v(4 << 3) + _v(v)
            else:
                val = _v(3 << 3 | 1) + struct.pack("<d", v)
            if val not in values:
                values.append(val)
            tags += _v(keys.index(k)) + _v(values.index(val))
        feats += _ld(2, _ld(2, tags) + _v(3 << 3) + _v(3))
    body = _ld(1, layer.encode()) + feats + b"".join(_ld(3, k.encode()) for k in keys) + b"".join(_ld(4, v) for v in values) + _v(5 << 3) + _v(4096)
    raw = _ld(3, body)
    return gzip.compress(raw, mtime=0) if compress else raw


SPEC = {"name": "census-us-county-2020-0123456789ab", "country": "us", "slug": "county", "vintage": "2020",
        "code_prop": "GEOID", "name_prop": "NAME", "landing": {"lon": -98.6, "lat": 39.8, "zoom": 4.0},
        "units_empty_geometry": [], "boundary_path": "/nowhere/b.geojson"}


def good_scan(codes=("01001", "01003")):
    scan = c.new_scan()
    for z in range(0, 11):
        c.add_tile(scan, (z, 0, 0, 1000 + z, [c.LAYER], sorted(codes), ["GEOID", "NAME"], 0, len(codes)), 4)
    return scan


def good_meta(name=SPEC["name"]):
    src = {"json": json.dumps({"vector_layers": [], "tilestats": {"layerCount": 1, "layers": [{
        "layer": "census", "count": 2, "geometry": "Polygon", "attributeCount": 2,
        "attributes": [{"attribute": "GEOID", "count": 2, "type": "string", "values": ["01001"]},
                       {"attribute": "NAME", "count": 2, "type": "string", "values": ["Autauga"]}]}]}}),
           "bounds": "-1,-1,2,2", "center": "0,0,4",
           "generator_options": "tippecanoe -Z0 -z10 -o /work/x.mbtiles /home/someone/in.geojson", "strategies": "[]"}
    return c.public_metadata(src, name, "GEOID", "NAME", "tippecanoe v2.79.0")


class NameTest(unittest.TestCase):
    def name(self, **kw):
        a = dict(country="us", slug="county", vintage="2020", sha="a" * 64, params=c.build_params("GEOID", "NAME"), tip="tippecanoe v2.79.0")
        a.update(kw)
        return c.archive_name(a["country"], a["slug"], a["vintage"], a["sha"], a["params"], a["tip"])

    def test_name_matches_the_worker_pattern(self):
        n = self.name()
        self.assertRegex(n, r"^census-us-county-2020-[0-9a-f]{12}$")
        self.assertTrue(c.NAME_RE.match(n))

    def test_worker_pattern_text_is_the_same(self):
        # the Worker gains this anchored alternative in the next pull request; until then the file may lack it
        if WORKER_SRC.exists() and "census-" in WORKER_SRC.read_text():
            self.assertIn(c.NAME_PATTERN, WORKER_SRC.read_text().replace("\\\\", "\\"))

    def test_near_misses_do_not_match(self):
        for bad in ["census-us-county-2020-0123456789a", "census-us-county-2020-0123456789abc", "census-usa-county-2020-0123456789ab",
                    "census-us-county-20-0123456789ab", "census-us-Cty-2020-0123456789ab", "census-us-county-2020-0123456789AB",
                    "census-us-county-2020-0123456789ab.pmtiles", "xcensus-us-county-2020-0123456789ab", "census-us--2020-0123456789ab"]:
            self.assertFalse(c.NAME_RE.match(bad), bad)

    def test_name_changes_with_boundary_params_and_tippecanoe(self):
        base = self.name()
        self.assertEqual(base, self.name())
        self.assertNotEqual(base, self.name(sha="b" * 64))
        self.assertNotEqual(base, self.name(tip="tippecanoe v2.80.0"))
        self.assertNotEqual(base, self.name(params=c.build_params("GEOID", "NAME2")))

    def test_refuses_parts_the_pattern_would_refuse(self):
        for kw in ({"country": "USA"}, {"country": "US"}, {"slug": "Sa-2"}, {"slug": ""}, {"vintage": "20"}, {"vintage": "2020a"}):
            with self.assertRaises(ValueError):
                self.name(**kw)


class BoundaryTest(unittest.TestCase):
    def test_codes_geometry_and_empty_units(self):
        doc = fc(feat("01001", "A", poly(0, 0)), feat("01003", "B", None), feat("01005", "C", {"type": "Polygon", "coordinates": []}),
                 feat("01007", "D", {"type": "MultiPolygon", "coordinates": [[[[0, 0], [1, 0], [1, 1], [0, 0]]]]}))
        info = c.read_boundary(doc, "GEOID", "NAME")
        self.assertEqual(info["with_geometry"], ["01001", "01007"])
        self.assertEqual(info["empty_geometry"], ["01003", "01005"])
        self.assertEqual(info["problems"], [])

    def test_a_code_with_one_drawn_feature_is_not_empty(self):
        info = c.read_boundary(fc(feat("x1", "A", None), feat("x1", "A", poly(0, 0))), "GEOID", "NAME")
        self.assertEqual((info["with_geometry"], info["empty_geometry"]), (["x1"], []))

    def test_non_string_or_missing_codes_stop_the_build(self):
        info = c.read_boundary(fc(feat(4023, "A", poly(0, 0)), feat("", "B", poly(1, 1)), {"type": "Feature", "properties": {}, "geometry": poly(2, 2)}), "GEOID", "NAME")
        self.assertEqual(len(info["problems"]), 3)


class FeatureStateKeyTest(unittest.TestCase):
    def test_murmur3_reference_values(self):
        self.assertEqual(c.murmur3_32(""), 0)
        self.assertEqual(c.murmur3_32("a"), 0x3C2569B2)
        self.assertEqual(c.murmur3_32("abc"), 0xB3DD93FA)
        self.assertEqual(c.murmur3_32("Hello, world!"), 0xC0363E43)

    def test_numeric_strings_key_on_their_number(self):
        self.assertEqual(c.feature_state_key("04023"), 4023)
        self.assertEqual(c.feature_state_key("0100"), c.feature_state_key("100"))
        self.assertEqual(c.feature_state_key(" 7 "), 7)
        self.assertEqual(c.feature_state_key("0x10"), 16)
        self.assertEqual(c.feature_state_key("1e3"), 1000)
        self.assertEqual(c.feature_state_key(""), 0)

    def test_other_strings_hash(self):
        self.assertEqual(c.feature_state_key("G0100010"), float(c.murmur3_32("G0100010")))
        self.assertEqual(c.feature_state_key("NaN"), float(c.murmur3_32("NaN")))
        self.assertEqual(c.feature_state_key("Infinity"), float(c.murmur3_32("Infinity")))
        self.assertEqual(c.feature_state_key("1" * 20), float(c.murmur3_32("1" * 20)))

    def test_collisions(self):
        self.assertEqual(c.state_key_collisions(["0100", "100", "G1"]), [["0100", "100"]])
        self.assertEqual(c.state_key_collisions(["01001", "01003", "G1", "G2"]), [])


class ViewTest(unittest.TestCase):
    def test_landing_tiles(self):
        t = c.view_tiles(-98.6, 39.8, 4, 1440, 900)
        self.assertTrue(all(z == 4 for z, _, _ in t))
        self.assertIn((4, 3, 6), t)
        self.assertLess(len(c.view_tiles(-98.6, 39.8, 4, 390, 844)), len(t))

    def test_fractional_zoom_loads_the_floor_zoom_and_wraps(self):
        t = c.view_tiles(179.9, 0, 3.2, 1440, 900)
        self.assertTrue(all(z == 3 for z, _, _ in t))
        self.assertTrue(all(0 <= x < 8 for _, x, _ in t))

    def test_zoom_is_capped_at_the_archive_maximum(self):
        self.assertTrue(all(z == 10 for z, _, _ in c.view_tiles(0, 0, 14, 400, 400)))


class TileReaderTest(unittest.TestCase):
    def test_decodes_properties_gzip_or_plain(self):
        props = [{"GEOID": "01001", "NAME": "Autauga"}, {"GEOID": "01003"}]
        for compress in (True, False):
            layers = c.decode_tile(make_tile(props, compress=compress))
            self.assertEqual(layers, {"census": props})

    def test_decodes_other_value_types(self):
        layers = c.decode_tile(make_tile([{"a": 7, "b": True, "c": 1.5}]))
        self.assertEqual(layers["census"][0], {"a": 7, "b": True, "c": 1.5})

    def test_scan_tile_reports_codes_keys_and_missing_codes(self):
        data = make_tile([{"GEOID": "01001", "NAME": "A"}, {"NAME": "B"}])
        z, x, y, size, layers, codes, keys, no_code, feats = c._scan_tile((3, 1, 2, data, "GEOID"))
        self.assertEqual((z, x, y, size, layers, codes, keys, no_code, feats), (3, 1, 2, len(data), ["census"], ["01001"], ["GEOID", "NAME"], 1, 2))


class MetadataTest(unittest.TestCase):
    def test_replacement_holds_only_the_public_set(self):
        m = good_meta()
        self.assertEqual(list(m), c.PUBLIC_META_KEYS)
        self.assertNotIn("generator_options", m)
        self.assertNotIn("strategies", m)
        doc = json.loads(m["json"])
        self.assertEqual(set(doc), {"vector_layers", "tilestats"})
        self.assertEqual(doc["vector_layers"][0]["fields"], {"GEOID": "String", "NAME": "String"})
        for a in doc["tilestats"]["layers"][0]["attributes"]:
            self.assertNotIn("values", a)
        self.assertEqual(c.check_metadata(m, SPEC, ["someone"]), [])
        self.assertNotIn("/home/", json.dumps(m))

    def test_replacement_is_deterministic_and_replaces_the_table(self):
        with tempfile.TemporaryDirectory() as d:
            db = Path(d) / "x.mbtiles"
            con = sqlite3.connect(db)
            con.execute("create table metadata (name text, value text)")
            con.executemany("insert into metadata values (?, ?)", [("generator_options", "tippecanoe -o /work/x"), ("name", "old")])
            con.commit()
            con.close()
            m = good_meta()
            c.replace_metadata(db, m)
            self.assertEqual(c.read_metadata(db), m)
            self.assertEqual(list(c.read_metadata(db)), c.PUBLIC_META_KEYS)

    def test_unfolded_pmtiles_metadata_is_accepted(self):
        m = good_meta()
        unfolded = {k: v for k, v in m.items() if k != "json"}
        unfolded.update(json.loads(m["json"]))
        self.assertEqual(c.check_metadata(unfolded, SPEC, []), [])

    def test_leaks_are_found(self):
        base = good_meta()
        cases = [("description", "built in /Users" + "/someone/work"), ("description", "out of C:\\build\\x"), ("generator", "tippecanoe -Z0 -z10"),
                 ("description", "see ~/work"), ("generator", "built on buildhost1"), ("description", "run pmtiles convert x y")]
        for key, value in cases:
            m = dict(base)
            m[key] = value
            self.assertTrue(c.check_metadata(m, SPEC, ["buildhost1"]), value)
        m = dict(base, generator_options="tippecanoe -Z0")
        self.assertTrue(any("outside the public set" in p for p in c.check_metadata(m, SPEC, [])))

    def test_value_samples_in_tilestats_are_refused(self):
        m = good_meta()
        doc = json.loads(m["json"])
        doc["tilestats"]["layers"][0]["attributes"][0]["values"] = ["01001"]
        m["json"] = json.dumps(doc)
        self.assertTrue(c.check_metadata(m, SPEC, []))

    def test_wrong_name_is_refused(self):
        self.assertTrue(c.check_metadata(good_meta("census-us-county-2020-ffffffffffff"), SPEC, []))


class FactsTest(unittest.TestCase):
    CODES = ["01001", "01003"]
    HEADER = {"minzoom": 0, "maxzoom": 10}

    def run_facts(self, scan=None, header=None, meta=None, all_codes=None, spec=None):
        return c.check_scan(scan or good_scan(), header or self.HEADER, meta or good_meta(), spec or SPEC,
                            self.CODES, all_codes or self.CODES, [])

    def test_a_good_archive_passes(self):
        problems, rep = self.run_facts()
        self.assertEqual(problems, [])
        self.assertEqual(rep["code_coverage"]["4"], {"present": 2, "of": 2, "missing": 0})
        self.assertEqual(rep["attributes"], ["GEOID", "NAME"])

    def test_fact_1_missing_code_from_the_landing_zoom_up(self):
        scan = good_scan()
        scan["zooms"][5]["codes"].discard("01003")
        problems, _ = self.run_facts(scan)
        self.assertTrue(any(p.startswith("fact 1: z5") for p in problems), problems)

    def test_fact_1_missing_code_below_the_landing_zoom_is_reported_not_refused(self):
        scan = good_scan()
        scan["zooms"][1]["codes"].discard("01003")
        problems, rep = self.run_facts(scan)
        self.assertEqual(problems, [])
        self.assertEqual(rep["code_coverage"]["1"]["missing"], 1)

    def test_fact_1_unknown_code_in_tiles(self):
        scan = good_scan()
        scan["zooms"][6]["codes"].add("99999")
        self.assertTrue(any("not in the boundary" in p for p in self.run_facts(scan)[0]))

    def test_fact_1_lists_empty_geometry_units(self):
        spec = dict(SPEC, units_empty_geometry=["01005"])
        problems, rep = self.run_facts(spec=spec, all_codes=self.CODES + ["01005"])
        self.assertEqual(problems, [])
        self.assertEqual(rep["empty_geometry_codes"], ["01005"])

    def test_fact_2_attribute_set(self):
        for keys in (["GEOID"], ["GEOID", "NAME", "STATE"]):
            scan = good_scan()
            scan["keys"] = set(keys)
            self.assertTrue(any(p.startswith("fact 2") for p in self.run_facts(scan)[0]), keys)
        scan = good_scan()
        scan["no_code"] = 3
        self.assertTrue(any("carry no GEOID" in p for p in self.run_facts(scan)[0]))
        scan = good_scan()
        scan["layers"] = {"census", "other"}
        self.assertTrue(any("layers" in p for p in self.run_facts(scan)[0]))

    def test_fact_3_zooms(self):
        self.assertTrue(any(p.startswith("fact 3") for p in self.run_facts(header={"minzoom": 0, "maxzoom": 9})[0]))
        m = dict(good_meta(), maxzoom="9")
        self.assertTrue(any(p.startswith("fact 3") for p in self.run_facts(meta=m)[0]))
        scan = good_scan()
        del scan["zooms"][10]
        self.assertTrue(any(p.startswith("fact 3") for p in self.run_facts(scan)[0]))
        self.assertTrue(any(p.startswith("fact 3") for p in self.run_facts(c.new_scan())[0]))

    def test_fact_4_tile_cap_is_strict(self):
        scan = good_scan()
        scan["zooms"][2]["max"] = c.TILE_CAP_BYTES
        self.assertTrue(any(p.startswith("fact 4: z2") for p in self.run_facts(scan)[0]))
        scan["zooms"][2]["max"] = c.TILE_CAP_BYTES - 1
        self.assertEqual(self.run_facts(scan)[0], [])

    def test_fact_5_state_key_collision(self):
        problems, rep = self.run_facts(all_codes=self.CODES + ["1001"])
        self.assertTrue(any(p.startswith("fact 5") for p in problems), problems)
        self.assertEqual(rep["feature_state_key_collisions"], 1)

    def test_fact_6_metadata(self):
        m = dict(good_meta(), generator_options="tippecanoe -o /work/x.mbtiles")
        self.assertTrue(any(p.startswith("fact 6") for p in self.run_facts(meta=m)[0]))

    def test_landing_view_reports_stored_bytes(self):
        scan = good_scan()
        for t in c.view_tiles(-98.6, 39.8, 4, 1440, 900):
            scan["landing_sizes"][t] = 1000
        view = c.landing_view(SPEC, scan)
        self.assertEqual(view["desktop"]["total_bytes"], 1000 * len(view["desktop"]["tiles"]))
        self.assertGreater(view["desktop"]["total_bytes"], view["phone"]["total_bytes"])


class ManifestTest(unittest.TestCase):
    def test_manifest_has_no_private_path_and_matches_the_schema(self):
        try:
            import jsonschema
        except ImportError:
            if os.environ.get("CI"):
                self.fail("jsonschema must be installed in CI")
            self.skipTest("jsonschema not installed")
        spec = dict(SPEC, boundary_label="apps/regions/us/data/counties_2020.geojson", boundary_sha256="a" * 64, boundary_bytes=10,
                    level_ids=["county-2020"], tippecanoe="tippecanoe v2.79.0", pmtiles_cli="pmtiles dev", units=2, units_with_geometry=2, features=2)
        rep = {"status": "passed", "name": spec["name"], "archive_sha256": "b" * 64, "archive_bytes": 123, "boundary_sha256": "a" * 64,
               "code_coverage": {"4": {"present": 2, "of": 2, "missing": 0}}, "zooms": {"4": {"tiles": 1, "total_bytes": 9, "largest_tile_bytes": 9, "largest_tile": [4, 0, 0]}},
               "landing_view": {"desktop": {"window": [1440, 900], "tiles_in_view": 1, "tiles": [[4, 0, 0, 9]], "total_bytes": 9}},
               "empty_geometry_codes": []}

        class A:
            git_commit = None
            created_by = "test"
        m = c.make_manifest(A, spec, {}, rep, [])
        schema = json.loads((c.REPO / "schemas/data-manifest.schema.json").read_text())
        jsonschema.validate(m, schema)
        self.assertEqual(m["dataset_family"], "census-tiles")
        self.assertTrue(m["durable_files"][0]["uri"].startswith("build-cache:"))
        self.assertNotIn("/nowhere", json.dumps(m))
        # a verified upload is recorded; one that fails to verify or names another digest stops the manifest
        up = {"key": spec["name"] + ".pmtiles", "match": True, "sha256_readback": "b" * 64, "bytes": 123, "r2_etag": "e"}
        self.assertEqual(c.make_manifest(A, spec, {}, rep, [up])["durable_files"][1]["uri"], f"r2://pow-tiles/{spec['name']}.pmtiles")
        for bad in (dict(up, match=False), dict(up, sha256_readback="c" * 64)):
            with self.assertRaises(SystemExit):
                c.make_manifest(A, spec, {}, rep, [bad])


def _tools_present():
    if not (shutil.which("tippecanoe") and shutil.which("pmtiles")):
        return False
    try:
        import pmtiles.reader  # noqa: F401
    except ImportError:
        return False
    return True


@unittest.skipUnless(_tools_present(), "needs tippecanoe, the pmtiles command and the pmtiles package")
class IntegrationTest(unittest.TestCase):
    def test_small_boundary_builds_validates_and_rebuilds_identically(self):
        import argparse

        with tempfile.TemporaryDirectory() as d:
            d = Path(d)
            doc = fc(*[feat(f"{i:05d}", f"unit {i}", poly(-80 + 2 * (i % 5), 30 + 2 * (i // 5))) for i in range(25)])
            (d / "b.geojson").write_text(json.dumps(doc))
            a = argparse.Namespace(work=str(d / "w"), boundary=str(d / "b.geojson"), country="us", slug="test", vintage="2020", code_prop="GEOID",
                                   name_prop="NAME", landing="-78,32,4", level_id=["test"], verify_rebuild=True, forbid=None, jobs=2)
            c.cmd_build(a)
            spec = json.loads((d / "w/spec.json").read_text())
            info = json.loads((d / "w/build-info.json").read_text())
            self.assertTrue(info["rebuild_identical"])
            self.assertTrue(c.NAME_RE.match(spec["name"]))
            c.cmd_validate(a)
            rep = json.loads((d / "w/validation-report.json").read_text())
            self.assertEqual(rep["status"], "passed", rep["problems"])
            self.assertEqual(rep["code_coverage"]["10"]["present"], 25)
            # a different work directory gives the same bytes
            a2 = argparse.Namespace(**dict(vars(a), work=str(d / "other" / "w2"), verify_rebuild=False))
            c.cmd_build(a2)
            self.assertEqual(json.loads((d / "other/w2/build-info.json").read_text())["archive_sha256"], info["archive_sha256"])


if __name__ == "__main__":
    unittest.main()
