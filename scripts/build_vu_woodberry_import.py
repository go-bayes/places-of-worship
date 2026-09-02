#!/usr/bin/env python3
"""Build the PR-D bulk occupancy import for Bob Woodberry's Vanuatu mission stations.

Reads the two station workbooks quarantined in pow-research (never committed here),
reads each station's recorded events or atlas appearances as occupancy_v1 periods,
and writes, per workbook, the bulk-import CSV (one row per period; the reviewable
artefact), chunked run files for `batchImport:adminImportOccupancyBatch`, and a
build report. Every repair, exclusion, and reading rule is a named constant below
so the artefact can be audited without the raw files.

Usage:
  uv run --with openpyxl python scripts/build_vu_woodberry_import.py \
      [--input-dir ~/GIT/pow-research/data/raw/vu_woodberry] \
      [--output-dir ~/GIT/pow-research/data/derived/vu_woodberry_import]

Then, per chunk, from the repo root with the target deployment selected:
  npx convex run batchImport:adminImportOccupancyBatch "$(cat <output-dir>/run-catholic-01.json)"
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
from collections import Counter, OrderedDict
from datetime import date, datetime
from pathlib import Path
from typing import Any

COUNTRY = "VU"
TARGET_YEARS = [1989, 1999, 2009, 2020]
SERVICE_ACTOR_EMAIL = "service+claude@religionmap.org"
CONSULTED_DATE = "2026-08-29"
CHUNK_PLACES = 60

CATHOLIC_FILE = "Catholic Mission Stations - Jan 13 2026.xlsx"
CATHOLIC_SHA256 = "2cefd8b1ce7eac512f7d5018dee89164c70cb52bea5c75e4e6e57ecb87a168d6"
PROTESTANT_FILE = "Combined Protestant station locations in Vanuatu from Atlases 2.xlsx"
PROTESTANT_SHA256 = "8dee52eb6aa5a471080e7b222ea610fad1158babcd6a8dc33234af5d3e382643"

ATLAS_EDITIONS = [1903, 1911, 1916, 1925]

CATHOLIC_BATCH_ID = "vu-woodberry-catholic-stations-001"
PROTESTANT_BATCH_ID = "vu-woodberry-protestant-atlas-001"

# file-level source records (one file, one source record). licence is left
# blank on purpose: credit and licence wording are still to be agreed with the
# compiler, so every draft lands with licence_flag needs_review
CATHOLIC_SOURCE = {
    "source_type": "other",
    "title": "Woodberry, R. D. (2026). Catholic Mission Stations in Vanuatu, compiler's event log, 13 January 2026",
    "archive_ref": f"pow-research data/raw/vu_woodberry/{CATHOLIC_FILE} (sha256 {CATHOLIC_SHA256}); received from the compiler by email 2026-08-28",
    "consulted_date": CONSULTED_DATE,
}
PROTESTANT_SOURCE = {
    "source_type": "other",
    "title": "Woodberry, R. D. (2026). Combined Protestant station locations in Vanuatu from Atlases 2, compiler's presence matrix over the 1903, 1911, 1916 and 1925 mission atlas editions",
    "archive_ref": f"pow-research data/raw/vu_woodberry/{PROTESTANT_FILE} (sha256 {PROTESTANT_SHA256}); received from the compiler by email 2026-08-28",
    "consulted_date": CONSULTED_DATE,
}

# disclosed repairs: (island, station) -> field -> (as received, repaired)
CATHOLIC_COORDINATE_REPAIRS = {
    ("Efate", "Port Vila"): {
        "longitude": (68.3152, 168.3152),
        "reason": "leading digit missing in the source; Port Vila lies at about 168.32 E",
    },
}
# stations outside Vanuatu: excluded from the VU import, listed in the report
CATHOLIC_EXCLUSIONS = {
    ("Tikopia", "Santa Cruz"): "Tikopia is in Solomon Islands; the station is out of country for the VU import.",
}
# atlas matrix rows (excel row numbers) excluded, with the reason
PROTESTANT_EXCLUSIONS = {
    9: "Banks Islands MM: an island group, no point in the source.",
    20: "Maewo (near Opa) MM: no point in the source.",
    26: "Marked in the source as not a station (one boat).",
    38: "Marked in the source as on the map but not in the list of mission stations; no point.",
    39: "South Santo (1876): no point in the source; the compiler notes it is Tangoa, which has its own row.",
    46: "Wala AuPV (1902): the source point (-15.5143, 167.1772) is on Santo, duplicating the Santo / Luganville row; Wala is an islet off north-east Malekula. Point withheld until the compiler resolves it.",
}

SOCIETY_CODES = {"NHMS", "MM", "MelM", "PCV", "PCNZ", "PCC", "UFS", "AuPV", "AuPNSW", "CCAu", "SDA"}
GUESS_MARKERS = re.compile(
    r"rough|guess|probabl|approximate|assume|middle of the island|picked|not the actual|could be|may be|which location|not clear|not sure",
    re.IGNORECASE,
)

CATHOLIC_LOCATION_WORDING = (
    "Point georeferenced by the compiler (R. D. Woodberry) from mission histories, the mission map, and modern gazetteers; "
    "the source states no precision, so the radius is the builder's reading of the compiler's note."
)
PROTESTANT_LOCATION_WORDING = (
    "Point georeferenced by the compiler (R. D. Woodberry) from the atlas maps and modern gazetteers; "
    "the source states no precision, so the radius is the builder's reading of the compiler's note and the coordinate's decimals."
)
CATHOLIC_CONFIDENCE_BASIS = (
    "Event years compiled by R. D. Woodberry from L'Eglise Catholique au Vanuatu, Monnier's histories and the Australasian Catholic Directory. "
    "Opening years precede the directory ranges in 25 of 27 comparable stations, so they are read as stated foundings; "
    "the compiler's confirmation of that reading is pending."
)
PROTESTANT_CONFIDENCE_BASIS_FOUNDING = (
    "Parenthesised year carried by the atlas cell, always earlier than the edition printing it, read as a stated founding; "
    "whether the atlases print it or the compiler supplied it is pending his confirmation."
)
PROTESTANT_CONFIDENCE_BASIS_SEEN = (
    "Presence attested only by the atlas editions in which the compiler found the station printed; a first appearance is not a founding."
)

BASE_COLUMNS = [
    "name", "country_code", "religion", "denomination_code", "taxonomy_version", "lat", "lng",
    "locality", "containing_area", "geocoding_basis", "location_confidence", "source_locator",
    "source_url", "first_date", "last_date", "date_confidence", "culturally_sensitive", "notes",
]
OCCUPANCY_COLUMNS = [
    "segment_index",
    "start_mode", "start_date", "start_not_earlier_than", "start_not_later_than", "start_basis",
    "end_mode", "end_date", "end_not_earlier_than", "end_not_later_than", "end_basis", "end_reason", "still_active_asof",
    "latitude", "longitude", "location_mode", "uncertainty_radius_m", "location_basis", "location_wording",
    "occupancy_confidence", "occupancy_confidence_basis", "occupancy_source_basis", "occupancy_source_reference",
    "occupancy_source_account", "occupancy_uncertainty_note",
]
CSV_COLUMNS = ["row_number", *BASE_COLUMNS, "import_checks", *OCCUPANCY_COLUMNS]

MAX_TEXT = 1_900


# ---------------------------------------------------------------- pure helpers

def sha256_of(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def clip(text: str, limit: int = MAX_TEXT) -> str:
    text = " ".join(str(text).split())
    return text if len(text) <= limit else text[: limit - 1] + "…"


def parse_year(value: Any) -> tuple[str, int] | None:
    """Read a year cell: ("year", 1903), ("decade", 1960) for "1960s", or None."""
    if value is None:
        return None
    if isinstance(value, (datetime, date)):
        return ("year", value.year)
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        year = int(value)
        return ("year", year) if 1000 <= year <= 2100 else None
    text = str(value).strip()
    if re.fullmatch(r"\d{4}", text):
        return ("year", int(text))
    match = re.fullmatch(r"(\d{3})0s", text)
    if match:
        return ("decade", int(match.group(1)) * 10)
    return None


def event_kind(value: Any) -> str | None:
    """open / close / censored from the source's event vocabulary (typos tolerated)."""
    if value is None:
        return None
    text = str(value).strip().lower()
    if text.startswith("open"):
        return "open"
    if text.startswith("clos"):
        return "close"
    if text.startswith("censor"):
        return "censored"
    return None


