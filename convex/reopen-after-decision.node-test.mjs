import assert from "node:assert/strict";
import test from "node:test";
import { ConvexError } from "convex/values";
import { world, draftContent } from "./testing/exportWorld.node-test.mjs";

// JB ruling 2026-10-15: a decided task (reviewed, pi_accepted, exported)
// moves only through reopenTask, with a reason, and the reopen is flagged
// on the task until a new pi acceptance clears it

const { claimTask, releaseTask, skipTask, unskipTask, markProvisionallyClosed, reopenTask } = await import("./tasks.ts");
const { submitEvidenceDraft, importSubmittedEvidenceDrafts } = await import("./evidence.ts");
const { createExportBatch } = await import("./exports.ts");
const { intakeRateLimiter } = await import("./lib/rateLimits.ts");
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
      batch: { batch_id: "test-batch", country_code: "VU", source_kind: "spreadsheet_submission", target_years: [2013, 2018, 2023] },
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
    batch: { batch_id: "test-batch", country_code: "VU", source_kind: "spreadsheet_submission", target_years: [2013, 2018, 2023] },
    tasks: [{ task_id: "task_1", batch_id: "test-batch", country_code: "VU", task_type: "verify_existing_site", priority: "medium", status: "needs_review", target_years: [2013, 2018, 2023], name: "Test place of worship", task_brief: "Check it." , geometry: { type: "Point", coordinates: [174.768, -41.282] } }],
    drafts: [],
  });
  assert.equal(w.task.status, "needs_review");
  assert.ok(w.task.reopened_after_decision);

  // a new task inserted with a decided status is left as before
  await importSubmittedEvidenceDrafts._handler(w.as(admin), {
    batch: { batch_id: "test-batch", country_code: "VU", source_kind: "spreadsheet_submission", target_years: [2013, 2018, 2023] },
    tasks: [{ task_id: "task_new", batch_id: "test-batch", country_code: "VU", task_type: "verify_existing_site", priority: "medium", status: "reviewed", target_years: [2013, 2018, 2023], name: "New place", task_brief: "Check it.", geometry: { type: "Point", coordinates: [174.768, -41.282] } }],
    drafts: [],
  });
  assert.equal(w.row("tasks", "task_id", "task_new").status, "reviewed");
});

// reserved security review, 2026-10-15: the first reopen's record stands
test("a later reopen keeps the flag of the first reopen, and its reason", async () => {
  const w = await scene("pi_accepted");
  await reopenTask._handler(w.as(w.ra), { taskId: "task_1", reason: "Reason A: new register." });
  const first = { ...w.task.reopened_after_decision };
  assert.equal(first.from_status, "pi_accepted");
  await w.db.patch(w.task._id, { status: "reviewed" });
  await reopenTask._handler(w.as(w.reviewer), { taskId: "task_1", reason: "Reason B: second look." });
  assert.equal(w.task.status, "reopened");
  assert.deepEqual({ ...w.task.reopened_after_decision }, first);
  assert.equal(w.task.reopened_after_decision.reason, "Reason A: new register.");
  const reopens = w.rows.task_events.filter((event) => event.event_type === "reopened");
  assert.equal(reopens.length, 2);
  assert.equal(reopens[1].reason, "Reason B: second look.");
});

test("an ra's reopens from a decided status are charged to the per-user limit; review roles and other reopens are not", async () => {
  const original = intakeRateLimiter.limit;
  const charged = [];
  // like the real limiter, the stub throws only when asked to; otherwise an
  // over-limit call returns ok: false, which the handler would ignore
  intakeRateLimiter.limit = async (_ctx, name, options) => {
    charged.push([name, options?.key]);
    const over = charged.filter(([n]) => n === "decidedReopenPerUser").length > 2;
    if (over && options?.throws === true) throw new ConvexError({ kind: "RateLimited", name, retryAfter: 1000 });
    return { ok: !over, retryAfter: over ? 1000 : 0 };
  };
  try {
    // an ra, decided: charged under the user's key
    const w = await scene("reviewed");
    await reopenTask._handler(w.as(w.ra), { taskId: "task_1", reason: "New evidence on the date." });
    assert.deepEqual(charged, [["decidedReopenPerUser", w.ra._id], ["decidedReopenGlobal", undefined]], "per-user first, then the global cap");
    // reviewers and non-decided reopens are not charged
    for (const [status, actor] of [["reviewed", "reviewer"], ["needs_review", "ra"]]) {
      const x = await scene(status);
      await reopenTask._handler(x.as(x[actor]), { taskId: "task_1", reason: "Another look at it." });
    }
    assert.equal(charged.length, 2);
    // a refusal by the limiter leaves the task decided and writes nothing
    await reopenTask._handler(w.as(w.ra), { taskId: "task_x", reason: "Unused." }).catch(() => {});
    const a = await scene("pi_accepted");
    const b = await scene("exported");
    await reopenTask._handler(a.as(a.ra), { taskId: "task_1", reason: "Second charge ok." });
    await assert.rejects(reopenTask._handler(b.as(b.ra), { taskId: "task_1", reason: "Third charge refused." }), /reopened 20 decided tasks in the last hour\. Try again later, or ask a reviewer/);
    assert.equal(b.task.status, "exported");
    assert.equal(b.task.reopened_after_decision, undefined);
    assert.equal(b.rows.task_events.length, 0);
    // a short reason is refused before the limiter is charged
    const before = charged.length;
    const c = await scene("reviewed");
    await assert.rejects(reopenTask._handler(c.as(c.ra), { taskId: "task_1", reason: "short" }), /at least 8/);
    assert.equal(charged.length, before);
  } finally {
    intakeRateLimiter.limit = original;
  }
});

