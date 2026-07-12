# Moldova census-religion route probe

Verified 2026-07-12. Verdict: **BUILDABLE**. Moldova asked religion in **three** post-Soviet censuses — 2004, 2014, and 2024 — and the National Bureau of Statistics (Biroul Naţional de Statistică, BNS, `statistica.gov.md`) publishes a **count-valued religion-by-raion table for every wave**. The queue premise ("national/raion to confirm; religion path not exposed in first API pass; probe subnational route; retain national context") resolves to the strong reading: religion is published at raion/municipality grain for all three waves, on one stable 35-unit right-bank frame, from downloadable census-results tables (not the Statbank PxWeb API the first pass probed). The 2024 wave is released — the final "ethnocultural characteristics" annex (published October 2025) carries the region-and-raion religion cross-tab (tables 5.29 counts, 5.30 shares). Each wave reconciles: the 2024 raion table's 35 units sum exactly to the published national total (2,409,207) and to the published Orthodox national count (2,271,105). The licence is clean (Creative Commons Attribution 4.0). The boundary is geoBoundaries MDA ADM1 (37 units, CC BY 3.0 IGO); the 35 enumerated census units map to it one-to-one, and the two extra polygons are precisely the two the census excludes — Transnistria (stânga Nistrului) and Bender — carried under the render-the-record precedent (Georgia). This ships a three-wave, 35-unit, raion-level religious-affiliation product.

## Build decision (recommendation to the conductor)

- **Recommendation: BUILD** a three-wave raion/municipality-level religious-affiliation product (2004, 2014, 2024) on the geoBoundaries MDA ADM1 frame. Three census waves, count-valued at raion grain, exact-margin reconciliation, a licensed boundary, and a clean open licence with attribution.
- **Licence: ACCEPTED, no ask needed.** The BNS Terms of use of data place website content and data reuse under Creative Commons Attribution 4.0 International, quoted verbatim below. Attribution is "National Bureau of Statistics of the Republic of Moldova".
- **Waves and sources**:
  - **2004**: 2004 Population Census, Volume I (edition 2006), Table **5.2 "Populaţia după religie, în profil teritorial"** (Population by religion, in territorial aspect). 35 territorial rows, 15 named confessions + Atei + Fără religie + Nedeclarată, integer full-count. National total 3,383,332. Text-extractable PDF (`pdftotext -layout`).
  - **2014**: RPL2014 results table "Caracteristici - Populaţie 2", sheet **2.1 "Populaţia după religie, în profil teritorial"** (XLS, trilingual RO/RU/EN). 35 territorial rows, 14 named confessions + Agnostic + Ateu + not-declared, integer counts. Enumerated population 2,804,801; declared religion 2,611,759; not declared 193,042.
  - **2024**: RPL2024 final ethnocultural results, annex tables **5.29** (counts) and **5.30** (shares) "Populaţia după afilierea religioasă pe regiuni de dezvoltare şi raioane/municipii" (XLSX). 35 territorial rows, 14 named confessions + Liber cugetător + Agnostic + Ateu + Fără religie + not-declared, integer counts. National total 2,409,207.
- **Geography**: 35 census units (Mun. Chişinău, Mun. Bălţi, 32 raions, U.T.A. Găgăuzia) on geoBoundaries MDA ADM1 (37 units, CC BY 3.0 IGO). The two non-census polygons (Transnistria, Bender) carry no census religion (not enumerated).
- **Construct**: census affiliation — each enumerated resident's declared religion, asked of the whole enumerated population, not practice, attendance, or membership. Not-declared is a real non-response slot inside the denominator.

## Published waves and geography

