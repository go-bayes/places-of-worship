import assert from "node:assert/strict";
import test from "node:test";
import { world, draftContent, fakeStorage, actionCtx, utf8Length } from "./testing/exportWorld.node-test.mjs";

// The in-memory harness (world(), draftContent(), fakeStorage(), actionCtx(),
// the extensionless-import resolve hook, the fixed clock, and the rate
// limiter stub) lives in ./testing/exportWorld.node-test.mjs, shared with
// scripts/export_bundle_fixture.mjs so the committed fixture bundle
// (schemas/fixtures/pow-export-bundle.v1/) is built by the exact same
// harness these tests exercise. It is not folded into
// evidenceVersions.node-test.mjs's own world(): that file is not imported
// from here (importing a *.node-test.mjs file re-registers every one of its
// top-level `test()` calls a second time under node:test), and it is left
// unchanged.

const { submitEvidenceDraft } = await import("./evidence.ts");
const { recordReviewDecision, getReviewSnapshot } = await import("./reviews.ts");
const { recordAcceptance } = await import("./acceptances.ts");
const { createExportBatch, freezeExportBatch, getExportBundle, withdrawExportBatch, prepareFreeze, completeFreeze } =
  await import("./exports.ts");
const { reopenTask } = await import("./tasks.ts");
const { objectHash } = await import("./lib/canonicalJson.ts");
const { sha256 } = await import("./lib/sha256.ts");
const { verifyEvidenceVersionEnvelope } = await import("./lib/evidenceVersions.ts");
const { appendTaskEvent } = await import("./lib/taskEvents.ts");

// the ordinary starting point: an RA with an editable guided draft on an
// unassigned task, plus the other actors the review-side tests need
async function scene({ country = "NZ", taskStatus = "in_progress", draft = {}, task = {} } = {}) {
  const w = world();
  const ra = await w.addUser("ra-subject", ["ra"]);
  const otherRa = await w.addUser("other-ra-subject", ["ra"]);
  const reviewer = await w.addUser("reviewer-subject", ["reviewer"]);
  const admin = await w.addUser("admin-subject", ["admin"]);
  const taskRow = await w.addTask({ task_id: "task_1", country_code: country, status: taskStatus, ...task });
  const draftRow = await w.addDraft({ evidence_draft_id: "task_1:draft_a", task_id: "task_1", created_by: ra._id, ...draft });
  return { ...w, ra, otherRa, reviewer, admin, task: taskRow, draft: draftRow };
}

// carries a task from a fresh guided draft through submission, a
// snapshot-linked accepted-for-export decision, and PI acceptance, so it is
// pi_accepted and ready to enter an export batch
async function reviewAndAccept(w, { taskId = "task_1", evidenceDraftId = "task_1:draft_a", pi } = {}) {
  await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId });
  const snapshot = await getReviewSnapshot._handler(w.as(w.reviewer), { taskId, evidenceDraftId });
  const decision = await recordReviewDecision._handler(w.as(w.reviewer), {
    taskId,
    decision: { evidence_draft_id: evidenceDraftId, decision_status: "accepted_for_export", decision_note: "Checked the directory entry in full." },
    snapshotHash: snapshot.snapshot_hash,
  });
  const acceptance = await recordAcceptance._handler(w.as(pi), {
    taskId,
    outcome: "accepted",
    note: "Ratifying the reviewer's decision.",
  });
  return { decision, acceptance };
}

// a scene already carrying one pi_accepted task and one draft export batch
// naming it, ready to be frozen
async function freezableScene(country = "VU") {
  const w = await scene({ country });
  const pi = await w.addUser("pi-subject", ["pi"]);
  const admin2 = await w.addUser("admin-subject-2", ["admin"]);
  await reviewAndAccept(w, { pi });
  const batch = await createExportBatch._handler(w.as(admin2), { countryCode: country, taskIds: ["task_1"] });
  return { ...w, pi, admin2, batch };
}

