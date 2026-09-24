import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requireUser } from "./lib/auth";
import { assertInternalAgentIngestEnabled, internalAgentServiceUser } from "./lib/agentServiceUser";
import { validateStandaloneDossier } from "./lib/agentIntake";
import { FIRST_PASS_SCHEMA_VERSION, validateFirstPassRecord, type FirstPassRecord } from "./lib/firstPass";
import { costBasisOf, recordJudgments, type JudgmentContext, type JudgmentInput } from "./lib/agentJudgments";
import { OBJECT_RECEIPT_CONTRACT, convexOnlyStorage, isSha256Hex, objectReceiptId } from "./lib/objectReceipts";
import { sha256 } from "./lib/sha256";

// first-pass receipts (docs/development/agent-first-passes.md). the
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

// the place a task is about, as the refs a first-pass record could use
function taskPlaceRefs(task: Doc<"tasks">): Set<string> {
  const refs = new Set<string>();
  if (task.osm_object_type !== undefined && task.matched_osm_id !== undefined) refs.add(`osm:${task.osm_object_type}/${task.matched_osm_id}`);
  if (task.source_record_id !== undefined) refs.add(task.source_record_id);
  return refs;
}

export type ResolvedContext = { taskId?: string; draftId?: string; evidenceVersionObjectHash?: string };

// a record run for a portal record must name records that exist here, belong
// to one task, and are about the record's place in the record's country; the
// judgments inherit this context, so a wrong link would misfile them. every
// field the record supplies is resolved to its owning task, so naming only a
// draft or only an evidence version is checked as strictly as naming the task.
async function checkedContext(ctx: { db: any }, record: FirstPassRecord): Promise<ResolvedContext> {
  const context = record.context;
  if (context === undefined) return {};
  const owners: Array<[string, string]> = [];
  if (context.task_id !== undefined) owners.push(["task_id", context.task_id]);
  let draftId: string | undefined;
  if (context.evidence_draft_id !== undefined) {
    const draft = await ctx.db.query("evidence_drafts").withIndex("by_evidence_draft_id", (q: any) => q.eq("evidence_draft_id", context.evidence_draft_id)).unique();
    if (draft === null) throw new Error("First-pass context names an evidence draft this deployment does not hold.");
    owners.push(["evidence_draft_id", draft.task_id]);
    draftId = draft.evidence_draft_id;
  }
  let evidenceVersionObjectHash: string | undefined;
  if (context.evidence_version_hash !== undefined) {
    const objectHash = `sha256:${context.evidence_version_hash}`;
    const version = await ctx.db.query("evidence_versions").withIndex("by_object_hash", (q: any) => q.eq("object_hash", objectHash)).unique();
    if (version === null) throw new Error("First-pass context names an evidence version this deployment does not hold.");
    if (draftId !== undefined && version.evidence_draft_id !== draftId) throw new Error("First-pass context evidence version belongs to a different draft.");
    owners.push(["evidence_version_hash", version.task_id]);
    draftId = draftId ?? version.evidence_draft_id;
    evidenceVersionObjectHash = version.object_hash;
  }
  if (owners.length === 0) return {};
  const taskIds = new Set(owners.map(([, taskId]) => taskId));
  // the fields that disagree, never the supplied or stored task ids
  if (taskIds.size !== 1) throw new Error(`First-pass context names records from different tasks (${owners.map(([field]) => field).join(", ")}).`);
  const [taskId] = taskIds;
  const task: Doc<"tasks"> | null = await ctx.db.query("tasks").withIndex("by_task_id", (q: any) => q.eq("task_id", taskId)).unique();
  if (task === null) throw new Error("First-pass context names a task this deployment does not hold.");
  if (task.country_code !== record.country_code) throw new Error("First-pass context task is in a different country.");
  if (!taskPlaceRefs(task).has(record.place_ref)) throw new Error("First-pass context task is about a different place, or names no place the record can be checked against.");
  return { taskId, draftId, evidenceVersionObjectHash };
}

const MANIFEST_UNREPORTED = "The researcher's run manifest reported no model id.";
const ATTRIBUTION_PROVIDER_UNREPORTED = "not_reported";

