const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");

function assertDigest(pair, args) {
  const { clientSubmissionId, ...payload } = args;
  const json = JSON.stringify(payload, (key, value) => value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.keys(value).sort().map(name => [name, value[name]])) : value);
  assert.equal(pair?.submission_id, clientSubmissionId, "the last-send pair exists before the write");
  assert.equal(pair?.payload_digest, require("node:crypto").createHash("sha256").update(json).digest("hex"), "the digest covers the exact final request");
}

let fixtureNumber = 0;

function fixture({ storage, records = new Map(), sent = [], realContract = false } = {}) {
  const instance = ++fixtureNumber;
  let writes = 0;
  let nextId = 0;
  const form = { dataset: {}, isConnected: true };
  const button = { disabled: false };
  const document = {
    getElementById: id => ({ pinRapidCurrentForm: form, pinRapidSubmit: button }[id] || null),
    querySelector: () => null,
  };
  const window = {
  crypto: require("node:crypto").webcrypto,
    __POW_TEST_NO_BOOTSTRAP__: true,
    location: { search: "?batch=nz-temporal-ra-workpack-001", pathname: "/apps/regions/nz/verification.html" },
    localStorage: storage || {
      getItem() { throw new Error("Device storage blocked"); },
      setItem() { writes += 1; throw new Error("Device storage blocked"); },
      removeItem() { writes += 1; throw new Error("Device storage blocked"); },
    },
    PowRapidEntry: {
      secureSubmissionId: () => `send-${instance}-${++nextId}`,
      validateObservationDetailed: () => null,
      observationPayload: values => values,
    },
  };
  const context = vm.createContext({ TextEncoder, window, document, localStorage: window.localStorage, URLSearchParams, Event, console });
  if (realContract) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "rapid-entry-contract.js"), "utf8"), context);
    window.PowRapidEntry.secureSubmissionId = () => `send-${instance}-${++nextId}`;
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
        const live = args.claim ? form : app.quickPhoto || form;
        assertDigest(live.lastSend, args);
        if (storage) {
          const key = app.rapidDraftStorageKey("rapid-pin");
          if (!args.claim && !app.quickPhoto) assertDigest(JSON.parse(storage.getItem(key)).last_send, args);
        }
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
  return { app, form, document, window, context, records, sent, submit: () => app.submitRapidObservation("pin", options),
    writes: () => writes, recordedTask: () => recordedTask };
}