// scenario 1 (brief section 9): successful freeze
test("freezeExportBatch stores and verifies the complete bundle; getExportBundle then serves those bytes untouched by a later row change", async () => {
  const w = await freezableScene();
  const storage = fakeStorage();

  const result = await freezeExportBatch._handler(actionCtx(w, storage), { exportBatchId: w.batch.export_batch_id });
  assert.equal(result.status, "frozen");
  assert.match(result.manifest_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(result.file_count, 16);

  const batchRow = w.row("export_batches", "export_batch_id", w.batch.export_batch_id);
  assert.equal(batchRow.status, "frozen");
  assert.equal(batchRow.manifest_hash, result.manifest_hash);
  assert.equal(batchRow.frozen_at, result.frozen_at);
  assert.ok(batchRow.freeze_completed_at >= batchRow.frozen_at);
  assert.equal(batchRow.bundle_contract, "pow-export-bundle.v1");
  assert.equal(batchRow.pending_freeze, undefined);
  assert.ok(Array.isArray(batchRow.frozen_files));
  assert.equal(batchRow.frozen_files.length, 16);
  assert.equal(storage._blobCount(), 16);

  const task = w.row("tasks", "task_id", "task_1");
  assert.equal(task.status, "exported");
  assert.equal(w.events("exported").length, 1);

  const bundle = await getExportBundle._handler(actionCtx(w, storage), { exportBatchId: w.batch.export_batch_id });
  assert.equal(bundle.disposition.status, "frozen");
  assert.equal(bundle.disposition.stored_bytes, true);
  assert.equal(bundle.disposition.verified, true);
  assert.equal(bundle.disposition.processing_allowed, true);
  assert.equal(bundle.export_manifest.manifest_hash, result.manifest_hash);
  assert.equal(bundle.export_manifest.bundle_contract, "pow-export-bundle.v1");
  assert.equal(bundle.export_manifest.hash_contract, "pow-object.v1");

  // files sorted by filename
  const filenames = bundle.export_manifest.files.map((entry) => entry.filename);
  assert.deepEqual(filenames, [...filenames].sort());
  assert.equal(filenames.length, 15);

  // manifest_hash reproduces from the manifest with that member omitted
  const { manifest_hash: storedHash, ...withoutHash } = bundle.export_manifest;
  assert.equal(objectHash(withoutHash), storedHash);

  // every evidence_versions.jsonl envelope verifies
  const versionLines = bundle.files.evidence_versions_jsonl.trim().length > 0
    ? bundle.files.evidence_versions_jsonl.trim().split("\n")
    : [];
  assert.equal(versionLines.length, 1);
  for (const line of versionLines) {
    const row = JSON.parse(line);
    const envelope = JSON.parse(row.envelope_json);
    const verification = verifyEvidenceVersionEnvelope(envelope);
    assert.deepEqual(verification.errors, []);
    assert.equal(verification.valid, true);
  }

  // a direct patch to a draft row afterwards changes nothing in what
  // getExportBundle returns: the frozen batch is never rebuilt from rows
  await w.db.patch(w.draft._id, { evidence_note: "Changed after the freeze completed." });
  const bundleAfterEdit = await getExportBundle._handler(actionCtx(w, storage), { exportBatchId: w.batch.export_batch_id });
  assert.deepEqual(bundleAfterEdit.export_manifest, bundle.export_manifest);
  assert.deepEqual(bundleAfterEdit.files, bundle.files);
});

// scenario 2: freeze-time recheck
test("freezeExportBatch refuses when an included task's export authority no longer holds; the batch stays draft with last_freeze_failure and nothing else changes", async () => {
  const w = await freezableScene();
  const storage = fakeStorage();

  // reopen the task after the batch was created: task_1 is no longer pi_accepted
  await reopenTask._handler(w.as(w.reviewer), { taskId: "task_1", reason: "Reopening before the freeze attempt." });

  // freezeExportBatch itself requires curator or admin; select that actor
  // again before calling it (the last w.as() call above was the reviewer)
  w.as(w.admin2);
  await assert.rejects(
    freezeExportBatch._handler(actionCtx(w, storage), { exportBatchId: w.batch.export_batch_id }),
    /only tasks a principal investigator has accepted/,
  );

  const batchRow = w.row("export_batches", "export_batch_id", w.batch.export_batch_id);
  assert.equal(batchRow.status, "draft");
  assert.ok(batchRow.last_freeze_failure);
  assert.equal(batchRow.pending_freeze, undefined);
  assert.equal(batchRow.frozen_files, undefined);
  assert.equal(storage._blobCount(), 0);

  const task = w.row("tasks", "task_id", "task_1");
  assert.equal(task.status, "reopened");
});

// scenario 3: a row changes between prepareFreeze's capture and completeFreeze
test("a row that changes while blobs are being stored is caught at completion: blobs are deleted and the batch stays draft", async () => {
  const w = await freezableScene();
  const storage = fakeStorage();
  storage._runOnFirstStore(async () => {
    await appendTaskEvent(w.ctx, {
      taskId: "task_1",
      eventType: "note_added",
      actorUserId: w.admin2._id,
      actorRole: "admin",
      reason: "Concurrent write recorded while blobs were being stored.",
    });
  });

  await assert.rejects(
    freezeExportBatch._handler(actionCtx(w, storage), { exportBatchId: w.batch.export_batch_id }),
    /changed between freeze capture and completion/,
  );

  const batchRow = w.row("export_batches", "export_batch_id", w.batch.export_batch_id);
  assert.equal(batchRow.status, "draft");
  assert.ok(batchRow.last_freeze_failure);
  assert.equal(storage._blobCount(), 0);
});

// scenario 4: overlapping freeze attempts
test("completing a superseded freeze attempt is refused on the attempt id; the later attempt still completes", async () => {
  const w = await freezableScene();

  const attemptA = "attempt-a";
  const attemptB = "attempt-b";
  const preparedA = await prepareFreeze._handler(w.as(w.admin2), {
    exportBatchId: w.batch.export_batch_id,
    userId: w.admin2._id,
    attemptId: attemptA,
  });
  const preparedB = await prepareFreeze._handler(w.as(w.admin2), {
    exportBatchId: w.batch.export_batch_id,
    userId: w.admin2._id,
    attemptId: attemptB,
  });
  assert.notEqual(preparedA.manifest_hash, undefined);
  assert.notEqual(preparedB.manifest_hash, undefined);

  const toStoredFiles = (prepared, prefix) => prepared.files.map((file) => ({
    filename: file.filename,
    storageId: `${prefix}-${file.filename}`,
    sha256: sha256(file.text),
    byteLength: utf8Length(file.text),
    contentType: file.content_type,
  }));

  await assert.rejects(
    completeFreeze._handler(w.as(w.admin2), {
      exportBatchId: w.batch.export_batch_id,
      attemptId: attemptA,
      userId: w.admin2._id,
      storedFiles: toStoredFiles(preparedA, "a"),
    }),
    /no longer current/,
  );
  assert.equal(w.row("export_batches", "export_batch_id", w.batch.export_batch_id).status, "draft");

  const completed = await completeFreeze._handler(w.as(w.admin2), {
    exportBatchId: w.batch.export_batch_id,
    attemptId: attemptB,
    userId: w.admin2._id,
    storedFiles: toStoredFiles(preparedB, "b"),
  });
  assert.equal(completed.status, "frozen");
  assert.equal(completed.manifest_hash, preparedB.manifest_hash);
});

// scenario 5: stored-byte corruption on read-back during the freeze
test("stored-byte corruption on read-back aborts the freeze: blobs deleted, batch stays draft", async () => {
  const w = await freezableScene();
  const storage = fakeStorage();
  storage._corruptNextGet();

  await assert.rejects(
    freezeExportBatch._handler(actionCtx(w, storage), { exportBatchId: w.batch.export_batch_id }),
    /did not verify on read-back/,
  );

  const batchRow = w.row("export_batches", "export_batch_id", w.batch.export_batch_id);
  assert.equal(batchRow.status, "draft");
  assert.ok(batchRow.last_freeze_failure);
  assert.equal(storage._blobCount(), 0);
});

// scenario 6: post-freeze corruption of a stored file
test("post-freeze corruption of a stored file is caught at retrieval, naming the file, and never rebuilt from rows", async () => {
  const w = await freezableScene();
  const storage = fakeStorage();
  await freezeExportBatch._handler(actionCtx(w, storage), { exportBatchId: w.batch.export_batch_id });

  const batchRow = w.row("export_batches", "export_batch_id", w.batch.export_batch_id);
  // a non-empty file: flipping a byte in a zero-length file changes nothing
  const target = batchRow.frozen_files.find((entry) => entry.byte_length > 0);
  assert.ok(target, "expected at least one non-empty stored file");
  storage._corrupt(target.storage_id);

  await assert.rejects(
    getExportBundle._handler(actionCtx(w, storage), { exportBatchId: w.batch.export_batch_id }),
    new RegExp(target.filename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );
});

// scenario 7: a batch frozen before this change (no stored bytes)
test("a batch frozen before this change, with no frozen_files, is served as a live, unverified preview", async () => {
  const w = await freezableScene();
  const batchRow = w.row("export_batches", "export_batch_id", w.batch.export_batch_id);
  const legacyFrozenAt = Date.now();
  await w.db.patch(batchRow._id, { status: "frozen", frozen_at: legacyFrozenAt });

  const storage = fakeStorage();
  const bundle = await getExportBundle._handler(actionCtx(w, storage), { exportBatchId: w.batch.export_batch_id });
  assert.equal(bundle.disposition.status, "frozen");
  assert.equal(bundle.disposition.stored_bytes, false);
  assert.equal(bundle.disposition.verified, false);
  assert.equal(bundle.disposition.processing_allowed, false);
  assert.equal(bundle.disposition.legacy_unfrozen_bytes, true);
  assert.equal(bundle.export_manifest.manifest_hash, undefined);
  assert.equal(bundle.export_manifest.frozen_at, legacyFrozenAt);
  assert.ok(bundle.files.tasks_jsonl.includes("task_1"));
});

// scenario 8: withdrawal
test("withdrawExportBatch marks a frozen batch withdrawn and keeps its bytes served; a draft batch, an already-withdrawn batch, or a short reason is refused", async () => {
  const w = await freezableScene();
  const storage = fakeStorage();
  await freezeExportBatch._handler(actionCtx(w, storage), { exportBatchId: w.batch.export_batch_id });

  await assert.rejects(
    withdrawExportBatch._handler(w.as(w.admin2), { exportBatchId: w.batch.export_batch_id, reason: "short" }),
    /at least 8 characters/,
  );

  const result = await withdrawExportBatch._handler(w.as(w.admin2), {
    exportBatchId: w.batch.export_batch_id,
    reason: "Withdrawn: superseded by a corrected batch.",
  });
  assert.equal(result.status, "withdrawn");

  const batchRow = w.row("export_batches", "export_batch_id", w.batch.export_batch_id);
  assert.equal(batchRow.status, "withdrawn");
  assert.ok(batchRow.frozen_files);
  assert.equal(batchRow.frozen_files.length, 16);
  assert.equal(batchRow.withdrawn_by, w.admin2._id);
  assert.match(batchRow.withdrawal_reason, /superseded by a corrected batch/);

  const noted = w.events("note_added").filter((event) => event.export_batch_id === w.batch.export_batch_id);
  assert.equal(noted.length, 1);

  const bundle = await getExportBundle._handler(actionCtx(w, storage), { exportBatchId: w.batch.export_batch_id });
  assert.equal(bundle.disposition.status, "withdrawn");
  assert.equal(bundle.disposition.stored_bytes, true);
  assert.equal(bundle.disposition.verified, true);
  assert.equal(bundle.disposition.processing_allowed, false);

  await assert.rejects(
    withdrawExportBatch._handler(w.as(w.admin2), { exportBatchId: w.batch.export_batch_id, reason: "Trying to withdraw a second time." }),
    /Only a frozen export batch/,
  );

  const w2 = await freezableScene();
  await assert.rejects(
    withdrawExportBatch._handler(w2.as(w2.admin2), { exportBatchId: w2.batch.export_batch_id, reason: "Draft batches cannot be withdrawn." }),
    /Only a frozen export batch/,
  );
});

// scenario 9: supersession
test("freezing a batch created with supersedesExportBatchId marks the earlier batch superseded and keeps its bytes served; naming a draft or withdrawn batch is refused at creation", async () => {
  const w = await freezableScene();
  const storage = fakeStorage();
  const first = await freezeExportBatch._handler(actionCtx(w, storage), { exportBatchId: w.batch.export_batch_id });

  // naming a draft batch is refused at creation
  const draftBatch = await createExportBatch._handler(w.as(w.admin2), { countryCode: "VU", taskIds: [] });
  await assert.rejects(
    createExportBatch._handler(w.as(w.admin2), {
      countryCode: "VU",
      taskIds: [],
      supersedesExportBatchId: draftBatch.export_batch_id,
    }),
    /must be a frozen batch with stored bytes/,
  );

  // reopen, re-review, and re-accept a corrected record so the task is
  // pi_accepted again
  await reopenTask._handler(w.as(w.reviewer), { taskId: "task_1", reason: "Reopening to add a corrected record." });
  await w.addDraft({
    evidence_draft_id: "task_1:draft_b",
    task_id: "task_1",
    created_by: w.ra._id,
    ...draftContent({ evidence_note: "A corrected directory reading." }),
  });
  await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_b" });
  const snapshot2 = await getReviewSnapshot._handler(w.as(w.reviewer), { taskId: "task_1", evidenceDraftId: "task_1:draft_b" });
  await recordReviewDecision._handler(w.as(w.reviewer), {
    taskId: "task_1",
    decision: { evidence_draft_id: "task_1:draft_b", decision_status: "accepted_for_export", decision_note: "Checked the corrected record." },
    snapshotHash: snapshot2.snapshot_hash,
  });
  await recordAcceptance._handler(w.as(w.pi), { taskId: "task_1", outcome: "accepted", note: "Ratifying the corrected record." });
  assert.equal(w.task.status, "pi_accepted");

  const second = await createExportBatch._handler(w.as(w.admin2), {
    countryCode: "VU",
    taskIds: ["task_1"],
    supersedesExportBatchId: w.batch.export_batch_id,
  });
  const secondResult = await freezeExportBatch._handler(actionCtx(w, storage), { exportBatchId: second.export_batch_id });
  assert.equal(secondResult.status, "frozen");

  const firstRow = w.row("export_batches", "export_batch_id", w.batch.export_batch_id);
  assert.equal(firstRow.status, "superseded");
  assert.equal(firstRow.superseded_by_export_batch_id, second.export_batch_id);
  assert.ok(firstRow.superseded_at);
  assert.ok(firstRow.frozen_files);

  // the first batch's bytes are still served
  const firstBundle = await getExportBundle._handler(actionCtx(w, storage), { exportBatchId: w.batch.export_batch_id });
  assert.equal(firstBundle.disposition.status, "superseded");
  assert.equal(firstBundle.disposition.stored_bytes, true);
  assert.equal(firstBundle.disposition.verified, true);
  assert.equal(firstBundle.disposition.processing_allowed, false);
  assert.equal(firstBundle.disposition.superseded_by_export_batch_id, second.export_batch_id);
  assert.equal(firstBundle.export_manifest.manifest_hash, first.manifest_hash);

  // naming an already-withdrawn batch is refused at creation
  await withdrawExportBatch._handler(w.as(w.admin2), {
    exportBatchId: second.export_batch_id,
    reason: "Testing withdrawal refusal for supersession.",
  });
  await assert.rejects(
    createExportBatch._handler(w.as(w.admin2), {
      countryCode: "VU",
      taskIds: [],
      supersedesExportBatchId: second.export_batch_id,
    }),
    /must be a frozen batch with stored bytes/,
  );
});

// scenario 10: membership drift
test("membership drift: a batch whose stored decision ids no longer match the helper's current result is refused at freeze", async () => {
  const w = await freezableScene();
  // a second accepted decision recorded directly on task_1 after the batch
  // was created, without recreating the batch
  await w.db.insert("review_decisions", {
    review_decision_id: "task_1:review:extra",
    task_id: "task_1",
    evidence_draft_id: "task_1:draft_a",
    reviewer_user_id: w.reviewer._id,
    decision_status: "accepted_for_export",
    decision_note: "A second decision recorded after the batch was created.",
    created_at: Date.now(),
    updated_at: Date.now(),
  });

  const storage = fakeStorage();
  await assert.rejects(
    freezeExportBatch._handler(actionCtx(w, storage), { exportBatchId: w.batch.export_batch_id }),
    /membership changed since it was created/,
  );

  const batchRow = w.row("export_batches", "export_batch_id", w.batch.export_batch_id);
  assert.equal(batchRow.status, "draft");
  assert.ok(batchRow.last_freeze_failure);
  assert.equal(storage._blobCount(), 0);
});
