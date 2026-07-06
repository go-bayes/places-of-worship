# Country data map: United States (US)

One page per country, one consistent structure. This card is the single
place a reader uses to learn whether a country data map is feasible,
what it shows, and what building it requires. Update the card when
sources are verified or the build advances; record status honestly.

## Status

- **Tier**: A (buildable now)
- **Build state**: map live (county level, 1952, 1971, 1980, 1990,
  2000, 2010, 2020)
- **Last verified**: 2026-07-06

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| Churches and Church Membership / U.S. Religion Census (RCMS), Association of Religion Data Archives (ARDA) | congregations and adherents or members reported by religious bodies (institutional presence) | county | 1952, 1971, 1980, 1990, 2000, 2010, 2020 | Excel/SPSS/Stata/ASCII, county file per wave | open, no account or registration; files hosted on OSF behind an ARDA click-through citation notice | no formal EULA; cite ARDA and the original collectors; "as is"; no redistribution restriction on derived or aggregated products found |
| Churches and Church Membership / U.S. Religion Census (RCMS), ARDA | same-study state totals used for validation | state | 1952, 1971, 1980, 1990, 2000, 2010, 2020 | Excel/SPSS/Stata/ASCII, state file per wave | open, same access pattern | same ARDA click-through terms |
| Census of Religious Bodies (federal), ARDA | church-reported membership by denomination | county | 1906, 1916, 1926, 1936 | data archive files and codebooks | open, same access pattern | same ARDA click-through terms; not built because the county files fail the inclusion rule |
| Statistics of Churches in the United States, ARDA | church statistics by denomination | county | 1890 | data archive files and codebooks | open, same access pattern | same ARDA click-through terms; not built because the county file fails the inclusion rule |

The United States census asks no religion question. The RCMS/ARDA series
measures **congregations and adherents reported by religious bodies**:
institutional presence claimed by participating denominations and faith
groups. The US construct differs from the NZ/VU "religious affiliation"
construct, which comes from a stated-response census item. Every US map
label says "adherents" or "congregations".

### Verification record (2026-07-06)

The playbook's source claims were verified by direct ARDA page lookup and
`curl` before downloads:

- ARDA lists the county files as separate datasets: `CMS52CNT`,
  `CMS71CNT`, `CMS80CNT`, `CMS90CNT`, `RCMSCY`, `RCMSCY10`, and
  `RCMSCY20`. Each Downloads tab exposes OSF links that return HTTP 200
  without login.
- ARDA lists matching state validation files: `CMS52ST`, `CMS71ST`,
  `CMS80ST`, `CMS90ST`, `RCMSST`, `RCMSST10`, and `RCMSST20`.
- The relevant county codebooks expose joinable county identifiers and
  same-study county population fields: `STCODE`/`CCODE` and `TOTPOP` in
  1952; `FIPS` and `TOTPOP` in 1971, 1980, and 1990; `FIP` and
  `POP200` in 2000; `FIPS` and `POP2010` in 2010; `FIPS` and
  `POP2020` in 2020.
- ARDA's Downloads page shows an in-page click-through notice with
  JavaScript-toggled text. The notice is not a login form. It asks users
  to cite ARDA and original collectors, use the data responsibly, accept
  the files "as is", and note Indiana governing law. No restriction on
  derived or aggregated products was found.
- Census Bureau cartographic boundary file
  (`cb_2020_us_county_5m.zip`, 1:5,000,000, 2020 vintage) downloads
  directly from `www2.census.gov`, HTTP 200, public domain.

All new raw workbooks and codebooks sit in the git-ignored cache
`data/raw/us_rcms/`; `data/raw/us_rcms/sources.csv` records OSF URL,
canonical ARDA URL, retrieval date, publisher, licence terms, SHA-256
hash, and content notes.

## Boundaries

- U.S. Census Bureau cartographic boundary file, counties,
  1:5,000,000, 2020 vintage (published 2021-01-24, public domain).
  The build filters to the 50 states plus District of Columbia (3,143 of
  3,234 features; territories dropped, matching RCMS coverage).
- Join key: 5-digit county Federal Information Processing Series (FIPS)
  code (`GEOID`). The 2020 vintage boundary file predates Connecticut's
  2022 planning-region switch; the county layout remains suitable for
  this build.
- The build joins every wave to the 2020 county layer through
  `apps/regions/us/data/source/fips_crosswalk_to_2020.csv`. The
  crosswalk is year-scoped because several historical codes either
  disappeared or changed meaning before the 2020 boundary set.
- Historical county rows that crosswalk onto one 2020 successor are
  flagged `boundary_change_crosswalked`. Every pre-2010 row is also
  flagged `wave_coverage_differs`.
- Source rows left unmatchable after the crosswalk: 0 in every live
  wave.
- 2020 boundary counties without a mapped source row: 72 in 1952; 6 in
  1971; 6 in 1980; 6 in 1990; 5 in 2000; 1 in 2010; 0 in 2020. The
  manifest lists the FIPS values. The main recurring gaps are later
  Alaska county-equivalents and Broomfield, Colorado; 1952 also lacks
  Alaska and Hawaii and many Virginia independent cities.

## Places-of-worship layer

- No US-specific OpenStreetMap extraction has been built yet. The page
  shows the existing global OSM places-overview layer, but the
  `area_summary_county` product carries no `place_count` field.
- A future US OSM extraction pass (`amenity=place_of_worship`
  point-in-polygon assignment to counties) would populate
  places-per-population and place-density metrics.

## Current visualisation

Adherents per 100 population by county, ARDA Churches and Church
Membership / U.S. Religion Census waves 1952 to 2020, on 2020 county
boundaries. The change metric uses adjacent available waves.

