# Country data map: Ghana (GH)

## Status

- **Tier**: A (buildable now)
- **Build state**: map live (2021 wave, region level)
- **Last verified**: 2026-07-09 (built: GSS 2021 PHC General Report Vol. 3C table 5.7, 16 regions; geoBoundaries GHA ADM1 2019/16-region; region sums reconcile exactly to the national totals)

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| Ghana Statistical Service 2021 PHC General Report Vol. 3C: Background Characteristics, table 5.7, https://census2021.statsghana.gov.gh/gssmain/fileUpload/reportthemelist/2021%20PHC%20General%20Report%20Vol%203C_Background%20Characteristics_181121.pdf | census affiliation | region (16) in Vol. 3C | 2021 | PDF | open web | licence not stated |
| Ghana Statistical Service 2021 StatsBank PxWeb religion table, https://statsbank.statsghana.gov.gh/pxweb/en/PHC%202021%20StatsBank/PHC%202021%20StatsBank__Population/religion_table.px/ | census affiliation | district (261) | 2021 | PxWeb interactive/API | open web (API unstable) | licence not stated |
| Ghana Statistical Service 2010 PHC National Analytical Report, table 4.17, https://new-ndpc-static1.s3.amazonaws.com/pubication/2010PHC+National+Analytical+Report.pdf | census affiliation | region (10, pre-2019) | 2010 | PDF | open web | licence not stated |
| Ghana Statistical Service 2000 PHC religion (StatsBank census atlas; IPUMS International 10% sample), https://statsbank.statsghana.gov.gh/censusatlas/Religion.html | census affiliation | region/district (pre-2019) | 2000 | web/microdata | open web / IPUMS terms | licence not stated |

Constructs are not interchangeable: census affiliation, DHS respondent religion, and congregation directories measure different things.

**Build decision (2026-07-09)**: shipped the 2021 wave at **region** level. Vol. 3C publishes religion at region (16) only; district religion is not in Vol. 3C. The 2021 StatsBank PxWeb table does publish religion by district (261), but its PxWeb REST API returned HTTP 500/404 during this build, so a clean district extract was not attainable — the district route is recorded as deferred (a stable API pull or a district analytical report PDF would unlock it).

**2010/2000 wave probe (2026-07-09)**: retrievable but not comparable on the 2021 boundaries. The 2010 National Analytical Report (Table 4.17) and the 2000 census both publish region religion using the same eight-group scheme, but on the pre-2019 **ten-region** geography (Western, Central, Greater Accra, Volta, Eastern, Ashanti, Brong Ahafo, Northern, Upper East, Upper West). The 2019 reform split four of those regions — Western → Western + Western North; Brong Ahafo → Bono + Bono East + Ahafo; Northern → Northern + Savannah + North East; Volta → Volta + Oti — producing the 16 regions the 2021 map uses. Earlier waves are deferred pending a ten-to-sixteen region concordance; both are recorded in the manifest's `deferred_sources`.

**Category mapping (2021, Table 5.7)**: the census categorises religion into eight groups. Religious affiliation combines the seven named-religion groups (Catholic, Protestant, Pentecostal/Charismatic, Other Christian, Islam, Traditionalist, Other Religion); no religion is the No Religion group; Christian is a printed subtotal of the four Christian groups and is not double-counted. The denominator is the table 5.7 regional total (all locality types, both sexes) — the census allocates every person to one of the eight groups, so there is no not-stated category. Nationally: denominator 30,753,327; religious affiliation 30,424,606 (98.93%); no religion 328,721 (1.07%). The Table 5.7 total (30,753,327) is 78,692 below the enumerated 2021 population (30,832,019, Table 1.1); that gap sits outside the religion table.

## Access the data yourself

This project does not redistribute source data; the map shows derived
rates with attribution. To obtain the data from the source of record:

