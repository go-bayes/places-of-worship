# Country data map: Serbia (RS)

## Status

- **Tier**: A (buildable now)
- **Build state**: data extracted
- **Last verified**: 2026-07-10

## Shipped product

The Serbia product reports census religious affiliation for 2002, 2011, and 2022 across 25 published statistical areas: the City of Belgrade plus 24 districts (okruzi). The Statistical Office of the Republic of Serbia (SORS) publishes municipality and city rows for all three waves, but those units do not form a stable three-wave geography. The build therefore uses this common area level and creates no unofficial municipal concordance.

The headline affiliation percentage uses the total census population as its denominator. In 2011 and 2022, the build counts the published Christian parent once and adds Islam, Judaism, Eastern religions, and other religions. Agnostics and atheists form the no-religion headline. Did-not-declare and unknown responses remain in the population denominator. In 2002, the separate “Believer, but does not belong to any religion” category remains outside both headlines because it reports belief without religious affiliation.

## Territorial coverage

This product follows the territorial coverage published by the Statistical Office of the Republic of Serbia (SORS). The 2002 publication covers Central Serbia and Vojvodina and states that the census was not conducted in the Autonomous Province of Kosovo and Metohija. The 2011 and 2022 dissemination tables identify their coverage as excluding data for the Autonomous Province of Kosovo and Metohija. Kosovo rows from other publications are outside this Serbia product.

## Religious data over time

