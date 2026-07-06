# Country data map: Wallis and Futuna (WF)

## Status

- **Tier**: C (documented exclusion)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [INSEE Wallis and Futuna census profile](https://www.insee.fr/fr/statistiques/8272934) | census population tables; no public religion table located | island, district, or village for population, none for religion | 2013, 2018, 2023 | web, PDF | open | INSEE terms |
| [STSEE Wallis and Futuna documents portal](https://www.statistique.wf/) | territorial statistics and census documents | population geography only | current and historical | web, PDF | open | STSEE terms; confirm reuse |

## Boundaries

- Official boundary files: no geoBoundaries WLF ADM1 endpoint was available in the sweep; official island, district, or village boundaries need a separate source.
- Boundaries are secondary until a religion source is found.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): public Overpass queries timed out; rerun before any site-layer work.
- Country registers to survey: Catholic Diocese of Wallis et Futuna, parish records, and territorial archives.

## First visualisation

No census religion map is recommended. A site-history layer may be feasible from parish and mission records.

## Build recipe

1. Extract: no `area_summary` build until a public subnational religion source is found.
2. Governed product: keep parish records as site evidence. Do not treat them as population affiliation.
3. Boundaries: locate official village or district boundaries only if a valid affiliation source appears.
4. Region page: do not add `REGION_CONFIG` for religion.
5. Verification: record any future church membership or parish count source as its own construct.

## Risks and open questions

- The census source path exposes population, language, and demographic tables, but no religion cross-tab was located.
- Near-universal Catholic affiliation in secondary accounts is not enough for a subnational longitudinal map.

## Deep-history potential

Catholic diocesan, Marist mission, territorial, and French overseas archive records can support historic site evidence, especially for parish founding and relocation.