def walk_catholic_events(events: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[str]]:
    """Fold a station's event log into continuous periods.

    Input events: {"kind": open|close|censored|None, "year": parse_year() result, "label": str}
    in source order. A close followed by an open in the same year is a status change
    (station <-> outstation) at the same place, not a closure. Returns periods as
    {"start": ("year"|"decade", int) | None, "end": ("close"|"censored", int) | None}
    and the anomalies met on the way.
    """
    periods: list[dict[str, Any]] = []
    anomalies: list[str] = []
    current: dict[str, Any] | None = None

    def finalise(period: dict[str, Any], end: tuple[str, int] | None) -> None:
        periods.append({"start": period["start"], "end": end})

    for event in events:
        kind = event.get("kind")
        year = event.get("year")
        label = event.get("label") or "?"
        year_text = str(year[1]) + ("s" if year[0] == "decade" else "") if year else "no year"
        if kind is None:
            anomalies.append(f"row without a recognised event ({label}, {year_text})")
            continue
        if kind == "open":
            if current is not None and current.get("pending_close") is not None:
                pending = current["pending_close"]
                if year is not None and pending[0] == "year" and year == pending:
                    current["pending_close"] = None  # status change, same place, same year
                else:
                    finalise(current, ("close", pending[1]))
                    current = {"start": year, "pending_close": None}
            elif current is not None:
                anomalies.append(f"open {year_text} while already open")
            else:
                current = {"start": year, "pending_close": None}
        elif kind == "close":
            if current is None:
                anomalies.append(f"close {year_text} with no preceding open")
                continue
            if year is None:
                anomalies.append("close event without a year; end recorded as unknown")
                finalise(current, None)
                current = None
                continue
            if current.get("pending_close") is not None:
                anomalies.append(f"second close {year_text} after close {current['pending_close'][1]}; the first close is kept")
                continue
            if current["start"] is not None and year[1] < current["start"][1]:
                anomalies.append(f"close {year_text} precedes the open year; end recorded as unknown")
                finalise(current, None)
                current = None
                continue
            current["pending_close"] = year
        elif kind == "censored":
            if current is None:
                anomalies.append(f"censored {year_text} with no preceding open; start recorded as unknown")
                current = {"start": None, "pending_close": None}
            if current.get("pending_close") is not None:
                anomalies.append(f"censored {year_text} after close {current['pending_close'][1]}; the close is kept")
                finalise(current, ("close", current["pending_close"][1]))
                current = None
                continue
            if year is None or year[0] != "year":
                anomalies.append("censored event without a year; end recorded as unknown")
                finalise(current, None)
            else:
                finalise(current, ("censored", year[1]))
            current = None
    if current is not None:
        if current.get("pending_close") is not None:
            finalise(current, ("close", current["pending_close"][1]))
        else:
            anomalies.append("open period with no closing or censored event; end recorded as unknown")
            finalise(current, None)
    return periods, anomalies


