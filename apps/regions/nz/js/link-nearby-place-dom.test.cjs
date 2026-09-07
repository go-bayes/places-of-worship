// guy's field request of 2026-09-07, held by the actual portal class in a
// stub dom: when the pin-drop proximity card lists an existing record, a
// contributor can link it as probably the same place and keep the new pin;
// the form shows the link, the link can be removed, both submit payloads
// carry it, and the detail panel shows a task's links each way
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
// buttons are read back out of the rendered html so their click handlers
// can be driven: class + data-task-id pairs
const buttonsIn = (html, className) => {
  const buttons = [];
  const pattern = new RegExp(`class="[^"]*\\b${className}\\b[^"]*" data-task-id="([^"]+)"`, "g");
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const button = { dataset: { taskId: match[1] }, handlers: [], addEventListener(type, fn) { if (type === "click") this.handlers.push(fn); }, click() { this.handlers.forEach(fn => fn()); } };
    buttons.push(button);
  }
  return buttons;
};
const elements = new Map();
const element = (id, extra = {}) => {
  const item = {
    id, value: "", hidden: true, textContent: "", innerHTML: "", attrs: {},
    classList: classList(),
    setAttribute(name, value) { this.attrs[name] = value; },
    // the same rendered html yields the same button objects, so handlers
    // the class attaches are the ones the test clicks
    buttonCache: new Map(),
    querySelectorAll(selector) {
      const key = `${selector}\n${this.innerHTML}`;
      if (!this.buttonCache.has(key)) this.buttonCache.set(key, buttonsIn(this.innerHTML, selector.replace(/^\./, "")));
      return this.buttonCache.get(key);
    },
    querySelector() { return null; },
    addEventListener() {},
    focus() {},
    scrollIntoView() {},
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

(async () => {
const app = Object.create(window.NzVerificationMap.prototype);
app.pinLinkedRefs = [];
app.pinNearbyCount = 2;
app.paneSnap = () => {};
app.revealPinHost = () => {};
app.keepRapidPinOnDevice = () => { app.keptOnDevice = (app.keptOnDevice || 0) + 1; };
app.markFormDirty = () => { app.dirtied = true; };
app.exitPinMode = () => { app.exited = true; };
app.selectTaskById = (taskId) => { app.opened = taskId; };
const proximity = element("pinProximityCard");
const formCard = element("pinFormCard");
const linkedCard = element("pinLinkedCard");
element("pinStatus");
element("pinNameInput");

const rows = [
  { taskId: "vu-survey-12", name: "Presbyterian Church Fresh Wota", distance: 38, status: "open", siteId: "" },
  { taskId: "vu-survey-40", name: "AOG Tagabe", distance: 120, status: "needs review", siteId: "site-40" },
];

// --- the proximity card offers open, link, and continue -------------------
app.showPinProximity(rows);
if (proximity.hidden) throw new Error("The proximity card did not show.");
if (!proximity.innerHTML.includes("link it and keep my pin") || !proximity.innerHTML.includes("open that task instead")) {
  throw new Error(`The proximity card lost a choice: ${proximity.innerHTML.slice(0, 300)}`);
}
const linkButtons = proximity.querySelectorAll(".pin-nearby-link");
if (linkButtons.length !== 2) throw new Error(`Expected a link button per row, got ${linkButtons.length}.`);

// --- linking keeps the pin: the form opens with the link shown ------------
linkButtons[0].click();
if (app.exited || app.opened) throw new Error("Linking left the pin flow or opened the other task.");
if (!proximity.hidden || formCard.hidden) throw new Error("Linking did not move on to the form.");
if (app.pinLinkedRefs.length !== 1 || app.pinLinkedRefs[0].task_id !== "vu-survey-12" || app.pinLinkedRefs[0].distance_m !== 38) {
  throw new Error(`The link was not recorded: ${JSON.stringify(app.pinLinkedRefs)}`);
}
if (!app.keptOnDevice || !app.dirtied) throw new Error("The link was not kept on the device or marked dirty.");
if (linkedCard.hidden || !linkedCard.innerHTML.includes("Presbyterian Church Fresh Wota") || !linkedCard.innerHTML.includes("38 m from your pin")) {
  throw new Error(`The form did not show the link: ${linkedCard.innerHTML.slice(0, 300)}`);
}
if (!linkedCard.innerHTML.includes("stays separate")) throw new Error("The link card did not say the entry stays separate.");

// --- the payload both submit paths send --------------------------------
const payload = app.probableSameAsPayload();
if (JSON.stringify(payload) !== JSON.stringify([{ task_id: "vu-survey-12", name: "Presbyterian Church Fresh Wota", distance_m: 38 }])) {
  throw new Error(`Unexpected payload: ${JSON.stringify(payload)}`);
}

// --- a second link and its site id; the same task is never linked twice --
app.linkNearbyTask(rows[1]);
app.linkNearbyTask(rows[1]);
if (app.pinLinkedRefs.length !== 2 || app.pinLinkedRefs[1].site_id !== "site-40") {
  throw new Error(`Second link wrong: ${JSON.stringify(app.pinLinkedRefs)}`);
}

// --- unlink removes the row, and an empty set hides the card and payload --
app.renderPinLinkedCard();
const removeButtons = linkedCard.querySelectorAll(".pin-linked-remove");
if (removeButtons.length !== 2) throw new Error(`Expected two unlink buttons, got ${removeButtons.length}.`);
removeButtons[0].click();
if (app.pinLinkedRefs.length !== 1 || app.pinLinkedRefs[0].task_id !== "vu-survey-40") throw new Error("Unlink removed the wrong row.");
linkedCard.querySelectorAll(".pin-linked-remove")[0].click();
if (app.pinLinkedRefs.length !== 0 || !linkedCard.hidden || app.probableSameAsPayload() !== undefined) {
  throw new Error("Unlinking everything did not clear the card and payload.");
}

// --- open still hands over to the other task and drops the pin ----------
app.showPinProximity(rows);
proximity.querySelectorAll(".pin-nearby-open")[1].click();
if (!app.exited || app.opened !== "vu-survey-40") throw new Error("Open did not leave the pin flow for the other task.");

// --- the detail panel shows a task's links each way ---------------------
const linksHtml = app.taskLinksHtml({
  nearby_site_refs: [
    { task_id: "vu-candidate-abc", name: "Fresh Wota church (field)", distance_m: 38, relation: "probable_same_place" },
    { task_id: "vu-survey-99", name: "Plain proximity ref" },
  ],
});
if (!linksHtml.includes("Probably the same place as") || !linksHtml.includes("Fresh Wota church (field)") || linksHtml.includes("Plain proximity ref")) {
  throw new Error(`The detail links block is wrong: ${linksHtml}`);
}
if (app.taskLinksHtml({ nearby_site_refs: [] }) !== "" || app.taskLinksHtml({}) !== "") throw new Error("A task without links still rendered the block.");

// --- move the pin from a task (jb 2026-09-07): the revise flow opens on
// the task's point and the revision names the task ------------------------
app.backend = { configured: true, signedIn: true };
app.reviseContext = null;
const taskProps = { task_id: "vu-survey-12", name: "Presbyterian Church Fresh Wota", batch_id: "vu-port-vila-survey-2010-001", master_site_id: "", osm_id: "" };
const point = { latitude: -17.74, longitude: 168.3 };
if (!app.movePinHtml(taskProps, point).includes("move-pin-button")) throw new Error("A task's detail did not offer Move the pin.");
if (app.movePinHtml({ ...taskProps, batch_id: "ra-issues-vu" }, point) !== "") throw new Error("A revision task offered Move the pin on itself.");
app.backend = { configured: true, signedIn: false };
if (app.movePinHtml(taskProps, point) !== "") throw new Error("Signed out still offered Move the pin.");
app.backend = { configured: true, signedIn: true };
let reviseContext = null;
app.enterReviseMode = (context) => { reviseContext = context; };
element("pinIssueType");
app.movePinForTask(taskProps, point);
if (!reviseContext || reviseContext.taskId !== "vu-survey-12" || reviseContext.latitude !== -17.74 || reviseContext.longitude !== 168.3) {
  throw new Error(`Move the pin did not open the revise flow on the task's point: ${JSON.stringify(reviseContext)}`);
}
if (elements.get("pinIssueType").value !== "geometry_check") throw new Error("Move the pin did not preselect the wrong-location issue type.");

let issueArgs = null;
app.backend.createIssueTask = async (args) => { issueArgs = args; return { task_id: "vu-issue-1", deduped: false }; };
app.pinConfirmed = { latitude: -17.7401, longitude: 168.3201, locationMode: "building_identified", zoom: 18 };
const revision = await app.createRevisionTask({ ...reviseContext, siteId: undefined, osmId: undefined });
if (revision.task_id !== "vu-issue-1" || issueArgs.sourceTaskId !== "vu-survey-12" || issueArgs.originalLatitude !== -17.74 || issueArgs.latitude !== -17.7401) {
  throw new Error(`The revision did not name the source task with both points: ${JSON.stringify(issueArgs)}`);
}
if (!issueArgs.note.includes("moved from the record's point")) throw new Error("The revision note did not say the pin moved.");

console.log("link-nearby-place dom test passed");
})().catch(error => { console.error(error); process.exit(1); });
