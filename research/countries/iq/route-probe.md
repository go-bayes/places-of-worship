# Iraq census-religion route probe

Verified 2026-07-12. PROBE ONLY — no build. **Verdict: HELD on two independent gates — no published religion table at any grain, and a consent-first licence — with a prominent SENSITIVITY flag.** Iraq's 2024 General Population and Housing Census (Central Statistical Organization / Commission of Statistics and GIS, with the Kurdistan Region Statistics Office for the KRI) did record **broad religion** on the enumeration form: five verbatim categories — Muslim, Christian, Sabei (Sabean-Mandaean), Yazidi, and Other (Specify), with no sect and no ethnicity. That much of the queue premise is confirmed. But the released results — preliminary (25 November 2024) and final (24 February 2025) — publish **no religion table at all**, at any geography, national or governorate. The final aggregate-tables publication carries only service, demographic, marital-status, education, and dependency indicators by governorate. So religion was collected and has not been published in any form as of today. Layered on top of the data-grain gate is a hard licence gate: the final-results publication asserts exclusive government ownership, restricts all use to an "officially adopted publication and access policy", and threatens legal prosecution for non-compliant use (verbatim below). This is a consent-first licence, not open and not build-then-ask. The boundary is the one clean edge: geoBoundaries IRQ ADM1 (18 units, CC0 1.0 public domain). The single genuine unblock is a CSO/KRSO data-and-reuse request under the publication-and-access policy for a religion-by-governorate tabulation; both the data grain and the licence route through that one channel.

**VERDICT: HELD (data grain + licence). SENSITIVITY FLAG: ON (minority religions politically salient; disputed territories; the census itself excluded sect and ethnicity for these reasons; the Myanmar sensitive-page discipline applies). LICENCE (census): consent-first — exclusive ownership, restricted access policy, legal-prosecution clause; NOT open. LICENCE (boundary): CC0 1.0, accepted. QUEUE PREMISE: partly confirmed (broad religion recorded), but "probe then build" is not achievable now.**

## Sensitivity (read first — the Myanmar discipline governs any future work here)

Religion figures in Iraq are politically salient for minority populations, and the census itself is built around that salience. The 2024 form deliberately **excluded sect (المذهب, Sunni/Shia) and ethnicity/nationalism (القومية, Arab/Kurd/Turkmen)** under a pre-agreed political settlement and a Federal Supreme Court ruling; the KRSO briefing records that the design "will rule out any chance of determining the ethnic origins of Iraqi citizens due to politically pre-agreed-upon criteria", and that officials feared the data could "compromise the estimates of Iraq's Shiite Muslim" majority and inflame the Kirkuk and disputed-territories dispute. Broad religion (Muslim/Christian/Sabean-Mandaean/Yazidi/Other) was retained, but even that is sensitive: the Sabean-Mandaean and Yazidi populations are small, geographically concentrated, and were targets of genocide and displacement within living memory (Yazidis in Sinjar, 2014). A governorate religion map would expose exactly the minority-concentration signal that the state chose not to publish. Any future Iraq religion product must ship under the **Myanmar sensitive-page discipline** — STAGED, held for the PI's eyes, disclosure of the collection-versus-publication gap and the disputed-territories caveat on every surface — regardless of how the licence and data gates resolve. This flag is not downstream of the licence; it stands on its own.

## Premise check (the record partly confirms and partly refutes the queue row)

The queue row 110 reads: `Iraq (IQ) | 2024 | governorate | broad census religion | browser work | probe then build`. The record splits the premise.

