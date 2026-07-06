# Country data map: Palau (PW)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [PDH Palau 2020 Population and Housing Census](https://microdata.pacificdata.org/index.php/catalog/866) | census affiliation metadata | record-level metadata; state table needs extraction | 2020 | metadata | open metadata; data access varies | PDH terms |
| [PDH Palau 2015 Population and Housing Census](https://microdata.pacificdata.org/index.php/catalog/458) | census affiliation metadata | record-level metadata; state table needs extraction | 2015 | metadata | open metadata; data access varies | PDH terms |
| [PDH Palau 2005 Population and Housing Census](https://microdata.pacificdata.org/index.php/catalog/27) | census affiliation metadata | record-level metadata; state table needs extraction | 2005 | metadata | open metadata; data access varies | PDH terms |

## Boundaries

- Official boundary files: geoBoundaries PLW ADM1 can anchor state maps.
- State names are the likely common geography across waves; record any report aggregation.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): public Overpass queries timed out; rerun before build.
- Country registers to survey: Catholic Church, Evangelical Church, Modekngei records, and Palau National Archives.

## First visualisation

Religious-affiliation percent by state for 2005, 2015, and 2020 after state tables are extracted.

## Build recipe

1. Extract: use PDH variables to locate religion fields and obtain state-level tables from census reports or reusable microdata access.
2. Governed product: create `area_summary` rows by state and wave.
3. Boundaries: download geoBoundaries PLW ADM1 and join on state names.
4. Region page: add `REGION_CONFIG` after table extraction and join verification.
5. Verification: test state totals and denomination labels against the 2020 report.

## Risks and open questions

- Public metadata is strong, but direct state tables were not verified in the sweep.
- State-level counts may be sparse for smaller religious groups.

## Deep-history potential

Catholic, Evangelical, Modekngei, Japanese-period, and Trust Territory records can support older worship-site evidence. Palau National Archives and Micronesian Seminar material are priority sources.
