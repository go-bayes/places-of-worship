# Country data map: Ghana (GH)

## Status

- **Tier**: A (buildable now)
- **Build state**: map live (2021 wave, 16-region level); companion ten-region product built for 2010 and 2021; UI wiring remains separate
- **Last verified**: 2026-07-09 (built: GSS 2021 PHC General Report Vol. 3C table 5.7, 16 regions; GSS StatsBank PHC2010 POP16, aggregated to the old ten-region frame and validated against National Analytical Report table 4.17; geoBoundaries GHA ADM1 2019/16-region plus dissolved ten-region derivative)

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| Ghana Statistical Service 2021 PHC General Report Vol. 3C: Background Characteristics, table 5.7, https://census2021.statsghana.gov.gh/gssmain/fileUpload/reportthemelist/2021%20PHC%20General%20Report%20Vol%203C_Background%20Characteristics_181121.pdf | census affiliation | region (16) in Vol. 3C | 2021 | PDF | open web | licence not stated |
| Ghana Statistical Service 2021 StatsBank PxWeb religion table, https://statsbank.statsghana.gov.gh/pxweb/en/PHC%202021%20StatsBank/PHC%202021%20StatsBank__Population/religion_table.px/ | census affiliation | district (261) | 2021 | PxWeb interactive/API | open web (API unstable) | licence not stated |
| Ghana Statistical Service StatsBank PHC2010 POP16, https://statsbank.statsghana.gov.gh/api/v1/en/PHC2010/Population/POP16%20Population%20by%20Religious%20Affiliation,%20Age,%20Sex,%20Locality,%20and%20Geographic_Area.px | census affiliation | region (current 16 in StatsBank; exact sums to old 10) | 2010 | PxWeb API/CSV | open web (TLS chain required `curl -k` locally) | licence not stated |
| Ghana Statistical Service 2010 PHC National Analytical Report, table 4.17, https://new-ndpc-static1.s3.amazonaws.com/pubication/2010PHC+National+Analytical+Report.pdf | census affiliation | region (10, pre-2019) | 2010 | PDF | open web | licence not stated |
| Ghana Statistical Service 2000 PHC religion (StatsBank census atlas; IPUMS International 10% sample), https://statsbank.statsghana.gov.gh/censusatlas/Religion.html | census affiliation | region/district (pre-2019) | 2000 | web/microdata | open web / IPUMS terms | licence not stated |

Constructs are not interchangeable: census affiliation, DHS respondent religion, and congregation directories measure different things.

**Build decision (2026-07-09)**: shipped the live map at **2021 region** level. Vol. 3C publishes religion at region (16) only; district religion is not in Vol. 3C. The 2021 StatsBank PxWeb table does publish religion by district (261), but its PxWeb REST route was not used for the live page in this build; the district route remains deferred.

**Ten-region companion decision (2026-07-09)**: added a companion product on the pre-2019 **ten-region** geography (Western, Central, Greater Accra, Volta, Eastern, Ashanti, Brong Ahafo, Northern, Upper East, Upper West). StatsBank PHC2010 POP16 now returns exact 2010 counts on the current 16-region list; those rows aggregate exactly to the old ten regions printed in the 2010 National Analytical Report table 4.17. The 2021 companion rows are exact sums from the existing 16-region product. The 2019 reform split Western into Western and Western North, Volta into Volta and Oti, Northern into Northern, Savannah, and North East, and Brong Ahafo into Bono, Bono East, and Ahafo; the other six old regions are unchanged.

**Category mapping (2021, Table 5.7)**: the census categorises religion into eight groups. Religious affiliation combines the seven named-religion groups (Catholic, Protestant, Pentecostal/Charismatic, Other Christian, Islam, Traditionalist, Other Religion); no religion is the No Religion group; Christian is a printed subtotal of the four Christian groups and is not double-counted. The denominator is the table 5.7 regional total (all locality types, both sexes) — the census allocates every person to one of the eight groups, so there is no not-stated category. Nationally: denominator 30,753,327; religious affiliation 30,424,606 (98.93%); no religion 328,721 (1.07%). The Table 5.7 total (30,753,327) is 78,692 below the enumerated 2021 population (30,832,019, Table 1.1); that gap sits outside the religion table.

**Category mapping (2010, StatsBank POP16)**: the source groups map directly onto the 2021 headline scheme. Religious affiliation combines Catholic, Protestants, Pentecostal/Charismatic, Other christian, Islam, Traditionalist, and Other; no religion is the No religion group; Total is the denominator. Nationally: denominator 24,658,823; religious affiliation 23,356,746 (94.72%); no religion 1,302,077 (5.28%).

## Access the data yourself

This project does not redistribute source data; the map shows derived
rates with attribution. To obtain the data from the source of record:

