# Convex Function Inventory

This file is the human-readable index for public Convex functions in
`convex/`. The source code and Convex schema remain the executable contract.
Update this file when adding, renaming, or materially changing a public query,
mutation, or action.

The purpose of this inventory is the same as a package function reference: a
future maintainer should be able to see what exists, who may call it, and where
it sits in the workflow without reading every source file first.

The inventory also lists internal functions (kind `internal query`,
`internal mutation`, or `internal action`) where they matter operationally.
Internal functions are not part of the public API: they are callable only with
the deployment admin key, from the CLI, dashboard, or a scheduled job.

Last reviewed: 2026-08-28, against the exported Convex functions in
`users.ts`, `tasks.ts`, `evidence.ts`, `batchImport.ts`, `reviews.ts`,
`rapidEntry.ts`, `historicalClaims.ts`, `claudeReviews.ts`, `exports.ts`, `devSeed.ts`, `revisionSeed.ts`, and
`trainingSeed.ts`.
Exports from `model.ts` and `convex/lib/` are internal validators and helpers,
not public workflow functions.

## Role Key

- `ra`: invited research assistant.
- `reviewer`: can inspect submitted evidence and record review decisions.
- `curator`: can create and freeze export batches for `pow`.
- `admin`: can manage users and perform all pilot operations.
- `service`: trusted service role for imports or automated maintenance.
- `setup token`: protected bootstrap path using `POW_CONVEX_SETUP_TOKEN`.
- `admin key`: deployment admin key (CLI, dashboard, or scheduled job); marks
  internal functions that are never callable from the public API.

## Boundary Rule

No Convex function may write directly to the master database or public map
exports. Convex functions may create tasks, evidence drafts, review decisions,
and export bundles. Accepted changes become research data only after export,
`pow` validation, diff, replay, and rebuild.

## Current Safety Notes

- RA accounts can inspect their own assigned task state and their own evidence
  drafts. Reviewer, curator, admin, and service roles have wider inspection
  powers for review, export, and maintenance.
- Submitted evidence is not directly editable by an RA. Revisions should create
  a new draft and supersede the older submitted draft after resubmission.
- Evidence notes, source fields, generated rows, review notes, task notes, and
  client context have server-side size limits before writes reach the shared
  backend.
- Vanuatu rapid entry is role-checked, rate-limited, idempotent per user submission, restricted to Vanuatu coordinates, and atomic across candidate creation, evidence submission, audit events, and the task transition to human review. The client cannot submit historical target-year states or other derived review fields through this endpoint.
- Historical-claim entry is a separate, author-bound `historical_claim_v1` route for every country task. It validates one source-backed event or state against a submitted rapid or guided evidence record, preserves unresolved bounds and retained source wording, and cannot alter the parent evidence or create a target-year state.
- `accepted_for_export` is a review state, not a master write. It only makes a
  decision eligible for export to the governed `pow` path.

## `users.ts`

| Function | Kind | Roles | Purpose | Writes |
| --- | --- | --- | --- | --- |
| `me` | query | signed-in user or anonymous | Return the current project user record, or `null` if not signed in. | None |
| `bootstrapFirstAdmin` | mutation | setup token plus authenticated user | Create the first active admin when the deployment has no users. | `users` |
| `bootstrapPendingInvites` | mutation | setup token | Create the initial pending admin and RA invites before users claim them. | `users` |
| `inviteUser` | mutation | `admin` | Create or update a pending invitation and assigned roles. | `users` |
| `claimInvite` | mutation | invited authenticated user | Bind a pending email invitation to the Google-authenticated subject. | `users` |
| `listUsers` | query | `admin` | List project users, optionally filtered by status. | None |
| `adminUpsertUser` | internal mutation | `admin key` | Repair a user record: patch roles on an existing user while preserving status (unlike `inviteUser`, which resets active users to pending), or insert a pending invite when no row matches the email. | `users` |

## `tasks.ts`

