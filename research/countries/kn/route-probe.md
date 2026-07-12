# Saint Kitts and Nevis census-religion route probe

Verified 2026-07-12. Verdict: **HELD**. The Department of Statistics, St Kitts and Nevis (DOS-SKN, `stats.gov.kn`) collects religion in the census but publishes it at the **national level only**, never by parish and never by island. Every route confirms the same ceiling. The national office's public data-tables carry exactly one religion table — "Population by Religious Belief, 2011" — a national count table by sex (total 47,195), while every parish-dimensioned table published for 2011 covers a different variable (sex, age group, ethnicity, households, dwelling characteristics). The 2001 national census report (CARICOM-hosted "St Kitts and Nevis National Census Report - 2000 Round") prints religion as Table 2.3 "Total and Percentage Distribution of Population by Sex and Religion: 1991 and 2001" — national, by sex, for two waves, with no parish or island cross-tab. The CARICOM regional secondary route gives no more: the 2000-round Volume of Basic Tables prints Table 4 "Total Population by Five Year Age Group, Sex and Religion" per country (national, by age and sex), with no subnational split. The 2021-2022 census summary report (the current wave) carries no religion table at all; DOS-SKN states that thematic reports will follow. The queue premise ("2001-2011 span | island and parish | census or official household-survey affiliation | browser work | probe then build") is refuted on geography: religion is published for the whole federation only, at no subnational level, for any wave. The boundary route is clean and idle: geoBoundaries KNA ADM1 records a stated Creative Commons Attribution-ShareAlike 2.0 licence over the 14 parishes (nine on St Kitts, five on Nevis). The licence is favourable but moot: DOS-SKN publishes an explicit Open Licence Agreement granting free reuse with an acknowledgement-of-source notice, the Barbados/Guyana Caribbean template. A subnational religion table — if one existed — would therefore ship accepted with attribution.

## Build decision (recommendation to the conductor)

- **Recommendation**: **HOLD. Do not build.** No published table crosses religion with parish or island for any census wave (1991, 2001, 2011, 2021-2022). A parish or island religion product cannot be built without inventing a distribution the office never published; deriving parish shares from a national total would allocate figures against the hard gate. The build gate (at least one wave of counts at the target geography) is not met at parish or island level.
- **What is published (national religion, for the record, not a subnational product)**:
  - **2011**: DOS-SKN data-table "Population by Religious Belief, 2011" — national count table by sex, 21 category lines (including None and Not stated), total 47,195.
  - **2001 and 1991**: 2001 national census report Table 2.3 — national religion by sex, for 1991 and 2001, total 46,325 in 2001.
  - **2000 round (regional)**: CARICOM Volume of Basic Tables Table 4 — national religion by five-year age group and sex, per country.
- **Named unblock (the clean path to a product)**: a DOS-SKN data request for the 2011 (and, secondarily, 2001) religion-by-parish or religion-by-island cross-tab. The census collected religion at the person level — the 2011 household questionnaire (UN Statistics Division mirror `KNA2011enHh.pdf`) carries a religion item — so the microdata support a subnational tabulation that the office chose not to publish. This is the Barbados-2021 shape: religion collected, not tabulated below the national level. Recorded as a courtesy ask for the PI; not sent. A human-verification challenge was not encountered and none was completed.
- **Rights position (favourable, moot under the hold)**: ACCEPTED in principle. The DOS-SKN Open Licence Agreement grants free reuse; a derived subnational table would ship with the required acknowledgement-of-source notice. The boundary is geoBoundaries KNA ADM1, 14 parishes, CC BY-SA 2.0 (OpenStreetMap).

## Published waves and geography

