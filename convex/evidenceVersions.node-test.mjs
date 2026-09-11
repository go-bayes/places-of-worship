import assert from "node:assert/strict";
import fs from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";

// Convex resolves extensionless local TypeScript imports during bundling. The
// same rule is supplied here so these tests drive the registered handlers
// rather than a parallel copy of the rules.
registerHooks({ resolve(specifier, context, nextResolve) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) { for (const ext of [".js", ".ts"]) { const candidate = new URL(`${specifier}${ext}`, context.parentURL); if (fs.existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context); } } return nextResolve(specifier, context); } });

const { saveEvidenceDraft, submitEvidenceDraft, submitEvidenceDraftWithOccupancies, submitUnresolvedNote, reviseEvidenceDraft, importSubmittedEvidenceDrafts, withdrawEvidenceDraft, restoreEvidenceDraft } = await import("./evidence.ts");
const { getEvidenceVersion, listEvidenceVersions, listEvidenceHeadChanges, recordMigrationVersion, verifyDraftAgainstVersion } = await import("./evidenceVersions.ts");
const { submitCurrentObservation } = await import("./rapidEntry.ts");
const { submitOccupancies, decideDerivedYear, confirmAllDerived } = await import("./occupancies.ts");
const { recordReviewDecision, getReviewSnapshot } = await import("./reviews.ts");
const { recordAcceptance } = await import("./acceptances.ts");
const { createExportBatch } = await import("./exports.ts");
const { reopenTask } = await import("./tasks.ts");
const { objectHash } = await import("./lib/canonicalJson.ts");
const { verifyEvidenceVersionEnvelope } = await import("./lib/evidenceVersions.ts");
const { intakeRateLimiter } = await import("./lib/rateLimits.ts");

// the rate limiter reaches the Convex component through ctx.runMutation, which
// an in-memory context has no way to serve; every guarded path is exercised
// with capacity granted, and the limiter's own rules are not under test here
intakeRateLimiter.limit = async () => ({ ok: true, retryAfter: 0 });

// a fixed clock that advances one millisecond per read, so recorded times are
// deterministic and two versions recorded in one test never share a timestamp
let clock = Date.UTC(2026, 8, 11, 4, 30, 0, 0);
Date.now = () => (clock += 1);

const submissionId = (n) => `11111111-1111-4111-8111-${String(n).padStart(12, "0")}`;

// one in-memory database for every mutation and query under test: withIndex
// eq chains on any field, insertion-ordered reads with order("asc"|"desc"),
// and the insert/get/patch semantics the handlers rely on
function world() {
  const rows = {
    users: [], tasks: [], task_events: [], evidence_drafts: [], evidence_versions: [], evidence_submission_receipts: [],
    evidence_head_changes: [],
    site_occupancies: [], historical_claims: [], derived_target_year_states: [],
    derived_year_locations: [], derived_target_year_functions: [], derived_state_events: [],
    review_decisions: [], agent_reviews: [], sources: [], task_batches: [],
    task_acceptances: [], export_batches: [], review_snapshots: [],
  };
  const counters = {};
  let creationTime = 1_780_000_000_000;
  let subject = null;

  const find = (id) => {
    for (const table of Object.values(rows)) {
      const row = table.find((candidate) => candidate._id === id);
      if (row !== undefined) return row;
    }
    return null;
  };

  const db = {
    query(table) {
      if (rows[table] === undefined) throw new Error(`No fake table for ${table}.`);
      const filters = [];
      let descending = false;
      const q = { eq(field, value) { filters.push([field, value]); return q; } };
      const selected = () => {
        const matched = rows[table].filter((row) => filters.every(([field, value]) => row[field] === value));
        return descending ? [...matched].reverse() : matched;
      };
      const chain = {
        withIndex(_name, select) { if (select) select(q); return chain; },
        order(direction) { descending = direction === "desc"; return chain; },
        async unique() {
          const matched = selected();
          if (matched.length > 1) throw new Error(`unique() matched ${matched.length} rows in ${table}.`);
          return matched[0] ?? null;
        },
        async first() { return selected()[0] ?? null; },
        async take(count) { return selected().slice(0, count); },
        async collect() { return selected(); },
      };
      return chain;
    },
    async insert(table, value) {
      if (rows[table] === undefined) throw new Error(`No fake table for ${table}.`);
      counters[table] = (counters[table] ?? 0) + 1;
      creationTime += 1;
      const stored = { _id: `${table}_${counters[table]}`, _creationTime: creationTime };
      for (const [key, member] of Object.entries(value)) {
        if (member !== undefined) stored[key] = member;
      }
      rows[table].push(stored);
      return stored._id;
    },
    async get(id) { return find(id); },
    async patch(id, value) {
      const row = find(id);
      if (row === null) throw new Error(`Patch of a missing row ${id}.`);
      // Convex removes a field patched with undefined
      for (const [key, member] of Object.entries(value)) {
        if (member === undefined) delete row[key];
        else row[key] = member;
      }
    },
  };

  const ctx = {
    auth: { async getUserIdentity() { return subject === null ? null : { tokenIdentifier: subject }; } },
    db,
  };

  const helper = {
    ctx,
    db,
    rows,
    as(user) { subject = user.auth_subject; return ctx; },
    row(table, field, value) { return rows[table].find((candidate) => candidate[field] === value) ?? null; },
    events(type) { return rows.task_events.filter((event) => event.event_type === type); },
    async addUser(authSubject, roles, status = "active") {
      const id = await db.insert("users", { auth_subject: authSubject, status, roles, display_name: authSubject });
      return find(id);
    },
    async addTask(record) {
      const now = Date.now();
      const id = await db.insert("tasks", {
        batch_id: "test-batch",
        country_code: "NZ",
        task_type: "confirm_existing_record",
        priority: "normal",
        status: "in_progress",
        target_years: [2013, 2018, 2023],
        geometry: { type: "Point", coordinates: [174.768, -41.282] },
        nearby_site_refs: [],
        automated_checks: [],
        name: "Test place of worship",
        created_at: now,
        updated_at: now,
        last_event_at: now,
        ...record,
      });
      return find(id);
    },
    async addDraft(record) {
      const now = Date.now();
      const id = await db.insert("evidence_drafts", {
        draft_status: "draft",
        created_at: now,
        updated_at: now,
        ...draftContent(),
        ...record,
      });
      return find(id);
    },
  };
  return helper;
}

// an invented guided evidence record; no real place or person
function draftContent(overrides = {}) {
  return {
    observation_contract_version: "guided_observation_v1",
    source_type: "denominational_directory",
    source_title: "Diocesan directory 2016",
    source_url_or_file: "https://example.org/directory/2016",
    source_date_or_capture_date: "2016-07",
    action: "confirm_current_record",
    evidence_note: "The directory records this place as active in July 2016.",
    privacy_flag: "clear",
    licence_flag: "needs_review",
    ...overrides,
  };
}

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

function version(w, index = 0) {
  return w.rows.evidence_versions[index];
}

function envelopeOf(row) {
  return JSON.parse(row.envelope_json);
}

test("a generic submission records one immutable evidence version", async () => {
  const w = await scene();
  const result = await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a", note: "Directory checked." });

  assert.equal(w.rows.evidence_versions.length, 1);
  const stored = version(w);
  assert.match(stored.object_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(result.evidence_version_hash, stored.object_hash);
  assert.equal(result.deduped, false);
  assert.equal(stored.version_kind, "submitted");
  assert.equal(stored.version_index, 1);
  assert.equal(stored.parent_object_hash, undefined);

  // the draft row keeps the hash and family as locators into the version table
  assert.equal(w.draft.evidence_version_hash, stored.object_hash);
  assert.equal(w.draft.evidence_family_id, "task_1:draft_a");
  assert.equal(w.draft.draft_status, "submitted");

  const submitted = w.events("submitted_for_review");
  assert.equal(submitted.length, 1);
  assert.equal(submitted[0].evidence_version_hash, stored.object_hash);

  // the stored envelope verifies and reproduces its own hash
  const envelope = envelopeOf(stored);
  const verification = verifyEvidenceVersionEnvelope(envelope);
  assert.deepEqual(verification.errors, []);
  assert.equal(verification.valid, true);
  const { object_hash: recorded, ...unhashed } = envelope;
  assert.equal(objectHash(unhashed), recorded);
  assert.equal(recorded, stored.object_hash);
  assert.equal(envelope.created_by, `actor:${w.ra._id}`);
  assert.equal(envelope.payload.evidence.evidence_note, draftContent().evidence_note);
  assert.deepEqual(envelope.payload.occupancies, []);
});

test("a retried submission returns the existing version and writes nothing further", async () => {
  const w = await scene();
  const first = await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a", clientSubmissionId: submissionId(1) });
  const statusAfterFirst = w.task.status;
  const eventsAfterFirst = w.rows.task_events.length;

  const retry = await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a", clientSubmissionId: submissionId(1) });
  assert.equal(retry.evidence_version_hash, first.evidence_version_hash);
  assert.equal(retry.deduped, true);
  assert.equal(w.rows.evidence_versions.length, 1);
  assert.equal(w.events("submitted_for_review").length, 1);
  assert.equal(w.rows.task_events.length, eventsAfterFirst);
  assert.equal(w.task.status, statusAfterFirst);
  assert.equal(w.task.status, "needs_review");
});

test("an unchanged resubmission without an idempotency token is deduped by content", async () => {
  const w = await scene();
  const first = await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a" });
  const eventsAfterFirst = w.rows.task_events.length;

  const again = await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a" });
  assert.equal(again.evidence_version_hash, first.evidence_version_hash);
  assert.equal(again.deduped, true);
  assert.equal(w.rows.evidence_versions.length, 1);
  assert.equal(w.rows.task_events.length, eventsAfterFirst);
  assert.equal(w.events("submitted_for_review").length, 1);
});

// the same submission through the contract's own idempotency token, which does
// not depend on the unreachable branch above
test("an unchanged resubmission under its submission token is deduped", async () => {
  const w = await scene();
  const first = await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a", clientSubmissionId: submissionId(3) });
  const again = await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a", clientSubmissionId: submissionId(3) });
  assert.equal(again.evidence_version_hash, first.evidence_version_hash);
  assert.equal(again.deduped, true);
  assert.equal(w.rows.evidence_versions.length, 1);
  assert.equal(w.events("submitted_for_review").length, 1);
});

test("a submission identifier already spent on another draft is refused before any write", async () => {
  const w = await scene();
  await w.addDraft({ evidence_draft_id: "task_1:draft_b", task_id: "task_1", created_by: w.ra._id });
  await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a", clientSubmissionId: submissionId(1) });
  const eventsAfterFirst = w.rows.task_events.length;

  await assert.rejects(
    submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_b", clientSubmissionId: submissionId(1) }),
    /submission identifier is already in use/,
  );
  assert.equal(w.rows.evidence_versions.length, 1);
  assert.equal(w.rows.task_events.length, eventsAfterFirst);
  assert.equal(w.row("evidence_drafts", "evidence_draft_id", "task_1:draft_b").draft_status, "draft");
  assert.equal(w.row("evidence_drafts", "evidence_draft_id", "task_1:draft_b").evidence_version_hash, undefined);
});

test("the idempotency keyspace is scoped per contributor, so two people may hold one client token", async () => {
  // the server key is `submit:${user}:${clientSubmissionId}`, so a second
  // person reusing the same browser-side token collides with nothing
  const w = await scene();
  await w.addDraft({ evidence_draft_id: "task_1:draft_other", task_id: "task_1", created_by: w.otherRa._id });
  const mine = await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a", clientSubmissionId: submissionId(1) });
  const theirs = await submitEvidenceDraft._handler(w.as(w.otherRa), { evidenceDraftId: "task_1:draft_other", clientSubmissionId: submissionId(1) });

  assert.notEqual(mine.evidence_version_hash, theirs.evidence_version_hash);
  assert.equal(w.rows.evidence_versions.length, 2);
  assert.equal(version(w, 0).idempotency_key, `submit:${w.ra._id}:${submissionId(1)}`);
  assert.equal(version(w, 1).idempotency_key, `submit:${w.otherRa._id}:${submissionId(1)}`);
});

test("a reviewer edit of submitted evidence becomes an attributed child version", async () => {
  const w = await scene();
  await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a" });
  const contributorVersion = version(w);
  const contributorEnvelopeJson = contributorVersion.envelope_json;

  const edit = draftContent({ evidence_note: "The reviewer checked the directory and corrected the parish name." });
  await saveEvidenceDraft._handler(w.as(w.reviewer), { taskId: "task_1", evidenceDraftId: "task_1:draft_a", draft: edit });

  assert.equal(w.rows.evidence_versions.length, 2);
  const child = version(w, 1);
  assert.equal(child.parent_object_hash, contributorVersion.object_hash);
  assert.equal(child.version_index, 2);
  assert.equal(child.evidence_family_id, contributorVersion.evidence_family_id);
  assert.equal(child.created_by, w.reviewer._id);
  assert.equal(child.version_kind, "reviewer_edit");
  assert.equal(w.draft.draft_status, "submitted");
  assert.equal(w.draft.evidence_version_hash, child.object_hash);

  // the contributor's version is untouched and still retrievable
  assert.equal(contributorVersion.envelope_json, contributorEnvelopeJson);
  const retrieved = await getEvidenceVersion._handler(w.as(w.reviewer), { objectHash: contributorVersion.object_hash });
  assert.equal(retrieved.envelope_json, contributorEnvelopeJson);
  assert.equal(retrieved.verification.valid, true);
  assert.equal(retrieved.version.created_by, w.ra._id);

  const noted = w.events("note_added");
  assert.equal(noted.length, 1);
  assert.equal(noted[0].evidence_version_hash, child.object_hash);
});

// defect: the same unreachable dedupe branch. The reviewer's second save
// changes nothing on the row, yet records a third version and a second
// note_added event.
test("a reviewer re-saving identical content records no further version", async () => {
  const w = await scene();
  await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a" });
  const edit = draftContent({ evidence_note: "The reviewer checked the directory and corrected the parish name." });
  await saveEvidenceDraft._handler(w.as(w.reviewer), { taskId: "task_1", evidenceDraftId: "task_1:draft_a", draft: edit });
  const child = version(w, 1);

  await saveEvidenceDraft._handler(w.as(w.reviewer), { taskId: "task_1", evidenceDraftId: "task_1:draft_a", draft: edit });
  assert.equal(w.rows.evidence_versions.length, 2);
  assert.equal(w.events("note_added").length, 1);
  assert.equal(w.draft.evidence_version_hash, child.object_hash);
});

test("unauthorised writes and reads are refused and record no version", async () => {
  const w = await scene();
  await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a" });
  const recorded = version(w);

  // the contributor cannot edit their own submitted evidence in place
  await assert.rejects(
    saveEvidenceDraft._handler(w.as(w.ra), { taskId: "task_1", evidenceDraftId: "task_1:draft_a", draft: draftContent({ evidence_note: "Quietly rewritten after submission." }) }),
    /Submitted evidence cannot be edited directly\. Start a revision instead\./,
  );
  assert.equal(w.rows.evidence_versions.length, 1);

  // migration records need an admin or service role and an active account
  await assert.rejects(
    recordMigrationVersion._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a", migrationRunId: "run-1" }),
    /Project role does not permit this action/,
  );
  const disabled = await w.addUser("disabled-admin-subject", ["admin"], "disabled");
  await assert.rejects(
    recordMigrationVersion._handler(w.as(disabled), { evidenceDraftId: "task_1:draft_a", migrationRunId: "run-1" }),
    /not active in this project/,
  );
  assert.equal(w.rows.evidence_versions.length, 1);

  // a version is visible to its author and to review roles only
  await assert.rejects(
    getEvidenceVersion._handler(w.as(w.otherRa), { objectHash: recorded.object_hash }),
    /belongs to another user/,
  );
  const asAuthor = await getEvidenceVersion._handler(w.as(w.ra), { objectHash: recorded.object_hash });
  assert.equal(asAuthor.version.object_hash, recorded.object_hash);
  const asReviewer = await getEvidenceVersion._handler(w.as(w.reviewer), { objectHash: recorded.object_hash });
  assert.equal(asReviewer.version.object_hash, recorded.object_hash);
  assert.equal(asReviewer.verification.valid, true);
});

test("a correction joins the family of the submission it corrects", async () => {
  const w = await scene({ country: "VU" });
  await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a" });
  const first = version(w);

  const revision = await reviseEvidenceDraft._handler(w.as(w.ra), { taskId: "task_1" });
  const clone = w.row("evidence_drafts", "evidence_draft_id", revision.evidence_draft_id);
  assert.equal(revision.previous_evidence_draft_id, "task_1:draft_a");
  assert.equal(clone.revision_of_evidence_draft_id, "task_1:draft_a");
  assert.equal(clone.revision_intent, "correction");
  assert.equal(clone.draft_status, "draft");
  assert.equal(clone.evidence_version_hash, undefined);

  await saveEvidenceDraft._handler(w.as(w.ra), {
    taskId: "task_1",
    evidenceDraftId: revision.evidence_draft_id,
    draft: draftContent({ evidence_note: "The 2016 directory entry was a reprint of 2013; corrected." }),
  });
  const submitted = await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: revision.evidence_draft_id });

  assert.equal(w.rows.evidence_versions.length, 2);
  const child = version(w, 1);
  assert.equal(submitted.evidence_version_hash, child.object_hash);
  assert.equal(child.version_index, 2);
  assert.equal(child.parent_object_hash, first.object_hash);
  assert.equal(child.evidence_family_id, first.evidence_family_id);
  assert.equal(clone.evidence_family_id, "task_1:draft_a");
  assert.deepEqual(envelopeOf(child).parent_object_hashes, [first.object_hash]);

  const family = await listEvidenceVersions._handler(w.as(w.reviewer), { evidenceFamilyId: "task_1:draft_a" });
  assert.deepEqual(family.map((row) => row.version_index), [1, 2]);
  assert.deepEqual(family.map((row) => row.object_hash), [first.object_hash, child.object_hash]);
  // the superseded submission keeps its own version row
  assert.equal(w.draft.draft_status, "superseded");
  assert.equal(w.draft.evidence_version_hash, first.object_hash);
});

