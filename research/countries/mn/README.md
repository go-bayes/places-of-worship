# Country data map: Mongolia (MN)

## Status

- **Tier**: B
- **Build state**: Surveyed; 2010 and 2020 census religion data are public, while aimag-level extraction needs source-table verification.
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [National Statistics Office 1212 portal](https://www.1212.mn/en) | Census religion by person, usually for population aged 15 and over | Aimag/UB district route in census products; exact table needs extraction | 2010, 2020 | Web/PDF/statistical tables | Open web | Government statistics; confirm reuse terms before republication |
| [National Statistics Office of Mongolia](https://en.nso.mn/) | Census reports and releases | Aimag route where released | 2010, 2020; no separate 2020-2024 round beyond 2020 census | Web/PDF | Open web | Government statistics; confirm reuse terms before republication |

## Boundaries

| Source | Unit | Match note |
| --- | --- | --- |
| [geoBoundaries MNG ADM1](https://www.geoboundaries.org/api/current/gbOpen/MNG/ADM1/) | Aimag and Ulaanbaatar | Add lower geography only if official aimag or district religion tables are verified. |

## Places-of-worship layer

| Source | Role | Note |
| --- | --- | --- |
| [OpenStreetMap](https://www.openstreetmap.org) | Candidate site layer | OSM coverage was not counted in this source sweep. Monastery and mosque tagging should be assessed outside Ulaanbaatar. |

## First visualisation

Map 2020 aimag shares for the census religion categories once the subnational table is extracted.

## Build recipe

Start with the 2020 Population and Housing Census religion table and geoBoundaries MNG ADM1. Add 2010 after confirming age denominator and category equivalence.

## Risks and open questions

The denominator for religion may be restricted to older ages, which must be shown in every map title and legend. Small Muslim, Christian, shamanist, and other communities require suppression rules in sparsely populated aimags.

## Deep-history potential

Medium. National Statistics Office census reports, National Archives of Mongolia holdings, Buddhist monastery records, socialist-era religious-policy records, Islamic community records in Bayan-Olgii, and local gazetteers can support deeper histories.
