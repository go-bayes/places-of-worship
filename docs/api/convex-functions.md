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
| `submitCurrentObservation` (alias: `submitVanuatuCurrentObservation`) | mutation | `ra`, `reviewer`, `curator`, `admin` | Atomically record one current observation against an authorised existing task or a newly pinned provisional candidate, for any country in the closed intake registry (VU and NZ today). A new candidate may carry a `location_assertion_v1` (building identified or approximate area with radius, basis, wording, confidence) that is written to the task as `initial_location_assertion`; absent, the pin is recorded as an identified building. The server validates controlled current-status and evidence fields, applies the country's intake bounds and transactional rate limits, restricts existing-task submissions to the country's manual nomination batch unless the country's assigned batch is rapid-designed (VU), derives provisional workflow classifications, leaves all historical target years unassessed, appends audit events, and moves the task to human review. A user-scoped UUID makes safe retries idempotent. While a task holding a rapid observation awaits review (`needs_review`, `unresolved_note`, `changes_requested`), only that observation's author may submit a corrected observation; the earlier record is marked `superseded`, never rewritten. This is the only route that can create or replace a `rapid_current_v1` draft. Each observation records a `rapid_current_observation` evidence version; a correction is a child version in the corrected observation's family, pinned to the version it corrects. A retry under the same submission id returns the version its receipt names (`evidence_version_hash`), with `corrected` and `superseded_evidence_draft_id` as originally reported; a retry of an observation recorded before the version contract returns `evidence_version_unavailable: "pre_contract"` instead of a hash. | `task_batches` when absent, `tasks`, `evidence_drafts`, `evidence_versions`, `task_events`, rate-limit component state |

## `historicalClaims.ts`

