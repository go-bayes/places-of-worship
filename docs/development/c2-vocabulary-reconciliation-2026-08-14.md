# C2 pre-work: one vocabulary for the portal and the workbench

Date: 2026-08-14. Status: decision document awaiting JB rulings (marked **RULING** below); recommendations are pre-filled and become the decision unless overruled. Scope: the enumerations and interaction semantics that differ between the NZ/country portal (`apps/regions/nz/js/verification-map.js`, production, writes to Convex) and the TypeScript workbench (`apps/workbench/src/`, localStorage demo, Convex cutover planned in `docs/development/workbench-publication-plan.md`). Source finding: `ra-portal-ergonomics-2026-08-14.md` finding 5. The reconciliation must land before the workbench writes to the shared tables; after cutover every divergence becomes a data-cleaning job instead of a relabelling job.

Two facts set the cost structure. The first fact is that the Convex schema does not arbitrate: `evidence_drafts` stores `source_type`, `assessment_confidence`, `lifecycle_event`, and kin as `v.optional(v.string())` (`convex/schema.ts:126-147`), so the backend accepts whatever either surface sends, and the portal's values are canonical only by being the ones production data already contains. The second fact is that the workbench has no durable data — its provider is localStorage demo state — so re-valuing every workbench enumeration costs zero migration. The default posture follows: the portal's stored codes win wherever the two surfaces name the same construct, the workbench's richer lists contribute additive options, and the schema gains validators at cutover so the reconciled vocabulary is enforced rather than conventional.

## 1. Lifecycle event types

Portal (`verification-map.js:849-864`), 13 typed events plus an empty option, stored in `lifecycle_event` with one date and one precision; bounded dates are encoded as event types (`origin_not_earlier_than`, `closure_not_later_than`, ...), and `LIFECYCLE_FIELD_BY_EVENT` fans each event out to its own wide-row column. Workbench (`EvidenceForm.tsx:67-76`), 8 generic events (`founding`, `opening`, `first_seen`, `last_seen`, `closure`, `demolition`, `change_of_use`, `rebuild`), each carried in a lifecycle array whose entries hold `value`/`notEarlierThan`/`notLaterThan` date fields — bounds live on the date, and a draft can carry several events.

Recommendation: the portal's event vocabulary is canonical; the workbench adopts it. The mapping is `founding → organisation_founded`, `opening → site_opened` (with `building_opened_or_dedicated` newly available), `closure → site_closed`, `demolition → building_demolished`, `change_of_use → use_changed`, `first_seen`/`last_seen` unchanged; the portal's bounded types and `relocated` become available to the workbench. The portal's encoding wins for a structural reason beyond incumbency: the wide-row contract (`generated_wide_row`, `LIFECYCLE_FIELD_BY_EVENT`) already gives every portal event its own dated column, and the research CSV consumers downstream read those columns.

- **RULING 1a — `rebuild`.** The workbench's `rebuild` has no portal equivalent. Options: add `building_rebuilt` to the canonical list (new wide-row column pair), or drop it and record rebuilds as `use_changed`/`building_opened_or_dedicated` with a note. Recommendation: drop for now; no production draft carries it, and a rebuild is representable as a closure/opening pair, which is truer to the target-year analysis anyway.
- **RULING 1b — one event per draft or an array.** The portal enters one lifecycle event per draft (several events means several drafts); the workbench models an array per draft. The Convex table holds single `lifecycle_*` fields, so the array cannot land at cutover without a schema change. Recommendation: single event per draft everywhere; the workbench flattens its array UI to the portal's event+date+precision triple. Revisit an array only if RA practice shows multi-event drafts are common enough to justify the migration.

## 2. Assessment confidence

Portal (`verification-map.js:718-723`): stored numeric strings `"0.9"`/`"0.7"`/`"0.5"`, labelled "High (0.90)" / "Medium (0.70)" / "Low (0.50)". Workbench (`EvidenceForm.tsx:153-170`): stored `high`/`medium`/`low`. The portal is also split against itself: its own match and geocoding confidences are categorical `high`/`medium`/`low`/`none` (`:712-717`), so the numeric coding is the outlier even inside one file.

