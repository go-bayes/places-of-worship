"""Tests for the Woodberry station import builder (python3 -m unittest scripts/test_build_vu_woodberry_import.py).

Synthetic rows only: the compiler's workbooks are quarantined outside this repository.
"""

from __future__ import annotations

import sys
import unittest
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import build_vu_woodberry_import as builder  # noqa: E402


def ev(kind: str | None, year) -> dict:
    return {"kind": builder.event_kind(kind), "year": builder.parse_year(year), "label": kind or ""}


class ParseYearTests(unittest.TestCase):
    def test_reads_integers_decades_and_blanks(self):
        self.assertEqual(builder.parse_year(1903), ("year", 1903))
        self.assertEqual(builder.parse_year("1903"), ("year", 1903))
        self.assertEqual(builder.parse_year("1960s"), ("decade", 1960))
        self.assertEqual(builder.parse_year(datetime(1988, 3, 1)), ("year", 1988))
        self.assertIsNone(builder.parse_year("."))
        self.assertIsNone(builder.parse_year(None))
        self.assertIsNone(builder.parse_year(12))

    def test_event_kinds_tolerate_the_source_typo(self):
        self.assertEqual(builder.event_kind("close outstaion"), "close")
        self.assertEqual(builder.event_kind("open outstation"), "open")
        self.assertEqual(builder.event_kind("censored"), "censored")
        self.assertIsNone(builder.event_kind(None))


class WalkEventsTests(unittest.TestCase):
    def test_open_then_close_is_one_period(self):
        periods, anomalies = builder.walk_catholic_events([ev("open station", 1903), ev("close station", 1988)])
        self.assertEqual(periods, [{"start": ("year", 1903), "end": ("close", 1988)}])
        self.assertEqual(anomalies, [])

    def test_same_year_close_and_open_is_a_status_change(self):
        periods, anomalies = builder.walk_catholic_events([
            ev("open station", 1896), ev("close station", 1913), ev("open outstation", 1913),
            ev("close outstation", 1923), ev("open station", 1923), ev("close station", 1938),
            ev("open station", 1951), ev("close station", 1951), ev("open station", 1964), ev("censored", 1973),
        ])
        self.assertEqual(periods, [
            {"start": ("year", 1896), "end": ("close", 1938)},
            {"start": ("year", 1951), "end": ("close", 1951)},
            {"start": ("year", 1964), "end": ("censored", 1973)},
        ])
        self.assertEqual(anomalies, [])

    def test_duplicate_closes_keep_the_first_and_are_reported(self):
        periods, anomalies = builder.walk_catholic_events([
            ev("open station", 1896), ev("close station", 1900), ev("open outstation", 1900),
            ev("close outstation", 1967), ev("close station", 1967), ev("close station", 1969),
            ev("open outstation", 1969), ev("censored", 1987),
        ])
        self.assertEqual(periods, [
            {"start": ("year", 1896), "end": ("close", 1967)},
            {"start": ("year", 1969), "end": ("censored", 1987)},
        ])
        self.assertEqual(len(anomalies), 2)
        self.assertIn("second close 1967", anomalies[0])

    def test_undated_open_and_censored(self):
        periods, anomalies = builder.walk_catholic_events([ev("open outstation", "."), ev("censored", 1984)])
        self.assertEqual(periods, [{"start": None, "end": ("censored", 1984)}])
        self.assertEqual(anomalies, [])

    def test_close_without_a_year_ends_unknown(self):
        periods, anomalies = builder.walk_catholic_events([ev("open station", 1960), ev("close station", ".")])
        self.assertEqual(periods, [{"start": ("year", 1960), "end": None}])
        self.assertEqual(len(anomalies), 1)

    def test_decade_start_after_a_gap(self):
        periods, _ = builder.walk_catholic_events([
            ev("open station", 1888), ev("close station", 1893), ev("open outstation", 1893),
            ev("close outstation", 1923), ev("open outstation", "1960s"), ev("censored", 1991),
        ])
        self.assertEqual(periods, [
            {"start": ("year", 1888), "end": ("close", 1923)},
            {"start": ("decade", 1960), "end": ("censored", 1991)},
        ])

    def test_row_without_event_yields_no_period(self):
        periods, anomalies = builder.walk_catholic_events([ev(None, None)])
        self.assertEqual(periods, [])
        self.assertEqual(len(anomalies), 1)