test("the global cap refuses an ra's decided reopen after the per-user limit passes, and is not charged to review roles", async () => {
  const original = intakeRateLimiter.limit;
  const charged = [];
  intakeRateLimiter.limit = async (_ctx, name, options) => {
    charged.push(name);
    const over = name === "decidedReopenGlobal";
    if (over && options?.throws === true) throw new ConvexError({ kind: "RateLimited", name, retryAfter: 1000 });
    return { ok: !over, retryAfter: over ? 1000 : 0 };
  };
  try {
    const w = await scene("pi_accepted");
    await assert.rejects(reopenTask._handler(w.as(w.ra), { taskId: "task_1", reason: "Everyone is reopening." }), /Too many reopens of decided tasks across the project in the last hour\. Try again later, or ask a reviewer/);
    assert.deepEqual(charged, ["decidedReopenPerUser", "decidedReopenGlobal"]);
    assert.equal(w.task.status, "pi_accepted");
    assert.equal(w.task.reopened_after_decision, undefined);
    assert.equal(w.rows.task_events.length, 0);
    // a reviewer is not held by the cap
    await reopenTask._handler(w.as(w.reviewer), { taskId: "task_1", reason: "Reviewer reopening anyway." });
    assert.equal(w.task.status, "reopened");
    assert.deepEqual(charged, ["decidedReopenPerUser", "decidedReopenGlobal"]);
  } finally {
    intakeRateLimiter.limit = original;
  }
});

// jb, 2026-10-15: a reviewer, curator, admin or the PI may undo a reopen
// while nothing has been written to the task since
const { revertReopen, addTaskNote } = await import("./tasks.ts");
const { saveEvidenceDraft } = await import("./evidence.ts");

async function reopened(status, over = {}) {
  const w = await scene(status, over);
  w.admin = await w.addUser("admin-subject", ["admin"]);
  w.curator = await w.addUser("curator-subject", ["curator"]);
  await reopenTask._handler(w.as(w.ra), { taskId: "task_1", reason: "New evidence on the date." });
  return w;
}

for (const status of DECIDED) {
  test(`a reviewer reverts a reopen of a ${status} task: the status returns, the flag clears, the event is recorded`, async () => {
    const w = await reopened(status);
    const before = JSON.stringify({ a: w.rows.task_acceptances, d: w.rows.review_decisions, b: w.rows.export_batches });
    const result = await revertReopen._handler(w.as(w.reviewer), { taskId: "task_1", reason: "  Opened in error, no new evidence.  " });
    assert.deepEqual(result, { task_id: "task_1", status });
    assert.equal(w.task.status, status);
    assert.equal(w.task.reopened_after_decision, undefined);
    const event = w.rows.task_events.at(-1);
    assert.equal(event.event_type, "reopen_reverted");
    assert.equal(event.previous_status, "reopened");
    assert.equal(event.new_status, status);
    assert.equal(event.reason, "Opened in error, no new evidence.");
    assert.equal(event.actor_user_id, w.reviewer._id);
    assert.equal(JSON.stringify({ a: w.rows.task_acceptances, d: w.rows.review_decisions, b: w.rows.export_batches }), before);
    // the side routes refuse it again, as before the reopen
    await assert.rejects(claimTask._handler(w.as(w.ra), { taskId: "task_1" }), REFUSAL);
  });
}

test("a curator, an admin and the PI may revert; an ra may not", async () => {
  for (const actor of ["curator", "admin", "pi"]) {
    const w = await reopened("reviewed");
    await revertReopen._handler(w.as(w[actor]), { taskId: "task_1", reason: "Opened in error, no new evidence." });
    assert.equal(w.task.status, "reviewed", actor);
  }
  const w = await reopened("reviewed");
  await assert.rejects(revertReopen._handler(w.as(w.ra), { taskId: "task_1", reason: "Opened in error, no new evidence." }), /Project role does not permit/);
  assert.equal(w.task.status, "reopened");
});

