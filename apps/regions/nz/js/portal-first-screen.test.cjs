// the portal's first screen (jb 2026-09-19: "fewer words", "land on
// hybrid", "keep the data sources buttons on the map with a fold"): the
// sign-in card carries the google button, one way to ask for access and the
// account help; the map lands on hybrid where imagery exists and returns
// there when a mode ends; the map data panel folds to its bar and remembers
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const values = new Map();
const localStorage = {
  get length() { return values.size; },
  getItem(key) { return values.has(key) ? values.get(key) : null; },
  setItem(key, value) { values.set(key, String(value)); },
  removeItem(key) { values.delete(key); },
  key(index) { return [...values.keys()][index] ?? null; },
};
const classList = () => {
  const set = new Set();
  return {
    add(name) { set.add(name); },
    remove(name) { set.delete(name); },
    toggle(name, force) { const on = force === undefined ? !set.has(name) : Boolean(force); if (on) set.add(name); else set.delete(name); return on; },
    contains(name) { return set.has(name); },
  };
};
const elements = new Map();
const element = (id, extra = {}) => {
  const item = { id, value: "", hidden: true, textContent: "", attrs: {}, classList: classList(), disabled: false,
    setAttribute(name, value) { this.attrs[name] = value; }, addEventListener() {}, ...extra };
  elements.set(id, item);
  return item;
};
const document = {
  body: { classList: classList() },
  getElementById(id) { return elements.get(id) || null; },
  createElement() { return { textContent: "", remove() {} }; },
  querySelector() { return null; },
  querySelectorAll() { return []; },
};
let phone = false;
const window = {
  __POW_TEST_NO_BOOTSTRAP__: true,
  location: { search: "?batch=nz-temporal-ra-workpack-001", pathname: "/apps/regions/nz/verification.html" },
  localStorage, sessionStorage: localStorage,
  setTimeout, clearTimeout,
  matchMedia: () => ({ matches: phone }),
  isSecureContext: true,
  // a maptiler key, so the hybrid and satellite layers exist and the
  // landing basemap is hybrid, as on the live portal
  MAPTILER_API_KEY: "test-key",
};
const navigator = { geolocation: null };
const context = vm.createContext({
  window, document, localStorage, sessionStorage: localStorage, navigator,
  URLSearchParams, Map, Set, Date, Number, String, Boolean, Object, Array, Math, JSON, RegExp, Intl, console, setTimeout, clearTimeout, Promise, Error,
});
for (const file of ["occupancy-contract.js", "function-chain-contract.js", "verification-map.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, file), "utf8"), context, { filename: file });
}

const fresh = () => Object.create(window.NzVerificationMap.prototype);

// 1. the sign-in card: two choices and the account help, nothing else
{
  const app = fresh();
  app.backendUser = null;
  app.pendingDeepLink = null;
  app.backendLastError = "";
  app.backend = { configured: true, signedIn: false, renderSignInButton() { return Promise.resolve(); } };
  app.syncPortalChrome = () => {};
  app.getRaInitials = () => "";
  const panel = element("backendPanel", { hidden: false });
  app.renderBackendPanel();
  const html = panel.innerHTML;
  assert.match(html, /1\. Sign in to start/);
  assert.match(html, /id="googleSignInButton"/);
  assert.match(html, /class="join-button"[^>]*>Contact to join</, "one brief way to ask for access");
  assert.match(html, /<summary>Wrong account showing\?<\/summary>/, "the account help stays, folded");
  assert.doesNotMatch(html, /Use the Google account JB invited/, "the invitation paragraph is gone");
  assert.doesNotMatch(html, /Assigned batch/, "the batch id lives in the header, not the card");
  assert.doesNotMatch(html, /Not a project member yet/, "the access paragraph became the button");
  const words = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().split(" ").length;
  assert.ok(words <= 45, `the signed-out card reads in under 45 words, got ${words}`);
  // a parked place is still named on the card
  app.pendingDeepLink = { name: "Sacred Heart Cathedral" };
  app.renderBackendPanel();
  assert.match(panel.innerHTML, /Sign in to revise <em>Sacred Heart Cathedral<\/em>/);
}

// 2. the map lands on hybrid and comes back to it when a mode ends
{
  const app = fresh();
  const events = [];
  const layer = (name) => ({ name, addTo() { events.push(`add:${name}`); layers.add(name); return this; }, bringToBack() {} });
  const layers = new Set();
  app.map = {
    hasLayer(l) { return layers.has(l.name); },
    addLayer(l) { layers.add(l.name); },
    removeLayer(l) { layers.delete(l.name); events.push(`remove:${l.name}`); },
    getContainer() { return { classList: classList() }; },
    getZoom() { return 17; },
  };
  app.streetsLayer = layer("streets");
  app.hybridLayer = layer("hybrid");
  app.satelliteLayer = layer("satellite");
  layers.add("streets");
  app.basemap = "streets";
  app.basemapUserChosen = false;
  app.probeImagery = () => Promise.resolve();
  app.syncContextDots = () => {};
  const quiet = ["renderInitialDetail", "renderBackendPanel", "setPastSubmissionsOpen", "resumeRapidPinFromDevice", "syncPortalChrome", "clearFormDirty"];
  quiet.forEach((name) => { app[name] = () => {}; });
  // setPortalMode acts only for a signed-in contributor with no open entry
  app.backendUser = { _id: "user_1" };
  app.formDirty = false;
  app.pinMode = false;
  app.selectedTask = null;
  // an activity ending brings an automatic basemap home to hybrid
  app.portalMode = "add";
  app.setPortalMode(null);
  assert.equal(app.basemap, "hybrid", "the landing basemap is hybrid when imagery is configured");
  assert.deepEqual(events, ["add:hybrid", "remove:streets"], "hybrid goes on before streets comes off");
  // a basemap the contributor chose stands
  events.length = 0;
  app.basemap = "satellite";
  app.basemapUserChosen = true;
  app.portalMode = "add";
  app.setPortalMode(null);
  assert.equal(app.basemap, "satellite", "a chosen basemap is not overridden");
  assert.deepEqual(events, []);
  // pin placement lifts an automatic streets map to hybrid, never a chosen one
  app.basemap = "streets";
  app.basemapUserChosen = true;
  assert.equal(app.liftBasemapForPin(), false);
  assert.equal(app.basemap, "streets", "streets chosen by hand stays through pin placement");
  app.basemapUserChosen = false;
  assert.equal(app.liftBasemapForPin(), true);
  assert.equal(app.basemap, "hybrid", "an automatic streets map lifts to hybrid for aiming");
  assert.equal(app.liftBasemapForPin(), false, "nothing to lift once on imagery");
}

// 3. the map data panel folds to its bar and remembers on the device
{
  const app = fresh();
  const parts = {};
  const div = {
    classList: classList(),
    querySelector(selector) { return parts[selector] || null; },
  };
  parts[".legend-fold"] = { attrs: {}, setAttribute(n, v) { this.attrs[n] = v; } };
  parts[".legend-caret"] = { textContent: "▾" };
  parts[".legend-body"] = { hidden: false };
  app.mapDataPanel = div;
  assert.equal(app.mapDataFoldedOnDevice(), false, "open by default");
  assert.equal(app.setMapDataFolded(true, { chosen: true }), true);
  assert.equal(div.classList.contains("folded"), true);
  assert.equal(parts[".legend-body"].hidden, true, "the body folds away");
  assert.equal(parts[".legend-fold"].attrs["aria-expanded"], "false");
  assert.equal(parts[".legend-caret"].textContent, "▸");
  assert.equal(localStorage.getItem("pow-map-data-folded"), "1", "the fold is remembered on the device");
  assert.equal(app.mapDataFoldedOnDevice(), true);
  app.setMapDataFolded(false);
  assert.equal(parts[".legend-body"].hidden, false);
  assert.equal(parts[".legend-caret"].textContent, "▾");
  assert.equal(localStorage.getItem("pow-map-data-folded"), "1", "an automatic unfold leaves the memory alone");
  app.setMapDataFolded(false, { chosen: true });
  assert.equal(localStorage.getItem("pow-map-data-folded"), "0");
  assert.equal(fresh().setMapDataFolded(true), false, "no panel, nothing to fold");
}

// 4. the floating sign-in panel drags by its header grip, bound once
{
  const app = fresh();
  const calls = [];
  const panel = { classList: classList() };
  const grip = { addEventListener() {} };
  document.querySelector = (selector) => (selector === ".app-shell > .sidebar" ? panel : null);
  element("signInPanelGrip", grip);
  app.makeControlMovable = (div, handle, key, options) => { calls.push({ div, handle, key, options }); };
  assert.equal(fresh().makeSignInPanelMovable(), false, "no map, nothing to bind");
  app.map = { on() {}, getContainer() { return { getBoundingClientRect() { return { left: 0, top: 0, right: 1440, bottom: 900 }; } }; } };
  assert.equal(app.makeSignInPanelMovable(), true);
  assert.equal(app.makeSignInPanelMovable(), false, "bound once");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].div, panel);
  assert.equal(calls[0].key, "pow-signin-panel-offset", "the panel keeps its own spot, apart from the map data panel");
  // the offset applies only while the page is signed out
  document.body.classList.add("portal-signed-out");
  assert.equal(calls[0].options.active(), true);
  document.body.classList.remove("portal-signed-out");
  assert.equal(calls[0].options.active(), false, "signed in, the work sidebar carries no offset");
  document.querySelector = () => null;
}