for (const withEvidenceFiles of [false, true]) {
  test(`lost response, reload and unchanged retry ${withEvidenceFiles ? "after reselecting evidence through bound listeners (send-time digest)" : "without evidence files"}`, async () => {
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
    assertDigest(first.form.lastSend, sent[0]);
    // a fresh page restores the sent draft, but the browser file input is empty
    const reloaded = page();
    const record = reloaded.app.restoreRapidDraft("pin", "rapid-pin");
    const { linkedRefs, ...pin } = record.pin;
    reloaded.app.pinConfirmed = pin;
    reloaded.app.pinLinkedRefs = linkedRefs;
    reloaded.app.bindRapidObservationForm("pin", reloaded.app.rapidFormOptions.pin);
    assert.equal(record.values.hasEvidenceFiles, withEvidenceFiles);
    assert.equal(reloaded.app.rapidObservationValues("pin").hasEvidenceFiles, false);
    assert.equal(reloaded.form.lastSend, undefined, "restore and rendering do not load a submission id");
    // the file picker fires the real bound bubbling listeners after reload.
    // caption changes also concern the later upload, not the nomination.
    if (withEvidenceFiles) {
      reloaded.fields.pinEvidenceFiles.files = [{ name: "hall.jpg" }];
      for (const type of ["input", "change"]) {
        for (const listener of reloaded.listeners[type]) listener({ target: reloaded.fields.pinEvidenceFiles });
      }
      assert.equal(reloaded.form.lastSend, undefined, "file listeners do not decide an id");
      reloaded.fields.pinEvidenceFilesCaption.value = "The hall entrance";
      for (const listener of reloaded.listeners.input) listener({ target: reloaded.fields.pinEvidenceFilesCaption });
      assert.equal(reloaded.form.lastSend, undefined, "caption listeners do not decide an id");
      const saved = reloaded.app.readRapidDraft("rapid-pin");
      assert.deepEqual(saved.last_send, record.last_send, "autosave preserves the last-send pair");
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
    assert.notEqual(f.sent[2].clientSubmissionId, f.sent[0].clientSubmissionId);
    assert.equal(f.records.size, 2);
    if (change === "candidate") assert.equal(f.sent[2].candidate.latitude, -41.30);
    if (change === "observation") assert.equal(f.sent[2].observation.sourceId, "picked-source");
    assert.equal(f.writes(), 0);
  });
}

test("blocked storage: source-register picks leave ids alone until send and retain the picked source", async () => {
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
  assert.equal(f.form.lastSend.submission_id, f.sent[0].clientSubmissionId, "an edit waits for the next send");
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
  assert.notEqual(f.sent[2].clientSubmissionId, f.sent[0].clientSubmissionId);
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
  assert.notEqual(f.sent[2].clientSubmissionId, f.sent[0].clientSubmissionId);
  assert.equal(f.records.size, 2);
  assert.equal(f.sent[2].claim.claimText, "Corrected claim");
  assert.equal(receipt.recordedCount, 1);
  assert.equal(f.writes(), 0);
});

for (const change of ["unlink", "pin", "link"]) {
  test(`blocked storage: ${change} after a recorded send with a lost response`, async () => {
    const f = fixture();
    assert.equal(f.app.deviceWritable(), false);
    await f.submit();
    f.app.keepRapidPinOnDevice();
    assert.equal(f.form.lastSend.submission_id, f.sent[0].clientSubmissionId, "pin persistence does not change the id");
    await f.submit();
    assert.equal(f.sent[1].clientSubmissionId, f.sent[0].clientSubmissionId, "an unchanged retry retains its id");
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
    assert.equal(f.form.lastSend.submission_id, f.sent[0].clientSubmissionId, `${change} waits for send-time comparison`);
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

for (const field of ["name", "address", "locality"]) {
  test(`candidate ${field} changes only at the next send`, async () => {
    const f = fixture();
    const candidate = { name: "Hall", address: "1 Street", locality: "Town", latitude: -41.29, longitude: 174.78 };
    f.app.rapidFormOptions.pin.getCandidate = () => ({ ...candidate });
    await f.submit();
    const original = f.sent[0].clientSubmissionId;
    candidate[field] = "Changed";
    f.app.persistRapidDraft("pin", "rapid-pin");
    assert.equal(f.form.lastSend.submission_id, original);
    await f.submit();
    assert.notEqual(f.sent[1].clientSubmissionId, original);
    assert.equal(f.sent[1].candidate[field], "Changed");
  });
}

for (const reload of [false, true]) {
  test(`registered source selected after lost response${reload ? " and reload" : ""}`, async () => {
    const stored = new Map([["powDeviceOwner1", "member|session"]]);
    const storage = { getItem: key => stored.get(key) ?? null, setItem: (key, val) => stored.set(key, val), removeItem: key => stored.delete(key) };
    const f = fixture({ storage, realContract: true });
    const values = { currentStatus: "confirmed_active", observationBasis: "named_public_source", observedOn: "2026-10-02",
      sourceTitle: "Directory", sourceReference: "https://example.org/source", sourceId: "", sourceLocator: "",
      directObservation: "The directory records regular worship.", privacyFlag: "clear", saveSourceToRegister: true };
    f.window.PowRapidEntry.validateObservationDetailed = () => null;
    f.app.rapidObservationValues = () => ({ ...values });
    f.app.backend.createSource = async () => ({ source_id: "source-registered" });
    f.app.persistRapidDraft("pin", "rapid-pin");
    await f.submit();
    assert.equal(f.sent.length, 1);
    assert.equal(f.sent[0].observation.source_id, "source-registered");
    const retry = reload ? fixture({ storage, records: f.records, sent: f.sent, realContract: true }) : f;
    retry.window.PowRapidEntry.validateObservationDetailed = () => null;
    // The contributor picks exactly the source used by the first final request.
    retry.app.rapidObservationValues = () => ({ ...values, sourceId: "source-registered" });
    await retry.submit();
    assert.equal(f.sent[1].clientSubmissionId, f.sent[0].clientSubmissionId);
    assert.equal(f.records.size, 1);
  });
}

function periodsFixture(options = {}) {
  const f = fixture(options);
  for (const file of ["occupancy-contract.js", "function-chain-contract.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, file), "utf8"), f.context);
  }
  delete f.app.rapidPeriodsPlan;
  const parent = { assessmentConfidence: "0.7", sourceType: "named_public_source", sourceTitle: "Directory",
    sourceUrl: "https://example.org/source", note: "The directory states these dates and weekly worship.", sourceDate: "2026-10-02", privacyFlag: "clear" };
  const provenance = f.window.PowOccupancy.provenanceFromParent(parent, "").provenance;
  const state = { sameSource: true, provenance, gapAnswer: "yes", gapNote: "", referenceDate: "2026-10-02", chain: null,
    segments: [
      { startMode: "known", startDate: "1990", startBasis: "founding_stated", endMode: "known", endDate: "1995", endBasis: "closure_stated", endReason: "closed", sameAsPin: true },
      { startMode: "known", startDate: "2000", startBasis: "founding_stated", endMode: "still_active", stillActiveAsof: "2026-10-02", sameAsPin: true },
    ] };
  Object.assign(f.app, { guidedPeriodsByTaskId: new Map([["rapid-pin-periods", state], ["task", state]]),
    taskHistoryByTaskId: new Map(), formSnapshotsByTaskId: new Map(), revisionDraftIdsByTaskId: new Map(),
    occupancyTaskPoint: () => f.app.pinConfirmed, currentFormValues: () => parent, readGuidedPeriods: () => {}, readOccupancyForm: () => {},
    evidenceInputError: () => "", guidedPeriodsError: () => "", buildWideEvidenceRow: () => ({}), buildEvidenceDraft: () => ({}), setTransportBusy: () => {},
    renderOccupancyRecorded: () => {},
  });
  f.app.backendTasksById.set("task", { task_id: "task" });
  const requests = [];
  const sets = new Map();
  const write = async args => {
    requests.push(args);
    assertDigest((f.app.occupancyDraft || f.app.guidedPeriodsState("task")).lastSend, args);
    const existing = sets.has(args.clientSubmissionId);
    sets.set(args.clientSubmissionId, args);
    if (requests.length <= 2) throw new Error("Response lost after recording periods");
    return { period_count: args.segments.length, deduped: existing };
  };
  f.app.backend.submitOccupancies = write;
  f.app.backend.submitEvidenceDraftWithOccupancies = write;
  f.app.backend.saveEvidenceDraft = async () => ({ evidence_draft_id: "parent" });
  const get = f.document.getElementById;
  f.document.getElementById = id => ({ occupancyForm: {}, occupancySubmitButton: { disabled: false } }[id] || get(id));
  return { ...f, parent, state, requests, sets, provenance };
}

for (const count of [2, 3]) {
  test(`lost-response handover preserves ${count} distinct periods and deduplicates pane retry`, async () => {
    const f = periodsFixture();
    if (count === 3) f.state.segments.unshift({ ...f.state.segments[0], startDate: "1980", endDate: "1985" });
    const plan = f.app.rapidPeriodsPlan("rapid-pin-periods", { observedOn: "2026-10-02", observationBasis: "named_public_source", sourceTitle: "Directory",
      sourceReference: "https://example.org/source", directObservation: f.parent.note, privacyFlag: "clear" });
    assert.ok(plan && !plan.problem);
    const outcome = await f.app.recordRapidPeriods(plan, { task_id: "task", evidence_draft_id: "parent" }, "rapid-pin-periods");
    assert.match(outcome.periodsError, /Response lost/);
    const context = f.app.occupancyDraft.context;
    await f.app.submitOccupancies(context);
    assert.equal(f.requests.length, 2);
    assert.deepEqual(f.requests[1], f.requests[0], "the final request, including every period and context, is identical");
    assert.equal(f.sets.size, 1);
    assert.deepEqual(Array.from(f.requests[1].segments, seg => seg.start_date), count === 2 ? ["1990", "2000"] : ["1980", "1990", "2000"]);
  });
}

for (const edit of ["period date", "source", "chain", "remove period", "gap note", "parent evidence id"]) {
  test(`atomic guided send: ${edit} change mints an id after an unchanged lost-response retry`, async () => {
    const f = periodsFixture();
    const submit = () => f.app.saveEvidenceToBackend({ task_id: "task" }, { submit: true });
    await submit();
    await submit();
    assert.equal(f.requests.length, 2);
    assert.deepEqual(f.requests[1], f.requests[0]);
    if (edit === "period date") f.state.segments[0].startDate = "1991";
    if (edit === "source") f.parent.sourceTitle = "Updated directory";
    if (edit === "chain") {
      f.state.chain = f.window.PowFunctionChain.blankChain();
      Object.assign(f.state.chain.start, { label: "Anglican", dateMode: "known", date: "1990" });
    }
    if (edit === "remove period") f.state.segments.shift();
    if (edit === "gap note") f.state.gapNote = "The gap has not been established.";
    if (edit === "parent evidence id") {
      f.app.revisionDraftIdsByTaskId.set("task", "different-parent");
      f.app.backend.saveEvidenceDraft = async () => ({ evidence_draft_id: "different-parent" });
    }
    const earlier = f.state.lastSend;
    f.app.persistGuidedPeriods("task");
    assert.equal(f.state.lastSend, earlier, "autosave never changes the submission id");
    await submit();
    assert.equal(f.requests.length, 3);
    assert.notEqual(f.requests[2].clientSubmissionId, f.requests[0].clientSubmissionId);
    assert.equal(f.sets.size, 2);
  });
}

for (const scenario of ["blank parent during restore", "trailing whitespace in gap note"]) {
  test(`atomic guided lost-response reload retry with ${scenario}`, async () => {
    const stored = new Map([["powDeviceOwner1", "member|session"]]);
    const storage = { getItem: key => stored.get(key) ?? null, setItem: (key, val) => stored.set(key, val), removeItem: key => stored.delete(key) };
    const first = periodsFixture({ storage });
    first.state.gapNote = "The gap is uncertain.";
    await first.app.saveEvidenceToBackend({ task_id: "task" }, { submit: true });
    assert.equal(first.requests.length, 1);
    const reloaded = periodsFixture({ storage });
    reloaded.app.guidedPeriodsByTaskId.clear();
    const state = reloaded.app.guidedPeriodsState("task");
    assert.equal(state.lastSend, undefined, "restoration does not read an id");
    reloaded.app.currentFormValues = () => ({});
    const block = { addEventListener() {}, querySelectorAll: () => [] };
    const get = reloaded.document.getElementById;
    reloaded.document.getElementById = id => id === "guidedPeriods" ? block : id === "sourceDateInput" ? { value: "", addEventListener() {} } : get(id);
    for (const method of ["updateFunctionChainBlock", "updateGuidedGapPrompt", "updateGuidedPeriodsPreview"]) reloaded.app[method] = () => {};
    reloaded.app.bindGuidedPeriods({ task_id: "task" });
    reloaded.app.currentFormValues = () => reloaded.parent;
    if (scenario === "trailing whitespace in gap note") state.gapNote += "   ";
    await reloaded.app.saveEvidenceToBackend({ task_id: "task" }, { submit: true });
    assert.equal(reloaded.requests.length, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(reloaded.requests[0])), JSON.parse(JSON.stringify(first.requests[0])));
  });
}

// Exercise the registered handlers, including task status changes, evidence
// receipts, supersession and reviewer confirmations, rather than token stubs.
let handlersPromise;
function actualHandlers() {
  return handlersPromise ||= (async () => {
    const harness = await import("../../../../convex/testing/exportWorld.node-test.mjs");
    // the shared harness defaults to September; these cards are dated October.
    let clock = Date.UTC(2026, 9, 3);
    Date.now = () => ++clock;
    const [tasks, rapid, occupancies, sources, evidence] = await Promise.all([
      import("../../../../convex/tasks.ts"), import("../../../../convex/rapidEntry.ts"),
      import("../../../../convex/occupancies.ts"), import("../../../../convex/sources.ts"),
      import("../../../../convex/evidence.ts"),
    ]);
    return { ...harness, ...tasks, ...rapid, ...occupancies, ...sources, ...evidence };
  })();
}

function deviceStorage(user) {
  const stored = new Map([["powDeviceOwner1", `${user._id}|session`]]);
  return {
    getItem: key => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, String(value)),
    removeItem: key => stored.delete(key),
  };
}

const realObservationValues = () => ({ currentStatus: "currently_used_for_worship", observationBasis: "direct_field_observation",
  observedOn: "2026-10-02", directObservation: "Weekly services were in progress at the building when visited.", privacyFlag: "clear" });

for (const mode of ["live", "reload", "blocked storage"]) {
  test(`actual handlers: revision lost response and identical ${mode} retry retain one observation`, async () => {
    const h = await actualHandlers();
    const w = h.world();
    const user = await w.addUser("revision-ra", ["ra"]);
    const storage = mode === "blocked storage" ? undefined : deviceStorage(user);
    const sent = [];
    const resolutions = [];
    const target = { siteId: "existing-site", name: "Existing hall", latitude: -41.29, longitude: 174.78 };
    const page = () => {
      const f = fixture({ storage, realContract: true });
      f.window.PowRapidEntry.secureSubmissionId = require("node:crypto").randomUUID;
      f.app.backendUser = user;
      f.app.rapidObservationValues = realObservationValues;
      f.app.backend.createIssueTask = async args => {
        resolutions.push(args);
        return h.createIssueTask._handler(w.as(user), args);
      };
      f.app.backend.submitCurrentObservation = async args => {
        sent.push(args);
        const receipt = await h.submitCurrentObservation._handler(w.as(user), args);
        if (sent.length === 1) throw new Error("Response lost after observation recorded");
        return receipt;
      };
      const options = { draftKey: "rapid-pin", flushDraft: () => f.app.persistRapidDraft("pin", "rapid-pin"),
        createTask: (record, key) => f.app.createRevisionTask(target, record, key) };
      return { ...f, submit: () => f.app.submitRapidObservation("pin", options) };
    };
    const first = page();
    await first.submit();
    assert.equal(w.rows.evidence_drafts.length, 1, "the first observation really records before its reply is lost");
    assert.equal(w.rows.tasks[0].status, "needs_review", "task creation can no longer reuse this issue as open");
    const retry = mode === "reload" ? page() : first;
    await retry.submit();
    assert.equal(sent.length, 2, "retry reaches the actual observation handler");
    assert.deepEqual(JSON.parse(JSON.stringify(sent[1])), JSON.parse(JSON.stringify(sent[0])), "task, content and id stay identical");
    assert.equal(w.rows.tasks.length, 1);
    assert.equal(w.rows.evidence_drafts.length, 1, "no duplicate submitted observation");
    assert.equal(w.rows.evidence_submission_receipts.length, 1);
    assert.equal(resolutions.length, 1, "the resolved prerequisite survives the task's status change");
    assert.equal(retry.recordedTask(), w.rows.tasks[0].task_id);
    assert.equal(retry.app.readRapidDraft("rapid-pin"), null, "matching successful receipt clears its stored prerequisite");
  });
}

test("actual handlers: rapid-period lost response, handover, reload and blocked-storage retries preserve reviewed rows", async () => {
  const h = await actualHandlers();
  for (const blocked of [false, true]) {
    const w = h.world();
    const user = await w.addUser("period-ra", ["ra"]);
    const reviewer = await w.addUser("period-reviewer", ["reviewer"]);
    const storage = blocked ? undefined : deviceStorage(user);
    await w.addTask({ task_id: "task", batch_id: "manual-nz", assigned_to: user._id });
    const parent = await h.submitCurrentObservation._handler(w.as(user), {
      taskId: "task", clientSubmissionId: require("node:crypto").randomUUID(),
      observation: { current_status: "currently_used_for_worship", observation_basis: "direct_field_observation",
        observed_on: "2026-10-02", direct_observation: realObservationValues().directObservation, privacy_flag: "clear" },
    });
    const sent = [];
    const page = () => {
      const f = periodsFixture({ storage });
      f.app.backendUser = user;
      f.window.PowRapidEntry.secureSubmissionId = require("node:crypto").randomUUID;
      f.app.backend.submitOccupancies = async args => {
        sent.push(args);
        const receipt = await h.submitOccupancies._handler(w.as(user), args);
        if (sent.length <= 2) throw new Error("Response lost after periods recorded");
        return receipt;
      };
      return f;
    };
    const first = page();
    const plan = first.app.rapidPeriodsPlan("rapid-pin-periods", { observedOn: "2026-10-02", observationBasis: "named_public_source",
      sourceTitle: "Directory", sourceReference: "https://example.org/source", directObservation: first.parent.note, privacyFlag: "clear" });
    const outcome = await first.app.recordRapidPeriods(plan, parent, "rapid-pin-periods");
    assert.match(outcome.periodsError, /Response lost/);
    assert.equal(w.rows.site_occupancies.length, 2);
    await h.confirmAllDerived._handler(w.as(reviewer), { taskId: "task", parentEvidenceDraftId: parent.evidence_draft_id });
    assert.ok(w.rows.derived_target_year_states.some(row => row.review_state === "reviewer_confirmed"));
    const before = JSON.stringify({ periods: w.rows.site_occupancies, states: w.rows.derived_target_year_states,
      locations: w.rows.derived_year_locations, events: w.rows.derived_state_events, versions: w.rows.evidence_versions });
    // With storage blocked the live handover is retained. With writable
    // storage a fresh page reconstructs the same cards against the same parent.
    const retry = blocked ? first : page();
    if (!blocked) {
      retry.app.occupancyDraft = JSON.parse(JSON.stringify(first.app.occupancyDraft));
      delete retry.app.occupancyDraft.lastSend;
    }
    await retry.app.submitOccupancies(retry.app.occupancyDraft.context);
    await retry.app.submitOccupancies(retry.app.occupancyDraft.context);
    assert.equal(sent.length, 3, "both pane retries reach the handler");
    assert.deepEqual(JSON.parse(JSON.stringify(sent[1])), JSON.parse(JSON.stringify(sent[0])), "handover and reload retain the same request");
    assert.deepEqual(JSON.parse(JSON.stringify(sent[2])), JSON.parse(JSON.stringify(sent[0])));
    assert.equal(JSON.stringify({ periods: w.rows.site_occupancies, states: w.rows.derived_target_year_states,
      locations: w.rows.derived_year_locations, events: w.rows.derived_state_events, versions: w.rows.evidence_versions }), before,
      "retry neither replaces periods nor resets confirmed derived states");
    assert.equal(retry.app.readRapidDraft(`send:occupancy:task:${parent.evidence_draft_id}`), null, "successful matching receipt clears only its send pair");
  }
});

for (const mode of ["live", "reload", "blocked storage"]) {
  test(`actual handlers: optional source reply lost before observation, identical ${mode} retry keeps citation-only request`, async () => {
    const h = await actualHandlers();
    const w = h.world();
    const user = await w.addUser("source-ra", ["ra"]);
    const storage = mode === "blocked storage" ? undefined : deviceStorage(user);
    const sent = [];
    let registrations = 0;
    const page = () => {
      const f = fixture({ storage, realContract: true });
      f.app.backendUser = user;
      f.window.PowRapidEntry.secureSubmissionId = require("node:crypto").randomUUID;
      f.app.pinLinkedRefs = [];
      f.app.pinNearbyCount = 0;
      const status = { textContent: "", classList: { add() {}, remove() {} } };
      const get = f.document.getElementById;
      f.document.getElementById = id => id === "pinRapidStatus" ? status : get(id);
      f.app.rapidObservationValues = () => ({ ...realObservationValues(), observationBasis: "named_public_source",
        sourceTitle: "Directory", sourceReference: "https://example.org/source", saveSourceToRegister: true });
      f.app.backend.createSource = async args => {
        const result = await h.createSource._handler(w.as(user), args);
        if (++registrations === 1) throw new Error("Source registration reply lost");
        return result;
      };
      f.app.backend.submitCurrentObservation = async args => {
        sent.push(args);
        const result = await h.submitCurrentObservation._handler(w.as(user), args);
        if (sent.length === 1) throw new Error("Observation reply lost");
        return result;
      };
      const options = { ...f.app.rapidFormOptions.pin, flushDraft: () => f.app.persistRapidDraft("pin", "rapid-pin") };
      return { ...f, status, submit: () => f.app.submitRapidObservation("pin", options) };
    };
    const first = page();
    await first.submit();
    assert.equal(w.rows.sources.length, 1, "registration records despite the lost source reply");
    assert.equal(w.rows.evidence_drafts.length, 1, first.status.textContent);
    const retry = mode === "reload" ? page() : first;
    await retry.submit();
    assert.equal(sent.length, 2);
    assert.deepEqual(JSON.parse(JSON.stringify(sent[1])), JSON.parse(JSON.stringify(sent[0])));
    assert.equal(w.rows.evidence_drafts.length, 1, "a register retry cannot duplicate a citation-only observation");
    assert.equal(registrations, 1);
  });
}

for (const mode of ["live", "reload", "blocked storage"]) {
  test(`actual handlers: guided atomic lost response and identical ${mode} retry reuse immutable parent`, async () => {
    const h = await actualHandlers();
    const w = h.world();
    const user = await w.addUser("guided-ra", ["ra"]);
    const storage = mode === "blocked storage" ? undefined : deviceStorage(user);
    await w.addTask({ task_id: "task", assigned_to: user._id });
    const saves = [];
    const sent = [];
    const page = () => {
      const f = periodsFixture({ storage });
      f.app.backendUser = user;
      f.window.PowRapidEntry.secureSubmissionId = require("node:crypto").randomUUID;
      f.app.buildEvidenceDraft = () => h.draftContent({ source_date_or_capture_date: f.parent.sourceDate,
        source_title: f.parent.sourceTitle, evidence_note: f.parent.note });
      f.app.backend.saveEvidenceDraft = async args => {
        saves.push(args);
        return h.saveEvidenceDraft._handler(w.as(user), args);
      };
      f.app.backend.submitEvidenceDraftWithOccupancies = async args => {
        sent.push(args);
        const result = await h.submitEvidenceDraftWithOccupancies._handler(w.as(user), args);
        if (sent.length === 1) throw new Error("Atomic submission reply lost");
        return result;
      };
      return { ...f, submit: () => f.app.saveEvidenceToBackend({ task_id: "task" }, { submit: true }) };
    };
    const first = page();
    await first.submit();
    assert.equal(w.rows.evidence_drafts[0].draft_status, "submitted");
    assert.equal(w.rows.site_occupancies.length, 2);
    const retry = mode === "reload" ? page() : first;
    if (mode === "reload") {
      retry.app.guidedPeriodsByTaskId.delete("task");
      retry.app.guidedPeriodsState("task");
    }
    await retry.submit();
    assert.equal(sent.length, 2, "retry reaches atomic handler without trying to edit the submitted parent");
    assert.deepEqual(JSON.parse(JSON.stringify(sent[1])), JSON.parse(JSON.stringify(sent[0])));
    assert.equal(saves.length, 1);
    assert.equal(w.rows.site_occupancies.length, 2);
    assert.equal(w.rows.evidence_drafts.length, 1);
    assert.equal(w.rows.evidence_submission_receipts.length, 1);
  });
}
