#!/usr/bin/env python3
"""
Remove obvious non-worship records from normalized global country datasets.

This is intentionally conservative. It applies shared rule-based exclusions and
duplicate-support-building checks, while leaving ambiguous cases for review.
"""

from __future__ import annotations

import json
import math
import re
import sys
from datetime import UTC, datetime
from pathlib import Path


REPO_ROOT = Path("/Users/joseph/GIT/places-of-worship")
DEFAULT_INPUT_DIR = REPO_ROOT / "data" / "intermediate" / "global" / "undated"

EXCLUDED_AMENITIES = {
    "childcare",
    "school",
    "hospital",
    "social_facility",
    "college",
    "university",
    "kindergarten",
    "community_centre",
    "events_venue",
    "library",
    "pub",
    "grave_yard",
    "parking",
}
EXCLUDED_BUILDINGS = {"school"}
EXCLUDED_NAME_PATTERN = re.compile(
    r"\b(cemetery|burial|urupa|office|residence|pub|kindergarten)\b",
    re.IGNORECASE,
)
PLACEHOLDER_NAME_PATTERN = re.compile(r"^Place of Worship \d+$")
GENERIC_WORSHIP_LABEL_PATTERN = re.compile(
    r"^(Christian|Anglican|Roman_Catholic|Jewish|Sikh|Mormon|Methodist|Lutheran) Place of Worship$",
    re.IGNORECASE,
)
INSTITUTIONAL_NAME_PATTERN = re.compile(
    r"\b(school|academy|seminary|college)\b",
    re.IGNORECASE,
)
NON_WORSHIP_CENTRE_PATTERN = re.compile(
    r"\bmasonic centre\b",
    re.IGNORECASE,
)
NON_WORSHIP_HALL_PATTERN = re.compile(
    r"\bmasonic hall\b",
    re.IGNORECASE,
)
SUPPORT_BUILDING_PATTERN = re.compile(
    r"\b(church hall|parish centre|community centre)\b",
    re.IGNORECASE,
)
GENERIC_HALL_PATTERN = re.compile(r"\bhall\b", re.IGNORECASE)
GENERIC_CENTRE_PATTERN = re.compile(r"\bcentre\b", re.IGNORECASE)
GENERIC_HOUSE_PATTERN = re.compile(r"\bhouse\b", re.IGNORECASE)
GENUINE_HALL_NAME_PATTERN = re.compile(
    r"\b(kingdom hall|gospel hall|mission hall|assembly hall|church of christ hall|christadelphian hall)\b",
    re.IGNORECASE,
)
GENUINE_CENTRE_NAME_PATTERN = re.compile(
    r"\b(church|christian|islamic|baha'i|bahai|bahá'í|worship|life|gospel|masjid|mosque|faith|revival|outreach|breakthrough|hope|buddhist|temple|celebration|family|heritage|mission|charity)\b",
    re.IGNORECASE,
)
GENUINE_HOUSE_NAME_PATTERN = re.compile(
    r"\b(house of|church|worship|masjid|mosque|temple|faith|hope|grace|bread|breakthrough)\b",
    re.IGNORECASE,
)
PRIMARY_WORSHIP_NAME_PATTERN = re.compile(
    r"\b(church|cathedral|chapel|temple|mosque|synagogue|gurdwara)\b",
    re.IGNORECASE,
)
GENERIC_NAME_TOKENS = {
    "and",
    "anglican",
    "apostolic",
    "assembly",
    "assemblies",
    "baptist",
    "catholic",
    "centre",
    "centres",
    "christian",
    "church",
    "churches",
    "community",
    "corps",
    "hall",
    "house",
    "houses",
    "methodist",
    "parish",
    "place",
    "presbyterian",
    "roman",
    "saint",
    "salvation",
    "site",
    "sites",
    "st",
    "the",
    "worship",
    "youth",
}


def as_float(value: object) -> float | None:
    if value in (None, ""):
        return None

    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def haversine_distance_metres(
    lat_1: float,
    lng_1: float,
    lat_2: float,
    lng_2: float,
) -> float:
    lat_1_rad, lng_1_rad, lat_2_rad, lng_2_rad = map(
        math.radians,
        [lat_1, lng_1, lat_2, lng_2],
    )
    delta_lat = lat_2_rad - lat_1_rad
    delta_lng = lng_2_rad - lng_1_rad
    haversine = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat_1_rad) * math.cos(lat_2_rad) * math.sin(delta_lng / 2) ** 2
    )
    return 6371000 * 2 * math.asin(math.sqrt(haversine))


def normalise_name_tokens(name: str) -> set[str]:
    normalised = name.lower().replace("st ", "saint ")
    tokens = set(re.findall(r"[a-z]+", normalised))
    return tokens - GENERIC_NAME_TOKENS


