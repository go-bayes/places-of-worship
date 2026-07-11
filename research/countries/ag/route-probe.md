# Antigua and Barbuda census-religion route probe

Verified 2026-07-11. The Statistics Division of Antigua and Barbuda (statistics.gov.ag) is the source of record. It publishes three census waves with a religion question — 1991, 2001, and 2011 — but every printed report tabulates religion at the national level only. Parish-level religion exists for one wave: the 2011 census microdata, served through the CELADE/ECLAC REDATAM instance at `redatam.org/binatg` (BASE `ATGPHC2011`), which crosses `Q49 Religion` by `Parish` on the eight census tabulation units. No REDATAM base exists for 2001 or 1991, and neither printed report crosses religion by parish. The queue's "1991, 2001, 2011 / parish" premise is therefore only half right: religion is a three-wave national series, but a parish-level religion map is single-wave (2011 only). This mirrors the Guinea single-wave-subnational situation, not the Saint Lucia three-wave one — except that the AG subnational route yields person counts (not percentages) on real parish contrasts, and all three waves supply national religion as time context.

## Build/hold recommendation

BUILD LANE OPEN (staged), single subnational wave, browser-work capture — with one PI checkpoint. The recommended first product is 2011 parish religion on seven populated parishes, with 1991/2001/2011 national religion carried as time context. The two decisions the conductor/PI should register before the build commits:

1. **Single-wave subnational bar (PI, Guinea task-8(a) analogue).** A parish religion map ships for 2011 only; 2001 and 1991 are national context. The Guinea precedent held an eight-region, one-decimal, percentages-only single wave; the AG case is stronger on every axis (integer counts, seven parishes plus Barbuda, all-three-wave national anchors, small-island exception). Recommend it clears, but it is a PI call.
2. **REDATAM capture is browser work.** The crosstab route is proven executable (query accepted, output table generated), but the result grid writes to an ephemeral per-session temp path that 404s outside a live portal session with a real `CODIGO` (the Saint Lucia "REDATAM result-frame URLs are temporary" trap). Byte-level capture and national reconciliation must run in a browser session at build time. The queue already rates this row "browser work"; this confirms why.

Licence is favourable (Statistics Division permits processing with acknowledgement; no-resale restriction only — see below), and the boundary is clean (geoBoundaries ADM1, Public Domain, Barbuda and Redonda both present, bbox complete). No hard blocker stands in the way of a build; the two items above are a ruling and a capture task, not gates.

## Official publications and route per wave

