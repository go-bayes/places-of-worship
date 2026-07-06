# Country data map: Niue (NU)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [Niue Statistics population and housing census portal](https://niuestatistics.nu/census/population-housing/) | census reports and village profiles | village profiles; religion-by-village table needs verification | 1997, 2001, 2006, 2011, 2017, 2022 | PDF | open | website terms; confirm reuse |
| [Niue 2022 census report](https://niuestatistics.nu/download/35/census/2793/2022-niue-census-of-population-and-housing-report.pdf) | census affiliation if table is present | national or village, pending extraction | 2022 | PDF | open | website terms; confirm reuse |
| [PDH Niue 2011 Population and Housing Census](https://microdata.pacificdata.org/index.php/catalog/24) | census affiliation metadata | record-level metadata | 2011 | metadata | open metadata; data access varies | PDH terms |

## Boundaries

- Official boundary files: geoBoundaries NIU ADM1 can anchor village maps.
- The main harmonisation issue is matching village profile labels to boundary names.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): public Overpass queries timed out; rerun before build.
- Country registers to survey: Ekalesia Niue, Catholic and LDS records, and Niue Archives.

## First visualisation

Religious-affiliation percent by village for the latest wave that exposes village religion, with 2011 and older waves added after extraction.

## Build recipe

1. Extract: inspect 2022 and earlier PDFs for religion tables and village profiles, then backfill from PDH metadata.
2. Governed product: create `area_summary` rows by village and wave.
3. Boundaries: download geoBoundaries NIU ADM1 and build a village-name crosswalk.
4. Region page: add `REGION_CONFIG` after the village join is verified.
5. Verification: test village totals against national census totals.

## Risks and open questions

- The sweep verified a strong report series, but not a repeated village religion table.
- Small village counts may require suppression-aware publication.

## Deep-history potential

Ekalesia Niue, LMS, Catholic, LDS, and Niue Archives material can support older worship-site histories and village-level continuity claims.
