# Tuvalu census-religion route probe

Verified 2026-07-11. No official Tuvalu census publishes religion by island. The queue asked for island-level affiliation across 2012, 2017, and 2022; the source record does not support it. Every published religion tabulation reaches only a two-region split, National / Funafuti / Outer Islands, and only for 2012 and 2017. The 2022 census publishes religion for the whole country alone. The build therefore ships a two-region religion product for 2012 and 2017, with 2022 as national context. This departs from the queue's island-level ask on the authority of the record.

## Build decision

- **Shipped waves**: 2012 and 2017 (subnational, two regions).
- **Shipped geography**: two regions, Funafuti and Outer Islands, on the geoBoundaries TUV ADM1 (8 island units) frame dissolved to two regions.
- **Construct**: census affiliation. The tables count each resident's reported religious denomination.
- **2022**: national only. The 2022 report publishes religion as a national distribution (Figure 5 shares), so 2022 is recorded as context, not mapped.
- **Change metric**: the two waves share the two-region geography and near-identical categories, but the 2017 collection is a mini-census (a lighter instrument than the 2012 full census). The two waves ship as levels; any change reading should carry that instrument caveat.
- **Rights position**: the 2012 and 2017 reports reserve commercial or for-profit reproduction and authorise partial reproduction for scientific, educational, or research purposes with acknowledgement of the CSD and the source. The 2022 report adds the Pacific Community (SPC) as a joint copyright holder under the same terms. The derived research product carries attribution and does not claim an unrestricted open-data licence. Boundaries are geoBoundaries TUV ADM1 under the Open Data Commons Open Database License 1.0.

## Published waves and geography

