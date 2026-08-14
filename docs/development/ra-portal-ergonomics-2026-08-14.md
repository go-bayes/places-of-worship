# RA Portal And Workbench Ergonomics Review — 2026-08-14

Status: READ-ONLY review of code and docs; no application file was modified. Scope: the NZ/country review-and-entry portal (`apps/regions/nz/verification.html` + `apps/regions/nz/js/verification-map.js`, ~5.2k lines; `review.html` + `js/review-portal.js`; `js/convex-task-client.js`) and the TypeScript workbench (`apps/workbench/src/`, localStorage-backed `DemoProvider`, Convex cutover planned but not started per `docs/development/workbench-publication-plan.md`). Lens: ergonomics for RAs and reviewers (André, Guy, university RAs) — task flow, batch throughput, error-proneness, feedback and state visibility, undo and recovery, session handling, onboarding, and portal–workbench consistency. Correctness bugs belong to the separate code review and appear here only where they cause user-facing friction.

Already-known feedback from `docs/ui-review-feedback-backlog.md` (André, 2026-08-07) is not re-reported; where a finding touches a known item, the finding builds on it and says so. The changes-requested loop from `docs/portal-ra-feedback-and-training.md` §2 items 1–2 is confirmed implemented in the portal (pinned panel, verbatim reviewer note, one-click revision, count badge), which closes what that doc called the biggest gap.

Each finding is marked **Confirmed** (behaviour read directly from the code path cited) or **Inferred** (a judgement about likely user experience that the code alone cannot settle). Findings run from most to least important.

## 1. Any re-render of the portal detail panel silently destroys unsaved form input — no dirty guard, no autosave, no beforeunload

**Confirmed.** `renderDetail` rebuilds the panel with `panel.innerHTML = ...` from scratch (`apps/regions/nz/js/verification-map.js:3294–3395`), restoring only the last *saved* draft via `applyDraftToForm` (`:3927–3929`). Nothing captures in-progress form values first, and no `beforeunload` handler exists anywhere in the portal (grep across `apps/regions/nz/`). The wipe fires from at least four everyday paths: selecting any other task or clicking any map marker (`selectTask` → `renderDetail`, `:2867–2896`); changing the target-year select mid-entry (`:2493–2495`); pressing "Refresh task list" (`:1770–1776`); and re-signing in after an expired session (`onSignedIn` → `renderDetail`, `:1735–1742`). The evidence form has roughly 24 inputs, so an RA who has typed a source title, capture date, address, lifecycle date, and evidence note, then mis-clicks a neighbouring marker or nudges the year select, loses all of it without warning and without recovery. Tab or browser refresh has the same effect. This is the single largest throughput and morale risk in the portal: on a 50-record session even a 5% mis-click rate means re-typing two or three records.

Fix sketch, in order of value: (a) a dirty flag set by the existing input listeners (`bindRaActionForm` already wires input/change on every field, `:3994–4021`) plus a `window.confirm` before `renderDetail` replaces a dirty form and a `beforeunload` guard while dirty; (b) before any programmatic re-render, snapshot `currentFormValues()` keyed by task id and reapply after rebuild — `applyDraftToForm` already shows the reapply shape; (c) a lightweight localStorage autosave per task id, cleared on successful save, restored on load. Option (b) alone removes the year-select and refresh wipes at low cost.

## 2. Save and Submit stay clickable during the async save — double-submit and duplicate-draft risk

**Confirmed.** `saveEvidenceToBackend` (`verification-map.js:4440–4545`) sets status text ("Saving and submitting...") but never disables `saveDraftButton` / `submitUnresolvedButton` / `submitReviewButton`, while every other write path in the same file does disable its button during flight (issue filing `:3125`, pin nomination `:4839`, undo skip `:3033`, revise `:3236`; the review portal also disables its submit, `review-portal.js:658–659`). A slow Convex round trip on rural or university wifi invites a second click; a second click can mint a second draft (the first save has no draft id to reuse until it returns) or double-fire the submit mutation. The RA sees no lockout cue and cannot tell whether the first click registered.

Fix sketch: disable the three buttons on entry to `saveEvidenceToBackend` and re-enable in `finally`, matching the file's own pattern elsewhere. One-line-per-button change, high protection.

## 3. Session expiry mid-entry compounds finding 1: the failed save preserves the form, but the recovery path wipes it

**Confirmed mechanism, inferred frequency.** Google identity tokens last about an hour; `convex-task-client.js` schedules a refresh 5 minutes before expiry (`:8`, `:92–102`) through the Google One Tap prompt, which browsers can suppress (third-party-cookie and quiet-notification settings), in which case the refresh rejects and the next save throws "Your sign-in expired. Sign in again, then retry." (`:243–247`). The portal then keeps the typed form on screen with the error in `copyStatus` (`verification-map.js:4537–4544`) — good. But the advertised recovery, signing in from the sidebar, runs `onSignedIn` → `refreshBackendTasks` → `renderDetail(this.selectedTask)` (`:1735–1742`), which rebuilds the form from the last saved draft and discards exactly the work the RA was trying to save. For an RA in a long session, the sequence "type for ten minutes → save fails → sign in → work gone" is the worst version of finding 1 because the RA did everything right. How often the quiet refresh fails in the RAs' actual browsers is not decidable from code.