// judgments come from two runs, each attributed from its own record (ingest
// emits status_assessment and annotation judgments; the claims stay in the
// record):
// - the status assessment is the dossier researcher's verdict, so its judge,
//   models, prompt, run id and cost all come from the dossier's validated
//   run manifest. it is keyed on that run and the record's context, not on
//   the first-pass record: a later pass that carries the same dossier cites
//   the same judgment (its receipt lists the id) instead of writing a second
//   copy of one model output, which would count it twice in agreement rates.
// - annotations are the first-pass author's own judgments of the dossier's
//   claims, keyed on the record (subject <record sha256>#<claim_id>), and
//   attributed from the record's attribution block. the provider is the
//   dossier's backend only when the attribution names the dossier's own run
//   (validateFirstPassRecord then requires the models to agree); an
//   annotating agent from another run keeps its own models and an explicit
//   unreported provider rather than borrowing the researcher's.
export function firstPassJudgments(record: FirstPassRecord, recordHash: string, context: JudgmentContext): JudgmentInput[] {
  const dossier = record.dossier;
  if (dossier === null) return [];
  const locators = validateStandaloneDossier(dossier);
  const manifest = dossier.run_manifest;
  const judgments: JudgmentInput[] = [];
  const status = dossier.status_assessment;
  if (status && typeof status.current_status === "string") {
    let basisOfCost = costBasisOf(manifest.cost_basis);
    let cost: number | undefined = undefined;
    if (basisOfCost !== "unknown" && basisOfCost !== "subscription_unmetered") {
      if (typeof manifest.cost_usd_reported === "number" && Number.isFinite(manifest.cost_usd_reported) && manifest.cost_usd_reported >= 0) cost = manifest.cost_usd_reported;
      else basisOfCost = "unknown";
    }
    const basis = `${typeof status.basis === "string" ? status.basis : ""}${typeof status.asof_date === "string" ? ` (as of ${status.asof_date})` : ""}`.trim();
    judgments.push({
      subject: { kind: "place", ref: record.place_ref },
      judgment_kind: "status_assessment",
      outcome: status.current_status,
      basis_note: basis === "" ? undefined : basis.slice(0, 2_000),
      judge: {
        agent_name: `${manifest.backend}-first-pass-researcher`,
        model_provider: manifest.backend,
        model_requested: manifest.model_id_requested,
        model_reported: manifest.model_id_reported ?? undefined,
        model_unreported_reason: manifest.model_id_reported == null ? MANIFEST_UNREPORTED : undefined,
        prompt_version: manifest.prompt_version,
      },
      run: { agent_run_id: manifest.run_id, attempt: 1, cost_usd: cost, cost_basis: basisOfCost },
      context,
    });
  }
  if (record.annotations.length > 0) {
    const attribution = record.attribution;
    const sameRun = attribution.agent_run_id === manifest.run_id;
    const provider = sameRun ? manifest.backend : ATTRIBUTION_PROVIDER_UNREPORTED;
    const judge = {
      agent_name: sameRun ? `${manifest.backend}-first-pass-annotator` : "first-pass-annotator",
      model_provider: provider,
      model_requested: attribution.model_requested,
      model_reported: attribution.model_reported ?? undefined,
      model_unreported_reason: attribution.model_unreported_reason ?? undefined,
      prompt_version: FIRST_PASS_SCHEMA_VERSION,
      code_revision: attribution.code_revision,
      instruction_sha256: attribution.instruction_sha256,
    };
    const run = { agent_run_id: attribution.agent_run_id, attempt: 1, cost_usd: record.usage.cost_usd ?? undefined, cost_basis: record.usage.cost_basis };
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
  }
  return judgments;
}

export const ingestFirstPass = internalMutation({
  args: { recordJson: v.string(), recordHash: v.string() },
  returns: receiptResult,
  handler: async (ctx, args) => {
    assertInternalAgentIngestEnabled();
    // an exact retry of bytes already receipted returns that receipt without
    // writing, before validation, so a rule tightened after the first ingest
    // cannot turn an idempotent retry into an error. the stored bytes must
    // equal the submitted bytes and hash to the address, so nothing
    // unvalidated is admitted (the same rule as internalAgentIntake).
    if (isSha256Hex(args.recordHash) && sha256(args.recordJson) === args.recordHash) {
      const existing = await receiptByHash(ctx, args.recordHash);
      if (existing !== null) {
        if (existing.record_json !== args.recordJson) throw new Error("Stored first-pass bytes differ from their hash; refusing to continue.");
        return { receipt_id: existing.receipt_id, record_hash: existing.record_hash, created: false, storage_tier: existing.storage.tier, judgment_ids: existing.judgment_ids };
      }
    }
    const { record, byteLength } = validateFirstPassRecord(args.recordJson, args.recordHash);
    // predecessors must already hold receipts for the same place, so the
    // backend never holds a revision whose history it cannot return
    // lookup failures name the parent by position, never by the supplied hash
    for (const [index, parent] of record.parents.entries()) {
      const parentReceipt = await receiptByHash(ctx, parent);
      if (parentReceipt === null) throw new Error(`Parent first pass #${index} has no receipt; submit its history first.`);
      if (parentReceipt.place_ref !== record.place_ref) throw new Error("Parent first pass belongs to another place.");
    }
    const resolved = await checkedContext(ctx, record);
    const now = Date.now();
    const service = await internalAgentServiceUser(ctx, now);
    const context: JudgmentContext = {
      task_id: resolved.taskId,
      evidence_draft_id: resolved.draftId,
      evidence_version_hash: resolved.evidenceVersionObjectHash,
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
      // resolved from whichever context fields the record names
      task_id: resolved.taskId,
      evidence_draft_id: resolved.draftId,
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
