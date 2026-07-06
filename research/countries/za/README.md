# Country data map: South Africa (ZA)

## Status

- **Tier**: A (buildable now)
- **Build state**: survey verified
- **Last verified**: 2026-07-07 (verification: https://www.statssa.gov.za/publications/P03014/P030142022.pdf; https://www.geoboundaries.org/api/current/gbOpen/ZAF/ADM1/)

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| Statistics South Africa Census 2022 statistical release, https://www.statssa.gov.za/publications/P03014/P030142022.pdf | census affiliation | province | 2022 | PDF/web release | open web; site may require browser access | Stats SA terms; licence not stated |
| Statistics South Africa Census 1996/2001 primary tables, https://www.statssa.gov.za/?page_id=3839 | census affiliation | province | 1996, 2001 | web table/PDF | open web | Stats SA terms; licence not stated |
| Statistics South Africa Community Survey 2016, https://www.statssa.gov.za/publications/Report-03-01-11/Report-03-01-112016.pdf | household-survey affiliation | province | 2016 | PDF | open web | Stats SA terms; licence not stated |

Constructs are not interchangeable: census affiliation and survey affiliation must be labelled as separate layers.

## Boundaries

- Official boundary files: geoBoundaries ADM1 provinces, 2020, CC BY 3.0 IGO; ADM2 district municipalities also exist for later downscaling.
- Boundary changes between waves and the harmonisation plan: anchor the first product on 2022 provinces, then add district municipalities only if the religious table exposes them.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not counted during this source sweep; run ohsome or Overpass before build.
- Country-specific registers that could seed or verify the layer: South African Council of Churches, Catholic dioceses, Anglican Church of Southern Africa, Muslim Judicial Council, South African Jewish Board of Deputies.

## First visualisation

Census religious-affiliation percent by province, 1996, 2001, and 2022, with 2016 Community Survey affiliation shown as a separate survey layer.

## Build recipe

1. Extract: start with the 2022 Census religion-by-province table in `P030142022.pdf`, then add 1996/2001 Stats SA primary-table religion rows.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`, with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: geoBoundaries `ZAF ADM1` province GeoJSON, join by province name after normalising historical names.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: reconcile national totals, join coverage, licence and attribution strings.

## Risks and open questions

- Census 2011 omitted religion, and 2016 is a survey construct.
- Stats SA site access can be unstable behind its web security layer.

## Deep-history potential

National Archives and Records Service of South Africa, Cape Archives, Moravian Church archives, London Missionary Society records, Anglican and Catholic diocesan archives, and digitised South African newspaper collections.
