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
const {
  createExportBatch,
  freezeExportBatch,
  getExportBundle,
  withdrawExportBatch,
  prepareFreeze,
  completeFreeze,
  recordStoredObject,
  composeExportBatches,
  freezeCountryBatches,
  getExportRun,
  EXPORT_BATCH_BYTE_BUDGET,
  EXPORT_BATCH_READ_BUDGET,
} = await import("./exports.ts");
const { BUNDLE_CODEC, gzipBundleFile, utf8Bytes, sha256Hex } = await import("./lib/bundleCodec.ts");
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

// stores every prepared file as the freeze action does (gzip under the
// pinned codec, recorded on the attempt's trail) and returns the storedFiles
// completeFreeze takes
async function storeAttempt(w, storage, prepared, attemptId, user = w.admin2) {
  w.useStorage(storage);
  const storedFiles = [];
  for (const file of prepared.files) {
    const plain = utf8Bytes(file.text);
    const gz = gzipBundleFile(plain);
    const storageId = await storage.store(new Blob([gz]));
    const entry = {
      filename: file.filename,
      storageId,
      sha256: sha256(file.text),
      byteLength: plain.length,
      storedSha256: await sha256Hex(gz),
      storedByteLength: gz.length,
      codec: BUNDLE_CODEC,
    };
    await recordStoredObject._handler(w.as(user), { exportBatchId: prepared.exportBatchId, attemptId, userId: user._id, ...entry });
    storedFiles.push({ ...entry, contentType: file.content_type, encoding: "gzip" });
  }
  return storedFiles;
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
  const storage = fakeStorage();
  const preparedA = await prepareFreeze._handler(w.as(w.admin2), {
    exportBatchId: w.batch.export_batch_id,
    userId: w.admin2._id,
    attemptId: attemptA,
  });
  // attempt A stores its first object before B replaces it
  const storedA = await storeAttempt(w, storage, { ...preparedA, exportBatchId: w.batch.export_batch_id }, attemptA);
  const preparedB = await prepareFreeze._handler(w.as(w.admin2), {
    exportBatchId: w.batch.export_batch_id,
    userId: w.admin2._id,
    attemptId: attemptB,
  });
  assert.notEqual(preparedA.manifest_hash, undefined);
  assert.notEqual(preparedB.manifest_hash, undefined);
  // a stale attempt can no longer record objects
  const storedStale = await storeAttempt(w, storage, { ...preparedA, exportBatchId: w.batch.export_batch_id }, attemptA);
  assert.equal(
    w.row("export_batches", "export_batch_id", w.batch.export_batch_id).pending_freeze.stored_objects.filter((entry) => storedStale.some((file) => file.storageId === entry.storage_id)).length,
    0,
  );

  await assert.rejects(
    completeFreeze._handler(w.as(w.admin2), {
      exportBatchId: w.batch.export_batch_id,
      attemptId: attemptA,
      userId: w.admin2._id,
      storedFiles: storedA,
    }),
    /no longer current/,
  );
  assert.equal(w.row("export_batches", "export_batch_id", w.batch.export_batch_id).status, "draft");

  const storedB = await storeAttempt(w, storage, { ...preparedB, exportBatchId: w.batch.export_batch_id }, attemptB);
  const completed = await completeFreeze._handler(w.as(w.admin2), {
    exportBatchId: w.batch.export_batch_id,
    attemptId: attemptB,
    userId: w.admin2._id,
    storedFiles: storedB,
  });
  assert.equal(completed.status, "frozen");
  // attempt A's recorded objects were carried on the trail and discarded
  // when B committed
  assert.ok(storedA.every((file) => !storage._has(file.storageId)));
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

// a second pi_accepted task in an existing scene, for membership rules
async function acceptSecondTask(w) {
  await w.addTask({ task_id: "task_2", country_code: "VU", status: "in_progress" });
  await w.addDraft({ evidence_draft_id: "task_2:draft_a", task_id: "task_2", created_by: w.ra._id });
  await reviewAndAccept(w, { taskId: "task_2", evidenceDraftId: "task_2:draft_a", pi: w.pi });
}

// reopens, re-reviews, and re-accepts a task with a corrected record, so it
// is pi_accepted again and can enter a superseding batch
async function reacceptTask(w, taskId, draftId) {
  await reopenTask._handler(w.as(w.reviewer), { taskId, reason: "Reopening to add a corrected record." });
  await w.addDraft({
    evidence_draft_id: draftId,
    task_id: taskId,
    created_by: w.ra._id,
    ...draftContent({ evidence_note: "A corrected directory reading." }),
  });
  await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: draftId });
  const snapshot = await getReviewSnapshot._handler(w.as(w.reviewer), { taskId, evidenceDraftId: draftId });
  await recordReviewDecision._handler(w.as(w.reviewer), {
    taskId,
    decision: { evidence_draft_id: draftId, decision_status: "accepted_for_export", decision_note: "Checked the corrected record." },
    snapshotHash: snapshot.snapshot_hash,
  });
  await recordAcceptance._handler(w.as(w.pi), { taskId, outcome: "accepted", note: "Ratifying the corrected record." });
}

// review of PR #112 (2026-09-12), finding 2: a completion whose response is
// lost after the transaction committed must not have its blobs deleted
test("a lost response after completeFreeze committed keeps every blob, leaves the batch frozen, and the action returns the committed result", async () => {
  const w = await freezableScene();
  const storage = fakeStorage();
  const ctx = actionCtx(w, storage);
  const dispatch = ctx.runMutation.bind(ctx);
  let completions = 0;
  ctx.runMutation = async (ref, args) => {
    const result = await dispatch(ref, args);
    if (args.storedFiles !== undefined) {
      completions += 1;
      throw new Error("socket hang up");
    }
    return result;
  };

  const result = await freezeExportBatch._handler(ctx, { exportBatchId: w.batch.export_batch_id });
  assert.equal(completions, 1);
  assert.equal(result.status, "frozen");
  assert.equal(result.file_count, 16);

  const batchRow = w.row("export_batches", "export_batch_id", w.batch.export_batch_id);
  assert.equal(batchRow.status, "frozen");
  assert.equal(batchRow.last_freeze_failure, undefined);
  assert.equal(batchRow.frozen_files.length, 16);
  assert.equal(storage._blobCount(), 16);
  assert.equal(result.manifest_hash, batchRow.manifest_hash);

  // the stored bytes still serve and verify
  const bundle = await getExportBundle._handler(actionCtx(w, storage), { exportBatchId: w.batch.export_batch_id });
  assert.equal(bundle.disposition.verified, true);
  assert.equal(bundle.disposition.processing_allowed, true);
});

