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
// v1.1 widens v1 for deterministic scorer judgments: a judge kind, the
// standard version, the signal-vector hash, a score block and a cost basis
// for runs that call no model. v1 stays the default, so every existing
// writer and every existing id is unchanged.
export const JUDGMENT_SCHEMA_VERSION_1_1 = "agent-judgment.v1.1";
export const judgmentSchemaVersion = v.union(v.literal(JUDGMENT_SCHEMA_VERSION), v.literal(JUDGMENT_SCHEMA_VERSION_1_1));
export const JUDGMENT_STANDARD_VERSION_PATTERN = /^confidence-standard\/\d+\.\d+\.\d+$/;
export const SCORE_TERM_PATTERN = /^[a-z0-9_.]{1,64}$/;
export const SCORE_ARRAY_MAX = 40;

// numeric and boolean signals a scorer judgment may copy from its signal
// vector. a fixed allowlist, so no string-valued tag content (names, editors,
// dates, partner references) can travel into a judgment row.
const FLAG = { kind: "flag" } as const;
const count = (max: number) => ({ kind: "number", min: 0, max, integer: true }) as const;
const measure = (max: number) => ({ kind: "number", min: 0, max, integer: false }) as const;
export type SignalDomain = { kind: "flag" } | { kind: "number"; min: number; max: number; integer: boolean };
// each allowlisted signal has its own domain (a flag is a boolean or null; a
// count or measure is a bounded non-negative number or null), so a numeric
// field cannot carry an arbitrary number such as a telephone number
export const SCORER_SIGNAL_DOMAINS: Readonly<Record<string, SignalDomain>> = {
  "tag_completeness.score": { kind: "number", min: 0, max: 1, integer: false },
  tag_count: count(1_000),
  has_name: FLAG, has_religion: FLAG, has_denomination: FLAG, has_building: FLAG, has_address: FLAG,
  has_website_or_contact: FLAG, has_opening_or_service_times: FLAG, has_wikidata: FLAG, has_start_date: FLAG,
  has_check_date: FLAG, has_operator: FLAG, has_historic: FLAG, has_heritage: FLAG, has_tourism: FLAG,
  footprint_area_m2: measure(1e8), building_worship_specific: FLAG, building_generic: FLAG,
  node_in_building: FLAG, node_in_worship_building: FLAG, node_containing_building: FLAG, node_in_religious_landuse: FLAG,
  lifecycle_neighbour_60m: FLAG, days_since_last_edit: count(80_000), years_as_pow: measure(200),
  n_versions: count(100_000), n_contributors: count(100_000), deleted_and_recreated: FLAG,
  pow_created_in_bulk_or_import: FLAG, name_lifecycle_word: FLAG, name_old_prefix: FLAG, own_lifecycle_tag: FLAG,
  end_date_passed: FLAG, ruins: FLAG, nearest_pow_m: measure(2e7),
  n_pow_within_50m_same_or_unknown_religion: count(100_000), n_pow_coincident_1m: count(100_000),
  n_same_name_within_500m: count(100_000), node_area_pair: FLAG, "cross_source_agreement.n_sources_matched": count(100),
};
export const SCORER_SIGNAL_VALUE_KEYS: readonly string[] = Object.keys(SCORER_SIGNAL_DOMAINS);
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
  v.literal("registration_confidence"),
);

// the outcome vocabulary is fixed per kind; the helper refuses a mismatch
export const OUTCOMES_BY_KIND: Readonly<Record<JudgmentKind, readonly string[]>> = {
  claim_support: ["supported", "not_supported", "unclear", "unreachable", "requires_human_access"],
  recommendation: ["accept", "revise", "reject", "defer_cultural"],
  status_assessment: ["active", "likely_active", "likely_inactive", "inactive", "unknown"],
  annotation: ["qualification", "disagreement", "follow_up"],
  duplicate: ["same_place", "different_place", "unclear"],
  location: ["plausible", "implausible", "unclear"],
  // the provisional tier of the confidence standard; no tier accepts
  registration_confidence: ["screened", "review", "escalate"],
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
  // a deterministic pass bills no vendor; like unknown cost, it carries no value
  v.literal("no_model_call"),
);

