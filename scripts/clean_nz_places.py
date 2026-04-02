#!/usr/bin/env python3
"""
Remove obvious non-worship records from the committed NZ places datasets.

This is intentionally conservative: it removes records that are clearly not
places of worship, while leaving ambiguous cases for later manual review.
"""

import json
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


def is_nz_coordinate(lat: float, lng: float) -> bool:
    if lat is None or lng is None:
        return False

    if not (-53 <= lat <= -28):
        return False

    return (166 <= lng <= 180) or (-180 <= lng <= -175)


def keep_record(record: dict) -> bool:
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
        filtered = [record for record in records if keep_record(record)]
        removed = len(records) - len(filtered)

        path.write_text(json.dumps(filtered, indent=2, ensure_ascii=False))
        print(f"{path}: kept {len(filtered)} / {len(records)} (removed {removed})")


if __name__ == "__main__":
    main()
