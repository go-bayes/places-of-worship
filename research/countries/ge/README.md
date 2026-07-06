# Country data map: Georgia (GE)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [Geostat 2014 General Population Census](https://www.geostat.ge/en/modules/categories/568/population-and-housing-census-2014) | census religion | region; municipality tables indicated in census outputs | 2014 | XLS/PDF/web | open | Geostat terms |
| [Geostat 2002 General Population Census](https://www.geostat.ge/en/modules/categories/737/2002-general-population-census) | census religious belief | region/municipality to extract | 2002 | PDF/XLS/web | open | Geostat terms |
| [Geostat 2024 Population Census](https://www.geostat.ge/en) | census religion, if released | not yet confirmed | 2024 | pending | open when released | Geostat terms |

## Boundaries

- Official boundary files: Geostat/geospatial administrative boundaries; geoBoundaries ADM1/ADM2 is a fallback.
- Boundary changes between waves and the harmonisation plan: exclude Abkhazia and South Ossetia consistently where census coverage excludes them; anchor on 2014 controlled-territory regions.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): Overpass count did not complete reliably in this sweep.
- Country-specific registers that could seed or verify the layer: Georgian Orthodox Patriarchate dioceses, Muslim Administration records, Armenian Apostolic, Catholic, Jewish, and Yezidi community records.

## First visualisation

2014 census religion by region or municipality, with 2002 added only after coverage and boundary notes are attached.

## Build recipe

1. Extract: Geostat 2014 population by regions and religion; inspect municipality table availability.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`.
3. Boundaries: Geostat or geoBoundaries regional polygons for the census-covered territory.
4. Region page: `REGION_CONFIG` after 2024 release status is clear.
5. Verification: reconcile subnational totals to 2014 national religion totals.

## Risks and open questions

- The 2024 census round is not yet a verified religion table in this sweep.
- Territorial coverage excludes breakaway regions in modern official data.
- Region-level data are easier to verify than municipality-level tables.

## Deep-history potential

National Archives of Georgia, Georgian Orthodox parish and monastery records, Armenian Apostolic archives in Samtskhe-Javakheti, Muslim community records, Jewish community archives, and imperial Russian census/gazetteer material.
