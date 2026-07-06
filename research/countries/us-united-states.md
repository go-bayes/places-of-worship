# Country data map: United States (US)

One page per country, one consistent structure. This card is the single
place a reader checks to learn whether a country data map is feasible,
what it would show, and what building it requires. Update the card when
sources are verified or the build advances; record status honestly.

## Status

- **Tier**: A (buildable now)
- **Build state**: map live (county level, 2010 + 2020)
- **Last verified**: 2026-07-06

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| U.S. Religion Census (RCMS), Association of Religion Data Archives (ARDA) | congregations and adherents reported by religious bodies (institutional presence) | county | 1952, 1971, 1980, 1990, 2000, 2010, 2020 | Excel/SPSS/Stata/ASCII, county file per wave | open, no account/registration (files hosted on OSF, linked from an ARDA click-through citation notice) | no formal EULA; cite ARDA and the original collectors; "as is", no redistribution restriction on derived/aggregated products found |
| Census of Religious Bodies (federal) | church-reported membership | county | 1906, 1916, 1926, 1936 | scanned tables at ARDA | open, same access pattern as RCMS | not verified this sitting; noted for a future deep-past pass |

The United States census asks no religion question. The RCMS/ARDA series
measures **congregations and adherents reported by religious bodies** —
institutional presence claimed by participating denominations and faith
groups — not a census self-identification question, and not comparable
to the NZ/VU "religious affiliation" construct built from a stated-
response census item. Every US metric label on the map says "adherents"
or "congregations", never "affiliation".

### Step 1 verification record (2026-07-06)

The playbook's source claims were model memory and were verified by
direct web lookup and `curl` before any build step:

- **usreligioncensus.org** hosts summary/detail Excel workbooks for 2020
  directly (`2020_USRC_Summaries.xlsx`, `2020_USRC_Group_Detail.xlsx`,
  `https://www.usreligioncensus.org/sites/default/files/2023-06/...`),
  HTTP 200, no auth. These are nation/state/county/metro summary tables,
  not the full per-denomination county file used here.
- **thearda.com/data-archive** lists the county file for each wave as a
  separate dataset: `RCMSCY` (2000), `RCMSCY10` (2010), `RCMSCY20`
  (2020), each with its own `fid`. Curling the page's Downloads tab
  (`?fid=RCMSCY10&tab=3`) shows the real download links point to
  **OSF** (`https://osf.io/download/<id>`), not thearda.com itself.
  Every OSF link returns HTTP 200 directly via `curl`, with SHA-256
  hashes matching OSF's own `x-waterbutler-metadata` header exactly —
  confirming no account, login, or registration wall of any kind.
- ARDA's "Downloads" page shows an in-page **click-through notice**
  (JavaScript-toggled `<div>`, not a login form) before revealing the
  links: (1) cite ARDA and the original collectors; (2) make responsible
  use of the data; (3) data offered "as is", no warranty; (4) agreement
  governed by Indiana law. No restriction on redistribution of derived
  or aggregated products was found in this notice or in ARDA's FAQ page.
- Census Bureau cartographic boundary file for counties
  (`cb_2020_us_county_5m.zip`, 1:5,000,000, 2020 vintage) downloads
  directly from `www2.census.gov`, HTTP 200, public domain (U.S.
  government work).

No registration wall, licence prohibition, or synthetic-data situation
was found. The build proceeded on real downloaded data.

## Boundaries

- U.S. Census Bureau cartographic boundary file, counties, 1:5,000,000,
  2020 vintage (published 2021-01-24, public domain). Filtered to the 50
  states + DC (3,143 of 3,234 features; territories dropped, matching
  RCMS coverage). Simplified to 1000m tolerance in NAD83 Conus Albers
  (EPSG:5070), 2.56 MB, well under the ~10 MB budget.
- Join key: 5-digit county FIPS (`GEOID`). The 2020 vintage boundary
  file predates Connecticut's 2022 planning-region switch, so its county
  layout matches both the 2010 and 2020 RCMS waves without a CT-specific
  crosswalk.
- Ten of 3,149 2010 RCMS county rows carry FIPS codes that predate or
  postdate simple 1:1 successors to the 2020 boundary set: Alaska
  census-area splits/renames (Prince of Wales-Outer Ketchikan,
  Skagway-Yakutat/Hoonah-Angoon, Valdez-Cordova, Wrangell-Petersburg,
  Wade Hampton), the 1997 dissolution of Montana's Yellowstone National
  Park county-equivalent, two Virginia independent-city mergers (Bedford,
  Clifton Forge), and the 2015 Shannon County to Oglala Lakota County
  rename in South Dakota. All ten are mapped and documented in
  `apps/regions/us/data/source/fips_crosswalk_2010_to_2020.csv`, sourced
  from the Census Bureau's county-change documentation and corroborating
  Wikipedia detail. Where a 2010 area later split into two 2020 counties
  (Valdez-Cordova to Chugach + Copper River), the combined total is
  attributed to the larger successor and the smaller successor is left
  an honest pending row for 2010, flagged
  `county_created_by_post_2010_split_no_2010_data`.
- Join coverage: 3,143/3,143 for 2020 (no crosswalk needed); 3,143/3,143
  for 2010 (after the crosswalk).

## Places-of-worship layer

