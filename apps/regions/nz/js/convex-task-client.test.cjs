// the sign-in token kept on the device (jb 2026-09-05, after guy's phone
// reloaded the portal from the photo gallery): a new client restores an
// unexpired token, restoreSession names the user again, an expired or
// refused token is dropped, and only the sign-out button tells google to
// stop auto-selecting the account
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
const calls = { initialize: 0, disableAutoSelect: 0, fetches: [] };
const window = {
  localStorage,
  setTimeout, clearTimeout,
  google: { accounts: { id: {
    initialize() { calls.initialize += 1; },
    renderButton() {},
    prompt() {},
    disableAutoSelect() { calls.disableAutoSelect += 1; },
  } } },
};
let fetchResponse = { status: 200, body: { status: "success", value: { _id: "user_1", email: "guy@example.org" } } };
// a function answers by request body, so one test can serve several queries
const respond = (body) => (typeof fetchResponse === "function" ? fetchResponse(body) : fetchResponse);
const document = {
  querySelector() { return null; },
  createElement() { return {}; },
  head: { appendChild(script) { setTimeout(() => script.onload?.(), 0); } },
};
const context = vm.createContext({
  window, document, localStorage,
  setTimeout, clearTimeout, Date, JSON, Map, Number, String, Boolean, Object, Math, Promise, Error, RegExp, console,
  atob: (value) => Buffer.from(value, "base64").toString("binary"),
  fetch: async (url, init) => {
    calls.fetches.push({ url, headers: init.headers, body: JSON.parse(init.body) });
    const answer = respond(calls.fetches.at(-1).body);
    return { status: answer.status, ok: answer.status < 400, text: async () => JSON.stringify(answer.body) };
  },
});
vm.runInContext(fs.readFileSync(path.join(__dirname, "convex-task-client.js"), "utf8"), context, { filename: "convex-task-client.js" });
const Client = window.PowConvexTaskClient;
assert.ok(Client, "client class exported");

