// converts the osm confidence scorer's signal vectors into agent-judgment.v1.1
// rows (docs/development/agent-judgments.md). a dry run: it reads local files,
// writes one json file and talks to no backend. the file's batches are the
// exact arguments of the internal mutation agentJudgments:ingestDeterministicJudgments;
// running that mutation against a deployment is a data import that needs the
// project lead's instruction.
//
//   node scripts/osm_confidence_judgments.mjs --vectors <signal-vectors.jsonl> --manifest <data-manifest.json> --out <dry-run.json> [--limit N] [--osm-key way/123 ...] [--summary-only]
//   node scripts/osm_confidence_judgments.mjs --check          # fixture currency, run in CI
//   node scripts/osm_confidence_judgments.mjs --write-expected # rewrite the committed expected file
//
// the converter reads no tag-derived string (name, religion, denomination,
// check_date, creation_editor, name_scripts, own_lifecycle_keys,
// node_area_partner, name_denomination_keywords): the rows carry the scorer's
// numbers, closed-vocabulary term names and an allowlist of numeric and
// boolean signals, and nothing else.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) {
      for (const extension of [".js", ".ts"]) {
        const candidate = new URL(`${specifier}${extension}`, context.parentURL);
        if (fs.existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
      }
    }
    return nextResolve(specifier, context);
  },
});

const { JUDGMENTS_PER_CALL_MAX, JUDGMENT_SCHEMA_VERSION_1_1, judgmentIdFor } = await import("../convex/lib/agentJudgments.ts");
const { SCORER_AGENT_NAME, SCORER_SIGNAL_VALUE_KEYS, scorerBasisNote, scorerCategories, validateScorerJudgment } = await import("../convex/lib/scorerJudgments.ts");

export const CONVERTER_VERSION = "0.2.0";
const VECTOR_SCHEMA = "osm-confidence-signal-vector.v0.1";
const TIERS = ["screened", "review", "escalate"];
const CROSS_SOURCE = ["not_computed", "no_match", "match"];

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureDir = path.join(repoRoot, "schemas/fixtures/agent-judgment-v1-1");

function fail(message) {
  throw new Error(message);
}

function sha256Bytes(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function splitTerms(value, label, key) {
  if (value === null || value === undefined || value === "") return [];
  if (typeof value !== "string") fail(`${key}: ${label} is not a string`);
  return value.split(";").filter((term) => term !== "");
}

function bool(value, label, key) {
  if (typeof value !== "boolean") fail(`${key}: ${label} is not a boolean`);
  return value;
}

function unit(value, label, key) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) fail(`${key}: ${label} is not a number in [0, 1]`);
  return value;
}

// signal name -> value over the vector's signal groups; only numbers,
// booleans and nulls are ever copied, and only for allowlisted names
function signalValues(signals, key) {
  const flat = new Map();
  for (const [group, block] of Object.entries(signals ?? {})) {
    if (block === null || typeof block !== "object" || Array.isArray(block)) continue;
    for (const [name, value] of Object.entries(block)) {
      const flatName = group === "tag_completeness" && name === "score" ? "tag_completeness.score"
        : group === "cross_source_agreement" ? `cross_source_agreement.${name}`
        : name;
      if (!SCORER_SIGNAL_VALUE_KEYS.includes(flatName)) continue;
      if (flat.has(flatName)) fail(`${key}: signal ${flatName} appears twice`);
      if (value === null || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) flat.set(flatName, value);
    }
  }
  return Object.fromEntries(SCORER_SIGNAL_VALUE_KEYS.filter((name) => flat.has(name)).map((name) => [name, flat.get(name)]));
}

