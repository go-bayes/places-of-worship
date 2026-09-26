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
  const rows = { inspection_object_receipts: [], tasks: [], evidence_versions: [], users: [{ _id: "user-1", auth_subject: "identity", status: "active", roles }] };
  const db = { query(table) { const filters = []; const q = { eq(key, value) { filters.push([key, value]); return q; } }; const chain = { withIndex(_index, callback) { callback(q); return chain; }, async unique() { return rows[table].find(row => filters.every(([key, value]) => row[key] === value)) ?? null; }, async first() { return chain.unique(); } }; return chain; }, async insert(table, row) { rows[table].push({ ...row, _id: `receipt-${rows[table].length + 1}` }); } };
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

test("exact OSM references in candidate links pass the phone screen; phone numbers there and ten-digit numbers elsewhere do not", () => {
  const osmRefs = ["node/1234567890", "way/2345678901", "relation/2425550199", "https://www.openstreetmap.org/node/12345678901", "https://openstreetmap.org/way/1234567890"];
  for (const reference of osmRefs) {
    const value = input();
    value.candidate_links[0].osm_ref = reference;
    value.candidate_links[0].candidate_ref = reference;
    const { projection } = adaptInspectionCase(value);
    assert.equal(projection.candidate_links[0].osm_ref, reference);
    assert.equal(projection.candidate_links[0].candidate_ref, reference);
    const object = addressed(projection, "case");
    assert.deepEqual(validateInspectionCase(object.objectJson, object.objectHash), projection);
  }
  const refused = [
    ["osm_ref", "2425550199"], ["osm_ref", "+1 242 555 0199"], ["osm_ref", "node/1234567890 call 242-555-0199"], ["osm_ref", "nodes/1234567890"], ["osm_ref", "https://example.org/node/1234567890"], ["osm_ref", "node/0189557282"],
    ["candidate_ref", "2425550199"], ["candidate_ref", "synthetic:osm:node/1234567890"], ["candidate_ref", "node/1234567890/2425550199"],
    // encoded, compatibility-form and decorated variants never take the exemption
    ["osm_ref", "node/%32%34%32%35%35%35%30%31%39%39"], ["osm_ref", "%32%34%32%35%35%35%30%31%39%39"], ["osm_ref", "node/%2532%2534%2532%2535%2535%2535%2530%2531%2539%2539"],
    ["osm_ref", "node/\uFF12\uFF14\uFF12\uFF15\uFF15\uFF15\uFF10\uFF11\uFF19\uFF19"], ["candidate_ref", "\uFF12\uFF14\uFF12 \uFF15\uFF15\uFF15 \uFF10\uFF11\uFF19\uFF19"],
    ["osm_ref", "https://www.openstreetmap.org/node/1234567890?phone=2425550199"], ["osm_ref", "https://www.openstreetmap.org/node/1234567890#2425550199"],
    ["osm_ref", "https://user:2425550199@www.openstreetmap.org/node/1234567890"], ["osm_ref", " node/1234567890"], ["osm_ref", "node/1234567890 "],
    ["osm_ref", "node/" + encodeURIComponent("\uFF12\uFF14\uFF12\uFF15\uFF15\uFF15\uFF10\uFF11\uFF19\uFF19")],
    // UTF-8 encoded full-width digits, and six layers of percent-encoding
    ["osm_ref", "node/" + [1, 2, 3, 4, 5].reduce(text => encodeURIComponent(text), "2425550199".split("").map(digit => "%" + digit.charCodeAt(0).toString(16)).join(""))],
    // twenty layers of encoding exceed the decoding bound and are refused, not passed
    ["candidate_ref", [...Array(20)].reduce(text => text.replace(/%/g, "%25"), "%32%34%32%35%35%35%30%31%39%39")],
    // full-width percent signs that normalise into escapes, and their encoded form
    ["osm_ref", "node/\uFF0532\uFF0534\uFF0532\uFF0535\uFF0535\uFF0535\uFF0530\uFF0531\uFF0539\uFF0539"],
    ["osm_ref", "node/" + encodeURIComponent("\uFF0532\uFF0534\uFF0532\uFF0535\uFF0535\uFF0535\uFF0530\uFF0531\uFF0539\uFF0539")],
    // Arabic-Indic, Eastern Arabic and Devanagari digits, and a mixed-script number
    ["osm_ref", "node/\u0662\u0664\u0662\u0665\u0665\u0665\u0660\u0661\u0669\u0669"], ["candidate_ref", "\u06F2\u06F4\u06F2-\u06F5\u06F5\u06F5-\u06F0\u06F1\u06F9\u06F9"],
    ["candidate_ref", "\u0968\u096A\u0968 555 0199"], ["osm_ref", "242\u0665\u0665\u06650199"],
    ["osm_ref", "NODE/2425550199"], ["candidate_ref", "HTTPS://WWW.OPENSTREETMAP.ORG/node/2425550199"],
  ];
  for (const [field, text] of refused) {
    const value = input();
    value.candidate_links[0][field] = text;
    assert.throws(() => adaptInspectionCase(value), error => {
      assert.match(error.message, new RegExp(`candidate_links\\[0\\]\\.${field}`));
      assert.doesNotMatch(error.message, /555|1234567890/);
      return true;
    });
  }
  for (const text of ["node/1234567890", "2425550199", "call \u0662\u0664\u0662 \u0665\u0665\u0665 \u0660\u0661\u0669\u0669", "call \uFF0532\uFF0534\uFF0532\uFF0535\uFF0535\uFF0535\uFF0530\uFF0531\uFF0539\uFF0539"]) {
    const elsewhere = input();
    elsewhere.claims[0].wording = text;
    assert.throws(() => adaptInspectionCase(elsewhere), /potential personal details in claims\[0\]\.wording/);
    const basis = input();
    basis.candidate_links[0].basis = text;
    assert.throws(() => adaptInspectionCase(basis), /potential personal details in candidate_links\[0\]\.basis/);
  }
});

