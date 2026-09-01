import { v } from "convex/values";
import { mutation } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { chooseActorRole, requireUser } from "./lib/auth";
import { makeSourceId, normalizeTitleKey, sourceClaimKey } from "./lib/sources";
import {
  MEDIUM_TEXT_MAX,
  SHORT_TEXT_MAX,
  TASK_BRIEF_MAX,
  URL_OR_FILE_MAX,
  assertMaxString,
} from "./lib/limits";
import { appendTaskEvent } from "./lib/taskEvents";

// Convex mirror of the curator batch import
// (docs/portal-batch-import-and-corrections.md). Inert until the JB-gated
// binding: rows are parsed client-side, re-validated here with the same
// rules as apps/workbench/src/data/batchImport.ts (rule changes must land
// in both places), and imported as DRAFTS — never auto-submitted, so the
// human_confirmed and review gates are untouched. Idempotency: a row is
// a duplicate when its (source, locator) key OR its content hash matches
// an earlier import.

const IMPORT_MAX_ROWS = 200;
const PARTIAL_DATE = /^\d{4}(-\d{2})?(-\d{2})?$/;
const GEOCODING_BASES = new Set([
  "exact_address",
  "historical_address_matched",
  "described_locality",
  "map_georeference",
  "regional_only",
  "unknown",
]);
const CONFIDENCES = new Set(["high", "medium", "low"]);

const importRow = v.object({
  row_number: v.number(),
  name: v.string(),
  country_code: v.string(),
  religion: v.optional(v.string()),
  denomination_code: v.optional(v.string()),
  taxonomy_version: v.optional(v.string()),
  lat: v.optional(v.number()),
  lng: v.optional(v.number()),
  locality: v.optional(v.string()),
  containing_area: v.optional(v.string()),
  geocoding_basis: v.optional(v.string()),
  location_confidence: v.optional(v.string()),
  source_locator: v.string(),
  source_url: v.optional(v.string()),
  first_date: v.optional(v.string()),
  last_date: v.optional(v.string()),
  date_confidence: v.optional(v.string()),
  culturally_sensitive: v.optional(v.union(v.literal("yes"), v.literal("no"))),
  notes: v.optional(v.string()),
  claim_hash: v.string(),
});

type ImportRow = {
  row_number: number;
  name: string;
  country_code: string;
  religion?: string;
  denomination_code?: string;
  taxonomy_version?: string;
  lat?: number;
  lng?: number;
  locality?: string;
  containing_area?: string;
  geocoding_basis?: string;
  location_confidence?: string;
  source_locator: string;
  source_url?: string;
  first_date?: string;
  last_date?: string;
  date_confidence?: string;
  culturally_sensitive?: "yes" | "no";
  notes?: string;
  claim_hash: string;
};

// same rules as the workbench module, server-side: the mutation is the
// last line of defence once clients other than the workbench exist
function validateRow(row: ImportRow, countryCode: string): string[] {
  const problems: string[] = [];
  if (!row.name.trim()) {
    problems.push("Give the place a name as the source states it; a batch row without a name is unreviewable.");
  }
  if (row.country_code.toUpperCase() !== countryCode.toUpperCase()) {
    problems.push(`Row country ${row.country_code || "(blank)"} does not match the file's country ${countryCode}.`);
  }
  if (row.denomination_code && !row.taxonomy_version) {
    problems.push("Add the taxonomy version that goes with the denomination code.");
  }
  const hasLat = row.lat !== undefined;
  const hasLng = row.lng !== undefined;
  if (hasLat !== hasLng) {
    problems.push("Enter both latitude and longitude, or leave both blank.");
  }
  if (hasLat && hasLng) {
    if (Math.abs(row.lat!) > 90 || Math.abs(row.lng!) > 180) {
      problems.push("Latitude and longitude must be numeric and in range.");
    }
    if (!row.geocoding_basis) {
      problems.push("Choose a geocoding basis so reviewers know how the point was placed.");
    }
  } else if (!row.containing_area?.trim()) {
    problems.push("A row without coordinates must name its containing area, even when a locality is given.");
  }
  if (row.geocoding_basis && !GEOCODING_BASES.has(row.geocoding_basis)) {
    problems.push(`Unknown geocoding basis: ${row.geocoding_basis}.`);
  }
  for (const [label, value] of [
    ["location_confidence", row.location_confidence],
    ["date_confidence", row.date_confidence],
  ] as const) {
    if (value && !CONFIDENCES.has(value)) {
      problems.push(`${label} must be high, medium, or low.`);
    }
  }
  for (const [label, value] of [
    ["first_date", row.first_date],
    ["last_date", row.last_date],
  ] as const) {
    if (value && !PARTIAL_DATE.test(value)) {
      problems.push(`Write ${label} as YYYY, YYYY-MM, or YYYY-MM-DD.`);
    }
  }
  if (row.source_url && !/^https?:\/\//i.test(row.source_url)) {
    problems.push("source_url must be an http(s) URL.");
  }
  if (!row.source_locator.trim()) {
    problems.push("Every row needs a source_locator: a stable entry reference into the file's source record.");
  }
  return problems;
}