test("a new dated observation starts a family that follows the earlier one", async () => {
  const w = await scene({ country: "VU" });
  await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a" });
  const first = version(w);

  const revision = await reviseEvidenceDraft._handler(w.as(w.ra), { taskId: "task_1", intent: "new_observation" });
  const clone = w.row("evidence_drafts", "evidence_draft_id", revision.evidence_draft_id);
  assert.equal(clone.revision_intent, "new_observation");
  await saveEvidenceDraft._handler(w.as(w.ra), {
    taskId: "task_1",
    evidenceDraftId: revision.evidence_draft_id,
    draft: draftContent({ source_type: "field_observation", source_title: "Site visit", source_date_or_capture_date: "2026-09-10", evidence_note: "Visited the site; worship continues weekly." }),
  });
  await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: revision.evidence_draft_id });

  const follower = version(w, 1);
  assert.equal(follower.version_index, 1);
  assert.equal(follower.evidence_family_id, revision.evidence_draft_id);
  assert.notEqual(follower.evidence_family_id, first.evidence_family_id);
  assert.equal(follower.parent_object_hash, undefined);
  const envelope = envelopeOf(follower);
  assert.deepEqual(envelope.parent_object_hashes, []);
  assert.equal(envelope.payload.follows_evidence_draft_id, "task_1:draft_a");
  assert.equal(envelope.payload.follows_object_hash, first.object_hash);
  assert.equal(envelope.payload.parent_version_unavailable, undefined);

  const byFamily = await listEvidenceVersions._handler(w.as(w.reviewer), { evidenceFamilyId: revision.evidence_draft_id });
  assert.deepEqual(byFamily.map((row) => row.object_hash), [follower.object_hash]);
});

test("a correction of a pre-contract submission invents no parent hash", async () => {
  // a row submitted before the contract carries no version hash
  const w = await scene({ country: "VU", taskStatus: "needs_review", draft: { draft_status: "submitted" } });
  assert.equal(w.draft.evidence_version_hash, undefined);

  const revision = await reviseEvidenceDraft._handler(w.as(w.ra), { taskId: "task_1" });
  await saveEvidenceDraft._handler(w.as(w.ra), {
    taskId: "task_1",
    evidenceDraftId: revision.evidence_draft_id,
    draft: draftContent({ evidence_note: "The earlier record misread the directory; corrected here." }),
  });
  await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: revision.evidence_draft_id });

  assert.equal(w.rows.evidence_versions.length, 1);
  const recorded = version(w);
  assert.equal(recorded.version_index, 1);
  assert.equal(recorded.parent_object_hash, undefined);
  assert.equal(recorded.evidence_family_id, revision.evidence_draft_id);
  const envelope = envelopeOf(recorded);
  assert.deepEqual(envelope.parent_object_hashes, []);
  assert.equal(envelope.payload.revises_evidence_draft_id, "task_1:draft_a");
  assert.equal(envelope.payload.parent_version_unavailable, "pre_contract");
});

test("a second submission supersedes the first while its version stays intact", async () => {
  const w = await scene();
  await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a" });
  const first = version(w);
  const firstEnvelopeJson = first.envelope_json;

  await w.addDraft({
    evidence_draft_id: "task_1:draft_b",
    task_id: "task_1",
    created_by: w.ra._id,
    ...draftContent({ evidence_note: "A second reading of the same directory, entered afresh." }),
  });
  await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_b" });

  assert.equal(w.rows.evidence_versions.length, 2);
  assert.equal(w.draft.draft_status, "superseded");
  assert.equal(w.row("evidence_drafts", "evidence_draft_id", "task_1:draft_b").draft_status, "submitted");
  assert.equal(first.envelope_json, firstEnvelopeJson);
  const retrieved = await getEvidenceVersion._handler(w.as(w.reviewer), { objectHash: first.object_hash });
  assert.equal(retrieved.envelope_json, firstEnvelopeJson);
  assert.equal(retrieved.verification.valid, true);
  assert.equal(retrieved.version.evidence_draft_id, "task_1:draft_a");
});

test("a guided retry against a fresh draft after a reload is refused before any write", async () => {
  const w = await scene();
  const key = `${w.ra._id}:${submissionId(7)}`;
  await w.db.insert("site_occupancies", {
    occupancy_id: `task_1:${w.ra._id}:occupancy:${submissionId(7)}:0`,
    task_id: "task_1",
    parent_evidence_draft_id: "task_1:draft_gone",
    claim_status: "submitted",
    submission_key: key,
    segment_index: 0,
    created_by: w.ra._id,
  });

  await assert.rejects(
    submitEvidenceDraftWithOccupancies._handler(w.as(w.ra), {
      evidenceDraftId: "task_1:draft_a",
      clientSubmissionId: submissionId(7),
      segments: [],
    }),
    /already recorded against an earlier evidence version/,
  );
  assert.equal(w.rows.evidence_versions.length, 0);
  assert.equal(w.draft.draft_status, "draft");
});

test("a recorded version is byte-identical after later task activity", async () => {
  const w = await scene();
  await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a" });
  const recorded = version(w);
  const envelopeJson = recorded.envelope_json;

  const untouched = await verifyDraftAgainstVersion._handler(w.as(w.reviewer), { evidenceDraftId: "task_1:draft_a" });
  assert.equal(untouched.consistent, true);
  assert.equal(untouched.stored_envelope_valid, true);
  assert.deepEqual(untouched.errors, []);

  // later activity that does not go through the version contract
  await w.db.patch(w.draft._id, { evidence_note: "Rewritten directly in the database." });
  await w.db.insert("site_occupancies", {
    occupancy_id: "task_1:late:occupancy:0",
    task_id: "task_1",
    parent_evidence_draft_id: "task_1:draft_a",
    claim_status: "submitted",
    submission_key: "late",
    segment_index: 0,
    created_by: w.ra._id,
  });
  await w.db.patch(w.task._id, { status: "reviewed" });

  const retrieved = await getEvidenceVersion._handler(w.as(w.reviewer), { objectHash: recorded.object_hash });
  assert.equal(retrieved.envelope_json, envelopeJson);
  assert.equal(retrieved.verification.valid, true);
  assert.equal(envelopeOf(retrieved).payload.evidence.evidence_note, draftContent().evidence_note);

  const drifted = await verifyDraftAgainstVersion._handler(w.as(w.reviewer), { evidenceDraftId: "task_1:draft_a" });
  assert.equal(drifted.consistent, false);
  assert.ok(drifted.errors.some((error) => /differs/.test(error)), JSON.stringify(drifted.errors));
  assert.equal(drifted.stored_envelope_valid, true);
});

test("a migration copy records its run without claiming the hash existed at submission", async () => {
  const w = await scene({ taskStatus: "needs_review", draft: { draft_status: "submitted" } });
  const legacy = w.draft;
  assert.equal(legacy.evidence_version_hash, undefined);

  const first = await recordMigrationVersion._handler(w.as(w.admin), { evidenceDraftId: "task_1:draft_a", migrationRunId: "evidence-version-migration-2026-09" });
  assert.equal(first.created, true);
  assert.equal(first.version_index, 1);
  assert.equal(w.rows.evidence_versions.length, 1);
  const recorded = version(w);
  assert.equal(recorded.version_kind, "migration_copy");
  assert.equal(recorded.created_by, w.admin._id);

  const envelope = envelopeOf(recorded);
  assert.equal(envelope.created_by, `actor:${w.admin._id}`);
  const migration = envelope.payload.migration;
  assert.equal(migration.run_id, "evidence-version-migration-2026-09");
  assert.equal(migration.source_created_by, `actor:${w.ra._id}`);
  for (const field of ["copied_at", "source_created_at", "source_updated_at"]) {
    assert.match(migration[field], /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, field);
  }
  assert.equal(migration.source_created_at, new Date(legacy.created_at).toISOString());
  assert.equal(migration.source_updated_at, new Date(legacy.updated_at).toISOString());
  assert.deepEqual(verifyEvidenceVersionEnvelope(envelope).errors, []);
  const noted = w.events("note_added");
  assert.equal(noted.length, 1);
  assert.equal(noted[0].evidence_version_hash, recorded.object_hash);

  // the run is idempotent
  const again = await recordMigrationVersion._handler(w.as(w.admin), { evidenceDraftId: "task_1:draft_a", migrationRunId: "evidence-version-migration-2026-09" });
  assert.equal(again.created, false);
  assert.equal(again.object_hash, first.object_hash);
  assert.equal(w.rows.evidence_versions.length, 1);
  assert.equal(w.events("note_added").length, 1);

  // an editable draft is versioned when it is submitted, never by migration
  await w.addDraft({ evidence_draft_id: "task_1:draft_editable", task_id: "task_1", created_by: w.ra._id });
  await assert.rejects(
    recordMigrationVersion._handler(w.as(w.admin), { evidenceDraftId: "task_1:draft_editable", migrationRunId: "evidence-version-migration-2026-09" }),
    /Only submitted rows take a migration version/,
  );
  assert.equal(w.rows.evidence_versions.length, 1);
});

