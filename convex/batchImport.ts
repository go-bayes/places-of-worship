import { v } from "convex/values";
import { internalMutation, mutation } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { chooseActorRole, requireUser } from "./lib/auth";
import { dateFloorYear, defaultTargetYears } from "./lib/countryYears";
import { makeSourceId, normalizeTitleKey, sourceClaimKey } from "./lib/sources";
import {
  MEDIUM_TEXT_MAX,
  SHORT_TEXT_MAX,
  TASK_BRIEF_MAX,
  URL_OR_FILE_MAX,
  assertEvidenceDraftLimits,
  assertEvidenceDraftSubmission,
  assertMaxString,
} from "./lib/limits";
import { assertLocationAssertion } from "./lib/locationAssertions";
import { assertOccupancySet, type OccupancySegmentInput } from "./lib/occupancies";
import { groupImportRows, rowHasOccupancy, segmentFromImportRow } from "./lib/occupancyImport";
import { appendTaskEvent } from "./lib/taskEvents";
import { recordOccupancySet } from "./occupancies";

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

const importSource = v.object({
  source_type: v.string(),
  title: v.string(),
  url_or_file: v.optional(v.string()),
  archive_ref: v.optional(v.string()),
  licence: v.optional(v.string()),
  consulted_date: v.optional(v.string()),
});
type ImportSource = typeof importSource.type;

function assertImportSourceLimits(source: ImportSource, batchId: string): void {
  if (!source.title.trim() || /^n\/?a$/i.test(source.title.trim())) {
    throw new Error("Every source needs a real title.");
  }
  if (!source.url_or_file?.trim() && !source.archive_ref?.trim()) {
    throw new Error("Every source needs either a URL or an archive reference.");
  }
  assertMaxString("source title", source.title, MEDIUM_TEXT_MAX);
  assertMaxString("source URL or file", source.url_or_file, URL_OR_FILE_MAX);
  assertMaxString("archive reference", source.archive_ref, MEDIUM_TEXT_MAX);
  assertMaxString("licence", source.licence, SHORT_TEXT_MAX);
  assertMaxString("batch id", batchId, MEDIUM_TEXT_MAX);
}

// one batch record per import run, under the existing spreadsheet kind
async function ensureImportBatch(
  ctx: MutationCtx,
  user: Doc<"users">,
  batchId: string,
  countryCode: string,
  targetYears: number[],
  notes: string,
  now: number,
): Promise<void> {
  const existingBatch = await ctx.db
    .query("task_batches")
    .withIndex("by_batch_id", (q) => q.eq("batch_id", batchId))
    .unique();
  if (existingBatch === null) {
    await ctx.db.insert("task_batches", {
      batch_id: batchId,
      country_code: countryCode,
      source_kind: "spreadsheet_submission",
      target_years: targetYears,
      status: "active",
      created_by: user._id,
      created_at: now,
      updated_at: now,
      notes,
    });
  }
}

// the shared source register makes "one file, one source record" a real
// reference: every draft from this run carries the register row's id
async function ensureRegisterSource(
  ctx: MutationCtx,
  user: Doc<"users">,
  source: ImportSource,
  countryCode: string,
  now: number,
): Promise<Doc<"sources">> {
  const titleKey = normalizeTitleKey(source.title);
  const existing = (
    await ctx.db
      .query("sources")
      .withIndex("by_title_key", (q) => q.eq("title_key", titleKey))
      .collect()
  ).find((row) => row.status === "active" && row.country_code === countryCode) ?? null;
  if (existing !== null) return existing;
  const registerDocId = await ctx.db.insert("sources", {
    source_id: makeSourceId(titleKey, countryCode),
    country_code: countryCode,
    source_type: source.source_type,
    title: source.title.trim(),
    title_key: titleKey,
    url: source.url_or_file?.trim() || undefined,
    archive_ref: source.archive_ref?.trim() || undefined,
    licence: source.licence?.trim() || undefined,
    consulted_date: source.consulted_date?.trim() || undefined,
    status: "active",
    created_by: user._id,
    created_at: now,
    updated_at: now,
  });
  return (await ctx.db.get(registerDocId))!;
}

