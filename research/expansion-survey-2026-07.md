# Expansion Survey, July 2026

This note ranks the next tranche by wave depth, route quality, and indicator
richness. The strongest records have repeated subnational religion measures,
downloadable official routes, usable boundaries, and more than one construct
where possible. New Zealand, Vanuatu, and the other live region pages under
`apps/regions/` are excluded from the ranking.

The SPC StatHub probe did not locate a religion-specific aggregate census
dataflow. The public explorer is at https://stats.pacificdata.org/, the SDMX
search endpoint used was
https://stats-sfs.pacificdata.org/api/search?query=religion&lang=en&rows=200,
and the terms page is https://pacificdata.org/terms-use. The Pacific records
below therefore rely on national census pages and Pacific Data Hub (PDH)
microdata catalogues until SPC exposes a reusable aggregate religion table.

## Ranked register

| ISO2 | Name | Rank | Construct | Smallest public unit | Wave years span | Access | Licence class | Boundary source | First visualisation |
| --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- |
| CH | Switzerland | 1 | census affiliation; structural-survey affiliation and practice | canton now; commune/canton for historical extraction | 1850-2000; 2010-2024 | open web/API | FSO terms; confirm reuse | swisstopo swissBOUNDARIES3D, https://www.swisstopo.admin.ch/en/landscape-model-swissboundaries3d | Canton affiliation and practice from pooled structural-survey tables, then historical census panels. |
| AT | Austria | 2 | census affiliation; 2021 survey affiliation | federal state | 1951-2001; 2021 | open web/PDF | Statistics Austria terms | Eurostat GISCO administrative units, https://ec.europa.eu/eurostat/web/gisco/geodata/administrative-units | Federal-state affiliation series with 2011 recorded as a gap. |
| NL | Netherlands | 3 | survey affiliation and participation; historical census affiliation | COROP/province now; municipality historically | 1830-1971; 2010-2025 | open API/web | CBS/portal terms | CBS geographic data, https://www.cbs.nl/nl-nl/dossier/nederland-regionaal/geografische-data | COROP affiliation and regular attendance, with historical census panels kept separate. |
| SG | Singapore | 4 | census and general-household-survey affiliation | planning area/subzone for 2020 route; national for long series | 1980-2020 | open web/TableBuilder | Singapore government terms; confirm table terms | data.gov.sg and URA boundaries, https://data.gov.sg/ | Planning-area 2020 religion if extracted cleanly; national 1980-2020 panels alongside it. |
| IL | Israel | 5 | registry-based religion/population group; survey religiosity possible | locality/district route to pin | annual modern series; 2020-2024 verified path | open web/StatBank | CBS terms; confirm reuse | geoBoundaries ISR ADM2, https://www.geoboundaries.org/api/current/gbOpen/ISR/ADM2/ | District or locality official religion/population-group shares after geographic scope is settled. |
| HU | Hungary | 6 | census affiliation | settlement | 2001-2022 | open web export | HCSO terms | GISCO LAU, https://ec.europa.eu/eurostat/web/gisco/geodata/administrative-units | Settlement religion/no-religion shares for 2001, 2011, and 2022. |
| HR | Croatia | 7 | census affiliation | town/municipality | 2001-2021 | open XLS/web/PDF | DZS terms | GISCO LAU, https://ec.europa.eu/eurostat/web/gisco/geodata/administrative-units | Town/municipality affiliation for 2001, 2011, and 2021. |
| LT | Lithuania | 8 | census religious community indicated | municipality | 2001-2021 | open web export | Official Statistics Portal terms | GISCO LAU, https://ec.europa.eu/eurostat/web/gisco/geodata/administrative-units | Municipality affiliation for 2001, 2011, and 2021. |
| EE | Estonia | 9 | census affiliation, age 15+ | settlement region in 2021 | 2000-2021 | open PxWeb/API | CC BY-SA 4.0 | Estonian Land Board/GISCO, https://geoportaal.maaamet.ee/eng/ | 2021 settlement-region affiliation, with earlier waves after geography harmonisation. |
| RS | Serbia | 10 | census religion | municipality/city | 2002-2022 | open database/web | SORS terms | geoBoundaries SRB ADM2, https://www.geoboundaries.org/api/current/gbOpen/SRB/ADM2/ | Municipality/city affiliation for 2011 and 2022, then 2002 if extractable. |
| BG | Bulgaria | 11 | census confession/religious affiliation | district now; municipality route to confirm | 2001-2021; historical national | open web/export | NSI terms | GISCO LAU, https://ec.europa.eu/eurostat/web/gisco/geodata/administrative-units | District affiliation first; municipality only after Infostat export is pinned. |
| NO | Norway | 12 | Church of Norway membership; registered Christian-community membership | diocese for Church of Norway | 2005-2026 | open JSON-stat API | Statistics Norway terms | Geonorge, https://kartkatalog.geonorge.no/ | Diocese Church of Norway membership, with other registered communities as national context. |
| TV | Tuvalu | 13 | census affiliation metadata/report tables | island | 2002-2022 | open web/PDF; PDH metadata | website/PDH terms | geoBoundaries TUV ADM1, https://www.geoboundaries.org/api/current/gbOpen/TUV/ADM1/ | Island affiliation for 2012, 2017, and 2022 after report extraction. |
| TO | Tonga | 14 | census affiliation | village in 2021; division/district roll-ups | 1996-2021 metadata; 2021 direct table | open XLSX; PDH metadata | website/PDH terms | geoBoundaries TON ADM1, https://www.geoboundaries.org/api/current/gbOpen/TON/ADM1/ | Village 2021 affiliation; add older waves only if comparable subnational tables surface. |
| MU | Mauritius | 15 | census affiliation | national verified; district route unresolved | 1990-2022 national; 2011/2022 current route | open web/PDF | licence not stated | geoBoundaries MUS ADM1, https://www.geoboundaries.org/api/current/gbOpen/MUS/ADM1/ | District affiliation only if table reports expose religion by district. |
| FJ | Fiji | 16 | census affiliation | province | 1996-2017 metadata; 2007 direct table | open PDF; PDH metadata | website/PDH terms | geoBoundaries FJI ADM1, https://www.geoboundaries.org/api/current/gbOpen/FJI/ADM1/ | Province 2007 affiliation, with 1996 and 2017 only after table recovery. |
| PW | Palau | 17 | census affiliation metadata | state | 2005-2020 | PDH metadata; table extraction needed | PDH terms | geoBoundaries PLW ADM1, https://www.geoboundaries.org/api/current/gbOpen/PLW/ADM1/ | State affiliation for 2005, 2015, and 2020 after extraction. |
| MH | Marshall Islands | 18 | census affiliation metadata | atoll/island | 1999-2021 | PDH metadata; table extraction needed | PDH terms | geoBoundaries MHL ADM1, https://www.geoboundaries.org/api/current/gbOpen/MHL/ADM1/ | Atoll or island affiliation for 2011 and 2021 after extraction. |
| KI | Kiribati | 19 | census affiliation metadata; HIES affiliation | island | 2015-2023 | PDH metadata; licensed survey | PDH terms | geoBoundaries KIR ADM1, https://www.geoboundaries.org/api/current/gbOpen/KIR/ADM1/ | Island affiliation for 2015 and 2020 after aggregate extraction. |
| WS | Samoa | 20 | census affiliation in reports/workbooks, subnational route pending | national verified; district/village pending | 2006-2021 | open web/XLSX; PDH metadata | website/PDH terms | geoBoundaries WSM ADM1, https://www.geoboundaries.org/api/current/gbOpen/WSM/ADM1/ | District or village 2021 map only if workbook cross-tabs expose geography. |
| SB | Solomon Islands | 21 | census affiliation metadata | province route unverified | 1986-2019 | PDH metadata; public table not pinned | PDH terms | geoBoundaries SLB ADM1, https://www.geoboundaries.org/api/current/gbOpen/SLB/ADM1/ | Province 2009 affiliation only after public report or reusable extract is secured. |
| FM | Federated States of Micronesia | 22 | census affiliation metadata | state for 2000/2010 route | 2000-2022 | PDH metadata | PDH terms | geoBoundaries FSM ADM1, https://www.geoboundaries.org/api/current/gbOpen/FSM/ADM1/ | State affiliation for 2000 and 2010; 2022 only if variables are released. |
| CK | Cook Islands | 23 | census affiliation metadata | island route unresolved | 2011-2021 | licensed/open metadata | PDH terms | Cook Islands Statistics Office route to locate, https://stats.gov.ck/ | Island affiliation after aggregate tables and boundaries are licensed. |
| ES | Spain | 24 | survey affiliation and practice | autonomous community | 2012-2019 | open microdata | CIS terms | IGN portal, https://www.ign.es/web/ign/portal | Autonomous-community practice/affiliation as a practice-lane product. |
| FI | Finland | 25 | administrative religious-community membership; Lutheran membership route | national verified; parish route pending | 1990-2025 | open PxWeb/web | Statistics Finland/church terms | GISCO LAU, https://ec.europa.eu/eurostat/web/gisco/geodata/administrative-units | No map until subnational membership data are pinned. |
| LV | Latvia | 26 | religious-organisation register; no census affiliation found | organisation address/current municipality | 2000-2021 census lacks religion | open web/PxWeb/register | CSB/ministry/register terms | GISCO LAU, https://ec.europa.eu/eurostat/web/gisco/geodata/administrative-units | Organisation-presence map only, labelled separately from affiliation. |
| PG | Papua New Guinea | 27 | census metadata; licensed survey affiliation | no public religion map route | 2011-2023 | PDH metadata; licensed survey | PDH terms | geoBoundaries PNG ADM1, https://www.geoboundaries.org/api/current/gbOpen/PNG/ADM1/ | No religion map until a public province table is released. |
| IS | Iceland | 28 | administrative religion/life-stance membership | national | 1998-2026 | open PxWeb | Statistics Iceland terms | National Land Survey of Iceland, https://www.lmi.is/ | No subnational map from the current public route. |

