import { decodeMvtPoints } from "./mvt-points.js";

const mercatorLimit = 85.0511287798066;
const batchSize = 8;

// bbox is [west, south, east, north] in degrees, within Web Mercator.
// tile ownership is half-open to the east and south. bbox edges are inclusive.
export function tilesCoveringBbox(bbox, zoom) {
  if (!Array.isArray(bbox) || bbox.length !== 4 || ![...bbox].every(Number.isFinite)) {
    throw new Error("Expected bbox [west, south, east, north] in degrees");
  }
  const [west, south, east, north] = bbox;
  if (west < -180 || east > 180 || west >= east
    || south < -mercatorLimit || north > mercatorLimit || south >= north) {
    throw new Error("Expected a non-wrapping bbox within Web Mercator");
  }
  if (!Number.isInteger(zoom) || zoom < 0 || zoom > 30) {
    throw new Error("Expected integer XYZ zoom from 0 to 30");
  }

  const size = 2 ** zoom;
  const index = (coordinate) => Math.min(size - 1, Math.max(0, Math.floor(coordinate)));
  const tileX = (lon) => index((lon + 180) / 360 * size);
  const rowLatitude = (row) => Math.atan(Math.sinh(Math.PI * (1 - 2 * row / size))) * 180 / Math.PI;
  const tileY = (lat) => {
    const row = index((1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * size);
    // compare via the decoder's inverse formula at edges, where forward
    // projection can round just above or below the integer row boundary
    if (row < size - 1 && lat <= rowLatitude(row + 1)) return row + 1;
    if (row > 0 && lat > rowLatitude(row)) return row - 1;
    return row;
  };
  const xStart = tileX(west);
  const xEnd = tileX(east);
  const yStart = tileY(north);
  const yEnd = tileY(south);
  return (function* () {
    for (let x = xStart; x <= xEnd; x++) {
      for (let y = yStart; y <= yEnd; y++) yield { z: zoom, x, y };
    }
  })();
}

async function decodeTile(tile, fetchTile, gunzip) {
  try {
    let buffer = await fetchTile(tile);
    if (buffer === null) return [];
    if (!(buffer instanceof ArrayBuffer)) throw new Error("fetchTile must return an ArrayBuffer or null");
    const signature = new Uint8Array(buffer, 0, Math.min(2, buffer.byteLength));
    if (signature[0] === 0x1f && signature[1] === 0x8b) {
      if (!gunzip) throw new Error("Gzip tile requires a gunzip function");
      buffer = await gunzip(buffer);
    }
    return decodeMvtPoints(buffer, tile, "places");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Tile ${tile.z}/${tile.x}/${tile.y}: ${message}`, { cause: error });
  }
}

// fetchTile({z,x,y}) returns an ArrayBuffer or null for an empty tile.
// gunzip, when needed, converts a gzip ArrayBuffer to a plain ArrayBuffer.
export async function collectPlaces({ bbox, zoom, fetchTile, gunzip }) {
  const tiles = tilesCoveringBbox(bbox, zoom);
  const [west, south, east, north] = bbox;
  const points = [];
  const seenIds = new Set();
  const seenKeyless = new Set();
  const reconciliation = {
    tilesRequested: 0,
    tilesEmpty: 0,
    rawFeatures: 0,
    duplicatesRemoved: 0,
    outsideExtentRemoved: 0,
    kept: 0,
    keyless: 0
  };
  for (let batch = takeBatch(tiles); batch.length; batch = takeBatch(tiles)) {
    reconciliation.tilesRequested += batch.length;
    // consume in XYZ traversal order, even when fetches finish out of order
    const tilePoints = await Promise.all(batch.map((tile) => decodeTile(tile, fetchTile, gunzip)));
    for (const decoded of tilePoints) {
      if (decoded.length === 0) reconciliation.tilesEmpty++;
      reconciliation.rawFeatures += decoded.length;
      for (const point of decoded) {
        const { lon, lat, properties } = point;
        if (lon < west || lon > east || lat < south || lat > north) {
          reconciliation.outsideExtentRemoved++;
          continue;
        }
        const { id, name } = properties;
        const keyless = id == null || String(id).trim() === "";
        const keys = keyless ? seenKeyless : seenIds;
        const key = keyless
          ? JSON.stringify([Math.round(lon * 1e5), Math.round(lat * 1e5), name ?? ""])
          : String(id);
        if (keys.has(key)) {
          reconciliation.duplicatesRemoved++;
          continue;
        }
        keys.add(key);
        points.push(point);
      }
    }
  }
  reconciliation.kept = points.length;
  reconciliation.keyless = seenKeyless.size;
  const { rawFeatures, duplicatesRemoved, outsideExtentRemoved, kept } = reconciliation;
  if (rawFeatures !== outsideExtentRemoved + duplicatesRemoved + kept) {
    throw new Error("Tile point counts failed to reconcile");
  }
  return { points, reconciliation };
}

function takeBatch(tiles) {
  const batch = [];
  while (batch.length < batchSize) {
    const { value, done } = tiles.next();
    if (done) break;
    batch.push(value);
  }
  return batch;
}
