import { v } from "convex/values";
import { hasPersonalDetails } from "./agentIntake";
import {
  JUDGMENT_SCHEMA_VERSION_1_1,
  SCORER_SIGNAL_VALUE_KEYS,
  judgmentAccessMethod,
  judgmentConfidence,
  judgmentContext,
  judgmentJudge,
  judgmentKind,
  judgmentRun,
  judgmentScore,
  judgmentSubjectKind,
  validateJudgmentInput,
  type JudgmentInput,
} from "./agentJudgments";

// the deterministic osm confidence scorer's judgments (agent-judgment.v1.1;
// docs/development/agent-judgments.md). the converter and the gated ingest
// share this strict validator, so a row the converter writes is exactly a row
// the backend accepts and nothing else is. rows are place-level: no task,
// draft or version link, so a judgment cannot be misfiled under a task.

export { SCORER_SIGNAL_VALUE_KEYS };
export const SCORER_AGENT_NAME = "osm-confidence-scorer";

export const SCORER_FACET_BY_KIND: Readonly<Record<string, string | undefined>> = {
  registration_confidence: undefined,
  status_assessment: "status",
  location: "location",
  duplicate: "duplicate",
};

// a closed Convex object: a key outside it is refused before any handler runs
export const deterministicJudgmentInput = v.object({
  schema_version: v.literal(JUDGMENT_SCHEMA_VERSION_1_1),
  subject: v.object({ kind: judgmentSubjectKind, ref: v.string() }),
  judgment_kind: judgmentKind,
  outcome: v.string(),
  facet: v.optional(v.string()),
  confidence: v.optional(judgmentConfidence),
  access_method: v.optional(judgmentAccessMethod),
  source_locator: v.optional(v.string()),
  basis_note: v.optional(v.string()),
  score: v.optional(judgmentScore),
  judge: judgmentJudge,
  run: judgmentRun,
  context: judgmentContext,
});


// the scorer configuration's closed vocabularies (scorer p2-heuristic-0.2.0).
// a term outside them is refused, so a stored row can carry only names the
// scorer defines, never text copied from a tag. a new scorer version that adds
// a term needs a reviewed change here.
export const SCORER_SIGNALS_FIRED: Readonly<Record<"identity" | "location" | "status" | "denomination", readonly string[]>> = {
  identity: ["name_specific", "name_generic", "name_placeholder", "name_missing", "building_worship_specific", "node_in_worship_building", "wikidata", "religion_present", "religion_missing", "duplicate_within_radius", "node_inside_pow_area", "same_name_nearby", "contributors_three_plus", "import_single_version", "sparse_tags", "cross_source_one", "cross_source_two_plus"],
  location: ["area_small", "area_medium", "area_large", "node_in_building", "node_in_religious_landuse", "node_not_in_building", "address", "coincident_other_pow", "node_import_single_version", "cross_source_within_tolerance", "cross_source_beyond_only"],
  status: ["own_lifecycle_tag", "end_date_passed", "ruins", "name_lifecycle_word", "name_old_prefix", "lifecycle_neighbour", "check_recent", "check_older", "website_or_contact", "opening_or_service_times", "edit_recent", "edit_stale", "contributors_three_plus", "historic_tag", "start_date_after_edition", "cross_source_active_listing", "cross_source_former"],
  denomination: ["religion_missing", "denomination_missing", "name_consistent", "name_conflict", "wikidata", "cross_source_religion_agrees", "cross_source_religion_disagrees"],
};
export const SCORER_TIER_REASONS: readonly string[] = ["composite_below_0.6", "generic_name_no_cross_source_match", "sensitivity", "composite_0.6_to_0.9", "conflict", "duplicate", "identity_below_0.7", "location_below_0.7", "status_below_0.7", "denomination_below_0.7", "generic_name_cross_source_pending"];
export const SCORER_TIER_PENDING: readonly string[] = ["cross_source_match"];
export const SCORER_CONFLICT_REASONS: readonly string[] = ["lifecycle_tag_with_active_amenity", "end_date_passed_with_active_amenity", "ruins_with_active_amenity", "lifecycle_word_in_name", "name_contradicts_religion_or_denomination", "start_date_after_edition", "cross_source_former_place_of_worship"];

// the basis note is generated from validated fields only, and the validator
// requires exactly this text, so no free text can reach a stored scorer row
export function scorerBasisNote(input: JudgmentInput): string {
  const score = input.score!;
  const c = score.components;
  const i = score.indicators;
  const list = (terms: readonly string[]) => (terms.length > 0 ? terms.join(", ") : "none");
  const converter = (input.run.agent_run_id ?? "").split(":").pop();
  return [
    `standard ${input.judge.standard_version}`,
    `scorer ${input.judge.prompt_version} (uncalibrated heuristic, not a probability)`,
    `code ${(input.judge.code_revision ?? "").slice(0, 12)}`,
    `vectors ${(input.judge.signal_vector_sha256 ?? "").slice(0, 12)}`,
    `edition ${score.edition_id}`,
    `composite = identity \u00d7 location \u00d7 status = ${score.composite} (identity ${c.identity}, location ${c.location}, status ${c.status}; denomination ${c.denomination} is reported beside it)`,
    `tier ${score.tier} (reasons ${list(score.tier_reasons)}; pending ${list(score.tier_pending)})`,
    `indicators duplicate=${i.duplicate} conflict=${i.conflict} generic_name=${i.generic_name} missing_name=${i.missing_name} cross_source=${i.cross_source_match}`,
    `mapping osm-confidence-judgments/${converter}`,
  ].join("; ");
}

