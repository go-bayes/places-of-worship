# Country data map: French Polynesia (PF)

## Status

- **Tier**: C (documented exclusion)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [ISPF 2022 geographic census profiles](https://www.ispf.pf/fiche-geo/Polyn%C3%A9sie%20fran%C3%A7aise) | census population tables; no public religion table located | commune or island group for population, none for religion | 2022 | web, PDF, Excel | open | ISPF terms; confirm reuse |
| [ISPF population statistics portal](https://www.ispf.pf/) | population and demographic statistics | population geography only | current | web | open | ISPF terms; confirm reuse |

## Boundaries

- Official boundary files: no geoBoundaries PYF ADM1 endpoint was available in the sweep; French or Polynesian official commune files may be usable.
- Boundaries should wait until a valid religion source exists.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): public Overpass queries timed out; rerun before any site-layer work.
- Country registers to survey: Maohi Protestant Church, Catholic Archdiocese of Papeete, Diocese of Taiohae, and Archives de la Polynesie francaise.

## First visualisation

No census religion map is recommended. A later site-only map could use church and congregation directories as institutional data.

## Build recipe

1. Extract: no `area_summary` build until a public subnational religion source is found.
2. Governed product: keep church-directory data separate from census affiliation.
3. Boundaries: locate official commune boundaries only if a population-affiliation source appears.
4. Region page: do not add `REGION_CONFIG` for religion.
5. Verification: document any future survey or church membership source as a distinct construct.

## Risks and open questions

- The public census portals located in the sweep did not expose religion.
- Denominational directories may be useful for places, but they cannot stand in for population affiliation.

## Deep-history potential

Maohi Protestant, Catholic, LMS, and colonial records can support historic site histories. Archives de la Polynesie francaise and Catholic diocesan archives are priority routes.
