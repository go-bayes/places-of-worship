# Country data map: Montenegro (ME)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [MONSTAT Census 2023 results](https://monstat.org/eng/page.php?id=1994&pageid=1758) | census religion | municipality | 2023 | web/PDF/XLS | open | MONSTAT terms |
| [MONSTAT Census 2011 results](https://monstat.org/eng/page.php?id=393&pageid=57) | census religion | municipality | 2011 | PDF/XLS | open | MONSTAT terms |
| [MONSTAT Census 2003 results](https://monstat.org/eng/page.php?id=57&pageid=57) | census religion | municipality | 2003 | PDF | open | MONSTAT terms |

## Boundaries

- Official boundary files: MONSTAT or national geodetic municipal boundaries; geoBoundaries ADM1/ADM2 is a fallback.
- Boundary changes between waves and the harmonisation plan: anchor on 2023 municipalities; handle newer municipalities such as Petnjica and Tuzi with a concordance.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): Overpass count did not complete reliably in this sweep.
- Country-specific registers that could seed or verify the layer: Orthodox, Islamic, Catholic, and Jewish community directories; protected cultural heritage register.

## First visualisation

Religious-affiliation share by municipality, 2003, 2011, and 2023, on 2023 boundaries.

## Build recipe

1. Extract: MONSTAT 2023 religion by municipality, then match 2011 and 2003 municipality tables.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`.
3. Boundaries: official 2023 municipality polygons or geoBoundaries, with split concordances.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: reconcile municipality totals to MONSTAT national religion totals.

## Risks and open questions

- New municipalities complicate 2003-2023 comparisons.
- Religious identity overlaps strongly with national identity but must remain a separate construct.
- Some tables may require PDF extraction.

## Deep-history potential

Orthodox monastery and parish records, Islamic Community records, Catholic diocesan archives, Ottoman records, Venetian/Austro-Hungarian materials for coastal towns, and MONSTAT historical census volumes.