- No US-specific OpenStreetMap extraction has been built yet. The page
  shows the existing global OSM places-overview layer (shared across all
  region pages) but the `area_summary_county` product carries no
  `place_count` field, so the places-per-population and place-density
  metrics are omitted from the metric list rather than shown as
  permanently pending — see `metricsAvailable` in
  `apps/regions/us/index.html`.
- A future OSM extraction pass for the US (`amenity=place_of_worship`
  point-in-polygon assignment to counties) would populate this and
  should re-enable those two metrics.

## First visualisation

Adherents per 100 population by county, U.S. Religion Census 2010 and
2020, on 2020 county boundaries. This is the playbook's staged first
release; earlier RCMS waves (1952–2000) are feasible in a follow-up
sitting since they use the same ARDA/OSF access pattern.

## Build recipe

1. Download: `data/raw/us_rcms/RCMSCY{10,20}_county.xlsx` from the OSF
   links behind ARDA's Downloads tab, plus
   `cb_2020_us_county_5m.zip` from the Census Bureau; provenance and
   SHA-256 in `data/raw/us_rcms/sources.csv` (git-ignored raw cache).
2. Boundaries: `scripts/build_us_county_boundaries.R` reads the
   shapefile, filters to 50 states + DC, simplifies, and writes
   `apps/regions/us/data/counties_2020.geojson`.
3. Extraction and governed product: `scripts/build_us_area_summary.R`
   reads both RCMS Excel files (note: the 2010 and 2020 files have
   different column layouts — 2010 carries its FIPS/name/state columns
   at the end under different names, `TOTCNG`/`TOTADH`/`POP2010`, versus
   2020's `TOTCNG_2020`/`TOTADH_2020`/`POP2020` at the start), applies
   the FIPS crosswalk, and writes
   `apps/regions/us/data/area_summary_county.{json,csv}` following the
   `area_summary_ta.json` row contract, with tracked source extracts at
   `apps/regions/us/data/source/*.csv`. Manifest-equivalent provenance
   lives inside `area_summary_county.json`'s `source_datasets` block
   (per-source URL, licence text, retrieval date, access/redistribution
   notes), following the shape of
   `docs/manifests/vu-census-religion-2009-2020-d17f5596eca1.json`.
4. Region page: `apps/regions/us/index.html`, `REGION_CONFIG` with
   `metricLabels` (adherents wording) and `metricsAvailable` (hides
   no-religion and place-density metrics that do not apply to this
   construct or data state) — the minimal shared-module extension
   documented in `docs/development/adding-a-region.md`.
5. Verification: county sums cross-checked against ARDA's own published
   state/national summary statistics (see Validation below); join
   coverage counts; NZ and VU pages re-verified byte-identical in
   behaviour after the shared-module change.

## Validation

- National totals (2010, from the raw county file's own column sums):
  344,894 congregations (exact match to ARDA's published national
  summary), 308,745,538 population (exact match), 150,596,792 adherents
  (0.06% below ARDA's published 150,686,156 — a genuine small
  discrepancy between ARDA's summary statistic and its own downloadable
  county file, present before any crosswalk or pipeline step; not an
  artefact of this build).
- Alabama 2020 state total: this pipeline's county sum gives 3,194,369
  adherents on a population of 5,024,279 (63.6%); ARDA's independently
  published 2020 national-overview chapter states 3,195,509 adherents on
  5,024,279 population (63.6%). Population matches exactly; adherents
  differ by 0.036%, consistent with the same small residual pattern seen
  nationally.
- 31 (2010, ARDA's own count) / 30 (2020, this build) counties nationally
  have reported adherents exceeding population — expected and documented
  by ARDA (census undercount, membership overcount, or county of
  residence differing from county of congregational membership,
  especially in Virginia's independent cities).
- Join coverage: 3,143/3,143 (2020), 3,143/3,143 (2010, post-crosswalk).

## Risks and open questions

- Denomination participation differs somewhat between the 2010 and 2020
  waves (372 groups in 2020 vs 236 in 2010), so the adherents-per-100
  change metric should be read as indicative of direction, not a precise
  rate.
- No US OSM place-of-worship extraction yet; the places-per-population
  and place-density metrics are unavailable until that pass is done.
- The construct (institutional adherence claimed by participating
  religious bodies) is not comparable to survey-based religious
  identification measures. PRRI and Pew both run large US religion
  surveys with a self-identification construct closer to NZ/VU census
  affiliation, but at coarser geography (state or region, not county)
  and as periodic survey releases rather than a stable public file
  series; noted here as an alternative construct, not built.
- The ten crosswalked 2010 counties are an approximation where a 2010
  area's total is attributed to one 2020 successor rather than split
  proportionally; documented per-row in the crosswalk file and flagged
  `county_boundary_change_crosswalked` in the data.

## Deep-history potential

The Census of Religious Bodies (1906, 1916, 1926, 1936) has county
tables at ARDA under the same access pattern confirmed working here
(`1906CENSCT`, `1916CENSCT`, `1926CENSCT`, `1936CENSCT` in ARDA's
dataset picker) — not verified for exact OSF links or format this
sitting; a natural next step once the modern waves are stable. The
Churches and Church Membership studies for 1952, 1971, 1980, 1990, and
2000 sit at the same archive and would extend the county series back
before 2010 in a follow-up build.
