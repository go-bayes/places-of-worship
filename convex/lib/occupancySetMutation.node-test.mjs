import assert from "node:assert/strict";
import fs from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";

// loads the registered set-write route under node with the same
// extensionless resolution rule as evidenceSubmissionMutation.node-test
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

const { recordOccupancySet } = await import("../occupancies.ts");

// an in-memory database: withIndex constraints become equality filters, ids
// are strings, patches merge, undefined fields are removed as convex does
function fakeDb(seed) {
  const tables = Object.fromEntries(Object.entries(seed).map(([table, rows]) => [table, rows.map((row, i) => ({ _id: `${table}:${i}`, _creationTime: i, ...row }))]));
  let next = 1000;
  const find = (id) => Object.values(tables).flat().find((row) => row._id === id) ?? null;
  return {
    tables,
    async get(id) { return find(id); },
    async insert(table, doc) {
      const row = { _id: `${table}:${next++}`, _creationTime: next, ...doc };
      (tables[table] ??= []).push(row);
      return row._id;
    },
    async patch(id, fields) {
      const row = find(id);
      for (const [key, value] of Object.entries(fields)) {
        if (value === undefined) delete row[key];
        else row[key] = value;
      }
    },
    query(table) {
      const filters = [];
      const q = { eq(field, value) { filters.push([field, value]); return q; } };
      const rows = () => (tables[table] ?? []).filter((row) => filters.every(([field, value]) => row[field] === value));
      const cursor = {
        withIndex(_name, select) { if (select) select(q); return cursor; },
        order() { return cursor; },
        async take(n) { return rows().slice(0, n); },
        async collect() { return rows(); },
        async unique() { const found = rows(); return found[0] ?? null; },
      };
      return cursor;
    },
  };
}

const user = { _id: "users:1", auth_subject: "s", status: "active", roles: ["ra"] };
const task = { task_id: "task_1", country_code: "NZ", status: "needs_review", target_years: [2013, 2018, 2023], geometry: { type: "Point", coordinates: [174.768, -41.282] }, assigned_to: user._id };
const chain = { contract_version: "function_chain_v1", start: { label: "Presbyterian", date: { mode: "known", date: "1888" } }, changes: [] };
const segment = {
  contract_version: "occupancy_v1", segment_index: 0, start_mode: "known", start_date: "1888", start_basis: "founding_stated",
  end_mode: "still_active", still_active_asof: "2024-05", end_basis: "unknown", location_relation: "same_as_task_point",
  confidence: "high", confidence_basis: "Read directly.", source_basis: "named_public_source", source_title: "History",
  source_reference: "https://example.org", source_account: "The history dates the church and its use.", privacy_flag: "clear",
};

test("p2-1: a resubmission without a chain supersedes the author's earlier chain and its derived denominations", async () => {
  const db = fakeDb({
    tasks: [task],
    users: [user],
    evidence_drafts: [
      { evidence_draft_id: "draft_1", task_id: "task_1", draft_status: "superseded", created_by: user._id, function_chain: chain },
      { evidence_draft_id: "draft_2", task_id: "task_1", draft_status: "submitted", created_by: user._id },
    ],
    historical_claims: [
      { historical_claim_id: "c:0", task_id: "task_1", parent_evidence_draft_id: "draft_1", claim_status: "submitted", created_by: user._id, created_at: 1, chain_id: "c", chain_index: 0, chain_change: "start", chain_label: "Presbyterian" },
      { historical_claim_id: "plain", task_id: "task_1", parent_evidence_draft_id: "draft_1", claim_status: "submitted", created_by: user._id, created_at: 2 },
    ],
    site_occupancies: [],
    derived_target_year_states: [],
    derived_year_locations: [],
    derived_target_year_functions: [
      { derived_function_id: "draft_1:function:2013", task_id: "task_1", parent_evidence_draft_id: "draft_1", target_year: 2013, derived_status: "stated", label: "Presbyterian", candidate_labels: ["Presbyterian"], rule_id: "inside_state", chain_id: "c", derivation_version: "function_derivation_v1", inputs_hash: "h", review_state: "reviewer_confirmed", created_at: 1, updated_at: 1 },
    ],
    derived_state_events: [],
    task_events: [],
  });
  const ctx = { db };
  const parent = db.tables.evidence_drafts[1];
  const result = await recordOccupancySet(ctx, {
    task: db.tables.tasks[0],
    parent,
    user,
    actorRole: "ra",
    submissionKey: `${user._id}:11111111-1111-4111-8111-111111111111`,
    submissionToken: "11111111-1111-4111-8111-111111111111",
    segments: [segment],
    now: 5,
  });
  assert.equal(result.occupancyIds.length, 1);
  const chainClaim = db.tables.historical_claims.find((c) => c.historical_claim_id === "c:0");
  assert.equal(chainClaim.claim_status, "superseded", "the earlier chain claim is superseded");
  const plain = db.tables.historical_claims.find((c) => c.historical_claim_id === "plain");
  assert.equal(plain.claim_status, "submitted", "a claim outside any chain is untouched");
  assert.equal(db.tables.evidence_drafts[0].function_chain, undefined, "the earlier parent loses its stored chain");
  const fn = db.tables.derived_target_year_functions.find((r) => r.derived_function_id === "draft_1:function:2013");
  assert.equal(fn.review_state, "superseded", "the earlier derived denomination is superseded");
  assert.ok(db.tables.derived_state_events.some((e) => e.derivation === "function" && e.action === "invalidated" && e.parent_evidence_draft_id === "draft_1"));
  assert.equal(db.tables.derived_target_year_functions.filter((r) => r.parent_evidence_draft_id === "draft_2").length, 0, "no chain, no new denomination rows");
});
