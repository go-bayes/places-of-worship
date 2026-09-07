import assert from "node:assert/strict";
import test from "node:test";
import {
  acceptedPoint,
  assertLocationOutcome,
  locationOutcomeColumns,
  originalPoint,
  pinMoved,
} from "./locationOutcome.ts";

const moved = {
  geometry: { type: "Point", coordinates: [168.3201, -17.7401] },
  source_context: { issue_report: { original_point: [168.3, -17.74] } },
};
const unmoved = {
  geometry: { type: "Point", coordinates: [168.3, -17.74] },
  source_context: { issue_report: { original_point: [168.3, -17.74] } },
};
const nomination = { geometry: { type: "Point", coordinates: [168.31, -17.75] }, source_context: {} };

test("only a revision of an existing record has an original point", () => {
  assert.deepEqual(originalPoint(moved), [168.3, -17.74]);
  assert.equal(originalPoint(nomination), undefined);
  assert.equal(pinMoved(moved), true);
  assert.equal(pinMoved(unmoved), false);
  assert.equal(pinMoved(nomination), false);
});

test("accepting a moved pin for export needs a location outcome", () => {
  assert.throws(() => assertLocationOutcome(moved, { decision_status: "accepted_for_export" }), /moved the pin/);
  assert.doesNotThrow(() => assertLocationOutcome(moved, { decision_status: "accepted_for_export", location_outcome: "accept_moved_point" }));
  assert.doesNotThrow(() => assertLocationOutcome(moved, { decision_status: "needs_more_evidence" }));
  assert.doesNotThrow(() => assertLocationOutcome(unmoved, { decision_status: "accepted_for_export" }));
});

test("an outcome on a task without an original point is refused", () => {
  assert.throws(() => assertLocationOutcome(nomination, { decision_status: "accepted_for_export", location_outcome: "uncertain" }), /existing record/);
  assert.throws(() => assertLocationOutcome(moved, { decision_status: "rejected", location_outcome: "somewhere_else" }), /recognised/);
});

test("the accepted point follows the ruling", () => {
  assert.deepEqual(acceptedPoint(moved, "accept_moved_point"), [168.3201, -17.7401]);
  assert.deepEqual(acceptedPoint(moved, "keep_original_point"), [168.3, -17.74]);
  assert.equal(acceptedPoint(moved, "uncertain"), undefined);
  assert.equal(acceptedPoint(moved, undefined), undefined);
});

test("the export columns carry the ruling and both points, blank otherwise", () => {
  assert.deepEqual(locationOutcomeColumns(moved, "keep_original_point"), {
    location_outcome: "keep_original_point",
    original_latitude: -17.74,
    original_longitude: 168.3,
    accepted_latitude: -17.74,
    accepted_longitude: 168.3,
  });
  assert.deepEqual(locationOutcomeColumns(nomination, undefined), {
    location_outcome: "",
    original_latitude: "",
    original_longitude: "",
    accepted_latitude: "",
    accepted_longitude: "",
  });
  assert.equal(locationOutcomeColumns(undefined, undefined).accepted_latitude, "");
});