const SUBJECT_REF = /^osm:(node|way|relation)\/[0-9]+$/;
const CODE_REVISION = /^[0-9a-f]{40}$/;
const EDITION_ID = /^osm-pow:[a-z]{2}:edition:\d{4}-\d{2}-\d{2}:[0-9a-f]{12}$/;
const CONVERTER_VERSION = /^\d+\.\d+\.\d+$/;
const SCORER_VERSION = /^p\d+-heuristic-\d+\.\d+\.\d+$/;
const BASIS_ALPHABET = /^[A-Za-z0-9 ;:,.=×()\/#_-]+$/;

export function validateScorerJudgment(input: JudgmentInput): void {
  for (const key of Object.keys(input)) {
    if (!Object.prototype.hasOwnProperty.call(deterministicJudgmentInput.fields, key)) throw new Error(`A scorer judgment has no field ${key}.`);
  }
  validateJudgmentInput(input);
  if (input.schema_version !== JUDGMENT_SCHEMA_VERSION_1_1) throw new Error("A scorer judgment is agent-judgment.v1.1.");
  if (input.subject.kind !== "place" || !SUBJECT_REF.test(input.subject.ref)) {
    throw new Error("A scorer judgment is about an osm place, osm:<node|way|relation>/<id>.");
  }
  if (input.context.place_ref !== input.subject.ref) throw new Error("A scorer judgment's place reference equals its subject.");
  if (!/^[A-Z]{2}$/.test(input.context.country_code)) throw new Error("A scorer judgment names a two-letter upper-case country code.");
  if (input.context.task_id !== undefined || input.context.evidence_draft_id !== undefined || input.context.evidence_version_hash !== undefined) {
    throw new Error("A scorer judgment is place-level and names no task, draft or evidence version.");
  }
  if (!Object.prototype.hasOwnProperty.call(SCORER_FACET_BY_KIND, input.judgment_kind)) {
    throw new Error(`A scorer judgment is not of kind ${input.judgment_kind}.`);
  }
  if (input.facet !== SCORER_FACET_BY_KIND[input.judgment_kind]) {
    throw new Error(`A ${input.judgment_kind} scorer judgment has facet ${SCORER_FACET_BY_KIND[input.judgment_kind] ?? "(none)"}.`);
  }
  if (input.source_locator !== undefined) throw new Error("A scorer judgment carries no source locator; the signal-vector hash is on the judge.");
  if (input.judge.agent_name !== SCORER_AGENT_NAME) throw new Error(`A scorer judgment is made by ${SCORER_AGENT_NAME}.`);
  if (!SCORER_VERSION.test(input.judge.prompt_version)) throw new Error("A scorer judgment names its scorer configuration version, for example p2-heuristic-0.2.0.");
  if (input.judge.code_revision === undefined || !CODE_REVISION.test(input.judge.code_revision)) throw new Error("A scorer judgment names a 40-digit lower-case hex code revision.");
  if (input.run.attempt !== 1) throw new Error("A scorer judgment is attempt 1.");
  if (input.run.batch_id !== undefined || input.run.cost_usd !== undefined) throw new Error("A scorer run carries no batch id or cost value.");
  const score = input.score;
  if (score === undefined || !EDITION_ID.test(score.edition_id)) throw new Error("A scorer score names its edition, osm-pow:<country>:edition:<date>:<hash prefix>.");
  if (score.edition_id.split(":")[1].toUpperCase() !== input.context.country_code) {
    throw new Error("A scorer score's edition is in the judgment's country.");
  }
  const runPrefix = `osm-confidence:${score.edition_id}:${(input.judge.signal_vector_sha256 ?? "").slice(0, 12)}:`;
  if (input.run.agent_run_id === undefined || !input.run.agent_run_id.startsWith(runPrefix) || !CONVERTER_VERSION.test(input.run.agent_run_id.slice(runPrefix.length))) {
    throw new Error("A scorer run id is osm-confidence:<edition>:<vector hash prefix>:<converter version>.");
  }
  for (const component of ["identity", "location", "status", "denomination"] as const) {
    for (const term of score.signals_fired[component]) {
      if (!SCORER_SIGNALS_FIRED[component].includes(term)) throw new Error(`Signal ${term} is not in the scorer's ${component} vocabulary.`);
    }
  }
  for (const term of score.tier_reasons) if (!SCORER_TIER_REASONS.includes(term)) throw new Error(`Tier reason ${term} is not in the scorer's vocabulary.`);
  for (const term of score.tier_pending) if (!SCORER_TIER_PENDING.includes(term)) throw new Error(`Pending condition ${term} is not in the scorer's vocabulary.`);
  for (const term of score.indicators.conflict_reasons) if (!SCORER_CONFLICT_REASONS.includes(term)) throw new Error(`Conflict reason ${term} is not in the scorer's vocabulary.`);
  if (input.basis_note === undefined || input.basis_note === "") throw new Error("A scorer judgment carries a basis note.");
  if (!BASIS_ALPHABET.test(input.basis_note)) throw new Error("A scorer basis note uses only the closed character set.");
  if (hasPersonalDetails(input.basis_note)) throw new Error("A scorer basis note may carry no personal details.");
  if (input.basis_note !== scorerBasisNote(input)) throw new Error("A scorer basis note is the generated text for its fields.");
}
