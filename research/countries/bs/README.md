# Country data map: Bahamas (BS)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| Bahamas National Statistical Institute census releases, <https://www.bahamas.gov.bs/> | census affiliation | island or district to be confirmed | 2010, 2022 | PDF/web tables | open where available | BNSI terms |
| 2022 Census Population Highlights release | census affiliation | subnational table not located in sweep | 2022 | PDF | open where available | BNSI terms |

## Boundaries

- Official boundary files: BNSI or national GIS district/island boundaries; geoBoundaries BHS ADM1 is a fallback.
- Anchor on islands or districts only after the public table geography is confirmed.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not measured in this survey; run ohsome or Overpass before build.
- Country-specific registers that could seed or verify the layer: Baptist, Anglican, Catholic, Methodist, Pentecostal, and Seventh-day Adventist directories plus heritage inventories.

## First visualisation

Religious-affiliation percent by island or district for 2010 and 2022, if public subnational tables can be obtained.

## Build recipe

1. Extract: obtain 2010 and 2022 BNSI religion tables and parse subnational rows if present.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`, with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: use official district/island boundaries or geoBoundaries BHS ADM1 and join by area name/code.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: reconcile census totals, join coverage, licence and attribution strings.

## Risks and open questions

- National 2010 and 2022 religion figures are clear, but the subnational release route was not located.
- Island geographies may not align cleanly with administrative districts.

## Deep-history potential

Anglican and Baptist archives, Catholic records, Bahamas National Archives, Loyalist settlement records, Methodist mission records, and newspapers support longer site histories.
