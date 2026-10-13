// the census button follows the layer (jb 2026-10-14, option b): while the
// census layer is off the panel is hidden, the button turns the layer back
// on, the data maps pill's dot agrees, and the remembered panel state
// survives for the layer's return. runs the real panel sync, enable, click
// and place-dot code from region-map.js against stubs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const runtime = fs.readFileSync(path.join(__dirname, "region-map.js"), "utf8");
const slice = (from, to) => {
  const a = runtime.indexOf(from);
  const b = runtime.indexOf(to, a);
  assert.ok(a >= 0 && b > a, `slice ${from}`);
  return runtime.slice(a, b);
};
const panelBody = slice("const CENSUS_PANEL_DISMISSED_KEY", "function censusActive()");
const enableBody = slice("function syncCensusChrome() {", "// switching geography swaps the source");
const clickBody = slice("if (censusToggle) {\n  syncCensusPanel();", "if (censusLevelSelect && HAS_CENSUS) {");
const foldBody = slice("function foldCensusForAbroad() {", "function judgeFix() {");
const dotsBody = slice("function syncPlaceDotEra() {", "function applyCensusPaint() {");
const settle = () => new Promise((r) => setImmediate(r));
let checks = 0;

function element(attrs = {}) {
  const listeners = {};
  const classes = new Set();
  return {
    hidden: false,
    textContent: "",
    attrs: { ...attrs },
    children: {},
    setAttribute(name, value) { this.attrs[name] = String(value); },
    getAttribute(name) { return name in this.attrs ? this.attrs[name] : null; },
    removeAttribute(name) { delete this.attrs[name]; },
    hasAttribute(name) { return name in this.attrs; },
    querySelector(sel) { return this.children[sel] || null; },
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    click() { (listeners.click || []).forEach((fn) => fn()); },
    classList: {
      toggle(name, on) { if (on) classes.add(name); else classes.delete(name); },
      contains(name) { return classes.has(name); }
    }
  };
}

function make({ mobile = false, dismissed = false, loads = true } = {}) {
  const log = [];
  const storage = new Map(dismissed ? [["pow-census-panel-dismissed", "1"]] : []);
  const toggle = element({ "aria-controls": "census-panel", "aria-expanded": "true" });
  toggle.children[".census-caret"] = Object.assign(element(), { textContent: "▴" });
  toggle.children[".census-label-short"] = Object.assign(element(), { textContent: "Census" });
  const panel = element();
  const close = element();
  const offerGo = element();
  const select = element();
  const periodOption = element();
  select.value = "all";
  select.children['option[value="period"]'] = periodOption;
  const layers = { overview: "visible", places: "visible" };
  const sandbox = {
    IS_MOBILE: mobile,
    HAS_CENSUS: true,
    RC: { dataNoun: "Census", datedPlaces: "x" },
    window: {
      sessionStorage: {
        getItem: (k) => (storage.has(k) ? storage.get(k) : null),
        setItem: (k, v) => storage.set(k, v),
        removeItem: (k) => storage.delete(k)
      }
    },
    censusState: { enabled: false, level: "sa2", year: 2018, metric: "x" },
    censusToggle: toggle,
    censusPanel: panel,
    document: { getElementById: (id) => ({ "census-close": close, censusPoints: select, "census-points-future": element() }[id] || null) },
    loadCensusData: () => { log.push("load"); return Promise.resolve(loads ? {} : null); },
    censusActive: () => null,
    syncCensusYearSelect: () => {}, syncCensusTimeSlider: () => {},
    addCensusLayers: () => log.push("add"), applyCensusPaint: () => log.push("paint"),
    removeCensusLayers: () => log.push("remove"), syncPlaceDotEra: () => {},
    updateCensusLegend: () => {}, writeCensusHash: () => {},
    offerMode: "toggle",
    // the bottom pill's dot reads the same flag
    renderOfferToggle: () => offerGo.setAttribute("aria-pressed", sandbox.censusState.enabled ? "true" : "false"),
    // place-dot stubs
    activeDomainId: "religion",
    placesDotState: { mode: null, future: false },
    effectivePointsMode: () => sandbox.placesDotState.mode || "all",
    placeSnapshotStale: () => false,
    syncDatedPlaces: () => {}, syncPulotuCultures: () => {},
    // the key sync is in the slice; with no key element it returns at once
    keyWrap: null, countsToggle: null,
    LAYERS: { overview: "overview", places: "places" },
    map: {
      getLayer: () => true,
      setLayoutProperty: (id, key, value) => { layers[id] = value; },
      setPaintProperty: () => {}
    },
    log, storage, toggle, panel, close, offerGo, select, periodOption, layers
  };
  vm.createContext(sandbox);
  vm.runInContext(
    `${panelBody}\n${enableBody}\n${clickBody}\n${foldBody}\n` +
    `this.realSyncPlaceDotEra = (function () {\n${dotsBody}\nreturn syncPlaceDotEra;\n})();\n` +
    "this.state = () => ({ censusPanelOpen, censusLayerSettled });",
    sandbox
  );
  return sandbox;
}

