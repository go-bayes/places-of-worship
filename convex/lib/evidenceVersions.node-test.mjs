import assert from "node:assert/strict";
import fs from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";

// Convex resolves extensionless local TypeScript imports during bundling; the
// same rule is supplied here so the tests load the real builder and verifier.
registerHooks({ resolve(specifier, context, nextResolve) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) { for (const ext of [".js", ".ts"]) { const candidate = new URL(`${specifier}${ext}`, context.parentURL); if (fs.existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context); } } return nextResolve(specifier, context); } });

const libModule = await import("./evidenceVersions.ts");
const canonicalModule = await import("./canonicalJson.ts");
const {
  buildEvidenceVersion,
  evidenceContentFromRow,
  occupancyContentFromRow,
  sortOccupancyContent,
  verifyEvidenceVersionEnvelope,
  EVIDENCE_VERSION_SCHEMA,
} = libModule;
const { HASH_CONTRACT, objectHash } = canonicalModule;

const fixtures = JSON.parse(
  fs.readFileSync(new URL("../../schemas/fixtures/evidence-version.v1.json", import.meta.url), "utf8"),
);

// the stated reason of each tampered fixture, matched loosely against the
// verifier's own wording rather than character for character
const tamperedReasonPatterns = {
  "object_hash mismatch": /object_hash sha256:[0-9a-f]{64} does not match recomputed/,
  "payload.occupancies unsorted": /occupancies must be sorted by segment_index then occupancy_id/,
  "duplicate occupancy_id": /duplicate occupancy_id/,
  "parent_object_hashes unsorted": /parent_object_hashes must be sorted without duplicates/,
  hash_contract: /hash_contract must be/,
  schema_version: /schema_version must be/,
  "recorded_at format": /recorded_at must be an rfc 3339/,
  "parent hash format": /parent_object_hashes\[\d+\] is not a pow-object\.v1 hash/,
  "object_hash absent": /object_hash must be a pow-object\.v1 hash/,
};

// an invented guided row; no real place or person
const guidedRow = {
  _id: "row_1",
  _creationTime: 1789000000000,
  evidence_draft_id: "nz-test-001:user_ra:draft",
  task_id: "nz-test-001",
  draft_status: "submitted",
  created_by: "user_ra",
  created_at: 1789000000000,
  updated_at: 1789000001000,
  observation_contract_version: "guided_observation_v1",
  source_type: "denominational_directory",
  source_title: "Diocesan directory 2016",
  source_url_or_file: "https://example.org/directory/2016",
  source_date_or_capture_date: "2016-07",
  action: "confirm_current_record",
  target_year_statuses: { 2013: "present", 2018: "present" },
  evidence_note: "The directory lists regular Sunday services.",
  privacy_flag: "clear",
  licence_flag: "needs_review",
};

const occupancyBase = {
  _id: "occ_row",
  _creationTime: 1789000000500,
  task_id: "nz-test-001",
  parent_evidence_draft_id: guidedRow.evidence_draft_id,
  claim_status: "submitted",
  submission_key: "user_ra:sub-0001",
  created_by: "user_ra",
  created_at: 1789000000500,
  updated_at: 1789000000500,
  contract_version: "occupancy_v1",
  start_mode: "date",
  start_precision: "year",
  start_basis: "source_stated",
  end_mode: "ongoing",
  end_precision: "unknown",
  end_basis: "not_applicable",
  location_relation: "same_as_task_point",
  latitude: -41.282,
  longitude: 174.768,
  location_mode: "building_identified",
  location_basis: "map_placement",
  location_confidence: "high",
  confidence: "high",
  confidence_basis: "Directory entry with street address.",
  source_basis: "documentary",
  source_title: "Diocesan directory 2016",
  source_account: "Listed as a parish church with weekly services.",
  privacy_flag: "clear",
};

function occupancy(id, segmentIndex, extra = {}) {
  return { ...occupancyBase, occupancy_id: id, segment_index: segmentIndex, ...extra };
}

