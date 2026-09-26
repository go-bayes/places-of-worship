import assert from "node:assert/strict";
import fs from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";

registerHooks({ resolve(specifier, context, nextResolve) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) { for (const ext of [".js", ".ts"]) { const candidate = new URL(`${specifier}${ext}`, context.parentURL); if (fs.existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context); } } return nextResolve(specifier, context); } });
const { ingestFirstPass, getFirstPassRecord, getFirstPassReceipt, listFirstPassReceipts } = await import("./firstPassReceipts.ts");
const { sha256 } = await import("./lib/sha256.ts");
const { verifyObjectBytes, objectReceiptId } = await import("./lib/objectReceipts.ts");
const { canonicalWireJson } = await import("./lib/wireJson.ts");
const { screenedText, validateFirstPassRecord } = await import("./lib/firstPass.ts");
const { keyRef } = await import("./lib/agentIntake.ts");

const fixtureText = (name) => fs.readFileSync(new URL(`../scripts/agent_research/fixtures/${name}`, import.meta.url), "utf8");
const fixture = (name) => JSON.parse(fixtureText(name));
const partial = () => fixture("first-pass.json");
const researched = () => fixture("first-pass-researched.json");

test("cited clergy rule never admits a first-pass record with either deployment flag", async () => {
  const record = researched();
  const claim = record.dossier.claims[0];
  claim.value += " under Rev'd Pat Example";
  claim.quoted_support += " under Rev'd Pat Example";
  const start = Array.from(claim.value).join("").indexOf("Rev'd Pat Example");
  record.dossier.personal_details_quarantine.items = [{ kind: "person_name", context_claim_id: claim.claim_id, admitted_by_rule: "public_source_cited.v1", field: "value", start, end: start + 17 }];
  record.dossier.personal_details_quarantine.item_count = 1;
  const { recordJson, recordHash } = args(record);
  process.env.POW_INTERNAL_AGENT_INGEST_ENABLED = "true";
  try {
    for (const setting of [undefined, "1"]) {
      if (setting === undefined) delete process.env.POW_CITED_NAME_RULE_ENABLED;
      else process.env.POW_CITED_NAME_RULE_ENABLED = setting;
      assert.throws(() => validateFirstPassRecord(recordJson, recordHash), /personal details/);
      const ctx = context();
      await assert.rejects(ingestFirstPass._handler(ctx, { recordJson, recordHash }), /personal details/);
      assert.equal(ctx.rows.agent_first_pass_receipts.length, 0);
    }
  } finally { delete process.env.POW_CITED_NAME_RULE_ENABLED; }
});

// the archive's version-1 wire format (python json.dumps, sorted, compact,
// ascii, final newline). a fixture's own text keeps python's float spellings
// (-43.0); a record built in javascript is encoded from JSON.stringify, whose
// integral floats become python ints, which is a different but equally
// canonical record.
function wire(record) {
  return `${canonicalWireJson(typeof record === "string" ? record : JSON.stringify(record))}\n`;
}
function args(record) {
  const recordJson = wire(record);
  return { recordJson, recordHash: sha256(recordJson) };
}