const rapidObservation = (overrides = {}) => ({
  current_status: "currently_used_for_worship",
  observation_basis: "direct_field_observation",
  observed_on: "2026-09-10",
  direct_observation: "Weekly services were in progress at the building when visited.",
  privacy_flag: "clear",
  ...overrides,
});

test("a rapid observation and its correction form one version family", async () => {
  const w = world();
  const ra = await w.addUser("ra-subject", ["ra"]);
  const reviewer = await w.addUser("reviewer-subject", ["reviewer"]);
  await w.addTask({ task_id: "vu_task", batch_id: "manual-vu", country_code: "VU", status: "in_progress", assigned_to: ra._id, target_years: [] });

  const first = await submitCurrentObservation._handler(w.as(ra), {
    clientSubmissionId: submissionId(11),
    taskId: "vu_task",
    observation: rapidObservation(),
  });
  assert.equal(first.deduped, false);
  assert.equal(first.corrected, false);
  assert.equal(w.rows.evidence_versions.length, 1);
  const firstVersion = version(w);
  assert.equal(firstVersion.version_kind, "rapid_current_observation");
  assert.equal(firstVersion.version_index, 1);
  assert.equal(firstVersion.evidence_family_id, first.evidence_draft_id);
  assert.equal(first.evidence_version_hash, firstVersion.object_hash);
  assert.equal(w.row("tasks", "task_id", "vu_task").status, "needs_review");

  // the observer corrects the observation while it awaits review
  const corrected = await submitCurrentObservation._handler(w.as(ra), {
    clientSubmissionId: submissionId(12),
    taskId: "vu_task",
    observation: rapidObservation({ current_status: "place_exists_worship_uncertain", direct_observation: "The building stands, but no service was in progress and no notice board was visible." }),
  });
  assert.equal(corrected.corrected, true);
  assert.equal(corrected.superseded_evidence_draft_id, first.evidence_draft_id);
  assert.equal(w.rows.evidence_versions.length, 2);
  const child = version(w, 1);
  assert.equal(child.version_kind, "rapid_current_observation");
  assert.equal(child.version_index, 2);
  assert.equal(child.parent_object_hash, firstVersion.object_hash);
  assert.equal(child.evidence_family_id, firstVersion.evidence_family_id);
  assert.equal(w.row("evidence_drafts", "evidence_draft_id", first.evidence_draft_id).draft_status, "superseded");

  const family = await listEvidenceVersions._handler(w.as(reviewer), { evidenceFamilyId: firstVersion.evidence_family_id });
  assert.deepEqual(family.map((row) => row.version_index), [1, 2]);
  // the first observation stays retrievable exactly as recorded
  const retrieved = await getEvidenceVersion._handler(w.as(reviewer), { objectHash: firstVersion.object_hash });
  assert.equal(retrieved.verification.valid, true);
  assert.equal(envelopeOf(retrieved).payload.evidence.current_observation_status, "currently_used_for_worship");
});

const segment = (index, overrides = {}) => ({
  contract_version: "occupancy_v1",
  segment_index: index,
  start_mode: "known",
  start_date: "1905",
  start_basis: "founding_stated",
  end_mode: "known",
  end_date: "1960",
  end_basis: "closure_stated",
  end_reason: "closed",
  location_relation: "same_as_task_point",
  confidence: "high",
  confidence_basis: "The dated directory entry was read directly.",
  source_basis: "named_public_source",
  source_title: "Diocesan directory 2016",
  source_reference: "https://example.org/directory/2016",
  source_account: "The directory records worship use through July 2016.",
  privacy_flag: "clear",
  ...overrides,
});

test("an occupancy set recorded against submitted evidence becomes a sorted child version", async () => {
  const w = await scene();
  await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a" });
  const parentVersion = version(w);

  // the segments arrive out of order; the payload must not depend on that
  await submitOccupancies._handler(w.as(w.ra), {
    clientSubmissionId: submissionId(21),
    taskId: "task_1",
    parentEvidenceDraftId: "task_1:draft_a",
    segments: [
      segment(1, { start_date: "1961", start_basis: "reopening_stated", end_mode: "still_active", end_basis: "unknown", end_reason: undefined, end_date: undefined, still_active_asof: "2016-07" }),
      segment(0),
    ],
  });

  assert.equal(w.rows.site_occupancies.length, 2);
  assert.equal(w.rows.evidence_versions.length, 2);
  const child = version(w, 1);
  assert.equal(child.version_kind, "occupancy_set_recorded");
  assert.equal(child.version_index, 2);
  assert.equal(child.parent_object_hash, parentVersion.object_hash);
  assert.equal(child.evidence_family_id, parentVersion.evidence_family_id);

  const occupancies = envelopeOf(child).payload.occupancies;
  assert.deepEqual(occupancies.map((row) => row.segment_index), [0, 1]);
  assert.deepEqual(
    occupancies.map((row) => row.occupancy_id),
    w.rows.site_occupancies.map((row) => row.occupancy_id).sort(),
  );
  assert.equal(occupancies[0].start_date, "1905");
  assert.equal(occupancies[1].still_active_asof, "2016-07");
  // locators and coordination state stay out of the payload
  assert.equal(occupancies[0].claim_status, undefined);
  assert.equal(occupancies[0].submission_key, undefined);
  assert.deepEqual(verifyEvidenceVersionEnvelope(envelopeOf(child)).errors, []);

  const noted = w.events("note_added").filter((event) => event.evidence_version_hash === child.object_hash);
  assert.equal(noted.length, 1);
});

async function derivedScene() {
  const w = await scene();
  await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a" });
  for (const year of [2013, 2018]) {
    await w.db.insert("derived_target_year_states", {
      derived_state_id: `task_1:draft_a:presence:${year}`,
      task_id: "task_1",
      parent_evidence_draft_id: "task_1:draft_a",
      target_year: year,
      derived_status: "present",
      rule_id: "inside_interval",
      segment_rules: [],
      derivation_version: "occupancy_derivation_v1",
      inputs_hash: "inputs",
      review_state: "derived_unconfirmed",
      conflicts_observation: false,
      created_at: Date.now(),
      updated_at: Date.now(),
    });
  }
  return w;
}

test("a reviewer's confirmation of a derived year writes the status and a child version", async () => {
  const w = await derivedScene();
  const parentVersion = version(w);

  const decision = await decideDerivedYear._handler(w.as(w.reviewer), {
    taskId: "task_1",
    parentEvidenceDraftId: "task_1:draft_a",
    targetYear: 2013,
    action: "confirm",
  });
  assert.equal(decision.review_state, "reviewer_confirmed");
  assert.equal(decision.written_status, "present");
  assert.equal(w.draft.target_year_statuses["2013"], "present");
  assert.equal(w.draft.target_year_basis["2013"], "reviewer_confirmed_derivation");

  assert.equal(w.rows.evidence_versions.length, 2);
  const child = version(w, 1);
  assert.equal(child.version_kind, "reviewer_derivation_decision");
  assert.equal(child.version_index, 2);
  assert.equal(child.parent_object_hash, parentVersion.object_hash);
  assert.equal(child.evidence_family_id, parentVersion.evidence_family_id);
  assert.equal(child.created_by, w.reviewer._id);
  assert.equal(envelopeOf(child).payload.evidence.target_year_statuses["2013"], "present");
  const noted = w.events("note_added").filter((event) => event.evidence_version_hash === child.object_hash);
  assert.equal(noted.length, 1);
});

test("a rejected derived year records no evidence version", async () => {
  const w = await derivedScene();
  const parentEnvelopeJson = version(w).envelope_json;

  const decision = await decideDerivedYear._handler(w.as(w.reviewer), {
    taskId: "task_1",
    parentEvidenceDraftId: "task_1:draft_a",
    targetYear: 2018,
    action: "reject",
    note: "The source does not support this year.",
  });
  assert.equal(decision.review_state, "reviewer_rejected");
  assert.equal(decision.written_status, null);
  assert.equal(w.draft.target_year_statuses, undefined);

  assert.equal(
    w.rows.evidence_versions.length,
    1,
    "a rejection changes no submitted content, so it should record no version",
  );
  assert.equal(version(w).envelope_json, parentEnvelopeJson);
  assert.equal(w.draft.evidence_version_hash, version(w).object_hash);
});

test("an unresolved note records its own version and event", async () => {
  const w = await scene();
  const result = await submitUnresolvedNote._handler(w.as(w.ra), {
    evidenceDraftId: "task_1:draft_a",
    note: "The directory entry is ambiguous about the address.",
  });
  assert.equal(w.rows.evidence_versions.length, 1);
  const recorded = version(w);
  assert.equal(recorded.version_kind, "unresolved_note");
  assert.equal(result.evidence_version_hash, recorded.object_hash);
  assert.equal(w.draft.draft_status, "unresolved_note");
  const noted = w.events("submitted_unresolved_note");
  assert.equal(noted.length, 1);
  assert.equal(noted[0].evidence_version_hash, recorded.object_hash);
  assert.deepEqual(verifyEvidenceVersionEnvelope(envelopeOf(recorded)).errors, []);
});

test("versions are listed by draft and by family under the caller's visibility", async () => {
  const w = await scene({ country: "VU" });
  await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a" });
  const first = version(w);
  await saveEvidenceDraft._handler(w.as(w.reviewer), {
    taskId: "task_1",
    evidenceDraftId: "task_1:draft_a",
    draft: draftContent({ evidence_note: "The reviewer added the parish name from the same directory." }),
  });

  const byDraft = await listEvidenceVersions._handler(w.as(w.reviewer), { evidenceDraftId: "task_1:draft_a" });
  assert.deepEqual(byDraft.map((row) => row.version_index), [1, 2]);
  // an RA sees only the versions they recorded
  const asAuthor = await listEvidenceVersions._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a" });
  assert.deepEqual(asAuthor.map((row) => row.object_hash), [first.object_hash]);
  const asStranger = await listEvidenceVersions._handler(w.as(w.otherRa), { evidenceDraftId: "task_1:draft_a" });
  assert.deepEqual(asStranger, []);

  await assert.rejects(
    listEvidenceVersions._handler(w.as(w.reviewer), { evidenceDraftId: "task_1:draft_a", evidenceFamilyId: "task_1:draft_a" }),
    /either an evidence draft id or an evidence family id/,
  );
  await assert.rejects(
    getEvidenceVersion._handler(w.as(w.reviewer), { objectHash: "not-a-hash" }),
    /objectHash must be a pow-object\.v1 hash/,
  );
});

test("retiring an earlier parent's period set records a version on that parent", async () => {
  // the ordinary revise-and-resubmit flow: the author's later set on the
  // revision clone supersedes the set on the earlier submission, which must
  // then say so in its own version rather than diverge silently
  const w = await scene({ country: "VU" });
  await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a" });
  await submitOccupancies._handler(w.as(w.ra), {
    clientSubmissionId: submissionId(31),
    taskId: "task_1",
    parentEvidenceDraftId: "task_1:draft_a",
    segments: [segment(0)],
  });
  const before = await verifyDraftAgainstVersion._handler(w.as(w.reviewer), { evidenceDraftId: "task_1:draft_a" });
  assert.equal(before.consistent, true);
  assert.equal(envelopeOf(version(w, 1)).payload.occupancies.length, 1);

  const revision = await reviseEvidenceDraft._handler(w.as(w.ra), { taskId: "task_1" });
  await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: revision.evidence_draft_id });
  await submitOccupancies._handler(w.as(w.ra), {
    clientSubmissionId: submissionId(32),
    taskId: "task_1",
    parentEvidenceDraftId: revision.evidence_draft_id,
    segments: [segment(0, { start_date: "1906" })],
  });

  const earlierRows = w.rows.site_occupancies.filter((row) => row.parent_evidence_draft_id === "task_1:draft_a");
  assert.deepEqual(earlierRows.map((row) => row.claim_status), ["superseded"]);
  const retired = w.rows.evidence_versions.filter((row) => row.version_kind === "superseded_by_later_set");
  assert.equal(retired.length, 1);
  assert.equal(retired[0].evidence_draft_id, "task_1:draft_a");
  // the earlier parent is already superseded when its set is retired: this
  // bookkeeping is the one write onto a retired record the lifecycle rule
  // allows, and it is recorded as a version rather than made silently
  assert.equal(w.draft.draft_status, "superseded");
  assert.equal(retired[0].parent_object_hash, version(w, 1).object_hash);
  assert.deepEqual(envelopeOf(retired[0]).payload.occupancies, []);
  assert.equal(w.draft.evidence_version_hash, retired[0].object_hash);
  const after = await verifyDraftAgainstVersion._handler(w.as(w.reviewer), { evidenceDraftId: "task_1:draft_a" });
  assert.equal(after.consistent, true, after.errors.join("; "));
  const clone = await verifyDraftAgainstVersion._handler(w.as(w.reviewer), { evidenceDraftId: revision.evidence_draft_id });
  assert.equal(clone.consistent, true, clone.errors.join("; "));
});

