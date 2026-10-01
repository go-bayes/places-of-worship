// the recentre button (jb 2026-10-01: "needs a recentre map button, as if
// you scroll off it won't work"): the shared control draws one 44 px
// button, reads the page's resolver at each press and moves the map to
// the target it names; and the ra portal's resolver chooses the pin, the
// open task, the record being revised, the selected dot, then the country
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// values made inside a vm context carry that context's prototypes, so
// they are compared as plain json
const plain = (value) => JSON.parse(JSON.stringify(value));
const same = (actual, expected, message) => assert.deepEqual(plain(actual), plain(expected), message);

// ---- the shared control against a stub leaflet ----
const stubElement = (tag) => ({
  tag, className: "", id: "", type: "", title: "", innerHTML: "", attrs: {}, children: [], listeners: {},
  setAttribute(name, value) { this.attrs[name] = value; },
  addEventListener(name, handler) { (this.listeners[name] ||= []).push(handler); },
  fire(name) { (this.listeners[name] || []).forEach(handler => handler()); },
});
const L = {
  control(options) {
    return {
      options,
      addTo(map) { this.container = this.onAdd(map); map.controls.push(this); return this; },
    };
  },
  DomUtil: {
    create(tag, className, container) {
      const el = stubElement(tag);
      el.className = className;
      container?.children.push(el);
      return el;
    },
  },
  DomEvent: { disableClickPropagation() {}, disableScrollPropagation() {} },
  circle(latlng, options) { return { getBounds: () => ({ circleAt: latlng, radius: options.radius }) }; },
};
const stubMap = (zoom = 6) => ({
  zoom, controls: [], calls: [],
  getZoom() { return this.zoom; },
  setView(latlng, nextZoom) { this.calls.push(["setView", latlng, nextZoom]); this.zoom = nextZoom; },
  fitBounds(bounds, options) { this.calls.push(["fitBounds", bounds, options]); },
});
const sharedWindow = {};
const sharedContext = vm.createContext({ window: sharedWindow, Number, Array, Math, Object, String, Boolean });
vm.runInContext(fs.readFileSync(path.join(__dirname, "recentre-control.js"), "utf8"), sharedContext, { filename: "recentre-control.js" });
const mod = sharedWindow.PowRecentreControl;
const buttonOf = (control) => control.container.children[0];

// 1. without a resolver there is no control; with one, a 44 px icon
//    button in its own bar at the top left, labelled for the screen reader
//    and the tooltip, under the shared icon-button class
{
  assert.equal(mod.create(L, stubMap(), {}), null);
  const map = stubMap();
  const control = mod.create(L, map, { resolve: () => null });
  assert.equal(map.controls.length, 1);
  assert.equal(control.options.position, "topleft");
  assert.equal(control.container.className, "leaflet-bar map-icon-control recentre-control");
  const button = buttonOf(control);
  assert.equal(button.tag, "button");
  assert.equal(button.type, "button");
  assert.equal(button.id, "recentreButton");
  assert.equal(button.attrs["aria-label"], "Recentre the map");
  assert.equal(button.title, "Recentre the map");
  assert.match(button.innerHTML, /<svg[^>]*aria-hidden="true"/);
}

// 2. a point target: setView at the current zoom or the point's minimum,
//    whichever is nearer, so a zoomed-in reader keeps the zoom and a
//    zoomed-out reader lands at the task's zoom
{
  const map = stubMap(6);
  const control = mod.create(L, map, { resolve: () => ({ latlng: [-41.3, 174.7], minZoom: 16 }) });
  buttonOf(control).fire("click");
  same(map.calls, [["setView", [-41.3, 174.7], 16]]);
  map.zoom = 18;
  buttonOf(control).fire("click");
  same(map.calls[1], ["setView", [-41.3, 174.7], 18]);
}

// 3. an area target fits the uncertainty circle, as opening the task does
{
  const map = stubMap(6);
  const control = mod.create(L, map, { resolve: () => ({ latlng: [-41.3, 174.7], radiusM: 500, maxZoom: 14 }) });
  buttonOf(control).fire("click");
  same(map.calls, [["fitBounds", { circleAt: [-41.3, 174.7], radius: 500 }, { padding: [30, 30], maxZoom: 14 }]]);
}

// 4. bounds fit with their own padding and ceiling; a default view is a
//    plain setView at the region's zoom
{
  const map = stubMap(6);
  const bounds = { queue: true };
  const control = mod.create(L, map, { resolve: () => ({ bounds, padding: [10, 10], maxZoom: 12 }) });
  buttonOf(control).fire("click");
  same(map.calls, [["fitBounds", bounds, { padding: [10, 10], maxZoom: 12 }]]);
  const home = stubMap(14);
  const homeControl = mod.create(L, home, { resolve: () => ({ centre: [-41.235726, 172.5118422], zoom: 6 }) });
  buttonOf(homeControl).fire("click");
  same(home.calls, [["setView", [-41.235726, 172.5118422], 6]]);
}

