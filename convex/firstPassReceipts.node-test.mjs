import assert from "node:assert/strict";
import fs from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";

registerHooks({ resolve(specifier, context, nextResolve) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) { for (const ext of [".js", ".ts"]) { const candidate = new URL(`${specifier}${ext}`, context.parentURL); if (fs.existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context); } } return nextResolve(specifier, context); } });
const { ingestFirstPass, getFirstPassRecord, getFirstPassReceipt, listFirstPassReceipts } = await import("./firstPassReceipts.ts");
const { sha256 } = await import("./lib/sha256.ts");
const { verifyObjectBytes, objectReceiptId } = await import("./lib/objectReceipts.ts");

const fixture = (name) => JSON.parse(fs.readFileSync(new URL(`../scripts/agent_research/fixtures/${name}`, import.meta.url), "utf8"));
const partial = () => fixture("first-pass.json");
const researched = () => fixture("first-pass-researched.json");

// the archive's version-1 wire format: sorted keys, compact, ascii, newline.
// python writes an integral float as -43.0 where javascript writes -43; the
// server hashes whatever bytes arrive, so either spelling tests the contract.
function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeys(value[key])]));
  return value;
}
function wire(record) {
  return JSON.stringify(sortKeys(record)).replace(/[\u0080-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`) + "\n";
}
function args(record) {
  const recordJson = wire(record);
  return { recordJson, recordHash: sha256(recordJson) };
}

function context() {
  const rows = { users: [], agent_first_pass_receipts: [], agent_judgments: [], tasks: [], evidence_drafts: [], evidence_versions: [] };
  const db = {
    query(table) {
      const filters = [];
      const q = { eq(key, value) { filters.push([key, value]); return q; } };
      const read = (row, key) => key.split(".").reduce((value, part) => value?.[part], row);
      const selected = () => rows[table].filter((row) => filters.every(([k, v]) => read(row, k) === v));
      const chain = { withIndex(_name, select) { if (select) select(q); return chain; }, order() { return chain; }, async unique() { const found = selected(); if (found.length > 1) throw new Error("unique() found several rows"); return found[0] ?? null; }, async collect() { return selected(); }, async take(n) { return selected().slice(0, n); }, async first() { return selected()[0] ?? null; } };
      return chain;
    },
    async insert(table, value) { const id = `${table}_${rows[table].length + 1}`; rows[table].push({ ...value, _id: id }); return id; },
    async get(id) { return Object.values(rows).flat().find((row) => row._id === id) ?? null; },
    async patch(id, value) { Object.assign(await db.get(id), value); },
  };
  const auth = { async getUserIdentity() { return { tokenIdentifier: "human" }; } };
  return { db, rows, auth };
}

function enable() { process.env.POW_INTERNAL_AGENT_INGEST_ENABLED = "true"; }

test("the receipt contract checks the address before parsing", () => {
  const text = wire(partial());
  assert.equal(verifyObjectBytes(text, sha256(text)).byteLength, text.length);
  assert.throws(() => verifyObjectBytes(text, "0".repeat(64)), /does not match/);
  assert.throws(() => verifyObjectBytes(text.trimEnd(), sha256(text.trimEnd())), /newline/);
  assert.throws(() => verifyObjectBytes(`${text}\n`, sha256(`${text}\n`)), /newline/);
  const accented = text.replace("When did", "Whén did");
  assert.throws(() => verifyObjectBytes(accented, sha256(accented)), /ASCII/);
  assert.throws(() => verifyObjectBytes(text, "A".repeat(64)), /lowercase hex/);
  assert.equal(objectReceiptId("first-pass", "a".repeat(64)), `first-pass:${"a".repeat(64)}`);
  assert.throws(() => objectReceiptId("First Pass", "a".repeat(64)), /namespace/);
});

test("a disabled deployment refuses before any write", async () => {
  delete process.env.POW_INTERNAL_AGENT_INGEST_ENABLED;
  const ctx = context();
  await assert.rejects(ingestFirstPass._handler(ctx, args(partial())), /disabled/);
  assert.equal(ctx.rows.agent_first_pass_receipts.length, 0);
  assert.equal(ctx.rows.users.length, 0);
});

test("bytes that do not match their hash are refused before any write", async () => {
  enable();
  const ctx = context();
  const { recordJson } = args(partial());
  await assert.rejects(ingestFirstPass._handler(ctx, { recordJson, recordHash: "0".repeat(64) }), /does not match/);
  const duplicated = recordJson.replace('{"annotations":[],', '{"annotations":[],"annotations":[],');
  await assert.rejects(ingestFirstPass._handler(ctx, { recordJson: duplicated, recordHash: sha256(duplicated) }), /duplicate JSON object key/);
  assert.equal(ctx.rows.agent_first_pass_receipts.length, 0);
});

test("a partial pass without a dossier gets a receipt and no judgments, and a retry is idempotent", async () => {
  enable();
  const ctx = context();
  const input = args(partial());
  const first = await ingestFirstPass._handler(ctx, input);
  assert.equal(first.created, true);
  assert.equal(first.receipt_id, `first-pass:${input.recordHash}`);
  assert.equal(first.storage_tier, "convex_only");
  assert.deepEqual(first.judgment_ids, []);
  const [receipt] = ctx.rows.agent_first_pass_receipts;
  assert.equal(receipt.record_json, input.recordJson);
  assert.equal(receipt.receipt_contract, "object-receipt.v1");
  assert.deepEqual(receipt.storage, { tier: "convex_only", byte_length: input.recordJson.length });
  assert.equal(receipt.outcome, "partial");
  assert.equal(receipt.model_reported, undefined);
  assert.equal(receipt.model_unreported_reason, partial().attribution.model_unreported_reason);
  assert.equal(receipt.cost_usd, undefined);
  assert.equal(receipt.cost_basis, "unknown");
  const second = await ingestFirstPass._handler(ctx, input);
  assert.deepEqual(second, { ...first, created: false });
  assert.equal(ctx.rows.agent_first_pass_receipts.length, 1);
  assert.equal(ctx.rows.users.length, 1);
});

test("a researched pass records its status assessment and annotations as judgments", async () => {
  enable();
  const ctx = context();
  const record = researched();
  const input = args(record);
  const result = await ingestFirstPass._handler(ctx, input);
  assert.equal(result.judgment_ids.length, 3);
  const judgments = ctx.rows.agent_judgments;
  assert.deepEqual(judgments.map((row) => row.judgment_id), result.judgment_ids);
  const status = judgments.find((row) => row.judgment_kind === "status_assessment");
  assert.equal(status.subject_kind, "place");
  assert.equal(status.subject_ref, record.place_ref);
  assert.equal(status.outcome, record.dossier.status_assessment.current_status);
  assert.equal(status.judge.agent_name, "codex-first-pass");
  assert.equal(status.judge.model_provider, "codex");
  assert.equal(status.judge.model_reported, "gpt-5.6-luna");
  assert.equal(status.judge.model_unreported_reason, undefined);
  assert.equal(status.judge.prompt_version, record.dossier.run_manifest.prompt_version);
  assert.equal(status.judge.code_revision, record.attribution.code_revision);
  assert.equal(status.judge.instruction_sha256, record.attribution.instruction_sha256);
  assert.deepEqual(status.run, { agent_run_id: record.attribution.agent_run_id, attempt: 1, cost_usd: 0.01, cost_basis: "tool_list_price" });
  assert.deepEqual(status.context, { task_id: undefined, evidence_draft_id: undefined, evidence_version_hash: undefined, place_ref: record.place_ref, country_code: "NZ" });
  const annotations = judgments.filter((row) => row.judgment_kind === "annotation");
  assert.equal(annotations.length, record.annotations.length);
  for (const [index, annotation] of record.annotations.entries()) {
    assert.equal(annotations[index].subject_kind, "claim");
    assert.equal(annotations[index].subject_ref, `${input.recordHash}#${annotation.claim_id}`);
    assert.equal(annotations[index].outcome, annotation.kind);
    assert.equal(annotations[index].basis_note, annotation.note);
    assert.equal(annotations[index].facet, `annotation-${index + 1}`);
    assert.equal(annotations[index].source_locator, record.dossier.claims.find((claim) => claim.claim_id === annotation.claim_id).source.locator);
    assert.equal(annotations[index].ai_generated, true);
  }
  // the claims stay in the record; no claim_support judgment is invented
  assert.equal(judgments.filter((row) => row.judgment_kind === "claim_support").length, 0);
  const again = await ingestFirstPass._handler(ctx, input);
  assert.equal(again.created, false);
  assert.deepEqual(again.judgment_ids, result.judgment_ids);
  assert.equal(ctx.rows.agent_judgments.length, 3);
  assert.equal(ctx.rows.agent_first_pass_receipts.length, 1);
});

