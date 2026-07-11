# Cook Islands census-religion route probe

Verified 2026-07-11. The Cook Islands publishes religion **by island** for three consecutive census waves — 2011, 2016, and 2021 — as full-count tables in the openly downloadable census reports on the Cook Islands Statistics Office site (stats.gov.ck), and every wave closes to its printed national margin exactly. Each report prints "Table 2.04 — Resident Population by Religious Affiliation and Usual Residence", which tabulates every religion category for Rarotonga (with tapere/village detail), the five Southern Group islands (Aitutaki, Mangaia, Atiu, Mauke, Mitiaro), and the six Northern Group islands (Palmerston, Pukapuka, Nassau, Manihiki, Rakahanga, Penrhyn) — twelve island units in all. A fourth wave, **2006**, is recoverable at island-group level (Rarotonga / Southern / Northern) from the 2016 report's Table 6, which prints 2006, 2011, and 2016 counts side by side. This refutes the queue premise on two counts: the row read "island route unresolved | census affiliation metadata", but the island route is not unresolved and the data are not mere metadata — the published reports carry full island-level religion counts openly, and the reports' Standards clause grants table reuse with attribution. The one genuine gate is the **boundary**: geoBoundaries COK ships only an ADM0 land-cover layer that captures seven of the twelve census islands and drops five inhabited Northern Group atolls, so the northern islands need an OSM or official-GIS supplement.

## Build decision (recommendation to the conductor)

