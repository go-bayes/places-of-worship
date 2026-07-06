# Country data map: Gambia (GM)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| DHS Program surveys API, https://api.dhsprogram.com/rest/dhs/surveys?countryIds=GM&f=json, and dataset API, https://api.dhsprogram.com/rest/dhs/datasets?countryIds=GM&f=json | respondent religious affiliation in DHS recodes; survey estimates | DHS local government area/region to verify | 2013, 2019-20 | API metadata, PDF reports, recode ZIPs | reports open; recodes require free DHS approval | DHS terms; cite DHS Program |
| Gambia Bureau of Statistics census releases, https://www.gbosdata.org/ | census population context; public religion table not verified in this sweep | local government area/district for population context | 2013, 2024 | PDF/web release | open web | licence not stated |

Constructs are not interchangeable: DHS respondent affiliation is a survey estimate and should not be presented as census affiliation.

## Boundaries

- Official boundary files: geoBoundaries ADM1 local government areas, 2020, CC BY 4.0; ADM2 districts, 2020, CC BY 4.0.
- Boundary changes between waves and the harmonisation plan: anchor on local government areas for the first product.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not counted during this source sweep; run ohsome or Overpass before build.
- Country-specific registers that could seed or verify the layer: Gambia Supreme Islamic Council, Gambia Christian Council, Catholic Diocese of Banjul, Methodist Church The Gambia.

## First visualisation

DHS survey-estimated respondent religious affiliation by local government area/region, 2013 and 2019/20, with uncertainty intervals.

## Build recipe

1. Extract weighted religion by DHS geography from IR/MR recodes; preserve survey weights and standard errors.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`, with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: geoBoundaries `GMB ADM1`, joined to DHS local government area labels.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: compare weighted national totals with final-report totals, join coverage, licence and attribution strings.

## Risks and open questions

- Only two DHS waves were found.
- Small Christian and traditional-religion samples may have high uncertainty.

## Deep-history potential

National Records Service of The Gambia, Anglican and Methodist mission records, Catholic Diocese of Banjul archives, Islamic school and mosque records, and colonial Bathurst newspapers.
