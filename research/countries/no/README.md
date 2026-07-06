# Country data map: Norway (NO)

## Status

- **Tier**: B
- **Build state**: Surveyed; SSB has strong annual church-membership APIs, but the smallest verified unit is diocese for the Church of Norway table.
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [SSB table 06929, Church of Norway members](https://data.ssb.no/api/v0/en/table/DNKMedlemmer) | Church of Norway administrative membership | Diocese | 2005-2025 | JSON-stat API | Open API | Statistics Norway terms |
| [SSB table 06339, Christian communities outside the Church of Norway](https://data.ssb.no/api/v0/en/table/MedlemKristTrus) | Registered Christian community membership | National | 2006-2026 | JSON-stat API | Open API | Statistics Norway terms |

## Boundaries

| Source | Unit | Match note |
| --- | --- | --- |
| [Geonorge map catalogue](https://kartkatalog.geonorge.no/) | Municipality, county, church geography where available | Diocese boundaries need a separate source or manual construction before mapping table 06929. |

## Places-of-worship layer

| Source | Role | Note |
| --- | --- | --- |
| [OpenStreetMap](https://www.openstreetmap.org) | Candidate site layer | OSM coverage was not counted in this source sweep. First build should review rural church completeness and non-Lutheran under-tagging. |

## First visualisation

Map Church of Norway membership by diocese for 2005-2025, with national registered-community membership as a separate chart.

## Build recipe

Extract SSB table 06929 through the JSON-stat API and join to a documented diocese boundary file. Do not merge non-Church of Norway national membership with the diocese layer.

## Risks and open questions

Diocese is an ecclesiastical unit rather than a standard statistical geography. Membership in registered communities is not census affiliation, and national tables cannot support small-area maps.

## Deep-history potential

High. Church books, Digitalarkivet, parish histories, National Archives holdings, cultural heritage registers, local newspapers, and historic maps can support deeper site histories.
