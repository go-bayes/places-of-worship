# PR-F build brief — the function chain and intermittent use (2026-09-02)

Status: BUILT 2026-09-03 on `feat/function-chain` after JB's rulings R-F1–R-F4 (section 5a); build spec drafted at JB's request on 2026-09-02 (evening) from his Kohekohe example. Builds on PR-E (`assigned-task-periods-brief-2026-09-02.md`, rulings R-E1–R-E4) and the occupancy lane (`occupancy-build-brief-2026-09-02.md`). Nothing here asks the RA about a census year: the census-year states keep deriving from the periods, and the denomination per census year will derive from the chain.

## 1. The problem

A place of worship has two histories that the portal now records unevenly. Where and when it was in use is the occupancy timeline: period cards at a location, from which the census-year states derive (PR-B′, PR-E). What it was, and how that changed, is the function timeline: a denomination or tradition, shared use, a rebuild, a desacralisation. Today that second history enters only as one-at-a-time historical claims with no order between them, so a church that was Presbyterian, then shared with Methodists for a decade, then Presbyterian again, then desacralised, takes four disconnected claims and the reviewer reassembles the story. And a building used once a year after its desacralisation has nowhere honest to go: it is neither a period nor nothing.

## 2. What ships

1. **The change chain.** Under the period cards, one block: "What was it, and did that change?" The first row records the tradition or denomination at the start (label as the source gives it, with the existing label basis and relation fields) and defaults its date to the period's start. One control, *Add a change*, offers: denomination changed; shared use began; shared use ended; building rebuilt; use became intermittent; desacralised; worship resumed (R-F5); other. Each change takes the same date widget as the periods (known, around, between, by) and the new label where one applies. The previous state ends when the next begins, so the chain is contiguous by construction and the RA never types an end date for a state.
2. **Desacralised closes the period.** Choosing it writes the enclosing period's end (date, `closure_stated`, reason `desacralised`) so the RA is not asked twice; `desacralised` joins the end-reason vocabulary (`closed`, `relocated`, `demolished`, `use_changed`, `desacralised`, `unknown`) on server, mirror, and export.
3. **Use frequency on a period.** Each period gains `use_frequency`, an ordinal: `regular` (weekly or more, the default), `monthly`, `several_times_a_year`, `annual`, `occasional` (rarer or irregular), `uncertain`. "Use became intermittent" in the chain splits the period at that date and sets the new period's frequency. The preview and the reviewer panel state the frequency beside the period. What frequency counts as "in use" for the census derivation is a definition-layer ruling (section 5); until ruled, periods at `annual`, `occasional`, or `uncertain` derive `uncertain` for the years they cover rather than `present`, and the rule is named (`intermittent_use`).
4. **Storage.** The chain compiles to ordered `historical_claims` of kind denomination-or-affiliation state (existing contract) with a new `chain_index` and `chain_id`, one claim per state, plus one claim per rebuild; superseded on resubmission as a set, as periods are. No new table.
5. **Derived denomination per census year.** A new derivation, `derived_target_year_functions`, one row per (parent draft, census year) naming the state in force with the same window logic as the presence rules (inside a state → that label; inside a change window → uncertain, both labels named; before the first or after the last state → not assessed). Reviewer confirms, overrides, or rejects it in the occupancy panel beside the presence row; only a reviewer action writes the year's denomination on the parent draft. The export gains `target_year_<Y>_denomination` and `_denomination_basis`.
6. **Guide.** The Kohekohe walk-through (section 4a for the record, 4b the fictional continuation) replaces the current one-claim-at-a-time description.

## 3. What the RA is never asked

- A census year. Presence, location, and denomination per year all derive.
- An end date for a function state: the next change supplies it.
- A second entry of the desacralisation date.

## 4. Kohekohe, entered

Two parts. Section 4a is the record: the history of the Kohekohe Presbyterian Church (former), 1189 Awhitu Road, Waiuku, as given in the Auckland Council Heritage Unit's historic heritage evaluation of June 2017 (Rebecca Freeman), which adapts Paul Dixon, *Backbreak Peninsula* (2004), pp. 39–44. Section 4b is a fictional continuation after the deconsecration, written to exercise intermittent use (R-F1) and worship resumed (R-F5). Never enter it as evidence for this place.

### 4a. The record (source: Auckland Council Heritage Unit, 2017, after Dixon 2004)

| Step | Entry | Derives |
|---|---|---|
| Location | Pin on the church at 1189 Awhitu Road, building identified. Kohekohe's earlier places of worship (Hugh Douglas's home, then a school near the Awhitu–Kohekohe Road junction) are other sites: separate places if ever recorded, or a note here; never periods of this site. | Location per census year |
| In use | Began 14 November 1886, known, founding stated (opened by Revs Riddle and Munro; land given by Hugh and Jane Douglas, designed by Captain Sir John Makgill, built by William Douglas). Ended between 1975 and 1979, closure stated, reason desacralised (written by the chain): the Presbyterian Church accepted the Harcombe family's tender in 1975 and the church "was subsequently deconsecrated"; the upper bound is the RA's reading of "subsequently", stated in the card's wording. Frequency regular. | 2013, 2018, 2023 absent |
| Chain | Presbyterian from 1886. Change: shared use began, Methodist, 1923, known ("the local Methodist congregation began using the church weekly for services"). Shared use ended: not stated by the source, so no change is recorded; the composite label stands until the desacralisation (known limit P3-1). Change: desacralised, between 1975 and 1979. | Presbyterian in any target year 1886–1922; "Presbyterian, shared with Methodist" 1923 until the desacralisation; nothing in 2013, 2018, 2023 |
| Note | "The church continues to be used for functions and gatherings" — a non-worship use after the deconsecration; the building stands and is much photographed. | Visible to the reviewer |

