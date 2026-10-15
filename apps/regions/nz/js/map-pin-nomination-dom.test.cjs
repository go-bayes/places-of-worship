// the "nominate from the map pin" route, held by the actual portal class in
// a stub dom. loadPortal builds a fresh vm context per call, so each case
// starts from its own url, storage and elements. first case: the detailed
// lane leaves a saved quick-entry draft alone (brief 3.2, change 5)
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SCRIPTS = ["occupancy-contract.js", "function-chain-contract.js", "task-presentation.js", "verification-map.js"];

// search: the query string of the page, e.g. "?batch=nz-test&detailed=1"
// storage: optional { key: string } entries seeded into localStorage
const loadPortal = ({ search = "", storage = {} } = {}) => {
  const values = new Map(Object.entries(storage));
  const localStorage = {
    get length() { return values.size; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    key(index) { return [...values.keys()][index] ?? null; },
  };
  const elements = new Map();
  const element = (id, extra = {}) => {
    const item = { id, value: "", hidden: true, textContent: "", innerHTML: "", classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, ...extra };
    elements.set(id, item);
    return item;
  };
  const document = {
    body: { classList: { toggle() {}, contains() { return false; } } },
    getElementById(id) { return elements.get(id) || null; },
  };
  const window = {
    __POW_TEST_NO_BOOTSTRAP__: true,
    location: { search, pathname: "/apps/regions/nz/verification.html", hash: "" },
    localStorage,
    sessionStorage: localStorage,
    PowRapidEntry: {
      secureSubmissionId: () => "22222222-2222-4222-8222-222222222222",
      localIsoDate: () => "2026-10-15",
    },
  };
  const context = vm.createContext({
    window, document, localStorage, sessionStorage: localStorage,
    URLSearchParams, Map, Set, Date, Number, String, Boolean, Object, Array, Math, JSON, RegExp, Intl, console, setTimeout, clearTimeout,
  });
  for (const file of SCRIPTS) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, file), "utf8"), context, { filename: file });
  }
  const app = Object.create(window.NzVerificationMap.prototype);
  app.backendUser = { _id: "user_1" };
  app.backend = { user: app.backendUser };
  app.guidedPeriodsByTaskId = new Map();
  return { app, window, document, elements, element, storage: localStorage };
};

// --- the detailed lane leaves the quick-entry draft ---------------------------
const draftKey = "powRapidDraft:NZ:rapid-pin";
const periodsKey = "powGuidedPeriods:NZ:user_1:rapid-pin-periods";
const draftSeed = JSON.stringify({
  values: { pinNameInput: "Place A" },
  pin: { latitude: -41.2865, longitude: 174.7762, zoom: 17 },
});
const periodsSeed = JSON.stringify({ segments: [{ id: "segment_1", status: "currently_used_for_worship" }] });
const seededStorage = () => ({ [draftKey]: draftSeed, [periodsKey]: periodsSeed });

{
  const { app, storage } = loadPortal({ search: "?batch=nz-test&detailed=1", storage: seededStorage() });
  assert.strictEqual(storage.getItem(periodsKey), periodsSeed, "the seed must sit under the periods key the portal uses");
  app.dropRapidPinFromDevice();
  assert.strictEqual(storage.getItem(draftKey), draftSeed, "detailed lane: leaving pin mode changed the quick-entry draft");
  app.discardEntryAttempt({ confirmFirst: false });
  assert.strictEqual(storage.getItem(draftKey), draftSeed, "detailed lane: discarding changed the quick-entry draft");
  assert.strictEqual(storage.getItem(periodsKey), periodsSeed, "detailed lane: discarding changed the quick-entry period cards");
}

// control: the quick-entry lane still drops the pin and keeps the typed values
{
  const { app, storage } = loadPortal({ search: "?batch=nz-test", storage: seededStorage() });
  app.dropRapidPinFromDevice();
  const record = JSON.parse(storage.getItem(draftKey));
  assert.strictEqual(record.pin, undefined, "quick-entry lane: the pin was kept");
  assert.deepStrictEqual(record.values, { pinNameInput: "Place A" }, "quick-entry lane: the typed values were lost");
  app.discardEntryAttempt({ confirmFirst: false });
  assert.strictEqual(storage.getItem(draftKey), null, "quick-entry lane: discard left the draft");
  assert.strictEqual(storage.getItem(periodsKey), null, "quick-entry lane: discard left the period cards");
}