test("when the outcome of a failed completion cannot be established, every blob is kept and the error says so", async () => {
  const w = await freezableScene();
  const storage = fakeStorage();
  const ctx = actionCtx(w, storage);
  const dispatchMutation = ctx.runMutation.bind(ctx);
  const dispatchQuery = ctx.runQuery.bind(ctx);
  ctx.runMutation = async (ref, args) => {
    const result = await dispatchMutation(ref, args);
    if (args.storedFiles !== undefined) throw new Error("socket hang up");
    return result;
  };
  ctx.runQuery = async (ref, args) => {
    if (args.attemptId !== undefined) throw new Error("backend unreachable");
    return dispatchQuery(ref, args);
  };

  await assert.rejects(
    freezeExportBatch._handler(ctx, { exportBatchId: w.batch.export_batch_id }),
    /outcome could not be established .*16 stored blobs were kept/,
  );
  assert.equal(storage._blobCount(), 16);
  assert.equal(w.row("export_batches", "export_batch_id", w.batch.export_batch_id).status, "frozen");
});

test("a rejected completion (not a lost response) still deletes the blobs; a retry of a committed attempt is idempotent", async () => {
  const w = await freezableScene();
  const prepared = await prepareFreeze._handler(w.as(w.admin2), {
    exportBatchId: w.batch.export_batch_id,
    userId: w.admin2._id,
    attemptId: "attempt-x",
  });
  const storedFiles = await storeAttempt(w, fakeStorage(), { ...prepared, exportBatchId: w.batch.export_batch_id }, "attempt-x");
  const first = await completeFreeze._handler(w.as(w.admin2), {
    exportBatchId: w.batch.export_batch_id,
    attemptId: "attempt-x",
    userId: w.admin2._id,
    storedFiles,
  });
  const again = await completeFreeze._handler(w.as(w.admin2), {
    exportBatchId: w.batch.export_batch_id,
    attemptId: "attempt-x",
    userId: w.admin2._id,
    storedFiles,
  });
  assert.deepEqual(again, first);
  assert.equal(w.events("exported").length, 1);
  // a different attempt against the now-frozen batch is still refused
  await assert.rejects(
    completeFreeze._handler(w.as(w.admin2), {
      exportBatchId: w.batch.export_batch_id,
      attemptId: "attempt-y",
      userId: w.admin2._id,
      storedFiles,
    }),
    /no longer current/,
  );
});

// review of PR #112 (2026-09-12), finding 3: supersession must check the
// predecessor's country and the replacement's membership
test("supersession refuses another country's batch and an empty or partial replacement at creation", async () => {
  const w = await freezableScene();
  const storage = fakeStorage();
  await freezeExportBatch._handler(actionCtx(w, storage), { exportBatchId: w.batch.export_batch_id });

  await assert.rejects(
    createExportBatch._handler(w.as(w.admin2), {
      countryCode: "NZ",
      taskIds: [],
      supersedesExportBatchId: w.batch.export_batch_id,
    }),
    /is a VU batch and cannot be superseded by a NZ batch/,
  );
  await assert.rejects(
    createExportBatch._handler(w.as(w.admin2), {
      countryCode: "VU",
      taskIds: [],
      supersedesExportBatchId: w.batch.export_batch_id,
    }),
    /must include at least one task/,
  );

  // a replacement naming only a different task does not cover task_1
  await acceptSecondTask(w);
  await assert.rejects(
    createExportBatch._handler(w.as(w.admin2), {
      countryCode: "VU",
      taskIds: ["task_2"],
      supersedesExportBatchId: w.batch.export_batch_id,
    }),
    /must include every task it exported; missing task_1/,
  );
  assert.equal(w.row("export_batches", "export_batch_id", w.batch.export_batch_id).status, "frozen");

  // covering the predecessor and adding a task is accepted
  await reacceptTask(w, "task_1", "task_1:draft_b");
  const second = await createExportBatch._handler(w.as(w.admin2), {
    countryCode: "VU",
    taskIds: ["task_1", "task_2"],
    supersedesExportBatchId: w.batch.export_batch_id,
  });
  assert.equal(second.included_task_count, 2);
});

test("a predecessor withdrawn or superseded after the replacement was created refuses the replacement's completion", async () => {
  const w = await freezableScene();
  const storage = fakeStorage();
  await freezeExportBatch._handler(actionCtx(w, storage), { exportBatchId: w.batch.export_batch_id });
  await reacceptTask(w, "task_1", "task_1:draft_b");
  const second = await createExportBatch._handler(w.as(w.admin2), {
    countryCode: "VU",
    taskIds: ["task_1"],
    supersedesExportBatchId: w.batch.export_batch_id,
  });
  await withdrawExportBatch._handler(w.as(w.admin2), {
    exportBatchId: w.batch.export_batch_id,
    reason: "Withdrawn while a replacement was still draft.",
  });

  const blobsBefore = storage._blobCount();
  await assert.rejects(
    freezeExportBatch._handler(actionCtx(w, storage), { exportBatchId: second.export_batch_id }),
    /is now withdrawn and can no longer be superseded/,
  );
  const secondRow = w.row("export_batches", "export_batch_id", second.export_batch_id);
  assert.equal(secondRow.status, "draft");
  assert.match(secondRow.last_freeze_failure.reason, /can no longer be superseded/);
  assert.equal(storage._blobCount(), blobsBefore);
  const firstRow = w.row("export_batches", "export_batch_id", w.batch.export_batch_id);
  assert.equal(firstRow.status, "withdrawn");
  assert.equal(firstRow.superseded_by_export_batch_id, undefined);
  assert.equal(w.task.status, "pi_accepted");
});


// ---------------------------------------------------------------------------
// pr l1, lean freeze (lean-storage brief section 3.1; rulings 1, 2, 3, 12)
// ---------------------------------------------------------------------------

// the plain bytes of a served bundle: every file, manifest included
function servedBundleBytes(bundle) {
  return Object.values(bundle.files).reduce((total, text) => total + utf8Length(text), 0);
}

test("a frozen batch stores every file gzip-compressed and records all four values and the codec on frozen_files; the task records its batch", async () => {
  const w = await freezableScene();
  const storage = fakeStorage();
  await freezeExportBatch._handler(actionCtx(w, storage), { exportBatchId: w.batch.export_batch_id });

  const batchRow = w.row("export_batches", "export_batch_id", w.batch.export_batch_id);
  const bundle = await getExportBundle._handler(actionCtx(w, storage), { exportBatchId: w.batch.export_batch_id });
  const manifestEntries = new Map(bundle.export_manifest.files.map((entry) => [entry.filename, entry]));
  let storedTotal = 0;
  let plainTotal = 0;
  for (const entry of batchRow.frozen_files) {
    assert.equal(entry.encoding, "gzip");
    assert.deepEqual(entry.codec, BUNDLE_CODEC);
    const stored = storage._bytes(entry.storage_id);
    assert.deepEqual([...stored.subarray(0, 4)], [0x1f, 0x8b, 0x08, 0x00]);
    assert.equal(entry.stored_byte_length, stored.length);
    assert.equal(entry.stored_sha256, await sha256Hex(stored));
    // sha256 and byte_length keep describing the plain bytes, as the
    // manifest does
    if (entry.filename !== "export_manifest.json") {
      assert.equal(entry.sha256, manifestEntries.get(entry.filename).sha256);
      assert.equal(entry.byte_length, manifestEntries.get(entry.filename).byte_length);
    }
    storedTotal += entry.stored_byte_length;
    plainTotal += entry.byte_length;
  }
  assert.ok(storedTotal < plainTotal, `stored ${storedTotal} bytes should be below plain ${plainTotal}`);
  assert.equal(batchRow.pending_freeze, undefined);

  const task = w.row("tasks", "task_id", "task_1");
  assert.equal(task.status, "exported");
  assert.equal(task.last_export_batch_id, w.batch.export_batch_id);
  assert.equal(task.last_exported_at, batchRow.freeze_completed_at);
});

