// Shared in-memory Convex harness for the frozen-exports test suite
// (convex/exports.node-test.mjs) and the fixture generator
// (scripts/export_bundle_fixture.mjs). Extracted from
// convex/evidenceVersions.node-test.mjs's own world() (see that file; it is
// not imported from here, and this file must not be imported from there,
// because importing a *.node-test.mjs file re-registers every one of its
// top-level `test()` calls a second time under node:test).
//
// This file's own basename has two dots ("exportWorld.node-test.mjs"), which
// is why the Convex CLI's bundler never picks it up as a deploy entry point:
// checked against `node_modules/convex/dist/cjs/bundler/index.js`
// (`entryPoints()`), a file under convex/ is skipped when its basename
// contains more than one dot (`(base.match(/\./g) || []).length > 1`), same
// as every existing `*.node-test.mjs` file. This is NOT because ".mjs" itself
// is ignored: ".mjs" is one of the bundler's ENTRY_POINT_EXTENSIONS (js, mjs,
// cjs, ts, tsx, mts, cts, jsx) and a single-dot "something.mjs" file under
// convex/ would be picked up and bundled. Name any further shared test
// support module the same two-dot way, not with a single dot.
import { registerHooks } from "node:module";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { getFunctionName } from "convex/server";

// Convex resolves extensionless local TypeScript imports during bundling;
// the same rule is supplied here so a dynamic `import("./foo.ts")` from any
// consumer of this module resolves correctly.
registerHooks({ resolve(specifier, context, nextResolve) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) { for (const ext of [".js", ".ts"]) { const candidate = new URL(`${specifier}${ext}`, context.parentURL); if (fs.existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context); } } return nextResolve(specifier, context); } });

const { prepareFreeze, completeFreeze, recordFreezeFailure, getExportBatchRow, buildDraftBundle, requireActingUser } =
  await import("../exports.ts");

// a fixed clock that advances one millisecond per read, so recorded times
// (and every id derived from them) are deterministic and reproducible byte
// for byte across runs and across machines
let clock = Date.UTC(2026, 8, 12, 3, 0, 0, 0);
Date.now = () => (clock += 1);

// the rate limiter reaches the Convex component through ctx.runMutation,
// which an in-memory context has no way to serve; every guarded path
// (submitOccupancies, submitEvidenceDraftWithOccupancies) is exercised with
// capacity granted, so the limiter's own rules are not under test here
const { intakeRateLimiter } = await import("../lib/rateLimits.ts");
intakeRateLimiter.limit = async () => ({ ok: true, retryAfter: 0 });

