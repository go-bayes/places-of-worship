# UI Style Guide

This guide records the visible language of the current task-map interface. It
is not a complete design system. Its purpose is to keep the New Zealand pilot,
future Vanuatu workbench, and later public task surfaces from drifting into
different visual or wording conventions.

The live reference today is `apps/regions/nz/verification.html` and
`apps/regions/nz/js/verification-map.js`.

## Product Wording

- Use `Nominate missing PoW`, not `Add to map`, for user-created candidate
  intake.
- Use `Save draft` when the RA is still gathering evidence.
- Use `Submit for review` when the RA wants JB or a reviewer to inspect the
  evidence.
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
| Primary action or active focus | `button`, `.workflow-step.active`, link emphasis | blue, currently around `#1f618d` and `#e8f1fb` |
| Present target-year state | `.status-present`, `.workflow-step.done`, `.closed-badge` | green, currently around `#1e8449`, `#145a32`, `#d7f1df` |
| Absent target-year state | `.status-absent` | neutral grey, currently around `#e5e7eb`, `#374151` |
| Uncertain or skip state | `.status-uncertain`, `.skip-badge`, `.skip-form button.skip-confirm` | amber, currently around `#d68910`, `#fff3cd`, `#fff7e6` |
| Not assessed | `.status-not-assessed` | pale blue, currently around `#e8f1fb`, `#1f4e79` |
| Warning or demo-only message | `.demo-warning` | amber warning |
| Disabled or unavailable state | `.disabled-panel`, `.backend-card.disabled` | light grey |

If these colours change, update both the CSS and this table. Future work should
move repeated colours into CSS custom properties.

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