def directory_year_span(text: Any) -> tuple[int, int] | None:
    """Earliest and latest years named in an Australasian Catholic Directory attestation."""
    if not text:
        return None
    years = [int(y) for y in re.findall(r"\b(1[89]\d{2}|20\d{2})\b", str(text))]
    return (min(years), max(years)) if years else None


def period_columns(period: dict[str, Any]) -> dict[str, str]:
    """occupancy_v1 temporal columns for a folded period."""
    columns: dict[str, str] = {}
    start = period.get("start")
    if start is None:
        columns.update(start_mode="unknown", start_basis="unknown")
    elif start[0] == "decade":
        columns.update(
            start_mode="between",
            start_not_earlier_than=str(start[1]),
            start_not_later_than=str(start[1] + 9),
            start_basis=period.get("start_basis", "founding_stated"),
        )
    else:
        columns.update(start_mode="known", start_date=str(start[1]), start_basis=period.get("start_basis", "founding_stated"))
    end = period.get("end")
    if end is None:
        columns.update(end_mode="unknown", end_basis="unknown")
    elif end[0] == "close":
        columns.update(end_mode="known", end_date=str(end[1]), end_basis="closure_stated", end_reason="closed")
    else:  # censored / last seen: in use at the last observation, nothing after
        columns.update(end_mode="after", end_not_earlier_than=str(end[1]), end_basis="last_seen_only", end_reason="unknown")
    return columns


