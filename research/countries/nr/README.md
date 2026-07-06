# Country data map: Nauru (NR)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [PDH Nauru 2011 Population and Housing Census](https://microdata.pacificdata.org/index.php/catalog/26) | census affiliation metadata | record-level metadata; district table not verified | 2011 | metadata | open metadata; data access varies | PDH terms |
| [PDH Nauru 2002 Population and Housing Census](https://microdata.pacificdata.org/index.php/catalog/236) | census affiliation metadata | record-level metadata; district table not verified | 2002 | metadata | open metadata; data access varies | PDH terms |
| [PDH Nauru 2024 Household Income and Expenditure Survey](https://microdata.pacificdata.org/index.php/catalog/882) | survey affiliation | survey unit | 2024 | metadata | licensed survey | PDH terms |

## Boundaries

- Official boundary files: geoBoundaries NRU ADM1 can anchor district maps.
- Harmonisation should retain district names and document any source that aggregates districts.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): public Overpass queries timed out; rerun before build.
- Country registers to survey: Nauru Congregational Church, Catholic Diocese of Tarawa and Nauru, and Nauru National Archives.

## First visualisation

Religious-affiliation percent by district for 2002, 2011, and 2021 if district tables are located; otherwise no map, only a national context note.

## Build recipe

1. Extract: locate the 2021 census analytical report and district religion tables, then backfill 2011 and 2002 from PDH-linked materials.
2. Governed product: create `area_summary` rows only from public district totals.
3. Boundaries: download geoBoundaries NRU ADM1 and join on district names.
4. Region page: add `REGION_CONFIG` after public district tables are verified.
5. Verification: test district totals against national census totals.

## Risks and open questions

- The sweep confirmed older religion variables. District tables still need verification.
- Small population counts mean suppression and rounding must be handled explicitly.

## Deep-history potential

Nauru Congregational, Catholic, German colonial, Japanese-period, and Trust Territory records can support site histories. Nauru National Archives is the main local route.
