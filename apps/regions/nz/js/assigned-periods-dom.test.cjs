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
const document = {
  getElementById(id) { return id === "sourceDateInput" ? sourceDate : null; },
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
