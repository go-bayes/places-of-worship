import { canonicalJson, sha256 } from "./sha256.ts";
import bundleSchema from "../../scripts/agent_research/schemas/agent-review-bundle.v1.json" with { type: "json" };
import allowlistNzV1 from "../../scripts/agent_research/fixtures/allowlist-nz-v1.json" with { type: "json" };

// pinned source allowlists by version; a dossier naming any other version is refused.
const ALLOWLISTS: Record<string, { allowlist_version: string; country_code: string; domains: string[] }> = { "nz-v1": allowlistNzV1 };

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
  model_id_reported: string;
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
// floats, when given, names the paths of numbers written as floats (see
// lib/wireJson canonicalWireJson): python's schema check then refuses them
// where an integer or an integer constant is required, as first_pass.py does
// (every numeric const in these schemas is a python int).
export function schemaCheck(value: any, schema: any, path = "$", root: any = bundleSchema, floats?: ReadonlySet<string>): void {
  if (schema.$ref) {
    if (!schema.$ref.startsWith("#/")) throw new Error("external schema reference");
    let target = root;
    for (const part of schema.$ref.slice(2).split("/")) target = target[part];
    return schemaCheck(value, target, path, root, floats);
  }
  const isFloat = floats?.has(path) === true;
  const kinds = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
  const matches = (kind: string): boolean => kind === "null" ? value === null : kind === "array" ? Array.isArray(value) : kind === "object" ? value !== null && typeof value === "object" && !Array.isArray(value) : kind === "integer" ? Number.isInteger(value) && !isFloat : typeof value === kind;
  if (kinds.length && !kinds.some(matches)) throw new Error(`${path}: invalid type`);
  if ("const" in schema && (value !== schema.const || (isFloat && typeof schema.const === "number"))) throw new Error(`${path}: invalid constant`);
  if (schema.enum && !schema.enum.includes(value)) throw new Error(`${path}: invalid enum`);
  if (typeof value === "string") {
    const length = [...value].length;
    if (length < (schema.minLength ?? 0) || length > (schema.maxLength ?? Infinity) || (schema.pattern && !new RegExp(schema.pattern).test(value))) throw new Error(`${path}: invalid string`);
  }
  if (typeof value === "number" && (!Number.isFinite(value) || value < (schema.minimum ?? -Infinity) || value > (schema.maximum ?? Infinity))) throw new Error(`${path}: invalid number`);
  if (Array.isArray(value)) {
    if (value.length < (schema.minItems ?? 0) || value.length > (schema.maxItems ?? Infinity)) throw new Error(`${path}: invalid array size`);
    value.forEach((item, i) => { if (schema.items) schemaCheck(item, schema.items, `${path}[${i}]`, root, floats); });
  } else if (value !== null && typeof value === "object") {
    for (const key of schema.required ?? []) if (!Object.hasOwn(value, key)) throw new Error(`${path}: missing ${key}`);
    for (const [key, item] of Object.entries(value)) {
      if (Object.hasOwn(schema.properties ?? {}, key)) schemaCheck(item, schema.properties[key], `${path}.${key}`, root, floats);
      else if (schema.additionalProperties === false) throw new Error(`${path}: unknown field ${key}`);
    }
  }
}

// reject deep, non-finite, prototype-like, and control-bearing values everywhere.
export function guard(value: any, depth = 0): void {
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
export function dateBounds(value: string): [string, string] {
  if (!/^\d{4}(-\d{2}(-\d{2})?)?$/.test(value)) throw new Error("invalid partial ISO date");
  const [year, month = 1, day = 1] = value.split("-").map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]) throw new Error("invalid calendar date");
  return [value.padEnd(7, "-01").slice(0, 7) + (value.length === 10 ? value.slice(7) : "-01"), value.length === 4 ? value + "-12-31" : value.length === 7 ? value + "-" + days[month - 1] : value];
}

// intake never fetches URLs; reject credentials and non-public literal destinations.
export function publicUrl(value: string): void {
  if (/[\s\\\u007f]/.test(value)) throw new Error("invalid public HTTP(S) URL");
  if (/^[^:]+:\/\/[^/?#]*@/.test(value)) throw new Error("invalid public HTTP(S) URL");
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("invalid public HTTP(S) URL"); }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.port === "0" || !host || host === "localhost" || /\.(localhost|local|internal)$/.test(host) || host.includes("%")) throw new Error("invalid public HTTP(S) URL");
  // numeric hosts have inconsistent interpretations across URL implementations.
  if (/^[0-9.]+$/.test(host) || host.includes(":")) throw new Error("source URL must use a public DNS hostname");
}

