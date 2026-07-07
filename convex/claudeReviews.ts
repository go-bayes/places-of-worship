import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { agentSourceCheck } from "./model";
import { requireUser } from "./lib/auth";
import {
  LONG_TEXT_MAX,
  VALIDATION_SUMMARY_MAX,
  assertMaxJson,
  assertMaxString,
} from "./lib/limits";
import { appendTaskEvent } from "./lib/taskEvents";

// Claude batch-review lane (docs/portal-claude-batch-review.md).
// Boundary: humans decide; Claude recommends. Nothing in this module
// changes a task status, an evidence draft, or a review decision — it
// only appends agent_reviews artifacts, batch manifests, and audit
// events. The runner is an INTERNAL action: callable with the
// deployment admin key (CLI, dashboard, cron) only, never from the
// public API, so unauthenticated callers cannot trigger model spend.

declare const process: {
  env: Record<string, string | undefined>;
};

// prompt contract version: bump when the prompts or check semantics
// change, so idempotency re-opens and artifacts date themselves
const PROMPT_VERSION = "claude-batch-review-v1";
const AGENT_NAME = "claude-batch-reviewer";
const MODEL_PROVIDER = "anthropic";
// model routing per the documented cost/capability policy: cheap model
// reads fetched sources; a stronger model synthesises the recommendation
const SOURCE_CHECK_MODEL = "claude-haiku-4-5-20251001";
const SYNTHESIS_MODEL = "claude-sonnet-5";
const SERVICE_USER_EMAIL = "claude-batch-reviewer@service.local";
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
// source pages get a short leash; model calls a longer one
const FETCH_TIMEOUT_MS = 10_000;
const MODEL_TIMEOUT_MS = 60_000;
const FETCH_TEXT_MAX = 20_000;
const FETCH_MAX_REDIRECTS = 3;
// a worst-case item costs up to four fetch hops plus two model calls
// (~2.7 min); the deadline below is checked between items, so the
// budget must leave room for one full worst-case item inside Convex's
// 10-minute action cap (7 + 2.7 = 9.7 min, ~20 s spare for closeBatch).
// idempotent re-runs continue the remaining queue.
const DEFAULT_MAX_ITEMS = 10;
const HARD_MAX_ITEMS = 50;
const BATCH_DEADLINE_MS = 7 * 60 * 1000;
// clamps keep three check records well under VALIDATION_SUMMARY_MAX
// even for maximum-length titles and urls
const CHECK_TITLE_MAX = 300;
const CHECK_URL_MAX = 500;
const ERROR_NOTES_MAX = 20;

type SourceCheckName = "existence" | "date_support" | "location_plausibility";

type SourceCheckResult = {
  source_title?: string;
  url_or_file?: string;
  check: SourceCheckName;
  method: "http_fetch" | "model_assessment" | "not_checked";
  outcome: "supported" | "not_supported" | "unclear" | "unreachable" | "requires_human_access";
  note?: string;
};

type Recommendation = "accept" | "revise" | "reject" | "defer_cultural";

// ---------------------------------------------------------------------------
// service identity

export const ensureServiceUser = internalMutation({
  args: {},
  returns: v.id("users"),
  handler: async (ctx): Promise<Id<"users">> => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", SERVICE_USER_EMAIL))
      .unique();
    if (existing !== null) {
      return existing._id;
    }
    const now = Date.now();
    // service role only: cannot sign in (no auth_subject) and cannot
    // submit as a human author, per the ratified role table
    return await ctx.db.insert("users", {
      email: SERVICE_USER_EMAIL,
      display_name: "Claude batch reviewer",
      initials: "AI",
      roles: ["service"],
      status: "active",
      created_at: now,
      updated_at: now,
    });
  },
});

// ---------------------------------------------------------------------------
// queue selection

function latestReviewableDraft(drafts: Doc<"evidence_drafts">[]): Doc<"evidence_drafts"> | null {
  const ordered = drafts.slice().sort((a, b) => b.updated_at - a.updated_at);
  return ordered.find((draft) => draft.draft_status === "submitted")
    ?? ordered.find((draft) => draft.draft_status === "unresolved_note")
    ?? null;
}

