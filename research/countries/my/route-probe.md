# Malaysia census-religion route probe

## Probe result

Malaysia has an official four-wave district route for reported religion. The Department of Statistics Malaysia (DOSM) MyCensus 2020 district-report series republishes 1991, 2000, 2010, and 2020 religion counts in Table 3 for each 2020 administrative district. DOSM states that the 1991–2010 district data were adjusted for new districts and boundary changes. Some newly created districts still show `..` for earlier waves, as the Bukit Mabong report demonstrates.

The route is PDF-based. OpenDOSM and data.gov.my do not currently publish a machine-readable religion dataset. A query of the official 285-row dataset catalogue on 10 July 2026 returned no dataset with religion in its catalogue record. The similarly named OpenDOSM dataset `population_district` contains sex, age, and ethnicity only.

## Waves by geography

| Census wave | National | State | Administrative district | Official route | Format | Category frame exposed by that route |
| --- | --- | --- | --- | --- | --- | --- |
| 1970 | Yes | Yes | No verified district religion cells in the current online series | DOSM 2020 district/state reports, Tables 1 and 2 | Text-bearing PDF | Six-category historical publication frame |
| 1980 | Yes | Yes | No verified district religion cells in the current online series | DOSM 2020 district/state reports, Tables 1 and 2 | Text-bearing PDF | Six-category historical publication frame |
| 1991 | Yes | Yes | Yes where Table 3 supplies a value | MyCensus 2020 district reports, Tables 1–3 | Text-bearing PDF | Six-category historical publication frame |
| 2000 | Yes | Yes | Yes where Table 3 supplies a value | MyCensus 2020 district reports, Tables 1–3; 2000 MyCensus flipbook for the detailed state frame | PDF; browser flipbook with page images and JavaScript search text | Six-category district trend; nine-category detailed state table |
| 2010 | Yes | Yes | Yes where Table 3 supplies a value | MyCensus 2020 district reports, Tables 1–3; 2010 MyCensus flipbook for the detailed state frame | PDF; browser flipbook with page images and JavaScript search text | Six-category district trend; eight-category detailed state table |
| 2020 | Yes | Yes | Yes | MyCensus 2020 district reports, historical Table 3 and detailed Table 7 | Text-bearing PDF | Six-category district trend; seven-category detailed district table |

The best change-over-time product is 1991–2020 at administrative-district level on the 2020 reporting frame. The selected four waves have no structured religion download: 0 of 4 are available as CSV, Parquet, XLSX, or API data. All four appear as text-extractable rows in the district PDFs, subject to district-specific historical missingness.

## Exact DOSM routes

| Purpose | Exact route | Verified finding |
| --- | --- | --- |
| Release hub | <https://www.dosm.gov.my/portal-main/release-content/key-findings-population-and-housing-census-of-malaysia-2020-administrative-district> | DOSM describes 160 administrative districts and confirms religion as a district-level topic |
| Johor Bahru district report | <https://www.dosm.gov.my/uploads/publications/20221018092514.pdf> | Table 3 publishes district religion for 1991, 2000, 2010, and 2020; 1970 and 1980 religion cells are unavailable |
| Melaka Tengah district report | <https://www.dosm.gov.my/uploads/publications/20221011101133.pdf> | Table 3 publishes district religion for 1991, 2000, 2010, and 2020 |
| Bukit Mabong district report | <https://www.dosm.gov.my/uploads/publications/20221018130805.pdf> | Table 3 has unavailable pre-2020 district cells; Table 7 publishes the detailed 2020 frame |
| Melaka state report | <https://www.dosm.gov.my/uploads/publications/20221013155927.pdf> | Tables 1 and 2 publish national and state religion for 1970–2020; Table 7 publishes detailed 2020 district counts for all Melaka districts |
| 2010 detailed report | <https://www.mycensus.gov.my/index.php/census-product/publication/census-2010/659-population-distribution-and-basic-demographic-characteristics-2010> | Religion is national and state level; district detail in this report is limited to ethnicity and excludes religion |
| 2000 detailed report | <https://www.mycensus.gov.my/index.php/census-product/publication/census-2000/650-population-distribution-and-basic-demographic-characteristics-2000> | Religion is national and state level |
| Official dataset catalogue | <https://data.gov.my/data-catalogue/datasets> | The catalogue exposes its rows through dataset id `datasets`; no religion dataset id was found |
| OpenDOSM district population | <https://open.dosm.gov.my/data-catalogue/population_district> | Dataset id `population_district`; religion is absent |
| OpenDOSM CSV | <https://storage.dosm.gov.my/population/population_district.csv> | Population by district, sex, age, and ethnicity; not a census-religion table |
| OpenDOSM Parquet | <https://storage.dosm.gov.my/population/population_district.parquet> | Same dimensions as the CSV |
| data.gov.my API | <https://api.data.gov.my/data-catalogue?id=population_district&limit=3> | API access to `population_district`; no religion field |

