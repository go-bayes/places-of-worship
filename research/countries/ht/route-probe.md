# Haiti census-religion route probe

Verified 2026-07-12. Verdict: **HELD**. Haiti's fourth general census (IV Recensement Général de la Population et de l'Habitat, RGPH-2003, run by the Institut Haïtien de Statistique et d'Informatique, IHSI) collected religion, and IHSI publishes a religion table — but only at the national level. The published religion table (Tableau 206, "Ensemble du Pays") crosses religion by age group, sex, and residence type (urban/rural); it carries no département or commune dimension. No official online REDATAM base exists for Haiti (the CELADE directory leaves both the 2000-round and 2010-round processing columns empty, and the redatam.org microdata inventory does not list Haiti), so the Paraguay online-REDATAM precedent (queue row 95) does not transfer. Religion by département exists in only one place: the IPUMS International restricted census microdata (source variable `HT2003A_RELIG` crossed with the department geography in the 10 percent sample), which sits under the standing PI restricted-microdata hold — the same hold that parks the DHS/EMMUS rows. The queue row's "not applicable | survey estimates; reviewed route did not show recent census religion" is wrong on the central point: the 2003 census did collect and publish religion (nationally), and a departmental tabulation is derivable from restricted microdata. The hold is on the microdata ruling, not on the absence of a census religion source.

## Build decision (recommendation to the conductor)

- **Recommendation: HOLD. Do not build.** No published table crosses religion with département or commune for any Haitian census. The one published religion table is national ("Ensemble du Pays"). Deriving departmental shares from the national total would allocate figures against the hard gate. The build gate (at least one wave of counts at the target geography) is not met at départ-ement level from any published source.
- **What is published (national religion, for the record, not a subnational product)**: RGPH-2003 Tableau 206, "Répartition de la population par groupe d'âges et sexe selon la religion et le milieu de résidence — ENSEMBLE DU PAYS" (national count table by age group, sex, residence type; twelve religion categories; total 8,373,750). Same content on the current IHSI site and the archived old site, national only.
- **Named unblock (primary)**: a PI ruling on IPUMS International restricted census microdata. The 10 percent RGPH-2003 sample (838,045 person records) carries a religion variable (`HT2003A_RELIG`, twelve categories matching Tableau 206) and the first-level geography (10 départements). A ruling that IPUMS-derived aggregate tabulations may ship would support a single-wave (2003), ten-unit, twelve-category departmental religion product. IPUMS terms permit publishing derived aggregate results while prohibiting redistribution of the microdata itself; the block is the standing hold, not the IPUMS licence text.
- **Named unblock (secondary)**: an IHSI data request for the departmental religion tabulation (Tableau 206 per département). The census collected religion at the person level, so IHSI holds the departmental cross; it published religion only nationally online. IHSI data are all-rights-reserved (site footer "© Copyright 2026. Tous droits réservés."; no open-data licence located, the terms link 404s), so reuse would also need IHSI permission under the Burkina Faso build-then-ask posture.
- **DHS/EMMUS route (survey estimates, not census)**: under the standing DHS hold. Recorded, not pursued.
- **Rights position**: IHSI all-rights-reserved (national published table). IPUMS restricted-access (individual registration, no microdata redistribution, scholarly/educational, no commercial use). Boundary geoBoundaries HTI ADM1, 10 départements, ODbL 1.0 — clean and idle under the hold.

## Published waves and geography