| Function | Kind | Roles | Purpose | Writes |
| --- | --- | --- | --- | --- |
| `listTasks` | query | `ra`, `reviewer`, `curator`, `admin`, `service` | List tasks by country, batch, status, priority, and limit. | None |
| `listMyTasks` | query | `ra`, `reviewer`, `curator`, `admin` | List tasks assigned to the current user, with latest draft and review summary for RA history panels. | None |
| `getTask` | query | `ra`, `reviewer`, `curator`, `admin`, `service` | Return one task and its latest visible evidence draft. RAs see their own latest draft; reviewers and maintainers can see the project-level latest draft. | None |
| `getTaskEvents` | query | `ra`, `reviewer`, `curator`, `admin`, `service` | Return append-only history for a task. RAs are limited to their own assigned task history; reviewers and maintainers can inspect full task history. | None |
| `getTaskHistory` | query | `ra`, `reviewer`, `curator`, `admin`, `service` | Return a capped event history for any task plus draft count and latest review summary. All roles see workflow state; actor identity and reasons are visible only to reviewers and maintainers, or on the caller's own events. | None |
| `upsertTasksFromStaticMap` | mutation | `admin`, `service` | Import or refresh a task batch from static map or workpack seed data. | `task_batches`, `tasks`, `task_events` |
| `adminUpsertTasksFromStaticMap` | internalMutation | deployment admin key only | Same import as `upsertTasksFromStaticMap`, run from a script with the admin key and an `actor_email` naming an active service user so task events carry an honest actor. Not callable from any client. | `task_batches`, `tasks`, `task_events` |
| `claimTask` | mutation | `ra`, `reviewer`, `curator`, `admin` | Assign a task to the caller and mark open/reopened tasks as in progress. | `tasks`, `task_events` |
| `releaseTask` | mutation | `ra`, `reviewer`, `curator`, `admin` | Return a claimed task to open status. | `tasks`, `task_events` |
| `skipTask` | mutation | `ra`, `reviewer`, `curator`, `admin` | Mark a task skipped with an optional reason. | `tasks`, `task_events` |
| `unskipTask` | mutation | `ra`, `reviewer`, `curator`, `admin` | Return a skipped task to in progress, recorded as a reopened event with an optional reason. | `tasks`, `task_events` |
| `markProvisionallyClosed` | mutation | `ra`, `reviewer`, `curator`, `admin` | Mark a task provisionally closed after evidence is recorded. | `tasks`, `task_events` |
| `reopenTask` | mutation | `reviewer`, `curator`, `admin` | Reopen a task after review or correction. | `tasks`, `task_events` |
| `addTaskNote` | mutation | `ra`, `reviewer`, `curator`, `admin` | Add a size-limited note to the task history without changing the data contract. | `task_events` |
| `createIssueTask` | mutation | `ra`, `reviewer`, `curator`, `admin` | Create an issue-report task (possible duplicate, verify existing site, geometry check, OSM identity link, or other) from RA map inspection, in the per-country `ra-issues-<cc>` batch. An open issue task for the same matched site or OSM id is deduplicated: the note is appended to it instead. With `assignToReporter`, the task is created (or an open issue for the same record claimed) as `in_progress` assigned to the reporter so a rapid observation can be submitted against it at once; `locationAssertion` records the reporter's confirmed point or area on the task and `originalLatitude`/`originalLongitude` retain the record's own point for the reviewer (revise-with-evidence lane, 2026-09-02). | `task_batches`, `tasks`, `task_events` |
| `createManualCandidateTask` | mutation | `ra`, `reviewer`, `curator`, `admin` | Create a provisional candidate task for a nominated missing place of worship. An optional `location_assertion_v1` records a contributor-confirmed building point or approximate-area centre, including the uncertainty radius, basis, confidence, and retained location wording. | `tasks`, `task_events` |

Target-year defaults: when a caller omits `targetYears`,
`createManualCandidateTask` resolves the country's shipped census waves
from `convex/lib/countryYears.ts` (all nine live countries) and throws
for unknown country codes rather than inheriting another country's
years. Callers should still pass `targetYears` explicitly; the portal
does. `countryYears.ts` mirrors the portal's `COUNTRY_CONFIGS`
`targetYears` — update both in the same commit when a country's waves
change.

