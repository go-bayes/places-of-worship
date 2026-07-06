# Country data map: Cook Islands (CK)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [PDH Cook Islands 2021 Population and Dwelling Census](https://microdata.pacificdata.org/index.php/catalog/883) | census affiliation metadata | record-level metadata; island table needs extraction | 2021 | metadata | licensed data | PDH terms |
| [PDH Cook Islands 2016 Population and Dwelling Census](https://microdata.pacificdata.org/index.php/catalog/275) | census affiliation metadata | record-level metadata; island table needs extraction | 2016 | metadata | open metadata; data access varies | PDH terms |
| [PDH Cook Islands 2011 Population and Dwelling Census](https://microdata.pacificdata.org/index.php/catalog/7) | census metadata | public religion table not verified | 2011 | metadata | open metadata; data access varies | PDH terms |

## Boundaries

- Official boundary files: no geoBoundaries COK ADM1 endpoint was available in the sweep; locate an official Statistics Office, Cook Islands GIS, or SPC boundary source.
- Island names should anchor the first geography once an open boundary file is verified.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): public Overpass queries timed out; rerun before build.
- Country registers to survey: Cook Islands Christian Church, Catholic Diocese of Rarotonga, LDS records, and Cook Islands Library and Museum/Archives.

## First visualisation

Religious-affiliation percent by island for 2016 and 2021 after tables and open island boundaries are secured.

## Build recipe

1. Extract: use PDH variables to locate religion fields, then obtain island tables from official reports or reusable microdata access.
2. Governed product: create `area_summary` rows by island and census wave.
3. Boundaries: locate an official or SPC island boundary file and record licence terms.
4. Region page: add `REGION_CONFIG` after boundary and table joins are verified.
5. Verification: test island totals against census population totals.

## Risks and open questions

- The 2021 PDH record is licensed. Public reuse may therefore require an aggregate-table route.
- Open boundary licensing is unresolved.

## Deep-history potential

Cook Islands Christian Church, Catholic, LMS, LDS, and local archive records can document historic church sites and relocations.
