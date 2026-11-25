// deep-time stage 1, ruling 7 (option c): the floor stays in the backend and
// a record may carry a list of confirmed dates, each the date as written and
// who confirmed it. these tests cover the list and the four checks that
// become stricter for new records (brief section 9)
import assert from "node:assert/strict";
import fs from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { assertEvidenceDraftSubmission, assertRapidCurrentObservation } from "./limits.ts";
import { assertConfirmedDates, assertConfirmers, confirmersForRoles } from "./partialDates.ts";
import { assertFunctionChain } from "./functionChain.ts";
import { assertOccupancySegment } from "./occupancies.ts";
import { dateFloorYear } from "./countryYears.ts";
import { confirmedDateProblems, curatorConfirmations, validateImportRow } from "./importRow.ts";
import { segmentFromImportRow } from "./occupancyImport.ts";
import { validateAgentReviewBundle } from "./agentIntake.ts";

// evidenceVersions.ts imports extensionless local modules, which convex
// resolves when bundling; resolve them here as evidenceVersions.node-test.mjs does
registerHooks({ resolve(specifier, context, nextResolve) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) { for (const ext of [".js", ".ts"]) { const candidate = new URL(`${specifier}${ext}`, context.parentURL); if (fs.existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context); } } return nextResolve(specifier, context); } });
const { evidenceContentFromRow, occupancyContentFromRow } = await import("./evidenceVersions.ts");

const NZ = dateFloorYear("NZ");
const CZ = dateFloorYear("CZ");
const confirm = (...dates) => dates.map((date) => ({ date, confirmed_by: "contributor" }));

const guided = {
  observation_contract_version: "guided_observation_v1",
  source_title: "Parish history",
  evidence_note: "The history records the founding.",
  source_type: "other",
  source_url_or_file: "https://example.org/history",
};

test("the list holds dates the record carries, once each, and is omitted when empty", () => {
  assert.doesNotThrow(() => assertConfirmedDates(undefined, ["1500"]));
  assert.throws(() => assertConfirmedDates([], ["1500"]), /omit the empty list/);
  assert.throws(() => assertConfirmedDates(confirm("1501"), ["1500"]), /matches no date in this record/);
  assert.throws(() => assertConfirmedDates(confirm("1500", "1500"), ["1500"]), /listed twice/);
  assert.throws(() => assertConfirmedDates(confirm("920"), ["920"]), /four digits, as 0920/);
  assert.throws(() => assertConfirmedDates(confirm("0000"), ["0000"]), /four digits/);
  assert.throws(() => assertConfirmedDates([{ date: "1500", confirmed_by: "reviewer" }], ["1500"]), /who confirmed it/);
  assert.throws(() => assertConfirmedDates([{ date: "1500", confirmed_by: "agent" }], ["1500"], ["contributor"]), /confirmed by an agent/);
});

test("a person names a contributor; a curator, admin or service account may also name a curator; nobody here names an agent", () => {
  assert.deepEqual(confirmersForRoles(["ra"]), ["contributor"]);
  assert.deepEqual(confirmersForRoles(["reviewer"]), ["contributor"]);
  assert.deepEqual(confirmersForRoles(["curator"]), ["contributor", "curator"]);
  assert.deepEqual(confirmersForRoles(["service"]), ["contributor", "curator"]);
  assert.throws(() => assertConfirmers([{ date: "1500", confirmed_by: "curator" }], confirmersForRoles(["ra"])), /confirmed by a curator/);
  assert.throws(() => assertConfirmers([{ date: "1500", confirmed_by: "agent" }], confirmersForRoles(["admin"])), /confirmed by an agent/);
});

