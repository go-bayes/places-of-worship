# Country data map: Kosovo (XK)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [Kosovo Agency of Statistics Census 2011](https://ask.rks-gov.net/) | census religion | municipality in census tables | 2011 | PDF/XLS/web | open | ASK terms |
| [Kosovo Agency of Statistics Census 2024 results](https://ask.rks-gov.net/) | census religion | municipality expected; national religion shares publicly reported | 2024 | web/PDF/XLS | open | ASK terms |

## Boundaries

- Official boundary files: Kosovo cadastral/statistical municipal boundaries; geoBoundaries ADM1/ADM2 is a fallback.
- Boundary changes between waves and the harmonisation plan: anchor on 2024 municipalities and document northern-municipality boycott effects.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): Overpass count did not complete reliably in this sweep.
- Country-specific registers that could seed or verify the layer: Islamic Community of Kosovo, Catholic Diocese of Prizren-Pristina, Serbian Orthodox sites, cultural heritage lists.

## First visualisation

Religion by municipality for 2011 and 2024, only after the 2024 municipality table is downloaded and boycott notes are attached.

## Build recipe

1. Extract: ASK 2011 religion by municipality, then 2024 religion by municipality when the final table is available.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`.
3. Boundaries: 2024 municipal polygons from official or geoBoundaries sources.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: reconcile municipal totals to national ASK totals and record boycott coverage.

## Risks and open questions

- Serb-majority areas had serious participation issues in both modern censuses.
- 2024 religion tables need direct file download before tier A.
- Kosovo is handled separately from Serbia in this survey.

## Deep-history potential

Ottoman records, Islamic Community archives, Serbian Orthodox monastery records, Catholic parish archives, Yugoslav census volumes, and post-war heritage inventories.
