# Country data map: Bulgaria (BG)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [NSI Census 2021 ethno-cultural characteristics](https://census2021.bg/) | census confession or religious affiliation | district in verified public material; municipality route to confirm | 2021 | web/XLSX | open | NSI terms |
| [NSI Infostat census tables](https://infostat.nsi.bg/infostat/) | census confession or religious affiliation | district/municipality route to confirm | 2001, 2011, 2021; national series from 1887 | web/API-style table export | open | NSI terms |

## Boundaries

- Official boundary files: Bulgarian administrative units from NSI/geodetic sources; GISCO LAU can support municipality joins.
- Boundary changes between waves and the harmonisation plan: anchor on 2021 municipalities or districts, then use NSI codes for concordance.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): one Overpass batch returned 3,267 objects before the batch was stopped; rerun before build.
- Country-specific registers that could seed or verify the layer: Directorate of Religious Denominations, Bulgarian Orthodox dioceses, Muslim Denomination registers, Catholic and Protestant directories.

## First visualisation

Religious-affiliation share by district first, with municipality mapping only after the Infostat table route is verified.

## Build recipe

1. Extract: NSI Infostat religion/confession tables for 2021, then identify matching 2001 and 2011 tables at the same geography.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`.
3. Boundaries: GISCO LAU or official NSI municipality polygons.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: reconcile municipality totals to NSI national and district totals.

## Risks and open questions

- The exact Infostat table path needs direct export before promotion to tier A.
- The religion question is voluntary in recent censuses; non-response is material.
- Category labels changed between confession and broader ethno-cultural reporting.
- Minority religious data may be politically sensitive in some municipalities.

## Deep-history potential

NSI historical census volumes, Bulgarian Orthodox parish archives, Muslim waqf and muftiate records, Catholic and Protestant mission archives, Jewish community archives, and Ottoman defters.
