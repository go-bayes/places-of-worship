# Country data map: Seychelles (SC)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| Seychelles National Bureau of Statistics Population and Housing Census 2022, https://www.nbs.gov.sc/ | census affiliation | region in public summaries; district table to verify | 2022 | PDF/web release | open web | licence not stated |
| Earlier Seychelles census religion summaries | census affiliation | region/national, to verify | 1994, 2002, 2010, 2022 | PDF/report | open web and archive copies | licence not stated |

Constructs are not interchangeable: census affiliation and congregation registers must stay separate.

## Boundaries

- Official boundary files: geoBoundaries ADM1 districts, 2018, CC BY-SA 3.0; ADM2 regions, 2020, CC BY 4.0.
- Boundary changes between waves and the harmonisation plan: anchor on 2022 regions first; only use districts if religion rows are exposed.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not counted during this source sweep; run ohsome or Overpass before build.
- Country-specific registers that could seed or verify the layer: Diocese of Port Victoria, Anglican Diocese of Seychelles, Seychelles Hindu Kovil Sangam, mosque community records.

## First visualisation

Census religious-affiliation percent by region, 2022, with earlier census waves added after table extraction.

## Build recipe

1. Extract: start with the 2022 Population and Housing Census religion-by-region table, then locate 1994, 2002, and 2010 equivalent tables.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`, with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: geoBoundaries `SYC ADM2` regions for the first product; retain `SYC ADM1` districts for site context.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: reconcile national totals, join coverage, licence and attribution strings.

## Risks and open questions

- Small populations make disclosure and uncertainty important even with census counts.
- Earlier wave region definitions need confirmation.

## Deep-history potential

Seychelles National Archives, Diocese of Port Victoria archives, Anglican mission records, Hindu Kovil Sangam records, mosque records, and colonial plantation records.
