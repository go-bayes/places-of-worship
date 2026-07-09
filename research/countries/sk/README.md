# Country data map: Slovakia (SK)

## Status

- **Tier**: A (buildable now)
- **Build state**: map live
- **Last verified**: 2026-07-09

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [SODB 2021 Z01_15, structure of population by religious belief](https://www.scitanie.sk/en/population/basic-results/structure-of-population-by-religious-belief/SR/SK0/SR) | census religious belief | municipality and Bratislava/Košice city part | 2021 | JSON/CSV/XLSX from SODB DISem assets | open web asset | SUSR attribution; exact CC BY statement not located in this pass |
| [SODB 2021 C01_11, number of population by selected religious belief](https://www.scitanie.sk/en/population/time-series/number-of-population-by-selected-religious-belief/) | national religious-belief time series | Slovak Republic | 1880-2021 | JSON | open web asset | SUSR attribution; exact CC BY statement not located in this pass |
| [Infostat SODB 2001 data118](http://sodb.infostat.sk/scitanie/sk/2001/format.htm) | census religious belief | kraj | 2001 | HTML | open web route | SUSR attribution; exact reuse statement still to pin |
| [SODB 2011 multidimensional table TAB. 118](https://census2011.statistics.sk/tabulky.html) | census religious belief | kraj | 2011 | XLS | open web route | SUSR attribution; exact reuse statement still to pin |
| [Infostat SODB 1991 data118](http://sodb.infostat.sk/scitanie/sk/1991/format.htm) | census religious belief | source district/obvod geography | 1991 | HTML | open web route | deferred for current-kraj product |

Constructs are not interchangeable. The live municipality map uses SODB 2021 religious-belief categories only. The companion kraj product carries the same headline convention for 2001, 2011, and 2021: religious affiliation excludes no religion and `nezistené` / not found out, while `nezistené` remains in the denominator.

## Access the data yourself

This project does not redistribute source data; the map shows derived rates with attribution. To obtain the data from the source providers:

- **Source providers**: Statistical Office of the Slovak Republic and Infostat, including [SODB 2021 basic results](https://www.scitanie.sk/en/population/basic-results/structure-of-population-by-religious-belief/SR/SK0/SR), the SODB 2011 multidimensional tables, and the Infostat 2001 previous-census pages.
- **Exact tables**: Infostat 2001 `data118.aspx`, "Obyvateľstvo podľa pohlavia a náboženstva"; SODB 2011 `TAB. 118`, "Obyvateľstvo podľa pohlavia a náboženského vyznania"; SODB 2021 `Z01_15`, "Structure of population by religious belief"; SODB 2021 `C01_11`, "Number of population by religious belief in the Slovak Republic in 1880 - 2021".
- **Licence**: SODB pages identify the Statistical Office of the Slovak Republic as content administrator and technical operator. The 2001 Infostat tables identify the Statistical Office as the data source. This build attributes SUSR and Infostat; the exact CC BY statement was not located during this pass.
- **Our extraction script**: `scripts/build_sk_area_summary.R`.
- **Retrieval recipe and hashes**: `docs/manifests/sk-census-religion-2001-2021.json`.

## Boundaries

- Official boundary files: SODB 2021 DISem `OB.geojson`, attributed to the Statistical Office of the Slovak Republic.
- Boundary changes between waves: no official 1991-2021 municipality correspondence was pinned in this build. The live map therefore ships 2021 municipality/city-part geography only and does not calculate a municipality change layer.
- Kraj companion geography: the eight-kraj boundary is dissolved from the SODB 2021 municipality boundary product, which carries `region_code` / `kraj_kod`. The 2001 and 2011 sources already publish the same current kraj units.
- Bratislava and Košice are represented by city parts, matching SODB 2021 basic-results reporting.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): a single Overpass test returned 7,440 `amenity=place_of_worship` objects for Slovakia.
- Country-specific registers that could seed or verify the layer: Catholic, Greek Catholic, Lutheran, Reformed, Orthodox, Jewish, and state-registered church directories.

## First visualisation

Religious-affiliation percent and no-religion percent by SODB 2021 municipality/city-part reporting unit. The companion product adds the same two metrics at current-kraj level for 2001, 2011, and 2021.

## Built map

- **App route**: `apps/regions/sk/index.html`.
- **Data products**: `apps/regions/sk/data/area_summary_municipality.json`, `apps/regions/sk/data/area_summary_municipality.csv`, `apps/regions/sk/data/sk_municipality_2021.geojson`, `apps/regions/sk/data/area_summary_kraj.json`, `apps/regions/sk/data/area_summary_kraj.csv`, and `apps/regions/sk/data/sk_kraj_2021.geojson`.
- **Script**: `scripts/build_sk_area_summary.R`.
- **Manifest**: `docs/manifests/sk-census-religion-2001-2021.json`.
- **Wave and denominator**: The municipality product is 2021 only. The kraj companion product covers 2001, 2011, and 2021. Percentages divide by the source total population, including `nezistené` / not found out.
- **Boundary basis**: SODB 2021 OB GeoJSON filtered to 2,927 municipality/city-part features and simplified for the web map; the kraj layer dissolves that municipality boundary product to eight current kraje and stays below 800 KB.

## Build recipe

1. Extract SODB 2021 `Z01_15` municipality JSON as 79 district-scoped files, plus the national `Z01_15` row for reconciliation.
2. Build `area_summary` per `schemas/area-summary.schema.json`, with religious affiliation defined as total population minus no religion and not found out.
3. Filter SODB 2021 `OB.geojson` to municipality/city-part features, join by official SODB area code, compute area in projected coordinates, and simplify the web boundary under 3 MiB.
4. Extract Infostat 2001 kraj `data118.aspx` HTML tables and SODB 2011 kraj `TAB. 118` XLS files through the pinned `data.php` routes; sum men and women to totals.
5. Aggregate the existing 2021 municipality product to kraj using the embedded SODB kraj prefix and the boundary `kraj_kod` field.
6. Dissolve the municipality boundary product to eight current kraje and simplify it with mapshaper weighted keep-shapes.
7. Verify exact national totals, exact boundary joins, output feature counts, and manifest JSON validity.

## Risks and open questions

- The 1991 source remains deferred for the current-kraj companion product. The Infostat source uses 42 district/obvod rows and broad reporting regions, and current kraje did not exist until 1996.
- No official municipality boundary correspondence across waves was pinned. Older waves should stay at the geography that is honestly publishable until an official concordance is found.
- The SODB site pages used here did not expose a clear CC BY statement during this pass; attribution is included and the report records the uncertainty.
- Religion, ethnicity, language, and Roma/Rusyn/Hungarian identity measures are separate constructs and should not be combined.

## Deep-history potential

Parish registers in Slovak state archives, diocesan schematisms, Lutheran and Reformed church archives, Jewish community records, and Hungarian Kingdom census volumes.
