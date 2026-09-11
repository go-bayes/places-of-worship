import { canonicalJson, sha256 } from "./sha256.ts";
import bundleSchema from "../../scripts/agent_research/schemas/agent-review-bundle.v1.json" with { type: "json" };

export type AgentReviewBundle = {
  schema_version: "agent-review-bundle.v1";
  submission_key: string;
  dossier: Record<string, any>;
  review: {
    schema_version: "agent-review.v1";
    recommendation: "accept" | "revise" | "reject" | "defer_cultural";
    reasoning: string;
    claim_checks: Array<{
      claim_id: string;
      outcome: "supported" | "not_supported" | "unclear" | "unreachable" | "requires_human_access";
      source_url: string;
      note: string;
      access_method: "opened" | "search_snippet" | "not_checked";
    }>;
    cultural_sensitivity: { flagged: boolean; basis: string };
    limitations: string[];
  };
  research_run: AgentRun;
  review_run: AgentRun;
};

export type AgentRun = {
  backend: "claude" | "codex";
  model_requested: "gpt-5.6-luna" | "sonnet";
  model_id_reported: string | null;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  usage: Record<string, any> | null;
  raw_trace_sha256: string;
  prompt_sha256: string;
  cli_version: string;
  exit_code: 0;
  tool_policy_version: "public-web-only.v1";
};

// apply the self-contained transport schema without resolving external references.
function schemaCheck(value: any, schema: any, path = "$", root: any = bundleSchema): void {
  if (schema.$ref) {
    if (!schema.$ref.startsWith("#/")) throw new Error("external schema reference");
    let target = root;
    for (const part of schema.$ref.slice(2).split("/")) target = target[part];
    return schemaCheck(value, target, path, root);
  }
  const kinds = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
  const matches = (kind: string): boolean => kind === "null" ? value === null : kind === "array" ? Array.isArray(value) : kind === "object" ? value !== null && typeof value === "object" && !Array.isArray(value) : kind === "integer" ? Number.isInteger(value) : typeof value === kind;
  if (kinds.length && !kinds.some(matches)) throw new Error(`${path}: invalid type`);
  if ("const" in schema && value !== schema.const) throw new Error(`${path}: invalid constant`);
  if (schema.enum && !schema.enum.includes(value)) throw new Error(`${path}: invalid enum`);
  if (typeof value === "string") {
    const length = [...value].length;
    if (length < (schema.minLength ?? 0) || length > (schema.maxLength ?? Infinity) || (schema.pattern && !new RegExp(schema.pattern).test(value))) throw new Error(`${path}: invalid string`);
  }
  if (typeof value === "number" && (!Number.isFinite(value) || value < (schema.minimum ?? -Infinity) || value > (schema.maximum ?? Infinity))) throw new Error(`${path}: invalid number`);
  if (Array.isArray(value)) {
    if (value.length < (schema.minItems ?? 0) || value.length > (schema.maxItems ?? Infinity)) throw new Error(`${path}: invalid array size`);
    value.forEach((item, i) => { if (schema.items) schemaCheck(item, schema.items, `${path}[${i}]`, root); });
  } else if (value !== null && typeof value === "object") {
    for (const key of schema.required ?? []) if (!Object.hasOwn(value, key)) throw new Error(`${path}: missing ${key}`);
    for (const [key, item] of Object.entries(value)) {
      if (Object.hasOwn(schema.properties ?? {}, key)) schemaCheck(item, schema.properties[key], `${path}.${key}`, root);
      else if (schema.additionalProperties === false) throw new Error(`${path}: unknown field ${key}`);
    }
  }
}

// reject deep, non-finite, prototype-like, and control-bearing values everywhere.
function guard(value: any, depth = 0): void {
  if (depth > 32) throw new Error("JSON exceeds depth limit");
  if (typeof value === "number" && !Number.isFinite(value)) throw new Error("non-finite JSON number");
  if (typeof value === "string" && /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new Error("control character in JSON");
  if (Array.isArray(value)) value.forEach(item => guard(item, depth + 1));
  else if (value !== null && typeof value === "object") for (const [key, child] of Object.entries(value)) {
    if (["__proto__", "constructor", "prototype"].includes(key)) throw new Error("forbidden JSON key");
    guard(key, depth + 1); guard(child, depth + 1);
  }
}

// validate calendar dates without JavaScript's rollover of impossible dates.
function dateBounds(value: string): [string, string] {
  if (!/^\d{4}(-\d{2}(-\d{2})?)?$/.test(value)) throw new Error("invalid partial ISO date");
  const [year, month = 1, day = 1] = value.split("-").map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]) throw new Error("invalid calendar date");
  return [value.padEnd(7, "-01").slice(0, 7) + (value.length === 10 ? value.slice(7) : "-01"), value.length === 4 ? value + "-12-31" : value.length === 7 ? value + "-" + days[month - 1] : value];
}

// intake never fetches URLs; reject credentials and non-public literal destinations.
function publicUrl(value: string): void {
  if (/[\s\\\u007f]/.test(value)) throw new Error("invalid public HTTP(S) URL");
  if (/^[^:]+:\/\/[^/?#]*@/.test(value)) throw new Error("invalid public HTTP(S) URL");
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("invalid public HTTP(S) URL"); }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.port === "0" || !host || host === "localhost" || /\.(localhost|local|internal)$/.test(host) || host.includes("%")) throw new Error("invalid public HTTP(S) URL");
  // numeric hosts have inconsistent interpretations across URL implementations.
  if (/^[0-9.]+$/.test(host) || host.includes(":")) throw new Error("source URL must use a public DNS hostname");
}

