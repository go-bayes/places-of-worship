import assert from "node:assert/strict";
import test from "node:test";

import { assignedTaskPeriodProblem } from "./assignedTaskPeriods.ts";

const task = { country_code: "NZ", assigned_to: "user_1" };
const draft = { observation_contract_version: "guided_observation_v1", action: "confirm_current_record" };

test("an ordinary assigned guided submission requires a period", () => {
  assert.match(assignedTaskPeriodProblem(task, draft, 0), /at least one period/);
  assert.equal(assignedTaskPeriodProblem(task, { ...draft, source_date_or_capture_date: "2024-05" }, 1), "");
});

test("a period uses the evidence date and refuses a missing anchor", () => {
  assert.match(assignedTaskPeriodProblem(task, draft, 1), /source or capture date/);
});

test("the ruled no-period exceptions are server checked", () => {
  assert.equal(assignedTaskPeriodProblem(task, { ...draft, action: "possible_duplicate" }, 0), "");
  assert.match(assignedTaskPeriodProblem(task, { ...draft, target_year_statuses: { "2018": "present" } }, 0), /require a reason/);
  assert.equal(assignedTaskPeriodProblem(task, { ...draft, target_year_statuses: { "2018": "present" }, target_year_entry_reason: "The congregation used changing hired halls." }, 0), "");
  assert.match(assignedTaskPeriodProblem(task, { ...draft, source_date_or_capture_date: "2024-05", target_year_statuses: { "2018": "present" } }, 1), /whether or not periods/);
});

test("saved cards cannot be bypassed by sending an empty set", () => {
  assert.match(assignedTaskPeriodProblem(task, { ...draft, action: "possible_duplicate", pending_occupancy_cards: [{}] }, 0), /saved period cards/);
});

test("unassigned and non-NZ tasks retain the general route", () => {
  assert.equal(assignedTaskPeriodProblem({ country_code: "NZ" }, draft, 0), "");
  assert.equal(assignedTaskPeriodProblem({ country_code: "VU", assigned_to: "user_1" }, draft, 0), "");
});