function context({ guardUnbounded = false } = {}) {
  const rows = { users: [], agent_first_pass_receipts: [], agent_judgments: [], tasks: [], evidence_drafts: [], evidence_versions: [] };
  const reads = { agent_judgments: 0 };
  const db = {
    query(table) {
      const filters = [];
      const q = { eq(key, value) { filters.push([key, value]); return q; } };
      const read = (row, key) => key.split(".").reduce((value, part) => value?.[part], row);
      const selected = () => rows[table].filter((row) => filters.every(([k, v]) => read(row, k) === v));
      let descending = false;
      const count = (found) => { if (table === "agent_judgments") reads.agent_judgments += found.length; return found; };
      const chain = {
        withIndex(_name, select) { if (select) select(q); return chain; },
        order(direction) { descending = direction === "desc"; return chain; },
        async unique() { const found = selected(); if (found.length > 1) throw new Error("unique() found several rows"); return count(found.slice(0, 1))[0] ?? null; },
        async collect() { if (guardUnbounded && table === "agent_judgments") throw new Error("unbounded read of agent_judgments"); return count(selected()); },
        async take(n) { const found = selected(); return count((descending ? found.reverse() : found).slice(0, n)); },
        async first() { return selected()[0] ?? null; },
      };
      return chain;
    },
    async insert(table, value) { const id = `${table}_${rows[table].length + 1}`; rows[table].push({ ...value, _id: id }); return id; },
    async get(id) { return Object.values(rows).flat().find((row) => row._id === id) ?? null; },
    async patch(id, value) { Object.assign(await db.get(id), value); },
  };
  const auth = { async getUserIdentity() { return { tokenIdentifier: "human" }; } };
  return { db, rows, auth, reads };
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

test("only the archive's canonical bytes are accepted, so every receipt restores", async () => {
  enable();
  const ctx = context();
  // the fixture's python spellings survive: -43.0 stays a float
  const exact = wire(fixtureText("first-pass-researched.json"));
  assert.match(exact, /"seed_latitude":-43\.0,/);
  const record = JSON.parse(exact);
  const spellings = [
    exact.replace('{"annotations":', '{ "annotations":'),
    exact.replace('"seed_latitude":-43.0,', '"seed_latitude":-43.00,'),
    exact.replace('{"annotations":[', '{"parents":[],"annotations":[').replace(',"parents":[]', ''),
    exact.replace('"cost_usd":0.01', '"cost_usd":1e-2'),
    exact.replace('"History"', '"Hist\\u006fry"'),
  ];
  for (const text of spellings) {
    assert.notEqual(text, exact);
    assert.deepEqual(JSON.parse(text), record, "each spelling encodes the same value");
    await assert.rejects(ingestFirstPass._handler(ctx, { recordJson: text, recordHash: sha256(text) }), /wire format/);
  }
  // 1e-7 is written 1e-07 by python: the python spelling passes, the other does not
  const tiny = researched();
  tiny.usage.cost_usd = 1e-7;
  const python = wire(tiny);
  assert.match(python, /"cost_usd":1e-07,/);
  await assert.rejects(ingestFirstPass._handler(ctx, { recordJson: python.replace("1e-07", "1e-7"), recordHash: sha256(python.replace("1e-07", "1e-7")) }), /wire format/);
  assert.equal(ctx.rows.agent_first_pass_receipts.length, 0);
  assert.equal((await ingestFirstPass._handler(ctx, { recordJson: exact, recordHash: sha256(exact) })).created, true);
  assert.equal((await ingestFirstPass._handler(ctx, { recordJson: python, recordHash: sha256(python) })).created, true);
});

test("a researched pass records the researcher's status verdict and the author's annotations", async () => {
  enable();
  const ctx = context();
  const record = researched();
  const input = args(record);
  const result = await ingestFirstPass._handler(ctx, input);
  assert.equal(result.judgment_ids.length, 3);
  const judgments = ctx.rows.agent_judgments;
  assert.deepEqual(judgments.map((row) => row.judgment_id), result.judgment_ids);
  const manifest = record.dossier.run_manifest;
  const status = judgments.find((row) => row.judgment_kind === "status_assessment");
  assert.equal(status.subject_kind, "place");
  assert.equal(status.subject_ref, record.place_ref);
  assert.equal(status.outcome, record.dossier.status_assessment.current_status);
  // every provenance field of the verdict comes from the one run that made it
  assert.deepEqual(status.judge, { agent_name: "codex-first-pass-researcher", model_provider: "codex", model_requested: manifest.model_id_requested, model_reported: manifest.model_id_reported, model_unreported_reason: undefined, prompt_version: manifest.prompt_version });
  assert.deepEqual(status.run, { agent_run_id: manifest.run_id, attempt: 1, cost_usd: manifest.cost_usd_reported, cost_basis: manifest.cost_basis });
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
    // the fixture's author ran separately from the researcher: its own
    // models, and no provider borrowed from the dossier
    assert.deepEqual(annotations[index].judge, { agent_name: "first-pass-annotator", model_provider: "not_reported", model_requested: record.attribution.model_requested, model_reported: record.attribution.model_reported, model_unreported_reason: undefined, prompt_version: "agent-first-pass.v1", code_revision: record.attribution.code_revision, instruction_sha256: record.attribution.instruction_sha256 });
    assert.deepEqual(annotations[index].run, { agent_run_id: record.attribution.agent_run_id, attempt: 1, cost_usd: 0.01, cost_basis: "tool_list_price" });
  }
  assert.equal(judgments.filter((row) => row.judgment_kind === "claim_support").length, 0);
  const again = await ingestFirstPass._handler(ctx, input);
  assert.equal(again.created, false);
  assert.deepEqual(again.judgment_ids, result.judgment_ids);
  assert.equal(ctx.rows.agent_judgments.length, 3);
  assert.equal(ctx.rows.agent_first_pass_receipts.length, 1);
});

