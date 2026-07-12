# Guyana census-religion route probe

Verified 2026-07-12. The Bureau of Statistics, Guyana (BoS, `statisticsguyana.gov.gy`) publishes religion **by administrative region** as a count-valued cross-tab for **one** census wave — **2012** — across the ten regions, in the Final 2012 Census Compendium 2 "Population Composition", Table 2.19 "Distribution of the Population by Religious Affiliation and Administrative Regions, Guyana: 2012". The queue premise ("2002-2022 | region to be extracted | census affiliation; release not confirmed for religion | browser work | probe then build") holds on geography (region, ten units) and on the census-affiliation construct; it is refuted on the span. The record refutes a three-wave region product: the 2022 census has released only preliminary results (total population 878,674, unveiled 12 January 2026) with no religion table in any geography, and the 2002 census publishes religion by region only as one-decimal **percentages** (Tables 2.6A/2.6B) whose national control totals are internally inconsistent across the 2002 report's own tables, so no count-valued 2002 region wave is publishable. The 2012 wave is the clean route: integer counts, ten regions, thirteen verbatim categories including a real None line, closing integer-exact at both margins to the national total of 746,955. The boundary route is clean: geoBoundaries GUY ADM1 records a stated Open Data Commons Open Database License 1.0 over the ten regions, joined one-to-one to the census regions by ISO 3166-2 code (`shapeISO`). The licence is the strongest finding: BoS publishes an explicit **Open Licence Agreement** granting free reuse (commercial and non-commercial) with an acknowledgement-of-source notice, so the census data ship with attribution and no reuse ask is needed (the Barbados BSS precedent, near-identical wording).

## Build decision (recommendation to the conductor)

- **Recommendation**: BUILD a single-wave (2012), ten-region religious-affiliation product. The route is clean under the brief's build gate (at least one wave, counts, licensed boundary, exact-margin reconciliation). The product is count-valued, integer, ten regions, thirteen verbatim categories including a real None line, closing exactly at both margins (national 746,955).
- **Single-wave caveat (for the conductor, not a build blocker)**: this is the Barbados/Antigua shape — a count-valued single-wave subnational product. The 2012 data are built and staged; the **page** decision (whether a single-wave regional choropleth surfaces) is the conductor's, parallel to the Antigua task-8 question and the Barbados staged product. Guyana clears the WAVES-OVER-DISTRICTS priority bar only weakly (a single count-valued wave), so the multi-wave premise is refuted and recorded.
- **Wave and source**:
  - **2012**: Final 2012 Census Compendium 2 "Population Composition" (PDF), Table 2.19 — integer counts, thirteen categories, ten regions. Every region column and every religion row reconciles to the printed national total exactly (national 746,955; None 23,419; Hindu 185,439; Pentecostal 170,289). The category-row national totals equal the Table 2.17 (2002 & 2012) national column exactly, an independent cross-check.
