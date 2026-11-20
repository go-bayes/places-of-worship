import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { gunzipSync, gzipSync } from "node:zlib";
import { ownershipProperties } from "../../shared/tile-ownership.mjs";
import { categoriseReligion, religionCategories } from "./categories.js";
import { collectPlaces, tilesCoveringBbox } from "./extent.js";
import { binPlaces, MAX_LINEAR_DISTORTION_AT_50_KM } from "./hexbin.js";
import { decodeMvtPoints } from "./mvt-points.js";
import { buildRelief } from "./relief-worker.js";

const bbox = [174.73, -41.34, 174.83, -41.26];
const zoom = 12;
const fixtures = [
  [4036, 2564, 86, ["St. Barnabas Anglican Church / Onslow Anglicans", "Futuna Chapel"]],
  [4036, 2565, 34, ["All Saints Anglican Church", "Theravada Place of Worship"]],
  [4037, 2564, 5, ["Miramar Christian School", "St Ronans Presbyterian Church"]],
  [4037, 2565, 12, ["Miramar Uniting Church", "Miramar Gospel Hall"]]
];
const expectedReconciliation = {
  tilesRequested: 4,
  tilesEmpty: 0,
  rawFeatures: 137,
  duplicatesRemoved: 8,
  outsideExtentRemoved: 12,
  kept: 117,
  keyless: 0
};

async function fixtureTile({ z, x, y }) {
  const file = await readFile(new URL(`fixtures/wellington-z${z}-${x}-${y}.pbf`, import.meta.url));
  return Uint8Array.from(file).buffer;
}

const collectWellington = () => collectPlaces({ bbox, zoom, fetchTile: fixtureTile });
const gunzip = (buffer) => Uint8Array.from(gunzipSync(new Uint8Array(buffer))).buffer;
const gzip = (buffer) => Uint8Array.from(gzipSync(new Uint8Array(buffer))).buffer;

test("Wellington MVT fixtures have the pinned point counts and names", async (t) => {
  for (const [x, y, count, names] of fixtures) {
    const tile = { z: zoom, x, y };
    const bytes = await fixtureTile(tile);
    const { foundLayer, points } = decodeMvtPoints(bytes, tile, "places");
    assert.equal(foundLayer, true);
    const records = points.map(({ properties }) => properties);
    t.diagnostic(`${zoom}/${x}/${y} · ${points.length} points · ${records.slice(0, 3).map(({ name }) => name).join(", ")}`);
    assert.equal(new Uint8Array(bytes, 0, 2)[0], 0x1a);
    assert.equal(points.length, count);
    assert.ok(records.every(({ id }) => /^[nw]\d+$/.test(id)));
    for (const name of names) assert.ok(records.some((p) => p.name === name), name);
    assert.deepEqual(decodeMvtPoints(bytes, tile, "missing"), { foundLayer: false, points: [] });
  }
  const tile = { z: zoom, x: 4036, y: 2564 };
  const { points: [barnabas] } = decodeMvtPoints(await fixtureTile(tile), tile, "places");
  assert.equal(barnabas.lon.toFixed(8), "174.79125738");
  assert.equal(barnabas.lat.toFixed(8), "-41.24462714");
  assert.equal(barnabas.properties.osm_id, 397049902);
  assert.equal(barnabas.properties.religion, "christian");
  assert.equal(barnabas.properties.denomination, "anglican");
  assert.equal(barnabas.properties.start_date, "1920");
});

test("Wellington fixtures contain only the engine and ownership properties", async () => {
  const allowed = new Set([...ownershipProperties, "start_date"]);
  for (const [x, y] of fixtures) {
    const tile = { z: zoom, x, y };
    const { points } = decodeMvtPoints(await fixtureTile(tile), tile, "places");
    for (const { properties } of points) {
      for (const key of Object.keys(properties)) assert.ok(allowed.has(key), `unexpected property ${key}`);
    }
  }
});

test("bounding box selects all four XYZ tiles and includes an exact east/south edge", () => {
  assert.deepEqual([...tilesCoveringBbox(bbox, zoom)], fixtures.map(([x, y]) => ({ z: zoom, x, y })));
  assert.deepEqual([...tilesCoveringBbox([-10, 0, 0, 10], 1)], [
    { z: 1, x: 0, y: 0 }, { z: 1, x: 0, y: 1 },
    { z: 1, x: 1, y: 0 }, { z: 1, x: 1, y: 1 }
  ]);
  // forward Mercator can place an exact row boundary fractionally above the row
  const row1024Latitude = 66.51326044311186;
  assert.deepEqual([...tilesCoveringBbox([-180, row1024Latitude, -179.98, 66.52], 12)], [
    { z: 12, x: 0, y: 1023 }, { z: 12, x: 0, y: 1024 }
  ]);
  assert.throws(() => tilesCoveringBbox([175, -42, -179, -40], zoom), /non-wrapping bbox/);
});

