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
check("named source needs a reference", /source URL/.test(rapid.validateObservation({
  ...valid,
  observationBasis: "named_public_source",
  sourceTitle: "Vanuatu Council of Churches directory",
})));
check("denomination wording needs a basis", /wording came from/.test(rapid.validateObservation({
  ...valid,
  denominationRaw: "Example Fellowship",
  denominationLabelBasis: "unknown",
})));

const payload = rapid.observationPayload({ ...valid, directObservation: "  Sign and regular service times displayed.  " });
check("payload trims direct observation", payload.direct_observation === "Sign and regular service times displayed.");
check("empty optional values are omitted", payload.source_title === undefined);

console.log(failures === 0 ? "ALL RAPID ENTRY TESTS PASSED" : `${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
