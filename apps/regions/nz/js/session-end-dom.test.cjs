// a clerk session that ends with the portal open (c1 review, astra m2):
// the page keeps nothing of the person on screen, exactly as on the sign-out
// button, while their unsent drafts stay on the device keyed to their user
// id and come back only for them. the sign-out button reports completion
// only once clerk confirms it (sol m2, astra m3)
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

function signedInApp(userId = "user_a") {
  const app = Object.create(window.NzVerificationMap.prototype);
  const calls = { detail: 0, panel: 0, exitPin: 0 };
  Object.assign(app, {
    backend: { user: null, signOut: async () => {} },
    backendUser: { _id: userId, initials: "GL" },
    backendLastError: "",
    signedOutDeliberately: false,
    portalMode: "add",
    pinMode: false,
    backendTasksById: new Map([["task_1", { task_id: "task_1" }]]),
    latestDraftsByTaskId: new Map([["task_1", { evidence_note: "private note" }]]),
    myWorkItems: [{ task_id: "task_1" }],
    myNominationItems: [{ task_id: "task_2" }],
    revisionDraftIdsByTaskId: new Map([["task_1", "draft_1"]]),
    formSnapshotsByTaskId: new Map(),
    guidedPeriodsByTaskId: new Map([["task_1", { segments: [{}] }]]),
    tasks: [{ properties: { task_id: "task_1" } }],
    filteredTasks: [{ properties: { task_id: "task_1" } }],
    selectedTask: { properties: { task_id: "task_1" } },
    assignedAvailableCount: 3,
    markerLayer: { clearLayers() { calls.cleared = true; } },
    formDirty: true,
    formDirtyTaskId: "task_1",
  });
  app.renderBackendPanel = () => { calls.panel += 1; };
  app.renderInitialDetail = () => { calls.detail += 1; };
  app.applyFilters = () => {};
  app.exitPinMode = () => { calls.exitPin += 1; app.dropRapidPinFromDevice(); app.pinMode = false; };
  return { app, calls };
}

const snapshotKey = "powFormSnapshot:NZ:task_1";
const rapidKey = "powRapidDraft:NZ:rapid-pin";

// 1. an ended session empties the page but keeps the owner's device drafts
{
  values.clear();
  const { app, calls } = signedInApp("user_a");
  app.setFormSnapshot("task_1", { evidence_note: "typed, unsent" });
  assert.equal(JSON.parse(values.get(snapshotKey)).owner, "user_a", "the device copy names its owner");
  app.pinConfirmed = { latitude: -41.29, longitude: 174.78 };
  values.set(rapidKey, JSON.stringify({ saved_at: 1, owner: "user_a", values: { directObservation: "a church hall" }, pin: { latitude: -41.29, longitude: 174.78 } }));
  const periodsPrefix = window.PowOccupancy.guidedPeriodsStoragePrefix("NZ", "user_a");
  values.set(`${periodsPrefix}task_1`, JSON.stringify({ segments: [{ start: "2001" }] }));
  app.pinMode = true;

  app.onBackendSessionEnded({ deliberate: false });

  assert.equal(app.backendUser, null);
  assert.equal(app.backendTasksById.size, 0);
  assert.equal(app.latestDraftsByTaskId.size, 0, "no evidence of theirs stays in memory");
  assert.equal(app.myWorkItems.length, 0);
  assert.equal(app.myNominationItems.length, 0);
  assert.equal(app.revisionDraftIdsByTaskId.size, 0);
  assert.equal(app.formSnapshotsByTaskId.size, 0);
  assert.equal(app.guidedPeriodsByTaskId.size, 0);
  assert.equal(app.tasks.length, 0);
  assert.equal(app.selectedTask, null, "the open task leaves the screen");
  assert.equal(calls.detail, 1, "the detail pane is repainted empty");
  assert.equal(calls.exitPin, 1, "an open pin entry is closed");
  assert.equal(app.formDirty, false);
  assert.equal(app.portalMode, "add", "the chosen activity is kept for the return");
  assert.match(app.backendLastError, /Your sign-in ended/);
  // the owner's unsent work stays on the device, pin included
  assert.ok(values.has(snapshotKey));
  assert.ok(JSON.parse(values.get(rapidKey)).pin, "the kept pin survives an ended session");
  assert.ok(values.has(`${periodsPrefix}task_1`));

  // another person signing in on the same device sees none of it
  app.backendUser = { _id: "user_b" };
  assert.equal(app.getFormSnapshot("task_1"), undefined);
  assert.equal(app.readRapidDraft("rapid-pin"), null);
  // nor does a signed-out page
  app.backendUser = null;
  assert.equal(app.getFormSnapshot("task_1"), undefined);
  assert.equal(app.readRapidDraft("rapid-pin"), null);
  // the owner gets it back
  app.backendUser = { _id: "user_a" };
  assert.equal(app.getFormSnapshot("task_1").evidence_note, "typed, unsent");
  assert.equal(app.readRapidDraft("rapid-pin").values.directObservation, "a church hall");
}

