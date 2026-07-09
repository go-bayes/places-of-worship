# Country data map: Zambia (ZM)

## Status

- **Tier**: A (buildable now)
- **Build state**: map live (province, 2010 percent-only + 2022)
- **Last verified**: 2026-07-09 (build: `scripts/build_zm_area_summary.R`; manifest: `docs/manifests/zm-census-religion-2010-2022.json`)

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| ZamStats 2022 CPH Series B Religion Descriptive Tables, https://www.zamstats.gov.zm/wp-content/uploads/2026/04/Religion-Descriptive-Tables-Final.pdf | census affiliation (de facto) | province for the full ten-group breakdown (table B.1); district/constituency only as Christianity vs a bundled remainder (tables B.4/B.5) | 2022 | PDF report | open web | licence not stated |
| ZamStats 2010 Census provincial analytical reports (ten volumes), https://www.zamstats.gov.zm/census-and-statistics/ | census affiliation (printed figure percentages; no counts) | province | 2010 | PDF reports | open web | licence not stated |
| ZamStats 2022 Census National Analytical Report, https://www.zamstats.gov.zm/wp-content/uploads/2025/08/2022-Census-National-Analytical-Report.pdf | religion figures 3.13-3.16 (reconciliation authority); 2010/2022 population by province | national religion + province populations | 2010, 2022 | PDF report | open web | licence not stated |
| Zambia Data Portal, https://zambia.opendataforafrica.org/ | census-derived religion tables where exposed | unverified | 2010, 2022 | web table/API portal | HTTP 403 to automated retrieval (2026-07-09) | portal terms |

Constructs are not interchangeable: census affiliation and DHS respondent affiliation must stay in separate layers.

### Extraction findings (2026-07-09)

- **2022, shipped**: table B.1 gives the de facto population in ten religion
  groups for the ten provinces. Its printed column header follows the
  questionnaire code order (1 Christianity ... 9 Non-Religious, 10 Other
  Religious Groups) but the value columns cannot carry those labels: the
  census's own analytical figures (None 1.3%, African Traditional 0.2%,
  Other 0.1% nationally; None 1.8/0.8 male/female) are consistent only with
  Non-Religious = 233,260 and African Traditional = 30,502 nationally. The
  build adopts that unique consistent assignment and asserts it against
  figures 3.13-3.16; the ambiguity does not affect either headline metric
  (religious affiliation = total − no religion).
- **2022 district route, deferred**: tables B.4/B.5 publish province,
  district (116) and constituency religion only as Christianity vs a bundled
  "Other Religious Groups" remainder that includes the non-religious, so
  neither religious affiliation (named religions) nor no religion can be
  computed below province level.
- **2010, shipped percent-only**: the ten provincial analytical reports
  (published after the 2011 reform, re-tabulated on the current ten
  provinces including Muchinga) print figure 4.10 with five percentage data
  labels (Protestant, Catholic, Muslim, Other, None; one decimal). Sums are
  99.7-100.0 per province. Counts are not published at province level; the
  2010 National Analytical Report carries religion only as a national figure
  (Protestant 75.3, Catholic 20.2, Muslim 0.5, Other 2.0, None 1.8).
- **2010 Volume 11 (National Descriptive Tables), deferred**: catalogued as a
  print volume (HathiTrust record 102488827); not on the current ZamStats
  site.
- **2000, no wave**: the 2000 provincial analytical reports on the ZamStats
  site carry no religion content (probed: Lusaka, zero matches). Zambia 2000
  religion exists as IPUMS International microdata (registration required,
  no redistribution); deferred.
- **Zambia Data Portal**: returned HTTP 403 to automated retrieval; open probe.

## Access the data yourself

This project does not redistribute source data; the map shows derived
rates with attribution. To obtain the data from the source of record:

- **Source of record**: Zambia Statistics Agency, https://www.zamstats.gov.zm/population-census/
  (Religion Descriptive Tables and analytical reports under census publications).
