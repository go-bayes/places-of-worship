// the "nominate from the map pin" route, held by the actual portal class in
// a stub dom. loadPortal builds a fresh vm context per call, so each case
// starts from its own url, storage and elements. first case: the detailed
// lane leaves a saved quick-entry draft alone (brief 3.2, change 5)
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SCRIPTS = ["occupancy-contract.js", "function-chain-contract.js", "task-presentation.js", "verification-map.js"];

// a minimal element for code that builds nodes: textContent reads through the
// children, and setting it clears them, as in a browser
const makeNode = tag => {
  const node = {
    tagName: tag, children: [], attrs: {}, listeners: {}, _text: "", hidden: false,
    appendChild(child) { this.children.push(child); return child; },
    setAttribute(name, value) { this.attrs[name] = String(value); },
    getAttribute(name) { return Object.hasOwn(this.attrs, name) ? this.attrs[name] : null; },
    addEventListener(type, handler) { this.listeners[type] = handler; },
    click() { this.listeners.click?.({ preventDefault() {} }); },
  };
  Object.defineProperty(node, "textContent", {
    get() { return this._text + this.children.map(child => child.textContent).join(""); },
    set(value) { this._text = String(value); this.children = []; },
  });
  return node;
};
const findNodes = (root, test, found = []) => {
  if (test(root)) found.push(root);
  for (const child of root.children) findNodes(child, test, found);
  return found;
};

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
    querySelector() { return null; },
    createElement: tag => makeNode(tag),
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
    L: { latLng: (lat, lng) => ({ lat, lng }) },
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

