// sun position, the day and night terminator, and local clock helpers.
// dependency-free, so the page and the node tests share one source.
//
// the solar coordinates follow the noaa spreadsheet formulation of meeus,
// astronomical algorithms (2nd ed., ch. 25): good to about 0.01 degrees in
// declination for dates within a few centuries of j2000, far finer than a
// map can show.

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const MINUTE_MS = 60000;
const DAY_MS = 1440 * MINUTE_MS;

// the sun's centre is at this altitude when its upper limb touches the
// horizon, after standard refraction (34') and the solar semidiameter (16')
export const SUNRISE_ALTITUDE = -0.833;

const wrap360 = (x) => ((x % 360) + 360) % 360;
const wrap180 = (x) => wrap360(x + 180) - 180;

function julianCentury(ms) {
  const jd = ms / 86400000 + 2440587.5;
  return (jd - 2451545) / 36525;
}

// declination (degrees) and the equation of time (minutes) at an instant
export function solarCoordinates(date) {
  const ms = date instanceof Date ? date.getTime() : Number(date);
  const t = julianCentury(ms);
  const l0 = wrap360(280.46646 + t * (36000.76983 + t * 0.0003032));
  const m = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const c = Math.sin(m * RAD) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(2 * m * RAD) * (0.019993 - 0.000101 * t) +
    Math.sin(3 * m * RAD) * 0.000289;
  const omega = 125.04 - 1934.136 * t;
  const lambda = l0 + c - 0.00569 - 0.00478 * Math.sin(omega * RAD);
  const eps0 = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(omega * RAD);
  const declination = Math.asin(Math.sin(eps * RAD) * Math.sin(lambda * RAD)) * DEG;
  const y = Math.tan((eps / 2) * RAD) ** 2;
  const eot = 4 * DEG * (
    y * Math.sin(2 * l0 * RAD) -
    2 * e * Math.sin(m * RAD) +
    4 * e * y * Math.sin(m * RAD) * Math.cos(2 * l0 * RAD) -
    0.5 * y * y * Math.sin(4 * l0 * RAD) -
    1.25 * e * e * Math.sin(2 * m * RAD)
  );
  return { declination, equationOfTime: eot };
}

// the point on earth with the sun overhead: [lng, lat] in degrees
export function subsolarPoint(date) {
  const ms = date instanceof Date ? date.getTime() : Number(date);
  const { declination, equationOfTime } = solarCoordinates(ms);
  const utcMinutes = (((ms / 60000) % 1440) + 1440) % 1440;
  const lng = wrap180((720 - utcMinutes - equationOfTime) / 4);
  return [lng, declination];
}

function unit(lng, lat) {
  const cl = Math.cos(lat * RAD);
  return [cl * Math.cos(lng * RAD), cl * Math.sin(lng * RAD), Math.sin(lat * RAD)];
}

// altitude above the horizon and azimuth clockwise from north, in degrees,
// without refraction. the geometry is exact for a spherical earth
export function sunPosition(date, lng, lat) {
  const [sl, sp] = subsolarPoint(date);
  const s = unit(sl, sp);
  const sinp = Math.sin(lat * RAD);
  const cosp = Math.cos(lat * RAD);
  const sinl = Math.sin(lng * RAD);
  const cosl = Math.cos(lng * RAD);
  const up = s[0] * cosp * cosl + s[1] * cosp * sinl + s[2] * sinp;
  const east = -s[0] * sinl + s[1] * cosl;
  const north = -s[0] * sinp * cosl - s[1] * sinp * sinl + s[2] * cosp;
  const altitude = Math.asin(Math.max(-1, Math.min(1, up))) * DEG;
  const azimuth = wrap360(Math.atan2(east, north) * DEG);
  return { altitude, azimuth };
}

// apparent solar time at a longitude, in minutes after local solar midnight
export function solarMinutes(date, lng) {
  const [sl] = subsolarPoint(date);
  return wrap360(lng - sl + 180) * 4;
}

// ---- terminator --------------------------------------------------------

// the point at angular distance d (degrees) from a centre along a bearing
function destination(lat, lng, d, bearing) {
  const p1 = lat * RAD;
  const dr = d * RAD;
  const b = bearing * RAD;
  const p2 = Math.asin(Math.sin(p1) * Math.cos(dr) + Math.cos(p1) * Math.sin(dr) * Math.cos(b));
  const l2 = lng * RAD + Math.atan2(Math.sin(b) * Math.sin(dr) * Math.cos(p1), Math.cos(dr) - Math.sin(p1) * Math.sin(p2));
  return [l2 * DEG, p2 * DEG];
}

