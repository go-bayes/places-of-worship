# Mali census-religion route probe

Probe only; no build, no commit. Verified 2026-07-11. Mali collected religion in the 2009 (RGPH-4) and 2022 (RGPH-5) censuses, and INSTAT publishes both in open thematic reports under a clean Creative Commons Attribution 4.0 licence. The published *subnational* record is one wave, not two. The 2022 RGPH-5 "État et structure" report gives religion by the twenty-unit 2023 administrative frame (nineteen régions plus the District de Bamako) as one-decimal percentages with a region total-population column; per-category counts by region are not printed. The 2009 RGPH-4 "État et structure" report, the file the audit row pins, publishes religion **nationally only** — a single table by urban/rural residence and sex (Tableau 4.6). No religion-by-region table appears anywhere in the 2009 volume, and INSTAT's 2009 analytical series carries no socio-cultural-characteristics volume that would add one. The queue premise ("2009, 2022 | region") therefore holds for 2022 and fails for 2009.

The verdict is **HELD**, on two independent gates. First, the subnational record is single-wave (2022 only) and percentages-only, so no region time series and no published region counts exist. Second, and decisively, no open boundary layer matches the twenty-unit 2022 census frame: geoBoundaries gbOpen MLI ADM1 is the pre-2016 nine-unit frame (eight regions plus Bamako), gbHumanitarian ADM1 is a 2015 ten-unit frame, and the HDX COD-AB became out of date at the 2023 reorganisation, with OCHA still consulting the DNCT on a new layer. The 2022 twenty-unit frame is a hybrid — ten of its units are former cercles present in geoBoundaries ADM2 (50 cercles, 2017), the other ten are region-level — so assembling it would require an official cercle-to-new-region concordance the project does not invent. The one clean edge is licence: unlike the Guinea/Burkina Faso vacuum, INSTAT states CC-BY 4.0 over its published datasets and over derived tables and graphs, with a specified attribution format.

## Build decision (recommendation to the conductor)

- **Recommendation**: HOLD. The only feasible product is a single-wave (2022), twenty-unit, seven-category religion-percentage choropleth, and it is blocked on the boundary, not the licence. The licence gate is effectively clear (CC-BY 4.0, quoted below).
- **Candidate wave**: 2022 (RGPH-5) alone, at region level. 2009 subnational is not published; 2009 contributes only a national anchor (94,8 % Muslim) already reproduced inside the 2022 report's own evolution table.
- **Candidate geography**: 20 units (19 régions + District de Bamako) on the 2023 territorial frame. No matching open boundary layer exists; this is the binding blocker.
- **Construct**: census affiliation. Each ordinary-household resident's declared religion of belonging (2009: "il a été demandé à toutes les personnes dénombrées d'indiquer leur religion d'appartenance"); not practice or attendance.
- **Format**: one-decimal percentages per category plus a region total-population count (Effectifs). No per-category counts by region are printed in either report's État-et-structure volume; a count layer would be derived (region total × rounded percent), never published.
- **Map-worthy pattern**: the near-uniform 95–99,8 % Muslim majority breaks sharply in the south-centre — San is 70,1 % Muslim / 17,0 % Christian (9,6 Catholic + 7,2 Protestant + 0,2 other) / 8,3 % Animist, with Koutiala (91,6 % Muslim, 3,1 % Animist) and Bandiagara (94,0 % Muslim, 6,0 % Christian) the next most diverse. This south-centre Dogon/Minianka belt is the reason to map Mali subnationally, and a national figure hides it.

## Published waves and geography