export const judgmentJudgeKind = v.union(v.literal("model"), v.literal("deterministic"));

export const judgmentJudge = v.object({
  agent_name: v.string(),
  kind: v.optional(judgmentJudgeKind),
  model_provider: v.optional(v.string()),
  model_requested: v.optional(v.string()),
  model_reported: v.optional(v.string()),
  model_unreported_reason: v.optional(v.string()),
  prompt_version: v.string(),
  code_revision: v.optional(v.string()),
  instruction_sha256: v.optional(v.string()),
  standard_version: v.optional(v.string()),
  signal_vector_sha256: v.optional(v.string()),
});

const tierLiteral = v.union(v.literal("screened"), v.literal("review"), v.literal("escalate"));

export const judgmentScore = v.object({
  edition_id: v.string(),
  composite: v.number(),
  components: v.object({ identity: v.number(), location: v.number(), status: v.number(), denomination: v.number() }),
  tier: tierLiteral,
  tier_reasons: v.array(v.string()),
  tier_pending: v.array(v.string()),
  cut_points: v.object({ screened_min_composite: v.number(), review_min_composite: v.number(), component_floor: v.number() }),
  calibrated: v.boolean(),
  signals_fired: v.object({ identity: v.array(v.string()), location: v.array(v.string()), status: v.array(v.string()), denomination: v.array(v.string()) }),
  signal_values: v.record(v.string(), v.union(v.number(), v.boolean(), v.null())),
  indicators: v.object({
    duplicate: v.boolean(),
    conflict: v.boolean(),
    conflict_reasons: v.array(v.string()),
    generic_name: v.boolean(),
    missing_name: v.boolean(),
    cross_source_match: v.union(v.literal("not_computed"), v.literal("no_match"), v.literal("match")),
    cross_source_sources_matched: v.union(v.number(), v.null()),
  }),
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

export type JudgmentKind = "claim_support" | "recommendation" | "status_assessment" | "annotation" | "duplicate" | "location" | "registration_confidence";
export type JudgmentSchemaVersion = typeof JUDGMENT_SCHEMA_VERSION | typeof JUDGMENT_SCHEMA_VERSION_1_1;
export type JudgmentJudgeKind = "model" | "deterministic";
export type JudgmentTier = "screened" | "review" | "escalate";
export type JudgmentSubjectKind = "claim" | "evidence_draft" | "evidence_version" | "first_pass" | "place";
export type JudgmentAccessMethod = "opened" | "search_snippet" | "http_fetch" | "model_assessment" | "not_checked";
export type JudgmentCostBasis = "tool_list_price" | "api_invoice" | "subscription_unmetered" | "collaborator_reported" | "unknown" | "no_model_call";

export type JudgmentScore = {
  edition_id: string;
  composite: number;
  components: { identity: number; location: number; status: number; denomination: number };
  tier: JudgmentTier;
  tier_reasons: string[];
  tier_pending: string[];
  cut_points: { screened_min_composite: number; review_min_composite: number; component_floor: number };
  calibrated: boolean;
  signals_fired: { identity: string[]; location: string[]; status: string[]; denomination: string[] };
  signal_values: Record<string, number | boolean | null>;
  indicators: {
    duplicate: boolean;
    conflict: boolean;
    conflict_reasons: string[];
    generic_name: boolean;
    missing_name: boolean;
    cross_source_match: "not_computed" | "no_match" | "match";
    cross_source_sources_matched: number | null;
  };
};

export type JudgmentJudge = {
  agent_name: string;
  kind?: JudgmentJudgeKind;
  model_provider?: string;
  model_requested?: string;
  model_reported?: string;
  model_unreported_reason?: string;
  prompt_version: string;
  code_revision?: string;
  instruction_sha256?: string;
  standard_version?: string;
  signal_vector_sha256?: string;
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
  // absent means agent-judgment.v1, so existing writers are unchanged
  schema_version?: JudgmentSchemaVersion;
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
  // the deterministic scorer's numbers and fired signals (v1.1)
  score?: JudgmentScore;
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
    schema_version: input.schema_version ?? JUDGMENT_SCHEMA_VERSION,
    subject: { kind: input.subject.kind, ref: input.subject.ref },
    judgment_kind: input.judgment_kind,
    outcome: input.outcome,
    facet: input.facet,
    confidence: input.confidence,
    access_method: input.access_method,
    source_locator: input.source_locator,
    basis_note: input.basis_note,
    // undefined keys are dropped by canonicalJson, so v1 ids are unchanged
    score: input.score,
    judge: input.judge,
    run: input.run,
    context: input.context,
  };
}

export function judgmentIdFor(input: JudgmentInput): string {
  return sha256(canonicalJson(judgmentEnvelope(input)));
}

function inUnitInterval(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function assertTerms(label: string, terms: readonly string[]): void {
  if (terms.length > SCORE_ARRAY_MAX) throw new Error(`${label} holds at most ${SCORE_ARRAY_MAX} entries.`);
  for (const term of terms) {
    if (typeof term !== "string" || !SCORE_TERM_PATTERN.test(term)) throw new Error(`${label} entries are short lower-case term names.`);
  }
}

function validateScoreBlock(input: JudgmentInput, score: JudgmentScore): void {
  const numbers: Array<[string, unknown]> = [
    ["composite", score.composite],
    ["identity component", score.components.identity],
    ["location component", score.components.location],
    ["status component", score.components.status],
    ["denomination component", score.components.denomination],
    ["screened_min_composite", score.cut_points.screened_min_composite],
    ["review_min_composite", score.cut_points.review_min_composite],
    ["component_floor", score.cut_points.component_floor],
  ];
  for (const [label, value] of numbers) {
    if (!inUnitInterval(value)) throw new Error(`Score ${label} is a finite number in [0, 1].`);
  }
  if (input.judgment_kind === "registration_confidence" && score.tier !== input.outcome) {
    throw new Error("A registration_confidence outcome equals the score tier.");
  }
  assertTerms("Score tier_reasons", score.tier_reasons);
  assertTerms("Score tier_pending", score.tier_pending);
  assertTerms("Score conflict_reasons", score.indicators.conflict_reasons);
  const matched = score.indicators.cross_source_sources_matched;
  if (matched !== null && (!Number.isInteger(matched) || matched < 0 || matched > 100)) {
    throw new Error("Score cross_source_sources_matched is a count from 0 to 100, or null.");
  }
  for (const component of ["identity", "location", "status", "denomination"] as const) {
    assertTerms(`Score signals_fired.${component}`, score.signals_fired[component]);
  }
  for (const [key, value] of Object.entries(score.signal_values)) {
    const domain = Object.prototype.hasOwnProperty.call(SCORER_SIGNAL_DOMAINS, key) ? SCORER_SIGNAL_DOMAINS[key] : undefined;
    if (domain === undefined) throw new Error(`Score signal value ${key} is not in the allowlist.`);
    if (value === null) continue;
    if (domain.kind === "flag") {
      if (typeof value !== "boolean") throw new Error(`Score signal value ${key} is a boolean or null.`);
    } else if (typeof value !== "number" || !Number.isFinite(value) || value < domain.min || value > domain.max || (domain.integer && !Number.isInteger(value))) {
      throw new Error(`Score signal value ${key} is a finite number in its domain, or null.`);
    }
  }
}

function validateJudgeAndScore(input: JudgmentInput): void {
  const judge = input.judge;
  const version = input.schema_version ?? JUDGMENT_SCHEMA_VERSION;
  const deterministic = judge.kind === "deterministic";
  if (version === JUDGMENT_SCHEMA_VERSION_1_1) {
    if (judge.standard_version === undefined || !JUDGMENT_STANDARD_VERSION_PATTERN.test(judge.standard_version)) {
      throw new Error("An agent-judgment.v1.1 judge names the confidence standard version, as confidence-standard/<major>.<minor>.<patch>.");
    }
  }
  if (deterministic) {
    if (version !== JUDGMENT_SCHEMA_VERSION_1_1) throw new Error("A deterministic judge requires agent-judgment.v1.1.");
    if (judge.code_revision === undefined || judge.code_revision.trim() === "") throw new Error("A deterministic judge names its code revision.");
    if (judge.signal_vector_sha256 === undefined || !/^[0-9a-f]{64}$/.test(judge.signal_vector_sha256)) {
      throw new Error("A deterministic judge names the sha256 of its signal vectors.");
    }
    if (judge.model_provider !== undefined || judge.model_requested !== undefined || judge.model_reported !== undefined
      || judge.model_unreported_reason !== undefined || judge.instruction_sha256 !== undefined) {
      throw new Error("A deterministic judge carries no model fields or instruction hash.");
    }
    if (input.access_method !== undefined || input.confidence !== undefined) {
      throw new Error("A deterministic judgment carries no access method or categorical confidence.");
    }
    if (input.run.cost_basis !== "no_model_call") throw new Error("A deterministic judge has cost basis no_model_call.");
    if (input.score === undefined) throw new Error("A deterministic judgment carries its score block.");
  } else {
    if (judge.kind !== undefined && judge.kind !== "model") throw new Error(`Unknown judge kind ${judge.kind}.`);
    if (judge.model_provider === undefined || judge.model_requested === undefined) {
      throw new Error("A model judge names its provider and the model requested.");
    }
    if ((judge.model_reported === undefined) === (judge.model_unreported_reason === undefined)) {
      throw new Error("A judge reports a model id or gives the reason it could not.");
    }
    if (input.score !== undefined) throw new Error("Only a deterministic judgment carries a score block.");
    if (input.run.cost_basis === "no_model_call") throw new Error("Cost basis no_model_call belongs to a deterministic judge.");
    if (judge.signal_vector_sha256 !== undefined) throw new Error("Only a deterministic judge names a signal-vector hash.");
  }
  if (input.run.cost_basis === "no_model_call" && input.run.cost_usd !== undefined) {
    throw new Error("A run that called no model has no cost value.");
  }
  if (input.score !== undefined) validateScoreBlock(input, input.score);
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
  validateJudgeAndScore(input);
  if (input.run.cost_basis === "unknown" || input.run.cost_basis === "subscription_unmetered" || input.run.cost_basis === "no_model_call") {
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
    // the lineage index holds exactly the rows a re-judgment revises, newest
    // first, so the read stays bounded however many judgments the subject
    // has gathered from other lanes (a missing facet or source is indexed as
    // undefined and matched by eq undefined)
    const lineage: Doc<"agent_judgments">[] = await ctx.db
      .query("agent_judgments")
      .withIndex("by_lineage", (q) => q
        .eq("subject_ref", input.subject.ref)
        .eq("judgment_kind", input.judgment_kind)
        .eq("judge.agent_name", input.judge.agent_name)
        .eq("facet", input.facet)
        .eq("source_locator", input.source_locator))
      .order("desc")
      .take(JUDGMENT_PARENTS_MAX);
    const parents = lineage.map((row) => row.judgment_id);
    await ctx.db.insert("agent_judgments", {
      judgment_id: judgmentId,
      schema_version: input.schema_version ?? JUDGMENT_SCHEMA_VERSION,
      subject_kind: input.subject.kind,
      subject_ref: input.subject.ref,
      judgment_kind: input.judgment_kind,
      outcome: input.outcome,
      facet: input.facet,
      confidence: input.confidence,
      access_method: input.access_method,
      source_locator: input.source_locator,
      basis_note: input.basis_note,
      score: input.score,
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
