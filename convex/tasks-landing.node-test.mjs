import assert from "node:assert/strict";
import fs from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";

registerHooks({ resolve(specifier, context, nextResolve) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) { for (const ext of [".js", ".ts"]) { const candidate = new URL(`${specifier}${ext}`, context.parentURL); if (fs.existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context); } } return nextResolve(specifier, context); } });
const { listTasks, listMyTasks, raLanding, raTaskRow } = await import("./tasks.ts");

// a small in-memory db: withIndex records the eq() constraints and the
// terminal calls filter on them, so the handlers read what a real index would
function makeDb(rows) {
  function query(table) {
    return {
      withIndex(_index, select) {
        const constraints = [];
        const q = { eq(field, value) { constraints.push([field, value]); return q; } };
        if (select) select(q);
        const matching = () => (rows[table] ?? []).filter((row) => constraints.every(([field, value]) => row[field] === value));
        return {
          async unique() { const found = matching(); if (found.length > 1) throw new Error("not unique"); return found[0] ?? null; },
          async collect() { return matching(); },
          async take(n) { return matching().slice(0, n); },
          async first() { return matching()[0] ?? null; },
        };
      },
    };
  }
  return { query };
}

const task = (id, over = {}) => ({
  _id: `task_row_${id}`, _creationTime: Number(id.replace(/\D/g, "")) || 1, task_id: id, batch_id: "nz-batch", country_code: "NZ",
  status: "open", name: `Site ${id}`, priority: "medium", created_at: 1, updated_at: 10, ...over,
});

function fixture() {
  const users = [
    { _id: "ra_1", auth_subject: "s-ra1", status: "active", roles: ["ra"] },
    { _id: "ra_2", auth_subject: "s-ra2", status: "active", roles: ["ra"] },
    { _id: "rev_1", auth_subject: "s-rev", status: "active", roles: ["reviewer"] },
    { _id: "adm_1", auth_subject: "s-adm", status: "active", roles: ["admin"] },
    { _id: "inv_1", auth_subject: "s-inv", status: "invited", roles: ["ra"] },
    { _id: "svc_1", auth_subject: "s-svc", status: "active", roles: ["service"] },
  ];
  const rows = {
    users,
    task_batches: [
      { batch_id: "nz-batch", country_code: "NZ", status: "active" },
      { batch_id: "nz-draft-batch", country_code: "NZ", status: "draft" },
      { batch_id: "manual-nz", country_code: "NZ", status: "active" },
    ],
    tasks: [
      task("t1", { assigned_to: "ra_1", status: "in_progress", updated_at: 30, last_event_at: 30 }),
      task("t2", { assigned_to: "ra_2", status: "needs_review", updated_at: 20 }),
      task("t3"),
      task("t4", { batch_id: "nz-draft-batch" }),
      task("t5", { batch_id: "manual-nz", assigned_to: "ra_1", status: "needs_review", updated_at: 40 }),
      task("t6", { country_code: "VU" }),
      task("t7", { assigned_to: "ra_1", status: "changes_requested", updated_at: 50, pending_reviewer_comment: "Which year?" }),
    ],
    evidence_drafts: [
      // ra_2 drafted t2; ra_1 drafted t1 and t5, and has an older draft on t1
      { _id: "d0", _creationTime: 1, evidence_draft_id: "d0", task_id: "t1", draft_status: "draft", created_by: "ra_1", created_at: 1, updated_at: 1, action: "confirm_existing" },
      { _id: "d1", _creationTime: 2, evidence_draft_id: "d1", task_id: "t1", draft_status: "submitted", created_by: "ra_1", created_at: 2, updated_at: 3, action: "confirm_existing", source_title: "Council register", source_url_or_file: "https://example.org/private", observation_notes: "long private note", locations_text: "x", target_year_statuses: { 1990: "open" } },
      { _id: "d2", _creationTime: 3, evidence_draft_id: "d2", task_id: "t2", draft_status: "submitted", created_by: "ra_2", created_at: 4, updated_at: 4, source_title: "Other" },
      { _id: "d5", _creationTime: 4, evidence_draft_id: "d5", task_id: "t5", draft_status: "submitted", created_by: "ra_1", created_at: 5, updated_at: 5 },
      { _id: "d7", _creationTime: 5, evidence_draft_id: "d7", task_id: "t7", draft_status: "submitted", created_by: "ra_1", created_at: 6, updated_at: 6 },
    ],
    review_decisions: [
      { _id: "r7", review_decision_id: "r7", task_id: "t7", reviewer_user_id: "rev_1", decision_status: "changes_requested", decision_note: "Add a source", required_follow_up: "Council minutes", accepted_action: "x", agent_review_id: "a1", decision_hash: "h", created_at: 7, updated_at: 7 },
    ],
  };
  return rows;
}

function ctxFor(rows, subject) {
  return { auth: { async getUserIdentity() { return subject === null ? null : { tokenIdentifier: subject }; } }, db: makeDb(rows) };
}

const landingArgs = { countryCode: "NZ", batchId: "nz-batch", limit: 1000 };
const ids = (list) => list.map((item) => item.task_id ?? item.task.task_id).sort();

