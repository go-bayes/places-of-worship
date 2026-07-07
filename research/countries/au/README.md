# Country data map: Australia (AU)

## Status

- **Tier**: A (buildable now)
- **Build state**: first public product built (2021 only)
- **Last verified**: 2026-07-07; verification URLs:
  <https://www.abs.gov.au/census/find-census-data/datapacks>,
  <https://www.abs.gov.au/census/find-census-data/datapacks/download/2021_GCP_SA2_for_AUS_short-header.zip>,
  <https://www.abs.gov.au/census/find-census-data/datapacks/download/2021_GCP_STE_for_AUS_short-header.zip>,
  <https://www.abs.gov.au/census/find-census-data/datapacks/download/2021_GCP_AUS_for_AUS_short-header.zip>,
  <https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs/edition-3-july-2021-june-2026/access-and-downloads/digital-boundary-files>, and
  <https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs/edition-3-july-2021-june-2026/access-and-downloads/correspondences>.

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| Australian Bureau of Statistics (ABS), Census General Community Profile DataPacks, table `G14` | census religious affiliation | SA2 built first | 2021 built; 2011 and 2016 deferred | ZIP of CSV files plus metadata | open | ABS DataPacks are licensed under Creative Commons Attribution 4.0; ABS website copyright terms; attribute ABS |
| ABS, historical census volumes, `2112.0 Census of the Commonwealth of Australia, 1911` and later volumes | census religious affiliation | varies by volume; usually state or larger historical areas | 1911 onward | PDF or scanned statistical volumes | open | ABS or public-domain historical reporting; confirm per volume |

## Boundaries

- Official boundary files: ABS Australian Statistical Geography Standard
  (ASGS) Edition 3 digital boundary files, GeoPackage or shapefile,
  <https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs/edition-3-july-2021-june-2026/access-and-downloads/digital-boundary-files>.
- Use 2021 SA2 boundaries first. The built boundary layer keeps all 2,473
  ASGS Edition 3 SA2 features and simplifies the public GeoJSON to 2,972,041
  bytes. The 2021 G14 SA2 table has 2,472 rows; the boundary-only feature is
  `ZZZZZZZZZ` (`Outside Australia`), which has no G14 row.
- Later waves require official ABS population-weighted SA2 correspondence
  files. The current ASGS Edition 3 correspondence page provides the 2016 to
  2021 file, but the official 2011 to 2021 file was not available through the
  current page or tested direct ABS paths on 2026-07-07. The project must not
  construct its own correspondence.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not yet run for this survey card.
- Country-specific registers: Australian Charities and Not-for-profits
  Commission charity register, state heritage registers, Trove newspapers,
  denominational yearbooks, diocesan directories, local-history societies.

## First visualisation

Religious-affiliation percent and no-religion percent by 2021 SA2 for the
2021 Census. The denominator is people counted at place of usual residence
with a stated religious-affiliation response: ABS G14 `Tot_P` minus
`Religious_affiliation_ns_P`, which comprises `Not stated` and
`Inadequately described`. This follows the NZ and IE convention of using
stated religion responses. The no-religion numerator uses `SB_OSB_NRA_Tot_P`,
the ABS top-level `Secular Beliefs and Other Spiritual Beliefs and No
Religious Affiliation` total.

## Build recipe

1. Build script: `scripts/build_au_area_summary.R`.
2. Raw cache: `data/raw/au_census/`, with `sources.csv` recording filename,
   URL, retrieval date, publisher, licence text, and SHA-256 hash for each
   downloaded ABS zip.
3. Governed product: `apps/regions/au/data/area_summary_sa2.json` and
   `apps/regions/au/data/area_summary_sa2.csv`, with manifest
   `docs/manifests/au-census-religion-2021.json`.
4. Boundaries: `apps/regions/au/data/sa2_2021.geojson`, joined from
   `SA2_CODE_2021` to `SA2_CODE21` and simplified from ASGS Edition 3
   GDA2020 boundaries.
5. Region page: `apps/regions/au/index.html`, using the shared country-map
   runtime with ABS census and ASGS attribution shown on the page.
6. Validation: 2021 joins 2,472 of 2,472 G14 SA2 rows. State and territory
   reconciliation against ABS STE G14 rows has maximum absolute difference
   100. National reconciliation against the ABS AUST G14 row has maximum
   absolute difference 198. Boundary validation is exact against the ASGS
   feature count: 2,473 of 2,473 features.

## Correspondence findings (verification pass 2026-07-07)

- The official ABS SA2 2016-to-2021 correspondence exists on the ASGS
  Edition 3 correspondences page (population-weighted, CC BY 4.0) —
  this unlocks a 2016 backfill wave.
- No direct official SA2 2011-to-2021 correspondence was found, and ABS
  does not document a sanctioned chaining rule; 2011 therefore stays
  deferred rather than crosswalked by the project.

## Risks and open questions

- Religious affiliation is voluntary and differs from attendance,
  membership, or site counts.
- ABS random adjustment can leave SA2 sums different from independently
  published state and national G14 rows. The manifest records the observed
  differences separately for the 2021 state/territory and national
  reconciliations.
- The no-religion public metric uses the ABS top-level `SB_OSB_NRA_Tot_P`
  aggregate, which is broader than the narrower ABS no-religion subcategory.
- The 2011 and 2016 waves are deferred until the official ABS 2011 to 2021
  SA2 correspondence is available and unambiguous.
- Historical religion data before 2011 require PDF extraction and geography
  harmonisation; they should form a separate extension.
- SA1 public tables are available, but suppression and file size make SA2 the
  first practical map unit.

## Deep-history potential

ABS historical census volumes support a national religion series from 1911.
Earlier colonial census volumes, Trove, state archives, church almanacs,
diocesan archives, Sands and other city directories, local histories, and
heritage registers can supply older site-level evidence. Mission and
protectorate records require separate care for Indigenous communities and
institutional power relations.
