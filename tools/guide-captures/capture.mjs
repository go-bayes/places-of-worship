// tutorial media capture for the places-of-worship RA/PI guides.
// serves nothing itself: expects the repo statically on localhost:5182.
// every visible datum is demo data (St Demo Church, task_demo_*); backend
// calls are stubbed in-page or at the network layer, never live Convex.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:5182/apps/regions/nz";
const manifest = [];
const flowErrors = {};

// demo task set: backend-task shaped so the real refresh/render pipeline
// can consume it; names and ids are unmistakably demo
const demoTasks = [
  {
    task_id: "task_demo_001", name: "St Demo Church", status: "open", priority: "high",
    task_type: "temporal_check", batch_id: "nz-temporal-ra-workpack-001", country_code: "NZ",
    target_years: [2013, 2018, 2023], address: "1 Example Terrace", locality: "Demoville",
    geometry: { type: "Point", coordinates: [174.768, -41.282] },
    automated_checks: [], task_brief: "Demo task: check whether this place of worship was active at the target years.",
    last_event_at: Date.now() - 3 * 864e5,
  },
  {
    task_id: "task_demo_002", name: "Demo Chapel of Karori", status: "in_progress", priority: "medium",
    task_type: "temporal_check", batch_id: "nz-temporal-ra-workpack-001", country_code: "NZ",
    target_years: [2013, 2018, 2023], address: "22 Sample Road", locality: "Demoville",
    geometry: { type: "Point", coordinates: [174.74, -41.285] },
    automated_checks: [], task_brief: "Demo task: confirm the chapel against an independent source.",
    last_event_at: Date.now() - 2 * 36e5,
  },
  {
    task_id: "task_demo_003", name: "Sample Street Mission", status: "needs_review", priority: "high",
    task_type: "temporal_check", batch_id: "nz-temporal-ra-workpack-001", country_code: "NZ",
    target_years: [2013, 2018, 2023], address: "3 Placeholder Lane", locality: "Demoville",
    geometry: { type: "Point", coordinates: [174.777, -41.292] },
    automated_checks: [], task_brief: "Demo task already submitted for review.",
    last_event_at: Date.now() - 864e5,
  },
  {
    task_id: "task_demo_004", name: "Example Bay Parish", status: "reviewed", priority: "low",
    task_type: "temporal_check", batch_id: "nz-temporal-ra-workpack-001", country_code: "NZ",
    target_years: [2013, 2018, 2023], address: "40 Mock Esplanade", locality: "Demoville",
    geometry: { type: "Point", coordinates: [174.78, -41.3] },
    automated_checks: [], task_brief: "Demo task that has passed review.",
    last_event_at: Date.now() - 6 * 864e5,
  },
  {
    task_id: "task_demo_005", name: "Placeholder Union Church", status: "draft_saved", priority: "medium",
    task_type: "temporal_check", batch_id: "nz-temporal-ra-workpack-001", country_code: "NZ",
    target_years: [2013, 2018, 2023], address: "5 Fictional Quay", locality: "Demoville",
    geometry: { type: "Point", coordinates: [174.755, -41.306] },
    automated_checks: [], task_brief: "Demo task with a draft in progress.",
    last_event_at: Date.now() - 45 * 6e4,
  },
];

