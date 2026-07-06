# Country data map: Fiji (FJ)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [Fiji Bureau of Statistics 2007 province religion table](https://www.statsfiji.gov.fj/download/117/01_province-of-enumeration/686/03_relationship-ethnicity-and-religion-by_province-of-enumeration_fiji-2007.pdf) | census affiliation | province | 2007 | PDF | open | website terms; confirm reuse |
| [PDH Fiji 2007 Population and Housing Census](https://microdata.pacificdata.org/index.php/catalog/241) | census affiliation metadata | record-level metadata; public table at province above | 2007 | metadata | open metadata; data access varies | PDH terms |
| [PDH Fiji 1996 Population and Housing Census](https://microdata.pacificdata.org/index.php/catalog/237) | census affiliation metadata | record-level metadata; public subnational table not verified | 1996 | metadata | open metadata; data access varies | PDH terms |

## Boundaries

- Official boundary files: geoBoundaries FJI ADM1 can anchor province maps.
- Harmonise to current provinces first; record any province-boundary or name changes before comparing 1996, 2007, and 2017 claims.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): 319 tagged places returned by Overpass; Christian and Hindu sites need separate completeness review.
- Country registers to survey: Methodist Church of Fiji and Rotuma, Catholic Archdiocese of Suva, Anglican Diocese of Polynesia, and Fiji National Archives.

## First visualisation

Religious-affiliation percent by province for 2007, with 1996 and 2017 added only after the matching public tables are located or extracted.

## Build recipe

1. Extract: parse the 2007 province PDF table and preserve Fiji Bureau of Statistics page and download URLs in provenance.
2. Governed product: create `area_summary` rows per `schemas/area_summary.schema.json`, with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: download geoBoundaries FJI ADM1 and join on province names after normalisation.
4. Region page: add `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: test province totals, join coverage, and attribution wording against the source PDF.

## Risks and open questions

- The 2017 religion table was not found at province level in the public source sweep.
- PDF extraction can blur denomination labels; keep the census labels unchanged until a harmonisation table is reviewed.

## Deep-history potential

Methodist, Catholic, Anglican, and Hindu temple records can support pre-census site histories. Fiji National Archives and mission yearbooks are likely sources for establishment, relocation, and closure evidence.
