import { v } from "convex/values";
import { sha256 } from "./sha256.ts";

// immutable object receipts (docs/development/agent-first-passes.md,
// "receipt contract"): the backend's record that it holds the exact bytes of
// a content-addressed object. the first-pass receipt is the first user; any
// later collection or inspection import that needs immutable references can
// reuse the same contract instead of inventing its own.
//
// the contract, in brief:
// - the object is addressed by the sha256 of its exact bytes, and the
//   receipt id is `<namespace>:<sha256>`;
// - an identical retry returns the existing receipt and writes nothing;
// - changed content is a different hash and therefore a new receipt, whose
//   predecessors are named explicitly and must already hold receipts;
// - the receipt keeps the bytes (`convex_only`) until an independent copy has
//   been written, read back and verified (`r2_verified`), so a clean cache
//   can always be rebuilt from receipts alone.

export const OBJECT_RECEIPT_CONTRACT = "object-receipt.v1";
export const OBJECT_BYTES_MAX = 65_536;

export const objectStorageTier = v.union(v.literal("convex_only"), v.literal("r2_verified"));

export const objectStorage = v.object({
  tier: objectStorageTier,
  byte_length: v.number(),
  // set only once an independent copy has been read back and its hash checked
  r2_key: v.optional(v.string()),
  verified_at: v.optional(v.number()),
});

export type ObjectStorage = {
  tier: "convex_only" | "r2_verified";
  byte_length: number;
  r2_key?: string;
  verified_at?: number;
};

export function isSha256Hex(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

export function objectReceiptId(namespace: string, hash: string): string {
  if (!/^[a-z][a-z0-9-]*$/.test(namespace)) throw new Error("Receipt namespace must be lower-case kebab text.");
  if (!isSha256Hex(hash)) throw new Error("Receipt hash must be 64 lowercase hex characters.");
  return `${namespace}:${hash}`;
}

// check the transported text against its claimed address before anything
// parses it. objects in this contract are ascii json ending in one newline,
// so the string's utf-16 length is its byte length and the hash covers
// exactly the bytes the archive wrote.
export function verifyObjectBytes(text: string, claimedHash: string, maxBytes = OBJECT_BYTES_MAX): { byteLength: number } {
  if (!isSha256Hex(claimedHash)) throw new Error("Object hash must be 64 lowercase hex characters.");
  if (text.length === 0 || text.length > maxBytes) throw new Error(`Object must be 1 to ${maxBytes} bytes.`);
  // python's ensure_ascii output: escaped controls, raw ascii 0x20 to 0x7f
  if (!/^[\x20-\x7f]*\n$/.test(text)) throw new Error("Object must be one line of ASCII JSON ending in a newline.");
  if (sha256(text) !== claimedHash) throw new Error("Object hash does not match its bytes.");
  return { byteLength: text.length };
}

export function convexOnlyStorage(byteLength: number): ObjectStorage {
  return { tier: "convex_only", byte_length: byteLength };
}
