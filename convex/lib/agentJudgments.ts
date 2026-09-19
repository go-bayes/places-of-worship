import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { canonicalJson, sha256 } from "./sha256.ts";
import { MEDIUM_TEXT_MAX, SHORT_TEXT_MAX, URL_OR_FILE_MAX, assertMaxString } from "./limits.ts";

// agent judgments (docs/development/agent-judgments.md, jb rulings r-j1 to
// r-j7, 2026-09-19): one append-only table for every ai lane, at claim grain.
// a judgment is an evaluative output about a subject; the claim itself stays
// in the evidence record and is referred to by id inside a content hash.
// humans decide; ai recommends. nothing here changes a task, draft, or
// decision, and no function that writes here may do so.

export const JUDGMENT_SCHEMA_VERSION = "agent-judgment.v1";
export const JUDGMENTS_PER_CALL_MAX = 100;
export const JUDGMENT_PARENTS_MAX = 10;
export const JUDGMENT_SUBJECT_REF_MAX = 1_024;

export const judgmentSubjectKind = v.union(
  v.literal("claim"),
  v.literal("evidence_draft"),
  v.literal("evidence_version"),
  v.literal("first_pass"),
  v.literal("place"),
);

export const judgmentKind = v.union(
  v.literal("claim_support"),
  v.literal("recommendation"),
  v.literal("status_assessment"),
  v.literal("annotation"),
  v.literal("duplicate"),
  v.literal("location"),
);

// the outcome vocabulary is fixed per kind; the helper refuses a mismatch
export const OUTCOMES_BY_KIND: Readonly<Record<JudgmentKind, readonly string[]>> = {
  claim_support: ["supported", "not_supported", "unclear", "unreachable", "requires_human_access"],
  recommendation: ["accept", "revise", "reject", "defer_cultural"],
  status_assessment: ["active", "likely_active", "likely_inactive", "inactive", "unknown"],
  annotation: ["qualification", "disagreement", "follow_up"],
  duplicate: ["same_place", "different_place", "unclear"],
  location: ["plausible", "implausible", "unclear"],
};

export const judgmentConfidence = v.union(v.literal("high"), v.literal("medium"), v.literal("low"));

export const judgmentAccessMethod = v.union(
  v.literal("opened"),
  v.literal("search_snippet"),
  v.literal("http_fetch"),
  v.literal("model_assessment"),
  v.literal("not_checked"),
);

export const judgmentCostBasis = v.union(
  v.literal("tool_list_price"),
  v.literal("api_invoice"),
  v.literal("subscription_unmetered"),
  v.literal("collaborator_reported"),
  v.literal("unknown"),
);

export const judgmentJudge = v.object({
  agent_name: v.string(),
  model_provider: v.string(),
  model_requested: v.string(),
  model_reported: v.optional(v.string()),
  model_unreported_reason: v.optional(v.string()),
  prompt_version: v.string(),
  code_revision: v.optional(v.string()),
  instruction_sha256: v.optional(v.string()),
});

export const judgmentRun = v.object({
  batch_id: v.optional(v.string()),
  agent_run_id: v.optional(v.string()),
  attempt: v.number(),
  cost_usd: v.optional(v.number()),
  cost_basis: judgmentCostBasis,
});

export const judgmentContext = v.object({
  task_id: v.optional(v.string()),
  evidence_draft_id: v.optional(v.string()),
  evidence_version_hash: v.optional(v.string()),
  place_ref: v.string(),
  country_code: v.string(),
});

export const judgmentDisposition = v.union(
  v.literal("agreed"),
  v.literal("disagreed"),
  v.literal("corrected"),
  v.literal("not_considered"),
);

