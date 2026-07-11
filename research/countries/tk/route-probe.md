# Tokelau census-religion route probe

Verified 2026-07-11. Tokelau publishes religion **by atoll** for three consecutive waves, and the public route is clean: the Tokelau National Statistics Office (TNSO) and Stats NZ co-publish census tables that print religious affiliation for each of the three atolls (Atafu, Fakaofo, Nukunonu) with full counts, and every wave's table closes to its printed margins exactly. The 2016 report's social-profile workbook carries the prize table — a single open `.xlsx` that prints religion by atoll for **both 2011 and 2016** side by side — and the 2006 census tables workbook prints the same cross-tab for 2006. Three atolls, three waves (2006, 2011, 2016), all open, all reconciling. The famous denominational contrast is real and legible in the counts: Congregational Christian dominates Atafu and Fakaofo, Roman Catholic dominates Nukunonu. The catch sits at the recent end. The 2022 census exists only as licensed microdata (released August 2025, "Other (Not Open)", confidentiality declaration required); no public printed religion-by-atoll table for 2022 was located. The pre-2006 waves (1986/1991/1996/2001) yield no public atoll religion table either. The buildable product is therefore a three-wave (2006, 2011, 2016) atoll-level series, not a 1986-2022 span.

## Build decision (recommendation to the conductor)

- **Recommendation**: BUILD a three-wave religious-affiliation series **by atoll** (2006, 2011, 2016) across all three atolls (Atafu, Fakaofo, Nukunonu). This clears the small-country bar comfortably: the atoll detail the queue hoped for is published, open, and reconciles. Tokelau does not fall back to a national-only series — atoll religion is the product.
- **Candidate waves**: 2006, 2011, 2016 at atoll level. Hold 2022 (licensed microdata only); hold pre-2006 (no public atoll religion table located).
- **Construct**: census affiliation. Each usual resident's reported religious denomination (the census question "What is (…)'s religion?"), not practice, attendance, or membership.
- **Geography**: three atolls — Atafu, Fakaofo, Nukunonu — the natural and only sub-national unit. Tokelau has no smaller published religion geography and needs none; the atoll *is* the district.
- **Change metric**: atoll-level shares of Congregational Christian, Roman Catholic, Presbyterian, and Other Christian are comparable across all three waves. The category frame is stable (the 2016 classification "was based on the 2011 one", and 2006 used the same RELIGAFF spine). The headline story — Congregational decline on Atafu/Fakaofo, a rising Catholic share on Fakaofo, near-total Catholic Nukunonu easing slightly — is legible directly in the counts.
- **Rights position**: Crown copyright, TNSO/Stats NZ co-publication, deferring to Stats NZ "Copyright and terms of use". The CC BY 4.0 clause is byte-matched from the rendered Stats NZ copyright page (conductor closure 2026-07-11, quote and capture in Publication terms below): ship derived atoll summaries with TNSO/Stats NZ attribution under CC BY 4.0 and the adapted-content statement.
- **2022 decision**: HOLD. The 2022 aggregate religion-by-atoll table is not openly published; the microdata is licensed and MOU-gated. Revisit if TNSO/SPC releases a 2022 profile report or an open `.Stat` aggregate.

## Published waves and geography

