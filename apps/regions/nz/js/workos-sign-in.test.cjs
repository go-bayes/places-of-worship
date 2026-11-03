// workos sessions (jb 2026-11-03): with workosClientId set in
// convex-config.js the shared client asks authkit for the access token
// before every request, a session authkit cannot renew signs out as an
// expired sign-in, a backend refusal reaches the sign-in card once, and the
// sign-in card offers "Sign in with Google" that starts the workos redirect;
// with the id empty, everything stays on the google id token. both portals'
// sign-in cards are checked in both modes. hand-rolled dom, no jsdom
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const CLIENT_ID = "client_01TESTWORKOS";
const GOOGLE_ID = "google-client-id";
const ORIGIN = "http://127.0.0.1:8765";
const PORTAL_PATH = "/apps/regions/nz/verification.html";

const jwtWithExpIn = (seconds, extra = {}) => {
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${b64({ alg: "RS256" })}.${b64({ sub: "user_01", exp: Math.floor(Date.now() / 1000) + seconds, ...extra })}.sig`;
};

function makeStorage() {
  const values = new Map();
  return {
    values,
    get length() { return values.size; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    key(index) { return [...values.keys()][index] ?? null; },
  };
}

function classList() {
  const set = new Set();
  return {
    add(name) { set.add(name); },
    remove(name) { set.delete(name); },
    toggle(name, force) { const on = force === undefined ? !set.has(name) : Boolean(force); if (on) set.add(name); else set.delete(name); return on; },
    contains(name) { return set.has(name); },
  };
}

function makeElement(id) {
  return {
    id, className: "", textContent: "", innerHTML: "", hidden: false, value: "", disabled: false, type: "",
    style: {}, attrs: {}, listeners: {}, children: [], classList: classList(),
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
    replaceChildren(...children) { this.children = children; this.innerHTML = ""; },
    setAttribute(name, value) { this.attrs[name] = value; },
    getAttribute(name) { return this.attrs[name]; },
    hasAttribute(name) { return name in this.attrs; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { width: 0 }; },
    scrollIntoView() {},
    remove() {},
    click() { for (const fn of this.listeners.click || []) fn({ currentTarget: this }); },
  };
}

// one page: storage, a dom of named elements, google's and authkit's
// fakes, a fetch that answers by function path, and the named scripts
function makePage({ config, files, search = "?batch=nz-temporal-ra-workpack-001", pathname = PORTAL_PATH, answers = {}, ids = [] }) {
  const localStorage = makeStorage();
  const sessionStorage = makeStorage();
  const elements = new Map();
  const element = (id) => { const el = makeElement(id); elements.set(id, el); return el; };
  ids.forEach(element);
  const log = { fetches: [], googleRendered: [], googleInitialised: 0, disableAutoSelect: 0, created: [], tokenCalls: 0, signIns: 0, signOuts: [], replaced: [] };
  const authkitState = { user: null, tokens: [], tokenError: null, exchange: false, createError: null };
  const authkit = {
    getUser: () => authkitState.user,
    async getAccessToken() {
      log.tokenCalls += 1;
      if (authkitState.tokenError) throw authkitState.tokenError;
      return authkitState.tokens[Math.min(log.tokenCalls - 1, authkitState.tokens.length - 1)];
    },
    async signIn() { log.signIns += 1; },
    signOut(options) {
      log.signOuts.push(options);
      authkitState.user = null;
      localStorage.removeItem(`workos:refresh-token:${CLIENT_ID}`);
      return Promise.resolve();
    },
  };
  class LoginRequiredError extends Error { constructor() { super("No access token available"); } }
  const location = {
    href: `${ORIGIN}${pathname}${search}`, origin: ORIGIN, pathname, search, hash: "",
    replace(url) { log.replaced.push(url); },
  };
  const window = {
    __POW_TEST_NO_BOOTSTRAP__: true,
    location, localStorage, sessionStorage,
    setTimeout, clearTimeout,
    matchMedia: () => ({ matches: false }),
    isSecureContext: true,
    POW_CONVEX_CONFIG: config,
    POW_COUNTRY_REGISTRY: { countries: [] },
    google: { accounts: { id: {
      initialize() { log.googleInitialised += 1; },
      renderButton(container, options) { log.googleRendered.push({ container, options }); },
      prompt() {},
      disableAutoSelect() { log.disableAutoSelect += 1; },
    } } },
    WorkOSAuthKit: {
      LoginRequiredError,
      async createClient(clientId, options) {
        log.created.push({ clientId, options });
        if (authkitState.createError) throw authkitState.createError;
        if (authkitState.exchange) options.onRedirectCallback?.({});
        return authkit;
      },
    },
  };
  window.window = window;
  const document = {
    title: "",
    body: { classList: classList() },
    getElementById: (id) => elements.get(id) || null,
    // google's script counts as present, so nothing loads in the test
    querySelector: (selector) => (selector.includes("gsi/client") ? {} : null),
    querySelectorAll: () => [],
    createElement: (tag) => makeElement(`${tag}-${elements.size}`),
    head: { appendChild() {} },
  };
  const context = vm.createContext({
    window, document, localStorage, sessionStorage, location, navigator: { geolocation: null },
    URL, URLSearchParams, Map, Set, Date, Number, String, Boolean, Object, Array, Math, JSON, RegExp, Intl, Promise, Error, TypeError, console, setTimeout, clearTimeout,
    atob: (value) => Buffer.from(value, "base64").toString("binary"),
    fetch: async (url, init) => {
      const body = JSON.parse(init.body);
      log.fetches.push({ url, path: body.path, args: body.args[0], authorization: init.headers.Authorization });
      const answer = answers[body.path];
      if (answer === "offline") throw new TypeError("Failed to fetch");
      const value = typeof answer === "function" ? answer(body) : answer;
      const reply = value && value.__error
        ? { status: "error", errorMessage: value.__error }
        : { status: "success", value: value === undefined ? null : value };
      return { status: 200, ok: true, text: async () => JSON.stringify(reply) };
    },
  });
  for (const file of files) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, file), "utf8"), context, { filename: file });
  }
  return { window, document, elements, element, log, authkitState, LoginRequiredError, localStorage, sessionStorage };
}

const workosConfig = { enabled: true, url: "https://example.convex.cloud", googleClientId: GOOGLE_ID, workosClientId: CLIENT_ID };
const googleConfig = { enabled: true, url: "https://example.convex.cloud", googleClientId: GOOGLE_ID, workosClientId: "" };
const landing = { user: { _id: "user_1", email: "ra@example.org", status: "active" }, tasks: [], manualTasks: [], myWork: [] };
const landingArgs = { countryCode: "NZ", batchId: "b1", limit: 1000 };
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

(async () => {
  // 1. the switch: an empty workosClientId keeps the google path whole
  {
    const page = makePage({ config: googleConfig, files: ["convex-task-client.js"], answers: { "users:me": { _id: "user_1" } } });
    const token = jwtWithExpIn(3600);
    page.localStorage.setItem("powConvexAuth:v1", JSON.stringify({ token }));
    const client = new page.window.PowConvexTaskClient(googleConfig);
    assert.equal(client.usesWorkos, false);
    assert.equal(client.configured, true);
    assert.equal(client.canRestoreSession, true, "a kept google token restores");
    const user = await client.restoreSession();
    assert.equal(user._id, "user_1");
    assert.equal(page.log.fetches.at(-1).authorization, `Bearer ${token}`);
    assert.equal(page.log.created.length, 0, "authkit is never created in google mode");
    assert.equal(page.log.tokenCalls, 0);
    await tick();
    assert.equal(page.log.googleInitialised, 1, "google's script serves the hour-end refresh");
    client.signOut({ deliberate: true });
    assert.equal(page.log.disableAutoSelect, 1);
    assert.equal(page.log.signOuts.length, 0);
    // without either id the client is unconfigured
    assert.equal(new page.window.PowConvexTaskClient({ enabled: true, url: "https://example.convex.cloud" }).configured, false);
  }

  // 2. workos mode is configured by the workos id alone, drops a google
  // token left from before the switch, and restores only with a kept
  // workos refresh token
  {
    const page = makePage({ config: workosConfig, files: ["convex-task-client.js"] });
    page.localStorage.setItem("powConvexAuth:v1", JSON.stringify({ token: jwtWithExpIn(3600) }));
    const client = new page.window.PowConvexTaskClient({ ...workosConfig, googleClientId: "" });
    assert.equal(client.usesWorkos, true);
    assert.equal(client.configured, true);
    assert.equal(client.authToken, "", "a google token is not restored in workos mode");
    assert.equal(page.localStorage.getItem("powConvexAuth:v1"), null, "and leaves the device");
    assert.equal(client.canRestoreSession, false);
    page.localStorage.setItem(`workos:refresh-token:${CLIENT_ID}`, "rt_1");
    assert.equal(client.canRestoreSession, true);
  }

  // 3. a kept workos session: authkit is created with the refresh token in
  // local storage (devMode) and the callback page as redirect; every
  // request asks authkit for the token first and carries the newest one
  {
    const page = makePage({ config: workosConfig, files: ["convex-task-client.js"], answers: { "tasks:raLanding": landing, "tasks:listMyTasks": [] } });
    page.localStorage.setItem(`workos:refresh-token:${CLIENT_ID}`, "rt_1");
    const first = jwtWithExpIn(300);
    const second = jwtWithExpIn(300, { sid: "renewed" });
    page.authkitState.user = { id: "user_01", email: "ra@example.org" };
    page.authkitState.tokens = [first, first, second];
    const client = new page.window.PowConvexTaskClient(workosConfig);
    const restored = await client.restoreSessionWithLanding(landingArgs);
    assert.equal(restored.user._id, "user_1");
    assert.equal(page.log.created.length, 1);
    const { clientId, options } = page.log.created[0];
    assert.equal(clientId, CLIENT_ID);
    assert.equal(options.devMode, true, "devMode is set explicitly: the refresh token stays in local storage");
    assert.equal(options.redirectUri, `${ORIGIN}/apps/regions/nz/auth-callback.html`);
    assert.equal(typeof options.onRefreshFailure, "function");
    assert.deepEqual(page.log.fetches.map((entry) => entry.path), ["tasks:raLanding"], "no claimInvite without a completed hand-off");
    assert.equal(page.log.fetches[0].authorization, `Bearer ${first}`);
    const before = page.log.tokenCalls;
    await client.listMyTasks({});
    assert.equal(page.log.tokenCalls, before + 1, "the token is asked for before the request");
    assert.equal(page.log.fetches.at(-1).authorization, `Bearer ${second}`, "the renewed token is the one sent");
    assert.equal(client.signedIn, true);
    assert.equal(page.log.googleInitialised, 0, "no google script in workos mode");
  }

  // 4. a session authkit cannot renew ends as an expired sign-in: the
  // request is not sent, the portal's state is cleared, workos is told
  {
    const page = makePage({ config: workosConfig, files: ["convex-task-client.js"], answers: { "tasks:raLanding": landing } });
    page.localStorage.setItem(`workos:refresh-token:${CLIENT_ID}`, "rt_1");
    page.authkitState.user = { id: "user_01" };
    page.authkitState.tokens = [jwtWithExpIn(300)];
    const client = new page.window.PowConvexTaskClient(workosConfig);
    await client.restoreSessionWithLanding(landingArgs);
    const sent = page.log.fetches.length;
    page.authkitState.tokenError = new page.LoginRequiredError();
    await assert.rejects(client.listMyTasks({}), (error) => error.authExpired === true && /Your sign-in expired/.test(error.message));
    assert.equal(page.log.fetches.length, sent, "nothing is sent without a token");
    assert.equal(client.authToken, "");
    assert.equal(client.user, null);
    assert.equal(JSON.stringify(page.log.signOuts), JSON.stringify([{ navigate: false }]), "workos ends the session without leaving the page");
    assert.equal(page.localStorage.getItem(`workos:refresh-token:${CLIENT_ID}`), null, "the refresh token leaves the device");
  }

  // 5. a transient renewal failure keeps the session for a retry
  {
    const page = makePage({ config: workosConfig, files: ["convex-task-client.js"], answers: { "tasks:raLanding": landing, "tasks:listMyTasks": [] } });
    page.localStorage.setItem(`workos:refresh-token:${CLIENT_ID}`, "rt_1");
    page.authkitState.user = { id: "user_01" };
    page.authkitState.tokens = [jwtWithExpIn(300)];
    const client = new page.window.PowConvexTaskClient(workosConfig);
    await client.restoreSessionWithLanding(landingArgs);
    page.authkitState.tokenError = Object.assign(new Error("Service unavailable"), { isTransient: true });
    await assert.rejects(client.listMyTasks({}), (error) => error.transient === true && !error.authExpired);
    assert.equal(page.log.signOuts.length, 0);
    assert.equal(page.localStorage.getItem(`workos:refresh-token:${CLIENT_ID}`), "rt_1");
    page.authkitState.tokenError = null;
    assert.equal(JSON.stringify(await client.listMyTasks({})), "[]", "the retry goes through");
  }

  // 6. authkit's background refresh failing signs the client out, so the
  // next request reads as an expired sign-in (the backend sees no token)
  {
    const page = makePage({ config: workosConfig, files: ["convex-task-client.js"], answers: { "tasks:raLanding": landing, "tasks:listMyTasks": { __error: "Authentication required." } } });
    page.localStorage.setItem(`workos:refresh-token:${CLIENT_ID}`, "rt_1");
    page.authkitState.user = { id: "user_01" };
    page.authkitState.tokens = [jwtWithExpIn(300)];
    const client = new page.window.PowConvexTaskClient(workosConfig);
    await client.restoreSessionWithLanding(landingArgs);
    page.log.created[0].options.onRefreshFailure({ signIn() {} });
    assert.equal(client.signedIn, false);
    assert.equal(page.localStorage.getItem(`workos:refresh-token:${CLIENT_ID}`), null);
    await assert.rejects(client.listMyTasks({}), (error) => error.authExpired === true);
    assert.equal(page.log.fetches.at(-1).authorization, undefined);
  }

  // 7. the return from workos: the callback page marked the hand-off
  // complete, so the invitation is claimed (with the ra's initials) before
  // the landing; the hand-off is taken once
  {
    const page = makePage({ config: workosConfig, files: ["convex-task-client.js"], answers: { "users:claimInvite": "user_1", "tasks:raLanding": landing } });
    page.localStorage.setItem(`workos:refresh-token:${CLIENT_ID}`, "rt_1");
    page.sessionStorage.setItem("powWorkosReturn:v1", JSON.stringify({ returnTo: PORTAL_PATH, initials: "JB", signedInAt: Date.now() }));
    page.authkitState.user = { id: "user_01" };
    page.authkitState.tokens = [jwtWithExpIn(300)];
    const client = new page.window.PowConvexTaskClient(workosConfig);
    const restored = await client.restoreSessionWithLanding(landingArgs);
    assert.equal(restored.user._id, "user_1");
    assert.deepEqual(page.log.fetches.map((entry) => entry.path), ["users:claimInvite", "tasks:raLanding"]);
    assert.deepEqual(page.log.fetches[0].args, { initials: "JB" });
    assert.equal(page.sessionStorage.getItem("powWorkosReturn:v1"), null);
  }

  // 8. a refusal from the backend (here: no email claim) ends the workos
  // session and reaches the sign-in card once, never silently
  {
    const refusal = "This WorkOS sign-in carries no email address, so the project cannot match it to an invitation. The project lead must add the email claim to the WorkOS session template.";
    const page = makePage({ config: workosConfig, files: ["convex-task-client.js"], answers: { "users:claimInvite": { __error: refusal }, "tasks:raLanding": { __error: refusal }, "users:me": { __error: refusal } } });
    page.localStorage.setItem(`workos:refresh-token:${CLIENT_ID}`, "rt_1");
    page.sessionStorage.setItem("powWorkosReturn:v1", JSON.stringify({ returnTo: PORTAL_PATH, initials: "", signedInAt: Date.now() }));
    page.authkitState.user = { id: "user_01" };
    page.authkitState.tokens = [jwtWithExpIn(300)];
    const client = new page.window.PowConvexTaskClient(workosConfig);
    const restored = await client.restoreSessionWithLanding(landingArgs);
    assert.equal(restored.user, null);
    assert.equal(page.log.signOuts.length, 1, "the workos session ends");
    assert.equal(page.localStorage.getItem(`workos:refresh-token:${CLIENT_ID}`), null);
    const host = page.element("signInHost");
    const errors = [];
    await client.renderSignInButton(host, { onError: (error) => errors.push(error.message) });
    assert.deepEqual(errors, [refusal], "the card is told why");
    await client.renderSignInButton(host, { onError: (error) => errors.push(error.message) });
    assert.equal(errors.length, 1, "and only once");
  }

  // 9. a kept session restored while offline keeps the refresh token
  {
    const page = makePage({ config: workosConfig, files: ["convex-task-client.js"], answers: { "tasks:raLanding": "offline", "users:me": "offline" } });
    page.localStorage.setItem(`workos:refresh-token:${CLIENT_ID}`, "rt_1");
    page.authkitState.user = { id: "user_01" };
    page.authkitState.tokens = [jwtWithExpIn(300)];
    const client = new page.window.PowConvexTaskClient(workosConfig);
    const restored = await client.restoreSessionWithLanding(landingArgs);
    assert.equal(restored.user, null);
    assert.equal(page.log.signOuts.length, 0);
    assert.equal(page.localStorage.getItem(`workos:refresh-token:${CLIENT_ID}`), "rt_1", "the session waits for the connection");
    assert.match(client.signInError.message, /Could not reach the project backend/);
  }

  // 10. a kept refresh token workos no longer honours restores nobody,
  // quietly, as an expired google token does
  {
    const page = makePage({ config: workosConfig, files: ["convex-task-client.js"] });
    page.localStorage.setItem(`workos:refresh-token:${CLIENT_ID}`, "rt_dead");
    page.authkitState.user = null;
    const client = new page.window.PowConvexTaskClient(workosConfig);
    assert.equal(await client.restoreSession(), null);
    assert.equal(page.log.fetches.length, 0);
    assert.equal(client.signInError, null);
  }

  // 11. the sign-in button: "Sign in with Google", which records where to
  // come back to and the initials, then hands over to workos
  {
    const page = makePage({ config: workosConfig, files: ["convex-task-client.js"] });
    const client = new page.window.PowConvexTaskClient(workosConfig);
    const host = page.element("signInHost");
    await client.renderSignInButton(host, { width: 240, initials: "JB" });
    assert.equal(host.children.length, 1);
    const button = host.children[0];
    assert.equal(button.textContent, "Sign in with Google");
    assert.equal(button.type, "button");
    assert.match(button.className, /\bprimary\b/);
    assert.equal(button.style.width, "240px");
    assert.equal(page.log.googleRendered.length, 0, "no google button in workos mode");
    button.click();
    await tick();
    assert.equal(page.log.signIns, 1, "the workos redirect starts");
    const handOff = JSON.parse(page.sessionStorage.getItem("powWorkosReturn:v1"));
    assert.equal(handOff.returnTo, `${PORTAL_PATH}?batch=nz-temporal-ra-workpack-001`);
    assert.equal(handOff.initials, "JB");
    assert.equal(handOff.signedInAt, undefined, "not complete until the callback page says so");
  }

  // 12. the callback page: a completed exchange marks the hand-off and
  // returns to the page that started it; a foreign return address is
  // replaced by the portal; a failed exchange stays with a link back
  {
    const page = makePage({ config: workosConfig, files: ["convex-task-client.js"], pathname: "/apps/regions/nz/auth-callback.html", search: "?code=abc&state=" });
    page.sessionStorage.setItem("powWorkosReturn:v1", JSON.stringify({ returnTo: "/apps/regions/nz/review.html?country=vu", initials: "JB", startedAt: Date.now() }));
    page.authkitState.exchange = true;
    assert.equal(await page.window.PowConvexTaskClient.completeWorkosCallback(workosConfig), true);
    assert.equal(page.log.created[0].options.devMode, true);
    assert.equal(page.log.created[0].options.redirectUri, `${ORIGIN}/apps/regions/nz/auth-callback.html`);
    assert.deepEqual(page.log.replaced, ["/apps/regions/nz/review.html?country=vu"]);
    const marked = JSON.parse(page.sessionStorage.getItem("powWorkosReturn:v1"));
    assert.ok(marked.signedInAt > 0);
    assert.equal(marked.initials, "JB");

    const foreign = makePage({ config: workosConfig, files: ["convex-task-client.js"], pathname: "/apps/regions/nz/auth-callback.html", search: "?code=abc" });
    foreign.sessionStorage.setItem("powWorkosReturn:v1", JSON.stringify({ returnTo: "https://evil.example/steal" }));
    foreign.authkitState.exchange = true;
    await foreign.window.PowConvexTaskClient.completeWorkosCallback(workosConfig);
    assert.deepEqual(foreign.log.replaced, ["verification.html"], "another site is never the return");

    const failed = makePage({ config: workosConfig, files: ["convex-task-client.js"], pathname: "/apps/regions/nz/auth-callback.html", search: "?code=abc" });
    failed.sessionStorage.setItem("powWorkosReturn:v1", JSON.stringify({ returnTo: PORTAL_PATH }));
    const reports = [];
    assert.equal(await failed.window.PowConvexTaskClient.completeWorkosCallback(workosConfig, (message, back) => reports.push([message, back])), false);
    assert.deepEqual(failed.log.replaced, []);
    assert.deepEqual(reports, [["Sign-in did not complete. Go back and sign in again.", PORTAL_PATH]]);
    assert.equal(failed.sessionStorage.getItem("powWorkosReturn:v1"), null);

    const off = makePage({ config: googleConfig, files: ["convex-task-client.js"], pathname: "/apps/regions/nz/auth-callback.html" });
    const offReports = [];
    assert.equal(await off.window.PowConvexTaskClient.completeWorkosCallback(googleConfig, (message) => offReports.push(message)), false);
    assert.equal(off.log.created.length, 0);
    assert.match(offReports[0], /not switched on/);
  }

  // 13. the contributor portal's sign-in card in both modes: the same
  // host, google's button or the workos button
  for (const mode of ["google", "workos"]) {
    const config = mode === "workos" ? workosConfig : googleConfig;
    const page = makePage({
      config,
      files: ["convex-task-client.js", "occupancy-contract.js", "function-chain-contract.js", "task-presentation.js", "verification-map.js"],
      ids: ["backendPanel", "googleSignInButton"],
    });
    const app = Object.create(page.window.NzVerificationMap.prototype);
    app.backend = new page.window.PowConvexTaskClient({ ...config, countryCode: "NZ" });
    app.backendUser = null;
    app.pendingDeepLink = null;
    app.backendLastError = "";
    app.syncPortalChrome = () => {};
    app.getRaInitials = () => "JB";
    app.renderBackendPanel();
    await tick();
    assert.match(page.elements.get("backendPanel").innerHTML, /id="googleSignInButton"/);
    const host = page.elements.get("googleSignInButton");
    if (mode === "google") {
      assert.equal(page.log.googleRendered.length, 1, "google renders its button");
      assert.equal(page.log.googleRendered[0].container, host);
      assert.equal(host.children.length, 0);
    } else {
      assert.equal(page.log.googleRendered.length, 0);
      assert.equal(host.children[0].textContent, "Sign in with Google");
      host.children[0].click();
      await tick();
      assert.equal(page.log.signIns, 1);
      assert.equal(JSON.parse(page.sessionStorage.getItem("powWorkosReturn:v1")).initials, "JB");
    }
  }

  // 14. the review portal's sign-in card in both modes
  for (const mode of ["google", "workos"]) {
    const config = mode === "workos" ? workosConfig : googleConfig;
    const page = makePage({
      config,
      search: "",
      pathname: "/apps/regions/nz/review.html",
      files: ["convex-task-client.js", "task-presentation.js", "review-portal.js"],
      ids: ["authPanel", "authStatus", "detailPanel", "queueGroupBy", "queueClaimFilter", "queueList", "queueStatus", "queueStatusText", "refreshQueue", "signInButton", "reviewSnapshotHost", "headerAccount", "queueRollup", "queueControls", "pageHeading", "reviewBoundary"],
    });
    const portal = page.window.__PowReviewPortalTest;
    portal.state.user = null;
    portal.renderAuth();
    await tick();
    assert.equal(page.elements.get("authPanel").hidden, false);
    assert.match(page.elements.get("authStatus").textContent, /Sign in to load reviewer-only tasks/);
    const host = page.elements.get("signInButton");
    if (mode === "google") {
      assert.equal(page.log.googleRendered[0]?.container, host);
    } else {
      assert.equal(page.log.googleRendered.length, 0);
      assert.equal(host.children[0].textContent, "Sign in with Google");
      host.children[0].click();
      await tick();
      assert.equal(JSON.parse(page.sessionStorage.getItem("powWorkosReturn:v1")).returnTo, "/apps/regions/nz/review.html");
    }
  }

  console.log("workos-sign-in: client modes, hand-off and both sign-in cards ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