test("a decided or superseded record cannot be rewritten in place by anyone", async () => {
  const w = await scene();
  await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a" });
  const envelopeJson = version(w).envelope_json;
  for (const status of ["accepted_for_export", "rejected", "superseded", "withdrawn"]) {
    await w.db.patch(w.draft._id, { draft_status: status });
    await assert.rejects(
      saveEvidenceDraft._handler(w.as(w.reviewer), { taskId: "task_1", evidenceDraftId: "task_1:draft_a", draft: draftContent({ evidence_note: "rewritten" }) }),
      /stays on record/,
    );
    assert.equal(w.draft.draft_status, status);
    assert.equal(w.draft.evidence_note, draftContent().evidence_note);
  }
  assert.equal(w.rows.evidence_versions.length, 1);
  assert.equal(version(w).envelope_json, envelopeJson);
});

test("a reviewer edit of an unresolved note keeps its status and records a child version", async () => {
  const w = await scene();
  await submitUnresolvedNote._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a", note: "Partial evidence for discussion." });
  const first = version(w);
  await saveEvidenceDraft._handler(w.as(w.reviewer), { taskId: "task_1", evidenceDraftId: "task_1:draft_a", draft: draftContent({ evidence_note: "Reviewer clarified the note." }) });
  assert.equal(w.draft.draft_status, "unresolved_note");
  assert.equal(w.rows.evidence_versions.length, 2);
  const child = version(w, 1);
  assert.equal(child.version_kind, "reviewer_edit");
  assert.equal(child.parent_object_hash, first.object_hash);
  assert.equal(child.created_by, w.reviewer._id);
  const audit = await verifyDraftAgainstVersion._handler(w.as(w.reviewer), { evidenceDraftId: "task_1:draft_a" });
  assert.equal(audit.consistent, true);
});

test("a reused open revision refuses a different intent instead of ignoring it", async () => {
  const w = await scene({ country: "VU" });
  await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a" });
  const opened = await reviseEvidenceDraft._handler(w.as(w.ra), { taskId: "task_1" });
  await assert.rejects(
    reviseEvidenceDraft._handler(w.as(w.ra), { taskId: "task_1", intent: "new_observation" }),
    /started as a correction/,
  );
  const again = await reviseEvidenceDraft._handler(w.as(w.ra), { taskId: "task_1", intent: "correction" });
  assert.equal(again.evidence_draft_id, opened.evidence_draft_id);
  const clone = w.row("evidence_drafts", "evidence_draft_id", opened.evidence_draft_id);
  assert.equal(clone.revision_intent, "correction");
});

test("confirming several derived years keeps every year and records one version holding them all", async () => {
  const w = await derivedScene();
  const result = await confirmAllDerived._handler(w.as(w.reviewer), { taskId: "task_1", parentEvidenceDraftId: "task_1:draft_a" });
  assert.deepEqual(result.confirmed, [2013, 2018]);
  assert.deepEqual(w.draft.target_year_statuses, { "2013": "present", "2018": "present" });
  assert.equal(w.rows.evidence_versions.length, 2);
  const child = version(w, 1);
  assert.deepEqual(envelopeOf(child).payload.evidence.target_year_statuses, { "2013": "present", "2018": "present" });
  const audit = await verifyDraftAgainstVersion._handler(w.as(w.reviewer), { evidenceDraftId: "task_1:draft_a" });
  assert.equal(audit.consistent, true);
});

// finding (2026-09-11 review, lineage): resolveLineage read the source row's
// current hash at submission, so a reviewer edit made after the contributor
// opened a revision became the correction's parent
test("a correction's parent is the version the contributor cloned, not a reviewer edit made after the revision opened", async () => {
  const w = await scene({ country: "VU" });
  await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a" });
  const cloned = version(w);

  const revision = await reviseEvidenceDraft._handler(w.as(w.ra), { taskId: "task_1" });
  const clone = w.row("evidence_drafts", "evidence_draft_id", revision.evidence_draft_id);
  assert.equal(clone.revision_of_evidence_draft_id, "task_1:draft_a");
  assert.equal(clone.revision_of_version_hash, cloned.object_hash);

  await saveEvidenceDraft._handler(w.as(w.reviewer), {
    taskId: "task_1",
    evidenceDraftId: "task_1:draft_a",
    draft: draftContent({ evidence_note: "Reviewer updated after the contributor cloned the original." }),
  });
  const reviewerVersion = version(w, 1);
  assert.equal(reviewerVersion.version_kind, "reviewer_edit");
  assert.equal(w.draft.evidence_version_hash, reviewerVersion.object_hash);

  await saveEvidenceDraft._handler(w.as(w.ra), {
    taskId: "task_1",
    evidenceDraftId: revision.evidence_draft_id,
    draft: draftContent({ evidence_note: "Corrected by the contributor from the version they cloned." }),
  });
  await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: revision.evidence_draft_id });

  const correction = version(w, 2);
  assert.equal(correction.parent_object_hash, cloned.object_hash);
  assert.notEqual(correction.parent_object_hash, reviewerVersion.object_hash);
  assert.equal(correction.evidence_family_id, cloned.evidence_family_id);
  assert.equal(correction.version_index, 3);
  assert.deepEqual(envelopeOf(correction).parent_object_hashes, [cloned.object_hash]);
  // the family branches at the cloned version: the reviewer's edit and the
  // contributor's correction are siblings, and the reviewer's version stays
  assert.equal(reviewerVersion.parent_object_hash, cloned.object_hash);
  const family = await listEvidenceVersions._handler(w.as(w.reviewer), { evidenceFamilyId: cloned.evidence_family_id });
  assert.deepEqual(family.map((row) => row.version_index), [1, 2, 3]);
  // the pinned hash is a locator, not content: it is outside the payload
  assert.equal(envelopeOf(correction).payload.evidence.revision_of_version_hash, undefined);
});

test("a guided correction's parent is the pinned version although its own submission retires the source's period set", async () => {
  const w = await scene();
  await w.db.patch(w.task._id, { assigned_to: w.ra._id });
  const first = await submitEvidenceDraftWithOccupancies._handler(w.as(w.ra), {
    evidenceDraftId: "task_1:draft_a",
    clientSubmissionId: submissionId(41),
    segments: [segment(0)],
  });
  const a1 = version(w);
  assert.equal(a1.version_kind, "guided_submission");
  assert.equal(first.evidence_version_hash, a1.object_hash);
  assert.equal(envelopeOf(a1).payload.occupancies.length, 1);

  const revision = await reviseEvidenceDraft._handler(w.as(w.ra), { taskId: "task_1" });
  assert.equal(w.row("evidence_drafts", "evidence_draft_id", revision.evidence_draft_id).revision_of_version_hash, a1.object_hash);
  await saveEvidenceDraft._handler(w.as(w.ra), {
    taskId: "task_1",
    evidenceDraftId: revision.evidence_draft_id,
    draft: draftContent({ evidence_note: "The founding year was misread; corrected from the directory." }),
  });
  const correctionArgs = {
    evidenceDraftId: revision.evidence_draft_id,
    clientSubmissionId: submissionId(42),
    segments: [segment(0, { start_date: "1906" })],
  };
  const second = await submitEvidenceDraftWithOccupancies._handler(w.as(w.ra), correctionArgs);

  // in the same transaction, the source's set was retired and the source
  // took a bookkeeping version after the one the contributor cloned
  const retired = w.rows.evidence_versions.filter((row) => row.version_kind === "superseded_by_later_set");
  assert.equal(retired.length, 1);
  assert.equal(retired[0].evidence_draft_id, "task_1:draft_a");
  assert.equal(retired[0].parent_object_hash, a1.object_hash);
  assert.equal(w.draft.evidence_version_hash, retired[0].object_hash);
  assert.equal(w.draft.draft_status, "superseded");

  const correction = w.row("evidence_versions", "object_hash", second.evidence_version_hash);
  assert.equal(correction.version_kind, "guided_submission");
  assert.equal(correction.parent_object_hash, a1.object_hash);
  assert.notEqual(correction.parent_object_hash, retired[0].object_hash);
  assert.equal(correction.evidence_family_id, a1.evidence_family_id);
  assert.equal(envelopeOf(correction).payload.occupancies.length, 1);

  // the retry answers with the correction's own version, from its receipt
  const retry = await submitEvidenceDraftWithOccupancies._handler(w.as(w.ra), correctionArgs);
  assert.equal(retry.deduped, true);
  assert.equal(retry.evidence_version_hash, second.evidence_version_hash);
  assert.equal(w.rows.evidence_versions.length, 3);
  for (const id of ["task_1:draft_a", revision.evidence_draft_id]) {
    const audit = await verifyDraftAgainstVersion._handler(w.as(w.reviewer), { evidenceDraftId: id });
    assert.equal(audit.consistent, true, audit.errors.join("; "));
  }
});

test("a new dated observation follows the version pinned when it was opened", async () => {
  const w = await scene({ country: "VU" });
  await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a" });
  const first = version(w);
  const revision = await reviseEvidenceDraft._handler(w.as(w.ra), { taskId: "task_1", intent: "new_observation" });
  await saveEvidenceDraft._handler(w.as(w.reviewer), {
    taskId: "task_1",
    evidenceDraftId: "task_1:draft_a",
    draft: draftContent({ evidence_note: "Reviewer clarified the earlier observation." }),
  });
  const reviewerVersion = version(w, 1);
  await saveEvidenceDraft._handler(w.as(w.ra), {
    taskId: "task_1",
    evidenceDraftId: revision.evidence_draft_id,
    draft: draftContent({ source_type: "field_observation", source_title: "Site visit", source_date_or_capture_date: "2026-09-10", evidence_note: "Services observed on the visit." }),
  });
  await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: revision.evidence_draft_id });
  const started = version(w, 2);
  assert.equal(started.parent_object_hash, undefined);
  assert.equal(started.evidence_family_id, revision.evidence_draft_id);
  assert.equal(started.version_index, 1);
  const payload = envelopeOf(started).payload;
  assert.equal(payload.follows_evidence_draft_id, "task_1:draft_a");
  assert.equal(payload.follows_object_hash, first.object_hash);
  assert.notEqual(payload.follows_object_hash, reviewerVersion.object_hash);
});

test("a correction of a pre-contract submission stays parentless even when the source is migrated before the correction is submitted", async () => {
  const w = await scene({ country: "VU", taskStatus: "needs_review", draft: { draft_status: "submitted" } });
  const revision = await reviseEvidenceDraft._handler(w.as(w.ra), { taskId: "task_1" });
  const clone = w.row("evidence_drafts", "evidence_draft_id", revision.evidence_draft_id);
  assert.equal(clone.revision_of_evidence_draft_id, "task_1:draft_a");
  assert.equal(clone.revision_of_version_hash, undefined);

  const migrated = await recordMigrationVersion._handler(w.as(w.admin), { evidenceDraftId: "task_1:draft_a", migrationRunId: "evidence-version-migration-2026-09" });
  assert.equal(w.draft.evidence_version_hash, migrated.object_hash);

  await saveEvidenceDraft._handler(w.as(w.ra), {
    taskId: "task_1",
    evidenceDraftId: revision.evidence_draft_id,
    draft: draftContent({ evidence_note: "Corrected after the legacy submission." }),
  });
  await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: revision.evidence_draft_id });
  const correction = w.rows.evidence_versions.find((row) => row.evidence_draft_id === revision.evidence_draft_id);
  assert.equal(correction.parent_object_hash, undefined);
  assert.equal(correction.evidence_family_id, revision.evidence_draft_id);
  assert.equal(correction.version_index, 1);
  const payload = envelopeOf(correction).payload;
  assert.equal(payload.revises_evidence_draft_id, "task_1:draft_a");
  assert.equal(payload.parent_version_unavailable, "pre_contract");
  assert.deepEqual(envelopeOf(correction).parent_object_hashes, []);
});

test("a rapid correction pins the version it corrects, and a pre-contract observation is corrected without an invented parent", async () => {
  const w = world();
  const ra = await w.addUser("ra-subject", ["ra"]);
  await w.addTask({ task_id: "vu_task", batch_id: "manual-vu", country_code: "VU", status: "in_progress", assigned_to: ra._id, target_years: [] });
  const first = await submitCurrentObservation._handler(w.as(ra), { clientSubmissionId: submissionId(71), taskId: "vu_task", observation: rapidObservation() });
  const corrected = await submitCurrentObservation._handler(w.as(ra), {
    clientSubmissionId: submissionId(72),
    taskId: "vu_task",
    observation: rapidObservation({ current_status: "place_exists_worship_uncertain", direct_observation: "The building stands, but no service was in progress and no notice board was visible." }),
  });
  const correctedRow = w.row("evidence_drafts", "evidence_draft_id", corrected.evidence_draft_id);
  assert.equal(correctedRow.revision_of_evidence_draft_id, first.evidence_draft_id);
  assert.equal(correctedRow.revision_of_version_hash, first.evidence_version_hash);
  assert.equal(version(w, 1).parent_object_hash, first.evidence_version_hash);

  // a legacy rapid observation awaiting review, recorded before the contract
  const legacy = world();
  const observer = await legacy.addUser("observer-subject", ["ra"]);
  await legacy.addTask({ task_id: "vu_legacy", batch_id: "manual-vu", country_code: "VU", status: "needs_review", assigned_to: observer._id, target_years: [] });
  const now = Date.now();
  await legacy.db.insert("evidence_drafts", {
    evidence_draft_id: `vu_legacy:${observer._id}:rapid:legacy`,
    task_id: "vu_legacy",
    draft_status: "submitted",
    created_by: observer._id,
    created_at: now,
    updated_at: now,
    observation_contract_version: "rapid_current_v1",
    intake_submission_key: `${observer._id}:legacy`,
    source_date_or_capture_date: "2026-08-01",
    privacy_flag: "clear",
    licence_flag: "needs_review",
  });
  const legacyCorrection = await submitCurrentObservation._handler(legacy.as(observer), { clientSubmissionId: submissionId(73), taskId: "vu_legacy", observation: rapidObservation() });
  assert.equal(legacyCorrection.corrected, true);
  const only = version(legacy);
  assert.equal(only.parent_object_hash, undefined);
  assert.equal(only.evidence_family_id, legacyCorrection.evidence_draft_id);
  assert.equal(envelopeOf(only).payload.parent_version_unavailable, "pre_contract");
  assert.equal(envelopeOf(only).payload.revises_evidence_draft_id, `vu_legacy:${observer._id}:rapid:legacy`);
});

