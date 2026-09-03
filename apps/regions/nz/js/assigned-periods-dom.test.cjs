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
const sourceDate = { value: "2024-05" };
const elements = new Map();
const element = (id, values = {}) => {
  const classNames = new Set();
  const item = {
    id,
    value: "",
    hidden: true,
    textContent: "",
    classList: {
      add(name) { classNames.add(name); },
      remove(name) { classNames.delete(name); },
      toggle(name, force) {
        if (force) classNames.add(name);
        else classNames.delete(name);
      },
      contains(name) { return classNames.has(name); },
    },
    ...values,
  };
  elements.set(id, item);
  return item;
};
const document = {
  getElementById(id) { return id === "sourceDateInput" ? sourceDate : elements.get(id) || null; },
};
const window = {
  __POW_TEST_NO_BOOTSTRAP__: true,
  location: { search: "", pathname: "/apps/regions/nz/verification.html" },
  localStorage,
  sessionStorage: localStorage,
  PowRapidEntry: {
    secureSubmissionId: () => "11111111-1111-4111-8111-111111111111",
    localIsoDate: () => "2024-05-31",
  },
};
const context = vm.createContext({
  window,
  document,
  localStorage,
  sessionStorage: localStorage,
  URLSearchParams,
  Map,
  Set,
  Date,
  Number,
  String,
  Boolean,
  Object,
  Array,
  Math,
  JSON,
  RegExp,
  Intl,
  console,
  setTimeout,
  clearTimeout,
});

for (const file of ["occupancy-contract.js", "function-chain-contract.js", "verification-map.js"]) {
  const source = fs.readFileSync(path.join(__dirname, file), "utf8");
  vm.runInContext(source, context, { filename: file });
}

const app = Object.create(window.NzVerificationMap.prototype);
app.backendUser = { _id: "user_1" };
app.backend = { user: app.backendUser };
app.guidedPeriodsByTaskId = new Map();
app.occupancyTaskPoint = () => ({ latitude: -41.282, longitude: 174.768 });

const state = app.guidedPeriodsState("task_1");
state.segments[0].startDate = "1905";
state.segments[0].startBasis = "founding_stated";
state.segments[0].endMode = "still_active";
state.segments[0].stillActiveAsof = "2024-05";
const html = app.guidedPeriodsHtml("task_1");
if (!html.includes("When was this place used for worship?") || !html.includes("data-field=\"startDate\"")) {
  throw new Error("The assigned-task period controls did not render.");
}
if (!html.includes("data-gap=\"unsure\">Not sure") || !html.includes("id=\"guidedPeriodsPreview\"")) {
  throw new Error("The assigned-task period block did not render the gap question and derived preview.");
}

const gapPrompt = element("guidedGapPrompt");
const gapUnsure = element("guidedGapUnsure");
const preview = element("guidedPeriodsPreview", { hidden: false });
app.updateGapPrompt("guided", state);
if (gapPrompt.hidden) {
  throw new Error("A complete first period did not reveal the gap question.");
}
app.updatePeriodsPreview("guided", state, {});
if (!preview.textContent.includes("2013 present") || !preview.textContent.includes("A reviewer confirms each year.")) {
  throw new Error("The actual form class did not render the derived census-year preview.");
}

for (const [id, value] of [
  ["guidedGapStopDate", ""],
  ["guidedGapStopEarliest", "2011"],
  ["guidedGapStopLatest", "2012"],
  ["guidedGapAgainDate", ""],
  ["guidedGapAgainBy", "2016"],
  ["guidedGapProblem", ""],
]) element(id, { value, hidden: false });
let rerendered = false;
const appendPeriod = overrides => app.guidedAppendPeriod("task_1", overrides);
const rerender = () => { rerendered = true; };
app.answerGap("guided", state, "unsure", appendPeriod, rerender);
if (gapUnsure.hidden) {
  throw new Error("Choosing Not sure did not reveal the bounded-gap controls.");
}
app.answerGap("guided", state, "apply", appendPeriod, rerender);
if (
  !rerendered
  || state.gapAnswer !== "unsure"
  || state.segments.length !== 2
  || state.segments[0].endMode !== "between"
  || state.segments[0].endNotEarlierThan !== "2011"
  || state.segments[0].endNotLaterThan !== "2012"
  || state.segments[1].startMode !== "by"
  || state.segments[1].startNotLaterThan !== "2016"
) {
  throw new Error("The Not sure interaction did not record two periods with the entered bounds.");
}
app.updatePeriodsPreview("guided", state, {});
if (!preview.textContent.includes("2013 uncertain") || !preview.textContent.includes("2018 present") || !preview.textContent.includes("2023 present")) {
  throw new Error("The bounded Not sure interaction did not render the exact worked derivation.");
}

state.segments = [app.occupancyBlankSegment(
  { referenceDate: "2024-05", referenceDateFromParent: true },
  { startDate: "1905", startBasis: "founding_stated" },
)];
state.gapAnswer = "";
state.gapNote = "";

const submission = app.guidedPeriodsSubmission("task_1", {
  assessmentConfidence: "0.9",
  sourceType: "denominational_directory",
  sourceTitle: "Demo directory 2024",
  sourceUrl: "https://example.org/directory",
  note: "The directory states that this church remained in worship use.",
  uncertaintyNote: "",
  privacyFlag: "clear",
});
if (submission.segments.length !== 1 || submission.segments[0].start_date !== "1905" || submission.segments[0].still_active_asof !== "2024-05") {
  throw new Error("Editing the rendered period card did not compile to the atomic submission payload.");
}
if (!localStorage.getItem("powGuidedPeriods:NZ:user_1:task_1")) {
  throw new Error("The edited cards and retry id were not persisted for this user and task.");
}

