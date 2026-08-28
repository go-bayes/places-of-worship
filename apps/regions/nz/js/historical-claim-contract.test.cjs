const fs = require("fs");
const path = require("path").join(__dirname, "historical-claim-contract.js");
global.window = {};
eval(fs.readFileSync(path, "utf8"));
const history = global.window.PowHistoricalClaim;

let failures = 0;
function check(name, condition) {
  if (!condition) {
    failures += 1;
    console.log(`FAIL: ${name}`);
  } else {
    console.log(`ok: ${name}`);
  }
}

const valid = {
  claimKind: "structure",
  claimTiming: "event",
  claimText: "The structure was built",
  earliestSupportedDate: "1880",
  latestSupportedDate: "1890",
  continuesThroughObservation: false,
  confidence: "high",
  confidenceBasis: "A foundation plaque supplies the date interval.",
  sourceBasis: "inscription_or_document_observed",
  sourceTitle: "Foundation plaque at the west entrance",
  sourceAccount: "The plaque dates construction between 1880 and 1890.",
  privacyFlag: "needs_review",
};

check("bounded structure claim validates", history.validateHistoricalClaim(valid, "2026-08-28") === "");
check("partial year and month dates validate", history.isValidPartialDate("1880") && history.isValidPartialDate("1945-08"));
check("invalid calendar dates fail", !history.isValidPartialDate("1945-02-30"));
check("reversed bounds fail", /earliest supported date/.test(history.validateHistoricalClaim({ ...valid, earliestSupportedDate: "1900", latestSupportedDate: "1890" }, "2026-08-28")));
check("a partial reference year includes its supported months", history.validateHistoricalClaim({ ...valid, earliestSupportedDate: "2023-12", latestSupportedDate: "" }, "2023") === "");
check("a bound after the reference year fails", /evidence reference date/.test(history.validateHistoricalClaim({ ...valid, earliestSupportedDate: "2024", latestSupportedDate: "" }, "2023")));
check("open event fails", /Only a historical state/.test(history.validateHistoricalClaim({ ...valid, continuesThroughObservation: true, latestSupportedDate: "" }, "2026-08-28")));
check("open state validates", history.validateHistoricalClaim({ ...valid, claimTiming: "state", continuesThroughObservation: true, latestSupportedDate: "" }, "2026-08-28") === "");
check("unresolved war wording needs an uncertainty note", /dates remain unresolved/.test(history.validateHistoricalClaim({ ...valid, earliestSupportedDate: "", latestSupportedDate: "", uncertaintyNote: "" }, "2026-08-28")));
check("unresolved war wording can retain uncertainty", history.validateHistoricalClaim({ ...valid, earliestSupportedDate: "", latestSupportedDate: "", uncertaintyNote: "The source does not identify the war or support calendar-year bounds." }, "2026-08-28") === "");
check("named source needs a locator", /source URL/.test(history.validateHistoricalClaim({ ...valid, sourceBasis: "named_public_source" }, "2026-08-28")));

const payload = history.historicalClaimPayload({ ...valid, sourceAccount: "  Source wording retained.  " });
check("payload retains and trims the source account", payload.source_account === "Source wording retained.");
check("empty optional reference is omitted", payload.source_reference === undefined);

console.log(failures === 0 ? "ALL HISTORICAL CLAIM TESTS PASSED" : `${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
