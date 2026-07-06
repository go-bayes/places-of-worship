# Country data map: Benin (BJ)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| DHS Program surveys API, https://api.dhsprogram.com/rest/dhs/surveys?countryIds=BJ&f=json, and dataset API, https://api.dhsprogram.com/rest/dhs/datasets?countryIds=BJ&f=json | respondent religious affiliation in DHS recodes; survey estimates | DHS department | 1996, 2001, 2006, 2011-12, 2017-18 | API metadata, PDF reports, recode ZIPs | reports open; recodes require free DHS approval | DHS terms; cite DHS Program |
| INStaD census releases, https://instad.bj/ | census population context; public religion table not verified in this sweep | department/commune for population context | 2002, 2013 | PDF/web release | open web | licence not stated |

Constructs are not interchangeable: DHS respondent affiliation, census affiliation, and Vodun institutional records must stay separate.

## Boundaries

- Official boundary files: geoBoundaries ADM1 departments, 2012, public domain; ADM2 communes, 2007, public domain.
- Boundary changes between waves and the harmonisation plan: anchor on departments for the first DHS map.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not counted during this source sweep; run ohsome or Overpass before build.
- Country-specific registers that could seed or verify the layer: Catholic dioceses, Union Islamique du Benin, Protestant Methodist Church records, official Vodun heritage and temple leads.

## First visualisation

DHS survey-estimated respondent religious affiliation by department, 1996-2017/18, with uncertainty intervals.

## Build recipe

1. Extract weighted religion by DHS department from IR/MR recodes; preserve survey weights and standard errors.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`, with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: geoBoundaries `BEN ADM1`, joined to DHS department labels.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: compare weighted national totals with final-report totals, join coverage, licence and attribution strings.

## Risks and open questions

- DHS religion categories may compress Vodun and other traditional religion responses.
- No 2020-2024 DHS religion wave was found.

## Deep-history potential

Archives nationales du Benin, Society of African Missions archives, Catholic diocesan records, Vodun temple and royal-court archives, and Dahomey colonial records.
