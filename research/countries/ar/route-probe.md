# Argentina survey-religion route probe

Verified 2026-07-12. Verdict: **BUILDABLE as a survey construct** (percentages only, two waves, six macro-regions), with one boundary task and one licence note carried. Argentina's national census stopped asking religious affiliation after 1960; there is therefore no modern census-religion route, and the queue row's "reviewed modern outputs did not show census religion" is correct, and the report of record confirms it verbatim: "Desde 1960, el Censo Nacional de Población dejó de interrogar sobre las adscripciones [religiosas]" (Segunda Encuesta report, p. 24). The buildable route is the CEIL-CONICET national survey on religious beliefs and attitudes (Programa Sociedad, Cultura y Religión), which publishes religious affiliation by the six standard Argentine macro-regions for two waves: the Primera Encuesta (2008) and the Segunda Encuesta (2019). Both publish one-decimal percentages by region, with a stated national margin of error of +/- 2% at 95% confidence. This is a survey construct and follows the corpus precedent for survey/practice constructs as their own dataNoun (Italy attendance, Netherlands survey constructs): it is never blended with census affiliation, and — because the census religion series ends in 1960 — there is no census affiliation product for Argentina to blend it with. Two items are carried, neither a hard blocker: the macro-region frame is not a clean grouping of whole provinces (AMBA/GBA splits Buenos Aires province), and the boundary must therefore be a custom dissolve built from second-level units; and the strongest located reuse licence is the peer-reviewed journal article that carries the 2019 regional table under Creative Commons Attribution-NonCommercial-ShareAlike 4.0, while the CEIL report PDFs themselves carry only a "Copyright © 2026" site footer (needs_review build-then-ask).

## Institution and publication routes

The data owner is the Programa Sociedad, Cultura y Religión of the Centro de Estudios e Investigaciones Laborales (CEIL), a research centre of CONICET (Consejo Nacional de Investigaciones Científicas y Técnicas). The survey was directed by Fortunato Mallimaci, coordinated by Juan Cruz Esquivel, with Verónica Giménez Béliveau; it was run jointly with the Universidad de Buenos Aires and the national universities of Rosario, Cuyo, and Santiago del Estero.

