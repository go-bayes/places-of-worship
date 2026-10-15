import assert from "node:assert/strict";
import test from "node:test";
import { world, draftContent } from "./testing/exportWorld.node-test.mjs";

// JB ruling 2026-10-15: a decided task (reviewed, pi_accepted, exported)
// moves only through reopenTask, with a reason, and the reopen is flagged
// on the task until a new pi acceptance clears it

const { claimTask, releaseTask, skipTask, unskipTask, markProvisionallyClosed, reopenTask } = await import("./tasks.ts");
const { submitEvidenceDraft, importSubmittedEvidenceDrafts } = await import("./evidence.ts");
const { createExportBatch } = await import("./exports.ts");
const { recordReviewDecision, getReviewSnapshot } = await import("./reviews.ts");
const { recordAcceptance } = await import("./acceptances.ts");

const DECIDED = ["reviewed", "pi_accepted", "exported"];
const NOT_DECIDED = ["open", "in_progress", "draft_saved", "skipped", "provisionally_closed", "needs_review", "unresolved_note", "changes_requested", "reopened"];
const REFUSAL = /Reopen it with a reason/;

async function scene(taskStatus, task = {}) {
  const w = world();
  const ra = await w.addUser("ra-subject", ["ra"]);
  const reviewer = await w.addUser("reviewer-subject", ["reviewer"]);
  const pi = await w.addUser("pi-subject", ["pi"]);
  const taskRow = await w.addTask({ task_id: "task_1", country_code: "VU", status: taskStatus, ...task });
  return { ...w, ra, reviewer, pi, task: taskRow };
}

const sideRoutes = [
  ["claimTask", claimTask, {}],
  ["releaseTask", releaseTask, { reason: "No longer needed." }],
  ["skipTask", skipTask, { reason: "Cannot tell." }],
  ["markProvisionallyClosed", markProvisionallyClosed, { reason: "Looks done." }],
];

for (const status of DECIDED) {
  test(`claim, release, skip and provisional close refuse a task that is ${status}`, async () => {
    for (const [label, route, extra] of sideRoutes) {
      const w = await scene(status);
      await assert.rejects(route._handler(w.as(w.ra), { taskId: "task_1", ...extra }), REFUSAL, `${label} as ra`);
      await assert.rejects(route._handler(w.as(w.reviewer), { taskId: "task_1", ...extra }), REFUSAL, `${label} as reviewer`);
      assert.equal(w.task.status, status, label);
      assert.equal(w.task.assigned_to, undefined, label);
      assert.equal(w.rows.task_events.length, 0, label);
    }
  });

  test(`unskipTask still refuses a task that is ${status}`, async () => {
    const w = await scene(status);
    await assert.rejects(unskipTask._handler(w.as(w.ra), { taskId: "task_1" }), /Only skipped tasks/);
    assert.equal(w.task.status, status);
  });
}

test("the side routes behave as before on a task that is not decided", async () => {
  for (const status of NOT_DECIDED) {
    const w = await scene(status);
    const claimed = await claimTask._handler(w.as(w.ra), { taskId: "task_1" });
    assert.equal(claimed.status, status === "open" || status === "reopened" ? "in_progress" : status, status);
    const skipped = await skipTask._handler(w.as(w.ra), { taskId: "task_1", reason: "Cannot tell." });
    assert.equal(skipped.status, "skipped");
    const released = await releaseTask._handler(w.as(w.ra), { taskId: "task_1" });
    assert.equal(released.status, "open");
    const closed = await markProvisionallyClosed._handler(w.as(w.ra), { taskId: "task_1" });
    assert.equal(closed.status, "provisionally_closed");
  }
});

