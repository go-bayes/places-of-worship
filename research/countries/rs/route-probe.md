# Serbia census-religion route probe

## Probe result

The Statistical Office of the Republic of Serbia (SORS) dissemination tables [`3102010402`](https://data.stat.gov.rs/Home/Result/3102010402?languageCode=en-US) and [`3104020301`](https://data.stat.gov.rs/Home/Result/3104020301?languageCode=en-US) are the source of record for 2011 and 2022. Both tables publish total-gender counts for 14 religion categories at national, region, area, municipality, city, and selected city-municipality levels. The official [2002 publication G20024003](https://publikacije.stat.gov.rs/G2002/PdfE/G20024003.pdf) publishes 12 mutually exclusive religion categories at national, broad-region, district, and municipality levels.

The shipped product uses the 25 statistical areas common to all three waves: the City of Belgrade plus 24 districts (okruzi). The 2002 census volume and the later SORS area trees cited above document this composition. Municipality and city rows are available, but their hierarchy changes between 2002 and the later waves. The pinned SORS routes provide no official religion-table rebasing across those changes, and this probe did not locate a complete set of official municipality polygons for all three census dates. The area product therefore avoids an unofficial concordance.

## Pinned routes

| Wave | Source identifier | Selected route | Source update or publication date |
| --- | --- | --- | --- |
| 2022 | SORS table `3104020301`, “Population by religion” | `POST https://data.stat.gov.rs/Home/DisplayResult` with `subAreaId=3104020301`, indicator `3104020301IND01`, period `202200`, gender `0`, national plus 25 area codes, and categories `01`–`14` | 13 June 2023 |
| 2011 | SORS table `3102010402`, “Population by religion” | `POST https://data.stat.gov.rs/Home/DisplayResult` with `subAreaId=3102010402`, indicator `1802010402IND01`, gender `0`, national plus 25 area codes, and categories `01`–`14` | 1 June 2017 |
| 2002 | SORS publication `G20024003`, table 1, “Population by religion” | `GET https://publikacije.stat.gov.rs/G2002/PdfE/G20024003.pdf`; fixed-layout extraction of the national row and 25 area rows | Belgrade, May 2003; PDF (portable document format) metadata modified 16 October 2006 |

The selected area list is `RS110,RS121,RS122,RS123,RS124,RS125,RS126,RS127,RS211,RS212,RS213,RS214,RS215,RS216,RS217,RS218,RS221,RS222,RS223,RS224,RS225,RS226,RS227,RS228,RS229`. The build also requests `RS` for national reconciliation.

## Waves and geography

| Wave | Finest source geography | Municipality or city presentation | Shipped geography | Boundary treatment |
| --- | --- | --- | --- | --- |
| 2002 | municipality | 16 Belgrade municipalities; Novi Sad as one city; areas published as districts | 25 areas | 2021 GISCO NUTS 3 display frame; stability unverified |
| 2011 | municipality/city and selected city municipalities | 17 Belgrade municipalities including Surčin; parent-city and city-municipality hierarchies for Novi Sad, Niš, Požarevac, Vranje, and Užice | 25 areas | 2021 GISCO NUTS 3 display frame; stability unverified |
| 2022 | municipality/city and selected city municipalities | 17 Belgrade municipalities; parent-city and city-municipality hierarchies remain, with some presentation differences from 2011 | 25 areas | 2021 GISCO NUTS 3 display frame; stability unverified |

The geography decision follows the required sequence. First, no SORS table rebases all three waves onto one municipal frame. Second, complete official per-vintage municipal geometry was not pinned. Third, a municipality concordance would therefore be unofficial. The build uses the coarser 25-area geography present in every wave and retains the boundary-stability limitation. The 25-area level comprises the City of Belgrade plus 24 districts (okruzi).

## Territorial coverage

The shipped wording is:

> This product follows the territorial coverage published by the Statistical Office of the Republic of Serbia (SORS). In this product, the area level comprises the City of Belgrade plus 24 districts (okruzi). The 2002 publication covers Central Serbia and Vojvodina and states that the census was not conducted in the Autonomous Province of Kosovo and Metohija. The 2011 and 2022 dissemination tables identify their coverage as excluding data for the Autonomous Province of Kosovo and Metohija. Kosovo rows from other publications are outside this Serbia product.

The 2011 and 2022 selected exports each print the reference “since 1999 without data for AP Kosovo and Metohija”. The 2022 table tree displays a `RS23` regional heading but publishes no religion observations for that region in the selected result. The build does not source Kosovo rows from a different publication or agency.

## Construct and denominator

The construct is census affiliation. It does not measure belief, practice, attendance, or registered membership. The headline denominator is the total census population because SORS presents the national religious percentages over the population total and retains undeclared and unknown responses as published categories.

The 2002 affiliation numerator sums Islam, Judaic, Catholic, Orthodox, Protestant, Pro-oriental cults, and Belonging to religion which is not cited. Atheist forms the 2002 no-religion numerator. “Believer, but does not belong to any religion” remains outside both headlines because the response reports belief without affiliation. Undeclared and Unknown also remain outside the two numerators and inside the population denominator.

The 2011 and 2022 affiliation numerator sums Christians in total, Islamic, Judaism, Eastern religions, and Other religions. The Christian parent is mutually exclusive with the four non-Christian affiliation categories. Orthodox, Catholic, Protestant, and Other Christian are details within the parent and are never summed again. Agnostics plus Atheists form the no-religion numerator. Not declared and Unknown remain outside both numerators and inside the population denominator.

## Category inventories

### 2002 categories (12)

| Source code | Source label in official English volume | English display label | Product role |
| --- | --- | --- | --- |
| `TOTAL` | Total | Total | total |
| `ISLAM` | Islam | Islam | named religion |
| `JUDAIC` | Judaic | Judaism | named religion |
| `CATHOLIC` | Catholic | Catholic | named religion |
| `ORTHODOX` | Orthodox | Orthodox | named religion |
| `PROTESTANT` | Protestant | Protestant | named religion |
| `PRO_ORIENTAL` | Pro-oriental cults | Eastern religions | named religion |
| `OTHER_RELIGION` | Belonging to religion which is not cited | Other religion | named religion |
| `BELIEVER_NO_RELIGION` | Believer, but does not belong to any religion | Believer without religious affiliation | belief without affiliation |
| `UNDECLARED` | Undeclared | Did not declare | not declared |
| `ATHEIST` | Atheist | Atheist | no religion |
| `UNKNOWN` | Unknown | Unknown | unknown |

### 2011 and 2022 categories (14 per wave)

| Source code | Serbian Cyrillic source label | English display label | Product role |
| --- | --- | --- | --- |
| `01` | Укупно | Total | total |
| `02` | Хришћанска - свега | Christians in total | Christian parent |
| `03` | православна | Orthodox | Christian detail |
| `04` | католичка | Catholic | Christian detail |
| `05` | протестантска | Protestant | Christian detail |
| `06` | остале хришћанске | Other Christian | Christian detail |
| `07` | Исламска | Islamic | named religion |
| `08` | Јудаистичка | Judaism | named religion |
| `09` | Источњачке вероисповести | Eastern religions | named religion |
| `10` | Остале вероисповести | Other religions | named religion |
| `11` | Агностици | Agnostics | no religion |
| `12` | Нису верници (атеисти) | Atheists | no religion |
| `13` | Нису се изјаснили | Not declared | not declared |
| `14` | Непознато | Unknown | unknown |

## Exact reconciliation

| Wave | Published category rows including total | Mutually exclusive categories excluding total | National population | National affiliation numerator | National no-religion numerator | Outside both headlines |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2002 | 12 | 11 | 7,498,001 | 7,123,138 | 40,068 | 334,795 |
| 2011 | 14 | 9 | 7,186,862 | 6,782,350 | 84,063 | 320,449 |
| 2022 | 14 | 9 | 6,647,003 | 6,039,240 | 82,793 | 524,970 |

Every mutually exclusive category sum equals the published area total in all 75 area-year rows. Every category also sums exactly from the 25 area rows to the published national row. The build uses no rounding allowance and distributes no residual.

## Boundaries and reuse terms

The boundary source is Eurostat Geographic Information System of the Commission (GISCO) Nomenclature of Territorial Units for Statistics (NUTS) 3 2021 at 1:1 million in EPSG:4326. The all-Europe file contains exactly the 25 Serbia codes selected from SORS. The build calculates areas in EPSG:3035 and simplifies the layer through `scripts/lib/simplify_boundary.R`.

GISCO download provisions apply, with attribution to Eurostat GISCO and `© EuroGeographics for the administrative boundaries`. Geometric stability of these 25 areas across the three census dates was not verified.

The 2002 and 2011 census volumes require users to quote the source. SORS's open-data portal publishes broad reuse terms for its open-data endpoint, but the record inspected in this probe does not establish that those terms govern every historical census PDF or the dissemination-database export. The manifest therefore records `needs_review` and makes no broader SORS licence claim.

## Build-gate results

- **Wave coverage**: passed. All three announced waves are present.
- **Reconciliation**: passed exactly for every area, category, and national row.
- **Geography**: passed at the common 25-area level, comprising the City of Belgrade plus 24 districts (okruzi). Municipality rows remain deferred because no official rebasing or complete per-vintage geometry set was pinned.
- **Geometry**: passed. The output contains 25 valid, non-empty features with 25 distinct SHA-256 well-known binary (WKB) hashes.
- **Boundary stability**: passed with an explicit unverified disclosure.
- **Territorial coverage**: passed. The exact scope note appears in the area-summary JSON and the manifest.
- **Provenance**: passed. Cached and generated files record URL or repository path, retrieval date where applicable, byte size, and SHA-256.
- **Reuse terms**: passed with `needs_review` status and no invented licence claim.
