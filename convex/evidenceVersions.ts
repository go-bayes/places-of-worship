import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { evidenceVersionKind } from "./model";
import { canReview, requireUser } from "./lib/auth";
import { MEDIUM_TEXT_MAX, assertMaxString } from "./lib/limits";
import { isObjectHash } from "./lib/canonicalJson";
import {
  actorId,
  buildEvidenceVersion,
  recordedAtIso,
  verifyEvidenceVersionEnvelope,
} from "./lib/evidenceVersions";
import type { EvidenceVersionKind, EvidenceVersionLineage } from "./lib/evidenceVersions";
import { appendTaskEvent } from "./lib/taskEvents";

// server side of evidence-version.v1 (docs/development/content-addressed-review.md).
// every path that submits evidence, or writes onto submitted evidence,
// calls recordEvidenceVersion at the end of its transaction so the version
// captures the committed row and its active period rows. the version row is
// written once and never patched; the draft row keeps the current hash as
// a locator into the version table.

async function draftByIdOrThrow(ctx: QueryCtx | MutationCtx, draftId: string): Promise<Doc<"evidence_drafts">> {
  const draft = await ctx.db
    .query("evidence_drafts")
    .withIndex("by_evidence_draft_id", (q) => q.eq("evidence_draft_id", draftId))
    .unique();
  if (draft === null) throw new Error(`Evidence draft not found: ${draftId}`);
  return draft;
}

export async function versionByHash(ctx: QueryCtx | MutationCtx, hash: string): Promise<Doc<"evidence_versions"> | null> {
  return await ctx.db
    .query("evidence_versions")
    .withIndex("by_object_hash", (q) => q.eq("object_hash", hash))
    .unique();
}

// the active period rows the version captures: the parent's submitted
// occupancy set, bounded as everywhere else in the occupancy lane
async function activeOccupancyRows(ctx: QueryCtx | MutationCtx, parentDraftId: string): Promise<Doc<"site_occupancies">[]> {
  const rows = await ctx.db
    .query("site_occupancies")
    .withIndex("by_parent_status_and_segment", (q) =>
      q.eq("parent_evidence_draft_id", parentDraftId).eq("claim_status", "submitted"),
    )
    .take(21);
  if (rows.length > 20) {
    throw new Error("This evidence record has more than 20 active periods. Ask JB to repair the duplicate active set before continuing.");
  }
  return rows;
}

async function familyHeadIndex(ctx: QueryCtx | MutationCtx, familyId: string): Promise<number> {
  const head = await ctx.db
    .query("evidence_versions")
    .withIndex("by_family_version", (q) => q.eq("evidence_family_id", familyId))
    .order("desc")
    .first();
  return head?.version_index ?? 0;
}

// where a new version sits in the evidence graph. a row that already has a
// version continues its family; a revision clone joins the family of the
// submission it corrects, or starts a new family that references the
// earlier one when the contributor recorded a new dated observation; a
// correction of a pre-contract submission keeps the locator and invents no
// historical hash. the source version is the one pinned on the clone when
// the revision was opened (revision_of_version_hash), never the source
// row's current hash: a reviewer edit, a derivation decision, or the
// retirement of the source's period set by this very submission may have
// given the source a later version the contributor never saw
async function resolveLineage(
  ctx: QueryCtx | MutationCtx,
  row: Doc<"evidence_drafts">,
): Promise<{ familyId: string; lineage: EvidenceVersionLineage; current: Doc<"evidence_versions"> | null }> {
  if (row.evidence_version_hash !== undefined) {
    const current = await versionByHash(ctx, row.evidence_version_hash);
    if (current === null) throw new Error(`Evidence version ${row.evidence_version_hash} is missing for ${row.evidence_draft_id}.`);
    return { familyId: current.evidence_family_id, lineage: { relation: "child", parent_object_hash: current.object_hash }, current };
  }
  if (row.revision_of_evidence_draft_id !== undefined) {
    const pinnedHash = row.revision_of_version_hash;
    if (row.revision_intent === "new_observation") {
      return {
        familyId: row.evidence_draft_id,
        lineage: { relation: "follows", follows_evidence_draft_id: row.revision_of_evidence_draft_id, follows_object_hash: pinnedHash },
        current: null,
      };
    }
    if (pinnedHash !== undefined) {
      const parent = await versionByHash(ctx, pinnedHash);
      if (parent === null) throw new Error(`Evidence version ${pinnedHash} is missing for ${row.revision_of_evidence_draft_id}.`);
      return { familyId: parent.evidence_family_id, lineage: { relation: "child", parent_object_hash: parent.object_hash }, current: null };
    }
    // no pinned version: the source had none when the revision opened. a
    // migration copy recorded on the source since then is not the version
    // the contributor corrected, so no parent is inferred from it
    return {
      familyId: row.evidence_draft_id,
      lineage: { relation: "revises_pre_contract", revises_evidence_draft_id: row.revision_of_evidence_draft_id },
      current: null,
    };
  }
  return { familyId: row.evidence_draft_id, lineage: { relation: "first" }, current: null };
}

