# UI Style Guide

This guide records the visible language of the current task-map interface. It
is not a complete design system. Its purpose is to keep the New Zealand pilot,
current Vanuatu workbench, and later public task surfaces from drifting into
different visual or wording conventions.

The live reference today is `apps/regions/nz/verification.html` and
`apps/regions/nz/js/verification-map.js`.

Approved by Joseph B on 2026-09-21 ("approve the style guide"), with dark as
the one theme and the token values in the Theme table as they stand. A change
to a ruled meaning, a value or a wording rule after this date is a new ruling
and is dated in place.

## Product Wording

- Use `Add / Revise` for the one intake control on the contributor portal
  (ruled 2026-09-20: "ADD/REVISE the only button on the phone"; it
  supersedes `＋ Add a missing place`, ruled 2026-08-29). One label serves
  every country. With a dot selected on the map the button revises that
  place; otherwise it drops a pin. The one-line hint under it says which
  ("Revises St Mary's." or "Drops a pin for a new place. Hold on the map
  (double-click on a computer) to add one there; tap a dot to revise
  it."). The map carries the same two intents as gestures (ruled
  2026-09-22: "hit a dot on the map and press, you automatically get
  edit; press longer on the map, you automatically get add; double click
  on desktop"): signed in, a tap on a recorded dot opens the revise entry
  on that record with no popup between (the popup remains signed out,
  with a pin armed, and where the rapid lane cannot take the record); a
  held touch on the map, a double click or a right click on a computer,
  opens the add entry with the pin already on that spot, and on a dot the
  press belongs to the dot. The double click no longer zooms; the buttons,
  the wheel and the pinch do. While an entry is open the same button reads
  `Cancel` in the danger outline and is the way out on every screen, since
  a phone has no Escape key; the copy never says "Esc". Treat
  `Nominate missing PoW` and `Add a missing place` as legacy labels where
  they survive in code or older documents.
- Use `Take photo or add files` for the one file control, in front of the
  hidden native input (a phone then offers its camera); the chosen count
  reads beside it. Never show a bare `Choose Files` input.
- Use `Quick photo` for the camera-first shortcut under `Add / Revise`
  (ruled 2026-09-22: "a quick photo entry button, where a user snaps a
  shot of a possible PoW for further review"). It is the third button of
  the same size, outlined, shown only signed in, in `Add / Revise`, with
  attachment storage wired and no entry open. Its card is headed `Quick
  photo`; `Send for review` is its one filled button, `Drop the pin
  instead` appears only when no position was found, and `Cancel` sits
  beside them. Its two text fields are `Place name, if you know it` and
  `Note for the reviewer`, never one field for both: a name is identity
  data and a note is commentary. A recorded place near the fix is named
  on the card before the first send goes through. The entry it sends is a flagged partial entry, so the
  review queue shows it as `Note to resolve`, never as a complete
  observation.
  The button is filled in the entry teal (`--entry`), the one filled
  button besides `Add / Revise` in the sidebar (ruled 2026-09-23: "make
  the QUICK PHOTO tab easy to see"); it borrows no state colour.
- Entry follows the pin (ruled 2026-09-23). The page names the country
  the contributor landed on; the entry's country is the pin's. When they
  differ the entry carries one note, never a block: "This pin is in
  New Zealand; this page opened for Sweden. The entry is recorded as
  New Zealand.", and the header reads "Sweden evidence · entry in
  New Zealand" while the entry is open. A neighbour's dot reads "In
  Norway: revising it here records it as Norway." and revises in place.
  Never send the contributor to another portal to record a place.
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
carries the line `Sign in with Google or an email code.`, Clerk's sign-in
form in the portal's dark tokens with 44 px controls, a `Contact to join`
button and the folded `Which address?` help, nothing else (ruled 2026-09-19:
fewer words; the Clerk form and its copy replace the Google button and the
`Wrong account showing?` help under the contributor-access brief's C1,
2026-09-24). A signed-in address the project has not admitted sees the
address, one line saying it has no project access and a `Sign out` button,
never the portal; the
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
there is no move button. Once the pin is down the confirm card carries one
outlined link, `Check Street View at the pin` (`.pin-check-link`, 44 px),
which opens Google Street View there in a new tab (JB, 2026-09-21). A held touch on the pin (a held mouse button or a right click on a computer) opens the pin's own menu (JB, 2026-09-22: "once a pin is dropped, say by accident, how can we remove it", and the card's `Cancel placement` can sit below the fold on a tall entry pane): before the location is confirmed, `Remove pin` lifts the pin and keeps the entry armed for another drop, and `Cancel placement` leaves the entry; once confirmed the menu offers `Discard this entry`, which asks first.
Choosing `I can only place an area`, or another radius, fits the whole
uncertainty circle into the map, once, so the distance reads on the map; a
drag or a zoom of the same area leaves the view alone. The `Flag for discussion` checkbox carries its
label alone; the field that opens takes the description. The Map data panel
offers one toggle, `Hide points` / `Show points` (ruled 2026-09-20: the
on/off select and the note about the target year were artefacts); today's
places show by default and the legend names them `place on today's map,
tap to revise`. The dots paint on canvas tiles, never as DOM paths (the
overview tiles of a phone's viewport at country scale carried 317,000
places across Europe, 7,500 of them in Sweden, and iOS Safari killed the
page on the first pinch, 2026-09-22); at zooms 5 to 7 only the portal's
own country draws, and from zoom 8 every place, a neighbour's dot with
its own portal named in the popup.

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

The split between sidebar and map is the user's (ruled 2026-09-19: the map's size should be adjustable, and a portrait monitor must work). Side by side, the bar between the panes drags the sidebar width from 320 px to six tenths of the window; a double click returns it to 420 px, Left and Right arrows step it, Home resets it, and the device remembers the width. On a narrow screen or any portrait screen the panes stack: the same bar drags the split to one of three positions (mostly map, half, mostly entry), a `⇅ Swap` button on the bar puts the other pane on top, and the device remembers both. The stacked layout keeps two-column forms and the map legend on a portrait monitor; only a phone width (700 px and under) collapses them. The review portal carries the same idiom (JB, 2026-09-21: "we need the sliders on the review panel"): side by side, the bar between the queue and the detail drags the queue width from 320 px to six tenths of the window (default 390 px), and the bar under the map drags the map's height from 200 px to nine tenths of the window on every screen, phone included (default 440 px, 300 px on a phone). Arrows step, Home and a double click reset, and the device remembers both. Stacked, the page scrolls, so the column bar is hidden and only the map bar remains. Each bar also carries three named positions (R-U7, applied 2026-09-21: "a drag bar alone is easy to miss"): on the RA portal `More map`, `Even`, `More form`, which stacked are the three detents and side by side are the narrowest sidebar, half the window and the widest sidebar; on the review portal `More queue`, `Even`, `More detail` on the column bar and `More map`, `Even`, `More cards` on the map bar. The position in force is pressed; a dragged position between presets presses none; a preset is remembered like a drag. On a phone width the grip keeps its handle and drops its words, since the presets carry them.

Keep the sidebar dense but readable. This is a workbench, not a landing page.
Avoid hero copy, decorative cards, and explanatory blocks that push the task
list below the fold.

On mobile assignment mode, sign-in and task instructions should appear before
the map. The RA should not have to discover the sign-in panel below the first
viewport.

## Colour Meanings

Do not reuse these colours for unrelated meanings.

| Meaning | Current class | Current colours (the dark set; light values in the Theme table) |
| --- | --- | --- |
| Primary action, focus, links, and the validated ring | `button.primary`, `.workflow-step.active`, links, focus outlines | the one blue `--action` `#7fb3e6`, hover `#93c1ec`, soft `#1b3550` (PR-H3: headings are ink, not blue) |
| Present target-year state | `.status-present`, `.workflow-step.done`, `.closed-badge` | green, `--present` `#6fcf97` on `--present-soft` `#163a26` |
| Absent target-year state | `.status-absent` | neutral grey, `--absent` `#b8c2d0` on `--absent-soft` `#2c3a48` |
| Uncertain, caution, or disputed | `.status-uncertain`, `.skip-badge`, `.skip-form button.skip-confirm`, the disputed ring | the one amber pair `--caution` `#f2c14e` on `--caution-soft` `#3f3110`, `--caution-strong` `#e0a800` for borders and the disputed ring (PR-H3, 2026-09-04) |
| Not assessed | `.status-not-assessed`; the map marker is hollow white with a `--muted` border (PR-H3) | `--not-assessed` `#8fb8e0` on `--not-assessed-soft` `#1b3550` |
| Warning or demo-only message | `.demo-warning` | amber warning |
| Disabled or unavailable state | `.disabled-panel`, `.backend-card.disabled` | light grey |
| Unreviewed place on the map (an open case an RA can revise) — marks only, never a status pill | `.legend-dot.context-dot-swatch`, `--marker-unvalidated`, the `vm-unvalidated` ring on task markers, `COLOUR` and `HALO` in `js/unvalidated-places.js` (shared by the RA and review portals) | amber disc `#f59e0b` with a white halo, on every basemap (JB ruling R-D1′, 2026-09-04 afternoon: "any PoW that has not been reviewed should be in amber; all cases are open", overriding the morning's slate R-D1). Every place no reviewer has confirmed is an open case and wears this amber; the darker `--caution-strong` stays for uncertain, caution, and the disputed ring. |
| Pure data entry (nominations, walk-up records) — containers only, never the action button | `.portal-mode-bar.mode-add`, `.nominations-panel`, `.entry-badge`, `.task-row.entry-card`, `.pin-card-host`, `.verification-marker.vm-nomination`, `.legend-dot.vm-nomination-swatch`, `.chooser-option#chooseAddButton strong` | teal, `--entry` `#5fd3c4` on `--entry-soft` `#123a36` (JB separation ruling, 2026-08-31) |

If these colours change, update both the CSS and this table. Since PR-H3 (2026-09-04) the three surfaces share one token system, the block in section 3 of `docs/development/ui-design-audit-2026-09-03.md`: `verification.html` and `review.html` each declare it in their `:root` (`--bg`, `--panel`, `--panel-2`, `--ink`, `--muted`, `--line`, `--control-line`, `--action*`, `--danger*`, `--caution*`, `--present*`, `--absent*`, `--not-assessed*`, `--entry*`, `--marker-unvalidated`, `--font`, `--fs-*`, `--sp-*`, `--r-*`), and the public map shell scopes its dark variant under `.map-chrome` in `apps/shared/map-shell.css`. Change a meaning by changing its variable, then update this table. Type: base 16 px in the working tools, labels, meta and pills 15 px (`--fs-sm`, raised from 14 px under R-U6 on 2026-09-21), the small register 14 px (`--fs-xs`), chart labels 13 px, nothing under 13 px; labels 600, prose 400; the system font stack everywhere, declared once. Buttons: one filled primary per row, the outline as the secondary idiom, disabled controls keep readable text (grey face, muted ink, never opacity).

## Theme

Both portals share one token sheet, `apps/regions/_shared/theme.css`, and dark is the one theme (JB, 2026-09-21: "the dark theme is beautiful. can we simply make that default with no options?"). This supersedes the three-state control of R-U2 (2026-09-19): there is no Auto, Light or Dark button, no stored choice, and no light set in the sheet; the light values stay in the table below as the record of what the pages carried. The meanings are ruled and the dark values are approved (JB, 2026-09-21); every later value change goes through this table as a dated ruling. `apps/regions/_shared/theme.js` runs in `<head>` before the stylesheets and marks `<html>` with `data-theme="dark"` and `data-theme-effective="dark"` before paint; `PowTheme.get()`, `effective()` and `set()` all answer `dark`, so callers keep their shape. The Streets basemap is MapTiler's `streets-v2-dark` raster where a key ships and the OpenStreetMap tiles under a CSS filter otherwise (`.streets-tiles-filtered`); Hybrid and Satellite are never darkened (R-U3: darkened imagery misreads buildings). Marker halos use `--marker-halo` (white on every surface), never `--panel`. Shadows and veils are tokens too (`--shade-*`, `--veil`, `--action-glow`, `--present-glow`); no `rgba()` literal remains in either page.

| Token | Light (retired 2026-09-21, record only) | Dark (approved 2026-09-21) |
| --- | --- | --- |
| `--bg` | `#f4f6f8` | `#0f1620` |
| `--panel` | `#ffffff` | `#17202a` |
| `--panel-2` | `#f3f6f9` | `#1e2a36` |
| `--ink` | `#17202a` | `#e8edf3` |
| `--muted` | `#5b6776` | `#a7b3c2` |
| `--line` | `#cfd6df` | `#2c3a48` |
| `--control-line` | `#8a94a3` | `#5b6b7d` |
| `--action` | `#1f618d` | `#7fb3e6` |
| `--action-hover` | `#17527a` | `#93c1ec` |
| `--action-soft` | `#e8f1fb` | `#1b3550` |
| `--danger` | `#b42318` | `#f28b82` |
| `--danger-soft` | `#fee4e2` | `#4a1f1c` |
| `--caution` | `#6b4e00` | `#f2c14e` |
| `--caution-soft` | `#fff4dc` | `#3f3110` |
| `--caution-strong` | `#9a6700` | `#e0a800` |
| `--present` | `#145a32` | `#6fcf97` |
| `--present-soft` | `#dff3e6` | `#163a26` |
| `--absent` | `#374151` | `#b8c2d0` |
| `--absent-soft` | `#e5e7eb` | `#2c3a48` |
| `--not-assessed` | `#1f4e79` | `#8fb8e0` |
| `--not-assessed-soft` | `#e8f1fb` | `#1b3550` |
| `--entry` | `#0f766e` | `#5fd3c4` |
| `--entry-soft` | `#e6f4f1` | `#123a36` |
| `--stale` | `#7d3c98` | `#c69ae0` |
| `--marker-unvalidated` | `#f59e0b` | `#f59e0b` |
| `--marker-halo` | `#ffffff` | `#ffffff` |
| `--shade-soft` | `rgba(15, 23, 42, 0.12)` | `rgba(0, 0, 0, 0.35)` |
| `--shade` | `rgba(15, 23, 42, 0.25)` | `rgba(0, 0, 0, 0.5)` |
| `--shade-deep` | `rgba(15, 23, 42, 0.35)` | `rgba(0, 0, 0, 0.6)` |
| `--shade-ink` | `rgba(0, 0, 0, 0.45)` | `rgba(0, 0, 0, 0.6)` |
| `--shade-ink-deep` | `rgba(0, 0, 0, 0.7)` | `rgba(0, 0, 0, 0.8)` |
| `--veil` | `rgba(255, 255, 255, 0.94)` | `rgba(23, 32, 42, 0.92)` |
| `--action-glow` | `rgba(31, 97, 141, 0.18)` | `rgba(127, 179, 230, 0.25)` |
| `--present-glow` | `rgba(22, 101, 52, 0.16)` | `rgba(111, 207, 151, 0.2)` |

Contrast (WCAG relative luminance) on the pairs the pages actually draw; the Dark column is the live one. Body text needs 4.5:1, large or bold text and control boundaries 3:1.

| Pair (foreground on surface) | Light | Dark |
| --- | --- | --- |
| `--ink` on `--panel` | 16.5:1 | 14.0:1 |
| `--muted` on `--panel` | 5.8:1 | 7.7:1 |
| `--muted` on `--panel-2` | 5.3:1 | 6.9:1 |
| `--action` on `--panel` | 6.7:1 | 7.4:1 |
| `--panel` on `--action` | 6.7:1 | 7.4:1 |
| `--danger` on `--panel` | 6.6:1 | 6.9:1 |
| `--caution` on `--panel` | 7.7:1 | 9.8:1 |
| `--panel` on `--caution-strong` | 4.9:1 | 7.7:1 |
| `--present` on `--panel` | 8.3:1 | 8.7:1 |
| `--entry` on `--panel` | 5.5:1 | 9.1:1 |
| `--not-assessed` on `--panel` | 8.7:1 | 7.9:1 |
| `--absent` on `--panel` | 10.3:1 | 9.1:1 |
| `--ink` on `--bg` | 15.2:1 | 15.4:1 |

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

One convention on both portals (R-U6, applied 2026-09-21): an unclassed `button` is the outline, `.primary` is the one filled button in its row, and the review portal's `.secondary` survives only as a retired alias of the unclassed outline so older markup keeps its look. Use the hierarchy consistently:

- `.primary`, filled: the main action in the current step, such as save, submit, Record decision, Accept for export, Confirm.
- Unclassed, outline: a fallback or parallel action, such as spreadsheet copy, Refresh, Request changes, Claim for review.
- `.tertiary`: a small supporting action, such as sign out, a quick-fill chip, or an attachment view, at 40 px on both pages.
- Destructive or clearing actions use a danger style, not the primary colour. `Cancel` on the open entry is the primary control's own slot in the danger outline (`.primary-action.cancelling`), full width and 48 px, never a keyboard-only exit.

Targets (R-U6): every control on a first-time RA's path is at least 44 px tall (Search, the search results, Move pin, Refresh task list, Sign out, the Streets / Hybrid / Satellite toggle, the locate button, the decision menu, the review page's inputs, the derived-year buttons). Secondary inline controls sit at 40 px (`.tertiary`, `.link-button`, skip chips, the session and attachment rows, the points select, every disclosure summary, the legend grip and fold). A native `select` takes its 44 px (40 px for the points select) as an explicit `height`, because Safari ignores an author's padding and min-height on a select. The one exception the ruling allows: popup links stay at 36 px where the popup's own width would otherwise break (`.popup-link`, `.popup-report-issue`); the popup's primary revise entry is 44 px. The drag bars draw at 18 px wide (28 px tall when stacked) and take the pointer across 44 px through a pseudo-element, so the drawn bar and the hit area are two numbers. Focus rings are 3 px on both pages.

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
