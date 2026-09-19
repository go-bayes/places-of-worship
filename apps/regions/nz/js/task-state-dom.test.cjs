// the ra portal's task states through the shared presentation contract (jb
// ruling 2026-09-19): one pill per list row, the my-work rollup, the
// actionable status as the control, the transport dot by the account name
// and the one-line empty states, all held by the actual portal class in a
// stub dom
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
    setAttribute(name, value) { this.attrs[name] = value; }, addEventListener() {}, querySelectorAll() { return []; }, ...extra };
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
  app.backendLastError = "";
  app.transportBusy = "";
  app.signedOutDeliberately = false;
  app.backendTasksById = new Map();
  app.latestDraftsByTaskId = new Map();
  app.revisionDraftIdsByTaskId = new Map();
  app.myWorkItems = [];
  app.myNominationItems = [];
  app.sessionEntries = [];
  app.tasks = [];
  app.filteredTasks = [];
  app.visibleLimit = 80;
  app.selectedTask = null;
  app.targetYear = "2018";
  app.syncPortalChrome = () => {};
  app.renderChangesRequestedBadge = () => {};
  return app;
};
const task = (task_id, status, extra = {}) => ({ task_id, status, name: `Place ${task_id}`, batch_id: "nz-temporal-ra-workpack-001", priority: "high", ...extra });
const feature = (t) => ({ type: "Feature", properties: { task_id: t.task_id, name: t.name, verification_priority: t.priority, automated_checks: [] }, geometry: { type: "Point", coordinates: [174.7, -41.3] } });

// 1. one state pill per list row, in the contract's words and tone
{
  const app = fresh();
  const changes = task("t-changes", "changes_requested");
  const exported = task("t-exported", "exported");
  app.backendTasksById.set(changes.task_id, changes);
  app.backendTasksById.set(exported.task_id, exported);
  app.filteredTasks = [feature(exported), feature(changes)];
  const list = element("taskList", { hidden: false });
  app.renderTaskList();
  const html = list.innerHTML;
  assert.match(html, /<span class="state-pill tone-act" title="[^"]+">Changes requested<\/span>/, "a changes_requested row wears the act pill");
  assert.match(html, /<span class="state-pill tone-done">Exported<\/span>/, "an exported row wears the done pill");
  assert.doesNotMatch(html, /backend-badge|skip-badge|closed-badge/, "the raw server badge and the session badges are gone");
  const row = html.slice(html.indexOf('data-task-id="t-changes"'));
  assert.ok(row.indexOf("Changes requested") < row.indexOf('class="status-pill'), "the state pill comes before the target-year pill");
  assert.match(html, /class="status-pill status-[a-z-]+"/, "the target-year pill keeps its classes");
  // the visible order follows urgency once the filters run
  element("searchInput", { value: "" });
  app.tasks = [feature(exported), feature(changes)];
  app.renderMarkers = () => {};
  app.updateStats = () => {};
  app.applyFilters();
  // joined: the vm realm's arrays fail a cross-realm deep equality
  assert.equal(app.filteredTasks.map((f) => f.properties.task_id).join(","), "t-changes,t-exported", "changes requested sorts above exported");
}

// 2. a row known only from this browser's session log presents its outcome
{
  const app = fresh();
  app.backend = { configured: false };
  app.sessionEntries = [{ task_id: "t-local", type: "skipped" }];
  app.filteredTasks = [feature(task("t-local", undefined))];
  const list = element("taskList", { hidden: false });
  app.renderTaskList();
  assert.match(list.innerHTML, /<span class="state-pill tone-rest" title="[^"]+">Skipped<\/span>/);
}

