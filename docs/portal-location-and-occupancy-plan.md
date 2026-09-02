# Portal Location Uncertainty And Occupancy Timeline Plan

Status: RULED (JB, 2026-09-02) — all five section-6 decisions ruled as recommended; section 8 records the rulings. Drafted 2026-09-02. Produced from JB's ask of 2026-09-02 for the "Add or revise places" portal: (1) an uncertainty radius for location, important for historical work; (2) a timeline with uncertainty that imputes historical locations. Planned against the ruled temporal plan (`docs/portal-temporal-redesign-plan.md` on branch `design/portal-temporal-redesign`, PR #43, ruled 2026-08-31) and the handover of 2026-09-01. No code in this plan has been implemented.

Static render for review: `local/review/2026-09-02-location-occupancy-plan/plan.html` (git-ignored, per the F2 method). Portal hub: `docs/portal-data-entry-plan.md`. Master data vocabulary: `schemas/geometry-history.schema.json`.

## 0. Summary

Feature 1 is mostly an unlock. The server already holds a complete location-assertion contract (`location_assertion_v1`, `convex/lib/locationAssertions.ts`) with `mode` (building identified or approximate area), a basis vocabulary, a confidence grade, and an `uncertainty_radius_m` field validated to whole metres between 25 m and 100 km. The reviewer portal already renders it, and the portal map already draws the circle. Three gates hide it: Vanuatu forbids the approximate-area mode server-side; the portal shows the mode and radius controls only in New Zealand behind the hidden `?detailed=1` flag; and the default rapid add-place flow writes no assertion at all, so every nomination is silently recorded as building-level. Feature 1 opens those gates, binds the radius to the master vocabulary, and puts it in the export.

Feature 2 is a reshaping of the ruled temporal lane. PR-B as ruled records a site's worship function as dated lifespan segments with no location. The operational definition has since moved to v0.1.4: a place of worship is a continuant, and dated occupancy records locate it. The natural object is therefore the occupancy: a period with uncertainty joined to a location with uncertainty. One table, `site_occupancies`, replaces the planned `site_lifespans` and carries both. The ruled derivation engine then yields, for each census year, not only a presence state but a location, and the same reviewer confirmation bar and append-only event trail cover both. The time slider renders the occupancy in force at the chosen date.

Everything ruled on 2026-08-31 stands: basis asymmetry, derived states in their own table, quick reviewer confirmation, append-only review provenance, public-map slider first, the F1 validation floor. This plan adds location to the segment and asks five new rulings (section 6).

## 1. What Exists Today

Location. The only location contract is `location_assertion_v1` on `tasks.initial_location_assertion` (`convex/schema.ts:106-108`). Its rules: `building_identified` must carry no radius; `approximate_area` must carry a radius and the source wording; radius 25 m to 100 000 m in whole metres; the assertion point must equal the task point. `BUILDING_LEVEL_ONLY_COUNTRIES` (`locationAssertions.ts:31`) contains VU. The rapid candidate path (`convex/rapidEntry.ts:332-336`) writes no assertion, and `createManualCandidateTask` (`convex/tasks.ts:979-987`) defaults an absent assertion to building identified, map placement, high confidence. The portal client (`apps/regions/nz/js/verification-map.js:7002-7013`) shows the mode and radius selects only when `?detailed=1` disables rapid entry; radius presets run 100 m to 25 km. Evidence drafts carry no coordinates. Historical claims carry no location. The batch-import header uses a different vocabulary (`geocoding_basis`, `location_confidence` high/medium/low). The wide CSV has latitude and longitude columns but no radius. The master schema `geometry-history.v1` has an ordinal `location_confidence` (exact, building, parcel_or_compound, street, locality, area, unknown) and no numeric radius.

