import assert from "node:assert/strict";
import fs from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";

registerHooks({ resolve(specifier, context, nextResolve) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) { for (const ext of [".js", ".ts"]) { const candidate = new URL(`${specifier}${ext}`, context.parentURL); if (fs.existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context); } } return nextResolve(specifier, context); } });
const { pendingForBatch, recordArtifact, runBatch } = await import("./claudeReviews.ts");

function context({ withVersion = true } = {}) {
  const rows = {
    users: [{ _id: "users_1", roles: ["service"], status: "active" }],
    tasks: [{ _id: "tasks_1", task_id: "task_1", country_code: "NZ", source_record_id: "osm:way/1", status: "needs_review" }],
    evidence_versions: withVersion ? [{ _id: "ev_1", evidence_draft_id: "draft_1", version_index: 1, object_hash: "sha256:" + "b".repeat(64) }, { _id: "ev_2", evidence_draft_id: "draft_1", version_index: 2, object_hash: "sha256:" + "c".repeat(64) }] : [],
    agent_reviews: [], agent_judgments: [], task_events: [],
  };
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
  return { db, rows };
}

const checks = [
  { source_title: "History", url_or_file: "https://example.org/history", check: "existence", method: "http_fetch", outcome: "supported", note: "The page names the chapel." },
  { source_title: "History", url_or_file: "https://example.org/history", check: "date_support", method: "http_fetch", outcome: "unclear", note: "No opening year on the page." },
  { source_title: "History", url_or_file: "https://example.org/history", check: "location_plausibility", method: "not_checked", outcome: "requires_human_access" },
];
const args = { taskId: "task_1", evidenceDraftId: "draft_1", batchId: "agent-review-batch:1:abc", recommendation: "revise", reasoning: "Existence supported; the date is unresolved.", sourcesChecked: checks, culturalSensitivity: { flagged: false }, serviceUserId: "users_1" };

test("recordArtifact writes the artifact and one judgment per check plus the recommendation", async () => {
  const ctx = context();
  const reviewId = await recordArtifact._handler(ctx, args);
  assert.equal(ctx.rows.agent_reviews.length, 1);
  assert.equal(ctx.rows.agent_reviews[0].agent_review_id, reviewId);
  assert.equal(ctx.rows.agent_judgments.length, 4);
  const recommendation = ctx.rows.agent_judgments.find(j => j.judgment_kind === "recommendation");
  assert.equal(recommendation.outcome, "revise");
  assert.equal(recommendation.subject_kind, "evidence_version");
  assert.equal(recommendation.subject_ref, "sha256:" + "c".repeat(64), "the newest version is the subject");
  assert.equal(recommendation.context.evidence_version_hash, "sha256:" + "c".repeat(64));
  assert.equal(recommendation.context.place_ref, "osm:way/1");
  assert.equal(recommendation.judge.model_requested, "claude-sonnet-5");
  assert.equal(recommendation.judge.model_reported, undefined);
  assert.equal(recommendation.run.cost_basis, "unknown");
  const supports = ctx.rows.agent_judgments.filter(j => j.judgment_kind === "claim_support");
  assert.deepEqual(supports.map(j => j.access_method), ["http_fetch", "http_fetch", "not_checked"]);
  assert.deepEqual(supports.map(j => j.facet), ["existence", "date_support", "location_plausibility"]);
  assert.deepEqual(supports.map(j => j.outcome), ["supported", "unclear", "requires_human_access"]);
  assert.ok(supports.every(j => j.ai_generated === true && j.actor_user_id === "users_1"));
  assert.equal(ctx.rows.task_events.length, 1);
  assert.equal(ctx.rows.task_events[0].client_context.judgment_ids.length, 4);
  assert.equal(ctx.rows.tasks[0].status, "needs_review", "the task status is untouched");
});

test("a draft without a version is judged as a draft, and a re-run appends with parents", async () => {
  const ctx = context({ withVersion: false });
  await recordArtifact._handler(ctx, args);
  assert.ok(ctx.rows.agent_judgments.every(j => j.subject_kind === "evidence_draft" && j.subject_ref === "draft_1"));
  const before = ctx.rows.agent_judgments.map(j => j.judgment_id);
  await recordArtifact._handler(ctx, { ...args, batchId: "agent-review-batch:2:def" });
  assert.equal(ctx.rows.agent_reviews.length, 2);
  assert.equal(ctx.rows.agent_judgments.length, 8);
  const later = ctx.rows.agent_judgments.slice(4);
  assert.ok(later.every(j => j.parents.length === 1 && before.includes(j.parents[0])), "each judgment revises its own earlier version only");
  assert.equal(new Set(later.map(j => j.parents[0])).size, 4, "four distinct lineages");
});

test("pendingForBatch excludes a clear agent-intake draft", async () => {
  const task = { task_id: "task_1", status: "needs_review", country_code: "NZ" };
  const intake = { evidence_draft_id: "intake_1", task_id: "task_1", draft_status: "submitted", updated_at: 2, privacy_flag: "clear", agent_intake_only: true };
  const olderHuman = { evidence_draft_id: "human_1", task_id: "task_1", draft_status: "submitted", updated_at: 1, privacy_flag: "clear" };
  const rows = { tasks: [task], evidence_drafts: [olderHuman, intake], agent_reviews: [] };
  const db = {
    query(table) {
      const filters = [];
      const q = { eq(key, value) { filters.push([key, value]); return q; } };
      let descending = false;
      const chain = {
        withIndex(_name, select) { select(q); return chain; },
        order(direction) { descending = direction === "desc"; return chain; },
        async take(limit) {
          const matching = rows[table].filter(row => filters.every(([key, value]) => row[key] === value));
          return (descending ? matching.reverse() : matching).slice(0, limit);
        },
      };
      return chain;
    },
  };
  const pending = await pendingForBatch._handler({ db }, { promptVersion: "claude-batch-review-v1" });
  assert.deepEqual(pending, [], "the older human draft must not replace the latest intake draft");
});

test("runBatch never fetches a source or calls a model for a clear agent-intake draft", async () => {
  const draft = { evidence_draft_id: "intake_1", task_id: "task_1", draft_status: "submitted", privacy_flag: "clear", agent_intake_only: true, source_url_or_file: "https://example.org/source" };
  const originalKey = process.env.ANTHROPIC_API_KEY;
  const originalFetch = globalThis.fetch;
  const requests = [];
  const mutations = [];
  process.env.ANTHROPIC_API_KEY = "test-key-for-no-external-calls";
  globalThis.fetch = async (url) => { requests.push(url); throw new Error("External request attempted"); };
  try {
    const result = await runBatch._handler({
      async runQuery() { return [{ task: { task_id: "task_1", country_code: "NZ" }, draft, alreadyReviewed: false }]; },
      async runMutation(_reference, args) {
        mutations.push(args);
        return "service_user_1";
      },
    }, { maxItems: 1 });
    assert.deepEqual(requests, [], "neither a source fetch nor an Anthropic call occurred");
    assert.equal(result.reviewed, 0);
    assert.equal(result.failed, 0);
    assert.equal(mutations.length, 3, "only service identity and batch bookkeeping ran");
    assert.ok(mutations.every(args => args.evidenceDraftId === undefined), "no review artifact was recorded");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalKey;
  }
});
