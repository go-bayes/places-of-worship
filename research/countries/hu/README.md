# Country data map: Hungary (HU)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [Hungarian Central Statistical Office Census 2022 database](https://nepszamlalas2022.ksh.hu/en/database/) | census affiliation | settlement in the interactive database | 2022 | web app with XLSX/CSV/JSON export | open | HCSO terms |
| [HCSO published census religion tables](https://www.ksh.hu/nepszamlalas2022) | census affiliation | national and territorial tables | 2001, 2011, 2022; national series farther back | web/XLSX/PDF | open | HCSO terms |

## Boundaries

- Official boundary files: HCSO Detailed Gazetteer and national geodata; Eurostat GISCO LAU can support settlement joins.
- Boundary changes between waves and the harmonisation plan: anchor on 2022 settlements and use HCSO settlement identifiers for 2001 and 2011 harmonisation.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): Overpass count did not complete reliably in this sweep.
- Country-specific registers that could seed or verify the layer: Catholic, Reformed, Lutheran, Jewish, and Muslim community directories; HCSO settlement gazetteer.

## First visualisation

Religion or no-religion affiliation by settlement, 2001, 2011, and 2022, once the HCSO database export route is scripted.

## Build recipe

1. Extract: HCSO Census 2022 database current-table export for religion by settlement; repeat for 2001 and 2011 if the app exposes the same dimensions.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`.
3. Boundaries: GISCO LAU or official Hungarian settlement boundaries joined by HCSO settlement code.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: reconcile settlement totals to HCSO national religion totals for 2001, 2011, and 2022.

## Risks and open questions

- The public app is verified, but a stable API endpoint still needs exposure.
- Non-response rose sharply by 2022 and must remain an explicit category.
- Settlement boundary changes require identifier-based joins.

## Deep-history potential

Hungarian Central Statistical Office historical census volumes, Catholic schematisms, Reformed and Lutheran parish archives, Jewish community records, and county archives.
