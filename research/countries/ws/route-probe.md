# Samoa census-affiliation route probe

Verified 2026-07-11. The 2021 census exposes a complete, machine-readable subnational religion table: workbook sheet `Table 2` gives population by 26 religion categories at four nested levels — national, four statistical regions, 51 constituency-districts, and 339 villages — and every level reconciles exactly. The probe therefore overturns the queue note that the district and village route was only "pending": for 2021 the route exists and is clean. No wave ships, because no licensed boundary layer matches the 2021 census geography for a one-to-one join, and the earlier waves (2006, 2011, 2016) publish religion only at national or urban-rural level. Samoa Bureau of Statistics (SBS) asserts a bare copyright with no explicit reproduction grant; the licence position is therefore a caution rather than an open licence.

## Probe decision

- **Outcome**: probe only; honest hold on any polygon product. The 2021 table is buildable the moment a licensed boundary matching the census geography (2021 electoral constituencies, an official village layer, or a published constituency-to-district concordance) is secured.
- **Construct**: census affiliation. The table counts the whole resident population by stated church or religion; it does not measure practice, attendance, or registered membership.
- **Machine-readable subnational wave**: 2021 only.
- **Blocker one (boundaries)**: the census 2021 partition (4 regions / 51 constituency-districts / 339 villages) does not correspond one-to-one to geoBoundaries WSM ADM1 (11 traditional districts) or ADM2 (43 districts). No licensed layer at the 4-region, 51-constituency, or 339-village level was pinned.
- **Blocker two (licence)**: the 2021 Basic Tables report prints only "Copyright ©  Samoa Bureau of Statistics (SBS), Apia, Samoa, 2022." No SBS terms-of-use or open-data licence page was located. This is more restrictive than the Tonga precedent, which granted partial research reproduction with acknowledgement.

## Published waves and geography

