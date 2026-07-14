#!/usr/bin/env python3
# /// script
# dependencies = ["shapely>=2.0"]
# ///
"""Build the border-handoff extent manifest for the country data maps.

Reads every GeoJSON under apps/regions/<code>/data/, and writes per
country to apps/regions/_shared/data/region-bboxes.json both (a) one or
more bounding boxes, clustered by longitude gaps, and (b) a dissolved,
simplified outline for point-in-polygon tests. Country names come from
the hub page's map cards, so the manifest and the hub cannot disagree
about what a country is called.

Both geometries earn their place. Clustered boxes are the fast
prefilter, and a single naive bbox for a country spanning the
antimeridian or scattered territories (United States, Kiribati, Fiji)
would claim most of the Pacific; boxes with west > east deliberately
wrap the antimeridian. The outline settles concave borders that boxes
cannot: Munich sits inside Austria's bounding rectangle, and only a
polygon test lets the Austria page offer Germany there.

Run from the repo root after launching a new country map:

    uv run scripts/build_region_bboxes.py
"""

import json
import math
import re
import sys
from pathlib import Path

from shapely import make_valid, union_all
from shapely.geometry import shape

# outline simplification tolerance (degrees, ~3 km) and the smallest
# hole worth keeping; handoff needs border-scale accuracy, not cadastral
SIMPLIFY_DEG = 0.03
MIN_HOLE_AREA = 0.001
# islet rings below this area (square degrees, ~2 km across) drop from
# the outline — but only when the country has a mainland-scale ring, so
# atoll nations whose every island is tiny keep their full outline
MIN_ISLET_AREA = 0.0005
MAINLAND_AREA = 0.05
# boxes pad outward past simplification drift and coordinate rounding so
# the runtime's box prefilter can never exclude a point its outline holds
BOX_PAD = SIMPLIFY_DEG + 0.02


def norm_lng(lng):
    # canonical [-180, 180) longitude
    return ((lng + 180.0) % 360.0 + 360.0) % 360.0 - 180.0


def box_contains(box, lng, lat):
    # circular-longitude containment; west > east wraps the antimeridian
    if lat < box[1] or lat > box[3]:
        return False
    width = (box[2] - box[0]) % 360.0
    return ((lng - box[0]) % 360.0) <= width

REPO = Path(__file__).resolve().parent.parent
REGIONS = REPO / "apps" / "regions"
OUT = REGIONS / "_shared" / "data" / "region-bboxes.json"

# longitude gap (degrees) that separates two clusters of features;
# smaller gaps (nz mainland to the chathams) stay one box
GAP_DEG = 8.0


def hub_names():
    # the hub page is the single source of truth for country names;
    # a card's href names the page directory, its title the country
    html = (REGIONS / "index.html").read_text(encoding="utf-8")
    names = {}
    for m in re.finditer(
        r'<a class="map-card" href="([a-z]{2})/">\s*'
        r'<div class="map-card-title">([^<]+)',
        html,
    ):
        names[m.group(1)] = m.group(2).strip()
    return names


def walk_coords(node, out):
    # geojson coordinate arrays nest rings and multiparts arbitrarily;
    # the leaves are [lng, lat] pairs
    if not isinstance(node, list) or not node:
        return
    if isinstance(node[0], (int, float)):
        out.append((float(node[0]), float(node[1])))
        return
    for child in node:
        walk_coords(child, out)


def feature_extent(coords):
    # per-feature extent as (west, east, south, north) with west/east in
    # [0, 360) so a feature crossing the antimeridian stays narrow
    lngs = [c[0] for c in coords]
    lats = [c[1] for c in coords]
    west, east = min(lngs), max(lngs)
    if east - west > 180.0:
        shifted = [lng % 360.0 for lng in lngs]
        west, east = min(shifted), max(shifted)
    else:
        west, east = west % 360.0, east % 360.0
        if west > east:
            west -= 360.0
    return west, east, min(lats), max(lats)


def cluster_boxes(extents):
    # split feature extents at circular longitude gaps; each cluster
    # unions to one output box, converted back to [-180, 180] with the
    # west > east wrap convention where the box crosses the antimeridian
    mids = sorted(set(((w + e) / 2.0) % 360.0 for w, e, _, _ in extents))
    if len(mids) == 1:
        cuts = [mids[0] - 0.5]
    else:
        gaps = []
        for i, mid in enumerate(mids):
            nxt = mids[(i + 1) % len(mids)]
            span = (nxt - mid) % 360.0
            gaps.append((span, (mid + span / 2.0) % 360.0))
        cuts = [pos for span, pos in gaps if span > GAP_DEG]
        if not cuts:
            cuts = [max(gaps)[1]]
    cuts = sorted(cuts)

    def cluster_index(mid):
        # a feature belongs to the arc between the cut below and above it
        for i, cut in enumerate(cuts):
            if mid < cut:
                return i
        return 0

    clusters = {}
    for w, e, s, n in extents:
        mid = ((w + e) / 2.0) % 360.0
        clusters.setdefault(cluster_index(mid), []).append((w, e, s, n))

    boxes = []
    for members in clusters.values():
        # union in a frame anchored at the cluster's arc start so wrapped
        # members compare on one axis; a wide member straddling the cut
        # unwraps forward rather than truncating the union
        start = cuts[0]
        rel = []
        for w, e, s, n in members:
            rw = (w - start) % 360.0
            re_ = (e - start) % 360.0
            if re_ < rw:
                re_ += 360.0
            rel.append((rw, re_, s, n))
        west = min(r[0] for r in rel)
        east = max(r[1] for r in rel)
        south = min(r[2] for r in rel)
        north = max(r[3] for r in rel)
        # pad outward, then floor/ceil so rounding can only grow the box
        w_out = norm_lng(math.floor((west + start - BOX_PAD) * 1000) / 1000)
        e_out = norm_lng(math.ceil((east + start + BOX_PAD) * 1000) / 1000)
        s_out = max(-90.0, math.floor((south - BOX_PAD) * 1000) / 1000)
        n_out = min(90.0, math.ceil((north + BOX_PAD) * 1000) / 1000)
        boxes.append([w_out, s_out, e_out, n_out])
    return sorted(boxes)


