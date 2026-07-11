# Peru census-religion route probe

Verified 2026-07-12. Peru's national censuses (INEI) ask the professed religion of the population aged 12 and over, and INEI publishes the religion cross-tabulation **by department** as count-valued or count-plus-percentage tables for 2007 and 2017, both openly downloadable from the INEI publications host. The queue premise is largely correct — 1993, 2007, and 2017 all carry a religion question at the 12-and-over universe with the same four INEI categories (Católica, Evangélica, Otra, Ninguna) — but the "district via Redatam" ambition is refuted for an automated build: the REDATAM online system (censos2017.inei.gob.pe/redatam) is session-bound browser work, the 2007 tabulados host (censos.inei.gob.pe) and the microdata ANDA host (webinei.inei.gob.pe) were both unreachable from the build environment, and geoBoundaries carries no PER ADM3 (district) layer. The clean, reachable, count-valued route is the **department** level, and the WAVES-OVER-DISTRICTS ordering rule favours it: a comparable two-wave department series (2007, 2017) on the 25-unit departmental frame is a first-class product. 1993 is comparable only at the national level in reachable sources and is HELD for the department product.

BUILT 2026-07-12, STAGED (no page, no hub link): `scripts/build_pe_area_summary.R` produces 50 rows (25 departments x 2 waves), `apps/regions/pe/data/area_summary_department.{json,csv}`, `apps/regions/pe/data/pe_department_2008.geojson`, and `docs/manifests/pe-census-religion-2007-2017.json`. Both schema checks pass; all 78 manifests validate.

## Build decision

- **Recommendation**: BUILT a 25-unit, two-wave (2007, 2017) religious-affiliation department series. Both waves share the census universe (population aged 12 and over) and the four verbatim INEI categories, so the series is comparable with no universe or frame break. The product ships STAGED pending a PI licence ruling (INEI states no explicit reuse grant on its census results; build-then-ask stance with INEI attribution).
- **Waves**: 2007 (Perfil Sociodemográfico, CUADRO Nº 2.46) and 2017 (Resultados Definitivos, CUADRO Nº 1) as levels, affiliation and no-religion change readable across the pair. 2017 ships exact published counts; 2007 ships the exact published department Total and the published Ninguna percentage, with the Católica/Evangélica/Otra counts DERIVED from the published one-decimal percentages under a recorded per-category rounding bound (the Burkina Faso 2019 derived-bound precedent).
- **Geography**: 25 departments (24 departments plus the Provincia Constitucional del Callao; Lima is the whole department, i.e. Lima province plus Región Lima). This matches the 2007 published frame exactly. The 2017 table additionally splits Lima into Provincia de Lima and Región Lima (a 26-unit frame that matches the geoBoundaries ADM1 Lima split one-to-one); the build aggregates the two 2017 Lima rows to DEPARTAMENTO LIMA to share the 25-unit frame. The 26-unit split is a documented deeper option for 2017 alone.
- **Construct**: census affiliation — each resident's professed religion (asked of all persons aged 12 and over), not practice, attendance, or membership.
- **Slot design**: ordinary two-slot. `religious_affiliation_percent` = Católica + Evangélica + Otra share; `no_religion_percent` = Ninguna share. The four INEI categories partition the answering population aged 12+, so the two shares sum to 100 by construction (there is no separate non-response line in these tables). The richer Católica/Evangélica/Otra composition — the real signal — rides verbatim on each row's quality flag (exact counts in 2017, one-decimal percentages in 2007). The 100-by-construction property is the same one that gates the PI minority-share/task-6 page design; a page is out of scope for this lane.
- **Map-worthy pattern**: no-religion (Ninguna) varies sharply — San Martín is the national maximum (2007 8.5%, 2017 11.3%), against Piura and Apurímac near 1-2%. Evangélica concentrates in the Amazon and central highlands (2017 Ucayali 27.6%, Huánuco 26.4%, Huancavelica 25.2%), against strongly Catholic coastal and southern departments (Piura, Ica, Arequipa above 84%). This department-level contrast is the reason to map Peru.
- **Rights position**: no explicit reuse licence is stated on the INEI census results. Ship derived department summaries with attribution to INEI under build-then-ask; licence_status needs_review; an INEI reuse-confirmation ask is recorded for the PI. The boundary is Public Domain.