The current district-report collection does more than the 2000 and 2010 standalone report descriptions suggest. The standalone reports restrict detailed religion to state level. The 2020 district reports retrospectively publish the harmonised 1991–2020 district series.

## Category frames

### Historical comparison frame in the 2020 reports

Tables 1, 2, and 3 use the same six outputs for every displayed census year:

1. Islam
2. Christianity
3. Buddhism
4. Hinduism
5. Others
6. No Religion/Unknown

This six-category frame is DOSM's publication frame for comparison. It does not establish the original response list for every early census.

### Detailed source frames

| Wave | Verified detailed list | Frame break |
| --- | --- | --- |
| 1970 | The current official online route exposes only Islam, Christianity, Buddhism, Hinduism, Others, and No Religion/Unknown in the retrospective table | The original detailed response list was not recovered from an online DOSM census volume |
| 1980 | The current official online route exposes only the same six-category retrospective frame | The original detailed response list was not recovered from an online DOSM census volume |
| 1991 | The current official online route exposes only the same six-category retrospective frame | The original detailed response list was not recovered from an online DOSM census volume |
| 2000 | Islam; Christianity; Buddhism; Hinduism; Confucianism/Taoism/other traditional Chinese religion; Tribal/folk religion; Others; No religion; Unknown | Tribal/folk religion is separate |
| 2010 | Islam; Christianity; Buddhism; Hinduism; Confucianism, Taoism and tribal/folk/other traditional Chinese religion; Other religion; No religion; Unknown | The Chinese-traditional and tribal/folk categories are combined |
| 2020 | Islam; Christianity; Buddhism; Hinduism; Others; No Religion; Unknown | `Others` includes Sikhism, Taoism, Confucianism, Bahai, tribal/folk/other traditional Chinese religion, animism, and other responses |

Two further collapses affect the trend. The retrospective tables combine No Religion with Unknown. They also place the changing residual categories under Others. A trend map can faithfully reproduce DOSM's six published outputs, but it cannot interpret the internal composition of Others as constant.

## Boundary routes

DOSM's district reports define the comparison geography. Their technical notes say that district data released for 1991, 2000, and 2010 were adjusted for newly created districts and boundary changes. Appendix 1 identifies new 2020 districts, and Appendix 5 maps the 2020 state and district boundaries. The reports therefore support a 2020-boundary trend without a separate vintage polygon for each census.

