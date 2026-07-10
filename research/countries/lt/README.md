# Country data map: Lithuania (LT)

## Status

- **Tier**: A (buildable now)
- **Build state**: data extracted
- **Last verified**: 2026-07-10

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [State Data Agency Official Statistics Portal (OSP) flow `S3R778_GBS010306_1`](https://osp-rs.stat.gov.lt/rest_json/data/S3R778_GBS010306_1) | census affiliation: religious community indicated | municipality | 2001, 2011, 2021 | Statistical Data and Metadata eXchange (SDMX)-JSON | anonymous public GET | Source attribution required; no named licence located |
| [State Enterprise Centre of Registers municipality spatial data](https://data.gov.lt/datasets/1345/?resource_version=1125) | municipality boundary | municipality | 2025 | JSON/Well-Known Text (WKT) | public | CC BY 4.0 |

The 2001 and 2011 religion values are full-enumeration census responses. The 2021 values are sample/model-based ethnocultural statistical-survey estimates published with the register-based census. The State Data Agency's [2021 ethnocultural release](https://osp.stat.gov.lt/en/2021-gyventoju-ir-bustu-surasymo-rezultatai/tautybe-gimtoji-kalba-ir-tikyba) describes the method: 56,000 household residents completed the questionnaire themselves, interviewers surveyed a further 115,000 household residents, and mathematical methods produced the population estimates. The product shows all three snapshots and withholds cross-instrument change metrics.

## Access the data yourself

- **Source of record**: [State Data Agency Official Statistics Portal](https://osp.stat.gov.lt/gyventoju-ir-bustu-surasymai1).
- **Exact tables**: municipality share hash `a19ff692-f3aa-4a3d-90c3-84c7880fa9fa`, SDMX flow `S3R778_GBS010306_1`, and expanded national flow `S3R778_GBS010502`.
- **Licence**: OSP requires source attribution; no named open licence was located for the indicator flow. The Registers Centre boundary is CC BY 4.0.
- **Our extraction script**: `scripts/build_lt_area_summary.R`.
- **Retrieval recipe and hashes**: `docs/manifests/lt-census-religion-2001-2021.json` records URLs, retrieval routes, and SHA-256s for every build input.

## Boundaries

- Official boundary files: State Enterprise Centre of Registers Address Register municipality spatial data, formation date 2025-10-21, CC BY 4.0.
- Boundary changes between waves and the harmonisation plan: OSP publishes the same 60 municipality codes for every wave. The common map frame uses the current 2025 polygons. The boundary record assigns formation date 2000-02-02 to five municipalities and 1998-06-01 to the other 55; the product does not treat current polygons as literal historic boundaries. Municipality geometry stability from 2001 through the 2025 boundary frame was not verified: formation dates and shared codes do not prove unchanged boundaries.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): Overpass count did not complete reliably in this sweep.
- Country-specific registers that could seed or verify the layer: Catholic diocesan parish lists, Orthodox and Old Believer parishes, Lutheran/Reformed churches, Jewish community records, cultural heritage register.

## First visualisation

Religious-community-indicated percent by municipality for 2001, 2011, and 2021, with a year selector and no cross-instrument difference layer.

## Build recipe

1. Extract: read OSP SDMX flow `S3R778_GBS010306_1`, select 60 municipality codes and all three waves, and preserve the source categories.
2. Governed product: build `area_summary` per `schemas/area_summary.schema.json`, with 2021 flagged as a sample/model-based estimate.
3. Boundaries: read the official Registers Centre WKT, correct its EPSG:3346 axis order, transform it, and simplify it through the shared boundary helper.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: reconcile municipality totals to OSP national religious-community totals.

## Risks and open questions

- The 2021 religion estimates use a different instrument from the 2001 and 2011 full-enumeration censuses. Change metrics remain withheld across that break.
- Small denomination cells can be confidential or marked as absent. The standard headline uses unsuppressed total, `Nė vienai`, and `Nenurodyta` rows, which reconcile exactly.
- OSP states a source-attribution requirement but does not name an open licence on the pinned table or census pages. The manifest makes no broader licence claim.

## Deep-history potential

Lithuanian Central State Archives, Catholic parish registers, Jewish community and YIVO-related archives, Karaite and Tatar community records, Lutheran/Reformed records, and interwar census volumes.
