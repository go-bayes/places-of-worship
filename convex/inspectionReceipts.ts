import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requireUser } from "./lib/auth";
import { assertInternalAgentIngestEnabled } from "./lib/agentServiceUser";
import { screenInspectionCase, screenInspectionCollection, validateInspectionCase, validateInspectionCollection } from "./lib/inspectionCollection";
import { OBJECT_RECEIPT_CONTRACT, convexOnlyStorage, isSha256Hex, objectReceiptId, verifyObjectBytes } from "./lib/objectReceipts";
import { sha256 } from "./lib/sha256";
import { canonicalWireJson } from "./lib/wireJson";

const NAMESPACE = "inspection";
type Receipt = Doc<"inspection_object_receipts">;
async function byHash(ctx: { db: any }, hash: string): Promise<Receipt | null> {
  return await ctx.db.query("inspection_object_receipts").withIndex("by_object_hash", (q: any) => q.eq("object_hash", hash)).unique();
}

export const ingestInspectionObject = internalMutation({
  args: { objectJson: v.string(), objectHash: v.string(), objectKind: v.union(v.literal("case"), v.literal("collection")) },
  returns: v.object({ receipt_id: v.string(), object_hash: v.string(), created: v.boolean(), storage_tier: v.string() }),
  handler: async (ctx, args) => {
    assertInternalAgentIngestEnabled();
    if (isSha256Hex(args.objectHash) && sha256(args.objectJson) === args.objectHash) {
      const existing = await byHash(ctx, args.objectHash);
      if (existing !== null) {
        if (existing.object_json !== args.objectJson || existing.object_kind !== args.objectKind) throw new Error("Existing receipt conflicts with supplied object.");
        return { receipt_id: existing.receipt_id, object_hash: existing.object_hash, created: false, storage_tier: existing.storage.tier };
      }
    }
    const { byteLength } = verifyObjectBytes(args.objectJson, args.objectHash);
    const value = JSON.parse(args.objectJson);
    if (args.objectKind === "case") screenInspectionCase(value);
    else screenInspectionCollection(value);
    const object = args.objectKind === "case" ? validateInspectionCase(args.objectJson, args.objectHash) : validateInspectionCollection(value);
    if (args.objectKind === "collection" && `${canonicalWireJson(JSON.stringify(object))}\n` !== args.objectJson) throw new Error("Collection does not round-trip.");
    const logicalRef = args.objectKind === "case" ? (object as ReturnType<typeof validateInspectionCase>).case_ref : (object as ReturnType<typeof validateInspectionCollection>).collection_ref;
    const parents = object.parents;
    if (args.objectKind === "case") {
      const { task_id: taskId, evidence_version_hash: versionHash } = (object as ReturnType<typeof validateInspectionCase>).context;
      if (taskId !== null) {
        const task = await ctx.db.query("tasks").withIndex("by_task_id", (q: any) => q.eq("task_id", taskId)).unique();
        if (task === null) throw new Error("context.task_id: task does not exist.");
        if (task.country_code !== "bs") throw new Error("context.task_id: task is in another country.");
      }
      if (versionHash !== null) {
        const version = await ctx.db.query("evidence_versions").withIndex("by_object_hash", (q: any) => q.eq("object_hash", `sha256:${versionHash}`)).unique();
        if (version === null) throw new Error("context.evidence_version_hash: version does not exist.");
        if (taskId === null || version.task_id !== taskId) throw new Error("context.evidence_version_hash: version belongs to another task.");
      }
    }
    if (parents.includes(args.objectHash)) throw new Error("An object cannot parent itself.");
    if (parents.length === 0) {
      const root = await ctx.db.query("inspection_object_receipts").withIndex("by_logical_ref", (q: any) => q.eq("object_kind", args.objectKind).eq("logical_ref", logicalRef)).first();
      if (root !== null) throw new Error("parents: a revision requires a receipted parent for this object.");
    }
    for (const parentHash of parents) {
      const parent = await byHash(ctx, parentHash);
      if (parent === null || parent.object_kind !== args.objectKind || parent.logical_ref !== logicalRef) throw new Error("Parent must be a receipted version of the same object.");
    }
    const caseHashes = args.objectKind === "collection" ? (object as ReturnType<typeof validateInspectionCollection>).case_hashes : [];
    const memberRefs = new Set<string>();
    for (const caseHash of caseHashes) {
      const member = await byHash(ctx, caseHash);
      if (member === null || member.object_kind !== "case") throw new Error("Collection member must hold a case receipt.");
      const memberCase = validateInspectionCase(member.object_json, caseHash);
      const collection = object as ReturnType<typeof validateInspectionCollection>;
      if (memberCase.source_snapshot_date !== collection.source_snapshot_date || memberCase.definition_version !== collection.definition_version || memberCase.definition_hash !== collection.definition_hash) throw new Error("Collection member context differs from manifest.");
      if (memberRefs.has(memberCase.case_ref)) throw new Error("Collection includes two versions of one case.");
      memberRefs.add(memberCase.case_ref);
    }
    const receiptId = objectReceiptId(NAMESPACE, args.objectHash);
    await ctx.db.insert("inspection_object_receipts", { receipt_id: receiptId, receipt_contract: OBJECT_RECEIPT_CONTRACT, object_hash: args.objectHash, object_json: args.objectJson, object_kind: args.objectKind, country_code: "bs", logical_ref: logicalRef, parents, case_hashes: caseHashes, storage: convexOnlyStorage(byteLength), created_at: Date.now() });
    return { receipt_id: receiptId, object_hash: args.objectHash, created: true, storage_tier: "convex_only" };
  },
});

// Operator recovery uses an internal query; a known hash is never a public
// access token. P2's authenticated detail and paging queries remain separate.
export const getInspectionObjectForRecovery = internalQuery({
  args: { objectHash: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    if (!isSha256Hex(args.objectHash)) throw new Error("Invalid object hash.");
    const receipt = await byHash(ctx, args.objectHash);
    if (receipt === null) return null;
    return { object_hash: receipt.object_hash, object_json: receipt.object_json, object_kind: receipt.object_kind, parents: receipt.parents, case_hashes: receipt.case_hashes };
  },
});

export const getInspectionReceipt = query({
  args: { objectHash: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireUser(ctx, ["reviewer", "curator", "admin", "pi"]);
    if (!isSha256Hex(args.objectHash)) throw new Error("Invalid object hash.");
    const receipt = await byHash(ctx, args.objectHash);
    if (receipt === null) throw new Error("Inspection receipt not found.");
    return receipt;
  },
});
