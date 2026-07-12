# Chile census-religion route probe

Verified 2026-07-12. Chile asked religion in the 2002 and the 2024 national censuses, both of the population aged 15 or more, and the counts are openly published **by commune** for both waves through the Biblioteca del Congreso Nacional (BCN) "Estadísticas Territoriales" service (a machine-readable dissemination of the Instituto Nacional de Estadísticas census, sourced verbatim to INE). The queue premise ("2002-2024 | commune | census affiliation | browser work | probe then build") holds on geography, and on the two waves that carry religion — but the "2002-2024" span reduces to a **two-wave** product (2002 + 2024), and the route is machine-readable, not browser work. The 2012 census does not enter the product (annulled; not published as usable religion data), and the 2017 abbreviated census did not ask religion — both documented below, neither rehabilitated. Both usable waves reconcile internally at both margins on the 346-commune current frame, and the boundary route is clean (an official INE commune layer with CUT codes, joining the census one-to-one).

## Build decision (recommendation to the conductor)

- **Recommendation: BUILD** a two-wave commune-level religious-affiliation product (2002 and 2024) on the current 346-commune frame. This is the largest subnational religion product in the fleet so far — count-valued, 346 communes, two waves, a sharp published religious gradient, a clean CUT join, and a share-alike-but-open licence.
- **Waves and source**: BCN Estadísticas Territoriales theme 101 "Religión Declarada" publishes 1992, 2002, and 2024 at commune level with an identical ten-category harmonised frame. The product ships **2002 and 2024** (both aged 15+, comparable universe). **1992 is held** — it is aged 5+ (a universe break) and predates several commune creations; a documented deeper-history wave, not shipped, no backcast.
- **Universe**: population aged 15 or more in both shipped waves ("Población total en encuesta Religión (... 2002 y 2024 de 15 años o mas)"); no universe break between the two waves.
- **Geography**: 346 communes on the official INE DPA Censal commune layer (CUT-coded). 2024 joins one-to-one by CUT; 2002 joins by CUT for 304 communes and by name for 37 (the communes re-coded when Los Ríos, Arica y Parinacota, and Ñuble regions were created), leaving 5 communes null in 2002 (below).
- **Slot design** (ordinary two-slot, KZ/BZ precedent — Chile has a real "Ninguna" no-religion category, so no minority-share gate): `no_religion_percent` = the single "Ninguna religión, ateo o agnóstico" line / population; `religious_affiliation_percent` = (population − Ninguna − "No declara religión") / population. "No declara religión" (2024 non-response, national 87,515) stays in the denominator and in neither slot, so the two shares need not sum to 100 (KZ Refused-to-indicate precedent). This affiliation definition (population − none − non-response) intentionally captures the INE-derived "Otros cristianos y tradiciones relacionadas con Cristo" group that the BCN ten-category frame does not column (see reconciliation).
- **Map-worthy pattern**: the secularisation trend is sharp and legible by commune. National no-religion share (over responders) rose 8.3% (2002) to 25.8% (2024); Roman Catholic fell 70.0% to 54.0% while Evangelical/Protestant rose 15.1% to 16.3%. Regionally, the evangelical south (Biobío 33.6%, La Araucanía 27.6%, Los Ríos 25.9%, Ñuble 23.7%) contrasts with Catholic Coquimbo (64.0%) and the secular Metropolitana (30% no-religion).
- **Rights position**: INE publishes all its content, including the census statistics and the geodata, under **Creative Commons Reconocimiento-CompartirIgual 4.0 Internacional (CC BY-SA 4.0)** — an open licence with attribution and share-alike, quoted verbatim below. The product ships with attribution to INE and carries the share-alike notice (the Kosovo KAS CC BY-SA precedent). No PI ruling is needed; a courtesy note is recorded, not an ask.

## Premise corrections (trust the record)

- **The span is two waves, not a continuous 2002-2024 series.** Religion was asked in 2002 and 2024 only. The 2012 census was annulled for methodological failure and its religion data do not enter the product (not rehabilitated). The 2017 abbreviated census did not carry a religion question. The usable record is 2002 + 2024 (plus 1992 as held deeper history).
- **The route is machine-readable, not browser work.** BCN Estadísticas Territoriales exposes commune religion counts through a plain HTTP POST to `GenerarConsulta` with downloadable JSON/CSV/XLS/XML; no CAPTCHA gates the query (the CAPTCHA gates only the optional email-delivery of a saved result), and REDATAM (session-bound) is not needed.
- **2024 did ask religion and is fully released.** Question 31 "¿Cuál es su religión o credo?" for residents aged 15+; the religion results were published 2025-08 (regional presentation) with commune detail in the BCN territorial series (crdate 2025-08-12).

