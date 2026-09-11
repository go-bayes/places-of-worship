import assert from "node:assert/strict";
import fs from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";

registerHooks({ resolve(specifier, context, nextResolve) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) { for (const ext of [".js", ".ts"]) { const candidate = new URL(`${specifier}${ext}`, context.parentURL); if (fs.existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context); } } return nextResolve(specifier, context); } });
const { ingestBundle, batchDisposeReceipts, getReceipt } = await import("./internalAgentIntake.ts");
const { sha256 } = await import("./lib/sha256.ts");
const fixtureUrl = new URL("../scripts/agent_research/fixtures/internal-review-bundle.json", import.meta.url);
const bundleJson = fs.readFileSync(fixtureUrl, "utf8");
const bundle = JSON.parse(bundleJson);

function context() {
  const rows = { users: [], agent_intake_receipts: [], tasks: [], evidence_drafts: [], agent_reviews: [], task_events: [], review_decisions: [] };
  const db = {
    query(table) {
      let filters = [];
      const q = { eq(key, value) { filters.push([key, value]); return q; } };
      const selected = () => rows[table].filter(row => filters.every(([k, v]) => row[k] === v));
      const chain = { withIndex(_name, select) { if (select) select(q); return chain; }, order() { return chain; }, async unique() { return selected()[0] ?? null; }, async collect() { return selected(); }, async take(n) { return selected().slice(0, n); }, async first() { return selected()[0] ?? null; } };
      return chain;
    },
    async insert(table, value) { const id = `${table}_${rows[table].length + 1}`; rows[table].push({ ...value, _id: id }); return id; },
    async get(id) { return Object.values(rows).flat().find(row => row._id === id) ?? null; },
    async patch(id, value) { Object.assign(await db.get(id), value); },
  };
  const auth = { async getUserIdentity() { return { tokenIdentifier: "human" }; } };
  return { db, rows, auth };
}

test("disabled intake rejects before any write", async () => {
  delete process.env.POW_INTERNAL_AGENT_INGEST_ENABLED;
  const ctx = context();
  await assert.rejects(ingestBundle._handler(ctx, { bundleJson, bundleHash: sha256(bundleJson) }), /disabled/);
  assert.equal(ctx.rows.tasks.length, 0);
});

test("hash mismatch rejects before any write", async () => {
  process.env.POW_INTERNAL_AGENT_INGEST_ENABLED = "true";
  const ctx = context();
  await assert.rejects(ingestBundle._handler(ctx, { bundleJson, bundleHash: "0".repeat(64) }), /does not match/);
  assert.equal(ctx.rows.tasks.length, 0);
  assert.equal(ctx.rows.agent_intake_receipts.length, 0);
});

test("enabled intake writes one provisional receipt and is idempotent", async () => {
  process.env.POW_INTERNAL_AGENT_INGEST_ENABLED = "true";
  const ctx = context(); const bundleHash = sha256(bundleJson);
  const first = await ingestBundle._handler(ctx, { bundleJson, bundleHash });
  assert.equal(first.created, true); assert.equal(ctx.rows.tasks.length, 1); assert.equal(ctx.rows.agent_intake_receipts.length, 1);
  const second = await ingestBundle._handler(ctx, { bundleJson, bundleHash });
  assert.equal(second.created, false); assert.equal(second.receipt_id, first.receipt_id); assert.equal(ctx.rows.tasks.length, 1);
});


test("human batch return validates every receipt before writes", async () => {
  process.env.POW_INTERNAL_AGENT_INGEST_ENABLED = "true";
  const ctx = context();
  await ctx.db.insert("users", {auth_subject: "human", status: "active", roles: ["reviewer"]});
  const items = [];
  for (const key of ["c", "d"]) {
    const b = JSON.parse(bundleJson); b.submission_key = key.repeat(64);
    const raw = JSON.stringify(b); const hash = sha256(raw);
    const receipt = await ingestBundle._handler(ctx, {bundleJson: raw, bundleHash: hash});
    items.push({receipt_id: receipt.receipt_id, expected_hash: hash});
  }
  await assert.rejects(batchDisposeReceipts._handler(ctx, {items: [items[0], {...items[1], expected_hash: "0".repeat(64)}], outcome: "return", note: "Please resolve the dates."}), /changed/);
  assert.equal(ctx.rows.review_decisions.length, 0);
  assert.ok(ctx.rows.tasks.every(t => t.status === "needs_review"));
  assert.deepEqual(await batchDisposeReceipts._handler(ctx, {items, outcome: "return", note: "Please resolve the dates."}), {count: 2});
  assert.equal(ctx.rows.review_decisions.length, 2);
  assert.ok(ctx.rows.tasks.every(t => t.status === "changes_requested"));
  assert.ok(ctx.rows.review_decisions.every(d => d.decision_status === "needs_more_evidence"));
});

test("receipt inspection excludes unauthorised humans and service identities", async () => {
  const ctx = context();
  for (const roles of [["ra"], ["service"]]) {
    ctx.rows.users = [{auth_subject: "human", status: "active", roles}];
    await assert.rejects(getReceipt._handler(ctx, {receiptId: "missing"}), /role/);
  }
});

test("receipt integrity is checked even when its stored hash field matches", async () => {
  process.env.POW_INTERNAL_AGENT_INGEST_ENABLED = "true";
  const ctx = context();
  await ctx.db.insert("users", {auth_subject: "human", status: "active", roles: ["reviewer"]});
  const hash = sha256(bundleJson);
  const receipt = await ingestBundle._handler(ctx, {bundleJson, bundleHash: hash});
  ctx.rows.agent_intake_receipts[0].bundle_json = "{}";
  await assert.rejects(batchDisposeReceipts._handler(ctx, {items: [{receipt_id: receipt.receipt_id, expected_hash: hash}], outcome: "reject", note: "Invalid record."}), /changed/);
  assert.equal(ctx.rows.review_decisions.length, 0);
});
