# Country data map: Namibia (NA)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| DHS Program surveys API, https://api.dhsprogram.com/rest/dhs/surveys?countryIds=NM&f=json, and dataset API, https://api.dhsprogram.com/rest/dhs/datasets?countryIds=NM&f=json | respondent religious affiliation in DHS recodes; survey estimates | DHS region | 1992, 2000, 2006-07, 2013 | API metadata, PDF reports, recode ZIPs | reports open; recodes require free DHS approval | DHS terms; cite DHS Program |
| Namibia Statistics Agency census releases, https://nsa.nsa.org.na/ | census population context; public religion table not verified in this sweep | region/constituency for population context | 2011, 2023 | PDF/web release | open web | licence not stated |

Constructs are not interchangeable: DHS respondent affiliation is a survey estimate and must stay separate from census population context.

## Boundaries

- Official boundary files: geoBoundaries ADM1 regions, 2022, public domain; ADM2 units, 2007, public domain.
- Boundary changes between waves and the harmonisation plan: anchor on DHS regions for the survey product.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not counted during this source sweep; run ohsome or Overpass before build.
- Country-specific registers that could seed or verify the layer: Council of Churches in Namibia, Evangelical Lutheran Church in Namibia, Catholic dioceses, Islamic Judicial Council of Namibia.

## First visualisation

DHS survey-estimated respondent religious affiliation by region, 1992-2013, with uncertainty intervals.

## Build recipe

1. Extract weighted religion by DHS region from IR/MR recodes; preserve survey weights and standard errors.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`, with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: geoBoundaries `NAM ADM1`, joined to DHS region labels.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: compare weighted national totals with final-report totals, join coverage, licence and attribution strings.

## Risks and open questions

- No 2020-2024 DHS religion wave was found.
- Lutheran categories may require more detail than DHS coding preserves.

## Deep-history potential

National Archives of Namibia, Rhenish Missionary Society archives, Finnish Missionary Society records, Lutheran church archives, Catholic mission records, and colonial newspapers.
