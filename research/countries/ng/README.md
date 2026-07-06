# Country data map: Nigeria (NG)

## Status

- **Tier**: C (documented exclusion)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| Historical census religion figures discussed in Philip Ostien, Nigeria Research Network, and later survey reviews | historical census affiliation | present-day state reconstructions from 1952/1963 | 1952, 1963; 1973 attempt unpublished | PDF/secondary reconstruction | open web where available | source-specific |
| DHS Program surveys API, https://api.dhsprogram.com/rest/dhs/surveys?countryIds=NG&f=json, and dataset API, https://api.dhsprogram.com/rest/dhs/datasets?countryIds=NG&f=json | respondent religious affiliation in DHS recodes; survey estimates | DHS zone/state depending wave | 1990, 2003, 2008, 2010 MIS, 2013, 2015 MIS, 2018, 2021 MIS, 2024 | API metadata, PDF reports, recode ZIPs | reports open; recodes require free DHS approval | DHS terms; cite DHS Program |

Constructs are not interchangeable: Nigeria has survey estimates after the published census religion series stopped.

## Boundaries

- Official boundary files: geoBoundaries ADM1 states, 2022, CC BY 4.0; ADM2 local government areas, 2022, CC BY 4.0.
- Boundary changes between waves and the harmonisation plan: do not build a census-affiliation time series without a governed source and explicit sensitivity review.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not counted during this source sweep; run ohsome or Overpass before any local pilot.
- Country-specific registers that could seed or verify the layer: Christian Association of Nigeria, Nigerian Supreme Council for Islamic Affairs, Catholic dioceses, Anglican Church of Nigeria dioceses.

## First visualisation

No first country map. Nigeria stopped publishing religion in the census after the mid-twentieth-century series; later religion estimates come from surveys and are politically sensitive.

## Build recipe

1. Do not build a national census-affiliation map from post-1963 census data.
2. If Nigeria is reopened, start with a sensitivity memo that separates historical census reconstructions, DHS estimates, Afrobarometer estimates, and congregation directories.
3. Boundaries: geoBoundaries `NGA ADM1` only after the construct and sensitivity route are approved.
4. Region page: none until the exclusion is reversed.
5. Verification: require source-owner and project approval before public mapping.

## Risks and open questions

- Religion was omitted from later censuses because the census itself is politically contested and religion is a high-sensitivity national category.
- DHS and Afrobarometer can support cautious survey analysis, but the brief directs Nigeria to Tier C for the census route.

## Deep-history potential

National Archives of Nigeria, Church Missionary Society records, Methodist and Catholic mission archives, Nigerian Supreme Council for Islamic Affairs material, colonial gazetteers, and regional newspapers.
