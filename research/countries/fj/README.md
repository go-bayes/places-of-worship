# Country data map: Fiji (FJ)

## Status

- **Tier**: A (buildable now)
- **Build state**: data extracted (2007 province wave staged; no page ships yet)
- **Last verified**: 2026-07-11

See `research/countries/fj/route-probe.md` for the full wave-by-wave route, reconciliation gates, boundary handling, and licence position.

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [Fiji Bureau of Statistics 2007 Table P01-3](https://www.statsfiji.gov.fj/download/117/01_province-of-enumeration/686/03_relationship-ethnicity-and-religion-by_province-of-enumeration_fiji-2007.pdf) | census affiliation | province | 2007 | PDF | open download | all rights reserved; no explicit reuse grant |
| [FBoS 2017 "Population by Major Religious Groups" ArcGIS experience](https://experience.arcgis.com/experience/fd6bb849099f46869125089fd13579ec/page/Population--by-Major-Religious-Groups) | census affiliation | province (dashboard) | 2017 | dashboard | view only | deferred; no reconcilable static table |
| [PDH Fiji 1996 Census catalogue 237](https://microdata.pacificdata.org/index.php/catalog/237) | census affiliation metadata | microdata metadata | 1996 | metadata | licensed microdata | deferred; no aggregate table pinned |

Constructs are not interchangeable. The shipped construct is census affiliation by province. The 2007 source also publishes religion-by-ethnicity tables; this product ships the all-ethnicity religion-by-province margin only, and the ethnicity dimension is out of scope.

## Access the data yourself

This project does not redistribute source data; the map shows derived rates with attribution. To obtain the data from the source of record:

- **Source of record**: Fiji Bureau of Statistics (https://www.statsfiji.gov.fj/).
- **Exact table**: 2007 Census Table P01-3, "Relationship, Ethnicity and Religion by Province of Enumeration"; the RELIGION section of the first, all-ethnicity table.
- **Licence**: the FBoS site asserts "All Rights Reserved" with no explicit reuse grant; the derived aggregate is used for research with attribution, claims no open-data licence, and stays staged with `licence_status: needs_review` until FBoS reuse terms are resolved.
- **Our extraction script**: `scripts/build_fj_area_summary.R`.
- **Retrieval recipe and hashes**: `docs/manifests/fj-census-religion-2007.json`.

## Boundaries

- Official boundary file: geoBoundaries FJI ADM2 (15 provinces; canonical "Provinces"; CC BY 4.0; source pacificdata.org 2007 Fiji PHC admin boundaries; boundary ID FJI-ADM2-14151628). geoBoundaries FJI ADM1 is the four divisions, not the province frame, and is not used.
- Fiji straddles the antimeridian: the boundary is simplified in a contiguous 0..360 frame, cut at lon 180, and the eastern pieces are shifted back, making every feature a valid MultiPolygon within [-180, 180] with no ring crossing the meridian. Area gates run in the Fiji Map Grid (EPSG:3460) in both frames, and a WGS84 gate tests validity, coordinate range, and the absence of dateline-crossing rings.
- The 15 census provinces join one-to-one, with one spelling alias (`Nadroga/Navosa` to `Nadroga-Navosa`).

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): 319 tagged places returned by Overpass; Christian and Hindu sites need separate completeness review. No place layer ships in the 2007 product.
- Country registers to survey: Methodist Church of Fiji and Rotuma, Catholic Archdiocese of Suva, Anglican Diocese of Polynesia, and Fiji National Archives.

## First visualisation

Religious-affiliation percent by province for 2007 (15 provinces), with 1996 and 2017 added only after reconcilable official province tables are recovered.

## Build recipe

1. Extract: `scripts/build_fj_area_summary.R` runs `pdftotext -layout` on the cached 2007 Table P01-3 PDF, isolates the first all-ethnicity table's RELIGION margin, and parses six top-level categories by 15 provinces.
2. Governed product: `apps/regions/fj/data/area_summary_province.{json,csv}` per `schemas/area_summary.schema.json`, with the manifest `docs/manifests/fj-census-religion-2007.json`.
3. Boundaries: geoBoundaries FJI ADM2, simplified via `scripts/lib/simplify_boundary.R`, joined on province name.
4. Region page: not built in this lane.
5. Verification: Christian sub-denomination reconciliation, 15-province local-to-national reconciliation, join coverage, geometry gates, and attribution wording against the source PDF.

## Risks and open questions

- The 2017 province religion table exists only as an ArcGIS dashboard; the 2017 General Tables print no religion table. Recovery needs the ArcGIS layer provenance/licence or a direct FBoS tabulation.
- The 1996 province religion table was not pinned as an official aggregate; only licensed microdata confirm the variable.
- The FBoS licence is a caution (all rights reserved, no explicit reuse grant); resolve reuse terms with FBoS before publishing.
- A small unprinted not-stated residual is retained in the denominator; the two headline shares therefore do not sum to 100%.

## Deep-history potential

Methodist, Catholic, Anglican, and Hindu temple records can support pre-census site histories. Fiji National Archives and mission yearbooks are likely sources for establishment, relocation, and closure evidence.