Time. `historical_claim_v1` records dated claims with earliest and latest supported partial dates, a 1600 floor (`convex/lib/historicalClaims.ts:120`), and supersede-on-revise; it accepts both rapid and guided parent drafts. No table holds `successor_site_id`, relocation, `still_active`, or an as-of date. `target_year_statuses` on the draft is the only per-census-year state and drives export eligibility. The public map (`apps/regions/_shared/region-map.js:4030-4160`) already has a census slider, a dated-places layer filtered by `start_year` and `end_year`, a prospective ring layer, and a 15-year staleness horizon; `dated_places.geojson` features carry one point and one year pair each, and Vanuatu's file is empty.

Exports. The PR-B0 bug is still present: `siteEvidenceWideCsv` (`convex/exports.ts:75-77`) takes the header from the first eligible draft. No shared `WIDE_EVIDENCE_FIELDS` exists on the server. Any new column, radius or occupancy, lands on a broken header until PR-B0 ships.

## 2. Feature 1: Location Uncertainty Radius

### 2.1 Contract

Keep `location_assertion_v1` as the single location object and reuse it unchanged for occupancy locations (section 3). Two additive changes:

- Derive the master ordinal from the radius. `location_confidence` becomes a deterministic function of mode and radius, never entered separately: building identified gives `building`; a radius up to 100 m gives `parcel_or_compound`; up to 300 m gives `street`; up to 2 000 m gives `locality`; above that gives `area`; `unknown` only when the assertion is missing. Thresholds are ruling R2. The function lives beside the validator so the client, the exporter, and the master builder agree.
- Add `uncertainty_radius_m` (integer metres, optional) to `geometry-history.v1` as an optional property next to `location_confidence`, and to the change-event `GeometryPayload`. Additive and optional, so no version bump; the ordinal remains for consumers that only need a grade.

Country rule. Replace `BUILDING_LEVEL_ONLY_COUNTRIES` with a per-country `approximateArea` flag in the intake registry (`convex/lib/rapidEntry.ts:35`), true for VU and NZ. The current-observation zoom gate (`placement_zoom >= 15`, `assertRapidCandidateContext`) applies only to building identified; approximate area keeps the existing client floor of zoom 8. Ruling R1.

Rapid candidate path. `candidateInput` gains the optional assertion; the mutation writes it to the task exactly as `createManualCandidateTask` does, defaulting to building identified when absent. This is task-level, outside the locked rapid draft contract (`assertNotRapidContract` guards draft fields only), but `rapidEntry.node-test.mjs` grows cases for both modes.

### 2.2 Portal entry surface

In the pin flow (`verification-map.js:6920-7045`) the confirm card gains one visible control in every country and every flow: a segmented choice, "I can pinpoint the building" (default) or "I can only place an area". Choosing the area shows the radius presets as chips and draws the circle at the pending pin; dragging the circle edge is a later polish, not v1. Presets: 50 m, 100 m, 250 m, 500 m, 1 km, 2 km, 5 km, 10 km, 25 km, 50 km, 100 km, plus a number field for anything else within the server bounds. The confirm button already relabels by mode. The location-evidence fieldset (basis, confidence, wording) stays as built; for the area mode the wording field is required, as the server already demands. A one-line helper under the chips names the recorded grade ("recorded as locality-level, 1 km"), so the RA sees the ordinal the master data will carry.

The `?detailed=1` escape stays for the NZ guided form but no longer gates the location controls.

### 2.3 Review, export, display

Reviewer pane: already renders mode, radius, basis, confidence, and wording (`review-portal.js:432-473`); add the derived ordinal. Wide CSV: after PR-B0, add `location_mode`, `location_uncertainty_radius_m`, `location_basis`, `location_confidence` beside the existing latitude and longitude columns. Public map: approximate points render as a soft hollow ring at low zoom and the true circle above zoom 13; this is a later slice with PR-C, not part of the unlock.

Guide: `apps/guides/ra.html` updates in the same PR (AGENTS.md rule).

## 3. Feature 2: Occupancy Timeline

### 3.1 The object: `occupancy_v1`

