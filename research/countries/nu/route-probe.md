# Niue census-religion route probe

Verified 2026-07-11. **Niue publishes census religion nationally only — never by village — in every wave from 1997 to 2022, and the small-country clause governs.** The Niue Statistics Office (NSO, "Statistics Niue"), with SPC and Stats NZ technical assistance, prints a national religious-affiliation table in each census report; the 2022 report's Table 3.3 carries a full six-wave count series (1997, 2001, 2006, 2011, 2017, 2022) in one place, and the 2006 report's Appendix Table 2 extends the national series back to 1986 and 1991. No wave cross-tabulates religion by village or by the two-area (Alofi/rest) split: the reports' many "by village" tables cover population, households, dwellings, water, waste, and internet, but religion appears only as a national table. The fourteen 2022 village-highlight one-pagers carry sex, age, ethnicity, country of birth, and dwellings — no religion line. The buildable product is therefore a **national multi-wave religious-affiliation series**, the honest ceiling for a ~1,700-person country (Iceland / Dominica / Nauru precedent), not a village map. The catch that sinks the village hope is data, not geometry: the 14-village geoBoundaries NIU ADM1 layer exists and is cleanly CC BY 4.0, but there is nothing to join to it.

## Build decision (recommendation to the conductor)

- **Recommendation**: BUILD a **national** religious-affiliation series under the small-country clause. National-only is the record's ceiling — Niue never publishes religion below the national total in any wave.
- **Candidate waves**: the clean, queue-matching product is the six-wave count series **1997, 2001, 2006, 2011, 2017, 2022**. The series extends back to **1986 and 1991** from the 2006 Appendix Table 2 if a fuller span is wanted (eight waves).
- **Candidate geography**: ADM0 (national). One geoBoundaries NIU ADM0 polygon suffices; no village join.
- **Construct**: census affiliation — each resident's reported religious denomination (the census religion question, the one item Niue law lets a person decline). Not practice, attendance, or membership.
- **Change metric**: national levels comparable across waves on the persistent broad spine — Ekalesia Niue, Roman Catholic, Latter Day Saints, Seventh Day Adventist, Jehovah's Witness, Others, None. The category frame is stable in name across all waves; the one seam is the *non-response* line (see Category frame).
- **Source-of-record rule (load-bearing, see Reconciliation)**: take each wave's counts from its **contemporaneous** report, not from the 2022 report's republished history. The 2006 Appendix Table 2 supplies 1986/1991/1997/2001/2006 (nine-category frame, separate "Not stated", reconciles exactly); the 2011/2017/2022 report Table 3.3 supplies those three waves (reconcile exactly). The 2022 Table 3.3 **republication** of the 1997/2001/2006 columns is corrupted — it does not self-reconcile and its figures differ from the originals — so it must not be the historical source.
- **Rights position**: an explicit SPC-family reuse clause exists and is byte-matched (below): "Statistics Niue authorises the partial reproduction … for scientific, educational or research purposes, provided that Statistics Niue and the source document are properly acknowledged." Same posture as Nauru, Tuvalu, and Tonga. Ship derived national summaries with Statistics Niue / SPC attribution under BUILD-THEN-ASK.
- **Village decision**: HOLD indefinitely — no religion-by-village table is published in any wave; the ADM1 boundary is available and clean but has no data to carry.

## Wave-and-route matrix

| Year | Public route | Religion table | Geography | Universe | Decision |
| --- | --- | --- | --- | --- | --- |
| 1986 | 2006 report, Appendix Table 2 (historical column) | national counts, 9-category frame | national | resident (Total 2,531) | Optional deep-history wave (from 2006 appendix). |
| 1991 | 2006 report, Appendix Table 2 (historical column) | national counts, 9-category frame | national | resident (Total 2,239) | Optional deep-history wave (from 2006 appendix). |
| 1997 | 2006 Appendix Table 2 **(use this)**; also republished in 2022 Table 3.3 (corrupted) | national counts | national | resident (Total 2,088) | Ship from the 2006 appendix. |
| 2001 | 2006 Appendix Table 2 **(use this)**; 2001 report's own religion-by-area appendix (Table 25) is absent from the published PDF; 2022 Table 3.3 republication corrupted | national counts | national | resident (Total 1,736) | Ship from the 2006 appendix. |
| 2006 | 2006 report Appendix Table 2 **(use this)**; also 2022 Table 3.3 (differs, corrupted) | national counts | national | resident (Total 1,538) | Ship from the 2006 appendix. |
| 2011 | 2011 report Table 3.2 (percent); counts in 2017/2022 Table 3.3 | national counts | national | resident (Total 1,460) | Ship from Table 3.3 counts. |
| 2017 | 2017 report Table 3.3 | national counts | national | resident (Total 1,591) | Ship from the 2017 report. |
| 2022 | 2022 report Table 3.3 | national counts | national | resident (Total 1,564) | Ship from the 2022 report. |

