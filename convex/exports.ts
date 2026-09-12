import { v, type Infer } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { exportFormat, exportBatchStatus } from "./model";
import { chooseActorRole, requireUser } from "./lib/auth";
import { appendTaskEvent } from "./lib/taskEvents";
import { ACCEPTANCE_NOTE_MIN, exportRefusalForTask } from "./lib/acceptance";
import { assertMaxString, TASK_REASON_MAX } from "./lib/limits";
import { objectHash, withoutUndefined } from "./lib/canonicalJson";
import { sha256 } from "./lib/sha256";
import { assertDecisionSnapshotConsistent } from "./reviews";
import { isWideEvidenceExportEligible } from "./lib/exportEligibility";
import { targetYearsOrEmpty } from "./lib/countryYears";
import { locationOutcomeColumns } from "./lib/locationOutcome";
import { readGeneratedWideRow, wideEvidenceFields, wideEvidenceRowValues } from "./lib/wideEvidenceFields";
import { exportBatchDoc } from "./lib/validators";

// frozen exports (docs/development/frozen-exports.md, D20 step two): freezing
// captures the complete bundle contract `pow-export-bundle.v1` (every file's
// exact utf-8 bytes, hashed, plus a manifest whose own manifest_hash covers
// every other member) and stores it durably before the batch is marked
// frozen. retrieval of a frozen batch reads and verifies those stored bytes
// and never rebuilds from the current, mutable rows; a draft batch, and a
// batch frozen before this change (no stored bytes), are served as a live
// preview instead, clearly marked as such in `disposition`.

async function taskByTaskId(ctx: any, taskId: string): Promise<Doc<"tasks"> | null> {
  return await ctx.db
    .query("tasks")
    .withIndex("by_task_id", (q: any) => q.eq("task_id", taskId))
    .unique();
}

async function batchByExportBatchId(ctx: any, exportBatchId: string): Promise<Doc<"export_batches"> | null> {
  return await ctx.db
    .query("export_batches")
    .withIndex("by_export_batch_id", (q: any) => q.eq("export_batch_id", exportBatchId))
    .unique();
}

async function decisionsForTask(ctx: any, taskId: string): Promise<Doc<"review_decisions">[]> {
  return await ctx.db
    .query("review_decisions")
    .withIndex("by_task", (q: any) => q.eq("task_id", taskId))
    .collect();
}

function jsonl(rows: unknown[]): string {
  return rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length > 0 ? "\n" : "");
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  if (!/[",\n\r]/.test(text)) {
    return text;
  }
  return `"${text.replaceAll('"', '""')}"`;
}

function csvLine(values: unknown[]): string {
  return values.map(csvCell).join(",");
}

// utf-8 byte length, as the manifest and pow object verify contract require;
// never the ecmascript string length, which counts utf-16 code units
function utf8Length(text: string): number {
  return new TextEncoder().encode(text).length;
}

function hexOfDigest(digest: ArrayBuffer): string {
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function acceptedEvidenceDraftIds(reviewDecisions: Doc<"review_decisions">[]): Set<string> {
  return new Set(
    reviewDecisions
      .map((decision) => decision.evidence_draft_id)
      .filter((draftId): draftId is string => draftId !== undefined),
  );
}

// the target-year columns of an accepted draft's row reflect the draft's
// current statuses and bases (reviewer confirmation happens after the row
// was generated) and the confirmed or overridden derived location for the
// year (occupancy lane); unconfirmed derived rows never reach the csv
function overlayTargetYears(
  row: Record<string, unknown>,
  draft: Doc<"evidence_drafts">,
  targetYears: readonly number[],
  draftLocations: Doc<"derived_year_locations">[],
): Record<string, unknown> {
  const statuses = (draft.target_year_statuses ?? {}) as Record<string, string>;
  const bases = (draft.target_year_basis ?? {}) as Record<string, string>;
  // pr-f: the confirmed or overridden denomination per year, never a proposal
  const denominations = (draft.target_year_denominations ?? {}) as Record<string, string>;
  const denominationBases = (draft.target_year_denomination_basis ?? {}) as Record<string, string>;
  // r-f1': the confirmed level of use beside a present year
  const useLevels = (draft.target_year_use_levels ?? {}) as Record<string, string>;
  const out = { ...row };
  for (const year of targetYears) {
    const key = String(year);
    const status = statuses[key];
    if (status !== undefined) out[`target_year_${year}_status`] = status;
    if (status !== undefined && status !== "not_assessed") {
      out[`target_year_${year}_basis`] = bases[key] ?? "source_observation";
    }
    if (useLevels[key] !== undefined) out[`target_year_${year}_use_level`] = useLevels[key];
    if (denominations[key] !== undefined) {
      out[`target_year_${year}_denomination`] = denominations[key];
      out[`target_year_${year}_denomination_basis`] = denominationBases[key] ?? "reviewer_confirmed_derivation";
    }
    const settled = draftLocations.find(
      (l) => l.target_year === year && (l.review_state === "reviewer_confirmed" || l.review_state === "reviewer_overridden"),
    );
    if (settled !== undefined) {
      out[`target_year_${year}_latitude`] = settled.override_latitude ?? settled.latitude;
      out[`target_year_${year}_longitude`] = settled.override_longitude ?? settled.longitude;
      const radius = settled.override_uncertainty_radius_m ?? settled.uncertainty_radius_m;
      out[`target_year_${year}_uncertainty_radius_m`] = radius ?? "";
      out[`target_year_${year}_location_basis`] = settled.location_basis;
    }
  }
  return out;
}

// the latest accepting decision for a draft: its location ruling is the
// one the export reports
function acceptingDecisionForDraft(
  reviewDecisions: Doc<"review_decisions">[],
  draftId: string,
): Doc<"review_decisions"> | undefined {
  return reviewDecisions
    .filter((decision) => decision.evidence_draft_id === draftId && decision.decision_status === "accepted_for_export")
    .sort((a, b) => b.created_at - a.created_at)[0];
}

function siteEvidenceWideCsv(
  countryCode: string,
  evidenceDrafts: Doc<"evidence_drafts">[],
  reviewDecisions: Doc<"review_decisions">[],
  derivedLocations: Doc<"derived_year_locations">[] = [],
  tasks: Doc<"tasks">[] = [],
): { csv: string; rowCount: number; fieldCount: number; fieldMismatchCount: number } {
  const acceptedDraftIds = acceptedEvidenceDraftIds(reviewDecisions);
  const tasksByTaskId = new Map(tasks.map((task) => [task.task_id, task]));
  // the header is the shared column list for the country's waves (pr-b0);
  // every row is placed by column name, so a draft saved under an earlier
  // or divergent field list loses nothing and shifts nothing
  const targetYears = targetYearsOrEmpty(countryCode);
  const fields = wideEvidenceFields(targetYears);
  const rows: Record<string, unknown>[] = [];
  let fieldMismatchCount = 0;

  for (const draft of evidenceDrafts) {
    if (!acceptedDraftIds.has(draft.evidence_draft_id)) {
      continue;
    }
    if (!isWideEvidenceExportEligible(draft)) {
      continue;
    }
    let generated;
    try {
      generated = readGeneratedWideRow(draft.generated_wide_row);
    } catch {
      generated = undefined;
    }
    if (generated === undefined) {
      continue;
    }
    const sameFields = generated.fields.length === fields.length
      && generated.fields.every((field, index) => field === fields[index]);
    if (!sameFields) {
      fieldMismatchCount += 1;
    }
    // the reviewer's ruling on a moved pin rides beside the row's own point
    const ruling = acceptingDecisionForDraft(reviewDecisions, draft.evidence_draft_id);
    rows.push({
      ...overlayTargetYears(
        generated.row,
        draft,
        targetYears,
        derivedLocations.filter((l) => l.parent_evidence_draft_id === draft.evidence_draft_id),
      ),
      ...locationOutcomeColumns(tasksByTaskId.get(draft.task_id), ruling?.location_outcome),
    });
  }

  if (rows.length === 0) {
    return { csv: "", rowCount: 0, fieldCount: 0, fieldMismatchCount };
  }

  const lines = [csvLine(fields)];
  for (const row of rows) {
    lines.push(csvLine(wideEvidenceRowValues(row, fields)));
  }
  return {
    csv: `${lines.join("\n")}\n`,
    rowCount: rows.length,
    fieldCount: fields.length,
    fieldMismatchCount,
  };
}

// pow-export-bundle.v1 (docs/development/frozen-exports.md section 2): the
// filenames the bundle always carries (export_manifest.json plus the
// content files), their content types, and the flat key each is returned
// under from getExportBundle's `files` object.
const FILE_CONTENT_TYPES: Record<string, string> = {
  "tasks.jsonl": "application/x-ndjson",
  "task_events.jsonl": "application/x-ndjson",
  "evidence_drafts.jsonl": "application/x-ndjson",
  "historical_claims.jsonl": "application/x-ndjson",
  "review_decisions.jsonl": "application/x-ndjson",
  "site_occupancies.jsonl": "application/x-ndjson",
  "derived_target_year_states.jsonl": "application/x-ndjson",
  "derived_year_locations.jsonl": "application/x-ndjson",
  "derived_target_year_functions.jsonl": "application/x-ndjson",
  "derived_state_events.jsonl": "application/x-ndjson",
  "site_evidence_wide.csv": "text/csv",
  "evidence_versions.jsonl": "application/x-ndjson",
  "evidence_head_changes.jsonl": "application/x-ndjson",
  "task_acceptances.jsonl": "application/x-ndjson",
  "review_snapshots.jsonl": "application/x-ndjson",
};

const FILE_KEYS: Record<string, string> = {
  "export_manifest.json": "export_manifest_json",
  "tasks.jsonl": "tasks_jsonl",
  "task_events.jsonl": "task_events_jsonl",
  "evidence_drafts.jsonl": "evidence_drafts_jsonl",
  "historical_claims.jsonl": "historical_claims_jsonl",
  "review_decisions.jsonl": "review_decisions_jsonl",
  "site_occupancies.jsonl": "site_occupancies_jsonl",
  "derived_target_year_states.jsonl": "derived_target_year_states_jsonl",
  "derived_year_locations.jsonl": "derived_year_locations_jsonl",
  "derived_target_year_functions.jsonl": "derived_target_year_functions_jsonl",
  "derived_state_events.jsonl": "derived_state_events_jsonl",
  "site_evidence_wide.csv": "site_evidence_wide_csv",
  "evidence_versions.jsonl": "evidence_versions_jsonl",
  "evidence_head_changes.jsonl": "evidence_head_changes_jsonl",
  "task_acceptances.jsonl": "task_acceptances_jsonl",
  "review_snapshots.jsonl": "review_snapshots_jsonl",
};

// interim scale gate (review of PR #112, 2026-09-12; lifted by the budgeted
// composer in the lean-storage brief): prepareFreeze reads and builds a whole
// batch in one transaction and returns every file's text in one result, so a
// batch is bounded by the Convex per-call and transaction-read caps (16 MiB).
// Automatic selection is capped at a small count and refuses, naming the
// count, when a country holds more accepted tasks than that, so a curator
// names bounded lists explicitly; and every freeze refuses at capture when
// the built bundle exceeds the byte budget, before any blob is stored.
export const AUTOMATIC_BATCH_TASK_LIMIT = 100;
export const EXPORT_BATCH_BYTE_BUDGET = 6 * 1024 * 1024;

type BuiltFile = { text: string; content_type: string; sha256: string; byte_length: number };

function flattenFiles(filesByFilename: Record<string, BuiltFile>): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const [filename, key] of Object.entries(FILE_KEYS)) {
    flat[key] = filesByFilename[filename]?.text ?? "";
  }
  return flat;
}