| Wave | Official INSTAT publication | Religion table | Published geography | Format | Decision |
| --- | --- | --- | --- | --- | --- |
| RGPH-4 2009 | [*Rapport d'analyse … sur l'état et la structure de la population, RGPH 2009* (`rastr09_rgph.pdf`)](https://www.instat-mali.org/laravel-filemanager/files/shares/rgph/rastr09_rgph.pdf), Tableau 4.6 | Tableau 4.6 "Distribution en pourcentage de la population résidente par milieu de résidence, par sexe selon l'appartenance religieuse" | **national only** — urban/rural × sex. No region table exists in the volume; Tableau 4.11 (religion des étrangers) is also national. | one-decimal percent | National context only. No subnational route. |
| RGPH-5 2022 | [*Rapport d'analyse des données du RGPH5 sur l'état et la structure de la population* (`rapport-etat-structure-population-rgph5-rgph.pdf`)](https://www.instat-mali.org/laravel-filemanager/files/shares/rgph/rapport-etat-structure-population-rgph5-rgph.pdf), Tableau 6.13 | Tableau 6.13 "Répartition (effectif et %) de la population résidente des ménages ordinaires par religion selon la région" | **20 units** (19 régions + District de Bamako), 2023 frame | one-decimal percent per category + region total (Effectifs); no per-category counts | Region-level percentages; blocked on boundary. |

INSTAT's own [RGPH publications index](https://www.instat-mali.org/fr/publications/recensement-general-de-la-population-et-de-lhabitat-rgph) lists, for RGPH-4 2009, only état/structure, natalité/fécondité, état matrimonial/nuptialité, and the raw démographique série — no "caractéristiques socioculturelles / culturelles" analytical volume. RGPH-5 2022 does list a separate "Rapport … sur les caractéristiques culturelles de la population" (not the file probed here); that volume is a recorded but unverified deeper route that may carry finer geography or per-category counts. The 2009 methodological variable plan (Tableau of indicators, item 21) *defines* "pourcentage de la population par religion" as computable at "Pays, région (urbain/rural) et cercle", but the État-et-structure volume publishes only the national tabulation.

## Category frames (verbatim, French as printed, accents exact)

### 2022 (RGPH-5), Tableau 6.13 — seven categories

| French source category | English display label | Product role |
| --- | --- | --- |
| Musulmane | Muslim | religious affiliation |
| Catholique | Catholic | religious affiliation |
| Protestante | Protestant | religious affiliation |
| Autre religion Chrétienne | Other Christian | religious affiliation |
| Animiste | Animist | religious affiliation |
| Sans religion | No religion | no religion |
| Autre Religion | Other religion | religious affiliation |

Column header printed as `Ensemble` (= 100,0) followed by `Effectifs` (region total). The milieu table (Tableau 6.12) prints the same seven categories with the header spelling `Protestant` and `Autres religion chrétienne`; use the region-table spellings above as the product frame.

### 2009 (RGPH-4), Tableau 4.6 — six categories (national only)

| French source category | English display label |
| --- | --- |
| Musulman | Muslim |
| Chrétien | Christian |
| Animiste | Animist |
| Autre religion | Other religion |
| Sans religion | No religion |
| ND (non déclaré) | Not stated |

The 2009 frame keeps Christianity as one line (`Chrétien`); 2022 splits it into Catholique / Protestante / Autre chrétienne. The 2009 frame carries an explicit non-response line (`ND`); the 2022 region table has none. The two frames are not identical, so a category-level 2009→2022 change is not directly readable below the national Muslim/Christian/Animist spine.

## Verbatim published table (2022 region religion, Tableau 6.13)

Percent per category; final column is the region total population (ordinary-household residents). Reproduced from the cached PDF for the reconciliation record.

| Région | Musulmane | Catholique | Protestante | Autre chrét. | Animiste | Sans religion | Autre Religion | Ensemble | Effectifs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Kayes | 98,8 | 0,5 | 0,2 | 0,0 | 0,0 | 0,4 | 0,1 | 100,0 | 1 826 564 |
| Koulikoro | 95,3 | 1,4 | 0,6 | 0,1 | 0,7 | 1,4 | 0,5 | 100,0 | 2 246 154 |
| Sikasso | 96,3 | 1,0 | 0,4 | 0,1 | 0,9 | 1,0 | 0,3 | 100,0 | 1 528 398 |
| Ségou | 98,5 | 0,8 | 0,5 | 0,0 | 0,0 | 0,1 | 0,1 | 100,0 | 2 208 847 |
| Mopti | 99,1 | 0,5 | 0,3 | 0,0 | 0,0 | 0,1 | 0,0 | 100,0 | 842 209 |
| Tombouctou | 99,7 | 0,2 | 0,0 | 0,1 | 0,0 | 0,0 | 0,0 | 100,0 | 693 719 |
| Gao | 99,5 | 0,3 | 0,0 | 0,2 | 0,0 | 0,0 | 0,0 | 100,0 | 679 911 |
| Kidal | 99,7 | 0,2 | 0,0 | 0,1 | 0,0 | 0,0 | 0,0 | 100,0 | 79 324 |
| Taoudenni | 99,8 | 0,2 | 0,0 | 0,0 | 0,0 | 0,0 | 0,0 | 100,0 | 99 499 |
| Ménaka | 99,7 | 0,3 | 0,0 | 0,0 | 0,0 | 0,0 | 0,0 | 100,0 | 225 223 |
| Nioro | 99,7 | 0,1 | 0,0 | 0,0 | 0,0 | 0,2 | 0,0 | 100,0 | 668 966 |
| Kita | 98,8 | 0,6 | 0,2 | 0,1 | 0,0 | 0,3 | 0,0 | 100,0 | 680 380 |
| Dioïla | 98,5 | 0,8 | 0,2 | 0,0 | 0,0 | 0,5 | 0,0 | 100,0 | 674 419 |
| Nara | 99,6 | 0,1 | 0,1 | 0,0 | 0,2 | 0,0 | 0,0 | 100,0 | 278 904 |
| Bougouni | 98,9 | 0,6 | 0,3 | 0,0 | 0,0 | 0,2 | 0,0 | 100,0 | 1 567 533 |
| Koutiala | 91,6 | 1,8 | 2,4 | 0,1 | 3,1 | 0,7 | 0,3 | 100,0 | 1 153 375 |
| San | 70,1 | 9,6 | 7,2 | 0,2 | 8,3 | 3,7 | 0,9 | 100,0 | 815 185 |
| Douentza | 99,6 | 0,1 | 0,2 | 0,0 | 0,0 | 0,1 | 0,0 | 100,0 | 147 229 |
| Bandiagara | 94,0 | 4,1 | 1,9 | 0,0 | 0,0 | 0,0 | 0,0 | 100,0 | 720 279 |
| Bamako | 97,6 | 1,5 | 0,7 | 0,1 | 0,0 | 0,1 | 0,0 | 100,0 | 4 211 468 |
| Ensemble | 96,4 | 1,4 | 0,8 | 0,1 | 0,7 | 0,5 | 0,1 | 100,0 | 21 347 587 |

## Reconciliation anchors (verified in the probe)

- **Effectifs margin**: the twenty region totals sum to 21 347 586 against the printed Ensemble 21 347 587 — a one-person discrepancy, a source rounding/print artefact, re-read directly from the PDF, not tuned. Any build records it as the source's own arithmetic.
- **Row percentages**: every printed region row and the Ensemble row sum to 100,0 across the seven categories (spot-verified San 70,1+9,6+7,2+0,2+8,3+3,7+0,9 = 100,0; Koutiala 91,6+1,8+2,4+0,1+3,1+0,7+0,3 = 100,0). A build would apply the GN/BF derived-rounding-bound gate (0,05 × 7 = 0,35 pp) rather than an exact-100,0 gate.
- **National anchor across sources**: the Tableau 6.13 Ensemble row (96,4 Muslim / 1,4 Catholic / 0,8 Protestant / 0,1 other Christian / 0,7 Animist / 0,5 none / 0,1 other) equals the Tableau 6.12 milieu-table Ensemble column and the Tableau 6.14 evolution row for 2022 exactly.
- **Cross-wave national anchor**: Tableau 6.14 "Évolution des proportions (%) … de 2009 à 2022" prints 2009 = 94,8 Muslim / 2,4 Christian / 2,0 Animist / 0,0 other / 0,6 none / 0,2 ND and 2022 = 96,4 / 2,3 / 0,7 / 0,1 / 0,5 / 0,0. The 2009 figures match Tableau 4.6's national Ensemble total (94,84 / 2,37 / 2,02 / 0,04 / 0,45 / 0,28) after rounding. This is the only 2009↔2022 comparison the published record supports, and it is national.

## Universe and denominator

The 2022 religion table counts the **resident population of ordinary households** (`population résidente des ménages ordinaires`), 21 347 587 persons — not the full de jure population. The RGPH-5 total (`population totale (population de droit)`) is 22 395 489; the religion denominator is about 95,3 % of it, the difference being collective households and populations outside ordinary households. Any shipped surface must label the 2022 percentages as shares of the ordinary-household resident population, not the full de jure count. The 2009 table counts resident population by residence and sex, nationally.

## Security-coverage caveat (2022, exact as stated)

The 2022 census was fielded 15 June – 31 July 2022, but the report states the northern regions were enumerated later for security reasons: "les populations des régions de Ménaka et de Kidal ont été recensées respectivement en septembre et décembre 2022." Kidal's ordinary-household population is small (79 324 in Tableau 6.13; total-population figure 83 192). The report also carries an insecurity-displacement table (Tableau 4.11, "population … qui se sont déplacés pour cause d'insécurité par région"). Record these exactly; do not infer undercoverage beyond what the source states.

## Publication terms (licence)

Mali's position is the strongest in the West Africa tranche: an explicit CC-BY 4.0 grant that names derived tables and graphs. From the cached [`Conditions d'utilisation.pdf`](https://www.instat-mali.org/laravel-filemanager/files/shares/doc/Conditions%20d'utilisation.pdf) (sha256 below), verbatim:

> Toutes les données et jeux de données publiés par l'Institut National de la Statistique du Mali (INSTAT) sur ce site web accessible sont fournis sous la licence internationale Creative Commons Attribution 4.0 (CC-BY 4.0). … L'utilisation de données dérivées des jeux de données, présentées sous forme de tableaux et de graphiques, est également soumise à ces conditions.

> L'attribution doit être formatée de la manière suivante : l'INSTAT : Nom du jeu de données : Lien du jeu de données.

The document grants share and derivative rights, requires attribution and retention of copyright/licence notices, and carries only standard no-endorsement and limitation-of-liability clauses (no non-commercial or share-alike restriction). The site footer reads "Copyright © 2020 / Institut National de la Statistique - INSTAT". Because the census PDFs are datasets published by INSTAT on the site, and the terms explicitly extend to derived tables and graphs, transcribed region percentages fall squarely under CC-BY 4.0. This is a clean accept, subject to the standard PI confirmation; it is not the Guinea/BF unresolved-vacuum case. The required attribution string for a build would be `INSTAT : Rapport d'analyse des données du RGPH5 sur l'état et la structure de la population : <URL>`.

## Boundary route and the binding blocker

No open boundary layer represents the twenty-unit 2022 census frame. The 2023 territorial reorganisation created nineteen régions plus the District de Bamako; the available layers all predate it.

- **geoBoundaries gbOpen MLI ADM1** — `boundaryID` `MLI-ADM1-92416918`, `boundaryYearRepresented` 2021, `admUnitCount` **9**, source "DNCT … / UN OCHA Mali", licence "Creative Commons Attribution 4.0 International (CC BY 4.0)", `licenseSource` `data.humdata.org/dataset/administrative-boundaries-cod-mli`. [Metadata](https://www.geoboundaries.org/api/current/gbOpen/MLI/ADM1/); [GeoJSON](https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/MLI/ADM1/geoBoundaries-MLI-ADM1.geojson). The nine `shapeName` values are Bamako, Gao, Kayes, Kidal, Koulikouro, Mopti, Segou, Sikasso, Tombouctou — the pre-2016 frame; it lacks even Taoudénit and Ménaka (operational 2016), let alone the 2023 régions. Does **not** match the census.
- **geoBoundaries gbHumanitarian MLI ADM1** — 2015, `admUnitCount` 10, CC BY 3.0 IGO. Also pre-2023; does not match.
- **geoBoundaries gbOpen MLI ADM2** — `admUnitCount` **50** cercles (2017), CC BY 4.0. Ten of the twenty 2022 units appear here as cercles (Bandiagara, Bougouni, Dioila, Douentza, Kita, Koutiala, Menaka, Nara, Nioro, San); the other ten are region-level. Reconstructing the twenty-unit frame from ADM2 would require an official DNCT/INSTAT cercle-to-new-region concordance — invention the project forbids.
- **HDX COD-AB (`cod-ab-mli`)** — the humanitarian common operational dataset; per its own record it went out of date at the 2023 reorganisation, with OCHA consulting the DNCT on a replacement. The updated nineteen-region layer was not located as an open, licensed file in this probe.

The clean unblock is an official 2023 nineteen-region boundary layer (INSTAT `Répertoire des localités du Mali en 2023`, DNCT, or an updated OCHA COD-AB) with a stated open licence, joined 1:1 to the Tableau 6.13 rows by name. Until then the boundary is a genuine HOLD.

## Microdata (documented HOLD)

IPUMS-International holds Mali samples for 1987, 1998, and 2009; the harmonised RELIGION variable is coded for the 2009 sample only (not 1987/1998). The microdata would carry religion at fine geography for 2009, but the licence hold stands — it documents that the variable exists and cannot seed a product. No 2022 microdata sample is in IPUMS yet. This is metadata only.

## Retrieval record

All inputs retrieved 2026-07-11, cached under `data/raw/ml_census/` (gitignored via `.gitignore:120` `data/`). Content type verified on every download (report objects `application/pdf`; metadata `application/json`; GeoJSON valid JSON).

| Cached input | Source URL | sha256 |
| --- | --- | --- |
| `ml_2022_etat_structure_rgph5.pdf` | https://www.instat-mali.org/laravel-filemanager/files/shares/rgph/rapport-etat-structure-population-rgph5-rgph.pdf | `4d41cfc2e5431f96c426f379260311c99925f8b6177b8823f4c0afb306207854` |
| `ml_2009_etat_structure_rgph4.pdf` | https://www.instat-mali.org/laravel-filemanager/files/shares/rgph/rastr09_rgph.pdf | `79337d64d1e3fbf34b72dd0beff0a93caee097c3b64891b76cab5397ff36163a` |
| `instat_conditions_utilisation.pdf` (licence, source of the quotes) | https://www.instat-mali.org/laravel-filemanager/files/shares/doc/Conditions%20d'utilisation.pdf | `85496d2ef58280a4100cf317e20934bac93634e391382fb3605df819d29f2e78` |
| `instat_home.html` (footer + terms link) | https://www.instat-mali.org/fr | `9ac7f780027cc9899de4ab878030c49281b3838661cfb98fc79e315359d00188` |
| `gb_mli_ADM1_meta.json` | https://www.geoboundaries.org/api/current/gbOpen/MLI/ADM1/ | `0ca56dfa5915e2bdb277244f7a9b7d7f4a118611a384eea4afca11cf8e78eda6` |
| `geoBoundaries-MLI-ADM1.geojson` | https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/MLI/ADM1/geoBoundaries-MLI-ADM1.geojson | `a6429c61fad1f7a6ecde13f06046b754e7a692b844b1d91e538de164eb322af5` |
| `gb_mli_ADM2_meta.json` | https://www.geoboundaries.org/api/current/gbOpen/MLI/ADM2/ | `abf07152a8373f35263cdb7c401e610c4905beb619fd43c60fdaeeee3fcc0a86` |
| `geoBoundaries-MLI-ADM2.geojson` | https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/MLI/ADM2/geoBoundaries-MLI-ADM2.geojson | `24f8d8f59445ff5d3b37bb0e79fb33628e356a98a4658fbc82cd7a4f99f02a82` |
| `gb_mli_ADM3_meta.json` | https://www.geoboundaries.org/api/current/gbOpen/MLI/ADM3/ | `c56e5b3b6c8e593a9d66c6eea607d216383c4ef9c982373c225bcadbb7caaee3` |
| `gb_hum_mli_ADM1_meta.json` | https://www.geoboundaries.org/api/current/gbHumanitarian/MLI/ADM1/ | `539694110824fd3b0b421804e52c47a139b1cda1aedc90471e649d3a0423c6c4` |

Derived working files also present (not source objects): `ml_2022_etat_structure_rgph5.txt`, `ml_2009_etat_structure_rgph4.txt` (pdftotext `-layout` extractions).

## Holds

1. **2009 has no subnational religion.** The pinned 2009 État-et-structure volume publishes religion nationally only (Tableau 4.6, urban/rural × sex); no region table exists, and INSTAT's 2009 analytical series carries no socio-cultural volume that would add one. The audit row's "2009 … region" premise is not met.
2. **Single wave subnationally.** Region religion is published for 2022 alone. No subnational time series is possible; the only 2009↔2022 comparison in the record is national (Tableau 6.14).
3. **Percentages, not counts.** Tableau 6.13 prints one-decimal percentages plus a region total; per-category region counts are not published. A count layer would be a derived estimate.
4. **No matching open boundary.** The twenty-unit 2022 frame post-dates every available open layer (gbOpen ADM1 = 9, gbHumanitarian ADM1 = 10, HDX COD-AB out of date at 2023); ten units survive as ADM2 cercles but the other ten are region-level, and no concordance is invented. This is the binding blocker.
5. **Microdata barred.** IPUMS 2009 carries RELIGION at fine geography, but the licence hold stands; documentation only.

## Premise divergences from the build-queue row

- The row reads "2009, 2022 | region". Subnational religion is published for **2022 only**; 2009 is national-only in the pinned source. The two-wave region premise fails.
- The row reads "census affiliation … clean PDF … PDF extraction per BS precedent". The extraction target exists and is clean text, but the 2022 product is **percentages plus a region total**, not the per-category counts the BS (count-table) precedent implies. The arithmetic gate is the GN/BF derived-rounding-bound, not the exact-count reconciliation.
- The row implies a buildable region product. The genuine blocker is the **boundary**, not the data or the licence: no open layer matches the 2023 twenty-unit frame, and the licence (CC-BY 4.0) is unusually clean.
