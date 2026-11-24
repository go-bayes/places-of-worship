// node --test apps/labs/**/*.node-test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  solarCoordinates,
  subsolarPoint,
  sunPosition,
  solarMinutes,
  capRing,
  nightCaps,
  NIGHT_BANDS,
  zoneOffsetMinutes,
  clockMinutes,
  clockDayStart,
  dayProfile,
  formatClock,
  describeAltitude
} from "./sun.mjs";

const near = (actual, expected, tol, label) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${label}: ${actual} not within ${tol} of ${expected}`);

test("declination at the solstices and an equinox", () => {
  near(solarCoordinates(Date.UTC(2026, 5, 21, 12)).declination, 23.44, 0.02, "june solstice");
  near(solarCoordinates(Date.UTC(2026, 11, 21, 12)).declination, -23.44, 0.02, "december solstice");
  // the march equinox of 2026 falls at 14:46 utc on 20 march
  near(solarCoordinates(Date.UTC(2026, 2, 20, 14, 46)).declination, 0, 0.01, "march equinox");
});

test("equation of time at its yearly extremes", () => {
  near(solarCoordinates(Date.UTC(2026, 1, 11, 12)).equationOfTime, -14.2, 0.2, "mid february");
  near(solarCoordinates(Date.UTC(2026, 10, 3, 12)).equationOfTime, 16.4, 0.2, "early november");
});

test("the subsolar point lies on the meridian of solar noon", () => {
  const t = Date.UTC(2026, 5, 21, 12);
  const [lng, lat] = subsolarPoint(t);
  near(lat, 23.44, 0.02, "subsolar latitude");
  // equation of time near -1.8 minutes: noon reaches greenwich at about
  // 12:01:50, so at 12:00 the sun stands slightly east of it
  near(lng, 0.45, 0.05, "subsolar longitude");
  near(sunPosition(t, lng, lat).altitude, 90, 1e-6, "overhead at the subsolar point");
  near(solarMinutes(t, lng), 720, 1e-6, "solar noon there");
});

test("altitude and azimuth at greenwich on the june solstice", () => {
  // solar noon at greenwich: altitude 90 - 51.4769 + 23.44, sun due south
  const noon = Date.UTC(2026, 5, 21, 12, 1, 42);
  const p = sunPosition(noon, 0, 51.4769);
  near(p.altitude, 61.96, 0.05, "noon altitude");
  near(p.azimuth, 180, 0.3, "noon azimuth");
  // the morning sun stands in the east, the evening sun in the west
  assert.ok(sunPosition(Date.UTC(2026, 5, 21, 7), 0, 51.4769).azimuth < 120);
  assert.ok(sunPosition(Date.UTC(2026, 5, 21, 17), 0, 51.4769).azimuth > 240);
});

test("london sunrise and sunset on the june solstice", () => {
  const clock = { zone: "Europe/London" };
  const day = dayProfile(Date.UTC(2026, 5, 21, 12), clock, -0.1276, 51.5072, 10);
  // published times: 04:43 and 21:21 british summer time
  near(day.sunrise, 4 * 60 + 43, 2, "sunrise");
  near(day.sunset, 21 * 60 + 21, 2, "sunset");
  assert.equal(day.allDay, false);
  assert.equal(day.allNight, false);
});

test("polar night and midnight sun in tromsø", () => {
  const clock = { zone: "Europe/Oslo" };
  const winter = dayProfile(Date.UTC(2026, 11, 21, 12), clock, 18.9553, 69.6492);
  assert.equal(winter.allNight, true);
  assert.equal(winter.sunrise, null);
  const summer = dayProfile(Date.UTC(2026, 5, 21, 12), clock, 18.9553, 69.6492);
  assert.equal(summer.allDay, true);
});

test("zone offsets and clock minutes", () => {
  assert.equal(zoneOffsetMinutes(Date.UTC(2026, 10, 20, 8), "Pacific/Auckland"), 780);
  assert.equal(zoneOffsetMinutes(Date.UTC(2026, 6, 1), "Pacific/Auckland"), 720);
  assert.equal(zoneOffsetMinutes(Date.UTC(2026, 6, 1), "Europe/London"), 60);
  const t = Date.UTC(2026, 10, 20, 8, 14);
  assert.equal(clockMinutes(t, { zone: "Pacific/Auckland" }), 21 * 60 + 14);
  assert.equal(formatClock(clockMinutes(t, { zone: "Pacific/Auckland" })), "21:14");
  const start = clockDayStart(t, { zone: "Pacific/Auckland" });
  assert.equal(new Date(start).toISOString(), "2026-11-19T11:00:00.000Z");
  // local solar time runs four minutes per degree of longitude
  const solarA = clockMinutes(t, { lng: 0 });
  const solarB = clockMinutes(t, { lng: 15 });
  near(((solarB - solarA) + 1440) % 1440, 60, 1e-6, "an hour per fifteen degrees");
});

test("Auckland's spring slider day skips the missing hour", () => {
  const clock = { zone: "Pacific/Auckland" };
  const date = Date.parse("2026-09-27T00:00:00Z");
  const day = dayProfile(date, clock, 174.76, -36.85);
  assert.equal(clockDayStart(date, clock), Date.parse("2026-09-26T12:00:00Z"));
  assert.equal(day.dayEnd, Date.parse("2026-09-27T11:00:00Z"));
  assert.equal(day.duration, 23 * 60);
  assert.equal(clockMinutes(day.dayStart + 119 * 60000, clock), 119);
  assert.equal(clockMinutes(day.dayStart + 120 * 60000, clock), 180);
  near(sunPosition(day.dayStart + day.sunrise * 60000, 174.76, -36.85).altitude, -0.833, 1e-5, "sunrise");
});

test("Auckland's autumn slider day includes both occurrences of the repeated hour", () => {
  const clock = { zone: "Pacific/Auckland" };
  const date = Date.parse("2026-04-05T00:00:00Z");
  const day = dayProfile(date, clock, 174.76, -36.85);
  assert.equal(clockDayStart(date, clock), Date.parse("2026-04-04T11:00:00Z"));
  assert.equal(day.dayEnd, Date.parse("2026-04-05T12:00:00Z"));
  assert.equal(day.duration, 25 * 60);
  assert.equal(clockMinutes(day.dayStart + 150 * 60000, clock), 150);
  assert.equal(clockMinutes(day.dayStart + 210 * 60000, clock), 150);
});

test("the slider spans 24 hours in a zone without daylight saving", () => {
  const clock = { zone: "Asia/Kolkata" };
  const date = Date.parse("2026-09-27T00:00:00Z");
  const day = dayProfile(date, clock, 77.21, 28.61, 17);
  assert.equal(day.dayStart, Date.parse("2026-09-26T18:30:00Z"));
  assert.equal(day.dayEnd, Date.parse("2026-09-27T18:30:00Z"));
  assert.equal(day.duration, 1440);
  assert.equal(day.samples.at(-1)[0], 1440);
  assert.equal(clockMinutes(day.dayStart + 12 * 3600000, clock), 720);
});

test("altitude in words", () => {
  assert.equal(describeAltitude(-12.4), "sun 12° below the horizon");
  assert.equal(describeAltitude(33.6), "sun 34° above the horizon");
  assert.equal(describeAltitude(0.2), "sun on the horizon");
});

// ray casting in plain longitude and latitude, trying the copies of the
// point one turn east and west because rings may run past 180
function inside(ring, lng, lat) {
  for (const shift of [-360, 0, 360]) {
    const x = lng + shift;
    let hit = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if ((yi > lat) !== (yj > lat) && x < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) hit = !hit;
    }
    if (hit) return true;
  }
  return false;
}

// a small deterministic generator so the sample points are the same each run
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const MOMENTS = [
  Date.UTC(2026, 5, 21, 3, 10),
  Date.UTC(2026, 11, 21, 19, 40),
  Date.UTC(2026, 2, 20, 14, 46),
  Date.UTC(2026, 10, 20, 8, 14),
  Date.UTC(2026, 8, 23, 0, 5)
];

test("every deployed night band encloses the night side at the March equinox", () => {
  const t = Date.UTC(2026, 2, 20, 14, 46);
  const [lng, lat] = subsolarPoint(t);
  const rand = lcg(20260320);
  for (const { properties: { altitude }, geometry: { coordinates: [ring] } } of nightCaps(t, NIGHT_BANDS).features) {
    assert.equal(inside(ring, lng, lat), false, `subsolar point at ${altitude}°`);
    assert.equal(inside(ring, lng + 180, -lat), true, `antisolar point at ${altitude}°`);
    for (let i = 0; i < 300; i++) {
      const x = rand() * 360 - 180;
      const y = rand() * 180 - 90;
      const h = sunPosition(t, x, y).altitude;
      if (Math.abs(h - altitude) >= 1.5) assert.equal(inside(ring, x, y), h < altitude);
    }
  }
});

test("terminator rings follow the iso-altitude line", () => {
  for (const t of MOMENTS) {
    for (const feature of nightCaps(t, [0, -6, -12, -18]).features) {
      const h = feature.properties.altitude;
      const ring = feature.geometry.coordinates[0];
      assert.deepEqual(ring[0], ring[ring.length - 1], "ring is closed");
      for (const [lng, lat] of ring) {
        if (Math.abs(lat) === 90) continue;
        near(sunPosition(t, lng, lat).altitude, h, 1e-6, `boundary at ${new Date(t).toISOString()} h=${h}`);
        // the tiler wraps one world either side; rings stay well inside that
        assert.ok(lng >= -360 && lng <= 360, `longitude ${lng} inside the wrapped range`);
      }
    }
  }
});

test("terminator rings hold exactly the places where the sun is lower", () => {
  const rand = lcg(20261120);
  for (const t of MOMENTS) {
    for (const feature of nightCaps(t, [0, -6, -12, -18]).features) {
      const h = feature.properties.altitude;
      const ring = feature.geometry.coordinates[0];
      let checked = 0;
      for (let k = 0; k < 600; k += 1) {
        const lng = rand() * 360 - 180;
        const lat = Math.asin(rand() * 2 - 1) * 180 / Math.PI;
        const alt = sunPosition(t, lng, lat).altitude;
        // the ring is a chain of short chords; stay clear of the edge
        if (Math.abs(alt - h) < 1.5) continue;
        checked += 1;
        assert.equal(inside(ring, lng, lat), alt < h, `(${lng.toFixed(2)}, ${lat.toFixed(2)}) alt ${alt.toFixed(2)} h ${h}`);
      }
      assert.ok(checked > 400);
    }
  }
});

test("a cap centred on the equator still closes on one pole", () => {
  const ring = capRing(30, 0, 90, 180);
  const poles = ring.filter(([, lat]) => Math.abs(lat) === 90);
  assert.equal(poles.length, 2);
  assert.deepEqual(ring[0], ring[ring.length - 1]);
});

test("shade alphas stack to the requested depth", async () => {
  const { shadeAlphas } = await import("./sun.mjs");
  const alphas = shadeAlphas(34, 0.9);
  let clear = 1;
  for (const a of alphas) {
    assert.ok(a >= 0 && a < 1);
    clear *= 1 - a;
  }
  near(1 - clear, 0.9, 1e-9, "combined opacity");
});