// every row the bundle carries for a batch, gathered in the sorted,
// de-duplicated task/decision/acceptance id order the manifest itself uses;
// the per-task reads are the same indexed queries the pre-freeze bundle used,
// extended with the three new per-task tables and the snapshot rows the
// included decisions name
async function collectBundleRows(ctx: any, batch: Doc<"export_batches">) {
  const taskIds = sortedUnique(batch.included_task_ids);
  const reviewDecisionIds = sortedUnique(batch.included_review_decision_ids);
  const acceptanceIds = sortedUnique(batch.included_acceptance_ids ?? []);

  const tasks: Doc<"tasks">[] = [];
  const taskEvents: Doc<"task_events">[] = [];
  const evidenceDrafts: Doc<"evidence_drafts">[] = [];
  const historicalClaims: Doc<"historical_claims">[] = [];
  const occupancies: Doc<"site_occupancies">[] = [];
  const derivedStates: Doc<"derived_target_year_states">[] = [];
  const derivedLocations: Doc<"derived_year_locations">[] = [];
  const derivedFunctions: Doc<"derived_target_year_functions">[] = [];
  const derivedEvents: Doc<"derived_state_events">[] = [];
  const evidenceVersions: Doc<"evidence_versions">[] = [];
  const evidenceHeadChanges: Doc<"evidence_head_changes">[] = [];
  const taskAcceptances: Doc<"task_acceptances">[] = [];

  for (const taskId of taskIds) {
    const task = await taskByTaskId(ctx, taskId);
    if (task !== null) {
      tasks.push(task);
    }
    taskEvents.push(
      ...(await ctx.db.query("task_events").withIndex("by_task_time", (q: any) => q.eq("task_id", taskId)).collect()),
    );
    evidenceDrafts.push(
      ...(await ctx.db.query("evidence_drafts").withIndex("by_task_status", (q: any) => q.eq("task_id", taskId)).collect()),
    );
    const taskHistoricalClaims = await ctx.db
      .query("historical_claims")
      .withIndex("by_task_and_created_at", (q: any) => q.eq("task_id", taskId))
      .take(501);
    if (taskHistoricalClaims.length > 500) {
      throw new Error(`Task ${taskId} has more than 500 historical claims; split or review it before export.`);
    }
    historicalClaims.push(...taskHistoricalClaims);
    occupancies.push(
      ...(await ctx.db.query("site_occupancies").withIndex("by_task_and_created_at", (q: any) => q.eq("task_id", taskId)).collect()),
    );
    derivedStates.push(
      ...(await ctx.db.query("derived_target_year_states").withIndex("by_task", (q: any) => q.eq("task_id", taskId)).collect()),
    );
    derivedLocations.push(
      ...(await ctx.db.query("derived_year_locations").withIndex("by_task", (q: any) => q.eq("task_id", taskId)).collect()),
    );
    derivedFunctions.push(
      ...(await ctx.db.query("derived_target_year_functions").withIndex("by_task", (q: any) => q.eq("task_id", taskId)).collect()),
    );
    derivedEvents.push(
      ...(await ctx.db.query("derived_state_events").withIndex("by_task_and_created_at", (q: any) => q.eq("task_id", taskId)).collect()),
    );
    evidenceVersions.push(
      ...(await ctx.db.query("evidence_versions").withIndex("by_task", (q: any) => q.eq("task_id", taskId)).collect()),
    );
    evidenceHeadChanges.push(
      ...(await ctx.db.query("evidence_head_changes").withIndex("by_task", (q: any) => q.eq("task_id", taskId)).collect()),
    );
    taskAcceptances.push(
      ...(await ctx.db.query("task_acceptances").withIndex("by_task", (q: any) => q.eq("task_id", taskId)).collect()),
    );
  }

  const reviewDecisions: Doc<"review_decisions">[] = [];
  for (const reviewDecisionId of reviewDecisionIds) {
    const decision = await ctx.db
      .query("review_decisions")
      .withIndex("by_review_decision_id", (q: any) => q.eq("review_decision_id", reviewDecisionId))
      .unique();
    if (decision !== null) {
      reviewDecisions.push(decision);
    }
  }

  const snapshotHashes = sortedUnique(
    reviewDecisions
      .map((decision) => decision.review_snapshot_hash)
      .filter((hash): hash is string => hash !== undefined),
  );
  const reviewSnapshots: Doc<"review_snapshots">[] = [];
  for (const hash of snapshotHashes) {
    const row = await ctx.db.query("review_snapshots").withIndex("by_hash", (q: any) => q.eq("snapshot_hash", hash)).unique();
    if (row !== null) {
      reviewSnapshots.push(row);
    }
  }

  return {
    taskIds,
    reviewDecisionIds,
    acceptanceIds,
    tasks,
    taskEvents,
    evidenceDrafts,
    historicalClaims,
    reviewDecisions,
    occupancies,
    derivedStates,
    derivedLocations,
    derivedFunctions,
    derivedEvents,
    evidenceVersions,
    evidenceHeadChanges,
    taskAcceptances,
    reviewSnapshots,
  };
}