function readManifest(manifestPath, vectorsSha) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const countries = manifest.scope?.country_codes;
  if (!Array.isArray(countries) || countries.length !== 1 || !/^[A-Z]{2}$/.test(countries[0])) fail("manifest scope.country_codes holds exactly one two-letter upper-case code");
  const entry = (manifest.durable_files ?? []).find((file) => file.format === "jsonl" && file.sha256 === vectorsSha);
  if (entry === undefined) fail("the signal-vector file's sha256 matches no jsonl entry in manifest durable_files");
  const parameters = manifest.pipeline?.parameters ?? {};
  const required = {
    snapshot_date: manifest.scope?.snapshot_date,
    git_commit: manifest.pipeline?.git_commit,
    edition_id: parameters.edition_id,
    scorer_version: parameters.scorer_version,
    standard_version: parameters.standard_version,
    config_sha256: parameters.config_sha256,
    cut_points: parameters.cut_points,
  };
  for (const [name, value] of Object.entries(required)) if (value === undefined || value === null) fail(`manifest lacks ${name}`);
  if (!/^[0-9a-f]{64}$/.test(required.config_sha256)) fail("manifest config_sha256 is not a sha256");
  const edition = required.edition_id.split(":");
  if (edition.length < 5 || edition[1].toUpperCase() !== countries[0]) fail("manifest edition_id is not in the manifest country");
  if (edition[3] !== required.snapshot_date) fail("manifest edition_id date differs from scope.snapshot_date");
  return { manifest, entry, country: countries[0], ...required, dataset_version_id: manifest.dataset_version_id ?? null };
}

function featureRows(m, vectorsSha, record) {
  const key = record.osm_key;
  if (!/^(node|way|relation)\/[0-9]+$/.test(key ?? "")) fail(`${key}: osm_key is not <type>/<id>`);
  if (record.osm_key !== `${record.osm_type}/${record.osm_id}`) fail(`${key}: osm_key differs from osm_type and osm_id`);
  const checks = { edition_id: m.edition_id, standard_version: m.standard_version, scorer_version: m.scorer_version, config_sha256: m.config_sha256, code_revision: m.git_commit };
  for (const [field, expected] of Object.entries(checks)) if (record[field] !== expected) fail(`${key}: ${field} differs from the manifest`);
  const tier = record.tier;
  if (tier === null || typeof tier !== "object" || !TIERS.includes(tier.tier)) fail(`${key}: tier is not screened, review or escalate`);
  const cut = tier.cut_points ?? {};
  if (!sameJson(Object.fromEntries(Object.keys(m.cut_points).sort().map((k) => [k, m.cut_points[k]])), Object.fromEntries(Object.keys(cut).sort().map((k) => [k, cut[k]])))) fail(`${key}: tier.cut_points differs from the manifest`);
  const scores = record.scores;
  const ind = record.indicators;
  if (scores === null || scores === undefined || ind === null || ind === undefined) fail(`${key}: an in-scope feature carries scores and indicators`);
  if (scores.calibrated !== false) fail(`${key}: scores.calibrated is not false`);
  const cross = ind.cross_source_match;
  if (!CROSS_SOURCE.includes(cross)) fail(`${key}: cross_source_match is not a known state`);
  const matched = record.signals?.cross_source_agreement?.n_sources_matched;
  const score = {
    edition_id: record.edition_id,
    composite: unit(scores.composite, "composite", key),
    components: {
      identity: unit(scores.components?.identity, "identity", key),
      location: unit(scores.components?.location, "location", key),
      status: unit(scores.components?.status, "status", key),
      denomination: unit(scores.components?.denomination, "denomination", key),
    },
    tier: tier.tier,
    tier_reasons: Array.isArray(tier.reasons) ? tier.reasons : fail(`${key}: tier.reasons is not an array`),
    tier_pending: Array.isArray(tier.pending) ? tier.pending : fail(`${key}: tier.pending is not an array`),
    cut_points: {
      screened_min_composite: unit(cut.screened_min_composite, "screened_min_composite", key),
      review_min_composite: unit(cut.review_min_composite, "review_min_composite", key),
      component_floor: unit(cut.component_floor, "component_floor", key),
    },
    calibrated: false,
    signals_fired: {
      identity: splitTerms(scores.basis?.identity, "basis.identity", key),
      location: splitTerms(scores.basis?.location, "basis.location", key),
      status: splitTerms(scores.basis?.status, "basis.status", key),
      denomination: splitTerms(scores.basis?.denomination, "basis.denomination", key),
    },
    signal_values: signalValues(record.signals, key),
    indicators: {
      duplicate: bool(ind.duplicate, "indicators.duplicate", key),
      conflict: bool(ind.conflict, "indicators.conflict", key),
      conflict_reasons: splitTerms(ind.conflict_reasons, "indicators.conflict_reasons", key),
      generic_name: bool(ind.generic_name, "indicators.generic_name", key),
      missing_name: bool(ind.missing_name, "indicators.missing_name", key),
      cross_source_match: cross,
      cross_source_sources_matched: typeof matched === "number" && Number.isFinite(matched) ? matched : null,
    },
  };
  const ref = `osm:${record.osm_type}/${record.osm_id}`;
  const common = {
    schema_version: JUDGMENT_SCHEMA_VERSION_1_1,
    subject: { kind: "place", ref },
    score,
    judge: {
      agent_name: SCORER_AGENT_NAME,
      kind: "deterministic",
      prompt_version: m.scorer_version,
      code_revision: record.code_revision,
      signal_vector_sha256: vectorsSha,
      standard_version: m.standard_version,
    },
    run: { agent_run_id: `osm-confidence:${record.edition_id}:${vectorsSha.slice(0, 12)}:${CONVERTER_VERSION}`, attempt: 1, cost_basis: "no_model_call" },
    context: { place_ref: ref, country_code: m.country },
  };
  const kinds = ["registration_confidence", "status_assessment", "location"];
  if (score.indicators.duplicate) kinds.push("duplicate");
  const facets = { status_assessment: "status", location: "location", duplicate: "duplicate" };
  return kinds.map((kind) => {
    // share the ingest mapping: status needs a fired positive signal and
    // reaches at most likely_active until calibration.
    const row = { ...common, judgment_kind: kind, ...(facets[kind] ? { facet: facets[kind] } : {}), ...scorerCategories(kind, score) };
    return { ...row, basis_note: scorerBasisNote(row) };
  });
}

