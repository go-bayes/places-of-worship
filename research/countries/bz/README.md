# Country data map: Belize (BZ)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| Statistical Institute of Belize census portal, <https://sib.org.bz/census/> | census affiliation | district | 2000, 2010, 2022 | PDF/Excel/web tables | open | SIB terms |
| SIB population statistics portal, <https://sib.org.bz/statistics/population/> | census affiliation and demographics | district | 2010, 2022 | web/downloads | open | SIB terms |

## Boundaries

- Official boundary files: Belize district boundaries from national GIS sources; geoBoundaries BLZ ADM1 is a fallback.
- Anchor on districts for the first product and add towns/villages only if SIB publishes consistent religion tables.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not measured in this survey; run ohsome or Overpass before build.
- Country-specific registers that could seed or verify the layer: Catholic and Anglican parish directories, Mennonite colony records, Methodist and Baptist directories, and heritage inventories.

## First visualisation

Religious-affiliation percent by district, 2000-2022, on current district boundaries.

## Build recipe

1. Extract: download SIB census religion tables for 2000, 2010, and 2022; parse district rows and retain table provenance.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`, with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: use official district boundaries or geoBoundaries BLZ ADM1 and join by district name.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: reconcile census totals, join coverage, licence and attribution strings.

## Risks and open questions

- The source appears strong, but exact machine-readable district tables still need extraction.
- Denomination labels changed across waves and need a crosswalk.

## Deep-history potential

Anglican and Catholic archives, Methodist and Baptist mission records, Mennonite colony archives, Belize Archives and Records Service, estate records, and newspapers support longer site histories.
