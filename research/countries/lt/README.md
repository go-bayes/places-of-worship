# Country data map: Lithuania (LT)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [Statistics Lithuania Official Statistics Portal](https://osp.stat.gov.lt/statistiniu-rodikliu-analize#/) | census religious community indicated | municipality | 2021 | web/API/export | open | Official Statistics Portal terms |
| [Statistics Lithuania census releases](https://osp.stat.gov.lt/gyventoju-ir-bustu-surasymai1) | census religious community indicated | municipality | 2001, 2011, 2021 | web/XLSX/PDF | open | Official Statistics Portal terms |

## Boundaries

- Official boundary files: Lithuanian administrative boundaries from national geodata; GISCO LAU can support municipality joins.
- Boundary changes between waves and the harmonisation plan: anchor on 2021 municipalities and use official municipality codes for 2001 and 2011 harmonisation.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): Overpass count did not complete reliably in this sweep.
- Country-specific registers that could seed or verify the layer: Catholic diocesan parish lists, Orthodox and Old Believer parishes, Lutheran/Reformed churches, Jewish community records, cultural heritage register.

## First visualisation

Religious-community affiliation by municipality, 2001, 2011, and 2021, once the exact Official Statistics Portal indicator route is verified.

## Build recipe

1. Extract: OSP indicator for population by religious community indicated and municipality, 2021, then the matching 2001 and 2011 tables.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`.
3. Boundaries: GISCO LAU or official Lithuanian municipality polygons.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: reconcile municipality totals to OSP national religious-community totals.

## Risks and open questions

- The exact Official Statistics Portal indicator route needs direct export before promotion to tier A.
- The 2021 religion measure was collected through a statistical study linked to the electronic census; document the universe.
- Small religious minorities may have suppression or sampling uncertainty.

## Deep-history potential

Lithuanian Central State Archives, Catholic parish registers, Jewish community and YIVO-related archives, Karaite and Tatar community records, Lutheran/Reformed records, and interwar census volumes.
