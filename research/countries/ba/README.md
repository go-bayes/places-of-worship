# Country data map: Bosnia and Herzegovina (BA)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [Agency for Statistics 2013 Census final results](https://www.popis.gov.ba/popis2013/knjige.php?id=0) | census religion | municipality | 2013 | PDF/XLS/PDF tables | open | Agency terms |
| [Agency publication: Ethnicity, religion and mother tongue](https://bhas.gov.ba/) | census religion | municipality | 2013 | PDF | open | Agency terms |
| [1991 census municipal tables](https://fzs.ba/) | census/ethno-religious affiliation proxy | municipality | 1991 | PDF/scans/tables | open but dispersed | Statistics agency terms |

## Boundaries

- Official boundary files: entity and municipal boundaries from national/entity geodata; geoBoundaries ADM2 is a fallback.
- Boundary changes between waves and the harmonisation plan: 1991 and 2013 boundaries are not directly comparable after war and entity boundary changes; build a documented concordance before time-series use.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): Overpass count did not complete reliably in this sweep.
- Country-specific registers that could seed or verify the layer: Islamic Community, Serbian Orthodox eparchies, Catholic dioceses, Jewish community, Commission to Preserve National Monuments.

## First visualisation

2013 census religion by municipality, with 1991 shown only after a boundary and construct note is in place.

## Build recipe

1. Extract: 2013 final-results religion table by municipality from the Agency PDF/XLS files.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`.
3. Boundaries: 2013 municipality polygons from official or geoBoundaries sources.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: reconcile municipality totals to 2013 national religion totals and document Republika Srpska objections to final census treatment.

## Risks and open questions

- Only one post-war census is available.
- The 2013 census is politically contested.
- 1991-2013 comparison is useful but not a simple boundary time series.

## Deep-history potential

Islamic Community archives, Catholic and Orthodox parish registers, Jewish community archives, Ottoman defters, Austro-Hungarian cadastral and census material, and war-damage heritage documentation.