test("Wellington extent reconciles 137 decoded records to 117 places", async () => {
  const { points, reconciliation } = await collectWellington();
  assert.deepEqual(reconciliation, expectedReconciliation);
  assert.equal(new Set(points.map((p) => p.properties.id)).size, 117);
  assert.ok(points.every(({ lon, lat }) => lon >= bbox[0] && lon <= bbox[2] && lat >= bbox[1] && lat <= bbox[3]));
  assert.ok(points.some(({ properties }) => properties.id === "w968946836"));
});

// a small protobuf encoder for hand-authored geometry and scalar test cases
function varint(integer) {
  let remaining = BigInt.asUintN(64, BigInt(integer));
  const bytes = [];
  while (remaining > 127n) {
    bytes.push(Number(remaining & 127n) | 128);
    remaining >>= 7n;
  }
  return [...bytes, Number(remaining)];
}

const message = (tag, bytes) => [...varint(tag), ...varint(bytes.length), ...bytes];
const string = (tag, value) => message(tag, new TextEncoder().encode(value));
const scalar = (tag, value) => [...varint(tag), ...varint(value)];
const packed = (tag, values) => message(tag, values.flatMap(varint));
const zigzag = (delta) => delta < 0 ? -2 * delta - 1 : 2 * delta;

function feature(tags, coordinates, type = 1) {
  let x = 0;
  let y = 0;
  const geometry = [coordinates.length * 8 + 1];
  for (const [nextX, nextY] of coordinates) {
    geometry.push(zigzag(nextX - x), zigzag(nextY - y));
    x = nextX;
    y = nextY;
  }
  return message(18, [...packed(18, tags), ...scalar(24, type), ...packed(34, geometry)]);
}

function syntheticTile(features, keys, values, extent = 4096) {
  const layer = [
    ...features.flat(),
    ...string(10, "places"),
    ...keys.flatMap((key) => string(26, key)),
    ...values.flatMap((value) => message(34, value)),
    ...scalar(40, extent),
    ...scalar(120, 2)
  ];
  return Uint8Array.from(message(26, layer)).buffer;
}

test("decoder handles buffered multipoints, non-default extent and integer property types", () => {
  const tile = syntheticTile([
    feature([0, 0, 1, 1, 2, 2, 3, 3], [[2049, 1024], [2047, 1025]]),
    feature([], [[2, 2]], 2)
  ], ["id", "signed", "zigzag", "bool"], [
    scalar(40, 18446744073709551615n), scalar(32, -3), scalar(48, 13), scalar(56, 1)
  ], 2048);
  const { points } = decodeMvtPoints(tile, { z: 1, x: 0, y: 0 }, "places");
  assert.equal(points.length, 2);
  assert.equal(points[0].lon, 180 / 2048);
  assert.ok(points[0].lat > 66 && points[0].lat < 67);
  assert.ok(points[1].lon < points[0].lon && points[1].lat < points[0].lat);
  assert.deepEqual(points[0].properties, { id: "18446744073709551615", signed: -3, zigzag: -7, bool: true });
  assert.throws(() => decodeMvtPoints(tile.slice(0, -1), { z: 1, x: 0, y: 0 }, "places"), /Truncated/);
});

test("tile ownership preserves coincident records and reconciles far-edge multiplicity", async () => {
  const keys = ["name", "religion", "id"];
  const values = [string(10, "A"), string(10, "sikh"), string(10, "hindu"), scalar(40, 0)];
  const west = syntheticTile([
    feature([0, 0], [[4097, 2048], [4097, 2048]]),
    feature([0, 0, 1, 2], [[4097, 2048]]),
    feature([2, 3], [[4097, 2048]]),
    feature([0, 0, 1, 1], [[4096, 2048], [4096, 2048]])
  ], keys, values);
  const east = syntheticTile([
    feature([0, 0], [[1, 2048], [1, 2048]]),
    feature([0, 0, 1, 2], [[1, 2048]]),
    feature([2, 3], [[1, 2048], [2, 2048]]),
    feature([0, 0, 1, 1], [[0, 2048]])
  ], keys, values);
  const { points, reconciliation } = await collectPlaces({
    bbox: [-1, 65, 1, 70], zoom: 1, fetchTile: ({ x }) => x === 0 ? west : east
  });
  assert.equal(points.filter(({ properties }) => properties.id === 0).length, 2);
  assert.equal(points.filter(({ properties }) => properties.religion === "sikh").length, 2);
  assert.equal(points.filter(({ properties }) => properties.religion === "hindu").length, 1);
  assert.deepEqual(reconciliation, {
    tilesRequested: 2, tilesEmpty: 0, rawFeatures: 12, duplicatesRemoved: 5,
    outsideExtentRemoved: 0, kept: 7, keyless: 5
  });
});