export type JudgmentKind = "claim_support" | "recommendation" | "status_assessment" | "annotation" | "duplicate" | "location";
export type JudgmentSubjectKind = "claim" | "evidence_draft" | "evidence_version" | "first_pass" | "place";
export type JudgmentAccessMethod = "opened" | "search_snippet" | "http_fetch" | "model_assessment" | "not_checked";
export type JudgmentCostBasis = "tool_list_price" | "api_invoice" | "subscription_unmetered" | "collaborator_reported" | "unknown";

export type JudgmentJudge = {
  agent_name: string;
  model_provider: string;
  model_requested: string;
  model_reported?: string;
  model_unreported_reason?: string;
  prompt_version: string;
  code_revision?: string;
  instruction_sha256?: string;
};

export type JudgmentRun = {
  batch_id?: string;
  agent_run_id?: string;
  attempt: number;
  cost_usd?: number;
  cost_basis: JudgmentCostBasis;
};

export type JudgmentContext = {
  task_id?: string;
  evidence_draft_id?: string;
  evidence_version_hash?: string;
  place_ref: string;
  country_code: string;
};

export type JudgmentInput = {
  subject: { kind: JudgmentSubjectKind; ref: string };
  judgment_kind: JudgmentKind;
  outcome: string;
  // distinguishes sibling judgments on one subject by one lane, for example
  // the batch reviewer's existence, date_support and location checks; part
  // of the id and of the lineage a re-judgment revises
  facet?: string;
  confidence?: "high" | "medium" | "low";
  access_method?: JudgmentAccessMethod;
  source_locator?: string;
  basis_note?: string;
  judge: JudgmentJudge;
  run: JudgmentRun;
  context: JudgmentContext;
};

export type RecordedJudgment = { judgment_id: string; created: boolean };

// the hash envelope: everything a later reader needs to recompute the id
// from the stored row. created_at, actor, and parents stay outside it, so a
// retried write of the same judgment collapses onto one row.
export function judgmentEnvelope(input: JudgmentInput): Record<string, unknown> {
  return {
    schema_version: JUDGMENT_SCHEMA_VERSION,
    subject: { kind: input.subject.kind, ref: input.subject.ref },
    judgment_kind: input.judgment_kind,
    outcome: input.outcome,
    facet: input.facet,
    confidence: input.confidence,
    access_method: input.access_method,
    source_locator: input.source_locator,
    basis_note: input.basis_note,
    judge: input.judge,
    run: input.run,
    context: input.context,
  };
}

export function judgmentIdFor(input: JudgmentInput): string {
  return sha256(canonicalJson(judgmentEnvelope(input)));
}

export function validateJudgmentInput(input: JudgmentInput): void {
  const allowed = OUTCOMES_BY_KIND[input.judgment_kind];
  if (allowed === undefined) {
    throw new Error(`Unknown judgment kind ${input.judgment_kind}.`);
  }
  if (!allowed.includes(input.outcome)) {
    throw new Error(`Outcome ${input.outcome} is not in the ${input.judgment_kind} vocabulary.`);
  }
  if (input.subject.ref.trim() === "") {
    throw new Error("A judgment subject reference is required.");
  }
  assertMaxString("judgment subject reference", input.subject.ref, JUDGMENT_SUBJECT_REF_MAX);
  assertMaxString("judgment basis note", input.basis_note, MEDIUM_TEXT_MAX);
  assertMaxString("judgment facet", input.facet, SHORT_TEXT_MAX);
  assertMaxString("judgment source locator", input.source_locator, URL_OR_FILE_MAX);
  if (input.subject.kind === "claim" && !/^[0-9a-f]{64}#.+$/.test(input.subject.ref)) {
    throw new Error("A claim subject is <sha256>#<claim_id>.");
  }
  if (input.subject.kind === "evidence_version" && !/^(sha256:)?[0-9a-f]{64}$/.test(input.subject.ref)) {
    throw new Error("An evidence-version subject is its object hash.");
  }
  if (input.subject.kind === "first_pass" && !/^[0-9a-f]{64}$/.test(input.subject.ref)) {
    throw new Error("A first-pass subject is its sha256.");
  }
  if ((input.judge.model_reported === undefined) === (input.judge.model_unreported_reason === undefined)) {
    throw new Error("A judge reports a model id or gives the reason it could not.");
  }
  if (input.run.cost_basis === "unknown" || input.run.cost_basis === "subscription_unmetered") {
    if (input.run.cost_usd !== undefined) {
      throw new Error("Unknown or unmetered cost stays absent; it is never zero.");
    }
  } else if (input.run.cost_usd === undefined) {
    throw new Error(`Cost basis ${input.run.cost_basis} requires a cost value.`);
  }
  if (input.run.cost_usd !== undefined && (!Number.isFinite(input.run.cost_usd) || input.run.cost_usd < 0)) {
    throw new Error("Cost must be a finite non-negative number.");
  }
  if (!Number.isInteger(input.run.attempt) || input.run.attempt < 1) {
    throw new Error("Attempt is a positive integer.");
  }
}

