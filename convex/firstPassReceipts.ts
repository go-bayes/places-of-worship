import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requireUser } from "./lib/auth";
import { assertInternalAgentIngestEnabled, internalAgentServiceUser } from "./lib/agentServiceUser";
import { validateStandaloneDossier } from "./lib/agentIntake";
import { validateFirstPassRecord, type FirstPassRecord } from "./lib/firstPass";
import { recordJudgments, type JudgmentContext, type JudgmentInput } from "./lib/agentJudgments";
import { OBJECT_RECEIPT_CONTRACT, convexOnlyStorage, isSha256Hex, objectReceiptId } from "./lib/objectReceipts";

// first-pass receipts (j2 of the ai-judgment recording design, jb rulings
// r-j1 to r-j7 of 2026-09-19; docs/development/agent-first-passes.md). the
// operator's `first_pass.py submit` sends each archived record, parents
// first, to ingestFirstPass; the backend verifies the bytes against their
// hash, keeps them under the object-receipt.v1 contract, and records the
// researcher's status assessment and claim annotations as agent judgments.
// humans decide; ai recommends. nothing here changes a task, an evidence
// draft, a version, or a review decision.

const RECEIPT_NAMESPACE = "first-pass";
const LIST_MAX = 50;

const receiptResult = v.object({
  receipt_id: v.string(),
  record_hash: v.string(),
  created: v.boolean(),
  storage_tier: v.string(),
  judgment_ids: v.array(v.string()),
});

async function receiptByHash(ctx: { db: any }, hash: string): Promise<Doc<"agent_first_pass_receipts"> | null> {
  return await ctx.db
    .query("agent_first_pass_receipts")
    .withIndex("by_record_hash", (q: any) => q.eq("record_hash", hash))
    .unique();
}

// a record run for a portal record must name records that exist here and
// agree with each other; the judgments inherit this context, so a wrong link
// would misfile them. returns the evidence version's stored object hash.
async function checkedContext(ctx: { db: any }, record: FirstPassRecord): Promise<{ evidenceVersionObjectHash?: string }> {
  const context = record.context;
  if (context === undefined) return {};
  if (context.task_id !== undefined) {
    const task = await ctx.db.query("tasks").withIndex("by_task_id", (q: any) => q.eq("task_id", context.task_id)).unique();
    if (task === null) throw new Error("First-pass context names a task this deployment does not hold.");
    if (task.country_code !== record.country_code) throw new Error("First-pass context task is in a different country.");
  }
  if (context.evidence_draft_id !== undefined) {
    const draft = await ctx.db.query("evidence_drafts").withIndex("by_evidence_draft_id", (q: any) => q.eq("evidence_draft_id", context.evidence_draft_id)).unique();
    if (draft === null) throw new Error("First-pass context names an evidence draft this deployment does not hold.");
    if (context.task_id !== undefined && draft.task_id !== context.task_id) throw new Error("First-pass context draft belongs to a different task.");
  }
  if (context.evidence_version_hash === undefined) return {};
  const objectHash = `sha256:${context.evidence_version_hash}`;
  const version = await ctx.db.query("evidence_versions").withIndex("by_object_hash", (q: any) => q.eq("object_hash", objectHash)).unique();
  if (version === null) throw new Error("First-pass context names an evidence version this deployment does not hold.");
  if (context.task_id !== undefined && version.task_id !== context.task_id) throw new Error("First-pass context evidence version belongs to a different task.");
  if (context.evidence_draft_id !== undefined && version.evidence_draft_id !== context.evidence_draft_id) throw new Error("First-pass context evidence version belongs to a different draft.");
  return { evidenceVersionObjectHash: version.object_hash };
}

// ingest emits status_assessment and annotation judgments (brief section 6);
// the claims themselves stay in the record. both need the dossier, whose run
// manifest names the provider; a record without one yields no judgments
// rather than an invented judge.
export function firstPassJudgments(record: FirstPassRecord, recordHash: string, context: JudgmentContext): JudgmentInput[] {
  const dossier = record.dossier;
  if (dossier === null) return [];
  const locators = validateStandaloneDossier(dossier);
  const manifest = dossier.run_manifest;
  const attribution = record.attribution;
  const judge = {
    agent_name: `${manifest.backend}-first-pass`,
    model_provider: manifest.backend,
    model_requested: attribution.model_requested,
    model_reported: attribution.model_reported ?? undefined,
    model_unreported_reason: attribution.model_unreported_reason ?? undefined,
    prompt_version: typeof manifest.prompt_version === "string" ? manifest.prompt_version : "agent-first-pass.v1",
    code_revision: attribution.code_revision,
    instruction_sha256: attribution.instruction_sha256,
  };
  const run = {
    agent_run_id: attribution.agent_run_id,
    attempt: 1,
    cost_usd: record.usage.cost_usd ?? undefined,
    cost_basis: record.usage.cost_basis,
  };
  const judgments: JudgmentInput[] = [];
  const status = dossier.status_assessment;
  if (status && typeof status.current_status === "string") {
    const basis = `${typeof status.basis === "string" ? status.basis : ""}${typeof status.asof_date === "string" ? ` (as of ${status.asof_date})` : ""}`.trim();
    judgments.push({
      subject: { kind: "place", ref: record.place_ref },
      judgment_kind: "status_assessment",
      outcome: status.current_status,
      basis_note: basis === "" ? undefined : basis.slice(0, 2_000),
      judge,
      run,
      context,
    });
  }
  record.annotations.forEach((annotation, index) => {
    judgments.push({
      subject: { kind: "claim", ref: `${recordHash}#${annotation.claim_id}` },
      judgment_kind: "annotation",
      outcome: annotation.kind,
      // sibling annotations on one claim are not revisions of each other
      facet: `annotation-${index + 1}`,
      source_locator: locators.get(annotation.claim_id),
      basis_note: annotation.note.slice(0, 2_000),
      judge,
      run,
      context,
    });
  });
  return judgments;
}

