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
  // a deployment without raLanding: the three list reads stand in
  fresh.backend.readLanding = async () => null;
  const first = fresh.refreshBackendTasks();
  const second = fresh.refreshBackendTasks();
  await new Promise(resolve => setTimeout(resolve, 0));
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

// a portal whose reads are scripted: the landing, the legacy lists, and the row
function portal({ landing, legacy, rows }) {
  const calls = [];
  const page = Object.create(window.NzVerificationMap.prototype);
  page.backendUser = { _id: "user_1" };
  page.backendTasksById = new Map();
  page.manualTasksById = new Map();
  page.withdrawnNominationTaskIds = new Set();
  page.myWorkItems = [];
  page.myNominationItems = [];
  page.landingState = null;
  page.pendingLanding = null;
  page.refreshesInFlight = 0;
  page.renderNominationList = () => {};
  page.renderInitialDetail = () => {};
  page.renderBackendPanel = () => {};
  page.renderSessionPanel = () => {};
  page.renderAddReviseControl = () => {};
  page.applyFilters = () => {};
  page.assignmentTaskIsAvailable = () => true;
  page.backend = {
    configured: true,
    signedIn: true,
    async readLanding(args) { calls.push(["raLanding", args]); return landing ? (typeof landing === "function" ? landing() : landing) : null; },
    async listTasks(args) { calls.push(["listTasks", args]); return (legacy?.tasks || []); },
    async listMyTasks(args) { calls.push(["listMyTasks", args]); return (legacy?.mine || []); },
    async readTaskRow(args) { calls.push(["raTaskRow", args]); return typeof rows === "function" ? rows(args) : rows ?? null; },
  };
  return { page, calls };
}
const names = calls => calls.map(call => call[0]);
const mine = (id, status, over = {}) => ({ task: { task_id: id, batch_id: "nz-temporal-ra-workpack-001", status, assigned_to: "user_1", updated_at: 10, ...over }, latestDraft: null, latestReview: null });

// 5. the full read is one raLanding call, with the page's arguments
{
  const landing = {
    user: { _id: "user_1" },
    tasks: [{ task_id: "t1", status: "open", updated_at: 1 }],
    manualTasks: [{ task_id: "m1", batch_id: "manual-nz", status: "in_progress", updated_at: 1 }],
    myWork: [mine("t1", "in_progress")],
  };
  const { page, calls } = portal({ landing });
  await page.refreshBackendTasks();
  assert.deepEqual(names(calls), ["raLanding"]);
  assert.equal(calls[0][1].batchId, "nz-temporal-ra-workpack-001");
  assert.equal(calls[0][1].limit, 1000);
  assert.ok(Array.isArray(calls[0][1].myStatuses) && calls[0][1].myStatuses.includes("changes_requested"));
  assert.equal(page.backendTasksById.size, 2);
  assert.equal(page.myWorkItems.length, 1);
}

// 6. a landing that arrived with the session restore is used once, then reads are live
{
  const landing = { user: { _id: "user_1" }, tasks: [{ task_id: "t1", status: "open", updated_at: 1 }], manualTasks: [], myWork: [] };
  const { page, calls } = portal({ landing });
  page.pendingLanding = landing;
  await page.refreshBackendTasks();
  assert.deepEqual(names(calls), [], "the restore's landing needs no second read");
  assert.equal(page.backendTasksById.get("t1").status, "open");
  await page.refreshBackendTasks();
  assert.deepEqual(names(calls), ["raLanding"]);
}

// 7. without raLanding the legacy reads run, in the old order
{
  const { page, calls } = portal({ landing: null, legacy: { tasks: [{ task_id: "t1", status: "open", updated_at: 1 }], mine: [mine("t1", "in_progress")] } });
  await page.refreshBackendTasks();
  assert.deepEqual(names(calls), ["raLanding", "listTasks", "listTasks", "listMyTasks"]);
  assert.equal(calls[2][1].batchId, "manual-nz");
  assert.equal(page.myWorkItems.length, 1);
}

// 8. after a write one row is read, and no list is: the task, my work and the derived lists update
{
  const landing = {
    user: { _id: "user_1" },
    tasks: [{ task_id: "t1", status: "in_progress", updated_at: 10, assigned_to: "user_1" }, { task_id: "t2", status: "open", updated_at: 5 }],
    manualTasks: [],
    myWork: [mine("t1", "in_progress", { last_event_at: 10 })],
  };
  const row = { task: { task_id: "t1", batch_id: "nz-temporal-ra-workpack-001", status: "needs_review", assigned_to: "user_1", updated_at: 20, last_event_at: 20 }, latestDraft: { evidence_draft_id: "d1", draft_status: "submitted", created_at: 1, updated_at: 2 }, latestReview: null };
  const { page, calls } = portal({ landing, rows: { row } });
  await page.refreshBackendTasks();
  calls.length = 0;
  await page.refreshTaskRow("t1");
  assert.deepEqual(names(calls), ["raTaskRow"]);
  assert.equal(JSON.stringify(calls[0][1]), JSON.stringify({ taskId: "t1" }));
  assert.equal(page.backendTasksById.get("t1").status, "needs_review");
  assert.equal(page.backendTasksById.get("t2").status, "open", "other rows keep their held copy");
  assert.equal(page.myWorkItems.length, 1);
  assert.equal(page.myWorkItems[0].latestDraft.draft_status, "submitted");
}

