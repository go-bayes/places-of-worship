# Country data map: Mexico (MX)

## Status

- **Tier**: A (buildable now)
- **Build state**: municipality data map built for 2010 and 2020; 2000 raw archive downloaded and documented but excluded from the public product because it does not expose the four requested constructs separately.
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

## Boundaries

- Official boundary files: INEGI Marco Geoestadistico municipal and locality products, <https://www.inegi.org.mx/temas/mg/>; geoBoundaries MEX ADM2 is a fallback.
- Anchor the first public choropleth on 2020 municipalities; locality mapping can follow after point and polygon joins are tested.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not measured in this survey; run ohsome or Overpass before build.
- Country-specific registers that could seed or verify the layer: Catholic diocesan parish directories, INAH heritage registers, evangelical and Pentecostal denominational directories, and municipal cultural inventories.

## First visualisation

Religious-affiliation percent by municipality, 2010-2020, on 2020 Marco Geoestadistico municipal boundaries. The 2000 ITER route is open, but its religion fields are a different, coarser format; the first public product therefore omits 2000 rather than imposing a substitute crosswalk.

## Build recipe

1. Extract: parse ITER files for `PCATOLICA`, `PRO_CRIEVA`, `POTRAS_REL`, and `PSIN_RELIG`, aggregate or reconcile localities to municipality, and retain INEGI source metadata. For 2010, `pncatolica` maps to the Protestant/evangelical/biblical construct named in the dictionary. For 2020, suppressed small-locality cells mean the public rows use official `LOC=0000` municipality totals with locality-sum reconciliation results in the manifest.
2. Governed product: `area_summary` per `schemas/area-summary.schema.json`, with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: use INEGI 2020 municipal Marco Geoestadistico and join by state and municipality codes.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: reconcile state and national totals, municipality join coverage, licence and attribution strings.

## Risks and open questions

- Category labels changed across waves; the current map keeps only the four top-level constructs and omits change layers until a full crosswalk is adjudicated.
- The 2000 ITER file does not separate the requested four constructs; keep it documented as a source gap unless a governed crosswalk is approved.
- Locality identifiers need careful treatment where localities split, close, or change code.

## Deep-history potential

Catholic diocesan and parish archives, INAH heritage records, Archivo General de la Nacion, state archives, mission records, and historical newspapers support colonial and nineteenth-century site histories.
