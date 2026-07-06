# Country data map: Barbados (BB)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| Barbados Statistical Service census releases, <https://stats.gov.bb/> | census affiliation | parish to be confirmed | 2010, 2021 | PDF/web tables | open where available | BSS terms |
| 2021 Population and Housing Census report cited by BSS releases | census affiliation | parish table not located in sweep | 2021 | PDF | open where available | BSS terms |

## Boundaries

- Official boundary files: Barbados administrative/parish boundaries from national geospatial sources; geoBoundaries BRB ADM1 is a fallback.
- Anchor on parishes once the public table geography is confirmed.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not measured in this survey; run ohsome or Overpass before build.
- Country-specific registers that could seed or verify the layer: Anglican parish records, Catholic directories, Methodist and Moravian records, Jewish community records, and heritage inventories.

## First visualisation

Religious-affiliation percent by parish for 2010 and 2021, if public parish tables can be obtained.

## Build recipe

1. Extract: obtain BSS 2010 and 2021 religion tables and parse parish rows if present.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`, with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: use official parish boundaries or geoBoundaries BRB ADM1 and join by parish name.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: reconcile census totals, join coverage, licence and attribution strings.

## Risks and open questions

- National 2021 religion figures are reported, but the parish table was not located in the sweep.
- The BSS site was intermittently difficult to access; source archiving needs retrying.

## Deep-history potential

Anglican parish registers, Quaker records, Catholic archives, Barbados Department of Archives, synagogue records, plantation records, and newspapers support longer site histories.