The NZ census years all fall after the deconsecration, so the real record derives absent and no denomination for every target year. That is the correct answer, and the reviewer confirms it. Earlier target years, if a later product asks for them, derive the Presbyterian and shared-use states above.

### 4b. Fictional continuation

To show R-F1 and R-F5 at work, the tests and the guide use a fictional continuation of the Kohekohe shape. **None of the following happened.**

| Step | Entry (fictional) | Derives |
|---|---|---|
| Intermittent use | Change: use became intermittent, 2014, frequency annual → a second period from 2014 at `annual`, same place. | 2018, 2023 present at the intermittent level (`inside_interval`, `use_level: intermittent`; R-F1′) |
| Worship resumed (R-F5) | Change: worship resumed, Anglican, 1950 (a separate contrived fixture with the desacralisation moved to 1930). | 1940 nothing; 1960 and 2013 Anglican |

The automated fixtures (`convex/lib/functionChain.node-test.mjs`, `functionChainMirror.node-test.mjs`, `occupancyDerivationMirror.node-test.mjs`, `apps/regions/nz/js/assigned-periods-dom.test.cjs`) use these fictional dates and are labelled as the fictional continuation. Whether the annual service is a period or a note was exactly ruling R-F1: recording it as an `annual` period keeps the fact in the data with an honest derived state; recording it as a note loses it from every product. R-F1′ (later the same day) settled what that honest state is: present, at the intermittent level.

## 5. Decisions put to JB

- **R-F1 Frequency threshold.** Which `use_frequency` values count as "in use as a place of worship" for the census derivation. Recommended: `regular`, `monthly`, and `several_times_a_year` derive present; `annual`, `occasional`, and `uncertain` derive uncertain. This belongs in the definition (v0.1.5) as well as here.

- **R-F2 Desacralised as its own end reason** rather than `use_changed`. Recommended yes: the reviewer and the export read the reason, and a deconsecration is a datable ecclesiastical act.

- **R-F3 Chain vocabulary.** The seven changes in section 2.1, or a longer list. Recommended the seven, with "other" carrying a required note.

- **R-F4 Derived denomination confirmation** rides in the same reviewer panel and the same *Confirm all eligible* action (a year whose state is inside one function state with no window). Recommended yes.

### 5a. Rulings (JB, 2026-09-03)

- **R-F1** yes: `regular`, `monthly`, and `several_times_a_year` derive present; `annual`, `occasional`, and `uncertain` derive uncertain. Goes into the definition as v0.1.5.
- **R-F1′** (JB, later on 2026-09-03) revises R-F1. JB's reasoning: "uncertain" is epistemic (we do not know), while an annual service is certain knowledge of rare use, and rarity can itself be the significance; so the two axes stay apart. Presence remains epistemic (present / absent / uncertain): a period with `use_frequency` `annual` or `occasional` derives **present** with the same certainty as any present year; only `use_frequency: uncertain` derives an uncertain presence (rule 11 `intermittent_use` keeps its id for that case). A new derived field per census year, `use_level` (`regular` from regular, monthly, several-times-a-year, or unstated use; `intermittent` from annual or occasional use; omitted when the presence is uncertain), rides on `derived_target_year_states`, is confirmed with the presence in the reviewer panel, is written to the parent as `target_year_use_levels`, and exports as `target_year_<Y>_use_level` beside the status. The derivation version is `occupancy_derivation_v3`, so confirmed presence rows reset once. The Kohekohe fictional continuation therefore derives 2013 present regular / Presbyterian, 2018 present intermittent, 2023 present intermittent; no denomination after the desacralisation is unchanged. Definition v0.1.5 is amended in place (its revision note carries the amendment).
- **R-F2** yes: `desacralised` is its own end reason.
- **R-F3** yes: the seven chain changes of section 2.1, with `other` carrying a required note.
- **R-F4** yes: derived denomination confirmation rides in the same reviewer panel and the same *Confirm all eligible* action.
- **R-F5** (JB, 2026-09-03) yes, option 2: an eighth change `worship_resumed`, so a deconsecrated building that returns to worship under another (or the same) denomination is one chain on one site. Its label is the resuming denomination (required, like the start label); it is permitted only after a `desacralised` change, and after it the ordinary changes are permitted again. On the cards it opens a new period at its date with `start_basis: reopening_stated` (PR-E rule 2b), so the years between the desacralisation and the resumption derive absent for presence and nothing for denomination; the resumed state derives by the same rules as any other.

## 6. Acceptance

- Server: `use_frequency` and `desacralised` on `site_occupancies` (schema, validators, mirror, export columns); `chain_id`/`chain_index` on historical claims; the function derivation with rules named; tests in `convex/lib/*.node-test.mjs` and a mirror tie test as PR-E's.
- Portal: the chain block inside the guided form and the periods pane; the preview names the denomination per year beside the presence; the reviewer panel shows the function row with confirm / override / reject.
- Live check on dev with a signed-in RA: Kohekohe entered as in section 4a derives the table's states (absent, no denomination, in every NZ census year), and the 4b fictional continuation derives its stated states; the reviewer confirms; the export row carries the denomination columns.
- Convex before static: this PR touches `convex/`; deploy before merge.

## 7. Sequence

After PR #72 (PR-E) merges. One server sitting (vocabulary, derivation, export) and one portal sitting (chain block, preview, reviewer row).
