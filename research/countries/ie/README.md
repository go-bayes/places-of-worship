# Country data map: Ireland (IE)

## Status

- **Tier**: A (buildable now)
- **Build state**: map built for the CSO PxStat `F5051` county-and-city
  series, 2011-2022; 1861-1926 Table 09 extension deferred
- **Last verified**: 2026-07-07; verification URLs:
  <https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/F5051/CSV/1.0/en>
  and
  <https://www.cso.ie/en/census/censusvolumes1926to1991/historicalreports/census1926reports/census1926volume3-religionandbirthplaces/>

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| Central Statistics Office (CSO), PxStat table `F5051`, population usually resident and present in the State by religion, sex, census year, and county and city | census religious affiliation | county and city | 2011, 2016, 2022 | CSV API | open | CSO copyright and re-use policy; attribute CSO |
| CSO, Census 2022 Profile 5 interactive census map | census religious affiliation | Small Area for 2022 exploration | 2022 | web app and table export route | open | CSO copyright and re-use policy; attribute CSO |
| CSO, Census 1926 Volume 3, Table 09, counties 1861-1926 | census religious affiliation | county and county borough | 1861, 1871, 1881, 1891, 1901, 1911, 1926 | image-only PDF table | open | CSO copyright and re-use policy; attribute CSO |

## Boundaries

- Official boundary files: Tailte Eireann and CSO national statistical
  boundaries for counties, cities, and Small Areas; use official 2022
  statistical boundaries where possible.
- Anchor the first build on county and city geography because `F5051` and the
  1861-1926 county table share that level. Small Area output can follow as a
  2022-only detail layer.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not yet run for this survey card.
- Country-specific registers: National Inventory of Architectural Heritage,
  Historic Environment Viewer, National Library parish registers, Catholic
  Parish Registers at the National Library of Ireland, Representative Church
  Body Library, Methodist Historical Society, Presbyterian Historical Society
  of Ireland, local authority heritage records, Irish Newspaper Archives.

## First visualisation

Religious-affiliation percent by county and city, censuses 1861-2022,
with the modern `F5051` series built first and CSO 1926 Volume 3 Table 09
queued as the deep-past extension after OCR and table QA.

## Built map

- App route: `apps/regions/ie/index.html`.
- Data products: `apps/regions/ie/data/county_city_2019.geojson`,
  `apps/regions/ie/data/area_summary_county_city.json`, and
  `apps/regions/ie/data/area_summary_county_city.csv`.
- Build script: `scripts/build_ie_area_summary.R`.
- Manifest: `docs/manifests/ie-census-religion-2011-2022.json`.
- Built waves: 2011, 2016, and 2022; 30 county-and-city reporting units.
- Denominator: people usually resident and present in the State with a
  stated religion response (`All religions - Not stated`).
- Boundary basis: Tailte Éireann 2019 administrative areas. Cork City
  Council and Cork County Council are dissolved because `F5051` publishes
  Cork City and Cork County as one reporting unit.

## Build recipe

1. Done: extract CSO PxStat table `F5051` CSV API for 2011, 2016,
   and 2022.
2. Done: build governed `area_summary` products with a tracked manifest.
3. Done: derive the county-and-city boundary from Tailte Éireann 2019
   administrative areas, with a Cork dissolve to match `F5051`.
4. Done: add the region page with on-page CSO and Tailte Éireann
   attribution.
5. Done: verify exact county-and-city sums against the CSO State row and
   join coverage of 30/30 for each wave.
6. Next: extract CSO 1926 Volume 3 Table 09 for 1861-1926. The raw PDF at
   `data/raw/ie_census/cso_census_1926_volume3_table09_counties_1861_1926.pdf`
   is image-only (`pdftotext` returns only form feeds). The 1861-1926
   extension needs OCR, manual table QA, and a county/county-borough
   concordance before map publication.

## Risks and open questions

- The Table 09 title frames the 1861-1926 county series as Saorstát Éireann.
  Before publication, verify whether retrospective 1861-1911 rows cover the
  26-county state area rather than all Ireland.
- County-borough and city definitions need an explicit concordance before a
  single long-run geometry is published.
- Religion categories change over time; the first map should use broad,
  well-documented categories and keep raw source labels.
- The live 2011-2022 boundary uses a 2019 administrative-area layer rather
  than a historical boundary series. Cork is an explicit derived dissolve to
  match the CSO table.

## Deep-history potential

CSO historical census volumes provide the deepest area-level religion series:
county religion counts from 1861 to 1926. Table 09 is the pinned next route,
but it is an image-only PDF and should follow the US deep-past pattern:
separate era boundary levels where geographies materially differ,
`wave_coverage_differs` flags where coverage changes, and labels that state
the Saorstát Éireann or 26-county basis plainly. Site-level reconstruction
can draw on National Library parish registers, Church of Ireland parish
records, Presbyterian and Methodist archives, Ordnance Survey maps,
Griffith's Valuation, newspapers, diocesan directories, local histories, and
county heritage inventories.
