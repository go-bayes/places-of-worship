# Country data map: Ireland (IE)

## Status

- **Tier**: A (buildable now)
- **Build state**: survey verified
- **Last verified**: 2026-07-07; verification URLs:
  <https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/F5051/CSV/1.0/en>
  and
  <https://www.cso.ie/en/census/censusvolumes1926to1991/historicalreports/census1926reports/census1926volume3-religionandbirthplaces/>

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| Central Statistics Office (CSO), PxStat table `F5051`, population usually resident and present in the State by religion, sex, census year, and county and city | census religious affiliation | county and city | 2011, 2016, 2022 | CSV API | open | CSO copyright and re-use policy; attribute CSO |
| CSO, Census 2022 Profile 5 interactive census map | census religious affiliation | Small Area for 2022 exploration | 2022 | web app and table export route | open | CSO copyright and re-use policy; attribute CSO |
| CSO, Census 1926 Volume 3, Table 09, counties 1861-1926 | census religious affiliation | county and county borough | 1861, 1871, 1881, 1891, 1901, 1911, 1926 | PDF tables | open | historical CSO reporting; confirm re-use per volume |

## Boundaries

- Official boundary files: Tailte Eireann and CSO national statistical
  boundaries for counties, cities, and Small Areas; use official 2022
  statistical boundaries where possible.
- Anchor the first build on county and city geography because `F5051` and the
  1861-1926 county table share that level. Small Area output can follow as a
  2022-only detail layer.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not yet run for this survey card.
- Country-specific registers: National Inventory of Architectural Heritage,
  Historic Environment Viewer, National Library parish registers, Catholic
  Parish Registers at the National Library of Ireland, Representative Church
  Body Library, Methodist Historical Society, Presbyterian Historical Society
  of Ireland, local authority heritage records, Irish Newspaper Archives.

## First visualisation

Religious-affiliation percent by county and city, censuses 1861-2022,
with the modern `F5051` series and CSO 1926 Volume 3 Table 09 as the first
long-run comparison.

## Build recipe

1. Extract: start with CSO PxStat table `F5051` CSV API for 2011, 2016,
   and 2022; extract CSO 1926 Volume 3 Table 09 from PDF for 1861-1926.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`,
   with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: join county and city records to official 2022 county or city
   boundaries; document any historical county-borough recoding.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: compare county sums with CSO state totals, verify join
   coverage, and record CSO attribution.

## Risks and open questions

- The 1861-1926 county series covers the state area reported in 1926. The
  1926 reporting geography differs from a present-day all-island geography.
- County-borough and city definitions need an explicit concordance before a
  single long-run geometry is published.
- Religion categories change over time; the first map should use broad,
  well-documented categories and keep raw source labels.

## Deep-history potential

CSO historical census volumes provide the deepest area-level religion series:
county religion counts from 1861 to 1926. Site-level reconstruction can draw
on National Library parish registers, Church of Ireland parish records,
Presbyterian and Methodist archives, Ordnance Survey maps, Griffith's
Valuation, newspapers, diocesan directories, local histories, and county
heritage inventories.