// one in-memory database for every mutation, query, and internal function
// under test: withIndex eq chains on any field, insertion-ordered reads with
// order("asc"|"desc"), and the insert/get/patch semantics the handlers rely
// on. Copied from evidenceVersions.node-test.mjs's world() (see the header
// comment above for why it is copied rather than imported).
export function world() {
  const rows = {
    users: [], tasks: [], task_events: [], evidence_drafts: [], evidence_versions: [], evidence_submission_receipts: [],
    evidence_head_changes: [],
    site_occupancies: [], historical_claims: [], derived_target_year_states: [],
    derived_year_locations: [], derived_target_year_functions: [], derived_state_events: [],
    review_decisions: [], agent_reviews: [], sources: [], task_batches: [],
    task_acceptances: [], export_batches: [], review_snapshots: [],
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
      const q = { eq(field, value) { filters.push([field, value]); return q; } };
      const selected = () => {
        const matched = rows[table].filter((row) => filters.every(([field, value]) => row[field] === value));
        return descending ? [...matched].reverse() : matched;
      };
      const chain = {
        withIndex(_name, select) { if (select) select(q); return chain; },
        order(direction) { descending = direction === "desc"; return chain; },
        async unique() {
          const matched = selected();
          if (matched.length > 1) throw new Error(`unique() matched ${matched.length} rows in ${table}.`);
          return matched[0] ?? null;
        },
        async first() { return selected()[0] ?? null; },
        async take(count) { return selected().slice(0, count); },
        async collect() { return selected(); },
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
    async get(id) { return find(id); },
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
    auth: { async getUserIdentity() { return subject === null ? null : { tokenIdentifier: subject }; } },
    db,
  };

  const helper = {
    ctx,
    db,
    rows,
    as(user) { subject = user.auth_subject; return ctx; },
    row(table, field, value) { return rows[table].find((candidate) => candidate[field] === value) ?? null; },
    events(type) { return rows.task_events.filter((event) => event.event_type === type); },
    async addUser(authSubject, roles, status = "active") {
      const id = await db.insert("users", { auth_subject: authSubject, status, roles, display_name: authSubject });
      return find(id);
    },
    async addTask(record) {
      const now = Date.now();
      const id = await db.insert("tasks", {
        batch_id: "test-batch",
        country_code: "NZ",
        task_type: "confirm_existing_record",
        priority: "normal",
        status: "in_progress",
        target_years: [2013, 2018, 2023],
        geometry: { type: "Point", coordinates: [174.768, -41.282] },
        nearby_site_refs: [],
        automated_checks: [],
        name: "Test place of worship",
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
export function draftContent(overrides = {}) {
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

// a minimal in-memory blob store standing in for ctx.storage: store/get/delete,
// plus test hooks for corruption and concurrency scenarios
export function fakeStorage() {
  const blobs = new Map();
  let counter = 0;
  let corruptNextGet = false;
  let onFirstStore = null;
  return {
    async store(blob) {
      counter += 1;
      if (onFirstStore !== null) {
        const hook = onFirstStore;
        onFirstStore = null;
        await hook();
      }
      const id = `storage_${counter}`;
      const bytes = new Uint8Array(await blob.arrayBuffer());
      blobs.set(id, bytes);
      return id;
    },
    async get(id) {
      const bytes = blobs.get(id);
      if (bytes === undefined) return null;
      if (corruptNextGet) {
        corruptNextGet = false;
        const tampered = new Uint8Array(bytes.length + 1);
        tampered.set(bytes);
        tampered[bytes.length] = 0x2a;
        return new Blob([tampered]);
      }
      return new Blob([bytes]);
    },
    async delete(id) {
      blobs.delete(id);
    },
    _blobCount() { return blobs.size; },
    _corruptNextGet() { corruptNextGet = true; },
    _runOnFirstStore(hook) { onFirstStore = hook; },
    _corrupt(id) {
      const bytes = blobs.get(id);
      if (bytes === undefined) throw new Error(`No stored blob ${id} to corrupt.`);
      const tampered = new Uint8Array(bytes.length);
      tampered.set(bytes);
      tampered[0] = tampered[0] ^ 0xff;
      blobs.set(id, tampered);
    },
  };
}

const EXPORTS_HANDLERS = {
  prepareFreeze,
  completeFreeze,
  recordFreezeFailure,
  getExportBatchRow,
  buildDraftBundle,
  requireActingUser,
};

async function dispatchInternal(w, ref, args) {
  const name = getFunctionName(ref);
  const fnName = name.split(":")[1];
  const fn = EXPORTS_HANDLERS[fnName];
  if (fn === undefined) {
    throw new Error(`No fake handler registered for ${name}.`);
  }
  return await fn._handler(w.ctx, args);
}

// the fake action context freezeExportBatch and getExportBundle run under:
// no ctx.db (actions have none), ctx.storage from fakeStorage(), and
// runQuery/runMutation dispatching by getFunctionName(ref) to the exports
// module's own `_handler`s. ctx.auth is the same object the mutation/query
// ctx uses, so `w.as(user)` before a call still selects the acting identity
// the dispatched internal handlers see.
export function actionCtx(w, storage) {
  return {
    auth: w.ctx.auth,
    storage,
    async runQuery(ref, args) { return dispatchInternal(w, ref, args); },
    async runMutation(ref, args) { return dispatchInternal(w, ref, args); },
  };
}

export function utf8Length(text) {
  return new TextEncoder().encode(text).length;
}