test("collector detects gzip by magic bytes and uses the injected Node gunzip", async () => {
  const fetchTile = async (tile) => {
    const buffer = await fixtureTile(tile);
    return tile.x === 4036 && tile.y === 2564 ? gzip(buffer) : buffer;
  };
  assert.deepEqual(await collectPlaces({ bbox, zoom, fetchTile, gunzip }), await collectWellington());
  await assert.rejects(collectPlaces({ bbox, zoom, fetchTile }), /Tile 12\/4036\/2564: Gzip tile requires/);
});

test("collector counts empty tiles and identifies malformed tiles", async () => {
  const { reconciliation } = await collectPlaces({
    bbox, zoom, fetchTile: () => null
  });
  assert.deepEqual(reconciliation, {
    tilesRequested: 4, tilesEmpty: 4, rawFeatures: 0, duplicatesRemoved: 0,
    outsideExtentRemoved: 0, kept: 0, keyless: 0
  });
  await assert.rejects(collectPlaces({
    bbox, zoom, fetchTile: () => Uint8Array.of(0x1a, 9).buffer
  }), /Tile 12\/4036\/2564: Truncated protobuf field/);
});

test("category order, labels and colours mirror the live map", async () => {
  const path = new URL("../../../regions/_shared/region-map.js", import.meta.url);
  const source = await readFile(path, "utf8");
  const labels = source.match(/const countLabels = \[([\s\S]*?)\];/)[1];
  const live = [...labels.matchAll(/key: "([^"]+)", label: "([^"]+)", color: "([^"]+)"/g)]
    .map(([, key, label, color]) => ({ key, label, color }));
  assert.ok(live.length > 0);
  assert.deepEqual(religionCategories.slice(0, -1), live);
  assert.equal(religionCategories.at(-1).key, "other");
  assert.equal(categoriseReligion(" ChRiStIaN "), "christian");
  assert.equal(categoriseReligion("bahai"), "other");
  for (const unknown of [null, undefined, "", " Unknown "]) {
    assert.equal(categoriseReligion(unknown), "unknown");
  }
});

const grid = { bbox, cellMetres: 500 };
const atCentre = (religion) => ({ lon: 174.78, lat: -41.30, properties: { religion } });

test("entropy is null for empty and unknown-only data, zero for one class and one bit for two equal classes", () => {
  const empty = binPlaces([], grid);
  assert.deepEqual(empty.cells, []);
  assert.equal(empty.totals.entropy_bits, null);
  assert.equal(empty.totals.count, 0);
  const [unknownOnly] = binPlaces([atCentre()], grid).cells;
  assert.equal(unknownOnly.entropy_bits, null);
  assert.equal(unknownOnly.classified, 0);
  const [oneClass] = binPlaces([atCentre("sikh"), atCentre()], grid).cells;
  assert.equal(oneClass.entropy_bits, 0);
  const [twoClasses] = binPlaces([atCentre("sikh"), atCentre("bahai"), atCentre()], grid).cells;
  assert.equal(twoClasses.entropy_bits, 1);
  assert.equal(twoClasses.classified, 2);
  assert.equal(twoClasses.unknown, 1);
});

test("segments stack in palette order from zero to the complete cell count", () => {
  const points = ["bahai", "hindu", "", "christian", "christian"].map(atCentre);
  const [cell] = binPlaces(points, grid).cells;
  assert.equal(cell.count, 5);
  assert.deepEqual(cell.segments, [
    { category: "christian", count: 2, base: 0, top: 2 },
    { category: "hindu", count: 1, base: 2, top: 3 },
    { category: "unknown", count: 1, base: 3, top: 4 },
    { category: "other", count: 1, base: 4, top: 5 }
  ]);
});