test("a revert is refused unless the task is reopened with a flag, and for a short reason", async () => {
  for (const status of ["reviewed", "pi_accepted", "exported", "needs_review", "open"]) {
    const w = await scene(status);
    await assert.rejects(revertReopen._handler(w.as(w.reviewer), { taskId: "task_1", reason: "Opened in error, no new evidence." }), /reopened from a decision/, status);
  }
  // reopened from a status that is not decided: no flag
  const x = await scene("needs_review");
  await reopenTask._handler(x.as(x.ra), { taskId: "task_1", reason: "ok" });
  await assert.rejects(revertReopen._handler(x.as(x.reviewer), { taskId: "task_1", reason: "Opened in error, no new evidence." }), /reopened from a decision/);
  const w = await reopened("pi_accepted");
  for (const reason of ["", "short", "   1234567  "]) {
    await assert.rejects(revertReopen._handler(w.as(w.reviewer), { taskId: "task_1", reason }), /at least 8 characters/, JSON.stringify(reason));
  }
  await assert.rejects(revertReopen._handler(w.as(w.reviewer), { taskId: "task_1", reason: "x".repeat(2_049) }));
  assert.equal(w.task.status, "reopened");
  assert.ok(w.task.reopened_after_decision);
});

test("a revert is refused after any later write: a claim, a note, a draft save, or a second reopen", async () => {
  const cases = {
    claim: (w) => claimTask._handler(w.as(w.ra), { taskId: "task_1" }),
    note: (w) => addTaskNote._handler(w.as(w.ra), { taskId: "task_1", note: "Looking into it." }),
    draft: async (w) => {
      await saveEvidenceDraft._handler(w.as(w.ra), { taskId: "task_1", evidenceDraftId: "task_1:draft_z", draft: draftContent() });
    },
    // a row written without a task event (a row written by a route that logs none)
    silentDraft: (w) => w.addDraft({ evidence_draft_id: "task_1:draft_y", task_id: "task_1", created_by: w.ra._id, ...draftContent() }),
    silentAttachment: (w) => w.db.insert("evidence_attachments", { task_id: "task_1", status: "active", created_at: Date.now() + 1, updated_at: Date.now() + 1 }),
    silentOccupancy: (w) => w.db.insert("site_occupancies", { task_id: "task_1", created_at: Date.now() + 1, updated_at: Date.now() + 1 }),
    silentClaim: (w) => w.db.insert("historical_claims", { task_id: "task_1", created_at: Date.now() + 1, updated_at: Date.now() + 1 }),
    secondReopen: async (w) => {
      await w.db.patch(w.task._id, { status: "reviewed" });
      await reopenTask._handler(w.as(w.reviewer), { taskId: "task_1", reason: "A second reopening." });
    },
  };
  for (const [label, write] of Object.entries(cases)) {
    const w = await reopened("pi_accepted");
    await write(w);
    if (w.task.status !== "reopened") await w.db.patch(w.task._id, { status: "reopened" });
    await assert.rejects(revertReopen._handler(w.as(w.reviewer), { taskId: "task_1", reason: "Opened in error, no new evidence." }), /written to this task since/, label);
    assert.ok(w.task.reopened_after_decision, label);
  }
  // rows from before the reopen do not count
  const w = await scene("pi_accepted");
  await w.addDraft({ evidence_draft_id: "task_1:draft_old", task_id: "task_1", created_by: w.ra._id, ...draftContent() });
  await reopenTask._handler(w.as(w.ra), { taskId: "task_1", reason: "New evidence on the date." });
  await revertReopen._handler(w.as(w.reviewer), { taskId: "task_1", reason: "Opened in error, no new evidence." });
  assert.equal(w.task.status, "pi_accepted");
});

test("a reverted pi_accepted task is export-eligible again, and a reopened one is not", async () => {
  const w = await scene("in_progress");
  w.admin = await w.addUser("admin-subject", ["admin"]);
  await w.addDraft({ evidence_draft_id: "task_1:draft_a", task_id: "task_1", created_by: w.ra._id, ...draftContent() });
  await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a" });
  const snapshot = await getReviewSnapshot._handler(w.as(w.reviewer), { taskId: "task_1", evidenceDraftId: "task_1:draft_a" });
  await recordReviewDecision._handler(w.as(w.reviewer), {
    taskId: "task_1",
    decision: { evidence_draft_id: "task_1:draft_a", decision_status: "accepted_for_export", decision_note: "Checked the entry in full." },
    snapshotHash: snapshot.snapshot_hash,
  });
  await recordAcceptance._handler(w.as(w.pi), { taskId: "task_1", outcome: "accepted", note: "Ratifying the reviewer's decision." });
  await reopenTask._handler(w.as(w.ra), { taskId: "task_1", reason: "New evidence on the date." });
  await assert.rejects(createExportBatch._handler(w.as(w.admin), { countryCode: "VU", taskIds: ["task_1"] }));
  await revertReopen._handler(w.as(w.reviewer), { taskId: "task_1", reason: "Opened in error, no new evidence." });
  assert.equal(w.task.status, "pi_accepted");
  const batch = await createExportBatch._handler(w.as(w.admin), { countryCode: "VU", taskIds: ["task_1"] });
  assert.ok(batch.export_batch_id);
});

