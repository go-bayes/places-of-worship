# Country data map: Sri Lanka (LK)

## Status

- **Tier**: B
- **Build state**: Surveyed; multi-wave district religion data exist, with most work in PDF/report extraction and boundary reconciliation.
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [Department of Census and Statistics census publications](https://www.statistics.gov.lk/) | Census religion by person | District; some later releases report Divisional Secretariat Division | 1981, 2001, 2012; 2024 preliminary products emerging | PDF/web tables | Open web | Government statistics; confirm reuse terms before republication |
| [2024 Census preliminary report](https://www.statistics.gov.lk/Resource/en/Population/CPH_2024/Population_Preliminary_Report.pdf) | Census population products; religion tables may be released separately | Divisional Secretariat Division route in 2024 reporting | 2024 round | PDF | Open download | Government statistics; confirm reuse terms before republication |

## Boundaries

| Source | Unit | Match note |
| --- | --- | --- |
| [geoBoundaries LKA ADM2](https://www.geoboundaries.org/api/current/gbOpen/LKA/ADM2/) | District | Use district-level maps first; add Divisional Secretariat Division only with an official or validated boundary layer. |

## Places-of-worship layer

| Source | Role | Note |
| --- | --- | --- |
| [OpenStreetMap](https://www.openstreetmap.org) | Candidate site layer | OSM coverage was not counted in this source sweep. First build should compare temple, church, mosque, and kovil tagging by district. |

## First visualisation

Map district shares for 2012 census religion, with 1981 and 2001 as later longitudinal layers after district harmonisation.

## Build recipe

Start with the 2012 Department of Census and Statistics table `A4: Population by district, religion and sex` and geoBoundaries LKA ADM2. Extract earlier waves from statistical abstracts or census reports.

## Risks and open questions

Religion data in Sri Lanka intersect with ethnicity, civil-war history, and local minority safety. Public maps should avoid small-cell disclosure, especially in mixed districts and post-war resettlement contexts.

## Deep-history potential

High. Department of Census and Statistics census volumes from 1871 onward, National Archives of Sri Lanka holdings, colonial Blue Books, diocesan records, temple and mosque registers, and district gazetteers can support long-run histories.
