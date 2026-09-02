# Occupancy lane build brief (PR-B′)

Status: build spec, 2026-09-02. Implements section 3 of `docs/portal-location-and-occupancy-plan.md` (ruled 2026-09-02) on the architecture ruled in `docs/portal-temporal-redesign-plan.md` (2026-08-31). This brief fixes table shapes, the derivation rules as code, and the mutation surface, so the server core, the RA entry surface, and the reviewer bar can be built against one contract. Where it extends the ruled text it says so.

## 1. Tables

`site_occupancies` — one row per segment of one place of worship's history: a period at one location. Rows attach to a submitted parent draft (rapid or guided, ruling R3) exactly as historical claims do; supersede-on-revise, never overwrite.

| field | type | notes |
|---|---|---|
| occupancy_id | string | `${task_id}:${user}:occupancy:${submission}:${segment_index}` |
| task_id, parent_evidence_draft_id | string | as historical_claims |
| claim_status | submitted, superseded, withdrawn | as historical_claims |
| contract_version | `occupancy_v1` | |
| segment_index | number | 0-based, ascending, contiguous within a submission |
| start_mode | known, between, by, unknown | |
| start_date, start_not_earlier_than, start_not_later_than | partial dates | which are present follows the mode |
| start_precision | day, month, year, bounded, unknown | computed server-side from the dates, never entered |
| start_basis | founding_stated, reopening_stated (PR-E), organisation_founded, building_dedication, first_seen_only, unknown | `unknown` iff start_mode unknown |
| end_mode | still_active, known, between, after, unknown | |
| end_date, end_not_earlier_than, end_not_later_than | partial dates | follows the mode |
| end_precision | as start | computed |
| end_basis | closure_stated, last_seen_only, unknown | `unknown` iff end_mode is still_active or unknown |
| end_reason | closed, relocated, demolished, use_changed, unknown | absent when still_active; `relocated` requires a following segment at a distinct location |
| still_active_asof | date | required iff still_active; never after the parent evidence date (the recorded date is the legacy fallback when the parent has no evidence date) |
| successor_site_id | string | only for a split into a new place of worship (definition v0.1.4), never for a same-identity relocation |
| location_relation | same_as_task_point, distinct | |
| latitude, longitude | number | always stored; copied from the task point when same_as_task_point |
| location_mode, location_basis, uncertainty_radius_m, location_wording, location_confidence | location_assertion_v1 fields | the embedded assertion; building identified at the task point when same_as_task_point and no assertion given |
| confidence, confidence_basis, source_basis, source_title, source_reference, source_account, uncertainty_note, privacy_flag | as historical_claims | |
| intake_submission_key | string | idempotency, as historical_claims |
| created_by, created_at, updated_at | | |

`derived_target_year_states` — one row per (parent draft, census year) that a rule fired for. No row means not assessed.

| field | notes |
|---|---|
| derived_state_id | `${parent_evidence_draft_id}:presence:${year}` |
| task_id, parent_evidence_draft_id, target_year | |
| derived_status | present, absent, uncertain |
| rule_id | the combining rule (section 3) |
| segment_rules | `[{occupancy_id, rule_id, status}]`, the per-segment firings |
| derivation_version | `occupancy_derivation_v1` |
| inputs_hash | sha256 of the canonical JSON of every consumed segment field |
| review_state | derived_unconfirmed, reviewer_confirmed, reviewer_overridden, reviewer_rejected, superseded |
| override_status | present, absent, uncertain; set on override |
| conflicts_observation | boolean; the parent draft already carries an observed status for the year that differs |
| created_at, updated_at | |

`derived_year_locations` — one row per (parent draft, census year, candidate occupancy).

| field | notes |
|---|---|
| derived_location_id | `${parent_evidence_draft_id}:location:${year}:${occupancy_id}` |
| task_id, parent_evidence_draft_id, target_year, occupancy_id | |
| location_status | located, located_uncertain, imputed |
| rule_id | L1–L4 (section 3) |
| latitude, longitude, location_mode, uncertainty_radius_m, location_basis | copied from the occupancy |
| gap_years | integer, L4 only: distance in years from the year to the nearest dated bound of the source occupancy |
| transition_group | string, L2 only: the members of one transition pair share it |
| derivation_version, inputs_hash, review_state | as presence rows |
| override_latitude, override_longitude, override_uncertainty_radius_m | set on override |
| created_at, updated_at | |

