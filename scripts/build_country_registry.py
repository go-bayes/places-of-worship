#!/usr/bin/env python3
"""Build the world country registry the portal and the shop front read.

Writes apps/shared/data/country-registry.json: one entry per country with
a project code, an ISO 3166-1 alpha-2 code, a name, a bounding box, a
camera (centre and zoom), and whether the country has a page under
apps/regions/. Inputs, in precedence order:

  1. apps/regions/_shared/data/region-bboxes.json — the page manifest
     (exact boundaries; name from the hub card). Wins on name and extent.
  2. Natural Earth 1:110m admin-0 countries — everything else. Cached in
     the scratch directory and downloaded when absent.

Boxes are [west, south, east, north]; west > east wraps the antimeridian,
as in the page manifest. Rerun when a country page launches.
"""
from __future__ import annotations

import json
import math
import os
import sys
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
PAGE_MANIFEST = REPO / "apps/regions/_shared/data/region-bboxes.json"
OUT = REPO / "apps/shared/data/country-registry.json"
# the same document as a classic script, so the portal (which computes its
# country config synchronously at load) can read it without a fetch
OUT_JS = REPO / "apps/shared/data/country-registry.js"
# the server's world intake bounds (convex/lib/rapidEntry.ts falls back to
# this table for countries outside its hand-ruled registry, jb r-h1)
OUT_TS = REPO / "convex/lib/countryRegistry.generated.ts"
NE_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson"
NE_CACHE = Path(os.environ.get("POW_SCRATCH", "/tmp")) / "ne_110m_admin_0_countries.geojson"

# the project's page codes where they differ from iso alpha-2
PROJECT_CODE_FOR_ISO = {"gb": "uk"}
ISO_FOR_PROJECT_CODE = {v: k for k, v in PROJECT_CODE_FOR_ISO.items()}


def load_ne():
    # download once; the file is 0.8 MB
    if not NE_CACHE.exists():
        NE_CACHE.parent.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(NE_URL, NE_CACHE)
    return json.loads(NE_CACHE.read_text(encoding="utf-8"))


def iter_lnglat(geometry):
    kind = geometry["type"]
    coords = geometry["coordinates"]
    polys = coords if kind == "MultiPolygon" else [coords]
    for poly in polys:
        for ring in poly:
            for lng, lat in ring:
                yield lng, lat


def bbox_of(geometry):
    # two candidate frames: as given, and with western longitudes shifted
    # by 360 so a country astride the antimeridian gets its narrow box;
    # the narrower frame wins and is written west > east when it wraps
    pts = list(iter_lnglat(geometry))
    lats = [lat for _, lat in pts]
    south, north = min(lats), max(lats)
    lngs = [lng for lng, _ in pts]
    plain = (min(lngs), max(lngs))
    shifted_lngs = [lng + 360 if lng < 0 else lng for lng in lngs]
    shifted = (min(shifted_lngs), max(shifted_lngs))
    if shifted[1] - shifted[0] < plain[1] - plain[0]:
        west = shifted[0] if shifted[0] <= 180 else shifted[0] - 360
        east = shifted[1] - 360 if shifted[1] > 180 else shifted[1]
        return [round(west, 4), round(south, 4), round(east, 4), round(north, 4)]
    return [round(plain[0], 4), round(south, 4), round(plain[1], 4), round(north, 4)]


def union_box(boxes):
    # the page manifest may split a country into several boxes (clusters);
    # take the box containing them all, in the frame that keeps it narrow
    if len(boxes) == 1:
        return [round(v, 4) for v in boxes[0]]
    south = min(b[1] for b in boxes)
    north = max(b[3] for b in boxes)
    edges = []
    for b in boxes:
        edges.append((b[0], b[2] if b[2] >= b[0] else b[2] + 360))
    plain_w = min(e[0] for e in edges)
    plain_e = max(e[1] for e in edges)
    shifted = [((w + 360) if w < 0 else w, (e + 360) if e < 0 else e) for w, e in edges]
    sw = min(s[0] for s in shifted)
    se = max(s[1] for s in shifted)
    if se - sw < plain_e - plain_w:
        west = sw if sw <= 180 else sw - 360
        east = se - 360 if se > 180 else se
        return [round(west, 4), round(south, 4), round(east, 4), round(north, 4)]
    east = plain_e - 360 if plain_e > 180 else plain_e
    return [round(plain_w, 4), round(south, 4), round(east, 4), round(north, 4)]


