# Solomon Islands census-religion route probe

Verified 2026-07-11. PROBE ONLY — no build, no commit. The Solomon Islands publishes religion **by province** as a clean, count-valued table for two census waves — 2009 and 2019 — and both waves also carry a finer religion-by-**ward** table. The queue premise ("province route unverified", "2019 religion route remains unresolved", "public table not pinned", metadata-first via PDH) is refuted on both counts: the province cross-tab is a published, openly downloadable table in each wave, the microdata is not needed, and the finest published geography is the ward, not the province. The 2019 route is table **P8.2** "Total population by province and religious denominations" (with ward detail in **P8.3**) in the SINSO 2019 Basic Tables (Vol 2); the 2009 route is table **P3.2** "Total population by province and religious denomination" (ward detail in **P3.1**) in the SINSO 2009 Basic Tables (Vol 2). Both tables count all persons of all ages, both close exactly at both margins, and both use the identical ten-unit geography (nine provinces plus Honiara) that matches the geoBoundaries SLB ADM1 layer one-to-one after a three-name concordance. The one genuine gate is the licence: the SINSO reports carry no stated reuse terms (the Pacific vacuum), though the SPREP re-host of the 2009 file attaches a Creative Commons Public Data License and the boundary is Public Domain. Deeper history (1999, 1986) does not extend the province series: 1999 religion is published only nationally, and 1986 predates the province geography, so the buildable product is a two-wave 2009-2019 province series, not a 1986-2019 span.

## Build decision (recommendation to the conductor)

- **Recommendation**: BUILD a ten-unit, two-wave religious-affiliation province series (2009, 2019), pending a PI licence ruling. The province detail the queue hoped for is published, open, count-valued, and reconciles in both waves — this clears the small-country bar comfortably.
- **Candidate waves**: 2009 (P3.2) and 2019 (P8.2) as levels, with broad-affiliation change readable across the pair. A ward-level product (P3.1 / P8.3, ~180 wards) is a documented deeper-geography route but has no matching open boundary layer at ward granularity (geoBoundaries ADM2 is 50 units — the constituencies, not the census wards).
- **Candidate geography**: 10 units (Choiseul, Western, Isabel, Central, Rennell-Bellona, Guadalcanal, Malaita, Makira-Ulawa, Temotu, Honiara) on the geoBoundaries SLB ADM1 frame (10 units, one-to-one join after three name mappings).
- **Construct**: census affiliation. Each resident's reported religion/denomination (questionnaire item P11, "What is this person's religion?"), asked of all persons; not practice, attendance, or membership.
- **Change metric**: readable across 2009 to 2019 at the broad-affiliation level because every wave counts all persons of all ages. Finer denomination detail is limited by frame widening — Pentecostal, Assembly of God, Baptist Church, and Muslim are printed as separate lines only in 2019 (they sit inside "Other" in 2009). Publish a broad-affiliation province series across both waves; reserve the finest denomination rows for 2019.
- **Map-worthy pattern**: the ten units are sharply contrasted denominationally, and the contrast is legible directly in the counts. Isabel is overwhelmingly Church of Melanesia (2019: 27,991 of 31,420, 89 percent); Choiseul and Western are dominated by the United Church (Choiseul 2019: 16,478 of 30,775, 54 percent); Guadalcanal and Malaita split between Roman Catholic and South Sea Evangelical; Rennell-Bellona is heavily Seventh Day Adventist and South Sea Evangelical. This province-level contrast is the reason to map Solomon Islands.
- **Rights position**: no stated reuse licence on the SINSO published tables in either wave (the Palau/FSM vacuum). The SPREP-hosted copy of the 2009 Basic Tables carries the SPREP "Public Data License Agreement (Creative Commons)"; the boundary is Public Domain (Natural Earth via geoBoundaries). Ship derived province summaries with attribution to the Solomon Islands National Statistics Office (SINSO) under the summaries-not-raw-data stance, or hold for a PI ruling.

## Published waves and geography