test("retrieval refuses stored bytes that decode to different content, or do not decode, even when the stored values were rewritten to match", async () => {
  const w = await freezableScene();
  const storage = fakeStorage();
  await freezeExportBatch._handler(actionCtx(w, storage), { exportBatchId: w.batch.export_batch_id });
  const batchRow = w.row("export_batches", "export_batch_id", w.batch.export_batch_id);
  const target = batchRow.frozen_files.find((entry) => entry.filename === "tasks.jsonl");

  // consistent substitution: other content, gzip-compressed, with the
  // stored hash and length on the row rewritten to match it
  const substitute = gzipBundleFile(utf8Bytes('{"task_id":"task_substituted"}\n'));
  storage._put(target.storage_id, substitute);
  target.stored_sha256 = await sha256Hex(substitute);
  target.stored_byte_length = substitute.length;
  await assert.rejects(
    getExportBundle._handler(actionCtx(w, storage), { exportBatchId: w.batch.export_batch_id }),
    /stored file tasks\.jsonl: decoded bytes failed verification/,
  );

  // bytes that are not gzip, with matching stored values
  const notGzip = utf8Bytes("not a gzip stream");
  storage._put(target.storage_id, notGzip);
  target.stored_sha256 = await sha256Hex(notGzip);
  target.stored_byte_length = notGzip.length;
  await assert.rejects(
    getExportBundle._handler(actionCtx(w, storage), { exportBatchId: w.batch.export_batch_id }),
    /stored file tasks\.jsonl: stored bytes do not decode as gzip/,
  );

  // an encoded entry missing its codec record
  delete target.codec;
  await assert.rejects(
    getExportBundle._handler(actionCtx(w, storage), { exportBatchId: w.batch.export_batch_id }),
    /stored file tasks\.jsonl is gzip-encoded but lacks/,
  );
});

test("a batch frozen before pr l1 (plain stored bytes, no encoding) is still served and verified as then", async () => {
  const w = await freezableScene();
  const storage = fakeStorage();
  await freezeExportBatch._handler(actionCtx(w, storage), { exportBatchId: w.batch.export_batch_id });
  const before = await getExportBundle._handler(actionCtx(w, storage), { exportBatchId: w.batch.export_batch_id });

  // rewrite the stored objects to the pre-l1 form: plain bytes, and
  // frozen_files entries carrying only the plain sha256 and length
  const batchRow = w.row("export_batches", "export_batch_id", w.batch.export_batch_id);
  for (const entry of batchRow.frozen_files) {
    const plain = utf8Bytes(new TextDecoder().decode(require_gunzip(storage._bytes(entry.storage_id))));
    storage._put(entry.storage_id, plain);
    delete entry.encoding;
    delete entry.stored_sha256;
    delete entry.stored_byte_length;
    delete entry.codec;
  }
  const after = await getExportBundle._handler(actionCtx(w, storage), { exportBatchId: w.batch.export_batch_id });
  assert.equal(after.disposition.verified, true);
  assert.deepEqual(after.files, before.files);

  // and a flipped plain byte is still refused, naming the file
  const target = batchRow.frozen_files.find((entry) => entry.byte_length > 0);
  storage._corrupt(target.storage_id);
  await assert.rejects(
    getExportBundle._handler(actionCtx(w, storage), { exportBatchId: w.batch.export_batch_id }),
    new RegExp(`stored file ${target.filename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} failed verification`),
  );
});

import { gunzipSync as require_gunzip } from "node:zlib";

test("an attempt that died after storing objects leaves a trail on pending_freeze; the next attempt carries it and discards those blobs when it commits", async () => {
  const w = await freezableScene();
  const storage = fakeStorage();
  const ctx = actionCtx(w, storage);

  // attempt A: prepared, one object stored and recorded, then the action died
  await prepareFreeze._handler(w.as(w.admin2), { exportBatchId: w.batch.export_batch_id, userId: w.admin2._id, attemptId: "attempt-dead" });
  const plain = utf8Bytes("an object the dead attempt stored\n");
  const gz = gzipBundleFile(plain);
  const deadId = await storage.store(new Blob([gz]));
  const recorded = await recordStoredObject._handler(w.as(w.admin2), {
    exportBatchId: w.batch.export_batch_id,
    attemptId: "attempt-dead",
    userId: w.admin2._id,
    filename: "tasks.jsonl",
    storageId: deadId,
    sha256: await sha256Hex(plain),
    byteLength: plain.length,
    storedSha256: await sha256Hex(gz),
    storedByteLength: gz.length,
    codec: BUNDLE_CODEC,
  });
  assert.equal(recorded, true);
  const trail = w.row("export_batches", "export_batch_id", w.batch.export_batch_id).pending_freeze.stored_objects;
  assert.equal(trail.length, 1);
  assert.equal(trail[0].attempt_id, "attempt-dead");
  assert.match(trail[0].object_key, /^objects\/sha256\/[0-9a-f]{64}\/fflate-[0-9.]+-l6\.gz$/);
  assert.equal(trail[0].codec_id, `fflate-${BUNDLE_CODEC.version}-l6`);

  // a stale attempt may not add to the trail
  assert.equal(
    await recordStoredObject._handler(w.as(w.admin2), {
      exportBatchId: w.batch.export_batch_id,
      attemptId: "attempt-other",
      userId: w.admin2._id,
      filename: "tasks.jsonl",
      storageId: deadId,
      sha256: await sha256Hex(plain),
      byteLength: plain.length,
      storedSha256: await sha256Hex(gz),
      storedByteLength: gz.length,
      codec: BUNDLE_CODEC,
    }),
    false,
  );

  const result = await freezeExportBatch._handler(ctx, { exportBatchId: w.batch.export_batch_id });
  assert.equal(result.status, "frozen");
  assert.equal(storage._has(deadId), false, "the dead attempt's blob is discarded once a later attempt commits");
  assert.equal(storage._blobCount(), 16);
  assert.equal(w.row("export_batches", "export_batch_id", w.batch.export_batch_id).pending_freeze, undefined);
});

