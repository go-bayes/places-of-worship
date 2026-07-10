# Global zero-coverage audit

## Scope and method

This audit covers the 193 United Nations (UN) member states plus Taiwan, Kosovo, and Palestine. It removes every country already live under `apps/regions/` and every country named in `research/country-survey.md` or `research/expansion-survey-2026-07.md`. The resulting audit universe contains 53 countries.

The classes describe official religion evidence relevant to population mapping. Class A requires a census question, an administrative register, or an official survey with a subnational estimation domain. Class B records official national totals without a subnational route. Class C records a documented absence caused by an omitted question, a discontinued series, a legal coding rule, or the absence of a usable census. Class D records an unresolved case after the sources below were examined. “Has data” means a published output or a documented variable with a recoverable route. Undisclosed administrative fields do not qualify. Registered organisations and religious institutions remain distinct from population affiliation.

`Verified route` means that a national office table, report, questionnaire, or catalogue was located. `Pointer only` means that an authoritative compilation identifies the variable and geography, while a reusable national-office table still needs to be pinned. The principal meta-sources were the [UN Statistics Division (UNSD) census collection](https://unstats.un.org/unsd/demographic-social/products/dyb/dybcensusdata/), [UNSD census questionnaires](https://unstats.un.org/unsd/demographic-social/census/document-resources/), [IPUMS International RELIGION availability](https://international.ipums.org/international-action/variables/RELIGION/ajax_enum_text), and [IPUMS Demographic and Health Surveys (DHS) RELIGION availability](https://www.idhsdata.org/idhs-action/variables/RELIGION). Pew and other external estimates were used only to locate possible official sources; they do not support an A classification.

## Summary

| UN region | A: subnational | B: national only | C: zero official | D: unknown | Audit total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Africa | 19 | 1 | 4 | 1 | 25 |
| Americas | 6 | 0 | 0 | 0 | 6 |
| Asia | 4 | 1 | 12 | 0 | 17 |
| Europe | 2 | 1 | 0 | 2 | 5 |
| Oceania | 0 | 0 | 0 | 0 | 0 |
| **Total** | **31** | **3** | **16** | **3** | **53** |

## A. Has subnational religion data

### Africa

- **Angola (AO)** — official health and indicators survey; 2015–2016; provinces, urban/rural; **verified route**: INE catalogue exposes religion, attendance, province, and province-representative sampling in the [Inquérito de Indicadores Múltiplos e de Saúde](https://andine.ine.gov.ao/nada/index.php/catalog/9).
- **Burkina Faso (BF)** — census affiliation; 1996, 2006, 2019; regions, with lower census geography available for extraction; **verified route**: the 2019 [INSD final report](https://www.insd.bf/fr/node/1619) publishes religion by region.
- **Cabo Verde (CV)** — voluntary census religion or spirituality for residents aged 15+; 2010 and 2021; municipality; **pointer only**: the [2021 enumerator manual](https://www.ine.cv/censo2020/wp-content/uploads/2021/06/MANUAL-RECENSEADOR_VERS%C3%83O-FORMATADO.pdf) confirms the question and the INE census file carries municipality. The direct municipality cross-tab still needs pinning.
- **Central African Republic (CF)** — DHS affiliation; 1994–1995; survey regions or prefecture groups; **pointer only**: IPUMS DHS identifies RELIGION and the DHS sample carries subnational domains. Recover the national statistical office final report and recode the historical geography.
- **Chad (TD)** — DHS affiliation; 1996–1997 to 2014–2015; survey regions; **pointer only**: IPUMS DHS identifies repeated RELIGION waves. Use the Institut National de la Statistique, des Études Économiques et Démographiques/DHS files and preserve changing regional boundaries.
- **Comoros (KM)** — DHS affiliation; 2012; island; **pointer only**: IPUMS DHS identifies RELIGION; use the Institut National de la Statistique et des Études Économiques et Démographiques/DHS file and island strata.
- **Republic of the Congo (CG)** — DHS affiliation; 2005 and 2011–2012; department; **pointer only**: IPUMS DHS identifies both waves; pin the Institut National de la Statistique files before estimating departments.
- **Democratic Republic of the Congo (CD)** — DHS affiliation; 2007 and 2013–2014; survey province; **verified route** for the latest report: the national Institut National de la Statistique hosts the [2013–2014 DHS report](https://ins-rdc.org/sites/default/files/eds%202013_2014.pdf). Use the survey geography rather than current provinces.
- **Côte d’Ivoire (CI)** — census affiliation; 1988–2021; sub-prefecture or commune, region, and district in 2021; **verified but blocked route**: the official [2021 religion tables](https://rp2021.anstat.ci/wp-content/uploads/2023/09/TABLEAUX-11_DE-BASES_RP-RELIGION.pdf) publish local rows, but 31 local category sums exceed their printed resident totals by a combined 41 people. The [country probe](countries/ci/route-probe.md) records the failed reconciliation gate.
- **Equatorial Guinea (GQ)** — DHS affiliation; 2011; island/mainland survey domains and provinces where sample size permits; **pointer only**: the [DHS final report](https://www.dhsprogram.com/publications/publication-FR271-DHS-Final-Reports.cfm) confirms the official survey; pin the national office microdata and domain definitions.
- **Eritrea (ER)** — DHS affiliation; 1995 and 2002; zobas; **pointer only**: the [2002 DHS report](https://www.dhsprogram.com/pubs/pdf/FR137/FR137.pdf) includes religion and the survey was implemented by the National Statistics and Evaluation Office; extract zoba estimates with survey uncertainty.
- **Gabon (GA)** — DHS affiliation; 2000 and 2012; province; **pointer only**: IPUMS DHS identifies both RELIGION waves; pin the Direction Générale de la Statistique/DHS files.
- **Guinea (GN)** — census affiliation; 1983, 1996, 2014; region and prefecture; **pointer only**: IPUMS International and the [2014 census metadata](https://webapps.ilo.org/surveyLib/index.php/catalog/8774/variable/FA_GIN_CENSUS_2014_FULL/VA18?name=religiond) identify the variable; locate the Institut National de la Statistique prefecture table.
- **Guinea-Bissau (GW)** — census affiliation; 2009; region and Autonomous Sector of Bissau; **verified route**: the national office [sociocultural report](https://www.stat-guinebissau.com/Menu_principal/IV_RGPH/rgph1/caracteristicas_socio_cultural.pdf) analyses religion from the census and reports regional differentiation.
- **Madagascar (MG)** — DHS affiliation; 1992–2021; survey region; **pointer only**: IPUMS DHS identifies repeated RELIGION waves; use INSTAT/DHS microdata and the wave-specific regional concordance.
- **Mali (ML)** — census affiliation; 2009 and 2022; region; **verified route**: INSTAT publishes [2022 religion by region](https://www.instat-mali.org/laravel-filemanager/files/shares/rgph/rapport-etat-structure-population-rgph5-rgph.pdf) and a comparable [2009 analysis](https://www.instat-mali.org/laravel-filemanager/files/shares/rgph/rastr09_rgph.pdf).
- **Niger (NE)** — DHS affiliation; 1992, 1998, 2006; survey region; **pointer only**: IPUMS DHS identifies RELIGION through 2006. Pin the Institut National de la Statistique files and do not infer religion from later DHS waves that omit the variable.
- **São Tomé and Príncipe (ST)** — DHS affiliation; 2008; district; **pointer only**: IPUMS DHS identifies RELIGION and district geography; use the Instituto Nacional de Estatística/DHS file, then inspect the [2012 census district catalogue](https://www.ine.st/index.php/publicacao/documentos/category/71-dados-distritais-e-nacional-recenseamento-2012) for a later cross-tab.
- **Sudan (SD)** — DHS affiliation; 1989; survey region in the former Sudan geography; **pointer only**: IPUMS DHS identifies RELIGION; this route predates South Sudan’s independence and cannot represent present-day Sudan without a documented geographic restriction.

### Americas

- **Antigua and Barbuda (AG)** — census affiliation; 1991, 2001, 2011; parish and island identifiers in census records; **pointer only**: the Statistics Division [2011 tables](https://statistics.gov.ag/wp-content/uploads/2017/10/Census-2011-Book-of-Statistical-Tables-I.pdf) confirm religion, while a parish cross-tab or microdata extract still needs pinning.
- **Dominica (DM)** — census affiliation; 1991, 2001, 2011; parish; **pointer only**: the official [time series](https://stats.gov.dm/subjects/demographic-statistics/population-by-religion-1991-2001-and-2011/) and [2011 questionnaire](https://stats.gov.dm/wp-content/uploads/2019/06/Population_and_Housing_Census_Questionnaire_2011.pdf) confirm religion and parish coding; extract their joint distribution.
- **Grenada (GD)** — census affiliation; 2001 and 2011; parish; **pointer only**: the official census portal publishes [religious composition](https://stats.gov.gd/subjects/population-2/non-institution-population-in-private-dwellings-by-religious-composition-2011-and-2001-and-percentage-change/) and parish outputs separately; pin the joint table or census microdata.
- **Saint Kitts and Nevis (KN)** — census or official household-survey affiliation; 2001–2011 span; island and parish; **pointer only**: the national statistical office route confirms religion in official survey reporting. A reusable 2011 island/parish table remains unpinned.
- **Saint Lucia (LC)** — census affiliation; 2001–2022; district; **verified route**: the [2022 census report](https://stats.gov.lc/wp-content/uploads/2024/08/StLucia-Provisional-Census-Report-2022-Release-1Rev1.pdf) contains Table D.2, religion by district.
- **Saint Vincent and the Grenadines (VC)** — census affiliation; 1980, 1991, 2001, 2012; census division; **pointer only**: the official [four-wave religion table](https://stats.gov.vc/subjects/population-and-demography/population-by-religious-denomination-and-sex-1980-to-2012/) and [census-division map](https://stats.gov.vc/data/maps/) establish both components; pin their joint extract.

### Asia

- **Bhutan (BT)** — administrative counts of religious institutions and monuments; annual 2017–2019 span located; dzongkhag; **verified route**: National Statistics Bureau [Dzongkhag at a Glance](https://www.nsb.gov.bt/publications/insights/dzongkhag-at-a-glance/) reports both indicators. This route measures institutions rather than population affiliation.
- **Iran (IR)** — census affiliation in recognised categories; 1956–2016; province; **verified route**: the 2016 Statistical Centre table is indexed as “Population by Province and Religion”, and [UNSD records the national census totals](https://data.un.org/Data.aspx?d=POP&f=tableCode%3A28%3BcountryCode%3A364). The route excludes unrecognised identities, including the Bahá’í population, from named categories.
- **Iraq (IQ)** — broad census religion; 2024; governorate; **pointer only**: the national [Commission of Statistics and GIS census portal](https://cosit.gov.iq/ar/1234-2019-09-05-07-53-20) carries governorate outputs, and the census collected broad religion while omitting sect and ethnicity. A governorate-by-religion release was not located.
- **Palestine (PS)** — census affiliation; 1997, 2007, 2017; governorate; **verified route**: the Palestinian Central Bureau of Statistics publishes [2017 population by governorate and religion](https://www.pcbs.gov.ps/portals/_pcbs/PressRelease/Press_En_Preliminary_Results_Report-en-with-tables.pdf). The coverage note for Jerusalem and the distinct West Bank/Gaza geographies must remain attached.

### Europe

- **Belarus (BY)** — state register of religious organisations and communities; current register, with a 2024 pre-re-registration total; oblast and Minsk City through registered addresses; **pointer only**: use the Commissioner for Religious and Ethnic Affairs register. The 2024 compulsory re-registration changed the universe, requiring a dated extract and a before/after break.
- ~~**Liechtenstein (LI)** — census affiliation; 1980–2020, with censuses every five years in the recent series; municipality; **verified route**: Statistics Liechtenstein provides table 213.001d, population by religion and municipality, on its [population-structure page](https://www.statistikportal.li/de/themen/bevoelkerung/bevoelkerungsstruktur).~~ **Built route:** Statistics Liechtenstein table 213.001d and its versioned population-structure workbooks provide exact national and municipality counts for the 2010, 2015, and 2020 census-affiliation waves across all 11 municipalities and all 11 published categories. The [route probe](countries/li/route-probe.md) explains why the archival 1980, 1990, and 2000 `Wohnbevölkerung` tables do not extend this `Ständige Bevölkerung` product.

## B. Has national-only religion data

### Africa

- **Mauritania (MR)** — official census/administrative classification of citizens as Muslim; latest census 2023, with the published religion figure inherited from the legal classification; national only; route: [ANSADE RGPH-5 publications](https://admin.ansade.mr/publications-rgph-5/). The indicator does not measure private affiliation or religious minorities among non-citizens.

### Asia

- **Bahrain (BH)** — census religion grouped as Muslim/other; 2010 and 2020; national by nationality and sex; route: the official [2020 open-data table](https://www.data.gov.bh/explore/dataset/population-by-religion-nationality-and-sex-census-2020/). No governorate-by-religion table was located, and the census does not publish the Sunni/Shia division.

### Europe

- **Andorra (AD)** — official public-research survey affiliation and religiosity; 2005–2006 World Values Survey module; national sample; route: Andorra Recerca + Innovació’s [Centre de Recerca Sociològica report](https://www.iea.ad/publicacions-cres/monografies/92-cres/publicacions/monografies/651-andorra-a-l-enquesta-mundial-de-valors). No parish estimation domain was documented.

## C. Zero official religion data

### Africa

- **Algeria (DZ)** — population censuses do not ask religion; the constitution names Islam as the state religion, and official statistical releases provide no affiliation series. The record therefore contains legal status and external estimates without an official population measure; route examined: Office National des Statistiques census outputs and UNSD questionnaires.
- **Djibouti (DJ)** — the 2009 census and current official demographic outputs provide no religion table; government pages repeat an overwhelming-Muslim percentage without a statistical method or tabulation. The record therefore offers an official description rather than official religion data; route examined: [government presentation](https://www.egouv.dj/sousmenu/sousmenu_selected_presentation/5/3) and census metadata.
- **Libya (LY)** — the last full census was 2006 and its official tables do not publish religion; later census plans were interrupted by conflict. Municipal household surveys supported by the national system also provide no religion variable located in this audit; route examined: Bureau of Statistics and Census via the [UNFPA population-data programme](https://libya.unfpa.org/en/topics/population-data-and-statistics).
- **Somalia (SO)** — the 1975 census released limited results, the 1985–1986 census was never released, and the 2014 Population Estimation Survey plus later health surveys omit population affiliation. Conflict and the absence of a completed modern census explain the zero; route: the official/UN [Population Estimation Survey record](https://somalia.un.org/en/33489-population-estimation-survey-report) and the [Somali National Bureau of Statistics survey catalogue](https://nbs.gov.so/surveys/).

### Asia

- **Afghanistan (AF)** — no complete nationwide census exists, and the former Central Statistics Office did not track disaggregated religious population data. Security conditions and risk to concealed minorities prevent an official affiliation series; the official route examined was the census-like provincial socio-demographic survey programme.
- **China (CN)** — national population censuses, including 2020, do not ask religious affiliation. Administrative counts cover registered venues and personnel under state-recognised religions, leaving population affiliation, unregistered practice, and no religion outside an official statistical series; route examined: the [National Bureau of Statistics 2020 census releases](https://www.stats.gov.cn/english/PressRelease/202105/t20210510_1817187.html).
- **Kuwait (KW)** — a religion item appears in the 1970 census questionnaire, while the 2011 census archive and 2021 register-census catalogue publish no religion table. Current official population releases cover nationality, sex, age, and residence without affiliation; route examined: the [Central Statistical Bureau census catalogue](https://census.csb.gov.kw/CensusData_EN).
- **North Korea (KP)** — the 2008 census questionnaire contains no religion item, and no later official affiliation survey or register table was located. The documented route ends at the [UNSD-hosted 2008 questionnaire](https://unstats.un.org/unsd/demographic/sources/census/quest/PRK2008en.pdf).
- **Maldives (MV)** — citizenship is legally restricted to Muslims, and the 2022 census releases do not measure religion for citizens or foreign residents. The legal rule substitutes for a measured distribution; route examined: the [2022 census results catalogue](https://statisticsmaldives.gov.mv/census-2022-results-summary/).
- **Oman (OM)** — the 2020 register-based e-census does not publish religion, and the National Centre for Statistics and Information provides no affiliation table. Government descriptions acknowledge several religions without counts; route examined: [E-Census 2020](https://apps.oman.om/en/home-top-level/whole-of-government/central-initiative/e-census-2020).
- **Qatar (QA)** — the 2020 register-based census does not publish religion, and the National Planning Council catalogue provides no affiliation table. Official pages state that Islam is the state religion and acknowledge minorities without measuring them; route examined: [Census 2020](https://www.npc.qa/en/statistics/Pages/census/2020/default1.aspx).
- **Saudi Arabia (SA)** — population censuses, including 2022, omit religion; official statistics treat citizens within an Islamic legal frame and do not tabulate the affiliations of non-citizens. The result is no official population religion series; route examined: General Authority for Statistics census publications.
- **Syria (SY)** — official census reporting stopped publishing religion after the 1960 census; the 1970 and 2004 rounds omitted the series, and conflict has prevented a later full census. The documented-impossible span is therefore post-1960; route examined: the 2004 census record and UNSD questionnaires.
- **Turkmenistan (TM)** — the 2022 census results publish population, language, ethnicity, and other characteristics without religion; official affiliation statistics remain unavailable. State restrictions on religious organisation compound the absence; route examined: the [State Committee 2022 census results](https://editor.stat.gov.tm/en/population-census).
- **United Arab Emirates (AE)** — administrative population censuses and official demographic tables omit religion; published religious shares come from external estimates. No official affiliation, membership, or attendance series was located for citizens or expatriates; route examined: Federal Competitiveness and Statistics Centre demographic releases.
- **Yemen (YE)** — the 2004 census questionnaire omits religion, and war has prevented a later full census. Official demographic surveys since then provide no affiliation series; route examined: the [UNSD-hosted 2004 questionnaire](https://unstats.un.org/unsd/demographic/sources/census/quest/YEM2004en.pdf).

## D. Unknown after a reasonable look

### Africa

- **South Sudan (SS)** — unknown. The official [2008 census description](https://www.ssnbss.org/home/documents/census-and-survey/south-sudan-counts-2008/) lists short- and long-form modules without religion, while the 2010 household health survey has state domains but its public report did not establish an affiliation variable. No later national-office religion table was located.

### Europe

- **Monaco (MC)** — unknown. The [2023 Monaco Statistics census report](https://en.gouv.mc/content/download/526542/6040204/file/2023%20Census%20Report.pdf) was inspected without finding religion, and no official affiliation survey or religious-body register with population counts was located.
- **San Marino (SM)** — unknown. Current National Statistics Office bulletins publish marriages by civil or religious rite, which is not an affiliation measure. No population affiliation table, official religion survey, or subnational religious register was located in the census and bulletin routes.

## Highest-value A-class additions

The shortlist repeats A-class entries for prioritisation; it does not add countries to the coverage ledger.

1. ~~**Liechtenstein** — municipality affiliation across a 1980–2020 series, an official interactive table, and a stable eleven-municipality geography.~~ **Built:** The product covers the 2010, 2015, and 2020 census-affiliation waves on the stable eleven-municipality geography; the former 1980–2020 municipality-span claim was incorrect.
2. **Mali** — directly published region tables for 2009 and 2022, with categories that can be harmonised and a national-office route.
3. ~~**Côte d’Ivoire** — a long census span and directly published 2021 rows down to sub-prefecture or commune, region, and district.~~ **Blocked:** 31 local category sums exceed their printed resident totals; the build stops before product writing.
4. **Burkina Faso** — three census waves through 2019, a direct region table, and strong contrasts among Islam, Christianity, and traditional religion.
5. **Cabo Verde** — two recent voluntary census waves and municipality identifiers; the remaining task is a direct municipality cross-tab.
6. **Palestine** — three census rounds and a directly published 2017 governorate table; any build requires a prior decision on territorial scope and Jerusalem coverage.
7. **Saint Lucia** — repeated census affiliation through 2022 and a current, directly published district table.
8. **Guinea** — three census waves and prefecture geography; the national-office aggregate table remains the main route gap.

## PI status questions

- **Taiwan (TW)** is included by directive as a separately audited polity. It is not a UN member state. It is already named in `research/country-survey.md`; retain ISO `TW` and decide the public map label separately.
- **Kosovo (XK)** is included by directive and already named in both surveys. It is not a UN member state, and `XK` is a user-assigned code rather than an ISO 3166-1 assignment. The PI should approve the label, boundary, and code policy before a build.
- **Palestine (PS)** has UN non-member observer State status and an ISO 3166-1 code. Class A covers Palestinian Central Bureau of Statistics data for the West Bank and Gaza Strip, with a special Jerusalem coverage note. The PI should decide how that statistical geography relates to the live Israel route and whether overlapping claims may appear together.

## Exact-once accounting outside A–D

The 143 countries and directed additions below are excluded because they are already live or named in an existing survey. A live country also appears in the survey matrix; it is listed only as live here.

- **Africa — live (6):** Ghana (GH); Kenya (KE); Malawi (MW); Rwanda (RW); South Africa (ZA); Zambia (ZM).
- **Africa — surveyed (23):** Benin (BJ); Botswana (BW); Burundi (BI); Cameroon (CM); Egypt (EG); Eswatini (SZ); Ethiopia (ET); Gambia (GM); Lesotho (LS); Liberia (LR); Mauritius (MU); Morocco (MA); Mozambique (MZ); Namibia (NA); Nigeria (NG); Senegal (SN); Seychelles (SC); Sierra Leone (SL); Tanzania (TZ); Togo (TG); Tunisia (TN); Uganda (UG); Zimbabwe (ZW).
- **Americas — live (5):** Bahamas (BS); Brazil (BR); Canada (CA); Mexico (MX); United States (US).
- **Americas — surveyed (24):** Argentina (AR); Barbados (BB); Belize (BZ); Bolivia (BO); Chile (CL); Colombia (CO); Costa Rica (CR); Cuba (CU); Dominican Republic (DO); Ecuador (EC); El Salvador (SV); Guatemala (GT); Guyana (GY); Haiti (HT); Honduras (HN); Jamaica (JM); Nicaragua (NI); Panama (PA); Paraguay (PY); Peru (PE); Suriname (SR); Trinidad and Tobago (TT); Uruguay (UY); Venezuela (VE).
- **Asia — live (2):** India (IN); South Korea (KR).
- **Asia — surveyed (29):** Armenia (AM); Azerbaijan (AZ); Bangladesh (BD); Brunei (BN); Cambodia (KH); Cyprus (CY); Georgia (GE); Indonesia (ID); Israel (IL); Japan (JP); Jordan (JO); Kazakhstan (KZ); Kyrgyzstan (KG); Laos (LA); Lebanon (LB); Malaysia (MY); Mongolia (MN); Myanmar (MM); Nepal (NP); Pakistan (PK); Philippines (PH); Singapore (SG); Sri Lanka (LK); Tajikistan (TJ); Thailand (TH); Timor-Leste (TL); Türkiye (TR); Uzbekistan (UZ); Vietnam (VN).
- **Europe — live (11):** Albania (AL); Czechia (CZ); Denmark (DK); Germany (DE); Ireland (IE); Italy (IT); Poland (PL); Portugal (PT); Romania (RO); Slovakia (SK); United Kingdom (UK).
- **Europe — surveyed (28):** Austria (AT); Belgium (BE); Bosnia and Herzegovina (BA); Bulgaria (BG); Croatia (HR); Estonia (EE); Finland (FI); France (FR); Greece (GR); Hungary (HU); Iceland (IS); Latvia (LV); Lithuania (LT); Luxembourg (LU); Malta (MT); Moldova (MD); Montenegro (ME); Netherlands (NL); North Macedonia (MK); Norway (NO); Russia (RU); Serbia (RS); Slovenia (SI); Spain (ES); Sweden (SE); Switzerland (CH); Ukraine (UA); Kosovo (XK).
- **Oceania — live (3):** Australia (AU); New Zealand (NZ); Vanuatu (VU).
- **Oceania — surveyed (11):** Fiji (FJ); Kiribati (KI); Marshall Islands (MH); Federated States of Micronesia (FM); Nauru (NR); Palau (PW); Papua New Guinea (PG); Samoa (WS); Solomon Islands (SB); Tonga (TO); Tuvalu (TV).
- **Directed addition — surveyed (1):** Taiwan (TW).

The ledger contains 27 live countries, 116 additional surveyed countries or directed additions, and 53 A–D countries: 196 in total.
