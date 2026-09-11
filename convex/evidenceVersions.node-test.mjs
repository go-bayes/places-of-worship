import assert from "node:assert/strict";
import fs from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";

// Convex resolves extensionless local TypeScript imports during bundling. The
// same rule is supplied here so these tests drive the registered handlers
// rather than a parallel copy of the rules.
registerHooks({ resolve(specifier, context, nextResolve) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) { for (const ext of [".js", ".ts"]) { const candidate = new URL(`${specifier}${ext}`, context.parentURL); if (fs.existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context); } } return nextResolve(specifier, context); } });

const { saveEvidenceDraft, submitEvidenceDraft, submitEvidenceDraftWithOccupancies, submitUnresolvedNote, reviseEvidenceDraft } = await import("./evidence.ts");
const { getEvidenceVersion, listEvidenceVersions, recordMigrationVersion, verifyDraftAgainstVersion } = await import("./evidenceVersions.ts");
const { submitCurrentObservation } = await import("./rapidEntry.ts");
const { submitOccupancies, decideDerivedYear } = await import("./occupancies.ts");
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
    users: [], tasks: [], task_events: [], evidence_drafts: [], evidence_versions: [],
    site_occupancies: [], historical_claims: [], derived_target_year_states: [],
    derived_year_locations: [], derived_target_year_functions: [], derived_state_events: [],
    review_decisions: [], agent_reviews: [], sources: [], task_batches: [],
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

// defect: evidenceVersions.recordEvidenceVersion dedupes unchanged content by
// comparing current.content_hash with the payload hash it has just built, but
// buildEvidenceVersion puts version_index inside the payload and the new
// candidate is always built at current.version_index + 1. The two hashes can
// therefore never be equal, so the "unchanged content re-recorded by the same
// actor is the same version" branch is unreachable and every no-op write
// records another version. The fix is to compare content rather than the
// payload hash of a different index, for example by rebuilding the candidate
// with current.version_index and current.version_kind for the comparison (or
// by storing a content hash over payload.evidence and payload.occupancies
// alone). Three tests below fail on this one defect.
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
  // the server key is `${user}:${clientSubmissionId}`, so a second person
  // reusing the same browser-side token collides with nothing
  const w = await scene();
  await w.addDraft({ evidence_draft_id: "task_1:draft_other", task_id: "task_1", created_by: w.otherRa._id });
  const mine = await submitEvidenceDraft._handler(w.as(w.ra), { evidenceDraftId: "task_1:draft_a", clientSubmissionId: submissionId(1) });
  const theirs = await submitEvidenceDraft._handler(w.as(w.otherRa), { evidenceDraftId: "task_1:draft_other", clientSubmissionId: submissionId(1) });

  assert.notEqual(mine.evidence_version_hash, theirs.evidence_version_hash);
  assert.equal(w.rows.evidence_versions.length, 2);
  assert.equal(version(w, 0).idempotency_key, `${w.ra._id}:${submissionId(1)}`);
  assert.equal(version(w, 1).idempotency_key, `${w.otherRa._id}:${submissionId(1)}`);
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

// defect: occupancies.decideDerivedYear states that "a rejection leaves the row
// unchanged and records no version", and stamps the task event only when
// version.created is true. It reaches recordEvidenceVersion unconditionally,
// where the unchanged-content branch is unreachable (see above) and, even once
// that is repaired, requires current.created_by to be the actor — which a
// reviewer acting on a contributor's submission never is. So a rejection
// writes a second version row holding the contributor's content under the
// reviewer's name and moves the draft row's hash to it. Either skip
// recordEvidenceVersion for the reject action, or let the dedupe compare
// content across actors.
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
