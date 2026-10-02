import assert from "node:assert/strict";
import fs from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier))
      for (const ext of [".js", ".ts"]) {
        const candidate = new URL(`${specifier}${ext}`, context.parentURL);
        if (fs.existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
      }
    return nextResolve(specifier, context);
  },
});
const api = await import("./submissionReceipts.ts");
const oldEvidence = await import("./evidence.ts");
const oldRapid = await import("./rapidEntry.ts");
const oldPeriods = await import("./occupancies.ts");
const oldHistory = await import("./historicalClaims.ts");
const model = await import("./model.ts");
const { requestDigest, REQUEST_CONTRACT } = await import("./lib/submissionRequest.ts");
const { intakeRateLimiter } = await import("./lib/rateLimits.ts");
const submissionId = (n) => `11111111-1111-4111-8111-${String(n).padStart(12, "0")}`;
intakeRateLimiter.limit = async (ctx, name, options) => {
  ctx.charges.push({ name, key: options?.key });
  return { ok: true, retryAfter: 0 };
};
// one in-memory database for every mutation and query under test: withIndex
// eq chains on any field, insertion-ordered reads with order("asc"|"desc"),
// and the insert/get/patch semantics the handlers rely on
function world() {
  const rows = {
    client_submission_receipts: [],
    users: [],
    tasks: [],
    task_events: [],
    evidence_drafts: [],
    evidence_versions: [],
    evidence_submission_receipts: [],
    evidence_head_changes: [],
    site_occupancies: [],
    historical_claims: [],
    derived_target_year_states: [],
    derived_year_locations: [],
    derived_target_year_functions: [],
    derived_state_events: [],
    review_decisions: [],
    agent_reviews: [],
    sources: [],
    task_batches: [],
    task_acceptances: [],
    export_batches: [],
    review_snapshots: [],
  };
  const counters = {};
  let creationTime = 1_780_000_000_000;
  let subject = null;

  const find = (id) => {
    for (const table of Object.values(rows)) {
      const row = table.find((candidate) => candidate._id === id);
      if (row !== undefined) return row;
    }
    return null;
  };

  const db = {
    query(table) {
      if (rows[table] === undefined) throw new Error(`No fake table for ${table}.`);
      const filters = [];
      let descending = false;
      const q = {
        eq(field, value) {
          filters.push([field, value]);
          return q;
        },
      };
      const selected = () => {
        const matched = rows[table].filter((row) =>
          filters.every(([field, value]) => row[field] === value),
        );
        return descending ? [...matched].reverse() : matched;
      };
      const chain = {
        withIndex(_name, select) {
          if (select) select(q);
          return chain;
        },
        order(direction) {
          descending = direction === "desc";
          return chain;
        },
        async unique() {
          const matched = selected();
          if (matched.length > 1)
            throw new Error(`unique() matched ${matched.length} rows in ${table}.`);
          return matched[0] ?? null;
        },
        async first() {
          return selected()[0] ?? null;
        },
        async take(count) {
          return selected().slice(0, count);
        },
        async collect() {
          return selected();
        },
        // Convex streams a query one document per call (the export read
        // meter iterates this way)
        [Symbol.asyncIterator]() {
          const matched = selected();
          let index = 0;
          return {
            async next() {
              return index < matched.length
                ? { done: false, value: matched[index++] }
                : { done: true, value: undefined };
            },
            async return(value) {
              index = matched.length;
              return { done: true, value };
            },
          };
        },
      };
      return chain;
    },
    async insert(table, value) {
      if (rows[table] === undefined) throw new Error(`No fake table for ${table}.`);
      counters[table] = (counters[table] ?? 0) + 1;
      creationTime += 1;
      const stored = { _id: `${table}_${counters[table]}`, _creationTime: creationTime };
      for (const [key, member] of Object.entries(value)) {
        if (member !== undefined) stored[key] = member;
      }
      rows[table].push(stored);
      return stored._id;
    },
    async get(id) {
      return find(id);
    },
    async patch(id, value) {
      const row = find(id);
      if (row === null) throw new Error(`Patch of a missing row ${id}.`);
      // Convex removes a field patched with undefined
      for (const [key, member] of Object.entries(value)) {
        if (member === undefined) delete row[key];
        else row[key] = member;
      }
    },
  };

  const ctx = {
    auth: {
      async getUserIdentity() {
        return subject === null ? null : { tokenIdentifier: subject };
      },
    },
    db,
    charges: [],
  };

  const helper = {
    ctx,
    db,
    rows,
    as(user) {
      subject = user.auth_subject;
      return ctx;
    },
    row(table, field, value) {
      return rows[table].find((candidate) => candidate[field] === value) ?? null;
    },
    events(type) {
      return rows.task_events.filter((event) => event.event_type === type);
    },
    async addUser(authSubject, roles, status = "active") {
      const id = await db.insert("users", {
        auth_subject: authSubject,
        status,
        roles,
        display_name: authSubject,
      });
      return find(id);
    },
    async addTask(record) {
      const now = Date.now();
      const id = await db.insert("tasks", {
        batch_id: "test-batch",
        country_code: "NZ",
        task_type: "verify_existing_site",
        priority: "medium",
        status: "in_progress",
        target_years: [2013, 2018, 2023],
        geometry: { type: "Point", coordinates: [174.768, -41.282] },
        nearby_site_refs: [],
        automated_checks: [],
        name: "Test place of worship",
        task_brief: "Synthetic verification task.",
        created_at: now,
        updated_at: now,
        last_event_at: now,
        ...record,
      });
      return find(id);
    },
    async addDraft(record) {
      const now = Date.now();
      const id = await db.insert("evidence_drafts", {
        draft_status: "draft",
        created_at: now,
        updated_at: now,
        ...draftContent(),
        ...record,
      });
      return find(id);
    },
  };
  return helper;
}

// an invented guided evidence record; no real place or person
function draftContent(overrides = {}) {
  return {
    observation_contract_version: "guided_observation_v1",
    source_type: "denominational_directory",
    source_title: "Diocesan directory 2016",
    source_url_or_file: "https://example.org/directory/2016",
    source_date_or_capture_date: "2016-07",
    action: "confirm_current_record",
    evidence_note: "The directory records this place as active in July 2016.",
    privacy_flag: "clear",
    licence_flag: "needs_review",
    ...overrides,
  };
}

