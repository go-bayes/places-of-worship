import assert from "node:assert/strict";
import fs from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";

registerHooks({ resolve(specifier, context, nextResolve) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) { for (const ext of [".js", ".ts"]) { const candidate = new URL(`${specifier}${ext}`, context.parentURL); if (fs.existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context); } } return nextResolve(specifier, context); } });
const { ingestBundle, batchDisposeReceipts, getReceipt, findReceiptForBytes, findReceiptByHash } = await import("./internalAgentIntake.ts");
const { sha256 } = await import("./lib/sha256.ts");
const fixtureUrl = new URL("../scripts/agent_research/fixtures/internal-review-bundle.json", import.meta.url);
const bundleJson = fs.readFileSync(fixtureUrl, "utf8");
const bundle = JSON.parse(bundleJson);

function context() {
  const rows = { users: [], agent_intake_receipts: [], tasks: [], evidence_drafts: [], evidence_versions: [], evidence_submission_receipts: [], evidence_head_changes: [], site_occupancies: [], agent_reviews: [], agent_judgments: [], task_events: [], review_decisions: [] };
  const db = {
    query(table) {
      let filters = [];
      const q = { eq(key, value) { filters.push([key, value]); return q; } };
      // index fields may be nested paths; convex walks a descending index newest first
      const selected = () => rows[table].filter(row => filters.every(([k, v]) => k.split(".").reduce((o, part) => o?.[part], row) === v));
      let descending = false;
      const chain = { withIndex(_name, select) { if (select) select(q); return chain; }, order(direction) { descending = direction === "desc"; return chain; }, async take(n) { const found = selected(); return (descending ? found.reverse() : found).slice(0, n); }, async unique() { return selected()[0] ?? null; }, async collect() { return selected(); }, async first() { return selected()[0] ?? null; } };
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

test("cited-name admissions require the deployment flag before any write", async () => {
  const value = structuredClone(bundle);
  const claim = value.dossier.claims[0];
  claim.value = "opened 1891 under Rev'd Pat Example";
  claim.quoted_support = "built in 1891 under Rev'd Pat Example";
  value.dossier.personal_details_quarantine.items = [
    { kind: "person_name", context_claim_id: claim.claim_id, admitted_by_rule: "public_source_cited.v1", field: "value", start: 18, end: 35 },
    { kind: "person_name", context_claim_id: claim.claim_id, admitted_by_rule: "public_source_cited.v1", field: "quoted_support", start: 20, end: 37 },
  ];
  value.dossier.personal_details_quarantine.item_count = 2;
  const text = JSON.stringify(value), hash = sha256(text);
  const ctx = context();
  process.env.POW_INTERNAL_AGENT_INGEST_ENABLED = "true";
  try {
    delete process.env.POW_CITED_NAME_RULE_ENABLED;
    await assert.rejects(ingestBundle._handler(ctx, { bundleJson: text, bundleHash: hash }), /Cited-name admissions are disabled/);
    assert.equal(ctx.rows.tasks.length, 0);
    assert.equal(ctx.rows.agent_intake_receipts.length, 0);
    process.env.POW_CITED_NAME_RULE_ENABLED = "1";
    const receipt = await ingestBundle._handler(ctx, { bundleJson: text, bundleHash: hash });
    assert.equal(receipt.created, true);
    assert.equal(ctx.rows.tasks.length, 1);
    delete process.env.POW_CITED_NAME_RULE_ENABLED;
    await assert.rejects(ingestBundle._handler(ctx, { bundleJson: text, bundleHash: hash }), /Cited-name admissions are disabled/);
  } finally {
    delete process.env.POW_CITED_NAME_RULE_ENABLED;
  }
});

test("an exact retry of receipted bytes returns the receipt even when current rules refuse them", async () => {
  process.env.POW_INTERNAL_AGENT_INGEST_ENABLED = "true";
  const ctx = context();
  // a bundle receipted before the reported-model rule: its review run carries no model id.
  const legacy = JSON.parse(bundleJson); legacy.review_run.model_id_reported = null;
  const legacyJson = JSON.stringify(legacy); const legacyHash = sha256(legacyJson);
  ctx.rows.agent_intake_receipts.push({ _id: "agent_intake_receipts_1", receipt_id: "legacy:receipt", submission_key: legacy.submission_key, bundle_hash: legacyHash, bundle_json: legacyJson, task_id: "legacy", evidence_draft_id: "legacy:draft:1", agent_review_id: "legacy:review:1", created_at: 1 });
  const retry = await ingestBundle._handler(ctx, { bundleJson: legacyJson, bundleHash: legacyHash });
  assert.deepEqual(retry, { receipt_id: "legacy:receipt", task_id: "legacy", evidence_draft_id: "legacy:draft:1", agent_review_id: "legacy:review:1", created: false });
  assert.equal(ctx.rows.tasks.length, 0);
  // the read-only route used by the submit command finds the same receipt and writes nothing.
  const found = await findReceiptForBytes._handler(ctx, { bundleJson: legacyJson, bundleHash: legacyHash });
  assert.deepEqual(found, { receipt_id: "legacy:receipt", task_id: "legacy", evidence_draft_id: "legacy:draft:1", agent_review_id: "legacy:review:1" });
  assert.equal(await findReceiptForBytes._handler(context(), { bundleJson: legacyJson, bundleHash: legacyHash }), null);
  await assert.rejects(findReceiptForBytes._handler(ctx, { bundleJson: legacyJson, bundleHash: "0".repeat(64) }), /does not match/);
  assert.equal(await findReceiptForBytes._handler(ctx, { bundleJson: legacyJson + " ", bundleHash: sha256(legacyJson + " ") }), null);
  assert.equal(ctx.rows.agent_intake_receipts.length, 1);
  // the submit command's hash-only lookup: the digest of the stored bytes comes back, never the bytes.
  const byHash = await findReceiptByHash._handler(ctx, { bundleHash: legacyHash });
  assert.deepEqual(byHash, { receipt_id: "legacy:receipt", task_id: "legacy", evidence_draft_id: "legacy:draft:1", agent_review_id: "legacy:review:1", stored_bundle_sha256: legacyHash });
  assert.equal(await findReceiptByHash._handler(context(), { bundleHash: legacyHash }), null);
  await assert.rejects(findReceiptByHash._handler(ctx, { bundleHash: "not-a-hash" }), /64 lowercase hex/);
  // the same bytes without a receipt, or a stored receipt whose bytes differ, are validated and refused.
  await assert.rejects(ingestBundle._handler(context(), { bundleJson: legacyJson, bundleHash: legacyHash }), /model_id_reported/);
  ctx.rows.agent_intake_receipts[0].bundle_json = "{}";
  await assert.rejects(ingestBundle._handler(ctx, { bundleJson: legacyJson, bundleHash: legacyHash }), /model_id_reported/);
  // altered stored bytes report their own digest, so the caller's comparison fails.
  assert.equal((await findReceiptByHash._handler(ctx, { bundleHash: legacyHash })).stored_bundle_sha256, sha256("{}"));
  assert.equal(ctx.rows.tasks.length, 0);
});

test("intake records claim-grain judgments with the real access method (r-j7)", async () => {
  process.env.POW_INTERNAL_AGENT_INGEST_ENABLED = "true";
  const ctx = context(); const bundleHash = sha256(bundleJson);
  await ingestBundle._handler(ctx, { bundleJson, bundleHash });
  const judgments = ctx.rows.agent_judgments;
  // two claim checks, one recommendation, one status assessment
  assert.equal(judgments.length, 4);
  const supports = judgments.filter(j => j.judgment_kind === "claim_support");
  assert.equal(supports.length, bundle.review.claim_checks.length);
  for (const [index, check] of bundle.review.claim_checks.entries()) {
    assert.equal(supports[index].subject_kind, "claim");
    assert.equal(supports[index].subject_ref, `${bundleHash}#${check.claim_id}`);
    assert.equal(supports[index].access_method, check.access_method);
    assert.equal(supports[index].outcome, check.outcome);
    assert.equal(supports[index].judge.agent_name, "claude-advisory-reviewer-internal");
    assert.equal(supports[index].judge.instruction_sha256, bundle.review_run.prompt_sha256);
    // intake now refuses a run without a provider-reported model id, so the judge names it.
    assert.equal(supports[index].judge.model_reported, bundle.review_run.model_id_reported);
    assert.equal(supports[index].judge.model_unreported_reason, undefined);
  }
  const recommendation = judgments.find(j => j.judgment_kind === "recommendation");
  assert.equal(recommendation.outcome, bundle.review.recommendation);
  assert.equal(recommendation.subject_kind, "evidence_version");
  assert.equal(recommendation.subject_ref, ctx.rows.evidence_versions[0].object_hash);
  assert.equal(recommendation.context.task_id, ctx.rows.tasks[0].task_id);
  const status = judgments.find(j => j.judgment_kind === "status_assessment");
  assert.equal(status.subject_kind, "place"); assert.equal(status.subject_ref, bundle.dossier.place.place_ref);
  assert.equal(status.outcome, bundle.dossier.status_assessment.current_status);
  assert.equal(status.judge.agent_name, "codex-researcher-internal");
  assert.equal(status.judge.prompt_version, bundle.dossier.run_manifest.prompt_version);
  assert.equal(status.run.cost_basis, bundle.dossier.run_manifest.cost_basis);
  assert.equal(status.run.cost_usd, bundle.dossier.run_manifest.cost_usd_reported);
  // the source-level summary no longer asserts a check that did not run
  const summary = ctx.rows.agent_reviews[0].sources_checked;
  assert.ok(summary.every(s => s.method === "not_checked"), "fixture checks were not_checked");
  assert.equal(summary[0].source_title, bundle.dossier.claims[0].source.source_name);
  // an identical retry writes nothing more
  await ingestBundle._handler(ctx, { bundleJson, bundleHash });
  assert.equal(ctx.rows.agent_judgments.length, 4);
});


test("human batch return validates every receipt before writes", async () => {
  process.env.POW_INTERNAL_AGENT_INGEST_ENABLED = "true";
  const ctx = context();
  await ctx.db.insert("users", {auth_subject: "human", status: "active", roles: ["reviewer"]});
  const items = [];
  for (const key of ["c", "d"]) {
    const b = JSON.parse(bundleJson); b.dossier.dossier_id = `${b.dossier.dossier_id}:${key}`; b.submission_key = sha256(b.dossier.dossier_id);
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

const { listReviewQueue, recordReviewDecision } = await import("./reviews.ts");

test("OSM intake retains object type and bare identifier, while new nominations omit both", async () => {
  process.env.POW_INTERNAL_AGENT_INGEST_ENABLED = "true";
  for (const ref of ["osm:node/12", "osm:way/34", "osm:relation/56", "new:example-church"]) {
    const ctx = context(); const b = JSON.parse(bundleJson); b.dossier.place.place_ref = ref;
    const m = b.dossier.run_manifest; m.idempotency_key = sha256([ref, m.prompt_version, m.model_id_requested, b.dossier.place.seed_source].join("|"));
    const raw = JSON.stringify(b);
    await ingestBundle._handler(ctx, {bundleJson: raw, bundleHash: sha256(raw)});
    const task = ctx.rows.tasks[0];
    assert.equal(task.source_record_id, ref);
    assert.equal(task.osm_object_type, ref.startsWith("osm:") ? ref.slice(4).split("/")[0] : undefined);
    assert.equal(task.matched_osm_id, ref.startsWith("osm:") ? ref.split("/")[1] : undefined);
  }
});

test("batch disposition uses ordinary note, claim, comment, and actor rules", async () => {
  process.env.POW_INTERNAL_AGENT_INGEST_ENABLED = "true";
  for (const outcome of ["return", "reject"]) {
    const ctx = context();
    await ctx.db.insert("users", {auth_subject: "human", status: "active", roles: ["admin", "reviewer"]});
    const hash = sha256(bundleJson); const receipt = await ingestBundle._handler(ctx, {bundleJson, bundleHash: hash});
    Object.assign(ctx.rows.tasks[0], {review_claimed_by: "other", review_claimed_at: 1, pending_reviewer_comment: "question"});
    const args = {items: [{receipt_id: receipt.receipt_id, expected_hash: hash}], outcome, note: "x"};
    await assert.rejects(batchDisposeReceipts._handler(ctx, args), /note/);
    assert.equal(ctx.rows.review_decisions.length, 0);
    await batchDisposeReceipts._handler(ctx, {...args, note: "Reviewed source evidence."});
    assert.equal(ctx.rows.tasks[0].review_claimed_by, undefined);
    assert.equal(ctx.rows.tasks[0].review_claimed_at, undefined);
    assert.equal(ctx.rows.tasks[0].pending_reviewer_comment, undefined);
    assert.equal(ctx.rows.task_events.at(-1).actor_role, "reviewer");
  }
});

test("revised draft queue omits stale advisory review and portal-shaped decision succeeds", async () => {
  process.env.POW_INTERNAL_AGENT_INGEST_ENABLED = "true";
  const ctx = context();
  await ctx.db.insert("users", {auth_subject: "human", status: "active", roles: ["reviewer"]});
  await ingestBundle._handler(ctx, {bundleJson, bundleHash: sha256(bundleJson)});
  const old = ctx.rows.evidence_drafts[0]; old.draft_status = "superseded";
  await ctx.db.insert("evidence_drafts", {task_id: old.task_id, evidence_draft_id: "revised", draft_status: "submitted", created_by: "ra"});
  const [row] = await listReviewQueue._handler(ctx, {});
  assert.equal(row.latestDraft.evidence_draft_id, "revised");
  assert.equal(row.latestAgentReview, null);
  await recordReviewDecision._handler(ctx, {taskId: row.task.task_id, decision: {evidence_draft_id: "revised", decision_status: "needs_more_evidence", decision_note: "Please clarify the dates."}});
  assert.equal(ctx.rows.tasks[0].status, "changes_requested");
  ctx.rows.tasks[0].status = "needs_review";
  await ctx.db.insert("agent_reviews", {task_id: old.task_id, evidence_draft_id: "revised", agent_review_id: "fresh", created_at: 2});
  const [refreshed] = await listReviewQueue._handler(ctx, {});
  assert.equal(refreshed.latestAgentReview.agent_review_id, "fresh");
});
