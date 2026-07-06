# Country data map: New Caledonia (NC)

## Status

- **Tier**: C (documented exclusion)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [ISEE New Caledonia census portal](https://www.isee.nc/population/recensement) | census population tables; no public religion table located | commune or province for population, none for religion | 2009, 2014, 2019 | web, PDF, table downloads | open | ISEE terms; confirm reuse |
| [INSEE New Caledonia 2009 census publication](https://www.insee.fr/fr/statistiques/1281138) | census population publication; no public religion table located | province and commune for population, none for religion | 2009 | web | open | INSEE terms |

## Boundaries

- Official boundary files: no geoBoundaries NCL ADM1 endpoint was available in the sweep; French or New Caledonian official commune/province files may be usable.
- Boundaries are not the blocking issue; the religion construct is absent from the public census route.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): public Overpass queries timed out; rerun before any site-layer work.
- Country registers to survey: Catholic Archdiocese of Noumea, Protestant churches, mosque and temple directories, and Archives de la Nouvelle-Caledonie.

## First visualisation

No census religion map is recommended. A future site-only layer could use congregation directories with clear separation from population affiliation.

## Build recipe

1. Extract: no `area_summary` build until a public subnational religion table is found.
2. Governed product: do not infer affiliation from church directories.
3. Boundaries: locate official commune or province boundaries only if a valid population-affiliation source appears.
4. Region page: do not add `REGION_CONFIG` for religion.
5. Verification: document any future non-census affiliation source as a separate construct.

## Risks and open questions

- The public census route appears population-focused, with no religion cross-tab located.
- Church directories would measure sites or institutions. They would not measure population affiliation.

## Deep-history potential

Catholic, Protestant, colonial, and mission records can support historic place-of-worship evidence. Archives de la Nouvelle-Caledonie and Mission de Paris collections are priority sources.
