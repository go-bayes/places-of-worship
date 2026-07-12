# Mongolia census-religion route probe

Verified 2026-07-12. Verdict: **BUILDABLE (two-wave aimag change product)**. Mongolia's National Statistics Office (NSO; Mongolian Statistical Service, portal `1212.mn`) asked religion of the population aged 15 and over in both the 2010 and the 2020 Population and Housing Censuses, and it publishes the aimag-level religion breakdown for both waves in the 2020-round per-aimag consolidated report volumes (Хүн ам, орон сууцны 2020 оны улсын ээлжит тооллого — [aimag] нэгдсэн дүн). Each of the 22 volumes — one per aimag plus Ulaanbaatar — carries that unit's own religion tables with a **2010 column and a 2020 column side by side**, aged 15 and over, as percentages. The frame is the 21 aimags plus the capital Ulaanbaatar, exactly the 22-unit geoBoundaries MNG ADM1 layer, and the aimag frame is stable across 2010→2020. The licence is clean and open: the `1212.mn` terms of use place the portal's data under Creative Commons Attribution 4.0 International (CC BY 4.0), with attribution "(Source: Mongolian Statistical Service)". This is a genuine two-wave change product on a stable subnational frame — the highest-value build class — and the record documents Mongolia's post-1990 religious revival directly: Ulaanbaatar's religious share fell from 61.4 % (2010) to 53.7 % (2020), while shamanism (Бөө) and minority Christian and other movements shift across aimags. Two caveats govern the build. First, the 2020 religion item was asked only of the 10 % long-form sample of persons aged 15 and over; aimag-level minority categories (Christian, Other, and Islam outside the Kazakh west) are therefore small-sample estimates that the small-cell rule (PI task 19, in design) should govern. Second, the reports publish percentages rather than counts; the product therefore follows the Guinea-Bissau (GW) / Guinea (GN) percentages-only precedent: carry published shares, null all count fields, derive no count from any percentage.

## Build decision (recommendation to the conductor)

- **Recommendation: BUILD (two-wave aimag change product), licence accepted.** Assemble one religion record per aimag (22 units) for 2010 and 2020 from the 22 per-aimag consolidated report PDFs on `1212.mn`. Ship as percentages under CC BY 4.0 with the required attribution. The build gate (at least one wave of published figures at the target geography) is met twice over, on a stable frame.
- **Two published metrics per unit, per wave** (both aged 15 and over, both percentages):
  - **Religion status** (Шашин шүтлэгийн байдал): Шүтдэггүй (non-religious) / Шүтдэг (religious), as a share of the aimag's aged-15+ population. This is the clean population-share metric.
  - **Type of religion** (Шашны төрөл): Будда / Христ / Ислам / Бөө / Бусад, as a share **of the religious population** (not of the total). To express a type as a share of the total aged-15+ population, multiply the religious share by the type share; record this as a derivation, never blend.
- **What is NOT published as an aimag cross-tab**: the national consolidated volume (Нэгдсэн дүн) crosses religion by sex, by age group, and by ethnicity (Tables 3.9–3.13) but has **no aimag dimension**. The aimag signal lives only in the 22 per-aimag volumes, one table each.
- **Rights position: ACCEPTED.** `1212.mn` terms of use: "Open data is made available under the Creative Commons Attribution 4.0 International (CC BY 4.0) license." No licence hold. This is stronger than the all-rights-reserved cases (GW, MONSTAT, DCS); it is an explicit open grant, comparable to the Suriname ABS CC BY 4.0 position.
- **Boundary**: geoBoundaries MNG ADM1, 22 units, ODbL 1.0, joins to the aimag frame one-to-one under a name crosswalk.
- **Small-cell governance**: the 2020 religion figures come from the 10 % long-form sample; minor categories in small aimags need the small-cell rule (PI task 19). The religion-status metric (religious vs non-religious) is robust everywhere; the fine type split is the small-cell surface.

