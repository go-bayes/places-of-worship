# Country data map: Tokelau (TK)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [PDH Tokelau 2022 Population and Housing Census](https://microdata.pacificdata.org/index.php/catalog/834) | census affiliation metadata | record-level metadata; atoll table needs extraction | 2022 | metadata | licensed data | PDH terms |
| [PDH Tokelau 1996 Population and Housing Census](https://microdata.pacificdata.org/index.php/catalog/190) | census affiliation metadata | record-level metadata; atoll table needs extraction | 1996 | metadata | open metadata; data access varies | PDH terms |
| [PDH Tokelau census catalogue search](https://microdata.pacificdata.org/index.php/api/catalog/search?country_iso3=TKL&sk=census) | census metadata series | atoll table needs extraction | 1986-2022 | API metadata | open metadata | PDH terms |

## Boundaries

- Official boundary files: no geoBoundaries TKL ADM1 endpoint was available in the sweep; locate an official Tokelau, Stats NZ, or SPC boundary source.
- The natural geography is the three atolls: Atafu, Nukunonu, and Fakaofo.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): 2 tagged places returned by Overpass; completeness is likely poor.
- Country registers to survey: Congregational Christian Church of Tokelau, Catholic mission records, Tokelau National Archives, and Stats NZ material.

## First visualisation

Religious-affiliation percent by atoll for 1996-2022 after aggregate tables and an open atoll boundary file are secured.

## Build recipe

1. Extract: use PDH metadata to identify religion variables, then obtain atoll aggregates from reports or reusable access.
2. Governed product: create `area_summary` rows by atoll and wave.
3. Boundaries: locate an official or SPC atoll boundary file and document licence terms.
4. Region page: add `REGION_CONFIG` after source and boundary verification.
5. Verification: test atoll totals against published census totals.

## Risks and open questions

- The latest PDH record is licensed. Aggregate reuse must therefore be clarified.
- Boundary licensing is unresolved.

## Deep-history potential

Congregational, Catholic, LMS, and Tokelau administrative records can support atoll-level worship histories and denomination change.