test("a failed attempt deletes its own blobs and discards an inherited trail; the batch keeps no pending_freeze", async () => {
  const w = await freezableScene();
  const storage = fakeStorage();
  await prepareFreeze._handler(w.as(w.admin2), { exportBatchId: w.batch.export_batch_id, userId: w.admin2._id, attemptId: "attempt-dead" });
  const gz = gzipBundleFile(utf8Bytes("x\n"));
  const deadId = await storage.store(new Blob([gz]));
  await recordStoredObject._handler(w.as(w.admin2), {
    exportBatchId: w.batch.export_batch_id,
    attemptId: "attempt-dead",
    userId: w.admin2._id,
    filename: "tasks.jsonl",
    storageId: deadId,
    sha256: await sha256Hex(utf8Bytes("x\n")),
    byteLength: 2,
    storedSha256: await sha256Hex(gz),
    storedByteLength: gz.length,
    codec: BUNDLE_CODEC,
  });

  storage._corruptNextGet();
  await assert.rejects(
    freezeExportBatch._handler(actionCtx(w, storage), { exportBatchId: w.batch.export_batch_id }),
    /did not verify on read-back: Stored file .*: stored bytes failed verification/,
  );
  assert.equal(storage._blobCount(), 0);
  const batchRow = w.row("export_batches", "export_batch_id", w.batch.export_batch_id);
  assert.equal(batchRow.status, "draft");
  assert.equal(batchRow.pending_freeze, undefined);
  assert.ok(batchRow.last_freeze_failure);
});

// budget and composition fixtures: tasks whose rows carry a padded brief, so
// a handful of them fill a batch
async function paddedAcceptedTasks(w, count, { briefBytes = 40_000, prefix = "bulk" } = {}) {
  const ids = [];
  for (let index = 0; index < count; index += 1) {
    const taskId = `${prefix}_${String(index).padStart(3, "0")}`;
    await w.addTask({ task_id: taskId, country_code: "VU", status: "in_progress", task_brief: "b".repeat(briefBytes) });
    await w.addDraft({ evidence_draft_id: `${taskId}:draft_a`, task_id: taskId, created_by: w.ra._id });
    await reviewAndAccept(w, { taskId, evidenceDraftId: `${taskId}:draft_a`, pi: w.pi });
    ids.push(taskId);
  }
  return ids;
}

async function budgetScene() {
  const w = await scene({ country: "VU" });
  const pi = await w.addUser("pi-subject", ["pi"]);
  const admin2 = await w.addUser("admin-subject-2", ["admin"]);
  return Object.assign(w, { pi, admin2 });
}

test("createExportBatch refuses an explicit list or an automatic selection over one batch's budget, naming the task that breaks it and the composer", async () => {
  const w = await budgetScene();
  const ids = await paddedAcceptedTasks(w, 60, { briefBytes: 60_000 });

  await assert.rejects(
    createExportBatch._handler(w.as(w.admin2), { countryCode: "VU", taskIds: ids }),
    /named tasks exceed one export batch's budget \(\d+ (bundle bytes, above the 6291456-byte budget|bytes read, above the 10485760 budget) by task bulk_\d+\); name fewer tasks per batch, or compose the country with exports:composeExportBatches/,
  );
  await assert.rejects(
    createExportBatch._handler(w.as(w.admin2), { countryCode: "VU" }),
    /VU's pi_accepted tasks exceed one export batch's budget .*composeExportBatches/,
  );
  assert.equal(w.rows.export_batches.length, 0);

  // a list within budget is created, carrying its estimate
  const created = await createExportBatch._handler(w.as(w.admin2), { countryCode: "VU", taskIds: ids.slice(0, 5) });
  const batchRow = w.row("export_batches", "export_batch_id", created.export_batch_id);
  assert.ok(batchRow.estimated_bytes > 5 * 60_000 && batchRow.estimated_bytes <= EXPORT_BATCH_BYTE_BUDGET);
  assert.ok(batchRow.estimated_index_ranges > 0 && batchRow.estimated_documents > 0);

  // and the estimate bounds what the freeze actually builds
  const storage = fakeStorage();
  await freezeExportBatch._handler(actionCtx(w, storage), { exportBatchId: created.export_batch_id });
  const bundle = await getExportBundle._handler(actionCtx(w, storage), { exportBatchId: created.export_batch_id });
  const actual = servedBundleBytes(bundle);
  assert.ok(actual <= batchRow.estimated_bytes, `built ${actual} bytes, estimated ${batchRow.estimated_bytes}`);
  assert.ok(batchRow.estimated_bytes - actual < 16 * 1024, `estimate ${batchRow.estimated_bytes} should be within 16 KiB of ${actual}`);
});

// an oversized history made of valid-sized rows: note events at the task
// reason limit (2,048 characters), more of them than one batch may read
async function addNoteHistory(w, taskId, count) {
  for (let index = 0; index < count; index += 1) {
    await appendTaskEvent(w.ctx, {
      taskId,
      eventType: "note_added",
      actorUserId: w.admin2._id,
      actorRole: "admin",
      reason: `${index} `.padEnd(2_048, "n"),
    });
  }
}

test("a task whose valid-sized history alone exceeds the read budget is refused by name, and the read stops within one row of the budget", async () => {
  const w = await budgetScene();
  const [big] = await paddedAcceptedTasks(w, 1, { briefBytes: 100, prefix: "history" });
  await addNoteHistory(w, big, 5_000);
  await assert.rejects(
    createExportBatch._handler(w.as(w.admin2), { countryCode: "VU", taskIds: [big] }),
    /Task history_000: its rows alone exceed the batch read budget on bytes \(more than 10485760\)/,
  );
  await assert.rejects(
    createExportBatch._handler(w.as(w.admin2), { countryCode: "VU", taskIds: Array.from({ length: 501 }, (_, i) => `t${i}`) }),
    /at most 500 tasks/,
  );

  // the composer records the refusal and composes the rest; no step reads
  // past its transaction ceiling
  await paddedAcceptedTasks(w, 3, { briefBytes: 1_000, prefix: "small" });
  const storage = fakeStorage();
  w.useStorage(storage);
  await composeExportBatches._handler(w.as(w.admin2), { countryCode: "VU" });
  await w.drainScheduled(storage);
  const run = await getExportRun._handler(w.as(w.admin2), { countryCode: "VU" });
  assert.equal(run.status, "composed");
  assert.equal(run.stalled, false);
  assert.equal(run.refused_count, 1);
  assert.equal(run.member_count, 3);
  assert.match(run.refusals[0].reason, /Task history_000: its rows alone exceed the batch read budget/);
});

test("the read meter stops a streamed read within one document of its limit and closes the query", async () => {
  const { meteredCtx, newMeter, ReadBudgetExceeded } = await import("./lib/readMeter.ts");
  const w = await budgetScene();
  await addNoteHistory(w, "task_1", 100);
  let closed = false;
  const realQuery = w.ctx.db.query.bind(w.ctx.db);
  const ctx = {
    ...w.ctx,
    db: {
      ...w.ctx.db,
      query(table) {
        const chain = realQuery(table);
        const iterate = chain[Symbol.asyncIterator].bind(chain);
        chain[Symbol.asyncIterator] = () => {
          const iterator = iterate();
          return { next: () => iterator.next(), return: async (value) => { closed = true; return iterator.return(value); } };
        };
        return chain;
      },
    },
  };
  const meter = newMeter("task", { bytes: 20 * 1024, documents: 1_000, index_ranges: 10 });
  const metered = meteredCtx(ctx, meter);
  await assert.rejects(
    metered.db.query("task_events").withIndex("by_task_time", (q) => q.eq("task_id", "task_1")).collect(),
    (error) => error instanceof ReadBudgetExceeded && error.meter === "task" && error.dimension === "bytes",
  );
  // each note row is a little over 2 KB: the read stopped at the row that
  // crossed 20 KiB, not after all 100
  assert.ok(meter.counts.documents <= 10, `read ${meter.counts.documents} rows`);
  assert.equal(closed, true);
});