let noticeCheck = Promise.resolve();

// 1b. drafts written before owners were recorded belong to nobody: never
// read back for anyone, removed at load, the next sign-in told without
// seeing them; a signed-out page writes nothing ownerless
{
  values.clear();
  const { app } = signedInApp("user_b");
  values.set("powRapidDraft:NZ:rapid-pin", JSON.stringify({ saved_at: 1, values: { directObservation: "legacy text" }, pin: { latitude: 1, longitude: 2 } }));
  values.set("powFormSnapshot:NZ:task_9", JSON.stringify({ saved_at: 1, snapshot: { evidence_note: "legacy note" } }));
  values.set("powFormSnapshot:VU:task_3", JSON.stringify({ saved_at: 1, snapshot: { evidence_note: "legacy vu" } }));
  values.set("powFormSnapshot:NZ:task_8", JSON.stringify({ saved_at: 1, owner: "user_a", snapshot: { evidence_note: "a's" } }));
  assert.equal(app.readRapidDraft("rapid-pin"), null, "an ownerless draft is granted to nobody");
  assert.equal(app.getFormSnapshot("task_9"), undefined);
  assert.equal(app.dropOwnerlessDeviceDrafts(), 3, "every country's ownerless drafts go");
  assert.equal(values.has("powRapidDraft:NZ:rapid-pin"), false);
  assert.equal(values.has("powFormSnapshot:VU:task_3"), false);
  assert.ok(values.has("powFormSnapshot:NZ:task_8"), "owned drafts stay");
  let notice = "";
  app.setBackendTransientStatus = (text) => { notice = text; };
  Object.assign(app, { refreshBackendTasks: async () => {}, setTransportBusy() {}, restorePortalMode() {}, renderDetailPreservingForm() {}, applyPendingDeepLink() {}, resumeRapidPinFromDevice() {} });
  noticeCheck = Promise.resolve(app.onBackendSignedIn({ _id: "user_b" }, { refreshTasks: false })).then(() => {
    assert.match(notice, /3 unsaved entries kept on this device from before the sign-in change could not be matched to an account and were removed/);
    assert.doesNotMatch(notice, /legacy/, "the notice names no content");
    assert.equal(app.ownerlessDraftsDropped, 0, "told once");
  });
  const signedOut = signedInApp("user_x").app;
  signedOut.backendUser = null;
  values.clear();
  signedOut.setFormSnapshot("task_1", { evidence_note: "typed signed out" });
  signedOut.persistRapidDraft("pin", "rapid-pin");
  assert.equal(values.size, 0, "nothing ownerless is written");
}

// 1c. a deliberate sign-out deletes only its own user's snapshots
{
  values.clear();
  const { app } = signedInApp("user_b");
  values.set("powFormSnapshot:NZ:task_a", JSON.stringify({ saved_at: 1, owner: "user_a", snapshot: {} }));
  values.set("powFormSnapshot:NZ:task_b", JSON.stringify({ saved_at: 1, owner: "user_b", snapshot: {} }));
  app.onBackendSessionEnded({ deliberate: true });
  assert.ok(values.has("powFormSnapshot:NZ:task_a"), "another contributor's kept work stays (greptile 4091758537)");
  assert.equal(values.has("powFormSnapshot:NZ:task_b"), false);
}

