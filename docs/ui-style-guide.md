# UI Style Guide

This guide records the visible language of the current task-map interface. It
is not a complete design system. Its purpose is to keep the New Zealand pilot,
current Vanuatu workbench, and later public task surfaces from drifting into
different visual or wording conventions.

The live reference today is `apps/regions/nz/verification.html` and
`apps/regions/nz/js/verification-map.js`.

## Product Wording

- Use `＋ Add a missing place`, not `Add to map`, for user-created candidate
  intake (ruled 2026-08-29). One label serves every country, rapid entry
  included. Pair it with the helper line "Your nomination goes to human
  review — it does not change the public map.", which carries the nomination
  semantics the older `Nominate missing PoW` label expressed. Treat
  `Nominate missing PoW` as a legacy technical label where it survives in
  code or older documents.
- Use `Save draft` when the RA is still gathering evidence.
- Use `Submit for review` when the RA wants JB or a reviewer to inspect the
  evidence.
- Use `Revise submission` only after a submitted case needs correction or new
  evidence. Revisions must create a new evidence version instead of silently
  rewriting the submitted one.
- Use `No building present` when imagery or another source indicates the mapped
  building is gone or no building is visible at that location. Store this as
  `existence_status = absent` and `worship_use_status = not_worship` for
  export.
- Use `accepted for export`, not `accepted into the master`, until `pow`
  validation, diff, replay, and rebuild have happened.
- Use `not assessed` when no one checked a target year.
- Use `uncertain` when a source was checked but does not settle the question.

## Layout

The map interface has two primary regions:

- `.sidebar`: instructions, sign-in, filters, task list, session or assignment
  state, and task detail.
- `#map`: the map and spatial task markers.

The contributor portal (assignment mode) gates its sidebar behind sign-in
(ruled 2026-08-29). Signed out, the sidebar shows only the header and the
sign-in card; the map stays visible for read-only browsing. After sign-in a
chooser offers two activities — `Assigned tasks` and `Add places` — and the
sidebar then shows only the chosen activity's sections. A `← Change activity`
link returns to the chooser; the choice persists for the tab
(`sessionStorage`), so a reload lands where the contributor was.

The map offers `Streets` (OSM standard tiles), `Hybrid` (MapTiler imagery
with street and place labels), and `Satellite` (bare MapTiler imagery)
basemaps through a small pill control. Add-places mode prefers hybrid once
buildings are resolvable and switches to it when pin placement starts, so
contributors can guide the pin onto the actual building without losing
street-name orientation; a manual toggle choice wins for the rest of the
session. The imagery options hide when no MapTiler key is configured, and
the portal falls back to streets (disabling the imagery buttons) when the
key is refused or exhausted.

Assigned-task work and pure entry are separate activities (ruled
2026-08-31): the assignment sheet lists only the batch's tasks, with My work
beneath it; the contributor's own nominations open from `Revise a past
submission` on the Add places card into a teal `My past submissions` list
below the card (ruled 2026-09-04: the selected work holds the sidebar; past
work is a card button away, never a list at the top). Nominations always stay on the map — as dashed teal rings while
healthy, keeping their validation-state ring once disputed or validated —
so the duplicate check and the route back to them survive the separation.

Keep the sidebar dense but readable. This is a workbench, not a landing page.
Avoid hero copy, decorative cards, and explanatory blocks that push the task
list below the fold.

On mobile assignment mode, sign-in and task instructions should appear before
the map. The RA should not have to discover the sign-in panel below the first
viewport.

## Colour Meanings

Do not reuse these colours for unrelated meanings.

| Meaning | Current class | Current colours |
| --- | --- | --- |
| Primary action, focus, links, and the validated ring | `button.primary`, `.workflow-step.active`, links, focus outlines | the one blue `--action` `#1f618d`, hover `#17527a`, soft `#e8f1fb` (PR-H3: headings are ink, not blue) |
| Present target-year state | `.status-present`, `.workflow-step.done`, `.closed-badge` | green, `--present` `#145a32` on `--present-soft` `#dff3e6` |
| Absent target-year state | `.status-absent` | neutral grey, currently around `#e5e7eb`, `#374151` |
| Uncertain, caution, or disputed | `.status-uncertain`, `.skip-badge`, `.skip-form button.skip-confirm`, the disputed ring | the one amber pair `--caution` `#6b4e00` on `--caution-soft` `#fff4dc`, `--caution-strong` `#9a6700` for borders and the disputed ring (PR-H3, 2026-09-04) |
| Not assessed | `.status-not-assessed`; the map marker is hollow white with a `--muted` border (PR-H3) | `--not-assessed` `#1f4e79` on `--not-assessed-soft` `#e8f1fb` |
| Warning or demo-only message | `.demo-warning` | amber warning |
| Disabled or unavailable state | `.disabled-panel`, `.backend-card.disabled` | light grey |
| Recorded place on the map that an RA can revise (unvalidated dot) — marks only, never a status pill | `.legend-dot.context-dot-swatch`, `CONTEXT_DOT_COLOUR` and `CONTEXT_DOT_HALO` in `verification-map.js` | slate disc `#64748b` with a white halo, on every basemap (JB ruling R-D1, 2026-09-04, PR-H3, overriding the amber of 2026-09-02). Amber is reserved for "needs attention": uncertain, caution, disputed. |
| Pure data entry (nominations, walk-up records) — containers only, never the action button | `.portal-mode-bar.mode-add`, `.nominations-panel`, `.entry-badge`, `.task-row.entry-card`, `.pin-card-host`, `.verification-marker.vm-nomination`, `.legend-dot.vm-nomination-swatch`, `.chooser-option#chooseAddButton strong` | teal, `--entry` `#0f766e` on `--entry-soft` `#e6f4f1` (JB separation ruling, 2026-08-31) |