// builds the manifest object and every file's exact text, for a batch, at a
// given `frozen_at` (undefined for a draft preview). `includeHash` controls
// whether a `manifest_hash` member is computed and present, per the bundle
// contract: only a frozen bundle carries one. deterministic for a fixed
// database state, since every read above is an indexed lookup over a sorted
// id list and nothing here reads `Date.now()`.
async function buildBundle(
  ctx: any,
  batch: Doc<"export_batches">,
  frozenAt: number | undefined,
  includeHash: boolean,
): Promise<{
  manifest: Record<string, unknown>;
  manifestHash: string | undefined;
  filesByFilename: Record<string, BuiltFile>;
}> {
  const rows = await collectBundleRows(ctx, batch);
  const wide = siteEvidenceWideCsv(batch.country_code, rows.evidenceDrafts, rows.reviewDecisions, rows.derivedLocations, rows.tasks);

  const fileTexts: Record<string, string> = {
    "tasks.jsonl": jsonl(rows.tasks),
    "task_events.jsonl": jsonl(rows.taskEvents),
    "evidence_drafts.jsonl": jsonl(rows.evidenceDrafts),
    "historical_claims.jsonl": jsonl(rows.historicalClaims),
    "review_decisions.jsonl": jsonl(rows.reviewDecisions),
    "site_occupancies.jsonl": jsonl(rows.occupancies),
    "derived_target_year_states.jsonl": jsonl(rows.derivedStates),
    "derived_year_locations.jsonl": jsonl(rows.derivedLocations),
    "derived_target_year_functions.jsonl": jsonl(rows.derivedFunctions),
    "derived_state_events.jsonl": jsonl(rows.derivedEvents),
    "site_evidence_wide.csv": wide.csv,
    "evidence_versions.jsonl": jsonl(rows.evidenceVersions),
    "evidence_head_changes.jsonl": jsonl(rows.evidenceHeadChanges),
    "task_acceptances.jsonl": jsonl(rows.taskAcceptances),
    "review_snapshots.jsonl": jsonl(rows.reviewSnapshots),
  };
  const recordCounts: Record<string, number> = {
    "tasks.jsonl": rows.tasks.length,
    "task_events.jsonl": rows.taskEvents.length,
    "evidence_drafts.jsonl": rows.evidenceDrafts.length,
    "historical_claims.jsonl": rows.historicalClaims.length,
    "review_decisions.jsonl": rows.reviewDecisions.length,
    "site_occupancies.jsonl": rows.occupancies.length,
    "derived_target_year_states.jsonl": rows.derivedStates.length,
    "derived_year_locations.jsonl": rows.derivedLocations.length,
    "derived_target_year_functions.jsonl": rows.derivedFunctions.length,
    "derived_state_events.jsonl": rows.derivedEvents.length,
    "site_evidence_wide.csv": wide.rowCount,
    "evidence_versions.jsonl": rows.evidenceVersions.length,
    "evidence_head_changes.jsonl": rows.evidenceHeadChanges.length,
    "task_acceptances.jsonl": rows.taskAcceptances.length,
    "review_snapshots.jsonl": rows.reviewSnapshots.length,
  };

  const filesManifest = Object.keys(fileTexts)
    .sort()
    .map((filename) => ({
      filename,
      content_type: FILE_CONTENT_TYPES[filename],
      record_count: recordCounts[filename],
      field_count: filename === "site_evidence_wide.csv" ? wide.fieldCount : undefined,
      field_list_mismatch_count: filename === "site_evidence_wide.csv" ? wide.fieldMismatchCount : undefined,
      sha256: sha256(fileTexts[filename]),
      byte_length: utf8Length(fileTexts[filename]),
    }));

  const manifestFields: Record<string, unknown> = {
    bundle_contract: "pow-export-bundle.v1",
    hash_contract: "pow-object.v1",
    export_batch_id: batch.export_batch_id,
    country_code: batch.country_code,
    schema_version: batch.schema_version,
    export_format: batch.export_format,
    created_at: batch.created_at,
    frozen_at: frozenAt,
    supersedes_export_batch_id: batch.supersedes_export_batch_id,
    included_task_ids: rows.taskIds,
    included_review_decision_ids: rows.reviewDecisionIds,
    included_acceptance_ids: rows.acceptanceIds,
    included_task_count: rows.tasks.length,
    included_evidence_count: rows.evidenceDrafts.length,
    included_historical_claim_count: rows.historicalClaims.length,
    included_review_decision_count: rows.reviewDecisions.length,
    evidence_version_hashes: sortedUnique(rows.evidenceVersions.map((row) => row.object_hash)),
    review_snapshot_hashes: sortedUnique(rows.reviewSnapshots.map((row) => row.snapshot_hash)),
    files: filesManifest,
  };

  // undefined optional members (frozen_at on a draft, supersedes_export_batch_id
  // when absent, the two wide-csv-only file fields on every other file) are
  // stripped before hashing and before writing, per the pow-object.v1 domain:
  // an omitted optional field and an absent field must hash identically
  const withoutHash = withoutUndefined(manifestFields);
  const manifestHash = includeHash ? objectHash(withoutHash) : undefined;
  const manifest = includeHash ? { ...withoutHash, manifest_hash: manifestHash } : withoutHash;
  const manifestText = JSON.stringify(manifest, null, 2) + "\n";

  const filesByFilename: Record<string, BuiltFile> = {};
  for (const entry of filesManifest) {
    filesByFilename[entry.filename] = {
      text: fileTexts[entry.filename],
      content_type: entry.content_type,
      sha256: entry.sha256,
      byte_length: entry.byte_length,
    };
  }
  filesByFilename["export_manifest.json"] = {
    text: manifestText,
    content_type: "application/json",
    sha256: sha256(manifestText),
    byte_length: utf8Length(manifestText),
  };

  return { manifest, manifestHash, filesByFilename };
}