const on = (t) => {
  assert.equal(t.panel.hidden, !t.state().censusPanelOpen, "the panel follows its own open state");
  assert.equal(t.toggle.getAttribute("aria-controls"), "census-panel", "the button controls the panel");
  assert.equal(t.toggle.getAttribute("aria-expanded"), t.state().censusPanelOpen ? "true" : "false", "aria-expanded follows the panel");
  assert.equal(t.toggle.getAttribute("aria-label"), null, "the visible label names the button");
  assert.equal(t.toggle.children[".census-caret"].hidden, false, "the caret shows");
  assert.equal(t.toggle.children[".census-caret"].textContent, t.state().censusPanelOpen ? "▴" : "▾", "the caret follows the panel");
  assert.equal(t.toggle.children[".census-label-short"].textContent, "Census", "the short label is the noun");
  assert.equal(t.offerGo.getAttribute("aria-pressed"), "true", "the bottom dot reads on");
  checks += 8;
};
const off = (t) => {
  assert.equal(t.panel.hidden, true, "the panel hides while the layer is off");
  assert.equal(t.toggle.hasAttribute("aria-expanded"), false, "no expanded state while off");
  assert.equal(t.toggle.hasAttribute("aria-controls"), false, "no controlled panel while off");
  assert.equal(t.toggle.getAttribute("aria-label"), "Show Census Data on the map", "the action names the layer");
  assert.equal(t.toggle.children[".census-caret"].hidden, true, "no fold caret while off");
  assert.equal(t.toggle.children[".census-label-short"].textContent, "Show Census", "the short label reads as the action");
  assert.equal(t.toggle.classList.contains("census-off"), true, "the off class is set");
  assert.equal(t.offerGo.getAttribute("aria-pressed"), "false", "the bottom dot reads off");
  checks += 8;
};

(async () => {
  // before the first enable the button reads as on, so loading shows no off state
  let t = make();
  assert.equal(t.panel.hidden, false, "the panel is open before the default enable");
  assert.equal(t.toggle.getAttribute("aria-expanded"), "true", "the button is a disclosure before the default enable");
  checks += 2;

  // default enable, then off from the bottom pill, then back on from the top button
  await t.setCensusEnabled(true);
  on(t);
  await t.setCensusEnabled(false);
  off(t);
  assert.equal(t.state().censusPanelOpen, true, "turning off keeps the remembered open state");
  checks += 1;
  t.log.length = 0;
  t.toggle.click();
  await settle();
  assert.deepEqual(t.log, ["load", "add", "paint"], "the top button turns the layer back on");
  assert.equal(t.censusState.enabled, true, "the layer is on");
  checks += 2;
  on(t);
  // fold and unfold still work while on, and do not touch the layer
  t.toggle.click();
  assert.equal(t.state().censusPanelOpen, false, "a click while on folds the panel");
  assert.equal(t.censusState.enabled, true, "folding leaves the layer on");
  checks += 2;
  on(t);
  t.toggle.click();
  on(t);

  // a folded panel stays folded across off and on
  t.toggle.click();
  await t.setCensusEnabled(false);
  off(t);
  t.toggle.click();
  await settle();
  on(t);
  assert.equal(t.panel.hidden, true, "the folded panel returns folded");
  checks += 1;

  // a phone dismissal is not cleared by the layer going off
  t = make({ mobile: true, dismissed: true });
  await t.setCensusEnabled(true);
  on(t);
  assert.equal(t.panel.hidden, true, "a remembered dismissal folds the panel");
  await t.setCensusEnabled(false);
  off(t);
  assert.equal(t.storage.get("pow-census-panel-dismissed"), "1", "the dismissal memory survives the off state");
  t.toggle.click();
  await settle();
  on(t);
  assert.equal(t.storage.get("pow-census-panel-dismissed"), "1", "turning on does not rewrite the memory");
  checks += 3;

  // a failed load leaves both pills off, and the button retries
  t = make({ loads: false });
  await t.setCensusEnabled(true);
  off(t);
  t.log.length = 0;
  t.toggle.click();
  await settle();
  assert.deepEqual(t.log, ["load"], "the button retries the load");
  checks += 1;
  off(t);

  // a foreign location fix turns the layer off without folding the panel
  t = make();
  await t.setCensusEnabled(true);
  t.foldCensusForAbroad();
  await settle();
  off(t);
  assert.equal(t.state().censusPanelOpen, true, "the abroad fold keeps the remembered panel state");
  checks += 1;

  // the points select works in both states
  t = make();
  t.censusState.enabled = true;
  t.placesDotState.mode = "off";
  t.realSyncPlaceDotEra();
  assert.equal(t.layers.places, "none", "points off hides the dots with the census on");
  assert.equal(t.periodOption.disabled, false, "period is offered with the census on");
  t.censusState.enabled = false;
  t.realSyncPlaceDotEra();
  assert.equal(t.layers.places, "none", "points off hides the dots with the census off");
  assert.equal(t.select.value, "off", "the select keeps the chosen off mode");
  t.placesDotState.mode = "all";
  t.realSyncPlaceDotEra();
  assert.equal(t.layers.places, "visible", "points all shows the dots with the census off");
  t.placesDotState.mode = "period";
  t.realSyncPlaceDotEra();
  assert.equal(t.layers.places, "visible", "period falls back to all with the census off");
  assert.equal(t.select.value, "all", "the select shows the effective mode");
  assert.equal(t.periodOption.disabled, true, "period is unavailable with the census off");
  t.activeDomainId = "health";
  t.placesDotState.mode = "off";
  t.realSyncPlaceDotEra();
  assert.equal(t.layers.places, "visible", "another domain keeps its census-off dots");
  checks += 9;

  console.log(`census chrome: ${checks} checks passed`);
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