def is_support_building_duplicate(record: dict, records: list[dict]) -> bool:
    name = record.get("name") or ""
    hall_like_name = (
        GENERIC_HALL_PATTERN.search(name)
        and not GENUINE_HALL_NAME_PATTERN.search(name)
    )
    centre_like_name = (
        GENERIC_CENTRE_PATTERN.search(name)
        and not GENUINE_CENTRE_NAME_PATTERN.search(name)
    )
    house_like_name = (
        GENERIC_HOUSE_PATTERN.search(name)
        and not GENUINE_HOUSE_NAME_PATTERN.search(name)
    )

    if (
        not SUPPORT_BUILDING_PATTERN.search(name)
        and not hall_like_name
        and not centre_like_name
        and not house_like_name
    ):
        return False

    lat = as_float(record.get("lat"))
    lng = as_float(record.get("lng"))
    if lat is None or lng is None:
        return False

    record_tokens = normalise_name_tokens(name)
    denomination = record.get("denomination") or ""

    for other in records:
        if other.get("id") == record.get("id"):
            continue

        other_name = other.get("name") or ""
        if not PRIMARY_WORSHIP_NAME_PATTERN.search(other_name):
            continue

        other_lat = as_float(other.get("lat"))
        other_lng = as_float(other.get("lng"))
        if other_lat is None or other_lng is None:
            continue

        if haversine_distance_metres(lat, lng, other_lat, other_lng) > 100:
            continue

        other_tokens = normalise_name_tokens(other_name)
        shared_tokens = record_tokens & other_tokens
        denomination_match = (
            denomination != ""
            and denomination == (other.get("denomination") or "")
        )

        if len(shared_tokens) >= 1:
            return True

        if hall_like_name and denomination_match and len(record_tokens) <= 1:
            return True

        if centre_like_name and denomination_match and len(record_tokens) <= 1:
            return True

        if house_like_name and denomination_match and len(record_tokens) <= 1:
            return True

        if not record_tokens and denomination_match:
            return True

    return False


def keep_record(record: dict, records: list[dict]) -> bool:
    tags = record.get("tags_raw") or {}
    amenity = tags.get("amenity")
    building = tags.get("building")
    name = record.get("name") or ""

    if amenity in EXCLUDED_AMENITIES:
        return False

    if building in EXCLUDED_BUILDINGS:
        return False

    if EXCLUDED_NAME_PATTERN.search(name):
        return False

    if PLACEHOLDER_NAME_PATTERN.search(name) and not tags:
        return False

    if GENERIC_WORSHIP_LABEL_PATTERN.search(name) and amenity is None and building is None:
        return False

    if NON_WORSHIP_CENTRE_PATTERN.search(name):
        return False

    if NON_WORSHIP_HALL_PATTERN.search(name):
        return False

    if is_support_building_duplicate(record, records):
        return False

    if INSTITUTIONAL_NAME_PATTERN.search(name):
        chapel_like = "chapel" in name.lower() or building == "chapel"
        explicit_worship_space = amenity == "place_of_worship"
        if not chapel_like and not explicit_worship_space:
            return False

    return True


def iter_input_files(input_path: Path) -> list[Path]:
    if input_path.is_file():
        return [input_path]

    return sorted(input_path.glob("*_places_normalized.json"))


def latest_snapshot_dir() -> Path:
    base_dir = REPO_ROOT / "data" / "intermediate" / "global"
    snapshot_dirs = [path for path in base_dir.iterdir() if path.is_dir()]
    if not snapshot_dirs:
        raise FileNotFoundError(f"No snapshot directories found under {base_dir}")
    return sorted(snapshot_dirs)[-1]


def clean_file(input_file: Path, output_dir: Path, overwrite: bool) -> dict:
    country_code = input_file.name.replace("_places_normalized.json", "").upper()
    output_file = output_dir / input_file.name.replace("_normalized", "_cleaned")

    if output_file.exists() and not overwrite:
        return {
            "country_code": country_code,
            "output_file": str(output_file.relative_to(REPO_ROOT)),
            "skipped": True,
        }

    records = json.loads(input_file.read_text(encoding="utf-8"))
    filtered_records = [record for record in records if keep_record(record, records)]

    output_file.write_text(
        json.dumps(filtered_records, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    return {
        "country_code": country_code,
        "output_file": str(output_file.relative_to(REPO_ROOT)),
        "skipped": False,
        "input_count": len(records),
        "output_count": len(filtered_records),
        "removed_count": len(records) - len(filtered_records),
    }


def main() -> None:
    args = sys.argv[1:]
    overwrite = "--overwrite" in args or "--force" in args
    positional = [arg for arg in args if not arg.startswith("--")]
    input_path = Path(positional[0]) if positional else latest_snapshot_dir()
    if not input_path.is_absolute():
        input_path = (REPO_ROOT / input_path).resolve()

    input_files = iter_input_files(input_path)
    if not input_files:
        raise FileNotFoundError(f"No normalized files found under {input_path}")

    snapshot_name = input_path.name if input_path.is_dir() else input_path.parent.name
    output_dir = REPO_ROOT / "data" / "intermediate" / "global" / snapshot_name
    output_dir.mkdir(parents=True, exist_ok=True)

    results = [clean_file(input_file, output_dir, overwrite) for input_file in input_files]

    manifest = {
        "generated_at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "script": "scripts/clean_global_places.py",
        "input_path": str(input_path.relative_to(REPO_ROOT)),
        "countries": results,
    }

    manifest_path = output_dir / "cleaning_manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Wrote cleaning manifest: {manifest_path}")


if __name__ == "__main__":
    main()
