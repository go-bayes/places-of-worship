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
for (const file of ["occupancy-contract.js", "task-presentation.js", "verification-map.js"]) {
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

// w358707342 is a possible building; n358707342 is Unity Baptist Church.
// replay the public-map URL through the signed-in contributor hand-off.
const runtime = fs.readFileSync(path.join(__dirname, "../../_shared/region-map.js"), "utf8");
const linkStart = runtime.indexOf("function portalReviseHref(");
const linkContext = {
    URLSearchParams,
    CONTRIBUTE_ROUTES: { portal: { href: "../nz/verification.html?country=us" } },
    UNNAMED_PLACE: "Unnamed place",
};
vm.runInNewContext(runtime.slice(linkStart, runtime.indexOf("\n}\n", linkStart) + 2), linkContext);
const app = Object.create(window.NzVerificationMap.prototype);
const coords = [-80, 35];
const unity = { task_id: "unity-baptist", name: "Unity Baptist Church", matched_osm_id: "358707342", osm_object_type: "node" };
app.backendUser = { _id: "reviewer" };
app.tasks = [];
app.backendTasksById = new Map([[unity.task_id, unity]]);
let selection;
let opened;
app.selectTaskById = (taskId) => { selection = taskId; };
app.openContextIssueForm = (feature) => { opened = feature; };
function handOff(type) {
    const href = linkContext.portalReviseHref(type === "way" ? "Unnamed place" : unity.name, "35", "-80", {
        osm_type: type, osm_id: 358707342,
    });
    app.pendingDeepLink = parse(new URL(href, "https://example.test/apps/global/").searchParams);
    selection = null;
    opened = null;
    app.applyPendingDeepLink();
}
handOff("way");
assert(selection === null && opened.properties.osm_type === "way", "The possible way must never select the counted node's backend task.");
assert(opened.properties.osm_id === "358707342", "The unmatched hand-off keeps its typed object.");
handOff("node");
assert(selection === unity.task_id && !opened, "The corresponding node link still selects the backend task.");
handOff("unknown");
assert(selection === null && opened, "An unrecognised type in a typed link must not be interpreted as a node.");
app.tasks = [
    { properties: { task_id: "node-dot", osm_id: 358707342, osm_type: "node" }, geometry: { coordinates: coords } },
    { properties: { task_id: "legacy-dot", osm_id: 358707342 }, geometry: { coordinates: coords } },
];
handOff("way");
assert(selection === null && opened, "A typed way cannot match by numeric ID or identical coordinates, even when a task has no type.");
app.tasks.push({ properties: { task_id: "way-dot", osm_id: 358707342, osm_type: "way" } });
handOff("way");
assert(selection === "way-dot" && !opened, "The correct pair selects a task from the loaded map features.");
app.pendingDeepLink = parse(new URLSearchParams("revise=1&osm_id=358707342"));
app.applyPendingDeepLink();
assert(selection === "node-dot", "An older untyped link still matches by numeric ID.");

console.log("deep-link context: 16 checks passed");
