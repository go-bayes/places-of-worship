// clerk sessions (contributor-access brief c1, section 4.4): the client
// loads clerk from the instance's frontend api, asks clerk for a fresh
// "convex" token on every request, turns a clerk session into a project user
// through claimInvite and me, shows an account note with a sign-out button
// when the backend refuses the address, and follows sessions that end
// elsewhere. the google-era token on the device is removed
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const PUBLISHABLE_KEY = "pk_test_c3VyZS1saXphcmQtNTAuY2xlcmsuYWNjb3VudHMuZGV2JA";
const HOST = "sure-lizard-50.clerk.accounts.dev";

function harness({ session = null, cookie = "", responses = {}, failLoads = 0, failSignOuts = 0, networkFailSignOuts = 0, offlineReloads = 0, storage, storageFails = "" } = {}) {
  const values = storage || new Map([["powConvexAuth:v1", JSON.stringify({ token: "old-google-token" })]]);
  // storageFails: "all" throws on every call (blocked storage), "writes"
  // throws on writes only (a full or read-only store)
  const refuse = (kind) => { if (storageFails === "all" || (storageFails === "writes" && kind === "write")) throw new Error("storage refused"); };
  const localStorage = {
    getItem(key) { refuse("read"); return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { refuse("write"); values.set(key, String(value)); },
    removeItem(key) { refuse("write"); values.delete(key); },
  };
  const calls = { scripts: [], load: [], getToken: [], mountSignIn: [], unmountSignIn: 0, signOut: 0, reload: 0, fetches: [] };
  // the sessions clerk's server still holds for this browser
  const serverSessions = new Set(session ? [session.id] : []);
  const listeners = [];
  const clerk = {
    session,
    user: session ? { primaryEmailAddress: { emailAddress: session.email } } : null,
    async load(options) { calls.load.push(options); },
    addListener(listener) { listeners.push(listener); listener({ session: clerk.session, user: clerk.user }); return () => {}; },
    mountSignIn(node, props) { calls.mountSignIn.push({ node, props }); node.mounted = true; },
    unmountSignIn(node) { calls.unmountSignIn += 1; node.mounted = false; },
    async signOut() {
      calls.signOut += 1;
      const id = clerk.session?.id || [...serverSessions][0];
      // like clerk-js: the local session goes even when the server refuses
      if (failSignOuts > 0) { failSignOuts -= 1; clerk.setSession(null); throw new Error("revocation refused"); }
      // like clerk-js on network_error: resolves, the server never heard
      if (networkFailSignOuts > 0) { networkFailSignOuts -= 1; clerk.setSession(null); return; }
      serverSessions.clear();
      if (id) serverSessions.delete(id);
      clerk.setSession(null);
    },
    client: {
      async reload() {
        calls.reload += 1;
        if (offlineReloads > 0) { offlineReloads -= 1; throw new Error("network_error"); }
        return { sessions: [...serverSessions].map((id) => ({ id, status: "active" })) };
      },
    },
    setSession(next) {
      if (next) serverSessions.add(next.id);
      clerk.session = next;
      clerk.user = next ? { primaryEmailAddress: { emailAddress: next.email } } : null;
      listeners.forEach((listener) => listener({ session: clerk.session, user: clerk.user }));
    },
  };
  const makeSession = (id, email) => ({
    id, email,
    async getToken(options) { calls.getToken.push(options); return `jwt-for-${id}-${calls.getToken.length}`; },
  });
  if (session) Object.assign(session, makeSession(session.id, session.email));
  const sessionValues = new Map();
  const sessionStorage = {
    getItem(key) { return sessionValues.has(key) ? sessionValues.get(key) : null; },
    setItem(key, value) { sessionValues.set(key, String(value)); },
    removeItem(key) { sessionValues.delete(key); },
  };
  const window = {
    localStorage,
    sessionStorage,
    location: { href: "https://religionmap.org/apps/regions/nz/verification.html?country=vu", origin: "https://religionmap.org", pathname: "/apps/regions/nz/verification.html", assign(url) { calls.assigned = url; } },
    getComputedStyle() { return { getPropertyValue(name) { return name === "--panel" ? " #17202a " : ""; } }; },
  };
  const document = {
    cookie,
    documentElement: {},
    querySelector() { return null; },
    createElement(tag) { const attributes = {}; return { tag, attributes, setAttribute(name, value) { attributes[name] = value; } }; },
    head: {
      appendChild(script) {
        calls.scripts.push({ src: script.src, attributes: script.attributes, crossOrigin: script.crossOrigin });
        if (failLoads > 0) { failLoads -= 1; setTimeout(() => script.onerror?.(), 0); return; }
        if (script.src.includes("@clerk/ui@")) window.__internal_ClerkUICtor = function ClerkUI() {};
        if (script.src.includes("@clerk/clerk-js@")) window.Clerk = clerk;
        if (script.src.includes("accounts.google.com/gsi/client")) {
          window.google = { accounts: { id: {
            initialize(options) { calls.gsiInit = options; },
            renderButton() { calls.gsiButtons = (calls.gsiButtons || 0) + 1; },
          } } };
        }
        setTimeout(() => script.onload?.(), 0);
      },
    },
  };
  const context = vm.createContext({
    window, document, URL,
    setTimeout, clearTimeout, Date, JSON, Map, Set, Number, String, Boolean, Object, Math, Promise, Error, RegExp, console,
    atob: (value) => Buffer.from(value, "base64").toString("binary"),
    fetch: async (url, init) => {
      const body = JSON.parse(init.body);
      calls.fetches.push({ url, headers: init.headers, body });
      const response = responses[body.path] ?? { status: 200, body: { status: "success", value: null } };
      const resolved = await (typeof response === "function" ? response(body) : response);
      return { status: resolved.status, ok: resolved.status < 400, text: async () => (typeof resolved.raw === "string" ? resolved.raw : JSON.stringify(resolved.body)) };
    },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "convex-task-client.js"), "utf8"), context, { filename: "convex-task-client.js" });
  return { Client: window.PowConvexTaskClient, window, document, clerk, calls, values, sessionValues, makeSession };
}