// the ordinary starting point: an RA with an editable guided draft on an
// unassigned task, plus the other actors the review-side tests need
async function scene({ country = "NZ", taskStatus = "in_progress", draft = {}, task = {} } = {}) {
  const w = world();
  const ra = await w.addUser("ra-subject", ["ra"]);
  const otherRa = await w.addUser("other-ra-subject", ["ra"]);
  const reviewer = await w.addUser("reviewer-subject", ["reviewer"]);
  const admin = await w.addUser("admin-subject", ["admin"]);
  const taskRow = await w.addTask({
    task_id: "task_1",
    country_code: country,
    status: taskStatus,
    ...task,
  });
  const draftRow = await w.addDraft({
    evidence_draft_id: "task_1:draft_a",
    task_id: "task_1",
    created_by: ra._id,
    ...draft,
  });
  return { ...w, ra, otherRa, reviewer, admin, task: taskRow, draft: draftRow };
}

// transaction simulation verifies handler boundaries; OCC and component
// accounting are separately exercised on the isolated local backend
async function invoke(w, fn, args, user = w.ra) {
  const before = structuredClone(w.rows),
    charges = [...w.ctx.charges];
  try {
    return await fn._handler(w.as(user), structuredClone(args));
  } catch (error) {
    for (const [table, rows] of Object.entries(before))
      w.rows[table].splice(0, w.rows[table].length, ...rows);
    w.ctx.charges.splice(0, w.ctx.charges.length, ...charges);
    throw error;
  }
}
function counts(w) {
  return Object.fromEntries(Object.entries(w.rows).map(([key, rows]) => [key, rows.length]));
}
const observation = (overrides = {}) => ({
  current_status: "currently_used_for_worship",
  observation_basis: "local_investigator_account",
  observed_on: "2026-09-20",
  direct_observation: "Synthetic site seen hosting worship.",
  privacy_flag: "clear",
  ...overrides,
});
const candidate = (overrides = {}) => ({
  name: "Synthetic worship place",
  address: "Example street",
  locality: "Example town",
  latitude: -17.74,
  longitude: 168.31,
  ...overrides,
});
const segment = (index = 0, overrides = {}) => ({
  contract_version: "occupancy_v1",
  segment_index: index,
  start_mode: "known",
  start_date: "2000",
  start_basis: "founding_stated",
  end_mode: "still_active",
  end_basis: "unknown",
  still_active_asof: "2016-07",
  location_relation: "same_as_task_point",
  confidence: "high",
  confidence_basis: "Synthetic dated directory was read.",
  source_basis: "named_public_source",
  source_title: "Synthetic directory",
  source_reference: "https://example.org/period",
  source_account: "Synthetic account of this particular period.",
  privacy_flag: "clear",
  ...overrides,
});
const claim = (overrides = {}) => ({
  claim_kind: "worship_function",
  claim_timing: "state",
  claim_text: "Synthetic historical worship use.",
  earliest_supported_date: "2000",
  latest_supported_date: "2015",
  continues_through_observation: false,
  confidence: "high",
  confidence_basis: "Synthetic directory confirms use.",
  source_basis: "named_public_source",
  source_title: "Synthetic history",
  source_reference: "https://example.org/history",
  source_account: "Synthetic account of historical worship.",
  privacy_flag: "clear",
  ...overrides,
});
const rapid = (id = 1, overrides = {}) => ({
  clientSubmissionId: submissionId(id),
  candidate: candidate(),
  observation: observation(),
  clientContext: { placement_zoom: 18, proximity_checked: true, nearby_count: 0 },
  ...overrides,
});
const guided = (id = 2, overrides = {}) => ({
  clientSubmissionId: submissionId(id),
  taskId: "task_1",
  evidenceDraftId: "task_1:draft_a",
  draft: draftContent(),
  segments: [segment()],
  ...overrides,
});
async function parentScene() {
  const w = await scene({ country: "VU" });
  await invoke(w, oldEvidence.submitEvidenceDraft, { evidenceDraftId: "task_1:draft_a" });
  return w;
}

for (const [name, setup, fn, request] of [
  ["rapid", scene, api.submitCurrentObservationV1, () => rapid()],
  [
    "periods",
    parentScene,
    api.submitOccupanciesV1,
    () => ({
      clientSubmissionId: submissionId(3),
      taskId: "task_1",
      parentEvidenceDraftId: "task_1:draft_a",
      segments: [segment()],
    }),
  ],
  [
    "history",
    parentScene,
    api.submitHistoricalClaimV1,
    () => ({
      clientSubmissionId: submissionId(4),
      taskId: "task_1",
      parentEvidenceDraftId: "task_1:draft_a",
      claim: claim(),
    }),
  ],
  [
    "general",
    () => scene({ country: "VU" }),
    api.submitEvidenceDraftV1,
    () => {
      const { segments, ...args } = guided(5);
      return args;
    },
  ],
  ["guided", scene, api.submitEvidenceDraftWithOccupanciesV1, () => guided(6)],
]) {
  test(`${name}: original full receipt survives task and evidence status changes`, async () => {
    const w = await setup(),
      args = request();
    const first = await invoke(w, fn, args);
    assert.equal(first.outcome, "committed");
    const receipt = await api.getClientSubmissionReceipt._handler(w.as(w.ra), {
      clientSubmissionId: args.clientSubmissionId,
    });
    assert.equal(receipt.member_id, w.ra._id);
    assert.equal(receipt.request_contract, REQUEST_CONTRACT);
    for (const task of w.rows.tasks) task.status = "pi_accepted";
    for (const draft of w.rows.evidence_drafts) draft.draft_status = "withdrawn";
    const before = structuredClone(w.rows);
    assert.deepEqual(await invoke(w, fn, args), { ...first, deduped: true });
    assert.deepEqual(w.rows, before);
    const edited = structuredClone(args);
    if (edited.observation) edited.observation.direct_observation += " Edited.";
    else if (edited.claim) edited.claim.claim_text += " Edited.";
    else if (edited.draft) edited.draft.evidence_note += " Edited.";
    else edited.segments[0].source_account += " Edited.";
    const conflict = await invoke(w, fn, edited);
    assert.equal(conflict.outcome, "content_conflict");
    assert.equal(conflict.operation, receipt.operation);
    assert.deepEqual(conflict.committedResult, receipt.result);
    assert.deepEqual(w.rows, before);
    assert.equal(
      w.ctx.charges.filter((charge) => charge.name === "submissionAttemptPerMember").length,
      3,
    );
    assert.equal(
      await api.getClientSubmissionReceipt._handler(w.as(w.otherRa), {
        clientSubmissionId: args.clientSubmissionId,
      }),
      null,
    );
  });
}

