// phone panes and the contributor's position (jb 2026-09-05), held by the
// actual portal class in a stub dom: the divider snaps to the nearest of
// three detents, a pointer over the shell maps to the entry share in either
// stacking order, a chosen split is remembered on the device, the pin flow
// snaps map / half / entry / rest, and "Use my location" lands the pending
// pin on the device's fix or reports why it could not
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

// 1. detents and the pointer mapping
{
  const app = fresh();
  assert.equal(app.paneDetentFor(10), 15);
  assert.equal(app.paneDetentFor(30), 15);
  assert.equal(app.paneDetentFor(40), 50);
  assert.equal(app.paneDetentFor(70), 85);
  assert.equal(app.paneDetentFor(95), 85);
  assert.equal(app.paneDetentFor("x"), 50);
  const rect = { top: 0, height: 1000 };
  document.body.classList.add("assignment-mode");
  assert.equal(app.paneShareFromPointer(200, rect), 20, "entry on top: the divider's distance from the top is the entry share");
  assert.equal(app.paneShareFromPointer(20, rect), 15, "clamped at the outer detents");
  assert.equal(app.paneShareFromPointer(990, rect), 85);
  document.body.classList.remove("assignment-mode");
  assert.equal(app.paneShareFromPointer(200, rect), 80, "map on top: the entry share is the rest");
  document.body.classList.add("assignment-mode");
  app.paneShare = 50;
  assert.equal(app.paneDetentTowards(-1), 15, "arrow up with the entry on top shrinks the entry");
  assert.equal(app.paneDetentTowards(1), 85);
  app.paneShare = 85;
  assert.equal(app.paneDetentTowards(1), 85, "no detent beyond the last");
}

// 2. snapping: inert on desktop, live on a phone, chosen splits remembered
{
  const app = fresh();
  const styles = {};
  app.paneShell = { style: { setProperty(name, value) { styles[name] = value; } }, classList: classList() };
  app.map = { invalidateSize() { app.map.invalidated = (app.map.invalidated || 0) + 1; } };
  element("paneDivider");
  phone = false;
  assert.equal(app.paneSnap("map"), false, "desktop: nothing to snap");
  phone = true;
  app.paneRestShare = 50;
  assert.equal(app.paneSnap("map"), true);
  assert.equal(styles["--entry-share"], "15", "aiming a pin gives the map most of the screen");
  assert.equal(elements.get("paneDivider").attrs["aria-valuenow"], "15");
  app.paneSnap("half");
  assert.equal(styles["--entry-share"], "50");
  app.paneSnap("entry");
  assert.equal(styles["--entry-share"], "85");
  app.paneSnap("rest");
  assert.equal(styles["--entry-share"], "50", "rest is where the contributor last put it");
  assert.equal(localStorage.getItem("pow-pane-split"), null, "an automatic snap is not remembered");
  app.setPaneSplit(80, { chosen: true });
  assert.equal(styles["--entry-share"], "85", "a drag lands on the nearest detent");
  assert.equal(localStorage.getItem("pow-pane-split"), "85", "and is remembered on the device");
  app.paneSnap("map");
  app.paneSnap("rest");
  assert.equal(styles["--entry-share"], "85", "rest follows the chosen split");
  // the pin flow's own hooks go through the same snap
  app.setEntryOpen(false);
  assert.equal(styles["--entry-share"], "85");
}

// 3. use my location: the fix lands the pending pin, failures explain themselves
{
  const app = fresh();
  app.pinMode = true;
  app.pinConfirmed = null;
  app.map = null;
  const pending = [];
  app.setPendingPin = (lat, lng, options) => pending.push({ lat, lng, ...options });
  app.showPositionOnMap = (fix) => { app.shown = fix; };
  element("pinSearchStatus", { hidden: false });
  element("pinStatus", { hidden: false });
  element("pinLocateMeButton", { hidden: false });
  (async () => {
    navigator.geolocation = null;
    assert.equal(app.geolocationAvailable(), false);
    assert.equal(await app.dropPinAtMyLocation(), false);
    assert.match(elements.get("pinSearchStatus").textContent, /no location here/);
    navigator.geolocation = { getCurrentPosition(ok) { ok({ coords: { latitude: -17.7404, longitude: 168.321, accuracy: 12.4 } }); } };
    assert.equal(app.geolocationAvailable(), true);
    assert.equal(await app.dropPinAtMyLocation(), true);
    assert.deepEqual(pending, [{ lat: -17.7404, lng: 168.321, zoom: 17 }], "the pending pin lands on the fix at street zoom");
    assert.equal(app.shown.accuracyM, 12, "the ring shows the fix's accuracy");
    assert.match(elements.get("pinStatus").textContent, /about 12 m/);
    assert.doesNotMatch(elements.get("pinStatus").textContent, /rough/);
    assert.equal(elements.get("pinLocateMeButton").disabled, false, "the button is usable again");
    navigator.geolocation = { getCurrentPosition(ok) { ok({ coords: { latitude: -17.7, longitude: 168.3, accuracy: 240 } }); } };
    await app.dropPinAtMyLocation();
    assert.match(elements.get("pinStatus").textContent, /rough here/, "a wide fix says so");
    navigator.geolocation = { getCurrentPosition(ok, fail) { fail({ code: 1 }); } };
    assert.equal(await app.dropPinAtMyLocation(), false);
    assert.match(elements.get("pinSearchStatus").textContent, /Location access was refused/);
    navigator.geolocation = { getCurrentPosition(ok, fail) { fail({ code: 3 }); } };
    await app.dropPinAtMyLocation();
    assert.match(elements.get("pinSearchStatus").textContent, /took too long/);
    app.pinConfirmed = { latitude: 1, longitude: 2 };
    assert.equal(await app.dropPinAtMyLocation(), false);
    assert.match(elements.get("pinSearchStatus").textContent, /already confirmed/);
    app.pinMode = false;
    assert.equal(await app.dropPinAtMyLocation(), false, "nothing outside the pin flow");
    console.log("phone panes and use-my-location ok");
  })().catch((error) => { console.error(error); process.exit(1); });
}