const config = { enabled: true, url: "https://example.convex.cloud", clerkPublishableKey: PUBLISHABLE_KEY };
const ok = (value) => ({ status: 200, body: { status: "success", value } });
const refused = (message) => ({ status: 200, body: { status: "error", errorMessage: message } });
const member = { _id: "user_1", email: "guy@example.org", roles: ["ra"], status: "active" };
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));
const container = () => ({
  innerHTML: "", children: [], parts: {},
  replaceChildren(...nodes) { this.children = nodes; this.innerHTML = ""; },
  querySelector(selector) {
    if (selector === "[data-pow-sign-out]" && this.innerHTML.includes("data-pow-sign-out")) {
      return (this.button ||= { addEventListener: (_type, handler) => { this.click = handler; } });
    }
    const name = selector.replace(/^\[data-pow-|\]$/g, "");
    if (["google-confirm", "migration-status"].includes(name) && this.innerHTML.includes(`data-pow-${name}`)) {
      return (this.parts[name] ||= { innerHTML: "", textContent: "" });
    }
    return null;
  },
});

(async () => {
  // 1. configuration: the publishable key names the frontend api host; the
  // google-era token leaves the device
  {
    const h = harness();
    const client = new h.Client(config);
    assert.equal(client.configured, true);
    assert.equal(client.clerkFrontendApi, HOST);
    assert.equal(h.values.has("powConvexAuth:v1"), false, "the google token kept on the device is removed");
    assert.equal(new h.Client({ ...config, clerkPublishableKey: "" }).configured, false);
    assert.equal(new h.Client({ ...config, googleClientId: "old", clerkPublishableKey: undefined }).configured, false);
    assert.equal(client.mayHaveSession, false, "no clerk cookie, nothing to restore");
    assert.equal(await client.restoreSession(), null);
  }

  // 2. a reload with a live clerk session names the user again: clerk loads
  // from its frontend api (ui bundle first), then claimInvite and me run
  // with a fresh convex token each
  {
    const h = harness({ session: { id: "sess_1", email: "guy@example.org" }, cookie: "other=1; __client_uat_abc=1790000000", responses: { "users:claimInvite": ok("user_1"), "users:me": ok(member) } });
    const client = new h.Client(config);
    assert.equal(client.mayHaveSession, true, "clerk's cookie hints at a session");
    const user = await client.restoreSession();
    assert.equal(user?._id, "user_1");
    assert.equal(client.signedIn, true);
    assert.deepEqual(h.calls.scripts.map((script) => script.src), [
      `https://${HOST}/npm/@clerk/ui@1/dist/ui.browser.js`,
      `https://${HOST}/npm/@clerk/clerk-js@6/dist/clerk.browser.js`,
    ]);
    assert.equal(h.calls.scripts[1].attributes["data-clerk-publishable-key"], PUBLISHABLE_KEY);
    assert.equal(h.calls.scripts[1].crossOrigin, "anonymous");
    assert.equal(h.calls.load.length, 1);
    assert.equal(typeof h.calls.load[0].ui.ClerkUI, "function", "the ui bundle is handed to clerk.load");
    assert.equal(h.calls.load[0].appearance.variables.colorBackground, "#17202a", "the card takes the page's dark tokens");
    assert.deepEqual(h.calls.fetches.map((fetch) => fetch.body.path), ["users:claimInvite", "users:me"]);
    assert.ok(h.calls.getToken.every((options) => options.template === "convex"), "every token comes from the convex template");
    assert.notEqual(h.calls.fetches[0].headers.Authorization, h.calls.fetches[1].headers.Authorization, "a fresh token per request");
    assert.match(h.calls.fetches[1].headers.Authorization, /^Bearer jwt-for-sess_1-/);
    // later requests ask clerk again rather than reusing a stored token
    await client.listTasks({ countryCode: "NZ" });
    assert.equal(h.calls.getToken.length, 3);
    // a second restore changes nothing
    assert.equal((await client.restoreSession())._id, "user_1");
    assert.equal(h.calls.load.length, 1, "clerk loads once");
    // clerk navigating to this page after sign-in or sign-out never reloads it
    client.navigate(h.window.location.href);
    assert.equal(h.calls.assigned, undefined);
  }

  // 3. nobody signed in: the card mounts clerk's sign-in (google or an email
  // code, sign-up inline); finishing it in the card activates the invitation
  {
    const h = harness({ responses: { "users:claimInvite": ok("user_1"), "users:me": ok(member) } });
    const client = new h.Client(config);
    const host = container();
    const seen = [];
    await client.renderSignInButton(host, { initials: "GL", onSignedIn: (user) => seen.push(user._id) });
    assert.equal(h.calls.mountSignIn.length, 1);
    assert.deepEqual(host.children, [h.calls.mountSignIn[0].node], "clerk's form sits in the card");
    assert.equal(h.calls.mountSignIn[0].props.withSignUp, true);
    assert.equal(h.calls.fetches.length, 0, "no backend call before sign-in");
    // the page repaints its card: the same form moves across, mounted once,
    // so a half-typed address survives
    const repainted = container();
    await client.renderSignInButton(repainted, { initials: "GL", onSignedIn: (user) => seen.push(user._id) });
    assert.equal(h.calls.mountSignIn.length, 1);
    assert.equal(repainted.children[0], h.calls.mountSignIn[0].node);
    // two repaints racing the first clerk load leave the form in the newest
    const race = harness();
    const racer = new race.Client(config);
    const older = container();
    const newer = container();
    await Promise.all([racer.renderSignInButton(older, {}), racer.renderSignInButton(newer, {})]);
    assert.equal(race.calls.mountSignIn.length, 1);
    assert.equal(newer.children[0], race.calls.mountSignIn[0].node);
    assert.equal(older.children.length, 0);
    h.clerk.setSession(h.makeSession("sess_2", "guy@example.org"));
    await tick();
    assert.deepEqual(seen, ["user_1"], "the page hears of the sign-in");
    assert.equal(client.signedIn, true);
    assert.equal(h.calls.fetches[0].body.path, "users:claimInvite");
    assert.equal(h.calls.fetches[0].body.args[0].initials, "GL");
    assert.equal(h.calls.unmountSignIn, 1, "the finished form is released");
  }

  // 4. an uninvited applicant: the backend refuses the claim, the card shows
  // the address and a sign-out button, not the portal, and asks only once
  {
    const h = harness({ session: { id: "sess_3", email: "stranger@example.org" }, cookie: "__client_uat=1790000000", responses: { "users:claimInvite": refused("[Request ID: 7e3c] Server Error Uncaught Error: No pending project invitation found for this email. at handler (../convex/users.ts:370:24)") } });
    const client = new h.Client(config);
    assert.equal(await client.restoreSession(), null, "no project user");
    assert.equal(client.signedIn, false);
    const host = container();
    const signedOut = [];
    const errors = [];
    client.setLifecycle({ onSignedOut: (event) => signedOut.push(event?.deliberate ? "deliberate" : "ended") });
    await client.renderSignInButton(host, { onError: (error) => errors.push(error.message) });
    assert.equal(h.calls.mountSignIn.length, 0, "a signed-in session gets no second sign-in form");
    assert.match(host.innerHTML, /stranger@example\.org/);
    assert.match(host.innerHTML, /no project access yet/);
    assert.match(host.innerHTML, /data-pow-sign-out/);
    assert.doesNotMatch(host.innerHTML, /Request ID|Uncaught/, "no raw server text on the card");
    assert.deepEqual(errors, [], "a refusal the card explains is not also reported as a page error");
    assert.equal(h.calls.fetches.filter((fetch) => fetch.body.path === "users:claimInvite").length, 1, "the refused claim is not retried on every render");
    await host.click();
    assert.equal(h.calls.signOut, 1, "the button ends the clerk session");
    assert.deepEqual(signedOut, ["deliberate"], "and returns the page to the sign-in card");
    await client.renderSignInButton(host, {});
    assert.equal(h.calls.mountSignIn.length, 1);
  }

  // 5. a session that ends in another tab signs the portal out cleanly
  {
    const h = harness({ session: { id: "sess_4", email: "guy@example.org" }, cookie: "__client_uat=1", responses: { "users:claimInvite": ok("user_1"), "users:me": ok(member) } });
    const client = new h.Client(config);
    const ended = [];
    client.setLifecycle({ onSignedOut: (event) => ended.push(event?.deliberate ? "deliberate" : "ended") });
    await client.renderSignInButton(container(), {});
    await tick();
    assert.equal(client.signedIn, true);
    h.clerk.setSession(null);
    assert.equal(client.signedIn, false);
    assert.deepEqual(ended, ["ended"]);
  }

  // 6. the sign-out button ends the clerk session without a second signal;
  // an automatic sign-out (a refused token) keeps clerk's session, but the
  // page hears of it before the caller does, so it clears what the person
  // loaded (#153 round 1, sol 2)
  {
    const h = harness({ session: { id: "sess_5", email: "guy@example.org" }, cookie: "__client_uat=1", responses: { "users:claimInvite": ok("user_1"), "users:me": ok(member), "tasks:listTasks": { status: 401, body: { errorMessage: "Authentication required." } } } });
    const client = new h.Client(config);
    const ended = [];
    client.setLifecycle({ onSignedOut: (event) => ended.push(event?.deliberate ? "deliberate" : "ended") });
    await client.renderSignInButton(container(), {});
    await tick();
    const order = [];
    client.setLifecycle({ onSignedOut: (event) => { order.push("page cleared"); ended.push(event?.deliberate ? "deliberate" : "ended"); } });
    await assert.rejects(client.listTasks({}).catch((error) => { order.push("caller told"); throw error; }), (error) => error.authExpired === true);
    assert.equal(client.user, null);
    assert.deepEqual(ended, ["ended"], "a refused token ends the page's session");
    assert.deepEqual(order, ["page cleared", "caller told"]);
    assert.equal(h.calls.signOut, 0, "an expiry does not end the clerk session");
    const reclaimed = await client.restoreSession();
    assert.equal(reclaimed?._id, "user_1", "the held session admits the user again");
    await client.signOut({ deliberate: true });
    assert.equal(h.calls.signOut, 1);
    assert.equal(client.signedIn, false);
    assert.deepEqual(ended, ["ended"], "a deliberate sign-out is not reported as a session ending elsewhere");
    await client.renderSignInButton(container(), {});
    assert.equal(h.calls.mountSignIn.length, 1, "the card offers sign-in again");
  }

  // 7. clerk cannot load (a blocked or slow network): the card says so and
  // retries on request, without throwing back to the page
  {
    const h = harness({ failLoads: 1 });
    const client = new h.Client(config);
    const host = { ...container(), querySelector(selector) { return selector === "[data-pow-retry]" && this.innerHTML.includes("data-pow-retry") ? { addEventListener: (_type, handler) => { this.retry = handler; } } : null; } };
    await client.renderSignInButton(host, {});
    assert.match(host.innerHTML, /Sign-in could not load/);
    assert.equal(h.calls.mountSignIn.length, 0);
    host.retry();
    await tick();
    assert.equal(h.calls.mountSignIn.length, 1, "the retry loads clerk and shows the form");
    assert.equal(host.children[0], h.calls.mountSignIn[0].node);
  }

  // 8. a session restored on load, never shown the card, still hears of a
  // sign-out in another tab (astra m1)
  {
    const h = harness({ session: { id: "sess_8", email: "guy@example.org" }, cookie: "__client_uat=1", responses: { "users:claimInvite": ok("user_1"), "users:me": ok(member) } });
    const client = new h.Client(config);
    const ended = [];
    client.setLifecycle({ onSignedOut: (event) => ended.push(event?.deliberate ? "deliberate" : "ended") });
    assert.equal((await client.restoreSession())._id, "user_1");
    assert.equal(h.calls.mountSignIn.length, 0, "no card was rendered");
    h.clerk.setSession(null);
    assert.deepEqual(ended, ["ended"]);
    assert.equal(client.signedIn, false);
  }

  // 9. clerk refuses the sign-out: the promise rejects, the session stays
  // known, the card offers the retry instead of re-admitting the user, a
  // reload retries before restoring, and the retry reports completion only
  // once clerk confirms (sol m2, astra m3)
  {
    const storage = new Map();
    const responses = { "users:claimInvite": ok("user_1"), "users:me": ok(member) };
    const h = harness({ session: { id: "sess_9", email: "guy@example.org" }, cookie: "__client_uat=1", responses, failSignOuts: 1, storage });
    const client = new h.Client(config);
    const ended = [];
    client.setLifecycle({ onSignedOut: (event) => ended.push(event?.deliberate ? "deliberate" : "ended") });
    await client.restoreSession();
    const claims = () => h.calls.fetches.filter((fetch) => fetch.body.path === "users:claimInvite").length;
    const claimsBefore = claims();
    await assert.rejects(client.signOut({ deliberate: true }), (error) => error.signOutFailed === true && /may still be signed in/.test(error.message));
    assert.equal(client.signedIn, false, "the page shows nobody");
    assert.equal(client.sessionId, "sess_9", "the unrevoked session is still known");
    assert.equal(storage.get("powSignOutPending:v1"), "sess_9", "a reload will retry");
    assert.deepEqual(ended, [], "no completion reported");
    const host = container();
    await client.renderSignInButton(host, {});
    assert.match(host.innerHTML, /Sign-out did not finish/);
    assert.match(host.innerHTML, /Try sign-out again/);
    assert.equal(claims(), claimsBefore, "the card does not sign the user back in");
    // a reload in the same browser retries the sign-out instead of restoring
    const reload = harness({ session: { id: "sess_9", email: "guy@example.org" }, cookie: "__client_uat=1", responses, failSignOuts: 1, storage });
    const reloaded = new reload.Client(config);
    assert.equal(await reloaded.restoreSession(), null, "a pending sign-out is never undone by a reload");
    assert.equal(reload.calls.signOut, 1);
    assert.equal(reload.calls.fetches.length, 0, "and the backend is not asked to admit the session");
    // the retry in the first page succeeds this time, although clerk had
    // already dropped its local copy of the session
    assert.equal(h.clerk.session, null);
    await host.click();
    assert.equal(h.calls.signOut, 2);
    assert.deepEqual(ended, ["deliberate"], "completion reported once clerk confirms");
    assert.equal(storage.has("powSignOutPending:v1"), false);
  }

  // 11. clerk resolves a sign-out whose request never reached its server
  // (network_error); the client asks the server for this browser's
  // sessions and, finding the session still live, reports a failure and
  // keeps the reload retry. an offline confirmation confirms nothing (sol
  // and astra round 2)
  {
    const storage = new Map();
    const responses = { "users:claimInvite": ok("user_1"), "users:me": ok(member) };
    const h = harness({ session: { id: "sess_11", email: "guy@example.org" }, cookie: "__client_uat=1", responses, networkFailSignOuts: 1, storage });
    const client = new h.Client(config);
    const ended = [];
    client.setLifecycle({ onSignedOut: (event) => ended.push(event?.deliberate ? "deliberate" : "ended") });
    await client.restoreSession();
    await assert.rejects(client.signOut({ deliberate: true }), (error) => error.signOutFailed === true);
    assert.equal(h.clerk.session, null, "clerk had already dropped its local session");
    assert.equal(h.calls.reload, 1, "the server was asked");
    assert.equal(storage.get("powSignOutPending:v1"), "sess_11", "the reload retry is kept");
    const host = container();
    await client.renderSignInButton(host, {});
    assert.match(host.innerHTML, /Sign-out did not finish/);
    await host.click();
    assert.deepEqual(ended, ["deliberate"], "confirmed on the retry");
    assert.equal(storage.has("powSignOutPending:v1"), false);

    const offline = harness({ session: { id: "sess_12", email: "guy@example.org" }, cookie: "__client_uat=1", responses, offlineReloads: 1, storage: new Map() });
    const offlineClient = new offline.Client(config);
    await offlineClient.restoreSession();
    await assert.rejects(offlineClient.signOut({ deliberate: true }), (error) => error.signOutFailed === true, "unconfirmed counts as failed");
  }

  // 10. the publishable key must name an approved clerk host (sol and astra, low)
  {
    const h = harness();
    const encode = (host) => Buffer.from(`${host}$`).toString("base64");
    const keyed = (key) => new h.Client({ ...config, clerkPublishableKey: key });
    assert.equal(keyed(`pk_test_${encode("example-attacker.org")}`).configured, false, "an unlisted host is refused");
    assert.equal(keyed(`pk_test_${encode("sure-lizard-50.clerk.accounts.dev.example.org")}`).configured, false);
    assert.equal(keyed(`pk_test_${Buffer.from("sure-lizard-50.clerk.accounts.dev").toString("base64")}`).configured, false, "no trailing $");
    assert.equal(keyed(`pk_test_${encode("sure-lizard-50.clerk.accounts.dev$x")}`).configured, false);
    assert.equal(keyed(`sk_test_${encode(HOST)}`).configured, false, "a secret-key prefix is refused");
    assert.equal(keyed(`pk_test_${encode(HOST)}<script>`).configured, false);
    assert.equal(keyed(PUBLISHABLE_KEY).clerkFrontendApi, HOST);
    await keyed(`pk_test_${encode("example-attacker.org")}`).renderSignInButton(container(), {});
    assert.equal(h.calls.scripts.length, 0, "no script loads for a refused key");
  }

  // 12. r-c18, bound on the server: an existing google member signed in to
  // clerk is asked to confirm their google account. the clerk sign-in asks
  // for the pairing, the google sign-in approves it with its own token, and
  // the claim is retried with the clerk token; nothing is stored
  {
    const confirm = "[Request ID: 1] Server Error Uncaught Error: This address belongs to an existing member who signed in with Google. Confirm that Google account first, then sign in again. at handler (x)";
    let approved = false;
    const responses = {
      "users:claimInvite": () => (approved ? ok("user_1") : refused(confirm)),
      "users:me": ok(member),
      "users:requestIdentityMigration": ok({ nonce: "n-1", expires_at: Date.now() + 600000 }),
      "users:approveIdentityMigration": (body) => { approved = body.args[0].nonce === "n-1"; return ok({ approved: true, expires_at: Date.now() + 600000 }); },
    };
    const h = harness({ session: { id: "sess_m", email: "guy@example.org" }, cookie: "__client_uat=1", responses });
    const client = new h.Client({ ...config, googleMigrationClientId: "google-client-id" });
    const seen = [];
    const host = container();
    await client.renderSignInButton(host, { onSignedIn: (user) => seen.push(user._id) });
    assert.match(host.innerHTML, /Confirm your existing account for the new sign-in/);
    assert.match(host.innerHTML, /guy@example\.org/);
    await tick();
    assert.ok(h.calls.scripts.some((script) => script.src === "https://accounts.google.com/gsi/client"), "google's button loads for the step");
    assert.equal(h.calls.gsiInit.client_id, "google-client-id");
    assert.equal(h.calls.gsiButtons, 1);
    await h.calls.gsiInit.callback({ credential: "google-id-token" });
    await tick();
    const request = h.calls.fetches.find((fetch) => fetch.body.path === "users:requestIdentityMigration");
    const approval = h.calls.fetches.find((fetch) => fetch.body.path === "users:approveIdentityMigration");
    assert.match(request.headers.Authorization, /^Bearer jwt-for-sess_m-/, "the clerk sign-in asks");
    assert.equal(approval.headers.Authorization, "Bearer google-id-token", "the google sign-in approves");
    assert.equal(approval.body.args[0].nonce, "n-1");
    const lastClaim = h.calls.fetches.filter((fetch) => fetch.body.path === "users:claimInvite").at(-1);
    assert.match(lastClaim.headers.Authorization, /^Bearer jwt-for-sess_m-/, "the claim is the clerk sign-in's");
    assert.deepEqual(Object.keys(lastClaim.body.args[0]), [], "and carries no grant or nonce");
    assert.deepEqual(seen, ["user_1"], "the member is in");
    assert.equal(h.sessionValues.size, 0, "nothing reaches storage");
  }

  // 13. with the move closed, the same refusal is a plain note: no google step
  {
    const h = harness({ session: { id: "sess_c", email: "guy@example.org" }, cookie: "__client_uat=1", responses: { "users:claimInvite": refused("Confirm that Google account first, then sign in again.") } });
    const client = new h.Client(config);
    const host = container();
    await client.renderSignInButton(host, {});
    assert.doesNotMatch(host.innerHTML, /Confirm your existing account/);
    assert.equal(h.calls.scripts.some((script) => script.src.includes("gsi/client")), false);
  }

  // 14. clerk first only: the signed-out card carries the clerk form alone,
  // even while the move is open
  {
    const h = harness();
    const client = new h.Client({ ...config, googleMigrationClientId: "google-client-id" });
    const host = container();
    await client.renderSignInButton(host, {});
    assert.equal(host.children.length, 1, "no google-first step");
    assert.equal(h.calls.scripts.some((script) => script.src.includes("gsi/client")), false);
  }

  // 15. the flow stops as soon as its clerk session ends or changes: a late
  // pairing answer is not approved, and a click from an ended session asks
  // for nothing
  {
    const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
    let pending = deferred();
    const responses = {
      "users:claimInvite": refused("Confirm that Google account first, then sign in again."),
      "users:requestIdentityMigration": () => pending.promise,
      "users:approveIdentityMigration": ok({ approved: true, expires_at: Date.now() + 600000 }),
    };
    const h = harness({ session: { id: "sess_s", email: "guy@example.org" }, cookie: "__client_uat=1", responses });
    const client = new h.Client({ ...config, googleMigrationClientId: "google-client-id" });
    const host = container();
    await client.renderSignInButton(host, {});
    await tick();
    const callback = h.calls.gsiInit.callback;
    const flow = callback({ credential: "google-id-token" });
    h.clerk.setSession(null);
    pending.resolve(ok({ nonce: "n-late", expires_at: Date.now() + 600000 }));
    assert.equal(await flow, false);
    assert.equal(h.calls.fetches.some((fetch) => fetch.body.path === "users:approveIdentityMigration"), false, "no approval for an ended session");
    // the button from the ended session: nothing is asked
    const asked = h.calls.fetches.filter((fetch) => fetch.body.path === "users:requestIdentityMigration").length;
    assert.equal(await callback({ credential: "google-id-token" }), false);
    assert.equal(h.calls.fetches.filter((fetch) => fetch.body.path === "users:requestIdentityMigration").length, asked);
    // a session changed to another account: the old step's click does nothing
    h.clerk.setSession(h.makeSession("sess_other", "other@example.org"));
    await tick();
    assert.equal(await callback({ credential: "google-id-token" }), false);
    assert.equal(h.calls.fetches.some((fetch) => fetch.body.path === "users:approveIdentityMigration"), false);
  }

  // 16. a google account the server will not accept (another member's, or
  // one that is nobody's sign-in): the step says why and stays; the claim is
  // not retried and the account is not moved
  {
    const wrong = "[Request ID: 2] Server Error Uncaught Error: This Google account is not a project member's current sign-in. at handler (x)";
    const responses = {
      "users:claimInvite": refused("Confirm that Google account first, then sign in again."),
      "users:requestIdentityMigration": ok({ nonce: "n-2", expires_at: Date.now() + 600000 }),
      "users:approveIdentityMigration": refused(wrong),
    };
    const h = harness({ session: { id: "sess_w", email: "guy@example.org" }, cookie: "__client_uat=1", responses });
    const client = new h.Client({ ...config, googleMigrationClientId: "google-client-id" });
    const host = container();
    const seen = [];
    await client.renderSignInButton(host, { onSignedIn: (user) => seen.push(user._id) });
    await tick();
    const claimsBefore = h.calls.fetches.filter((fetch) => fetch.body.path === "users:claimInvite").length;
    assert.equal(await h.calls.gsiInit.callback({ credential: "someone-elses-google-token" }), false);
    assert.equal(host.parts["migration-status"].textContent, "This Google account is not a project member's current sign-in.");
    assert.equal(h.calls.fetches.filter((fetch) => fetch.body.path === "users:claimInvite").length, claimsBefore, "no claim after a refused approval");
    assert.match(host.innerHTML, /Confirm your existing account for the new sign-in/);
    assert.equal(client.signedIn, false);
    assert.deepEqual(seen, []);
    // the refusal of the google token never signs the clerk session out
    assert.equal(h.calls.signOut, 0);
    assert.equal(client.sessionId, "sess_w");
  }

  // 17. clerk replaces session a with session b directly (another account
  // signed in elsewhere): the page is told a's session ended, synchronously
  // and before b's claim is sent, then b is admitted (#153 round 1, both 1)
  {
    const claims = [];
    const responses = {
      "users:claimInvite": (body) => ok(claims.length ? "user_b" : "user_a"),
      "users:me": () => ok(claims.at(-1)),
    };
    const h = harness({ session: { id: "sess_a", email: "a@example.org" }, cookie: "__client_uat=1", responses });
    const origFetch = h.calls.fetches;
    const client = new h.Client(config);
    const log = [];
    client.setLifecycle({ onSignedOut: (event) => log.push(`ended(${event.replaced ? "replaced" : "gone"}) user=${client.user?._id || "none"} session=${client.sessionId}`) });
    // restored on load, as after a reload
    responses["users:me"] = () => ok({ ...member, _id: "user_a", email: "a@example.org" });
    const restored = await client.restoreSession();
    assert.equal(restored._id, "user_a");
    responses["users:me"] = () => ok({ ...member, _id: "user_b", email: "b@example.org" });
    claims.push("user_b");
    const host = container();
    const admitted = [];
    client.signInOptions = { onSignedIn: (user) => { admitted.push(user._id); log.push(`admitted ${user._id}`); } };
    client.signInHost = host;
    const claimsBefore = origFetch.filter((fetch) => fetch.body.path === "users:claimInvite").length;
    h.clerk.setSession(h.makeSession("sess_b", "b@example.org"));
    // synchronous: the page was cleared before anything was sent for b
    assert.deepEqual(log, ["ended(replaced) user=none session=sess_b"]);
    assert.equal(client.user, null);
    await tick();
    assert.equal(origFetch.filter((fetch) => fetch.body.path === "users:claimInvite").length, claimsBefore + 1);
    assert.match(origFetch.filter((fetch) => fetch.body.path === "users:claimInvite").at(-1).headers.Authorization, /^Bearer jwt-for-sess_b-/);
    assert.deepEqual(admitted, ["user_b"]);
    assert.equal(client.user._id, "user_b");
  }

  // 18. a's answers that land after the switch to b name nobody: a's claim
  // in flight neither admits a nor reports a's failure, a request made under
  // a whose token arrives after the switch is not sent under b's token, and
  // a restore racing the switch returns nobody
  {
    const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
    const aClaim = deferred();
    const responses = {
      "users:claimInvite": (body) => (h.calls.fetches.filter((fetch) => fetch.body.path === "users:claimInvite").length === 1 ? aClaim.promise : ok("user_b")),
      "users:me": ok({ ...member, _id: "user_b" }),
      "tasks:listTasks": ok([]),
    };
    const h = harness({ session: { id: "sess_a", email: "a@example.org" }, cookie: "__client_uat=1", responses });
    const client = new h.Client(config);
    const admitted = [];
    const errors = [];
    const ended = [];
    client.setLifecycle({ onSignedOut: () => ended.push("ended") });
    const restoring = client.restoreSession();
    await tick();
    const host = container();
    client.signInHost = host;
    client.signInOptions = { onSignedIn: (user) => admitted.push(user._id), onError: (error) => errors.push(error.message) };
    h.clerk.setSession(h.makeSession("sess_b", "b@example.org"));
    aClaim.resolve({ status: 200, body: { status: "error", errorMessage: "network trouble for a" } });
    assert.equal(await restoring, null, "a's restore names nobody");
    await tick();
    assert.deepEqual(errors, [], "a's late failure is not reported on b's page");
    assert.deepEqual(admitted, ["user_b"]);
    assert.deepEqual(ended, ["ended"], "every change away from a session is announced, admitted or not");
    // a request asked for under b, whose token arrives after a switch to c
    let release;
    const slowToken = new Promise((r) => { release = r; });
    h.clerk.session.getToken = async () => { await slowToken; return "jwt-late"; };
    const sent = h.calls.fetches.length;
    const late = client.listTasks({});
    h.clerk.setSession(h.makeSession("sess_c", "c@example.org"));
    release();
    await assert.rejects(late, (error) => error.sessionChanged === true);
    assert.equal(h.calls.fetches.slice(sent).some((fetch) => fetch.body.path === "tasks:listTasks"), false, "nothing sent under the next session");
    assert.deepEqual(ended, ["ended", "ended"], "b's session ending cleared the page");
  }

  // 19. a refused token while a claim is out (no user admitted yet) does not
  // announce an ending, so the card never loops into another claim
  {
    const h = harness({ session: { id: "sess_x", email: "x@example.org" }, cookie: "__client_uat=1", responses: { "users:claimInvite": { status: 401, body: { errorMessage: "Authentication required." } } } });
    const client = new h.Client(config);
    const ended = [];
    client.setLifecycle({ onSignedOut: () => ended.push("ended") });
    const errors = [];
    await client.renderSignInButton(container(), { onError: (error) => errors.push(error.message) });
    await tick();
    assert.deepEqual(ended, []);
    assert.equal(h.calls.fetches.filter((fetch) => fetch.body.path === "users:claimInvite").length, 1);
    assert.match(errors[0] || "", /sign-in expired/);
  }

  // 20. #153 round 2 (sol): a successful answer whose data mentions
  // "token" is data, not a refused sign-in; a 401 whose body is not json
  // still clears the page before the caller hears of it
  {
    const responses = {
      "users:claimInvite": ok("user_1"),
      "users:me": ok(member),
      "evidence:listTaskEvidence": ok([{ evidence_note: "the parish token box and the JWT-shaped plaque" }]),
      "tasks:listTasks": { status: 401, raw: "<html>401 Unauthorized</html>" },
      "tasks:listMyTasks": refused("Invalid token: JWT expired"),
    };
    const h = harness({ session: { id: "sess_t", email: "guy@example.org" }, cookie: "__client_uat=1", responses });
    const client = new h.Client(config);
    const order = [];
    client.setLifecycle({ onSignedOut: () => order.push("page cleared") });
    await client.renderSignInButton(container(), {});
    await tick();
    assert.equal(client.signedIn, true);
    const rows = await client.listTaskEvidence({ taskId: "t" });
    assert.equal(rows[0].evidence_note, "the parish token box and the JWT-shaped plaque");
    assert.equal(client.signedIn, true, "data containing 'token' ends nothing");
    assert.deepEqual(order, []);
    await assert.rejects(client.listTasks({}).catch((error) => { order.push("caller told"); throw error; }), (error) => error.authExpired === true);
    assert.deepEqual(order, ["page cleared", "caller told"], "a non-json 401 clears the page first");
    assert.equal(client.user, null);
    // an actual error response with sign-in wording still ends the session
    await client.restoreSession();
    assert.equal(client.signedIn, true);
    await assert.rejects(client.listMyTasks({}), (error) => error.authExpired === true);
    assert.deepEqual(order, ["page cleared", "caller told", "page cleared"]);
  }

  // 21. #153 round 4 (sol): a switch from a to b and back to the same a
  // session while work is out still counts as a change. a request whose
  // token arrives after a -> b -> a is not sent; an answer that arrives
  // after it is not handed back; a sign-in chain whose me answer was asked
  // under b never admits b on a's page
  {
    const later = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
    const myTasks = later();
    const meAnswer = later();
    let meCalls = 0;
    const responses = {
      "users:claimInvite": ok("user_a"),
      "users:me": () => { meCalls += 1; return meCalls === 1 ? ok({ ...member, _id: "user_a" }) : meAnswer.promise; },
      "tasks:listTasks": ok([]),
      "tasks:listMyTasks": () => myTasks.promise,
    };
    const h = harness({ session: { id: "sess_a", email: "a@example.org" }, cookie: "__client_uat=1", responses });
    const client = new h.Client(config);
    const ended = [];
    client.setLifecycle({ onSignedOut: () => ended.push("ended") });
    assert.equal((await client.restoreSession())._id, "user_a");
    const sessionA = h.clerk.session;
    const bounce = () => { h.clerk.setSession(h.makeSession("sess_b", "b@example.org")); h.clerk.setSession(sessionA); };

    // (a) the token arrives after a -> b -> a: nothing is sent
    let releaseToken;
    const slow = new Promise((r) => { releaseToken = r; });
    const getToken = sessionA.getToken;
    sessionA.getToken = async (options) => { await slow; return getToken(options); };
    const sent = h.calls.fetches.length;
    const late = client.listTasks({});
    bounce();
    releaseToken();
    await assert.rejects(late, (error) => error.sessionChanged === true);
    assert.equal(h.calls.fetches.slice(sent).some((fetch) => fetch.body.path === "tasks:listTasks"), false, "the old request is not sent after a -> b -> a");
    sessionA.getToken = getToken;

    // (b) the answer arrives after a -> b -> a: it is not handed back
    const pendingAnswer = client.listMyTasks({});
    await tick();
    bounce();
    myTasks.resolve(ok([{ task_id: "a_private_task" }]));
    await assert.rejects(pendingAnswer, (error) => error.sessionChanged === true);

    // (c) a sign-in chain whose me was asked while b held the browser
    const admitted = [];
    const chain = client.completeSignIn({ onSignedIn: (user) => admitted.push(user._id) });
    await tick();
    h.clerk.setSession(h.makeSession("sess_b2", "b@example.org"));
    h.clerk.setSession(sessionA);
    meAnswer.resolve(ok({ ...member, _id: "user_b", email: "b@example.org" }));
    assert.equal(await chain, null, "the old chain admits nobody");
    assert.deepEqual(admitted, [], "b is never admitted on a's page");
    assert.notEqual(client.user?._id, "user_b");
    assert.ok(ended.length >= 2, "each change away from a cleared the page");
  }

  // 22. #153 round 5 (sol): a failed sign-out's marker cannot be kept when
  // storage refuses it. a reload then restores nothing: the session found
  // on load is signed out first, and if clerk still refuses, the card shows
  // the failure and its retry, never the portal
  for (const storageFails of ["all", "writes"]) {
    // the reload: a live clerk session is found, and storage cannot hold
    // or confirm a marker
    const h = harness({ session: { id: "sess_s", email: "shared@example.org" }, cookie: "__client_uat=1", storageFails, responses: { "users:claimInvite": ok("user_1"), "users:me": ok(member) } });
    const client = new h.Client(config);
    assert.equal(await client.restoreSession(), null, `nothing restored when storage fails (${storageFails})`);
    assert.equal(h.calls.signOut, 1, "the restored session is signed out first");
    assert.equal(h.calls.fetches.some((fetch) => fetch.body.path === "users:claimInvite"), false, "no claim for it");
    const host = container();
    await client.renderSignInButton(host, {});
    assert.equal(host.children.length, 1, "the card shows the sign-in form");
    assert.equal(client.signedIn, false);

    // clerk refuses the retried sign-out: the failure and retry, no portal
    const refused = harness({ session: { id: "sess_r", email: "shared@example.org" }, cookie: "__client_uat=1", storageFails, failSignOuts: 2, responses: { "users:claimInvite": ok("user_1"), "users:me": ok(member) } });
    const refusedClient = new refused.Client(config);
    const refusedHost = container();
    await refusedClient.renderSignInButton(refusedHost, {});
    assert.match(refusedHost.innerHTML, /Sign-out did not finish/);
    assert.equal(refused.calls.fetches.some((fetch) => fetch.body.path === "users:claimInvite"), false);
    assert.equal(refusedClient.signedIn, false);
  }
  // a fresh sign-in in the page is not held back by unusable storage
  {
    const h = harness({ storageFails: "all", responses: { "users:claimInvite": ok("user_1"), "users:me": ok(member) } });
    const client = new h.Client(config);
    const host = container();
    const admitted = [];
    await client.renderSignInButton(host, { onSignedIn: (user) => admitted.push(user._id) });
    h.clerk.setSession(h.makeSession("sess_new", "guy@example.org"));
    await tick();
    assert.deepEqual(admitted, ["user_1"]);
    assert.equal(h.calls.signOut, 0);
  }

  // 23. #153 round 5 (astra): a write the server recorded after the session
  // changed is reported as committed, with its value, so the caller can
  // clean up what it owns; a query's late answer is only dropped
  {
    const later = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
    const recorded = later();
    const responses = {
      "users:claimInvite": ok("user_a"),
      "users:me": ok({ ...member, _id: "user_a" }),
      "rapidEntry:submitCurrentObservation": () => recorded.promise,
    };
    const h = harness({ session: { id: "sess_a", email: "a@example.org" }, cookie: "__client_uat=1", responses });
    const client = new h.Client(config);
    await client.restoreSession();
    const submitting = client.submitCurrentObservation({ clientSubmissionId: "sub_a" });
    await tick();
    h.clerk.setSession(h.makeSession("sess_b", "b@example.org"));
    recorded.resolve(ok({ task_id: "t_a", evidence_draft_id: "d_a" }));
    await assert.rejects(submitting, (error) => error.sessionChanged === true && error.committed === true && error.value.task_id === "t_a");
  }

  console.log("convex-task-client: clerk sessions ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
