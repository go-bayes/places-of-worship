"""Offline edition checks, with explicit skips for optional geospatial tools."""

import gzip
import importlib.util
import json
import shutil
import tempfile
import unittest
from array import array
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace

import build_osm_edition as build
import extract_osm_edition as extract


def has_packages(*packages):
    return all(importlib.util.find_spec(package) for package in packages)


def public_feature(osm_id=1, country="NZ", lon=174.75, lat=-36.85, osm_type="node"):
    return {
        "type": "Feature", "geometry": {"type": "Point", "coordinates": [lon, lat]},
        "properties": {"id": f"{osm_type[0]}{osm_id}", "osm_id": int(osm_id), "osm_type": osm_type,
                       "name": "", "religion": "unknown", "denomination": "", "country_code": country},
    }


def fixture(directory, main, possible):
    edition = directory / "edition"
    edition.mkdir()
    provenance = directory / "provenance.json"
    a = SimpleNamespace(edition=edition, provenance=provenance, work=directory / "build",
                        snapshot="20260901", pbf=None, osm_boundaries=None)
    source = {"source_kind": "sample", "edition_timestamp": "2026-11-20T21:21:21Z"}
    paths = {name: edition / name for name in extract.FILES.values()}
    private = []
    for records, basis, tag, value in ((main, "tag", "amenity", extract.WORSHIP),
                                       (possible, "building", "building", "synagogue")):
        for feature in records:
            props = feature["properties"]
            props = {**props, "basis": basis, "tags": {tag: value}, "timestamp": extract.EDITION_TIMESTAMP}
            if basis == "building":
                props["holds_tagged_place"] = False
            private.append({**feature, "properties": props})
    private.sort(key=lambda f: ("nwr".index(f["properties"]["id"][0]), f["properties"]["osm_id"]))
    for name, records in (("edition.ndjson", private), ("places.ndjson", main), ("places-possible.ndjson", possible)):
        paths[name].write_text("".join(map(extract.json_line, records)), encoding="utf-8")
    extract.write_json(edition / "edition-stats.json", {
        "source": source, "hashes": {name: build._sha256(path) for name, path in paths.items()},
        "published_by_basis": {"tag": len(main), "building": len(possible)},
        "without_geometry": {}, "incomplete_geometry": {}, "missing_member_geometry": {}, "cyclic_geometry": {},
        "boundary": {"version": "5.1.1", "osm": {
            "sha256": "a" * 64, "feature_count": 5, "iso_feature_count": 2, "usable_feature_count": 2,
        }},
        "filter_rules": extract.FILTER_RULES,
    })
    extract.write_json(provenance, {
        **source, "sample_source": "fixture.osm.pbf",
        "boundary_source": "Natural Earth 1:10m", "boundary_version": "5.1.1",
        "filter_rules": extract.FILTER_RULES, "tool_versions": {},
    })
    return a


def mock_tile(layer, extent, points):
    from mapbox_vector_tile.Mapbox.vector_tile_pb2 import tile

    msg = tile()
    data = msg.layers.add(name=layer, extent=extent, version=2)
    for props, x, y in points:
        feature = data.features.add(type=1, geometry=[9, 2 * x, 2 * y])
        for key, value in props.items():
            feature.tags.extend((len(data.keys), len(data.values)))
            data.keys.append(key)
            prop = data.values.add()
            if type(value) is int:
                prop.uint_value = value
            else:
                prop.string_value = value
    return gzip.compress(msg.SerializeToString(), mtime=0)


def write_archive(path, plan, tiles, compression=None, tile_type=None):
    from pmtiles.tile import Compression, TileType, zxy_to_tileid
    from pmtiles.writer import Writer

    with path.open("wb") as file:
        writer = Writer(file)
        for z, x, y, raw in tiles:
            writer.write_tile(zxy_to_tileid(z, x, y), raw)
        writer.finalize({
            "tile_compression": compression or Compression.GZIP, "tile_type": tile_type or TileType.MVT,
        }, {"vector_layers": build.layer_metadata(plan)})


