# Country data map: Solomon Islands (SB)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [PDH Solomon Islands 2009 Population and Housing Census](https://microdata.pacificdata.org/index.php/catalog/31) | census affiliation metadata | record-level metadata; public subnational table not verified | 2009 | metadata | open metadata; data access varies | PDH terms |
| [PDH Solomon Islands 1999 Population and Housing Census](https://microdata.pacificdata.org/index.php/catalog/396) | census affiliation metadata | record-level metadata; public subnational table not verified | 1999 | metadata | open metadata; data access varies | PDH terms |
| [PDH Solomon Islands 1986 Population and Housing Census](https://microdata.pacificdata.org/index.php/catalog/349) | census metadata | public religion table not verified | 1986 | metadata | open metadata; data access varies | PDH terms |

## Boundaries

- Official boundary files: geoBoundaries SLB ADM1 can anchor province maps.
- Province concordance is likely enough for a first pass; finer island or ward boundaries need a separate source.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): public Overpass queries timed out; rerun before build.
- Country registers to survey: Anglican Church of Melanesia, South Seas Evangelical Church, Catholic dioceses, and Solomon Islands National Archives.

## First visualisation

Religious-affiliation percent by province for 2009, extended to 1999 and 2019 only after public province tables are located or extracted.

## Build recipe

1. Extract: use PDH metadata to confirm religion variables, then locate the official report tables or request access through SINSO/SPC.
2. Governed product: create `area_summary` only after public province totals are verified.
3. Boundaries: download geoBoundaries SLB ADM1 and join on province names.
4. Region page: defer `REGION_CONFIG` until a public table is extracted.
5. Verification: test national totals and record any denomination recoding.

## Risks and open questions

- The 2019 census religion table was not located in the public sweep.
- Metadata confirms variables. A reusable public table still needs verification, and access status controls the tier.

## Deep-history potential

Anglican, Catholic, South Seas Evangelical, Seventh-day Adventist, and mission-station records can support historic site work. The Solomon Islands National Archives and mission society collections are priority sources.