// a row already imported under this source, by locator or by content hash
async function findExistingImport(
  ctx: MutationCtx,
  sourceTitle: string,
  claimKey: string,
  claimHash: string,
): Promise<boolean> {
  const byKey = await ctx.db
    .query("evidence_drafts")
    .withIndex("by_source_claim_key", (q) => q.eq("source_claim_key", claimKey))
    .first();
  if (byKey !== null) return true;
  // the hash test is scoped to this file's source: an identical row
  // in a different corpus is not a duplicate of this one
  const byHash = (
    await ctx.db
      .query("evidence_drafts")
      .withIndex("by_claim_hash", (q) => q.eq("claim_hash", claimHash))
      .take(20)
  ).find((doc) => doc.source_claim_key?.startsWith(`${sourceTitle}#`));
  return byHash !== undefined;
}

// PR-D (docs/portal-location-and-occupancy-plan.md section 4): the import
// row gains the occupancy columns, one row per period, rows of one place
// sharing source_locator and numbered by segment_index. the columns are
// strings as a csv carries them; numbers may also arrive as numbers
const occupancyImportRow = v.object({
  row_number: v.number(),
  segment_index: v.optional(v.union(v.number(), v.string())),
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
  // reviewer-visible notes the builder attaches (a repaired coordinate, a
  // shared point, an irregular event sequence); each becomes an info check
  import_checks: v.optional(v.array(v.string())),
  start_mode: v.optional(v.string()),
  start_date: v.optional(v.string()),
  start_not_earlier_than: v.optional(v.string()),
  start_not_later_than: v.optional(v.string()),
  start_basis: v.optional(v.string()),
  end_mode: v.optional(v.string()),
  end_date: v.optional(v.string()),
  end_not_earlier_than: v.optional(v.string()),
  end_not_later_than: v.optional(v.string()),
  end_basis: v.optional(v.string()),
  end_reason: v.optional(v.string()),
  still_active_asof: v.optional(v.string()),
  latitude: v.optional(v.union(v.number(), v.string())),
  longitude: v.optional(v.union(v.number(), v.string())),
  location_mode: v.optional(v.string()),
  uncertainty_radius_m: v.optional(v.union(v.number(), v.string())),
  location_basis: v.optional(v.string()),
  location_wording: v.optional(v.string()),
  occupancy_confidence: v.optional(v.string()),
  occupancy_confidence_basis: v.optional(v.string()),
  occupancy_source_basis: v.optional(v.string()),
  occupancy_source_reference: v.optional(v.string()),
  occupancy_source_account: v.optional(v.string()),
  occupancy_uncertainty_note: v.optional(v.string()),
});
type OccupancyImportRowInput = typeof occupancyImportRow.type;

const OCCUPANCY_IMPORT_MAX_PLACES = 100;
const OCCUPANCY_IMPORT_MAX_ROWS = 400;

const occupancyImportReturns = v.object({
  batch_id: v.string(),
  imported: v.number(),
  rejected: v.number(),
  parked_sensitive: v.number(),
  skipped_existing: v.number(),
  occupancies: v.number(),
  derived_years: v.number(),
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
      occupancy_ids: v.optional(v.array(v.string())),
    }),
  ),
});

