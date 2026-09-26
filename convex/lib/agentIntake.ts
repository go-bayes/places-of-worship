import { canonicalJson, sha256 } from "./sha256.ts";
import bundleSchema from "../../scripts/agent_research/schemas/agent-review-bundle.v1.json" with { type: "json" };
import allowlistNzV1 from "../../scripts/agent_research/fixtures/allowlist-nz-v1.json" with { type: "json" };
import screenPolicy from "../../scripts/agent_research/schemas/screen-policy.v1.json" with { type: "json" };

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
      else if (schema.additionalProperties === false) throw new Error(`${path}: unknown field ${keyRef(value, key)}`);
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

const CITED_NAME_RULE = "public_source_cited.v1";
const citedNameRule = screenPolicy.cited_name_rules[CITED_NAME_RULE];
const HONORIFIC_NAME = /\b(?:Rev(?:'d|erend|d)?\.?|Fr\.?|Father|Pastor|Vicar|Archdeacon|Bishop|Canon|Dean|Mr|Mrs|Ms|Dr)\s+(?:[A-Z][a-zA-Z'-]+\s?){1,3}/g;

export function ruleNormalForm(text: string): string {
  let out = "";
  for (const char of text) {
    const code = char.codePointAt(0)!;
    const whitespace = (code >= 9 && code <= 13) || code === 0x20 || code === 0x85 || code === 0xa0 || code === 0x1680 || (code >= 0x2000 && code <= 0x200a) || [0x2028, 0x2029, 0x202f, 0x205f, 0x3000].includes(code);
    if (whitespace) { if (out && !out.endsWith(" ")) out += " "; }
    else if (code === 0x2018 || code === 0x2019) out += "'";
    else if (code >= 65 && code <= 90) out += String.fromCharCode(code + 32);
    else out += char;
  }
  return out.replace(/^ +| +$/g, "");
}

const RULE_WHITESPACE = (code: number): boolean => (code >= 9 && code <= 13) || [0x20, 0x85, 0xa0, 0x1680, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000].includes(code) || (code >= 0x2000 && code <= 0x200a);
const LEFT_BOUNDARY = new Set([" ", "\t", "\n", "\r", "(", '"']);
const RIGHT_BOUNDARY = new Set([" ", "\t", "\n", "\r", ".", ",", ";", ":", "!", "?", ")", '"']);
const QUOTE_BOUNDARY = new Set([" ", ".", ",", ";", ":", "!", "?", "(", ")", "[", "]", '"', "'"]);
export function claimFieldPath(norm: string): boolean {
  return citedNameRule.claim_fields.some((field: string) => norm.replace(/^dossier\./, "") === `claims[].${field}`);
}
const nameKey = (text: string): string => text.replace(/[A-Z]/g, char => String.fromCharCode(char.charCodeAt(0) + 32));
function quoteContainsName(quote: string, key: string): boolean {
  const form = ruleNormalForm(quote);
  for (let at = form.indexOf(key); at >= 0; at = form.indexOf(key, at + 1)) {
    const end = at + key.length;
    if ((at === 0 || QUOTE_BOUNDARY.has(form[at - 1])) && (end === form.length || QUOTE_BOUNDARY.has(form[end]))) return true;
  }
  return false;
}

