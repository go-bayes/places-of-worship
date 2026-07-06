# Country data map: Spain (ES)

## Status

- **Tier**: B
- **Build state**: Surveyed; CIS survey microdata can support regional estimates, but there is no census religion series.
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [CIS study catalogue and data bank](https://www.cis.es/) | Survey affiliation and practice | Autonomous community in macrobarometers | 2012 and 2019 regional macrobarometers; monthly national series current | Microdata/SPSS/CSV | Open web | CIS terms |
| [INE census portal](https://www.ine.es/) | No census affiliation table | None | Current census rounds absent for religion | Web | Open web | INE terms |

## Boundaries

| Source | Unit | Match note |
| --- | --- | --- |
| [Instituto Geografico Nacional administrative boundaries](https://www.ign.es/) | Autonomous community, province, municipality | Use autonomous communities for the first survey map. |

## Places-of-worship layer

| Source | Role | Note |
| --- | --- | --- |
| [OpenStreetMap](https://www.openstreetmap.org) | Candidate site layer | OSM coverage was not counted in this source sweep. First build should assess Catholic parish saturation and non-Catholic under-tagging. |

## First visualisation

Map autonomous-community religious self-identification from the 2019 CIS macrobarometer, with the 2012 macrobarometer as the comparison wave if categories align.

## Build recipe

Extract CIS microdata for the 2019 macrobarometer, compute weighted autonomous-community estimates, and join to IGN autonomous-community boundaries. Keep the product labelled as survey affiliation.

## Risks and open questions

CIS estimates are survey results. They are not census counts. Monthly national barometers cannot support a subnational map without pooled microdata and uncertainty estimates.

## Deep-history potential

High. Diocesan archives, parish registers, municipal archives, Jewish and Muslim historical records, heritage inventories, PARES, local histories, and historic cadastral maps can support deeper site histories.