## Candidate notes

### CH Switzerland

Data route: FSO religion page, https://www.bfs.admin.ch/bfs/en/home/statistics/population/languages-religions/religions.html, and FSO PX-Web, https://www.pxweb.bfs.admin.ch/. The record combines census affiliation through 2000 with the post-2010 structural survey, which also carries practice indicators; use canton first and defer commune history until merger concordances are ready. The caution is comparability: structural-survey estimates are sample-based, often age 15+, and require confidence intervals.

### AT Austria

Data route: Statistics Austria 2021 religion release, https://www.statistik.at/fileadmin/announcement/2022/05/20220525Religionszugehoerigkeit2021.pdf, and the historical table portal, https://www.statistik.at/. The usable subnational unit is federal state across 1951, 1961, 1971, 1981, 1991, 2001, and 2021. Label the 2021 measure as survey affiliation rather than a pure register count because it complements the register-based census framework.

### NL Netherlands

Data route: CBS StatLine, https://opendata.cbs.nl/statline/, and the historical census portal, https://www.volkstellingen.nl/. The modern value is indicator richness: CBS releases affiliation and regular attendance by COROP or province in selected outputs, while the census affiliation series ends in 1971. Keep historical census counts, modern survey estimates, and church membership or attendance as separate constructs.

### SG Singapore