export function convert({ vectorsPath, manifestPath, limit, osmKeys = [] }) {
  // one read: the hash the manifest approves and the text converted are the same bytes
  const bytes = fs.readFileSync(vectorsPath);
  const vectorsSha = sha256Bytes(bytes);
  const m = readManifest(manifestPath, vectorsSha);
  const text = bytes.toString("utf8");
  const lines = text.split("\n").filter((line) => line.trim() !== "");
  if (m.entry.row_count !== undefined && m.entry.row_count !== lines.length) fail("the vector file's line count differs from the manifest row_count");
  const counts = { features: 0, in_scope: 0, out_of_scope: 0, rows_by_kind: {}, tiers: {} };
  const rows = [];
  const seen = new Set();
  for (const [index, line] of lines.entries()) {
    let record;
    try { record = JSON.parse(line); } catch { fail(`line ${index + 1} is not json`); }
    if (record.schema_version !== VECTOR_SCHEMA) fail(`line ${index + 1}: schema_version is not ${VECTOR_SCHEMA}`);
    if (record.edition_id !== m.edition_id) fail(`line ${index + 1}: edition_id differs from the manifest`);
    if (seen.has(record.osm_key)) fail(`${record.osm_key}: appears twice`);
    seen.add(record.osm_key);
    counts.features += 1;
    if (typeof record.in_scope !== "boolean") fail(`line ${index + 1}: in_scope is a boolean`);
    if (record.in_scope === false) { counts.out_of_scope += 1; continue; }
    if (osmKeys.length > 0 && !osmKeys.includes(record.osm_key)) continue;
    if (limit !== undefined && counts.in_scope >= limit) continue;
    counts.in_scope += 1;
    counts.tiers[record.tier?.tier] = (counts.tiers[record.tier?.tier] ?? 0) + 1;
    for (const row of featureRows(m, vectorsSha, record)) {
      try { validateScorerJudgment(row); } catch (error) { fail(`${record.osm_key}: ${error.message}`); }
      counts.rows_by_kind[row.judgment_kind] = (counts.rows_by_kind[row.judgment_kind] ?? 0) + 1;
      rows.push(row);
    }
  }
  const batches = [];
  for (let start = 0; start < rows.length; start += JUDGMENTS_PER_CALL_MAX) batches.push(rows.slice(start, start + JUDGMENTS_PER_CALL_MAX));
  const sortKeys = (counter) => Object.fromEntries(Object.entries(counter).sort(([a], [b]) => (a < b ? -1 : 1)));
  counts.rows_by_kind = sortKeys(counts.rows_by_kind);
  counts.tiers = sortKeys(counts.tiers);
  return {
    converter_version: CONVERTER_VERSION,
    source: {
      path: path.basename(vectorsPath),
      sha256: vectorsSha,
      rows: lines.length,
      dataset_version_id: m.dataset_version_id,
      country_code: m.country,
      edition_id: m.edition_id,
    },
    counts,
    batches,
    judgment_ids: rows.map((row) => judgmentIdFor(row)),
  };
}

