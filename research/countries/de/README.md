# Country data map: Germany (DE)

## Status

- **Tier**: B
- **Build state**: Surveyed; one municipal census wave and annual church-membership series are public, but the constructs and geographies need harmonisation.
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [Zensus 2011 results database](https://ergebnisse.zensus2011.de/) | Census affiliation | Municipality | 2011 | Web table export | Open web | German statistical offices; confirm reuse terms before republication |
| [EKD church-membership statistics](https://www.ekd.de/statistik-kirchenmitglieder-17279.htm) | Protestant church administrative membership | Regional church / Land series | Annual long-running series; current releases to 2024/2025 | HTML/PDF | Open web | EKD website terms |
| [German Bishops' Conference church statistics](https://www.dbk.de/presse/kirchenstatistik-2024) | Catholic church administrative membership | Diocese | Annual long-running series; current releases to 2024 | HTML/PDF | Open web | DBK website terms |

## Boundaries

| Source | Unit | Match note |
| --- | --- | --- |
| [BKG VG250 / administrative areas](https://gdz.bkg.bund.de/) | Municipality and district | Anchor the census layer on 2011 municipalities; church geographies need separate region and diocese boundaries. |

## Places-of-worship layer

| Source | Role | Note |
| --- | --- | --- |
| [OpenStreetMap](https://www.openstreetmap.org) | Candidate site layer | OSM coverage was not counted in this source sweep. First build should assess under-tagging by denomination and region. |

## First visualisation

Map 2011 census-affiliation shares by municipality, with separate non-comparable reference panels for Protestant and Catholic administrative membership by church geography.

## Build recipe

Start with the Zensus 2011 municipality religion table and BKG 2011-compatible municipality boundaries. Keep church-membership tables as a separate product because church-tax membership is not census affiliation.

## Risks and open questions

The 2022 census did not provide a public religion table on the same footing as 2011. Church membership covers only registered church bodies and cannot represent all religion or no-religion categories.

## Deep-history potential

High. Imperial and Weimar census volumes, state statistical yearbooks, parish registers, diocesan archives, Protestant regional-church archives, synagogue community records, and municipal address books can support deeper site histories.