// the export's per-task eligibility and authority check (D20 freeze-time
// recheck, docs/development/frozen-exports.md): the task exists and is
// pi_accepted and not training-excluded; the decision naming the task's
// current export authority (the one its latest accepted acceptance names,
// or the newest accepted decision when the task carries no acceptance row)
// is still accepted_for_export; its pinned evidence version, if any, still
// matches the draft's current hash; and a snapshot-linked authority decision
// still passes assertDecisionSnapshotConsistent. Shared by createExportBatch
// (composing a new batch) and prepareFreeze (rechecking an existing batch's
// membership immediately before it is frozen); returns every accepted
// decision id and every accepted acceptance id on the task, which is what a
// batch stores as retained history, not only the authoritative pair.
async function assertTaskExportAuthority(
  ctx: any,
  taskId: string,
): Promise<{ reviewDecisionIds: string[]; acceptanceIds: string[] }> {
  const task = await taskByTaskId(ctx, taskId);
  if (task?.source_context?.training?.exclude_from_exports === true) {
    throw new Error(`Task ${taskId} is training-excluded and cannot enter an export batch.`);
  }
  const refusal = exportRefusalForTask(taskId, task?.status);
  if (refusal !== null) {
    throw new Error(refusal);
  }
  const decisions = await decisionsForTask(ctx, taskId);
  const accepted = decisions.filter((decision) => decision.decision_status === "accepted_for_export");
  const acceptances: Doc<"task_acceptances">[] = await ctx.db
    .query("task_acceptances")
    .withIndex("by_task", (q: any) => q.eq("task_id", taskId))
    .collect();
  const acceptedAcceptances = acceptances
    .filter((row) => row.outcome === "accepted")
    .sort((a, b) => b.created_at - a.created_at);
  // the decision that carries the task's current export authority is the
  // one its latest accepted acceptance names; earlier accepted decisions on
  // the task are retained history and are not checked here (they may since
  // have changed without bearing on what is exported now). a task with no
  // acceptance row (pre-layer) falls back to the newest accepted decision
  const authorityId = acceptedAcceptances[0]?.review_decision_id;
  const authority = authorityId !== undefined
    ? accepted.find((decision) => decision.review_decision_id === authorityId) ?? null
    : [...accepted].sort((a, b) => b.created_at - a.created_at)[0] ?? null;
  if (authorityId !== undefined && authority === null) {
    throw new Error(
      `Task ${taskId}: the accepted acceptance names decision ${authorityId}, which is not an accepted-for-export decision on this task.`,
    );
  }
  if (authority !== null) {
    // no silent transfer: an accepted decision that pinned a version is
    // checked against the draft's current version before it enters or
    // stays in a batch
    if (authority.evidence_version_hash !== undefined && authority.evidence_draft_id !== undefined) {
      const decisionDraft = await ctx.db
        .query("evidence_drafts")
        .withIndex("by_evidence_draft_id", (q: any) => q.eq("evidence_draft_id", authority.evidence_draft_id!))
        .unique();
      if (decisionDraft !== null && decisionDraft.evidence_version_hash !== authority.evidence_version_hash) {
        throw new Error(
          `Task ${taskId}: accepted decision ${authority.review_decision_id} refers to evidence version ${authority.evidence_version_hash} but ${authority.evidence_draft_id} is now at ${decisionDraft.evidence_version_hash}; re-review before export.`,
        );
      }
    }
    // pi ruling 2026-09-11: a snapshot-linked decision's recorded snapshot
    // must still match the current evidence and its confirmed locations
    if (authority.review_snapshot_hash !== undefined) {
      await assertDecisionSnapshotConsistent(ctx, authority);
    }
  }
  return {
    reviewDecisionIds: accepted.map((decision) => decision.review_decision_id),
    acceptanceIds: acceptedAcceptances.map((row) => row.acceptance_id),
  };
}

export const listExportBatches = query({
  args: {
    countryCode: v.optional(v.string()),
    status: v.optional(exportBatchStatus),
    limit: v.optional(v.number()),
  },
  returns: v.array(exportBatchDoc),
  handler: async (ctx, args) => {
    await requireUser(ctx, ["curator", "admin"]);
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
    if (args.countryCode !== undefined && args.status !== undefined) {
      const countryCode = args.countryCode;
      const status = args.status;
      return await ctx.db
        .query("export_batches")
        .withIndex("by_country_status", (q) => q.eq("country_code", countryCode).eq("status", status))
        .take(limit);
    }
    return await ctx.db.query("export_batches").withIndex("by_created_time").order("desc").take(limit);
  },
});

// the replacement-membership rule for supersession (review of PR #112,
// 2026-09-12): a superseding batch must include every task its predecessor
// exported, and may add more. A batch that drops a predecessor task cannot
// supersede it, because the dropped task would lose its only processable
// frozen record; the curator withdraws the earlier batch instead. Until
// ruling 11 of the lean-storage brief lets a superseding batch carry an
// unchanged `exported` task forward, this means every predecessor task
// must have been reopened, re-reviewed, and re-accepted.
function assertReplacementCovers(earlier: Doc<"export_batches">, taskIds: string[], earlierId: string): void {
  if (taskIds.length === 0) {
    throw new Error(`A batch superseding ${earlierId} must include at least one task; an empty batch cannot replace it.`);
  }
  const replacement = new Set(taskIds);
  const missing = earlier.included_task_ids.filter((taskId) => !replacement.has(taskId));
  if (missing.length > 0) {
    throw new Error(
      `A batch superseding ${earlierId} must include every task it exported; missing ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? ` and ${missing.length - 5} more` : ""}. Withdraw the earlier batch instead if those tasks are not being re-exported.`,
    );
  }
}

