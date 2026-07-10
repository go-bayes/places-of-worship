# Country data map: Iceland (IS)

## Status

- **Tier**: A
- **Build state**: Data extracted; national annual membership product built.
- **Last verified**: 2026-07-10

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [Statistics Iceland PX-Web MAN10001](https://px.hagstofa.is/pxen/pxweb/en/Samfelag/Samfelag__menning__5_trufelog__trufelog/MAN10001.px/) | Administrative register membership in religious and life-stance organisations | National | 1998-2026, annually | PX-Web API | Open | [CC BY 4.0](https://statice.is/publications/open-data-access/) |

Statistics Iceland records membership in recognised religious and life-stance organisations in the National Register of Persons. The product reports this register construct. It does not report census affiliation, belief, practice, or attendance. `No religious organisation` and `Other and not specified` keep the source's meanings.

## Access the data yourself

This project publishes derived national counts and shares with attribution. To obtain the source data:

- **Source of record**: Statistics Iceland [PX-Web](https://px.hagstofa.is/pxen/pxweb/en/).
- **Exact table**: `MAN10001.px`, *Populations by religious and life stance organizations 1998-2026*; [English API endpoint](https://px.hagstofa.is/pxen/api/v1/en/Samfelag/menning/5_trufelog/trufelog/MAN10001.px).
- **Licence**: Creative Commons Attribution 4.0 International. Credit Statistics Iceland; do not attribute project-derived changes to Statistics Iceland.
- **Our extraction script**: `scripts/build_is_area_summary.R`.
- **Retrieval recipe and hashes**: `docs/manifests/is-membership-1998-2026.json` records the POST body, URLs, retrieval date, and SHA-256 for every raw input.
- **Probe record**: `research/countries/is/px-probe.md` records the complete variable inventory and the subnational search.

## Boundaries

| Source | Unit | Match note |
| --- | --- | --- |
| [geoBoundaries gbOpen ISL ADM0](https://www.geoboundaries.org/api/current/gbOpen/ISL/ADM0/) | Country | 2020 boundary from Lýsigagnagátt, geoBoundaries release commit `9469f09`, CC BY 4.0. The committed derivative uses the shared simplification helper. |

## Places-of-worship layer

| Source | Role | Note |
| --- | --- | --- |
| [OpenStreetMap](https://www.openstreetmap.org) | Candidate site layer only | OSM coverage was not counted in this source sweep. |

## First visualisation

Administrative register membership share on one national polygon, with an annual selector for 1998-2026. The annual series provides the comparison; the map deliberately does not imply subnational variation.

## Build recipe

1. Run `Rscript scripts/build_is_area_summary.R` from the repository root. The script posts a JSON query to `MAN10001.px` and caches the raw JSON-stat2 response under `data/raw/is_membership/`.
2. The script retains the ten largest organisations by 2026 membership under Statistics Iceland's English labels. It computes `Other organisations` as the annual residual across the remaining named organisation rows. `Other and not specified` and `No religious organisation` remain separate source-named categories in the manifest reconciliation.
3. The area-summary headline membership fields sum all 61 named organisation rows. The legacy no-religion fields carry `No religious organisation` verbatim. `Other and not specified` remains outside both headline fields.
4. The script downloads geoBoundaries ISL ADM0 release `9469f09` and simplifies it through `scripts/lib/simplify_boundary.R`.
5. The script writes `apps/regions/is/data/area_summary_adm0.json`, its CSV companion, `apps/regions/is/data/is_adm0_2020.geojson`, and the tracked manifest.
6. The build stops if annual categories fail exact reconciliation, a year is missing, the geometry is invalid, or a raw input lacks provenance.

## Risks and open questions

- Statistics Iceland revised the population-estimation method in March 2024 and updated 2011 onwards. Comparisons spanning 2010-2011 should carry that source note.
- The table contains many zero organisation-year cells. The build preserves the published zeros, performs no imputation, and retains the source labels in the annual reconciliation.
- The national polygon shows change over time without spatial variation. A municipality, region, or capital-versus-rest membership table would support a later subnational product if Statistics Iceland publishes one.

## Deep-history potential

A separate deep-history source survey has not been completed.