// the receipt a submission token holds: written by recordEvidenceVersion
// on every keyed call, so a retry finds the version its own submission
// received rather than whatever the row carries now
export async function submissionReceipt(
  ctx: QueryCtx | MutationCtx,
  submissionKey: string,
): Promise<Doc<"evidence_submission_receipts"> | null> {
  return await ctx.db
    .query("evidence_submission_receipts")
    .withIndex("by_submission_key", (q) => q.eq("submission_key", submissionKey))
    .unique();
}

export type RecordedEvidenceVersion = {
  object_hash: string;
  content_hash: string;
  evidence_family_id: string;
  version_index: number;
  created: boolean;
};

// records the immutable version of a draft row as it stands at the end of
// the calling transaction. idempotent on the caller's submission key and on
// unchanged content: retrying the same submission, or re-saving submitted
// content unchanged, returns the existing version and writes no version.
// a keyed call always leaves a receipt naming the version it returned, so
// the token stays bound to that version for the caller whether the call
// created it or received an existing one by content
export async function recordEvidenceVersion(
  ctx: MutationCtx,
  args: {
    draftRowId: Id<"evidence_drafts">;
    actor: Doc<"users">;
    kind: EvidenceVersionKind;
    now: number;
    idempotencyKey?: string;
    migration?: { runId: string };
  },
): Promise<RecordedEvidenceVersion> {
  const row = await ctx.db.get(args.draftRowId);
  if (row === null) throw new Error("Evidence draft row not found.");
  if (args.idempotencyKey !== undefined) {
    const receipt = await submissionReceipt(ctx, args.idempotencyKey);
    if (receipt !== null) {
      if (receipt.created_by !== args.actor._id || receipt.evidence_draft_id !== row.evidence_draft_id) {
        throw new Error("The submission identifier is already in use.");
      }
      const received = await versionByHash(ctx, receipt.object_hash);
      if (received === null) throw new Error(`Evidence version ${receipt.object_hash} named by a submission receipt is missing.`);
      return {
        object_hash: received.object_hash,
        content_hash: received.content_hash,
        evidence_family_id: received.evidence_family_id,
        version_index: received.version_index,
        created: false,
      };
    }
  }
  const recorded = await recordVersionRow(ctx, row, args);
  if (args.idempotencyKey !== undefined) {
    await ctx.db.insert("evidence_submission_receipts", {
      submission_key: args.idempotencyKey,
      route: args.idempotencyKey.slice(0, Math.max(args.idempotencyKey.indexOf(":"), 0)),
      task_id: row.task_id,
      evidence_draft_id: row.evidence_draft_id,
      object_hash: recorded.object_hash,
      content_hash: recorded.content_hash,
      version_created: recorded.created,
      created_by: args.actor._id,
      recorded_at: args.now,
    });
  }
  return recorded;
}

async function recordVersionRow(
  ctx: MutationCtx,
  row: Doc<"evidence_drafts">,
  args: {
    actor: Doc<"users">;
    kind: EvidenceVersionKind;
    now: number;
    idempotencyKey?: string;
    migration?: { runId: string };
  },
): Promise<RecordedEvidenceVersion> {
  const { familyId, lineage, current } = await resolveLineage(ctx, row);
  const occupancyRows = await activeOccupancyRows(ctx, row.evidence_draft_id);
  const versionIndex = (await familyHeadIndex(ctx, familyId)) + 1;
  const built = buildEvidenceVersion({
    task_id: row.task_id,
    evidence_draft_id: row.evidence_draft_id,
    evidence_family_id: familyId,
    version_index: versionIndex,
    version_kind: args.kind,
    lineage,
    actor_user_id: String(args.actor._id),
    recorded_at_ms: args.now,
    evidence_row: row,
    occupancy_rows: occupancyRows,
    migration: args.migration === undefined
      ? undefined
      : {
          run_id: args.migration.runId,
          copied_at: recordedAtIso(args.now),
          source_created_by: actorId(String(row.created_by)),
          source_created_at: recordedAtIso(row.created_at),
          source_updated_at: recordedAtIso(row.updated_at),
        },
  });
  // unchanged content re-recorded, by any actor, is the same version: a
  // retry, a re-save of identical text, or a review action that wrote
  // nothing onto the row adds no version
  if (current !== null && current.content_hash === built.content_hash) {
    return {
      object_hash: current.object_hash,
      content_hash: current.content_hash,
      evidence_family_id: current.evidence_family_id,
      version_index: current.version_index,
      created: false,
    };
  }
  if ((await versionByHash(ctx, built.object_hash)) !== null) {
    throw new Error("An evidence version with this hash already exists; retry the submission.");
  }
  await ctx.db.insert("evidence_versions", {
    object_hash: built.object_hash,
    hash_contract: "pow-object.v1",
    object_type: "evidence_version",
    schema_version: "evidence-version.v1",
    logical_id: built.envelope.logical_id,
    task_id: row.task_id,
    evidence_draft_id: row.evidence_draft_id,
    evidence_family_id: familyId,
    version_index: versionIndex,
    parent_object_hash: lineage.relation === "child" ? lineage.parent_object_hash : undefined,
    version_kind: args.kind,
    content_hash: built.content_hash,
    idempotency_key: args.idempotencyKey,
    created_by: args.actor._id,
    recorded_at: args.now,
    envelope_json: built.envelope_json,
  });
  await ctx.db.patch(row._id, {
    evidence_version_hash: built.object_hash,
    evidence_family_id: familyId,
  });
  return {
    object_hash: built.object_hash,
    content_hash: built.content_hash,
    evidence_family_id: familyId,
    version_index: versionIndex,
    created: true,
  };
}

