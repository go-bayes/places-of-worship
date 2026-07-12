# Paraguay census-religion route probe

Probe verified 2026-07-12. Verdict: **BUILDABLE via REDATAM extraction (2002 single wave, department grain)**, with one policy nuance for the conductor recorded below. Paraguay's 2002 population census asked religion of the population aged 10 and over, and the Instituto Nacional de Estadística (INE, formerly Dirección General de Estadística, Encuestas y Censos, DGEEC) publishes the religion tabulation at the national level only: cuadro P16 (religion by sex) and cuadro P11 (religion by age group, urban-rural area, and sex) in the "Total País" volume, both national, seven grouped categories, aged 10 and over, counts and percentages. No published table crosses religion with department. Department-grain religion is not absent, though: the census microbase is loaded in the CELADE-hosted REDATAM Webserver (base CPV2002), the person variable "Religión que profesa" is present, and the tool's "Quiebre de Area" offers "Departamento" and "Distrito". Running the cross-tabulation live produced a real per-department religion table (first block "AREA # 00 ASUNCION", Católica 375.726, Sin religión 6.606, and a full denominational list, by sex). This is the "extraction" route the build-queue row anticipated ("department or district requires extraction; browser work"). The route is licence-clean under Paraguay's open-data licence (Decreto 4064, Ley 5282/2014), which authorises extraction, transformation, and redistribution with source and licence citation. The boundary layer matches the census frame one-to-one: geoBoundaries PRY ADM1, 18 units (17 departments plus the Asunción capital district), CC BY 4.0, sourced from DGEEC. The one waveable subnational product is 2002; 1992 is not in REDATAM and no departmental 1992 religion table was located, and the 2012 and 2022 censuses carry no religion variable at all.

## Build decision (recommendation to the conductor)

- **Recommendation**: **BUILD the 2002 department product via REDATAM extraction**, single wave, 18 units, with the national published P16/P11 tables retained as documented context. Ship the seven published groups (Católica, Evangélicas, Otras cristianas, Indígena, Otras religiones, No tiene / Sin religión, No informado) by recoding the detailed REDATAM denomination list; the departmental frame then reconciles to the national published frame. Reconcile the sum of REDATAM department totals to the P16 national total of 3.892.603 (aged 10 and over) as the acceptance test.
- **Policy nuance (record both, as the task directs)**: the corpus prefers published static tables, and department-grain religion here exists only as a user-driven REDATAM extraction, not a published PDF or spreadsheet. The extraction is licence-clean and its parameters are fully specifiable (base `CPV2002`, row variable "Religión que profesa", `Quiebre de Area = Departamento`); the query is therefore reproducible in the parametric sense. The caveat is that it is a live query against a CELADE-hosted dynamic system (results generated on demand, subject to the system staying online) rather than a frozen file. This is materially unlike the Saint Kitts hold, where reaching subnational religion would have required inventing a distribution the office never produced; here the official microaggregates are extractable through the office's own dissemination tool. If the project rules that only published static tables qualify, the item becomes HELD pending either acceptance of the REDATAM route or an INE request to tabulate departmental religion; the recommendation above treats the REDATAM route as acceptable because the queue row itself names extraction as the route.
- **Rights position**: open reuse grant. Paraguay's "Licencia de Uso de la Información y los Datos Abiertos Públicos" (Decreto 4064, Ley 5282/2014) authorises extraction and transformation with attribution; `licence_status: accepted`, `licence_basis: paraguay_open_data_licence_ley_5282_2014`, boundary CC BY 4.0.

## Waves and published geography

