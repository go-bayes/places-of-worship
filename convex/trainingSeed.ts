import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { canReview, chooseActorRole } from "./lib/auth";
import {
  MEDIUM_TEXT_MAX,
  TASK_BRIEF_MAX,
  TASK_NAME_MAX,
  assertMaxString,
} from "./lib/limits";
import { appendTaskEvent } from "./lib/taskEvents";
import { DEFAULT_TARGET_YEARS } from "./lib/countryYears";

const TRAINING_BATCH_ID = "guy-vu-training-001";
const TARGET_YEARS = DEFAULT_TARGET_YEARS.VU;

type PointGeometry = {
  type: "Point";
  coordinates: [number, number];
};

type TrainingCase = {
  caseNumber: number;
  taskId: string;
  title: string;
  taskType:
    | "verify_existing_site"
    | "missing_from_project_map"
    | "possible_duplicate"
    | "target_year_status"
    | "lifecycle_date_needed"
    | "denomination_or_shared_use"
    | "geometry_check"
    | "osm_identity_link"
    | "other";
  priority: "high" | "medium" | "low";
  locality?: string;
  geometry: PointGeometry | null;
  matchedOsmId?: string;
  osmObjectType?: "node" | "way" | "relation";
  candidateSiteId?: string;
  sourceRecordId: string;
  brief: string;
  expectedOutcome: string;
  reviewerChecks: string[];
  skillTests: string[];
  sourceContext: Record<string, unknown>;
  automatedChecks?: Array<{
    check_id: string;
    severity?: string;
    message: string;
    suggested_action?: string;
  }>;
};

function point(longitude: number, latitude: number): PointGeometry {
  return { type: "Point", coordinates: [longitude, latitude] };
}