test("rapid source registration, initial periods and source snapshot commit atomically (rounds 22, 24)", async () => {
  const w = await scene();
  const args = rapid(20, {
    source: {
      kind: "register",
      countryCode: "VU",
      sourceType: "denominational_directory",
      title: "Synthetic source",
      url: "https://example.org/source",
    },
    observation: observation({ observation_basis: "named_public_source" }),
    segments: [segment(0, { still_active_asof: "2026-09-20" })],
  });
  const first = await invoke(w, api.submitCurrentObservationV1, args);
  assert.equal(first.period_result.occupancy_ids.length, 1);
  assert.equal(w.rows.sources.length, 1);
  const receipt = w.rows.client_submission_receipts[0];
  assert.equal(receipt.resolved_bindings.source.title, "Synthetic source");
  w.rows.sources[0].title = "Reviewer changed source title";
  w.rows.sources[0].status = "retired";
  const before = structuredClone(w.rows);
  assert.deepEqual(await invoke(w, api.submitCurrentObservationV1, args), {
    ...first,
    deduped: true,
  });
  assert.deepEqual(w.rows, before);
});

test("normalisation retains Unicode/internal whitespace, defaults country/name/booleans and ignores link display context", async () => {
  const w = await scene({
    country: "VU",
    task: { geometry: { type: "Point", coordinates: [168.311, -17.74] } },
  });
  const args = rapid(21, {
    candidate: candidate({
      name: "",
      probableSameAs: [{ task_id: "task_1", name: "Display name", distance_m: 100 }],
    }),
  });
  const first = await invoke(w, api.submitCurrentObservationV1, args);
  const equivalent = {
    ...args,
    countryCode: " vu ",
    flagForDiscussion: false,
    candidate: {
      ...args.candidate,
      name: " Unknown place of worship ",
      address: " Example street ",
      locality: " Example town ",
      probableSameAs: [{ task_id: "task_1", name: "Other display", distance_m: 400 }],
      locationAssertion: {
        contract_version: "location_assertion_v1",
        mode: "building_identified",
        basis: "map_placement",
        latitude: -17.74,
        longitude: 168.31,
        confidence: "high",
        contributor_confirmed: true,
      },
    },
  };
  assert.deepEqual(await invoke(w, api.submitCurrentObservationV1, equivalent), {
    ...first,
    deduped: true,
  });
  for (const text of [
    "Synthetic  site seen hosting worship.",
    "synthetic site seen hosting worship.",
    "Synthetic site seen hosting worship. é",
    "Synthetic site seen hosting worship. e\u0301",
  ]) {
    assert.equal(
      (
        await invoke(w, api.submitCurrentObservationV1, {
          ...args,
          observation: { ...args.observation, direct_observation: text },
        })
      ).outcome,
      "content_conflict",
    );
  }
});

for (const [field, value] of Object.entries({
  name: "Changed name",
  address: "Changed address",
  locality: "Changed locality",
  latitude: -17.741,
  longitude: 168.311,
  locationAssertion: {
    contract_version: "location_assertion_v1",
    mode: "building_identified",
    basis: "map_placement",
    latitude: -17.74,
    longitude: 168.31,
    confidence: "moderate",
    contributor_confirmed: true,
  },
  probableSameAs: [{ task_id: "task_1" }],
})) {
  test(`candidate ${field}: typed correction refusal writes no evidence or reciprocal links (round 19)`, async () => {
    const w = await scene({ country: "VU" });
    const args = rapid(22);
    const first = await invoke(w, api.submitCurrentObservationV1, args);
    assert.equal(
      (
        await invoke(w, api.submitCurrentObservationV1, {
          ...args,
          candidate: candidate({ [field]: value }),
        })
      ).outcome,
      "content_conflict",
    );
    const before = structuredClone(w.rows);
    const refused = await invoke(w, api.submitCurrentObservationV1, {
      ...args,
      clientSubmissionId: submissionId(23),
      candidate: undefined,
      taskId: first.task_id,
      candidateComparison: candidate({ [field]: value }),
    });
    assert.equal(refused.outcome, "correction_required");
    assert.ok(refused.fields.includes(field));
    assert.deepEqual(w.rows, before);
    assert.equal(
      w.ctx.charges.filter((charge) => charge.name === "submissionAttemptPerMember").length,
      3,
    );
    const corrected = await invoke(w, api.submitCurrentObservationV1, {
      ...args,
      clientSubmissionId: submissionId(24),
      candidate: undefined,
      taskId: first.task_id,
      candidateComparison: candidate(),
      observation: observation({ direct_observation: "Synthetic corrected observation." }),
    });
    assert.equal(corrected.corrected, true);
    assert.equal(w.rows.tasks.length, 2);
    assert.equal(
      w.rows.evidence_drafts.filter((draft) => draft.draft_status === "superseded").length,
      1,
    );
  });
}

test("Link/Unlink candidate correction refuses unlink and mode edits", async () => {
  const w = await scene({
    country: "VU",
    task: { geometry: { type: "Point", coordinates: [168.311, -17.74] } },
  });
  const args = rapid(25, { candidate: candidate({ probableSameAs: [{ task_id: "task_1" }] }) });
  const first = await invoke(w, api.submitCurrentObservationV1, args);
  const before = structuredClone(w.rows);
  for (const comparison of [
    candidate(),
    candidate({
      probableSameAs: [{ task_id: "task_1" }],
      locationAssertion: {
        contract_version: "location_assertion_v1",
        mode: "approximate_area",
        basis: "named_source_description",
        latitude: -17.74,
        longitude: 168.31,
        uncertainty_radius_m: 500,
        source_wording: "Synthetic approximate location",
        confidence: "low",
        contributor_confirmed: true,
      },
    }),
  ]) {
    assert.equal(
      (
        await invoke(w, api.submitCurrentObservationV1, {
          clientSubmissionId: submissionId(26),
          taskId: first.task_id,
          observation: observation(),
          candidateComparison: comparison,
        })
      ).outcome,
      "correction_required",
    );
    assert.deepEqual(w.rows, before);
  }
});

