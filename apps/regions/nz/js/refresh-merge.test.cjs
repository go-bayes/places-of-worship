(async () => {
// a refresh never moves a task back (greptile on #127): rows merge against
// the held copy by updated_at, terminal statuses absorb an unstamped read,
// and a response superseded by a later refresh is dropped whole
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
  return { add(n) { set.add(n); }, remove(n) { set.delete(n); }, toggle(n, f) { const on = f === undefined ? !set.has(n) : Boolean(f); if (on) set.add(n); else set.delete(n); return on; }, contains(n) { return set.has(n); } };
};
const document = {
  body: { classList: classList() },
  getElementById() { return null; },
  createElement() { return { textContent: "", classList: classList(), remove() {}, addEventListener() {} }; },
  querySelector() { return null; },
  querySelectorAll() { return []; },
  addEventListener() {},
};
const window = {
  __POW_TEST_NO_BOOTSTRAP__: true,
  location: { search: "?batch=nz-temporal-ra-workpack-001", pathname: "/apps/regions/nz/verification.html" },
  localStorage, sessionStorage: localStorage,
  setTimeout, clearTimeout,
  matchMedia: () => ({ matches: false }),
  isSecureContext: true,
};
const context = vm.createContext({
  window, document, localStorage, sessionStorage: localStorage, navigator: { geolocation: null },
  URLSearchParams, Map, Set, Date, Number, String, Boolean, Object, Array, Math, JSON, RegExp, Intl, console, setTimeout, clearTimeout, Promise, Error,
});
for (const file of ["occupancy-contract.js", "function-chain-contract.js", "task-presentation.js", "verification-map.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, file), "utf8"), context, { filename: file });
}

const app = Object.create(window.NzVerificationMap.prototype);

// 1. row merge: a stale stamped read stays out, a newer one lands (a reopen included)
{
  const exported = { task_id: "t1", status: "exported", updated_at: 200 };
  const stale = { task_id: "t1", status: "in_progress", updated_at: 100 };
  const reopened = { task_id: "t1", status: "reopened", updated_at: 300 };
  assert.equal(app.mergeTaskRead(exported, stale), exported);
  assert.equal(app.mergeTaskRead(exported, reopened), reopened);
  assert.equal(app.mergeTaskRead(null, stale), stale);
  assert.equal(app.mergeTaskRead(exported, null), exported);
}

// 2. no stamps to compare: the terminal copy absorbs the read
{
  const accepted = { task_id: "t2", status: "pi_accepted" };
  const open = { task_id: "t2", status: "open" };
  assert.equal(app.mergeTaskRead(accepted, open), accepted);
  assert.equal(app.mergeTaskRead(open, accepted), accepted);
  assert.equal(app.mergeTaskRead({ task_id: "t2", status: "open" }, { task_id: "t2", status: "in_progress" }).status, "in_progress");
}

// 3. the map merge keeps every held terminal row and takes the rest
{
  const held = new Map([
    ["t1", { task_id: "t1", status: "exported", updated_at: 200 }],
    ["t2", { task_id: "t2", status: "open", updated_at: 50 }],
  ]);
  const rows = [
    { task_id: "t1", status: "in_progress", updated_at: 100 },
    { task_id: "t2", status: "in_progress", updated_at: 60 },
    { task_id: "t3", status: "open", updated_at: 10 },
    { status: "open" },
  ];
  const merged = app.mergeTaskReads(held, rows);
  assert.equal(merged.size, 3);
  assert.equal(merged.get("t1").status, "exported");
  assert.equal(merged.get("t2").status, "in_progress");
  assert.equal(merged.get("t3").status, "open");
}

// 4. two refreshes in flight: the one that started first but finished last is dropped whole
{
  const fresh = Object.create(window.NzVerificationMap.prototype);
  fresh.backend = { configured: true, signedIn: true };
  fresh.backendUser = { _id: "user_1" };
  fresh.backendTasksById = new Map();
  fresh.manualTasksById = new Map();
  fresh.withdrawnNominationTaskIds = new Set();
  fresh.myWorkItems = [];
  fresh.renderNominationList = () => {};
  fresh.renderInitialDetail = () => {};
  fresh.renderBackendPanel = () => {};
  fresh.renderSessionPanel = () => {};
  fresh.applyFilters = () => {};
  fresh.assignmentTaskIsAvailable = () => true;
  const gates = [];
  fresh.backend.listTasks = (query) => new Promise(resolve => {
    if (query.batchId && query.batchId.startsWith("manual-")) { resolve([]); return; }
    gates.push(resolve);
  });
  fresh.backend.listMyTasks = async () => [];
  const first = fresh.refreshBackendTasks();
  const second = fresh.refreshBackendTasks();
  assert.equal(gates.length, 2);
  // the second refresh answers first with the newer row
  gates[1]([{ task_id: "t1", status: "exported", updated_at: 200 }]);
  await second;
  assert.equal(fresh.backendTasksById.get("t1").status, "exported");
  // the first refresh answers late with the older row: dropped
  gates[0]([{ task_id: "t1", status: "in_progress", updated_at: 100 }]);
  await first;
  assert.equal(fresh.backendTasksById.get("t1").status, "exported");
}

console.log("refresh-merge: 4 checks passed");
})().catch((error) => { console.error(error); process.exit(1); });