## Build recipe

1. Download county workbooks and codebooks for `CMS52CNT`, `CMS71CNT`,
   `CMS80CNT`, `CMS90CNT`, `RCMSCY`, `RCMSCY10`, and `RCMSCY20`; download
   state validation workbooks and codebooks for `CMS52ST`, `CMS71ST`,
   `CMS80ST`, `CMS90ST`, `RCMSST`, `RCMSST10`, and `RCMSST20`.
2. Keep raw downloads in `data/raw/us_rcms/` and record provenance plus
   SHA-256 hashes in `data/raw/us_rcms/sources.csv`.
3. Boundaries: `scripts/build_us_county_boundaries.R` reads the Census
   shapefile, filters to 50 states plus District of Columbia, simplifies,
   and writes `apps/regions/us/data/counties_2020.geojson`.
4. Extraction and governed product:
   `scripts/build_us_area_summary.R` reads all seven county workbooks,
   applies `fips_crosswalk_to_2020.csv`, writes per-wave extracts under
   `apps/regions/us/data/source/`, and writes
   `apps/regions/us/data/area_summary_county.{json,csv}`.
5. Manifest: `docs/manifests/us-rcms-county-1952-2020.json` records
   product hashes, source attribution, per-wave join coverage,
   state-file validation, skipped federal waves, and all unmapped 2020
   boundary FIPS values.
6. Region page: `apps/regions/us/index.html` sets US-specific labels,
   notes that historical coverage differs by wave, and hides no-religion
   and place-density metrics until those constructs exist for the US
   map.

## Validation

County sums were compared with the matching ARDA state file for each
wave before any county-to-2020 crosswalk:

| Wave | Source county rows | Complete source rows | Mapped 2020 counties | Join coverage | State-file validation |
| --- | ---: | ---: | ---: | ---: | --- |
| 1952 | 3,075 | 3,075 | 3,071 | 3,071/3,143 | exact across 49 matched states; congregations 182,856, adherents/members 74,125,462, population 150,635,574 |
| 1971 | 3,141 | 3,092 | 3,137 | 3,137/3,143 | mismatch across 50 matched states; county sums are lower by 5,530 congregations, 1,833,392 adherents, and 98,351 population; the state file omits District of Columbia |
| 1980 | 3,141 | 3,099 | 3,137 | 3,137/3,143 | congregations and adherents match across 50 matched states; county population is lower by 13,997; the state file omits District of Columbia |
| 1990 | 3,141 | 3,104 | 3,137 | 3,137/3,143 | congregations and adherents match across 50 matched states; county population is lower by 10; the state file omits District of Columbia |
| 2000 | 3,142 | 3,140 | 3,138 | 3,138/3,143 | exact across 51 matched states; congregations 268,254, adherents 141,371,963, population 281,421,839 |
| 2010 | 3,149 | 3,143 | 3,142 | 3,142/3,143 | exact across 51 matched states; congregations 344,894, adherents 150,596,792, population 308,745,538 |
| 2020 | 3,143 | 3,143 | 3,143 | 3,143/3,143 | population matches exactly across 51 matched states; county sums are lower by 644 congregations and 214,571 adherents than the state file |

The 2020 state-file mismatch is a source discrepancy between ARDA's
county and state workbooks: population matches exactly, while
congregations and adherents do not. The build uses the county file for
county rows and records the state-file comparison in the manifest.

## Coverage caveats

- The 1952 county file covers the continental United States plus
  District of Columbia. Alaska and Hawaii are absent. The file includes
  only a limited Black-denomination estimate; 1952 supports only limited
  comparison with later Black-denomination coverage.
- The 1971 study includes 53 denominations and ARDA states that these
  represented an estimated 81 percent of church membership in the United
  States. The wave does not systematically cover historically Black
  denominations.
- The 1980 study includes 111 participating bodies. Four Black
  denominations participated; several other large Black churches and
  smaller Black denominations did not.
- The 1990 study includes 133 participating bodies. Three predominantly
  Black denominations participated; other Black denominations remained
  undercovered.
- The 2000 study includes 149 groups. ARDA states that all historically
  African-American denominations were absent from this wave.
- The 2010 and 2020 waves are broader U.S. Religion Census products with
  stronger efforts to include underrepresented groups. Participation and
  definitions still differ across waves; wave-to-wave change is an
  indicative institutional measure.
- Reported adherents can exceed resident population because adherents may
  be counted in a congregation's county rather than a home county, and
  because membership/adherent definitions differ by body.

## Deep-history potential

ARDA has federal Census of Religious Bodies county files for 1906, 1916,
1926, and 1936 (`1906CENSCT`, `1916CENSCT`, `1926CENSCT`,
`1936CENSCT`). The files are available and county-level, and the later
codebooks expose state/county identifiers such as `FIPST` and `FIPCNT`.
The 1906-1936 federal county files fail the Phase 2 inclusion rule
because the county codebooks do not expose a same-study county
population field. The 1906 file also has an apparent total Protestant
field. That field is Protestant-only.

ARDA also has an 1890 county file (`1890CENSCT`) and state file
(`1890CENSST`). The 1890 county file exists, but it lacks a same-study
county population field and has weaker join identifiers than the later
FIPS-coded files. The 1890 county file remains a deep-history lead for a
later boundary-specific build.

The remaining historical work is period-boundary reconstruction. A
period-boundary product would place each wave on its own county
geography, then model comparability across periods. The present build
deliberately avoids that step and maps only rows that can be joined or
crosswalked to 2020 counties.