// the composer and the scheduled freeze chain, on a 200-task country
test("composeExportBatches cuts a 200-task country into budgeted batches that cover every task once; the scheduled chain freezes them all", async () => {
  const w = await budgetScene();
  const ids = await paddedAcceptedTasks(w, 200);
  // a training-excluded accepted task never enters a run
  await w.addTask({
    task_id: "training_1",
    country_code: "VU",
    status: "pi_accepted",
    source_context: { training: { exclude_from_exports: true } },
  });

  const storage = fakeStorage();
  w.useStorage(storage);
  const composed = await composeExportBatches._handler(w.as(w.admin2), { countryCode: "VU" });
  const composeSteps = await w.drainScheduled(storage);
  assert.ok(composeSteps > 3, `expected several bounded composition steps, got ${composeSteps}`);

  const run = await getExportRun._handler(w.as(w.admin2), { countryCode: "VU" });
  assert.equal(run.run_id, composed.run_id);
  assert.equal(run.status, "composed");
  assert.equal(run.phase, "done");
  assert.equal(run.member_count, 200);
  assert.equal(run.refused_count, 0);
  assert.equal(run.lease, undefined);

  const batches = w.rows.export_batches.filter((row) => row.export_run_id === run.run_id);
  assert.equal(batches.length, run.batch_count);
  assert.ok(batches.length >= 3, `expected the 200 tasks in several batches, got ${batches.length}`);
  const covered = batches.flatMap((batch) => batch.included_task_ids);
  assert.deepEqual([...covered].sort(), [...ids].sort());
  assert.equal(new Set(covered).size, covered.length, "no task is in two batches");
  for (const batch of batches) {
    assert.equal(batch.status, "draft");
    assert.ok(batch.estimated_bytes <= EXPORT_BATCH_BYTE_BUDGET);
    assert.ok(batch.estimated_documents <= EXPORT_BATCH_READ_BUDGET.documents);
    assert.ok(batch.estimated_index_ranges <= EXPORT_BATCH_READ_BUDGET.index_ranges);
  }
  // membership is captured per task, with the authority pins
  const members = w.rows.export_run_members.filter((row) => row.run_id === run.run_id);
  assert.equal(members.length, 200);
  for (const member of members) {
    assert.ok(member.export_batch_id);
    assert.match(member.evidence_version_hash, /^sha256:/);
    assert.match(member.review_snapshot_hash ?? "", /^[0-9a-f]{64}$|^sha256:/);
  }

  // a task accepted after composition waits for the next run
  await paddedAcceptedTasks(w, 1, { prefix: "late" });

  w.as(w.admin2);
  const first = await freezeCountryBatches._handler(actionCtx(w, storage), { countryCode: "VU" });
  assert.equal(first.status, "frozen");
  const chainSteps = await w.drainScheduled(storage);
  assert.equal(chainSteps, batches.length, "one scheduled invocation per remaining batch, plus the one that finds none left");

  const finished = await getExportRun._handler(w.as(w.admin2), { runId: run.run_id });
  assert.equal(finished.status, "completed");
  assert.equal(finished.frozen_batch_count, batches.length);
  assert.equal(finished.lease, undefined);
  for (const taskId of ids) {
    const task = w.row("tasks", "task_id", taskId);
    assert.equal(task.status, "exported");
    const batch = batches.find((row) => row.included_task_ids.includes(taskId));
    assert.equal(task.last_export_batch_id, batch.export_batch_id);
  }
  assert.equal(w.row("tasks", "task_id", "late_000").status, "pi_accepted");
  assert.equal(w.row("tasks", "task_id", "training_1").status, "pi_accepted");

  // every frozen batch serves verified bytes within the budget and its estimate
  for (const batch of batches) {
    const bundle = await getExportBundle._handler(actionCtx(w, storage), { exportBatchId: batch.export_batch_id });
    assert.equal(bundle.disposition.verified, true);
    const row = w.row("export_batches", "export_batch_id", batch.export_batch_id);
    const actual = servedBundleBytes(bundle);
    assert.ok(actual <= row.estimated_bytes && row.estimated_bytes <= EXPORT_BATCH_BYTE_BUDGET, `${actual} <= ${row.estimated_bytes}`);
    // the exported events name the run's curator
    const exported = w.events("exported").filter((event) => event.export_batch_id === batch.export_batch_id);
    assert.equal(exported.length, batch.included_task_ids.length);
    assert.ok(exported.every((event) => event.actor_user_id === w.admin2._id));
  }
});

test("the run lock refuses a second composition or a second chain while a lease is live; a later composition replaces a stopped run and archives its drafts", async () => {
  const w = await budgetScene();
  await paddedAcceptedTasks(w, 40, { briefBytes: 120_000 });
  const storage = fakeStorage();
  w.useStorage(storage);

  await composeExportBatches._handler(w.as(w.admin2), { countryCode: "VU" });
  await assert.rejects(composeExportBatches._handler(w.as(w.admin2), { countryCode: "VU" }), /is still composing/);
  await assert.rejects(
    freezeCountryBatches._handler(actionCtx(w, storage), { countryCode: "VU" }),
    /is still composing/,
  );
  await w.drainScheduled(storage);
  const run = await getExportRun._handler(w.as(w.admin2), { countryCode: "VU" });
  assert.equal(run.status, "composed");
  assert.ok(run.batch_count >= 2);

  // freeze the first batch, then drift one task of a later batch: reopen,
  // re-review, and re-accept it on a new draft, so its batch no longer
  // matches what the run captured
  w.as(w.admin2);
  await freezeCountryBatches._handler(actionCtx(w, storage), { countryCode: "VU" });
  const later = w.rows.export_batches.filter((row) => row.export_run_id === run.run_id && row.status === "draft");
  const driftTask = later[0].included_task_ids[0];
  await reacceptTask(w, driftTask, `${driftTask}:draft_b`);
  w.as(w.admin2);
  const errors = [];
  await w.drainScheduled(storage, { onError: (error) => errors.push(error.message) });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /membership changed since it was created/);

  const stopped = await getExportRun._handler(w.as(w.admin2), { countryCode: "VU" });
  assert.equal(stopped.status, "stopped");
  assert.equal(stopped.last_error.export_batch_id, later[0].export_batch_id);
  assert.equal(stopped.frozen_batch_count, 1);
  const failedBatch = w.row("export_batches", "export_batch_id", later[0].export_batch_id);
  assert.equal(failedBatch.status, "draft");
  assert.match(failedBatch.last_freeze_failure.reason, /membership changed/);

  // a curator re-run resumes and stops again on the same batch (never skips it)
  w.as(w.admin2);
  await assert.rejects(freezeCountryBatches._handler(actionCtx(w, storage), { countryCode: "VU" }), /membership changed/);

  // a new composition replaces the stopped run and archives its drafts
  const again = await composeExportBatches._handler(w.as(w.admin2), { countryCode: "VU" });
  assert.equal(again.replaced_run_id, run.run_id);
  // the replaced run is marked at once; its drafts are archived by the new
  // run's scheduled steps
  assert.equal(w.row("export_runs", "run_id", run.run_id).status, "replaced");
  await w.drainScheduled(storage);
  assert.equal(w.row("export_runs", "run_id", again.run_id).archived_batch_count, run.batch_count - 1);
  const archived = w.row("export_batches", "export_batch_id", later[0].export_batch_id);
  assert.equal(archived.status, "archived");
  assert.match(archived.archived_reason, new RegExp(again.run_id));
  const archivedBundle = await getExportBundle._handler(actionCtx(w, storage), { exportBatchId: archived.export_batch_id });
  assert.equal(archivedBundle.disposition.status, "archived");
  assert.equal(archivedBundle.disposition.legacy_unfrozen_bytes, undefined);
  await assert.rejects(freezeExportBatch._handler(actionCtx(w, storage), { exportBatchId: archived.export_batch_id }), /belongs to export run .*freezeCountryBatches/);

  await w.drainScheduled(storage);
  const second = await getExportRun._handler(w.as(w.admin2), { countryCode: "VU" });
  assert.equal(second.status, "composed");
  // the tasks already exported by the first batch are not pi_accepted any
  // more; everything else, the re-accepted task included, is in the new run
  const exportedCount = w.rows.tasks.filter((task) => task.status === "exported").length;
  assert.equal(second.member_count, 40 - exportedCount);
  w.as(w.admin2);
  await freezeCountryBatches._handler(actionCtx(w, storage), { countryCode: "VU" });
  await w.drainScheduled(storage);
  assert.equal((await getExportRun._handler(w.as(w.admin2), { countryCode: "VU" })).status, "completed");
  assert.equal(w.rows.tasks.filter((task) => task.task_id.startsWith("bulk_") && task.status !== "exported").length, 0);
});