test("the lifecycle date meets the country's floor unless the draft confirms it (ruling 5)", () => {
  const lifecycle = { ...guided, lifecycle_event: "site_opened", lifecycle_date: "1590", lifecycle_date_precision: "year" };
  assert.throws(() => assertEvidenceDraftSubmission(lifecycle, false, NZ), /lifecycle date 1590 is earlier than 1600/);
  assert.doesNotThrow(() => assertEvidenceDraftSubmission({ ...lifecycle, confirmed_dates: confirm("1590") }, false, NZ));
  assert.doesNotThrow(() => assertEvidenceDraftSubmission(lifecycle, false, dateFloorYear("UK")));
  // a year below 1000 takes four digits and, below every floor, a confirmation
  const early = { ...lifecycle, lifecycle_date: "0920" };
  assert.throws(() => assertEvidenceDraftSubmission(early, false, CZ), /earlier than 1000/);
  assert.doesNotThrow(() => assertEvidenceDraftSubmission({ ...early, confirmed_dates: confirm("0920") }, false, CZ));
  assert.throws(() => assertEvidenceDraftSubmission({ ...lifecycle, lifecycle_date: "920" }, false, CZ), /four digits, as 0920/);
  // the year 0000 is refused in every form, confirmed or not
  for (const date of ["0000", "0000-05", "0000-05-01"]) {
    assert.throws(() => assertEvidenceDraftSubmission({ ...lifecycle, lifecycle_date: date }, false, 1), /lifecycle date must be a real date/, date);
  }
});

test("a documentary source's date below 1000 takes a confirmation; a field observation keeps the range (rulings 3 and 4)", () => {
  const bede = { ...guided, source_date_or_capture_date: "0731" };
  assert.throws(() => assertEvidenceDraftSubmission(bede, false, NZ), /source or capture date 0731 is earlier than 1000/);
  assert.doesNotThrow(() => assertEvidenceDraftSubmission({ ...bede, confirmed_dates: confirm("0731") }, false, NZ));
  assert.throws(() => assertEvidenceDraftSubmission({ ...guided, source_date_or_capture_date: "2101" }, false, NZ), /from 1000 to 2100/);
  // a full observation date outside the range is refused, as a year was before
  assert.throws(() => assertEvidenceDraftSubmission({ ...guided, source_date_or_capture_date: "2105-01-01" }, false, NZ), /from 1000 to 2100/);
  const field = { ...guided, source_type: "field_observation", source_date_or_capture_date: "0920-05-01" };
  assert.throws(() => assertEvidenceDraftSubmission({ ...field, confirmed_dates: confirm("0920-05-01") }, false, NZ), /field observation date/);
});

test("a rapid current observation refuses a date outside 1000 to 2100 outright", () => {
  const rapid = {
    observation_contract_version: "rapid_current_v1",
    source_type: "field_observation",
    source_title: "RA field observation",
    source_date_or_capture_date: "2026-08-26",
    action: "confirm_current_record",
    change_class: "uncertain",
    existence_status: "present",
    worship_use_status: "confirmed_worship",
    current_observation_status: "currently_used_for_worship",
    current_observation_basis: "direct_field_observation",
  };
  assert.doesNotThrow(() => assertRapidCurrentObservation(rapid));
  for (const date of ["0920-05-01", "0000-01-01", "1945-02-30"]) {
    assert.throws(() => assertRapidCurrentObservation({ ...rapid, source_date_or_capture_date: date }), /valid YYYY-MM-DD observation date/, date);
  }
});

test("a period and a function chain pass the floor with a confirmed date", () => {
  const segment = {
    contract_version: "occupancy_v1",
    segment_index: 0,
    start_mode: "between",
    start_not_earlier_than: "0590",
    start_not_later_than: "0597",
    start_basis: "founding_stated",
    end_mode: "still_active",
    end_basis: "unknown",
    still_active_asof: "2020-01-01",
    location_relation: "same_as_task_point",
    confidence: "moderate",
    confidence_basis: "Bede's account.",
    source_basis: "named_public_source",
    source_title: "Bede, Ecclesiastical History",
    source_reference: "https://example.org/bede",
    source_account: "Bede describes the church as already standing in 597.",
    privacy_flag: "clear",
  };
  const UK = dateFloorYear("UK");
  assert.throws(() => assertOccupancySegment(segment, "2026-09-02", UK), /earliest possible start 0590 is earlier than 1000/);
  assert.throws(() => assertOccupancySegment({ ...segment, confirmed_dates: confirm("0590") }, "2026-09-02", UK), /latest possible start 0597 is earlier than 1000/);
  assert.doesNotThrow(() => assertOccupancySegment({ ...segment, confirmed_dates: confirm("0590", "0597") }, "2026-09-02", UK));
  const chain = {
    contract_version: "function_chain_v1",
    start: { label: "Roman Christian", date: { mode: "known", date: "0597" } },
    changes: [{ change: "denomination_changed", label: "Church of England", date: { mode: "known", date: "1534" } }],
  };
  assert.throws(() => assertFunctionChain(chain, "2026-09-02", UK), /the date 0597 is earlier than 1000/);
  assert.doesNotThrow(() => assertFunctionChain({ ...chain, confirmed_dates: confirm("0597") }, "2026-09-02", UK));
  assert.throws(() => assertFunctionChain({ ...chain, confirmed_dates: confirm("0598") }, "2026-09-02", UK), /matches no date in this record/);
});

