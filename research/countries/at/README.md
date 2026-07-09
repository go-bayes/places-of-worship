# Country data map: Austria (AT)

## Status

- **Tier**: A (data product built)
- **Build state**: data product built; region page is a separate lane
- **Last verified**: 2026-07-10

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| Statistics Austria, *Population by religious denomination and Bundesland, 1951 to 2001* | self-declared religious affiliation in full-enumeration population censuses | Bundesland | 1951, 1961, 1971, 1981, 1991, 2001 | ODS | open web | Statistics Austria website reuse terms; attribution and adaptation notice required |
| Statistics Austria, *Religious affiliation of the Austrian population 2021 by Bundesland* | mixed total-population estimate based on a voluntary sample survey, child imputation, and an institutional-population estimate | Bundesland | 2021 | ODS | open web | Statistics Austria website reuse terms; attribution and adaptation notice required |

The two source designs measure religious affiliation but are not equivalent observations. The six historical waves are census self-declarations. The 2021 wave combines a voluntary Microcensus Labour Force Survey module for private-household residents aged 16+, parent-based imputation for children, and an estimate for the institutional population. Religion was absent from the 2021 register census.

## Access the data yourself

This project does not redistribute the source ODS files. The public product contains derived rates with attribution.

- **Source of record**: Statistics Austria religious-denomination page, <https://www.statistik.at/en/statistics/population-and-society/population/further-population-statistics/religious-denomination>.
- **Exact tables**: `neu__Religion__1_.ods`, sheet `A1`, and `neu__Religion_2021_Bundesland.ods`, sheet `Tabelle1`.
- **Main-site terms**: <https://www.statistik.at/en/about-us/responsibilities-and-principles/legal-basis/website-information>.
- **Open-data catalogue tested**: <https://data.statistik.gv.at/web/catalog.jsp>. The catalogue contained no religion dataset on 2026-07-10.
- **Licence**: the pinned main-site terms state:

  > If the contained material is accurately reproduced and the source “Statistics Austria” is quoted it is permitted to reproduce, distribute, make publicly available and process the content.

  Partial use or adaptation requires an extraction or adaptation note. The separate open.data CC BY 4.0 licence does not govern these main-site files.
- **Our extraction script**: `scripts/build_at_area_summary.R`.
- **Retrieval recipe and hashes**: `docs/manifests/at-religious-affiliation-1951-2021.json`.
- **Probe record**: `research/countries/at/wave-extension-probe.md`.

## Boundaries

- Boundary file: geoBoundaries gbOpen AUT ADM1, boundary year 2017, nine Bundesländer.
- Boundary licence: Creative Commons Attribution-ShareAlike 2.0; attribute geoBoundaries and the Austrian Federal Office for Metrology and Survey.
- Boundary stability: the nine-Bundesland frame supports every source wave without a concordance.
- Public output: `apps/regions/at/data/at_bundesland_2017.geojson`, simplified with the shared mapshaper helper.

## Places-of-worship layer

- OSM coverage assessment: not measured in this build. No governed Austria place layer or place-density metric ships with the product.
- Country-specific registers that could seed or verify the layer include church and religious-society directories, heritage inventories, and local archival registers. These sources have not been assessed.

## First visualisation

Built data product: religious-affiliation and no-religion percentages by Bundesland for 1951, 1961, 1971, 1981, 1991, 2001, and 2021. The map must mark 2021 as a mixed estimate and retain the official warning about small weighted estimates.

## Build recipe

1. Extract the two Statistics Austria ODS tables and use the underlying cell values rather than display-rounded text.
2. Derive religious affiliation as total population minus no religion and not stated for 1951-2001. For 2021, sum Christianity, Islam, and other religion; the weighting leaves no unknown category.
3. Write `apps/regions/at/data/area_summary_bundesland.{json,csv}` and `docs/manifests/at-religious-affiliation-1951-2021.json`.
4. Download geoBoundaries AUT ADM1, join on `AT-1` through `AT-9`, and simplify the nine-feature layer below 800 KB.
5. Verify nine matched areas in every wave and exact national reconciliation for total population, religious affiliation, no religion, and not stated.

The wave-by-wave reconciliation table is `apps/regions/at/data/national_reconciliation.csv`.

## Risks and open questions

- The 2021 source is a one-off voluntary sample survey supplemented by imputation and estimation. It carries sampling uncertainty and a source-design break from the six censuses.
- Statistics Austria warns: “Values with less than extrapolated 6 000 persons are highly subject to random fluctuations.”
- Census category detail changes across waves. `Sonstiges` includes Islam in 1951 and 1961. The public product therefore uses stable broad categories.
- The 2017 geoBoundaries source licence is CC BY-SA 2.0. A later official CC BY 4.0 Bundesland boundary could simplify downstream licensing.

## Deep-history potential

No deep-history source survey was conducted for this build.