**Confirmed — broad religion was recorded.** The 2024 enumeration questionnaire (English and Arabic official forms, cached and hashed below) carries a "Religion / الديانة" field in section 2 (Characteristics of household's individuals) with exactly five printed codes: `1. Muslim  2. Christian  3. Sabei  4. Yazidi  5. Other (Specify)`. No sect line, no "no religion" line. This is the "broad census religion" the queue names, and the queue is right that it exists on the instrument.

**Refuted — nothing religion-related was published, at any grain.** The final-results publication "المؤشرات الأساسية وجداول البيانات الإجمالية / Key indicators and aggregate data tables, First Edition, February 2025" (Commission of Statistics and GIS) tabulates governorate results for services, age structure, dependency ratios, marital status, education, employment sector, migration, water source, electricity source, and building/dwelling stock — and **no religion**. The 36 MB detailed results report is a settlement-level population gazetteer (village and neighbourhood names with counts) and carries no religion cross-tab either. The Arabic Wikipedia summary, the CSO Annual Abstract Section 2 (Population Census), and every fetched result product agree: religion appears on no published table. The queue's "governorate | browser work | probe then build" therefore cannot execute — the governorate religion table the queue assumes to exist has not been released.

## Released waves, geography, and grain

| Wave | Religion asked? | Religion published? | Finest published geography for religion | Universe | Source |
| --- | --- | --- | --- | --- | --- |
| 2024 (10th census; first since 1997) | Yes — 5 broad categories on the form | **No — no religion table at any level** | none | de jure, all persons resident in Iraq | Enumeration Questionnaire (EN/AR); Final Results aggregate-tables publication (services/demographics only) |
| 1997 (9th census) | Yes — religion (broad, no sect) | Not openly; CSO exposes 1997 only by urban/rural "Social Origin" | none openly | de jure, **15 of 18 governorates** (Kurdistan excluded) | CSO AAS Section 2 (1997 tables are urban/rural, not religion) |
| 1987 and earlier | Historically recorded religion | Not located openly | — | full 18 governorates (1987) | not retrieved |

Preliminary 2024 results were announced ~25 November 2024 (≈45.4 million); final results on 24 February 2025 (total 46,118,793; excluding foreign residents 45,778,662). Neither release carried religion.

## The 2024 religion frame (verbatim, from the enumeration form — for the record, not a build input)

The "Religion / الديانة" field, section 2 of the questionnaire, five codes exactly as printed:

`1. Muslim   2. Christian   3. Sabei   4. Yazidi   5. Other (Specify)`

("Sabei" is the Sabean-Mandaean community.) No sect subdivision, no explicit "no religion" or "not stated" code. The adjacent "Nationality / الجنسية" field records citizenship (`1. Iraqi  2. Iraqi with another nationality  3. Not Iraqi  4. No official document  5. Unknown`), not ethnicity — ethnicity (القومية) is absent from the instrument entirely. This confirms the "broad religion only" characterisation in the brief.

## The 1997 census (older-source check)

The 1997 census did ask religion. Contemporary reporting is consistent that Ba'ath-era Iraqi censuses "always excluded 'sect', although religion and ethnicity were included". Two facts block it as a route. First, coverage: the 1997 census **excluded the three Kurdistan governorates (Erbil, Sulaymaniyah, Dohuk)** and enumerated only 15 of the then-18 governorates (~22 million; a separate count put the northern governorates at ~2.8 million). A 1997 religion map would be missing the Kurdistan region by construction. Second, retrievability: the CSO Annual Abstract of Statistics, Section 2 (Population Census) publishes 1997 tables **only by "Social Origin"** — the Iraqi statistical term for urban/rural (حضر/ريف) residence, not religion. No 1997 religion-by-governorate tabulation is published on cosit.gov.iq or located in any open mirror. The 1997 religion returns, if they survive, sit in restricted Ba'ath-era archives, not the open record. 1997 is not a route.

## Licence position (census: consent-first; boundary: CC0, accepted)

The census carries an explicit restrictive-use statement — this is the load-bearing licence finding and it forecloses open reuse. From the Final Results aggregate-tables publication, page "الخصوصية والمسؤولية القانونية" (Privacy and Legal Responsibility), fetched 2026-07-12 (cached `iraq_results_for_publication.pdf`, sha256 `5510ff96e06001d20a693140d2e5c0894cd3810879dc6479fa74d1d893f2c009`). Verbatim (Arabic; the `pdftotext` extraction merges the definite article لا/ال in a few tokens — the standard-orthography text is given, and the plain-English gloss follows):

> «البيانات والمؤشرات المتضمنة هي محمية بموجب القانون العراقي، وتكون ملكيتها حصراً لهيأة الإحصاء ونظم المعلومات الجغرافية ووزارة التخطيط العراقية ولا يجوز تداولها ولا إستخدامها إلا وفقاً لسياسة النشر والاتاحة المعتمدة رسمياً، وأي استخدام مخالف للسياسة المعتمدة تعرض المستخدم للملاحقة القانونية.»

> «أي وحدات ادارية مستخدمة في النتائج تعبر عن الأبعاد لأغراض إحصائية فقط ولا تعبر عن الحدود الإدارية الرسمية ولا يمكن إستخدامها لأغراض التبعية أو الملكية أو أي أغراض أخرى تختلف عن الأغراض الإحصائية والأعمال التنفيذية والميدانية لأنشطة وأعمال التعداد.»

Plain-English gloss:

> "The included data and indicators are protected under Iraqi law; their ownership belongs exclusively to the Commission of Statistics and Geographic Information Systems and the Iraqi Ministry of Planning; and they may not be circulated or used except in accordance with the officially adopted publication-and-access policy. Any use contrary to the adopted policy exposes the user to legal prosecution."

> "Any administrative units used in the results express dimensions for statistical purposes only, do not express the official administrative boundaries, and may not be used for purposes of jurisdiction/affiliation, ownership, or any purpose other than the statistical, executive, and field work of the census."

This is a **consent-first** posture: all rights reserved, exclusive state ownership, use gated to an "officially adopted publication-and-access policy" (سياسة النشر والاتاحة), with an explicit legal-prosecution clause. It is stronger than the bare-copyright vacuum of Myanmar/Suriname (which the project treats as build-then-ask with attribution) — Iraq names a policy the user must comply with and threatens prosecution. Reuse requires an approved request under that policy; a build cannot proceed on a build-then-ask reading. `licence_status: consent-first`. The second bullet — the administrative-units disclaimer — is itself a disputed-territories signal: the state refuses to let census geography carry any jurisdictional meaning.

The **CSO website footer** (cosit.gov.iq, fetched 2026-07-12, cached `cosit_cosit.gov.iq.html`) asserts only a site-design copyright ("حقوق تصميم وتنفيذ الموقع محفوظة @ قسم المواقع والخدمات الالكترونية / هيأة الاحصاء ونظم المعلومات الجغرافية" — design-and-implementation rights of the website reserved), which does not soften the data statement above; the publication's legal clause governs the data.

## Boundary route (clean; the one accepted edge)

geoBoundaries IRQ ADM1 (metadata fetched 2026-07-12, cached `gb_irq_adm1_meta.json`, sha256 `fe6cb2db279606cbbb073af3f73693fa0e3f6798e93ec15f41ae6cdf794b487b`) records, verbatim: `boundaryType` "ADM1", `admUnitCount` "18", `boundaryYearRepresented` "2022", `boundarySource` "geoBoundaries, Wikimedia Commons", `boundaryLicense` **"CC0 1.0 Universal (CC0 1.0) Public Domain Dedication"**, `licenseSource` "creativecommons.org/publicdomain/zero/1.0/deed.en", `gjDownloadURL` pinned at commit `9469f09`. CC0 is the cleanest possible boundary licence (public-domain dedication; no attribution obligation). The 18 shapeNames are Al-Anbar, Al-Basrah, Al-Muthanna, Al-Qadisiyah, Al-Sulaimaniyah, An-Najaf, Babil, Baghdad, Dhi Qar, Diyala, Dohuk, Erbil, Karbala, Kirkuk, Maysan, Ninawa, Salah al-Din, Wasit.

**Frame-match caveat (18 vs 19).** Iraq's governorate count is contested at the margin: **Halabja** was split from Sulaymaniyah in 2014 and recognised by the federal government in 2025, making 19 governorates de jure. The geoBoundaries 2022 vintage folds Halabja into Al-Sulaimaniyah (18 units). Some 2024 census reporting gives Sulaymaniyah and Halabja **combined** (2,401,724), other reporting treats Halabja separately. Whether the census frame publishes 18 or 19 governorate rows for religion (if ever released) is unknown until a religion table exists; at build time the boundary must be matched to the released frame — either the 18-unit CC0 layer as-is (Halabja folded into Sulaymaniyah, an exact complete-unit fold if the census reports the two combined), or a 19-unit official/OCHA layer split out. OCHA COD-AB (source likely Iraqi government via HDX) is the alternative if a 19-unit frame is needed. The Kurdistan-region governorates (Erbil, Sulaymaniyah, Dohuk, and Halabja) were enumerated by KRSO and integrated into the national total (KRI total 6,519,129); disputed territories (Kirkuk as its own governorate; contested areas of Ninawa/Nineveh, Diyala, Salah al-Din) were counted within their existing governorate frames, and the state's administrative-units disclaimer (above) exists precisely to strip jurisdictional meaning from those lines.

## Why a build is blocked

A governorate religious-affiliation product needs a published religion-by-governorate table under a licence that permits derived reuse. The open record supplies **neither**. Religion was collected (five broad categories) but published nowhere, at no grain; and the licence on the one released results product is consent-first with a prosecution clause. RENDER THE RECORD forbids inventing or backcasting the missing cells (no allocation of pre-census religion estimates across governorates), and there is no published margin to reconcile against. Both gates route to the same door: an approved CSO/KRSO request under the publication-and-access policy. This is the HELD.

## Dead ends searched (so the next probe does not repeat them)

- **CSO Annual Abstract, Section 2 (Population Census)** (`cosit.gov.iq/AAS/section_2.php`): sixteen tables inventoried; every 1997/2009/2011 table is by "Social Origin" (urban/rural), gender, and governorate — none by religion. No religion table for any census year.
- **Final Results aggregate-tables publication** (`نتائج العراق للنشر.pdf`): full governorate table set — services, ages, dependency, marital status, education, employment, migration, water, electricity, buildings — grepped for religion tokens (الديانة/مسلم/مسيحي/صابئ/ايزيدي); the only hits are false positives inside the governorate name صلاح الدين (Salah al-Din). No religion table.
- **Detailed results report** (`تقرير نتائج تعداد 2024.pdf`, 36 MB, 417k extracted lines): a settlement gazetteer (village/neighbourhood names with population); religion tokens appear only inside village names (e.g. قرية بني مسلم). No religion cross-tab.
- **KRSO / innov8.krd 2024 census briefing**: confirms the sect-and-ethnicity exclusion and the political sensitivity, but publishes no religion table.
- **1997 religion-by-governorate**: not published openly; the CSO exposes 1997 only by urban/rural; Kurdistan excluded from the 1997 frame. Not retrievable.
- **cosit.gov.iq/en/**: returns HTTP 404 (no English mirror of the portal); the Arabic Joomla site is the portal of record.

## Retrieval record

All inputs retrieved 2026-07-12 into `data/raw/iq_census/`, confirmed git-ignored by `.gitignore:120` (the `data/` rule). Content type verified on each object.

| Cached input | Source URL | SHA-256 | Bytes | Role |
| --- | --- | --- | --- | --- |
| `enum_questionnaire_en.pdf` | https://www.cosit.gov.iq/images/census2024/Enumeration%20Questionnaire%20English%20copy.pdf | `80ff1e91cb3ab8cab2e3b6ca7c55f8f836dc647bad36b414f2e6b937e73e4c16` | 589684 | 2024 form (EN) — Religion field, 5 codes |
| `enum_questionnaire_ar.pdf` | https://www.cosit.gov.iq/images/census2024/استمارة%20العد%20عربي.pdf | `315a17f1a1d44f426493dfb649e653b3b0abaa23f9b136bc9f037abbd48d0982` | 665978 | 2024 form (AR) — الديانة field |
| `iraq_results_for_publication.pdf` | https://www.cosit.gov.iq/images/census2024/نتائج%20العراق%20للنشر.pdf | `5510ff96e06001d20a693140d2e5c0894cd3810879dc6479fa74d1d893f2c009` | 3965190 | Final Results aggregate tables — **licence statement**; no religion table |
| `results_report_2024.pdf` | https://www.cosit.gov.iq/images/census2024/تقرير%20نتائج%20تعداد%202024.pdf | `0f3bba10ad79dbc3c6add02c67f55d76363f9be52417e46cb72046e1565e5aa7` | 36060920 | Detailed settlement gazetteer; no religion table |
| `kamil_complete.pdf` | https://www.cosit.gov.iq/images/census2024/كامل.pdf | `7b4915ea512a209725ff1edaf4f17bcade36085ff8515b5a744df78851faa2e6` | 1531184 | Results extract; no religion table |
| `innov8_2024_census.pdf` | https://innov8.krd//wp-content/uploads/2025/01/THE-2024-GENERAL-POPULATION-CENSUS-IN-IRAQ.pdf | `db6ac885f32825fb64d47d5288040c1ce5defed9d049c800d734c3070779b326` | 625766 | KRSO-context briefing (sect/ethnicity exclusion, sensitivity) |
| `geoBoundaries-IRQ-ADM1.geojson` | https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/IRQ/ADM1/geoBoundaries-IRQ-ADM1.geojson | `2c2adabbc814727b8bdd669feed6efab3b9a27bdc76cea35e036532084eb41d8` | 184128 | Boundary, 18 units |
| `gb_irq_adm1_meta.json` | https://www.geoboundaries.org/api/current/gbOpen/IRQ/ADM1/ | `fe6cb2db279606cbbb073af3f73693fa0e3f6798e93ec15f41ae6cdf794b487b` | 1766 | Boundary licence metadata (CC0 1.0) |
| `cosit_cosit.gov.iq.html` | https://cosit.gov.iq/ | `54f04f1327df6f9062eae7013ca436ae64e763a448b9f08df491b6ab2e628e7e` | 160067 | CSO portal home (site-design copyright footer) |
| `cosit_cosit.gov.iq_AAS_section_2.php.html` | https://cosit.gov.iq/AAS/section_2.php | `7fdff3c8e3fd2af766d8e6b42b2f3f4ce5c04c8f670d09f41589acdc240b5a09` | 15748 | Annual Abstract census section (no religion table) |
| `cosit_questionnaire_1234.html` | https://www.cosit.gov.iq/ar/?option=com_content&view=article&layout=edit&id=1234 | `806a9d974c854ea99330acf99298155ae3503ea40b72fd3ba111c6acfb44a511` | 171857 | Census-2024 downloads index (form + result PDFs) |
| `ar_wiki_census2024.html` | https://ar.wikipedia.org/wiki/تعداد_العراق_2024 | `cf407bac54f531a35f07df3582319b858beccadbffa7a40f868e9d41bdb3d806` | 242783 | Secondary context (dates, totals) |

Derived working files also present (`pdftotext` extractions): `*.txt` for each PDF; not source objects.

## Blockers and the exact unblock

- **Data grain (gate one)**: religion was collected as five broad categories but published on no table, at no geography. There is no religion-by-governorate table, and no national religion figure either, in any released 2024 product.
- **Licence (gate two)**: the Final Results publication is consent-first — exclusive state ownership, use only per the "officially adopted publication-and-access policy", legal-prosecution clause. Not open, not build-then-ask.
- **Sensitivity (standing, independent of the gates)**: minority-religion figures are politically salient (Yazidi, Sabean-Mandaean concentrations; disputed territories); the state excluded sect and ethnicity and disclaims administrative geography. The Myanmar sensitive-page discipline applies to any future product.
- **Unblock**: a CSO/KRSO data-and-reuse request under the publication-and-access policy for a religion-by-governorate tabulation from the 2024 census, with explicit permission to publish derived governorate rates. This single request addresses both gates. Absent it, the route is HELD.
- **Boundary is ready when the data unblocks**: geoBoundaries IRQ ADM1 (CC0 1.0, 18 units) is accepted; the 18-vs-19 (Halabja) frame-match is settled against whatever governorate frame a released religion table uses.
</content>
</invoke>
