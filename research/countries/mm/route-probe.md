# Myanmar census-religion route probe

Verified 2026-07-12. Myanmar has a clean, open, single-wave subnational religion route: the 2014 Population and Housing Census "The Union Report: Religion — Census Report Volume 2-C" (Department of Population, July 2016) publishes religion by state/region for 15 units (14 States/Regions + Nay Pyi Taw Union Territory) across seven verbatim categories, as ENUMERATED counts plus an estimated non-enumerated column. Both margins reconcile exactly. A cleanly-licensed boundary exists (OCHA COD-AB, source MIMU, CC BY-IGO). The build is buildable and was built, but it ships **STAGED, held for the PI's eyes on sensitivity** — the Pakistan sensitivity line, not a licence gate — because about 1.09 million people in Rakhine State (predominantly Rohingya Muslims) were not enumerated, and the Department of Population itself states that the enumerated Rakhine and Union religion profile is inconclusive.

**VERDICT: BUILDABLE and BUILT (single wave, 2014, state/region), STAGED. SENSITIVITY FLAG: ON (Rakhine/Rohingya non-enumeration; two published presentations kept strictly separate, never blended). LICENCE (census): bare-copyright vacuum — derived rates with attribution, needs_review. LICENCE (boundary): CC BY-IGO, accepted. CHANGE-WITHHOLD: 2014 vs any 2024 release is a frame-and-universe break.**

## The two presentations (kept strictly separate — the core sensitivity design)

The census's own "Union Report: Religion" divides its results into two parts, and this product keeps them separate exactly as the record does. It never blends them into one number.

- **Part I — ENUMERATED presentation (Table 1).** Religion by state/region for the population enumerated on Census Night (29 March 2014). Union enumerated total 50,279,900. Seven categories per unit. This is the COUNT BASIS of the product: every state/region row's denominator is its printed enumerated total, and affiliation/no-religion math uses enumerated counts only.
- **Part II — ESTIMATED-total presentation (Figure 3 and Table 2 column "2014\*\*").** Adds the estimated non-enumerated population (1,206,353) under the report's stated assumption that the ~1.09M non-enumerated in Rakhine are "mainly affiliated with the Islamic faith". Denominator 51,486,253. The record publishes this presentation **only at the Union level** (national percentages), not per state/region. It is carried as disclosed national CONTEXT in the manifest and surfaces; it is never a state/region row and never added into an enumerated denominator.

The Union-level contrast the two presentations produce (Table 2): Islam 2.3% (enumerated) versus 4.3% (estimated overall); Buddhist 89.8% versus 87.9%; Christian 6.3% versus 6.2%. Hindu, Animist, Other religion and No religion are unchanged to one decimal. The shift is driven almost entirely by the Rakhine non-enumeration.

## Non-enumeration, in the record's own words (carried on every affected surface)

> "The Census enumerated a total of 50,279,900 persons at the place they were present on the 29th March 2014. An estimated 1,090,000 persons residing in Rakhine State, 69,753 persons living in Kayin State and 46,600 persons living in Kachin State were not enumerated in the Census. This represents an estimated total of 1.2 million non-enumerated people residing within Myanmar, and corresponds to 2.3 per cent of the overall population."

> "The size of the non-enumerated population in Rakhine State is significant enough to have an impact on the results on religion at both the Rakhine State level and at the Union level. Consequently, the results presented in 'Part I: Results for enumerated population' are inconclusive in terms of drawing a profile on the composition of religion in Rakhine State and at the Union level."

> "In Rakhine, an estimated 1.09 million people were not enumerated in the Census because they were not allowed to self-identify using a name not recognized by the Government. It is assumed that the non-enumerated population in Rakhine is mainly affiliated with the Islamic faith."

The three states with a non-zero estimated non-enumerated population (Kachin 46,600; Kayin 69,753; Rakhine 1,090,000) carry the non-enumeration flag on their row. Rakhine additionally carries the report's own "inconclusive" caveat. The other twelve rows carry `estimated_non_enumerated=0` and `non_enumeration_affected=false`.

## Category frame (verbatim, per Table 1 and Table 2)

Seven categories, exactly as printed (English is the publication language, no translation step): **Buddhist, Christian, Islam, Hindu, Animist, Other religion, No religion.** The seven categories sum exactly to each unit's enumerated total — there is no "not stated" residual. Because a genuine "No religion" category exists (0.1% nationally), the product uses the ordinary two-slot design (Kazakhstan/SB precedent), NOT the minority-share design: `religious_affiliation_percent` = (Buddhist + Christian + Islam + Hindu + Animist + Other religion) / enumerated total; `no_religion_percent` = No religion / enumerated total; the two sum to 100.

