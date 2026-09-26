import { assertNoDuplicateJsonKeys, assertScreened, dateBounds, guard, keyRef, publicUrl, SCREEN_HASH_FIELDS, screenedStrings } from "./agentIntake.ts";
import { isSha256Hex, verifyObjectBytes } from "./objectReceipts.ts";
import { sha256 } from "./sha256.ts";
import { canonicalWireJson } from "./wireJson.ts";

// This is a provisional inspection projection. It never creates a task,
// evidence draft, judgment, decision, or accepted map event.
export const INSPECTION_SCHEMA = "inspection-case.v1";
export const COLLECTION_SCHEMA = "inspection-collection.v1";
export const ADAPTER_VERSION = "bahamas-inspection-adapter.v1";
const REFERENCE = /^[a-z0-9][a-z0-9._:/-]{0,159}$/;
const FIELDS = new Set(["case_ref", "country_code", "source_snapshot_date", "definition_version", "definition_hash", "source_records", "candidate_links", "claims", "agent_assessments", "context", "parents"]);
const PERMISSIONS = new Set(["permitted", "needs_review", "restricted"]);
const shape = (names: string[]): { properties: Record<string, any> } => ({ properties: Object.fromEntries(names.map(name => [name, {}])) });
const sourceShape = shape(["source_ref", "source_family_ref", "locator", "publisher", "publication_date", "retrieved_at", "returned_date", "access_result", "licence_note", "copy_permission", "display_permission", "original_hash", "extract"]);
const linkShape = shape(["candidate_ref", "basis", "disposition", "osm_ref", "project_site_id"]);
const claimShape = shape(["claim_ref", "attribute", "wording", "described_date", "observation_date", "geometry", "source_refs", "uncertainty"]);
claimShape.properties.geometry = shape(["latitude", "longitude"]);
claimShape.properties.source_refs = { items: {} };
const assessmentShape = shape(["assessment_ref", "subject_ref", "agent_name", "model_requested", "model_reported", "model_unreported_reason", "outcome", "basis"]);
const caseShape = shape(["schema_version", "disposition", "case_ref", "country_code", "source_snapshot_date", "definition_version", "definition_hash", "sources", "candidate_links", "claims", "agent_assessments", "context", "parents"]);
caseShape.properties.sources = { items: sourceShape };
caseShape.properties.candidate_links = { items: linkShape };
caseShape.properties.claims = { items: claimShape };
caseShape.properties.agent_assessments = { items: assessmentShape };
caseShape.properties.context = shape(["task_id", "evidence_version_hash"]);
caseShape.properties.parents = { items: {} };
const inputShape = shape([...FIELDS]);
inputShape.properties.source_records = { items: sourceShape };
inputShape.properties.candidate_links = { items: linkShape };
inputShape.properties.claims = { items: claimShape };
inputShape.properties.agent_assessments = { items: assessmentShape };
inputShape.properties.context = caseShape.properties.context;
inputShape.properties.parents = { items: {} };
const collectionShape = shape(["schema_version", "country_code", "collection_ref", "adapter_version", "source_snapshot_date", "definition_version", "definition_hash", "case_hashes", "parents"]);
collectionShape.properties.case_hashes = { items: {} };
collectionShape.properties.parents = { items: {} };
const inputHashFields = new Set([...SCREEN_HASH_FIELDS[INSPECTION_SCHEMA]].map(path => path.replace(/^sources\[\]/, "source_records[]")));

// the shared detector recognises New Zealand numbers only. Bahamas numbers
// follow the North American plan: +1 or (242) forms, 10-digit groups, and
// the 7-digit local form. hits are named by path, never by value.
const NANP_PHONE = /\+1[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b|\(\d{3}\)\s?\d{3}[\s.-]\d{4}\b|\b(?:\d{10}|\d{3}[\s.-]\d{3}[\s.-]\d{4}|\d{3}[\s.-]\d{4})\b/;
// an OSM element reference, bare or as an openstreetmap.org URL; ten-digit element ids
// otherwise read as unseparated phone numbers
const OSM_REFERENCE = /^(?:https:\/\/(?:www\.)?openstreetmap\.org\/)?(?:node|way|relation)\/[1-9]\d{0,15}$/;
const OSM_REFERENCE_FIELD = /^candidate_links\[\d+\]\.(?:osm_ref|candidate_ref)$/;
// a screening form of a string: compatibility-normalised (full-width and other digit forms
// become ASCII) and percent-decoded, repeatedly, so an encoded number cannot pass as text
function screeningForm(text: string): string {
  let current = text.normalize("NFKC");
  for (let round = 0; round < 3; round += 1) {
    const decoded = current.replace(/%([0-9a-fA-F]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16))).normalize("NFKC");
    if (decoded === current) break;
    current = decoded;
  }
  return current;
}
function assertNoNanpPhone(value: unknown, schema: any): void {
  // source locators are validated URLs whose record ids can look like local numbers, and so are
  // exact OSM references in candidate links; the shared screen still covers both, the NANP pattern does not.
  // the exemption applies to the raw value only; every other value is screened raw and in its screening form
  for (const [path, text] of screenedStrings(value, schema, schema)) {
    if (/\.locator$/.test(path) || (OSM_REFERENCE_FIELD.test(path) && OSM_REFERENCE.test(text))) continue;
    if (NANP_PHONE.test(text) || NANP_PHONE.test(screeningForm(text))) throw new Error(`potential personal details in ${path} require human handling`);
  }
}