Replace the planned `site_lifespans` with `site_occupancies`. One row is one segment of one place of worship's history: a period during which worship for that place of worship happened at one location. Closure and reopening at the same location are two rows with the same location; a relocation is two rows with different locations. The row carries:

- Period, exactly as ruled for the lifespan segment: `start_mode`, start partial date or bounds, precision, `start_basis` (founding_stated, organisation_founded, building_dedication, first_seen_only, unknown); `end_mode`, bounds, precision, `end_basis` (closure_stated, last_seen_only, unknown), `end_reason` (closed, relocated, demolished, use_changed, unknown), `still_active_asof` when still active.
- Location: an embedded `location_assertion_v1` (point, mode, radius, basis, confidence, wording) plus `location_relation` (`same_as_task_point` or `distinct`). The default is the task pin, so an RA who only knows dates enters no second location.
- Provenance mirroring `historical_claim_v1`: confidence with basis, source basis, title, reference, account, uncertainty note, privacy flag, `claim_status` (submitted, superseded, withdrawn), supersede-on-revise.
- `segment_index` for ordering and `successor_site_id` only when `end_reason` is a split into a new place of worship, never for a same-identity relocation (definition v0.1.4).

Parent. The row attaches to a draft, following the historical-claims precedent that accepts both rapid and guided parents. The ruled PR-B said guided only; this plan asks to relax that (ruling R3) because "founded 1980, still going" is precisely the rapid-path sentence Guy's field RAs will hear. The rapid draft contract itself is untouched; the occupancy is a separate table with a parent id.

Validation reuses `isValidPartialDate` and the partial-date expanders; the F1 floor change applies here too.

### 3.2 Entry surface

One block, "Where and when was this place used for worship?", placed with the existing historical-claim entry (`verification-map.js:5339-5443`), offered after the pin is confirmed and again from the site card in add-or-revise mode. Each period is a card: Began (mode, date, basis), Ended (mode, date, basis, reason), and Location ("same as the pin" checked by default; unchecking re-arms pin mode for this period with its own radius control, section 2.2). "Around Y" compiles to Y−1 to Y+1 and shows the bounds before save, as ruled. "Add another period" appends a card; choosing "relocated" as an end reason appends the next card with the location box unchecked. A rapid current observation pre-fills `still_active_asof` and the pin location for the newest card and writes nothing by itself.

### 3.3 Derivation: presence and location per census year

The ruled nine-rule engine runs on the union of the occupancy periods and writes `derived_target_year_states` unchanged. A second, parallel derivation writes `derived_year_locations`: one row per task, census year, and candidate occupancy, with `rule_id`, `derivation_version`, `inputs_hash`, and the same review state vocabulary. First match wins:

| # | rule_id | Condition | Derived location |
|---|---------|-----------|------------------|
| L1 | occupancy_covers_year | exactly one occupancy certainly covers the year (rule 1 fired on it) | that occupancy's location, status `located` |
| L2 | transition_window | the year falls inside the uncertainty windows of two adjacent occupancies | both locations, status `located_uncertain`, joined as a transition pair |
| L3 | within_own_window | the year falls inside one occupancy's start or end window and no other is a candidate | that location, status `located_uncertain` |
| L4 | imputed_from_nearest | presence is `present` or `uncertain` for the year but no occupancy's window reaches it (unknown start, or beyond `still_active_asof`) | the nearest occupancy's location in time, status `imputed`, with the gap in years recorded |
| L5 | absent | presence derived `absent` | no row |

L4 is the imputation JB asked for and the only inferential step beyond the ruled engine. It never changes the radius: the honest statement is "we have no dated evidence of a move", not "the circle is bigger". The gap and the source occupancy are stored, and the row stays `derived_unconfirmed` until a reviewer confirms it. Ruling R4.

### 3.4 Review and provenance