// finding (2026-09-11 review, receipts): the content-dedupe branch returned
// the existing version without recording the token, so after a reviewer
// edit the same token answered with a different hash
test("a submission token stays bound to the version it received even when the content was deduped", async () => {
  const w = await scene({ country: "VU" });
  await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a" });
  const first = version(w);
  const retryArgs = { evidenceDraftId: "task_1:draft_a", clientSubmissionId: submissionId(99) };
  const tokened = await submitEvidenceDraft._handler(w.as(w.ra), retryArgs);
  assert.equal(tokened.deduped, true);
  assert.equal(tokened.evidence_version_hash, first.object_hash);
  assert.equal(w.rows.evidence_versions.length, 1);
  const receipts = w.rows.evidence_submission_receipts;
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0].submission_key, `submit:${w.ra._id}:${submissionId(99)}`);
  assert.equal(receipts[0].route, "submit");
  assert.equal(receipts[0].evidence_draft_id, "task_1:draft_a");
  assert.equal(receipts[0].object_hash, first.object_hash);
  assert.equal(receipts[0].version_created, false);
  assert.equal(receipts[0].created_by, w.ra._id);
  // the version row was not patched to hold the token
  assert.equal(first.idempotency_key, undefined);
  const firstEnvelopeJson = first.envelope_json;

  await saveEvidenceDraft._handler(w.as(w.reviewer), {
    taskId: "task_1",
    evidenceDraftId: "task_1:draft_a",
    draft: draftContent({ evidence_note: "A changed evidence note from the reviewer." }),
  });
  assert.equal(w.rows.evidence_versions.length, 2);
  assert.equal(w.draft.evidence_version_hash, version(w, 1).object_hash);

  const again = await submitEvidenceDraft._handler(w.as(w.ra), retryArgs);
  assert.equal(again.deduped, true);
  assert.equal(again.evidence_version_hash, first.object_hash);
  assert.equal(w.rows.evidence_versions.length, 2);
  assert.equal(w.rows.evidence_submission_receipts.length, 1);
  assert.equal(first.envelope_json, firstEnvelopeJson);

  // the token cannot be spent on another draft
  await w.addDraft({ evidence_draft_id: "task_1:draft_b", task_id: "task_1", created_by: w.ra._id });
  await assert.rejects(
    submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_b", clientSubmissionId: submissionId(99) }),
    /submission identifier is already in use/,
  );
  assert.equal(w.row("evidence_drafts", "evidence_draft_id", "task_1:draft_b").draft_status, "draft");
  assert.equal(w.rows.evidence_submission_receipts.length, 1);
});

test("an unchanged submission by another actor dedupes to the same version under that actor's own receipt", async () => {
  const w = await scene({ country: "VU" });
  const mine = await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a", clientSubmissionId: submissionId(51) });
  const theirs = await submitEvidenceDraft._handler(w.as(w.reviewer), { evidenceDraftId: "task_1:draft_a", clientSubmissionId: submissionId(52) });
  assert.equal(theirs.deduped, true);
  assert.equal(theirs.evidence_version_hash, mine.evidence_version_hash);
  assert.equal(w.rows.evidence_versions.length, 1);
  assert.equal(version(w).created_by, w.ra._id);
  const receipts = w.rows.evidence_submission_receipts;
  assert.deepEqual(
    receipts.map((row) => [row.created_by, row.version_created, row.object_hash]),
    [[w.ra._id, true, mine.evidence_version_hash], [w.reviewer._id, false, mine.evidence_version_hash]],
  );
  // each caller's later retry is answered from their own receipt
  const theirRetry = await submitEvidenceDraft._handler(w.as(w.reviewer), { evidenceDraftId: "task_1:draft_a", clientSubmissionId: submissionId(52) });
  assert.equal(theirRetry.evidence_version_hash, mine.evidence_version_hash);
  assert.equal(w.rows.evidence_submission_receipts.length, 2);
});

// finding (2026-09-11 review, rapid retry): the existingDraft branch omitted
// evidence_version_hash
test("a rapid retry returns the version its submission received, after later versions too", async () => {
  const w = world();
  const ra = await w.addUser("ra-subject", ["ra"]);
  await w.addTask({ task_id: "vu_task", batch_id: "manual-vu", country_code: "VU", status: "in_progress", assigned_to: ra._id, target_years: [] });
  const args = { clientSubmissionId: submissionId(61), taskId: "vu_task", observation: rapidObservation() };
  const first = await submitCurrentObservation._handler(w.as(ra), args);
  assert.ok(first.evidence_version_hash);
  const retry = await submitCurrentObservation._handler(w.as(ra), args);
  assert.equal(retry.deduped, true);
  assert.equal(retry.evidence_version_hash, first.evidence_version_hash);
  assert.equal(retry.evidence_version_unavailable, undefined);
  assert.equal(retry.corrected, false);

  // periods recorded on the observation move the row to a later version
  await submitOccupancies._handler(w.as(ra), {
    clientSubmissionId: submissionId(62),
    taskId: "vu_task",
    parentEvidenceDraftId: first.evidence_draft_id,
    segments: [segment(0)],
  });
  const row = w.row("evidence_drafts", "evidence_draft_id", first.evidence_draft_id);
  assert.notEqual(row.evidence_version_hash, first.evidence_version_hash);
  const later = await submitCurrentObservation._handler(w.as(ra), args);
  assert.equal(later.deduped, true);
  assert.equal(later.evidence_version_hash, first.evidence_version_hash);
  assert.equal(w.rows.evidence_versions.length, 2);

  // a retried correction reports what it corrected
  const correctionArgs = {
    clientSubmissionId: submissionId(63),
    taskId: "vu_task",
    observation: rapidObservation({ current_status: "place_exists_worship_uncertain", direct_observation: "The building stands, but no service was in progress and no notice board was visible." }),
  };
  const corrected = await submitCurrentObservation._handler(w.as(ra), correctionArgs);
  const correctedRetry = await submitCurrentObservation._handler(w.as(ra), correctionArgs);
  assert.equal(correctedRetry.deduped, true);
  assert.equal(correctedRetry.corrected, true);
  assert.equal(correctedRetry.superseded_evidence_draft_id, first.evidence_draft_id);
  assert.equal(correctedRetry.evidence_version_hash, corrected.evidence_version_hash);
});

test("a rapid retry of a pre-contract observation states that no version exists rather than inventing one", async () => {
  const w = world();
  const ra = await w.addUser("ra-subject", ["ra"]);
  await w.addTask({ task_id: "vu_task", batch_id: "manual-vu", country_code: "VU", status: "needs_review", assigned_to: ra._id, target_years: [] });
  const now = Date.now();
  await w.db.insert("evidence_drafts", {
    evidence_draft_id: `vu_task:${ra._id}:rapid:${submissionId(64)}`,
    task_id: "vu_task",
    draft_status: "submitted",
    created_by: ra._id,
    created_at: now,
    updated_at: now,
    observation_contract_version: "rapid_current_v1",
    intake_submission_key: `${ra._id}:${submissionId(64)}`,
    privacy_flag: "clear",
    licence_flag: "needs_review",
  });
  const retry = await submitCurrentObservation._handler(w.as(ra), { clientSubmissionId: submissionId(64), taskId: "vu_task", observation: rapidObservation() });
  assert.equal(retry.deduped, true);
  assert.equal(retry.evidence_version_hash, undefined);
  assert.equal(retry.evidence_version_unavailable, "pre_contract");
  assert.equal(w.rows.evidence_versions.length, 0);
  assert.equal(w.rows.evidence_submission_receipts.length, 0);
});

// finding (2026-09-11 review, lifecycle): decideDerivedYear changed an
// accepted_for_export row; the saveEvidenceDraft guard did not cover it
test("derivation decisions are refused on decided, superseded, or withdrawn evidence and leave it untouched", async () => {
  for (const status of ["accepted_for_export", "rejected", "superseded", "withdrawn"]) {
    const w = await derivedScene();
    const envelopeJson = version(w).envelope_json;
    await w.db.patch(w.draft._id, { draft_status: status });
    const base = { taskId: "task_1", parentEvidenceDraftId: "task_1:draft_a" };
    await assert.rejects(decideDerivedYear._handler(w.as(w.reviewer), { ...base, targetYear: 2013, action: "confirm" }), /stays on record/);
    await assert.rejects(
      decideDerivedYear._handler(w.as(w.reviewer), { ...base, targetYear: 2013, action: "override", note: "Override attempted on a decided record.", override: { status: "absent" } }),
      /stays on record/,
    );
    await assert.rejects(decideDerivedYear._handler(w.as(w.reviewer), { ...base, targetYear: 2018, action: "reject", note: "Rejection attempted on a decided record." }), /stays on record/);
    await assert.rejects(confirmAllDerived._handler(w.as(w.reviewer), base), /stays on record/);
    assert.equal(w.draft.draft_status, status, status);
    assert.equal(w.draft.target_year_statuses, undefined, status);
    assert.equal(w.draft.target_year_basis, undefined, status);
    assert.equal(w.rows.evidence_versions.length, 1, status);
    assert.equal(version(w).envelope_json, envelopeJson, status);
    assert.equal(w.rows.derived_state_events.length, 0, status);
    assert.deepEqual(w.rows.derived_target_year_states.map((row) => row.review_state), ["derived_unconfirmed", "derived_unconfirmed"], status);
    const audit = await verifyDraftAgainstVersion._handler(w.as(w.reviewer), { evidenceDraftId: "task_1:draft_a" });
    assert.equal(audit.consistent, true, status);
  }
  // an unresolved note awaiting review still takes a decision
  const w = await derivedScene();
  await w.db.patch(w.draft._id, { draft_status: "unresolved_note" });
  const decision = await decideDerivedYear._handler(w.as(w.reviewer), { taskId: "task_1", parentEvidenceDraftId: "task_1:draft_a", targetYear: 2013, action: "confirm" });
  assert.equal(decision.written_status, "present");
  assert.equal(w.rows.evidence_versions.length, 2);
});

test("a spreadsheet re-import never rewrites a decided, superseded, or withdrawn row", async () => {
  for (const status of ["accepted_for_export", "rejected", "superseded", "withdrawn"]) {
    const w = await scene({ taskStatus: "needs_review" });
    await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a" });
    const envelopeJson = version(w).envelope_json;
    await w.db.patch(w.draft._id, { draft_status: status });
    const result = await importSubmittedEvidenceDrafts._handler(w.as(w.admin), {
      batch: { batch_id: "test-batch", country_code: "NZ", source_kind: "spreadsheet", target_years: [2013, 2018, 2023] },
      tasks: [],
      drafts: [{ task_id: "task_1", evidence_draft_id: "task_1:draft_a", draft: draftContent({ evidence_note: "Re-imported over a retired row." }) }],
    });
    assert.deepEqual(result.drafts, { inserted: 0, updated: 0, skipped_final: 1 }, status);
    assert.equal(w.draft.draft_status, status, status);
    assert.equal(w.draft.evidence_note, draftContent().evidence_note, status);
    assert.equal(w.rows.evidence_versions.length, 1, status);
    assert.equal(version(w).envelope_json, envelopeJson, status);
  }
});

// retirement, restoration, and approval (docs/development/evidence-versions.md,
// "Lifecycle: Retirement, Restoration, And Approval"): retired evidence stays
// visible and restorable, every retirement or restoration writes an
// evidence_head_changes ledger row, and acceptance pins the exact version it
// refers to so a later retirement, restoration, or write never transfers it.

