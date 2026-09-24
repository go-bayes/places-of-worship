import { v, type Infer } from "convex/values";
import { action, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { exportFormat, exportBatchStatus } from "./model";
import { chooseActorRole, requireUser } from "./lib/auth";
import {
  BUNDLE_CODEC,
  codecId,
  gzipBundleFile,
  sha256Hex,
  storedObjectKey,
  utf8Bytes,
  verifyStoredFile,
  type CodecRecord,
} from "./lib/bundleCodec";
import { addReadCounts, emptyReadCounts, exceededDimension, meteredCtx, ReadBudgetExceeded, type ReadCounts } from "./lib/readMeter";
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
import { exportBatchDoc, exportRunDoc } from "./lib/validators";

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

// batch budgets (lean-storage brief section 3.1, rulings 1 and 2, jb
// 2026-09-24; pr l1 replaces the interim 100-task automatic-selection cap
// and the capture-time byte refusal of pr #112). A batch must fit one
// prepareFreeze and one completeFreeze transaction, which Convex bounds at
// 16 MiB read, 32,000 documents scanned, 4,096 index ranges read, and a
// 16 MiB function result. The byte budget holds the plain bundle (every
// file prepareFreeze returns in its one result) at 37.5% of the result cap;
// the read budget holds the reads the freeze recheck and bundle build make,
// as measured at composition (convex/lib/readMeter.ts), at a fraction of
// each transaction cap. Both are starting values: the figures measured on a
// real backend are recorded in docs/development/frozen-exports.md.
const MIB = 1024 * 1024;
export const EXPORT_BATCH_BYTE_BUDGET = 6 * MIB;
export const EXPORT_BATCH_READ_BUDGET: ReadCounts = { bytes: 10 * MIB, documents: 16_000, index_ranges: 2_048 };
// a guard on the batch document itself (1 MiB cap): its id lists are held
// twice, on the batch and in pending_freeze.manifest
export const EXPORT_BATCH_MAX_TASKS = 500;
// the manifest's fixed members and its fifteen file entries, pretty-printed;
// an allowance, above the committed fixture's 3.3 KB manifest
const MANIFEST_BASE_BYTES = 8 * 1024;
// reads a batch makes beyond its tasks' own (the batch row, the members, the
// predecessor): an allowance
const BATCH_BASE_READS: ReadCounts = { bytes: 256 * 1024, documents: 16, index_ranges: 16 };
// what a task adds to a freeze beyond the reads measured for it: its run
// member row (read by prepareFreeze) and its task row (read again by
// completeFreeze to move it to exported); an allowance
const PER_TASK_FREEZE_READS: ReadCounts = { bytes: 2 * 1024, documents: 2, index_ranges: 1 };
// one composition step's own reads: a fraction of the transaction caps low
// enough that the step's last task, measured up to EXPORT_BATCH_READ_BUDGET
// before it is refused, still fits one transaction
export const COMPOSE_STEP_READ_BUDGET: ReadCounts = { bytes: 3 * MIB, documents: 6_000, index_ranges: 1_024 };
const COMPOSE_CANDIDATE_PAGE = 32;
// members read per cutting step (small rows); a step stops at the first
// batch boundary past this count
const CUT_STEP_MEMBERS = 1_000;
// a run's lease: longer than an action may run, so a live holder never
// loses it; renewed between the phases of each batch freeze
export const EXPORT_RUN_LEASE_MS = 15 * 60 * 1000;
const EXPORT_RUN_REFUSALS_KEPT = 20;

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
async function collectBundleRows(
  ctx: any,
  batch: Pick<Doc<"export_batches">, "included_task_ids" | "included_review_decision_ids" | "included_acceptance_ids">,
) {
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
type BundleRows = Awaited<ReturnType<typeof collectBundleRows>>;

// every content file's exact text (all but export_manifest.json) and its
// record count, for the collected rows
function bundleFileTexts(countryCode: string, rows: BundleRows) {
  const wide = siteEvidenceWideCsv(countryCode, rows.evidenceDrafts, rows.reviewDecisions, rows.derivedLocations, rows.tasks);

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
  return { wide, fileTexts, recordCounts };
}

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
  const { wide, fileTexts, recordCounts } = bundleFileTexts(batch.country_code, rows);

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
type TaskExportAuthority = {
  reviewDecisionIds: string[];
  acceptanceIds: string[];
  // the decision carrying the task's current export authority and the pins
  // it holds, captured by an export run at composition and rechecked by
  // prepareFreeze
  authorityReviewDecisionId: string | undefined;
  evidenceVersionHash: string | undefined;
  reviewSnapshotHash: string | undefined;
};

async function assertTaskExportAuthority(
  ctx: any,
  taskId: string,
): Promise<TaskExportAuthority> {
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
    authorityReviewDecisionId: authority?.review_decision_id,
    evidenceVersionHash: authority?.evidence_version_hash,
    reviewSnapshotHash: authority?.review_snapshot_hash,
  };
}

// the utf-8 bytes one id adds to the pretty-printed manifest's id lists:
// four spaces, two quotes, a comma, and a newline around the id itself
function manifestIdBytes(ids: readonly string[]): number {
  return ids.reduce((total, id) => total + utf8Length(id) + 8, 0);
}

// the csv header line the batch's site_evidence_wide.csv carries once,
// whatever the number of rows
function wideCsvHeaderBytes(countryCode: string): number {
  return utf8Length(`${csvLine(wideEvidenceFields(targetYearsOrEmpty(countryCode)))}\n`);
}

type TaskMeasurement =
  | { ok: true; authority: TaskExportAuthority; bundleBytes: number; reads: ReadCounts }
  | { ok: false; reason: string; reads: ReadCounts };

// measures what one task adds to a batch (lean-storage brief section 3.1):
// runs the freeze recheck (assertTaskExportAuthority) and the bundle reads
// (collectBundleRows) for the task alone through the read meter, and sizes
// the task's share of the bundle exactly as buildBundle writes it: its rows
// in every jsonl file, its csv rows without the header (counted once per
// batch), and its ids in the manifest. A task whose recheck refuses, or
// whose rows alone exceed the byte or read budget, is refused by name.
async function measureTaskForExport(ctx: any, taskId: string, countryCode: string): Promise<TaskMeasurement> {
  const reads = emptyReadCounts();
  const metered = meteredCtx(ctx, reads, EXPORT_BATCH_READ_BUDGET);
  try {
    const authority = await assertTaskExportAuthority(metered, taskId);
    const rows = await collectBundleRows(metered, {
      included_task_ids: [taskId],
      included_review_decision_ids: authority.reviewDecisionIds,
      included_acceptance_ids: authority.acceptanceIds,
    });
    const { wide, fileTexts } = bundleFileTexts(countryCode, rows);
    let bundleBytes = 0;
    for (const text of Object.values(fileTexts)) bundleBytes += utf8Length(text);
    if (wide.rowCount > 0) bundleBytes -= wideCsvHeaderBytes(countryCode);
    bundleBytes += manifestIdBytes([
      ...rows.taskIds,
      ...rows.reviewDecisionIds,
      ...rows.acceptanceIds,
      ...sortedUnique(rows.evidenceVersions.map((row) => row.object_hash)),
      ...sortedUnique(rows.reviewSnapshots.map((row) => row.snapshot_hash)),
    ]);
    if (bundleBytes + MANIFEST_BASE_BYTES > EXPORT_BATCH_BYTE_BUDGET) {
      return {
        ok: false,
        reason: `Task ${taskId}: its bundle rows alone are ${bundleBytes} bytes, above the ${EXPORT_BATCH_BYTE_BUDGET}-byte batch budget; it cannot be exported in any batch until its rows are reduced.`,
        reads,
      };
    }
    return { ok: true, authority, bundleBytes, reads: addReadCounts(reads, PER_TASK_FREEZE_READS) };
  } catch (error) {
    if (error instanceof ReadBudgetExceeded) {
      return {
        ok: false,
        reason: `Task ${taskId}: its rows alone exceed the batch read budget on ${error.dimension.replace("_", " ")} (${error.counts[error.dimension]} against ${EXPORT_BATCH_READ_BUDGET[error.dimension]}); it cannot be exported in any batch until its rows are reduced.`,
        reads,
      };
    }
    return { ok: false, reason: errorMessage(error), reads };
  }
}

// a batch estimate: plain bundle bytes and the reads its freeze makes
type BatchEstimate = { bytes: number; reads: ReadCounts };

function emptyBatchEstimate(countryCode: string): BatchEstimate {
  return {
    bytes: MANIFEST_BASE_BYTES + wideCsvHeaderBytes(countryCode),
    reads: { ...BATCH_BASE_READS },
  };
}

// whether a task fits the open batch; the reason names the budget it breaks
function batchWouldExceed(
  estimate: BatchEstimate,
  taskCount: number,
  add: { bytes: number; reads: ReadCounts },
): string | null {
  if (taskCount + 1 > EXPORT_BATCH_MAX_TASKS) return `more than ${EXPORT_BATCH_MAX_TASKS} tasks`;
  if (estimate.bytes + add.bytes > EXPORT_BATCH_BYTE_BUDGET) {
    return `${estimate.bytes + add.bytes} bundle bytes, above the ${EXPORT_BATCH_BYTE_BUDGET}-byte budget`;
  }
  const dimension = exceededDimension(addReadCounts(estimate.reads, add.reads), EXPORT_BATCH_READ_BUDGET);
  if (dimension !== null) {
    return `${estimate.reads[dimension] + add.reads[dimension]} ${dimension.replace("_", " ")} read, above the ${EXPORT_BATCH_READ_BUDGET[dimension]} budget`;
  }
  return null;
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

    // budgeted selection (lean-storage brief section 3.1, ruling 2): every
    // task is measured (its freeze recheck and bundle reads) as it is taken,
    // and the batch is refused as soon as the running estimate breaks the
    // byte or read budget, so this transaction never reads much more than
    // one batch's worth. An explicit list over budget is refused, never
    // truncated; automatic selection over budget is refused in favour of
    // composeExportBatches, which cuts a country into budgeted batches.
    if (args.taskIds !== undefined && args.taskIds.length > EXPORT_BATCH_MAX_TASKS) {
      throw new Error(
        `A batch may name at most ${EXPORT_BATCH_MAX_TASKS} tasks; ${args.taskIds.length} were named. Compose the country with exports:composeExportBatches, or name fewer tasks.`,
      );
    }
    const taskIds: string[] = [];
    const reviewDecisionIds: string[] = [];
    const acceptanceIds: string[] = [];
    const estimate = emptyBatchEstimate(args.countryCode);
    const take = async (task: Doc<"tasks"> | null, taskId: string): Promise<void> => {
      // training tasks never enter an export bundle, even when named
      // explicitly; a named task a pi has not accepted refuses the batch
      if (task?.source_context?.training?.exclude_from_exports === true) {
        return;
      }
      const refusal = exportRefusalForTask(taskId, task?.status);
      if (refusal !== null) {
        throw new Error(refusal);
      }
      // the shared authority check (also run again, per task, at freeze
      // time by prepareFreeze) computes the accepted decisions and accepted
      // acceptances a task contributes to the batch's retained history
      const measured = await measureTaskForExport(ctx, taskId, args.countryCode);
      if (!measured.ok) {
        throw new Error(measured.reason);
      }
      const over = batchWouldExceed(estimate, taskIds.length, { bytes: measured.bundleBytes, reads: measured.reads });
      if (over !== null) {
        throw new Error(
          args.taskIds !== undefined
            ? `The named tasks exceed one export batch's budget (${over} by task ${taskId}); name fewer tasks per batch, or compose the country with exports:composeExportBatches.`
            : `${args.countryCode}'s pi_accepted tasks exceed one export batch's budget (${over} by task ${taskId}); compose the country into budgeted batches with exports:composeExportBatches.`,
        );
      }
      taskIds.push(taskId);
      reviewDecisionIds.push(...measured.authority.reviewDecisionIds);
      acceptanceIds.push(...measured.authority.acceptanceIds);
      estimate.bytes += measured.bundleBytes;
      estimate.reads = addReadCounts(estimate.reads, measured.reads);
    };

    if (args.taskIds !== undefined) {
      for (const taskId of args.taskIds) {
        await take(await taskByTaskId(ctx, taskId), taskId);
      }
    } else {
      // the pi acceptance layer (jb 2026-09-04): a batch takes only tasks a
      // principal investigator has accepted, never a reviewer's acceptance
      // alone; paged in creation order, stopping at the first over budget
      let cursor: number | undefined;
      for (;;) {
        const page: Doc<"tasks">[] = await ctx.db
          .query("tasks")
          .withIndex("by_country_status", (q) => {
            const range = q.eq("country_code", args.countryCode).eq("status", "pi_accepted");
            return cursor === undefined ? range : range.gt("_creationTime", cursor);
          })
          .take(COMPOSE_CANDIDATE_PAGE);
        for (const task of page) {
          await take(task, task.task_id);
        }
        if (page.length < COMPOSE_CANDIDATE_PAGE) break;
        cursor = page[page.length - 1]._creationTime;
      }
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
      estimated_bytes: estimate.bytes,
      estimated_documents: estimate.reads.documents,
      estimated_index_ranges: estimate.reads.index_ranges,
    });

    return {
      export_batch_id: exportBatchId,
      included_task_count: taskIds.length,
      included_review_decision_count: reviewDecisionIds.length,
    };
  },
});