export function screenInspectionCase(value: unknown, adapterInput = false): void {
  const schema = adapterInput ? inputShape : caseShape;
  assertScreened(value, schema, schema, adapterInput ? inputHashFields : SCREEN_HASH_FIELDS[INSPECTION_SCHEMA]);
  assertNoNanpPhone(value, schema);
}

export function screenInspectionCollection(value: unknown): void {
  assertScreened(value, collectionShape, collectionShape, SCREEN_HASH_FIELDS[COLLECTION_SCHEMA]);
  assertNoNanpPhone(value, collectionShape);
}

type JsonRecord = Record<string, unknown>;
function record(value: unknown, path: string): JsonRecord {
  if (value === null || Array.isArray(value) || typeof value !== "object") throw new Error(`${path}: object required`);
  return value as JsonRecord;
}
function keys(value: JsonRecord, allowed: readonly string[], path: string): void {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`${path}: unsupported field ${keyRef(value, key)}`);
}
function string(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${path}: non-empty string required`);
  return value;
}
function ref(value: unknown, path: string): string {
  const result = string(value, path);
  if (!REFERENCE.test(result)) throw new Error(`${path}: invalid stable reference`);
  return result;
}
function optionalString(value: unknown, path: string): string | null {
  return value === null ? null : string(value, path);
}
function list(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${path}: array required`);
  return value;
}
function date(value: unknown, path: string): string {
  const result = string(value, path);
  dateBounds(result);
  return result;
}
function timestamp(value: unknown, path: string): string {
  const result = string(value, path);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(result) || !Number.isFinite(Date.parse(result))) throw new Error(`${path}: UTC timestamp required`);
  dateBounds(result.slice(0, 10));
  return result;
}
function hash(value: unknown, path: string): string {
  if (!isSha256Hex(value)) throw new Error(`${path}: SHA-256 required`);
  return value;
}
function checkLocator(value: unknown, path: string): string {
  const result = string(value, path);
  publicUrl(result);
  return result;
}
function unique(values: string[], path: string): void {
  if (new Set(values).size !== values.length) throw new Error(`${path}: duplicate reference`);
}

export type InspectionCase = {
  schema_version: typeof INSPECTION_SCHEMA;
  disposition: "provisional";
  case_ref: string;
  country_code: "bs";
  source_snapshot_date: string;
  definition_version: string;
  definition_hash: string;
  sources: Array<{ source_ref: string; source_family_ref: string; locator: string; publisher: string; publication_date: string | null; retrieved_at: string | null; returned_date: string | null; access_result: string; licence_note: string; copy_permission: "permitted" | "needs_review" | "restricted"; display_permission: "permitted" | "needs_review" | "restricted"; original_hash: string | null; extract: string | null }>;
  candidate_links: Array<{ candidate_ref: string; basis: string; disposition: string; osm_ref: string | null; project_site_id: string | null }>;
  claims: Array<{ claim_ref: string; attribute: string; wording: string; described_date: string | null; observation_date: string | null; geometry: { latitude: number; longitude: number } | null; source_refs: string[]; uncertainty: string | null }>;
  agent_assessments: Array<{ assessment_ref: string; subject_ref: string; agent_name: string; model_requested: string; model_reported: string | null; model_unreported_reason: string | null; outcome: string; basis: string }>;
  context: { task_id: string | null; evidence_version_hash: string | null };
  parents: string[];
};
export type InspectionCollection = { schema_version: typeof COLLECTION_SCHEMA; country_code: "bs"; collection_ref: string; adapter_version: typeof ADAPTER_VERSION; source_snapshot_date: string; definition_version: string; definition_hash: string; case_hashes: string[]; parents: string[] };
export type AdapterReport = { adapter_version: typeof ADAPTER_VERSION; field_mappings: string[]; omitted_fields: string[]; findings: string[]; unsupported_records: string[]; source_permissions: Array<{ source_ref: string; copy_permission: string; display_permission: string; decision: string }> };

