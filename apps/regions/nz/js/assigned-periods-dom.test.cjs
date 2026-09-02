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

for (const file of ["occupancy-contract.js", "verification-map.js"]) {
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

console.log("ALL ASSIGNED PERIOD STUB-DOM TESTS PASSED");
