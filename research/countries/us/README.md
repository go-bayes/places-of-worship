# Country data map: United States (US)

The United States map now shows a county-level institutional religion
series from 1850 to 2020. The map does not show census
self-identification: the United States census asks no religion question.
The construct changes across source eras, and the page labels that
change directly.

## Status

- **Tier**: A (live, with source caveats)
- **Build state**: map live at county level, with NHGIS period-boundary
  layers for 1850, 1860, 1870, 1890, and 1930, plus the existing 2020
  county layer for 1952 to 2020
- **Last verified**: 2026-07-06

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| IPUMS NHGIS, nineteenth-century census church statistics | churches or church edifices, seating accommodation, and church property value by denomination | county | 1850, 1860, 1870, 1890 | API extract, CSV plus codebooks | registered IPUMS API key; raw extract cached under `data/raw/us_nhgis/` | raw redistribution requires permission; JB authorised attributed derived rates/counts for the research map, pending IPUMS/NHGIS confirmation |
| IPUMS NHGIS, Census of Religious Bodies | members reported by religious bodies, with adjacent decennial population references supplied by NHGIS | county | 1906, 1916, 1926, 1936 | API extract, CSV plus codebooks | registered IPUMS API key; raw extract cached under `data/raw/us_nhgis/` | same NHGIS terms and JB licence position |
| Churches and Church Membership / U.S. Religion Census (RCMS), Association of Religion Data Archives (ARDA) | congregations and adherents or members reported by religious bodies | county | 1952, 1971, 1980, 1990, 2000, 2010, 2020 | Excel/SPSS/Stata/ASCII, county file per wave | open, no account or registration; files hosted on OSF behind an ARDA click-through citation notice | no formal EULA found; cite ARDA and the original collectors; no redistribution restriction on derived or aggregated products found |
| RCMS/ARDA state files and NHGIS state/nation extracts | state or national totals used for validation | state; nation where exposed | 1850 to 2020 | source-specific validation files | same access pattern as the corresponding source | same source terms |

The live map uses one per-100 metric slot because the shared country-map
runtime has fixed metric keys. The label and onboarding text name the
construct shift: 1850-1890 shows church seating per 100 population,
1906-1936 shows members per 100 population, and 1952-2020 shows
adherents or members per 100 population. The NHGIS derived extracts also
carry churches or edifices per 10,000 residents, but that optional metric
is not exposed as a separate map control without changing the shared
runtime.

### NHGIS verification record (2026-07-06)

The NHGIS metadata API identified these county datasets and tables:

| Wave | Dataset | NHGIS ID | Tables used |
| --- | --- | --- | --- |
| 1850 | `1850_cPAX` | `ds10` | `NT1`, `NT47`, `NT48`, `NT49`, `NT50`, `NT51`, `NT52` |
| 1860 | `1860_cPAX` | `ds14` | `NT1`, `NT26`, `NT28`, `NT30`, `NT32`, `NT33`, `NT34` |
| 1870 | `1870_cPAX` | `ds17` | `NT1`, `NT41`, `NT42`, `NT43`, `NT44`, `NT45`, `NT46` |
| 1890 | `1890_cRelig` | `ds28` | `NT1`, `NT3`, `NT4`, `NT5`, `NT7`, `NT8`, `NT9`, `NT11`, `NT12` |
| 1906 | `1906_cRelig` | `ds33` | `NT1`, `NT2`, `NT3` |
| 1916 | `1916_cRelig` | `ds41` | `NT1`, `NT2`, `NT3` |
| 1926 | `1926_cRelig` | `ds51` | `NT1`, `NT2`, `NT3` |
| 1936 | `1936_cRelig` | `ds74` | `NT1`, `NT2`, `NT3` |

The NHGIS extract API returned county extract `1` and validation extract
`2`. Raw ZIPs remain ignored in `data/raw/us_nhgis/`; `sources.csv`
records dataset codes, table codes, shapefile codes, retrieval date,
downloaded ZIP hashes, the IPUMS NHGIS citation, and JB's licence
position. Raw NHGIS ZIPs are not committed.

## Access the data yourself

This project does not redistribute source data; the map shows derived rates with attribution. To obtain the data from the source of record:

- **Source of record**: IPUMS NHGIS, University of Minnesota, <https://api.ipums.org/metadata/nhgis/datasets/1850_cPAX?version=2>; Association of Religion Data Archives (ARDA), <https://www.thearda.com/data-archive?fid=CMS52CNT>.
- **Exact tables**: NHGIS datasets `1850_cPAX`/`ds10`, `1860_cPAX`/`ds14`, `1870_cPAX`/`ds17`, `1890_cRelig`/`ds28`, `1906_cRelig`/`ds33`, `1916_cRelig`/`ds41`, `1926_cRelig`/`ds51`, and `1936_cRelig`/`ds74`; RCMS/ARDA county files `CMS52CNT`, `CMS71CNT`, `CMS80CNT`, `CMS90CNT`, `RCMSCY`, `RCMSCY10`, and `RCMSCY20`.
- **Licence**: NHGIS: derived rates are published with citation and a pointer to the original NHGIS data, per the project ruling recorded in the manifest (`licence_position`); IPUMS's licensing reply is pending. RCMS: ARDA click-through research-use terms for source workbooks; U.S. Census Bureau boundary files public domain. Derived products attribute ARDA, the original studies, and the U.S. Census Bureau.
- **Our extraction scripts**: `scripts/build_us_nhgis_deep_past.R` and `scripts/build_us_area_summary.R`.
- **Retrieval recipe and hashes**: `docs/manifests/us-nhgis-county-1850-1936.json` and `docs/manifests/us-rcms-county-1952-2020.json`.
- **Restricted extracts**: NHGIS source extracts live in the project's private research tier and are not redistributed; the retrieval recipe remains public.

