# Grenada census-religion route probe

Verified 2026-07-12. The Central Statistical Office of Grenada (CSO, `stats.gov.gd`) does not publish religion by parish for either census wave the queue names. The 2011 National Population and Housing Census Report prints religion at the **national level only** — Table 2.3.1 "Population by Religious Composition 2011 and 2001 and Percentage Change", tabulated on the non-institutional population living in private dwellings, with a 2011 column and a 2001 column and no parish breakdown. The 2001 wave appears only as that 2001 column; no standalone 2001 parish religion table exists. The census download index confirms the gap directly: every parish-level data product CSO lists is for another subject (population by sex, households, utilities, computers, internet), and the only religion product is "Population by Religious Composition, 2001 and 2011", national. The queue premise ("2001, 2011 | parish | census affiliation | browser work | probe then build") is therefore **refuted at the parish level for both named waves**: religion is a national series in 2001 and 2011, not a parish cross-tab. The one religion-by-parish table Grenada publishes sits **outside** the queue span, in the **2021 PRELIMINARY** census results — Table 23 "Population by Religion and Parish", a count-valued cross-tab over eight columns (six parishes, the Town of St. George shown separately, and Carriacou & Petite Martinique) and twenty-six categories, closing integer-exact at both margins to the national total of 108,279. The licence is the strongest positive finding: the CSO Open Licence Agreement, captured verbatim through the site's WordPress REST endpoint, grants free reuse (commercial and non-commercial) with an acknowledgement-of-source notice; any Grenada census product therefore ships with attribution and needs no reuse ask (the Barbados/Guyana PRASC precedent, near-identical wording). The boundary route is licensed: geoBoundaries GRD ADM1 records a stated Creative Commons Attribution-ShareAlike 2.0 licence over seven units.

## Verdict: HELD (build blocked on a conductor/PI ruling, not on evidence)

The queued product — 2001 and 2011 religion by parish — cannot be built, because neither wave publishes religion below the national level. Trust the record: the parish religion table the queue assumes does not exist for the named span. The only parish religion table (2021, preliminary) is one conductor ruling away from a clean single-wave build; three departures from the Barbados/Guyana pattern hold it back, and each is a decision for the conductor rather than a data-lane call.

