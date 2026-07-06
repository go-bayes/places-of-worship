# Country data map: Morocco (MA)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| DHS Program surveys API, https://api.dhsprogram.com/rest/dhs/surveys?countryIds=MA&f=json, and dataset API, https://api.dhsprogram.com/rest/dhs/datasets?countryIds=MA&f=json | respondent religious affiliation where recodes expose it; survey estimates | DHS region to verify | 1987, 1992, 2003-04 | API metadata, PDF reports, recode ZIPs | reports open; recodes require free DHS approval | DHS terms; cite DHS Program |
| Haut-Commissariat au Plan census releases, https://www.hcp.ma/ | census population context; public religion table not verified in this sweep | region/province for population context | 2004, 2014, 2024 | PDF/web release | open web | licence not stated |

Constructs are not interchangeable: DHS respondent affiliation, census population context, mosque records, and Jewish community records measure different things.

## Boundaries

- Official boundary files: geoBoundaries ADM1 regions, 2017, ODbL; ADM2 provinces/prefectures, 2017, ODbL.
- Boundary changes between waves and the harmonisation plan: use DHS regions only after confirming recode religion fields.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not counted during this source sweep; run ohsome or Overpass before build.
- Country-specific registers that could seed or verify the layer: Ministry of Habous and Islamic Affairs, Catholic Archdiocese of Rabat, Jewish community heritage registers, synagogue heritage inventories.

## First visualisation

A DHS-derived survey map by region may be feasible for 1987-2003/04 only after confirming the religion variable; no census-affiliation map was found.

## Build recipe

1. Extract: inspect DHS IR/MR dictionaries for religion variables and region labels.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`, with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: geoBoundaries `MAR ADM1`, joined to DHS region labels where valid.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md` only after sensitivity review.
5. Verification: compare weighted national totals with final-report totals, join coverage, licence and attribution strings.

## Risks and open questions

- The latest DHS wave is 2003-04; the source is stale.
- Official census religion tables were not found.

## Deep-history potential

Archives du Maroc, Ministry of Habous records, Alliance Israelite Universelle archives, Catholic mission archives, synagogue heritage records, and French Protectorate files.