function build(overrides = {}) {
  return buildEvidenceVersion({
    task_id: guidedRow.task_id,
    evidence_draft_id: guidedRow.evidence_draft_id,
    evidence_family_id: guidedRow.evidence_draft_id,
    version_index: 1,
    version_kind: "guided_submission",
    lineage: { relation: "first" },
    actor_user_id: "user_ra",
    recorded_at_ms: Date.UTC(2026, 8, 11, 4, 30, 0, 123),
    evidence_row: guidedRow,
    occupancy_rows: [],
    ...overrides,
  });
}

test("every golden evidence-version fixture verifies and reproduces its payload hash", () => {
  assert.equal(fixtures.contract, EVIDENCE_VERSION_SCHEMA);
  assert.equal(fixtures.hash_contract, HASH_CONTRACT);
  assert.ok(fixtures.cases.length > 0);
  for (const fixture of fixtures.cases) {
    const verification = verifyEvidenceVersionEnvelope(fixture.envelope);
    assert.deepEqual(verification.errors, [], `${fixture.name} should verify`);
    assert.equal(verification.valid, true, fixture.name);
    assert.equal(verification.object_hash, fixture.envelope.object_hash, fixture.name);
    assert.equal(objectHash({ evidence: fixture.envelope.payload.evidence, occupancies: fixture.envelope.payload.occupancies }), fixture.content_hash, fixture.name);
    // the stored hash covers the envelope with its own hash field removed
    const { object_hash: stored, ...unhashed } = fixture.envelope;
    assert.equal(objectHash(unhashed), stored, fixture.name);
  }
});

test("every tampered evidence-version fixture is refused for its stated reason", () => {
  assert.ok(fixtures.tampered.length > 0);
  for (const fixture of fixtures.tampered) {
    const verification = verifyEvidenceVersionEnvelope(fixture.envelope);
    assert.equal(verification.valid, false, `${fixture.name} should be refused`);
    const pattern = tamperedReasonPatterns[fixture.reason];
    assert.ok(pattern !== undefined, `no pattern for reason ${fixture.reason}`);
    assert.ok(
      verification.errors.some((error) => pattern.test(error)),
      `${fixture.name}: ${JSON.stringify(verification.errors)} does not report ${fixture.reason}`,
    );
  }
});

test("the builder sorts the occupancy set by segment index then occupancy id", () => {
  const built = build({
    occupancy_rows: [
      occupancy("occ:b", 1),
      occupancy("occ:z", 0),
      occupancy("occ:a", 0),
    ],
  });
  assert.deepEqual(
    built.envelope.payload.occupancies.map((row) => [row.segment_index, row.occupancy_id]),
    [[0, "occ:a"], [0, "occ:z"], [1, "occ:b"]],
  );
  assert.deepEqual(verifyEvidenceVersionEnvelope(built.envelope).errors, []);
  // the pre-sort is what makes the set-like array order-independent
  const reordered = build({
    occupancy_rows: [occupancy("occ:z", 0), occupancy("occ:a", 0), occupancy("occ:b", 1)],
  });
  assert.equal(reordered.object_hash, built.object_hash);
});

test("sortOccupancyContent leaves its input array untouched", () => {
  const rows = [{ segment_index: 1, occupancy_id: "b" }, { segment_index: 0, occupancy_id: "a" }];
  const sorted = sortOccupancyContent(rows);
  assert.deepEqual(rows.map((row) => row.occupancy_id), ["b", "a"]);
  assert.deepEqual(sorted.map((row) => row.occupancy_id), ["a", "b"]);
});

test("the builder refuses a duplicate occupancy id in one version payload", () => {
  assert.throws(
    () => build({ occupancy_rows: [occupancy("occ:a", 0), occupancy("occ:a", 1)] }),
    /Duplicate occupancy_id occ:a/,
  );
});

test("the builder refuses a version index below one", () => {
  for (const index of [0, -1, 1.5]) {
    assert.throws(() => build({ version_index: index }), /version_index must be a positive integer/);
  }
});

