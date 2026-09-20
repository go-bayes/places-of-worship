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

console.log("add-revise-control: 6 checks passed");