// the acting curator for a freeze step. A caller with an identity (the
// freezeExportBatch and freezeCountryBatches actions) is checked as before;
// the scheduled freeze chain has no identity, so an internal call without
// one acts for the user id the run recorded, who must still be an active
// curator or admin (lean-storage brief section 3.1, service authority).
// Internal functions are reachable only from server code, never a client.
async function requireFreezeActor(ctx: any, userId: Id<"users"> | undefined): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity !== null) {
    return await requireUser(ctx, ["curator", "admin"]);
  }
  if (userId === undefined) {
    throw new Error("Authentication required.");
  }
  const user: Doc<"users"> | null = await ctx.db.get(userId);
  if (user === null || user.status !== "active" || !(user.roles.includes("curator") || user.roles.includes("admin"))) {
    throw new Error("The curator this freeze acts for is no longer an active curator or admin; a current curator must resume it.");
  }
  return user;
}

type StoredObjectEntry = NonNullable<NonNullable<Doc<"export_batches">["pending_freeze"]>["stored_objects"]>[number];

// deletes the blobs of trail entries that no committed file references,
// skipping any already gone (an attempt's own failure path may have deleted
// them first). Runs inside a mutation, so the deletions commit or roll back
// with the batch patch that retires the trail.
async function discardTrailBlobs(
  ctx: any,
  entries: readonly StoredObjectEntry[] | undefined,
  keep: ReadonlySet<string>,
): Promise<number> {
  let discarded = 0;
  for (const entry of entries ?? []) {
    if (keep.has(entry.storage_id)) continue;
    const meta = await ctx.db.system.get(entry.storage_id);
    if (meta === null) continue;
    await ctx.storage.delete(entry.storage_id);
    discarded += 1;
  }
  return discarded;
}

