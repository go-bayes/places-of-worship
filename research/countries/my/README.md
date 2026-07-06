# Country data map: Malaysia (MY)

## Status

- **Tier**: B
- **Build state**: Surveyed; decennial religion tables are public, but district-level extraction and category harmonisation remain.
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [Malaysia Census 2020 portal](https://www.mycensus.gov.my/) | Census religion by person | Administrative district route in census publications | 2020 | Web/PDF | Open web | Government statistics; confirm reuse terms before republication |
| [Department of Statistics Malaysia](https://www.dosm.gov.my/) | Decennial census demographic characteristics, including religion | Administrative district where released | 1970, 1980, 1991, 2000, 2010, 2020 | PDF/web tables | Open web | Government statistics; confirm reuse terms before republication |

## Boundaries

| Source | Unit | Match note |
| --- | --- | --- |
| [geoBoundaries MYS ADM2](https://www.geoboundaries.org/api/current/gbOpen/MYS/ADM2/) | District | District naming and federal-territory treatment need reconciliation across census years. |

## Places-of-worship layer

| Source | Role | Note |
| --- | --- | --- |
| [OpenStreetMap](https://www.openstreetmap.org) | Candidate site layer | OSM coverage was not counted in this source sweep. First build should compare mosque, surau, temple, church, gurdwara, and shrine tagging. |

## First visualisation

Map 2020 district shares once the administrative-district table is extracted, with state-level fallbacks where district detail is unavailable.

## Build recipe

Start with the Census 2020 administrative-district religion table and geoBoundaries MYS ADM2. Add 2010 and earlier waves after district-code crosswalks and category labels are documented.

## Risks and open questions

Religion in Malaysia is legally and politically sensitive because affiliation intersects with Malay identity, conversion, and apostasy rules. Public maps should suppress small cells and avoid inferring individual identity from local majorities.

## Deep-history potential

High. Straits Settlements and Federated Malay States census volumes, National Archives of Malaysia holdings, JAKIM and state Islamic department mosque registers, Registrar of Societies records, church directories, and temple-trust records can support deeper histories.
