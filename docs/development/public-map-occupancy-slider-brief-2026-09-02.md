# PR-C build brief — public-map slider on reviewed occupancies (2026-09-02)

Implements section 3.5 of `docs/portal-location-and-occupancy-plan.md` (ruled 2026-09-02) and follow-up F1 of the 2026-08-31 temporal rulings. Companion to `occupancy-build-brief-2026-09-02.md` (PR-B′), which owns the tables and the derivation engine this brief consumes. The historical-points standard in `temporal-place-layer.md` remains normative; this brief adds a tier to it, it does not replace it.

## 1. What ships

1. **Builder.** `scripts/build_occupancy_dated_places.py` reads materialised Convex exports and merges one feature per accepted occupancy into `apps/regions/<cc>/data/dated_places.geojson`, beside the OSM date-tag features already there. Reviewed features carry `source: "reviewed_occupancy"` and are replaced wholesale on each run; OSM features are untouched. `scripts/materialise_convex_export.py` now writes the four occupancy JSONL files (optional, so bundles frozen before PR-B′ still materialise).
2. **Renderer.** `apps/regions/_shared/region-map.js` gains three layers over the same source: `pow-dated-area` (approximate places: a soft amber disc at low zoom, the true radius from zoom 13), `pow-dated-window-points` (an amber dashed ring when the year falls inside a start or end window), and `pow-dated-transition` (a thin dashed line between the two members of a relocation while the transition is in progress). The alive predicate is unchanged; the solid dot now excludes years inside a window. The legend names the marks only when the product carries reviewed features; the popup states the windows in words and credits reviewed evidence rather than OSM tags.
3. **F1 per-country date floor.** `convex/lib/countryYears.ts` gains `DATE_FLOOR_YEARS` and `dateFloorYear(cc)`; `assertHistoricalClaim` and `assertOccupancySet` take the floor from the task's country; the portal mirror `apps/regions/nz/js/date-floor.js` sets `window.POW_DATE_FLOOR_YEAR`, which both client contracts read. Default 1600; see §4 for the table.

## 2. Acceptance rule

An occupancy row reaches the public map when it is `submitted` (not superseded or withdrawn) **and** at least one `derived_year_locations` row citing its `occupancy_id` has `review_state = reviewer_confirmed`. Overridden and unconfirmed derivations stay off the public map: an override replaces the location for one census year and has no per-occupancy geometry; a follow-on may render overrides as per-year points. Rejected rows never render.

## 3. Feature contract

Point features (`kind: "occupancy"`):

| property | meaning |
|---|---|
| `pow_site_id` | `candidate_site_id`, else `matched_current_site_id`, else the task id |
| `task_id`, `occupancy_id`, `segment_index`, `export_batch_id` | provenance back to the export |
| `name`, `religion`, `denomination` | name from the task; religion and denomination borrowed from the OSM feature the task matched, when any |
| `start_year` | earliest possible start (`start_lower`, else `start_upper`); absent when the start is undated, so the feature never renders in period mode |
| `end_year` | latest possible end (`end_upper`); `null` for still in use, `after X`, and end undated |
| `start_lower`, `start_upper`, `end_lower`, `end_upper` | the window bounds the entry mode fixes, as years; omitted when the mode leaves them open |
| `end_unknown` | `true` for rule 10 (end undated) |
| `still_active_asof`, `end_reason`, `location_mode`, `radius_m`, `cos_lat` | rendering and popup inputs |