// 2. a deliberate sign-out also deletes the device copies and the activity
{
  values.clear();
  const { app } = signedInApp("user_a");
  app.setFormSnapshot("task_1", { evidence_note: "typed" });
  const periodsPrefix = window.PowOccupancy.guidedPeriodsStoragePrefix("NZ", "user_a");
  values.set(`${periodsPrefix}task_1`, JSON.stringify({ segments: [{}] }));
  app.onBackendSessionEnded({ deliberate: true });
  assert.equal(values.has(snapshotKey), false);
  assert.equal(values.has(`${periodsPrefix}task_1`), false);
  assert.equal(app.portalMode, null);
  assert.match(app.backendLastError, /^Signed out\./);
}

// 3a. responses asked for by an ended session land nowhere (sol m4)
async function lateResponses() {
  const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
  values.clear();
  const { app } = signedInApp("user_a");
  let pending = deferred();
  Object.assign(app.backend, { configured: true, signedIn: true, user: { _id: "user_a" }, listTasks: () => pending.promise, listMyTasks: async () => [], listTaskEvidence: () => pending.promise });
  const refresh = app.refreshBackendTasks();
  app.onBackendSessionEnded({ deliberate: false });
  app.backend.user = null;
  pending.resolve([{ task_id: "secret_task", status: "open" }]);
  await refresh;
  assert.equal(app.backendTasksById.size, 0, "a late task list does not repopulate the page");
  assert.equal(app.tasks.length, 0);
  assert.equal(app.myWorkItems.length, 0);

  // a draft read in flight at sign-out is dropped too
  const second = signedInApp("user_a").app;
  pending = deferred();
  Object.assign(second.backend, { configured: true, signedIn: true, user: { _id: "user_a" }, listTaskEvidence: () => pending.promise });
  const read = second.loadLatestDraftForTask("task_1");
  second.onBackendSessionEnded({ deliberate: false });
  pending.resolve([{ evidence_note: "private" }]);
  assert.equal(await read, null);
  assert.equal(second.latestDraftsByTaskId.size, 0);

  // and one that returns after another user signed in on the same page
  const third = signedInApp("user_a").app;
  pending = deferred();
  Object.assign(third.backend, { configured: true, signedIn: true, user: { _id: "user_a" }, listTaskEvidence: () => pending.promise });
  const crossed = third.loadLatestDraftForTask("task_1");
  third.onBackendSessionEnded({ deliberate: false });
  third.backendUser = { _id: "user_b" };
  third.backend.user = { _id: "user_b" };
  pending.resolve([{ evidence_note: "a's private note" }]);
  assert.equal(await crossed, null);
  assert.equal(third.latestDraftsByTaskId.size, 0, "user a's draft never reaches user b's page");
}

// 3. the sign-out button waits for clerk: success says signed out, a
// refusal says the sign-out did not finish
(async () => {
  await noticeCheck;
  await lateResponses();
  values.clear();
  const ok = signedInApp("user_a");
  let resolveSignOut;
  ok.app.backend.signOut = () => new Promise((resolve) => { resolveSignOut = resolve; });
  const pending = ok.app.signOutBackend();
  assert.equal(ok.app.backendLastError, "Signing out…", "no success before clerk confirms");
  assert.equal(ok.app.latestDraftsByTaskId.size, 0, "the page is cleared at once");
  resolveSignOut();
  await pending;
  assert.match(ok.app.backendLastError, /^Signed out\./);

  const refused = signedInApp("user_a");
  refused.app.backend.signOut = async () => {
    const error = new Error("Sign-out did not finish, so this browser may still be signed in. Try again before you leave the device.");
    error.signOutFailed = true;
    throw error;
  };
  await refused.app.signOutBackend();
  assert.doesNotMatch(refused.app.backendLastError, /^Signed out/, "never reported as signed out");
  assert.equal(refused.app.backendLastError, "", "the card's own note carries the failure and the retry, once");
  assert.equal(refused.app.backendUser, null);
  const other = signedInApp("user_a");
  other.app.backend.signOut = async () => { throw new Error("Clerk is unreachable."); };
  await other.app.signOutBackend();
  assert.equal(other.app.backendLastError, "Clerk is unreachable.");
  assert.equal(other.app.signedOutDeliberately, false, "an unexplained failure shows as an error");
  console.log("session end dom test passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
