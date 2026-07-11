# Marshall Islands census-religion route probe

Verified 2026-07-11. PROBE ONLY — no build, no commit. The Republic of the Marshall Islands (RMI) publishes religion **by atoll/island** for exactly **one** open census wave: 2021. The 2021 census report (Volume 1: Basic Tables and Administrative Report, EPPSO/SPC) prints **Table 9. Population by Urban/Rural and atoll by religion**, a machine-readable text table covering 25 atoll/island rows and 16 named religion categories, and it reconciles exactly at every margin (each atoll's 16 cells sum to its atoll total; the 25 atoll rows sum column-wise to the national Total; Rural + Urban = Total; zero mismatches). That is the product. The queue premise and the sibling framing that expected a 2011 *and* 2021 atoll series is **wrong for 2011**: the 2011 published reports (the SPC analytical report and the DOI summary report) tabulate no religion at all — religion was collected (questionnaire item P6) but never cross-tabulated in any located public 2011 output, and the 2021 analytical report's own historical religion figure skips 2011 entirely, jumping 1999→2021. The 1999 census religion table (Table 11) exists only at a coarse three-sector split — urban Majuro, urban Ebeye, rural — not by atoll, and its table body is image-only (no text layer; would need OCR). So the buildable object is a **single-wave (2021) atoll-level snapshot**, not a time series, with 1999/2021 national percentages available as context and 2011 held to licensed microdata.

## Build decision (recommendation to the conductor)

- **Recommendation**: BUILD a **single-wave (2021) religious-affiliation snapshot by atoll/island**, 24 atolls on the geoBoundaries MHL ADM1 frame, pending a PI licence ruling. This is a one-wave map, not a change series — treat it as the Palau-class snapshot, not the FSM/Kiribati/Tokelau multi-wave series. The atoll detail the queue hoped for is published, open, and reconciles, but only for 2021.
- **Candidate wave**: 2021 only, at atoll/island level (Table 9). HOLD 2011 (no public religion table located; microdata only). HOLD 1999 atoll (published only as a 3-sector urban/rural table, image-only).
- **Candidate geography**: 24 atolls on geoBoundaries MHL ADM1 (24 units), joining the census roster one-to-one by name minus Bikini (census pop 0, no polygon). NOT antimeridian-affected.
- **Construct**: census affiliation. The census item P6 ("What is …'s religious affiliation? / Kabuñ ta eo an …?"; for a young child, the religion of the parents) records each resident's reported religion; not practice, attendance, or membership.
- **Change metric**: not available at atoll level (one wave). A national 1999→2021 percentage comparison is publishable as context from the 2021 analytical report (Figure 3.3) and the 1999 Table 11, but the atoll counts exist for 2021 alone.
- **Map-worthy pattern**: strong denominational contrast across atolls. United Church of Christ – Congregational dominates most atolls (national 47.9%); Likiep is the outlier where Assembly of God leads (162 of 228); Arno and several northern atolls carry large Jehovah's Witness shares (Arno 342 of 1,140); Kili's second body is New Beginning Church (68 of 415); Roman Catholic and Mormon cluster on specific atolls (Mormon: Aur 48, Jaluit 88). This atoll-level contrast is the reason to map RMI even on one wave.
- **Rights position**: the 2021 and 2011 reports carry an explicit SPC (and, for 2021, EPPSO) partial-reproduction-with-acknowledgement clause, fetched and quoted verbatim below — the Kiribati-Atlas / Tonga Pacific posture. Ship derived atoll summaries with SPC/EPPSO attribution under the project's summaries-with-attribution stance, or hold for a PI ruling. The boundary is ODbL 1.0.

## Published waves and geography

| Year | Official route | Religion table | Format | Universe | Finest published geography | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| 1999 | [Marshall Islands Census Report 1999](https://www.spc.int/digitallibrary/get/84t9p) (EPPSO/SPC, via [SPC digital library](https://sdd.spc.int/digital_library/marshall-islands-census-report-1999)) | **Table 11. Population by religious affiliation and sex for urban (Majuro atoll and Ebeye island) and rural sector, RMI: 1999** | PDF, **image-only** (table body not in text layer; needs OCR) | all persons (50,840) | **3 sectors** (urban Majuro, urban Ebeye, rural) — NOT atoll | HOLD atoll; national/sector percentages only. |
| 2011 | [RMI 2011 Census Report](https://www.spc.int/digitallibrary/get/c3a4q) (EPPSO/SPC analytical, via [SPC digital library](https://sdd.spc.int/digital_library/republic-marshall-islands-2011-census-report)); [2011 Summary Report](https://www.doi.gov/sites/doi.gov/files/uploads/RMI-2011-Census-Summary-Report-on-Population-and-Housing.pdf) (DOI) | **none published** — religion collected (P6) but not tabulated in any located public report; the analytical report has no religion chapter and the summary report no religion table | — | all persons (53,158) | — | **HOLD** — no public religion table; microdata only. |
| 2021 | [RMI 2021 Census Report Volume 1: Basic Tables and Administrative Report](https://rmihealth.org/media/attachments/2025/08/08/marshall_islands_2021_census_vol1_table_report.pdf) (EPPSO/SPC, May 2023; [SPC library](https://sdd.spc.int/digital_library/republic-marshall-islands-2021-census-report-volume-1-basic-tables-and)) | **Table 9. Population by Urban/Rural and atoll by religion – RMI Census 2021** (national context also in Table 12, religion by 5-year age group) | PDF, **text-extractable, machine-readable** | all persons (41,575) | **atoll/island** (25 rows) + urban/rural | **SHIP** the single 2021 atoll wave. |

The RMI Economic Policy, Planning and Statistics Office (EPPSO; spelled "EPSSO" in the 2021 copyright line) is the office of record, co-publishing with the SPC Statistics for Development Division; the SPC digital library (`sdd.spc.int/mh`) is the durable index and hosts the report PDFs behind `spc.int/digitallibrary/get/*` redirects. The 2021 report appears in two volumes: the Basic Tables volume (Volume 1, `rmihealth.org` mirror, carries Table 9 — the atoll religion table) and a separate **Analytical Report** ([infomarshallislands.com mirror](https://www.infomarshallislands.com/wp-content/uploads/2025/04/Marshall-Islands-Census-2021.pdf)) whose §3.2 (Figure 3.3) carries only a **national** 1999-vs-2021 affiliation-percentage comparison, not atoll counts. The Pacific Data Hub microdata records — [2021 catalog/812](https://microdata.pacificdata.org/index.php/catalog/812), [2011 catalog/22](https://microdata.pacificdata.org/index.php/catalog/22), [1999 catalog/317](https://microdata.pacificdata.org/index.php/catalog/317) — are **licensed/restricted** (below) and are not the route. The SPC digital library also lists **[RMI tables 1973 Trust Territory of the Pacific Islands Census](https://sdd.spc.int/mh)**, a documented deep-history route not probed here.

## Category frame (2021, verbatim, Table 9 header order)

Preserve each source spelling. The 2021 Table 9 carries a Total column plus 16 religion categories:

| # | 2021 category (verbatim) | Product role |
| --- | --- | --- |
| 1 | United Church of Christ | religious affiliation (the historic Congregational/Protestant body) |
| 2 | Roman Catholic | religious affiliation |
| 3 | Assembly of God | religious affiliation |
| 4 | Jehovah's Witness | religious affiliation |
| 5 | Reformed Congregational Church | religious affiliation |
| 6 | Mormon | religious affiliation |
| 7 | Seventh Day Adventist | religious affiliation |
| 8 | Bukot Nan Jesus | religious affiliation |
| 9 | None | no-religion |
| 10 | Full Gospel | religious affiliation |
| 11 | Salvation Army | religious affiliation |
| 12 | Other (specify) | residual affiliation |
| 13 | Protestant Church | religious affiliation |
| 14 | New Beginning Church | religious affiliation |
| 15 | Baptist Church | religious affiliation |
| 16 | Batkan Light House Church | religious affiliation |

The 2021 analytical report's national narrative (Figure 3.3) collapses these into the broad bodies Protestant (~49%), Assemblies of God (14%), Roman Catholic (9.3%), Mormon (6%), and smaller shares. Note the frame differs from the 1999 sector table (which used broad bodies "Protestant / Assembly of God / Roman Catholic / …"); a cross-wave national comparison must reconcile the 2021 "United Church of Christ" + "Reformed Congregational Church" + "Protestant Church" lines against the 1999 "Protestant" line, and this reconciliation is what the analytical report itself performed. No such reconciliation is possible at atoll level because only 2021 carries atoll counts.

## The 2021 atoll counts (verified, reconciled from Table 9)

Every atoll row's 16 category cells sum to its printed atoll total; the 25 atoll rows sum column-wise to the national Total row for all 16 categories and the total; Rural (8,963) + Urban (32,612) = Total (41,575). National Total 41,575 = 19,920 UCC + 3,863 RC + 5,864 AoG + 538 JW + 930 Reformed Cong + 2,363 Mormon + 720 SDA + 1,246 Bukot Nan Jesus + 444 None + 2,086 Full Gospel + 954 Salvation Army + 1,128 Other + 515 Protestant Church + 593 New Beginning + 162 Baptist + 249 Batkan Light House. **Zero mismatches** across all margins (verified computationally in the probe).

Roster (25 atoll/island rows, printed numbering 1–26 with **#23 absent** from the code sequence): Ailinglaplap, Ailuk, Arno, Aur, Bikini (0), Ebon, Enewetak, Jabat, Jaluit, Kili, Kwajalein, Lae, Lib, Likiep, Majuro, Maloelap, Mejit, Mili, Namdrik, Namu, Rongelap (0), Ujae, Utirik, Wotho, Wotje. Bikini and Rongelap print zero population (resettlement history). The numbering skips 23; the printed roster is complete as an atoll list regardless of the code gap.

## Universe and denominator

The 2021 Table 9 universe is all persons of all ages, 41,575 — the full 2021 resident population. There is no age or sex restriction on the religion table. Bikini and Rongelap carry zero population and therefore zero across all religion cells. A build reads religious shares within each atoll's own 2021 denominator. Because the product is a single wave, there is no cross-wave universe reconciliation to perform at atoll level.

## Boundary source and licence

The boundary is [geoBoundaries MHL ADM1](https://www.geoboundaries.org/api/current/gbOpen/MHL/ADM1/). Release metadata (the build's boundary-licence authority): `"admUnitCount": "24"`, `"boundaryType": "ADM1"`, `"boundaryYearRepresented": "2017"`, `"boundarySource": "OpenStreetMap, Wambacher"`, `"boundaryLicense": "Open Data Commons Open Database License 1.0"`, `"licenseSource": "www.openstreetmap.org/copyright"`. The 24 ADM1 units are the atolls and carry `shapeName` values: Ailinglaplap, Ailuk, Arno, Aur, Ebon, Enewetak, Jabat, Jaluit, Kili, Kwajalein, Lae, Lib, Likiep, Majuro, Maloelap, Mejit, Mili, Namdrik, Namu, Rongelap, Ujae, Utirik, Wotho, Wotje.

The join is one-to-one on name with a single documented gap: the census carries **25** atoll/island rows, the boundary **24** — the census extra is **Bikini** (2021 population 0), which has no geoBoundaries ADM1 polygon. Rongelap (also pop 0) is present in the boundary. So all 24 boundary units join a census row directly, and the only unmatched census row (Bikini) is a zero-population atoll; a build assigns it a null-geometry/zero-count row or drops it with disclosure. The queue's boundary recommendation (geoBoundaries MHL ADM1) is **correct** here — unlike Kiribati, where ADM1 was the wrong level, RMI ADM1 *is* the atoll layer.

**Antimeridian: no issue.** The 24-feature layer's longitude extent is **160.947 E to 172.173 E** and latitude **4.573 N to 14.632 N** — wholly east-positive, well west of the 180° line. No dateline handling is needed (the brief's expectation is confirmed against the actual coordinates). RMI is compact enough that a naive national bbox is safe, but a build should still verify all 24 atolls fall inside the frame (the small-island completeness gate; the layer spans ~1,100 km).

## Licence position

The published religion table (2021 Table 9) sits in a report that carries an explicit reuse clause, fetched from the cached PDF front matter and quoted verbatim.

- **2021 report** ([`rmihealth.org` Volume 1](https://rmihealth.org/media/attachments/2025/08/08/marshall_islands_2021_census_vol1_table_report.pdf), front matter): "© Pacific Community (SPC), the Marshall Islands Economic Policy, Planning and Statistics Office (EPSSO) 2022. All rights for commercial/for profit reproduction or translation, in any form, reserved. SPC and the EPSSO authorise the partial reproduction or translation of this material for scientific, educational or research purposes, provided that SPC and EPSSO, and the source document are properly acknowledged. Permission to reproduce the document and/or translate in whole, in any form, whether for commercial/for profit or non-profit purposes, must be requested in writing. Original SPC and the EPSSO artwork may not be altered or separately published without permission." (The office is spelled "EPSSO" in this copyright line; elsewhere "EPPSO".)
- **2011 report** ([`spc.int/digitallibrary/get/c3a4q`](https://www.spc.int/digitallibrary/get/c3a4q), front matter): "© Copyright Secretariat of the Pacific Community 2012. All rights for commercial / for profit reproduction or translation, in any form, reserved. SPC authorises the partial reproduction or translation of this material for scientific, educational or research purposes, provided that SPC and the source document are properly acknowledged. Permission to reproduce the document and/or translate in whole, in any form, whether for commercial / for profit or non-profit purposes, must be requested in writing. Original SPC artwork may not be altered or separately published without permission."
- **PDH microdata** ([2021 catalog/812](https://microdata.pacificdata.org/index.php/catalog/812)): "Access conditions: Licensed datasets." The catalogue page states data belong to the depositor/data owner, that SPC "has to contact the data owner in order to obtain permission" before distributing certain licensed data, and requires an Access authority and a Confidentiality declaration. This is a documented **HOLD**, never a route; the 2011 (catalog/22) and 1999 (catalog/317) microdata carry the same PDH licensed-access posture. The build does not touch microdata (the 2021 report Table 9 is the public route), so the restriction is recorded only to explain why the 2011 and 1999 atoll routes are closed.
- **Boundary**: geoBoundaries MHL ADM1 is ODbL 1.0 per its release metadata (above).

The recommended position mirrors Kiribati (Atlas clause) and Tonga: the SPC/EPPSO clause is an explicit on-page partial-reproduction-with-acknowledgement authorisation for scientific/educational/research reuse — stronger than the Palau/FSM "no stated terms" vacuum. Ship derived atoll summaries with attribution to the Marshall Islands EPPSO and SPC under the summaries-with-attribution stance; a PI ruling confirms whether the SPC clause suffices or an EPPSO/SPC reuse-confirmation email is wanted. The clause authorises the project's derived summaries; it does not authorise republishing the report's own artwork or whole-document reproduction.

## Retrieval record

Every cached input is under `data/raw/mh_census/`, which `git check-ignore -v` confirms is excluded by `.gitignore:120` (the `data/` rule). Retrieval occurred on 2026-07-11.

| Cached input | Source URL | Hosting | SHA-256 |
| --- | --- | --- | --- |
| `mh_2021_census_vol1.pdf` | <https://rmihealth.org/media/attachments/2025/08/08/marshall_islands_2021_census_vol1_table_report.pdf> | rmihealth.org mirror (EPPSO/SPC Volume 1, Table 9 route) | `5a99ec726f7b3cc7522d40be0a87793a931cad9b0ef71b116f5dcfd5284f3dd3` |
| `mh_2021_infomi.pdf` | <https://www.infomarshallislands.com/wp-content/uploads/2025/04/Marshall-Islands-Census-2021.pdf> | infomarshallislands.com mirror (2021 Analytical Report, Fig 3.3 national context) | `35069e15460743d28b718803ab04a45a88bf1b5cd4fe60a1f21d98ab0d6e7989` |
| `mh_2011_census_full.pdf` | <https://rmi-data.sprep.org/system/files/Marshall_Islands_Census_2011-Full.pdf> | SPREP RMI portal (EPPSO/SPC 2011 analytical; no religion table) | `59cb95596ec074c50f099fd24e55500c923605e7494c030f9180dcceb45cb1ef` |
| `mh_2011_summary_doi.pdf` | <https://www.doi.gov/sites/doi.gov/files/uploads/RMI-2011-Census-Summary-Report-on-Population-and-Housing.pdf> | US DOI (2011 summary; no religion table) | `2864ac9ddfecc38c9fd4249b960bc886962fc610171c7b1bbe6209afc7753132` |
| `mh_1999_census.pdf` | <https://www.spc.int/digitallibrary/get/84t9p> | SPC digital library (1999 report; Table 11 image-only, 3-sector) | `b1e0ef8dcaa2dc395b655387b0a7f4064616fc13c127a085ae658586d8654e48` |
| `geoBoundaries-MHL-ADM1.geojson` | <https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/MHL/ADM1/geoBoundaries-MHL-ADM1.geojson> | geoBoundaries gbOpen (pinned 9469f09) | `148cca24be2a9c92476d915409bdc5b222812237a89dabe58daf95b5243c9c9b` |
| `gb_mhl_adm1_meta.json` | <https://www.geoboundaries.org/api/current/gbOpen/MHL/ADM1/> | geoBoundaries API | `156c7585b56908b18545ac6cdc34ffd81d3e1ec00737627d59ba8b96c088096a` |

Derived working files also present in the cache (not source objects): `mh_2021.txt`, `mh_2021_info.txt`, `mh_2011.txt`, `mh_2011_summary.txt`, `mh_1999.txt` (pdftotext `-layout` extractions), and `sdd_mh.html`, `dl_*.html`, `pdh_812.html`, `gb_mhl_adm1_meta.json` (page captures / metadata for the retrieval trail).

## Premise divergences (flagged for the conductor)

- **"The 2011 report prints religion at least nationally" — FALSE.** The 2011 published reports (the SPC/EPPSO analytical report and the DOI summary report) tabulate no religion at any level. Religion was collected (questionnaire item P6) but never cross-tabulated in a public 2011 output, and the 2021 analytical report's own historical religion figure (Figure 3.3) jumps 1999→2021, omitting 2011. 2011 atoll (or national) religion is available only through the licensed PDH microdata (catalog/22).
- **Queue row "Atoll or island affiliation for 2011 and 2021 after extraction" — half true.** Only **2021** is atoll-level and open (Table 9). 2011 is not available in any public table. The product is one wave, not two — a snapshot, not a series.
- **Queue boundary recommendation (geoBoundaries MHL ADM1) — CORRECT.** ADM1 has 24 units = the atolls, joining the 2021 census roster one-to-one minus Bikini (pop 0). No antimeridian issue (160.9–172.2 E). This confirms the queue's boundary line, in contrast to the Kiribati probe where ADM1 was the wrong level.

## Blockers and holds

- **Single wave.** The atoll religion route exists for 2021 only. There is no atoll-level change series. This is the defining limit and it lowers the product below the FSM/Kiribati/Tokelau multi-wave class to the Palau single-snapshot class.
- **2011 held to microdata.** No public 2011 religion table exists; the only 2011 religion route is the licensed PDH microdata (catalog/22), a documented HOLD. Unblock: an EPPSO/SPC custom tabulation or a released 2011 basic-tables volume (none located in the SPC digital library).
- **1999 atoll held.** The 1999 religion table (Table 11) is a 3-sector urban/rural split, not atoll, and its body is image-only (no text layer; needs OCR). It supports a national/sector percentage context, not an atoll wave.
- **Bikini join gap.** The 2021 census carries a 25th atoll row (Bikini, pop 0) with no geoBoundaries ADM1 polygon; a build assigns it a null/zero row or drops it with disclosure.
- **Licence.** The SPC/EPPSO partial-reproduction clause is explicit and quoted verbatim, but a PI ruling should confirm it suffices for the project's derived summaries (or request an EPPSO/SPC reuse-confirmation email). The boundary (ODbL 1.0) is clean.

## Product boundary

A build on this probe would stage a **single-wave (2021) atoll-level religious-affiliation snapshot** for 24 atolls on the geoBoundaries MHL ADM1 frame, with the 16-category verbatim frame, all-ages/all-persons universe (41,575), fail-fast reconciliation at every margin (verified to close exactly here), and the Bikini join gap disclosed. It could carry a **national 1999→2021 affiliation-percentage context strip** from the 2021 analytical report (Figure 3.3) and the 1999 Table 11, clearly separated from the atoll counts. It would **not** contain a 2011 wave (no public table; licensed microdata only), a 1999 atoll wave (3-sector, image-only), an atoll-level change layer (one wave), a place-of-worship layer, or place-density metrics. The two recorded routes to deepen the series are an EPPSO/SPC custom 2011 religion-by-atoll tabulation (or a 2011 basic-tables release) and OCR of the 1999 Table 11 for national/sector context; the 1973 Trust Territory tables are a separate deep-history route.
