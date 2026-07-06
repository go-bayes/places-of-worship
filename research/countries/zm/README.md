# Country data map: Zambia (ZM)

## Status

- **Tier**: A (buildable now)
- **Build state**: survey verified
- **Last verified**: 2026-07-07 (verification: https://www.zamstats.gov.zm/population-census/; https://www.geoboundaries.org/api/current/gbOpen/ZMB/ADM2/)

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| Zambia Statistics Agency population census page, https://www.zamstats.gov.zm/population-census/ | census affiliation | district | 2022 | web page/PDF reports | open web | licence not stated |
| Zambia 2010 Census of Population and Housing reports, https://www.zamstats.gov.zm/census/ | census affiliation | district/province tables | 2010 | PDF/report | open web | licence not stated |
| Zambia Data Portal, https://zambia.opendataforafrica.org/ | census-derived religion tables where exposed | province/district to verify | 2010, 2022 | web table/API portal | open web | portal terms |

Constructs are not interchangeable: census affiliation and DHS respondent affiliation must stay in separate layers.

## Boundaries

- Official boundary files: geoBoundaries ADM2 districts, 2020, CC BY 4.0.
- Boundary changes between waves and the harmonisation plan: anchor on 2022/2020 districts, then concord 2010 districts and the creation of Muchinga Province.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not counted during this source sweep; run ohsome or Overpass before build.
- Country-specific registers that could seed or verify the layer: Council of Churches in Zambia, Zambia Conference of Catholic Bishops, Evangelical Fellowship of Zambia, Islamic Supreme Council of Zambia.

## First visualisation

Census religious-affiliation percent by district, 2010 and 2022, on 2022 district boundaries.

## Build recipe

1. Extract: start with the 2022 Census district religion table, then add 2010 district/province tables.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`, with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: geoBoundaries `ZMB ADM2`, join by district and province.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: reconcile national totals, join coverage, licence and attribution strings.

## Risks and open questions

- District creation between 2010 and 2022 requires a concordance.
- ZamStats download links may sit behind WordPress download-manager pages.

## Deep-history potential

National Archives of Zambia, London Missionary Society records, Catholic White Fathers and Jesuit mission archives, United Church of Zambia records, and David Livingstone-related archives.