test("the ledger records a version, a supersession naming the later draft, and a withdrawal with its reason", async () => {
  const w = await scene({ country: "VU" });
  await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a" });
  const firstVersion = version(w);

  const afterSubmit = await listEvidenceHeadChanges._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a" });
  assert.equal(afterSubmit.length, 1);
  assert.equal(afterSubmit[0].change_kind, "version_recorded");
  assert.equal(afterSubmit[0].version_kind, "submitted");
  assert.equal(afterSubmit[0].object_hash, firstVersion.object_hash);
  assert.equal(afterSubmit[0].previous_object_hash, undefined);
  assert.equal(afterSubmit[0].reason, "Submitted for review.");
  assert.equal(afterSubmit[0].changed_by, w.ra._id);

  // a later submission by the same author supersedes the first
  await w.addDraft({
    evidence_draft_id: "task_1:draft_b",
    task_id: "task_1",
    created_by: w.ra._id,
    ...draftContent({ evidence_note: "A second reading of the same directory, entered afresh." }),
  });
  await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_b" });

  const afterSupersede = await listEvidenceHeadChanges._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a" });
  assert.equal(afterSupersede.length, 2);
  assert.equal(afterSupersede[1].change_kind, "superseded");
  assert.equal(afterSupersede[1].previous_status, "submitted");
  assert.equal(afterSupersede[1].new_status, "superseded");
  assert.equal(afterSupersede[1].object_hash, firstVersion.object_hash);
  assert.match(afterSupersede[1].reason, /task_1:draft_b/);

  // withdrawal writes its own ledger entry, naming the given reason
  await withdrawEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_b", reason: "Wrong location entirely." });
  const draftBChanges = await listEvidenceHeadChanges._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_b" });
  const withdrawn = draftBChanges.at(-1);
  assert.equal(withdrawn.change_kind, "withdrawn");
  assert.equal(withdrawn.previous_status, "submitted");
  assert.equal(withdrawn.new_status, "withdrawn");
  assert.equal(withdrawn.reason, "Wrong location entirely.");

  // the ledger follows the same visibility as the version list
  await assert.rejects(
    listEvidenceHeadChanges._handler(w.as(w.otherRa), { evidenceDraftId: "task_1:draft_a" }),
    /belongs to another user/,
  );
});

test("retiring an earlier parent's period set by a later submission records a version_recorded ledger entry naming the later parent", async () => {
  const w = await scene({ country: "VU" });
  await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a" });
  await submitOccupancies._handler(w.as(w.ra), {
    clientSubmissionId: submissionId(201),
    taskId: "task_1",
    parentEvidenceDraftId: "task_1:draft_a",
    segments: [segment(0)],
  });

  const revision = await reviseEvidenceDraft._handler(w.as(w.ra), { taskId: "task_1" });
  await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: revision.evidence_draft_id });
  await submitOccupancies._handler(w.as(w.ra), {
    clientSubmissionId: submissionId(202),
    taskId: "task_1",
    parentEvidenceDraftId: revision.evidence_draft_id,
    segments: [segment(0, { start_date: "1906" })],
  });

  const changes = await listEvidenceHeadChanges._handler(w.as(w.reviewer), { evidenceDraftId: "task_1:draft_a" });
  const retirement = changes.at(-1);
  assert.equal(retirement.change_kind, "version_recorded");
  assert.equal(retirement.version_kind, "superseded_by_later_set");
  assert.match(retirement.reason, new RegExp(revision.evidence_draft_id));
});

test("a reviewer restores a superseded draft: status returns, the later active draft is superseded, and one draft_restored event is recorded", async () => {
  const w = await scene({ country: "VU" });
  await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a" });
  const firstVersion = version(w);
  const firstEnvelopeJson = firstVersion.envelope_json;

  await w.addDraft({
    evidence_draft_id: "task_1:draft_b",
    task_id: "task_1",
    created_by: w.ra._id,
    ...draftContent({ evidence_note: "A second reading of the same directory, entered afresh." }),
  });
  await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_b" });
  assert.equal(w.draft.draft_status, "superseded");

  const restored = await restoreEvidenceDraft._handler(w.as(w.reviewer), {
    evidenceDraftId: "task_1:draft_a",
    reason: "The later reading was a misprint; restoring the original.",
  });
  assert.equal(restored.draft_status, "submitted");
  assert.equal(restored.task_status, "needs_review");
  assert.equal(restored.evidence_version_hash, firstVersion.object_hash);
  assert.equal(w.draft.draft_status, "submitted");
  assert.equal(w.task.status, "needs_review");

  const laterDraft = w.row("evidence_drafts", "evidence_draft_id", "task_1:draft_b");
  assert.equal(laterDraft.draft_status, "superseded");

  const restoreEvents = w.events("draft_restored");
  assert.equal(restoreEvents.length, 1);
  assert.equal(restoreEvents[0].evidence_version_hash, firstVersion.object_hash);
  assert.equal(restoreEvents[0].reason, "The later reading was a misprint; restoring the original.");

  const changes = await listEvidenceHeadChanges._handler(w.as(w.reviewer), { evidenceDraftId: "task_1:draft_a" });
  const restoredEntry = changes.at(-1);
  assert.equal(restoredEntry.change_kind, "restored");
  assert.equal(restoredEntry.previous_status, "superseded");
  assert.equal(restoredEntry.new_status, "submitted");
  assert.equal(restoredEntry.reason, "The later reading was a misprint; restoring the original.");

  const draftBChanges = await listEvidenceHeadChanges._handler(w.as(w.reviewer), { evidenceDraftId: "task_1:draft_b" });
  const supersededByRestore = draftBChanges.at(-1);
  assert.equal(supersededByRestore.change_kind, "superseded");
  assert.match(supersededByRestore.reason, /restoration of task_1:draft_a/);

  // no content change and no new version: periods are not reinstated by
  // this route (there were none here), the version count is unchanged, and
  // the stored envelope is byte-identical
  assert.equal(w.rows.evidence_versions.length, 2);
  assert.equal(firstVersion.envelope_json, firstEnvelopeJson);
  const check = await verifyDraftAgainstVersion._handler(w.as(w.reviewer), { evidenceDraftId: "task_1:draft_a" });
  assert.equal(check.consistent, true, check.errors.join("; "));
});

test("the author may restore their own withdrawn draft", async () => {
  const w = await scene({ country: "VU" });
  await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a" });
  await withdrawEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a", reason: "Submitted the wrong file by mistake." });
  assert.equal(w.draft.draft_status, "withdrawn");
  assert.equal(w.task.status, "in_progress");

  const restored = await restoreEvidenceDraft._handler(w.as(w.ra), {
    evidenceDraftId: "task_1:draft_a",
    reason: "The file was in fact correct; restoring it.",
  });
  assert.equal(restored.draft_status, "submitted");
  assert.equal(w.draft.draft_status, "submitted");
  assert.equal(w.task.status, "needs_review");
});

test("a withdrawn unresolved note is restored to unresolved_note", async () => {
  const w = await scene({ country: "VU" });
  await submitUnresolvedNote._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a", note: "Ambiguous evidence; flagging for discussion." });
  assert.equal(w.draft.draft_status, "unresolved_note");
  await withdrawEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a", reason: "Withdrawing the note for now." });
  assert.equal(w.draft.draft_status, "withdrawn");

  const restored = await restoreEvidenceDraft._handler(w.as(w.ra), {
    evidenceDraftId: "task_1:draft_a",
    reason: "Reopening this for discussion again.",
  });
  assert.equal(restored.draft_status, "unresolved_note");
  assert.equal(w.draft.draft_status, "unresolved_note");
});

test("restoration is refused for a decided row, another RA, a short reason, or a closed task, and a refused restore changes nothing", async () => {
  {
    const w = await scene({ country: "VU" });
    await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a" });
    await w.db.patch(w.draft._id, { draft_status: "accepted_for_export" });
    await assert.rejects(
      restoreEvidenceDraft._handler(w.as(w.reviewer), { evidenceDraftId: "task_1:draft_a", reason: "Reconsidering this decision." }),
      /reconsidered through the review workflow/,
    );
    assert.equal(w.draft.draft_status, "accepted_for_export");
  }
  {
    const w = await scene({ country: "VU" });
    await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a" });
    await w.db.patch(w.draft._id, { draft_status: "rejected" });
    await assert.rejects(
      restoreEvidenceDraft._handler(w.as(w.reviewer), { evidenceDraftId: "task_1:draft_a", reason: "Reconsidering this decision." }),
      /reconsidered through the review workflow/,
    );
    assert.equal(w.draft.draft_status, "rejected");
  }
  {
    const w = await scene({ country: "VU" });
    await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a" });
    await w.db.patch(w.draft._id, { draft_status: "superseded" });
    await assert.rejects(
      restoreEvidenceDraft._handler(w.as(w.otherRa), { evidenceDraftId: "task_1:draft_a", reason: "Restoring this on their behalf." }),
      /belongs to another user/,
    );
    assert.equal(w.draft.draft_status, "superseded");
  }
  {
    const w = await scene({ country: "VU" });
    await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a" });
    await w.db.patch(w.draft._id, { draft_status: "superseded" });
    await assert.rejects(
      restoreEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a", reason: "short" }),
      /at least 8 characters/,
    );
    assert.equal(w.draft.draft_status, "superseded");
  }
  for (const status of ["reviewed", "pi_accepted", "exported"]) {
    const w = await scene({ country: "VU" });
    await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a" });
    await w.db.patch(w.draft._id, { draft_status: "superseded" });
    await w.db.patch(w.task._id, { status });
    await assert.rejects(
      restoreEvidenceDraft._handler(w.as(w.reviewer), { evidenceDraftId: "task_1:draft_a", reason: "Reopen and restore this evidence." }),
      /Reopen the task before restoring/,
      status,
    );
    assert.equal(w.draft.draft_status, "superseded", status);
    assert.equal(w.rows.evidence_head_changes.filter((row) => row.change_kind === "restored").length, 0, status);
  }
});

test("recordReviewDecision pins the version on the decision and its event; a pre-contract draft pins none", async () => {
  const w = await scene({ country: "VU" });
  await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a" });
  const v1 = version(w);
  const snapshot = await getReviewSnapshot._handler(w.as(w.reviewer), { taskId: "task_1", evidenceDraftId: "task_1:draft_a" });
  const decisionResult = await recordReviewDecision._handler(w.as(w.reviewer), {
    taskId: "task_1",
    decision: { evidence_draft_id: "task_1:draft_a", decision_status: "accepted_for_export", decision_note: "Checked the directory and the address." },
    snapshotHash: snapshot.snapshot_hash,
  });
  const decisionRow = w.row("review_decisions", "review_decision_id", decisionResult.review_decision_id);
  assert.equal(decisionRow.evidence_version_hash, v1.object_hash);
  const decidedEvent = w.events("review_decided").at(-1);
  assert.equal(decidedEvent.evidence_version_hash, v1.object_hash);

  const w2 = await scene({ country: "VU", taskStatus: "needs_review", draft: { draft_status: "submitted" } });
  const snapshot2 = await getReviewSnapshot._handler(w2.as(w2.reviewer), { taskId: "task_1", evidenceDraftId: "task_1:draft_a" });
  const decisionResult2 = await recordReviewDecision._handler(w2.as(w2.reviewer), {
    taskId: "task_1",
    decision: { evidence_draft_id: "task_1:draft_a", decision_status: "accepted_for_export", decision_note: "Checked the pre-contract record thoroughly." },
    snapshotHash: snapshot2.snapshot_hash,
  });
  const decisionRow2 = w2.row("review_decisions", "review_decision_id", decisionResult2.review_decision_id);
  assert.equal(decisionRow2.evidence_version_hash, undefined);
});

test("recordReviewDecision refuses accepted_for_export without a snapshot hash, and refuses a stale one, before any write", async () => {
  const w = await scene({ country: "VU" });
  await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a" });
  await assert.rejects(
    recordReviewDecision._handler(w.as(w.reviewer), {
      taskId: "task_1",
      decision: { evidence_draft_id: "task_1:draft_a", decision_status: "accepted_for_export", decision_note: "Checked the directory and the address." },
    }),
    /requires the review snapshot you inspected/,
  );
  assert.equal(w.rows.review_decisions.length, 0);
  await assert.rejects(
    recordReviewDecision._handler(w.as(w.reviewer), {
      taskId: "task_1",
      decision: { evidence_draft_id: "task_1:draft_a", decision_status: "accepted_for_export", decision_note: "Checked the directory and the address." },
      snapshotHash: "0".repeat(64),
    }),
    /Review snapshot is stale/,
  );
  assert.equal(w.rows.review_decisions.length, 0);
  assert.equal(w.rows.review_snapshots.length, 0);

  // a rejected decision needs no snapshot at all and stays on version 0
  const rejected = await recordReviewDecision._handler(w.as(w.reviewer), {
    taskId: "task_1",
    decision: { evidence_draft_id: "task_1:draft_a", decision_status: "rejected", decision_note: "The directory entry does not support this record." },
  });
  const rejectedRow = w.row("review_decisions", "review_decision_id", rejected.review_decision_id);
  assert.equal(rejectedRow.decision_hash_version, undefined);
  assert.equal(rejectedRow.review_snapshot_hash, undefined);
});

