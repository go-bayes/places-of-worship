/* region-resolve.js — the one country resolver for every map surface.
   pure geometry over the outline manifest (region-bboxes.json): which
   country sits under a point, and that country's territory as proper
   MultiPolygon topology (holes nested, so enclaves like Lesotho never
   paint as their neighbour). extracted after tribunal review found the
   global map's duplicate resolver disagreeing with the country pages'
   at 1,761 points on a half-degree grid (design record:
   docs/development/country-broadcast-review-2026-07.md). loads as a
   classic script; both surfaces read window.RegionResolve. */
(function () {
  "use strict";

  // maplibre reports unwrapped longitudes after a long pan
  function normaliseLng(lng) {
    return ((lng + 180) % 360 + 360) % 360 - 180;
  }

  // containment on a circular longitude axis, so west > east boxes wrap
  // the antimeridian and a margin can push any edge across it safely
  function boxContains(box, lng, lat, margin) {
    const m = margin || 0;
    if (lat < box[1] - m || lat > box[3] + m) return false;
    const width = ((box[2] - box[0]) % 360 + 360) % 360 + 2 * m;
    const rel = ((lng - (box[0] - m)) % 360 + 360) % 360;
    return rel <= width;
  }

  function boxArea(box) {
    const width = (box[2] - box[0] + 360) % 360 || 360;
    return width * (box[3] - box[1]);
  }

  // even-odd ray cast over every outline ring (exteriors and holes
  // together). rings crossing the antimeridian store longitudes past
  // 180, so the query point probes all three 360-degree frames; it can
  // only fall inside in one of them
  function pointInRings(rings, lng, lat) {
    for (const probe of [lng - 360, lng, lng + 360]) {
      let inside = false;
      for (const ring of rings) {
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const xi = ring[i][0], yi = ring[i][1];
          const xj = ring[j][0], yj = ring[j][1];
          if ((yi > lat) !== (yj > lat) &&
              probe < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
            inside = !inside;
          }
        }
      }
      if (inside) return true;
    }
    return false;
  }

  function regionHasPoint(region, lng, lat) {
    return Array.isArray(region.rings) && pointInRings(region.rings, lng, lat);
  }

  // smallest CONTAINING box wins, so a continental neighbour's wide box
  // never shadows an island country inside it — and a distant islet box
  // never claims a point it does not contain
  function smallestContainingAt(list, lng, lat) {
    let pick = null;
    let pickArea = Infinity;
    for (const region of list) {
      for (const box of region.boxes) {
        if (boxContains(box, lng, lat, 0) && boxArea(box) < pickArea) {
          pickArea = boxArea(box);
          pick = region;
        }
      }
    }
    return pick;
  }

  // the country under a point, land-verified with the rectangle-only
  // fallback for entries without outlines. with homeCode set, the home
  // country and water inside its rectangle resolve to null (the country
  // pages' handoff semantics); without it, any manifest country resolves
  // (the global map's semantics)
  function resolveAt(regions, lng, lat, opts) {
    if (!Array.isArray(regions)) return null;
    const homeCode = opts && opts.homeCode;
    if (homeCode) {
      const home = regions.find((r) => r.code === homeCode);
      if (!home || regionHasPoint(home, lng, lat)) return null;
      const containing = regions.filter((r) => r.code !== homeCode &&
        r.boxes.some((b) => boxContains(b, lng, lat, 0)));
      const onLand = containing.filter((r) => regionHasPoint(r, lng, lat));
      if (onLand.length) return smallestContainingAt(onLand, lng, lat);
      if (home.boxes.some((b) => boxContains(b, lng, lat, 0))) return null;
      const boxOnly = containing.filter((r) => !Array.isArray(r.rings));
      return boxOnly.length ? smallestContainingAt(boxOnly, lng, lat) : null;
    }
    const containing = regions.filter((r) => r.boxes.some((b) => boxContains(b, lng, lat, 0)));
    const onLand = containing.filter((r) => regionHasPoint(r, lng, lat));
    if (onLand.length) return smallestContainingAt(onLand, lng, lat);
    const boxOnly = containing.filter((r) => !Array.isArray(r.rings));
    return boxOnly.length ? smallestContainingAt(boxOnly, lng, lat) : null;
  }

  // nest a region's flat ring list into MultiPolygon coordinates: a ring
  // contained by an odd number of others is a hole of its smallest
  // container; everything else is an exterior. containment is tested on
  // one representative vertex, which the manifest's non-crossing rings
  // guarantee is decisive. this keeps enclaves from double-painting
  function nestRings(rings) {
    const closed = rings.map((ring) => {
      const coords = ring.slice();
      const [fx, fy] = coords[0];
      const [lx, ly] = coords[coords.length - 1];
      if (fx !== lx || fy !== ly) coords.push([fx, fy]);
      return coords;
    });
    const containers = closed.map((ring, i) =>
      closed.map((other, j) =>
        i !== j && pointInRings([other], ring[0][0], ring[0][1]) ? j : -1
      ).filter((j) => j >= 0));
    const polygons = [];
    const polygonIndex = new Map();
    closed.forEach((ring, i) => {
      if (containers[i].length % 2 === 0) {
        polygonIndex.set(i, polygons.length);
        polygons.push([ring]);
      }
    });
    closed.forEach((ring, i) => {
      if (containers[i].length % 2 === 1) {
        // the smallest containing exterior owns the hole
        let owner = -1;
        let ownerVertices = Infinity;
        for (const j of containers[i]) {
          if (polygonIndex.has(j) && closed[j].length < ownerVertices) {
            ownerVertices = closed[j].length;
            owner = j;
          }
        }
        if (owner >= 0) polygons[polygonIndex.get(owner)].push(ring);
        else polygons.push([ring]);
      }
    });
    return polygons;
  }

  // a region's territory as one MultiPolygon feature, holes nested; the
  // nesting is quadratic in ring count, so each region computes once and
  // style-reload retries reuse the cached feature
  const featureCache = new Map();
  function regionFeature(region) {
    if (featureCache.has(region.code)) return featureCache.get(region.code);
    const feature = {
      type: "Feature",
      properties: { code: region.code, name: region.name },
      geometry: { type: "MultiPolygon", coordinates: nestRings(region.rings || []) }
    };
    featureCache.set(region.code, feature);
    return feature;
  }

  window.RegionResolve = {
    normaliseLng,
    boxContains,
    boxArea,
    pointInRings,
    regionHasPoint,
    smallestContainingAt,
    resolveAt,
    nestRings,
    regionFeature
  };
})();