test("excluded audit and form state changes replay, including quick-photo midnight/context (rounds 20, 21, 24)", async () => {
  const w = await scene();
  const args = rapid(30);
  const first = await invoke(w, api.submitCurrentObservationV1, args);
  for (const field of [
    "placement_zoom",
    "nearby_count",
    "proximity_checked",
    "portal_version",
    "source",
    "country_code",
    "batch_id",
    "selected_target_year",
    "page_path",
    "nearby_place_commentary",
  ]) {
    const next = structuredClone(args);
    next.clientContext[field] = [
      "portal_version",
      "source",
      "country_code",
      "batch_id",
      "page_path",
      "nearby_place_commentary",
    ].includes(field)
      ? "new audit context"
      : field === "proximity_checked"
        ? false
        : 15;
    assert.deepEqual(await invoke(w, api.submitCurrentObservationV1, next), {
      ...first,
      deduped: true,
    });
  }
  assert.equal(
    w.rows.evidence_drafts.find((draft) => draft.evidence_draft_id === first.evidence_draft_id)
      .source_date_or_capture_date,
    "2026-09-20",
  );
  assert.equal(
    (
      await invoke(w, api.submitCurrentObservationV1, {
        ...args,
        observation: observation({ observed_on: "2026-09-21" }),
      })
    ).outcome,
    "content_conflict",
  );
  const g = await scene();
  const request = guided(31, {
    draft: draftContent({ validation_summary: { checked_at: 100 }, pending_occupancy_cards: [] }),
    clientContext: {
      source: "guided",
      country_code: "NZ",
      batch_id: "a",
      selected_target_year: 2013,
      page_path: "a",
      portal_version: "a",
    },
  });
  const sent = await invoke(g, api.submitEvidenceDraftWithOccupanciesV1, request);
  const edited = structuredClone(request);
  edited.draft.validation_summary.checked_at = 200;
  edited.draft.pending_occupancy_cards = [sample(model.pendingOccupancyCards.element)];
  for (const key of Object.keys(edited.clientContext))
    edited.clientContext[key] = key === "selected_target_year" ? 2018 : "b";
  assert.deepEqual(await invoke(g, api.submitEvidenceDraftWithOccupanciesV1, edited), {
    ...sent,
    deduped: true,
  });
  // upload/file fields belong to the client and are rejected as unknown API fields
  await assert.rejects(
    invoke(w, api.submitCurrentObservationV1, { ...args, hasEvidenceFiles: true }),
    /Unknown field/,
  );
});

test("guided A/B/A uses full intended A, clears B-only fields and returns before saving on retry (round 24)", async () => {
  const w = await scene();
  await invoke(w, oldEvidence.saveEvidenceDraft, {
    taskId: "task_1",
    evidenceDraftId: "task_1:draft_a",
    draft: draftContent({
      evidence_note: "B content on the saved row.",
      address_raw: "B-only address",
    }),
  });
  const args = guided(40);
  const first = await invoke(w, api.submitEvidenceDraftWithOccupanciesV1, args);
  const stored = w.row("evidence_drafts", "evidence_draft_id", args.evidenceDraftId);
  assert.equal(stored.evidence_note, args.draft.evidence_note);
  assert.equal(stored.address_raw, undefined);
  stored.evidence_note = "Reviewer changed the source";
  const before = structuredClone(w.rows);
  assert.deepEqual(await invoke(w, api.submitEvidenceDraftWithOccupanciesV1, args), {
    ...first,
    deduped: true,
  });
  assert.deepEqual(w.rows, before);
});

test("multi-period sorting keeps each segment's dates and gap account once (rounds 22, 23)", async () => {
  const w = await parentScene();
  const a = segment(0, {
    end_mode: "known",
    end_date: "2008",
    end_basis: "closure_stated",
    end_reason: "closed",
    still_active_asof: undefined,
    source_account: "Synthetic first period. Gap note entered once.",
  });
  const b = segment(1, {
    start_date: "2010",
    start_basis: "reopening_stated",
    source_account: "Synthetic second period.",
  });
  const args = {
    clientSubmissionId: submissionId(41),
    taskId: "task_1",
    parentEvidenceDraftId: "task_1:draft_a",
    segments: [b, a],
  };
  const first = await invoke(w, api.submitOccupanciesV1, args);
  assert.deepEqual(
    w.rows.site_occupancies.map((row) => row.start_date),
    ["2000", "2010"],
  );
  assert.equal(
    w.rows.site_occupancies.filter((row) => row.source_account.includes("Gap note")).length,
    1,
  );
  w.rows.tasks[0].status = "reviewed";
  const before = structuredClone(w.rows);
  assert.deepEqual(await invoke(w, api.submitOccupanciesV1, { ...args, segments: [a, b] }), {
    ...first,
    deduped: true,
  });
  assert.deepEqual(w.rows, before);
  await assert.rejects(
    invoke(w, api.submitOccupanciesV1, { ...args, segments: [a, a] }),
    /unique segment/,
  );
  await assert.rejects(
    invoke(w, api.submitOccupanciesV1, {
      ...args,
      segments: [{ ...a, end_not_later_than: "2009" }],
    }),
    /incompatible/,
  );
});

