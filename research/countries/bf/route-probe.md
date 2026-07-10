# Burkina Faso census-religion route probe

Verified 2026-07-10. The official Institut national de la statistique et de la démographie (INSD) route confirms census affiliation in 1996, 2006, and 2019. The record does not support the clean three-wave regional series described in the audit row. The verified 1996 report publishes religion nationally. The 2006 thematic report publishes exact counts for 13 regions and 45 provinces. The 2019 final-results report publishes one-decimal percentages for 13 regions on the collected-person basis. That basis excludes the estimated population of localities that were not fully enumerated because of insecurity.

The build now ships to staging under a derived rounding bound, ratified by the PI on 2026-07-10 (build-queue.md, 23:54; Estonia precedent: bounds derived from the source's own rounding, never arbitrary tolerances). Five 2019 regional rows have six rounded category percentages that sum to 99.9 or 100.1 against a printed total of 100.0. The 2006 exact-count gates stay exact. The builder makes no allocation or rounding adjustment; it asserts each 2019 row sits within the derived bound and only then joins the boundary and writes the staged product.

## PI ruling and the derived rounding bound

The PI ruled SHIP under a bound derived from the source's own one-decimal rounding. Each printed 2019 percentage is rounded to one decimal and therefore carries a maximum rounding error of 0.05 percentage points (half of the 0.1 print step). The six mutually exclusive categories partition the collected-person basis; their true shares sum to exactly 100.0, and the printed row sum can therefore differ from 100.0 by at most the accumulated per-cell error, 0.05 × 6 = 0.30 percentage points. The five flagged rows (Cascades, Centre-Est, Centre-Sud, Sahel, Sud-Ouest) deviate by 0.1, within the 0.30 bound; the observed maximum absolute deviation is 0.1. The builder asserts every row satisfies |row sum − 100.0| ≤ 0.05 × k and fails if any row exceeds it. The 2006 exact-count table keeps the exact every-row gate; no rounding allowance applies to it.

The 2019 percentages ship as published on the collected-person basis; no count is derived from any percentage. Cross-wave change stays withheld because 2006 exact counts on the full resident population and 2019 rounded shares on the collected-person basis use different constructs and denominator bases. The INSD Open Data Agreement follow-up stays OPEN with the PI (the legal page names and links an Accord de licence de données ouvertes, hosted with the Open Data Portal at burkinafaso.opendataforafrica.org, whose text was not captured); the reuse position stays needs_review, and publication to staging proceeds under the PI ship ruling.

## Official publications and build decision

| Wave | Official INSD publication | Published religion geography | Build decision |
| --- | --- | --- | --- |
| 1996 | [*Analyse des résultats du recensement général de la population et de l’habitation de 1996*, Volume I](https://microdata.insd.bf/index.php/catalog/42/download/253), Table 3 | National percentages by sex and total | National context only. The verified report does not publish a subnational religion table. A separate catalogue file publishes only population by department. |
| 2006 | [*État et structure de la population*](https://www.insd.bf/sites/default/files/2021-12/Theme2-Etat_et_structure_de_la_population.pdf), Tables A5.4–A5.6 | Exact counts for the country, 13 regions, and 45 provinces | Table A5.5's 13 regional rows and national row were transcribed and passed exact reconciliation. The 45 provincial rows in Tables A5.4–A5.6 are a documented route that was not transcribed or tested. The regional extraction cannot ship alone because the requested change-over-time product remains blocked at 2019 and INSD publication reuse rights are unresolved. |
| 2019 | [*Cinquième Recensement Général de la Population et de l’Habitation du Burkina Faso: Rapport des résultats définitifs*](https://www.insd.bf/sites/default/files/2022-07/Rapport%20resultats%20definitifs%20RGPH%202019.pdf), Table 10 | One-decimal percentages and a collected-person effectif for 13 regions | Shipped to staging. Five rows sum to 99.9 or 100.1, within the derived rounding bound of 0.30 percentage points. Shares ship as published; no count is derived from a percentage. |

The short [2006 final-results booklet](https://www.insd.bf/sites/default/files/2021-12/Resultats_definitifs_RGPH_2006.pdf) records the publication programme but does not carry the religion tables. The thematic report is the source of record for the 2006 extraction.

## Category frames

French source spellings remain unchanged below. English terms are display labels only.

| Wave | French source category | English display label | Product role |
| --- | --- | --- | --- |
| 1996, 2006, 2019 | Animiste | Animist | religious affiliation |
| 1996, 2006, 2019 | Musulman | Muslim | religious affiliation |
| 1996, 2006, 2019 | Catholique | Catholic | religious affiliation |
| 1996, 2006, 2019 | Protestant | Protestant | religious affiliation |
| 1996, 2006, 2019 | Autre | Other religion | religious affiliation |
| 1996, 2006, 2019 | Sans religion | No religion | no religion |

The six published categories are mutually exclusive in the tabulations. No separate non-response category appears. The 2006 report states: “pour les enfants de moins de six ans il leur a été affecté la religion de leur mère ou celle de la personne ayant en charge l’enfant si la mère n’est pas dans le ménage”. The verified 2019 final-results report does not state an equivalent child-assignment rule. The 2019 catalogue instead describes general dynamic imputation for missing, incoherent, or invalid responses. Religious-change metrics are therefore withheld: the common category names and regional frame do not establish identical instruments or processing rules.

## Geography and the 1996 break

Burkina Faso’s 13-region frame post-dates the 1996 census. The verified 1996 report discusses ten economic regions and departments for population distribution, but its religion table is national only. No official correspondence or source re-tabulation was located that would place 1996 religion on the later 13-region frame. This lane does not invent one.

The 2006 thematic report publishes religion both by the 13 administrative regions and by 45 provinces. This probe verified only Table A5.5's 13 regional rows and national row. The provincial tables remain a documented but unverified extraction route. The 2019 final-results report publishes religion by the same 13 named regions. It does not publish the Table 10 religion categories by province or commune. The audit row should therefore say that the verified 2019 religion route is regional. Lower census geography exists only for other characteristics in the verified report.

## Denominator and outside-basis population

The verified 2006 regional denominator is the full resident population of 14,017,262. Across Table A5.5, the six exact category counts sum to each of the 13 printed regional totals and to the national total. The regional values also sum to the national value for every category. With no published non-response category, *Sans religion* remains inside the denominator and outside the religious-affiliation numerator. No corresponding computation was performed for the 45 provincial rows.

The 2019 religion denominator is the 18,171,838 people whose data were collected during enumeration. The report states that, except for the population-structure section and two named exceptions, later sections use collected data. The full resident population is 20,505,155 because the population-structure total includes estimates for localities not fully enumerated because of insecurity. The national outside-basis count is therefore 2,333,317. Region-level outside-basis counts are: Boucle du Mouhoun 139,085; Cascades 48,017; Centre 337,242; Centre-Est 152,280; Centre-Nord 450,262; Centre-Ouest 97,572; Centre-Sud 44,471; Est 363,804; Hauts-Bassins 192,864; Nord 139,551; Plateau Central 56,126; Sahel 261,803; and Sud-Ouest 50,240. Any future shipped surface must show these counts and must label the 2019 percentages as shares of the collected-person basis.

## Publication terms

Two cached pages inform the rights assessment. The INSD legal-page footer states “© 2020 INSD - Tous droits reservés”. The same page says that access to and use of published INSD data are subject to an external Open Data Agreement, but this probe did not capture that agreement. The 2019 microdata catalogue terms state: “Les données et autres matériels ne seront pas redistribués ou vendus à d'autres personnes, institutions ou organisations sans l'accord écrit l'INSD.” Those catalogue terms govern the 2019 microdata. They do not establish the publication licence for the cached census PDFs or a derived map product. Publication reuse rights therefore remain unresolved. Raw PDFs remain in the git-ignored cache. Even if the arithmetic gate is resolved, the derived product must remain staged until the applicable licence or permission establishes a release basis.

## Boundary source and release metadata

The proposed boundary is [geoBoundaries Burkina Faso administrative level 1 (ADM1) release metadata](https://www.geoboundaries.org/api/current/gbOpen/BFA/ADM1/). The cached release metadata states: boundary ID `BFA-ADM1-92566538`; canonical level `Region`; represented year `2017`; source `World Bank`; 13 units; and licence “Creative Commons Attribution 4.0 (CC BY 4.0)”. The metadata points to the pinned [GeoJSON](https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/BFA/ADM1/geoBoundaries-BFA-ADM1.geojson).

The unsimplified source geometry passed the read-only tests actually run: 13 features, no empty geometry, all features valid after `sf::st_make_valid()`, and 13 distinct geometry hashes. A census join, post-simplification validity test, post-simplification distinct-hash test, and the three-megabyte byte-cap test were not run because the row-reconciliation gate failed first.

## Retrieval record

All inputs were retrieved on 2026-07-10. `git check-ignore -v` confirms that `.gitignore` line 120 ignores `data/`, including every file under `data/raw/bf_census/`.

| Cached input | Exact URL | SHA-256 |
| --- | --- | --- |
| `bf_1996_rapport_rgph_1.pdf` | `https://microdata.insd.bf/index.php/catalog/42/download/253` | `3a2f2f50669d2ab21112a3b6637e8ace21ba26a5452db8bf3388261dc1fa200a` |
| `bf_2006_resultats_definitifs.pdf` | `https://www.insd.bf/sites/default/files/2021-12/Resultats_definitifs_RGPH_2006.pdf` | `4cbc00d91cf68dd5180ce063249625340f3cc8e8abd11a8774ba7ace6e8a6b73` |
| `bf_2006_theme2_etat_structure.pdf` | `https://www.insd.bf/sites/default/files/2021-12/Theme2-Etat_et_structure_de_la_population.pdf` | `722497af0da6a0e1a2a9826efbf42b3ffbb7b849a22edca0dcec9079a9d6419f` |
| `bf_2019_resultats_definitifs.pdf` | `https://www.insd.bf/sites/default/files/2022-07/Rapport%20resultats%20definitifs%20RGPH%202019.pdf` | `2684ed8c74970b730afb7467da6cc9f038fd2672e4323888198d57aae8bc4105` |
| `insd_mentions_legales.html` | `https://www.insd.bf/fr/mentions-legales` | `f2b7240fe5cb444b0f67b63d50f0a790bc4e2ba3a94ce4ce3d6fb63c89ff1e02` |
| `insd_rgph2019_catalog_terms.html` | `https://microdata.insd.bf/index.php/catalog/69` | `b1e7effdf831dfb8e9d65338ae7578d35a48589ae708db7f2684fc88915a30fd` |
| `gb_bfa_adm1_meta.json` | `https://www.geoboundaries.org/api/current/gbOpen/BFA/ADM1/` | `f5a39c5527d2b9a8ba069491a2577ad79711036ad5a0fa06edeb4215c669c604` |
| `geoBoundaries-BFA-ADM1.geojson` | `https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/BFA/ADM1/geoBoundaries-BFA-ADM1.geojson` | `07278161d8bfedf694914c2761caf673dd771ce3809ce417616b1c49813054d3` |

## Hard-gate result

- **PDF text layers**: passed. Poppler `pdftotext -layout` extracted the relevant 1996, 2006, and 2019 tables without optical character recognition.
- **2006 regional every-row reconciliation**: passed. Table A5.5's 13 regional rows and national row have exact category sums equal to printed totals.
- **2006 regional-to-national reconciliation**: passed. Each of the six Table A5.5 regional category sums and the 13 regional totals reproduce the national row exactly.
- **2006 provincial reconciliation**: not run. The 45 provincial rows in Tables A5.4–A5.6 were not transcribed or tested.
- **2019 population-basis reconciliation**: passed. The 13 collected-person effectifs sum exactly to 18,171,838; the 13 full resident totals sum exactly to 20,505,155; the outside-basis difference is 2,333,317.
- **2019 every-row category reconciliation**: passed under the derived bound. Cascades sums to 99.9; Centre-Est to 100.1; Centre-Sud to 100.1; Sahel to 99.9; and Sud-Ouest to 100.1. Each deviates by 0.1 from the printed 100.0 total, within the derived bound of 0.05 × 6 = 0.30 percentage points. The observed maximum absolute deviation is 0.1. No percentage was altered.
- **Change metric**: withheld. The 2006 exact counts on the full resident population and the 2019 rounded shares on the collected-person basis use different constructs and denominator bases; 1996 religion is national only and predates the 13-region frame.
- **Boundary release licence**: passed from release metadata. The source is World Bank and the licence is Creative Commons Attribution 4.0.
- **Source geometry**: passed for feature count, non-empty geometry, validity after repair, and distinct geometry hashes.
- **Simplified boundary**: passed. Mapshaper simplification produced 13 valid, non-empty, distinctly hashed geometries at 537,363 bytes, within the 3 MB cap; total geodesic land area is about 274,400 km², consistent with Burkina Faso.
- **Product schema validation**: passed. The area-summary output validates against `schemas/area-summary.schema.json` and the manifest validates against `schemas/data-manifest.schema.json` (both via `uvx check-jsonschema`).
- **Census publication rights**: unresolved (needs_review). The cached legal page contains an all-rights-reserved footer (“© 2020 INSD - Tous droits reservés”) and subjects published INSD data to a named Accord de licence de données ouvertes, linked from the page alongside the Open Data Portal (burkinafaso.opendataforafrica.org), whose text was not captured. The captured 2019 catalogue terms restrict redistribution of the microdata and related materials without written INSD agreement. The manifest records these strings verbatim; the PI follow-up on the external agreement stays open. Publication to staging proceeds under the PI ship ruling of 2026-07-10.
- **Product writing**: shipped to staging. `apps/regions/bf/data/area_summary_region.{json,csv}`, `apps/regions/bf/data/bf_region_2017.geojson`, and `docs/manifests/bf-census-religion-2006-2019.json` were written. The manifest carries `licence_status = needs_review`, `downstream_status = staged`, and `privacy = public`.

The builder is [`scripts/build_bf_area_summary.R`](../../../scripts/build_bf_area_summary.R). It keeps the 2006 exact gates and adds the 2019 derived-bound gate; both waves now pass and the staged product is written and schema-validated.

## Information-panel note (draft for the page lane)

2019 values are the source's published one-decimal percentages on the collected-person basis; five regional rows (Cascades, Centre-Est, Centre-Sud, Sahel, Sud-Ouest) sum to 99.9 or 100.1 by the source's own rounding, within the derived bound of 0.30 percentage points.
