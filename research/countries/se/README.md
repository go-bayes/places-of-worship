# Country data map: Sweden (SE)

## Status

- **Tier**: B
- **Build state**: Surveyed; annual Church of Sweden membership is public, but a subnational extract and boundary join still need work.
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [Church of Sweden statistics](https://www.svenskakyrkan.se/statistik) | Church administrative membership | National verified; parish or diocese route to verify | 1972-2025 | HTML/PDF | Open web | Church of Sweden terms |
| [Statistics Sweden religion-related population outputs](https://www.scb.se/) | No modern census affiliation series | None for census religion | Current census equivalent absent for religion | Web | Open web | SCB terms |

## Boundaries

| Source | Unit | Match note |
| --- | --- | --- |
| [Statistics Sweden geodata](https://www.scb.se/en/services/open-data-api/open-geodata/) | Municipality, county, DeSO | Church geographies need a separate boundary source before annual membership can be mapped. |

## Places-of-worship layer

| Source | Role | Note |
| --- | --- | --- |
| [OpenStreetMap](https://www.openstreetmap.org) | Candidate site layer | OSM coverage was not counted in this source sweep. Church of Sweden heritage sites need active-use review. |

## First visualisation

Map annual Church of Sweden membership only after a parish or diocese extract and matching boundary file are verified.

## Build recipe

Start with the Church of Sweden 1972-2025 membership publication and identify its smallest machine-readable geography. Keep church membership separate from any population survey or site inventory.

## Risks and open questions

Church of Sweden membership is an administrative register. It does not measure population census religion. Parish mergers and boundary changes may dominate the longitudinal work.

## Deep-history potential

High. Swedish church books, National Archives collections, parish records, Swedish National Heritage Board registers, synagogue records, free-church archives, and local newspapers can support deeper site histories.