Fix sketch: on an `authExpired` error, snapshot `currentFormValues()` for the selected task before rendering the sign-in card, and reapply after `onSignedIn` re-renders; or simply make the finding-1 snapshot-and-reapply unconditional, which covers this path for free.

## 4. Reviewer throughput: every decision ends in a round trip to the queue list, and the decision form sits below eight panels

**Confirmed.** In the review portal, recording a decision clears the selection, reloads the queue, and shows "Decision recorded. Select another submitted task." (`review-portal.js:667–671`) — the reviewer must mouse back to the list, pick the next row, wait for the two detail queries, then scroll past Task, Source, Evidence summary, Lifecycle, Target-year statuses, the AI panel, and down to the Review decision panel (`:373–480`) before acting. The RA-side portal already solved this with a post-submit "Open next task" button (`verification-map.js:3009`); the reviewer side, which is the true batch surface (Guy or JB clearing 50 submissions), lacks it. There is also no keyboard path: no shortcuts for the five decisions, and the eight-character decision-note minimum (`:622`) plus note-typing is repeated per record with no templates beyond the two quick-action buttons (`:532–548`).

Fix sketch: an "Open next in queue" button on the decision-recorded state (mirror `openNextAvailableTask`); optionally auto-select the next queue row after recording. Secondarily, pin the Review decision panel (sticky at top or bottom of the detail column) so the evidence panels scroll under it, and add two or three decision-note templates alongside the existing quick actions.

## 5. Portal and workbench teach the same RAs two conflicting vocabularies and two conflicting skip semantics

**Confirmed divergence; inferred training cost.** The two surfaces disagree wherever they overlap. Lifecycle events: the portal offers 14 wide-schema event types (`organisation_founded`, `site_opened`, `origin_not_earlier_than`, ... `verification-map.js:849–864`) with a single date + precision select; the workbench offers 8 different ones (`founding`, `opening`, `closure`, `rebuild`, ... `EvidenceForm.tsx:67–76`) with value/notEarlierThan/notLaterThan date fields. Assessment confidence: numeric `0.9/0.7/0.5` in the portal (`:718–723`) versus `high/medium/low` in the workbench (`EvidenceForm.tsx:153–170`). Source-type lists overlap but neither contains the other (`:724–741` vs `EvidenceForm.tsx:42–65`). Skip: the portal gates skip behind a disclosure with reason chips and offers Undo skip (`:3668–3687`, `:3002`, `:3025–3053`); the workbench skips on one bare click with no confirm, no reason, and no undo (`EvidenceForm.tsx:341–345`, `:505–509`) — the workbench's only single-click destructive action. An RA trained on one surface will mis-map statuses, confidences, and the cost of Skip on the other, and the divergence will harden into the Convex schema at cutover if not reconciled first.

Fix sketch: treat the staged Convex cutover as the deadline to pick one enumeration set per construct (the Convex wide-schema names are the natural winners), and port the portal's skip pattern (reason + undo) into the workbench. This is a pre-cutover alignment task, cheaper now than after both write to the same tables.

## 6. The workbench loses unsaved edits on task switch and view switch, with no guard

**Confirmed.** `EvidenceForm` is keyed by `selectedTask.taskId` (`App.tsx:270–276`), so selecting another task, or clicking "My work" / "Nominate missing PoW" / "Import batch" (each resets selection or view, `App.tsx:167–207`), unmounts the editor and discards the in-memory `draft` state; edits persist only after an explicit "Save draft" (`EvidenceForm.tsx:313–320`). As in the portal (finding 1) there is no dirty guard and no beforeunload. The blast radius is smaller — localStorage demo data, sidebar buttons rather than a mis-clickable map — but the pattern will matter more once the Convex provider lands and real work flows through it.

Fix sketch: a dirty flag in `DraftEvidenceEditor` with a confirm on unmount-causing navigation, or autosave-on-change to the provider (cheap while it is localStorage, and the right default for the Convex provider too).

## 7. My work caps at 25 items with no way to see the rest

**Confirmed; builds on the known "drafts and skipped tasks are hard to find" backlog item.** The portal's My work panel now exists and largely answers that item (status counts in the summary line, pinned Changes-requested panel: `verification-map.js:1867–1911`), but it renders only `items.slice(0, SESSION_RECENT_LIMIT)` = 25 (`:1898`, `:621`) with no "show more", no status filter, and no indication that items are hidden. André already had 43 items at the time of his email; an RA looking for a specific skipped or drafted task beyond the first 25 has no route to it, and the summary counts will disagree with the visible list. The workbench MyWork list has no cap (fine).

