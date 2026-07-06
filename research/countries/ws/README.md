# Country data map: Samoa (WS)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [Samoa Bureau of Statistics census downloads](https://www.sbs.gov.ws/census/) | census reports and table workbooks; current religion geography needs inspection | national for verified religion tables; district and village tables require workbook inspection | 2006-2021 | PDF, XLS, XLSX | open | website terms; confirm reuse |
| [Samoa 2021 census Excel tables](https://www.sbs.gov.ws/wp-content/uploads/2022/12/CensusTablesEXCELFiles.xlsx) | census affiliation if religion sheets are present | workbook inspection pending | 2021 | XLSX | open | website terms; confirm reuse |
| [PDH Samoa 2011 Population and Housing Census](https://microdata.pacificdata.org/index.php/catalog/250) | census affiliation metadata | record-level metadata | 2011 | metadata | open metadata; data access varies | PDH terms |

## Boundaries

- Official boundary files: geoBoundaries WSM ADM1 can anchor first maps; village-level boundaries need an official or SPC source before use.
- Harmonise any district or village table to the boundary vintage used by Samoa Bureau of Statistics in the same census wave.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): public Overpass queries timed out; rerun before build.
- Country registers to survey: Congregational Christian Church of Samoa, Methodist Church, Catholic Archdiocese of Samoa-Apia, and Samoa National Archives and Records Authority.

## First visualisation

Religious-affiliation percent by district or village for 2021, if the census workbook exposes the cross-tab; otherwise national affiliation change across 2006-2021 as a non-map context layer.

## Build recipe

1. Extract: inspect the 2021 workbook for religion by district or village, then backfill 2016, 2011, and 2006 tables.
2. Governed product: create `area_summary` rows only for verified geographic religion tables.
3. Boundaries: use geoBoundaries WSM ADM1 for district-scale work; locate official village boundaries before village maps.
4. Region page: add `REGION_CONFIG` after a mappable table is extracted.
5. Verification: test national totals against published census totals and document missing or suppressed cells.

## Risks and open questions

- The public source sweep verified historical religion tables and current workbooks, but not yet a current subnational religion cross-tab.
- Denomination categories may change between 2006 and 2021; preserve wave-specific labels before harmonisation.

## Deep-history potential

London Missionary Society, Methodist, Catholic, and Congregational records can support early worship-site histories. Samoa National Archives and mission periodicals are likely routes for pre-census evidence.
