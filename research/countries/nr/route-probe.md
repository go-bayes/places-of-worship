# Nauru census-religion route probe

Verified 2026-07-11. Nauru publishes census religion nationally for all three queued waves, and the public route is clean: the SPC/NBS analytical reports print religion-by-affiliation tables that reconcile exactly, and the 2021 analytical report carries an explicit partial-reproduction-with-acknowledgement licence (the Tonga/Tuvalu posture, not the Palau licence vacuum). The catch is geography. Total-population religion is national-only in every wave. District-level religion is published for one wave only — 2021, and only for the Nauruan citizen/dual sub-universe (11,215 of 11,680 residents) in Table 19 of the person tabulations. No public wave prints total-population religion by district, and no second wave prints any religion-by-district table in a public report. The small-country clause therefore governs: a national three-wave series is the honest, publishable product (Dominica/Iceland precedent), with the 2021 Nauruan-only district table available as a single-wave, sub-universe supplement rather than a district time series.

## Build decision (recommendation to the conductor)

- **Recommendation**: BUILD a national three-wave religious-affiliation series (2002, 2011, 2021). The small-country clause applies — national-only is the record's ceiling for a comparable series, and Nauru's clean multi-wave national religion with an explicit reuse licence earns its place as a national-context product.
- **Candidate waves**: 2002, 2011, 2021 as national levels.
- **Candidate geography**: ADM0 (national) for the comparable series. Optionally a **2021-only district layer** (15 census areas → 14 geoBoundaries districts) as a caveated single-wave supplement, not a time series.
- **Construct**: census affiliation. Each resident's reported religious denomination, not practice, attendance, or membership.
- **Change metric**: national levels are comparable across 2002→2011→2021 at the level of the broad denominations that persist (Nauruan Congregational, Roman Catholic, Nauru Independent, No religion, Not stated). Finer denominations are not comparable back to 2002 (Assemblies of God, Seventh Day Adventist, Baptist, Jehovah's Witness were folded into "Other" in 2002; several 2021 churches did not exist as categories earlier). Publish a broad-affiliation national series; restrict any denomination reading to 2011↔2021.
- **Rights position**: an explicit licence exists. The 2021 analytical report authorises "partial reproduction … for scientific, educational or research purposes, provided that SPC, Nauru and the source document are properly acknowledged." Ship derived summaries with SPC/Nauru attribution under that clause. This is a cleaner rights position than Palau (which had no stated terms).
- **District supplement decision**: HOLD the district layer as a documented single-wave product. A district *time series* is not publishable — only 2021 has a public district religion table, and it covers the Nauruan citizen/dual universe only.

## Published waves and geography

| Year | Public route | Religion table | Universe | Finest public geography | Decision |
| --- | --- | --- | --- | --- | --- |
| 2002 | [NBS/SPC 2011 National Report](https://nauru-data.sprep.org/system/files/Nauru_2011_Census_Report_FINAL%20(3).pdf) (SPREP mirror), Table 23; microdata at [PDH catalog/236](https://microdata.pacificdata.org/index.php/catalog/236) | Table 23 "Population by religious affiliation, Nauru: 2002 and 2011" (2002 column, text-extractable) | all persons (Total 10,065) | national | Ship the 2002 national wave (broad frame). |
| 2011 | [NBS/SPC 2011 National Report](https://nauru-data.sprep.org/system/files/Nauru_2011_Census_Report_FINAL%20(3).pdf) (SPREP mirror), Table 23; microdata at [PDH catalog/26](https://microdata.pacificdata.org/index.php/catalog/26) | Table 23 (2011 column, text-extractable) | all persons (Total 9,945) | national | Ship the 2011 national wave. |
| 2021 | [NBS 2021 Analytical Report](https://stats.gov.nr/download/49/2021/359/nauru-2021-population-and-housing-census-analytical-report.pdf) Table 25; [NBS 2021 Tables Vol.1 xlsx](https://stats.gov.nr/download/49/2021/182/population-housing-census-2021-tables-vol1.xlsx) sheet G-7; [Person Tables 1-36](https://stats.gov.nr/download/49/2021/358/person-tables-1-36.pdf) Table 19 (district) | Table 25 / G-7 (national); Table 19 "Nauruan Population (citizen/dual) by Sex by District by Religion" (district, Nauruan-only) | national: all persons (Total 11,680); district: Nauruan citizen/dual only (Total 11,215) | **district (15 areas)** for the Nauruan-only sub-universe; national for all persons | Ship the 2021 national wave; hold the district table as a caveated single-wave supplement. |

The stats.gov.nr NBS reports and the SPREP-mirrored 2011 report are the source of record, not the Pacific Data Hub. The PDH catalogue records ([2021 catalog/816](https://microdata.pacificdata.org/index.php/catalog/816), [2011 catalog/26](https://microdata.pacificdata.org/index.php/catalog/26), [2002 catalog/236](https://microdata.pacificdata.org/index.php/catalog/236)) are restricted-access microdata (MOU/confidentiality declaration required); their variable-level metadata expose national religion frequencies but not the district cross-tabs. The 2011 catalog *lists* a "Table 7: Population by District and Religion, Nauru:2011" and "Table 8: Population by religion, 5 year age group" as part of the restricted tabulation deliverable — those district tables are not reproduced in the public analytical report, whose religion section is national-only (Table 23). The 2021 district table (person-tables Table 19) is the only public religion-by-district table for any wave.

## Category frames

The frame widens across waves as new churches were split out. Preserve each source spelling per wave.

**National series (comparable spine — 2002 / 2011 / 2021):**

| 2002 (Table 23) | 2011 (Table 23 / 25) | 2021 (Table 25 / G-7) | Product role |
| --- | --- | --- | --- |
| Nauruan Congregational | Nauruan Congregational | Nauruan Congregational | religious affiliation |
| Roman Catholic | Roman Catholic | Roman Catholic / Catholic | religious affiliation |
| Nauru Independent | Nauru Independent | Nauru Independent | religious affiliation |
| (in Other) | Assembly of God | Assemblies of God (AOG) | religious affiliation |
| (in Other) | Seventh Day Adventist | Seven Day Adventist | religious affiliation |
| (in Other) | Baptist | Baptist | religious affiliation |
| (in Other) | Jehovah's Witness | (0, disappeared) | religious affiliation |
| — | — | Pacific Light House | religious affiliation |
| — | — | Protestant | religious affiliation |
| — | — | Brethren Church | religious affiliation |
| — | — | Hinduism | religious affiliation |
| — | — | Methodist | religious affiliation |
| Other | Other | Other religion | residual affiliation |
| No Religion | No Religion | No religion | no-religion |
| Not stated | Not stated | Not stated | non-response |

The full 2021 national G-7 frame additionally splits Shalosh Pentecostal Church (186), Fishers of Men Church (57), FOM Pentecostal Church (81), Christ Embassy (48), and Fundamental Christian Church (15) out of "Other"; Table 25 folds these into "Other religion" (485). Use Table 25's folded frame for cross-wave comparability and keep G-7's finer split only if a 2021-detail view is wanted.

Two frame facts govern comparability. The first frame fact is denominational splitting: 2002 carries only six lines (Nauruan Congregational, Roman Catholic, Nauru Independent, Other, No Religion, Not stated), because Assembly of God, Seventh Day Adventist, Baptist, and Jehovah's Witness were not separated until 2011; treating the 2002 "Other" (1,417) as comparable to the 2011 "Other" (282) would misread the split-out, not a real decline. The second frame fact is the residual/no-religion distinction, which is stable: all three waves keep "No Religion" and "Not stated" as separate lines, so the no-religion series is comparable across all three waves (456 → 178 → 157).

The Nauruan indigenous denominations — Nauruan Congregational Church and Nauru Independent Church — are first-class named categories in every wave and keep their own display labels.

**2021 district table (Table 19) frame — Nauruan citizen/dual universe only:** Total, No Religion, Nauruan Congregational, Catholic, Assemblies of God (AOG), Nauru Independent, Pacific Light House, Seven Day Adventist, Baptist, Protestant, Brethren Church, Jehovah's Witness (0), Hinduism (0), Methodist Church (0), Other religion, Do not wish to answer.

## Universe and denominator

The national series counts all persons: 10,065 in 2002, 9,945 in 2011, 11,680 in 2021. (The 2011 report's own text notes the 2002 *tribe* table is Nauruan-only, but the 2002 *religion* column in Table 23 is all-persons and totals 10,065.)

The 2021 district table (Table 19) is restricted to the Nauruan citizen/dual population — Total 11,215, which is 96.0% of the 11,680 total residents. The 465-person gap is non-Nauruan residents (RON Hospital / RPC-linked and other foreign residents), for whom no religion-by-district cross-tab is published. Table 18 (Nauruan by age by religion) shares the same 11,215 universe. Consequently the district layer cannot be summed to the national total-population figure, and a district build must state the Nauruan-only universe explicitly and never present it as total-population coverage.

## Reconciliation gates (verified in the probe)

- **2002 national (Table 23)**: the six category rows (Nauruan Congregational 3,563; Roman Catholic 3,342; Nauru Independent 1,049; Other 1,417; No Religion 456; Not stated 238) sum to the printed Total 10,065. Closes exactly.
- **2011 national (Table 23 / Table 25)**: the category rows (Nauruan Congregational 3,552; Roman Catholic 3,278; Assembly of God 1,291; Nauru Independent 945; Seventh Day Adventist 73; Jehovah's Witness 89; Baptist 148; Other 282; No Religion 178; Not stated 109) sum to the printed Total 9,945. Closes exactly.
- **2021 national (G-7 / Table 25)**: the 19-line G-7 frame sums to the printed TOTAL 11,680; the Table 25 folded frame (Nauruan Congregational 4,001; Roman Catholic 3,959; Assemblies of God 1,365; Nauru Independent 410; Pacific Light House 706; Seven Day Adventist 168; Baptist 175; Protestant 126; Brethren Church 47; Hinduism 6; Methodist 18; Jehovah's Witness 0; Other religion 485; No religion 157; Not stated 57) also sums to 11,680. Both close exactly.
- **2021 district (Table 19, Nauruan-only)**: the 15 district-area rows sum to the printed Total 11,215 (verified: 787+828+1,202+932+322+719+337+521+513+788+547+268+358+1,731+1,362 = 11,215); the Nauruan Congregational column across the 15 areas sums to the printed column total 3,889. Both margins close exactly.
- The build stops and records any failing row on arithmetic mismatch; no value is allocated, inferred, rounded, or tuned.

## Boundary source and licence

The boundary is [geoBoundaries NRU ADM1](https://www.geoboundaries.org/api/current/gbOpen/NRU/ADM1/). The release metadata states `"admUnitCount": "14"`, `"boundaryType": "ADM1"`, `"boundaryYearRepresented": "2005"`, `"boundarySource": "geoBoundaries, FreeMapViewer"`, and `"boundaryLicense": "Public Domain"`, with `"licenseSource": "creativecommons.org/share-your-work/public-domain/"`. The build uses that release metadata as the licence authority. No official NBS district polygon layer was pinned; geoBoundaries/FreeMapViewer under Public Domain is the recommended boundary, and Public Domain is a cleaner boundary-rights position than the ODbL layers used elsewhere.

The layer carries the 14 official districts: Aiwo, Anabar, Anetan, Anibare, Baiti, Boe, Buada, Denigomodu, Ewa, Ijuw, Meneng, Nibok, Uaboe, Yaren. The 2021 district table (Table 19) uses **15** census areas — the 14 districts plus a separate "Location" row. Two concordances are needed for a district join:

- **Location → Denigomodu**: the census "15-Location" row is the phosphate-settlement area, geographically inside Denigomodu district (the 2011 report states "Location settlement being located in Denigomodu, the neighbouring district of Aiwo"). geoBoundaries carries no Location polygon, so a 14-district join must add census Location (row 15) into Denigomodu (census row 5). This changes the mapped Denigomodu value materially — Location's Nauruan-only population (1,362) dwarfs Denigomodu's own (322) — so the fold must be explicit and documented, not silent.
- **Baitsi → Baiti**: census "8-Baitsi" maps to geoBoundaries `Baiti`. The remaining 12 names match directly (allowing for the census `N-Name` numeric prefixes).

Nauru is a single ~21 km² island with no outlying dependencies, so no small-island bbox trap (the Tonga/Palau camera trap) and no dateline handling apply. For a national-only product the ADM0 polygon (geoBoundaries NRU ADM0, same release) is sufficient and no district concordance is needed.

## Licence position

Nauru is the opposite of Palau: an explicit reuse clause exists and is byte-matched here.

- **2021 analytical report** (verbatim, front matter): `© Pacific Community (SPC) and Government of the Republic of Nauru (Nauru) 2023`. `All rights for commercial/for profit reproduction or translation, in any form, reserved. SPC and Nauru authorises the partial reproduction or translation of this material for scientific, educational or research purposes, provided that SPC, Nauru and the source document are properly acknowledged. Permission to reproduce the document and/or translate in whole, in any form, whether for commercial/for profit or non-profit purposes, must be requested in writing. Original SPC and Nauru artwork may not be altered or separately published without permission.` ISBN 978-982-00-1510-4. This is the same partial-reproduction-with-acknowledgement posture the record pins for Tonga and Tuvalu. Deriving affiliation summaries with SPC/Nauru attribution falls squarely inside the authorised "scientific, educational or research purposes" clause.
- **2021 Tables Vol.1 xlsx and Person Tables** (stats.gov.nr): no per-file licence; the site footer reads verbatim `Copyright 2023 © Nauru Bureau of Statistics – Ministry of Finance`. These are the same NBS/SPC 2021 census outputs the analytical report governs; treat them under the analytical-report clause with NBS attribution.
- **2011 National Report** (SPREP mirror): the front-matter licence page did not text-extract cleanly (image/differently-encoded page); the report is the SPC/NBS joint 2011 census output and is hosted openly on the SPREP Nauru data portal and the SDD digital library. Absent a byte-matched 2011 quote, rely on the 2021 clause plus the SDD open-hosting posture; an NBS/SDD confirmation would close the small gap.
- **PDH microdata (2002/2011/2021)**: restricted. The 2011 catalog states access requires an "officially signed MOU/LOU document from both parties"; the 2002 catalog conditions include `The data will be specifically used for statistical and scientific research purpose ONLY`, `The data is not sold or re-distributed to any other individual, institution or organisation`, and `The source has to be acknowledged in all modes of presentation`. The build does not touch the microdata — it uses only the printed public report tables — so these microdata restrictions do not bind the product; they are recorded to explain why the district religion cross-tabs (2011 Table 7, 2002) are not publicly reproducible.

Net: the licence gate is *cleaner* than Palau. Ship derived national summaries with SPC/Nauru attribution under the explicit 2021 clause; a one-line NBS confirmation for the 2011 report front matter is the only outstanding tidy-up, not a blocker.

## Retrieval record

Every cached input is under `data/raw/nr_census/`, which `git check-ignore -v` confirms is excluded by `.gitignore:120` through the `data/` rule. Retrieval occurred on 2026-07-11.

| Cached input | Source URL | Hosting | SHA-256 |
| --- | --- | --- | --- |
| `nr_2021_analytical_report.pdf` | <https://stats.gov.nr/download/49/2021/359/nauru-2021-population-and-housing-census-analytical-report.pdf> | official (NBS) | `fcbb52f6e46b420c100caa074689b9354959b8a6aec57eebe2de82da1a78847b` |
| `nr_2021_person_tables.pdf` | <https://stats.gov.nr/download/49/2021/358/person-tables-1-36.pdf> | official (NBS) | `f2ce4ea6de447a4d6e2e7d197413ee7e3b11a8ab8f1161aa53f369df3715e270` |
| `nr_2021_tables_vol1.xlsx` | <https://stats.gov.nr/download/49/2021/182/population-housing-census-2021-tables-vol1.xlsx> | official (NBS) | `2c3e4056a4d982c07880b1ee1b14df44f343c461e6485a67e569400281585b70` |
| `nr_2011_census_report.pdf` | <https://nauru-data.sprep.org/system/files/Nauru_2011_Census_Report_FINAL%20(3).pdf> | SPREP Nauru data portal (SPC/NBS report) | `2e2bfc0681a85cad0f9be1378a75b9d05f07bac4f4f0c33ff557cf60082c3c7e` |
| `geoBoundaries-NRU-ADM1.geojson` | <https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/NRU/ADM1/geoBoundaries-NRU-ADM1.geojson> | geoBoundaries gbOpen (pinned 9469f09) | `afb3d32bd9c6ec0fc04e5feb4a943cdf0db71a83f7f25d8f0f12b1270d1617fe` |
| `gb_nru_adm1_meta.json` | <https://www.geoboundaries.org/api/current/gbOpen/NRU/ADM1/> | geoBoundaries API | `8ffaa1de84af0f7e3b2f62c2da2017284c06d8ade164c61596377169d29ec49e` |

Derived working files also present in the cache (not source objects): `nr_2021_analytical_report.txt`, `nr_2021_person_tables.txt`, `nr_2011_census_report.txt` (pdftotext extractions).

The 2021 analytical report is also mirrored on the [FAO WCA library](https://www.fao.org/fileadmin/templates/ess/ess_test_folder/World_Census_Agriculture/WCA_2020/WCA_2020_new_doc/WCA_2020_doc2/NAU_REP_ENG_2021_PHC.pdf) (same document; the stats.gov.nr copy is the source of record). The 2011 report is also catalogued at the [SDD digital library](https://sdd.spc.int/digital_library/republic-nauru-national-report-population-and-housing-census-2011).

## Blockers

- **District time series is impossible**: only 2021 publishes religion by district in a public report, and only for the Nauruan citizen/dual sub-universe (11,215 of 11,680). 2011 and 2002 district religion tables exist solely inside restricted PDH microdata (MOU-gated). A cross-wave district product is therefore out of reach without a microdata MOU. This is the binding geographic constraint.
- **2021 district universe mismatch**: the 2021 district table omits 465 non-Nauruan residents and cannot be summed to the total-population national figure. Any district map must be labelled Nauruan-citizen/dual only.
- **Frame split across 2002→2011**: the 2002 six-line frame folds AOG/SDA/Baptist/JW into "Other"; national change readings for those denominations are limited to 2011↔2021. The broad-affiliation spine (Nauruan Congregational, Roman Catholic, Nauru Independent, No religion, Not stated) is comparable across all three waves.
- **2011 licence quote**: the 2011 report front-matter licence page did not text-extract; no byte-matched 2011 quote is pinned. Minor — the 2021 clause and open SDD/SPREP hosting cover the position; an NBS/SDD note would close it.

## Product boundary

A build on this probe would stage a **national** religious-affiliation series for 2002, 2011, and 2021 (all persons) on the geoBoundaries NRU ADM0 frame, with the broad-affiliation spine comparable across all three waves and a finer 2021 denomination view available from G-7. The optional 2021 **district** layer (15 census areas folded to 14 geoBoundaries districts via Location→Denigomodu and Baitsi→Baiti) would ship, if at all, as a clearly labelled single-wave, Nauruan-citizen/dual-only supplement — never as a district time series or as total-population coverage. It would not contain a place-of-worship layer, place-density metrics, or a pre-2002 wave (the 1977/1983/1992 censuses are unverified for public religion tables). The small-country clause is the basis for shipping: Nauru's national multi-wave religion series with an explicit reuse licence is a legitimate national-context product, matching the Dominica and Iceland precedents; the district data are a bonus supplement, not the spine.

## Build appendix (2026-07-11, full ship)

The product `nr-census-religion-2002-2021` shipped as a national three-wave all-persons series on one ADM0 polygon. Builder `scripts/build_nr_area_summary.R`; outputs `apps/regions/nr/data/{area_summary_adm0.json,area_summary_adm0.csv,nr_adm0_2005.geojson}` and `docs/manifests/nr-census-religion-2002-2021.json`. The cache under `data/raw/nr_census/` was mirrored (source objects only) to `gs://pow-research-data/raw_sources/nr_census/` ahead of the build.

**Reconciliation (all gates passed, stop-don't-tune):**

- Category-sum-equals-printed-total, per wave: 2002 = 10,065; 2011 = 9,945; 2021 = 11,680 (Table 25 folded frame). All close exactly.
- G-7 → Table 25 fold (2021): the xlsx sheet G-7 (read live) carries 19 category lines summing to 11,680; its "Other religion" (98) plus the five split-out churches — Shalosh Pentecostal 186, Fishers of Men 57, FOM Pentecostal 81, Christ Embassy 48, Fundamental Christian 15 (sum 387) — equals Table 25's "Other religion" (485). Every overlapping category (13 lines, incl. Catholic→Roman Catholic, Do not wish to answer→Not stated) agrees with the shipped Table 25 count.
- 2011 cross-source: the 2011 column is printed independently by the 2011 Report Table 23 and the 2021 Report Table 25; both byte-matched in the cached text, identical counts.
- Affiliation residual = affiliation-role category sum, per wave: 2002 = 9,371; 2011 = 9,658; 2021 = 11,466.
- Headline series: affiliation % 93.1 → 97.1 → 98.2; no-religion % 4.5 → 1.8 → 1.3 (No Religion counts 456 → 178 → 157); Not stated 238 → 109 → 57.
- Boundary: the cache holds only the geoBoundaries NRU **ADM1** 14-district layer, so the ADM0 polygon is the `st_union` dissolve of those districts — 1 valid non-empty feature, 21.55 km² (consistent with Nauru's ~21 km²), 8,464 bytes at 100 % keep, join property `area_code = "NR"`. Release metadata licence: **Public Domain**.
- Licence: the 2021 analytical report's SPC/Nauru partial-reproduction clause and ISBN 978-982-00-1510-4 byte-match the cached text; `licence_status = accepted`. The 2011 report's front-matter licence page did not text-extract — recorded as a soft flag, identical SPC/NBS attribution applied.

**Named validation invocations and output:**

```
$ uvx check-jsonschema --base-uri "file://$PWD/schemas/" --schemafile schemas/area-summary.schema.json apps/regions/nr/data/area_summary_adm0.json
ok -- validation done

$ uvx check-jsonschema --base-uri "file://$PWD/schemas/" --schemafile schemas/data-manifest.schema.json docs/manifests/nr-census-religion-2002-2021.json
ok -- validation done

$ bash scripts/validate_manifests.sh
manifest validation: 63/63 pass
```

The tree is left uncommitted for the conductor's review.
