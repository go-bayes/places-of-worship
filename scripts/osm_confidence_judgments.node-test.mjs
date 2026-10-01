import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(root, "scripts/osm_confidence_judgments.mjs");
const fixtures = path.join(root, "schemas/fixtures/agent-judgment-v1-1");
const { convert, isTracked } = await import("./osm_confidence_judgments.mjs");
const { validateScorerJudgment } = await import("../convex/lib/scorerJudgments.ts");
const { judgmentIdFor } = await import("../convex/lib/agentJudgments.ts");

const vectors = path.join(fixtures, "sample-signal-vectors.jsonl");
const manifest = path.join(fixtures, "sample-manifest.json");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "osm-judgments-"));
const sha = (text) => crypto.createHash("sha256").update(text).digest("hex");

// a perturbed copy of the fixture: the vector file is edited and the manifest
// is rewritten to name its new hash and line count
function variant(name, edit, manifestEdit = () => {}) {
  const lines = fs.readFileSync(vectors, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
  const edited = edit(lines) ?? lines;
  const text = `${edited.map((line) => JSON.stringify(line)).join("\n")}\n`;
  const vectorsPath = path.join(tmp, `${name}.jsonl`);
  fs.writeFileSync(vectorsPath, text);
  const m = JSON.parse(fs.readFileSync(manifest, "utf8"));
  m.durable_files[0].sha256 = sha(text);
  m.durable_files[0].row_count = edited.length;
  manifestEdit(m);
  const manifestPath = path.join(tmp, `${name}.manifest.json`);
  fs.writeFileSync(manifestPath, JSON.stringify(m));
  return { vectorsPath, manifestPath };
}

test("the fixture converts to the committed expected file", () => {
  const result = convert({ vectorsPath: vectors, manifestPath: manifest });
  assert.equal(`${JSON.stringify(result, null, 2)}\n`, fs.readFileSync(path.join(fixtures, "expected-judgments.json"), "utf8"));
});

test("out-of-scope features are skipped and counted; component rows follow the indicators", () => {
  const result = convert({ vectorsPath: vectors, manifestPath: manifest });
  assert.equal(result.counts.features, 5);
  assert.equal(result.counts.out_of_scope, 1);
  assert.equal(result.counts.in_scope, 4);
  assert.deepEqual(result.counts.rows_by_kind, { duplicate: 1, location: 4, registration_confidence: 4, status_assessment: 4 });
  const rows = result.batches.flat();
  assert.ok(!rows.some((row) => row.subject.ref === "osm:relation/3001"));
  assert.ok(rows.filter((row) => row.judgment_kind === "status_assessment").every((row) => ["likely_active", "unknown"].includes(row.outcome) && ["high", "medium", "low"].includes(row.confidence)));
  assert.ok(rows.filter((row) => row.judgment_kind === "location").every((row) => ["plausible", "unclear"].includes(row.outcome)));
});

test("every row passes the scorer validator, ids equal judgmentIdFor, and batches stay within 100", () => {
  const result = convert({ vectorsPath: vectors, manifestPath: manifest });
  const rows = result.batches.flat();
  rows.forEach((row) => validateScorerJudgment(row));
  assert.deepEqual(result.judgment_ids, rows.map((row) => judgmentIdFor(row)));
  assert.equal(new Set(result.judgment_ids).size, rows.length);
  assert.ok(result.batches.every((batch) => batch.length <= 100));
  // many features split into batches of at most 100
  const many = variant("many", (lines) => {
    const out = [];
    for (let i = 0; i < 60; i += 1) for (const line of lines.slice(0, 3)) out.push({ ...line, osm_key: `${line.osm_type}/${line.osm_id + 10000 * (i + 1)}`, osm_id: line.osm_id + 10000 * (i + 1) });
    return out;
  });
  const big = convert(many);
  assert.ok(big.batches.length > 1);
  assert.ok(big.batches.every((batch) => batch.length <= 100));
  assert.equal(big.batches.flat().length, big.judgment_ids.length);
});

test("conversion requires fired positive status support, even above the floor", () => {
  for (const basis of ["", "edit_stale;historic_tag", "check_recent", "cross_source_active_listing"]) {
    const v = variant(`status-${basis.replaceAll(";", "-") || "intercept"}`, (lines) => { lines[0].scores.basis.status = basis; });
    const row = convert(v).batches.flat().find((row) => row.judgment_kind === "status_assessment");
    const positive = ["check_recent", "cross_source_active_listing"].includes(basis);
    assert.equal(row.outcome, positive ? "likely_active" : "unknown");
    assert.equal(row.confidence, positive ? "high" : "low");
  }
});

test("conversion retains a matching 0.3 patch version from the vectors and manifest", () => {
  const v = variant("standard-patch", (lines) => { for (const line of lines) line.standard_version = "confidence-standard/0.3.0"; },
    (m) => { m.pipeline.parameters.standard_version = "confidence-standard/0.3.0"; });
  assert.ok(convert(v).batches.flat().every((row) => row.judge.standard_version === "confidence-standard/0.3.0"));
});

test("planted personal strings appear in no output string", () => {
  const out = JSON.stringify(convert({ vectorsPath: vectors, manifestPath: manifest }));
  for (const planted of ["Smith", "Alan Brown", "Jane Doe", "021 555", "555 0123", "Synthetic Editor", "St Andrew", "Mission Hall", "anglican", "presbyterian"]) {
    assert.ok(!out.includes(planted), `${planted} must not be copied`);
  }
  // the planted strings are in the input, so the check is not vacuous
  const input = fs.readFileSync(vectors, "utf8");
  for (const planted of ["Smith", "Alan Brown", "Jane Doe", "021 555"]) assert.ok(input.includes(planted));
});

test("a manifest mismatch is refused by field name", () => {
  for (const field of ["standard_version", "code_revision", "scorer_version", "config_sha256", "edition_id"]) {
    const v = variant(`bad-${field}`, (lines) => { lines[0][field] = field === "edition_id" ? "osm-pow:nz:edition:2026-09-01:ffffffffffff" : "changed"; });
    assert.throws(() => convert(v), new RegExp(field === "edition_id" ? "edition_id" : field));
  }
  const cut = variant("bad-cut", (lines) => { lines[0].tier.cut_points.component_floor = 0.5; });
  assert.throws(() => convert(cut), /cut_points/);
  const schema = variant("bad-schema", (lines) => { lines[1].schema_version = "osm-confidence-signal-vector.v0.2"; });
  assert.throws(() => convert(schema), /schema_version/);
});

test("manifest hash, country and edition faults are refused", () => {
  const stale = variant("stale", () => {}, (m) => { m.durable_files[0].sha256 = "0".repeat(64); });
  assert.throws(() => convert(stale), /matches no jsonl entry/);
  const two = variant("two", () => {}, (m) => { m.scope.country_codes = ["NZ", "AU"]; });
  assert.throws(() => convert(two), /exactly one/);
  const wrong = variant("wrong", () => {}, (m) => { m.scope.country_codes = ["AU"]; });
  assert.throws(() => convert(wrong), /not in the manifest country/);
  const rows = variant("rows", () => {}, (m) => { m.durable_files[0].row_count = 99; });
  assert.throws(() => convert(rows), /row_count/);
  const dup = variant("dup", (lines) => [...lines, lines[0]], () => {});
  assert.throws(() => convert(dup), /appears twice/);
});

test("a missing, null or non-boolean in_scope is refused", () => {
  for (const [name, value] of [["missing", undefined], ["null", null], ["string", "true"]]) {
    const v = variant(`scope-${name}`, (lines) => { if (value === undefined) delete lines[1].in_scope; else lines[1].in_scope = value; });
    assert.throws(() => convert(v), /in_scope is a boolean/);
  }
});

test("--limit and --osm-key narrow the run", () => {
  assert.equal(convert({ vectorsPath: vectors, manifestPath: manifest, limit: 1 }).counts.in_scope, 1);
  const one = convert({ vectorsPath: vectors, manifestPath: manifest, osmKeys: ["way/1002"] });
  assert.equal(one.counts.in_scope, 1);
  assert.deepEqual(one.batches.flat().map((row) => row.judgment_kind), ["registration_confidence", "status_assessment", "location", "duplicate"]);
});

test("--check passes on the committed fixture and the command refuses to overwrite a tracked file", () => {
  const ok = spawnSync("node", [script, "--check"], { cwd: root, encoding: "utf8" });
  assert.equal(ok.status, 0, ok.stderr);
  // a tracked path is refused (checked directly, so a failure cannot overwrite it)
  assert.equal(isTracked(path.join(root, "package.json")), true);
  assert.equal(isTracked(path.join(root, "exports/dry-run.json")), false);
  const out = path.join(tmp, "dry-run.json");
  const written = spawnSync("node", [script, "--vectors", vectors, "--manifest", manifest, "--out", out], { cwd: root, encoding: "utf8" });
  assert.equal(written.status, 0, written.stderr);
  assert.deepEqual(JSON.parse(fs.readFileSync(out, "utf8")), JSON.parse(fs.readFileSync(path.join(fixtures, "expected-judgments.json"), "utf8")));
});

test("--check fails on a perturbed fixture", () => {
  // run the script from a copy of the repo layout whose expected file differs
  const copy = fs.mkdtempSync(path.join(os.tmpdir(), "osm-judgments-check-"));
  fs.mkdirSync(path.join(copy, "scripts"), { recursive: true });
  fs.cpSync(path.join(root, "convex"), path.join(copy, "convex"), { recursive: true });
  fs.cpSync(path.join(root, "schemas"), path.join(copy, "schemas"), { recursive: true });
  fs.cpSync(path.join(root, "scripts/agent_research"), path.join(copy, "scripts/agent_research"), { recursive: true });
  fs.symlinkSync(path.join(root, "node_modules"), path.join(copy, "node_modules"));
  fs.copyFileSync(script, path.join(copy, "scripts/osm_confidence_judgments.mjs"));
  const expected = path.join(copy, "schemas/fixtures/agent-judgment-v1-1/expected-judgments.json");
  fs.writeFileSync(expected, fs.readFileSync(expected, "utf8").replace('"outcome": "review"', '"outcome": "escalate"'));
  const result = spawnSync("node", [path.join(copy, "scripts/osm_confidence_judgments.mjs"), "--check"], { cwd: copy, encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /out of date/);
});
