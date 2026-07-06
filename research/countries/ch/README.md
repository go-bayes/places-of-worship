# Country data map: Switzerland (CH)

## Status

- **Tier**: B
- **Build state**: Surveyed; official religion series are public, but current structural-survey estimates and historical census data need careful extraction and comparability work.
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [Federal Statistical Office religion page](https://www.bfs.admin.ch/bfs/de/home/statistiken/bevoelkerung/sprachen-religionen/religionen.html) | Survey affiliation and religious practice | Canton in selected cumulative tables; national in current summaries | Historical series to 2024; 2021-2023 cumulative table verified | HTML/Datawrapper/PDF | Open web | BFS terms |
| [BFS STAT-TAB / PX-Web](https://www.pxweb.bfs.admin.ch/) | Census or structural-survey affiliation | Canton or commune where released | Historical census waves to 2000; structural survey after 2010 | Table export/API | Open web | BFS terms |

## Boundaries

| Source | Unit | Match note |
| --- | --- | --- |
| [swisstopo swissBOUNDARIES3D](https://www.swisstopo.admin.ch/en/landscape-model-swissboundaries3d) | Canton and commune | Use cantons for the first comparable survey map; commune history needs a merger crosswalk. |

## Places-of-worship layer

| Source | Role | Note |
| --- | --- | --- |
| [OpenStreetMap](https://www.openstreetmap.org) | Candidate site layer | OSM coverage was not counted in this source sweep. First build should compare worship-site tags against canton and municipality density. |

## First visualisation

Map canton-level affiliation shares from the most recent cumulative BFS structural-survey table, with a historical census panel only after category changes are documented.

## Build recipe

Start with the BFS 2021-2023 cumulative religion table and swissBOUNDARIES3D canton polygons. Add earlier census waves only after structural-survey sampling, confidence intervals, and category changes are recorded in the manifest.

## Risks and open questions

The post-2010 structural survey is sample-based, while older sources are census counts. Small cantons and small religious groups may require suppression or wider pooled years.

## Deep-history potential

High. Federal census volumes from the nineteenth and twentieth centuries, cantonal archives, parish registers, diocesan archives, Jewish community records, municipal inventories, and historic gazetteers can support deeper site histories.
