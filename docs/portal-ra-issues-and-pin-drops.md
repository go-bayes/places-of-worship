# RA issue reports, pin-drop nominations, and the verified layer

Status: ratified by JB, 2026-07-08 (chat). Build order: phase 4 → 6.
Related: docs/portal-batch-import-and-corrections.md,
docs/portal-ra-feedback-and-training.md.

## Problem

RAs notice problems the task system did not assign: a double-counted
place, a dot in the wrong spot, a building that is not a place of
worship, a missing place they know locally. Today those observations
have nowhere to go unless a task already exists.

## Ratified design decisions

1. **One pipeline, no side channel.** An ad-hoc report becomes an
   ordinary task — unassigned, `status: "open"`, in a per-country batch
   `ra-issues-<cc>` — so it flows through the existing list, review,
   and export governance with full task-event provenance.
2. **Curator triage before assignment.** Issue tasks are visible to
   reviewers and curators but do not enter any RA's assignment queue
   until promoted. RAs freely add information; the review boundary is
   untouched.
3. **Dedup at intake.** A new report against a site that already has an
   open issue task appends a note to that task instead of creating a
   second one.
4. **Pin drops are evidence-bearing candidates.** A missing-PoW pin
   drop records confirmed coordinates plus placement provenance (zoom,
   basemap) into `source_context`, runs a proximity check against
   existing points before creation, and then follows the standard
   draft → submit-for-review flow. Observation time and target-year
   existence are captured separately (`source_date_or_capture_date`
   vs `target_year_statuses`). Offline knowledge is first-class
   (`source_type: field_observation`; no URL required).
5. **Verified is a styling state, not a second layer.** Portal dots are
   styled by verification state — verified (review-accepted), under
   review (submitted), unworked — joined live from Convex task status.
6. **Public maps show "verified" only from frozen export batches.** A
   public verification claim rides the export governance; live draft
   state never reaches a public surface.

## Phases

- **Phase 4 — issue reporting + skip refinements.**
  Backend: `tasks:createIssueTask` (issue type → task_type:
  possible_duplicate / verify_existing_site / geometry_check /
  osm_identity_link / other; dedup-append; batch upsert),
  `tasks:unskipTask`. Portal: "Report an issue" on inspected points;
  confirmation panes gain "Open next task"; skip gains undo and
  structured reason chips (can't find a source / ambiguous identity /
  needs local knowledge / looks like a duplicate / data error — the
  last two double as issue entry points).
- **Phase 5 — pin-drop missing PoW.** Pin mode with drag-to-confirm,
  minimum placement zoom, proximity duplicate check, time capture, then
  the standard submit flow over `createManualCandidateTask`.
- **Phase 6 — portal points modes + verified styling.** The data-map
  points menu (all / period / off) on the portal map, with "period"
  keyed to the portal's target-year selector; verified-state dot
  styling. Public verified layer deferred until the first frozen
  export product ships (JB-gated).

## Point validation-status principle (JB, 2026-07-09)

Every point is UNVALIDATED until validated. No point on any project
surface may present as verified by default: OSM-snapshot dots, dated
dots, imported candidates, and pin-drops all start unvalidated, and
validation is earned only through the task workflow (RA evidence →
reviewer decision → frozen export batch for the public "verified"
tier, which stays JB-gated).

Status vocabulary for colour coding — one scale, allowing intermediate
and edge cases, to be worn by dots as a STATUS RING around the
religion-coloured (or context-grey) fill so status never competes with
the religion encoding:

1. `unvalidated` — no human decision recorded. The default. Neutral
   ring (current plain dot); never a "verified" visual.
2. `in_review` — claimed or evidence submitted, awaiting a reviewer
   decision (portal already styles task markers for this: white with
   dashed blue border).
3. `validated_present` — reviewer-accepted evidence that the site
   exists/worships at the target year(s) (portal verified swatch
   #2874a6 with double ring).
4. `validated_absent` — reviewer-accepted evidence the site does NOT
   exist (closed, demolished, never existed). An edge case the scale
   must carry: this is a validation success, not a missing point; on
   period surfaces the point drops out of its non-living years, on
   review surfaces it renders with a distinct closed-ring treatment.
5. `disputed` — open issue or unresolved note on a previously decided
   point; drops visual trust back to an intermediate treatment until
   re-reviewed.
6. `stale_validation` — validated in a prior wave but not re-confirmed
   in the current September census wave; intermediate ring so re-check
   work is visible (denominator work for wave-on-wave change rates
   depends on this state being explicit).

Ergonomics rules: status ring + fill only (no shape changes that break
at small radii); colourblind-safe ring hues distinct from the religion
palette; a legend row per status wherever statuses render; statuses map
1:1 onto task/export states already in Convex (no new UI-only states).
Implementation lands with phase 6 verified-dot styling; the public map
shows only `validated_present`/`validated_absent` from frozen exports,
never intermediate states.