def country_geoms(code):
    # extents feed the bbox clusters (all geometry types count); the
    # polygonal shapes feed the dissolved outline
    extents = []
    polys = []
    for path in sorted((REGIONS / code / "data").glob("*.geojson")):
        try:
            doc = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError) as err:
            sys.exit(f"unreadable geojson {path}: {err}")
        features = doc.get("features", [doc] if doc.get("geometry") else [])
        for feature in features:
            geometry = feature.get("geometry") or {}
            coords = []
            walk_coords(geometry.get("coordinates", []), coords)
            if coords:
                extents.append(feature_extent(coords))
            if geometry.get("type") in ("Polygon", "MultiPolygon"):
                # make_valid can return a collection; only the polygonal
                # parts belong in the outline
                polys.extend(polygon_parts(make_valid(shape(geometry))))
    return extents, polys


def polygon_parts(geom):
    if geom.geom_type == "Polygon":
        return [geom]
    if geom.geom_type in ("MultiPolygon", "GeometryCollection"):
        parts = []
        for g in geom.geoms:
            parts.extend(polygon_parts(g))
        return parts
    return []


def outline_rings(polys):
    # dissolve every polygonal feature, simplify to border scale, and
    # emit a flat ring list (exteriors and kept holes) for even-odd tests
    merged = union_all(polys).simplify(SIMPLIFY_DEG, preserve_topology=True)
    parts = polygon_parts(merged)
    has_mainland = any(part.area >= MAINLAND_AREA for part in parts)
    if has_mainland:
        parts = [part for part in parts if part.area >= MIN_ISLET_AREA]
    rings = []
    for part in parts:
        # the antimeridian shift is a polygon-level decision: a hole must
        # stay in its exterior's longitude frame or even-odd parity breaks
        exterior_lngs = [p[0] for p in part.exterior.coords]
        crosses = max(exterior_lngs) - min(exterior_lngs) > 180.0
        for ring, is_hole in [(part.exterior, False)] + [(i, True) for i in part.interiors]:
            if is_hole and ring_area(ring.coords) < MIN_HOLE_AREA:
                continue
            coords = list(ring.coords)
            if crosses:
                coords = [(lng + 360.0 if lng < 0 else lng, lat) for lng, lat in coords]
            slim = [[round(x, 2), round(y, 2)] for x, y in coords]
            deduped = [p for i, p in enumerate(slim) if i == 0 or p != slim[i - 1]]
            if len(deduped) >= 4:
                rings.append(deduped)
    if not rings:
        sys.exit("outline dissolve produced no rings")
    return rings


def validate_region(code, boxes, rings, extents):
    # the boxes are the runtime's prefilter: every outline vertex and
    # every source-feature extent must sit inside at least one box, or a
    # centre could be on a country's land yet never reach the ring test
    for ring in rings:
        for lng, lat in ring:
            if not any(box_contains(b, norm_lng(lng), lat) for b in boxes):
                sys.exit(f"{code}: ring vertex ({lng}, {lat}) escapes every box")
    for w, e, s, n in extents:
        for lng, lat in ((w, s), (e, n)):
            if not any(box_contains(b, norm_lng(lng), lat) for b in boxes):
                sys.exit(f"{code}: feature corner ({lng}, {lat}) escapes every box")


def ring_area(coords):
    # unsigned shoelace area in square degrees
    total = 0.0
    pts = list(coords)
    for i in range(len(pts) - 1):
        total += pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1]
    return abs(total) / 2.0


def main():
    names = hub_names()
    regions = []
    for code_dir in sorted(REGIONS.iterdir()):
        code = code_dir.name
        if not (code_dir.is_dir() and re.fullmatch(r"[a-z]{2}", code)):
            continue
        if code not in names:
            sys.exit(f"page directory {code}/ has no hub card; add the card first")
        extents, polys = country_geoms(code)
        if not extents:
            sys.exit(f"no geojson coordinates found under {code}/data")
        if not polys:
            sys.exit(f"no polygonal geojson found under {code}/data")
        boxes = cluster_boxes(extents)
        rings = outline_rings(polys)
        validate_region(code, boxes, rings, extents)
        regions.append({
            "code": code,
            "name": names[code],
            "boxes": boxes,
            "rings": rings,
        })
        print(f"  {code}: {len(regions[-1]['boxes'])} boxes, {len(regions[-1]['rings'])} rings")
    missing = sorted(set(names) - {r["code"] for r in regions})
    if missing:
        sys.exit(f"hub cards without page directories: {missing}")
    OUT.write_text(
        json.dumps({"note": "generated by scripts/build_region_bboxes.py; boxes are [west, south, east, north] with west > east wrapping the antimeridian; rings are simplified even-odd outline rings whose longitudes may run past 180 when a ring crosses the antimeridian", "regions": regions}, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    box_count = sum(len(r["boxes"]) for r in regions)
    size_kb = OUT.stat().st_size / 1024
    print(f"wrote {OUT.relative_to(REPO)}: {len(regions)} countries, {box_count} boxes, {size_kb:.0f} KB")


if __name__ == "__main__":
    main()