test("guided revision intent is content; source/version resolution happens once; editable revisions keep their pins", async () => {
  const w = await scene({ country: "VU" });
  const initial = guided(50);
  const first = await invoke(w, api.submitEvidenceDraftWithOccupanciesV1, initial);
  const source = w.row("evidence_drafts", "evidence_draft_id", first.evidence_draft_id);
  await invoke(
    w,
    oldEvidence.saveEvidenceDraft,
    {
      taskId: "task_1",
      evidenceDraftId: first.evidence_draft_id,
      draft: draftContent({ evidence_note: "Reviewer adjusted source." }),
    },
    w.reviewer,
  );
  const currentVersion = source.evidence_version_hash;
  assert.notEqual(currentVersion, first.evidence_version_hash);
  const replayBefore = structuredClone(w.rows);
  assert.deepEqual(await invoke(w, api.submitEvidenceDraftWithOccupanciesV1, initial), {
    ...first,
    deduped: true,
  });
  assert.deepEqual(w.rows, replayBefore);
  const revised = {
    clientSubmissionId: submissionId(51),
    draft: draftContent({ evidence_note: "Corrected content." }),
    revision: { taskId: "task_1", intent: "correction" },
    segments: [segment()],
  };
  const sent = await invoke(w, api.submitEvidenceDraftWithOccupanciesV1, revised);
  const receipt = w.rows.client_submission_receipts.find(
    (row) => row.client_submission_id === revised.clientSubmissionId,
  );
  assert.equal(receipt.resolved_bindings.source_draft_id, source.evidence_draft_id);
  assert.equal(receipt.resolved_bindings.source_version_hash, currentVersion);
  assert.equal(receipt.resolved_bindings.revision_reused, false);
  assert.deepEqual(await invoke(w, api.submitEvidenceDraftWithOccupanciesV1, revised), {
    ...sent,
    deduped: true,
  });
  assert.equal(
    (
      await invoke(w, api.submitEvidenceDraftWithOccupanciesV1, {
        ...revised,
        revision: { taskId: "task_1", intent: "new_observation" },
      })
    ).outcome,
    "content_conflict",
  );
  await invoke(w, oldEvidence.reviseEvidenceDraft, { taskId: "task_1", intent: "correction" });
  const editable = w.rows.evidence_drafts.find((row) => row.draft_status === "draft");
  const pinned = editable.revision_of_version_hash;
  const currentSource = w.row("evidence_drafts", "evidence_draft_id", sent.evidence_draft_id);
  await invoke(
    w,
    oldEvidence.saveEvidenceDraft,
    {
      taskId: "task_1",
      evidenceDraftId: currentSource.evidence_draft_id,
      draft: draftContent({ evidence_note: "Changed source after editable revision was opened." }),
    },
    w.reviewer,
  );
  assert.notEqual(currentSource.evidence_version_hash, pinned);
  const before = structuredClone(w.rows);
  await assert.rejects(
    invoke(w, api.submitEvidenceDraftWithOccupanciesV1, {
      ...revised,
      clientSubmissionId: submissionId(52),
      revision: { taskId: "task_1", intent: "new_observation" },
    }),
    /open revision/,
  );
  assert.deepEqual(w.rows, before);
  const reused = await invoke(w, api.submitEvidenceDraftWithOccupanciesV1, {
    ...revised,
    clientSubmissionId: submissionId(53),
    revision: { taskId: "task_1" },
  });
  assert.equal(reused.evidence_draft_id, editable.evidence_draft_id);
  const reuseReceipt = w.rows.client_submission_receipts.at(-1);
  assert.equal(reuseReceipt.resolved_bindings.source_version_hash, pinned);
  assert.equal(reuseReceipt.resolved_bindings.revision_reused, true);
  assert.equal(reuseReceipt.resolved_bindings.revision_intent, "correction");
});

test("global member key conflicts across operations; independent members cannot adopt receipts; revoked members are refused", async () => {
  const w = await scene({ country: "VU" });
  const args = rapid(60);
  const first = await invoke(w, api.submitCurrentObservationV1, args);
  const cross = await invoke(w, api.submitHistoricalClaimV1, {
    clientSubmissionId: args.clientSubmissionId,
    taskId: first.task_id,
    parentEvidenceDraftId: first.evidence_draft_id,
    claim: claim(),
  });
  assert.equal(cross.outcome, "content_conflict");
  assert.equal(cross.operation, "submitCurrentObservation");
  assert.equal(
    await api.getClientSubmissionReceipt._handler(w.as(w.otherRa), {
      clientSubmissionId: args.clientSubmissionId,
    }),
    null,
  );
  const other = await invoke(
    w,
    api.submitCurrentObservationV1,
    { clientSubmissionId: args.clientSubmissionId, taskId: "task_1", observation: observation() },
    w.otherRa,
  );
  assert.equal(other.outcome, "committed");
  assert.equal(w.rows.client_submission_receipts.length, 2);
  w.ra.status = "disabled";
  await assert.rejects(invoke(w, api.submitCurrentObservationV1, args), /not active/);
  await assert.rejects(
    api.getClientSubmissionReceipt._handler(w.as(w.ra), {
      clientSubmissionId: args.clientSubmissionId,
    }),
    /not active/,
  );
  const user = w.row("users", "auth_subject", "ra-subject");
  user.status = "active";
  user.roles = ["service"];
  await assert.rejects(invoke(w, api.submitCurrentObservationV1, args), /role/);
});

for (const [name, setup, legacy, current, request] of [
  [
    "rapid",
    scene,
    oldRapid.submitCurrentObservation,
    api.submitCurrentObservationV1,
    () => rapid(70),
  ],
  [
    "periods",
    parentScene,
    oldPeriods.submitOccupancies,
    api.submitOccupanciesV1,
    () => ({
      clientSubmissionId: submissionId(71),
      taskId: "task_1",
      parentEvidenceDraftId: "task_1:draft_a",
      segments: [segment()],
    }),
  ],
  [
    "history",
    parentScene,
    oldHistory.submitHistoricalClaim,
    api.submitHistoricalClaimV1,
    () => ({
      clientSubmissionId: submissionId(72),
      taskId: "task_1",
      parentEvidenceDraftId: "task_1:draft_a",
      claim: claim(),
    }),
  ],
  [
    "general",
    () => scene({ country: "VU" }),
    oldEvidence.submitEvidenceDraft,
    api.submitEvidenceDraftV1,
    () => {
      const { segments, ...args } = guided(73);
      return args;
    },
  ],
  [
    "guided",
    scene,
    oldEvidence.submitEvidenceDraftWithOccupancies,
    api.submitEvidenceDraftWithOccupanciesV1,
    () => guided(74),
  ],
])
  test(`${name}: legacy keys return today's deduped result and unverified marker without minting a receipt`, async () => {
    const w = await setup(),
      args = request();
    await invoke(w, legacy, args);
    const oldResult = await invoke(w, legacy, args),
      before = structuredClone(w.rows);
    const next = await invoke(w, current, args);
    assert.deepEqual(next, { outcome: "committed", ...oldResult, legacy_unverified: true });
    assert.deepEqual(w.rows, before);
    assert.equal(w.rows.client_submission_receipts.length, 0);
  });

test("fresh guided submissions including empty periods consume creation quotas; source reuse consumes none", async () => {
  const w = await scene({ country: "VU" });
  const source = {
    kind: "register",
    countryCode: "VU",
    sourceType: "denominational_directory",
    title: "Synthetic source",
    url: "https://example.org/source",
  };
  const args = guided(80, { source, segments: [] });
  await invoke(w, api.submitEvidenceDraftWithOccupanciesV1, args);
  assert.equal(w.ctx.charges.filter((row) => row.name === "generalSubmissionPerUser").length, 1);
  assert.equal(w.ctx.charges.filter((row) => row.name === "sourceCreationPerUser").length, 1);
  const retry = await invoke(w, api.submitEvidenceDraftWithOccupanciesV1, args);
  assert.equal(retry.deduped, true);
  await invoke(w, api.submitEvidenceDraftWithOccupanciesV1, {
    ...args,
    clientSubmissionId: submissionId(81),
    evidenceDraftId: undefined,
    revision: { taskId: "task_1", intent: "correction" },
    source: { ...source, notes: "Different requested metadata, reused register source." },
  });
  assert.equal(w.rows.sources.length, 1);
  assert.equal(w.ctx.charges.filter((row) => row.name === "sourceCreationPerUser").length, 1);
  assert.equal(w.ctx.charges.filter((row) => row.name === "generalSubmissionPerUser").length, 2);
});

