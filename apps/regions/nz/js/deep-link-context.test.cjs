const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// loads the actual portal class (no bootstrap) and checks the public-map
// hand-off parser: ?revise=1 and ?report_issue=1 are read the same way,
// coordinates are validated, and the osm type defaults to node only when
// an osm id is present
const storage = {
  getItem() { return null; },
  setItem() {},
  removeItem() {},
  key() { return null; },
  get length() { return 0; },
};
const window = {
  __POW_TEST_NO_BOOTSTRAP__: true,
  location: { search: "", pathname: "/apps/regions/nz/verification.html" },
  localStorage: storage,
  sessionStorage: storage,
};
const context = vm.createContext({
  window,
  document: { getElementById() { return null; } },
  localStorage: storage,
  sessionStorage: storage,
  URLSearchParams,
  Map,
  Set,
  Date,
  Number,
  String,
  Boolean,
  Object,
  Array,
  Math,
  JSON,
  RegExp,
  Intl,
  console,
  setTimeout,
  clearTimeout,
});
for (const file of ["occupancy-contract.js", "verification-map.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, file), "utf8"), context, { filename: file });
}
const parse = window.NzVerificationMap.deepLinkContextFromParams;
const assert = (condition, message) => { if (!condition) throw new Error(message); };

assert(parse(new URLSearchParams("")) === null, "No hand-off params must parse to null.");
assert(parse(new URLSearchParams("revise=0&lat=1&lng=2")) === null, "revise=0 is not a hand-off.");

const revise = parse(new URLSearchParams("revise=1&name=St+Mary%27s&lat=-41.286500&lng=174.776200&osm_type=way&osm_id=12345"));
assert(revise.mode === "revise", "revise=1 must parse as the revise mode.");
assert(revise.name === "St Mary's", "The name must be decoded and trimmed.");
assert(revise.hasCoords && revise.latitude === -41.2865 && revise.longitude === 174.7762, "Coordinates must parse as numbers.");
assert(revise.osmType === "way" && revise.osmId === "12345", "The osm type and id must be carried.");

const bare = parse(new URLSearchParams("revise=1&lat=-41.2865&lng=174.7762&osm_id=99"));
assert(bare.osmType === "node", "An osm id without a type defaults to node, as the context dots do.");
assert(bare.name === "", "A missing name is an empty string, not undefined.");

const noOsm = parse(new URLSearchParams("revise=1&lat=-41.2865&lng=174.7762&osm_type=way"));
assert(noOsm.osmType === undefined && noOsm.osmId === undefined, "An osm type without an id is dropped.");

const badCoords = parse(new URLSearchParams("revise=1&name=X&lat=abc&lng=200"));
assert(badCoords.mode === "revise" && badCoords.hasCoords === false, "Bad coordinates keep the mode but mark hasCoords false.");

const issue = parse(new URLSearchParams("report_issue=1&name=Old+Chapel&lat=-36.8&lng=174.7&site_id=site-1&osm_id=7"));
assert(issue.mode === "report_issue" && issue.siteId === "site-1" && issue.osmId === "7" && issue.osmType === "node", "report_issue=1 keeps its fields.");

const both = parse(new URLSearchParams("report_issue=1&revise=1&lat=-36.8&lng=174.7"));
assert(both.mode === "revise", "When both flags are set the revise flow wins.");

console.log("deep-link context: 9 checks passed");
