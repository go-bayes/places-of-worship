# Country data map: Mexico (MX)

## Status

- **Tier**: A (buildable now)
- **Build state**: municipality data map built for 2000-2020. The 2000 wave uses the population aged 5 and over and the JB-ratified two-field derivation. The 2010 and 2020 waves use full-population four-construct rows.
- **Last verified**: 2026-07-07; verified INEGI ITER and Marco Geoestadistico routes:
  <https://www.inegi.org.mx/contenidos/programas/ccpv/2020/datosabiertos/iter/iter_00_cpv2020_csv.zip>,
  <https://www.inegi.org.mx/programas/ccpv/2010/>,
  <https://www.inegi.org.mx/programas/ccpv/2000/>,
  <https://www.inegi.org.mx/temas/mg/>.

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| INEGI 2020 Census ITER CSV, <https://www.inegi.org.mx/contenidos/programas/ccpv/2020/datosabiertos/iter/iter_00_cpv2020_csv.zip> | census affiliation | locality | 2020 | CSV zip | open | INEGI terms |
| INEGI 2010 Census ITER CSV, <https://www.inegi.org.mx/programas/ccpv/2010/> | census affiliation | locality | 2010 | CSV zip | open | INEGI terms |
| INEGI 2000 Census ITER CSV, <https://www.inegi.org.mx/programas/ccpv/2000/> | census affiliation | locality | 2000 | CSV zip | open | INEGI terms |

## Access the data yourself

This project does not redistribute source data; the map shows derived rates with attribution. To obtain the data from the source of record:

- **Source of record**: Instituto Nacional de Estadistica y Geografia (INEGI), <https://www.inegi.org.mx/contenidos/programas/ccpv/2020/datosabiertos/iter/iter_00_cpv2020_csv.zip>, <https://www.inegi.org.mx/contenidos/programas/ccpv/2010/datosabiertos/iter_nal_2010_csv.zip>, and <https://www.inegi.org.mx/contenidos/programas/ccpv/2000/datosabiertos/cgpv2000_iter_00_csv.zip>.
- **Exact tables**: `inegi-cpv-2020-iter-locality`, `inegi-cpv-2010-iter-locality`, `inegi-cgpv-2000-iter-locality`, and `inegi-marco-geoestadistico-cpv2020-municipal`; 2020 field set `PCATOLICA`, `PRO_CRIEVA`, `POTRAS_REL`, `PSIN_RELIG`.
- **Licence**: INEGI open downloads subject to INEGI terms at https://www.inegi.org.mx/inegi/terminos.html and product/source attribution. The Marco Geoestadistico CPV 2020 product page marks SHP downloads with INEGI's data-open standard.
- **Our extraction script**: `scripts/build_mx_area_summary.R`.
- **Retrieval recipe and hashes**: `docs/manifests/mx-census-religion-2000-2020.json`.

## Boundaries

- Official boundary files: INEGI Marco Geoestadistico municipal and locality products, <https://www.inegi.org.mx/temas/mg/>; geoBoundaries MEX ADM2 is a fallback.
- Anchor the first public choropleth on 2020 municipalities; locality mapping can follow after point and polygon joins are tested.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not measured in this survey; run ohsome or Overpass before build.
- Country-specific registers that could seed or verify the layer: Catholic diocesan parish directories, INAH heritage registers, evangelical and Pentecostal denominational directories, and municipal cultural inventories.

## First visualisation

Religious-affiliation percent by municipality, 2000-2020, on 2020 Marco Geoestadistico municipal boundaries. The 2000 wave uses the population aged 5 and over. The build derives the two headline metrics from `p5_catolic`, `p5_ncatoli`, and `p5_sinreli`; 2000-to-2010 change needs care.

## Build recipe

1. Extract: parse the 2000 ITER fields `p5_catolic`, `p5_ncatoli`, and `p5_sinreli`. Parse the 2010 and 2020 ITER fields `PCATOLICA`, `PRO_CRIEVA`, `POTRAS_REL`, and `PSIN_RELIG`. Aggregate or reconcile localities to municipality and retain INEGI source metadata. For 2000, `population_total = p5_catolic + p5_sinreli`, `religious_affiliation_count = p5_catolic + p5_ncatoli`, and `no_religion_count = p5_sinreli - p5_ncatoli`. For 2010, `pncatolica` maps to the Protestant/evangelical/biblical construct named in the dictionary. For 2020, suppressed small-locality cells mean the public rows use official `LOC=0000` municipality totals with locality-sum reconciliation results in the manifest.
2. Governed product: `area_summary` per `schemas/area-summary.schema.json`, with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: use INEGI 2020 municipal Marco Geoestadistico and join by state and municipality codes.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: reconcile state and national totals, municipality join coverage, licence and attribution strings.

## Risks and open questions

- Category labels changed across waves; the current map keeps only the two headline metrics and omits change layers until a full crosswalk is adjudicated.
- Locality identifiers need careful treatment where localities split, close, or change code.

## Resolved notes

- JB's 2026-07-07 ruling permits the 2000 wave in the public product. The ruling ratifies deriving `population_total`, `religious_affiliation_count`, and `no_religion_count` from the ages-5+ fields. The previous source-gap risk is resolved.

## Deep-history potential

Catholic diocesan and parish archives, INAH heritage records, Archivo General de la Nacion, state archives, mission records, and historical newspapers support colonial and nineteenth-century site histories.
