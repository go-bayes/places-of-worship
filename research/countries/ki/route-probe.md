# Kiribati census-religion route probe

Verified 2026-07-11. PROBE ONLY — no build, no commit. Kiribati publishes a numeric island-by-religion cross-tabulation for six census waves, and the record is far stronger than the rank-54 metadata-first survey implied. Five waves (1990, 1995, 2000, 2005, 2010) ship as clean Excel "Religion by Island" tables on the Kiribati National Statistics Office (KINSO) site, and 2015 ships as a text-extractable island table in the printed report. The single gap is the newest wave: the 2020 census publishes religion only nationally in print (Table G-3), with island-level religion released only as pie charts in the SPC/KINSO Census Atlas or held in the licensed microdata. The queued boundary recommendation is wrong for this build: geoBoundaries KIR ADM1 has three units (the island groups), not the islands; the correct layer is KIR ADM2 (24 units), which matches the census island roster. Two acute geometry traps confirmed empirically: Kiribati straddles the antimeridian (Gilberts near +177 East, Line Islands near -157 West) and spans roughly 3,900 km, so any national bbox or centroid in a raw [-180,180] frame smears across the globe.

## Build decision (recommendation to the conductor)

- **Recommendation**: BUILD the island-by-religion time series for the six waves with a clean public numeric route (1990, 1995, 2000, 2005, 2010, 2015), pending a PI licence ruling. Treat 2020 island-level religion as a follow-up, not a blocker on the series: the 2020 national frame is published, and the island detail needs one of three unblocks (a KINSO/SPC custom PDH.Stat tabulation, an NSO custom-table request, or the licensed microdata). Do not gate the whole country on 2020.
- **Candidate waves (numeric, public)**: 1990, 1995, 2000, 2005, 2010 (Excel "Table 10. Religion by Island"); 2015 (report "Table 6. Population by island, sex and religion", text-extractable).
- **Candidate geography**: 24 islands on the geoBoundaries KIR ADM2 frame (24 units), with a name concordance (below). NOT ADM1 (3 groups).
- **Construct**: census affiliation. The census item (P8 in 2020) records each resident's reported religion, single-select; not practice, attendance, or membership.
- **Change metric**: publishable across 1990-2015 at a harmonised broad-affiliation level, but two frame breaks must be carried (the KPC/KUC split in 2020 and the growing denominational detail over time). Any 2020 island change reading waits on the 2020 island route.
- **Rights position**: mixed. The Census Atlas carries an explicit SPC/KINSO partial-reproduction-with-acknowledgement clause (verbatim below, the Tonga/Nauru Pacific posture); the printed reports and the historical Excel tables carry no stated licence (the Palau/Côte d'Ivoire summaries-with-attribution stance); the microdata is licensed and access-restricted.

## Published waves and geography

| Year | Official route | Island-by-religion table | Format | Universe | Finest geography | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| 1990 | `census-tables-kiribati-1990.xlsx` (KINSO) | "Table 10. Religion by Island, Kiribati: 1990" (`Religion` sheet) | Excel, numeric | all persons | island (~21) | Ship as a levels wave. |
| 1995 | `census-tables-kiribati-1995.xlsx` (KINSO) | "Table 10. Religion by Island, Kiribati: 1995" | Excel, numeric | all persons | island | Ship. |
| 2000 | `census-tables-kiribati-2000.xlsx` (KINSO) | "Table 10. Religion by Island, Kiribati: 2000" | Excel, numeric | all persons | island | Ship. |
| 2005 | `census-tables-kiribati-2005.xlsx` (KINSO); plus per-island village workbooks | "Table 10. Religion by Island: 2005" (island); per-island "Table 7. Population by village, sex and religion" (village) | Excel, numeric | all persons | island; village | Ship island; village optional. |
| 2010 | `census-tables-kiribati-2010.xlsx` (KINSO); 2010 Report Vol 1 | "Table 10. Religion by Island, Kiribati: 2010" (`Religion` sheet) | Excel, numeric | all persons | island (24 cols) | Ship. |
| 2015 | [2015 Population Census Report Volume 1](https://nso.gov.ki/download/25/population/1217/2015-population-census-report-volume-1final-211016.pdf) (KINSO) | "Table 6. Population by island, sex and religion: 2015" (report pp. 56ff) | PDF, text-extractable | all persons (110,136) | island (24) | Ship. |
| 2020 | [2020 General Report and Results](https://nso.gov.ki/download/146/2020-census/1965/population-and-housing-census-report-2020) (KINSO, 183 pp) | Table G-3 is **national only**; island religion appears only as pie charts (Map 18) in the [Census Atlas 2022](https://nso.gov.ki/download/117/other-reports/2022/kiribati-census-atlas-2022.pdf) | image table (national); graphical (island) | all persons (119,438) | national (numeric); island (graphical, 4-cat pies) | HOLD island detail; national frame is publishable. |

The KINSO site (`nso.gov.ki`, the office referenced in the brief as `mfed.gov.ki` — it has since moved to its own domain) is the source of record. The full file inventory was recovered from the site's WordPress file-download sitemap (`https://nso.gov.ki/wp-sitemap-posts-wpfd_file-1.xml`), which also lists deeper history workbooks (`census-tables-kiribati-1968/1973/1985`) not probed here. The 2020 [Island Profile workbook](https://nso.gov.ki/download/146/2020-census/1931/island-profile-table-final.xlsx) has one sheet per island but carries only demographic, labour, and education tables — **no religion**; it is not the 2020 island-religion route.

The [Pacific Data Hub microdata](https://microdata.pacificdata.org/index.php/catalog/767) (2020, catalog/767) and [2015](https://microdata.pacificdata.org/index.php/catalog/199) (catalog/199) hold the religion and geography variables but are **licensed datasets, access-restricted** (a signed confidentiality declaration is required); they are not needed for 1990-2015 and are the fallback for 2020 island detail.

## Category frames

Preserve each source spelling per wave. The frame widens over time and carries one structural break (KPC to KUC). Verbatim frames observed:

| Wave | Categories (verbatim, in source order) |
| --- | --- |
| 1990 | Kiribati Protestant Church; Roman Catholic; Seventh Day Adventist; Bahai; Church of God; Latter Day Saints; Other; None (8) |
| 2005 (village) | KPC; RC; SDA; Bahai; COG; Mormon; AOG; Other; None (9) |
| 2010 | Catholic; Kiribati Protestant Church; Seven Day Adventist; Church Of God; Mormon; Assembly of God; Bahai; Te koaua; Muslim; None; Not Stated; Other (12) |
| 2015 | Roman Catholic; KPC; Seventh Day Adventist; Church Of God; Latter Day Saints; Assembly of God; Jehova's Witness; Bahai; Four Square; Te Koaua; Islam; Te Ran; All Nation; No religion; Other (~15) |
| 2020 (national, G-3) | Catholic; Kiribati Protestant Church (KPC); Kiribati Uniting Church (KUC); The Church of Jesus Christ of Latter Day (Mormon); Bahai; Jehovah's Witness; Seventh-day Adventist; Assemblies of God; All Nations; United Pentecostal Church International; Baptist Church; Church of God; Te Ran; Muslim; No religion; Other religion; Not Stated (18) |

**The KPC/KUC break governs the time series.** Through 2015 the dominant Protestant body is recorded as one category, "Kiribati Protestant Church (KPC)". The Kiribati Uniting Church (KUC) formed in 2014 from the KPC and smaller related denominations, and the 2020 census records **both** KPC (10,016) and KUC (25,322) as separate rows. For a comparable Protestant series, combine KPC and KUC in 2020 (35,338); the Census Atlas itself collapses them to a single "KUC-KPC" slice in Map 18 and Table 9. The indigenous-linked movements (Te koaua / Te Koaua, Te Ran) also shift naming and appearance across waves and need a per-wave concordance to a stable display label. A shared product should publish a small harmonised set (Catholic, KPC+KUC/Protestant, Latter Day Saints, Seventh Day Adventist, Bahai, a residual "Other/None/Not Stated") across all waves, and reserve fine denominational rows for the waves that carry them.

## Universe and denominator

Every wave counts all persons, all ages (the 2015 report Table 6 totals 110,136, the full 2015 resident population; the 2010 table totals 103,058; the 2020 G-3 totals 119,438). No universe break across waves, unlike Palau. The 2020 G-3 frame closes exactly: the 18 category counts sum to the printed Total of 119,438. The build must still run the standard fail-fast reconciliation per wave (island rows to national total; category columns to national total) and stop on any mismatch.

## Boundary source and licence

**Use geoBoundaries KIR ADM2, not ADM1.** ADM1 metadata records `"admUnitCount": "3"` — the three island groups (Gilbert, Line, Phoenix), useless for island-level religion. ADM2 metadata records `"admUnitCount": "24"`, `"boundaryType": "ADM2"`, `"boundaryYearRepresented": "2017"`, `"boundarySource": "OpenStreetMap, Wambacher"`, `"boundaryLicense": "Open Data Commons Open Database License 1.0"`, `"licenseSource": "www.openstreetmap.org/copyright"`. The 24 ADM2 units match the census island roster one-to-one after a name concordance:

- geoBoundaries `Tarawa Ieta` maps to census `North Tarawa`.
- geoBoundaries `Tarawa Teinainano` maps to census `South Tarawa` (the mainland South Tarawa council).
- geoBoundaries `Betio` maps to census `Betio` (South Tarawa is split into Betio and South Tarawa in both frames).
- geoBoundaries `Tabiteuea North` / `Tabiteuea South` map to census `North Tabiteuea` / `South Tabiteuea` (`NTabiteuea` / `STabiteuea`).
- geoBoundaries `Teraina` maps to census `Teeraina`.
- The remaining ~19 names match directly (Abaiang, Abemama, Aranuka, Arorae, Banaba, Beru, Butaritari, Kanton, Kiritimati, Kuria, Maiana, Makin, Marakei, Nikunau, Nonouti, Onotoa, Tamana, Tabuaeran).

The build uses the ADM2 release metadata as the licence authority (ODbL 1.0). No official KINSO island-polygon layer was pinned; geoBoundaries/OSM under ODbL is the recommendation, consistent with the Pacific builds.

## Antimeridian and bbox assessment (the two acute traps)

Both traps are real and were checked against the actual ADM2 geometry.

- **Antimeridian (the FJ smear trap, in full).** The 24-feature ADM2 layer has a raw longitude extent of **-171.723 West to +176.848 East** and a latitude extent of **-2.871 to +4.699**. In the raw [-180,180] frame that is a ~348-degree span: a national bounding box, centroid, or tile computed naively would wrap the wrong way around the globe. No single island polygon crosses the line itself (the maximum internal longitude span of any one feature is well under 180 degrees — each atoll is compact and sits wholly on one side), so per-feature geometry is safe; the assembled layer, the national bbox, and any national centroid are not. **Remedy**: shift to a 0-360 frame (cut at 180). In 0-360 the extent is a clean **169.521 to 202.836** (~33 degrees). Gate in both frames as the FJ build did.
- **Bbox completeness across ~3,900 km.** The east cluster (Gilberts plus Banaba) sits at 169.5-176.8 East; Phoenix (Kanton) sits near -171.7 West (~188 in 0-360); the Northern Line Islands (Teraina, Tabuaeran, Kiritimati) sit at -160 to -157 West (~200-203 in 0-360). A bbox drawn around the Gilberts alone drops all four Line/Phoenix islands, and Banaba (a lone western outlier) is easy to lose from a Gilberts-centred box. The census tables and the ADM2 layer both carry all 24 units; the build must verify no island falls outside the frame, exactly as the Palau small-island (Sonsorol/Hatohobei) completeness gate required.

## Licence position

The chain carries three different postures; pin each.

- **Census Atlas 2022** — explicit SPC/KINSO reproduction clause, verbatim: "All rights for commercial/for profit reproduction or translation, in any form, reserved. SPC and KINSO authorise the partial reproduction or translation of this material for scientific, educational or research purposes, provided that SPC and KINSO, and the source document are properly acknowledged. Permission to reproduce the document and/or translate in whole, in any form, whether for commercial/for profit or non-profit purposes, must be requested in writing. Original SPC and KINSO artwork may not be altered or separately published without permission." Copyright line: "© Pacific Community (SPC), the Kiribati National Statistics Office (KINSO) 2022". This clause covers the Atlas (the 2020 island pies) and authorises the project's derived summaries with acknowledgement; it does not authorise republishing the Atlas maps themselves.
- **Printed census reports (2015 Vol 1, 2020 General Report) and the historical Excel tables (1990-2010)** — no stated reuse licence, no copyright page, no rights-reserved statement. SPC appears only in acknowledgements as the technical partner. As with Palau and Côte d'Ivoire, there is no verbatim licence text to quote for these; the recommended position is to publish derived island summaries with attribution to KINSO under the project's summaries-not-raw-data stance, record the licence as unknown, and defer to a PI ruling. A KINSO reuse-confirmation email is the clean unblock.
- **Pacific Data Hub microdata (2015, 2020)** — "Licensed datasets, accessible under conditions", a signed confidentiality declaration required, with the standard citation and the "no responsibility ... for interpretations or inferences" disclaimer. Restricted; use only as the 2020 island-detail fallback and only for derived aggregates.

## Retrieval record

Every cached input is under `data/raw/ki_census/`, which `git check-ignore -v` confirms is excluded by `.gitignore:120` (the `data/` rule). Retrieval occurred on 2026-07-11.

| Cached input | Source URL | Hosting | SHA-256 |
| --- | --- | --- | --- |
| `ki_2020_general_report.pdf` | <https://nso.gov.ki/download/146/2020-census/1965/population-and-housing-census-report-2020> | official (KINSO) | `a4f158ddf3548468825338d9ced5bc8d04dca1f349916748ff204974a0102eed` |
| `ki_census_atlas_2022.pdf` | <https://nso.gov.ki/download/117/other-reports/2022/kiribati-census-atlas-2022.pdf> | official (SPC/KINSO) | `56b0461dd54bbfb6f3ab894fa6b4f9be68f0d1b28a34670b9c67fcc3aa1f464b` |
| `ki_2015_census_report_vol1.pdf` | <https://nso.gov.ki/download/25/population/1217/2015-population-census-report-volume-1final-211016.pdf> | official (KINSO) | `d95e5bba9a9a460c96aacd1fa0beae331409ae03fd5bb27491d16332c5979bcc` |
| `ki_2010_census_report_vol1.pdf` | <https://nso.gov.ki/download/53/2010-census/891/kiribati-2010-census-report-vol-1.pdf> | official (KINSO) | `12187e390ec01b23344131fb881af32adc4e963aa7a37706d0b691e56fcbcf1c` |
| `ki_census_tables_1990.xlsx` | <https://nso.gov.ki/download/96/previous-to-2010/1135/census-tables-kiribati-1990.xlsx> | official (KINSO) | `f40a0359d9fe14feef7c1179c985b8effa6af40d02a62170520bf1051f6c29fc` |
| `ki_census_tables_1995.xlsx` | <https://nso.gov.ki/download/96/previous-to-2010/1136/census-tables-kiribati-1995.xlsx> | official (KINSO) | `68b3c97dfeb77c0e68deadbebed2658375ce0a406b467be7ffe16d260b0d53e7` |
| `ki_census_tables_2000.xlsx` | <https://nso.gov.ki/download/96/previous-to-2010/1138/census-tables-kiribati-2000.xlsx> | official (KINSO) | `3bc845e18d130c0585d9196e44b4facf3e5498e6b37e814f703a349b2e6889f5` |
| `ki_census_tables_2005.xlsx` | <https://nso.gov.ki/download/96/previous-to-2010/1141/census-tables-kiribati-2005.xlsx> | official (KINSO) | `2e0e7aa8d41c28779732746562e06e7a17bd39ab40a3d7c71448711772f3dcb8` |
| `ki_census_tables_2010.xlsx` | <https://nso.gov.ki/download/96/previous-to-2010/1142/census-tables-kiribati-2010.xlsx> | official (KINSO) | `5c6b8538c208bc898794c5a70bf85f673a2cca2cedbfd4f4a0219386c57866df` |
| `ki_2020_island_profile.xlsx` | <https://nso.gov.ki/download/146/2020-census/1931/island-profile-table-final.xlsx> | official (KINSO) | `8494e0f58e70981655192044c11cd8c39e358c22d0b972ed4ffd48802f818288` |
| `ki_2005_teraina_general_tables.xlsx` | <https://nso.gov.ki/download/145/teraina-washington-island/1803/1-general-tables-13> | official (KINSO) | `b0526c529fc9ee07cfbfa518807a5b8ad2910099338609eca7370a1f21fbca0b` |
| `geoBoundaries-KIR-ADM2.geojson` | <https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/KIR/ADM2/geoBoundaries-KIR-ADM2.geojson> | geoBoundaries gbOpen (pinned 9469f09) | `97c5b87cfbac364d718ad87373c7b4afc52bbbaf4712ee2fc5b98c9ed84e909a` |
| `gb_kir_adm2_meta.json` | <https://www.geoboundaries.org/api/current/gbOpen/KIR/ADM2/> | geoBoundaries API | `f1867265db7986db7bcf0e96526788d46b5c147b844969236a756e3c043f5fcb` |
| `gb_kir_adm1_meta.json` | <https://www.geoboundaries.org/api/current/gbOpen/KIR/ADM1/> | geoBoundaries API | `b0bd58ec351dd2997e4e805fc1ff261cda47af35bec03d4319df40c5cf1aed34` |

Derived working files also present (not source objects): `ki_2020_general_report.txt`, `ki_2015.txt`, `atlas.txt` (pdftotext extractions), and rendered table pages (`g3actual-018.png` = 2020 G-2/G-3; `apg49-049.png` = Atlas Map 18 religion pies; `atlaspg34-034.png` = Atlas Map 10 density showing the three-panel antimeridian split).

## Blockers

- **2020 island-level religion**: the one genuine gap in the series. The 2020 print report gives religion nationally only; island detail exists as Atlas pie charts (four collapsed categories: Catholic, KUC-KPC, Latter Day Saints, Other/None/Not Stated) and in the licensed microdata. The clean unblock is a KINSO/SPC custom PDH.Stat tabulation (the Atlas maps were built from PDH.Stat/PopGIS custom tables, so the aggregate exists) or an NSO custom-table request. Not a blocker on the 1990-2015 series.
- **Licence**: the printed reports and Excel tables carry no stated terms (Palau posture); the Atlas carries an explicit SPC/KINSO clause. Resolve by PI ruling (summaries-with-attribution) or a KINSO reuse-confirmation email.
- **Frame harmonisation**: the KPC/KUC break (combine in 2020) and the widening denominational detail bar a naive cross-wave denomination series; ship a harmonised broad-affiliation series and keep fine rows per wave.
- **2015 extraction**: Table 6 spans multiple pages with a jagged multi-line header; text extraction works but the build must transcribe and reconcile carefully rather than trust a naive parse.

## Product boundary

A build on this probe would stage 24-island religious-affiliation summaries for 1990, 1995, 2000, 2005, 2010, and 2015 (all all-ages) on the geoBoundaries KIR ADM2 frame, with per-wave verbatim category frames, the KPC/KUC harmonisation note, an antimeridian-safe (0-360) geometry pipeline with a 24-island completeness gate, and fail-fast reconciliation at both margins. It would carry the 2020 national frame as published and hold the 2020 island layer pending a KINSO/SPC custom tabulation or the microdata. It would not contain a place-of-worship layer, place-density metrics, or the pre-1990 deeper-history workbooks (1968, 1973, 1985), which are recorded as future-research routes. A KINSO licence confirmation and the 2020 island tabulation are the two recorded routes to complete and open the page.

## Build appendix (2026-07-11, STAGED)

The build ran per this route. `scripts/build_ki_area_summary.R` parses the five KINSO Excel "Table 10. Religion by Island" workbooks (1990-2010) at build time and transcribes the 2015 Report Vol 1 Table 6 island population and No religion column from the rendered table images (pdftotext `-layout` drifts on the trailing-dash cells). It writes `apps/regions/ki/data/ki_island_2017.geojson`, `apps/regions/ki/data/area_summary_island.{json,csv}` (24 islands x 6 waves = 144 rows), and `docs/manifests/ki-census-religion-1990-2015.json`. The product is STAGED: no page, no hub link, `licence_status` `needs_review` pending PI task 15. The `data/raw/ki_census/` cache was mirrored to `gs://pow-research-data/raw_sources/ki_census/` (29 objects, 45.6 MiB).

**Reconciliation gates (fail-fast; every wave verified against printed control totals).**

| Wave | National | Island-column closure | Category-row closure | Notes |
| --- | --- | --- | --- | --- |
| 1990 | 72,334 | short by 9 across 4 islands (disclosed) | closes exactly | nine-person unaccounted residual: South Tarawa 3, Abemama 4, North Tabiteuea 1, South Tabiteuea 1; kept in denominator, never repaired |
| 1995 | 76,844 | closes exactly | closes exactly | six-category frame, no No religion column; Line Islands + Phoenix in one combined column (5,866) |
| 2000 | 84,491 | closes exactly | closes exactly | Not Stated column (Ns, 25) retained in denominator |
| 2005 | 92,533 | closes exactly | closes exactly | Not Stated column (Ns, 22) retained in denominator |
| 2010 | 103,058 | closes exactly | closes exactly | Not Stated column (212) retained in denominator |
| 2015 | 110,136 | populations sum to 110,136 | No religion sums to 51; 14 printed categories sum to 110,136 nationally | Betio enumerated separately (17,330) |
| 2020 (national context) | 119,438 | n/a (national only) | 17 categories sum to 119,438 | KPC 10,016 + KUC 25,322 = 35,338 (Atlas KUC-KPC collapse); carried in the manifest, never as an island wave |

**Island roster per wave.** 1990/2000/2005/2010 enumerate 23 islands (Betio within South Tarawa); 1995 enumerates 19 individual islands plus one combined Phoenix/Line column; 2015 enumerates all 24 (Betio separate). The 24-feature boundary is fixed; absent units get explicit null-metric rows (the Korea 1995 Sejong precedent): Betio is null for 1990-2010 (its residents fall in the South Tarawa count), and Teeraina/Tabuaeran/Kiritimati/Kanton are null for 1995 (the combined Phoenix/Line total is recorded in the manifest, never placed on a feature). Nine null rows in total.

**Antimeridian — both-frame gate (passed).** The raw WGS84 national bbox smears 348.6 degrees. The geometry pipeline shifts to a contiguous 0-360 frame, simplifies with the shared mapshaper helper (allow-overlaps clean, 100% keep, 509,687 bytes), cuts at lon 180, and shifts the eastern pieces (Phoenix, Line) back to negative longitudes. Gate (1) 0-360 national extent = 169.521-202.836 (span 33.3, the expected compact span). Gate (2) WGS84 [-180,180]: max single-feature bbox longitude span = 0.399 degrees (well under the 5-degree smear threshold), max consecutive-vertex ring longitude jump = 0.013 degrees (no ring crosses the antimeridian), all coordinates within [-180,180]. Gate (3) dateline-aware extent recorded in the manifest, not the raw bbox. 24 valid features, 24 distinct geometry hashes; join on `area_code` (geoBoundaries `shapeID`); name concordance North/South Tarawa, North/South Tabiteuea, Teeraina applied.

**Category/no-religion treatment.** `religious_affiliation_count` is the sum of the named-religion categories per island; `no_religion_count` is the None / No religion cell (null in 1995, which has no such category, so its affiliation share is 100% and its no-religion share is null); a not-stated or unaccounted residual (the 2000/2005/2010 Not Stated column, and the 1990 nine-person shortfall) stays in the denominator and outside both numerators, so the two shares need not sum to 100%.

**Named validation invocations (all pass).**

```
$ uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json apps/regions/ki/data/area_summary_island.json
ok -- validation done
$ uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/data-manifest.schema.json docs/manifests/ki-census-religion-1990-2015.json
ok -- validation done
$ bash scripts/validate_manifests.sh
manifest validation: 70/70 pass
```

**Open questions for the conductor.** (1) Licence: PI task 15 must rule on the summaries-not-raw-data stance for the KINSO reports and historical tables (no stated terms); the Atlas SPC partial-reproduction clause is recorded but not relied on. (2) The 1990 nine-person unaccounted residual is disclosed and never repaired — confirm this matches the standing discrepancy-disclosure ruling. (3) The South Tarawa count includes Betio through 2010 (Betio null those waves); confirm this is preferred over dissolving Betio into South Tarawa geometry for the combined waves. (4) 1995 no-religion is null (category absent); confirm null over an asserted 0. (5) 2020 island religion remains the one gap in the series (Atlas pies / licensed microdata), held as a future route.
