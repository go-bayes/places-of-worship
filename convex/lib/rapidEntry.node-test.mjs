import assert from "node:assert/strict";
import test from "node:test";
import {
  assertRapidCandidateContext,
  assertRapidSubmissionId,
  assertVanuatuPoint,
  deriveCurrentObservation,
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
