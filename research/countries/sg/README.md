# Country data map: Singapore (SG)

## Status

- **Tier**: B
- **Build state**: Surveyed; census religion series is strong, while subzone/planning-area extraction needs table verification.
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [Singapore Census 2020 Statistical Release 1](https://www.singstat.gov.sg/publications/reference/cop2020/census20_stat_release1) | Census religion for resident population | National and demographic groups in release; planning-area route needs table verification | 1980, 1990, 2000, 2010, 2015, 2020 | PDF/web tables | Open web | Singapore government open-data terms; confirm table-level terms |
| [SingStat publications](https://www.singstat.gov.sg/publications) | Census and general household survey religion | National and possible planning-area tables | 1980-2020 series | PDF/web/XLS where released | Open web | Singapore government open-data terms; confirm table-level terms |

## Boundaries

| Source | Unit | Match note |
| --- | --- | --- |
| [data.gov.sg](https://data.gov.sg/) | Planning area/subzone route | Use Urban Redevelopment Authority planning boundaries if subnational religion tables are confirmed. |

## Places-of-worship layer

| Source | Role | Note |
| --- | --- | --- |
| [OpenStreetMap](https://www.openstreetmap.org) | Candidate site layer | OSM coverage was not counted in this source sweep. Land-use controls mean official place registers may outperform volunteered data. |

## First visualisation

Start with national time-series panels for 1980-2020, then add planning-area maps only after the subnational table is verified.

## Build recipe

Start with Census 2020 Statistical Release 1 religion tables and data.gov.sg planning-area boundaries if a matching subnational table is located. Keep resident-population denominators explicit.

## Risks and open questions

Small-area religion maps in Singapore may create local minority visibility in dense neighbourhoods. The main open question is whether official planning-area religion tables are downloadable with the same construct as the national census series.

## Deep-history potential

High. Straits Settlements census volumes, National Archives of Singapore holdings, URA historical maps, charity and society registrations, mosque records, church directories, temple records, and synagogue records can support long-run site histories.