const TRAINING_CASES: readonly TrainingCase[] = [
  {
    caseNumber: 1,
    taskId: "training:vu:guy-vu-training-001:case-01",
    title: "Cathédrale du Sacré-Cœur, Port Vila",
    taskType: "verify_existing_site",
    priority: "high",
    locality: "Port Vila, Shefa",
    geometry: point(168.3151582, -17.7346446),
    matchedOsmId: "319762684",
    osmObjectType: "way",
    sourceRecordId: "osm-vu-place-of-worship#way/319762684",
    brief:
      "[TRAINING] Case 01: verify this existing Vanuatu church using a good web source. Start from the OSM record for Cathédrale du Sacré-Cœur, then add evidence that supports current worship use and target-year statuses for 1989, 1999, 2009, and 2020.",
    expectedOutcome:
      "Submit evidence confirming the same site, current worship use, and supported target-year statuses without changing the site identity.",
    reviewerChecks: [
      "The source names the Port Vila cathedral, not only the Catholic diocese.",
      "Target-year statuses distinguish direct evidence from reasonable carry-forward.",
      "The OSM identity is retained as the matched current site.",
    ],
    skillTests: ["basic evidence entry", "target-year statuses"],
    sourceContext: {
      origin: "training_seed",
      source_dataset_id: "osm-vu-place-of-worship",
      osm: {
        object_type: "way",
        object_id: 319762684,
        url: "https://www.openstreetmap.org/way/319762684",
        retrieved_at: "2026-06-13T05:19:31Z",
        attribution: "OpenStreetMap contributors, ODbL 1.0",
      },
      suggested_sources: [
        {
          title: "Cathédrale du Sacré-Cœur, Port Vila",
          url: "https://en.wikipedia.org/wiki/Cath%C3%A9drale_du_Sacr%C3%A9-C%C5%93ur,_Port_Vila",
          use: "site-specific confirmation to be checked by the RA before submission",
        },
      ],
    },
  },
  {
    caseNumber: 2,
    taskId: "training:vu:guy-vu-training-001:case-02",
    title: "Eglise du Coeur Immaculé de Marie de Paray",
    taskType: "verify_existing_site",
    priority: "high",
    locality: "Port Vila, Shefa",
    geometry: point(168.3161004, -17.7535052),
    matchedOsmId: "332908898",
    osmObjectType: "way",
    sourceRecordId: "osm-vu-place-of-worship#way/332908898",
    brief:
      "[TRAINING] Case 02: wrong-site discipline. The task site is Eglise du Coeur Immaculé de Marie de Paray, but one suggested web source describes Cathédrale du Sacré-Cœur in central Port Vila. Do not force a match when the source describes a different site.",
    expectedOutcome:
      "Do not submit the cathedral source as evidence for this site. Either find a source for this exact church or park the task as unresolved.",
    reviewerChecks: [
      "The RA rejects sources that only support a nearby or same-denomination site.",
      "Any submitted source has a locator that names or clearly identifies this site.",
      "The note explains the wrong-site problem if the case is parked.",
    ],
    skillTests: ["wrong-site discipline", "source-site identity"],
    sourceContext: {
      origin: "training_seed",
      source_dataset_id: "osm-vu-place-of-worship",
      osm: {
        object_type: "way",
        object_id: 332908898,
        url: "https://www.openstreetmap.org/way/332908898",
        retrieved_at: "2026-06-13T05:19:31Z",
        attribution: "OpenStreetMap contributors, ODbL 1.0",
      },
      decoy_source: {
        title: "Cathédrale du Sacré-Cœur, Port Vila",
        url: "https://en.wikipedia.org/wiki/Cath%C3%A9drale_du_Sacr%C3%A9-C%C5%93ur,_Port_Vila",
        expected_handling: "wrong_site",
      },
    },
  },
  {
    caseNumber: 3,
    taskId: "training:vu:guy-vu-training-001:case-03",
    title: "Old Church near Lamlu",
    taskType: "target_year_status",
    priority: "medium",
    locality: "Malampa",
    geometry: point(168.2290869, -16.6390433),
    matchedOsmId: "6952954885",
    osmObjectType: "node",
    sourceRecordId: "osm-vu-place-of-worship#node/6952954885",
    brief:
      "[TRAINING] Case 03: absence claim. The OSM source names an Old Church beside a New Church. Assess whether there is dated evidence that the old worship building is gone or no longer present. Use the No-building-present wording only if a dated source supports absence.",
    expectedOutcome:
      "Record an absence claim only with dated support; otherwise submit an unresolved note explaining that the old/new label is not enough evidence.",
    reviewerChecks: [
      "No-building-present is tied to dated imagery or a dated source.",
      "The RA does not infer disappearance from the name Old Church alone.",
      "The nearby New Church is treated as a separate site unless evidence links them.",
    ],
    skillTests: ["dated evidence for absence", "No-building-present wording"],
    sourceContext: {
      origin: "training_seed",
      source_dataset_id: "osm-vu-place-of-worship",
      osm: {
        object_type: "node",
        object_id: 6952954885,
        url: "https://www.openstreetmap.org/node/6952954885",
        paired_osm_object: "node/6952955785",
        retrieved_at: "2026-06-13T05:19:31Z",
        attribution: "OpenStreetMap contributors, ODbL 1.0",
      },
    },
  },
  {
    caseNumber: 4,
    taskId: "training:vu:guy-vu-training-001:case-04",
    title: "Paton Memorial Church nomination",
    taskType: "missing_from_project_map",
    priority: "high",
    locality: "Port Vila, Shefa",
    geometry: point(168.3158766, -17.7401736),
    matchedOsmId: "11817228242",
    osmObjectType: "node",
    candidateSiteId: "candidate:vu:guy-vu-training-001:case-04",
    sourceRecordId: "osm-vu-place-of-worship#node/11817228242",
    brief:
      "[TRAINING] Case 04: place-first nomination of a known-missing church. Treat this as a nomination, answer the VU kastom prompt as no, check for duplicates, and record minimal identity evidence before submission.",
    expectedOutcome:
      "Submit a normal missing-from-project-map nomination with culturally_sensitive=no and enough identity evidence for review.",
    reviewerChecks: [
      "The kastom answer is no and the task is not deferred for cultural review.",
      "The RA checks nearby Port Vila Presbyterian records for duplicates.",
      "The submission has minimal identity fields: name, locality, source, and point.",
    ],
    skillTests: ["kastom prompt", "dedup check", "minimal identity"],
    sourceContext: {
      origin: "training_seed",
      nomination_mode: "place_first",
      culturally_sensitive_expected_answer: "no",
      source_dataset_id: "osm-vu-place-of-worship",
      osm: {
        object_type: "node",
        object_id: 11817228242,
        url: "https://www.openstreetmap.org/node/11817228242",
        retrieved_at: "2026-06-13T05:19:31Z",
        attribution: "OpenStreetMap contributors, ODbL 1.0",
      },
    },
    automatedChecks: [
      {
        check_id: "vu_kastom_gate",
        severity: "info",
        message: "TRAINING: answer the VU kastom prompt as no for this church nomination.",
        suggested_action: "record_culturally_sensitive_no",
      },
    ],
  },
  {
    caseNumber: 5,
    taskId: "training:vu:guy-vu-training-001:case-05",
    title: "Nakamal Manuapen restricted-location nomination",
    taskType: "missing_from_project_map",
    priority: "high",
    locality: "Tafea",
    geometry: null,
    candidateSiteId: "candidate:vu:guy-vu-training-001:case-05",
    sourceRecordId: "osm-vu-place-of-worship#node/3274139640",
    brief:
      "[TRAINING] Case 05: place-first nomination of a kastom/tabu site. Answer the VU kastom prompt as yes, do not expose exact coordinates in the task, add sensitivity notes, and handle the location as restricted.",
    expectedOutcome:
      "Park or submit only with culturally_sensitive=yes, restricted-location handling, and a reviewer-facing sensitivity note; do not publish exact coordinates from the source.",
    reviewerChecks: [
      "The kastom answer is yes and the item is deferred or restricted as appropriate.",
      "The location is described at containing-area level rather than exact point level.",
      "The note explains why the source location should remain restricted.",
    ],
    skillTests: ["kastom prompt", "sensitivity notes", "restricted-location handling"],
    sourceContext: {
      origin: "training_seed",
      nomination_mode: "place_first",
      culturally_sensitive_expected_answer: "yes",
      restricted_location: true,
      location_handling: "exact source coordinates withheld from seeded task geometry",
      source_dataset_id: "osm-vu-place-of-worship",
      source_locator: "node/3274139640",
      osm: {
        object_type: "node",
        object_id: 3274139640,
        url: "https://www.openstreetmap.org/node/3274139640",
        retrieved_at: "2026-06-13T05:19:31Z",
        attribution: "OpenStreetMap contributors, ODbL 1.0",
      },
    },
    automatedChecks: [
      {
        check_id: "vu_kastom_gate",
        severity: "warning",
        message: "TRAINING: kastom/tabu site. Use restricted-location handling and do not expose exact coordinates.",
        suggested_action: "defer_cultural_or_restrict_location",
      },
    ],
  },
  {
    caseNumber: 6,
    taskId: "training:vu:guy-vu-training-001:case-06",
    title: "Melsisi/Pentecost source-first claims",
    taskType: "denomination_or_shared_use",
    priority: "medium",
    locality: "Pentecost, Penama",
    geometry: point(167.2264093, -15.516715),
    matchedOsmId: "6127292188",
    osmObjectType: "node",
    sourceRecordId: "osm-vu-place-of-worship#pentecost-directory-set",
    brief:
      "[TRAINING] Case 06: source-first exercise. Use one reusable source record for three Pentecost-area claims, then give each claim its own locator: Pentecost church, Banban transfiguration parish, and Banan Apostolic Church.",
    expectedOutcome:
      "Submit or save evidence that reuses one source record while keeping separate per-claim locators for the three named places.",
    reviewerChecks: [
      "The source record is reused rather than duplicated three times.",
      "Each claim has a distinct locator, such as node/6127292188, node/6130105572, and node/6130106885.",
      "The RA does not merge the three named places into one site.",
    ],
    skillTests: ["source record reuse", "per-claim locators"],
    sourceContext: {
      origin: "training_seed",
      source_mode: "source_first",
      source_dataset_id: "osm-vu-place-of-worship",
      source_record: {
        title: "OpenStreetMap Vanuatu place-of-worship extract, Pentecost-area records",
        manifest: "archive/osm-vu-pow/pow_vu_manifest.json",
        retrieved_at: "2026-06-13T05:19:31Z",
        attribution: "OpenStreetMap contributors, ODbL 1.0",
      },
      per_claim_locators: [
        { locator: "node/6127292188", name: "Pentecost church" },
        { locator: "node/6130105572", name: "Banban transfiguration parish" },
        { locator: "node/6130106885", name: "Banan Apostolic Church" },
      ],
    },
  },
  {
    caseNumber: 7,
    taskId: "training:vu:guy-vu-training-001:case-07",
    title: "Torba regional-only claim",
    taskType: "geometry_check",
    priority: "medium",
    locality: "Torba",
    geometry: null,
    candidateSiteId: "candidate:vu:guy-vu-training-001:case-07",
    sourceRecordId: "vbos-2020-census-basic-tables-t3-5#torba",
    brief:
      "[TRAINING] Case 07: regional-only claim. The source supports a Vanuatu religious-affiliation fact at Torba province level, not a precise site coordinate. Use containing-area and geocoding-basis wording rather than inventing a point.",
    expectedOutcome:
      "Park or save a regional-only claim with containing_area=Torba and geocoding_basis=regional_only; do not create fake coordinates.",
    reviewerChecks: [
      "The claim names Torba as the containing area.",
      "The geocoding basis is regional_only or equivalent.",
      "No invented point geometry is submitted.",
    ],
    skillTests: ["containing-area rule", "geocoding basis"],
    sourceContext: {
      origin: "training_seed",
      source_dataset_id: "vbos-2020-census-basic-tables-t3-5",
      source_record: {
        title: "2020 Vanuatu National Population and Housing Census, Basic Tables Volume 1, Table 3.5",
        url: "https://www.spc.int/digitallibrary/get/2dwwa",
        local_source_metadata: "apps/regions/vu/data/source/sources.csv",
      },
      containing_area: "Torba",
      geocoding_basis: "regional_only",
    },
  },
  {
    caseNumber: 8,
    taskId: "training:vu:guy-vu-training-001:case-08",
    title: "Presbyterian Church of Vanuatu bounded opening",
    taskType: "lifecycle_date_needed",
    priority: "medium",
    locality: "Vanuatu",
    geometry: null,
    candidateSiteId: "candidate:vu:guy-vu-training-001:case-08",
    sourceRecordId: "pcv-history#autonomy-1948",
    brief:
      "[TRAINING] Case 08: bounded date claim. Use the Presbyterian Church of Vanuatu history as a denomination-level source that brackets opening or autonomy, then record notEarlierThan/notLaterThan-style reasoning and confidence rather than an over-precise date.",
    expectedOutcome:
      "Save lifecycle evidence with bounded date reasoning and medium or low confidence; do not claim a precise site opening date.",
    reviewerChecks: [
      "The date claim is bracketed rather than over-precise.",
      "The confidence matches the source's level of specificity.",
      "The RA separates denomination-level history from a specific site opening.",
    ],
    skillTests: ["notEarlierThan/notLaterThan", "date confidence"],
    sourceContext: {
      origin: "training_seed",
      source_record: {
        title: "Presbyterian Church of Vanuatu history",
        url: "https://en.wikipedia.org/wiki/Presbyterian_Church_of_Vanuatu",
        expected_date_handling: {
          not_earlier_than: "1838",
          not_later_than: "1948",
          confidence: "low",
        },
      },
    },
  },
  {
    caseNumber: 9,
    taskId: "training:vu:guy-vu-training-001:case-09",
    title: "Revision exercise for case 01",
    taskType: "other",
    priority: "high",
    locality: "Port Vila, Shefa",
    geometry: point(168.3151582, -17.7346446),
    sourceRecordId: "training:guy-vu-training-001:case-01-revision",
    brief:
      "[TRAINING] Case 09: revision exercise. JB will request changes on Case 01 after the first submission. Use the feedback loop to start a new editable revision of Case 01's submitted draft, address the requested changes, and resubmit the new version.",
    expectedOutcome:
      "No independent site evidence is needed for this placeholder task. The real outcome is a revised, newly versioned draft on Case 01 after JB requests changes.",
    reviewerChecks: [
      "The submitted Case 01 draft remains immutable.",
      "The RA creates a new draft version for the revision.",
      "The task moves from changes_requested back to in_progress when revision starts.",
    ],
    skillTests: ["revise-and-resubmit", "feedback loop"],
    sourceContext: {
      origin: "training_seed",
      revision_exercise: true,
      revises_training_task_id: "training:vu:guy-vu-training-001:case-01",
    },
  },
  {
    caseNumber: 10,
    taskId: "training:vu:guy-vu-training-001:case-10",
    title: "Melanesian Brotherhood incomplete lead",
    taskType: "other",
    priority: "low",
    locality: "Sanma",
    geometry: point(167.0888468, -15.1776588),
    matchedOsmId: "6302682297",
    osmObjectType: "node",
    sourceRecordId: "osm-vu-place-of-worship#node/6302682297",
    brief:
      "[TRAINING] Case 10: unresolved note. The OSM source has a useful lead, Melanesian brotherhood, but the record lacks enough site-specific worship-use evidence. Preserve the lead without forcing a completed submission.",
    expectedOutcome:
      "Submit an unresolved note or saved draft that preserves the lead and states what evidence is missing.",
    reviewerChecks: [
      "The RA does not force a clean site submission from incomplete evidence.",
      "The unresolved note identifies the missing source or identity details.",
      "The lead remains findable for later follow-up.",
    ],
    skillTests: ["parking evidence", "not forcing submission"],
    sourceContext: {
      origin: "training_seed",
      source_dataset_id: "osm-vu-place-of-worship",
      osm: {
        object_type: "node",
        object_id: 6302682297,
        url: "https://www.openstreetmap.org/node/6302682297",
        retrieved_at: "2026-06-13T05:19:31Z",
        attribution: "OpenStreetMap contributors, ODbL 1.0",
      },
    },
  },
] as const;

