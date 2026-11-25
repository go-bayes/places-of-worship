// merge-review repairs to stage 1 of the deep-time dates (pull request #240):
// the date rules by purpose, and the size of the confirmed-dates list
import assert from "node:assert/strict";
import test from "node:test";

import { assertEvidenceDraftSubmission } from "./limits.ts";
import { assertFunctionChain } from "./functionChain.ts";

const VU_FLOOR = 1600;
const base = {
  observation_contract_version: "guided_observation_v1",
  source_title: "Survey",
  evidence_note: "The survey records the place.",
  source_url_or_file: "https://example.org/survey",
};

test("finding 2: an imagery capture date keeps the observation range; only a documentary source's date may fall before 1000", () => {
  for (const source_type of ["street_imagery", "aerial_imagery", "aerial_or_street_imagery", "field_observation"]) {
    const draft = { ...base, source_type, source_date_or_capture_date: "0920-05", confirmed_dates: [{ date: "0920-05", confirmed_by: "contributor" }] };
    assert.throws(() => assertEvidenceDraftSubmission(draft, false, VU_FLOOR), /from 1000 to 2100/, source_type);
  }
  const documentary = { ...base, source_type: "historic_map", source_date_or_capture_date: "0920-05", confirmed_dates: [{ date: "0920-05", confirmed_by: "contributor" }] };
  assert.doesNotThrow(() => assertEvidenceDraftSubmission(documentary, false, VU_FLOOR));
});

test("finding 2: an unversioned record meets the date rules on a fresh submission", () => {
  assert.throws(() => assertEvidenceDraftSubmission({ source_type: "field_observation", source_date_or_capture_date: "0000-01-01" }, false, VU_FLOOR), /from 1000 to 2100/);
  assert.throws(() => assertEvidenceDraftSubmission({ source_type: "other", lifecycle_event: "first_seen", lifecycle_date: "1590" }, false, VU_FLOOR), /lifecycle date 1590 is earlier than 1600/);
  assert.doesNotThrow(() => assertEvidenceDraftSubmission({ source_type: "other", lifecycle_event: "first_seen", lifecycle_date: "1700" }, false, VU_FLOOR));
});

test("finding 5: a chain may confirm every date it can hold", () => {
  const year = (n) => String(900 + n).padStart(4, "0");
  const chain = {
    contract_version: "function_chain_v1",
    start: { label: "Mission", date: { mode: "between", not_earlier_than: year(0), not_later_than: year(1) } },
    changes: Array.from({ length: 20 }, (_, i) => ({ change: "building_rebuilt", date: { mode: "between", not_earlier_than: year(2 + 2 * i), not_later_than: year(3 + 2 * i) } })),
  };
  assert.doesNotThrow(() => assertFunctionChain(chain, "2026-09-02", 1));
  const confirmed = { ...chain, confirmed_dates: Array.from({ length: 42 }, (_, i) => ({ date: year(i), confirmed_by: "contributor" })) };
  assert.doesNotThrow(() => assertFunctionChain(confirmed, "2026-09-02", 1000));
});

test("round 2, finding 5: a capture timestamp is checked in full, and only a documentary source takes the early exception", () => {
  assert.throws(() => assertEvidenceDraftSubmission({ source_type: "field_observation", source_date_or_capture_date: "2020-01-01Tgarbage" }, false, VU_FLOOR), /from 1000 to 2100|timestamp/);
  assert.doesNotThrow(() => assertEvidenceDraftSubmission({ source_type: "field_observation", source_date_or_capture_date: "2020-01-01T03:38:13.597Z" }, false, VU_FLOOR));
  assert.throws(() => assertEvidenceDraftSubmission({ source_date_or_capture_date: "0920", confirmed_dates: [{ date: "0920", confirmed_by: "contributor" }] }, false, VU_FLOOR), /from 1000 to 2100/);
});
