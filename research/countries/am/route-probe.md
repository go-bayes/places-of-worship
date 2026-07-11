# Armenia census-religion route probe

Verified 2026-07-11. Armenia collected religion in the 2011 and 2022 population censuses; the 2001 census did not ask religion. The decisive finding is a geography ceiling: the Statistical Committee of the Republic of Armenia (Armstat) publishes census religion only at the national level, cross-tabulated with ethnicity, age, and educational attainment and split by urban and rural residence. No published Armstat table breaks religion down by marz (region) or Yerevan for any wave. The task's target product — religion by the ten marzes plus Yerevan across 2001, 2011, and 2022 — is therefore not satisfiable from published Armstat tables.

The recommendation is HOLD. The only route to marz-level religion is a tabulation from the IPUMS-International 10 percent census microdata, which exists for 2011 only, carries sampling error, and sits under a restricted-access licence. That is a different build class and needs a PI ruling. The national religion frames for 2011 and 2022 are captured exactly below for the record and for any national-context card.

## What exists per wave

| Wave | Religion collected | Published geography for religion | Marz-level religion table | Build decision |
| --- | --- | --- | --- | --- |
| 2001 | No | None | None | No data. The 2001 census did not include a religion question. |
| 2011 | Yes | National only (Republic of Armenia, urban/rural) | None located | National frame captured; no subnational series. |
| 2022 | Yes | National only (Republic of Armenia, urban/rural) | None located | National frame captured; per-marz booklets carry no data files yet. |

