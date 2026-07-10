# Tonga census-affiliation route probe

Verified 2026-07-10. The build ships one 2021 census-affiliation snapshot for 23 districts. The official workbook reaches villages, but no licensed village polygon layer was pinned. The licensed district layer joins every district one-to-one. Earlier official reports contain subnational religion tables, but they require a separate comparability extraction before Tonga can support change over time.

## Build decision

- **Shipped wave**: 2021.
- **Shipped geography**: 23 districts on the geoBoundaries TON ADM2 2020 frame.
- **Construct**: census affiliation. The table does not measure religious practice, attendance, or registered membership.
- **Change metric**: withheld because only one district wave ships.
- **Rights position**: the 2021 census report authorises partial scientific, educational, or research reproduction with acknowledgement. It reserves commercial or for-profit reproduction. The derived research product carries attribution and does not claim an unrestricted open-data licence.

## Published waves and geography

| Year | Official route | Religion tables found | Finest published geography | Decision |
| --- | --- | --- | --- | --- |
| 2021 | [Religion workbook](https://tongastats.gov.to/download/266/general-tables/7664/4-religion.xlsx) and [Census Volume 1](https://tongastats.gov.to/download/272/census-report-and-factsheet/7647/census-report-vol1-2021.pdf) | Workbook `G 18` by sex and division, `G 19` by division and district, and `G 20` by division, district and village. The report numbers the corresponding tables `G 16`, `G 17`, and `G 18`. | village | Ship the 23 district rows from workbook `G 19`; village polygons were not pinned. |
| 2016 | [Census report Volume 1, second edition](https://tongastats.gov.to/download/60/2016/4062/2016-census-report-volume-1-2nd-edition.pdf) | `G 17` by sex and division, `G 18` by division and district, and `G 19` by division, district and village. | village | Defer. The national rows in `G 18` and `G 19` differ for at least `AOG` and `NO Rel`; a longitudinal extraction must resolve that published discrepancy before use. |
| 2011 | [PDH-hosted basic tables](https://microdata.pacificdata.org/index.php/catalog/184/download/2684) | `G 17` by sex and division, `G 18` by division and district, and `G 19` by division, district and village. | village | Defer for category, denominator, and geography comparison. |
| 2006 | [PDH-hosted basic tables](https://microdata.pacificdata.org/index.php/catalog/183/download/935) | `G 17` by sex and division, `G 18` by division and district, and `G 19` by division, district and village. | village | Defer. `G 18` uses a private-household basis, while `G 19` uses total population; the district table cannot substitute for the village table's basis. |
| 1996 | [Pacific Data Hub catalogue record](https://microdata.pacificdata.org/index.php/catalog/182) | Metadata confirms a `RELIGION` variable. No official aggregate subnational religion table was pinned. | unverified | Future research route only. |

The 2021 workbook is the source of record for the shipped counts. Its 23 district rows sum exactly to all five printed division rows and to the printed national row for `Total` and every category. The report's district table prints the same 2021 counts and supplies the category definitions, population exclusions, and publication terms.

## 2021 category frame

The source spelling column preserves the workbook `G 19` header verbatim. English display labels are separate. Every named religion and `Other` contributes to `religious_affiliation_count`; `NO Rel` contributes to `no_religion_count`; `REF` contributes to neither headline numerator.

| Source spelling | English display label | Product role |
| --- | --- | --- |
| `FWC` | Free Wesleyan Church | religious affiliation |
| `RC` | Roman Catholic | religious affiliation |
| `LDS` | Latter Day Saints | religious affiliation |
| `FCOT` | Free Church of Tonga | religious affiliation |
| `COT` | Church of Tonga | religious affiliation |
| `AOG` | Assembly of God | religious affiliation |
| `TOK` | Tokaikolo / Maamafo'ou | religious affiliation |
| `CCOT` | Constitutional Church of Tonga | religious affiliation |
| `GOS` | Gospel Church | religious affiliation |
| `AGC` | Anglican Church | religious affiliation |
| `SDA` | Seventh Day Adventist | religious affiliation |
| `MF` | Mo'ui Fo'ou 'Ia Kalaisi | religious affiliation |
| `TSA` | The Salvation Army | religious affiliation |
| `JW` | Jehovah's Witness | religious affiliation |
| `OP` | Other Pentecostal | religious affiliation |
| `BF` | Baha'i Faith | religious affiliation |
| `BUDH` | Buddhist | religious affiliation |
| `ISL` | Islam | religious affiliation |
| `HND` | Hinduism | religious affiliation |
| `NO Rel` | No religious affiliation | no religion |
| `REF` | Refused to answer | non-response |
| `Other` | Other minor religious groups | religious affiliation |

The workbook uses `AGC`, while the report's definition note prints `AC` and “Angelican Church” beside its first religion table. The district headers use `AGC`. The product therefore preserves `AGC` as the source category and uses “Anglican Church” only as the English display label.

## Denominator and exclusions

The denominator is each district's printed `Total` in workbook `G 19`. `REF` remains in the denominator and outside both headline numerators. The source's `NO Rel` category remains in the denominator and supplies the no-religion numerator. The national basis is 99,408 people: 98,715 religious affiliation, 574 no religious affiliation, and 119 refused responses. The two headline shares do not sum to 100% because refused responses remain in the denominator.

The workbook note says “Exclude visitor or non-resident”. The corresponding report table specifies that persons occupying institutions and non-resident visitors to households are excluded. The product states this outside-basis population rule and does not imply that `Total` is Tonga's unrestricted census-night population.

## Reconciliation gates

- All 29 numeric rows in workbook `G 19` reconcile exactly: the 22 mutually exclusive categories sum to each printed `Total`.
- Each division's districts sum exactly to the printed division row for `Total` and all 22 categories.
- The 23 district rows sum exactly to the national row for `Total` and all 22 categories.
- No value was allocated, inferred, rounded, or tuned to force reconciliation.
- The product releases no `religious_change` value because only 2021 ships.

## Boundary source and licence

The boundary is [geoBoundaries TON ADM2](https://www.geoboundaries.org/api/current/gbOpen/TON/ADM2/), boundary ID `TON-ADM2-48082658`. The release metadata states `"boundaryCanonical": "district"`, `"boundaryYearRepresented": "2020"`, `"boundarySource": "Pacific Data Hub"`, `"admUnitCount": "23"`, and `"boundaryLicense": "Creative Commons Attribution 4.0 International (CC BY 4.0)"`. The build uses that release metadata as the licence authority.

All 23 census districts join one-to-one. Three explicit spelling concordances preserve both labels: `Ha'ano` to boundary ``Ha`ano``, `'Eua Motu'a` to boundary `'Eua Prope`, and `'Eua Fo'ou` to boundary `'Eua fo'ou`. No district is split or merged.

The source and simplified layers each contain 23 valid, non-empty features with 23 distinct geometry hashes. Pairwise overlap is effectively zero. Two source-defined water holes remain in the geometry; no uncovered inter-district gap exists. Every feature exceeds 1 km². The required `scripts/lib/simplify_boundary.R` helper wrote a 190,065-byte GeoJSON at 100% weighted keep-shapes, below the 3 MB ceiling.

## Publication terms

The 2021 census report's copyright page states: “All rights for commercial for profit reproduction or translation, in any form, reserved.” It also states: “TDS authorises the partial reproduction ... for scientific, educational or research purposes”. The same sentence requires acknowledgement of TSD and the source document. The report prints `TDS`; the agency identifies itself elsewhere as Tonga Statistics Department (TSD).

The TSD website footer asserts copyright and links to `https://www.gov.to/termsandcondtions/`. That exact link returned HTTP 404 on 2026-07-10. The build therefore relies on the publication-specific 2021 census terms. It describes the resulting permission as partial research reuse with attribution and records the commercial restriction. It does not claim Creative Commons or unrestricted open-data terms for the census counts.

## Retrieval record

Every cached input is under `data/raw/to_census/`, which `git check-ignore -v` confirms is excluded by `.gitignore:120` through the `data/` rule. Retrieval occurred on 2026-07-10. The manifest records the same URLs, byte sizes, uses, and hashes.

| Cached input | Source URL | SHA-256 |
| --- | --- | --- |
| `to_2021_religion.xlsx` | <https://tongastats.gov.to/download/266/general-tables/7664/4-religion.xlsx> | `e62242fffe0eefe5a238cb9b1c09786db1420c9d7733e1257ed925f39a4f3b0e` |
| `to_2021_census_report_volume_1.pdf` | <https://tongastats.gov.to/download/272/census-report-and-factsheet/7647/census-report-vol1-2021.pdf> | `d78fd27bb4053a7afc431cfcc833109122dda1b57ef92017328870524b2d5edd` |
| `tongastats_census_hub.html` | <https://tongastats.gov.to/census-2/population-census-3/census-report-and-factsheet/> | `db535d539990013fe412c22a711d2011330378e8313aa4e255db2474ed16123b` |
| `tongastats_contact.html` | <https://tongastats.gov.to/about-us/contact-us/> | `04def7707fe8d9af93c35844a692a49952e0b4a4f2e619f35a03e1301e72ce0c` |
| `gb_ton_adm2_meta.json` | <https://www.geoboundaries.org/api/current/gbOpen/TON/ADM2/> | `b56fb369f23ceb648e7b796b010c4fe2b6e9965af624cfad1d64a7e545cebb54` |
| `geoBoundaries-TON-ADM2.geojson` | <https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/TON/ADM2/geoBoundaries-TON-ADM2.geojson> | `2ae224412bf25b0da5cda4b3565e82cb8e891330d1185d4eb5098e8e7c05b383` |
| `to_2016_census_report_volume_1.pdf` | <https://tongastats.gov.to/download/60/2016/4062/2016-census-report-volume-1-2nd-edition.pdf> | `ba31b9f9fe3cd4db7913ae10896de79d9261b4cd4eb3be4e170feda2bd54b1aa` |
| `to_2011_basic_tables.pdf` | <https://microdata.pacificdata.org/index.php/catalog/184/download/2684> | `dd07acad523cfc09c0aaae3de0d767bf4173de71bf9f7b164f07d8818c002ca0` |
| `to_2006_basic_tables.pdf` | <https://microdata.pacificdata.org/index.php/catalog/183/download/935> | `4c89cbf26c0df812e466354b1f5fba9334073213ec0c8eab5f5035ac42d1852a` |
| `pdh_1996_catalog.html` | <https://microdata.pacificdata.org/index.php/catalog/182> | `3f147d1955c88b75a36563c724dfd4d815799961604e149cb7ef63a47b691db8` |

## Product boundary

The staged data product contains only 2021 district summaries and the licensed simplified district geometry. It does not contain village polygons, a country page, a place-of-worship snapshot, place-density metrics, or a cross-wave change layer. The 2006, 2011, and 2016 reports provide credible future extraction routes. Their category frames, denominators, and geography labels must reconcile independently before they can extend the product.