| Wave | Religion asked | Published geography (static tables) | Department-grain route | Universe | Decision |
| --- | --- | --- | --- | --- | --- |
| 1992 | Yes (per secondary sources) | Not located on INE | Not in REDATAM (base not offered) | population figures cited by department for some faiths in secondary sources | No located INE table; not extractable via REDATAM. Out of scope for this build. |
| 2002 | Yes, population aged 10+ | National only: P16 (by sex), P11 (age group, urban-rural, sex) | REDATAM CPV2002, "Religión que profesa" x "Quiebre de Area = Departamento / Distrito" (verified, table generated) | 3.892.603 aged 10 and over | BUILDABLE at department grain via extraction. |
| 2012 | No religion variable | not applicable | Not in REDATAM (base not offered) | not applicable | No religion. |
| 2022 | No religion variable | not applicable | REDATAM CPV2022 present; "relig" search returns "No results found" (verified) | not applicable | No religion. |

REDATAM Paraguay offers exactly two census bases for online processing: `CPV2002` and `CPV2022` (the 1992 and 2012 censuses are not offered). Only `CPV2002` carries a religion variable.

## National published religion frame (2002, preserved verbatim; context, not the subnational product)

Cuadro Nº P-16, "PARAGUAY: Población de 10 años y más de edad por sexo, según tipo de religión, 2002" (Censo Nacional de Población y Viviendas 2002, Total País, page 56 of the sociocultural fascicle). Counts and percentages as printed (decimal commas as printed):

| Tipo de religión | País | Varones | Mujeres | % País |
| --- | ---: | ---: | ---: | ---: |
| Total | 3.892.603 | 1.955.004 | 1.937.599 | 100,0% |
| Católica | 3.489.531 | 1.755.714 | 1.733.817 | 89,6% |
| Evangélicas | 239.573 | 113.461 | 126.112 | 6,2% |
| Otras cristianas | 44.275 | 20.509 | 23.766 | 1,1% |
| Indígena | 25.219 | 13.164 | 12.055 | 0,6% |
| Otras religiones | 12.465 | 6.405 | 6.060 | 0,3% |
| No tiene | 44.334 | 27.018 | 17.316 | 1,1% |
| No informado | 37.206 | 18.733 | 18.473 | 1,0% |

Source line as printed: "Fuente: Censo Nacional de Población y Viviendas 2002." The seven category counts sum to 3.892.603 exactly. The universe is the population aged 10 and over (the religion question was asked of persons 10+; total census population in 2002 was 5.163.198). Cuadro P11 in the same Total País volume crosses religion with age group, urban-rural area, and sex, still at the national level; this is the "national and urban/rural in located table" the build-queue row names. Neither P16 nor P11 crosses religion with department.

## Department-grain route (REDATAM CPV2002, verified live)

The department table is produced through the CELADE-hosted INE Paraguay REDATAM Webserver, not a static file.

- Portal: <https://prod.redatam.org/binpry/RpWebEngine.exe/Portal?BASE=CPV2002> (retrieved 2026-07-12, HTTP 200). Menu confirms base "Censo 2002".
- Path: Población y Viviendas -> Cruce de Variables -> De Población, opening "Cruces de Variables de Personas".
- Row variable ("Distribución de (Fila)"): searching "relig" returns exactly one match, "Religión que profesa". Confirmed present.
- Area breakdown ("Quiebre de Area"): dropdown offers "--", "Departamento", "Distrito". Department and district grain are both offered.
- Execution: row "Religión que profesa", column "Sexo", "Quiebre de Area = Departamento" was run. The engine returned a real per-department table headed "CEPAL/CELADE Redatam+SP", "Base de datos: Censo 2002", "Cruce de Religión que profesa por Sexo", first block "AREA # 00 ASUNCION". The Asunción block printed counts by sex for a full denominational list: Católica 375.726 (Varón 170.855, Mujer 204.871), Sin religión 6.606, Religión indígena 48, Ortodoxa 8, Rusa 32, Alianza Cristiana y Misionera 54, Anglicana 104, Asamblea de Dios 234, Bautista / Bautista Maranata 1.447, and further denominations. The area-break output repeats one such block per department; a single query therefore produces the full 18-department religion table.

The REDATAM variable "Religión que profesa" is the detailed denomination list (dozens of categories), finer than the published seven groups. A product should recode the detailed categories to the P16 seven-group frame; department minority cells in the detailed list are tiny (single digits); the small-cell rule therefore bites hard on the detailed frame, one further reason to ship the seven grouped categories rather than the raw denominations.