// A private adapter may supply this bounded interchange shape. No caller may
// silently add research fields; it must account for omission in its report.
export function adaptInspectionCase(input: unknown): { projection: InspectionCase; report: AdapterReport } {
  screenInspectionCase(input, true);
  const raw = record(input, "input");
  keys(raw, [...FIELDS], "input");
  if (raw.country_code !== "bs") throw new Error("input: Bahamas country code required");
  const report: AdapterReport = { adapter_version: ADAPTER_VERSION, field_mappings: ["source_records -> sources", "candidate_links -> candidate_links", "claims -> claims", "agent_assessments -> agent_assessments", "context -> context"], omitted_fields: [], findings: [], unsupported_records: [], source_permissions: [] };
  const sources = list(raw.source_records, "source_records").map((item, index) => {
    const at = `source_records[${index}]`;
    const source = record(item, at);
    keys(source, ["source_ref", "source_family_ref", "locator", "publisher", "publication_date", "retrieved_at", "returned_date", "access_result", "licence_note", "copy_permission", "display_permission", "original_hash", "extract"], at);
    const copy = string(source.copy_permission, `${at}.copy_permission`);
    const display = string(source.display_permission, `${at}.display_permission`);
    if (!PERMISSIONS.has(copy) || !PERMISSIONS.has(display)) throw new Error(`${at}: invalid source permission`);
    const sourceRef = ref(source.source_ref, `${at}.source_ref`);
    const extract = optionalString(source.extract, `${at}.extract`);
    if (extract !== null && (copy !== "permitted" || display !== "permitted")) throw new Error(`${at}: extract requires copy and display permission`);
    const originalHash = source.original_hash === null ? null : hash(source.original_hash, `${at}.original_hash`);
    if (copy !== "permitted" && originalHash !== null) throw new Error(`${at}: unpermitted copy cannot name stored bytes`);
    report.source_permissions.push({ source_ref: sourceRef, copy_permission: copy, display_permission: display, decision: copy === "permitted" && display === "permitted" ? "extract may be inspected" : "locator and metadata only" });
    if (copy !== "permitted" || display !== "permitted") report.findings.push(`${sourceRef}: source permissions limit retained bytes or display`);
    return { source_ref: sourceRef, source_family_ref: ref(source.source_family_ref, `${at}.source_family_ref`), locator: checkLocator(source.locator, `${at}.locator`), publisher: string(source.publisher, `${at}.publisher`), publication_date: source.publication_date === null ? null : date(source.publication_date, `${at}.publication_date`), retrieved_at: source.retrieved_at === null ? null : timestamp(source.retrieved_at, `${at}.retrieved_at`), returned_date: source.returned_date === null ? null : date(source.returned_date, `${at}.returned_date`), access_result: string(source.access_result, `${at}.access_result`), licence_note: string(source.licence_note, `${at}.licence_note`), copy_permission: copy as InspectionCase["sources"][number]["copy_permission"], display_permission: display as InspectionCase["sources"][number]["display_permission"], original_hash: originalHash, extract };
  });
  unique(sources.map((source) => source.source_ref), "sources");
  const candidate_links = list(raw.candidate_links, "candidate_links").map((item, index) => {
    const at = `candidate_links[${index}]`; const link = record(item, at);
    keys(link, ["candidate_ref", "basis", "disposition", "osm_ref", "project_site_id"], at);
    return { candidate_ref: ref(link.candidate_ref, `${at}.candidate_ref`), basis: string(link.basis, `${at}.basis`), disposition: string(link.disposition, `${at}.disposition`), osm_ref: optionalString(link.osm_ref, `${at}.osm_ref`), project_site_id: optionalString(link.project_site_id, `${at}.project_site_id`) };
  });
  unique(candidate_links.map((link) => link.candidate_ref), "candidate links");
  const sourceRefs = new Set(sources.map((source) => source.source_ref));
  const claims = list(raw.claims, "claims").map((item, index) => {
    const at = `claims[${index}]`; const claim = record(item, at);
    keys(claim, ["claim_ref", "attribute", "wording", "described_date", "observation_date", "geometry", "source_refs", "uncertainty"], at);
    const source_refs = list(claim.source_refs, `${at}.source_refs`).map((value, i) => ref(value, `${at}.source_refs[${i}]`));
    unique(source_refs, `${at}.source_refs`);
    if (source_refs.some((sourceRef) => !sourceRefs.has(sourceRef))) throw new Error(`${at}: unknown source reference`);
    let geometry: InspectionCase["claims"][number]["geometry"] = null;
    if (claim.geometry !== null) {
      const point = record(claim.geometry, `${at}.geometry`); keys(point, ["latitude", "longitude"], `${at}.geometry`);
      if (typeof point.latitude !== "number" || typeof point.longitude !== "number" || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude) || Math.abs(point.latitude) > 90 || Math.abs(point.longitude) > 180) throw new Error(`${at}: invalid geometry`);
      geometry = { latitude: point.latitude, longitude: point.longitude };
    }
    return { claim_ref: ref(claim.claim_ref, `${at}.claim_ref`), attribute: string(claim.attribute, `${at}.attribute`), wording: string(claim.wording, `${at}.wording`), described_date: claim.described_date === null ? null : date(claim.described_date, `${at}.described_date`), observation_date: claim.observation_date === null ? null : date(claim.observation_date, `${at}.observation_date`), geometry, source_refs, uncertainty: optionalString(claim.uncertainty, `${at}.uncertainty`) };
  });
  unique(claims.map((claim) => claim.claim_ref), "claims");
  const subjects = new Set([ref(raw.case_ref, "case_ref"), ...claims.map((claim) => claim.claim_ref)]);
  const agent_assessments = list(raw.agent_assessments, "agent_assessments").map((item, index) => {
    const at = `agent_assessments[${index}]`; const assessment = record(item, at);
    keys(assessment, ["assessment_ref", "subject_ref", "agent_name", "model_requested", "model_reported", "model_unreported_reason", "outcome", "basis"], at);
    const subject_ref = ref(assessment.subject_ref, `${at}.subject_ref`);
    if (!subjects.has(subject_ref)) throw new Error(`${at}: unknown subject`);
    const model_reported = optionalString(assessment.model_reported, `${at}.model_reported`);
    const model_unreported_reason = optionalString(assessment.model_unreported_reason, `${at}.model_unreported_reason`);
    if ((model_reported === null) === (model_unreported_reason === null)) throw new Error(`${at}: reported model or unreported reason required`);
    return { assessment_ref: ref(assessment.assessment_ref, `${at}.assessment_ref`), subject_ref, agent_name: string(assessment.agent_name, `${at}.agent_name`), model_requested: string(assessment.model_requested, `${at}.model_requested`), model_reported, model_unreported_reason, outcome: string(assessment.outcome, `${at}.outcome`), basis: string(assessment.basis, `${at}.basis`) };
  });
  unique(agent_assessments.map((assessment) => assessment.assessment_ref), "assessments");
  const context = record(raw.context, "context"); keys(context, ["task_id", "evidence_version_hash"], "context");
  const parents = list(raw.parents, "parents").map((value, index) => hash(value, `parents[${index}]`)); unique(parents, "parents");
  const projection: InspectionCase = { schema_version: INSPECTION_SCHEMA, disposition: "provisional", case_ref: ref(raw.case_ref, "case_ref"), country_code: "bs", source_snapshot_date: date(raw.source_snapshot_date, "source_snapshot_date"), definition_version: string(raw.definition_version, "definition_version"), definition_hash: hash(raw.definition_hash, "definition_hash"), sources, candidate_links, claims, agent_assessments, context: { task_id: context.task_id === null ? null : ref(context.task_id, "context.task_id"), evidence_version_hash: context.evidence_version_hash === null ? null : hash(context.evidence_version_hash, "context.evidence_version_hash") }, parents };
  screenInspectionCase(projection);
  // The shared detector catches contact details and honorific-led names. A
  // conservatively broader field screen holds clergy and tenure passages for
  // human redaction even when a title is absent.
  for (const [path] of screenedStrings(projection, caseShape, caseShape).filter(([, text]) => /\b(?:clergy|minister|pastor|vicar|tenure)\b/i.test(text))) throw new Error(`${path}: source-derived personal or tenure detail requires human restriction or redaction`);
  return { projection, report };
}