- [CEIL-CONICET survey landing page](https://www.ceil-conicet.gov.ar/2019/11/segunda-encuesta-nacional-sobre-creencias-y-actitudes-religiosas-en-la-argentina/)
- [Segunda Encuesta 2019 report (Informe de Investigación nº 25, source of record for the 2019 wave)](https://www.ceil-conicet.gov.ar/wp-content/uploads/2019/11/ii25-2encuestacreencias.pdf) — ISSN 1515-7466
- [Primera Encuesta 2008 report (source of record for the 2008 wave; cached from the municipal mirror bahia.gob.ar)](https://www.bahia.gob.ar/wp-content/uploads/2021/12/Primera-Encuesta-Nacional-CEIL-CONICET-2008-Dres.-Fortunato-Mallimaci-Juan-Cruz-Esquivel-Lic.-Gabriela-Irraz%C3%A1bal.pdf)
- [Peer-reviewed article carrying the 2019 regional table (redalyc mirror; CC BY-NC-SA 4.0)](https://www.redalyc.org/journal/3872/387266813004/) — Mallimaci, Esquivel & Giménez Béliveau (2020), "Religiones y creencias en Argentina (2008-2019). Resultados de la Segunda Encuesta Nacional de Creencias y actitudes religiosas en Argentina", *Sociedad y Religión: Sociología, Antropología e Historia de la Religión en el Cono Sur*, vol. 30, no. 55, CONICET.

## Waves, geography, and universe

| Wave | Source of record | Geographic grain | Universe | Cases | Margin of error | Values |
| --- | --- | --- | --- | --- | --- | --- |
| Primera Encuesta 2008 | 2008 report, "La religión de los Argentinos – según región" | six macro-regions + national | República Argentina (18+); multistage probabilistic, cluster + sex/age quotas | 2403 | +/- 2% at 95% (national) | one-decimal % |
| Segunda Encuesta 2019 | 2019 report (Informe nº 25), "Adscripción religiosa según región", p. 14 | six macro-regions + national | population 18+ resident in urban localities/aglomerados of at least 5,000 inhabitants per the 2010 census; multistage probabilistic (89 primary sampling localities, PPT), sex/age quotas | 2421 | +/- 2% at 95% (national) | one-decimal % |

The 2019 universe is narrower than the 2008 one: 2019 covers only urban localities of at least 5,000 inhabitants (the sampling frame is the 2010 census), whereas the 2008 ficha técnica states only "República Argentina" without the 5,000-inhabitant floor. Both are survey estimates, not population counts.

**Verbatim sampling design (2019 report, Ficha técnica, p. 4):** "Se trata de una encuesta probabilística. El universo en estudio es la población de la República Argentina de 18 años o más, residente en localidades o aglomerados urbanos con, al menos, 5.000 habitantes según Censo Nacional de Población, Hogares y Viviendas 2010. Se seleccionaron 2421 casos mediante una muestra polietápica."

**Verbatim margin of error (2019 report, "Margen de error y alcance del estudio", p. 4):** "Se trabaja con un margen de error del +/- 2% para un nivel de confiabilidad del 95%. El alcance del estudio es la República Argentina (Total País). Al tratarse de una encuesta probabilística polietápica que combina estratificación por región y tamaño de ciudad y selección mediante azar sistemático (con PPT) los datos son extrapolables a la población general atendiendo al margen de error."

**Verbatim margin of error (2008 report, Ficha técnica):** "Margen de error : +- 2% - nivel de confiabilidad, 95%. Cantidad de casos: 2403. Alcance del estudio: República Argentina."

Both statements scope the +/- 2% margin to the national total ("Total País"). Neither report publishes a per-region margin of error; each regional subsample is roughly 2400/6 (about 400 cases) and therefore carries a materially larger, unpublished sampling error. This is recorded and must be carried on any regional product: the regional shares are point estimates from subsamples of roughly 400, not precise measurements.

## Category frames (verbatim; the two waves differ)

The two waves do not use the same category frame; the survey construct is therefore not directly comparable across waves, and the corpus survey-construct rule applies (own dataNoun, never blended with census affiliation).

**2008 frame** (five categories; "Indiferentes" is defined on the report as "Agnósticos, Ateos y Ninguna Religión de Pertenencia"; "Evangélica" as "Pentecostal, Baptista, Luterana, Metodista, Adventista e Iglesia Universal del Reino de Dios"):

| Source category | Role |
| --- | --- |
| Católica | affiliation |
| Evangélica | affiliation |
| Testigos de Jehová / Mormones | affiliation |
| Otras | affiliation |
| Indiferentes | no religion (agnostics, atheists, no-affiliation combined) |

**2019 frame** (the graph legend lists six slots): Católica, Evangélica, Otras, Sin religión, Testigos de Jehová/Mormones, No sabe. The 2019 wave replaces the 2008 "Indiferentes" bucket with an explicit "Sin religión" slot plus a separate "No sabe" (don't know) slot.

The wave-to-wave relabelling (2008 "Indiferentes" vs 2019 "Sin religión" + "No sabe") means a naive 2008→2019 change metric on the no-religion category would compare non-identical constructs. Any change product must disclose this; the safest reading treats each wave as its own cross-section.

## Verbatim published regional tables

**2008 — "La religión de los Argentinos – según región"** (percent; Base: 2403 casos; Fuente: Datos propios). All five categories are printed per region:

| Categoría | Capital y GBA | Centro | NEA | NOA | Cuyo | Sur |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Católica | 69.1 | 79.2 | 84.0 | 91.7 | 82.6 | 61.5 |
| Indiferentes | 18.0 | 9.4 | 3.2 | 1.8 | 5.3 | 11.7 |
| Evangélica | 9.1 | 8.3 | 11.8 | 3.7 | 10.0 | 21.6 |
| Testigos de Jehová / Mormones | 1.4 | 2.7 | 0.8 | 2.1 | 1.8 | 3.7 |
| Otras | 2.3 | 0.4 | 0.1 | 0.7 | 0.4 | 1.5 |

The 2008 labels "Capital y GBA" and "Sur" correspond to the 2019 labels "AMBA" and "Patagonia" respectively. Each region column sums close to 100 (Capital y GBA 99.9, Centro 100.0, NEA 99.9, NOA 100.0, Cuyo 100.1, Sur 100.0), consistent with one-decimal rounding of a five-category partition.

**2019 — "Adscripción religiosa según región" (Informe nº 25, p. 14)** (percent; Base: 2421 casos). The 2019 figure is a stacked bar chart annotated "Se consignan en el gráfico valores superiores al 2%" — only values above 2% are printed, and minor categories are therefore omitted per region. The printed values, read from the chart (Católica / Sin religión / Evangélica, plus any printed minor value):

| Región | Católica | Sin religión | Evangélica | minor printed |
| --- | ---: | ---: | ---: | ---: |
| Total país | 62.9 | 18.9 | 15.3 | — |
| AMBA | 56.4 | 26.2 | 15.0 | — |
| Patagonia | 51.0 | 24.3 | 24.4 | — |
| Centro | 65.7 | 18.6 | 11.3 | 2.5 |
| Cuyo | 69.6 | 13.2 | 14.5 | 2.6 |
| NEA | 67.4 | 7.0 | 23.1 | — |
| NOA | 76.0 | 5.0 | 16.7 | — |

The chart's narrative caption is internally consistent with these values: "El NOA es la región más católica. En AMBA y Patagonia se registra la mayor proporción de sin religión. Las y los evangélicos sobresalen en Patagonia y NEA." The national totals also match the report's summary (Católica 62.9%, Sin religión 18.9%, evangélicos 15.3%).

## A source-versus-source discrepancy on the 2019 regional table (reconcile at build)

The peer-reviewed article (Mallimaci, Esquivel & Giménez Béliveau 2020, CC BY-NC-SA 4.0) carries a 2019 regional table whose values do not fully agree with the Informe nº 25 chart. Fetched from the redalyc HTML rendering (extraction via a reading model, not a direct table read, so treat as indicative pending a PDF-level read), the article table gives, per region: NOA Católica 73.1 / Evangélica 16.9 / no-afiliación 5.0 / Otras 5.0; NEA 68.3 / 23.1 / 7.0 / 1.6; Cuyo 68.3 / 13.8 / 14.0 / 3.9; Centro 65.2 / 12.8 / 17.8 / 4.2; AMBA 57.0 / 12.0 / 26.0 / 5.0; Patagonia 57.9 / 18.2 / 23.0 / 0.9. The no-religion / sin-filiación column matches the Informe closely across all six regions (NOA 5.0=5.0, NEA 7.0=7.0, AMBA 26.0≈26.2, Patagonia 23.0≈24.3, Centro 17.8≈18.6, Cuyo 14.0≈13.2). The Católica and Evangélica columns diverge, most sharply for Patagonia (Católica 51.0 report vs 57.9 article; Evangélica 24.4 report vs 18.2 article). The divergence is real enough to require reconciliation before shipping; the recommendation is to treat the Informe nº 25 chart as the primary source of record for the 2019 wave (it is the official report and the values were read directly from the PDF text layer) and to verify the article table against the article PDF at build time. This is recorded, not resolved, because a build has not started.

## Boundaries and administrative structure — the carried task

The six macro-regions are the standard Argentine statistical regions (the INDEC regionalisation used for the Encuesta Permanente de Hogares), confirmed by search of INDEC-derived sources. Their standard composition:

- **AMBA / GBA (Gran Buenos Aires):** Ciudad Autónoma de Buenos Aires (CABA) plus the Greater Buenos Aires partidos of Buenos Aires province (the "24/31 partidos" ring).
- **Centro / Pampeana:** the rest of Buenos Aires province (outside the GBA ring), Córdoba, Entre Ríos, La Pampa, Santa Fe.
- **NOA (Noroeste):** Catamarca, Jujuy, La Rioja, Salta, Santiago del Estero, Tucumán.
- **NEA (Nordeste):** Corrientes, Chaco, Formosa, Misiones.
- **Cuyo:** Mendoza, San Juan, San Luis.
- **Patagonia / Sur:** Chubut, Neuquén, Río Negro, Santa Cruz, Tierra del Fuego.

Neither CEIL report publishes this province-to-region mapping; the 2019 report and article name the regions only by acronym ("las seis regiones del país (NEA, NOA, Centro, Cuyo, AMBA y Patagonia)"). The mapping above is the standard INDEC scheme, recorded here from external sources and to be documented in any builder.

The boundary is therefore **not a clean grouping of whole first-level provinces**. AMBA/GBA is CABA plus a subset of Buenos Aires-province partidos, and Centro/Pampeana takes the remainder of the same province. Buenos Aires province is split between two macro-regions. A standard geoBoundaries ARG ADM1 layer (24 provinces + CABA) cannot dissolve one-to-one onto the six-region frame; the AMBA/Centro boundary cuts through Buenos Aires province. Building the macro-region layer requires a custom dissolve from second-level units (ARG ADM2 partidos/departamentos): CABA plus the named GBA partidos become AMBA, the remaining Buenos Aires partidos join Centro, and the other four regions are whole-province groupings. This is a defined build task, not a blocker, but the queue row's "macro-region" grain must be understood as requiring a custom ADM2-based boundary, not an off-the-shelf ADM1 grouping. A boundary layer was not built in this probe.

## Licence position

Two reuse bases were located, with different strength.

- **CEIL-CONICET report PDFs (the primary data source):** the CEIL landing page carries only a site footer "Copyright © 2026" with no located Creative Commons licence, terms-of-use page, or open-data statement. Under the corpus build-then-ask posture (the Burkina Faso / Guinea-Bissau precedent), a product derived from the report tables would ship to staging with `licence_status = needs_review` and a recorded ask, pending a reuse ruling, with CEIL-CONICET attribution.
- **Peer-reviewed article carrying the 2019 regional table (the stronger basis):** the article is published under an explicit open licence, quoted verbatim from the redalyc record — "Esta obra está bajo una Licencia Creative Commons Atribución-NoComercial-CompartirIgual 4.0 Internacional" (Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International). This grants reuse of the article's summary regional table with attribution, provided the use is non-commercial and share-alike. The non-commercial clause is a genuine condition to record: if the project's distribution is treated as non-commercial, the CC BY-NC-SA 4.0 basis carries the 2019 regional table cleanly with attribution to Mallimaci, Esquivel & Giménez Béliveau (2020), *Sociedad y Religión* 30(55), CONICET.

The recommended posture: carry the 2019 wave on the CC BY-NC-SA 4.0 article basis where the article and report agree, with the report as the source of record for the figures; carry the 2008 wave under `needs_review` (build-then-ask) since no open licence for the 2008 report was located. Record the CC BY-NC-SA non-commercial condition as a constraint for the project lead.

**Recorded ask (project lead).** May CEIL-CONICET regional percentages be shipped as a derived survey-construct map product? The 2019 wave has an explicit CC BY-NC-SA 4.0 basis via the peer-reviewed article (non-commercial, share-alike, attribution); confirm the project's use qualifies as non-commercial. The 2008 report carries no located open licence and follows the build-then-ask needs_review posture.

## Survey-versus-census caveats (recorded)

1. **Sample-based estimates carry uncertainty.** Both waves are probabilistic surveys of roughly 2,400 cases. The published +/- 2% margin at 95% is scoped to the national total; per-region estimates rest on subsamples of roughly 400 and carry a larger, unpublished margin. Any regional product must present the values as survey estimates with uncertainty, not as counts or precise shares.
2. **Percentages only, no counts.** Both reports publish one-decimal percentages by region; neither publishes regional counts. This is a percentages-only product (the Guinea GN 2014 / Guinea-Bissau GW 2009 precedent): no count field is derived from any percentage.
3. **Survey construct, separate dataNoun.** Religious affiliation from the CEIL survey is a survey construct and ships as its own dataNoun (the Italy attendance / Netherlands survey-construct precedent). It is never blended with census affiliation. Argentina has no modern census-religion series to blend with in any case: the national census dropped religion after 1960 (report, p. 24: "Desde 1960, el Censo Nacional de Población dejó de interrogar sobre las adscripciones [religiosas]"). The report cites the last census religion figures as historical context only (católicos: 1947 → 93.6%, 1960 → 90.05%, then survey 2008 → 76.5%, 2019 → 62.9%).
4. **Cross-wave category change.** The 2008 and 2019 frames differ (2008 "Indiferentes" vs 2019 "Sin religión" + "No sabe"); a change metric across waves compares non-identical constructs and must disclose this.

## Retrieval record

All inputs retrieved 2026-07-12. Report and article PDFs cached in this session's tool-results directory; not committed. Hashes recorded for the reconciliation record.

| Cached input | Source URL | Format | SHA-256 |
| --- | --- | --- | --- |
| Segunda Encuesta 2019 report (Informe nº 25) | <https://www.ceil-conicet.gov.ar/wp-content/uploads/2019/11/ii25-2encuestacreencias.pdf> | pdf | `722fcf81c14b9e119a7ba75c52e1d6f3dec76119603e7ed6b97168d8ef680f40` |
| Primera Encuesta 2008 report (bahia.gob.ar mirror) | <https://www.bahia.gob.ar/wp-content/uploads/2021/12/Primera-Encuesta-Nacional-CEIL-CONICET-2008-Dres.-Fortunato-Mallimaci-Juan-Cruz-Esquivel-Lic.-Gabriela-Irraz%C3%A1bal.pdf> | pdf | `0c90dad2a860a0afad33ef5d1405f69de15184ecda66718c08ef3dc3195c35f1` |
| OJS commentary article (context; short 7-page piece, not the data table) | <https://ojs.ceil-conicet.gov.ar/index.php/sociedadyreligion/article/download/799/680/2751> | pdf | `cfba63c46d43101ae823f4ff2365eb19fb0f08db3d2232901a156a11bf5c9cd4` |

Also fetched (HTML, not cached to disk): the CEIL landing page (footer "Copyright © 2026"); the redalyc article landing and HTML rendering (licence "Creative Commons Atribución-NoComercial-CompartirIgual 4.0 Internacional"; article Table 5 values, indicative pending a PDF-level read); an INDEC-region search confirming the six-region province composition.

## Dead ends

- **CONICET institutional repository** (<https://ri.conicet.gov.ar/handle/11336/144739>) refused the connection during this probe (`ECONNREFUSED 45.71.5.47:443`); the article licence and citation were obtained from the redalyc mirror instead. The repository is a re-fetch candidate but not required, since the licence is confirmed.
- **CONICET infographic PDF** (<https://www.conicet.gov.ar/wp-content/uploads/Infografía-Encuesta-Religión-1.pdf>) is a Photoshop-exported graphic PDF with no extractable text layer for the regional values; the Informe nº 25 report supersedes it as the machine-readable source.
- **Province-to-region mapping in the primary sources:** neither CEIL report publishes which provinces compose each macro-region; the mapping was recovered from external INDEC-derived sources and must be documented in the builder.

## Build recommendation

**BUILD (survey construct), STAGED, with one boundary task and a licence note.** The published record supports a two-wave (2008, 2019), six-macro-region, percentages-only survey-affiliation product. The 2019 wave has an explicit CC BY-NC-SA 4.0 reuse basis via the peer-reviewed article (non-commercial, share-alike); the 2008 wave follows the build-then-ask needs_review posture. Two items are carried: the macro-region boundary is not an off-the-shelf ADM1 grouping (AMBA/GBA splits Buenos Aires province) and must be built as a custom ADM2 dissolve; and the Informe-versus-article discrepancy on the 2019 Católica/Evangélica columns must be reconciled at build time, treating the Informe nº 25 chart as the source of record. The product ships as its own survey-construct dataNoun, never blended with census affiliation, with per-region estimates presented as survey estimates carrying uncertainty larger than the national +/- 2% margin. No page and no hub edit in this lane.
