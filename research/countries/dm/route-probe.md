# Dominica census-religion route probe

Probed 2026-07-11. **HELD — the published record refutes the build-queue "parish" premise.** Dominica's Central Statistics Office (CSO, stats.gov.dm) publishes census religion for 1991, 2001, and 2011, but every published religion table is **national**: religion is cross-tabulated with age group and sex, and separately shown as a national time series, and is never broken down by parish. The CSO's own "Population by Sex and Parish" product carries no religion. No REDATAM/CELADE instance exists for Dominica to recover a subnational religion cross-tabulation the way the Saint Lucia sibling did. A subnational (ten-parish) religion product therefore has no source in the record. The national religion series is real and reconciles across three waves; it is a national-context row, not the parish product the queue anticipated.

Two independent blockers compound the hold. First, no parish religion table exists at any of the three waves. Second, the CORRECTED boundary position (build-time verification 2026-07-11, see the build appendix): the geoBoundaries DMA ADM1 and ADM0 releases both record `boundaryLicense: "Creative Commons Attribution 2.5 Generic"` in their API metadata — this probe's initial null-licence reading was wrong, and no OSM/ODbL fallback is needed. The remaining parish blocker is solely the absence of a parish religion table. The national three-wave series was subsequently built under the conductor's small-country-clause ruling; a genuine parish product still needs the CSO ask.

## What the queue expected vs what the record holds

The build-queue row (rank 45) lists geography "parish" and indicator "census affiliation" for 1991, 2001, 2011. The record supports "census affiliation" for those three waves but at **national** geography only. The parish frame is real in Dominica's census (ten parishes, and the CSO publishes population by parish), but religion is never tabulated against it in any public product found.

## Official publications and route decision