test("the builder refuses a malformed parent hash", () => {
  for (const parent of ["sha256:notahash", "deadbeef", `sha256:${"A".repeat(64)}`]) {
    assert.throws(
      () => build({ version_index: 2, lineage: { relation: "child", parent_object_hash: parent } }),
      /is not a pow-object\.v1 hash/,
    );
  }
  const valid = build({
    version_index: 2,
    lineage: { relation: "child", parent_object_hash: `sha256:${"a".repeat(64)}` },
  });
  assert.deepEqual(valid.envelope.parent_object_hashes, [`sha256:${"a".repeat(64)}`]);
});

test("excluded row fields leave the payload hash unchanged while a content field moves it", () => {
  const baseline = build({ occupancy_rows: [occupancy("occ:a", 0)] });
  const excluded = {
    draft_status: "accepted_for_export",
    updated_at: 1999999999999,
    guided_submission_key: "user_ra:sub-9999",
    validation_summary: { status: "server_validated", contract: "guided_observation_v1" },
    pending_occupancy_cards: [{ segment_index: 0 }],
    evidence_version_hash: `sha256:${"c".repeat(64)}`,
    _id: "row_999",
  };
  for (const [field, value] of Object.entries(excluded)) {
    const moved = build({
      evidence_row: { ...guidedRow, [field]: value },
      occupancy_rows: [occupancy("occ:a", 0)],
    });
    assert.equal(moved.content_hash, baseline.content_hash, `${field} must stay outside the payload`);
    assert.equal(moved.object_hash, baseline.object_hash, `${field} must stay outside the envelope`);
    assert.equal(moved.envelope.payload.evidence[field], undefined, field);
  }
  // every field of the row outside that list is submitted content
  const changed = build({
    evidence_row: { ...guidedRow, evidence_note: "The directory lists monthly services." },
    occupancy_rows: [occupancy("occ:a", 0)],
  });
  assert.notEqual(changed.content_hash, baseline.content_hash);
  assert.notEqual(changed.object_hash, baseline.object_hash);
});

test("occupancy locators and coordination state stay outside the payload", () => {
  const baseline = build({ occupancy_rows: [occupancy("occ:a", 0)] });
  const moved = build({
    occupancy_rows: [occupancy("occ:a", 0, {
      _id: "occ_row_9",
      _creationTime: 1999999999999,
      claim_status: "superseded",
      submission_key: "user_ra:sub-9999",
      parent_evidence_draft_id: "some-other-draft",
      updated_at: 1999999999999,
    })],
  });
  assert.equal(moved.content_hash, baseline.content_hash);
  const content = occupancyContentFromRow(occupancy("occ:a", 0));
  for (const key of ["_id", "_creationTime", "task_id", "parent_evidence_draft_id", "claim_status", "submission_key", "created_by", "created_at", "updated_at"]) {
    assert.equal(content[key], undefined, key);
  }
  assert.equal(content.start_date, undefined);
  assert.equal(content.occupancy_id, "occ:a");
});

test("an undefined field is omitted from the payload rather than serialised", () => {
  const content = evidenceContentFromRow({ ...guidedRow, uncertainty_note: undefined });
  assert.ok(!Object.keys(content).includes("uncertainty_note"));
  assert.equal(build({ evidence_row: { ...guidedRow, uncertainty_note: undefined } }).object_hash, build().object_hash);
});