## Licence (open reuse grant, verbatim)

INE Paraguay routes public-information reuse to the Paraguay government open-data licence (footer badge "Licencia de Uso de la Información Pública del Gobierno Paraguayo", linking to `www.ine.gov.py/microdatos/license.php`). The licence page (retrieved 2026-07-12) is headed "Licencia de Uso de la Información Pública - Decreto 4064 - Ley Nro. 5282/2014" and reads verbatim:

> Licencia de Uso de la Información y los Datos Abiertos Públicos propiedad del Estado Paraguayo
>
> Esta licencia otorga la autorización gratuita, perpetua y no exclusiva de uso y/o transformación de la información y los datos abiertos públicos propiedad del Estado Paraguayo a cualquier persona fisica o jurídica que haga uso de los mismos.
>
> Para efectos de la presente licencia, se entiende por uso y/o transformación autorizada de la información o los datos públicos, las actividades tales como: copia, extracción, reproducción, distribución, comunicación pública, adaptación, transformación y todo aquel uso lícito en cualquier modalidad y bajo cualquier formato, por el plazo máximo permitido por la Ley.

The three conditions, verbatim:

> Citar a la fuente pública que proveyó la información o los datos objeto del uso y/o transformación; y que el contenido se rige por la presente licencia.
>
> Citar la fecha de la última actualización de la información o los datos objeto del uso y/o transformación, siempre y cuando esto foera conocido.
>
> No usar la información pública ni los datos abiertos públicos de forma que sugiera o simule un uso oficial o patrocinado por el Estado Paraguayo.

The grant names "extracción" and "transformación" explicitly; the REDATAM cross-tabulation extraction therefore sits squarely inside the licence. Required product attribution: cite INE Paraguay / Censo Nacional de Población y Viviendas 2002 as source, note that the content is governed by this licence, and do not present the derived map as an official or state-endorsed product. Ley 5282/2014 is Paraguay's Law of Free Access to Public Information and Government Transparency.

## Boundaries and administrative frame

Paraguay's first-level frame is 17 departments plus the capital district of Asunción, 18 units. geoBoundaries PRY ADM1 matches this frame exactly:

- geoBoundaries PRY ADM1 metadata (retrieved 2026-07-12): `boundaryID` `PRY-ADM1-63826900`, `boundaryType` ADM1, `admUnitCount` 18, `boundaryYearRepresented` 2012, `boundarySource` "Direcion General de Estadica, Encuestas y Censos" (DGEEC), `boundaryLicense` "Creative Commons Attribution 4.0 International (CC BY 4.0)". Metadata: <https://www.geoboundaries.org/api/current/gbOpen/PRY/ADM1/>; GeoJSON: <https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/PRY/ADM1/geoBoundaries-PRY-ADM1.geojson>.
- The 18 `shapeName` values: ALTO PARAGUAY, ALTO PARANA, AMAMBAY, ASUNCION, BOQUERON, CAAGUAZU, CAAZAPA, CANINDEYU, CENTRAL, CONCEPCION, CORDILLERA, GUAIRA, ITAPUA, MISIONES, PARAGUARI, PRESIDENTE HAYES, SAN PEDRO, ÑEEMBUCU.

The boundary source is DGEEC itself; the polygon frame and the REDATAM department codes are therefore the same administrative division, and Asunción is present as its own unit, matching REDATAM area #00. A department-name (or department-code) crosswalk joins one-to-one after accent handling. The boundary licence is CC BY 4.0.

## Premise corrections (trust the record)

