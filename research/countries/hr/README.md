# Country data map: Croatia (HR)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [Croatian Bureau of Statistics Census 2021](https://dzs.gov.hr/en) | census religious affiliation | town/municipality in published census tables | 2021 | web/XLSX/PDF | open | DZS terms |
| [DZS Census 2011 tables](https://web.dzs.hr/Eng/censuses/census2011/censuslogo.htm) | census religious affiliation | town/municipality | 2011 | HTML/XLS | open | DZS terms |
| [DZS Census 2001 tables](https://web.dzs.hr/Eng/censuses/Census2001/census.htm) | census religious affiliation | town/municipality | 2001 | HTML/XLS | open | DZS terms |

## Boundaries

- Official boundary files: Croatian administrative units from DGU/state geodata; GISCO LAU is a practical first source.
- Boundary changes between waves and the harmonisation plan: anchor on 2021 towns/municipalities and maintain a concordance for unit changes since 2001.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): Overpass count did not complete reliably in this sweep.
- Country-specific registers that could seed or verify the layer: Catholic diocesan parish lists, Serbian Orthodox eparchy directories, Islamic Community of Croatia, Jewish community records.

## First visualisation

Religious-affiliation share by town/municipality, 2001-2021, on 2021 local-government boundaries.

## Build recipe

1. Extract: DZS population by religion by towns/municipalities for 2021, 2011, and 2001.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`.
3. Boundaries: GISCO LAU or official Croatian town/municipality polygons.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: reconcile town/municipality totals to county and national DZS totals.

## Risks and open questions

- Current official table URLs need direct file download before promotion to tier A.
- Some 2001-2021 municipal boundary changes require concordance work.
- Religion and ethnicity are separate census constructs, although DZS also publishes cross-tabs.

## Deep-history potential

State Archives in Zagreb and regional archives, Catholic and Orthodox parish registers, Jewish community records, Ottoman/Habsburg records for border regions, and historical census volumes.