test("a run batch whose captured authority pin no longer matches is refused at freeze; a curator who lost the role stops the chain", async () => {
  const w = await budgetScene();
  await paddedAcceptedTasks(w, 30, { briefBytes: 120_000 });
  const storage = fakeStorage();
  w.useStorage(storage);
  await composeExportBatches._handler(w.as(w.admin2), { countryCode: "VU" });
  await w.drainScheduled(storage);
  const run = await getExportRun._handler(w.as(w.admin2), { countryCode: "VU" });

  const member = w.rows.export_run_members.find((row) => row.run_id === run.run_id && row.seq === 0);
  member.evidence_version_hash = "sha256:" + "0".repeat(64);
  w.as(w.admin2);
  await assert.rejects(
    freezeCountryBatches._handler(actionCtx(w, storage), { countryCode: "VU" }),
    new RegExp(`task ${member.task_id}'s export authority changed since run ${run.run_id} captured it`),
  );

  // repair the pin, resume, then demote the run's curator before the next step
  member.evidence_version_hash = w.row("evidence_drafts", "task_id", member.task_id).evidence_version_hash;
  w.as(w.admin2);
  await freezeCountryBatches._handler(actionCtx(w, storage), { countryCode: "VU" });
  await w.db.patch(w.admin2._id, { roles: ["reviewer"] });
  await w.drainScheduled(storage);
  const stopped = await getExportRun._handler(w.as(w.admin), { countryCode: "VU" });
  assert.equal(stopped.status, "stopped");
  assert.match(stopped.last_error.reason, /no longer an active curator or admin/);
  assert.equal(stopped.frozen_batch_count, 1);

  // another curator resumes, and the chain finishes under that curator
  w.as(w.admin);
  await freezeCountryBatches._handler(actionCtx(w, storage), { countryCode: "VU" });
  await w.drainScheduled(storage);
  const done = await getExportRun._handler(w.as(w.admin), { countryCode: "VU" });
  assert.equal(done.status, "completed");
  assert.equal(done.freeze_actor, w.admin._id);
});

// ---------------------------------------------------------------------------
// review of pr #149 (gpt-6-astra, the convex reviewer, greptile), 2026-09-24
// ---------------------------------------------------------------------------

async function composeAndDrain(w, storage, countryCode = "VU") {
  w.useStorage(storage);
  const composed = await composeExportBatches._handler(w.as(w.admin2), { countryCode });
  const steps = await w.drainScheduled(storage);
  const run = await getExportRun._handler(w.as(w.admin2), { runId: composed.run_id });
  return { run, steps, composed };
}

test("A2: training-excluded and large candidate rows are charged to each step's budget, so composition proceeds in bounded steps", async () => {
  const w = await budgetScene();
  for (let index = 0; index < 300; index += 1) {
    await w.addTask({
      task_id: `excluded_${String(index).padStart(3, "0")}`,
      country_code: "VU",
      status: "pi_accepted",
      task_brief: "e".repeat(40_000),
      source_context: { training: { exclude_from_exports: true } },
    });
  }
  await paddedAcceptedTasks(w, 2, { prefix: "kept" });
  const { run, steps } = await composeAndDrain(w, fakeStorage());
  // 300 rows of 40 KB are 12 MB: several pages of at most 1 MiB, several
  // steps of at most 3 MiB, where one unmetered invocation used to read them all
  assert.ok(steps >= 5, `expected several bounded steps, got ${steps}`);
  assert.equal(run.status, "composed");
  assert.equal(run.member_count, 2);
  assert.equal(run.refused_count, 0);
});

test("A3: tasks sharing one creation time are never skipped, by automatic selection or by the composer", async () => {
  const tie = async (count) => {
    const w = await budgetScene();
    const ids = await paddedAcceptedTasks(w, count, { briefBytes: 100, prefix: "tied" });
    const tied = w.rows.tasks.filter((task) => ids.includes(task.task_id));
    for (const task of tied) task._creationTime = tied[0]._creationTime;
    return { w, ids };
  };
  // 60 tied tasks: more than the old 32-task page, within one batch
  const small = await tie(60);
  const batch = await createExportBatch._handler(small.w.as(small.w.admin2), { countryCode: "VU" });
  assert.equal(batch.included_task_count, 60);

  // 150 tied tasks: more than one 64-task candidate page
  const { w, ids } = await tie(150);
  const { run } = await composeAndDrain(w, fakeStorage());
  assert.equal(run.member_count, 150);
  const members = w.rows.export_run_members.filter((row) => row.run_id === run.run_id).map((row) => row.task_id);
  assert.deepEqual([...members].sort(), [...ids].sort());
});