export function isTracked(file) {
  const relative = path.relative(repoRoot, path.resolve(file));
  if (relative.startsWith("..")) return false;
  try {
    return execFileSync("git", ["ls-files", "--", relative], { cwd: repoRoot, encoding: "utf8" }).trim() !== "";
  } catch {
    return false;
  }
}

function parseArgs(argv) {
  const args = { osmKeys: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = () => argv[++i] ?? fail(`${flag} needs a value`);
    if (flag === "--vectors") args.vectors = value();
    else if (flag === "--manifest") args.manifest = value();
    else if (flag === "--out") args.out = value();
    else if (flag === "--limit") args.limit = Number(value());
    else if (flag === "--osm-key") args.osmKeys.push(value());
    else if (flag === "--summary-only") args.summaryOnly = true;
    else if (flag === "--check") args.check = true;
    else if (flag === "--write-expected") args.writeExpected = true;
    else fail(`unknown argument ${flag}`);
  }
  if (args.limit !== undefined && (!Number.isInteger(args.limit) || args.limit < 1)) fail("--limit is a positive integer");
  return args;
}

function fixtureConversion() {
  return convert({ vectorsPath: path.join(fixtureDir, "sample-signal-vectors.jsonl"), manifestPath: path.join(fixtureDir, "sample-manifest.json") });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const expectedPath = path.join(fixtureDir, "expected-judgments.json");
  if (args.check || args.writeExpected) {
    const text = `${JSON.stringify(fixtureConversion(), null, 2)}\n`;
    if (args.writeExpected) {
      fs.writeFileSync(expectedPath, text);
      console.log(`wrote ${path.relative(repoRoot, expectedPath)}`);
    } else if (!fs.existsSync(expectedPath) || fs.readFileSync(expectedPath, "utf8") !== text) {
      console.error("expected-judgments.json is out of date; run --write-expected and review the diff");
      process.exit(1);
    } else {
      console.log("agent-judgment.v1.1 fixture is current");
    }
    return;
  }
  if (!args.vectors || !args.manifest) fail("--vectors and --manifest are required");
  const result = convert({ vectorsPath: args.vectors, manifestPath: args.manifest, limit: args.limit, osmKeys: args.osmKeys });
  if (args.summaryOnly) {
    console.log(JSON.stringify({ source: result.source, counts: result.counts, batches: result.batches.length }, null, 2));
    return;
  }
  const out = args.out ?? path.join(repoRoot, "exports", `osm-confidence-judgments-${result.source.country_code.toLowerCase()}-${result.source.sha256.slice(0, 12)}.json`);
  if (isTracked(out)) fail(`refusing to write over a tracked file: ${out}`);
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`wrote ${out}: ${result.judgment_ids.length} judgments in ${result.batches.length} batches (${JSON.stringify(result.counts)})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  try { main(); } catch (error) { console.error(`error: ${error.message}`); process.exit(1); }
}
