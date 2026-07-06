# Country data map: India (IN)

## Status

- **Tier**: A
- **Build state**: Surveyed; first build can start from Census C-01 tables and ADM2 boundaries.
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [Census of India table API, C-01 religious community](https://censusindia.gov.in/nada/index.php/api/tables/data/global/census_tables/15/0/?ft_query=C-01%20religious&series_id=15&census_year=2011) | Census religious affiliation by community | District | 2011 | XLS | Open download | Government census data; confirm reuse terms before republication |
| [Census of India table API, C-01 2001/1991 search](https://censusindia.gov.in/nada/index.php/api/tables/data/global/census_tables/5/0/?ft_query=C-01%20religious&series_id=15&census_year=2001,1991) | Census religious affiliation by community | District | 1991, 2001 | XLS and appendices | Open download | Government census data; confirm reuse terms before republication |
| [Census of India tables portal](https://censusindia.gov.in/census.website/data/census-tables) | Census table catalogue | District where released | 2021 round delayed; no released 2020-2024 religion table | Web catalogue | Open web | Government census data; confirm reuse terms before republication |

## Boundaries

| Source | Unit | Match note |
| --- | --- | --- |
| [geoBoundaries IND ADM2](https://www.geoboundaries.org/api/current/gbOpen/IND/ADM2/) | District | Use 2011 census district codes where available, then reconcile later district splits before longitudinal display. |

## Places-of-worship layer

| Source | Role | Note |
| --- | --- | --- |
| [OpenStreetMap](https://www.openstreetmap.org) | Candidate site layer | OSM coverage was not counted in this source sweep. First build should run an Overpass or ohsome extract for `amenity=place_of_worship` and compare coverage by state and urban/rural status. |

## First visualisation

Map 2011 district shares for the main Census C-01 religious communities, with a small-multiple panel for 1991 and 2001 after district harmonisation.

## Build recipe

Start with Census 2011 `C-01: Population by religious community` all-India XLS (`DDW00C-01 MDDS.XLS`) and the geoBoundaries IND ADM2 GeoJSON. Normalise state and district names, preserve census community categories, then add 2001 and 1991 only after boundary crosswalks are documented.

## Risks and open questions

Religion data in India can expose small local minorities and contested communities. Public maps should suppress or aggregate small cells, document district-boundary changes, and separate census affiliation from places-of-worship presence. The delayed 2021 census leaves no 2020-2024 affiliation round to map.

## Deep-history potential

High. Census of India printed volumes extend back through colonial census series, and state gazetteers, National Archives of India holdings, missionary records, waqf records, temple-trust records, and Archaeological Survey of India monument registers can support deeper site histories.