test("A4: replacing a run with many drafts marks it replaced at once and archives the drafts in bounded steps under the new run's lock", async () => {
  const w = await budgetScene();
  const storage = fakeStorage();
  await paddedAcceptedTasks(w, 1, { prefix: "one" });
  const { run } = await composeAndDrain(w, storage);
  // 45 further drafts belonging to the first run
  for (let index = 0; index < 45; index += 1) {
    await w.db.insert("export_batches", {
      export_batch_id: `vu-extra-draft-${index}`,
      country_code: "VU",
      status: "draft",
      created_by: w.admin2._id,
      created_at: Date.now(),
      included_task_ids: [],
      included_review_decision_ids: [],
      schema_version: "convex-task-layer.v0.1",
      export_format: "bundle",
      export_run_id: run.run_id,
    });
  }
  const composed = await composeExportBatches._handler(w.as(w.admin2), { countryCode: "VU" });
  assert.equal(w.row("export_runs", "run_id", run.run_id).status, "replaced");
  // the country stays locked while the new run archives
  await assert.rejects(composeExportBatches._handler(w.as(w.admin2), { countryCode: "VU" }), /is still composing/);
  // one bounded archiving step at a time
  const first = w.scheduled.shift();
  const { composeRunStep } = await import("./exports.ts");
  await composeRunStep._handler(w.anonymous(), first.args);
  assert.equal(w.rows.export_batches.filter((row) => row.export_run_id === run.run_id && row.status === "archived").length, 20);
  await w.drainScheduled(storage);
  const replacement = w.row("export_runs", "run_id", composed.run_id);
  assert.equal(replacement.archived_batch_count, 46);
  assert.equal(replacement.status, "composed");
  assert.equal(w.rows.export_batches.filter((row) => row.export_run_id === run.run_id && row.status === "draft").length, 0);
});

test("A5: a batch committed but never settled is counted, because completion records the run's progress; the resumed run completes with the right count", async () => {
  const w = await budgetScene();
  await paddedAcceptedTasks(w, 30, { briefBytes: 120_000 });
  const storage = fakeStorage();
  const { run } = await composeAndDrain(w, storage);
  assert.ok(run.batch_count >= 2);

  w.as(w.admin2);
  const ctx = actionCtx(w, storage);
  const dispatch = ctx.runMutation.bind(ctx);
  ctx.runMutation = async (ref, args) => {
    if (args.outcome === "frozen") throw new Error("settle lost");
    return dispatch(ref, args);
  };
  await assert.rejects(freezeCountryBatches._handler(ctx, { countryCode: "VU" }), /settle lost/);
  const afterCommit = w.row("export_runs", "run_id", run.run_id);
  assert.equal(afterCommit.frozen_batch_count, 1);
  assert.equal((await getExportRun._handler(w.as(w.admin2), { runId: run.run_id })).stalled, false);

  // the orphaned lease lapses; a curator resumes
  afterCommit.lease.expires_at = Date.now() - 1;
  assert.equal((await getExportRun._handler(w.as(w.admin2), { runId: run.run_id })).stalled, true);
  w.as(w.admin2);
  await freezeCountryBatches._handler(actionCtx(w, storage), { countryCode: "VU" });
  await w.drainScheduled(storage);
  const done = w.row("export_runs", "run_id", run.run_id);
  assert.equal(done.status, "completed");
  assert.equal(done.frozen_batch_count, run.batch_count);
});

test("#3: between one batch and the next the run holds a hand-off lease, so no second chain or composition can start in the gap", async () => {
  const w = await budgetScene();
  await paddedAcceptedTasks(w, 30, { briefBytes: 120_000 });
  const storage = fakeStorage();
  await composeAndDrain(w, storage);
  w.as(w.admin2);
  await freezeCountryBatches._handler(actionCtx(w, storage), { countryCode: "VU" });
  const run = await getExportRun._handler(w.as(w.admin2), { countryCode: "VU" });
  assert.equal(run.lease.holder, "chain-handoff");
  assert.equal(run.stalled, false);
  w.as(w.admin2);
  await assert.rejects(freezeCountryBatches._handler(actionCtx(w, storage), { countryCode: "VU" }), /already freezing/);
  await assert.rejects(composeExportBatches._handler(w.as(w.admin2), { countryCode: "VU" }), /is still freezing/);
  await w.drainScheduled(storage);
  assert.equal((await getExportRun._handler(w.as(w.admin2), { countryCode: "VU" })).status, "completed");
});

test("#4, #5: a freeze step with an identity acts only for that user, and a run's batch is frozen only through its chain", async () => {
  const w = await budgetScene();
  await paddedAcceptedTasks(w, 2);
  const storage = fakeStorage();
  const { run } = await composeAndDrain(w, storage);
  const runBatch = w.rows.export_batches.find((row) => row.export_run_id === run.run_id);

  await assert.rejects(
    prepareFreeze._handler(w.as(w.admin2), { exportBatchId: runBatch.export_batch_id, userId: w.admin._id, attemptId: "a" }),
    /may act only for that identity's own user/,
  );
  await assert.rejects(
    prepareFreeze._handler(w.as(w.admin2), { exportBatchId: runBatch.export_batch_id, userId: w.admin2._id, attemptId: "a" }),
    /belongs to export run .*freezeCountryBatches/,
  );
  await assert.rejects(
    prepareFreeze._handler(w.as(w.admin2), { exportBatchId: runBatch.export_batch_id, userId: w.admin2._id, attemptId: "a", runLeaseHolder: "forged" }),
    /belongs to export run/,
  );
  w.as(w.admin2);
  await assert.rejects(
    freezeExportBatch._handler(actionCtx(w, storage), { exportBatchId: runBatch.export_batch_id }),
    /belongs to export run .*freezeCountryBatches/,
  );
  assert.equal(w.row("export_batches", "export_batch_id", runBatch.export_batch_id).last_freeze_failure, undefined);
});

test("#7: the batch row budget bounds the id lists a batch stores", async () => {
  const w = await budgetScene();
  const longIds = [];
  for (let index = 0; index < 40; index += 1) {
    const taskId = `long_${index}_${"x".repeat(4_000)}`;
    await w.addTask({ task_id: taskId, country_code: "VU", status: "pi_accepted" });
    longIds.push(taskId);
  }
  await assert.rejects(
    createExportBatch._handler(w.as(w.admin2), { countryCode: "VU", taskIds: longIds }),
    /batch row bytes, above the 262144-byte row budget/,
  );
});

