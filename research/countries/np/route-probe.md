# Nepal census-religion route probe

Verified 2026-07-12. PROBE + BUILD. The National Statistics Office of Nepal (NSO, formerly the Central Bureau of Statistics, CBS) publishes religion **by district** as a count-valued cross-tab for the 2021 census through the official census-results portal, as a **machine-readable Excel workbook** — `Religion_NPHC_2021.xlsx`, "Table -5: Population by religion and sex", whose `Prov_District_local level` sheet carries every one of the **77 districts** (and the 7 provinces, and 753 local levels) broken down by the official **ten-religion frame** (Hindu, Bouddha, Islam, Kirat, Christian, Prakriti, Bon, Jain, Bahai, Sikha). Every district's ten religion cells sum **exactly** to its Total Population, and the 77 district totals sum **exactly** to the national 29,164,578; the reconciliation closes integer-exact with zero deviations. The queue premise ("browser work | probe then build") holds on route type (the census site is a JavaScript single-page application, so the file had to be recovered from its runtime download API) but is **refuted on quality**: the 2021 religion-by-district data is an integer full-count machine-readable table, not a hand-transcribed PDF. The one wave that builds cleanly is **2021**; the **2011** district wave is **HELD** (see below). The boundary route is clean for 2021: **OCHA COD-AB Nepal admin2** carries the 77-district 2021 frame under a stated **CC BY-IGO (Creative Commons Attribution 3.0 IGO)** licence and joins the census one-to-one after a four-name parenthesis concordance. The genuine gates are two: the NSO rights posture ("Copyright © National Statistics Office 2023. All rights reserved", no reuse clause), which ships under BUILD-THEN-ASK with attribution; and the **flat-100 construction** — Nepal's ten-religion frame has **no "no religion" / atheist / not-stated category in 2021**, so every person is assigned a named religion and the affiliation share is 100% by construction (the Sri Lanka / Bangladesh case, which gates the public page on PI task 6, the minority-share metric).

## Build decision (recommendation to the conductor)

- **Recommendation**: BUILD a 77-district, single-wave (2021) religion product on the OCHA COD-AB district frame. The subnational bar is cleared decisively — 77 districts, integer full-count, exact-margin reconciliation, machine-readable. The page is gated on PI task 6 (flat-100 affiliation, Sri Lanka precedent) and on the NSO licence courtesy confirmation (BUILD-THEN-ASK).
- **Wave and source**: **2021** — `Religion_NPHC_2021.xlsx`, sheet `Prov_District_local level`, from the NSO census-results portal download API. Integer full-count, ten-religion frame, 77 districts, all persons of all ages.
- **Geography**: 77 districts on **OCHA COD-AB Nepal admin2** (CC BY-IGO; Survey Department of Nepal / OCHA FISS; `cod_version` V_02; `valid_on` 2024-03-14, reviewed 2025-10-30). Names join one-to-one after normalising four district labels (Excel `Nawalparasi (East)` / `(West)` and `Rukum (East)` / `(West)` to COD-AB `Nawalparasi East` / `West` and `Rukum East` / `West`); the other 73 match on a trimmed exact string.
- **Construct**: census affiliation — each resident's reported religion, asked of the whole resident population (all ages); not practice, attendance, or membership.
- **Slot design** (flat-100, Sri Lanka precedent): `religious_affiliation_percent` = 100.0 for every district (all ten categories are named religions and they exhaust the population; the 2021 frame has no none/not-stated line); `religious_affiliation_count` = the district Total Population; `no_religion_count` and `no_religion_percent` are **null** — the Nepal frame contains no no-religion category, so the slot is absent, not zero. The map-worthy signal rides on the verbatim per-district ten-religion breakdown (`source_categories_verbatim` on the quality flag), which the PI task-6 minority-share metric surfaces.
- **Map-worthy pattern**: the religious geography is sharply regional. Hindu is the national majority (81.19%) but drops well below it in specific districts; Islam concentrates in the Madhesh Terai (Rautahat, Kapilbastu, Banke, Bara); Kirat concentrates in the eastern hills of Koshi province (Koshi province is 16.8% Kirat); Buddhism concentrates in the high mountains (Manang, Mustang, Solukhumbu) and the Kathmandu Valley; Christianity is highest in parts of the eastern hills and the west. This district contrast within the ten-religion frame is the reason to map Nepal, and it is exactly what the minority-share metric renders.
- **Rights position**: the NSO census-results portal footer asserts "Copyright © National Statistics Office 2023. All rights reserved" with a Copyright Policy page (client-rendered, not separately fetchable); no open-data licence is stated on the census tables. Ship derived district summaries with attribution to the National Statistics Office under BUILD-THEN-ASK (the RO/SK/CI/LK summaries-with-attribution line); an NSO reuse-confirmation email is the clean courtesy unblock, recorded for the PI. The boundary carries a stated CC BY-IGO licence.