export const createExportBatch = mutation({
  args: {
    countryCode: v.string(),
    taskIds: v.optional(v.array(v.string())),
    exportFormat: v.optional(exportFormat),
    notes: v.optional(v.string()),
    // frozen exports, supersession (docs/development/frozen-exports.md
    // section 5): the earlier frozen batch this one is meant to replace.
    // The earlier batch changes status only when this one completes its
    // freeze.
    supersedesExportBatchId: v.optional(v.string()),
  },
  returns: v.object({
    export_batch_id: v.string(),
    included_task_count: v.number(),
    included_review_decision_count: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["curator", "admin"]);
    const now = Date.now();

    if (args.supersedesExportBatchId !== undefined) {
      const earlier = await batchByExportBatchId(ctx, args.supersedesExportBatchId);
      if (earlier === null) {
        throw new Error(`Export batch not found: ${args.supersedesExportBatchId}`);
      }
      if (earlier.status !== "frozen" || earlier.frozen_files === undefined) {
        throw new Error(
          `Export batch ${args.supersedesExportBatchId} must be a frozen batch with stored bytes to be superseded.`,
        );
      }
      if (earlier.country_code !== args.countryCode) {
        throw new Error(
          `Export batch ${args.supersedesExportBatchId} is a ${earlier.country_code} batch and cannot be superseded by a ${args.countryCode} batch.`,
        );
      }
    }

    let requestedTaskIds: string[];
    if (args.taskIds !== undefined) {
      requestedTaskIds = args.taskIds;
    } else {
      const accepted = await ctx.db
        .query("tasks")
        // the pi acceptance layer (jb 2026-09-04): a batch takes only
        // tasks a principal investigator has accepted, never a
        // reviewer's acceptance alone
        .withIndex("by_country_status", (q) => q.eq("country_code", args.countryCode).eq("status", "pi_accepted"))
        .take(AUTOMATIC_BATCH_TASK_LIMIT + 1);
      if (accepted.length > AUTOMATIC_BATCH_TASK_LIMIT) {
        throw new Error(
          `${args.countryCode} has more than ${AUTOMATIC_BATCH_TASK_LIMIT} pi_accepted tasks; automatic selection would exceed one freeze's transaction budget. Name up to ${AUTOMATIC_BATCH_TASK_LIMIT} tasks explicitly in taskIds per batch until the budgeted batch composer lands.`,
        );
      }
      requestedTaskIds = accepted.map((task) => task.task_id);
    }

    // training tasks never enter an export bundle, even when named
    // explicitly; a named task a pi has not accepted refuses the batch
    const taskIds: string[] = [];
    for (const taskId of requestedTaskIds) {
      const task = await ctx.db
        .query("tasks")
        .withIndex("by_task_id", (q) => q.eq("task_id", taskId))
        .unique();
      if (task?.source_context?.training?.exclude_from_exports === true) {
        continue;
      }
      const refusal = exportRefusalForTask(taskId, task?.status);
      if (refusal !== null) {
        throw new Error(refusal);
      }
      taskIds.push(taskId);
    }

    // the shared authority check (also run again, per task, at freeze
    // time by prepareFreeze) computes the accepted decisions and accepted
    // acceptances a task contributes to the batch's retained history
    const reviewDecisionIds: string[] = [];
    const acceptanceIds: string[] = [];
    for (const taskId of taskIds) {
      const authority = await assertTaskExportAuthority(ctx, taskId);
      reviewDecisionIds.push(...authority.reviewDecisionIds);
      acceptanceIds.push(...authority.acceptanceIds);
    }

    if (args.supersedesExportBatchId !== undefined) {
      const earlier = await batchByExportBatchId(ctx, args.supersedesExportBatchId);
      if (earlier !== null) {
        assertReplacementCovers(earlier, taskIds, args.supersedesExportBatchId);
      }
    }

    const exportBatchId = `${args.countryCode.toLowerCase()}-convex-export-${now}`;
    await ctx.db.insert("export_batches", {
      export_batch_id: exportBatchId,
      country_code: args.countryCode,
      status: "draft",
      created_by: user._id,
      created_at: now,
      included_task_ids: taskIds,
      included_review_decision_ids: reviewDecisionIds,
      included_acceptance_ids: acceptanceIds,
      schema_version: "convex-task-layer.v0.1",
      export_format: args.exportFormat ?? "bundle",
      pow_validation_status: "not_run",
      notes: args.notes,
      supersedes_export_batch_id: args.supersedesExportBatchId,
    });

    return {
      export_batch_id: exportBatchId,
      included_task_count: taskIds.length,
      included_review_decision_count: reviewDecisionIds.length,
    };
  },
});

// step 1 of freezing (docs/development/frozen-exports.md section 3):
// rechecks every included task's eligibility and export authority, checks
// the batch's stored membership still matches what that recheck returns,
// builds the complete bundle at this attempt's `frozen_at`, and records the
// attempt with its full manifest on the batch. Its only write is the final
// patch, so any refusal above it leaves the batch completely untouched.
export const prepareFreeze = internalMutation({
  args: { exportBatchId: v.string(), userId: v.id("users"), attemptId: v.string() },
  returns: v.object({
    manifest_hash: v.string(),
    frozen_at: v.number(),
    files: v.array(v.object({ filename: v.string(), content_type: v.string(), text: v.string() })),
  }),
  handler: async (ctx, args) => {
    await requireUser(ctx, ["curator", "admin"]);
    const batch = await batchByExportBatchId(ctx, args.exportBatchId);
    if (batch === null) {
      throw new Error(`Export batch not found: ${args.exportBatchId}`);
    }
    if (batch.status !== "draft") {
      throw new Error("Only draft export batches can be frozen.");
    }

    const currentDecisionIds: string[] = [];
    const currentAcceptanceIds: string[] = [];
    for (const taskId of batch.included_task_ids) {
      const authority = await assertTaskExportAuthority(ctx, taskId);
      currentDecisionIds.push(...authority.reviewDecisionIds);
      currentAcceptanceIds.push(...authority.acceptanceIds);
    }
    const storedDecisionIds = sortedUnique(batch.included_review_decision_ids);
    const storedAcceptanceIds = sortedUnique(batch.included_acceptance_ids ?? []);
    const nowDecisionIds = sortedUnique(currentDecisionIds);
    const nowAcceptanceIds = sortedUnique(currentAcceptanceIds);
    const sameMembership =
      storedDecisionIds.length === nowDecisionIds.length
      && storedDecisionIds.every((id, index) => id === nowDecisionIds[index])
      && storedAcceptanceIds.length === nowAcceptanceIds.length
      && storedAcceptanceIds.every((id, index) => id === nowAcceptanceIds[index]);
    if (!sameMembership) {
      throw new Error(
        `Export batch ${args.exportBatchId}: membership changed since it was created (its accepted review decisions or acceptances no longer match); create a new batch.`,
      );
    }

    const frozenAt = Date.now();
    const built = await buildBundle(ctx, batch, frozenAt, true);
    const bundleBytes = Object.values(built.filesByFilename).reduce((total, file) => total + file.byte_length, 0);
    if (bundleBytes > EXPORT_BATCH_BYTE_BUDGET) {
      throw new Error(
        `Export batch ${args.exportBatchId}: the bundle is ${bundleBytes} bytes over ${batch.included_task_ids.length} tasks, above the ${EXPORT_BATCH_BYTE_BUDGET}-byte freeze budget; create smaller batches (name fewer tasks in taskIds).`,
      );
    }
    await ctx.db.patch(batch._id, {
      pending_freeze: {
        attempt_id: args.attemptId,
        started_at: frozenAt,
        started_by: args.userId,
        manifest: built.manifest,
      },
    });

    const files = Object.entries(built.filesByFilename).map(([filename, file]) => ({
      filename,
      content_type: file.content_type,
      text: file.text,
    }));
    return { manifest_hash: built.manifestHash as string, frozen_at: frozenAt, files };
  },
});

// step 3 of freezing: requires the batch still draft with this attempt
// current, rebuilds the bundle from the current rows at the same
// `frozen_at`, and refuses if any file (or the manifest as a whole) no
// longer matches what prepareFreeze captured, i.e. a row changed while the
// action was storing blobs. On success, commits the frozen batch, moves
// every included task to exported, and marks a superseded predecessor.
// the result completeFreeze returned when `attemptId` committed the batch,
// or null when that attempt did not (or has not yet) committed. Read by the
// idempotent path in completeFreeze and by freezeAttemptOutcome.
function committedFreezeResult(
  batch: Doc<"export_batches">,
  attemptId: string,
): { export_batch_id: string; status: "frozen"; manifest_hash: string; frozen_at: number; file_count: number } | null {
  if (
    batch.frozen_by_attempt_id !== attemptId
    || batch.frozen_files === undefined
    || batch.manifest_hash === undefined
    || batch.frozen_at === undefined
  ) {
    return null;
  }
  return {
    export_batch_id: batch.export_batch_id,
    status: "frozen" as const,
    manifest_hash: batch.manifest_hash,
    frozen_at: batch.frozen_at,
    file_count: batch.frozen_files.length,
  };
}