export function honorificNameMatches(text: string): Array<{ start: number; end: number; text: string; clergy: boolean }> {
  const chars = Array.from(text);
  return [...text.matchAll(HONORIFIC_NAME)].map(match => {
    const start = Array.from(text.slice(0, match.index)).length;
    let end = start + Array.from(match[0]).length;
    while (end > start && RULE_WHITESPACE(chars[end - 1].codePointAt(0)!)) end--;
    const value = chars.slice(start, end).join("");
    const parts = value.split(" ");
    const clergy = parts.length >= 2 && parts.length <= 4 && parts.every(Boolean)
      && !Array.from(value).some(char => RULE_WHITESPACE(char.codePointAt(0)!) && char !== " ")
      && citedNameRule.honorifics.includes(parts[0].replace(/\.$/, ""))
      && parts.slice(1).every(part => /^[A-Z][A-Za-z'-]+$/.test(part))
      && (start === 0 || LEFT_BOUNDARY.has(chars[start - 1]))
      && (end === chars.length || RIGHT_BOUNDARY.has(chars[end]));
    return { start, end, text: value, clergy };
  });
}

function coveredClaimNames(claim: Record<string, any>, domains: string[] | null): Set<string> {
  const covered = new Set<string>();
  const quote = claim?.quoted_support;
  const locator = claim?.source?.locator;
  if (typeof quote !== "string" || !ruleNormalForm(quote) || typeof locator !== "string" || !domains) return covered;
  try { publicUrl(locator); canonicalHost(locator); } catch { return covered; }
  if (!hostAllowed(locator, domains)) return covered;
  for (const path of citedNameRule.claim_fields) {
    let field: any = claim;
    for (const part of path.split(".")) field = field?.[part];
    if (typeof field !== "string") continue;
    for (const match of honorificNameMatches(field)) {
      const normal = nameKey(match.text);
      if (match.clergy && quoteContainsName(quote, normal)) covered.add(normal);
    }
  }
  return covered;
}

export function citedNameCoverage(d: Record<string, any>, domains: string[] | null): { admitted: Set<string>; errors: string[] } {
  const firstClaims = new Map<string, Record<string, any>>();
  for (const claim of d.claims ?? []) if (typeof claim?.claim_id === "string" && !firstClaims.has(claim.claim_id)) firstClaims.set(claim.claim_id, claim);
  const admitted = new Set<string>(), errors: string[] = [];
  (d.personal_details_quarantine?.items ?? []).forEach((item: any, index: number) => {
    if (!Object.hasOwn(item, "admitted_by_rule")) {
      if (["field", "start", "end"].some(field => Object.hasOwn(item, field))) errors.push(`personal_details_quarantine.items[${index}]: span requires a rule`);
      return;
    }
    const claim = typeof item.context_claim_id === "string" ? firstClaims.get(item.context_claim_id) : undefined;
    let field: any = claim;
    if (typeof item.field === "string" && citedNameRule.claim_fields.includes(item.field)) for (const part of item.field.split(".")) field = field?.[part];
    else field = undefined;
    const quote = claim?.quoted_support;
    const locator = claim?.source?.locator;
    let citable = false;
    if (typeof locator === "string" && domains) try { publicUrl(locator); canonicalHost(locator); citable = hostAllowed(locator, domains); } catch { /* refuse */ }
    const match = item.admitted_by_rule === CITED_NAME_RULE && item.kind === citedNameRule.kind
      && typeof quote === "string" && !!ruleNormalForm(quote) && citable && typeof field === "string"
      && Number.isInteger(item.start) && Number.isInteger(item.end) && item.start >= 0 && item.start < item.end && item.end <= Array.from(field).length
      ? honorificNameMatches(field).find(hit => hit.clergy && hit.start === item.start && hit.end === item.end) : undefined;
    if (!match || !quoteContainsName(quote, nameKey(match.text)))
      errors.push(`personal_details_quarantine.items[${index}]: rule ${CITED_NAME_RULE} does not cover its claim`);
    else admitted.add(nameKey(match.text));
  });
  return { admitted, errors };
}

function hasUnadmittedDetail(text: string, admitted: ReadonlySet<string>): boolean {
  return /(?:\+64|\b0)[\s-]?\d{1,2}[\s-]?\d{3,4}[\s-]?\d{3,5}\b/.test(text)
    || /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(text)
    || honorificNameMatches(text).some(match => !(match.clergy && admitted.has(nameKey(match.text))));
}

const DIGEST = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;

// the audited fields of each record type that may hold a hex digest (screen-policy.v1).
export const SCREEN_HASH_FIELDS: Record<string, ReadonlySet<string>> = Object.fromEntries(
  Object.entries(screenPolicy.hash_fields as Record<string, Record<string, unknown>>).map(([name, fields]) => [name, new Set(Object.keys(fields))]),
);

// 40- or 64-digit hex tokens anywhere in text: maximal runs of ASCII letters and digits, any
// case, so "sha256:<digest>", "Reference <DIGEST>" and a bare digest all count. lib.py
// hash_token_spans and pow-cli hash_token_spans mirror it.
export function hasHashToken(text: string): boolean {
  for (const token of text.match(/[0-9A-Za-z]+/g) ?? []) {
    if ((token.length === 40 || token.length === 64) && /^[0-9A-Fa-f]+$/.test(token)) return true;
  }
  return false;
}

// an opaque positional reference to an undeclared object key, so diagnostics never copy the key:
// its index among the object's keys in code-point order, as lib.py key_ref and pow-cli order them.
export function keyRef(object: object, key: string): string {
  const codePoints = (text: string) => Array.from(text, (c) => c.codePointAt(0) ?? 0);
  const compare = (a: string, b: string) => {
    const x = codePoints(a), y = codePoints(b);
    for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) return x[i] - y[i];
    return x.length - y.length;
  };
  return `<key#${Object.keys(object).sort(compare).indexOf(key)}>`;
}

type Screened = { path: string; norm: string; text: string; isKey: boolean };

// every string value and every object key the schema does not declare, whatever the schema says
// about the value: enum, const and pattern exempt nothing. norm is the path with every array
// index written as []. overrides walk a top-level key against another schema. lib.py
// _walk_screened and pow-cli screened_strings mirror this walk.
function walkScreened(value: unknown, schemaNode: any, root: any, overrides: Record<string, [any, any]>, prefix: string): Screened[] {
  const found: Screened[] = [];
  const join = (base: string, key: string) => (base === "" ? key : `${base}.${key}`);
  const visit = (item: unknown, node: any, base: any, path: string, norm: string): void => {
    let schema = node ?? {};
    while (typeof schema.$ref === "string" && schema.$ref.startsWith("#/")) {
      let target = base;
      for (const part of schema.$ref.slice(2).split("/")) target = target?.[part];
      schema = target ?? {};
    }
    if (typeof item === "string") {
      found.push({ path, norm, text: item, isKey: false });
      return;
    }
    if (Array.isArray(item)) {
      item.forEach((child, index) => visit(child, schema.items, base, `${path}[${index}]`, `${norm}[]`));
      return;
    }
    if (item === null || typeof item !== "object") return;
    const properties = schema.properties ?? {};
    for (const [key, child] of Object.entries(item)) {
      const override = path === "" && Object.hasOwn(overrides, key) ? overrides[key] : undefined;
      // an undeclared key is named by position, never copied into a path
      const label = override !== undefined || Object.hasOwn(properties, key) ? key : keyRef(item, key);
      const childPath = join(path, label), childNorm = join(norm, label);
      if (override !== undefined) visit(child, override[0], override[1], childPath, childNorm);
      else if (Object.hasOwn(properties, key)) visit(child, properties[key], base, childPath, childNorm);
      else {
        found.push({ path: `${childPath} (key)`, norm: childNorm, text: key, isKey: true });
        visit(child, {}, base, childPath, childNorm);
      }
    }
  };
  visit(value, schemaNode, root, prefix, prefix);
  return found;
}

// every string value and undeclared key, by path.
export function screenedStrings(value: unknown, schemaNode: any, root: any, overrides: Record<string, [any, any]> = {}, prefix = ""): Array<[string, string]> {
  return walkScreened(value, schemaNode, root, overrides, prefix).map(({ path, text }) => [path, text]);
}

// the first screen failure as an error message naming only the path: a phone number, email
// address or honorific-led name anywhere, or a hex-hash-shaped value outside a designated hash
// field. paths under a skipped prefix are left to another check. lib.py screen_findings mirrors it.
export function assertScreened(value: unknown, schemaNode: any, root: any, hashFields: ReadonlySet<string>, options: { overrides?: Record<string, [any, any]>; prefix?: string; skip?: string[]; admitted?: ReadonlySet<string> } = {}): void {
  const skip = options.skip ?? [];
  for (const { path, norm, text, isKey } of walkScreened(value, schemaNode, root, options.overrides ?? {}, options.prefix ?? "")) {
    if (skip.some(s => norm === s || norm.startsWith(`${s}.`) || norm.startsWith(`${s}[`))) continue;
    if (hasUnadmittedDetail(text, !isKey && claimFieldPath(norm) ? options.admitted ?? new Set() : new Set())) throw new Error(`potential personal details in ${path} require human handling`);
    const exempt = !isKey && hashFields.has(norm) && DIGEST.test(text);
    if (!exempt && hasHashToken(text)) throw new Error(`hash-shaped value in ${path} is outside a designated hash field`);
  }
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
  // designated hash fields must equal the digests of their inputs in this record (screen-policy.v1)
  if (bundle.submission_key !== sha256(d.dossier_id)) throw new Error("submission_key does not match the dossier id");
  const { locators, admitted } = validateDossierRecordWithRule(d);
  // the reviewer's text and both run manifests travel too; the dossier was screened above.
  assertScreened(value, bundleSchema, bundleSchema, SCREEN_HASH_FIELDS["agent-review-bundle.v1"], { skip: ["dossier"], admitted });
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
  return validateDossierRecordWithRule(d).locators;
}

export function validateDossierRecordWithRule(d: Record<string, any>): { locators: Map<string, string>; admitted: Set<string> } {
  // the pinned source allowlist, as intake.py validate_dossier applies it
  const allowlist = typeof d.run_manifest.allowlist_version === "string" && Object.hasOwn(ALLOWLISTS, d.run_manifest.allowlist_version) ? ALLOWLISTS[d.run_manifest.allowlist_version] : undefined;
  if (!allowlist) throw new Error("dossier names no known source allowlist version");
  if (allowlist.country_code !== d.place.country_code) throw new Error("source allowlist belongs to another country");
  const domains = allowlist.domains.map(domain => domain.toLowerCase().replace(/\.$/, ""));
  const { admitted, errors: declarationErrors } = citedNameCoverage(d, domains);
  if (declarationErrors.length) throw new Error(declarationErrors[0]);
  dateBounds(d.run_manifest.started_at.split("T")[0]); dateBounds(d.run_manifest.ended_at.split("T")[0]);
  const manifestStart = Date.parse(d.run_manifest.started_at), manifestEnd = Date.parse(d.run_manifest.ended_at);
  if (!Number.isFinite(manifestStart) || !Number.isFinite(manifestEnd) || manifestEnd < manifestStart) throw new Error("invalid dossier run timestamp");
  // every free-text string of the dossier, not only claim text: a detail the runner's redaction
  // missed must not reach reviewers or Convex.
  assertScreened(d, (bundleSchema as any).$defs.dossier, bundleSchema, SCREEN_HASH_FIELDS["agent-review-bundle.v1"], { prefix: "dossier", admitted });
  if (d.run_manifest.idempotency_key !== sha256([d.place.place_ref, d.run_manifest.prompt_version, d.run_manifest.model_id_requested, d.place.seed_source].join("|"))) throw new Error("dossier run manifest idempotency_key does not match its inputs");
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
  return { locators, admitted };
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
