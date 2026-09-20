// the one add / revise control (jb ruling 2026-09-20): Add / Revise at
// rest with a hint naming what a press does, revise when a dot's popup is
// open, drop a pin otherwise, and Cancel while an entry is open; held by
// the actual portal class in a stub dom
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
  const item = { id, value: "", hidden: true, textContent: "", innerHTML: "", attrs: {}, classList: classList(), disabled: false,
    setAttribute(name, value) { this.attrs[name] = value; }, removeAttribute(name) { delete this.attrs[name]; },
    addEventListener() {}, querySelectorAll() { return []; }, ...extra };
  elements.set(id, item);
  return item;
};
const document = {
  body: { classList: classList() },
  getElementById(id) { return elements.get(id) || null; },
  createElement() { return { textContent: "", classList: classList(), remove() {}, addEventListener() {} }; },
  querySelector() { return null; },
  querySelectorAll() { return []; },
};
const window = {
  __POW_TEST_NO_BOOTSTRAP__: true,
  location: { search: "?batch=nz-temporal-ra-workpack-001", pathname: "/apps/regions/nz/verification.html" },
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
for (const file of ["occupancy-contract.js", "function-chain-contract.js", "task-presentation.js", "verification-map.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, file), "utf8"), context, { filename: file });
}

const fresh = () => {
  const app = Object.create(window.NzVerificationMap.prototype);
  app.backendUser = { _id: "user_1", initials: "JB" };
  app.backend = { configured: true, signedIn: true };
  app.pinMode = false;
  app.occupancyPinContext = null;
  app.selectedContextFeature = null;
  return app;
};
const dot = { type: "Feature", properties: { name: "St Mary's", osm_id: "1", osm_type: "node" }, geometry: { type: "Point", coordinates: [174.7, -41.3] } };

// 1. at rest the control reads Add / Revise and the hint says a press drops a pin
{
  const app = fresh();
  const button = element("addPlaceButton");
  const hint = element("addReviseHint");
  app.renderAddReviseControl();
  assert.equal(button.textContent, "Add / Revise");
  assert.equal(button.classList.contains("cancelling"), false);
  assert.match(hint.textContent, /Drops a pin/);
  assert.match(hint.textContent, /Tap a dot first/);
}

// 2. a dot's popup open: the hint names the place, and a press revises it
{
  const app = fresh();
  const hint = element("addReviseHint");
  element("addPlaceButton");
  app.setSelectedContextFeature(dot);
  assert.equal(hint.textContent, "Revises St Mary's.");
  let revised = null;
  let pinned = 0;
  app.reviseFromFeature = (feature) => { revised = feature; };
  app.enterPinMode = () => { pinned += 1; };
  app.handleAddReviseClick();
  assert.equal(revised, dot);
  assert.equal(pinned, 0);
  // the popup closes: back to dropping a pin
  app.setSelectedContextFeature(null);
  assert.match(hint.textContent, /Drops a pin/);
  app.handleAddReviseClick();
  assert.equal(pinned, 1);
}

// 3. signed out, a press on a selected dot parks the place on the sign-in card
{
  const app = fresh();
  app.backendUser = null;
  app.selectedContextFeature = dot;
  let parked = null;
  app.requestSignInToRevise = (feature) => { parked = feature; };
  app.reviseFromFeature = () => { throw new Error("must not revise signed out"); };
  app.handleAddReviseClick();
  assert.equal(parked, dot);
}

// 4. an open entry: the same button reads Cancel, in the danger outline, enabled, and a press discards
{
  const app = fresh();
  const button = element("addPlaceButton");
  const hint = element("addReviseHint");
  button.disabled = true;
  button.attrs.disabled = "true";
  app.pinMode = true;
  app.renderAddReviseControl();
  assert.equal(button.textContent, "Cancel");
  assert.equal(button.classList.contains("cancelling"), true);
  assert.equal(button.disabled, false);
  assert.equal("disabled" in button.attrs, false);
  assert.equal(hint.textContent, "");
  let discarded = 0;
  let exited = 0;
  app.discardEntryAttempt = () => { discarded += 1; return true; };
  app.exitPinMode = () => { exited += 1; };
  app.handleAddReviseClick();
  assert.equal(discarded, 1);
  assert.equal(exited, 0);
  // a period placement returns to its periods instead of discarding
  app.occupancyPinContext = { index: 0, context: {} };
  app.handleAddReviseClick();
  assert.equal(exited, 1);
  assert.equal(discarded, 1);
}

// 5. the file control: one button in front of the input, and the chosen count beside it
{
  const app = fresh();
  const count = { textContent: "" };
  const pick = { querySelector: (selector) => (selector === ".file-pick-count" ? count : null) };
  const input = { classList: classList(), files: [{ name: "a.jpg" }, { name: "b.jpg" }], closest: (selector) => (selector === ".file-pick" ? pick : null) };
  input.classList.add("attachment-file-input");
  app.syncFilePickCount(input);
  assert.equal(count.textContent, "2 chosen");
  input.files = [];
  app.syncFilePickCount(input);
  assert.equal(count.textContent, "");
  // an unrelated change leaves nothing behind
  app.syncFilePickCount({ classList: classList() });
}

// 6. the markup carries the button and never a bare file input
{
  const source = fs.readFileSync(path.join(__dirname, "verification-map.js"), "utf8");
  const html = fs.readFileSync(path.join(__dirname, "..", "verification.html"), "utf8");
  assert.equal((source.match(/Take photo or add files/g) || []).length, 2);
  assert.equal(/Esc cancels|Press Escape|Escape returns/.test(source), false);
  assert.match(html, /id="addPlaceButton" class="primary-action">Add \/ Revise</);
  assert.match(html, /id="addReviseHint"/);
  assert.match(html, /\.primary-action\.cancelling/);
}

// 7. the assigned-tasks button shows under the control only while the batch
//    holds work for this contributor, never while an entry is open
{
  const app = fresh();
  element("addPlaceButton");
  element("addReviseHint");
  const assigned = element("assignedTasksButton");
  app.portalMode = "add";
  app.assignedAvailableCount = 0;
  app.myWorkItems = [];
  app.renderAddReviseControl();
  assert.equal(assigned.hidden, true);
  app.assignedAvailableCount = 3;
  app.renderAddReviseControl();
  assert.equal(assigned.hidden, false);
  assert.equal(assigned.textContent, "Assigned tasks (3)");
  // work in progress counts even with nothing left to claim
  app.assignedAvailableCount = 0;
  app.myWorkItems = [{ task: { task_id: "t1" } }];
  app.renderAddReviseControl();
  assert.equal(assigned.hidden, false);
  assert.equal(assigned.textContent, "Assigned tasks (1)");
  // an open entry: the control is Cancel and the sheet's button leaves
  app.pinMode = true;
  app.renderAddReviseControl();
  assert.equal(assigned.hidden, true);
}

// 8. the locate card: three large options, the search and coordinates folded
//    under the third, and no move button (typed coordinates apply on change)
{
  const app = fresh();
  app.reviseContext = null;
  app.occupancyPinContext = null;
  app.pinPlaceholderExample = () => ({ place: "St Paul's, Wellington", lat: "-41.28", lng: "174.77" });
  app.pinCardCarriesBasis = () => false;
  app.rapidEntryFormHtml = () => "";
  app.geolocationAvailable = () => true;
  let html;
  try {
    html = app.pinCardsHtml();
  } catch (error) {
    html = null;
  }
  const source = fs.readFileSync(path.join(__dirname, "verification-map.js"), "utf8");
  if (html) {
    assert.match(html, /id="pinLocateMeButton"[^>]*>Drop pin at my location</);
    assert.match(html, /id="pinDropOnMapButton"[^>]*>Drop pin on map</);
    assert.match(html, /id="pinSearchToggleButton"[^>]*>Search and drop</);
    assert.match(html, /id="pinSearchBlock"[^>]*hidden/);
    assert.equal(/pinCoordButton|>Move pin</.test(html), false);
  }
  assert.equal(/id="pinCoordButton"/.test(source), false);
  assert.match(source, /\$\{verb\} at my location/);
  // a search result names the action by whether the pin is down
  assert.match(source, /this\.pinMarker \? "Move pin here" : "Drop pin here"/);
  // the search fold opens and closes on the toggle
  const block = element("pinSearchBlock", { hidden: true });
  const toggle = element("pinSearchToggleButton");
  element("pinSearchInput", { focus() { this.focused = true; } });
  app.pinMode = true;
  app.paneSnap = () => false;
  app.togglePinSearch();
  assert.equal(block.hidden, false);
  assert.equal(toggle.attrs["aria-expanded"], "true");
  app.togglePinSearch();
  assert.equal(block.hidden, true);
  // typed coordinates: the change event waits for both boxes, then moves
  const lat = element("pinLatInput", { value: "-41.3" });
  const lng = element("pinLngInput", { value: "" });
  element("pinSearchStatus");
  const moves = [];
  app.setPendingPin = (a, b) => moves.push([a, b]);
  app.applyTypedCoordinates({ quiet: true });
  assert.equal(moves.length, 0);
  lng.value = "174.8";
  app.applyTypedCoordinates({ quiet: true });
  assert.deepEqual(moves, [[-41.3, 174.8]]);
  lat.value = "";
}

// 9. the header carries no batch line on the portal, and the flag label stands alone
{
  const source = fs.readFileSync(path.join(__dirname, "verification-map.js"), "utf8");
  const html = fs.readFileSync(path.join(__dirname, "..", "verification.html"), "utf8");
  assert.match(html, /body\.assignment-mode \.sidebar-header p \{\s*display: none;/);
  assert.match(html, /id="assignedTasksButton" class="primary-action secondary-action" hidden/);
  assert.match(source, /<span><strong>Flag for discussion<\/strong><\/span>/);
  assert.equal(/Record a partial entry/.test(source), false);
  assert.equal(/Assigned tasks →/.test(source), false);
}

// 10. the map data panel: one points toggle, no select and no target-year note;
//     the divider refuses touchmove while dragging (ios safari)
{
  const source = fs.readFileSync(path.join(__dirname, "verification-map.js"), "utf8");
  assert.equal(/portalPointsSelect|portalPointsNote|updatePointsNote/.test(source), false);
  assert.match(source, /id="portalPointsToggle"/);
  assert.match(source, /"touchmove", \(event\) => \{\s*if \(drag && event\.cancelable\) event\.preventDefault\(\);\s*\}, \{ passive: false \}/);
  const app = fresh();
  const toggle = element("portalPointsToggle");
  app.pointsMode = "off";
  app.syncPointsToggle();
  assert.equal(toggle.textContent, "Show points");
  assert.equal(toggle.attrs["aria-pressed"], "false");
  app.pointsMode = "all";
  app.syncPointsToggle();
  assert.equal(toggle.textContent, "Hide points");
  assert.equal(toggle.attrs["aria-pressed"], "true");
}

// 11. once a pin is down the confirm card offers a Street View check kept on
//     the pin, and choosing an area (or another radius) fits the circle into
//     view, once, never below the zoom an area needs
{
  const app = fresh();
  app.reviseContext = null;
  app.occupancyPinContext = null;
  app.pinPlaceholderExample = () => ({ place: "St Paul's, Wellington", lat: "-41.28", lng: "174.77" });
  app.pinCardCarriesBasis = () => false;
  app.rapidEntryFormHtml = () => "";
  app.geolocationAvailable = () => true;
  app.pinPeriodsBlockHtml = () => "";
  app.rapidObservationFieldsHtml = () => "";
  const html = app.pinCardsHtml();
  assert.match(html, /<a id="pinStreetViewLink"[^>]*target="_blank"[^>]*>Check Street View at the pin</);
  // a leaflet stub: circles carry their radius, the map records its fits
  const calls = [];
  let zoom = 19;
  context.L = {
    latLng: (lat, lng) => ({ lat, lng, equals: (o) => o.lat === lat && o.lng === lng }),
    circle: (position, options) => ({ radius: options.radius, getBounds: () => ({ radius: options.radius }), addTo() { return this; } }),
  };
  app.map = {
    getZoom: () => zoom,
    setZoom: (z) => { zoom = z; calls.push(["setZoom", z]); },
    fitBounds: (bounds) => { calls.push(["fit", bounds.radius]); zoom = bounds.radius > 50000 ? 6 : 14; },
    getBounds: () => ({ contains: () => true }),
    removeLayer() {},
  };
  app.pinMode = true;
  app.pinConfirmed = null;
  app.rapidFormOptions = null;
  app.pinUncertaintyCircle = null;
  app.pinAreaKey = "";
  app.pinMarker = { getLatLng: () => ({ lat: -41.2865, lng: 174.7762 }) };
  const link = element("pinStreetViewLink", { href: "#" });
  element("pinLat"); element("pinLng");
  const mode = element("pinLocationMode", { value: "building_identified" });
  const radius = element("pinLocationRadius", { value: "500" });
  element("pinConfirmButton"); element("pinZoomGate"); element("pinLocationGrade"); element("pinLocationRadiusCustomField");
  const radiusField = element("pinLocationRadiusField", { scrolled: 0, scrollIntoView() { this.scrolled += 1; } });
  app.updatePinConfirmCard();
  assert.match(link.href, /map_action=pano&viewpoint=-41\.2865%2C174\.7762/);
  assert.deepEqual(calls, []);
  assert.equal(app.pinUncertaintyCircle, null);
  mode.value = "approximate_area";
  app.updatePinConfirmCard();
  assert.deepEqual(calls, [["fit", 500]]);
  assert.equal(radiusField.scrolled, 1);
  // the same area again (a drag, a zoom): no second fit
  app.updatePinConfirmCard();
  assert.deepEqual(calls, [["fit", 500]]);
  radius.value = "100000";
  app.updatePinConfirmCard();
  assert.deepEqual(calls, [["fit", 500], ["fit", 100000], ["setZoom", 8]]);
  mode.value = "building_identified";
  app.updatePinConfirmCard();
  assert.equal(app.pinUncertaintyCircle, null);
  assert.equal(calls.length, 3);
}

console.log("add-revise-control: 11 checks passed");