// whether a freeze attempt committed: the action asks this before deleting
// the blobs an attempt stored, because a failed completeFreeze call has an
// ambiguous outcome (a rejected transaction, or a committed one whose
// response was lost), and the bytes of a committed freeze must never be
// deleted. Withdrawal and supersession keep `frozen_by_attempt_id`, so a
// batch that commits and is then withdrawn still answers committed.
export const freezeAttemptOutcome = internalQuery({
  args: { exportBatchId: v.string(), attemptId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      export_batch_id: v.string(),
      status: v.literal("frozen"),
      manifest_hash: v.string(),
      frozen_at: v.number(),
      file_count: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireUser(ctx, ["curator", "admin"]);
    const batch = await batchByExportBatchId(ctx, args.exportBatchId);
    if (batch === null) {
      return null;
    }
    return committedFreezeResult(batch, args.attemptId);
  },
});

export const completeFreeze = internalMutation({
  args: {
    exportBatchId: v.string(),
    attemptId: v.string(),
    userId: v.id("users"),
    storedFiles: v.array(
      v.object({
        filename: v.string(),
        storageId: v.id("_storage"),
        sha256: v.string(),
        byteLength: v.number(),
        contentType: v.string(),
      }),
    ),
  },
  returns: v.object({
    export_batch_id: v.string(),
    status: v.literal("frozen"),
    manifest_hash: v.string(),
    frozen_at: v.number(),
    file_count: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["curator", "admin"]);
    const batch = await batchByExportBatchId(ctx, args.exportBatchId);
    if (batch === null) {
      throw new Error(`Export batch not found: ${args.exportBatchId}`);
    }
    // idempotent completion: a retry of an attempt that already committed
    // (the action lost the response of its first call) returns the same
    // result rather than refusing, so the action can settle without deleting
    // the bytes that attempt stored
    const committed = committedFreezeResult(batch, args.attemptId);
    if (committed !== null) {
      return committed;
    }
    if (batch.status !== "draft" || batch.pending_freeze === undefined || batch.pending_freeze.attempt_id !== args.attemptId) {
      throw new Error(
        `Export batch ${args.exportBatchId}: this freeze attempt is no longer current (a later attempt, or a status change, superseded it).`,
      );
    }

    const pendingManifest = batch.pending_freeze.manifest as Record<string, unknown>;
    const frozenAt = batch.pending_freeze.started_at;

    // a fresh rebuild, compared file by file to the manifest captured at
    // prepare time: any difference means a row changed between capture and
    // completion, and the freeze must refuse rather than commit bytes the
    // current rows no longer match
    const rebuilt = await buildBundle(ctx, batch, frozenAt, true);
    const pendingFiles = (pendingManifest.files as Array<{ filename: string; sha256: string; byte_length: number }>) ?? [];
    for (const entry of pendingFiles) {
      const current = rebuilt.filesByFilename[entry.filename];
      if (current === undefined || current.sha256 !== entry.sha256 || current.byte_length !== entry.byte_length) {
        throw new Error(
          `Export batch ${args.exportBatchId}: ${entry.filename} changed between freeze capture and completion (captured sha256 ${entry.sha256}, now ${current?.sha256 ?? "missing"}).`,
        );
      }
    }
    if (rebuilt.manifestHash !== pendingManifest.manifest_hash) {
      throw new Error(`Export batch ${args.exportBatchId}: the export manifest changed between freeze capture and completion.`);
    }

    // the predecessor is rechecked in this transaction, before any write:
    // it must still be the frozen, stored, same-country batch this one
    // covers, and nothing else may have withdrawn or superseded it since
    // creation. A refusal here leaves this batch draft, exactly like any
    // other completion refusal.
    let earlier: Doc<"export_batches"> | null = null;
    if (batch.supersedes_export_batch_id !== undefined) {
      earlier = await batchByExportBatchId(ctx, batch.supersedes_export_batch_id);
      if (earlier === null) {
        throw new Error(`Export batch ${args.exportBatchId}: the batch it supersedes, ${batch.supersedes_export_batch_id}, no longer exists.`);
      }
      if (earlier.status !== "frozen" || earlier.frozen_files === undefined || earlier.superseded_by_export_batch_id !== undefined) {
        throw new Error(
          `Export batch ${args.exportBatchId}: the batch it supersedes, ${batch.supersedes_export_batch_id}, is now ${earlier.status}${earlier.superseded_by_export_batch_id !== undefined ? ` (by ${earlier.superseded_by_export_batch_id})` : ""} and can no longer be superseded; create a new batch without supersedesExportBatchId.`,
        );
      }
      if (earlier.country_code !== batch.country_code) {
        throw new Error(
          `Export batch ${args.exportBatchId}: the batch it supersedes, ${batch.supersedes_export_batch_id}, is a ${earlier.country_code} batch.`,
        );
      }
      assertReplacementCovers(earlier, batch.included_task_ids, batch.supersedes_export_batch_id);
    }

    const now = Date.now();
    const actorRole = chooseActorRole(user, ["curator", "admin"]);
    await ctx.db.patch(batch._id, {
      status: "frozen",
      frozen_at: frozenAt,
      freeze_completed_at: now,
      frozen_by_attempt_id: args.attemptId,
      bundle_contract: "pow-export-bundle.v1",
      manifest_hash: pendingManifest.manifest_hash as string,
      frozen_files: args.storedFiles.map((file) => ({
        filename: file.filename,
        storage_id: file.storageId,
        sha256: file.sha256,
        byte_length: file.byteLength,
        content_type: file.contentType,
      })),
      pending_freeze: undefined,
    });

    for (const taskId of batch.included_task_ids) {
      const task = await taskByTaskId(ctx, taskId);
      if (task === null) {
        continue;
      }
      await ctx.db.patch(task._id, {
        status: "exported",
        updated_at: now,
        last_event_at: now,
      });
      await appendTaskEvent(ctx, {
        taskId,
        eventType: "exported",
        actorUserId: args.userId,
        actorRole,
        previousStatus: task.status,
        newStatus: "exported",
        exportBatchId: args.exportBatchId,
      });
    }

    if (earlier !== null) {
      await ctx.db.patch(earlier._id, {
        status: "superseded",
        superseded_by_export_batch_id: args.exportBatchId,
        superseded_at: now,
      });
    }

    return {
      export_batch_id: args.exportBatchId,
      status: "frozen" as const,
      manifest_hash: pendingManifest.manifest_hash as string,
      frozen_at: frozenAt,
      file_count: args.storedFiles.length,
    };
  },
});

// step 4 of freezing: records why an attempt failed and clears it, but only
// when the batch is still draft and no later attempt has since taken over
// `pending_freeze` (an older attempt's belated failure must not clobber a
// newer, still-current one). When prepareFreeze itself refused before
// writing anything, `pending_freeze` is simply absent, and this still
// records the failure.
export const recordFreezeFailure = internalMutation({
  args: { exportBatchId: v.string(), attemptId: v.string(), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireUser(ctx, ["curator", "admin"]);
    const batch = await batchByExportBatchId(ctx, args.exportBatchId);
    if (batch === null || batch.status !== "draft") {
      return null;
    }
    if (batch.pending_freeze !== undefined && batch.pending_freeze.attempt_id !== args.attemptId) {
      return null;
    }
    await ctx.db.patch(batch._id, {
      pending_freeze: undefined,
      last_freeze_failure: { attempt_id: args.attemptId, at: Date.now(), reason: args.reason },
    });
    return null;
  },
});