- **RULING 2 — stored values for assessment confidence.** Option (a): keep the numeric codes; the workbench adopts `"0.9"`/`"0.7"`/`"0.5"` with the portal's labels. Zero migration; production drafts already carry these values; the wide row keeps a numeric column that downstream analysis can weight with. Option (b): go categorical (`high`/`medium`/`low`) to match the other two confidences and the workbench; requires a one-off @convex-dev/migrations pass over existing drafts plus a wide-row/export relabel, and any consumer weighting by the numeric loses that for free. Recommendation: option (a). The labels already read categorically on both surfaces, so the RA-facing inconsistency dissolves at the label level, and the numeric survives for analysis. Whichever way this rules, the cutover validator should enforce exactly three values plus absent.

## 3. Source types

Portal (`verification-map.js:724-741`): 14 codes (12 + 2 NZ-only LINZ types). Workbench (`EvidenceForm.tsx:42-65`): 22 codes — every portal code plus the historical-evidence types the workbench was designed around (`census_or_statistics`, `church_record`, `denominational_yearbook`, `newspaper_archive`, `map_or_survey`, `academic_work`, `oral_history`) and one accidental duplicate (`charity_or_society_register` beside `charities_register`).

Recommendation, no ruling needed unless overruled: the canonical list is the union minus the duplicate — portal codes stay as they are, the portal's select gains the seven historical types (cheap: an options-array edit), and the workbench drops `charity_or_society_register` in favour of `charities_register`. The historical types are not workbench exotica: the round-2 data-source register (same date) scores denominational directories and heritage lists as manual-verification sources, and the Anglican lane's parish tables are exactly `church_record` evidence — the portal will need these codes soon regardless.

## 4. Skip semantics

Portal: skip sits behind a disclosure with five reason chips (`verification-map.js:752-758`: can't find a source, ambiguous identity, needs local knowledge, looks like a duplicate, data error on the map — the last two hinting an issue report), records the reason, and offers Undo skip. Workbench: one bare click, no reason, no confirm, no undo (`EvidenceForm.tsx` skip button) — the workbench's only single-click destructive action.

Recommendation, no ruling needed: port the portal's pattern into the workbench at cutover — disclosure, the same five reason chips (they are country-neutral), reason stored, undo. The reasons also feed triage: a skip wave with "can't find a source" is a task-generation signal, which the workbench currently discards.

## 5. Geocoding: confidence versus basis

Portal: `geocoding_confidence` (`high`/`medium`/`low`/`none`) — how sure the RA is of the point. Workbench: `geocodingBasis` (`EvidenceForm.tsx:78-85`: exact address, historical address matched, described locality, map georeference, regional only, unknown) — where the point came from. The two are different constructs rather than two codings of one: basis records evidence provenance, confidence records a judgement, and a historical-address match can carry high or low confidence.

- **RULING 3 — keep one construct or both.** Option (a): both — the portal gains an optional basis select (collapsed block, like the other optional fields), the workbench gains the confidence select, and the schema carries both fields (basis is a new optional column). Option (b): confidence only — the workbench drops basis; provenance lives in the evidence note. Recommendation: option (a); basis is cheap to record at entry time and impossible to reconstruct later, and the free-nomination flow (where the workbench uses it) is exactly where provenance matters most. Defer the portal-side select to a later round if form length is a worry — the ergonomics round just shortened that form.

## 6. Already aligned, for the record

Worship-use and existence statuses agree (the workbench's `NO_BUILDING` choice coerces to the portal's `existence_status: absent` + `worship_use_status: not_worship` pair, `EvidenceForm.tsx:112-117`); match confidence agrees; date precision agrees; draft states agree (`readOnlyStates`, `EvidenceForm.tsx:89-96`, mirrors the portal's lifecycle). No action.

## Cutover checklist derived from the above

1. Apply rulings 1-3; re-value the workbench enumerations (zero data cost, localStorage only).
2. Add the seven historical source types to the portal select; drop the workbench duplicate.
3. Port skip reason chips + undo into the workbench.
4. Tighten `convex/schema.ts`: replace the bare `v.string()` fields with `v.union(v.literal(...))` validators for `lifecycle_event`, `source_type`, `assessment_confidence`, `match_confidence`, `geocoding_confidence`, `worship_use_status`, `existence_status` — after confirming no existing row violates them (one `runOneoffQuery` scan; the portal has been the only writer, so violations are unlikely).
5. Only then wire the workbench provider to Convex (C2 proper, staged, parity-gated on André/Guy per the standing ruling).