test("an author who is the dossier's own run is attributed to its provider, and must agree with its models", async () => {
  enable();
  const ctx = context();
  const record = researched();
  record.attribution.agent_run_id = record.dossier.run_manifest.run_id;
  const result = await ingestFirstPass._handler(ctx, args(record));
  const annotation = ctx.rows.agent_judgments.find((row) => row.judgment_id === result.judgment_ids[1]);
  assert.equal(annotation.judge.agent_name, "codex-first-pass-annotator");
  assert.equal(annotation.judge.model_provider, "codex");
  const mismatched = researched();
  mismatched.attribution.agent_run_id = mismatched.dossier.run_manifest.run_id;
  mismatched.attribution.model_requested = "sonnet";
  await assert.rejects(ingestFirstPass._handler(context(), args(mismatched)), /disagrees with its models/);
  const unreported = researched();
  unreported.attribution.agent_run_id = unreported.dossier.run_manifest.run_id;
  unreported.attribution.model_reported = null;
  unreported.attribution.model_unreported_reason = "The client reported none.";
  await assert.rejects(ingestFirstPass._handler(context(), args(unreported)), /disagrees with its models/);
});

test("passes that carry one dossier share its verdict and keep their own annotations", async () => {
  enable();
  const ctx = context();
  const first = researched();
  const second = researched();
  second.question = "A second synthetic question over the same dossier.";
  second.searches[0].query = "a different synthetic search";
  const one = await ingestFirstPass._handler(ctx, args(first));
  const two = await ingestFirstPass._handler(ctx, args(second));
  assert.notEqual(one.receipt_id, two.receipt_id);
  // one researcher output, one row, cited by both receipts
  assert.equal(one.judgment_ids[0], two.judgment_ids[0]);
  assert.equal(ctx.rows.agent_judgments.filter((row) => row.judgment_kind === "status_assessment").length, 1);
  const receipts = ctx.rows.agent_first_pass_receipts;
  assert.ok(receipts.every((receipt) => receipt.judgment_ids.includes(one.judgment_ids[0])));
  // each record's annotations are its own, keyed on its hash
  assert.notDeepEqual(one.judgment_ids.slice(1), two.judgment_ids.slice(1));
  assert.equal(ctx.rows.agent_judgments.filter((row) => row.judgment_kind === "annotation").length, 4);
  // a pass with a new dossier run is a new verdict that revises the old one
  const revisit = researched();
  revisit.dossier.run_manifest.run_id = "test-run-2";
  const three = await ingestFirstPass._handler(ctx, args(revisit));
  const verdicts = ctx.rows.agent_judgments.filter((row) => row.judgment_kind === "status_assessment");
  assert.equal(verdicts.length, 2);
  assert.equal(verdicts[1].judgment_id, three.judgment_ids[0]);
  assert.deepEqual(verdicts[1].parents, [verdicts[0].judgment_id]);
});

