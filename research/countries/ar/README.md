# Country data map: Argentina (AR)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| INDEC national census portal, <https://www.indec.gob.ar/indec/web/Nivel4-Tema-2-41-165> | reviewed modern outputs did not show census religion | not applicable | 2022 | web tables, downloads | open | INDEC terms |
| CONICET religious beliefs survey, <https://www.conicet.gov.ar/segunda-encuesta-nacional-sobre-creencias-y-actitudes-religiosas-en-argentina/> | survey estimates | macro-region | 2008, 2019 | report/PDF | open | report terms |

## Boundaries

- Official boundary files: IGN Argentina provincial and departmental boundaries; geoBoundaries ARG ADM2 is a fallback.
- Macro-region survey estimates should be mapped only if the survey documentation defines reproducible regions.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not measured in this survey; run ohsome or Overpass before build.
- Country-specific registers that could seed or verify the layer: Catholic diocesan directories, Jewish community records, evangelical directories, heritage registers, and provincial inventories.

## First visualisation

Religious-affiliation survey estimates by CONICET macro-region, 2008 and 2019, clearly labelled as survey estimates.

## Build recipe

1. Extract: digitise CONICET regional tables for 2008 and 2019 with report page provenance.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`, with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: build a macro-region polygon from provinces using IGN or geoBoundaries ADM1.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: reconcile survey totals where published, region joins, licence and attribution strings.

## Risks and open questions

- Modern censuses reviewed do not include religion; 1947 and 1960 are too far from the current series for a standard build.
- Survey estimates cannot be interpreted as census counts.

## Deep-history potential

Catholic diocesan archives, parish registers, Archivo General de la Nacion, Jewish community archives, Welsh and immigrant chapel records, and provincial newspapers support longer site histories.
