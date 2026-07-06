# Country data map: Haiti (HT)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| DHS Haiti country portal, <https://dhsprogram.com/countries/Country-Main.cfm?ctry_id=18> | survey estimates | department, subject to sample design | 2005-2006, 2012, 2016-2017 | microdata, StatCompiler, reports | registration/open aggregate | DHS terms |
| IHSI census portal, <https://www.ihsi.gouv.ht/> | reviewed route did not show recent census religion | not applicable | latest census route unresolved | web/PDF | open where available | IHSI terms |

## Boundaries

- Official boundary files: CNIGS/IHSI administrative geography where available; geoBoundaries HTI ADM1 is a fallback for departments.
- Anchor any first product on departments because DHS precision is not a small-area census.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not measured in this survey; run ohsome or Overpass before build.
- Country-specific registers that could seed or verify the layer: Catholic diocesan directories, Protestant federation records, Vodou association records where public and appropriate, heritage inventories, and mission archives.

## First visualisation

Religious-affiliation survey estimates by department, DHS waves 2005-2017, clearly labelled as survey estimates.

## Build recipe

1. Extract: use DHS StatCompiler or approved microdata to tabulate religion by department and wave with survey weights.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`, with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: use CNIGS/IHSI or geoBoundaries HTI ADM1 and join by department name/code.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: reconcile weighted estimates to DHS reports, join coverage, licence and attribution strings.

## Risks and open questions

- DHS estimates are survey estimates rather than census counts. Display uncertainty.
- Vodou affiliation may be underreported or coded inconsistently across instruments.

## Deep-history potential

Catholic diocesan archives, parish registers, Vodou community histories where ethically available, Archives Nationales d'Haiti, mission archives, and historical newspapers support longer site histories.