test("Wellington hexes conserve counts and use the full projected area", async () => {
  const { points } = await collectWellington();
  const { cells, totals } = binPlaces(points, grid);
  assert.equal(cells.length, 58);
  assert.equal(totals.count, points.length);
  assert.equal(totals.classified, 101);
  assert.equal(totals.unknown, 16);
  assert.equal(totals.counts.christian, 94);
  assert.equal(totals.counts.other, 1);
  assert.equal(cells.reduce((sum, cell) => sum + cell.count, 0), 117);
  for (const cell of cells) {
    assert.equal(cell.ring.length, 7);
    assert.deepEqual(cell.ring[0], cell.ring.at(-1));
    assert.equal(cell.segments.at(-1).top, cell.count);
    assert.equal(Object.values(cell.counts).reduce((sum, n) => sum + n, 0), cell.count);
    assert.ok(Math.abs(cell.area_km2 - 0.21650635094610965) < 1e-12);
    assert.equal(cell.density_per_km2, cell.count / cell.area_km2);
  }
  // project the vertices into a Cartesian basis and verify the signed
  // shoelace area away from the grid origin as well as at the centre
  const earthRadius = 6371007.18;
  const radians = Math.PI / 180;
  const phi0 = -41.30 * radians;
  for (const cell of cells) {
    const xy = cell.ring.map(([lon, lat]) => {
      const lambda = (lon - 174.78) * radians;
      const phi = lat * radians;
      const k = Math.sqrt(2 / (1 + Math.sin(phi0) * Math.sin(phi) + Math.cos(phi0) * Math.cos(phi) * Math.cos(lambda)));
      return [
        earthRadius * k * Math.cos(phi) * Math.sin(lambda),
        earthRadius * k * (Math.cos(phi0) * Math.sin(phi) - Math.sin(phi0) * Math.cos(phi) * Math.cos(lambda))
      ];
    });
    const twiceArea = xy.slice(0, -1).reduce((sum, [x, y], i) => {
      const [nextX, nextY] = xy[i + 1];
      return sum + x * nextY - y * nextX;
    }, 0);
    assert.ok(Math.abs(twiceArea / 2e6 - cell.area_km2) < 1e-10, cell.id);
  }
  assert.ok(Math.abs(MAX_LINEAR_DISTORTION_AT_50_KM - 0.000007699) < 1e-9);
  assert.throws(() => binPlaces(points, { ...grid, cellMetres: 0 }), /hex width/);
});

test("worker builds GeoJSON using plain and gzip responses and reports HTTP failures", async () => {
  const request = { ...grid, zoom, tileUrlTemplate: "https://example.test/places/{z}/{x}/{y}" };
  const urls = [];
  const result = await buildRelief(request, {
    fetchResponse: async (url) => {
      urls.push(url);
      const [z, x, y] = url.split("/").slice(-3).map(Number);
      const buffer = await fixtureTile({ z, x, y });
      return new Response(x === 4036 ? gzip(buffer) : buffer);
    }
  });
  assert.deepEqual(urls, fixtures.map(([x, y]) => `https://example.test/places/12/${x}/${y}`));
  assert.deepEqual(result.reconciliation, expectedReconciliation);
  assert.equal(result.cells.type, "FeatureCollection");
  const footprints = result.cells.features.filter((f) => f.properties.kind === "footprint");
  const segments = result.cells.features.filter((f) => f.properties.kind === "segment");
  assert.equal(footprints.length, 58);
  assert.equal(segments.length, 75);
  assert.equal(new Set(result.cells.features.map(({ id }) => id)).size, 133);
  assert.equal(segments.reduce((sum, f) => sum + f.properties.count, 0), result.totals.count);
  for (const segment of segments) {
    const footprint = footprints.find(({ id }) => id === segment.properties.cell_id);
    assert.deepEqual(segment.geometry, footprint.geometry);
  }
  const empty = await buildRelief(request, { fetchResponse: () => new Response(null, { status: 204 }) });
  assert.equal(empty.reconciliation.tilesEmpty, 4);
  assert.deepEqual(empty.cells.features, []);
  await assert.rejects(buildRelief(request, {
    fetchResponse: () => new Response(null, { status: 404 })
  }), /Tile 12\/4036\/2564: HTTP 404/);
});

test("worker refuses partial, empty and non-point HTTP 200 tile data", async () => {
  const request = { ...grid, zoom, tileUrlTemplate: "https://example.test/places/{z}/{x}/{y}" };
  const address = /Tile 12\/4036\/2564:/;
  const unrelated = Uint8Array.from(message(26, string(10, "other")));
  for (const [label, response] of [
    ["HTTP 206", new Response(syntheticTile([feature([], [[1, 1]])], [], []), { status: 206 })],
    ["HTTP 200 with Content-Range", new Response(syntheticTile([feature([], [[1, 1]])], [], []), {
      headers: { "Content-Range": "bytes 0-99/200" }
    })],
    ["empty HTTP 200", new Response(null)],
    ["missing layer", new Response(unrelated)],
    ["empty places layer", new Response(syntheticTile([], [], []))],
    ["mixed geometry", new Response(syntheticTile([feature([], [[1, 1]]), feature([], [[1, 1]], 2)], [], []))]
  ]) {
    await assert.rejects(buildRelief(request, {
      fetchResponse: (url) => url.endsWith("/4036/2564") ? response : new Response(null, { status: 204 })
    }), address, label);
  }
});