test("extracts require both copy and display permission", () => {
  for (const copyPermission of ["needs_review", "restricted"]) {
    const value = input();
    value.source_records[0].copy_permission = copyPermission;
    value.source_records[0].display_permission = "permitted";
    value.source_records[0].extract = "Synthetic extract for testing";
    assert.throws(() => adaptInspectionCase(value), error => {
      assert.match(error.message, /source_records\[0\]: extract requires copy and display permission/);
      assert.doesNotMatch(error.message, /Synthetic extract/);
      return true;
    });
    const projection = adaptInspectionCase(input()).projection;
    projection.sources[0] = { ...value.source_records[0] };
    const object = addressed(projection, "case");
    assert.throws(() => validateInspectionCase(object.objectJson, object.objectHash), /source_records\[0\]: extract requires copy and display permission/);
    value.source_records[0].extract = null;
    assert.equal(adaptInspectionCase(value).report.source_permissions[0].decision, "locator and metadata only");
  }
});

test("undeclared inspection keys and values produce positional, value-free diagnostics", () => {
  const privateKey = "Rev Example";
  const withPrivateKey = input();
  withPrivateKey.claims[0][privateKey] = "unrecognised";
  assert.throws(() => adaptInspectionCase(withPrivateKey), error => {
    assert.match(error.message, /claims\[0\]\.<key#\d+> \(key\)/);
    assert.doesNotMatch(error.message, /Rev Example|unrecognised/);
    return true;
  });
  const projection = adaptInspectionCase(input()).projection;
  projection.claims[0][privateKey] = "unrecognised";
  const object = addressed(projection, "case");
  assert.throws(() => validateInspectionCase(object.objectJson, object.objectHash), error => {
    assert.match(error.message, /claims\[0\]\.<key#\d+> \(key\)/);
    assert.doesNotMatch(error.message, /Rev Example|unrecognised/);
    return true;
  });
  const value = input();
  value.claims[0].wording = "Contact person@example.org";
  assert.throws(() => adaptInspectionCase(value), error => {
    assert.match(error.message, /claims\[0\]\.wording/);
    assert.doesNotMatch(error.message, /person@example\.org/);
    return true;
  });
});

test("bahamas phone numbers and clergy passages are refused by path without their values", async () => {
  for (const phone of ["+1 242 555 0199", "+1 (242) 555-0199", "(242) 555-0199", "242-555-0199", "242.555.0199", "2425550199", "555-0199", "555 0199"]) {
    const value = input();
    value.claims[0].wording = `Call ${phone}`;
    assert.throws(() => adaptInspectionCase(value), error => {
      assert.match(error.message, /potential personal details in claims\[0\]\.wording/);
      assert.doesNotMatch(error.message, /555/);
      return true;
    });
    const projection = adaptInspectionCase(input()).projection;
    projection.sources[0].publisher = `Call ${phone}`;
    const object = addressed(projection, "case");
    assert.throws(() => validateInspectionCase(object.objectJson, object.objectHash), /potential personal details in sources\[0\]\.publisher/);
  }
  const ordinaryNumbers = input();
  ordinaryNumbers.claims[0].wording = "The 2020 count was 1234";
  assert.equal(adaptInspectionCase(ordinaryNumbers).projection.claims[0].wording, ordinaryNumbers.claims[0].wording);
  assert.throws(() => validateInspectionCollection({ schema_version: "inspection-collection.v1", country_code: "bs", collection_ref: "synthetic:collection-1", adapter_version: ADAPTER_VERSION, source_snapshot_date: "2026-09-01", definition_version: "Call 242-555-0199", definition_hash: H, case_hashes: [], parents: [] }), /potential personal details in definition_version/);
  process.env.POW_INTERNAL_AGENT_INGEST_ENABLED = "true";
  const ctx = dbContext();
  const projection = adaptInspectionCase(input()).projection;
  projection.agent_assessments[0].basis = "Office line +1 242 555 0199";
  await assert.rejects(ingestInspectionObject._handler(ctx, addressed(projection, "case")), /agent_assessments\[0\]\.basis/);
  assert.equal(ctx.rows.inspection_object_receipts.length, 0);
  const clergy = input();
  clergy.claims[0].uncertainty = "The pastor is unnamed";
  assert.throws(() => adaptInspectionCase(clergy), error => {
    assert.match(error.message, /^claims\[0\]\.uncertainty: source-derived personal or tenure detail/);
    assert.doesNotMatch(error.message, /unnamed/);
    return true;
  });
});

test("inspection context resolves an existing task and its evidence version", async () => {
  process.env.POW_INTERNAL_AGENT_INGEST_ENABLED = "true";
  const ctx = dbContext();
  ctx.rows.tasks.push({ task_id: "synthetic:task-1", country_code: "BS" });
  ctx.rows.evidence_versions.push({ object_hash: `sha256:${H}`, task_id: "synthetic:task-1" });
  const linked = input();
  linked.context = { task_id: "synthetic:task-1", evidence_version_hash: H };
  assert.equal((await ingestInspectionObject._handler(ctx, addressed(adaptInspectionCase(linked).projection, "case"))).created, true);
  for (const [context, expected] of [
    [{ task_id: "synthetic:missing-task", evidence_version_hash: null }, /context\.task_id: task does not exist/],
    [{ task_id: "synthetic:task-1", evidence_version_hash: "b".repeat(64) }, /context\.evidence_version_hash: version does not exist/],
    [{ task_id: "synthetic:task-1", evidence_version_hash: "c".repeat(64) }, /context\.evidence_version_hash: version belongs to another task/],
  ]) {
    const value = input();
    value.case_ref = `synthetic:case-${ctx.rows.inspection_object_receipts.length + 2}`;
    value.context = context;
    if (context.evidence_version_hash === "c".repeat(64)) ctx.rows.evidence_versions.push({ object_hash: `sha256:${context.evidence_version_hash}`, task_id: "synthetic:task-2" });
    await assert.rejects(ingestInspectionObject._handler(ctx, addressed(adaptInspectionCase(value).projection, "case")), error => {
      assert.match(error.message, expected);
      assert.doesNotMatch(error.message, /synthetic:|a{64}|b{64}|c{64}/);
      return true;
    });
  }
  assert.equal(ctx.rows.inspection_object_receipts.length, 1);
});

test("changed case and collection roots require parents", async () => {
  process.env.POW_INTERNAL_AGENT_INGEST_ENABLED = "true";
  const ctx = dbContext();
  const first = addressed(adaptInspectionCase(input()).projection, "case");
  await ingestInspectionObject._handler(ctx, first);
  const changedCase = input();
  changedCase.claims[0].wording = "A changed synthetic notice";
  const secondCase = addressed(adaptInspectionCase(changedCase).projection, "case");
  await assert.rejects(ingestInspectionObject._handler(ctx, secondCase), /parents: a revision requires a receipted parent/);
  const collection = { schema_version: "inspection-collection.v1", country_code: "bs", collection_ref: "synthetic:collection-1", adapter_version: ADAPTER_VERSION, source_snapshot_date: "2026-09-01", definition_version: "0.1.6", definition_hash: H, case_hashes: [first.objectHash], parents: [] };
  await ingestInspectionObject._handler(ctx, addressed(collection, "collection"));
  const changedCollection = addressed({ ...collection, case_hashes: [] }, "collection");
  await assert.rejects(ingestInspectionObject._handler(ctx, changedCollection), /parents: a revision requires a receipted parent/);
  assert.equal(ctx.rows.inspection_object_receipts.length, 2);
});

test("hash tokens are refused outside designated inspection hash fields", () => {
  const value = input();
  value.claims[0].wording = `Reference ${"B".repeat(64)}`;
  assert.throws(() => adaptInspectionCase(value), /hash-shaped value in claims\[0\]\.wording/);
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
  const interrupted = addressed({ ...collection, case_hashes: ["b".repeat(64)], parents: [member.objectHash] }, "collection");
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

test("a source locator whose record id looks like a local number is accepted", () => {
  const value = input();
  value.source_records[0].locator = "https://example.org/record/123-4567";
  assert.doesNotThrow(() => adaptInspectionCase(value));
});
