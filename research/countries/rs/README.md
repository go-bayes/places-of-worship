# Country data map: Serbia (RS)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [Statistical Office of Serbia dissemination database](https://data.stat.gov.rs/?caller=SDDB&languageCode=en-US) | census religion | municipality/city | 2022 | web table/export | open | SORS terms |
| [SORS 2022 Census publications](https://popis2022.stat.gov.rs/en-US/) | census religion | municipality/city in published tables | 2022 | PDF/XLS/web | open | SORS terms |
| [SORS 2011 Census database](https://popis2011.stat.rs/) | census religion | municipality/city | 2011 | web/PDF | open | SORS terms |

## Boundaries

- Official boundary files: Serbian administrative boundaries from national geodata; geoBoundaries ADM2 is a fallback.
- Boundary changes between waves and the harmonisation plan: anchor on 2022 municipalities/cities; treat Kosovo separately as `xk`.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): Overpass count did not complete reliably in this sweep.
- Country-specific registers that could seed or verify the layer: Serbian Orthodox eparchy directories, Islamic Community records, Catholic dioceses, Protestant church registers, Jewish community records.

## First visualisation

Religious-affiliation share by municipality/city for 2011 and 2022, with 2002 added after table extraction.

## Build recipe

1. Extract: SORS 2022 population by religion by municipalities and cities; add 2011 and 2002 equivalents.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`.
3. Boundaries: official municipality/city polygons or geoBoundaries ADM2, excluding Kosovo.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: reconcile municipal totals to SORS national religion totals.

## Risks and open questions

- Public data route is clear, but the exact export endpoint still needs scripting.
- Kosovo is excluded from Serbian census geography in the modern series.
- Non-response and administrative-source unknowns increased in 2022.

## Deep-history potential

Serbian Orthodox parish records, Ottoman defters, Habsburg military-border records, Jewish community archives, SORS historical census volumes, and municipal archives.
