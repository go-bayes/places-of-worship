import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query, type QueryCtx } from "./_generated/server";
import { requireUser } from "./lib/auth";
import { applyReviewDecision } from "./reviews";
import { appendTaskEvent } from "./lib/taskEvents";
import { sha256 } from "./lib/sha256";
import { assertNoDuplicateJsonKeys, validateAgentReviewBundle } from "./lib/agentIntake";
import { recordEvidenceVersion } from "./evidenceVersions";
import { costBasisOf, recordJudgments, type JudgmentInput } from "./lib/agentJudgments";

import { assertInternalAgentIngestEnabled as enabled, internalAgentServiceUser } from "./lib/agentServiceUser";

// find a receipt whose stored bytes equal the submitted bytes exactly; never validates or writes.
async function receiptForBytes(ctx: QueryCtx, bundleJson: string, bundleHash: string) {
  if (!/^[0-9a-f]{64}$/.test(bundleHash)) throw new Error("bundleHash must be 64 lowercase hex characters");
  if (sha256(bundleJson) !== bundleHash) throw new Error("bundleHash does not match bundleJson");
  const receipted = await ctx.db.query("agent_intake_receipts").withIndex("by_bundle_hash", (q) => q.eq("bundle_hash", bundleHash)).first();
  if (receipted === null || receipted.bundle_json !== bundleJson) return null;
  return { receipt_id: receipted.receipt_id, task_id: receipted.task_id, evidence_draft_id: receipted.evidence_draft_id, agent_review_id: receipted.agent_review_id };
}

// read-only retry route for the submit command, by hash alone: the caller never sends a bundle
// its own validation refused. returns the receipt with the sha256 of the bytes actually stored, so
// the caller compares against its local bytes; a stored row whose bytes no longer hash to its
// bundle_hash field reports its real digest and so never matches.
export const findReceiptByHash = internalQuery({
  args: { bundleHash: v.string() },
  returns: v.union(v.null(), v.object({ receipt_id: v.string(), task_id: v.string(), evidence_draft_id: v.string(), agent_review_id: v.string(), stored_bundle_sha256: v.string() })),
  handler: async (ctx, args) => {
    if (!/^[0-9a-f]{64}$/.test(args.bundleHash)) throw new Error("bundleHash must be 64 lowercase hex characters");
    const receipted = await ctx.db.query("agent_intake_receipts").withIndex("by_bundle_hash", (q) => q.eq("bundle_hash", args.bundleHash)).first();
    if (receipted === null) return null;
    return { receipt_id: receipted.receipt_id, task_id: receipted.task_id, evidence_draft_id: receipted.evidence_draft_id, agent_review_id: receipted.agent_review_id, stored_bundle_sha256: sha256(receipted.bundle_json) };
  },
});

// superseded by findReceiptByHash, which the submit command now uses so that a locally refused
// bundle is never sent; kept only because removing a deployed function is a non-additive change.
export const findReceiptForBytes = internalQuery({
  args: { bundleJson: v.string(), bundleHash: v.string() },
  returns: v.union(v.null(), v.object({ receipt_id: v.string(), task_id: v.string(), evidence_draft_id: v.string(), agent_review_id: v.string() })),
  handler: async (ctx, args) => receiptForBytes(ctx, args.bundleJson, args.bundleHash),
});

