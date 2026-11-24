// every country opens the portal (jb ruling r-h1, 2026-09-03): the actual
// portal script, loaded three times in a stub dom, resolves a registry
// country into a config with no census years and the nomination batch as
// its assignment batch; a hand-tuned country still wins; a code nobody
// knows opens the neutral world view. r-h4: signed out, the unvalidated
// dot's popup offers sign-in and the click parks the place as the pending
// deep link; a dot across the border names its own portal
const { createHash } = require("node:crypto");
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
  for (const file of ["occupancy-contract.js", "function-chain-contract.js", "task-presentation.js", "verification-map.js"]) {
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
// signed in, the popup offers revise; a dot across the border names its
// country and revises here (entry follows the pin, 2026-09-23)
const signedInHtml = app.contextDotPopupHtml(suvaCathedral);
check(signedInHtml.includes("Revise this place") && !signedInHtml.includes("Sign in to revise"), "Signed in, the popup must offer the revise entry.");
const tonganDot = { ...suvaCathedral, properties: { ...suvaCathedral.properties, country_code: "TO", name: "Centenary Church" } };
const foreignHtml = app.contextDotPopupHtml(tonganDot);
check(foreignHtml.includes("popup-foreign-note") && foreignHtml.includes("In Tonga: revising it here records it as Tonga.") && foreignHtml.includes("Revise this place") && !foreignHtml.includes("verification.html?country=to"), `A Tongan dot on the Fiji portal revises here, recorded as Tonga: ${foreignHtml}`);
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

const gbLoaded = load("?country=gb");
const gb = new Proxy({}, { get: (_, name) => gbLoaded.get(String(name)) });
check(gb.COUNTRY_CONFIG.countryCode === "UK", `The iso code gb must open the uk config: ${gb.COUNTRY_CONFIG.countryCode}`);

// hong kong has september tile records but no entry in the shared portal
// registry. use the shipped boundary lookup and feed the map's link to
// both entry points. also exercise a caller's explicit hk parameter.
const shared = path.join(__dirname, "../../../shared");
const globalPage = fs.readFileSync(path.join(__dirname, "../../../global/index.html"), "utf8");
check(/<script src="[^"]+country-registry\.js\?v=\w+"><\/script>\s*<script src="[^"]+region-map\.js/.test(globalPage), "The global map must load the shared registry before the map runtime.");
const runtime = fs.readFileSync(path.join(__dirname, "../../_shared/region-map.js"), "utf8");
const placesUrl = runtime.match(/places: "(https:\/\/[^"]+)"/)[1];
const publicMap = vm.createContext({
  window: { POW_COUNTRY_REGISTRY: fiji.window.POW_COUNTRY_REGISTRY },
  URLSearchParams, RC: {}, CONTRIBUTE_ROUTES: {}, PORTAL_BASE: "../regions/nz/", UNNAMED_PLACE: "Unnamed place",
  CONFIG: { tiles: { places: placesUrl } }, SHARED_BASE: "../shared/",
  handoffRegions: JSON.parse(fs.readFileSync(path.join(__dirname, "../../_shared/data/region-bboxes.json"))).regions,
  worldRegions: JSON.parse(fs.readFileSync(path.join(shared, "data/world-outlines.json"))).regions,
});
vm.runInContext(fs.readFileSync(path.join(shared, "region-resolve.js"), "utf8"), publicMap);
const lift = (signature) => {
  const start = runtime.indexOf(`${signature}(`);
  return runtime.slice(start, runtime.indexOf("\n}\n", start) + 2);
};
vm.runInContext([
  'const normaliseLng = window.RegionResolve.normaliseLng;',
  'const PROJECT_CODE_FOR_ISO = { gb: "uk" };',
  runtime.match(/^let placeCountryOverrides = .*;$/m)[0],
  runtime.match(/^const PLACE_COUNTRY_OVERRIDE_RULES = .*;$/m)[0],
  "let activePlacePopup = null, activePlaceReviseArgs = null;",
  ...["function projectCountryCode", "function countryForPlace", "function countryUnderPoint", "function portalReviseHref", "async function loadPlaceCountryOverrides"].map(lift),
].join("\n"), publicMap);
const mapLink = (code, lat, lng, id) => new URL(publicMap.portalReviseHref("Place", lat, lng, { country_code: code, id }), "https://example.test/apps/global/");
const hongKong = mapLink("HK", "22.3193", "114.1694");
const hongKongLegacy = mapLink("", "22.3193", "114.1694");
check(hongKong.search === hongKongLegacy.search && hongKong.searchParams.get("country") === "cn", "The Hong Kong dot must use the same boundary as a dot with no code.");
check(load(hongKong.search).get("COUNTRY_CONFIG.countryCode") === "CN", "The generated contributor link must open the boundary country.");
check(load("?country=hk").get("COUNTRY_CONFIG.countryCode") === "ZZ", "A direct Hong Kong contributor URL must continue to open the world view.");
const worldFallback = mapLink("HK", "22.24", "114.2");
check(worldFallback.searchParams.get("country") === "zz" && load(worldFallback.search).get("COUNTRY_CONFIG.countryCode") === "ZZ", "A dot with no boundary must open the world contributor view.");
check(mapLink("GB", "0", "0").searchParams.get("country") === "uk", "The tile ISO code GB must resolve to the portal's UK entry.");

const overridesFile = JSON.parse(fs.readFileSync(path.join(shared, "data/place-country-overrides.json"), "utf8"));
const [palestineRule] = overridesFile.rules;
const overrideIds = new Set(palestineRule.ids);
const boundary = path.join(shared, "../..", palestineRule.boundary);
check(palestineRule.count === palestineRule.ids.length && overrideIds.size === 302 && overrideIds.size === palestineRule.count, "The Palestine rule must list and count 302 distinct keys.");
check(palestineRule.ids.every((id) => /^[nrw][1-9]\d*$/.test(id)), "Each override must have a typed OpenStreetMap key.");
check(createHash("sha256").update(fs.readFileSync(boundary)).digest("hex") === palestineRule.boundary_sha256, "The override boundary hash must match the file on disk.");
check(!overrideIds.has("w751805614") && !overrideIds.has("n1977711181"), "The two places inside only the simplified outline must stay outside the override list.");
// a tile switch that leaves the list behind must fail here: the map ignores a list from another edition without a warning
const tileEdition = placesUrl.match(/\/places-v2-(\d{8})-/)[1];
const acceptedRules = vm.runInContext("PLACE_COUNTRY_OVERRIDE_RULES", publicMap);
check(overridesFile.tiles_edition === tileEdition, `The override list is for tiles ${overridesFile.tiles_edition}, and the map reads ${tileEdition}: rebuild it with scripts/build_place_country_overrides.py.`);
check(Object.keys(acceptedRules).join() === tileEdition, `The map must accept override rules for tiles ${tileEdition} only.`);
check(JSON.stringify(acceptedRules[tileEdition]) === JSON.stringify(Object.fromEntries(overridesFile.rules.map((rule) => [`${rule.tile_country}>${rule.portal_country}`, rule.ids.length]))), "The rules the map accepts must be the rules and counts in the list.");
const overriddenId = "n291872774";
check(overrideIds.has(overriddenId), "The list must include the place inside the governorate boundary.");

async function checkPlaceCountryOverrides() {
  const reviseCountry = (code, id = overriddenId) => mapLink(code, "31.78", "35.23", id).searchParams.get("country");
  publicMap.fetch = async () => { throw new Error("offline"); };
  await publicMap.loadPlaceCountryOverrides();
  check(reviseCountry("IL") === "il", "A failed override fetch must keep the tile country.");

  publicMap.fetch = async () => ({ ok: true, json: async () => ({ ...overridesFile, tiles_edition: "20260722" }) });
  await publicMap.loadPlaceCountryOverrides();
  check(reviseCountry("IL") === "il", "An override file from a different edition must keep the tile country.");

  const { tile_country, ...ruleWithoutTileCountry } = palestineRule;
  const malformedFiles = {
    "unknown schema version": { ...overridesFile, schema_version: 2 },
    "empty rules": { ...overridesFile, rules: [] },
    "incorrect count": { ...overridesFile, rules: [{ ...palestineRule, ids: [overriddenId] }] },
    "missing tile country after a valid rule": { ...overridesFile, rules: [palestineRule, ruleWithoutTileCountry] },
    "upper-case portal country": { ...overridesFile, rules: [{ ...palestineRule, portal_country: "PS" }] },
    "lower-case tile country": { ...overridesFile, rules: [{ ...palestineRule, tile_country: "il" }] },
    "duplicate key": { ...overridesFile, rules: [{ ...palestineRule, count: 2, ids: [overriddenId, overriddenId] }] },
    "malformed key": { ...overridesFile, rules: [{ ...palestineRule, count: 2, ids: [overriddenId, "n01"] }] },
    "a shortened but self-consistent rule": { ...overridesFile, rules: [{ ...palestineRule, count: 300, ids: palestineRule.ids.slice(0, 300) }] },
    "a second rule repeating a key": { ...overridesFile, rules: [palestineRule, { ...palestineRule, portal_country: "fr", count: 1, ids: [overriddenId] }] },
    "an unexpected rule": { ...overridesFile, rules: [{ ...palestineRule, portal_country: "fr" }] },
    "the expected rule twice": { ...overridesFile, rules: [palestineRule, palestineRule] },
  };
  for (const [problem, doc] of Object.entries(malformedFiles)) {
    publicMap.fetch = async () => ({ ok: true, json: async () => doc });
    await publicMap.loadPlaceCountryOverrides();
    check(vm.runInContext("placeCountryOverrides.size", publicMap) === 0, `The loader must ignore the whole file with ${problem}.`);
  }

  publicMap.fetch = async (url) => ({ ok: url === "../shared/data/place-country-overrides.json", json: async () => overridesFile });
  await publicMap.loadPlaceCountryOverrides();
  const palestine = mapLink("IL", "31.78", "35.23", overriddenId);
  check(palestine.searchParams.get("country") === "ps" && load(palestine.search).get("COUNTRY_CONFIG.countryCode") === "PS", "The matching global-map key must open the Palestine portal.");
  publicMap.RC.countryCode = "il";
  check(reviseCountry("IL") === "il", "The country page must keep its own country for the same key.");
  delete publicMap.RC.countryCode;
  check(reviseCountry("FR") === "fr", "A listed key with a different tile country must keep its tile country.");
  check(publicMap.countryForPlace({ id: overriddenId }, NaN, NaN).code === "zz", "A listed feature without a country code must use the normal fallback.");
  check(reviseCountry("IL", "w751805614") === "il", "An unlisted key must keep its tile country.");
  const registry = publicMap.window.POW_COUNTRY_REGISTRY;
  publicMap.window.POW_COUNTRY_REGISTRY = { countries: registry.countries.filter((country) => country.code !== "ps") };
  check(reviseCountry("IL") === "il", "An override without a supported portal country must keep the tile country.");
  publicMap.window.POW_COUNTRY_REGISTRY = registry;
}

async function loadReview(search) {
  const elements = new Map();
  const calls = { clients: 0, map: [], queues: [] };
  const reviewDocument = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, { hidden: false, textContent: "", addEventListener() {} });
      return elements.get(id);
    },
  };
  class Client {
    constructor() { calls.clients += 1; this.configured = true; this.authToken = "test"; }
    async restoreSession() { return { display_name: "Reviewer" }; }
    async listReviewQueue(options) { calls.queues.push(options.countryCode); return []; }
  }
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "review-portal.js"), "utf8"), {
    window: {
      location: { search }, POW_CONVEX_CONFIG: { countryCode: "NZ" },
      POW_COUNTRY_REGISTRY: fiji.window.POW_COUNTRY_REGISTRY,
      PowConvexTaskClient: Client,
      PowReviewMap: { create(options) { calls.map.push(options); return { setQueue() {} }; } },
    },
    document: reviewDocument, URLSearchParams,
  }, { filename: "review-portal.js" });
  await new Promise((resolve) => setImmediate(resolve));
  return { ...calls, status: elements.get("queueStatusText") };
}

