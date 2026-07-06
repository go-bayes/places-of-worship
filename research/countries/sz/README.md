# Country data map: Eswatini (SZ)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| DHS Program surveys API, https://api.dhsprogram.com/rest/dhs/surveys?countryIds=SZ&f=json, and dataset API, https://api.dhsprogram.com/rest/dhs/datasets?countryIds=SZ&f=json | respondent religious affiliation in DHS recodes; survey estimates | DHS region | 2006-07 | API metadata, PDF report, recode ZIPs | reports open; recodes require free DHS approval | DHS terms; cite DHS Program |
| Central Statistical Office 2017 Population and Housing Census releases, https://www.gov.sz/ | census affiliation to verify at subnational level | region if public | 2017 | PDF/report | open web where available | licence not stated |

Constructs are not interchangeable: census affiliation and DHS respondent affiliation must stay separate.

## Boundaries

- Official boundary files: geoBoundaries ADM1 regions, 2017, ODbL; ADM2 units, 2017, ODbL.
- Boundary changes between waves and the harmonisation plan: use the four regions unless the 2017 census exposes finer religion rows.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not counted during this source sweep; run ohsome or Overpass before build.
- Country-specific registers that could seed or verify the layer: Council of Eswatini Churches, Catholic Diocese of Manzini, Methodist Church in Eswatini, Eswatini Muslim community directories.

## First visualisation

If the 2017 census religion table is public by region, map census religious affiliation by region for 2017; otherwise use the 2006/07 DHS as a survey reference only.

## Build recipe

1. Extract: locate the 2017 census religion table and test whether region rows are public; do not build using only one DHS wave.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`, with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: geoBoundaries `SWZ ADM1` regions.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md` only if subnational religion rows are public.
5. Verification: reconcile national totals, join coverage, licence and attribution strings.

## Risks and open questions

- Only one DHS wave was found.
- The 2017 census source needs direct table verification before a map build.

## Deep-history potential

Eswatini National Archives, Methodist/Wesleyan Mission records, Anglican archives, Catholic mission records, Mahamba Methodist Mission material, and colonial Swaziland files.