async function expectedLanding(ctx, args) {
  const tasks = await listTasks._handler(ctx, { countryCode: args.countryCode, batchId: args.batchId, limit: args.limit });
  const manual = await listTasks._handler(ctx, { countryCode: args.countryCode, batchId: "manual-nz", limit: args.limit });
  const mine = await listMyTasks._handler(ctx, { statuses: args.myStatuses, limit: 200 });
  return { tasks, manual, mine };
}

for (const [label, subject] of [["contributor", "s-ra1"], ["second contributor", "s-ra2"], ["reviewer", "s-rev"], ["admin", "s-adm"]]) {
  test(`raLanding equals listTasks and listMyTasks for a ${label}`, async () => {
    const rows = fixture();
    const ctx = ctxFor(rows, subject);
    const landing = await raLanding._handler(ctx, landingArgs);
    const expected = await expectedLanding(ctx, landingArgs);
    assert.deepEqual(landing.tasks, expected.tasks);
    assert.deepEqual(landing.manualTasks, expected.manual);
    assert.deepEqual(landing.myWork.map((row) => row.task), expected.mine.map((row) => row.task));
    assert.equal(landing.user._id, rows.users.find((user) => user.auth_subject === subject)._id);
  });
}

test("raLanding hides draft-batch tasks from contributors and shows them to reviewers and admins", async () => {
  const rows = fixture();
  const country = { countryCode: "NZ", limit: 1000 };
  const asRa = await raLanding._handler(ctxFor(rows, "s-ra1"), country);
  assert.ok(!asRa.tasks.some((row) => row.task_id === "t4"));
  assert.deepEqual(asRa.tasks, await listTasks._handler(ctxFor(rows, "s-ra1"), country));
  const scoped = await raLanding._handler(ctxFor(rows, "s-ra1"), { countryCode: "NZ", batchId: "nz-draft-batch", limit: 1000 });
  assert.deepEqual(scoped.tasks, []);
  for (const subject of ["s-rev", "s-adm"]) {
    const landing = await raLanding._handler(ctxFor(rows, subject), country);
    assert.ok(landing.tasks.some((row) => row.task_id === "t4"));
    assert.deepEqual(landing.tasks, await listTasks._handler(ctxFor(rows, subject), country));
  }
});

test("raLanding myWork holds only the caller's tasks, newest first, with the same statuses filter", async () => {
  const rows = fixture();
  const landing = await raLanding._handler(ctxFor(rows, "s-ra1"), landingArgs);
  assert.deepEqual(landing.myWork.map((row) => row.task.task_id), ["t7", "t5", "t1"]);
  assert.ok(landing.myWork.every((row) => row.task.assigned_to === "ra_1"));
  const narrowed = await raLanding._handler(ctxFor(rows, "s-ra1"), { ...landingArgs, myStatuses: ["needs_review"] });
  assert.deepEqual(narrowed.myWork.map((row) => row.task.task_id), ["t5"]);
});

test("raLanding manualTasks is the country's manual batch and includeMine false skips it and myWork", async () => {
  const rows = fixture();
  const landing = await raLanding._handler(ctxFor(rows, "s-ra1"), landingArgs);
  assert.deepEqual(ids(landing.manualTasks), ["t5"]);
  const lean = await raLanding._handler(ctxFor(rows, "s-ra1"), { ...landingArgs, includeMine: false });
  assert.deepEqual(lean.tasks, landing.tasks);
  assert.deepEqual(lean.manualTasks, []);
  assert.deepEqual(lean.myWork, []);
});

test("slim draft and review rows carry only the allow-listed keys", async () => {
  const rows = fixture();
  const landing = await raLanding._handler(ctxFor(rows, "s-ra1"), landingArgs);
  const byId = Object.fromEntries(landing.myWork.map((row) => [row.task.task_id, row]));
  const draftKeys = new Set(["evidence_draft_id", "draft_status", "action", "source_title", "created_at", "updated_at"]);
  const reviewKeys = new Set(["decision_status", "decision_note", "required_follow_up", "created_at"]);
  for (const row of landing.myWork) {
    if (row.latestDraft) for (const key of Object.keys(row.latestDraft)) assert.ok(draftKeys.has(key), `unexpected draft key ${key}`);
    if (row.latestReview) for (const key of Object.keys(row.latestReview)) assert.ok(reviewKeys.has(key), `unexpected review key ${key}`);
  }
  // the latest draft of t1 is the submitted one, with the fields the portal reads
  assert.deepEqual(byId.t1.latestDraft, { evidence_draft_id: "d1", draft_status: "submitted", action: "confirm_existing", source_title: "Council register", created_at: 2, updated_at: 3 });
  assert.deepEqual(byId.t7.latestReview, { decision_status: "changes_requested", decision_note: "Add a source", required_follow_up: "Council minutes", created_at: 7 });
  assert.equal(byId.t5.latestReview, null);
  // every field the portal reads from the full rows survives the projection
  const full = await listMyTasks._handler(ctxFor(rows, "s-ra1"), { limit: 200 });
  for (const row of full) {
    const slim = byId[row.task.task_id];
    assert.equal(slim.latestDraft?.draft_status, row.latestDraft?.draft_status);
    assert.equal(slim.latestDraft?.action, row.latestDraft?.action);
    assert.equal(slim.latestDraft?.source_title, row.latestDraft?.source_title);
    assert.equal(slim.latestReview?.decision_status, row.latestReview?.decision_status);
    assert.equal(slim.latestReview?.decision_note, row.latestReview?.decision_note);
    assert.equal(slim.latestReview?.required_follow_up, row.latestReview?.required_follow_up);
  }
});

