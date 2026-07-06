# Country data map: Taiwan (TW)

## Status

- **Tier**: B
- **Build state**: Surveyed; official religion statistics centre on registered temples, churches, organisations, and members rather than census affiliation.
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [Ministry of the Interior statistical inquiry](https://statis.moi.gov.tw/) | Registered religious organisations, places, and members | County/city route in annual statistics | Annual series through 2020-2024 | Web tables | Open web | Government open statistics; confirm reuse terms before republication |
| [Taiwan open data portal](https://data.gov.tw/) | Administrative open data for temples, churches, and religious organisations | County/city or township depending on dataset | Current and historical snapshots vary | CSV/web API where released | Open data portal | Dataset-specific licence |

## Boundaries

| Source | Unit | Match note |
| --- | --- | --- |
| [geoBoundaries TWN ADM2](https://www.geoboundaries.org/api/current/gbOpen/TWN/ADM2/) | County/city and district route | Use official MOI boundary codes where possible. |

## Places-of-worship layer

| Source | Role | Note |
| --- | --- | --- |
| [OpenStreetMap](https://www.openstreetmap.org) | Candidate site layer | OSM coverage was not counted in this source sweep. Temple density should be compared with MOI administrative place records. |

## First visualisation

Map county/city registered temples, churches, and religious organisations per resident, with a clear administrative-construct title.

## Build recipe

Start with the MOI annual religion-statistics table for registered religious places or organisations and geoBoundaries TWN ADM2. Do not label the output as census affiliation.

## Risks and open questions

Registered membership and organisation counts can double-count adherents and miss folk practice. The key open question is whether any official household or census source provides personal affiliation at county/city level.

## Deep-history potential

High. Japanese colonial census and temple materials, Taiwan Historica holdings, Ministry of the Interior registration series, temple registers, church records, and local gazetteers can support long-run site histories.
