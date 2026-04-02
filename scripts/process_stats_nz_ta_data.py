#!/usr/bin/env python3
"""
Process official Stats NZ territorial authority religious affiliation data.

This script aligns TA names to the official TA2025 codes in
apps/regions/nz/data/territorial_authorities.geojson and writes a JSON payload
that matches the NZ app's current expectations.
"""

import csv
import json
import re
import unicodedata
from pathlib import Path


REPO_ROOT = Path("/Users/joseph/GIT/places-of-worship")
BOUNDARY_PATH = REPO_ROOT / "apps" / "regions" / "nz" / "data" / "territorial_authorities.geojson"
CSV_PATH = REPO_ROOT / "archive" / "stats_nz_religious_affiliation_by_ta.csv"
OUTPUT_PATH = REPO_ROOT / "ta_aggregated_data_real.json"


def normalise_ta_name(value: str) -> str:
    value = unicodedata.normalize("NFKD", value or "").encode("ascii", "ignore").decode("ascii")
    value = value.lower().replace("’", "'")
    value = re.sub(r"\b(district|city|territory|council)\b", "", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def load_ta_lookup(path: Path) -> dict[str, tuple[str, str]]:
    boundary_geojson = json.loads(path.read_text())
    lookup = {}

    for feature in boundary_geojson["features"]:
        properties = feature["properties"]
        name = properties["TA2025_NAME"]
        lookup[normalise_ta_name(name)] = (properties["TA2025_V1"], name)

    return lookup


def blank_year(name: str) -> dict[str, int | str]:
    return {
        "name": name,
        "Total": 0,
        "Total stated": 0,
        "Christian": 0,
        "No religion": 0,
        "Buddhism": 0,
        "Hinduism": 0,
        "Islam": 0,
        "Judaism": 0,
        "Māori Christian": 0,
        "Maori religions, beliefs, and philosophies": 0,
        "Other religion": 0,
        "Other religions, beliefs, and philosophies": 0,
        "Spiritualism and New Age religions": 0,
    }


def process_stats_nz_ta_data(csv_file_path: Path, output_path: Path) -> Path:
    print(f"Loading Stats NZ data from: {csv_file_path}")
    ta_lookup = load_ta_lookup(BOUNDARY_PATH)

    ta_data: dict[str, dict[str, dict[str, int]]] = {}

    with csv_file_path.open("r", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)

        for row in reader:
            if row["Unit"] != "Count":
                continue

            if row["Territorial authority"] in {"New Zealand", "Area Outside Territorial Authority"}:
                continue

            year = row["Census Year"]
            if year not in {"2013", "2018", "2023"}:
                continue

            ta_name_raw = row["Territorial authority Code"] or row["Territorial authority"]
            ta_name_key = normalise_ta_name(ta_name_raw)

            if ta_name_key not in ta_lookup:
                raise ValueError(f"Unmatched territorial authority: {ta_name_raw}")

            ta_code, ta_name = ta_lookup[ta_name_key]
            religion = row["Religious affiliation"]
            count = int(float(row["Value"]))

            ta_year = ta_data.setdefault(ta_code, {}).setdefault(year, blank_year(ta_name))

            if religion in {"Total people", "Total people stated"}:
                ta_year["Total"] = count
                ta_year["Total stated"] = count
            elif religion == "Christianity":
                ta_year["Christian"] = count
            elif religion == "No religion":
                ta_year["No religion"] = count
            elif religion == "Buddhism":
                ta_year["Buddhism"] = count
            elif religion == "Hinduism":
                ta_year["Hinduism"] = count
            elif religion == "Islam":
                ta_year["Islam"] = count
            elif religion == "Judaism":
                ta_year["Judaism"] = count
            elif religion.startswith("Māori religions, beliefs and philosophies"):
                ta_year["Māori Christian"] += count
                ta_year["Maori religions, beliefs, and philosophies"] += count
            elif religion.startswith("Other Religions, Beliefs and Philosophies"):
                ta_year["Other religion"] += count
                ta_year["Other religions, beliefs, and philosophies"] += count
            elif religion.startswith("Spiritual"):
                ta_year["Other religion"] += count
                ta_year["Other religions, beliefs, and philosophies"] += count
                ta_year["Spiritualism and New Age religions"] += count

    coded_ta_data = {}
    for ta_code, year_data in sorted(ta_data.items()):
        ta_name = next(iter(year_data.values()))["name"]
        coded_ta_data[ta_code] = {
            "name": ta_name,
            "2006": blank_year(ta_name),
            "2013": year_data.get("2013", blank_year(ta_name)),
            "2018": year_data.get("2018", blank_year(ta_name)),
            "2023": year_data.get("2023", blank_year(ta_name)),
        }

    print(f"Saving processed data to: {output_path}")
    output_path.write_text(json.dumps(coded_ta_data, indent=2, ensure_ascii=False))
    print(f"Processed {len(coded_ta_data)} territorial authorities")
    return output_path


def main() -> None:
    if not CSV_PATH.exists():
        raise FileNotFoundError(f"CSV file not found: {CSV_PATH}")

    process_stats_nz_ta_data(CSV_PATH, OUTPUT_PATH)
    print(f"Output saved to: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