const versionSummary = v.object({
  object_hash: v.string(),
  parent_object_hash: v.optional(v.string()),
  logical_id: v.string(),
  task_id: v.string(),
  evidence_draft_id: v.string(),
  evidence_family_id: v.string(),
  version_index: v.number(),
  version_kind: evidenceVersionKind,
  content_hash: v.string(),
  created_by: v.id("users"),
  recorded_at: v.number(),
});

function summarise(row: Doc<"evidence_versions">) {
  return {
    object_hash: row.object_hash,
    parent_object_hash: row.parent_object_hash,
    logical_id: row.logical_id,
    task_id: row.task_id,
    evidence_draft_id: row.evidence_draft_id,
    evidence_family_id: row.evidence_family_id,
    version_index: row.version_index,
    version_kind: row.version_kind,
    content_hash: row.content_hash,
    created_by: row.created_by,
    recorded_at: row.recorded_at,
  };
}

async function requireVersionReader(ctx: QueryCtx, row: Doc<"evidence_versions">): Promise<Doc<"users">> {
  const user = await requireUser(ctx, ["ra", "reviewer", "curator", "admin", "pi", "service"]);
  if (canReview(user.roles) || row.created_by === user._id) return user;
  const draft = await draftByIdOrThrow(ctx, row.evidence_draft_id);
  if (draft.created_by !== user._id) throw new Error("Evidence version belongs to another user.");
  return user;
}

// the immutable record: the stored canonical envelope, re-verified on every
// read so a corrupted or altered row is reported rather than trusted
export const getEvidenceVersion = query({
  args: { objectHash: v.string() },
  returns: v.object({
    version: versionSummary,
    envelope: v.any(),
    envelope_json: v.string(),
    verification: v.object({ valid: v.boolean(), errors: v.array(v.string()) }),
  }),
  handler: async (ctx, args) => {
    if (!isObjectHash(args.objectHash)) throw new Error("objectHash must be a pow-object.v1 hash.");
    const row = await versionByHash(ctx, args.objectHash);
    if (row === null) throw new Error("Evidence version not found.");
    await requireVersionReader(ctx, row);
    const envelope = JSON.parse(row.envelope_json);
    const verification = verifyEvidenceVersionEnvelope(envelope);
    if (verification.object_hash !== row.object_hash) verification.errors.push("stored object_hash differs from the envelope");
    return {
      version: summarise(row),
      envelope,
      envelope_json: row.envelope_json,
      verification: { valid: verification.errors.length === 0, errors: verification.errors },
    };
  },
});

export const listEvidenceVersions = query({
  args: { evidenceDraftId: v.optional(v.string()), evidenceFamilyId: v.optional(v.string()) },
  returns: v.array(versionSummary),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["ra", "reviewer", "curator", "admin", "pi", "service"]);
    if ((args.evidenceDraftId === undefined) === (args.evidenceFamilyId === undefined)) {
      throw new Error("Give either an evidence draft id or an evidence family id.");
    }
    const rows = args.evidenceDraftId !== undefined
      ? await ctx.db
        .query("evidence_versions")
        .withIndex("by_draft_version", (q) => q.eq("evidence_draft_id", args.evidenceDraftId!))
        .take(200)
      : await ctx.db
        .query("evidence_versions")
        .withIndex("by_family_version", (q) => q.eq("evidence_family_id", args.evidenceFamilyId!))
        .take(200);
    const visible = canReview(user.roles) ? rows : rows.filter((row) => row.created_by === user._id);
    return visible.sort((left, right) => left.version_index - right.version_index).map(summarise);
  },
});

