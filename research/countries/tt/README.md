# Country data map: Trinidad and Tobago (TT)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| Central Statistical Office population portal, <https://cso.gov.tt/subjects/population-and-vital-statistics/population/> | census affiliation | regional corporation or municipality to be extracted | 2000, 2011 | PDF/web tables | open | CSO terms |
| 2020 round census materials, <https://cso.gov.tt/> | religion release not confirmed | not confirmed | 2020 round | web/PDF | open where available | CSO terms |

## Boundaries

- Official boundary files: national GIS or CSO local government boundaries; geoBoundaries TTO ADM1 is a fallback.
- Anchor on regional corporations or municipalities after the census table geography is confirmed.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not measured in this survey; run ohsome or Overpass before build.
- Country-specific registers that could seed or verify the layer: Catholic and Anglican parish directories, Sanatan Dharma Maha Sabha temples, and Muslim organisation directories.
  Orisha and Spiritual Baptist public records and heritage inventories may verify specific sites.

## First visualisation

Religious-affiliation percent by regional corporation or municipality, 2000-2011, on current local government boundaries.

## Build recipe

1. Extract: locate and parse CSO census religion tables for 2000 and 2011, preserving report page and table provenance.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`, with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: use official local government boundaries or geoBoundaries TTO ADM1 and join by area name/code.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: reconcile census totals, join coverage, licence and attribution strings.

## Risks and open questions

- The likely source is PDF-first and needs extraction.
- Tobago and Trinidad geographies may require separate handling.

## Deep-history potential

Catholic and Anglican archives, Presbyterian mission records, Hindu and Muslim community archives, National Archives of Trinidad and Tobago, estate records, and newspapers support longer site histories.
