# Pakistan census-religion route probe

Verified 2026-07-11 (probe-only; nothing built, nothing committed). Pakistan has a strong, verified subnational census-religion route for the two modern digital-era waves. The Pakistan Bureau of Statistics (PBS) publishes Table 9, "Population by sex, religion and rural/urban", for both the 2017 and 2023 censuses as downloadable PDFs that reach tehsil level (finer than district), with exact category counts. The 1998 census collected religion and its national anchor is known, but no machine-readable subnational 1998 religion table was pinned in this probe; the 1998 subnational route is print/District-Census-Report only. The build blocker is not the census data — it is boundary vintage (the FATA-into-KP merger and shifting district counts across 1998/2017/2023) and two decisions the probe must not resolve: the sensitive official category frame, and the territorial scope of Azad Jammu and Kashmir (AJK) and Gilgit-Baltistan (GB).

**This probe FLAGS two sensitivities prominently for the conductor and project lead (see the two flagged sections below): the official PBS category label `QADIANI/AHMADI` and the separate enumeration of `SCHEDULED CASTES`, and the AJK/GB territorial-scope question. Under the render-the-record rule the probe records both exactly and resolves neither.**

## Probe result and verdict

The 2017 and 2023 waves both have a verified tehsil-level religion table with exact counts, an identical publication structure (one national plus one file per province, with province → division → district → tehsil rows inside each provincial file), and published national and provincial anchors for reconciliation. The two waves share a partly common frame but are NOT directly comparable at the category level: 2017 publishes six religion categories; 2023 publishes eight, relabelling `HINDU` as `HINDU JATI` and breaking `SIKH` and `PARSI` out of `OTHERS`. The strongest first product is a single-wave 2023 district or tehsil map; a 2017–2023 change series is feasible only after a category concordance and a district/tehsil boundary concordance across the FATA merger.

