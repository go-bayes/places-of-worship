# Country data map: Italy (IT)

## Status

- **Tier**: B
- **Build state**: Surveyed; ISTAT provides repeated religious-practice survey data, while census affiliation is absent.
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [ISTAT data warehouse](https://esploradati.istat.it/) | Religious attendance / practice | Region and municipality type in the `Aspects of daily life` table | 2001-2022 series located in source search | I.Stat table export | Open web | ISTAT terms |
| [ISTAT census portal](https://www.istat.it/) | No census affiliation table | None | Current census rounds absent for religion | Web | Open web | ISTAT terms |

## Boundaries

| Source | Unit | Match note |
| --- | --- | --- |
| [ISTAT administrative boundaries](https://www.istat.it/notizia/confini-delle-unita-amministrative-a-fini-statistici/) | Region, province, municipality | Use regions for the first attendance map; municipality-type strata are not polygon boundaries. |

## Places-of-worship layer

| Source | Role | Note |
| --- | --- | --- |
| [OpenStreetMap](https://www.openstreetmap.org) | Candidate site layer | OSM coverage was not counted in this source sweep. Catholic heritage sites need active-use review. |

## First visualisation

Map regional weekly or regular attendance shares from the ISTAT `Aspects of daily life` survey series.

## Build recipe

Extract the ISTAT religious-practice table from I.Stat and join region estimates to ISTAT regional boundaries. Record attendance as a separate construct from affiliation and site presence.

## Risks and open questions

Attendance does not measure affiliation, and municipality-type strata cannot be mapped as areas without a model. Small religious minorities will not be well represented by a general social survey.

## Deep-history potential

High. Diocesan archives, parish registers, state archives, synagogue records, Muslim association directories, Istituto Centrale per il Catalogo e la Documentazione, local histories, and historic maps can support deeper site histories.