`derived_state_events` — append-only trail, one row per action on a year (ruling of 2026-08-31, section 4).

| field | notes |
|---|---|
| event_id | `${parent_evidence_draft_id}:${year}:${action}:${time}:${actor}` |
| task_id, parent_evidence_draft_id, target_year | |
| action | derived, invalidated, confirmed, overridden, rejected |
| actor_user_id, actor_role | |
| before, after | JSON snapshots of the presence row and the location rows |
| note | required for override and reject |
| created_at | |

`evidence_drafts` gains one optional field: `target_year_basis: record<year, source_observation | reviewer_confirmed_derivation | reviewer_override>`. Reviewer confirmation writes `target_year_statuses[year]` and `target_year_basis[year]` together. Nothing else in the draft changes.

## 2. Validation (`convex/lib/occupancies.ts`, `assertOccupancySet`)

- Mode ⇒ dates: known needs the date; between needs both bounds with lower ≤ upper; by needs only the not-later-than; after needs only the not-earlier-than; unknown needs none. Partial dates reuse `isValidPartialDate` and the 1600 floor (F1 later).
- Basis asymmetry enforced (ruling 2.2, extended by PR-E): `founding_stated`, `reopening_stated`, `organisation_founded`, `building_dedication`, and `first_seen_only` all need a dated start; `closure_stated` and `last_seen_only` need a dated end; `unknown` basis iff undated.
- still_active needs `still_active_asof` no later than the parent evidence date and no end_reason. Every period date is validated against that evidence date; only a legacy parent without one falls back to the date on which the period set is recorded.
- A segment with no dated bound at either end needs an uncertainty note of at least 12 characters.
- Segments are ordered by segment_index; certain cores must not overlap: `endLower(i) ≤ startUpper(i+1)` where both exist (one place at a time).
- `relocated` needs a following segment whose location differs from this one's.
- `distinct` location needs an embedded assertion that passes `assertLocationAssertion`; `same_as_task_point` takes the task's point.
- Text limits as historical claims.

## 3. Derivation (`derivePresence`, `deriveLocations`)

Bounds per segment: start ⇒ `[startLower, startUpper]`; end ⇒ `[endLower, endUpper]`; still_active ⇒ `endLower = asof`, `endUpper` open. Census year Y is the whole year `[Y-01-01, Y-12-31]` (D2). First match wins, per segment:

| # | rule_id | condition | status |
|---|---|---|---|
| 1 | inside_interval | startUpper ≤ Y-01-01 and Y-12-31 ≤ endLower | present |
| 2 | before_stated_founding | Y-12-31 < startLower and founding_stated | absent |
| 2b | before_stated_reopening | Y-12-31 < startLower and reopening_stated (PR-E: a stated reopening states the place was out of use until then) | absent |
| 3 | before_first_record | Y-12-31 < startLower, other basis | uncertain |
| 4 | after_stated_closure | Y-01-01 > endUpper and closure_stated | absent |
| 5 | after_last_record | Y-01-01 > endUpper, other basis | uncertain |
| 6 | within_start_window | Y-01-01 < startUpper and (no startLower or Y-12-31 ≥ startLower) | uncertain |
| 8 | beyond_active_anchor | still_active and Y-12-31 > asof | uncertain |
| 7 | within_end_window | not still_active, Y-12-31 > endLower and (no endUpper or Y-01-01 ≤ endUpper) | uncertain |
| 9 | start_unknown | no start bound and (no endLower or Y-12-31 ≤ endLower) | uncertain |
| 10 | end_unknown | dated start before the year, end undated and not still_active | uncertain |

Rule 8 is evaluated before rule 7 so that an open segment reports its anchor, as the ruled text intends. Rule 10 is an addition to the ruled table, which has no case for a dated start with an undated end after it; writing `uncertain` is a judgement, silence would be `not_assessed`. **Ratified by JB, 2026-09-02** ("Rule 10 is exactly right").

Combination across segments: any present ⇒ present; else any uncertain ⇒ uncertain; else all absent ⇒ absent; none ⇒ no row.

Location rules per year, on the per-segment firings:

