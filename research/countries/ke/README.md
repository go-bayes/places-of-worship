# Country data map: Kenya (KE)

## Status

- **Tier**: A (buildable now)
- **Build state**: map live (2019 wave)
- **Last verified**: 2026-07-09 (built: KNBS 2019 KPHC Volume IV table 2.30, 47 counties; geoBoundaries KEN ADM1 2020; county sums reconcile exactly to the KENYA national row)

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| Kenya National Bureau of Statistics 2019 Kenya Population and Housing Census Volume IV, https://www.knbs.or.ke/reports/kenya-census-2019/ | census affiliation | county; county report tables expose religious categories | 2019 | PDF download landing page | open web | licence not stated |
| Kenya National Bureau of Statistics 2009 Census reports, https://www.knbs.or.ke/reports/kenya-census-2009/ | census affiliation | district/province to harmonise to counties | 2009 | PDF download landing page | open web | licence not stated |
| DHS Program surveys API, https://api.dhsprogram.com/rest/dhs/surveys?countryIds=KE&f=json | respondent religious affiliation in survey recodes; survey estimates | DHS region | 1989-2022 | API metadata, reports, recode ZIPs | reports open; recodes require DHS approval | DHS terms |

Constructs are not interchangeable: census affiliation and DHS respondent affiliation must stay in separate layers.

**2009 wave probe (2026-07-09)**: not retrievable at county/district level. The 2009 KPHC Volume II reports religion only in Table 12 as a single national (KENYA) column — Catholic 9,010,684; Protestant 18,307,466; Other Christian 4,559,584; Muslim 4,304,798; Hindu 53,393; Traditionalist 635,352; Other 557,450; No religion 922,128; Don't know 61,233; total 38,412,088 — with no county or district breakdown, and 2009 predates the 47-county geography. Only the 2019 wave is shipped; the 2009 sub-national wave is deferred and recorded in the manifest's `deferred_sources`.

**Category mapping (2019, Table 2.30)**: religious affiliation combines the ten named-religion columns (Catholic, Protestant, Evangelical Churches, African Instituted Churches, Orthodox, Other Christian, Islam, Hindu, Traditionists, Other Religion); no religion is the No religion/Atheists column; the stated-response denominator is the county total minus Don't Know and Not Stated. Nationally: denominator 47,133,120; religious affiliation 46,377,370 (98.40%); no religion 755,750 (1.60%); Don't Know + Not Stated 80,162 (0.17% of the table total). The Table 2.30 total (47,213,282) is below the enumerated population (47,564,296) because the religion question was not asked of people in institutions, hotels, hospitals, prisons, and among travellers and outdoor sleepers.

## Access the data yourself

This project does not redistribute source data; the map shows derived
rates with attribution. To obtain the data from the source of record:

- **Source of record**: Kenya National Bureau of Statistics, [2019 Kenya Population and Housing Census reports](https://www.knbs.or.ke/reports/kenya-census-2019/).
- **Exact table**: Volume IV (Distribution of Population by Socio-Economic Characteristics), Table 2.30 "Distribution of Population by Religious Affiliation and County" — [Volume IV PDF](https://www.knbs.or.ke/wp-content/uploads/2023/09/2019-Kenya-population-and-Housing-Census-Volume-4-Distribution-of-Population-by-Socio-Economic-Characteristics.pdf).
- **Boundaries**: geoBoundaries KEN ADM1 (2020 counties), Public Domain — [metadata/API](https://www.geoboundaries.org/api/current/gbOpen/KEN/ADM1/).
- **Licence**: KNBS publishes the census reports for open download and requests attribution; no explicit reuse licence is stated. geoBoundaries gbOpen is Public Domain (boundary source RCMRD GeoPortal via Africa GeoPortal).
- **Our extraction script**: [`scripts/build_ke_area_summary.R`](../../../scripts/build_ke_area_summary.R) — parses Table 2.30 from the Volume IV PDF with `pdftotext -layout`, derives the two headline metrics, joins to the geoBoundaries counties, and writes the `area_summary` products.
- **Retrieval recipe and hashes**: [`docs/manifests/ke-census-religion-2019.json`](../../../docs/manifests/ke-census-religion-2019.json) — URLs, retrieval steps, and SHA-256s for every object used.

## Boundaries

- Official boundary files: geoBoundaries ADM1 counties, 2020, public domain; ADM2 sub-counties, 2020, CC BY 3.0 IGO.
- Boundary changes between waves and the harmonisation plan: anchor on 2019 counties and create district-to-county crosswalks for 2009.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not counted during this source sweep; run ohsome or Overpass before build.
- Country-specific registers that could seed or verify the layer: National Council of Churches of Kenya, Kenya Conference of Catholic Bishops, Supreme Council of Kenya Muslims, Anglican Church of Kenya dioceses.

## First visualisation

Census religious-affiliation percent by county, 2009 and 2019, on 2019 county boundaries.

## Build recipe

1. Extract: start with 2019 KPHC Volume IV religion-by-county tables, then add 2009 religion tables.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`, with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: geoBoundaries `KEN ADM1` counties; keep `KEN ADM2` sub-counties for later detail.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: reconcile national totals, join coverage, licence and attribution strings.

## Risks and open questions

- 2009 district geography does not match 2019 counties cleanly.
- PDF table extraction may be needed for both waves.

## Deep-history potential

Kenya National Archives, Church Missionary Society records, Consolata and Catholic diocesan archives, Anglican Church of Kenya archives, Swahili coast mosque histories, and digitised Kenyan newspapers.