| Wave | Official route | Religion table | Geographic level | Universe | Decision |
| --- | --- | --- | --- | --- | --- |
| RGPH-2003 (IV census) | [IHSI "Autres Résultats RGPH 2003"](https://ihsi.gouv.ht/recensement/autres_resultat_rgph_2003), Tableau 206 (image `tableau 206.jpg`) | national count by age group, sex, residence type; twelve categories | **national only** ("Ensemble du Pays") | counted population 8,373,750 | No département or commune split. National only. |
| RGPH-2003 (old site) | [archived `www.ihsi.ht/recensement.htm`](http://web.archive.org/web/2018id_/http://www.ihsi.ht/recensement.htm) → `rgph_resultat_ensemble_population.htm` | religion among national population characteristics | **national only** ("ensemble") | 8,373,750 | Old site publishes the ensemble (national) tables only; no departmental religion page. |
| RGPH-2003 (microdata) | [IPUMS International HT 2003 sample](https://international.ipums.org/international-action/sample_details/country/ht), variable `HT2003A_RELIG` | religion at person level, crossable with 10 départements | **département derivable** | 10% sample, 838,045 persons | Restricted-access microdata; under the PI hold. |
| EMMUS-IV/V/VI (2005-06, 2012, 2016-17) | [DHS Program Haiti 2016-17](https://dhsprogram.com/data/dataset/Haiti_Standard-DHS_2016.cfm); [World Bank microdata 3187](https://microdata.worldbank.org/index.php/catalog/3187) | DHS religion variable (survey estimate) | département derivable (survey design) | design-weighted sample (14,371 women, 9,795 men, 13,405 households in 2016-17) | Survey estimates, not census counts; under the standing DHS hold. |

The IHSI web tabular series (TAB-100 to TAB-600) is headed "Tableau Statistique (Ensemble du Pays)" throughout; it is a single national set, not a per-département set. Some tables cross other variables by commune (for example population by commune of residence), but Tableau 206 — the only religion table — is national by age, sex, and residence type. No REDATAM online processing exists for Haiti at CELADE, so no official online departmental tabulation of religion is producible.

## National religion frame (Tableau 206, preserved verbatim; recorded, not a subnational product)

Tableau 206, "Répartition de la population par groupe d'âges et sexe selon la religion et le milieu de résidence — ENSEMBLE DU PAYS," Deux sexes / Total row (counts as printed). Twelve mutually exclusive categories:

| Religion (French, as printed) | English display | Count | Share of 8,373,750 |
| --- | --- | ---: | ---: |
| Aucune religion | No religion | 855,878 | 10.22 % |
| Catholique | Catholic | 4,578,842 | 54.68 % |
| Adventiste | Adventist | 248,063 | 2.96 % |
| Témoin de Jéhovah | Jehovah's Witness | 38,122 | 0.46 % |
| Baptiste | Baptist | 1,287,742 | 15.38 % |
| Méthodiste | Methodist | 123,944 | 1.48 % |
| Episcopale | Episcopal | 56,319 | 0.67 % |
| Pentecôtiste | Pentecostal | 664,860 | 7.94 % |
| Vaudouisant | Voodoo | 176,976 | 2.11 % |
| Musulman | Muslim | 2,013 | 0.02 % |
| Mormon | Mormon | 5,683 | 0.07 % |
| Autre religion | Other religion | 335,308 | 4.00 % |
| **Total** | | **8,373,750** | **100 %** |

The twelve category counts sum to the total exactly: 855,878 + 4,578,842 + 248,063 + 38,122 + 1,287,742 + 123,944 + 56,319 + 664,860 + 176,976 + 2,013 + 5,683 + 335,308 = 8,373,750. The shares reproduce the IHSI narrative figures (Catholique 54.7 %, Baptiste 15.4 %, Pentecôtiste 7.9 %, Aucune religion 10.2 %). "Aucune religion" is a distinct no-religion slot; the frame carries no separate non-response category (the census forced a response among the twelve). The IPUMS category list for `HT2003A_RELIG` matches this frame one-to-one (None, Catholic, Adventist, Jehovah's Witness, Baptist, Methodist, Episcopal, Pentecostal, Voodoo, Muslim, Mormon, Other). These national figures are recorded for provenance and cross-reference; because no subnational religion table is published, no build carries them and no departmental allocation is attempted.

## Universe note

The Tableau 206 total (8,373,750) is the counted census population. Some secondary sources cite 8,812,245 for the 2003 census (an undercount-adjusted figure); the products base is the counted 8,373,750, which every religion count in Tableau 206 sums to exactly. The discrepancy is a counted-versus-adjusted difference, recorded, not resolved, because no subnational product depends on it.

## Census recency (the 5th census has not happened)

Haiti's last completed census is RGPH-2003. The planned fifth census (Ve RGPH) has been repeatedly delayed and, as of the 2024 IHSI record, not carried out. IHSI states the Ve RGPH "n'a pas pu être réalisé" and, to fill the gap, produced disaggregated mid-year population estimates for 2024 ([IHSI actualité, 2024 disaggregated estimates](https://ihsi.gouv.ht/actualites/estimations-desagregees-de-la-population-haitienne-en-2024)). A dedicated Ve RGPH site exists ([rgph-haiti.ht](http://www.rgph-haiti.ht/); [UNFPA Haiti Ve RGPH](https://haiti.unfpa.org/en/news/towards-organization-5th-general-census-population-and-housing-haiti-technological-and-thematic)) with a completed pilot phase, but no full census enumeration and no 5th-census religion tabulation exists. RGPH-2003 remains the only census religion source.

## Boundaries and administrative structure

Haiti's first-level administrative frame is ten départements (Ouest, Artibonite, Nord, Nord-Est, Nord-Ouest, Centre, Sud, Sud-Est, Grande-Anse, Nippes). The boundary layer matches this frame:

- **geoBoundaries HTI ADM1** — release metadata (retrieved 2026-07-12): `boundaryID` `HTI-ADM1-49955354`, `boundaryType` ADM1, `boundaryYearRepresented` 2017, `admUnitCount` 10, `boundarySource` "OpenStreetMap, Wambacher", `boundaryLicense` "Open Data Commons Open Database License 1.0", `licenseSource` `www.openstreetmap.org/copyright`. [ADM1 release metadata](https://www.geoboundaries.org/api/current/gbOpen/HTI/ADM1/); [ADM1 GeoJSON](https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/HTI/ADM1/geoBoundaries-HTI-ADM1.geojson).

The ten-département boundary matches the RGPH-2003 first-level geography one-to-one; the Nippes département (created 2003 from Grande-Anse) is present as its own feature in the 2017 boundary and is a live crosswalk question against any 2003 tabulation (the IPUMS geography would settle whether Nippes is coded separately or within Grande-Anse in the sample). Boundary work is idle under the hold; the licence (ODbL 1.0, OpenStreetMap-derived) is favourable and moot.

## Licence position

- **IHSI (national published table)**: all-rights-reserved. The IHSI homepage footer, retrieved 2026-07-12, reads verbatim "IHSI © Copyright 2026. Tous droits réservés." The site's `politique-de-confidentialite` link resolves to a 404. No open-data licence or reuse grant was located. This is the Guinea-Bissau / Burkina Faso posture: all-rights-reserved footer, no located open licence. Moot under the hold, because the published table is national only.
- **IPUMS International (restricted microdata)**: restricted-access. Redistribution of the microdata to third parties is prohibited; each team member must license individually; use is scholarly/educational, non-commercial ([IPUMS terms](https://www.ipums.org/about/terms); [IPUMS International citation](https://international.ipums.org/international/citation.shtml)). Derived aggregate tabulations may be published under the licence, but the route is a restricted-microdata route and falls under the standing PI hold.
- **DHS/EMMUS**: restricted-access DHS registration; under the standing DHS hold.
- **Boundary**: geoBoundaries HTI ADM1, ODbL 1.0 (OpenStreetMap + Wambacher).

## Premise corrections (trust the record)

- **The 2003 census did collect and publish religion.** The queue row reads "not applicable | survey estimates; reviewed route did not show recent census religion." IHSI publishes RGPH-2003 Tableau 206, a national religion table (twelve categories, total 8,373,750). The reviewer missed the census religion source; it is real, published, and internally consistent — but national only.
- **The published religion table is national, not subnational.** Religion is published for the whole country ("Ensemble du Pays") by age, sex, and residence type. No département or commune religion table is published on either the current or the archived IHSI site.
- **No online REDATAM route exists for Haiti.** The CELADE directory leaves both REDATAM processing columns (2000 and 2010 rounds) empty for Haiti, and the redatam.org microdata inventory omits Haiti. The Paraguay online-REDATAM precedent (queue row 95) does not transfer.
- **Departmental religion is derivable only from restricted microdata.** IPUMS International holds RGPH-2003 with `HT2003A_RELIG` and the department geography; this is restricted-access microdata under the standing PI hold, the same class as the DHS/EMMUS rows.
- **The census span is anchored on 2003, not a 2005-2017 census.** The queue "2005-2017" span reflects the EMMUS/DHS survey waves (EMMUS-IV 2005-06, EMMUS-V 2012, EMMUS-VI 2016-17), not a census. The only census religion source is RGPH-2003.

## Retrieval record

All inputs retrieved 2026-07-12. Content cached in the session scratchpad only (ephemeral; not committed). The two load-bearing captures:

| Cached input | Source URL | Format | SHA-256 |
| --- | --- | --- | --- |
| `tab206.jpg` (national religion table) | <https://ihsi.gouv.ht/public/tableau/images/tableau%20206.jpg> | jpeg | `f1cf436471d20ccca77109313887ede5970c7d14a6343bb87e23ab207988b018` |
| `autres.html` (IHSI table index, "Ensemble du Pays") | <https://ihsi.gouv.ht/recensement/autres_resultat_rgph_2003> | html | `2f23cd7580a4d5f9b26243e55987ddbdd213ba6f9fd95693db26d5b3981e5259` |

URLs fetched and what each showed:

- <https://ihsi.gouv.ht/recensement/resultat_rgph_2003> — national religion narrative (Catholique 54,7 %, Baptiste 15,4 %, Pentecôtiste 7,9 %, Aucune religion 10,2 %); results published "pour chacun des départements géographiques" as narrative, no departmental religion table.
- <https://ihsi.gouv.ht/recensement/autres_resultat_rgph_2003> — full national table index (TAB-100 to TAB-600), headed "Ensemble du Pays"; Tableau 206 is the religion table (national, by age/sex/residence type).
- <https://ihsi.gouv.ht/public/tableau/images/tableau%20206.jpg> — the religion table image (read and transcribed above); twelve categories, total 8,373,750, sums exactly.
- <https://ihsi.gouv.ht/recensement> — census index; documents "Manuel RGPH 2003" and "SDE_Haiti 2003 base complete"; no departmental religion volume linked.
- <https://ihsi.gouv.ht/> — homepage footer "IHSI © Copyright 2026. Tous droits réservés."; `politique-de-confidentialite` returns 404.
- <https://ihsi.gouv.ht/actualites/estimations-desagregees-de-la-population-haitienne-en-2024> — IHSI record that the Ve RGPH was not carried out; 2024 disaggregated estimates produced instead.
- <https://catalog.ihsn.org/index.php/catalog/4517> and `/related-materials` — IHSN catalog for RGPH-2003; microdata "Get Microdata" section, citation requirement and data-producer disclaimer; no departmental religion volume, no explicit open licence.
- <https://international.ipums.org/international-action/sample_details/country/ht> — Haiti samples 1971, 1982, 2003; 2003 sample 838,045 persons.
- IPUMS RELIGION / HT2003A_RELIG search — variable "Professed religion," twelve categories (None, Catholic, Adventist, Jehovah's Witness, Baptist, Methodist, Episcopal, Pentecostal, Voodoo, Muslim, Mormon, Other); question "What is this person's current religion?".
- <https://www.cepal.org/es/pagina/cuestionarios-censales-enlaces-resultados-procesamiento-linea-redatam> — Haiti row: census questionnaire "Boleta 2003" (`celade.cepal.org/censosinfo/Boletas/HT_BDef_2003.pdf`) and IHSI/Censo links; online-REDATAM columns (2000 and 2010) empty for Haiti.
- <https://redatam.org/en/microdata> — microdata inventory; Haiti not listed.
- <https://www.geoboundaries.org/api/current/gbOpen/HTI/ADM1/> — HTI ADM1 metadata (10 units, ODbL 1.0, year 2017).
- <http://web.archive.org/web/2018id_/http://www.ihsi.ht/recensement.htm> and `rgph_resultat_ensemble_population.htm` (via curl; WebFetch blocked on web.archive.org) — old IHSI site; all census result pages are `rgph_resultat_ensemble_*.htm` (national/"ensemble"); no departmental religion page; religion listed among national population characteristics.
- <https://www.ipums.org/about/terms> and <https://international.ipums.org/international/citation.shtml> — IPUMS conditions: no microdata redistribution, individual licensing, scholarly/non-commercial; citation required.
- DHS/EMMUS search — EMMUS-VI 2016-17 (and EMMUS-IV 2005-06, EMMUS-V 2012); DHS restricted registration; survey estimates, not census.

## Blockers and held items

- **No subnational census religion table (the hold)**: RGPH-2003 religion is published for the whole country only; no département or commune religion table exists on any IHSI route, and no official online REDATAM base exists for Haiti. This is a published-data ceiling.
- **Restricted microdata (the route that exists, held)**: IPUMS International holds RGPH-2003 with religion and department; the route is restricted-access microdata under the standing PI hold. Primary unblock: a PI ruling permitting an IPUMS-derived departmental religion tabulation.
- **IHSI departmental tabulation (secondary unblock)**: an IHSI data request for Tableau 206 per département; the census collected it, IHSI published it only nationally. IHSI data are all-rights-reserved (build-then-ask posture).
- **DHS/EMMUS (held, survey not census)**: under the standing DHS hold; survey estimates, not census counts.
- **5th census (watch item)**: the Ve RGPH is not completed; a future enumeration could publish departmental religion. Recorded as a watch item.
- **Boundary clean and idle**: geoBoundaries HTI ADM1 (10 départements, ODbL 1.0) would join to any 2003 departmental religion tabulation under a name crosswalk, with the Nippes/Grande-Anse split the one point to settle. No boundary work is warranted under the hold.