test("#8: completion refuses stored files that are not exactly this attempt's recorded bundle files", async () => {
  const w = await freezableScene();
  const storage = fakeStorage();
  const prepared = await prepareFreeze._handler(w.as(w.admin2), { exportBatchId: w.batch.export_batch_id, userId: w.admin2._id, attemptId: "attempt-c" });
  const stored = await storeAttempt(w, storage, { ...prepared, exportBatchId: w.batch.export_batch_id }, "attempt-c");
  const complete = (storedFiles) =>
    completeFreeze._handler(w.as(w.admin2), { exportBatchId: w.batch.export_batch_id, attemptId: "attempt-c", userId: w.admin2._id, storedFiles });

  await assert.rejects(complete(stored.slice(1)), /names 15 stored files, but the bundle has 16/);
  await assert.rejects(complete([stored[0], ...stored.slice(0, 15)]), /distinct files/);
  const swapped = stored.map((file, index) => (index === 0 ? { ...file, storageId: stored[1].storageId } : file));
  await assert.rejects(complete(swapped), /is not on this attempt's stored-object trail/);
  const wrongHash = stored.map((file, index) => (index === 0 ? { ...file, sha256: "0".repeat(64) } : file));
  await assert.rejects(complete(wrongHash), /does not match the captured bundle/);
  const plain = stored.map((file, index) => (index === 0 ? { ...file, encoding: undefined } : file));
  await assert.rejects(complete(plain), /lacks its gzip encoding/);
  assert.equal((await complete(stored)).status, "frozen");
});

test("#11: a batch whose bundle grew past the budget plus the capture tolerance is refused at capture by name", async () => {
  const w = await freezableScene();
  const storage = fakeStorage();
  await appendTaskEvent(w.ctx, { taskId: "task_1", eventType: "note_added", actorUserId: w.admin2._id, actorRole: "admin", reason: "A note enlarged below." });
  const note = w.events("note_added").at(-1);
  await w.ctx.db.patch(note._id, { reason: "x".repeat(8 * 1024 * 1024) });
  w.as(w.admin2);
  await assert.rejects(
    freezeExportBatch._handler(actionCtx(w, storage), { exportBatchId: w.batch.export_batch_id }),
    new RegExp(`Export batch ${w.batch.export_batch_id}: its bundle is \\d+ bytes, above the 6291456-byte budget plus the 1048576-byte capture tolerance`),
  );
  assert.equal(storage._blobCount(), 0);
  assert.equal(w.row("export_batches", "export_batch_id", w.batch.export_batch_id).status, "draft");
});

test("#12: a task named twice enters the batch once", async () => {
  const w = await freezableScene();
  await acceptSecondTask(w);
  const batch = await createExportBatch._handler(w.as(w.admin2), { countryCode: "VU", taskIds: ["task_2", "task_1", "task_2"] });
  assert.equal(batch.included_task_count, 2);
  assert.deepEqual(w.row("export_batches", "export_batch_id", batch.export_batch_id).included_task_ids, ["task_1", "task_2"]);
});

// review of pr #149, round 2 (gpt-6-astra, 2026-09-24)

test("round 2, 1: the cutting phase streams member rows through the meter and stops at a batch boundary, so large member rows never make one step read tens of MiB", async () => {
  const { composeRunStep, CUT_STEP_READ_BUDGET } = await import("./exports.ts");
  const w = await budgetScene();
  const now = Date.now();
  const runId = "vu-export-run-cutting";
  await w.db.insert("export_runs", {
    run_id: runId,
    country_code: "VU",
    status: "composing",
    started_by: w.admin2._id,
    started_at: now,
    phase: "cutting",
    next_member_seq: 600,
    member_count: 600,
    refused_count: 0,
    refusals: [],
    batch_count: 0,
    frozen_batch_count: 0,
    estimated_bytes: 0,
    lease: { holder: "compose", expires_at: now + 60_000 },
  });
  // composer-shaped members about 29 KB each (a task with many accepted
  // decisions and acceptances): 600 of them are 17 MB
  const ids = (prefix, count) => Array.from({ length: count }, (_, index) => `${prefix}:${String(index).padStart(3, "0")}:${"d".repeat(80)}`);
  for (let seq = 0; seq < 600; seq += 1) {
    await w.db.insert("export_run_members", {
      run_id: runId,
      seq,
      task_id: `member_${seq}`,
      review_decision_ids: ids(`member_${seq}:review`, 160),
      acceptance_ids: ids(`member_${seq}:acceptance`, 160),
      estimated_bytes: 20_000,
      estimated_row_bytes: 58_000,
      estimated_read_bytes: 40_000,
      estimated_documents: 20,
      estimated_index_ranges: 20,
    });
  }
  const memberBytes = Buffer.byteLength(JSON.stringify(w.rows.export_run_members[0]));
  assert.ok(memberBytes > 25_000 && memberBytes < 35_000, `member rows are ${memberBytes} bytes`);

  // count the member bytes each step streams
  let streamed = 0;
  const query = w.db.query.bind(w.db);
  w.db.query = (table) => {
    const chain = query(table);
    if (table !== "export_run_members") return chain;
    const iterate = chain[Symbol.asyncIterator].bind(chain);
    chain[Symbol.asyncIterator] = () => {
      const iterator = iterate();
      return {
        async next() {
          const step = await iterator.next();
          if (!step.done) streamed += Buffer.byteLength(JSON.stringify(step.value));
          return step;
        },
        return: (value) => iterator.return(value),
      };
    };
    // materialising reads are counted too, so an unmetered take() fails here
    for (const method of ["take", "collect"]) {
      const read = chain[method].bind(chain);
      chain[method] = async (...args) => {
        const rows = await read(...args);
        for (const row of rows) streamed += Buffer.byteLength(JSON.stringify(row));
        return rows;
      };
    }
    const withIndex = chain.withIndex.bind(chain);
    chain.withIndex = (...args) => { withIndex(...args); return chain; };
    return chain;
  };
  let steps = 0;
  let largest = 0;
  await composeRunStep._handler(w.anonymous(), { runId });
  for (;;) {
    steps += 1;
    largest = Math.max(largest, streamed);
    streamed = 0;
    const next = w.scheduled.shift();
    if (next === undefined) break;
    await composeRunStep._handler(w.anonymous(), next.args);
  }
  w.db.query = query;
  // each step stops at the first batch boundary past 3 MiB, one batch (at
  // most four such members) past it at worst
  assert.ok(largest <= CUT_STEP_READ_BUDGET.bytes + 5 * memberBytes, `a step streamed ${largest} bytes`);
  assert.ok(steps >= 5, `expected several cutting steps, got ${steps}`);

  const run = w.row("export_runs", "run_id", runId);
  assert.equal(run.status, "composed");
  const batches = w.rows.export_batches.filter((row) => row.export_run_id === runId);
  const covered = batches.flatMap((row) => row.included_task_ids);
  assert.equal(covered.length, 600);
  assert.equal(new Set(covered).size, 600);
  assert.ok(batches.every((row) => row.included_task_ids.length <= 4), "the row budget caps these batches at four members");
});

test("round 2, 2: starting or resuming a chain takes the run's lease in the same transaction, so no composition can replace the run before the first claim", async () => {
  const { startRunFreeze, claimRunBatch } = await import("./exports.ts");
  const w = await budgetScene();
  await paddedAcceptedTasks(w, 2);
  const storage = fakeStorage();
  const { run } = await composeAndDrain(w, storage);

  await startRunFreeze._handler(w.as(w.admin2), { countryCode: "VU", userId: w.admin2._id, holder: "starting-holder" });
  const started = w.row("export_runs", "run_id", run.run_id);
  assert.equal(started.status, "freezing");
  assert.equal(started.lease.holder, "starting-holder");
  assert.ok(started.lease.expires_at > Date.now());

  // the interval before the action's first claim: a composition is refused
  await assert.rejects(composeExportBatches._handler(w.as(w.admin2), { countryCode: "VU" }), /is still freezing/);
  await assert.rejects(
    startRunFreeze._handler(w.as(w.admin2), { countryCode: "VU", userId: w.admin2._id, holder: "other" }),
    /already freezing/,
  );
  // another invocation cannot claim, the starting one can
  assert.equal((await claimRunBatch._handler(w.anonymous(), { runId: run.run_id, holder: "other" })).kind, "busy");
  assert.equal((await claimRunBatch._handler(w.anonymous(), { runId: run.run_id, holder: "starting-holder" })).kind, "batch");
});