## Boundaries

- The existing `county` level remains the 2020 U.S. Census Bureau county
  layer used for 1952 to 2020.
- NHGIS period county boundary levels were added for `county_1850`,
  `county_1860`, `county_1870`, `county_1890`, and `county_1930`.
  These use the NHGIS 2008 TIGER/Line+ basis and are simplified with a
  1.5 km tolerance. File sizes range from 1.46 MB to 2.63 MB.
- The nineteenth-century rows are not crosswalked onto 2020 counties.
  Each wave joins by NHGIS `GISJOIN` to its period boundary. The
  1906-1936 waves use one 1930 boundary level so users can compare the
  Census of Religious Bodies sequence on a single period geography.
- Every NHGIS row carries `wave_coverage_differs`. Rows from 1906, 1916,
  1926, and 1936 also carry `period_boundary_vintage_differs`.

## Places-of-worship layer

No US-specific OpenStreetMap extraction has been built yet. The page
shows the existing global OSM places-overview layer, but the governed
US area-summary products do not treat OSM place counts as the historical
county metric.

## Current visualisation

The default view remains 2020 counties and the 2020 U.S. Religion Census
rate. Users can switch geography to the NHGIS period levels to view the
deep-history series. The map metric is labelled "Seating, members,
or adherents per 100 population" because the source construct changes
across eras.

## Build recipe

1. Use the IPUMS API key in `data/raw/us_nhgis/.ipums.env` only as the
   Authorization header. Do not print, copy, commit, or archive the key.
2. Submit `data/raw/us_nhgis/nhgis_deep_past_extract_request.json` to
   the NHGIS extract API for county tables plus period county
   shapefiles. Submit
   `data/raw/us_nhgis/nhgis_deep_past_validation_extract_request.json`
   for state and nation validation tables.
3. Keep raw ZIPs and unpacked source files in `data/raw/us_nhgis/`.
   Record provenance and ZIP hashes in `data/raw/us_nhgis/sources.csv`.
4. Run `Rscript scripts/build_us_nhgis_deep_past.R` to write derived
   extracts, simplified boundaries, area-summary JSON/CSV files, and
   `docs/manifests/us-nhgis-county-1850-1936.json`.
5. The existing RCMS build remains
   `Rscript scripts/build_us_area_summary.R`.

## Validation

NHGIS county sums were compared with NHGIS state totals for every wave.
The nineteenth-century waves were also compared with NHGIS national
totals, because those datasets expose the nation geography through the
API. The API does not expose nation geography for the 1906-1936
religious-body datasets.

| Wave | Source rows | Mapped rows | Join coverage | Validation result |
| --- | ---: | ---: | ---: | --- |
| 1850 | 1,634 | 1,626 | 1,626/1,632 | state and nation mismatch: county sums differ by 1 church, 1,000 seats, and $2,998 property value; population matches |
| 1860 | 2,102 | 2,097 | 2,097/2,126 | state and nation mismatch: county sums differ by 41,134 population, 105 seats, and $1,447 property value; churches match |
| 1870 | 2,316 | 2,310 | 2,310/2,334 | state and nation mismatch: county sums are lower by 10 organisations, 9 edifices, 5,875 sittings, and $67,502 property value; population matches |
| 1890 | 2,798 | 2,784 | 2,784/2,799 | state and nation mismatch: county sums differ by 13,072 population and are lower by 168 organisations, 152 edifices, 30,850 seats, $89,187 property value, and 10,450 members |
| 1906 | 2,952 | 2,902 | 2,902/3,110 | state mismatch: county sums are lower by 57,835 population and 488,667 members |
| 1916 | 3,036 | 3,005 | 3,005/3,110 | state mismatch: county sums are lower by 190,946 population and 54,424 members |
| 1926 | 3,100 | 3,100 | 3,100/3,110 | state mismatch: members are lower by 56,742; population matches |
| 1936 | 3,098 | 3,098 | 3,098/3,110 | matched states exact; state file coverage differs from the 1930 boundary set |

`docs/manifests/us-nhgis-county-1850-1936.json` records the full warning
set, missing boundary/source `GISJOIN` values, validation files, product
hashes, and the raw-archive status.

## Coverage caveats

- NHGIS source coverage, denominator years, and religious-body
  definitions differ across waves. Treat adjacent-wave changes as
  descriptive institutional changes. They do not measure stable
  affiliation change.
- The 1906 denominator is the 1910 county population supplied by NHGIS.
  The 1916, 1926, and 1936 denominators are the 1920, 1930, and 1940
  county populations supplied by NHGIS.
- The 1952 file covers the continental United States plus District of
  Columbia. Alaska and Hawaii are absent. The file includes only a
  limited Black-denomination estimate.
- The 1971 study includes 53 denominations and does not systematically
  cover historically Black denominations.
- The 1980 and 1990 studies include partial Black-denomination coverage.
  The 2000 wave excludes historically African-American denominations.
- The 2010 and 2020 U.S. Religion Census waves are broader products, but
  participation and definitions still differ across religious bodies.

## Remaining work

The raw NHGIS ZIPs still need private archival upload to
`gs://places-of-worship-private-sync/raw_sources/us_nhgis/`. JB also
needs to ask IPUMS/NHGIS whether attributed derived county rates on a
research map are within their licence or require permission. Record the
answer in the manifest when it arrives.
