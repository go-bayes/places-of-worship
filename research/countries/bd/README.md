# Country data map: Bangladesh (BD)

## Status

- **Tier**: B
- **Build state**: Surveyed; 2022 and earlier census religion figures are public, while subdistrict extraction and source-file recovery need work.
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [Bangladesh Bureau of Statistics portal](https://bbs.gov.bd/) | Census religion by person | District; upazila/union route in detailed reports | 2022 | PDF/web | Open web | Government statistics; confirm reuse terms before republication |
| [BBS portal mirror](https://bbs.portal.gov.bd/) | Historical census and district reports | District/upazila/union where released | 1981, 1991, 2001, 2011, 2022; older Bengal series in archives | PDF/web | Open web | Government statistics; confirm reuse terms before republication |

## Boundaries

| Source | Unit | Match note |
| --- | --- | --- |
| [geoBoundaries BGD ADM2](https://www.geoboundaries.org/api/current/gbOpen/BGD/ADM2/) | District | Add upazila or union only after a consistent official boundary source is selected. |

## Places-of-worship layer

| Source | Role | Note |
| --- | --- | --- |
| [OpenStreetMap](https://www.openstreetmap.org) | Candidate site layer | OSM coverage was not counted in this source sweep. First build should assess mosque saturation and under-tagging of temples, churches, and Buddhist sites. |

## First visualisation

Map district religious-affiliation shares for the 2022 census, then add 2011 and earlier district waves after table extraction.

## Build recipe

Start with the BBS `Population and Housing Census 2022 National Report` religion table and geoBoundaries BGD ADM2. Recover 2011 district or union statistics only after category and boundary comparability are documented.

## Risks and open questions

Public small-area religion maps can increase risk for Hindu, Buddhist, Christian, Ahmadi, and other local minorities. The main data risk is mixing census affiliation with administrative or media-reported minority counts.

## Deep-history potential

High. Bengal census volumes from 1872-1941, Bangladesh National Archives holdings, district gazetteers, waqf records, devottar and temple-trust records, church registers, and monastery records can support deeper histories.
