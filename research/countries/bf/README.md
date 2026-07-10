# Country data map: Burkina Faso (BF)

## Status

- **Tier**: B (official regional route verified; source correction or a release decision is required)
- **Build state**: 2006 regional rows extracted and reconciled; 2006 provincial rows documented but unverified; 2019 blocked by five exact row-reconciliation failures; no map product written
- **Last verified**: 2026-07-10

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| INSD RGPH 1996 Volume I, Table 3 | census affiliation | national | 1996 | PDF | open web | publication reuse rights unresolved |
| INSD RGPH 2006 *État et structure de la population*, Tables A5.4–A5.6 | census affiliation | province | 2006 | PDF | open web | publication reuse rights unresolved |
| INSD RGPH 2019 final-results report, Table 10 | census affiliation | region | 2019 | PDF | open web | publication reuse rights unresolved |

The verified sources do not support a three-wave subnational series. The 1996 religion table is national. The 2006 report publishes exact regional and provincial counts, but this lane transcribed and reconciled only Table A5.5's 13 regional rows and national row. The 45 provincial rows are a documented but unverified route. The 2019 report publishes rounded regional percentages on a collected-person basis, and five rows fail the project’s exact arithmetic gate.

## Access the data yourself

- **Source of record**: [Institut national de la statistique et de la démographie](https://www.insd.bf/).
- **Published table routes**: 1996 Volume I Table 3; 2006 *État et structure de la population* Tables A5.4–A5.6; 2019 final-results Table 10. Only the 2006 Table A5.5 regional and national rows were transcribed and reconciled.
- **Licence**: publication reuse rights remain unresolved. The cached INSD legal page has an all-rights-reserved footer and refers published data users to an external Open Data Agreement that was not captured. The cached 2019 catalogue terms restrict redistribution of microdata and related materials without written INSD agreement; they do not establish terms for the census PDFs or a derived map.
- **Our extraction script**: [`scripts/build_bf_area_summary.R`](../../../scripts/build_bf_area_summary.R), which validates the Poppler extraction of the 2006 regional and national rows and stops at the failed 2019 row gate.
- **Retrieval recipe and hashes**: [`route-probe.md`](route-probe.md) records exact URLs, SHA-256 hashes, denominators, terms, and gate results. Cached inputs remain under git-ignored `data/raw/bf_census/`.

## Boundaries

- Proposed source: [geoBoundaries BFA ADM1 release metadata](https://www.geoboundaries.org/api/current/gbOpen/BFA/ADM1/), 13 regions represented in 2017, sourced from the World Bank under Creative Commons Attribution 4.0.
- The 13-feature source passed non-empty, validity, and distinct-geometry tests. Simplification and the census join were not run after the census gate failed.
- No correspondence is used for 1996. Its verified religion table is national and predates the current 13-region frame.

## Places-of-worship layer

- OpenStreetMap coverage assessment: not run during this census-source probe.
- Country-specific registers: not assessed during this census-source probe.

## First visualisation

Blocked: religious-affiliation percentage and no-religion percentage by 13 regions for 2006 and 2019, with change withheld. The 2019 source needs a corrected or more precise official table, and release requires a rights decision.

## Build recipe

1. Extract the official PDF tables with Poppler `pdftotext -layout` and retain the French category spellings.
2. Require every row’s category sum to equal its printed total exactly; require regional values to reproduce the national values.
3. Disclose the 2019 collected-person denominator and the 2,333,317 residents outside that basis.
4. Join the 13 regions to geoBoundaries ADM1 only after the census gates pass, then simplify through `scripts/lib/simplify_boundary.R` to at most three megabytes.
5. Keep any derived product staged until the INSD redistribution position is resolved.

## Risks and open questions

- Five 2019 rows sum to 99.9 or 100.1 because the source publishes one-decimal category percentages while printing 100.0 as the row total. The project’s exact gate does not permit a rounding tolerance.
- The 2019 religion basis excludes 2,333,317 residents included through population estimates for incompletely enumerated localities.
- The verified record does not establish identical 2006 and 2019 collection and processing rules. Cross-wave change remains withheld.
- No cached licence text establishes reuse terms for the census publications.

## Deep-history potential

Not surveyed during this route probe.
