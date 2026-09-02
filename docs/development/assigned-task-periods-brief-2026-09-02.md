# PR-E build brief — census-year states derived from the periods entry on assigned tasks (2026-09-02)

Status: build spec, drafted at JB's request on 2026-09-02 (evening). Implements the intent JB restated the same day: on assigned tasks the RA records when a place of worship was in use, the census-year states are derived from that record, and the RA is guided to declare any gap (a closure, a demolition, a rebuild) rather than let a period span it. Builds on the occupancy lane (`occupancy-build-brief-2026-09-02.md`, PR-B′) and the ruled plan (`docs/portal-location-and-occupancy-plan.md`). Nothing here changes who writes a census-year state: the RA's periods produce proposals, a reviewer confirms, exactly as ruled.

## 1. The problem

On an assigned New Zealand task the guided form still asks the RA to set a status and a confidence for 2013, 2018, and 2023 by hand in the year grid (`targetYearStatusControlsHtml`), while the periods pane ("Where and when was this place used for worship?") appears only after submission, beside "Add known history". An RA who does both enters the same fact twice in two vocabularies, and one who does only the grid gives the engine nothing to derive from. The periods are the richer record: they carry the bounds, the basis, and the location, and the server already turns them into per-year proposals with the rule named (rules 1–10, L1–L5).

## 2. What ships

1. **Periods become the temporal entry on assigned tasks.** The guided form's step "What do the target years show?" is replaced by the period cards (the same cards as the post-submission pane, rendered inline in the form). The year grid is kept, collapsed, under the detailed form (`?detailed=1`) as the fallback for a case the periods cannot express, with a one-line reason field when it is used.
2. **Derived preview under the cards.** As the RA edits, a read-only strip states what the periods will propose: "From your periods: 2013 present (inside the period), 2018 absent (after the stated closure), 2023 present". This needs the presence rules mirrored client-side: `occupancy-contract.js` gains `derivePresence` (a verbatim port of `presenceForSegment`, `combinePresence`, and `derivePresence` from `convex/lib/occupancies.ts`), with a tie test that runs one fixture set through both and requires identical output, as `wideEvidenceFields` and `date-floor` already do. Location rules are not previewed; the reviewer panel shows them.
3. **Gap prompt.** After the first card is saved the form asks once: "Was there any spell when no worship happened here — a closure, a demolition, a rebuild? Record it as separate periods, not one long one." Answering "yes" opens the next card with the end reason of the first pre-selected to `closed` / `demolished` (the RA picks) and the start of the second empty. Answering "no" or "not sure" records nothing extra; "not sure" adds a suggested uncertainty note to the period ("gap possible, not established").
4. **One submission.** The periods are held in the device draft with the rest of the form. On submit the client sends the parent evidence first (unchanged mutation), then `submitOccupancies` against the new parent, as it already does from the post-submission pane. If the second call fails the pane stays open with the cards loaded and the parent stands, which is today's behaviour for a pane submission. No server change.
5. **Guide.** `apps/guides/ra.html` gains the gap rule with the Christchurch example (section 4) and drops the "target-year statuses prefill from the action" sentence.

Rapid-form tasks (Vanuatu assigned tasks, every nomination) are untouched: the rapid form has no year grid, and the periods pane after submission already carries the same cards; the gap prompt and preview land there too because they live in the shared cards.

## 3. What does not change

- **Who writes a census-year state.** `target_year_statuses` on the parent draft stays whatever the RA entered in the grid (normally `not_assessed`); the derived rows are proposals; only `decideDerivedYear` / `confirmAllDerived` write a status and its basis. The RA's preview is a statement of what will be proposed, never a status.
- **Export eligibility (D5).** A draft with every year `not_assessed` reaches the wide CSV only after a reviewer confirms a year on it. `Confirm all eligible` confirms every year whose combining rule is 1, 2, or 4 with location rule L1 or L5 and no conflict, which is the whole set for an ordinary "in use since 1905" church, so the reviewer's cost is one click on the common case.
- **Conflict handling.** An RA who uses both the fallback grid and the periods can contradict themself; the engine marks the year `conflicts_observation`, the task gains `lifespan_conflicts_observation`, and confirm is refused for that year until the reviewer overrides with a note. The preview shows the conflict in red before submission so the RA can fix it themselves.

## 4. Gaps: the worked rules

A period asserts that worship happened at that place throughout it. The RA's one rule: **never let a period span a spell in which no worship happened.** The engine then derives the gap without any special handling.

| Case (Christchurch after 2011) | Periods the RA records | Derived proposals (2013, 2018, 2023) |
|---|---|---|
| Church demolished 2011, rebuilt on the same site, reopened 2019 | 1: known 1905 founding_stated → known 2011, closure_stated, `demolished`. 2: known 2019, building_dedication → still in use as of today. | absent (after stated closure), absent, present |
| Church demolished 2011, congregation moved to a new site 2014 | 1: … → 2011, `relocated`. 2: 2014 at the new point → still in use. | absent, present at the new point (transition line in the year the move spans), present |
| Church closed 2011, never reopened | 1: … → 2011, closure_stated, `closed`. | absent, absent, absent |
| Church damaged 2011, out of use for an unknown spell, in use again by 2016 | 1: … → between 2011 and 2011, `closed`. 2: by 2016, first_seen_only → still in use. | absent, uncertain (within start window), present |
| Gap suspected but not established | one period with the note "gap possible, not established" | present throughout, the note visible to the reviewer |

The fourth row is the one to teach: a partial date bound ("by 2016") is how the RA records what they know without inventing a reopening date, and the engine answers uncertain for the year inside the window rather than present.

## 5. Decisions put to JB

- **R-E1** Demote the year grid to the detailed form on assigned tasks (recommended yes). Alternative: keep both visible, periods first.
- **R-E2** Periods enter the same form and submit right after the parent evidence (recommended). Alternative: keep the pane post-submission and only auto-open it after submit; cheaper, but keeps the two-step feel and loses the preview beside the source fields.
- **R-E3** The gap prompt is one question after the first card (recommended) rather than a per-year checklist, which would reintroduce the grid by another name.
- **R-E4** Per-year confidence disappears from the RA's entry: a period carries one confidence and its basis, and a derived year carries the rule. Reviewer confirmation is the confidence statement of record (recommended; consistent with the ruled basis vocabulary).

## 6. Acceptance

- `node apps/regions/nz/js/occupancy-contract.test.cjs` gains the derivation tie fixtures (every rule 1–10 fires at least once, both combining outcomes, one conflict); `convex/lib/occupancies.node-test.mjs` unchanged.
- A stub-DOM contract test for the preview strip and the gap prompt (rendering only).
- Live check on dev with a signed-in RA: an assigned NZ task submitted with two periods and a gap shows, in the reviewer's occupancy panel, absent–absent–present with the rules named; `Confirm all eligible` confirms all three; the export row then carries the three statuses with basis `reviewer_confirmed_derivation`.
- Cache stamps bumped on `verification-map.js` and `occupancy-contract.js`; guide updated in the same PR.

## 7. Sequence

After PR #70 (one-click sources) merges. Client only; no Convex deploy. Estimated as one sitting: the cards and the submit chain exist, the derivation port is mechanical, the preview and prompt are new.