for (const status of DECIDED) {
  test(`an ra can reopen a ${status} task with a reason, and the reopen is flagged`, async () => {
    const w = await scene(status, { assigned_to: undefined });
    const result = await reopenTask._handler(w.as(w.ra), { taskId: "task_1", reason: "  New evidence from the 1931 register.  " });
    assert.deepEqual(result, { task_id: "task_1", status: "reopened" });
    assert.equal(w.task.status, "reopened");
    const flag = w.task.reopened_after_decision;
    assert.equal(flag.from_status, status);
    assert.equal(flag.reopened_by, w.ra._id);
    assert.equal(flag.reason, "New evidence from the 1931 register.");
    assert.equal(typeof flag.reopened_at, "number");
    assert.equal(flag.reopened_at, w.task.updated_at);
    const event = w.rows.task_events.at(-1);
    assert.equal(event.event_type, "reopened");
    assert.equal(event.previous_status, status);
    assert.equal(event.reason, "New evidence from the 1931 register.");
  });

  test(`a ${status} task is not reopened with a reason shorter than eight characters`, async () => {
    for (const reason of ["", "short", "   seven  ", "1234567"]) {
      const w = await scene(status);
      await assert.rejects(reopenTask._handler(w.as(w.ra), { taskId: "task_1", reason }), /at least 8 characters/, JSON.stringify(reason));
      await assert.rejects(reopenTask._handler(w.as(w.reviewer), { taskId: "task_1", reason }), /at least 8 characters/);
      assert.equal(w.task.status, status);
      assert.equal(w.task.reopened_after_decision, undefined);
      assert.equal(w.rows.task_events.length, 0);
    }
    const w = await scene(status);
    await reopenTask._handler(w.as(w.ra), { taskId: "task_1", reason: "12345678" });
    assert.equal(w.task.status, "reopened");
  });

  test(`a reviewer can reopen a ${status} task and the flag names the reviewer`, async () => {
    const w = await scene(status);
    await reopenTask._handler(w.as(w.reviewer), { taskId: "task_1", reason: "Reviewer found a conflicting source." });
    assert.equal(w.task.reopened_after_decision.reopened_by, w.reviewer._id);
    assert.equal(w.task.reopened_after_decision.from_status, status);
  });
}

test("a reason over the limit is refused on a decided reopen", async () => {
  const w = await scene("reviewed");
  await assert.rejects(reopenTask._handler(w.as(w.ra), { taskId: "task_1", reason: "x".repeat(2_049) }));
  assert.equal(w.task.status, "reviewed");
});

test("a reopen from a status that is not decided sets no flag and keeps the existing reason rules", async () => {
  for (const status of ["needs_review", "unresolved_note", "provisionally_closed"]) {
    const w = await scene(status);
    await reopenTask._handler(w.as(w.ra), { taskId: "task_1", reason: "ok" });
    assert.equal(w.task.status, "reopened", status);
    assert.equal(w.task.reopened_after_decision, undefined, status);
  }
  const w = await scene("open");
  await assert.rejects(reopenTask._handler(w.as(w.ra), { taskId: "task_1", reason: "Trying." }), /not in a state a research assistant can reopen/);
  await reopenTask._handler(w.as(w.reviewer), { taskId: "task_1", reason: "ok" });
  assert.equal(w.task.reopened_after_decision, undefined);
});

test("the flag survives intermediate statuses and a new pi acceptance clears it", async () => {
  const w = await scene("pi_accepted");
  const draft = await w.addDraft({ evidence_draft_id: "task_1:draft_a", task_id: "task_1", created_by: w.ra._id, ...draftContent() });
  await reopenTask._handler(w.as(w.ra), { taskId: "task_1", reason: "New evidence on the opening date." });
  assert.equal(w.task.reopened_after_decision.from_status, "pi_accepted");

  await claimTask._handler(w.as(w.ra), { taskId: "task_1" });
  assert.equal(w.task.status, "in_progress");
  assert.ok(w.task.reopened_after_decision, "claiming does not clear the flag");

  await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: draft.evidence_draft_id });
  assert.equal(w.task.status, "needs_review");
  assert.ok(w.task.reopened_after_decision, "submission does not clear the flag");

  const snapshot = await getReviewSnapshot._handler(w.as(w.reviewer), { taskId: "task_1", evidenceDraftId: "task_1:draft_a" });
  await recordReviewDecision._handler(w.as(w.reviewer), {
    taskId: "task_1",
    decision: { evidence_draft_id: "task_1:draft_a", decision_status: "accepted_for_export", decision_note: "Checked the entry in full." },
    snapshotHash: snapshot.snapshot_hash,
  });
  assert.equal(w.task.status, "reviewed");
  assert.ok(w.task.reopened_after_decision, "a review decision does not clear the flag");

  await recordAcceptance._handler(w.as(w.pi), { taskId: "task_1", outcome: "accepted", note: "Ratifying the reviewer's decision." });
  assert.equal(w.task.status, "pi_accepted");
  assert.equal(w.task.reopened_after_decision, undefined);
});

