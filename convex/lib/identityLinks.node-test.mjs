import assert from "node:assert/strict";
import test from "node:test";
import { assertIdentityLinks, LINK_REQUIRED_BASES, LINK_OPTIONAL_BASES } from "./identityLinks.ts";

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