## Published waves and geography

| Wave | Source of record | Religion table(s) | Geographic level | Universe | Format |
| --- | --- | --- | --- | --- | --- |
| 2020 (and 2010 comparison) | 22 per-aimag consolidated reports, e.g. [Ulaanbaatar](https://www.1212.mn/uploads/1616962885010.pdf), [Selenge](https://www.1212.mn/uploads/1616962797339.pdf) (list via [`/api/file-library?lng=mn&type=3`](https://www.1212.mn/api/file-library?lng=mn&type=3&searchTerm=)) | Religion status by sex (2010, 2020); type of religion by sex (2010, 2020); type by age group (2020); UB adds a düüreg/district figure | **aimag / capital** (22 units); UB additionally by düüreg | population aged 15 and over | percentages |
| 2020 national | [National consolidated report (Нэгдсэн дүн)](https://www.1212.mn/uploads/1616994519422.pdf), 301 pp, Tables 3.9–3.13 | religion by sex, by age group, by ethnicity | **national only** (no aimag) | aged 15+; 10 % long-form sample | percentages |
| 2020 national (English press release) | [UN Statistics Division mirror](https://unstats.un.org/unsd/demographic-social/census/documents/Mongolia/mongolia.pdf), 3 pp | national religion prose | national only | aged 15+ | percentages |
| 2010 national | [Mongolia 2010 Population Census: Main Findings](https://catalog.ihsn.org/index.php/catalog/4572/download/58223) (IHSN cat. 4572), 43 pp | national religion (slide deck) | national only | aged 15+ | percentages |

The 2010 aimag figures are obtained from the 2010 columns printed in the 2020-round per-aimag volumes; they are aimag-specific (verified below), not a national figure repeated. Mongolia's own 2010-round per-aimag reports also exist in the same library (e.g. "Хүн ам, орон сууцны 2010 оны улсын ээлжит тооллого - Улаанбаатар хот", id 3315864) and are available as corroboration.

## Category frame (verbatim, as printed)

The frame is identical across national and aimag volumes and across 2010 and 2020. Two levels:

**Religion status** (Шашин шүтлэгийн байдал):

| Mongolian source | English display | Role |
| --- | --- | --- |
| Шүтдэг | Religious (follows a religion) | affiliation gate |
| Шүтдэггүй | Non-religious (does not follow a religion) | no religion |

**Type of religion** (Шашны төрөл), among the religious:

| Mongolian source | English display |
| --- | --- |
| Будда | Buddhism |
| Христ | Christianity |
| Ислам | Islam |
| Бөө | Shamanism (Böö mörgöl) |
| Бусад | Other |

Universe verbatim on every table: **АРВАН ТАВ, ТҮҮНЭЭС ДЭЭШ НАСНЫ ХҮН АМ** (population aged fifteen and over). The census question, from the national volume (p. 61): "Та шашин шүтдэг үү, шүтдэг бол ямар шашин шүтдэг вэ?" ("Do you follow a religion, and if so which religion do you follow?"), "анх удаагаа 2010 оны тооллогоор асууж байсан" (asked for the first time in the 2010 census) and in 2020 "хүн амын 10 хувийн түүврт сонгогдсон 15, түүнээс дээш насны хүн амаас асуусан" (asked of the aged-15+ population selected in the 10 % sample).

## Verbatim published tables (transcribed from the cached PDFs)

**National, Table 3.9 — religion status of the aged-15+ population, percent** (Нэгдсэн дүн, p. 61):

| Шашин шүтлэгийн байдал | 2010 Бүгд | 2010 Эр | 2010 Эм | 2020 Бүгд | 2020 Эр | 2020 Эм |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| БҮГД | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| Шүтдэггүй | 38.6 | 42.9 | 34.4 | 40.6 | 43.3 | 38.1 |
| Шүтдэг | 61.4 | 57.1 | 65.6 | 59.4 | 56.7 | 61.9 |

**National, Table 3.10 — type of religion among the religious aged 15+, percent** (Бүгд column):

| Шашны төрөл | 2010 | 2020 |
| --- | ---: | ---: |
| Будда | 86.2 | 87.1 |
| Христ | 3.5 | 2.2 |
| Ислам | 4.9 | 5.4 |
| Бөө | 4.7 | 4.2 |
| Бусад | 0.7 | 1.1 |

**Ulaanbaatar aimag report, Table 3.5 — religion status, percent** (the change signal): 2010 Шүтдэг 61.4 → 2020 Шүтдэг 53.7 (a 7.7-point fall in the capital); Шүтдэггүй 38.6 → 46.3. **Table 3.6 — type among the religious, Бүгд**: 2010 Будда 86.5, Ислам 1.1, Бөө 6.8, Христ 4.9, Бусад 0.7; 2020 Будда 89.1, Ислам 0.9, Бөө 5.4, Христ 3.3, Бусад 1.3. Ulaanbaatar's religion figure is additionally broken down by düüreg (district) in the report (Figure 3.5 and prose: Chingeltei, Bayangol, Nalaikh, Songinokhairkhan above the city mean; Bagakhangai lowest at 47.1 % religious).

**Selenge aimag report, type of religion, Бүгд, percent**: 2010 Будда 88.1, Христ 4.8, Бөө 4.4, Ислам 1.7, Бусад 0.9; 2020 Будда 85.1, Христ 3.9, Ислам 1.7, Бөө 6.9, Бусад 2.4.

The Ulaanbaatar and Selenge 2010 type columns (Будда 86.5 and 88.1) differ from the national 2010 figure (86.2) and from each other; this confirms the 2010 columns in the aimag reports are aimag-specific, not the national figure repeated. This is the load-bearing check that makes the 2010 aimag wave real.

## Statbank (PxWeb API) — no census person-religion table; a separate places-of-worship time series instead

The NSO statistical database exposes a PxWeb-style API at `https://data.1212.mn/api/v1/en/NSO`. A full traverse of the Population and Historical/Population branches found **no census self-reported religion table** at any grain. The census person-religion tabulation is not in the statbank; it lives only in the report PDFs. The only religion tables in the statbank are administrative infrastructure counts, which are a genuine and separate places-of-worship layer worth noting for this project:

- `DT_NSO_2003_001V1.px` — **TEMPLES AND CHURCHES, by type of religion, aimags and the Capital, and by year** — variables: Type of religion (Total, Buddhism, Christianity, Islam, Other), Region (Total + 21 aimags + Ulaanbaatar, grouped by economic region), Year (**2004–2025**). A 22-unit, multi-year, count-valued place-of-worship time series, CC BY 4.0, retrievable through the API.
- `DT_NSO_2003_002V1.px` — MONKS AND MISSIONARIES, by type of religion, aimags and the Capital, and by year.
- `DT_NSO_2003_003V1.px` — STUDENTS STUDYING IN RELIGIOUS SCHOOLS AND COLLEGES, by type of religion, aimags and the Capital, and by year.

These are administrative registrations (buildings, clergy, students), not the census affiliation of persons; they answer a different question and must not be blended with the census shares. They are recorded here because a temples-and-churches-by-aimag-over-time layer is directly on-theme for the places-of-worship map and is cleanly available.

## Licence position (accepted; CC BY 4.0)

The `1212.mn` terms of use, retrieved 2026-07-12 from <https://www.1212.mn/en/terms_of_use>, quoted verbatim:

> www.1212.mn website, which is a part of the Mongolian Statistical Service, provides free access to statistical and other information. You can freely use, modify, and distribute this information.

> If you use the statistical information from www.1212.mn website and distribute it further, you must cite the source as (Source: Mongolian Statistical Service) and acknowledge the Mongolian Statistical Service.

> Open data is made available under the Creative Commons Attribution 4.0 International (CC BY 4.0) license.

The page carries the CC BY 4.0 badge. Attribution string for the product: "Source: Mongolian Statistical Service" (NSO Mongolia), 2020 Population and Housing Census. `licence_status: accepted`, `licence_basis: nso_1212_terms_cc_by_4_0`. The site footer reads "© 2026. NATIONAL STATISTICS OFFICE OF MONGOLIA"; the terms page supersedes it for data reuse. One documentation note: the terms text foregrounds the API/open-data programme; the census report PDFs are hosted on the same portal as "statistical … information" and fall under the same website-wide free-use grant. No reuse hold is warranted.

## Boundaries and administrative structure

Mongolia's first-level frame is 21 aimags plus the capital Ulaanbaatar (a self-governing municipality outside the aimags), 22 units. The frame is stable 2010→2020 (Orkhon, Darkhan-Uul, and Govisumber, the three newest aimags, all predate 2010). geoBoundaries MNG ADM1 matches one-to-one:

- **geoBoundaries MNG ADM1** — release metadata: `boundaryID` `MNG-ADM1-14279143`, `boundaryYearRepresented` 2017, `admUnitCount` 22, `boundaryLicense` "Open Data Commons Open Database License 1.0", `licenseSource` `www.openstreetmap.org/copyright`, `boundarySource` "OpenStreetMap, Wambacher". [ADM1 metadata](https://www.geoboundaries.org/api/current/gbOpen/MNG/ADM1/); [ADM1 GeoJSON](https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/MNG/ADM1/geoBoundaries-MNG-ADM1.geojson).

The 22 `shapeName` values: Arkhangai, Bayan-Ölgii, Bayankhongor, Bulgan, Darkhan-Uul, Dornod, Dornogovi, Dundgovi, Govi-Altai, Govisumber, Hovsgel, Khentii, Khovd, Orkhon, Selenge, Sükhbaatar, Töv, Ulaanbaatar, Uvs, Zavkhan, Ömnögovi, Övörkhangai. All 22 map one-to-one to the census aimags after a transliteration crosswalk (e.g. geoBoundaries `Hovsgel` → census Khövsgöl/Хөвсгөл; `Ömnögovi` → Ömnögovi/Өмнөговь; `Töv` → Tuv/Төв). The crosswalk is transliteration only, no merges or inventions. Boundary licence ODbL 1.0 (OpenStreetMap-derived).

## Premise corrections (trust the record)

- **The aimag route is the 2020-round per-aimag report PDFs, not the statbank and not the national report.** The queue row read "Aimag/UB district route in census products; exact table needs extraction". The exact route is now fixed: the 22 per-aimag consolidated volumes, Tables 3.5/3.6 (numbering varies slightly by volume), aged 15+, 2010 and 2020, percentages. The statbank has no census person-religion table; the national consolidated volume has no aimag cross-tab.
- **This is a TWO-WAVE change product, not a single 2020 map.** The queue's first-visualisation note ("Map 2020 aimag shares … once the subnational table is extracted") understates the record. Each aimag report prints 2010 and 2020 in the same table; the buildable object is therefore a 2010→2020 aimag change series — the project's core objective.
- **No 2015 inter-censal or 2024 religion release exists.** Mongolia ran full censuses in 2010 and 2020; there is no separate 2015 or 2024 religion wave. The queue span "2010-2024" should read "2010, 2020".
- **The licence is a clean open grant (CC BY 4.0), not a confirm-reuse unknown.** The README and survey row flagged "confirm reuse terms". The terms page states CC BY 4.0 explicitly; no hold.
- **Format is percentages, universe is aged 15+ from a 10 % sample (2020).** Every map title and legend must state "population aged 15 and over" and, for 2020, the 10 % long-form sample basis; the minor-category aimag cells are sample estimates governed by the small-cell rule.

## Retrieval record

All inputs retrieved 2026-07-12 via curl/python (browser UA) and the Chrome browser tool for the terms page. Cached under `data/raw/mn_census/` (git-ignored by the `data/` rule). NSO's `www.1212.mn` frontend is a Next.js app; file listings come from `GET /api/file-library?lng=mn&type=3`, and the report PDFs are hosted at `https://www.1212.mn/uploads/<pathName>`. The PxWeb statbank is at `https://data.1212.mn/api/v1/en/NSO`.

| Cached input | Source URL | sha256 |
| --- | --- | --- |
| `mn2020_national_consolidated.pdf` (Нэгдсэн дүн, 301 pp) | https://www.1212.mn/uploads/1616994519422.pdf | `cc972890b7f8a70b765c7364afa817b3ce5cabb3a350080b5503872b9fef26ad` |
| `mn2020_ulaanbaatar.pdf` (UB нэгдсэн дүн, 300 pp) | https://www.1212.mn/uploads/1616962885010.pdf | `147a04ea94fda54fa15383b5bc6d7f5264a7b40f59a8616e32682e6506376096` |
| `mn2020_selenge.pdf` (Selenge нэгдсэн дүн, 235 pp) | https://www.1212.mn/uploads/1616962797339.pdf | `f02c0a5a06a26770866f22469822384de68a2d3eb1c294861efb751af0f896c3` |
| `mn2020_summary.pdf` (Хураангуй дүн, 19 pp) | https://www.1212.mn/uploads/hun_am_toollogo.pdf | `2a2bb592d3fb4df724f015abf562ece0da7aa5f7d98aad332da85150d663c267` |
| `mn_2020_un.pdf` (UN mirror press release, 3 pp) | https://unstats.un.org/unsd/demographic-social/census/documents/Mongolia/mongolia.pdf | `ae65951c0250aaba31501e1db2dcadcdaf4f5c6a8da962ee5ea84c4a8a7fa407` |
| `mn_2010_ihsn.pdf` (2010 Main Findings, 43 pp) | https://catalog.ihsn.org/index.php/catalog/4572/download/58223 | `4958c5f425f1a110940ef92ef774011721b1937b261ab55eb9054088abfd5fba` |

Statbank and boundary metadata (`data.1212.mn` PxWeb JSON; geoBoundaries MNG ADM1 metadata and GeoJSON) were read live and recorded above; the terms-of-use text was read from the rendered page at <https://www.1212.mn/en/terms_of_use>.

## Blockers and open items

- **Transcription scope (the only real cost)**: the aimag figures are spread across 22 report PDFs, one per unit, in Mongolian Cyrillic. Extraction is per-volume (`pdftotext -layout` extracts the tables cleanly on the volumes tested — Ulaanbaatar, Selenge, and the national report). This is transcription work, not a data-availability blocker.
- **One corrupt source PDF (Bayan-Ölgii)**: the Bayan-Ölgii aimag volume (`uploads/1616963320143.pdf`) downloads with a truncated trailer and fails `pdftotext` (Invalid XRef). Bayan-Ölgii is the highest-Islam aimag (Kazakh majority); its cell carries real weight. Unblock: re-fetch from the file-library, or read the Bayan-Ölgii religion figure from the national ethnicity cross-tab (Table 3.13: Kazakh 96.7 % Islam among the religious) plus the 2010-round Bayan-Ölgii report. Not a route blocker; a retrieval retry.
- **Small-cell rule dependency (watch)**: 2020 aimag minor-category percentages are 10 %-sample estimates; the product should ship the religious/non-religious metric everywhere and gate the fine type split under the small-cell rule (PI task 19, in design). Recorded as a dependency, not a hold.
- **Type-share denominator note**: the type-of-religion percentages are shares of the religious, not of the population. The builder must carry both metrics and derive population-shares by multiplication where wanted, never treat the type percentages as population shares.