test("recorded_at is an rfc 3339 utc time with milliseconds", () => {
  const built = build({ recorded_at_ms: Date.UTC(2026, 8, 11, 4, 30, 0, 7) });
  assert.equal(built.envelope.recorded_at, "2026-09-11T04:30:00.007Z");
  assert.match(built.envelope.recorded_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.deepEqual(verifyEvidenceVersionEnvelope(built.envelope).errors, []);
  assert.throws(() => build({ recorded_at_ms: Number.NaN }), /recorded_at must be a finite time/);
});

test("the envelope names its contract, actor, and logical identity", () => {
  const built = build();
  assert.equal(built.envelope.hash_contract, HASH_CONTRACT);
  assert.equal(built.envelope.object_type, "evidence_version");
  assert.equal(built.envelope.schema_version, EVIDENCE_VERSION_SCHEMA);
  assert.equal(built.envelope.created_by, "actor:user_ra");
  assert.equal(built.envelope.logical_id, `evidence:${guidedRow.task_id}:${guidedRow.evidence_draft_id}`);
  assert.match(built.object_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(JSON.parse(built.envelope_json).object_hash, built.object_hash);
});

test("lineage relations carry their own payload members and parent list", () => {
  const preContract = build({
    lineage: { relation: "revises_pre_contract", revises_evidence_draft_id: "legacy-draft" },
  });
  assert.deepEqual(preContract.envelope.parent_object_hashes, []);
  assert.equal(preContract.envelope.payload.revises_evidence_draft_id, "legacy-draft");
  assert.equal(preContract.envelope.payload.parent_version_unavailable, "pre_contract");

  const follows = build({
    lineage: { relation: "follows", follows_evidence_draft_id: "earlier-draft", follows_object_hash: `sha256:${"b".repeat(64)}` },
  });
  assert.deepEqual(follows.envelope.parent_object_hashes, []);
  assert.equal(follows.envelope.payload.follows_evidence_draft_id, "earlier-draft");
  assert.equal(follows.envelope.payload.follows_object_hash, `sha256:${"b".repeat(64)}`);
  assert.equal(follows.envelope.payload.parent_version_unavailable, undefined);
});

test("the verifier refuses values that are not evidence-version envelopes at all", () => {
  for (const value of [null, "envelope", 42, [], undefined]) {
    assert.equal(verifyEvidenceVersionEnvelope(value).valid, false);
  }
  const built = build();
  const withoutPayload = { ...built.envelope, payload: "not an object" };
  assert.equal(verifyEvidenceVersionEnvelope(withoutPayload).valid, false);
});

test("non-plain objects are refused before they can collapse to an empty member", () => {
  const { buildEvidenceVersion } = libModule;
  const base = { task_id: "t", evidence_draft_id: "d", evidence_family_id: "d", version_index: 1, version_kind: "submitted", lineage: { relation: "first" }, actor_user_id: "u", recorded_at_ms: 0, occupancy_rows: [] };
  assert.throws(() => buildEvidenceVersion({ ...base, evidence_row: { generated_wide_row: { bytes: new ArrayBuffer(4) } } }), /Non-plain object/);
  assert.throws(() => buildEvidenceVersion({ ...base, evidence_row: { source_date: new Date(0) } }), /Non-plain object/);
  const left = buildEvidenceVersion({ ...base, evidence_row: { generated_wide_row: { row: { a: 1 } } } });
  const right = buildEvidenceVersion({ ...base, evidence_row: { generated_wide_row: { row: { a: 2 } } } });
  assert.notEqual(left.content_hash, right.content_hash);
});

test("the verifier refuses an impossible calendar date and an occupancy without its ordering fields", () => {
  const { verifyEvidenceVersionEnvelope } = libModule;
  const { objectHash } = canonicalModule;
  const restamp = (envelope) => { const { object_hash: _h, ...rest } = envelope; return { ...rest, object_hash: objectHash(rest) }; };
  const valid = structuredClone(fixtures.cases[0].envelope);
  const badDate = restamp({ ...valid, recorded_at: "2026-13-45T25:61:61.000Z" });
  assert.match(verifyEvidenceVersionEnvelope(badDate).errors.join("; "), /recorded_at/);
  const missingSegment = structuredClone(valid);
  delete missingSegment.payload.occupancies[0].segment_index;
  assert.match(verifyEvidenceVersionEnvelope(restamp(missingSegment)).errors.join("; "), /numeric segment_index/);
});
