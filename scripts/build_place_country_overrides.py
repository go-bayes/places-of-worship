#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["shapely>=2.0"]
# ///
"""Build the contributor-portal country overrides for the 1 September 2026 tiles.

The list requires the edition's exact place coordinates because tile coordinates
are quantised. The September input manifest identifies the places file by its
SHA-256 digest.
"""

import argparse
import hashlib
import json
import re
from pathlib import Path

from shapely import union_all
from shapely.geometry import shape

REPO = Path(__file__).resolve().parents[1]
BOUNDARY = Path("apps/regions/ps/data/ps_governorate_2017.geojson")
OUT = REPO / "apps/shared/data/place-country-overrides.json"
TILES_EDITION = "20260901"
INPUT_MANIFEST = REPO / f"tools/tiles-r2/manifests/input-stats-osm-edition-{TILES_EDITION}.json"
TILE_COUNTRY = "IL"
EXPECTED_IL_PLACES_20260901 = 3204
EXPECTED_OVERRIDE_KEYS_20260901 = 302


def exact_points(places, digest):
    points = {}
    count = 0
    for line in places:
        # hash each line as it is parsed, so the digest covers the bytes used
        digest.update(line)
        feature = json.loads(line)
        props = feature["properties"]
        if props.get("country_code") == TILE_COUNTRY:
            count += 1
            points[props["id"]] = shape(feature["geometry"])
    return points, count


def build_overrides(points):
    boundary_bytes = (REPO / BOUNDARY).read_bytes()
    boundary = union_all([shape(feature["geometry"]) for feature in json.loads(boundary_bytes)["features"]])
    ids = sorted(
        (place_id for place_id, point in points.items() if boundary.contains(point)),
        key=lambda place_id: (place_id[0], int(place_id[1:])),
    )
    document = {
        "schema_version": 1,
        "tiles_edition": TILES_EDITION,
        "note": "This list changes only the destination of the contributor-portal link and makes no claim about sovereignty.",
        "generated_by": "scripts/build_place_country_overrides.py",
        "rules": [{
            "portal_country": "ps",
            "tile_country": TILE_COUNTRY,
            "boundary": BOUNDARY.as_posix(),
            "boundary_sha256": hashlib.sha256(boundary_bytes).hexdigest(),
            "count": len(ids),
            "ids": ids,
        }],
    }
    compact_ids = json.dumps(ids, separators=(",", ":"))
    output = re.sub(r'("ids": )\[[^\]]*\]', lambda match: match[1] + compact_ids, json.dumps(document, indent=2))
    return output + "\n", len(ids)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--places", type=Path, required=True, help="September 2026 places.ndjson with exact coordinates")
    parser.add_argument("--check", action="store_true", help="compare with the saved file without writing")
    args = parser.parse_args()

    expected_digest = json.loads(INPUT_MANIFEST.read_bytes())["extract_hashes"]["places.ndjson"]
    digest = hashlib.sha256()
    try:
        with args.places.open("rb") as places:
            points, place_count = exact_points(places, digest)
    except (ValueError, KeyError):
        parser.exit(1, f"The places file is not readable as the {TILES_EDITION} edition's places file.\n")
    if digest.hexdigest() != expected_digest:
        parser.exit(1, f"The places file's SHA-256 does not match the {TILES_EDITION} input manifest.\n")
    if place_count != EXPECTED_IL_PLACES_20260901:
        parser.exit(1, f"Expected {EXPECTED_IL_PLACES_20260901} {TILE_COUNTRY} places, found {place_count}.\n")

    output, count = build_overrides(points)
    if count != EXPECTED_OVERRIDE_KEYS_20260901:
        parser.exit(1, f"Expected {EXPECTED_OVERRIDE_KEYS_20260901} distinct override keys, found {count}.\n")
    relative_out = OUT.relative_to(REPO)
    if args.check:
        if not OUT.exists() or OUT.read_bytes() != output.encode("utf-8"):
            parser.exit(1, f"{relative_out} differs from generated output ({count} keys).\n")
        print(f"checked {relative_out} ({count} keys)")
    else:
        OUT.write_text(output, encoding="utf-8")
        print(f"wrote {relative_out} ({count} keys)")


if __name__ == "__main__":
    main()