| Year | Official route | Religion-by-raion table | Universe | Territorial units | Decision |
| --- | --- | --- | --- | --- | --- |
| 2004 | [2004 Census Vol I (ZIP → PDF)](https://statistica.gov.md/files/files/publicatii_electronice/Recensamint/recensamint_2004_vol.I.zip) | Table 5.2 (unit × 15 religions + Atei + Fără religie + Nedeclarată) | resident population, all ages, right bank only | 35 (2 mun. + 32 raions + Găgăuzia) | Ship the 2004 wave. |
| 2014 | [RPL2014 "Caracteristici - Populaţie 2" (XLS)](https://statistica.gov.md/public/files/Recensamint/Recensamint_pop_2014/Rezultate/Tabele/Caracteristici_populatie_Comune_RPL_2014_rom_rus_eng.xls) | Sheet 2.1 (unit × 14 religions + Agnostic + Ateu + not-declared) | enumerated population, all ages, right bank only | 35 | Ship the 2014 wave. |
| 2024 | [RPL2024 ethnocultural annex (XLSX)](https://statistica.gov.md/files/files/ComPresa/Recensamant/2024/Ro/Anexa_Caracteristici_Etnoculturale_RPL2024.xlsx) | Tables 5.29 (counts) / 5.30 (shares) (unit × 14 religions + Liber cugetător + Agnostic + Ateu + Fără religie + not-declared) | usual-resident population, all ages, right bank only | 35 | Ship the 2024 wave. |

Two source facts govern the routing. The first source fact is that religion lives in the census-results downloads, not the Statbank thematic API. The queue's "religion path not exposed in first API pass" describes the Statbank PxWeb API (`statbank.statistica.md`), which does not surface a census religion cube; the religion cross-tab is published as downloadable census-results tables on the RPL pages (a PDF volume for 2004, an XLS for 2014, an XLSX annex for 2024). The second source fact is that the 2024 religion result is released at raion grain: the final "Caracteristici etnocultural­e" results (page title "Rezultatele finale ale Recensământului Populaţiei şi Locuinţelor 2024", annex file dated 20 October 2025) carry the region-and-raion religion table, contrary to any "if released" hedge.

## Verbatim raion religion tables (per wave; recorded for the reconciliation record)

**2024 — Table 5.29 counts, national and selected rows** (from `Anexa_Caracteristici_Etnoculturale_RPL2024.xlsx`, sheet 5.29). Columns: Total, Ortodoxă, Baptistă, Martorii lui Iehova, Penticostală, Adventistă, Creştină după Evanghelie, Staroveri (Ortodoxă Rusă de rit vechi), Islam, Catolică, Alte religii, Liber cugetător, Agnostic, Ateu, Fără religie, Nu au declarat religia.

| Unit | Total | Ortodoxă | Baptistă | Martorii lui Iehova | ... | Fără religie | Nu au declarat |
| --- | ---: | ---: | ---: | ---: | :---: | ---: | ---: |
| Total (national) | 2409207 | 2271105 | 26226 | 16505 | … | 20051 | 18103 |
| Mun. Chişinău | 720128 | 665659 | 4705 | 3868 | … | 12377 | 8818 |
| Mun. Bălţi | 94546 | 86534 | 1747 | 1062 | … | 1055 | 1438 |
| Briceni | 46894 | 37731 | 549 | 3603 | … | 1495 | 893 |
| Şoldăneşti | 25394 | 25073 | 112 | 54 | … | 11 | 15 |
| U.T.A. Găgăuzia | 103668 | 98537 | 1691 | 193 | … | 399 | 858 |

The 35 unit rows (identified by their `Cod statistic CUATM` codes) sum exactly to the national Total row: 2,409,207; the Orthodox column sums to 2,271,105. Both margins close to the published national figures (verified in the probe; re-checked fail-fast at build time). Şoldăneşti is the highest Orthodox share (98.7%) and Briceni the lowest (80.5%), matching the BNS commentary.

**2014 — Table 2.1 counts, national and selected rows** (from `Caracteristici_populatie_Comune_RPL_2014_rom_rus_eng.xls`, sheet 2.1). Columns: Total populaţie, Populaţia care a declarat religia, then Ortodoxă, Creştină de rit vechi, Catolică, Evanghelică de Confesiune Augustană (Luterană), Creştină Evanghelic Baptistă, Creştină după Evanghelie, Adventistă de Ziua a şaptea, Penticostală, Martorii lui Iehova, Iudaism, Islam, Alte grupări religioase, Agnostic, Ateu, Populaţia care nu a declarat religia.

| Unit | Total pop. | Declared religion | Ortodoxă | ... | Not declared |
| --- | ---: | ---: | ---: | :---: | ---: |
| Total (national) | 2804801 | 2611759 | 2528152 | … | 193042 |
| Mun. Chişinău | 469402 | 422297 | 405555 | … | 47105 |
| Briceni | 70029 | 58067 | 49958 | … | 11962 |
| U.T.A. Găgăuzia | 134535 | 125697 | 122386 | … | 8838 |

The 2014 table splits Total population into "declared religion" and "did not declare religion" and breaks the declared block into 14 named confessions plus Agnostic and Ateu. The not-declared share is large (193,042 of 2,804,801 = 6.9% nationally, up to ~17% in Briceni), a real non-response slot to keep inside the denominator and outside the affiliation numerator (the Guinea-Bissau `ND` precedent).

**2004 — Table 5.2 counts, national and selected rows** (from `Recensamint_2004_vol.I.pdf`, pp. 482–483). Columns: Total, Ortodoxă, Romano-catolică, Reformată, Evanghelică de confesiune augustană, Evanghelică sinodo-prezbiter., Creştină de rit vechi, Baptistă, Penticostală, Adventistă de ziua a şaptea, Creştină după Evanghelie, Musulmană, Alte religii, Atei, Fără religie, Nedeclarată.

| Unit | Total | Ortodoxă | ... | Atei | Fără religie | Nedeclarată |
| --- | ---: | ---: | :---: | ---: | ---: | ---: |
| Republica Moldova | 3383332 | 3158015 | … | 12724 | 33207 | 75727 |
| Municipiul Chişinău | 712218 | 629310 | … | 10477 | 9990 | 44035 |
| Briceni | 78027 | 62181 | … | 132 | 3269 | 3011 |
| U.T.A. Găgăuzia | 155646 | 144780 | … | 270 | 2586 | 2583 |

The 2004 table lists the same 35 right-bank units (2 municipalities, 32 raions, U.T.A. Găgăuzia). Volume I states 93.3% declared Orthodox and describes the tabulation as "repartizarea populaţiei după religie" (distribution of population by religion). Atei and Fără religie are separate slots in 2004.

## Category frames (preserved verbatim per wave; never merged)

The three waves do **not** share one category frame. Each wave is transcribed in its own printed order and labelled by wave; the frame break bars any invented cross-wave category concordance (CHANGE-WITHHOLD, the corpus rule for frame breaks).

Three frame facts govern comparability. The first frame fact is the non-response and no-religion slots. In 2004 the residual block is three separate columns — Atei, Fără religie, Nedeclarată. In 2014 the territorial table carries Agnostic and Ateu as declared-block columns plus a single "did not declare religion" column, with no separate "fără religie" line at raion grain. In 2024 the block is fully split into Liber cugetător, Agnostic, Ateu, Fără religie, and "nu au declarat religia". The no-religion construct is therefore not cell-comparable across the three waves at raion grain, though each wave's own no-religion/atheist slots render as published. The second frame fact is the neo-Protestant detail. All three waves name Baptistă, Penticostală, Adventistă, Creştină după Evanghelie, Martorii lui Iehova / Iudaism / Islam as separate lines, but the exact set and labelling shift (2004 has Reformată and two Evanghelică lines; 2014 adds Iudaism and Martorii lui Iehova as explicit lines; 2024 adds Staroveri as a named line and folds several into "Alte religii"). The third frame fact is the stable spine: the Orthodox share and the aggregate declared-affiliation share are comparable across all three waves, and the great-tradition neo-Protestant families (Baptist, Pentecostal, Adventist, Jehovah's Witnesses) are legible in every wave. The product ships the three waves as levels on this spine, withholding a cross-wave category-by-category change.

## Universe, denominator, and the small-cell rule

Every wave counts the whole enumerated resident population of all ages (religion asked of everyone); no universe break therefore arises in construct. The three national totals differ (3,383,332 in 2004; 2,804,801 in 2014; 2,409,207 in 2024) because the enumerated population falls across the series; shares are read within each unit's own wave denominator and population change is never treated as a religion change. One universe caveat is recorded, not resolved: the 2014 census enumerated-population figure (2,804,801 in this table) is the count actually enumerated, and BNS later published a lower "usual resident population" estimate for 2014 after an audit found over-enumeration; the 2024 table uses "populaţie cu reşedinţă obişnuită" (usual-resident population). The raion religion product reads each wave's shares within that wave's own published denominator and does not reconcile the 2014 enumerated base against the later usual-resident revision.

The small-cell rule (`docs/development/small-cell-rule.md`) applies at the numerator, not the denominator. Every raion total denominator is far above 100 persons (the smallest unit, Basarabeasca 2024, is 14,914); the pale-wash denominator threshold is therefore not triggered at raion grain. Many minority-confession numerator cells are below 10 (single digits or zero, printed as "-" = magnitude zero in 2024/2014); the `small_cell_under_10` marker therefore governs the minority-share popups; the counts render exactly as published, none suppressed, none differenced.

## Territorial scope (render the record)

BNS has enumerated only the right bank (territory under central-government control) in every post-Soviet census; the Transnistrian region conducts its own separate censuses. The record's own coverage, rendered as published:

- **2004**: Volume I states the census was carried out "fără raioanele de Est şi mun. Bender" / "without eastern counties and Bender municipality". Table 5.2 covers the 35 right-bank units.
- **2014**: the territorial table covers the same 35 right-bank units; the enumerated-persons universe excludes the left bank.
- **2024**: the annex footnote states verbatim: "Datele se referă doar la UAT efectiv recenzate şi nu includ unităţile administrativ-teritoriale din stânga Nistrului, municipiului Bender (inclusiv satul Proteagailovca), comuna Chiţcani (inclusiv satele Merenești şi Zahorna), satele Cremenciug şi Gîsca din raionul Căuşeni, comuna Corjova (inclusiv satul Mahala) din raionul Dubăsari, precum şi satul Roghi din cadrul comunei Molovata Nouă, raionul Dubăsari."

Two consequences follow for the boundary join. First, the two left-bank ADM1 polygons — geoBoundaries "Transnistria" and "Bender" — carry no census religion in any wave; they render with a prominent per-feature flag that the central-government census does not enumerate them, taking no position on their status (the Georgia Abkhazia/South Ossetia precedent). Second, the 2024 footnote lists Transnistrian-controlled localities inside two otherwise-enumerated right-bank raions (Cremenciug and Gîsca in Căuşeni; Corjova, Mahala, Roghi in Dubăsari); the Căuşeni and Dubăsari raion figures therefore describe the enumerated part of a polygon drawn to the full administrative extent, disclosed on those two features' flags (the Georgia Shida Kartli disclosure precedent). No count is invented for any non-enumerated area.

## Boundary source and licence

The boundary is [geoBoundaries MDA ADM1](https://www.geoboundaries.org/api/current/gbOpen/MDA/ADM1/) (`gbOpen`, pinned commit `9469f09`). The release metadata records `"boundaryType": "ADM1"`, `"admUnitCount": "37"`, `"boundaryYearRepresented": "2020"`, `"boundarySource": "UNHCR, OCHA FISS"`, and — the load-bearing field, verbatim — `"boundaryLicense": "Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO)"`, `"licenseSource": "data.humdata.org/dataset/moldova-administrative-level-0-1-boundaries"`. The licence is non-null (the Georgia CC BY precedent). The 37 `shapeName` values are the 32 raions, the two municipalities (Chisinau, Balti), Gagauzia, plus Transnistria and Bender. The 35 census units match 35 of the 37 one-to-one after diacritic normalisation (RIscani→Rîşcani, SIngerei→Sîngerei, Soldanesti→Şoldăneşti, Stefan Voda→Ştefan Vodă, Falesti→Făleşti, etc.); Transnistria and Bender are the two non-census polygons. One boundary set serves all three waves (the raion/municipality frame is stable across 2004–2024). OCHA COD-AB is the same underlying source (the metadata `licenseSource` points at the HDX Moldova admin-boundaries dataset); no second provider is needed.

## Licence position (accepted)

The BNS "Terms of use of data" (`statistica.gov.md/en/terms-and-conditions-139_4417.html`, retrieved 2026-07-12, captured `terms_en.html`) state verbatim:

> "Reusing the content of this website, completely or partly, in original or modified, as well as its storage in a retrieval system, or transmitted, in any form and by any means, unless otherwise stated, will be made under the license Creative Commons Attribution 4.0 International License According to this license you are free to: copy and redistribute the material in any medium or format; remix, transform, and build upon the material; use it for commercial and non-commercial purposes. Following this rules: you must clearly indicate the source of information and the link to the material; you must indicate if you modified the material."

The attribution example given on the same page is "Source: National Bureau of Statistics of the Republic of Moldova". This is an open reuse licence conditioned only on source attribution and a modification notice: `licence_status: accepted`, `licence_basis: bns_cc_by_4_0`, required attribution "National Bureau of Statistics of the Republic of Moldova". No courtesy ask is needed. The boundary is CC BY 3.0 IGO.

## Premise corrections (trust the record)

- **Religion is published at raion grain for all three waves, not "national/raion to confirm".** The 2004 Vol I Table 5.2, the 2014 table 2.1, and the 2024 annex tables 5.29/5.30 each give a count-valued religion-by-raion cross-tab over the same 35-unit right-bank frame. The queue's "retain national context" is exceeded: the subnational route is the primary product, and national totals reconcile it.
- **"Religion path not exposed in first API pass" describes the Statbank API, not the census results.** The Statbank PxWeb API does not carry a census religion cube; the religion cross-tab is a downloadable census-results table (PDF/XLS/XLSX) on the RPL pages. The route is a direct download plus one XLS→XLSX conversion (LibreOffice) and one PDF text extraction (`pdftotext -layout`); no human-verification challenge was encountered.
- **The 2024 wave is released at raion grain.** The final ethnocultural results (annex dated 20 October 2025) publish religion by region and raion; this is a three-wave product.
- **This is a three-wave, not two-wave, product.** The queue's "2004-2024" span holds fully: 2004, 2014, and 2024 each ship at raion grain.

## Retrieval record

Every input was retrieved 2026-07-12 to a session scratchpad (not committed; this lane's only repository write is this probe file). Content type was verified on each download.

| Cached input | Source URL | Format | SHA-256 |
| --- | --- | --- | --- |
| `Anexa_Caracteristici_Etnoculturale_RPL2024.xlsx` | <https://statistica.gov.md/files/files/ComPresa/Recensamant/2024/Ro/Anexa_Caracteristici_Etnoculturale_RPL2024.xlsx> | xlsx | `a84bac831db56553107f4721b21e0085e7db81cc97757b364fd68857c8b28a4f` |
| `Caracteristici_populatie_Comune_RPL_2014_rom_rus_eng.xls` | <https://statistica.gov.md/public/files/Recensamint/Recensamint_pop_2014/Rezultate/Tabele/Caracteristici_populatie_Comune_RPL_2014_rom_rus_eng.xls> | xls | `c69138b33cd4f4a550e8f8c686c4c7e60d2560b62239518f9b17ef4ffa7cbd4b` |
| `Recensamint_2004_vol.I.pdf` (from `recensamint_2004_vol.I.zip`) | <https://statistica.gov.md/files/files/publicatii_electronice/Recensamint/recensamint_2004_vol.I.zip> | pdf | `1aabbfbd8efa43f5313b0c9a60544042a2e3213962221aa04efe405dab8d1105` |
| `geoBoundaries-MDA-ADM1.geojson` | <https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/MDA/ADM1/geoBoundaries-MDA-ADM1.geojson> | geojson | `2358d3f23e7199eb8296d8859c09640c4db9f0a9cef31a429708015ee0aea9b6` |
| `terms_en.html` (BNS licence source) | <https://statistica.gov.md/en/terms-and-conditions-139_4417.html> | html | `5138870fe90cc3fedb2b7335c665bb23703b93b4f82e81f7b74eb536651c21af` |

Also fetched (context, not build inputs): the 2024 preliminary and final results landing pages (`statistica.gov.md/ro/rezultatele-finale-ale-recensamantului-populatiei-si-locuintelor-2024-caracteris-10121_62043.html`), the 2014 results pages (`statistica.gov.md/ro/recensamantul-populatiei-si-al-locuintelor-2014-122.html`, `old.statistica.md/pageview.php?l=en&idc=479`), the 2004 census landing page, `Date_Comunicat_Etnoculturale_20_10_25.xlsx` (the 2024 press-release extract, national and residence-medium), and the geoBoundaries MDA ADM2 API (returns HTTP 404 — ADM1 is the raion level for Moldova, and no ADM2 is needed).

## Blockers and held items

- **Licence**: accepted (CC BY 4.0 with attribution; boundary CC BY 3.0 IGO); no ask, no block.
- **Category frame breaks** (documented, not a block): 2004/2014/2024 do not share one religion frame; the product ships as levels on the Orthodox-plus-neo-Protestant spine, withholding cross-wave category change.
- **Territorial scope** (documented, not a block): Transnistria and Bender are not enumerated in any wave; their ADM1 polygons carry no census religion (flagged); Căuşeni and Dubăsari raions are enumerated only in their central-government-controlled parts (flagged). Rendered as published, no coverage invented.
- **2014 universe caveat** (documented, not a block): the 2014 enumerated-population base differs from BNS's later usual-resident revision; each wave's shares are read within that wave's own published denominator.
- **Small cells** (documented, not a block): raion denominators clear the 100-person wash threshold; minority-confession numerator cells below 10 carry the `small_cell_under_10` marker; no value suppressed or differenced.
