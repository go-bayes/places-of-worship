# Bulgaria census-religion route probe

Verified 2026-07-10. The National Statistical Institute of Bulgaria (NSI) record supports a complete 2001–2021 district series. Municipality religion data are pinned for 2021 only. The product therefore uses the 28 districts under the finest-complete-geography rule.

## Export routes

| Wave | District route | Municipality route | Decision |
| --- | --- | --- | --- |
| 2001 | [Population as of 1 March 2001 by district and religious denomination](https://www.nsi.bg/Census/Religion.htm), one Windows-1251 web table with Bulgaria and all 28 districts | No municipality religion table appears in the [Census 2001 final-results index](https://www.nsi.bg/Census/CensusList1.htm); that index offers municipality detail for population by sex but district detail for religion | District available; municipality not pinned |
| 2011 | [Report R10](https://censusresults.nsi.bg/Census/Reports/2/2/R10.aspx) with `?OBL={NSI_DISTRICT_CODE}` for each district; [report R15](https://censusresults.nsi.bg/Census/Reports/2/2/R15.aspx) supplies full district populations | R10 exposes a district selector and no municipality selector; no complete municipal religion export was pinned | District available; municipality not pinned |
| 2021 | [Infostat definition 2001](https://www.nsi.bg/infostat/2001), a form submission selecting `BG`, all 28 level-4 district codes, religion codes `0`–`8`, and period `2021` | [Infostat definition 2024](https://www.nsi.bg/infostat/2024) exposes all level-5 municipality codes for 2021 | District and municipality available for 2021 only |

The build records every Hypertext Transfer Protocol (HTTP) request field in `docs/manifests/bg-census-religion-2001-2021.json`. The 2011 district requests are serialised at 0.2-second intervals. No throttling occurred during the verified retrieval, and every successful response is reused from `data/raw/bg_census/`.

## Categories and question mechanics

The 2001 source publishes eight rows: *Общо* (Total) and seven mutually exclusive categories comprising *Източно православно* (Eastern Orthodox), *Католическо* (Catholic), *Протестантско* (Protestant), *Мюсюлманско* (Muslim), *Друго* (Other religion), *Не се самоопределя* (Cannot self-identify), and *Непоказано* (Not shown). NSI states that 2001 was the first census in which answers to the ethnicity, mother-tongue, and religion questions were voluntary. NSI's [published presentation](https://www.nsi.bg/Census/StrReligion.htm) uses the full population of 7,928,901 as its share denominator: 6,552,751 Eastern Orthodox residents produce the published 82.6%. The denominator includes 283,309 people recorded as *Не се самоопределя* and 24,807 as *Непоказано*.

The 2011 R10 source publishes 12 leaf rows: *Общо* (Total) and 11 mutually exclusive categories comprising *Източноправославно* (Eastern Orthodox), *Католическо* (Catholic), *Протестантско* (Protestant), *Мюсюлмаснко-сунитско* (Sunni Muslim; source spelling retained), *Мюсюлманско-шиитско* (Shia Muslim), *Мюсюлманско* (Muslim, unspecified), *Арменско апостолическо православно* (Armenian Apostolic Orthodox), *Израилтянско/юдаизъм* (Jewish/Judaism), *Друго* (Other religion), *Няма* (No religion), and *Не се самоопределя* (Cannot self-identify). NSI describes 2011 as the second census with voluntary answers and the first to offer “no religion”. R10 contains 5,758,301 respondents from a full census population of 7,364,570. The omitted 1,606,269 people are 21.8108% of residents. Among respondents, 272,264 selected *Няма* and 409,898 selected *Не се самоопределя*.

The 2021 Infostat source publishes nine rows: *Общо* (Total) and eight mutually exclusive categories comprising *Християнско* (Christian), *Мюсюлманско* (Muslim), *Юдейско* (Jewish), *Друго* (Other religion), *Нямам* (No religion), *Не мога да определя* (Cannot determine), *Не желая да отговоря* (Do not want to answer), and *Непоказано* (Unknown). NSI's [2021 ethno-cultural release](https://www.nsi.bg/index.php/en/file/24020/Census2021-ethnos_en.pdf) states that its religion structure and relative shares exclude people added from administrative sources for whom the census registers contain no religion information. Of 6,519,789 residents, 616,681 were *Непоказано*, leaving the published basis of 5,903,108 people with religion information, or 90.5414% of residents. Within that basis, 472,606 selected *Не желая да отговоря*, 259,235 selected *Не мога да определя*, and 305,102 selected *Нямам*.

## Denominator decision

NSI's published share basis differs in every wave. The 2001 basis is the full population of 7,928,901. The [2011 final results](https://www.nsi.bg/census2011/PDOCS2/Census2011final_en.pdf) and R10 presentation use 5,758,301 voluntary-question respondents out of 7,364,570 residents; R15 supplies the full population used to disclose the omitted 1,606,269 residents. The 2021 basis is 5,903,108 people with religion information after excluding 616,681 administrative additions with no religion information from 6,519,789 residents. Cannot-self-identify remains inside the 2011 basis. Cannot-determine, explicit refusal, and no-religion remain inside the 2021 basis.

The differing bases constitute an instrument break. The product withholds `religious_change` between every pair of waves and presents each wave as a separate snapshot. The responding share and the available response categories also changed across waves; the snapshots may therefore reflect changing respondent composition as well as changing affiliation.

## Reconciliation and confidentiality

Every released district group and national group reconciles exactly after applying the published category structure. The 2011 district pages suppress some Armenian Apostolic Orthodox and Jewish all-age cells as confidential under Article 25 of the Statistics Act. The build does not estimate or expose a suppressed leaf value. The broader *Други вероизповедания* (Other religions) group is derived exactly as the respondent total less every unsuppressed mutually exclusive category. Its national value is 11,444, which matches NSI's 2011 main-results presentation.

## Boundaries

The boundary route is the [Eurostat Geographic Information System of the Commission (GISCO) nomenclature of territorial units for statistics (NUTS) level 3 Geographic JavaScript Object Notation (GeoJSON) for 2021](https://gisco-services.ec.europa.eu/distribution/v2/nuts/geojson/NUTS_RG_01M_2021_4326_LEVL_3.geojson). The build uses an explicit concordance between the 28 NSI district codes and the 28 Bulgarian NUTS level 3 codes. All output features are valid and have distinct geometry hashes. Geometric stability across 2001, 2011, and 2021 remains unverified; the product discloses that it maps all waves on the common 2021 frame.

Eurostat authorises reuse with source acknowledgement and requires modifications to be identified. NSI Licence v2.0 permits reproduction, distribution, and use with attribution, including commercial use, but also states that derivative and collective works may not be distributed. The build records `licence_status: needs_review` and `downstream_status: staged`. The conductor should resolve that clause before publishing or committing the derived census summaries.

## Gate result

The wave, geography, count-reconciliation, provenance, cache, and geometry gates pass. The boundary-stability claim is marked unverified. The publication licence gate remains open because of the NSI derivative-work clause.