localStorage.setItem("powGuidedPeriods:NZ:user_2:task_2", "other user");
app.clearAllGuidedPeriods("user_1");
if (localStorage.getItem("powGuidedPeriods:NZ:user_1:task_1") !== null || localStorage.getItem("powGuidedPeriods:NZ:user_2:task_2") !== "other user") {
  throw new Error("Sign-out storage cleanup crossed the user namespace.");
}

// pr-f: the function chain renders under the cards, a change is added
// through the actual click handler, a complete desacralisation and
// intermittent-use change write the cards (the ra never types the date
// twice), and the preview names the denomination per year (kohekohe)
const chainState = app.guidedPeriodsState("task_chain");
chainState.segments = [app.occupancyBlankSegment(
  { referenceDate: "2024-05", referenceDateFromParent: true },
  { startDate: "1888", startAround: true, startBasis: "founding_stated", stillActiveAsof: "2024-05" },
)];
chainState.referenceDate = "2024-05";
const chainHtml = app.guidedPeriodsHtml("task_chain");
if (!chainHtml.includes("What was it, and did that change?") || !chainHtml.includes("data-chain-action=\"add\"") || !chainHtml.includes("data-field=\"useFrequency\"")) {
  throw new Error("The function chain block or the use-frequency control did not render.");
}
const chainSelect = element("guidedChainAddSelect", { value: "shared_use_began" });
const clickAdd = { target: { closest: (selector) => (selector === "button[data-chain-action]" ? { dataset: { chainAction: "add" } } : null) } };
if (!app.handleFunctionChainClick(clickAdd, "guided", chainState, "2024-05") || chainState.changes !== undefined) {
  throw new Error("Adding a change did not go through the chain click handler.");
}
if (chainState.chain.changes.length !== 1 || chainState.chain.changes[0].change !== "shared_use_began") {
  throw new Error("The added change did not take the kind chosen in the Add a change control.");
}
chainState.chain.start.label = "Presbyterian";
chainState.chain.start.dateMode = "known";
chainState.chain.start.date = "1888";
chainState.chain.start.around = true;
Object.assign(chainState.chain.changes[0], { label: "Methodist", dateMode: "between", notEarlierThan: "1920", notLaterThan: "1929" });
chainSelect.value = "shared_use_ended";
app.handleFunctionChainClick(clickAdd, "guided", chainState, "2024-05");
Object.assign(chainState.chain.changes[1], { dateMode: "by", notLaterThan: "1930" });
chainSelect.value = "desacralised";
app.handleFunctionChainClick(clickAdd, "guided", chainState, "2024-05");
Object.assign(chainState.chain.changes[2], { dateMode: "known", date: "2014" });
chainSelect.value = "use_became_intermittent";
app.handleFunctionChainClick(clickAdd, "guided", chainState, "2024-05");
Object.assign(chainState.chain.changes[3], { dateMode: "known", date: "2014", frequency: "annual" });
const applied = app.applyChainToCards(chainState, "2024-05");
if (!applied || chainState.segments.length !== 2 || chainState.segments[0].endReason !== "desacralised" || chainState.segments[0].endDate !== "2014" || chainState.segments[1].useFrequency !== "annual" || chainState.segments[1].endMode !== "still_active") {
  throw new Error(`The chain did not write the period it closes and the period it splits: ${applied}`);
}
const chainPreview = element("guidedPeriodsPreview", { hidden: false });
app.updatePeriodsPreview("guided", chainState, {});
if (!chainPreview.textContent.includes("2013 present") || !chainPreview.textContent.includes("2018 uncertain") || !chainPreview.textContent.includes("2023 uncertain")
  || !chainPreview.textContent.includes("Denomination: 2013 Presbyterian (inside the recorded state); 2018 not assessed; 2023 not assessed.")) {
  throw new Error(`The preview did not name the kohekohe states and denominations: ${chainPreview.textContent}`);
}
const chainSubmission = app.guidedPeriodsSubmission("task_chain", {
  assessmentConfidence: "0.9",
  sourceType: "denominational_directory",
  sourceTitle: "Kohekohe parish history",
  sourceUrl: "https://example.org/kohekohe",
  note: "The history dates the church, the shared decade, and the 2014 deconsecration.",
  uncertaintyNote: "",
  privacyFlag: "clear",
});
if (!chainSubmission.chain || chainSubmission.chain.changes.length !== 4 || chainSubmission.chain.changes[3].use_frequency !== "annual" || chainSubmission.segments[1].use_frequency !== "annual" || chainSubmission.segments[0].end_reason !== "desacralised") {
  throw new Error("The chain and the frequency did not compile into the atomic submission payload.");
}
const chainSnapshot = app.guidedPeriodsSnapshot("task_chain");
if (!chainSnapshot[0]._chain || chainSnapshot[0]._chain.changes.length !== 4) {
  throw new Error("The chain was not saved with the draft's pending cards.");
}
const restored = app.adoptGuidedPeriods("task_chain_restore", chainSnapshot, null, "");
if (restored.chain.start.label !== "Presbyterian") {
  throw new Error("The chain did not come back with the restored cards.");
}

console.log("ALL ASSIGNED PERIOD STUB-DOM TESTS PASSED");