// validate the exact bytes and cross-field evidence relations before any database writes.
export function validateAgentReviewBundle(value: unknown, bundleJson: string): { bundle: AgentReviewBundle; bundleHash: string; claimLocators: Map<string, string> } {
  assertNoDuplicateJsonKeys(bundleJson);
  const parsed = JSON.parse(bundleJson);
  guard(parsed); guard(value);
  if (canonicalJson(parsed) !== canonicalJson(value)) throw new Error("parsed bundle differs from supplied bytes");
  schemaCheck(value, bundleSchema);
  const bundle = value as AgentReviewBundle;
  const d = bundle.dossier;
  if (d.place.country_code !== "NZ") throw new Error("internal pilot requires NZ");
  const models = { claude: "sonnet", codex: "gpt-5.6-luna" };
  if (bundle.research_run.backend === bundle.review_run.backend) throw new Error("research and review backends must differ");
  for (const run of [bundle.research_run, bundle.review_run]) {
    if (models[run.backend] !== run.model_requested) throw new Error("backend/model mismatch");
    dateBounds(run.started_at.split("T")[0]); dateBounds(run.ended_at.split("T")[0]);
    const start = Date.parse(run.started_at), end = Date.parse(run.ended_at);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) throw new Error("invalid run timestamp");
  }
  if (d.run_manifest.backend !== bundle.research_run.backend || d.run_manifest.model_id_requested !== bundle.research_run.model_requested || d.run_manifest.exit_status !== "completed") throw new Error("inconsistent dossier run provenance");
  dateBounds(d.run_manifest.started_at.split("T")[0]); dateBounds(d.run_manifest.ended_at.split("T")[0]);
  const manifestStart = Date.parse(d.run_manifest.started_at), manifestEnd = Date.parse(d.run_manifest.ended_at);
  if (!Number.isFinite(manifestStart) || !Number.isFinite(manifestEnd) || manifestEnd < manifestStart) throw new Error("invalid dossier run timestamp");
  const locators = new Map<string, string>();
  for (const claim of d.claims) {
    if (locators.has(claim.claim_id)) throw new Error("duplicate claim ID");
    for (const field of ["value", "quoted_support", "note"]) {
      const text = claim[field] ?? "";
      if (/(?:\+64|\b0)[\s-]?\d{1,2}[\s-]?\d{3,4}[\s-]?\d{3,5}\b/.test(text) || /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(text) || /\b(?:Rev(?:'d|erend|d)?\.?|Fr\.?|Father|Pastor|Vicar|Archdeacon|Bishop|Canon|Dean|Mr|Mrs|Ms|Dr)\s+(?:[A-Z][a-zA-Z'-]+\s?){1,3}/.test(text)) throw new Error("potential personal details require human handling");
    }
    publicUrl(claim.source.locator); locators.set(claim.claim_id, claim.source.locator);
    if (claim.reader.backend !== d.run_manifest.backend || ![d.run_manifest.model_id_requested, d.run_manifest.model_id_reported].includes(claim.reader.model_id)) throw new Error("inconsistent claim reader");
    for (const key of ["date_start", "date_end"]) if (claim[key] != null) {
      dateBounds(claim[key]);
      const precision = ({day:10,month:7,year:4} as Record<string, number>)[claim.date_precision];
      if (precision && claim[key].length !== precision) throw new Error("date precision mismatch");
    }
    if (claim.date_end && (!claim.date_start || dateBounds(claim.date_start)[0] > dateBounds(claim.date_end)[1])) throw new Error("invalid date interval");
    for (const key of ["source_date", "retrieved_at"]) if (claim.source[key]) dateBounds(claim.source[key].split("T")[0]);
  }
  dateBounds(d.status_assessment.asof_date);
  for (const id of d.status_assessment.supporting_claim_ids) if (!locators.has(id)) throw new Error("unknown status claim");
  for (const row of d.osm_version_chain) publicUrl(row.locator);
  const checked = new Set<string>();
  for (const check of bundle.review.claim_checks) {
    if (checked.has(check.claim_id) || locators.get(check.claim_id) !== check.source_url) throw new Error("review must cover every claim uniquely at its source_url");
    checked.add(check.claim_id);
    if (check.access_method === "not_checked" && check.outcome === "supported") throw new Error("unchecked source cannot be supported");
    if (bundle.review.recommendation === "accept" && (check.outcome !== "supported" || check.access_method !== "opened")) throw new Error("accept requires opened supported sources");
  }
  if (checked.size !== locators.size) throw new Error("review must cover every claim");
  if (bundle.review.cultural_sensitivity.flagged && bundle.review.recommendation !== "defer_cultural") throw new Error("sensitive review must defer");
  return { bundle, bundleHash: sha256(bundleJson), claimLocators: locators };
}

// scan string tokens only; a following colon identifies an object key even inside arrays.
export function assertNoDuplicateJsonKeys(source: string): void {
  if (new TextEncoder().encode(source).length > 65536) throw new Error("bundle exceeds 64 KB");
  const stack: Array<Set<string> | null> = [];
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{" || ch === "[") { stack.push(ch === "{" ? new Set() : null); if (stack.length > 33) throw new Error("JSON exceeds depth limit"); }
    else if (ch === "}" || ch === "]") stack.pop();
    else if (ch === '"') {
      const start = i++;
      for (; i < source.length; i++) { if (source[i] === "\\") i++; else if (source[i] === '"') break; }
      const token = source.slice(start, i + 1);
      let next = i + 1; while (/\s/.test(source[next] ?? "") && next < source.length) next++;
      if (source[next] === ":") {
        const key = JSON.parse(token); const current = stack[stack.length - 1];
        if (!current || current.has(key)) throw new Error("duplicate JSON object key");
        current.add(key);
      }
    }
  }
}

export function canonicalBundleJson(value: unknown): string { return canonicalJson(value); }
