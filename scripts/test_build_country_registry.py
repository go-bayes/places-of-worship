"""checks the committed world country registry and its two generated twins:
every entry has a camera inside its box, page countries are flagged, the
antimeridian countries wrap the right way, and the convex table agrees"""
import json
import re
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
REGISTRY = REPO / "apps/shared/data/country-registry.json"
REGISTRY_JS = REPO / "apps/shared/data/country-registry.js"
CONVEX = REPO / "convex/lib/countryRegistry.generated.ts"
PAGES = REPO / "apps/regions"


def lng_inside(box, lng):
    west, _, east, _ = box
    if west <= east:
        return west <= lng <= east
    return lng >= west or lng <= east


class CountryRegistryTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.doc = json.loads(REGISTRY.read_text(encoding="utf-8"))
        cls.by_code = {c["code"]: c for c in cls.doc["countries"]}

    def test_codes_unique_and_lower(self):
        codes = [c["code"] for c in self.doc["countries"]]
        self.assertEqual(len(codes), len(set(codes)))
        self.assertTrue(all(re.fullmatch(r"[a-z]{2}", c) for c in codes))

    def test_page_flag_matches_directories(self):
        pages = {d.name for d in PAGES.iterdir() if d.is_dir() and re.fullmatch(r"[a-z]{2}", d.name)}
        flagged = {c["code"] for c in self.doc["countries"] if c["page"]}
        self.assertEqual(flagged, pages)

    def test_known_entries(self):
        self.assertEqual(self.by_code["nz"]["name"], "New Zealand")
        self.assertTrue(self.by_code["nz"]["page"])
        self.assertTrue(self.by_code["tv"]["page"])
        self.assertEqual(self.by_code["fj"]["name"], "Fiji")
        self.assertEqual(self.by_code["uk"]["iso2"], "GB")
        self.assertNotIn("gb", self.by_code)

    def test_centre_inside_box(self):
        for c in self.doc["countries"]:
            lat, lng = c["centre"]
            west, south, east, north = c["bbox"]
            self.assertTrue(south <= lat <= north, c["code"])
            self.assertTrue(lng_inside(c["bbox"], lng), c["code"])
            self.assertTrue(2 <= c["zoom"] <= 11, c["code"])

    def test_antimeridian_countries_wrap(self):
        for code in ("fj", "nz", "ki", "us", "ru"):
            west, _, east, _ = self.by_code[code]["bbox"]
            self.assertGreater(west, east, code)
        # a wrapping box must still be narrower than the world
        west, _, east, _ = self.by_code["fj"]["bbox"]
        self.assertLess((east - west) % 360, 30)

    def test_js_twin_matches(self):
        text = REGISTRY_JS.read_text(encoding="utf-8")
        payload = text.split("window.POW_COUNTRY_REGISTRY = ", 1)[1].rstrip().rstrip(";")
        self.assertEqual(json.loads(payload)["countries"], self.doc["countries"])

    def test_convex_twin_agrees(self):
        text = CONVEX.read_text(encoding="utf-8")
        keys = re.findall(r"^  ([A-Z]{2}): \{ name:", text, flags=re.M)
        self.assertIn("FJ", keys)
        self.assertIn("UK", keys)
        self.assertIn("GB", keys)
        self.assertEqual(len(keys), len(self.doc["countries"]) + 1)  # uk carries gb too
        fj = re.search(r"^  FJ: \{ name: \"Fiji\", west: ([-\d.]+), south: [-\d.]+, east: ([-\d.]+)", text, flags=re.M)
        self.assertIsNotNone(fj)
        west, east = float(fj.group(1)), float(fj.group(2))
        # the server reads east > 180 as the wrapped edge
        self.assertGreater(east, 180)
        self.assertLess(west, east)


if __name__ == "__main__":
    unittest.main()