// 5. a null target, a malformed target or a throwing resolver leaves the
//    map alone and tells the page nothing moved
{
  const map = stubMap(6);
  const seen = [];
  const control = mod.create(L, map, { resolve: () => null, onRecentre: (target, moved) => seen.push([target, moved]) });
  buttonOf(control).fire("click");
  same(map.calls, []);
  same(seen, [[null, false]]);
  assert.equal(mod.applyTarget(L, map, { latlng: ["x", 1] }), false);
  assert.equal(mod.applyTarget(L, map, { latlng: [-41, 174], radiusM: 0 }), true, "a zero radius falls back to the point");
  const broken = stubMap(6);
  const brokenControl = mod.create(L, broken, { resolve: () => { throw new Error("no state"); } });
  buttonOf(brokenControl).fire("click");
  same(broken.calls, []);
}

// 6. the tooltip names the destination as the pointer or the focus
//    arrives, and falls back to the plain label
{
  const map = stubMap(6);
  let label = "Recentre the map on the open task";
  const control = mod.create(L, map, { resolve: () => ({ latlng: [-41, 174], label }) });
  const button = buttonOf(control);
  button.fire("pointerenter");
  assert.equal(button.title, "Recentre the map on the open task");
  label = "";
  button.fire("focus");
  assert.equal(button.title, "Recentre the map");
}

// ---- the ra portal's resolver, held by the actual portal class ----
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
const document = {
  body: { classList: classList() },
  getElementById() { return null; },
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
const portalContext = vm.createContext({
  window, document, localStorage, sessionStorage: localStorage, navigator,
  URLSearchParams, Map, Set, Date, Number, String, Boolean, Object, Array, Math, JSON, RegExp, Intl, console, setTimeout, clearTimeout, Promise, Error,
});
for (const file of ["occupancy-contract.js", "function-chain-contract.js", "task-presentation.js", "verification-map.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, file), "utf8"), portalContext, { filename: file });
}
const fresh = () => {
  const app = Object.create(window.NzVerificationMap.prototype);
  app.pinMarker = null;
  app.selectedTask = null;
  app.reviseContext = null;
  app.selectedContextFeature = null;
  app.backendTasksById = new Map();
  return app;
};
const task = (extra = {}) => ({
  type: "Feature",
  properties: { task_id: "task_1", name: "St Mary's", ...extra },
  geometry: { type: "Point", coordinates: [174.7, -41.3] },
});

// 7. nothing open: the country's opening view, named in the tooltip
{
  const app = fresh();
  same(app.recentreTarget(), {
    centre: [-41.235726, 172.5118422],
    zoom: 6,
    label: "Recentre the map on New Zealand",
  });
}

// 8. an open task is its point at zoom 16 or the reader's own; a task
//    placed to an area is the area, from the feature or the backend copy
{
  const app = fresh();
  app.selectedTask = task();
  same(app.recentreTarget(), { latlng: [-41.3, 174.7], minZoom: 16, label: "Recentre the map on the open task" });
  app.selectedTask = task({ initial_location_assertion: { mode: "approximate_area", uncertainty_radius_m: 750 } });
  same(app.recentreTarget(), { latlng: [-41.3, 174.7], radiusM: 750, maxZoom: 14, label: "Recentre the map on the open task's area" });
  app.selectedTask = task();
  app.backendTasksById.set("task_1", { initial_location_assertion: { mode: "approximate_area", uncertainty_radius_m: 200 } });
  assert.equal(app.recentreTarget().radiusM, 200);
  app.selectedTask = { type: "Feature", properties: { task_id: "t2" }, geometry: { type: "Point", coordinates: [] } };
  assert.equal(app.recentreTarget().centre[0], -41.235726, "a task without coordinates falls through to the country");
}

// 9. the open entry's pin outranks the task; a lifted pin leaves the
//    record being revised; a dot's open popup ranks below both
{
  const app = fresh();
  app.selectedTask = task();
  app.pinMarker = { getLatLng: () => ({ lat: -36.85, lng: 174.76 }) };
  same(app.recentreTarget(), { latlng: [-36.85, 174.76], minZoom: 17, label: "Recentre the map on your pin" });
  app.pinMarker = null;
  app.selectedTask = null;
  app.reviseContext = { latitude: -45.87, longitude: 170.5, name: "First Church" };
  same(app.recentreTarget(), { latlng: [-45.87, 170.5], minZoom: 17, label: "Recentre the map on the place you are revising" });
  app.reviseContext = null;
  app.selectedContextFeature = { type: "Feature", properties: { name: "St Paul's" }, geometry: { type: "Point", coordinates: [174.77, -41.28] } };
  same(app.recentreTarget(), { latlng: [-41.28, 174.77], minZoom: 16, label: "Recentre the map on the selected place" });
}

// 10. the portal's control hands the resolver to the shared module and
//     sits at the top left under the locate button
{
  const app = fresh();
  const created = [];
  window.PowRecentreControl = { create: (leaflet, map, options) => { created.push({ leaflet, map, options }); return {}; } };
  portalContext.L = { marker: "stub" };
  app.map = { id: "map" };
  app.addRecentreControl();
  assert.equal(created.length, 1);
  assert.equal(created[0].options.position, "topleft");
  assert.equal(created[0].options.id, "recentreButton");
  assert.equal(created[0].options.resolve().label, "Recentre the map on New Zealand");
  delete window.PowRecentreControl;
  app.addRecentreControl();
  assert.equal(created.length, 1, "no shared module, no control, no error");
}

console.log("recentre-control: 10 checks passed");
