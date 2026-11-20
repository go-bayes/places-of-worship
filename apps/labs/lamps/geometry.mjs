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

// keep the first feature seen for each id; tiles overlap at their edges, so
// one place can arrive from several tiles. features without an id are kept
// by position instead
export function dedupeById(features) {
  const seen = new Map();
  for (const f of features) {
    const props = f.properties || {};
    const coords = f.geometry && f.geometry.type === "Point" ? f.geometry.coordinates : null;
    if (!coords) continue;
    const key = props.id ? String(props.id) : `${coords[0].toFixed(6)},${coords[1].toFixed(6)}`;
    if (!seen.has(key)) seen.set(key, { id: key, coords, props });
  }
  return [...seen.values()];
}
