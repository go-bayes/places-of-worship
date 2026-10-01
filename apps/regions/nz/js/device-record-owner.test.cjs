// two tabs share storage, but each reads only its admitted member's records.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");

function tabs() {
  const values = new Map();
  let beforeRead;
  const storage = {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) {
      if (beforeRead && key !== "powDeviceOwner1") {
        const run = beforeRead;
        beforeRead = null;
        run(key);
      }
      return values.get(key) ?? null;
    },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
  function tab(ownerId, sessionId) {
    const field = { value: "" };
    const document = {
      getElementById(id) { return id === "pinDirectObservation" ? field : null; },
      querySelector() { return null; },
    };
    const window = {
      __POW_TEST_NO_BOOTSTRAP__: true,
      location: { search: "?batch=nz-temporal-ra-workpack-001", pathname: "/apps/regions/nz/verification.html" },
      localStorage: storage, sessionStorage: storage,
    };
    const context = vm.createContext({ window, document, localStorage: storage, sessionStorage: storage,
      URLSearchParams, URL, Map, Set, Date, Number, String, Boolean, Object, Array, Math, JSON, RegExp, Intl,
      console, setTimeout, clearTimeout, Promise, Error, TextEncoder });
    for (const file of ["occupancy-contract.js", "function-chain-contract.js", "task-presentation.js", "verification-map.js", "convex-task-client.js"]) {
      const source = file === "verification-map.js" && process.env.C1_MAP_SOURCE
        ? process.env.C1_MAP_SOURCE : path.join(__dirname, file);
      vm.runInContext(fs.readFileSync(source, "utf8"), context, { filename: file });
    }
    const app = Object.assign(Object.create(window.NzVerificationMap.prototype), {
      backendUser: { _id: ownerId }, backend: { sessionId },
      formSnapshotsByTaskId: new Map(), guidedPeriodsByTaskId: new Map(),
      rapidObservationValues: () => ({ directObservation: field.value }),
      updateRapidSourceFields() {}, updateRapidDiscussionFields() {},
      updateRapidUncertaintyField() {}, updateSourceLocatorField() {},
    });
    return { app, field, admit: () => window.PowConvexTaskClient.adoptDeviceFor(ownerId, sessionId) };
  }
  return { tab, values, storage, interleave: (run) => { beforeRead = run; } };
}

test("A checks ownership, B is admitted and saves, A restores without disclosing B", () => {
  const h = tabs();
  const a = h.tab("member_a", "session_a");
  const b = h.tab("member_b", "session_b");
  a.admit();
  h.interleave(() => {
    // the getItem intercept is after A's original storage-key marker check.
    b.admit();
    b.field.value = "PRIVATE DRAFT OF MEMBER B";
    b.app.persistRapidDraft("pin", "rapid-pin");
  });
  assert.equal(a.app.restoreRapidDraft("pin", "rapid-pin"), null);
  assert.equal(a.field.value, "");
  assert.equal(h.values.get("powDeviceOwner1"), "member_b|session_b");
});

test("all device record readers refuse foreign, ownerless and other-session records", () => {
  const h = tabs();
  const a = h.tab("member_a", "session_a");
  a.admit();
  const cases = [
    ["powRapidDraft2:NZ:rapid-pin", { values: { directObservation: "private" } }, () => a.app.readRapidDraft("rapid-pin"), null],
    ["powFormSnapshot2:NZ:task", { snapshot: { evidence_note: "private" } }, () => a.app.getFormSnapshot("task"), undefined],
    ["powGuidedPeriods:NZ:member_a:task", { segments: [{ start: "2001" }] }, () => a.app.readGuidedPeriodsStorage("task"), null],
  ];
  for (const [key, content, read, empty] of cases) {
    for (const owner of [{}, { ownerId: "member_b", sessionId: "session_b" }, { ownerId: "member_a", sessionId: "old_session" }]) {
      h.storage.setItem(key, JSON.stringify({ ...content, ...owner }));
      assert.equal(read(), empty, `${key} refuses ${JSON.stringify(owner)}`);
    }
    h.storage.setItem(key, JSON.stringify({ ...content, ownerId: "member_a", sessionId: "session_a" }));
    assert.ok(read(), `${key} restores the admitted identity's record`);
  }
});

test("snapshot and period reads also check the identity after an interleaved replacement", () => {
  for (const kind of ["snapshot", "periods"]) {
    const h = tabs();
    const a = h.tab("member_a", "session_a");
    const b = h.tab("member_b", "session_b");
    a.admit();
    h.interleave((key) => {
      b.admit();
      h.storage.setItem(key, JSON.stringify({ ownerId: "member_b", sessionId: "session_b",
        snapshot: { evidence_note: "private" }, segments: [{}] }));
    });
    assert.equal(kind === "snapshot" ? a.app.getFormSnapshot("task") : a.app.readGuidedPeriodsStorage("task"), kind === "snapshot" ? undefined : null);
  }
});

test("all entry writers bind records and autosave merges only its own pin", () => {
  const h = tabs();
  const a = h.tab("member_a", "session_a");
  a.admit();
  a.app.setFormSnapshot("task", { evidence_note: "own note" });
  a.app.guidedPeriodsByTaskId.set("task", { segments: [{}] });
  a.app.persistGuidedPeriods("task");
  a.app.pinConfirmed = { latitude: -41, longitude: 174 };
  a.app.keepRapidPinOnDevice();
  const pinKey = "powRapidDraft2:NZ:rapid-pin";
  assert.ok(JSON.parse(h.values.get(pinKey)).pin);
  a.app.dropRapidPinFromDevice();
  h.storage.setItem(pinKey, JSON.stringify({ ownerId: "member_b", sessionId: "session_b", pin: { latitude: 1, longitude: 2 } }));
  a.field.value = "own note";
  a.app.persistRapidDraft("pin", "rapid-pin");
  assert.equal(JSON.parse(h.values.get(pinKey)).pin, undefined, "foreign pin is never merged into autosave");
  for (const [key, raw] of h.values) {
    if (key === "powDeviceOwner1") continue;
    const record = JSON.parse(raw);
    assert.equal(record.ownerId, "member_a", key);
    assert.equal(record.sessionId, "session_a", key);
  }
});