async function getSeedActor(ctx: MutationCtx, userId: Id<"users"> | undefined): Promise<Doc<"users">> {
  if (userId !== undefined) {
    const user = await ctx.db.get(userId);
    if (user === null || user.status !== "active" || !canReview(user.roles)) {
      throw new Error("Training seed actor must be an active reviewer, curator, admin, or service user.");
    }
    return user;
  }

  const users = await ctx.db
    .query("users")
    .withIndex("by_status", (q) => q.eq("status", "active"))
    .take(200);
  for (const user of users) {
    if (canReview(user.roles)) {
      return user;
    }
  }
  throw new Error("No active reviewer, curator, admin, or service user exists for training seed attribution.");
}

function assertTrainingCaseLimits(trainingCase: TrainingCase): void {
  assertMaxString("training task id", trainingCase.taskId, MEDIUM_TEXT_MAX);
  assertMaxString("training task title", `[TRAINING] Case ${trainingCase.caseNumber}: ${trainingCase.title}`, TASK_NAME_MAX);
  assertMaxString("training source record id", trainingCase.sourceRecordId, MEDIUM_TEXT_MAX);
  assertMaxString("training task brief", trainingCase.brief, TASK_BRIEF_MAX);
  for (const check of trainingCase.automatedChecks ?? []) {
    assertMaxString("training automated check id", check.check_id, MEDIUM_TEXT_MAX);
    assertMaxString("training automated check message", check.message, TASK_BRIEF_MAX);
  }
}