Fix sketch: a "Show all N" toggle mirroring the task list's "Show 80 more" pattern (`:2829–2839`), or per-status collapsible groups; either is small.

## 8. The 24-field evidence form presents every optional block flat, so each record costs a full scroll

**Confirmed layout; inferred cost.** Step 2/3 of the portal form runs action, per-year statuses, source type, existence, worship use, three confidences, provider, title, date, three address fields, four lifecycle fields, change class, URL, related ids, and the note, all expanded (`verification-map.js:3717–3907`), even though the address and lifecycle blocks are explicitly "leave blank unless relevant" and the action-driven defaults (`applyRaActionDefaults`, `:4115–4132`) mean most selects never need touching on a routine confirm. The same file already uses `<details>` for skip, issue, and history; the optional blocks do not get the same treatment. On a routine "Confirm current site" the RA still scrolls the full column to reach Save/Submit. The auto-default machinery is genuinely good ergonomics — the flat layout spends the time it saves.

Fix sketch: wrap "Address or locality", "Optional opening, closure, or later change", and "Related ids" in collapsed `<details>` (auto-open when a loaded draft carries values, and keep the existing `closureLifecycleHint` logic opening the lifecycle block when the action implies closure). No field changes, purely presentation.

## 9. "Refresh task list" still gives no feedback

**Confirmed; this is André's known backlog item, located.** The handler (`verification-map.js:1770–1776`) awaits `refreshBackendTasks` and re-renders, but on success nothing visible changes when the list content is unchanged, and the button is not disabled during flight. `refreshBackendTasks` writes `backendLastError` on failure only (`:2586–2589`). The RA cannot distinguish "worked, nothing new" from "did nothing".

Fix sketch: disable the button during flight and set a transient status ("Task list refreshed — N available, M in My work") through the existing signed-in card text.

## 10. Workbench task list is mouse-only

**Confirmed.** `TaskList.tsx:31–36` renders task rows as `div onClick` with no `role`, `tabIndex`, or key handling, so the list is unreachable by keyboard; `MyWork.tsx:33–46` got the full treatment (`role="button"`, `tabIndex`, Enter/Space). Portal task rows are real `<button>`s (fine). Beyond accessibility, this blocks the cheapest batch pattern — arrow/tab through the list — on the surface where a keyboard path would be easiest to add.

Fix sketch: copy the MyWork row pattern into TaskList, or make rows `<button>`s.

## 11. No keyboard shortcuts anywhere, on either surface

**Confirmed absence.** The only keyboard affordance in the portal is Escape to cancel pin mode (`verification-map.js:4687–4690`); the review portal and workbench have none. For the stated goal — an RA clearing 50 records in a session — the missing minimum is: a next/previous-task key, a submit key (Cmd/Ctrl+Enter from the note field), and number keys for the action/decision selects. Tab order through the portal form is workable because the controls are native elements, but every task transition requires the mouse.

Fix sketch: start with Cmd/Ctrl+Enter → Submit for review (portal) / Record review decision (review portal), and `n` → Open next task on the confirmation pane; measure before adding more.

## 12. Onboarding is in decent shape; residual gaps are small

**Confirmed state.** The assignment flow numbers its stages ("1. Sign in to start" → "Signed in. Choose a task below.", `verification-map.js:1721`, `:1761`), the sign-in card names the invited account when the link carries `?email=` (`:1724–1726`), the collapsed quickstart links the step-by-step Guide (`:2426–2443`), both pages carry a Guide nav link (`verification.html:1481`, `review.html:374`), and every degraded state (backend unconfigured, task not seeded, signed out) explains itself and names the fix. A new invited RA can plausibly start unaided, which answers the onboarding question. Residual gaps: the demo-mode initials `window.prompt` at load (`:1664`) is abrupt and lost if dismissed-by-blocker (demo only, low stakes); the known backlog item "highlight the Guide button for new reviewers" remains open — the review page's Guide link is one of three undifferentiated nav links; and the workbench's "Import batch (curator)" button shows for every visitor with nothing marking it as not-for-RAs beyond the parenthesis (`App.tsx:198–207`), a wrong-turn invitation that role gating will fix at cutover.

## Notes on what already works well

Worth preserving through any refactor: action-driven defaulting with touch-tracking so RA-typed text is never overwritten (`verification-map.js:4115–4152`, `:3985–3992`); explicit "Nothing was saved" phrasing on every failed write; the undo-skip and post-submit "Open next task" confirmation pane with its active-filter hint (`:2987–3023`); the changes-requested pinned panel with the reviewer's verbatim note and one-click revision (`:1916–1984`); server-side My work making assignment-mode progress refresh-proof; the zoom-gated, proximity-checked pin-drop flow; and the review portal's decision hints and agreement-provenance handling around the AI recommendation (`review-portal.js:139–156`, `:489–513`).
