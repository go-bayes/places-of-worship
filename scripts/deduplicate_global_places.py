#!/usr/bin/env python3
"""
Deduplicate cleaned global country datasets conservatively.

This stage is intentionally strict. It only collapses records that are very
likely to be duplicate source representations of the same place of worship. It
does not merge distinct congregations that happen to share an address or site.
"""

from __future__ import annotations

import json
import math
import re
import sys
from datetime import UTC, datetime
from pathlib import Path


REPO_ROOT = Path("/Users/joseph/GIT/places-of-worship")

NAME_STOPWORDS = {
    "a",
    "an",
    "and",
    "at",
    "church",
    "churches",
    "of",
    "place",
    "saint",
    "st",
    "the",
    "worship",
}

SOURCE_LAYER_PRIORITY = {
    "osm_multipolygons": 4,
    "osm_polygons": 3,
    "osm_points": 2,
    None: 1,
    "": 1,
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


def canonical_name(name: str) -> str:
    cleaned = (name or "").lower()
    cleaned = cleaned.replace("st ", "saint ")
    cleaned = re.sub(r"[^a-z0-9 ]+", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def name_tokens(name: str) -> set[str]:
    tokens = set(re.findall(r"[a-z0-9]+", canonical_name(name)))
    return tokens - NAME_STOPWORDS


def canonical_address(address: str) -> str:
    cleaned = (address or "").lower().strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned


def tag_count(record: dict) -> int:
    tags = record.get("tags_raw") or {}
    return len([key for key, value in tags.items() if value not in (None, "")])


def record_score(record: dict) -> tuple:
    tags = record.get("tags_raw") or {}
    return (
        SOURCE_LAYER_PRIORITY.get(record.get("source_layer"), 1),
        1 if tags.get("amenity") == "place_of_worship" else 0,
        1 if record.get("name") not in ("", "Unnamed Place of Worship", None) else 0,
        tag_count(record),
        record.get("confidence") or 0,
    )


def names_match(left: dict, right: dict) -> bool:
    left_name = canonical_name(left.get("name") or "")
    right_name = canonical_name(right.get("name") or "")

    if not left_name or not right_name:
        return False

    if left_name == right_name:
        return True

    left_tokens = name_tokens(left_name)
    right_tokens = name_tokens(right_name)

    if not left_tokens or not right_tokens:
        return False

    return left_tokens == right_tokens and len(left_tokens) >= 2


def compatible_religion(left: dict, right: dict) -> bool:
    left_religion = (left.get("religion") or "").lower()
    right_religion = (right.get("religion") or "").lower()
    left_denomination = (left.get("denomination") or "").lower()
    right_denomination = (right.get("denomination") or "").lower()

    if left_religion and right_religion and left_religion != right_religion:
        return False

    if (
        left_denomination
        and right_denomination
        and left_denomination != right_denomination
    ):
        return False

    return True


def is_duplicate(left: dict, right: dict) -> bool:
    if left.get("id") == right.get("id"):
        return False

    if not names_match(left, right):
        return False

    if not compatible_religion(left, right):
        return False

    left_lat = as_float(left.get("lat"))
    left_lng = as_float(left.get("lng"))
    right_lat = as_float(right.get("lat"))
    right_lng = as_float(right.get("lng"))

    if None in (left_lat, left_lng, right_lat, right_lng):
        return False

    distance = haversine_distance_metres(left_lat, left_lng, right_lat, right_lng)
    if distance > 25:
        return False

    left_address = canonical_address(left.get("address") or "")
    right_address = canonical_address(right.get("address") or "")

    if left_address and right_address and left_address != right_address:
        return False

    return True


def deduplicate_records(records: list[dict]) -> tuple[list[dict], list[dict]]:
    kept_records: list[dict] = []
    resolutions: list[dict] = []

    for record in sorted(records, key=record_score, reverse=True):
        duplicate_of = None

        for kept in kept_records:
            if is_duplicate(record, kept):
                duplicate_of = kept
                break

        if duplicate_of is None:
            kept_records.append(record)
            continue

        left_lat = as_float(record.get("lat"))
        left_lng = as_float(record.get("lng"))
        right_lat = as_float(duplicate_of.get("lat"))
        right_lng = as_float(duplicate_of.get("lng"))

        resolutions.append(
            {
                "dropped_id": record.get("id"),
                "kept_id": duplicate_of.get("id"),
                "dropped_name": record.get("name"),
                "kept_name": duplicate_of.get("name"),
                "distance_metres": round(
                    haversine_distance_metres(left_lat, left_lng, right_lat, right_lng),
                    2,
                ),
                "reason": "same_name_same_religion_close_location",
            }
        )

    kept_records.sort(key=lambda row: row.get("id") or "")
    return kept_records, resolutions


def latest_snapshot_dir() -> Path:
    base_dir = REPO_ROOT / "data" / "intermediate" / "global"
    snapshot_dirs = [path for path in base_dir.iterdir() if path.is_dir()]
    if not snapshot_dirs:
        raise FileNotFoundError(f"No snapshot directories found under {base_dir}")
    return sorted(snapshot_dirs)[-1]


def iter_cleaned_files(input_path: Path) -> list[Path]:
    if input_path.is_file():
        return [input_path]

    return sorted(input_path.glob("*_places_cleaned.json"))


def deduplicate_file(input_file: Path, output_dir: Path, overwrite: bool) -> dict:
    country_code = input_file.name.replace("_places_cleaned.json", "").upper()
    output_file = output_dir / input_file.name.replace("_cleaned", "_deduplicated")
    resolution_file = output_dir / input_file.name.replace(
        "_places_cleaned.json",
        "_duplicate_resolutions.json",
    )

    if output_file.exists() and not overwrite:
        return {
            "country_code": country_code,
            "output_file": str(output_file.relative_to(REPO_ROOT)),
            "skipped": True,
        }

    records = json.loads(input_file.read_text(encoding="utf-8"))
    deduplicated_records, resolutions = deduplicate_records(records)

    output_file.write_text(
        json.dumps(deduplicated_records, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    resolution_file.write_text(
        json.dumps(resolutions, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    return {
        "country_code": country_code,
        "output_file": str(output_file.relative_to(REPO_ROOT)),
        "resolution_file": str(resolution_file.relative_to(REPO_ROOT)),
        "skipped": False,
        "input_count": len(records),
        "output_count": len(deduplicated_records),
        "removed_count": len(resolutions),
    }


def main() -> None:
    args = sys.argv[1:]
    overwrite = "--overwrite" in args or "--force" in args
    positional = [arg for arg in args if not arg.startswith("--")]
    input_path = Path(positional[0]) if positional else latest_snapshot_dir()
    if not input_path.is_absolute():
        input_path = (REPO_ROOT / input_path).resolve()

    input_files = iter_cleaned_files(input_path)
    if not input_files:
        raise FileNotFoundError(f"No cleaned files found under {input_path}")

    snapshot_name = input_path.name if input_path.is_dir() else input_path.parent.name
    output_dir = REPO_ROOT / "data" / "intermediate" / "global" / snapshot_name
    output_dir.mkdir(parents=True, exist_ok=True)

    results = [
        deduplicate_file(input_file, output_dir, overwrite)
        for input_file in input_files
    ]

    manifest = {
        "generated_at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "script": "scripts/deduplicate_global_places.py",
        "input_path": str(input_path.relative_to(REPO_ROOT)),
        "countries": results,
    }

    manifest_path = output_dir / "deduplication_manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Wrote deduplication manifest: {manifest_path}")


if __name__ == "__main__":
    main()
