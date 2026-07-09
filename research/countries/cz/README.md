# Country data map: Czechia (CZ)

## Status

- **Tier**: A (buildable now)
- **Build state**: map live (kraj-level census 2021)
- **Last verified**: 2026-07-09; built from CZSO DataStat SLD008T02. Products at `apps/regions/cz/data/`, page at `apps/regions/cz/index.html`, manifest at `docs/manifests/cz-census-religion-2021.json`, build script at `scripts/build_cz_area_summary.R`.

### Pre-2021 probe result (2026-07-09)

Only the 2021 wave is retrievable at kraj level. The DataStat SLD008T02
selection pins the `CenRoky1` filter to `C20210326` (the 2021 census
date); the data endpoint is GET-only (POST returns HTTP 405) and a
`CenRoky1` year-filter override on the GET is ignored, so both the
`scitani.gov.cz/datastat` and the underlying `data.csu.gov.cz/api/dotaz/v1`
endpoints return the single 2021 slice (dimension size `[1,1,1,15,8]`).
The `CenRoky1` dimension carries four census-year codelist slots, but the
`SLD008` dataset (verze 4, published 2023-02-27) uses the 2021 write-in
religion classification `NABVIRAWS1`, which is not populated for 1991,
2001, or 2011. The `nabozenska-vira` page reports a 1991-2021 comparison
at national level only. Earlier subnational waves are deferred until a
compatible source and classification crosswalk are pinned.

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [CZSO DataStat SLD008T02](https://scitani.gov.cz/datastat/api/katalog/vybery/SLD008T02?jazyk=cs) | census affiliation | region (kraj) | 2021 in verified query; catalogue carries four census-year slots | JSON API | open | CZSO terms |
| [CZSO Census 2021 religion page](https://scitani.gov.cz/nabozenska-vira) | census affiliation by church or religious society | region (kraj) | 2021; page also reports 1991-2021 national comparison | XLSX/CSV/API | open | CZSO terms |

## Access the data yourself

This project does not redistribute source data; the map shows derived
rates with attribution. To obtain the data from the source of record:

- **Source of record**: Czech Statistical Office (Český statistický úřad),
  Census 2021, via the DataStat API and the religion page
  https://scitani.gov.cz/nabozenska-vira
- **Exact tables**: DataStat table `SLD008T02` (Obyvatelstvo podle
  náboženské víry a krajů) — catalogue
  `https://scitani.gov.cz/datastat/api/katalog/vybery/SLD008T02?jazyk=cs`,
  data `https://scitani.gov.cz/datastat/api/dotaz/data/vybery/SLD008T02?jazyk=cs`.
  Reconciliation workbook
  `sldb2021_pv_obyvatelstvo_podle_cirkvi_a_kraju.xlsx` from the religion page.
- **Boundaries**: Eurostat GISCO NUTS3 2021 (kraje are NUTS3 in Czechia);
  administrative boundaries © EuroGeographics.
- **Licence**: CZSO open data — reuse permitted with attribution under the
  CZSO conditions for using and further publishing statistical data. GISCO
  boundaries under GISCO download provisions with EuroGeographics attribution.
- **Our extraction script**: `scripts/build_cz_area_summary.R` — public
  code that turns SLD008T02 into the map's `area_summary` product.
- **Retrieval recipe and hashes**: `docs/manifests/cz-census-religion-2021.json`
  — source URLs, retrieval date, and SHA-256s for every object used.

## Boundaries

- Official boundary files: CZSO Geoportal and RUIAN administrative boundaries; Eurostat GISCO NUTS/LAU can support regional and municipality joins. The shipped product uses Eurostat GISCO NUTS3 2021 (the 14 CZ kraje), joined to the census rows by region name (14/14).
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
