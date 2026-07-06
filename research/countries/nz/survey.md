# Country data map: New Zealand (NZ)

## Status

- **Tier**: A (live pilot country)
- **Build state**: map live at territorial-authority and SA2 levels; README
  card is authoritative until the country survey is synthesised
- **Last verified**: 2026-07-07; verification URLs:
  <https://datainfoplus.stats.govt.nz/item/nz.govt.stats/f0032908-16db-40de-b543-a41ac1dda574>
  and <https://figure.nz/table/ITPm3h6kNu9LqEZt>

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| Stats NZ 2023 Census religious affiliation metadata | census religious affiliation, multiple response | SA2 in current live products | 2023 | metadata plus census data service route | open | Creative Commons Attribution 4.0 International where applied by Stats NZ |
| Figure.NZ table from Stats NZ, religious affiliation by territorial authority | census religious affiliation | territorial authority | 2013, 2018, 2023 | web table and CSV download | open | Creative Commons Attribution 4.0 International |
| Historical New Zealand census reports | census religious affiliation | varies by volume; likely province, county, borough, or colony-wide | 1850s onward | scanned reports/PDF | open or archive-dependent | confirm per source |

## Boundaries

- Official boundary files: Stats NZ Geographic Data Service and datafinder
  statistical boundaries, including territorial authority and SA2 boundaries,
  generally Creative Commons Attribution 4.0 International.
- The live pilot already uses territorial-authority and SA2 census
  boundaries for 2013, 2018, and 2023 overlays.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): live NZ map uses existing OSM-derived
  place layers, but this supplement does not rerun the count.
- Country-specific registers: Heritage New Zealand Pouhere Taonga New Zealand
  Heritage List / Rarangi Korero, Papers Past, denominational yearbooks and
  archives, diocesan records, local histories, Retrolens, LINZ and historical
  maps.

## First visualisation

Already live: census religious-affiliation overlays by territorial authority
and SA2 for 2013, 2018, and 2023.

## Build recipe

1. Extract: preserve the existing Stats NZ/Figure.NZ territorial-authority and
   SA2 workflow described by the live NZ map manifests.
2. Governed product: existing `area_summary` outputs and manifests remain the
   record for the live NZ map.
3. Boundaries: continue to use official Stats NZ territorial-authority and SA2
   boundaries with recorded vintages.
4. Region page: existing `apps/regions/nz/` configuration is already live.
5. Verification: compare area sums with Stats NZ totals, verify join coverage,
   and maintain Stats NZ/Figure.NZ attribution.

## Risks and open questions

- Religious affiliation allows multiple responses; percentages need a clear
  denominator rule.
- Historical census religion volumes need extraction and geography
  harmonisation before they can sit beside 2013-2023 SA2 overlays.

## Deep-history potential

New Zealand census religion reporting reaches into the nineteenth century,
though geography and population coverage changed substantially. Older
site-level reconstruction can use Papers Past, Heritage New Zealand Pouhere
Taonga records, denominational yearbooks, church archives, diocesan and parish
records, local histories, Retrolens, LINZ maps, and regional archives.