// 5. the real drag helper paints no offset and skips the clamp while inactive
{
  const app = fresh();
  let on = true;
  const style = {};
  const div = { style, classList: classList(), getBoundingClientRect() { return { left: 0, top: 0, right: 100, bottom: 100 }; } };
  const handlers = {};
  const grip = { addEventListener(name, fn) { handlers[name] = fn; }, setPointerCapture() {}, releasePointerCapture() {} };
  let resize = null;
  app.map = { on(name, fn) { if (name === "resize") resize = fn; }, getContainer() { return { getBoundingClientRect() { return { left: 0, top: 0, right: 1440, bottom: 900 }; } }; } };
  localStorage.setItem("pow-test-offset", JSON.stringify({ x: 40, y: 30 }));
  app.makeControlMovable(div, grip, "pow-test-offset", { active: () => on });
  // the first paint waits for layout (a clamp on a zero timeout)
  (async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(style.transform, "translate(40px, 30px)", "the remembered spot paints while active");
    on = false;
    resize();
    assert.equal(style.transform, "", "inactive, a resize paints nothing and leaves the spot alone");
    assert.equal(localStorage.getItem("pow-test-offset"), JSON.stringify({ x: 40, y: 30 }));
    on = true;
    resize();
    assert.equal(style.transform, "translate(40px, 30px)", "active again, the spot returns");
    localStorage.removeItem("pow-test-offset");
    console.log("drag helper gating ok");
  })().catch((error) => { console.error(error); process.exit(1); });
}

console.log("portal first screen ok");