| Source | Construct | Finest published geography | Years | Format | Access | Reuse position |
| --- | --- | --- | --- | --- | --- | --- |
| [SORS dissemination table `3104020301`](https://data.stat.gov.rs/Home/Result/3104020301?languageCode=en-US) | census religious affiliation | municipality/city | 2022 | web table and selected POST export | open web | source quotation; broader terms unverified |
| [SORS dissemination table `3102010402`](https://data.stat.gov.rs/Home/Result/3102010402?languageCode=en-US) | census religious affiliation | municipality/city | 2011 | web table and selected POST export | open web | source quotation; broader terms unverified |
| [SORS 2002 publication G20024003](https://publikacije.stat.gov.rs/G2002/PdfE/G20024003.pdf) | census religious affiliation | municipality | 2002 | portable document format (PDF) | open web | source quotation required |
| [Eurostat Geographic Information System of the Commission (GISCO), Nomenclature of Territorial Units for Statistics (NUTS) 3 2021](https://gisco-services.ec.europa.eu/distribution/v2/nuts/geojson/NUTS_RG_01M_2021_4326_LEVL_3.geojson) | statistical-area geometry | area | 2021 | GeoJSON | open download | GISCO provisions; Eurostat GISCO and EuroGeographics attribution |

## Access the data yourself

- **2022 table**: open [table `3104020301`](https://data.stat.gov.rs/Home/Result/3104020301?languageCode=en-US), select total gender, the 25 area codes plus the national row, and all 14 religion categories.
- **2011 table**: open [table `3102010402`](https://data.stat.gov.rs/Home/Result/3102010402?languageCode=en-US), select total gender, the 25 area codes plus the national row, and all 14 religion categories.
- **2002 table**: download [publication G20024003](https://publikacije.stat.gov.rs/G2002/PdfE/G20024003.pdf) and use table 1, “Population by religion”.
- **Exact machine selections**: see [route-probe.md](route-probe.md), which records the POST selectors and category codes.
- **Build command**: run `Rscript scripts/build_rs_area_summary.R` from the repository root.
- **Raw cache**: downloads and SHA-256 sidecars are written under `data/raw/rs_census/`, which remains git-ignored.
- **Public outputs**: the build writes `apps/regions/rs/data/area_summary_area.json`, `apps/regions/rs/data/area_summary_area.csv`, `apps/regions/rs/data/rs_area_2021.geojson`, and `docs/manifests/rs-census-religion-2002-2022.json`.

## Boundaries

The product ships 25 area rows per wave, comprising the City of Belgrade plus 24 districts (okruzi), on the 2021 GISCO NUTS 3 display frame. The [2002 census volume](https://publikacije.stat.gov.rs/G2002/PdfE/G20024003.pdf) reports the administrative-territorial state at 1 January 2002. The later SORS area trees in the [2011 table](https://data.stat.gov.rs/Home/Result/3102010402?languageCode=en-US) and [2022 table](https://data.stat.gov.rs/Home/Result/3104020301?languageCode=en-US) document the later hierarchy. Those later trees add Surčin and several city or city-municipality hierarchies that do not match the 2002 municipality presentation. The pinned SORS routes provide no religion table rebased to one municipal frame, and the probe did not pin a complete set of official per-vintage municipality polygons. A municipality panel would therefore require either an unofficial concordance or unsupported boundary substitution.

Geometric stability of the 25 published areas across 2002, 2011, and 2022 was not verified. The build joins shared statistical-area codes to the 2021 GISCO layer and makes no claim that every boundary segment was unchanged.

## Category and response handling

The 2002 publication contains 12 rows including total. The 2011 and 2022 tables each contain 14 rows including total. The modern Christian total is a parent category; Orthodox, Catholic, Protestant, and Other Christian are detail rows and are never summed again.

The product preserves every source category. The 2002 mapping uses the labels in the official English publication. The 2011 and 2022 mappings retain Serbian Cyrillic source labels and add the official English dissemination labels. The manifest records every mapping and product role.

## Places-of-worship layer

- **OpenStreetMap coverage assessment (2026-07-07)**: the Overpass count did not complete reliably during the expansion survey.
- **Country-specific registers that could seed or verify the layer**: Serbian Orthodox eparchy directories, Islamic Community records, Catholic dioceses, Protestant church registers, and Jewish community records.

## First visualisation

Religious-affiliation percentage for the City of Belgrade and 24 districts (okruzi) in the 2002, 2011, and 2022 censuses, displayed on the 2021 GISCO NUTS 3 frame with the boundary-stability and territorial-coverage notes shown alongside the layer.

## Build recipe

1. Extract the national row and the 25 area rows, comprising the City of Belgrade plus 24 districts (okruzi), from the 2002 publication and the two pinned dissemination tables with `scripts/build_rs_area_summary.R`.
2. Write the governed `area_summary` JSON and CSV products with the tracked manifest `docs/manifests/rs-census-religion-2002-2022.json`.
3. Filter the GISCO NUTS 3 2021 GeoJSON to the 25 SORS codes, calculate areas in EPSG:3035, and simplify the layer through `scripts/lib/simplify_boundary.R`.
4. Defer the region page and shared-runtime wiring; the present lane excludes `apps/regions/rs/index.html`.
5. Require exact category reconciliation, complete wave coverage, valid distinct geometry, source hashes, and the shipped territorial-scope disclosure.

## Build-gate results

- **Wave coverage**: passed. The product contains 25 rows for each of 2002, 2011, and 2022.
- **Reconciliation**: passed. Every mutually exclusive category sum equals its published area total, and every category sums exactly from the 25 areas to the published national row.
- **Geography**: passed with an explicit limitation. The common area level comprises the City of Belgrade plus 24 districts (okruzi); the build creates no municipal concordance.
- **Geometry**: passed. The simplified GeoJSON contains 25 non-empty, valid features with 25 distinct SHA-256 geometry hashes.
- **Boundary stability**: passed with an unverified disclosure. The product does not claim unchanged geometry across waves.
- **Provenance**: passed. The manifest records URL, retrieval date, byte size, and SHA-256 for every cached source and generated output.
- **Reuse terms**: passed with `needs_review` status. The publications require source quotation, and the product makes no broader reuse claim for the historical census or dissemination files.

## Risks and open questions

A municipality or city product remains possible as a separate per-vintage geography release if official boundary files can be pinned for each wave. Such a release must preserve each source hierarchy, avoid double-counting parent cities and city municipalities, and keep every wave on its own official polygons unless SORS publishes an official rebasing.

The current area product retains two open limitations. First, geometric stability across the 2002, 2011, and 2022 area boundaries remains unverified. Second, broader reuse terms for the historical census and dissemination files remain under review.

## Deep-history potential

Not yet surveyed.
