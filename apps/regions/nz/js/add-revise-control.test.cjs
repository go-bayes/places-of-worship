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
  assert.match(hint.textContent, /Hold on the map/);
  assert.match(hint.textContent, /tap a dot to revise it/);
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

// 12. the add gesture (jb 2026-09-22): a held touch or a double click on
//     the map opens the add entry with the pin on the spot; on a dot the
//     press is the dot's; with a pin armed it lands the pin; with the pin
//     down nothing moves (the taps and the drag already do)
{
  const app = fresh();
  const calls = [];
  app.map = { closePopup: () => calls.push("closePopup"), latLngToContainerPoint: () => ({ distanceTo: () => 99 }) };
  app.contextDotLayer = null;
  app.tileDotAt = () => null;
  app.enterPinMode = () => { calls.push("enterPinMode"); app.pinMode = true; };
  app.placePin = (latlng) => calls.push(["placePin", latlng.lat, latlng.lng]);
  app.openContextDot = (feature) => calls.push(["openContextDot", feature.properties.name]);
  const press = (type, extra = {}) => ({ type, latlng: { lat: -41.3, lng: 174.8 }, containerPoint: { x: 10, y: 10 }, originalEvent: { target: { closest: () => null } }, ...extra });
  // at rest: the entry opens and the pin lands where the press was
  app.handleAddGesture(press("contextmenu"));
  assert.deepEqual(calls, ["closePopup", "enterPinMode", ["placePin", -41.3, 174.8]]);
  // with the pin down: the gesture leaves it alone
  app.pinMarker = {};
  app.handleAddGesture(press("dblclick"));
  assert.equal(calls.length, 3);
  // armed without a pin: the gesture lands it
  app.pinMarker = null;
  app.pinConfirmed = null;
  app.reviseContext = null;
  app.handleAddGesture(press("dblclick"));
  assert.deepEqual(calls[3], ["placePin", -41.3, 174.8]);
  // on a recorded place at rest: a hold opens the place, a double click
  // defers to the tap that already did, and no pin drops either way
  app.pinMode = false;
  app.tileDotAt = () => ({ feature: dot, latlng: { lat: -41.3, lng: 174.7 } });
  app.handleAddGesture(press("contextmenu"));
  assert.deepEqual(calls[4], ["openContextDot", "St Mary's"]);
  app.handleAddGesture(press("dblclick"));
  assert.equal(calls.length, 5);
  // a task marker under the press owns it too
  app.tileDotAt = () => null;
  app.handleAddGesture(press("dblclick", { originalEvent: { target: { closest: (sel) => (sel === ".leaflet-marker-icon" ? {} : null) } } }));
  assert.equal(calls.length, 5);
  // a dated dot within a finger's width owns it
  app.contextDotLayer = { getLayers: () => [{ options: { interactive: true }, getLatLng: () => ({}) }] };
  app.map.latLngToContainerPoint = () => ({ distanceTo: () => 8 });
  app.handleAddGesture(press("contextmenu"));
  assert.equal(calls.length, 5);
  // the double click no longer zooms
  const source = fs.readFileSync(path.join(__dirname, "verification-map.js"), "utf8");
  assert.match(source, /L\.map\("map", \{ preferCanvas: true, doubleClickZoom: false \}\)/);
  assert.match(source, /this\.map\.on\("dblclick", event => this\.handleAddGesture\(event\)\)/);
  assert.match(source, /this\.map\.on\("contextmenu", event => this\.handleAddGesture\(event\)\)/);
}

