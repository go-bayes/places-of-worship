// every country opens the portal (jb ruling r-h1, 2026-09-03): the actual
// portal script, loaded three times in a stub dom, resolves a registry
// country into a config with no census years and the nomination batch as
// its assignment batch; a hand-tuned country still wins; a code nobody
// knows opens the neutral world view. r-h4: signed out, the unvalidated
// dot's popup offers sign-in and the click parks the place as the pending
// deep link; a dot across the border names its own portal
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const storage = {
  getItem() { return null; }, setItem() {}, removeItem() {}, key() { return null; }, get length() { return 0; },
};
function load(search) {
  const elements = new Map();
  const bodyClasses = new Set();
  const document = {
    body: { classList: { toggle(name, force) { if (force) bodyClasses.add(name); else bodyClasses.delete(name); }, contains(name) { return bodyClasses.has(name); }, remove() {}, add() {} } },
    getElementById(id) { return elements.get(id) || null; },
  };
  const window = {
    __POW_TEST_NO_BOOTSTRAP__: true,
    location: { search, pathname: "/apps/regions/nz/verification.html" },
    localStorage: storage,
    sessionStorage: storage,
  };
  const context = vm.createContext({
    window, document, localStorage: storage, sessionStorage: storage,
    URLSearchParams, Map, Set, Date, Number, String, Boolean, Object, Array, Math, JSON, RegExp, Intl, console, setTimeout, clearTimeout,
  });
  const registry = path.join(__dirname, "..", "..", "..", "shared", "data", "country-registry.js");
  vm.runInContext(fs.readFileSync(registry, "utf8"), context, { filename: "country-registry.js" });
  for (const file of ["occupancy-contract.js", "function-chain-contract.js", "verification-map.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, file), "utf8"), context, { filename: file });
  }
  // top-level consts of a classic script are not properties of the vm
  // global, so read them by evaluating their names in the context
  const get = name => vm.runInContext(name, context);
  return { context, window, elements, get };
}
let checks = 0;
function check(condition, message) {
  checks += 1;
  if (!condition) throw new Error(message);
}

// --- a registry country ---------------------------------------------------------
const fiji = load("?country=fj");
const fc = new Proxy({}, { get: (_, name) => fiji.get(String(name)) });
check(fc.COUNTRY_CONFIG.countryCode === "FJ" && fc.COUNTRY_CONFIG.countryName === "Fiji", `Fiji did not resolve from the registry: ${JSON.stringify(fc.COUNTRY_CONFIG.countryCode)}`);
check(fc.COUNTRY_CONFIG.fromRegistry === true && fc.COUNTRY_CONFIG.assignmentsOffered === false, "A registry country must carry fromRegistry and refuse assignments.");
check(Array.isArray(fc.TARGET_YEARS) && fc.TARGET_YEARS.length === 0 && fc.DEFAULT_TARGET_YEAR === "", "A registry country must have no census years.");
check(fc.DEFAULT_ASSIGNMENT_BATCH_ID === "manual-fj", `The nomination batch must stand in as the assignment batch: ${fc.DEFAULT_ASSIGNMENT_BATCH_ID}`);
check(Array.isArray(fc.COUNTRY_CONFIG.mapCentre) && fc.COUNTRY_CONFIG.mapCentre[0] < 0 && fc.COUNTRY_CONFIG.mapZoom >= 2, "The registry camera did not carry over.");
check(!fc.COUNTRY_CONFIG.datedPlaces, "A registry country has no dated product.");
const defaults = fc.statusDefaultsForAction("confirm_current_record", undefined, {});
check(Object.keys(defaults).length === 0, `No census years means no per-year defaults: ${JSON.stringify(defaults)}`);
const grid = fc.targetYearStatusControlsHtml();
check(grid.includes("No census years are set for Fiji") && !grid.includes("year-status-row"), "The year grid must explain itself instead of rendering empty rows.");
const nominationOptions = fc.nominationTypeOptionsHtml();
check(!nominationOptions.includes("lost_undefined"), "Nomination options leaked an undefined year.");
check(fc.ASSIGNMENT_MODE === false, "Without a configured backend or ?batch=, assignment mode stays off in the test dom.");

// r-h4 on a tile dot, signed out
const app = Object.create(fiji.window.NzVerificationMap.prototype);
app.backendUser = null;
app.backend = { configured: true, signedIn: false };
app.tasks = [];
app.backendTasksById = new Map();
app.map = null;
const suvaCathedral = {
  type: "Feature",
  properties: { osm_id: 123456, osm_type: "way", name: "Sacred Heart Cathedral", country_code: "FJ" },
  geometry: { type: "Point", coordinates: [178.4245, -18.1405] },
};
const signedOutHtml = app.contextDotPopupHtml(suvaCathedral);
check(signedOutHtml.includes("Sign in to revise this place") && signedOutHtml.includes("data-sign-in-revise"), "Signed out, the popup must offer sign-in to revise.");
check(!signedOutHtml.includes("popup-foreign-note"), "A dot in the portal's own country must not be called foreign.");
app.requestSignInToRevise(suvaCathedral);
const pending = app.pendingDeepLink;
check(pending && pending.mode === "revise" && pending.name === "Sacred Heart Cathedral" && pending.osmId === "123456" && pending.osmType === "way" && pending.hasCoords && pending.latitude === -18.1405, `The click did not park the place as the pending deep link: ${JSON.stringify(pending)}`);
// the pending link waits for sign-in in every mode
let opened = 0;
app.openContextIssueForm = () => { opened += 1; };
app.matchContextTask = () => null;
app.applyPendingDeepLink();
check(opened === 0 && app.pendingDeepLink, "The pending revise must wait for sign-in.");
app.backendUser = { _id: "user_1" };
app.applyPendingDeepLink();
check(opened === 1 && app.pendingDeepLink === null, "After sign-in the pending revise must open and clear.");
// p3-8: a deployment without a backend keeps the issue form on the popup
app.backendUser = null;
app.backend = { configured: false, signedIn: false };
check(app.contextDotPopupHtml(suvaCathedral).includes("data-report-issue") && !app.contextDotPopupHtml(suvaCathedral).includes("Sign in to revise"), "Without a backend the popup must keep the issue form entry.");
app.backend = { configured: true, signedIn: false };
// p2-4: confirming the current record still means present and in use with no census years
const confirmDefaults = fc.assessmentDefaultsForAction("confirm_current_record", fc.statusDefaultsForAction("confirm_current_record", undefined, {}));
check(confirmDefaults.existenceStatus === "present" && confirmDefaults.worshipUseStatus === "confirmed_worship", `No census years must not turn a confirmation uncertain: ${JSON.stringify(confirmDefaults)}`);
// p3-7: no "the target year" leaks into copy
check(fc.targetYearListText() === "" && fc.targetYearAndListText() === "", "Empty year lists must render as nothing, not as 'the target year'.");
app.backendUser = { _id: "user_1" };
// signed in, the popup offers revise; a dot across the border names its portal
const signedInHtml = app.contextDotPopupHtml(suvaCathedral);
check(signedInHtml.includes("Revise this place") && !signedInHtml.includes("Sign in to revise"), "Signed in, the popup must offer the revise entry.");
const tonganDot = { ...suvaCathedral, properties: { ...suvaCathedral.properties, country_code: "TO", name: "Centenary Church" } };
const foreignHtml = app.contextDotPopupHtml(tonganDot);
check(foreignHtml.includes("popup-foreign-note") && foreignHtml.includes("Open the Tonga portal") && foreignHtml.includes("verification.html?country=to"), `A Tongan dot on the Fiji portal must point at the Tonga portal: ${foreignHtml}`);
// the sign-in card names the parked place
app.pendingDeepLink = pending;
app.backendUser = null;
app.backend = { configured: true, signedIn: false, renderSignInButton() { return Promise.resolve(); } };
const panel = { innerHTML: "" };
fiji.elements.set("backendPanel", panel);
app.syncPortalChrome = () => {};
app.getRaInitials = () => "";
app.renderBackendPanel();
check(panel.innerHTML.includes("Sign in to revise <em>Sacred Heart Cathedral</em>"), `The sign-in card must name the parked place: ${panel.innerHTML.slice(0, 300)}`);

// --- a hand-tuned country still wins ---------------------------------------------
const vanuatuLoaded = load("?country=vu");
const vanuatu = new Proxy({}, { get: (_, name) => vanuatuLoaded.get(String(name)) });
check(vanuatu.COUNTRY_CONFIG.countryName === "Vanuatu" && vanuatu.TARGET_YEARS.length === 4 && vanuatu.COUNTRY_CONFIG.fromRegistry === undefined, "Vanuatu must keep its hand-tuned config.");
check(vanuatu.COUNTRY_CONFIG.assignmentsOffered === undefined, "A tuned country keeps its assignment chooser.");

// --- a code nobody knows -------------------------------------------------------------
const unknownLoaded = load("?country=zq");
const unknown = new Proxy({}, { get: (_, name) => unknownLoaded.get(String(name)) });
check(unknown.COUNTRY_CONFIG.countryCode === "ZZ" && unknown.TARGET_YEARS.length === 0, `An unknown code must open the neutral world view, not New Zealand: ${unknown.COUNTRY_CONFIG.countryCode}`);
const homeLoaded = load("");
const home = new Proxy({}, { get: (_, name) => homeLoaded.get(String(name)) });
check(home.COUNTRY_CONFIG.countryCode === "NZ", "No code on the nz page must still mean New Zealand.");

// --- the united kingdom under both spellings -----------------------------------------
const ukLoaded = load("?country=uk");
const uk = new Proxy({}, { get: (_, name) => ukLoaded.get(String(name)) });
check(uk.COUNTRY_CONFIG.countryName === "United Kingdom" && uk.COUNTRY_CONFIG.fromRegistry === undefined, "uk must keep its tuned config.");

console.log(`country config: ${checks} checks passed`);
