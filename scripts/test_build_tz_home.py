"""checks the timezone-to-camera table generator and the committed table:
zones map to registry codes, page countries carry their page's own camera,
the rest the registry camera, and the generated script parses as json"""
import json
import re
import sys
import unittest
from pathlib import Path

# ci runs this from the repository root, where scripts/ is not on the path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_tz_home as tz  # noqa: E402

REPO = Path(__file__).resolve().parents[1]
OUT = REPO / "apps/shared/data/tz-home.js"

ZONE_TAB = """# comment line
NZ\t-3652+17446\tPacific/Auckland
GB\t+513030-0000731\tEurope/London
AQ\t-7750+16636\tAntarctica/McMurdo
US\t+404251-0740023\tAmerica/New_York
UA\t+5026+03031\tEurope/Kyiv
"""

REGISTRY = {"countries": [
    {"code": "nz", "iso2": "NZ", "centre": [-42.3, 175.4], "zoom": 5.5, "page": True},
    {"code": "uk", "iso2": "GB", "centre": [55.4, -3.4], "zoom": 5.5, "page": True},
    {"code": "us", "iso2": "US", "centre": [44.7, -126.2], "zoom": 3.0, "page": False},
]}

PAGE = """
    window.REGION_CONFIG = {
      title: "x",
      center: [174.7762, -41.2865],
      initialZoom: 4.5,
"""


class TzHomeTest(unittest.TestCase):
    def test_zone_tab_parses_first_country(self):
        zones = tz.parse_zone_tab(ZONE_TAB)
        self.assertEqual(zones["Pacific/Auckland"], "nz")
        self.assertEqual(zones["Europe/London"], "gb")
        self.assertEqual(zones["Antarctica/McMurdo"], "aq")
        # a legacy alias follows its canonical zone; one whose zone is absent is not invented
        self.assertEqual(zones["Europe/Kiev"], "ua")
        self.assertEqual(zones["Europe/Belfast"], "gb")
        self.assertNotIn("Asia/Calcutta", zones)

    def test_page_camera_reads_centre_and_zoom(self):
        self.assertEqual(tz.page_camera(PAGE), [174.7762, -41.2865, 4.5])
        self.assertIsNone(tz.page_camera("no camera here"))

    def test_build_prefers_page_camera_and_maps_gb_to_uk(self):
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            pages = Path(tmp)
            (pages / "nz").mkdir()
            (pages / "nz" / "index.html").write_text(PAGE, encoding="utf-8")
            table = tz.build(REGISTRY, tz.parse_zone_tab(ZONE_TAB), pages_dir=pages)
        self.assertEqual(table["zones"]["Pacific/Auckland"], "nz")
        self.assertEqual(table["zones"]["Europe/London"], "uk")
        self.assertNotIn("Antarctica/McMurdo", table["zones"])
        self.assertEqual(table["cameras"]["nz"], [174.7762, -41.2865, 4.5])
        # a page country whose page is missing falls back to the registry camera
        self.assertEqual(table["cameras"]["uk"], [-3.4, 55.4, 5.5])
        self.assertEqual(table["cameras"]["us"], [-126.2, 44.7, 3.0])

    def test_committed_table_is_current_and_well_formed(self):
        self.assertTrue(OUT.is_file(), "run scripts/build_tz_home.py")
        text = OUT.read_text(encoding="utf-8")
        m = re.search(r"window\.POW_TZ_HOME = (\{.*\});\n$", text, re.S)
        assert m is not None, "tz-home.js does not carry the table"
        table = json.loads(m.group(1))
        self.assertEqual(table["zones"]["Pacific/Auckland"], "nz")
        self.assertEqual(table["zones"]["Europe/London"], "uk")
        # link zones (absent from zone1970.tab) and legacy aliases browsers still report
        for zone, code in (("Europe/Oslo", "no"), ("Europe/Stockholm", "se"), ("Europe/Amsterdam", "nl"),
                           ("Asia/Calcutta", "in"), ("Europe/Kiev", "ua"), ("Asia/Saigon", "vn"),
                           ("America/Buenos_Aires", "ar")):
            self.assertEqual(table["zones"].get(zone), code, zone)
        registry = json.loads(tz.REGISTRY.read_text(encoding="utf-8"))
        codes = {c["code"] for c in registry["countries"]}
        self.assertEqual(set(table["cameras"]), codes)
        for zone, code in table["zones"].items():
            self.assertIn(code, codes, zone)
        for code, camera in table["cameras"].items():
            self.assertEqual(len(camera), 3, code)
            lng, lat, zoom = camera
            self.assertTrue(-180 <= lng <= 180 and -90 <= lat <= 90 and 0 < zoom <= 18, code)
        # page countries carry their page camera
        nz = re.search(r"center:\s*\[([^\]]+)\]", (tz.PAGES / "nz/index.html").read_text(encoding="utf-8"))
        assert nz is not None, "the nz page carries no centre"
        self.assertEqual(table["cameras"]["nz"][:2], [float(v) for v in nz.group(1).split(",")])


if __name__ == "__main__":
    unittest.main()