| Year | Official route | Religion-by-province table | Universe | Finest published geography | Decision |
| --- | --- | --- | --- | --- | --- |
| 2009 | [SINSO 2009 Report on Population & Housing Census — Basic Tables (Vol 2)](https://solomonislands-data.sprep.org/system/files/2009_Census_Report-on-Basic-Tables-Vol2.pdf) (SPREP-hosted copy; also SPC SDD digital library "Solomon Islands 2009 Census Report Vol 2") | **P3.2** "Total population by province and religious denomination, Solomon Islands: 2009" (text-extractable counts, 13 categories) | all persons, all ages | ward (P3.1) | Ship the ten-unit 2009 wave. |
| 2019 | [SINSO 2019 Population Census Report — Basic Tables & Operations (Vol 2)](https://solomons.gov.sb/wp-content/uploads/2023/09/Solomon-Islands-2019-Population-Census-Report_Basic-Tables_Operations_Vol2.pdf) (solomons.gov.sb) | **P8.2** "Total population by province and religious denominations, Solomon Islands: 2019" (text-extractable counts, 17 categories) | all persons, all ages | ward (P8.3) | Ship the ten-unit 2019 wave. |
| 1999 | SPC digital library "1999 Solomon Islands Population Census Factsheet"; national religion counts printed in the 2019 National Report Table 8.3.1 | **national only** — no public religion-by-province table located | all persons | national | HOLD — outside the buildable province series. |
| 1986 | not located | none — predates the current province geography | — | — | HOLD — pre-1991/1993 province split; do not backcast. |

The SINSO site (`statistics.gov.sb`) and the SIG services portal (`solomons.gov.sb`) are the sources of record for 2019; the 2009 Basic Tables were retrieved from the SPREP Solomon Islands environment data portal (`solomonislands-data.sprep.org`), which mirrors the SINSO/SPC file, and the same 2009 Vol 2 is catalogued on the SPC Statistics for Development Division digital library (`sdd.spc.int/sb`). The Pacific Data Hub / SPC microdata records are not the route and were not needed: both waves' province-and-religion aggregates are published in the open Basic Tables PDFs. The 2019 National Report (Vol 1) carries the national religion narrative (§8.3) and the 1999/2009/2019 national comparison (Table 8.3.1) but not a religion-by-province table — the province cross-tab lives only in the Basic Tables (Vol 2).

## Category frames

The 2009 frame prints 13 lines; 2019 widens it to 17 as new bodies split out of "Other". Preserve each source spelling per wave.

| 2009 (P3.2, source order) | 2019 (P8.2, source order) | Product role |
| --- | --- | --- |
| Church of Melanesia | Church of Melanesia | religious affiliation |
| Roman Catholic | Roman Catholic | religious affiliation |
| South Sea Evangelical Church | South Sea Evangelical Church | religious affiliation |
| Seventh Day Adventist | Seventh Day Adventist | religious affiliation |
| United Church | United Church | religious affiliation |
| Christian Fellowship Church | Christian Fellowship Church | religious affiliation |
| Christian OutReach | Christian OutReach Church | religious affiliation |
| (in Other) | Pentecostal | religious affiliation |
| Jehovah's Witness | Jehovah's Witness | religious affiliation |
| Bahai | Bahai Faith | religious affiliation |
| (in Other) | Assembly of God | religious affiliation |
| (in Other) | Muslim | religious affiliation |
| (in Other) | Baptist Church | religious affiliation |
| Other | Other religions | residual affiliation |
| Custom Beliefs | Custom Beliefs or Animism | indigenous belief |
| No Religion | No Religion or Faith/Atheism | no-religion |
| Refuse to Answer | Refuse to Answer | non-response |

Two frame facts govern comparability. The first frame fact is denominational splitting: the 2009 thirteen-line frame folds Pentecostal, Assembly of God, Baptist Church, and Muslim into "Other", so treating the 2009 "Other" (14,076) as comparable to the 2019 "Other religions" (14,953) would misread the split-out, not a real change; the broad spine (Church of Melanesia, Roman Catholic, South Sea Evangelical, Seventh Day Adventist, United Church, Christian Fellowship, Christian OutReach, Jehovah's Witness, Bahai, plus the always-separate Custom Beliefs/No Religion/Refuse) is comparable across both waves. The second frame fact is the naming drift on three lines — "Christian OutReach" (2009) to "Christian OutReach Church" (2019), "Bahai" to "Bahai Faith", "Custom Beliefs" to "Custom Beliefs or Animism", and "No Religion" to "No Religion or Faith/Atheism" — same body, widened label; map each to a stable display label. A shared product should publish broad religious-affiliation totals per province across both waves and reserve the four split-out 2019 denomination rows for the 2019 wave alone.

The 2019 National Report Table 8.3.1 also prints a national 1999/2009/2019 series with its own label set; it confirms the frame widening (Pentecostal, Assembly Of God, Baptist Church, Muslim show "-" for 1999 and 2009, counts only in 2019) and that 1999 carried a distinct "NS" not-stated line (1,413) absent from 2009/2019.

## Universe and denominator

Every wave counts all persons of all ages, so there is no universe break and the province denominators are directly comparable. The religion question (P11, "What is this person's religion?") is asked of the whole resident population, and each wave's religion-table total equals the full census count: 2009 P3.2 total 515,870 (the full 2009 resident population); 2019 P8.2 total 720,956 (the full 2019 population). The population grows across the pair (515,870 to 720,956, +39.8 percent), so the build reads religious shares within each province's own wave denominator and never treats population growth as a religion change.

## Reconciliation gates (verified in the probe)

- **2009 (P3.2)**: the ten province totals (26,372 + 76,649 + 26,158 + 26,051 + 3,041 + 93,613 + 137,596 + 40,419 + 21,362 + 64,609) sum to the printed national 515,870, and the Church of Melanesia row sums across provinces (285 + 2,605 + 23,183 + 21,747 + 170 + 22,311 + 36,241 + 18,947 + 18,640 + 20,510) to the printed 164,639. Both margins close exactly.
- **2019 (P8.2)**: the ten province totals (30,775 + 94,106 + 31,420 + 30,318 + 4,100 + 154,022 + 172,740 + 51,587 + 22,319 + 129,569) sum to the printed national 720,956, and the Church of Melanesia row sums (603 + 4,638 + 27,991 + 24,959 + 243 + 40,817 + 49,710 + 23,509 + 19,003 + 40,568) to the printed 232,041. Both margins close exactly.
- **Cross-source anchor**: the 2019 National Report Table 8.3.1 national totals (Church of Melanesia 164,639 in 2009 and 232,041 in 2019; national 515,870 in 2009 and 720,956 in 2019) match the Basic Tables province-table margins exactly, so the two independent SINSO products reconcile.
- The build stops and records any failing row on arithmetic mismatch; no value is allocated, inferred, rounded, or tuned. No cell suppression was observed in either province table (dashes read as nil).

## Boundary source and licence

The boundary is [geoBoundaries SLB ADM1](https://www.geoboundaries.org/api/current/gbOpen/SLB/ADM1/). The release metadata states `"admUnitCount": "10"`, `"boundaryType": "ADM1"`, `"boundaryYearRepresented": "2021"`, `"boundarySource": "Natural Earth"`, `"boundaryLicense": "Public Domain"`, `"licenseSource": "www.naturalearthdata.com/about/terms-of-use/"`, and `"gjDownloadURL"` pinned at commit `9469f09`. The build uses that release metadata as the licence authority. This is the cleanest boundary-rights position in the Pacific tranche — Public Domain, no attribution obligation on the geometry.

The layer carries exactly ten `shapeName` values — `Choiseul`, `Western`, `Isabel`, `Central`, `Rennell and Bellona`, `Guadalcanal`, `Malaita`, `Makira`, `Temotu`, `Capital Territory (Honiara)` — and joins the census one-to-one after a three-name concordance: geoBoundaries `Makira` maps to census `Makira-Ulawa`; geoBoundaries `Rennell and Bellona` maps to census `Rennell-Bellona`; geoBoundaries `Capital Territory (Honiara)` maps to census `Honiara`. The remaining seven names match directly. No unit is missing and no extra unit is present.

**Dateline**: no crossing. The ten polygons span longitude **155.508 E to 168.826 E** and latitude **12.291 S to 6.600 S** (verified from the geometry), wholly east of and well within the [−180, 180] frame and far from the antimeridian, so no 0-360 shift is needed — this confirms the brief's expectation that Solomon Islands (~155-170 E) requires no dateline handling. A naive national bounding box is safe here, unlike the Kiribati/Fiji Pacific siblings.

The ADM2 layer (`admUnitCount` 50) is the **constituencies**, not the census wards (~180), so it does not support the ward tables (P3.1 / P8.3). A ward-level product would need a ward boundary layer not present in geoBoundaries; the province ADM1 layer is the buildable frame.

## Licence position

No reuse licence is stated on the SINSO published census reports in either wave. The 2009 Basic Tables (Vol 2), the 2019 Basic Tables (Vol 2), and the 2019 National Report (Vol 1) carry acknowledgement front matter but no copyright, rights-reserved, or Creative Commons statement in the document text (verified by front-matter text scan of all three PDFs — the only near-hits are administrative acknowledgements, not a rights clause). The SINSO website's religion article carries only a footer line, quoted verbatim from the fetched page: "Copyright 2023 @ Solomon Islands National Statistics Office" — a copyright assertion, not a reuse grant. This mirrors the Palau/FSM/Kiribati precedent: there is no byte-matched reuse-licence quote to pin on the SINSO religion tables because no such licence text exists on the SINSO source.

One re-host does attach a licence. The SPREP Solomon Islands environment data portal, which hosts the copy of the 2009 Basic Tables retrieved here, labels the dataset with the **SPREP "Public Data License Agreement"**; the fetched licence resource page (`pacific-data.sprep.org/resource/public-data-license-agreement-0`) describes it verbatim as a "Public Data License Agreement available for use by PICs for their Environment Data Portals" distributed as "Public Data License Agreement (Creative Commons).docx" — a Creative Commons-based public-data licence. This licence governs the SPREP-hosted copy, not the SINSO original; the authoritative source is SINSO, whose file carries no such grant. Record the SPREP CC-based licence as the licence under which the SPREP mirror is distributed, and the SINSO source licence as unknown.

The recommended position mirrors Palau, Côte d'Ivoire, Iran, and the FSM/Kiribati siblings: publish derived ten-province religion summaries with attribution to the Solomon Islands National Statistics Office (SINSO), record the source tables' licence as unknown, and defer to a PI ruling; the SPREP Creative Commons re-host and the Public Domain boundary are the clean edges of the rights chain. A SINSO reuse-confirmation email is the clean unblock. No microdata is touched, so no PDH access restriction binds the product.

## Retrieval record

Every cached input is under `data/raw/sb_census/`, which `git check-ignore -v` confirms is excluded by `.gitignore:120` (the `data/` rule). Retrieval occurred on 2026-07-11. Content type was verified on every download (all report objects `application/pdf` / valid PDF; geojson valid JSON; metadata `application/json`).

| Cached input | Source URL | Hosting | SHA-256 |
| --- | --- | --- | --- |
| `sb_2019_basic_tables_vol2.pdf` | <https://solomons.gov.sb/wp-content/uploads/2023/09/Solomon-Islands-2019-Population-Census-Report_Basic-Tables_Operations_Vol2.pdf> | official (SIG portal / SINSO) | `c9ebff41b931a65c408784f30344fbec6d13a3b7bbfe534384399268db0f96c9` |
| `sb_2019_national_report_vol1.pdf` | <https://solomons.gov.sb/wp-content/uploads/2023/09/Solomon-Islands-2019-Population-and-Housing-Census_National-Report-Vol-1.pdf> | official (SIG portal / SINSO) | `4836c4f1daf94dd7e80922e30b987c53871a7bd69e47548de917ec2aabfe2227` |
| `sb_2009_basic_tables_vol2.pdf` | <https://solomonislands-data.sprep.org/system/files/2009_Census_Report-on-Basic-Tables-Vol2.pdf> | SPREP SI environment data portal (mirror of SINSO/SPC) | `e411ae210c71807dc6ca10ee4c9b110ae7b7e28a142c78e200e9812e873524a0` |
| `geoBoundaries-SLB-ADM1.geojson` | <https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/SLB/ADM1/geoBoundaries-SLB-ADM1.geojson> | geoBoundaries gbOpen (pinned 9469f09) | `bd22f4cdce1c19066950b8c384c4d484a21a0dcaee5f207e363179f68c58c69d` |
| `gb_slb_adm1_meta.json` | <https://www.geoboundaries.org/api/current/gbOpen/SLB/ADM1/> | geoBoundaries API | `5800317b132d58cf6de80df1283d4f23f455fa14d7bcad67e02e661c627b1db6` |
| `gb_slb_adm2_meta.json` | <https://www.geoboundaries.org/api/current/gbOpen/SLB/ADM2/> | geoBoundaries API | `90026ff939a16699c9b151b5ffca25875d5fce750500cc9fc484cccb37daaad4` |
| `sprep_public_data_license_page.html` | <https://pacific-data.sprep.org/resource/public-data-license-agreement-0> | SPREP (licence page capture) | `f7a626576591a948e3dc95679a9b9eeefd51d30c7c541895eec0ef5ec9d66397` |
| `sinso_religion_article.html` | <https://statistics.gov.sb/church-of-melanesia-remains-as-most-populous-religious-denomination-with-a-40-increase-since-2009/> | official (SINSO, copyright-line capture) | `3ba44e6bdd94c2dfe98735ca6a272c55d2212461ede8beccfe1192a00f492c0e` |

Derived working files also present in the cache (not source objects): `sb_2019_basic_tables_vol2.txt`, `sb_2019_national_report_vol1.txt`, `sb_2009_basic_tables_vol2.txt` (pdftotext `-layout` extractions).

## Earlier waves (1999, 1986) — outside the buildable province series

Religion was asked in the 1999 census, and its national totals are published (the 2019 National Report Table 8.3.1 prints Church of Melanesia 134,288; Roman Catholic 77,728; national 409,042 for 1999). A 1999 SPC digital-library factsheet exists. No 1999 **religion-by-province** table was located in any open product — the 1999 detail is national only in what is published, so 1999 does not extend the province series without recovering the 1999 census volumes. The 1986 wave was not located as an open religion table, and it predates the current province geography: Choiseul separated from Western in 1991 and Rennell-Bellona separated from Central in 1993, so a 1986 province set differs from the ten units used in 2009/2019. Consistent with the standing no-backcast rule, the probe records 1986 and 1999 as HOLD and does not invent a province concordance across the 1991/1993 boundary changes. The buildable province product is the 2009-2019 pair.

## Blockers

- **Licence**: no stated reuse terms on the SINSO published religion tables in either wave (the Palau/FSM vacuum). This is the one genuine gate. Resolve by PI ruling (summaries-with-attribution) or a SINSO reuse-confirmation email. The SPREP re-host of the 2009 file carries a Creative Commons Public Data License, and the boundary is Public Domain — both clean, needing no ruling.
- **Frame widening (2009 to 2019)**: the 2009 thirteen-category frame folds Pentecostal, Assembly of God, Baptist Church, and Muslim into "Other"; denomination change for those four bodies is not readable across the pair. The broad-affiliation spine is comparable across both waves.
- **Series depth**: the province series is two waves (2009, 2019), not the 1986-2019 span the queue row implied. 1999 is national-only in open products; 1986 predates the province geography. Neither is a blocker on the 2009-2019 build, but both cap the depth.
- **Ward geography has no open boundary**: the census publishes religion by ward (P3.1 / P8.3, ~180 wards), a richer geography than the province, but geoBoundaries offers only ADM1 (10 provinces) and ADM2 (50 constituencies) — no ward layer. A ward-level product would need a ward boundary source located and licensed first.

## Product boundary

A build on this probe would stage ten-province religious-affiliation summaries for 2009 (all-ages, from Basic Tables P3.2) and 2019 (all-ages, from Basic Tables P8.2) on the geoBoundaries SLB ADM1 frame, with a broad-affiliation change layer readable across the pair and a finer denomination view for 2019 alone. It would carry the verbatim per-wave category frames, the three-name boundary concordance (Makira/Makira-Ulawa, Rennell and Bellona/Rennell-Bellona, Capital Territory (Honiara)/Honiara), and fail-fast reconciliation at both margins (both waves close exactly). It would not contain a place-of-worship layer, place-density metrics, a ward-level layer (published but with no open boundary), a 1999 wave (national-only in open products), or a 1986 wave (pre-split geography). The SINSO licence confirmation is the clean unblock, and the 1999 province tables (if recoverable from the 1999 census volumes) plus a ward boundary layer are the recorded routes to deepen the product.
