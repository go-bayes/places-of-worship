# Country data map: Marshall Islands (MH)

## Status

- **Tier**: B (single-wave atoll snapshot, buildable)
- **Build state**: route probe verified — see [route-probe.md](route-probe.md)
- **Last verified**: 2026-07-11

## Religious data over time

Only 2021 publishes religion by atoll in an open, reconciling table. 2011 was collected but never tabulated in any public report (microdata only); 1999 is published only at a 3-sector urban/rural split, image-only. See [route-probe.md](route-probe.md) for the full verdict.

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [RMI 2021 Census Report Vol 1 (Basic Tables), Table 9](https://rmihealth.org/media/attachments/2025/08/08/marshall_islands_2021_census_vol1_table_report.pdf) | census affiliation | **atoll/island** (25 rows, 16 categories); reconciles exactly | 2021 | PDF text table | open | SPC/EPPSO partial-reproduction with acknowledgement (verbatim in probe) |
| [RMI 2011 Census Report](https://www.spc.int/digitallibrary/get/c3a4q); [2011 Summary](https://www.doi.gov/sites/doi.gov/files/uploads/RMI-2011-Census-Summary-Report-on-Population-and-Housing.pdf) | census affiliation | **none published** — religion collected (P6) but not tabulated | 2011 | — | HOLD ([PDH microdata catalog/22](https://microdata.pacificdata.org/index.php/catalog/22), licensed) | PDH licensed |
| [RMI Census Report 1999, Table 11](https://www.spc.int/digitallibrary/get/84t9p) | census affiliation | 3 sectors (urban Majuro, urban Ebeye, rural); image-only | 1999 | PDF image | national/sector only | SPC partial-reproduction with acknowledgement |

## Boundaries

- Official boundary files: geoBoundaries MHL ADM1 (24 units = atolls, ODbL 1.0, OSM/Wambacher 2017). Verified: joins the 2021 census roster one-to-one by name minus Bikini (census pop 0, no polygon). No antimeridian issue (160.9–172.2 E).
- The queue's ADM1 boundary recommendation is confirmed correct (unlike Kiribati, where ADM1 was the wrong level).

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): public Overpass queries timed out; rerun before build.
- Country registers to survey: United Church of Christ-Congregational, Catholic mission records, and Marshall Islands National Archives.

## First visualisation

Religious-affiliation by atoll/island for 2021 (single wave, Table 9), 24 atolls on geoBoundaries MHL ADM1, with an optional national 1999→2021 percentage context strip. Not a change series — 2011 and 1999 atoll waves are unavailable.

## Build recipe

1. Extract: use PDH variables to locate religion fields, then extract atoll or island tables from 2021 and 2011 reports.
2. Governed product: create `area_summary` rows by atoll or island and wave.
3. Boundaries: download geoBoundaries MHL ADM1 and join on atoll names.
4. Region page: add `REGION_CONFIG` after join verification.
5. Verification: test atoll totals against report population totals and record suppressed cells.

## Risks and open questions

- Single wave only: the atoll religion route exists for 2021 alone. No atoll-level change series.
- 2011 religion is held to licensed PDH microdata (never tabulated publicly); 1999 is 3-sector and image-only.
- Small atoll counts may require grouping for publication; Bikini (pop 0) has no boundary polygon.
- Licence: SPC/EPPSO partial-reproduction clause is explicit but needs a PI ruling to confirm it covers derived summaries.

## Deep-history potential

United Church of Christ-Congregational, Catholic, German, Japanese, and Trust Territory records can document older sites. Marshall Islands National Archives and Micronesian Seminar collections are priority sources.