def decimals_of(value: Any) -> int:
    text = str(value).strip()
    return len(text.split(".")[1]) if "." in text else 0


def catholic_radius_m(note: Any) -> int:
    return 2000 if note and GUESS_MARKERS.search(str(note)) else 500


def protestant_radius_m(note: Any, lat_cell: Any, lng_cell: Any) -> int:
    if note and GUESS_MARKERS.search(str(note)):
        return 5000
    if min(decimals_of(lat_cell), decimals_of(lng_cell)) <= 2:
        return 2000
    return 1000


ATLAS_YEAR = re.compile(r"\((\d{4})\)")


def parse_atlas_cell(cell: Any) -> dict[str, Any]:
    """Split a printed atlas cell into a cleaned name, society codes, and parenthesised years."""
    if cell is None or not str(cell).strip():
        return {"printed": "", "name": "", "societies": [], "years": []}
    printed = " ".join(str(cell).split())
    years = [int(y) for y in ATLAS_YEAR.findall(printed)]
    without_years = ATLAS_YEAR.sub("", printed)
    tokens = without_years.split(" ")
    societies = [t.strip(",;") for t in tokens if t.strip(",;") in SOCIETY_CODES]
    kept = [t for t in tokens if t.strip(",;") not in SOCIETY_CODES and t.strip(",;") != "&"]
    name = " ".join(kept).strip(" ,;&")
    return {"printed": printed, "name": name, "societies": societies, "years": years}


def atlas_place(cells: list[Any]) -> dict[str, Any]:
    """Read one matrix row's four edition cells."""
    parsed = [parse_atlas_cell(c) for c in cells]
    editions = [year for year, p in zip(ATLAS_EDITIONS, parsed) if p["printed"]]
    years = sorted({y for p in parsed for y in p["years"]})
    names = [(len(p["name"]), i, p["name"]) for i, p in enumerate(parsed) if p["name"]]
    name = max(names)[2] if names else ""
    societies: list[str] = []
    for p in parsed:
        for s in p["societies"]:
            if s not in societies:
                societies.append(s)
    founding = years[0] if years and editions and years[0] < editions[0] else None
    return {
        "name": name,
        "editions": editions,
        "founding_year": founding,
        "other_years": [y for y in years if y != founding],
        "societies": societies,
        "printed": {year: p["printed"] for year, p in zip(ATLAS_EDITIONS, parsed) if p["printed"]},
    }


