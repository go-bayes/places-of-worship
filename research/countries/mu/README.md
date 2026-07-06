# Country data map: Mauritius (MU)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| Statistics Mauritius 2022 Population Census main results, https://statsmauritius.govmu.org/Pages/Censuses%20and%20Surveys/Census/census_2022.aspx | census affiliation | national confirmed; district table not verified in this sweep | 2022 | PDF/web table | open web | licence not stated |
| Statistics Mauritius resident population by religion and sex, https://statsmauritius.govmu.org/ | census affiliation | national; possible district table to verify | 2011, 2022; historical national series back to nineteenth-century censuses | web table/PDF | open web | licence not stated |

Constructs are not interchangeable: census affiliation, ethnic identity, and congregation registers must stay separate.

## Boundaries

- Official boundary files: geoBoundaries ADM1 districts and outer islands, 2017, ODbL.
- Boundary changes between waves and the harmonisation plan: verify district religion tables before using ADM1 boundaries.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not counted during this source sweep; run ohsome or Overpass before build.
- Country-specific registers that could seed or verify the layer: Diocese of Port-Louis, Council of Religions Mauritius, Mauritius Sanatan Dharma Temples Federation, Jummah Mosque and other mosque directories.

## First visualisation

If district tables are public, census religious-affiliation percent by district, 2011 and 2022; otherwise a national trend note only.

## Build recipe

1. Extract: obtain the 2022 resident population by religion table and test whether district rows are exposed.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`, with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: geoBoundaries `MUS ADM1`, joined to district and outer-island names.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md` only if subnational rows are public.
5. Verification: reconcile national totals, join coverage, licence and attribution strings.

## Risks and open questions

- Public search confirmed national religion tables, but not district religion tables.
- The 1982 constitutional change ended ethnic census tables; religion remains separate and should not be used as an ethnic proxy.

## Deep-history potential

National Archives of Mauritius, Diocese of Port-Louis archives, Anglican and Presbyterian archives, Indian indenture records, mosque and temple committee records, and colonial newspapers.
