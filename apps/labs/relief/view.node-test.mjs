import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildRelief } from "./engine/relief-worker.js";
import {
  WELLINGTON_TEST_BBOX,
  studyArea,
  squareAround,
  heightUnit,
  nestedRings,
  scaleRing,
  describeCell,
  countLine,
  reconciliationLines,
  tileFailure,
  tableRows,
  sortRows
} from "./view.mjs";
import { CITIES } from "../shared/cities.mjs";

const wellington = CITIES.find((c) => c.label === "Wellington");

async function fixtureResponse(url) {
  const [z, x, y] = url.split("/").slice(-3).map(Number);
  const file = await readFile(new URL(`engine/fixtures/wellington-z${z}-${x}-${y}.pbf`, import.meta.url));
  return new Response(Uint8Array.from(file).buffer);
}

const request = (cellMetres) => ({
  bbox: studyArea(wellington, "central"),
  zoom: 12,
  cellMetres,
  tileUrlTemplate: "https://example.test/{z}/{x}/{y}"
});

test("wellington's central study area is the extent the engine tests count", () => {
  assert.deepEqual(studyArea(wellington, "central"), WELLINGTON_TEST_BBOX);
  const wide = studyArea(wellington, "wide");
  const widthKm = (wide[2] - wide[0]) * 111.32 * Math.cos((-41.2865 * Math.PI) / 180);
  assert.ok(Math.abs(widthKm - 30) < 0.01);
  assert.ok(Math.abs((wide[3] - wide[1]) * 111.32 - 30) < 0.01);
});

test("a square study area is centred on its city", () => {
  const [w, s, e, n] = squareAround([12.4964, 41.9028], 9);
  assert.ok(Math.abs((w + e) / 2 - 12.4964) < 1e-6);
  assert.ok(Math.abs((s + n) / 2 - 41.9028) < 1e-6);
});

test("the table's cells sum to the total at every cell size", async () => {
  for (const [size, occupied] of [[250, 78], [500, 54], [1000, 33]]) {
    const result = await buildRelief(request(size), { fetchResponse: fixtureResponse });
    const cells = result.cells.features.filter((f) => f.properties.kind === "footprint").map((f) => f.properties);
    const rows = tableRows(cells);
    assert.equal(result.totals.count, 95);
    assert.equal(rows.length, occupied);
    assert.equal(rows.reduce((a, r) => a + r.count, 0), 95);
    assert.equal(countLine(result.totals), "95 mapped places in the study area. Each record is counted once.");
    const lines = reconciliationLines(result.reconciliation, result.totals, size);
    assert.ok(lines.includes("105 = 0 + 10 + 95."));
  }
});

test("flat-view bands have areas in proportion to their counts", () => {
  const ring = [[0, 0], [2, 0], [3, 1.7], [2, 3.4], [0, 3.4], [-1, 1.7], [0, 0]];
  const area = (r) => Math.abs(r.slice(0, -1).reduce((a, [x, y], i) => a + x * r[i + 1][1] - y * r[i + 1][0], 0)) / 2;
  const segments = [
    { category: "christian", count: 6, base: 0, top: 6 },
    { category: "muslim", count: 3, base: 6, top: 9 },
    { category: "unknown", count: 1, base: 9, top: 10 }
  ];
  const bands = nestedRings(ring, segments, 10);
  const whole = area(ring);
  const areas = bands.map((b) => area(b.ring));
  const shares = areas.map((a, i) => (a - (areas[i + 1] || 0)) / whole);
  assert.deepEqual(shares.map((x) => Math.round(x * 1000) / 1000), [0.6, 0.3, 0.1]);
  assert.ok(Math.abs(area(scaleRing(ring, 0.5)) - whole / 4) < 1e-9);
});

test("the height unit keeps the tallest column within reach", () => {
  assert.equal(heightUnit(500, 8), 120);
  assert.ok(heightUnit(500, 200) * 200 <= 2400);
  assert.ok(heightUnit(250, 3) > 0);
});

test("the card speaks in plain sentences", () => {
  const cell = {
    count: 12, area_km2: 0.21650635094610965, density_per_km2: 12 / 0.21650635094610965,
    counts: { christian: 7, muslim: 2, hindu: 0, buddhist: 0, jewish: 0, sikh: 0, shinto: 0, taoist: 0, unknown: 3, other: 0 },
    classified: 9, entropy_bits: 0.7642045065086203
  };
  assert.deepEqual(describeCell(cell), [
    "12 places in this cell of 0.22 km² (55 per km²).",
    "Christian 7, Muslim 2, unknown 3.",
    "Diversity 0.76 bits among the 9 classified."
  ]);
  const lone = { ...cell, count: 1, density_per_km2: 1 / cell.area_km2, counts: { ...cell.counts, christian: 0, muslim: 0, unknown: 1 }, classified: 0, entropy_bits: null };
  assert.equal(describeCell(lone)[0], "1 place in this cell of 0.22 km² (4.6 per km²).");
  assert.match(describeCell(lone)[2], /not defined/);
});

test("worker failures name the tile", () => {
  assert.deepEqual(tileFailure("Tile 12/4036/2564: HTTP 503"), { tile: "12/4036/2564", reason: "HTTP 503" });
  assert.equal(tileFailure("Failed to fetch").tile, null);
});

test("sorting puts undefined diversity last in either direction", () => {
  const rows = [{ id: "a", diversity: 0.5 }, { id: "b", diversity: null }, { id: "c", diversity: 1.2 }];
  assert.deepEqual(sortRows(rows, "diversity").map((r) => r.id), ["c", "a", "b"]);
  assert.deepEqual(sortRows(rows, "diversity", "ascending").map((r) => r.id), ["a", "c", "b"]);
});
