import test from "node:test";
import assert from "node:assert/strict";
import { metresPerPixel, pillarRadius, pillarHeight, hexagon, dedupeById, PILLAR } from "./geometry.mjs";

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

test("features from overlapping tiles collapse to one place each", () => {
  const f = (id, x) => ({ properties: { id }, geometry: { type: "Point", coordinates: [x, 1] } });
  const places = dedupeById([f("n1", 1), f("n1", 1.0000001), f("w2", 2), { properties: {}, geometry: { type: "Point", coordinates: [3, 3] } }]);
  assert.deepEqual(places.map((p) => p.id), ["n1", "w2", "3.000000,3.000000"]);
});