export function validateInspectionCase(text: string, claimedHash: string): InspectionCase {
  verifyObjectBytes(text, claimedHash);
  assertNoDuplicateJsonKeys(text);
  const parsed: unknown = JSON.parse(text);
  guard(parsed);
  screenInspectionCase(parsed);
  const input = record(parsed, "projection");
  keys(input, ["schema_version", "disposition", "case_ref", "country_code", "source_snapshot_date", "definition_version", "definition_hash", "sources", "candidate_links", "claims", "agent_assessments", "context", "parents"], "projection");
  if (input.schema_version !== INSPECTION_SCHEMA || input.disposition !== "provisional") throw new Error("invalid inspection contract");
  const { schema_version: _version, disposition: _disposition, sources, ...rest } = input;
  const { projection } = adaptInspectionCase({ ...rest, source_records: sources });
  if (`${canonicalWireJson(JSON.stringify(projection))}\n` !== text) throw new Error("inspection projection does not round-trip");
  return projection;
}

export function validateInspectionCollection(value: unknown): InspectionCollection {
  screenInspectionCollection(value);
  const row = record(value, "collection"); keys(row, ["schema_version", "country_code", "collection_ref", "adapter_version", "source_snapshot_date", "definition_version", "definition_hash", "case_hashes", "parents"], "collection");
  if (row.schema_version !== COLLECTION_SCHEMA || row.country_code !== "bs" || row.adapter_version !== ADAPTER_VERSION) throw new Error("invalid collection contract");
  const case_hashes = list(row.case_hashes, "case_hashes").map((item, index) => hash(item, `case_hashes[${index}]`)); unique(case_hashes, "case_hashes");
  const parents = list(row.parents, "parents").map((item, index) => hash(item, `parents[${index}]`)); unique(parents, "parents");
  const result: InspectionCollection = { schema_version: COLLECTION_SCHEMA, country_code: "bs", collection_ref: ref(row.collection_ref, "collection_ref"), adapter_version: ADAPTER_VERSION, source_snapshot_date: date(row.source_snapshot_date, "source_snapshot_date"), definition_version: string(row.definition_version, "definition_version"), definition_hash: hash(row.definition_hash, "definition_hash"), case_hashes, parents };
  return result;
}

