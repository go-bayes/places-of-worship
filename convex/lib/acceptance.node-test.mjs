import assert from "node:assert/strict";
import test from "node:test";
import {
  acceptanceRefusal,
  eventTypeForAcceptance,
  exportRefusalForTask,
  isSelfDecided,
  taskStatusForAcceptance,
} from "./acceptance.ts";

const decision = { decision_status: "accepted_for_export", reviewer_user_id: "u_reviewer" };
const base = { userRoles: ["pi", "reviewer"], userId: "u_pi", taskStatus: "reviewed", decision, note: "Evidence checked against the register." };

test("a pi with a reviewed task and a current accepted decision may proceed", () => {
  assert.equal(acceptanceRefusal(base), null);
});

test("only the pi role accepts; admin alone does not", () => {
  assert.match(acceptanceRefusal({ ...base, userRoles: ["admin", "reviewer"] }), /principal investigator/);
});

test("only a reviewed task can be accepted or returned", () => {
  for (const status of ["needs_review", "pi_accepted", "exported", "changes_requested"]) {
    assert.match(acceptanceRefusal({ ...base, taskStatus: status }), /status reviewed/);
  }
});

test("a task without a current accepted-for-export decision is refused", () => {
  assert.match(acceptanceRefusal({ ...base, decision: null }), /no current accepted-for-export/);
  assert.match(acceptanceRefusal({ ...base, decision: { ...decision, decision_status: "deferred" } }), /no current accepted-for-export/);
});

test("a pi never accepts their own submission", () => {
  assert.match(acceptanceRefusal({ ...base, draftAuthorId: "u_pi" }), /You submitted this evidence/);
  assert.equal(acceptanceRefusal({ ...base, draftAuthorId: "u_ra" }), null);
});

test("the note is required", () => {
  assert.match(acceptanceRefusal({ ...base, note: "ok" }), /short note/);
  assert.match(acceptanceRefusal({ ...base, note: undefined }), /short note/);
});

test("r-p1: ratifying one's own decision is allowed and flagged", () => {
  const own = { ...decision, reviewer_user_id: "u_pi" };
  assert.equal(acceptanceRefusal({ ...base, decision: own }), null);
  assert.equal(isSelfDecided({ decision: own, userId: "u_pi" }), true);
  assert.equal(isSelfDecided({ decision, userId: "u_pi" }), false);
  assert.equal(isSelfDecided({ decision: null, userId: "u_pi" }), false);
});

test("r-p5: accepted goes to pi_accepted, returned goes back to needs_review", () => {
  assert.equal(taskStatusForAcceptance("accepted"), "pi_accepted");
  assert.equal(taskStatusForAcceptance("returned"), "needs_review");
  assert.equal(eventTypeForAcceptance("accepted"), "pi_accepted");
  assert.equal(eventTypeForAcceptance("returned"), "pi_returned");
});

test("the export takes pi-accepted tasks only", () => {
  assert.equal(exportRefusalForTask("t1", "pi_accepted"), null);
  assert.match(exportRefusalForTask("t1", "reviewed"), /only tasks a principal investigator has accepted/);
  assert.match(exportRefusalForTask("t1", undefined), /not found/);
});
