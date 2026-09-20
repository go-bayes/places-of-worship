# UI Style Guide

This guide records the visible language of the current task-map interface. It
is not a complete design system. Its purpose is to keep the New Zealand pilot,
current Vanuatu workbench, and later public task surfaces from drifting into
different visual or wording conventions.

The live reference today is `apps/regions/nz/verification.html` and
`apps/regions/nz/js/verification-map.js`.

## Product Wording

- Use `Add / Revise` for the one intake control on the contributor portal
  (ruled 2026-09-20: "ADD/REVISE the only button on the phone"; it
  supersedes `＋ Add a missing place`, ruled 2026-08-29). One label serves
  every country. With a dot selected on the map the button revises that
  place; otherwise it drops a pin. The one-line hint under it says which
  ("Revises St Mary's." or "Drops a pin for a new place. Tap a dot first
  to revise that place."). While an entry is open the same button reads
  `Cancel` in the danger outline and is the way out on every screen, since
  a phone has no Escape key; the copy never says "Esc". Treat
  `Nominate missing PoW` and `Add a missing place` as legacy labels where
  they survive in code or older documents.
- Use `Take photo or add files` for the one file control, in front of the
  hidden native input (a phone then offers its camera); the chosen count
  reads beside it. Never show a bare `Choose Files` input.
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
(ruled 2026-08-29). Signed out, the header and the sign-in card float over
the map as one panel at the top left, and the map fills the screen for
read-only browsing (ruled 2026-09-19: "float it"); the zoom and locate
buttons step aside to the panel's right; the panel drags by the grip in
its header and the device remembers the spot. On a phone (700 px and
under) the card is a strip above the map instead, so nothing covers the
map's own controls. After sign-in the sidebar returns with the work. The
marker legend reads in two columns, fills beside rings, so the map data
panel stays clear of the floating card. The sign-in card
carries the Google button, a `Contact to join` button and the folded `Wrong
account showing?` help, nothing else (ruled 2026-09-19: fewer words); the
header carries only the title and the `Exit` and `Guide` buttons, at body
size on a 44 px target, with no batch line (ruled 2026-09-20: words to cut);
the invited address shows only when the link carries it. After sign-in the
portal lands in `Add / Revise` on every screen, with the task list, filters
and counts absent (ruled 2026-09-20: the task list is specialist assignment
work, most of which goes to agents or through the review portal).
`Add / Revise`, `Cancel` and `Assigned tasks` share one size (56 px, `--fs-lg`);
`Assigned tasks` appears under the control only while the batch holds work
for the contributor (tasks open to them or work of theirs in progress) and
opens that sheet, whose bar offers `← Add / Revise`; the choice persists for
the tab (`sessionStorage`), so a reload lands where the contributor was. The
chooser no longer renders. The pin card heads with `Add a place` (or
`Revise …`) at `--fs-xl` and three full-width options: `Drop pin at my
location`, `Drop pin on map`, `Search and drop` (which folds open the
address search and the coordinate boxes); a pin already down reads `Move
pin`. Typed coordinates apply on change and the pin drags on the map, so
there is no move button. The `Flag for discussion` checkbox carries its
label alone; the field that opens takes the description.

The map offers `Streets` (OSM standard tiles), `Hybrid` (MapTiler imagery
with street and place labels), and `Satellite` (bare MapTiler imagery)
basemaps through a small pill control. The map lands on `Hybrid` wherever
imagery is configured (ruled 2026-09-19) and returns there when an activity
ends; pin placement lifts a streets map to hybrid so the pin can be guided
onto the actual building without losing street-name orientation; a manual
toggle choice wins for the rest of the session. The map data panel (the
unreviewed-places switch and the marker legend) keeps its drag grip and
folds to its `Map data` bar; both the spot and the fold are remembered on
the device. The imagery options hide when no MapTiler key is configured, and
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

The split between sidebar and map is the user's (ruled 2026-09-19: the map's size should be adjustable, and a portrait monitor must work). Side by side, the bar between the panes drags the sidebar width from 320 px to six tenths of the window; a double click returns it to 420 px, Left and Right arrows step it, Home resets it, and the device remembers the width. On a narrow screen or any portrait screen the panes stack: the same bar drags the split to one of three positions (mostly map, half, mostly entry), a `⇅ Swap` button on the bar puts the other pane on top, and the device remembers both. The stacked layout keeps two-column forms and the map legend on a portrait monitor; only a phone width (700 px and under) collapses them.

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
| Unreviewed place on the map (an open case an RA can revise) — marks only, never a status pill | `.legend-dot.context-dot-swatch`, `--marker-unvalidated`, the `vm-unvalidated` ring on task markers, `COLOUR` and `HALO` in `js/unvalidated-places.js` (shared by the RA and review portals) | amber disc `#f59e0b` with a white halo, on every basemap (JB ruling R-D1′, 2026-09-04 afternoon: "any PoW that has not been reviewed should be in amber; all cases are open", overriding the morning's slate R-D1). Every place no reviewer has confirmed is an open case and wears this amber; the darker `--caution-strong` stays for uncertain, caution, and the disputed ring. |
| Pure data entry (nominations, walk-up records) — containers only, never the action button | `.portal-mode-bar.mode-add`, `.nominations-panel`, `.entry-badge`, `.task-row.entry-card`, `.pin-card-host`, `.verification-marker.vm-nomination`, `.legend-dot.vm-nomination-swatch`, `.chooser-option#chooseAddButton strong` | teal, `--entry` `#0f766e` on `--entry-soft` `#e6f4f1` (JB separation ruling, 2026-08-31) |

If these colours change, update both the CSS and this table. Since PR-H3 (2026-09-04) the three surfaces share one token system, the block in section 3 of `docs/development/ui-design-audit-2026-09-03.md`: `verification.html` and `review.html` each declare it in their `:root` (`--bg`, `--panel`, `--panel-2`, `--ink`, `--muted`, `--line`, `--control-line`, `--action*`, `--danger*`, `--caution*`, `--present*`, `--absent*`, `--not-assessed*`, `--entry*`, `--marker-unvalidated`, `--font`, `--fs-*`, `--sp-*`, `--r-*`), and the public map shell scopes its dark variant under `.map-chrome` in `apps/shared/map-shell.css`. Change a meaning by changing its variable, then update this table. Type: base 16 px in the working tools, meta and pills 14 px, nothing under 13 px; labels 600, prose 400; the system font stack everywhere, declared once. Buttons: one filled primary per row, the outline as the secondary idiom, disabled controls keep readable text (grey face, muted ink, never opacity).

## Status Components

Use pill or badge components for short machine states:

- `.state-pill` with a `tone-*` class: the task's state for the current viewer, from `PowTaskPresentation.present()` (one per row, first in the row).
- `.status-pill`: target-year status such as `present`, `absent`, `uncertain`,
  or `not assessed`.
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
  action colour. `Cancel` on the open entry is the primary control's own
  slot in the danger outline (`.primary-action.cancelling`), full width and
  48 px, never a keyboard-only exit.

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

Unknown dates should be blank, with uncertainty explained in the evidence note. A bare year is an acceptable entry (Joseph, 2026-09-19).

## Review And Assignment States

One pure function decides how a task's state is shown (Joseph, 2026-09-19, after the T3 Code survey): `apps/regions/nz/js/task-presentation.js`, `PowTaskPresentation.present(task, { viewer })`, returns the label, the tone, the precedence and the next action for the RA portal, the review portal and any batch rollup. The status values stay the server contract in `convex/model.ts`; the presentation never changes a transition.

Colour is reserved for three meanings, and every other state is uncoloured:

| Tone | Meaning | Class | Colours |
| --- | --- | --- | --- |
| act | the viewer must do something now | `.state-pill.tone-act` | the amber triad (`--caution*`), the open-case colour |
| motion | the viewer's own work is in hand | `.state-pill.tone-motion` | the action blue (`--action`, `--action-soft`) |
| broken | refused, rejected, or failed | `.state-pill.tone-broken` | the danger pair (`--danger*`) |
| rest | nothing for this viewer to do now | `.state-pill.tone-rest` | muted ink on transparent, `--line` border |
| done | a terminal state | `.state-pill.tone-done` | as rest, dashed border and a check; `pi_accepted` and `exported` are absorbing, so a later stale read never moves a task back out of them |

Labels per viewer, in precedence order (highest first). The RA sees: Changes requested (act), Reopened (act), Revision draft saved / In progress / Draft saved (motion), Open (rest), Awaiting review / Note awaiting review (rest), Provisionally closed / Skipped (rest), Reviewed or the decision's own word, Rejected (broken), Duplicate, Deferred, Accepted by reviewer (done), Accepted, Exported (done). The reviewer sees: Needs review / Note to resolve (act), Provisionally closed (act), With the contributor / In hand (rest), Skipped (rest), Reviewed / Awaiting PI / Rejected / Duplicate / Deferred, Accepted, Exported (done). A rollup for a batch or a queue takes the most urgent tone and counts only the rows in that tone: "2 need your action", "3 in hand", "1 awaiting review", "All done", "Nothing here".

The actionable state is the control: where `present()` returns an action, the pill is a `button.state-pill` that opens the task (RA list, My work). On the review portal the two primary outcomes, Accept for export and Request changes, stand as buttons; Duplicate, Defer, Reject and Exclude as system test sit behind one "More outcomes" disclosure. A stale-snapshot refusal, a snapshot that failed to load, or a refusal of unknown cause is a `.state-banner` that carries the reason and one control (Reload again, Retry); it never closes the case silently.

Transport is the other axis: whether the page can talk to the backend. It is shown as `.transport-dot` by the account name (Connected, Loading, Saving, Signed out, Offline, Connection problem) and never as a task pill.

Empty states are one line and at most one action, in `.state-empty`: "No tasks match your filters" with Clear filters; "Nothing in this queue" with Refresh; "Select a task from the queue" with none.

Assignment batches should appear as filters over one shared task list. The UI
should not imply that each workpack is a separate database or spreadsheet.
Confirmed by Joseph on 2026-09-19.

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

These rules were confirmed by Joseph on 2026-09-19.
