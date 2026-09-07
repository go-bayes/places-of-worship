import assert from "node:assert/strict";
import test from "node:test";
import {
  PROBABLE_SAME_AS_MAX,
  assertProbableSameAsInputs,
  probableSameAsCheck,
  probableSameAsReciprocalNote,
} from "./probableSameAs.ts";

test("an absent or empty link list passes", () => {
  assert.doesNotThrow(() => assertProbableSameAsInputs(undefined));
  assert.doesNotThrow(() => assertProbableSameAsInputs([]));
  assert.doesNotThrow(() => assertProbableSameAsInputs([{ task_id: "vu-a", name: "Old", distance_m: 42 }]));
});

test("a link needs a task id, cannot repeat, and cannot point at the entry itself", () => {
  assert.throws(() => assertProbableSameAsInputs([{ task_id: " " }]), /task id/);
  assert.throws(() => assertProbableSameAsInputs([{ task_id: "vu-a" }, { task_id: "vu-a" }]), /twice/);
  assert.throws(() => assertProbableSameAsInputs([{ task_id: "vu-new" }], "vu-new"), /itself/);
});

test("the list and each distance are bounded", () => {
  const many = Array.from({ length: PROBABLE_SAME_AS_MAX + 1 }, (_, i) => ({ task_id: `vu-${i}` }));
  assert.throws(() => assertProbableSameAsInputs(many), /at most/);
  assert.throws(() => assertProbableSameAsInputs([{ task_id: "vu-a", distance_m: -1 }]), /distance/);
  assert.throws(() => assertProbableSameAsInputs([{ task_id: "vu-a", distance_m: Number.NaN }]), /distance/);
});

test("the reviewer check names every linked record and keeps the entries separate", () => {
  const check = probableSameAsCheck([
    { task_id: "vu-a", name: "Presbyterian Church Fresh Wota", distance_m: 38, relation: "probable_same_place", linked_at: 1 },
    { task_id: "vu-b", relation: "probable_same_place", linked_at: 1 },
  ]);
  assert.equal(check.check_id, "contributor_probable_same_place");
  assert.equal(check.severity, "warning");
  assert.match(check.message, /Presbyterian Church Fresh Wota \(task vu-a, 38 m away\)/);
  assert.match(check.message, /an unnamed record \(task vu-b\)/);
  assert.match(check.message, /stay separate/);
});

test("the earlier record's note names the new entry", () => {
  const note = probableSameAsReciprocalNote({ task_id: "vu-candidate-1", name: "Fresh Wota church" });
  assert.match(note, /task vu-candidate-1/);
  assert.match(note, /"Fresh Wota church"/);
});