// a run batch's captured membership (export_run_members, written at
// composition) must still describe the task's current export authority:
// the same authoritative decision and the same pinned evidence version and
// snapshot. Anything else means the approval that covered the run no longer
// covers this task, and the batch is refused rather than frozen.
async function assertRunMembershipCurrent(
  ctx: any,
  batch: Doc<"export_batches">,
  authorities: Map<string, TaskExportAuthority>,
): Promise<void> {
  const members: Doc<"export_run_members">[] = await ctx.db
    .query("export_run_members")
    .withIndex("by_export_batch", (q: any) => q.eq("export_batch_id", batch.export_batch_id))
    .collect();
  const memberTaskIds = sortedUnique(members.map((member) => member.task_id));
  const batchTaskIds = sortedUnique(batch.included_task_ids);
  if (memberTaskIds.length !== batchTaskIds.length || memberTaskIds.some((taskId, index) => taskId !== batchTaskIds[index])) {
    throw new Error(
      `Export batch ${batch.export_batch_id}: its tasks no longer match the membership run ${batch.export_run_id} captured; compose a new run.`,
    );
  }
  for (const member of members) {
    const current = authorities.get(member.task_id);
    if (
      current === undefined
      || current.authorityReviewDecisionId !== member.authority_review_decision_id
      || current.evidenceVersionHash !== member.evidence_version_hash
      || current.reviewSnapshotHash !== member.review_snapshot_hash
    ) {
      throw new Error(
        `Export batch ${batch.export_batch_id}: task ${member.task_id}'s export authority changed since run ${batch.export_run_id} captured it (captured decision ${member.authority_review_decision_id ?? "none"}, now ${current?.authorityReviewDecisionId ?? "none"}); compose a new run.`,
      );
    }
  }
}

