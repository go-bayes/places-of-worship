# Country data map: Paraguay (PY)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| INE/DGEEC 2002 Census final table P11, <https://www.ine.gov.py/> | census affiliation for people aged 10+ | national and urban/rural in located table; department or district requires extraction | 2002 | PDF/web table | open | INE terms |
| DGEEC 1992 census religion tables, <https://www.ine.gov.py/> | census affiliation | unit to be confirmed | 1992 | legacy table/PDF | open | INE terms |

## Boundaries

- Official boundary files: INE administrative boundaries where available; geoBoundaries PRY ADM2 is a fallback.
- Anchor on 2002 departments or districts only after the public table geography is confirmed.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): not measured in this survey; run ohsome or Overpass before build.
- Country-specific registers that could seed or verify the layer: Catholic diocesan directories, Mennonite colony records, evangelical directories, and municipal heritage lists.

## First visualisation

Religious-affiliation percent by the smallest public 1992/2002 geography that can be extracted, with the geography named in the manifest.

## Build recipe

1. Extract: locate downloadable 1992 and 2002 religion tables from INE/DGEEC, then parse PDFs or web tables into structured rows.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`, with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: use official boundaries or geoBoundaries PRY ADM2 and join by published area code.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: reconcile totals to published census counts, join coverage, licence and attribution strings.

## Risks and open questions

- The 2022 census route reviewed did not show a religion wave.
- The public 2002 table located in the sweep may be national only; subnational release must be confirmed.

## Deep-history potential

Catholic diocesan archives, Jesuit mission records, Mennonite colony archives, Archivo Nacional de Asuncion, and historical newspapers support longer site histories.