// phones, emails and honorific-led names, as scripts/agent_research/lib.py
// find_personal_details detects them; every hit needs human handling.
export function hasPersonalDetails(text: string): boolean {
  return /(?:\+64|\b0)[\s-]?\d{1,2}[\s-]?\d{3,4}[\s-]?\d{3,5}\b/.test(text)
    || /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(text)
    || /\b(?:Rev(?:'d|erend|d)?\.?|Fr\.?|Father|Pastor|Vicar|Archdeacon|Bishop|Canon|Dean|Mr|Mrs|Ms|Dr)\s+(?:[A-Z][a-zA-Z'-]+\s?){1,3}/.test(text);
}

const HASH_SHAPED = /^(?:sha256:)?(?:[0-9a-f]{40}|[0-9a-f]{64})$/;

// every string that could carry a personal detail, by path: each string value, and each object
// key the schema does not declare (free-form maps such as seed_tags or usage). the only strings
// left out are those the schema constrains to a closed vocabulary or a fixed shape (enum, const
// or pattern) and values shaped as a hex hash. overrides walk a top-level key against another
// schema. lib.py screened_strings and pow-cli screened_strings mirror this walk.
export function screenedStrings(value: unknown, schemaNode: any, root: any, overrides: Record<string, [any, any]> = {}): Array<[string, string]> {
  const found: Array<[string, string]> = [];
  const join = (path: string, key: string) => (path === "" ? key : `${path}.${key}`);
  const visit = (item: unknown, node: any, base: any, path: string): void => {
    let schema = node ?? {};
    while (typeof schema.$ref === "string" && schema.$ref.startsWith("#/")) {
      let target = base;
      for (const part of schema.$ref.slice(2).split("/")) target = target?.[part];
      schema = target ?? {};
    }
    if (typeof item === "string") {
      if (!("enum" in schema || "const" in schema || "pattern" in schema || HASH_SHAPED.test(item))) found.push([path, item]);
      return;
    }
    if (Array.isArray(item)) {
      item.forEach((child, index) => visit(child, schema.items, base, `${path}[${index}]`));
      return;
    }
    if (item === null || typeof item !== "object") return;
    const properties = schema.properties ?? {};
    for (const [key, child] of Object.entries(item)) {
      const childPath = join(path, key);
      const override = path === "" && Object.hasOwn(overrides, key) ? overrides[key] : undefined;
      if (override !== undefined) visit(child, override[0], override[1], childPath);
      else if (Object.hasOwn(properties, key)) visit(child, properties[key], base, childPath);
      else {
        found.push([`${childPath} (key)`, key]);
        visit(child, {}, base, childPath);
      }
    }
  };
  visit(value, schemaNode, root, "");
  return found;
}

