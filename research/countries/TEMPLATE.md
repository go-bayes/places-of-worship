# Country data map: {Country name} ({ISO2})

One page per country, one consistent structure. This card is the single
place a reader checks to learn whether a country data map is feasible,
what it would show, and what building it requires. Update the card when
sources are verified or the build advances; record status honestly.

## Status

- **Tier**: A (buildable now) / B (feasible with extraction work) / C (documented exclusion)
- **Build state**: not started / survey verified / data extracted / map live
- **Last verified**: YYYY-MM-DD

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| {Statistical office census table} | affiliation | {district} | {2001, 2011, 2021} | {CSV/API/PDF} | {open} | {licence} |

Constructs are not interchangeable: census affiliation, church membership,
attendance counts, adherents, and congregation directories measure
different things. Name the construct for every source and never merge
constructs in one map layer.

## Boundaries

- Official boundary files: {source, licence} or geoBoundaries ADM{n}.
- Boundary changes between waves and the harmonisation plan (which wave's
  boundaries anchor the time series; concordance source).

## Places-of-worship layer

- OSM coverage assessment ({date}): {count} tagged places; known gaps.
- Country-specific registers that could seed or verify the layer.

## First visualisation

The one map product to build first, stated concretely: metric,
geography, years. Example: "religious-affiliation percent by district,
censuses 2001–2021, on 2021 boundaries".

## Build recipe

1. Extract: {script or manual step, with provenance recording}.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`,
   with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: {file, simplification, join key}.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: totals cross-check, join coverage, licence and
   attribution strings.

## Risks and open questions

- {comparability breaks, suppression rules, sensitivity, access risk}

## Deep-history potential

Sources for historic places of faith (registers, archives, newspapers),
with period covered and digitisation state. Leave empty until surveyed;
do not speculate.
