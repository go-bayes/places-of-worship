# Spain survey-practice and places-layer route probe

Probe verified 2026-07-12. Spain has no census religion question; the affiliation-and-practice route runs through the CIS (Centro de Investigaciones Sociológicas) barometers, and the project's core object — places of worship — has its own open route through the Observatorio del Pluralismo Religioso directory. Two products follow, both distinct from any census-affiliation construct. The first is a survey-estimate practice-lane product on the 17 autonomous communities plus Ceuta and Melilla, carrying the CIS self-definition item ("¿Cómo se define Ud. en materia religiosa …") and the mass-attendance item ("¿Con qué frecuencia asiste Ud. a misa …"), always as weighted estimates with per-community uncertainty, never as counts (the Italy-attendance and Netherlands-survey precedent). The second is a places layer built from the Observatorio directory of non-Catholic places of worship, downloadable by autonomous community, province, and municipality, open under the Spanish public-sector reuse regime (Ley 37/2007 / Real Decreto 1495/2011) with a source-citation condition. The build-queue window (2012-2019) is the one material error: CIS did not design its barometers for autonomous-community estimation until the large-sample telephone barometers of 2020 onward (the per-community weight `PESOCCAA` and the minimum-100-interviews-per-community design); a single-wave 2012-2019 community product is therefore not supported by the CIS sample design and would rest on cells of a few dozen respondents. The buildable affiliation-and-practice route is therefore the 2020-onward CIS-designed community barometers (single wave or pooled), with the small-cell rule applied and Ceuta and Melilla flagged (n≈19 each, ±22,9 % sampling error).

## Institution and publication routes

Three institutions carry the two routes.

