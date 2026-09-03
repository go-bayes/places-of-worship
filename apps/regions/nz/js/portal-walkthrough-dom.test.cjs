// jb's portal walkthrough of 2026-09-03, held by the actual portal class in
// a stub dom: "move pin" takes the first search result when the coordinate
// boxes are empty and refuses once the location is confirmed; the period
// cards inside the rapid form keep their own key, anchor to the observation
// date, default to their own source, and are validated before the
// observation goes (a short direct-observation note is refused, never padded)
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
const elements = new Map();
const element = (id, extra = {}) => {
  const item = { id, value: "", hidden: true, textContent: "", classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, ...extra };
  elements.set(id, item);
  return item;
};
const bodyClasses = new Set();
const document = {
  body: { classList: { toggle(name, force) { if (force) bodyClasses.add(name); else bodyClasses.delete(name); }, contains(name) { return bodyClasses.has(name); } } },
  getElementById(id) { return elements.get(id) || null; },
};
const window = {
  __POW_TEST_NO_BOOTSTRAP__: true,
  location: { search: "", pathname: "/apps/regions/nz/verification.html" },
  localStorage,
  sessionStorage: localStorage,
  PowRapidEntry: {
    secureSubmissionId: () => "22222222-2222-4222-8222-222222222222",
    localIsoDate: () => "2026-09-03",
  },
};
const context = vm.createContext({
  window, document, localStorage, sessionStorage: localStorage,
  URLSearchParams, Map, Set, Date, Number, String, Boolean, Object, Array, Math, JSON, RegExp, Intl, console, setTimeout, clearTimeout,
});
for (const file of ["occupancy-contract.js", "function-chain-contract.js", "verification-map.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, file), "utf8"), context, { filename: file });
}

const app = Object.create(window.NzVerificationMap.prototype);
app.backendUser = { _id: "user_1" };
app.backend = { user: app.backendUser };
app.guidedPeriodsByTaskId = new Map();
app.pinMode = true;
app.map = {};

// --- move pin ---------------------------------------------------------------
const searchStatus = element("pinSearchStatus", { hidden: false });
element("pinLatInput", { value: "" });
element("pinLngInput", { value: "" });
element("pinSearchResults", { hidden: false });
const moves = [];
app.setPendingPin = (lat, lng) => moves.push([lat, lng]);
app.pinSearchRows = [];
app.applyTypedCoordinates();
if (moves.length !== 0 || !searchStatus.textContent.includes("search an address and choose a result")) {
  throw new Error(`Move pin with nothing to move on did not explain itself: ${searchStatus.textContent}`);
}
app.pinSearchRows = [{ lat: "-41.2865", lon: "174.7762", display_name: "Wellington, New Zealand" }];
app.applyTypedCoordinates();
if (moves.length !== 1 || moves[0][0] !== -41.2865 || moves[0][1] !== 174.7762 || !searchStatus.textContent.includes("Wellington")) {
  throw new Error(`Move pin did not take the first search result: ${JSON.stringify(moves)} / ${searchStatus.textContent}`);
}
elements.get("pinLatInput").value = "-37.5";
elements.get("pinLngInput").value = "175.1";
app.applyTypedCoordinates();
if (moves.length !== 2 || moves[1][0] !== -37.5) {
  throw new Error("Typed coordinates no longer move the pin.");
}
// a confirmed location refuses a move and says so (the real setPendingPin)
delete app.setPendingPin;
app.pinConfirmed = { latitude: -37.5, longitude: 175.1 };
app.setPendingPin(-36, 174);
if (!searchStatus.textContent.includes("already confirmed")) {
  throw new Error(`A move after confirmation was not refused with a message: ${searchStatus.textContent}`);
}

// --- entry focus -------------------------------------------------------------
app.setEntryOpen(true);
if (!bodyClasses.has("entry-open")) throw new Error("Opening an entry did not narrow the sidebar.");
app.setEntryOpen(false);
if (bodyClasses.has("entry-open")) throw new Error("Closing an entry did not restore the sidebar.");

// --- periods inside the rapid form ----------------------------------------------
element("pinObservedOn", { value: "2026-09-01" });
const key = "rapid-pin-periods";
const state = app.guidedPeriodsState(key);
if (state.sameSource !== false || state.referenceDate !== "2026-09-01") {
  throw new Error(`The rapid cards did not default to their own source anchored to the observation date: ${JSON.stringify({ sameSource: state.sameSource, referenceDate: state.referenceDate })}`);
}
if (!app.pinPeriodsBlockHtml(true).includes("Dates, denomination, and changes for this place") || !app.pinPeriodsBlockHtml(false).includes("optional now")) {
  throw new Error("The rapid form's periods block did not render for a revision and a nomination.");
}
const point = app.occupancyTaskPoint(key);
if (!point || point.latitude !== -37.5) throw new Error("The rapid cards do not take the confirmed pin as their point.");

const rapidValues = {
  currentStatus: "currently_used_for_worship",
  observationBasis: "named_public_source",
  observedOn: "2026-09-01",
  sourceTitle: "Parish directory 2026",
  sourceReference: "https://example.org/directory",
  directObservation: "",
  uncertaintyNote: "",
  privacyFlag: "clear",
};
const mapped = app.rapidValuesForPeriods(rapidValues);
if (mapped.sourceType !== "named_public_source" || mapped.sourceTitle !== "Parish directory 2026" || mapped.sourceUrl !== "https://example.org/directory") {
  throw new Error(`The rapid values did not map to the periods' parent shape: ${JSON.stringify(mapped)}`);
}
if (app.rapidPeriodsPlan(key, rapidValues) !== null) throw new Error("Untouched cards produced a plan.");

state.segments[0].startDate = "1886";
state.segments[0].startBasis = "founding_stated";
state.segments[0].endMode = "still_active";
state.segments[0].stillActiveAsof = "2026-09-01";
state.sameSource = true;
const refused = app.rapidPeriodsPlan(key, rapidValues);
if (!refused?.problem || !/source account|invent or pad/i.test(refused.problem)) {
  throw new Error(`A short direct-observation note was not refused for the periods' source account: ${JSON.stringify(refused)}`);
}
state.sameSource = false;
state.provenance = {
  confidence: "high",
  confidenceBasis: "The directory entry was read directly.",
  sourceBasis: "named_public_source",
  sourceTitle: "Parish directory 2026",
  sourceReference: "https://example.org/directory",
  sourceAccount: "The directory lists weekly services at this church.",
  uncertaintyNote: "",
  privacyFlag: "clear",
};
const plan = app.rapidPeriodsPlan(key, rapidValues);
if (!plan || plan.problem || plan.count !== 1 || plan.segments[0].sourceAccount !== "The directory lists weekly services at this church." || !plan.submissionId) {
  throw new Error(`A valid card with its own provenance did not compile to a plan: ${JSON.stringify(plan)}`);
}
if (!localStorage.getItem("powGuidedPeriods:NZ:user_1:rapid-pin-periods")) {
  throw new Error("The rapid cards were not persisted under their own key.");
}
app.clearGuidedPeriods(key);
if (localStorage.getItem("powGuidedPeriods:NZ:user_1:rapid-pin-periods") !== null) {
  throw new Error("Discarding did not clear the rapid cards.");
}

// --- the gone option turns the block into the record of when the place stood ---
const title = element("guidedPeriodsTitle", { textContent: "When was this place used for worship?" });
const summary = { textContent: "Dates, denomination, and changes (optional now)" };
const details = element("pinPeriodsDetails", { open: false, querySelector: () => summary });
const goneState = app.guidedPeriodsState(key);
goneState.segments[0].endMode = "still_active";
goneState.segments[0].stillActiveAsof = "2026-09-01";
app.syncGoneStatusPeriods(key, true);
if (!details.open || !title.textContent.startsWith("When did this place exist") || !summary.textContent.startsWith("When did this place exist")) {
  throw new Error(`Choosing the gone option did not open and rename the periods block: ${title.textContent} / ${summary.textContent}`);
}
if (goneState.segments[0].endMode !== "known" || goneState.segments[0].stillActiveAsof !== "") {
  throw new Error("Choosing the gone option left the first card still in use.");
}
app.syncGoneStatusPeriods(key, false);
if (title.textContent !== "When was this place used for worship?" || goneState.segments[0].endMode !== "known") {
  throw new Error("Choosing another option did not restore the heading while keeping the card's end.");
}
app.clearGuidedPeriods(key);

// --- cards saved for one place never leak to another (review p2-3) ---
app.reviseContext = { latitude: -37.1928, longitude: 174.6558 };
app.reconcileRapidPeriodsPlace(app.rapidPinPlaceKey());
const kohekohe = app.guidedPeriodsState(key);
kohekohe.segments[0].startDate = "1886";
kohekohe.segments[0].startBasis = "founding_stated";
app.persistGuidedPeriods(key);
app.reviseContext = null;
app.reconcileRapidPeriodsPlace(app.rapidPinPlaceKey());
if (app.guidedPeriodsState(key).segments[0].startDate !== "" || app.guidedPeriodsState(key).placeKey !== "new-place") {
  throw new Error("Cards saved for a revised place leaked into a new-place entry.");
}
app.guidedPeriodsState(key).segments[0].startDate = "1900";
app.persistGuidedPeriods(key);
app.reconcileRapidPeriodsPlace(app.rapidPinPlaceKey());
if (app.guidedPeriodsState(key).segments[0].startDate !== "1900") {
  throw new Error("Returning to the same place did not keep the draft cards.");
}

// --- a failed period write keeps the cards on the pane's draft, not the form's key ---
app.backend = { user: app.backendUser, submitOccupancies: async () => { throw new Error("backend down"); } };
app.taskHistoryByTaskId = new Map();
const failedPlan = { submissionId: "22222222-2222-4222-8222-222222222222", segments: [{ startDate: "1900" }], chain: undefined, count: 1, state: app.guidedPeriodsState(key) };
app.recordRapidPeriods(failedPlan, { task_id: "task_9", evidence_draft_id: "draft_9" }, key).then((outcome) => {
  if (!outcome.periodsError || !outcome.periodsError.includes("backend down")) {
    throw new Error(`A failed period write was not reported: ${JSON.stringify(outcome)}`);
  }
  if (!app.occupancyDraft || app.occupancyDraft.taskId !== "task_9" || app.occupancyDraft.segments[0].startDate !== "1900") {
    throw new Error("The failed cards were not moved to the pane's draft.");
  }
  if (localStorage.getItem("powGuidedPeriods:NZ:user_1:rapid-pin-periods") !== null || app.guidedPeriodsByTaskId.has(key)) {
    throw new Error("The failed cards stayed on the rapid form's key and could leak to the next place.");
  }
  console.log("portal walkthrough dom test passed");
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