## Published waves and geography

| Year | Religion asked | Commune counts public | Universe | Decision |
| --- | --- | --- | --- | --- |
| 1992 | yes | yes (BCN theme 101) | aged 5+ | HOLD — universe break (5+ vs 15+); documented deeper history, not shipped, no backcast. |
| 2002 | yes (Q. on religion) | yes (BCN theme 101) | aged 15+ | Ship — 341 communes with data, 5 null. |
| 2012 | (annulled census) | no usable religion product | — | Excluded — annulled for methodological failure; not rehabilitated. |
| 2017 | no religion question | n/a | — | Excluded — the abbreviated census dropped religion. |
| 2024 | yes (Q. 31) | yes (BCN theme 101) | aged 15+ | Ship — 346 communes, all with data. |

## Route: BCN Estadísticas Territoriales (theme 101 "Religión Declarada")

The commune religion table is queried through the BCN SIIT service, which cites "Fuente: Instituto Nacional de Estadísticas INE" on every result. The reproducible route:

1. POST to `https://www.bcn.cl/siit/estadisticasterritoriales/servicio/GenerarConsulta` with `idTema=101`, `tipoUnidadTerritorial=1` (comuna), `anios=2002` and `anios=2024`, the eleven count indicators `variables=14312..14322`, and every commune CUT (`unidadesTerritoriales=<cut>`, 383 CUTs from `servicio/ObtenerComunaTema?idTema=101`). No CAPTCHA is required.
2. The response embeds a per-request query id; fetch `descargar-resultados/<id>/datos.json` (and `.csv`).

The eleven count indicators (theme-101 variable ids and BCN field names):

| id | BCN indicator (verbatim) | JSON field | product role |
| --- | --- | --- | --- |
| 14312 | Católica | `catolica` | affiliation |
| 14313 | Evangélica o Protestante | `evange_protestante` | affiliation |
| 14314 | Testigos de Jehová | `testigosj` | affiliation |
| 14315 | Judaica | `judaica` | affiliation |
| 14316 | Mormón | `mormon` | affiliation |
| 14317 | Musulmana | `musulmana` | affiliation |
| 14318 | Ortodoxa | `ortodoxa` | affiliation |
| 14319 | Otro religión o credo | `otra` | residual affiliation |
| 14320 | Ninguna religión, ateo o agnóstico | `ninateoagnos` | no-religion |
| 14321 | No declara religión | `rel_nodeclarada` | non-response (2024 only) |
| 14322 | Población total en encuesta Religión | `total_r` | denominator |

The BCN ten-category harmonised frame is the same across 1992/2002/2024 and folds the finer 2024 census options (Budista, Hinduista, Fe Bahá'í) into "Otro religión o credo"; the finer 2024 categories and the derived "Otros cristianos y tradiciones relacionadas con Cristo" appear only in the INE national/regional presentation, not at commune level. Dash cells read as zero (verified: the 2002 categories sum exactly to `total_r` treating dash as 0).

## Category frame (verbatim, BCN theme 101)

The census questionnaire label set (2024, Q. 31) is: Católica; Evangélica o protestante; Judía; Musulmana; Mormón; Católica Ortodoxa; Budista; Hinduista; Fe Bahá'í; Testigo de Jehová; Otra religión o credo; Ninguna. The commune-level series uses the BCN harmonised ten-category frame above (the questionnaire's Judía → "Judaica", Testigo de Jehová → "Testigos de Jehová", and Budista/Hinduista/Baháʼí → "Otro religión o credo"). Both label sets are preserved: the questionnaire set in this probe, the BCN commune-frame labels verbatim on every product row's quality flag.

## Universe and denominator

Both shipped waves count persons aged 15 or more (the age at which religion was asked); there is no universe break between 2002 and 2024. Each commune's denominator is its own `total_r` ("Población total en encuesta Religión"). Population grows across the pair (national religion base 11,128,104 in 2002 to 15,205,784 in 2024); shares are read within each commune's own wave denominator and growth is never treated as a religion change.

**INE's published percentages use the responder base** (`total_r` minus "No declara"): the 2024 headline 74.2% with-religion and 25.8% no-religion are shares of 15,118,269 responders (15,205,784 − 87,515). The product's shares use the full `total_r` denominator with "No declara" as a disclosed residual (KZ precedent), so the product's no-religion share runs ~0.58 percentage points below INE's headline in 2024 and is identical in 2002 (no "No declara" line in 2002). This choice is documented, not hidden.

## Reconciliation (verified in the probe; re-checked fail-fast in the build)