| Function | Kind | Roles | Purpose | Writes |
| --- | --- | --- | --- | --- |
| `listTaskHistoricalClaims` | query | claim author, `reviewer`, `curator`, `admin` | Return a bounded newest-first list of historical claims for one task. RAs see only claims they authored; reviewers and maintainers can inspect all claims. | None |
| `submitHistoricalClaim` | mutation | author of the parent evidence with an active `ra`, `reviewer`, `curator`, or `admin` role | Record one `historical_claim_v1` event or state linked to submitted rapid or guided evidence from any country task. The mutation derives an evidence reference date, validates partial or unresolved date bounds, open-state logic, confidence, source details, retained wording, privacy, idempotency, and rate limits. It appends a task-history note but does not change task status, parent evidence, target-year states, or the master. | `historical_claims`, `task_events`, rate-limit component state |
| `listTaskOccupancies` | query | `ra`, `reviewer`, `curator`, `admin` | List a task's `occupancy_v1` periods (where and when the place of worship was used); reviewers see all rows, an RA sees their own. | none |
| `listDerivedStates` | query | `ra` (assignee), `reviewer`, `curator`, `admin` | The derived per-census-year presence rows (each present row carries `use_level`, R-F1′), location candidates, the derived per-census-year denomination rows (`derived_target_year_functions`, PR-F), and the append-only `derived_state_events` trail for a task (an event with `derivation: "function"` concerns a denomination). | none |
| `submitOccupancies` | mutation | `ra`, `reviewer`, `curator`, `admin` (parent draft author) | Record the author's set of periods against their latest submitted rapid or guided evidence record: validates the set against the parent evidence date (falling back to the recorded date only for a legacy parent without one), supersedes the author's earlier set on this parent and the author's active set on the task's earlier parents through bounded indexed reads, inserts `site_occupancies`, runs the presence rules (1–10, plus 2b `before_stated_reopening`) and location rules (L1–L5), writes `derived_target_year_states` / `derived_year_locations` as `derived_unconfirmed` with a `derived` or `invalidated` event per year, and clears `pending_occupancy_cards` on the parent; a derived value that contradicts an observed status raises the `lifespan_conflicts_observation` check. Idempotent on the submission id; rate-limited. Never writes `target_year_statuses`. Assigned guided final submissions use the atomic evidence route below instead. PR-F: each period may carry `use_frequency` (`regular` default, `monthly`, `several_times_a_year`, `annual`, `occasional`, `uncertain`; `annual` and `occasional` derive `present` with `use_level: intermittent`, `uncertain` derives `uncertain` under rule 11 `intermittent_use`: ruling R-F1 as revised by R-F1′, `occupancy_derivation_v3`) and `desacralised` joins the end reasons (R-F2). An optional `chain` (`function_chain_v1`: a starting label and ordered changes from the seven of R-F3 plus `worship_resumed` of R-F5, permitted only after `desacralised`) is validated against the parent evidence date and against the periods (a desacralisation must close a period with that reason; intermittent use must begin a period with that frequency; a resumption must begin a period with `reopening_stated`), compiled to ordered `historical_claims` carrying `chain_id`/`chain_index`/`chain_change`/`chain_label` with the periods' provenance (the author's earlier chain claims on the task are superseded as a set), stored typed on the parent as `function_chain`, and derived to `derived_target_year_functions` rows (`inside_state` → the label; `within_change_window` / `within_start_window` → uncertain with the candidate labels). When an earlier parent whose set or chain is retired is already decided (`accepted_for_export` or `rejected`), the retirement is loud: a `note_added` event on that parent names its earlier and current version and states that the review decision refers to the earlier one only, so acceptance and export still refuse it (`docs/development/evidence-versions.md`). | `site_occupancies`, `derived_target_year_states`, `derived_year_locations`, `derived_state_events`, `historical_claims`, `derived_target_year_functions`, `evidence_drafts` (`function_chain`), `evidence_versions` (`occupancy_set_recorded` child version of the parent; `superseded_by_later_set` child versions of the author's earlier parents whose sets or chains are retired), `evidence_head_changes`, `tasks` (checks), `task_events` |
| `decideDerivedYear` | mutation | `reviewer`, `curator`, `admin` (never the parent draft's author) | One action on one derived census year: `confirm` (refused on a conflict) writes the derived status into the parent draft's `target_year_statuses` with `target_year_basis = reviewer_confirmed_derivation` and, for a present year, its `use_level` into `target_year_use_levels` (R-F1′); `override` (note ≥ 8, status and/or point/radius) writes the override with basis `reviewer_override`; `reject` (note ≥ 8) writes nothing. Every action appends a `derived_state_events` row with before/after snapshots. PR-F: with `derivation: "function"` the same action decides the year's derived denomination instead: `confirm` (refused on an uncertain year) writes the derived label into `target_year_denominations` with `target_year_denomination_basis = reviewer_confirmed_derivation`; `override` (note ≥ 8, `override.label`) writes the reviewer's label with basis `reviewer_override`; `reject` writes nothing. A confirm or override that changes the parent row records a `reviewer_derivation_decision` evidence version (child of the contributor's version); a reject records none. Every action is refused unless the parent is `submitted` or `unresolved_note`: a decided, superseded, or withdrawn record stays on record (lifecycle rule in `docs/development/evidence-versions.md`). | `derived_target_year_states`, `derived_year_locations`, `derived_target_year_functions`, `derived_state_events`, `evidence_drafts`, `evidence_versions`, `task_events` |
| `confirmAllDerived` | mutation | `reviewer`, `curator`, `admin` (never the author) | Confirm every unconfirmed year whose rule is inside_interval, before_stated_founding, before_stated_reopening, or after_stated_closure, whose location is L1 or absent, and that carries no conflict; returns confirmed years and skipped years with reasons. PR-F (ruling R-F4): the same action confirms every unconfirmed derived denomination whose rule is `inside_state` (`confirmed_functions`, `skipped_functions`). Refused unless the parent is `submitted` or `unresolved_note`. | as `decideDerivedYear` |

## `evidence.ts`

| Function | Kind | Roles | Purpose | Writes |
| --- | --- | --- | --- | --- |
| `getEvidenceDraft` | query | draft owner, `reviewer`, `curator`, `admin` | Return one evidence draft if the caller owns it or can review it. | None |
| `listTaskEvidence` | query | `ra`, `reviewer`, `curator`, `admin` | List evidence drafts for a task. RAs see only their own drafts; reviewers and maintainers can see all task evidence. | None |
| `withdrawEvidenceDraft` | mutation | draft owner, `reviewer`, `curator`, `admin` | Mark an active (`submitted` or `unresolved_note`) draft `withdrawn`, leaving the task's queue if no other active submission remains; already-withdrawn is a no-op, a superseded draft is refused (withdraw the current version instead), and a decided draft is refused (reopen the task instead). Records an `evidence_head_changes` row (`withdrawn`, the row's prior status, the given reason or "Draft withdrawn by its author.") beside the `draft_withdrawn` task event. | `evidence_drafts`, `evidence_head_changes`, `tasks`, `task_events` |
| `restoreEvidenceDraft` | mutation | draft owner, `reviewer`, `curator`, `admin` | Bring a `superseded` or `withdrawn` draft back to active review with a reason (≥ 8 characters): a decided row (`accepted_for_export`, `rejected`) is refused, and so is a withdrawn row whose ledger does not show it was active when withdrawn (an unsubmitted draft is edited and submitted instead): that is reconsidered by reopening the task and recording a new decision: and the task must not be `reviewed`, `pi_accepted`, or `exported`. The restored status (`submitted` or `unresolved_note`) is read from the row's `evidence_head_changes` history rather than defaulted; the author's other active drafts on the task are superseded as on an ordinary submission. Writes no content and records no new version: periods retired by a later set are not reinstated: and moves the task to `needs_review` with a `draft_restored` event carrying the row's current `evidence_version_hash`. | `evidence_drafts`, `evidence_head_changes`, `tasks`, `task_events` |
| `saveEvidenceDraft` | mutation | `ra`, `reviewer`, `curator`, `admin` | Create or update a size-limited user evidence draft and mark the task draft-saved. Refused on a `reviewed`, `pi_accepted`, or `exported` task before any write (the intake gate, PI ruling 2026-09-11, `convex/lib/intakeGate.ts`): reopen the task first. A review role saving onto a `submitted` or `unresolved_note` row (which keeps its status) records an attributed `reviewer_edit` evidence version (child of the contributor's version) and a `note_added` event; an author is refused and must revise; an `accepted_for_export`, `rejected`, `superseded`, or `withdrawn` row is refused for everyone and stays on record. Rejects the `rapid_current_v1` contract and rapid fields, and refuses to patch an existing rapid draft. A `generated_wide_row` whose field list differs from the shared column list for the task's waves is refused with a reload message (PR-B0). | `evidence_drafts`, `evidence_versions` (reviewer edits of submitted rows), `tasks`, `task_events` |
| `importSubmittedEvidenceDrafts` | mutation | `admin`, `service` | Import spreadsheet-submitted rows as provisional tasks and submitted evidence drafts so they enter the reviewer queue. Rejects `rapid_current_v1` rows and never overwrites an existing rapid draft. A row whose existing draft is `accepted_for_export`, `rejected`, `superseded`, or `withdrawn` is counted as `skipped_final` and left untouched. Otherwise the intake gate applies as on every evidence route: a row that would write onto a `reviewed`, `pi_accepted`, or `exported` task (a new draft id, or an undecided draft on a decided task) is refused, naming the task, and the refusal fails the whole batch mutation; reopen the task and rerun. | `task_batches`, `tasks`, `evidence_drafts`, `task_events`, `evidence_versions` (`spreadsheet_import`; a re-import with changed content is a child version) |
| `submitEvidenceDraft` | mutation | draft owner, `reviewer`, `curator`, `admin` | Submit a general draft for reviewer attention and mark the task needs-review. A `clientSubmissionId` whose receipt (`evidence_submission_receipts`) is already recorded for this actor and draft returns that receipt's version with `deduped: true` before anything else, so a retry after review or PI acceptance, or after the draft was retired, changes no status and writes nothing; the same token replayed against another draft is refused as reuse. Otherwise refused on a `reviewed`, `pi_accepted`, or `exported` task before any write (the intake gate, PI ruling 2026-09-11). Records the immutable `evidence-version.v1` version first and returns `evidence_version_hash`; an optional `clientSubmissionId` is the idempotency token, whose receipt (`evidence_submission_receipts`) binds it to the version this submission received so a later retry answers with that version even after a reviewer edit; without a token an unchanged resubmission returns the existing version with `deduped: true` and no second event. Rejects rapid drafts and fails closed for assigned NZ guided tasks, whose evidence and periods must use the atomic route below. | `evidence_drafts`, `evidence_versions`, `tasks`, `task_events` |
| `submitEvidenceDraftWithOccupancies` | mutation | author of the saved draft with an active `ra`, `reviewer`, `curator`, or `admin` role | Atomically submit an assigned guided evidence draft, its complete `occupancy_v1` set, and (PR-F) its optional `function_chain_v1` chain, recorded through the same `recordFunctionChain` route as `submitOccupancies` after the periods and validated before any write. Refused on a `reviewed`, `pi_accepted`, or `exported` task before any write (the intake gate), except that the existing `guided_submission_key` retry branch answers from its receipt before the gate is reached, so a repeat of an already-submitted call still returns. The server enforces the ordinary-period requirement and the duplicate or reasoned hand-grid exceptions, validates every period against the parent evidence date, replaces the author's active set across revision parents through bounded indexed reads, derives unconfirmed census-year proposals, clears pending cards, appends events, and moves the task to review. Any failure rolls back the complete final transition; a user-scoped submission id makes safe retries idempotent. The evidence version is taken last, after periods and chain, and the submission event and result carry `evidence_version_hash`; a retry returns the hash the submission's receipt names (absent for a guided submission recorded before the contract). A correction's version is a child of the version pinned on the clone, even though the same transaction retires the source's period set and records a bookkeeping version on the source, loud (a `note_added` event naming both versions) when the source is already decided. | `evidence_drafts`, `evidence_versions`, `evidence_head_changes`, `site_occupancies`, `derived_target_year_states`, `derived_year_locations`, `derived_state_events`, `tasks`, `task_events`, rate-limit component state |
| `submitUnresolvedNote` | mutation | draft owner, `reviewer`, `curator`, `admin` | Submit useful but incomplete evidence for reviewer triage and mark the task unresolved-note. Refused on a `reviewed`, `pi_accepted`, or `exported` task before any write (the intake gate). Rejects rapid drafts. Records an `unresolved_note` evidence version and returns its hash. | `evidence_drafts`, `evidence_versions`, `tasks`, `task_events` |
| `reviseEvidenceDraft` | mutation | draft owner, `reviewer`, `curator`, `admin` | Start a revision from a task's active submission (submitted draft or unresolved note): clone it into a new editable version, or reuse the author's existing editable draft, and record a task event. Per-status transitions: changes-requested moves to in-progress; needs-review and unresolved-note keep their queue status while the revision rides alongside. The submitted version stays immutable. The clone carries `revision_of_evidence_draft_id`, `revision_intent` (`correction` by default; `new_observation` starts a new version family that references the earlier one when submitted), and `revision_of_version_hash`, the source's version at that moment, which the correction's version takes as its parent regardless of later versions on the source (absent when the source had none: a pre-contract correction). A rapid observation is never cloned: the call fails and the author corrects through `rapidEntry:submitCurrentObservation`. | `evidence_drafts`, `tasks`, `task_events` |

## `evidenceVersions.ts`

Server side of `evidence-version.v1` (`docs/development/evidence-versions.md`). `recordEvidenceVersion` is a server helper, not a public function: every submission path and every write onto submitted content calls it at the end of its transaction, and the version row is never patched. Every keyed call also writes an `evidence_submission_receipts` row binding the caller's token to the version it received (created or existing), which the retry branches of the submission routes read through the `submissionReceipt` helper. `recordHeadChange`, also a server helper, writes the `evidence_head_changes` ledger: `recordEvidenceVersion` calls it beside every version it inserts, and `evidence.ts`'s supersession, withdrawal, and restoration routes call it directly.

| Function | Kind | Roles | Purpose | Writes |
| --- | --- | --- | --- | --- |
| `getEvidenceVersion` | query | version author, `reviewer`, `curator`, `admin`, `pi`, `service` | Return one immutable evidence version by `sha256:` object hash: summary, parsed envelope, the stored canonical `envelope_json`, and a fresh verification (hash recomputed, set-like arrays checked). | None |
| `listEvidenceVersions` | query | as above; RAs see their own | List the versions of one draft row (`evidenceDraftId`) or one version family (`evidenceFamilyId`) in `version_index` order. | None |
| `listEvidenceHeadChanges` | query | as above; RAs see their own | List one draft row's `evidence_head_changes` ledger (`version_recorded`, `superseded`, `withdrawn`, `restored`) in `recorded_at` order, at most 200 rows. | None |
| `verifyDraftAgainstVersion` | query | `reviewer`, `curator`, `admin`, `pi`, `service` | Audit that a draft row and its active periods still say what the row's current version says; reports a pre-contract row, a missing version, an invalid stored envelope, or `consistent: false` when content diverged without a version. | None |
| `recordMigrationVersion` | mutation | `admin`, `service` | Record a `migration_copy` version for a legacy submitted, superseded, accepted, or rejected row that has none: names the migration run and copy time, keeps the row's own actor and times in the payload, attributes the envelope to the migrating actor, and never implies the hash existed at submission. Idempotent per run and row. No run is scheduled. | `evidence_versions`, `evidence_drafts` (hash and family locator), `evidence_head_changes`, `task_events` |

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
| `adminImportOccupancyBatch` | internalMutation (admin key only) | acts as a named active `service` or `admin` user (`actor_email`) | PR-D bulk ingest of places with their recorded periods (`docs/development/woodberry-import-brief-2026-09-02.md`): one import row per period, rows of a place sharing `source_locator` and numbered by `segment_index`, with the occupancy columns (`convex/lib/occupancyImport.ts`). Each accepted place lands SUBMITTED: a `needs_review` task with the first period's location assertion, a submitted `guided_observation_v1` draft (all target years `not_assessed`), its `site_occupancies` rows, and the derived census-year proposals as `derived_unconfirmed`, written through the same `recordOccupancySet` route as `submitOccupancies`. Validation is the nomination import's row rules plus `assertOccupancySet`; failing places are rejected with per-place reports; VU places without a kastom answer are parked; a place whose (source, locator) key or claim hash already exists is skipped. Caps: 100 places or 400 rows per run. Never writes `target_year_statuses`. Each imported place records an `occupancy_import` evidence version after its periods. | `task_batches`, `sources`, `tasks`, `evidence_drafts`, `evidence_versions`, `task_events`, `site_occupancies`, `derived_target_year_states`, `derived_year_locations`, `derived_state_events` |

## `reviews.ts`

| Function | Kind | Roles | Purpose | Writes |
| --- | --- | --- | --- | --- |
| `listReviewQueue` | query | `reviewer`, `curator`, `admin` | List review-relevant tasks by status with latest draft evidence, latest review decision, and the newest AI review artifact (`latestAgentReview`, advisory context only). | None |
| `feedbackLoopMetrics` | query | `reviewer`, `curator`, `admin` | Report, per task, the time from a changes-requested event to the revision that answered it. | None |
| `recordReviewDecision` | mutation | `reviewer`, `curator`, `admin` | Record accept, reject, needs-more-evidence, duplicate, or defer decisions and update task state. Decisions require a short size-limited note; accepted-for-export decisions require an evidence draft from the same task and, since the PI ruling of 2026-09-11, a `snapshotHash` naming the `reviews:getReviewSnapshot` the reviewer inspected (refused outright without one, and refused as stale if it no longer matches); a matching hash records the `review_snapshots` row (if absent) and the versioned (`decision_hash_version: 1`) decision hash, sharing its verify-and-record logic with `batchRecordReviewDecisions` below. The decision pins the draft's current `evidence_version_hash` (undefined for a pre-contract draft) onto `review_decisions.evidence_version_hash`, outside `decision_hash`, and onto the `review_decided` / `changes_requested` task event, so a later retirement, restoration, or write on the evidence is never silently ratified by this decision. | `review_decisions`, `review_snapshots`, `tasks`, `evidence_drafts`, `task_events` |

The review decision is not a master write. It becomes eligible for export only
through the PI acceptance layer and the export batch workflow.

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

## `acceptances.ts`

The PI acceptance layer (rulings R-P1–R-P5, 2026-09-04): a reviewer's `accepted_for_export` decision is a recommendation, left `reviewed`; only a principal investigator (role `pi`) accepts a case into the backend, and the export reads the acceptance, not the decision alone.

| Function | Kind | Roles | Purpose | Writes |
| --- | --- | --- | --- | --- |
| `recordAcceptance` | mutation | `pi` | Ratify (`accepted`, moves the task to `pi_accepted`) or return (`returned`, back to `needs_review`) the task's current `accepted_for_export` decision; refused unless the task is `reviewed`, the decision is `accepted_for_export`, the caller did not author the ratified draft, and the note is at least 8 characters. An `accepted` outcome is also refused, no-silent-transfer, when the decision pinned a version (`review_decisions.evidence_version_hash`) that no longer matches the draft's current `evidence_version_hash`: a later retirement, restoration, or write moved the row, and a new decision on the current version is required first. Since the PI ruling of 2026-09-11, an `accepted` outcome also calls `reviews:assertDecisionSnapshotConsistent` on the ratified decision: refused when the decision is not snapshot-linked (a version-0 decision, which needs a fresh snapshot-linked review before a new acceptance), when its `review_snapshots` row is missing or no longer reproduces its hash, or when its reviewer-confirmed derived locations have changed since. A `returned` outcome is subject to neither check: it records the PI's reason and sends the task back for exactly the fresh review those refusals call for. | `task_acceptances`, `tasks`, `task_events` |
| `listTaskAcceptances` | query | `ra` (own task), `reviewer`, `curator`, `admin`, `pi` | List a task's acceptance trail, newest first. | None |
| `listPrincipalInvestigators` | query | `ra`, `reviewer`, `curator`, `admin`, `pi` | List active PI display labels, with no user ids. | None |

## `exports.ts`

| Function | Kind | Roles | Purpose | Writes |
| --- | --- | --- | --- | --- |
| `listExportBatches` | query | `curator`, `admin` | List export batches, optionally by country and status. | None |
| `createExportBatch` | mutation | `curator`, `admin` | Create a draft export batch from `pi_accepted` tasks or explicit task ids (a named task not yet PI-accepted is refused). The wide CSV header is the shared column list for the country's waves (`convex/lib/wideEvidenceFields.ts`); rows are placed by column name and the manifest reports `field_list_mismatch_count` (PR-B0, 2026-09-02). No-silent-transfer, fail closed, on the decision that carries the task's current export authority: the one named by the task's latest `accepted` acceptance row (a task with no acceptance row falls back to its newest `accepted_for_export` decision; an acceptance naming a decision that is not an accepted decision on the task is refused). If that decision pinned a version, the draft's current `evidence_version_hash` must still match it, or the batch is refused naming the task, the decision, and both hashes; since the PI ruling of 2026-09-11, it also passes `reviews:assertDecisionSnapshotConsistent` when it carries a `review_snapshot_hash`, and is included unchanged when it carries none (a historical record from before snapshot-linked review), which frozen exports will recheck. Earlier `accepted_for_export` decisions on the task, superseded by a PI return and a fresh review, are listed in the batch as retained history and not checked. | `export_batches` |
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

## Internal agent research intake

`internalAgentIntake:ingestBundle` is an internal mutation gated by `POW_INTERNAL_AGENT_INGEST_ENABLED=true`. It validates bounded JSON and its SHA-256, then atomically creates a provisional task, intake-only draft, its `agent_intake` evidence version, advisory review, receipt, and audit event. Identical retries are idempotent. `getReceipt` and `listReceipts` require reviewer, curator, or admin roles. `batchDisposeReceipts` applies human return or rejection to an explicit set of receipt hashes; intake-only drafts cannot be accepted for export. See [internal agent review](../development/internal-agent-review.md).

`reviews:getReviewSnapshot` (query, `reviewer`/`curator`/`admin`) returns the complete inspected task, evidence, period, derived-state, historical-claim, advisory-review, and decision context with a SHA-256 snapshot hash; the review portal fetches it when a task is selected, renders the task, evidence draft, events, claims, and latest decision from it (`apps/regions/nz/js/review-snapshot-content.js`; never from the queue row cached at queue load), and shows its hash prefix, draft status, evidence version, and record counts beside the decision form before the reviewer decides. `reviews:batchRecordReviewDecisions` accepts up to 20 ordinary evidence decisions, checks the selected snapshots, and reuses the individual review rules in a Convex transaction: including the `evidence_version_hash` pin described above, decision by decision. Since the PI ruling of 2026-09-11, `reviews:recordReviewDecision` shares the same snapshot verification and `review_snapshots` recording as the batch route, through one helper the two cannot drift apart from; an `accepted_for_export` decision with no snapshot, or a stale one, is refused before any write, on both routes. Each accepted decision records its snapshot hash, and `reviews:getRecordedReviewSnapshot` retrieves the immutable inspected content. `reviews:assertDecisionSnapshotConsistent` (an exported helper, not a callable function) re-verifies a linked decision's recorded snapshot, including its reviewer-confirmed derived locations, at PI acceptance and export-batch creation. Intake-only drafts remain ineligible; PI acceptance (`acceptances.ts`, above) is the next gate after a reviewer's `accepted_for_export` decision.

Internal agent review repair (2026-09-11): `reviews:listReviewQueue` selects advisory reviews by the current evidence draft. `internalAgentIntake:batchDisposeReceipts` shares ordinary human decision validation and releases review claims. Snapshot-linked batch decisions record `decision_hash_version: 1`; see the [hash contract](../development/internal-agent-review.md).