const config = { enabled: true, url: "https://example.convex.cloud", googleClientId: "client-id" };
const jwtWithExpIn = (seconds) => {
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${b64({ alg: "RS256" })}.${b64({ sub: "1", exp: Math.floor(Date.now() / 1000) + seconds })}.sig`;
};

(async () => {
  // 1. a fresh sign-in writes the token; a new client on the same device restores it
  const first = new Client(config);
  const token = jwtWithExpIn(3600);
  first.setAuthToken(token);
  assert.equal(JSON.parse(localStorage.getItem("powConvexAuth:v1")).token, token, "token kept on the device");
  first.clearAuthRefreshTimer();

  const reloaded = new Client(config);
  assert.equal(reloaded.authToken, token, "token restored by the next page load");
  assert.equal(reloaded.signedIn, false, "no user yet");
  const user = await reloaded.restoreSession();
  assert.equal(user?._id, "user_1", "restoreSession names the user again");
  assert.equal(reloaded.signedIn, true);
  // google's script loads in the background; nothing waits for it
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(calls.initialize, 1, "google initialised so the hour-end refresh can run");
  const me = calls.fetches.at(-1);
  assert.equal(me.body.path, "users:me");
  assert.equal(me.headers.Authorization, `Bearer ${token}`);
  reloaded.clearAuthRefreshTimer();

  // 2. an automatic sign-out (expiry) clears the device copy without the google cooldown
  reloaded.signOut();
  assert.equal(localStorage.getItem("powConvexAuth:v1"), null, "sign-out clears the device copy");
  assert.equal(calls.disableAutoSelect, 0, "an automatic sign-out leaves google's auto-select alone");
  reloaded.signOut({ deliberate: true });
  assert.equal(calls.disableAutoSelect, 1, "the sign-out button disables auto-select");

  // 3. a token inside its refresh margin is not restored
  const nearlyOut = new Client(config);
  nearlyOut.setAuthToken(jwtWithExpIn(120));
  nearlyOut.clearAuthRefreshTimer();
  const later = new Client(config);
  assert.equal(later.authToken, "", "a token about to expire is not restored");
  assert.equal(localStorage.getItem("powConvexAuth:v1"), null, "and is dropped from the device");

  // 4. a token the backend refuses is dropped
  const refused = new Client(config);
  refused.setAuthToken(jwtWithExpIn(3600));
  refused.clearAuthRefreshTimer();
  fetchResponse = { status: 401, body: { errorMessage: "Authentication required." } };
  const again = new Client(config);
  assert.equal(again.authToken !== "", true);
  const nobody = await again.restoreSession();
  assert.equal(nobody, null, "a refused token restores nobody");
  assert.equal(again.authToken, "");
  assert.equal(localStorage.getItem("powConvexAuth:v1"), null, "and leaves the device");
  again.clearAuthRefreshTimer();

  // 5. a restored token whose user is unknown is dropped too
  const unknown = new Client(config);
  unknown.setAuthToken(jwtWithExpIn(3600));
  unknown.clearAuthRefreshTimer();
  fetchResponse = { status: 200, body: { status: "success", value: null } };
  const stranger = new Client(config);
  assert.equal(await stranger.restoreSession(), null);
  assert.equal(localStorage.getItem("powConvexAuth:v1"), null);
  stranger.clearAuthRefreshTimer();

  // 6. the landing in one round trip (tasks:raLanding): the user and the
  // lists arrive together and users:me is not called
  const ok = (value) => ({ status: 200, body: { status: "success", value } });
  const missing = { status: 200, body: { status: "error", errorMessage: "Could not find public function for 'tasks:raLanding'. Did you forget to run `npx convex dev` or `npx convex deploy`?" } };
  const landingArgs = { countryCode: "NZ", batchId: "b1", limit: 1000 };
  const keepToken = (seconds = 3600) => {
    const seed = new Client(config);
    const token = jwtWithExpIn(seconds);
    seed.setAuthToken(token);
    seed.clearAuthRefreshTimer();
    return token;
  };
  {
    const landing = { user: { _id: "user_1" }, tasks: [{ task_id: "t1" }], manualTasks: [], myWork: [] };
    fetchResponse = (body) => (body.path === "tasks:raLanding" ? ok(landing) : ok(null));
    const token6 = keepToken();
    const client = new Client(config);
    calls.fetches.length = 0;
    const restored = await client.restoreSessionWithLanding(landingArgs);
    assert.equal(restored.user._id, "user_1");
    assert.deepEqual(restored.landing, landing);
    assert.deepEqual(calls.fetches.map((entry) => entry.body.path), ["tasks:raLanding"], "one request, no users:me");
    assert.deepEqual(calls.fetches[0].body.args[0], landingArgs);
    assert.equal(calls.fetches[0].headers.Authorization, `Bearer ${token6}`);
    assert.equal(client.signedIn, true);
    client.clearAuthRefreshTimer();
    client.signOut();
  }

  // 7. a deployment without raLanding: the user comes from users:me, the
  // landing is null, and the missing function is not asked for again
  {
    fetchResponse = (body) => (body.path === "tasks:raLanding" ? missing : ok({ _id: "user_1" }));
    keepToken();
    const client = new Client(config);
    calls.fetches.length = 0;
    const restored = await client.restoreSessionWithLanding(landingArgs);
    assert.equal(restored.user._id, "user_1");
    assert.equal(restored.landing, null);
    assert.deepEqual(calls.fetches.map((entry) => entry.body.path), ["tasks:raLanding", "users:me"]);
    assert.equal(await client.readLanding(landingArgs), null);
    assert.equal(calls.fetches.length, 2, "an unsupported raLanding is not asked for twice");
    client.clearAuthRefreshTimer();
    client.signOut();
  }

  // 8. a token the backend answers anonymously reads as an expired sign-in
  {
    fetchResponse = (body) => (body.path === "tasks:raLanding" ? ok({ user: null, tasks: [], manualTasks: [], myWork: [] }) : ok(null));
    keepToken();
    const client = new Client(config);
    const restored = await client.restoreSessionWithLanding(landingArgs);
    assert.equal(restored.user, null);
    assert.equal(client.authToken, "");
    assert.equal(localStorage.getItem("powConvexAuth:v1"), null);
    keepToken();
    const second = new Client(config);
    await assert.rejects(second.readLanding(landingArgs), (error) => error.authExpired === true);
    second.signOut();
  }

  // 9. another failure leaves the old reads to report it: users:me names the user
  {
    fetchResponse = (body) => (body.path === "tasks:raLanding" ? { status: 200, body: { status: "error", errorMessage: "Authenticated user is not active in this project." } } : ok({ _id: "user_1" }));
    keepToken();
    const client = new Client(config);
    const restored = await client.restoreSessionWithLanding(landingArgs);
    assert.equal(restored.user._id, "user_1");
    assert.equal(restored.landing, null);
    client.clearAuthRefreshTimer();
    client.signOut();
  }

  // 10. one row after a write: { row }, or null where raTaskRow is not deployed
  {
    const row = { task: { task_id: "t1" }, latestDraft: null, latestReview: null };
    fetchResponse = (body) => (body.path === "tasks:raTaskRow" ? ok(row) : ok(null));
    keepToken();
    const client = new Client(config);
    calls.fetches.length = 0;
    assert.equal(JSON.stringify(await client.readTaskRow({ taskId: "t1" })), JSON.stringify({ row }));
    assert.equal(calls.fetches[0].body.path, "tasks:raTaskRow");
    fetchResponse = () => ({ status: 200, body: { status: "error", errorMessage: "Could not find public function for 'tasks:raTaskRow'." } });
    assert.equal(await client.readTaskRow({ taskId: "t1" }), null);
    calls.fetches.length = 0;
    assert.equal(await client.readTaskRow({ taskId: "t1" }), null);
    assert.equal(calls.fetches.length, 0, "an unsupported raTaskRow is not asked for twice");
    client.clearAuthRefreshTimer();
    client.signOut();
  }

  // 11. google's script that never loads holds nothing back: the landing
  // request goes out and answers while the script is still pending
  {
    const stuck = { fetches: [], scriptAdded: 0 };
    const stuckWindow = { localStorage, setTimeout, clearTimeout };
    const stuckContext = vm.createContext({
      window: stuckWindow, document: { querySelector() { return null; }, createElement() { return {}; }, head: { appendChild() { stuck.scriptAdded += 1; } } }, localStorage,
      setTimeout, clearTimeout, Date, JSON, Map, Number, String, Boolean, Object, Math, Promise, Error, RegExp, console,
      atob: (value) => Buffer.from(value, "base64").toString("binary"),
      fetch: async (url, init) => {
        stuck.fetches.push(JSON.parse(init.body).path);
        return { status: 200, ok: true, text: async () => JSON.stringify(ok({ user: { _id: "user_1" }, tasks: [], manualTasks: [], myWork: [] }).body) };
      },
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, "convex-task-client.js"), "utf8"), stuckContext, { filename: "convex-task-client.js" });
    keepToken();
    const client = new stuckWindow.PowConvexTaskClient(config);
    const started = Date.now();
    const restored = await client.restoreSessionWithLanding(landingArgs);
    assert.equal(restored.user._id, "user_1");
    assert.ok(Date.now() - started < 1000, "no wait on google's script");
    assert.deepEqual(stuck.fetches, ["tasks:raLanding"]);
    assert.equal(stuck.scriptAdded, 1, "the script still starts, for the hour-end refresh");
    client.clearAuthRefreshTimer();
    client.signOut();
  }

  console.log("convex-task-client: session kept on the device ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
