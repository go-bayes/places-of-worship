# Country data map: Liberia (LR)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| DHS Program surveys API, https://api.dhsprogram.com/rest/dhs/surveys?countryIds=LB&f=json, and dataset API, https://api.dhsprogram.com/rest/dhs/datasets?countryIds=LB&f=json | respondent religious affiliation in DHS recodes; survey estimates | DHS county/region | 1986, 2007, 2009 MIS, 2011 MIS, 2013, 2016 MIS, 2019-20, 2022 MIS | API metadata, PDF reports, recode ZIPs | reports open; recodes require free DHS approval | DHS terms; cite DHS Program |
| Liberia Institute of Statistics and Geo-Information Services census releases, https://www.lisgis.gov.lr/ | census population context; public religion table not verified in this sweep | county/district for population context | 2008, 2022 | PDF/web release | open web | licence not stated |

Constructs are not interchangeable: DHS respondent affiliation is a survey estimate and should not be treated as census affiliation.

## Boundaries

- Official boundary files: geoBoundaries ADM1 counties, 2021, CC BY 3.0 IGO; ADM2 districts, 2021, CC BY 3.0 IGO.
- Boundary changes between waves and the harmonisation plan: anchor on counties for the first product.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not counted during this source sweep; run ohsome or Overpass before build.
- Country-specific registers that could seed or verify the layer: Liberia Council of Churches, National Muslim Council of Liberia, Catholic dioceses, Methodist Church Liberia Annual Conference.

## First visualisation

DHS survey-estimated respondent religious affiliation by county/region, 1986-2022, with uncertainty intervals.

## Build recipe

1. Extract weighted religion by DHS county/region from IR/MR recodes; preserve survey weights and standard errors.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`, with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: geoBoundaries `LBR ADM1`, joined to DHS county labels.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: compare weighted national totals with final-report totals, join coverage, licence and attribution strings.

## Risks and open questions

- Civil-war displacement and survey coverage changes affect older waves.
- MIS waves may not share full DHS religion coding.

## Deep-history potential

Center for National Documents and Records Agency, Liberia National Archives, Methodist and Episcopal mission archives, Catholic mission records, Lutheran archives, and Americo-Liberian church records.
