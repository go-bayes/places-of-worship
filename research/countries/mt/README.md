# Country data map: Malta (MT)

## Status

- **Tier**: B
- **Build state**: Surveyed; the 2021 census reports religious affiliation in a PDF, and Catholic attendance censuses provide a separate local construct.
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [National Statistics Office census publications](https://nso.gov.mt/) | Census affiliation | District in the 2021 final report; locality route to verify | 2021 | PDF | Open web | Malta NSO terms |
| [Archdiocese of Malta / Sunday Mass attendance census](https://church.mt/) | Catholic attendance | Parish or locality in reports | 1995, 2005, 2017 series to verify | PDF/report | Open web where posted | Archdiocese terms |

## Boundaries

| Source | Unit | Match note |
| --- | --- | --- |
| [Malta Planning Authority geoserver](https://pa.org.mt/) or [geoBoundaries MLT](https://www.geoboundaries.org/) | Local council and district | Use the census district geography first; local-council mapping depends on whether the 2021 table is released below district. |

## Places-of-worship layer

| Source | Role | Note |
| --- | --- | --- |
| [OpenStreetMap](https://www.openstreetmap.org) | Candidate site layer | OSM coverage was not counted in this source sweep. First build should distinguish Catholic parish churches from chapels and historic sites. |

## First visualisation

Map 2021 census religious-affiliation shares by district, then add Catholic attendance only as a separate attendance layer if parish tables are recovered.

## Build recipe

Extract the religious-affiliation pages from the NSO 2021 census final report and join to district boundaries. Keep Archdiocese attendance data in a separate table because attendance is not affiliation.

## Risks and open questions

Only one census-affiliation wave was located, and the main file is PDF. The Catholic attendance series cannot be used as a proxy for all religious affiliation.

## Deep-history potential

High. Malta National Archives, Archdiocese archives, parish registers, notarial records, synagogue and mosque community records, heritage inventories, and local newspapers can support deeper site histories.