// freezeExportBatch: an action orchestrating the three internal mutations
// above. It holds no state beyond the storage ids it created: it stores
// every file, reads each back, verifies its bytes, and only then commits
// the freeze; any failure at any step deletes the blobs it stored and
// records why, leaving the batch exactly as it was.
type FreezeResult = { export_batch_id: string; status: "frozen"; manifest_hash: string; frozen_at: number; file_count: number };

export const freezeExportBatch = action({
  args: { exportBatchId: v.string() },
  returns: v.object({
    export_batch_id: v.string(),
    status: v.literal("frozen"),
    manifest_hash: v.string(),
    frozen_at: v.number(),
    file_count: v.number(),
  }),
  // an explicit return type, as on getExportBundle: the handler's own
  // return expressions reach `internal.exports`, which includes this action
  handler: async (ctx, args): Promise<FreezeResult> => {
    // an action has no ctx.db, so the role check runs through an internal
    // query that shares the caller's ctx.auth; every internal mutation this
    // action drives re-checks the role itself too (defence in depth)
    const user: Doc<"users"> = await ctx.runQuery(internal.exports.requireActingUser, {});
    const attemptId = crypto.randomUUID();

    let prepared: { manifest_hash: string; frozen_at: number; files: { filename: string; content_type: string; text: string }[] };
    try {
      prepared = await ctx.runMutation(internal.exports.prepareFreeze, {
        exportBatchId: args.exportBatchId,
        userId: user._id,
        attemptId,
      });
    } catch (error) {
      await ctx.runMutation(internal.exports.recordFreezeFailure, {
        exportBatchId: args.exportBatchId,
        attemptId,
        reason: errorMessage(error),
      });
      throw error;
    }

    const storedFiles: { filename: string; storageId: Id<"_storage">; sha256: string; byteLength: number; contentType: string }[] = [];
    // every blob this attempt stores, whether or not it goes on to verify;
    // a file that fails its own read-back check was still stored and must
    // still be deleted on the way out
    const allStorageIds: Id<"_storage">[] = [];
    try {
      for (const file of prepared.files) {
        const expectedSha256 = sha256(file.text);
        const expectedByteLength = utf8Length(file.text);
        const storageId = await ctx.storage.store(new Blob([file.text], { type: file.content_type }));
        allStorageIds.push(storageId);
        const blob = await ctx.storage.get(storageId);
        if (blob === null) {
          throw new Error(`Stored file ${file.filename} could not be read back from storage.`);
        }
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const digest = await crypto.subtle.digest("SHA-256", bytes);
        const actualSha256 = hexOfDigest(digest);
        if (actualSha256 !== expectedSha256 || bytes.length !== expectedByteLength) {
          throw new Error(
            `Stored file ${file.filename} did not verify on read-back (expected sha256 ${expectedSha256} and ${expectedByteLength} bytes, got ${actualSha256} and ${bytes.length} bytes).`,
          );
        }
        storedFiles.push({
          filename: file.filename,
          storageId,
          sha256: expectedSha256,
          byteLength: expectedByteLength,
          contentType: file.content_type,
        });
      }
    } catch (error) {
      for (const storageId of allStorageIds) {
        await ctx.storage.delete(storageId);
      }
      await ctx.runMutation(internal.exports.recordFreezeFailure, {
        exportBatchId: args.exportBatchId,
        attemptId,
        reason: errorMessage(error),
      });
      throw error;
    }

    try {
      const completed: FreezeResult = await ctx.runMutation(internal.exports.completeFreeze, {
        exportBatchId: args.exportBatchId,
        attemptId,
        userId: user._id,
        storedFiles,
      });
      return completed;
    } catch (error) {
      // a failed call is ambiguous: the transaction may have been rejected,
      // or it may have committed and only its response been lost. Only a
      // batch that answers "not committed by this attempt" has its blobs
      // deleted; a committed one returns its result, and an outcome that
      // cannot be established keeps every blob and says so.
      let outcome: FreezeResult | null;
      try {
        outcome = await ctx.runQuery(internal.exports.freezeAttemptOutcome, { exportBatchId: args.exportBatchId, attemptId });
      } catch (probeError) {
        throw new Error(
          `Export batch ${args.exportBatchId}: freeze completion failed (${errorMessage(error)}) and its outcome could not be established (${errorMessage(probeError)}); the ${storedFiles.length} stored blobs were kept (${storedFiles.map((stored) => stored.storageId).join(", ")}). Reconcile the batch before retrying.`,
        );
      }
      if (outcome !== null) {
        return outcome;
      }
      for (const stored of storedFiles) {
        await ctx.storage.delete(stored.storageId);
      }
      await ctx.runMutation(internal.exports.recordFreezeFailure, {
        exportBatchId: args.exportBatchId,
        attemptId,
        reason: errorMessage(error),
      });
      throw error;
    }
  },
});

// the role check `freezeExportBatch` and `getExportBundle` run on the
// caller: an action has no ctx.db of its own, so this internal query does
// the check (sharing the action's ctx.auth) and hands back the user doc.
export const requireActingUser = internalQuery({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    return await requireUser(ctx, ["curator", "admin"]);
  },
});

// the batch row itself, for the getExportBundle action (which has no direct
// db access): status, frozen_files, and the withdrawal/supersession fields
// disposition needs.
export const getExportBatchRow = internalQuery({
  args: { exportBatchId: v.string() },
  returns: v.union(v.null(), exportBatchDoc),
  handler: async (ctx, args) => {
    await requireUser(ctx, ["curator", "admin"]);
    return await batchByExportBatchId(ctx, args.exportBatchId);
  },
});

// the live preview for a draft batch, or for a batch frozen before this
// change (no stored bytes): rebuilt from the current rows, carrying the
// batch's own `frozen_at` (undefined for a draft) and never a manifest_hash.
export const buildDraftBundle = internalQuery({
  args: { exportBatchId: v.string() },
  returns: v.object({ manifest: v.any(), files: v.any() }),
  handler: async (ctx, args) => {
    await requireUser(ctx, ["curator", "admin"]);
    const batch = await batchByExportBatchId(ctx, args.exportBatchId);
    if (batch === null) {
      throw new Error(`Export batch not found: ${args.exportBatchId}`);
    }
    const built = await buildBundle(ctx, batch, batch.frozen_at, false);
    return { manifest: built.manifest, files: flattenFiles(built.filesByFilename) };
  },
});

const exportBundleFiles = v.object({
  export_manifest_json: v.string(),
  tasks_jsonl: v.string(),
  task_events_jsonl: v.string(),
  evidence_drafts_jsonl: v.string(),
  historical_claims_jsonl: v.string(),
  review_decisions_jsonl: v.string(),
  site_occupancies_jsonl: v.string(),
  derived_target_year_states_jsonl: v.string(),
  derived_year_locations_jsonl: v.string(),
  derived_target_year_functions_jsonl: v.string(),
  derived_state_events_jsonl: v.string(),
  site_evidence_wide_csv: v.string(),
  evidence_versions_jsonl: v.string(),
  evidence_head_changes_jsonl: v.string(),
  task_acceptances_jsonl: v.string(),
  review_snapshots_jsonl: v.string(),
});

