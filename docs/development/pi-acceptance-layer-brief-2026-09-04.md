# PI acceptance layer — design brief (2026-09-04)

Status: RULED 2026-09-04 (R-P1–R-P5 all as recommended; PR #92). PR-P1 (backend) BUILT 2026-09-04 on `feat/pi-acceptance-backend-2026-09-04`: `convex/acceptances.ts`, `convex/lib/acceptance.ts` (+ node test), the `pi` role, `task_acceptances`, `pi_accepted`, the export change, the legacy backfill. PR-P2 (review portal panel, ring reading) and PR-P3 (guide, people pages) follow. Drafted at JB's request on 2026-09-04: "before accepting the design to the backend, only PIs (JB or JW) should be granted that authority. We will need to design that layer." Logged in `docs/portal-submission-review-plan.md` § Open Design Tasks.

## 1. The problem

Today a reviewer's decision is the acceptance. `recordReviewDecision` with `accepted_for_export` moves the task to `reviewed`; `createExportBatch` (any curator or admin) sweeps every `reviewed` task with such a decision into a bundle; `freezeExportBatch` sets `exported`. Every reviewer on the team can therefore admit a case to the export path, and the team-access ruling of 2026-09-03 gave the whole team the review lane. JB's ruling separates the two: a reviewer recommends, and only a principal investigator (JB or JW) accepts into the backend.

## 2. What the layer is

1. **A role.** `pi` joins the roles union (`ra`, `reviewer`, `curator`, `admin`, `service`), granted through `adminUpsertUser` to JB and JW only. A role rather than an allow-list of addresses, so the users table shows who holds it and the audit reads by user id. `admin` does not imply `pi`.
2. **An acceptance record, append-only.** New table `task_acceptances`: `acceptance_id`, `task_id`, `review_decision_id` (the `accepted_for_export` decision being ratified), `evidence_draft_id`, `pi_user_id`, `outcome` (`accepted` | `returned`), `note` (required, as decisions are), `created_at`. Never overwritten; a later acceptance supersedes by order, as review decisions do.
3. **Two task states.** `reviewed` keeps its meaning as "a reviewer accepted, awaiting PI acceptance" and gains the display label *awaiting PI acceptance*. New status `pi_accepted` sits between `reviewed` and `exported`. `returned` sends the task to `needs_review` with the PI's note, where any reviewer may decide again; it is not `changes_requested`, which is the RA's lane.
4. **Two task events.** `pi_accepted` and `pi_returned`, with actor, previous and new status, the decision id and the note, so the timeline reads reviewer → PI → export.
5. **The export reads acceptance, not the decision.** `createExportBatch` selects `pi_accepted` tasks; an explicit `taskIds` list is refused if any task is not `pi_accepted`; `freezeExportBatch` moves them to `exported` as now. The bundle records the acceptance ids beside the decision ids.
6. **The mutation.** `recordAcceptance({ taskId, outcome, note })` requires role `pi`, a task in `reviewed`, and a current `accepted_for_export` decision; it refuses a task whose submitter is the PI (the existing rule for decisions), and it honours `extra_opinions_required` as the decision already does.
7. **The review portal.** On a `reviewed` task a PI sees a *PI acceptance* panel beneath the decision panel: *Accept into the backend* and *Return to review*, each with a note. Everyone else sees "Reviewer accepted; awaiting PI acceptance". The queue's status filter gains *awaiting PI acceptance* (`reviewed`) and *accepted by a PI* (`pi_accepted`); the decision-recorded pane says which lane the case entered.
8. **The rings.** The validated ring (blue, and the near-black validated-absent ring) means *accepted by a PI or exported*. A `reviewed` task, accepted by a reviewer but awaiting a PI, wears the dashed blue in-review ring, since the case is still open. Both portals and the public map share this reading; the legends say "validated (PI accepted)".
9. **The audit mirror.** Acceptance events join the GitHub audit mirror beside decisions.
10. **Migration.** Existing `reviewed` tasks stay where they are and simply await acceptance. Existing `exported` tasks receive a backfilled acceptance row with `outcome: accepted` and `note: "legacy: exported before the PI acceptance layer (2026-09-04)"`, attributed to the service user, so the export history stays explicable.

## 3. What does not change

- The reviewer decision vocabulary (`accepted_for_export`, `rejected`, `needs_more_evidence`, `duplicate_task`, `deferred`) and its notes.
- The second-opinion gate on acceptance.
- The RA lanes: nominations, revisions, corrections, withdrawals, and the changes-requested return.
- The rapid-entry, occupancy, historical-claim and location contracts.

## 4. Build plan

- **PR-P1, backend.** Role, table, statuses and events, `recordAcceptance`, the export change, the migration, tests in `convex-test`.
- **PR-P2, review portal.** The PI acceptance panel, the queue filters, the ring reading on both portals and the public map legend.
- **PR-P3, guide and people pages.** `apps/guides/pi.html` gains the acceptance step; `docs/people/jw/README.md` and `docs/people/jb/` say what acceptance means and that only they hold it.

## 5. Rulings sought

- **R-P1 Self-acceptance.** May a PI accept a case whose `accepted_for_export` decision they recorded themselves? Recommendation: yes, but the acceptance row records `self_decided: true` and the queue shows it, since with two PIs and a small team a hard ban would stall cases. The existing rule stands: a PI never accepts their own submission.
- **R-P2 Contested cases.** When a task carries decisions that disagree (an `accepted_for_export` after a `rejected` or `deferred`), does acceptance need both PIs? Recommendation: one PI suffices, and the acceptance note must name the disagreement; a `both_pis` flag can be added later if practice shows the need.
- **R-P3 The ring reading.** Does the validated ring move to *accepted by a PI or exported*, with `reviewed` wearing the in-review ring meanwhile? Recommendation: yes; a ring that says "validated" for a case no PI has seen would overstate the record.
- **R-P4 Who may create an export batch.** Curators and admins today. Recommendation: unchanged, since the batch can only contain `pi_accepted` tasks; the authority lives in acceptance, not in batching.
- **R-P5 Returning a case.** Does *Return to review* go to `needs_review` (any reviewer decides again) or to `changes_requested` (back to the RA)? Recommendation: `needs_review`, with the PI's note; the reviewer decides whether the RA must do more.
