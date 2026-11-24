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

function mercatorY(lat) {
  return Math.asinh(Math.tan(lat * Math.PI / 180)) / (2 * Math.PI);
}

export function tileMatchDistance(a, b) {
  const [lngA, latA] = a.coords;
  const [lngB, latB] = b.coords;
  const dx = ((lngB - lngA + 540) % 360 - 180) / 360;
  const dy = mercatorY(latB) - mercatorY(latA);
  const metresPerWorld = 512 * metresPerPixel(0, (latA + latB) / 2);
  // each grid step spans one tile width / extent at the place's latitude.
  // allow one step on each axis of the coarser grid (its cell diagonal) to
  // cover quantisation between zooms 8 and 18, about 41 m at z8 in Wellington
  // for extent 4096, and half as much for each additional zoom level.
  const bound = Math.SQRT2 * Math.max(a.gridStep, b.gridStep);
  const distance = Math.hypot(dx, dy);
  return distance <= bound + Number.EPSILON ? distance * metresPerWorld : Infinity;
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

function edgeMatchKey(point) {
  const id = point.properties.id;
  return hasPlaceId(id) ? `id:${id}` : worldPointKey(point);
}

function replaceParentEdgeCopies(points) {
  const edges = new Map();
  for (const point of points) {
    if (point.localX !== point.extent && point.localY !== point.extent) continue;
    const key = edgeMatchKey(point);
    if (!edges.has(key)) edges.set(key, []);
    edges.get(key).push(point);
  }
  if (!edges.size) return points;

  const matches = [];
  for (const parent of points) {
    const children = edges.get(edgeMatchKey(parent));
    if (!children) continue;
    const keyed = hasPlaceId(parent.properties.id);
    for (const child of children) {
      if (child.tile.z <= parent.tile.z) continue;
      const distance = keyed ? tileMatchDistance(parent, child) : 0;
      if (Number.isFinite(distance)) matches.push({ parent, child, distance });
    }
  }

  // use the finest surviving edges first, with one match per parent zoom
  // for each edge so extra occurrences at the same zoom remain visible.
  matches.sort((a, b) => b.child.tile.z - a.child.tile.z || a.distance - b.distance);
  const replaced = new Set();
  const matchedZooms = new Map();
  for (const { parent, child } of matches) {
    if (replaced.has(parent) || replaced.has(child)) continue;
    if (!matchedZooms.has(child)) matchedZooms.set(child, new Set());
    const zooms = matchedZooms.get(child);
    if (zooms.has(parent.tile.z)) continue;
    zooms.add(parent.tile.z);
    replaced.add(parent);
  }
  return points.filter((point) => !replaced.has(point));
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
    const gridStep = 1 / (raw.extent * 2 ** tile.z);
    raw.loadGeometry().forEach(([{ x, y }], i) => {
      points.push({ tile, localX: x, localY: y, extent: raw.extent, coords: coords[i], properties, gridStep });
    });
  }
  const owned = ownedTilePoints(points);
  const finestZooms = new Map();
  if (zooms.size > 1) {
    // the september archive has one occurrence per osm key at each zoom.
    // quantisation can put a parent and its child on opposite sides of a tile edge.
    for (const { tile, properties: { id } } of owned) {
      if (typeof id === "string" && /^[nwr]\d+$/.test(id)) {
        finestZooms.set(id, Math.max(finestZooms.get(id) ?? tile.z, tile.z));
      }
    }
  }
  const visible = owned.filter(({ tile, localX, localY, extent, properties: { id } }) => {
    if (finestZooms.has(id)) return tile.z === finestZooms.get(id);
    // when only geometry can identify a place, use finer tiles that cover it
    for (const z of zooms) {
      if (z <= tile.z) continue;
      const scale = 2 ** (z - tile.z);
      const x = Math.floor((tile.x + localX / extent) * scale) % 2 ** z;
      const y = Math.floor((tile.y + localY / extent) * scale);
      if (tiles.has(`${z}/${x}/${y}`)) return false;
    }
    return true;
  });
  const distinct = zooms.size > 1 ? replaceParentEdgeCopies(visible) : visible;
  distinct.sort((a, b) => a.coords[0] - b.coords[0] || a.coords[1] - b.coords[1]);
  const occurrences = new Map();
  return distinct.map(({ coords, properties: props, gridStep }) => {
    // coordinates and attributes distinguish records that share a source id
    const group = JSON.stringify([
      hasPlaceId(props.id) ? String(props.id) : null,
      coords, ...ownershipProperties.slice(1).map((name) => props[name] ?? null)
    ]);
    const ordinal = occurrences.get(group) ?? 0;
    occurrences.set(group, ordinal + 1);
    return { id: `${group}:${ordinal}`, coords, props, gridStep };
  });
}