// step 1 of freezing (docs/development/frozen-exports.md section 3):
// rechecks every included task's eligibility and export authority, checks
// the batch's stored membership still matches what that recheck returns
// (and, for a batch an export run composed, the authority pins the run
// captured), builds the complete bundle at this attempt's `frozen_at`, and
// records the attempt with its full manifest on the batch. Its only write is
// the final patch, so any refusal above it leaves the batch completely
// untouched. The byte budget is applied when the batch is composed or
// created (pr l1), not here.
export const prepareFreeze = internalMutation({
  args: { exportBatchId: v.string(), userId: v.id("users"), attemptId: v.string() },
  returns: v.object({
    manifest_hash: v.string(),
    frozen_at: v.number(),
    files: v.array(v.object({ filename: v.string(), content_type: v.string(), text: v.string() })),
  }),
  handler: async (ctx, args) => {
    await requireFreezeActor(ctx, args.userId);
    const batch = await batchByExportBatchId(ctx, args.exportBatchId);
    if (batch === null) {
      throw new Error(`Export batch not found: ${args.exportBatchId}`);
    }
    if (batch.status !== "draft") {
      throw new Error("Only draft export batches can be frozen.");
    }

    const currentDecisionIds: string[] = [];
    const currentAcceptanceIds: string[] = [];
    const authorities = new Map<string, TaskExportAuthority>();
    for (const taskId of batch.included_task_ids) {
      const authority = await assertTaskExportAuthority(ctx, taskId);
      authorities.set(taskId, authority);
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
    if (batch.export_run_id !== undefined) {
      await assertRunMembershipCurrent(ctx, batch, authorities);
    }

    const frozenAt = Date.now();
    const built = await buildBundle(ctx, batch, frozenAt, true);
    // an earlier attempt's stored-object trail is carried forward, so the
    // blobs of an attempt that died mid-freeze stay listed until this one
    // commits or fails and discards them
    const inheritedTrail = batch.pending_freeze?.stored_objects;
    await ctx.db.patch(batch._id, {
      pending_freeze: {
        attempt_id: args.attemptId,
        started_at: frozenAt,
        started_by: args.userId,
        manifest: built.manifest,
        stored_objects: inheritedTrail,
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

const codecRecordValidator = v.object({
  name: v.literal("fflate"),
  version: v.string(),
  level: v.number(),
  header: v.object({ mtime: v.number(), filename: v.boolean() }),
});

// step 2's trail (lean-storage brief section 3.1, item 4): the action records
// every object it stores, as soon as it is stored and before it is read
// back, so an attempt that dies leaves the object listed on the batch.
// Returns false, recording nothing, when this attempt is no longer the
// batch's current one (the action then stops and discards its own blobs).
export const recordStoredObject = internalMutation({
  args: {
    exportBatchId: v.string(),
    attemptId: v.string(),
    userId: v.optional(v.id("users")),
    filename: v.string(),
    storageId: v.id("_storage"),
    sha256: v.string(),
    byteLength: v.number(),
    storedSha256: v.string(),
    storedByteLength: v.number(),
    codec: codecRecordValidator,
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    await requireFreezeActor(ctx, args.userId);
    const batch = await batchByExportBatchId(ctx, args.exportBatchId);
    if (batch === null || batch.status !== "draft" || batch.pending_freeze?.attempt_id !== args.attemptId) {
      return false;
    }
    const entry: StoredObjectEntry = {
      attempt_id: args.attemptId,
      filename: args.filename,
      object_key: storedObjectKey(args.sha256, args.codec),
      storage_id: args.storageId,
      sha256: args.sha256,
      byte_length: args.byteLength,
      stored_sha256: args.storedSha256,
      stored_byte_length: args.storedByteLength,
      codec_id: codecId(args.codec),
      recorded_at: Date.now(),
    };
    await ctx.db.patch(batch._id, {
      pending_freeze: {
        ...batch.pending_freeze,
        stored_objects: [...(batch.pending_freeze.stored_objects ?? []), entry],
      },
    });
    return true;
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
  args: { exportBatchId: v.string(), attemptId: v.string(), userId: v.optional(v.id("users")) },
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
    await requireFreezeActor(ctx, args.userId);
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
        // the stored encoding (pr l1): absent means plain bytes were stored
        encoding: v.optional(v.literal("gzip")),
        storedSha256: v.optional(v.string()),
        storedByteLength: v.optional(v.number()),
        codec: v.optional(codecRecordValidator),
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
    const user = await requireFreezeActor(ctx, args.userId);
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
    for (const file of args.storedFiles) {
      if (
        file.encoding !== undefined
        && (file.storedSha256 === undefined || file.storedByteLength === undefined || file.codec === undefined)
      ) {
        throw new Error(
          `Export batch ${args.exportBatchId}: stored file ${file.filename} is encoded but lacks its stored hash, stored length, or codec record.`,
        );
      }
    }

    const pendingManifest = batch.pending_freeze.manifest as Record<string, unknown>;
    const frozenAt = batch.pending_freeze.started_at;
    const trail = batch.pending_freeze.stored_objects;

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
        encoding: file.encoding,
        stored_sha256: file.storedSha256,
        stored_byte_length: file.storedByteLength,
        codec: file.codec,
      })),
      pending_freeze: undefined,
    });
    // the committed files are the batch's bytes now; every other object on
    // the trail belongs to an attempt that died or was replaced
    await discardTrailBlobs(ctx, trail, new Set(args.storedFiles.map((file) => file.storageId as string)));

    for (const taskId of batch.included_task_ids) {
      const task = await taskByTaskId(ctx, taskId);
      if (task === null) {
        continue;
      }
      // the exported transition stays at freeze completion (ruling 12)
      await ctx.db.patch(task._id, {
        status: "exported",
        updated_at: now,
        last_event_at: now,
        last_export_batch_id: args.exportBatchId,
        last_exported_at: now,
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
// records the failure. The attempt's own blobs were deleted by the action;
// any carried-forward trail of earlier attempts is discarded here.
export const recordFreezeFailure = internalMutation({
  args: { exportBatchId: v.string(), attemptId: v.string(), reason: v.string(), userId: v.optional(v.id("users")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireFreezeActor(ctx, args.userId);
    const batch = await batchByExportBatchId(ctx, args.exportBatchId);
    if (batch === null || batch.status !== "draft") {
      return null;
    }
    if (batch.pending_freeze !== undefined && batch.pending_freeze.attempt_id !== args.attemptId) {
      return null;
    }
    await discardTrailBlobs(ctx, batch.pending_freeze?.stored_objects, new Set());
    await ctx.db.patch(batch._id, {
      pending_freeze: undefined,
      last_freeze_failure: { attempt_id: args.attemptId, at: Date.now(), reason: args.reason },
    });
    return null;
  },
});

// freezes one batch: prepareFreeze, then every file gzip-compressed under the
// pinned codec, stored, recorded on the trail, read back, and verified on
// all four values (stored sha256 and length, then plain sha256 and length
// after decoding), then completeFreeze. Any definite failure deletes the
// blobs this attempt stored and records why, leaving the batch exactly as
// it was; a completion whose outcome is ambiguous keeps every blob. Shared
// by the freezeExportBatch action and the scheduled run chain.
type FreezeResult = { export_batch_id: string; status: "frozen"; manifest_hash: string; frozen_at: number; file_count: number };

type StoredFile = {
  filename: string;
  storageId: Id<"_storage">;
  sha256: string;
  byteLength: number;
  contentType: string;
  encoding: "gzip";
  storedSha256: string;
  storedByteLength: number;
  codec: CodecRecord;
};

async function deleteBlobsQuietly(ctx: any, storageIds: readonly Id<"_storage">[]): Promise<void> {
  for (const storageId of storageIds) {
    try {
      await ctx.storage.delete(storageId);
    } catch {
      // already gone: a completing or failing attempt may have discarded it
    }
  }
}

async function freezeBatchCore(
  ctx: any,
  exportBatchId: string,
  userId: Id<"users">,
  renewLease?: () => Promise<void>,
): Promise<FreezeResult> {
  const attemptId = crypto.randomUUID();

  let prepared: { manifest_hash: string; frozen_at: number; files: { filename: string; content_type: string; text: string }[] };
  try {
    prepared = await ctx.runMutation(internal.exports.prepareFreeze, { exportBatchId, userId, attemptId });
  } catch (error) {
    await ctx.runMutation(internal.exports.recordFreezeFailure, { exportBatchId, attemptId, userId, reason: errorMessage(error) });
    throw error;
  }

  const storedFiles: StoredFile[] = [];
  // every blob this attempt stores, whether or not it goes on to verify;
  // a file that fails its own read-back check was still stored and must
  // still be deleted on the way out
  const allStorageIds: Id<"_storage">[] = [];
  try {
    if (renewLease !== undefined) await renewLease();
    for (const file of prepared.files) {
      const plain = utf8Bytes(file.text);
      const expected = {
        sha256: sha256(file.text),
        byte_length: plain.length,
        stored_sha256: "",
        stored_byte_length: 0,
      };
      const gzipped = gzipBundleFile(plain);
      expected.stored_sha256 = await sha256Hex(gzipped);
      expected.stored_byte_length = gzipped.length;
      const storageId: Id<"_storage"> = await ctx.storage.store(new Blob([gzipped as Uint8Array<ArrayBuffer>], { type: "application/gzip" }));
      allStorageIds.push(storageId);
      const current: boolean = await ctx.runMutation(internal.exports.recordStoredObject, {
        exportBatchId,
        attemptId,
        userId,
        filename: file.filename,
        storageId,
        sha256: expected.sha256,
        byteLength: expected.byte_length,
        storedSha256: expected.stored_sha256,
        storedByteLength: expected.stored_byte_length,
        codec: BUNDLE_CODEC,
      });
      if (!current) {
        throw new Error(
          `Export batch ${exportBatchId}: this freeze attempt is no longer current (a later attempt, or a status change, superseded it).`,
        );
      }
      const blob = await ctx.storage.get(storageId);
      if (blob === null) {
        throw new Error(`Stored file ${file.filename} could not be read back from storage.`);
      }
      const bytes = new Uint8Array(await blob.arrayBuffer());
      try {
        await verifyStoredFile(`Stored file ${file.filename}`, bytes, expected);
      } catch (error) {
        throw new Error(`Stored file ${file.filename} did not verify on read-back: ${errorMessage(error)}`);
      }
      storedFiles.push({
        filename: file.filename,
        storageId,
        sha256: expected.sha256,
        byteLength: expected.byte_length,
        contentType: file.content_type,
        encoding: "gzip",
        storedSha256: expected.stored_sha256,
        storedByteLength: expected.stored_byte_length,
        codec: BUNDLE_CODEC,
      });
    }
    if (renewLease !== undefined) await renewLease();
  } catch (error) {
    await deleteBlobsQuietly(ctx, allStorageIds);
    await ctx.runMutation(internal.exports.recordFreezeFailure, { exportBatchId, attemptId, userId, reason: errorMessage(error) });
    throw error;
  }

  try {
    const completed: FreezeResult = await ctx.runMutation(internal.exports.completeFreeze, {
      exportBatchId,
      attemptId,
      userId,
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
      outcome = await ctx.runQuery(internal.exports.freezeAttemptOutcome, { exportBatchId, attemptId, userId });
    } catch (probeError) {
      throw new Error(
        `Export batch ${exportBatchId}: freeze completion failed (${errorMessage(error)}) and its outcome could not be established (${errorMessage(probeError)}); the ${storedFiles.length} stored blobs were kept (${storedFiles.map((stored) => stored.storageId).join(", ")}). Reconcile the batch before retrying.`,
      );
    }
    if (outcome !== null) {
      return outcome;
    }
    await deleteBlobsQuietly(ctx, storedFiles.map((stored) => stored.storageId));
    await ctx.runMutation(internal.exports.recordFreezeFailure, { exportBatchId, attemptId, userId, reason: errorMessage(error) });
    throw error;
  }
}

// freezeExportBatch: freezes one named draft batch now, as the calling
// curator (docs/development/frozen-exports.md section 3). A country's
// composed run is frozen through freezeCountryBatches instead.
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
    return await freezeBatchCore(ctx, args.exportBatchId, user._id);
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
        if (entry.encoding === "gzip") {
          // pr l1: stored gzip bytes verify on all four values, stored
          // sha256 and length first, then plain sha256 and length after
          // decoding; the plain bytes are what the bundle contract hashes
          if (entry.stored_sha256 === undefined || entry.stored_byte_length === undefined || entry.codec === undefined) {
            throw new Error(
              `Export batch ${args.exportBatchId}: stored file ${entry.filename} is gzip-encoded but lacks its stored hash, stored length, or codec record.`,
            );
          }
          const plain = await verifyStoredFile(`Export batch ${args.exportBatchId}: stored file ${entry.filename}`, bytes, {
            sha256: entry.sha256,
            byte_length: entry.byte_length,
            stored_sha256: entry.stored_sha256,
            stored_byte_length: entry.stored_byte_length,
          });
          filesByFilename[entry.filename] = new TextDecoder().decode(plain);
          continue;
        }
        // a batch frozen before pr l1 stored plain bytes, verified as then
        const actualSha256 = await sha256Hex(bytes);
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

    // a draft, or a draft a later composition archived (pr l1): a live
    // preview that was never frozen, not a legacy freeze
    if (batch.status === "draft" || batch.status === "archived") {
      return {
        export_manifest: built.manifest,
        files: built.files as unknown as Infer<typeof exportBundleFiles>,
        disposition: { status: batch.status, stored_bytes: false, verified: false, processing_allowed: false },
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

// ---------------------------------------------------------------------------
// export runs (lean-storage brief section 3.1, rulings 1 and 2, jb
// 2026-09-24; pr l1). composeExportBatches cuts a country's pi_accepted
// tasks into budgeted draft batches and captures the run's membership;
// freezeCountryBatches then freezes the run's batches one per invocation,
// each invocation scheduling the next, under the run's lease.
// ---------------------------------------------------------------------------

async function runByRunId(ctx: any, runId: string): Promise<Doc<"export_runs"> | null> {
  return await ctx.db
    .query("export_runs")
    .withIndex("by_run_id", (q: any) => q.eq("run_id", runId))
    .unique();
}

async function latestRunForCountry(ctx: any, countryCode: string): Promise<Doc<"export_runs"> | null> {
  return await ctx.db
    .query("export_runs")
    .withIndex("by_country_started", (q: any) => q.eq("country_code", countryCode))
    .order("desc")
    .first();
}

function leaseLive(run: Doc<"export_runs">, now: number): boolean {
  return run.lease !== undefined && run.lease.expires_at > now;
}

// the run's recorded curator must still hold the role; a scheduled step has
// no identity of its own (service authority, brief section 3.1)
async function runActorStillAuthorised(ctx: any, userId: Id<"users"> | undefined): Promise<boolean> {
  if (userId === undefined) return false;
  const user: Doc<"users"> | null = await ctx.db.get(userId);
  return user !== null && user.status === "active" && (user.roles.includes("curator") || user.roles.includes("admin"));
}

// composeExportBatches: starts an export run for a country. A run still
// composing or freezing under a live lease refuses a second one (the
// per-country run lock); an earlier run that is composed, stopped, or whose
// lease has lapsed is replaced, and its unfrozen draft batches are archived
// (their frozen batches keep their bytes). The composition itself runs in
// scheduled steps, each bounded by its own read budget.
export const composeExportBatches = mutation({
  args: { countryCode: v.string() },
  returns: v.object({ run_id: v.string(), replaced_run_id: v.optional(v.string()), archived_batch_count: v.number() }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["curator", "admin"]);
    const now = Date.now();
    const runId = `${args.countryCode.toLowerCase()}-export-run-${now}`;

    const previous = await latestRunForCountry(ctx, args.countryCode);
    let replacedRunId: string | undefined;
    let archived = 0;
    if (previous !== null && (previous.status === "composing" || previous.status === "freezing") && leaseLive(previous, now)) {
      throw new Error(
        `Export run ${previous.run_id} for ${args.countryCode} is still ${previous.status} (its lease runs to ${new Date(previous.lease!.expires_at).toISOString()}); wait for it, or for its lease to lapse, before composing again.`,
      );
    }
    if (previous !== null && previous.status !== "completed" && previous.status !== "replaced") {
      const drafts: Doc<"export_batches">[] = await ctx.db
        .query("export_batches")
        .withIndex("by_export_run_status", (q) => q.eq("export_run_id", previous.run_id).eq("status", "draft"))
        .collect();
      for (const draft of drafts) {
        // a dead freeze attempt's stored objects go with the draft
        await discardTrailBlobs(ctx, draft.pending_freeze?.stored_objects, new Set());
        await ctx.db.patch(draft._id, {
          status: "archived",
          archived_at: now,
          archived_by: user._id,
          archived_reason: `Replaced by export run ${runId}.`,
          pending_freeze: undefined,
        });
        archived += 1;
      }
      await ctx.db.patch(previous._id, {
        status: "replaced",
        replaced_by_run_id: runId,
        replaced_at: now,
        lease: undefined,
      });
      replacedRunId = previous.run_id;
    }

    await ctx.db.insert("export_runs", {
      run_id: runId,
      country_code: args.countryCode,
      status: "composing",
      started_by: user._id,
      started_at: now,
      phase: "estimating",
      next_member_seq: 0,
      member_count: 0,
      refused_count: 0,
      refusals: [],
      batch_count: 0,
      frozen_batch_count: 0,
      estimated_bytes: 0,
      lease: { holder: "compose", expires_at: now + EXPORT_RUN_LEASE_MS },
    });
    await ctx.scheduler.runAfter(0, internal.exports.composeRunStep, { runId });
    return { run_id: runId, replaced_run_id: replacedRunId, archived_batch_count: archived };
  },
});

// creates one composed draft batch from consecutive run members
async function insertComposedBatch(
  ctx: any,
  run: Doc<"export_runs">,
  members: Doc<"export_run_members">[],
  estimate: BatchEstimate,
  now: number,
): Promise<string> {
  const index = run.batch_count;
  const exportBatchId = `${run.run_id.replace("-export-run-", "-convex-export-")}-${String(index + 1).padStart(4, "0")}`;
  await ctx.db.insert("export_batches", {
    export_batch_id: exportBatchId,
    country_code: run.country_code,
    status: "draft",
    created_by: run.started_by,
    created_at: now,
    included_task_ids: members.map((member) => member.task_id),
    included_review_decision_ids: members.flatMap((member) => member.review_decision_ids),
    included_acceptance_ids: members.flatMap((member) => member.acceptance_ids),
    schema_version: "convex-task-layer.v0.1",
    export_format: "bundle",
    pow_validation_status: "not_run",
    notes: `Composed by export run ${run.run_id}, batch ${index + 1}.`,
    export_run_id: run.run_id,
    estimated_bytes: estimate.bytes,
    estimated_documents: estimate.reads.documents,
    estimated_index_ranges: estimate.reads.index_ranges,
  });
  for (const member of members) {
    await ctx.db.patch(member._id, { export_batch_id: exportBatchId });
  }
  run.batch_count += 1;
  return exportBatchId;
}

// one composition step. Estimating: reads the country's pi_accepted tasks in
// creation order from the run's cursor, measures each (its freeze recheck
// and bundle reads, convex/lib/readMeter.ts), and records it as a run
// member (captured membership, ruling 2) or a named refusal, until the
// step's own read budget is spent. Cutting: walks the members in order and
// closes a batch whenever the next member would break the byte or read
// budget, ending each step on a batch boundary. Every step renews the
// run's lease and schedules the next; the last marks the run composed.
export const composeRunStep = internalMutation({
  args: { runId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await runByRunId(ctx, args.runId);
    if (run === null || run.status !== "composing") {
      return null;
    }
    const now = Date.now();
    if (!(await runActorStillAuthorised(ctx, run.started_by))) {
      await ctx.db.patch(run._id, {
        status: "stopped",
        lease: undefined,
        last_error: { at: now, reason: "The curator who started this run is no longer an active curator or admin; compose again." },
      });
      return null;
    }

    if (run.phase === "estimating") {
      let stepReads = emptyReadCounts();
      let cursor = run.estimate_cursor;
      let cursorIds = new Set(run.estimate_cursor_ids ?? []);
      let seq = run.next_member_seq;
      let memberCount = run.member_count;
      let refusedCount = run.refused_count;
      let estimatedBytes = run.estimated_bytes;
      const refusals = [...run.refusals];
      let exhausted = false;
      let budgetSpent = false;
      for (;;) {
        const limit = COMPOSE_CANDIDATE_PAGE + cursorIds.size;
        const pageCursor = cursor;
        const page: Doc<"tasks">[] = await ctx.db
          .query("tasks")
          .withIndex("by_country_status", (q) => {
            const range = q.eq("country_code", run.country_code).eq("status", "pi_accepted");
            return pageCursor === undefined ? range : range.gte("_creationTime", pageCursor);
          })
          .take(limit);
        const takenAtCursor = new Set(cursorIds);
        const fresh = page.filter((task) => !(task._creationTime === pageCursor && takenAtCursor.has(task.task_id)));
        for (const task of fresh) {
          if (task._creationTime !== cursor) {
            cursor = task._creationTime;
            cursorIds = new Set();
          }
          cursorIds.add(task.task_id);
          // training tasks never enter an export bundle (as createExportBatch)
          if (task.source_context?.training?.exclude_from_exports === true) {
            continue;
          }
          const measured = await measureTaskForExport(ctx, task.task_id, run.country_code);
          if (measured.ok) {
            await ctx.db.insert("export_run_members", {
              run_id: run.run_id,
              seq,
              task_id: task.task_id,
              review_decision_ids: measured.authority.reviewDecisionIds,
              acceptance_ids: measured.authority.acceptanceIds,
              authority_review_decision_id: measured.authority.authorityReviewDecisionId,
              evidence_version_hash: measured.authority.evidenceVersionHash,
              review_snapshot_hash: measured.authority.reviewSnapshotHash,
              estimated_bytes: measured.bundleBytes,
              estimated_read_bytes: measured.reads.bytes,
              estimated_documents: measured.reads.documents,
              estimated_index_ranges: measured.reads.index_ranges,
            });
            memberCount += 1;
            estimatedBytes += measured.bundleBytes;
          } else {
            await ctx.db.insert("export_run_members", {
              run_id: run.run_id,
              seq,
              task_id: task.task_id,
              review_decision_ids: [],
              acceptance_ids: [],
              estimated_bytes: 0,
              estimated_read_bytes: measured.reads.bytes,
              estimated_documents: measured.reads.documents,
              estimated_index_ranges: measured.reads.index_ranges,
              refusal: measured.reason,
            });
            refusedCount += 1;
            if (refusals.length < EXPORT_RUN_REFUSALS_KEPT) {
              refusals.push({ task_id: task.task_id, reason: measured.reason });
            }
          }
          seq += 1;
          stepReads = addReadCounts(stepReads, addReadCounts(measured.reads, { bytes: 0, documents: 1, index_ranges: 0 }));
          if (exceededDimension(stepReads, COMPOSE_STEP_READ_BUDGET) !== null) {
            budgetSpent = true;
            break;
          }
        }
        // a short page is the end of the country's accepted tasks; a full
        // page always holds at least one row not yet taken, so the loop
        // advances
        if (budgetSpent) break;
        if (page.length < limit) {
          exhausted = true;
          break;
        }
      }
      await ctx.db.patch(run._id, {
        estimate_cursor: cursor,
        estimate_cursor_ids: [...cursorIds],
        next_member_seq: seq,
        member_count: memberCount,
        refused_count: refusedCount,
        refusals,
        estimated_bytes: estimatedBytes,
        phase: exhausted ? "cutting" : "estimating",
        lease: { holder: "compose", expires_at: now + EXPORT_RUN_LEASE_MS },
      });
      await ctx.scheduler.runAfter(0, internal.exports.composeRunStep, { runId: args.runId });
      return null;
    }

    if (run.phase === "cutting") {
      const afterSeq = run.cut_cursor_seq ?? -1;
      const page: Doc<"export_run_members">[] = await ctx.db
        .query("export_run_members")
        .withIndex("by_run_seq", (q) => q.eq("run_id", run.run_id).gt("seq", afterSeq))
        .take(CUT_STEP_MEMBERS + EXPORT_BATCH_MAX_TASKS + 1);
      const exhausted = page.length <= CUT_STEP_MEMBERS + EXPORT_BATCH_MAX_TASKS;
      const mutableRun = { ...run };
      let open: Doc<"export_run_members">[] = [];
      let estimate = emptyBatchEstimate(run.country_code);
      let lastClosedSeq = afterSeq;
      let walked = 0;
      let stopped = false;
      for (const member of page) {
        if (member.refusal !== undefined) {
          if (open.length === 0) lastClosedSeq = member.seq;
          walked += 1;
          continue;
        }
        const add = {
          bytes: member.estimated_bytes,
          reads: {
            bytes: member.estimated_read_bytes,
            documents: member.estimated_documents,
            index_ranges: member.estimated_index_ranges,
          },
        };
        if (open.length > 0 && batchWouldExceed(estimate, open.length, add) !== null) {
          await insertComposedBatch(ctx, mutableRun, open, estimate, now);
          lastClosedSeq = open[open.length - 1].seq;
          open = [];
          estimate = emptyBatchEstimate(run.country_code);
          if (walked >= CUT_STEP_MEMBERS) {
            stopped = true;
            break;
          }
        }
        open.push(member);
        estimate.bytes += add.bytes;
        estimate.reads = addReadCounts(estimate.reads, add.reads);
        walked += 1;
      }
      // at the end of the page (and not stopped on a boundary), the open
      // batch closes: at the end of the members it is the last batch, and
      // mid-way (a page of mostly refused members) closing it guarantees the
      // next step starts past everything walked here
      if (!stopped) {
        if (open.length > 0) {
          await insertComposedBatch(ctx, mutableRun, open, estimate, now);
        }
        if (page.length > 0) lastClosedSeq = page[page.length - 1].seq;
      }
      const done = exhausted && !stopped;
      await ctx.db.patch(run._id, {
        cut_cursor_seq: lastClosedSeq,
        batch_count: mutableRun.batch_count,
        phase: done ? "done" : "cutting",
        status: done ? "composed" : "composing",
        composed_at: done ? now : undefined,
        lease: done ? undefined : { holder: "compose", expires_at: now + EXPORT_RUN_LEASE_MS },
      });
      if (!done) {
        await ctx.scheduler.runAfter(0, internal.exports.composeRunStep, { runId: args.runId });
      }
      return null;
    }
    return null;
  },
});

// the country's latest run (or the named one), for the curator following a
// composition or a freeze chain
export const getExportRun = query({
  args: { countryCode: v.optional(v.string()), runId: v.optional(v.string()) },
  returns: v.union(v.null(), exportRunDoc),
  handler: async (ctx, args) => {
    await requireUser(ctx, ["curator", "admin"]);
    if (args.runId !== undefined) return await runByRunId(ctx, args.runId);
    if (args.countryCode !== undefined) return await latestRunForCountry(ctx, args.countryCode);
    throw new Error("Name a runId or a countryCode.");
  },
});

// starts or resumes the freeze chain of a country's latest run, as the
// calling curator (whose authority the scheduled steps then carry). A run
// still composing, a chain running under a live lease, or a run with
// nothing left to freeze is refused.
export const startRunFreeze = internalMutation({
  args: { countryCode: v.string(), userId: v.id("users") },
  returns: v.object({ run_id: v.string() }),
  handler: async (ctx, args) => {
    const user = await requireFreezeActor(ctx, args.userId);
    const now = Date.now();
    const run = await latestRunForCountry(ctx, args.countryCode);
    if (run === null) {
      throw new Error(`No export run for ${args.countryCode}; compose one with exports:composeExportBatches.`);
    }
    if (run.phase !== "done") {
      throw new Error(
        run.status === "composing"
          ? `Export run ${run.run_id} is still composing; freeze it once getExportRun reports it composed.`
          : `Export run ${run.run_id} stopped before its composition finished (${run.last_error?.reason ?? "no reason recorded"}); compose again.`,
      );
    }
    if (run.status === "completed" || run.status === "replaced") {
      throw new Error(`Export run ${run.run_id} is ${run.status}; compose a new run to export tasks accepted since.`);
    }
    if (run.status === "freezing" && leaseLive(run, now)) {
      throw new Error(`Export run ${run.run_id} is already freezing (lease held to ${new Date(run.lease!.expires_at).toISOString()}).`);
    }
    await ctx.db.patch(run._id, {
      status: "freezing",
      freeze_actor: user._id,
      freeze_started_at: run.freeze_started_at ?? now,
      last_error: undefined,
      lease: undefined,
    });
    return { run_id: run.run_id };
  },
});

// takes the run's lease for its next draft batch (composition order), or
// reports that the run is done (marking it completed), busy (another
// invocation holds a live lease), or inactive (not freezing, or its curator
// lost the role, which stops it)
export const claimRunBatch = internalMutation({
  args: { runId: v.string(), holder: v.string() },
  returns: v.union(
    v.object({ kind: v.literal("batch"), export_batch_id: v.string(), user_id: v.id("users") }),
    v.object({ kind: v.literal("done") }),
    v.object({ kind: v.literal("busy") }),
    v.object({ kind: v.literal("inactive") }),
  ),
  handler: async (ctx, args) => {
    const run = await runByRunId(ctx, args.runId);
    const now = Date.now();
    if (run === null || run.status !== "freezing" || run.freeze_actor === undefined) {
      return { kind: "inactive" as const };
    }
    if (leaseLive(run, now) && run.lease!.holder !== args.holder) {
      return { kind: "busy" as const };
    }
    if (!(await runActorStillAuthorised(ctx, run.freeze_actor))) {
      await ctx.db.patch(run._id, {
        status: "stopped",
        lease: undefined,
        last_error: { at: now, reason: "The curator freezing this run is no longer an active curator or admin; a current curator must resume it." },
      });
      return { kind: "inactive" as const };
    }
    const next = await ctx.db
      .query("export_batches")
      .withIndex("by_export_run_status", (q) => q.eq("export_run_id", run.run_id).eq("status", "draft"))
      .first();
    if (next === null) {
      await ctx.db.patch(run._id, { status: "completed", completed_at: now, lease: undefined });
      return { kind: "done" as const };
    }
    await ctx.db.patch(run._id, {
      lease: { holder: args.holder, expires_at: now + EXPORT_RUN_LEASE_MS, export_batch_id: next.export_batch_id },
    });
    return { kind: "batch" as const, export_batch_id: next.export_batch_id, user_id: run.freeze_actor };
  },
});

// renews a held lease between the phases of one batch freeze; refuses when
// the lease was lost, so the freeze stops rather than run unguarded
export const renewRunLease = internalMutation({
  args: { runId: v.string(), holder: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await runByRunId(ctx, args.runId);
    if (run === null || run.status !== "freezing" || run.lease?.holder !== args.holder) {
      throw new Error(`Export run ${args.runId}: this invocation no longer holds the run's lease; the freeze stops.`);
    }
    await ctx.db.patch(run._id, { lease: { ...run.lease, expires_at: Date.now() + EXPORT_RUN_LEASE_MS } });
    return null;
  },
});

// settles one batch freeze of the chain: a frozen batch releases the lease
// and schedules the next invocation in the same transaction; a failed one
// stops the run with the reason (the batch stays draft with its
// last_freeze_failure, never skipped), for a curator re-run to resume
export const settleRunBatch = internalMutation({
  args: {
    runId: v.string(),
    holder: v.string(),
    exportBatchId: v.string(),
    outcome: v.union(v.literal("frozen"), v.literal("failed")),
    reason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await runByRunId(ctx, args.runId);
    if (run === null || run.lease?.holder !== args.holder) {
      return null;
    }
    const now = Date.now();
    if (args.outcome === "frozen") {
      await ctx.db.patch(run._id, { lease: undefined, frozen_batch_count: run.frozen_batch_count + 1 });
      if (run.status === "freezing") {
        await ctx.scheduler.runAfter(0, internal.exports.freezeRunStep, { runId: args.runId });
      }
      return null;
    }
    await ctx.db.patch(run._id, {
      status: "stopped",
      lease: undefined,
      last_error: { at: now, reason: args.reason ?? "The batch freeze failed.", export_batch_id: args.exportBatchId },
    });
    return null;
  },
});

type RunStepResult = { run_id: string; status: "frozen" | "done" | "busy" | "inactive"; export_batch_id?: string };

// one invocation of the chain: claim the next batch, freeze it under the
// lease, settle (which schedules the next invocation)
async function freezeRunStepCore(ctx: any, runId: string): Promise<RunStepResult> {
  const holder = crypto.randomUUID();
  const claim = await ctx.runMutation(internal.exports.claimRunBatch, { runId, holder });
  if (claim.kind !== "batch") {
    return { run_id: runId, status: claim.kind };
  }
  const renew = async () => {
    await ctx.runMutation(internal.exports.renewRunLease, { runId, holder });
  };
  try {
    await freezeBatchCore(ctx, claim.export_batch_id, claim.user_id, renew);
  } catch (error) {
    await ctx.runMutation(internal.exports.settleRunBatch, {
      runId,
      holder,
      exportBatchId: claim.export_batch_id,
      outcome: "failed",
      reason: errorMessage(error),
    });
    throw error;
  }
  await ctx.runMutation(internal.exports.settleRunBatch, { runId, holder, exportBatchId: claim.export_batch_id, outcome: "frozen" });
  return { run_id: runId, status: "frozen", export_batch_id: claim.export_batch_id };
}

const runStepResult = v.object({
  run_id: v.string(),
  status: v.union(v.literal("frozen"), v.literal("done"), v.literal("busy"), v.literal("inactive")),
  export_batch_id: v.optional(v.string()),
});

// freezeCountryBatches: starts or resumes the freeze chain of the country's
// latest composed run. This call freezes the first batch itself (so a
// refusal reaches the caller) and the chain continues by itself, one batch
// per scheduled invocation, until every batch of the run is frozen or one
// fails; getExportRun follows it.
export const freezeCountryBatches = action({
  args: { countryCode: v.string() },
  returns: runStepResult,
  handler: async (ctx, args): Promise<RunStepResult> => {
    const user: Doc<"users"> = await ctx.runQuery(internal.exports.requireActingUser, {});
    const started: { run_id: string } = await ctx.runMutation(internal.exports.startRunFreeze, {
      countryCode: args.countryCode,
      userId: user._id,
    });
    return await freezeRunStepCore(ctx, started.run_id);
  },
});

// the scheduled continuation of the chain; acts for the run's recorded
// curator (claimRunBatch rechecks that curator's role every invocation)
export const freezeRunStep = internalAction({
  args: { runId: v.string() },
  returns: runStepResult,
  handler: async (ctx, args): Promise<RunStepResult> => {
    return await freezeRunStepCore(ctx, args.runId);
  },
});
