# Country data map: Albania (AL)

## Status

- **Tier**: A (buildable now)
- **Build state**: survey verified
- **Last verified**: 2026-07-07; tier-A verification: https://www.instat.gov.al/en/themes/censuses/census-of-population-and-housing/

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [INSTAT Census 2023 table 1.13](https://www.instat.gov.al/en/themes/censuses/census-of-population-and-housing/) | census religion | prefecture for subnational religion table found | 2023 | XLSX/web table | open | INSTAT terms |
| [INSTAT Census 2011 prefecture table 1.1.13](https://www.instat.gov.al/en/themes/censuses/census-of-population-and-housing/) | census religious affiliation | prefecture | 2011 | XLS/web table | open | INSTAT terms |
| [INSTAT Census 2001](https://www.instat.gov.al/en/themes/censuses/census-of-population-and-housing/) | census population; no religion table confirmed in this sweep | national/prefecture context | 2001 | XLS/PDF | open | INSTAT terms |

## Boundaries

- Official boundary files: ASIG/INSTAT administrative boundaries; geoBoundaries ADM1 supports prefecture joins.
- Boundary changes between waves and the harmonisation plan: first product anchors on prefectures, avoiding the 2015 municipality reform.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): Overpass count did not complete reliably in this sweep.
- Country-specific registers that could seed or verify the layer: Muslim Community of Albania, Orthodox Autocephalous Church, Catholic dioceses, Bektashi community, cultural monuments register.

## First visualisation

Census religious-affiliation share by prefecture, 2011 and 2023, on current prefecture boundaries.

## Build recipe

1. Extract: INSTAT Census 2023 `Tab. 1.13 Resident population by religion and sex`, then 2011 prefecture `Tab. 1.1.13`.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`.
3. Boundaries: geoBoundaries ADM1 or official prefecture polygons.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: reconcile prefecture totals to INSTAT national religion totals for 2011 and 2023.

## Risks and open questions

- The confirmed subnational religion table is prefecture-level rather than municipality-level.
- Religion is a sensitive and sometimes contested census construct in Albania.
- The 2001 table set did not expose a comparable religion table in this sweep.

## Deep-history potential

State archives, Ottoman records, waqf and Bektashi archives, Catholic and Orthodox parish records, interwar census materials, and cultural heritage inventories.