- **Source of record**: Ghana Statistical Service, [2021 Population and Housing Census](https://census2021.statsghana.gov.gh/).
- **Exact table**: General Report Volume 3C (Background Characteristics), Table 5.7 "Population by Religious Affiliation, Sex and Region" — [Volume 3C PDF](https://census2021.statsghana.gov.gh/gssmain/fileUpload/reportthemelist/2021%20PHC%20General%20Report%20Vol%203C_Background%20Characteristics_181121.pdf).
- **Boundaries**: geoBoundaries GHA ADM1 (16 post-2019 regions), CC BY-SA 2.0, boundary source OpenStreetMap — [metadata/API](https://www.geoboundaries.org/api/current/gbOpen/GHA/ADM1/).
- **Licence**: GSS publishes the census report for open download on the census portal and requests attribution; no explicit reuse licence is stated. geoBoundaries gbOpen ADM1 is CC BY-SA 2.0 (boundary source OpenStreetMap contributors).
- **Our extraction script**: [`scripts/build_gh_area_summary.R`](../../../scripts/build_gh_area_summary.R) — parses Table 5.7 from the Volume 3C PDF with `pdftotext -layout`, derives the two headline metrics, joins to the geoBoundaries regions, and writes the `area_summary` products.
- **Retrieval recipe and hashes**: [`docs/manifests/gh-census-religion-2021.json`](../../../docs/manifests/gh-census-religion-2021.json) — URLs, retrieval steps, and SHA-256s for every object used.

## Boundaries

- Shipped: geoBoundaries GHA ADM1, 16 post-2019 regions, CC BY-SA 2.0, boundary source OpenStreetMap contributors (gbOpen, sourceDataUpdateDate 2023). The 16 ADM1 regions match the 2021 census reporting units exactly and join 16/16 by name (the boundary " Region" suffix dropped); ISO 3166-2 `shapeISO` codes (GH-WN, ...) are the area codes.
- Note: the survey card originally pinned geoBoundaries ADM2 districts (CC BY 4.0, USAID/GSS source) for a district build. Vol. 3C publishes religion at region level only, so the region product uses ADM1. The current gbOpen ADM1 release is OSM-sourced under CC BY-SA 2.0 — a different licence and source from the ADM2 districts; recorded honestly here and in the manifest. geoBoundaries GHA ADM2 (CC BY 4.0) remains the boundary route for a future district product.
- Boundary changes between waves and the harmonisation plan: anchor on the 2021/16-region geography; the pre-2019 ten-region waves (2000, 2010) need a ten-to-sixteen concordance before they can share these boundaries.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not counted during this source sweep; run ohsome or Overpass before build.
- Country-specific registers that could seed or verify the layer: Christian Council of Ghana, Ghana Pentecostal and Charismatic Council, Catholic dioceses, Ahmadiyya Muslim Mission Ghana, Ghana Museums and Monuments Board heritage lists.

## First visualisation

Built: census religious-affiliation percent and no-religion percent by region, 2021, on the 16 post-2019 region boundaries. Next: district (261) religion once the StatsBank PxWeb API is queryable, then the 2000/2010 waves via a region concordance.

## Build recipe

1. Extract: `scripts/build_gh_area_summary.R` parses Vol. 3C Table 5.7 (region religion) with `pdftotext -layout`; every number reconciles per region and nationally.
2. Governed product: `area_summary` per `schemas/area-summary.schema.json`, with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: geoBoundaries `GHA ADM1` (16 regions), joined by normalised region name.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md` — `apps/regions/gh/index.html`.
5. Verification: reconcile national totals, join coverage, licence and attribution strings.

## Risks and open questions

- District (261) religion sits behind the StatsBank PxWeb interactive table; its REST API was unstable during this build, so district detail is deferred.
- Region splits between 2000, 2010, and 2021 need a ten-to-sixteen concordance before earlier waves can share the 2021 boundaries.
- Some older district analytical reports may require PDF table extraction.

## Deep-history potential

Public Records and Archives Administration Department, Basel Mission archives, Wesleyan Methodist Missionary Society records, Catholic diocesan archives, Ghanaian newspapers, Larabanga Mosque heritage material, and Ghana Museums and Monuments Board files.