| Route | Coverage and format | Licence or access finding | Use in a build |
| --- | --- | --- | --- |
| [DOSM district-report Appendix 5](https://www.dosm.gov.my/uploads/publications/20221018092514.pdf) | Official 2020 state and district map inside each PDF | The publication-specific restriction applies | Source of record for the reporting frame and boundary-change notes; it is not a reusable vector layer |
| [MyGeoName `Sempadan Pentadbiran Daerah` layer 7](https://mygos.mygeoportal.gov.my/gisserver/rest/services/MyGeoname/MyGeoName_BaseMap/MapServer/7) | ArcGIS polygon service; JSON, GeoJSON, and PBF; 94 features; the source field identifies Jabatan Ukur dan Pemetaan Malaysia (JUPEM; Department of Survey and Mapping Malaysia); update field `OGOS 2019` | [MyGeoportal's FAQ](https://www.mygeoportal.gov.my/ms/faq?field_categories2_target_id=31) says spatial data require a formal request; its [copyright notice](https://www.mygeoportal.gov.my/ms/notis-hak-cipta) restricts commercial reproduction without written permission | Incomplete for the 160-unit Malaysia frame and not openly licensed |
| [Sabah Land and Surveys price list](https://jtu.sabah.gov.my/Setup/Data/form/Product%20%26%20Service%20Price.pdf) | Official district maps, PDF, RM40 per district | No open reuse licence stated in the price list | Official visual reference or purchase/request route |
| [Sarawak eLASIS cartographic maps](https://elasis.sarawak.gov.my/page-0-32-18-Cartographic-Map.html) | Official paid PDFs at 1:750,000 and 1:500,000 with district and sub-district boundaries | No open reuse licence stated on the product page | Official visual reference or purchase/request route |
| [geoBoundaries MYS ADM2](https://www.geoboundaries.org/api/current/gbOpen/MYS/ADM2/) | Non-official GeoJSON/TopoJSON/ZIP; 160 districts; year represented 2020 | Creative Commons Attribution 3.0 | Open geometry fallback after reconciliation against the DOSM district list |

No verified official, openly licensed vector route covers all 160 MyCensus 2020 reporting units. The geoBoundaries fallback matches the required unit count and claimed year, but its geometry source is not a Malaysian authority.

## Licence findings

The licence depends on the object.

- OpenDOSM explicitly assigns Creative Commons Attribution 4.0 to `population_district`. That licence does not transfer to the religion tables because the dataset contains no religion field.
- The [general DOSM terms](https://www.dosm.gov.my/portal-main/article/term-of-use) invoke Government Open Data Terms of Use 1.0 and authorise copying, adaptation, redistribution, and commercial or non-commercial use with attribution and other conditions.
- Each sampled MyCensus 2020 district PDF prints a narrower statement: all rights reserved; no reproduction, distribution, or database storage without prior written DOSM permission; attribution is required when content is reproduced with or without adaptation.
- The publication-specific statement conflicts with the general portal terms. This probe does not assume that the general terms override the PDF. Written DOSM confirmation is required before a public extraction.
- The MyCensus 2000 and 2010 pages display an all-rights-reserved footer and no specific open-data licence.
- The official MyGeoportal and state-map routes do not provide an open vector licence for the required national boundary layer.

## East and West Malaysia comparability

The sampled DOSM district reports do not flag a religion-coverage exclusion for Sabah or Sarawak. The [DOSM district report's geographical-divisions note](https://www.dosm.gov.my/uploads/publications/20221018092514.pdf#page=150) documents the administrative structures used here. Sabah has no mukim level, and some Sarawak administrative districts divide into sub-districts. Kelantan uses `jajahan` for the administrative-district level. `W.P.` means `Wilayah Persekutuan` (federal territory); Labuan and Putrajaya have no mukim or other administrative subdivision. The administrative district or equivalent remains the common comparison unit in the DOSM reports.

The category frame also warrants regional caution. The 2020 `Others` category includes animism and tribal or folk religions alongside Sikhism, Taoism, Confucianism, Bahai, and other responses. Earlier detailed frames separated or combined these components differently. The source does not identify an East–West coverage break, and a build should not infer one. It should show the published counts and mark the category break.

## Verdict

**BLOCKED — the best technical wave set is 1991, 2000, 2010, and 2020 at 2020 administrative-district geography; none of the four religion waves has a structured machine-readable route. A public build requires written DOSM confirmation of reuse and database-storage permission. It also requires an official national vector release or project-lead acceptance, recorded in this file, of the Creative Commons Attribution 3.0 geoBoundaries fallback.**
