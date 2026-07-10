# Saint Lucia census-religion route probe

Verified 2026-07-10. The official Central Statistical Office (CSO) record supports census affiliation for 2001, 2010, and 2022. The CSO REDATAM databases publish weighted religion counts on a 12-part District/Parish frame for 2001 and a corresponding 12-part District frame for 2010. The three Castries subdivisions can be summed to the ten public districts. The 2022 provisional report publishes Table D.2 directly on that ten-district frame.

No area-summary product can ship. The 2022 PDF's integer cells do not reconcile exactly: only Micoud's category column sums to its printed total, and the other nine district columns differ by one to three people. The national category column differs by one person. Five 2001 local rows and eight 2010 local rows also fail their printed totals. Both historical waves fail local-to-national reconciliation. The discrepancies are consistent with independent cell rounding, but the captured outputs do not document the rounding algorithm. Every discrepancy figure in this document comes from the `pdftotext` text layer or the captured REDATAM outputs and has not been verified against rendered page images; the Côte d'Ivoire readback ([reconciliation-verification.md](../ci/reconciliation-verification.md)) is the precedent for that check, which remains the required next step before any interpretation of these discrepancies is settled. The builder applies no tolerance, allocation, or rounding repair and stops before joining or writing a product.

## Official publications and build decision

