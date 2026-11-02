import assert from "node:assert/strict";
import test from "node:test";
import { assertIdentityLinks, ownIdentifiers, resolveIdentityLinks, LINK_REQUIRED_BASES, LINK_OPTIONAL_BASES } from "./identityLinks.ts";

const task = { task_id: "task_1", matched_current_site_id: "nz-site-1", candidate_site_id: "candidate:nz:b:1" };
const check = (identity_decision, linked_site_ids) => assertIdentityLinks(task, { identity_decision, linked_site_ids });

test("relocation is refused on a new decision, with or without links", () => {
  assert.throws(() => check("relocation"), /no longer an identity basis/);
  assert.throws(() => check("relocation", ["nz-a"]), /no longer an identity basis/);
});

test("a basis that relates two places requires a link and returns it trimmed", () => {
  for (const basis of LINK_REQUIRED_BASES) {
    assert.throws(() => check(basis), /give the linked place's identifier/);
    assert.throws(() => check(basis, []), /give the linked place's identifier/);
    assert.deepEqual(check(basis, [" nz-a ", "nz-b"]), ["nz-a", "nz-b"]);
  }
});

test("a duplicate or an uncertain decision may carry links or none", () => {
  for (const basis of LINK_OPTIONAL_BASES) {
    assert.equal(check(basis), undefined);
    assert.deepEqual(check(basis, ["nz-a"]), ["nz-a"]);
  }
});

test("bases that keep or found a place alone refuse links", () => {
  for (const basis of ["same_site", "conversion", "new_candidate", undefined]) {
    assert.equal(check(basis), undefined);
    assert.equal(check(basis, []), undefined);
    assert.throws(() => check(basis, ["nz-a"]), /apply only to/);
  }
});

test("link identifiers are bounded, distinct, printable and not the task itself", () => {
  assert.throws(() => check("split", ["  "]), /blank/);
  assert.throws(() => check("split", ["x".repeat(201)]), /200 characters/);
  assert.deepEqual(check("split", ["x".repeat(200)]), ["x".repeat(200)]);
  assert.throws(() => check("split", ["nz-a", " nz-a"]), /named once/);
  assert.throws(() => check("split", ["nz\u0007a"]), /control characters/);
  for (const own of ["task_1", " nz-site-1 ", "candidate:nz:b:1"]) {
    assert.throws(() => check("successor_at_new_site", [own]), /another place/);
  }
  assert.deepEqual(assertIdentityLinks({ task_id: "task_2" }, { identity_decision: "split", linked_site_ids: ["nz-site-1"] }), ["nz-site-1"]);
  // an internal-intake task may name its place only by source record or osm reference
  const intake = { task_id: "task_3", source_record_id: "osm:node/123", osm_object_type: "way", matched_osm_id: "456" };
  for (const own of ["osm:node/123", " osm:way/456 "]) {
    assert.throws(() => assertIdentityLinks(intake, { identity_decision: "successor_at_new_site", linked_site_ids: [own] }), /another place/);
  }
  assert.deepEqual(assertIdentityLinks(intake, { identity_decision: "successor_at_new_site", linked_site_ids: ["osm:node/789"] }), ["osm:node/789"]);
  assert.throws(() => check("merge", Array.from({ length: 11 }, (_, i) => `nz-${i}`)), /at most 10/);
  assert.equal(check("merge", Array.from({ length: 10 }, (_, i) => `nz-${i}`)).length, 10);
});

// an in-memory tasks table answering the five index lookups the resolver
// makes; each index is checked against the field it names in schema.ts
const INDEX_FIELDS = { by_matched_site: "matched_current_site_id", by_candidate_site: "candidate_site_id", by_osm: "matched_osm_id", by_task_id: "task_id", by_source_record_id: "source_record_id" };
function tasksDb(rows) {
  const reads = [];
  return {
    reads,
    query(table) {
      assert.equal(table, "tasks");
      return {
        withIndex(index, range) {
          let field;
          let value;
          range({ eq(f, v) { field = f; value = v; return this; } });
          assert.equal(field, INDEX_FIELDS[index], `${index} ranges over ${INDEX_FIELDS[index]}`);
          reads.push(index);
          return { async take(n) { return rows.filter((row) => row[field] === value).slice(0, n); } };
        },
      };
    },
  };
}

const known = [
  // an nz map site, a revision task on the same site, and a workpack task
  // that names it only by osm reference and source record
  { task_id: "nz-verify-n100", country_code: "NZ", matched_current_site_id: "n100", source_record_id: "nz-verify-n100", matched_osm_id: "100", osm_object_type: "node" },
  { task_id: "revise-nz-1-n100", country_code: "NZ", matched_current_site_id: "n100", source_record_id: "nz_places:abc#n100", matched_osm_id: "100", osm_object_type: "node" },
  { task_id: "nz-workpack-1", country_code: "NZ", source_record_id: "nz-osm-date-tag-node-100", matched_osm_id: "100", osm_object_type: "node" },
  // a way sharing the number of the node above
  { task_id: "nz-verify-w100", country_code: "NZ", matched_current_site_id: "w100", source_record_id: "nz-verify-w100", matched_osm_id: "100", osm_object_type: "way" },
  // a nominated candidate, and a vanuatu site whose current id is an osm reference
  { task_id: "nz-manual-1", country_code: "NZ", candidate_site_id: "candidate:nz-candidate-1" },
  { task_id: "vu-revise-1", country_code: "VU", matched_current_site_id: "osm:node/555", source_record_id: "osm-vu-place-of-worship#node/555", matched_osm_id: "555", osm_object_type: "node" },
  // an internal-intake task that names its place only by osm reference
  { task_id: "agent-research:k1", country_code: "NZ", source_record_id: "osm:way/777", matched_osm_id: "777", osm_object_type: "way" },
  // a source record shared by two different places
  { task_id: "vu-woodberry-1", country_code: "VU", candidate_site_id: "candidate:vu:w:1", source_record_id: "Woodberry (2010)" },
  { task_id: "vu-woodberry-2", country_code: "VU", candidate_site_id: "candidate:vu:w:2", source_record_id: "Woodberry (2010)" },
];
const thisTask = { task_id: "nz-verify-n200", matched_current_site_id: "n200", source_record_id: "nz-verify-n200", matched_osm_id: "200", osm_object_type: "node" };
const resolve = (links, task = thisTask, rows = known) => resolveIdentityLinks(tasksDb(rows), task, links);

test("an existing current or candidate site identifier is stored as entered", async () => {
  assert.deepEqual(await resolve(["n100"]), ["n100"]);
  assert.deepEqual(await resolve(["candidate:nz-candidate-1"]), ["candidate:nz-candidate-1"]);
});

test("an existing source record or task identifier resolves to its place's site identifier", async () => {
  assert.deepEqual(await resolve(["nz-verify-n100"]), ["n100"]);
  assert.deepEqual(await resolve(["nz_places:abc#n100"]), ["n100"]);
  assert.deepEqual(await resolve(["revise-nz-1-n100"]), ["n100"]);
  // a workpack record without a site id stands for its osm object's place
  assert.deepEqual(await resolve(["nz-osm-date-tag-node-100"]), ["osm:node/100"]);
});

test("an existing osm reference resolves to the site carrying that object, type and all", async () => {
  // the node's tasks carry n100 (one carries no site id), the way's w100
  assert.deepEqual(await resolve(["osm:node/100"]), ["n100"]);
  assert.deepEqual(await resolve(["osm:way/100"]), ["w100"]);
  // an internal-intake place known only by its osm reference keeps it
  assert.deepEqual(await resolve(["osm:way/777"]), ["osm:way/777"]);
  // the bare map spelling finds the same object's tasks
  assert.deepEqual(await resolve(["n555"]), ["osm:node/555"]);
  assert.deepEqual(await resolve(["w777"]), ["w777"]);
});

test("a well-formed place identifier no task carries is stored as entered", async () => {
  assert.deepEqual(await resolve(["n999", "w999", "r999"]), ["n999", "w999", "r999"]);
  assert.deepEqual(await resolve(["osm:relation/100", "osm:way/999"]), ["osm:relation/100", "osm:way/999"]);
  assert.deepEqual(await resolve(["candidate:au-candidate-1-unknown-place-of-worship", "candidate:vu:batch-1:12"]), ["candidate:au-candidate-1-unknown-place-of-worship", "candidate:vu:batch-1:12"]);
});

test("an identifier that fits no place form and no task carries is refused by name, with an example", async () => {
  for (const typo of ["nz-osm-node-1", "N999", "n 999", "n999a", "osm:node/12a", "osm:area/1", "candidate:", "candidate: x", "999"]) {
    await assert.rejects(resolve(["n100", typo]), (error) => {
      assert.ok(error.message.includes(`Linked place "${typo}" is not a place identifier`), error.message);
      assert.match(error.message, /such as n123 or w456.*osm:node\/123.*candidate:nz-candidate-1/);
      return true;
    });
  }
});

test("a link to a place in another country is accepted", async () => {
  assert.deepEqual(await resolve(["osm:node/555"]), ["osm:node/555"]);
  assert.deepEqual(await resolve(["osm-vu-place-of-worship#node/555", "candidate:vu:w:1"]), ["osm:node/555", "candidate:vu:w:1"]);
});

test("a link that resolves to this task's own place is refused", async () => {
  // another task on this task's site, named by its task id or source record
  const rows = [...known, { task_id: "revise-nz-1-n200", matched_current_site_id: "n200", source_record_id: "nz_places:abc#n200" }];
  await assert.rejects(resolve(["revise-nz-1-n200"], thisTask, rows), /resolves to this task's own place \(n200\)/);
  await assert.rejects(resolve(["nz_places:abc#n200"], thisTask, rows), /own place/);
  // the place an internal-intake task names by osm reference
  const intake = known.find((row) => row.task_id === "agent-research:k1");
  const other = [...known, { task_id: "nz-workpack-2", source_record_id: "nz-osm-date-tag-way-777", matched_osm_id: "777", osm_object_type: "way" }];
  await assert.rejects(resolve(["nz-osm-date-tag-way-777"], intake, other), /own place \(osm:way\/777\)/);
  // the bare map spelling of the intake task's osm object is its own place,
  // by the pure mapping in ownIdentifiers, before any lookup
  assert.throws(() => assertIdentityLinks(intake, { identity_decision: "successor_at_new_site", linked_site_ids: ["w777"] }), /another place/);
  await assert.rejects(resolve(["w777"], intake), /this task's own record|own place/);
  // and a vanuatu site id in osm form is the same place as its bare spelling
  const vu = known.find((row) => row.task_id === "vu-revise-1");
  assert.throws(() => assertIdentityLinks(vu, { identity_decision: "split", linked_site_ids: ["n555"] }), /another place/);
});

test("ownIdentifiers adds the other spelling of each osm object and nothing else", () => {
  const intake = { task_id: "agent-research:k1", source_record_id: "osm:way/777", matched_osm_id: "777", osm_object_type: "way" };
  assert.deepEqual(ownIdentifiers(intake).sort(), ["agent-research:k1", "osm:way/777", "w777"]);
  const nz = { task_id: "nz-verify-r5", matched_current_site_id: "r5", source_record_id: "nz-verify-r5" };
  assert.deepEqual(ownIdentifiers(nz).sort(), ["nz-verify-r5", "osm:relation/5", "r5"]);
  const candidate = { task_id: "t", candidate_site_id: "candidate:t" };
  assert.deepEqual(ownIdentifiers(candidate).sort(), ["candidate:t", "t"]);
});

test("an ambiguous reference and two links naming one place are refused", async () => {
  await assert.rejects(resolve(["Woodberry (2010)"]), /matches more than one place \(candidate:vu:w:1, candidate:vu:w:2\)/);
  await assert.rejects(resolve(["n100", "osm:node/100"]), /"n100" and "osm:node\/100" name the same place \(n100\)/);
  // two spellings of one object no task carries are one place too
  await assert.rejects(resolve(["n999", "osm:node/999"]), /"n999" and "osm:node\/999" name the same place \(osm:node\/999\)/);
});

test("resolution reads only through the five task indexes", async () => {
  const db = tasksDb(known);
  await resolveIdentityLinks(db, thisTask, ["osm:node/100"]);
  assert.deepEqual(db.reads, ["by_matched_site", "by_candidate_site", "by_osm", "by_task_id", "by_source_record_id"]);
});