- **The build-queue window "1992-2002" overstates the buildable span.** Only 2002 is buildable at department grain. 1992 is not offered in REDATAM and no departmental 1992 religion table was located on INE; a 1992 subnational product is not supported by the located record. The product is single-wave 2002. (Single-wave products ship in the corpus; this does not block.)
- **The published ceiling is national, not "requires extraction from a subnational table".** The row reads "national and urban/rural in located table; department or district requires extraction". Correct on the published ceiling (P16 national by sex; P11 national by age, urban-rural, sex). The department/district route is a REDATAM live extraction, not extraction from an existing subnational PDF; there is no published departmental religion table to parse.
- **The 2022 census did not ask religion.** REDATAM CPV2022 is present but carries no religion variable ("relig" search returns "No results found"). Any expectation of a 2022 religion wave is refuted. The 2012 census likewise carries no religion variable and is not offered in REDATAM.
- **Licence is a definite open grant, not "INE terms".** The country README records the vaguer "INE terms"; the actual instrument is the Paraguay open-data licence under Decreto 4064 / Ley 5282/2014, which explicitly authorises extraction and transformation with attribution.

## Retrieval record

All inputs retrieved 2026-07-12. Downloadable inputs cached under `data/raw/py_census/` (git-ignored). REDATAM tables are generated on demand and were verified live in-browser (no static file).

| Cached / verified input | Source URL | Format | SHA-256 (where a file was saved) |
| --- | --- | --- | --- |
| `py_2002_religion.pdf` (P-16 national fascicle, "3. Población por religión") | <https://informacionpublica.paraguay.gov.py/public/74454-Censo2002AspCultReliginpdf-Censo2002Asp.Cult.Religin.pdf> | pdf | `1b8d9dd52dc3a5f2a7ed0fe4bc7d04bd1e5600e27960a53589b85c6beb015012` |
| `totalpais.htm` (2002 Total País cuadro index; P11 religion by age/urban-rural/sex, P16 by sex) | <https://www.ine.gov.py/Publicaciones/Biblioteca/Web%20Paraguay%20Total%20Pais/Paraguaytotalpais.htm> | html | `eeaf9b0258414b7e2581c776bf2207394a2f0956e15dfe0867b0086ffa283f13` |
| `license.html` (open-data licence, verbatim) | <https://www.ine.gov.py/microdatos/license.php> | html | `c682760bfc7db8db380faa0ac4a544b7c4524b7d190b740ca5c7bc31c8f3f81c` |
| `gb_pry_adm1.json` (boundary metadata) | <https://www.geoboundaries.org/api/current/gbOpen/PRY/ADM1/> | json | `a89cb5189045239b0ab4ff941767f8c8a2c51c55ffe4265569af43b402e418ae` |
| `gb_pry_adm1.geojson` (18 department polygons) | <https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/PRY/ADM1/geoBoundaries-PRY-ADM1.geojson> | geojson | `82173f047c41db35fe12651e42ea5f5ed442a538247a4082a4f7edf090e6daab` |
| REDATAM CPV2002 portal + person cross-tab (religion variable, department break, live table) | <https://prod.redatam.org/binpry/RpWebEngine.exe/Portal?BASE=CPV2002> | dynamic (verified in-browser) | not a static file |
| REDATAM CPV2022 person cross-tab (no religion variable) | <https://prod.redatam.org/binpry/RpWebEngine.exe/Portal?BASE=CPV2022> | dynamic (verified in-browser) | not a static file |
| REDATAM Paraguay landing (bases offered: CPV2002, CPV2022) | <https://redatam.org/en/online-process/latam/pry> | html | not saved |

## Dead ends and notes

- The 2002 results index at `www.ine.gov.py/microdatos/acceso-informacion-censo.php` loads its document list by JavaScript (static HTML carries no PDF links); the biblioteca root directory listing returns a 386-byte stub, and departmental biblioteca folders under the pattern `Web Paraguay <Departamento>` return HTTP 404. There is no departmental religion PDF on the located INE tree.
- The 2002 religion fascicle PDF is a two-page extract ("Aspectos Culturales") hosted on the national transparency portal `informacionpublica.paraguay.gov.py`; it contains cuadro P16 and the P16 chart, both national.
- No human-verification challenge was encountered on any INE, REDATAM/CELADE, or geoBoundaries endpoint.
