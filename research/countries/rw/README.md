# Country data map: Rwanda (RW)

## Status

- **Tier**: A (buildable now)
- **Build state**: survey verified
- **Last verified**: 2026-07-07 (verification: https://statistics.gov.rw/statistical-publications; https://www.geoboundaries.org/api/current/gbOpen/RWA/ADM2/)

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| National Institute of Statistics of Rwanda RPHC5 publications and district profiles, https://statistics.gov.rw/statistical-publications | census affiliation | district | 2022 | PDF/web profile | open web | licence not stated |
| NISR RPHC4 thematic report: Socio-cultural Characteristics of the Population, via https://statistics.gov.rw/statistical-publications | census affiliation | district | 2012 | PDF | open web | licence not stated |
| Rwanda Data Portal religion series, https://rwanda.opendataforafrica.org/ | census affiliation | district where exposed by table | 2012, 2022 | web table/API portal | open web | portal terms |

Constructs are not interchangeable: census affiliation and DHS respondent affiliation must stay in separate layers.

## Boundaries

- Official boundary files: geoBoundaries ADM2 districts, 2012, CC BY 4.0; ADM1 provinces, 2020, CC BY 4.0.
- Boundary changes between waves and the harmonisation plan: anchor on the 30-district system and retain sector identifiers only if both waves expose them.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not counted during this source sweep; run ohsome or Overpass before build.
- Country-specific registers that could seed or verify the layer: Rwanda Governance Board organisation records, Rwanda Interfaith Council, Catholic dioceses, Protestant Council of Rwanda.

## First visualisation

Census religious-affiliation percent by district, 2012 and 2022, on the 30-district boundary set.

## Build recipe

1. Extract: start with the RPHC5 district religion table, then add the RPHC4 socio-cultural religion table.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`, with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: geoBoundaries `RWA ADM2`, join by district name after standardising Kigali district labels.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: reconcile national totals, join coverage, licence and attribution strings.

## Risks and open questions

- NISR site paths are unstable; preserve downloaded source hashes in the manifest.
- Ethnicity is not part of the religion map and must not be inferred.

## Deep-history potential

Rwanda National Archives, Belgian African Archives, Missionaries of Africa archives, Catholic diocesan archives, Protestant mission records, and genocide memorial documentation where worship-site evidence is ethically usable.
