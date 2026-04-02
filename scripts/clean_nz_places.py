#!/usr/bin/env python3
"""
Remove obvious non-worship records from the committed NZ places datasets.

This is intentionally conservative: it removes records that are clearly not
places of worship, while leaving ambiguous cases for later manual review.
"""

import json
import math
import re
from pathlib import Path


REPO_ROOT = Path("/Users/joseph/GIT/places-of-worship")
TARGET_FILES = [
    REPO_ROOT / "data" / "global" / "nz_places.json",
    REPO_ROOT / "apps" / "regions" / "nz" / "data" / "nz_places.json",
]

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
GENERIC_HALL_PATTERN = re.compile(
    r"\bhall\b",
    re.IGNORECASE,
)
GENUINE_HALL_NAME_PATTERN = re.compile(
    r"\b(kingdom hall|gospel hall|mission hall|assembly hall|church of christ hall|christadelphian hall)\b",
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
    "saint",
    "salvation",
    "site",
    "sites",
    "st",
    "the",
    "worship",
}


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

    if not SUPPORT_BUILDING_PATTERN.search(name) and not hall_like_name:
        return False

    lat = record.get("lat")
    lng = record.get("lng")
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

        other_lat = other.get("lat")
        other_lng = other.get("lng")
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

        if not record_tokens and denomination_match:
            return True

    return False


def is_nz_coordinate(lat: float, lng: float) -> bool:
    if lat is None or lng is None:
        return False

    if not (-53 <= lat <= -28):
        return False

    return (166 <= lng <= 180) or (-180 <= lng <= -175)


def keep_record(record: dict, records: list[dict]) -> bool:
    tags = record.get("tags_raw") or {}
    amenity = tags.get("amenity")
    building = tags.get("building")
    name = record.get("name") or ""

    if record.get("country_code") != "NZ":
        return False

    if not is_nz_coordinate(record.get("lat"), record.get("lng")):
        return False

    if amenity in EXCLUDED_AMENITIES:
        return False

    if building in EXCLUDED_BUILDINGS:
        return False

    if EXCLUDED_NAME_PATTERN.search(name):
        return False

    # Remove low-information placeholders that have no supporting OSM tags at all.
    if PLACEHOLDER_NAME_PATTERN.search(name) and not tags:
        return False

    # Remove generic worship labels when the record lacks both amenity and building support.
    if GENERIC_WORSHIP_LABEL_PATTERN.search(name) and amenity is None and building is None:
        return False

    if NON_WORSHIP_CENTRE_PATTERN.search(name):
        return False

    if NON_WORSHIP_HALL_PATTERN.search(name):
        return False

    if is_support_building_duplicate(record, records):
        return False

    # Exclude school-like and seminary-like institutional sites unless a worship
    # space is separately mapped as a chapel or explicit place_of_worship.
    if INSTITUTIONAL_NAME_PATTERN.search(name):
        chapel_like = "chapel" in name.lower() or building == "chapel"
        explicit_worship_space = amenity == "place_of_worship"
        if not chapel_like and not explicit_worship_space:
            return False

    return True


def main() -> None:
    for path in TARGET_FILES:
        records = json.loads(path.read_text())
        filtered = [record for record in records if keep_record(record, records)]
        removed = len(records) - len(filtered)

        path.write_text(json.dumps(filtered, indent=2, ensure_ascii=False))
        print(f"{path}: kept {len(filtered)} / {len(records)} (removed {removed})")


if __name__ == "__main__":
    main()