| Year | Official route | Religion tables found | Finest published religion geography | Decision |
| --- | --- | --- | --- | --- |
| 2012 | [Volume 1 Analytical Report](https://www.fao.org/fileadmin/templates/ess/ess_test_folder/World_Census_Agriculture/Country_info_2010/Reports/Reports_6/TUV_ENG_REP_2012.pdf) (official CSD publication, FAO mirror) | Summary-indicators table "Population of individual religions by region of residence" (National / Funafuti / Outer Islands, 11 categories); Table 48 religion by sex | region (Funafuti / Outer Islands) | Ship the two-region 2012 wave. |
| 2017 | [Mini-Census Preliminary Report](https://finance.gov.tv/wp-content/uploads/2022/05/Mini-Census-2017-Preliminary-Report.pdf) (finance.gov.tv) | Summary table "Resident population by religious denominations and region of residence" (National / Funafuti / Outer Islands, 11 categories) | region (Funafuti / Outer Islands) | Ship the two-region 2017 wave. |
| 2022 | [Census Report](https://stats.gov.tv/download/85/population-and-housing-census/1836/tuvalu_2022_census_report.pdf) (stats.gov.tv) | Section 3.2, Figure 5: national religion distribution (percentages) only | national | Record as national context; not mapped. |

The 2012 and 2017 reports are the source of record for the shipped counts. Each report cross-tabulates religion only by Funafuti versus Outer Islands (the two-region "region of residence" frame) and by sex; neither publishes religion by any of the nine islands. The 2022 report gives a national pie chart alone.

## Why island level is unavailable

The Pacific Data Hub hosts the 2012 (catalog 50) and 2017 (catalog 269) census microdata, each carrying a record-level religion variable that could be tabulated by island. That route is licensed microdata, and any island table produced from it would be a project-produced tabulation, not an official published table. The honest official ceiling is the two-region split. An island-level religion table request to the Tuvalu CSD (statistics@gov.tv), or a released island tabulation, would supply the queue's island geography with official authority. Recorded as a deferred source in the manifest.

## Category frame

The source spellings are preserved from each report. Every named religion and the report's "Other" category contribute to religious affiliation; "None" contributes to no religion; "Refused" is non-response, retained in the denominator and outside both headline numerators (the Tonga precedent).

| Source spelling (2012 / 2017) | Product role |
| --- | --- |
| Ekalesia Kelisiano Tuvalu | religious affiliation |
| Seventh Day Adventist | religious affiliation |
| Jehova's Witness | religious affiliation |
| Bahai | religious affiliation |
| Brethren | religious affiliation |
| Assembly Of God (2012) / Assemblies of God (2017) | religious affiliation |
| Catholic | religious affiliation |
| Latter Day Saint (2012) / Latter Day Saints (2017) | religious affiliation |
| Other | religious affiliation |
| None | no religion |
| Refused | non-response |

The 2022 national distribution (Figure 5 shares, context only): EKT 86, Brethren 3, AOG 2, SDA 2, Catholic 1, LDS 1, Bahaii 1, Jehovah's Witness 1, Other 2, None 0, Refused 0, Not stated 1.

## Denominator and near-universal affiliation

The denominator is each region's resident population, the sum of the eleven religion categories. Refused stays in the denominator and outside both headline numerators, so religious affiliation percent and no religion percent do not sum to 100 percent. Tuvalu is close to universally affiliated (about 99.7 percent), so the two headline metrics barely differ between regions (Funafuti 99.4-99.7 percent affiliation; Outer Islands about 99.95-99.98 percent). The substantive subnational contrast is denominational, notably a lower Ekalesia Kelisiano Tuvalu share on Funafuti (about 79 percent in 2012, 81 percent in 2017) than on the Outer Islands (about 93 percent), which the shared headline metric set does not carry. The product is honest governed data with exact provenance; the headline choropleth is near-flat by construction.

## Reconciliation gates

- For every wave and every category, Funafuti + Outer Islands equals the printed national value. No value was allocated, inferred, rounded, or tuned.
- The eleven-category column sums equal the census resident population: 2012 national 10,640 (Funafuti 5,436; Outer 5,204); 2017 national 10,507 (Funafuti 6,320; Outer 4,187). The 2012 anchor is confirmed independently by the report's age-structure rows (<15 + 15-59 + 60+), which sum to the same region totals; the 2017 anchor is the report's printed "Resident population by region of residence".
- The build stops and records failing rows precisely on any arithmetic mismatch (stop-don't-tune).

## Boundary source and licence

The boundary is [geoBoundaries TUV ADM1](https://www.geoboundaries.org/api/current/gbOpen/TUV/ADM1/), boundary ID `TUV-ADM1-17741764`. The release metadata states `"boundaryLicense": "Open Data Commons Open Database License 1.0"`, `"boundarySource": "OpenStreetMap, Wambacher"`, `"boundaryYearRepresented": "2017"`, and `"admUnitCount": "8"`. The build uses that release metadata as the licence authority.

The layer has eight island features: Nanumea, Nanumanga, Niutao, Nui, Vaitupu, Nukufetau, Funafuti, and Nukulaelae. This is eight, not the nine Tuvaluan islands: Niulakita, the ninth island, has no separate ADM1 feature and is administered with Niutao; in the census it falls within the Outer Islands region, so the two-region product covers it. Funafuti is one ADM1 unit (the capital atoll's land), used directly as the Funafuti region; the other seven islands dissolve to the Outer Islands region. The source layer carries eight valid features; the dissolved output carries two valid, non-empty features with two distinct geometry hashes (the Bahamas archipelago trap: `c()` on an sfg list would recycle one union across both rows). The required `scripts/lib/simplify_boundary.R` helper wrote a 52,903-byte GeoJSON at 100% weighted keep-shapes with allow-overlaps clean, below the 3 MB ceiling.

## Retrieval record

Every cached input is under `data/raw/tv_census/`, which `git check-ignore -v` confirms is excluded by `.gitignore:120` through the `data/` rule. Each cached file carries a `.meta.json` sidecar with its sha256, byte size, source URL, and an honest hosting note. Retrieval occurred on 2026-07-11. The manifest records the same URLs and hashes.

| Cached input | Source URL | Hosting | SHA-256 |
| --- | --- | --- | --- |
| `tv_2012_census_vol1_fao.pdf` | <https://www.fao.org/fileadmin/templates/ess/ess_test_folder/World_Census_Agriculture/Country_info_2010/Reports/Reports_6/TUV_ENG_REP_2012.pdf> | official CSD publication, FAO mirror | `eb3b6eb67d5abae53104dacf485328c00cc0e6931f8428d6c014ed13b8054986` |
| `tv_2017_minicensus_prelim.pdf` | <https://finance.gov.tv/wp-content/uploads/2022/05/Mini-Census-2017-Preliminary-Report.pdf> | official (Tuvalu Ministry of Finance / CSD) | `8b7ec1a48b16dd6b518bd0a168c287c78bc84d23b5a9f50dcb391d4a75a7c6fa` |
| `tv_2022_census_report.pdf` | <https://stats.gov.tv/download/85/population-and-housing-census/1836/tuvalu_2022_census_report.pdf> | official (Tuvalu CSD) | `2f91a61b3d40d7ca30989daba83b25edfb5e6f7c458fe8c721a5e23c42b59825` |
| `geoBoundaries-TUV-ADM1.geojson` | <https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/TUV/ADM1/geoBoundaries-TUV-ADM1.geojson> | geoBoundaries gbOpen (pinned 9469f09) | `3c06779be3173360c9a2927729798eacb5533c745e31313f11940041585030aa` |
| `gb_tuv_adm1_meta.json` | <https://www.geoboundaries.org/api/current/gbOpen/TUV/ADM1/> | geoBoundaries API | `d6878f7625da2b7a7e08d7a0c6641f46bcc4d3a3cd25bedd798137d445bc7199` |

## Publication terms (quoted from cached bytes)

The 2012 report copyright page states: "© Copyright Central Statistics Division (CSD) of the Government of Tuvalu" and "All rights for commercial / for profit reproduction or translation, in any form, reserved. CSD authorises the partial reproduction or translation of this material for scientific, educational or research purposes, provided that CSD and the source document are properly acknowledged. Permission to reproduce the document and/or translate in whole, in any form, whether for commercial / for profit or non-profit purposes, must be requested in writing."

The 2022 report copyright page states: "© Copyright Pacific Community (SPC) and Central Statistics Division (CSD) 2025" and "All rights for commercial/for profit reproduction or translation, in any form, is reserved. SPC and Tuvalu CSD authorises the partial reproduction or translation of this material for scientific, educational or research purposes, provided that SPC and Tuvalu CSD and the source document are properly acknowledged."

The geoBoundaries release metadata states `"boundaryLicense": "Open Data Commons Open Database License 1.0"`.

## Product boundary

The staged data product contains only the two-region 2012 and 2017 summaries and the licensed simplified two-region geometry. It does not contain island polygons, an island-level religion table, a country page, a place-of-worship snapshot, place-density metrics, or a mapped 2022 wave. The PDH microdata and a CSD island-tabulation request are recorded as deferred routes to the queue's island geography; the 2022 report is a deferred route to a mapped current wave.
