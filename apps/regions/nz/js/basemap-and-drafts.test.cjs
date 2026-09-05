// guy's two findings of 2026-09-05, held by the actual portal class in a stub
// dom: a basemap swap adds the incoming tiles before removing the outgoing
// (leaflet otherwise snaps the zoom to the dots layer's ceiling), typed
// guided entries reach the device and come back to a fresh instance, and
// the confirmed pin rides on the rapid draft only while the entry is open
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
const document = {
  body: { classList: classList() },
  getElementById() { return null; },
  createElement() { return { textContent: "", remove() {} }; },
  querySelector() { return null; },
  querySelectorAll() { return []; },
};
const window = {
  __POW_TEST_NO_BOOTSTRAP__: true,
  location: { search: "?batch=nz-temporal-ra-workpack-001", pathname: "/apps/regions/nz/verification.html" },
  localStorage,
  sessionStorage: localStorage,
  setTimeout, clearTimeout,
};
const context = vm.createContext({
  window, document, localStorage, sessionStorage: localStorage,
  URLSearchParams, Map, Set, Date, Number, String, Boolean, Object, Array, Math, JSON, RegExp, Intl, console, setTimeout, clearTimeout,
});
for (const file of ["occupancy-contract.js", "function-chain-contract.js", "verification-map.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, file), "utf8"), context, { filename: file });
}
const fresh = () => Object.create(window.NzVerificationMap.prototype);

// 1. basemap swap order
{
  const events = [];
  const onMap = new Set();
  const map = {
    hasLayer(layer) { return onMap.has(layer); },
    addLayer(layer) { onMap.add(layer); events.push(`add:${layer.name}`); },
    removeLayer(layer) { onMap.delete(layer); events.push(`remove:${layer.name}`); },
    getContainer() { return { classList: classList() }; },
  };
  const layer = (name) => ({ name, addTo(target) { target.addLayer(this); return this; }, bringToBack() {} });
  const app = fresh();
  app.map = map;
  app.streetsLayer = layer("streets");
  app.hybridLayer = layer("hybrid");
  app.satelliteLayer = layer("satellite");
  app.streetsLayer.addTo(map);
  events.length = 0;
  app.basemap = "streets";
  app.imageryBroken = false;
  app.probeImagery = () => {};
  app.syncContextDots = () => {};
  app.setBasemap("satellite");
  assert.deepEqual(events, ["add:satellite", "remove:streets"], "incoming tiles go on before the outgoing come off");
  assert.equal(app.basemap, "satellite");
  events.length = 0;
  app.setBasemap("satellite");
  assert.deepEqual(events, [], "no swap when already on that basemap");
  app.setBasemap("streets");
  assert.deepEqual(events, ["add:streets", "remove:satellite"]);
}

// 2. guided form snapshots reach the device and come back to a fresh instance
{
  const app = fresh();
  app.formSnapshotsByTaskId = new Map();
  app.setFormSnapshot("task-1", { action: "closed", source_title: "Parish notice" });
  assert.ok(localStorage.getItem("powFormSnapshot:NZ:task-1"), "snapshot written to the device");
  const reloaded = fresh();
  reloaded.formSnapshotsByTaskId = new Map();
  assert.deepEqual(reloaded.getFormSnapshot("task-1"), { action: "closed", source_title: "Parish notice" }, "a fresh instance reads the device copy");
  assert.equal(reloaded.getFormSnapshot("task-none"), undefined);
  reloaded.deleteFormSnapshot("task-1");
  assert.equal(localStorage.getItem("powFormSnapshot:NZ:task-1"), null, "delete clears the device copy");
  assert.equal(reloaded.getFormSnapshot("task-1"), undefined);
  app.setFormSnapshot("task-2", { action: "needs_review" });
  app.setFormSnapshot("task-3", { action: "needs_review" });
  localStorage.setItem("powRapidDraft:NZ:rapid-pin", JSON.stringify({ saved_at: 1, values: { sourceTitle: "Sign" }, extra: {} }));
  app.clearFormSnapshots();
  assert.equal(localStorage.getItem("powFormSnapshot:NZ:task-2"), null, "sign-out clears every snapshot");
  assert.equal(localStorage.getItem("powFormSnapshot:NZ:task-3"), null);
  assert.ok(localStorage.getItem("powRapidDraft:NZ:rapid-pin"), "and leaves the rapid draft alone");
}

// 3. the confirmed pin rides on the rapid draft while the entry is open
{
  const app = fresh();
  app.reviseContext = null;
  app.occupancyPinContext = null;
  app.pinConfirmed = { latitude: -17.74, longitude: 168.31, zoom: 18, locationMode: "building_identified" };
  app.keepRapidPinOnDevice();
  const kept = JSON.parse(localStorage.getItem("powRapidDraft:NZ:rapid-pin"));
  assert.equal(kept.values.sourceTitle, "Sign", "the typed values stay");
  assert.equal(kept.pin.latitude, -17.74, "the confirmed pin joins the record");
  // the autosave after a later keystroke carries the pin through
  app.persistRapidDraft("pin", "rapid-pin", { pinNameInput: "Vila prayer hall" });
  const autosaved = JSON.parse(localStorage.getItem("powRapidDraft:NZ:rapid-pin"));
  assert.equal(autosaved.extra.pinNameInput, "Vila prayer hall");
  assert.equal(autosaved.pin.longitude, 168.31, "autosave keeps the pin");
  // leaving the flow by choice drops the pin and keeps the text
  app.dropRapidPinFromDevice();
  const left = JSON.parse(localStorage.getItem("powRapidDraft:NZ:rapid-pin"));
  assert.equal(left.pin, undefined, "back to map drops the pin");
  assert.equal(left.extra.pinNameInput, "Vila prayer hall", "and keeps the typed name");
  // a revision or a period's location never writes a pin
  app.reviseContext = { taskId: "t9" };
  app.keepRapidPinOnDevice();
  assert.equal(JSON.parse(localStorage.getItem("powRapidDraft:NZ:rapid-pin")).pin, undefined, "a revision keeps no pin");
  // resume is a no-op away from add mode, with no map, or with no pin
  app.reviseContext = null;
  app.portalMode = "assigned";
  app.map = {};
  assert.equal(app.resumeRapidPinFromDevice(), false);
  app.portalMode = "add";
  app.pinMode = false;
  assert.equal(app.resumeRapidPinFromDevice(), false, "nothing to resume without a kept pin");
}

console.log("basemap swap order, device snapshots, and the kept pin ok");
