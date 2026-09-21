// quick photo (jb 2026-09-22): one press opens the camera; the photo, the
// phone's position and today's date go to review as a flagged partial
// entry on the rapid lane, with the photo attached to the task it creates;
// without a position the photo rides the pin flow instead. held by the
// actual portal class in a stub dom
const assert = require("node:assert/strict");
// structures built inside the vm context carry its own prototypes, so the
// loose deep comparison is the one that reads them
const loose = require("node:assert");
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
const classList = () => {
  const set = new Set();
  return {
    add(name) { set.add(name); },
    remove(name) { set.delete(name); },
    toggle(name, force) { const on = force === undefined ? !set.has(name) : Boolean(force); if (on) set.add(name); else set.delete(name); return on; },
    contains(name) { return set.has(name); },
  };
};
const elements = new Map();
const element = (id, extra = {}) => {
  const item = { id, value: "", hidden: true, textContent: "", innerHTML: "", attrs: {}, classList: classList(), disabled: false, files: [],
    setAttribute(name, value) { this.attrs[name] = value; }, removeAttribute(name) { delete this.attrs[name]; },
    addEventListener() {}, querySelectorAll() { return []; }, scrollIntoView() {}, ...extra };
  elements.set(id, item);
  return item;
};
const document = {
  body: { classList: classList() },
  getElementById(id) { return elements.get(id) || null; },
  createElement() { return { textContent: "", classList: classList(), remove() {}, addEventListener() {} }; },
  querySelector() { return null; },
  querySelectorAll() { return []; },
  addEventListener() {},
  removeEventListener() {},
};
let confirmAnswer = true;
const window = {
  __POW_TEST_NO_BOOTSTRAP__: true,
  location: { search: "?batch=nz-temporal-ra-workpack-001", pathname: "/apps/regions/nz/verification.html" },
  localStorage, sessionStorage: localStorage,
  setTimeout, clearTimeout,
  matchMedia: () => ({ matches: false }),
  isSecureContext: true,
  confirm: () => confirmAnswer,
  crypto: { getRandomValues: (bytes) => bytes.fill(7), randomUUID: () => "11111111-2222-4333-8444-555555555555" },
  URL: { createObjectURL: () => "blob:photo", revokeObjectURL() {} },
};
const navigator = { geolocation: { getCurrentPosition() {} } };
// leaflet's latLng is only used for the nearby check here
const L = { latLng: (lat, lng) => ({ lat, lng, distanceTo: () => 1e9 }) };
const context = vm.createContext({
  window, document, localStorage, sessionStorage: localStorage, navigator, L,
  URLSearchParams, Map, Set, Date, Number, String, Boolean, Object, Array, Math, JSON, RegExp, Intl, console, setTimeout, clearTimeout, Promise, Error, Uint8Array,
});
for (const file of ["rapid-entry-contract.js", "location-assertion-contract.js", "occupancy-contract.js", "function-chain-contract.js", "task-presentation.js", "verification-map.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, file), "utf8"), context, { filename: file });
}

const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const photo = { name: "IMG_1.jpg", type: "image/jpeg", size: 1024 };

const fresh = ({ attachments = true } = {}) => {
  const app = Object.create(window.NzVerificationMap.prototype);
  app.backendUser = { _id: "user_1", initials: "JB" };
  app.backend = { configured: true, signedIn: true, attachmentsEnabled: async () => attachments };
  app.portalMode = "add";
  app.pinMode = false;
  app.quickPhoto = null;
  app.quickPhotoCarry = null;
  app.occupancyPinContext = null;
  app.selectedContextFeature = null;
  app.tasks = [];
  app.manualTasksById = new Map();
  app.backendTasksById = new Map();
  app.latestDraftsByTaskId = new Map();
  app.paneSnap = () => {};
  app.renderInitialDetail = () => {};
  app.renderBackendPanel = () => {};
  app.refreshBackendTasks = async () => {};
  app.applyFilters = () => {};
  app.focusDetailPanel = () => {};
  app.map = { closePopup() {}, setView() {}, getZoom: () => 17 };
  return app;
};
const mountElements = () => {
  element("addPlaceButton");
  element("addReviseHint");
  element("quickPhotoWrap");
  element("quickPhotoHint");
  element("pinCardHost");
  element("quickPhotoPosition");
  element("quickPhotoSendButton");
  element("quickPhotoDropPinButton");
  element("quickPhotoCancelButton");
  element("quickPhotoNote");
  element("quickPhotoStatus");
  element("copyStatus");
  element("pinStatus");
};

(async () => {
  // 1. the button shows only signed in, in Add / Revise, with storage wired, and no entry open
  {
    const app = fresh();
    mountElements();
    const wrap = document.getElementById("quickPhotoWrap");
    app.renderAddReviseControl();
    assert.equal(wrap.hidden, true, "hidden until the storage probe answers");
    await tick();
    assert.equal(wrap.hidden, false, "shown once storage is known to be wired");
    app.pinMode = true;
    app.renderAddReviseControl();
    assert.equal(wrap.hidden, true, "hidden while a pin entry is open");
    app.pinMode = false;
    app.backendUser = null;
    app.renderQuickPhotoButton();
    assert.equal(wrap.hidden, true, "hidden signed out");
    const bare = fresh({ attachments: false });
    bare.renderAddReviseControl();
    await tick();
    assert.equal(wrap.hidden, true, "hidden without attachment storage");
  }

  // 2. a press opens the camera and starts the position request together
  {
    const app = fresh();
    mountElements();
    app.attachmentsEnabledCache = true;
    let clicks = 0;
    let positioned = 0;
    element("quickPhotoInput", { click() { clicks += 1; }, value: "stale" });
    app.requestPosition = () => { positioned += 1; return Promise.resolve({ latitude: -41.3, longitude: 174.8, accuracyM: 8 }); };
    app.startQuickPhoto();
    assert.equal(clicks, 1);
    assert.equal(positioned, 1);
    assert.equal(document.getElementById("quickPhotoInput").value, "");
    // a wrong file type is refused on the hint line and opens nothing
    app.quickPhotoChosen({ name: "doc.pdf", type: "application/pdf", size: 10 });
    assert.match(document.getElementById("quickPhotoHint").textContent, /not a JPEG, PNG or WebP/);
    assert.equal(app.quickPhoto, null);
  }

  // 3. the photo with a fix: the card opens, the control reads Cancel, and
  //    send lands a flagged approximate-area entry with the photo pending
  {
    const app = fresh();
    mountElements();
    app.attachmentsEnabledCache = true;
    element("quickPhotoInput", { click() {} });
    app.requestPosition = () => Promise.resolve({ latitude: -41.3, longitude: 174.8, accuracyM: 8 });
    const views = [];
    app.map.setView = (latlng, zoom) => views.push([latlng, zoom]);
    app.startQuickPhoto();
    app.quickPhotoChosen(photo);
    assert.ok(app.quickPhoto);
    assert.equal(document.getElementById("addPlaceButton").textContent, "Cancel");
    assert.equal(document.getElementById("quickPhotoWrap").hidden, true);
    assert.equal(document.getElementById("pinCardHost").hidden, false);
    assert.match(document.getElementById("pinCardHost").innerHTML, /Quick photo/);
    assert.equal(document.body.classList.contains("entry-open"), true);
    assert.equal(document.getElementById("quickPhotoSendButton").disabled, true, "send waits for the fix");
    await tick();
    assert.equal(document.getElementById("quickPhotoSendButton").disabled, false);
    loose.deepEqual(views, [[[-41.3, 174.8], 17]]);
    assert.match(document.getElementById("quickPhotoPosition").textContent, /about 8 m/);
    assert.match(document.getElementById("quickPhotoPosition").textContent, /area of 25 m/, "the radius floor is 25 m");
    document.getElementById("quickPhotoNote").value = " Small church on the corner ";
    let sent = null;
    let recorded = null;
    app.backend.submitCurrentObservation = async (args) => { sent = args; return { task_id: "task_q1", evidence_draft_id: "draft_q1", candidate_site_id: "cand_q1", task_status: "unresolved_note", deduped: false, corrected: false }; };
    app.renderSubmissionRecordedDetail = (props, options) => { recorded = { props, options }; };
    await app.sendQuickPhoto();
    assert.ok(sent, "the observation was submitted");
    assert.equal(sent.flagForDiscussion, true);
    assert.equal(sent.countryCode, "NZ");
    assert.equal(sent.clientSubmissionId, "11111111-2222-4333-8444-555555555555");
    assert.equal(sent.candidate.name, "Small church on the corner");
    assert.equal(sent.candidate.latitude, -41.3);
    assert.equal(sent.candidate.locationAssertion.mode, "approximate_area");
    assert.equal(sent.candidate.locationAssertion.basis, "local_investigator_account");
    assert.equal(sent.candidate.locationAssertion.uncertainty_radius_m, 25);
    assert.equal(sent.candidate.locationAssertion.confidence, "moderate");
    assert.equal(sent.candidate.locationAssertion.contributor_confirmed, true);
    assert.match(sent.candidate.locationAssertion.source_wording, /accuracy about 8 m/);
    assert.equal(sent.observation.current_status, "could_not_determine");
    assert.equal(sent.observation.observation_basis, "other");
    assert.equal(sent.observation.privacy_flag, "needs_review");
    assert.equal(sent.observation.observed_on, window.PowRapidEntry.localIsoDate());
    assert.match(sent.observation.uncertainty_note, /^For discussion: Quick photo capture/);
    assert.match(sent.observation.uncertainty_note, /Note: Small church on the corner/);
    loose.deepEqual(sent.clientContext, { placement_zoom: 17, proximity_checked: true, nearby_count: 0, portal_version: "rapid-current-v1-multicountry" });
    assert.ok(recorded, "the recorded screen follows");
    assert.equal(recorded.props.task_id, "task_q1");
    assert.equal(recorded.options.nomination, true);
    assert.equal(recorded.options.hasEvidenceFiles, true);
    loose.deepEqual(recorded.options.pendingFiles, { files: [photo], caption: "Quick photo capture" });
    assert.equal(recorded.options.withdrawDraftId, "draft_q1");
    assert.equal(app.manualTasksById.get("task_q1").automated_checks[0].check_id, "quick_photo_capture");
    assert.equal(app.quickPhoto, null);
    assert.equal(document.getElementById("pinCardHost").hidden, true);
    assert.equal(document.getElementById("addPlaceButton").textContent, "Add / Revise");
    // a rough fix records a wider area, capped by the contract, with low confidence
    app.quickPhoto = { fix: { latitude: -41.3, longitude: 174.8, accuracyM: 120 } };
    assert.equal(app.quickPhotoRadius(app.quickPhoto.fix), 120);
    assert.equal(app.quickPhotoRadius({ accuracyM: 5e6 }), 100000);
    app.quickPhoto = null;
  }

  // 4. a failed send keeps the card and the same submission id for the retry
  {
    const app = fresh();
    mountElements();
    app.attachmentsEnabledCache = true;
    element("quickPhotoInput", { click() {} });
    app.requestPosition = () => Promise.resolve({ latitude: -41.3, longitude: 174.8, accuracyM: 30 });
    app.startQuickPhoto();
    app.quickPhotoChosen(photo);
    await tick();
    const ids = [];
    app.backend.submitCurrentObservation = async (args) => { ids.push(args.clientSubmissionId); throw new Error("Rapid entry is not yet enabled for NZ."); };
    await app.sendQuickPhoto();
    assert.ok(app.quickPhoto, "the card stays");
    assert.match(document.getElementById("quickPhotoStatus").textContent, /not yet enabled for NZ\. Nothing was sent/);
    assert.equal(document.getElementById("quickPhotoSendButton").disabled, false);
    await app.sendQuickPhoto();
    assert.equal(ids.length, 2);
    assert.equal(ids[0], ids[1], "a retry reuses the id so the server dedupes");
  }

  // 5. no position: send is refused, and the photo rides the pin flow,
  //    counted on the pin form's picker and carried into its pending files
  {
    const app = fresh();
    mountElements();
    app.attachmentsEnabledCache = true;
    element("quickPhotoInput", { click() {} });
    app.requestPosition = () => Promise.reject(new Error("Location access was refused."));
    app.startQuickPhoto();
    app.quickPhotoChosen(photo);
    await tick();
    assert.equal(document.getElementById("quickPhotoSendButton").disabled, true);
    assert.equal(document.getElementById("quickPhotoDropPinButton").hidden, false);
    assert.match(document.getElementById("quickPhotoPosition").textContent, /Location access was refused\. Drop the pin/);
    let sent = 0;
    app.backend.submitCurrentObservation = async () => { sent += 1; };
    await app.sendQuickPhoto();
    assert.equal(sent, 0);
    assert.match(document.getElementById("quickPhotoStatus").textContent, /position is not known/);
    let entered = 0;
    app.enterPinMode = () => { entered += 1; app.pinMode = true; };
    app.quickPhotoDropPinInstead();
    assert.equal(entered, 1);
    assert.equal(app.quickPhoto, null);
    loose.deepEqual(app.quickPhotoCarry, { files: [photo], caption: "Quick photo capture" });
    assert.match(document.getElementById("pinStatus").textContent, /Your photo attaches when you save/);
    element("pinEvidenceFiles", { files: [] });
    element("pinEvidenceFilesCaption", { value: "" });
    loose.deepEqual(app.pendingEvidenceFiles("pin"), { files: [photo], caption: "Quick photo capture" });
    // files chosen on the form keep their own caption and join the carried photo
    const other = { name: "b.png", type: "image/png", size: 5 };
    document.getElementById("pinEvidenceFiles").files = [other];
    loose.deepEqual(app.pendingEvidenceFiles("pin"), { files: [other, photo], caption: "" });
    const count = { textContent: "" };
    const input = { id: "pinEvidenceFiles", classList: classList(), files: [other], closest: () => ({ querySelector: () => count }) };
    input.classList.add("attachment-file-input");
    app.syncFilePickCount(input);
    assert.equal(count.textContent, "2 chosen");
    // leaving the pin flow drops the carry
    app.map = { off() {}, removeLayer() {}, getContainer: () => ({ classList: classList() }) };
    app.dropRapidPinFromDevice = () => {};
    app.clearFormDirty = () => {};
    app.setEntryOpen = () => {};
    app.pinMarker = null;
    app.pinUncertaintyCircle = null;
    app.exitPinMode();
    assert.equal(app.quickPhotoCarry, null);
  }

  // 6. the control's press cancels the open card after a confirmation
  {
    const app = fresh();
    mountElements();
    app.attachmentsEnabledCache = true;
    element("quickPhotoInput", { click() {} });
    app.requestPosition = () => new Promise(() => {});
    app.startQuickPhoto();
    app.quickPhotoChosen(photo);
    confirmAnswer = false;
    app.handleAddReviseClick();
    assert.ok(app.quickPhoto, "a refused confirmation keeps the card");
    confirmAnswer = true;
    app.handleAddReviseClick();
    assert.equal(app.quickPhoto, null);
    assert.equal(document.getElementById("copyStatus").textContent, "Entry discarded. Nothing was saved.");
    assert.equal(document.body.classList.contains("entry-open"), false);
    assert.equal(document.getElementById("addPlaceButton").textContent, "Add / Revise");
    assert.equal(document.getElementById("quickPhotoWrap").hidden, false);
  }

  console.log("quick-photo: ok");
})().catch(error => {
  console.error(error);
  process.exit(1);
});