## Reconciliation (exact, verified in the build)

- Every state/region row's seven enumerated categories sum to its printed enumerated total (15/15).
- Every religion column sums to its printed Union total (7/7); Union total 50,279,900 = sum of the seven category totals.
- The estimated non-enumerated column sums to the printed Union figure 1,206,353 (= 46,600 + 69,753 + 1,090,000).
- Enumerated 50,279,900 + non-enumerated 1,206,353 = estimated overall 51,486,253, exactly as the report's Figure 3 note states.
- Computed Union enumerated shares match the printed Table 1 percentages to <=0.1pp (the sole 0.1pp gap is Buddhist: computed 89.9% versus printed 89.8%, the report's own downward display rounding of 45,185,449/50,279,900 = 89.87%). Exact counts are rendered; percentages are derived.

## Boundary route (licensed, 15 units)

The census 15-unit frame is 14 States/Regions plus Nay Pyi Taw Union Territory. Two candidate boundary sources were checked.

| Layer | Units | Licence (verbatim from release metadata) | Decision |
| --- | --- | --- | --- |
| **OCHA COD-AB MMR ADM1** (source: Myanmar Information Management Unit) | 18 | `license_id` **cc-by-igo**; `license_title` "Creative Commons Attribution for Intergovernmental Organisations (CC BY-IGO)"; `dataset_source` "Myanmar Information Management Unit (MIMU)"; organisation "OCHA Field Information Services Section (FISS)" | **USED.** The 18 ADM1 units split Bago (East/West) and Shan (East/North/South); Bago (East)+(West) and Shan (East)+(North)+(South) are dissolved into whole Bago and whole Shan by exact complete-unit partition (18 - 1 - 2 = 15), reconstructing the census frame. Geometric fold, not an invented concordance (Kazakhstan reverse-fold precedent). |
| geoBoundaries MMR ADM1 (gbOpen) | 14 | `boundaryLicense` "Creative Commons Attribution 4.0 (CC BY 4.0)"; `boundarySource` "Myanmar Analytics Project, geoBoundaries"; `boundaryYearRepresented` 2019 | **REJECTED (frame-misaligned).** Only 14 units — it has no Nay Pyi Taw Union Territory, so it cannot join the census 15-unit frame one-to-one. Licence is clean (CC BY 4.0) but the unit set is wrong. |

The COD-AB boundary joins the 15 census states one-to-one after the dissolve (15/15), 15 distinct geometry hashes, simplified to 740,150 bytes at 30% keep.

## Licence position (census: needs_review; boundary: accepted)

The census data carry **no stated reuse terms**. The Volume 2-C PDF has no copyright or reuse clause. The Department of Population website footer (www.dop.gov.mm, retrieved 2026-07-12) asserts only, verbatim:

> "Department of Population © 2026"

with no reuse grant. The report is mirrored openly by UNFPA Myanmar and MIMU, but neither exposes an explicit reuse licence on the report (the MIMU terms page returns HTTP 403 to automated fetch — recorded as a dead end). This is the bare-copyright vacuum (Montenegro/Sri Lanka/Palau line): derived state/region rates ship with attribution to the Department of Population under the project's derived-summaries-with-attribution stance; raw PDFs stay git-ignored. `licence_status: needs_review`. The boundary ships under CC BY-IGO with attribution to OCHA/MIMU (`accepted`).

**The build is STAGED and its page is held for the PI's eyes because of the Rakhine/Rohingya non-enumeration sensitivity — not because of the licence.** This is the standing Pakistan sensitivity line; BUILD-THEN-ASK does not ungate it.

## Premise corrections (trust the record)

- **The report is "The Union Report: Religion — Census Report Volume 2-C", not a "Thematic Report on Religion".** The README and one queue pointer call it a thematic report; the authoritative title (the one that carries the state/region table) is Census Report Volume 2-C. The UNFPA "thematic-report-religion" landing URL points to the same document.
- **The subnational grain is 15 units, and Nay Pyi Taw is a Union Territory, not a Region.** Table 1 lists 14 States/Regions plus Nay Pyi Taw. geoBoundaries' 14-unit ADM1 omits Nay Pyi Taw, which is why it is rejected.
- **2024 is not a comparable second wave.** The 2024 census (conducted 1-15 October 2024 under the State Administration Council military government) has released only PROVISIONAL results, which tabulate population by state/region and sex but publish NO religion breakdown by state/region — the only 2024 religion figures are national headlines (reported Buddhist ~91.3%). The 2024 count enumerated 32,191,407 and estimated 19,125,349 (total 51,316,756); substantial areas were not enumerated for security/access reasons, a larger non-enumeration than 2014. Detailed 2024 results are announced for release before the end of 2025. 2024 is a frame-and-universe break (CHANGE-WITHHOLD): it is deferred, not built, and never blended with 2014. The queue row's "2014-2024" span therefore resolves to a single 2014 wave for now.
- **1973/1983 are Union-level context only.** Volume 2-C Table 2 gives 1973/1983 religion percentages at the Union level; no machine-readable subnational 1973/1983 religion table was recovered (a print route only). Deferred.

## Dead ends recorded

- MIMU pages (themimu.info) return HTTP 403 to WebFetch and curl; the MIMU report node and terms-of-use text could not be captured. The boundary licence was instead confirmed from the OCHA HDX package metadata (`cc-by-igo`), which is the distribution channel governing the download.
- The DoP website home page fetches only over an unverified TLS certificate; captured with `curl -k` for the footer copyright evidence.
- No township-level religion table exists in Volume 2-C (state/region is the finest published grain); the README also warns that public mapping below state/region may be inappropriate given conflict and minority-safety conditions. No sub-state layer built.

## Retrieval record

All inputs retrieved 2026-07-12 into `data/raw/mm_census/` (git-ignored by the `.gitignore` `data/` rule). SHA-256 pinned as source-integrity gates in the build.

| Cached input | Source URL | Role | SHA-256 |
| --- | --- | --- | --- |
| `union_2c_religion_en.pdf` | https://www.dop.gov.mm/sites/dop.gov.mm/files/publication_docs/union_2-c_religion_en_0.pdf | 2014 Table 1 (state/region religion), source of record | `f875d08da9dd5ecb8e6e202bfd8bd5f61a9c6a06f3c2f9c7897aebca345ca567` |
| `unfpa_union_2c_religion_en.pdf` | https://myanmar.unfpa.org/sites/default/files/pub-pdf/UNION_2C_Religion_EN.pdf | UNFPA mirror (Table 1 byte-verified identical) | `e959c13f5e4e6881610d88f3cfcb984f6ed4f9a73fc2127e884c7d717bba72cd` |
| `mmr_admin_boundaries.shp.zip` | https://data.humdata.org/dataset/3ac9b527-.../download/mmr_admin_boundaries.shp.zip | OCHA COD-AB MMR (ADM1 18 units, dissolved to 15) | `a208a057f3d5e475fd64eb67d306e900e010762a0db96f28f52f46b247c077bd` |
| `hdx_mmr.json` | https://data.humdata.org/api/3/action/package_show?id=cod-ab-mmr | boundary licence metadata (cc-by-igo, source MIMU) | `47fd6cf7512364e5a6920fb9eb0af895f4351f7cc3851212977017119bf057e4` |
| `geoBoundaries-MMR-ADM1.geojson` | https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/MMR/ADM1/geoBoundaries-MMR-ADM1.geojson | rejected boundary (14 units, no Nay Pyi Taw) | `e0a1220303e260f0d9cace9daa7ab783e685e46b9d3cfb42e9a52a8b710e60d1` |
| `religion_release_presentation.pdf` | https://www.dop.gov.mm/sites/dop.gov.mm/files/publication_docs/religion_presentation_-_census_report_volume_18-07-2016.pdf | DoP release deck (context) | `6a5bff9e673823393c29acb03dd7eac29634afe47ca2cbc765ac543929f6e0b5` |
| `dop_2024_provisional.pdf` | https://dop.gov.mm/sites/dop.gov.mm/files/publication_docs/2024_provisional_result_eng.pdf | 2024 provisional results (no religion by state/region) | `571da504753ed2a1b5a3d329db39f5c0610a62ff100a4d770ccb4e794eebcf3a` |
| `dop_home.html` | https://www.dop.gov.mm/en | DoP website footer copyright evidence | `621978a84f9fc7dc42e59ca1c453f0009f2a68c99325d020ed889a29692bd9f7` |

## Product boundary

A build on this probe stages a state/region-level religious-affiliation summary for 2014 (15 units), on the OCHA COD-AB (MIMU, CC BY-IGO) boundary dissolved to the census frame, with the verbatim seven-category enumerated frame, fail-fast reconciliation at every margin (all close exactly), the ordinary two-slot design, and the enumerated/estimated dual-presentation kept strictly separate with the Rakhine/Kayin/Kachin non-enumeration disclosed on every affected row and surface in the record's own words. It carries no place-of-worship layer, no township layer, no 2024 wave, and no pre-2014 subnational wave. The census licence is a bare-copyright vacuum (derived rates with attribution, needs_review); the product ships STAGED and its page is held for the PI's eyes on sensitivity.