test("a revision needs its parent's receipt first, for the same place, and reads as a revision", async () => {
  enable();
  const ctx = context();
  const parent = researched();
  const parentInput = args(parent);
  const child = researched();
  child.parents = [parentInput.recordHash];
  child.attribution.agent_run_id = "fixture:first-pass-revisit";
  child.stop_reason = "A synthetic revisit confirmed the earlier reading.";
  await assert.rejects(ingestFirstPass._handler(ctx, args(child)), /has no receipt/);
  assert.equal(ctx.rows.agent_first_pass_receipts.length, 0);
  await ingestFirstPass._handler(ctx, parentInput);
  const childResult = await ingestFirstPass._handler(ctx, args(child));
  assert.equal(childResult.created, true);
  const childReceipt = ctx.rows.agent_first_pass_receipts.find((row) => row.receipt_id === childResult.receipt_id);
  assert.deepEqual(childReceipt.parents, [parentInput.recordHash]);
  // the helper links the lane's earlier status assessment of the place
  const statuses = ctx.rows.agent_judgments.filter((row) => row.judgment_kind === "status_assessment");
  assert.equal(statuses.length, 2);
  assert.deepEqual(statuses[1].parents, [statuses[0].judgment_id]);
  // a revision that names a parent from another place is refused
  const stranger = partial();
  stranger.place_ref = "osm:way/2";
  stranger.parents = [parentInput.recordHash];
  await assert.rejects(ingestFirstPass._handler(ctx, args(stranger)), /another place/);
});

