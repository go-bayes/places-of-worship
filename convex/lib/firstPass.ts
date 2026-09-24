import firstPassSchema from "../../scripts/agent_research/schemas/agent-first-pass.v1.json" with { type: "json" };
import { assertNoDuplicateJsonKeys, dateBounds, guard, hasPersonalDetails, publicUrl, schemaCheck, validateStandaloneDossier } from "./agentIntake.ts";
import { verifyObjectBytes } from "./objectReceipts.ts";

// server-side validation of an agent-first-pass.v1 record, mirroring
// scripts/agent_research/first_pass.py validate(). the archive writes the
// canonical bytes; the server re-checks the address, the shape and every
// cross-field rule, because a record reaching the backend is untrusted input
// until it passes here. the record stays provisional whatever it says.

export const FIRST_PASS_SCHEMA_VERSION = "agent-first-pass.v1";

export type FirstPassSearch = {
  query: string;
  locator: string | null;
  outcome: "opened" | "snippet_only" | "blocked" | "no_results" | "not_attempted";
  note: string;
  source_name: string | null;
  attempted_at: string | null;
  retrieved_at: string | null;
  licence_note: string;
  access_note: string;
};

export type FirstPassRecord = {
  schema_version: "agent-first-pass.v1";
  disposition: "provisional";
  place_ref: string;
  country_code: string;
  question: string;
  outcome: "partial" | "blocked" | "researched";
  stop_reason: string;
  created_at: string;
  parents: string[];
  attribution: {
    responsible_human_ref: string;
    agent_run_id: string;
    model_requested: string;
    model_reported: string | null;
    model_unreported_reason: string | null;
    code_revision: string;
    instruction_sha256: string;
    definition_sha256: string;
  };
  usage: { cost_usd: number | null; cost_basis: "tool_list_price" | "api_invoice" | "subscription_unmetered" | "unknown"; note: string };
  dossier: Record<string, any> | null;
  annotations: Array<{ claim_id: string; kind: "qualification" | "disagreement" | "follow_up"; note: string }>;
  searches: FirstPassSearch[];
  next_questions: string[];
  context?: { task_id?: string; evidence_draft_id?: string; evidence_version_hash?: string; assistance_request_id?: string };
};

// an iso timestamp as the schema pattern writes it, with a real calendar date
function timestamp(value: string, label: string): number {
  try {
    dateBounds(value.slice(0, 10));
  } catch {
    throw new Error(`invalid ${label}`);
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`invalid ${label}`);
  return parsed;
}

// the record's free text, by path. reviewers read receipts, so a record whose
// text carries a phone, email or honorific-led name is refused at the backend
// and stays in the operator's private archive for human handling
// (docs/development/agent-first-passes.md; the dossier's claims are screened
// by validateStandaloneDossier). first_pass.py personal_detail_fields mirrors
// this list.
export function firstPassFreeText(record: FirstPassRecord): Array<[string, string]> {
  const fields: Array<[string, string]> = [
    ["question", record.question],
    ["stop_reason", record.stop_reason],
    ["usage.note", record.usage.note],
    ["attribution.responsible_human_ref", record.attribution.responsible_human_ref],
  ];
  if (record.attribution.model_unreported_reason !== null) fields.push(["attribution.model_unreported_reason", record.attribution.model_unreported_reason]);
  record.annotations.forEach((annotation, i) => fields.push([`annotations[${i}].note`, annotation.note]));
  record.searches.forEach((search, i) => {
    for (const key of ["query", "note", "source_name", "licence_note", "access_note"] as const) {
      const value = search[key];
      if (value !== null) fields.push([`searches[${i}].${key}`, value]);
    }
  });
  record.next_questions.forEach((question, i) => fields.push([`next_questions[${i}]`, question]));
  const basis = record.dossier?.status_assessment?.basis;
  if (typeof basis === "string") fields.push(["dossier.status_assessment.basis", basis]);
  return fields;
}

export function validateFirstPassRecord(recordJson: string, recordHash: string): { record: FirstPassRecord; byteLength: number } {
  const { byteLength } = verifyObjectBytes(recordJson, recordHash);
  assertNoDuplicateJsonKeys(recordJson);
  let parsed: unknown;
  try {
    parsed = JSON.parse(recordJson);
  } catch {
    throw new Error("recordJson must be valid JSON");
  }
  guard(parsed);
  schemaCheck(parsed, firstPassSchema, "$", firstPassSchema);
  const record = parsed as FirstPassRecord;
  timestamp(record.created_at, "creation timestamp");
  if (new Set(record.parents).size !== record.parents.length) throw new Error("duplicate parent hash");
  if (record.parents.includes(recordHash)) throw new Error("a record cannot be its own parent");
  const attribution = record.attribution;
  if ((attribution.model_reported === null) !== (attribution.model_unreported_reason !== null)) {
    throw new Error("an unreported model requires a reason; a reported model must omit that reason");
  }
  const usage = record.usage;
  if ((usage.cost_basis === "unknown" || usage.cost_basis === "subscription_unmetered") && usage.cost_usd !== null) {
    throw new Error("unknown or unmetered cost must remain null");
  }
  if ((usage.cost_basis === "tool_list_price" || usage.cost_basis === "api_invoice") && usage.cost_usd === null) {
    throw new Error("reported monetary cost requires a value");
  }
  let claimIds = new Set<string>();
  if (record.dossier !== null) {
    claimIds = new Set(validateStandaloneDossier(record.dossier).keys());
    if (record.dossier.place.place_ref !== record.place_ref) throw new Error("dossier belongs to another place");
    // an attribution naming the dossier's own run describes that one run, so
    // its models must be the run manifest's
    const manifest = record.dossier.run_manifest;
    if (attribution.agent_run_id === manifest.run_id
      && (attribution.model_requested !== manifest.model_id_requested || attribution.model_reported !== (manifest.model_id_reported ?? null))) {
      throw new Error("attribution names the dossier's run but disagrees with its models");
    }
  }
  if (record.outcome === "researched" && record.dossier === null) throw new Error("researched requires a validated dossier");
  if ((record.outcome === "partial" || record.outcome === "blocked") && record.next_questions.length === 0) {
    throw new Error("unfinished research requires a next question");
  }
  for (const annotation of record.annotations) {
    if (!claimIds.has(annotation.claim_id)) throw new Error("annotation references an unknown claim");
  }
  for (const [path, text] of firstPassFreeText(record)) {
    if (hasPersonalDetails(text)) throw new Error(`potential personal details in ${path} require human handling`);
  }
  for (const search of record.searches) {
    const attempted = search.attempted_at === null ? null : timestamp(search.attempted_at, "search attempted_at");
    const retrieved = search.retrieved_at === null ? null : timestamp(search.retrieved_at, "search retrieved_at");
    if (attempted !== null && retrieved !== null && retrieved < attempted) throw new Error("search retrieval precedes its attempt");
    if (search.outcome === "not_attempted" && (attempted !== null || retrieved !== null)) throw new Error("unattempted search cannot have access timestamps");
    if ((search.outcome === "blocked" || search.outcome === "no_results") && retrieved !== null) throw new Error("unsuccessful search cannot report retrieved content");
    if (search.locator !== null) {
      try {
        publicUrl(search.locator);
      } catch {
        throw new Error("search locator must be a public HTTP(S) URL");
      }
    }
    if ((search.outcome === "opened" || search.outcome === "snippet_only" || search.outcome === "blocked") && search.locator === null) {
      throw new Error("source access outcome requires a locator");
    }
  }
  return { record, byteLength };
}
