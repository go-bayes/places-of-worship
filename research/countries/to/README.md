# Country data map: Tonga (TO)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [Tonga Statistics Department 2021 religion table](https://tongastats.gov.to/download/266/general-tables/7664/4-religion.xlsx) | census affiliation | village | 2021 | XLSX | open | website terms; confirm reuse |
| [Tonga Statistics Department 2021 census reports](https://tongastats.gov.to/census-2/population-census-3/census-report-and-factsheet/) | census affiliation context | division, district, village in table set | 2021 | PDF | open | website terms; confirm reuse |
| [PDH Tonga 1996 Population and Housing Census](https://microdata.pacificdata.org/index.php/catalog/182) | census affiliation metadata | record-level metadata; public subnational table not verified | 1996 | metadata | open metadata; data access varies | PDH terms |

## Boundaries

- Official boundary files: geoBoundaries TON ADM1 can anchor divisions; village boundaries still need an official or SPC source.
- Build 2021 first, then create concordances if earlier reports expose comparable district or village tables.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): public Overpass queries timed out; rerun before build.
- Country registers to survey: Free Wesleyan Church, Catholic Diocese of Tonga, LDS mission records, and Tonga National Archives.

## First visualisation

Religious-affiliation percent by village for the 2021 census, with division and district roll-ups for navigation.

## Build recipe

1. Extract: read the 2021 `4-religion.xlsx` sheets G18-G20 and retain the workbook URL in provenance.
2. Governed product: create `area_summary` rows for village, district, and division where labels join cleanly.
3. Boundaries: begin with geoBoundaries TON ADM1; add a verified village boundary source before publishing village polygons.
4. Region page: add `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: test sheet totals against the 2021 census report and confirm denomination abbreviations.

## Risks and open questions

- Earlier waves need comparable subnational tables before this becomes a longitudinal map.
- Village boundaries are the main blocker for the strongest first visualisation.

## Deep-history potential

Free Wesleyan, Catholic, LDS, and other church registers can document long-run site histories. Tonga National Archives and Wesleyan missionary records are the likely starting points.
