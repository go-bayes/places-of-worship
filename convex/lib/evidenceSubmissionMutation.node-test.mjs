import assert from "node:assert/strict";
import fs from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";

// Convex resolves extensionless local TypeScript imports during bundling. This
// test loads the registered mutation in Node and supplies the same resolution
// rule so it exercises the actual handler rather than a parallel helper.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) {
      for (const extension of [".js", ".ts"]) {
        const candidate = new URL(`${specifier}${extension}`, context.parentURL);
        if (fs.existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
      }
    }
    return nextResolve(specifier, context);
  },
});

const { submitEvidenceDraftWithOccupancies } = await import("../evidence.ts");

function mutationContext(documents) {
  const q = { eq() { return q; } };
  return {
    auth: {
      async getUserIdentity() {
        return { tokenIdentifier: "test-user-subject" };
      },
    },
    db: {
      query(table) {
        return {
          withIndex(_name, select) {
            select(q);
            return {
              async unique() { return documents[table] ?? null; },
              async take() { return Array.isArray(documents[table]) ? documents[table] : []; },
            };
          },
        };
      },
    },
  };
}

test("the atomic mutation rejects a period beyond its parent evidence date", async () => {
  const user = {
    _id: "user_1",
    auth_subject: "test-user-subject",
    status: "active",
    roles: ["ra"],
  };
  const draft = {
    _id: "draft_row_1",
    evidence_draft_id: "draft_1",
    task_id: "task_1",
    draft_status: "draft",
    created_by: user._id,
    observation_contract_version: "guided_observation_v1",
    action: "confirm_current_record",
    source_type: "denominational_directory",
    source_title: "Directory 2016",
    source_url_or_file: "https://example.org/directory",
    source_date_or_capture_date: "2016-07",
    evidence_note: "The directory records this place as active in July 2016.",
  };
  const task = {
    _id: "task_row_1",
    task_id: draft.task_id,
    country_code: "NZ",
    assigned_to: user._id,
    status: "in_progress",
    target_years: [2013, 2018, 2023],
    geometry: { type: "Point", coordinates: [174.768, -41.282] },
  };
  const segment = {
    contract_version: "occupancy_v1",
    segment_index: 0,
    start_mode: "known",
    start_date: "1905",
    start_basis: "founding_stated",
    end_mode: "still_active",
    end_basis: "unknown",
    still_active_asof: "2018",
    location_relation: "same_as_task_point",
    confidence: "high",
    confidence_basis: "The dated directory entry was read directly.",
    source_basis: "named_public_source",
    source_title: "Directory 2016",
    source_reference: "https://example.org/directory",
    source_account: "The directory records worship use through July 2016.",
    privacy_flag: "clear",
  };

  await assert.rejects(
    submitEvidenceDraftWithOccupancies._handler(
      mutationContext({ users: user, evidence_drafts: draft, tasks: task }),
      {
        evidenceDraftId: draft.evidence_draft_id,
        clientSubmissionId: "11111111-1111-4111-8111-111111111111",
        segments: [segment],
      },
    ),
    /still-active date cannot be later than the evidence reference date \(2016-07\)/,
  );
});

test("the atomic mutation refuses a submission id whose rows already exist under another draft", async () => {
  const user = { _id: "user_1", auth_subject: "test-user-subject", status: "active", roles: ["ra"] };
  const draft = {
    _id: "draft_row_2",
    evidence_draft_id: "draft_2",
    task_id: "task_1",
    draft_status: "draft",
    created_by: user._id,
    observation_contract_version: "guided_observation_v1",
    action: "confirm_current_record",
    source_type: "denominational_directory",
    source_title: "Directory 2016",
    source_url_or_file: "https://example.org/directory",
    source_date_or_capture_date: "2016-07",
    evidence_note: "The directory records this place as active in July 2016.",
  };
  const task = {
    _id: "task_row_1",
    task_id: draft.task_id,
    country_code: "NZ",
    assigned_to: user._id,
    status: "in_progress",
    target_years: [2013, 2018, 2023],
    geometry: { type: "Point", coordinates: [174.768, -41.282] },
  };
  const clientSubmissionId = "11111111-1111-4111-8111-111111111111";
  const priorRow = {
    occupancy_id: `task_1:user_1:occupancy:${clientSubmissionId}:0`,
    parent_evidence_draft_id: "draft_1",
    submission_key: `user_1:${clientSubmissionId}`,
    created_by: user._id,
  };
  await assert.rejects(
    submitEvidenceDraftWithOccupancies._handler(
      mutationContext({ users: user, evidence_drafts: draft, tasks: task, site_occupancies: [priorRow] }),
      { evidenceDraftId: draft.evidence_draft_id, clientSubmissionId, segments: [] },
    ),
    /already recorded against an earlier evidence version/,
  );
  await assert.rejects(
    submitEvidenceDraftWithOccupancies._handler(
      mutationContext({
        users: user,
        evidence_drafts: draft,
        tasks: task,
        site_occupancies: [{ ...priorRow, created_by: "user_2" }],
      }),
      { evidenceDraftId: draft.evidence_draft_id, clientSubmissionId, segments: [] },
    ),
    /identifier is already in use/,
  );
});
