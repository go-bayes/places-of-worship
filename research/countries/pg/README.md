# Country data map: Papua New Guinea (PG)

## Status

- **Tier**: C (documented exclusion)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [PDH Papua New Guinea 2023 Population and Housing Census](https://microdata.pacificdata.org/index.php/catalog/792) | census metadata | no public religion variable or table verified | 2023 | metadata | open metadata | PDH terms |
| [PDH Papua New Guinea 2022 Socio-Demographic and Economic Survey](https://microdata.pacificdata.org/index.php/catalog/872) | survey affiliation | survey unit; public subnational census table not verified | 2022 | metadata | licensed survey | PDH terms |
| [PDH Papua New Guinea 2011 Population and Housing Census](https://microdata.pacificdata.org/index.php/catalog/583) | census metadata | public religion table not verified | 2011 | metadata | development metadata | PDH terms |

## Boundaries

- Official boundary files: geoBoundaries PNG ADM1 can support province maps if a usable table appears.
- Boundary harmonisation should use current province names and document any province splits.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): public Overpass queries timed out; rerun before any site-layer work.
- Country registers to survey: Catholic, Lutheran, Anglican, United Church, Seventh-day Adventist, and Pentecostal directories.

## First visualisation

No religion map is recommended until a public subnational census table is found. A non-map source note can record national or survey affiliation context separately from site data.

## Build recipe

1. Extract: no build step until the 2023 census religion tables or a reusable older table are public.
2. Governed product: do not create `area_summary` from licensed survey data without a public census table.
3. Boundaries: keep geoBoundaries PNG ADM1 as the candidate boundary source.
4. Region page: do not add `REGION_CONFIG` for religion.
5. Verification: confirm whether NSO/SPC releases any province religion table.

## Risks and open questions

- The available 2022 religion source is a licensed survey. It does not provide a public census table.
- PNG has strong denominational diversity. National-only data would therefore hide the geography most relevant to the project.

## Deep-history potential

Mission archives are unusually important: Catholic, Lutheran, Anglican, United Church, and Seventh-day Adventist records can document early stations. PNG National Archives, church yearbooks, and mission maps are priority sources.