test("no silent transfer: a decided evidence record's periods retired by a later submission keep the decision pinned to the version it named", async () => {
  const w = await scene({ country: "VU" });
  await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a" });
  await submitOccupancies._handler(w.as(w.ra), {
    clientSubmissionId: submissionId(301),
    taskId: "task_1",
    parentEvidenceDraftId: "task_1:draft_a",
    segments: [segment(0)],
  });
  const a1 = version(w, 1);
  assert.equal(a1.version_kind, "occupancy_set_recorded");

  const snapshot301 = await getReviewSnapshot._handler(w.as(w.reviewer), { taskId: "task_1", evidenceDraftId: "task_1:draft_a" });
  const decisionResult = await recordReviewDecision._handler(w.as(w.reviewer), {
    taskId: "task_1",
    decision: { evidence_draft_id: "task_1:draft_a", decision_status: "accepted_for_export", decision_note: "Checked the dated directory entry and its periods." },
    snapshotHash: snapshot301.snapshot_hash,
  });
  const decision = w.row("review_decisions", "review_decision_id", decisionResult.review_decision_id);
  assert.equal(decision.evidence_version_hash, a1.object_hash);
  assert.equal(w.task.status, "reviewed");
  const draftARow = w.row("evidence_drafts", "evidence_draft_id", "task_1:draft_a");
  assert.equal(draftARow.draft_status, "accepted_for_export");

  // pi ruling 2026-09-11: new evidence on a reviewed task needs an explicit
  // reopen; the author reopens it before submitting a second, independent
  // evidence record
  await reopenTask._handler(w.as(w.ra), { taskId: "task_1", reason: "Reopening to add a second, independent record." });
  await saveEvidenceDraft._handler(w.as(w.ra), {
    taskId: "task_1",
    evidenceDraftId: "task_1:draft_b",
    draft: draftContent({ evidence_note: "A later reading of a different directory entry." }),
  });
  await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_b" });
  assert.equal(w.task.status, "needs_review");
  assert.equal(draftARow.draft_status, "accepted_for_export", "B's submission alone does not disturb A's decision");

  // periods recorded on B retire A's earlier active set
  await submitOccupancies._handler(w.as(w.ra), {
    clientSubmissionId: submissionId(302),
    taskId: "task_1",
    parentEvidenceDraftId: "task_1:draft_b",
    segments: [segment(0, { start_date: "1911" })],
  });
  const a2 = w.rows.evidence_versions.find(
    (row) => row.evidence_draft_id === "task_1:draft_a" && row.version_kind === "superseded_by_later_set",
  );
  assert.ok(a2, "expected a superseded_by_later_set version on A");
  assert.equal(draftARow.evidence_version_hash, a2.object_hash);
  assert.notEqual(a2.object_hash, a1.object_hash);
  assert.equal(draftARow.draft_status, "accepted_for_export", "the decided status is untouched by the retirement");

  // the decision still refers to the version the reviewer saw
  assert.equal(decision.evidence_version_hash, a1.object_hash);

  // the retirement of a decided parent's periods is loud: one note_added
  // event names the earlier and current versions (alongside the ordinary
  // "periods recorded" events from A's own earlier submission)
  const retirementNote = w.events("note_added").find(
    (event) => event.evidence_draft_id === "task_1:draft_a" && /decided evidence/.test(event.reason ?? ""),
  );
  assert.ok(retirementNote, "expected a note_added event naming the decided parent's retirement");
  assert.match(retirementNote.reason, /task_1:draft_a/);
  assert.match(retirementNote.reason, /task_1:draft_b/);
  assert.ok(retirementNote.reason.includes(a1.object_hash), "names the earlier version");
  assert.ok(retirementNote.reason.includes(a2.object_hash), "names the current version");
  assert.equal(retirementNote.evidence_version_hash, a2.object_hash);

  // the ledger entry for the retirement names the later parent
  const headChanges = await listEvidenceHeadChanges._handler(w.as(w.reviewer), { evidenceDraftId: "task_1:draft_a" });
  const retirement = headChanges.at(-1);
  assert.equal(retirement.change_kind, "version_recorded");
  assert.match(retirement.reason, /task_1:draft_b/);

  // the version the decision refers to is still valid and retrievable
  const retrieved = await getEvidenceVersion._handler(w.as(w.reviewer), { objectHash: a1.object_hash });
  assert.equal(retrieved.verification.valid, true);
});

test("PI acceptance and export batch refuse an accepted decision whose version has moved, and accept one that has not", async () => {
  const w = await scene({ country: "VU" });
  const pi = await w.addUser("pi-subject", ["pi"]);
  await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a" });
  await submitOccupancies._handler(w.as(w.ra), {
    clientSubmissionId: submissionId(311),
    taskId: "task_1",
    parentEvidenceDraftId: "task_1:draft_a",
    segments: [segment(0)],
  });
  const a1 = version(w, 1);
  const snapshot311 = await getReviewSnapshot._handler(w.as(w.reviewer), { taskId: "task_1", evidenceDraftId: "task_1:draft_a" });
  await recordReviewDecision._handler(w.as(w.reviewer), {
    taskId: "task_1",
    decision: { evidence_draft_id: "task_1:draft_a", decision_status: "accepted_for_export", decision_note: "Checked the dated directory entry and its periods." },
    snapshotHash: snapshot311.snapshot_hash,
  });

  await reopenTask._handler(w.as(w.ra), { taskId: "task_1", reason: "Reopening to add a second, independent record." });
  await saveEvidenceDraft._handler(w.as(w.ra), {
    taskId: "task_1",
    evidenceDraftId: "task_1:draft_b",
    draft: draftContent({ evidence_note: "A later, distinct directory reading." }),
  });
  await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_b" });
  await submitOccupancies._handler(w.as(w.ra), {
    clientSubmissionId: submissionId(312),
    taskId: "task_1",
    parentEvidenceDraftId: "task_1:draft_b",
    segments: [segment(0, { start_date: "1912" })],
  });
  const draftARow = w.row("evidence_drafts", "evidence_draft_id", "task_1:draft_a");
  assert.notEqual(draftARow.evidence_version_hash, a1.object_hash);

  // exercise the version guard directly: the task is set to the status
  // recordAcceptance itself requires (convex/lib/acceptance.ts), isolating
  // the version check from the ordinary task-status gate
  await w.db.patch(w.task._id, { status: "reviewed" });
  await assert.rejects(
    recordAcceptance._handler(w.as(pi), { taskId: "task_1", outcome: "accepted", note: "Ratifying the reviewer's decision." }),
    /The review decision refers to evidence version/,
  );

  await w.db.patch(w.task._id, { status: "pi_accepted" });
  await assert.rejects(
    createExportBatch._handler(w.as(w.admin), { countryCode: "VU", taskIds: ["task_1"] }),
    /re-review before export/,
  );

  // a decision whose version has not moved is ratified normally
  const untouched = await scene({ country: "VU" });
  await submitEvidenceDraft._handler(untouched.as(untouched.ra), { evidenceDraftId: "task_1:draft_a" });
  const untouchedSnapshot = await getReviewSnapshot._handler(untouched.as(untouched.reviewer), { taskId: "task_1", evidenceDraftId: "task_1:draft_a" });
  await recordReviewDecision._handler(untouched.as(untouched.reviewer), {
    taskId: "task_1",
    decision: { evidence_draft_id: "task_1:draft_a", decision_status: "accepted_for_export", decision_note: "Checked the untouched record thoroughly." },
    snapshotHash: untouchedSnapshot.snapshot_hash,
  });
  const untouchedPi = await untouched.addUser("pi-subject-2", ["pi"]);
  const accepted = await recordAcceptance._handler(untouched.as(untouchedPi), { taskId: "task_1", outcome: "accepted", note: "Ratifying the reviewer's decision." });
  assert.equal(accepted.task_status, "pi_accepted");
});

test("a draft withdrawn before it was ever submitted cannot be restored to submitted", async () => {
  const w = await scene({ country: "VU" });
  await withdrawEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a", reason: "Started on the wrong task." });
  assert.equal(w.draft.draft_status, "withdrawn");
  assert.equal(w.rows.evidence_versions.length, 0);
  await assert.rejects(
    restoreEvidenceDraft._handler(w.as(w.reviewer), { evidenceDraftId: "task_1:draft_a", reason: "Restore attempted on an unsubmitted draft." }),
    /withdrawn before it was submitted/,
  );
  assert.equal(w.draft.draft_status, "withdrawn");
  assert.equal(w.rows.evidence_versions.length, 0);
  assert.equal(w.rows.evidence_head_changes.filter((row) => row.change_kind === "restored").length, 0);
  assert.equal(w.events("draft_restored").length, 0);
  // a pre-ledger withdrawn row, with no ledger entry to show it was active, is refused the same way
  await w.addDraft({ evidence_draft_id: "task_1:legacy", task_id: "task_1", created_by: w.ra._id, draft_status: "withdrawn" });
  await assert.rejects(
    restoreEvidenceDraft._handler(w.as(w.reviewer), { evidenceDraftId: "task_1:legacy", reason: "Restore attempted on a pre-ledger row." }),
    /withdrawn before it was submitted/,
  );
});

// the intake gate (pi ruling 2026-09-11): once a task is reviewed,
// pi-accepted, or exported, no route may add or replace its evidence
// without an explicit reopen. every gated route refuses with the same
// message and writes nothing; a reopen restores it.

test("the intake gate refuses evidence on a reviewed, pi-accepted, or exported task and writes nothing; reopening restores each route", async () => {
  for (const status of ["reviewed", "pi_accepted", "exported"]) {
    // saveEvidenceDraft: today's bug is a save flipping the task to
    // draft_saved; the gate must fire before that write
    {
      const w = await scene({ taskStatus: status });
      await assert.rejects(
        saveEvidenceDraft._handler(w.as(w.ra), { taskId: "task_1", evidenceDraftId: "task_1:draft_a", draft: draftContent() }),
        /reviewed, accepted, or exported/,
        status,
      );
      assert.equal(w.task.status, status, status);
      assert.equal(w.draft.draft_status, "draft", status);
      assert.equal(w.rows.evidence_versions.length, 0, status);
      assert.equal(w.rows.task_events.length, 0, status);
      await reopenTask._handler(w.as(w.reviewer), { taskId: "task_1", reason: "Reopening to save evidence." });
      const saved = await saveEvidenceDraft._handler(w.as(w.ra), { taskId: "task_1", evidenceDraftId: "task_1:draft_a", draft: draftContent() });
      assert.equal(saved.evidence_draft_id, "task_1:draft_a", status);
    }
    // submitEvidenceDraft
    {
      const w = await scene({ taskStatus: status });
      await assert.rejects(
        submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a" }),
        /reviewed, accepted, or exported/,
        status,
      );
      assert.equal(w.task.status, status, status);
      assert.equal(w.draft.draft_status, "draft", status);
      assert.equal(w.rows.evidence_versions.length, 0, status);
      assert.equal(w.rows.task_events.length, 0, status);
      await reopenTask._handler(w.as(w.reviewer), { taskId: "task_1", reason: "Reopening to submit evidence." });
      const submitted = await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a" });
      assert.equal(submitted.task_status, "needs_review", status);
    }
    // submitEvidenceDraftWithOccupancies, an NZ assigned guided task
    {
      const w = await scene({ taskStatus: status });
      await w.db.patch(w.task._id, { assigned_to: w.ra._id });
      const guidedArgs = { evidenceDraftId: "task_1:draft_a", clientSubmissionId: submissionId(501), segments: [segment(0)] };
      await assert.rejects(
        submitEvidenceDraftWithOccupancies._handler(w.as(w.ra), guidedArgs),
        /reviewed, accepted, or exported/,
        status,
      );
      assert.equal(w.task.status, status, status);
      assert.equal(w.draft.draft_status, "draft", status);
      assert.equal(w.rows.evidence_versions.length, 0, status);
      assert.equal(w.rows.site_occupancies.length, 0, status);
      assert.equal(w.rows.task_events.length, 0, status);
      await reopenTask._handler(w.as(w.reviewer), { taskId: "task_1", reason: "Reopening to submit evidence and periods." });
      const submitted = await submitEvidenceDraftWithOccupancies._handler(w.as(w.ra), guidedArgs);
      assert.equal(submitted.task_status, "needs_review", status);
      assert.equal(submitted.deduped, false, status);
    }
    // submitUnresolvedNote
    {
      const w = await scene({ taskStatus: status });
      await assert.rejects(
        submitUnresolvedNote._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a", note: "Ambiguous evidence pending discussion." }),
        /reviewed, accepted, or exported/,
        status,
      );
      assert.equal(w.task.status, status, status);
      assert.equal(w.draft.draft_status, "draft", status);
      assert.equal(w.rows.evidence_versions.length, 0, status);
      assert.equal(w.rows.task_events.length, 0, status);
      await reopenTask._handler(w.as(w.reviewer), { taskId: "task_1", reason: "Reopening to submit an unresolved note." });
      const noted = await submitUnresolvedNote._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a", note: "Ambiguous evidence pending discussion." });
      assert.equal(noted.task_status, "unresolved_note", status);
    }
  }
});

test("a receipt-backed retry of a submission recorded before the task closed passes the intake gate without repeating writes", async () => {
  const w = await scene();
  const first = await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a", clientSubmissionId: submissionId(600) });
  const eventsAfterFirst = w.rows.task_events.length;
  await w.db.patch(w.task._id, { status: "reviewed" });
  const retry = await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a", clientSubmissionId: submissionId(600) });
  assert.equal(retry.deduped, true);
  assert.equal(retry.evidence_version_hash, first.evidence_version_hash);
  assert.equal(w.rows.evidence_versions.length, 1);
  assert.equal(w.rows.task_events.length, eventsAfterFirst);
  assert.equal(w.task.status, "reviewed");

  // a call with no receipt (no token, or a different draft) is still refused
  await assert.rejects(
    submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a" }),
    /reviewed, accepted, or exported/,
  );
  assert.equal(w.rows.evidence_versions.length, 1);

  // a guided retry likewise returns from its receipt after the task closed:
  // the existing guided_submission_key branch answers before the gate runs
  const w2 = await scene();
  await w2.db.patch(w2.task._id, { assigned_to: w2.ra._id });
  const guidedArgs = { evidenceDraftId: "task_1:draft_a", clientSubmissionId: submissionId(601), segments: [segment(0)] };
  const guidedFirst = await submitEvidenceDraftWithOccupancies._handler(w2.as(w2.ra), guidedArgs);
  const guidedEventsAfterFirst = w2.rows.task_events.length;
  await w2.db.patch(w2.task._id, { status: "pi_accepted" });
  const guidedRetry = await submitEvidenceDraftWithOccupancies._handler(w2.as(w2.ra), guidedArgs);
  assert.equal(guidedRetry.deduped, true);
  assert.equal(guidedRetry.evidence_version_hash, guidedFirst.evidence_version_hash);
  assert.equal(w2.rows.evidence_versions.length, 1);
  assert.equal(w2.rows.task_events.length, guidedEventsAfterFirst);
});

