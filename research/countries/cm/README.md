# Country data map: Cameroon (CM)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| DHS Program surveys API, https://api.dhsprogram.com/rest/dhs/surveys?countryIds=CM&f=json, and dataset API, https://api.dhsprogram.com/rest/dhs/datasets?countryIds=CM&f=json | respondent religious affiliation in DHS recodes; survey estimates | DHS region | 1991, 1998, 2004, 2011, 2018, 2022 MIS | API metadata, PDF reports, recode ZIPs | reports open; recodes require free DHS approval | DHS terms; cite DHS Program |
| BUCREP census releases, https://www.bucrep.cm/ | census population context; public religion table not verified in this sweep | region/department for population context | 2005; later census planning | PDF/web release | open web | licence not stated |

Constructs are not interchangeable: DHS respondent affiliation is a survey estimate and must stay separate from census population context.

## Boundaries

- Official boundary files: geoBoundaries ADM1 regions, 2016, CC BY 3.0; ADM2 departments, 2016, CC BY 4.0.
- Boundary changes between waves and the harmonisation plan: anchor on DHS regions and treat Anglophone/Francophone regional comparability explicitly.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not counted during this source sweep; run ohsome or Overpass before build.
- Country-specific registers that could seed or verify the layer: Council of Protestant Churches of Cameroon, Catholic dioceses, Islamic councils, Presbyterian Church in Cameroon archives.

## First visualisation

DHS survey-estimated respondent religious affiliation by region, 1991-2022, with uncertainty intervals.

## Build recipe

1. Extract weighted religion by DHS region from IR/MR recodes; preserve survey weights and standard errors.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`, with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: geoBoundaries `CMR ADM1`, joined to DHS region labels.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: compare weighted national totals with final-report totals, join coverage, licence and attribution strings.

## Risks and open questions

- Conflict-affected regions may have survey coverage gaps.
- MIS and DHS waves may not use identical religion coding.

## Deep-history potential

Archives nationales du Cameroun, Basel Mission archives, Pallottine Catholic mission records, Presbyterian Church archives, German colonial records, and mission school registers.