// in-page bootstrap: signed-in demo state through the app's own renderers
function verificationStub(data) {
  const app = window.nzVerificationMap;
  const featureFrom = (t) => ({
    properties: {
      task_id: t.task_id, name: t.name, verification_priority: t.priority,
      automated_suggested_action: "needs_human_review", automated_checks: [],
      automated_check_count: 0,
      search_queries: {}, religion: "christian", denomination: "",
      master_site_id: t.task_id, address: t.address || "", batch_id: t.batch_id,
    },
    geometry: t.geometry,
  });
  app.backendUser = { _id: "user_demo_ra", initials: "RA", email: "ra.demo@example.org" };
  app.backendTasksById = new Map(data.tasks.map((t) => [t.task_id, t]));
  app.myWorkItems = data.myWork || [];
  app.backend = {
    configured: true, signedIn: true,
    renderSignInButton: async () => {},
    listTasks: async () => data.tasks,
    listMyTasks: async () => data.myWork || [],
    listTaskEvidence: async () => [],
    listTaskOccupancies: async () => [],
    getTaskHistory: async () => window.__historyStub || { events: [], draft_count: 0, latest_review: null },
    saveEvidenceDraft: async () => ({ evidence_draft_id: "draft_demo_001" }),
    // a submitted demo task leaves the available queue, as it does live
    submitEvidenceDraft: async () => {
      const t = data.tasks.find((x) => x.task_id === (app.selectedTask?.properties?.task_id));
      if (t) t.status = "needs_review";
      return {};
    },
    submitEvidenceDraftWithOccupancies: async (args) => {
      const t = data.tasks.find((x) => x.task_id === (app.selectedTask?.properties?.task_id));
      if (t) t.status = "needs_review";
      return {
        occupancy_ids: args.segments.map((_, index) => `occupancy_demo_${index}`),
        derived_years: [2013, 2018, 2023],
        conflict_years: [],
        period_count: args.segments.length,
        deduped: false,
      };
    },
    submitOccupancies: async (args) => ({
      occupancy_ids: args.segments.map((_, index) => `occupancy_demo_${index}`),
      derived_years: [2013, 2018, 2023],
      conflict_years: [],
      deduped: false,
    }),
    submitUnresolvedNote: async () => ({}),
    skipTask: async () => {
      const t = data.tasks.find((x) => x.task_id === (app.selectedTask?.properties?.task_id));
      if (t) t.status = "skipped";
      return {};
    },
    unskipTask: async (a) => {
      const t = data.tasks.find((x) => x.task_id === a.taskId);
      if (t) t.status = "in_progress";
      return { task_id: a.taskId, status: "in_progress" };
    },
    createIssueTask: async () => window.__issueResult
      || { task_id: "task_demo_issue_001", batch_id: "ra-issues-nz", status: "open", deduped: false },
    createManualCandidateTask: async () => ({ task_id: "task_demo_pin_001", candidate_site_id: "candidate:task_demo_pin_001", status: "in_progress" }),
    // nominations and revisions now submit through the rapid current-observation call
    submitCurrentObservation: async () => ({
      task_id: "task_demo_pin_001", evidence_draft_id: "draft_demo_pin_001", status: "in_progress", deduped: false, corrected: false,
    }),
    reviseEvidenceDraft: async () => ({ evidence_draft_id: "draft_demo_revision_001" }),
    signOut: () => {},
  };
  app.tasks = data.tasks.map(featureFrom);
  data.tasks.forEach((t) => app.latestDraftsByTaskId.set(t.task_id, null));
  // keep the header truthful for the stubbed signed-in state
  const snapshotEl = document.getElementById("snapshotId");
  if (snapshotEl) snapshotEl.textContent = `nz-temporal-ra-workpack-001 | ${data.tasks.length} available of ${data.tasks.length}`;
  // collapse the long quickstart so the task list is visible in captures
  document.querySelector("details.quickstart")?.removeAttribute("open");
  app.renderBackendPanel();
  if (typeof app.renderSessionPanel === "function") app.renderSessionPanel();
  // the portal now opens on an activity chooser (jb 2026-08-31); the
  // assigned-task list renders only once that mode is chosen
  if (typeof app.setPortalMode === "function") {
    try { app.setPortalMode("assigned"); } catch (error) { /* older portal */ }
  }
  app.applyFilters();
}

// google sign-in cannot run on a localhost capture origin; a benign stub
// keeps the console clean without faking a signed-in google session
async function stubGoogleSignIn(page) {
  await page.route("https://accounts.google.com/gsi/client*", (route) => {
    route.fulfill({
      contentType: "application/javascript",
      body: "window.google = { accounts: { id: { initialize() {}, renderButton(el) { el.textContent = 'Sign in with Google (demo)'; }, prompt() {} } } };",
    });
  });
}

