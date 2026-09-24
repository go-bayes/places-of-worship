import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { registerHooks } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
registerHooks({ resolve(specifier, context, nextResolve) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) { for (const ext of [".js", ".ts"]) { const candidate = new URL(`${specifier}${ext}`, context.parentURL); if (fs.existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context); } } return nextResolve(specifier, context); } });
const { adaptInspectionCase, validateInspectionCase, validateInspectionCollection, restoreInspectionCollection, ADAPTER_VERSION } = await import("./lib/inspectionCollection.ts");
const { ingestInspectionObject, getInspectionReceipt, getInspectionObjectForRecovery } = await import("./inspectionReceipts.ts");
const { canonicalWireJson } = await import("./lib/wireJson.ts");
const { sha256 } = await import("./lib/sha256.ts");
const wire = (value) => `${canonicalWireJson(JSON.stringify(value))}\n`;
const addressed = (value, objectKind) => { const objectJson = wire(value); return { objectJson, objectHash: sha256(objectJson), objectKind }; };
const H = "a".repeat(64);
function input() { return { case_ref: "synthetic:case-1", country_code: "bs", source_snapshot_date: "2026-09-01", definition_version: "0.1.6", definition_hash: H, source_records: [{ source_ref: "synthetic:source-1", source_family_ref: "synthetic:family-1", locator: "https://example.org/directory", publisher: "Synthetic directory", publication_date: "2020", retrieved_at: "2026-09-01T12:00:00Z", returned_date: null, access_result: "snippet_only", licence_note: "Permission pending", copy_permission: "needs_review", display_permission: "needs_review", original_hash: null, extract: null }], candidate_links: [{ candidate_ref: "synthetic:candidate-1", basis: "Address correspondence only", disposition: "possible", osm_ref: "way/123", project_site_id: null }], claims: [{ claim_ref: "synthetic:claim-1", attribute: "worship", wording: "A synthetic meeting is mentioned", described_date: "2019", observation_date: "2020", geometry: null, source_refs: ["synthetic:source-1"], uncertainty: "Address only; location unresolved" }], agent_assessments: [{ assessment_ref: "synthetic:assessment-1", subject_ref: "synthetic:claim-1", agent_name: "synthetic-agent", model_requested: "synthetic-model", model_reported: null, model_unreported_reason: "Provider omitted model identifier", outcome: "unclear", basis: "Snippet does not establish the site" }], context: { task_id: null, evidence_version_hash: null }, parents: [] }; }
export { input, addressed };
function dbContext(identity = null, roles = []) {
  const rows = { inspection_object_receipts: [], users: [{ _id: "user-1", auth_subject: "identity", status: "active", roles }] };
  const db = { query(table) { const filters = []; const q = { eq(key, value) { filters.push([key, value]); return q; } }; const chain = { withIndex(_index, callback) { callback(q); return chain; }, async unique() { return rows[table].find(row => filters.every(([key, value]) => row[key] === value)) ?? null; } }; return chain; }, async insert(table, row) { rows[table].push({ ...row, _id: `receipt-${rows[table].length + 1}` }); } };
  return { db, rows, auth: { async getUserIdentity() { return identity === null ? null : { tokenIdentifier: identity }; } } };
}

test("adapter preserves source limits, unknown location, dates, model uncertainty and candidate links", () => {
  const { projection, report } = adaptInspectionCase(input());
  assert.equal(projection.claims[0].geometry, null);
  assert.equal(projection.agent_assessments[0].model_reported, null);
  assert.equal(projection.candidate_links[0].candidate_ref, "synthetic:candidate-1");
  assert.equal(projection.sources[0].publication_date, "2020");
  assert.equal(report.source_permissions[0].decision, "locator and metadata only");
  const object = addressed(projection, "case");
  assert.deepEqual(validateInspectionCase(object.objectJson, object.objectHash), projection);
});

test("unsupported fields, restricted extracts, broken links and personal details fail closed", () => {
  const cases = [
    [{ ...input(), unexpected: "hidden" }, /unsupported field/],
    [{ ...input(), source_records: [{ ...input().source_records[0], extract: "Unlicensed passage" }] }, /display permission/],
    [{ ...input(), claims: [{ ...input().claims[0], source_refs: ["synthetic:missing"] }] }, /unknown source/],
    [{ ...input(), claims: [{ ...input().claims[0], wording: "Rev Example served here" }] }, /personal details/],
    [{ ...input(), claims: [{ ...input().claims[0], geometry: { latitude: 91, longitude: 1 } }] }, /invalid geometry/],
  ];
  for (const [value, message] of cases) assert.throws(() => adaptInspectionCase(value), message);
});

