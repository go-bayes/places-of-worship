import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireUser } from "./lib/auth";
import { appendTaskEvent } from "./lib/taskEvents";
import { canonicalJson, sha256 } from "./lib/sha256";
import { assertNoDuplicateJsonKeys, validateAgentReviewBundle } from "./lib/agentIntake";

declare const process: { env: Record<string, string | undefined> };

const SERVICE_EMAIL = "internal-agent-intake@service.local";

function enabled(): void {
  if (process.env.POW_INTERNAL_AGENT_INGEST_ENABLED !== "true") {
    throw new Error("Internal agent intake is disabled on this deployment.");
  }
}

export const ingestBundle = internalMutation({
  args: { bundleJson: v.string(), bundleHash: v.string() },
  returns: v.object({ receipt_id: v.string(), task_id: v.string(), evidence_draft_id: v.string(), agent_review_id: v.string(), created: v.boolean() }),
  handler: async (ctx, args) => {
    enabled();
    if (!/^[0-9a-f]{64}$/.test(args.bundleHash)) throw new Error("bundleHash must be 64 lowercase hex characters");
    let parsed: unknown;
    try { assertNoDuplicateJsonKeys(args.bundleJson); parsed = JSON.parse(args.bundleJson); } catch (error) { throw new Error(error instanceof Error ? error.message : "bundleJson must be valid JSON"); }
    const checked = validateAgentReviewBundle(parsed, args.bundleJson);
    if (checked.bundleHash !== args.bundleHash) throw new Error("bundleHash does not match bundleJson");
    const existing = await ctx.db.query("agent_intake_receipts").withIndex("by_submission_key", (q) => q.eq("submission_key", checked.bundle.submission_key)).unique();
    if (existing !== null) {
      if (existing.bundle_hash !== args.bundleHash) throw new Error("submission_key already exists with a different bundle hash");
      return { receipt_id: existing.receipt_id, task_id: existing.task_id, evidence_draft_id: existing.evidence_draft_id, agent_review_id: existing.agent_review_id, created: false };
    }
    const now = Date.now();
    let service = await ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", SERVICE_EMAIL)).unique();
    if (service === null) {
      const id = await ctx.db.insert("users", { email: SERVICE_EMAIL, display_name: "Internal agent intake", initials: "AI", roles: ["service"], status: "active", created_at: now, updated_at: now });
      service = await ctx.db.get(id);
    }
    if (service === null || service.status !== "active" || !service.roles.includes("service")) throw new Error("Intake identity must be an active service user");
    const taskId = `agent-research:${checked.bundle.submission_key}`;
    const draftId = `${taskId}:draft:1`;
    const reviewId = `${taskId}:review:1`;
    const receiptId = `${taskId}:receipt`;
    const dossier = checked.bundle.dossier;
    const firstClaim = dossier.claims[0];
    const location = dossier.candidate_location;
    const latitude = location.latitude ?? dossier.place.seed_latitude;
    const longitude = location.longitude ?? dossier.place.seed_longitude;
    const summary = dossier.claims.map((claim: any) => `${claim.claim_type}: ${claim.value} [${claim.source.locator}]`).join("\n").slice(0, 8000);
    await ctx.db.insert("tasks", {
      task_id: taskId, batch_id: "internal-agent-research", country_code: "NZ", task_type: "other", priority: "medium", status: "needs_review", target_years: [2013, 2018, 2023], name: dossier.place.name,
      source_record_id: dossier.place.place_ref, matched_osm_id: dossier.place.place_ref.startsWith("osm:") ? dossier.place.place_ref : undefined,
      geometry: { type: "Point", coordinates: [longitude, latitude] }, task_brief: "Internal agent research dossier awaiting human review; provisional only.",
      source_context: { origin: "internal_agent_research", bundle_hash: args.bundleHash, submission_key: checked.bundle.submission_key }, intake_submission_key: checked.bundle.submission_key,
      created_at: now, updated_at: now, last_event_at: now,
    });
    await ctx.db.insert("evidence_drafts", {
      evidence_draft_id: draftId, task_id: taskId, draft_status: "submitted", created_by: service._id, created_at: now, updated_at: now,
      source_type: firstClaim.source.source_type, source_title: firstClaim.source.source_name, source_url_or_file: firstClaim.source.locator, source_locator: firstClaim.source.locator,
      evidence_note: summary, privacy_flag: checked.bundle.review.cultural_sensitivity.flagged ? "needs_review" : "clear", licence_flag: "needs_review",
      validation_summary: { status: "internal_agent_intake", bundle_hash: args.bundleHash }, source_claim_key: checked.bundle.submission_key, claim_hash: args.bundleHash,
      agent_intake_only: true, agent_intake_hash: args.bundleHash,
    });
    const sourcesChecked = checked.bundle.review.claim_checks.map((check) => ({ source_title: check.claim_id, url_or_file: check.source_url, check: "existence" as const, method: "model_assessment" as const, outcome: check.outcome, note: check.note }));
    await ctx.db.insert("agent_reviews", {
      agent_review_id: reviewId, task_id: taskId, evidence_draft_id: draftId, batch_id: `internal-agent:${checked.bundle.submission_key}`, version: 1,
      recommendation: checked.bundle.review.recommendation, reasoning: checked.bundle.review.reasoning, sources_checked: sourcesChecked,
      cultural_sensitivity: checked.bundle.review.cultural_sensitivity, agent_name: `${checked.bundle.research_run.backend}+${checked.bundle.review_run.backend}-internal`, model_provider: checked.bundle.research_run.backend,
      model_name: checked.bundle.research_run.model_id_reported ?? checked.bundle.research_run.model_requested, source_check_model: checked.bundle.review_run.model_id_reported ?? checked.bundle.review_run.model_requested,
      prompt_version: "agent-review-bundle.v1", actor_user_id: service._id, ai_generated: true, created_at: now,
    });
    await ctx.db.insert("agent_intake_receipts", { receipt_id: receiptId, submission_key: checked.bundle.submission_key, bundle_hash: args.bundleHash, bundle_json: args.bundleJson, task_id: taskId, evidence_draft_id: draftId, agent_review_id: reviewId, created_at: now });
    await appendTaskEvent(ctx, { taskId, eventType: "imported", actorUserId: service._id, actorRole: "service", newStatus: "needs_review", reason: "Internal agent research bundle received; provisional review only.", evidenceDraftId: draftId });
    return { receipt_id: receiptId, task_id: taskId, evidence_draft_id: draftId, agent_review_id: reviewId, created: true };
  },
});