async function openVerificationPage(page, { country = "", myWork = [] } = {}) {
  await stubGoogleSignIn(page);
  const url = `${BASE}/verification.html?cachebust=cap${Date.now()}${country ? `&country=${country}` : ""}`;
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(verificationStub, { tasks: JSON.parse(JSON.stringify(demoTasks)), myWork });
  await page.waitForTimeout(400);
}

async function fillEvidenceBasics(page) {
  await page.selectOption("#raActionSelect", "confirm_current_record");
  await page.fill("#sourceTitleInput", "Demo denominational directory 2024");
  await page.fill("#sourceDateInput", "2024-05");
  await page.fill("#sourceUrlInput", "https://example.org/demo-directory");
  await page.fill("#decisionNote", "Demo note: the 2024 directory lists this church as active at this address.");
}

const flows = [
  {
    id: "orientation", title: "Orientation: the verification workspace", audience: "ra",
    run: async (page, step) => {
      await openVerificationPage(page);
      await page.locator("#taskList").scrollIntoViewIfNeeded();
      await step("The workspace: assigned tasks on the left, the task map on the right.");
      await page.fill("#searchInput", "demo");
      // the priority/action/status filters now fold into "More filters";
      // open it and scroll to the top so the caption still matches the frame
      await page.locator(".more-filters > summary").click();
      await page.evaluate(() => { const sb = document.querySelector(".sidebar"); if (sb) sb.scrollTop = 0; });
      await page.waitForTimeout(400);
      await step("Filter the task list by name, priority, map suggestion, or status.");
      await page.fill("#searchInput", "");
      await page.locator(".more-filters > summary").click();
      await page.selectOption("#portalPointsSelect", "all");
      await page.waitForTimeout(1200);
      await step("The Points control adds muted context dots; the legend explains marker states.");
      await page.evaluate(() => {
        const app = window.nzVerificationMap;
        app.map.setView([-41.29, 174.77], 12, { animate: false });
        const marker = app.markersByTaskId.get("task_demo_003");
        marker.openTooltip();
        const p = app.map.latLngToContainerPoint(marker.getLatLng());
        window.__tipPoint = { x: p.x, y: p.y };
      });
      const tip = await page.evaluate(() => window.__tipPoint);
      const mapBox = await page.locator("#map").boundingBox();
      await page.mouse.move(mapBox.x + tip.x, mapBox.y + tip.y);
      await page.waitForTimeout(500);
      await step("Hovering a marker shows the task name, status, and last activity.");
    },
  },
  {
    id: "open-and-verify", title: "Open a task and record evidence", audience: "ra",
    run: async (page, step) => {
      await openVerificationPage(page);
      await page.click('.task-row[data-task-id="task_demo_001"]');
      await page.waitForTimeout(500);
      await step("Open a task from the list; the detail panel shows the brief and source links.");
      await page.locator("#raActionSelect").scrollIntoViewIfNeeded();
      await page.selectOption("#raActionSelect", "confirm_current_record");
      // pr-e: the periods are the temporal entry; the still-in-use card is
      // anchored to the source date, so that is filled first
      await page.fill("#sourceDateInput", "2024-05");
      await page.locator("#guidedPeriodsCards").scrollIntoViewIfNeeded();
      const card = page.locator('#guidedPeriodsCards .occupancy-card[data-index="0"]');
      await card.locator('[data-field="startMode"]').selectOption("known");
      await card.locator('[data-field="startDate"]').fill("1905");
      await card.locator('[data-field="startBasis"]').selectOption("founding_stated");
      await card.locator('[data-field="endMode"]').selectOption("still_active");
      await card.locator('[data-field="stillActiveAsof"]').fill("2024-05");
      await page.waitForTimeout(300);
      await step("Choose what your evidence shows, then record when the place was used for worship; the strip under the cards states the census-year states the portal will propose.");
      await page.locator("#sourceTitleInput").scrollIntoViewIfNeeded();
      await fillEvidenceBasics(page);
      await step("Record the source title, date, URL, and a short evidence note.");
      await page.locator("#changeClassSelect").scrollIntoViewIfNeeded();
      await page.selectOption("#changeClassSelect", "genuine_change");
      await step("Answer the change-class question: genuine change is counted by the annual census; map corrections rewrite history.");
    },
  },
  {
    id: "submit-flow", title: "Save a draft, submit, and open the next task", audience: "ra",
    run: async (page, step) => {
      await openVerificationPage(page);
      await page.click('.task-row[data-task-id="task_demo_001"]');
      await page.waitForTimeout(400);
      await fillEvidenceBasics(page);
      const card = page.locator('#guidedPeriodsCards .occupancy-card[data-index="0"]');
      await card.locator('[data-field="startMode"]').selectOption("known");
      await card.locator('[data-field="startDate"]').fill("1905");
      await card.locator('[data-field="startBasis"]').selectOption("founding_stated");
      await card.locator('[data-field="endMode"]').selectOption("still_active");
      // the function chain needs the tradition at the start before a submission is accepted
      await page.locator('.chain-start [data-chain-field="label"]').first().fill("Presbyterian");
      await page.locator("#saveDraftButton").scrollIntoViewIfNeeded();
      await page.click("#saveDraftButton");
      await page.waitForTimeout(600);
      await step("Save draft keeps the task open while you work; the status line confirms the save.");
      await page.click("#submitReviewButton");
      await page.waitForTimeout(700);
      await step("Submit for review closes the task and confirms it in the panel.");
      await page.click("#openNextTaskButton");
      await page.waitForTimeout(700);
      await step("Open next task lands you in the next available task in your filtered list.");
    },
  },
  {
    id: "skip-and-undo", title: "Skip a task with a reason, then undo", audience: "ra",
    run: async (page, step) => {
      await openVerificationPage(page);
      await page.click('.task-row[data-task-id="task_demo_001"]');
      await page.waitForTimeout(400);
      const skipForm = page.locator("details.skip-form:has(#skipTaskButton)");
      await skipForm.locator("summary").click();
      await skipForm.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await step("The skip control sits under the evidence form for tasks with nothing to record.");
      await page.click('button.skip-chip:has-text("Needs local knowledge")');
      await page.waitForTimeout(300);
      await step("Reason chips fill the skip reason with one click; free text still works.");
      await page.click("#skipTaskButton");
      await page.waitForTimeout(700);
      await step("Skipping confirms in the panel; Undo skip is right there if you change your mind.");
      await page.click("#undoSkipButton");
      await page.waitForTimeout(700);
      await step("Undo skip reopens the task and returns you to its detail panel.");
    },
  },
  {
    id: "report-issue", title: "Report a map issue from a task", audience: "ra",
    run: async (page, step) => {
      await openVerificationPage(page);
      await page.click('.task-row[data-task-id="task_demo_002"]');
      await page.waitForTimeout(400);
      await page.locator("#issueReportDetails summary").click();
      await page.locator("#issueReportDetails").scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await step("Report an issue opens a small form under the evidence form.");
      await page.selectOption("#issueTypeSelect", "possible_duplicate");
      await page.fill("#issueNoteInput", "Demo note: this dot and the chapel one street over look like the same congregation.");
      await step("Choose the issue type and describe what you noticed.");
      await page.click("#issueSubmitButton");
      await page.waitForTimeout(600);
      await step("A new issue is filed as an open task for curator triage.");
      await page.evaluate(() => { window.__issueResult = { task_id: "task_demo_issue_001", status: "open", deduped: true }; });
      await page.fill("#issueNoteInput", "Demo note: adding a second observation about the same pair of dots.");
      await page.click("#issueSubmitButton");
      await page.waitForTimeout(600);
      await step("If an open issue already exists for the place, your note is added to it instead.");
    },
  },
  {
    id: "pin-drop", title: "Nominate a missing place with a pin drop (Vanuatu)", audience: "ra",
    run: async (page, step) => {
      await openVerificationPage(page, { country: "vu" });
      // one nearby demo task so the proximity offer has something to show
      await page.evaluate(() => {
        const app = window.nzVerificationMap;
        const near = {
          properties: {
            task_id: "task_demo_vu_001", name: "St Demo Church (Port Vila)", verification_priority: "high",
            automated_suggested_action: "needs_human_review", automated_checks: [], automated_check_count: 0,
            search_queries: {}, religion: "christian", master_site_id: "task_demo_vu_001",
          },
          geometry: { type: "Point", coordinates: [168.3155, -17.7412] },
        };
        app.tasks = [near];
        app.filteredTasks = [near];
        app.backendTasksById.set("task_demo_vu_001", { task_id: "task_demo_vu_001", status: "open" });
        app.latestDraftsByTaskId.set("task_demo_vu_001", null);
        app.applyFilters();
      });
      await page.waitForTimeout(300);
      await page.click("#changeActivityButton");
      await page.waitForTimeout(400);
      await step("Change activity opens the chooser; Add or revise places starts a nomination.");
      await page.click("#chooseAddButton");
      await page.waitForTimeout(400);
      await page.click("#addPlaceButton");
      await page.evaluate(() => {
        const app = window.nzVerificationMap;
        app.map.setView([-17.7404, 168.3155], 13, { animate: false });
        app.map.fire("click", { latlng: L.latLng(-17.7404, 168.3155) });
      });
      await page.waitForTimeout(600);
      await step("Click the map to drop a draggable pin; the confirm card tracks its position.");
      await page.evaluate(() => {
        const app = window.nzVerificationMap;
        app.pinMarker.setLatLng([-17.74065, 168.31562]);
        app.pinMarker.fire("drag");
      });
      await page.waitForTimeout(400);
      await step("Below zoom 15 the confirm button stays disabled: placement must be building-accurate.");
      // the confirm gate also needs the pin in view, so centre on it as a user would
      await page.evaluate(() => {
        const app = window.nzVerificationMap;
        app.map.setView(app.pinMarker.getLatLng(), 16, { animate: false });
        app.map.fire("moveend");
        app.map.fire("zoomend");
      });
      await page.waitForTimeout(900);
      await step("Zoom in to pass the gate, then confirm the location.");
      await page.click("#pinConfirmButton");
      await page.waitForTimeout(500);
      await step("Existing tasks near the pin are offered first, with their distance and status.");
      await page.click("#pinProximityContinue");
      await page.waitForTimeout(400);
      await page.fill("#pinNameInput", "Demo Coastal Chapel");
      // the nomination form is the rapid current-observation form: choose what the observation shows
      await page.click('input[name="pinCurrentStatus"][value="currently_used_for_worship"]');
      await page.waitForTimeout(300);
      const sourceNote = page.locator("#pinSourceNoteInput");
      if (await sourceNote.isVisible()) await sourceNote.fill("Demo note: I attend services here; the building is one street from the market.");
      const changeClass = page.locator("#pinChangeClassSelect");
      if (await changeClass.isVisible()) await changeClass.selectOption("genuine_change");
      const quickOsm = page.locator("#pinQuickFillOsm");
      if (await quickOsm.isVisible()) await quickOsm.click();
      const rapidSubmit = page.locator('#pinRapidCurrentForm button[type="submit"]').first();
      await page.locator("#pinCurrentStatusGroup").scrollIntoViewIfNeeded();
      await step("Say what you can confirm at the observation date, and cite the map or Street View with one click.");
      await rapidSubmit.scrollIntoViewIfNeeded();
      await rapidSubmit.click();
      await page.waitForTimeout(900);
      await step("Save sends the nomination to review and offers the next steps: known history, where and when, another place.");
    },
  },
  {
    id: "revise-after-changes", title: "Respond to a changes-requested review", audience: "ra",
    run: async (page, step) => {
      const changesTask = {
        task_id: "task_demo_006", name: "Demo Harbour Congregation", status: "changes_requested", priority: "high",
        task_type: "temporal_check", batch_id: "nz-temporal-ra-workpack-001", country_code: "NZ",
        target_years: [2013, 2018, 2023], address: "6 Invented Parade", locality: "Demoville",
        geometry: { type: "Point", coordinates: [174.79, -41.288] },
        automated_checks: [], task_brief: "Demo task returned by the reviewer for more evidence.",
        last_event_at: Date.now() - 36e5,
      };
      const myWork = [{
        task: changesTask,
        latestDraft: { draft_status: "submitted", action: "confirm_current_record", source_title: "Demo directory 2024" },
        latestReview: {
          decision_status: "needs_more_evidence",
          decision_note: "Demo reviewer note: the directory entry is ambiguous between two branches.",
          required_follow_up: "Add a second source that names the street address.",
        },
      }];
      await stubGoogleSignIn(page);
      await page.goto(`${BASE}/verification.html?cachebust=cap${Date.now()}`, { waitUntil: "networkidle" });
      await page.evaluate(verificationStub, { tasks: [...JSON.parse(JSON.stringify(demoTasks)), changesTask], myWork });
      await page.waitForTimeout(500);
      await page.locator(".changes-panel").scrollIntoViewIfNeeded();
      await step("Changes requested pins the reviewer's note and required follow-up above My work.");
      await page.click(".revise-now");
      await page.waitForTimeout(900);
      await step("Revise now opens an editable revision of your submission with the task detail loaded.");
    },
  },
  {
    id: "history-and-provenance", title: "Task history and hover provenance", audience: "ra",
    run: async (page, step) => {
      await openVerificationPage(page);
      await page.evaluate(() => {
        const now = Date.now();
        window.__historyStub = {
          events: [
            { event_type: "review_decided", occurred_at: now - 864e5, new_status: "changes_requested", actor_role: "reviewer", is_self: false },
            { event_type: "submitted_for_review", occurred_at: now - 3 * 864e5, previous_status: "in_progress", new_status: "needs_review", actor_role: "ra", is_self: true },
            { event_type: "draft_saved", occurred_at: now - 4 * 864e5, actor_role: "ra", is_self: true },
            { event_type: "opened", occurred_at: now - 9 * 864e5, new_status: "open", actor_role: "service", is_self: false },
          ],
          draft_count: 2,
          latest_review: { decision_status: "needs_more_evidence", created_at: now - 864e5 },
        };
      });
      await page.click('.task-row[data-task-id="task_demo_002"]');
      await page.waitForTimeout(400);
      await page.locator("#taskHistoryDetails summary").click();
      await page.locator("#taskHistoryDetails").scrollIntoViewIfNeeded();
      await page.waitForTimeout(600);
      await step("History shows the task's full event trail; your own actions are marked (you).");
      await page.evaluate(() => {
        const app = window.nzVerificationMap;
        app.map.setView([-41.29, 174.77], 12, { animate: false });
        const marker = app.markersByTaskId.get("task_demo_004");
        marker.openTooltip();
        const p = app.map.latLngToContainerPoint(marker.getLatLng());
        window.__tipPoint = { x: p.x, y: p.y };
      });
      const tip = await page.evaluate(() => window.__tipPoint);
      const mapBox = await page.locator("#map").boundingBox();
      await page.mouse.move(mapBox.x + tip.x, mapBox.y + tip.y);
      await page.waitForTimeout(500);
      await step("Hover any marker for the same provenance at a glance: name, status, last activity.");
    },
  },
];