| Year | Public route | Religion table | Geography | Universe | Decision |
| --- | --- | --- | --- | --- | --- |
| 2006 | [TNSO/Stats NZ 2006 Census Tables `.xls`](https://www.tokelau.org.nz/site/tokelau/files/2006%20Tokelau%20Census%20-%20Tables.xls), sheet **Table 2.5**; narrative in [2006 Analytical Report](http://www.tokelau.org.nz/site/tokelau/files/2006%20Census%20of%20Tokelau%20Analytical%20Report.pdf) | Table 2.5 "Religion by Atoll of Usual Residence" (bilingual Tokelauan/English), full counts | **atoll** (Atafu, Fakaofo, Nukunonu) | usual residents present on census night (Total 1,074) | Ship the 2006 atoll wave. |
| 2011 | [2016 Census "Tables about social profile" `.xlsx`](https://www.tokelau.org.nz/site/tokelau/files/TokelauNSO/2016Census/2016%20Tokelau%20Census%20of%20Population%20and%20Dwellings%20-%20Tables%20about%20social%20profile.xlsx), sheet **Table 5.8** (2011 columns) | Table 5.8 "Religious affiliation by atoll of usual residence, 2011 and 2016" — 2011 block, full counts | **atoll** | usual residents present on census night (Total 1,143) | Ship the 2011 atoll wave (from the 2016 workbook's 2011 columns). |
| 2016 | [2016 Census "Tables about social profile" `.xlsx`](https://www.tokelau.org.nz/site/tokelau/files/TokelauNSO/2016Census/2016%20Tokelau%20Census%20of%20Population%20and%20Dwellings%20-%20Tables%20about%20social%20profile.xlsx), sheet **Table 5.8** (2016 columns); narrative + Figure 5.4 in [Profile of Tokelau: 2016](https://www.tokelau.org.nz/site/tokelau/files/TokelauNSO/2016Census/profile-tokelau-2016-census-final-to-print28jun17jj.pdf) §5.4 | Table 5.8 (2016 block), full counts | **atoll** | usual residents present on census night (Total 1,197) | Ship the 2016 atoll wave. |
| 2022 | [PDH microdata catalog/834](https://microdata.pacificdata.org/index.php/catalog/834); [pacificdata.org dataset](https://pacificdata.org/data/dataset/spc_tkl_2022_phc_v01_m); [ILO surveyLib 8528](https://webapps.ilo.org/surveyLib/index.php/catalog/8528) | none public — licensed microdata only (v01, August 2025) | (microdata: national coverage stated) | licensed | **HOLD** — no open religion-by-atoll table. |
| 1986 / 1991 / 1996 / 2001 | [PDH 1996 catalog/190](https://microdata.pacificdata.org/index.php/catalog/190) (metadata); no public atoll religion table located | none located | — | — | **HOLD** — outside the buildable series. |

The `www.tokelau.org.nz/…/census.html` page is the source of record and hosts the 2006 and 2016 outputs directly; it links the 2011 outputs only via dead `stats.govt.nz` archive URLs (the old `browse_for_stats/.../2011-tokelau-census` pages). The 2011 atoll religion counts are recovered cleanly from the 2016 social-profile workbook, which prints 2011 and 2016 as adjacent column blocks in Table 5.8 — so 2011 needs no working link to the retired Stats NZ 2011 pages. The Pacific Data Hub / SDD / ILO catalogues carry the 2022 (and 1996) census only as microdata with restricted access; they add no public atoll religion table.

## Category frame

The frame is stable across the three buildable waves; the 2016 classification note states it "was based on the 2011 one", and 2006 used the same RELIGAFF spine (New Zealand Standard Classification of Religious Affiliation 1999). Preserve each source spelling; the 2006 table is bilingual.

| 2006 (Table 2.5) | 2011 (Table 5.8) | 2016 (Table 5.8) | Product role |
| --- | --- | --- | --- |
| Congregational Christian – Fakalapotopotoga Kelihiano | Congregational Christian | Congregational Christian | religious affiliation |
| Presbyterian – Pelepeleane | Presbyterian | Presbyterian | religious affiliation |
| Roman Catholic – Katoliko | Roman Catholic | Roman Catholic | religious affiliation |
| Other Christian – Ietahi Kelihiano | Other Christian | Other Christian | residual affiliation |
| — | Spiritualism and New Age religions | Spiritualism and New Age religions | religious affiliation |
| — | No religion | No religion | no-religion |
| Not Stated – E he takua | Not stated | Not stated | non-response |

The full RELIGAFF classification (printed in the 2016 profile appendix) also carries Buddhist & Hindu, Islam/Muslim & Judaism/Jewish, and Other (code 99), but every one of these is zero across all three Tokelau waves — the tables print only the lines above. The census questionnaire offered three named denomination options (Congregational Christian, Roman Catholic, Presbyterian) plus an "other, please specify" field; in 2006 "all people who answered the religion question gave a Christian denomination". Treat "No religion" and "Not stated" as separate lines (the no-religion count is 0/0/1 across 2006/2011/2016 — Tokelau is effectively universally Christian).

## The atoll counts (verified, byte-matched from the workbooks)

**2006** — Table 2.5 (usual residents present, Total 1,074):

| Religion | Atafu | Fakaofo | Nukunonu | Total |
| --- | --- | --- | --- | --- |
| Congregational Christian | 397 | 261 | 6 | 664 |
| Presbyterian | 1 | 10 | ~ | 11 |
| Roman Catholic | 1 | 82 | 278 | 361 |
| Other Christian | 17 | 16 | 3 | 36 |
| Not Stated | 1 | 1 | ~ | 2 |
| **Total** | **417** | **370** | **287** | **1,074** |

**2011** — Table 5.8, 2011 block (Total 1,143):

| Religion | Atafu | Fakaofo | Nukunonu | Total |
| --- | --- | --- | --- | --- |
| Congregational Christian | 345 | 306 | 14 | 665 |
| Presbyterian | 5 | 11 | 5 | 21 |
| Roman Catholic | 13 | 115 | 290 | 418 |
| Other Christian | 21 | 11 | 0 | 32 |
| Spiritualism and New Age religions | 0 | 1 | 0 | 1 |
| No religion | 0 | 0 | 0 | 0 |
| Not stated | 1 | 5 | 0 | 6 |
| **Total** | **385** | **449** | **309** | **1,143** |

**2016** — Table 5.8, 2016 block (Total 1,197):

| Religion | Atafu | Fakaofo | Nukunonu | Total |
| --- | --- | --- | --- | --- |
| Congregational Christian | 318 | 250 | 35 | 603 |
| Presbyterian | 54 | 8 | 9 | 71 |
| Roman Catholic | 18 | 130 | 315 | 463 |
| Other Christian | 15 | 11 | 24 | 50 |
| Spiritualism and New Age religions | 0 | 0 | 0 | 0 |
| No religion | 1 | 0 | 0 | 1 |
| Not stated | 7 | 0 | 2 | 9 |
| **Total** | **413** | **399** | **385** | **1,197** |

The `~` in the 2006 Nukunonu column is the confidentiality suppression symbol (Presbyterian and Not Stated), each a small count that rounds to zero against the column total 287; the build treats `~` as suppressed-small, not missing, and never imputes a value.

## Universe and denominator

Every wave counts the **usually resident population present in Tokelau on census night** — the same universe across 2006/2011/2016 (1,074 → 1,143 → 1,197). Tokelau also maintains separate "usual resident" totals that include absentees (people who usually live in Tokelau but were away on census night, chiefly for healthcare and education); the religion tables use the *present* universe, so the denominator is internally consistent and sums to the printed atoll totals. A build states the present-resident universe explicitly and does not mix it with the absentee-inclusive population figures the profiles report elsewhere.

## Reconciliation gates (verified in the probe)

- **2006 (Table 2.5)**: column sums Atafu 417, Fakaofo 370, Nukunonu 287 and grand total 1,074 all close exactly to the printed margins (with `~` treated as 0 in Nukunonu).
- **2011 (Table 5.8)**: column sums Atafu 385, Fakaofo 449, Nukunonu 309 and grand total 1,143 close exactly.
- **2016 (Table 5.8)**: column sums Atafu 413, Fakaofo 399, Nukunonu 385 and grand total 1,197 close exactly.
- **Cross-source narrative check**: the 2016 profile §5.4 percentages reconcile against the counts — Nukunonu Roman Catholic 315/385 = 81.8%; 2011 Nukunonu RC 290/309 = 93.85% ("93.9%"); Fakaofo RC 82/370 = 22.2% in 2006. All match the printed narrative within rounding.
- The build stops and records any failing row on arithmetic mismatch; no value is allocated, inferred, rounded, or tuned.

## Boundary source and licence

geoBoundaries carries **only** a Tokelau ADM0 layer — [`gbOpen/TKL/ADM0`](https://www.geoboundaries.org/api/current/gbOpen/TKL/ADM0/); the ADM1 and ADM2 endpoints return 404. There is no named-atoll ADM1 polygon anywhere in geoBoundaries. The atoll boundaries are nonetheless **derivable from the ADM0 layer**, because the release is a Sentinel-2 10 m land-cover raster-to-polygon dissolve and the geometry is a single MultiPolygon of 206 islet (motu) parts that cluster cleanly, by longitude and latitude, into the three atolls (they lie ~90-100 km apart, so the clusters are unambiguous):

| Atoll | Longitude band | Latitude band | geojson parts |
| --- | --- | --- | --- |
| Fakaofo | ~171.18-171.27 °W | ~9.32-9.44 °S | 0-75 |
| Nukunonu | ~171.77-171.87 °W | ~9.10-9.23 °S | 76-147 |
| Atafu | ~172.46-172.52 °W | ~8.53-8.58 °S | 148-205 |

The recommended boundary route is: take the geoBoundaries **TKL ADM0** geojson (CC BY 4.0), explode the MultiPolygon, assign each part to an atoll by its centroid longitude, and dissolve to three atoll footprints labelled by the known atoll coordinates. All three atolls appear with complete islet extents; no atoll is missing. Release metadata (authority for the build's boundary licence): `"boundaryID": "TKL-ADM0-11190911"`, `"boundaryYearRepresented": "2022"`, `"boundaryType": "ADM0"`, `"boundarySource": "raster 2 polygon from Sentinel-2 10m Land Cover where Image Year = 2022 / exclude gridcode = 1 (water) / dissolve"`, `"boundaryLicense": "Creative Commons Attribution 4.0 International (CC BY 4.0)"`, `"licenseSource": "livingatlas.arcgis.com/landcover/"`. An OSM `place=island` alternative exists (each atoll is a discrete island relation) if a cleaner named-atoll polygon is wanted, but the geoBoundaries ADM0 split is sufficient and its licence is clean.

Two scope facts, recorded neutrally. First, **Tokelau is a non-self-governing territory of New Zealand**; this is a jurisdictional fact to state on the region page, not a data problem to resolve — the census is Tokelau's own (TNSO), co-run with Stats NZ. Second, **Swains Island (Olohega)** — geographically part of the Tokelau chain but administered by the United States (American Samoa) — is **outside** the Tokelau census and outside this boundary: every geojson part sits between 8.5°S and 9.4°S, whereas Swains lies near 11.05°S, so there is no Swains contamination in the ADM0 layer and no exclusion step is required.

## Licence position

- **2006 Analytical Report and 2016 Profile / workbooks**: Crown copyright, co-published by TNSO and Stats NZ. The 2016 profile front matter reads verbatim: `Crown copyright ©` and `See Copyright and terms of use for our copyright, attribution, and liability statements.`, with `ISBN 978-1-98-852806-9 (online)`, `Published in April 2017 by Tokelau National Statistics Office, Apia, Samoa`, and citation `Tokelau National Statistics Office and Stats NZ (2017). Profile of Tokelau: 2016 Tokelau Census of Population and Dwellings. Available from www.tokelau.org.nz and www.stats.govt.nz.` The report defers its reuse terms to the Stats NZ "Copyright and terms of use" page rather than printing the licence in the document.
- **Byte-match CLOSED (conductor, 2026-07-11):** the Stats NZ copyright page was rendered in the in-app browser and byte-matched; the operative clause reads verbatim: "Unless otherwise specified, content we produce is licensed under the Creative Commons Attribution 4.0 International licence." The page also prints the two required attribution statements ("Source: Stats NZ and licensed by Stats NZ for reuse under the Creative Commons Attribution 4.0 International licence." for as-is reuse; "This work is based on/includes Stats NZ's data which are licensed by Stats NZ for reuse under the Creative Commons Attribution 4.0 International licence." for adapted content). Captured to `data/raw/tk_census/statsnz_copyright_page.txt`, sha256 `2f5053903b59f5fddf0441a4c742ecb8ad1d1ee6b2f312a62d4ad48413477aaa`, URL `https://www.stats.govt.nz/about-us/copyright/`, page dated 3 May 2021. The licence position is CC BY 4.0 with the adapted-content attribution statement; the soft flag below is retained for the record only.
- **Byte-match gap (soft flag, superseded by the closure above)**: the Stats NZ copyright page (`stats.govt.nz/about-us/copyright/`) is JavaScript-rendered and did not text-extract, so the CC BY 4.0 clause is **not** byte-matched here. Stats NZ's standing posture under NZGOAL is CC BY 4.0 for most content, and the co-publication is Crown copyright deferring to those terms; treat the position as CC BY 4.0-with-attribution but record the missing byte-match exactly as the Nauru probe recorded its 2011 licence-page gap — a tidy-up, not a blocker. Ship derived atoll summaries with `Tokelau National Statistics Office and Stats NZ` attribution.
- **2022 microdata (PDH catalog/834)**: `Licence: Other (Not Open)`. Access requires a permission request to TNSO and a signed confidentiality declaration ("Not to share the data with anyone else than yourself"). Required citation: `Tokelau National Statistics Office, Tokelau Population and Housing Census 2022 (PHC 2022), version 01 of the licensed datasets (August 2025), provided by the Pacific Data Hub - Microdata Library.` The build does not touch this microdata; the restriction is recorded to explain why 2022 is held.
- **Boundary**: geoBoundaries TKL ADM0 is `CC BY 4.0` per its release metadata (above).

## Retrieval record

Every cached input is under `data/raw/tk_census/`, which `git check-ignore -v` confirms is excluded by `.gitignore:120` (the `data/` rule). Retrieval occurred on 2026-07-11.

| Cached input | Source URL | Hosting | SHA-256 |
| --- | --- | --- | --- |
| `tk_2006_tables.xls` | <https://www.tokelau.org.nz/site/tokelau/files/2006%20Tokelau%20Census%20-%20Tables.xls> | official (TNSO) | `e8af0913844a61927483ffa9288c3bff952ad74290295847fbb2edb57f5801d1` |
| `tk_2006_analytical_report.pdf` | <http://www.tokelau.org.nz/site/tokelau/files/2006%20Census%20of%20Tokelau%20Analytical%20Report.pdf> | official (TNSO) | `5a4ad08c8b0f24fb0a8ee704089ef7802d0a84c381696df277cb41ce3d864330` |
| `tk_2016_social_profile_tables.xlsx` | <https://www.tokelau.org.nz/site/tokelau/files/TokelauNSO/2016Census/2016%20Tokelau%20Census%20of%20Population%20and%20Dwellings%20-%20Tables%20about%20social%20profile.xlsx> | official (TNSO/Stats NZ) | `2e09afeed7d664fff871a6a25a85393024e39f5cb508b1ceef2f15c6121b0d28` |
| `tk_2016_profile.pdf` | <https://www.tokelau.org.nz/site/tokelau/files/TokelauNSO/2016Census/profile-tokelau-2016-census-final-to-print28jun17jj.pdf> | official (TNSO/Stats NZ) | `009d3530ab790923e19372b52b9adba25c9f8896e775a17c32c96da6b0efa907` |
| `tk_2016_atafu_profile.pdf` | <https://www.tokelau.org.nz/site/tokelau/files/TokelauNSO/2016Census/Atafu%20atoll%20profile%202016%20Census.pdf> | official (TNSO) | `5c1458972bd8801c8c6afe83a542b1381eea1ba11aac4a4387232f7e0c62bf25` |
| `tk_2016_fakaofo_profile.pdf` | <https://www.tokelau.org.nz/site/tokelau/files/TokelauNSO/2016Census/Fakaofo%20atoll%20profile%202016%20Census.pdf> | official (TNSO) | `29b8abf92853247b306d29e6d42e8525e067546b481332739ef4444f38119e78` |
| `tk_2016_nukunonu_profile.pdf` | <https://www.tokelau.org.nz/site/tokelau/files/TokelauNSO/2016Census/Nukunonu%20atoll%20profile%202016%20Census.pdf> | official (TNSO) | `555ba720b3423ee9466e1c1a9dd68bdeed07bfce7ae88bca03926a89e6baed6d` |
| `geoBoundaries-TKL-ADM0.geojson` | <https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/TKL/ADM0/geoBoundaries-TKL-ADM0.geojson> | geoBoundaries gbOpen (pinned 9469f09) | `257b31214c1d66307a829de7441b4a91f4276fa5b2b8d3cf61f05d460d096486` |
| `gb_tkl_adm0_meta.json` | <https://www.geoboundaries.org/api/current/gbOpen/TKL/ADM0/> | geoBoundaries API | `51598bf4dab87377481852869ad4c793f89b71e13a4d6d4e927e29051a470ac4` |

Derived/context files also present in the cache (not source objects): `tk_2016_profile.txt`, `tk_2006_analytical_report.txt`, the three atoll-profile `.txt` extractions, and `census_page.html`, `stats_page.html`, `sdd_2022_collection.html` (page captures for the retrieval trail). The atoll-profile PDFs contain no religion table (the atoll religion detail lives in Table 2.5 / Table 5.8), and are cached only as provenance.

## Blockers

- **2022 is closed to the atoll series**: the only 2022 output is licensed microdata (`Other (Not Open)`, released August 2025), MOU/confidentiality-gated. No public 2022 religion-by-atoll table was found on TNSO, SDD, PDH, or ILO surveyLib. The three-wave 2006-2016 series is the ceiling unless TNSO/SPC releases a 2022 profile report or an open `.Stat` aggregate.
- **Pre-2006 waves unverified**: no public atoll religion table located for 1986/1991/1996/2001 (PDH catalog/190 holds 1996 as metadata-only microdata). Outside the buildable series.
- **Licence byte-match soft flag**: CLOSED by the conductor 2026-07-11 — the rendered Stats NZ copyright page is byte-matched and cached (see Rights position above).
- **2011 primary link is dead**: the retired `stats.govt.nz/browse_for_stats/…/2011-tokelau-census` pages 404, but the 2011 atoll counts are fully recovered from the live 2016 social-profile workbook (Table 5.8 prints 2011 and 2016 together), so 2011 has a clean public route regardless.

## Product boundary

A build on this probe stages a **three-wave, atoll-level** religious-affiliation series (2006, 2011, 2016) for Atafu, Fakaofo, and Nukunonu, on three atoll footprints derived from the geoBoundaries TKL ADM0 land-cover layer (CC BY 4.0) by longitude clustering. It uses the present-usual-resident universe, the stable Congregational / Presbyterian / Roman Catholic / Other Christian / (No religion) / Not stated frame, and the byte-matched counts above. It would **not** include a 2022 wave (licensed microdata only), a pre-2006 wave (no public atoll table), a places-of-worship layer (OSM returned 2 tagged places on the 2026-07-07 sweep — too sparse), or place-density metrics. The small-country clause does not need to be invoked as a fallback: Tokelau publishes the atoll religion detail the queue was chasing, three waves deep, open and reconciling — this is a first-class atoll product, not a national-only compromise.

## Build appendix (2026-07-11)

The build shipped as a FULL product under CC BY 4.0 (byte-matched). Builder: `scripts/build_tk_area_summary.R`. Outputs: `apps/regions/tk/data/tk_atoll_2022.geojson` (273,598 bytes, 3 features), `apps/regions/tk/data/area_summary_atoll.{json,csv}` (9 rows = 3 atolls x 3 waves), `docs/manifests/tk-census-religion-2006-2016.json`. Raw cache mirrored to `gs://pow-research-data/raw_sources/tk_census/` (19 objects) and recorded in `raw_cache_durable_uris`.

### Reconciliation gates (all passed, zero difference)

Each wave closes at both margins — every atoll column's category sum equals its printed atoll total, and every category row's three-atoll sum equals its printed national total — and the atoll-total and national-total sums share one grand total.

| Wave | Atafu | Nukunonu | Fakaofo | Grand total | Source table |
| --- | --- | --- | --- | --- | --- |
| 2006 | 417 | 287 | 370 | 1,074 | Table 2.5 (2006 Census Tables workbook) |
| 2011 | 385 | 309 | 449 | 1,143 | Table 5.8, 2011 block (2016 social-profile workbook) |
| 2016 | 413 | 385 | 399 | 1,197 | Table 5.8, 2016 block (2016 social-profile workbook) |

The counts read from the two workbooks match this probe's byte-matched tables exactly (workbook sha256s reverified: `tk_2006_tables.xls` e8af0913…, `tk_2016_social_profile_tables.xlsx` 2e09afee…).

National headline per wave (affiliation = Total − No religion − Not stated; affiliation counts every named denomination plus Spiritualism and New Age religions):

| Wave | Population | Affiliation | No religion | Not stated |
| --- | --- | --- | --- | --- |
| 2006 | 1,074 | 1,072 | 0 | 2 |
| 2011 | 1,143 | 1,137 | 0 | 6 |
| 2016 | 1,197 | 1,187 | 1 | 9 |

**2006 Nukunonu suppression.** The two `~` confidentiality cells (Presbyterian, Not Stated) render as suppressed nulls in the manifest category detail and are never estimated (MONSTAT z precedent). The printed Nukunonu atoll total (287) equals the sum of the three visible cells (Congregational 6 + Roman Catholic 278 + Other Christian 3 = 287), and the national Presbyterian (11) and Not Stated (2) totals are reached by Atafu and Fakaofo alone, so both suppressed cells are forced to zero. Nukunonu 2006 headline affiliation is therefore exact: 287 affiliated, 100.0 percent.

### Boundary gates (all passed)

The single geoBoundaries TKL ADM0 land-cover MultiPolygon explodes into 206 motu parts, every one assigned to an atoll by centroid longitude (thresholds −172.0 and −171.5, sitting in the ~0.6 degree inter-atoll gaps), then dissolved to three footprints.

- **Part assignment (0 orphans):** Atafu 58, Nukunonu 72, Fakaofo 76 (sum 206). The counts match this probe's part-index ranges (Fakaofo 76, Nukunonu 72, Atafu 58).
- **Part longitude ranges (non-overlapping):** Atafu [−172.5203, −172.4648], Nukunonu [−171.8680, −171.7659], Fakaofo [−171.2706, −171.1819]. Gaps of ~0.60 and ~0.50 degrees separate the clusters.
- **Dissolved footprint longitude ranges (non-overlapping):** Atafu [−172.5204, −172.4648] < Nukunonu [−171.8680, −171.7659] < Fakaofo [−171.2706, −171.1819].
- **Three valid features, three distinct geometry hashes.**
- **Swains contamination guard:** full-layer bbox ymin = −9.4435 (≥ −10); no part sits south of 10°S. Swains Island (near 11.05°S, US-administered) is outside the layer and the census.
- **Land area:** Atafu 3.104 km², Nukunonu 3.600 km², Fakaofo 3.106 km² (total 9.81 km², matching the release metadata meanAreaSqKM 9.803).
- **Simplification:** mapshaper weighted keep-shapes at 100% keep, 273,598 bytes (under the 1,500,000-byte cap).

### Licence

CC BY 4.0, byte-matched. The builder reverifies the operative clause verbatim in the cached Stats NZ copyright capture (`data/raw/tk_census/statsnz_copyright_page.txt`, sha256 `2f5053903b59f5fddf0441a4c742ecb8ad1d1ee6b2f312a62d4ad48413477aaa`): "Unless otherwise specified, content we produce is licensed under the Creative Commons Attribution 4.0 International licence." Product `licence_status` is `accepted`; `licence_basis` is `statsnz_tnso_cc_by_4_0_byte_matched_attribution`; the boundary basis is `geoboundaries_cc_by_4_0`. Attribution uses the adapted-content statement plus a Tokelau National Statistics Office acknowledgement.

### Deferred routes

2022 (licensed microdata only, PDH catalog/834) and the pre-2006 waves (no public atoll religion table) are recorded in the manifest `deferred_sources`; neither widens the shipped span.

### Schema validation (exact invocations and output)

```
$ uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json apps/regions/tk/data/area_summary_atoll.json
ok -- validation done

$ uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/data-manifest.schema.json docs/manifests/tk-census-religion-2006-2016.json
ok -- validation done

$ bash scripts/validate_manifests.sh
manifest validation: 65/65 pass
```
