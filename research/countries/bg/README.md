# Country data map: Bulgaria (BG)

## Status

- **Tier**: B (data build complete; publication terms require review)
- **Build state**: data extracted
- **Last verified**: 2026-07-10

## Religious data over time

The National Statistical Institute of Bulgaria (NSI) is the source of record for every census table in this build.

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [NSI Census 2001 district table](https://www.nsi.bg/Census/Religion.htm) | census affiliation | district | 2001 | web table | open | NSI Licence v2.0; derivative-work clause requires review |
| [NSI Census 2011 report R10](https://censusresults.nsi.bg/Census/Reports/2/2/R10.aspx) | census affiliation | district | 2011 | web report | open | NSI Licence v2.0; derivative-work clause requires review |
| [NSI Infostat Census 2021 district table](https://www.nsi.bg/infostat/2001) | census affiliation | district | 2021 | web table/form submission | open | NSI Licence v2.0; derivative-work clause requires review |
| [NSI Infostat Census 2021 municipality table](https://www.nsi.bg/infostat/2024) | census affiliation | municipality | 2021 only | web table/form submission | open | NSI Licence v2.0; derivative-work clause requires review |

Census affiliation measures self-identification through the census religion question. It does not measure belief, practice, attendance, or registered membership. The question was voluntary in 2001, 2011, and 2021, and non-response is part of the construct.

## Access the data yourself

This project does not redistribute the cached source pages. The generated district summaries remain staged pending review of the NSI derivative-work clause.

- **Source of record**: National Statistical Institute of Bulgaria (NSI), [Census 2021](https://census2021.bg/) and [Infostat](https://infostat.nsi.bg/infostat/)
- **Exact tables**: Census 2001 “Population as of 1 March 2001 by district and religious denomination”; Census 2011 report R10 with `?OBL={NSI_DISTRICT_CODE}` and population report R15; Infostat definition 2001 for 2021 districts; Infostat definition 2024 for 2021 municipalities
- **Licence**: [NSI Licence v2.0](https://www.nsi.bg/pages/licenz-za-izpolzvaneto-na-statisticheskata-informaciya-proizvejdana-i-razprostranyavana-ot-nacionalniya-statisticheski-institut-485) requires attribution and contains a clause against distributing derivative and collective works; conductor review is required before publication
- **Our extraction script**: `scripts/build_bg_area_summary.R`
- **Retrieval recipe and hashes**: `docs/manifests/bg-census-religion-2001-2021.json`

## Boundaries

- Official boundary file: [Eurostat Geographic Information System of the Commission (GISCO) nomenclature of territorial units for statistics (NUTS) level 3, 2021](https://ec.europa.eu/eurostat/web/gisco/geodata/statistical-units/territorial-units-statistics), under the European Commission reuse policy with Eurostat GISCO attribution.
- The build maps the 28 NSI districts to the 28 Bulgarian NUTS level 3 codes through an explicit concordance. Geometric stability across census waves remains unverified, and all waves use the common 2021 frame.

## Places-of-worship layer

- OpenStreetMap (OSM) coverage assessment (2026-07-07): one Overpass batch returned 3,267 objects before the batch was stopped; rerun before a place layer is built.
- Potential country-specific sources include the Directorate of Religious Denominations, Bulgarian Orthodox dioceses, Muslim Denomination registers, and Catholic and Protestant directories. These sources have not been verified for this product.

## First visualisation

Religious-affiliation percentage on NSI's published denominator for each wave, mapped by district on 2021 NUTS 3 boundaries. NSI uses the full population in 2001, the 5,758,301 voluntary-question respondents out of 7,364,570 residents in 2011, and the 5,903,108 people with religion information out of 6,519,789 residents in 2021. The product withholds `religious_change` between every pair of waves because these bases differ. The separate snapshots retain the respondent-composition warning.

## Build recipe

1. Extract the three district tables and preserve the source categories, response states, request fields, and cached hashes.
2. Build the JavaScript Object Notation file `area_summary_district.json` and its comma-separated values companion under `apps/regions/bg/data/`, with provenance in `docs/manifests/bg-census-religion-2001-2021.json`.
3. Join the NSI district codes to GISCO NUTS level 3 for 2021 and validate all 28 geometries and geometry hashes.
4. Keep the generated census summaries staged until the conductor resolves the NSI Licence v2.0 derivative-work clause.
5. Add the region page only after publication terms are resolved; the user interface is outside this lane.

## Risks and open questions

- NSI Licence v2.0 contains a clause against distributing derivative and collective works. Publication requires conductor review.
- The 2011 district report suppresses small Armenian Apostolic Orthodox and Jewish cells. The product derives only the exact broader other-religions group and does not expose suppressed leaf values.
- NSI's [2001 presentation](https://www.nsi.bg/Census/StrReligion.htm) uses the full population of 7,928,901, including 283,309 people recorded as *Не се самоопределя* (Cannot self-identify) and 24,807 as *Непоказано* (Not shown). Its published Eastern Orthodox share, 6,552,751/7,928,901, rounds to 82.6%.
- NSI's [2011 final results](https://www.nsi.bg/census2011/PDOCS2/Census2011final_en.pdf) and [R10 table](https://censusresults.nsi.bg/Census/Reports/2/2/R10.aspx) use 5,758,301 voluntary-question respondents out of 7,364,570 residents. The omitted 1,606,269 residents are 21.8108% of the full population.
- NSI's [2021 ethno-cultural release](https://www.nsi.bg/index.php/en/file/24020/Census2021-ethnos_en.pdf) uses 5,903,108 people with religion information. It excludes 616,681 people added from administrative sources without religion information from the total population of 6,519,789.
- The three published bases differ. The product treats the discontinuity as an instrument break and withholds `religious_change` between every pair of waves. Respondent composition can still affect interpretation of the separate snapshots.
- The 2001 census offered no no-religion response. That indicator is null for 2001.
- District-boundary stability across the three waves remains unverified.

## Deep-history potential

Potential sources include NSI historical census volumes, Bulgarian Orthodox parish archives, Muslim waqf and muftiate records, Catholic and Protestant mission archives, Jewish community archives, and Ottoman defters. These sources have not been surveyed for this build.