export const pendingForBatch = internalQuery({
  args: {
    countryCode: v.optional(v.string()),
    promptVersion: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({ task: v.any(), draft: v.any(), alreadyReviewed: v.boolean() }),
  ),
  handler: async (ctx, args) => {
    // modest scan ceiling: each task costs three indexed sub-queries,
    // and Convex bounds reads per transaction
    const limit = Math.min(Math.max(args.limit ?? 200, 1), 200);
    let tasks: Doc<"tasks">[];
    if (args.countryCode !== undefined) {
      const countryCode = args.countryCode;
      tasks = await ctx.db
        .query("tasks")
        .withIndex("by_country_status", (q) => q.eq("country_code", countryCode).eq("status", "needs_review"))
        .take(limit);
    } else {
      tasks = await ctx.db
        .query("tasks")
        .withIndex("by_status_priority", (q) => q.eq("status", "needs_review"))
        .take(limit);
    }

    const rows = [];
    for (const task of tasks) {
      // newest-first so a heavily revised task cannot push its latest
      // draft past the take() window
      const submitted = await ctx.db
        .query("evidence_drafts")
        .withIndex("by_task_status", (q) => q.eq("task_id", task.task_id).eq("draft_status", "submitted"))
        .order("desc")
        .take(25);
      const unresolved = await ctx.db
        .query("evidence_drafts")
        .withIndex("by_task_status", (q) => q.eq("task_id", task.task_id).eq("draft_status", "unresolved_note"))
        .order("desc")
        .take(25);
      const draft = latestReviewableDraft([...submitted, ...unresolved]);
      if (draft === null) {
        continue;
      }
      const priorForDraft = await ctx.db
        .query("agent_reviews")
        .withIndex("by_draft", (q) => q.eq("evidence_draft_id", draft.evidence_draft_id))
        .take(100);
      const alreadyReviewed = priorForDraft.some(
        (artifact) => artifact.prompt_version === args.promptVersion,
      );
      rows.push({ task, draft, alreadyReviewed });
    }
    return rows;
  },
});

// ---------------------------------------------------------------------------
// batch manifest

export const openBatch = internalMutation({
  args: {
    batchId: v.string(),
    trigger: v.union(v.literal("jb_cli"), v.literal("cron")),
    countryCode: v.optional(v.string()),
    maxItems: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("agent_review_batches", {
      batch_id: args.batchId,
      trigger: args.trigger,
      country_code: args.countryCode,
      prompt_version: PROMPT_VERSION,
      model_name: SYNTHESIS_MODEL,
      source_check_model: SOURCE_CHECK_MODEL,
      max_items: args.maxItems,
      status: "running",
      reviewed_count: 0,
      skipped_existing_count: 0,
      deferred_cultural_count: 0,
      failed_count: 0,
      started_at: Date.now(),
    });
    return null;
  },
});

