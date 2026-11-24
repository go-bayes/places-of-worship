import test from "node:test";
import assert from "node:assert/strict";
import {
  TRADITIONS,
  DAY,
  NIGHT,
  INK,
  VELLUM,
  mix,
  over,
  contrast,
  daylight,
  twilight,
  panelTones,
  sceneTones
} from "./palette.mjs";

test("tradition colours keep the live map's ruled hues", () => {
  const byKey = Object.fromEntries(TRADITIONS.map((t) => [t.key, t.color]));
  assert.equal(byKey.christian, "#e11d48");
  assert.equal(byKey.muslim, "#16a34a");
  assert.equal(byKey.hindu, "#f97316");
  assert.equal(byKey.buddhist, "#facc15");
  assert.equal(byKey.jewish, "#2563eb");
  assert.equal(byKey.sikh, "#7c3aed");
  assert.equal(byKey.other, "#9ca3af");
});

test("mixing returns the end colours at the ends", () => {
  assert.equal(mix(NIGHT.land, DAY.land, 0), NIGHT.land);
  assert.equal(mix(NIGHT.land, DAY.land, 1), DAY.land);
  assert.equal(over("#000000", 0.5, "#ffffff"), "#808080");
});

test("contrast follows the wcag formula", () => {
  assert.equal(Math.round(contrast("#000000", "#ffffff") * 10) / 10, 21);
  assert.ok(contrast(INK, DAY.land) > 12);
  assert.ok(contrast(VELLUM, NIGHT.land) > 14);
});

test("daylight runs from civil twilight to just above the horizon", () => {
  assert.equal(daylight(-20), 0);
  assert.equal(daylight(-6), 0);
  assert.equal(daylight(3), 1);
  assert.equal(daylight(45), 1);
  const mid = daylight(-1.5);
  assert.ok(mid > 0.4 && mid < 0.6);
  assert.equal(twilight(30), 0);
  assert.ok(twilight(-1.5) > 0.99);
});

test("panel text clears 4.5:1 at every blend, over any backdrop", () => {
  for (let i = 0; i <= 100; i += 1) {
    const p = panelTones(i / 100);
    assert.ok(p.contrast >= 4.5, `t=${i / 100}: text ${p.contrast.toFixed(2)}`);
    assert.ok(p.mutedContrast >= 4.5, `t=${i / 100}: muted ${p.mutedContrast.toFixed(2)}`);
  }
  assert.equal(panelTones(1).text, INK);
  assert.equal(panelTones(0).text, VELLUM);
});

test("scene tones blend between the named palettes", () => {
  assert.equal(sceneTones(1).land, DAY.land);
  assert.equal(sceneTones(0).water, NIGHT.water);
});
