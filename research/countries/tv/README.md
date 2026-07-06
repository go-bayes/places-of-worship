# Country data map: Tuvalu (TV)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [Tuvalu Central Statistics Division census portal](https://stats.gov.tv/census/) | census publication series | island table requires report extraction | 2002, 2012, 2017, 2022 | web, PDF | open | website terms; confirm reuse |
| [PDH Tuvalu 2017 Population and Housing Census](https://microdata.pacificdata.org/index.php/catalog/269) | census affiliation metadata | record-level metadata; island table needs extraction | 2017 | metadata | open metadata; data access varies | PDH terms |
| [PDH Tuvalu 2012 Population and Housing Census](https://microdata.pacificdata.org/index.php/catalog/50) | census affiliation metadata | record-level metadata; island table needs extraction | 2012 | metadata | open metadata; data access varies | PDH terms |

## Boundaries

- Official boundary files: geoBoundaries TUV ADM1 can anchor island maps.
- Island names are stable enough for a first pass, but any Funafuti islet handling should be documented.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): public Overpass queries timed out; rerun before build.
- Country registers to survey: Church of Tuvalu, Catholic Mission Sui Iuris of Funafuti, Seventh-day Adventist records, and Tuvalu National Archives.

## First visualisation

Religious-affiliation percent by island for 2012, 2017, and 2022 after the analytical report tables are extracted.

## Build recipe

1. Extract: download the 2022 analytical report when available from the Tuvalu portal and extract island religion tables; backfill 2017 and 2012 from PDH-linked sources.
2. Governed product: create `area_summary` rows by island and census wave.
3. Boundaries: download geoBoundaries TUV ADM1 and join on island names.
4. Region page: add `REGION_CONFIG` after table extraction and join verification.
5. Verification: test island and national totals against CSD published totals.

## Risks and open questions

- The 2022 census report was identified through the official portal path, but the direct table download still needs resolution.
- Small counts may trigger suppression or rounding issues.

## Deep-history potential

Church of Tuvalu, LMS, Catholic, and Seventh-day Adventist records can support historic site evidence. Tuvalu National Archives and island council records should be surveyed for pre-census material.
