# Country data map: North Macedonia (MK)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [MAKSTAT database](https://makstat.stat.gov.mk/PXWeb/pxweb/en/MakStat/) | census religious affiliation | municipality | 2021 | PxWeb/API/export | open | State Statistical Office terms |
| [State Statistical Office Census 2021 publications](https://www.stat.gov.mk/PrikaziPublikacija_en.aspx?id=76&rbr=866) | census religious affiliation | municipality | 2021 | PDF/XLS | open | State Statistical Office terms |
| [State Statistical Office 2002 census material](https://www.stat.gov.mk/) | census religious affiliation | municipality | 2002 | PDF/XLS | open | State Statistical Office terms |

## Boundaries

- Official boundary files: State Statistical Office/Agency for Real Estate Cadastre municipal boundaries; geoBoundaries ADM1/ADM2 is a fallback.
- Boundary changes between waves and the harmonisation plan: anchor on 2021 municipalities and build a 2002 concordance for municipal reforms.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): Overpass count did not complete reliably in this sweep.
- Country-specific registers that could seed or verify the layer: Macedonian Orthodox dioceses, Islamic Religious Community, Catholic and Protestant directories, Jewish community records.

## First visualisation

Religious-affiliation share by municipality, 2002 and 2021, once the exact MAKSTAT table route is verified.

## Build recipe

1. Extract: MAKSTAT Census 2021 resident population by religious affiliation and municipality.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`.
3. Boundaries: 2021 municipality polygons from official cadastre/statistical sources or geoBoundaries.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: reconcile municipality totals to State Statistical Office 2021 national religion totals.

## Risks and open questions

- The exact MAKSTAT table route needs direct export before promotion to tier A.
- The 2021 census has boycott and administrative-source categories that need explicit display.
- Municipality reforms between 2002 and 2021 require concordance.

## Deep-history potential

Orthodox, Islamic, Catholic, and Jewish archives; Ottoman defters; Yugoslav census volumes; monastery records around Ohrid and Skopje; municipal heritage records.