def content_hash(row: dict[str, Any]) -> str:
    keys = [k for k in CSV_COLUMNS if k not in {"row_number", "import_checks"}]
    payload = {k: ("" if row.get(k) is None else str(row.get(k)).strip()) for k in keys}
    return hashlib.sha256(json.dumps(payload, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()


def chunked(items: list[Any], size: int) -> list[list[Any]]:
    return [items[i:i + size] for i in range(0, len(items), size)]


# ---------------------------------------------------------------- readers

def load_rows(path: Path) -> list[list[Any]]:
    import openpyxl  # lazy: the tests never open a workbook

    workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
    return [list(r) for r in workbook.worksheets[0].iter_rows(values_only=True)]


def build_catholic(rows: list[list[Any]]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    header = [str(h).strip() if h else "" for h in rows[0]]
    col = {name: i for i, name in enumerate(header)}
    stations: "OrderedDict[tuple[str, str], list[list[Any]]]" = OrderedDict()
    for r in rows[1:]:
        if all(v is None for v in r):
            continue
        stations.setdefault((str(r[col["Island"]]).strip(), str(r[col["Stations"]]).strip()), []).append(r)

    coord_owner: dict[tuple[float, float], list[str]] = {}
    report: dict[str, Any] = {"stations": len(stations), "excluded": [], "repairs": [], "anomalies": {}, "fallback_directory": []}
    places: list[dict[str, Any]] = []
    for (island, station), events in stations.items():
        if (island, station) in CATHOLIC_EXCLUSIONS:
            report["excluded"].append(f"{island} / {station}: {CATHOLIC_EXCLUSIONS[(island, station)]}")
            continue
        lat = float(events[0][col["Latitude"]])
        lng = float(events[0][col["Longitude"]])
        checks: list[str] = []
        repair = CATHOLIC_COORDINATE_REPAIRS.get((island, station))
        if repair:
            received, fixed = repair["longitude"]
            if abs(lng - received) < 1e-6:
                lng = fixed
                message = f"Longitude repaired by the builder from {received} (as received) to {fixed}: {repair['reason']}. Disclosed here and in the build report."
                checks.append(message)
                report["repairs"].append(f"{island} / {station}: {message}")
        coord_owner.setdefault((round(lat, 3), round(lng, 3)), []).append(f"{island} / {station}")

        folded, anomalies = walk_catholic_events([
            {"kind": event_kind(e[col["Event"]]), "year": parse_year(e[col["Year"]]), "label": str(e[col["Event"]] or "")}
            for e in events
        ])
        directory = next((e[col["Australian Catholic Directory"]] for e in events if e[col["Australian Catholic Directory"]]), None)
        if not folded:
            span = directory_year_span(directory)
            if span:
                folded = [{"start": ("year", span[0]), "start_basis": "first_seen_only", "end": ("censored", span[1])}]
                report["fallback_directory"].append(f"{island} / {station}: no dated event; period read from the directory attestation {span[0]}-{span[1]} as first seen / last seen")
            else:
                folded = [{"start": None, "end": None}]
        if anomalies:
            report["anomalies"][f"{island} / {station}"] = anomalies
            checks.append("Irregular event sequence in the source: " + "; ".join(anomalies) + ".")

        original_order = events[0][col["Original Order"]]
        locator = f"Catholic Mission Stations sheet, original order {original_order}: {island} / {station}"
        flags = "; ".join(
            f"{label}: {events[0][col[key]]}"
            for key, label in [
                ("Covered in Monnier Histories", "in Monnier histories"),
                ("On map of mission statins", "on the mission map"),
                ("In 100 Years book", "in the 100 Years book"),
            ]
            if events[0][col[key]] is not None
        )
        notes_cells = [e[col["Note"]] for e in events if e[col["Note"]] is not None]
        note_text = "; ".join(
            (v.date().isoformat() if isinstance(v, datetime) else str(v).strip()) for v in notes_cells
        )
        event_summary = "; ".join(
            f"{str(e[col['Event']] or 'no event').strip()} {str(e[col['Year']]).strip() if e[col['Year']] is not None else '(no year)'}"
            for e in events
        )
        radius = catholic_radius_m(note_text)
        base = {
            "name": station,
            "country_code": COUNTRY,
            "religion": "Christian",
            "denomination_code": "christian.catholic",
            "taxonomy_version": "2026-06-12.1",
            "lat": lat,
            "lng": lng,
            "locality": island,
            "containing_area": island,
            "geocoding_basis": "map_georeference",
            "location_confidence": "low" if radius > 500 else "medium",
            "source_locator": locator,
            "source_url": "",
            "first_date": "",
            "last_date": "",
            "date_confidence": "",
            "culturally_sensitive": "no",
            "notes": clip(
                f"Compiler's event log: {event_summary}. Attestation — {flags}"
                + (f"; Australasian Catholic Directory: {directory}" if directory else "")
                + (f". Compiler's notes: {note_text}" if note_text else "")
            ),
        }
        segments = []
        for index, period in enumerate(folded):
            columns = period_columns(period)
            uncertainty = [
                "Calendar year as compiled; month-level dates in the compiler's notes are not encoded.",
            ]
            if anomalies:
                uncertainty.append("Irregular event sequence: " + "; ".join(anomalies) + ".")
            if columns["start_mode"] == "unknown" and columns["end_mode"] == "unknown":
                uncertainty.insert(0, "No dated event for this station in the source.")
            segments.append({
                **columns,
                "segment_index": index,
                "latitude": lat,
                "longitude": lng,
                "location_mode": "approximate_area",
                "uncertainty_radius_m": radius,
                "location_basis": "map_placement",
                "location_wording": clip(CATHOLIC_LOCATION_WORDING + (f" Compiler's note: {note_text}" if note_text else "")),
                "occupancy_confidence": "moderate" if period.get("start_basis", "founding_stated") == "founding_stated" else "low",
                "occupancy_confidence_basis": CATHOLIC_CONFIDENCE_BASIS,
                "occupancy_source_basis": "named_public_source",
                "occupancy_source_reference": locator,
                "occupancy_source_account": clip(
                    f"Period {index + 1} of {len(folded)} read from the compiler's event log: {event_summary}."
                    + (f" Directory attestation: {directory}." if directory else "")
                    + (f" Compiler's notes: {note_text}" if note_text else "")
                ),
                "occupancy_uncertainty_note": clip(" ".join(uncertainty)),
            })
        places.append({"base": base, "checks": checks, "segments": segments})
    for coord, owners in coord_owner.items():
        if len(owners) > 1:
            for place in places:
                key = f"{place['base']['locality']} / {place['base']['name']}"
                if key in owners:
                    others = ", ".join(o for o in owners if o != key)
                    place["checks"].append(f"Shares its point (to 3 decimals) with {others} in the same source; check whether these are one place.")
    return places, report


def build_protestant(rows: list[list[Any]]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    report: dict[str, Any] = {"rows": 0, "excluded": [], "unplaced": []}
    places: list[dict[str, Any]] = []
    coord_owner: dict[tuple[float, float], list[str]] = {}
    for excel_row, r in enumerate(rows[1:], start=2):
        if all(v is None for v in r):
            continue
        report["rows"] += 1
        parsed = atlas_place(r[1:5])
        first_printed = next(iter(parsed["printed"].values()), "")
        label = f"row {excel_row}: {first_printed}"
        if excel_row in PROTESTANT_EXCLUSIONS:
            report["excluded"].append(f"{label} — {PROTESTANT_EXCLUSIONS[excel_row]}")
            continue
        lat_cell, lng_cell, note = r[6], r[7], r[5]
        try:
            lat = float(str(lat_cell).strip())
            lng = float(str(lng_cell).strip())
        except (TypeError, ValueError):
            report["unplaced"].append(f"{label} — no usable point in the source")
            continue
        if not parsed["editions"]:
            report["unplaced"].append(f"{label} — no edition cell")
            continue
        locator = f"Atlas matrix row {excel_row}: {first_printed}"
        coord_owner.setdefault((round(lat, 3), round(lng, 3)), []).append(locator)
        radius = protestant_radius_m(note, lat_cell, lng_cell)
        printed = "; ".join(f"{year} '{text}'" for year, text in parsed["printed"].items())
        note_text = " ".join(str(note).split()) if note else ""
        checks = ["Name harmonised by the builder from the printed atlas forms; every printed form is in the notes."]
        if parsed["founding_year"] is not None:
            checks.append(f"Parenthesised year {parsed['founding_year']} read as a stated founding (earlier than the edition printing it); confirmation from the compiler pending.")
        if parsed["other_years"]:
            checks.append(f"Further parenthesised years in the source not encoded: {', '.join(str(y) for y in parsed['other_years'])}.")
        founding = parsed["founding_year"]
        period = {
            "start": ("year", founding if founding is not None else parsed["editions"][0]),
            "start_basis": "founding_stated" if founding is not None else "first_seen_only",
            "end": ("censored", parsed["editions"][-1]),
        }
        columns = period_columns(period)
        base = {
            "name": parsed["name"] or first_printed,
            "country_code": COUNTRY,
            "religion": "Christian",
            "denomination_code": "",
            "taxonomy_version": "",
            "lat": lat,
            "lng": lng,
            "locality": "",
            "containing_area": "Vanuatu",
            "geocoding_basis": "map_georeference",
            "location_confidence": "low",
            "source_locator": locator,
            "source_url": "",
            "first_date": "",
            "last_date": "",
            "date_confidence": "",
            "culturally_sensitive": "no",
            "notes": clip(
                f"Printed in the atlas editions as: {printed}."
                + (f" Mission societies as printed: {', '.join(parsed['societies'])}." if parsed["societies"] else "")
                + (f" Compiler's note: {note_text}" if note_text else "")
            ),
        }
        segment = {
            **columns,
            "segment_index": 0,
            "latitude": lat,
            "longitude": lng,
            "location_mode": "approximate_area",
            "uncertainty_radius_m": radius,
            "location_basis": "map_placement",
            "location_wording": clip(PROTESTANT_LOCATION_WORDING + (f" Compiler's note: {note_text}" if note_text else "")),
            "occupancy_confidence": "moderate" if founding is not None else "low",
            "occupancy_confidence_basis": PROTESTANT_CONFIDENCE_BASIS_FOUNDING if founding is not None else PROTESTANT_CONFIDENCE_BASIS_SEEN,
            "occupancy_source_basis": "named_public_source",
            "occupancy_source_reference": locator,
            "occupancy_source_account": clip(
                f"Printed in the {', '.join(str(y) for y in parsed['editions'])} atlas edition(s) as: {printed}."
                + (f" The {founding} in parentheses is read as the stated founding year." if founding is not None else "")
            ),
            "occupancy_uncertainty_note": clip(
                "Presence is attested only in the editions listed; absence from a later edition is not read as closure, "
                "and a first appearance is not a founding. The point's precision is unstated in the source."
            ),
        }
        places.append({"base": base, "checks": checks, "segments": [segment]})
    for coord, owners in coord_owner.items():
        if len(owners) > 1:
            for place in places:
                if place["base"]["source_locator"] in owners:
                    others = "; ".join(o for o in owners if o != place["base"]["source_locator"])
                    place["checks"].append(f"Shares its point (to 3 decimals) with {others} in the same source; check whether these are one place.")
    return places, report


# ---------------------------------------------------------------- writers

def import_rows(places: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Flatten places to one import row per period, with the place's row_number and content hash."""
    out: list[dict[str, Any]] = []
    for number, place in enumerate(places, start=1):
        for segment in place["segments"]:
            row = {"row_number": number, **place["base"], "import_checks": place["checks"], **segment}
            out.append(row)
    hashes: dict[int, str] = {}
    for row in out:
        hashes.setdefault(row["row_number"], content_hash(row))
    for row in out:
        row["claim_hash"] = hashes[row["row_number"]]
    return out


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_COLUMNS, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow({**row, "import_checks": " | ".join(row["import_checks"])})


def run_payload(batch_id: str, source: dict[str, Any], rows: list[dict[str, Any]]) -> dict[str, Any]:
    def json_row(row: dict[str, Any]) -> dict[str, Any]:
        out: dict[str, Any] = {}
        for key, value in row.items():
            if key in {"import_checks"}:
                if value:
                    out[key] = list(value)
                continue
            if value is None or value == "":
                continue
            if key in {"row_number", "segment_index", "uncertainty_radius_m"}:
                out[key] = int(value)
            elif key in {"lat", "lng", "latitude", "longitude"}:
                out[key] = float(value)
            else:
                out[key] = str(value)
        return out

    return {
        "actor_email": SERVICE_ACTOR_EMAIL,
        "batchId": batch_id,
        "countryCode": COUNTRY,
        "targetYears": TARGET_YEARS,
        "source": source,
        "rows": [json_row(r) for r in rows],
    }


def write_runs(output_dir: Path, stem: str, batch_id: str, source: dict[str, Any], rows: list[dict[str, Any]], chunk_places: int) -> list[Path]:
    numbers = sorted({r["row_number"] for r in rows})
    paths: list[Path] = []
    for index, group in enumerate(chunked(numbers, chunk_places), start=1):
        subset = [r for r in rows if r["row_number"] in set(group)]
        path = output_dir / f"run-{stem}-{index:02d}.json"
        path.write_text(json.dumps(run_payload(batch_id, source, subset), ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        paths.append(path)
    return paths


def render_report(catholic: dict[str, Any], protestant: dict[str, Any], counts: dict[str, int], inputs: dict[str, str]) -> str:
    lines = [
        "# Woodberry Vanuatu station import — build report",
        "",
        f"Built {datetime.now().isoformat(timespec='seconds')} by scripts/build_vu_woodberry_import.py. Inputs verified by SHA-256:",
        "",
    ]
    lines += [f"- `{name}`: `{digest}`" for name, digest in inputs.items()]
    lines += [
        "",
        "## Counts",
        "",
        f"- Catholic stations in the source: {catholic['stations']}; imported as places: {counts['catholic_places']}; periods: {counts['catholic_periods']}.",
        f"- Protestant atlas rows in the source: {protestant['rows']}; imported as places: {counts['protestant_places']}; periods: {counts['protestant_periods']}.",
        "",
        "## Repairs (disclosed on the task as an import note)",
        "",
    ]
    lines += [f"- {r}" for r in catholic["repairs"]] or ["- none"]
    lines += ["", "## Exclusions", ""]
    lines += [f"- Catholic: {e}" for e in catholic["excluded"]]
    lines += [f"- Protestant: {e}" for e in protestant["excluded"]]
    lines += [f"- Protestant, unplaced: {e}" for e in protestant["unplaced"]]
    lines += ["", "## Stations whose period came from the directory attestation (no dated event)", ""]
    lines += [f"- {e}" for e in catholic["fallback_directory"]] or ["- none"]
    lines += ["", "## Irregular event sequences (read leniently; recorded on the task and in the period's uncertainty note)", ""]
    lines += [f"- {k}: {'; '.join(v)}" for k, v in catholic["anomalies"].items()] or ["- none"]
    lines += [
        "",
        "## Reading rules applied",
        "",
        "- Catholic open/close years are read as stated founding and closure (plan assumption, pending the compiler's confirmation); a close followed by an open in the same year is a status change at the same place, not a closure; `censored` is read as in use at the last observation with no end asserted (`end_mode: after`, basis `last_seen_only`).",
        "- Protestant presence is read from the atlas editions: start at the parenthesised founding year where one is printed (else first edition, `first_seen_only`), end `after` the last edition (`last_seen_only`); a gap between editions is not a closure.",
        f"- Every point is an approximate area, basis `map_placement`: Catholic radius 500 m, or 2 000 m where the compiler's note reads as a guess; Protestant radius 1 000 m, 2 000 m for two-decimal coordinates, 5 000 m where the note reads as a guess.",
        "- `culturally_sensitive: no` on every row: mission stations are church sites, not kastom sites (assumption for the reviewer to overturn per row).",
        "",
    ]
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--input-dir", default="~/GIT/pow-research/data/raw/vu_woodberry")
    parser.add_argument("--output-dir", default="~/GIT/pow-research/data/derived/vu_woodberry_import")
    parser.add_argument("--chunk-places", type=int, default=CHUNK_PLACES)
    args = parser.parse_args()
    input_dir = Path(args.input_dir).expanduser()
    output_dir = Path(args.output_dir).expanduser()
    output_dir.mkdir(parents=True, exist_ok=True)

    inputs: dict[str, str] = {}
    for name, expected in [(CATHOLIC_FILE, CATHOLIC_SHA256), (PROTESTANT_FILE, PROTESTANT_SHA256)]:
        digest = sha256_of(input_dir / name)
        if digest != expected:
            raise SystemExit(f"{name}: sha256 {digest} does not match the profiled file {expected}; re-profile before building")
        inputs[name] = digest

    catholic_places, catholic_report = build_catholic(load_rows(input_dir / CATHOLIC_FILE))
    protestant_places, protestant_report = build_protestant(load_rows(input_dir / PROTESTANT_FILE))
    catholic_rows = import_rows(catholic_places)
    protestant_rows = import_rows(protestant_places)

    write_csv(output_dir / "woodberry_catholic_stations_import.csv", catholic_rows)
    write_csv(output_dir / "woodberry_protestant_atlas_import.csv", protestant_rows)
    runs = write_runs(output_dir, "catholic", CATHOLIC_BATCH_ID, CATHOLIC_SOURCE, catholic_rows, args.chunk_places)
    runs += write_runs(output_dir, "protestant", PROTESTANT_BATCH_ID, PROTESTANT_SOURCE, protestant_rows, args.chunk_places)
    counts = {
        "catholic_places": len(catholic_places),
        "catholic_periods": len(catholic_rows),
        "protestant_places": len(protestant_places),
        "protestant_periods": len(protestant_rows),
    }
    (output_dir / "report.md").write_text(render_report(catholic_report, protestant_report, counts, inputs), encoding="utf-8")
    (output_dir / "manifest.json").write_text(json.dumps({"inputs": inputs, "counts": counts, "runs": [p.name for p in runs], "built": datetime.now().isoformat(timespec="seconds")}, indent=1) + "\n", encoding="utf-8")
    print(f"catholic: {counts['catholic_places']} places, {counts['catholic_periods']} periods; protestant: {counts['protestant_places']} places, {counts['protestant_periods']} periods")
    print(f"runs: {', '.join(p.name for p in runs)}")
    print(f"wrote {output_dir}")
    period_modes = Counter((r["start_mode"], r["end_mode"]) for r in catholic_rows + protestant_rows)
    print("period shapes:", dict(period_modes))


if __name__ == "__main__":
    main()
