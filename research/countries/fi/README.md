# Country data map: Finland (FI)

## Status

- **Tier**: B
- **Build state**: Surveyed; national religious-community membership is in StatFin, while a subnational church or register extract still needs verification.
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [StatFin table 11rx, belonging to a religious community](https://pxdata.stat.fi/PxWeb/pxweb/en/StatFin/StatFin__vaerak/statfin_vaerak_pxt_11rx.px/table/tableViewLayout1/) | Administrative religious-community membership | National | 1990-2025 | PxWeb API/CSV | Open API | Statistics Finland open-data terms |
| [Church statistics service](https://www.kirkontilastot.fi/) | Evangelical Lutheran church membership | Parish or diocese route to verify | Annual current series | Web tables | Open web | Church terms; confirm reuse before republication |

## Boundaries

| Source | Unit | Match note |
| --- | --- | --- |
| [Statistics Finland geospatial data](https://www.stat.fi/org/avoindata/paikkatietoaineistot_en.html) | Municipality and region | Use municipality or parish boundaries only after a matching subnational membership source is verified. |

## Places-of-worship layer

| Source | Role | Note |
| --- | --- | --- |
| [OpenStreetMap](https://www.openstreetmap.org) | Candidate site layer | OSM coverage was not counted in this source sweep. First build should compare Lutheran parish sites with other registered communities. |

## First visualisation

No subnational first map is ready. A national time chart for registered religious-community membership from 1990-2025 can precede mapping work.

## Build recipe

Start with StatFin 11rx for a national register series. Advance to a map only after parish or municipality-level membership data and matching boundaries are verified.

## Risks and open questions

The verified StatFin table is national only. Church membership is an administrative construct and must not be presented as census affiliation.

## Deep-history potential

High. Finnish parish registers, National Archives holdings, Lutheran and Orthodox church records, historical population tables, local histories, and heritage registers can support deeper site histories.