export type StoredInspectionObject = { object_hash: string; object_json: string; object_kind: "case" | "collection" };

// Rebuild solely from project-controlled objects; the caller supplies a
// restricted read-back operation. No working cache or Convex row is needed.
export async function restoreInspectionCollection(collectionHash: string, read: (hash: string) => Promise<StoredInspectionObject | null>): Promise<{ collection: InspectionCollection; cases: InspectionCase[] }> {
  const seen = new Map<string, StoredInspectionObject>();
  const fetch = async (hashValue: string, kind: "case" | "collection"): Promise<StoredInspectionObject> => {
    const stored = seen.get(hashValue) ?? await read(hashValue);
    if (stored === null || stored.object_hash !== hashValue || stored.object_kind !== kind) throw new Error(`Missing or mismatched hosted ${kind} object ${hashValue}`);
    verifyObjectBytes(stored.object_json, hashValue);
    seen.set(hashValue, stored);
    return stored;
  };
  const root = await fetch(collectionHash, "collection");
  const collection = validateInspectionCollection(JSON.parse(root.object_json));
  const cases: InspectionCase[] = [];
  for (const caseHash of collection.case_hashes) {
    const caseValue = validateInspectionCase((await fetch(caseHash, "case")).object_json, caseHash);
    if (caseValue.source_snapshot_date !== collection.source_snapshot_date || caseValue.definition_hash !== collection.definition_hash || caseValue.definition_version !== collection.definition_version) throw new Error("Collection member context differs from manifest");
    cases.push(caseValue);
  }
  unique(cases.map((item) => item.case_ref), "restored case references");
  const checked = new Set<string>();
  const active = new Set<string>();
  const history = async (hashValue: string, kind: "case" | "collection", logicalRef: string): Promise<void> => {
    if (active.has(hashValue)) throw new Error("Inspection parent graph contains a cycle");
    if (checked.has(hashValue)) return;
    active.add(hashValue);
    const stored = await fetch(hashValue, kind);
    const value = kind === "case" ? validateInspectionCase(stored.object_json, hashValue) : validateInspectionCollection(JSON.parse(stored.object_json));
    const currentRef = kind === "case" ? (value as InspectionCase).case_ref : (value as InspectionCollection).collection_ref;
    if (currentRef !== logicalRef) throw new Error("Inspection parent belongs to another object");
    for (const parent of value.parents) await history(parent, kind, logicalRef);
    active.delete(hashValue);
    checked.add(hashValue);
  };
  for (const caseValue of cases) for (const parent of caseValue.parents) await history(parent, "case", caseValue.case_ref);
  for (const parent of collection.parents) await history(parent, "collection", collection.collection_ref);
  return { collection, cases };
}
