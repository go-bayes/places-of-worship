#!/usr/bin/env python3
"""
Build machine-readable and human-readable review queues for cleaned global
country datasets.
"""

from __future__ import annotations

import csv
import json
import re
import sys
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path


REPO_ROOT = Path("/Users/joseph/GIT/places-of-worship")

PLACEHOLDER_PATTERN = re.compile(r"^Place of Worship \d+$")
GENERIC_LABEL_PATTERN = re.compile(
    r"^(Christian|Anglican|Roman_Catholic|Jewish|Sikh|Mormon|Methodist|Lutheran) Place of Worship$",
    re.IGNORECASE,
)
INSTITUTIONAL_PATTERN = re.compile(r"\b(academy|school|seminary|college)\b", re.IGNORECASE)
RETREAT_PATTERN = re.compile(r"\b(retreat|prayer|meditation)\b", re.IGNORECASE)
HALL_CENTRE_HOUSE_PATTERN = re.compile(r"\b(centre|center|hall|house|community)\b", re.IGNORECASE)

CATEGORY_ORDER = {
    "placeholder_name": 1,
    "generic_worship_label": 1,
    "institutional_site": 1,
    "retreat_or_prayer_site": 2,
    "hall_centre_house_site": 2,
    "missing_core_tags": 3,
}


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


def is_weak_tag_record(record: dict) -> bool:
    tags = record.get("tags_raw") or {}
    return tags.get("amenity") in (None, "place_of_worship") and tags.get("building") in (None, "yes")


def classify_record(record: dict) -> tuple[str, int] | None:
    tags = record.get("tags_raw") or {}
    amenity = tags.get("amenity")
    building = tags.get("building")
    name = record.get("name") or ""

    weak = is_weak_tag_record(record)

    if weak and PLACEHOLDER_PATTERN.search(name):
        return "placeholder_name", CATEGORY_ORDER["placeholder_name"]

    if weak and GENERIC_LABEL_PATTERN.search(name):
        return "generic_worship_label", CATEGORY_ORDER["generic_worship_label"]

    if INSTITUTIONAL_PATTERN.search(name):
        return "institutional_site", CATEGORY_ORDER["institutional_site"]

    if RETREAT_PATTERN.search(name):
        return "retreat_or_prayer_site", CATEGORY_ORDER["retreat_or_prayer_site"]

    if weak and HALL_CENTRE_HOUSE_PATTERN.search(name):
        return "hall_centre_house_site", CATEGORY_ORDER["hall_centre_house_site"]

    if amenity is None and building is None:
        return "missing_core_tags", CATEGORY_ORDER["missing_core_tags"]

    return None


def build_queue(records: list[dict], country_code: str) -> list[dict]:
    queue = []

    for record in records:
        classification = classify_record(record)
        if classification is None:
            continue

        category, priority = classification
        tags = record.get("tags_raw") or {}

        queue.append(
            {
                "priority": priority,
                "category": category,
                "country_code": country_code,
                "id": record.get("id", ""),
                "name": record.get("name", ""),
                "religion": record.get("religion", ""),
                "denomination": record.get("denomination", ""),
                "address": record.get("address", ""),
                "amenity": tags.get("amenity", ""),
                "building": tags.get("building", ""),
                "lat": record.get("lat", ""),
                "lng": record.get("lng", ""),
                "tags_raw": json.dumps(tags, ensure_ascii=False, sort_keys=True),
            }
        )

    queue.sort(key=lambda row: (row["priority"], row["category"], row["name"], row["id"]))
    return queue


def write_country_queue(cleaned_file: Path, output_dir: Path) -> dict:
    country_code = cleaned_file.name.replace("_places_cleaned.json", "").upper()
    records = json.loads(cleaned_file.read_text(encoding="utf-8"))
    queue = build_queue(records, country_code)

    csv_path = output_dir / f"{country_code.lower()}_review_queue.csv"
    md_path = output_dir / f"{country_code.lower()}_review_queue.md"

    fieldnames = [
        "priority",
        "category",
        "country_code",
        "id",
        "name",
        "religion",
        "denomination",
        "address",
        "amenity",
        "building",
        "lat",
        "lng",
        "tags_raw",
    ]

    with csv_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(queue)

    category_counts = Counter(row["category"] for row in queue)
    priority_counts = Counter(row["priority"] for row in queue)
    lines = [
        f"# {country_code} Review Queue",
        "",
        f"- cleaned dataset size: {len(records)}",
        f"- queued for manual review: {len(queue)}",
        f"- priority 1 records: {priority_counts.get(1, 0)}",
        f"- priority 2 records: {priority_counts.get(2, 0)}",
        f"- priority 3 records: {priority_counts.get(3, 0)}",
        "",
        "## Categories",
        "",
    ]

    for category in sorted(category_counts, key=lambda key: (CATEGORY_ORDER[key], key)):
        lines.append(f"- `{category}`: {category_counts[category]}")

    md_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    return {
        "country_code": country_code,
        "cleaned_file": str(cleaned_file.relative_to(REPO_ROOT)),
        "csv_path": str(csv_path.relative_to(REPO_ROOT)),
        "md_path": str(md_path.relative_to(REPO_ROOT)),
        "cleaned_count": len(records),
        "review_count": len(queue),
    }


def main() -> None:
    args = sys.argv[1:]
    positional = [arg for arg in args if not arg.startswith("--")]
    input_path = Path(positional[0]) if positional else latest_snapshot_dir()
    if not input_path.is_absolute():
        input_path = (REPO_ROOT / input_path).resolve()

    cleaned_files = iter_cleaned_files(input_path)
    if not cleaned_files:
        raise FileNotFoundError(f"No cleaned files found under {input_path}")

    snapshot_name = input_path.name if input_path.is_dir() else input_path.parent.name
    output_dir = REPO_ROOT / "docs" / "review_queues" / snapshot_name
    output_dir.mkdir(parents=True, exist_ok=True)

    results = [write_country_queue(cleaned_file, output_dir) for cleaned_file in cleaned_files]

    manifest = {
        "generated_at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "script": "scripts/build_global_review_queue.py",
        "input_path": str(input_path.relative_to(REPO_ROOT)),
        "countries": results,
    }

    manifest_path = output_dir / "review_queue_manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Wrote review queue manifest: {manifest_path}")


if __name__ == "__main__":
    main()