| Wave | Official CSO route | Published religion geography | Route decision |
| --- | --- | --- | --- |
| 1991 | [Population and Housing Census 1991](https://stats.gov.dm/wp-content/uploads/2019/06/Population_and_Housing_Census_1991.pdf), Table II "Population by Age Group, Sex and Religion, 1991 Census" | National, by age group and sex. Scanned/OCR PDF (77 pp); the national religion column totals are legible, the age×religion cells are low-quality OCR. | National only. No parish religion table. The clean transcribable national figures are the 1991 column of the CSO web time series (below). |
| 2001 | [Population and Housing Census 2001 — Preliminary Tables](https://stats.gov.dm/wp-content/uploads/2019/06/Population_and_Housing_Census_2001.pdf) | **No religion table at all.** The 2001 report is a preliminary-tables volume; its table list runs Total Population and Sex Ratio by Parish, Non-institutional Population by Parish, geographical area, households, dwellings — no religion. | National figures survive only through the CSO web time series and the 2011 report's Table 6.1 (which prints the 2001 column). No parish religion. |
| 2011 | [Population and Housing Census 2011](https://stats.gov.dm/wp-content/uploads/2020/04/2011-Population-and-Housing-Census.pdf) (full report, 3.4 MB), Table 6 "Population by Age Group, Sex and Religion" and Table 6.1 "Percentage Population by Religion 1991, 2001 and 2011" | National, by age group and sex (Table 6); national time series with sub-categories (Table 6.1). Text PDF, `pdftotext -layout` extracts both tables cleanly. | National only. Parish appears in this report solely in Tables 1.2/1.3 (population by parish, by sex/age) and Table 5.2 (foreign-born by parish) — never with religion. |

A shorter 991 KB file (`Population_and_Housing_Census_2011.pdf`, labelled "Preliminary" on the CSO page) is a 29-page subset of the same 2011 report and carries no religion table; the 3.4 MB file is the full report of record.

The dedicated CSO web page [Population by Religion 1991 2001 and 2011](https://stats.gov.dm/subjects/demographic-statistics/population-by-religion-1991-2001-and-2011/) reproduces the national time series as an HTML table (counts and percentages). It is national only and states: "Sources: 1991,2001 and 2011 Population and Housing Censuses" and "Note : 1991 Tabulated Data".

## The 2022 round (latest census)

Dominica's most recent enumeration was the **2022 Population and Housing Census** (Census Day 25 June 2022), launched in 2022 after the 2021 schedule slipped on the COVID-19 pandemic. No 2022 results are published on the CSO site: the census page carries no results links or query tool, and the demographic-statistics religion and parish products still terminate at 2011. Hurricane Maria (September 2017) is recorded neutrally in the record as a driver of the migration and population-loss questions the delayed census was meant to answer; it is not cited as a cause of any missing table in the 1991/2001/2011 series, which predate it. A future religion product from the 2022 round awaits CSO publication.

## National religion frame (verbatim)

The 2011 report's **Table 6.1** category frame, reproduced with source spelling and indentation (Evangelicals is a parent with indented sub-denominations):

- Anglican
- Evangelicals
  - Baptist
  - Brethren
  - Christian Union Church
  - Pentecostal
  - Gospel Mission
  - Other Evangelical
- Methodist
- Church of God
- Jehovah Witness
- Rastafarian
- Roman Catholic
- Seventh Day Adventist
- Other
- None
- Not Stated

The 2011 report's **Table 6** (religion by age/sex) uses a flattened column set that unfolds Evangelicals into its components: Anglican; Baptist; Brethren; Christian Union Church; Church of God; Gospel Mission; Jehovah Witness; Methodist; Other Evangelical; Pentecostal; Rastafarian; Roman Catholic; Seventh Day Adventist; Other; None; Not stated. Table 6 carries the note: "Anonymity: if one or two individual(s) is/are recorded, he or she was not listed but added to the total" (this is why some Table 6 cells print "…" and the Table 6 grand total 69,324 sits one below the Table 6.1 total 69,325).

The 1991 frame (Table II, and the 1991 column of Table 6.1) is coarser: Anglican; Baptist (Spiritual); Church of God; Jehovah; Methodist; Pentecostal / Other Religion; Roman Catholic; Seventh Day Adventist; Other; None; Not stated. The sub-denominations of Evangelicals (Brethren, Christian Union Church, Gospel Mission) show "…" for 1991 and 2001 in Table 6.1 — they were tabulated separately only from 2011. **The frames are therefore not comparable across waves**, so cross-wave change metrics would be withheld even if geography allowed a build.

## National anchors for reconciliation

Verbatim from the CSO "Population by Religion" web table and the 2011 report Table 6.1 (counts; percentages in source):

| Religion | 1991 | 2001 | 2011 |
| --- | ---: | ---: | ---: |
| Anglican | 501 | 430 | 373 |
| Evangelicals | 4,925 | 11,735 | 13,151 |
| Methodist | 2,895 | 2,615 | 1,788 |
| Church of God | 436 | 833 | 637 |
| Jehovah Witness | 623 | 818 | 918 |
| Rastafarian | … | 893 | 755 |
| Roman Catholic | 48,690 | 42,875 | 36,563 |
| Seventh Day Adventist | 3,209 | 4,213 | 4,659 |
| Other | 5,528 | 397 | 2,968 |
| None | 2,022 | 4,234 | 6,538 |
| Not Stated | 637 | 732 | 975 |
| **Total** | **69,466** | **69,775** | **69,325** |

The 2011 religion universe (69,325) equals the 2011 population-by-parish total (69,325), so religion and parish products share one universe — a clean join would exist if a parish religion table were ever released. This religion universe is below the 2011 report's total enumerated population (71,293) and non-institutional population (70,739); a future surface must state which universe any figure uses.

## Parish frame and boundary (for a hypothetical future parish product)

The census parish frame is **ten parishes**: St George, St John, St Peter, St Joseph, St Paul, St Luke, St Mark, St Patrick, St David, St Andrew. (Population tables split St George into "City of Roseau" and "Rest of St. George", but the parish itself is one of the ten.) These map one-to-one onto the geoBoundaries ADM1 layer.

- **geoBoundaries DMA ADM1** ([release metadata](https://www.geoboundaries.org/api/current/gbOpen/DMA/ADM1/), cached): boundary ID `DMA-ADM1-96108325`; canonical `Parish`; represented year `2005`; ten units; source `commons.wikimedia.org/wiki/File`. The geometry ([GeoJSON](https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/DMA/ADM1/geoBoundaries-DMA-ADM1.geojson), cached) has ten features whose `shapeName` values are Saint Andrew, Saint David, Saint George, Saint John, Saint Joseph, Saint Luke, Saint Mark, Saint Patrick, Saint Paul, Saint Peter — an exact match to the census parish frame after "Saint"→"St." normalisation.
- **Licence (CORRECTED at build time, 2026-07-11):** this probe initially read the DMA ADM1 release as `licenseName: null`; re-verification against the cached API metadata records `boundaryLicense: "Creative Commons Attribution 2.5 Generic"` for both ADM1 and ADM0 (`licenseDetail: "nan"` and a bare Wikimedia Commons `licenseSource` remain soft flags). The layers are usable with attribution; no OSM/ODbL fallback is needed.

Join feasibility is therefore high on names and count but currently unusable on licence — and moot until a parish religion table exists.

## Publication terms (verbatim)

The CSO publishes an [Open Licence Agreement](https://stats.gov.dm/open-licence-agreement/) (cached). This is the same CARICOM/CSO open-licence template as Saint Lucia. Byte-matched quotes:

- Grant: "CSO grants you (an individual or a legal entity that you are authorized to represent) a worldwide, royalty-free non-exclusive licence to freely use the data, copy, modify, translate, publish, adapt, distribute, create derivative works and value- added products for commercial and non-commercial purposes subject to the terms of this licence."
- Attribution notice: "Source: Central Statistics Office of Dominica. Contains information licenced under the Central Statistical Office’s Open Licence Agreement."
- Value-added-product notice: "This product was adapted from the Central Statistics Office's information, which is licenced under the Central Statistical Office’s Open Licence Agreement."
- Scope limit: "…shall not extend to any third party data, software, and source code. All third party data downloaded from the CSO website shall be subject to a separate licensing terms identified by the third party."
- Non-endorsement: "This licence does not grant you the right to use the data in a way that suggests an official status or endorsement of you or your use of the data."
- Disclaimer: "Data are made available “as is” without warranty of any kind, including the implied warranties or merchantability and fitness for a particular purpose. The CSO will not be held responsible for damages resulting from its use or interpretation including any consequential damages, punitive damages…"

**Licence position: PASS for the CSO census data itself.** The national religion tables are buildable under the CSO Open Licence Agreement, subject to the value-added-product notice above (the Saint Lucia precedent). The blocker is not the data licence; it is the absence of a parish religion table and the unlicensed boundary.

## Blockers

1. **No parish religion table at any wave.** The record publishes census religion only at national geography (by age/sex). This is the primary, decisive blocker against the queue's "parish" premise.
2. **No REDATAM/CELADE recovery route.** Dominica is not among the CELADE online-census countries, and the CSO site offers no query tool, so there is no way to recover a subnational religion cross-tab (contrast Saint Lucia, where REDATAM supplied the district frame).
3. **Boundary licence (corrected):** geoBoundaries DMA ADM1/ADM0 record CC BY 2.5 Generic in their release metadata; the initial null-licence reading in this probe was wrong. The parish blocker is the missing religion table, not the boundary.
4. **Cross-wave frame breaks.** The 1991/2001/2011 religion frames differ (Evangelical sub-denominations tabulated only from 2011), so a change series would be withheld regardless.
5. **2022 round unpublished.** No 2022 census results are public; the newest religion figures remain 2011.

## Build / hold recommendation

**HOLD.** Two clean outcomes are available to the PI:

- **National-context row (buildable now, licence-clean):** a three-wave national religion series (1991/2001/2011) under the CSO Open Licence Agreement, frames documented and cross-wave change withheld — analogous to the national-only tails already in the queue. This does not meet the subnational (district-then-tick) bar and would ship, if at all, only as national context.
- **Genuine parish product (needs a CSO ask):** email the CSO for (a) a parish-level religion cross-tabulation for 1991/2001/2011 (or the 2022 round when released), and (b) confirmation the Open Licence covers it — plus, ideally, an official parish boundary layer to sidestep the unlicensed geoBoundaries release. Absent that table, no parish product is possible from the public record.

The decision mirrors the Guinea and Saint Vincent holds: the published record refutes the subnational premise, and the unblock is a statistics-office ask, not an extraction. Recommend HOLD pending the PI ruling on the national-context question and authorisation of a CSO ask.

## Retrieval record

All inputs retrieved 2026-07-11 and cached under `data/raw/dm_census/` (gitignored; `.gitignore` line 120 ignores `data/`).

| Cached input | Source or role | SHA-256 |
| --- | --- | --- |
| `dm_2011_census_alt.pdf` | 2011 full report (3.4 MB), Tables 6 and 6.1 | `2d95320cbd510ae6b737d2881d3a87b66bfe36c29e6a25b92d70e90521273d66` |
| `dm_2011_census_report.pdf` | 2011 report subset (991 KB, "Preliminary" label), no religion table | `4e036bc837f474bd97462c7f3899710a7efab2df09a5f0b424d13b45b67ed60a` |
| `dm_2001_census_report.pdf` | 2001 Preliminary Tables (no religion table) | `a3274db870bdcef47a32f06c566b78e2980651c6a9e8ee4d12d0b5a4735403f3` |
| `dm_1991_census_report.pdf` | 1991 report, Table II religion by age/sex (national, scanned) | `260603732ebb8c38daee8c2eaaa28693068d3c0d7dd72da935c89559ff8151bf` |
| `dm_religion_page.html` | CSO "Population by Religion 1991 2001 and 2011" national table | `04f35e0a43f2da0d807e92a295bdba430a4813d1f3f3b0f408504d6d9510c04b` |
| `dm_parish_page.html` | CSO "Population by Sex and Parish 2001 and 2011" (no religion) | `83cd37db9e7f9a3b7393a6c59eb6fdb2c49c99a7e3838e6b9596a120ff95fbcd` |
| `dm_demographic_statistics.html` | CSO demographic-statistics index (product inventory) | `d242de27c7c02b98c417c2429cffe37ec6a5db88d784b2c416fe36e611538b2e` |
| `dm_census_page.html` | CSO census page (no results/query tool) | `a84ac28ee94ecc0ab7448c2586893d93873cd28237ba2e47b523f64e2d99cbe3` |
| `dm_open_licence.html` | CSO Open Licence Agreement | `0f1ae8afd30f1b0ba17a51d72357e199806be6e10d96470108a3a2ef70f5c7c4` |
| `gb_dma_adm1_meta.json` | geoBoundaries DMA ADM1 release metadata (CC BY 2.5 Generic; an earlier null-licence reading was corrected at build time) | `24494333efe962c1b697b44f4a3df4eaeb156cece30185f7acafa2860ecc2530` |
| `gb_dma_adm1.geojson` | geoBoundaries DMA ADM1 geometry, 10 parishes | `0aa346d89500214422d46c5344b62005ca15ae9edbbf00f2fd304e307726cecd` |

## Hard-gate result

- **Official route**: partial. The CSO record supports national census religion for 1991, 2001, and 2011; it does not support parish religion at any wave.
- **Subnational premise**: FAILED. No religion-by-parish table exists in any public CSO product; the 2001 preliminary report carries no religion table at all.
- **REDATAM/CELADE recovery**: none. Dominica is not on the CELADE online-census list and the CSO site offers no query tool.
- **PDF text layer**: 2011 and 2001 reports pass (`pdftotext -layout`, no OCR); the 1991 report is a scanned image with low-quality OCR on the age×religion cells, though national column totals are legible and corroborated by the 2011 Table 6.1.
- **National reconciliation**: passes. Religion totals (69,466 / 69,775 / 69,325) are internally consistent, and the 2011 religion universe equals the 2011 parish-population universe.
- **Cross-wave comparability**: withheld. The 1991/2001/2011 category frames differ (Evangelical sub-denominations only from 2011).
- **Data licence**: passes. CSO Open Licence Agreement covers the census tables, subject to the value-added-product notice.
- **Boundary release licence**: FAILED to verify. geoBoundaries DMA ADM1 metadata records no licence name; OSM/ODbL fallback would be required.
- **Boundary geometry/join**: passes on structure — ten valid parish features matching the census frame one-to-one — but is moot without a parish religion table and blocked on licence.
- **2022 round**: no public results; newest religion figures remain 2011.
- **Build**: none performed. This is a probe-only lane; no builder, app, manifest, or country page was created or touched.

## Build appendix (2026-07-11, small-country clause)

**Conductor ruling (2026-07-11, Iceland precedent) overrides the HOLD above for the national-only tier.** The probe's HOLD stands for the parish premise; the buildable national-context row (three-wave religion series, frames documented, cross-wave sub-denomination change withheld) was authorised and built under the small-country clause. The parish product remains a deferred CSO ask (PI task 13), recorded in the manifest `deferred_sources`.

### Product

`dm-census-religion-1991-2011` — one national ADM0 polygon, three waves (1991, 2001, 2011). Deliverables:

- `scripts/build_dm_area_summary.R`
- `apps/regions/dm/data/area_summary_adm0.json` (sha256 `3ed77630f47d8cd251428d605449fdd457681e107619ed4c379268d952565181`), `.csv`, and `dm_adm0_2005.geojson` (sha256 `9df15e850ce5b81e11f2b681b214607bcc1c9e4a0a6b2aff955931d616adb8f0`)
- `docs/manifests/dm-census-religion-1991-2011.json` (sha256 `45f9623885b99d61f5f8baf16ab7b0ac8ac71c9ee614b72c504660db2b9ac828`)

Source of record: 2011 report Table 6.1 (three-wave national series), byte-matched to the CSO "Population by Religion" web table; 1991 report Table II total row (OCR) as 1991-column corroboration. Data pinned into the builder and re-asserted against the cached text/HTML at build time.

### Headline series (religion-universe denominator)

| Wave | Universe | Affiliation | Affiliation % | None | None % | Not Stated |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1991 | 69,466 | 66,807 | 96.16 | 2,022 | 2.91 | 637 |
| 2001 | 69,775 | 64,809 | 92.88 | 4,234 | 6.07 | 732 |
| 2011 | 69,325 | 61,812 | 89.16 | 6,538 | 9.43 | 975 |

`religious_affiliation = universe − None − Not Stated`; `no_religion = None`; Not Stated is the disclosed residual (affiliation + None + Not Stated = universe). population_total is each wave's Table 6.1 religion universe.

### Gate results

- **Category-sum gate**: PASS. Each wave's Table 6.1 top-level categories sum to its printed national total exactly: 69,466 / 69,775 / 69,325.
- **Evangelicals children-to-parent gate**: PASS. Sub-denominations sum to the Evangelicals parent per wave (1991: 1,912+3,013=4,925; 2001: 2,845+3,927+4,963=11,735; 2011: 3,581+168+2,724+4,215+1,454+1,009=13,151).
- **1991 OCR reconciliation**: PASS. The 1991 Table II total row (OCR) reconciles against Table 6.1's 1991 column. Grand total matches (69,466) and eight legible cells match cell-for-cell (Anglican 501, Jehovah 623, Methodist 2,895, Pentecostal 3,013, Roman Catholic 48,690, Seventh Day Adventist 3,209, None 2,022, Not Stated 637). Two OCR artefacts, not carried into the shipped figures: Baptist reads 1,911 vs Table 6.1's 1,912 (single-digit OCR error); Other reads "552>" for 5,528. Church of God (436) fell into a whitespace gap in the OCR total row; it is present as a Table II column and corroborated by Table 6.1. Shipped figures are Table 6.1's throughout.
- **Headline-comparability decision**: comparable across waves. None and Not Stated are consistently named and separately tabulated in every wave's Table 6.1 column, so headline affiliation and no-religion carry the same construct across 1991/2001/2011. Comparability is withheld only below the headline (Evangelical sub-denominations tabulated separately only from 2011; Rastafarian folded into Other in 1991).
- **Universe discipline**: the 2011 religion universe (69,325) differs from the total enumerated population (71,293) and non-institutional population (70,739); the 1991 tabulations rest on the 1991 non-institutional population (69,466). The Table 6 grand total (69,324, one below Table 6.1's 69,325) from the printed anonymity rule is disclosed, not smoothed.
- **Boundary licence finding**: geoBoundaries DMA ADM0 release metadata records `boundaryLicense: "Creative Commons Attribution 2.5 Generic"` (with `licenseDetail: "nan"` and a bare Wikimedia Commons `licenseSource`) — an ACCEPTED open attribution licence, contradicting this probe's earlier "null licence" reading. The cached ADM1 metadata likewise records CC BY 2.5 Generic. No OSM/ODbL or Natural Earth fallback was required; the build uses geoBoundaries ADM0 with attribution. Boundary ID `DMA-ADM0-26965486`, one valid non-empty polygon, simplified to 20818 bytes at 100% keep under the 250 KB cap; join property `area_code`.
- **Licence gate**: PASS. Census data under the CSO Open Licence Agreement with its byte-matched attribution and value-added notices; boundary under CC BY 2.5 Generic. `licence_status: accepted`; `licence_basis: cso_open_licence_agreement_value_added_acknowledgement_required` (Saint Lucia sibling slug).
- **Raw cache mirror**: `data/raw/dm_census/` mirrored to `gs://pow-research-data/raw_sources/dm_census/` (17 objects, 8.8 MiB), recorded in the manifest `raw_cache_durable_uris`.

### Named schema validation (verbatim command and output)

Area-summary product against `schemas/area-summary.schema.json`:

```
$ uvx check-jsonschema --base-uri "file://$PWD/schemas/" --schemafile schemas/area-summary.schema.json apps/regions/dm/data/area_summary_adm0.json
ok -- validation done
```

Manifest against the manifest schema, via the corpus validator:

```
$ bash scripts/validate_manifests.sh
manifest validation: 62/62 pass
```

```
$ uvx check-jsonschema --base-uri "file://$PWD/schemas/" --schemafile schemas/data-manifest.schema.json docs/manifests/dm-census-religion-1991-2011.json
ok -- validation done
```

### Open questions for the conductor

1. **Probe "null licence" claim was wrong.** Both DMA ADM0 and ADM1 geoBoundaries releases record CC BY 2.5 Generic in their API metadata; the probe's null-licence reading (and its OSM/ODbL fallback recommendation) does not hold. The ADM1 boundary is therefore also licensed if a future parish product is authorised, though the parish religion table itself remains the blocker.
2. **Boundary vintage vs census waves.** The geoBoundaries ADM0 `boundaryYearRepresented` is 2005; the national outline is stable, so it carries all three waves. Recorded as vintage 2005 in `boundary_set`.
3. **Parish product** stays a deferred CSO ask (PI task 13); no public parish religion table exists at any wave.
4. **UI not built.** No `apps/regions/dm/index.html`, hub entry, or CHANGELOG touched (out of scope). The data product is review-ready; wiring the country page is a follow-up.
