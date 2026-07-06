# Country data map: Burundi (BI)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| DHS Program surveys API, https://api.dhsprogram.com/rest/dhs/surveys?countryIds=BU&f=json, and dataset API, https://api.dhsprogram.com/rest/dhs/datasets?countryIds=BU&f=json | respondent religious affiliation in DHS recodes; survey estimates | DHS region | 1987, 2010, 2012 MIS, 2016-17 | API metadata, PDF reports, recode ZIPs | reports open; recodes require free DHS approval | DHS terms; cite DHS Program |

Constructs are not interchangeable: DHS respondent affiliation is a survey estimate. It is not census affiliation.

## Boundaries

- Official boundary files: geoBoundaries ADM1 provinces, 2014, CC0; ADM2 communes, 2007, public domain.
- Boundary changes between waves and the harmonisation plan: anchor survey estimates on DHS region labels; use ADM1 only where labels match.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not counted during this source sweep; run ohsome or Overpass before build.
- Country-specific registers that could seed or verify the layer: Conseil National des Eglises du Burundi, Catholic dioceses, Islamic Community of Burundi, Seventh-day Adventist mission records.

## First visualisation

DHS survey-estimated respondent religious affiliation by region, 1987-2016/17, with uncertainty intervals.

## Build recipe

1. Extract weighted religion by DHS region from IR/MR recodes; preserve survey weights and standard errors.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`, with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: geoBoundaries `BDI ADM1`, joined to DHS regions after label reconciliation.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: compare weighted national totals with final-report totals, join coverage, licence and attribution strings.

## Risks and open questions

- No 2020-2024 DHS religion wave was found.
- DHS regions and province boundaries may not match across waves.

## Deep-history potential

Archives nationales du Burundi, Belgian African Archives, Missionaries of Africa archives, Catholic diocesan records, and Protestant mission records.
