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
    return { status: fetchResponse.status, ok: fetchResponse.status < 400, text: async () => JSON.stringify(fetchResponse.body) };
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

  console.log("convex-task-client: session kept on the device ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
