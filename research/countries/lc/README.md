# Country data map: Saint Lucia (LC)

## Status

- **Tier**: B (official district route verified; shipped as published with source-arithmetic disclosure)
- **Build state**: 2001, 2010, and 2022 district products shipped to staging under the PI ship ruling of 2026-07-10; source-arithmetic discrepancies disclosed per row and at product level; no repair applied
- **Last verified**: 2026-07-10

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| CSO Population and Housing Census reports and REDATAM databases | census affiliation | district | 2001, 2010, 2022 | REDATAM weighted counts and PDF table | open web | CSO Open Licence Agreement |

The official record supports district religion for all three waves. The 2001 and 2010 reports publish religion nationally, while the CSO REDATAM databases provide the district counts. The 2022 Provisional Results report publishes Table D.2 by ten districts. All three waves now ship as a governed ten-district product under the PI ship ruling of 2026-07-10. The source's own category cells do not always sum to its printed totals: local rows differ from printed totals in 2001 and 2010, and nine of the 2022 district columns differ from their category sums. The published values ship unchanged, and each overrun is disclosed per row and at product level.

## Access the data yourself

This project ships a derived ten-district product under the CSO Open Licence Agreement with its required acknowledgement. The shipped surface discloses the source's own category-versus-total discrepancies; the published values are not adjusted.

- **Source of record**: [Central Statistical Office of Saint Lucia census results](https://stats.gov.lc/census/census-results/) and [publications](https://stats.gov.lc/publications/).
- **Exact tables**: 2001 and 2010 REDATAM religion outputs on the 12-part district frame; 2022 Population and Housing Census Provisional Results, Release 1, Table D.2, “Population: Religion by District”.
- **Licence**: CSO information is licensed under the [CSO Open Licence Agreement](https://stats.gov.lc/terms-and-conditions/open-licence-agreement/), which permits derivative and value-added products with its required acknowledgement. The required notice is carried verbatim in the manifest and product.
- **Shipped product**: `apps/regions/lc/data/area_summary_district.{json,csv}` on ten districts across 2001, 2010, and 2022, with `apps/regions/lc/data/lc_district_2015.geojson` and the manifest `docs/manifests/lc-census-religion-2001-2022.json`.
- **Our build script**: [`scripts/build_lc_area_summary.R`](../../../scripts/build_lc_area_summary.R), which ships the published values with disclosure, applies no repair, and hard-stops only on source drift or a geometry, distinctness, or licence gate failure.
- **Retrieval recipe and hashes**: [`route-probe.md`](route-probe.md) records the POST selectors, static URLs, SHA-256 hashes, category frames, denominators, terms, gate results, and the PI ship ruling. Cached inputs remain under git-ignored `data/raw/lc_census/`.

## Boundaries

- Source: [geoBoundaries LCA ADM1 release metadata](https://www.geoboundaries.org/api/current/gbOpen/LCA/ADM1/), ten districts represented in 2015, sourced from Wikimedia Commons under CC0 1.0 Universal.
- The ten-feature source passed non-empty, validity, and distinct-geometry tests. The census join and simplification now run: the shipped `lc_district_2015.geojson` is 134,234 bytes at full keep, with ten valid distinct features.
- The historical 12-part frame aggregates cleanly to ten districts by summing Castries Metropolitan, Castries City, and Castries Rural.

## Places-of-worship layer

- OpenStreetMap coverage assessment: not run during this census-source probe.
- Country-specific registers: not assessed during this census-source probe.

## First visualisation

Shipped: census religious-affiliation percentage and no-religion percentage by ten districts for 2001, 2010, and 2022, each against a stated-response denominator. Cross-wave change remains withheld because the category frames are not identical.

## Build recipe

1. Extract the weighted 2001 and 2010 REDATAM tables and the 2022 Table D.2 count matrix.
2. Pin the documented source-arithmetic discrepancy pattern for each wave and hard-stop on any drift; ship the published category cells and printed totals unchanged, recording each overrun per row and at product level.
3. Disclose non-response and every population outside each table's basis, including the 2010 missing records and residents outside private households and the 2022 institutional population.
4. Join the ten districts to geoBoundaries ADM1, then simplify through `scripts/lib/simplify_boundary.R` to at most three megabytes, re-running the validity and distinct-hash gates.
5. Apply the CSO Open Licence Agreement's value-added-product acknowledgement to every shipped surface.

## Risks and open questions

- Weighted integer cells do not always reconcile to their printed totals in any wave. The 2022 pattern was confirmed against rendered page images ([reconciliation-verification.md](reconciliation-verification.md)); the 2001 and 2010 figures rest on the captured REDATAM outputs and were not image-verified. The product ships the published values unchanged and discloses each overrun; it applies no tolerance and allocates no residual people.
- The 2022 report remains Provisional Results, Release 1. The current CSO publications page does not list a superseding final report; the provisional status is disclosed on the shipped surface.
- The category frames change, especially the split between atheism and belief without religion in 2022. The changing category frames do not support cross-wave change metrics, which are withheld.
- The 2001 REDATAM religion total is 98 above the final report's enumerated resident population; the captured sources do not explain the difference, which is disclosed on the shipped surface.

## Deep-history potential

Not surveyed during this route probe.
