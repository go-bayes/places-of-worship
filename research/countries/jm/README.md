# Country data map: Jamaica (JM)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| STATIN 2011 census portal, <https://statinja.gov.jm/Census/PopCensus/Popcensus2011Index.aspx> | census affiliation collected in questionnaire | parish table not located in published portal | 2011 | questionnaire PDF, web tables | open | STATIN terms |
| STATIN 2022 census portal, <https://statinja.gov.jm/Census/PopCensus/Popcensus2022Index.aspx> | religion release not found in sweep | not confirmed | 2022 | web tables | open | STATIN terms |

## Boundaries

- Official boundary files: STATIN/National Land Agency parish boundaries; geoBoundaries JAM ADM1 is a fallback.
- Anchor on parishes if a public religion table or microdata extraction route is obtained.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not measured in this survey; run ohsome or Overpass before build.
- Country-specific registers that could seed or verify the layer: Jamaica Council of Churches, denominational directories, and Anglican and Catholic parish lists.
  Rastafari community sources where public and appropriate and heritage inventories may verify specific sites.

## First visualisation

Religious-affiliation percent by parish for 2011 and any released 2022 equivalent, if public tables can be obtained.

## Build recipe

1. Extract: request or locate the 2011 parish religion table; if only microdata are available, tabulate by parish under the access terms.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`, with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: use official parish boundaries or geoBoundaries JAM ADM1 and join by parish name/code.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: reconcile parish totals to STATIN totals, join coverage, licence and attribution strings.

## Risks and open questions

- The questionnaire confirms the 2011 construct, but the published parish table was not located.
- The 2022 religion release must be confirmed before trend mapping.

## Deep-history potential

Anglican parish registers, Catholic archives, Baptist and Moravian mission records, Jewish community records, Jamaica Archives and Records Department, and Gleaner archives support longer site histories.
