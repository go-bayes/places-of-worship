const fs = require("fs");
const path = require("path").join(__dirname, "occupancy-contract.js");
global.window = {};
eval(fs.readFileSync(path, "utf8"));
const occupancy = global.window.PowOccupancy;

let failures = 0;
function check(name, condition) {
  if (!condition) {
    failures += 1;
    console.log(`FAIL: ${name}`);
  } else {
    console.log(`ok: ${name}`);
  }
}

const REFERENCE = "2010-06-01";
const TASK_POINT = { latitude: -17.74, longitude: 168.32 };
const DISTINCT = {
  contract_version: "location_assertion_v1",
  mode: "approximate_area",
  basis: "address_or_locality",
  latitude: -17.75,
  longitude: 168.33,
  uncertainty_radius_m: 500,
  source_wording: "The 1989 list gives only the village name.",
  confidence: "moderate",
  contributor_confirmed: true,
};

// a dated period still in use at the observation date
const valid = {
  startMode: "known",
  startDate: "1954",
  startBasis: "founding_stated",
  endMode: "still_active",
  stillActiveAsof: REFERENCE,
  endBasis: "unknown",
  sameAsPin: true,
  confidence: "high",
  confidenceBasis: "A foundation plaque supplies the year.",
  sourceBasis: "inscription_or_document_observed",
  sourceTitle: "Foundation plaque at the west entrance",
  sourceAccount: "The plaque records the founding in 1954.",
  privacyFlag: "needs_review",
};
const closed = {
  ...valid,
  endMode: "known",
  endDate: "1980",
  endBasis: "closure_stated",
  endReason: "closed",
  stillActiveAsof: "",
};

const v = (values, reference = REFERENCE) => occupancy.validateSegment(values, reference);

// mode ⇒ dates
check("known start still active validates", v(valid) === "");
check("start mode required", /how the start is known/.test(v({ ...valid, startMode: "" })));
check("known start needs a date", /start date/.test(v({ ...valid, startDate: "" })));
check("bad calendar date fails", /start date/.test(v({ ...valid, startDate: "1954-02-30" })));
check("date before 1600 fails", /1600 onward/.test(v({ ...valid, startDate: "1599" })));
check("between needs both bounds", /latest possible start/.test(v({ ...valid, startMode: "between", startNotEarlierThan: "1950", startNotLaterThan: "" })));
check("between validates with ordered bounds", v({ ...valid, startMode: "between", startNotEarlierThan: "1950", startNotLaterThan: "1956" }) === "");
check("reversed start bounds fail", /earliest possible start must not be after/.test(v({ ...valid, startMode: "between", startNotEarlierThan: "1960", startNotLaterThan: "1956" })));
check("by needs the latest date only", v({ ...valid, startMode: "by", startNotLaterThan: "1956" }) === "");
check("by without a date fails", /latest possible start/.test(v({ ...valid, startMode: "by", startNotLaterThan: "" })));
check("unknown start validates without dates", v({ ...valid, startMode: "unknown", startBasis: "unknown" }) === "");
check("end between reversed fails", /earliest possible end must not be after/.test(v({ ...closed, endMode: "between", endNotEarlierThan: "1985", endNotLaterThan: "1980" })));
check("end after validates", v({ ...closed, endMode: "after", endNotEarlierThan: "1980" }) === "");

// basis asymmetry
check("dated start needs a dated basis", /how the start is known/.test(v({ ...valid, startBasis: "unknown" })));
check("unknown start forces basis unknown in the payload", occupancy.payload({ ...valid, startMode: "unknown", startBasis: "founding_stated" }).start_basis === "unknown");
check("dated end needs a dated basis", /how the end is known/.test(v({ ...closed, endBasis: "unknown" })));
check("still-active end forces basis unknown in the payload", occupancy.payload({ ...valid, endBasis: "closure_stated" }).end_basis === "unknown");
check("dated end needs a reason", /why the period ended/.test(v({ ...closed, endReason: "" })));
check("still-active carries no reason in the payload", occupancy.payload({ ...valid, endReason: "closed" }).end_reason === undefined);
check("relocation cannot name a successor", /successor identifier/.test(v({ ...closed, endReason: "relocated", successorSiteId: "nz-0001" })));

// still active as-of ≤ reference; every date ≤ reference
check("still-active as-of after the reference fails", /cannot be later than/.test(v({ ...valid, stillActiveAsof: "2010-06-02" })));
check("still-active as-of needs a date", /still-in-use date/.test(v({ ...valid, stillActiveAsof: "" })));
check("a start after the reference fails", /cannot be later than/.test(v({ ...valid, startDate: "2011" })));
check("a partial reference year includes its months", v({ ...valid, startDate: "2010-12", stillActiveAsof: "2010-12" }, "2010") === "");

// ordering within the period
check("end before start fails", /end before it begins/.test(v({ ...closed, startDate: "1990", endDate: "1980" })));
check("overlapping windows are allowed when not inverted", v({ ...closed, startMode: "between", startNotEarlierThan: "1950", startNotLaterThan: "1960", startDate: "", endMode: "between", endNotEarlierThan: "1955", endNotLaterThan: "1965", endDate: "" }) === "");

// undated period needs its wording
check("wholly undated period needs an uncertainty note", /uncertainty note/.test(v({ ...valid, startMode: "unknown", startBasis: "unknown", endMode: "unknown", stillActiveAsof: "", uncertaintyNote: "short" })));
check("wholly undated period validates with a note", v({ ...valid, startMode: "unknown", startBasis: "unknown", endMode: "unknown", stillActiveAsof: "", uncertaintyNote: "The elders remember services but no one can date them." }) === "");

