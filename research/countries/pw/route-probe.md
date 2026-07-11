# Palau census-religion route probe

Verified 2026-07-11. Palau publishes religion by state for all three queued waves, and every wave joins the 16-state geoBoundaries layer one-to-one. The queue's metadata-first survey understated the record: the official Office of Planning and Statistics (OPS) reports on palaugov.pw carry printed religion-by-state tables that reconcile exactly, so the Pacific Data Hub microdata are not needed for the build. The route is a genuine three-wave state series, subject to two caveats the build must carry, a universe break and a category-frame break between 2005 and the 2015/2020 pair. No official report or Pacific Data Hub dataset states a reuse licence.

## Build decision (recommendation to the conductor)

- **Recommendation**: BUILD, pending a PI licence ruling (the source carries no stated terms; the summaries-not-raw-data precedent applies).
- **Candidate waves**: 2005, 2015, 2020 as levels, on 16 states.
- **Candidate geography**: 16 states on the geoBoundaries PLW ADM1 frame (16 units, one-to-one join).
- **Construct**: census affiliation. The 2005 monograph states the item was "collected as social indicators and not as part of a census of religions"; it counts each resident's reported religion, not practice, attendance, or membership.
- **Change metric**: withhold across 2005 to 2015/2020. The 2005 table is all-ages with a nine-way frame that separates Jehovah's Witnesses, Other Protestants, and a distinct None-or-refused; the 2015 and 2020 tables are adults 18 and over with a different nine-way frame (Muslim, Assembly of God, Baptist split out; no-religion folded into Other). Only the 2015 to 2020 pair shares a universe and a frame, so any change reading is limited to that pair.
- **Rights position**: no stated licence anywhere in the chain. Ship derived summaries with attribution under the RO/SK/CA summaries-not-raw-data stance, or hold for a PI ruling, as with Côte d'Ivoire and Iran.

## Published waves and geography

