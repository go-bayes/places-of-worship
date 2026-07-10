# Fiji census-affiliation route probe

Verified 2026-07-11. The build ships one 2007 census-affiliation snapshot for 15 provinces, extracted from the all-ethnicity religion-by-province margin of Fiji Bureau of Statistics Table P01-3. The source prints that religion margin inside a table that also crosses religion with ethnicity; only the all-ethnicity margin ships, and the ethnicity dimension is out of scope. The 1996 and 2017 province religion tables do not exist as reconcilable official static tables in this source sweep: 1996 is licensed microdata only, and 2017 is published as an ArcGIS dashboard whose figures are absent from the 2017 General Tables. Both are recorded as deferred routes.

## Build decision

- **Shipped wave**: 2007.
- **Shipped geography**: 15 provinces (14 provinces plus the Rotuma dependency) on the geoBoundaries FJI ADM2 2020 frame.
- **Construct**: census affiliation. The table counts each enumerated resident by stated religion; it does not measure practice, attendance, or registered membership.
- **Ethnicity handling**: the source Table P01-3 crosses religion with ethnicity and publishes ethnicity-specific tables (Fijians, Indians, and their rural and urban splits). The product extracts only the first, all-ethnicity table and only its religion-by-province margin. The ethnicity dimension is out of scope; no religion-by-ethnicity cross-tab ships.
- **Change metric**: withheld because only one province wave ships.
- **Rights position**: the Fiji Bureau of Statistics website asserts "Fiji Bureau Of Statistics Office | All Rights Reserved" and the 2007 table prints only "Source: 2007 Census of Fiji, Bureau of Statistics". No explicit reuse grant or open-data licence was located. The derived aggregate is used for a research map with attribution and claims no open-data licence. This is a licence caution (the Samoa precedent), more restrictive than Tonga's explicit partial-research grant: the manifest therefore carries `downstream_status: staged` and `licence_status: needs_review` (on the manifest and on every durable file), and the product stays staged until FBoS reuse terms are resolved. The boundary is geoBoundaries FJI ADM2 under Creative Commons Attribution 4.0.

## Published waves and geography

