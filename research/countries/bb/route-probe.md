# Barbados census-religion route probe

Verified 2026-07-12. The Barbados Statistical Service (BSS, `stats.gov.bb`) publishes religion **by parish** as a count-valued cross-tab for **one** census wave — **2010** — across the eleven parishes (St. Michael, Christ Church, St. George, St. Philip, St. John, St. James, St. Thomas, St. Joseph, St. Andrew, St. Peter, St. Lucy), in the 2010 Population and Housing Census Volume 1, Table 02.06 "Total Population by Parish, Sex and Religion". The queue premise ("2010-2021 | parish to be confirmed | census affiliation | browser work | probe then build") holds on geography (parish, eleven units) and on the 2010 wave; it is refuted on the second wave and on the licence. The record refutes a 2021 parish wave: the 2021 census collected religion (questionnaire item P11, "Are you affiliated with any religious denomination?" and "What is your religious affiliation/denomination?") but the 2021 Population and Housing Census Report publishes no religion table in any geography — its table list runs from population, marital status, and education through occupation, fertility, and dwelling units, with religion absent. Earlier waves publish religion at national level only: the 2000 National Census Report Table 2.7 prints national religion for 1990 and 2000, and the 2000 Volume 2 detailed tables carry no religion cross-tab. The parish product is therefore single-wave 2010, count-valued (integer full-count), and closes exactly at both margins. The boundary route is clean: geoBoundaries BRB ADM1 records a stated Creative Commons Attribution 2.5 Generic licence over the eleven parishes, which join the census one-to-one under a deterministic "St." → "Saint" name crosswalk. The licence is the strongest finding: BSS publishes an explicit **Open Licence Agreement** granting free reuse (commercial and non-commercial) with an acknowledgement-of-source notice, so the census data ship with attribution and no reuse ask is needed.

## Build decision (recommendation to the conductor)

- **Recommendation**: BUILD a single-wave (2010), eleven-parish religious-affiliation product. The route is clean under the brief's build gate (at least one wave, counts, licensed boundary, exact-margin reconciliation). The product is count-valued, integer full-count, eleven parishes, twenty-three verbatim categories including a real None line and a separate Not Stated residual, closing exactly at both margins.
- **Single-wave caveat (for the conductor, not a build blocker)**: this is the Antigua shape — a single-wave, count-valued parish religion product for a small country. The Antigua 2011 parish build "awaits the PI task 8 single-wave-subnational ruling", and the conductor's recorded task-8 view already leans BUILD for count-valued single-wave parish products ("The same reasoning clears Antigua's stronger 2011 parish case"). The Barbados data are built and staged; the **page** decision (whether a single-wave parish choropleth surfaces) is the conductor's, parallel to Antigua. Barbados clears the WAVES-OVER-DISTRICTS priority bar as a small country with eleven parishes.
- **Wave and source**:
  - **2010**: 2010 Population and Housing Census, Volume 1 (PDF), Table 02.06 "Total Population by Parish, Sex and Religion" — integer full-count, twenty-three categories, eleven parishes, Both Sexes rows used. Every parish column and every religion row reconciles to the printed national total exactly (national 226,193; None 46,559; Not Stated 2,776).