export const ingestFirstPass = internalMutation({
  args: { recordJson: v.string(), recordHash: v.string() },
  returns: receiptResult,
  handler: async (ctx, args) => {
    assertInternalAgentIngestEnabled();
    const { record, byteLength } = validateFirstPassRecord(args.recordJson, args.recordHash);
    const existing = await receiptByHash(ctx, args.recordHash);
    if (existing !== null) {
      // same hash, same bytes: an identical retry returns the receipt unchanged
      if (existing.record_json !== args.recordJson) throw new Error("Stored first-pass bytes differ from their hash; refusing to continue.");
      return { receipt_id: existing.receipt_id, record_hash: existing.record_hash, created: false, storage_tier: existing.storage.tier, judgment_ids: existing.judgment_ids };
    }
    // predecessors must already hold receipts for the same place, so the
    // backend never holds a revision whose history it cannot return
    for (const parent of record.parents) {
      const parentReceipt = await receiptByHash(ctx, parent);
      if (parentReceipt === null) throw new Error(`Parent first pass ${parent} has no receipt; submit its history first.`);
      if (parentReceipt.place_ref !== record.place_ref) throw new Error("Parent first pass belongs to another place.");
    }
    const { evidenceVersionObjectHash } = await checkedContext(ctx, record);
    const now = Date.now();
    const service = await internalAgentServiceUser(ctx, now);
    const context: JudgmentContext = {
      task_id: record.context?.task_id,
      evidence_draft_id: record.context?.evidence_draft_id,
      evidence_version_hash: evidenceVersionObjectHash,
      place_ref: record.place_ref,
      country_code: record.country_code,
    };
    const recorded = await recordJudgments(ctx, { actorUserId: service._id, judgments: firstPassJudgments(record, args.recordHash, context), now });
    const receiptId = objectReceiptId(RECEIPT_NAMESPACE, args.recordHash);
    const judgmentIds = recorded.map((row) => row.judgment_id);
    const storage = convexOnlyStorage(byteLength);
    await ctx.db.insert("agent_first_pass_receipts", {
      receipt_id: receiptId,
      receipt_contract: OBJECT_RECEIPT_CONTRACT,
      record_hash: args.recordHash,
      record_json: args.recordJson,
      schema_version: record.schema_version,
      place_ref: record.place_ref,
      country_code: record.country_code,
      outcome: record.outcome,
      stop_reason: record.stop_reason,
      parents: record.parents,
      record_created_at: record.created_at,
      task_id: record.context?.task_id,
      evidence_draft_id: record.context?.evidence_draft_id,
      evidence_version_hash: record.context?.evidence_version_hash,
      assistance_request_id: record.context?.assistance_request_id,
      agent_run_id: record.attribution.agent_run_id,
      model_requested: record.attribution.model_requested,
      model_reported: record.attribution.model_reported ?? undefined,
      model_unreported_reason: record.attribution.model_unreported_reason ?? undefined,
      cost_usd: record.usage.cost_usd ?? undefined,
      cost_basis: record.usage.cost_basis,
      storage,
      judgment_ids: judgmentIds,
      submitted_by: service._id,
      created_at: now,
    });
    return { receipt_id: receiptId, record_hash: args.recordHash, created: true, storage_tier: storage.tier, judgment_ids: judgmentIds };
  },
});

// operator recovery (`first_pass.py restore`): the exact bytes and their
// parents, so a clean local archive can be rebuilt and verified from receipts
export const getFirstPassRecord = internalQuery({
  args: { recordHash: v.string() },
  returns: v.union(v.null(), v.object({ record_hash: v.string(), record_json: v.string(), parents: v.array(v.string()) })),
  handler: async (ctx, args) => {
    if (!isSha256Hex(args.recordHash)) throw new Error("recordHash must be 64 lowercase hex characters");
    const receipt = await receiptByHash(ctx, args.recordHash);
    if (receipt === null) return null;
    return { record_hash: receipt.record_hash, record_json: receipt.record_json, parents: receipt.parents };
  },
});

export const getFirstPassReceipt = query({
  args: { recordHash: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireUser(ctx, ["reviewer", "curator", "admin", "pi"]);
    if (!isSha256Hex(args.recordHash)) throw new Error("recordHash must be 64 lowercase hex characters");
    const receipt = await receiptByHash(ctx, args.recordHash);
    if (receipt === null) throw new Error("First-pass receipt not found");
    return receipt;
  },
});

// newest first, without the record bytes; getFirstPassReceipt returns those
export const listFirstPassReceipts = query({
  args: { placeRef: v.optional(v.string()), taskId: v.optional(v.string()), limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    await requireUser(ctx, ["reviewer", "curator", "admin", "pi"]);
    if ((args.placeRef === undefined) === (args.taskId === undefined)) throw new Error("Name exactly one of placeRef or taskId.");
    const limit = args.limit ?? 20;
    if (!Number.isInteger(limit) || limit < 1 || limit > LIST_MAX) throw new Error(`Limit must be an integer from 1 to ${LIST_MAX}.`);
    const rows: Doc<"agent_first_pass_receipts">[] = args.placeRef !== undefined
      ? await ctx.db.query("agent_first_pass_receipts").withIndex("by_place", (q) => q.eq("place_ref", args.placeRef!)).order("desc").take(limit)
      : await ctx.db.query("agent_first_pass_receipts").withIndex("by_task", (q) => q.eq("task_id", args.taskId!)).order("desc").take(limit);
    return rows.map(({ record_json: _bytes, ...summary }) => summary);
  },
});