Data route: SingStat religion theme, https://www.singstat.gov.sg/find-data/explore-data-themes/population/religion, SingStat TableBuilder, https://tablebuilder.singstat.gov.sg/, and SingStat geographic distribution theme, https://www.singstat.gov.sg/find-data/explore-data-themes/population/geographic-distribution. The national series covers 1980, 1990, 2000, 2010, 2015, and 2020; 2020 planning-area/subzone tables appear to be the mappable route. Religion is for the resident population, typically age 15+, and small-area minority disclosure needs review.

### IL Israel

Data route: CBS population subject page, https://www.cbs.gov.il/en/subjects/Pages/Population.aspx, and StatBank, https://statbank.cbs.gov.il/. The substantive value is high because official religion/population-group data are registry-based and annual, with possible locality or district geography and separate Jewish religiosity survey indicators. The survey must record the unresolved scope question for East Jerusalem, Golan, and West Bank settlements; the project lead should decide the map geography before any product exists.

### HU Hungary

Data route: 2022 census database, https://nepszamlalas2022.ksh.hu/en/database/, and HCSO census releases, https://www.ksh.hu/nepszamlalas2022. The route should expose settlement affiliation for 2001, 2011, and 2022. Non-response is large in 2022. No-religion, unknown, and refusal categories therefore need to remain in the data model rather than being folded into a residual.

### HR Croatia

Data route: DZS 2021 census, https://dzs.gov.hr/en, DZS 2011 census, https://web.dzs.hr/Eng/censuses/census2011/censuslogo.htm, and DZS 2001 census, https://web.dzs.hr/Eng/censuses/Census2001/census.htm. The candidate has a clean three-wave local-government series at town/municipality level. The main work is direct file pinning and local-government concordance.

### LT Lithuania

Data route: Official Statistics Portal indicator analysis, https://osp.stat.gov.lt/statistiniu-rodikliu-analize#/, and census releases, https://osp.stat.gov.lt/gyventoju-ir-bustu-surasymai1. The expected unit is municipality for 2001, 2011, and 2021. The 2021 electronic-census/statistical-study route needs a clear universe note before comparison with earlier census waves.

### EE Estonia