// PI flows: the review portal client is closure-captured, so stub it at the
// network layer by fulfilling convex-task-client.js with a demo class
const demoQueueRows = [
  {
    task: {
      task_id: "task_demo_003", name: "Sample Street Mission", status: "needs_review", priority: "high",
      task_type: "temporal_check", batch_id: "nz-temporal-ra-workpack-001",
      address: "3 Placeholder Lane", locality: "Demoville",
      geometry: { type: "Point", coordinates: [174.777, -41.292] },
      task_brief: "Demo task: RA submitted evidence for review.",
      target_years: [2013, 2018, 2023],
    },
    latestDraft: {
      draft_status: "submitted", action: "confirm_current_record",
      source_type: "denominational_directory", source_title: "Demo denominational directory 2024",
      provider: "Demo Provider", source_url_or_file: "https://example.org/demo-directory",
      source_date_or_capture_date: "2024-05", evidence_note: "Demo note: the directory lists the mission as active.",
      existence_status: "active", worship_use_status: "active_worship",
      assessment_confidence: "0.9", match_confidence: "high", geocoding_confidence: "high",
      target_year_statuses: { 2013: "present", 2018: "present", 2023: "present" },
      target_year_evidence: { 2013: "Demo evidence", 2018: "Demo evidence", 2023: "Demo evidence" },
      licence_flag: "needs_review", privacy_flag: "clear",
      generated_wide_row: { fields: ["demo_field"], row: { demo_field: "demo" }, tsv: "demo" },
    },
    latestReview: null,
    latestAgentReview: null,
  },
];
const demoAgentReview = {
  agent_review_id: "task_demo_003:agent-review:1751900000000:1",
  agent_name: "codex-batch-reviewer",
  recommendation: "revise",
  reasoning: "Demo reasoning: the directory supports existence, but no source yet ties the 2013 status to this address.",
  sources_checked: [
    { check: "existence", method: "http_fetch", outcome: "supported", note: "Demo: the directory page names the mission.", url_or_file: "https://example.org/demo-directory" },
    { check: "date_support", method: "http_fetch", outcome: "unclear", note: "Demo: no dated mention before 2018." },
    { check: "address_match", method: "not_attempted", outcome: "not_checked", note: "Demo: source has no street address to check." },
  ],
  cultural_sensitivity: { flagged: false },
  model_provider: "openai",
  model_name: "demo-model",
  prompt_version: "claude-batch-review-v1",
  version: 1,
  created_at: 1787610600000,
};
const demoEvents = [
  { event_type: "submitted_for_review", occurred_at: Date.now() - 864e5, actor_role: "ra", new_status: "needs_review" },
  { event_type: "draft_saved", occurred_at: Date.now() - 2 * 864e5, actor_role: "ra" },
  { event_type: "opened", occurred_at: Date.now() - 5 * 864e5, actor_role: "service", new_status: "open" },
];

