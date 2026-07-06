# Country data map: Mozambique (MZ)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| DHS Program surveys API, https://api.dhsprogram.com/rest/dhs/surveys?countryIds=MZ&f=json, and dataset API, https://api.dhsprogram.com/rest/dhs/datasets?countryIds=MZ&f=json | respondent religious affiliation in DHS recodes; survey estimates | DHS province | 1997, 2003, 2009 AIS, 2011, 2015 AIS, 2018 MIS, 2022-23 | API metadata, PDF reports, recode ZIPs | reports open; recodes require free DHS approval | DHS terms; cite DHS Program |
| Instituto Nacional de Estatistica census releases, https://www.ine.gov.mz/ | census population context; public religion table not verified in this sweep | province/district for population context | 2007, 2017 | PDF/web release | open web | licence not stated |

Constructs are not interchangeable: DHS respondent affiliation is a survey estimate and should not be treated as census affiliation.

## Boundaries

- Official boundary files: geoBoundaries ADM1 provinces, 2017, ODbL; ADM2 districts, 2019, CC BY 3.0 IGO.
- Boundary changes between waves and the harmonisation plan: anchor on DHS provinces, with Cabo Delgado coverage reviewed separately.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not counted during this source sweep; run ohsome or Overpass before build.
- Country-specific registers that could seed or verify the layer: Christian Council of Mozambique, Catholic dioceses, Islamic Council of Mozambique, Swiss Mission records.

## First visualisation

DHS survey-estimated respondent religious affiliation by province, 1997-2022/23, with uncertainty intervals.

## Build recipe

1. Extract weighted religion by DHS province from IR/MR recodes; preserve survey weights and standard errors.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`, with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: geoBoundaries `MOZ ADM1`, joined to DHS province labels.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: compare weighted national totals with final-report totals, join coverage, licence and attribution strings.

## Risks and open questions

- Conflict and displacement may affect northern survey coverage.
- AIS and MIS waves may not align with full DHS religion coding.

## Deep-history potential

Arquivo Historico de Mocambique, Catholic mission archives, Swiss Mission records, Methodist and Anglican archives, Islamic coastal records, and colonial newspapers.
