// entry follows the pin (jb ruling 2026-09-23): the page is where the
// contributor lands; the entry's country is derived from the pin through
// the shared resolver, a moved entry carries a warning and never a block,
// and the contributor's own work follows the user. held by the actual
// portal class in a stub dom, with the real registry and resolver
const assert = require("node:assert/strict");
const loose = require("node:assert");
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
    add(name) { set.add(name); }, remove(name) { set.delete(name); },
    toggle(name, force) { const on = force === undefined ? !set.has(name) : Boolean(force); if (on) set.add(name); else set.delete(name); return on; },
    contains(name) { return set.has(name); },
  };
};
const elements = new Map();
const element = (id, extra = {}) => {
  const item = { id, value: "", hidden: true, textContent: "", innerHTML: "", attrs: {}, classList: classList(), disabled: false,
    setAttribute(name, value) { this.attrs[name] = value; }, removeAttribute(name) { delete this.attrs[name]; },
    addEventListener() {}, querySelectorAll() { return []; }, ...extra };
  elements.set(id, item);
  return item;
};
const title = { textContent: "Sweden evidence" };
const document = {
  body: { classList: classList() },
  getElementById(id) { return elements.get(id) || null; },
  createElement() { return { textContent: "", classList: classList(), remove() {}, addEventListener() {} }; },
  querySelector(selector) { return selector === ".sidebar-header h1" ? title : null; },
  querySelectorAll() { return []; },
  addEventListener() {}, removeEventListener() {},
};
// the sweden page: any ?country= code opens the portal through the registry
const window = {
  __POW_TEST_NO_BOOTSTRAP__: true,
  location: { search: "?country=se&batch=manual-se", pathname: "/apps/regions/nz/verification.html" },
  localStorage, sessionStorage: localStorage,
  setTimeout, clearTimeout,
  matchMedia: () => ({ matches: false }),
  isSecureContext: true,
};
const navigator = { geolocation: null };
const context = vm.createContext({
  window, document, localStorage, sessionStorage: localStorage, navigator,
  URLSearchParams, Map, Set, Date, Number, String, Boolean, Object, Array, Math, JSON, RegExp, Intl, console, setTimeout, clearTimeout, Promise, Error,
});
for (const file of ["../../../shared/data/country-registry.js", "../../../shared/region-resolve.js", "occupancy-contract.js", "function-chain-contract.js", "task-presentation.js", "verification-map.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, file), "utf8"), context, { filename: file });
}

const fresh = () => {
  const app = Object.create(window.NzVerificationMap.prototype);
  app.backendUser = { _id: "user_1" };
  app.backend = { configured: true, signedIn: true };
  app.pinMode = false;
  app.quickPhoto = null;
  app.pinCountry = null;
  app.pinMarker = null;
  app.entryPageRegions = null;
  app.entryWorldRegions = null;
  app.pageTitleText = undefined;
  title.textContent = "Sweden evidence";
  return app;
};

// 1. before any outline arrives the registry's boxes place the point:
//    stockholm stays on the page's country, wellington moves to new
//    zealand, and open ocean keeps the page's country unresolved
{
  const app = fresh();
  const home = app.entryCountryFor(59.3293, 18.0686);
  assert.equal(home.code, "SE");
  assert.equal(home.moved, false);
  assert.equal(home.method, "box");
  const away = app.entryCountryFor(-41.2865, 174.7762);
  assert.equal(away.code, "NZ");
  assert.equal(away.name, "New Zealand");
  assert.equal(away.moved, true);
  loose.deepEqual(away.config.targetYears.map(Number), [2013, 2018, 2023], "the entry takes the pin country's census years");
  const sea = app.entryCountryFor(-45, 160);
  assert.equal(sea.code, "SE");
  assert.equal(sea.resolved, false);
  assert.equal(sea.moved, false);
}

// 2. an outline manifest wins over the boxes: a point inside a neighbour's
//    box but on this country's land resolves by outline
{
  const app = fresh();
  app.entryPageRegions = [
    { code: "se", name: "Sweden", boxes: [[10, 55, 25, 70]], rings: [[[10, 55], [25, 55], [25, 70], [10, 70], [10, 55]]] },
    { code: "no", name: "Norway", boxes: [[4, 57, 31, 71]], rings: [[[4, 57], [9.9, 57], [9.9, 71], [4, 71], [4, 57]]] },
  ];
  const inside = app.entryCountryFor(60, 15);
  assert.equal(inside.code, "SE");
  assert.equal(inside.method, "outline");
  const west = app.entryCountryFor(60, 7);
  assert.equal(west.code, "NO");
  assert.equal(west.moved, true);
}

// 3. the pin's note and the header follow the pin, and clear when the
//    entry closes; a home pin shows nothing
{
  const app = fresh();
  const note = element("pinCountryNote");
  app.notePinCountry({ lat: -41.2865, lng: 174.7762 });
  assert.equal(note.hidden, false);
  assert.equal(note.textContent, "This pin is in New Zealand; this page opened for Sweden. The entry is recorded as New Zealand.");
  assert.equal(title.textContent, "Sweden evidence · entry in New Zealand");
  assert.equal(app.entryCountry().code, "NZ");
  app.notePinCountry({ lat: 59.3293, lng: 18.0686 });
  assert.equal(note.hidden, true);
  assert.equal(title.textContent, "Sweden evidence");
  app.notePinCountry({ lat: -41.2865, lng: 174.7762 });
  // the real exitPinMode drops the pin's country and restores the header
  app.map = { off() {}, removeLayer() {}, getContainer: () => ({ classList: classList() }) };
  app.dropRapidPinFromDevice = () => {};
  app.clearFormDirty = () => {};
  app.setEntryOpen = () => {};
  app.paneSnap = () => {};
  app.renderAddReviseControl = () => {};
  app.pinUncertaintyCircle = null;
  app.exitPinMode();
  assert.equal(app.pinCountry, null);
  assert.equal(app.entryCountry().code, "SE");
  assert.equal(note.hidden, true);
  assert.equal(title.textContent, "Sweden evidence");
}

// 4. an outline arriving mid-entry re-reads the open pin
{
  const app = fresh();
  element("pinCountryNote");
  app.pinMarker = { getLatLng: () => ({ lat: 60, lng: 7 }) };
  app.notePinCountry(app.pinMarker.getLatLng());
  const byBox = app.pinCountry.method;
  assert.equal(byBox, "box");
  app.entryPageRegions = [
    { code: "no", name: "Norway", boxes: [[4, 57, 31, 71]], rings: [[[4, 57], [9.9, 57], [9.9, 71], [4, 71], [4, 57]]] },
  ];
  app.refreshEntryCountry();
  assert.equal(app.pinCountry.method, "outline");
  assert.equal(app.pinCountry.code, "NO");
}

// 5. own work follows the user: the assignment batch and any country's
//    nomination or issue batch, nothing else
{
  const app = fresh();
  assert.equal(app.ownWorkBatch("manual-se"), true);
  assert.equal(app.ownWorkBatch("manual-nz"), true);
  assert.equal(app.ownWorkBatch("ra-issues-vu"), true);
  assert.equal(app.ownWorkBatch("nz-temporal-ra-workpack-001"), false);
  assert.equal(app.ownWorkBatch(""), false);
}

console.log("entry-country: ok");
