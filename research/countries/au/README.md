# Country data map: Australia (AU)

## Status

- **Tier**: A (buildable now)
- **Build state**: survey verified
- **Last verified**: 2026-07-07; verification URLs:
  <https://www.abs.gov.au/census/find-census-data/datapacks> and
  <https://www.abs.gov.au/census/find-census-data/datapacks/download/2021_GCP_SA2_for_AUS_short-header.zip>

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| Australian Bureau of Statistics (ABS), Census General Community Profile DataPacks, table `G14` | census religious affiliation | SA1 public; use SA2 first | 2011, 2016, 2021 | ZIP of CSV files plus metadata | open | ABS website copyright terms; attribute ABS |
| ABS, historical census volumes, `2112.0 Census of the Commonwealth of Australia, 1911` and later volumes | census religious affiliation | varies by volume; usually state or larger historical areas | 1911 onward | PDF or scanned statistical volumes | open | ABS or public-domain historical reporting; confirm per volume |

## Boundaries

- Official boundary files: ABS Australian Statistical Geography Standard
  (ASGS) Edition 3 digital boundary files, GeoPackage or shapefile,
  <https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs/edition-3-july-2021-june-2026/access-and-downloads/digital-boundary-files>.
- Use 2021 SA2 boundaries first. Later waves need 2011 and 2016 ASGS
  boundaries or an ABS correspondence table before a harmonised trend map.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not yet run for this survey card.
- Country-specific registers: Australian Charities and Not-for-profits
  Commission charity register, state heritage registers, Trove newspapers,
  denominational yearbooks, diocesan directories, local-history societies.

## First visualisation

Religious-affiliation percent by SA2, censuses 2011, 2016, and 2021, on
2021 SA2 boundaries after a correspondence pass.

## Build recipe

1. Extract: start with `2021Census_G14_AUST_SA2.csv` from the 2021
   General Community Profile SA2 DataPack; repeat for 2016 and 2011
   equivalent DataPack religion tables.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`,
   with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: join on `SA2_CODE_2021` to the ASGS Edition 3
   `SA2_2021_AUST_GDA2020` shapefile or GeoPackage.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: compare summed SA2 counts with ABS state and national
   totals, verify join coverage, and record ABS attribution.

## Risks and open questions

- Religious affiliation is voluntary and differs from attendance,
  membership, or site counts.
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
