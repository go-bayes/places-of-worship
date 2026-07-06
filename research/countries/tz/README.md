# Country data map: Tanzania (TZ)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| DHS Program surveys API, https://api.dhsprogram.com/rest/dhs/surveys?countryIds=TZ&f=json, and dataset API, https://api.dhsprogram.com/rest/dhs/datasets?countryIds=TZ&f=json | respondent religious affiliation in DHS recodes; survey estimates | DHS region | 1991-92, 1996, 1999, 2003-04 AIS, 2004-05, 2007-08 AIS, 2010, 2011-12 AIS, 2015-16, 2017 MIS, 2022 | API metadata, PDF reports, recode ZIPs | reports open; recodes require free DHS approval | DHS terms; cite DHS Program |
| National Bureau of Statistics census releases, https://www.nbs.go.tz/ | census population context; religion table not verified in this sweep | region/district for population context | 2012, 2022 | PDF/web release | open web | licence not stated |

Constructs are not interchangeable: DHS respondent affiliation is a survey estimate. It must not be presented as census affiliation.

## Boundaries

- Official boundary files: geoBoundaries ADM1 regions, 2015, ODbL; ADM2 districts, 2021, CC BY 3.0 IGO.
- Boundary changes between waves and the harmonisation plan: anchor on DHS region labels and document mainland/Zanzibar treatment.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not counted during this source sweep; run ohsome or Overpass before build.
- Country-specific registers that could seed or verify the layer: Christian Council of Tanzania, Tanzania Episcopal Conference, National Muslim Council of Tanzania, Lutheran and Anglican dioceses.

## First visualisation

DHS survey-estimated respondent religious affiliation by region, 1991/92-2022, with mainland and Zanzibar labelled explicitly.

## Build recipe

1. Extract weighted religion by DHS region from IR/MR recodes; preserve survey weights and standard errors.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`, with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: geoBoundaries `TZA ADM1`, joined to DHS region labels.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: compare weighted national totals with final-report totals, join coverage, licence and attribution strings.

## Risks and open questions

- Zanzibar and mainland samples may require separate presentation.
- AIS and MIS waves may carry different religion coding.

## Deep-history potential

Tanzania National Archives, Zanzibar National Archives, Universities' Mission to Central Africa records, German colonial mission records, White Fathers archives, and Swahili coast mosque records.
