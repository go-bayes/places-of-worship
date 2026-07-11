# Guinea census-religion route probe

Probe only; verified 2026-07-11. Guinea collected religion in all three modern censuses — RGPH-1 1983, RGPH-2 1996, RGPH-3 2014 — and the variable is coded in the IPUMS-International microdata for every wave. The published, non-microdata record is far thinner. Only one wave publishes religion below the national level, and only at the coarsest subnational tier: the RGPH-3 2014 thematic report "État et structure de la population" gives religion by the eight administrative regions, as one-decimal percentages with no counts. No published table gives religion by prefecture for any wave, and no published table gives subnational religion for 1983 or 1996. The build-queue row's "region and prefecture" and three-wave premise is not met by the published record; only a single-wave, eight-region, percentages-only product is supportable without the barred microdata.

The situation parallels Côte d'Ivoire's withheld 1998 case (rounded region percentages, no exact counts), not its shipped 2021 case. The one improvement over the CI 1998 case is licence: Guinea's INS routes data reuse to an "Accord de licence de données ouvertes" rather than reserving all rights, though the agreement text could not be byte-confirmed for Guinea (see Publication terms).

## Institution and publication routes

The Institut National de la Statistique (INS) of Guinea produces the census publications and hosts them at stat-guinee.org. INS also mirrors indicator data on the Knoema-hosted open-data portal guinea.opendataforafrica.org.