| Wave | Official Statistics Division route | Published religion geography | Route decision |
| --- | --- | --- | --- |
| 1991 | [1991 Population and Housing Census — Summary Report](https://statistics.gov.ag/wp-content/uploads/2017/12/1991-Population-and-Housing-Census.pdf), Table 13 (Population by Religion and Sex) and Table 14 (by Age Group, Sex and Religion) | National only. Parish tables (3, 4, 6, 7) never cross religion. | National context. Scanned image PDF, no text layer; Table 13 read from the page image. Tabulated population 59,355. |
| 2001 | [2001 Census of Population and Housing — Summary, Volume I](https://statistics.gov.ag/wp-content/uploads/2017/11/2001-Census-of-Population-and-Housing.pdf), Table 14 (Population by Religion and Sex) and Table 15 (by Age Group, Sex and Religion) | National only. Parish tables (2, 3, 6, 7, 8, 43, 45–50) never cross religion. | National context. Clean text layer; `pdftotext -layout` extracts Table 14 without OCR. National total 76,886. |
| 2011 | [2011 Census — Book of Statistical Tables I](https://statistics.gov.ag/wp-content/uploads/2017/10/Census-2011-Book-of-Statistical-Tables-I.pdf), Table 5.10 (Population by Five-Year Age Groups by Religion by Sex) | National only in print. Parish tables (Section 1 housing; 5.1–5.9; 8.2; 9.5) never cross religion. | National anchor in print (non-institutional 84,816). Parish religion available only via REDATAM. |
| 2011 (parish) | [REDATAM `ATGPHC2011`](https://redatam.org/binatg/RpWebEngine.exe/Portal?BASE=ATGPHC2011&lang=ENG) CrossTab, `PERSON.Q49_RELIGION` × `PARISH.PARISH_H` | Eight tabulation units (see Geography). | The single subnational-religion route. Executable and confirmed; byte capture deferred to a build-time browser session. |

The [2011 Preliminary Release](https://statistics.gov.ag/wp-content/uploads/2017/10/Census-2011-Preliminary-Release.pdf) and the [2011 Demographic Profile](https://statistics.gov.ag/wp-content/uploads/2017/11/2011-Antigua-and-Barbuda-Population-and-Housing-Census-A-Demographic-Profile.pdf) carry no parish religion table; the Demographic Profile uses religion only as a national regression covariate (odds ratios, reference category Adventist). A 2011 Analytical Report is announced in the Book's preface but was not located on the current census page. The 2025 census is in the field (enumeration day 25 June 2025 per the site); no 2025 religion product exists yet.

## Category frames

The names below reproduce the source spellings verbatim. They are not harmonised display labels. The frames differ across waves; cross-wave change metrics are withheld.

- **1991 Table 13** (18 categories): Anglican; Baptist; Brethren; Church of God; Jehovah Witness; Methodist; Moravian; Pentecostal; Presbyterian; Roman Catholic; Salvation Army; Seventh Day Adventist; Hindu; Muslim; Rastafarian; Other; None; Not stated.
- **2001 Table 14** (21 categories): Anglican; Baptist; Bahai Faith; Bretheren; Church of God; Evangelical; Hinduism; Jehovah Witness; Methodist; Moravian; Islam [Muslim]; Pentecostal; Presbyterian; Rastafarian; Roman Catholic; Salvation Army; Seventh Day Adventist; Spiritual Baptist; None; Not stated; Other.
- **2011 Table 5.10 / REDATAM Q49** (24 options including Other and Don't know/Not stated): Adventist; Anglican; Baha'i; Baptist; Brethren; Church of God; Evangelical; Hindu; Jehovah Witness; Judaism; Methodist; Moravian; Mormon; Muslim/Islam; Nazarene; Pentecostal; Presbyterian; Rastafarian; Roman Catholic; Salvation Army; Weslyan Holiness; Other; None/no religion; Don't know/Not stated. (Book note: "There were 24 options for religious affiliation including 'other' and 'don't know/not stated'." `Brethren` prints all-zero in 2011.)

The instrument grew across waves (Baha'i, Evangelical, Spiritual Baptist added by 2001; Judaism, Mormon, Nazarene, Weslyan Holiness added by 2011; 1991 "Seventh Day Adventist" becomes 2011 "Adventist"). The REDATAM 2011 category labels must be captured verbatim at build time and compared to the printed Table 5.10 frame; they are expected to match the Book but were not byte-verified in this probe.

## Geography and aggregation

The census tabulation frame is eight units: **St. John City, St. John Rural, St. George, St. Peter, St. Philip, St. Paul, St. Mary, Barbuda** (Book Table 5.1; identical in the 2001 report Table 2). Antigua's six civil parishes are St. John, St. George, St. Peter, St. Philip, St. Paul, St. Mary; St. John is split into City and Rural for tabulation. Barbuda is a separate island ~40 km north. Redonda (an uninhabited dependency) is not a census tabulation unit and carries no population.

The REDATAM `PARISH.PARISH_H` area list (`AREA1`) returns the same eight units with these verbatim labels and selection files: `Saint John's (City)` (`Parish_1.sel`); `Saint John (Rural)` (`Parish_3.sel`); `Saint George` (`Parish_4.sel`); `Saint Peter` (`Parish_5.sel`); `Saint Philip` (`Parish_6.sel`); `Saint Paul` (`Parish_7.sel`); `Saint Mary` (`Parish_8.sel`); `Barbuda` (`Parish_9.sel`). The gap at `Parish_2` is unlabelled in the area list (likely an all-Antigua or Redonda placeholder) and returned no populated unit.

**Boundary join.** geoBoundaries ADM1 (below) supplies eight polygons: the six Antigua parishes *undivided* (Saint John as one), plus Barbuda and Redonda. The census-to-boundary map is: sum `St. John City` + `St. John Rural` → `Saint John` polygon (a complete aggregation, the Saint Lucia Castries-subdivision pattern); the other six census units (St. George, St. Peter, St. Philip, St. Paul, St. Mary, Barbuda) map one-to-one after spelling normalisation. Redonda has no census religion data and rides as a documented no-data polygon. The mapped religion product therefore covers **seven populated parishes** with Redonda empty.

## National anchors and denominators

- **1991**: Table 13 religion total 59,355 = the *tabulated* population. The report distinguishes enumerated population 62,929, resident population 60,847, and a "best estimate" de facto 65,978 / resident 63,896. Tables exclude vagrants and restricted-institution residents; some tables are age-15+ or females-15+ universes. Any national-context surface must state the 59,355 tabulated basis.
- **2001**: Table 14 religion total 76,886 (matches the parish-total population 76,886 in Book Table 5.1's 2001 column). Includes 3,145 None and 1,329 Not stated.
- **2011**: Table 5.10 religion total 84,816 is the **Non-Institutional Population**. Book Table 5.1's 2011 parish total is 85,567 (total resident population, institutional included). The 751-person gap is the institutional population — a universe mismatch to resolve at build time. Table 5.10 includes 5,028 None/no religion and 4,703 Don't know/Not stated. The REDATAM person-weighted parish crosstab universe (institutional or not) must be pinned against 84,816 vs 85,567 during capture; expect a Saint-Lucia-style documented-discrepancy note if the REDATAM weighted total lands between or outside these anchors.

## Publication and reuse terms

The **2011 Book of Statistical Tables I** preface carries the Statistics Division's data-user permission, quoted verbatim:

> "Data users may apply or process the Census data, provided the Statistics Division is acknowledged as the original source of the data; that it is specified that the application and/or analysis is the result of the user's independent processing of the data; and that neither the basic data nor any reprocessed version or application thereof may be sold or offered for sale in any form whatsoever without prior permission from the Statistics Division"

The same preface states: "Copies of this publication are available free of charge from" the Statistics Division. This is a **processing-with-attribution permission** with a single restriction: no sale of the basic data or a reprocessed version without prior permission. A published derived-rate map with attribution, offered free, satisfies both conditions — a stronger licence position than a bare all-rights-reserved footer (better than the CI/RO/SK line). Recommended `licence_status`: buildable with attribution under the Statistics Division permission, no PI ask required for the 2011 product.

Two nuances to record, not blockers:
- The **2001 report** carries no printed reuse statement (a Statistics Division / NSO publication produced under CARICOM RCCC coordination). The [IHSN catalogue entry for the 2001 census](https://catalog.ihsn.org/index.php/catalog/4291) names the access authority as the CARICOM Secretariat with a citation requirement and standard disclaimer; it lists national coverage and does not enumerate religion as a variable. Since 2001 (and 1991) ship as national context only, the 2011 permission is the governing term for the mapped product.
- The **REDATAM instance** is hosted by CELADE; its portal footer reads "© 2019 - 2024 | CELADE, Population Division of ECLAC - United Nations. All rights reserved." That is the platform/software copyright. The underlying 2011 census data belong to the Antigua and Barbuda Statistics Division, so the Book's data-user permission governs the parish counts. Worth a one-line note on the surface; no separate CELADE licence was found or is needed.

## Boundary source and release metadata

Proposed boundary: [geoBoundaries Antigua and Barbuda ADM1](https://www.geoboundaries.org/api/current/gbOpen/ATG/ADM1/). Release metadata (cached `gb_atg_adm1_meta.json`) records boundary ID `ATG-ADM1-74100532`; canonical `Parish and Dependency`; represented year `2009`; licence **`Public Domain`** (`licenseDetail` "nan"; `licenseSource` `commons.wikimedia.org/wiki/File`); pinned GeoJSON at commit `9469f09`. The metadata `boundaryCount` is null; the actual GeoJSON has **eight features**.

Barbuda-completeness (the Tonga trap) is clear: the eight features are `Redonda` (bbox −62.348…−62.342 E, 16.932…16.944 N — the small island SW of Antigua), `Saint Philip`, `Saint John`, `Barbuda` (bbox −61.887…−61.731 E, **17.543…17.729 N** — the northern island, present and well separated from Antigua's ~17.00–17.17 N), `Saint Mary`, `Saint Paul`, `Saint Peter`, `Saint George`. Both offshore dependencies are present and the layer's extent spans both islands; no bbox is truncated. The `shapeName` labels need only light normalisation ("Saint" → census "St."). The layer is "Parish and Dependency" (Saint John undivided), which is exactly why the census St. John City/Rural pair must be summed before the join.

Licence note: geoBoundaries tags this release "Public Domain" (Wikimedia-sourced), not a formal CC0 token as in the Saint Lucia ADM1 release. Acceptable for reuse; record the tag as-published. No official Statistics Division vector was located; the geoBoundaries ADM1 layer is the recommended source, with an OSM/ODbL fallback available if a formal open tag is later preferred.

## REDATAM retrieval recipe (2011 parish religion)

Entry point: the [portal](https://redatam.org/binatg/RpWebEngine.exe/Portal?BASE=ATGPHC2011&lang=ENG) → Statistical Process → CrossTab. The predefined menu (cached `redatam_index_iframe.html`) exposes Frequencies (`FREQ1`, `FREQ2`), CrossTabs (`CRUZ1`–`CRUZ3`), and Area Lists. The crosstab form (`redatam_2011_crosstab_form.html`) posts to `RpWebStats.exe/CrossTab` and lets the row/column variable and weight be reset. The confirmed parish-religion query is:

- `BASE=ATGPHC2011`, `LANG=ENG`, `MAIN=WebServerMain.inl`, `ITEM=CRUZ1`, `MODE=RUN`, `CODIGO=<session code>`
- `ROW=PERSON.Q49_RELIGION`
- `COLUMN=PARISH.PARISH_H`
- `WEIGHT=PERSON.WGHT` (person weight; the form's other options are `` None and `HHOLD.WGHT`)
- `SELECTION=ALL`, `CONTROL=` (empty), `FORMAT=HTML`, `PERCENT=OFF`
- `inputTitle` must contain **no underscore** — the engine rejects `_` with `Error Number 2 … Illegal character [_] in [inputTitle]`.

This request returns HTTP 200 and an output-table page titled by `inputTitle` (cached `redatam_2011_religion_by_parish.html`), confirming the route runs. The result grid loads in an iframe from `/redatg/tempo/<n>/~tmp_<n>01.htm`; with the placeholder `CODIGO=XXUSUARIOXX` that temp path 404s (and the `RpWebUtilities.exe/Text` servlet reports the file "not found"), because the served temp is written per real portal session. A build-time browser session (the queue's "browser work") supplies the real `CODIGO`, renders the grid, and captures the bytes; the reproducible record is the POST selection above plus the SHA-256 of the captured result. Note `RpWebStats.exe/CrossTab` with `FORMAT=XLS`/`CSV` returns the same container-plus-temp pattern, not a direct download.

Corroboration/frequency checks available: `RpWebStats.exe/Frequency?ITEM=FREQ1|FREQ2` (national frequencies) and `PERCENT=ON` for a percent readback against the printed Table 5.10 national counts.

## Retrieval record

All inputs retrieved 2026-07-11 to `data/raw/ag_census/` (gitignored via `.gitignore` line 120, `data/`). REDATAM temp result URLs are session-ephemeral and are not cached as files; the reproducible record is the query above.

| Cached input | Source or role | SHA-256 |
| --- | --- | --- |
| `ag_1991_census_pop_housing.pdf` | 1991 Summary Report (scanned; Table 13 religion national) | `cf0d89e7367bdbc9a1049934104968a2d49fbbc5d9d35685e0fd2fd84875fabc` |
| `ag_1991_questionnaire.pdf` | 1991 census questionnaire | `ba11b523e745b2dd57aa4c8848f19a62dd6152b93e7388b8ad6862b027b8f5f2` |
| `ag_2001_census_pop_housing.pdf` | 2001 Summary Vol. I (Table 14 religion national) | `b8aab13c636c550cbfd942ace375d3989e848b6deadddd2514bb0a6ec8bbce1a` |
| `ag_2001_questionnaire.pdf` | 2001 census questionnaire | `25e7c5be7304fb059555dfda0f503836874dc5de204337048a625a8c27f92e90` |
| `ag_2011_book_statistical_tables_I.pdf` | 2011 Book of Statistical Tables I (Table 5.10; licence preface) | `16dec3a7eafcb467b2b360d889210ab02be5514e90739320a3c93f0babce88a0` |
| `ag_2011_demographic_profile.pdf` | 2011 Demographic Profile (religion as regression covariate) | `225632400fbbb16a3e601e5cbcc8a7dcfb65f3c84a345ed98673463f80246ce7` |
| `ag_2011_preliminary_release.pdf` | 2011 Preliminary Release (no parish religion) | `9aa02d0e4aa5d48d94861e77fd114644d8cd33cfb59423f20f888b667d8983f6` |
| `redatam_portal_atg.html` | REDATAM ATGPHC2011 portal shell | `2ed937c73909677522fca1502cf1ee1e9fd214fc60678dae3061e0210cf1908a` |
| `redatam_index_iframe.html` | REDATAM process menu (FREQ/CRUZ/AREA items) | `cf6c156c393e4446c21de86bdd27c72135765de3d76ab7191908b598a8a875c1` |
| `redatam_2011_crosstab_form.html` | CrossTab form (`Q49 Religion`, `Parish` variables, fields) | `be7c72f326786f23fd50d759b7b0ef3ec2ec83d3de3c2c31b142b58f9df53cc8` |
| `redatam_2011_religion_by_parish.html` | CrossTab run container (route-executable evidence) | `f5f11ed415234bec417b47367dc00c5f0390457d08cf6e7baa5a665997deeca5` |
| `form_arealist.html` | REDATAM `AREA1` parish list (eight units, verbatim labels) | `c596fa4255ffb2a6b3ba0af5add2a7a776f92af6fd9bb2d6614a77db62c3b3fc` |
| `gb_atg_adm1_meta.json` | geoBoundaries ATG ADM1 release metadata | `f3484f08da09ee155e793d0e9ac85bfe12d9eff188793bc4e47de72bd666cf7f` |
| `geoBoundaries-ATG-ADM1.geojson` | Pinned geoBoundaries source geometry (eight features) | `ae549c3ea440f66d4e2f249f4f2bec14d033f1ba2399374153dfd289d8201718` |
| `stats_census_page.html` | Statistics Division census page (document inventory) | `7cf5663e6d54e8655787360d40ab57f25df1194031f8a9eddf52a24c9041d000` |

## Hard-gate result

- **Official route**: passed. The Statistics Division publishes 1991, 2001, and 2011 census reports, all with a religion question.
- **Subnational religion**: passed for 2011 only, via REDATAM `PERSON.Q49_RELIGION` × `PARISH.PARISH_H`. Failed (not published) for 2001 and 1991 — both printed reports tabulate religion nationally only, and no REDATAM base exists for either (BASE `ATGPHC2001`/`ATGPHC1991` return engine exceptions). The queue's three-wave-parish premise is refuted: parish religion is single-wave.
- **REDATAM executability**: passed. The crosstab query is accepted and generates an output table. **Byte capture deferred** to a build-time browser session (real `CODIGO`); the temp result path is session-ephemeral (Saint Lucia trap confirmed).
- **PDF text layer**: 2001 and 2011 pass (`pdftotext -layout`); 1991 is a scanned image (no text layer) read via page-image render — national religion only, lower stakes as context.
- **National anchors**: recorded. 1991 tabulated 59,355; 2001 total 76,886; 2011 non-institutional 84,816 (vs 85,567 total-resident parish total — a 751 institutional-universe gap to reconcile at capture).
- **Category frames**: captured verbatim for all three waves; not identical across waves. Change metrics withheld.
- **Licence**: passed for the 2011 product under the Statistics Division processing-with-attribution permission (no-resale restriction only; derived free rates comply). 2001 carries no printed terms (CARICOM/NSO); needs_review but national-context only. CELADE footer is platform copyright, not a data licence.
- **Boundary release licence**: passed. geoBoundaries ADM1 tagged Public Domain (Wikimedia), pinned at commit `9469f09`.
- **Source geometry**: eight features; Barbuda and Redonda present with complete, non-truncated bboxes (Tonga trap avoided). Census St. John City + Rural sum to the Saint John polygon; Redonda is a no-data polygon; the mapped product covers seven populated parishes.
- **Build**: not started. Probe only. No builders, apps, manifests, or country page were touched.
