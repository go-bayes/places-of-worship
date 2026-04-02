#!/usr/bin/env python3
"""
Build a manual review queue for ambiguous NZ place records.

The queue focuses on records that survived the conservative cleanup but still
have weak or generic metadata and therefore need human review.
"""

from __future__ import annotations

import csv
import json
import re
from collections import Counter
from pathlib import Path


REPO_ROOT = Path("/Users/joseph/GIT/places-of-worship")
INPUT_PATH = REPO_ROOT / "apps" / "regions" / "nz" / "data" / "nz_places.json"
OUTPUT_CSV = REPO_ROOT / "docs" / "nz-manual-review-queue.csv"
OUTPUT_MD = REPO_ROOT / "docs" / "nz-manual-review-queue.md"

PLACEHOLDER_PATTERN = re.compile(r"^Place of Worship \d+$")
GENERIC_LABEL_PATTERN = re.compile(
    r"^(Christian|Anglican|Roman_Catholic|Jewish|Sikh|Mormon|Methodist|Lutheran) Place of Worship$",
    re.IGNORECASE,
)
INSTITUTIONAL_PATTERN = re.compile(r"\b(academy|school|seminary|college)\b", re.IGNORECASE)
RETREAT_PATTERN = re.compile(r"\b(retreat|prayer|meditation)\b", re.IGNORECASE)
HALL_PATTERN = re.compile(r"\b(centre|center|hall|house|community)\b", re.IGNORECASE)

CATEGORY_ORDER = {
    "placeholder_name": 1,
    "generic_worship_label": 1,
    "institutional_site": 1,
    "retreat_or_prayer_site": 2,
    "hall_centre_house_site": 2,
    "missing_core_tags": 3,
}


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

    if weak and HALL_PATTERN.search(name):
        return "hall_centre_house_site", CATEGORY_ORDER["hall_centre_house_site"]

    if amenity is None and building is None:
        return "missing_core_tags", CATEGORY_ORDER["missing_core_tags"]

    return None


def build_queue(records: list[dict]) -> list[dict]:
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
                "id": record.get("id", ""),
                "name": record.get("name", ""),
                "religion": record.get("religion", ""),
                "denomination": record.get("denomination", ""),
                "address": record.get("address", ""),
                "amenity": tags.get("amenity", ""),
                "building": tags.get("building", ""),
                "country_code": record.get("country_code", ""),
                "lat": record.get("lat", ""),
                "lng": record.get("lng", ""),
                "tags_raw": json.dumps(tags, ensure_ascii=False, sort_keys=True),
            }
        )

    queue.sort(key=lambda row: (row["priority"], row["category"], row["name"], row["id"]))
    return queue


def write_csv(queue: list[dict]) -> None:
    fieldnames = [
        "priority",
        "category",
        "id",
        "name",
        "religion",
        "denomination",
        "address",
        "amenity",
        "building",
        "country_code",
        "lat",
        "lng",
        "tags_raw",
    ]

    with OUTPUT_CSV.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(queue)


def first_examples(queue: list[dict], limit: int = 8) -> dict[str, list[str]]:
    grouped: dict[str, list[str]] = {}

    for row in queue:
        bucket = grouped.setdefault(row["category"], [])
        if len(bucket) >= limit:
            continue
        bucket.append(f"`{row['name']}` ({row['id']})")

    return grouped


def write_markdown(queue: list[dict], total_records: int) -> None:
    category_counts = Counter(row["category"] for row in queue)
    priority_counts = Counter(row["priority"] for row in queue)
    examples = first_examples(queue)

    lines = [
        "# NZ Manual Review Queue",
        "",
        "## Scope",
        "",
        "This queue lists ambiguous NZ records that survived the conservative cleanup pass and still need human review.",
        "",
        f"Source file: `{INPUT_PATH.relative_to(REPO_ROOT)}`",
        "",
        "## Summary",
        "",
        f"- current NZ dataset size: {total_records}",
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

    lines.extend(
        [
            "",
            "## Suggested review order",
            "",
            "- Start with priority 1: placeholder names, generic worship labels, and institutional sites.",
            "- Continue with priority 2: retreat, prayer, centre, hall, house, and community-labelled sites.",
            "- Leave priority 3 for last: records with both `amenity` and `building` missing.",
            "",
            "## Example records",
            "",
        ]
    )

    for category in sorted(examples, key=lambda key: (CATEGORY_ORDER[key], key)):
        lines.append(f"### {category}")
        lines.append("")
        for example in examples[category]:
            lines.append(f"- {example}")
        lines.append("")

    lines.extend(
        [
            "## Files",
            "",
            f"- detailed queue CSV: `{OUTPUT_CSV.relative_to(REPO_ROOT)}`",
            "",
        ]
    )

    OUTPUT_MD.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    records = json.loads(INPUT_PATH.read_text())
    queue = build_queue(records)
    write_csv(queue)
    write_markdown(queue, total_records=len(records))
    print(f"Wrote {len(queue)} review rows to {OUTPUT_CSV}")
    print(f"Wrote summary to {OUTPUT_MD}")


if __name__ == "__main__":
    main()
