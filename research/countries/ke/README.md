# Country data map: Kenya (KE)

## Status

- **Tier**: A (buildable now)
- **Build state**: survey verified
- **Last verified**: 2026-07-07 (verification: https://www.knbs.or.ke/reports/kenya-census-2019/; https://www.geoboundaries.org/api/current/gbOpen/KEN/ADM1/)

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| Kenya National Bureau of Statistics 2019 Kenya Population and Housing Census Volume IV, https://www.knbs.or.ke/reports/kenya-census-2019/ | census affiliation | county; county report tables expose religious categories | 2019 | PDF download landing page | open web | licence not stated |
| Kenya National Bureau of Statistics 2009 Census reports, https://www.knbs.or.ke/reports/kenya-census-2009/ | census affiliation | district/province to harmonise to counties | 2009 | PDF download landing page | open web | licence not stated |
| DHS Program surveys API, https://api.dhsprogram.com/rest/dhs/surveys?countryIds=KE&f=json | respondent religious affiliation in survey recodes; survey estimates | DHS region | 1989-2022 | API metadata, reports, recode ZIPs | reports open; recodes require DHS approval | DHS terms |

Constructs are not interchangeable: census affiliation and DHS respondent affiliation must stay in separate layers.

## Boundaries

- Official boundary files: geoBoundaries ADM1 counties, 2020, public domain; ADM2 sub-counties, 2020, CC BY 3.0 IGO.
- Boundary changes between waves and the harmonisation plan: anchor on 2019 counties and create district-to-county crosswalks for 2009.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not counted during this source sweep; run ohsome or Overpass before build.
- Country-specific registers that could seed or verify the layer: National Council of Churches of Kenya, Kenya Conference of Catholic Bishops, Supreme Council of Kenya Muslims, Anglican Church of Kenya dioceses.

## First visualisation

Census religious-affiliation percent by county, 2009 and 2019, on 2019 county boundaries.

## Build recipe

1. Extract: start with 2019 KPHC Volume IV religion-by-county tables, then add 2009 religion tables.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`, with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: geoBoundaries `KEN ADM1` counties; keep `KEN ADM2` sub-counties for later detail.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: reconcile national totals, join coverage, licence and attribution strings.

## Risks and open questions

- 2009 district geography does not match 2019 counties cleanly.
- PDF table extraction may be needed for both waves.

## Deep-history potential

Kenya National Archives, Church Missionary Society records, Consolata and Catholic diocesan archives, Anglican Church of Kenya archives, Swahili coast mosque histories, and digitised Kenyan newspapers.
