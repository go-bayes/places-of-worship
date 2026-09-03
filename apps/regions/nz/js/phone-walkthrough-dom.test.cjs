// jb's phone walkthrough of 2026-09-04, held by the actual portal class in a
// stub dom: in add or revise the sidebar shows the selected work (no My work
// list; a bounced nomination's alert stays), past submissions open from the
// card's button and hide again, and the points control on the map moves by
// its grip, clamps to the map, and remembers the spot on this device
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
  const item = {
    id, value: "", hidden: true, textContent: "", innerHTML: "", attrs: {},
    classList: classList(),
    setAttribute(name, value) { this.attrs[name] = value; },
    querySelectorAll() { return []; },
    querySelector() { return null; },
    addEventListener() {},
    scrollIntoView() { this.scrolled = true; },
    ...extra,
  };
  elements.set(id, item);
  return item;
};
const document = {
  body: { classList: classList() },
  getElementById(id) { return elements.get(id) || null; },
  createElement() { return { textContent: "", remove() {} }; },
  querySelector() { return null; },
};
const window = {
  __POW_TEST_NO_BOOTSTRAP__: true,
  location: { search: "?batch=nz-temporal-ra-workpack-001", pathname: "/apps/regions/nz/verification.html" },
  localStorage,
  sessionStorage: localStorage,
};
const context = vm.createContext({
  window, document, localStorage, sessionStorage: localStorage,
  URLSearchParams, Map, Set, Date, Number, String, Boolean, Object, Array, Math, JSON, RegExp, Intl, console, setTimeout, clearTimeout,
});
for (const file of ["occupancy-contract.js", "function-chain-contract.js", "verification-map.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, file), "utf8"), context, { filename: file });
}

const app = Object.create(window.NzVerificationMap.prototype);
app.backendUser = { _id: "user_1", initials: "AB" };
app.backend = { user: app.backendUser, configured: true, signedIn: true };
app.portalMode = "add";
app.myWorkItems = [
  { task: { task_id: "t1", status: "needs_review", name: "Assigned one" } },
  { task: { task_id: "t2", status: "changes_requested", name: "Assigned two" }, latestReview: { decision_note: "Batch note" } },
];
app.myNominationItems = [
  { task: { task_id: "n1", status: "needs_review", name: "St Mary's", locality: "Kohekohe" } },
  { task: { task_id: "n2", status: "changes_requested", name: "Old chapel", locality: "Waiuku" }, latestReview: { decision_note: "Please add the source." } },
];
element("modeNotice", { appendChild(child) { this.child = child; } });

// --- add mode: no My work list, the bounced nomination's alert stays -------
const sessionPanel = element("sessionPanel");
app.renderMyWorkPanel(sessionPanel);
if (sessionPanel.innerHTML.includes("My work") || sessionPanel.innerHTML.includes("Assigned one")) {
  throw new Error("Add or revise still lists the assigned work at the top of the sidebar.");
}
if (!sessionPanel.innerHTML.includes("Old chapel") || sessionPanel.innerHTML.includes("Assigned two")) {
  throw new Error(`Add or revise did not keep the bounced nomination's alert alone: ${sessionPanel.innerHTML.slice(0, 200)}`);
}
app.portalMode = "assigned";
app.renderMyWorkPanel(sessionPanel);
if (!sessionPanel.innerHTML.includes("My work") || !sessionPanel.innerHTML.includes("Assigned one")) {
  throw new Error("The assigned activity lost its My work list.");
}
app.portalMode = "add";

// --- the card's button opens and hides past submissions --------------------
const buttonHtml = app.pastSubmissionsButtonHtml();
if (!buttonHtml.includes("Revise a past submission (2)") || !buttonHtml.includes('id="pastSubmissionsButton"')) {
  throw new Error(`The add card did not offer past submissions: ${buttonHtml}`);
}
app.myNominationItems = [];
if (!app.pastSubmissionsButtonHtml().includes("No past submissions yet")) throw new Error("An empty history did not say so.");
app.myNominationItems = [{ task: { task_id: "n1", status: "needs_review", name: "St Mary's", locality: "Kohekohe" } }];

const nominations = element("nominationsPanel");
const button = element("pastSubmissionsButton");
app.renderNominationList();
if (nominations.classList.contains("open")) throw new Error("Past submissions opened on arrival.");
if (!nominations.innerHTML.includes("My past submissions (1)") || !nominations.innerHTML.includes("St Mary")) {
  throw new Error(`The past-submissions list did not render: ${nominations.innerHTML.slice(0, 200)}`);
}
app.setPastSubmissionsOpen(true);
if (!nominations.classList.contains("open") || button.attrs["aria-expanded"] !== "true" || !nominations.scrolled) {
  throw new Error("The card button did not open past submissions.");
}
app.setPastSubmissionsOpen(false);
if (nominations.classList.contains("open") || button.attrs["aria-expanded"] !== "false") throw new Error("Hide did not close past submissions.");
app.pastSubmissionsOpen = true;
app.setPortalMode = window.NzVerificationMap.prototype.setPortalMode;
app.formDirty = false;
app.clearFormDirty = () => {};
app.syncPortalChrome = () => {};
app.renderInitialDetail = () => {};
app.renderBackendPanel = () => {};
app.applyFilters = () => {};
app.renderMarkers = () => {};
app.renderTaskList = () => {};
app.updateStats = () => {};
app.setBasemap = () => {};
app.basemap = "streets";
app.map = { getZoom: () => 10 };
app.setPortalMode("assigned");
if (app.pastSubmissionsOpen !== false) throw new Error("Changing activity left past submissions open.");
app.portalMode = "add";

// --- the signed-in line names past submissions, not My work, in add -------
element("backendPanel");
app.tasks = [];
app.renderBackendPanel = window.NzVerificationMap.prototype.renderBackendPanel;
app.renderBackendPanel();
const backendPanel = elements.get("backendPanel");
if (!backendPanel.innerHTML.includes("1 past submission.") || backendPanel.innerHTML.includes("in My work")) {
  throw new Error(`The signed-in line still counts My work in add mode: ${backendPanel.innerHTML.slice(0, 300)}`);
}

// --- the points control moves by its grip and clamps to the map -----------
const mapRect = { left: 0, top: 0, right: 400, bottom: 300 };
let controlRect = { left: 10, top: 240, right: 210, bottom: 290 };
const listeners = {};
const grip = {
  addEventListener(type, fn) { listeners[type] = fn; },
  setPointerCapture() {}, releasePointerCapture() {},
};
const control = { style: {}, classList: classList(), getBoundingClientRect: () => controlRect };
const mapEvents = {};
app.map = { getContainer: () => ({ getBoundingClientRect: () => mapRect }), on(type, fn) { mapEvents[type] = fn; } };
app.makeControlMovable(control, grip);
listeners.pointerdown({ button: 0, clientX: 100, clientY: 260, pointerId: 1, preventDefault() {} });
listeners.pointermove({ clientX: 150, clientY: 60, pointerId: 1 });
if (control.style.transform !== "translate(50px, -200px)" || !control.classList.contains("dragging")) {
  throw new Error(`Dragging the grip did not move the control: ${control.style.transform}`);
}
listeners.pointerup({ pointerId: 1 });
if (control.style.transform !== "translate(50px, -200px)" || control.classList.contains("dragging") || !control.classList.contains("moved")) {
  throw new Error(`Releasing the grip lost the spot: ${control.style.transform}`);
}
if (localStorage.getItem("pow-points-control-offset") !== JSON.stringify({ x: 50, y: -200 })) {
  throw new Error("The spot was not remembered on this device.");
}
// dragged past the top edge: the release clamps it back inside the map
listeners.pointerdown({ button: 0, clientX: 100, clientY: 60, pointerId: 2, preventDefault() {} });
listeners.pointermove({ clientX: 100, clientY: -400, pointerId: 2 });
listeners.pointerup({ pointerId: 2 });
if (control.style.transform !== "translate(50px, -240px)") {
  throw new Error(`The control left the map: ${control.style.transform}`);
}
// a shorter map (rotation) re-clamps
mapRect.bottom = 200;
controlRect = { left: 10, top: 140, right: 210, bottom: 190 };
mapEvents.resize();
if (control.style.transform !== "translate(50px, -140px)") {
  throw new Error(`A resize did not bring the control back into view: ${control.style.transform}`);
}
listeners.dblclick();
if (control.style.transform !== "" || control.classList.contains("moved")) throw new Error("A double tap did not send the control home.");

console.log("phone-walkthrough-dom: ok");