The reviewer's drawn interval (section 2.5 of the ruled plan) gains a second row: a small map strip with the occupancy points and, per census year, the derived location under the derived presence. Confirm, override (with a new point or radius and a mandatory note), and reject act per year on presence and location together; "Confirm all" is offered only when every year derived by rules 1, 2, or 4 and L1. Every action appends a `derived_state_events` row (actor, time, action, before, after, note) as JB required on 2026-08-31; the review state on the derived row is a cache of the last event.

On confirmation a location row becomes a `geometry-history` record in the master lane: `geometry_role` from the mode (site_location or approximate_point), `geometry_basis` from the assertion basis, `valid_interval` from the period bounds with `basis: reviewer_inference` for L4 rows and `source_statement` otherwise, `identity_rule_applied: same_site_geometry_update` for relocations within one identifier, `change_reason: fuzzy_historical_placement` for L3 and L4, and `uncertainty_radius_m` from section 2.1.

Exports: the wide CSV gains, per target year, `target_year_<Y>_latitude`, `_longitude`, `_uncertainty_radius_m`, and `_location_basis` beside the ruled `_basis` column; the bundle gains `site_occupancies.jsonl`, `derived_year_locations.jsonl`, and `derived_state_events.jsonl`. Unconfirmed rows never enter the CSV. A confirmed derived location that conflicts with an observed task point raises the automated check `occupancy_conflicts_task_point` to `needs_review`.

### 3.5 Time slider and public map

The public-map machinery needs no new filter logic. The dated-places builder emits one feature per accepted occupancy rather than one per site, each with its own coordinates, `start_year`, `end_year`, the four window bounds (`start_lower`, `start_upper`, `end_lower`, `end_upper`), `radius_m`, and `pow_site_id`. The existing `syncDatedPlaces` filter then selects the occupancy in force at the slider year, so a relocated place appears at its then-current position. Two additions: amber hollow dashed rendering when the year falls inside a window (bounds present in the properties), and a thin dashed line between the two members of a transition pair at that year. The staleness horizon rule stands. The domain follows the F1 per-country floor.

The Vanuatu `dated_places.geojson` stops being empty the day the first occupancy is confirmed.

## 4. Bob Woodberry's Import

His third blocking question on 2026-08-29 was coordinate precision. The occupancy columns answer it: the import header (section 4 of the ruled plan) gains per segment `latitude`, `longitude`, `location_mode`, `uncertainty_radius_m`, `location_basis`, and `location_wording`, with `location_relation` defaulting to distinct when coordinates are present. Atlas stations with a locality but no building enter as approximate area with a stated radius. Legacy `first_date` and `last_date` still import as first-seen and last-seen, refusing to derive absence. The ingest mutation creates the task, the draft, the occupancy rows, and the unconfirmed derived rows in one transaction; the reviewer confirms on the drawn interval.

## 5. Build Order

Against the 2026-09-01 handover queue (reviewer map increment 1 agreed as the next build; Wave 3 conversation thread and dedup; Wave 4 the temporal lane):

1. PR-L1, location unlock. Registry flag, rapid candidate assertion, derived ordinal, schema property, mode and radius control in every flow, reviewer ordinal, tests, guide. Client plus `convex/lib`, small; Convex deploys to prod before merge.
2. PR-B0, `WIDE_EVIDENCE_FIELDS` as a shared server-validated constant. Unchanged from the ruled plan; blocks every new column.
3. PR-B′, occupancy. `site_occupancies`, both derivations, `derived_state_events`, reviewer confirm bar with map strip, basis vocabulary, export columns and JSONL. Supersedes PR-B's `site_lifespans`. The scientific core.
4. PR-C, public-map slider on per-occupancy features, window rendering, F1 floor. Then the portal browse mode as ruled.
5. PR-D, Bob's import with the occupancy columns.

The reviewer map increment 1 touches `review-portal.js` and Convex task creation, not these files, and can run in parallel with PR-L1 and PR-B0. Ruling R5 asks which goes first.

## 6. Decisions Put To JB

