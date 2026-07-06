# Country data map: Indonesia (ID)

## Status

- **Tier**: B
- **Build state**: Surveyed; 2010 kabupaten-level census route is clear, while later BPS religion tables require province-by-province assembly.
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [BPS SP2010 topic table, religion](https://sensus.bps.go.id/topik/tabular/sp2010/12/0/0) | Census religious affiliation | Kabupaten/kota route in BPS table interface | 2010 | Web table and JSON-backed interface | Open web | BPS public statistics; confirm reuse terms before republication |
| [BPS regional statistics portal](https://www.bps.go.id/) | Published provincial and kabupaten religion tables | Kabupaten/kota where provincial tables are released | 2020-2024 releases vary by province | Web/PDF/XLS depending on province | Open web | BPS public statistics; confirm reuse terms before republication |

## Boundaries

| Source | Unit | Match note |
| --- | --- | --- |
| [geoBoundaries IDN ADM2](https://www.geoboundaries.org/api/current/gbOpen/IDN/ADM2/) | Kabupaten/kota | Harmonise post-2010 kabupaten splits before comparing years. |

## Places-of-worship layer

| Source | Role | Note |
| --- | --- | --- |
| [OpenStreetMap](https://www.openstreetmap.org) | Candidate site layer | OSM coverage was not counted in this source sweep. First build should stratify coverage by island group and urban/rural settlement. |

## First visualisation

Map 2010 kabupaten/kota affiliation shares from SP2010, then add later BPS releases only after each table's construct is labelled.

## Build recipe

Start with the BPS SP2010 religion table for kabupaten/kota and geoBoundaries IDN ADM2. Treat later BPS provincial tables as a separate assembly task because some releases may report civil-registration religion rather than census affiliation.

## Risks and open questions

Religion is administratively salient in Indonesia, and small-area maps can be sensitive in Aceh, Papua, Maluku, and other local minority settings. The main technical risk is construct drift between 2010 census affiliation and later administrative religion counts.

## Deep-history potential

Medium-high. The 1930 Netherlands Indies census, Arsip Nasional Republik Indonesia holdings, BPS historical census volumes, Ministry of Religious Affairs registers, and colonial residentie records provide routes into earlier subnational religion and site histories.