test("a pi return does not clear the flag", async () => {
  const w = await scene("reviewed");
  await w.addDraft({ evidence_draft_id: "task_1:draft_a", task_id: "task_1", created_by: w.ra._id, ...draftContent() });
  await reopenTask._handler(w.as(w.ra), { taskId: "task_1", reason: "New evidence on the opening date." });
  await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a" });
  const snapshot = await getReviewSnapshot._handler(w.as(w.reviewer), { taskId: "task_1", evidenceDraftId: "task_1:draft_a" });
  await recordReviewDecision._handler(w.as(w.reviewer), {
    taskId: "task_1",
    decision: { evidence_draft_id: "task_1:draft_a", decision_status: "accepted_for_export", decision_note: "Checked the entry in full." },
    snapshotHash: snapshot.snapshot_hash,
  });
  await recordAcceptance._handler(w.as(w.pi), { taskId: "task_1", outcome: "returned", note: "Needs a second source." });
  assert.equal(w.task.status, "needs_review");
  assert.ok(w.task.reopened_after_decision);
});

// review finding on #197: a spreadsheet import must not hand a reopened task
// back to pi_accepted, which would skip the new acceptance the flag waits on
test("a spreadsheet import carrying a decided status does not move a reopened task or reach export", async () => {
  const w = await scene("in_progress");
  const admin = await w.addUser("admin-subject", ["admin"]);
  await w.addDraft({ evidence_draft_id: "task_1:draft_a", task_id: "task_1", created_by: w.ra._id, ...draftContent() });
  await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a" });
  const snapshot = await getReviewSnapshot._handler(w.as(w.reviewer), { taskId: "task_1", evidenceDraftId: "task_1:draft_a" });
  await recordReviewDecision._handler(w.as(w.reviewer), {
    taskId: "task_1",
    decision: { evidence_draft_id: "task_1:draft_a", decision_status: "accepted_for_export", decision_note: "Checked the entry in full." },
    snapshotHash: snapshot.snapshot_hash,
  });
  await recordAcceptance._handler(w.as(w.pi), { taskId: "task_1", outcome: "accepted", note: "Ratifying the reviewer's decision." });
  assert.equal(w.task.status, "pi_accepted");
  await reopenTask._handler(w.as(w.ra), { taskId: "task_1", reason: "New evidence on the opening date." });

  for (const importedStatus of ["pi_accepted", "reviewed", "exported"]) {
    const result = await importSubmittedEvidenceDrafts._handler(w.as(admin), {
      batch: { batch_id: "test-batch", country_code: "VU", source_kind: "spreadsheet", target_years: [2013, 2018, 2023] },
      tasks: [{ task_id: "task_1", batch_id: "test-batch", country_code: "VU", task_type: "verify_existing_site", priority: "medium", status: importedStatus, target_years: [2013, 2018, 2023], name: "Test place of worship", task_brief: "Check it.", geometry: { type: "Point", coordinates: [174.768, -41.282] } }],
      drafts: [],
    });
    assert.deepEqual(result.tasks, { inserted: 0, updated: 1 }, importedStatus);
    assert.equal(w.task.status, "reopened", importedStatus);
    assert.equal(w.task.reopened_after_decision.from_status, "pi_accepted", importedStatus);
  }
  await assert.rejects(createExportBatch._handler(w.as(admin), { countryCode: "VU", taskIds: ["task_1"] }));

  // an import without a decided status still applies, as before
  await importSubmittedEvidenceDrafts._handler(w.as(admin), {
    batch: { batch_id: "test-batch", country_code: "VU", source_kind: "spreadsheet", target_years: [2013, 2018, 2023] },
    tasks: [{ task_id: "task_1", batch_id: "test-batch", country_code: "VU", task_type: "verify_existing_site", priority: "medium", status: "needs_review", target_years: [2013, 2018, 2023], name: "Test place of worship", task_brief: "Check it." , geometry: { type: "Point", coordinates: [174.768, -41.282] } }],
    drafts: [],
  });
  assert.equal(w.task.status, "needs_review");
  assert.ok(w.task.reopened_after_decision);

  // a new task inserted with a decided status is left as before
  await importSubmittedEvidenceDrafts._handler(w.as(admin), {
    batch: { batch_id: "test-batch", country_code: "VU", source_kind: "spreadsheet", target_years: [2013, 2018, 2023] },
    tasks: [{ task_id: "task_new", batch_id: "test-batch", country_code: "VU", task_type: "verify_existing_site", priority: "medium", status: "reviewed", target_years: [2013, 2018, 2023], name: "New place", task_brief: "Check it.", geometry: { type: "Point", coordinates: [174.768, -41.282] } }],
    drafts: [],
  });
  assert.equal(w.row("tasks", "task_id", "task_new").status, "reviewed");
});
