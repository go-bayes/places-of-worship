# RA portal walkthrough, 2026-09-04 (phone): JB's two findings and their fixes

Status: BUILT 2026-09-04 on `feat/phone-walkthrough-focus-2026-09-04`. JB walked the NZ portal on religionmap.org on his phone, signed in, the first pass on a real device after PR-H3 (#82). The page is shared by the NZ and VU portals (`apps/regions/vu/verification.html` redirects into `nz/verification.html?country=vu`), so one change covers both.

## 1. JB's findings, verbatim

1. "the unvalidated period/ validated all/ validated off panel at the bottom gets buried, it should be moveable."
2. "i'd thought we'd repaired it that when why click add /revise a place your tasklist would not appear. That task list should be on the assigned list option. Although if we want to allow RAs to return to their previously submitted add/revise work (on both portals) -- this makes sense, but i don't think it should appear at the top of the left bar, as this could be distracting. The principle: focus on the work that was selected. use card buttons to exit, leave, cancel, or revise past submissions."

## 2. What was reproduced

Finding 1, in code: the points control is a Leaflet `bottomleft` control on a map that, on a phone in assignment mode, is the lower half of the screen (`grid-template-rows: minmax(0, 50vh) 50vh`). The bottom-left corner of the viewport is where the phone browser draws its own toolbar, and the control had no way to leave the corner.

Finding 2, in code: `body.assignment-mode.portal-add #taskList` was already hidden (the 2026-09-03 walkthrough), but two panels above the Add places card were not: `#sessionPanel`, which in add mode still rendered the whole **My work** list (the assigned batch's saved, submitted, skipped, and reviewed tasks, open by default when non-empty) because it also carried the changes-requested alerts, and `#nominationsPanel` (**My nominations**), which sat between the pin cards and the card. On a phone the sidebar is 50vh tall, so both lists pushed the Add places card and its guidance below the fold. What JB read as "your tasklist" is My work, with My nominations beneath it.

## 3. What changed

1. **A movable points control.** The control carries a grip bar (`⠿ move`). Pointer events drag it by touch or mouse; the control keeps its Leaflet corner and carries the offset as a transform, clamped on release so it never leaves the map; a map resize (rotation, keyboard) re-clamps it; a double tap on the grip sends it home; the offset is kept on the device (`localStorage["pow-points-control-offset"]`). `makeControlMovable(div, grip)` in `verification-map.js`; the grip's `touch-action: none` keeps the page from scrolling instead.
2. **The selected work holds the sidebar in Add or revise.** `renderMyWorkPanel` in add mode renders only a bounced nomination's changes-requested alert (the reviewer's note must still reach the RA); the My work list is the Assigned tasks activity's. `#nominationsPanel` moved below `#detailPanel` and is hidden until the Add places card's `Revise a past submission (n)` button opens it (`setPastSubmissionsOpen`); the heading reads `My past submissions (n)` with a `Hide` link; changing activity closes it; the card says `No past submissions yet.` when there are none. The signed-in line counts past submissions rather than My work in add mode. The `Show task list` link on the signed-in line leaves add mode (`body.portal-add .backend-card .entry-only { display: none }`): the card's own buttons (Back to map, Discard this entry, Cancel placement, Back to the map) are the way out. An empty session panel no longer draws a bordered strip (`.session-panel:empty`).

## 4. Ruling recorded

- **R-W3 The selected work holds the sidebar.** After a contributor chooses an activity, the sidebar shows that activity's work and nothing that competes with it at the top. The way to exit, leave, cancel, or revise past submissions is a button on the card, not a list above it. My work belongs to Assigned tasks; past nominations and revisions open from the Add places card. (JB, 2026-09-04, phone walkthrough.)

## 5. Verification

- `node apps/regions/nz/js/*.test.cjs`: twelve files passing, including the new `phone-walkthrough-dom.test.cjs` (add mode renders no My work list and keeps the bounced nomination's alert; the assigned activity keeps My work; the card button counts and opens past submissions, Hide closes them, changing activity closes them; the signed-in line counts past submissions; the grip drags, clamps at the map edge, re-clamps on resize, remembers the spot, and a double tap resets).
- `node --check` on `verification-map.js`; `git diff --check` clean.
- Owed: JB's re-walk on the phone (the real toolbar, the real thumb). The desktop check in Chrome is recorded in the PR.