// the region where the sun is lower than `altitude` degrees is a spherical
// cap centred on the antisolar point with radius 90 + altitude. this returns
// it as a geojson polygon ring in longitude and latitude. a cap that holds a
// pole is closed along that pole, so the ring spans 360 degrees of longitude;
// longitudes run past 180 where the ring crosses the antimeridian, which
// the map's tiler wraps
export function capRing(centerLng, centerLat, radius, steps = 360) {
  // a centre exactly on the equator makes the 90-degree cap a great circle
  // through both poles; a hair of latitude decides which pole it holds
  const lat0 = Math.abs(centerLat) < 1e-4 ? (centerLat < 0 ? -1e-4 : 1e-4) : centerLat;
  const holdsNorth = 90 - lat0 < radius;
  const holdsSouth = 90 + lat0 < radius;
  const pts = [];
  let prev = null;
  for (let i = 0; i < steps; i += 1) {
    const [lng, lat] = destination(lat0, centerLng, radius, (360 * i) / steps);
    let x = lng;
    if (prev !== null) {
      // unwrap so neighbouring points never jump by a whole turn
      while (x - prev > 180) x -= 360;
      while (x - prev < -180) x += 360;
    } else {
      x = wrap180(x);
    }
    pts.push([x, lat]);
    prev = x;
  }
  if (!holdsNorth && !holdsSouth) {
    pts.push(pts[0]);
    return pts;
  }
  // close the last step so the ring returns to its start one turn over
  let close = pts[0][0];
  while (close - prev > 180) close -= 360;
  while (close - prev < -180) close += 360;
  pts.push([close, pts[0][1]]);
  // order by longitude, west to east, then run along the pole back west
  if (pts[pts.length - 1][0] < pts[0][0]) pts.reverse();
  // start the run in [-180, 0) so it never reaches past 360, inside the
  // range the tiler wraps
  const start = wrap180(pts[0][0]);
  const shift = start - pts[0][0] - (start >= 0 ? 360 : 0);
  const run = pts.map(([x, y]) => [x + shift, y]);
  const pole = holdsNorth ? 90 : -90;
  const west = run[0][0];
  const east = run[run.length - 1][0];
  return [...run, [east, pole], [west, pole], run[0]];
}

// a band above the horizon can contain both poles near an equinox
export const NIGHT_BANDS = Array.from({ length: 33 }, (_, i) => 0 - i * 0.5);

// nested caps, one per altitude, as a feature collection. stacking them in
// one translucent fill gives the night side a soft edge through twilight
// `alpha` gives each cap's own opacity, when the stack should follow a
// particular profile; see shadeAlphas
export function nightCaps(date, altitudes, alphas = null) {
  const [sl, sp] = subsolarPoint(date);
  const anti = [wrap180(sl + 180), -sp];
  return {
    type: "FeatureCollection",
    features: altitudes.map((h, i) => ({
      type: "Feature",
      properties: alphas ? { altitude: h, alpha: alphas[i] } : { altitude: h },
      geometry: { type: "Polygon", coordinates: [capRing(anti[0], anti[1], 90 + h)] }
    }))
  };
}

// per-cap opacities for a stack of nested caps (shallowest first) whose
// combined opacity rises smoothly from 0 above the first cap to `depth`
// at the last. `profile(x)` maps 0..1 across the stack to 0..1 coverage
export function shadeAlphas(count, depth, profile = (x) => x * x * (3 - 2 * x)) {
  const alphas = [];
  let prev = 0;
  for (let i = 0; i < count; i += 1) {
    const target = depth * profile((i + 1) / count);
    alphas.push(prev >= 1 ? 0 : 1 - (1 - target) / (1 - prev));
    prev = target;
  }
  return alphas;
}

// ---- clocks ------------------------------------------------------------

const formatters = new Map();
function partsFormatter(zone) {
  if (!formatters.has(zone)) {
    formatters.set(zone, new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }));
  }
  return formatters.get(zone);
}

