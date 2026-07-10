# Saint Vincent and the Grenadines census-religion route probe

Probed 2026-07-10. The queue routed this as a pointer-only lane: pin the joint extract of the Statistical Office's four-wave religion table and its census-division map. The joint extract does not exist. The four-wave table publishes religion nationally, not by census division, and the only religion-by-census-division tables in the official record are percentage-only figures embedded as raster images in the 2012 census report. No area-summary product can ship, and no build script was written, because a division series cannot be reconciled from percentage image cells without optical character recognition (forbidden in this lane) and because no licensed vector geometry exists at the 13-division frame the data would need.

The census-affiliation construct is licensed and the national four-wave count series is rich, but a subnational map is what this project builds and the subnational religion layer is not published in a usable form. This is a fail-fast hold on the CI/LC pattern.

## What the pointer sources actually publish

| Source | Geography | Waves | Construct and format | Build role |
| --- | --- | --- | --- | --- |
| [Population by Religious Denomination and Sex, 1980 to 2012](https://stats.gov.vc/subjects/population-and-demography/population-by-religious-denomination-and-sex-1980-to-2012/) | National only | 1980, 1991, 2001, 2012 | Denomination by sex; counts and percentages in an HTML table | Blocked for a subnational map: national geography carries no census-division breakdown |
| [Map of Saint Vincent and the Grenadines by Census Division](https://stats.gov.vc/data/maps/) | 13 census divisions | current | Per-division raster PDF maps (1–16 MB each); no vector file | Blocked as a joining geometry: raster only, no shapefile, GeoJSON, or KML |
| [Population and Housing Census Report 2012](https://stats.gov.vc/wp-content/uploads/2018/11/Population-and-Housing-Census-Report-2012.pdf), Tables 2.12 and 2.13 | 13 census divisions | 2012, 2001 | Christian denomination by census division; **percentages only**, embedded as **JPEG images** with no text layer | Blocked: percentage cells cannot reconcile to counts, and the tables require optical character recognition to read at all |

The pointer premise fails at the table. The audit expected the four-wave denomination table to break down by census division; it breaks down by sex only. The census-division map exists as a named 13-part frame, but the Statistical Office ships it as per-division raster PDFs, not as vector boundaries.

## The four-wave national table (verbatim)

The HTML table at the religion-table URL publishes two stacked blocks, "Population by Religious Denomination and Sex (Count)" and "Population by Religious Denomination and Sex (%)", each with 1980, 1991, 2001, and 2012 columns split Male / Female / Total. Its source line reads "Source: 1980, 1991, 2001 and 2012 Population and Housing Census". Its missing-value legend reads ".. Data Not Available for the specific reference period". The geography is national throughout; no census-division column appears.

The 14 category rows, in source order, are: Anglican; Evangelical; Methodist; Pentecostal; Presbyterian/Congregational; Roman Catholic; Salvation Army; Seventh Day Adventist; Jehovah's Witnesses; Baptist (Spiritual); Rastafarian; Other Religious Denomination; None/No Religion; Not Stated. Evangelical is ".." for 1980 and 1991; Rastafarian is ".." for 1980. The printed national totals are 97,845 (1980), 106,499 (1991), 107,835 (2001), and 109,188 (2012). The count block reconciles to these printed totals internally. It is national and therefore cannot populate a division choropleth.

## The census-division religion tables (image-only, percentage-only)

The full 2012 census report is the only located source that crosses religion with census division. It carries three candidate tables, and each fails the route for a distinct reason.

The first candidate is Table 2.12, "Percentage Distribution of Population by Census Division and Christian Denominations, 2012" (printed page 37, PDF page 48). Its cells are a single JPEG image object (1346×644 rgb, `pdfimages -list`), with no text layer; `pdftotext -layout` returns only the title and page number. Its values are percentages, not counts.

The second candidate is Table 2.13, "Percentage Distribution of Population by Census Division and Christian Denominations, 2001" (printed page 38, PDF page 49). It is likewise a single JPEG image object (1391×493 rgb), text-empty, percentage-valued.

The third candidate is Table 2.15, "Percentage Distribution of Population by Census Division and Religious Denomination, 2001" as both the report's contents page and the table's own body-page heading name it (printed page 41; body on PDF page 52). The printed table body is not a census-division table: its columns are the broad age groups 0–14, 15–29, 30–44, 45–64, and 65+. The contents-page title is a misprint; Table 2.15 is religion by broad age group, not by census division. It does not add a division series.

No census-division religion table appears for 1980 or 1991 in any located source. The four-wave national table is the only 1980 and 1991 religion source, and it is national.

Per this lane's hard rule, the JPEG cells of Tables 2.12 and 2.13 were **not** read by image or optical character recognition. Their percentage, image-only character is established from the PDF object listing and the empty text layer, which is sufficient to fail the gate: a percentage table cannot reconcile exactly to the national counts, and recovering division counts by multiplying a division population (report Table 1.2) by a one-decimal percentage would introduce rounding the project does not repair.

## Geography

Saint Vincent and the Grenadines is divided into 13 census divisions. The maps page names them: Kingstown; Suburbs of Kingstown; Calliaqua; Marriaqua; Bridgetown; Colonarie; Georgetown; Sandy Bay; Layou; Barrouallie; Chateaubelair; Northern Grenadines; and Southern Grenadines. The page states "Census Division (CD) is the largest geographic areas into which St. Vincent and the Grenadines is divided for the purpose of the census administration" and gives a metes-and-bounds description for each division. Kingstown and its Suburbs are two separate divisions; the Grenadines split into Northern and Southern. The divisions are published only as per-division raster PDF downloads.

The 13-division census frame does not correspond to any published vector layer. The Statistical Office does not publish census-division vector boundaries. geoBoundaries publishes only the six-parish ADM1 frame (below), which is a different partition at a coarser grain.

## Boundary source and release metadata

The candidate vector boundary is [geoBoundaries Saint Vincent and the Grenadines administrative level 1 (ADM1)](https://www.geoboundaries.org/api/current/gbOpen/VCT/ADM1/). The cached release metadata records boundary ID `VCT-ADM1-94954027`; type `ADM1`; represented year `2017`; licence `Open Data Commons Open Database License 1.0`; and the pinned [GeoJSON](https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/VCT/ADM1/geoBoundaries-VCT-ADM1.geojson).

The source geometry has six features, and they are the parishes, not the census divisions: Charlotte; Saint Andrew; Saint David; Saint George; Saint Patrick; and Grenadines. geoBoundaries publishes no ADM2 for VCT (the ADM2 API returns HTTP 404). The six-parish frame cannot carry a 13-division religion series, and the census report does not publish religion by parish. No licensed vector geometry at the census-division grain was located from any source.

## Denominators and non-response

The four-wave national count table's Total row is the enumerated religion base per wave: 97,845 (1980); 106,499 (1991); 107,835 (2001); 109,188 (2012). Each Total includes a Not Stated row (976 in 1980; 1,367 in 1991; 1,660 in 2001; 5,096 in 2012) and a None/No Religion row (1,578; 4,843; 9,504; 8,147). A stated-response denominator would subtract Not Stated; a no-religion numerator is the None/No Religion row. These rules were read from the national table and would apply to a national surface only; no division denominators were established, because the division cells are image-only percentages.

## Publication terms

The Statistical Office's data are licensed. The cached terms page states, under "Terms of Use of Data": "Access and use of the Data is subject to the requirements set forth under the Open Licence Agreement ." The cached Open Licence Agreement grants "a worldwide, royalty-free non-exclusive licence to freely use the data, copy, modify, translate, publish, adapt, distribute, create derivative works and value-added products for commercial and non-commercial purposes subject to the terms of this licence."

The agreement requires this notice for value-added products: "This product was adapted from the Statistical Office of St. Vincent and the Grenadines’ information, which is licenced under the Statistical Office’s Open Licence Agreement." It requires this source acknowledgement for the data: "Source: Statistical Office of St. Vincent and the Grenadines. Contains information licenced under the Statistical Office’s Open Licence Agreement." It limits the grant to Statistical Office data and excludes third-party material. The census tables are therefore buildable under the Open Licence Agreement, subject to that notice. The site's general footer separately reads "Copyright &copy; 2026 Statistical Office, Government of Saint Vincent and the Grenadines. All rights reserved." (encoded with the `&copy;` entity), which is the website copyright and does not override the data terms.

The licence position passes for the census data. The gate blocks on geography and format, not on rights: the division-level religion is percentage-only image data, and no licensed vector geometry exists at the division grain.

## Retrieval record

All inputs were retrieved on 2026-07-10. `git check-ignore -v` confirms that `.gitignore` line 120 ignores `data/`, including every file under `data/raw/vc_census/`.

| Cached input | Source or role | SHA-256 |
| --- | --- | --- |
| `religion_table_1980_2012.html` | Four-wave national religion table (counts and percentages) | `d3b416fe5c3eb2a033dfe64d01773a1a9d8116d8ff647bf92bbba99558e74c92` |
| `maps_page.html` | Census-division map inventory (13 divisions, raster PDFs) | `b0a4d0877992741e104db40376798b739b84d347c4c15045d745e96abc85f3ed` |
| `census_report_2012_full.pdf` | 2012 Population and Housing Census Report (213 pp.; Tables 2.12, 2.13, 2.15) | `58613efc6ec2094cee63de503aadd6bf0d0e3fee96c05243efd7f58dc5abbbb7` |
| `census_preliminary_2012.pdf` | 2012 Preliminary Report (55 pp.) | `a1ccb44608d11c694a1c739bd759e919285e9409c246b9ebdfa10b9ac2cacb57` |
| `terms_and_conditions.html` | Statistical Office terms, deferring data use to the Open Licence Agreement | `3f35ccbb4d564598fd3f250eb1bf27c5d9723519bbae8c00c6ad3cf44aaec167` |
| `open_licence_agreement.html` | Statistical Office Open Licence Agreement | `b30c44768af362dc4dc826380f15cb34ea36200da29685c7be0a1dc401dea101` |
| `gb_vct_adm1_meta.json` | geoBoundaries VCT ADM1 release metadata (six parishes, ODbL 1.0) | `a9452ee5300d542aa245322f182153dadae82dd8c15210ae35f5a5c59644a03c` |
| `geoBoundaries-VCT-ADM1.geojson` | Pinned geoBoundaries source geometry (six parish features) | `eea0b11a7a6ab3c1c5f41e2b1e7cf775a69b11916d2c025e959e33786ed70064` |

REDATAM was checked: `prod.redatam.org` returned only the CEPAL-CELADE portal shell, and no Saint Vincent and the Grenadines base was located from the entry point within the time box. Absence of a located REDATAM base is not proof one does not exist; it was not found from the portal root.

## Hard-gate result

- **Pointer premise (religion by division in the four-wave table)**: failed. The four-wave table is national only; it breaks down by sex, not by census division.
- **Official route for a division series**: partial and blocked. Division-level religion appears only in the 2012 report's Tables 2.12 (2012) and 2.13 (2001), as percentage figures embedded in JPEG images with no text layer, and only for two of the four waves.
- **Table 2.15 as a division source**: rejected. Its contents-page title is a misprint; the table body is religion by broad age group, not by census division.
- **1980 and 1991 division religion**: not published in any located source.
- **Optical character recognition of the image tables**: not performed, per this lane's hard rule. The percentage, image-only character is established from the PDF object listing.
- **Exact reconciliation**: not reachable. Percentage cells cannot reconcile to the national counts, and no legitimate division-count table exists to test.
- **Boundary geometry at the division grain**: failed. The Statistical Office publishes census-division maps only as raster PDFs. geoBoundaries publishes a six-parish ADM1 frame and no ADM2; the parish frame is a different partition and carries no matching religion data.
- **Data licence**: passed from captured bytes under the Statistical Office Open Licence Agreement, with the required value-added-product notice.
- **Boundary licence**: the geoBoundaries VCT ADM1 parish frame is ODbL 1.0, but the frame does not match the census-division data and is not used.
- **Product writing**: stopped. No JSON, CSV, GeoJSON, manifest, or country page was written. No build script was written, because there is no text-layer division table to reconcile and no division geometry to join; this differs from the Saint Lucia and Côte d'Ivoire holds, where a machine-readable table existed to run through a fail-fast reconciliation script.

A machine-readable, count-valued religion-by-census-division table (or an official release that recovers division counts) and a licensed census-division vector boundary are both required before this lane can proceed. Either alone is insufficient.