test("the import file carries the curator's confirmation for each such row", () => {
  const base = { row_number: 1, name: "St Example", country_code: "VU", source_locator: "entry 1", containing_area: "Efate", claim_hash: "0", first_date: "1590" };
  assert.deepEqual(validateImportRow({ ...base, confirmed_dates: ["1590"] }, "VU"), []);
  assert.deepEqual(confirmedDateProblems({ ...base, confirmed_dates: ["1591"] }), ["The confirmed date 1591 matches no date in this row."]);
  assert.deepEqual(curatorConfirmations(["1590", "1700"], [undefined, "1590"]), [{ date: "1590", confirmed_by: "curator" }]);
  assert.equal(curatorConfirmations(["1700"], ["1590"]), undefined, "no list when no date of the record is confirmed");
  const read = segmentFromImportRow(
    { segment_index: 0, start_mode: "known", start_date: "1590", start_basis: "founding_stated", end_mode: "still_active", still_active_asof: "2010", confirmed_dates: ["1590"] },
    { sourceTitle: "Atlas", sourceLocator: "entry 1", taskPoint: { latitude: -17.7, longitude: 168.3 }, privacyFlag: "clear" },
  );
  assert.deepEqual(read.segment.confirmed_dates, [{ date: "1590", confirmed_by: "curator" }]);
  const plain = segmentFromImportRow(
    { segment_index: 0, start_mode: "known", start_date: "1890", start_basis: "founding_stated", end_mode: "still_active", still_active_asof: "2010" },
    { sourceTitle: "Atlas", sourceLocator: "entry 1", taskPoint: { latitude: -17.7, longitude: 168.3 }, privacyFlag: "clear" },
  );
  assert.equal(Object.hasOwn(plain.segment, "confirmed_dates"), false, "a segment without a confirmed date carries no list");
});

test("an agent's dated claim meets the same floor, and an agent may confirm it", () => {
  const fixture = JSON.parse(fs.readFileSync(new URL("../../scripts/agent_research/fixtures/internal-review-bundle.json", import.meta.url), "utf8"));
  const withDate = (mutate) => {
    const value = structuredClone(fixture);
    Object.assign(value.dossier.claims[0], { date_start: "1590", date_end: null, date_precision: "year" });
    mutate(value.dossier.claims[0]);
    return value;
  };
  const below = withDate(() => {});
  assert.throws(() => validateAgentReviewBundle(below, JSON.stringify(below)), /date_start is earlier than 1600/);
  const confirmed = withDate((claim) => { claim.confirmed_dates = [{ date: "1590", confirmed_by: "agent" }]; });
  assert.doesNotThrow(() => validateAgentReviewBundle(confirmed, JSON.stringify(confirmed)));
  const byPerson = withDate((claim) => { claim.confirmed_dates = [{ date: "1590", confirmed_by: "contributor" }]; });
  assert.throws(() => validateAgentReviewBundle(byPerson, JSON.stringify(byPerson)), /invalid constant/);
  const orphan = withDate((claim) => { claim.confirmed_dates = [{ date: "1591", confirmed_by: "agent" }]; });
  assert.throws(() => validateAgentReviewBundle(orphan, JSON.stringify(orphan)), /matches no date/);
});

test("a record without a confirmed date hashes as before", () => {
  const row = { evidence_draft_id: "d", task_id: "t", source_title: "Parish history", lifecycle_date: "1890" };
  assert.deepEqual(evidenceContentFromRow({ ...row, confirmed_dates: undefined }), evidenceContentFromRow(row));
  assert.equal(Object.hasOwn(evidenceContentFromRow(row), "confirmed_dates"), false);
  const occupancy = { occupancy_id: "o", segment_index: 0, start_date: "1890" };
  assert.deepEqual(occupancyContentFromRow({ ...occupancy, confirmed_dates: undefined }), occupancyContentFromRow(occupancy));
  // a record that carries the list keeps it in its evidence content
  assert.deepEqual(evidenceContentFromRow({ ...row, confirmed_dates: confirm("1890") }).confirmed_dates, confirm("1890"));
});
