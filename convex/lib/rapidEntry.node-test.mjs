import assert from "node:assert/strict";
import test from "node:test";
import {
  assertNotRapidContract,
  assertRapidCandidateContext,
  assertRapidDerivedConsistency,
  assertRapidSubmissionId,
  assertVanuatuPoint,
  deriveCurrentObservation,
  isRapidCurrentDraft,
  sourceFieldsForObservationBasis,
} from "./rapidEntry.ts";

test("current worship use derives both present existence and confirmed worship use", () => {
  assert.deepEqual(deriveCurrentObservation("currently_used_for_worship", false), {
    action: "confirm_current_record",
    existence_status: "present",
    worship_use_status: "confirmed_worship",
  });
  assert.equal(deriveCurrentObservation("currently_used_for_worship", true).action, "missing_current_site");
});

test("physical existence does not silently confirm worship use", () => {
  assert.deepEqual(deriveCurrentObservation("place_exists_worship_uncertain", false), {
    action: "needs_review",
    existence_status: "present",
    worship_use_status: "uncertain",
  });
});

test("closed worship use retains physical existence", () => {
  assert.deepEqual(deriveCurrentObservation("place_exists_not_used_for_worship", false), {
    action: "closed_or_changed_use",
    existence_status: "present",
    worship_use_status: "not_worship",
  });
});

test("uncertain observations do not create false precision", () => {
  assert.deepEqual(deriveCurrentObservation("could_not_determine", false), {
    action: "needs_review",
    existence_status: "uncertain",
    worship_use_status: "uncertain",
  });
});

test("field observations use a controlled source label", () => {
  assert.deepEqual(sourceFieldsForObservationBasis("direct_field_observation"), {
    source_type: "field_observation",
    source_title: "RA field observation",
  });
});

test("submission identifiers must be UUID v4 values", () => {
  assert.doesNotThrow(() => assertRapidSubmissionId("123e4567-e89b-42d3-a456-426614174000"));
  assert.throws(() => assertRapidSubmissionId("predictable-1"), /submission identifier is invalid/);
});

test("candidate points must fall inside the Vanuatu intake area", () => {
  assert.doesNotThrow(() => assertVanuatuPoint(-17.7333, 168.3273));
  assert.throws(() => assertVanuatuPoint(-41.2865, 174.7762), /outside the Vanuatu intake area/);
  assert.throws(() => assertVanuatuPoint(Number.NaN, 168), /finite coordinates/);
});

test("new candidates require building-level placement and a nearby-place check", () => {
  assert.doesNotThrow(() => assertRapidCandidateContext({
    placement_zoom: 15,
    proximity_checked: true,
    nearby_count: 0,
  }));
  assert.throws(
    () => assertRapidCandidateContext({ placement_zoom: 14, proximity_checked: true, nearby_count: 0 }),
    /building level/,
  );
  assert.throws(
    () => assertRapidCandidateContext({ placement_zoom: 15, proximity_checked: false, nearby_count: 0 }),
    /Check nearby places/,
  );
});

// the exact server-side mapping from the observer's answer to the
// provisional review fields; any change here is a contract change
const EXPECTED_MAPPING = {
  currently_used_for_worship: {
    actions: ["confirm_current_record", "missing_current_site"],
    existence_status: "present",
    worship_use_status: "confirmed_worship",
  },
  place_exists_worship_uncertain: {
    actions: ["needs_review"],
    existence_status: "present",
    worship_use_status: "uncertain",
  },
  place_exists_not_used_for_worship: {
    actions: ["closed_or_changed_use"],
    existence_status: "present",
    worship_use_status: "not_worship",
  },
  could_not_determine: {
    actions: ["needs_review"],
    existence_status: "uncertain",
    worship_use_status: "uncertain",
  },
};

test("the derivation table is exact for every status and candidate flag", () => {
  for (const [status, expected] of Object.entries(EXPECTED_MAPPING)) {
    for (const newCandidate of [false, true]) {
      const derived = deriveCurrentObservation(status, newCandidate);
      assert.ok(expected.actions.includes(derived.action), `${status}/${newCandidate}: ${derived.action}`);
      assert.equal(derived.existence_status, expected.existence_status);
      assert.equal(derived.worship_use_status, expected.worship_use_status);
    }
  }
  assert.equal(deriveCurrentObservation("currently_used_for_worship", true).action, "missing_current_site");
  assert.equal(deriveCurrentObservation("currently_used_for_worship", false).action, "confirm_current_record");
});

test("persisted rapid drafts must carry the derived triple for their status", () => {
  for (const [status, expected] of Object.entries(EXPECTED_MAPPING)) {
    for (const action of expected.actions) {
      assert.doesNotThrow(() => assertRapidDerivedConsistency({
        observation_contract_version: "rapid_current_v1",
        current_observation_status: status,
        action,
        existence_status: expected.existence_status,
        worship_use_status: expected.worship_use_status,
      }));
    }
  }
  assert.throws(() => assertRapidDerivedConsistency({
    current_observation_status: "place_exists_worship_uncertain",
    action: "needs_review",
    existence_status: "present",
    worship_use_status: "confirmed_worship",
  }), /worship-use status "confirmed_worship" does not follow/);
  assert.throws(() => assertRapidDerivedConsistency({
    current_observation_status: "could_not_determine",
    action: "needs_review",
    existence_status: "present",
    worship_use_status: "uncertain",
  }), /existence status "present" does not follow/);
  assert.throws(() => assertRapidDerivedConsistency({
    current_observation_status: "place_exists_not_used_for_worship",
    action: "confirm_current_record",
    existence_status: "present",
    worship_use_status: "not_worship",
  }), /action "confirm_current_record" does not follow/);
  assert.throws(() => assertRapidDerivedConsistency({
    current_observation_status: "demolished",
    action: "needs_review",
  }), /controlled current-status answer/);
});

test("general write routes reject the rapid contract and its fields", () => {
  assert.equal(isRapidCurrentDraft({ observation_contract_version: "rapid_current_v1" }), true);
  assert.equal(isRapidCurrentDraft({ observation_contract_version: "guided_observation_v1" }), false);
  assert.doesNotThrow(() => assertNotRapidContract({ observation_contract_version: "guided_observation_v1" }, "route"));
  assert.doesNotThrow(() => assertNotRapidContract(undefined, "route"));
  assert.throws(
    () => assertNotRapidContract({ observation_contract_version: "rapid_current_v1" }, "spreadsheet import"),
    /cannot be written through spreadsheet import/,
  );
  assert.throws(
    () => assertNotRapidContract({ current_observation_status: "could_not_determine" }, "the general draft route"),
    /cannot be written through the general draft route/,
  );
  assert.throws(
    () => assertNotRapidContract({ current_observation_basis: "other" }, "the general submission route"),
    /general submission route/,
  );
});
