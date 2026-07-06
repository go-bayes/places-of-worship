# Country data map: Marshall Islands (MH)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [PDH Marshall Islands 2021 Population and Housing Census](https://microdata.pacificdata.org/index.php/catalog/812) | census affiliation metadata | record-level metadata; atoll or island table needs extraction | 2021 | metadata | open metadata; data access varies | PDH terms |
| [PDH Marshall Islands 2011 Population and Housing Census](https://microdata.pacificdata.org/index.php/catalog/22) | census affiliation metadata | record-level metadata; atoll or island table needs extraction | 2011 | metadata | open metadata; data access varies | PDH terms |
| [PDH Marshall Islands 1999 Population and Housing Census](https://microdata.pacificdata.org/index.php/catalog/317) | census metadata | public religion table not verified | 1999 | metadata | open metadata; data access varies | PDH terms |

## Boundaries

- Official boundary files: geoBoundaries MHL ADM1 can anchor atoll and island maps.
- Build a stable atoll-name crosswalk before comparing 1999, 2011, and 2021.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): public Overpass queries timed out; rerun before build.
- Country registers to survey: United Church of Christ-Congregational, Catholic mission records, and Marshall Islands National Archives.

## First visualisation

Religious-affiliation percent by atoll or island for 2011 and 2021 after the public report tables are extracted.

## Build recipe

1. Extract: use PDH variables to locate religion fields, then extract atoll or island tables from 2021 and 2011 reports.
2. Governed product: create `area_summary` rows by atoll or island and wave.
3. Boundaries: download geoBoundaries MHL ADM1 and join on atoll names.
4. Region page: add `REGION_CONFIG` after join verification.
5. Verification: test atoll totals against report population totals and record suppressed cells.

## Risks and open questions

- Direct public atoll religion tables were not verified in the sweep.
- Small atoll counts may require grouping for publication.

## Deep-history potential

United Church of Christ-Congregational, Catholic, German, Japanese, and Trust Territory records can document older sites. Marshall Islands National Archives and Micronesian Seminar collections are priority sources.
