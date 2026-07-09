# Revision pipeline for all countries — design

Status: DRAFT for PI ratification, 2026-07-10. Author: conductor session.
Grounded in the shipped backend (`convex/schema.ts`, `convex/model.ts`) and
the ratified docs (`portal-ra-issues-and-pin-drops.md`,
`portal-ra-feedback-and-training.md`, `portal-claude-batch-review.md`,
`development/temporal-place-layer.md`).

## Objective

Take every live country's place points from `unvalidated` to a
reviewer-decided state through one auditable loop — RA evidence, reviewer
decision, frozen export — and surface the result on both the portal and,
eventually, the public maps. The machinery for a single country exists and
is exercised end-to-end by the Vanuatu training workpack. This design
scales it to the full country set without new tables and with almost no
new backend code; the work is seeding, surfacing, activation, and
governance.

## What already exists (do not rebuild)

- All 23 country portals ship `verification.html` with claim/skip/evidence/
  revise flows, pin drops, and issue reports (`createIssueTask`,
  `createManualCandidateTask`).
- The task model already carries `country_code`, per-country issue batches
  (`ra-issues-<cc>`), per-country export batches, and append-only
  provenance (`task_events`).
- The six-state validation vocabulary is defined and maps 1:1 onto
  existing task/export states — a derived rendering, not stored columns.
- The Claude batch-review lane (`claudeReviews.ts`) is built, advisory
  only, and deliberately inactive pending a PI decision.
- The revision loop (`needs_more_evidence` → `changes_requested` →
  `reviseEvidenceDraft` → resubmit, with immutable draft versions and
  `feedbackLoopMetrics`) is live.

## Phase R1 — seeding revision batches per country

Purpose: give RAs work items derived from each country's shipped points.

- One seeding mutation per country creates a `task_batches` row
  (`source_kind: "static_map_import"` — the schema's existing vocabulary;
  the draft's proposed `map_snapshot` value does not exist —
  `batch_id: "revise-<cc>-001"`) and seeds tasks through the same shape
  the static-map import validates. BUILT 2026-07-10:
  `convex/revisionSeed.ts` (`seedRevisionBatch`, `promoteRevisionBatch`),
  with the promotion gate enforced in `listTasks` (the gate had been
  procedural only; it is now real code). Pilot draft batches
  `revise-nz-001` (100 of 3,618 sites, capped per the sizing rule) and
  `revise-vu-001` (208 sites, kastom handling per the training-seed
  precedent) are seeded on dev, unpromoted.
- `target_years` derive from the country's shipped census waves (the
  `area_summary` product's year set): the revision question per site is
  "did this place stand and function at each wave year". Countries with a
  dated product also get the OSM `start_year` as machine context in
  `source_context`, never as evidence.
- Idempotency: re-seeding must dedup on the site identifier (the
  `by_matched_site` index exists); a re-run appends new sites only.
- Throttling: seed in tranches, not 23 countries at once. A batch starts
  `status: "draft"` and becomes visible to RA queues only when a curator
  promotes it — the same promotion gate the issue lane uses. Tranche one:
  NZ (pilot, richest existing data) and VU (Guy's training country).
  Tranche order thereafter follows PI priority, not alphabet.
- Sizing rule: no country batch exceeds what the active RA pool can
  plausibly clear in a month; large countries (IN, BR, US) seed
  region-scoped sub-batches (`revise-<cc>-<region>-001`).

## Phase R2 — status rings on the portal (the deferred phase 6)

Implement the six-state ring on the portal surfaces first, derived at
render time from task/export state exactly as
`portal-ra-issues-and-pin-drops.md` specifies (no schema change). The
public country maps continue to show nothing about validation until the
first frozen export exists (R4). Acceptance: an RA can see at a glance
which points in the viewport carry open work, and the ring never competes
with the religion colour encoding.

## Phase R3 — Claude batch-review activation (PI-gated)

With a small human pool, the advisory lane is the throughput multiplier.
Proposed activation sequence, each step a separate PI go/no-go:

1. Run `runBatch` once over the Vanuatu training workpack; the PI reads
   every recommendation against the known-correct labels.
2. If step 1 reads well, enable for the NZ pilot batch, JB-CLI-triggered
   (no cron), reviewers recording `agent_review_agreement` on every
   decision.
3. Review `feedbackLoopMetrics` plus agreement rates after the first 50
   decisions; only then consider cron.

The boundary stands: humans decide, the agent recommends, nothing in this
lane mutates a task, draft, or decision.

## Phase R4 — first frozen export and the public verified tier

The NZ pilot batch drives the first `export_batches` freeze. That unlocks:
the public-map verified layer (only `validated_present`/`validated_absent`
from frozen exports, per the ratified rule), the `stale_validation`
derivation for later waves, and the export → `dated_places` feedback: a
`validated_present` decision with year evidence updates the country's
dated product at its next build, with the manifest recording the export
batch as a source. That last step closes the loop between the revision
pipeline and the Points: period layer.

## Phase R5 — deployment governance (PI ruling required before scale)

Correction from the R1 build (2026-07-10): a prod deployment already
exists (`prod:valiant-octopus-914`) with an empty users table by design;
the portals and all data live on the dev deployment
(`pastel-goshawk-398`). The ruling is therefore a CUTOVER question, not a
creation question. Before tranche-two seeding or any additional RA beyond
Guy:

- decide the cutover: point the portals at prod and migrate (or
  deliberately re-seed) users, batches, and training data — or ratify
  dev-as-production explicitly and record that;
- keep the non-serving deployment as staging; deploys become
  `npx convex dev --once` (staging) then `npx convex deploy` (prod).

This is the one structural decision that gets more expensive every week it
waits.

## Sequencing and ownership

| Step | Depends on | Owner |
|---|---|---|
| R1 seeding (NZ + VU tranche) | nothing | backend agent, curator promotion by PI |
| R2 status rings (portal) | nothing | UI agent (Opus), per phase-6 spec |
| R3 advisory activation | R1 pilot batch | PI gate at each step |
| R4 first freeze + public tier | R1–R3 on NZ | PI freeze decision |
| R5 prod deployment | before tranche two | PI ruling, then backend agent |

R1 and R2 can start immediately and in parallel. The pipeline is
deliberately narrow at the human gate: nothing reaches the public maps
except through a curator promotion, a reviewer decision, and a PI-frozen
export.

## Open questions for the PI

1. Tranche order after NZ/VU — which countries carry the most research
   value for early revision coverage?
2. Batch sizing — is one month of RA capacity the right ceiling per
   tranche?
3. R3 step 1 — run the advisory lane over the training workpack now, or
   wait until Guy has worked it first (cleaner baseline for agreement
   metrics)?
4. R5 timing — create prod before or after Guy's onboarding? (Before means
   his history starts clean on prod; after means a migration.)
