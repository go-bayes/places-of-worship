# Country data map: Saint Lucia (LC)

## Status

- **Tier**: B (official district route verified; corrected or unrounded tables are required)
- **Build state**: 2001, 2010, and 2022 district routes extracted; blocked by exact reconciliation failures; no map product written
- **Last verified**: 2026-07-10

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| CSO Population and Housing Census reports and REDATAM databases | census affiliation | district | 2001, 2010, 2022 | REDATAM weighted counts and PDF table | open web | CSO Open Licence Agreement |

The official record supports district religion for all three waves. The 2001 and 2010 reports publish religion nationally, while the CSO REDATAM databases provide the district counts. The 2022 Provisional Results report publishes Table D.2 by ten districts. No wave can yet enter a governed product. Local rows and local-to-national sums fail exact reconciliation in 2001 and 2010, and Table D.2 itself fails exact column and category reconciliation in 2022.

## Access the data yourself

This project has not redistributed the census table or produced a map product because a hard validation gate failed.

- **Source of record**: [Central Statistical Office of Saint Lucia census results](https://stats.gov.lc/census/census-results/) and [publications](https://stats.gov.lc/publications/).
- **Exact tables**: 2001 and 2010 REDATAM religion outputs on the 12-part district frame; 2022 Population and Housing Census Provisional Results, Release 1, Table D.2, “Population: Religion by District”.
- **Licence**: CSO information is licensed under the [CSO Open Licence Agreement](https://stats.gov.lc/terms-and-conditions/open-licence-agreement/), which permits derivative and value-added products with its required acknowledgement.
- **Our extraction script**: [`scripts/build_lc_area_summary.R`](../../../scripts/build_lc_area_summary.R), which verifies the captured tables and stops at the first exact reconciliation failure.
- **Retrieval recipe and hashes**: [`route-probe.md`](route-probe.md) records the POST selectors, static URLs, SHA-256 hashes, category frames, denominators, terms, and gate results. Cached inputs remain under git-ignored `data/raw/lc_census/`.

## Boundaries

- Proposed source: [geoBoundaries LCA ADM1 release metadata](https://www.geoboundaries.org/api/current/gbOpen/LCA/ADM1/), ten districts represented in 2015, sourced from Wikimedia Commons under CC0 1.0 Universal.
- The ten-feature source passed non-empty, validity, and distinct-geometry tests. Simplification and the census join were not run after the census gate failed.
- The historical 12-part frame aggregates cleanly to ten districts by summing Castries Metropolitan, Castries City, and Castries Rural.

## Places-of-worship layer

- OpenStreetMap coverage assessment: not run during this census-source probe.
- Country-specific registers: not assessed during this census-source probe.

## First visualisation

Blocked: census religious-affiliation percentage and no-religion percentage by ten districts for 2001, 2010, and 2022. Cross-wave change would remain withheld because the category frames are not identical.

## Build recipe

1. Extract the exact weighted 2001 and 2010 REDATAM tables and the 2022 Table D.2 count matrix.
2. Require every local category row to equal its printed total and require local values to reproduce every national value exactly.
3. Disclose non-response and every population outside each table's basis, including the 2010 missing records and institutional population and the 2022 institutional population.
4. Join the ten districts to geoBoundaries ADM1 only after every census gate passes, then simplify through `scripts/lib/simplify_boundary.R` to at most three megabytes.
5. Apply the CSO Open Licence Agreement's value-added-product acknowledgement to every shipped surface.

## Risks and open questions

- Weighted integer cells fail exact reconciliation in every wave. The discrepancies are consistent with independent cell rounding, but the captured outputs do not document the rounding algorithm, and the discrepancy figures rest on the extracted text layer alone: they have not been verified against rendered page images, which is the required next step (Côte d'Ivoire precedent). The project does not apply an arbitrary tolerance or allocate residual people.
- The 2022 report remains Provisional Results, Release 1. The current CSO publications page does not list a superseding final report.
- The category frames change, especially the split between atheism and belief without religion in 2022. The changing category frames do not support cross-wave change metrics.
- The 2001 REDATAM religion total is 98 above the final report's enumerated resident population; the captured sources do not explain the difference.

## Deep-history potential

Not surveyed during this route probe.
