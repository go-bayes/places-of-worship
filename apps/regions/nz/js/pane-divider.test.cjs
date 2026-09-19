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

// 4. side by side (jb 2026-09-19): the same divider drags the sidebar width,
//    remembered apart from the stacked split; the stacking order is the user's
{
  const app = fresh();
  const styles = {};
  const shellAttrs = {};
  app.paneShell = {
    style: { setProperty(name, value) { styles[name] = value; } },
    classList: classList(),
    getBoundingClientRect() { return { left: 0, top: 0, width: 1440, height: 900 }; },
    setAttribute(name, value) { shellAttrs[name] = value; },
    removeAttribute(name) { delete shellAttrs[name]; },
    getAttribute(name) { return shellAttrs[name] ?? null; },
  };
  app.map = { invalidated: 0, invalidateSize() { app.map.invalidated += 1; } };
  const divider = element("paneDivider");
  divider.querySelector = () => null;
  phone = false;
  assert.equal(app.paneColumnsActive(), true);
  assert.equal(app.clampSidebarWidth(100, 1440), 320, "the sidebar never drops below 320px");
  assert.equal(app.clampSidebarWidth(2000, 1440), 864, "nor above six tenths of the shell");
  assert.equal(app.clampSidebarWidth("x", 1440), 420, "nonsense is the default");
  assert.equal(app.sidebarWidthFromPointer(500), 500, "a pointer over the shell is the sidebar width");
  assert.equal(app.applySidebarWidth(500), true);
  assert.equal(styles["--sidebar-w"], "500px");
  assert.equal(app.map.invalidated, 1, "leaflet re-measures when the width changes");
  assert.equal(localStorage.getItem("pow-pane-split-cols"), null, "an automatic width is not remembered");
  app.applySidebarWidth(560, { chosen: true });
  assert.equal(localStorage.getItem("pow-pane-split-cols"), "560", "a drag by hand is remembered on the device");
  assert.equal(divider.attrs["aria-valuenow"], "560");
  app.refreshPaneAxis();
  assert.equal(divider.attrs["aria-orientation"], "vertical");
  assert.equal(divider.attrs["aria-valuemax"], "864");
  assert.equal(app.paneSnap("map"), false, "the stacked snaps stay inert side by side");
  // a narrower window re-clamps the painted width; the remembered width stands
  app.paneShell.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });
  app.applySidebarWidth(Number(localStorage.getItem("pow-pane-split-cols")));
  assert.equal(styles["--sidebar-w"], "480px", "six tenths of an 800px window");
  assert.equal(localStorage.getItem("pow-pane-split-cols"), "560", "the device still remembers the chosen width");
  app.paneShell.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1440, height: 900 });
  app.applySidebarWidth(Number(localStorage.getItem("pow-pane-split-cols")));
  assert.equal(styles["--sidebar-w"], "560px", "and it returns when the window widens");
  // stacked again: the axis flips and the stacking order is the user's
  phone = true;
  app.paneShare = 50;
  app.refreshPaneAxis();
  assert.equal(divider.attrs["aria-orientation"], "horizontal");
  assert.equal(divider.attrs["aria-valuemax"], "85");
  document.body.classList.add("assignment-mode");
  assert.equal(app.paneEntryOnTop(), true, "assignment mode puts the entry on top by default");
  assert.equal(app.setPaneStack("map-top", { chosen: true }), "map-top");
  assert.equal(shellAttrs["data-stack"], "map-top");
  assert.equal(app.paneEntryOnTop(), false, "the user's order wins over the mode default");
  assert.equal(localStorage.getItem("pow-pane-stack"), "map-top");
  const rect = { top: 0, height: 1000 };
  assert.equal(app.paneShareFromPointer(200, rect), 80, "the pointer mapping follows the chosen order");
  document.body.classList.remove("assignment-mode");
  app.setPaneStack("entry-top", { chosen: true });
  assert.equal(app.paneEntryOnTop(), true);
  assert.equal(app.setPaneStack("sideways"), null, "an unknown order clears the choice");
  assert.equal(shellAttrs["data-stack"], undefined);
  assert.equal(app.paneEntryOnTop(), false, "back to the mode default");
  localStorage.removeItem("pow-pane-stack");
  localStorage.removeItem("pow-pane-split-cols");
}

// 2b. the window resize listener itself: registered by setupPaneDivider,
// debounced, and re-clamping the painted width without touching the memory
{
  const app = fresh();
  const styles = {};
  const shellAttrs = {};
  let shellWidth = 1440;
  const shell = {
    style: { setProperty(name, value) { styles[name] = value; } },
    classList: classList(),
    getBoundingClientRect() { return { left: 0, top: 0, width: shellWidth, height: 900 }; },
    setAttribute(name, value) { shellAttrs[name] = value; },
    removeAttribute(name) { delete shellAttrs[name]; },
    getAttribute(name) { return shellAttrs[name] ?? null; },
  };
  const listeners = {};
  window.addEventListener = (name, fn) => { listeners[name] = fn; };
  document.querySelector = (selector) => (selector === ".app-shell" ? shell : null);
  const divider = element("paneDivider");
  divider.querySelector = () => null;
  app.map = { invalidated: 0, invalidateSize() { app.map.invalidated += 1; } };
  phone = false;
  localStorage.setItem("pow-pane-split-cols", "560");
  app.setupPaneDivider();
  assert.equal(typeof listeners.resize, "function", "setup registers a window resize listener");
  assert.equal(styles["--sidebar-w"], "560px", "the remembered width is restored on setup");
  const settle = () => new Promise((resolve) => setTimeout(resolve, 120));
  (async () => {
    shellWidth = 800;
    listeners.resize();
    listeners.resize();
    assert.equal(styles["--sidebar-w"], "560px", "nothing changes before the debounce settles");
    await settle();
    assert.equal(styles["--sidebar-w"], "480px", "the resize listener re-clamps to six tenths of an 800px window");
    assert.equal(divider.attrs["aria-valuenow"], "480");
    assert.equal(divider.attrs["aria-valuemax"], "480");
    assert.equal(localStorage.getItem("pow-pane-split-cols"), "560", "the remembered width is untouched");
    shellWidth = 1440;
    listeners.resize();
    await settle();
    assert.equal(styles["--sidebar-w"], "560px", "and the remembered width returns when the window widens");
    phone = true;
    shellWidth = 600;
    listeners.resize();
    await settle();
    assert.equal(styles["--sidebar-w"], "560px", "stacked layouts leave the sidebar width alone");
    phone = false;
    localStorage.removeItem("pow-pane-split-cols");
    window.addEventListener = undefined;
    document.querySelector = () => null;
    console.log("window resize re-clamp ok");
  })().catch((error) => { console.error(error); process.exit(1); });
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
