// watts's finding of 2026-09-08 (st brigid's, loburn), held by the actual
// portal class in a stub dom: a build year on the first period card must not
// make the denomination chain required; a chain with a named denomination
// still takes the period's start date by default; and "not sure" on the gap
// question records an answer and offers a way to leave the place as one
// period when there are no bounds to give
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
const sourceDate = { value: "2026-09" };
const elements = new Map();
const element = (id, extra = {}) => {
  const item = { id, value: "", hidden: true, textContent: "", classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, ...extra };
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
  PowRapidEntry: { secureSubmissionId: () => "11111111-1111-4111-8111-111111111111", localIsoDate: () => "2026-09-09" },
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
app.occupancyTaskPoint = () => ({ latitude: -43.29, longitude: 172.53 });
// the cards host and the chain block are present in the dom, so the form
// reads them back; nothing in the chain block was typed
element("guidedPeriodsCards", { querySelectorAll: () => [] });
element("guidedFunctionChain", { querySelector: () => null, querySelectorAll: () => [] });

const evidence = {
  action: "confirmed_active",
  assessmentConfidence: "0.9",
  sourceType: "denominational_directory",
  sourceTitle: "Parish history page",
  sourceUrl: "https://example.org/st-brigids-loburn",
  sourceDate: "2026-09",
  note: "The parish history gives 1875 as the build year.",
  uncertaintyNote: "",
  privacyFlag: "clear",
};

// 1. a build year alone: the chain stays untouched and the periods submit
const state = app.guidedPeriodsState("task_loburn");
Object.assign(state.segments[0], { startDate: "1875", startBasis: "founding_stated", endMode: "still_active", stillActiveAsof: "2026-09" });
assert.equal(app.guidedPeriodsError("task_loburn", evidence), "", "a build year on its own must not be refused");
assert.equal(app.guidedChainTouched("task_loburn"), false, "reading the cards must not mark the chain as touched");
assert.equal(state.chain.start.date, "", "the period's date must not be copied into the chain state");
const bare = app.guidedPeriodsSubmission("task_loburn", evidence);
assert.equal(bare.segments.length, 1);
assert.equal(bare.segments[0].start_date, "1875");
assert.equal(bare.chain, undefined, "no chain rides with a bare build year");

// 2. a named denomination with no chain date takes the period's start
state.chain.start.label = "Catholic";
assert.equal(app.guidedChainTouched("task_loburn"), true);
assert.equal(app.guidedPeriodsError("task_loburn", evidence), "", "a named denomination with the period's date must validate");
const named = app.guidedPeriodsSubmission("task_loburn", evidence);
assert.equal(named.chain.start.label, "Catholic");
assert.equal(named.chain.start.date.mode, "known");
assert.equal(named.chain.start.date.date, "1875", "the chain's start defaults to the first period's start");
assert.equal(state.chain.start.date, "", "the default is applied to the payload, not written back into the state");

// a denomination on its own chain date keeps that date
state.chain.start.dateMode = "known";
state.chain.start.date = "1880";
assert.equal(app.guidedPeriodsSubmission("task_loburn", evidence).chain.start.date.date, "1880");
state.chain.start.date = "";

// 3. not sure: the answer is recorded, the panel stays open across a repaint,
// and "leave as one period" settles it with a note that reaches the payload
state.chain.start.label = "";
const prompt = element("guidedGapPrompt");
const unsure = element("guidedGapUnsure");
app.updateGapPrompt("guided", state);
assert.equal(prompt.hidden, false, "a complete first period shows the gap question");
assert.equal(unsure.hidden, true);
let rerendered = 0;
const rerender = () => { rerendered += 1; app.updateGapPrompt("guided", state); };
app.answerGap("guided", state, "unsure", () => { throw new Error("not sure must not add a period"); }, rerender);
assert.equal(state.gapAnswer, "unsure", "not sure records an answer");
assert.equal(prompt.hidden, false);
assert.equal(unsure.hidden, false, "not sure opens the bounds panel");
app.updateGapPrompt("guided", state);
assert.equal(unsure.hidden, false, "the bounds panel survives a repaint");
app.answerGap("guided", state, "leave", () => { throw new Error("leave must not add a period"); }, rerender);
assert.equal(rerendered, 1);
assert.equal(state.segments.length, 1);
assert.match(state.gapNote, /^Gap not established/);
assert.equal(prompt.hidden, true, "leaving as one period settles the question");
assert.equal(unsure.hidden, true);
const left = app.guidedPeriodsSubmission("task_loburn", evidence);
assert.match(left.segments[0].uncertainty_note || "", /Gap not established/, "the one-period note rides on the submission");

// 4. the markup offers the way out beside the bounds
const html = app.periodsGapPromptHtml("guided");
assert.ok(html.includes('data-gap="leave">Leave as one period'), "the bounds panel offers Leave as one period");

console.log("chain default and gap unsure: ok");
