# Country data map: Thailand (TH)

## Status

- **Tier**: B
- **Build state**: Surveyed; NSO religion tables exist for 2010 and sample/pilot years, but the 2020-2024 comparable route is incomplete.
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [National Statistical Office statistical database](http://statbbi.nso.go.th/) | Census religion by person | Province in 2010 tables | 2010 | Web/PDF/XLS depending on table | Open web | Government statistics; confirm reuse terms before republication |
| [National Statistical Office Thailand](https://www.nso.go.th/) | Population and housing census/pilot products | Region/province where released | 2015 and 2018 pilot/sample products; 2020-2024 route not confirmed | Web/PDF | Open web | Government statistics; confirm reuse terms before republication |

## Boundaries

| Source | Unit | Match note |
| --- | --- | --- |
| [geoBoundaries THA ADM1](https://www.geoboundaries.org/api/current/gbOpen/THA/ADM1/) | Province | Province-level matching should be stable, with attention to any post-2010 boundary changes. |

## Places-of-worship layer

| Source | Role | Note |
| --- | --- | --- |
| [OpenStreetMap](https://www.openstreetmap.org) | Candidate site layer | OSM coverage was not counted in this source sweep. Mosque and temple tagging should be assessed separately in the southern border provinces. |

## First visualisation

Map 2010 province shares by religion and annotate southern-border provinces separately because sensitivity and category interpretation differ.

## Build recipe

Start with the NSO 2010 table `Population by religion, sex and administrative division` and geoBoundaries THA ADM1. Add pilot/sample years only after their sample design and geography are documented.

## Risks and open questions

Religion maps are sensitive in the southern border provinces and around local Muslim, Christian, and highland-minority communities. The main open question is whether any 2020-2024 public release provides comparable subnational religion data.

## Deep-history potential

Medium. National Statistical Office census volumes, National Archives of Thailand holdings, Sangha temple registers, Department of Religious Affairs records, mosque registers, and provincial gazetteers can support deeper histories.
