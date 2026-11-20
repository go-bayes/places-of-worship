import { categoriseReligion, religionCategories } from "./categories.js";

const earthRadius = 6371007.18; // authalic radius in metres
const radians = Math.PI / 180;
const sqrt3 = Math.sqrt(3);

// Lambert azimuthal equal-area preserves area on the sphere. At angular
// distance c from the centre, radial scale is cos(c/2) and transverse scale
// is 1/cos(c/2). Within 50 km of the centre, the largest linear scale error
// is about 7.7 parts per million (0.00077%). The spherical Earth approximation
// and the straight lon/lat edges used to render each hexagon are separate.
export const MAX_LINEAR_DISTORTION_AT_50_KM = 1 / Math.cos(50000 / (2 * earthRadius)) - 1;

function localProjection(lon, lat) {
  const sinLat = Math.sin(lat * radians);
  const cosLat = Math.cos(lat * radians);
  return {
    project(point) {
      const phi = point.lat * radians;
      const delta = (point.lon - lon) * radians;
      const cosPhi = Math.cos(phi);
      const sinPhi = Math.sin(phi);
      const cosDelta = Math.cos(delta);
      const scale = earthRadius * Math.sqrt(2 / (1 + sinLat * sinPhi + cosLat * cosPhi * cosDelta));
      return [
        scale * cosPhi * Math.sin(delta),
        scale * (cosLat * sinPhi - sinLat * cosPhi * cosDelta)
      ];
    },
    unproject(x, y) {
      const radius = Math.hypot(x, y);
      if (radius === 0) return [lon, lat];
      const angle = 2 * Math.asin(radius / (2 * earthRadius));
      const sinAngle = Math.sin(angle);
      const cosAngle = Math.cos(angle);
      return [
        lon + Math.atan2(x * sinAngle, radius * cosLat * cosAngle - y * sinLat * sinAngle) / radians,
        Math.asin(cosAngle * sinLat + y * sinAngle * cosLat / radius) / radians
      ];
    }
  };
}

function cellIndices(x, y, side) {
  // round all three cube coordinates and repair the largest rounding error
  const r = (2 / 3) * y / side;
  const q = x / (sqrt3 * side) - r / 2;
  const s = -q - r;
  let roundedQ = Math.round(q);
  let roundedR = Math.round(r);
  const roundedS = Math.round(s);
  const qError = Math.abs(roundedQ - q);
  const rError = Math.abs(roundedR - r);
  const sError = Math.abs(roundedS - s);
  if (qError > rError && qError > sError) roundedQ = -roundedR - roundedS;
  else if (rError > sError) roundedR = -roundedQ - roundedS;
  return [roundedQ, roundedR];
}

function emptyCounts() {
  return Object.fromEntries(religionCategories.map(({ key }) => [key, 0]));
}

function statistics(count, counts) {
  const unknown = counts.unknown;
  const classified = count - unknown;
  let entropy = 0;
  if (classified > 0) {
    for (const { key } of religionCategories) {
      if (key === "unknown" || counts[key] === 0) continue;
      const proportion = counts[key] / classified;
      entropy -= proportion * Math.log2(proportion);
    }
  }
  return { count, counts, unknown, classified, entropy_bits: classified === 0 ? null : entropy };
}

const unitCorners = Array.from({ length: 6 }, (_, index) => {
  const angle = (30 + 60 * index) * radians;
  return [Math.cos(angle), Math.sin(angle)];
});

// pointy-topped hexagons, centred on the bbox midpoint. cellMetres is the
// flat-to-flat width. density uses the full cell area, including at bbox edges.
export function binPlaces(points, { bbox, cellMetres }) {
  const [west, south, east, north] = bbox;
  const projection = localProjection((west + east) / 2, (south + north) / 2);
  const side = cellMetres / sqrt3;
  const area = (sqrt3 / 2) * (cellMetres / 1000) ** 2;
  if (!Number.isFinite(cellMetres) || cellMetres <= 0 || !Number.isFinite(area) || area === 0) {
    throw new Error("Expected a positive, finite hex width in metres with a representable area");
  }

  const byCell = new Map();
  const totalCounts = emptyCounts();
  for (const point of points) {
    const [x, y] = projection.project(point);
    const [q, r] = cellIndices(x, y, side);
    if (!Number.isSafeInteger(q) || !Number.isSafeInteger(r)) {
      throw new Error("Point cannot be assigned to a hex cell at this size and extent");
    }
    const id = `${q},${r}`;
    if (!byCell.has(id)) byCell.set(id, { id, q, r, count: 0, counts: emptyCounts() });
    const cell = byCell.get(id);
    const category = categoriseReligion(point.properties.religion);
    cell.count++;
    cell.counts[category]++;
    totalCounts[category]++;
  }

  const cells = [...byCell.values()].map(({ id, q, r, count, counts }) => {
    const x = sqrt3 * side * (q + r / 2);
    const y = 1.5 * side * r;
    const ring = unitCorners.map(([dx, dy]) => projection.unproject(x + side * dx, y + side * dy));
    if (ring.some(([lon, lat]) => !Number.isFinite(lat) || !(lon >= -180 && lon <= 180))) {
      throw new Error("Hex footprint lies outside the supported projection or crosses the antimeridian");
    }
    ring.push([...ring[0]]);
    const segments = [];
    let base = 0;
    for (const { key } of religionCategories) {
      const segmentCount = counts[key];
      if (segmentCount === 0) continue;
      const top = base + segmentCount;
      segments.push({ category: key, count: segmentCount, base, top });
      base = top;
    }
    return {
      id, ring, area_km2: area, density_per_km2: count / area,
      ...statistics(count, counts), segments
    };
  });
  const total = cells.reduce((sum, cell) => sum + cell.count, 0);
  if (total !== points.length) throw new Error("Hex cell counts failed to reconcile");
  return { cells, totals: { ...statistics(total, totalCounts), occupied_cells: cells.length } };
}
