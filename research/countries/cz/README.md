# Country data map: Czechia (CZ)

## Status

- **Tier**: A (buildable now)
- **Build state**: survey verified
- **Last verified**: 2026-07-07; tier-A verification: https://scitani.gov.cz/datastat/api/katalog/vybery/SLD008T02?jazyk=cs and https://scitani.gov.cz/datastat/api/dotaz/data/vybery/SLD008T02?jazyk=cs

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [CZSO DataStat SLD008T02](https://scitani.gov.cz/datastat/api/katalog/vybery/SLD008T02?jazyk=cs) | census affiliation | region (kraj) | 2021 in verified query; catalogue carries four census-year slots | JSON API | open | CZSO terms |
| [CZSO Census 2021 religion page](https://scitani.gov.cz/nabozenska-vira) | census affiliation by church or religious society | region (kraj) | 2021; page also reports 1991-2021 national comparison | XLSX/CSV/API | open | CZSO terms |

## Boundaries

- Official boundary files: CZSO Geoportal and RUIAN administrative boundaries; Eurostat GISCO NUTS/LAU can support regional and municipality joins.
- Boundary changes between waves and the harmonisation plan: first product anchors on 2021 regions; municipality mapping needs a separate confirmed table because SLD008T02 is regional.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): Overpass country count did not complete reliably in this sweep.
- Country-specific registers that could seed or verify the layer: Czech church registers, diocesan parish lists, Jewish communities federation, and CZSO religious-organisation write-in categories.

## First visualisation

Census religious-affiliation share by region, 2021, with no-religion and believers-with-church categories on 2021 regional boundaries.

## Build recipe

1. Extract: DataStat `SLD008T02` JSON for population by religious faith and regions.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`, one row per region, year, and affiliation category.
3. Boundaries: CZSO Geoportal regional polygons or GISCO NUTS 2021.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: reconcile DataStat totals with `sldb2021_pv_obyvatelstvo_podle_cirkvi_a_kraju.xlsx` from the Census 2021 religion page.

## Risks and open questions

- The verified public table is regional rather than municipality-level.
- The 2021 religion question used write-in responses, which affects comparability with earlier lists.
- Non-response is large and must remain a category.

## Deep-history potential

Parish registers in regional archives, Catholic diocesan schematisms, Czech Brethren records, Jewish community archives, First Republic census volumes, and Habsburg-era gazetteers.
