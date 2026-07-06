# Country data map: Timor-Leste (TL)

## Status

- **Tier**: C (documented exclusion)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [INETL 2022 Population and Housing Census main report](https://inetl-ip.gov.tl/2023/05/18/main-report-timor-leste-population-and-housing-census-2022/) | census affiliation | national by age and sex in table 4.7 | 2022 | PDF | open | INETL copyright; confirm reuse |
| [INETL 2022 census basic table workbook page](https://inetl-ip.gov.tl/2023/05/18/table-main-report-timor-leste-population-and-housing-census-2022/) | census tables | national for religion in verified report; municipality table not verified | 2022 | XLSX behind site verification | open page; download gated | INETL copyright; confirm reuse |
| [INETL census publication archive](https://inetl-ip.gov.tl/category/publication/census-publication/) | census publication series | municipality for many population tables, religion geography not verified | 2004, 2010, 2015, 2022 | web, PDF | open | INETL copyright; confirm reuse |

## Boundaries

- Official boundary files: geoBoundaries TLS ADM1 can anchor municipality maps if a public religion table is found.
- Atauro's 2022 municipality status must be handled explicitly in any time-series concordance.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): public Overpass queries timed out; rerun before any site-layer work.
- Country registers to survey: Catholic Archdiocese of Dili, dioceses of Baucau and Maliana, Protestant directories, Muslim community records, and Arquivo Nacional de Timor-Leste.

## First visualisation

No census religion map is recommended until a public municipality religion table is located. The verified 2022 source supports national affiliation context only.

## Build recipe

1. Extract: no mapped `area_summary` build until a municipality religion table is found.
2. Governed product: keep the 2022 national table as context. Do not publish it as a map layer.
3. Boundaries: use geoBoundaries TLS ADM1 only after a compatible municipality table is verified.
4. Region page: do not add `REGION_CONFIG` for religion.
5. Verification: if a municipality table appears, test totals against table 4.7 and the national census total.

## Risks and open questions

- The 2022 report verifies religion, but not subnational religion.
- Current and older workbooks may contain more detail, but the accessible report path did not prove it.

## Deep-history potential

Catholic diocesan records, Protestant mission records, Muslim community records, Portuguese colonial archives, and Arquivo Nacional de Timor-Leste can support deep-history site evidence.