- **2002 (internal, exact).** Every commune's ten categories sum to `total_r` treating dash as 0 (residual 0 for all 341 communes with data). National commune sums: `total_r` 11,128,104; Católica 7,784,616; Evangélica o Protestante 1,689,483; Ninguna 923,038; No declara 0; affiliation (total − none) 10,205,066.
- **2024 (internal, small recorded residual).** Every commune has `total_r` ≥ (ten-category sum); the positive residual is the INE-derived "Otros cristianos" group the BCN frame does not column. National: `total_r` 15,205,784; Católica 8,168,945; Evangélica o Protestante 2,466,441; Ninguna 3,903,128; No declara 87,515; named-category sum 15,179,733; residual 26,051; affiliation (total − none − no-declara) 11,215,141. The shipped affiliation slot (total − none − no-declara) includes the residual, matching the INE record.
- **External check vs the INE presentation (documented discrepancy, not a gate).**
  - 2024 matches closely: affiliation 11,215,141 vs INE 11,214,961 (diff 180); no-religion 3,903,128 vs INE 3,903,308 (diff 180); Católica 8,168,945 vs INE 8,168,978 (diff 33); Evangélica 2,466,441 vs INE 2,466,607 (diff 166). These sub-0.005% differences come from the commune-tabulation extract versus the headline release.
  - 2002 runs uniformly ~0.87% below the INE regional/national base (commune `total_r` 11,128,104 vs the presentation's ~11,226,309 religion base; Católica 7,784,616 vs 7,853,428; no-religion 923,038 vs 931,990). The shortfall is the same percentage across every category, characteristic of the commune-level re-tabulation base excluding a small unassigned population. The commune series reconciles **exactly internally** (every commune, both margins); the ~0.87% gap to the national headline is recorded as a documented discrepancy (Saint Lucia / Côte d'Ivoire precedent), never redistributed.
- The build stops and records any commune whose ten categories exceed `total_r` (negative residual) or whose affiliation goes negative; none do in the probe (minimum residual 0 in both waves).

## Frame handling (single current 346-commune frame; documented 2002 nulls)

The product ships both waves on the current 346-commune INE DPA frame. Two frame facts govern 2002.

The first frame fact is the region re-coding. When Arica y Parinacota and Los Ríos were split off in 2007 and Ñuble in 2018, 37 communes received new CUT codes (e.g. Valdivia 10501 → 14101, Arica 1201 → 15101, Chillán 8401 → 16101). These are the same physical communes; the build maps each 2002 CUT to its current CUT by direct match (304 communes) or unique name match (37), with 0 unmatched.

The second frame fact is the 2004 commune creations. Alto Hospicio, Hualpén, Alto Biobío, and Cholchol were created in 2004 and have no 2002 data; their 2002 population sits inside their parent communes (Iquique, Talcahuano/Concepción, Santa Bárbara, Nueva Imperial), so those four are **null in 2002** and their parents carry the combined 2002 count (change withheld on cross-wave comparison for those specific pairs, documented — the Cambodia reclassification precedent). A fifth commune, **Puchuncaví (CUT 5105), is null in 2002** — a genuine gap in the BCN 2002 series (no row under any CUT or name), rendered as no-data, never an invented split. All five nulls carry 2024 data.

## Boundary source and licence