test("a portal context must name records this deployment holds", async () => {
  enable();
  const ctx = context();
  const record = researched();
  record.context = { task_id: "task_01" };
  await assert.rejects(ingestFirstPass._handler(ctx, args(record)), /task this deployment does not hold/);
  const versionHex = "a".repeat(64);
  ctx.rows.tasks.push({ task_id: "task_01", country_code: "NZ" });
  ctx.rows.evidence_drafts.push({ evidence_draft_id: "draft_01", task_id: "task_01" }, { evidence_draft_id: "draft_02", task_id: "task_02" });
  ctx.rows.evidence_versions.push({ object_hash: `sha256:${versionHex}`, task_id: "task_01", evidence_draft_id: "draft_01" });
  record.context = { task_id: "task_01", evidence_draft_id: "draft_02" };
  await assert.rejects(ingestFirstPass._handler(ctx, args(record)), /different task/);
  record.context = { task_id: "task_01", evidence_draft_id: "draft_01", evidence_version_hash: "b".repeat(64) };
  await assert.rejects(ingestFirstPass._handler(ctx, args(record)), /evidence version this deployment does not hold/);
  ctx.rows.tasks[0].country_code = "VU";
  record.context = { task_id: "task_01" };
  await assert.rejects(ingestFirstPass._handler(ctx, args(record)), /different country/);
  ctx.rows.tasks[0].country_code = "NZ";
  assert.equal(ctx.rows.agent_first_pass_receipts.length, 0);
  assert.equal(ctx.rows.agent_judgments.length, 0);
  record.context = { task_id: "task_01", evidence_draft_id: "draft_01", evidence_version_hash: versionHex, assistance_request_id: "assist_01" };
  const result = await ingestFirstPass._handler(ctx, args(record));
  const [receipt] = ctx.rows.agent_first_pass_receipts;
  assert.equal(receipt.task_id, "task_01");
  assert.equal(receipt.evidence_version_hash, versionHex);
  assert.equal(receipt.assistance_request_id, "assist_01");
  const judgment = ctx.rows.agent_judgments.find((row) => row.judgment_id === result.judgment_ids[0]);
  // judgments carry the stored evidence-version object hash, as the intake lane does
  assert.deepEqual(judgment.context, { task_id: "task_01", evidence_draft_id: "draft_01", evidence_version_hash: `sha256:${versionHex}`, place_ref: record.place_ref, country_code: "NZ" });
});

