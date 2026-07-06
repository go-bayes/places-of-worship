# Country data map: Brazil (BR)

## Status

- **Tier**: A (buildable now)
- **Build state**: survey verified
- **Last verified**: 2026-07-07; verified SIDRA table 137, SIDRA table 9537, and geoBoundaries BRA ADM2:
  <https://servicodados.ibge.gov.br/api/v3/agregados/137/metadados>,
  <https://servicodados.ibge.gov.br/api/v3/agregados/9537/metadados>,
  <https://www.geoboundaries.org/api/current/gbOpen/BRA/ADM2/>.

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| IBGE SIDRA table 137 metadata, <https://servicodados.ibge.gov.br/api/v3/agregados/137/metadados> | census affiliation | municipality | 1991, 2000, 2010 | API | open | IBGE terms |
| IBGE SIDRA table 9537 metadata, <https://servicodados.ibge.gov.br/api/v3/agregados/9537/metadados> | census affiliation for people aged 10+ | municipality | 2022 | API | open | IBGE terms |

## Boundaries

- Official boundary files: IBGE municipal malhas; geoBoundaries ADM2 at <https://www.geoboundaries.org/api/current/gbOpen/BRA/ADM2/> is an open fallback.
- Anchor the first series on 2022 municipalities and use IBGE municipality codes with concordances for municipality splits and mergers.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not measured in this survey; run ohsome or Overpass by `amenity=place_of_worship` before build.
- Country-specific registers that could seed or verify the layer: Catholic diocesan parish lists, Conselho Nacional de Igrejas Cristas do Brasil member lists, evangelical denominational directories, and municipal heritage inventories.

## First visualisation

Religious-affiliation percent by municipality, 1991-2022, on 2022 municipal boundaries.

## Build recipe

1. Extract: pull SIDRA table 137 by `N6` municipality and religion classification, then pull table 9537 for 2022; batch requests to stay below SIDRA row limits and record URLs.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`, with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: use IBGE 2022 municipal malhas or geoBoundaries BRA ADM2, simplified for the web map and joined by IBGE municipality code.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: reconcile national totals, municipality join coverage, licence and attribution strings.

## Risks and open questions

- The 2022 table changes age universe to people aged 10+; label the series rather than silently merging constructs.
- Municipality boundary changes require a published concordance before long-run trend claims.

## Deep-history potential

Catholic diocesan archives, parish sacramental registers, IBGE historical municipality files, Arquivo Nacional, state public archives, mission society archives, and historical newspapers support site histories before modern censuses.
