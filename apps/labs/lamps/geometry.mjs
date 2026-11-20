import { hasPlaceId, ownedTilePoints, ownershipProperties } from "../shared/tile-ownership.mjs";

// pillar geometry: hexagonal prisms around each place, and the sizes that
// keep a pillar visible as the camera pulls back. dependency-free so the
// node tests can check it.

const EARTH_RADIUS = 6378137;
// maplibre draws 512-pixel tiles, so a pixel at zoom z on the equator spans
// the equator's length over 512 * 2^z
const EQUATOR_METRES_PER_PIXEL_Z0 = (2 * Math.PI * EARTH_RADIUS) / 512;

export function metresPerPixel(zoom, lat) {
  return (EQUATOR_METRES_PER_PIXEL_Z0 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
}

// the symbolic pillar: 14 m across and 60 m tall where that reads on screen.
// further out both grow so a pillar keeps at least `minWidthPx` of width and
// `minHeightPx` of height; they reach their true size near zoom 15
export const PILLAR = { radius: 7, height: 60, minWidthPx: 4, minHeightPx: 26 };

export function pillarRadius(zoom, lat) {
  return Math.max(PILLAR.radius, (PILLAR.minWidthPx / 2) * metresPerPixel(zoom, lat));
}

export function pillarHeight(zoom, lat) {
  return Math.max(PILLAR.height, PILLAR.minHeightPx * metresPerPixel(zoom, lat));
}

// a closed hexagon ring of the given radius in metres around [lng, lat]
export function hexagon([lng, lat], radius, rotation = 0) {
  const dLat = (radius / EARTH_RADIUS) * (180 / Math.PI);
  const dLng = dLat / Math.cos((lat * Math.PI) / 180);
  const ring = [];
  for (let i = 0; i < 6; i += 1) {
    const a = rotation + (i * Math.PI) / 3;
    ring.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  ring.push(ring[0]);
  return ring;
}

function worldPointKey({ tile, localX, localY, extent, properties }) {
  const size = 2 ** tile.z;
  const x = ((tile.x + localX / extent) % size) / size;
  const y = (tile.y + localY / extent) / size;
  return JSON.stringify([x, y, ...ownershipProperties.map((name) => properties[name] ?? null)]);
}

function replaceParentEdgeCopies(points) {
  const edgeCounts = new Map();
  for (const point of points) {
    if (point.localX !== point.extent && point.localY !== point.extent) continue;
    const key = worldPointKey(point);
    if (!edgeCounts.has(key)) edgeCounts.set(key, new Map());
    const byZoom = edgeCounts.get(key);
    const { z } = point.tile;
    byZoom.set(z, (byZoom.get(z) ?? 0) + 1);
  }
  if (!edgeCounts.size) return points;

  // a child can supply a copy from its far edge before the owning child
  // loads. use the largest finer count so copies across zooms count once.
  const parentCounts = new Map();
  return points.filter((point) => {
    const key = worldPointKey(point);
    const byZoom = edgeCounts.get(key);
    if (!byZoom) return true;
    const { z } = point.tile;
    let finer = 0;
    for (const [zoom, count] of byZoom) {
      if (zoom > z) finer = Math.max(finer, count);
    }
    if (!finer) return true;

    const parentKey = `${z}:${key}`;
    const count = (parentCounts.get(parentKey) ?? 0) + 1;
    parentCounts.set(parentKey, count);
    return count > finer;
  });
}

// MapLibre 6.19 source-query features retain their canonical tile and raw
// geometry. Exact tile units decide ownership, including quantised edges.
export function placesInTiles(features) {
  const points = [];
  const tiles = new Set();
  const zooms = new Set();
  for (const feature of features) {
    const { tile, _vectorTileFeature: raw, properties } = feature;
    if (!tile || tile.z < 8 || !raw) continue;
    tiles.add(`${tile.z}/${tile.x}/${tile.y}`);
    zooms.add(tile.z);
    const { geometry } = feature;
    if (geometry.type !== "Point" && geometry.type !== "MultiPoint") continue;
    const coords = geometry.type === "MultiPoint" ? geometry.coordinates : [geometry.coordinates];
    raw.loadGeometry().forEach(([{ x, y }], i) => {
      points.push({ tile, localX: x, localY: y, extent: raw.extent, coords: coords[i], properties });
    });
  }
  // during a tile transition, use finer tiles where they cover a point
  const owned = ownedTilePoints(points).filter(({ tile, localX, localY, extent }) => {
    for (const z of zooms) {
      if (z <= tile.z) continue;
      const scale = 2 ** (z - tile.z);
      const x = Math.floor((tile.x + localX / extent) * scale) % 2 ** z;
      const y = Math.floor((tile.y + localY / extent) * scale);
      if (tiles.has(`${z}/${x}/${y}`)) return false;
    }
    return true;
  });
  const distinct = zooms.size > 1 ? replaceParentEdgeCopies(owned) : owned;
  distinct.sort((a, b) => a.coords[0] - b.coords[0] || a.coords[1] - b.coords[1]);
  const occurrences = new Map();
  return distinct.map(({ coords, properties: props }) => {
    // coordinates and attributes distinguish records that share a source id
    const group = JSON.stringify([
      hasPlaceId(props.id) ? String(props.id) : null,
      coords, ...ownershipProperties.slice(1).map((name) => props[name] ?? null)
    ]);
    const ordinal = occurrences.get(group) ?? 0;
    occurrences.set(group, ordinal + 1);
    return { id: `${group}:${ordinal}`, coords, props };
  });
}