- [INS Guinea website](https://www.stat-guinee.org/)
- [RGPH3 project page](https://www.stat-guinee.org/index.php/projets/projets-realises/258-projet-rgph3)
- [RGPH3 thematic reports index ("Rapports d'enquêtes")](https://www.stat-guinee.org/index.php/publications-ins/rapports-d-enquetes)
- [INS open-data portal (Knoema)](https://guinea.opendataforafrica.org)
- [Legal / terms page ("Conditions Générales / Mentions légales")](https://www.stat-guinee.org/index.php/autres-publications-ssn/2-uncategorised/414-mention-legales)

The RGPH-3 was fielded 1 March – 2 April 2014; the resident population was 10,523,261. INS published ten thematic analytical reports ("Analyse des résultats définitifs"). Religion appears in exactly one of them, "État et structure de la population" (chapter 5.3). The other nine reports (habitations et cadre de vie, ménages, caractéristiques économiques, éducation, état matrimonial et nuptialité, migration, mortalité, natalité et fécondité, situation des femmes) do not carry a religion table. There is no separate socio-cultural-characteristics volume for Guinea comparable to Mali's or Côte d'Ivoire's.

## Waves and published geography

| Wave | Verified religion publication | Published geography | Format | Build usability |
| --- | --- | --- | --- | --- |
| RGPH-1 1983 | None located. Religion is coded in the IPUMS-International 1983 sample (universe: all persons), but no INS-published subnational or national religion table was pinned. The 2014 report's Table 5.11 covers only 1996→2014, not 1983. | none published | — | Not usable without barred microdata. |
| RGPH-2 1996 | Only via the RGPH-3 report: [RGPH3 "État et structure"](https://www.stat-guinee.org/images/Documents/Publications/INS/rapports_enquetes/RGPH3/RGPH3_etat_structure.pdf), Table 5.11 (retrospective). Religion is coded in the IPUMS 1996 sample (universe: household residents). The original RGPH-2 analytical volume was not located online; the [IHSN catalogue entry (id 408)](https://catalog.ihsn.org/index.php/catalog/408) documents no religion variable and offers no downloadable tables. | national only, by residence (urban / rural / ensemble) | one-decimal percent | Not usable subnationally. |
| RGPH-3 2014 | [RGPH3 "État et structure de la population"](https://www.stat-guinee.org/images/Documents/Publications/INS/rapports_enquetes/RGPH3/RGPH3_etat_structure.pdf), §5.3, Tables 5.09 / 5.10 / 5.11 | Table 5.10: eight administrative regions. Tables 5.09 / 5.11: national by residence and sex. No prefecture table. | one-decimal percent; no counts | Region-level percentages only, single wave. |

The only subnational religion table in the entire published record is **Table 5.10** (eight regions, 2014, percentages). Everything else is national.

## Category frames (verbatim, as printed)

### 2014 (RGPH-3), Tables 5.09 / 5.10 / 5.11 — five categories

The 2014 frame has five mutually exclusive categories (French label as printed → English display):

| French source category | English display label |
| --- | --- |
| Sans religion | No religion |
| Musulmane | Muslim |
| Chrétienne | Christian |
| Animiste | Animist |
| Autre religion | Other religion |

The rows total to `Ensemble` / `Total` = 100.

### 1996 (RGPH-2), Table 5.11 — same five categories

Table 5.11 ("Évolution des différentes religions selon le milieu de résidence de 1996 à 2014") prints the same five columns (`Sans religion`, `Musulmane`, `Chrétienne`, `Animiste`, `Autres religions`) for 1996 and 2014, by `Milieu de résidence` (Urbain / Rural / Ensemble). This is the only 1996 religion figure in the published record and it is national-by-residence, not subnational.

### 1983 (RGPH-1)

No published category frame located. The IPUMS-International variable documentation would carry the harmonised recode, but the microdata licence hold bars its use and the published INS 1983 frame was not pinned.

## Verbatim published tables (2014 report)

**Table 5.10 — Répartition de la population résidente par région de résidence selon la religion** (percent; the only subnational religion table). Reproduced from the cached PDF for the reconciliation record:

| Région administrative | Sans religion | Musulmane | Chrétienne | Animiste | Autres religions | Ensemble |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Boké | 0,3 | 96,8 | 2,8 | 0,1 | 0,0 | 100,0 |
| Conakry | 0,3 | 94,8 | 4,8 | 0,0 | 0,1 | 100,0 |
| Faranah | 0,8 | 89,1 | 9,7 | 0,1 | 0,2 | 100,0 |
| Kankan | 0,2 | 98,7 | 1,1 | 0,0 | 0,0 | 100,0 |
| Kindia | 0,5 | 97,2 | 2,3 | 0,0 | 0,0 | 100,0 |
| Labé | 0,2 | 99,4 | 0,4 | 0,0 | 0,0 | 100,0 |
| Mamou | 0,1 | 99,4 | 0,5 | 0,0 | 0,0 | 100,0 |
| N'Zérékoré | 14,2 | 46,7 | 28,1 | 10,4 | 0,6 | 100,0 |
| Ensemble | 2,4 | 89,1 | 6,8 | 1,6 | 0,1 | 100,0 |

**Table 5.11 — Évolution des différentes religions selon le milieu de résidence de 1996 à 2014** (percent; national by residence):

| Années | Milieu | Sans religion | Musulmane | Chrétienne | Animiste | Autres religions | Total |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1996 | Urbain | 0,9 | 91,7 | 6,9 | 2,7 | 0,1 | 100 |
| 1996 | Rural | 5,5 | 84,6 | 6,6 | 2,7 | 0,5 | 100 |
| 1996 | Ensemble | 4,1 | 86,8 | 6,7 | 2,0 | 0,4 | 100 |
| 2014 | Urbain | 0,6 | 91,7 | 7,4 | 0,2 | 0,1 | 100 |
| 2014 | Rural | 3,4 | 87,7 | 6,4 | 2,3 | 0,1 | 100 |
| 2014 | Ensemble | 2,4 | 89,1 | 6,8 | 1,6 | 0,1 | 100 |

Note the internal inconsistency in the source itself: the 1996 `Ensemble` Animiste (2,0) and the 2014 `Ensemble` do not fully reconcile with a naive urban/rural mean, and Table 5.09 gives the 2014 `Ensemble` as 2,4 / 89,1 / 6,8 / 1,6 / 0,1 — matching Table 5.11's 2014 `Ensemble` row. These are the source's own printed percentages; reproduce unchanged.

## Denominators for a possible count derivation

No published table gives religion counts at any subnational level. Region population totals are available in the same report (Table 2.09, "Répartition de la population résidente et taux d'accroissement intercensitaire par région administrative"), which prints resident totals for all three censuses on the same eight regions:

| Région | 1983 | 1996 | 2014 |
| --- | ---: | ---: | ---: |
| Boké | 508 724 | 760 119 | 1 083 147 |
| Conakry | 710 372 | 1 092 936 | 1 660 973 |
| Faranah | 425 160 | 602 845 | 941 554 |
| Kankan | 640 432 | 1 011 644 | 1 972 537 |
| Kindia | 555 937 | 928 312 | 1 561 336 |
| Labé | 642 617 | 799 545 | 994 458 |
| Mamou | 437 212 | 612 218 | 731 188 |
| N'Zérékoré | 740 128 | 1 348 787 | 1 578 068 |
| Ensemble | 4 660 582 | 7 156 406 | 10 523 261 |

A count layer could in principle be formed as region-population × Table-5.10 percent, but that is a derived estimate on percentages already rounded to 0.1 point (up to a few thousand persons of rounding slack per cell in the large regions), not a published count. Prefecture population totals also exist in the report (appendix Tables A.03/A.04/A.05, "par région et par préfecture de résidence selon le sexe"), but they carry no religion cross-tabulation, so they cannot support a prefecture religion layer.

## Boundaries and administrative structure

Guinea's structure is stable across the three census vintages as printed in Table 2.09: **eight administrative regions** (Boké, Conakry, Faranah, Kankan, Kindia, Labé, Mamou, N'Zérékoré), with Conakry a special-status region. Below the region sit **33 préfectures** plus Conakry (itself subdivided into five communes), then communes urbaines/rurales and sous-préfectures. The report states "trente-trois préfectures" and treats Conakry as a region rather than a prefecture. Because the eight regions are printed identically for 1983/1996/2014, the region layer joins across all waves without a concordance; the barrier is missing religion data, not shifting boundaries.

Recommended boundary source for the only feasible (region) product:

- **geoBoundaries GIN ADM1** — release metadata: `boundaryID` `GIN-ADM1-385441`, `boundaryYearRepresented` 2017, `admUnitCount` 8, `boundaryLicense` "Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO)", `licenseSource` `data.humdata.org/dataset/guinea-geodatabase`, `boundarySource` "World Food Programme, OCHA ROWCA". [ADM1 release metadata](https://www.geoboundaries.org/api/current/gbOpen/GIN/ADM1/); [ADM1 GeoJSON](https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/GIN/ADM1/geoBoundaries-GIN-ADM1.geojson). The eight ADM1 features match the eight census regions one-to-one by name (watch the apostrophe in "N'Zérékoré").
- **geoBoundaries GIN ADM2** (would be the prefecture layer if a prefecture religion table ever surfaced) — `boundaryID` `GIN-ADM2-49546643`, year 2017, `admUnitCount` 34 (33 prefectures + Conakry), same CC BY 3.0 IGO licence and WFP/OCHA ROWCA source. [ADM2 release metadata](https://www.geoboundaries.org/api/current/gbOpen/GIN/ADM2/); [ADM2 GeoJSON](https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/GIN/ADM2/geoBoundaries-GIN-ADM2.geojson). Not needed for the region-only product.

Both licence claims come from the release metadata, verified against the actual API records above (not the geoBoundaries site copy). No official INS boundary layer with a stated open licence was pinned; geoBoundaries ADM1 is the recommended source.

## Publication terms

Guinea's INS position is more favourable than Côte d'Ivoire's all-rights-reserved footer, but the operative open-data agreement could not be byte-confirmed for Guinea. Two byte-exact quotes from the raw HTML of the Conditions Générales page (`conditions_generales.html`, sha256 below):

> Conditions d’utilisation des données
> L’accès aux Données publiées par l'Institut national de la statistique, y compris les Données mises à disposition sur ce site web et sur https://guinea.opendataforafrica.org , ainsi que leur utilisation, sont soumis aux exigences énoncées dans l’Accord de licence de données ouvertes.
> https://guinea.opendataforafrica.org/hdemdob

> Droits de propriété
> Les éléments figurant sur ce site web, y compris les informations ainsi que tout programme logiciel disponible sur ce site web ou par son intermédiaire (« les Contenus »), sont protégés par le droit d’auteur, le droit des marques et d’autres formes de droits de propriété. Tous les droits, titres et intérêts relatifs aux Contenus sont détenus par l'INS, concédés sous licence à l'INS ou contrôlés par l'INS.

The tension to flag for the project lead. INS explicitly routes reuse of its published *Données* to an "Accord de licence de données ouvertes" (Open Data License Agreement), which points at `guinea.opendataforafrica.org/hdemdob` — the Knoema Open Data for Africa platform, whose standard terms are Creative Commons Attribution 4.0 (attribution + link, redistribution permitted). But that Guinea-specific agreement page returned HTTP 403 to automated fetching, so the CC BY 4.0 terms could **not** be byte-matched for Guinea; the CC BY 4.0 reading rests on the platform's general terms, not on the pinned Guinea page. In parallel, the same site's "Droits de propriété" clause asserts copyright over site *Contenus* held by INS. Whether region-level percentages transcribed from a thematic-report PDF fall under the open-data-licensed *Données* or the copyright-reserved *Contenus* is the unresolved question. This is the Iran-style unknown-open-licence-with-attribution situation and needs an explicit project-lead ruling before any derived Guinea table is published; it should not be decided in this lane. If the ruling treats the figures as open, INS/RGPH-2014 attribution would apply.

## Retrieval record

All inputs retrieved 2026-07-11, cached under `data/raw/gn_census/` (gitignored).

| Cached input | sha256 |
| --- | --- |
| `RGPH3_etat_structure.pdf` | `76e06c3ba6cac3130319bffe1aa8889c1d5b43b5587ced5244c423e78df1264a` |
| `RGPH3_caracteristiques_des_menages.pdf` (checked; no religion table — negative control) | `ac34c60d0f7a316570a9e98d8c4edfc50028456a007af87caa85639c39160853` |
| `conditions_generales.html` (INS terms page, source of the licence quotes) | `44ef8778256d5f3b5afde6f2811dbb1f7f27aed02e470be8209d014bc83d5bbb` |

Not yet cached (would be needed for a build): geoBoundaries GIN ADM1 metadata + GeoJSON; and a verified capture of the `hdemdob` open-data licence text (currently 403 to automated fetch).

## Blockers

1. **No prefecture religion, any wave.** The build-queue row promises "region and prefecture"; the published record delivers only region (2014), and only as percentages. Prefecture religion exists only in the barred IPUMS microdata.
2. **Single wave only.** Subnational religion is published for 2014 alone. 1983 and 1996 have no published subnational religion (1996 survives only as a national urban/rural row in the 2014 report; 1983 not at all). No subnational time series is possible from published sources.
3. **Percentages, not counts.** Table 5.10 gives one-decimal percentages with no counts. A count layer would be a derived estimate (region total × rounded percent), not a published figure.
4. **Licence not byte-confirmed.** The open-data agreement that would authorise reuse is referenced but its Guinea-specific text (`hdemdob`) is 403-blocked; the copyright clause covers site "Contenus" in parallel. Needs a project-lead ruling.
5. **Microdata barred.** IPUMS-International carries religion for all three waves at fine geography, but the licence hold stands; documentation confirms the variable exists but cannot seed a product.

## Build / hold recommendation

**HOLD**, pending a project-lead ruling, with a narrow build option if the lead accepts it.

The only product the published record supports is a **single-wave (2014), eight-region, five-category religion-percentage choropleth**, boundaries geoBoundaries GIN ADM1 (CC BY 3.0 IGO), source INS RGPH-2014 Table 5.10, no counts and no time series. This is thinner than the queue row envisages and sits at the CI-1998-withheld end of precedent (rounded region percentages, no exact counts) rather than the CI-2021-shipped end. Two questions must clear before any build:

- Does an eight-region, single-wave, percentages-only product meet the project's subnational bar, or does it fall below it as the CI 1998 region case did? (Argument for building anyway: N'Zérékoré's 46,7 % Muslim / 28,1 % Christian / 10,4 % Animist split against the near-uniform 95–99 % Muslim north is a genuine, map-worthy subnational contrast that a national figure hides.)
- Does the "Accord de licence de données ouvertes" cover transcribed thematic-report percentages, or does the "Droits de propriété" copyright clause govern them? (Iran-style flag; do not decide in this lane.)

If the lead rules the eight-region 2014 product acceptable and the figures open, the build is small and low-risk: transcribe the nine data rows of Table 5.10, join to the eight ADM1 features by name, ship percentages with INS attribution and a clear "2014 only, region level, percentages" note. If either ruling is negative, the country is a documented exclusion (Tier C) on the "no published subnational religion beyond a single coarse wave" and/or licence grounds.