| # | rule_id | condition | rows |
|---|---|---|---|
| L1 | occupancy_covers_year | exactly one segment fired rule 1 | that location, `located` |
| L2 | transition_window | two or more segments fired 1, 6, 7, 8, or 10 | each location, `located_uncertain`, one transition_group |
| L3 | within_own_window | one segment fired 6, 7, 8, or 10 | that location, `located_uncertain` |
| L4 | imputed_from_nearest | combined presence is present or uncertain and no segment fired 1, 6, 7, 8, or 10 | the segment nearest in time, `imputed`, gap_years recorded, radius unchanged |
| L5 | absent | combined presence absent or none | no rows |

Conflict: when the parent draft's `target_year_statuses[Y]` is neither `not_assessed` nor equal to the derived status, the presence row carries `conflicts_observation: true`, the task gains the automated check `lifespan_conflicts_observation`, and confirmation of that year is refused; only an override with a note can settle it. The engine never auto-resolves.

## 4. Mutations and queries (`convex/occupancies.ts`)

- `listTaskOccupancies({taskId})` — role-scoped as `listTaskHistoricalClaims`.
- `listDerivedStates({taskId})` — presence rows, location rows, and events for the task's active parent drafts; reviewer, curator, admin, and the drafts' author.
- `submitOccupancies({clientSubmissionId, taskId, parentEvidenceDraftId, segments[], clientContext})` — validates the set, supersedes the author's previous active rows for that parent, inserts the new rows, runs both derivations, writes or updates derived rows (a changed `inputs_hash` resets a row to `derived_unconfirmed` with an `invalidated` event; a row no rule produces any more becomes `superseded`), appends `derived` events, and appends the task event `note_added` with a reason naming the segment count. Idempotent on the submission key. Rate-limited as historical claims.
- `decideDerivedYear({taskId, parentEvidenceDraftId, targetYear, action, note?, override?})` — reviewer, curator, admin; never the parent draft's author. `confirm` requires no conflict, sets presence and location rows to `reviewer_confirmed`, and writes `target_year_statuses[Y]` and `target_year_basis[Y] = reviewer_confirmed_derivation` on the parent draft. `override` requires a note of at least 8 characters and an override object (status and/or point and radius), sets rows to `reviewer_overridden`, writes the override status with basis `reviewer_override`. `reject` requires a note, sets rows to `reviewer_rejected`, writes nothing to the draft. Every action appends one event with before and after snapshots.
- `confirmAllDerived({taskId, parentEvidenceDraftId, note?})` — confirms every unconfirmed year whose combining rule is 1, 2, or 4 and whose location rule is L1 or L5 and that carries no conflict. Returns the years confirmed and the years skipped with reasons.

Export (`convex/exports.ts`): the wide CSV gains per census year `target_year_<Y>_basis`, `_latitude`, `_longitude`, `_uncertainty_radius_m`, `_location_basis`; the shared column list, its portal mirror, and the template header change together (PR-B0 test). At export the row's `target_year_<Y>_status` is overlaid from the draft's current `target_year_statuses` (confirmation happens after the row was generated), `_basis` from `target_year_basis`, and the location columns from confirmed or overridden location rows. The bundle gains `site_occupancies.jsonl`, `derived_target_year_states.jsonl`, `derived_year_locations.jsonl`, and `derived_state_events.jsonl`. Rows in `derived_unconfirmed` never reach the CSV.

Export eligibility is unchanged. A rapid parent draft becomes wide-export-eligible only when a reviewer confirms a year on it, which is the ruled intent (D5); the rapid submission validator, which forbids assessed historical years, runs at submission only and is not re-run on reviewer writes.

## 5. Surfaces

RA (`verification-map.js`, contract mirror `occupancy-contract.js`): the block "Where and when was this place used for worship?" reachable from the post-submission pane beside "Add known history" and from the site card in add-or-revise mode. Period cards (Began, Ended, Location "same as the pin" by default), "around Y" compiling to Y−1..Y+1 shown before save, "Add another period", `relocated` opening the next card with the location box unchecked, rapid pre-fill of `still_active_asof` from the observation date. A distinct location re-arms pin mode for that card and freezes its assertion into the card.

Reviewer (`review-portal.js`): a drawn interval per parent draft with census ticks; under each year the derived presence with its rule in words, the derived location(s) with the L-rule, Confirm / Override / Reject, "Confirm all" only when eligible; the event trail listed beneath; a small map strip with the occupancy points.

Both surfaces are built against the mutation surface above and its client mirror; the server core lands first.
