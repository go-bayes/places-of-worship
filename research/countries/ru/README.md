# Country data map: Russia (RU)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [Rosstat census portal](https://rosstat.gov.ru/vpn_popul) | census population; no religion question | not applicable for religion | 2002, 2010, 2021 | web/XLS/PDF | open | Rosstat terms |
| [Ministry of Justice registered religious organisations](https://minjust.gov.ru/) | registered religious organisations | region/organisation if extracted from registers | current and historical snapshots to assemble | web/register/PDF | open/partly structured | Ministry terms |
| [ARENA atlas / survey sources](https://sreda.org/arena) | survey religious identity | federal subject | 2012 and related survey waves | web/PDF | open for reports | project terms |

## Boundaries

- Official boundary files: Rosstat/federal subject boundaries; geoBoundaries ADM1 is a fallback.
- Boundary changes between waves and the harmonisation plan: anchor any survey or organisation product on federal subjects for a named year; Crimea and occupied Ukrainian territories need explicit exclusion rules.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): Overpass count did not complete; Russia is too large for an ad hoc country-wide query without a tuned extract.
- Country-specific registers that could seed or verify the layer: Ministry of Justice religious organisations, Russian Orthodox diocesan directories, Muslim spiritual boards, Buddhist, Jewish, Catholic, and Protestant registers.

## First visualisation

Registered religious organisations by federal subject and tradition, labelled as organisation presence; ARENA survey identity can be a separate layer if licensed.

## Build recipe

1. Extract: Ministry of Justice religious-organisation register snapshots by federal subject and religious organisation.
2. Governed product: organisation-density `area_summary`; survey identity must be a separate construct.
3. Boundaries: federal subject polygons for a named year, excluding contested territories unless separately approved.
4. Region page: defer until source licensing and coverage are documented.
5. Verification: reconcile organisation counts to ministry totals and source-date snapshots.

## Risks and open questions

- Russian censuses do not ask religion.
- Survey estimates and organisation registrations do not measure the same construct.
- Current territorial claims and sanctions context require careful source and boundary notes.

## Deep-history potential

Russian State Historical Archive, diocesan records, Muslim spiritual-board archives, Buddhist datsan records, Jewish community archives, imperial census materials, Soviet religious-affairs files, and regional archives.
