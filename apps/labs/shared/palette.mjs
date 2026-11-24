// day and night palettes for the labs pages, the blend between them by the
// sun's altitude, and the contrast arithmetic that keeps panel text legible.
// colours mix in oklab, so the twilight tones stay clean instead of greying.

export const TRADITIONS = [
  { key: "christian", label: "Christian", color: "#e11d48" },
  { key: "muslim", label: "Muslim", color: "#16a34a" },
  { key: "hindu", label: "Hindu", color: "#f97316" },
  { key: "buddhist", label: "Buddhist", color: "#facc15" },
  { key: "jewish", label: "Jewish", color: "#2563eb" },
  { key: "sikh", label: "Sikh", color: "#7c3aed" },
  { key: "shinto", label: "Shinto", color: "#ec4899" },
  { key: "taoist", label: "Taoist", color: "#06b6d4" },
  // every other value, and none, draws in the live map's fallback grey
  { key: "other", label: "Other or unknown", color: "#9ca3af" }
];

export const KNOWN_TRADITIONS = TRADITIONS.filter((t) => t.key !== "other").map((t) => t.key);

export const DAY = {
  land: "#e7e4da",
  water: "#b9cfd6",
  sky: "#cfdde3",
  horizon: "#eef0ea",
  space: "#dfe5e6",
  text: "#1d2233",
  building: "#d3cfc4",
  road: "#fbf9f3",
  boundary: "#8d8a9c",
  shadow: "#7d7a8e",
  highlight: "#ffffff"
};

export const NIGHT = {
  land: "#161b3a",
  water: "#0d1230",
  sky: "#0b1030",
  horizon: "#232a55",
  space: "#060816",
  text: "#f3efe4",
  building: "#2e3563",
  road: "#2c3463",
  boundary: "#4b5287",
  shadow: "#05071a",
  highlight: "#2d3566"
};

// over the whole globe by day the land takes a mid stone tone, so yellow
// and orange lights keep their edge against it
export const DAY_GLOBE = { land: "#bdb5a3", water: "#9db3bd" };

export const LAMP_GOLD = "#ffc66b";
export const INK = "#1d2233";
export const VELLUM = "#f3efe4";
// the warm band low in the sky while the sun is near the horizon
export const TWILIGHT_HORIZON = "#e9a77a";

// ---- colour arithmetic ---------------------------------------------------

export function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
}

export function rgbToHex(rgb) {
  return "#" + rgb.map((c) => Math.round(Math.max(0, Math.min(1, c)) * 255).toString(16).padStart(2, "0")).join("");
}

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLinear = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

function rgbToOklab(rgb) {
  const [r, g, b] = rgb.map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  ];
}

function oklabToRgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  ].map((c) => fromLinear(Math.max(0, Math.min(1, c))));
}

// t = 0 gives a, t = 1 gives b
export function mix(a, b, t) {
  const x = rgbToOklab(hexToRgb(a));
  const y = rgbToOklab(hexToRgb(b));
  return rgbToHex(oklabToRgb(x.map((v, i) => v + (y[i] - v) * t)));
}

// straight alpha compositing in srgb, as the browser does
export function over(top, alpha, bottom) {
  const t = hexToRgb(top);
  const b = hexToRgb(bottom);
  return rgbToHex(t.map((c, i) => c * alpha + b[i] * (1 - alpha)));
}

export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// ---- the sun's altitude as a blend --------------------------------------

const smoothstep = (e0, e1, x) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// 0 in full night, 1 in full day. the change runs from 6 degrees below the
// horizon (the end of civil twilight) to 3 degrees above it, so twilight
// is short and the page settles into one palette or the other
export function daylight(altitude) {
  return smoothstep(-6, 3, altitude);
}

// how much warm twilight colour the horizon carries: most at sunset
export function twilight(altitude) {
  return Math.max(0, 1 - Math.abs(altitude + 1.5) / 7.5);
}

// ---- panels ------------------------------------------------------------

// panels are a translucent wash of the sky tone. text is ink or vellum,
// whichever reads better, and the wash is pushed toward the matching end
// of the palette until the text clears `comfort` contrast over any map
// colour beneath, judged against black and white backdrops. secondary
// text may fall to `target` and no further
export const PANEL_ALPHA = 0.86;

export function panelTones(t, target = 4.6, comfort = 7) {
  let wash = mix(NIGHT.sky, DAY.horizon, t);
  const worst = (text, bg) => Math.min(
    contrast(text, over(bg, PANEL_ALPHA, "#000000")),
    contrast(text, over(bg, PANEL_ALPHA, "#ffffff"))
  );
  const useInk = worst(INK, wash) >= worst(VELLUM, wash);
  const text = useInk ? INK : VELLUM;
  const toward = useInk ? DAY.horizon : NIGHT.sky;
  let step = 0;
  while (worst(text, wash) < comfort && step < 40) {
    wash = mix(wash, toward, 0.15);
    step += 1;
  }
  // secondary text eases toward the wash, but never below the target
  let muted = text;
  for (let k = 0.3; k > 0; k -= 0.03) {
    const candidate = mix(text, wash, k);
    if (worst(candidate, wash) >= target) {
      muted = candidate;
      break;
    }
  }
  return {
    wash,
    text,
    muted,
    dark: !useInk,
    hairline: useInk ? "rgba(29, 34, 51, 0.22)" : "rgba(243, 239, 228, 0.22)",
    contrast: worst(text, wash),
    mutedContrast: worst(muted, wash)
  };
}

// every tone the scene needs for a blend t and a twilight warmth w
export function sceneTones(t, w = 0) {
  const tone = (k) => mix(NIGHT[k], DAY[k], t);
  const horizon = mix(tone("horizon"), TWILIGHT_HORIZON, w * 0.75);
  return {
    land: tone("land"),
    water: tone("water"),
    sky: mix(tone("sky"), mix(NIGHT.sky, "#5b5f8f", 0.6), w * 0.35),
    horizon,
    space: tone("space"),
    building: tone("building"),
    road: tone("road"),
    boundary: tone("boundary"),
    shadow: tone("shadow"),
    highlight: tone("highlight"),
    label: mix(VELLUM, INK, t),
    labelHalo: mix(NIGHT.land, DAY.land, t)
  };
}
