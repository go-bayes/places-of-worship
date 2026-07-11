# FSM census-religion route probe

Verified 2026-07-11. The Federated States of Micronesia publishes religion by state for three census waves — 2000, 2010, and 2023 — and every wave joins the four-state geoBoundaries layer one-to-one. This is a genuine three-wave state series, materially stronger than the queue's metadata-first survey implied and stronger than the Palau sibling. The survey premise ("state-level maps are plausible for 2000 and 2010; the 2022 record did not expose religion variables") is refuted by the published tabulations: religion by state is a count-valued published table in 2000 (the four SPC state-report appendices), 2010 (the FSM Statistics Basic Tabulation workbook, Table B09), and 2023 (the FSM Statistics Basic Tables workbook, Table B6). The 2010 and 2023 waves arrive as machine-readable Excel; the 2000 wave is count-valued in the state-report appendix tables. All three waves share one all-ages, all-persons universe, so both levels and broad-affiliation change are readable across the full 2000-to-2023 span — no universe break, unlike Palau. The one genuine gate is the licence: the published religion tables carry no stated reuse terms (the Palau vacuum), though the boundary is cleanly CC BY 3.0 IGO.

## Build decision (recommendation to the conductor)

- **Recommendation**: BUILD a four-state, three-wave religious-affiliation series (2000, 2010, 2023), pending a PI licence ruling (the published tables carry no stated terms; the summaries-not-raw-data precedent applies).
- **Candidate waves**: 2000, 2010, 2023 as levels, with broad-affiliation change readable across all three.
- **Candidate geography**: 4 states (Yap, Chuuk, Pohnpei, Kosrae) on the geoBoundaries FSM ADM1 frame (4 units, one-to-one join).
- **Construct**: census affiliation. Each resident's reported religion (questionnaire item 7, "asked of all persons regardless of age and sex"); not practice, attendance, or membership.
- **Change metric**: readable across 2000 to 2023 at the broad-affiliation level (Roman Catholic, Congregation/Protestant, Other, No religion/Refused), because every wave counts all persons of all ages. Finer denomination detail (Assembly of God, Apostolic, Pentecostal, Jehovah's Witness) is comparable only across the 2010-to-2023 pair; in 2000 those bodies sit inside "Other Religion". Publish a broad-affiliation state series across all three waves; reserve any denomination series for the 2010-2023 pair.
- **Map-worthy pattern**: the four states are sharply contrasted denominationally. In every wave Kosrae is overwhelmingly Congregational (2010: 5,762 of 6,616, 87 percent; Roman Catholic just 153), Yap and Chuuk are heavily Roman Catholic (Yap 2010: 9,304 of 11,377, 82 percent; Chuuk 2010: 26,940 of 48,654, 55 percent), and Pohnpei splits between Roman Catholic (19,833) and Congregation/Protestant (12,937). This state-level contrast is the reason to map FSM.
- **Rights position**: no stated reuse licence on the published religion tables in any wave. Ship derived state summaries with attribution to the FSM Statistics Division (Division of Statistics / National Statistics Office) under the RO/SK/CA/CI/IR/PW summaries-not-raw-data stance, or hold for a PI ruling. The geoBoundaries layer is CC BY 3.0 IGO and byte-matched.

## Published waves and geography

| Year | Official route | Religion-by-state table | Universe | Finest published geography | Decision |
| --- | --- | --- | --- | --- | --- |
| 2000 | Four SPC/SDD state reports (Yap, Chuuk, Pohnpei, Kosrae), *2000 FSM Census of Population and Housing* | Appendix **Table B10** (Kosrae/Yap/Pohnpei) / **B10a-d** (Chuuk) "Marital Status and Religion by Municipality of Usual Residence" (text-extractable counts); analytical Table 7.1 "Religion by Sex" and Table 7.2 "Religion by Municipality" (percentages) | all persons, all ages | municipality within state | Ship the four-state 2000 wave from the count-valued appendix tables. |
| 2010 | [FSM Basic Tabulation, 2010 Census of Population and Housing](https://stats.gov.fm/download/18/population-statistics/600/fsm-basic-tabulation-2010-census-of-population-and-housing.xlsx) (FSM Statistics Division, xlsx) | **Table B09** "Marital status, Religion by State of Usual Residence, FSM: 2010" (machine-readable counts, 12 categories) | all persons, all ages | state (4) | Ship the four-state 2010 wave. |
| 2023 | [FSM Basic Tables, 2023 Population and Housing Census](https://stats.gov.fm/download/18/population-statistics/2210/fsm-basic-tables-2023-population-housing-census.xlsx) (FSM Statistics Division, xlsx) | **Table B6** "Religion by State, FSM: 2023" (machine-readable counts, 11 categories; small cells asterisk-suppressed) | all persons, all ages | state (4) | Ship the four-state 2023 wave, disclosing the suppression. |

The FSM Statistics Division site (stats.gov.fm; formerly fsmstatistics.fm) is the source of record for 2010 and 2023; the SPC Statistics for Development Division digital library (`sdd.spc.int/fm`, canonical PDFs at `spc.int/DigitalLibrary/Doc/SDD/Census/FM/`) and its pacificweb.org / fsm-data.sprep.org mirrors are the source of record for the 2000 state reports. The Pacific Data Hub records are microdata, not the route: [2000 catalog/109](https://microdata.pacificdata.org/index.php/catalog/109), [2010 catalog/9](https://microdata.pacificdata.org/index.php/catalog/9), [2022/2023 catalog/806](https://microdata.pacificdata.org/index.php/catalog/806) are restricted (confidentiality declaration required under FSM Public Law 5-77) and are not used by the build; the published report and workbook tables carry the state-by-religion aggregates the build needs. A [2010 Summary Analysis of Key Indicators](https://stats.gov.fm/wp-content/uploads/2023/12/2010-Summary-Analysis-Key-Indicators.pdf) PDF also exists on the FSM site (analytical narrative; the xlsx is the table source). Per-state 2010 Basic Tabulation workbooks (Pohnpei, Chuuk, etc.) exist on stats.gov.fm but are redundant: the FSM-wide workbook's Table B09 already carries all four states and its national all-persons total (102,843) reconciles exactly.

## Category frames

The 2000 appendix frame is uniform across all four state reports; 2010 and 2023 widen it as new churches split out of "Other Religion". Preserve each source spelling per wave.

| 2000 (Table B10, all four states) | 2010 (Table B09) | 2023 (Table B6) | Product role |
| --- | --- | --- | --- |
| Roman Catholic | Roman Catholic | Roman Catholic | religious affiliation |
| Congregational | Congregation/Protestant | Congregation/Protestant | religious affiliation |
| Latter Day Saints (Mormon) | Mormon | Mormon | religious affiliation |
| Baptist | Baptist | Baptist | religious affiliation |
| Seventh Day Adventist (SDA) | Seven Day Adventist (SDA) | SDA | religious affiliation |
| (in Other Religion) | Assembly of God | Assembly of God | religious affiliation |
| (in Other Religion) | Apostolic | Apostolic | religious affiliation |
| (in Other Religion) | Pentecostal | Pentecostal | religious affiliation |
| (in Other Religion) | Jehovah Witnesses | Jehovah's Witness | religious affiliation |
| Other Religion | Other religions | Other religion | residual affiliation |
| No Religion | No religion | No religion/Refused | no-religion |
| Refused | Refused | (folded into No religion/Refused) | non-response |

Two frame facts govern comparability. The first frame fact is denominational splitting: the 2000 eight-line frame folds Assembly of God, Apostolic, Pentecostal, and Jehovah's Witness into "Other Religion", so treating the 2000 "Other Religion" as comparable to the 2010/2023 "Other religion" would misread the split-out, not a real change; the broad spine (Roman Catholic, Congregation/Protestant, and the always-separate SDA, Baptist, Mormon) is comparable across all three waves. The second frame fact is the no-religion treatment: 2000 and 2010 print separate "No religion" and "Refused" lines, whereas 2023 merges them into one "No religion/Refused" line, so a comparable no-religion-plus-non-response series should combine those two 2000 and 2010 cells to match the 2023 line. A shared product should publish broad religious-affiliation totals per state across all three waves and reserve the finer denomination series for the matched 2010-2023 pair.

The Congregational Church is the historic Protestant body across Micronesia (first mission 1852) and remains a first-class named category in every wave; it should keep its own display label distinct from the Roman Catholic line.

## Universe and denominator

Every wave counts all persons of all ages, so there is no universe break and the state denominators are directly comparable. The 2000 state totals from the appendix religion tables are Yap 11,241, Chuuk 53,595, Pohnpei 34,486, Kosrae 7,686 (FSM 107,008). The 2010 Table B09 religion universe is 102,843 (the full 2010 resident population), split Yap 11,377, Chuuk 48,654, Pohnpei 36,196, Kosrae 6,616. The 2023 Table B6 total is 75,817 (the full 2023 population), split Yap 10,739, Chuuk 33,885, Pohnpei 26,102, Kosrae 5,092. The population falls sharply across the span (107,008 to 102,843 to 75,817), driven by Chuuk out-migration; the build reads religious shares within each state's own wave denominator and never treats the population decline as a religion change.

## Reconciliation gates (verified in the probe)

- **2000 Kosrae (Table B10)**: the eight category rows (Roman Catholic 141; Congregational 6,851; SDA 113; Baptist 121; Mormon 169; Other Religion 279; Refused 3; No Religion 9) sum to the printed All-persons total 7,686. Closes exactly.
- **2000 Chuuk (Table B10a)**: Roman Catholic 28,422; Congregational 23,074; SDA 171; Baptist 194; Mormon 362; Other Religion 1,346; Refused 6; No Religion 20 sum to the printed 53,595. Closes exactly.
- **2000 Yap (Table B10)**: Roman Catholic 9,363; Congregational 378; SDA 81; Baptist 31; Mormon 121; Other Religion 618; Refused 37; No Religion 612 sum to the printed 11,241. Closes exactly.
- **2000 Pohnpei (Table B10)**: Roman Catholic 18,439; Congregational 12,576; SDA 428; Baptist 626; Mormon 471; Other Religion 1,823; Refused 11; No Religion 112 sum to the printed 34,486. Closes exactly.
- **2010 (Table B09)**: the four state columns sum to the printed FSM total for every religion (e.g. Roman Catholic 9,304 + 26,940 + 19,833 + 153 = 56,230) and across all religions (11,377 + 48,654 + 36,196 + 6,616 = 102,843). Both margins close exactly.
- **2023 (Table B6)**: the four state columns sum to the printed FSM total for the unsuppressed categories, but two source discrepancies must be carried (see below).
- The build stops and records any failing row on arithmetic mismatch; no value is allocated, inferred, rounded, or tuned.

Two documented source facts in the 2023 wave, both to be disclosed, never repaired. The first 2023 fact is a one-person total discrepancy: the printed FSM total 75,817 is one less than the sum of the four printed state totals (10,739 + 33,885 + 26,102 + 5,092 = 75,818); the printed values govern and the build discloses the gap (the Saint Lucia / Côte d'Ivoire / Palau documented-discrepancy treatment). The second 2023 fact is asterisk cell-suppression: small state cells are printed as `*` (for example Assembly of God in Chuuk, Apostolic in Yap and Kosrae, Jehovah's Witness in Kosrae), so a 2023 state column cannot be fully summed from its printed cells; the build carries the suppression flag and never imputes a suppressed value.

## Boundary source and licence

The boundary is [geoBoundaries FSM ADM1](https://www.geoboundaries.org/api/current/gbOpen/FSM/ADM1/). The release metadata states `"admUnitCount": "4"`, `"boundaryType": "ADM1"`, `"boundaryYearRepresented": "2019"`, `"boundarySource": "OCHA ROP, Federated States of Micronesia Division of Statistics, 2010 Census of Population and Housing and Secretariat of the Pacific Community, Statistics for Development Division"`, and `"boundaryLicense": "Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO)"`. The build uses that release metadata as the licence authority. This is a favourable boundary-rights position — cleaner than the Palau ODbL layer — and the source lineage runs directly through the FSM Division of Statistics and SPC SDD.

The layer carries exactly the four states (`shapeName` Yap, Chuuk, Pohnpei, Kosrae) and joins the census one-to-one with no spelling concordance needed. Small-island completeness holds despite FSM scattering across roughly 2,700 km of ocean (the Tonga bbox trap, acute here). The four state polygons span longitude 137.49 E (Yap's western outer islands) to 163.04 E (Kosrae) and latitude 1.03 N to 10.09 N; Pohnpei's polygon reaches down to 1.03 N, capturing the far-southern Polynesian outlier atolls Kapingamarangi and Nukuoro, and Yap's polygon reaches west past Ulithi and Ngulu. A naive bounding box drawn around the four main high islands would drop those outer atolls; the geoBoundaries layer and the census municipality tables both carry them, so the build must verify no state's outliers fall outside the frame. FSM lies wholly between 137 E and 164 E, well east of the antimeridian, so no dateline handling is needed (verified: country bbox does not cross 180).

## Licence position

No reuse licence is stated on the published religion tables in any wave. The four 2000 state reports carry an acknowledgement page but no copyright, rights-reserved, or Creative Commons statement in their front matter. The 2010 and 2023 Basic Tabulation/Basic Tables workbooks are published on stats.gov.fm with no per-file licence, and a `stats.gov.fm/terms-of-use` page returns 404. This mirrors the Palau precedent: there is no verbatim byte-matched reuse-licence quote to pin on the religion tables, because no such licence text exists. The Pacific Data Hub microdata records ([catalog/9](https://microdata.pacificdata.org/index.php/catalog/9), catalog/109, catalog/806) are restricted — "Signing of a confidentiality declaration is required", governed by FSM Public Law 5-77 (Statistics and Census Act 1988) — but the build does not touch microdata, so those restrictions do not bind the product (the Nauru reasoning); they are recorded only to explain why the microdata route is closed. The one clean licence in the chain is the boundary: geoBoundaries FSM ADM1 is CC BY 3.0 IGO, byte-matched above.

The recommended position mirrors Côte d'Ivoire, Iran, and Palau: publish derived four-state religion summaries with attribution to the FSM Statistics Division (and to SPC SDD for the 2000 reports) under the project's summaries-not-raw-data stance, record the tables' licence as unknown, and defer to a PI ruling. An FSM Statistics Division reuse-confirmation email is the clean unblock.

## Retrieval record

Every cached input is under `data/raw/fm_census/`, which `git check-ignore -v` confirms is excluded by `.gitignore:120` through the `data/` rule. Retrieval occurred on 2026-07-11.

| Cached input | Source URL | Hosting | SHA-256 |
| --- | --- | --- | --- |
| `fm_2000_kosrae.pdf` | <https://fsm-data.sprep.org/system/files/FSM-2000-Census-Kosrae.pdf> | SPREP FSM data portal (SPC/SDD state report) | `9db2e9e44f7005be507c2e8eaf265d8ff8ed1e8592b7900b90ba9c0ff127341e` |
| `fm_2000_yap.pdf` | <https://pacificweb.org/wp-content/uploads/2018/05/2000-Yap-Census-Report_Final.pdf> | pacificweb.org mirror (SPC/SDD state report) | `ddedd974355483fe66762c6be8d0a126609e94882f39a4addda4f201e7961846` |
| `fm_2000_chuuk.pdf` | <https://pacificweb.org/wp-content/uploads/2018/05/2000-Chuuk-Census-Report_Final.pdf> | pacificweb.org mirror (SPC/SDD state report) | `8e8c6c9fecf3f590a96b055bdd347d105f695a7a93c3665c0821a9b5aa94f285` |
| `fm_2000_pohnpei.pdf` | <https://www.pacificweb.org/DOCS/fsm/2000PohnpeiCensus/2000%20Pohnpei%20Census%20Report_Final.pdf> | pacificweb.org mirror (SPC/SDD state report) | `16511178a11cb433073b90eaa2bd9ab4f3dc375acc0faa13ec9f2eed9f1966c5` |
| `fm_2010_basic_tabulation.xlsx` | <https://stats.gov.fm/download/18/population-statistics/600/fsm-basic-tabulation-2010-census-of-population-and-housing.xlsx> | official (FSM Statistics Division) | `04b2159db8bf586184f1a7400a6a2ca8c72cf295324f810e2c8ee9ac5a0df576` |
| `fm_2023_basic_tables.xlsx` | <https://stats.gov.fm/download/18/population-statistics/2210/fsm-basic-tables-2023-population-housing-census.xlsx> | official (FSM Statistics Division) | `13da2c231a41ee99d66536cf1d8049efb2bcf20d613ad4c6c4f673652d79cf99` |
| `fm_2023_factsheet.pdf` | <https://stats.gov.fm/download/74/2023-phc-ig-and-tables/2108/2023-fsm-census-factsheet.pdf> | official (FSM Statistics Division) | `40fcf53716f7dcbf861e7a45ca8fc659165c5b12ced0555acca8a34d4c63bc60` |
| `geoBoundaries-FSM-ADM1.geojson` | <https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/FSM/ADM1/geoBoundaries-FSM-ADM1.geojson> | geoBoundaries gbOpen (pinned 9469f09) | `a30e5bc26f291a7f286090782361154263ad603e4de451b23a77e346f63327e0` |
| `gb_fsm_adm1_meta.json` | <https://www.geoboundaries.org/api/current/gbOpen/FSM/ADM1/> | geoBoundaries API | `78d5a90d6ca5947142b2d70cc01cf22fc275d13439edd70b2488b797e2dfb0c2` |

Derived working files also present in the cache (not source objects): `fm_2000_{kosrae,yap,chuuk,pohnpei}.txt` and `fm_2023_factsheet.txt` (pdftotext extractions).

## Earlier waves

Religion was asked in the 1973 (Trust Territory), 1994, and 2000 FSM censuses, and the 2000 state reports print the 1973/1994/2000 comparison at state level (Table 7.1, percentages) and 1994/2000 at municipality level (Table 7.2). The 1994 and 1973 waves are therefore a documented deeper-history route in percentages, not counts, and on the older Trust Territory geography for 1973; extending the series before 2000 is a future-research route needing the 1994 and 1973 count tables located and their frames reconciled. The build ships the three modern count-valued waves (2000, 2010, 2023).

## Blockers

- **Licence**: no stated reuse terms on the published religion tables in any wave (the Palau vacuum). This is the one genuine gate. Resolve by PI ruling (summaries-with-attribution) or an FSM Statistics Division reuse-confirmation email. The boundary licence (CC BY 3.0 IGO) is clean and needs no ruling.
- **2023 suppression and total**: the 2023 Table B6 asterisk-suppresses small state cells and its printed FSM total (75,817) is one below the sum of the printed state totals (75,818). Both are disclosed and flagged, never imputed or repaired.
- **Frame widening**: the 2000 eight-category frame folds Assembly of God, Apostolic, Pentecostal, and Jehovah's Witness into "Other Religion"; denomination change for those bodies is limited to the 2010-2023 pair. The broad-affiliation spine (Roman Catholic, Congregation/Protestant, SDA, Baptist, Mormon, Other, No religion/Refused) is comparable across all three waves.
- **2000 transcription**: the 2000 counts sit in the appendix marital-status-and-religion tables of four separate PDF reports and extract as text (verified), but the build must transcribe and reconcile the eight religion rows per state (and Chuuk spans four continuation pages, B10a-d), rather than parse a single workbook. 2010 and 2023 are single machine-readable workbooks.

## Product boundary

A build on this probe would stage four-state religious-affiliation summaries for 2000 (all-ages, from the state-report appendix Table B10/B10a-d), 2010 (all-ages, Table B09), and 2023 (all-ages, Table B6) on the geoBoundaries FSM ADM1 frame, with a broad-affiliation change layer readable across all three waves and a finer denomination view for the matched 2010-2023 pair. It would carry the 2023 documented discrepancies (one-person total gap; asterisk cell-suppression) on the information surfaces. It would not contain a place-of-worship layer, place-density metrics, a municipality-level layer (available in 2000 but not verified as public for 2010/2023), or a pre-2000 wave. The FSM Statistics Division licence confirmation is the clean unblock, and the 1994/1973 percentage tables are the recorded route to deepen the series.