function reviewClientBody(rows) {
  return `(function () {
    const queueRows = ${JSON.stringify(rows)};
    const drafts = ${JSON.stringify([demoQueueRows[0].latestDraft])};
    const events = ${JSON.stringify(demoEvents)};
    const demoUser = { display_name: "Demo Reviewer", email: "reviewer.demo@example.org", initials: "DR", roles: ["reviewer"] };
    class PowConvexTaskClient {
      constructor() {}
      get configured() { return true; }
      get signedIn() { return true; }
      async renderSignInButton(el, opts) { setTimeout(() => opts.onSignedIn(demoUser), 400); }
      async listReviewQueue() { return queueRows; }
      async listTaskEvidence() { return drafts; }
      async getTaskEvents() { return events; }
      async recordReviewDecision() { return { task_status: "reviewed" }; }
      signOut() {}
    }
    window.PowConvexTaskClient = PowConvexTaskClient;
  })();`;
}

async function openReviewPage(page, rows) {
  await stubGoogleSignIn(page);
  await page.route("**/convex-task-client.js*", (route) => {
    route.fulfill({ contentType: "application/javascript", body: reviewClientBody(rows) });
  });
  await page.goto(`${BASE}/review.html?cachebust=cap${Date.now()}`, { waitUntil: "networkidle" });
  await page.waitForSelector(".task-button", { timeout: 8000 });
  await page.waitForTimeout(400);
}