test("issue and manual task descriptors resolve once and issue receipt survives closed lookup (round 23)", async () => {
  for (const kind of ["issue", "manual"]) {
    const w = await scene({ country: "VU" });
    const taskCreation =
      kind === "issue"
        ? {
            kind,
            countryCode: "VU",
            name: "Synthetic revision issue",
            issueType: "geometry_check",
            note: "Synthetic record needs pin verification.",
            latitude: -17.74,
            longitude: 168.31,
            assignToReporter: true,
            sourceTaskId: "task_1",
            targetYears: [2023, 2013, 2023],
          }
        : { kind, countryCode: "VU", ...candidate(), targetYears: [2023, 2013, 2023] };
    const args = rapid(82, { candidate: undefined, taskCreation });
    const first = await invoke(w, api.submitCurrentObservationV1, args);
    w.row("tasks", "task_id", first.task_id).status = "pi_accepted";
    const before = structuredClone(w.rows);
    assert.deepEqual(
      await invoke(w, api.submitCurrentObservationV1, {
        ...args,
        taskCreation: { ...taskCreation, targetYears: [2013, 2023] },
      }),
      { ...first, deduped: true },
    );
    assert.deepEqual(w.rows, before);
    assert.equal(w.rows.client_submission_receipts[0].resolved_bindings.task_id, first.task_id);
    assert.equal(w.ctx.charges.filter((row) => row.name === "taskCreationPerUser").length, 1);
  }
});

test("every write failure rolls back prerequisites, source, evidence, events, versions, derivations and receipt", async () => {
  const args = rapid(90, {
    source: {
      kind: "register",
      countryCode: "VU",
      sourceType: "denominational_directory",
      title: "Synthetic fault-injection source",
      url: "https://example.org/source",
    },
    observation: observation({ observation_basis: "named_public_source" }),
    segments: [segment(0, { still_active_asof: "2026-09-20" })],
  });
  const success = await scene();
  let writes = 0;
  for (const name of ["insert", "patch"]) {
    const original = success.db[name];
    success.db[name] = async (...values) => {
      writes++;
      return original(...values);
    };
  }
  await invoke(success, api.submitCurrentObservationV1, args);
  for (let failAt = 1; failAt <= writes; failAt++) {
    const w = await scene();
    const before = structuredClone(w.rows);
    let index = 0;
    for (const name of ["insert", "patch"]) {
      const original = w.db[name];
      w.db[name] = async (...values) => {
        const result = await original(...values);
        if (++index === failAt) throw new Error(`Injected write failure ${failAt}`);
        return result;
      };
    }
    await assert.rejects(invoke(w, api.submitCurrentObservationV1, args), /Injected write failure/);
    assert.deepEqual(w.rows, before);
    assert.deepEqual(w.ctx.charges, []);
  }
});

test("scientific inconsistencies and unsupported source/task/candidate bindings throw and roll back attempt accounting", async () => {
  for (const args of [
    guided(91, {
      draft: draftContent({
        target_year_statuses: { 2013: "absent" },
        target_year_entry_reason: "Synthetic contradiction.",
      }),
    }),
    guided(92, { segments: [segment(0, { still_active_asof: "2020" })] }),
  ]) {
    const w = await scene();
    const before = structuredClone(w.rows);
    await assert.rejects(
      invoke(w, api.submitEvidenceDraftWithOccupanciesV1, args),
      /disagrees|reference date/,
    );
    assert.deepEqual(w.rows, before);
    assert.deepEqual(w.ctx.charges, []);
  }
  const w = await scene({ country: "VU" });
  await assert.rejects(
    invoke(w, api.submitCurrentObservationV1, {
      clientSubmissionId: submissionId(93),
      taskId: "task_1",
      observation: observation(),
      candidateComparison: candidate(),
    }),
    /candidate task/,
  );
  await assert.rejects(
    invoke(w, api.submitCurrentObservationV1, rapid(94, { countryCode: "NZ" })),
    /bounds|outside/,
  );
  await assert.rejects(
    invoke(
      w,
      api.submitCurrentObservationV1,
      rapid(95, { source: { kind: "existing", sourceId: "missing" } }),
    ),
    /not in the register/,
  );
  assert.deepEqual(w.ctx.charges, []);
});