// a VU row must answer the kastom prompt or park for individual handling
function isParkedSensitive(row: ImportRow, countryCode: string): boolean {
  return countryCode.toUpperCase() === "VU" && row.culturally_sensitive === undefined;
}

export const importNominationBatch = mutation({
  args: {
    batchId: v.string(),
    countryCode: v.string(),
    targetYears: v.array(v.number()),
    source: v.object({
      source_type: v.string(),
      title: v.string(),
      url_or_file: v.optional(v.string()),
      archive_ref: v.optional(v.string()),
      licence: v.optional(v.string()),
      consulted_date: v.optional(v.string()),
    }),
    rows: v.array(importRow),
  },
  returns: v.object({
    batch_id: v.string(),
    imported: v.number(),
    rejected: v.number(),
    parked_sensitive: v.number(),
    skipped_existing: v.number(),
    row_reports: v.array(
      v.object({
        row_number: v.number(),
        status: v.union(
          v.literal("imported"),
          v.literal("rejected"),
          v.literal("parked_sensitive"),
          v.literal("skipped_existing"),
        ),
        problems: v.array(v.string()),
        task_id: v.optional(v.string()),
        evidence_draft_id: v.optional(v.string()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["curator", "admin"]);
    const actorRole = chooseActorRole(user, ["curator", "admin"]);
    const countryCode = args.countryCode.toUpperCase();
    const now = Date.now();

    if (args.rows.length === 0) {
      throw new Error("The import has no rows.");
    }
    if (args.rows.length > IMPORT_MAX_ROWS) {
      throw new Error(
        `The import has ${args.rows.length} rows; the per-run cap is ${IMPORT_MAX_ROWS}. Split the file and import each part.`,
      );
    }
    if (!args.source.title.trim() || /^n\/?a$/i.test(args.source.title.trim())) {
      throw new Error("Every source needs a real title.");
    }
    if (!args.source.url_or_file?.trim() && !args.source.archive_ref?.trim()) {
      throw new Error("Every source needs either a URL or an archive reference.");
    }
    assertMaxString("source title", args.source.title, MEDIUM_TEXT_MAX);
    assertMaxString("source URL or file", args.source.url_or_file, URL_OR_FILE_MAX);
    assertMaxString("archive reference", args.source.archive_ref, MEDIUM_TEXT_MAX);
    assertMaxString("licence", args.source.licence, SHORT_TEXT_MAX);
    assertMaxString("batch id", args.batchId, MEDIUM_TEXT_MAX);

    // one batch record per import run, under the existing spreadsheet kind
    const existingBatch = await ctx.db
      .query("task_batches")
      .withIndex("by_batch_id", (q) => q.eq("batch_id", args.batchId))
      .unique();
    if (existingBatch === null) {
      await ctx.db.insert("task_batches", {
        batch_id: args.batchId,
        country_code: countryCode,
        source_kind: "spreadsheet_submission",
        target_years: args.targetYears,
        status: "active",
        created_by: user._id,
        created_at: now,
        updated_at: now,
        notes: `Curator nomination import from: ${args.source.title}`,
      });
    }

    // the shared source register makes "one file, one source record" a real
    // reference: every draft from this run carries the register row's id
    const titleKey = normalizeTitleKey(args.source.title);
    let registerSource = (
      await ctx.db
        .query("sources")
        .withIndex("by_title_key", (q) => q.eq("title_key", titleKey))
        .collect()
    ).find((row) => row.status === "active" && row.country_code === countryCode) ?? null;
    if (registerSource === null) {
      const registerDocId = await ctx.db.insert("sources", {
        source_id: makeSourceId(titleKey, countryCode),
        country_code: countryCode,
        source_type: args.source.source_type,
        title: args.source.title.trim(),
        title_key: titleKey,
        url: args.source.url_or_file?.trim() || undefined,
        archive_ref: args.source.archive_ref?.trim() || undefined,
        licence: args.source.licence?.trim() || undefined,
        consulted_date: args.source.consulted_date?.trim() || undefined,
        status: "active",
        created_by: user._id,
        created_at: now,
        updated_at: now,
      });
      registerSource = (await ctx.db.get(registerDocId))!;
    }

    const sourceKeyOf = (locator: string) => sourceClaimKey(args.source.title, locator);

    let imported = 0;
    let rejected = 0;
    let parkedSensitive = 0;
    let skippedExisting = 0;
    const rowReports = [];

    for (const row of args.rows) {
      const problems = validateRow(row, countryCode);
      if (problems.length > 0) {
        rejected += 1;
        rowReports.push({ row_number: row.row_number, status: "rejected" as const, problems });
        continue;
      }
      if (isParkedSensitive(row, countryCode)) {
        parkedSensitive += 1;
        rowReports.push({
          row_number: row.row_number,
          status: "parked_sensitive" as const,
          problems: ["Answer the kastom prompt (culturally_sensitive: yes or no) or nominate this place individually."],
        });
        continue;
      }

      const sourceClaimKey = sourceKeyOf(row.source_locator);
      const byKey = await ctx.db
        .query("evidence_drafts")
        .withIndex("by_source_claim_key", (q) => q.eq("source_claim_key", sourceClaimKey))
        .first();
      // the hash test is scoped to this file's source: an identical row
      // in a different corpus is not a duplicate of this one
      const byHash = byKey
        ? null
        : (
            await ctx.db
              .query("evidence_drafts")
              .withIndex("by_claim_hash", (q) => q.eq("claim_hash", row.claim_hash))
              .take(20)
          ).find((doc) => doc.source_claim_key?.startsWith(`${args.source.title}#`)) ?? null;
      if (byKey !== null || byHash !== null) {
        skippedExisting += 1;
        rowReports.push({
          row_number: row.row_number,
          status: "skipped_existing" as const,
          problems: ["Already imported in an earlier upload of this source; not duplicated."],
        });
        continue;
      }

      const taskId = `batch-claim:${countryCode.toLowerCase()}:${args.batchId}:${row.row_number}`;
      const draftId = `${taskId}:draft`;
      const taskBrief = `Imported from ${args.source.title}, entry ${row.source_locator}. Review the evidence, then submit for review.`;
      assertMaxString("task brief", taskBrief, TASK_BRIEF_MAX);

      await ctx.db.insert("tasks", {
        task_id: taskId,
        batch_id: args.batchId,
        country_code: countryCode,
        task_type: "missing_from_project_map",
        priority: "medium",
        status: "draft_saved",
        target_years: args.targetYears,
        candidate_site_id: `candidate:${countryCode.toLowerCase()}:${args.batchId}:${row.row_number}`,
        source_record_id: sourceClaimKey,
        name: row.name,
        locality: row.locality ?? row.containing_area,
        geometry:
          row.lat !== undefined && row.lng !== undefined
            ? { type: "Point", coordinates: [row.lng, row.lat] }
            : null,
        task_brief: taskBrief,
        source_context: {
          origin: "batch_import",
          import_batch_id: args.batchId,
          source_locator: row.source_locator,
        },
        created_at: now,
        updated_at: now,
        last_event_at: now,
      });

      // drafts arrive as DRAFT — submission stays a deliberate human act
      await ctx.db.insert("evidence_drafts", {
        evidence_draft_id: draftId,
        task_id: taskId,
        draft_status: "draft",
        created_by: user._id,
        created_at: now,
        updated_at: now,
        source_type: args.source.source_type,
        source_title: args.source.title,
        source_url_or_file: args.source.url_or_file ?? args.source.archive_ref,
        source_date_or_capture_date: args.source.consulted_date,
        source_id: registerSource.source_id,
        source_locator: row.source_locator,
        locality_raw: row.locality,
        source_notes: [
          args.source.licence ? `Licence: ${args.source.licence}` : undefined,
          row.source_url ? `${args.source.title}, entry ${row.source_locator}: ${row.source_url}` : undefined,
        ]
          .filter(Boolean)
          .join("\n") || undefined,
        related_ids_or_note: `entry ${row.source_locator}`,
        lifecycle_event: row.first_date ? "first_seen" : undefined,
        lifecycle_date: row.first_date,
        lifecycle_note: row.last_date ? `last_seen ${row.last_date} (${row.date_confidence ?? "medium"})` : undefined,
        evidence_note: [
          row.religion ? `religion: ${row.religion}` : undefined,
          row.denomination_code ? `denomination: ${row.denomination_code} (taxonomy ${row.taxonomy_version})` : undefined,
          row.culturally_sensitive ? `culturally_sensitive: ${row.culturally_sensitive}` : undefined,
          row.notes,
        ]
          .filter(Boolean)
          .join("\n") || undefined,
        privacy_flag: row.culturally_sensitive === "yes" ? "needs_review" : "clear",
        licence_flag: args.source.licence ? "clear" : "needs_review",
        source_claim_key: sourceClaimKey,
        claim_hash: row.claim_hash,
        import_batch_id: args.batchId,
      });

      await appendTaskEvent(ctx, {
        taskId,
        eventType: "imported",
        actorUserId: user._id,
        actorRole,
        newStatus: "draft_saved",
        reason: `Curator nomination import, batch ${args.batchId}, entry ${row.source_locator}.`,
        evidenceDraftId: draftId,
      });

      imported += 1;
      rowReports.push({
        row_number: row.row_number,
        status: "imported" as const,
        problems: [] as string[],
        task_id: taskId,
        evidence_draft_id: draftId,
      });
    }

    return {
      batch_id: args.batchId,
      imported,
      rejected,
      parked_sensitive: parkedSensitive,
      skipped_existing: skippedExisting,
      row_reports: rowReports,
    };
  },
});