## Published waves, universe, and geography

| Year | Reachable official route | Religion-by-department table | Universe | Category frame | Decision |
| --- | --- | --- | --- | --- | --- |
| 2017 | [INEI Resultados Definitivos, Tomo 03](https://www.inei.gob.pe/media/MenuRecursivo/publicaciones_digitales/Est/Lib1544/00TOMO_03.pdf) (www.inei.gob.pe/media) | **CUADRO Nº 1** "Población censada de 12 y más años de edad, por grupos de edad, según departamento, área urbana y rural, sexo y religión que profesa" — exact counts, Total column, four categories | pop 12+ | Católica, Evangélica, Otra 1/, Ninguna | Ship (exact counts). |
| 2007 | [INEI Perfil Sociodemográfico del Perú](https://www.inei.gob.pe/media/MenuRecursivo/publicaciones_digitales/Est/Lib1136/libro.pdf) (www.inei.gob.pe/media) | **CUADRO Nº 2.46** "Población censada de 12 y más años de edad, por tipo de religión que profesa, según departamento, 2007" — exact department Total + one-decimal category percentages | pop 12+ | Católica, Evangélica, Otra, Ninguna | Ship (Total exact; category counts derived under a rounding bound). |
| 1993 | Perfil 2007 [CUADRO Nº 2.44](https://www.inei.gob.pe/media/MenuRecursivo/publicaciones_digitales/Est/Lib1136/libro.pdf) (national, 12+); contemporaneous [1993 Perfil](http://proyectos.inei.gob.pe/web/biblioineipub/bancopub/Est/Lib0007/cap0210.htm) (all-ages, 3-category) | **National only** at the 12+/four-category universe; no reachable department 12+/four-category table | pop 12+ (national) | Católica, Evangélica, Otra, Ninguna | HOLD — national-only comparable; department table unreachable. |

The 2007 tabulados system (censos.inei.gob.pe/cpv2007/tabulados/, 152 predefined tables including religion by department/province/district) and the microdata ANDA (webinei.inei.gob.pe) both timed out from the build environment; only the INEI publications host (www.inei.gob.pe/media) and the 1993 archive host (proyectos.inei.gob.pe) were reachable. The REDATAM 2017 web app (censos2017.inei.gob.pe/redatam) is reachable but session-bound browser work; it was not the route.

## The 1993 universe question (resolved)

Two distinct 1993 religion tabulations exist, and conflating them would be a universe-and-frame error. The contemporaneous 1993 Perfil Sociodemográfico (Lib0007, cap0210) publishes an **all-ages, three-category** table ("Católica / Otra 2/ (incluye otras religiones diferentes a la católica) / Ninguna"; 1993 Total 21,980,304; Católica 19,530,338 = 88.9%). INEI's later harmonised comparison (Perfil 2007, CUADRO Nº 2.44) **re-tabulates 1993 for the population aged 12 and over with the four-category frame** (Total 15,483,790; Católica 13,786,001 = 89.0%; Evangélica 1,042,888; Otra 432,760; Ninguna 222,141). The 2007/2017 series uses the 12+/four-category universe, so only the harmonised 1993 national figures are comparable — and no department-level 1993 table at that universe was reachable. Per the no-backcast rule, the all-ages three-category 1993 department detail is neither merged nor backcast; 1993 is HELD for the department product and recorded as a national-context wave whose department extension needs the 1993 tabulados (host down) or the 1993 microdata reprocessed.

## Category frame (verbatim, all waves)

| INEI category | Product role |
| --- | --- |
| Católica | religious affiliation |
| Evangélica | religious affiliation |
| Otra (2017 header "Otra 1/") | residual religious affiliation |
| Ninguna | no-religion |

The frame is identical across 1993, 2007, and 2017 and partitions the answering population aged 12+ (the shares sum to 100). No non-response/refuse line appears in these department tables. Frames are preserved verbatim and never merged, redistributed, or backcast.

## Reconciliation gates (verified; fail-fast in the builder)

- **2017 (CUADRO Nº 1)**: every one of the 25 departments' four categories sums to its printed department Total; every category sums across the 25 departments to its printed national margin (Católica 17,635,339; Evangélica 3,264,819; Otra 1,115,872; Ninguna 1,180,361); the grand total is 23,196,391. All margins close exactly. The 2017 Lima split (Provincia de Lima 7,060,760 + Región Lima 721,522) sums exactly to DEPARTAMENTO LIMA 7,782,282 at every category.
- **2007 (CUADRO Nº 2.46)**: the 25 department Totals sum exactly to the printed national 20,850,502. Each department's four published one-decimal percentages sum to 100 within the +/-0.15pp one-decimal rounding band (recorded per department). Category counts are DERIVED as round(Total x pct/100) with a per-category rounding bound of ceiling(Total x 0.0005), recorded on each row; no_religion_percent is the published Ninguna percentage verbatim.
- The build stops on any margin failure and never allocates, infers, rounds, imputes, or tunes a published value.

## Boundary source and licence

The boundary is [geoBoundaries PER ADM1](https://www.geoboundaries.org/api/current/gbOpen/PER/ADM1/). The release metadata states verbatim `"boundaryLicense": "Public Domain"`, `"licenseSource": "commons.wikimedia.org/wiki/File"`, `"boundaryType": "ADM1"`, `"boundaryYearRepresented": "2008"`, `"admUnitCount": "26"`, `"boundarySource": "Wikimedia Commons"`, and `"gjDownloadURL"` pinned at commit `90a1d52`. The build uses that release metadata as the licence authority (Public Domain, no attribution obligation on the geometry).

The layer carries 26 `shapeName` values. They dissolve to the 25 census departments: `Lima` (Región Lima) and `Municipalidad Metropolitana de Lima` (Lima province) union into DEPARTAMENTO LIMA; `El Callao` maps to the Provincia Constitucional del Callao; the other 23 map one-to-one (accents differ on `Ancash`/Áncash only). The build verifies all 26 features are consumed exactly once, the dissolve yields 25 features, geometry hashes are distinct, and the total land area is 1,291,648 km² (Peru ≈ 1,285,000 km²; Callao 174 km², Lima department 35,198 km² — both correct). Peru is wholly in the western hemisphere (lon -81.3 to -68.7); no antimeridian handling is needed. geoBoundaries offers **no PER ADM3** (district: the API returns 404); ADM2 (province) is 196 units under CC BY 3.0 IGO — a finer route for a future province product.

## Licence position

No Creative Commons or explicit data-reuse licence is stated on the INEI census results tables. The reachable INEI "Términos y Condiciones" (the ODISEA terms, cached) govern the **interactive participation services** of the portal, not reuse of the statistical tables — verbatim scope: *"los Términos y Condiciones que se presentan a continuación regularán, en lo sucesivo, el acceso y uso a los servicios interactivos de participación del usuario que EL INEI ofrece en su portal web institucional www.inei.gob.pe"*, and the only reuse-adjacent clause is a prohibition on using the discussion-forum service *"para la realización de cualquier acto ilícito, publicitario, de carácter proselitista o de explotación comercial"* — a forum-conduct clause, not a data licence. The INEI microdata access policy (ANDA, webinei.inei.gob.pe/anda_inei/index.php/catalog/583/accesspolicy) was unreachable from the build environment (connection refused/timeout) and could not be fetched or quoted; NO licence is claimed from it. Peru's national open-data platform (datosabiertos.gob.pe) hosts INEI boundary datasets but not the census religion tables used here.

Recommended position (Iran/Côte d'Ivoire precedent, build-then-ask): publish derived 25-department religion summaries with attribution to the Instituto Nacional de Estadística e Informática (INEI), record the source licence as needs_review, and defer to a PI ruling. An INEI reuse-confirmation ask is the clean unblock; none is held. No microdata is touched, so no ANDA access restriction binds the product.

## Retrieval record

Every cached input is under `data/raw/pe_census/`, excluded by `.gitignore:120` (the `data/` rule). Retrieval occurred on 2026-07-12. Reachable hosts: www.inei.gob.pe (200), proyectos.inei.gob.pe (200), censos2017.inei.gob.pe/redatam (200), github.com/geoboundaries (200). Unreachable: censos.inei.gob.pe (2007 tabulados, 000), webinei.inei.gob.pe (microdata ANDA, timeout).

| Cached input | Source URL | SHA-256 |
| --- | --- | --- |
| `pe_2017_resultados_definitivos_tomo03.pdf` | <https://www.inei.gob.pe/media/MenuRecursivo/publicaciones_digitales/Est/Lib1544/00TOMO_03.pdf> | `cf96a5472752d8794eea1bfd540f6ae5f29f5eb6f808661970863c75fccdc2dc` |
| `pe_2007_perfil_sociodemografico.pdf` | <https://www.inei.gob.pe/media/MenuRecursivo/publicaciones_digitales/Est/Lib1136/libro.pdf> | `18e3347e2dd59be60d2f5648446caa1170b930859a6654ed7f148f58a4bfb117` |
| `pe_1993_perfil_religion.htm` | <http://proyectos.inei.gob.pe/web/biblioineipub/bancopub/Est/Lib0007/cap0210.htm> | `b68111dae9e873592c5516bde00c636cc5a6ad70f3e3b0ab7af90fed8732292a` |
| `inei_terminos_condiciones_odisea.pdf` | <https://www.inei.gob.pe/media/odisea/Terminos_y_Condiciones_ODISEA.pdf> | `331d89862d8d7f8a77fbc5c2f1cb44201f2813cfa6658d2a6a20e5d7df8d3459` |
| `geoBoundaries-PER-ADM1.geojson` | <https://github.com/wmgeolab/geoBoundaries/raw/90a1d52/releaseData/gbOpen/PER/ADM1/geoBoundaries-PER-ADM1.geojson> | `9e4d6e0b802b5edf367206b5510f98b25e05935eef5785f08f7109eec34871fd` |
| `gb_per_adm1_meta.json` | <https://www.geoboundaries.org/api/current/gbOpen/PER/ADM1/> | `e29cf9ba1a73aad66ba2948af7223603a9070443c2ae62040b291a5998cf4784` |

Derived working files also present in the cache (not source objects): `pe_2017_dept_extracted.json`, `pe_2007_dept_extracted.json` (the reconciled department extractions).

## Blockers and deferred routes

- **Licence** (the one genuine gate): no explicit reuse grant on the INEI census results; the ANDA microdata licence host was unreachable. Resolve by PI ruling (summaries-with-attribution under build-then-ask, already the shipped stance) or an INEI reuse-confirmation ask.
- **1993 department**: comparable at the national level only; the department 12+/four-category table needs the 2007-era tabulados (host down) or the 1993 microdata reprocessed. HELD, no backcast.
- **Finer geography (province, district)**: province (ADM2, 196 units, geoBoundaries CC BY 3.0 IGO) and district (ADM3, ~1874 units) religion counts exist via INEI REDATAM (session-bound browser work) and the census microdata (ANDA host unreachable). District additionally needs a licensed ADM3 boundary (geoBoundaries has none for Peru; INEI/IGN or datosabiertos.gob.pe would supply it). The district-via-REDATAM/microdata route is the documented way to deepen the product.

## Product boundary

The build stages 25-department religious-affiliation summaries for 2007 (population 12+, from Perfil CUADRO Nº 2.46) and 2017 (population 12+, from Resultados Definitivos CUADRO Nº 1) on the geoBoundaries PER ADM1 frame dissolved to 25 departments, with affiliation and no-religion change readable across the pair and the Católica/Evangélica/Otra composition carried verbatim on each row. It carries the verbatim four-category frame, the Lima-dissolve and El-Callao concordance, and fail-fast reconciliation (2017 exact at every margin; 2007 department Totals exact with category counts derived under a recorded rounding bound). It does not contain a place-of-worship layer, place-density metrics, a district or province layer (data exist but the route is session-bound/unreachable and the ADM3 boundary is unlicensed here), or a 1993 department wave (national-only comparable). The INEI licence confirmation is the clean unblock; the district REDATAM/microdata route and a licensed ADM3 boundary are the recorded routes to deepen the product.