- R1 Approximate area everywhere. Allow the approximate-area mode in every country including Vanuatu and in the default rapid flow, with building identified as the default and the zoom-15 gate kept for buildings only. Recommended yes; the 2026-08-31 building-only ruling for VU predates the historical use case.
- R2 Radius grade thresholds. Building identified → `building`; ≤100 m → `parcel_or_compound`; ≤300 m → `street`; ≤2 km → `locality`; >2 km → `area`. Recommended as stated; the presets align to the boundaries.
- R3 Occupancy rows from rapid parents. Accept occupancy rows on rapid as well as guided drafts, following the historical-claims precedent and leaving the rapid draft contract untouched. Recommended yes; amends the ruled PR-B's guided-only restriction.
- R4 Imputation rule L4. Extend the nearest dated occupancy's location into census years where presence is derived but no occupancy window reaches, stored as `imputed` with the gap recorded, radius unchanged, reviewer confirmation required. Recommended yes.
- R5 Priority. PR-L1 and PR-B0 before the reviewer map increment 1 (recommended, both are small and the reviewer map does not depend on them), or the reviewer map first as agreed on 2026-09-01.

## 7. Amendments To The Ruled Temporal Plan

Recorded so the design branch can be reconciled when it lands: `site_lifespans` becomes `site_occupancies` with an embedded location (3.1); the guided-only parent rule is proposed relaxed (R3); D10's successor links reread as occupancy history per definition v0.1.4, with `successor_site_id` reserved for splits; the derivation gains the location table and rules L1 to L5 (3.3); the review event log is named `derived_state_events` and covers both derived tables (3.4); the dated-places product changes from one feature per site to one per occupancy (3.5).

## 8. JB Rulings — 2026-09-02

Recorded from JB's reply to the plan the same day. All five decisions ruled as recommended.

- **R1 ruled yes.** The approximate-area mode is allowed in every country, Vanuatu included, and in the default rapid flow; building identified stays the default and the zoom-15 placement gate applies to buildings only. This supersedes the 2026-08-31 building-level-only rule for VU.
- **R2 ruled yes.** Grade thresholds as tabled: building identified → `building`; ≤100 m → `parcel_or_compound`; ≤300 m → `street`; ≤2 000 m → `locality`; above → `area`. The ordinal is derived, never entered.
- **R3 ruled yes.** Occupancy rows attach to rapid as well as guided parent drafts, on the historical-claims precedent; the rapid draft contract is untouched. This amends the ruled PR-B guided-only rule.
- **R4 ruled yes.** Imputation rule L4 stands: nearest dated occupancy's location, stored as `imputed` with the gap recorded, radius unchanged, reviewer confirmation required before it enters the master lane.
- **R5 ruled: PR-L1 and PR-B0 first.** The reviewer map increment 1 follows, or runs in parallel where hands allow.

Build queue is therefore unblocked in the section-5 order: PR-L1 → PR-B0 → PR-B′ → PR-C → PR-D.

### PR-C rulings — 2026-09-02 (after #66 merged)

Recorded from JB's replies to the PR-C brief (`docs/development/public-map-occupancy-slider-brief-2026-09-02.md`).

- **R6 ruled: accept the date-floor table** (brief §4) as an interim typo guard: NZ, VU, AU 1600; US, CA, MX, BR 1500; IE, UK, PT, RO, SK, IN, KR 1000; countries without waves 1600. Accepted knowing what it excludes (brief §7): the four-digit year format, not the table, is the binding limit, and a deep-time date format (signed years, BCE, one sanity bound near 12000 BCE) is a separate follow-on ruling, scheduled after PR-D.
- **R7 ruled: country maps keep the census-wave slider.** A reviewed occupancy is evaluated at the waves and nowhere else on a country page. Two directions offered, not yet ruled: a continuous slider on the main site, which carries no census layers; or slider domains that follow the interest and purpose of a layer, as the Pulotu source already does by swapping the temporal frame to its own three time points. JB: "this is a deep point" — to be developed with the layer-families design (`docs/development/layer-families-design.md`, collections declaring their own temporal frame), not settled inside PR-C.

