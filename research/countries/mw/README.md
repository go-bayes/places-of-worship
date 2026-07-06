# Country data map: Malawi (MW)

## Status

- **Tier**: A (buildable now)
- **Build state**: survey verified
- **Last verified**: 2026-07-07 (verification: https://www.nsomalawi.mw/2018-population-and-housing-census/; https://www.geoboundaries.org/api/current/gbOpen/MWI/ADM2/)

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| Malawi National Statistical Office 2018 Population and Housing Census page, https://www.nsomalawi.mw/2018-population-and-housing-census/ | census affiliation | district | 2018 | public page; report tables require PDF extraction | open web | licence not stated |
| Malawi NSO 2008 and 1998 census reports, https://www.nsomalawi.mw/ | census affiliation | district in main reports | 1998, 2008 | PDF/report | open web; paths need verification | licence not stated |
| DHS Program surveys API, https://api.dhsprogram.com/rest/dhs/surveys?countryIds=MW&f=json | respondent religious affiliation in survey recodes; survey estimates | DHS region | 1992-2024 | API metadata, reports, recode ZIPs | reports open; recodes require DHS approval | DHS terms |

Constructs are not interchangeable: census affiliation and DHS respondent affiliation must stay in separate layers.

## Boundaries

- Official boundary files: geoBoundaries ADM2 districts, 2020, CC BY 3.0 IGO.
- Boundary changes between waves and the harmonisation plan: anchor on 2018/2020 districts and document city/district splits.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not counted during this source sweep; run ohsome or Overpass before build.
- Country-specific registers that could seed or verify the layer: Malawi Council of Churches, Episcopal Conference of Malawi, Muslim Association of Malawi, CCAP synod records.

## First visualisation

Census religious-affiliation percent by district, 1998, 2008, and 2018, on 2018 district boundaries.

## Build recipe

1. Extract: start with the 2018 PHC district religion table in the NSO main report, then add 2008 and 1998 district tables.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`, with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: geoBoundaries `MWI ADM2`, join by district and city names.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: reconcile national totals, join coverage, licence and attribution strings.

## Risks and open questions

- Current NSO pages are client-rendered, and some PDF paths have moved.
- Religious categories changed between 2008 and 2018.

## Deep-history potential

National Archives of Malawi, Livingstonia Mission archives, Universities' Mission to Central Africa records, CCAP synod archives, Catholic mission archives, and historical Nyasaland newspapers.