test("a limiter fault that is not a rate limit is not rewritten", async () => {
  const original = intakeRateLimiter.limit;
  intakeRateLimiter.limit = async () => { throw new Error("component unavailable"); };
  try {
    const w = await scene("reviewed");
    await assert.rejects(reopenTask._handler(w.as(w.ra), { taskId: "task_1", reason: "New evidence on the date." }), /component unavailable/);
    assert.equal(w.task.status, "reviewed");
  } finally {
    intakeRateLimiter.limit = original;
  }
});

// review findings on #198
test("a revert is refused after a write that logs no event: a receipt, a seeding update, an agent row", async () => {
  const stamp = () => Date.now() + 5;
  const cases = {
    // a batch seeding update patches the task row and writes no event
    seeding: (w) => w.db.patch(w.task._id, { updated_at: stamp(), name: "Renamed by a seeding update" }),
    lastEventOnly: (w) => w.db.patch(w.task._id, { last_event_at: stamp() }),
    agentReview: (w) => w.db.insert("agent_reviews", { task_id: "task_1", created_at: stamp() }),
    agentJudgment: (w) => w.db.insert("agent_judgments", { context: { task_id: "task_1" }, created_at: stamp() }),
    firstPass: (w) => w.db.insert("agent_first_pass_receipts", { task_id: "task_1", created_at: stamp() }),
  };
  for (const [label, write] of Object.entries(cases)) {
    const w = await reopened("pi_accepted");
    await write(w);
    await assert.rejects(revertReopen._handler(w.as(w.reviewer), { taskId: "task_1", reason: "Opened in error, no new evidence." }), /written to this task since/, label);
    assert.equal(w.task.status, "reopened", label);
    assert.ok(w.task.reopened_after_decision, label);
  }
});

// the draft predates the reopen, so only the receipt is a write since; the
// control case proves the draft alone does not refuse the revert
test("a revert is refused after an unchanged resubmission that writes only a receipt", async () => {
  for (const withReceipt of [false, true]) {
    const w = await scene("pi_accepted");
    w.admin = await w.addUser("admin-subject", ["admin"]);
    await w.addDraft({ evidence_draft_id: "task_1:draft_r", task_id: "task_1", created_by: w.ra._id, ...draftContent(), created_at: 1, updated_at: 1 });
    await reopenTask._handler(w.as(w.ra), { taskId: "task_1", reason: "New evidence on the date." });
    if (withReceipt) {
      await w.db.insert("evidence_submission_receipts", { submission_key: "submit:r", route: "submit", task_id: "task_1", evidence_draft_id: "task_1:draft_r", recorded_at: Date.now() + 5 });
      await assert.rejects(revertReopen._handler(w.as(w.reviewer), { taskId: "task_1", reason: "Opened in error, no new evidence." }), /written to this task since/);
      assert.equal(w.task.status, "reopened");
    } else {
      const reverted = await revertReopen._handler(w.as(w.reviewer), { taskId: "task_1", reason: "Opened in error, no new evidence." });
      assert.equal(reverted.status, "pi_accepted");
    }
  }
});

test("a revert fails closed when a table holds more rows than the check will read", async () => {
  const w = await reopened("pi_accepted");
  // 201 historical claims written before the reopen: none is a write since,
  // but the check cannot see the whole history
  for (let i = 0; i < 201; i += 1) {
    await w.db.insert("historical_claims", { task_id: "task_1", created_at: 1, updated_at: 1 });
  }
  await assert.rejects(revertReopen._handler(w.as(w.reviewer), { taskId: "task_1", reason: "Opened in error, no new evidence." }), /too much recorded history/);
  assert.equal(w.task.status, "reopened");
  assert.ok(w.task.reopened_after_decision);
  // within the budget the same history is fine
  const x = await reopened("pi_accepted");
  for (let i = 0; i < 200; i += 1) {
    await x.db.insert("historical_claims", { task_id: "task_1", created_at: 1, updated_at: 1 });
  }
  await revertReopen._handler(x.as(x.reviewer), { taskId: "task_1", reason: "Opened in error, no new evidence." });
  assert.equal(x.task.status, "pi_accepted");
});
