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

// device drafts live under owner-scoped keys since c1
const snapshotKey = "powFormSnapshot2:NZ:user_a:task_1";
const rapidKey = "powRapidDraft2:NZ:user_a:rapid-pin";

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

// 1b. drafts written before c1 carry no owner: device access is not
// authorship, so they are quarantined. they stay on the device exactly as
// written, are never read into a form or shown, and every signed-in user
// on the device sees a notice until they dismiss it for the session (round
// 3: never deleted, never claimed by the first account to sign in)
{
  values.clear();
  const { app } = signedInApp("user_b");
  const legacy = {
    "powRapidDraft:NZ:rapid-pin": JSON.stringify({ saved_at: 1, values: { directObservation: "legacy text" }, pin: { latitude: 1, longitude: 2 } }),
    "powFormSnapshot:NZ:task_9": JSON.stringify({ saved_at: 1, snapshot: { evidence_note: "legacy note" } }),
    "powFormSnapshot:VU:task_3": JSON.stringify({ saved_at: 1, snapshot: { evidence_note: "legacy vu" } }),
  };
  for (const [key, value] of Object.entries(legacy)) values.set(key, value);
  assert.equal(app.readRapidDraft("rapid-pin"), null, "a legacy draft is read for nobody");
  assert.equal(app.getFormSnapshot("task_9"), undefined);
  // a new draft of the same kind goes to its own owner-scoped key and never
  // overwrites the legacy record
  app.pinConfirmed = null;
  app.persistRapidDraft("pin", "rapid-pin");
  app.setFormSnapshot("task_9", { evidence_note: "b's new note" });
  for (const [key, value] of Object.entries(legacy)) assert.equal(values.get(key), value, `${key} kept exactly as written`);
  assert.equal(app.legacyDeviceDraftCount(), 3, "every country's legacy drafts are counted");
  const notice = app.legacyDraftNoticeHtml();
  assert.match(notice, /This device holds 3 unsaved entries from before the sign-in update\. They are kept safely and are not shown to anyone\. Contact the project team to recover them\./);
  assert.doesNotMatch(notice, /legacy (text|note|vu)/, "the notice shows no content");
  assert.match(notice, /id="legacyDraftNoticeDismiss"/);
  assert.equal(app.legacyDraftNoticeHtml(), notice, "it persists across repaints");
  app.dismissLegacyDraftNotice();
  assert.equal(app.legacyDraftNoticeHtml(), "", "dismissed for this session");
  values.delete("powLegacyDraftNoticeDismissed:v1");
  assert.match(app.legacyDraftNoticeHtml(), /3 unsaved entries/, "a new session shows it again");
  // a deliberate sign-out never touches them
  app.onBackendSessionEnded({ deliberate: true });
  for (const [key, value] of Object.entries(legacy)) assert.equal(values.get(key), value);
  // a signed-out page writes nothing to the device
  const signedOut = signedInApp("user_x").app;
  signedOut.backendUser = null;
  values.clear();
  signedOut.setFormSnapshot("task_1", { evidence_note: "typed signed out" });
  signedOut.persistRapidDraft("pin", "rapid-pin");
  assert.equal(values.size, 0, "nothing ownerless is written");
}