// admin-key-only bulk ingest of places with their recorded periods (PR-D).
// unlike the curator nomination import, each place lands SUBMITTED: the
// task opens in the review queue with a guided evidence record, its
// site_occupancies rows, and the derived census-year proposals as
// derived_unconfirmed, so the reviewer confirms on the drawn interval (plan
// section 4). the deliberate human act is the admin running this under a
// named service or admin user, whose id every row and event carries.
// idempotent per source: a place whose (source, locator) key or content
// hash already exists is skipped, never re-inserted
export const adminImportOccupancyBatch = internalMutation({
  args: {
    actor_email: v.string(),
    batchId: v.string(),
    countryCode: v.string(),
    targetYears: v.optional(v.array(v.number())),
    source: importSource,
    rows: v.array(occupancyImportRow),
  },
  returns: occupancyImportReturns,
  handler: async (ctx, args) => {
    const email = args.actor_email.trim().toLowerCase();
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (user === null || user.status !== "active") {
      throw new Error("Acting user is not an active project user.");
    }
    if (!user.roles.includes("service") && !user.roles.includes("admin")) {
      throw new Error("Acting user must hold the service or admin role.");
    }
    const actorRole = chooseActorRole(user, ["service", "admin"]);
    const countryCode = args.countryCode.toUpperCase();
    const targetYears = args.targetYears && args.targetYears.length > 0 ? args.targetYears : defaultTargetYears(countryCode);
    const now = Date.now();
    const referenceDate = new Date(now).toISOString().slice(0, 10);
    const floorYear = dateFloorYear(countryCode);

    if (args.rows.length === 0) {
      throw new Error("The import has no rows.");
    }
    if (args.rows.length > OCCUPANCY_IMPORT_MAX_ROWS) {
      throw new Error(
        `The import has ${args.rows.length} rows; the per-run cap is ${OCCUPANCY_IMPORT_MAX_ROWS}. Split the file and import each part.`,
      );
    }
    assertImportSourceLimits(args.source, args.batchId);
    const places = groupImportRows(args.rows);
    if (places.size > OCCUPANCY_IMPORT_MAX_PLACES) {
      throw new Error(
        `The import has ${places.size} places; the per-run cap is ${OCCUPANCY_IMPORT_MAX_PLACES}. Split the file and import each part.`,
      );
    }

    await ensureImportBatch(ctx, user, args.batchId, countryCode, targetYears, `Bulk occupancy import from: ${args.source.title}`, now);
    const registerSource = await ensureRegisterSource(ctx, user, args.source, countryCode, now);

    let imported = 0;
    let rejected = 0;
    let parkedSensitive = 0;
    let skippedExisting = 0;
    let occupancies = 0;
    let derivedYears = 0;
    const rowReports: (typeof occupancyImportReturns.type)["row_reports"] = [];

    for (const [locator, rows] of places) {
      const base = rows[0];
      const rowNumber = base.row_number;
      const problems = validateRow(base, countryCode);
      const inconsistent = rows.filter((row) => row.name !== base.name || row.row_number !== base.row_number);
      if (inconsistent.length > 0) {
        problems.push("Rows of one place must repeat its name and row_number and differ only in their period columns.");
      }
      const periodRows = rows.filter(rowHasOccupancy);
      if (periodRows.length === 0) {
        problems.push("Give the place at least one period (start_mode or end_mode) or use the nomination import.");
      }
      if (periodRows.length !== rows.length) {
        problems.push("Every row of a place with periods must carry a period.");
      }
      if (problems.length > 0) {
        rejected += 1;
        rowReports.push({ row_number: rowNumber, status: "rejected", problems });
        continue;
      }
      if (isParkedSensitive(base, countryCode)) {
        parkedSensitive += 1;
        rowReports.push({
          row_number: rowNumber,
          status: "parked_sensitive",
          problems: ["Answer the kastom prompt (culturally_sensitive: yes or no) or nominate this place individually."],
        });
        continue;
      }
      const claimKey = sourceClaimKey(args.source.title, locator);
      if (await findExistingImport(ctx, args.source.title, claimKey, base.claim_hash)) {
        skippedExisting += 1;
        rowReports.push({
          row_number: rowNumber,
          status: "skipped_existing",
          problems: ["Already imported in an earlier upload of this source; not duplicated."],
        });
        continue;
      }

      // the task point: the row's point, else the first period's point
      const firstPoint = periodRows
        .map((row) => ({ latitude: Number(row.latitude), longitude: Number(row.longitude) }))
        .find((point) => isFinitePoint(point));
      const point = base.lat !== undefined && base.lng !== undefined
        ? { latitude: base.lat, longitude: base.lng }
        : firstPoint;
      if (point === undefined) {
        rejected += 1;
        rowReports.push({ row_number: rowNumber, status: "rejected", problems: ["A place with periods needs a point: give lat and lng, or latitude and longitude on its first period."] });
        continue;
      }
      const privacyFlag = base.culturally_sensitive === "yes" ? ("needs_review" as const) : ("clear" as const);
      const segments: OccupancySegmentInput[] = [];
      const segmentProblems: string[] = [];
      for (const row of periodRows) {
        const read = segmentFromImportRow(row, { sourceTitle: args.source.title, sourceLocator: locator, taskPoint: point, privacyFlag });
        if (read.segment === null) {
          segmentProblems.push(...read.problems.map((p) => `Period ${row.segment_index ?? 0}: ${p}`));
        } else {
          segments.push(read.segment);
        }
      }
      if (segmentProblems.length === 0) {
        try {
          assertOccupancySet(segments, referenceDate, point, floorYear);
        } catch (error) {
          segmentProblems.push(error instanceof Error ? error.message : String(error));
        }
      }
      if (segmentProblems.length > 0) {
        rejected += 1;
        rowReports.push({ row_number: rowNumber, status: "rejected", problems: segmentProblems });
        continue;
      }

      const taskId = `batch-claim:${countryCode.toLowerCase()}:${args.batchId}:${rowNumber}`;
      const draftId = `${taskId}:draft`;
      const taskBrief = `Imported from ${args.source.title}, entry ${locator}. Confirm the place's identity and location, then confirm, override, or reject each derived census-year state in the occupancy panel.`;
      assertMaxString("task brief", taskBrief, TASK_BRIEF_MAX);
      // the first period's assertion describes the task point when it sits
      // on it, so the reviewer sees the location grade
      const firstSegment = [...segments].sort((a, b) => a.segment_index - b.segment_index)[0];
      const initialAssertion = firstSegment.location !== undefined
        && Math.abs(firstSegment.location.latitude - point.latitude) < 1e-9
        && Math.abs(firstSegment.location.longitude - point.longitude) < 1e-9
        ? firstSegment.location
        : undefined;
      if (initialAssertion !== undefined) assertLocationAssertion(initialAssertion);
      const checks = (base.import_checks ?? []).filter((message) => message.trim()).map((message, index) => ({
        check_id: `import_note_${index + 1}`,
        severity: "info",
        message: message.trim(),
        suggested_action: "read_before_deciding",
      }));

      await ctx.db.insert("tasks", {
        task_id: taskId,
        batch_id: args.batchId,
        country_code: countryCode,
        task_type: "missing_from_project_map",
        priority: "medium",
        status: "needs_review",
        target_years: targetYears,
        candidate_site_id: `candidate:${countryCode.toLowerCase()}:${args.batchId}:${rowNumber}`,
        source_record_id: claimKey,
        name: base.name,
        locality: base.locality ?? base.containing_area,
        geometry: { type: "Point", coordinates: [point.longitude, point.latitude] },
        ...(initialAssertion !== undefined ? { initial_location_assertion: initialAssertion } : {}),
        nearby_site_refs: [],
        automated_checks: checks,
        task_brief: taskBrief,
        source_context: {
          origin: "batch_import",
          import_batch_id: args.batchId,
          source_locator: locator,
          occupancy_import: true,
          period_count: segments.length,
        },
        created_at: now,
        updated_at: now,
        last_event_at: now,
      });

      const evidenceNote = [
        `Compiled record imported with ${segments.length} period${segments.length === 1 ? "" : "s"}; see the occupancy panel.`,
        base.religion ? `religion: ${base.religion}` : undefined,
        base.denomination_code ? `denomination: ${base.denomination_code} (taxonomy ${base.taxonomy_version})` : undefined,
        base.culturally_sensitive ? `culturally_sensitive: ${base.culturally_sensitive}` : undefined,
        base.notes,
      ].filter(Boolean).join("\n");
      const draftRecord = {
        evidence_draft_id: draftId,
        task_id: taskId,
        draft_status: "submitted" as const,
        created_by: user._id,
        created_at: now,
        updated_at: now,
        observation_contract_version: "guided_observation_v1" as const,
        source_type: args.source.source_type,
        source_title: args.source.title,
        source_url_or_file: args.source.url_or_file ?? args.source.archive_ref,
        source_date_or_capture_date: args.source.consulted_date,
        source_id: registerSource.source_id,
        source_locator: locator,
        locality_raw: base.locality,
        source_notes: [
          args.source.licence ? `Licence: ${args.source.licence}` : undefined,
          base.source_url ? `${args.source.title}, entry ${locator}: ${base.source_url}` : undefined,
        ].filter(Boolean).join("\n") || undefined,
        related_ids_or_note: `entry ${locator}`,
        target_year_statuses: Object.fromEntries(targetYears.map((year) => [String(year), "not_assessed" as const])),
        ...(base.first_date ? { lifecycle_event: "first_seen", lifecycle_date: base.first_date, lifecycle_date_precision: base.first_date.length === 4 ? "year" : base.first_date.length === 7 ? "month" : "day" } : {}),
        ...(base.last_date ? { lifecycle_note: `last_seen ${base.last_date} (${base.date_confidence ?? "medium"})` } : {}),
        evidence_note: evidenceNote,
        privacy_flag: privacyFlag,
        licence_flag: args.source.licence ? ("clear" as const) : ("needs_review" as const),
        validation_summary: {
          status: "server_validated",
          contract: "guided_observation_v1",
          origin: "occupancy_import",
          historical_target_years_assessed: false,
        },
        source_claim_key: claimKey,
        claim_hash: base.claim_hash,
        import_batch_id: args.batchId,
      };
      assertEvidenceDraftLimits(draftRecord);
      assertEvidenceDraftSubmission(draftRecord, false);
      await ctx.db.insert("evidence_drafts", draftRecord);

      await appendTaskEvent(ctx, {
        taskId,
        eventType: "imported",
        actorUserId: user._id,
        actorRole,
        newStatus: "needs_review",
        reason: `Bulk occupancy import, batch ${args.batchId}, entry ${locator}.`,
        evidenceDraftId: draftId,
      });
      await appendTaskEvent(ctx, {
        taskId,
        eventType: "submitted_for_review",
        actorUserId: user._id,
        actorRole,
        previousStatus: "needs_review",
        newStatus: "needs_review",
        reason: `Imported record submitted for review with ${segments.length} recorded period${segments.length === 1 ? "" : "s"}.`,
        evidenceDraftId: draftId,
        clientContext: { source: "occupancy_import", import_batch_id: args.batchId },
      });

      const task = (await ctx.db
        .query("tasks")
        .withIndex("by_task_id", (q) => q.eq("task_id", taskId))
        .unique())!;
      const parent = (await ctx.db
        .query("evidence_drafts")
        .withIndex("by_evidence_draft_id", (q) => q.eq("evidence_draft_id", draftId))
        .unique())!;
      const recorded = await recordOccupancySet(ctx, {
        task,
        parent,
        user,
        actorRole,
        submissionKey: `${user._id}:${args.batchId}:${locator}`,
        submissionToken: "import",
        segments,
        now,
        clientContext: { source: "occupancy_import", import_batch_id: args.batchId },
      });

      imported += 1;
      occupancies += recorded.occupancyIds.length;
      derivedYears += recorded.derived.years.length;
      rowReports.push({
        row_number: rowNumber,
        status: "imported",
        problems: [],
        task_id: taskId,
        evidence_draft_id: draftId,
        occupancy_ids: recorded.occupancyIds,
      });
    }

    return {
      batch_id: args.batchId,
      imported,
      rejected,
      parked_sensitive: parkedSensitive,
      skipped_existing: skippedExisting,
      occupancies,
      derived_years: derivedYears,
      row_reports: rowReports,
    };
  },
});

function isFinitePoint(point: { latitude: number; longitude: number }): boolean {
  return Number.isFinite(point.latitude) && Number.isFinite(point.longitude);
}

export const importNominationBatch = mutation({
  args: {
    batchId: v.string(),
    countryCode: v.string(),
    targetYears: v.array(v.number()),
    source: importSource,
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
    assertImportSourceLimits(args.source, args.batchId);

    await ensureImportBatch(ctx, user, args.batchId, countryCode, args.targetYears, `Curator nomination import from: ${args.source.title}`, now);
    const registerSource = await ensureRegisterSource(ctx, user, args.source, countryCode, now);

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
      if (await findExistingImport(ctx, args.source.title, sourceClaimKey, row.claim_hash)) {
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