The `niuestatistics.nu/census/population-housing/` portal is the source of record and hosts every report directly (URLs in the retrieval record). The Pacific Data Hub / SDD / ILO surveyLib catalogue the 2011 and 2022 censuses as restricted microdata (MOU/confidentiality-gated); they add no public village religion table. No machine-readable religion tabulation (Excel `.Stat`) was located — the report PDFs are the route.

## Category frame (verbatim)

**Recent three waves — Table 3.3 "Resident population by religious affiliation" (2011/2017/2022):** columns as printed are `Ekalesia`, `Catholic` (2017: `Catholics`), `Seventh Day Adventist` (2017: `SDA`), `Latter Day Saints` (2017: `LDS`), `Jehovah's Witness` (2017: `JW`), `Others`, `None`, `Total`. There is **no separate "Not stated" column**: the 2022 note reads verbatim, "Of the 165 categorised as 'other' in table 3.3, 53 of these were people who refused to answer the question. This left 110 who noted other religious denominations – 95 of these being Christian religions (e.g., Anglican, Methodist, or simply "Christian" with no affiliation given). This left 15 who gave non-Christian religion responses (e.g., Jewish, Sikh)." So in this frame refusals are folded into `Others`.

**Historical waves — 2006 Appendix Table 2 "Religion" (1986–2006):** rows as printed are `Total`, `Ekalesia Niue`, `Latter Day Saints`, `Roman Catholic`, `Jehovah's Witness`, `Seventh Day Adventist`, `Others`, `None`, `Not stated`. This frame keeps `None` and `Not stated` as **separate** lines. The `Ekalesia` line is the London Missionary Society successor church, printed in full as "Ekalesia Niue" (2001/2011 reports: "Ekalesia Kerisiano Niue").

**Frame seam to record in the build:** pre-2011 (2006 appendix) splits `None` from `Not stated`; the 2011/2017/2022 Table 3.3 folds refusals into `Others` and prints only `None`. A single-frame series must either (a) keep the two sources' native frames per wave and document the seam, or (b) collapse to the comparable broad spine (Ekalesia / Roman Catholic / Latter Day Saints / SDA / JW / Others+non-response / None). No cell is redistributed.

## National counts (verbatim, byte-matched from the report PDFs)

**Table 3.3, 2022 report — the six-wave republication (recent three reconcile; historical three do NOT):**

| Years | Ekalesia | Catholic | SDA | LDS | JW | Others | None | Total | Row sum | Closes? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1997 | 1336 | 125 | 42 | 209 | 42 | 84 | 251 | 2088 | 2089 | off by +1 |
| 2001 | 1094 | 122 | 17 | 156 | 35 | 156 | 139 | 1736 | 1719 | off by −17 |
| 2006 | 954 | 138 | 6 | 123 | 31 | 138 | 154 | 1538 | 1544 | off by +6 |
| 2011 | 978 | 146 | 15 | 146 | 29 | 117 | 29 | 1460 | 1460 | exact |
| 2017 | 981 | 134 | 23 | 139 | 43 | 130 | 141 | 1591 | 1591 | exact |
| 2022 | 961 | 114 | 44 | 137 | 31 | 165 | 112 | 1564 | 1564 | exact |

**Appendix Table 2, 2006 report — the correct historical source (every column reconciles):**

| Religion | 1986 | 1991 | 1997 | 2001 | 2006 |
| --- | --- | --- | --- | --- | --- |
| Total | 2,531 | 2,239 | 2,088 | 1,736 | 1,538 |
| Ekalesia Niue | 1,749 | 1,588 | 1,330 | 1,093 | 956 |
| Latter Day Saints | 307 | 237 | 206 | 158 | 127 |
| Roman Catholic | 170 | 139 | 133 | 128 | 138 |
| Jehovah's Witness | 33 | 47 | 46 | 43 | 28 |
| Seventh Day Adventist | 77 | 46 | 51 | 25 | 6 |
| Others | 135 | 111 | 76 | 151 | 139 |
| None | 48 | 68 | 77 | 34 | 43 |
| Not stated | 12 | 3 | 169 | 104 | *101 |

