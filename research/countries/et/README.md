# Country data map: Ethiopia (ET)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| DHS Program surveys API, https://api.dhsprogram.com/rest/dhs/surveys?countryIds=ET&f=json, and dataset API, https://api.dhsprogram.com/rest/dhs/datasets?countryIds=ET&f=json | respondent religious affiliation in DHS recodes; survey estimates | DHS region | 2000, 2005, 2011, 2016, 2019 | API metadata, PDF reports, recode ZIPs | reports open; recodes require free DHS approval | DHS terms; cite DHS Program |
| Ethiopian Statistical Service census releases, https://www.statsethiopia.gov.et/ | census population context; public religion table not verified in this sweep | region for population context | 2007 | PDF/web release | open web | licence not stated |

Constructs are not interchangeable: DHS respondent affiliation is a survey estimate and should not replace census affiliation.

## Boundaries

- Official boundary files: geoBoundaries ADM1 kilil and astedader, 2016, CC BY 4.0; ADM2 zones, 2016, ODbL.
- Boundary changes between waves and the harmonisation plan: anchor on DHS region labels and treat new regions after 2019 as a separate harmonisation problem.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not counted during this source sweep; run ohsome or Overpass before build.
- Country-specific registers that could seed or verify the layer: Ethiopian Orthodox Tewahedo Church, Ethiopian Catholic Secretariat, Ethiopian Islamic Affairs Supreme Council, Evangelical Churches Fellowship of Ethiopia.

## First visualisation

DHS survey-estimated respondent religious affiliation by region, 2000-2019, with uncertainty intervals.

## Build recipe

1. Extract weighted religion by DHS region from IR/MR recodes; preserve survey weights and standard errors.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`, with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: geoBoundaries `ETH ADM1`, joined to DHS region labels.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: compare weighted national totals with final-report totals, join coverage, licence and attribution strings.

## Risks and open questions

- No 2020-2024 DHS religion wave was found.
- Regional boundary changes after the 2019 survey limit comparability.

## Deep-history potential

Ethiopian National Archives and Library Agency, Ethiopian Orthodox Tewahedo Church archives, Islamic waqf records, Catholic mission archives, and British Library Ethiopian manuscript collections.
