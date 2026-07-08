# Country data map: Portugal (PT)

## Status

- **Tier**: A
- **Build state**: map live
- **Last verified**: 2026-07-09

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [INE indicator 0011644](https://www.ine.pt/xportal/xmain?xpid=INE&xpgid=ine_indicadores&indOcorrCod=0011644&contexto=bd&selTab=tab2) | Census religion for residents aged 15 and over | Municipality | 2021 | JSON API | Open web | CC BY 4.0 with INE attribution |
| [INE indicator 0006396](https://www.ine.pt/xportal/xmain?xpid=INE&xpgid=ine_indicadores&indOcorrCod=0006396&contexto=bd&selTab=tab2) | Census religion for residents aged 15 and over | Municipality | 2011 | JSON API | Open web | CC BY 4.0 with INE attribution |

Constructs are not interchangeable: census affiliation, church membership,
attendance counts, adherents, and congregation directories measure different
things. The built map uses only the census religion construct.

## Access the data yourself

The Portugal country product does not redistribute source data; the map shows derived rates
with attribution. To obtain the data from the source of record:

- **Source of record**: Instituto Nacional de Estatística (INE), Portugal, through the [INE database API](https://www.ine.pt/xportal/xmain?xpid=INE&xpgid=ine_api_v2).
- **Exact tables**: `0011644`, "População residente com 15 e mais anos de idade (N.º) por Local de residência à data dos Censos [2021] (NUTS - 2013) e Religião; Decenal"; `0006396`, "População residente com 15 e mais anos de idade (N.º) por Local de residência (à data dos Censos 2011) e Religião; Decenal".
- **Licence**: INE states that statistical information on its portal is free and reusable under Creative Commons CC BY Atribuição 4.0 when the source is identified.
- **Our extraction script**: `scripts/build_pt_area_summary.R`.
- **Retrieval recipe and hashes**: `docs/manifests/pt-census-religion-2011-2021.json`.

## Boundaries

- Official boundary files: [Carta Administrativa Oficial de Portugal 2021](https://www.dgterritorio.gov.pt/atividades/cartografia/cartografia-tematica/caop), published by Direção-Geral do Território (DGT).
- Licence: DGT states that geographic downloads from its data centre use CC BY 4.0 with attribution to Direção-Geral do Território.
- Boundary basis: the build dissolves CAOP 2021 parish-level administrative-area polygons to the 308 municipality DICO codes and joins census rows on those DICO codes.

## Places-of-worship layer

- OSM coverage assessment: not yet counted for Portugal.
- Country-specific registers that could seed or verify the layer: diocesan parish directories, Islamic community lists, Jewish community records, Hindu and Buddhist community directories, municipal heritage inventories, and denominational registers.

## First visualisation

The first Portugal product is religious-affiliation percent and no-religion
percent by municipality for the 2011 and 2021 censuses, on CAOP 2021
municipality boundaries.

## Built Map

- App route: `apps/regions/pt/index.html`.
- Product paths: `apps/regions/pt/data/area_summary_municipality.json`, `apps/regions/pt/data/area_summary_municipality.csv`, and `apps/regions/pt/data/pt_municipality_caop2021.geojson`.
- Script: `scripts/build_pt_area_summary.R`.
- Manifest: `docs/manifests/pt-census-religion-2011-2021.json`.
- Waves: 2011 and 2021.
- Denominator: residents aged 15 and over with a stated religion/no-religion response. In 2011 this is `Total - Não resposta`; in 2021 this is `Total` because the API extract exposes no `Não resposta` category.
- Boundary basis: CAOP 2021 municipality boundaries dissolved from official parish-level administrative-area polygons.

## Build recipe

1. Extract INE API JSON for indicators `0006396` and `0011644`, including municipality rows and the Portugal national row for validation.
2. Build `area_summary` per `schemas/area_summary.schema.json`, with wave-specific formula notes in `population_total_basis`, indicator methods, quality flags, and manifest `construct_notes`.
3. Dissolve CAOP 2021 administrative-area polygons to municipality DICO codes, measure area in EPSG:3035, and simplify the output GeoJSON under 3 MB.
4. Configure the Portugal region page through `REGION_CONFIG`; do not add country logic to the shared map runtime.
5. Validate exact national reconciliation, 308/308 join coverage, 308 boundary features, and syntax-valid manifest JSON.

## Risks and open questions

- The 2021 API extract exposes no `Não resposta` category; the 2011 extract does. The build therefore uses the stated-response denominator in each wave, with the rule recorded row by row.
- Detailed religion categories changed between 2011 and 2021. The map sums all named religion categories into one broad religious-affiliation measure and does not crosswalk denominations.
- The INE database search did not expose stable municipality-level religion indicators for 1981, 1991, or 2001 during this build. Those waves remain deferred until exact official tables and a clean geography correspondence are pinned.
- Portugal has no governed places-of-worship snapshot in this repository yet.

## Deep-history potential

Historical census volumes, Arquivo Nacional da Torre do Tombo, diocesan
archives, parish registers, Jewish community records, mosque and temple
directories, municipal archives, and historic newspapers can support deeper
site histories.