// location
check("distinct location needs an assertion", /Place this period on the map/.test(v({ ...valid, sameAsPin: false, location: null })));
check("distinct location with an assertion validates", v({ ...valid, sameAsPin: false, location: DISTINCT }) === "");

// provenance
check("confidence required", /confidence/.test(v({ ...valid, confidence: "" })));
check("confidence basis required", /confidence rests on/.test(v({ ...valid, confidenceBasis: " " })));
check("source basis required", /source basis/.test(v({ ...valid, sourceBasis: "" })));
check("source title required", /Name the source/.test(v({ ...valid, sourceTitle: "" })));
check("named public source needs a locator", /source URL/.test(v({ ...valid, sourceBasis: "named_public_source" })));
check("source account needs 12 characters", /at least 12/.test(v({ ...valid, sourceAccount: "plaque" })));
check("privacy flag required", /privacy/.test(v({ ...valid, privacyFlag: "" })));
check("over-long text fails", /2000 characters/.test(v({ ...valid, uncertaintyNote: "x".repeat(2001) })));

// "around Y"
const around = occupancy.expandAround(1954);
check("expandAround gives Y-1..Y+1 as strings", around.not_earlier_than === "1953" && around.not_later_than === "1955");
const aroundPayload = occupancy.payload({ ...valid, startAround: true });
check("around compiles a known year to between", aroundPayload.start_mode === "between" && aroundPayload.start_not_earlier_than === "1953" && aroundPayload.start_not_later_than === "1955" && aroundPayload.start_date === undefined);
check("around is ignored for a month date", occupancy.payload({ ...valid, startDate: "1954-03", startAround: true }).start_mode === "known");
check("describeBounds names the around year", occupancy.describeBounds({ ...valid, startAround: true }) === "Began 1953–1955 (around 1954, founding stated); still in use as of 2010-06-01.");
check("describeBounds for a closed period", occupancy.describeBounds(closed) === "Began 1954 (founding stated); ended 1980 (closure stated, closed).");
check("describeBounds notes a different place", /at a different place\.$/.test(occupancy.describeBounds({ ...closed, sameAsPin: false, location: DISTINCT })));
check("describeBounds for by and after", occupancy.describeBounds({ ...closed, startMode: "by", startNotLaterThan: "1956", startBasis: "first_seen_only", endMode: "after", endNotEarlierThan: "1980", endBasis: "last_seen_only", endReason: "unknown" }) === "Began by 1956 (first seen only); ended after 1980 (last seen only, reason unknown).");

// payload shape
const payload = occupancy.payload({ ...valid, segmentIndex: 2, sourceAccount: "  The plaque records the founding in 1954.  ", sourceReference: "", uncertaintyNote: " " });
check("payload carries the contract version", payload.contract_version === "occupancy_v1");
check("payload keeps the segment index", payload.segment_index === 2);
check("payload trims text", payload.source_account === "The plaque records the founding in 1954.");
check("payload omits blank optionals", !("source_reference" in payload) && !("uncertainty_note" in payload) && !("end_date" in payload) && !("end_reason" in payload));
check("payload records same_as_task_point without a location", payload.location_relation === "same_as_task_point" && !("location" in payload));
check("payload embeds a distinct location", occupancy.payload({ ...valid, sameAsPin: false, location: DISTINCT }).location === DISTINCT && occupancy.payload({ ...valid, sameAsPin: false, location: DISTINCT }).location_relation === "distinct");
const expectedKeys = ["contract_version", "segment_index", "start_mode", "start_date", "start_basis", "end_mode", "end_basis", "still_active_asof", "location_relation", "confidence", "confidence_basis", "source_basis", "source_title", "source_account", "privacy_flag"];
check("payload has exactly the expected keys", JSON.stringify(Object.keys(payload).sort()) === JSON.stringify(expectedKeys.sort()));
check("payload drops stale fields the mode does not use", !("start_not_later_than" in occupancy.payload({ ...valid, startNotLaterThan: "1990" })));

// set rules
const first = { ...closed, endReason: "relocated" };
const second = { ...valid, startDate: "1981", sameAsPin: false, location: DISTINCT };
check("one valid period passes", occupancy.validateSet([valid], REFERENCE, TASK_POINT) === "");
check("empty set fails", /at least one/.test(occupancy.validateSet([], REFERENCE, TASK_POINT)));
check("set errors name the period", /^Period 2: /.test(occupancy.validateSet([closed, { ...valid, startDate: "" }], REFERENCE, TASK_POINT)));
check("still active must be last", /must be the last/.test(occupancy.validateSet([valid, closed], REFERENCE, TASK_POINT)));
check("overlapping cores fail", /overlap/.test(occupancy.validateSet([closed, { ...valid, startDate: "1975" }], REFERENCE, TASK_POINT)));
check("relocation followed by a distinct place passes", occupancy.validateSet([first, second], REFERENCE, TASK_POINT) === "");
check("relocation followed by the same pin fails", /different place/.test(occupancy.validateSet([first, { ...valid, startDate: "1981" }], REFERENCE, TASK_POINT)));
check("relocation as the last period fails", /following period/.test(occupancy.validateSet([first], REFERENCE, TASK_POINT)));
check("more than 20 periods fail", /at most 20/.test(occupancy.validateSet(new Array(21).fill(closed), REFERENCE, TASK_POINT)));

console.log(failures === 0 ? "ALL OCCUPANCY CONTRACT TESTS PASSED" : `${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