// a nominate link reaching applyPendingDeepLink is cleared and opens no revise card
{
  const { app } = constructPortal({ search: nominateSearch });
  const calls = [];
  app.applyNominateLink = () => {};
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



// --- the nominate branch, precedence and the notice (brief 3.2, changes 4 and 5) ---
const { mapPinPrecedence } = loadPortal().window.NzVerificationMap;
assert.strictEqual(typeof mapPinPrecedence, "function", "mapPinPrecedence is not exposed");
const pin = { latitude: -41.2865, longitude: 174.7762, zoom: 17 };
assert.strictEqual(mapPinPrecedence({ rapidLane: true, savedPin: pin }), "saved_entry");
assert.strictEqual(mapPinPrecedence({ rapidLane: false, savedPin: pin }), "apply", "the detailed lane with a pin");
assert.strictEqual(mapPinPrecedence({ rapidLane: true, savedPin: null }), "apply", "no record");
assert.strictEqual(mapPinPrecedence({ rapidLane: true, savedPin: undefined }), "apply");
assert.strictEqual(mapPinPrecedence({ rapidLane: true, savedPin: { latitude: "x", longitude: 1 } }), "apply", "a non-finite pin");
assert.strictEqual(mapPinPrecedence({ rapidLane: true, savedPin: { latitude: -41.2 } }), "apply", "a pin without a longitude");

// a portal with a signed-in contributor, the nominate notice mounted, and the
// pin methods recording their calls (calls) instead of needing leaflet
const branchPortal = ({ search = nominateSearch, storage = {}, real = [] } = {}) => {
  const loaded = constructPortal({ search, storage });
  const { app, elements, window: win } = loaded;
  const notice = makeNode("section");
  notice.hidden = true;
  elements.set("mapPinNotice", notice);
  const calls = [];
  loaded.calls = calls;
  loaded.notice = notice;
  app.backendUser = { _id: "user_1" };
  app.map = { setView: (...args) => calls.push(["setView", ...args]), getZoom: () => 10, closePopup() {} };
  app.enterPinMode = () => { calls.push(["enterPinMode"]); app.pinMode = true; };
  app.placePin = latlng => { calls.push(["placePin", latlng]); app.pinMarker = { latlng }; };
  if (!real.includes("exitPinMode")) {
    app.exitPinMode = () => { calls.push(["exitPinMode"]); app.pinMode = false; app.pinMarker = null; app.pinConfirmed = null; };
  }
  app.resumeRapidPinFromDevice = () => { calls.push(["resume"]); return true; };
  app.renderInitialDetail = () => {};
  app.renderBackendPanel = () => {};
  app.setPastSubmissionsOpen = () => {};
  app.contextDotSource = () => "none";
  app.pointsMode = "all";
  if (!real.includes("setPortalMode")) {
    app.setPortalMode = mode => { calls.push(["setPortalMode", mode]); app.portalMode = mode; };
  }
  win.confirm = () => { throw new Error("an unexpected confirm"); };
  return loaded;
};
const noticeKind = loaded => (loaded.notice.hidden ? null : loaded.notice.getAttribute("data-kind"));
const callNames = loaded => loaded.calls.map(call => call[0]);

// no saved entry: mode, then the view, then pin mode, then the pin; unconfirmed
{
  const loaded = branchPortal();
  const { app, calls } = loaded;
  app.applyNominateLink(app.pendingDeepLink);
  assert.deepStrictEqual(callNames(loaded), ["setPortalMode", "setView", "enterPinMode", "placePin"]);
  assert.deepStrictEqual(calls[0], ["setPortalMode", "add"]);
  assert.deepStrictEqual([...calls[1][1]], [-41.2865, 174.7762]);
  assert.strictEqual(calls[1][2], 15, "the view fell below the placement zoom");
  assert.deepStrictEqual({ ...calls[3][1] }, { lat: -41.2865, lng: 174.7762 });
  assert.strictEqual(app.pinConfirmed, null, "the link confirmed the pin");
  assert.deepStrictEqual({ ...app.mapPinRequest }, { latitude: -41.2865, longitude: 174.7762, hasCoords: true, startedEntry: true });
  assert.strictEqual(noticeKind(loaded), null, "the notice showed for a started entry");
}

// a map already closer than the placement zoom keeps its zoom
{
  const loaded = branchPortal();
  loaded.app.map.getZoom = () => 18;
  loaded.app.applyNominateLink(loaded.app.pendingDeepLink);
  assert.strictEqual(loaded.calls[1][2], 18);
}

// no usable coordinates: pin mode opens with no pin
{
  const loaded = branchPortal({ search: "?batch=nz-test&nominate=1&lat=abc&lng=174.7762" });
  loaded.app.applyNominateLink(loaded.app.pendingDeepLink);
  assert.deepStrictEqual(callNames(loaded), ["setPortalMode", "enterPinMode"]);
  assert.strictEqual(loaded.app.mapPinRequest.hasCoords, false);
  assert.strictEqual(loaded.app.mapPinRequest.startedEntry, true);
}

// the nominate branch of applyPendingDeepLink calls applyNominateLink
{
  const loaded = branchPortal();
  const seen = [];
  loaded.app.applyNominateLink = link => seen.push(link);
  const held = loaded.app.pendingDeepLink;
  loaded.app.applyPendingDeepLink();
  assert.deepStrictEqual(seen, [held]);
  assert.strictEqual(loaded.app.pendingDeepLink, null);
}

// precedence from the device record, read before the mode changes
const savedStorage = () => ({ [draftKey]: draftSeed, [periodsKey]: periodsSeed });
const otherCountryStorage = () => ({ "powRapidDraft:AU:rapid-pin": draftSeed });

{
  const loaded = branchPortal({ storage: otherCountryStorage() });
  loaded.app.applyNominateLink(loaded.app.pendingDeepLink);
  assert.deepStrictEqual(callNames(loaded), ["setPortalMode", "setView", "enterPinMode", "placePin"], "another country's record held the link back");
}
{
  const loaded = branchPortal({ storage: { [draftKey]: JSON.stringify({ values: { pinNameInput: "Place A" } }) } });
  loaded.app.applyNominateLink(loaded.app.pendingDeepLink);
  assert.deepStrictEqual(callNames(loaded), ["setPortalMode", "setView", "enterPinMode", "placePin"], "typed values alone held the link back");
}
{
  const loaded = branchPortal({ search: `${nominateSearch}&detailed=1`, storage: savedStorage() });
  loaded.app.applyNominateLink(loaded.app.pendingDeepLink);
  assert.deepStrictEqual(callNames(loaded), ["setPortalMode", "setView", "enterPinMode", "placePin"], "the detailed lane honoured the quick-entry record");
  assert.strictEqual(loaded.storage.getItem(draftKey), draftSeed);
  assert.strictEqual(loaded.storage.getItem(periodsKey), periodsSeed);
}

// storage that throws reads as no saved entry, and nothing throws
{
  const loaded = branchPortal({ storage: savedStorage() });
  loaded.storage.getItem = () => { throw new Error("blocked"); };
  assert.doesNotThrow(() => loaded.app.applyNominateLink(loaded.app.pendingDeepLink));
  assert.deepStrictEqual(callNames(loaded), ["setPortalMode", "setView", "enterPinMode", "placePin"]);
}

// a saved entry resumes and the link waits in the notice (portal mode not yet add)
const waitingText = "A nomination from the map is waiting at (-41.28650, 174.77620)";
{
  const loaded = branchPortal({ storage: savedStorage(), real: ["setPortalMode"] });
  const { app, calls } = loaded;
  app.applyNominateLink(app.pendingDeepLink);
  assert.strictEqual(app.portalMode, "add");
  assert.deepStrictEqual(callNames(loaded), ["resume"], "the saved entry did not resume once through setPortalMode");
  assert.ok(!calls.some(call => call[0] === "placePin"), "the link's point was placed over a saved entry");
  assert.strictEqual(noticeKind(loaded), "waiting");
  assert.ok(loaded.notice.textContent.startsWith(waitingText), `notice text was: ${loaded.notice.textContent}`);
  assert.strictEqual(app.mapPinRequest.startedEntry, false);
  const buttons = findNodes(loaded.notice, node => node.tagName === "button").map(node => node.textContent);
  assert.deepStrictEqual(buttons, ["Nominate at the map pin", "Dismiss"]);
  assert.strictEqual(loaded.storage.getItem(draftKey), draftSeed, "the saved entry changed");
}

// ... and with the mode already add, the resume runs through resumeRapidPinFromDevice
{
  const loaded = branchPortal({ storage: savedStorage() });
  loaded.app.portalMode = "add";
  loaded.app.applyNominateLink(loaded.app.pendingDeepLink);
  assert.deepStrictEqual(callNames(loaded), ["resume"]);
  assert.strictEqual(noticeKind(loaded), "waiting");
  assert.ok(loaded.notice.textContent.startsWith(waitingText));
}

// a saved entry and a link without usable coordinates
{
  const loaded = branchPortal({ search: "?batch=nz-test&nominate=1&lat=abc&lng=1", storage: savedStorage() });
  loaded.app.portalMode = "add";
  loaded.app.applyNominateLink(loaded.app.pendingDeepLink);
  assert.strictEqual(noticeKind(loaded), "waiting");
  assert.strictEqual(loaded.notice.textContent.split("Nominate at the map pin")[0], "A nomination from the map is waiting; the link held no usable location");
}

// unsaved changes kept at the mode prompt: no pin, and the unsaved notice
{
  const loaded = branchPortal({ real: ["setPortalMode"] });
  const { app, window: win } = loaded;
  app.portalMode = "assigned";
  app.formDirty = true;
  const asked = [];
  win.confirm = message => { asked.push(message); return false; };
  app.applyNominateLink(app.pendingDeepLink);
  assert.strictEqual(asked.length, 1, "the portal's own prompt did not appear once");
  assert.strictEqual(app.portalMode, "assigned");
  assert.ok(!callNames(loaded).includes("placePin") && !callNames(loaded).includes("enterPinMode"));
  assert.strictEqual(noticeKind(loaded), "unsaved");
  assert.ok(loaded.notice.textContent.startsWith(waitingText));
  // the button runs the branch again, and the prompt asks its usual question
  win.confirm = () => true;
  findNodes(loaded.notice, node => node.tagName === "button")[0].click();
  assert.strictEqual(app.portalMode, "add");
  assert.ok(callNames(loaded).includes("placePin"), "the retry placed no pin");
  assert.strictEqual(noticeKind(loaded), null);
  assert.strictEqual(app.mapPinRequest.startedEntry, true);
}

// a saved entry behind unsaved changes elsewhere: the mode stays, so the notice says so
{
  const loaded = branchPortal({ storage: savedStorage(), real: ["setPortalMode"] });
  loaded.app.portalMode = "assigned";
  loaded.app.formDirty = true;
  loaded.window.confirm = () => false;
  loaded.app.applyNominateLink(loaded.app.pendingDeepLink);
  assert.strictEqual(loaded.app.portalMode, "assigned");
  assert.deepStrictEqual(callNames(loaded), [], "the saved entry resumed under the refused prompt");
  assert.strictEqual(noticeKind(loaded), "unsaved");
}

// a saved entry behind a dirty form: the button re-checks precedence, so the
// confirmed discard clears the entry and the pin lands at the link's point
{
  const loaded = branchPortal({ storage: savedStorage(), real: ["setPortalMode"] });
  const { app, window: win } = loaded;
  app.portalMode = "assigned";
  app.formDirty = true;
  win.confirm = () => false;
  app.applyNominateLink(app.pendingDeepLink);
  assert.strictEqual(noticeKind(loaded), "unsaved");
  assert.strictEqual(app.portalMode, "assigned");
  win.confirm = () => true;
  findNodes(loaded.notice, node => node.tagName === "button")[0].click();
  assert.strictEqual(loaded.storage.getItem(draftKey), null, "the retry left the saved record");
  assert.strictEqual(loaded.storage.getItem(periodsKey), null, "the retry left the period cards");
  assert.strictEqual(app.portalMode, "add");
  const placed = loaded.calls.filter(call => call[0] === "placePin");
  assert.strictEqual(placed.length, 1, "the retry did not place the pin");
  assert.deepStrictEqual({ ...placed[0][1] }, { lat: -41.2865, lng: 174.7762 });
  assert.strictEqual(app.mapPinRequest.startedEntry, true);
  assert.strictEqual(noticeKind(loaded), null);
}

// ... and a refused discard on that retry leaves both stores and the mode alone
{
  const loaded = branchPortal({ storage: savedStorage(), real: ["setPortalMode"] });
  const { app, window: win } = loaded;
  app.portalMode = "assigned";
  app.formDirty = true;
  win.confirm = () => false;
  app.applyNominateLink(app.pendingDeepLink);
  findNodes(loaded.notice, node => node.tagName === "button")[0].click();
  assert.strictEqual(loaded.storage.getItem(draftKey), draftSeed);
  assert.strictEqual(loaded.storage.getItem(periodsKey), periodsSeed);
  assert.strictEqual(app.portalMode, "assigned");
  assert.strictEqual(noticeKind(loaded), "unsaved");
}

// the notice button with a saved entry: only a confirmed choice discards it
{
  const loaded = branchPortal({ storage: savedStorage() });
  const { app, window: win } = loaded;
  app.portalMode = "add";
  app.applyNominateLink(app.pendingDeepLink);
  app.pinConfirmed = { latitude: -41.2865, longitude: 174.7762 };
  const press = () => findNodes(loaded.notice, node => node.tagName === "button")[0].click();
  let asked = 0;
  win.confirm = () => { asked += 1; return false; };
  press();
  assert.strictEqual(asked, 1, "the discard did not ask first");
  assert.strictEqual(loaded.storage.getItem(draftKey), draftSeed, "a refused discard changed the record");
  assert.strictEqual(loaded.storage.getItem(periodsKey), periodsSeed, "a refused discard changed the period cards");
  assert.ok(!callNames(loaded).includes("placePin"), "a refused discard placed the pin");
  assert.strictEqual(noticeKind(loaded), "waiting");

  win.confirm = () => { asked += 1; return true; };
  press();
  assert.strictEqual(loaded.storage.getItem(draftKey), null, "the confirmed discard left the record");
  assert.strictEqual(loaded.storage.getItem(periodsKey), null, "the confirmed discard left the period cards");
  const placed = loaded.calls.filter(call => call[0] === "placePin");
  assert.strictEqual(placed.length, 1, "the branch did not run again");
  assert.deepStrictEqual({ ...placed[0][1] }, { lat: -41.2865, lng: 174.7762 });
  assert.strictEqual(noticeKind(loaded), null);
  assert.strictEqual(app.mapPinRequest.startedEntry, true);
}

// outside assignment mode the link is not applied; the notice names the standard portal
{
  const loaded = branchPortal({ search: "?full=1&country=nz&nominate=1&lat=-41.2865&lng=174.7762&email=ra%40example.org" });
  loaded.app.applyNominateLink(loaded.app.pendingDeepLink);
  assert.deepStrictEqual(loaded.calls, [], "a nominate link was applied outside assignment mode");
  assert.strictEqual(noticeKind(loaded), "standard_portal");
  assert.strictEqual(loaded.notice.textContent, "Nominations from the map open in the standard portal");
  const [anchor] = findNodes(loaded.notice, node => node.tagName === "a");
  const href = new URL(anchor.getAttribute("href"), "https://example.org");
  assert.strictEqual(href.pathname, "/apps/regions/nz/verification.html");
  assert.ok(!href.searchParams.has("full") && !href.searchParams.has("batch"));
  assert.strictEqual(href.searchParams.get("nominate"), "1");
  assert.strictEqual(href.searchParams.get("lat"), "-41.2865");
  assert.strictEqual(href.searchParams.get("lng"), "174.7762");
  assert.strictEqual(href.searchParams.get("country"), "nz");
}

// a second sign-in callback with no held link leaves the entry alone
{
  const loaded = branchPortal();
  const { app } = loaded;
  app.restorePortalMode = () => {};
  app.applyFilters = () => {};
  app.selectedTask = null;
  app.onBackendSignedIn({ _id: "user_1" }, { refreshTasks: false });
  const marker = app.pinMarker;
  const request = app.mapPinRequest;
  assert.ok(marker && request, "the first sign-in callback did not apply the link");
  const before = loaded.calls.length;
  app.onBackendSignedIn({ _id: "user_1" }, { refreshTasks: false });
  assert.strictEqual(app.pinMarker, marker);
  assert.strictEqual(app.mapPinRequest, request);
  assert.strictEqual(loaded.calls.slice(before).filter(call => call[0] === "placePin").length, 0);
}

// signing out hides the notice, forgets the request and leaves the device record
{
  const loaded = branchPortal({ storage: savedStorage() });
  const { app } = loaded;
  app.portalMode = "add";
  app.applyNominateLink(app.pendingDeepLink);
  assert.strictEqual(noticeKind(loaded), "waiting");
  app.backend = { signOut() {}, configured: true };
  app.applyFilters = () => {};
  app.signOutBackend();
  assert.strictEqual(loaded.notice.hidden, true);
  assert.strictEqual(app.mapPinRequest, null);
  // existing sign-out policy for a shared computer: period cards leave with
  // the session. the rapid-pin record is untouched unless pin mode was open
  // (exitPinMode), which it was not here
  assert.strictEqual(loaded.storage.getItem(periodsKey), null, "sign-out kept the period cards");
  assert.strictEqual(loaded.storage.getItem(draftKey), draftSeed, "sign-out changed the saved entry");
}

// --- a link is applied once (brief 3.2, change 6) -----------------------------
// the real confirmPinLocation and exitPinMode run over a stub map. replaceState
// is spied: a retired link is one call that drops nominate, lat and lng and
// keeps every other parameter
const retiringPortal = options => {
  const loaded = branchPortal({ ...options, real: [...(options?.real || []), "exitPinMode"] });
  const { app, window: win } = loaded;
  const urls = [];
  win.history = { state: null, replaceState: (state, title, url) => urls.push(url) };
  loaded.urls = urls;
  loaded.document.body.classList.remove = () => {};
  const layer = { dragging: { disable() {} }, getLatLng: () => ({ lat: -41.2865, lng: 174.7762 }) };
  app.map = {
    setView: (...args) => loaded.calls.push(["setView", ...args]),
    getZoom: () => 18,
    getBounds: () => ({ contains: () => true }),
    closePopup() {},
    off() {},
    removeLayer() {},
    getContainer: () => ({ classList: { add() {}, remove() {} } }),
  };
  // a pin placed the way the armed click handler places it: placePin for the
  // first placement, setPendingPin for a later move
  loaded.clickMap = latlng => {
    if (app.pinMarker) app.setPendingPin(latlng.lat, latlng.lng, { zoom: 18 });
    else app.placePin(latlng);
  };
  app.placePin = latlng => { loaded.calls.push(["placePin", latlng]); app.pinMarker = layer; };
  app.setPendingPin = (lat, lng) => loaded.calls.push(["setPendingPin", lat, lng]);
  app.pinLocationMode = () => "exact";
  app.pinLocationRadius = () => undefined;
  app.notePinCountry = () => {};
  app.keepRapidPinOnDevice = () => {};
  app.nearbyTaskRows = () => [];
  app.showPinForm = () => loaded.calls.push(["showPinForm"]);
  app.paneSnap = () => {};
  app.renderEntryCountryNote = () => {};
  app.renderAddReviseControl = () => {};
  app.setEntryOpen = () => {};
  return loaded;
};
const assertRetired = (loaded, label) => {
  assert.strictEqual(loaded.urls.length, 1, `${label}: the link was not retired by one replaceState call`);
  const kept = new URL(loaded.urls[0], "https://example.org");
  for (const name of ["nominate", "lat", "lng"]) assert.ok(!kept.searchParams.has(name), `${label}: ${name} stayed in the address`);
  assert.strictEqual(kept.searchParams.get("batch"), "nz-test", `${label}: batch was lost`);
  assert.strictEqual(kept.searchParams.get("email"), "ra@example.org", `${label}: email was lost`);
  assert.strictEqual(loaded.app.mapPinRequest, null, `${label}: the request was kept`);
  assert.strictEqual(noticeKind(loaded), null, `${label}: the notice stayed`);
};

// confirming the pin of a link-started entry
{
  const loaded = retiringPortal();
  const { app } = loaded;
  app.applyNominateLink(app.pendingDeepLink);
  assert.strictEqual(app.mapPinRequest.startedEntry, true);
  assert.deepStrictEqual(loaded.urls, [], "the link was retired before the pin was confirmed");
  app.confirmPinLocation();
  assert.ok(app.pinConfirmed, "the pin was not confirmed");
  assertRetired(loaded, "confirm");
  // a reload before confirmation holds the link again
  const reloaded = constructPortal({ search: nominateSearch });
  assert.strictEqual(reloaded.app.pendingDeepLink?.mode, "nominate", "a reload before confirmation lost the link");
}

// a link without usable coordinates, a pin placed by hand, then confirmed
{
  const loaded = retiringPortal({ search: "?batch=nz-test&nominate=1&lat=abc&lng=174.7762&email=ra%40example.org" });
  const { app } = loaded;
  app.applyNominateLink(app.pendingDeepLink);
  assert.strictEqual(app.mapPinRequest.hasCoords, false);
  assert.strictEqual(app.mapPinRequest.startedEntry, true);
  loaded.clickMap({ lat: -41.2865, lng: 174.7762 });
  assert.ok(app.pinMarker, "the hand-placed pin did not land");
  assert.deepStrictEqual(loaded.urls, [], "placing the pin by hand retired the link");
  app.confirmPinLocation();
  assertRetired(loaded, "hand-placed pin");
}

// a later move of the pin by hand uses setPendingPin and leaves the request be
{
  const loaded = retiringPortal();
  const { app } = loaded;
  app.applyNominateLink(app.pendingDeepLink);
  loaded.clickMap({ lat: -41.287, lng: 174.777 });
  assert.ok(loaded.calls.some(call => call[0] === "setPendingPin"), "the later click did not move the pin");
  assert.deepStrictEqual(loaded.urls, []);
  assert.ok(app.mapPinRequest, "moving the pin cleared the request");
}

// leaving pin mode in the entry the request started
{
  const loaded = retiringPortal();
  const { app } = loaded;
  app.applyNominateLink(app.pendingDeepLink);
  app.exitPinMode();
  assert.strictEqual(app.pinMode, false);
  assertRetired(loaded, "exitPinMode");
}

// dismissing the notice always retires the link
for (const [label, options, setup] of [
  ["dismiss, waiting", { storage: savedStorage() }, ({ app }) => { app.portalMode = "add"; }],
  ["dismiss, unsaved", { real: ["setPortalMode"] }, ({ app, window: win }) => { app.portalMode = "assigned"; app.formDirty = true; win.confirm = () => false; }],
]) {
  const loaded = retiringPortal(options);
  const { app } = loaded;
  setup(loaded);
  app.applyNominateLink(app.pendingDeepLink);
  assert.ok(["waiting", "unsaved"].includes(noticeKind(loaded)), `${label}: the notice did not show`);
  assert.strictEqual(app.mapPinRequest.startedEntry, false);
  assert.deepStrictEqual(loaded.urls, []);
  findNodes(loaded.notice, node => node.tagName === "button")[1].click();
  assertRetired(loaded, label);
}

// confirming or leaving a resumed older entry leaves the waiting request alone
{
  const loaded = retiringPortal({ storage: savedStorage() });
  const { app } = loaded;
  app.portalMode = "add";
  app.applyNominateLink(app.pendingDeepLink);
  assert.strictEqual(noticeKind(loaded), "waiting");
  const request = app.mapPinRequest;
  // the resumed entry has its own pin in pin mode
  app.pinMode = true;
  app.pinMarker = { dragging: { disable() {} }, getLatLng: () => ({ lat: -41.2865, lng: 174.7762 }) };
  app.confirmPinLocation();
  assert.ok(app.pinConfirmed, "the resumed pin was not confirmed");
  assert.deepStrictEqual(loaded.urls, [], "confirming a resumed entry retired the link");
  assert.strictEqual(app.mapPinRequest, request, "confirming a resumed entry cleared the request");
  assert.strictEqual(noticeKind(loaded), "waiting", "confirming a resumed entry hid the notice");
  app.exitPinMode();
  assert.deepStrictEqual(loaded.urls, [], "leaving a resumed entry retired the link");
  assert.strictEqual(app.mapPinRequest, request, "leaving a resumed entry cleared the request");
  assert.strictEqual(noticeKind(loaded), "waiting", "leaving a resumed entry hid the notice");
}

// a reload after retiring holds no link; a reload before it holds the link again
{
  const loaded = retiringPortal();
  loaded.app.applyNominateLink(loaded.app.pendingDeepLink);
  loaded.app.confirmPinLocation();
  const reloaded = constructPortal({ search: new URL(loaded.urls[0], "https://example.org").search });
  assert.strictEqual(reloaded.app.pendingDeepLink, null, "a reload restored the retired link");
}

console.log("map-pin-nomination-dom tests passed");
