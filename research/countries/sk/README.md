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
| [SODB previous censuses since 1991](https://www.scitanie.sk/en/data-from-the-previous-censuses-since-1991) | census religious belief | to be pinned | 1991, 2001, 2011 | DATAcube, archived hyper-cubes, Infostat pages | open web routes | SUSR attribution; exact reuse statement still to pin |

Constructs are not interchangeable. The built map uses SODB 2021 religious-belief categories only. It does not merge the national time-series categories with the municipality layer because the time series combines "other" and "not found out".

## Access the data yourself

This project does not redistribute source data; the map shows derived rates with attribution. To obtain the data from the source of record:

- **Source of record**: Statistical Office of the Slovak Republic, [SODB 2021 basic results](https://www.scitanie.sk/en/population/basic-results/structure-of-population-by-religious-belief/SR/SK0/SR).
- **Exact tables**: SODB 2021 `Z01_15`, "Structure of population by religious belief"; SODB 2021 `C01_11`, "Number of population by religious belief in the Slovak Republic in 1880 - 2021"; previous-census routes from the SODB page "Data from the previous censuses since 1991".
- **Licence**: SODB pages identify the Statistical Office of the Slovak Republic as content administrator and technical operator. This build attributes SUSR; the exact CC BY statement was not located during this pass.
- **Our extraction script**: `scripts/build_sk_area_summary.R`.
- **Retrieval recipe and hashes**: `docs/manifests/sk-census-religion-2021.json`.

## Boundaries

- Official boundary files: SODB 2021 DISem `OB.geojson`, attributed to the Statistical Office of the Slovak Republic.
- Boundary changes between waves: no official 1991-2021 municipality correspondence was pinned in this build. The public product therefore ships 2021 municipality/city-part geography only and does not calculate a change layer.
- Bratislava and Košice are represented by city parts, matching SODB 2021 basic-results reporting.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): a single Overpass test returned 7,440 `amenity=place_of_worship` objects for Slovakia.
- Country-specific registers that could seed or verify the layer: Catholic, Greek Catholic, Lutheran, Reformed, Orthodox, Jewish, and state-registered church directories.

## First visualisation

Religious-affiliation percent and no-religion percent by SODB 2021 municipality/city-part reporting unit.

## Built map

- **App route**: `apps/regions/sk/index.html`.
- **Data products**: `apps/regions/sk/data/area_summary_municipality.json`, `apps/regions/sk/data/area_summary_municipality.csv`, and `apps/regions/sk/data/sk_municipality_2021.geojson`.
- **Script**: `scripts/build_sk_area_summary.R`.
- **Manifest**: `docs/manifests/sk-census-religion-2021.json`.
- **Wave and denominator**: 2021 only. Percentages divide by SODB total population, including `nezistené` / not found out, because SUSR's published shares use that denominator.
- **Boundary basis**: SODB 2021 OB GeoJSON filtered to 2,927 municipality/city-part features and simplified for the web map.

## Build recipe

1. Extract SODB 2021 `Z01_15` municipality JSON as 79 district-scoped files, plus the national `Z01_15` row for reconciliation.
2. Build `area_summary` per `schemas/area-summary.schema.json`, with religious affiliation defined as total population minus no religion and not found out.
3. Filter SODB 2021 `OB.geojson` to municipality/city-part features, join by official SODB area code, compute area in projected coordinates, and simplify the web boundary under 3 MiB.
4. Configure `apps/regions/sk/index.html` with the shared region runtime.
5. Verify exact national totals, exact boundary joins, output feature counts, and manifest JSON validity.

## Risks and open questions

- The 1991, 2001, and 2011 subnational religion sources still need a reliable extraction route and official geography decision.
- No official municipality boundary correspondence across waves was pinned. Older waves should stay at the geography that is honestly publishable until an official concordance is found.
- The SODB site pages used here did not expose a clear CC BY statement during this pass; attribution is included and the report records the uncertainty.
- Religion, ethnicity, language, and Roma/Rusyn/Hungarian identity measures are separate constructs and should not be combined.

## Deep-history potential

Parish registers in Slovak state archives, diocesan schematisms, Lutheran and Reformed church archives, Jewish community records, and Hungarian Kingdom census volumes.
