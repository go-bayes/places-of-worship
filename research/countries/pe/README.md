# Country data map: Peru (PE)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| INEI Censos 2017 portal, <https://censo2017.inei.gob.pe/> | census affiliation | district via Redatam | 2017 | Redatam, PDF, XLS | open | INEI terms |
| INEI Redatam census route, <https://censos2017.inei.gob.pe/redatam/> | census affiliation | district to be extracted | 1993, 2007, 2017 | Redatam | open | INEI terms |

## Boundaries

- Official boundary files: INEI/IGN district boundaries where available; geoBoundaries PER ADM3 is a fallback.
- Anchor on 2017 districts and create a concordance for district splits before comparing 1993, 2007, and 2017.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not measured in this survey; run ohsome or Overpass before build.
- Country-specific registers that could seed or verify the layer: Catholic diocesan parish directories, Ministerio de Cultura heritage records, evangelical denominational directories, and municipal inventories.

## First visualisation

Religious-affiliation percent by district, 1993-2017, on 2017 district boundaries.

## Build recipe

1. Extract: query Redatam for religion by district for 1993, 2007, and 2017; export tables with query metadata.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`, with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: use official district boundaries or geoBoundaries PER ADM3 and join by ubigeo.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: reconcile national totals, district join coverage, licence and attribution strings.

## Risks and open questions

- Redatam extraction needs automation before this becomes buildable now.
- The 2020-2024 census round was not completed as a religion data wave.

## Deep-history potential

Catholic diocesan archives, parish sacramental registers, Archivo General de la Nacion, regional archives, mission records, and historical newspapers support colonial and republican site histories.
