# Country data map: Moldova (MD)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [Moldova Statbank PxWeb](https://statbank.statistica.md/PxWeb/pxweb/en/) | census and demographic tables; religion path not exposed in first API pass | national/raion to confirm | 2014, 2024 expected | PxWeb/API | open | NBS terms |
| [National Bureau of Statistics census pages](https://statistica.gov.md/en) | census religion | national in public summaries; subnational route to confirm | 2004, 2014, 2024 | web/PDF/XLS | open | NBS terms |

## Boundaries

- Official boundary files: Moldovan administrative boundaries from national geodata; geoBoundaries ADM1/ADM2 is a fallback.
- Boundary changes between waves and the harmonisation plan: first decide whether Transnistria is excluded consistently; anchor on right-bank raions if so.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): Overpass count did not complete reliably in this sweep.
- Country-specific registers that could seed or verify the layer: State Service/Agency records for religious groups, Orthodox metropolias, Baptist/Pentecostal/Adventist unions, Jewish community records.

## First visualisation

No census-affiliation map until a public raion-level religion table is downloaded; organisation counts by raion are the fallback.

## Build recipe

1. Extract: identify the NBS census-religion table path for 2014 and 2024, then confirm raion fields.
2. Governed product: `area_summary` only after subnational religion data are confirmed.
3. Boundaries: right-bank raion polygons, with Transnistria treatment recorded.
4. Region page: defer.
5. Verification: reconcile subnational totals to published national religion totals.

## Risks and open questions

- Public summaries give 2014 and 2024 religion totals, but the first API pass did not expose a subnational religion table.
- Transnistria coverage differs from national territory.
- 2024 detailed tables may still be staged after preliminary releases.

## Deep-history potential

National Archive of Moldova, Orthodox metrical books, Jewish community records, Bessarabian/Romanian interwar census records, Soviet-era religious affairs files, and local parish archives.