flows.push(
  {
    id: "review-queue", title: "Review a submitted task and record a decision", audience: "pi",
    run: async (page, step) => {
      await openReviewPage(page, demoQueueRows);
      await step("The review queue lists submitted tasks with their status pills.");
      await page.click('.task-button[data-task-id="task_demo_003"]');
      await page.waitForTimeout(700);
      await step("Selecting a task loads the evidence, lifecycle fields, and task history.");
      await page.locator("#reviewDecisionForm").scrollIntoViewIfNeeded();
      await page.selectOption("#decisionStatus", "accepted_for_export");
      await page.fill("#decisionNote", "Demo decision note: the directory evidence supports the record.");
      await step("Choose a decision and write the decision note; the record stays yours.");
      await page.click('#reviewDecisionForm button[type="submit"]');
      await page.waitForTimeout(800);
      await step("Recording the decision returns you to the queue for the next task.");
    },
  },
  {
    id: "ai-review-panel", title: "Read the AI review panel before deciding", audience: "pi",
    run: async (page, step) => {
      const rows = JSON.parse(JSON.stringify(demoQueueRows));
      rows[0].latestAgentReview = demoAgentReview;
      await openReviewPage(page, rows);
      // The live decision panel is sticky for reviewer ergonomics. Keep it in
      // normal flow for guide captures so it cannot obscure the AI execution
      // details or source checks that the screenshots are meant to explain.
      await page.addStyleTag({
        content: ".decision-panel { position: static !important; max-height: none !important; overflow: visible !important; }",
      });
      await page.click('.task-button[data-task-id="task_demo_003"]');
      await page.waitForTimeout(700);
      await page.locator("#agentReviewPanel").scrollIntoViewIfNeeded();
      await step("The AI recommendation is labelled AI-generated, identifies its agent, provider, and model, and never decides for you.");
      await page.locator("#agentReviewPanel details").first().locator("summary").click();
      await page.waitForTimeout(400);
      await step("Reasoning explains the recommendation in plain language.");
      await page.locator("#agentReviewPanel details").nth(1).locator("summary").click();
      await page.locator("#agentReviewPanel details").nth(1).scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      await step("Source checks record every outcome, including what could not be checked.");
      await page.click("#useAgentRecommendation");
      await page.waitForTimeout(500);
      await page.locator("#reviewDecisionForm").scrollIntoViewIfNeeded();
      await step("Use recommendation prefills the decision; Decide differently records disagreement — the note and Record button stay yours.");
    },
  },
);

