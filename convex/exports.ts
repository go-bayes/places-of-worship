import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { exportFormat, exportBatchStatus } from "./model";
import { chooseActorRole, requireUser } from "./lib/auth";
import { appendTaskEvent } from "./lib/taskEvents";
import { exportRefusalForTask } from "./lib/acceptance";
import { isWideEvidenceExportEligible } from "./lib/exportEligibility";
import { targetYearsOrEmpty } from "./lib/countryYears";
import { readGeneratedWideRow, wideEvidenceFields, wideEvidenceRowValues } from "./lib/wideEvidenceFields";
import {
  derivedStateEventDoc,
  derivedTargetYearFunctionDoc,
  derivedTargetYearStateDoc,
  derivedYearLocationDoc,
  evidenceDraftDoc,
  exportBatchDoc,
  historicalClaimDoc,
  reviewDecisionDoc,
  siteOccupancyDoc,
  taskDoc,
  taskEventDoc,
} from "./lib/validators";

async function taskByTaskId(ctx: any, taskId: string): Promise<Doc<"tasks"> | null> {
  return await ctx.db
    .query("tasks")
    .withIndex("by_task_id", (q: any) => q.eq("task_id", taskId))
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

function siteEvidenceWideCsv(
  countryCode: string,
  evidenceDrafts: Doc<"evidence_drafts">[],
  reviewDecisions: Doc<"review_decisions">[],
  derivedLocations: Doc<"derived_year_locations">[] = [],
): { csv: string; rowCount: number; fieldCount: number; fieldMismatchCount: number } {
  const acceptedDraftIds = acceptedEvidenceDraftIds(reviewDecisions);
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
    rows.push(overlayTargetYears(
      generated.row,
      draft,
      targetYears,
      derivedLocations.filter((l) => l.parent_evidence_draft_id === draft.evidence_draft_id),
    ));
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

type OccupancyBundle = {
  occupancies: Doc<"site_occupancies">[];
  derivedStates: Doc<"derived_target_year_states">[];
  derivedLocations: Doc<"derived_year_locations">[];
  derivedFunctions: Doc<"derived_target_year_functions">[];
  derivedEvents: Doc<"derived_state_events">[];
};

function exportFiles(
  manifest: Record<string, unknown>,
  tasks: Doc<"tasks">[],
  taskEvents: Doc<"task_events">[],
  evidenceDrafts: Doc<"evidence_drafts">[],
  historicalClaims: Doc<"historical_claims">[],
  reviewDecisions: Doc<"review_decisions">[],
  occupancy: OccupancyBundle = { occupancies: [], derivedStates: [], derivedLocations: [], derivedFunctions: [], derivedEvents: [] },
) {
  const wide = siteEvidenceWideCsv(String(manifest.country_code ?? ""), evidenceDrafts, reviewDecisions, occupancy.derivedLocations);
  const fileManifest = {
    ...manifest,
    files: [
      { filename: "export_manifest.json", content_type: "application/json" },
      { filename: "tasks.jsonl", content_type: "application/x-ndjson", record_count: tasks.length },
      { filename: "task_events.jsonl", content_type: "application/x-ndjson", record_count: taskEvents.length },
      { filename: "evidence_drafts.jsonl", content_type: "application/x-ndjson", record_count: evidenceDrafts.length },
      { filename: "historical_claims.jsonl", content_type: "application/x-ndjson", record_count: historicalClaims.length },
      { filename: "review_decisions.jsonl", content_type: "application/x-ndjson", record_count: reviewDecisions.length },
      { filename: "site_occupancies.jsonl", content_type: "application/x-ndjson", record_count: occupancy.occupancies.length },
      { filename: "derived_target_year_states.jsonl", content_type: "application/x-ndjson", record_count: occupancy.derivedStates.length },
      { filename: "derived_year_locations.jsonl", content_type: "application/x-ndjson", record_count: occupancy.derivedLocations.length },
      { filename: "derived_target_year_functions.jsonl", content_type: "application/x-ndjson", record_count: occupancy.derivedFunctions.length },
      { filename: "derived_state_events.jsonl", content_type: "application/x-ndjson", record_count: occupancy.derivedEvents.length },
      {
        filename: "site_evidence_wide.csv",
        content_type: "text/csv",
        record_count: wide.rowCount,
        field_count: wide.fieldCount,
        // drafts whose stored field list differed from the shared header;
        // their values were placed by name, never dropped
        field_list_mismatch_count: wide.fieldMismatchCount,
      },
    ],
  };

  return {
    export_manifest_json: JSON.stringify(fileManifest, null, 2) + "\n",
    tasks_jsonl: jsonl(tasks),
    task_events_jsonl: jsonl(taskEvents),
    evidence_drafts_jsonl: jsonl(evidenceDrafts),
    historical_claims_jsonl: jsonl(historicalClaims),
    review_decisions_jsonl: jsonl(reviewDecisions),
    site_occupancies_jsonl: jsonl(occupancy.occupancies),
    derived_target_year_states_jsonl: jsonl(occupancy.derivedStates),
    derived_year_locations_jsonl: jsonl(occupancy.derivedLocations),
    derived_target_year_functions_jsonl: jsonl(occupancy.derivedFunctions),
    derived_state_events_jsonl: jsonl(occupancy.derivedEvents),
    site_evidence_wide_csv: wide.csv,
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

export const createExportBatch = mutation({
  args: {
    countryCode: v.string(),
    taskIds: v.optional(v.array(v.string())),
    exportFormat: v.optional(exportFormat),
    notes: v.optional(v.string()),
  },
  returns: v.object({
    export_batch_id: v.string(),
    included_task_count: v.number(),
    included_review_decision_count: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["curator", "admin"]);
    const now = Date.now();
    const requestedTaskIds =
      args.taskIds ??
      (
        await ctx.db
          .query("tasks")
          // the pi acceptance layer (jb 2026-09-04): a batch takes only
          // tasks a principal investigator has accepted, never a
          // reviewer's acceptance alone
          .withIndex("by_country_status", (q) => q.eq("country_code", args.countryCode).eq("status", "pi_accepted"))
          .take(1000)
      ).map((task) => task.task_id);

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

    const reviewDecisionIds: string[] = [];
    const acceptanceIds: string[] = [];
    for (const taskId of taskIds) {
      const decisions = await decisionsForTask(ctx, taskId);
      reviewDecisionIds.push(
        ...decisions
          .filter((decision) => decision.decision_status === "accepted_for_export")
          .map((decision) => decision.review_decision_id),
      );
      const acceptances = await ctx.db
        .query("task_acceptances")
        .withIndex("by_task", (q) => q.eq("task_id", taskId))
        .collect();
      acceptanceIds.push(
        ...acceptances
          .filter((row) => row.outcome === "accepted")
          .map((row) => row.acceptance_id),
      );
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
    });

    return {
      export_batch_id: exportBatchId,
      included_task_count: taskIds.length,
      included_review_decision_count: reviewDecisionIds.length,
    };
  },
});

export const freezeExportBatch = mutation({
  args: {
    exportBatchId: v.string(),
  },
  returns: v.object({
    export_batch_id: v.string(),
    status: v.literal("frozen"),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["curator", "admin"]);
    const batch = await ctx.db
      .query("export_batches")
      .withIndex("by_export_batch_id", (q) => q.eq("export_batch_id", args.exportBatchId))
      .unique();
    if (batch === null) {
      throw new Error(`Export batch not found: ${args.exportBatchId}`);
    }
    if (batch.status !== "draft") {
      throw new Error("Only draft export batches can be frozen.");
    }

    const now = Date.now();
    await ctx.db.patch(batch._id, {
      status: "frozen",
      frozen_at: now,
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
        actorUserId: user._id,
        actorRole: chooseActorRole(user, ["curator", "admin"]),
        previousStatus: task.status,
        newStatus: "exported",
        exportBatchId: args.exportBatchId,
      });
    }

    return { export_batch_id: args.exportBatchId, status: "frozen" as const };
  },
});

export const getExportBundle = query({
  args: {
    exportBatchId: v.string(),
  },
  returns: v.object({
    export_manifest: v.object({
      export_batch_id: v.string(),
      country_code: v.string(),
      created_at: v.number(),
      frozen_at: v.optional(v.number()),
      schema_version: v.string(),
      export_format: exportFormat,
      included_task_count: v.number(),
      included_evidence_count: v.number(),
      included_historical_claim_count: v.number(),
      included_review_decision_count: v.number(),
      pow_validation_status: v.optional(
        v.union(v.literal("not_run"), v.literal("passed"), v.literal("failed")),
      ),
    }),
    tasks: v.array(taskDoc),
    task_events: v.array(taskEventDoc),
    evidence_drafts: v.array(evidenceDraftDoc),
    historical_claims: v.array(historicalClaimDoc),
    review_decisions: v.array(reviewDecisionDoc),
    site_occupancies: v.array(siteOccupancyDoc),
    derived_target_year_states: v.array(derivedTargetYearStateDoc),
    derived_year_locations: v.array(derivedYearLocationDoc),
    derived_target_year_functions: v.array(derivedTargetYearFunctionDoc),
    derived_state_events: v.array(derivedStateEventDoc),
    files: v.object({
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
    }),
  }),
  handler: async (ctx, args) => {
    await requireUser(ctx, ["curator", "admin"]);
    const batch = await ctx.db
      .query("export_batches")
      .withIndex("by_export_batch_id", (q) => q.eq("export_batch_id", args.exportBatchId))
      .unique();
    if (batch === null) {
      throw new Error(`Export batch not found: ${args.exportBatchId}`);
    }

    const tasks = [];
    const taskEvents = [];
    const evidenceDrafts = [];
    const historicalClaims = [];
    const occupancies: Doc<"site_occupancies">[] = [];
    const derivedStates: Doc<"derived_target_year_states">[] = [];
    const derivedLocations: Doc<"derived_year_locations">[] = [];
    const derivedFunctions: Doc<"derived_target_year_functions">[] = [];
    const derivedEvents: Doc<"derived_state_events">[] = [];
    for (const taskId of batch.included_task_ids) {
      const task = await taskByTaskId(ctx, taskId);
      if (task !== null) {
        tasks.push(task);
      }
      taskEvents.push(
        ...(await ctx.db
          .query("task_events")
          .withIndex("by_task_time", (q) => q.eq("task_id", taskId))
          .collect()),
      );
      evidenceDrafts.push(
        ...(await ctx.db
          .query("evidence_drafts")
          .withIndex("by_task_status", (q) => q.eq("task_id", taskId))
          .collect()),
      );
      const taskHistoricalClaims = await ctx.db
        .query("historical_claims")
        .withIndex("by_task_and_created_at", (q) => q.eq("task_id", taskId))
        .take(501);
      if (taskHistoricalClaims.length > 500) {
        throw new Error(`Task ${taskId} has more than 500 historical claims; split or review it before export.`);
      }
      historicalClaims.push(...taskHistoricalClaims);
      occupancies.push(
        ...(await ctx.db
          .query("site_occupancies")
          .withIndex("by_task_and_created_at", (q) => q.eq("task_id", taskId))
          .collect()),
      );
      derivedStates.push(
        ...(await ctx.db
          .query("derived_target_year_states")
          .withIndex("by_task", (q) => q.eq("task_id", taskId))
          .collect()),
      );
      derivedLocations.push(
        ...(await ctx.db
          .query("derived_year_locations")
          .withIndex("by_task", (q) => q.eq("task_id", taskId))
          .collect()),
      );
      derivedFunctions.push(
        ...(await ctx.db
          .query("derived_target_year_functions")
          .withIndex("by_task", (q) => q.eq("task_id", taskId))
          .collect()),
      );
      derivedEvents.push(
        ...(await ctx.db
          .query("derived_state_events")
          .withIndex("by_task_and_created_at", (q) => q.eq("task_id", taskId))
          .collect()),
      );
    }

    const reviewDecisions = [];
    for (const reviewDecisionId of batch.included_review_decision_ids) {
      const decision = await ctx.db
        .query("review_decisions")
        .withIndex("by_review_decision_id", (q) => q.eq("review_decision_id", reviewDecisionId))
        .unique();
      if (decision !== null) {
        reviewDecisions.push(decision);
      }
    }

    const exportManifest = {
      export_batch_id: batch.export_batch_id,
      country_code: batch.country_code,
      created_at: batch.created_at,
      frozen_at: batch.frozen_at,
      schema_version: batch.schema_version,
      export_format: batch.export_format,
      included_task_count: tasks.length,
      included_evidence_count: evidenceDrafts.length,
      included_historical_claim_count: historicalClaims.length,
      included_review_decision_count: reviewDecisions.length,
      pow_validation_status: batch.pow_validation_status,
    };

    return {
      export_manifest: exportManifest,
      tasks,
      task_events: taskEvents,
      evidence_drafts: evidenceDrafts,
      site_occupancies: occupancies,
      derived_target_year_states: derivedStates,
      derived_year_locations: derivedLocations,
      derived_target_year_functions: derivedFunctions,
      derived_state_events: derivedEvents,
      historical_claims: historicalClaims,
      review_decisions: reviewDecisions,
      files: exportFiles(exportManifest, tasks, taskEvents, evidenceDrafts, historicalClaims, reviewDecisions, {
        occupancies,
        derivedStates,
        derivedLocations,
        derivedFunctions,
        derivedEvents,
      }),
    };
  },
});
