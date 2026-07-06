# Country data map: Nepal (NP)

## Status

- **Tier**: B
- **Build state**: Surveyed; 2021 religion reporting is public, while the district table route and machine extraction need confirmation.
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [National Statistics Office census results portal](https://censusnepal.cbs.gov.np/) | Census religion by person | District/province route reported in census products; exact downloadable district table still needs extraction | 2021 | Web/PDF | Open web | Government census data; confirm reuse terms before republication |
| [National Statistics Office Nepal](https://nsonepal.gov.np/) | Historical census reports | District where report tables are released | 2011, 2021; older religion series require report recovery | PDF/web | Open web | Government census data; confirm reuse terms before republication |

## Boundaries

| Source | Unit | Match note |
| --- | --- | --- |
| [geoBoundaries NPL ADM2](https://www.geoboundaries.org/api/current/gbOpen/NPL/ADM2/) | District | Province and district restructuring must be handled before comparing 2011 and 2021. |

## Places-of-worship layer

| Source | Role | Note |
| --- | --- | --- |
| [OpenStreetMap](https://www.openstreetmap.org) | Candidate site layer | OSM coverage was not counted in this source sweep. First build should assess under-tagging of shrines, monasteries, and small local temples. |

## First visualisation

Map 2021 district or province shares for census religion once the public table is extracted.

## Build recipe

Start with the 2021 National Population and Housing Census religion report table and geoBoundaries NPL ADM2. Build a 2011 crosswalk only after the district geography is reconciled across the federal restructuring.

## Risks and open questions

Religion and caste/ethnicity categories are politically sensitive in Nepal, especially where small Buddhist, Muslim, Kirat, Christian, and local-tradition populations are mapped. The 2021 table URL and the smallest downloadable geography need a second verification pass before a build.

## Deep-history potential

Medium. National Archives of Nepal holdings, historical census reports, guthi and temple-trust records, monastery records, and district gazetteers can support deeper site histories.