test("a revision needs its parent's receipt first, for the same place", async () => {
  enable();
  const ctx = context();
  const parentInput = args(researched());
  const child = partial();
  child.parents = [parentInput.recordHash];
  // the lookup failure names the parent by position, never by the supplied hash
  await assert.rejects(ingestFirstPass._handler(ctx, args(child)), (error) => /Parent first pass #0 has no receipt/.test(error.message) && !error.message.includes(parentInput.recordHash));
  assert.equal(ctx.rows.agent_first_pass_receipts.length, 0);
  await ingestFirstPass._handler(ctx, parentInput);
  const childResult = await ingestFirstPass._handler(ctx, args(child));
  assert.equal(childResult.created, true);
  const childReceipt = ctx.rows.agent_first_pass_receipts.find((row) => row.receipt_id === childResult.receipt_id);
  assert.deepEqual(childReceipt.parents, [parentInput.recordHash]);
  const stranger = partial();
  stranger.place_ref = "osm:way/2";
  stranger.parents = [parentInput.recordHash];
  await assert.rejects(ingestFirstPass._handler(ctx, args(stranger)), /another place/);
});

test("every context field resolves to one task in the record's country and about its place", async () => {
  enable();
  const ctx = context();
  const record = researched();
  const ok = "a".repeat(64), vu = "b".repeat(64), elsewhere = "c".repeat(64);
  ctx.rows.tasks.push(
    { task_id: "task_nz", country_code: "NZ", source_record_id: "osm:way/1", osm_object_type: "way", matched_osm_id: "1" },
    { task_id: "task_vu", country_code: "VU", source_record_id: "osm:way/1" },
    { task_id: "task_nz_other", country_code: "NZ", osm_object_type: "way", matched_osm_id: "99" },
    { task_id: "task_nz_unplaced", country_code: "NZ" },
  );
  ctx.rows.evidence_drafts.push(
    { evidence_draft_id: "draft_nz", task_id: "task_nz" },
    { evidence_draft_id: "draft_vu", task_id: "task_vu" },
    { evidence_draft_id: "draft_other", task_id: "task_nz_other" },
    { evidence_draft_id: "draft_unplaced", task_id: "task_nz_unplaced" },
  );
  ctx.rows.evidence_versions.push(
    { object_hash: `sha256:${ok}`, task_id: "task_nz", evidence_draft_id: "draft_nz" },
    { object_hash: `sha256:${vu}`, task_id: "task_vu", evidence_draft_id: "draft_vu" },
    { object_hash: `sha256:${elsewhere}`, task_id: "task_nz_other", evidence_draft_id: "draft_other" },
  );
  const refusals = [
    [{ task_id: "task_missing" }, /task this deployment does not hold/],
    [{ evidence_draft_id: "draft_missing" }, /evidence draft this deployment does not hold/],
    [{ evidence_version_hash: "d".repeat(64) }, /evidence version this deployment does not hold/],
    // a draft or a version alone is resolved to its owning task
    [{ evidence_draft_id: "draft_vu" }, /different country/],
    [{ evidence_version_hash: vu }, /different country/],
    [{ task_id: "task_vu" }, /different country/],
    [{ evidence_draft_id: "draft_other" }, /different place/],
    [{ evidence_version_hash: elsewhere }, /different place/],
    [{ task_id: "task_nz_other" }, /different place/],
    [{ task_id: "task_nz_unplaced" }, /names no place/],
    // every named record must belong to the same task
    [{ task_id: "task_nz", evidence_draft_id: "draft_other" }, /different tasks/],
    [{ task_id: "task_nz", evidence_version_hash: elsewhere }, /different tasks/],
    [{ evidence_draft_id: "draft_nz", evidence_version_hash: elsewhere }, /different draft/],
  ];
  for (const [value, pattern] of refusals) {
    record.context = value;
    // lookup failures name fields, never the supplied or stored identifiers
    await assert.rejects(ingestFirstPass._handler(ctx, args(record)), (error) => pattern.test(error.message) && !/task_nz|task_vu|draft_other|draft_nz/.test(error.message) && !(value.evidence_version_hash && error.message.includes(value.evidence_version_hash)), JSON.stringify(value));
  }
  assert.equal(ctx.rows.agent_first_pass_receipts.length, 0);
  assert.equal(ctx.rows.agent_judgments.length, 0);
  // naming only the version resolves its draft and task for the receipt and judgments
  record.context = { evidence_version_hash: ok, assistance_request_id: "assist_01" };
  const result = await ingestFirstPass._handler(ctx, args(record));
  const [receipt] = ctx.rows.agent_first_pass_receipts;
  assert.equal(receipt.task_id, "task_nz");
  assert.equal(receipt.evidence_draft_id, "draft_nz");
  assert.equal(receipt.evidence_version_hash, ok);
  assert.equal(receipt.assistance_request_id, "assist_01");
  const judgment = ctx.rows.agent_judgments.find((row) => row.judgment_id === result.judgment_ids[0]);
  assert.deepEqual(judgment.context, { task_id: "task_nz", evidence_draft_id: "draft_nz", evidence_version_hash: `sha256:${ok}`, place_ref: record.place_ref, country_code: "NZ" });
  // a source_record_id alone also identifies the place
  record.context = { task_id: "task_nz" };
  ctx.rows.tasks[0] = { task_id: "task_nz", country_code: "NZ", source_record_id: "osm:way/1" };
  assert.equal((await ingestFirstPass._handler(ctx, args(record))).created, true);
});

test("free text with personal details is refused before a reviewer could read it", async () => {
  enable();
  const ctx = context();
  const cases = [
    ["stop_reason", (r) => { r.stop_reason = "Stopped; ask the office on 04 123 4567."; }],
    ["question", (r) => { r.question = "Confirm with someone@example.org when worship began."; }],
    ["next_questions[0]", (r) => { r.next_questions = ["Ask Father Smithers about the first service."]; }],
    ["usage.note", (r) => { r.usage.note = "Billed to office@example.org."; }],
    ["attribution.responsible_human_ref", (r) => { r.attribution.responsible_human_ref = "commissioner@example.org"; }],
    ["searches[0].note", (r) => { r.searches[0].note = "Rev Jones answered the phone."; }],
    ["searches[0].access_note", (r) => { r.searches[0].access_note = "Call +64 21 123 4567 for access."; }],
    ["searches[0].licence_note", (r) => { r.searches[0].licence_note = "Terms from Dr Kowhai."; }],
    ["searches[0].query", (r) => { r.searches[0].query = "Pastor Aroha church"; }],
  ];
  for (const [path, mutate] of cases) {
    const record = partial();
    mutate(record);
    await assert.rejects(ingestFirstPass._handler(ctx, args(record)), new RegExp(`personal details in ${path.replace(/[[\]]/g, "\\$&")}`));
  }
  const annotated = researched();
  annotated.annotations[0].note = "Verified with Mrs Tui Walker.";
  await assert.rejects(ingestFirstPass._handler(ctx, args(annotated)), /personal details in annotations\[0\]\.note/);
  const basis = researched();
  basis.dossier.status_assessment.basis = "Per the vicar, Canon Smith.";
  await assert.rejects(ingestFirstPass._handler(ctx, args(basis)), /personal details in dossier\.status_assessment\.basis/);
  assert.equal(ctx.rows.agent_first_pass_receipts.length, 0);
  assert.equal(ctx.rows.agent_judgments.length, 0);
});

// every string leaf and every object key of a record, with a setter that
// injects a synthetic email into it; written independently of screenedText
function everyString(record) {
  const out = [];
  const walk = (value, path, setLeaf, renameKey) => {
    if (typeof value === "string") {
      out.push({ path, kind: "value", inject: (r) => setLeaf(r, value.startsWith("http") ? `${value}?contact=someone@example.org` : `${value} someone@example.org`) });
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, i) => walk(item, `${path}[${i}]`, (r, v) => { at(r, path)[i] = v; }));
      return;
    }
    if (value === null || typeof value !== "object") return;
    for (const key of Object.keys(value)) {
      const child = path === "" ? key : `${path}.${key}`;
      out.push({ path: `${child} (key)`, kind: "key", inject: (r) => { const o = at(r, path); const renamed = {}; for (const [k, v] of Object.entries(o)) renamed[k === key ? `contact someone@example.org` : k] = v; Object.keys(o).forEach((k) => delete o[k]); Object.assign(o, renamed); } });
      walk(value[key], child, (r, v) => { at(r, path)[key] = v; });
    }
  };
  const at = (r, path) => (path === "" ? r : path.split(/\.|(?=\[)/).reduce((o, part) => (part.startsWith("[") ? o[Number(part.slice(1, -1))] : o[part]), r));
  walk(record, "", null);
  return out;
}