// whether the mutable draft row still says what its current version says.
// a divergence means a write reached submitted content without recording a
// version, which the inventory in docs/development/evidence-versions.md is
// meant to make impossible; this query is the audit for that claim
export const verifyDraftAgainstVersion = query({
  args: { evidenceDraftId: v.string() },
  returns: v.object({
    evidence_draft_id: v.string(),
    draft_status: v.string(),
    current_version_hash: v.optional(v.string()),
    consistent: v.optional(v.boolean()),
    stored_envelope_valid: v.optional(v.boolean()),
    errors: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    await requireUser(ctx, ["reviewer", "curator", "admin", "pi", "service"]);
    const row = await draftByIdOrThrow(ctx, args.evidenceDraftId);
    if (row.evidence_version_hash === undefined) {
      return { evidence_draft_id: row.evidence_draft_id, draft_status: row.draft_status, errors: ["no evidence version recorded (pre-contract row or unsubmitted draft)"] };
    }
    const current = await versionByHash(ctx, row.evidence_version_hash);
    if (current === null) {
      return { evidence_draft_id: row.evidence_draft_id, draft_status: row.draft_status, current_version_hash: row.evidence_version_hash, errors: ["current version row is missing"] };
    }
    const envelope = JSON.parse(current.envelope_json);
    const verification = verifyEvidenceVersionEnvelope(envelope);
    const errors = [...verification.errors];
    const occupancyRows = await activeOccupancyRows(ctx, row.evidence_draft_id);
    const rebuilt = buildEvidenceVersion({
      task_id: row.task_id,
      evidence_draft_id: row.evidence_draft_id,
      evidence_family_id: current.evidence_family_id,
      version_index: current.version_index,
      version_kind: current.version_kind,
      lineage: { relation: "first" },
      actor_user_id: String(current.created_by),
      recorded_at_ms: current.recorded_at,
      evidence_row: row,
      occupancy_rows: occupancyRows,
    });
    const consistent = rebuilt.content_hash === current.content_hash;
    if (!consistent) errors.push("draft row content differs from its current evidence version");
    return {
      evidence_draft_id: row.evidence_draft_id,
      draft_status: row.draft_status,
      current_version_hash: current.object_hash,
      consistent,
      stored_envelope_valid: verification.valid,
      errors,
    };
  },
});

// migration for rows submitted before the contract (content-addressed
// review, "migration"): an admin or service actor records a version that
// names the migration run and copy time and keeps the row's own actor and
// times inside the payload. it never claims the hash existed at submission.
// not run as part of the contract's first implementation
export const recordMigrationVersion = mutation({
  args: { evidenceDraftId: v.string(), migrationRunId: v.string() },
  returns: v.object({ object_hash: v.string(), version_index: v.number(), created: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["admin", "service"]);
    assertMaxString("migration run id", args.migrationRunId, MEDIUM_TEXT_MAX);
    const row = await draftByIdOrThrow(ctx, args.evidenceDraftId);
    if (!["submitted", "unresolved_note", "superseded", "accepted_for_export", "rejected"].includes(row.draft_status)) {
      throw new Error("Only submitted rows take a migration version; an editable draft is versioned when submitted.");
    }
    if (row.evidence_version_hash !== undefined) {
      const current = await versionByHash(ctx, row.evidence_version_hash);
      if (current === null) throw new Error("The row names a version that is missing.");
      return { object_hash: current.object_hash, version_index: current.version_index, created: false };
    }
    const now = Date.now();
    const recorded = await recordEvidenceVersion(ctx, {
      draftRowId: row._id,
      actor: user,
      kind: "migration_copy",
      now,
      idempotencyKey: `migration:${args.migrationRunId}:${row.evidence_draft_id}`,
      migration: { runId: args.migrationRunId },
    });
    if (recorded.created) {
      await appendTaskEvent(ctx, {
        taskId: row.task_id,
        eventType: "note_added",
        actorUserId: user._id,
        actorRole: user.roles.includes("admin") ? "admin" : "service",
        evidenceDraftId: row.evidence_draft_id,
        evidenceVersionHash: recorded.object_hash,
        reason: `Migration ${args.migrationRunId} recorded an evidence version for a pre-contract submission.`,
      });
    }
    return { object_hash: recorded.object_hash, version_index: recorded.version_index, created: recorded.created };
  },
});