// minutes the zone's wall clock runs ahead of utc at an instant
export function zoneOffsetMinutes(date, zone) {
  const ms = date instanceof Date ? date.getTime() : Number(date);
  const p = Object.fromEntries(partsFormatter(zone).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  const wall = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((wall - Math.floor(ms / 1000) * 1000) / 60000);
}

// a clock is either a named zone or local apparent solar time at a longitude.
// clockMinutes gives minutes after that clock's midnight at an instant
export function clockMinutes(date, clock) {
  const ms = date instanceof Date ? date.getTime() : Number(date);
  if (clock.zone) {
    const m = ms / 60000 + zoneOffsetMinutes(ms, clock.zone);
    return ((m % 1440) + 1440) % 1440;
  }
  return solarMinutes(ms, clock.lng);
}

function civilDate(ms, zone) {
  const wall = ms + zoneOffsetMinutes(ms, zone) * MINUTE_MS;
  return Math.floor(wall / DAY_MS) * DAY_MS;
}

function civilMidnight(wall, zone) {
  const before = zoneOffsetMinutes(wall - DAY_MS, zone);
  const after = zoneOffsetMinutes(wall + DAY_MS, zone);
  const candidates = [wall - before * MINUTE_MS, wall - after * MINUTE_MS].sort((a, b) => a - b);
  for (const ms of candidates) {
    if (ms + zoneOffsetMinutes(ms, zone) * MINUTE_MS === wall) return ms;
  }
  // if midnight is skipped, start at the first instant after the jump
  let [lo, hi] = candidates;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (mid + zoneOffsetMinutes(mid, zone) * MINUTE_MS < wall) lo = mid;
    else hi = mid;
  }
  return hi;
}

// the earliest instant of midnight, or the first instant after a gap
export function clockDayStart(date, clock) {
  const ms = date instanceof Date ? date.getTime() : Number(date);
  if (clock.zone) return civilMidnight(civilDate(ms, clock.zone), clock.zone);
  return ms - clockMinutes(ms, clock) * MINUTE_MS;
}

// the slider advances in elapsed minutes between local midnights, skipping
// missing wall times and visiting both occurrences of a repeated wall time
export function dayProfile(date, clock, lng, lat, stepMinutes = 10) {
  const ms = date instanceof Date ? date.getTime() : Number(date);
  const start = clockDayStart(date, clock);
  const end = clock.zone ? civilMidnight(civilDate(ms, clock.zone) + DAY_MS, clock.zone) : start + DAY_MS;
  const duration = (end - start) / MINUTE_MS;
  const alt = (min) => sunPosition(start + min * MINUTE_MS, lng, lat).altitude;
  const samples = [];
  for (let m = 0; m < duration; m += stepMinutes) samples.push([m, alt(m)]);
  samples.push([duration, alt(duration)]);
  const crossings = [];
  for (let i = 1; i < samples.length; i += 1) {
    const [m0, a0] = samples[i - 1];
    const [m1, a1] = samples[i];
    const s0 = a0 - SUNRISE_ALTITUDE;
    const s1 = a1 - SUNRISE_ALTITUDE;
    if (s0 === 0 || s0 * s1 >= 0) continue;
    let lo = m0;
    let hi = m1;
    for (let k = 0; k < 30; k += 1) {
      const mid = (lo + hi) / 2;
      const sm = alt(mid) - SUNRISE_ALTITUDE;
      if ((sm < 0) === (s0 < 0)) lo = mid; else hi = mid;
    }
    crossings.push({ minutes: (lo + hi) / 2, kind: s0 < 0 ? "sunrise" : "sunset" });
  }
  const sunrise = crossings.find((c) => c.kind === "sunrise") || null;
  const sunset = crossings.find((c) => c.kind === "sunset") || null;
  const above = samples.filter(([, a]) => a > SUNRISE_ALTITUDE).length;
  return {
    dayStart: start,
    dayEnd: end,
    duration,
    samples,
    sunrise: sunrise ? sunrise.minutes : null,
    sunset: sunset ? sunset.minutes : null,
    allDay: crossings.length === 0 && above === samples.length,
    allNight: crossings.length === 0 && above === 0
  };
}

export function formatClock(minutes) {
  const m = Math.round(minutes) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

// "sun 12° below the horizon", in words a screen reader can say
export function describeAltitude(altitude) {
  const a = Math.round(altitude);
  if (a === 0) return "sun on the horizon";
  return a > 0 ? `sun ${a}° above the horizon` : `sun ${-a}° below the horizon`;
}
