# Country data map: Uganda (UG)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| DHS Program surveys API, https://api.dhsprogram.com/rest/dhs/surveys?countryIds=UG&f=json, and dataset API, https://api.dhsprogram.com/rest/dhs/datasets?countryIds=UG&f=json | respondent religious affiliation in DHS recodes; survey estimates | DHS region | 1988-89, 1995, 2000-01, 2004-05 AIS, 2006, 2009 MIS, 2011 AIS/DHS, 2014-15 MIS, 2016, 2018-19 MIS, 2024-25 MIS | API metadata, PDF reports, recode ZIPs | reports open; recodes require free DHS approval | DHS terms; cite DHS Program |
| Uganda Bureau of Statistics census releases, https://www.ubos.org/ | census population context; religion table not verified in this sweep | district for population context | 2014, 2024 | PDF/web release | open web | licence not stated |

Constructs are not interchangeable: DHS respondent affiliation is a survey estimate. It must not be merged with census population counts.

## Boundaries

- Official boundary files: geoBoundaries ADM1 regions, 2017, ODbL; ADM2 counties, 2006, public domain.
- Boundary changes between waves and the harmonisation plan: anchor DHS estimates on survey regions; do not imply district precision.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not counted during this source sweep; run ohsome or Overpass before build.
- Country-specific registers that could seed or verify the layer: Uganda Joint Christian Council, Uganda Muslim Supreme Council, Catholic dioceses, Church of Uganda dioceses.

## First visualisation

DHS survey-estimated respondent religious affiliation by DHS region, 1988/89-2024/25, with uncertainty intervals.

## Build recipe

1. Extract weighted religion by DHS region from IR/MR recodes; preserve survey weights and standard errors.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`, with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: geoBoundaries `UGA ADM1` where it matches DHS region labels.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: compare weighted national totals with final-report totals, join coverage, licence and attribution strings.

## Risks and open questions

- Uganda's district count changed sharply over the series; DHS regions are safer for a first map.
- MIS waves may not carry the same religion variables as DHS waves.

## Deep-history potential

Uganda National Archives, Church Missionary Society records, White Fathers archives, Catholic and Anglican diocesan archives, Uganda Muslim Supreme Council material, and early Uganda Protectorate newspapers.
