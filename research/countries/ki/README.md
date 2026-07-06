# Country data map: Kiribati (KI)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [PDH Kiribati 2020 Population and Housing Census](https://microdata.pacificdata.org/index.php/catalog/767) | census affiliation metadata | record-level metadata; island table needs extraction | 2020 | metadata | open metadata; data access varies | PDH terms |
| [PDH Kiribati 2015 Population and Housing Census](https://microdata.pacificdata.org/index.php/catalog/199) | census affiliation metadata | record-level metadata; island table needs extraction | 2015 | metadata | open metadata; data access varies | PDH terms |
| [PDH Kiribati 2023 Household Income and Expenditure Survey](https://microdata.pacificdata.org/index.php/catalog/881) | survey affiliation | survey unit | 2023 | metadata | licensed survey | PDH terms |

## Boundaries

- Official boundary files: geoBoundaries KIR ADM1 can anchor island or island-council maps.
- Harmonise island names across 2015 and 2020 before adding a time-series layer.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): public Overpass queries timed out; rerun before build.
- Country registers to survey: Kiribati Uniting Church, Kiribati Protestant Church, Catholic Diocese of Tarawa and Nauru, and Kiribati National Archives.

## First visualisation

Religious-affiliation percent by island for 2015 and 2020, once public tables or licensed extracts are converted into reusable summaries.

## Build recipe

1. Extract: use PDH variables to locate religion fields, then extract island-level tables from the 2015 and 2020 census reports or microdata access route.
2. Governed product: create `area_summary` rows by island and wave.
3. Boundaries: download geoBoundaries KIR ADM1 and build an island-name crosswalk.
4. Region page: add `REGION_CONFIG` after the island join is verified.
5. Verification: test island totals against published census population totals.

## Risks and open questions

- The public sweep confirmed variables. A direct downloadable island religion table still needs verification.
- Category shifts between Kiribati Uniting Church, Kiribati Protestant Church, Catholic, and smaller groups need explicit harmonisation.

## Deep-history potential

Catholic, Protestant, and Uniting Church records, Kiribati National Archives, and Sacred Heart mission material can support long-run worship-site histories.