## Published waves and geography

| Year | Official route | Religion-by-district table | Universe | Decision |
| --- | --- | --- | --- | --- |
| 2021 | [NSO census-results portal](https://censusresults.nsonepal.gov.np/) download API, `Religion_NPHC_2021.xlsx` (retrieved via `/files/caste/Religion_NPHC_2021.xlsx`) | "Table -5: Population by religion and sex", sheet `Prov_District_local level` — integer full-count, ten religions, 77 districts + 7 provinces | all persons, all ages (29,164,578) | **BUILD** the 77-district 2021 wave. |
| 2011 | 2011 National Report Vol 01 (UN-hosted); 2011 Social Characteristics tables (Vol 05) | Table 22 "Population by religion" — eleven categories (ten religions + Undefined); **only Nepal + 15 development-region/eco-belt aggregates + a handful of sample districts appear in Vol 01**; the full 75-district table lives in the 2011 Social Characteristics volume (Vol 05) | all persons (26,494,504) | **HELD** — the full 75-district 2011 religion table is not in a reachable open product (see Blockers). |

The census site itself (`censusnepal.cbs.gov.np`) and the results portal (`censusresults.nsonepal.gov.np`) are Next.js single-page applications; direct file URLs and `/results/downloads/*` routes return the SPA 404 shell to an automated fetch, and `censusnepal.cbs.gov.np` additionally presents a mismatched TLS certificate. The download **file list and API path** were recovered from the portal's JavaScript bundle (`/_next/static/chunks/pages/downloads/caste-ethnicity-*.js`), which pins the download base to `https://censusresults.nsonepal.gov.np/files/caste/<filename>`; the `Religion_NPHC_2021.xlsx` object downloads directly from that path and is a valid OpenXML workbook. A future browser session under this account is the general-purpose unblock for any 2021 table not exposed on `/files/caste/`, but it was not needed for religion.

## Category frame (preserved verbatim)

The 2021 sheet prints one header spelling per column. Preserve each source spelling; the frame is rendered, never merged, never backcast.

| 2021 column (source order) | Product role |
| --- | --- |
| Hindu | religious affiliation |
| Bouddha | religious affiliation |
| Islam | religious affiliation |
| Kirat | religious affiliation |
| Christian | religious affiliation |
| Prakriti | religious affiliation (indigenous nature worship / animism) |
| Bon | religious affiliation |
| Jain | religious affiliation |
| Bahai | religious affiliation |
| Sikha | religious affiliation |

Two frame facts govern the rendering. The first frame fact is the absence of a no-religion category: the 2021 ten-religion frame assigns every enumerated person to a named religion and carries **no** none/atheist/not-stated line, so the ten cells sum to the Total Population by construction and the affiliation share is 100% in every district. This is the Sri Lanka / Bangladesh flat-100 construction; the public page is gated on PI task 6 (the minority-share metric), and the signal is the ten-way composition, not a two-slot affiliation/no-religion split. The second frame fact is the 2011-to-2021 break: the **2011** frame prints eleven categories — the same ten religions (spelled Buddhism, Christianity, Jainism, Sikhism, plus Hindu, Islam, Kirat, Prakriti, Bon, Bahai) **plus an "Undefined" residual** (61,581 persons, 0.23% nationally) that the 2021 frame drops. So the 2011 and 2021 frames differ by the presence of the Undefined line, and the 2015 district split (75→77) is a further break. No cross-wave change is asserted — the 2021 product is single-wave (change-withhold across the frame and universe breaks; the split IS such a break for Nawalparasi and Rukum).

National anchors (verbatim, cross-checked across three independent NSO products — the `Religion_NPHC_2021.xlsx` Nepal sheet, the 2021 National Report on Caste/Ethnicity, Language & Religion Table 14, and the 2024 Population Composition report Table 3.22):

| Religion | 2021 population | 2021 % | 2011 population | 2011 % |
| --- | ---: | ---: | ---: | ---: |
| Hindu | 23,677,744 | 81.19 | 21,551,492 | 81.34 |
| Bouddha (Buddhism) | 2,393,549 | 8.21 | 2,396,099 | 9.04 |
| Islam | 1,483,066 | 5.09 | 1,162,370 | 4.39 |
| Kirat | 924,204 | 3.17 | 807,169 | 3.05 |
| Christian | 512,313 | 1.76 | 375,699 | 1.42 |
| Prakriti | 102,048 | 0.35 | 121,982 | 0.46 |
| Bon | 67,223 | 0.23 | 13,006 | 0.05 |
| Jain | 2,398 | 0.01 | 3,214 | 0.01 |
| Bahai | 537 | 0.00 | 1,283 | 0.00 |
| Sikha (Sikhism) | 1,496 | 0.01 | 609 | 0.00 |
| Undefined | — | — | 61,581 | 0.23 |
| Total | 29,164,578 | 100 | 26,494,504 | 100 |

## Universe and denominator

The 2021 religion question is asked of the whole resident population of all ages, so each district's denominator is its full Total Population and the district shares are directly comparable within the wave. Every district's ten religion cells sum exactly to its Total Population (no residual, no suppression), and the 77 district totals sum exactly to the national 29,164,578. The build reads each district's composition within its own denominator.

## Reconciliation gates (verified in the probe; re-checked fail-fast in the build)

- **District columns**: for each of the 77 districts, the ten religion cells sum to the printed district Total Population — 77/77 exact, zero deviations.
- **National grand total**: the 77 district Total Population values sum to 29,164,578, and the ten national religion totals sum to 29,164,578 — both exact.
- **Cross-source national anchor**: the Nepal sheet's ten national religion totals match the 2021 National Report Table 14 and the 2024 Population Composition Table 3.22 to the person.
- The build stops and records any failing row on mismatch; no value is allocated, inferred, imputed, redistributed, or tuned. There is no cell suppression in the 2021 district religion table.

## Boundary source and licence

The boundary is **OCHA COD-AB Nepal**, admin2 layer (`npl_admin2.geojson` from `npl_admin_boundaries.geojson.zip` on HDX). The HDX dataset metadata records, verbatim: `license_title` "Creative Commons Attribution for Intergovernmental Organisations (CC BY-IGO)", `license_id` `cc-by-igo`, `license_url` `http://creativecommons.org/licenses/by/3.0/igo/legalcode`, `dataset_source` "Survey Department of Nepal (http://ngiip.gov.np/index.php), UN Resident Coordinators Office in Nepal", organisation "OCHA Field Information Services Section (FISS)". The admin2 layer carries **77 features** with `adm2_name`, `adm2_pcode` (NP0101…), `adm1_name` (Koshi, Madhesh, Bagmati, Gandaki, Lumbini, Karnali, Sudur Paschim), `cod_version` "V_02", `valid_on` "2024-03-14". The names join the 77 census districts one-to-one after a four-entry parenthesis concordance (`Nawalparasi (East)`→`Nawalparasi East`, `Nawalparasi (West)`→`Nawalparasi West`, `Rukum (East)`→`Rukum East`, `Rukum (West)`→`Rukum West`); the remaining 73 match on trimmed exact strings. This is the 77-district 2021 frame, and it is the correct per-vintage boundary for the 2021 census.

**Rejected / alternative boundaries.** The **geoBoundaries NPL ADM2** release is the **old 75-district (pre-2015) frame** — its metadata records `admUnitCount` "75", `boundaryYearRepresented` "2006", `boundaryLicense` "Public Domain". It does **not** match the 77-district 2021 census and is therefore not used for 2021; it is, however, the ready licensed boundary (Public Domain) for a future **2011** 75-district product. The **geoBoundaries NPL ADM1** release (7 provinces, `boundaryYearRepresented` "2020", `boundaryLicense` "CC BY 3.0 IGO", Survey Department / OCHA FISS) and the COD-AB admin1 layer (7 provinces, CC BY-IGO) both support a coarser **province-level 2021 product** (7 provinces, the same Excel province rows, exact reconciliation) as a documented alternative shape; it is not shipped here because the 77-district product is strictly richer and clears the same task-6 gate.

**Dateline / extent**: Nepal spans roughly lon 80.06–88.20 E and lat 26.35–30.45 N, wholly within the standard [−180, 180] frame and far from the antimeridian; no dateline handling is needed.

## Licence position

No open-data licence is stated on the NSO census tables. The rights posture, fetched and quoted verbatim:

- **NSO census-results portal** (`censusresults.nsonepal.gov.np`, page footer): "Copyright © National Statistics Office 2023. All rights reserved" (retrieved 2026-07-12). The footer links a "Copyright Policy" and "Terms of Use" page, both client-rendered by the SPA and not separately fetchable to an automated request; no reuse grant text is exposed.

The product is a derived aggregate summary (district religion composition) carrying full attribution to the NSO, built from an openly published aggregate table, leaking no microdata (the NSO microdata catalogue at `microdata.nsonepal.gov.np` is a separate restricted resource the build never touches). Under the standing BUILD-THEN-ASK ruling it ships with attribution; licence recorded as `needs_review` with a build-then-ask attribution basis (the RO/SK/CI/LK line). An NSO reuse-confirmation email is the clean courtesy unblock, recorded for the PI (do not send). The boundary carries a stated CC BY-IGO licence and is accepted.

## Retrieval record

Every cached input is under `data/raw/np_census/`, which `git check-ignore -v` confirms is excluded by `.gitignore:120` (the `data/` rule). Retrieval occurred on 2026-07-12; content type was verified on every download.

| Cached input | Source URL | Format | Used | SHA-256 |
| --- | --- | --- | --- | --- |
| `Religion_NPHC_2021.xlsx` | <https://censusresults.nsonepal.gov.np/files/caste/Religion_NPHC_2021.xlsx> | xlsx | yes | `3c794dbb6d34bc934f716b42c7589a4191a6232134f449eff3c9fadb814959e1` |
| `npl_admin2_codab.geojson` (from `npl_codab.geojson.zip`) | <https://data.humdata.org/dataset/cod-ab-npl> (`npl_admin_boundaries.geojson.zip`) | geojson | yes | `412454fc8b05f67cc2e6f2a8563635149c3f93703b5e0c8e32efb4df51a43d1d` |
| `npl_codab.geojson.zip` | <https://data.humdata.org/dataset/07db728a-4f0f-4e98-8eb0-8fa9df61f01c/resource/191e22eb-f21e-48f0-9180-872eeda0b8b6/download/npl_admin_boundaries.geojson.zip> | zip | source | `3f660a5ded63733b6aa9cc6bce736131f516d4b8e63fc8817f9d95c14fa214bc` |
| `hdx_codab_npl.json` | <https://data.humdata.org/api/3/action/package_show?id=cod-ab-npl> | json | licence | `d4b4a7294450da4b37fb975e131b406ceb19552a6cf61d1dd07609101eca435e` |
| `npl_admin1_codab.geojson` | (same zip, admin1 layer) | geojson | alt (province) | `87aad50d685d0dead48726ab032ac56a552ee59773388eea153f36f8f6eda44e` |
| `geoBoundaries-NPL-ADM1.geojson` | <https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/NPL/ADM1/geoBoundaries-NPL-ADM1.geojson> | geojson | alt (province) | `5c1799924d277df4f63f6c8e29fbcbb2cd61320fd13e013e431c4a68f09656c1` |
| `gb_npl_adm2_meta.json` | <https://www.geoboundaries.org/api/current/gbOpen/NPL/ADM2/> | json | 2011 alt boundary | `823b80dca789f50bc1a7fa355df192345d406d2b7a2170a86711f4a21b0c4ab2` |
| `gb_npl_adm1_meta.json` | <https://www.geoboundaries.org/api/current/gbOpen/NPL/ADM1/> | json | context | `7eeb4cc49e1d08491235e287f8aa0f0cb246458c71069630da0ecf468b75b6ad` |
| `np_2021_caste_report.pdf` | <https://censusresults.nsonepal.gov.np/files/result-folder/Caste%20Ethnicity_report_NPHC_2021.pdf> | pdf | anchor | `45f3717575801db58b1059ca03d49ca2ee2b51f216ba865e3d788413c5d44215` |
| `np_report26.pdf` (Population Composition of Nepal, 2024) | <https://giwmscdnone.gov.np/media/app/public/36/posts/1710821571_26.pdf> | pdf | anchor | `2ab1cdebf005c93518f85fa2cd9eb3fddea9226b01746d779d483e34a9a9a062` |
| `np_2011_vol1.pdf` (2011 National Report Vol 01) | <https://unstats.un.org/unsd/demographic-social/census/documents/Nepal/Nepal-Census-2011-Vol1.pdf> | pdf | 2011 anchor | `02b7e500ea23b560ba7082fe69979509a553a093d10c7a8608bfe1f7d8e2b8b5` |
| `cr_home.html` | <https://censusresults.nsonepal.gov.np/> | html | licence quote | `2f6a9e7d512fd356620451eccf62f0470b181e9feb0d5205940c182ef5348759` |

Also cached (working extractions, not source objects): `np_report26.txt`, `np_2021_caste_report.txt`, `np_2011_vol1.txt` (pdftotext `-layout`).

## Blockers and held items

- **Licence** (needs_review, not a hard block under BUILD-THEN-ASK): no stated open-data licence on the NSO tables; the portal footer asserts all rights reserved. Ships with attribution to the NSO; NSO courtesy ask recorded for the PI.
- **Flat-100 construction** (page gate, PI task 6): the 2021 ten-religion frame has no no-religion/not-stated category, so affiliation is 100% by construction. The data product ships STAGED; the public page follows the Sri Lanka / Bangladesh precedent and waits on the minority-share metric design (PI task 6).
- **2011 district wave** (HELD): the full 75-district 2011 religion table (Table 22 "Population by religion") is not in a reachable open product. The 2011 National Report Vol 01 (UN-hosted) prints Table 22 for Nepal, the five development regions, three ecological belts, and only a handful of sample districts (17 tables total), not all 75; the 2011 Vol 02 (recovered from the Wayback Machine) is the VDC/Municipality volume and carries no religion table; the 2011 Social Characteristics tables (Vol 05) — which hold the all-district religion cross-tab — return the census-site SPA 404 to an automated fetch. **Unblock**: recover the 2011 Vol 05 Social Characteristics district religion tables (or a machine-readable 2011 religion-by-district Excel) — likely a browser session on `censusnepal.cbs.gov.np` or a CBS 2011 mirror. On recovery, the 2011 wave builds on the **geoBoundaries NPL ADM2** 75-district frame (Public Domain, 2006 vintage), on its own per-vintage boundary with change withheld across the 75→77 break — never a concordance.
- **Frame / universe breaks** (documented): the 2015 district split (75→77) and the 2011 "Undefined" residual (absent in 2021) both bar cross-wave change; the 2021 product is single-wave by design.
- **Province alternative** (documented, not shipped): a 7-province 2021 product on OCHA COD-AB admin1 or geoBoundaries NPL ADM1 (both CC BY 3.0 IGO / CC BY-IGO) is a clean coarser shape from the same Excel; the 77-district product supersedes it.