// 3. the my-work rollup and the actionable pill as the control
{
  const app = fresh();
  app.myWorkItems = [
    { task: task("t-1", "changes_requested"), latestDraft: null, latestReview: { decision_status: "changes_requested", decision_note: "Add a source." } },
    { task: task("t-2", "draft_saved"), latestDraft: { draft_status: "draft" }, latestReview: null },
    { task: task("t-3", "exported"), latestDraft: null, latestReview: null },
  ];
  const panel = element("myWorkPanel", { hidden: false });
  app.renderMyWorkPanel(panel);
  const html = panel.innerHTML;
  assert.match(html, /<span class="state-rollup"><span class="state-pill tone-act">1 need your action<\/span><span>of 3<\/span><\/span>/, "the rollup names the act count over the total");
  assert.doesNotMatch(html, /needs? attention|ra-initials/, "the hand-rolled count is gone");
  assert.match(html, /<button type="button" class="state-pill tone-act my-work-open" data-task-id="t-1" data-action="revise"[^>]*>Changes requested<\/button>/, "an actionable status is the control");
  assert.match(html, /<button type="button" class="state-pill tone-motion my-work-open" data-task-id="t-2" data-action="continue">Draft saved<\/button>/);
  assert.match(html, /<span class="state-pill tone-done">Exported<\/span>/, "a row without an action keeps a span");
  assert.doesNotMatch(html, /revision draft saved|submitted, waiting for review|needs more evidence/, "the inline label ladder is gone");
  // a queued task with an editable draft alongside is a revision in hand
  app.myWorkItems = [{ task: task("t-4", "needs_review"), latestDraft: { draft_status: "draft" }, latestReview: null }];
  app.renderMyWorkPanel(panel);
  assert.match(panel.innerHTML, /tone-motion my-work-open" data-task-id="t-4" data-action="continue">Revision draft saved</);
  // the rollup omits "of N" when the pill already counts every row
  app.myWorkItems = [{ task: task("t-5", "changes_requested"), latestDraft: null, latestReview: null }];
  app.renderMyWorkPanel(panel);
  assert.match(panel.innerHTML, /<span class="state-rollup"><span class="state-pill tone-act">1 need your action<\/span><\/span>/);
  // empty: one line, no button
  app.myWorkItems = [];
  app.renderMyWorkPanel(panel);
  assert.match(panel.innerHTML, /<div class="state-empty">Nothing saved or submitted yet.<\/div>/);
  assert.doesNotMatch(panel.innerHTML, /session-empty/);
}

// 4. the transport dot by the account name, and the batch rollup on the card
{
  const app = fresh();
  app.portalMode = "assigned";
  app.getRaInitials = () => "JB";
  const open = task("t-open", "open");
  app.backendTasksById.set(open.task_id, open);
  app.tasks = [feature(open)];
  app.myWorkItems = [{ task: task("t-6", "changes_requested"), latestDraft: null, latestReview: null }];
  const panel = element("backendPanel", { hidden: false });
  app.renderBackendPanel();
  let html = panel.innerHTML;
  assert.match(html, /Signed in as JB\. <span class="transport-dot tone-done" id="transportDot" aria-live="polite" data-state="ready">Connected<\/span>/, "connected reads as a done-toned dot");
  assert.match(html, /Assigned batch: <strong>nz-temporal-ra-workpack-001<\/strong>/, "the batch line stays");
  assert.match(html, /<span class="state-rollup"><span class="state-pill tone-act">1 need your action<\/span><span>of 2<\/span><\/span>/, "the card carries one rollup over available tasks and my work");
  assert.doesNotMatch(html, /available task|in My work\./, "the two counts are gone");
  // a backend error is a broken dot
  app.backendLastError = "Session expired. Sign in again.";
  app.renderBackendPanel();
  html = panel.innerHTML;
  assert.match(html, /<span class="transport-dot tone-broken" id="transportDot" aria-live="polite" data-state="error">Connection problem<\/span>/);
  // a save in flight updates the dot in place
  app.backendLastError = "";
  app.renderBackendPanel();
  const dot = element("transportDot", { hidden: false });
  app.setTransportBusy("saving");
  assert.equal(app.transportState(), "saving");
  assert.equal(dot.textContent, "Saving");
  assert.equal(dot.className, "transport-dot tone-motion");
  app.setTransportBusy("");
  assert.equal(dot.textContent, "Connected");
  // a deliberate sign-out is not a connection problem; an expired session is
  app.backendUser = null;
  app.backendLastError = "Signed out here.";
  app.signedOutDeliberately = true;
  assert.equal(app.transportState(), "signed_out");
  app.signedOutDeliberately = false;
  assert.equal(app.transportState(), "error");
  app.backend = { configured: false };
  assert.equal(app.transportState(), "unconfigured");
}

// 5. the empty task list: one line and one action
{
  const app = fresh();
  const list = element("taskList", { hidden: false });
  element("searchInput", { value: "" });
  element("priorityFilter", { value: "all" });
  app.renderTaskList();
  assert.match(list.innerHTML, /<div class="state-empty">\s*<span>Nothing assigned in this batch yet.<\/span>\s*<button type="button" id="taskListEmptyAction">Refresh<\/button>/);
  elements.get("priorityFilter").value = "high";
  app.renderTaskList();
  assert.match(list.innerHTML, /<span>No tasks match your filters.<\/span>\s*<button type="button" id="taskListEmptyAction">Clear filters<\/button>/);
  app.backendUser = null;
  app.renderTaskList();
  assert.match(list.innerHTML, /<div class="state-empty">\s*<span>Sign in to load this workpack.<\/span>\s*<\/div>/, "the signed-out case has no button");
  assert.doesNotMatch(list.innerHTML, /disabled-panel/);
  // clear filters resets every control and re-runs the filters
  app.backendUser = { _id: "user_1" };
  let applied = 0;
  app.applyFilters = () => { applied += 1; };
  app.clearFilters();
  assert.equal(elements.get("priorityFilter").value, "all");
  assert.equal(applied, 1);
}

// 6. the detail heading carries the same pill as the list row, with its hint
{
  const app = fresh();
  const changes = task("t-changes", "changes_requested");
  app.backendTasksById.set(changes.task_id, changes);
  assert.equal(
    app.detailStateHtml("t-changes"),
    '<div class="detail-state"><span class="state-pill tone-act" title="The reviewer asked for more evidence.">Changes requested</span><span class="muted">The reviewer asked for more evidence.</span></div>',
  );
  assert.equal(app.detailStateHtml("t-unknown"), "", "a task the page knows nothing about shows no pill");
}

console.log("task-state-dom: ok");