| Year | Official route | Religion table | Geographic level | Universe | Decision |
| --- | --- | --- | --- | --- | --- |
| 2011 | [DOS-SKN data-table](https://www.stats.gov.kn/topics/demographic-social-statistics/population/population-by-religious-belief-2011/) "Population by Religious Belief, 2011" | national count by sex, 21 lines | **national only** | tabulated population 47,195 | No parish or island split. National only. |
| 2001 / 1991 | [SKN National Census Report - 2000 Round](https://statistics.caricom.org/wp-content/uploads/2026/01/Kitts.pdf) (PDF), Table 2.3 | national by sex, 1991 and 2001 | **national only** | 2001 population 46,325 | No parish or island split. National only. |
| 2000 round | [CARICOM Volume of Basic Tables](https://statistics.caricom.org/wp-content/uploads/2026/01/VBT.pdf) (PDF), Table 4 | national by age group and sex, per country | **national only** | per-country totals | Regional secondary route; national only. |
| 2021-2022 | [SKN Census Summary Report 2021-2022](https://statistics.caricom.org/wp-content/uploads/2025/11/SKN-Census-Report-2021-2022.pdf) (PDF) | none — no religion table | — | federal 51,320; St Kitts 38,138, Nevis 13,182 | REFUTED for religion; summary report only, thematic reports pending. |

The DOS-SKN data-tables index lists roughly two dozen parish-level 2011 tables — "Population by Sex and Parish, 2001 and 2011", "Population by Parish and Age Group, 2011", "Number of Households and Population by Parish and Island 2001 to 2011", and the full housing-stock set by parish — and exactly one religion table, national. No table in the index crosses religion with parish or island. The parish geography is published richly for every census variable except religion.

## National religion frame (2011 data-table, preserved verbatim; recorded, not a subnational product)

The 2011 "Population by Religious Belief" table prints these lines (Male, Female, Total), in source order: Anglican (7,842), Baptist (2,564), Bahai (33), Brethren (801), Church of God (3,495), Evangelical (975), Hindu (860), Jehovah Witness (661), Methodist (7,447), Moravian (2,265), Muslim (244), Pentecostal (5,081), Presbyterian (159), Rastafarian (608), Roman Catholic (2,801), Salvation Army (55), Seventh Day Adventist (2,554), Wesleyan Holiness (2,506), None (4,141), Other (2,047), Not stated (56); Total 47,195. The 2001 Table 2.3 frame is a near-identical list (without Wesleyan Holiness as a separate line), total 46,325, None 2,393, Not Stated 1,486. These national frames are recorded for provenance and cross-wave context; because no subnational religion table exists, no build carries them and no parish or island allocation is attempted.

## Universe note

The 2011 religion table total (47,195) exceeds the widely cited 2011 de jure census population (46,398) and the 2021-2022 report's stated 2011 federal figure; the discrepancy is a universe difference (the religion tabulation base against the resident-population base) and is recorded, not resolved, because no subnational product depends on it. The 2001 religion total (46,325) matches the 2001 census population reported in the same national report.

## Boundary source and licence (clean, idle)

The boundary is [geoBoundaries KNA ADM1](https://www.geoboundaries.org/api/current/gbOpen/KNA/ADM1/). The release metadata records `"admUnitCount": "14"`, `"boundaryType": "ADM1"`, `"boundaryYearRepresented": "2021"`, `"boundarySource": "OpenStreetMap"`, and — the load-bearing field, quoted verbatim — `"boundaryLicense": "Creative Commons Attribution-ShareAlike 2.0"`, `"licenseSource": "www.openstreetmap.org/copyright"`. The 14 `shapeName` values are the 14 census parishes: nine on St Kitts (Christ Church Nichola Town, Saint Anne Sandy Point, Saint George Basseterre, Saint John Capisterre, Saint Mary Cayon, Saint Paul Capisterre, Saint Peter Basseterre, Saint Thomas Middle Island, Trinity Palmetto Point) and five on Nevis (Saint George Gingerland, Saint James Windward, Saint John Figtree, Saint Paul Charlestown, Saint Thomas Lowland). ADM1 is the parish; the two-island grouping is a dissolve of these 14 parishes. The boundary licence is non-null and share-alike (the OpenStreetMap ODbL/CC-BY-SA precedent). No boundary work is warranted under the hold; the metadata and GeoJSON are cached for the record.

## Licence position (accepted in principle; moot under the hold)

The DOS-SKN data ship under an explicit Open Licence Agreement, the Caribbean open-reuse template also used by Barbados (BSS) and Guyana (BoS). The load-bearing text, fetched and quoted verbatim:

- **DOS-SKN Open Licence Agreement** (`stats.gov.kn/terms-and-conditions/open-license-agreement/`, retrieved 2026-07-12), Licence grant: "The Department of Statistics, St Kitts and Nevis grants you (an individual or a legal entity that you are authorized to represent) a worldwide, royalty-free non-exclusive licence to freely use the data, copy, modify, translate, publish, adapt, distribute, create derivative works and value-added products for commercial and non-commercial purposes subject to the terms of this licence."
- **Acknowledgement of source** (same page): "Source: Department of Statistics, St Kitts and Nevis. Contains information licenced under the Department of Statistics, St Kitts and Nevis's Open Licence Agreement." (The value-added-product notice on the page is truncated in the rendered HTML at "This product was adapted from the"; the general notice above is captured in full.)
- **DOS-SKN Terms and Conditions** (`stats.gov.kn/terms-and-conditions/`, retrieved 2026-07-12), Terms of Use of Data: "Access and use of the data is subject to the requirements set forth under the Open Licence Agreement." The same page asserts general copyright over the website Contents; the data-use clause routes explicitly to the Open Licence Agreement.
- **DOS-SKN website footer** (retrieved 2026-07-12): "Copyright © 2026 Department of Statistics, Ministry of Sustainable Development." — a site-content copyright notice, superseded for data by the Open Licence Agreement.

Under a hold, the licence carries no product. Were a subnational religion table obtained from DOS-SKN, `licence_status: accepted`, `licence_basis: dos_skn_open_licence_agreement`, boundary CC BY-SA 2.0.

## Premise corrections (trust the record)

- **Religion is national only, not island or parish, for every wave.** The queue premise names "island and parish" geography. DOS-SKN publishes religion for the whole federation only. The 2011 data-table is national by sex; the 2001 report Table 2.3 is national by sex; the CARICOM Volume of Basic Tables Table 4 is national by age and sex. No published table crosses religion with parish or with island (St Kitts vs Nevis). The parish geography is published for every other 2011 variable.
- **The current 2021-2022 wave publishes no religion at all yet.** The summary report covers population, sex, and dwellings by parish and island; DOS-SKN states thematic reports will follow. No religion table is in the summary.
- **The route is a direct download, not blocked browser work.** The 2011 national religion table is a plain HTML data-table on `stats.gov.kn`; the 2001 national report and the CARICOM Volume of Basic Tables are direct PDF downloads from `statistics.caricom.org`. No human-verification challenge was encountered.
- **The licence is an open reuse grant, not all-rights-reserved.** DOS-SKN publishes the same Open Licence Agreement as BSS and BoS; the Terms route data use to it. Accepted in principle, moot under the hold.

## Retrieval record

Every cached input is under `data/raw/kn_census/`, which `git check-ignore -v` confirms is excluded by `.gitignore:120` (the `data/` rule). Retrieval occurred on 2026-07-12; content type verified on every download. The DOS-SKN and CARICOM sites serve cleanly to `curl` with a browser user-agent.

| Cached input | Source URL | Format | SHA-256 |
| --- | --- | --- | --- |
| `religion_belief_2011.html` | <https://www.stats.gov.kn/topics/demographic-social-statistics/population/population-by-religious-belief-2011/> | html | `97cc4bba0bf8a96a1edf20fcdd8602745264a2af909e726ab033e40fba62ee3c` |
| `stats_data_tables.html` | <https://www.stats.gov.kn/data/data-tables/> | html | `6595e526638a67c1189346b02dd2a6cab6de192726fe61e3ac90a0a5367a9561` |
| `SKN_National_Census_Report_2000round.pdf` | <https://statistics.caricom.org/wp-content/uploads/2026/01/Kitts.pdf> | pdf | `4209a0853b8d2fa21b0b9d5976344193c72d65a77a8dd72054f8e4f9d8b9a214` |
| `CARICOM_2000round_VBT.pdf` | <https://statistics.caricom.org/wp-content/uploads/2026/01/VBT.pdf> | pdf | `79a762c8d020c463f6cc8ed5119e8afa3a4715e196e068bf2f30b1627b37a7aa` |
| `SKN_Census_Report_2021-2022.pdf` | <https://statistics.caricom.org/wp-content/uploads/2025/11/SKN-Census-Report-2021-2022.pdf> | pdf | `1af230ddb524cedda6ead3bfd3835454754bbcc82e31be65e0dd30fbe2c86010` |
| `stats_terms.html` | <https://www.stats.gov.kn/terms-and-conditions/> | html | `7ad7928592d0aab9fc0917f7b768df1f43da6cef68044c26527c26c0f47cb4fd` |
| `stats_open_licence.html` | <https://www.stats.gov.kn/terms-and-conditions/open-license-agreement/> | html | `d1376692da8d9c7f6c7029229e8975ba016eb3ffac032281fa4133f4c40ddd29` |
| `caricom_country_skn.html` | <https://statistics.caricom.org/country/saint-kitts-and-nevis/> | html | `896e0f73b462cca509dc2801968b282f7950bd49a41265b0e82b202c13bc5653` |
| `geoBoundaries-KNA-ADM1.geojson` | <https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/KNA/ADM1/geoBoundaries-KNA-ADM1.geojson> | geojson | `bb3994877109054300d7247655d5e4299274778c6f9e3dc19854df9679b61731` |
| `gb_kna_adm1_meta.json` | <https://www.geoboundaries.org/api/current/gbOpen/KNA/ADM1/> | json | `220372bf61c692a4ab49ed56f15916a0c432ff3b13c7c01836eb9a2a6f9b4379` |

Also cached (context): `caricom_2021.txt`, `skn_2000round.txt`, and `vbt.txt` (`pdftotext -layout` extractions used to confirm the absence of any subnational religion cross-tab).

## Blockers and held items

- **No subnational religion table (the hold)**: religion is published for the whole federation only, at no parish or island level, for any wave. This is a published-data ceiling, not a retrieval failure.
- **Named unblock**: a DOS-SKN data request for the 2011 (and secondarily 2001) religion-by-parish or religion-by-island cross-tab. Religion was collected at the person level (2011 questionnaire religion item); the tabulation is therefore derivable at source. Recorded as a courtesy ask for the PI; not sent.
- **2021-2022 thematic reports (watch item)**: the current census has released a summary report only; a future DOS-SKN thematic report could publish religion, and its geographic level is unknown. Recorded as a watch item, not an ask.
- **Boundary clean and idle**: geoBoundaries KNA ADM1 (14 parishes, CC BY-SA 2.0) would join to any DOS-SKN parish table one-to-one under a parish-name crosswalk; no boundary work is warranted under the hold.
