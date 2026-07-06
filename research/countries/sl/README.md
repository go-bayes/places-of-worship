# Country data map: Sierra Leone (SL)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| DHS Program surveys API, https://api.dhsprogram.com/rest/dhs/surveys?countryIds=SL&f=json, and dataset API, https://api.dhsprogram.com/rest/dhs/datasets?countryIds=SL&f=json | respondent religious affiliation in DHS recodes; survey estimates | DHS region/district to verify | 2008, 2013, 2016 MIS, 2019 | API metadata, PDF reports, recode ZIPs | reports open; recodes require free DHS approval | DHS terms; cite DHS Program |
| Statistics Sierra Leone census releases, https://www.statistics.sl/ | census population context; public religion table not verified in this sweep | district for population context | 2015, 2021 | PDF/web release | open web | licence not stated |

Constructs are not interchangeable: DHS respondent affiliation is a survey estimate and must stay separate from census population context.

## Boundaries

- Official boundary files: geoBoundaries ADM1 provinces, 2014, CC BY 3.0 IGO; ADM2 districts, 2017, CC BY 3.0 IGO.
- Boundary changes between waves and the harmonisation plan: anchor on DHS region or district labels after recode inspection.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not counted during this source sweep; run ohsome or Overpass before build.
- Country-specific registers that could seed or verify the layer: Council of Churches in Sierra Leone, Supreme Islamic Council, Catholic dioceses, Methodist Church Sierra Leone.

## First visualisation

DHS survey-estimated respondent religious affiliation by region or district, 2008-2019, with uncertainty intervals.

## Build recipe

1. Extract weighted religion by DHS geography from IR/MR recodes; preserve survey weights and standard errors.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`, with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: geoBoundaries `SLE ADM2` if DHS district labels are valid, otherwise `SLE ADM1`.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: compare weighted national totals with final-report totals, join coverage, licence and attribution strings.

## Risks and open questions

- No 2020-2024 DHS religion wave was found.
- Ebola-era survey conditions may affect 2016 MIS interpretation.

## Deep-history potential

Sierra Leone Public Archives, Church Missionary Society records, Fourah Bay College archives, Methodist mission records, Catholic archives, and Freetown colonial newspapers.