- **Exact tables**: 2022 CPH Series B Religion Descriptive Tables, table B.1
  (population (de facto) by religion affiliation and province); 2010 Census
  provincial analytical reports, figure 4.10 (percentage distribution of
  population by religious affiliation), ten volumes; 2022 Census National
  Analytical Report, section 2.3 (population by province 2010/2022) and
  figures 3.13-3.16 (religion).
- **Licence**: ZamStats census reports are open downloads with attribution
  requested; no explicit reuse licence is stated. Boundaries: geoBoundaries
  ZMB ADM1, CC BY 4.0 (boundary source Zambia Data Hub).
- **Our extraction script**: `scripts/build_zm_area_summary.R` — public code
  that turns the source tables into the map's `area_summary` product, with
  the category-label reconciliation asserted in the build.
- **Retrieval recipe and hashes**: `docs/manifests/zm-census-religion-2010-2022.json`
  — URLs, retrieval steps, and SHA-256s for every object used.

## Boundaries

- Official boundary files: geoBoundaries ZMB ADM1 provinces (10), CC BY 4.0,
  boundary source Zambia Data Hub (Zambia NSDI), release `9469f09`, source
  data update 2023-01-19; shapeISO carries ISO 3166-2 ZM-NN codes used as
  area codes. Committed as the simplified
  `apps/regions/zm/data/zm_province_2011.geojson` (50 m tolerance).
- Boundary decision: the map ships at province (ADM1) because table B.1 is
  the finest table with the full religion breakdown. geoBoundaries ZMB ADM2
  (116 districts, CC BY 4.0, source GRID3/Office of the Surveyor General)
  matches the census's post-2011 116-district structure and is the ready
  route if ZamStats publishes district religion in full categories; it is
  downloaded and hashed in the manifest but unused. Districts multiplied
  from 72 (2011) to 116; both shipped waves avoid the district concordance
  by staying at province level, where the 2010 reports were re-tabulated on
  the current ten provinces (including Muchinga, created 2011).

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not counted during this source
  sweep; run ohsome or Overpass before build.
- Country-specific registers that could seed or verify the layer: Council of
  Churches in Zambia, Zambia Conference of Catholic Bishops, Evangelical
  Fellowship of Zambia, Islamic Supreme Council of Zambia.

## First visualisation

Census religious-affiliation percent by province, 2010 (percent-only) and
2022, on the ten post-2011 provinces. Built: `apps/regions/zm/`.

## Build recipe

1. Extract: `Rscript scripts/build_zm_area_summary.R` (table B.1 via
   pdftotext; 2010 figure percentages transcribed from the rendered chart
   labels; reconciliation assertions against the analytical-report figures).
2. Governed product: `area_summary_province.{json,csv}` per
   `schemas/area-summary.schema.json`, manifest
   `docs/manifests/zm-census-religion-2010-2022.json`.
3. Boundaries: geoBoundaries `ZMB ADM1`, join by normalised province name
   (NorthWestern / North Western / North-Western normalise equal); 10/10 both waves.
4. Region page: `apps/regions/zm/index.html` (REGION_CONFIG per
   `docs/development/adding-a-region.md`).
5. Verification: 2022 rows reconcile exactly to the national row for the
   denominator, religious affiliation, and no religion; parsed counts
   reproduce figures 3.13/3.16 at one-decimal rounding; 2010 figure sums
   99.7-100.0 per province; 2010 province populations sum exactly to the
   printed 13,092,666.

## Risks and open questions

- Table B.1's printed header order conflicts with the analytical-report
  figures (documented and asserted in the build); if ZamStats reprints a
  corrected Series B volume, re-run the build — the assertions fail loudly
  on any change.
- The religion tables are a de facto tabulation (18,340,343) below the de
  jure 2022 census population (19,693,423); the map documents the de facto
  denominator.
- District religion in full categories, 2010 Volume 11, the 2000 wave, and
  the Zambia Data Portal remain open probes (see extraction findings).
- ZamStats download links sit under WordPress uploads paths that have moved
  before; the manifest records SHA-256s for re-verification.

## Deep-history potential

National Archives of Zambia, London Missionary Society records, Catholic
White Fathers and Jesuit mission archives, United Church of Zambia records,
and David Livingstone-related archives.
