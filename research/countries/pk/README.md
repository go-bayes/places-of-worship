# Country data map: Pakistan (PK)

## Status

- **Tier**: B
- **Build state**: Surveyed; 2023 and 2017 religion tables are public, but exact downloadable table files and sensitive-area handling need verification before build.
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [Pakistan 2023 census dashboard](https://census23.pbos.gov.pk/) | Census population products with district-level drill-down; religion table released in detailed results | District | 2023 | Dashboard/PDF tables | Open web | Government statistics; confirm reuse terms before republication |
| [Pakistan Bureau of Statistics](https://www.pbs.gov.pk/) | Census detailed results, including population by sex, religion, and rural/urban | District | 1998, 2017, 2023; older series through colonial census volumes | PDF/XLS where released | Open web | Government statistics; confirm reuse terms before republication |

## Boundaries

| Source | Unit | Match note |
| --- | --- | --- |
| [geoBoundaries PAK ADM2](https://www.geoboundaries.org/api/current/gbOpen/PAK/ADM2/) | District | Use census-year district boundaries; flag newly merged or reorganised areas separately. |

## Places-of-worship layer

| Source | Role | Note |
| --- | --- | --- |
| [OpenStreetMap](https://www.openstreetmap.org) | Candidate site layer | OSM coverage was not counted in this source sweep. First build should assess mosque over-representation and minority-site under-tagging. |

## First visualisation

Map 2023 district shares only after the detailed religion table file, excluded areas, and category labels are verified.

## Build recipe

Start with the 2023 detailed-results `Table 9: Population by sex, religion and rural/urban` and geoBoundaries PAK ADM2. Add 2017 and 1998 after resolving district changes and category differences.

## Risks and open questions

Religion data in Pakistan are highly sensitive for Ahmadiyya, Hindu, Christian, Sikh, and other minority communities. Public products should suppress small cells, avoid site-level minority inference, and record areas where religion detail is withheld.

## Deep-history potential

High. British India census volumes, Pakistan Bureau of Statistics historical census reports, Punjab/Sindh/Khyber Pakhtunkhwa/Balochistan archives, Auqaf department records, church registers, and shrine records can support deeper histories.