- **Source of record**: Ghana Statistical Service, [2021 Population and Housing Census](https://census2021.statsghana.gov.gh/) and [GSS StatsBank](https://statsbank.statsghana.gov.gh/).
- **Exact 2021 table**: General Report Volume 3C (Background Characteristics), Table 5.7 "Population by Religious Affiliation, Sex and Region" — [Volume 3C PDF](https://census2021.statsghana.gov.gh/gssmain/fileUpload/reportthemelist/2021%20PHC%20General%20Report%20Vol%203C_Background%20Characteristics_181121.pdf).
- **Exact 2010 table**: StatsBank PHC2010 POP16 "Population by Religious Affiliation, District, Region, Type of Locality, Age, Sex, and Education" — API path `https://statsbank.statsghana.gov.gh/api/v1/en/PHC2010/Population/POP16%20Population%20by%20Religious%20Affiliation,%20Age,%20Sex,%20Locality,%20and%20Geographic_Area.px`; validation reference: 2010 National Analytical Report, table 4.17.
- **Boundaries**: geoBoundaries GHA ADM1 (16 post-2019 regions), CC BY-SA 2.0, boundary source OpenStreetMap — [metadata/API](https://www.geoboundaries.org/api/current/gbOpen/GHA/ADM1/). The ten-region companion boundary dissolves the committed 16-region derivative and keeps the CC BY-SA 2.0 attribution.
- **Licence**: GSS publishes the census report and StatsBank table for open access; no explicit reuse licence is stated. The derived product attributes GSS. geoBoundaries gbOpen ADM1 is CC BY-SA 2.0 (boundary source OpenStreetMap contributors).
- **Our extraction script**: [`scripts/build_gh_area_summary.R`](../../../scripts/build_gh_area_summary.R) — validates the existing 2021 16-region product, reads the pinned 2010 StatsBank query, aggregates both waves onto the old ten-region frame, dissolves the boundary, and writes the companion `area_summary` products.
- **Retrieval recipe and hashes**: [`docs/manifests/gh-census-religion-2010-2021.json`](../../../docs/manifests/gh-census-religion-2010-2021.json) — URLs, retrieval steps, and SHA-256s for every object used.

## Boundaries

- Shipped: geoBoundaries GHA ADM1, 16 post-2019 regions, CC BY-SA 2.0, boundary source OpenStreetMap contributors (gbOpen, sourceDataUpdateDate 2023). The 16 ADM1 regions match the 2021 census reporting units exactly and join 16/16 by name (the boundary " Region" suffix dropped); ISO 3166-2 `shapeISO` codes (GH-WN, ...) are the area codes.
- Companion: `apps/regions/gh/data/gh_region_2010_ten.geojson` dissolves the committed 16-region boundary to the old ten-region frame. Because the 16 regions nest exactly inside the old 10 regions, no areal weighting is used; the boundary remains a CC BY-SA 2.0 derivative of geoBoundaries/OpenStreetMap material.
- Note: the survey card originally pinned geoBoundaries ADM2 districts (CC BY 4.0, USAID/GSS source) for a district build. Vol. 3C publishes religion at region level only, so the region product uses ADM1. The current gbOpen ADM1 release is OSM-sourced under CC BY-SA 2.0 — a different licence and source from the ADM2 districts; recorded honestly here and in the manifest. geoBoundaries GHA ADM2 (CC BY 4.0) remains the boundary route for a future district product.
- Boundary changes between waves and the harmonisation plan: the live map stays anchored on the 2021/16-region geography; the companion product places 2010 and aggregated 2021 on the pre-2019 ten-region frame.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not counted during this source sweep; run ohsome or Overpass before build.
- Country-specific registers that could seed or verify the layer: Christian Council of Ghana, Ghana Pentecostal and Charismatic Council, Catholic dioceses, Ahmadiyya Muslim Mission Ghana, Ghana Museums and Monuments Board heritage lists.

## First visualisation

Built: census religious-affiliation percent and no-religion percent by region, 2021, on the 16 post-2019 region boundaries. The data directory also contains a ten-region companion product for 2010 and aggregated 2021, ready for later UI wiring. Next: district (261) religion if a stable extraction route is approved, then the 2000 wave on the ten-region frame.

## Build recipe

1. Extract: `scripts/build_gh_area_summary.R` validates Vol. 3C Table 5.7 (2021 region religion), reads the pinned StatsBank PHC2010 POP16 CSV, and validates the 2010 ten-region frame against National Analytical Report table 4.17.
2. Governed product: `area_summary` per `schemas/area-summary.schema.json`, with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: geoBoundaries `GHA ADM1` (16 regions), joined by normalised region name for the live product and dissolved to ten old regions for the companion product.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md` — `apps/regions/gh/index.html`; no UI wiring changed for the ten-region companion.
5. Verification: reconcile national totals, concordance sums, join coverage, licence, and attribution strings.

## Risks and open questions

- District (261) religion sits behind StatsBank; district detail is deferred until a stable extraction and boundary plan is approved.
- The 2000 wave still needs extraction on the ten-region frame before it can join the companion product.
- Some older district analytical reports may require PDF table extraction.

## Deep-history potential

Public Records and Archives Administration Department, Basel Mission archives, Wesleyan Methodist Missionary Society records, Catholic diocesan archives, Ghanaian newspapers, Larabanga Mosque heritage material, and Ghana Museums and Monuments Board files.