## `rapidEntry.ts`

| Function | Kind | Roles | Purpose | Writes |
| --- | --- | --- | --- | --- |
| `submitCurrentObservation` (alias: `submitVanuatuCurrentObservation`) | mutation | `ra`, `reviewer`, `curator`, `admin` | Atomically record one current observation against an authorised existing task or a newly pinned provisional candidate, for any country in the closed intake registry (VU and NZ today). A new candidate may carry a `location_assertion_v1` (building identified or approximate area with radius, basis, wording, confidence) that is written to the task as `initial_location_assertion`; absent, the pin is recorded as an identified building. The server validates controlled current-status and evidence fields, applies the country's intake bounds and transactional rate limits, restricts existing-task submissions to the country's manual nomination batch unless the country's assigned batch is rapid-designed (VU), derives provisional workflow classifications, leaves all historical target years unassessed, appends audit events, and moves the task to human review. A user-scoped UUID makes safe retries idempotent. While a task holding a rapid observation awaits review (`needs_review`, `unresolved_note`, `changes_requested`), only that observation's author may submit a corrected observation; the earlier record is marked `superseded`, never rewritten. This is the only route that can create or replace a `rapid_current_v1` draft. | `task_batches` when absent, `tasks`, `evidence_drafts`, `task_events`, rate-limit component state |

## `historicalClaims.ts`