- **Departure one — the built wave would be a 2021 PRELIMINARY release, not a final report.** Barbados and Guyana both built on final census reports (2010 Volume 1; 2012 Compendium 2). Grenada's Table 23 sits in the "PRELIMINARY" 2021 summary report (uploaded April 2025); a final 2021 report is not published on the CSO site. The figures are official CSO counts and reconcile exactly, but they may be revised. Building staged on a preliminary release, clearly flagged and easily superseded, is defensible; the choice belongs to the conductor.
- **Departure two — the built wave (2021) lies outside the queue's 2001–2011 span.** Barbados corrected its span downward (queue 2010–2021, built 2010) and Guyana likewise (queue 2002–2022, built 2012); in both the built wave fell inside the named span. For Grenada no wave inside the named span carries parish religion, and the only parish wave is later than the span. This is a larger premise correction than the siblings and is recorded for the conductor.
- **Departure three — a build requires aggregating the Town of St. George into St. George parish.** Table 23 prints eight disjoint columns that sum to 108,279: the six parishes, Carriacou & Petite Martinique, and the Town of St. George broken out on its own (the ST.GEORGE column, 42,096, excludes the town's 2,681). geoBoundaries GRD ADM1 carries seven units, with St. George parish as one polygon. Matching the table to the geometry requires summing St. George (42,096) and Town of St. George (2,681) into one parish row (44,777). The sum is exact and lossless and the census itself defines the town as part of the parish, but it is an aggregation beyond verbatim transcription and touches the "no merged values" hard gate; it is therefore the conductor's to approve.

The named unblock: a conductor/PI ruling to build the single-wave 2021 PRELIMINARY parish product — carrying the eight source columns verbatim, disclosing the Town-of-St.-George→St.-George parish aggregation, and shipping under the accepted CSO Open Licence Agreement attribution — **or** the CSO's final 2021 census report when released, **or** a CSO data request for a 2001/2011 religion-by-parish cross-tab (recorded as a courtesy ask, not sent). With any one of these, the route is otherwise ready: the boundary is licensed and joins seven-to-seven, the licence is accepted, and Table 23 closes integer-exact at both margins.

## Published waves and geography

| Year | Official route | Religion-by-parish table | Universe | Units | Decision |
| --- | --- | --- | --- | --- | --- |
| 2001 | [2011 Census Report](https://stats.gov.gd/wp-content/uploads/2021/03/Census-Report-2011-Revised-Final.pdf) Table 2.3.1 (2001 column) | none — religion published nationally only | non-institutional population in private dwellings | national | REFUTED — no 2001 parish religion table exists. |
| 2011 | [2011 Census Report](https://stats.gov.gd/wp-content/uploads/2021/03/Census-Report-2011-Revised-Final.pdf) Table 2.3.1 (2011 column) | none — religion published nationally only | non-institutional population in private dwellings | national | REFUTED — no 2011 parish religion table exists. |
| 2021 | [2021 Preliminary Results](https://stats.gov.gd/wp-content/uploads/2025/04/2021-National-Housing-Population-Census-Results-Latest-PRELIMINARY.pdf) Table 23 | "Population by Religion and Parish" (integer counts, 26 categories, 8 columns) | whole census population, all ages (108,279) | 8 columns → 7 parish units | HELD — preliminary, out of span, needs the town aggregation; conductor ruling to build. |

The 2011 report lists many "by parish" tables (population by sex, births, school attendance, economic status, disability, households, utilities), none of them religion; the string "Roman Catholic" appears only twice in the whole 230-page report, both in the national Table 2.3.1 and its narrative. The census download index at `stats.gov.gd/census/` lists "Population by Religious Composition, 2001 and 2011" as national and lists no religion-by-parish product.

## Category frame (2021 Table 23, preserved verbatim; never merged)

Table 23 prints twenty-six religion categories plus the Total column. The frame, in source order, with the national Total column count and the spellings transcribed exactly as printed ("MORMOM" sic, "INDEPENDENT BAPTISTE" sic, "JEHOVAH WITNESSES", "MUSLIM"):

| # | Category (2021 Table 23) | Role | National count |
| --: | --- | --- | --: |
| 1 | Anglican | affiliation | 7,916 |
| 2 | Buddhist | affiliation | 24 |
| 3 | Bahai | affiliation | 15 |
| 4 | Brethren | affiliation | 312 |
| 5 | Church of God | affiliation | 3,900 |
| 6 | Evangelical | affiliation | 2,553 |
| 7 | Hindu | affiliation | 151 |
| 8 | Independent Baptiste | affiliation | 1,625 |
| 9 | Jehovah Witnesses | affiliation | 1,097 |
| 10 | Methodist | affiliation | 1,368 |
| 11 | Mennonite | affiliation | 280 |
| 12 | Moravian | affiliation | 17 |
| 13 | Mormom | affiliation | 95 |
| 14 | Muslim | affiliation | 396 |
| 15 | Pentecostal | affiliation | 21,581 |
| 16 | Presbyterian | affiliation | 467 |
| 17 | Rastafarian | affiliation | 1,154 |
| 18 | Roman Catholic | affiliation | 34,145 |
| 19 | Salvation Army | affiliation | 49 |
| 20 | Seventh Day Adventist | affiliation | 13,343 |
| 21 | Spiritual Baptist | affiliation | 1,843 |
| 22 | Lutheran | affiliation | 41 |
| 23 | Atheist | no-religion | 49 |
| 24 | No Religious Affiliation | no-religion | 6,444 |
| 25 | Other (Specify) | residual affiliation | 1,716 |
| 26 | Not Stated | non-response | 7,698 |

The 2021 frame carries **two** distinct no-religion-type lines — "Atheist" (49) and "No Religious Affiliation" (6,444) — plus a "Not Stated" non-response line (7,698). A build must settle the slot design (whether `no_religion_percent` is the "No Religious Affiliation" line alone or "No Religious Affiliation" + "Atheist") before shipping; recorded for the conductor. Printed "-" cells are structural zeros for small denominations in small parishes and would transcribe as 0. No cell suppression appears in the table.

The national 2011/2001 frame (Table 2.3.1) is a coarser twenty-one-category list (Anglican, Baptist, Bahai, Brethren, Church of God, Evangelical, Hindu, Jehovah Witness, Methodist, Moravian, Muslim/Islam, Pentecostal, Presbyterian, Rastafarian, Roman Catholic, Salvation Army, Seventh Day Adventist, Lutheran, None, Other, Not Stated) with a single "None" no-religion line. Because the 2001/2011 series is national and the 2021 table is a different frame and geography, no cross-wave category alignment is attempted.

## Universe and denominators

The 2011/2001 religion series (Table 2.3.1) is tabulated on the **non-institutional population living in private dwellings** — the report states that "population" throughout the chapter excludes the institutional and homeless populations. National category counts read reliably from the narrative: Roman Catholic 37,941 (2011) against 45,573 (2001); Pentecostal 18,139 against 11,414; Seventh Day Adventist 13,898 against 11,129; Anglican 9,015 against 12,102; Baptist 3,410 against 2,987; None 6,012 against 3,824. The printed national religion totals in Table 2.3.1 render unreliably under `pdftotext` layout extraction and are not used; the series is national context, not a build source.

The 2021 Table 23 denominator is the **whole 2021 census population** (108,279), all ages, tabulated across the eight columns with no separate institutional exclusion stated. Religion is asked of the whole enumerated population; the parish shares would therefore be comparable in construct.

## Reconciliation gate (2021 Table 23; verified in the probe)

- **2021 (Table 23)**: the eight column totals (42,096 + 2,681 + 7,773 + 3,938 + 7,846 + 24,755 + 14,443 + 4,747) sum to the printed national 108,279; every one of the twenty-six religion rows sums across the eight columns to its printed national total; every column sums over the twenty-six categories to its column Total; and both national margins equal 108,279. Integer-exact at every margin, no suppression, "-" read as 0. Zero deviations across the full 26×8 grid. A build would stop on any nonzero deviation and would never allocate, infer, impute, or tune a value.

National headline (2021): total 108,279; Roman Catholic 34,145 (31.5%); Pentecostal 21,581 (19.9%); Seventh Day Adventist 13,343 (12.3%); Anglican 7,916 (7.3%); No Religious Affiliation 6,444 (6.0%); Not Stated 7,698 (7.1%).

## Boundary source and licence

The boundary is [geoBoundaries GRD ADM1](https://www.geoboundaries.org/api/current/gbOpen/GRD/ADM1/). The release metadata records `"admUnitCount": "7"`, `"boundaryType": "ADM1"`, `"boundaryYearRepresented": "2017"`, `"boundarySource": "OpenStreetMap, Wikipedia"`, and — the load-bearing field, quoted verbatim — `"boundaryLicense": "Creative Commons Attribution-ShareAlike 2.0"`, `"licenseSource": "osm-boundaries.com/"`. The licence field is non-null; the boundary route is therefore accepted (share-alike; the derived boundary would ship under CC BY-SA with attribution to OpenStreetMap contributors, the OSM share-alike precedent). The seven `shapeName` values are Saint Andrew (GD-01), Saint David (GD-02), Saint George (GD-03), Saint John (GD-04), Saint Mark (GD-05), Saint Patrick (GD-06), and Southern Grenadine Islands (GD-10, the Carriacou & Petite Martinique dependency). Six join the census parish columns directly; "Southern Grenadine Islands" joins the census "Carriacou & Petite Martinique" column; and the census "Town of St. George" column has no ADM1 polygon and would aggregate into the Saint George parish feature (departure three above). The extent spans lon −61.80 to −61.38 E and lat 11.99 to 12.53 N, wholly within the standard frame and far from the antimeridian; no dateline handling is needed. The pin is commit `9469f09`.

## Licence position (accepted)

The census data ship under the CSO Open Licence Agreement — an explicit open reuse grant, not an all-rights-reserved footer. The agreement text is JS-rendered on the page and absent from the static HTML (a `curl` fetch and a WebFetch both return only the page chrome); it was captured verbatim through the site's WordPress REST endpoint (`stats.gov.gd/wp-json/wp/v2/pages?slug=open-licence-agreement`, retrieved 2026-07-12). The load-bearing text, quoted verbatim:

- **CSO Open Licence Agreement**, Licence Grant: "The Central Statistical Office of Grenada grants you (an individual or a legal entity that you are authorized to represent) a worldwide, royalty-free non-exclusive licence to freely use the data, copy, modify, translate, publish, adapt, distribute, create derivative works and value-added products for commercial and non-commercial purposes subject to the terms of this licence."
- **Acknowledgement of Source** (same agreement): "You shall include and maintain the following notice for all value-added products. This product was adapted from the Central Statistical Office of Grenada's information, which is licensed under the Central Statistical Office's Open Licence Agreement." (The general notice is: "Source: Central Statistical Office of Grenada. Contains information licensed under the Central Statistical Office's Open Licence Agreement.")
- **CSO Terms and Conditions** (`stats.gov.gd/terms-and-conditions/`, retrieved 2026-07-12), Proprietary Rights: "Access and use of the Data is subject to the requirements set forth under the Open Licence Agreement." The same page asserts a general website copyright ("No part [of this website] may be copied or transmitted unless expressly permitted by the CSO"), and the data-use clause routes explicitly to the Open Licence Agreement.
- **CSO website footer** (retrieved 2026-07-12): "Copyright © 2026 – Central Statistical Office Grenada. All rights reserved." — a site-content copyright notice, superseded for data by the Open Licence Agreement. The site "was developed with the assistance of the Government of Canada through the Project for the Regional Advancement of Statistics in the Caribbean (PRASC)", the same programme behind the Barbados and Guyana Open Licence Agreements.

A build would be a derived aggregate summary (parish religion shares) from an openly published aggregate table, carrying the required CSO acknowledgement-of-source notice and leaking no microdata. `licence_status: accepted`; `licence_basis: cso_grenada_open_licence_agreement`. No reuse ask is needed. The boundary is CC BY-SA 2.0 (attribution to OpenStreetMap contributors; the derived boundary ships share-alike).

## Premise corrections (trust the record)

- **The parish religion product the queue names does not exist.** Religion is a national series in 2001 and 2011 (2011 Census Report Table 2.3.1, non-institutional population in private dwellings), not a parish cross-tab. The 2001 wave appears only as the 2001 column of that national table. No standalone 2001 census report with parish religion is published on the CSO site.
- **The only religion-by-parish table is the 2021 PRELIMINARY release, outside the 2001–2011 span.** Table 23 of the 2021 preliminary summary is count-valued, twenty-six categories, eight columns, closing integer-exact to 108,279. It is preliminary (revisable) and its eight columns need the Town-of-St.-George→parish aggregation to match the seven-unit boundary.
- **The licence is an open reuse grant, not all-rights-reserved.** The CSO Open Licence Agreement (captured verbatim via the WordPress REST endpoint) grants free reuse with attribution, and the Terms and Conditions route data use to it. Licence accepted; no ask needed.
- **The route is a direct PDF download, not blocked browser work.** The 2011 report and the 2021 preliminary are direct file downloads from `stats.gov.gd`; the boundary is a direct GitHub raw download. The one operational wrinkle is the JS-rendered Open Licence Agreement page, recovered through the site's WordPress REST endpoint.

## Retrieval record

Every cached input is under `data/raw/gd_census/`, which `git check-ignore -v` confirms is excluded by `.gitignore:120` (the `data/` rule). Retrieval occurred on 2026-07-12; content type verified on every download. Downloads used `curl` with a browser user-agent.

| Cached input | Source URL | Format | SHA-256 |
| --- | --- | --- | --- |
| `gd_2011_census_report.pdf` | <https://stats.gov.gd/wp-content/uploads/2021/03/Census-Report-2011-Revised-Final.pdf> | pdf | `f0504e65e1ac2c4fc94a39813de46f448862082091cca829fe8c72ec2fe91185` |
| `gd_2021_prelim.pdf` | <https://stats.gov.gd/wp-content/uploads/2025/04/2021-National-Housing-Population-Census-Results-Latest-PRELIMINARY.pdf> | pdf | `90fe42883b3c9338c8ef0679709a25ae8e532ab8f56e2a31e2358a130554fc6f` |
| `geoBoundaries-GRD-ADM1.geojson` | <https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/GRD/ADM1/geoBoundaries-GRD-ADM1.geojson> | geojson | `24d724b5888e45f675f2e208ff81cb0283d139a0daf122538a64fcade82f1989` |
| `gb_grd_adm1_meta.json` | <https://www.geoboundaries.org/api/current/gbOpen/GRD/ADM1/> | json | `d66f011f7f9298b21eeda261296e1cd4a43d33a9cdea7c09e22383c16420235c` |
| `gd_ola_wp_rest.json` | <https://stats.gov.gd/wp-json/wp/v2/pages?slug=open-licence-agreement> | json | `74bad8ac0f3153b02e5ce2f1426c3b91cd5a48c2437216efbea0d901af5b2152` |
| `gd_terms-and-conditions.html` | <https://stats.gov.gd/terms-and-conditions/> | html | `d98bdf5e59388b7cc51b213982d6f5c5c60bd3cd94011813a83dcf2cd7762915` |
| `gd_open-licence-agreement.html` | <https://stats.gov.gd/open-licence-agreement/> | html | `c5294301fbe12245371008b0226ae9d8f275f2feaac6662ace7c1eb34285e8c2` |
| `gd_census_page.html` | <https://stats.gov.gd/census/> | html | `90cfe5c4c5314929d9cf827eba96fe5de01f1efbb80be5800dedc1ce0fab8e6b` |
| `gd_home.html` | <https://stats.gov.gd/> | html | `f0a47906e9453df66be233c8aa8c23575a5b6f0857c50f2e047917789357f178` |

Also cached (context, not build inputs): `gd_2011.txt` and `gd_2021_prelim.txt` (`pdftotext -layout` extractions) and `gd_about.html`.

## Product boundary (were the conductor to rule build)

A build on this probe would stage parish-level religious-affiliation summaries for a single wave (2021), on seven units of the geoBoundaries GRD ADM1 CC BY-SA 2.0 frame, with the verbatim twenty-six-category 2021 frame, fail-fast reconciliation at both margins (the wave closes integer-exact to 108,279), the disclosed Town-of-St.-George→St.-George parish aggregation, and a settled two-slot design (the "No Religious Affiliation" line, and a conductor decision on whether "Atheist" joins the no-religion slot). It would carry no place-of-worship layer, no cross-wave change layer (single wave), and no 2001/2011 parish wave (national only). The census licence is an accepted open reuse grant; the product would ship with the required CSO acknowledgement-of-source notice.

## Blockers and held items

- **Queued waves have no parish religion (documented, not a block to future work)**: 2001 and 2011 religion are national only. The clean unblock to a 2001/2011 parish wave is a CSO data request for a religion-by-parish cross-tab; recorded as a courtesy ask for the PI, not sent.
- **2021 parish wave is preliminary and out of span (conductor ruling)**: Table 23 reconciles exactly and the licence is accepted, but the source is a preliminary release and the wave falls outside the queue's 2001–2011 span. A conductor/PI ruling to build the single-wave 2021 preliminary product is the primary unblock; the CSO's final 2021 report is the alternative.
- **Town-of-St.-George aggregation (conductor ruling)**: matching the eight-column table to the seven-unit boundary requires summing St. George and Town of St. George into one parish row. The sum is exact and disclosed, but it touches the "no merged values" gate and is the conductor's to approve.
- **Slot design for two no-religion lines (build decision)**: the 2021 frame carries both "Atheist" (49) and "No Religious Affiliation" (6,444). The build must settle whether the no-religion slot is the latter alone or both combined.
