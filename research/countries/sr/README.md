# Country data map: Suriname (SR)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| General Bureau of Statistics census portal, <https://statistics-suriname.org/census/> | census affiliation | district; resort may be possible | 2004, 2012 | PDF/downloads | open | ABS terms |
| Censusstatistieken 2012 downloads | census affiliation | district or resort to be extracted | 2012 | PDF/XLS where available | open | ABS terms |

## Boundaries

- Official boundary files: national district and resort boundaries where available; geoBoundaries SUR ADM1 or ADM2 is a fallback.
- Anchor on 2012 districts for the first product; add resorts only if the census tables and boundaries align.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not measured in this survey; run ohsome or Overpass before build.
- Country-specific registers that could seed or verify the layer: Moravian Church records, Catholic parish directories, Hindu and Muslim organisation records, synagogue records, and heritage inventories.

## First visualisation

Religious-affiliation percent by district, 2004 and 2012, on 2012 district boundaries.

## Build recipe

1. Extract: parse ABS 2004 and 2012 religion tables by district, preserving publication and page provenance.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`, with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: use official district boundaries or geoBoundaries SUR ADM1 and join by district name/code.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: reconcile totals, join coverage, licence and attribution strings.

## Risks and open questions

- Some tables may be PDF-only.
- Resort-level mapping needs both table and boundary confirmation.

## Deep-history potential

Moravian archives, Catholic parish records, Hindu and Muslim community archives, Jewish records at Jodensavanne and Paramaribo, national archives, plantation records, and newspapers support longer site histories.
