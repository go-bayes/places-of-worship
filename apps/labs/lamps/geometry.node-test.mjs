import test from "node:test";
import assert from "node:assert/strict";
import { metresPerPixel, pillarRadius, pillarHeight, hexagon, placesInTiles, PILLAR } from "./geometry.mjs";

test("a pixel spans about 0.3 m on the equator at zoom 18", () => {
  const m = metresPerPixel(18, 0);
  assert.ok(Math.abs(m - 0.2986) < 0.001, String(m));
  assert.ok(Math.abs(metresPerPixel(10, 60) - metresPerPixel(10, 0) / 2) < 1e-9);
});

test("pillars keep their symbolic size close in and grow further out", () => {
  assert.equal(pillarRadius(17, -41), PILLAR.radius);
  assert.equal(pillarHeight(17, -41), PILLAR.height);
  assert.ok(pillarRadius(12, -41) > PILLAR.radius);
  assert.ok(pillarHeight(12, -41) > PILLAR.height);
});

test("a hexagon has six corners at the radius", () => {
  const ring = hexagon([174.7762, -41.2865], 7);
  assert.equal(ring.length, 7);
  assert.deepEqual(ring[0], ring[6]);
  const R = 6378137;
  for (const [lng, lat] of ring.slice(0, 6)) {
    const dy = ((lat + 41.2865) * Math.PI / 180) * R;
    const dx = ((lng - 174.7762) * Math.PI / 180) * R * Math.cos(-41.2865 * Math.PI / 180);
    assert.ok(Math.abs(Math.hypot(dx, dy) - 7) < 0.01);
  }
});

function tilePoint(tile, x, y, properties) {
  return {
    tile, properties,
    _vectorTileFeature: { extent: 4096, loadGeometry: () => [[{ x, y }]] },
    geometry: { type: "Point", coordinates: [(tile.x + x / 4096) / 2 ** tile.z * 360 - 180, 1] }
  };
}

test("pillars keep owning occurrences including keyless twins and ID zero", () => {
  const west = { z: 8, x: 127, y: 127 };
  const east = { z: 8, x: 128, y: 127 };
  const props = { name: "Shared name" };
  const places = placesInTiles([
    tilePoint(west, 4097, 2048, props),
    tilePoint(east, 1, 2048, props),
    tilePoint(east, 1, 2048, props),
    tilePoint(east, 1, 2048, { ...props, id: 0 }),
    tilePoint(east, 1, 2048, { ...props, id: 0 }),
    tilePoint(west, 4096, 2048, { id: "edge" })
  ]);
  assert.equal(places.length, 5);
  assert.equal(new Set(places.map(({ id }) => id)).size, 5);
  assert.equal(places.filter(({ props }) => props.id === 0).length, 2);
  assert.equal(places.filter(({ props }) => props.id == null).length, 2);
});

test("a retained child edge replaces only matching parent occurrences", () => {
  const parent = { z: 12, x: 4036, y: 2564 };
  const west = { z: 13, x: 8072, y: 5128 };
  const parentCopy = tilePoint(parent, 2048, 1024, { id: "edge", start_date: "1920" });
  const childCopy = tilePoint(west, 4096, 2048, { id: "edge", start_date: "1952" });
  const otherPlace = tilePoint(parent, 2048, 1024, { id: "other" });
  const places = placesInTiles([parentCopy, childCopy, otherPlace]);
  assert.deepEqual(places.map(({ props }) => props.id).sort(), ["edge", "other"]);
  assert.equal(places.find(({ props }) => props.id === "edge").props.start_date, "1952");
  assert.equal(placesInTiles([parentCopy, parentCopy, childCopy]).length, 2);
});
