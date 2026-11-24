#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["mapbox-vector-tile", "pmtiles", "shapely>=2.0"]
# ///
"""Build the September 2026 contributor-portal country overrides.

Use --places with exact edition coordinates when tile quantisation changes
which side of the governorate boundary a point falls on. Use --check with
the same input to verify that the saved file is up to date.
"""

import argparse
import gzip
import hashlib
import json
import math
import re
from pathlib import Path

from mapbox_vector_tile import decode
from pmtiles.reader import Compression, MmapSource, Reader, all_tiles
from shapely import Point, union_all
from shapely.geometry import shape

REPO = Path(__file__).resolve().parents[1]
BOUNDARY = Path("apps/regions/ps/data/ps_governorate_2017.geojson")
OUT = REPO / "apps/shared/data/place-country-overrides.json"
TILES_EDITION = "20260901"
TILE_COUNTRY = "IL"
EXPECTED_TILE_COUNTRY_COUNT = 3204


def archive_points(archive):
    points = {}
    with archive.open("rb") as handle:
        source = MmapSource(handle)
        header = Reader(source).header()
        for (zoom, tile_x, tile_y), data in all_tiles(source):
            if zoom != header["max_zoom"]:
                continue
            if header["tile_compression"] == Compression.GZIP:
                data = gzip.decompress(data)
            tiles_across = 1 << zoom
            for layer in decode(data, default_options={"y_coord_down": True}).values():
                extent = layer["extent"]
                for feature in layer["features"]:
                    props = feature["properties"]
                    if props.get("country_code") != TILE_COUNTRY or props["id"] in points:
                        continue
                    x, y = feature["geometry"]["coordinates"]
                    lng = (tile_x + x / extent) / tiles_across * 360 - 180
                    mercator_y = math.pi * (1 - 2 * (tile_y + y / extent) / tiles_across)
                    lat = math.degrees(math.atan(math.sinh(mercator_y)))
                    points[props["id"]] = Point(lng, lat)
    return points


def exact_points(places):
    points = {}
    with places.open(encoding="utf-8") as handle:
        for line in handle:
            feature = json.loads(line)
            props = feature["properties"]
            if props.get("country_code") == TILE_COUNTRY:
                points[props["id"]] = shape(feature["geometry"])
    return points


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
    parser.add_argument("--archive", type=Path, required=True, help="September 2026 IL PMTiles archive")
    parser.add_argument("--places", type=Path, help="GeoJSON Features, one exact point per line, preferred over the archive")
    parser.add_argument("--check", action="store_true", help="compare with the saved file without writing")
    args = parser.parse_args()

    points = exact_points(args.places) if args.places else archive_points(args.archive)
    if len(points) != EXPECTED_TILE_COUNTRY_COUNT:
        source = "the exact points" if args.places else "the archive's highest zoom (try --places)"
        parser.exit(1, f"Expected {EXPECTED_TILE_COUNTRY_COUNT} {TILE_COUNTRY} places, found {len(points)} in {source}.\n")

    output, count = build_overrides(points)
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
