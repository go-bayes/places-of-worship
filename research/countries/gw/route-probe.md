# Guinea-Bissau census-religion route probe

Probe verified 2026-07-12. Guinea-Bissau's third general census (3º Recenseamento Geral da População e Habitação, RGPH-2009) collected religion, and the national statistics office (Instituto Nacional de Estatística, INE) published a sociocultural thematic report that tabulates religion by region. The report's Quadro 4 gives the religious composition of the eight administrative regions and the Autonomous Sector of Bissau as one-decimal percentages with no counts; Quadro 3 and Quadro 5 give national counts. The published record therefore supports a single-wave (2009), nine-unit, six-category religion-percentage product for the exact frame the build-queue row names ("region and Autonomous Sector of Bissau"). The regional table is percentages-only; the product therefore follows the Guinea (GN) precedent: nulls for regional counts, published shares carried, no count derived from any percentage. The one census that publishes subnational religion, the frame that matches the boundary layer one-to-one, and a clean text layer together make this a clean build; the only open question is publication reuse (all-rights-reserved footer, no located open licence), which follows the Burkina Faso (BF) build-then-ask precedent as needs_review.

## Institution and publication routes

The INE of Guinea-Bissau produces the census publications and hosts them at stat-guinebissau.com.

- [INE Guinea-Bissau website](https://www.stat-guinebissau.com/)
- [RGPH-2009 sociocultural characteristics report (source of record)](https://www.stat-guinebissau.com/Menu_principal/IV_RGPH/rgph1/caracteristicas_socio_cultural.pdf)

The report title page reads "TERCEIRO RECENSEAMENTO GERAL DA POPULAÇÃO E HABITAÇÃO - 2009"; the URL path segment `IV_RGPH/rgph1` is a website-menu artefact, not the census number. The census enumerated 1,449,230 residents in households; the sociocultural analysis (ethnicity, religion, dialect) covers the resident population of Guinean nationality, 1,442,227 persons. The report is a single clean PDF (92 pages, text layer intact, no optical character recognition needed).

## Wave and published geography

| Wave | Verified religion publication | Published geography | Format | Build usability |
| --- | --- | --- | --- | --- |
| RGPH-2009 | [Sociocultural characteristics report](https://www.stat-guinebissau.com/Menu_principal/IV_RGPH/rgph1/caracteristicas_socio_cultural.pdf), Quadro 4 (region), Quadro 3 / Quadro 5 (national) | Quadro 4: eight administrative regions plus the Autonomous Sector of Bissau (nine subnational columns, plus the national Guiné-Bissau column). Quadro 3/5: national. | Quadro 4 one-decimal percent, no counts; Quadro 3/5 exact counts | Nine-unit regional percentages, single wave. National counts for context only. |

Quadro 4 is the only subnational religion table. Quadro 3 (religion by sex) and Quadro 5 (religion by ethnicity) are national. No earlier Guinea-Bissau census (1979 first census, 1991 second census) is present in this report, and no subnational religion for those waves was located; this lane ships the 2009 wave only.

## Category frame (verbatim, as printed)

The 2009 frame has six mutually exclusive categories, printed in Portuguese (source label → English display):

| Portuguese source category | English display label | Product role |
| --- | --- | --- |
| Animista | Animist | religious affiliation |
| Muçulmana | Muslim | religious affiliation |
| Cristão | Christian | religious affiliation |
| Outra Religião | Other religion | religious affiliation |
| Sem religião | No religion | no religion |
| ND | Not declared | non-response (inside the denominator, outside both numerators) |

The `ND` (não declarado, not declared) share is large: 15,9 % nationally, and 10,5 %–25,7 % across regions. The report warns on the same page that "uma percentagem relativamente importante (15,9%) dos entrevistados não responderam à esta pergunta … os resultados apresentados devem ser utilizados com algum cuidado". `ND` is a real non-response category that partitions the denominator; the product keeps it inside the denominator and outside both the affiliation numerator and the no-religion metric, exactly as printed. `Sem religião` is a distinct real non-affiliation slot (ordinary slot semantics, not a flat-frame product).

## Verbatim published tables

**Quadro 4 — Distribuição percentual da população de nacionalidade guineense segundo região por religião** (percent; the shipped subnational table). Reproduced from the cached PDF (page 30) for the reconciliation record. Decimal commas as printed:

| Religião | Guiné-Bissau | Tombali | Quinara | Oio | Biombo | B. Bijagós | Bafatá | Gabú | Cacheu | SAB |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| TOTAL | 100 | 100 | 100 | 100 | 100 | 100 | 100 | 100 | 100 | 100 |
| Animista | 14,9 | 24,1 | 6,2 | 20,8 | 40,1 | 24,6 | 3,9 | 0,3 | 34,0 | 7,9 |
| Muçulmana | 45,1 | 43,0 | 45,8 | 42,1 | 6,3 | 14,9 | 77,1 | 86,5 | 14,8 | 34,2 |
| Cristão | 22,1 | 14,7 | 19,4 | 15,8 | 30,2 | 30,7 | 6,8 | 2,6 | 30,7 | 40,2 |
| Outra Religião | 0,0 | 0,0 | 0,0 | 0,0 | 0,0 | 0,0 | 0,0 | 0,0 | 0,2 | 0,0 |
| Sem religião | 2,0 | 0,4 | 7,1 | 0,9 | 2,5 | 4,2 | 0,9 | 0,1 | 3,0 | 3,3 |
| ND | 15,9 | 17,8 | 21,5 | 20,5 | 20,8 | 25,7 | 11,3 | 10,5 | 17,3 | 14,4 |

`SAB` is the Sector Autónomo de Bissau (the capital city, an administrative unit outside the eight regions). `B. Bijagós` is the Região de Bolama/Bijagós.

**Quadro 3 — População de nacionalidade guineense segundo sexo por religião** (national counts; the `Efectivos`/Total column). Reproduced for the national reconciliation:

| Religião | Efectivos (Total) |
| --- | ---: |
| Guiné-Bissau | 1 442 227 |
| Animista | 215 130 |
| Muçulmana | 650 402 |
| Cristã | 318 021 |
| Outra religião | 414 |
| Sem religião | 29 542 |
| ND | 228 718 |

The six category counts sum to the national total exactly: 215 130 + 650 402 + 318 021 + 414 + 29 542 + 228 718 = 1 442 227. Quadro 5's Total row prints the same seven figures. The national counts appear only here (national level); no regional count table exists.

## Denominators and a possible count derivation

No published table gives religion counts at any subnational level. Quadro 4 is column percentages (each region column sums to 100 down the six categories) of that region's Guinean-nationality resident population. A regional count layer would need each region's Guinean-nationality population total; those totals are not in this table, and multiplying rounded percentages by a region total would produce a derived estimate, not a published count. Following the GN precedent, the product ships percentages only, with all count fields null. The national counts (Quadro 3/5) are recorded as documented context in the manifest, never multiplied into regional shares.

The national percentages cross-check the counts. Each Quadro 3/5 national count as a share of 1 442 227 reproduces the Quadro 4 Guiné-Bissau column within one printed decimal: Animista 215 130/1 442 227 = 14,9; Muçulmana 45,1; Cristão 22,1; Outra 0,0; Sem religião 2,0; ND 15,9. This anchors the column-percent interpretation and the Guinean-nationality universe.

## Source narrative-versus-table discrepancies (table trusted)

The report's prose (section 3.4.2) disagrees with Quadro 4 in two places. Both are prose wording errors; the tabulated Quadro 4 is internally consistent (every region column sums to 100 within rounding) and is the source of record.

1. **Oio, Muçulmana.** The prose reads "Em Oio, os muçulmanos correspondem a 47,1%"; Quadro 4 prints 42,1. With 47,1 the Oio column would sum to 105,1, which is impossible; with 42,1 it sums to 100,1 (within the rounding bound). The table value 42,1 is trusted.
2. **Gabú / Bafatá order.** The prose reads "as regiões de Gabú e Bafata … a religião muçulmana (77,1% e 86,5% respectivamente)", assigning 77,1 to Gabú and 86,5 to Bafatá. Quadro 4 prints Bafatá 77,1 and Gabú 86,5. With the table values each column sums to 100,0; with the prose order both columns break (109,4 and 90,6). The table assignment is trusted.

Neither discrepancy alters a shipped value; both are disclosed in the manifest.

## Derived rounding bound

Each Quadro 4 percentage is printed to one decimal, carrying a maximum rounding error of 0,05 percentage points (half the 0,1 print step). The six mutually exclusive categories partition each region's population; a printed region column can therefore differ from 100,0 by at most 0,05 × 6 = 0,30 percentage points (the Estonia / BF-2019 derived-bound precedent, never an arbitrary tolerance). Observed deviations: Oio +0,1, Biombo −0,1, B. Bijagós +0,1; every other column sums to exactly 100,0. The observed maximum absolute deviation is 0,1, within the 0,30 bound. No percentage is altered.

## Boundaries and administrative structure

Guinea-Bissau's first-level administrative frame is eight regions (Bafatá, Biombo, Bolama/Bijagós, Cacheu, Gabú, Oio, Quinara, Tombali) plus the Sector Autónomo de Bissau. Quadro 4 publishes all nine; the census frame is therefore nine subnational units. The boundary layer matches this frame one-to-one:

- **geoBoundaries GNB ADM1** — release metadata: `boundaryID` `GNB-ADM1-76643164`, `boundaryYearRepresented` 2017, `admUnitCount` 9, `boundaryLicense` "Open Data Commons Open Database License 1.0", `licenseSource` `www.openstreetmap.org/copyright`. [ADM1 release metadata](https://www.geoboundaries.org/api/current/gbOpen/GNB/ADM1/); [ADM1 GeoJSON](https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/GNB/ADM1/geoBoundaries-GNB-ADM1.geojson). The nine `shapeName` values are Bissau, Bafatá, Biombo, Bolama, Cacheu, Gabu, Oio, Quinara, Tombali.

The Autonomous Sector of Bissau is present as its own feature (`shapeName` "Bissau", `shapeISO` GW-BS); it is not invented into or merged with any region. Seven of the nine units match the census names after accent-stripping (Tombali, Quinara, Oio, Biombo, Bafatá, Gabú→Gabu, Cacheu). Two need an explicit, well-established identity concordance, recorded in the builder:

- census `B. Bijagós` (Região de Bolama/Bijagós) → geoBoundaries `Bolama`;
- census `SAB` (Sector Autónomo de Bissau) → geoBoundaries `Bissau`.

Both mappings are documented identities, not merges or inventions. The boundary licence is ODbL 1.0 (OpenStreetMap-derived, as for the Vanuatu ADM1 sibling).

## Publication terms

The INE Guinea-Bissau website footer, captured from the homepage HTML (`ine_homepage.html`, sha256 below), sits in two adjacent `<P>` elements and reads verbatim:

> Instituto Nacional de Estatistica da Guiné-Bissau 1991-2020

> © Todos os direitos reservados

No open-data licence, terms-of-use page, or open-data agreement was located on the site (no `termos`, `condições`, `licença`, or `direitos` link resolves to a reuse licence; the homepage carries only the all-rights-reserved footer). This is the Burkina Faso / Côte d'Ivoire position: an all-rights-reserved footer with no located open-data agreement, weaker than the Guinea case (which at least referenced an Accord de licence de données ouvertes). Under the BF build-then-ask precedent the derived product ships to staging with `licence_status = needs_review` and a recorded ask to the project lead, pending a reuse ruling. If the lead rules the figures open, INE / RGPH-2009 attribution would apply. The boundary is ODbL 1.0.

**Recorded ask (project lead).** May transcribed one-decimal regional percentages from the INE RGPH-2009 sociocultural report be published as a derived map product, given the site's all-rights-reserved footer and no located open-data licence? This mirrors the open BF/CI reuse questions and should not be decided in this lane.

## Retrieval record

All inputs retrieved 2026-07-12, cached under `data/raw/gw_census/` (git-ignored; `.gitignore` line 120 ignores `data/`).

| Cached input | sha256 |
| --- | --- |
| `caracteristicas_socio_cultural.pdf` | `9c08fc0f4e54a3a3fb67eddd15764c2b678cdace350cec3413d3908e80e04563` |
| `ine_homepage.html` (INE terms footer source) | `192523c5d3616297b087110a2eea3fc89afacca3f2b8ef76dd373ace54a31b15` |
| `geoBoundaries-GNB-ADM1.geojson` | `2e74a7311bc75ac24773cb56f502f6a150d9017aeb512a2222144f60dbbfdfbb` |
| `gb_gnb_adm1_meta.json` | `9a41648cadaeb1b7dfaa105671ab11be0d34a4d3c918a286e05a606155433446` |

## Build recommendation

**BUILD (clean), STAGED with licence needs_review.** The published record supports a single-wave (2009), nine-unit, six-category religion-percentage choropleth on the exact frame the build-queue row names. The data is clean: the text layer extracts without optical character recognition, every region column reconciles to 100,0 within the derived 0,30 pp bound, the national counts reconcile exactly to 1 442 227, and the national percentages cross-check the counts. The boundary frame matches the census frame one-to-one, with the Autonomous Sector of Bissau present as its own feature. The only open item is publication reuse (all-rights-reserved footer, no located open licence), carried as needs_review with the recorded ask above; the build proceeds to staging under the BF build-then-ask precedent. No page and no hub edit in this lane.