test("a contributor's landing never carries another contributor's draft", async () => {
  const rows = fixture();
  rows.tasks.push(task("t8", { assigned_to: "ra_1", status: "needs_review", updated_at: 60 }));
  rows.evidence_drafts.push({ _id: "d8", _creationTime: 9, evidence_draft_id: "d8", task_id: "t8", draft_status: "submitted", created_by: "ra_2", created_at: 9, updated_at: 9, source_title: "Not yours" });
  const landing = await raLanding._handler(ctxFor(rows, "s-ra1"), landingArgs);
  assert.equal(landing.myWork.find((row) => row.task.task_id === "t8").latestDraft, null);
});

test("raLanding without an identity returns a null user and empty lists", async () => {
  const landing = await raLanding._handler(ctxFor(fixture(), null), landingArgs);
  assert.deepEqual(landing, { user: null, tasks: [], manualTasks: [], myWork: [] });
});

test("raLanding takes identity from the session, not the arguments", async () => {
  const rows = fixture();
  const landing = await raLanding._handler(ctxFor(rows, "s-ra2"), { ...landingArgs, userId: "ra_1", assignedTo: "ra_1" });
  assert.equal(landing.user._id, "ra_2");
  assert.deepEqual(landing.myWork.map((row) => row.task.task_id), ["t2"]);
});

test("raLanding refuses an unpromoted (inactive) user and a role the landing does not serve", async () => {
  const rows = fixture();
  await assert.rejects(raLanding._handler(ctxFor(rows, "s-inv"), landingArgs), /not active/);
  await assert.rejects(raLanding._handler(ctxFor(rows, "s-svc"), landingArgs), /role does not permit/);
  await assert.rejects(raLanding._handler(ctxFor(rows, "s-unknown"), landingArgs), /not active/);
});

test("raTaskRow returns the caller's row with the slim projection", async () => {
  const rows = fixture();
  const row = await raTaskRow._handler(ctxFor(rows, "s-ra1"), { taskId: "t1" });
  assert.equal(row.task.task_id, "t1");
  assert.equal(row.latestDraft.evidence_draft_id, "d1");
  assert.deepEqual(Object.keys(row).sort(), ["latestDraft", "latestReview", "task"]);
  const landing = await raLanding._handler(ctxFor(rows, "s-ra1"), landingArgs);
  assert.deepEqual(row, landing.myWork.find((entry) => entry.task.task_id === "t1"));
});

test("raTaskRow refuses another contributor's task and an unknown task", async () => {
  const rows = fixture();
  await assert.rejects(raTaskRow._handler(ctxFor(rows, "s-ra1"), { taskId: "t2" }), /assigned to another user/);
  await assert.rejects(raTaskRow._handler(ctxFor(rows, "s-ra1"), { taskId: "nope" }), /Task not found/);
  await assert.rejects(raTaskRow._handler(ctxFor(rows, null), { taskId: "t1" }), /Authentication required/);
  await assert.rejects(raTaskRow._handler(ctxFor(rows, "s-inv"), { taskId: "t1" }), /not active/);
});

test("raTaskRow lets a reviewer read another contributor's row and applies the promotion gate", async () => {
  const rows = fixture();
  const reviewerRow = await raTaskRow._handler(ctxFor(rows, "s-rev"), { taskId: "t2" });
  assert.equal(reviewerRow.latestDraft.evidence_draft_id, "d2");
  // an unassigned draft-batch task: hidden from a contributor, visible to a reviewer
  assert.equal(await raTaskRow._handler(ctxFor(rows, "s-ra1"), { taskId: "t4" }), null);
  assert.equal((await raTaskRow._handler(ctxFor(rows, "s-rev"), { taskId: "t4" })).task.task_id, "t4");
  assert.equal((await raTaskRow._handler(ctxFor(rows, "s-adm"), { taskId: "t4" })).task.task_id, "t4");
});

test("the refactored listTasks and listMyTasks keep their gates", async () => {
  const rows = fixture();
  const asRa = await listTasks._handler(ctxFor(rows, "s-ra1"), { countryCode: "NZ" });
  assert.ok(!asRa.some((row) => row.task_id === "t4" || row.country_code === "VU"));
  await assert.rejects(listTasks._handler(ctxFor(rows, null), { countryCode: "NZ" }), /Authentication required/);
  await assert.rejects(listMyTasks._handler(ctxFor(rows, "s-svc"), {}), /role does not permit/);
});