**VERDICT: BUILDABLE (single wave, 2023, district or tehsil) — route quality is adequate for a derived-rate product from the Table 9 PDFs. HOLD on the two-wave change series pending a boundary concordance across the 2018 FATA-into-KP merger. SENSITIVITY FLAG: ON (official `QADIANI/AHMADI` and `SCHEDULED CASTES` categories). SCOPE FLAG: ON (AJK/GB coverage). LICENCE: no open licence; PBS terms restrict onward supply — a project-lead ruling and the derived-rates-with-attribution treatment (Iran/Côte d'Ivoire precedent) are release requirements.**

## Wave and route matrix

| Census wave | Subnational religion table verified? | Finest verified geography | Format and route finding | Build decision |
| --- | --- | --- | --- | --- |
| 1998 | No (national anchor only in this probe) | National anchor known; subnational religion is in printed District Census Reports | No machine-readable subnational 1998 religion table pinned; PBS `population-tables` and `POPULATION BY RELIGION.pdf` URLs both resolved to WordPress fallback pages, not data | Deferred. National context only until a 1998 subnational religion table (print DCR extraction) is located. |
| 2017 | Yes | Tehsil (province → division → district → tehsil rows within each provincial file) | Text-bearing PDF, `pdftotext -layout` extracts cleanly; one national file plus one per province, with FATA a SEPARATE file (pre-merger vintage) | Buildable. Six-category frame; exact counts. |
| 2023 | Yes | Tehsil (province → division → district → tehsil rows within each provincial file) | Text-bearing PDF, `pdftotext -layout` extracts cleanly; one file per province plus ICT; NO XLSX equivalent found (PDF-only) | Intended first product (finest geography). Eight-category frame; exact counts. |

The build-queue row's premise ("1998–2023, multiple censuses; District; religion table released in detailed results") is confirmed and can be sharpened: the released tables reach TEHSIL, not merely district, for 2017 and 2023; and 1998 subnational religion was not recovered online in this probe.

## Exact data routes

All 2023 provincial detail tables live under one directory pattern, `https://www.pbs.gov.pk/wp-content/uploads/census_tables/tables/table_9_{province}_districts.pdf`. Islamabad breaks the pattern (`table_9_islamabad.pdf`, no `_districts`). The 2017 tables live under `https://www.pbs.gov.pk/wp-content/uploads/2020/07/`. The PBS server is slow and returns a soft-200 WordPress HTML fallback (roughly 404 KB) for missing objects rather than an HTTP 404, so any downloader must verify file type, not just status code.

| Purpose | Exact URL | Verified finding |
| --- | --- | --- |
| 2023 KP districts+tehsils | <https://www.pbs.gov.pk/wp-content/uploads/census_tables/tables/table_9_kp_districts.pdf> | Table 9, 2023; eight religion categories; exact counts to tehsil; includes former FATA districts (e.g. BAJAUR DISTRICT) |
| 2023 Punjab | <https://www.pbs.gov.pk/wp-content/uploads/census_tables/tables/table_9_punjab_districts.pdf> | Same frame; Punjab total 127,333,305 |
| 2023 Sindh | <https://www.pbs.gov.pk/wp-content/uploads/census_tables/tables/table_9_sindh_districts.pdf> | Same frame; downloaded and verified as real PDF |
| 2023 Balochistan | <https://www.pbs.gov.pk/wp-content/uploads/census_tables/tables/table_9_balochistan_districts.pdf> | Same frame; downloaded and verified as real PDF |
| 2023 Islamabad (ICT) | <https://www.pbs.gov.pk/wp-content/uploads/census_tables/tables/table_9_islamabad.pdf> | Same frame; single ISLAMABAD DISTRICT; total 2,283,244 |
| 2023 interactive dashboard (secondary) | <https://census23.pbos.gov.pk/> and <https://psi.pbos.gov.pk/> | Drill-down to Mouza level; a dashboard, not the authoritative downloadable table — use Table 9 PDFs as source of record |
| 2017 national | <https://www.pbs.gov.pk/wp-content/uploads/2020/07/Table09n.pdf> | Table 9, 2017; six religion categories; PAKISTAN total 207,684,626 |
| 2017 KP | <https://www.pbs.gov.pk/wp-content/uploads/2020/07/Kpk_Table09p.pdf> | Province → division → district → tehsil; KP total 30,508,920 |
| 2017 Punjab | <https://www.pbs.gov.pk/wp-content/uploads/2020/07/punjab_Table09p.pdf> | Not downloaded this probe; pattern verified from national/KP/FATA |
| 2017 Sindh | <https://www.pbs.gov.pk/wp-content/uploads/2020/07/sindh_Table09p.pdf> | Not downloaded this probe |
| 2017 Balochistan | <https://www.pbs.gov.pk/wp-content/uploads/2020/07/balochistan_Table09p.pdf> | Not downloaded this probe |
| 2017 FATA (SEPARATE — pre-merger) | <https://www.pbs.gov.pk/wp-content/uploads/2020/07/Table09p.pdf> | FATA is its own file in 2017; in 2023 the FATA agencies are KP districts (boundary discontinuity) |
| 2017 Islamabad (ICT) | <https://www.pbs.gov.pk/wp-content/uploads/2020/07/Table09d.pdf> | ICT file; not downloaded this probe |
| Independent mirror / extraction reference | <https://github.com/colincookman/pakistan_census> | Mirrors PBS 2017 releases (provisional 2018-01-03, final tehsil/district 2021-05-19, 40 detailed tables 2021-08-01) incl. Table 09; no licence stated on the repo |
| Machine-readable geography package (NO religion) | PakPC2023 on CRAN, <https://cran.r-project.org/web/packages/PakPC2023/> | Province/division/district/tehsil population and area from the 2023 census, GPL-2 package; does NOT expose a religion variable — not a religion route |

## Category frames (VERBATIM as published)

The category labels below are transcribed exactly from the PBS Table 9 column headers. English is the publication language; there is no translation step. The frame is the official state frame and its treatment is sensitive (see the flagged section that follows).

### 2023 frame (eight religion categories)

Column headers, verbatim and in published order: `TOTAL POPULATION`, `MUSLIM`, `CHRISTIAN`, `HINDU JATI`, `QADIANI/AHMADI`, `SCHEDULED CASTES`, `SIKH`, `PARSI`, `OTHERS`.

### 2017 frame (six religion categories)

Column headers, verbatim and in published order: `TOTAL`, `MUSLIM`, `CHRISTIAN`, `HINDU`, `QADIANI/AHMADI`, `SCHEDULED CASTES`, `OTHERS`.

Every row is also broken by sex (`ALL SEXES`, `MALE`, `FEMALE`, `TRANSGENDER`) and by `ALL LOCALITIES` / `RURAL` / `URBAN` (2023) or `OVERALL` / `RURAL` / `URBAN` (2017). Values are COUNTS, not percentages.

### Cross-wave comparability

The two frames are not category-identical. Three differences break a naive 2017→2023 join: 2023 relabels `HINDU` as `HINDU JATI`; 2023 breaks `SIKH` and `PARSI` out of `OTHERS` (both were inside `OTHERS` in 2017); and any change series must therefore recombine 2023 `HINDU JATI` + `SCHEDULED CASTES` against 2017 `HINDU` + `SCHEDULED CASTES` with care, and fold 2023 `SIKH` + `PARSI` back into a 2017-comparable `OTHERS`. A change product requires an explicit, documented concordance and is a project-lead decision, not a probe resolution.

## SENSITIVITY FLAG (official category frame) — for the conductor and project lead

Two features of the official PBS frame are sensitive and must not be silently normalised, relabelled, or dropped:

1. `QADIANI/AHMADI` is the official enumerated category for the Ahmadiyya community. Pakistan enumerates Ahmadis separately from Muslims because the Constitution (Second Amendment, 1974) declares them non-Muslim; the U.S. State Department religious-freedom reporting and PBS both record this separate enumeration. The label `Qadiani` is regarded by many Ahmadis as pejorative. Under render-the-record the probe reproduces the label exactly as published and flags it; whether the shipped product displays the PBS label verbatim, adds a display gloss (e.g. "Ahmadi (official label: Qadiani/Ahmadi)"), or annotates the constitutional context is a project-lead ruling. This is the Iran precedent (SCI publishes recognised minorities separately and omits Bahá'í) applied to a more acute case, because here the state label itself is contested.

2. `SCHEDULED CASTES` is enumerated separately from `HINDU`/`HINDU JATI`. Dalit (scheduled-caste) Hindus are counted apart from caste Hindus. A religion map must decide whether "Hindu" means `HINDU JATI` alone, or `HINDU JATI` + `SCHEDULED CASTES` combined; the two give materially different district shares in Sindh. The probe records both columns exactly and does not combine them.

Beyond the frame, small recognised-minority counts at tehsil level will expose very small cells (single- and double-digit `QADIANI/AHMADI`, `SIKH`, `PARSI` counts per tehsil appear in the KP file). Religion is highly sensitive in Pakistan for Ahmadiyya, Hindu, Christian, Sikh, and Dalit communities. The project lead must rule on cell-suppression, the display frame, and any explanatory text BEFORE a build or public release. No build or release should proceed before that ruling.

## Boundaries and vintages

District and tehsil counts differ substantially across waves, and geoBoundaries does not carry a per-census-vintage layer. The join is the real work.

| Layer | geoBoundaries release (verbatim metadata) | Units | Represented year | Licence (verbatim from release metadata) |
| --- | --- | --- | --- | --- |
| ADM2 (district) | `PAK-ADM2-60131773` | `admUnitCount` 126 | `boundaryYearRepresented` 2019 | `licenseType` null; `licenseDetail` "nan"; `licenseSource` `creativecommons.org/share-your-work/public-domain/` — i.e. the release asserts public domain but carries no explicit licence string. Treat as UNRESOLVED, not confirmed-open. |
| ADM3 (tehsil) | `PAK-ADM3-9618217` | `admUnitCount` 554 | `boundaryYearRepresented` 2017 | `licenseType` null; `licenseDetail` "Open Data Commons Open Database License 1.0" (ODbL); `licenseSource` "Pathways Data Pvt. Ltd." |

Per the project rule, these are the release-specific metadata fields, not the site banner. Two observations follow. The ADM3 (tehsil) layer is the better geographic match to the tehsil-level Table 9 tables AND carries an explicit ODbL string (ShareAlike; the Ghana/Malaysia OSM-ODbL precedent governs its use); the 554-tehsil, 2017-vintage layer aligns naturally with the 2017 census tehsil frame. The ADM2 (district) layer carries no explicit licence string and only a public-domain pointer, so a permissive claim on it is not yet supported; its 126 units (2019) also under-count the census district frames.

Cross-wave district vintage problem, documented for the project lead:

- 2023 census: 156 districts reported (PBS enumeration statement), across four provinces + ICT; former FATA agencies now appear as KP districts (e.g. Bajaur, confirmed present in the 2023 KP file).
- 2017 census: FATA enumerated as a SEPARATE unit (own Table 9 file); the FATA-into-KP merger came with the 25th Constitutional Amendment (May 2018), AFTER the 2017 census and BEFORE the 2023 census. The 2017 district frame therefore differs structurally from 2023, not merely in count.
- geoBoundaries ADM2 (126, 2019) reconciles cleanly with neither census district frame.

Join feasibility per wave: 2023 tehsil onto geoBoundaries ADM3 (554, 2017) is the most promising single-wave join but needs a name-and-count concordance because the 2023 tehsil roster post-dates the 2017 layer; a district-level 2023 product is coarser and safer but still needs an official 2023 district layer (the PBS digital census has its own boundary layer worth requesting). A waves-over-districts fallback — a PROVINCE-level 2017+2023 series on five to six stable units (four provinces + ICT, with FATA folded into KP for 2017 to match 2023) — is the most robust multi-wave option and sidesteps the district-vintage problem entirely; it is the recommended change-series design if the project wants time depth before the district concordance is built. Official layers or a published district concordance should be requested from PBS; OSM/ODbL is the fallback for both district and tehsil geometry.

## TERRITORIAL-SCOPE FLAG (AJK / GB / Kashmir) — record neutrally, do not resolve

The 2023 digital census reports two national totals: 241.49 million for the four provinces plus ICT, and 247.54 million "including Gilgit-Baltistan and Azad Kashmir". The Table 9 religion files cover the four provinces + ICT frame (the eight-category national religion counts sum to the ~241 million frame); AJK and GB religion figures, if published, are separate products not pinned in this probe. The 2017 constitutional census total (207,684,626 in Table 9) likewise excludes AJK and GB. As such, a Pakistan religion map faces a coverage-scope decision identical in kind to the Israel/Palestine precedent: each source of record renders its own published coverage, and the decision is stated plainly on the information surfaces. Whether the product maps the four-provinces+ICT frame only, or seeks and adds AJK/GB tables, and how the disputed status of these territories is described, are project-lead rulings. The probe records the scope question neutrally and resolves nothing.

## National and provincial anchors for reconciliation

2017 Table 9, PAKISTAN (four provinces + ICT + FATA), exact counts: total 207,684,626; `MUSLIM` 200,362,718; `CHRISTIAN` 2,642,048; `HINDU` 3,595,256; `QADIANI/AHMADI` 191,737; `SCHEDULED CASTES` 849,614; `OTHERS` 43,253.

2023 provincial anchors, exact counts: Punjab total 127,333,305 (`MUSLIM` 124,462,897); Islamabad District total 2,283,244 (`MUSLIM` 2,181,663). 2023 national religion shares (secondary, from published summaries, to be reconciled against the summed provincial files at build): Muslim ~96.35%, Hindu (incl. scheduled castes) ~2.17%, Christian ~1.37%, Ahmadi ~0.07%. A builder must reconcile the summed provincial+ICT files to the published national totals and disclose any residue, per the standing every-row and local-to-national reconciliation gates.

## Licence and terms (VERBATIM)

No open licence governs PBS census output. The PBS "Data Dissemination" policy page states, verbatim:

> "The previous policy adopted by PBS for data supply was that aggregate level data (tabulation) was provided to the users free of charges and this practice will continue."

and, under "Terms and Conditions for Data User/Researcher", verbatim:

> "a. The user shall provide an undertaking that the data collected from PBS will not be supplied to any other person/organization either free of cost or on payment. b. The user shall acknowledge the source of data and supply copies of the research work/articles (published/unpublished) to PBS."

Two things follow. Aggregate tabulations (the Table 9 PDFs) are disseminated free, and attribution is required; but clause (a) restricts ONWARD SUPPLY of "the data collected from PBS". The project's practice — publish DERIVED rates, not a redistribution of the source tables, with PBS attribution, raw PDFs staying git-ignored — is the same posture ratified for Iran and Côte d'Ivoire (no open licence; derived summaries with attribution under project-lead approval). The clause (a) onward-supply restriction is more explicit than in those cases and should be surfaced to the project lead: the recommended reading is that a derived-rate map is not "supplying the data" within clause (a), but that is a project-lead/rights call, and written PBS confirmation is the clean path. Licence position: **needs_review**; attribution mandatory; derived-rates-only; raw cache git-ignored.

## Retrieval record

All inputs retrieved 2026-07-11 into `data/raw/pk_census/` (git-ignored). The PBS host is slow and serves a ~404 KB WordPress HTML fallback for missing objects at HTTP 200; every cached PDF below was verified as a real PDF (three fallback captures — a dead `POPULATION BY RELIGION.pdf`, the wrong Islamabad slug, and a probed `.xlsx` — were discarded, confirming no XLSX route exists).

| Cached input | SHA-256 |
| --- | --- |
| `table_9_kp_districts.pdf` (2023 KP) | `c8d1c596a244ec743ef838be15bf6876e891cf4332b7e21d824145af5aecd030` |
| `table_9_punjab_districts.pdf` (2023) | `4319a9be3f5c30fd938bdeeef4f6efa65819a9d717f30608990b998e1cb66f35` |
| `table_9_sindh_districts.pdf` (2023) | `330eed69974d9f02f62151ef603c6a0a039b50195ff0ac70b01b97ae49ab8c4c` |
| `table_9_balochistan_districts.pdf` (2023) | `7eebf9fc405f4b31f54cc72f3912edd97133f07b2233cb05a7133ad63ac19793` |
| `table_9_islamabad.pdf` (2023 ICT) | `254e1bfe0b03bffc72431af31594fff204d2a4068ff1319ea46a55b5708ae1df` |
| `table09n_2017_national.pdf` | `15a20c65b2467cc336936abe51d7e792f2370d395e1e8567d3ec40f1f38a46dd` |
| `table09_2017_kp.pdf` | `06329be01ffff7dc8cb93e08c9cf24fe6b2a117769ebe6e8cc4f099f64e09088` |
| `table09_2017_fata.pdf` | `35b4350604e4118bac607569ad83004596ecb73effb7c8fa3a10a9c57d383834` |
| `gb_pak_adm2_meta.json` | `d1983b7882690551ba6b6dfbd0f65185be58f0ec71f330a9f8265227029b64aa` |
| `gb_pak_adm3_meta.json` | `45955b61b6f9d3ebb702781da319e2b398f5d967c4e27e492f885a060366b573` |
| `pbs_data_dissemination_terms.html` (licence evidence) | `94d13063da1f2b0350dfadd82078841dd502c512ae20e2c49820abf5d6b55bb6` |
| `PakPC2023_manual.pdf` (geography package; no religion) | `8b51c0280c8433e4ab79fe6154310e51c25d140a6c20f3499a953e87c22f23cf` |

## Build/hold recommendation for the conductor

Ship-ready as a single-wave 2023 product on the census data; hold on the two-wave series and on release until the flags are ruled. Concretely:

1. First product: 2023 religion shares by district (or tehsil), from the four provincial + ICT Table 9 PDFs, on a boundary layer whose licence is confirmed — geoBoundaries ADM3 (554 tehsils, ODbL) for a tehsil map, or an official/requested 2023 district layer for a district map. The 126-unit ADM2 layer is rejected until its licence resolves.
2. Held pending project-lead ruling: (a) the `QADIANI/AHMADI` display treatment and constitutional-context note; (b) the `HINDU JATI` vs `HINDU JATI + SCHEDULED CASTES` definition and cell-suppression rule; (c) the AJK/GB territorial-scope decision and its on-surface statement; (d) the licence position under the PBS onward-supply clause (derived-rates-with-attribution recommended; written PBS confirmation the clean path).
3. Change series (2017→2023): HOLD until a category concordance (six vs eight categories) and a district/tehsil boundary concordance across the 2018 FATA-into-KP merger are built; the province-level five/six-unit series is the robust fallback if time depth is wanted sooner.
4. 1998 and earlier: deferred — national anchor only; subnational religion needs a printed District Census Report extraction not located online in this probe.