| Year | Official route | Religion tables found | Finest published religion geography | Decision |
| --- | --- | --- | --- | --- |
| 2007 | [Table P01-3, Relationship, Ethnicity and Religion by Province of Enumeration](https://www.statsfiji.gov.fj/download/117/01_province-of-enumeration/686/03_relationship-ethnicity-and-religion-by_province-of-enumeration_fiji-2007.pdf) (Fiji Bureau of Statistics) | The RELIGION section of the first, all-ethnicity table gives six top-level religion categories by the 15 provinces plus a national column; the Christian total resolves into 18 sub-denominations. | province | Ship the 15 province rows from the all-ethnicity religion margin. |
| 2017 | [2017 Census Release 3: Administrative Report and General Tables](https://www.statsfiji.gov.fj/download/121/phc-2017/729/2017-population-and-housing-census-release-3.pdf) (484 pp.); [FBoS "Population by Major Religious Groups" ArcGIS experience](https://experience.arcgis.com/experience/fd6bb849099f46869125089fd13579ec/page/Population--by-Major-Religious-Groups) | The 2017 census collected religion, and the official FBoS ArcGIS experience maps population by major religious group at Division, Province, and Tikina level. But the 2017 General Tables (Release 3) print province-of-enumeration tables for age and sex, economic activity, education, province of birth, and housing only; they contain no religion table. | dashboard only | Defer. No official static province religion table with reconcilable counts was pinned. |
| 1996 | [Pacific Data Hub catalogue 237](https://microdata.pacificdata.org/index.php/catalog/237) | Catalogue metadata confirms a 1996 religion variable. No official aggregate province religion table was pinned; a SPC-hosted "population by religion and province of enumeration" key-statistics PDF exists but returned HTTP 403 on retrieval. | unverified | Future research route only. |

The 2007 table is the source of record for the shipped counts. Its all-ethnicity RELIGION section prints the province margin used here; the ethnicity-specific tables in the same PDF are not read.

## 2007 category frame

The source spellings are preserved verbatim, including the layout's truncations. The six top-level categories partition the enumerated population apart from a small unprinted not-stated residual. Every named religion contributes to religious affiliation; `No religion` supplies the no-religion numerator.

| Source spelling (verbatim) | National count | Product role |
| --- | --- | --- |
| `Christian` | 543,588 | religious affiliation |
| `Hindu` | 232,103 | religious affiliation |
| `Sikh` | 2,548 | religious affiliation |
| `Moslem` | 52,594 | religious affiliation |
| `Other religion` | 1,294 | religious affiliation |
| `No religion` | 4,249 | no religion |

The `Christian` total resolves into 18 printed sub-denominations (`Anglican`, `Apostolic`, `Assembly of God`, `All Nation Christian`, `Baptist`, `Catholic`, `Christ Mission Fellowship`, `Church of Christ`, `Gospel`, `Jehovah's Witness`, `Latter Day Saints`, `Methodist`, `Pentecostal`, `Presbyterian`, `Salvation Army`, `Seventh Day Adventist`, `United Pentecostal`, and `Other Christian`). These are used only as an internal reconciliation gate; the product ships the six top-level categories, not the sub-denomination split.

## Denominator and the not-stated residual

The denominator is each province's printed `Total`, the population enumerated by province of enumeration (the RELATIONSHIP, ETHNICITY, and RELIGION sections of the table all print the same province totals). The source prints no not-stated religion row: the six categories sum to slightly less than the province `Total`. The residual (province `Total` minus the six categories) is carried in the denominator and outside both headline numerators, exactly as Tonga's `REF` is retained. The residual is small and non-negative in every province: 895 nationally (0.11%), largest in Rewa (316) and zero in Rotuma. Because the residual stays in the denominator, religious affiliation percent and no religion percent do not sum to 100%. Nationally the basis is 837,271 people: 832,127 with a religious affiliation (99.39%), 4,249 with no religion (0.51%), and 895 not stated (0.11%).

## Reconciliation gates

- Christian sub-denomination gate: the 18 printed Christian sub-denominations sum exactly to the printed Christian total in all 16 columns (national plus 15 provinces). No value was allocated, inferred, rounded, or tuned.
- Local-to-national gate: the 15 provinces sum exactly to the printed national column for `Total` and for each of the six religion categories.
- Not-stated residual is computed per column as `Total` minus the six categories and is non-negative everywhere.
- The build stops and records failing rows precisely on any arithmetic mismatch (stop-don't-tune).
- No `religious_change` value is released because only 2007 ships.

## Boundary source and licence

The census is by province; the boundary must therefore be the 15-province frame. geoBoundaries FJI ADM1 is the wrong level: its release metadata records `"admUnitCount": "4"` and `"boundaryCanonical": "Divisions"` (the four administrative divisions), which does not match the census provinces. geoBoundaries FJI ADM2 is the province frame: `"admUnitCount": "15"`, `"boundaryCanonical": "Provinces"`, `"boundaryYearRepresented": "2020"`, `"boundarySource": "pacificdata.org"`, `"boundaryLicense": "Creative Commons Attribution 4.0 (CC BY 4.0)"`, boundary ID `FJI-ADM2-14151628`. The `licenseSource` points to the pacificdata.org 2007 Fiji PHC administrative boundaries, aligning the boundary vintage with the 2007 census provinces. The build uses that release metadata as the licence authority. geoBoundaries FJI ADM3 (86 Tikina, ODbL 1.0) is recorded as the finer geography for a future tikina route.

All 15 census provinces join one-to-one to the ADM2 features. One spelling concordance connects the source `Nadroga/Navosa` to the boundary `Nadroga-Navosa`; the other 14 names match exactly. Provinces are mapped positionally to the printed column order; the truncated PDF headers therefore do not drive the join.

Fiji straddles the antimeridian: Lau, Cakaudrove, and Macuata reach past 180°. The source geometry uses the standard -180..180 dateline split and required `st_make_valid`. Planar simplification corrupts that split; the layer is therefore shifted to a contiguous 0..360 frame for the mandatory `scripts/lib/simplify_boundary.R` pass, cut at lon 180 against the two hemisphere rectangles, and the eastern pieces are shifted back by 360°. Every straddling province becomes a dateline-noded MultiPolygon entirely within [-180, 180] with no ring crossing the meridian. A WGS84-frame gate then asserts validity in EPSG:4326, every coordinate within [-180, 180], no ring with a consecutive-vertex longitude jump of 180° or more (the dateline-smear test), and a dateline-aware per-feature longitudinal extent below 180°: after the cut, the maximum ring jump is 0.11° and the widest province (Lau) spans 2.03° of longitude. A correctly cut straddling province carries pieces at both +180 and -180, and its raw bounding box spans 360° by construction; the dateline-aware extent (the shorter of the raw span and the 0..360-frame span) measures the true angular width. Area, overlap, gap, and sliver gates run in the Fiji Map Grid (EPSG:3460), which handles the crossing, and re-run in the contiguous 0..360 frame with the seams dissolved. The source and simplified layers each carry 15 valid, non-empty features with 15 distinct geometry hashes in both frames; pairwise overlap is effectively zero (0.0005 m² in the output frame, 0.0001 m² in the contiguous frame), no uncovered inter-province gap exists, and every province exceeds 1 km². The cut simplified GeoJSON is 778,705 bytes at 100% weighted keep-shapes, below the 3 MB ceiling.

## Publication terms (quoted from cached bytes)

The FBoS home page footer states, verbatim from the cached bytes: "Fiji Bureau Of Statistics Office | All Rights Reserved". The 2007 table prints only "Source: 2007 Census of Fiji, Bureau of Statistics". No terms-of-use, reuse, or open-data licence page was located on the FBoS site. The honest position is therefore a derived-aggregate research use under bare FBoS copyright with attribution, with no open licence claimed; the licence caution should be resolved with FBoS before any product ships. The geoBoundaries ADM2 layer, by contrast, records `Creative Commons Attribution 4.0 (CC BY 4.0)` in its own release metadata.

## Retrieval record

Every cached input is under `data/raw/fj_census/`, which `git check-ignore` confirms is excluded by `.gitignore:120` through the `data/` rule. Each cached file carries a `.meta.json` sidecar with its sha256, byte size, source URL, retrieval date, and an honest hosting note. Retrieval occurred on 2026-07-11. The manifest records the same URLs and hashes.

| Cached input | Source URL | Hosting | SHA-256 |
| --- | --- | --- | --- |
| `fj_2007_religion_ethnicity_province.pdf` | <https://www.statsfiji.gov.fj/download/117/01_province-of-enumeration/686/03_relationship-ethnicity-and-religion-by_province-of-enumeration_fiji-2007.pdf> | official (Fiji Bureau of Statistics) | `ad1291930ad0803f4790fc13e669872f5752721848bb9f1de6f87e06ee70023e` |
| `geoBoundaries-FJI-ADM2.geojson` | <https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/FJI/ADM2/geoBoundaries-FJI-ADM2.geojson> | geoBoundaries gbOpen (pinned 9469f09) | `a9cd94789cb5eb66cfbcbaf32a21bcbceba16b9a76adacba9ac675b950ca1ccd` |
| `gb_fji_adm2_meta.json` | <https://www.geoboundaries.org/api/current/gbOpen/FJI/ADM2/> | geoBoundaries API | `35e5eff798967d740490f28420d48a11ce7f764acc8470c4354b11a4e6272564` |
| `gb_fji_adm1_meta.json` | <https://www.geoboundaries.org/api/current/gbOpen/FJI/ADM1/> | geoBoundaries API | `9a285e2e5d0b3d7bf342bc5f510e02a3df46adac7e64fb5e125c5273af491f32` |
| `gb_fji_adm3_meta.json` | <https://www.geoboundaries.org/api/current/gbOpen/FJI/ADM3/> | geoBoundaries API | `13adac57bc199fa0d1b0660d28d1d492f64dc81ddb9b1e72d6a82db1b8aa13dc` |
| `fj_2017_census_release3_general_tables.pdf` | <https://www.statsfiji.gov.fj/download/121/phc-2017/729/2017-population-and-housing-census-release-3.pdf> | official (Fiji Bureau of Statistics) | `cd06c2298f37a6d2b72bfc89d456f61f7aa4279f1329f603ffabccb7760e54f8` |
| `pdh_2007_catalog241.html` | <https://microdata.pacificdata.org/index.php/catalog/241> | Pacific Data Hub (SPC) | `ba550e097d50304fb8ebba3e790e6817d19b0a8c8f200ed80baaf23725cff06c` |
| `pdh_1996_catalog237.html` | <https://microdata.pacificdata.org/index.php/catalog/237> | Pacific Data Hub (SPC) | `f12bd3de3368cf54b020ea2a62e7593f363feadabfe4f9589fa91d42d12d96dc` |
| `statsfiji_census_page.html` | <https://www.statsfiji.gov.fj/census-surveys/census-of-population-and-housing/> | official (Fiji Bureau of Statistics) | `ab89676a43e776b9f427ebe5445ee723b6e458f1b429056a48194226c123ba89` |
| `statsfiji_home.html` | <https://www.statsfiji.gov.fj/> | official (Fiji Bureau of Statistics) | `d3cd7d61d3225ef22f0e9bf14a189ef0c97b0694742c55d7dff21725d785a272` |

## Why 1996 and 2017 are unavailable

The 2017 province religion table exists as a dashboard, not as a reconcilable official static table. The FBoS ArcGIS "Population by Major Religious Groups" experience maps 2017 religion by province, which confirms the census collected the variable, but the 2017 General Tables (Release 3) print no religion table; there is therefore no printed source to reconcile against under the stop-don't-tune rule. The recovery route is the FBoS ArcGIS religion layer (if its provenance and licence can be pinned) or a direct FBoS province tabulation request. The 1996 route is licensed microdata: Pacific Data Hub catalogue 237 confirms a religion variable, but no official aggregate province religion table was pinned in this sweep. The recovery route is an FBoS 1996 tabulation or a project-produced tabulation from the licensed 1996 microdata, which would be a produced table rather than an official published one. Both are recorded as deferred sources in the manifest.

## Product boundary

The staged data product contains only the 2007 province religion margin and the licensed simplified province geometry. It does not contain a religion-by-ethnicity cross-tab, a Christian sub-denomination split, tikina polygons, a country page, a place-of-worship snapshot, place-density metrics, or a cross-wave change layer. The 2017 dashboard and 1996 microdata are recorded as deferred routes to additional waves; each must reconcile to an official published table before it can extend the product.
