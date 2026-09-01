const fs = require("fs");
const path = require("path").join(__dirname, "rapid-entry-contract.js");
global.window = {};
eval(fs.readFileSync(path, "utf8"));
const rapid = global.window.PowRapidEntry;

let failures = 0;
function check(name, condition) {
  if (!condition) {
    failures += 1;
    console.log(`FAIL: ${name}`);
  } else {
    console.log(`ok: ${name}`);
  }
}

check("local date uses YYYY-MM-DD", rapid.localIsoDate(new Date(2026, 7, 26)) === "2026-08-26");

const knownUuid = "123e4567-e89b-42d3-a456-426614174000";
check("native secure UUID is used", rapid.secureSubmissionId({
  getRandomValues() {},
  randomUUID: () => knownUuid,
}) === knownUuid);
check("secure randomness is mandatory", (() => {
  try {
    rapid.secureSubmissionId({});
    return false;
  } catch (error) {
    return /Secure browser randomness/.test(error.message);
  }
})());

const valid = {
  currentStatus: "currently_used_for_worship",
  observationBasis: "direct_field_observation",
  observedOn: "2026-08-26",
  privacyFlag: "needs_review",
};
check("minimal direct field observation validates", rapid.validateObservation(valid) === "");
check("future observation dates are rejected", /cannot be in the future/.test(rapid.validateObservation({ ...valid, observedOn: "2100-01-01" })));
check("existence choice is explicit", /Choose what/.test(rapid.validateObservation({ ...valid, currentStatus: "" })));
check("sensitivity choice is explicit", /sensitivity/.test(rapid.validateObservation({ ...valid, privacyFlag: "" })));
check("uncertainty needs an account", /remains uncertain/.test(rapid.validateObservation({ ...valid, currentStatus: "could_not_determine" })));
check("uncertainty error discloses the minimum length", /at least 12 characters/.test(rapid.validateObservation({ ...valid, currentStatus: "could_not_determine", uncertaintyNote: "unsure" })));
check("a full uncertainty note satisfies could-not-determine", rapid.validateObservation({
  ...valid,
  currentStatus: "could_not_determine",
  uncertaintyNote: "Locked gate; no signage visible from the road.",
}) === "");
check("named source needs a reference", /source URL/.test(rapid.validateObservation({
  ...valid,
  observationBasis: "named_public_source",
  sourceTitle: "Vanuatu Council of Churches directory",
})));
check("denomination wording with unknown provenance still submits", rapid.validateObservation({
  ...valid,
  denominationRaw: "Example Fellowship",
  denominationLabelBasis: "unknown",
}) === "");
check("unknown-provenance wording records basis unknown", rapid.observationPayload({
  ...valid,
  denominationRaw: "Example Fellowship",
  denominationLabelBasis: "unknown",
}).denomination_label_basis === "unknown");

const payload = rapid.observationPayload({ ...valid, directObservation: "  Sign and regular service times displayed.  " });
check("payload trims direct observation", payload.direct_observation === "Sign and regular service times displayed.");
check("empty optional values are omitted", payload.source_title === undefined);

const detailed = rapid.validateObservationDetailed({ ...valid, currentStatus: "" });
check("detailed validation names the field", detailed.field === "CurrentStatus" && /Choose what/.test(detailed.message));
check("detailed validation passes clean input", rapid.validateObservationDetailed(valid) === null);

const flaggedPartial = {
  observedOn: "2026-08-26",
  privacyFlag: "needs_review",
  flagForDiscussion: true,
  discussionNote: "This place is recorded twice on the map.",
};
check("flagged partial entry validates without status or basis", rapid.validateObservationDetailed(flaggedPartial, { flagForDiscussion: true }) === null);
check("flagged entry requires a discussion note", (() => {
  const error = rapid.validateObservationDetailed({ ...flaggedPartial, discussionNote: "" }, { flagForDiscussion: true });
  return error?.field === "DiscussionNote";
})());
check("flagged entry accepts the uncertainty note as its explanation", rapid.validateObservationDetailed({
  ...flaggedPartial,
  discussionNote: "",
  uncertaintyNote: "Two map dots may record the same church.",
}, { flagForDiscussion: true }) === null);
check("flagged payload carries the uncertainty-note explanation", rapid.observationPayload({
  ...flaggedPartial,
  discussionNote: "",
  uncertaintyNote: "Two map dots may record the same church.",
}, { flagForDiscussion: true }).uncertainty_note === "Two map dots may record the same church.");
check("flagged entry still validates dates", (() => {
  const error = rapid.validateObservationDetailed({ ...flaggedPartial, observedOn: "2100-01-01" }, { flagForDiscussion: true });
  return error?.field === "ObservedOn";
})());

const flaggedPayload = rapid.observationPayload(flaggedPartial, { flagForDiscussion: true });
check("flagged payload lands as could-not-determine", flaggedPayload.current_status === "could_not_determine");
check("flagged payload keeps a controlled basis", flaggedPayload.observation_basis === "other");
check("flagged payload carries the discussion note", /^For discussion: This place is recorded twice/.test(flaggedPayload.uncertainty_note));
check("flagged named source without title falls back to other", rapid.observationPayload({
  ...flaggedPartial,
  observationBasis: "named_public_source",
}, { flagForDiscussion: true }).observation_basis === "other");
check("unflagged payload is unchanged by the flag options", rapid.observationPayload({ ...valid, uncertaintyNote: "Original doubt." }).uncertainty_note === "Original doubt.");
check("flagged discussion appends after existing uncertainty", rapid.observationPayload({
  ...flaggedPartial,
  uncertaintyNote: "Original doubt.",
}, { flagForDiscussion: true }).uncertainty_note === "Original doubt.\nFor discussion: This place is recorded twice on the map.");

console.log(failures === 0 ? "ALL RAPID ENTRY TESTS PASSED" : `${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
