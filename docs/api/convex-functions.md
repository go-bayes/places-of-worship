# Convex Function Inventory

This file is the human-readable index for public Convex functions in
`convex/`. The source code and Convex schema remain the executable contract.
Update this file when adding, renaming, or materially changing a public query,
mutation, or action.

The purpose of this inventory is the same as a package function reference: a
future maintainer should be able to see what exists, who may call it, and where
it sits in the workflow without reading every source file first.

Last reviewed: 2026-05-14, against the exported Convex functions in
`users.ts`, `tasks.ts`, `evidence.ts`, `reviews.ts`, and `exports.ts`.
Exports from `model.ts` and `convex/lib/` are internal validators and helpers,
not public workflow functions.

## Role Key

- `ra`: invited research assistant.
- `reviewer`: can inspect submitted evidence and record review decisions.
- `curator`: can create and freeze export batches for `pow`.
- `admin`: can manage users and perform all pilot operations.
- `service`: trusted service role for imports or automated maintenance.
- `setup token`: protected bootstrap path using `POW_CONVEX_SETUP_TOKEN`.

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

## `tasks.ts`

| Function | Kind | Roles | Purpose | Writes |
| --- | --- | --- | --- | --- |
| `listTasks` | query | `ra`, `reviewer`, `curator`, `admin`, `service` | List tasks by country, batch, status, priority, and limit. | None |
| `listMyTasks` | query | `ra`, `reviewer`, `curator`, `admin` | List tasks assigned to the current user, with latest draft and review summary for RA history panels. | None |
| `getTask` | query | `ra`, `reviewer`, `curator`, `admin`, `service` | Return one task and its latest visible evidence draft. RAs see their own latest draft; reviewers and maintainers can see the project-level latest draft. | None |
| `getTaskEvents` | query | `ra`, `reviewer`, `curator`, `admin`, `service` | Return append-only history for a task. RAs are limited to their own assigned task history; reviewers and maintainers can inspect full task history. | None |
| `upsertTasksFromStaticMap` | mutation | `admin`, `service` | Import or refresh a task batch from static map or workpack seed data. | `task_batches`, `tasks`, `task_events` |
| `claimTask` | mutation | `ra`, `reviewer`, `curator`, `admin` | Assign a task to the caller and mark open/reopened tasks as in progress. | `tasks`, `task_events` |
| `releaseTask` | mutation | `ra`, `reviewer`, `curator`, `admin` | Return a claimed task to open status. | `tasks`, `task_events` |
| `skipTask` | mutation | `ra`, `reviewer`, `curator`, `admin` | Mark a task skipped with an optional reason. | `tasks`, `task_events` |
| `markProvisionallyClosed` | mutation | `ra`, `reviewer`, `curator`, `admin` | Mark a task provisionally closed after evidence is recorded. | `tasks`, `task_events` |
| `reopenTask` | mutation | `reviewer`, `curator`, `admin` | Reopen a task after review or correction. | `tasks`, `task_events` |
| `addTaskNote` | mutation | `ra`, `reviewer`, `curator`, `admin` | Add a size-limited note to the task history without changing the data contract. | `task_events` |
| `createManualCandidateTask` | mutation | `ra`, `reviewer`, `curator`, `admin` | Create a provisional candidate task for a nominated missing place of worship. | `tasks`, `task_events` |

Current caveat: `createManualCandidateTask` still has temporary target-year
fallbacks for New Zealand and Vanuatu. Move these values into country
configuration before wider country rollout.

## `evidence.ts`

| Function | Kind | Roles | Purpose | Writes |
| --- | --- | --- | --- | --- |
| `getEvidenceDraft` | query | draft owner, `reviewer`, `curator`, `admin` | Return one evidence draft if the caller owns it or can review it. | None |
| `listTaskEvidence` | query | `ra`, `reviewer`, `curator`, `admin` | List evidence drafts for a task. RAs see only their own drafts; reviewers and maintainers can see all task evidence. | None |
| `saveEvidenceDraft` | mutation | `ra`, `reviewer`, `curator`, `admin` | Create or update a size-limited user evidence draft and mark the task draft-saved. | `evidence_drafts`, `tasks`, `task_events` |
| `importSubmittedEvidenceDrafts` | mutation | `admin`, `service` | Import spreadsheet-submitted rows as provisional tasks and submitted evidence drafts so they enter the reviewer queue. | `task_batches`, `tasks`, `evidence_drafts`, `task_events` |
| `submitEvidenceDraft` | mutation | draft owner, `reviewer`, `curator`, `admin` | Submit a draft for reviewer attention and mark the task needs-review. | `evidence_drafts`, `tasks`, `task_events` |
| `submitUnresolvedNote` | mutation | draft owner, `reviewer`, `curator`, `admin` | Submit useful but incomplete evidence for reviewer triage and mark the task unresolved-note. | `evidence_drafts`, `tasks`, `task_events` |
| `reviseEvidenceDraft` | mutation | draft owner, `reviewer`, `curator`, `admin` | Clone a task's submitted draft into a new editable version and move the task changes-requested to in-progress; the submitted version stays immutable. | `evidence_drafts`, `tasks`, `task_events` |

## `reviews.ts`

| Function | Kind | Roles | Purpose | Writes |
| --- | --- | --- | --- | --- |
| `listReviewQueue` | query | `reviewer`, `curator`, `admin` | List review-relevant tasks by status with latest draft evidence and latest review decision. | None |
| `feedbackLoopMetrics` | query | `reviewer`, `curator`, `admin` | Report, per task, the time from a changes-requested event to the revision that answered it. | None |
| `recordReviewDecision` | mutation | `reviewer`, `curator`, `admin` | Record accept, reject, needs-more-evidence, duplicate, or defer decisions and update task state. Decisions require a short size-limited note; accepted-for-export decisions require an evidence draft from the same task. | `review_decisions`, `tasks`, `evidence_drafts`, `task_events` |

The review decision is not a master write. It becomes eligible for export only
through the export batch workflow.

## `exports.ts`

| Function | Kind | Roles | Purpose | Writes |
| --- | --- | --- | --- | --- |
| `listExportBatches` | query | `curator`, `admin` | List export batches, optionally by country and status. | None |
| `createExportBatch` | mutation | `curator`, `admin` | Create a draft export batch from reviewed tasks or explicit task ids. | `export_batches` |
| `freezeExportBatch` | mutation | `curator`, `admin` | Freeze a draft export batch and mark included tasks exported. | `export_batches`, `tasks`, `task_events` |
| `getExportBundle` | query | `curator`, `admin` | Return raw task records plus file contents for materialising the export bundle. | None |

`getExportBundle` currently returns:

- `export_manifest`,
- `tasks`,
- `task_events`,
- `evidence_drafts`,
- `review_decisions`,
- `files.export_manifest_json`,
- `files.tasks_jsonl`,
- `files.task_events_jsonl`,
- `files.evidence_drafts_jsonl`,
- `files.review_decisions_jsonl`,
- `files.site_evidence_wide_csv`.

The local script `scripts/materialise_convex_export.py` writes this bundle to
ignored local files, adds SHA-256 hashes, and prepares the handoff for `pow`.

## Update Rules

When adding or changing a public Convex function:

1. Add a concise purpose comment in the source if the function's role is not
   obvious.
2. Update the relevant table above.
3. Update `docs/convex-task-layer-spec.md` if the workflow changed.
4. Update `docs/development/convex-task-layer-setup.md` if setup or operator
   commands changed.
5. Update `CHANGELOG.md` if collaborator-visible behaviour changed.
