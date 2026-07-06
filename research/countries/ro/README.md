# Country data map: Romania (RO)

## Status

- **Tier**: A (buildable now)
- **Build state**: survey verified
- **Last verified**: 2026-07-07; tier-A verification: https://www.recensamantromania.ro/rezultate-rpl-2021/rezultate-definitive/

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [RPL 2021 final results, table 2.04](https://www.recensamantromania.ro/rezultate-rpl-2021/rezultate-definitive/) | census religion | municipality, town, commune | 2021 | XLSX | open | INS reuse terms |
| [RPL 2011 historical page](https://www.recensamantromania.ro/istoric/rpl-2011/) | census religion | locality/commune tables | 2011 | XLS/XLSX/PDF | open | INS reuse terms |
| [RPL 2002 historical page](https://www.recensamantromania.ro/istoric/rpl-2002/) | census religion | locality/commune tables | 2002 | XLS/PDF | open | INS reuse terms |

## Boundaries

- Official boundary files: Romanian administrative-territorial units from national geospatial sources; GISCO LAU is a practical first boundary source.
- Boundary changes between waves and the harmonisation plan: anchor on 2021 UAT boundaries and build a concordance for changed communes and towns.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): Overpass count did not complete reliably in this sweep.
- Country-specific registers that could seed or verify the layer: Secretariat of State for Religious Affairs denominations, Orthodox and Greek Catholic parish lists, Jewish and Muslim community directories.

## First visualisation

Religious-affiliation percent by municipality/town/commune, 2002-2021, on 2021 UAT boundaries.

## Build recipe

1. Extract: RPL 2021 `Tabel 2.04.1 si Tabel 2.04.2`, then match 2011 and 2002 religion tables.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`.
3. Boundaries: GISCO LAU 2021 or official UAT polygons, joined by SIRUTA where available.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: reconcile UAT totals to INS county and national religion totals.

## Risks and open questions

- Locality changes and SIRUTA code continuity need careful concordance work.
- The religion field measures self-declared affiliation rather than practice.
- Some minority categories may be suppressed or combined in small areas.

## Deep-history potential

County archives, Orthodox parish registers, Greek Catholic and Roman Catholic diocesan archives, Jewish community archives, Ottoman/Habsburg-era materials for border regions, and interwar census volumes.