// enumerate declared validators, including optional fields, so field additions
// require a receipt decision; immutable contract literals are validation refusals
function sample(validator, current) {
  if (validator.kind === "union") {
    for (const member of validator.members) {
      const value = sample(member, current);
      if (value !== current) return value;
    }
    return current;
  }
  if (validator.kind === "literal") return validator.value;
  if (validator.kind === "string")
    return typeof current === "string" ? `${current} edited` : "Synthetic changed content";
  if (validator.kind === "float64") return typeof current === "number" ? current + 1 : 5;
  if (validator.kind === "boolean") return !current;
  if (validator.kind === "array")
    return current?.length ? [...current, current[0]] : [sample(validator.element)];
  if (validator.kind === "object")
    return Object.fromEntries(
      Object.entries(validator.fields).map(([key, field]) => [key, sample(field, current?.[key])]),
    );
  if (validator.kind === "record") return { 2013: sample(validator.value) };
  if (validator.kind === "any") return { synthetic: " strings stay unchanged " };
  return null;
}
for (const [label, setup, fn, base, part, validator] of [
  [
    "rapid observation",
    scene,
    api.submitCurrentObservationV1,
    () => rapid(100),
    "observation",
    model.rapidCurrentObservationInput,
  ],
  [
    "historical claim",
    parentScene,
    api.submitHistoricalClaimV1,
    () => ({
      clientSubmissionId: submissionId(101),
      taskId: "task_1",
      parentEvidenceDraftId: "task_1:draft_a",
      claim: claim(),
    }),
    "claim",
    model.historicalClaimInput,
  ],
  [
    "guided draft",
    scene,
    api.submitEvidenceDraftWithOccupanciesV1,
    () => guided(102),
    "draft",
    model.evidenceDraftInput,
  ],
  [
    "general draft",
    () => scene({ country: "VU" }),
    api.submitEvidenceDraftV1,
    () => {
      const { segments, ...args } = guided(103);
      return args;
    },
    "draft",
    model.evidenceDraftInput,
  ],
  [
    "occupancy segment",
    parentScene,
    api.submitOccupanciesV1,
    () => ({
      clientSubmissionId: submissionId(104),
      taskId: "task_1",
      parentEvidenceDraftId: "task_1:draft_a",
      segments: [segment()],
    }),
    "segments",
    model.occupancySegmentInput,
  ],
])
  test(`${label}: every included validator field changes equality or receives its decoding/date-mode refusal`, async () => {
    const w = await setup(),
      args = base();
    await invoke(w, fn, args);
    const before = structuredClone(w.rows);
    for (const [field, fieldValidator] of Object.entries(validator.fields)) {
      if (["validation_summary", "pending_occupancy_cards"].includes(field)) continue;
      const changed = structuredClone(args);
      const content = part === "segments" ? changed.segments[0] : changed[part];
      const alternative = sample(fieldValidator, content[field]);
      // a contract literal has no other valid value; unknown versions must fail
      content[field] = alternative === content[field] ? "unsupported-contract" : alternative;
      try {
        const result = await invoke(w, fn, changed);
        assert.equal(result.outcome, "content_conflict", `${label}.${field}`);
        assert.deepEqual(w.rows, before);
      } catch (error) {
        assert.match(
          error.message,
          /invalid value|incompatible|requires text|must be|unique segment/,
          `${label}.${field}: ${error.message}`,
        );
        assert.deepEqual(w.rows, before);
      }
    }
  });

test("stored normaliser dispatch is explicit; unsupported future versions fail closed without writing", async () => {
  const w = await scene();
  const args = rapid(110);
  await invoke(w, api.submitCurrentObservationV1, args);
  const receipt = w.rows.client_submission_receipts[0];
  receipt.request_contract = "submission-request.v999";
  const before = structuredClone(w.rows);
  await assert.rejects(
    invoke(w, api.submitCurrentObservationV1, args),
    /Unsupported submission request contract/,
  );
  assert.deepEqual(w.rows, before);
  assert.equal(
    requestDigest(REQUEST_CONTRACT, "submitOccupancies", { a: 1 }),
    requestDigest(REQUEST_CONTRACT, "submitOccupancies", {
      clientSubmissionId: submissionId(111),
      clientContext: { checked_at: 5 },
      a: 1,
    }),
  );
});

const chain = () => ({
  contract_version: "function_chain_v1",
  start: {
    label: "Synthetic initial tradition",
    label_basis: "named_documentary_source",
    date: { mode: "known", date: "2000" },
  },
  changes: [
    {
      change: "denomination_changed",
      date: { mode: "known", date: "2010" },
      label: "Synthetic second tradition",
      note: "Synthetic source states this label change.",
    },
    {
      change: "building_rebuilt",
      date: { mode: "known", date: "2012" },
      note: "Synthetic source states the building was rebuilt.",
    },
  ],
});
test("complete function chains and location assertions enter the digest; chain change order stays meaningful", async () => {
  const w = await scene({ country: "VU" }),
    args = guided(120, { chain: chain() });
  const first = await invoke(w, api.submitEvidenceDraftWithOccupanciesV1, args);
  for (const [path, value] of [
    [["start", "label"], "Changed initial tradition"],
    [["start", "label_basis"], "displayed_sign_or_notice"],
    [["start", "date", "date"], "2001"],
    [["changes", 0, "change"], "other"],
    [["changes", 0, "label"], "Changed second tradition"],
    [["changes", 0, "note"], "Changed member source note."],
    [["changes", 0, "use_frequency"], "monthly"],
    [["changes", 0, "date", "date"], "2011"],
  ]) {
    const edited = structuredClone(args);
    let node = edited.chain;
    for (const key of path.slice(0, -1)) node = node[key];
    node[path.at(-1)] = value;
    assert.equal(
      (await invoke(w, api.submitEvidenceDraftWithOccupanciesV1, edited)).outcome,
      "content_conflict",
      path.join("."),
    );
  }
  assert.equal(
    (
      await invoke(w, api.submitEvidenceDraftWithOccupanciesV1, {
        ...args,
        chain: { ...args.chain, changes: [...args.chain.changes].reverse() },
      })
    ).outcome,
    "content_conflict",
  );
  assert.deepEqual(await invoke(w, api.submitEvidenceDraftWithOccupanciesV1, args), {
    ...first,
    deduped: true,
  });
  const r = await scene();
  const request = rapid(121, {
    candidate: candidate({
      locationAssertion: {
        contract_version: "location_assertion_v1",
        mode: "building_identified",
        basis: "map_placement",
        latitude: -17.74,
        longitude: 168.31,
        confidence: "high",
        contributor_confirmed: true,
      },
    }),
  });
  await invoke(r, api.submitCurrentObservationV1, request);
  for (const [field, validator] of Object.entries(model.locationAssertionInput.fields)) {
    const edited = structuredClone(request),
      previous = edited.candidate.locationAssertion[field];
    const value = sample(validator, previous);
    edited.candidate.locationAssertion[field] = value === previous ? "unsupported-contract" : value;
    if (["contract_version", "contributor_confirmed"].includes(field))
      await assert.rejects(invoke(r, api.submitCurrentObservationV1, edited), /invalid value/);
    else
      assert.equal(
        (await invoke(r, api.submitCurrentObservationV1, edited)).outcome,
        "content_conflict",
        field,
      );
  }
});

