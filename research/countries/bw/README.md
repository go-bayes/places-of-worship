# Country data map: Botswana (BW)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| Statistics Botswana Census 2022 page, https://www.statsbots.org.bw/census-2022 | census affiliation | national confirmed; district table not verified in this sweep | 2022 | web/PDF and official media releases | open web | licence not stated |
| Statistics Botswana 2011 census analytical report, https://www.statsbots.org.bw/ | census affiliation | national confirmed; district table to verify | 2011 | PDF/report | open web | licence not stated |
| DHS Program surveys API, https://api.dhsprogram.com/rest/dhs/surveys?countryIds=BT&f=json | respondent religious affiliation in DHS recodes; survey estimates | DHS district/region to verify | 1988 | API metadata, report, recode ZIP | reports open; recodes require DHS approval | DHS terms |

Constructs are not interchangeable: census affiliation and DHS respondent affiliation must stay separate.

## Boundaries

- Official boundary files: geoBoundaries ADM1 districts, 2017, CC BY-SA 2.0; ADM2 units, 2015, public domain.
- Boundary changes between waves and the harmonisation plan: verify whether 2011 and 2022 religion tables expose districts before promoting to Tier A.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not counted during this source sweep; run ohsome or Overpass before build.
- Country-specific registers that could seed or verify the layer: Botswana Council of Churches, Catholic Diocese of Gaborone and Francistown, Botswana Muslim Association, United Congregational Church of Southern Africa.

## First visualisation

If district tables are obtained, census religious-affiliation percent by district, 2011 and 2022; otherwise a national trend card only.

## Build recipe

1. Extract: locate the Statistics Botswana 2022 fertility, mortality, migration, and religion tables, then test whether district rows are public.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`, with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: geoBoundaries `BWA ADM1` districts.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md` only if subnational religion rows are public.
5. Verification: reconcile national totals, join coverage, licence and attribution strings.

## Risks and open questions

- The 2022 religion release was found as an official detailed-results item, but a district table was not confirmed.
- A single 1988 DHS wave is not enough for a DHS time series.

## Deep-history potential

Botswana National Archives and Records Services, London Missionary Society records, United Congregational Church archives, Catholic mission records, and Bechuanaland Protectorate files.
