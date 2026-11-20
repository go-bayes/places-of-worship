// relief: the pure parts of the page. study areas, how tall a place
// stands, flat-view geometry, the diversity ramp and the words the card,
// table and count line use. the counting itself lives in ./engine/.

import { religionCategories } from "./engine/categories.js";

// the extent the engine tests pin for wellington (117 places on
// 2026-11-20), used as the city's central study area so the page and the
// tests count the same ground
export const WELLINGTON_TEST_BBOX = [174.73, -41.34, 174.83, -41.26];

export const STUDY_SIZES = [
  { key: "central", label: "Central, about 9 km across", km: 9 },
  { key: "wide", label: "Wide, about 30 km across", km: 30 }
];

export const CELL_SIZES = [
  { metres: 250, label: "250 m" },
  { metres: 500, label: "500 m" },
  { metres: 1000, label: "1 km" }
];

const KM_PER_DEGREE = 111.32;
const round6 = (x) => Math.round(x * 1e6) / 1e6;

// a square of side `km` centred on [lng, lat], as [west, south, east, north]
export function squareAround([lng, lat], km) {
  const half = km / 2;
  const dLat = half / KM_PER_DEGREE;
  const dLng = half / (KM_PER_DEGREE * Math.cos((lat * Math.PI) / 180));
  return [round6(lng - dLng), round6(lat - dLat), round6(lng + dLng), round6(lat + dLat)];
}

export function studyArea(city, sizeKey) {
  const size = STUDY_SIZES.find((s) => s.key === sizeKey) || STUDY_SIZES[0];
  if (city.label === "Wellington" && size.key === "central") return WELLINGTON_TEST_BBOX.slice();
  return squareAround(city.coords, size.km);
}

// metres of column height for each place. the base unit grows with the
// cell, and halves (and halves again) when the tallest column would rise
// past a ceiling, so a dense city stays readable. the legend states the
// unit in force
export function heightUnit(cellMetres, maxCount) {
  let unit = cellMetres * 0.24;
  const ceiling = Math.max(2400, cellMetres * 5);
  while (maxCount * unit > ceiling && unit > 1) unit /= 2;
  return Math.round(unit * 10) / 10;
}

function centroid(ring) {
  const pts = ring.slice(0, -1);
  return [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
}

// the ring scaled about its centroid; for a cell a few hundred metres
// across this is area-proportional to well under a part in a thousand
export function scaleRing(ring, factor) {
  const [cx, cy] = centroid(ring);
  return ring.map(([x, y]) => [cx + (x - cx) * factor, cy + (y - cy) * factor]);
}

// the flat view: each segment of a column becomes a hexagonal band, nested
// from the outside in, with each band's area in proportion to its count
export function nestedRings(ring, segments, count) {
  return segments.map((s) => ({
    category: s.category,
    count: s.count,
    ring: scaleRing(ring, Math.sqrt(1 - s.base / count))
  }));
}

// diversity: light for one tradition, deep for many. stops in bits
export const DIVERSITY_RAMP = [
  [0, "#d8c886"],
  [0.5, "#a9c58c"],
  [1, "#5fa38f"],
  [1.5, "#2f6f86"],
  [2, "#243b6b"]
];
export const NO_DIVERSITY = "#a39f96";

export function diversityColorExpression() {
  return [
    "case",
    ["==", ["get", "entropy_bits"], null], NO_DIVERSITY,
    ["interpolate", ["linear"], ["get", "entropy_bits"], ...DIVERSITY_RAMP.flat()]
  ];
}

export function categoryColorExpression(property = "category") {
  return [
    "match", ["get", property],
    ...religionCategories.flatMap((c) => [c.key, c.color]),
    "#64748b"
  ];
}

const LABEL = Object.fromEntries(religionCategories.map((c) => [c.key, c.label]));

export function categoryLabel(key, inSentence = false) {
  const label = LABEL[key] || key;
  return inSentence && (key === "unknown" || key === "other") ? label.toLowerCase() : label;
}

export function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

export function formatArea(km2) {
  return km2 >= 0.1 ? km2.toFixed(2) : km2.toFixed(3);
}

export function formatDensity(perKm2) {
  return perKm2 >= 10 ? String(Math.round(perKm2)) : perKm2.toFixed(1);
}

export function formatBits(bits) {
  return bits.toFixed(2);
}

// the card's sentences for one cell, in the engine's category order
export function describeCell(cell) {
  const first = `${plural(cell.count, "place", "places")} in this cell of ${formatArea(cell.area_km2)} km² (${formatDensity(cell.density_per_km2)} per km²).`;
  const parts = religionCategories
    .filter((c) => cell.counts[c.key] > 0)
    .map((c) => `${categoryLabel(c.key, true)} ${cell.counts[c.key]}`);
  const second = parts.length ? `${parts.join(", ")}.` : "";
  let third;
  if (cell.entropy_bits === null || cell.classified === 0) {
    third = "Diversity is not defined here: no place in this cell has a recorded tradition.";
  } else if (cell.classified === 1) {
    third = `Diversity ${formatBits(cell.entropy_bits)} bits: one classified place.`;
  } else {
    third = `Diversity ${formatBits(cell.entropy_bits)} bits among the ${cell.classified} classified.`;
  }
  return [first, second, third].filter(Boolean);
}

export function countLine(totals) {
  if (totals.count === 0) return "No mapped places of worship fall inside this study area.";
  return totals.count === 1
    ? "1 mapped place in the study area. Each record is counted once."
    : `${totals.count} mapped places in the study area. Each record is counted once.`;
}

// the reconciliation record, line by line, and the identity it satisfies
export function reconciliationLines(r, totals, cellMetres) {
  const lines = [
    `Tiles read: ${r.tilesRequested} at zoom 12${r.tilesEmpty ? `, ${r.tilesEmpty} of them empty` : ""}.`,
    `Records in those tiles: ${r.rawFeatures}.`,
    `Tile-buffer copies removed: ${r.duplicatesRemoved}.`,
    `Outside the study area: ${r.outsideExtentRemoved}.`,
    `Kept, each counted once: ${r.kept}.`,
    `${r.rawFeatures} = ${r.duplicatesRemoved} + ${r.outsideExtentRemoved} + ${r.kept}.`
  ];
  if (totals) {
    lines.push(`Occupied cells: ${totals.occupied_cells}, each a hexagon ${cellMetres >= 1000 ? `${cellMetres / 1000} km` : `${cellMetres} m`} across; their counts sum to ${totals.count}.`);
  }
  return lines;
}

// "Tile 12/4036/2564: HTTP 503" from the worker, as parts for the page
export function tileFailure(message) {
  const m = /Tile (\d+\/\d+\/\d+): (.*)$/.exec(String(message || ""));
  return m ? { tile: m[1], reason: m[2] } : { tile: null, reason: String(message || "unknown error") };
}

// rows for the table, one per occupied cell
export function tableRows(cells) {
  return cells.map((c) => ({
    id: c.cell_id,
    count: c.count,
    area: c.area_km2,
    density: c.density_per_km2,
    ...Object.fromEntries(religionCategories.map((k) => [k.key, c.counts[k.key]])),
    diversity: c.entropy_bits
  }));
}

// sort with nulls last whichever way, and the cell id as a stable tiebreak
export function sortRows(rows, key, direction = "descending") {
  const sign = direction === "ascending" ? 1 : -1;
  return rows.slice().sort((a, b) => {
    const x = a[key];
    const y = b[key];
    if (x === null && y !== null) return 1;
    if (y === null && x !== null) return -1;
    if (x !== y) return x < y ? -sign : sign;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}