- **Recommendation**: BUILD a three-wave island-level religious-affiliation series (2011, 2016, 2021) across the twelve census island units, with a 2006 island-group wave from the 2016 report's Table 6. The published religion-by-island tables are open, count-valued, and reconcile; the licence carries an explicit table-reuse-with-attribution grant, materially stronger than the FSM/Palau "no stated terms" vacuum. The only build work with an unresolved dependency is the boundary for the five northern atolls.
- **Candidate waves**: 2011, 2016, 2021 at island level (full counts); 2006 at island-group level (Rarotonga / Southern / Northern, counts from 2016 Table 6). Hold pre-2006 (no island table located) and the PDH microdata (licensed, not a route).
- **Construct**: census affiliation. Each usual resident's reported religious denomination (the census question on religion, "not compulsory"); not practice, attendance, or membership.
- **Geography**: twelve island units — Rarotonga, plus Southern Group Aitutaki, Mangaia, Atiu, Mauke, Mitiaro, plus Northern Group Palmerston, Pukapuka, Nassau, Manihiki, Rakahanga, Penrhyn. Rarotonga is additionally split into tapere (Kiikii, Takuvaine, Nikao-Panama, Titikaveka, etc.) within each wave, but the tapere partition is **not stable across waves** (2011 lists Kiikii-Ooa-Pue and Tupapa-Maraerenga separately, 2016 merges them to Kiikii-Ooa-Pue-Tupapa, 2021 relabels to Kiikii-Tupapa-Maraerenga), so cross-wave comparison holds at the island level, not the tapere level. The three-way island-group aggregation (Rarotonga / Southern / Northern) is stable across all four waves.
- **Change metric**: island-level shares of Cook Islands Christian Church, Roman Catholic, Seventh Day Adventist, Church of Latter Day Saints, Assemblies of God, Apostolic Church, Other Religion, and No Religion/Not Stated are comparable across 2011-2016-2021 once two frame facts are handled (Jehovah's Witness folding and the no-religion split; see Category frames). The headline story is legible in the counts and the narrative: the Cook Islands Christian Church share fell from 48.8 percent (2016) to 43.1 percent (2021), "much of this decline occurred in Rarotonga", while No Religion/Refused rose sharply (7.4 to 15.6 percent nationally, and 9.6 to 19.6 percent on Rarotonga).
- **Rights position**: byte-matched from all three reports — "Any table or material may be reproduced and published provided acknowledgement is made of the source" (Standards/Source section). Ship derived island summaries with Cook Islands Statistics Office attribution under that grant. A front-matter copyright clause reserves commercial reproduction and forbids altering "the original work" without permission; flag the interaction to the PI, but the operative table-reuse grant is explicit and favourable.
- **Boundary decision**: PARTIAL. geoBoundaries COK ADM0 (CC BY 4.0) covers Rarotonga, all five Southern islands, and Penrhyn; it is missing Palmerston, Manihiki, Rakahanga, Nassau, and Pukapuka. Supplement those five from OSM `place=island` relations or an official Cook Islands / SPC island layer before a full twelve-island map. A Rarotonga-plus-Southern-plus-Penrhyn map (seven units) is buildable from geoBoundaries alone today.

## Published waves and geography

| Year | Public route | Religion-by-island table | Geography | Universe | Decision |
| --- | --- | --- | --- | --- | --- |
| 2011 | [2011 Census Report `.pdf`](https://stats.gov.ck/download/432/census-2011/5911/2011-census-report.pdf) (CISO), **Table 2.4** "Resident Population by Religious Affiliation and Usual Residence" | full counts, 8 named religions + No Religion + Objected/Not Stated | island + Rarotonga tapere | resident population, all ages (Total 14,974) | Ship the 2011 island wave. |
| 2016 | [2016 Census Report `.pdf`](https://stats.gov.ck/download/430/census-2016/5895/2016-census-report.pdf) (CISO), **Table 2.04** "…by Religious Affiliation and Usual Residence"; group series in **Table 6** (2006/2011/2016) | full counts, 8 named religions + No Religion/Not Stated | island + Rarotonga tapere | resident population, all ages (Total 14,802) | Ship the 2016 island wave. |
| 2021 | [2021 Census Report `.pdf`](https://stats.gov.ck/download/83/census-2021/1497/2021-census-report-with-tables-and-questionnaire.pdf) (CISO), **Table 2.04** "…by Religious Affiliation and Usual Residence"; group series in **Table 6** (2016/2021) | full counts, 9 named religions (JW separate) + No Religion/Not Stated | island + Rarotonga tapere | resident population, all ages (Total 14,987) | Ship the 2021 island wave. |
| 2006 | recovered from 2016 report **Table 6** (prints 2006/2011/2016 by group) | counts by group only (Rarotonga / Southern / Northern), 9 categories incl. JW | island-group (3) | resident population, all ages (Total 15,324) | Ship 2006 at group level only (no island table located). |
| 2001 / 1996 and earlier | no island-level religion table located on stats.gov.ck (site lists 2011/2016/2021 only) | none located | — | — | HOLD — outside the buildable series. |

The Cook Islands Statistics Office site (stats.gov.ck) is the source of record; its `category/census-and-surveys/national-census/` index lists only the 2011, 2016, and 2021 reports (no standalone 2006/2001/1996 report). A `cookislands.gov.ck` government mirror also hosts the 2016 report. The SPC Statistics for Development Division page (`sdd.spc.int/ck`) returned HTTP 403 to WebFetch and was not used. The Pacific Data Hub records ([2021 catalog/883](https://microdata.pacificdata.org/index.php/catalog/883), [2016 catalog/275](https://microdata.pacificdata.org/index.php/catalog/275), [2011 catalog/7](https://microdata.pacificdata.org/index.php/catalog/7)) are licensed microdata, not the route (see Licence position); the published reports carry the island-by-religion aggregates the build needs.

## Category frames

The named-religion spine is stable across the three island waves; two frame facts govern comparability. Preserve each source spelling per wave.

| 2011 (Table 2.4) | 2016 (Table 2.04) | 2021 (Table 2.04) | Product role |
| --- | --- | --- | --- |
| Cook Islands Christian Church | Cook Islands Christian Church | Cook Islands Christian Church | religious affiliation |
| Roman Catholic | Roman Catholic | Roman Catholic | religious affiliation |
| Seventh Day Adventist | Seventh Day Adventist | Seventh Day Adventist | religious affiliation |
| Church of Latter days Saints | Church of Latter Days Saint | Church of Latter Days Saint | religious affiliation |
| Assemblies of God | Assemblies of God | Assemblies of God | religious affiliation |
| Apostolic Church | Apostolic Church | Apostolic Church | religious affiliation |
| (in Other Religion) | (in Other Religion) | Jehova Witness | religious affiliation |
| Other Religion | Other Religion | Other Religion | residual affiliation |
| No Religion | (folded into No Religion/Not Stated) | (folded into No Religion/Not Stated) | no-religion |
| Objected to the Question or Not Stated | No Religion/Not Stated | No Religion/Not Stated | non-response |

The first frame fact is **Jehovah's Witness folding**: the 2011 and 2016 *island* tables (Table 2.4 / 2.04) fold Jehovah's Witness into "Other Religion", whereas the 2021 island table prints it as a separate column. The *group-level* Table 6 splits Jehovah's Witness for every wave (2006/2011/2016/2021). For a clean island-level three-wave series, fold the 2021 Jehovah's Witness column back into "Other Religion" (or read the split from group-level Table 6). The second frame fact is the **no-religion treatment**: 2011 prints two separate columns, "No Religion" and "Objected to the Question or Not Stated", whereas 2016 and 2021 merge them into one "No Religion/Not Stated" column; a comparable no-religion-plus-non-response series combines the two 2011 columns to match the later merged line. With both handled, the comparable island-level spine is Cook Islands Christian Church, Roman Catholic, Seventh Day Adventist, Church of Latter Day Saints, Assemblies of God, Apostolic Church, Other Religion (Jehovah's Witness inside), and No Religion/Not Stated — eight lines, comparable across all three island waves.

## The island counts (verified, extracted from the report PDFs)

**2021** — Table 2.04, Both Sex (island rows; Rarotonga tapere omitted here for brevity, present in source):

| Location | Total | CICC | Roman Catholic | SDA | LDS | Assemblies of God | Apostolic | Jehova Witness | Other | No Religion/Not Stated |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RAROTONGA | 10,863 | 4,194 | 1,909 | 750 | 446 | 445 | 188 | 241 | 558 | 2,132 |
| SOUTHERN ISLANDS | 3,033 | 1,469 | 392 | 417 | 144 | 86 | 133 | 89 | 101 | 202 |
| NORTHERN ISLANDS | 1,091 | 798 | 199 | 74 | 1 | 4 | 1 | – | 10 | 4 |
| **COOK ISLANDS** | **14,987** | **6,461** | **2,500** | **1,241** | **591** | **535** | **322** | **330** | **669** | **2,338** |

Southern rows: Aitutaki 1,776; Mangaia 471; Atiu 382; Mauke 249; Mitiaro 155. Northern rows: Palmerston 25; Pukapuka 457; Nassau 92; Manihiki 206; Rakahanga 81; Penrhyn 230.

**2016** — Table 2.04, Both Sex (island-group rows; JW inside Other Religion):

| Location | Total | CICC | Roman Catholic | SDA | LDS | Assemblies of God | Apostolic | Other | No Religion/Not Stated |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RAROTONGA | 10,649 | 4,849 | 1,960 | 777 | 479 | 470 | 144 | 947 | 1,023 |
| SOUTHERN ISLANDS | 3,072 | 1,611 | 425 | 384 | 126 | 90 | 137 | 230 | 69 |
| NORTHERN ISLANDS | 1,081 | 765 | 189 | 88 | 4 | 9 | 2 | 19 | 5 |
| **COOK ISLANDS** | **14,802** | **7,225** | **2,574** | **1,249** | **609** | **569** | **283** | **1,196** | **1,097** |

**2011** — Table 2.4, Both Sex (island-group rows; No Religion and Objected/Not Stated split; JW inside Other Religion):

| Location | Total | No Religion | CICC | Roman Catholic | SDA | LDS | Assemblies of God | Apostolic | Other | Objected/Not Stated |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RAROTONGA | 10,572 | 769 | 4,902 | 1,870 | 727 | 473 | 477 | 187 | 903 | 264 |
| SOUTHERN ISLANDS | 3,290 | 62 | 1,682 | 465 | 380 | 173 | 73 | 120 | 284 | 51 |
| NORTHERN ISLANDS | 1,112 | 10 | 772 | 205 | 83 | 10 | 7 | 3 | 14 | 8 |
| **COOK ISLANDS** | **14,974** | **841** | **7,356** | **2,540** | **1,190** | **656** | **557** | **310** | **1,201** | **323** |

**2006** — group level only, recovered from 2016 Table 6 (counts): Cook Islands total 15,324, split CICC 8,065; Roman Catholic 2,599; SDA 1,154; LDS 565; Assemblies of God 558; Apostolic 310; Jehovah's Witness 325; Other Religion 786; No Religion/Not Stated 962. Rarotonga 10,226; Southern 3,729; Northern 1,369.

## Universe and denominator

Every wave counts the **resident population, all ages** (the religion question was "not compulsory"; roughly 2 percent refused or did not respond in each wave). The national totals fall gently across the span (2006: 15,324; 2011: 14,974; 2016: 14,802; 2021: 14,987), and the three island-group denominators sum to the national total in every wave, so island shares read within each wave's own denominator. The Rarotonga tapere rows sum to the Rarotonga island total within each wave.

## Reconciliation gates (verified in the probe)

- **2021 (Table 2.04)**: the three island-group rows sum to the national total (10,863 + 3,033 + 1,091 = 14,987), and the nine category columns of the COOK ISLANDS row sum to 14,987 (6,461 + 2,500 + 1,241 + 591 + 535 + 322 + 330 + 669 + 2,338). Both margins close exactly.
- **2016 (Table 2.04)**: the COOK ISLANDS category columns sum to the printed total (7,225 + 2,574 + 1,249 + 609 + 569 + 283 + 1,196 + 1,097 = 14,802). Closes exactly.
- **2011 (Table 2.4)**: the COOK ISLANDS category columns sum to the printed total (841 + 7,356 + 2,540 + 1,190 + 656 + 557 + 310 + 1,201 + 323 = 14,974). Closes exactly.
- **Cross-source narrative check**: the 2021 narrative gives CICC 43.1 percent (6,461/14,987 = 43.1 percent) and the 2016 report gives CICC 49 percent (7,225/14,802 = 48.8 percent); both match the printed counts. The Table 6 percentage series reconciles against the group counts (2016 Rarotonga CICC 4,849/10,649 = 45.5 percent).
- A dash (`–`) in a cell (e.g. Northern Islands Jehovah's Witness 2021, several Mauke/Mitiaro cells) is a printed nil, not a suppression symbol; no confidentiality masking (`~`, `*`) appears in the CK tables. The build reads a dash as zero and stops on any row that fails to close.

## Boundary source and licence

geoBoundaries carries **only** a Cook Islands ADM0 layer — [`gbOpen/COK/ADM0`](https://www.geoboundaries.org/api/current/gbOpen/COK/ADM0/); the ADM1 endpoint returns 404 and the `COK/` directory lists only `ADM0/` and `ALL/`. There is no named-island ADM1 polygon in geoBoundaries. The ADM0 release is a Sentinel-2 10 m land-cover raster-to-polygon dissolve (same construction as the Tokelau ADM0 layer), a single MultiPolygon of 86 islet parts, released metadata `"boundaryID": "COK-ADM0-34037180"`, `"boundaryYearRepresented": "2021"`, `"boundaryType": "ADM0"`, `"boundarySource": "raster2polygon from Sentinel-2 10m Land Cover where Image Year = 2021 / exclude gridcode = 1 (water) / dissolve / processed by IMB"`, `"boundaryLicense": "Creative Commons Attribution 4.0 International (CC BY 4.0)"`.

**Completeness gap (the one genuine boundary gate).** The ADM0 layer's coordinates span longitude −159.84 to −157.32 and latitude −21.96 to −8.92. Matching the 86 parts against known island coordinates, the layer captures seven of the twelve census island units — Rarotonga (−159.78, −21.23), Aitutaki, Manuae, Takutea, Mangaia, Atiu, Mauke, Mitiaro (the whole Southern Group), and Penrhyn/Tongareva (−158.05, −9.0, the northernmost point) — but is **missing five inhabited Northern Group census islands**: Palmerston (−163.2, −18.1), Manihiki (−161.0, −10.4), Rakahanga (−161.1, −10.0), Nassau (−165.4, −11.6), and Pukapuka (−165.8, −10.9), all of which lie west of −159.84 where the land-cover layer has no geometry (uninhabited Suwarrow is likewise absent). A twelve-island map therefore cannot be drawn from geoBoundaries alone; the five northern atolls need an OSM `place=island` relation (each inhabited Cook Island has one) or an official Cook Islands / SPC island polygon. A seven-unit map (Rarotonga + five Southern + Penrhyn) is buildable from geoBoundaries today.

**Camera extent / dateline.** All Cook Islands territory sits between roughly 157°W and 166°W, well east of the antimeridian (180°), so no dateline crossing or camera-extent split is needed — the brief's expectation is confirmed. The apparent 159.84°W western limit of the geoBoundaries layer is a completeness gap in that layer, not a dateline artefact; the true western islands (Pukapuka, Nassau near 165.8°W) exist but are absent from the land-cover raster. The north-south spread is large (Penrhyn 9°S to Mangaia 22°S, ~13° of latitude), a map-framing note but not a technical obstacle.

## Licence position

The census-report tables carry an explicit, byte-matched reuse grant — favourable, and materially stronger than the FSM/Palau "no stated terms" vacuum. Two clauses appear in every wave's report; both are verbatim from the fetched PDFs.

- **Standards / Source clause (operative for the build), all three reports verbatim**: "All data in this report is compiled by the Statistics Office except where otherwise stated. Any table or material may be reproduced and published provided acknowledgement is made of the source." (2011 p. iii region; 2016 p. vi; 2021 p. v.) This directly authorizes republishing the religion-by-island tables with Cook Islands Statistics Office attribution.
- **Front-matter copyright clause (2021, verbatim)**: "© Copyright Cook Islands Statistics Office 2022. All rights for commercial / for profit reproduction or translation, in any form is reserved. CISO authorizes the partial reproduction or translation of this material for scientific, educational or research purposes, provided that CISO and the source document are properly acknowledged. Permission to reproduce the document and / or translate in whole, in any form, whether for commercial / for profit or non – profit purposes, must be requested in writing. Original work may not be altered or separately published without permission." (2016 report identical but dated 2018.) This reserves commercial and whole-document reproduction and forbids altering "the original work" without permission.
- **Interaction to flag for the PI**: the Standards clause grants table reproduction-and-publication with attribution; the front-matter clause forbids altering the original work without permission and reserves whole/commercial reproduction. A derived island summary is a partial, aggregated, attributed reuse for a research/educational purpose — squarely inside both the Standards grant and the front-matter "partial reproduction ... for scientific, educational or research purposes" carve-out. The recommended position is to ship derived island summaries with CISO attribution under the Standards grant and record the front-matter "not altered ... without permission" clause as a PI-visible caveat, not a blocker. This is a stronger licence footing than any of the FSM/Palau/Nauru siblings.
- **PDH microdata (catalog/883, 275, 7)**: "Licensed file" — "Accessible under conditions and after the data producer agrees to disseminate their data", requiring a signed confidentiality declaration and prior approval of all outputs by CISO or SPC before dissemination. This is a documented HOLD, never a route; the build does not touch the microdata (the Nauru reasoning) and the restriction is recorded only to explain why the microdata route is closed. The published-report tables carry the island aggregates the build needs.
- **Boundary**: geoBoundaries COK ADM0 is CC BY 4.0 per its release metadata (above). Any OSM supplement for the northern atolls would be ODbL and must be recorded separately.

## Retrieval record

Every cached input is under `data/raw/ck_census/`, which `git check-ignore -v` confirms is excluded by `.gitignore:120` (the `data/` rule). Retrieval occurred on 2026-07-11. Every download was verified as the stated content type (`file` reports PDF for the reports, JSON for the boundary).

| Cached input | Source URL | Hosting | SHA-256 |
| --- | --- | --- | --- |
| `ck_2021_census_report.pdf` | <https://stats.gov.ck/download/83/census-2021/1497/2021-census-report-with-tables-and-questionnaire.pdf> | official (Cook Islands Statistics Office) | `3cc3c9795e030ca6185b2b7f06f4eaeb3e1b12fa8f9ce5e48c9239ff6f074cc8` |
| `ck_2016_census_report.pdf` | <https://stats.gov.ck/download/430/census-2016/5895/2016-census-report.pdf> | official (Cook Islands Statistics Office) | `6c0fa1d1ea832ed7a99d9fd11ca5949293382df253806b3250e986c821cf8100` |
| `ck_2011_census_report.pdf` | <https://stats.gov.ck/download/432/census-2011/5911/2011-census-report.pdf> | official (Cook Islands Statistics Office) | `5735f089e75f4a990dfd2cdbc94857b13cf41d7ce4c531c1a7ecf1039d8e378c` |
| `geoBoundaries-COK-ADM0.geojson` | <https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/COK/ADM0/geoBoundaries-COK-ADM0.geojson> | geoBoundaries gbOpen (pinned 9469f09) | `213972fbb83bec6c5678a7671823983633166ae032439de8903fb59b8896d05e` |
| `gb_cok_adm0_meta.json` | <https://www.geoboundaries.org/api/current/gbOpen/COK/ADM0/> | geoBoundaries API | `2d367b533b68fbf7bc7af38fbe43f9a40f153e861d23fa49564f32b1bce9de42` |

Derived working files also present in the cache (not source objects): `ck_2021_census_report.txt`, `ck_2016_census_report.txt`, `ck_2011_census_report.txt` (pdftotext extractions), and the HTML index captures (`census_surveys.html`, `national_census.html`, `census_2016.html`, `census_2011.html`).

## Earlier waves

Religion was asked in every Cook Islands census, and the 2016 report's Table 6 prints 2006/2011/2016 side by side at island-group level, giving a clean 2006 group-level wave without a standalone 2006 report. A standalone 2006, 2001, or 1996 census report was not located on stats.gov.ck (its national-census index lists only 2011/2016/2021); the SPC SDD digital library (`sdd.spc.int/ck`) is the likely home of the older reports but returned HTTP 403 to WebFetch and was not retrieved in this probe. Extending the island series before 2011 is a future-research route needing the 2006/2001 island tables located and their frames reconciled; the 2006 group-level wave ships from Table 6 now.

## Blockers

- **Boundary completeness (the one genuine gate)**: geoBoundaries COK ADM0 covers seven of the twelve census islands and drops five inhabited Northern Group atolls (Palmerston, Manihiki, Rakahanga, Nassau, Pukapuka). A full twelve-island map needs those five supplemented from OSM `place=island` or an official CK/SPC layer (recording the supplement's licence separately). A seven-unit map is buildable from geoBoundaries today, and the three-way island-group choropleth needs the northern atolls too.
- **Licence interaction (PI caveat, not a blocker)**: the operative Standards grant permits table reproduction-and-publication with attribution, while the front-matter clause forbids altering the original work without permission; a derived attributed summary sits inside the granted research/educational reuse, but the interaction is flagged for a PI ruling.
- **Rarotonga tapere instability**: the within-Rarotonga tapere partition changes labels/boundaries across waves (2011 splits Kiikii-Ooa-Pue / Tupapa-Maraerenga; 2016 merges; 2021 relabels), so cross-wave comparison holds at the island level, not the tapere level. The tapere detail is usable within a single wave.
- **Frame handling**: fold the 2021 Jehovah's Witness column into Other Religion (2011/2016 island tables already do), and combine the 2011 "No Religion" and "Objected/Not Stated" columns to match the later merged "No Religion/Not Stated" line, for a comparable eight-line island spine across 2011-2016-2021.
- **Pre-2011 island tables unverified**: no standalone 2006/2001/1996 report with an island religion table located on stats.gov.ck; the 2006 wave ships at group level from 2016 Table 6, and SDD (403 to WebFetch) is the recorded route to deepen the island series.

## Product boundary

A build on this probe stages a three-wave, island-level religious-affiliation series (2011, 2016, 2021) for the twelve census island units, with a 2006 island-group wave from the 2016 report's Table 6, on island footprints assembled from geoBoundaries COK ADM0 (seven units, CC BY 4.0) supplemented with an OSM/official layer for the five missing northern atolls. It uses the all-ages resident-population universe, the eight-line comparable frame (Cook Islands Christian Church, Roman Catholic, Seventh Day Adventist, Church of Latter Day Saints, Assemblies of God, Apostolic Church, Other Religion, No Religion/Not Stated), and the verified counts above. It would **not** include a Rarotonga tapere series (partition unstable across waves), a pre-2011 island wave (no island table located), a places-of-worship layer (OSM Overpass timed out on the 2026-07-07 sweep — rerun before any POW layer), or place-density metrics. The northern-atoll boundary supplement is the clean unblock for a full twelve-island map; the licence is favourable and needs a PI note rather than a ruling.