- **Geography**: 11 parishes on geoBoundaries BRB ADM1 (eleven units; one-to-one join under a St.→Saint crosswalk; "Christ Church" identical in both).
- **Construct**: census affiliation — each resident's reported religion/denomination, asked of the whole resident population; not practice, attendance, or membership.
- **Slot design** (ordinary two-slot, SB/FM/KI precedent): `religious_affiliation_percent` = (population − None − Not Stated) / population; `no_religion_percent` = the single None line / population. Not Stated stays in the denominator and in neither slot, so the two shares need not sum to 100 (the FJ/SB unallocated-residual precedent). Barbados has a real None category, so no minority-share (task-6) treatment applies.
- **Map-worthy pattern**: no-religion share is legible by parish and already substantial in 2010. National no-religion was 20.6% (46,559 / 226,193). By parish it runs from 16.3% (St. Philip) and 16.7% (St. James) in the south-east to 25.8% (St. Joseph) and 23.6% (St. Michael); the rural north-central parishes (St. Joseph, St. Lucy 22.5%, St. George 22.1%) are the most secular. Anglican concentration is heaviest in the traditional plantation belt (St. John 37.5% Anglican, St. Philip 29.9%) and lightest in the north (St. Andrew 15.2%, St. Lucy 17.3%, St. Thomas 18.4%), where Pentecostal and Adventist bodies are strong (St. Lucy 13.4% Adventist against 0.8% Roman Catholic).
- **Rights position**: ACCEPTED. The BSS Open Licence Agreement grants free reuse; the product ships with the required value-added-product acknowledgement of source. No PI ask is needed. The boundary carries a stated CC BY 2.5 Generic licence.

## Published waves and geography