test("source and task prerequisite projections compare every declared field before prerequisite writes", async () => {
  const source = {
    kind: "register",
    countryCode: "VU",
    sourceType: "denominational_directory",
    title: "Synthetic projection source",
    url: "https://example.org/projection",
  };
  const w = await scene(),
    args = rapid(122, {
      source,
      observation: observation({ observation_basis: "named_public_source" }),
    });
  const first = await invoke(w, api.submitCurrentObservationV1, args),
    before = structuredClone(w.rows);
  const { createSourceArgs } = await import("./sources.ts");
  for (const [field, validator] of Object.entries(createSourceArgs.fields)) {
    const edited = structuredClone(args);
    edited.source[field] = sample(validator, source[field]);
    assert.equal(
      (await invoke(w, api.submitCurrentObservationV1, edited)).outcome,
      "content_conflict",
      field,
    );
    assert.deepEqual(w.rows, before);
  }
  const existingSource = w.rows.client_submission_receipts[0].resolved_bindings.source.source_id;
  assert.equal(
    (
      await invoke(w, api.submitCurrentObservationV1, {
        ...args,
        source: { kind: "existing", sourceId: existingSource },
      })
    ).outcome,
    "content_conflict",
  );
  assert.deepEqual(await invoke(w, api.submitCurrentObservationV1, args), {
    ...first,
    deduped: true,
  });
  const { createIssueTaskArgs, createManualCandidateTaskArgs } = await import("./tasks.ts");
  for (const [kind, validator] of [
    ["issue", createIssueTaskArgs],
    ["manual", createManualCandidateTaskArgs],
  ]) {
    const world = await scene({ country: "VU" });
    const descriptor =
      kind === "issue"
        ? {
            kind,
            countryCode: "VU",
            name: "Synthetic issue",
            issueType: "geometry_check",
            note: "Synthetic issue with evidence.",
            latitude: -17.74,
            longitude: 168.31,
            assignToReporter: true,
            sourceTaskId: "task_1",
          }
        : { kind, countryCode: "VU", ...candidate() };
    const request = rapid(123, { candidate: undefined, taskCreation: descriptor });
    await invoke(world, api.submitCurrentObservationV1, request);
    const initial = structuredClone(world.rows);
    for (const [field, input] of Object.entries(validator.fields)) {
      if (field === "clientContext") continue;
      const edited = structuredClone(request);
      edited.taskCreation[field] =
        field === "probableSameAs"
          ? [{ task_id: "task_1" }]
          : field === "locationAssertion"
            ? {
                contract_version: "location_assertion_v1",
                mode: "building_identified",
                basis: "map_placement",
                latitude: -17.74,
                longitude: 168.31,
                confidence: "moderate",
                contributor_confirmed: true,
              }
            : sample(input, descriptor[field]);
      assert.equal(
        (await invoke(world, api.submitCurrentObservationV1, edited)).outcome,
        "content_conflict",
        `${kind}.${field}`,
      );
      assert.deepEqual(world.rows, initial);
    }
  }
});

test("record values trim declared evidence text while extension JSON retains strings, null, false and zero", async () => {
  const w = await scene({ country: "VU" });
  const request = guided(124, {
    draft: draftContent({
      target_year_statuses: { 2013: "present" },
      target_year_evidence: { 2013: "Synthetic year evidence." },
    }),
  });
  const first = await invoke(w, api.submitEvidenceDraftWithOccupanciesV1, request);
  assert.deepEqual(
    await invoke(w, api.submitEvidenceDraftWithOccupanciesV1, {
      ...request,
      draft: { ...request.draft, target_year_evidence: { 2013: " Synthetic year evidence. " } },
    }),
    { ...first, deduped: true },
  );
  const { normaliseInput } = await import("./lib/submissionRequest.ts");
  const extension = {
    generated_wide_row: {
      fields: [" a "],
      row: { a: " retain surrounding whitespace ", b: null, c: false, d: 0 },
    },
  };
  assert.deepEqual(normaliseInput(model.evidenceDraftInput, extension), extension);
  const malformed = JSON.parse('{"__proto__":{"injected":true}}');
  assert.throws(() => normaliseInput(model.evidenceDraftInput, malformed), /Unknown field/);
});

test("real review and PI acceptance leave the original client receipt and committed status unchanged", async () => {
  const w = await scene({ country: "VU" });
  const request = guided(125);
  const first = await invoke(w, api.submitEvidenceDraftWithOccupanciesV1, request);
  const { getReviewSnapshot, recordReviewDecision } = await import("./reviews.ts");
  const { recordAcceptance } = await import("./acceptances.ts");
  const pi = await w.addUser("synthetic-pi", ["pi"]);
  const snapshot = await getReviewSnapshot._handler(w.as(w.reviewer), {
    taskId: "task_1",
    evidenceDraftId: first.evidence_draft_id,
  });
  await invoke(
    w,
    recordReviewDecision,
    {
      taskId: "task_1",
      decision: {
        evidence_draft_id: first.evidence_draft_id,
        decision_status: "accepted_for_export",
        decision_note: "Synthetic evidence reviewed in full.",
      },
      snapshotHash: snapshot.snapshot_hash,
    },
    w.reviewer,
  );
  await invoke(
    w,
    recordAcceptance,
    { taskId: "task_1", outcome: "accepted", note: "Synthetic reviewer decision accepted." },
    pi,
  );
  const before = structuredClone(w.rows);
  assert.equal(w.rows.tasks[0].status, "pi_accepted");
  assert.deepEqual(await invoke(w, api.submitEvidenceDraftWithOccupanciesV1, request), {
    ...first,
    deduped: true,
  });
  assert.deepEqual(w.rows, before);
});

test("member re-keying retains receipts under the project member id and refuses an unlinked old credential", async () => {
  const w = await scene();
  const request = rapid(126);
  const first = await invoke(w, api.submitCurrentObservationV1, request);
  const member = w.row("users", "auth_subject", "ra-subject"),
    id = member._id;
  member.auth_subject = "synthetic-new-provider";
  assert.deepEqual(await invoke(w, api.submitCurrentObservationV1, request, member), {
    ...first,
    deduped: true,
  });
  const receipt = await api.getClientSubmissionReceipt._handler(w.as(member), {
    clientSubmissionId: request.clientSubmissionId,
  });
  assert.equal(receipt.member_id, id);
  await assert.rejects(
    api.getClientSubmissionReceipt._handler(w.as({ auth_subject: "ra-subject" }), {
      clientSubmissionId: request.clientSubmissionId,
    }),
    /not active/,
  );
});

test("an active member who changes project role still retrieves only their own receipt", async () => {
  const w = await scene();
  const request = rapid(127);
  await invoke(w, api.submitCurrentObservationV1, request);
  const member = w.row("users", "auth_subject", "ra-subject");
  member.roles = ["pi"];
  assert.equal(
    (
      await api.getClientSubmissionReceipt._handler(w.as(member), {
        clientSubmissionId: request.clientSubmissionId,
      })
    ).member_id,
    member._id,
  );
  assert.equal(
    await api.getClientSubmissionReceipt._handler(w.as(w.otherRa), {
      clientSubmissionId: request.clientSubmissionId,
    }),
    null,
  );
});
