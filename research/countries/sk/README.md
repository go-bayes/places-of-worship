# Country data map: Slovakia (SK)

## Status

- **Tier**: A (buildable now)
- **Build state**: survey verified
- **Last verified**: 2026-07-07; tier-A verification: https://www.scitanie.sk/en/population/basic-results/structure-of-population-by-religious-belief/SR/SK0/SR

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [SODB 2021 religious belief basic results](https://www.scitanie.sk/en/population/basic-results/structure-of-population-by-religious-belief/SR/SK0/SR) | census affiliation or religious belief | municipality | 2021 | XLSX/CSV/JSON | open | Statistical Office terms |
| [SODB previous censuses since 1991](https://www.scitanie.sk/en/about-the-census/data-from-the-previous-censuses-since-1991) | census affiliation or religious belief | municipality/district, depending wave | 1991, 2001, 2011 | web/downloads | open | Statistical Office terms |

## Boundaries

- Official boundary files: SODB 2021 geospatial data and Slovak statistical/geodetic boundaries; geoBoundaries ADM2 is a fallback.
- Boundary changes between waves and the harmonisation plan: anchor on 2021 municipalities and build concordances for merged or renamed municipalities.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): a single Overpass test returned 7,440 `amenity=place_of_worship` objects for Slovakia.
- Country-specific registers that could seed or verify the layer: Catholic, Greek Catholic, Lutheran, Reformed, Orthodox, Jewish, and state-registered church directories.

## First visualisation

Religious-belief affiliation percent by municipality, censuses 2001-2021, on 2021 municipality boundaries.

## Build recipe

1. Extract: SODB 2021 `structure-of-population-by-religious-belief` CSV for all municipalities, then add previous-census municipality tables.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`.
3. Boundaries: SODB geospatial municipality layer from `gis.scitanie.sk`.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: reconcile municipality totals to national religious-belief totals for each wave.

## Risks and open questions

- Earlier census categories and municipality boundaries need concordance work.
- Roma, Rusyn, Hungarian, and religious affiliation data should be handled with care because ethnicity, language, and religion are separate constructs.

## Deep-history potential

Parish registers in Slovak state archives, diocesan schematisms, Lutheran and Reformed church archives, Jewish community records, and Hungarian Kingdom census volumes.
