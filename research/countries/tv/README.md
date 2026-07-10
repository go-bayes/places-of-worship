# Country data map: Tuvalu (TV)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: data extracted (two-region 2012 and 2017; staged, no page)
- **Last verified**: 2026-07-11

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [Tuvalu 2012 Census Volume 1 Analytical Report](https://www.fao.org/fileadmin/templates/ess/ess_test_folder/World_Census_Agriculture/Country_info_2010/Reports/Reports_6/TUV_ENG_REP_2012.pdf) (CSD; FAO mirror) | census affiliation | region (Funafuti / Outer Islands) | 2012 | PDF table | open download | CSD terms (partial research reuse with acknowledgement) |
| [Tuvalu 2017 Mini-Census Preliminary Report](https://finance.gov.tv/wp-content/uploads/2022/05/Mini-Census-2017-Preliminary-Report.pdf) (CSD) | census affiliation | region (Funafuti / Outer Islands) | 2017 | PDF table | open download | CSD terms |
| [Tuvalu 2022 Census Report](https://stats.gov.tv/download/85/population-and-housing-census/1836/tuvalu_2022_census_report.pdf) (SPC and CSD) | census affiliation | national only | 2022 | PDF (Figure 5 shares) | open download | SPC and CSD terms |

No official Tuvalu census publishes religion by island. The finest official religion geography is the two-region Funafuti / Outer Islands split, published for 2012 and 2017. The 2022 census publishes religion for the whole country only, so 2022 is national context, not a map layer. See `route-probe.md` for the full probe and the byte-matched publication terms.

## Build state (2026-07-11)

The staged product ships the 2012 and 2017 waves at two-region level: Funafuti versus Outer Islands, two headline metrics (religious affiliation percent, no religion percent) on the region resident-population denominator. The two regions reconcile exactly to the national census figures for every category, and the eleven-category column sums match the census resident population (2012: 10,640 = 5,436 + 5,204; 2017: 10,507 = 6,320 + 4,187). Boundaries are geoBoundaries TUV ADM1 (8 island units) dissolved to the two census regions.

- Extraction script: `scripts/build_tv_area_summary.R`
- Manifest: `docs/manifests/tv-census-religion-2012-2022.json`
- Products: `apps/regions/tv/data/area_summary_region.{json,csv}`, `apps/regions/tv/data/tv_region_2017.geojson`
- No country page and no hub entry ship in this lane.

Tuvalu is close to universally religiously affiliated (about 99.7 percent), so the two headline metrics differ little between the regions. The substantive subnational contrast is denominational, a lower Ekalesia Kelisiano Tuvalu share on Funafuti than on the Outer Islands, which the shared headline metric set does not carry. The product is governed data with exact provenance; the headline choropleth is near-flat by construction.

## Category mapping

- `religious_affiliation` = every named religion in the region table (Ekalesia Kelisiano Tuvalu, Seventh Day Adventist, Jehova's Witness, Bahai, Brethren, Assembly of God / Assemblies of God, Catholic, Latter Day Saint(s)) plus the report's `Other` category.
- `no_religion` = the census `None` category.
- `Refused` is non-response, retained in the resident-population denominator and outside both headline numerators (the Tonga precedent). The two shares therefore do not sum to 100 percent.

## Boundaries

- geoBoundaries TUV ADM1 (8 island units, Open Data Commons Open Database License 1.0, source OpenStreetMap and Wambacher), dissolved to two regions: Funafuti alone, and the other seven islands as Outer Islands. Niulakita, the ninth Tuvaluan island, has no separate ADM1 feature and is administered with Niutao; in the census it falls within the Outer Islands region, so the two-region product covers it. The source layer has eight valid features; the dissolved output has two valid features with two distinct geometry hashes.

## Access the data yourself

This project does not redistribute source data; the map shows derived rates with attribution. To obtain the data from the source of record:

- **Source of record**: Tuvalu Central Statistics Division, <https://stats.gov.tv/category/census-and-surveys/population-census/>.
- **Exact tables**: 2012 Volume 1 Analytical Report, "Population of individual religions by region of residence"; 2017 Mini-Census Preliminary Report, "Resident population by religious denominations and region of residence"; 2022 Census Report, Figure 5 (national context).
- **Licence**: CSD (and SPC for 2022) census reports authorise partial reproduction for scientific, educational, or research purposes with acknowledgement; commercial reproduction is reserved. Boundaries are geoBoundaries TUV ADM1 (ODbL 1.0).
- **Our extraction script**: `scripts/build_tv_area_summary.R`.
- **Retrieval recipe and hashes**: `docs/manifests/tv-census-religion-2012-2022.json`; per-file `.meta.json` sidecars in `data/raw/tv_census/`.

## CSD data request recommendation

To reach the queue's island geography with official authority, a CSD data request should ask for the **religion tabulation by island** for 2012, 2017, and 2022, with the full denomination breakdown and the None and Refused categories. The Pacific Data Hub microdata (2012 catalog 50; 2017 catalog 269) carries a record-level religion variable that could be tabulated by island, but that route is licensed microdata and would yield a project-produced table, not an official published one.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): public Overpass queries timed out; rerun before adding a place layer. No governed place layer or place metric ships yet; place-density metrics are hidden.
- Country registers to survey: Ekalesia Kelisiano Tuvalu (Congregational Christian Church of Tuvalu), Catholic Mission Sui Iuris of Funafuti, Seventh-day Adventist records, and Tuvalu National Archives.

## First visualisation

Staged: religious-affiliation percent and no-religion percent by region (Funafuti / Outer Islands) for 2012 and 2017, on geoBoundaries TUV ADM1 dissolved to two regions. Island-level and a mapped 2022 wave await the data-request routes above.

## Risks and open questions

- No official island-level religion table exists for any wave; the shipped geography is two-region, not island.
- The headline affiliation / no-religion metrics are near-uniform because Tuvalu is almost universally affiliated; the real subnational variation is denominational and not carried by the shared metric set.
- 2017 is a mini-census (a lighter instrument than the 2012 full census); a 2012-to-2017 change reading carries that caveat.
- 2022 religion is national only; a mappable 2022 wave depends on a CSD data request.

## Deep-history potential

Ekalesia Kelisiano Tuvalu, London Missionary Society, Catholic, and Seventh-day Adventist records can support historic site evidence. Tuvalu National Archives and island council records should be surveyed for pre-census material.
