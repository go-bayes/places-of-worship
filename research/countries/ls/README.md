# Country data map: Lesotho (LS)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| DHS Program surveys API, https://api.dhsprogram.com/rest/dhs/surveys?countryIds=LS&f=json, and dataset API, https://api.dhsprogram.com/rest/dhs/datasets?countryIds=LS&f=json | respondent religious affiliation in DHS recodes; survey estimates | DHS district | 2004, 2009, 2014, 2023-24 | API metadata, PDF reports, recode ZIPs | reports open; recodes require free DHS approval | DHS terms; cite DHS Program |
| Lesotho Bureau of Statistics census releases, https://www.bos.gov.ls/ | census population context; public religion table not verified in this sweep | district/constituency for population context | 2006, 2016 | PDF/web release | open web | licence not stated |

Constructs are not interchangeable: DHS respondent affiliation is a survey estimate and must stay separate from census population context.

## Boundaries

- Official boundary files: geoBoundaries ADM1 districts, 2017, ODbL; ADM2 constituencies, 2020, CC BY 3.0 IGO.
- Boundary changes between waves and the harmonisation plan: anchor on DHS districts.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not counted during this source sweep; run ohsome or Overpass before build.
- Country-specific registers that could seed or verify the layer: Christian Council of Lesotho, Catholic dioceses, Lesotho Evangelical Church in Southern Africa, Anglican Diocese of Lesotho.

## First visualisation

DHS survey-estimated respondent religious affiliation by district, 2004-2023/24, with uncertainty intervals.

## Build recipe

1. Extract weighted religion by DHS district from IR/MR recodes; preserve survey weights and standard errors.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`, with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: geoBoundaries `LSO ADM1`, joined to DHS district labels.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: compare weighted national totals with final-report totals, join coverage, licence and attribution strings.

## Risks and open questions

- DHS region labels need comparison with official district names.
- Survey estimates will not identify parish-level Catholic or Lesotho Evangelical structures.

## Deep-history potential

National Archives of Lesotho, Morija Museum and Archives, Paris Evangelical Missionary Society records, Catholic mission archives, and colonial Basutoland files.