("*" 2006 Not stated "includes 1 refusal response", per the source note.) Every column sums to its printed Total: e.g. 2006 = 956+127+138+28+6+139+43+101 = 1,538; 1997 = 1330+206+133+46+51+76+77+169 = 2,088; 2001 = 1093+158+128+43+25+151+34+104 = 1,736. The 2006-appendix figures **differ** from the 2022 Table 3.3 republication for the same waves (e.g. 2006 Ekalesia 956 vs 954, LDS 127 vs 123, JW 28 vs 31, and the 2022 table's single `None` 154 against the appendix's `None` 43 + `Not stated` 101 = 144). This is a documented cross-source discrepancy (Saint Lucia / Côte d'Ivoire render-the-record precedent): use the reconciling contemporaneous appendix for history, and — if the corrupted 2022 columns are shown at all — flag them, never redistribute.

## Reconciliation gates (verified in the probe)

- **Recent three waves (Table 3.3)**: 2011 category sum = 1,460; 2017 = 1,591; 2022 = 1,564 — each equals its printed Total exactly.
- **Historical waves (2006 Appendix Table 2)**: all five columns (1986/1991/1997/2001/2006) sum to their printed Totals exactly with the nine-category frame.
- **Failing rows (documented, not the build source)**: the 2022 Table 3.3 republication of 1997 (+1), 2001 (−17), and 2006 (+6) does not self-reconcile and diverges from the originals; the build takes those waves from the 2006 appendix instead.
- The build stops and records any failing row on arithmetic mismatch; no value is allocated, inferred, rounded, or tuned.

## Universe and denominator

Every wave counts the **resident population** (the census "resident population by religious affiliation" universe): 2,531 (1986) → 2,239 (1991) → 2,088 (1997) → 1,736 (2001) → 1,538 (2006) → 1,460 (2011) → 1,591 (2017) → 1,564 (2022). The 2022 census night total was 1,681 persons, of whom 1,564 counted Niue as their place of usual residence; the religion table uses the resident total (1,564), so the denominator is internally consistent and matches the printed Table 3.3 Total. A build states the resident-population universe explicitly and does not mix it with the census-night figure.

## Village route — refuted

No wave publishes religion by village or by area:

- **2011/2017/2022 reports**: the "by village" tables are population distribution, absentees, household size, dwellings, waste disposal, toilet facility, drinking/washing water, cooking, internet access, items owned, and income sources — never religion. Religion is Table 3.3 (2022/2017) / Table 3.2 (2011), national only.
- **2001 report**: the table of contents promises "Table 25. Distribution of Household Population by Religion, Gender and Area for all Ages" (listed at page 83), but the published PDF ends at its printed page 51 and the appendix containing Table 25 is **absent from the file**. The in-text religion table (Table A7) is national by gender only. "Area" elsewhere in the 2001 report resolves to the two dominant areas (Alofi South / Alofi North) plus the smaller villages for migration and population tables, not a religion cross-tab.
- **2006 report**: Appendix Table 2 (Religion) is a national time series; no religion-by-village appendix exists.
- **2022 village highlights** (fourteen one-page PDFs, e.g. Alofi South, Hakupu — cached and inspected): sections are Sex, Age, Ethnicity, Country of Birth, and Dwellings. **No religion line.**

The village hope fails on data availability, not geometry. Revisit only if NSO releases a village religion tabulation (an NSO ask, or the 2011/2022 restricted microdata under an MOU) — held, never a route.

## Licence position

The Niue census series carries the SPC-family partial-reproduction-with-acknowledgement clause — the Nauru / Tuvalu / Tonga posture, an explicit reuse authorisation, cleaner than the Palau / FSM vacuum. Byte-matched verbatim:

- **2011 report** (front matter, cached `nu_2011_census_report.txt`): "© Copyright Statistics Niue, Government of Niue 2012. All rights for commercial and or for profit reproduction or translation, in any form is reserved. **Statistics Niue authorises the partial reproduction or translation of this material for scientific, educational or research purposes, provided that Statistics Niue and the source document are properly acknowledged.** Permission to reproduce the document and or translate in whole, in any form, whether for commercial / for profit or non-profit purposes, must be requested in writing. Original artwork may not be altered or separately published without permission."
- **2006 report** (front matter): "© Copyright Secretariat of the Pacific Community 2008. All rights for commercial / for profit reproduction or translation, in any form, reserved. **SPC authorises the partial reproduction or translation of this material for scientific, educational or research purposes, provided that SPC and the source document are properly acknowledged.** …" (same clause, SPC copyright holder).
- **2017 report**: "© Statistics Niue, 2019. All rights for commercial/for profit reproduction or translation, in any form, reserved." The follow-on "authorises the partial reproduction …" sentence did not text-extract from this PDF (blank lines follow in the extraction); the 2006/2011 clause is the operative family statement and the 2017 report is the same NSO census series. Recorded as a soft flag, not a blocker.
- **2022 report**: **no explicit reuse clause** in the extractable text — only a "Required citation" ("2022 Niue Census of Population and Household Report, Niue Statistics Office, Alofi") and acknowledgements to SPC's Statistics for Development Division and the Stats NZ Pacific Programme. This is the Palau-style vacuum for the single most recent wave, but the census-series family clause (2006/2011) and the BUILD-THEN-ASK standing ruling cover it.
- **niuestatistics.nu site**: the homepage carries only its WordPress theme's software licences (GPL v2 / MIT), not a data-reuse statement — not load-bearing.

Net: ship derived **national** summaries with Statistics Niue / SPC attribution under the byte-matched 2006/2011 partial-reproduction clause and the standing BUILD-THEN-ASK ruling. An NSO courtesy confirmation (covering the 2022 wave's silent licence) is the only tidy-up, not a gate.

## Boundary route

- **National product (recommended)**: geoBoundaries **NIU ADM0** — `admUnitCount 1`, `boundaryType ADM0`, `boundaryYearRepresented 2021`, `boundaryLicense "Creative Commons Attribution 4.0 International (CC BY 4.0)"`, source Sentinel-2 10 m land-cover raster-to-polygon. One polygon, clean CC BY 4.0, sufficient for the national series. Niue is a single ~260 km² raised-coral island with no outlying dependencies — no dateline or small-island bbox trap.
- **Village layer (available, unused)**: geoBoundaries **NIU ADM1** — `admUnitCount 14`, `boundaryType ADM1`, `boundaryYearRepresented 2020`, `boundaryLicense "CC BY 4.0"`, source Pacific Data Hub. The 14 shapeNames match the 14 census villages exactly (Alofi North, Alofi South, Avatele, Hakupu, Hikutavake, Lakepa, Liku, Makefu, Mutalau, Namukulu, Tamakautoga, Toi, Tuapa, Vaiea). The boundary is build-ready; it is recorded because the queue hoped for a village map, but there is no village religion table to join to it. **ADM2 returns 404.**

## Retrieval record

Every cached input is under `data/raw/nu_census/`, which `git check-ignore -v` confirms is excluded by `.gitignore:120` (the `data/` rule). Retrieval occurred on 2026-07-11.

| Cached input | Source URL | Hosting | SHA-256 |
| --- | --- | --- | --- |
| `nu_2022_census_report.pdf` | <https://niuestatistics.nu/download/35/census/2793/2022-niue-census-of-population-and-housing-report.pdf> | official (NSO portal) | `ea91527065b613e0f09edd85d0c58b97ce7840ced660b7860ff2e97186dffbf6` |
| `nu_2017_census_report.pdf` | <https://niuestatistics.nu/download/35/census/1460/2019-niue-pophh-census-2-0.pdf> | official (NSO portal) | `cb44d336f670b35ce21da660333bcd69b5972803ad40cadfe2f145013f7bed33` |
| `nu_2011_census_report.pdf` | <https://niuestatistics.nu/download/35/census/2040/niue-2011-cenus-population-profile.pdf> | official (NSO portal) | `91d275e11f216e43fd93e8861650eff0349f844db5e0c310c166e8359f0069b7` |
| `nu_2006_census_report.pdf` | <https://niuestatistics.nu/download/35/census/474/niu_2006_population_profile.pdf> | official (NSO portal) | `a7827380fe1d869e9902ed6dd67121c7bc79987f178249e7d8a91b046e185d8b` |
| `nu_2001_census_report.pdf` | <https://niuestatistics.nu/download/35/census/569/niue-population-and-household-census-2001-2.pdf> | official (NSO portal) | `ebe63598727d25c388a968365c9ccbcdaf9ac22b97bba1818bbd2b04ec66afae` |
| `vh_alofi_south.pdf` | <https://niuestatistics.nu/download/67/village-highlights/2875/50-alofi-south-highlights.pdf> | official (NSO portal) | `d5fc0697d2f85d3c297c3f3b1a9a29873475a77c42344a878b213c2b9cb22f32` |
| `vh_hakupu.pdf` | <https://niuestatistics.nu/download/67/village-highlights/2872/60-hakupu-highlights.pdf> | official (NSO portal) | `3ef65b7f994aa0771802761814ca3c9eab5fda4c1400aedc2b93e4dc88818250` |
| `geoBoundaries-NIU-ADM0.geojson` | geoBoundaries gbOpen NIU ADM0 (`gjDownloadURL` in meta) | geoBoundaries gbOpen | `835625ce5617a01fbdecd99fde93f5de587d46e07d0dc52c83d7fb0fbf2fd705` |
| `geoBoundaries-NIU-ADM1.geojson` | geoBoundaries gbOpen NIU ADM1 (`gjDownloadURL` in meta) | geoBoundaries gbOpen | `e944ea8ad2249b8bde9d53ce75bdd5bd44d365516c541fcb78cb80b3a47b51ea` |
| `gb_niu_ADM0_meta.json` | <https://www.geoboundaries.org/api/current/gbOpen/NIU/ADM0/> | geoBoundaries API | `689af60f65e66d5b27d8fb8524effae7f67bd69a6d59d51b2c15aaeb114e2247` |
| `gb_niu_ADM1_meta.json` | <https://www.geoboundaries.org/api/current/gbOpen/NIU/ADM1/> | geoBoundaries API | `f2c39888cecc1fa2aa3d170a32c7a51512e63236b4089842880020644e6a615b` |

Derived/context files also present (not source objects): the five report `.txt` pdftotext extractions, the two village-highlight `.txt` extractions, `gb_niu_ADM2_meta.json` (404 capture), `portal_census.html`, and `nu_home.html` (page captures for the retrieval trail).

## Blockers / holds

- **Village religion is impossible from public products**: no wave publishes religion below the national total. The 14-village ADM1 boundary is clean and build-ready, but no village religion data exists to carry it. A village map needs an NSO village religion tabulation or the restricted 2011/2022 microdata (MOU-gated) — held, not a route.
- **PDH/SDD/ILO microdata**: the 2011 (PDH catalog/24) and 2022 (SDD / ILO surveyLib 8529) censuses are catalogued as restricted microdata; they are a documented HOLD, never a route, and are not touched by the build.
- **2022 Table 3.3 historical corruption**: the republished 1997/2001/2006 columns in the 2022 report do not self-reconcile and differ from the contemporaneous originals; the build sources those waves from the 2006 Appendix Table 2 instead. Documented, not a blocker.
- **2001 religion-by-area appendix absent**: the 2001 report's ToC lists a "Religion, Gender and Area" appendix table, but the published PDF is truncated and the appendix is not in the file. Even if recovered, "Area" in the 2001 report is the two-area/large-village split, not a full 14-village frame, and it would be a single-wave fragment.
- **2017 licence sentence not extracted**: the 2017 report's partial-reproduction sentence did not text-extract (soft flag); the 2006/2011 family clause is operative.
- **2022 wave silent licence**: the 2022 report states no reuse clause (Palau vacuum for the latest wave); covered by the census-family clause and BUILD-THEN-ASK. An NSO courtesy confirmation closes it.

## Product boundary

A build on this probe stages a **national**, multi-wave religious-affiliation series on one geoBoundaries NIU ADM0 polygon (CC BY 4.0). The clean, queue-matching span is **1997–2022** (six waves); the fuller span **1986–2022** (eight waves) is available if the deep-history columns from the 2006 appendix are wanted. Each wave's counts come from its contemporaneous report (2006 Appendix Table 2 for 1986–2006; report Table 3.3 for 2011/2017/2022), on the resident-population universe, with the broad affiliation spine (Ekalesia Niue, Roman Catholic, Latter Day Saints, Seventh Day Adventist, Jehovah's Witness, Others, None) and the documented non-response seam. It would **not** include a village layer (no data), a places-of-worship layer (OSM coverage untested/sparse per the country README), place-density metrics, or the corrupted 2022 Table 3.3 history as a source. The small-country clause is the basis for shipping: Niue's clean multi-wave national religion series with an explicit SPC-family reuse clause is a legitimate national-context product, matching the Iceland, Dominica, and Nauru precedents.