Data route: 2021 table RL21454, https://andmed.stat.ee/en/stat/rahvaloendus__rel2021__rahvastiku-demograafilised-ja-etno-kultuurilised-naitajad__usk/RL21454, 2011 table RL0451, https://andmed.stat.ee/en/stat/rahvaloendus__rel2011__rahvastiku-demograafilised-ja-etno-kultuurilised-naitajad__usk/RL0451, and the 2000 census database route, https://andmed.stat.ee/en/stat/rahvaloendus__rel2000. The route is excellent for 2021, but the public geography differs across waves. The universe is age 15+, and rounding should be preserved.

### RS Serbia

Data route: dissemination database, https://data.stat.gov.rs/?caller=SDDB&languageCode=en-US, 2022 census portal, https://popis2022.stat.gov.rs/en-US/, and 2011 census portal, https://popis2011.stat.rs/. The modern series can support municipality/city maps for 2011 and 2022, with 2002 likely extractable. Kosovo is outside the modern Serbian census geography and should stay outside this country build unless the project lead creates a separate `xk` route.

### BG Bulgaria

Data route: Census 2021 portal, https://census2021.bg/, and NSI Infostat, https://infostat.nsi.bg/infostat/. District affiliation is the safe first unit; municipality mapping depends on the exact export path for 2001, 2011, and 2021. The recent religion question is voluntary, and non-response is part of the construct.

### NO Norway

Data route: SSB Church of Norway members API, https://data.ssb.no/api/v0/en/table/DNKMedlemmer, and registered Christian communities API, https://data.ssb.no/api/v0/en/table/MedlemKristTrus. The Church of Norway table gives a long annual diocese series from 2005, while other registered-community tables are national. Treat this route as a membership lane rather than a census-affiliation lane.

### TV Tuvalu

Data route: Tuvalu census portal, https://stats.gov.tv/census/, PDH 2017 census, https://microdata.pacificdata.org/index.php/catalog/269, and PDH 2012 census, https://microdata.pacificdata.org/index.php/catalog/50. The attractive map is island-level affiliation for 2012, 2017, and 2022. The blocker is extraction of direct island religion tables and any small-count suppression.

### TO Tonga

Data route: 2021 religion workbook, https://tongastats.gov.to/download/266/general-tables/7664/4-religion.xlsx, census reports, https://tongastats.gov.to/census-2/population-census-3/census-report-and-factsheet/, and PDH 1996 census, https://microdata.pacificdata.org/index.php/catalog/182. The 2021 route is unusually strong for the Pacific because it reaches village rows. Earlier waves need comparable subnational tables before Tonga becomes a longitudinal map.

### MU Mauritius

Data route: 2022 census page, https://statsmauritius.govmu.org/Pages/Censuses%20and%20Surveys/Census/census_2022.aspx, and main-results PDF, https://statsmauritius.govmu.org/Documents/Statistics/ESI/2022/EI1687/2022%20Population%20Census_Main%20Results_18112022.pdf. The public record confirms the long census frame and current table-report route, but district religion tables were not pinned. Religion must not be used as an ethnic proxy, especially given the constitutional and census history around ethnicity.

### FJ Fiji

Data route: 2007 province table, https://www.statsfiji.gov.fj/download/117/01_province-of-enumeration/686/03_relationship-ethnicity-and-religion-by_province-of-enumeration_fiji-2007.pdf, PDH 2007 census, https://microdata.pacificdata.org/index.php/catalog/241, and PDH 1996 census, https://microdata.pacificdata.org/index.php/catalog/237. Fiji has a real province map route for 2007. The 1996 and 2017 province religion tables still need recovery.

### PW Palau

Data route: PDH 2020 census, https://microdata.pacificdata.org/index.php/catalog/866, PDH 2015 census, https://microdata.pacificdata.org/index.php/catalog/458, and PDH 2005 census, https://microdata.pacificdata.org/index.php/catalog/27. State-level affiliation is plausible for three waves, but the record is metadata-first. Small states may need grouped display for minor religions.

### MH Marshall Islands

Data route: PDH 2021 census, https://microdata.pacificdata.org/index.php/catalog/812, PDH 2011 census, https://microdata.pacificdata.org/index.php/catalog/22, and PDH 1999 census, https://microdata.pacificdata.org/index.php/catalog/317. Atoll or island mapping is plausible for 2011 and 2021. Public aggregate tables need extraction before the route is buildable.

### KI Kiribati

