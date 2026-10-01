const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");

function fixture({ storage, records = new Map(), sent = [], realContract = false } = {}) {
  let writes = 0;
  let nextId = 0;
  const form = { dataset: { submissionId: "original" }, isConnected: true };
  const button = { disabled: false };
  const document = {
    getElementById: id => ({ pinRapidCurrentForm: form, pinRapidSubmit: button }[id] || null),
    querySelector: () => null,
  };
  const window = {
    __POW_TEST_NO_BOOTSTRAP__: true,
    location: { search: "?batch=nz-temporal-ra-workpack-001", pathname: "/apps/regions/nz/verification.html" },
    localStorage: storage || {
      getItem() { throw new Error("Device storage blocked"); },
      setItem() { writes += 1; throw new Error("Device storage blocked"); },
      removeItem() { writes += 1; throw new Error("Device storage blocked"); },
    },
    PowRapidEntry: {
      secureSubmissionId: () => `corrected-${++nextId}`,
      validateObservationDetailed: () => null,
      observationPayload: values => values,
    },
  };
  const context = vm.createContext({ window, document, localStorage: window.localStorage, URLSearchParams, Event, console });
  if (realContract) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "rapid-entry-contract.js"), "utf8"), context);
    window.PowRapidEntry.secureSubmissionId = () => `corrected-${++nextId}`;
  }
  vm.runInContext(fs.readFileSync(path.join(__dirname, "verification-map.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "convex-task-client.js"), "utf8"), context);
  const app = Object.create(window.NzVerificationMap.prototype);
  let recordedTask;
  Object.assign(app, {
    backendUser: { _id: "member" },
    backend: {
      configured: true, signedIn: true, sessionId: "session",
      async submitCurrentObservation(args) {
        sent.push(args);
        const earlier = records.get(args.clientSubmissionId);
        if (!earlier) records.set(args.clientSubmissionId, {
          args,
          receipt: { task_id: `task-${records.size + 1}`, evidence_draft_id: `draft-${records.size + 1}`, task_status: "needs_review" },
        });
        if (sent.length <= 2) throw new Error("Response lost after server recording");
        return { ...records.get(args.clientSubmissionId).receipt, deduped: Boolean(earlier) };
      },
    },
    pinConfirmed: { latitude: -41.29, longitude: 174.78, zoom: 18, locationMode: "building_identified" },
    pinLinkedRefs: [{ task_id: "nearby", name: "Nearby hall", distance_m: 4 }],
    manualTasksById: new Map(), backendTasksById: new Map(), latestDraftsByTaskId: new Map(),
    sessionGuard: () => () => true,
    rapidObservationValues: () => ({ directObservation: "Hall seen today", flagForDiscussion: false }),
    rapidPeriodsPlan: () => null,
    pendingEvidenceFiles: () => null,
    entryCountry: () => ({ code: "NZ", config: { targetYears: [2026] } }),
    entryCountryNoteText: () => "",
    refreshBackendTasks: async () => {},
    renderSubmissionRecordedDetail: props => { recordedTask = props.task_id; },
  });
  for (const name of ["showRapidFieldError", "markFormDirty", "clearFormDirty", "renderPinLinkedCard", "applyFilters", "exitPinMode", "focusDetailPanel"]) app[name] = () => {};
  const options = {
    draftKey: "rapid-pin",
    getCandidate: () => ({ name: "Hall", latitude: app.pinConfirmed.latitude, longitude: app.pinConfirmed.longitude,
      ...(app.probableSameAsPayload() ? { probableSameAs: app.probableSameAsPayload() } : {}) }),
  };
  app.rapidFormOptions = { pin: options };
  if (!storage) app.keepRapidPinOnDevice();
  return { app, form, document, window, records, sent, submit: () => app.submitRapidObservation("pin", options),
    writes: () => writes, recordedTask: () => recordedTask };
}

for (const withEvidenceFiles of [false, true]) {
  test(`lost response, reload and unchanged retry ${withEvidenceFiles ? "after reselecting evidence through bound listeners (previous stamp fingerprint)" : "without evidence files"}`, async () => {
    const stored = new Map([["powDeviceOwner1", "member|session"]]);
    const storage = {
      getItem: key => stored.get(key) ?? null,
      setItem: (key, value) => stored.set(key, String(value)),
      removeItem: key => stored.delete(key),
    };
    const records = new Map();
    const sent = [];
    const page = () => {
      const f = fixture({ storage, records, sent, realContract: true });
      const fields = Object.fromEntries([
        "ObservationBasis", "ObservedOn", "SourceTitle", "SourceReference", "SourceId", "SourceLocator",
        "DenominationRaw", "DenominationBasis", "DirectObservation", "UncertaintyNote", "PrivacyFlag", "DiscussionNote",
      ].map(name => [`pin${name}`, { value: "" }]));
      fields.pinFlagForDiscussion = { checked: false };
      fields.pinSaveSourceToRegister = { checked: false };
      fields.pinEvidenceFiles = { files: [] };
      fields.pinEvidenceFilesCaption = { value: "" };
      const listeners = {};
      f.form.addEventListener = (type, fn) => { (listeners[type] ||= []).push(fn); };
      f.form.querySelectorAll = () => [];
      f.window.clearTimeout = () => {};
      f.window.setTimeout = () => { throw new Error("sent edits must persist immediately"); };
      for (const field of Object.values(fields)) field.addEventListener = () => {};
      const radio = { value: "confirmed_active", checked: false };
      const get = f.document.getElementById;
      f.document.getElementById = id => fields[id] || get(id);
      f.document.querySelector = selector => selector.startsWith('input[name="pinCurrentStatus"]')
        ? (selector.includes(":checked") && !radio.checked ? null : radio) : null;
      delete f.app.rapidObservationValues;
      delete f.app.pendingEvidenceFiles;
      for (const name of ["updateRapidSourceFields", "updateRapidDiscussionFields", "updateRapidUncertaintyField", "updateSourceLocatorField", "bindSourceTypeahead", "renderRapidSourceLinks", "syncInlineEvidenceFiles"]) f.app[name] = () => {};
      return { ...f, fields, radio, listeners };
    };
    const first = page();
    first.radio.checked = true;
    first.fields.pinObservationBasis.value = "direct_field_observation";
    first.fields.pinObservedOn.value = "2026-09-30";
    first.fields.pinDirectObservation.value = "Hall seen today";
    first.fields.pinPrivacyFlag.value = "needs_review";
    if (withEvidenceFiles) first.fields.pinEvidenceFiles.files = [{ name: "hall.jpg" }];
    first.app.persistRapidDraft("pin", "rapid-pin");
    first.app.keepRapidPinOnDevice();
    await first.submit();
    assert.equal(records.size, 1, "the server records before the response is lost");
    assert.equal(first.form.dataset.submissionId, "original");
    if (withEvidenceFiles) {
      // the lost send may have come from the preceding portal stamp, which
      // also fingerprinted the raw pin and text controls.
      const saved = first.app.readRapidDraft("rapid-pin");
      saved.sent_fingerprint = JSON.stringify({ ...JSON.parse(saved.sent_fingerprint),
        pin: first.app.pinConfirmed, linkedRefs: first.app.pinLinkedRefs, revision: null,
        name: "", address: "", locality: "", issueType: "" });
      storage.setItem(first.app.rapidDraftStorageKey("rapid-pin"), JSON.stringify(saved));
    }

    // a fresh page restores the sent draft, but the browser file input is empty
    const reloaded = page();
    reloaded.form.dataset.submissionId = "minted-after-reload";
    const record = reloaded.app.restoreRapidDraft("pin", "rapid-pin");
    const { linkedRefs, ...pin } = record.pin;
    reloaded.app.pinConfirmed = pin;
    reloaded.app.pinLinkedRefs = linkedRefs;
    reloaded.app.bindRapidObservationForm("pin", reloaded.app.rapidFormOptions.pin);
    assert.equal(record.values.hasEvidenceFiles, withEvidenceFiles);
    assert.equal(reloaded.app.rapidObservationValues("pin").hasEvidenceFiles, false);
    assert.equal(reloaded.form.dataset.submissionId, "original");
    assert.equal(reloaded.form.dataset.sentFingerprint, record.sent_fingerprint);
    // the file picker fires the real bound bubbling listeners after reload.
    // caption changes also concern the later upload, not the nomination.
    if (withEvidenceFiles) {
      reloaded.fields.pinEvidenceFiles.files = [{ name: "hall.jpg" }];
      for (const type of ["input", "change"]) {
        for (const listener of reloaded.listeners[type]) listener({ target: reloaded.fields.pinEvidenceFiles });
      }
      assert.equal(reloaded.form.dataset.submissionId, "original", "reselecting the same file retains the sent id");
      reloaded.fields.pinEvidenceFilesCaption.value = "The hall entrance";
      for (const listener of reloaded.listeners.input) listener({ target: reloaded.fields.pinEvidenceFilesCaption });
      assert.equal(reloaded.form.dataset.submissionId, "original", "an upload caption does not change the nomination");
      const saved = reloaded.app.readRapidDraft("rapid-pin");
      assert.equal(saved.sent_submission_id, "original", "unchanged autosave keeps the sent marker");
      assert.equal(saved.sent_fingerprint, reloaded.form.dataset.sentFingerprint);
    }
    await reloaded.submit();
    assert.equal(sent.length, 2, "the unchanged retry reaches the server");
    assert.equal(sent[1].clientSubmissionId, sent[0].clientSubmissionId, "reload retains the sent id");
    assert.equal(JSON.stringify(sent[1].observation), JSON.stringify(sent[0].observation), "the submitted text is unchanged");
    assert.equal(records.size, 1, "the unchanged retry creates no duplicate nomination");

    // a real edit after reload still rotates, even without an input event
    reloaded.fields.pinDirectObservation.value = "Corrected observation";
    await reloaded.submit();
    assert.notEqual(sent[2].clientSubmissionId, sent[0].clientSubmissionId);
    assert.equal(records.size, 2, "the changed content records separately");
    assert.equal(sent[2].observation.direct_observation, "Corrected observation");
  });
}

for (const change of ["candidate", "observation"]) {
  test(`blocked storage: programmatic ${change} edit without an input event`, async () => {
    const f = fixture();
    await f.submit();
    await f.submit();
    assert.equal(f.records.size, 1);
    if (change === "candidate") f.app.pinConfirmed.latitude = -41.30;
    if (change === "observation") f.app.rapidObservationValues = () => ({ sourceId: "picked-source", sourceTitle: "Register pick" });
    await f.submit();
    assert.notEqual(f.sent[2].clientSubmissionId, "original");
    assert.equal(f.records.size, 2);
    if (change === "candidate") assert.equal(f.sent[2].candidate.latitude, -41.30);
    if (change === "observation") assert.equal(f.sent[2].observation.sourceId, "picked-source");
    assert.equal(f.writes(), 0);
  });
}

test("blocked storage: source-register picks rotate immediately and retain the picked id", async () => {
  const f = fixture();
  await f.submit();
  await f.submit();
  const listeners = {};
  const title = { value: "Register", addEventListener: (type, fn) => { listeners[type] = fn; } };
  const sourceId = { value: "" };
  const reference = { value: "", dispatchEvent: () => f.app.persistRapidDraft("pin", "rapid-pin") };
  let pick;
  const row = { dataset: { title: "Register source", sourceId: "picked-source", reference: "https://example.org/source" },
    addEventListener: (_, fn) => { pick = fn; } };
  const list = { hidden: true, innerHTML: "", querySelectorAll: () => [row] };
  const get = f.document.getElementById;
  f.document.getElementById = id => ({ pinSourceTitle: title, pinSourceId: sourceId, pinSourceReference: reference, pinSourcePickList: list }[id] || get(id));
  const timers = [];
  f.window.setTimeout = fn => { timers.push(fn); return timers.length; };
  f.window.clearTimeout = () => {};
  f.app.backend.searchSources = async () => [{ source_id: "picked-source", title: "Register source", url: "https://example.org/source" }];
  f.app.updateSourceLocatorField = () => {};
  f.app.rapidObservationValues = () => ({ sourceId: sourceId.value, sourceTitle: title.value, sourceReference: reference.value });
  f.app.bindSourceTypeahead("pin");
  listeners.input();
  await timers[0]();
  pick();
  assert.notEqual(f.form.dataset.submissionId, "original");
  assert.equal(sourceId.value, "picked-source", "the edit event must leave the register identity intact");
  await f.submit();
  assert.equal(f.sent[2].observation.sourceId, "picked-source");
  assert.equal(f.records.size, 2);
  assert.equal(f.writes(), 0);
});

test("blocked storage: quick-photo edits rotate an ambiguously sent id", async () => {
  const f = fixture();
  const fields = { quickPhotoName: { value: "Original name" }, quickPhotoNote: { value: "Original note" } };
  f.document.getElementById = id => fields[id] || null;
  f.window.PowRapidEntry.localIsoDate = () => "2026-10-02";
  f.window.PowLocationAssertion = { payload: values => values };
  Object.assign(f.app, {
    quickPhoto: { submissionId: "original", epoch: 0, ownerId: "member", file: {}, previewUrl: "blob:first-preview",
      fix: { latitude: -41.29, longitude: 174.78, accuracyM: 30 }, country: f.app.entryCountry() },
    quickPhotoRadius: () => 30, quickPhotoNearby: () => [],
    quickPhotoDiscussionNote: note => note,
    closeQuickPhoto: () => { f.app.quickPhoto = null; },
  });
  await f.app.sendQuickPhoto();
  f.app.quickPhoto.previewUrl = "blob:replacement-preview";
  await f.app.sendQuickPhoto();
  assert.equal(f.records.size, 1, "the unchanged photo retry deduplicates across a preview URL change");
  fields.quickPhotoName.value = "Corrected name";
  fields.quickPhotoNote.value = "Corrected note";
  await f.app.sendQuickPhoto();
  assert.notEqual(f.sent[2].clientSubmissionId, "original");
  assert.equal(f.records.size, 2);
  assert.equal(f.sent[2].candidate.name, "Corrected name");
  assert.equal(f.sent[2].observation.discussionNote, "Corrected note");
  assert.equal(f.recordedTask(), "task-2");
  assert.equal(f.writes(), 0);
});

test("blocked storage: historical-claim edits rotate an ambiguously sent id", async () => {
  const f = fixture();
  const button = { disabled: false };
  f.document.getElementById = id => ({ historicalClaimForm: f.form, submitHistoricalClaimButton: button }[id] || null);
  f.window.PowHistoricalClaim = { validateHistoricalClaim: () => "", historicalClaimPayload: values => values };
  let claimText = "Original claim";
  let receipt;
  f.app.historicalClaimValues = () => ({ claimText });
  f.app.backend.submitHistoricalClaim = f.app.backend.submitCurrentObservation;
  f.app.taskHistoryByTaskId = new Map();
  f.app.renderHistoricalClaimEntry = (_, options) => { receipt = options; };
  const submit = () => f.app.submitHistoricalClaim({ taskId: "task", parentEvidenceDraftId: "parent", referenceDate: "2026-10-02" }, 0);
  await submit();
  await submit();
  assert.equal(f.records.size, 1, "the unchanged claim retry deduplicates");
  claimText = "Corrected claim";
  await submit();
  assert.notEqual(f.sent[2].clientSubmissionId, "original");
  assert.equal(f.records.size, 2);
  assert.equal(f.sent[2].claim.claimText, "Corrected claim");
  assert.equal(receipt.recordedCount, 1);
  assert.equal(f.writes(), 0);
});

test("blocked storage: guided period, chain and inherited-source edits rotate live ids", () => {
  const f = fixture();
  const state = { submissionId: "original", segments: [{ startMode: "known", startDate: "1990" }], chain: null, sameSource: true, provenance: null, gapAnswer: "", gapNote: "" };
  f.app.guidedPeriodsByTaskId = new Map([["periods", state]]);
  const send = () => f.app.persistGuidedPeriods("periods", { sending: true, provenance: { sourceTitle: "Original source" } });
  send();
  send();
  assert.equal(state.submissionId, "original");
  for (const edit of [() => { state.segments[0].startDate = "1991"; }, () => { state.chain = { note: "Changed use" }; }, () => { state.gapNote = "Uncertain gap"; }]) {
    const earlier = state.submissionId;
    edit();
    f.app.persistGuidedPeriods("periods");
    assert.notEqual(state.submissionId, earlier);
    send();
  }
  const earlier = state.submissionId;
  f.app.persistGuidedPeriods("periods", { sending: true, provenance: { sourceTitle: "Corrected source" } });
  assert.notEqual(state.submissionId, earlier);
  assert.equal(f.writes(), 0);
});

for (const change of ["unlink", "pin", "link"]) {
  test(`blocked storage: ${change} after a recorded send with a lost response`, async () => {
    const f = fixture();
    assert.equal(f.app.deviceWritable(), false);
    await f.submit();
    f.app.keepRapidPinOnDevice();
    assert.equal(f.form.dataset.submissionId, "original", "keeping the unchanged pin retains the sent id");
    await f.submit();
    assert.equal(f.sent[1].clientSubmissionId, "original", "an unchanged retry retains its id");
    assert.equal(f.records.size, 1, "the unchanged retry deduplicates");
    if (change === "unlink") f.app.unlinkNearbyTask("nearby");
    if (change === "link") f.app.linkNearbyTask({ taskId: "another", name: "Another hall", distance: 8 });
    if (change === "pin") {
      // exercise the real confirmation path used by drag, search and typed coordinates
      Object.assign(f.app, {
        pinMarker: { getLatLng: () => ({ lat: -41.30, lng: 174.79 }), dragging: { disable() {} } },
        map: { getZoom: () => 18, getBounds: () => ({ contains: () => true }) },
        pinLocationMode: () => "building_identified", pinLocationRadius: () => null,
        pinCardCarriesBasis: () => false, notePinCountry: () => {}, nearbyTaskRows: () => [], showPinForm: () => {},
      });
      f.app.confirmPinLocation();
    }
    assert.notEqual(f.form.dataset.submissionId, "original", `${change} rotates the live id before retrying`);
    await f.submit();
    assert.equal(f.records.size, 2, "the changed submission records separately");
    const corrected = f.sent[2].candidate;
    if (change === "unlink") assert.equal(corrected.probableSameAs, undefined, "the withdrawn link stays withdrawn");
    if (change === "link") assert.equal(corrected.probableSameAs.length, 2);
    if (change === "pin") assert.equal(corrected.latitude, -41.30, "the new location is recorded");
    assert.equal(f.recordedTask(), "task-2", "the portal shows the changed submission's receipt");
    assert.equal(f.writes(), 0, "device writes retain their session guard");
  });
}