(async () => {
  await checkPlaceCountryOverrides();
  const cn = await loadReview(`?country=${hongKong.searchParams.get("country")}`);
  check(cn.map[0]?.countryCode === "CN" && cn.queues.join() === "CN", "Review must open the resolved boundary country.");
  for (const query of ["?country=hk", "?country=", "?country=constructor"]) {
    const review = await loadReview(query);
    check(review.clients === 0 && review.map.length === 0 && review.queues.length === 0, "An invalid review country must never load the New Zealand queue.");
    check(review.status.className === "status error" && !review.status.hidden && /^No review country/.test(review.status.textContent), "The review page must visibly explain an invalid country.");
  }
  const world = await loadReview(worldFallback.search);
  check(world.map[0]?.countryCode === "ZZ" && world.map[0]?.zoom === 2 && world.queues.join() === "ZZ", "Explicit ZZ must open the world review view and use the ZZ queue.");
  const home = await loadReview("");
  check(home.map[0]?.countryCode === "NZ" && home.queues.join() === "NZ", "Omitting a review country must keep the New Zealand default.");
  const gbReview = await loadReview("?country=GB");
  check(gbReview.queues.join() === "UK", "The review page must recognise GB as an alias for UK.");
  console.log(`country config: ${checks} checks passed`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
