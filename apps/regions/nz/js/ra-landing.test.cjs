// the signed-in landing of 2026-10-07 (L3): a kept sign-in starts its single
// landing request before leaflet boots, the first refresh uses that answer
// without a second read, and a deployment without tasks:raLanding falls back
// to the old session restore and list reads
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const values = new Map();
const localStorage = {
  get length() { return values.size; },
  getItem(key) { return values.has(key) ? values.get(key) : null; },
  setItem(key, value) { values.set(key, String(value)); },
  removeItem(key) { values.delete(key); },
  key(index) { return [...values.keys()][index] ?? null; },
};
const classList = () => ({ add() {}, remove() {}, toggle() {}, contains() { return false; } });
const document = {
  body: { classList: classList() },
  getElementById() { return null; },
  createElement() { return { textContent: "", classList: classList(), remove() {}, addEventListener() {} }; },
  querySelector() { return null; },
  querySelectorAll() { return []; },
  addEventListener() {},
};
const window = {
  __POW_TEST_NO_BOOTSTRAP__: true,
  location: { search: "?batch=nz-temporal-ra-workpack-001", pathname: "/apps/regions/nz/verification.html" },
  localStorage, sessionStorage: localStorage,
  setTimeout, clearTimeout,
  addEventListener() {},
  matchMedia: () => ({ matches: false }),
  isSecureContext: true,
};
const context = vm.createContext({
  window, document, localStorage, sessionStorage: localStorage, navigator: { geolocation: null },
  URLSearchParams, Map, Set, Date, Number, String, Boolean, Object, Array, Math, JSON, RegExp, Intl, console, setTimeout, clearTimeout, Promise, Error,
});
for (const file of ["occupancy-contract.js", "function-chain-contract.js", "task-presentation.js", "verification-map.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, file), "utf8"), context, { filename: file });
}

function portal({ landing, supported = true }) {
  const order = [];
  const page = Object.create(window.NzVerificationMap.prototype);
  page.backendUser = null;
  page.backendTasksById = new Map();
  page.manualTasksById = new Map();
  page.withdrawnNominationTaskIds = new Set();
  page.myWorkItems = [];
  page.myNominationItems = [];
  page.landingState = null;
  page.pendingLanding = null;
  page.refreshesInFlight = 0;
  for (const name of ["setupMap", "setupPageMode", "setupFilters", "setupPaneDivider", "renderBackendPanel", "renderSessionPanel", "renderNominationList", "renderInitialDetail", "renderAddReviseControl", "applyFilters", "maybeOpenIssueDeepLink"]) {
    page[name] = () => { order.push(name); };
  }
  page.setTransportBusy = () => {};
  page.loadTasks = async () => { order.push("loadTasks"); };
  page.onBackendSignedIn = async (user, options) => { order.push(`onBackendSignedIn:${options?.refreshTasks}`); };
  page.assignmentTaskIsAvailable = () => true;
  const reads = [];
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  page.backend = {
    configured: true,
    authToken: "kept-token",
    get signedIn() { return Boolean(page.backendUser); },
    async restoreSessionWithLanding(args) {
      order.push("restoreSessionWithLanding");
      reads.push(["raLanding", args]);
      await gate;
      if (!supported) return { user: { _id: "user_1" }, landing: null };
      return { user: landing.user, landing };
    },
    async readLanding() { reads.push(["raLanding"]); return supported ? landing : null; },
    async listTasks() { reads.push(["listTasks"]); return []; },
    async listMyTasks() { reads.push(["listMyTasks"]); return []; },
  };
  return { page, order, reads, release };
}

(async () => {
  // 1. the landing request starts before the map is set up, and one request serves restore and refresh
  {
    const landing = { user: { _id: "user_1" }, tasks: [{ task_id: "t1", status: "open", updated_at: 1 }], manualTasks: [], myWork: [] };
    const { page, order, reads, release } = portal({ landing });
    const running = page.init();
    assert.equal(order[0], "restoreSessionWithLanding", "the landing request is first");
    assert.ok(order.indexOf("setupMap") > order.indexOf("restoreSessionWithLanding"), "leaflet boots after the request starts");
    assert.ok(!order.includes("loadTasks"), "init is waiting on the network, not finished");
    release();
    await running;
    assert.deepEqual(reads.map(read => read[0]), ["raLanding"], "one landing request in all");
    assert.equal(reads[0][1].batchId, "nz-temporal-ra-workpack-001");
    assert.equal(page.backendTasksById.get("t1").status, "open", "the first refresh used the restore's landing");
    assert.equal(page.pendingLanding, null);
    assert.ok(order.includes("onBackendSignedIn:false"), "the signed-in handler does not read again");
  }

  // 2. without raLanding the restore returns no lists and the refresh reads the old way
  {
    const { page, reads, release } = portal({ landing: null, supported: false });
    const running = page.init();
    release();
    await running;
    assert.deepEqual(reads.map(read => read[0]), ["raLanding", "raLanding", "listTasks", "listTasks", "listMyTasks"]);
  }

  // 3. no kept sign-in: no request before the map
  {
    const { page, order, reads } = portal({ landing: null });
    page.backend.authToken = "";
    await page.init();
    assert.ok(!order.includes("restoreSessionWithLanding"));
    assert.deepEqual(reads, []);
  }

  console.log("ra-landing: 3 checks passed");
})().catch(error => { console.error(error); process.exit(1); });
