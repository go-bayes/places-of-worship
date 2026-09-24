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

function harness({ session = null, cookie = "", responses = {}, failLoads = 0, failSignOuts = 0, networkFailSignOuts = 0, offlineReloads = 0, storage } = {}) {
  const values = storage || new Map([["powConvexAuth:v1", JSON.stringify({ token: "old-google-token" })]]);
  const localStorage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
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
      return { status: resolved.status, ok: resolved.status < 400, text: async () => JSON.stringify(resolved.body) };
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
  // an automatic sign-out (a refused token) keeps clerk's session
  {
    const h = harness({ session: { id: "sess_5", email: "guy@example.org" }, cookie: "__client_uat=1", responses: { "users:claimInvite": ok("user_1"), "users:me": ok(member), "tasks:listTasks": { status: 401, body: { errorMessage: "Authentication required." } } } });
    const client = new h.Client(config);
    const ended = [];
    client.setLifecycle({ onSignedOut: (event) => ended.push(event?.deliberate ? "deliberate" : "ended") });
    await client.renderSignInButton(container(), {});
    await tick();
    await assert.rejects(client.listTasks({}), (error) => error.authExpired === true);
    assert.equal(client.user, null);
    assert.equal(h.calls.signOut, 0, "an expiry does not end the clerk session");
    const reclaimed = await client.restoreSession();
    assert.equal(reclaimed?._id, "user_1", "the held session admits the user again");
    await client.signOut({ deliberate: true });
    assert.equal(h.calls.signOut, 1);
    assert.equal(client.signedIn, false);
    assert.equal(ended.length, 0, "a deliberate sign-out is not reported as a session ending elsewhere");
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

  // 12. r-c18: an existing google member signed in to clerk is asked to
  // confirm their google account; the google id token is used for the one
  // grant request, the grant is held for the tab, presented on the claim,
  // and cleared once spent
  {
    const confirm = "[Request ID: 1] Server Error Uncaught Error: This address belongs to an existing member who signed in with Google. Confirm that Google account first, then sign in again. at handler (x)";
    const claims = [];
    const responses = {
      "users:claimInvite": (body) => { claims.push(body.args[0]); return body.args[0].migrationGrant ? ok("user_1") : refused(confirm); },
      "users:me": ok(member),
      "users:beginIdentityMigration": ok({ grant: "g-secret-1", expires_at: Date.now() + 600000 }),
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
    // the member confirms with google
    await h.calls.gsiInit.callback({ credential: "google-id-token" });
    const grantRequest = h.calls.fetches.find((fetch) => fetch.body.path === "users:beginIdentityMigration");
    assert.equal(grantRequest.headers.Authorization, "Bearer google-id-token", "the grant request is made as the google sign-in");
    await tick();
    assert.equal(claims.at(-1).migrationGrant, "g-secret-1", "the claim presents the grant");
    assert.deepEqual(seen, ["user_1"], "and the member is in");
    assert.equal(client.heldMigrationGrant, null, "the spent grant is cleared");
    assert.equal(h.sessionValues.size, 0, "a grant never reaches storage");
    assert.equal(client.migrationGrant(), "");
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

  // 14. google first: before signing in, the folded step issues the grant,
  // which the later clerk claim presents; an expired grant is never sent;
  // a deliberate sign-out drops a held grant
  {
    const claims = [];
    const responses = {
      "users:claimInvite": (body) => { claims.push(body.args[0]); return ok("user_1"); },
      "users:me": ok(member),
      "users:beginIdentityMigration": ok({ grant: "g-secret-2", expires_at: Date.now() + 600000 }),
    };
    const h = harness({ responses });
    const client = new h.Client({ ...config, googleMigrationClientId: "google-client-id" });
    const host = container();
    await client.renderSignInButton(host, {});
    assert.equal(host.children.length, 2, "the clerk form and the folded google step");
    const details = host.children[1];
    assert.equal(details.tag, "details");
    assert.match(details.innerHTML, /Used Google sign-in here before\?/);
    details.querySelector = (selector) => selector.includes("google-confirm") ? (details.hostEl ||= { innerHTML: "" }) : (details.statusEl ||= { textContent: "" });
    await client.mountGoogleConfirm(details, { afterGrant: () => {} });
    await h.calls.gsiInit.callback({ credential: "google-id-token" });
    assert.match(details.statusEl.textContent, /Confirmed\. Now sign in above/);
    assert.equal(client.heldMigrationGrant.grant, "g-secret-2", "held in this page's memory");
    assert.equal(client.heldMigrationGrant.sessionId, "", "armed for the next sign-in started here");
    assert.equal(h.sessionValues.size, 0, "never in storage");
    assert.equal(client.migrationGrant(), "", "not presentable before a session");
    await client.renderSignInButton(container(), {});
    assert.equal(host.children[1], details, "a repaint keeps the same step");
    // the member uses this page's sign-in form, and the session it starts
    // presents the grant
    client.markSignInStarted();
    h.clerk.setSession(h.makeSession("sess_g", "guy@example.org"));
    await tick();
    assert.equal(claims.at(-1).migrationGrant, "g-secret-2", "the clerk claim presents it");
    // an expired grant is never presented
    client.heldMigrationGrant = { grant: "old", expires_at: Date.now() - 1, issuedAt: 1, sessionId: client.sessionId };
    assert.equal(client.migrationGrant(), "");
    // sign-out drops a held grant
    client.heldMigrationGrant = { grant: "held", expires_at: Date.now() + 60000, issuedAt: 1, sessionId: client.sessionId };
    await client.signOut({ deliberate: true });
    assert.equal(client.heldMigrationGrant, null);
    // with the move closed the signed-out card carries the clerk form only
    const closed = new (harness().Client)(config);
    const closedHost = container();
    await closed.renderSignInButton(closedHost, {});
    assert.equal(closedHost.children.length, 1);
  }

  // 15. r-c18 review: a grant issuance that answers after a deliberate
  // sign-out writes nothing, directly or through google's callback; a
  // session that ends in another tab or by expiry, or turns into another,
  // takes a held grant with it; a first session keeps the google-first grant
  {
    const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
    let pending = deferred();
    const responses = {
      "users:claimInvite": refused("Confirm that Google account first, then sign in again."),
      "users:beginIdentityMigration": () => pending.promise,
    };
    const h = harness({ session: { id: "sess_r", email: "guy@example.org" }, cookie: "__client_uat=1", responses });
    const client = new h.Client({ ...config, googleMigrationClientId: "google-client-id" });
    await client.restoreSession();
    // direct: begin, sign out, then the answer arrives
    const direct = client.beginIdentityMigration("google-id-token");
    await client.signOut({ deliberate: true });
    pending.resolve(ok({ grant: "late-grant", expires_at: Date.now() + 600000 }));
    await assert.rejects(direct, (error) => error.staleGrant === true);
    assert.equal(client.heldMigrationGrant, null, "no grant in memory");
    assert.equal(h.sessionValues.size, 0, "nor in the tab");
    assert.equal(client.migrationGrant(), "");

    // through google's button: the step is mounted in one session, the
    // member signs out, and the late answer is dropped with no status text
    h.clerk.setSession(h.makeSession("sess_r2", "guy@example.org"));
    await tick();
    const host = container();
    await client.renderSignInButton(host, {});
    await tick();
    assert.match(host.innerHTML, /Confirm your existing account/);
    pending = deferred();
    const callback = h.calls.gsiInit.callback({ credential: "google-id-token" });
    await client.signOut({ deliberate: true });
    pending.resolve(ok({ grant: "late-grant-2", expires_at: Date.now() + 600000 }));
    await callback;
    assert.equal(client.heldMigrationGrant, null, "the late callback writes no grant");
    assert.doesNotMatch(host.parts["migration-status"]?.textContent || "", /Confirmed/);
    // a click on a button from the ended session asks for nothing
    const asked = h.calls.fetches.filter((fetch) => fetch.body.path === "users:beginIdentityMigration").length;
    await h.calls.gsiInit.callback({ credential: "google-id-token" });
    assert.equal(h.calls.fetches.filter((fetch) => fetch.body.path === "users:beginIdentityMigration").length, asked);

    // a session that ends elsewhere (another tab, expiry) clears a held grant
    h.clerk.setSession(h.makeSession("sess_r3", "guy@example.org"));
    await tick();
    client.heldMigrationGrant = { grant: "held", expires_at: Date.now() + 600000, issuedAt: Date.now(), sessionId: "sess_r3" };
    h.clerk.setSession(null);
    assert.equal(client.heldMigrationGrant, null, "ended elsewhere: grant cleared");
    assert.equal(client.migrationGrant(), "");
    // and an issuance in flight when the session ends elsewhere is dropped
    h.clerk.setSession(h.makeSession("sess_r4", "guy@example.org"));
    await tick();
    pending = deferred();
    const inFlight = client.beginIdentityMigration("google-id-token");
    h.clerk.setSession(null);
    pending.resolve(ok({ grant: "late-grant-3", expires_at: Date.now() + 600000 }));
    await assert.rejects(inFlight, (error) => error.staleGrant === true);
    assert.equal(client.heldMigrationGrant, null);
    // a session that changes to another user's takes it too
    h.clerk.setSession(h.makeSession("sess_r5", "guy@example.org"));
    await tick();
    client.heldMigrationGrant = { grant: "held-2", expires_at: Date.now() + 600000, issuedAt: Date.now(), sessionId: "sess_r5" };
    h.clerk.setSession(h.makeSession("sess_other", "other@example.org"));
    assert.equal(client.heldMigrationGrant, null, "changed session: grant cleared");
  }

  // 16. greptile 4093166052: a grant confirmed before sign-in passes only to
  // a session begun with this page's own form after the grant was issued.
  // a session that arrives from another tab (no local sign-in), or one begun
  // with the form before the grant, drops it; nothing survives a reload
  {
    const grantResponse = () => ok({ grant: `g-${Math.random()}`, expires_at: Date.now() + 600000 });
    const build = () => {
      const h = harness({ responses: { "users:claimInvite": ok("user_1"), "users:me": ok(member), "users:beginIdentityMigration": grantResponse } });
      return { h, client: new h.Client({ ...config, googleMigrationClientId: "google-client-id" }) };
    };
    const claimOf = (h) => h.calls.fetches.filter((fetch) => fetch.body.path === "users:claimInvite").at(-1)?.body.args[0];

    // local sign-in after the grant: presented
    let { h, client } = build();
    await client.renderSignInButton(container(), {});
    await client.beginIdentityMigration("google-id-token");
    client.markSignInStarted();
    h.clerk.setSession(h.makeSession("sess_local", "guy@example.org"));
    await tick();
    assert.ok(claimOf(h).migrationGrant, "the page's own sign-in presents it");

    // a session that arrives from another tab: not presented, and dropped
    ({ h, client } = build());
    await client.renderSignInButton(container(), {});
    await client.beginIdentityMigration("google-id-token");
    h.clerk.setSession(h.makeSession("sess_elsewhere", "someone@example.org"));
    await tick();
    assert.equal(claimOf(h).migrationGrant, undefined, "a session from elsewhere never receives it");
    assert.equal(client.heldMigrationGrant, null, "and the grant is gone");

    // the form used before the grant was issued does not count
    ({ h, client } = build());
    await client.renderSignInButton(container(), {});
    client.markSignInStarted();
    await new Promise((resolve) => setTimeout(resolve, 2));
    await client.beginIdentityMigration("google-id-token");
    h.clerk.setSession(h.makeSession("sess_earlier", "guy@example.org"));
    await tick();
    assert.equal(claimOf(h).migrationGrant, undefined);
    assert.equal(client.heldMigrationGrant, null);

    // a reload starts with no grant, and an earlier build's tab copy is removed
    ({ h, client } = build());
    h.sessionValues.set("powMigrationGrant:v1", JSON.stringify({ grant: "tab-copy", expires_at: Date.now() + 600000 }));
    const reloaded = new h.Client({ ...config, googleMigrationClientId: "google-client-id" });
    assert.equal(reloaded.migrationGrant(), "");
    assert.equal(h.sessionValues.has("powMigrationGrant:v1"), false);
  }

  console.log("convex-task-client: clerk sessions ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
