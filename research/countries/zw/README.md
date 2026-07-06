# Country data map: Zimbabwe (ZW)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| DHS Program surveys API, https://api.dhsprogram.com/rest/dhs/surveys?countryIds=ZW&f=json, and dataset API, https://api.dhsprogram.com/rest/dhs/datasets?countryIds=ZW&f=json | respondent religious affiliation in DHS recodes; survey estimates | DHS province | 1988, 1994, 1999, 2005-06, 2010-11, 2015 | API metadata, PDF reports, recode ZIPs | reports open; recodes require free DHS approval | DHS terms; cite DHS Program |
| Zimbabwe National Statistics Agency census releases, https://www.zimstat.co.zw/ | census population context; religion table not verified in this sweep | province/district for population context | 2012, 2022 | PDF/web release | open web | licence not stated |

Constructs are not interchangeable: DHS respondent affiliation is a survey estimate, and census population context is a different layer.

## Boundaries

- Official boundary files: geoBoundaries ADM1 provinces, 2020, CC BY 3.0 IGO; ADM2 districts, 2020, CC BY 3.0 IGO.
- Boundary changes between waves and the harmonisation plan: anchor DHS estimates on province labels and keep district boundaries for covariates only.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not counted during this source sweep; run ohsome or Overpass before build.
- Country-specific registers that could seed or verify the layer: Zimbabwe Council of Churches, Catholic dioceses, Apostolic Christian Council of Zimbabwe, Supreme Council of Islamic Affairs.

## First visualisation

DHS survey-estimated respondent religious affiliation by province, 1988-2015, with census population denominators shown separately.

## Build recipe

1. Extract weighted religion by DHS province from IR/MR recodes; preserve survey weights and standard errors.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`, with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: geoBoundaries `ZWE ADM1`, joined to DHS province labels.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: compare weighted national totals with final-report totals, join coverage, licence and attribution strings.

## Risks and open questions

- No 2020-2024 DHS religion wave was found.
- Apostolic and indigenous Christian categories may be coded differently across surveys.

## Deep-history potential

National Archives of Zimbabwe, London Missionary Society records, Inyati Mission material, Catholic mission archives, Methodist Church in Zimbabwe records, and Rhodesia-era newspapers.