If these colours change, update both the CSS and this table. Since PR-H3 (2026-09-04) the three surfaces share one token system, the block in section 3 of `docs/development/ui-design-audit-2026-09-03.md`: `verification.html` and `review.html` each declare it in their `:root` (`--bg`, `--panel`, `--panel-2`, `--ink`, `--muted`, `--line`, `--control-line`, `--action*`, `--danger*`, `--caution*`, `--present*`, `--absent*`, `--not-assessed*`, `--entry*`, `--marker-unvalidated`, `--font`, `--fs-*`, `--sp-*`, `--r-*`), and the public map shell scopes its dark variant under `.map-chrome` in `apps/shared/map-shell.css`. Change a meaning by changing its variable, then update this table. Type: base 16 px in the working tools, meta and pills 14 px, nothing under 13 px; labels 600, prose 400; the system font stack everywhere, declared once. Buttons: one filled primary per row, the outline as the secondary idiom, disabled controls keep readable text (grey face, muted ink, never opacity).

## Status Components

Use pill or badge components for short machine states:

- `.status-pill`: target-year status such as `present`, `absent`, `uncertain`,
  or `not assessed`.
- `.backend-badge`: shared backend task state.
- `.skip-badge`: skipped task.
- `.closed-badge`: local tentative closure or completion cue.
- `.ra-initials`: RA initials or session count.

Do not put long explanations inside status pills. Pair a short pill with nearby
plain-language help text when the state needs explanation.

## Buttons

Use button hierarchy consistently:

- Primary filled button: main action in the current step, such as save or
  submit.
- `.secondary`: fallback or parallel action, such as spreadsheet copy.
- `.tertiary`: small supporting action, such as sign out, using OSM URL, or
  using Street View URL.
- Destructive or clearing actions should use a danger style, not the primary
  action colour.

Buttons should have at least 44 px touch height in RA-facing surfaces unless
they are small inline controls with a larger surrounding target.

## Forms

Use dropdowns for controlled vocabulary:

- target-year status,
- confidence/probability,
- source type,
- lifecycle event type,
- review status,
- action type.

For rapid current observation, use one explicit four-choice control indexed to an exact observation date: worship use confirmed; place exists but worship use uncertain; place exists but worship use not present; or status undetermined. Never let the interface or server infer worship use from physical existence alone.

Use open text only for evidence notes, source titles, addresses, and other
source-specific details. Do not ask RAs to type controlled values such as
`present`, `uncertain`, or `not_assessed` into free-text fields.

Dates should use one of:

- `YYYY`,
- `YYYY-MM`,
- `YYYY-MM-DD`.

Unknown dates should be blank, with uncertainty explained in the evidence note.

## Review And Assignment States

The task list should make these states visible:

- open,
- in progress,
- draft saved,
- needs review,
- changes requested,
- reviewed,
- exported,
- skipped,
- reopened.

Assignment batches should appear as filters over one shared task list. The UI
should not imply that each workpack is a separate database or spreadsheet.

## CSS Maintenance Rules

- Prefer reusing existing classes before adding new ones.
- Add a class when it names a reusable component or state, not when it merely
  patches one local spacing issue.
- Keep task, review, and source-state names aligned with Convex and schema
  vocabulary.
- Avoid creating a second visual meaning for the same colour.
- Keep RA-facing text visible and practical. Avoid in-app explanations of the
  system architecture unless they affect the task the RA is doing.
- Test desktop and mobile after changing sidebar, sign-in, task-list, form, or
  map layout.
