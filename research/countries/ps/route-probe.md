# Palestine census-affiliation route probe

## Probe result

PCBS supports three governorate snapshots of census affiliation for 1997, 2007, and 2017. The 1997 and 2007 rows come from final census-report Excel attachments. The 2017 rows come from Table 3 of the official preliminary-results report because the final Palestine report does not publish one governorate-by-religion table. Every extracted governorate row reconciles exactly across the published religion categories. The 16 governorate rows also reconcile exactly to the PCBS national row in every wave.

The product withholds every cross-wave change metric. PCBS excludes Jerusalem J1 from the 1997 governorate table. PCBS uses a reduced J1 questionnaire that retains religion in 2007. PCBS records different J1 estimation or imputation procedures in the 2017 preliminary and final reports, and the 2017 governorate table precedes the final imputation described by PCBS. These coverage differences prevent a supported like-for-like change claim across the complete series.

## Official PCBS publications

| Wave | Official publication and exact table | Machine route | What the build uses |
| --- | --- | --- | --- |
| 1997 | [*Population Report, Palestinian Territory - First Part (Final Results)*](https://www.pcbs.gov.ps/media/dtgbbijp/book426-1997.pdf), Table 22, “Palestinian Population by Governorate, Sex and Religion” | [Official Excel attachment 426-x.zip](https://www.pcbs.gov.ps/downloads/zip/426-x.zip), `TAB-FIG/POP22.XLS` | Sixteen governorate rows, West Bank and Gaza Strip subtotals, and the Palestinian Territory total |
| 2007 | [*Census Final Results 2007 - Population Report - Palestinian Territory*](https://www.pcbs.gov.ps/media/1b3ejexf/book1853-2007.pdf), Table 13, “Palestinian Population in the Palestinian Territory by Age Group, Sex and Religion, 2007”; 16 official governorate reports publish the same table for their governorate | [Official Palestinian Territory Excel attachment 1853-x.zip](https://www.pcbs.gov.ps/downloads/zip/1853-x.zip) plus governorate Excel attachments [1540](https://www.pcbs.gov.ps/downloads/zip/1540-x.zip), [1546](https://www.pcbs.gov.ps/downloads/zip/1546-x.zip), [1549](https://www.pcbs.gov.ps/downloads/zip/1549-x.zip), [1556](https://www.pcbs.gov.ps/downloads/zip/1556-x.zip), [1558](https://www.pcbs.gov.ps/downloads/zip/1558-x.zip), [1562](https://www.pcbs.gov.ps/downloads/zip/1562-x.zip), [1564](https://www.pcbs.gov.ps/downloads/zip/1564-x.zip), [1565](https://www.pcbs.gov.ps/downloads/zip/1565-x.zip), [1574](https://www.pcbs.gov.ps/downloads/zip/1574-x.zip), [1581](https://www.pcbs.gov.ps/downloads/zip/1581-x.zip), [1583](https://www.pcbs.gov.ps/downloads/zip/1583-x.zip), [1867](https://www.pcbs.gov.ps/downloads/zip/1867-x.zip), [1871](https://www.pcbs.gov.ps/downloads/zip/1871-x.zip), [1875](https://www.pcbs.gov.ps/downloads/zip/1875-x.zip), [1879](https://www.pcbs.gov.ps/downloads/zip/1879-x.zip), and [1890](https://www.pcbs.gov.ps/downloads/zip/1890-x.zip) | Each governorate report's Table 13 total row; the Palestinian Territory Table 13 total supplies national reconciliation |
| 2017 | [*Preliminary Census Results, Population, Housing and Establishments Census 2017*](https://www.pcbs.gov.ps/portals/_pcbs/PressRelease/Press_En_Preliminary_Results_Report-en-with-tables.pdf), Table 3, “Palestinian Population in Palestine by Governorate and Religion, 2017” | Text-bearing PDF; page 35 was rendered and visually verified | Sixteen governorate rows, West Bank and Gaza Strip subtotals, and the Palestine total |

The [2017 final detailed Palestine report](https://www.pcbs.gov.ps/media/j0ffo50r/book2425-2017.pdf) supplies the final coverage, Jerusalem J1/J2, enumeration, and imputation notes. Its religion table is national by age and sex. It does not replace the preliminary report's governorate-by-religion table.

## Published category frames

The source's English category frame is retained exactly for each wave. Display labels are separate and do not rename source categories.

| Wave | Verbatim source key to display label | Product indicator label |
| --- | --- | --- |
| 1997 | `Total` → `Total`; `Islam` → `Islam`; `Christian` → `Christian`; `Others` → `Other`; `Not Stated` → `Not Stated` | `Reported a PCBS religion category (%)` |
| 2007 | `Total` → `Total`; `Islam` → `Islam`; `Christian` → `Christian`; `Others` → `Other`; `Not Stated` → `Not Stated` | `Reported a PCBS religion category (%)` |
| 2017 | `Total` → `Total`; `Islam` → `Islam`; `Christian` → `Christian`; `Other` → `Other`; `Not Stated` → `Not Stated` | `Reported a PCBS religion category (%)` |

PCBS defines religion in the 2007 final report as spiritual belief divided into Muslim, Christian, and Other. The 2017 final report defines religion as the person's spiritual belief. The product describes the categories recognised in the published tables in neutral terms. It assigns no identity to `Other`, `Others`, or `Not Stated`. PCBS publishes no no-religion category in these tables, and all `no_religion` fields are null.

## Geography and PCBS statistical coverage

PCBS publishes two geographic regions, `West Bank` and `Gaza Strip`, divided into 16 governorates. The 2017 source names the governorates as `Jenin`, `Tubas and the Northern Valleys`, `Tulkarm`, `Nablus`, `Qalqiliya`, `Salfit`, `Ramallah & Al-Bireh`, `Jericho & Al-Aghwar`, `Jerusalem`, `Bethlehem`, `Hebron`, `North Gaza`, `Gaza`, `Dier Al-Balah`, `Khan Yunis`, and `Rafah`. The product uses these PCBS English names as its display frame. Earlier source labels remain in the row provenance.

PCBS 1997 Table 22 states: “Jerusalem: Does not include those parts of Jerusalem which were annexed by Israel after its occupation of the West Bank in 1967.” PCBS describes the table as the population actually enumerated. The final-report notes exclude estimates for the population that the census did not enumerate.

PCBS 2007 designed a reduced household and housing questionnaire for `Jerusalem J1`. The reduced questionnaire retained the household roster fields relationship to head, sex, religion, age, refugee status, educational level, and marital status. The 2007 final report bases population and socio-economic tables on the actually enumerated population and excludes post-enumeration estimates.

The cached 2017 final detailed report states in its “Notice For Users” (PDF p. 223): “For more statistical purposes, Jerusalem Governorate was divided into two parts. 1. Jerusalem (Area J1): includes those parts of Jerusalem which were annexed by Israeli occupation in 1967. Those parts include the following localities: (Kafr A'qab, Beit Hanina, Shu'fat Camp, Shu'fat, Al 'Isawiya, Sheikh Jarrah, Wadi al Joz, Bab as Sahira, As Suwwana, At Tur, Jerusalem (Al Quds), Ash Shayyah, Ras al 'Amud, Silwan, Ath Thuri, Jabal al Mukabbir, As Sawahira al Gharbiya, Beit Safafa, Sharafat, Sur Bahir, Umm Tuba.). 2. Jerusalem (Area J2): Includes the following localities: (Rafat, Mikhmas, Qalandiya Camp, Qalandiya, Beit Duqqu, Jaba', Al Judeira, Ar Ram & Dahiyat al Bareed, Beit A'nan, Al Jib, Bir Nabala, Beit Ijza, Al Qubeiba, Kharayib Umm al Lahim, Biddu, An Nabi Samwil, Hizma, Beit Hanina al Balad, Qatanna, Beit Surik, Beit Iksa, A'nata, Al Ka'abina (Tajammu' Badawi), Az Za'ayyem, Al 'Eizariya, Abu Dis, A'rab al Jahalin (Salamat), As Sawahira ash Sharqiya, Ash Sheikh Sa'd).” These definitions supply coverage context for the preliminary report's Table 3; the build takes the 2017 counts from Table 3 (PDF p. 35).

The 2017 preliminary report distinguishes actual enumeration from post-enumeration undercoverage estimates. Table 1 reports 4,705,601 people actually counted and 75,377 added for estimated undercoverage. PCBS states that Jerusalem J1 uses a different undercoverage method. Table 3 reports 4,665,426 Palestinians with one of the four religion response states and reconciles exactly to its published governorate rows. The build uses Table 3 and does not add or allocate the undercoverage estimate.

The product reproduces PCBS statistical coverage as published for each wave. It does not harmonise PCBS geography with another country's statistical geography.

## Denominator and non-response rule

Each row's `population_total` is the PCBS Table `Total`, and the hard arithmetic gate requires `Total = Islam + Christian + Other(s) + Not Stated`. The product derives `religious_affiliation_count = Total - Not Stated` and `religious_affiliation_percent = 100 * (Total - Not Stated) / Total`. `Not Stated` remains a non-response state within the full published denominator. It is not treated as no religion.

PCBS states that percentages in the 2017 final report's main findings use cases with specified characteristics. The staged product retains the full table total as its denominator to expose non-response and to match the Iran recognised-category precedent. The indicator label states what the derived percentage measures.

## Publication terms

The current PCBS footer states that website content is licensed under the [Creative Commons Attribution 4.0 International Licence](https://www.pcbs.gov.ps/en/reference/terms-of-use/) unless otherwise noted. The PCBS terms say, “the user of the material is obliged to mention Palestinian Central Bureau of Statistics as the source of data.” The same terms grant a “universal, free-of-charge, irrevocable, parallel right of use” that includes copying, distributing, reusing, building, deriving, editing, commercial or non-commercial use, and quotation.

The cached 1997 and 2007 final reports print “All Rights Reserved.” The cached 2017 preliminary report prints no rights-reservation notice. The probe records these publication-level findings alongside the current website terms and does not infer that the website terms supersede either final report's notice. The staged product uses `Source: Palestinian Central Bureau of Statistics (PCBS)` and marks the PCBS publication licence position for conductor review before public release. The geoBoundaries licence is separately verified from its release metadata.

## Boundary release and licence

The default [geoBoundaries PSE ADM1 release](https://www.geoboundaries.org/api/current/gbOpen/PSE/ADM1/) does not match the PCBS governorate table. Its release metadata states `boundaryCanonical: territory` and `admUnitCount: 2`. The build rejects that candidate without relabelling its units.

The selected [geoBoundaries PSE ADM2 release](https://www.geoboundaries.org/api/current/gbOpen/PSE/ADM2/) matches the 16-row PCBS frame. Its release metadata states `boundaryCanonical: governorate`, `boundaryYearRepresented: 2017`, `admUnitCount: 16`, `boundarySource: Open Data Watch`, and `boundaryLicense: Creative Commons Attribution 4.0 (CC BY 4.0)`. The downloaded GeoJSON contains 16 valid, non-empty features with 16 distinct geometry hashes. The shared mapshaper helper writes a 1,247,851-byte simplified file, below the 3 MB ceiling.

The boundary is a non-official 2017 release. Governorate boundary stability across 1997, 2007, and 2017 remains unverified. The 2017 Jerusalem polygon includes geographic coverage outside the 1997 Table 22 data basis, and each affected row discloses that mismatch.

## Extraction and hard gates

`scripts/build_ps_area_summary.R` extracts 1997 Table 22 from `426-x.zip`, extracts the total row from Table 13 in each 2007 governorate workbook, and verifies the 2007 national row against `1853-x.zip`. The script uses a visually verified transcription of 2017 Table 3 and confirms that the pinned PDF still contains the exact table title before building.

The build stops on any row whose categories do not sum to `Total`. It also stops when governorate sums differ from the PCBS national total in any category, when a wave lacks 16 governorates, when the boundary release count or canonical level changes, when any geometry is empty or invalid, when geometry hashes repeat, or when the simplified file exceeds 3 MB. The script never allocates a residual.

Every cached object under `data/raw/ps_census/` is git-ignored. `docs/manifests/ps-census-religion-1997-2017.json` records the exact URL, byte count, and SHA-256 for all 44 cached objects. `git check-ignore -v data/raw/ps_census/pcbs_1997_426_excel.zip` resolves to the repository's `data/` ignore rule.

## Open PI ruling

How should PCBS statistical geography relate to the live Israel route on shared surfaces such as the global map, and may overlapping claims appear together? The country data product does not resolve this question, and no country page or hub entry is part of this lane.