// 1c. a deliberate sign-out deletes the departing user's snapshots and
// rapid drafts, text and pin, on every country, and nobody else's
{
  values.clear();
  const { app } = signedInApp("user_b");
  values.set("powFormSnapshot2:NZ:user_a:task_a", JSON.stringify({ saved_at: 1, owner: "user_a", snapshot: {} }));
  values.set("powFormSnapshot2:NZ:user_b:task_b", JSON.stringify({ saved_at: 1, owner: "user_b", snapshot: {} }));
  values.set("powRapidDraft2:NZ:user_a:rapid-pin", JSON.stringify({ saved_at: 1, owner: "user_a", values: { directObservation: "a's text" } }));
  values.set("powRapidDraft2:NZ:user_b:rapid-pin", JSON.stringify({ saved_at: 1, owner: "user_b", values: { directObservation: "b's text" } }));
  values.set("powRapidDraft2:VU:user_b:quick", JSON.stringify({ saved_at: 1, owner: "user_b", values: {} }));
  app.onBackendSessionEnded({ deliberate: true });
  assert.ok(values.has("powFormSnapshot2:NZ:user_a:task_a"), "another contributor's kept work stays (greptile 4091758537)");
  assert.ok(values.has("powRapidDraft2:NZ:user_a:rapid-pin"));
  assert.equal(values.has("powFormSnapshot2:NZ:user_b:task_b"), false);
  assert.equal(values.has("powRapidDraft2:NZ:user_b:rapid-pin"), false, "the departing user's rapid text goes too");
  assert.equal(values.has("powRapidDraft2:VU:user_b:quick"), false, "on every country");
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

// 3b. round 3: every signed-in async path checks its session after each
// await; the task-history cache is per user and cleared at session end; a
// late submission deletes only the exact record it sent
async function roundThree() {
  const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
  const bodies = new Map();
  const node = (id) => { const el = { id, innerHTML: "", textContent: "", isConnected: true, querySelector: () => null }; bodies.set(id, el); return el; };
  const realGet = document.getElementById;
  document.getElementById = (id) => bodies.get(id) || null;

  // task history: a late response lands nowhere, and the cache is per user
  {
    const { app } = signedInApp("user_a");
    app.taskHistoryByTaskId = new Map();
    app.taskHistoryHtml = (history) => `history:${history.owner}`;
    const body = node("taskHistoryBody");
    let pending = deferred();
    Object.assign(app.backend, { configured: true, signedIn: true, user: { _id: "user_a" }, getTaskHistory: () => pending.promise });
    const late = app.loadTaskHistory("task_1");
    app.onBackendSessionEnded({ deliberate: false });
    pending.resolve({ owner: "a" });
    await late;
    assert.equal(app.taskHistoryByTaskId.size, 0, "a late history response is not cached");
    assert.doesNotMatch(body.innerHTML, /history:a/, "nor shown");

    // a cached entry serves only the user it was fetched for
    app.backendUser = { _id: "user_a" };
    app.backend.user = { _id: "user_a" };
    pending = deferred();
    const fetched = app.loadTaskHistory("task_1");
    pending.resolve({ owner: "a" });
    await fetched;
    assert.equal(body.innerHTML, "history:a");
    app.backendUser = { _id: "user_b" };
    app.backend.user = { _id: "user_b" };
    let asked = 0;
    app.backend.getTaskHistory = async () => { asked += 1; return { owner: "b" }; };
    await app.loadTaskHistory("task_1");
    assert.equal(asked, 1, "user b's history comes from the server, not a's cache");
    assert.equal(body.innerHTML, "history:b");
    app.onBackendSessionEnded({ deliberate: false });
    assert.equal(app.taskHistoryByTaskId.size, 0, "the cache empties at session end");
  }

  // attachment view: a signed URL returned after sign-out is never opened
  {
    const { app } = signedInApp("user_a");
    Object.assign(app.backend, { configured: true, signedIn: true, user: { _id: "user_a" } });
    let viewHandler = null;
    const row = { dataset: { attachmentId: "att_1" }, querySelector: (sel) => sel === ".attachment-view" ? { addEventListener: (_t, fn) => { viewHandler = fn; } } : null };
    const block = { querySelector: (sel) => sel === ".attachment-list" ? { set innerHTML(v) {}, querySelectorAll: () => [row] } : null };
    app.backend.listTaskAttachments = async () => [{ attachment_id: "att_1", byte_size: 1000, content_type: "image/jpeg" }];
    await app.refreshAttachmentList("task_1", block);
    const pending = deferred();
    app.backend.requestAttachmentView = () => pending.promise;
    const opened = [];
    window.open = (url) => opened.push(url);
    const click = viewHandler();
    app.onBackendSessionEnded({ deliberate: false });
    pending.resolve({ view_url: "https://r2.example/signed" });
    await click;
    assert.deepEqual(opened, [], "the previous user's file does not open after sign-out");
  }

  // occupancy entry: nothing opens signed out, and nothing renders after a
  // sign-out that lands mid-load (astra m1)
  {
    const { app } = signedInApp("user_a");
    let rendered = 0;
    app.renderOccupancyEntry = () => { rendered += 1; };
    app.map = { closePopup() {} };
    app.taskCanAddOccupancy = () => true;
    app.latestDraftForTask = () => ({ evidence_draft_id: "d1" });
    app.historicalClaimContext = () => ({});
    app.latestDraftsByTaskId.set("task_1", { evidence_draft_id: "d1" });
    Object.assign(app.backend, { configured: true, signedIn: true, user: { _id: "user_a" } });
    const pending = deferred();
    app.backend.listTaskOccupancies = () => pending.promise;
    const opening = app.openOccupancyFromRecord({ task_id: "task_1" });
    app.onBackendSessionEnded({ deliberate: false });
    app.backend.user = null; // as the client leaves it once clerk's session ends
    pending.resolve([]);
    await opening;
    assert.equal(rendered, 0, "no occupancy entry renders for an ended session");
    await app.openOccupancyFromRecord({ task_id: "task_1" });
    assert.equal(rendered, 0, "and none opens while signed out");
  }

  // a late rapid submission deletes only the exact draft it sent: another
  // contributor who signed in meanwhile keeps theirs, and the submitter's own
  // later edit is kept too (astra m4)
  {
    values.clear();
    const { app } = signedInApp("user_a");
    app.backend.user = { _id: "user_a" };
    values.set("powRapidDraft2:NZ:user_a:rapid-pin", JSON.stringify({ saved_at: 100, owner: "user_a", values: { directObservation: "a's sent text" } }));
    const sent = app.rapidDraftVersion("rapid-pin");
    assert.deepEqual({ ...sent }, { owner: "user_a", savedAt: 100 });
    // a signs out while the submission is in flight; b signs in and types
    app.onBackendSessionEnded({ deliberate: false });
    app.backendUser = { _id: "user_b" };
    app.backend.user = { _id: "user_b" };
    values.set("powRapidDraft2:NZ:user_b:rapid-pin", JSON.stringify({ saved_at: 200, owner: "user_b", values: { directObservation: "b's unsent text" } }));
    app.clearSubmittedRapidDraft("rapid-pin", sent);
    assert.equal(values.has("powRapidDraft2:NZ:user_a:rapid-pin"), false, "a's sent draft goes, so it is never sent twice");
    assert.ok(values.has("powRapidDraft2:NZ:user_b:rapid-pin"), "b's draft is untouched");
    // a newer edit of the same key is not the sent version
    values.set("powRapidDraft2:NZ:user_a:rapid-pin", JSON.stringify({ saved_at: 300, owner: "user_a", values: { directObservation: "a typed more" } }));
    app.clearSubmittedRapidDraft("rapid-pin", sent);
    assert.ok(values.has("powRapidDraft2:NZ:user_a:rapid-pin"), "a later edit stays");
    // the same for a guided form snapshot
    values.set("powFormSnapshot2:NZ:user_a:task_1", JSON.stringify({ saved_at: 400, owner: "user_a", snapshot: {} }));
    app.backendUser = { _id: "user_a" };
    app.backend.user = { _id: "user_a" };
    const snap = app.formSnapshotVersion("task_1");
    app.backendUser = { _id: "user_b" };
    app.backend.user = { _id: "user_b" };
    values.set("powFormSnapshot2:NZ:user_b:task_1", JSON.stringify({ saved_at: 500, owner: "user_b", snapshot: {} }));
    app.deleteSubmittedFormSnapshot("task_1", snap);
    assert.equal(values.has("powFormSnapshot2:NZ:user_a:task_1"), false);
    assert.ok(values.has("powFormSnapshot2:NZ:user_b:task_1"), "b's snapshot is untouched");
  }

  // quick photo: a sign-out during the refresh that follows the send leaves
  // the page as the sign-out left it (astra m1, line 4486)
  {
    values.clear();
    const { app } = signedInApp("user_a");
    Object.assign(app.backend, { configured: true, signedIn: true, user: { _id: "user_a" } });
    app.quickPhoto = { fix: { latitude: -41.29, longitude: 174.78, accuracyM: 10 }, submissionId: "sub_1", file: null, nearbyShown: true };
    const refreshing = deferred();
    let recorded = 0;
    app.refreshBackendTasks = () => refreshing.promise;
    app.renderSubmissionRecordedDetail = () => { recorded += 1; };
    let submitted = 0;
    let refreshed = 0;
    app.refreshBackendTasks = () => { refreshed += 1; return refreshing.promise; };
    app.backend.submitCurrentObservation = async () => { submitted += 1; return { task_id: "t_q", task_status: "needs_review", candidate_site_id: "c1" }; };
    // the contracts and helpers the send path reads, stubbed
    window.PowRapidEntry = { localIsoDate: () => "2026-09-24", validateObservationDetailed: () => null, observationPayload: (x) => x };
    window.PowLocationAssertion = { payload: (x) => x };
    Object.assign(app, {
      entryCountryFor: () => ({ code: "NZ", config: { targetYears: [2026] } }),
      quickPhotoRadius: () => 50,
      quickPhotoNearby: () => [],
      quickPhotoDiscussionNote: () => "photo",
      map: { getZoom: () => 17 },
      withdrawnNominationTaskIds: new Set(),
      manualTasksById: new Map(),
    });
    const sending = app.sendQuickPhoto().catch((error) => error);
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(submitted, 1, "the photo was sent");
    assert.equal(refreshed, 1, "and the refresh after it started");
    app.onBackendSessionEnded({ deliberate: false });
    refreshing.resolve();
    await sending;
    assert.equal(recorded, 0, "the recorded-submission card does not render after sign-out");
    assert.equal(app.backendTasksById.size, 0);
    assert.equal(app.manualTasksById?.size ?? 0, 0);
  }

  document.getElementById = realGet;
}

// 3. the sign-out button waits for clerk: success says signed out, a
// refusal says the sign-out did not finish
(async () => {
  await roundThree();
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
