# Country data map: South Korea (KR)

## Status

- **Tier**: A
- **Build state**: map built for KOSIS census religion, 2005 and 2015
- **Last verified**: 2026-07-09

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [KOSIS Korean Statistical Information Service](https://kosis.kr/) table `DT_1IN0505` | census religion by person | si/gun/gu | 2005 | Mass CSV ZIP | Open web table and mass-download route | KOGL Type 1 attribution |
| [KOSIS Korean Statistical Information Service](https://kosis.kr/) table `DT_1PM1502` | census religion by person | si/gun/gu | 2015 | Mass CSV ZIP | Open web table and mass-download route | KOGL Type 1 attribution |
| [KOSIS Korean Statistical Information Service](https://kosis.kr/) table `DT_1IN9506` | census religion by person | municipal and province rows | 1995 | Mass CSV ZIP | Open web table and mass-download route | KOGL Type 1 attribution |
| [KOSIS Korean Statistical Information Service](https://kosis.kr/) table `DT_1IN8505` | census religion by person | sido | 1985 | Web table | Open web table; no no-key mass CSV found in this build | KOGL Type 1 attribution |

The built map uses the 2005 and 2015 si/gun/gu tables. The 2015 religion item came from the 20% sample survey of the register-based census; the map therefore does not calculate a change layer.

## Access the data yourself

This project does not redistribute source data. The map shows derived rates with attribution. To obtain the data from the source of record:

- **Source of record**: [KOSIS](https://kosis.kr/), Population Census religion tables.
- **Exact tables**: `DT_1IN0505` (2005), `DT_1PM1502` (2015), `DT_1IN9506` (1995, deferred), and `DT_1IN8505` (1985, deferred).
- **Licence**: KOGL Type 1 attribution is recorded for KOSIS and KoStat-derived inputs.
- **Our extraction script**: `scripts/build_kr_area_summary.R`.
- **Retrieval recipe and hashes**: `docs/manifests/kr-census-religion-2005-2015.json`.

## Boundaries

- The boundary layer starts from `skorea-municipalities-2018-geo.json` in the [southkorea-maps](https://github.com/southkorea/southkorea-maps) KoStat-derived files.
- The builder dissolves selected 2018 district geometries to parent-city reporting units and aggregates documented 2005 predecessor codes for Sejong, Yeoju, Cheongju, Gyeryong, Dangjin, Changwon, and Jeju.
- The boundary product path is `apps/regions/kr/data/kr_si_gun_gu_2018_harmonised.geojson`.

## Places-of-worship layer

| Source | Role | Note |
| --- | --- | --- |
| [OpenStreetMap](https://www.openstreetmap.org) | Candidate site layer | OSM coverage was not counted in this build. Church and temple tagging should be compared with local official or denominational directories before a governed place layer is added. |

## First visualisation

The first visualisation maps religious-affiliation percent and no-religion percent by harmonised si/gun/gu, 2005 and 2015, using KOSIS table totals as denominators.

## Built Map

- **App route**: `apps/regions/kr/index.html`
- **Product paths**: `apps/regions/kr/data/area_summary_si_gun_gu.json`, `apps/regions/kr/data/area_summary_si_gun_gu.csv`, and `apps/regions/kr/data/kr_si_gun_gu_2018_harmonised.geojson`
- **Script**: `scripts/build_kr_area_summary.R`
- **Manifest**: `docs/manifests/kr-census-religion-2005-2015.json`
- **Waves**: 2005 and 2015
- **Denominator statement**: 2005 uses KOSIS `내국인 (명)`, including `미상`; 2015 uses KOSIS `계` from the 20% sample survey of the register-based census.
- **Boundary basis**: 229 harmonised si/gun/gu units from a 2018 KoStat-derived municipality file.

## Build recipe

1. Extract the KOSIS mass CSV ZIPs for `DT_1IN0505` and `DT_1PM1502` into `data/raw/kr_census/`.
2. Build `area_summary` from the source totals, summing named religion categories for religious affiliation and using the source no-religion category directly.
3. Dissolve 2018 KoStat-derived municipality geometries to the harmonised reporting units used by the public product.
4. Run `Rscript scripts/build_kr_area_summary.R` from the repository root.
5. Confirm exact national reconciliation, full join coverage, a boundary under 3 MB, and manifest JSON validity.

## Risks and open questions

- The 1985 table is pinned as `DT_1IN8505`, but no no-key mass CSV was available during this build. A reproducible session-backed export is still needed.
- The 1995 mass CSV is pinned as `DT_1IN9506`, but the pre-2005 administrative-code history needs a separate concordance before public mapping.
- The 2015 sample-survey basis differs from the 2005 full-count basis. The built page therefore omits religious change.
- The harmonised 2005 rows use documented predecessor-code aggregations. Sejong is flagged because the 2012 boundary does not map cleanly to a single 2005 source unit.

## Deep-history potential

High. Statistics Korea census tables, National Archives of Korea holdings, Japanese colonial census materials, Buddhist order records, Protestant and Catholic directories, and local government cultural-heritage registers can support deeper histories.