| Year | Official route | Religion tables found | Finest religion geography | Decision |
| --- | --- | --- | --- | --- |
| 2021 | [2021 Census tables workbook](https://www.sbs.gov.ws/wp-content/uploads/2022/12/CensusTablesEXCELFiles.xlsx), sheet `Table 2`; [2021 Basic Tables report](https://sbs.gov.ws/documents/census/2021/Census-2021-Final-Report_221122_051222.pdf) | Workbook `Table 2`, *Total population by sex, religion and place of residence, 2021*: 26 religion categories by Total/Male/Female at national, region, constituency-district, and village level. Report `Table 3` prints only the top-six religions by place of residence. | village | Route confirmed and reconciles; held only for a licensed matching boundary. |
| 2016 | [2016 Census Brief No.1 tables](https://www.sbs.gov.ws/digi/2-2016%20Census%20Brief%20No.1%20Tables.xlsx), sheet `Table 5 Pop_church` | `Table 5`, *Population by type of church affiliation, 2016*: national only, by sex; includes a `Not Stated` category. | national | No subnational religion cross-tab in the public briefs. |
| 2011 | [2011 Census tables workbook](https://www.sbs.gov.ws/digi/Census%202011_Excel_tables.xlsx), sheet `Table 20`; [PDH 2011 catalogue](https://microdata.pacificdata.org/index.php/catalog/250) | `Table 20`, *Population 5 years and over by sex, Religion by urban-rural residence, 2011*: national and urban-rural only. Of the workbook's 93 numbered tables (95 sheets in all, including Table32b and an empty Sheet2), only `Table 20` crosses religion with geography. | urban-rural | No district or village religion table; PDH microdata is the only finer route. |
| 2006 | [2006 Table 5 religion PDF](https://www.sbs.gov.ws/digi/05%20Table%205%20Population%20age%205%20years%20and%20over_religion_major_age.pdf) | `Table 5`, *Population age 5 years and over by religion, major age groups and sex, 2006*: national only, by age. The subnational `Table 2` for 2006 cross-tabs region, Faipule district and village by age and sex, not by religion. | national | No subnational religion table; religion and geography are on separate 2006 tables. |

The 2021 workbook is the source of record for the subnational counts. The report supplies the copyright statement, the governing Statistics Act 2015 reference, and a top-six-religion district summary, but not the full 26-category village table.

## 2021 category frame

The source spelling column preserves the workbook `Table 2` header verbatim, including its irregular spacing and spellings (`LATTER  DAY SAINTS`, `PABTISM`, `ASO FITU  (SISDAC)`). The 26 categories partition the whole population; there is no refused or not-stated category in the 2021 table. `NO RELIGION` supplies the no-religion numerator; every other category is a religious-affiliation contribution.

| Source spelling (verbatim) | Product role |
| --- | --- |
| `CONGREGATIONAL CHRISTIAN CHURCH OF SAMOA` | religious affiliation |
| `METHODIST` | religious affiliation |
| `ROMAN CATHOLIC` | religious affiliation |
| `LATTER  DAY SAINTS` | religious affiliation |
| `ASSEMBLY OF GOD` | religious affiliation |
| `SEVENTH DAYS ADVENTIST` | religious affiliation |
| `ASO FITU  (SISDAC)` | religious affiliation |
| `JEHOVAHS WITNESS` | religious affiliation |
| `CONGREGATIONAL CHRISTIAN CHURCH OF JESUS IN SAMOA  (EFIS)` | religious affiliation |
| `AMAZING LOVE CHRISTIAN CHURCH` | religious affiliation |
| `BAHAI` | religious affiliation |
| `VOICE OF CHRIST` | religious affiliation |
| `WORSHIP CENTRE` | religious affiliation |
| `NAZARENE` | religious affiliation |
| `BIBLE STUDY` | religious affiliation |
| `FIRST FULL GOSPEL PENTECOSTAL CHURCH IN SAMOA` | religious affiliation |
| `PABTISM` | religious affiliation |
| `PEACE CHAPEL` | religious affiliation |
| `SAMOA EVANGELISM` | religious affiliation |
| `POROTESANO` | religious affiliation |
| `ANGLICAN CHURCH` | religious affiliation |
| `ELIM CHURCH` | religious affiliation |
| `CHRISTIAN FELLOWSHIP` | religious affiliation |
| `MUSLIM` | religious affiliation |
| `OTHER CHURCHES` | religious affiliation |
| `NO RELIGION` | no religion |

## Denominator and reconciliation

The denominator is each area's `TOTAL` column, the full resident population counted in the 2021 census. The national basis is 205,557 people, of whom 132 record `NO RELIGION`, leaving 205,425 with a religious affiliation. Because the 26 categories exhaust the population, the two headline shares sum to 100%.

Two reconciliation tests pass exactly on the cached workbook, with no value allocated, inferred, rounded, or tuned:

- Row-internal: for all 395 area rows, the 26 category `Total` columns sum exactly to that row's `TOTAL` column.
- Hierarchical: each of the 56 parent rows (1 national, 4 regions, 51 constituency-districts) equals the sum of its direct children across `TOTAL` and all 26 category totals. Villages (339) roll up to constituency-districts, constituency-districts to regions, regions to the national row, with zero mismatches.

The four statistical regions are Apia Urban Area, North West Upolu, Rest of Upolu, and Savaii. The 51 constituency-districts are the 2021 Faipule/electoral districts (for example `Vaimauga 1`–`4`, `Faleata 1`–`4`, `Sagaga 1`–`4`, `Aana Alofi 1`–`4`, `Faasaleleaga 1`–`5`).

## Boundary candidates and the failing join

Two licensed geoBoundaries layers exist for Samoa, but neither matches the census religion geography for a clean one-to-one join. The mismatch is a geography-and-vintage disagreement, not a data-quality fault in the table; it is recorded here precisely so a future boundary lane can resolve it.

| Layer | Units | Canonical | Year | Licence (from release metadata) | Join to 2021 census |
| --- | --- | --- | --- | --- | --- |
| [geoBoundaries WSM ADM1](https://www.geoboundaries.org/api/current/gbOpen/WSM/ADM1/) | 11 | Unknown | 2018 | `Creative Commons Attribution-ShareAlike 3.0 Unported` | No census roll-up to the 11 traditional districts; the census stops at 4 regions above the constituencies. |
| [geoBoundaries WSM ADM2](https://www.geoboundaries.org/api/current/gbOpen/WSM/ADM2/) | 43 | Districts | 2011 | `Creative Commons Attribution 4.0 (CC BY 4.0)` | 51 census constituencies do not map one-to-one to the 43 ADM2 districts. |

The ADM2 layer uses a 2011 district set with East/West and `(PART)` naming, while the census uses the 2021 numeric constituency split. The partitions disagree structurally; no relabelling therefore reconciles them:

- Census `Vaimauga 1`–`4` (four) versus ADM2 `Vaimauga East`, `Vaimauga West` (two).
- Census `Faleata 1`–`4` (four) versus ADM2 `Faleata East`, `Faleata West` (two).
- Census `Sagaga 1`–`4` (four) versus ADM2 `Sagaga le Falefa`, `Sagaga le Usoga` (two).
- Census `Aana Alofi 1`–`4` (four) versus ADM2 `Aana Alofi I`, `II`, `III` (three).
- Census `Faasaleleaga 1`–`5` (five) versus ADM2 `Faasaleleaga I`–`IV` (four).
- ADM2 carries `Gagaemauga I (PART)` and `Gagaemauga II (PART)` fragments with no census counterpart.

The numeric constituency splits are largely urban sub-divisions that do not nest into the ADM2 East/West geographic splits, and no official concordance from 2021 constituencies to the 2011 ADM2 districts was published. Aggregating the census to match ADM2 would require an inferred concordance, which the stop-don't-tune rule forbids. No licensed 4-region or 339-village polygon layer was located.

## Publication terms

The cached 2021 Basic Tables report states its rights on the copyright page, verbatim from the cached PDF bytes: "Copyright ©  Samoa Bureau of Statistics (SBS), Apia, Samoa, 2022." The report adds that the census "was conducted pursuant to Part II, Section 7 of the Statistics Act 2015". No SBS terms-of-use, reuse, or open-data licence page was found on the SBS site; the homepage footer bears only a bare copyright mark. The census tables are public downloads, but SBS grants no explicit reproduction permission; the honest position is therefore a derived-aggregate research use under bare SBS copyright with attribution, with no open licence claimed. This licence caution should be resolved with SBS directly before any product ships. The geoBoundaries ADM2 layer, by contrast, records `CC BY 4.0` in its own release metadata.

## Retrieval record

Every cached input is under `data/raw/ws_census/`, which `git check-ignore -v` confirms is excluded by `.gitignore:120` through the `data/` rule. Each file has a `.meta.json` sidecar recording its URL, retrieval date, byte size, and SHA-256. Retrieval occurred on 2026-07-11.

| Cached input | Source URL | SHA-256 |
| --- | --- | --- |
| `ws_2021_census_tables.xlsx` | <https://www.sbs.gov.ws/wp-content/uploads/2022/12/CensusTablesEXCELFiles.xlsx> | `910835e462db535ebd2f1bb2f1f4581136b6c90431f31cb34c0e5f2b55dec884` |
| `ws_2021_final_report.pdf` | <https://sbs.gov.ws/documents/census/2021/Census-2021-Final-Report_221122_051222.pdf> | `59fd92c6e36f379949915dc2f7d142bd4c54a037497044be6a7befab3de1ddbc` |
| `ws_sbs_census_page.html` | <https://www.sbs.gov.ws/census/> | `07128c486e0ea3823c78b80c3b3b6d3bb69f453224df009b6851d9ac8257bff0` |
| `ws_sbs_home.html` | <https://www.sbs.gov.ws/> | `9e08f2cc36178a46ab26cf0bb2b910fdcdb371b5c040eddeb8b4dfc9b0f38943` |
| `ws_2011_census_tables.xlsx` | <https://www.sbs.gov.ws/digi/Census 2011_Excel_tables.xlsx> | `7953911023a1daf5624fbd71114e9a0a9787b04f538326e0e14de94ec3114934` |
| `ws_2016_brief1_tables.xlsx` | <https://www.sbs.gov.ws/digi/2-2016 Census Brief No.1 Tables.xlsx> | `ce542480afe7f24b805ac4b9fb2e1d5545192fbe544b60ca40be9d51f7e0cecf` |
| `ws_2006_table5_religion_age.pdf` | <https://www.sbs.gov.ws/digi/05 Table 5 Population age 5 years and over_religion_major_age.pdf> | `2045be0f757281fe9d29686d4285500d898490268452ca5a23dea6ee4d93b0c9` |
| `pdh_2011_catalog250.html` | <https://microdata.pacificdata.org/index.php/catalog/250> | `ce5a236c9eb5668b142252289c0836f2a3282ee6747bd2993f68921960de564d` |
| `gb_wsm_adm1_meta.json` | <https://www.geoboundaries.org/api/current/gbOpen/WSM/ADM1/> | `961c2495c6285dd532d2bd0b320242768de987a804d8265aa842ee8294d691d0` |
| `gb_wsm_adm2_meta.json` | <https://www.geoboundaries.org/api/current/gbOpen/WSM/ADM2/> | `a8dc73ce8e077361175f7354917b8357a5793b2266eb71d6fd12517a8dea17b6` |
| `geoBoundaries-WSM-ADM2.geojson` | <https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/WSM/ADM2/geoBoundaries-WSM-ADM2.geojson> | `550e955e8a70df9555cf1947036fa62e75e1fd1e8fb9460d4c7f4753b6bf6447` |

## What would unblock a build

The 2021 table is the strongest Pacific subnational religion source pinned so far: full 26-category coverage to village level, exact reconciliation, and machine-readable. A build needs one of three boundary routes and one licence step. The first boundary route is a licensed polygon set of the 2021 electoral constituencies (51 units) with a name concordance to the census `Table 2` labels. The second boundary route is an official or SPC village polygon layer (339 units) with a clear licence. The third boundary route is a published concordance from the 2021 constituencies to the geoBoundaries ADM2 (2011) districts, which would let the counts aggregate to a licensed 43-unit frame without inference. The licence step is written confirmation from SBS of reuse terms for derived aggregate statistics, because the current copyright grants no explicit reproduction permission. Until at least one boundary route and the licence step are settled, the product stays on hold.

## Build appendix (2026-07-11): STAGED, no-geometry constituency product

The project lead ruled USE FOR NOW (PI task 3, 2026-07-11): proceed with the 2021 data under SBS attribution while the PI sends the SBS ask (reuse confirmation plus a licensed constituency/village boundary layer or a published concordance). The Pakistan no-geometry precedent (`scripts/build_pk_area_summary.R`) was mirrored: data tables plus a manifest that records the boundary as a documented blocker, with `land_area_sq_km` and every place field null. The build is STAGED and uncommitted, left for the conductor's review.

**Deliverables built.** `scripts/build_ws_area_summary.R`; `apps/regions/ws/data/area_summary_constituency.{json,csv}` (51 constituency-district rows, no GeoJSON); `docs/manifests/ws-census-religion-2021.json`. The raw cache `data/raw/ws_census/` (22 objects) was mirrored to `gs://pow-research-data/raw_sources/ws_census/` and the durable URI recorded through the builder.

**Primary level and the hierarchy that shipped.** The product ships the 51 constituency-districts as the primary level. The four statistical regions ride the manifest as recorded roll-up context; the 339-village detail stays in the git-ignored raw cache and is documented as the deeper route. The builder recovers the four nested levels from the flat `Table 2` row list with a running-sum walk (every total is strictly positive, minimum 4, and each parent equals the exact contiguous child block), then hard-checks the parse against the pinned 1 / 4 / 51 / 339 structure.

| Region | Constituencies | Villages | Region total |
| --- | --- | --- | --- |
| Apia Urban Area | 4 | 72 | 35,974 |
| North West Upolu | 12 | 53 | 75,307 |
| Rest of Upolu | 15 | 112 | 49,101 |
| Savaii | 20 | 102 | 45,175 |
| **National (Samoa)** | **51** | **339** | **205,557** |

**Headline-slot case that held: ORDINARY.** The 2021 frame carries a real non-affiliation category (`NO RELIGION`, 132 people nationally), so the ordinary two-slot semantics apply and the minority-share design (`docs/development/minority-share-metric.md`) does not. `religious_affiliation_percent` is the share reporting any of the 25 religious-affiliation categories (national 205,425 = 99.9358%); `no_religion_percent` is the `NO RELIGION` share (national 132 = 0.0642%); the two slots are exact complements in every row. `religious_change` is not emitted (single subnational wave; 2006/2011/2016 publish religion only at national or urban-rural level and are recorded as documented non-routes).

**Gates (fail-fast, stop-don't-tune) — all passed.** Source integrity (workbook and report match their pinned sha256); verbatim 26-category frame read from `Table 2`, 26th category confirmed `NO RELIGION`; hierarchy counts reproduce the pinned 1/4/51/339; row-internal reconciliation for all 395 area rows (26 categories sum to `TOTAL`); hierarchical reconciliation across all 27 columns (villages roll to constituencies, constituencies to regions, regions to national, zero mismatches); metric slots exact complements in every constituency row; construct note present in the shipped product and manifest.

**Licence.** SBS asserts a bare copyright with no reuse grant, quoted verbatim from the cached report bytes: `Copyright ©  Samoa Bureau of Statistics (SBS), Apia, Samoa, 2022.` The build ships derived aggregate rates with SBS attribution under the use-for-now ruling; `licence_status` is `needs_review` and `licence_basis` is `sbs_bare_copyright_derived_aggregates_attribution`, pending the SBS reply.

**Validation invocations and output.**

```
$ Rscript scripts/build_ws_area_summary.R
SAMOA 2021 constituency census-religion product (STAGED, NO GEOMETRY)
hierarchy: 1 national / 4 regions / 51 constituencies / 339 villages
... headline-slot case: ORDINARY ... gates: ... = passed

$ uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json apps/regions/ws/data/area_summary_constituency.json
ok -- validation done

$ uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/data-manifest.schema.json docs/manifests/ws-census-religion-2021.json
ok -- validation done

$ bash scripts/validate_manifests.sh
manifest validation: 69/69 pass
```