The 2001 finding is confirmed three ways. The 2011 census is repeatedly described in secondary sources as the first Armenian census to ask religious affiliation after roughly seventy years of Soviet-era suppression. IPUMS-International codes its harmonised RELIGION variable for Armenia 2011 only, not for Armenia 2001. And the current Armstat 2001-results pages ([nid=664](https://www.armstat.am/en/?nid=664), [nid=748](https://www.armstat.am/en/?nid=748)) expose no religion tables.

## Why there is no marz-level religion table

The national census-results volumes place religion inside Chapter 5, "Ethnic structure, fluency in languages and religious belief". Every religion table in that chapter is scoped to "Republic of Armenia" and adds only an urban/rural split; none carries a marz dimension.

- **2011 national religion tables** ([nid=532](https://www.armstat.am/en/?nid=532)): Table 5.4 "Population (urban, rural) by Ethnicity, Sex and Religious Belief" ([99486278.pdf](https://www.armstat.am/file/doc/99486278.pdf)); Table 5.5 "…by Educational Attainment, Sex and Religious Belief" ([99486283.pdf](https://www.armstat.am/file/doc/99486283.pdf)); Table 5.6 "…by Age, Sex and Religious Belief" ([99486288.pdf](https://www.armstat.am/file/doc/99486288.pdf)).
- **2022 national religion tables** ([The Main Results of RA Census 2022, nid=82&id=2623](https://www.armstat.am/en/?nid=82&id=2623)): Chapter 5 ships as a 7-Zip archive, English `section_5.7z`, containing Table 5.5 "Population by Ethnicity, Sex and Religious Belief", Table 5.6 "Population by Age, Sex and Religious Belief", and Table 5.7 "Population by Educational attainment, Sex and Religious Belief". Each sheet's title line reads "Republic of Armenia, permanent population".

Armstat does publish per-marz census booklets, and those booklets do carry a Chapter 5. The 2011 marz booklets sit at [nid=188](https://www.armstat.am/en/?nid=188) (Yerevan) and nid=189–198 (the ten marzes). Their Chapter 5 was inspected directly for Aragatsotn ([nid=189](https://www.armstat.am/en/?nid=189) → [file/doc/74.pdf](https://www.armstat.am/file/doc/74.pdf)): it contains only Table 5.1 "De Jure Population (Urban, Rural) by Age and Ethnicity" and Table 5.2 "De Jure Population by Ethnicity (Urban, Rural) and Educational Attainment". The marz booklet publishes ethnicity by marz but not religion by marz. The 2022 per-marz pages (nid=945–957) exist as navigation stubs but expose no data files at probe time, consistent with the 2022 results still releasing.

The [ArmStatBank PX-Web instance](https://www.armstat.am/pxweb/en/ArmStatBank/) was checked as the task directs. Its API returns HTTP 500 at `/pxweb/api/v1/en/` and `/pxweb/api/v1/en/ArmStatBank/`, and its navigation tree needs an interactive ASP.NET session that could not be established in this probe (both browser tools were unavailable). No religion-by-marz table was located there. The associated [Demographic Database](https://www.armstat.am/en/?nid=209) publishes 2011-census-based age-and-sex distributions by marz, not religion. This is a documented limitation of the probe, not a route: even a fully expanded ArmStatBank would not be expected to carry a religion cross-tab that the census-results volumes themselves withhold, and no secondary evidence indicates one exists.

## National religion frames (for the record)

The national frames reconcile exactly and are the anchors for any reconciliation or national-context card. Category labels are quoted as published; Armenian labels come from the Armenian-language Chapter 5, English labels from the English-language Chapter 5.

### 2011 national frame (Table 5.4, RA row)

National total (de jure population) 3,018,854. The named categories sum to the "Follower of religious belief" subtotal of 2,897,267, and that subtotal plus the three non-affiliation categories sum to the total.

| English label (as published) | Count |
| --- | ---: |
| Population (total) | 3,018,854 |
| Follower of religious belief (subtotal) | 2,897,267 |
| Armenian apostolic | 2,796,519 |
| Evangelical | 29,280 |
| Shar-fadinian | 25,204 |
| Catholic | 13,843 |
| Jehovah's witness | 8,695 |
| Orthodox | 7,532 |
| Pagan | 5,434 |
| Molokai | 2,872 |
| Other | 7,888 |
| None | 34,373 |
| Religious belief not stated | 76,273 |
| Refused to answer | 10,941 |

### 2022 national frame (Table 5.5, ՀՀ / RA row)

National total (permanent population) 2,932,731. The named categories sum to the "Follower of religious belief" subtotal of 2,865,877; that subtotal plus "No religion" (17,501) and "Refused to answer" (49,353) equal the total.

| Armenian label (as published) | English label (as published) | Count |
| --- | --- | ---: |
| Բնակչություն | Population (total) | 2,932,731 |
| Ունեն կրոնական դավանանք | Follower of religious belief (subtotal) | 2,865,877 |
| Հայ առաքելական | Armenian apostolic | 2,793,042 |
| Կաթոլիկ | Catholic | 17,884 |
| Ուղղափառ | Orthodox | 6,316 |
| Նեստորական | Nestorian | 524 |
| Ավետարանական | Evangelical | 15,836 |
| Եհովայի վկա | Jehovah's witness | 5,282 |
| Մոլոկան | Molokai | 2,000 |
| Շարֆադինական | Shar-fadinian | 14,349 |
| Հեթանոսական | Pagan | 2,132 |
| Մահմեդական | Islam | 515 |
| Հուդայական | Judaism | 118 |
| Կրիշնյա գիտակցության կամ Հարե կրիշնյա | Krishna consciousness or Hare Krishna | 204 |
| Այլ | Other | 7,675 |
| Չունեն կրոնական դավանանք | No religion | 17,501 |
| Հրաժարվել են պատասխանել | Refused to answer | 49,353 |

Three frame notes carry forward. The Armenian "Մոլոկան" is the Molokan community; the English sheet renders it "Molokai", which is a translation quirk in the source, not a different group. "Shar-fadinian" (Armenian "Շարֆադինական") is the Yezidi Sharfadin religious identity and concentrates in the Yezidi population; in 2022 it counts 14,349, of which 13,256 fall within the Yezidi ethnic group. The frames are not identical across waves: 2011 carries a "Religious belief not stated" category (76,273) alongside "Refused to answer", whereas 2022 replaces the former with "No religion" (17,501) and adds Nestorian, Islam, Judaism, and Krishna as separate columns. Any cross-wave comparison would need an instrument-continuity note; no such comparison is possible subnationally in any event.

## Reuse and licence position

Armstat publishes no open-data licence. The site footer carries three copyright lines, quoted verbatim:

> © Official Website of Statistical Committee RA has been functionning since April 1999,

> © By using the website, please refer to Statistical Committee RA.

> © All rights reserved.

The second line is an attribution request; the third reserves all rights. This is the same posture the project has met for Romania, Slovakia, Canada, Côte d'Ivoire, Iran, Serbia, and Montenegro: no open licence, attribution requested, all rights reserved. The stance that fits precedent is to publish derived summaries (not raw source tables) with Armstat attribution under PI approval, with raw files held in the git-ignored cache. The licence status is `needs_review` pending a PI ruling; no broader licence claim is made here. This point is moot for a subnational build while no marz-level religion data exists.

## Boundaries

The unit set is eleven ADM1 features: the ten marzes (Aragatsotn, Ararat, Armavir, Gegharkunik, Lori, Kotayk, Shirak, Syunik, Vayots Dzor, Tavush) plus the city of Yerevan. A marz join would be trivial — few, stable units — if marz religion data existed.

The task's instruction to verify the geoBoundaries licence field against the actual release metadata proved load-bearing. A prose fetch of the gbOpen page reported "Creative Commons Attribution 2.5 Generic", but the downloaded release metadata JSON records `licenseName` as **None**, with `licenseSource` pointing only at a Wikimedia Commons file page and `boundaryYearRepresented` 2005. The gbOpen ARM ADM1 release (`ARM-ADM1-6114869`, 11 units) therefore does not carry a clean licence field and cannot support a permissive boundary claim as-is.

- **geoBoundaries gbOpen ARM ADM1** ([metadata](https://www.geoboundaries.org/api/current/gbOpen/ARM/ADM1/)): `boundaryID` `ARM-ADM1-6114869`, 11 units, year 2005, `licenseName` None, `licenseSource` a `commons.wikimedia.org/wiki/File` page. Weak provenance.
- **geoBoundaries gbHumanitarian ARM ADM1** ([metadata](https://www.geoboundaries.org/api/current/gbHumanitarian/ARM/ADM1/)): `boundaryID` `ARM-ADM1-56687170`, 11 units, year 2014, `licenseName` None, `licenseSource` `data.humdata.org/dataset/cod-ab-arm` (the OCHA Common Operational Dataset on the Humanitarian Data Exchange). Better provenance path; the licence must be read at the HDX COD-AB dataset, not inferred from geoBoundaries.

The boundary recommendation is to prefer an official Armenian administrative layer (cadastre or Armstat) or the OCHA COD-AB via HDX over the gbOpen Wikimedia-sourced release, and to verify the licence at the upstream source before any claim. Join feasibility is not the constraint; the missing census data is.

## Scope questions for the project lead (recorded neutrally)

These are recorded for a PI ruling, not resolved here.

- **Territorial scope.** The Armenian census covers the Republic of Armenia's marzes and Yerevan. It does not enumerate Nagorno-Karabakh (Artsakh); the 2022 census press release treats "NKR" as an external previous-residence origin for migrants (25,757 people), consistent with its being outside census scope. No NKR religion rows exist in these tables, and the 2023 displacement post-dates the 2022 census. Any product would render only the record Armstat publishes (Israel/Palestine render-the-record precedent).
- **Near-flat majority.** Armenian Apostolic affiliation is roughly 95 percent nationally, so a raw-affiliation choropleth would be almost flat and would carry signal only through the small Yezidi/Sharfadin, Molokan, Russian Orthodox, Evangelical, and Catholic communities. This is the minority-share-metric design question already open for Bangladesh, Cambodia, and Palau (PI task 6). It is moot subnationally while no marz data exists, but it would govern any national card or any microdata build.

## The microdata alternative (out of the published-table scope)

The single route to marz-level religion is a tabulation from census microdata, and it is a different build class. IPUMS-International holds Armenia 10 percent samples for 2001 and 2011, each identifying the province/marz as the smallest geography, and codes RELIGION for 2011 only. A 2011 religion-by-marz table could therefore be tabulated from the 10 percent sample, subject to sampling error, for a single wave, under the IPUMS restricted-access electronic licence (registration and an approved agreement). Armstat's own [Population Census Armenian Sample Datafiles](https://www.armstat.am/en/?nid=210) are the domestic analogue. Pursuing this needs a PI decision on microdata use and on the IPUMS/Armstat licensing, and it would still leave 2001 empty (no religion collected) and 2022 pending microdata release.

## Cached inputs

Downloads are staged under `data/raw/am_census/` (git-ignored). The 2022 chapter archives use current-release filenames (`section_5.7z`, `sector_5.7z`) that Armstat overwrites on each results update; the cached copies and hashes pin the versions read here.

| Cached file | Source URL | SHA-256 |
| --- | --- | --- |
| `census2022_section_5_en.7z` | https://www.armstat.am/file/article/section_5.7z | `8b3b74674c00c03aaa7c00d15a6d766f299389c21e6dc972c823d9bbd8fe603a` |
| `census2022_sector_5_am.7z` | https://www.armstat.am/file/article/sector_5.7z | `008c91762d9fc4fc64034909c7ba622e0bcf9cddece0cf96518daf9af94d09e0` |
| `census2011_table_5_4_religion_99486278.pdf` | https://www.armstat.am/file/doc/99486278.pdf | `dfb26e15513eb395e9cefe2bb1d3cc2832518e69b6c8a8467d3742faae4b1a2c` |
| `census2011_marz_aragatsotn_ch5_doc74.pdf` | https://www.armstat.am/file/doc/74.pdf | `61b75348ab6c3917ce937b4f9406c36621333e8b26068055006283a002da0c05` |
| `census2022_press_release_99542773.pdf` | https://armstat.am/file/doc/99542773.pdf | `5357f060f2fa4cbc27fb82b49fd10397ff246bd405b26c19dff71b7834f2410e` |
| `geoboundaries_arm_adm1_metadata.json` | https://www.geoboundaries.org/api/current/gbOpen/ARM/ADM1/ | `291225d41310c153fe552954ba9d2475667f996b04f875a17e6dc56bff89c9ca` |
| `geoboundaries_arm_adm1_humanitarian_metadata.json` | https://www.geoboundaries.org/api/current/gbHumanitarian/ARM/ADM1/ | `df50ab41e8feabcc9334cce73fd0b8110e997305d70eb4c5c1d6fdb1c118bb3d` |

## Probe-gate result

- **Wave coverage**: partial. Religion exists for 2011 and 2022 nationally; 2001 did not collect religion.
- **Subnational geography**: failed. No published Armstat table gives religion by marz or Yerevan for any wave; the 2011 marz booklets carry ethnicity, not religion; the 2022 marz booklets carry no data files yet; ArmStatBank exposes no such table (API 500, tree not expandable in this probe).
- **National reconciliation**: passed. The 2011 and 2022 national frames reconcile exactly to their published totals.
- **Licence**: `needs_review`. No open licence; footer requests attribution and reserves all rights; derived-summaries-with-attribution stance recommended pending PI confirmation.
- **Boundaries**: available at ADM1 (11 units) but licence-unclear at the geoBoundaries gbOpen release (`licenseName` None); prefer an official Armenian layer or the OCHA COD-AB via HDX with upstream licence verification.
- **Build recommendation**: HOLD. No subnational religion series is publishable from Armstat tables. Options for the PI: withhold as a documented exclusion (single national frame, no time series, no subnational variation); ship a national-context card only; or authorise the IPUMS 2011 microdata route as a separate single-wave, sampling-based build under restricted licensing.
