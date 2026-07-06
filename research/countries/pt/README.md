# Country data map: Portugal (PT)

## Status

- **Tier**: A
- **Build state**: Surveyed; Census 2011 and 2021 religion tables are public through Statistics Portugal, and official municipality boundaries are available.
- **Last verified**: 2026-07-07; tier-A verification sources: https://tabulador.ine.pt/ and https://www.ine.pt/

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [Statistics Portugal tabulator](https://tabulador.ine.pt/) | Census affiliation for residents aged 15 and over | Place of residence / municipality in Census 2021 NUTS table | 2021 | Web table export | Open web | Statistics Portugal terms; confirm reuse before republication |
| [Statistics Portugal census tables](https://www.ine.pt/) | Census affiliation for residents aged 15 and over | Place of residence / municipality | 2011 | Web table export | Open web | Statistics Portugal terms; confirm reuse before republication |

## Boundaries

| Source | Unit | Match note |
| --- | --- | --- |
| [Carta Administrativa Oficial de Portugal](https://www.dgterritorio.gov.pt/cartografia/cartografia-tematica/caop) | Municipality and parish | Anchor the first map on 2021 municipality boundaries; build a 2011-2021 concordance where municipality changes affect joins. |

## Places-of-worship layer

| Source | Role | Note |
| --- | --- | --- |
| [OpenStreetMap](https://www.openstreetmap.org) | Candidate site layer | OSM coverage was not counted in this source sweep. First build should compare Catholic, Evangelical, mosque, synagogue, and temple tagging. |

## First visualisation

Map census-affiliation shares by municipality for 2011 and 2021, on 2021 municipality boundaries.

## Build recipe

Extract the Census 2021 table `Resident population aged 15 and over by place of residence and religion` from the Statistics Portugal tabulator, then extract the 2011 equivalent from Statistics Portugal. Join both to CAOP 2021 municipality polygons, preserving age universe and category labels in the manifest.

## Risks and open questions

Religion is reported only for residents aged 15 and over; denominators must use the same universe. Category wording and small-cell suppression need review before publication.

## Deep-history potential

High. Historical census volumes, Arquivo Nacional da Torre do Tombo, diocesan archives, parish registers, Jewish community records, mosque and temple directories, municipal archives, and historic newspapers can support deeper site histories.