// --- held links: constructor, sign-in card, one place to apply, replacement ----
// constructPortal runs the real constructor with init stubbed (init needs
// leaflet and the network), so the constructor's own parse is under test
const constructPortal = options => {
  const loaded = loadPortal(options);
  loaded.window.NzVerificationMap.prototype.init = function init() {};
  loaded.app = new loaded.window.NzVerificationMap();
  return loaded;
};

// a backendPanel whose innerHTML is recorded, with the note placeholder
// registered as an element when the markup holds one, so a test can read the
// text the card set through textContent
const mountSignInCard = loaded => {
  const { app, elements, element } = loaded;
  const panel = element("backendPanel");
  let html = "";
  Object.defineProperty(panel, "innerHTML", {
    get() { return html; },
    set(value) {
      html = String(value);
      elements.delete("pendingLinkNote");
      if (html.includes('id="pendingLinkNote"')) element("pendingLinkNote");
    },
  });
  app.backendUser = null;
  app.backend = { configured: true, renderSignInButton: async () => {} };
  app.syncPortalChrome = () => {};
  app.transportDotHtml = () => "";
  return panel;
};

const nominateSearch = "?batch=nz-test&nominate=1&lat=-41.2865&lng=174.7762&email=ra%40example.org";

{
  const { app } = constructPortal({ search: nominateSearch });
  assert.strictEqual(app.pendingDeepLink?.mode, "nominate", "the constructor did not hold the nominate link");
  assert.strictEqual(app.pendingDeepLink.latitude, -41.2865);
  assert.strictEqual(app.pendingDeepLink.longitude, 174.7762);
}

{
  const loaded = constructPortal({ search: nominateSearch });
  const panel = mountSignInCard(loaded);
  loaded.app.renderBackendPanel();
  assert.strictEqual(
    loaded.elements.get("pendingLinkNote").textContent,
    "Sign in to nominate the place at the pin (-41.28650, 174.77620); it opens here after sign-in",
    "the sign-in card did not name the pin",
  );
  assert.ok(!panel.innerHTML.includes("174.77620"), "the card text went through innerHTML");
}

{
  const loaded = constructPortal({ search: "?batch=nz-test&nominate=1&lat=abc&lng=174.7762" });
  assert.strictEqual(loaded.app.pendingDeepLink?.hasCoords, false);
  mountSignInCard(loaded);
  loaded.app.renderBackendPanel();
  assert.strictEqual(
    loaded.elements.get("pendingLinkNote").textContent,
    "Sign in to nominate a missing place of worship; the link held no usable location, so you will drop the pin yourself.",
    "the sign-in card did not give the no-location text",
  );
}

// a revise link is held as before and the card still names the place
{
  const loaded = constructPortal({ search: "?batch=nz-test&revise=1&name=St%20Mary&lat=-41.2&lng=174.7" });
  assert.strictEqual(loaded.app.pendingDeepLink?.mode, "revise");
  const panel = mountSignInCard(loaded);
  loaded.app.renderBackendPanel();
  assert.ok(panel.innerHTML.includes("Sign in to revise"), "the revise card changed");
  assert.ok(!loaded.elements.has("pendingLinkNote"), "the revise card gained a nominate note");
}

// a report-issue link is not held
{
  const { app } = constructPortal({ search: "?batch=nz-test&report_issue=1&lat=-41.2&lng=174.7" });
  assert.strictEqual(app.pendingDeepLink, null, "a report-issue link was held");
}