test("the server applies the archive's semantic rules", async () => {
  enable();
  const ctx = context();
  const cases = [
    [(r) => { r.outcome = "researched"; }, /researched requires/],
    [(r) => { r.outcome = "accepted"; }, /invalid enum/],
    [(r) => { r.next_questions = []; }, /next question/],
    [(r) => { r.usage.cost_usd = 0; }, /remain null/],
    [(r) => { r.usage.cost_basis = "api_invoice"; }, /requires a value/],
    [(r) => { r.attribution.model_unreported_reason = null; }, /requires a reason/],
    [(r) => { r.annotations = [{ claim_id: "invented", kind: "qualification", note: "Unsupported." }]; }, /unknown claim/],
    [(r) => { r.parents = ["a".repeat(64), "a".repeat(64)]; }, /duplicate parent/],
    [(r) => { r.created_at = "2026-02-30T00:00:00Z"; }, /creation timestamp/],
    [(r) => { r.country_code = "BS"; }, /invalid constant/],
    [(r) => { r.context = { reviewer: "someone" }; }, /unknown field reviewer/],
    [(r) => { Object.assign(r.searches[0], { outcome: "opened" }); }, /requires a locator/],
    [(r) => { Object.assign(r.searches[0], { outcome: "opened", locator: "http://127.0.0.1/secrets" }); }, /public HTTP/],
    [(r) => { Object.assign(r.searches[0], { outcome: "opened", locator: "https://example.org/a", attempted_at: "2026-09-18T05:50:00Z", retrieved_at: "2026-09-18T05:49:00Z" }); }, /precedes/],
    [(r) => { Object.assign(r.searches[0], { attempted_at: "2026-09-18T05:50:00Z" }); }, /unattempted/],
  ];
  for (const [mutate, pattern] of cases) {
    const record = partial();
    mutate(record);
    await assert.rejects(ingestFirstPass._handler(ctx, args(record)), pattern);
  }
  const foreign = researched();
  foreign.dossier.place.place_ref = "osm:way/2";
  await assert.rejects(ingestFirstPass._handler(ctx, args(foreign)), /another place/);
  assert.equal(ctx.rows.agent_first_pass_receipts.length, 0);
});

test("reads are role-gated, lists omit bytes, and recovery returns exact bytes", async () => {
  enable();
  const ctx = context();
  const input = args(researched());
  await ingestFirstPass._handler(ctx, input);
  ctx.rows.users.push({ _id: "users_ra", auth_subject: "human", status: "active", roles: ["ra"] });
  await assert.rejects(getFirstPassReceipt._handler(ctx, { recordHash: input.recordHash }), /role/);
  ctx.rows.users.at(-1).roles = ["reviewer"];
  const receipt = await getFirstPassReceipt._handler(ctx, { recordHash: input.recordHash });
  assert.equal(receipt.record_json, input.recordJson);
  const listed = await listFirstPassReceipts._handler(ctx, { placeRef: researched().place_ref });
  assert.equal(listed.length, 1);
  assert.equal(listed[0].record_json, undefined);
  assert.equal(listed[0].record_hash, input.recordHash);
  await assert.rejects(listFirstPassReceipts._handler(ctx, {}), /exactly one/);
  await assert.rejects(listFirstPassReceipts._handler(ctx, { placeRef: "x", limit: 51 }), /Limit/);
  const recovered = await getFirstPassRecord._handler(ctx, { recordHash: input.recordHash });
  assert.deepEqual(recovered, { record_hash: input.recordHash, record_json: input.recordJson, parents: [] });
  assert.equal(await getFirstPassRecord._handler(ctx, { recordHash: "c".repeat(64) }), null);
});