async function runFlow(browser, flow) {
  const flowDir = path.join(OUT, flow.id);
  fs.rmSync(flowDir, { recursive: true, force: true });
  fs.mkdirSync(flowDir, { recursive: true });
  // videos have been scrapped from the guides; capture stills only. the
  // two-pane portal layout fills the 1280px frame, so the old left-1280 crop
  // step is no longer needed — each screenshot is used as-is.
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
    locale: "en-NZ",
    timezoneId: "Pacific/Auckland",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  const steps = [];
  let n = 0;
  const step = async (caption, pauseMs = 700) => {
    await page.waitForTimeout(pauseMs);
    n += 1;
    const file = `${flow.id}-${String(n).padStart(2, "0")}.png`;
    await page.screenshot({ path: path.join(flowDir, file) });
    steps.push({ file: `${flow.id}/${file}`, caption });
  };
  let failure = "";
  try {
    await flow.run(page, step);
  } catch (error) {
    failure = String(error).split("\n")[0];
    // a failure still leaves a frame behind so the broken step can be seen
    try { await page.screenshot({ path: path.join(flowDir, `${flow.id}-FAIL.png`) }); } catch {}
  }
  await context.close();
  manifest.push({ flow_id: flow.id, title: flow.title, audience: flow.audience, steps });
  flowErrors[flow.id] = { consoleErrors: errors, failure };
  console.log(`${flow.id}: ${steps.length} steps${failure ? ` FAILED: ${failure}` : ""}${errors.length ? ` consoleErrors: ${JSON.stringify(errors.slice(0, 3))}` : " console clean"}`);
}

const only = process.argv[2];
const browser = await chromium.launch();
for (const flow of flows) {
  if (only && flow.id !== only) continue;
  await runFlow(browser, flow);
}
await browser.close();
if (!only) {
  fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
}
fs.writeFileSync(path.join(OUT, "_run-report.json"), JSON.stringify(flowErrors, null, 2));
console.log("done");