// a kept sign-in: maybeOpenIssueDeepLink centres the map and applies nothing;
// onBackendSignedIn applies the held link once, after its repaint
for (const [label, search, mode] of [
  ["nominate", nominateSearch, "nominate"],
  ["revise", "?batch=nz-test&revise=1&name=St%20Mary&lat=-41.2&lng=174.7", "revise"],
]) {
  const { app } = constructPortal({ search });
  const calls = [];
  const views = [];
  app.map = { setView: (...args) => views.push(args), getZoom: () => 10 };
  app.applyPendingDeepLink = () => calls.push("applyPendingDeepLink");
  app.openContextIssueForm = () => calls.push("openContextIssueForm");
  app.backendUser = { _id: "user_1" };
  app.maybeOpenIssueDeepLink();
  assert.deepStrictEqual(calls, [], `${label}: maybeOpenIssueDeepLink applied the link`);
  assert.strictEqual(views.length, 1, `${label}: maybeOpenIssueDeepLink did not centre the map`);
  assert.strictEqual(app.pendingDeepLink?.mode, mode, `${label}: maybeOpenIssueDeepLink cleared the held link`);

  app.restorePortalMode = () => calls.push("restorePortalMode");
  app.renderBackendPanel = () => calls.push("renderBackendPanel");
  app.applyFilters = () => calls.push("applyFilters");
  app.selectedTask = null;
  app.renderInitialDetail = () => calls.push("renderInitialDetail");
  app.resumeRapidPinFromDevice = () => calls.push("resumeRapidPinFromDevice");
  app.onBackendSignedIn({ _id: "user_1" }, { refreshTasks: false });
  assert.strictEqual(calls.filter(call => call === "applyPendingDeepLink").length, 1, `${label}: the link was not applied exactly once`);
  assert.ok(calls.indexOf("applyPendingDeepLink") > calls.indexOf("renderInitialDetail"), `${label}: the link was applied before the repaint`);
  assert.ok(calls.indexOf("applyPendingDeepLink") > calls.indexOf("renderBackendPanel"), `${label}: the link was applied before the panel repaint`);
}

// a nominate link reaching applyPendingDeepLink is cleared and opens no form
{
  const { app } = constructPortal({ search: nominateSearch });
  const calls = [];
  app.openContextIssueForm = () => calls.push("openContextIssueForm");
  app.selectTaskById = () => calls.push("selectTaskById");
  app.matchContextTask = () => calls.push("matchContextTask");
  app.backendUser = { _id: "user_1" };
  app.applyPendingDeepLink();
  assert.strictEqual(app.pendingDeepLink, null, "a nominate link stayed held");
  assert.deepStrictEqual(calls, [], "a nominate link opened a revise card");
}

// replacement: a revise request replaces a held nominate link and retires its parameters
{
  const loaded = constructPortal({ search: nominateSearch });
  const { app, window: win } = loaded;
  const urls = [];
  win.history = { state: null, replaceState: (state, title, url) => urls.push(url) };
  mountSignInCard(loaded);
  app.requestSignInToRevise({
    properties: { name: "St Mary", osm_type: "node", osm_id: 7 },
    geometry: { coordinates: [174.7, -41.2] },
  });
  assert.strictEqual(app.pendingDeepLink.mode, "revise", "the revise request did not replace the nominate link");
  assert.strictEqual(urls.length, 1, "replacing the link did not call replaceState once");
  const kept = new URL(urls[0], "https://example.org");
  assert.strictEqual(kept.pathname, "/apps/regions/nz/verification.html");
  for (const name of ["nominate", "lat", "lng"]) assert.ok(!kept.searchParams.has(name), `${name} stayed in the address`);
  assert.strictEqual(kept.searchParams.get("batch"), "nz-test");
  assert.strictEqual(kept.searchParams.get("email"), "ra@example.org");
  // a reload on the retired address holds no nominate link
  const reloaded = constructPortal({ search: kept.search });
  assert.strictEqual(reloaded.app.pendingDeepLink, null, "a reload restored the replaced nominate link");
}

// a revise request over no nominate link leaves the address alone
{
  const loaded = constructPortal({ search: "?batch=nz-test" });
  const urls = [];
  loaded.window.history = { state: null, replaceState: (state, title, url) => urls.push(url) };
  mountSignInCard(loaded);
  loaded.app.requestSignInToRevise({ properties: { name: "St Mary" }, geometry: { coordinates: [174.7, -41.2] } });
  assert.deepStrictEqual(urls, [], "a revise request with no nominate link touched the address");
}

console.log("map-pin-nomination-dom tests passed");