test("immutable receipts collapse retries, link versions and require complete membership", async () => {
  process.env.POW_INTERNAL_AGENT_INGEST_ENABLED = "true";
  const ctx = dbContext();
  const first = addressed(adaptInspectionCase(input()).projection, "case");
  assert.equal((await ingestInspectionObject._handler(ctx, first)).created, true);
  assert.equal((await ingestInspectionObject._handler(ctx, first)).created, false);
  assert.equal(ctx.rows.inspection_object_receipts.length, 1);
  const revised = input(); revised.parents = [first.objectHash]; revised.claims[0].wording = "A later synthetic notice mentions a meeting";
  const second = addressed(adaptInspectionCase(revised).projection, "case");
  assert.equal((await ingestInspectionObject._handler(ctx, second)).created, true);
  const collection = { schema_version: "inspection-collection.v1", country_code: "bs", collection_ref: "synthetic:collection-1", adapter_version: ADAPTER_VERSION, source_snapshot_date: "2026-09-01", definition_version: "0.1.6", definition_hash: H, case_hashes: [second.objectHash], parents: [] };
  const member = addressed(collection, "collection");
  assert.equal((await ingestInspectionObject._handler(ctx, member)).created, true);
  assert.equal((await ingestInspectionObject._handler(ctx, member)).created, false);
  const interrupted = addressed({ ...collection, case_hashes: ["b".repeat(64)] }, "collection");
  await assert.rejects(ingestInspectionObject._handler(ctx, interrupted), /member must hold/);
  assert.equal(ctx.rows.inspection_object_receipts.length, 3);
  assert.deepEqual((await getInspectionObjectForRecovery._handler(ctx, { objectHash: second.objectHash })).parents, [first.objectHash]);
  await assert.rejects(getInspectionReceipt._handler(ctx, { objectHash: second.objectHash }), /Authentication required/);
  const unauthorised = dbContext("identity", ["ra"]); unauthorised.rows.inspection_object_receipts = ctx.rows.inspection_object_receipts;
  await assert.rejects(getInspectionReceipt._handler(unauthorised, { objectHash: second.objectHash }), /role does not permit/);
  const authorised = dbContext("identity", ["reviewer"]); authorised.rows.inspection_object_receipts = ctx.rows.inspection_object_receipts;
  assert.equal((await getInspectionReceipt._handler(authorised, { objectHash: second.objectHash })).object_json, second.objectJson);
});

test("a clean cache restores the exact projection from synthetic project-controlled objects", async () => {
  const storage = fileURLToPath(new URL("../scripts/agent_research/fixtures/inspection-objects/", import.meta.url));
  const cache = fs.mkdtempSync(path.join(os.tmpdir(), "pow-inspection-cache-"));
  try {
    const first = addressed(adaptInspectionCase(input()).projection, "case");
    const manifest = addressed(validateInspectionCollection({ schema_version: "inspection-collection.v1", country_code: "bs", collection_ref: "synthetic:collection-1", adapter_version: ADAPTER_VERSION, source_snapshot_date: "2026-09-01", definition_version: "0.1.6", definition_hash: H, case_hashes: [first.objectHash], parents: [] }), "collection");
    assert.equal(fs.readFileSync(path.join(storage, "root.txt"), "utf8"), `${manifest.objectHash}\n`);
    for (const object of [first, manifest]) assert.equal(fs.readFileSync(path.join(storage, `${object.objectHash}.json`), "utf8"), object.objectJson);
    fs.rmSync(cache, { recursive: true, force: true });
    const restored = await restoreInspectionCollection(manifest.objectHash, async hash => { const filename = path.join(storage, `${hash}.json`); return fs.existsSync(filename) ? { object_hash: hash, object_json: fs.readFileSync(filename, "utf8"), object_kind: hash === manifest.objectHash ? "collection" : "case" } : null; });
    assert.equal(wire(restored.collection), manifest.objectJson);
    assert.equal(wire(restored.cases[0]), first.objectJson);
    await assert.rejects(restoreInspectionCollection(manifest.objectHash, async hash => ({ object_hash: hash, object_json: hash === first.objectHash ? first.objectJson.replace("synthetic meeting", "different meeting") : fs.readFileSync(path.join(storage, `${hash}.json`), "utf8"), object_kind: hash === manifest.objectHash ? "collection" : "case" })), /hash does not match/);
  } finally { fs.rmSync(cache, { recursive: true, force: true }); }
});