The boundary is the **official INE DPA Censal commune layer** — the "Comunas_Simp16R" polygon layer (id 3) of the INE geodata FeatureService `Limites_DPA_Censal_2017_AGOL` (ArcGIS item `515565c9739143428fbc50c4689dbca5`, owner `publicaciones_geodatos`, INE's geodata publisher). It carries a `CUT` field, 346 communes, and joins the 2024 census one-to-one by CUT with no gaps or extras (verified: census 2024 CUTs and boundary CUTs are identical sets). The layer is INE geodata, governed by the same INE **CC BY-SA 4.0** open-data licence as the census (the item's own licence field is blank; the governing licence is INE's site-wide open-data licence for INE content).

The extent spans lon −109.45 (Isla de Pascua / Easter Island, CUT 5201, present) to −53.0, and lat −17.5 to **−89.0** — the southern extent is the **Comuna Antártica** (CUT 12202), which includes the Chilean Antarctic Territory claim. No dateline cut is needed (all longitudes are western-hemisphere negative). The Antarctic wedge is rendered as published (the official Chilean commune extent); the page builder should note it may want a continental viewport clip. The build takes no position on the territorial claim; it renders the official INE record.

**Alternative boundary (recorded, not used).** geoBoundaries CHL ADM3 records an explicit `"boundaryLicense": "Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO)"`, `boundarySource` "La Biblioteca del Congreso Nacional de Chile (BCN), OCHA ROLAC", `admUnitCount` 345, `boundaryYearRepresented` 2020. It carries commune names but no CUT field and one fewer unit than the census (345 vs 346), so the CUT-coded INE DPA layer is preferred; geoBoundaries is the explicit-licence swap-in if the conductor prefers it.

## Licence position (accepted, share-alike)

The census statistics and the INE geodata both ship under INE's open-data licence, quoted verbatim from `https://www.ine.gob.cl/terminos-de-uso-y-licencia-de-datos-abiertos` (retrieved 2026-07-12):

> "El contenido de este sitio Web se rige bajo una licencia de Creative Commons Reconocimiento-CompartirIgual 4.0 Internacional. Bajo esta licencia, usted es libre de: Compartir: copiar, difundir, publicar y distribuir el material en cualquier medio o formato. Adaptar: remezclar, transformar, extraer, adaptar y crear a partir del material para cualquier finalidad, incluso comercial ... Reconocimiento: debe "reconocer adecuadamente" la autoría, proporcionar un enlace a la licencia e "indicar si se han realizado cambios" ... Ejemplo: "Fuente: INE, nombre del producto donde se extrae la información, actualizada 2019". CompartirIgual: si remezcla, transforma o crea a partir del material, deberá difundir sus contribuciones bajo la "misma licencia que el original" ... debe asegurarse de notificar al usuario final de cualquier análisis o transformación que haga a la información, y no presentarla de forma que se sugiera que dicho análisis o transformación ha sido realizada por el INE."

This is CC BY-SA 4.0: free reuse (including commercial) with attribution and share-alike, and a requirement to state that the derivation is not INE's own analysis. `licence_status: accepted`. The derived commune summaries ship with attribution to INE, under CC BY-SA 4.0 (share-alike carried), disseminated via BCN Estadísticas Territoriales; on-page attribution must name INE and state that the shares are the project's derivation, not INE's. A courtesy note is recorded for the PI; no ask gates the build.

## Retrieval record

Every cached input is under `data/raw/cl_census/`, git-ignored by `.gitignore:120` (the `data/` rule). Retrieval occurred on 2026-07-12.

| Cached input | Source | Role |
| --- | --- | --- |
| `cl_bcn_comunas_2002_2024.json` / `.csv` | BCN GenerarConsulta theme 101, comuna, 2002+2024, ids 14312-14322 (via `descargar-resultados/<id>/datos.json`) | commune religion counts (build input) |
| `bcn_comunas_101.json` | `servicio/ObtenerComunaTema?idTema=101` | 383 commune CUTs (query index) |
| `ine_comunas_dpa2017.geojson` | INE `Limites_DPA_Censal_2017_AGOL` FeatureServer layer 3 (ArcGIS geojson) | boundary (346 communes, CUT) |
| `ine_dpa_item.json` | ArcGIS item `515565c9...` metadata | boundary provenance |
| `ine_terminos.html` | `ine.gob.cl/terminos-de-uso-y-licencia-de-datos-abiertos` | licence (verbatim) |
| `cl_2024_religion_presentation.pdf` (+ `.txt`) | `censo2024.ine.gob.cl/.../Presentacion-resultados-religion-o-credos_CPV2024.pdf` | 2024 categories, universe, national/regional context |
| `gb_chl_adm3_meta.json` | geoBoundaries CHL ADM3 metadata | alternative-boundary licence (CC BY 3.0 IGO) |

## Blockers and held items

- **1992 wave** (HELD): aged 5+ (universe break vs the shipped 15+ waves) and predates commune creations; documented deeper history, not shipped, no backcast.
- **2012 census** (EXCLUDED): annulled for methodological failure; not rehabilitated, no religion product enters the record.
- **2017 census** (EXCLUDED): the abbreviated census dropped the religion question.
- **2002 nulls** (documented): five communes null in 2002 — four 2004-created communes (parents carry the combined count, change withheld on those pairs) and Puchuncaví (a BCN 2002-series gap), rendered as no-data, never split.
- **2002 vs national headline** (documented discrepancy): the commune series runs ~0.87% below the INE regional/national base, uniform across categories; reconciles exactly internally; recorded, never redistributed.
- **Antarctic extent** (documented): the Comuna Antártica polygon reaches −89 lat (the Chilean Antarctic claim); rendered as the official record; a page-level viewport note is recorded.
- **Licence** (accepted, share-alike): INE CC BY-SA 4.0; ships with attribution and the share-alike notice; courtesy note recorded for the PI, no ask gates the build.
