# Country data map: Armenia (AM)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [ARMSTAT Census 2022 results](https://armstat.am/en/?id=2623&nid=82) | census religion | marz/Yerevan to confirm in result tables | 2022 | PDF/XLS | open | ARMSTAT terms |
| [ARMSTAT Census 2011 results](https://armstat.am/en/?nid=82) | census religion | marz/Yerevan | 2011 | PDF/XLS | open | ARMSTAT terms |
| [ARMSTAT Census 2001 results](https://armstat.am/en/?nid=82) | census religion | marz/Yerevan | 2001 | PDF/XLS | open | ARMSTAT terms |

## Boundaries

- Official boundary files: Armenian administrative boundaries from cadastre/statistical sources; geoBoundaries ADM1/ADM2 is a fallback.
- Boundary changes between waves and the harmonisation plan: anchor on 2022 marzes and Yerevan; community-level mapping requires table confirmation.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): Overpass count did not complete reliably in this sweep.
- Country-specific registers that could seed or verify the layer: Armenian Apostolic dioceses, Catholic and Evangelical churches, Yezidi temple/community records, cultural heritage register.

## First visualisation

Religious affiliation by marz and Yerevan, 2011 and 2022, with 2001 added after extracting matching tables.

## Build recipe

1. Extract: ARMSTAT 2022 main-results religion table by marz/Yerevan if present; then 2011 and 2001 equivalents.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`.
3. Boundaries: marz/Yerevan polygons from official or geoBoundaries sources.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: reconcile marz totals to ARMSTAT national religion totals.

## Risks and open questions

- Official result pages are verified, but the subnational religion table needs direct extraction.
- The Armenian Apostolic majority may mask small but important Yezidi, Catholic, Evangelical, Molokan, and other communities.

## Deep-history potential

National Archives of Armenia, Armenian Apostolic parish records, Matenadaran manuscript holdings, Catholic and Evangelical archives, Yezidi community records, Molokan village records, and imperial Russian census materials.
