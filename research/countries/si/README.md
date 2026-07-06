# Country data map: Slovenia (SI)

## Status

- **Tier**: C (documented exclusion)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [Statistical Office of Slovenia SiStat](https://pxweb.stat.si/SiStat/en) | census religion | statistical region/municipality in 2002 tables | 1991, 2002 | PxWeb/table | open | SURS terms |
| [Slovenia census topic material](https://www.stat.si/StatWeb/en) | census religion | national/region, depending table | 2002; no comparable 2011/2021 census religion table found | web/PDF | open | SURS terms |

## Boundaries

- Official boundary files: Slovenian administrative units from national geodata; GISCO LAU can support municipality joins.
- Boundary changes between waves and the harmonisation plan: no harmonised time series should be built until a post-2002 public religion source is confirmed.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): Overpass count did not complete reliably in this sweep.
- Country-specific registers that could seed or verify the layer: Catholic parish directories, Evangelical Church records, Islamic Community of Slovenia, Jewish community records, cultural-heritage register.

## First visualisation

A first population-religion visualisation is not recommended yet; a 2002-only map would serve as historical context rather than a time series.

## Build recipe

1. Extract: no governed time-series build until a comparable post-2002 subnational religion table is identified.
2. Governed product: defer `area_summary`.
3. Boundaries: prepare GISCO LAU only if a source is promoted.
4. Region page: defer.
5. Verification: confirm whether registry-based censuses omitted religion after 2002.

## Risks and open questions

- The public census religion route appears to stop at 2002.
- Survey estimates are not a small-area census substitute.

## Deep-history potential

Archdiocesan and parish archives, Protestant records in Prekmurje, Jewish community records, Austro-Hungarian parish registers, and Slovenian regional archives.