export const closeBatch = internalMutation({
  args: {
    batchId: v.string(),
    status: v.union(v.literal("completed"), v.literal("failed")),
    reviewedCount: v.number(),
    skippedExistingCount: v.number(),
    deferredCulturalCount: v.number(),
    failedCount: v.number(),
    errorNotes: v.optional(v.array(v.string())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const batch = await ctx.db
      .query("agent_review_batches")
      .withIndex("by_batch_id", (q) => q.eq("batch_id", args.batchId))
      .unique();
    if (batch === null) {
      throw new Error(`Batch not found: ${args.batchId}`);
    }
    await ctx.db.patch(batch._id, {
      status: args.status,
      reviewed_count: args.reviewedCount,
      skipped_existing_count: args.skippedExistingCount,
      deferred_cultural_count: args.deferredCulturalCount,
      failed_count: args.failedCount,
      error_notes: args.errorNotes,
      completed_at: Date.now(),
    });
    return null;
  },
});

// ---------------------------------------------------------------------------
// artifact writes

export const recordArtifact = internalMutation({
  args: {
    taskId: v.string(),
    evidenceDraftId: v.string(),
    batchId: v.string(),
    recommendation: v.union(
      v.literal("accept"),
      v.literal("revise"),
      v.literal("reject"),
      v.literal("defer_cultural"),
    ),
    reasoning: v.string(),
    sourcesChecked: v.array(agentSourceCheck),
    culturalSensitivity: v.object({
      flagged: v.boolean(),
      basis: v.optional(v.string()),
    }),
    serviceUserId: v.id("users"),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    assertMaxString("agent review reasoning", args.reasoning, LONG_TEXT_MAX);
    assertMaxJson("agent review source checks", args.sourcesChecked, VALIDATION_SUMMARY_MAX);

    const prior = await ctx.db
      .query("agent_reviews")
      .withIndex("by_task", (q) => q.eq("task_id", args.taskId))
      .collect();
    const now = Date.now();
    const agentReviewId = `${args.taskId}:agent-review:${now}:${prior.length + 1}`;

    await ctx.db.insert("agent_reviews", {
      agent_review_id: agentReviewId,
      task_id: args.taskId,
      evidence_draft_id: args.evidenceDraftId,
      batch_id: args.batchId,
      version: prior.length + 1,
      recommendation: args.recommendation,
      reasoning: args.reasoning,
      sources_checked: args.sourcesChecked,
      cultural_sensitivity: args.culturalSensitivity,
      agent_name: AGENT_NAME,
      model_provider: MODEL_PROVIDER,
      model_name: SYNTHESIS_MODEL,
      source_check_model: SOURCE_CHECK_MODEL,
      prompt_version: PROMPT_VERSION,
      actor_user_id: args.serviceUserId,
      ai_generated: true,
      created_at: now,
    });

    // audit trail only: the task status is deliberately not touched
    await appendTaskEvent(ctx, {
      taskId: args.taskId,
      eventType: "note_added",
      actorUserId: args.serviceUserId,
      actorRole: "service",
      reason: `Claude batch review recorded recommendation: ${args.recommendation}.`,
      evidenceDraftId: args.evidenceDraftId,
      clientContext: { agent_review_id: agentReviewId, batch_id: args.batchId },
    });

    return agentReviewId;
  },
});

// ---------------------------------------------------------------------------
// reviewer-facing reads

export const listAgentReviewsForTask = query({
  args: {
    taskId: v.string(),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    await requireUser(ctx, ["reviewer", "curator", "admin"]);
    const artifacts = await ctx.db
      .query("agent_reviews")
      .withIndex("by_task", (q) => q.eq("task_id", args.taskId))
      .collect();
    return artifacts.sort((left, right) => right.created_at - left.created_at);
  },
});

// ---------------------------------------------------------------------------
// kastom / cultural-sensitivity gate

// flagged items get source checks only; the recommendation is forced to
// defer_cultural and the synthesis model never judges the cultural claim
function culturalSensitivityFor(
  task: { country_code: string },
  draft: { privacy_flag: string; generated_wide_row?: unknown },
): { flagged: boolean; basis?: string } {
  if (draft.privacy_flag !== "clear") {
    return { flagged: true, basis: `Evidence privacy flag is ${draft.privacy_flag}.` };
  }
  const wideRow = draft.generated_wide_row as Record<string, unknown> | undefined;
  if (wideRow && (wideRow["culturally_sensitive"] === true || wideRow["culturallySensitive"] === true)) {
    return { flagged: true, basis: "Evidence carries an explicit cultural-sensitivity flag." };
  }
  if (task.country_code === "VU") {
    return {
      flagged: true,
      basis:
        "Vanuatu country default: kastom-flagged items defer to human cultural judgement until the per-record sensitivity flag is bound.",
    };
  }
  return { flagged: false };
}

// ---------------------------------------------------------------------------
// source fetching and model calls

async function fetchWithTimeout(url: string, init?: RequestInit, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  // abort the losing fetch and clear the timer: a hung request must not
  // keep consuming the action after the race resolves
  const controller = typeof AbortController === "undefined" ? undefined : new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fetch(url, { redirect: "manual", ...init, signal: controller?.signal }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller?.abort();
          reject(new Error("Fetch timed out."));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

// contributor-controlled URLs are fetched server-side, so private and
// local hosts are refused at every redirect hop (SSRF guard). Hostname
// checks cannot see DNS answers, so a hostile domain pointing at a
// private IP remains a residual risk — bounded, because the output is
// an advisory artifact a human reads.
function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.)/.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  if (host === "::1" || /^(fc|fd|fe8)/.test(host)) return true;
  return false;
}

// fetch with the redirect chain walked manually so every hop is
// checked against the private-host block, capped at FETCH_MAX_REDIRECTS
async function fetchPublicUrl(rawUrl: string): Promise<Response> {
  let current = rawUrl;
  for (let hop = 0; hop <= FETCH_MAX_REDIRECTS; hop += 1) {
    const parsed = new URL(current);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Only HTTP(S) sources are fetched.");
    }
    if (isBlockedHost(parsed.hostname)) {
      throw new Error("Source URL resolves to a private or local host; not fetched.");
    }
    const response = await fetchWithTimeout(current);
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (location === null) return response;
      current = new URL(location, current).toString();
      continue;
    }
    return response;
  }
  throw new Error("Too many redirects while fetching the source URL.");
}

