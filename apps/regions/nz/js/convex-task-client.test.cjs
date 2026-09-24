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

function harness({ session = null, cookie = "", responses = {}, failLoads = 0 } = {}) {
  const values = new Map([["powConvexAuth:v1", JSON.stringify({ token: "old-google-token" })]]);
  const localStorage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
  const calls = { scripts: [], load: [], getToken: [], mountSignIn: [], unmountSignIn: 0, signOut: 0, fetches: [] };
  const listeners = [];
  const clerk = {
    session,
    user: session ? { primaryEmailAddress: { emailAddress: session.email } } : null,
    async load(options) { calls.load.push(options); },
    addListener(listener) { listeners.push(listener); listener({ session: clerk.session, user: clerk.user }); return () => {}; },
    mountSignIn(node, props) { calls.mountSignIn.push({ node, props }); node.mounted = true; },
    unmountSignIn(node) { calls.unmountSignIn += 1; node.mounted = false; },
    async signOut() { calls.signOut += 1; clerk.setSession(null); },
    setSession(next) {
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
  const window = {
    localStorage,
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
      const resolved = typeof response === "function" ? response(body) : response;
      return { status: resolved.status, ok: resolved.status < 400, text: async () => JSON.stringify(resolved.body) };
    },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "convex-task-client.js"), "utf8"), context, { filename: "convex-task-client.js" });
  return { Client: window.PowConvexTaskClient, window, document, clerk, calls, values, makeSession };
}

const config = { enabled: true, url: "https://example.convex.cloud", clerkPublishableKey: PUBLISHABLE_KEY };
const ok = (value) => ({ status: 200, body: { status: "success", value } });
const refused = (message) => ({ status: 200, body: { status: "error", errorMessage: message } });
const member = { _id: "user_1", email: "guy@example.org", roles: ["ra"], status: "active" };
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));
const container = () => ({ innerHTML: "", children: [], replaceChildren(...nodes) { this.children = nodes; this.innerHTML = ""; }, querySelector(selector) { return this.innerHTML.includes("data-pow-sign-out") && selector === "[data-pow-sign-out]" ? (this.button ||= { addEventListener: (_type, handler) => { this.click = handler; } }) : null; } });

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
    await client.renderSignInButton(host, { onError: (error) => errors.push(error.message), onSignedOut: () => signedOut.push(true) });
    assert.equal(h.calls.mountSignIn.length, 0, "a signed-in session gets no second sign-in form");
    assert.match(host.innerHTML, /stranger@example\.org/);
    assert.match(host.innerHTML, /no project access yet/);
    assert.match(host.innerHTML, /data-pow-sign-out/);
    assert.doesNotMatch(host.innerHTML, /Request ID|Uncaught/, "no raw server text on the card");
    assert.deepEqual(errors, [], "a refusal the card explains is not also reported as a page error");
    assert.equal(h.calls.fetches.filter((fetch) => fetch.body.path === "users:claimInvite").length, 1, "the refused claim is not retried on every render");
    await host.click();
    assert.equal(h.calls.signOut, 1, "the button ends the clerk session");
    assert.equal(signedOut.length, 1, "and returns the page to the sign-in card");
    await client.renderSignInButton(host, {});
    assert.equal(h.calls.mountSignIn.length, 1);
  }

  // 5. a session that ends in another tab signs the portal out cleanly
  {
    const h = harness({ session: { id: "sess_4", email: "guy@example.org" }, cookie: "__client_uat=1", responses: { "users:claimInvite": ok("user_1"), "users:me": ok(member) } });
    const client = new h.Client(config);
    const ended = [];
    await client.renderSignInButton(container(), { onSignedOut: () => ended.push(true) });
    await tick();
    assert.equal(client.signedIn, true);
    h.clerk.setSession(null);
    assert.equal(client.signedIn, false);
    assert.equal(ended.length, 1);
  }

  // 6. the sign-out button ends the clerk session without a second signal;
  // an automatic sign-out (a refused token) keeps clerk's session
  {
    const h = harness({ session: { id: "sess_5", email: "guy@example.org" }, cookie: "__client_uat=1", responses: { "users:claimInvite": ok("user_1"), "users:me": ok(member), "tasks:listTasks": { status: 401, body: { errorMessage: "Authentication required." } } } });
    const client = new h.Client(config);
    const ended = [];
    await client.renderSignInButton(container(), { onSignedOut: () => ended.push(true) });
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

  console.log("convex-task-client: clerk sessions ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