| Wave | Official CSO route | Published religion geography | Build decision |
| --- | --- | --- | --- |
| 2001 | [2001 Population and Housing Census Report](https://stats.gov.lc/wp-content/uploads/2018/07/2001-Population-and-Housing-Census-Report.pdf), Table 40; [CSO REDATAM 2001](https://prod.redatam.org/binlca/RpWebEngine.exe/Portal?BASE=PHC2001) | The report's Table 40 is national. REDATAM publishes weighted integer counts for 12 District/Parish units. | Blocked. Five local category sets miss their printed totals by one to five people. The 12 local totals sum to 156,734 while the national REDATAM total is 156,733. Several category totals differ by one or two people. |
| 2010 | [2010 Population and Housing Census Preliminary Report](https://stats.gov.lc/wp-content/uploads/2016/12/StLuciaPreliminaryCensusReport2010.pdf), Table 40; [CSO REDATAM 2010](https://prod.redatam.org/binlca/RpWebEngine.exe/Portal?BASE=PHC2010C) | The report's Table 40 is national. REDATAM publishes weighted integer counts under 12 District filters. | Blocked. Eight local category sets miss their printed totals by one or two people, and the national category set misses by two. The 12 local category totals sum to 165,314 while the national REDATAM total is 165,315. Local missing counts sum to 282 while the national output prints 281. |
| 2022 | [2022 Population and Housing Census Provisional Results, Release 1](https://stats.gov.lc/wp-content/uploads/2024/08/StLucia-Provisional-Census-Report-2022-Release-1Rev1.pdf), Table D.2 | Ten districts | Blocked. Ten of the 11 printed geography columns, including Saint Lucia, fail exact category reconciliation by one to three people. Category rows also fail district-to-national reconciliation. |

The [current CSO publications page](https://stats.gov.lc/publications/) still labels the 2022 document “2022 Population and Housing Census Report Provisional Results”. No final 2022 census report appears in that list. The current [CSO census-results page](https://stats.gov.lc/census/census-results/) links the 2022 REDATAM database, but that route does not establish that a final report has superseded the provisional release. The cached provisional report itself states that cleaning is ongoing and that its figures may approximate the final census statistics.

## Category frames

The names below reproduce the captured source spellings. They are not harmonised display labels.

- **2001 REDATAM**: Anglican; Baptist; Bahai; Bretheren; Church of God; Evangelical; Hindu; Jehovah Witnesses; Methodist; Moravian; Muslim; Pentecostal; Presbyterian; Rastafarian; Roman Catholic; Salvation Army; Seventh Day Adventist; None; Not stated; Other.
- **2010 REDATAM**: Anglican; Baptist; Bahai; Bretheren; Church of God; Evangelical; Hindu; Jehovah Witnesses; Methodist; Moravian; Muslim; Pentacostal; Presbyterian; Rastafarian; Roman Catholic; Salvation Army; Seventh Day Adventist; Lutheran; None; Not stated.
- **2022 Table D.2**: Anglican; Baptist; Bahai Faith; Brethren; Buddhism; Mennonite; Hindu; Jehovah Witnesses; Methodist; Mormon; Islam; Pentecostal; Nazarene; Rastafarian; Roman Catholic; Salvation Army; Seventh Day Adventist; Universal Church; Hinduism; Atheist - Do not believe in God; None - No religion but believe in God; Other; Not reported.

The frames are not identical. The historical sources use *None*, while the 2022 table separates *Atheist - Do not believe in God* from *None - No religion but believe in God*. Denomination categories and spellings also change. Cross-wave change metrics are therefore withheld even apart from the arithmetic failures.

## Geography and aggregation

The 2001 REDATAM form names its area break `District/Parish` and returns 12 areas: Castries Metropolitan; Castries City (Rest); Castries Rural; Anse-La-Raye; Canaries; Sourfriere; Choiseul; Laborie; Vieux-Fort; Micoud; Dennery; and Gross Islet. The spelling is verbatim.

The 2010 REDATAM form names its filter `District` and exposes 12 codes. The cached selection form, `data/raw/lc_census/redatam_2010_selection_form.html` (SHA-256 `d430afdfa50935e355fef5c7715dd28e7d7e2571785ac5d875158e1dccca405f`), assigns the codes as follows: `1` Castries Metro; `2` Castries city; `3` Castries rural; `4` Anse-La-Raye; `5` Canaries; `6` Soufriere; `7` Choiseul; `8` Laborie; `9` Vieux-Fort; `10` Micoud; `11` Dennery; and `12` Gros-Islet. Each cached output is a weighted frequency table for one verified filter assignment.

The 2022 report calls its geography `District` and prints ten columns: Castries; Anse La Raye; Canaries; Soufriere; Choiseul; Laborie; Vieux Fort; Micoud; Dennery; and Gros Islet. Summing the three historical Castries subdivisions is a complete aggregation to this frame. The other nine districts correspond directly after spelling normalisation. No split allocation or boundary crosswalk is required.

## Denominators and non-response

The 2001 national REDATAM religion output prints a weighted category total of 156,733, including 2,484 *Not stated* responses. It prints no separate missing count. A stated-response denominator would therefore be 154,249. The 2001 final report instead records an enumerated resident population of 156,635 and an estimated household population of 157,775. The captured sources do not explain why the weighted REDATAM religion total is 98 above the enumerated resident count. That discrepancy must remain explicit and unresolved.

The 2010 national REDATAM religion output prints a weighted category total of 165,315, including 2,305 *Not stated* responses, plus `Missing : 281` outside the category total. A stated-response denominator would therefore be 163,010. The category total plus missing count is 165,596, one above the preliminary report's estimated private-household population of 165,595. The report also records 931 residents outside private households, giving a total resident population of 166,526. Any future surface must disclose the separate *Not stated* count, the REDATAM missing count, and the 931 residents outside the household basis.

The 2022 Table D.2 total is the household population of 171,834. It includes 7,064 *Not reported* responses. A stated-response denominator would be 164,770. The no-religion numerator would combine 514 *Atheist - Do not believe in God* responses and 24,252 *None - No religion but believe in God* responses. The provisional report records 172,948 residents, of whom 1,114 live in institutions. Those 1,114 residents lie outside Table D.2's household basis and must be disclosed on any future shipped surface. The report also records 5,859 visiting non-residents outside the resident population.

## Publication terms

The cached CSO terms page states: “Access and use of the Data is subject to the requirements set forth under the Open Licence Agreement.” The cached agreement grants a “worldwide, royalty-free, non-exclusive licence” to use, copy, modify, publish, distribute, and create derivative or value-added products from CSO information. It limits the grant to CSO data and excludes third-party material.

The agreement requires this notice for value-added products: “This product was adapted from the information of The Central Statistical Office of Saint Lucia, which is licensed under the Open Licence Agreement of The Central Statistical Office of Saint Lucia.” The census tables are therefore buildable under the captured CSO Open Licence Agreement, subject to that notice. The licence position passes; the arithmetic gate blocks release.

## Boundary source and release metadata

The proposed boundary is [geoBoundaries Saint Lucia administrative level 1 (ADM1) release metadata](https://www.geoboundaries.org/api/current/gbOpen/LCA/ADM1/). The cached release metadata records boundary ID `LCA-ADM1-63095687`; canonical level `District`; represented year `2015`; source `Wikimedia Commons, Wikimedia Commons`; ten units; and licence `CC0 1.0 Universal (CC0 1.0) Public Domain Dedication`. The metadata points to the pinned [GeoJSON](https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/LCA/ADM1/geoBoundaries-LCA-ADM1.geojson).

The source geometry has ten non-empty features. All are valid after `sf::st_make_valid()`, and all ten geometry hashes are distinct. Its ten-unit count matches the 2022 district frame and the historical frame after the three Castries subdivisions are summed. The source labels require explicit normalisation for `Anse la Raya` and `Soufrière`. A census join, simplification, post-simplification validity and distinct-hash tests, and the three-megabyte cap were not reached because the census gate failed first.

## REDATAM retrieval recipe

The current [CSO census-results page](https://stats.gov.lc/census/census-results/) is the official entry point. The cached outputs were generated on 2026-07-10 through `RpWebStats.exe/CrossTab` with `FORMAT=HTML`, `PERCENT=OFF`, and the database's published person weight.

- **2001 local table**: `BASE=PHC2001`, `ITEM=CCSOCECOGENERAL`, `CONTROL=PERSON.RELIGION`, `COLUMN=PERSON.SEX`, `AREABREAK=DISTRICT`, `WEIGHT=ED.WEIGHT`, and `SELECTION=ALL`.
- **2001 national table**: the same request with an empty `AREABREAK`.
- **2010 local tables**: `BASE=PHC2010C`, `ITEM=CRUCPOB`, `ROW=PERSON.P39RELIGIO`, `WEIGHT=PERSON.PWEIGHT`, and one `DISTRICT.DISTC=<1..12>` filter per output.
- **2010 national table**: the same request without a district filter.
- **2022 corroborating table**: `BASE=PHC2022`, `ITEM=CRUZ1`, `ROW=DISTRICT.REDCODEN`, `COLUMN=PERSON.P1_5`, and `WEIGHT=PERSON.PERSON_WEIGHT`. This REDATAM variable is a coarser recode and does not replace the full Table D.2 extraction.

REDATAM result-frame URLs are temporary. The reproducible record is the POST selection above plus the hashes of the captured result bytes.

## Retrieval record

All inputs were retrieved on 2026-07-10. `git check-ignore -v` confirms that `.gitignore` line 120 ignores `data/`, including every file under `data/raw/lc_census/`.

| Cached input | Source or role | SHA-256 |
| --- | --- | --- |
| `lc_2001_final_report.pdf` | 2001 final report | `54bcc5fd117ef0f23da164c15d11354eccc0c4c3e26b75e737df4e0fef051e3e` |
| `lc_2010_preliminary_report.pdf` | 2010 preliminary report | `122e4902e161453af26bf173eb3c2fdf7fd8de611e6fcb769e54d88c3603017d` |
| `lc_2022_provisional_release1_rev1.pdf` | 2022 provisional Release 1, revision 1 | `030cba4bf5a5002e08d5bfbc67fe1c4d3d7b3728b4119c6c8911ab1c8b93dcf7` |
| `cso_publications.html` | Current publication inventory and provisional label | `36a2bdfcd3e06da27679721d3e2afa1d69c235b71f19e1ae146890c116111b34` |
| `cso_census_results.html` | Official REDATAM entry page | `2c808f46e2a04d2a9f74cc89416b6330c76746612f7a11866842f98ea0672137` |
| `cso_terms_and_conditions.html` | CSO terms page | `e6d375435ffd082ca1e5a0a21c81886249b329d67f9f9cb11cd1d65d98b42059` |
| `cso_open_licence_agreement.html` | CSO Open Licence Agreement | `fe1808b02ed0040900425ac7f83e1ec1a1c0ad32e1d42a383db20708653cc12d` |
| `redatam_PHC2001.html` | 2001 REDATAM portal response | `e11fe1a9f38d732bfba60dd752a01944071eef75e836875e2bd25d2819c9e535` |
| `redatam_PHC2010C.html` | 2010 REDATAM portal response | `e19d4f64cb2656c5bd9404056b2aba85d9393a984440537e9c0037d37e4e7b1b` |
| `redatam_PHC2022.html` | 2022 REDATAM portal response | `f66851408528dd0a3c1f46811974774149c6ea3164bb51fa7c74f9c8f4869fad` |
| `redatam_2001_religion_by_district.html` | 2001 12-area result | `5fa0a066c2fa723c042555bc6b2c0de735bcb0d1e48e38fbce168b69257b52a8` |
| `redatam_2001_religion_national.html` | 2001 national result | `266a8f44b6b03b76a2d477bd5f5d5d412e46ec68b5b3ad390d67c51d5aed15e9` |
| `redatam_2010_religion_by_district.html` | 2010 exploratory cross-tabulation retained as probe evidence | `76113e9ed910624c3a89b6142170f5b90729d24999f9c6d7eaec65976586740e` |
| `redatam_2010_religion_national.html` | 2010 national result | `c707854f894d0ca6b6a39e32fee872c0807fec5fbe6bf121f1669012a41ccda2` |
| `redatam_2022_religion_by_district.html` | 2022 corroborating coarse recode | `73cb76f2ca46662170e0e3dea52ec067d1ebb426b4af0a65409ca6f496f23838` |
| `redatam_2010_districts/district_1.html` | 2010 District code 1 | `a0de17f499adb6ea2fc4bf26705de5c2bd8d2f3d5e0b6aa5f9337cb2959125a1` |
| `redatam_2010_districts/district_2.html` | 2010 District code 2 | `466db15be60203a0e6d3e3cce7969544366f23a560538c1b43a2402ed17f30b8` |
| `redatam_2010_districts/district_3.html` | 2010 District code 3 | `3eeab9b85a40f23652a78244cd3db6b9d1dcc7a7aa7daa76e933207aa8368046` |
| `redatam_2010_districts/district_4.html` | 2010 District code 4 | `22b858ac563e8e97063289bfc0e46ef557cd6b9718959becfbf20601dc604203` |
| `redatam_2010_districts/district_5.html` | 2010 District code 5 | `5274c594f7f7376ec4b871cde5272e0e3cc1db214aabe05454c25a34c4e170b3` |
| `redatam_2010_districts/district_6.html` | 2010 District code 6 | `744d1cc1d2bfd66aa7b6b00bae4df7f5a61fa05c901bf52eabf7dc90fabed0b3` |
| `redatam_2010_districts/district_7.html` | 2010 District code 7 | `164b9ec5ec2d6056f5d37a888acc93412c65b6e24aaa40fa1ba500310623d3f5` |
| `redatam_2010_districts/district_8.html` | 2010 District code 8 | `6a7355d5426fb267b5ff8698350753c4a9b2f7c82293111ddac9bf3cb56ba6e9` |
| `redatam_2010_districts/district_9.html` | 2010 District code 9 | `c5e2bbaa04fce13455f46c3f9be07ffde829f9f6fb5436081e79fcd2843b97b1` |
| `redatam_2010_districts/district_10.html` | 2010 District code 10 | `ae76f3c7705350d12660f382bc585f69a904add3bbefd4b75c29512c0b511066` |
| `redatam_2010_districts/district_11.html` | 2010 District code 11 | `066f7acde0c18428883bdbcdc27573aec7b33711db23f5204e24a74eca6a5e08` |
| `redatam_2010_districts/district_12.html` | 2010 District code 12 | `0a38b1e406b55ff63442e942b07d452142c466d33b09eb8b4e72b723d9b3663b` |
| `gb_lca_adm1_meta.json` | geoBoundaries release metadata | `b447482e6007a1d783f0e675218fa329e48fcf16c77d7a972b4ae781620586f6` |
| `geoBoundaries-LCA-ADM1.geojson` | Pinned geoBoundaries source geometry | `9bd23d92377980a8d740d7c490f6d3578ca7f4ee07e31f2911f59be9ace33bc3` |

## Hard-gate result

- **Official route**: passed. The CSO record supports all three census waves through reports and REDATAM.
- **Final-release search**: no superseding final 2022 report was located on the current CSO publications page. The source remains Provisional Results, Release 1.
- **PDF text layer**: passed. Poppler `pdftotext -layout` extracts Table D.2 without optical character recognition.
- **2001 every-area reconciliation**: failed. Castries Metropolitan differs by +5; Anse-La-Raye by +2; Soufriere by -1; Vieux-Fort by +2; and Micoud by +1. The other seven areas reconcile exactly.
- **2001 local-to-national reconciliation**: failed. Local totals sum to 156,734 against 156,733 nationally, with category differences of up to two people.
- **2010 every-area reconciliation**: failed. District codes 2, 3, 4, 6, 7, 8, 10, and 12 differ from their printed totals by one or two people. The national category set sums to two below its printed total. Missing counts remain separate.
- **2010 local-to-national reconciliation**: failed. Local category totals sum to 165,314 against 165,315 nationally; local missing counts sum to 282 against 281 nationally.
- **2022 every-column reconciliation**: failed. The national column and nine of ten districts differ from the sum of their 23 printed categories by one to three people. Micoud alone reconciles exactly.
- **2022 category-to-national reconciliation**: failed. Fifteen category rows differ from the sum of the ten district cells by one or two people.
- **Change metric**: withheld. Category frames are not identical, and every candidate series also fails an exact gate.
- **CSO publication licence**: passed from captured bytes under the CSO Open Licence Agreement, with the required value-added-product notice.
- **Boundary release licence**: passed from release metadata under CC0 1.0 Universal.
- **Source geometry**: passed for ten features, non-empty geometry, validity after repair, and distinct geometry hashes.
- **Simplified boundary and product schema**: not reached because census reconciliation failed first.
- **Product writing**: stopped. No JSON, CSV, GeoJSON, manifest, or country page was written.

The fail-fast builder is [`scripts/build_lc_area_summary.R`](../../../scripts/build_lc_area_summary.R). A corrected or unrounded official table, or a PI decision that explicitly derives rounding bounds from the source, is required before this lane can proceed.
