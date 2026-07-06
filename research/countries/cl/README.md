# Country data map: Chile (CL)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| INE Censo 2024 results and Redatam portal, <https://censo2024.ine.gob.cl/resultados/> and <https://redatam.ine.gob.cl/redbin/RpWebEngine.exe/Portal?BASE=CENSO_2024&lang=esp> | census affiliation | commune | 2024 | dashboard, Redatam, PDF | open | INE terms |
| INE census publications, <https://www.ine.gob.cl/estadisticas/sociales/censos-de-poblacion-y-vivienda> | census affiliation | commune to be extracted | 2002 | PDF/Redatam route | open | INE terms |

## Boundaries

- Official boundary files: Biblioteca del Congreso Nacional and IDE Chile commune boundaries; geoBoundaries CHL ADM3 is a fallback.
- Anchor on 2024 communes and create a concordance for commune changes since 2002.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not measured in this survey; run ohsome or Overpass before build.
- Country-specific registers that could seed or verify the layer: Catholic diocesan parish directories, Consejo de Monumentos Nacionales heritage records, evangelical church directories, and municipal heritage catalogues.

## First visualisation

Religious-affiliation percent by commune, 2002 and 2024, on 2024 commune boundaries.

## Build recipe

1. Extract: use Redatam for 2024 religion by commune and locate the 2002 religion table or Redatam base; document every query.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`, with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: use official commune boundaries or geoBoundaries CHL ADM3 and join by commune code.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: reconcile census totals, commune join coverage, licence and attribution strings.

## Risks and open questions

- The 2017 census did not provide a religion wave, leaving a 2002-2024 gap.
- The 2002 extraction route must be confirmed before production.

## Deep-history potential

Catholic diocesan archives, parish registers, Archivo Nacional de Chile, Protestant mission archives, Consejo de Monumentos files, and regional newspapers support longer site histories.
