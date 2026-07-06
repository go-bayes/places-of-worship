# Country data map: Togo (TG)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| DHS Program surveys API, https://api.dhsprogram.com/rest/dhs/surveys?countryIds=TG&f=json, and dataset API, https://api.dhsprogram.com/rest/dhs/datasets?countryIds=TG&f=json | respondent religious affiliation in DHS recodes; survey estimates | DHS region | 1988, 1998, 2013-14, 2017 MIS | API metadata, PDF reports, recode ZIPs | reports open; recodes require free DHS approval | DHS terms; cite DHS Program |
| INSEED census releases, https://inseed.tg/ | census population context; public religion table not verified in this sweep | region/prefecture for population context | 2010, 2022 | PDF/web release | open web | licence not stated |

Constructs are not interchangeable: DHS respondent affiliation is a survey estimate and must stay separate from census population context.

## Boundaries

- Official boundary files: geoBoundaries ADM1 regions, 2017, ODbL; ADM2 prefectures, 2017, CC BY-SA 2.0.
- Boundary changes between waves and the harmonisation plan: anchor on DHS regions.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not counted during this source sweep; run ohsome or Overpass before build.
- Country-specific registers that could seed or verify the layer: Christian Council of Togo, Catholic dioceses, Union Musulmane du Togo, Evangelical Presbyterian Church records.

## First visualisation

DHS survey-estimated respondent religious affiliation by region, 1988-2017, with uncertainty intervals.

## Build recipe

1. Extract weighted religion by DHS region from IR/MR recodes; preserve survey weights and standard errors.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`, with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: geoBoundaries `TGO ADM1`, joined to DHS region labels.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: compare weighted national totals with final-report totals, join coverage, licence and attribution strings.

## Risks and open questions

- No 2020-2024 DHS religion wave was found.
- Traditional religion categories may vary across waves.

## Deep-history potential

Archives nationales du Togo, Bremen Mission and Norddeutsche Mission records, Society of African Missions archives, Catholic diocesan records, and German colonial records.