// one host policy shared with the Python and Rust validators: read the host as written (never
// through URL's IDNA and percent decoding), refuse non-ASCII, userinfo, empty or invalid ports
// and empty labels, lower-case it, and strip exactly one trailing root dot.
export function canonicalHost(locator: string): string {
  const scheme = ["http://", "https://"].find(s => locator.slice(0, s.length).toLowerCase() === s);
  if (!scheme) throw new Error("source URL must use http or https");
  const rest = locator.slice(scheme.length);
  const ends = ["/", "?", "#"].map(c => rest.indexOf(c)).filter(i => i >= 0);
  const authority = rest.slice(0, ends.length ? Math.min(...ends) : rest.length);
  if (authority.includes("@")) throw new Error("source URL must not carry user information");
  const colon = authority.indexOf(":");
  let host = colon >= 0 ? authority.slice(0, colon) : authority;
  if (colon >= 0) {
    const port = authority.slice(colon + 1);
    if (!/^[0-9]{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535) throw new Error("source URL port must be a number from 1 to 65535");
  }
  if (!/^[\x00-\x7f]*$/.test(host)) throw new Error("source URL host must be an ASCII DNS name");
  host = host.toLowerCase();
  if (host.endsWith(".")) host = host.slice(0, -1);
  if (!host || host.length > 253 || !host.split(".").every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) throw new Error("source URL host must be an ASCII DNS name");
  return host;
}

// an allowlisted domain covers itself and its subdomains, never a lookalike suffix.
export function hostAllowed(locator: string, domains: string[]): boolean {
  let host: string;
  try { host = canonicalHost(locator); } catch { return false; }
  return domains.some(domain => host === domain || host.endsWith(`.${domain}`));
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
  // a model id must come back from the provider; the requested alias is not evidence of the model.
  if (typeof d.run_manifest.model_id_reported !== "string" || d.run_manifest.model_id_reported === "") throw new Error("dossier run manifest lacks the model id the provider reported");
  if (d.run_manifest.model_id_reported !== bundle.research_run.model_id_reported) throw new Error("dossier and research manifest disagree on the reported model");
  const locators = validateDossierRecord(d);
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

// the dossier checks shared by the review bundle and the first-pass record:
// the pinned source allowlist, run timestamps, claim sources and hosts,
// reader provenance, dates, status and osm references. returns each claim id with its source locator. the caller has
// already schema-checked the dossier and applied its own provenance checks.
export function validateDossierRecord(d: Record<string, any>): Map<string, string> {
  // the pinned source allowlist, as intake.py validate_dossier applies it
  const allowlist = typeof d.run_manifest.allowlist_version === "string" && Object.hasOwn(ALLOWLISTS, d.run_manifest.allowlist_version) ? ALLOWLISTS[d.run_manifest.allowlist_version] : undefined;
  if (!allowlist) throw new Error("dossier names no known source allowlist version");
  if (allowlist.country_code !== d.place.country_code) throw new Error("source allowlist belongs to another country");
  const domains = allowlist.domains.map(domain => domain.toLowerCase().replace(/\.$/, ""));
  dateBounds(d.run_manifest.started_at.split("T")[0]); dateBounds(d.run_manifest.ended_at.split("T")[0]);
  const manifestStart = Date.parse(d.run_manifest.started_at), manifestEnd = Date.parse(d.run_manifest.ended_at);
  if (!Number.isFinite(manifestStart) || !Number.isFinite(manifestEnd) || manifestEnd < manifestStart) throw new Error("invalid dossier run timestamp");
  // every free-text string of the dossier, not only claim text: a detail the runner's redaction
  // missed must not reach reviewers or Convex.
  for (const [path, text] of screenedStrings(d, (bundleSchema as any).$defs.dossier, bundleSchema)) {
    if (hasPersonalDetails(text)) throw new Error(`potential personal details in dossier.${path} require human handling`);
  }
  const locators = new Map<string, string>();
  for (const claim of d.claims) {
    if (locators.has(claim.claim_id)) throw new Error("duplicate claim ID");
    publicUrl(claim.source.locator); canonicalHost(claim.source.locator); locators.set(claim.claim_id, claim.source.locator);
    if (!hostAllowed(claim.source.locator, domains)) throw new Error(`source host is not on allowlist ${allowlist.allowlist_version}`);
    if (claim.reader.backend !== d.run_manifest.backend || ![d.run_manifest.model_id_requested, d.run_manifest.model_id_reported].includes(claim.reader.model_id)) throw new Error("inconsistent claim reader");
    for (const key of ["date_start", "date_end"]) if (claim[key] != null) {
      dateBounds(claim[key]);
      const precision = ({day:10,month:7,year:4} as Record<string, number>)[claim.date_precision];
      if (precision && claim[key].length !== precision) throw new Error("date precision mismatch");
    }
    if (claim.date_end && (!claim.date_start || dateBounds(claim.date_start)[0] > dateBounds(claim.date_end)[1])) throw new Error("invalid date interval");
    for (const key of ["source_date", "retrieved_at"]) if (claim.source[key]) dateBounds(claim.source[key].split("T")[0]);
  }
  // a bundle's quarantine block records only the kind and claim of each withheld detail;
  // the schema refuses values and hashes, and the count must equal the items.
  const quarantine = d.personal_details_quarantine;
  if (quarantine.item_count !== quarantine.items.length) throw new Error("personal_details_quarantine item_count must equal the number of items");
  for (const item of quarantine.items) if (item.context_claim_id !== null && !locators.has(item.context_claim_id)) throw new Error("personal_details_quarantine references an unknown claim");
  dateBounds(d.status_assessment.asof_date);
  for (const id of d.status_assessment.supporting_claim_ids) if (!locators.has(id)) throw new Error("unknown status claim");
  for (const row of d.osm_version_chain) { publicUrl(row.locator); canonicalHost(row.locator); }
  return locators;
}

// a dossier carried without a review bundle (inside a first-pass record):
// the bundle schema's dossier definition, the nz pilot restriction, the
// researcher model policy and a completed run, then the shared checks.
export function validateStandaloneDossier(d: unknown, floats?: ReadonlySet<string>): Map<string, string> {
  guard(d);
  schemaCheck(d, (bundleSchema as any).$defs.dossier, "$.dossier", bundleSchema, floats);
  const dossier = d as Record<string, any>;
  if (dossier.place.country_code !== "NZ") throw new Error("internal pilot requires NZ");
  const models: Record<string, string> = { claude: "sonnet", codex: "gpt-5.6-luna" };
  if (models[dossier.run_manifest.backend] !== dossier.run_manifest.model_id_requested || dossier.run_manifest.exit_status !== "completed") throw new Error("inconsistent dossier run provenance");
  return validateDossierRecord(dossier);
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
