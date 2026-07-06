# Country data map: Austria (AT)

## Status

- **Tier**: B
- **Build state**: Surveyed; official federal-state religion tables exist, but 2021 is survey-based and extraction is PDF/report centred.
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [Statistics Austria 2021 religion release](https://www.statistik.at/fileadmin/announcement/2022/05/20220525Religionszugehoerigkeit2021.pdf) | Survey affiliation | Federal state | 2021 | PDF | Open web | Statistics Austria terms |
| [Statistics Austria historical religion tables](https://www.statistik.at/) | Census affiliation | Federal state | 1951, 1961, 1971, 1981, 1991, 2001 | PDF/web table | Open web | Statistics Austria terms |

## Boundaries

| Source | Unit | Match note |
| --- | --- | --- |
| [Eurostat GISCO administrative units](https://ec.europa.eu/eurostat/web/gisco/geodata/administrative-units) | Federal state / NUTS1-2 | Federal-state boundaries are adequate for the first map; older census waves should use a stable nine-state frame. |

## Places-of-worship layer

| Source | Role | Note |
| --- | --- | --- |
| [OpenStreetMap](https://www.openstreetmap.org) | Candidate site layer | OSM coverage was not counted in this source sweep. First build should compare OSM worship sites against urban and rural federal states. |

## First visualisation

Map federal-state affiliation shares for 2021 and historical census waves from 1951-2001, with 2011 left absent because the register census did not ask religion.

## Build recipe

Extract the 2021 Statistics Austria religion PDF and the 1951-2001 historical federal-state table. Join to GISCO state boundaries and mark 2021 as a survey estimate rather than a census count.

## Risks and open questions

The 2011 register census creates a gap in the census-affiliation sequence. Austria's 2021 source measures affiliation through a survey, which limits small-area mapping.

## Deep-history potential

High. Imperial and republican census volumes, diocesan archives, parish registers, Jewish community records, state archives, and Catholic schematisms can support deeper site histories.
