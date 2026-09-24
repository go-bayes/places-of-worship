import firstPassSchema from "../../scripts/agent_research/schemas/agent-first-pass.v1.json" with { type: "json" };
import bundleSchema from "../../scripts/agent_research/schemas/agent-review-bundle.v1.json" with { type: "json" };
import { canonicalWireJson } from "./wireJson.ts";
import { assertNoDuplicateJsonKeys, assertScreened, dateBounds, guard, publicUrl, schemaCheck, SCREEN_HASH_FIELDS, screenedStrings, validateStandaloneDossier } from "./agentIntake.ts";
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

const SCHEMA_OVERRIDES: Record<string, [any, any]> = {
  // the embedded dossier is walked against its own schema
  dossier: [(bundleSchema as any).$defs.dossier, bundleSchema],
};

// every string in the record and its embedded dossier that could carry a
// personal detail, by path: each string value, and each object key the schema
// does not declare (free-form maps such as seed_tags or usage). reviewers read
// receipts, so a record whose text carries a phone, email or honorific-led
// name is refused at the backend and stays in the operator's own archive for
// human handling. the only strings left out are those the schema constrains
// to a closed vocabulary or a fixed shape (enum, const or pattern: hashes,
// timestamps, dates, place refs, country codes) and values shaped as a hex
// hash. first_pass.py screened_text mirrors this walk.
export function screenedText(record: unknown): Array<[string, string]> {
  return screenedStrings(record, firstPassSchema, firstPassSchema, SCHEMA_OVERRIDES);
}

// Inspection adapters have their own schema, but need the same exhaustive
// value-and-key walk and detector as first-pass receipts. No free-text field
// is exempt merely because its name looks like metadata.
export function screenAllText(value: unknown): string[] {
  const hits: string[] = [];
  const visit = (part: unknown, path: string): void => {
    if (typeof part === "string") {
      if (hasPersonalDetails(part)) hits.push(path);
    } else if (Array.isArray(part)) {
      part.forEach((child, index) => visit(child, `${path}[${index}]`));
    } else if (part !== null && typeof part === "object") {
      for (const [key, child] of Object.entries(part)) {
        const childPath = path === "" ? key : `${path}.${key}`;
        if (hasPersonalDetails(key)) hits.push(`${childPath} (key)`);
        visit(child, childPath);
      }
    }
  };
  visit(value, "");
  return hits;
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
  // python reads 1.0 as a float and 1 as an int; the schema check applies that
  // distinction so every accepted record also passes first_pass.py restore
  const floats = new Set<string>();
  canonicalWireJson(recordJson.slice(0, -1), floats);
  schemaCheck(parsed, firstPassSchema, "$", firstPassSchema, floats);
  assertScreened(parsed, firstPassSchema, firstPassSchema, SCREEN_HASH_FIELDS["agent-first-pass.v1"], { overrides: SCHEMA_OVERRIDES });
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
    claimIds = new Set(validateStandaloneDossier(record.dossier, floats).keys());
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