export const ingestBundle = internalMutation({
  args: { bundleJson: v.string(), bundleHash: v.string() },
  returns: v.object({ receipt_id: v.string(), task_id: v.string(), evidence_draft_id: v.string(), agent_review_id: v.string(), created: v.boolean() }),
  handler: async (ctx, args) => {
    enabled();
    // an exact retry of bytes already receipted returns that receipt without writing. It runs before
    // validation so a rule tightened after the first ingest cannot turn an idempotent retry into an error;
    // the stored bytes must equal the submitted bytes, so nothing unvalidated is admitted.
    const receipted = await receiptForBytes(ctx, args.bundleJson, args.bundleHash);
    if (receipted !== null) return { ...receipted, created: false };
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
    const service = await internalAgentServiceUser(ctx, now);
    const taskId = `agent-research:${checked.bundle.submission_key}`;
    const draftId = `${taskId}:draft:1`;
    const reviewId = `${taskId}:review:1`;
    const receiptId = `${taskId}:receipt`;
    const dossier = checked.bundle.dossier;
    const firstClaim = dossier.claims[0];
    const osm = /^osm:(node|way|relation)\/([0-9]+)$/.exec(dossier.place.place_ref);
    const location = dossier.candidate_location;
    const latitude = location.latitude ?? dossier.place.seed_latitude;
    const longitude = location.longitude ?? dossier.place.seed_longitude;
    const summary = dossier.claims.map((claim: any) => `${claim.claim_type}: ${claim.value} [${claim.source.locator}]`).join("\n").slice(0, 8000);
    await ctx.db.insert("tasks", {
      task_id: taskId, batch_id: "internal-agent-research", country_code: "NZ", task_type: "other", priority: "medium", status: "needs_review", target_years: [2013, 2018, 2023], name: dossier.place.name,
      source_record_id: dossier.place.place_ref, matched_osm_id: osm?.[2], osm_object_type: osm?.[1] as "node" | "way" | "relation" | undefined,
      geometry: { type: "Point", coordinates: [longitude, latitude] }, task_brief: "Internal agent research dossier awaiting human review; provisional only.",
      source_context: { origin: "internal_agent_research", bundle_hash: args.bundleHash, submission_key: checked.bundle.submission_key }, intake_submission_key: checked.bundle.submission_key,
      created_at: now, updated_at: now, last_event_at: now,
    });
    const draftRowId = await ctx.db.insert("evidence_drafts", {
      evidence_draft_id: draftId, task_id: taskId, draft_status: "submitted", created_by: service._id, created_at: now, updated_at: now,
      source_type: firstClaim.source.source_type, source_title: firstClaim.source.source_name, source_url_or_file: firstClaim.source.locator, source_locator: firstClaim.source.locator,
      evidence_note: summary, privacy_flag: checked.bundle.review.cultural_sensitivity.flagged ? "needs_review" : "clear", licence_flag: "needs_review",
      validation_summary: { status: "internal_agent_intake", bundle_hash: args.bundleHash }, source_claim_key: checked.bundle.submission_key, claim_hash: args.bundleHash,
      agent_intake_only: true, agent_intake_hash: args.bundleHash,
    });
    // r-j7: the source-level summary says what was done. a claim the reviewer
    // did not check is recorded as not_checked; an opened or snippet-read
    // source was a model assessment. the claim-grain record with the real
    // access method is the agent_judgments write below.
    const claimsById = new Map<string, any>(dossier.claims.map((claim: any) => [claim.claim_id, claim]));
    const sourcesChecked = checked.bundle.review.claim_checks.map((check) => ({
      source_title: claimsById.get(check.claim_id)?.source?.source_name ?? check.claim_id,
      url_or_file: check.source_url,
      check: "existence" as const,
      method: check.access_method === "not_checked" ? ("not_checked" as const) : ("model_assessment" as const),
      outcome: check.outcome,
      note: `${check.access_method}: ${check.note}`.slice(0, 1_000),
    }));
    await ctx.db.insert("agent_reviews", {
      agent_review_id: reviewId, task_id: taskId, evidence_draft_id: draftId, batch_id: `internal-agent:${checked.bundle.submission_key}`, version: 1,
      recommendation: checked.bundle.review.recommendation, reasoning: checked.bundle.review.reasoning, sources_checked: sourcesChecked,
      cultural_sensitivity: checked.bundle.review.cultural_sensitivity, agent_name: `${checked.bundle.research_run.backend}+${checked.bundle.review_run.backend}-internal`, model_provider: checked.bundle.research_run.backend,
      model_name: checked.bundle.research_run.model_id_reported, source_check_model: checked.bundle.review_run.model_id_reported,
      prompt_version: "agent-review-bundle.v1", actor_user_id: service._id, ai_generated: true, created_at: now,
    });
    await ctx.db.insert("agent_intake_receipts", { receipt_id: receiptId, submission_key: checked.bundle.submission_key, bundle_hash: args.bundleHash, bundle_json: args.bundleJson, task_id: taskId, evidence_draft_id: draftId, agent_review_id: reviewId, created_at: now });
    // the intake-only row is versioned like any submission; the version
    // grants no acceptance and the receipt remains the bundle's record
    const version = await recordEvidenceVersion(ctx, { draftRowId, actor: service, kind: "agent_intake", now, idempotencyKey: `agent-intake:${checked.bundle.submission_key}` });
    // judgments at claim grain (r-j1, r-j2): the advisory reviewer's per-claim
    // checks with their real access method, its recommendation on the intake
    // version, and the researcher's status assessment of the place.
    const context = { task_id: taskId, evidence_draft_id: draftId, evidence_version_hash: version.object_hash, place_ref: dossier.place.place_ref, country_code: dossier.place.country_code ?? "NZ" };
    const runJudge = (run: typeof checked.bundle.review_run, role: string, promptVersion: string) => ({
      agent_name: `${run.backend}-${role}-internal`,
      model_provider: run.backend,
      model_requested: run.model_requested,
      model_reported: run.model_id_reported,
      prompt_version: promptVersion,
      instruction_sha256: run.prompt_sha256,
    });
    const reviewJudge = runJudge(checked.bundle.review_run, "advisory-reviewer", "agent-review.v1");
    const reviewRun = { agent_run_id: `${checked.bundle.submission_key}:review`, attempt: 1, cost_basis: "unknown" as const };
    const manifest = dossier.run_manifest ?? {};
    // a metered basis needs its value; without one the cost is unknown, never zero
    let researchBasis = costBasisOf(manifest.cost_basis);
    let researchCost: number | undefined = undefined;
    if (researchBasis === "unknown" || researchBasis === "subscription_unmetered") researchCost = undefined;
    else if (typeof manifest.cost_usd_reported === "number" && Number.isFinite(manifest.cost_usd_reported) && manifest.cost_usd_reported >= 0) researchCost = manifest.cost_usd_reported;
    else researchBasis = "unknown";
    const researchRun = { agent_run_id: typeof manifest.run_id === "string" ? manifest.run_id : `${checked.bundle.submission_key}:research`, attempt: 1, cost_usd: researchCost, cost_basis: researchBasis };
    const judgments: JudgmentInput[] = [
      ...checked.bundle.review.claim_checks.map((check): JudgmentInput => ({
        subject: { kind: "claim", ref: `${args.bundleHash}#${check.claim_id}` },
        judgment_kind: "claim_support",
        outcome: check.outcome,
        access_method: check.access_method,
        source_locator: check.source_url,
        basis_note: check.note.slice(0, 2_000),
        judge: reviewJudge,
        run: reviewRun,
        context,
      })),
      {
        subject: { kind: "evidence_version", ref: version.object_hash },
        judgment_kind: "recommendation",
        outcome: checked.bundle.review.recommendation,
        basis_note: checked.bundle.review.reasoning.slice(0, 2_000),
        judge: reviewJudge,
        run: reviewRun,
        context,
      },
    ];
    const status = dossier.status_assessment;
    if (status && typeof status.current_status === "string") {
      judgments.push({
        subject: { kind: "place", ref: dossier.place.place_ref },
        judgment_kind: "status_assessment",
        outcome: status.current_status,
        basis_note: `${typeof status.basis === "string" ? status.basis : ""}${typeof status.asof_date === "string" ? ` (as of ${status.asof_date})` : ""}`.trim().slice(0, 2_000) || undefined,
        judge: runJudge(checked.bundle.research_run, "researcher", typeof manifest.prompt_version === "string" ? manifest.prompt_version : "agent-dossier.v1"),
        run: researchRun,
        context,
      });
    }
    const recorded = await recordJudgments(ctx, { actorUserId: service._id, judgments, now });
    await appendTaskEvent(ctx, { taskId, eventType: "imported", actorUserId: service._id, actorRole: "service", newStatus: "needs_review", reason: "Internal agent research bundle received; provisional review only.", evidenceDraftId: draftId, evidenceVersionHash: version.object_hash, clientContext: { judgment_ids: recorded.map((row) => row.judgment_id) } });
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
    if (args.note.trim().length < 8 || args.note.length > 2048) throw new Error("A bounded disposition note is required.");
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
    for (const row of rows) {
      await applyReviewDecision(ctx, { taskId: row.task.task_id, decision: {
        evidence_draft_id: row.draft.evidence_draft_id,
        decision_status: args.outcome === "reject" ? "rejected" : "needs_more_evidence",
        decision_note: args.note.trim(),
      } }, user);
    }
    return { count: rows.length };
  },
});