class PeriodColumnsTests(unittest.TestCase):
    def test_known_founding_and_closure(self):
        columns = builder.period_columns({"start": ("year", 1903), "end": ("close", 1988)})
        self.assertEqual(columns["start_mode"], "known")
        self.assertEqual(columns["start_date"], "1903")
        self.assertEqual(columns["start_basis"], "founding_stated")
        self.assertEqual(columns["end_mode"], "known")
        self.assertEqual(columns["end_basis"], "closure_stated")
        self.assertEqual(columns["end_reason"], "closed")

    def test_censored_is_after_last_seen(self):
        columns = builder.period_columns({"start": ("decade", 1960), "end": ("censored", 1991)})
        self.assertEqual(columns["start_mode"], "between")
        self.assertEqual((columns["start_not_earlier_than"], columns["start_not_later_than"]), ("1960", "1969"))
        self.assertEqual(columns["end_mode"], "after")
        self.assertEqual(columns["end_not_earlier_than"], "1991")
        self.assertEqual(columns["end_basis"], "last_seen_only")
        self.assertEqual(columns["end_reason"], "unknown")

    def test_undated_both_ends(self):
        columns = builder.period_columns({"start": None, "end": None})
        self.assertEqual((columns["start_mode"], columns["start_basis"]), ("unknown", "unknown"))
        self.assertEqual((columns["end_mode"], columns["end_basis"]), ("unknown", "unknown"))
        self.assertNotIn("end_reason", columns)

    def test_first_seen_basis_carries_through(self):
        columns = builder.period_columns({"start": ("year", 1951), "start_basis": "first_seen_only", "end": ("censored", 1973)})
        self.assertEqual(columns["start_basis"], "first_seen_only")


class DirectorySpanTests(unittest.TestCase):
    def test_reads_min_and_max_years(self):
        self.assertEqual(builder.directory_year_span("Australasian Catholic Directory 1906-1928, 1951-1973"), (1906, 1973))
        self.assertIsNone(builder.directory_year_span(None))
        self.assertIsNone(builder.directory_year_span("no years here"))


class AtlasTests(unittest.TestCase):
    def test_cell_parsing_strips_societies_and_years(self):
        parsed = builder.parse_atlas_cell("Rannon (Ambrym) PCNZ (1892)")
        self.assertEqual(parsed["name"], "Rannon (Ambrym)")
        self.assertEqual(parsed["societies"], ["PCNZ"])
        self.assertEqual(parsed["years"], [1892])
        parsed = builder.parse_atlas_cell("Tongoa PCNZ & UFS")
        self.assertEqual(parsed["name"], "Tongoa")
        self.assertEqual(parsed["societies"], ["PCNZ", "UFS"])
        self.assertEqual(builder.parse_atlas_cell(None)["name"], "")

    def test_place_reads_editions_and_founding(self):
        place = builder.atlas_place([None, "Ambrim PCNZ", "Ambrim", "Rannon (Ambrym) PCNZ (1892)"])
        self.assertEqual(place["editions"], [1911, 1916, 1925])
        self.assertEqual(place["founding_year"], 1892)
        self.assertEqual(place["name"], "Rannon (Ambrym)")
        self.assertEqual(place["societies"], ["PCNZ"])

    def test_founding_not_before_first_edition_is_not_a_founding(self):
        place = builder.atlas_place(["Somewhere NHMS (1910)", None, None, None])
        self.assertIsNone(place["founding_year"])
        self.assertEqual(place["other_years"], [1910])

    def test_two_parenthesised_years_take_the_earliest(self):
        place = builder.atlas_place([None, None, None, "Tangoa AuPV (1873) UFS (1876)"])
        self.assertEqual(place["founding_year"], 1873)
        self.assertEqual(place["other_years"], [1876])


class RadiusTests(unittest.TestCase):
    def test_catholic_radius_follows_the_note(self):
        self.assertEqual(builder.catholic_radius_m(None), 500)
        self.assertEqual(builder.catholic_radius_m("rough location based on map on page 72"), 2000)

    def test_protestant_radius_follows_note_and_decimals(self):
        self.assertEqual(builder.protestant_radius_m(None, "-16.1464", "168.1157"), 1000)
        self.assertEqual(builder.protestant_radius_m(None, "-19.24", "169.60"), 2000)
        self.assertEqual(builder.protestant_radius_m("this is just the middle of the island", "-14.4630", "168.0481"), 5000)


class RowAssemblyTests(unittest.TestCase):
    def test_rows_number_places_and_share_the_hash_within_a_place(self):
        places = [
            {"base": {"name": "A", "source_locator": "a"}, "checks": ["note"], "segments": [{"segment_index": 0, "start_mode": "known"}, {"segment_index": 1, "start_mode": "known"}]},
            {"base": {"name": "B", "source_locator": "b"}, "checks": [], "segments": [{"segment_index": 0, "start_mode": "unknown"}]},
        ]
        rows = builder.import_rows(places)
        self.assertEqual([r["row_number"] for r in rows], [1, 1, 2])
        self.assertEqual(rows[0]["claim_hash"], rows[1]["claim_hash"])
        self.assertNotEqual(rows[0]["claim_hash"], rows[2]["claim_hash"])
        payload = builder.run_payload("batch", {"title": "t"}, rows)
        self.assertEqual(payload["rows"][0]["import_checks"], ["note"])
        self.assertNotIn("import_checks", payload["rows"][2])
        self.assertEqual(payload["actor_email"], builder.SERVICE_ACTOR_EMAIL)

    def test_chunking(self):
        self.assertEqual(builder.chunked([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]])


if __name__ == "__main__":
    unittest.main()
