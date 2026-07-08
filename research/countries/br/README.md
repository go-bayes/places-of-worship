# Country data map: Brazil (BR)

## Status

- **Tier**: A (buildable now)
- **Build state**: map live; municipality and UF census-religion overlays built for 2000, 2010, and 2022.
- **Last verified**: 2026-07-07; verified SIDRA table 137, SIDRA table 9537, IBGE 2022 malhas, and the generated manifest:
  <https://servicodados.ibge.gov.br/api/v3/agregados/137/metadados>,
  <https://servicodados.ibge.gov.br/api/v3/agregados/9537/metadados>,
  <https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio&periodo=2022>,
  `docs/manifests/br-census-religion-2000-2022.json`.

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| IBGE SIDRA aggregate 137, variable 93, classification 133 (`Religião`), <https://servicodados.ibge.gov.br/api/v3/agregados/137/metadados> | census affiliation: resident population by religion | municipality | 1991, 2000, 2010; map uses 2000 and 2010 | API | open | IBGE public API terms not explicit in API response |
| IBGE SIDRA aggregate 9537, variable 140, classifications 133 (`Religião`), 2 (`Sexo` = Total, 6794), and 58 (`Grupo de idade` = Total, 95253), <https://servicodados.ibge.gov.br/api/v3/agregados/9537/metadados> | census affiliation for people aged 10 years or older | municipality | 2022 | API | open | IBGE public API terms not explicit in API response |

## Access the data yourself

This project does not redistribute source data; the map shows derived rates with attribution. To obtain the data from the source of record:

- **Source of record**: Instituto Brasileiro de Geografia e Estatística (IBGE), SIDRA and malhas APIs, <https://servicodados.ibge.gov.br/api/v3/agregados/137/metadados> and <https://servicodados.ibge.gov.br/api/v3/agregados/9537/metadados>.
- **Exact tables**: `ibge-sidra-137-religion-2000-2010` (`aggregate_id` 137, `variable_id` 93, `classification_ids` 133) and `ibge-sidra-9537-religion-age10plus-2022` (`aggregate_id` 9537, `variable_id` 140, `classification_ids` 133|2|58).
- **Licence**: IBGE public API data; no explicit machine-readable redistribution licence was found in the SIDRA, malhas, or localities API responses during this build. Derived public products attribute Instituto Brasileiro de Geografia e Estatística (IBGE) and link to the source API URLs.
- **Our extraction script**: `scripts/build_br_area_summary.R`.
- **Retrieval recipe and hashes**: `docs/manifests/br-census-religion-2000-2022.json`.

## Boundaries

- Official boundary files: IBGE 2022 municipal malhas and UF malhas from the malhas API; geoBoundaries ADM2 at <https://www.geoboundaries.org/api/current/gbOpen/BRA/ADM2/> remains an open fallback.
- The live map anchors municipality rows on 2022 municipalities. A published municipality split/merge concordance is still required before making long-run municipality trend claims.
- The generated municipality GeoJSON is 2.68 MB after 2 km simplification. The UF GeoJSON is 61 KB after 5 km simplification.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not measured in this survey; run ohsome or Overpass by `amenity=place_of_worship` before build.
- Country-specific registers that could seed or verify the layer: Catholic diocesan parish lists, Conselho Nacional de Igrejas Cristas do Brasil member lists, evangelical denominational directories, and municipal heritage inventories.

## First visualisation

Religious-affiliation percent and `Sem religião` percent by municipality and UF, 2000-2022, on 2022 boundaries.

## Build recipe

1. Built: `scripts/build_br_area_summary.R` pulls and caches SIDRA responses by UF under `data/raw/br_census/`, with `sources.csv` recording URLs, hashes, aggregate IDs, variable IDs, classifications, periods, and licence notes.
2. Built: `apps/regions/br/data/area_summary_municipality.{json,csv}` and `apps/regions/br/data/area_summary_uf.{json,csv}`.
3. Built: `apps/regions/br/data/br_municipality_2022.geojson` and `apps/regions/br/data/br_uf_2022.geojson` from IBGE malhas.
4. Built: `apps/regions/br/index.html` with IBGE/SIDRA and IBGE malhas attribution on the page. The page hides place-density and change metrics until those constructs have governed inputs.
5. Manifest: `docs/manifests/br-census-religion-2000-2022.json` records raw sources, derived files, checksums, join coverage, and validation.

## Risks and open questions

- The 2022 table changes the age universe to people aged 10 years or older. Every 2022 row is flagged `age_universe_10_plus`, and the page names the break in the popup denominator note.
- Municipality boundary changes require a published concordance before long-run trend claims. The page therefore omits the calculated change layer.
- Municipality join coverage is 5,507/5,570 for 2000, 5,565/5,570 for 2010, and 5,570/5,570 for 2022. UF coverage is 27/27 in all three waves.
- The IBGE localities API includes Boa Esperança do Norte (`5101837`), which is absent from the 2022 malha used here; it is recorded as an unmapped locality row in the manifest.
- Formal machine-readable IBGE redistribution terms were not found in the API responses during this build. The map and manifest attribute IBGE and link to the source APIs.

## Deep-history potential

Catholic diocesan archives, parish sacramental registers, IBGE historical municipality files, Arquivo Nacional, state public archives, mission society archives, and historical newspapers support site histories before modern censuses.
