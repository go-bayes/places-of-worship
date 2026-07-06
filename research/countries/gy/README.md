# Country data map: Guyana (GY)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| Bureau of Statistics census portal, <https://statisticsguyana.gov.gy/census/> | census affiliation | region to be extracted | 2002, 2012 | PDF/web tables | open where available | Bureau terms |
| 2022 census materials | release not confirmed for religion | not confirmed | 2022 round | web/PDF | open where available | Bureau terms |

## Boundaries

- Official boundary files: Bureau of Statistics or national GIS regional boundaries; geoBoundaries GUY ADM1 is a fallback.
- Anchor on regions for the first product and avoid smaller units unless the census release supports them.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not measured in this survey; run ohsome or Overpass before build.
- Country-specific registers that could seed or verify the layer: Hindu temple organisations, Muslim organisations, Catholic and Anglican directories, Seventh-day Adventist directories, and heritage inventories.

## First visualisation

Religious-affiliation percent by region, 2002 and 2012, on current regional boundaries.

## Build recipe

1. Extract: parse Bureau census religion tables for 2002 and 2012 from reports or downloads, preserving page and table provenance.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`, with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: use official region boundaries or geoBoundaries GUY ADM1 and join by region name/code.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: reconcile region totals, join coverage, licence and attribution strings.

## Risks and open questions

- PDF-first extraction is likely.
- The 2022 census religion release must be confirmed before adding a new wave.

## Deep-history potential

Anglican and Catholic archives, Hindu and Muslim community archives, Moravian and Presbyterian mission records, National Archives of Guyana, estate records, and newspapers support longer site histories.