| Year | Official route | Religion-by-state table | Universe | Finest geography | Decision |
| --- | --- | --- | --- | --- | --- |
| 2005 | [2005 Census Volume II: Census Monograph](https://www.palaugov.pw/wp-content/uploads/2016/03/2005-Census-Monograph-Report.pdf) (OPS) | Table 10.1 "Religion by State, Palau: 2005" (text-extractable) | all persons, all ages | state (16) | Ship the 16-state 2005 wave as a levels layer. |
| 2015 | [2015 Census of Population, Housing and Agriculture, Volume I: Basic Tables](https://www.palaugov.pw/wp-content/uploads/2017/02/2015-Census-of-Population-Housing-Agriculture-.pdf) (OPS) | Table 42 "Ethnicity and Religion by Legal Residence, Palau: 2015" (image; renders cleanly at 150 dpi) | persons 18 and over | state (16) | Ship the 16-state 2015 wave. |
| 2020 | [2020 Census of Population and Housing, Volume I: Basic Tables](https://www.palaugov.pw/wp-content/uploads/2022/09/2020-Census-of-Population-and-Housing.pdf) (OPS, August 2022) | Table 42 "Ethnicity and Religion by Legal Residence, Palau: 2020" (image; renders cleanly at 150 dpi) | persons 18 and over | state (16) | Ship the 16-state 2020 wave. |

The palaugov.pw reports are the source of record, not the Pacific Data Hub. Each PDH catalogue record ([2020 catalog/866](https://microdata.pacificdata.org/index.php/catalog/866), [2015 catalog/458](https://microdata.pacificdata.org/index.php/catalog/458), [2005 catalog/27](https://microdata.pacificdata.org/index.php/catalog/27)) is microdata with a religion variable and does not expose a public state-by-religion aggregate; the printed report tables do. The 2005 monograph table extracts as text; the 2015 and 2020 Table 42 pages are rasterised in the PDF and require page rendering or manual transcription (small tables, 9 religion rows by 16 state columns, low transcription cost).

## Category frames

The 2015 and 2020 waves share one frame; 2005 uses another. Preserve each source spelling.

| 2005 (Table 10.1) | 2015 / 2020 (Table 42) | Product role |
| --- | --- | --- |
| Catholic | Catholic | religious affiliation |
| Evangelical | Evangelical | religious affiliation |
| Seventh Day Adventist | Seven Day Adventist | religious affiliation |
| Mormons | Mormons | religious affiliation |
| Modekngei | Modekngei | religious affiliation |
| Jehovah's Witnesses | (folded into Other) | religious affiliation |
| Other Protestants | (folded into Other) | religious affiliation |
| — | Assembly of God | religious affiliation |
| — | Baptist | religious affiliation |
| — | Muslim | religious affiliation |
| Other religion | Other | religious affiliation |
| None or refused | (no separate category; folded into Other) | 2005 no-religion / non-response; see note |

Two frame facts govern comparability. The first frame fact is the no-religion treatment: 2005 prints a distinct "None or refused" column (222 persons), whereas the 2020 definition states that "Persons who said they had no religion were classified into the Other category", so 2015 and 2020 carry no separable no-religion count. The second frame fact is denominational detail: 2005 separates Jehovah's Witnesses and Other Protestants and has no Muslim, Assembly of God, or Baptist column, while 2015/2020 split Muslim, Assembly of God, and Baptist and drop the Jehovah's Witnesses and Other Protestants columns. A shared product should publish only a broad religious-affiliation total per state across all three waves, and reserve any denomination series for the matched 2015-2020 pair.

Modekngei, the indigenous Palauan religion, is a first-class named category in every wave and should keep its own display label.

## Universe and denominator

The 2005 table counts all persons (national Total 19,907, the full 2005 resident population). The 2015 and 2020 Table 42 restrict to persons 18 years and over (national Total 13,302 in 2015, 13,576 in 2020). The by-state religion table for 2015 and 2020 exists only for the adult universe; the all-ages religion counts in those waves appear by age nationally (Table 56 "Ethnicity and Religion by Age") but were not published cross-tabulated by state. The honest state-level ceiling is therefore all-ages for 2005 and adults-18-plus for 2015 and 2020. The build must state this universe per wave and must not read the 2005-to-2020 level difference as change.

The 2015 and 2020 Table 42 columns carry the 16 Palau states plus separate legal-residence columns for persons whose legal residence is overseas (Philippines, China/Taiwan, USA/Guam/CNMI, Federated States of Micronesia, Other countries, Unknown). The mappable state universe is the 16 Palau columns only. In 2015 the report prints a "Palau Total" column (8,376 adults) that equals the 16-state sum; in 2020 no such subtotal is printed and the build must sum the 16 state columns (9,303 adults), never the overall Total (13,576), which includes the overseas legal-residence columns.

## Reconciliation gates (verified in the probe)

- **2005 Table 10.1**: the 16 state rows sum to the printed national Total of 19,907; the nine category columns (Modekngei 1,733; Catholic 9,825; Evangelical 4,610; Seventh Day Adventist 1,046; Mormons 143; Jehovah's Witnesses 222; Other Protestants 493; Other religion 1,613; None or refused 222) also sum to 19,907. Both margins close exactly.
- **2015 Table 42 (18+)**: the nine religion categories for the "Palau Total" column (Catholic 3,528; Evangelical 2,800; Seven Day Adventist 669; Assembly of God 77; Baptist 11; Muslim 7; Mormons 139; Modekngei 772; Other 373) sum to the printed Palau Total of 8,376.
- **2020 Table 42 (18+)**: the nine religion categories for the overall Total column (Catholic 6,363; Evangelical 3,335; Seven Day Adventist 676; Assembly of God 113; Baptist 71; Muslim 661; Mormons 122; Modekngei 689; Other 1,546) sum to the printed Total of 13,576; the 16 Palau state columns sum to 9,303.
- The build stops and records any failing row on arithmetic mismatch; no value is allocated, inferred, rounded, or tuned.

One documented source discrepancy: the 2005 monograph prose says "About 1 in every 6 people in the census responded that they had no religion, or refused to answer the question", which the table refutes (None or refused is 222 of 19,907, near 1.1 percent). The table values govern; the prose sentence is noted, not used.

## Boundary source and licence

The boundary is [geoBoundaries PLW ADM1](https://www.geoboundaries.org/api/current/gbOpen/PLW/ADM1/). The release metadata states `"admUnitCount": "16"`, `"boundaryType": "ADM1"`, `"boundaryYearRepresented": "2017"`, `"boundarySource": "OpenStreetMap, Wambacher"`, and `"boundaryLicense": "Open Data Commons Open Database License 1.0"`, with `"licenseSource": "www.openstreetmap.org/copyright"`. The build uses that release metadata as the licence authority. No official OPS state polygon layer was pinned; geoBoundaries/OSM under ODbL is the recommended boundary.

The layer carries all 16 states and joins the census one-to-one. Two spelling concordances preserve both labels: geoBoundaries `Ngeremlengui` maps to census `Ngaremlengui` (all waves), and geoBoundaries `Ngarchelong` maps to the 2005 monograph spelling `Ngerchelong` (the 2015/2020 tables abbreviate to `Ngarch elong`). The remaining 14 names match directly.

Small-island completeness holds (the Tonga camera trap). The layer includes the tiny southwest outlying states Sonsorol and Hatohobei, and the northern atoll Kayangel. Because Sonsorol and Hatohobei sit near 3 degrees North and 131-132 East while the main Babeldaob-Koror cluster sits near 7 degrees North and 134 East, the full-country bounding box spans latitude 2.75 to 8.09 North and longitude 131.07 to 134.72 East. A naive bbox drawn around the main cluster would drop both outlying states; the layer and the census tables both carry all 16, so the build must verify no state falls outside the frame. Palau lies wholly east of the antimeridian, so no dateline handling is needed.

## Licence position

No reuse licence is stated anywhere in the source chain. The three OPS reports carry no copyright page, no rights-reserved statement, and no Creative Commons mark; their front matter names only the funding acknowledgement to the United States Department of the Interior. The Pacific Data Hub dataset page for the 2020 census records `License not specified`. This differs from the Tongan and Tuvaluan precedents, which each printed an explicit partial-reproduction-with-acknowledgement clause. For Palau there is no verbatim byte-matched licence quote to pin, because no licence text exists to quote. The recommended position mirrors Côte d'Ivoire and Iran: publish derived state summaries with attribution to the Palau Office of Planning and Statistics under the project's summaries-not-raw-data stance, record the licence as unknown, and defer to a PI ruling. An OPS reuse-confirmation email is the clean unblock.

## Earlier waves

Religion entered the Palau census recently, and the exact first wave is disputed in the record. The 2020 report states the question "was asked for the first time in the 2000 census". The 2005 monograph states that "the 1995, 2000 and 2005 Censuses showed approximately the same distributions for religions", implying a 1995 religion question. The [2000 Census Population and Housing Profile (Monograph III)](https://www.palaugov.pw/executive-branch/ministries/finance/budgetandplanning/census-of-population-and-housing/) is available (SPC digital-library mirror) and is the credible route to a fourth, earlier state wave; the 1990 and 1995 censuses are recorded as unverified for religion given the conflicting first-asked claims. Extending the series to 2000 is a future-research route: it needs the 2000 monograph's religion-by-state table located, its universe and frame reconciled against 2005, and the same licence ruling.

## Retrieval record

Every cached input is under `data/raw/pw_census/`, which `git check-ignore -v` confirms is excluded by `.gitignore:120` through the `data/` rule. Retrieval occurred on 2026-07-11.

| Cached input | Source URL | Hosting | SHA-256 |
| --- | --- | --- | --- |
| `pw_2020_census_vol1.pdf` | <https://www.palaugov.pw/wp-content/uploads/2022/09/2020-Census-of-Population-and-Housing.pdf> | official (Palau OPS) | `b2bc44123bdb3ecbbd06601d824e69dbcea702b7c2504f8834dcda6754f521ff` |
| `pw_2015_census_vol1.pdf` | <https://www.palaugov.pw/wp-content/uploads/2017/02/2015-Census-of-Population-Housing-Agriculture-.pdf> | official (Palau OPS) | `acabbd3cb7eb556009633c114b36608a3a254875982ef95a7003d4cd98b2beea` |
| `pw_2005_census_monograph.pdf` | <https://www.palaugov.pw/wp-content/uploads/2016/03/2005-Census-Monograph-Report.pdf> | official (Palau OPS) | `75626bbba8ec58e524efff2549d35269f248ef960b5c1a13dd53d4aef99050fe` |
| `geoBoundaries-PLW-ADM1.geojson` | <https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/PLW/ADM1/geoBoundaries-PLW-ADM1.geojson> | geoBoundaries gbOpen (pinned 9469f09) | `6e9940fe651dcb9ad9a6f0b4274068f6bb2966bbf035a0a41421d30bfb9e946d` |
| `gb_plw_adm1_meta.json` | <https://www.geoboundaries.org/api/current/gbOpen/PLW/ADM1/> | geoBoundaries API | `ba85d7798e3b59aadcfceb075e16cb8c186a83074d0e216016b926d222b9d74d` |
| `palaugov_census_hub.html` | <https://www.palaugov.pw/executive-branch/ministries/finance/budgetandplanning/census-of-population-and-housing/> | official (Palau OPS) | `89e68f36b15487b0dce3590ba0dff1d126fdba6242d6eb64a48dd870cfe4a1ff` |

Derived working files also present in the cache (not source objects): `pw_2020.txt` and `pw_2005.txt` (pdftotext extractions), and `page_53-053.png`, `page_54-054.png`, `pw2015_page53-053.png` (rendered Table 42 pages used to read the image-based tables).

## Blockers

- **Licence**: no stated reuse terms in any OPS report or the PDH dataset. This is the one genuine gate. Resolve by PI ruling (summaries-with-attribution) or an OPS reuse-confirmation email.
- **Transcription**: the 2015 and 2020 Table 42 pages are image-based. The tables are small (9 religion rows by 16 states plus overseas columns) and were read cleanly at 150 dpi in this probe; no OCR pipeline is needed, but the build must transcribe and reconcile rather than parse text.
- **Comparability**: the universe break (all-ages 2005 versus 18-plus 2015/2020) and the category-frame break bar a clean 2005-to-2020 change layer. Ship levels; restrict any denomination change to the 2015-2020 pair.

## Product boundary

A build on this probe would stage 16-state religious-affiliation summaries for 2005 (all-ages), 2015 (18+), and 2020 (18+) on the geoBoundaries PLW ADM1 frame, with per-wave universe and frame notes and a withheld cross-wave change metric. It would not contain a place-of-worship layer, place-density metrics, a 2000 wave, or a denomination time series beyond the matched 2015-2020 pair. The 2000 monograph and an OPS licence confirmation are the recorded routes to deepen the series and open the page.

## Build appendix (2026-07-11)

The build shipped exactly the staged product the probe recommends. `scripts/build_pw_area_summary.R` transcribes all three tables verbatim into the script (2005 from the pdftotext extraction; 2015 and 2020 from the 150 dpi Table 42 image renders), reconciles each wave at both margins with fail-fast gates, joins the 16 census states one-to-one to geoBoundaries PLW ADM1, and writes the area summary, its CSV companion, the simplified boundary, and a `data-manifest.v2` manifest. The product is STAGED: `dataset_role` is `staged_evidence`, `downstream_status` is `staged`, `licence_status` is `needs_review`, and no page or hub link is created. Run with `Rscript scripts/build_pw_area_summary.R`.

### Deliverables

| Output | Bytes | SHA-256 |
| --- | --- | --- |
| `apps/regions/pw/data/area_summary_state.json` | 79560 | `fe79f798807fc91198bc7fa4672c62fbef6a2041129f1ef9448171763382c417` |
| `apps/regions/pw/data/area_summary_state.csv` | 39117 | `d48f644af6cda5c3ed9856f51f9c773ddf5080e11bab5fac90f35a45bc5da023` |
| `apps/regions/pw/data/pw_state_2017.geojson` | 224012 | `2bd8dbe9616ae912b9ebdc3a65c51bd60fbc9a0f7ab22df057adc5dd861ffa22` |
| `docs/manifests/pw-census-religion-2005-2020.json` | — | — |

The area summary carries 48 rows (16 states x 3 waves). Place-of-worship and place-density metrics are null; `site_snapshot` records that no governed place snapshot ships.

### Gate results (all passed, zero difference at every margin)

- **2005 Table 10.1**: the 16 state rows each close to their printed state total, the nine category columns each close to their printed national category total, and both the state-total margin and the category-total margin close to the printed national Total of 19,907.
- **2015 Table 42 (18+)**: each state row's nine categories close to the printed state total, each religion's 16 state columns close to the printed Palau Total column, the nine categories on the Palau Total column sum to 8,376, and the 16 state totals sum to 8,376.
- **2020 Table 42 (18+)**: each state row's nine categories close to the printed state total, the 16 state columns sum to 9,303, and the overall Total column control (states plus the six overseas legal-residence columns, per religion) closes to the printed 13,576 for every category and in aggregate. The overall Total is a transcription control only and is never used as the state denominator.

Every transcribed image-table cell reconciles at both margins; no cell was allocated, inferred, rounded, or tuned. The 2005 monograph prose claim of "about 1 in 6" with no religion is recorded as a discrepancy in the manifest and refuted by its own table (None or refused is 222 of 19,907, near 1.1 percent); the table governs.

### Product encoding (conductor rulings, encoded)

- **Universes** disclosed per wave in every row basis and quality flag: 2005 all persons, all ages; 2015 and 2020 persons 18 and over. The 2005-to-later level difference is a universe break, never change.
- **No-religion slot** real for 2005 (the printed None or refused count, with the caveat that it mixes persons with no religion and refusals) and null for 2015 and 2020, whose report folds persons with no religion into Other.
- **Affiliation flat by construction** for 2015 and 2020: because no-religion is folded into Other, religious affiliation equals the population and is 100 percent for every state; the manifest records this as the PI task 6 gate shared in part.
- **Change withheld** for 2005 to 2015/2020 (universe and frame breaks) and computable only for the matched 2015-2020 pair, where the flat construction makes any change trivially zero.
- **Category frames** preserved verbatim per wave in `pipeline.parameters.category_frames`, with the alignment note; the two nine-way frames are not merged.
- **Boundary** is geoBoundaries PLW ADM1 (16 states, ODbL 1.0), simplified with `scripts/lib/simplify_boundary.R` to 16 valid features with 16 distinct geometry hashes at 100 percent keep (224012 bytes). The two spelling concordances (geoBoundaries Ngeremlengui to census Ngaremlengui; 2005 Ngerchelong to canonical Ngarchelong) are encoded and recorded. A full-extent gate confirms the bounding box spans latitude 2.75 to 8.09 North, including Sonsorol and Hatohobei, rather than a main-cluster box.

### Validation output

- `Rscript scripts/build_pw_area_summary.R` — all gates PASSED; wrote the four outputs.
- `uvx check-jsonschema --base-uri "file://$PWD/schemas/" --schemafile schemas/area-summary.schema.json apps/regions/pw/data/area_summary_state.json` — `ok -- validation done`.
- `bash scripts/validate_manifests.sh` — `manifest validation: 60/60 pass` (includes the new Palau manifest).

### Open questions for the conductor

- **Licence**: the one genuine gate. No reuse terms exist anywhere in the source chain, so nothing is quoted; `licence_status` is `needs_review` and the manifest records the PI task 10 dependency. An OPS reuse-confirmation email is the clean unblock.
- **Page and hub**: withheld by instruction. Opening a page also depends on the PI task 6 ruling, because 2015 and 2020 affiliation is flat by construction.
- **Series depth**: the 2000 monograph wave and a 2015-2020 denomination series are recorded in `deferred_sources`, not shipped.
