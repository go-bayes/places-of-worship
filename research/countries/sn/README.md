# Country data map: Senegal (SN)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| DHS Program surveys API, https://api.dhsprogram.com/rest/dhs/surveys?countryIds=SN&f=json, and dataset API, https://api.dhsprogram.com/rest/dhs/datasets?countryIds=SN&f=json | respondent religious affiliation in DHS recodes; survey estimates | DHS region | 1986, 1992-93, 1997, 2005, 2006 MIS, 2008-09 MIS, 2010-11, 2012-13, annual/continuous waves 2014-2020/21, 2023 | API metadata, PDF reports, recode ZIPs | reports open; recodes require free DHS approval | DHS terms; cite DHS Program |
| ANSD census releases, https://www.ansd.sn/ | census population context; religion table not verified in this sweep | region/department for population context | 2013, 2023 | PDF/web release | open web | licence not stated |

Constructs are not interchangeable: DHS respondent affiliation is a survey estimate and should not be treated as census affiliation.

## Boundaries

- Official boundary files: geoBoundaries ADM1 regions, 2019, CC BY 3.0 IGO; ADM2 departments, 2019, CC BY 3.0 IGO.
- Boundary changes between waves and the harmonisation plan: anchor on DHS region labels and document continuous-DHS region changes.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not counted during this source sweep; run ohsome or Overpass before build.
- Country-specific registers that could seed or verify the layer: Conseil Islamique du Senegal, Catholic dioceses, Sufi brotherhood centre records, Protestant church directories.

## First visualisation

DHS survey-estimated respondent religious affiliation by region, 1986-2023, with uncertainty intervals.

## Build recipe

1. Extract weighted religion by DHS region from IR/MR recodes; preserve survey weights and standard errors.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`, with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: geoBoundaries `SEN ADM1`, joined to DHS region labels.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: compare weighted national totals with final-report totals, join coverage, licence and attribution strings.

## Risks and open questions

- Senegal is overwhelmingly Muslim; small minority estimates may have large uncertainty.
- Continuous-DHS waves require careful treatment of sample design.

## Deep-history potential

Archives nationales du Senegal, Archives nationales d'outre-mer, Catholic Spiritan archives, Mouride and Tijaniyya brotherhood materials, Islamic school records, and colonial newspapers.
