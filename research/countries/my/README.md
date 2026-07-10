# Country data map: Malaysia (MY)

## Status

- **Tier**: B
- **Build state**: survey verified; the religion tables are technically extractable, but publication-specific reuse permission and a complete official boundary licence remain unresolved
- **Last verified**: 2026-07-10

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [Department of Statistics Malaysia (DOSM) Key Findings, MyCensus 2020: Administrative District](https://www.dosm.gov.my/portal-main/release-content/key-findings-population-and-housing-census-of-malaysia-2020-administrative-district) and its district-report series | reported religion | Administrative district on the 2020 reporting frame; some new districts have unavailable historical cells | 1991, 2000, 2010, 2020 | Text-bearing PDF tables | Open web, one report per district | Each sampled PDF says all rights reserved and requires prior written permission for reproduction, distribution, or database storage; obtain DOSM confirmation before extraction or republication |
| [DOSM 2020 state-report series](https://www.dosm.gov.my/uploads/publications/20221013155927.pdf), Tables 1 and 2 | reported religion | State | 1970, 1980, 1991, 2000, 2010, 2020 | Text-bearing PDF | Open web | Same publication-specific restriction |
| [MyCensus Population Distribution and Basic Demographic Characteristics 2010](https://www.mycensus.gov.my/index.php/census-product/publication/census-2010/659-population-distribution-and-basic-demographic-characteristics-2010) | reported religion | State | 2010 | Browser flipbook backed by page images and JavaScript search text | Open web | MyCensus footer says all rights reserved; no publication-specific open licence was located |
| [MyCensus Population Distribution and Basic Demographic Characteristics 2000](https://www.mycensus.gov.my/index.php/census-product/publication/census-2000/650-population-distribution-and-basic-demographic-characteristics-2000) | reported religion | State | 2000 | Browser flipbook backed by page images and JavaScript search text | Open web | MyCensus footer says all rights reserved; no publication-specific open licence was located |

The four-wave district series uses DOSM's six-category historical publication frame: Islam, Christianity, Buddhism, Hinduism, Others, and No Religion/Unknown. The detailed source categories changed across waves. Preserve the source labels and do not treat the components of `Others` or `No Religion/Unknown` as stable categories.

## Access the data yourself

- **Source of record**: [Department of Statistics Malaysia (DOSM)](https://www.dosm.gov.my/), through the MyCensus 2020 district-report series.
- **Exact tables**: Table 3, `Principal statistics of population on census year, {district}, {state}`, for 1991, 2000, 2010, and 2020; Table 7, `Number of population by religion and sex, {district}, {state}`, for the detailed 2020 frame. [Johor Bahru](https://www.dosm.gov.my/uploads/publications/20221018092514.pdf), [Melaka Tengah](https://www.dosm.gov.my/uploads/publications/20221011101133.pdf), and [Bukit Mabong](https://www.dosm.gov.my/uploads/publications/20221018130805.pdf) are verified examples.
- **OpenDOSM finding**: the catalogue has no religion dataset. Dataset `population_district` has [CSV](https://storage.dosm.gov.my/population/population_district.csv), [Parquet](https://storage.dosm.gov.my/population/population_district.parquet), and [API](https://api.data.gov.my/data-catalogue?id=population_district&limit=3) routes under Creative Commons Attribution 4.0, but its dimensions are sex, age, and ethnicity.
- **Licence**: resolve the conflict between the [general DOSM Government Open Data Terms of Use 1.0](https://www.dosm.gov.my/portal-main/article/term-of-use) and the restrictive statement printed in each district PDF. Do not treat the PDF tables as Creative Commons data without written DOSM confirmation.
- **Our extraction script**: none; this was a route probe only.
- **Retrieval recipe and hashes**: none; no source objects were ingested.

## Boundaries

- DOSM states that district data for 1991, 2000, and 2010 in the 2020 district reports were adjusted for newly created districts and boundary changes. The intended analytical frame is therefore the 2020 district geography. Some newly created districts still have unavailable historical cells.
- The official [MyGeoName district feature service](https://mygos.mygeoportal.gov.my/gisserver/rest/services/MyGeoname/MyGeoName_BaseMap/MapServer/7) provides GeoJSON-capable polygons attributed to Jabatan Ukur dan Pemetaan Malaysia (JUPEM; Department of Survey and Mapping Malaysia). The service marks them as updated in August 2019 but returns only 94 features rather than the 160 MyCensus 2020 reporting units. MyGeoportal says spatial data require a formal request, and its copyright notice does not supply an open reuse licence.
- Sabah's official Land and Surveys Department lists paid district maps in PDF. Sarawak's official eLASIS route sells cartographic PDFs with district and sub-district boundaries. Neither route supplies an openly licensed national vector layer.
- The documented open fallback is [geoBoundaries MYS ADM2](https://www.geoboundaries.org/api/current/gbOpen/MYS/ADM2/): 160 district features, year represented 2020, Creative Commons Attribution 3.0. It is not an official Malaysian source and requires name, code, and geometry reconciliation against the DOSM district list before use.

## Places-of-worship layer

Not assessed in this probe.

## First visualisation

Begin the visualisation only after written DOSM reuse permission and a project-lead boundary ruling. The ruling must resolve the choice between the incomplete official vector release and the non-official Creative Commons Attribution 3.0 geoBoundaries fallback. Then map reported-religion shares by 2020 administrative district for 1991, 2000, 2010, and 2020. Use the six-category DOSM historical frame and mark unavailable district-wave cells explicitly.

## Build recipe

1. Obtain written DOSM confirmation that the district-report tables may be extracted, stored, transformed, and used in a public derived map.
2. Enumerate the district-report PDFs and extract Table 3 for 1991, 2000, 2010, and 2020, retaining `..` as unavailable.
3. Reconcile the 160 DOSM district names against the geoBoundaries 2020 ADM2 fallback or an official vector release obtained by request.
4. Produce `area_summary` records and a tracked manifest only after the licence and boundary gates pass.
5. Verify district totals against state totals, category sums against population totals, and historical missingness against each source table.

## Risks and open questions

- The publication-specific reuse statement conflicts with the current general DOSM data terms.
- OpenDOSM does not publish religion in CSV, Parquet, or API form.
- The official public vector service does not cover all 160 reporting units, and no vintage-specific open vector archive was verified.
- The 2000, 2010, and 2020 detailed category frames differ. The historical Table 3 frame collapses those differences into `Others` and `No Religion/Unknown`.
- The [DOSM district report's geographical-divisions note](https://www.dosm.gov.my/uploads/publications/20221018092514.pdf#page=150) states that Sabah has no mukim level, some Sarawak administrative districts divide into sub-districts, and Kelantan uses `jajahan` for the administrative-district level. DOSM's district reporting unit remains the comparison level.

## Deep-history potential

Not surveyed in this probe.
