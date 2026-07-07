# RA Feedback Loops And Guy's Training Workpack

Status: DRAFT 2026-07-07 (late) — commissioned by JB after the first
triaged-queue session. PRIORITY ORDER PER JB: the training workpack
first (Guy is now paid), the feedback loop second. Next sitting builds
from here; run an independent review pass before merging, per house
practice.

## 1. Guy's training workpack (build first)

Purpose: a labelled series of test cases Guy works through in the
portal, exercising every flow he will be paid to do, with expected
outcomes recorded so JB can assess quality quickly (and the Claude
batch reviewer pre-triages his submissions like any others).

Prerequisite (JB action): Guy's invite — `users:inviteUser` with his
email (held privately, never in the repo), roles `ra` only for
training; add `reviewer` later if ratified.

Shape: one batch `guy-vu-training-001` (source_kind
`manual_curator`), clearly named as training in every task brief so
reviewers exclude it from any export. Seed via a dedicated internal
mutation (pattern: `createManualCandidateTask` / the devSeed shape —
but NOTE: never reuse devSeed fixtures on the live deployment; write
`trainingSeed.ts` with real VU content). Suggested cases, one task
each, with the skill it tests:

| # | Case | Tests |
| --- | --- | --- |
| 1 | Verify an existing VU church with a good web source | basic evidence entry, target-year statuses |
| 2 | Verify with a source that describes a DIFFERENT site | wrong-site discipline (should not force a match) |
| 3 | Absence claim (building gone) | dated evidence for absence, No-building-present wording |
| 4 | Place-first nomination of a known-missing church | kastom prompt (answer no), dedup check, minimal identity |
| 5 | Place-first nomination of a kastom/tabu site | kastom prompt (answer yes), sensitivity notes, restricted-location handling |
| 6 | Source-first: one directory page, three claims | source record reuse, per-claim locators |
| 7 | Regional-only claim (island/province, no coordinates) | containing-area rule, geocoding basis |
| 8 | Bounded date claim (source brackets an opening) | notEarlierThan/notLaterThan, confidence |
| 9 | Revision exercise: JB requests changes on case 1 | the feedback loop below, revise-and-resubmit |
| 10 | Unresolved note (useful but incomplete lead) | parking evidence without forcing submission |

Per case, record in the seeding file: the expected outcome and the 2-3
things a reviewer checks. Assessment loop: Guy submits → Claude batch
reviewer triages → JB reviews with the AI panel → case 9 deliberately
exercises changes_requested. VU sensitivity: cases run under the VU
config, so the kastom gate and defer_cultural behaviour are exercised
end to end — that is deliberate.

## 2. RA feedback loop (tight loops)

What exists: `recordReviewDecision(needs_more_evidence)` sets the task
to `changes_requested` and keeps the submitted draft immutable; the
state model says revisions create a NEW version. What is missing: the
RA is never alerted, and there is no one-click path to an editable
copy.

Build, in order:

1. **Surface it in the RA UI** (verification.html / listMyTasks): a
   "Changes requested" section pinned above other work, showing the
   reviewer's `decision_note` and `required_follow_up` verbatim, with
   a count badge near sign-in. This alone closes most of the loop at
   pilot scale (RAs sign in to work anyway).
2. **Revert-to-editable = revision, never mutation of the submitted
   version**: a `reviseEvidenceDraft` mutation (role `ra`, owner or
   reviewer) that clones the submitted draft into a new
   `draft_status: "draft"` version (new evidence_draft_id, same task),
   records a task event, and moves the task `changes_requested →
   in_progress`; on resubmit the old version is marked `superseded`
   (submitEvidenceDraft already supersedes). The audit trail keeps
   every version — nothing is ever reverted in place.
3. **Alerts beyond sign-in** (JB-gated, outbound email): a Convex
   scheduled function or the resend component emailing the RA when
   their task enters `changes_requested`, digest not per-event.
   Prepare, do not enable, until JB approves outbound email and the
   address-privacy rule is settled.
4. **Reviewer side**: after recording needs-more-evidence, the queue
   already drops the task; no change needed. The AI panel is
   unaffected: a revised resubmission is a NEW draft version, so the
   batch reviewer re-reviews it automatically (idempotency keys on the
   draft id).

Tight-loop metric worth logging from day one: time from
`changes_requested` event to the RA's revision event, per task —
task_events already carries both timestamps; a small query suffices.
