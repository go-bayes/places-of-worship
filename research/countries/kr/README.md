# Country data map: South Korea (KR)

## Status

- **Tier**: B
- **Build state**: Surveyed; KOSIS has multi-wave religion census tables, with extraction and 2020-round absence to document.
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [KOSIS Korean Statistical Information Service](https://kosis.kr/) | Census religion by person | Si/gun/gu in 2005 and 2015 table route | 1985, 1995, 2005, 2015 | Web tables | Open web | KOSIS public statistics; confirm reuse terms before republication |
| [Statistics Korea](https://kostat.go.kr/) | Population and housing census products | Si/gun/gu where religion table released | 2020 round did not provide a comparable religion census table found in this survey | Web/PDF | Open web | Government statistics; confirm reuse terms before republication |

## Boundaries

| Source | Unit | Match note |
| --- | --- | --- |
| [geoBoundaries KOR ADM2](https://www.geoboundaries.org/api/current/gbOpen/KOR/ADM2/) | Si/gun/gu | Boundary changes and metropolitan reorganisations need a crosswalk before longitudinal display. |

## Places-of-worship layer

| Source | Role | Note |
| --- | --- | --- |
| [OpenStreetMap](https://www.openstreetmap.org) | Candidate site layer | OSM coverage was not counted in this source sweep. Church and temple tagging should be compared against local official or denominational directories. |

## First visualisation

Map 2015 si/gun/gu religion shares, with a note that the 2020 census round does not supply the same public religion construct.

## Build recipe

Start with the KOSIS 2015 si/gun/gu table `Population by sex, age and religion` and geoBoundaries KOR ADM2. Add 2005, 1995, and 1985 after method and boundary differences are documented.

Resolved KOSIS table IDs (verification pass 2026-07-07): 1985
`DT_1IN8505`, 1995 `DT_1IN9506`, 2005 `DT_1IN0505`, 2015 `DT_1PM1502`.
Four official waves promote this card above two-wave candidates under
the all-waves queue rule; 2005/2015 are si/gun/gu, 1985 is sido-level,
1995 needs an extraction check.

## Risks and open questions

The 2015 census method differs from earlier enumeration practice, and the missing 2020 religion wave limits current trend mapping. Public maps should separate census affiliation from denominational directories and from places-of-worship density.

## Deep-history potential

High. Statistics Korea census tables, National Archives of Korea holdings, Japanese colonial census materials, Buddhist order records, Protestant and Catholic directories, and local government cultural-heritage registers can support deeper histories.