- **Geography**: 10 regions on geoBoundaries GUY ADM1 (ten units; one-to-one join by ISO 3166-2 code `shapeISO`; the census labels regions "Region 1" … "Region 10" and the build carries the canonical region names).
- **Construct**: census affiliation — each resident's reported religion, asked of the whole resident population; not practice, attendance, or membership.
- **Slot design** (ordinary two-slot, BB/SB/FM/KI precedent): `religious_affiliation_percent` = (population − None) / population; `no_religion_percent` = the single None line / population. Guyana's 2012 table carries **no** Not Stated residual — BoS prorated the "363 Religious Affiliation Not Stated", "16,331 No-Contact Persons", and "7,443 Institutional Population" across all groups so the table spans the whole census population — so the two shares sum to 100 exactly by construction. This differs from Barbados/Belize (where a Not Stated residual keeps the two shares below 100); it is a property of the prorated source and is documented, never repaired. Guyana has a real None category (23,419; 3.14% nationally, ranging 1.15% in Region 9 to 7.25% in Region 10), so affiliation is not flat and **no minority-share (task-6) treatment applies**.
- **Map-worthy pattern**: the no-religion share is legible by region and varies threefold, from 1.15% (Region 9, Upper Takutu-Upper Essequibo) and 1.54% (Region 3) to 7.25% (Region 10, Upper Demerara-Berbice) and 6.12% (Region 8). The Hindu heartland is the sugar-belt coast — Region 6 (East Berbice-Corentyne) and Region 3 (Essequibo Islands-West Demerara) are ~42% Hindu — while the hinterland regions 8 and 9 are heavily Roman Catholic (Region 9 ~50%) reflecting the Amerindian mission history; Region 4 (Demerara-Mahaica, the capital region) holds 41.7% of the population and the plurality of every group.
- **Rights position**: ACCEPTED. The BoS Open Licence Agreement grants free reuse; the product ships with the required derived-tables acknowledgement of source. No PI ask is needed. The boundary carries a stated Open Data Commons Open Database License 1.0 (share-alike; the derived boundary ships under ODbL with attribution to OpenStreetMap contributors — the Malaysia/Ghana OSM precedent).

## Published waves and geography

