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

const SUBJECT_REF = /^osm:(node|way|relation)\/[0-9]+$/;
const PROMPT_VERSION = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const RUN_ID = /^osm-confidence:[a-z0-9:._-]+:[0-9a-f]{12}:[a-z0-9.-]+$/;
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
  if (!PROMPT_VERSION.test(input.judge.prompt_version)) throw new Error("A scorer judgment names its scorer configuration version.");
  if (input.run.attempt !== 1) throw new Error("A scorer judgment is attempt 1.");
  if (input.run.agent_run_id === undefined || !RUN_ID.test(input.run.agent_run_id)) {
    throw new Error("A scorer run id is osm-confidence:<edition>:<vector hash prefix>:<converter version>.");
  }
  if (input.basis_note === undefined || input.basis_note === "") throw new Error("A scorer judgment carries a basis note.");
  if (!BASIS_ALPHABET.test(input.basis_note)) throw new Error("A scorer basis note uses only the closed character set.");
  if (hasPersonalDetails(input.basis_note)) throw new Error("A scorer basis note may carry no personal details.");
  const edition = input.score?.edition_id.split(":");
  if (edition === undefined || edition.length < 2 || edition[1].toUpperCase() !== input.context.country_code) {
    throw new Error("A scorer score's edition is in the judgment's country.");
  }
}