function skippedTaskIds(): string[] {
  const taskIds = [];
  for (const trainingCase of TRAINING_CASES) {
    taskIds.push(trainingCase.taskId);
  }
  return taskIds;
}

export const seedGuyTrainingWorkpack = internalMutation({
  args: {
    createdByUserId: v.optional(v.id("users")),
  },
  returns: v.object({
    batch_id: v.string(),
    source_kind: v.literal("manual_curator"),
    created: v.boolean(),
    skipped: v.boolean(),
    skipped_reason: v.optional(v.string()),
    tasks_inserted: v.number(),
    events_inserted: v.number(),
    skipped_task_ids: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const existingBatch = await ctx.db
      .query("task_batches")
      .withIndex("by_batch_id", (q) => q.eq("batch_id", TRAINING_BATCH_ID))
      .unique();
    if (existingBatch !== null) {
      return {
        batch_id: TRAINING_BATCH_ID,
        source_kind: "manual_curator" as const,
        created: false,
        skipped: true,
        skipped_reason: "batch_exists",
        tasks_inserted: 0,
        events_inserted: 0,
        skipped_task_ids: skippedTaskIds(),
      };
    }

    for (const trainingCase of TRAINING_CASES) {
      assertTrainingCaseLimits(trainingCase);
      const existingTask = await ctx.db
        .query("tasks")
        .withIndex("by_task_id", (q) => q.eq("task_id", trainingCase.taskId))
        .unique();
      if (existingTask !== null) {
        throw new Error(`Training task id already exists outside batch ${TRAINING_BATCH_ID}: ${trainingCase.taskId}`);
      }
    }

    const actor = await getSeedActor(ctx, args.createdByUserId);
    const actorRole = chooseActorRole(actor, ["service", "admin", "curator", "reviewer"]);
    const now = Date.now();
    const batchNotes = "TRAINING batch for Guy's Vanuatu RA workpack. Exclude every task in this batch from exports.";
    assertMaxString("training batch notes", batchNotes, TASK_BRIEF_MAX);

    await ctx.db.insert("task_batches", {
      batch_id: TRAINING_BATCH_ID,
      country_code: "VU",
      source_kind: "manual_curator",
      source_manifest_id: "archive/osm-vu-pow/pow_vu_manifest.json",
      target_years: TARGET_YEARS,
      status: "active",
      created_by: actor._id,
      created_at: now,
      updated_at: now,
      notes: batchNotes,
    });

    let tasksInserted = 0;
    let eventsInserted = 0;
    for (const trainingCase of TRAINING_CASES) {
      const taskName = `[TRAINING] Case ${trainingCase.caseNumber}: ${trainingCase.title}`;
      const automatedChecks = [
        {
          check_id: "training_case",
          severity: "info",
          message: `TRAINING case ${trainingCase.caseNumber}. Exclude this task from exports.`,
          suggested_action: "review_training_expectations",
        },
        ...(trainingCase.automatedChecks ?? []),
      ];
      await ctx.db.insert("tasks", {
        task_id: trainingCase.taskId,
        batch_id: TRAINING_BATCH_ID,
        country_code: "VU",
        task_type: trainingCase.taskType,
        priority: trainingCase.priority,
        status: "open",
        target_years: TARGET_YEARS,
        matched_current_site_id: trainingCase.matchedOsmId === undefined
          ? undefined
          : `osm:${trainingCase.osmObjectType}/${trainingCase.matchedOsmId}`,
        candidate_site_id: trainingCase.candidateSiteId,
        source_record_id: trainingCase.sourceRecordId,
        matched_osm_id: trainingCase.matchedOsmId,
        osm_object_type: trainingCase.osmObjectType,
        name: taskName,
        locality: trainingCase.locality,
        geometry: trainingCase.geometry,
        nearby_site_refs: [],
        automated_checks: automatedChecks,
        task_brief: trainingCase.brief,
        source_context: {
          ...trainingCase.sourceContext,
          training: {
            batch_id: TRAINING_BATCH_ID,
            case_number: trainingCase.caseNumber,
            expected_outcome: trainingCase.expectedOutcome,
            reviewer_checks: trainingCase.reviewerChecks,
            skill_tests: trainingCase.skillTests,
            exclude_from_exports: true,
          },
        },
        created_at: now,
        updated_at: now,
        last_event_at: now,
      });
      await appendTaskEvent(ctx, {
        taskId: trainingCase.taskId,
        eventType: "imported",
        actorUserId: actor._id,
        actorRole,
        newStatus: "open",
        reason: `Seeded TRAINING case ${trainingCase.caseNumber} in ${TRAINING_BATCH_ID}; exclude from exports.`,
      });
      tasksInserted += 1;
      eventsInserted += 1;
    }

    return {
      batch_id: TRAINING_BATCH_ID,
      source_kind: "manual_curator" as const,
      created: true,
      skipped: false,
      tasks_inserted: tasksInserted,
      events_inserted: eventsInserted,
      skipped_task_ids: [],
    };
  },
});