class TestEditionRules(unittest.TestCase):
    def test_basis_and_precedence(self):
        active = {"amenity": extract.WORSHIP}
        building = {"building": "mosque"}
        former = {"was:amenity": extract.WORSHIP}
        cases = [
            (active | building | former, ("tag", True)),
            (active | {"disused:amenity": "school"}, ("tag", True)),
            (building | former, ("building", True)),
            (former, ("lifecycle", True)),
            ({"landuse": "religious"}, (None, False)),
            ({"was:amenity": "school"}, (None, True)),
            ({}, (None, False)),
        ]
        for tags, expected in cases:
            with self.subTest(tags=tags):
                self.assertEqual(extract.classify(tags), expected)

    def test_public_attributes_and_absence(self):
        private = {
            "id": "n1", "osm_id": 1, "osm_type": "node", "country_code": "NZ", "former": True,
            "tags": {"name:en": "English name", "official_name": "Official name", "start_date": "c.1870",
                     "phone": "123", "website": "example.com", "religion": ""},
        }
        props = extract.public_properties(private)
        self.assertEqual(props.keys(), extract.PUBLIC_REQUIRED | extract.PUBLIC_OPTIONAL)
        self.assertEqual(props["name"], "Official name")
        self.assertIs(type(props["osm_id"]), int)
        self.assertEqual(props["name_en"], "English name")
        self.assertEqual(props["start_date"], "c.1870")
        self.assertEqual(props["religion"], "unknown")
        self.assertEqual(props["denomination"], "")
        bare = extract.public_properties({**private, "tags": {}})
        self.assertEqual(bare.keys(), extract.PUBLIC_REQUIRED)
        self.assertEqual(bare["name"], "")
        self.assertEqual(extract.public_properties({**private, "tags": {"name:en": "English name"}})["name"], "")
        named = {**private, "tags": {**private["tags"], "name": "Local name"}}
        self.assertEqual(extract.public_properties(named)["name"], "Local name")

    def test_natural_earth_iso(self):
        for adm0, iso, eh, expected in [
            ("FRA", "-99", "FR", "FR"), ("NOR", "-99", "NO", "NO"), ("KOS", "-99", "XK", "XK"),
            ("TWN", "CN-TW", "TW", "TW"), ("FRA", "FR-973", "GF", "GF"), ("UMI", "-99", "US", "UM"),
            ("SYR", "XD", "XD", "ZZ"), ("SOL", "-99", "-99", "ZZ"), ("NZL", "NZ", "-99", "NZ"),
        ]:
            record = {"ADM0_A3": adm0, "ISO_A2": iso, "ISO_A2_EH": eh}
            with self.subTest(record=record):
                self.assertEqual(extract.iso_code(record), expected)

    def test_public_reader_refuses_missing_or_repeated_osm_key(self):
        with tempfile.TemporaryDirectory() as work:
            path = Path(work) / "input.ndjson"
            valid = public_feature()
            keyless = public_feature()
            del keyless["properties"]["osm_id"]
            path.write_text(extract.json_line(keyless), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "without a valid OSM key"):
                build.read_places(path, {})
            for bad in ("1", 1.0, True):
                wrong_type = {**valid, "properties": {**valid["properties"], "osm_id": bad}}
                path.write_text(extract.json_line(wrong_type), encoding="utf-8")
                with self.assertRaisesRegex(ValueError, "must be an integer"):
                    build.read_places(path, {})
            path.write_text(extract.json_line(valid) * 2, encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "repeated OSM key"):
                build.read_places(path, {})
            path.write_text(extract.json_line(valid), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "repeated OSM key"):
                build.read_places(path, build.read_places(path, {}))

    def test_low_zoom_osm_key_preserves_representative_click(self):
        props = public_feature()["properties"]
        place = build.Place((0, 0), (0, 0), props)
        thin = build.thin_properties(place, 2, 6)
        self.assertEqual(build.osm_key(thin, combined=True), "n1")
        self.assertEqual(thin["n"], 2)
        self.assertTrue({"name", "name_en", "osm_id"}.isdisjoint(thin))
        self.assertEqual(build.osm_key(build.thin_properties(place, 2, 7)), "n1")

    @unittest.skipUnless(has_packages("shapely"), "shapely unavailable")
    def test_nearest_country_cutoff_and_wrap(self):
        from shapely.geometry import box

        countries = extract.Countries([("NZ", box(174, -37, 175, -36)),
                                       ("FJ", box(179.9, -18, 180, -17)),
                                       ("ZZ", box(100, 0, 101, 1))])
        self.assertEqual(countries.locate(174, -36.5), ("NZ", "natural_earth"))
        self.assertEqual(countries.locate(173.9, -36.5), ("NZ", "nearest"))
        self.assertEqual(countries.locate(173, -36.5), ("ZZ", "fallback"))
        self.assertEqual(countries.locate(-179.99, -17.5), ("FJ", "nearest"))
        self.assertEqual(countries.locate(100.5, 0.5), ("ZZ", "fallback"))
        self.assertEqual(countries.locate(-180, -17.5), ("FJ", "natural_earth"))
        shared = extract.Countries([("NZ", box(174, -37, 175, -36)), ("ZZ", box(175, -37, 175.5, -36))])
        self.assertEqual(shared.locate(175, -36.5), ("NZ", "natural_earth"))
        self.assertEqual(shared.locate(175.012, -36.5), ("NZ", "nearest"))

    @unittest.skipUnless(has_packages("shapely"), "shapely unavailable")
    def test_osm_boundaries_filter_coverage_priority_and_repair(self):
        from shapely.geometry import MultiPolygon, Point, Polygon, box, mapping

        france = MultiPolygon([box(0, 0, 1, 1), box(8, 8, 18, 18)])
        territory = box(0, 0, 2, 2)
        cases = [
            ({"ISO3166-1": "FR"}, france),
            ({"ISO3166-1": "gp", "ISO3166-1:alpha2": "GP"}, territory),
            ({"ISO3166-1": "GP"}, box(0, 0, .4, .4)),
            ({"ISO3166-1": "NZ"}, territory),
            ({"name": "Unrelated"}, territory),
            ({"ISO3166-1": "FJ"}, box(179, 10, 180, 11)),
            ({"ISO3166-1": "BE"}, Polygon([(24, 0), (26, 2), (24, 2), (26, 0), (24, 0)])),
            ({"ISO3166-1": "PT"}, Point(2, 2)),
        ]
        with tempfile.TemporaryDirectory() as work:
            path = Path(work) / "osm.geojsonseq"
            with path.open("w", encoding="utf-8") as dest:
                for i, (tags, geometry) in enumerate(cases):
                    prefix = "\x1e" if i % 2 else ""
                    dest.write(prefix + extract.json_line({"type": "Feature", "properties": tags,
                                                          "geometry": mapping(geometry)}))
            osm, stats = extract.OsmBoundaries.load(path, {"FR": 15, "NZ": 25, "PT": 35})
            self.assertEqual(stats["sha256"], build._sha256(path))
            self.assertEqual(stats["feature_count"], 8)
            self.assertEqual(stats["iso_feature_count"], 7)
            self.assertEqual(stats["usable_feature_count"], 6)
            self.assertEqual(stats["invalid_polygons"], 1)
            self.assertEqual(stats["by_code"]["GP"], 2)
            self.assertEqual(stats["missing_july_codes"], {"PT": 35})
            countries = extract.CountryAssignment(osm, extract.Countries([("DE", box(0, 0, 3, 3))]))
            # france has the smallest component here, but the largest source feature.
            self.assertEqual(countries.locate(.5, .5), ("GP", "osm", ["FR", "GP", "NZ"]))
            self.assertEqual(countries.locate(.2, .2), ("GP", "osm", ["FR", "GP", "NZ"]))
            self.assertEqual(countries.locate(1.5, 1), ("GP", "osm", ["GP", "NZ"]))
            self.assertEqual(countries.locate(2.5, 2.5), ("DE", "natural_earth", ()))
            self.assertEqual(countries.locate(3.1, 2.5), ("DE", "nearest", ()))
            self.assertEqual(countries.locate(4, 2.5), ("ZZ", "fallback", ()))
            self.assertEqual(countries.locate(-180, 10.5), ("FJ", "osm", ()))

    @unittest.skipUnless(has_packages("osmium", "shapely"), "pyosmium or shapely unavailable")
    def test_pbf_geometry_members_and_deterministic_output(self):
        import osmium
        from shapely.geometry import box

        with tempfile.TemporaryDirectory() as work:
            work = Path(work)
            path = work / "synthetic.osm.pbf"
            sources = osmium.osm.mutable
            active = {"amenity": extract.WORSHIP, "religion": "christian"}
            with osmium.SimpleWriter(str(path)) as writer:
                writer.add_node(sources.Node(id=2, version=3, location=(170, -45), tags=active,
                                             uid=777, user="private", changeset=8))
                writer.add_node(sources.Node(id=10, location=(172, -43)))
                writer.add_node(sources.Node(id=20, location=(176, -39)))
                writer.add_way(sources.Way(id=1, nodes=[2, 10, 999], tags={"building": "church"}))
                writer.add_way(sources.Way(id=2, nodes=[999], tags=active))
                writer.add_relation(sources.Relation(id=1, members=[("w", 1, ""), ("n", 20, "")]))
                writer.add_relation(sources.Relation(id=2, members=[("r", 1, ""), ("r", 99, "")], tags=active))
                writer.add_relation(sources.Relation(id=3, members=[("n", 2, "")],
                                                    tags={"ruins:amenity": extract.WORSHIP}))
            countries = extract.CountryAssignment(
                extract.OsmBoundaries([("AU", [box(169, -46, 170.5, -44)]), ("NZ", [box(165, -50, 180, -34)])]),
                extract.Countries([]),
            )
            run1, run2 = work / "one", work / "two"
            run1.mkdir()
            run2.mkdir()
            stats = extract.write_edition(path, countries, run1)
            self.assertEqual(stats, extract.write_edition(path, countries, run2))
            for filename in extract.FILES.values():
                self.assertEqual((run1 / filename).read_bytes(), (run2 / filename).read_bytes())
            records = [json.loads(line) for line in (run1 / "edition.ndjson").read_text().splitlines()]
            self.assertEqual([f["properties"]["id"] for f in records], ["n2", "w1", "w2", "r2", "r3"])
            self.assertEqual(records[1]["geometry"]["coordinates"], [171, -44])
            self.assertIsNone(records[2]["geometry"])
            self.assertEqual(records[3]["geometry"]["coordinates"], [173, -42])
            self.assertEqual(stats["without_geometry"], {"tag": ["w2"]})
            self.assertEqual(stats["incomplete_geometry"], {"building": ["w1"], "tag": ["r2"]})
            self.assertEqual(stats["published_by_basis"], {"tag": 2})
            self.assertEqual(stats["osm_overlaps"], {"records": 2, "by_pair": {"AU/NZ": 2}})
            self.assertEqual(stats["buildings_withheld"]["by_country"], {"NZ": 1})
            self.assertTrue(records[1]["properties"]["holds_tagged_place"])
            props = records[0]["properties"]
            self.assertEqual(props["version"], 3)
            self.assertTrue({"user", "uid", "changeset"}.isdisjoint(props))

    @unittest.skipUnless(has_packages("osmium", "shapely"), "pyosmium or shapely unavailable")
    def test_buildings_with_tagged_neighbours(self):
        import osmium
        from shapely.geometry import box

        with tempfile.TemporaryDirectory() as work:
            work = Path(work)
            path = work / "neighbours.osm.pbf"
            metres_to_deg = 1 / (extract.KM_PER_DEGREE * 1000)
            worship = {"amenity": extract.WORSHIP}
            building = {"building": "church"}
            nodes, ways = [], []
            node, way = osmium.osm.mutable.Node, osmium.osm.mutable.Way

            for number in range(1, 6):
                ref, y = number * 10, number / 100
                nodes.extend((node(id=ref + 1, location=(-.0001, y - .0001)),
                              node(id=ref + 2, location=(.0001, y + .0001))))
                ways.append(way(id=number, nodes=[ref + 1, ref + 2], tags=building))
            nodes.extend((
                node(id=13, location=(0, .01), tags=worship),
                node(id=23, location=(.0001 + 5 * metres_to_deg, .02), tags=worship),
                node(id=33, location=(.0001 + 30 * metres_to_deg, .03), tags=worship),
                node(id=43, location=(-.0004, .04)), node(id=44, location=(.0004, .04)),
                node(id=60, location=(0, .06), tags=building),
                node(id=61, location=(6 * metres_to_deg, .06), tags=worship),
                node(id=70, location=(0, .07), tags=building),
                node(id=71, location=(8 * metres_to_deg, .07 + 8 * metres_to_deg), tags=worship),
            ))
            ways.append(way(id=6, nodes=[43, 44], tags=worship))
            with osmium.SimpleWriter(str(path)) as writer:
                for record in sorted(nodes, key=lambda record: record.id):
                    writer.add_node(record)
                for record in ways:
                    writer.add_way(record)

            assignment = extract.CountryAssignment(extract.OsmBoundaries([("NZ", [box(-1, -1, 1, 1)])]),
                                                   extract.Countries([]))
            stats = extract.write_edition(path, assignment, work)
            records = [json.loads(line)["properties"] for line in (work / "edition.ndjson").read_text().splitlines()]
            held = {p["id"]: p["holds_tagged_place"] for p in records if p["basis"] == "building"}
            self.assertEqual(held, {"w1": True, "w2": True, "w3": False, "w4": True, "w5": False,
                                   "n60": True, "n70": True})
            self.assertEqual(stats["buildings_withheld"], {"total": 5, "by_country": {"NZ": 5}, "buffer_metres": 10})
            self.assertEqual(stats["published_by_basis"], {"tag": 6, "building": 2})
            public = [json.loads(line)["properties"] for line in (work / "places-possible.ndjson").read_text().splitlines()]
            self.assertEqual([p["id"] for p in public], ["w3", "w5"])
            self.assertTrue(all("holds_tagged_place" not in p for p in public))

    @unittest.skipUnless(
        has_packages("pmtiles", "mapbox_vector_tile")
        and shutil.which("tippecanoe") and shutil.which("pmtiles"),
        "tippecanoe, PMTiles CLI, or vector tile Python dependencies unavailable",
    )
    def test_archive_counts_and_extras_exclusion(self):
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            main = [public_feature(1), public_feature(2), public_feature(3, "ZZ", 180, 90)]
            possible = [public_feature(100)]
            a = fixture(directory, main, possible)
            edition = a.edition
            build.prepare(a)
            build.build(a)
            main, possible = build.input_sets(a, extract.read_json(edition / "edition-stats.json"))
            country = build.country_counts(main)
            cells = extract.read_json(a.work / "build-info.json")["cell_px"]
            self.assertEqual(country, {"NZ": 2, "ZZ": 1})
            plans = build.layout(a.snapshot, country, True, sample=True)
            self.assertTrue(all("sample" in name for name in plans))
            _, places, possible_name = build.edition_names(a.snapshot, sample=True)
            self.assertTrue(all(set(layers) == {"places"} for layers in plans[places].values()))
            self.assertTrue(all(set(layers) == {"places_possible"} for layers in plans[possible_name].values()))
            for name, plan in plans.items():
                path = a.work / "out" / f"{name}.pmtiles"
                report = build.scan_archive(path, plan, main, possible, country, cells)
                for zoom, layers in plan.items():
                    for layer, mode in layers.items():
                        stats = report[str(zoom)]["layers"][layer]
                        if mode == "building":
                            self.assertEqual(stats, {"features": 1})
                        else:
                            representatives = country.get(mode, 3)
                            self.assertEqual(stats["represented"], representatives)
                            self.assertEqual(stats["by_religion"]["unknown"], representatives)
                            if mode == "thin":
                                self.assertEqual(stats["features"], 2)

    def test_equal_count_swap_fails_thin_and_validation_after_rehash(self):
        with tempfile.TemporaryDirectory() as work:
            main = public_feature(306114295)
            extras = public_feature(42475928, osm_type="way")
            a = fixture(Path(work), [main], [extras])
            stats_file = a.edition / "edition-stats.json"
            stats = extract.read_json(stats_file)
            a.work.mkdir()
            for name, feature in (("places.ndjson", extras), ("places-possible.ndjson", main)):
                path = a.edition / name
                path.write_text(extract.json_line(feature), encoding="utf-8")
                stats["hashes"][name] = build._sha256(path)
            extract.write_json(stats_file, stats)
            hashes, _ = build.bound_inputs(a)
            extract.write_json(a.work / "build-info.json", {"snapshot": a.snapshot, "hashes": hashes})
            for stage in (build.prepare, build.validate):
                with self.assertRaisesRegex(ValueError, "public key sets disagree"):
                    stage(a)

    def test_provenance_requires_exact_cutoff_and_reconstruction_digests(self):
        with tempfile.TemporaryDirectory() as work:
            a = fixture(Path(work), [public_feature()], [])
            p = extract.read_json(a.provenance)
            del p["sample_source"]
            a.pbf = Path(work) / "candidate.osm.pbf"
            a.osm_boundaries = Path(work) / "boundary.geojsonseq"
            a.pbf.write_bytes(b"reconstruction fixture")
            a.osm_boundaries.write_bytes(b"expected boundaries")
            source = {"source_kind": "planet", "edition_timestamp": extract.EDITION_TIMESTAMP}
            hashes = {"candidates_pbf": build._sha256(a.pbf), "osm_iso_boundaries": build._sha256(a.osm_boundaries)}
            p.update(**source, planet_file="planet-260831.osm.pbf", planet_md5="c" * 32,
                     change_sequences=[5101, 5102], input_sha256=hashes, tool_versions={"osmium_cli": "1.19.1"})
            stats_file = a.edition / "edition-stats.json"
            stats = extract.read_json(stats_file)
            stats["source"] = source
            stats["hashes"].update(hashes)
            extract.write_json(stats_file, stats)
            extract.write_json(a.provenance, {**p, "edition_timestamp": "2026-09-01T23:59:59Z"})
            with self.assertRaisesRegex(ValueError, "timestamp must equal"):
                build.bound_inputs(a)
            extract.write_json(a.provenance, p)
            build.bound_inputs(a)
            for path in (a.pbf, a.osm_boundaries):
                original = path.read_bytes()
                path.write_bytes(b"different source")
                with self.assertRaisesRegex(ValueError, "differs from the extraction digest"):
                    build.bound_inputs(a)
                path.write_bytes(original)
            extract.write_json(a.provenance, {**p, "input_sha256": {**hashes, "candidates_pbf": "f" * 64}})
            with self.assertRaisesRegex(ValueError, "differs from the reconstruction record"):
                build.bound_inputs(a)

    @unittest.skipUnless(has_packages("osmium") and shutil.which("osmium"), "pyosmium or osmium CLI unavailable")
    def test_extractor_and_builder_reject_november_pbf_object(self):
        import osmium

        with tempfile.TemporaryDirectory() as work:
            pbf = Path(work) / "future.osm.pbf"
            with osmium.SimpleWriter(str(pbf)) as writer:
                writer.add_node(osmium.osm.mutable.Node(id=1, timestamp=datetime.fromisoformat(extract.EDITION_TIMESTAMP),
                                                       location=(0, 0), tags={"amenity": extract.WORSHIP}))
                writer.add_node(osmium.osm.mutable.Node(id=2, timestamp=datetime.fromisoformat("2026-11-20T07:21:09Z"),
                                                       location=(1, 1)))
            self.assertEqual(len(list(extract.candidate_records(pbf))), 1)
            with self.assertRaisesRegex(ValueError, "n2: object timestamp is after"):
                list(extract.candidate_records(pbf, planet=True))
            with self.assertRaisesRegex(ValueError, "PBF: object timestamp is after"):
                build.check_candidate_pbf(pbf)

    @unittest.skipUnless(has_packages("shapely", "osmium"), "shapely or pyosmium unavailable")
    def test_wrapped_member_centres_and_withholding(self):
        import osmium

        with tempfile.TemporaryDirectory() as work:
            pbf = Path(work) / "seam.osm.pbf"
            with osmium.SimpleWriter(str(pbf)) as writer:
                nodes = osmium.osm.mutable
                writer.add_node(nodes.Node(id=1, location=(179.99, 0)))
                writer.add_node(nodes.Node(id=2, location=(-179.99, 0)))
                writer.add_way(nodes.Way(id=3, nodes=[1, 2], tags={"building": "church"}))
                writer.add_relation(nodes.Relation(id=4, members=[("w", 3, "")], tags={"amenity": extract.WORSHIP}))
            countries = extract.CountryAssignment(extract.OsmBoundaries([]), extract.Countries([]))
            extract.write_edition(pbf, countries, Path(work))
            records = [json.loads(line) for line in (Path(work) / "edition.ndjson").read_text().splitlines()]
            self.assertEqual([record["geometry"]["coordinates"] for record in records], [[-180, 0], [-180, 0]])
            self.assertTrue(records[0]["properties"]["holds_tagged_place"])
            bounds = extract.wrapped_bounds([179.99, -179.99], 0, 0)
            self.assertFalse(extract.TaggedPlaces(array("d", [0, 0])).within(bounds))
            self.assertTrue(extract.TaggedPlaces(array("d", [180, 0])).within(bounds))
            self.assertTrue(extract.TaggedPlaces(array("d", [-180, 0])).within(bounds))

    @unittest.skipUnless(has_packages("shapely"), "shapely unavailable")
    def test_unsplit_country_ring_rejected_with_code(self):
        with tempfile.TemporaryDirectory() as work:
            path = Path(work) / "boundary.geojsonseq"
            path.write_text(extract.json_line({
                "type": "Feature", "properties": {"ISO3166-1": "FJ"},
                "geometry": {"type": "Polygon", "coordinates": [[[179, 0], [-179, 0], [-179, 1], [179, 1], [179, 0]]]},
            }), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "FJ: country ring crosses"):
                extract.OsmBoundaries.load(path, {})

    @unittest.skipUnless(has_packages("osmium", "shapely"), "pyosmium or shapely unavailable")
    def test_deep_nested_relation_cycle_and_partial_geometry(self):
        import osmium

        with tempfile.TemporaryDirectory() as work:
            pbf = Path(work) / "nested.osm.pbf"
            osm = osmium.osm.mutable
            main = {"amenity": extract.WORSHIP}
            with osmium.SimpleWriter(str(pbf)) as writer:
                writer.add_node(osm.Node(id=1, location=(170, -40)))
                writer.add_node(osm.Node(id=2, location=(172, -42)))
                writer.add_node(osm.Node(id=3, location=(174, -44)))
                writer.add_way(osm.Way(id=1, nodes=[1, 2]))
                for ref in range(1, 10):
                    writer.add_relation(osm.Relation(id=ref, members=[("r", ref + 1, "")],
                                                     tags=main if ref == 1 else {}))
                writer.add_relation(osm.Relation(id=10, members=[("w", 1, "")]))
                writer.add_relation(osm.Relation(id=11, members=[("r", 12, ""), ("w", 1, "")], tags=main))
                writer.add_relation(osm.Relation(id=12, members=[("r", 11, ""), ("n", 3, "")]))
                writer.add_relation(osm.Relation(id=13, members=[("r", 1, ""), ("n", 3, ""), ("w", 99, "")], tags=main))
            country = extract.CountryAssignment(extract.OsmBoundaries([]), extract.Countries([]))
            stats = extract.write_edition(pbf, country, Path(work))
            records = [json.loads(line) for line in (Path(work) / "edition.ndjson").read_text().splitlines()]
            self.assertEqual([f["geometry"]["coordinates"] for f in records], [[171, -41], [172, -42], [172, -42]])
            self.assertEqual(stats["incomplete_geometry"], {"tag": ["r13"]})
            self.assertEqual(stats["cyclic_geometry"], {"tag": ["r11"]})
            self.assertEqual(stats["missing_member_geometry"], {"tag": ["r13"]})
            self.assertEqual(stats["published_by_basis"], {"tag": 3})

    def test_near_tile_boundary_rejects_wrong_owner(self):
        extent = 4096
        x = (extent - .25) * build.WORLD / (extent * 2)
        y = 100 * build.WORLD / (extent * 2)
        point = build.Place((0, 0), (x, y), {})
        with self.assertRaisesRegex(ValueError, "wrong owning tile"):
            build.check_point([9, 0, 200], point, 1, 1, 0, extent)
        build.check_point([9, 2 * (extent - 1), 200], point, 1, 0, 0, extent)

    @unittest.skipUnless(has_packages("pmtiles", "mapbox_vector_tile"), "vector tile dependencies unavailable")
    def test_z0_wrong_extent_cannot_hide_displaced_representatives(self):
        with tempfile.TemporaryDirectory() as work:
            path = Path(work) / "wrong-extent.pmtiles"
            plan = {0: {build.grid.OVERVIEW_LAYER: "thin"}}
            records = {}
            for i in range(634):
                props = public_feature(i + 1)["properties"]
                x, y = ((100 + cell) * build.WORLD / 256 for cell in (i % 32, i // 32))
                records[props["id"]] = build.Place((0, 0), (x, y), props)
            points = [(build.thin_properties(place, 1, 0), 0, 0) for place in records.values()]
            raw = mock_tile(build.grid.OVERVIEW_LAYER, 1, points)
            write_archive(path, plan, [(0, 0, 0, raw)])
            with self.assertRaisesRegex(ValueError, "incorrect tile extent"):
                build.scan_archive(path, plan, records, {}, {"NZ": 634}, {"0": 2})

    @unittest.skipUnless(has_packages("pmtiles", "mapbox_vector_tile"), "vector tile dependencies unavailable")
    def test_duplicate_ra_address_and_header_encoding_fail(self):
        from pmtiles.tile import Compression, TileType

        with tempfile.TemporaryDirectory() as work:
            path = Path(work) / "mutated.pmtiles"
            layer = build.grid.OVERVIEW_LAYER
            plan = {3: {layer: "NZ"}}
            extent = 4096
            world = extent << 3
            records, tiles, points = {}, [], []
            for i in (1, 2):
                p = public_feature(i)["properties"]
                world_xy = (i * build.WORLD / world, (5 * extent+i) * build.WORLD / world)
                records[p["id"]] = build.Place((0, 0), world_xy, p)
                points.append((p, i, i))
                tiles.append((3, 0, 5, mock_tile(layer, extent, [(p, i, i)])))
            args = path, plan, records, {}, {"NZ": 2}, {}
            write_archive(path, plan, tiles)
            with self.assertRaisesRegex(ValueError, "repeated tile address 3/0/5"):
                build.scan_archive(*args)
            honest = [(3, 0, 5, mock_tile(layer, extent, points))]
            write_archive(path, plan, honest)
            self.assertEqual(build.scan_archive(*args)["3"]["tiles"], 1)
            for compression, tile_type in [(Compression.NONE, None), (None, TileType.PNG)]:
                write_archive(path, plan, honest, compression, tile_type)
                with self.assertRaisesRegex(ValueError, "header must declare MVT and gzip"):
                    build.scan_archive(*args)

    @unittest.skipUnless(has_packages("pmtiles", "mapbox_vector_tile"), "vector tile dependencies unavailable")
    def test_unrecognised_extras_layer_in_places_archive_fails(self):
        from mapbox_vector_tile.Mapbox.vector_tile_pb2 import tile

        with tempfile.TemporaryDirectory() as work:
            path = Path(work) / "mixed-places.pmtiles"
            plan = {8: {build.grid.PLACES_LAYER: "tag"}}
            main, extra = public_feature(1)["properties"], public_feature(2)["properties"]
            extent = 4096
            msg = tile()
            for layer, props in (("places", main), ("places_possible", extra)):
                msg.MergeFromString(gzip.decompress(mock_tile(layer, extent, [(props, 1, 1)])))
            write_archive(path, plan, [(8, 0, 0, gzip.compress(msg.SerializeToString()))])
            with self.assertRaisesRegex(ValueError, "unexpected tile layer"):
                build.scan_archive(path, plan, {}, {}, {}, {})

    def test_public_records_reject_unapproved_tool_names_and_identifiers(self):
        with tempfile.TemporaryDirectory() as work:
            a = fixture(Path(work), [public_feature()], [])
            stats = extract.read_json(a.edition / "edition-stats.json")
            p = extract.read_json(a.provenance)
            extract.write_json(a.provenance, {**p, "tool_versions": {"build_host": "review-host"}})
            with self.assertRaisesRegex(ValueError, "invalid tool name"):
                build.provenance(a, stats)
            extract.write_json(a.provenance, {**p, "tool_versions": {"osmium_cli": "1.19.1 review-host"}})
            with self.assertRaisesRegex(ValueError, "invalid tool version"):
                build.provenance(a, stats)
            with self.assertRaisesRegex(ValueError, "private identity field"):
                build.check_public_record({"pipeline": {"software_versions": {"build_host": "review-host"}}})
            with self.assertRaisesRegex(ValueError, "private path"):
                build.check_public_record({"source": {"citation": "/home/operator/reconstruction"}})

    def test_matching_non_numeric_boundary_version_fails(self):
        with tempfile.TemporaryDirectory() as work:
            a = fixture(Path(work), [public_feature()], [])
            stats = extract.read_json(a.edition / "edition-stats.json")
            stats["boundary"]["version"] = "review-host"
            p = extract.read_json(a.provenance)
            extract.write_json(a.provenance, {**p, "boundary_version": "review-host"})
            with self.assertRaisesRegex(ValueError, "boundary_version must be a numeric release"):
                build.provenance(a, stats)

    def test_sample_basename_stays_private_and_package_release_is_validated(self):
        with tempfile.TemporaryDirectory() as work:
            a = fixture(Path(work), [public_feature()], [])
            stats = extract.read_json(a.edition / "edition-stats.json")
            p = {**extract.read_json(a.provenance), "sample_source": "review-host.osm.pbf"}
            extract.write_json(a.provenance, {**p, "pmtiles_package_release": "1.31.2"})
            public = build.provenance(a, stats)
            self.assertNotIn("sample_source", public)
            self.assertEqual(public["pmtiles_package_release"], "1.31.2")
            extract.write_json(a.provenance, {**p, "pmtiles_package_release": "review-host"})
            with self.assertRaisesRegex(ValueError, "pmtiles_package_release must be a numeric release"):
                build.provenance(a, stats)

    @unittest.skipUnless(has_packages("jsonschema"), "jsonschema unavailable")
    def test_regenerate_legacy_receipt_with_correct_scopes_and_package_release(self):
        with tempfile.TemporaryDirectory() as work:
            main = [public_feature(1, "NZ"), public_feature(2, "US")]
            extras = [public_feature(3, "NZ"), public_feature(4, "UM")]
            a = fixture(Path(work), main, extras)
            a.manifest_dir = Path(work) / "manifests"
            a.git_commit = None
            a.pmtiles_package_release = "1.31.2"
            stats_path = a.edition / "edition-stats.json"
            stats = extract.read_json(stats_path)
            osm = stats["boundary"]["osm"]
            osm.update(bytes=10, vertex_count=8, invalid_polygons=0, by_code={"NZ": 1, "US": 1},
                       additional_boundary_codes={}, missing_july_codes={})
            stats["boundary"].update(dataset=extract.BOUNDARY_NAME, nearest_km=extract.NEAREST_KM,
                                     unassigned_code=extract.UNKNOWN_COUNTRY,
                                     sha256={extract.BOUNDARY_NAME + ext: "b"*64 for ext in (".shp", ".dbf")})
            stats["hashes"].update(candidates_pbf="c"*64, osm_iso_boundaries=osm["sha256"])
            stats.update(by_basis={"tag": 2, "building": 2}, by_object_type={"node": 4},
                         by_country_and_basis={}, by_country_method={"osm": 4}, boundary_comparison={},
                         osm_overlaps={"records": 0, "by_pair": {}},
                         buildings_withheld={"total": 0, "by_country": {}, "buffer_metres": 10})
            extract.write_json(stats_path, stats)
            hashes, _ = build.bound_inputs(a)
            main_places, possible_places = build.input_sets(a, stats)
            inputs = build.summary(stats, main_places, possible_places)
            del inputs["possible_by_country"]
            report = {"status": "passed", "snapshot": a.snapshot, "sample_only": True, "inputs": inputs,
                      "boundary": stats["boundary"], "provenance": {
                          **build.provenance(a, stats), "sample_source": "fixture.osm.pbf"
                      }, "software_versions": {"pmtiles_cli": "dev"}, "grid_cell_css_pixels": {}, "archives": {}}
            out = a.work / "out"
            out.mkdir(parents=True)
            for name in build.layout(a.snapshot, ["NZ", "US"], True, sample=True):
                path = out / f"{name}.pmtiles"
                path.write_bytes(name.encode("ascii"))
                report["archives"][name] = {"bytes": path.stat().st_size, "sha256": build._sha256(path),
                                            "zooms": {}, "edge_features_processed": 0}
            report_path = a.work / "validation-report.json"
            extract.write_json(report_path, report)
            report_sha = build._sha256(report_path)
            receipt_path = a.work / "validation-receipt.json"
            extract.write_json(receipt_path, {"inputs": hashes, "report_sha256": report_sha})
            original_receipt = receipt_path.read_bytes()

            build.manifest(a)

            for path in sorted(a.manifest_dir.glob("*.manifest.json")):
                doc = extract.read_json(path)
                self.assertEqual(doc["scope"]["country_codes"], ["NZ", "UM"] if "possible" in path.name else ["NZ", "US"])
                self.assertEqual(doc["pipeline"]["parameters"]["provenance"]["pmtiles_package_release"], "1.31.2")
                self.assertEqual(doc["pipeline"]["software_versions"], {"pmtiles_cli": "dev", "pmtiles_cli_package": "1.31.2"})
                for file in doc["durable_files"]:
                    self.assertEqual(file["sha256"], build._sha256(out / file["uri"].split(":", 1)[1]))
            regenerated = extract.read_json(a.manifest_dir / f"validation-report-osm-edition-{a.snapshot}.json")
            self.assertEqual(regenerated["inputs"]["possible_by_country"], {"NZ": 1, "UM": 1})
            self.assertEqual(build._sha256(report_path), report_sha)
            self.assertEqual(receipt_path.read_bytes(), original_receipt)
            self.assertEqual(build._sha256(a.provenance), hashes["provenance"])
            self.assertEqual(len(list(a.manifest_dir.iterdir())), 6)
            a.pmtiles_package_release = "review-host"
            with self.assertRaisesRegex(ValueError, "pmtiles_package_release must be a numeric release"):
                build.manifest_records(a)
            a.pmtiles_package_release = "1.31.2"
            next(out.glob("*.pmtiles")).write_bytes(b"changed archive")
            with self.assertRaisesRegex(ValueError, "archive changed after validation"):
                build.manifest_records(a)