Window rule (identical in the builder's tests and the MapLibre filter): year Y is inside a window when `Y < start_upper`, or `Y > end_lower`, or `end_unknown` and `Y > start_upper`. Solid otherwise.

Line features (`kind: "transition"`): a `LineString` from a period ended by `relocated` to the next period of the same parent draft, with `year_lower..year_upper` the union of the first period's end window and the second's start window. Rendered when `year_lower <= Y <= year_upper`.

Both feature kinds share the source; every point layer filters on `geometry-type == Point`, the transition layer on `LineString`. The portal's context-dot code skips features without two coordinates, so a `LineString` never reaches its `circleMarker`.

## 4. F1 table (ruled R6, 2026-09-02: accepted as an interim typo guard)

| countries | floor |
|---|---|
| NZ, VU, AU | 1600 (unchanged) |
| US, CA, MX, BR | 1500 |
| IE, UK, PT, RO, SK, IN, KR | 1000 |

The floor is a typo guard, not a claim about when worship began. Countries without census waves keep 1600. The partial-date format is four-digit years, so no floor may drop below 1000 without a format change; the countryYears test enforces the range 1000–1600 and requires a floor for every country with waves.

## 5. Not in this PR

- **Slider domain (ruled R7, 2026-09-02).** Country maps keep the census-wave slider; a reviewed occupancy is evaluated at those years only. Open directions from JB: a continuous slider on the main site (no census layers), or per-layer slider domains following a layer's purpose (precedent: the Pulotu source swaps the temporal frame to its own three points). To be developed with the layer-families design, not here. The F1 floor governs validation, not the slider.
- **Overrides on the public map** (§2).
- **Vanuatu wiring.** The VU product stays empty until the first occupancy is confirmed; the builder's summary flags `wiring_needed` the run that changes that, and the standard's wiring rule then applies (region config and portal `COUNTRY_CONFIGS` together).
- **Automation.** The builder runs by hand after a frozen export; the export → dated-places feedback loop in `revision-pipeline-all-countries.md` (phase R4) is the place to schedule it.

## 6. Verification

- `node --test convex/lib/*.node-test.mjs` (122, including the floor tie test), portal contract tests (7 files), `python3 -m unittest scripts/test_build_occupancy_dated_places.py` (11), `npx tsc --noEmit`.
- Browser: fixture export (a relocation with a 300 m approximate first site and a 2010–2015 start window; a second place with an undated end) built into the NZ product on localhost:8000. At 2013 the first site renders as the pale disc with the dashed ring; at 2018 it is gone, the new site is solid, and the dashed transition line joins them; at 2023 only the new site remains. Popup and legend wording checked. The NZ product was restored after the check (no reviewed rows exist yet).

## 7. Date-floor context: the oldest places of worship (recorded for R6)

JB asked what the convention excludes before accepting R6. Dates are approximate and several are contested; "in use" means worship continues on the site today. The binding limit is the four-digit year format: nothing before 1000 CE and no BCE date can be entered at all, whatever the floor. In the countries with census waves, the 1000 floor excludes St Martin's Canterbury and the Saxon churches, the Irish monastic sites, the Portuguese Visigothic churches, every Indian temple before 1000, and the great Korean temples; the 1600 default excludes, for Italy alone, the Pantheon and hundreds of early churches. NZ, Vanuatu and Australia lose no building at 1600; whether Aboriginal sacred sites of far greater antiquity are places of worship is a definition-layer question, not a date-format one. The deep-time date format (signed years, BCE, one sanity bound near 12000 BCE) removes every exclusion below and is the scheduled follow-on.

| Place | Country | Date | Status |
|---|---|---|---|
| Göbekli Tepe | Turkey | c. 9500 BCE | ruin; "temple" reading disputed |
| Ġgantija temples | Malta | c. 3600 BCE | ruin |
| Temple of Confucius, Qufu | China | 478 BCE | in use, rebuilt |
| Mahabodhi Temple, Bodh Gaya | India | 3rd c. BCE foundation, 5th–6th c. structure | in use |
| Western Wall | Jerusalem | 19 BCE | in use |
| Mundeshwari Temple, Bihar | India | c. 108 CE (claimed) | in use |
| Etchmiadzin Cathedral | Armenia | 301–303 | in use, oldest cathedral |
| Church of the Nativity | Bethlehem | 339, rebuilt 565 | in use |
| Yazd Atash Behram fire | Iran | burning since c. 470 | in use |
| Clonmacnoise, Glendalough | Ireland | 6th c. | ruins, pilgrimage continues |
| St Martin's, Canterbury | UK | 597 | in use, oldest church in the English-speaking world |
| Hōryū-ji | Japan | 607 | in use, oldest wooden building |
| Pantheon as a church | Italy | 609 | in use |
| Quba Mosque, Medina | Saudi Arabia | 622 | in use, rebuilt |
| Great Mosque of Kairouan | Tunisia | 670 | in use |
| Kailasanathar, Kanchipuram | India | 685–705 | in use |
| Bulguksa, Haeinsa | Korea | 774, 802 | in use |
| São Pedro de Balsemão | Portugal | 7th c. (Visigothic) | in use |
| Old Synagogue, Erfurt | Germany | 1094 | oldest intact synagogue |