// crude tag strip: enough for a model to read page text; not a parser
function stripHtml(text: string): string {
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clampNote(note: unknown): string | undefined {
  if (typeof note !== "string" || note.trim() === "") return undefined;
  return note.trim().slice(0, 500);
}

function clampField(value: string | undefined, max: number): string | undefined {
  return value === undefined ? undefined : value.slice(0, max);
}

// one structured-output call to the Anthropic API; the forced tool
// schema makes the result machine-readable without free-text parsing
async function callClaude(args: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  toolName: string;
  toolDescription: string;
  toolSchema: Record<string, unknown>;
  maxTokens: number;
}): Promise<Record<string, unknown>> {
  const response = await fetchWithTimeout(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": args.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: args.model,
      max_tokens: args.maxTokens,
      // structured mechanical calls: adaptive thinking would spend
      // inside max_tokens and can truncate the forced tool output
      thinking: { type: "disabled" },
      system: args.system,
      messages: [{ role: "user", content: args.user }],
      tools: [
        {
          name: args.toolName,
          description: args.toolDescription,
          input_schema: args.toolSchema,
        },
      ],
      tool_choice: { type: "tool", name: args.toolName },
    }),
  }, MODEL_TIMEOUT_MS);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic API ${response.status}: ${body.slice(0, 300)}`);
  }
  const payload = (await response.json()) as {
    content?: { type: string; input?: Record<string, unknown> }[];
  };
  const toolUse = payload.content?.find((block) => block.type === "tool_use");
  if (toolUse?.input === undefined) {
    throw new Error("Anthropic API response carried no tool output.");
  }
  return toolUse.input;
}

const CHECK_NAMES: SourceCheckName[] = ["existence", "date_support", "location_plausibility"];

function claimSummary(task: Doc<"tasks">, draft: Doc<"evidence_drafts">): string {
  return JSON.stringify(
    {
      site_name: task.name,
      country: task.country_code,
      address: task.address,
      locality: task.locality,
      task_type: task.task_type,
      task_brief: task.task_brief?.slice(0, 600),
      source_title: draft.source_title,
      source_type: draft.source_type,
      source_url_or_file: draft.source_url_or_file,
      source_date: draft.source_date_or_capture_date,
      address_found: draft.address_raw,
      locality_found: draft.locality_raw,
      existence_status: draft.existence_status,
      worship_use_status: draft.worship_use_status,
      assessment_confidence: draft.assessment_confidence,
      target_year_statuses: draft.target_year_statuses,
      lifecycle_event: draft.lifecycle_event,
      lifecycle_date: draft.lifecycle_date,
      evidence_note: draft.evidence_note?.slice(0, 1_200),
      source_notes: draft.source_notes?.slice(0, 1_200),
      draft_status: draft.draft_status,
      unresolved: draft.draft_status === "unresolved_note",
    },
    null,
    2,
  );
}

// runs the per-source verification for the draft's primary source and
// records what was actually possible: fetched and read, unreachable, or
// requiring human archive access. Never claims a check that did not run.
async function checkSources(
  apiKey: string,
  task: Doc<"tasks">,
  draft: Doc<"evidence_drafts">,
): Promise<SourceCheckResult[]> {
  // fetch uses the full url; the stored check records carry clamped
  // copies so three records stay well under the artifact's JSON limit
  const rawUrl = draft.source_url_or_file;
  const title = clampField(draft.source_title, CHECK_TITLE_MAX);
  const urlOrFile = clampField(rawUrl, CHECK_URL_MAX);

  // privacy-flagged evidence never leaves the deployment: no fetch, no
  // model call — the artifact records that the check was withheld
  if (draft.privacy_flag !== "clear") {
    return [
      {
        source_title: title,
        url_or_file: urlOrFile,
        check: "existence",
        method: "not_checked",
        outcome: "requires_human_access",
        note: `Evidence carries privacy flag ${draft.privacy_flag}; its content is not sent to external services. Verify sources manually.`,
      },
    ];
  }

  if (!rawUrl || !/^https?:\/\//i.test(rawUrl)) {
    return [
      {
        source_title: title,
        url_or_file: urlOrFile,
        check: "existence",
        method: "not_checked",
        outcome: "requires_human_access",
        note: rawUrl
          ? "Source locator is not a fetchable URL; verify from the file or archive reference."
          : "No source URL or file recorded; verify offline.",
      },
    ];
  }

  let pageText: string | null = null;
  let fetchNote = "";
  try {
    const response = await fetchPublicUrl(rawUrl);
    if (!response.ok) {
      fetchNote = `HTTP ${response.status} when fetching the source URL.`;
    } else {
      const raw = await response.text();
      pageText = stripHtml(raw).slice(0, FETCH_TEXT_MAX);
      if (pageText.length === 0) {
        pageText = null;
        fetchNote = "The source URL returned no readable text.";
      }
    }
  } catch (error) {
    fetchNote = `Source URL could not be fetched: ${error instanceof Error ? error.message : "unknown error"}`;
  }

  if (pageText === null) {
    return [
      {
        source_title: title,
        url_or_file: urlOrFile,
        check: "existence",
        method: "http_fetch",
        outcome: "unreachable",
        note: fetchNote,
      },
      ...(["date_support", "location_plausibility"] as const).map((check) => ({
        source_title: title,
        url_or_file: urlOrFile,
        check,
        method: "not_checked" as const,
        outcome: "requires_human_access" as const,
        note: "Not assessed because the source was unreachable.",
      })),
    ];
  }

  const judged = await callClaude({
    apiKey,
    model: SOURCE_CHECK_MODEL,
    system:
      "You verify whether a fetched web source supports a claim about a place of worship. " +
      "Judge only from the provided page text. Do not use outside knowledge. " +
      "existence: does the page mention this site (or the organisation) at all? " +
      "date_support: does the page support the claimed dates or target-year statuses? " +
      "location_plausibility: is the claimed address or locality consistent with the page? " +
      "Answer unclear when the text does not settle the question.",
    user:
      `Claim under review:\n${claimSummary(task, draft)}\n\n` +
      `Fetched page text (truncated):\n${pageText}`,
    toolName: "record_source_checks",
    toolDescription: "Record the outcome of each source check.",
    toolSchema: {
      type: "object",
      properties: {
        checks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              check: { type: "string", enum: CHECK_NAMES },
              outcome: { type: "string", enum: ["supported", "not_supported", "unclear"] },
              note: { type: "string", description: "One or two sentences of specifics from the page." },
            },
            required: ["check", "outcome"],
          },
        },
      },
      required: ["checks"],
    },
    maxTokens: 1_000,
  });

  const judgedChecks = Array.isArray(judged["checks"]) ? (judged["checks"] as unknown[]) : [];
  return CHECK_NAMES.map((check) => {
    const match = judgedChecks.find(
      (entry) => typeof entry === "object" && entry !== null && (entry as { check?: unknown }).check === check,
    ) as { outcome?: unknown; note?: unknown } | undefined;
    const outcome =
      match?.outcome === "supported" || match?.outcome === "not_supported" || match?.outcome === "unclear"
        ? match.outcome
        : "unclear";
    return {
      source_title: title,
      url_or_file: urlOrFile,
      check,
      method: "http_fetch" as const,
      outcome,
      note: clampNote(match?.note) ?? "The model returned no note for this check.",
    };
  });
}

// synthesis: weigh the recorded checks and the draft into an advisory
// recommendation. The prompt binds the model to the recorded checks so
// reasoning cannot assert verifications that never ran.
async function synthesiseRecommendation(
  apiKey: string,
  task: Doc<"tasks">,
  draft: Doc<"evidence_drafts">,
  checks: SourceCheckResult[],
): Promise<{ recommendation: Recommendation; reasoning: string }> {
  const result = await callClaude({
    apiKey,
    model: SYNTHESIS_MODEL,
    system:
      "You are an advisory reviewer for a places-of-worship evidence queue. A human reviewer " +
      "decides; you only recommend. Base your recommendation ONLY on the claim fields and the " +
      "recorded source-check results provided. Never assert that a source was verified unless a " +
      "recorded check says so. Recommend accept when the sources support the claim as submitted; " +
      "revise when the claim is plausible but the evidence is incomplete, unclear, or unverifiable " +
      "as recorded; reject when the evidence contradicts the claim, cites the wrong site, or is " +
      "unsupported. Cite the specific checks and fields your recommendation rests on. Keep the " +
      "reasoning under 300 words, plain prose.",
    user:
      `Claim under review:\n${claimSummary(task, draft)}\n\n` +
      `Recorded source checks:\n${JSON.stringify(checks, null, 2)}`,
    toolName: "record_recommendation",
    toolDescription: "Record the advisory review recommendation.",
    toolSchema: {
      type: "object",
      properties: {
        recommendation: { type: "string", enum: ["accept", "revise", "reject"] },
        reasoning: { type: "string" },
      },
      required: ["recommendation", "reasoning"],
    },
    maxTokens: 1_500,
  });

  const recommendation =
    result["recommendation"] === "accept" || result["recommendation"] === "reject"
      ? result["recommendation"]
      : "revise";
  let reasoning = typeof result["reasoning"] === "string" && result["reasoning"].trim() !== ""
    ? result["reasoning"].trim()
    : "The model returned no reasoning; treat this artifact as revise-by-default.";
  if (reasoning.length > LONG_TEXT_MAX - 100) {
    reasoning = `${reasoning.slice(0, LONG_TEXT_MAX - 100)} [truncated at the storage limit]`;
  }
  return { recommendation, reasoning };
}

function deferCulturalReasoning(basis: string | undefined, checks: SourceCheckResult[]): string {
  const checkSummary = checks
    .map((check) => `${check.check}: ${check.outcome}${check.note ? ` (${check.note})` : ""}`)
    .join("; ");
  const text =
    "This item is flagged as culturally sensitive, so the recommendation defers to human " +
    `cultural judgement. ${basis ?? ""} Claude checked sources only and made no judgement on ` +
    `the cultural claim itself. Source checks: ${checkSummary || "none possible."}`;
  return text.length > LONG_TEXT_MAX - 100 ? `${text.slice(0, LONG_TEXT_MAX - 100)} [truncated]` : text;
}

// ---------------------------------------------------------------------------
// the batch runner

export const runBatch = internalAction({
  args: {
    countryCode: v.optional(v.string()),
    maxItems: v.optional(v.number()),
    forceRerun: v.optional(v.boolean()),
    trigger: v.optional(v.union(v.literal("jb_cli"), v.literal("cron"))),
  },
  returns: v.object({
    batch_id: v.string(),
    reviewed: v.number(),
    skipped_existing: v.number(),
    deferred_cultural: v.number(),
    failed: v.number(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    batch_id: string;
    reviewed: number;
    skipped_existing: number;
    deferred_cultural: number;
    failed: number;
  }> => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey === undefined || apiKey.length < 20) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set on this deployment. Set it with `npx convex env set` before running a batch.",
      );
    }

    const maxItems = Math.min(Math.max(args.maxItems ?? DEFAULT_MAX_ITEMS, 1), HARD_MAX_ITEMS);
    const serviceUserId: Id<"users"> = await ctx.runMutation(
      internal.claudeReviews.ensureServiceUser,
      {},
    );

    const rows: { task: Doc<"tasks">; draft: Doc<"evidence_drafts">; alreadyReviewed: boolean }[] =
      await ctx.runQuery(internal.claudeReviews.pendingForBatch, {
        countryCode: args.countryCode,
        promptVersion: PROMPT_VERSION,
      });
    // queue-wide at scan time, not per-run: "how many of the current
    // queue already carry an artifact at this prompt version"
    const skippedExisting = args.forceRerun === true ? 0 : rows.filter((row) => row.alreadyReviewed).length;
    const pending = (args.forceRerun === true ? rows : rows.filter((row) => !row.alreadyReviewed)).slice(
      0,
      maxItems,
    );

    const batchId = `agent-review-batch:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    await ctx.runMutation(internal.claudeReviews.openBatch, {
      batchId,
      trigger: args.trigger ?? "jb_cli",
      countryCode: args.countryCode,
      maxItems,
    });

    let reviewed = 0;
    let deferredCultural = 0;
    let failed = 0;
    let attempted = 0;
    const errorNotes: string[] = [];
    const runStartedAt = Date.now();

    for (const { task, draft } of pending) {
      // stop starting items once the deadline passes, leaving budget
      // for the in-flight worst case plus closeBatch; idempotent
      // re-runs continue the remaining queue
      if (Date.now() - runStartedAt > BATCH_DEADLINE_MS) {
        if (errorNotes.length < ERROR_NOTES_MAX) {
          errorNotes.push(
            `deadline: stopped after ${attempted} of ${pending.length} items; re-run to continue the queue.`,
          );
        }
        break;
      }
      attempted += 1;
      try {
        const sensitivity = culturalSensitivityFor(task, draft);
        const checks = await checkSources(apiKey, task, draft);

        let recommendation: Recommendation;
        let reasoning: string;
        if (sensitivity.flagged) {
          recommendation = "defer_cultural";
          reasoning = deferCulturalReasoning(sensitivity.basis, checks);
          deferredCultural += 1;
        } else {
          const synthesis = await synthesiseRecommendation(apiKey, task, draft, checks);
          recommendation = synthesis.recommendation;
          reasoning = synthesis.reasoning;
        }

        await ctx.runMutation(internal.claudeReviews.recordArtifact, {
          taskId: task.task_id,
          evidenceDraftId: draft.evidence_draft_id,
          batchId,
          recommendation,
          reasoning,
          sourcesChecked: checks,
          culturalSensitivity: sensitivity,
          serviceUserId,
        });
        reviewed += 1;
      } catch (error) {
        failed += 1;
        if (errorNotes.length < ERROR_NOTES_MAX) {
          errorNotes.push(
            `${task.task_id}: ${error instanceof Error ? error.message.slice(0, 300) : "unknown error"}`,
          );
        }
      }
    }

    await ctx.runMutation(internal.claudeReviews.closeBatch, {
      batchId,
      status: "completed",
      reviewedCount: reviewed,
      skippedExistingCount: skippedExisting,
      deferredCulturalCount: deferredCultural,
      failedCount: failed,
      errorNotes: errorNotes.length > 0 ? errorNotes : undefined,
    });

    return {
      batch_id: batchId,
      reviewed,
      skipped_existing: skippedExisting,
      deferred_cultural: deferredCultural,
      failed,
    };
  },
});

// a cron entry is deliberately NOT registered: scheduling the batch is a
// JB decision (docs/portal-claude-batch-review.md, activation checklist).
// when taken, add convex/crons.ts with:
//   crons.daily("claude batch review", { hourUTC: 16, minuteUTC: 0 },
//     internal.claudeReviews.runBatch, { trigger: "cron" });
