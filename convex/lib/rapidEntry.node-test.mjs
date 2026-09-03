import assert from "node:assert/strict";
import test from "node:test";
import {
  COUNTRY_INTAKE_BOUNDS,
  assertCountryIntakePoint,
  manualBatchId,
  assertNotRapidContract,
  assertRapidCandidateContext,
  issueBatchId,
  assertRapidDerivedConsistency,
  assertRapidSubmissionId,
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

test("vanuatu candidate points keep the release-one bounds and errors", () => {
  assert.doesNotThrow(() => assertCountryIntakePoint("VU", -17.7333, 168.3273));
  assert.throws(() => assertCountryIntakePoint("VU", -41.2865, 174.7762), /outside the Vanuatu intake area/);
  assert.throws(() => assertCountryIntakePoint("VU", Number.NaN, 168), /finite coordinates/);
});

test("new zealand points are accepted on both sides of the antimeridian", () => {
  // wellington, auckland, invercargill on the eastern-hemisphere side
  assert.doesNotThrow(() => assertCountryIntakePoint("NZ", -41.2865, 174.7762));
  assert.doesNotThrow(() => assertCountryIntakePoint("NZ", -36.8485, 174.7633));
  assert.doesNotThrow(() => assertCountryIntakePoint("NZ", -46.4132, 168.3538));
  // chatham islands sit past 180, reported as negative longitude
  assert.doesNotThrow(() => assertCountryIntakePoint("NZ", -43.9535, -176.5597));
  // lower-case codes normalise to the registry key
  assert.doesNotThrow(() => assertCountryIntakePoint("nz", -41.2865, 174.7762));
});

test("points outside the new zealand box are rejected", () => {
  // sydney: west of the box
  assert.throws(() => assertCountryIntakePoint("NZ", -33.8688, 151.2093), /outside the New Zealand intake area/);
  // port vila: north of the box
  assert.throws(() => assertCountryIntakePoint("NZ", -17.7333, 168.3273), /outside the New Zealand intake area/);
  // south of the box, below the chathams
  assert.throws(() => assertCountryIntakePoint("NZ", -50.5, 166.0), /outside the New Zealand intake area/);
  // east of the wrapped edge (-176), beyond the chathams
  assert.throws(() => assertCountryIntakePoint("NZ", -43.9, -170.0), /outside the New Zealand intake area/);
  assert.throws(() => assertCountryIntakePoint("NZ", Number.NaN, 174), /finite coordinates/);
});

test("countries without a declared intake ruling are refused, not defaulted open", () => {
  assert.throws(() => assertCountryIntakePoint("AU", -33.8688, 151.2093), /Rapid entry is not yet enabled for AU\./);
  assert.throws(() => assertCountryIntakePoint("xx", 0, 0), /Rapid entry is not yet enabled for XX\./);
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

test("an approximate-area candidate only needs its centre placed at locality zoom", () => {
  assert.doesNotThrow(() => assertRapidCandidateContext(
    { placement_zoom: 8, proximity_checked: true, nearby_count: 0 },
    "approximate_area",
  ));
  assert.throws(
    () => assertRapidCandidateContext({ placement_zoom: 7, proximity_checked: true, nearby_count: 0 }, "approximate_area"),
    /centre of the approximate area/,
  );
  // the default mode keeps the building-level floor unchanged
  assert.throws(
    () => assertRapidCandidateContext({ placement_zoom: 14, proximity_checked: true, nearby_count: 0 }, "building_identified"),
    /building level/,
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
  place_no_longer_exists: {
    actions: ["closed_or_changed_use"],
    existence_status: "absent",
    worship_use_status: "not_worship",
  },
  place_no_longer_exists: {
    actions: ["closed_or_changed_use"],
    existence_status: "absent",
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

test("out-of-range longitudes normalise before the bounds test", () => {
  // leaflet's continuous world: a chatham islands pin reached by panning
  // east across the antimeridian arrives as about +183.4
  assert.doesNotThrow(() => assertCountryIntakePoint("NZ", -43.95, 183.44));
  assert.doesNotThrow(() => assertCountryIntakePoint("NZ", -43.95, -176.56));
  assert.throws(() => assertCountryIntakePoint("NZ", -43.95, 190.1), /outside the New Zealand intake area/);
});

test("the nomination-batch contract and assigned-rapid flag are declared once", () => {
  assert.equal(manualBatchId("VU"), "manual-vu");
  assert.equal(manualBatchId("nz"), "manual-nz");
  assert.equal(COUNTRY_INTAKE_BOUNDS.VU.assignedRapid, true);
  assert.equal(COUNTRY_INTAKE_BOUNDS.NZ.assignedRapid, undefined);
});

test("the issue batch name is shared by createIssueTask and the rapid path", () => {
  assert.equal(issueBatchId("VU"), "ra-issues-vu");
  assert.equal(issueBatchId("nz"), "ra-issues-nz");
});