// 13. the tap is the edit (jb 2026-09-22): signed in, a tap on a tile dot
//     opens the revise entry with no popup between; signed out, or with a
//     pin armed, or where the rapid lane cannot take the record, the popup
//     opens as before
{
  const app = fresh();
  const calls = [];
  app.matchContextTask = () => null;
  app.canReviseDirectly = () => true;
  app.reviseFromFeature = (feature, options) => calls.push(["revise", feature.properties.name, options]);
  context.L = { popup: () => { throw new Error("no popup on a direct edit"); } };
  app.openContextDot(dot, { lat: -41.3, lng: 174.7 });
  assert.equal(JSON.stringify(calls), JSON.stringify([["revise", "St Mary's", null]]));
  // the popup path: signed out
  let popups = 0;
  const popup = { setLatLng() { return this; }, setContent() { return this; }, openOn() { popups += 1; return this; }, getElement: () => null };
  context.L = { popup: () => popup };
  app.contextDotPopupHtml = () => "<strong>St Mary's</strong>";
  app.backendUser = null;
  app.openContextDot(dot, { lat: -41.3, lng: 174.7 });
  assert.equal(popups, 1);
  assert.equal(calls.length, 1);
  // the popup path: a pin armed and not yet down offers revise or add here
  app.backendUser = { _id: "user_1" };
  app.pinMode = true;
  app.pinMarker = null;
  app.reviseContext = null;
  app.openContextDot(dot, { lat: -41.3, lng: 174.7 });
  assert.equal(popups, 2);
  assert.equal(calls.length, 1);
  // the popup path: the rapid lane cannot take the record, so the card
  // opens beside the popup
  app.pinMode = false;
  app.canReviseDirectly = () => false;
  app.openContextDot(dot, { lat: -41.3, lng: 174.7 });
  assert.equal(popups, 3);
  assert.equal(JSON.stringify(calls[1]), JSON.stringify(["revise", "St Mary's", { keepPopup: true }]));
  // a matched task opens the task, popup kept
  app.canReviseDirectly = () => true;
  app.matchContextTask = () => ({ task_id: "t9" });
  let selected = null;
  app.selectTaskById = (id) => { selected = id; };
  app.openContextDot(dot, { lat: -41.3, lng: 174.7 });
  assert.equal(selected, "t9");
  assert.equal(popups, 4);
  // canReviseDirectly itself: a coordinate and a signed-in backend
  const real = fresh();
  assert.equal(real.canReviseDirectly({ geometry: { coordinates: [] } }), false);
  real.backend = { configured: true, signedIn: false };
  assert.equal(real.canReviseDirectly(dot), false);
}

// 14. a held touch on the pin (jb 2026-09-22): Remove pin lifts an
//     unconfirmed pin and keeps the entry armed; a confirmed location
//     offers only the discard that asks first
{
  const app = fresh();
  const calls = [];
  app.map = { closePopup() { calls.push("closePopup"); }, removeLayer(layer) { calls.push(layer.name); }, off() {} };
  app.pinMode = true;
  app.pinConfirmed = null;
  app.pinMarker = { name: "pin" };
  app.pinUncertaintyCircle = { name: "circle" };
  app._pinZoomHandler = () => {};
  app.pinHistory = [{}, {}];
  app.paneSnap = (name) => { calls.push(`snap:${name}`); return true; };
  const card = element("pinConfirmCard", { hidden: false });
  const status = element("pinStatus");
  assert.match(app.pinHoldMenuHtml(), /data-pin-remove="1">Remove pin</);
  assert.match(app.pinHoldMenuHtml(), /data-pin-cancel="1">Cancel placement</);
  assert.equal(app.removePendingPin(), true);
  assert.equal(app.pinMarker, null);
  assert.equal(app.pinUncertaintyCircle, null);
  assert.equal(app._pinZoomHandler, null);
  assert.equal(app.pinHistory.length, 0);
  assert.equal(app.pinMode, true);
  assert.equal(card.hidden, true);
  assert.match(status.textContent, /Pin removed/);
  assert.deepEqual(calls, ["closePopup", "pin", "circle", "snap:map"]);
  // confirmed: the menu offers the discard and the lift refuses
  app.pinMarker = { name: "pin" };
  app.pinConfirmed = { latitude: -41.3, longitude: 174.8 };
  assert.match(app.pinHoldMenuHtml(), /data-pin-discard="1">Discard this entry</);
  assert.equal(/Remove pin/.test(app.pinHoldMenuHtml()), false);
  assert.equal(app.removePendingPin(), false);
  assert.equal(app.pinMarker.name, "pin");
  // the marker binds the hold
  const source = fs.readFileSync(path.join(__dirname, "verification-map.js"), "utf8");
  assert.match(source, /this\.pinMarker\.on\("contextmenu", event => \{/);
}

console.log("add-revise-control: 14 checks passed");