// 9. a row that leaves my work (reassigned or in a status my work does not list) leaves the list
{
  const landing = { user: { _id: "user_1" }, tasks: [{ task_id: "t1", status: "in_progress", updated_at: 10 }], manualTasks: [], myWork: [mine("t1", "in_progress")] };
  const row = { task: { task_id: "t1", batch_id: "nz-temporal-ra-workpack-001", status: "provisionally_closed", assigned_to: "user_1", updated_at: 20 }, latestDraft: null, latestReview: null };
  const { page } = portal({ landing, rows: { row } });
  await page.refreshBackendTasks();
  await page.refreshTaskRow("t1");
  assert.equal(page.myWorkItems.length, 0);
  assert.equal(page.backendTasksById.get("t1").status, "provisionally_closed");
}

// 10. a stale row stays out by the held stamp
{
  const landing = { user: { _id: "user_1" }, tasks: [{ task_id: "t1", status: "exported", updated_at: 200 }], manualTasks: [], myWork: [] };
  const row = { task: { task_id: "t1", batch_id: "nz-temporal-ra-workpack-001", status: "in_progress", updated_at: 100 }, latestDraft: null, latestReview: null };
  const { page } = portal({ landing, rows: { row } });
  await page.refreshBackendTasks();
  await page.refreshTaskRow("t1");
  assert.equal(page.backendTasksById.get("t1").status, "exported");
}

// 11. a row that lands after a newer full read began is dropped
{
  const landing = { user: { _id: "user_1" }, tasks: [{ task_id: "t1", status: "in_progress", updated_at: 10 }], manualTasks: [], myWork: [] };
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const row = { task: { task_id: "t1", batch_id: "nz-temporal-ra-workpack-001", status: "needs_review", updated_at: 20 }, latestDraft: null, latestReview: null };
  const { page, calls } = portal({ landing, rows: () => gate.then(() => ({ row })) });
  await page.refreshBackendTasks();
  calls.length = 0;
  const pendingRow = page.refreshTaskRow("t1");
  await new Promise(resolve => setTimeout(resolve, 0));
  // a full read begins and finishes while the row read is out
  page.refreshGeneration += 1;
  release();
  await pendingRow;
  assert.equal(page.backendTasksById.get("t1").status, "in_progress", "the dropped row changed nothing");
  assert.deepEqual(names(calls), ["raTaskRow"]);
}

// 11b. two row reads for one task answered in reverse order: the older
// response is dropped as a whole, so its draft and review never pair with the newer task
{
  const landing = { user: { _id: "user_1" }, tasks: [{ task_id: "t1", status: "in_progress", updated_at: 10 }], manualTasks: [], myWork: [mine("t1", "in_progress")] };
  const releases = [];
  const reply = (status, stamp, draftId) => ({ row: { task: { task_id: "t1", batch_id: "nz-temporal-ra-workpack-001", status, assigned_to: "user_1", updated_at: stamp }, latestDraft: { evidence_draft_id: draftId, updated_at: stamp }, latestReview: null } });
  const { page } = portal({ landing, rows: () => new Promise(resolve => releases.push(resolve)) });
  await page.refreshBackendTasks();
  const first = page.refreshTaskRow("t1");
  await new Promise(resolve => setTimeout(resolve, 0));
  const second = page.refreshTaskRow("t1");
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(releases.length, 2);
  // the newer request answers first, the older one afterwards
  releases[1](reply("needs_review", 30, "d-new"));
  await second;
  releases[0](reply("in_progress", 20, "d-old"));
  await first;
  assert.equal(page.backendTasksById.get("t1").status, "needs_review");
  const held = page.landingState.myItems.find(item => item.task.task_id === "t1");
  assert.equal(held.task.status, "needs_review");
  assert.equal(held.latestDraft.evidence_draft_id, "d-new", "the draft belongs to the newer response");
}

// 12. a full read in flight, no held landing, an unsupported raTaskRow, or a hidden row: a full read stands in
{
  const landing = { user: { _id: "user_1" }, tasks: [{ task_id: "t1", status: "open", updated_at: 10 }], manualTasks: [], myWork: [] };
  const unsupported = portal({ landing, rows: null });
  await unsupported.page.refreshBackendTasks();
  unsupported.calls.length = 0;
  await unsupported.page.refreshTaskRow("t1");
  assert.deepEqual(names(unsupported.calls), ["raTaskRow", "raLanding"]);

  const hidden = portal({ landing, rows: { row: null } });
  await hidden.page.refreshBackendTasks();
  hidden.calls.length = 0;
  await hidden.page.refreshTaskRow("t1");
  assert.deepEqual(names(hidden.calls), ["raTaskRow", "raLanding"]);

  const cold = portal({ landing, rows: { row: mine("t1", "open") } });
  await cold.page.refreshTaskRow("t1");
  assert.deepEqual(names(cold.calls), ["raLanding"], "no held landing: the full read");

  const failing = portal({ landing, rows: () => { throw new Error("Task is assigned to another user."); } });
  await failing.page.refreshBackendTasks();
  failing.calls.length = 0;
  await failing.page.refreshTaskRow("t1");
  assert.deepEqual(names(failing.calls), ["raTaskRow", "raLanding"]);

  const busy = portal({ landing, rows: { row: mine("t1", "open") } });
  await busy.page.refreshBackendTasks();
  busy.calls.length = 0;
  busy.page.refreshesInFlight = 1;
  await busy.page.refreshTaskRow("t1");
  assert.deepEqual(names(busy.calls), ["raLanding"], "an in-flight full read may predate the write");
}

// 13. an anonymous answer or an expired session shows the message, as the list queries did
{
  const { page } = portal({ landing: () => { const error = new Error("Your sign-in expired. Sign in again, then retry."); error.authExpired = true; throw error; } });
  await page.refreshBackendTasks();
  assert.equal(page.backendLastError, "Your sign-in expired. Sign in again, then retry.");
}

console.log("refresh-merge: 13 checks passed");
})().catch((error) => { console.error(error); process.exit(1); });