// append every judgment in one transaction. an existing row with the same
// id is returned unchanged; a new row names the lane's earlier judgments of
// the same kind, facet and source on the same subject as parents, newest
// first, so a re-judgment reads as a revision rather than a replacement.
export async function recordJudgments(
  ctx: MutationCtx,
  args: { actorUserId: Id<"users">; judgments: JudgmentInput[]; now?: number },
): Promise<RecordedJudgment[]> {
  if (args.judgments.length === 0) {
    return [];
  }
  if (args.judgments.length > JUDGMENTS_PER_CALL_MAX) {
    throw new Error(`At most ${JUDGMENTS_PER_CALL_MAX} judgments per write.`);
  }
  const now = args.now ?? Date.now();
  const results: RecordedJudgment[] = [];
  const writtenThisCall = new Set<string>();
  for (const input of args.judgments) {
    validateJudgmentInput(input);
    const judgmentId = judgmentIdFor(input);
    if (writtenThisCall.has(judgmentId)) {
      results.push({ judgment_id: judgmentId, created: false });
      continue;
    }
    const existing = await ctx.db
      .query("agent_judgments")
      .withIndex("by_judgment_id", (q) => q.eq("judgment_id", judgmentId))
      .unique();
    if (existing !== null) {
      results.push({ judgment_id: judgmentId, created: false });
      continue;
    }
    const priorOnSubject: Doc<"agent_judgments">[] = await ctx.db
      .query("agent_judgments")
      .withIndex("by_subject", (q) => q.eq("subject_ref", input.subject.ref))
      .collect();
    const parents = priorOnSubject
      .filter((row) =>
        row.judgment_kind === input.judgment_kind
        && row.judge.agent_name === input.judge.agent_name
        && row.facet === input.facet
        && row.source_locator === input.source_locator)
      .sort((left, right) => right.created_at - left.created_at)
      .slice(0, JUDGMENT_PARENTS_MAX)
      .map((row) => row.judgment_id);
    await ctx.db.insert("agent_judgments", {
      judgment_id: judgmentId,
      schema_version: JUDGMENT_SCHEMA_VERSION,
      subject_kind: input.subject.kind,
      subject_ref: input.subject.ref,
      judgment_kind: input.judgment_kind,
      outcome: input.outcome,
      facet: input.facet,
      confidence: input.confidence,
      access_method: input.access_method,
      source_locator: input.source_locator,
      basis_note: input.basis_note,
      judge: input.judge,
      run: input.run,
      context: input.context,
      parents,
      actor_user_id: args.actorUserId,
      ai_generated: true,
      created_at: now,
    });
    writtenThisCall.add(judgmentId);
    results.push({ judgment_id: judgmentId, created: true });
  }
  return results;
}

export function costBasisOf(value: unknown): JudgmentCostBasis {
  return value === "tool_list_price" || value === "api_invoice" || value === "subscription_unmetered" || value === "collaborator_reported"
    ? value
    : "unknown";
}