| Function | Kind | Roles | Purpose | Writes |
| --- | --- | --- | --- | --- |
| `listTaskHistoricalClaims` | query | claim author, `reviewer`, `curator`, `admin` | Return a bounded newest-first list of historical claims for one task. RAs see only claims they authored; reviewers and maintainers can inspect all claims. | None |
| `submitHistoricalClaim` | mutation | author of the parent evidence with an active `ra`, `reviewer`, `curator`, or `admin` role | Record one `historical_claim_v1` event or state linked to submitted rapid or guided evidence from any country task. The mutation derives an evidence reference date, validates partial or unresolved date bounds, open-state logic, confidence, source details, retained wording, privacy, idempotency, and rate limits. It appends a task-history note but does not change task status, parent evidence, target-year states, or the master. | `historical_claims`, `task_events`, rate-limit component state |
| `listTaskOccupancies` | query | `ra`, `reviewer`, `curator`, `admin` | List a task's `occupancy_v1` periods (where and when the place of worship was used); reviewers see all rows, an RA sees their own. | none |
| `listDerivedStates` | query | `ra` (assignee), `reviewer`, `curator`, `admin` | The derived per-census-year presence rows, location candidates, and the append-only `derived_state_events` trail for a task. | none |
| `submitOccupancies` | mutation | `ra`, `reviewer`, `curator`, `admin` (parent draft author) | Record the author's set of periods against their latest submitted rapid or guided evidence record: validates the set (mode⇒dates, basis asymmetry enforced, one place at a time, relocations must move), supersedes the author's earlier set on this parent and, since PR-E, the author's active set on the task's earlier parents (a revision carries the set forward; the earlier parents are rederived to nothing), inserts `site_occupancies`, runs the presence rules (1–10, plus 2b `before_stated_reopening`) and location rules (L1–L5), writes `derived_target_year_states` / `derived_year_locations` as `derived_unconfirmed` with a `derived` or `invalidated` event per year, and clears `pending_occupancy_cards` on the parent; a derived value that contradicts an observed status raises the `lifespan_conflicts_observation` check. Idempotent on the submission id; rate-limited. Never writes `target_year_statuses`. | `site_occupancies`, `derived_target_year_states`, `derived_year_locations`, `derived_state_events`, `tasks` (checks), `task_events` |
| `decideDerivedYear` | mutation | `reviewer`, `curator`, `admin` (never the parent draft's author) | One action on one derived census year: `confirm` (refused on a conflict) writes the derived status into the parent draft's `target_year_statuses` with `target_year_basis = reviewer_confirmed_derivation`; `override` (note ≥ 8, status and/or point/radius) writes the override with basis `reviewer_override`; `reject` (note ≥ 8) writes nothing. Every action appends a `derived_state_events` row with before/after snapshots. | `derived_target_year_states`, `derived_year_locations`, `derived_state_events`, `evidence_drafts`, `task_events` |
| `confirmAllDerived` | mutation | `reviewer`, `curator`, `admin` (never the author) | Confirm every unconfirmed year whose rule is inside_interval, before_stated_founding, or after_stated_closure, whose location is L1 or absent, and that carries no conflict; returns confirmed years and skipped years with reasons. | as `decideDerivedYear` |

## `evidence.ts`

| Function | Kind | Roles | Purpose | Writes |
| --- | --- | --- | --- | --- |
| `getEvidenceDraft` | query | draft owner, `reviewer`, `curator`, `admin` | Return one evidence draft if the caller owns it or can review it. | None |
| `listTaskEvidence` | query | `ra`, `reviewer`, `curator`, `admin` | List evidence drafts for a task. RAs see only their own drafts; reviewers and maintainers can see all task evidence. | None |
| `saveEvidenceDraft` | mutation | `ra`, `reviewer`, `curator`, `admin` | Create or update a size-limited user evidence draft and mark the task draft-saved. Rejects the `rapid_current_v1` contract and rapid fields, and refuses to patch an existing rapid draft. A `generated_wide_row` whose field list differs from the shared column list for the task's waves is refused with a reload message (PR-B0). | `evidence_drafts`, `tasks`, `task_events` |
| `importSubmittedEvidenceDrafts` | mutation | `admin`, `service` | Import spreadsheet-submitted rows as provisional tasks and submitted evidence drafts so they enter the reviewer queue. Rejects `rapid_current_v1` rows and never overwrites an existing rapid draft. | `task_batches`, `tasks`, `evidence_drafts`, `task_events` |
| `submitEvidenceDraft` | mutation | draft owner, `reviewer`, `curator`, `admin` | Submit a draft for reviewer attention and mark the task needs-review. Rejects rapid drafts. | `evidence_drafts`, `tasks`, `task_events` |
| `submitUnresolvedNote` | mutation | draft owner, `reviewer`, `curator`, `admin` | Submit useful but incomplete evidence for reviewer triage and mark the task unresolved-note. Rejects rapid drafts. | `evidence_drafts`, `tasks`, `task_events` |
| `reviseEvidenceDraft` | mutation | draft owner, `reviewer`, `curator`, `admin` | Start a revision from a task's active submission (submitted draft or unresolved note): clone it into a new editable version, or reuse the author's existing editable draft, and record a task event. Per-status transitions: changes-requested moves to in-progress; needs-review and unresolved-note keep their queue status while the revision rides alongside. The submitted version stays immutable. A rapid observation is never cloned: the call fails and the author corrects through `rapidEntry:submitCurrentObservation`. | `evidence_drafts`, `tasks`, `task_events` |

## `batchImport.ts`

Convex mirror of the curator batch import
(`docs/portal-batch-import-and-corrections.md`). Rows are parsed client-side
and re-validated server-side with the same rules as
`apps/workbench/src/data/batchImport.ts`; rule changes must land in both
places. Curator-imported rows arrive as drafts, never auto-submitted, so the
review gates are untouched. The admin-key occupancy ingest (PR-D) is the
exception by design: the admin running it under a named service or admin user
is the deliberate human act, and its places land submitted for review.

| Function | Kind | Roles | Purpose | Writes |
| --- | --- | --- | --- | --- |
| `importNominationBatch` | mutation | `curator`, `admin` | Import up to 200 validated nomination rows from one source file as draft-saved tasks with draft evidence. Idempotent per source: a row whose (source, locator) key or claim hash matches an earlier import is skipped; invalid rows are rejected with per-row reports; VU rows without a kastom answer are parked for individual handling. | `task_batches`, `tasks`, `evidence_drafts`, `task_events` |
| `adminImportOccupancyBatch` | internalMutation (admin key only) | acts as a named active `service` or `admin` user (`actor_email`) | PR-D bulk ingest of places with their recorded periods (`docs/development/woodberry-import-brief-2026-09-02.md`): one import row per period, rows of a place sharing `source_locator` and numbered by `segment_index`, with the occupancy columns (`convex/lib/occupancyImport.ts`). Each accepted place lands SUBMITTED: a `needs_review` task with the first period's location assertion, a submitted `guided_observation_v1` draft (all target years `not_assessed`), its `site_occupancies` rows, and the derived census-year proposals as `derived_unconfirmed`, written through the same `recordOccupancySet` route as `submitOccupancies`. Validation is the nomination import's row rules plus `assertOccupancySet`; failing places are rejected with per-place reports; VU places without a kastom answer are parked; a place whose (source, locator) key or claim hash already exists is skipped. Caps: 100 places or 400 rows per run. Never writes `target_year_statuses`. | `task_batches`, `sources`, `tasks`, `evidence_drafts`, `task_events`, `site_occupancies`, `derived_target_year_states`, `derived_year_locations`, `derived_state_events` |

## `reviews.ts`

| Function | Kind | Roles | Purpose | Writes |
| --- | --- | --- | --- | --- |
| `listReviewQueue` | query | `reviewer`, `curator`, `admin` | List review-relevant tasks by status with latest draft evidence, latest review decision, and the newest AI review artifact (`latestAgentReview`, advisory context only). | None |
| `feedbackLoopMetrics` | query | `reviewer`, `curator`, `admin` | Report, per task, the time from a changes-requested event to the revision that answered it. | None |
| `recordReviewDecision` | mutation | `reviewer`, `curator`, `admin` | Record accept, reject, needs-more-evidence, duplicate, or defer decisions and update task state. Decisions require a short size-limited note; accepted-for-export decisions require an evidence draft from the same task. | `review_decisions`, `tasks`, `evidence_drafts`, `task_events` |

The review decision is not a master write. It becomes eligible for export only
through the export batch workflow.

## `claudeReviews.ts`

`claudeReviews.ts` contains the built Anthropic automation runner described in `docs/portal-claude-batch-review.md` and the provider-neutral artifact mutations used by authorised session runs. Humans decide; AI recommends. Nothing in this module changes a task status, an evidence draft, or a review decision: it appends advisory artifacts, batch manifests, and audit events. The automated runner is an internal action, so unauthenticated callers cannot trigger model spend.

| Function | Kind | Roles | Purpose | Writes |
| --- | --- | --- | --- | --- |
| `listAgentReviewsForTask` | query | `reviewer`, `curator`, `admin` | List a task's AI review artifacts, newest first. | None |
| `ensureServiceUser` | internal mutation | `admin key` | Find or create the `claude-batch-reviewer` service user that artifacts and audit events are attributed to. | `users` |
| `pendingForBatch` | internal query | `admin key` | List needs-review tasks with their latest reviewable draft and whether that draft already carries an artifact at the current prompt version. | None |
| `openBatch` | internal mutation | `admin key` | Insert a running batch manifest recording trigger, models, and item cap. | `agent_review_batches` |
| `closeBatch` | internal mutation | `admin key` | Mark a batch manifest completed or failed with final counts and error notes. | `agent_review_batches` |
| `recordArtifact` | internal mutation | `admin key` | Append a versioned agent-review artifact and an audit note event; the task status is deliberately untouched. | `agent_reviews`, `task_events` |
| `runBatch` | internal action | `admin key` | Run one batch: select pending items, check sources, call the model, and record artifacts through the mutations above. Requires `ANTHROPIC_API_KEY`; item cap and deadline bound each run, and idempotent re-runs continue the remaining queue. | None directly; writes via the mutations above |

Two schema tables back this lane. The `agent_reviews` table holds append-only
advisory artifacts, one row per (claim version, prompt version); re-reviews
append with a higher version, never overwrite. The `agent_review_batches`
table is the run manifest per batch invocation: trigger, models, caps, and
counts made inspectable. No function that writes to either table may change
tasks, drafts, or review decisions.

## `exports.ts`

| Function | Kind | Roles | Purpose | Writes |
| --- | --- | --- | --- | --- |
| `listExportBatches` | query | `curator`, `admin` | List export batches, optionally by country and status. | None |
| `createExportBatch` | mutation | `curator`, `admin` | Create a draft export batch from reviewed tasks or explicit task ids. The wide CSV header is the shared column list for the country's waves (`convex/lib/wideEvidenceFields.ts`); rows are placed by column name and the manifest reports `field_list_mismatch_count` (PR-B0, 2026-09-02). | `export_batches` |
| `freezeExportBatch` | mutation | `curator`, `admin` | Freeze a draft export batch and mark included tasks exported. | `export_batches`, `tasks`, `task_events` |
| `getExportBundle` | query | `curator`, `admin` | Return raw task records plus file contents for materialising the export bundle. | None |

`getExportBundle` currently returns:

- `export_manifest`,
- `tasks`,
- `task_events`,
- `evidence_drafts`,
- `historical_claims`,
- `review_decisions`,
- `files.export_manifest_json`,
- `files.tasks_jsonl`,
- `files.task_events_jsonl`,
- `files.evidence_drafts_jsonl`,
- `files.historical_claims_jsonl`,
- `files.review_decisions_jsonl`,
- `files.site_evidence_wide_csv`.

The local script `scripts/materialise_convex_export.py` writes this bundle to
ignored local files, adds SHA-256 hashes, and prepares the handoff for `pow`.

## `devSeed.ts`

Dev-only seeding for local and dev deployments; never intended for the
production project.

| Function | Kind | Roles | Purpose | Writes |
| --- | --- | --- | --- | --- |
| `seedReviewQueueFixture` | internal mutation | `admin key` | Seed one reviewable task with a submitted draft so the batch-review dry run has a queue to triage. Idempotent per task id. | `users`, `task_batches`, `tasks`, `evidence_drafts` |

## `revisionSeed.ts`

Phase R1 seeding for per-country revision batches
(`docs/development/revision-pipeline-all-countries.md`). Seeded batches start
as drafts, invisible to RA queues, until a curator promotes them.

| Function | Kind | Roles | Purpose | Writes |
| --- | --- | --- | --- | --- |
| `seedRevisionBatch` | internal mutation | `admin key` | Create or extend a draft revision batch (`revise-<cc>-<nnn>`) with one open task per shipped map site. Target years must match the Convex wave mirror; sites are deduplicated on `matched_current_site_id`, so a re-seed appends only new sites. | `task_batches`, `tasks`, `task_events` |
| `promoteRevisionBatch` | internal mutation | `admin key` | Promote a draft revision batch to active so its tasks appear in RA queues — the R1 throttling gate, run from the CLI as a curator decision. | `task_batches` |

## `trainingSeed.ts`

One-off fixture kept for reseeding a fresh deployment; retire once the
training lane closes.

| Function | Kind | Roles | Purpose | Writes |
| --- | --- | --- | --- | --- |
| `seedGuyTrainingWorkpack` | internal mutation | `admin key` | Seed the fixed VU training batch `guy-vu-training-001` with its training-case tasks, all excluded from exports. Idempotent: skips entirely when the batch already exists. | `task_batches`, `tasks`, `task_events` |

## Update Rules

When adding or changing a public Convex function:

1. Add a concise purpose comment in the source if the function's role is not
   obvious.
2. Update the relevant table above.
3. Update `docs/convex-task-layer-spec.md` if the workflow changed.
4. Update `docs/development/convex-task-layer-setup.md` if setup or operator
   commands changed.
5. Update `CHANGELOG.md` if collaborator-visible behaviour changed.