- **CIS (Centro de Investigaciones Sociológicas)** — the state survey agency; monthly barometers carry the religion self-definition and mass-attendance items, with open microdata. [CIS bancos de datos](https://www.cis.es/en/w/bancos-de-datos). [Barómetro de Abril 2025, Estudio nº 3505, avance de resultados (PDF, source of record for the current design)](https://www.cis.es/documents/d/guest/es3505mar_a). [Barómetro de Abril 2015, Estudio nº 3080, avance de resultados (PDF, source of record for the 2012-2019 design)](https://www.cis.es/documents/d/guest/es3080mar_a).
- **Observatorio del Pluralismo Religioso en España** (a project of the Fundación Pluralismo y Convivencia, with the Ministry of Justice and the FEMP) — the directory of places of worship of religious minorities. [Directorio de lugares de culto](https://observatorioreligion.es/directorio/). [Aviso legal (reuse terms, source of record)](https://observatorioreligion.es/aviso-legal/). [datos.gob.es catalogue record](https://datos.gob.es/es/catalogo/ea0040811-directorio-de-lugares-de-culto-observatorio-del-pluralismo-religioso-en-espana).
- **Instituto Geográfico Nacional (IGN / CNIG)** — the national mapping agency; the autonomous-community boundary, redistributed by geoBoundaries. [geoBoundaries ESP ADM1 metadata](https://www.geoboundaries.org/api/current/gbOpen/ESP/ADM1/).

## Route A — CIS affiliation and practice (survey-estimate, practice lane)

### The two items (verbatim, Barómetro de Abril 2025, Estudio nº 3505)

The self-definition item (Pregunta 28) prints six substantive categories plus non-response:

> ¿Cómo se define Ud. en materia religiosa: católico/a practicante, católico/a no practicante, creyente de otra religión, agnóstico/a, indiferente o no creyente, o ateo/a?

| Category (verbatim) | English display | April 2025 national % |
| --- | --- | ---: |
| Católico/a practicante | Practising Catholic | 18,8 |
| Católico/a no practicante | Non-practising Catholic | 36,6 |
| Creyente de otra religión | Believer of another religion | 3,6 |
| Agnóstico/a | Agnostic | 11,2 |
| Indiferente, no creyente | Indifferent, non-believer | 12,0 |
| Ateo/a | Atheist | 15,8 |
| N.C. | No answer | 2,0 |

The practice item (Pregunta 28a), asked only of those who define as Catholic or believer of another religion (`N=2.364` in this wave):

> ¿Con qué frecuencia asiste Ud. a misa u otros oficios religiosos, sin contar las ocasiones relacionadas con ceremonias de tipo social, por ejemplo, bodas, comuniones o funerales?

with categories Nunca (26,4), Casi nunca (20,7), Varias veces al año (23,7), Dos o tres veces al mes (9,4), Todos los domingos y festivos (13,6), Varias veces a la semana (5,2), N.C. (1,0). Both items recur across the monthly barometer series; the exact wording is stable in the 2020-onward waves examined.

### The design break: why 2012-2019 does not support a community product

The autonomous-community grain the queue names depends entirely on the CIS sample design, and that design changed. The two waves fetched bracket the change.

The first design is the 2012-2019 barometer (Estudio nº 3080, Abril 2015, ficha técnica verbatim):

> Tamaño de la muestra: Diseñada: 2.500 entrevistas. … Afijación: Proporcional. Ponderación: No procede. … Los estratos se han formado por el cruce de las 17 comunidades autónomas con el tamaño de hábitat … Los cuestionarios se han aplicado mediante entrevista personal en los domicilios. … el error real es de ±2,0% para el conjunto de la muestra.

The 2,500-interview face-to-face barometer of this era uses proportional allocation with no weighting ("Ponderación: No procede"), no per-community weight, and no minimum sample per community. A single such wave places only a few dozen respondents in the smaller communities, and CIS publishes no community weight and no community error for it. The 2012-2019 window therefore does not support a single-wave community estimate.

The second design is the 2020-onward barometer (Estudio nº 3505, Abril 2025, ficha técnica verbatim):

> Tamaño de la muestra: Diseñada: 4.000 entrevistas. … Afijación: No proporcional. Partiendo de una distribución proporcional por comunidades autónomas, se ajusta de forma que todas ellas alcancen un mínimo de 100 entrevistas, excepto las ciudades autónomas de Ceuta y Melilla que se fija un total de 20 entrevistas en cada una de ellas. … Para la estimación a nivel de cada autonomía, en el fichero de microdatos se incluye la ponderación para cada una de ellas (variable PESOCCAA). … Los cuestionarios se han aplicado mediante entrevista telefónica asistida por ordenador (CATI).

The 4,000-interview telephone barometer is explicitly built for community estimation: a minimum of 100 interviews per community, and a dedicated per-community weight `PESOCCAA` that CIS documents as the tool "para la estimación a nivel de cada autonomía". The autonomous-community affiliation-and-practice product is buildable on this design, one wave or several.

### Per-community sample and error (Estudio nº 3505, verbatim)

Even the 2020-onward design carries large community-level sampling error; the ficha técnica prints it (columns: designed / realised / weight / error %):

| Code | Comunidad autónoma | Diseñada | Realizada | Ponderación | Error (%) |
| --- | --- | ---: | ---: | ---: | ---: |
| 01 | Andalucía | 685 | 671 | 1,1220 | 3,9 |
| 02 | Aragón | 105 | 98 | 1,1457 | 10,1 |
| 03 | Asturias (Principado de) | 100 | 96 | 0,8962 | 10,2 |
| 04 | Balears (Illes) | 100 | 102 | 1,0062 | 9,9 |
| 05 | Canarias | 174 | 171 | 1,0433 | 7,6 |
| 06 | Cantabria | 100 | 109 | 0,4238 | 9,6 |
| 07 | Castilla-La Mancha | 166 | 162 | 1,3170 | 7,9 |
| 08 | Castilla y León | 205 | 202 | 1,1442 | 7,0 |
| 09 | Cataluña | 582 | 573 | 1,1419 | 4,2 |
| 10 | Comunitat Valenciana | 388 | 407 | 1,0608 | 5,0 |
| 11 | Extremadura | 100 | 108 | 1,0060 | 9,6 |
| 12 | Galicia | 236 | 237 | 1,0459 | 6,5 |
| 13 | Madrid (Comunidad de) | 522 | 543 | 0,8669 | 4,3 |
| 14 | Murcia (Región de) | 114 | 117 | 1,0288 | 9,2 |
| 15 | Navarra (Comunidad Foral de) | 100 | 108 | 0,4925 | 9,6 |
| 16 | País Vasco | 183 | 178 | 0,8696 | 7,5 |
| 17 | La Rioja | 100 | 89 | 0,3092 | 10,6 |
| 18 | Ceuta (Ciudad autónoma de) | 20 | 19 | 0,4623 | 22,9 |
| 19 | Melilla (Ciudad autónoma de) | 20 | 19 | 0,4283 | 22,9 |
| — | Total | 4.000 | 4.009 | — | 1,6 |

The nineteen units are the exact autonomous-community frame the boundary layer carries. Sampling error runs from ±3,9 % (Andalucía) to ±22,9 % (Ceuta and Melilla). Any smaller religion category (believers of another religion, 3,6 % nationally) sits well inside these community error bands. The product must therefore lead with uncertainty and follow the small-cell rule: Ceuta and Melilla (realised n≈19) fall under the denominator-100 threshold and wash pale, and any community subgroup cell under ten respondents carries the small-count marker (`docs/development/small-cell-rule.md`). A single wave gives a point estimate with a wide interval; pooling adjacent waves narrows it, at the cost of a mixed reference period.

### Construct handling (precedent)

The CIS product is a survey-estimate practice-lane product, its own construct value with a `dataNoun`, never blended with census affiliation — the Italy-attendance and Netherlands-survey-levels precedent. It carries weighted percentages with community uncertainty, never census-style counts, exactly as the expansion-survey note for Spain directs ("Use weighted survey estimates and uncertainty, never census-style counts"). The self-definition item and the mass-attendance item are two distinct metrics on the same wave.

### CIS reuse terms

The CIS study matrices are federated to datos.gob.es as open microdata in CSV, and the reuse grant reads (datos.gob.es federation note, retrieved 2026-07-12):

> quedando autorizada su reproducción total o parcial, modificación, distribución y comunicación, para usos comerciales y no comerciales, de acuerdo a las condiciones generales de uso de su portal.

This open grant, with a source-citation condition, governs the openly published study datasets. It sits alongside an older instrument that still governs bespoke microdata requests — Orden PRE/3188/2008 (BOE-A-2008-17961), which restricts a requester from transferring requested data to third parties or making commercial use without express CIS authorisation, and requires that the source be cited. The reconciliation for this project: the openly federated CSV study matrices carry the open reuse grant above; the derived community-estimate product ships with the CIS source citation. Where the terms read as unclear between the two instruments, the corpus build-then-ask precedent applies (published summaries with attribution, `licence_status = needs_review`), but the datos.gob.es federation grant is an affirmative open-reuse statement, stronger than the all-rights-reserved cases.

## Route B — Observatorio del Pluralismo Religioso, directory of places of worship (SPECIAL NOTE: places layer)

The project's core object is places of worship, and Spain publishes an open directory of them. The Observatorio del Pluralismo Religioso maintains a directory of the places of worship of religious minorities across Spain, filterable and downloadable by autonomous community, province, and municipality. This is a places-layer opportunity distinct from the affiliation route: it maps buildings, not belief, and is closer to the project's core than any survey estimate.

- **What it holds**: places of worship of the minority confessions — the directory lists sixteen-plus denominations, among them Islam, Evangelical and Orthodox Christianity, Buddhism, Hinduism, Judaism, Sikhism, the Bahá'í Faith, the Latter-day Saints, Jehovah's Witnesses, the Seventh-day Adventist Church, and others. Catholic places are out of scope (the directory refers users to the Spanish Episcopal Conference). Sources are the Ministry of Justice Registry of Religious Entities, verification work by the Fundación Pluralismo y Convivencia, and community submissions.
- **Grain and download**: results filter by autonomous community, province, and municipality-size band, and the interface carries a "Descargar tabla" (download table) control; the datos.gob.es record lists XLS and XHTML formats.
- **Currency caveat**: the datos.gob.es catalogue record shows a last-update date of 2016-12-11 and points, for the download, to the older `observatorioreligion.es/directorio-lugares-de-culto/` path; the live directory at `observatorioreligion.es/directorio/` is the current surface. The record's staleness is a metadata artefact, not evidence the live directory is frozen; the exact currency of the live counts should be confirmed at build time.
- **Legal disclaimer on the data**: "La publicación de datos en este Directorio no produce efecto jurídico alguno" (publication produces no legal effect) — an informative-purpose notice, not a reuse restriction.

### Observatorio reuse terms (verbatim)

The Observatorio aviso legal separates website content from the reusable datasets. The website's own contents (images, logos, design) carry a commercial-reproduction prohibition:

> quedan expresamente prohibidas la reproducción, la distribución y la comunicación pública, incluida su modalidad de puesta a disposición, de la totalidad o parte de los contenidos de esta página web, con fines comerciales, en cualquier soporte y por cualquier medio técnico, sin la autorización de LA FUNDACIÓN.

The datasets themselves fall under a separate section, "Autorización de reutilización y cesión no exclusiva de derechos de propiedad intelectual", applying the Spanish public-sector reuse regime (Ley 37/2007, Real Decreto 1495/2011), federated under datos.gob.es. The grant (verbatim):

> Se autoriza la reutilización … por personas físicas o jurídicas, con fines comerciales o no comerciales, siempre que dicho uso no constituya una actividad administrativa pública. La reutilización autorizada incluye, a modo ilustrativo, actividades como la copia, difusión, modificación, adaptación, extracción, reordenación y combinación de la información.

> Esta autorización conlleva, asimismo, la cesión gratuita y no exclusiva de los derechos de propiedad intelectual … autorizándose la realización de actividades de reproducción, distribución, comunicación pública o transformación, necesarias para desarrollar la actividad de reutilización autorizada, en cualquier modalidad y bajo cualquier formato, para todo el mundo y por el plazo máximo permitido por la Ley.

The conditions attached (verbatim):

> Debe citarse la fuente de los documentos objeto de la reutilización. Esta cita podrá realizarse de la siguiente manera, según la fuente del contenido: «Origen de los datos: Fundación Pluralismo y Convivencia» o «Origen de los datos: Observatorio del Pluralismo Religioso en España».

> Debe mencionarse la fecha de la última actualización de los documentos objeto de la reutilización …

> Deben conservarse, no alterarse ni suprimirse los metadatos sobre la fecha de actualización y las condiciones de reutilización aplicables …

> Está prohibido desnaturalizar el sentido de la información.

The directory is therefore openly reusable — commercial and non-commercial, including modification and combination — under an attribution-plus-no-distortion regime (the standard Spanish RISP conditions, comparable to CC BY with a no-endorsement and no-distortion condition). For a places product this is a favourable open licence; the required attribution is "Origen de los datos: Observatorio del Pluralismo Religioso en España", plus the last-update date and preserved reuse-condition metadata. Do not build in this lane; recorded as a distinct, high-value places-layer opportunity.

## Boundaries — autonomous communities plus autonomous cities

The nineteen-unit frame (17 autonomous communities + Ceuta + Melilla) has a clean open boundary, matching both routes' finest published grain one-to-one.

- **geoBoundaries ESP ADM1** (retrieved 2026-07-12): `boundaryLicense` "Creative Commons Attribution 4.0 International (CC BY 4.0)", `licenseSource` "centrodedescargas.cnig.es/CentroDescargas/index.jsp#", `admUnitCount` "19", `boundaryYearRepresented` "2017", `boundarySource` "Instituto de Geografico Nacional". [ADM1 metadata](https://www.geoboundaries.org/api/current/gbOpen/ESP/ADM1/); [ADM1 GeoJSON](https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/ESP/ADM1/geoBoundaries-ESP-ADM1.geojson).

The boundary derives from the IGN / CNIG (the queue's named IGN route) and ships CC BY 4.0. Nineteen units match the CIS ficha-técnica frame exactly, Ceuta and Melilla included as their own features. The Observatorio directory's province and municipality grains would need the IGN ADM2 (province) or a municipal layer if a finer places map were wanted; the community grain is served by ADM1.

## Premise corrections (trust the record)

- **The window is wrong for a community product.** The queue row names 2012-2019. CIS barometers of that era (Estudio nº 3080, Abril 2015: 2.500 interviews, afijación proporcional, "Ponderación: No procede", face-to-face) carry no per-community weight and no minimum community sample; they therefore do not support autonomous-community estimation for a single wave. The CIS-designed community route (minimum 100 interviews per community, `PESOCCAA` weight, 4.000-interview CATI) begins with the 2020-onward barometers. The buildable affiliation-and-practice window is 2020 onward, single wave or pooled; a 2012-2019 community product would require pooling many waves as a modelled estimate with wide uncertainty.
- **"Survey affiliation and practice" is two metrics, not one.** The self-definition item (Pregunta 28) and the mass-attendance item (Pregunta 28a) are distinct; the practice item is asked only of Catholics and believers of another religion. Each is its own metric on the wave.
- **The places layer is the stronger, and separate, opportunity.** The queue row names only the survey route. The Observatorio directory of places of worship — the project's core object — is open under the Spanish RISP regime with attribution and is a distinct build, not a variant of the affiliation route.
- **Both routes are direct downloads, not blocked browser work.** The CIS barometer PDFs and open CSV microdata download directly; the Observatorio directory exports a table; geoBoundaries serves the boundary. No human-verification challenge was encountered.

## Retrieval record

All inputs retrieved 2026-07-12. PDFs and the aviso-legal HTML cached to the session scratchpad for the reconciliation record (not committed).

| Cached input | Source URL | Format | SHA-256 |
| --- | --- | --- | --- |
| `es3505_apr2025.pdf` | <https://www.cis.es/documents/d/guest/es3505mar_a> | pdf | `2a238d20af4fc6027a634bc8b22a4c92bcf9c902350454a9edff4ddfee0da928` |
| `es3080.pdf` | <https://www.cis.es/documents/d/guest/es3080mar_a> | pdf | `03a39b01ae720e18f62c51bb4eeb4c2b4e3645d9df91412267d892e78a20a37c` |
| `obs_avisolegal.html` | <https://observatorioreligion.es/aviso-legal/> | html | `7dec0e1de1e3d25611c04dd7a54c80f2b31da20c369eae3d8e796a2b3d946507` |

Also fetched (no local cache needed): the datos.gob.es directory catalogue record, the datos.gob.es CIS federation note (reuse-grant text), the CIS bancos-de-datos page, the Observatorio directory page, and the geoBoundaries ESP ADM1 metadata. The `http://www.pluralismoyconvivencia.es/aviso_legal.html` URL named in the datos.gob.es record returned HTTP 404; the live reuse terms are the Observatorio aviso legal above.

## Build recommendation

**BUILDABLE, two distinct products, both survey/places lanes — not the census-affiliation lane.**

**Route A (affiliation and practice, survey-estimate):** CIS barometers, autonomous-community grain (19 units), the self-definition metric (Pregunta 28) and the mass-attendance metric (Pregunta 28a), built on the 2020-onward CIS-designed community barometers (minimum 100 interviews per community, `PESOCCAA` weight), single wave or pooled. Weighted estimates with per-community uncertainty, never counts; small-cell rule applied (Ceuta and Melilla wash pale, n≈19). Open microdata under the datos.gob.es federation reuse grant with CIS source citation. Boundary geoBoundaries ESP ADM1, CC BY 4.0. The 2012-2019 window is corrected to 2020-onward.

**Route B (places of worship, the SPECIAL NOTE):** Observatorio del Pluralismo Religioso directory, downloadable by autonomous community / province / municipality, open under the Spanish RISP regime (Ley 37/2007) with attribution "Origen de los datos: Observatorio del Pluralismo Religioso en España". A distinct places-layer product, closer to the project core; live-directory currency to be confirmed at build time.

No page, hub, manifest, or build edit in this lane.
