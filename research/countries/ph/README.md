# Country data map: Philippines (PH)

## Status

- **Tier**: B
- **Build state**: Surveyed; 2020 province/HUC tables are open, while earlier waves need extraction and category reconciliation.
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [PSA 2020 religious affiliation release](https://psa.gov.ph/content/religious-affiliation-philippines-2020-census-population-and-housing) | Census religious affiliation | Province and highly urbanised city | 2020 | Web release plus spreadsheet | Open download | PSA public domain notice applies on release page |
| [PSA 2020 statistical tables spreadsheet](https://psa.gov.ph/system/files/phcd/3_Statistical%20Table%20for%20Religious%20Affiliation%20%28for%20Posting%29_RML_12082022_PMMJ_CRD_1.xlsx) | Census religious affiliation | Province and highly urbanised city | 2020 | XLSX | Open download | PSA public domain notice applies on release page |
| [Philippine Statistics Authority](https://psa.gov.ph/) | Historical census releases and statistical tables | Province/HUC where released | 2010, 2015, 2020; older census series require recovery | Web/PDF/XLSX | Open web | PSA public statistics; confirm table-level terms |

## Boundaries

| Source | Unit | Match note |
| --- | --- | --- |
| [geoBoundaries PHL ADM2](https://www.geoboundaries.org/api/current/gbOpen/PHL/ADM2/) | Province and equivalent | Treat highly urbanised cities separately where PSA tables do. |

## Places-of-worship layer

| Source | Role | Note |
| --- | --- | --- |
| [OpenStreetMap](https://www.openstreetmap.org) | Candidate site layer | OSM coverage was not counted in this source sweep. First build should compare Catholic, Islamic, Iglesia ni Cristo, and smaller-denomination tagging practices. |

## First visualisation

Map 2020 province/HUC religious-affiliation shares and flag regions where HUC treatment affects denominators.

## Build recipe

Start with the PSA 2020 `Statistical Tables for Religious Affiliation` XLSX and geoBoundaries PHL ADM2. Add earlier waves only after table locations, categories, and HUC/province geography are reconciled.

## Risks and open questions

Local minority religion data can be sensitive in conflict-affected Mindanao and in small island communities. The main open question is whether 2010 and 2015 public tables can be recovered at the same geographic and category detail as 2020.

## Deep-history potential

High. Spanish colonial parish registers, National Archives of the Philippines holdings, 1903/1918/1939 census volumes, Catholic directories, Islamic institutional records, and National Historical Commission materials can support long-run affiliation and site histories.