Data route: PDH 2020 census, https://microdata.pacificdata.org/index.php/catalog/767, PDH 2015 census, https://microdata.pacificdata.org/index.php/catalog/199, and PDH 2023 HIES, https://microdata.pacificdata.org/index.php/catalog/881. The census route is affiliation metadata by island; the HIES route is a separate survey construct. Category changes among Uniting, Protestant, Catholic, and smaller groups need a harmonisation table.

### WS Samoa

Data route: Samoa census downloads, https://www.sbs.gov.ws/census/, 2021 tables workbook, https://www.sbs.gov.ws/wp-content/uploads/2022/12/CensusTablesEXCELFiles.xlsx, and PDH 2011 census, https://microdata.pacificdata.org/index.php/catalog/250. The national time series is promising, but district or village religion cross-tabs were not pinned. Do not build a map until the workbook exposes geography for religion.

### SB Solomon Islands

Data route: PDH 2009 census, https://microdata.pacificdata.org/index.php/catalog/31, PDH 1999 census, https://microdata.pacificdata.org/index.php/catalog/396, and PDH 1986 census, https://microdata.pacificdata.org/index.php/catalog/349. The metadata confirm religion variables, but public province tables were not pinned. The 2019 religion route remains unresolved.

### FM Federated States of Micronesia

Data route: PDH 2022 census, https://microdata.pacificdata.org/index.php/catalog/806, PDH 2010 census, https://microdata.pacificdata.org/index.php/catalog/9, and PDH 2000 census, https://microdata.pacificdata.org/index.php/catalog/109. State-level maps are plausible for 2000 and 2010; the 2022 record did not expose religion variables in the survey card. Current-round absence lowers the rank.

### CK Cook Islands

Data route: PDH 2021 census, https://microdata.pacificdata.org/index.php/catalog/883, PDH 2016 census, https://microdata.pacificdata.org/index.php/catalog/275, PDH 2011 census, https://microdata.pacificdata.org/index.php/catalog/7, and Cook Islands 2021 census page, https://stats.gov.ck/2021-census-of-population-and-dwellings/. This is a Pacific-priority candidate with weak route quality: the 2021 record is licensed, aggregate island tables need recovery, and an open island boundary file still needs a citable source.

### ES Spain

Data route: CIS data bank, https://www.cis.es/, and INE census portal, https://www.ine.es/. Boundary route: IGN portal, https://www.ign.es/web/ign/portal. Spain has no census religion route. It therefore belongs in the practice lane through CIS macrobarometers at autonomous-community level. Use weighted survey estimates and uncertainty, never census-style counts.

### FI Finland

Data route: StatFin population database, https://pxdata.stat.fi/PxWeb/pxweb/en/StatFin/StatFin__vaerak/, and church statistics, https://www.kirkontilastot.fi/. Table 11rx gives national religious-community membership from 1990 to 2025. A parish or municipality route for Lutheran membership may exist, but it was not pinned.

### LV Latvia

Data route: Central Statistical Bureau, https://data.stat.gov.lv/, Ministry of Justice, https://www.tm.gov.lv/en, and Register of Enterprises, https://www.ur.gov.lv/en/. The record is weak for this project because modern census religion tables were not found. A current religious-organisation map may be useful. It would measure organisation presence rather than population affiliation.

### PG Papua New Guinea

Data route: PDH 2023 census, https://microdata.pacificdata.org/index.php/catalog/792, PDH 2022 socio-demographic survey, https://microdata.pacificdata.org/index.php/catalog/872, and PDH 2011 census, https://microdata.pacificdata.org/index.php/catalog/583. The public route is too weak for a religion map: the survey is licensed, and public subnational census religion tables were not found. Record PNG as high substantive interest with no buildable route yet.

### IS Iceland

Data route: Statistics Iceland PX-Web, https://px.hagstofa.is/pxen/pxweb/en/. The route gives annual national membership in religious and life-stance organisations from 1998 to 2026. It does not meet the subnational map brief unless a municipal table is found.

## Recommended Next Five

1. **Switzerland** - strongest overall record: deep census history, current affiliation and practice indicators, and official boundaries.
2. **Austria** - many federal-state waves and a clear first map, with the 2021 survey caveat made explicit.
3. **Netherlands** - best multi-indicator European practice/affiliation candidate, with historical census context.
4. **Singapore** - named candidate with a strong national series and a plausible planning-area 2020 route.
5. **Israel** - named candidate with high-value annual official data, conditional on a project-lead decision about geographic scope and sensitivity.

The strongest Pacific-first follow-up is **Tonga** because the 2021 village
workbook is already downloadable. The stronger longitudinal Pacific bet is
**Tuvalu**, if the island religion tables can be extracted from the census
reports.