| Year | Official route | Religion-by-parish table | Universe | Units | Decision |
| --- | --- | --- | --- | --- | --- |
| 2010 | [2010 PHC Volume 1](https://stats.gov.bb/wp-content/uploads/2020/03/2010-PHC-Report-Vol-1.pdf) (PDF) | Table 02.06 "Total Population by Parish, Sex and Religion" (integer full-count, 23 categories) | Tabulable Population, all persons, all ages (226,193) | 11 parishes | Ship the eleven-parish 2010 wave. |
| 2021 | [2021 PHC Report](https://stats.gov.bb/wp-content/uploads/2024/02/2021-Population-and-Housing-Census.pdf) (PDF) | none — religion collected (questionnaire P11) but no religion table published | — | — | REFUTED — no 2021 parish (or national) religion table exists. A BSS data request is the only route to a 2021 wave. |
| 2000 / 1990 | [2000 National Census Report](https://stats.gov.bb/wp-content/uploads/2020/05/Barbados-2000-Census-Report.pdf) (PDF) | Table 2.7 "Population by Religious Affiliation/Denomination: 1990 and 2000" — **national only** | all persons (2000: 250,010; 1990: 247,288) | national | Deeper-history national series, not a parish product. |

The 2000 Census Volume 2 ([PHC-2000 volume 2](https://stats.gov.bb/wp-content/uploads/2020/05/PHC-2000-_volume_2.pdf)) holds the detailed cross-tabulations and carries no religion-by-parish table (checked). The 2010 report also prints Table 02.05 "Total Population by Sex, Age Group and Religion" (national religion by age, same 226,193 universe and 23-category frame), corroborating the parish table's national margins; it is national context, not the route.

## Category frame (2010, preserved verbatim; never merged)

Table 02.06 prints twenty-three religion categories plus the Total column. The frame, in source order:

| # | Category (2010 Table 02.06) | Role |
| --: | --- | --- |
| 1 | Adventist | affiliation |
| 2 | Anglican | affiliation |
| 3 | Baptist | affiliation |
| 4 | Brethren | affiliation |
| 5 | Church of God | affiliation |
| 6 | Jehovah Witness | affiliation |
| 7 | Methodist | affiliation |
| 8 | Moravian | affiliation |
| 9 | Mormon | affiliation |
| 10 | Nazarene | affiliation |
| 11 | Pentecostal | affiliation |
| 12 | Roman Catholic | affiliation |
| 13 | Salvation Army | affiliation |
| 14 | Wesleyan | affiliation |
| 15 | Other Christian | residual affiliation |
| 16 | Baha'i | affiliation |
| 17 | Hindu | affiliation |
| 18 | Jewish | affiliation |
| 19 | Muslim | affiliation |
| 20 | Rastafarian | affiliation |
| 21 | Other Non-Christian | residual affiliation |
| 22 | None | no-religion |
| 23 | Not Stated | non-response |

The 2000/1990 national frame (Table 2.7) is a coarser seventeen-category list (Adventist, Anglican, Baptist, Brethren, Church of God, Hindu, Jehovah's Witness, Methodist, Moravian, Muslim, Pentecostal, Rastafarian, Roman Catholic, Salvation Army, Other, None, Not Stated) — it lacks the 2010 Nazarene, Wesleyan, Other Christian, Baha'i, Jewish, and Other Non-Christian lines and folds them into Other. Because the parish product is 2010-only, no cross-wave category alignment is attempted; the 2010 frame is carried verbatim. Printed "-" cells in Table 02.06 (structural zeros for small denominations in small parishes, e.g. Mormon in St. Andrew, Jewish in St. John/St. Joseph/St. Lucy, Salvation Army in St. Joseph) are transcribed as 0. No cell suppression appears in the table.

## Universe and denominator

The 2010 religion-table denominator is the **Tabulable Population** (226,193), distinct from the **Estimated Resident Population** (277,821). The 2010 census reports both: the Estimated Resident Population is the adjusted total (277,821 = 133,018 male + 144,803 female), and the Tabulable Population is the enumerated population carried through the detailed cross-tabulations (226,193 = 108,271 male + 117,922 female). The difference (51,628) is the census undercount. Religion (like every Volume 1 cross-tab) is tabulated on the Tabulable Population, so 226,193 is the correct religion denominator; the published 2010 religion shares confirm it (Anglican 53,969 / 226,193 = 23.9%, no-religion 46,559 / 226,193 = 20.6%, both matching the widely-cited 2010 figures). The build reads each parish's shares within the parish Tabulable Population Total and never treats the undercount or the Estimated Resident Population as a religion quantity. Religion is asked of the whole resident population with no age restriction, so the parish shares are comparable in construct. One minor internal inconsistency is recorded and not used: Table 01.01 prints the national sex split as 108,223 / 117,970 while the Tabulable Population line and Table 02.06 print 108,271 / 117,922; the Both Sexes total is 226,193 in every table, and the build uses only Both Sexes.

## Reconciliation gates (verified in the probe; re-checked fail-fast in the build)

- **2010 (Table 02.06, Both Sexes)**: the eleven parish totals (69,604 + 43,127 + 18,203 + 23,788 + 8,617 + 21,258 + 12,035 + 5,939 + 4,631 + 10,382 + 8,609) sum to the printed national 226,193; every one of the twenty-three religion columns sums across the eleven parishes to its printed national total (Anglican 53,969; Pentecostal 44,093; None 46,559; Adventist 13,437; Methodist 9,461; Roman Catholic 8,679; Wesleyan 7,701; Other Christian 7,567; Nazarene 7,300; Church of God 5,356; Jehovah Witness 4,515; Baptist 4,082; Moravian 2,692; Rastafarian 2,332; Not Stated 2,776; Muslim 1,605; Brethren 1,075; Hindu 1,055; Salvation Army 879; Other Non-Christian 624; Mormon 235; Jewish 103; Baha'i 98); every parish column sums over the twenty-three categories to its parish Total; and both national margins (parish-total sum and category-total sum) equal 226,193. Integer-exact at every margin, no suppression. The build stops on any nonzero deviation; no value is allocated, inferred, imputed, or tuned.

National headline (2010): religious affiliation 176,858 (78.2%), None 46,559 (20.6%), Not Stated 2,776 (1.2%).

## Boundary source and licence

The boundary is [geoBoundaries BRB ADM1](https://www.geoboundaries.org/api/current/gbOpen/BRB/ADM1/). The release metadata records `"admUnitCount": "11"`, `"boundaryType": "ADM1"`, `"boundaryYearRepresented": "2005"`, `"boundarySource": "geoBoundaries, Wikimedia"`, and — the load-bearing field, quoted verbatim — `"boundaryLicense": "Creative Commons Attribution 2.5 Generic"`, `"licenseSource": "commons.wikimedia.org/wiki/File"`. The licence field is non-null, so the boundary route is accepted (the Belize/Dominica ADM1 CC BY 2.5 precedent). The eleven `shapeName` values (Christ Church, Saint Andrew, Saint George, Saint James, Saint John, Saint Joseph, Saint Lucy, Saint Michael, Saint Peter, Saint Philip, Saint Thomas) match the eleven census parishes one-to-one under a "St." → "Saint" crosswalk ("Christ Church" identical). The extent spans lon −59.65 to −59.42 E and lat 13.04 to 13.34 N, wholly within the standard frame and far from the antimeridian; no dateline handling is needed. The pin is commit `9469f09`.

## Licence position (accepted)

The census data ship under the BSS Open Licence Agreement — an explicit open reuse grant, not an all-rights-reserved footer. The load-bearing text, fetched and quoted verbatim:

- **BSS Open Licence Agreement** (`stats.gov.bb/open-licence-agreement/`, retrieved 2026-07-12), Licence Grant: "BSS grants you (an individual or a legal entity that you are authorized to represent) a worldwide, royalty-free non-exclusive licence to freely use the data, copy, modify, translate, publish, adapt, distribute, create derivative works and value-added products for commercial and non-commercial purposes subject to the terms of this licence."
- **Acknowledgement of source** (same page): "You shall include and maintain the following notice for all value-added products. This product was adapted from the Barbados Statistical Service's information, which is licensed under the Barbados Statistical Service's Open Licence Agreement." (The general notice is: "Source: Barbados Statistical Service. Contains information licenced under the Barbados Statistical Service's Open Licence Agreement.")
- **BSS Terms and Conditions** (`stats.gov.bb/terms-and-conditions/`, retrieved 2026-07-12), Terms of Use of Data: "Access and use of the data is subject to the requirements set forth under the Open Licence Agreement." The same page asserts general copyright over the website contents, but the data-use clause routes explicitly to the Open Licence Agreement.
- **BSS website footer** (retrieved 2026-07-12): "Copyright © 2021 Barbados Statistical Service." — a site-content copyright notice, superseded for data by the Open Licence Agreement.

The product is a derived aggregate summary (parish religion shares) built from an openly published aggregate table, carrying the required BSS acknowledgement-of-source notice, leaking no microdata. `licence_status: accepted`; `licence_basis: bss_open_licence_agreement`. No reuse ask is needed. The boundary is CC BY 2.5 Generic (attribution to geoBoundaries / Wikimedia Commons).

## Premise corrections (trust the record)

- **The parish religion product is single-wave 2010, not 2010–2021.** The 2021 census collected religion (questionnaire P11) but the 2021 report publishes no religion table in any geography; 1990 and 2000 religion are national only (2000 Report Table 2.7). A 2021 parish wave would require a BSS data request.
- **The licence is an open reuse grant, not all-rights-reserved.** The queue implied a browser-work route with an uncertain rights posture. BSS in fact publishes an explicit Open Licence Agreement granting free reuse with attribution, and the Terms and Conditions route data use to it. Licence accepted; no ask needed. This is the cleanest Caribbean licence in the recent tranche (cf. Belize/SIB, which ships build-then-ask).
- **The route is a direct PDF download, not browser work** — the 2010 Volume 1, 2000 report, and 2021 report are direct file downloads from `stats.gov.bb`. The one operational wrinkle is a site condition, not a route block: the `stats.gov.bb` TLS certificate has expired, so retrieval used `curl -k` (certificate verification disabled) with content-type verified on every download; the PDFs and the boundary are byte-identical to their sources and checksummed below.
- **The religion denominator is the Tabulable Population (226,193), not the Estimated Resident Population (277,821).** The 2010 census reports both totals; the detailed cross-tabs (including religion) are tabulated on the Tabulable Population, and the undercount (51,628) is not a religion quantity.

## Retrieval record

Every cached input is under `data/raw/bb_census/`, which `git check-ignore -v` confirms is excluded by `.gitignore:120` (the `data/` rule). Retrieval occurred on 2026-07-12; content type verified on every download. The `stats.gov.bb` TLS certificate is expired; downloads used `curl -k` with content verified.

| Cached input | Source URL | Format | SHA-256 |
| --- | --- | --- | --- |
| `bb_2010_PHC_Vol1.pdf` | <https://stats.gov.bb/wp-content/uploads/2020/03/2010-PHC-Report-Vol-1.pdf> | pdf | `1cc968a8b382ff1af629f65028d844fa82d2e947201d950d70755a9f5ef15e57` |
| `bb_2000_Census_Report.pdf` | <https://stats.gov.bb/wp-content/uploads/2020/05/Barbados-2000-Census-Report.pdf> | pdf | `14789d61db8afb6c5090ab1a323340363bb61a4008c8b7825255ccfc8a947af9` |
| `bb_2021_PHC.pdf` | <https://stats.gov.bb/wp-content/uploads/2024/02/2021-Population-and-Housing-Census.pdf> | pdf | `f4f6f5faa539c834635a1454c6733d34cd81754ea597976e2d3d863f52089bd5` |
| `bss_open_licence_agreement.html` | <https://stats.gov.bb/open-licence-agreement/> | html | `d9741e1cf974885fab8ace12d9c45d14dfd6dc3dc9601335a2597e7a1c6e2902` |
| `bss_terms.html` | <https://stats.gov.bb/terms-and-conditions/> | html | `e8db1118387c1282cce2d66e3f1815beee24678fcc4aeb800f72596222619f15` |
| `geoBoundaries-BRB-ADM1.geojson` | <https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/BRB/ADM1/geoBoundaries-BRB-ADM1.geojson> | geojson | `b51cbd344b87ffa332e6ca2003ea9b77d5ff43d00d37eec951665f5c08b31b8f` |
| `gb_brb_adm1_meta.json` | <https://www.geoboundaries.org/api/current/gbOpen/BRB/ADM1/> | json | `8065e71423d2c43b04a0a4ea5b2a13406d0b21f925a2a27ac4a69b7a27b91141` |

Also cached (context, not build inputs): `bb_2000_Census_Vol2.pdf` (2000 detailed tables, no parish religion), `bss_home.html`, `census_page.html`, `census_2010_tables_page.html`, `bss_privacy.html`, and `pdftotext -layout` extractions of the PDFs.

## Product boundary

A build on this probe stages parish-level religious-affiliation summaries for 2010 (eleven parishes, geoBoundaries BRB ADM1 CC BY 2.5 Generic), with the verbatim twenty-three-category 2010 frame, fail-fast reconciliation at both margins (the wave closes integer-exact to 226,193), and the ordinary two-slot design (Not Stated as a disclosed denominator residual). It carries no place-of-worship layer, no cross-wave parish change layer (single wave), and no 2021 parish wave (not published) nor pre-2010 parish wave (never cross-tabbed below national). The census licence is an accepted open reuse grant; the product ships with the required BSS acknowledgement-of-source notice.

## Blockers and held items

- **Second wave (documented gap, not a block)**: no 2021 (or pre-2010) parish religion table is published. The clean unblock to a two-wave product is a BSS data request for the 2021 parish religion cross-tab (P11 was collected); recorded as a courtesy ask for the PI, not sent.
- **Single-wave-subnational page decision (conductor/PI)**: the page decision for a single-wave parish choropleth parallels the Antigua task-8 question; the data are built and staged pending that decision.
- **Site TLS certificate expired (operational, not a block)**: `stats.gov.bb` serves an expired certificate; retrieval used `curl -k` with content-type and checksum verification.
- **National 1990/2000 religion (deferred)**: the 2000 Report Table 2.7 national religion series (1990, 2000) is a deeper-history national product, not a parish product; deferred.
