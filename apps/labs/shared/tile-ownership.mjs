// the tile build keeps every occurrence in the half-open tile proper.
// a far-edge copy can supply occurrences missing from the owning tile.
export const ownershipProperties = [
  "id", "osm_type", "osm_id", "name", "religion", "denomination", "country_code", "country"
];

export function hasPlaceId(id) {
  return id != null && String(id).trim() !== "";
}

function edgeKey({ tile, localX, localY, extent, properties }) {
  const worldWidth = 2 ** tile.z;
  const x = (tile.x + localX / extent) % worldWidth;
  const y = tile.y + localY / extent;
  return JSON.stringify([tile.z, x, y, ...ownershipProperties.map((key) => properties[key] ?? null)]);
}

export function ownedTilePoints(points) {
  const kept = [];
  const edges = new Map();
  for (const point of points) {
    const { tile, localX: x, localY: y, extent } = point;
    if (x < 0 || y < 0 || x > extent || y > extent) continue;
    if (x < extent && y < extent) {
      kept.push(point);
      continue;
    }
    const key = edgeKey(point);
    if (!edges.has(key)) edges.set(key, new Map());
    const tiles = edges.get(key);
    const address = `${tile.x}/${tile.y}`;
    if (!tiles.has(address)) tiles.set(address, []);
    tiles.get(address).push(point);
  }
  if (!edges.size) return kept;

  const properCounts = new Map();
  for (const point of kept) {
    if (point.localX !== 0 && point.localY !== 0) continue;
    const key = edgeKey(point);
    properCounts.set(key, (properCounts.get(key) ?? 0) + 1);
  }
  for (const [key, tiles] of edges) {
    let largest = [];
    for (const copies of tiles.values()) {
      if (copies.length > largest.length) largest = copies;
    }
    for (const point of largest.slice(properCounts.get(key) ?? 0)) kept.push(point);
  }
  return kept;
}