def camera(box):
    # centre of the box (wrapping honoured) and a zoom that fits the
    # longer side into a 900-pixel viewport at web-mercator scale
    west, south, east, north = box
    width = (east - west) % 360 or 360
    centre_lng = west + width / 2
    if centre_lng > 180:
        centre_lng -= 360
    centre_lat = (south + north) / 2
    lat_span = max(north - south, 0.05)
    # mercator stretches latitude; scale the span at the centre latitude
    stretch = 1 / max(math.cos(math.radians(centre_lat)), 0.2)
    span = max(width, lat_span * stretch)
    zoom = math.log2(360 / max(span, 0.05)) + math.log2(900 / 256) - 0.3
    zoom = max(2.0, min(11.0, zoom))
    return [round(centre_lat, 4), round(centre_lng, 4)], round(zoom * 2) / 2


def main():
    manifest = json.loads(PAGE_MANIFEST.read_text(encoding="utf-8"))
    entries = {}
    for region in manifest["regions"]:
        code = region["code"]
        box = union_box(region["boxes"])
        centre, zoom = camera(box)
        entries[code] = {
            "code": code,
            "iso2": ISO_FOR_PROJECT_CODE.get(code, code).upper(),
            "name": region["name"],
            "bbox": box,
            "centre": centre,
            "zoom": zoom,
            "page": True,
        }
    added = 0
    for feature in load_ne()["features"]:
        props = feature["properties"]
        iso = (props.get("ISO_A2_EH") or "").strip()
        if not iso or iso == "-99":
            continue  # northern cyprus, somaliland: no iso code
        iso = iso.lower()
        code = PROJECT_CODE_FOR_ISO.get(iso, iso)
        if code in entries:
            continue
        box = bbox_of(feature["geometry"])
        centre, zoom = camera(box)
        entries[code] = {
            "code": code,
            "iso2": iso.upper(),
            "name": props.get("NAME_EN") or props.get("NAME_LONG") or props["ADMIN"],
            "bbox": box,
            "centre": centre,
            "zoom": zoom,
            "page": False,
        }
        added += 1
    countries = [entries[code] for code in sorted(entries)]
    doc = {
        "note": "generated by scripts/build_country_registry.py; page countries from region-bboxes.json (name and extent win), the rest from Natural Earth 1:110m admin-0; bbox is [west, south, east, north] with west > east wrapping the antimeridian; centre is [lat, lng] for leaflet; zoom fits a 900px viewport",
        "countries": countries,
    }
    OUT.write_text(json.dumps(doc, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    OUT_JS.write_text(
        "// generated by scripts/build_country_registry.py; see country-registry.json\n"
        + "window.POW_COUNTRY_REGISTRY = " + json.dumps(doc, separators=(",", ":"), ensure_ascii=False) + ";\n",
        encoding="utf-8",
    )
    write_convex_registry(countries)
    print(f"wrote {OUT.relative_to(REPO)}: {len(countries)} countries ({len(countries) - added} with pages, {added} from natural earth)")


def write_convex_registry(countries):
    # the server reads an east edge greater than 180 as a box crossing the
    # antimeridian (see longitudeWithinBounds); the registry stores west >
    # east for the same case, so unwrap here. keyed by the project code and,
    # where it differs, the iso code too, so either spelling resolves
    lines = [
        "// generated by scripts/build_country_registry.py from apps/shared/data/country-registry.json; do not edit",
        "export type GeneratedIntakeBounds = { name: string; west: number; south: number; east: number; north: number };",
        "export const WORLD_INTAKE_BOUNDS: Record<string, GeneratedIntakeBounds> = {",
    ]
    for c in countries:
        west, south, east, north = c["bbox"]
        if east < west:
            east += 360
        entry = f'{{ name: {json.dumps(c["name"], ensure_ascii=False)}, west: {west}, south: {south}, east: {east}, north: {north} }}'
        keys = [c["code"].upper()]
        if c["iso2"] != c["code"].upper():
            keys.append(c["iso2"])
        for key in keys:
            lines.append(f"  {key}: {entry},")
    lines.append("};")
    OUT_TS.write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