test("every string of the record and its dossier is screened, whatever its schema", async () => {
  enable();
  const base = fixture("first-pass-all-fields.json");
  assert.equal((await ingestFirstPass._handler(context(), args(base))).created, true, "the all-fields fixture is valid");
  const screened = new Set(screenedText(JSON.parse(wire(fixtureText("first-pass-all-fields.json")))).map(([path]) => path));
  // the fields the second review found unscreened are now screened
  // an undeclared key such as a seed tag is named by position, never copied into a path
  const atPath = (r, path) => (path === "" ? r : path.split(/\.|(?=\[)/).reduce((o, part) => (part.startsWith("[") ? o[Number(part.slice(1, -1))] : o[part]), r));
  const screenPath = (r, path) => path.replace(/^dossier\.place\.seed_tags\.([^.[]+)/, (_, key) => `dossier.place.seed_tags.${keyRef(r.dossier.place.seed_tags, key)}`);
  const denomination = screenPath(base, "dossier.place.seed_tags.denomination");
  for (const path of ["dossier.run_manifest.notes", "dossier.candidate_location.basis_note", "dossier.claims[0].source.licence_note", denomination, `${denomination} (key)`, "dossier.osm_version_chain[0].change_note", "context.assistance_request_id"]) {
    assert.ok(screened.has(path), path);
  }
  const refusedForPersonalDetails = new Set();
  const refusedBySchema = new Set();
  const cases = everyString(base);
  assert.ok(cases.length > 150, `${cases.length} generated cases`);
  for (const { path, kind, inject } of cases) {
    const record = structuredClone(base);
    inject(record);
    const error = await ingestFirstPass._handler(context(), args(record)).then(() => null, (e) => e);
    assert.ok(error !== null, `injected ${path} was accepted`);
    const match = /potential personal details in (.+) require human handling/.exec(error.message);
    assert.ok(!error.message.includes("someone@example.org"), `${path}: the diagnostic copies the detail`);
    if (match !== null) {
      if (kind === "key") {
        // a renamed key is reported by its position in the renamed object, never by its text
        const child = path.slice(0, -" (key)".length);
        const parent = child.includes(".") ? child.slice(0, child.lastIndexOf(".")) : "";
        const expected = `${parent === "" ? "" : `${screenPath(base, parent)}.`}${keyRef(atPath(record, parent), "contact someone@example.org")} (key)`;
        assert.equal(match[1], expected, path);
      } else assert.equal(match[1], screenPath(base, path));
      refusedForPersonalDetails.add(match[1]);
    } else {
      // a closed vocabulary, a fixed shape or a declared key refuses the text itself
      assert.match(error.message, /invalid (enum|constant|string)|unknown field|missing /, `${path}: ${error.message}`);
      refusedBySchema.add(path);
    }
  }
  // every string value is screened now, including pattern-constrained ones such as place_ref;
  // each injected value is refused, by its schema where the schema closes it, otherwise by the screen
  const screenedValues = [...screened].filter((path) => !path.endsWith(" (key)"));
  for (const path of ["place_ref", "dossier.place.place_ref", "created_at"]) assert.ok(screened.has(path), `${path} not screened`);
  for (const path of screenedValues) assert.ok(refusedForPersonalDetails.has(path) || refusedBySchema.has(path), `${path} not refused`);
});

test("python and typescript screen the same strings", async (t) => {
  const { spawnSync } = await import("node:child_process");
  if (spawnSync("python3", ["--version"]).status !== 0) { t.skip("python3 is not available"); return; }
  for (const name of ["first-pass.json", "first-pass-all-fields.json"]) {
    const script = `import json,sys\nsys.path.insert(0, 'scripts/agent_research')\nimport first_pass as fp\nprint(json.dumps([p for p, _ in fp.screened_text(json.load(open('scripts/agent_research/fixtures/${name}')))]))`;
    const run = spawnSync("python3", ["-c", script], { cwd: fileURLToPath(new URL("..", import.meta.url)), encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr);
    assert.deepEqual(JSON.parse(run.stdout), screenedText(fixture(name)).map(([path]) => path), name);
  }
});

test("a float where python's schema needs an integer is refused, so every receipt restores", async () => {
  enable();
  const exact = wire(fixtureText("first-pass-researched.json"));
  assert.ok(exact.includes('"item_count":0,') && exact.includes('"input_tokens":10,'));
  for (const [from, to, pattern] of [['"item_count":0,', '"item_count":0.0,', /item_count: invalid type/], ['"input_tokens":10,', '"input_tokens":10.0,', /input_tokens: invalid type/]]) {
    const text = exact.replace(from, to);
    // canonical python bytes, so only the int/float distinction can refuse them
    assert.equal(wire(text), text);
    const ctx = context();
    await assert.rejects(ingestFirstPass._handler(ctx, { recordJson: text, recordHash: sha256(text) }), pattern);
    assert.equal(ctx.rows.agent_first_pass_receipts.length, 0);
  }
});

test("a retry of receipted bytes succeeds even after a rule has tightened", async () => {
  enable();
  const ctx = context();
  const input = args(partial());
  const first = await ingestFirstPass._handler(ctx, input);
  // simulate a receipt written before a stricter rule: the stored bytes now fail validation
  const stale = partial();
  stale.stop_reason = "Stopped; ask the office on 04 123 4567.";
  const staleInput = args(stale);
  await assert.rejects(ingestFirstPass._handler(ctx, staleInput), /personal details/);
  ctx.rows.agent_first_pass_receipts.push({ ...ctx.rows.agent_first_pass_receipts[0], _id: "stale", receipt_id: `first-pass:${staleInput.recordHash}`, record_hash: staleInput.recordHash, record_json: staleInput.recordJson, judgment_ids: [] });
  const retried = await ingestFirstPass._handler(ctx, staleInput);
  assert.equal(retried.created, false);
  assert.equal(retried.receipt_id, `first-pass:${staleInput.recordHash}`);
  // a wrong hash never reaches the stored receipt
  await assert.rejects(ingestFirstPass._handler(ctx, { recordJson: input.recordJson, recordHash: staleInput.recordHash }), /does not match/);
  assert.equal((await ingestFirstPass._handler(ctx, input)).receipt_id, first.receipt_id);
  assert.equal(ctx.rows.agent_first_pass_receipts.length, 2);
});

test("the parent lookup stays bounded on a place with a long judgment history", async () => {
  enable();
  const ctx = context({ guardUnbounded: true });
  const record = researched();
  const lane = "codex-first-pass-researcher";
  const judge = { agent_name: lane, model_provider: "codex", model_requested: "gpt-5.6-luna", model_reported: "gpt-5.6-luna", prompt_version: "researcher.v1" };
  // 32,000 judgments from another lane and twelve earlier verdicts of this one
  for (let i = 0; i < 32_000; i += 1) {
    ctx.rows.agent_judgments.push({ _id: `other_${i}`, judgment_id: `other-${i}`, subject_ref: record.place_ref, judgment_kind: "status_assessment", judge: { ...judge, agent_name: "another-lane" }, created_at: i });
  }
  for (let i = 0; i < 12; i += 1) {
    ctx.rows.agent_judgments.push({ _id: `mine_${i}`, judgment_id: `mine-${i}`, subject_ref: record.place_ref, judgment_kind: "status_assessment", judge, created_at: 40_000 + i });
  }
  ctx.reads.agent_judgments = 0;
  const result = await ingestFirstPass._handler(ctx, args(record));
  const verdict = ctx.rows.agent_judgments.find((row) => row.judgment_id === result.judgment_ids[0]);
  // the ten newest of this lane, newest first, and never the other lane
  assert.deepEqual(verdict.parents, Array.from({ length: 10 }, (_, i) => `mine-${11 - i}`));
  assert.ok(ctx.reads.agent_judgments <= 40, `read ${ctx.reads.agent_judgments} judgment rows`);
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
    [(r) => { r.context = { reviewer: "someone" }; }, /unknown field <key#0>/],
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
  // keep the recomputed idempotency key consistent so only the place mismatch remains
  const fm = foreign.dossier.run_manifest;
  fm.idempotency_key = sha256(["osm:way/2", fm.prompt_version, fm.model_id_requested, foreign.dossier.place.seed_source].join("|"));
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
