# Country data map: Federated States of Micronesia (FM)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [PDH FSM 2022 Population and Housing Census](https://microdata.pacificdata.org/index.php/catalog/806) | census metadata | no public religion variable verified | 2022 | metadata | open metadata | PDH terms |
| [PDH FSM 2010 Population and Housing Census](https://microdata.pacificdata.org/index.php/catalog/9) | census affiliation metadata | record-level metadata includes residence village and religion | 2010 | metadata | open metadata; data access varies | PDH terms |
| [PDH FSM 2000 Population and Housing Census](https://microdata.pacificdata.org/index.php/catalog/109) | census affiliation metadata | record-level metadata; public subnational table not verified | 2000 | metadata | open metadata; data access varies | PDH terms |

## Boundaries

- Official boundary files: geoBoundaries FSM ADM1 can anchor state maps; village boundaries need a separate official or SPC source.
- State-level harmonisation should be feasible if report tables are found.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): public Overpass queries timed out; rerun before build.
- Country registers to survey: Catholic Diocese of Caroline Islands, Protestant Congregational records, state archives, and Trust Territory records.

## First visualisation

Religious-affiliation percent by state for 2000 and 2010, with 2022 added only if the public census tables expose religion.

## Build recipe

1. Extract: use PDH variable pages for 2010 and 2000, then locate official state tables or request reusable access.
2. Governed product: create `area_summary` rows by state only after public totals are verified.
3. Boundaries: download geoBoundaries FSM ADM1 and join on state names.
4. Region page: add `REGION_CONFIG` after table extraction.
5. Verification: test state totals and record whether village-level use is licensed or public.

## Risks and open questions

- The 2022 PDH record has no variables. The current-round religion route is therefore unresolved.
- Village-level metadata exists for 2010, but public reuse must be cleared before mapping.

## Deep-history potential

Catholic, Protestant, state archive, Trust Territory, and Micronesian Seminar records can support site histories across Pohnpei, Chuuk, Yap, and Kosrae.
