# Country data map: Estonia (EE)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [Statistics Estonia RL21454](https://andmed.stat.ee/en/stat/rahvaloendus__rel2021__rahvastiku-demograafilised-ja-etno-kultuurilised-naitajad__usk/RL21454) | census religious affiliation, age 15+ | settlement region | 2021 | PxWeb/API/export | open | CC BY-SA 4.0 |
| [Statistics Estonia RL0451](https://andmed.stat.ee/en/stat/rahvaloendus__rel2011__rahvastiku-demograafilised-ja-etno-kultuurilised-naitajad__usk/RL0451) | census religious affiliation, age 15+ | city/rural municipality categories | 2011 | PxWeb/API/export | open | CC BY-SA 4.0 |
| [Statistics Estonia RL229](https://andmed.stat.ee/en/stat/rahvaloendus__rel2000__rahvastiku-demograafilised-ja-etno-kultuurilised-naitajad__usk/RL229) | census religious affiliation, age 15+ | public table level to confirm | 2000 | PxWeb/API/export | open | CC BY-SA 4.0 |

## Boundaries

- Official boundary files: Estonian Land Board/statistical boundaries; GISCO LAU can support municipality joins.
- Boundary changes between waves and the harmonisation plan: do not force 2011 city/rural categories into 2021 settlement-region geography without a concordance.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): Overpass count did not complete reliably in this sweep.
- Country-specific registers that could seed or verify the layer: Estonian Council of Churches, Lutheran and Orthodox parish lists, Old Believer communities, heritage register.

## First visualisation

2021 religious-affiliation profile for age 15+ by settlement region, with earlier waves shown only after geography harmonisation.

## Build recipe

1. Extract: Statistics Estonia RL21454 through PxWeb for all settlement regions and religion categories.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`, with age universe recorded.
3. Boundaries: Statistics Estonia/Land Board settlement-region geography or a documented aggregation from municipalities.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: reconcile table totals to Statistics Estonia national religion totals for age 15+.

## Risks and open questions

- The 2021 table is generalisable to people aged 15 and over rather than the full population.
- The public geography differs across 2000, 2011, and 2021.
- Rounding is documented by Statistics Estonia.

## Deep-history potential

Lutheran parish registers, Orthodox and Old Believer records, Estonian National Archives, Jewish community archives, Swedish/German Baltic church records, and interwar census volumes.