// snapshot-linked acceptance (pi ruling 2026-09-11): recordReviewDecision
// records the review_snapshots row and the v1 decision hash on success.

test("recordReviewDecision records the review_snapshots row and the v1 decision hash on success", async () => {
  const w = await scene({ country: "VU" });
  await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a" });
  const snapshot = await getReviewSnapshot._handler(w.as(w.reviewer), { taskId: "task_1", evidenceDraftId: "task_1:draft_a" });
  const result = await recordReviewDecision._handler(w.as(w.reviewer), {
    taskId: "task_1",
    decision: { evidence_draft_id: "task_1:draft_a", decision_status: "accepted_for_export", decision_note: "Checked the directory entry in full." },
    snapshotHash: snapshot.snapshot_hash,
  });
  const decisionRow = w.row("review_decisions", "review_decision_id", result.review_decision_id);
  assert.equal(decisionRow.review_snapshot_hash, snapshot.snapshot_hash);
  assert.equal(decisionRow.decision_hash_version, 1);
  assert.equal(decisionRow.evidence_version_hash, w.draft.evidence_version_hash);
  assert.equal(w.rows.review_snapshots.length, 1);
  assert.equal(w.rows.review_snapshots[0].snapshot_hash, snapshot.snapshot_hash);

  // a rejected decision with a snapshot is v1 too (the earlier test in this
  // file covers a rejected decision without one, which stays v0)
  const w2 = await scene({ country: "VU" });
  await submitEvidenceDraft._handler(w2.as(w2.ra), { evidenceDraftId: "task_1:draft_a" });
  const snapshot2 = await getReviewSnapshot._handler(w2.as(w2.reviewer), { taskId: "task_1", evidenceDraftId: "task_1:draft_a" });
  const rejected = await recordReviewDecision._handler(w2.as(w2.reviewer), {
    taskId: "task_1",
    decision: { evidence_draft_id: "task_1:draft_a", decision_status: "rejected", decision_note: "The directory entry does not support this record." },
    snapshotHash: snapshot2.snapshot_hash,
  });
  const rejectedRow = w2.row("review_decisions", "review_decision_id", rejected.review_decision_id);
  assert.equal(rejectedRow.decision_hash_version, 1);
  assert.equal(rejectedRow.review_snapshot_hash, snapshot2.snapshot_hash);
});

// snapshot consistency at acceptance (pi ruling 2026-09-11): recordAcceptance
// calls assertDecisionSnapshotConsistent (convex/reviews.ts) for every
// ratified decision.

test("recordAcceptance refuses a decision that is not snapshot-linked, one whose snapshot row is missing, and one whose stored snapshot was altered", async () => {
  // a legacy (v0) accepted decision predates snapshot-linked review; since
  // recordReviewDecision can no longer produce one for accepted_for_export,
  // this reproduces a row recorded before the ruling
  {
    const w = await scene({ country: "VU" });
    const pi = await w.addUser("pi-subject", ["pi"]);
    await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a" });
    const v1 = version(w);
    await w.db.insert("review_decisions", {
      review_decision_id: "task_1:review:legacy",
      task_id: "task_1",
      evidence_draft_id: "task_1:draft_a",
      reviewer_user_id: w.reviewer._id,
      decision_status: "accepted_for_export",
      decision_note: "Legacy decision recorded before snapshot-linked review.",
      created_at: Date.now(),
      updated_at: Date.now(),
      evidence_version_hash: v1.object_hash,
      decision_hash: "legacy",
    });
    await w.db.patch(w.draft._id, { draft_status: "accepted_for_export" });
    await w.db.patch(w.task._id, { status: "reviewed" });
    await assert.rejects(
      recordAcceptance._handler(w.as(pi), { taskId: "task_1", outcome: "accepted", note: "Ratifying the legacy decision." }),
      /is not snapshot-linked/,
    );
    assert.equal(w.task.status, "reviewed");
    assert.equal(w.rows.task_acceptances.length, 0);
  }
  // a linked decision whose review_snapshots row is missing
  {
    const w = await scene({ country: "VU" });
    const pi = await w.addUser("pi-subject", ["pi"]);
    await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a" });
    const snapshot = await getReviewSnapshot._handler(w.as(w.reviewer), { taskId: "task_1", evidenceDraftId: "task_1:draft_a" });
    await recordReviewDecision._handler(w.as(w.reviewer), {
      taskId: "task_1",
      decision: { evidence_draft_id: "task_1:draft_a", decision_status: "accepted_for_export", decision_note: "Checked the directory entry in full." },
      snapshotHash: snapshot.snapshot_hash,
    });
    w.rows.review_snapshots.length = 0;
    await assert.rejects(
      recordAcceptance._handler(w.as(pi), { taskId: "task_1", outcome: "accepted", note: "Ratifying the reviewer's decision." }),
      /is not recorded/,
    );
    assert.equal(w.rows.task_acceptances.length, 0);
  }
  // a linked decision whose stored snapshot_json was altered after the fact
  {
    const w = await scene({ country: "VU" });
    const pi = await w.addUser("pi-subject", ["pi"]);
    await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a" });
    const snapshot = await getReviewSnapshot._handler(w.as(w.reviewer), { taskId: "task_1", evidenceDraftId: "task_1:draft_a" });
    await recordReviewDecision._handler(w.as(w.reviewer), {
      taskId: "task_1",
      decision: { evidence_draft_id: "task_1:draft_a", decision_status: "accepted_for_export", decision_note: "Checked the directory entry in full." },
      snapshotHash: snapshot.snapshot_hash,
    });
    const recordedSnapshot = w.rows.review_snapshots.find((row) => row.snapshot_hash === snapshot.snapshot_hash);
    const tampered = JSON.parse(recordedSnapshot.snapshot_json);
    tampered.draft.evidence_note = "Tampered after the reviewer decided.";
    recordedSnapshot.snapshot_json = JSON.stringify(tampered);
    await assert.rejects(
      recordAcceptance._handler(w.as(pi), { taskId: "task_1", outcome: "accepted", note: "Ratifying the reviewer's decision." }),
      /does not reproduce its hash/,
    );
    assert.equal(w.rows.task_acceptances.length, 0);
  }
});

test("recordAcceptance refuses a snapshot-linked decision whose confirmed locations changed since it was recorded", async () => {
  const w = await scene({ country: "NZ", draft: { source_date_or_capture_date: "2024-01" } });
  const pi = await w.addUser("pi-subject", ["pi"]);
  await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a" });
  await submitOccupancies._handler(w.as(w.ra), {
    clientSubmissionId: submissionId(701),
    taskId: "task_1",
    parentEvidenceDraftId: "task_1:draft_a",
    segments: [segment(0, { start_date: "2005", start_basis: "founding_stated", end_mode: "known", end_date: "2020-06", end_basis: "closure_stated", end_reason: "closed" })],
  });
  const confirmed = await decideDerivedYear._handler(w.as(w.reviewer), { taskId: "task_1", parentEvidenceDraftId: "task_1:draft_a", targetYear: 2018, action: "confirm" });
  assert.equal(confirmed.written_status, "present");
  const confirmedLocation = w.rows.derived_year_locations.find(
    (row) => row.parent_evidence_draft_id === "task_1:draft_a" && row.target_year === 2018 && row.review_state === "reviewer_confirmed",
  );
  assert.ok(confirmedLocation, "expected a confirmed derived location for 2018");

  const snapshot = await getReviewSnapshot._handler(w.as(w.reviewer), { taskId: "task_1", evidenceDraftId: "task_1:draft_a" });
  await recordReviewDecision._handler(w.as(w.reviewer), {
    taskId: "task_1",
    decision: { evidence_draft_id: "task_1:draft_a", decision_status: "accepted_for_export", decision_note: "Checked the directory entry and the confirmed 2018 location." },
    snapshotHash: snapshot.snapshot_hash,
  });
  assert.equal(w.task.status, "reviewed");

  await w.db.patch(confirmedLocation._id, { review_state: "superseded" });
  await assert.rejects(
    recordAcceptance._handler(w.as(pi), { taskId: "task_1", outcome: "accepted", note: "Ratifying the reviewer's decision." }),
    /Confirmed locations for task_1:draft_a changed/,
  );
  assert.equal(w.rows.task_acceptances.length, 0);
});

// snapshot consistency at export (pi ruling 2026-09-11): createExportBatch
// calls assertDecisionSnapshotConsistent for each included accepted
// decision that carries a review_snapshot_hash, and includes a v0 decision
// unchanged when the task already carries an accepted acceptance.

test("createExportBatch checks snapshot consistency for linked decisions and includes a historical v0 decision unchanged", async () => {
  // a consistent linked decision creates a batch
  {
    const w = await scene({ country: "VU" });
    const pi = await w.addUser("pi-subject", ["pi"]);
    const admin2 = await w.addUser("admin-subject-2", ["admin"]);
    await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a" });
    const snapshot = await getReviewSnapshot._handler(w.as(w.reviewer), { taskId: "task_1", evidenceDraftId: "task_1:draft_a" });
    await recordReviewDecision._handler(w.as(w.reviewer), {
      taskId: "task_1",
      decision: { evidence_draft_id: "task_1:draft_a", decision_status: "accepted_for_export", decision_note: "Checked the directory entry in full." },
      snapshotHash: snapshot.snapshot_hash,
    });
    await recordAcceptance._handler(w.as(pi), { taskId: "task_1", outcome: "accepted", note: "Ratifying the reviewer's decision." });
    const batch = await createExportBatch._handler(w.as(admin2), { countryCode: "VU", taskIds: ["task_1"] });
    assert.equal(batch.included_task_count, 1);
    assert.equal(batch.included_review_decision_count, 1);
  }
  // an altered snapshot row is refused at export, not only at acceptance
  {
    const w = await scene({ country: "VU" });
    const pi = await w.addUser("pi-subject", ["pi"]);
    const admin2 = await w.addUser("admin-subject-2", ["admin"]);
    await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a" });
    const snapshot = await getReviewSnapshot._handler(w.as(w.reviewer), { taskId: "task_1", evidenceDraftId: "task_1:draft_a" });
    await recordReviewDecision._handler(w.as(w.reviewer), {
      taskId: "task_1",
      decision: { evidence_draft_id: "task_1:draft_a", decision_status: "accepted_for_export", decision_note: "Checked the directory entry in full." },
      snapshotHash: snapshot.snapshot_hash,
    });
    await recordAcceptance._handler(w.as(pi), { taskId: "task_1", outcome: "accepted", note: "Ratifying the reviewer's decision." });
    const recordedSnapshot = w.rows.review_snapshots.find((row) => row.snapshot_hash === snapshot.snapshot_hash);
    const tampered = JSON.parse(recordedSnapshot.snapshot_json);
    tampered.draft.evidence_note = "Tampered after acceptance.";
    recordedSnapshot.snapshot_json = JSON.stringify(tampered);
    await assert.rejects(
      createExportBatch._handler(w.as(admin2), { countryCode: "VU", taskIds: ["task_1"] }),
      /does not reproduce its hash/,
    );
  }
  // a v0 decision carrying an accepted acceptance row is a historical
  // record and is included unchanged (the export PR will recheck these at
  // freeze time, convex/exports.ts)
  {
    const w = await scene({ country: "VU" });
    const admin2 = await w.addUser("admin-subject-2", ["admin"]);
    await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a" });
    const v1 = version(w);
    await w.db.insert("review_decisions", {
      review_decision_id: "task_1:review:legacy",
      task_id: "task_1",
      evidence_draft_id: "task_1:draft_a",
      reviewer_user_id: w.reviewer._id,
      decision_status: "accepted_for_export",
      decision_note: "Legacy decision recorded before snapshot-linked review.",
      created_at: Date.now(),
      updated_at: Date.now(),
      evidence_version_hash: v1.object_hash,
      decision_hash: "legacy",
    });
    await w.db.insert("task_acceptances", {
      acceptance_id: "task_1:acceptance:legacy",
      task_id: "task_1",
      review_decision_id: "task_1:review:legacy",
      evidence_draft_id: "task_1:draft_a",
      pi_user_id: w.admin._id,
      outcome: "accepted",
      note: "legacy: exported before snapshot-linked review",
      self_decided: false,
      legacy: true,
      created_at: Date.now(),
      acceptance_hash: "legacy",
    });
    await w.db.patch(w.task._id, { status: "pi_accepted" });
    const batch = await createExportBatch._handler(w.as(admin2), { countryCode: "VU", taskIds: ["task_1"] });
    assert.equal(batch.included_task_count, 1);
    assert.equal(batch.included_review_decision_count, 1);
  }
});
