// the "nominate from the map pin" route, held by the actual portal class in
// a stub dom. loadPortal builds a fresh vm context per call, so each case
// starts from its own url, storage and elements. first case: the detailed
// lane leaves a saved quick-entry draft alone (brief 3.2, change 5)
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SCRIPTS = ["occupancy-contract.js", "function-chain-contract.js", "task-presentation.js", "verification-map.js"];

// search: the query string of the page, e.g. "?batch=nz-test&detailed=1"
// storage: optional { key: string } entries seeded into localStorage
const loadPortal = ({ search = "", storage = {} } = {}) => {
  const values = new Map(Object.entries(storage));
  const localStorage = {
    get length() { return values.size; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    key(index) { return [...values.keys()][index] ?? null; },
  };
  const elements = new Map();
  const element = (id, extra = {}) => {
    const item = { id, value: "", hidden: true, textContent: "", innerHTML: "", classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, ...extra };
    elements.set(id, item);
    return item;
  };
  const document = {
    body: { classList: { toggle() {}, contains() { return false; } } },
    getElementById(id) { return elements.get(id) || null; },
  };
  const window = {
    __POW_TEST_NO_BOOTSTRAP__: true,
    location: { search, pathname: "/apps/regions/nz/verification.html" },
    localStorage,
    sessionStorage: localStorage,
    PowRapidEntry: {
      secureSubmissionId: () => "22222222-2222-4222-8222-222222222222",
      localIsoDate: () => "2026-10-15",
    },
  };
  const context = vm.createContext({
    window, document, localStorage, sessionStorage: localStorage,
    URLSearchParams, Map, Set, Date, Number, String, Boolean, Object, Array, Math, JSON, RegExp, Intl, console, setTimeout, clearTimeout,
  });
  for (const file of SCRIPTS) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, file), "utf8"), context, { filename: file });
  }
  const app = Object.create(window.NzVerificationMap.prototype);
  app.backendUser = { _id: "user_1" };
  app.backend = { user: app.backendUser };
  app.guidedPeriodsByTaskId = new Map();
  return { app, window, document, elements, element, storage: localStorage };
};

// --- the detailed lane leaves the quick-entry draft ---------------------------
const draftKey = "powRapidDraft:NZ:rapid-pin";
const periodsKey = "powGuidedPeriods:NZ:user_1:rapid-pin-periods";
const draftSeed = JSON.stringify({
  values: { pinNameInput: "Place A" },
  pin: { latitude: -41.2865, longitude: 174.7762, zoom: 17 },
});
const periodsSeed = JSON.stringify({ segments: [{ id: "segment_1", status: "currently_used_for_worship" }] });
const seededStorage = () => ({ [draftKey]: draftSeed, [periodsKey]: periodsSeed });

{
  const { app, storage } = loadPortal({ search: "?batch=nz-test&detailed=1", storage: seededStorage() });
  assert.strictEqual(storage.getItem(periodsKey), periodsSeed, "the seed must sit under the periods key the portal uses");
  app.dropRapidPinFromDevice();
  assert.strictEqual(storage.getItem(draftKey), draftSeed, "detailed lane: leaving pin mode changed the quick-entry draft");
  app.discardEntryAttempt({ confirmFirst: false });
  assert.strictEqual(storage.getItem(draftKey), draftSeed, "detailed lane: discarding changed the quick-entry draft");
  assert.strictEqual(storage.getItem(periodsKey), periodsSeed, "detailed lane: discarding changed the quick-entry period cards");
}

// control: the quick-entry lane still drops the pin and keeps the typed values
{
  const { app, storage } = loadPortal({ search: "?batch=nz-test", storage: seededStorage() });
  app.dropRapidPinFromDevice();
  const record = JSON.parse(storage.getItem(draftKey));
  assert.strictEqual(record.pin, undefined, "quick-entry lane: the pin was kept");
  assert.deepStrictEqual(record.values, { pinNameInput: "Place A" }, "quick-entry lane: the typed values were lost");
  app.discardEntryAttempt({ confirmFirst: false });
  assert.strictEqual(storage.getItem(draftKey), null, "quick-entry lane: discard left the draft");
  assert.strictEqual(storage.getItem(periodsKey), null, "quick-entry lane: discard left the period cards");
}

console.log("map-pin-nomination-dom tests passed");