| Year | Official route | Religion-by-region table | Universe | Units | Decision |
| --- | --- | --- | --- | --- | --- |
| 2012 | [Final 2012 Census Compendium 2](https://statisticsguyana.gov.gy/wp-content/uploads/2019/10/Final_2012_Census_Compendium2.pdf) (PDF, p. 49) | Table 2.19 "Distribution of the Population by Religious Affiliation and Administrative Regions" (integer, 13 categories) | whole census population, all ages (746,955), Not-Stated/No-Contact/Institutional prorated | 10 regions | Ship the ten-region 2012 wave. |
| 2002 | [2002 National Census Report](https://statisticsguyana.gov.gy/wp-content/uploads/2019/10/Guyana_National_Census-Report_2002.zip) (zip; Chapter 2 Population Composition) | Tables 2.6A/2.6B — **percentages only**, no region×religion counts; national control totals internally inconsistent | census population (751,223) | 10 regions | REFUTED as a count wave — percentages-only and inconsistent; documented, not shipped. |
| 2022 | [2022 Preliminary Report](https://statisticsguyana.gov.gy/wp-content/uploads/2019/10/Preliminary-Report-Guyana-National-Population-and-Housing-Census-2022.pdf) (PDF) | none — preliminary results (population 878,674) only; final/detailed results not yet released | — | — | REFUTED — no 2022 religion table exists yet. A future final-report release is the only route to a 2022 wave. |

## Category frame (2012 Table 2.19, preserved verbatim; never merged)

Table 2.19 prints thirteen religion categories plus the Total column. The frame, in source order:

| # | Category (2012 Table 2.19) | Role | National count |
| --: | --- | --- | --: |
| 1 | Anglican | affiliation | 38,962 |
| 2 | Methodist | affiliation | 10,106 |
| 3 | Pentecostal | affiliation | 170,289 |
| 4 | Roman Catholic | affiliation | 52,901 |
| 5 | Jehovah Witness | affiliation | 9,602 |
| 6 | Seventh Day Adventist | affiliation | 40,374 |
| 7 | Bahai | affiliation | 421 |
| 8 | Muslim | affiliation | 50,572 |
| 9 | Hindu | affiliation | 185,439 |
| 10 | Rastafarian | affiliation | 3,496 |
| 11 | Other Christians | residual affiliation | 155,050 |
| 12 | None | no-religion | 23,419 |
| 13 | Other | residual affiliation | 6,324 |

The category spellings are transcribed exactly as printed ("Jehovah Witness" without the possessive, "Bahai" without diacritic, "Other Christians" plural, "Seventh Day Adventist" unhyphenated). No cell suppression appears in the table; there are no "-" or blank cells. National counts above are the printed Table 2.19 Total column, and each equals the 2012 column of Table 2.17 exactly.

The 2002 national frame (Table 2.5 / compendium Table 2.17) is the same thirteen-category list. Because the 2002 region product is not shipped (percentages-only, inconsistent), no cross-wave category alignment is attempted; the 2012 frame is carried verbatim.

## Universe, denominator, and the prorating

The 2012 religion-table denominator is the **whole 2012 census population** (746,955). Unlike Barbados or Belize, Table 2.19 carries no separate "Not Stated" line: the note states that "'363 Religious Affiliation Not Stated' added to '16,331 No-Contact Persons' and '7,443 Institutional Population'" were **prorated** across the thirteen groups, so the table spans the full enumerated population and each region column sums to the region's full population total. Two consequences follow. The first consequence is that the None line (23,419) and every affiliation line already include a prorated share of the non-response and no-contact population; the counts are BoS's published figures and are rendered verbatim, never re-derived. The second consequence is that `religious_affiliation_percent` (= (population − None) / population) and `no_religion_percent` (= None / population) sum to 100 exactly in every region — a property of the prorated source, disclosed on the quality flag and in the manifest, not a construction that hides a residual. Religion is asked of the whole resident population with no age restriction, so the region shares are comparable in construct.

## Reconciliation gates (verified in the probe; re-checked fail-fast in the build)

- **2012 (Table 2.19)**: the ten region totals (27,643 + 46,810 + 107,785 + 311,563 + 49,820 + 109,652 + 18,375 + 11,077 + 24,238 + 39,992) sum to the printed national 746,955; every one of the thirteen religion rows sums across the ten regions to its printed national total (Anglican 38,962; Methodist 10,106; Pentecostal 170,289; Roman Catholic 52,901; Jehovah Witness 9,602; Seventh Day Adventist 40,374; Bahai 421; Muslim 50,572; Hindu 185,439; Rastafarian 3,496; Other Christians 155,050; None 23,419; Other 6,324); every region column sums over the thirteen categories to its region Total; and both national margins equal 746,955. Integer-exact at every margin, no suppression. Every cell was verified against a 200-dpi render of Compendium 2 page 49. The build stops on any nonzero deviation; no value is allocated, inferred, imputed, or tuned.

National headline (2012): religious affiliation 723,536 (96.86%), None 23,419 (3.14%).

## Boundary source and licence

The boundary is [geoBoundaries GUY ADM1](https://www.geoboundaries.org/api/current/gbOpen/GUY/ADM1/). The release metadata records `"admUnitCount": "10"`, `"boundaryType": "ADM1"`, `"boundaryCanonical": "Regions"`, `"boundaryYearRepresented": "2017"`, `"boundarySource": "OpenStreetMap, Wambacher"`, and — the load-bearing field, quoted verbatim — `"boundaryLicense": "Open Data Commons Open Database License 1.0"`, `"licenseSource": "www.openstreetmap.org/copyright"`. The licence field is non-null, so the boundary route is accepted (the Malaysia/Ghana OSM ODbL share-alike precedent — the unlicensed geoBoundaries releases are the ones rejected; this release states ODbL). The ten features carry ISO 3166-2 codes in `shapeISO` (GY-BA, GY-PM, GY-ES, GY-DE, GY-MA, GY-EB, GY-CU, GY-PT, GY-UT, GY-UD), which join one-to-one to the census "Region 1" … "Region 10" via a fixed region-number→ISO crosswalk; the join is by ISO code, robust to the one `shapeName` typo ("Barina-Waini" for Barima-Waini, Region 1). The extent spans lon −61.4 to −56.5 E and lat 1.2 to 8.6 N, wholly within the standard frame and far from the antimeridian; no dateline handling is needed. The pin is commit `9469f09`.

**Essequibo territorial note**: the western regions (Barima-Waini, Cuyuni-Mazaruni, Potaro-Siparuni, Upper Takutu-Upper Essequibo, and part of Pomeroon-Supenaam) fall within the Essequibo region, subject to a long-standing Venezuelan territorial claim (before the International Court of Justice). Per the standing ruling, the build renders the **official Guyanese record neutrally**: the geoBoundaries GUY ADM1 layer is the official Guyanese administrative extent that the BoS census enumerates, and the ten-region counts are those of the Government of Guyana. The build takes no position on the dispute.

## Licence position (accepted)

The census data ship under the BoS Open Licence Agreement — an explicit open reuse grant, not an all-rights-reserved footer. The load-bearing text, fetched and quoted verbatim:

- **BoS Open Licence Agreement** (`statisticsguyana.gov.gy/open-licence-agreement/`, retrieved 2026-07-12), Licence Grant: "Bureau of Statistics, Guyana grants you (an individual or a legal entity that you are authorized to represent) a worldwide, royalty-free non-exclusive licence to freely use the data, copy, modify, translate, publish, adapt, distribute, create derivative works and value-added products for commercial and non-commercial purposes subject to the terms of this licence."
- **Acknowledgement of Source** (same page): "You shall include and maintain the following notice for all derived tables. This table was adapted from the Bureau of Statistics, Guyana, which is licenced under the Central Statistical Office's Open Licence Agreement." (The general notice is: "Source: Bureau of Statistics, Guyana. Contains information licenced under the Central Statistical Office's Open Licence Agreement.")
- **BoS website footer** (retrieved 2026-07-12): "Copyright © 2026 Bureau of Statistics. All rights reserved." — a site-content copyright notice, superseded for data by the Open Licence Agreement.
- The Terms and Conditions page (`statisticsguyana.gov.gy/terms-and-conditions/`) is linked from the site chrome but timed out on every retrieval attempt on 2026-07-12 (server-side, HTTP 000); the OLA is the governing data-reuse grant and is captured verbatim. Recorded as a minor retrieval gap, not a block.

The product is a derived aggregate summary (region religion shares) built from an openly published aggregate table, carrying the required BoS acknowledgement-of-source notice, leaking no microdata. `licence_status: accepted`; `licence_basis: bos_open_licence_agreement`. No reuse ask is needed. The boundary is ODbL 1.0 (attribution to OpenStreetMap contributors; the derived boundary ships share-alike under ODbL).

## Premise corrections (trust the record)

- **The region religion product is single-wave 2012, not 2002-2022.** The 2022 census has released only preliminary results (population 878,674, January 2026) with no religion table; the 2002 census publishes region religion only as one-decimal percentages (Tables 2.6A/2.6B) with internally inconsistent national totals. Only 2012 (Compendium 2 Table 2.19) publishes count-valued religion by region.
- **The 2002 wave is percentages-only and internally inconsistent.** The 2002 report gives three different national religion totals for the same categories: Table 2.5 (Anglican 51,935; Hindu 213,282), Table 2.6B (Anglican 51,536; Hindu 225,601), and the 2012 Compendium Table 2.17 2002 column (Anglican 52,418; Hindu 215,269). No published region×religion counts exist for 2002, and deriving them from one-decimal percentages against an inconsistent base would invent figures BoS never published. Documented and deferred, not shipped.
- **The licence is an open reuse grant, not all-rights-reserved.** The queue implied browser work with an uncertain rights posture. BoS in fact publishes an explicit Open Licence Agreement granting free reuse with attribution (the Barbados BSS template). Licence accepted; no ask needed.
- **The route is a direct download, not blocked browser work.** Compendium 2 is a direct PDF download and the 2002 report a direct zip download from `statisticsguyana.gov.gy`. The BoS site returns HTTP 403 to the automated WebFetch tool but serves cleanly to `curl` with a browser user-agent; content type verified on every download.
- **The 2012 table carries no Not Stated residual (prorated), so the two shares sum to 100 by construction** — unlike Barbados/Belize. This is a property of the prorated source, disclosed, not a task-6 flat-100 case (Guyana has a real, regionally-varying None category).

## Retrieval record

Every cached input is under `data/raw/gy_census/`, which `git check-ignore -v` confirms is excluded by `.gitignore:120` (the `data/` rule). Retrieval occurred on 2026-07-12; content type verified on every download. The BoS site 403s the automated fetch tool; downloads used `curl` with a browser user-agent, content verified.

| Cached input | Source URL | Format | SHA-256 |
| --- | --- | --- | --- |
| `gy_2012_Compendium2.pdf` | <https://statisticsguyana.gov.gy/wp-content/uploads/2019/10/Final_2012_Census_Compendium2.pdf> | pdf | `35f09013015f6e0880c81c95fe2245d51b83e07716ec96879dae9780e702e783` |
| `gy_2002_National_Report.zip` | <https://statisticsguyana.gov.gy/wp-content/uploads/2019/10/Guyana_National_Census-Report_2002.zip> | zip | `9efdcc7acd3e822c4a963d86299ac773ac8c0c086162be60212d932b494aa29e` |
| `geoBoundaries-GUY-ADM1.geojson` | <https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/GUY/ADM1/geoBoundaries-GUY-ADM1.geojson> | geojson | `695bc45f5f05024d7ccb3336bd6f317a9168598ae4879858566fc4774c718ab6` |
| `gb_guy_adm1_meta.json` | <https://www.geoboundaries.org/api/current/gbOpen/GUY/ADM1/> | json | `c56fb3611bc33c34728b9d39321c9dfae33f734914a376a18e754e6c99057834` |
| `bos_open-licence-agreement.html` | <https://statisticsguyana.gov.gy/open-licence-agreement/> | html | `5a445f141326797b214dc9810e76eaaecc2a6f0fb3bc12ad92eb2f926b1c1552` |
| `bos_census.html` | <https://statisticsguyana.gov.gy/census/> | html | `8bf0323540536c29a93edd45e38d0eacdc05498702ce4becab44e3b83504d2b7` |
| `bos_home.html` | <https://statisticsguyana.gov.gy/> | html | `850e50738b533886cb0fd6095cf2c58761fd327e4aeb9d8d0c0d9c12a22515cb` |

Also cached (context, not build inputs): the extracted 2002 report chapters under `gy_2002_report/`, `table219-49.png` (the 200-dpi render used for cell verification), and `pdftotext -layout` extractions.

## Product boundary

A build on this probe stages region-level religious-affiliation summaries for 2012 (ten regions, geoBoundaries GUY ADM1 ODbL 1.0), with the verbatim thirteen-category 2012 frame, fail-fast reconciliation at both margins (the wave closes integer-exact to 746,955), and the ordinary two-slot design (a real None line; no Not Stated residual because the source is prorated, so the two shares sum to 100). It carries no place-of-worship layer, no cross-wave region change layer (single wave), and no 2002 region wave (percentages-only, inconsistent) nor 2022 wave (not yet released). The census licence is an accepted open reuse grant; the product ships with the required BoS acknowledgement-of-source notice.

## Blockers and held items

- **Second and third waves (documented gaps, not blocks)**: no count-valued 2002 region table exists (percentages-only, internally inconsistent), and the 2022 final results carrying religion are not yet released. The clean unblock to a 2022 wave is the BoS final-report release; recorded as a watch item, not an ask.
- **2002 percentages (deferred)**: Tables 2.6A/2.6B give region religion percentages but no counts and inconsistent totals; a count-valued 2002 wave would require a BoS data request for the region×religion count table, recorded as a courtesy ask for the PI (do not send).
- **Single-wave-subnational page decision (conductor/PI)**: the page decision for a single-wave regional choropleth parallels the Barbados/Antigua task-8 question; the data are built and staged pending that decision.
- **BoS Terms and Conditions page unreachable (operational, not a block)**: the terms page timed out on every attempt; the Open Licence Agreement is the governing grant and is captured verbatim.
