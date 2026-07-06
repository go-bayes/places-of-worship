# Country data map: Ghana (GH)

## Status

- **Tier**: A (buildable now)
- **Build state**: survey verified
- **Last verified**: 2026-07-07 (verification: https://census2021.statsghana.gov.gh/gssmain/fileUpload/reportthemelist/2021%20PHC%20General%20Report%20Vol%203C_Background%20Characteristics_181121.pdf; https://www.geoboundaries.org/api/current/gbOpen/GHA/ADM2/)

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| Ghana Statistical Service 2021 PHC General Report Vol. 3C: Background Characteristics, https://census2021.statsghana.gov.gh/gssmain/fileUpload/reportthemelist/2021%20PHC%20General%20Report%20Vol%203C_Background%20Characteristics_181121.pdf | census affiliation | district | 2021 | PDF | open web | licence not stated |
| Ghana Statistical Service 2010 PHC reports and microdata catalogue, https://www2.statsghana.gov.gh/nada/index.php/catalog/51 | census affiliation | district in district reports | 2010 | PDF/catalogue | open web | licence not stated |
| Ghana Statistical Service census portal, https://census2021.statsghana.gov.gh/ | census affiliation and district population context | district | 2000, 2010, 2021 | PDF/web portal | open web | licence not stated |

Constructs are not interchangeable: census affiliation, DHS respondent religion, and congregation directories measure different things.

## Boundaries

- Official boundary files: geoBoundaries ADM2 districts, 2019, CC BY 4.0, sourced from USAID Ghana HPNO and Ghana Statistical Service.
- Boundary changes between waves and the harmonisation plan: anchor on 2021/2019 districts and create a concordance for 2000/2010 district splits.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not counted during this source sweep; run ohsome or Overpass before build.
- Country-specific registers that could seed or verify the layer: Christian Council of Ghana, Ghana Pentecostal and Charismatic Council, Catholic dioceses, Ahmadiyya Muslim Mission Ghana, Ghana Museums and Monuments Board heritage lists.

## First visualisation

Census religious-affiliation percent by district, 2000-2021, on 2021 district boundaries.

## Build recipe

1. Extract: start with the 2021 PHC Vol. 3C district religion table, then add 2010 district report religion tables.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`, with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: geoBoundaries `GHA ADM2` districts, join by district name and region.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: reconcile national totals, join coverage, licence and attribution strings.

## Risks and open questions

- District splits between 2000, 2010, and 2021 need a concordance.
- Some older district analytical reports may require PDF table extraction.

## Deep-history potential

Public Records and Archives Administration Department, Basel Mission archives, Wesleyan Methodist Missionary Society records, Catholic diocesan archives, Ghanaian newspapers, Larabanga Mosque heritage material, and Ghana Museums and Monuments Board files.
