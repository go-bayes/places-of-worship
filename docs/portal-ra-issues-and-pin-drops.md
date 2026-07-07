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