export const getReceipt = query({
  args: { receiptId: v.string(), expectedHash: v.optional(v.string()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireUser(ctx, ["reviewer", "curator", "admin"]);
    const receipt = await ctx.db.query("agent_intake_receipts").withIndex("by_receipt_id", (q) => q.eq("receipt_id", args.receiptId)).unique();
    if (receipt === null) throw new Error("Receipt not found");
    if (args.expectedHash !== undefined && args.expectedHash !== receipt.bundle_hash) throw new Error("Receipt hash mismatch");
    return receipt;
  },
});

export const listReceipts = query({
  args: { limit: v.optional(v.number()), cursor: v.optional(v.string()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireUser(ctx, ["reviewer", "curator", "admin"]);
    const limit = args.limit ?? 20;
    if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new Error("Limit must be an integer from 1 to 20.");
    return await ctx.db.query("agent_intake_receipts").withIndex("by_receipt_id").order("desc").paginate({ numItems: limit, cursor: args.cursor ?? null });
  },
});

// Human early triage only. This deliberately exposes return/reject; it has no
// accepted-for-export path and validates the entire batch before writing.
export const batchDisposeReceipts = mutation({
  args: {
    items: v.array(v.object({ receipt_id: v.string(), expected_hash: v.string() })),
    outcome: v.union(v.literal("return"), v.literal("reject")),
    note: v.string(),
  },
  returns: v.object({ count: v.number() }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, ["reviewer", "curator", "admin"]);
    if (args.items.length === 0 || args.items.length > 20) throw new Error("Batch must contain 1 to 20 receipts.");
    if (args.note.trim().length === 0 || args.note.length > 2048) throw new Error("A bounded disposition note is required.");
    const seen = new Set<string>();
    const rows: Array<{ receipt: any; task: any; draft: any }> = [];
    for (const item of args.items) {
      if (seen.has(item.receipt_id) || !/^[0-9a-f]{64}$/.test(item.expected_hash)) throw new Error("Batch contains duplicate or invalid receipt data.");
      seen.add(item.receipt_id);
      const receipt = await ctx.db.query("agent_intake_receipts").withIndex("by_receipt_id", (q) => q.eq("receipt_id", item.receipt_id)).unique();
      if (receipt === null || receipt.bundle_hash !== item.expected_hash || sha256(receipt.bundle_json) !== item.expected_hash) throw new Error("Receipt is missing or has changed.");
      const task = await ctx.db.query("tasks").withIndex("by_task_id", (q) => q.eq("task_id", receipt.task_id)).unique();
      const draft = await ctx.db.query("evidence_drafts").withIndex("by_evidence_draft_id", (q) => q.eq("evidence_draft_id", receipt.evidence_draft_id)).unique();
      if (task === null || draft === null || task.status !== "needs_review" || draft.agent_intake_only !== true) throw new Error("Every receipt must refer to an open internal intake draft.");
      if (draft.task_id !== task.task_id || draft.agent_intake_hash !== receipt.bundle_hash || draft.source_claim_key !== receipt.submission_key || task.intake_submission_key !== receipt.submission_key || draft.draft_status !== "submitted") throw new Error("Receipt no longer matches its submitted intake evidence.");
      if (draft.created_by === user._id) throw new Error("The intake service author cannot review its own draft.");
      rows.push({ receipt, task, draft });
    }
    const now = Date.now(); const decisionStatus: "rejected" | "needs_more_evidence" = args.outcome === "reject" ? "rejected" : "needs_more_evidence";
    for (const row of rows) {
      const decisionId = `${row.task.task_id}:review:${now}:${user._id}`;
      const record = { review_decision_id: decisionId, task_id: row.task.task_id, evidence_draft_id: row.draft.evidence_draft_id, reviewer_user_id: user._id, decision_status: decisionStatus, decision_note: args.note.trim(), target_year_affects: [], created_at: now, updated_at: now };
      const decisionHash = sha256(canonicalJson({ ...record, reviewer_user_id: String(user._id) }));
      await ctx.db.insert("review_decisions", { ...record, decision_hash: decisionHash });
      const newStatus = args.outcome === "reject" ? "reviewed" : "changes_requested";
      await ctx.db.patch(row.task._id, { status: newStatus, updated_at: now, last_event_at: now });
      await ctx.db.patch(row.draft._id, { draft_status: args.outcome === "reject" ? "rejected" : "submitted", updated_at: now });
      await appendTaskEvent(ctx, { taskId: row.task.task_id, eventType: args.outcome === "reject" ? "review_decided" : "changes_requested", actorUserId: user._id, actorRole: user.roles.includes("admin") ? "admin" : user.roles.includes("curator") ? "curator" : "reviewer", previousStatus: "needs_review", newStatus, reason: args.note.trim(), evidenceDraftId: row.draft.evidence_draft_id, reviewDecisionId: decisionId });
    }
    return { count: rows.length };
  },
});
