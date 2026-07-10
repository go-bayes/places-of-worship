# Lithuania census-religion route probe

## Verdict

The Lithuania municipality route is buildable, with an instrument break before 2021. Official Statistics Portal (OSP) flow `S3R778_GBS010306_1` publishes the 2001, 2011, and 2021 religious-community-indicated construct for the same 60 municipality codes. The OSP publishes these tables as Statistical Data and Metadata eXchange (SDMX) JSON exports. The 2001 and 2011 waves are full-enumeration census responses. The 2021 religion values are estimates from a separate ethnocultural statistical survey published with the register-based census. The product therefore shows three snapshots and withholds cross-instrument change metrics.

## Pinned OSP records and exports

| Role | Identifier | Coverage | Reproducible route |
| --- | --- | --- | --- |
| Municipality religion table | Share hash `a19ff692-f3aa-4a3d-90c3-84c7880fa9fa`; flow `S3R778_GBS010306_1`; data structure `GBS010306` | 60 municipalities; 2001, 2011, 2021 | [Interactive table](https://osp.stat.gov.lt/lt/statistiniu-rodikliu-analize?hash=a19ff692-f3aa-4a3d-90c3-84c7880fa9fa); [SDMX-JSON export](https://osp-rs.stat.gov.lt/rest_json/data/S3R778_GBS010306_1) |
| Expanded national religion table | Flow `S3R778_GBS010502` | Lithuania; 2001, 2011, 2021 | [SDMX-JSON export](https://osp-rs.stat.gov.lt/rest_json/data/S3R778_GBS010502) |
| REST contract | SDMX 2.1 OSP service | Anonymous GET; latest dataset version; maximum 1,000,000 observations | [OSP REST documentation](https://osp.stat.gov.lt/rdb-rest) |

The municipality flow has four observation dimensions: `SavivaldybesM1411` (administrative territory from 2000), `GBS_religija_06` (religion), `MATVNT` (unit), and `LAIKOTARPIS` (year). The export contains 73 administrative labels: 60 municipalities, ten counties, the national row, and two statistical regions. The build selects the 60 municipality codes and uses the national row from the same flow for reconciliation.

## Categories and non-response

The municipality presentation publishes the same 16 categories in every wave, plus `Iš viso pagal religiją` (Total by religion): `Naujosios apaštalų Bažnyčios`; `Septintos dienos adventistų`; `Romos katalikų`; `Stačiatikių (ortodoksų)`; `Sentikių`; `Evangelikų liuteronų`; `Evangelikų reformatų`; `Musulmonų sunitų`; `Baptistų ir „laisvųjų bažnyčių “`; `Judėjų`; `Graikų apeigų katalikų (unitų)`; `Karaimų`; `Kitų`; `Nė vienai`; `Nenurodyta`; and `Sekmininkų`. The source's Lithuanian labels remain unchanged in the manifest, with English labels added for display.

The companion national flow publishes a more detailed 25-category structure plus the total. Its additional named categories are `Budistų`, `Tikėjimo žodžio`, `Krišnos sąmonės judėjimo`, `Kristaus bažnyčios`, `Metodistų`, `Baltų tikėjimo`, `Jehovos liudytojų`, `Charizminių evangeliškų krikščionių bendruomenių`, and `Pastarųjų dienų šventųjų Jėzaus Kristaus bažnyčios`. The municipality category `Kitų` is therefore a grouped presentation. The expanded national allocation does not replace municipality rows because the two source presentations do not allocate every category identically.

`Nė vienai` means that the resident did not identify with any religious community. `Nenurodyta` means that religion was not indicated. The product keeps these categories separate and retains `Nenurodyta` in the population denominator. The named-affiliation headline is `Iš viso pagal religiją - Nė vienai - Nenurodyta`.

Small municipality denomination cells can be confidential or marked as absent. These suppressed cells prevent exact municipality-to-national reconciliation for every individual denomination. The three unsuppressed fields used by the standard product, `Iš viso pagal religiją`, `Nė vienai`, and `Nenurodyta`, sum exactly from the 60 municipalities to the national row in 2001, 2011, and 2021. The builder distributes no suppressed value.

## 2021 universe and instrument verdict

The 2021 population and housing census established the population from administrative registers and information systems. Religion was absent from those sources. The State Data Agency therefore ran a separate statistical survey on ethnicity, mother tongue, and professed religion: 56,000 household residents completed the questionnaire themselves, interviewers surveyed 115,000 household residents, and mathematical methods produced population estimates. The agency merged the survey results with the census results and published them as census statistical information. See the [2021 ethnocultural release](https://osp.stat.gov.lt/en/2021-gyventoju-ir-bustu-surasymo-rezultatai/tautybe-gimtoji-kalba-ir-tikyba), the [census route](https://osp.stat.gov.lt/gyventoju-ir-bustu-surasymai1), and methodology order DĮ-189 ([PDF](https://osp.stat.gov.lt/documents/10180/4432752/Etnokult_tyrimo_metodika_2020_189.pdf/2f49c11b-5392-4678-bfb4-28879c1ee001)).

The 2021 universe verdict is a full census resident-population denominator with sample/model-based religion estimates. The OSP total is 2,810,761 residents, and the municipality religion numerators derive from the 171,000 household respondents plus mathematical estimation. The 2021 values are not whole-population register observations. The build flags every 2021 row and withholds change metrics between the 2001/2011 enumeration instrument and the 2021 survey/model instrument.

## Boundaries and municipal reform

The boundary source is the State Enterprise Centre of Registers Address Register municipality spatial dataset in [Lithuania's Open Data Portal, dataset 1345](https://data.gov.lt/datasets/1345/?resource_version=1125). The catalogue labels the dataset public and applies [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/). The [Open Data Storage API](https://get.data.gov.lt/datasets/gov/rc/ar/grasavivaldybe/GraSavivaldybe/:format/json) supplies 60 municipality geometries, codes, areas, source formation dates, and a common geometry formation date of 2025-10-21.

The boundary source records 55 municipalities with formation date 1998-06-01. It assigns formation date 2000-02-02 to five municipalities associated with the 2000 municipal reform: Elektrėnai, Kalvarija, Kazlų Rūda, Pagėgiai, and Rietavas. OSP labels its administrative dimension "from 2000" and publishes the same 60 codes in all three waves. The map uses the current 2025 geometry frame for every wave and does not claim that those polygons reproduce every historic boundary segment. Municipality geometry stability from 2001 through the 2025 boundary frame was not verified: formation dates and shared codes do not prove unchanged boundaries.

The source Well-Known Text serialises EPSG:3346 coordinates as northing followed by easting. The builder swaps the axes, validates the geometry in the Lithuanian Coordinate System 1994 (LKS-94), prepares the dense source at 25 metres, transforms to EPSG:4326, and passes the layer through `scripts/lib/simplify_boundary.R`. The final gate requires 60 valid, non-empty features with 60 distinct SHA-256 hashes.

## Terms and provenance

OSP pages state that use of State Data Agency data requires identification of the source. No named open licence was located on the indicator table, REST documentation, or census release pages. The manifest therefore records the attribution requirement and makes no open-licence claim for the statistical flow. The Registers Centre boundary source has the separate CC BY 4.0 record described above.

Every raw input is cached under `data/raw/lt_census/` with its source URL, retrieval timestamp, byte count, and SHA-256. The public outputs and manifest are generated by `scripts/build_lt_area_summary.R`.
