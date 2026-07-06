# Country data map: Netherlands (NL)

## Status

- **Tier**: B
- **Build state**: Surveyed; CBS survey tables and historical census sources exist, but modern subnational religion estimates need extraction and uncertainty handling.
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [CBS StatLine / religious involvement](https://opendata.cbs.nl/statline/) | Survey affiliation and religious participation | COROP region in selected releases; national in annual tables | 2010-2025 national; 2021 regional release verified in CBS publications | API/CSV/report | Open web | CBS open-data terms |
| [Volkstellingen historical census portal](https://www.volkstellingen.nl/) | Census affiliation | Municipality or province depending on table | 1830-1971 | Scans and tables | Open web | Portal terms; confirm reuse before republication |

## Boundaries

| Source | Unit | Match note |
| --- | --- | --- |
| [CBS Wijk- en buurtkaart / administrative boundaries](https://www.cbs.nl/nl-nl/dossier/nederland-regionaal/geografische-data) | Municipality, province, COROP | Use COROP regions for modern survey estimates; historical municipality maps need a separate crosswalk. |

## Places-of-worship layer

| Source | Role | Note |
| --- | --- | --- |
| [OpenStreetMap](https://www.openstreetmap.org) | Candidate site layer | OSM coverage was not counted in this source sweep. First build should assess Christian heritage buildings separately from active worship sites. |

## First visualisation

Map 2021 COROP-region survey affiliation or participation estimates, then add historical census affiliation by municipality after source recovery.

## Build recipe

Start with the CBS regional religious-involvement release and CBS COROP boundaries. Keep modern survey estimates separate from historical census counts in `area_summary`.

## Risks and open questions

Survey uncertainty and category changes limit small-area inference. Historical census categories need translation before comparison with modern CBS survey categories.

## Deep-history potential

High. Digitised census tables, municipal archives, church registers, synagogue archives, cadastral records, monument registers, and historic address books can support deeper site histories.