// getExportBundle: an action returning the manifest, the sixteen files as
// text, and a disposition describing how they were served. A batch with
// stored bytes (frozen, withdrawn, or superseded) is read from storage and
// verified byte-for-byte against `frozen_files` and its own manifest_hash,
// and never rebuilt from rows. A draft batch, or a batch frozen before this
// change (no stored bytes), is served as a live, unverified preview.
type ExportBundleDisposition = {
  status: Infer<typeof exportBatchStatus>;
  stored_bytes: boolean;
  verified: boolean;
  processing_allowed: boolean;
  withdrawn_at?: number;
  withdrawn_by?: Id<"users">;
  withdrawal_reason?: string;
  superseded_by_export_batch_id?: string;
  superseded_at?: number;
  legacy_unfrozen_bytes?: boolean;
};

type ExportBundleResult = {
  export_manifest: unknown;
  files: Infer<typeof exportBundleFiles>;
  disposition: ExportBundleDisposition;
};

export const getExportBundle = action({
  args: { exportBatchId: v.string() },
  returns: v.object({
    export_manifest: v.any(),
    files: exportBundleFiles,
    disposition: v.object({
      status: exportBatchStatus,
      stored_bytes: v.boolean(),
      verified: v.boolean(),
      processing_allowed: v.boolean(),
      withdrawn_at: v.optional(v.number()),
      withdrawn_by: v.optional(v.id("users")),
      withdrawal_reason: v.optional(v.string()),
      superseded_by_export_batch_id: v.optional(v.string()),
      superseded_at: v.optional(v.number()),
      legacy_unfrozen_bytes: v.optional(v.boolean()),
    }),
  }),
  // an explicit return-type annotation is required here: without one,
  // inferring the handler's return type walks through the same-module
  // internal.exports.* function references this handler calls, which in
  // turn requires the whole module's own type (the very thing being
  // inferred) and typescript refuses the cycle
  handler: async (ctx, args): Promise<ExportBundleResult> => {
    // an action has no ctx.db; getExportBatchRow re-checks the role itself
    await ctx.runQuery(internal.exports.requireActingUser, {});
    const batch: Doc<"export_batches"> | null = await ctx.runQuery(internal.exports.getExportBatchRow, {
      exportBatchId: args.exportBatchId,
    });
    if (batch === null) {
      throw new Error(`Export batch not found: ${args.exportBatchId}`);
    }

    if (batch.frozen_files !== undefined) {
      const filesByFilename: Record<string, string> = {};
      for (const entry of batch.frozen_files) {
        const blob = await ctx.storage.get(entry.storage_id);
        if (blob === null) {
          throw new Error(`Export batch ${args.exportBatchId}: stored file ${entry.filename} is missing from storage.`);
        }
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const digest = await crypto.subtle.digest("SHA-256", bytes);
        const actualSha256 = hexOfDigest(digest);
        if (actualSha256 !== entry.sha256 || bytes.length !== entry.byte_length) {
          throw new Error(
            `Export batch ${args.exportBatchId}: stored file ${entry.filename} failed verification (expected sha256 ${entry.sha256} and ${entry.byte_length} bytes, got ${actualSha256} and ${bytes.length} bytes).`,
          );
        }
        filesByFilename[entry.filename] = new TextDecoder().decode(bytes);
      }

      const manifestText = filesByFilename["export_manifest.json"];
      let manifestParsed: unknown;
      try {
        manifestParsed = manifestText === undefined ? undefined : JSON.parse(manifestText);
      } catch {
        manifestParsed = undefined;
      }
      if (typeof manifestParsed !== "object" || manifestParsed === null || Array.isArray(manifestParsed)) {
        throw new Error(`Export batch ${args.exportBatchId}: export_manifest.json does not parse to an object.`);
      }
      const manifestRecord = manifestParsed as Record<string, unknown>;
      const { manifest_hash: storedHash, ...withoutHash } = manifestRecord;
      const reproduced = objectHash(withoutUndefined(withoutHash));
      if (typeof storedHash !== "string" || reproduced !== storedHash) {
        throw new Error(
          `Export batch ${args.exportBatchId}: export_manifest.json manifest_hash does not reproduce (stored ${String(storedHash)}, recomputed ${reproduced}).`,
        );
      }

      const flat: Record<string, string> = {};
      for (const [filename, key] of Object.entries(FILE_KEYS)) {
        flat[key] = filesByFilename[filename] ?? "";
      }

      return {
        export_manifest: manifestRecord,
        files: flat as unknown as Infer<typeof exportBundleFiles>,
        disposition: {
          status: batch.status,
          stored_bytes: true,
          verified: true,
          processing_allowed: batch.status === "frozen",
          withdrawn_at: batch.withdrawn_at,
          withdrawn_by: batch.withdrawn_by,
          withdrawal_reason: batch.withdrawal_reason,
          superseded_by_export_batch_id: batch.superseded_by_export_batch_id,
          superseded_at: batch.superseded_at,
        },
      };
    }

    const built: { manifest: Record<string, unknown>; files: Record<string, string> } = await ctx.runQuery(
      internal.exports.buildDraftBundle,
      { exportBatchId: args.exportBatchId },
    );

    if (batch.status === "draft") {
      return {
        export_manifest: built.manifest,
        files: built.files as unknown as Infer<typeof exportBundleFiles>,
        disposition: { status: "draft" as const, stored_bytes: false, verified: false, processing_allowed: false },
      };
    }

    return {
      export_manifest: built.manifest,
      files: built.files as unknown as Infer<typeof exportBundleFiles>,
      disposition: {
        status: batch.status,
        stored_bytes: false,
        verified: false,
        processing_allowed: false,
        legacy_unfrozen_bytes: true,
      },
    };
  },
});

// withdrawExportBatch (docs/development/frozen-exports.md section 5): a
// frozen batch's stored bytes and manifest_hash stay; only its status,
// and every included task's timeline, record that it was withdrawn. Task
// statuses are not changed; an exported task returns to review only
// through tasks:reopenTask, as now.
export const withdrawExportBatch = mutation({
  args: { exportBatchId: v.string(), reason: v.string() },
  returns: v.object({ export_batch_id: v.string(), status: v.literal("withdrawn") }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["curator", "admin"]);
    const batch = await batchByExportBatchId(ctx, args.exportBatchId);
    if (batch === null) {
      throw new Error(`Export batch not found: ${args.exportBatchId}`);
    }
    if (batch.status !== "frozen" || batch.frozen_files === undefined) {
      throw new Error("Only a frozen export batch with stored bytes can be withdrawn.");
    }
    assertMaxString("withdrawal reason", args.reason, TASK_REASON_MAX);
    const reason = args.reason.trim();
    if (reason.length < ACCEPTANCE_NOTE_MIN) {
      throw new Error(`Withdrawal needs a reason of at least ${ACCEPTANCE_NOTE_MIN} characters.`);
    }

    const now = Date.now();
    await ctx.db.patch(batch._id, {
      status: "withdrawn",
      withdrawn_at: now,
      withdrawn_by: user._id,
      withdrawal_reason: reason,
    });

    const actorRole = chooseActorRole(user, ["curator", "admin"]);
    for (const taskId of batch.included_task_ids) {
      const task = await taskByTaskId(ctx, taskId);
      if (task === null) {
        continue;
      }
      await appendTaskEvent(ctx, {
        taskId,
        eventType: "note_added",
        actorUserId: user._id,
        actorRole,
        reason: `Export batch ${args.exportBatchId} was withdrawn: ${reason}`,
        exportBatchId: args.exportBatchId,
      });
    }

    return { export_batch_id: args.exportBatchId, status: "withdrawn" as const };
  },
});
