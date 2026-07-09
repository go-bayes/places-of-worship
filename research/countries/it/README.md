# Country data map: Italy (IT)

## Status

- **Tier**: A (practice product built)
- **Build state**: data product built; region page is a separate lane
- **Last verified**: 2026-07-09

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| Istat, *Aspetti della vita quotidiana* (AVQ), dataflow `83_63_DF_DCCV_AVQ_PERSONE_136`, "Religious observances - regions and type of municipality" | self-reported religious practice, measured as attendance frequency at a place of worship | region | 2001-2003 and 2005-2025 | SDMX CSV/API | open web, rate-limited | CC BY 4.0 unless otherwise stated; attribution "Istat" |
| Istat modern census outputs | no census religion question located for this product | not applicable | not applicable | not applicable | not applicable | not applicable |

Constructs are not interchangeable. Italy's built product is a survey estimate
of religious practice among residents aged 6 and over. Affiliation, doorway
counts, and Poland's dominicantes count are separate constructs.

## Access the data yourself

This project does not redistribute source data; the map shows derived rates
with attribution. To obtain the data from the source of record:

- **Source of record**: Istat IstatData / SDMX endpoint, <https://esploradati.istat.it/SDMXWS/rest>.
- **Exact tables**: dataflow `83_63_DF_DCCV_AVQ_PERSONE_136`, "Religious observances - regions and type of municipality"; query string `A.IT+ITC1+ITC2+ITC3+ITC4+ITDA+ITD3+ITD4+ITD5+ITE1+ITE2+ITE3+ITE4+ITF1+ITF2+ITF3+ITF4+ITF5+ITF6+ITG1+ITG2.6_WEEK_RELIG+6_NEVER_RELIG.HSC....?detail=full`.
- **Licence**: Istat legal notice, CC BY 4.0 unless otherwise stated; attribute as "Istat".
- **Our extraction script**: `scripts/build_it_area_summary.R`.
- **Retrieval recipe and hashes**: `docs/manifests/it-attendance-2001-2025.json`.

## Boundaries

- Official boundary files: Istat *Confini delle unità amministrative a fini
  statistici*, 2026, version generalizzata, `Reg01012026_g_WGS84` from
  `Limiti01012026_g.zip`.
- Boundary licence: Istat legal notice, CC BY 4.0 unless otherwise stated;
  attribution "Istat".
- Boundary changes between waves: the 20-region frame is stable for the AVQ
  years used here. The product anchors all survey years on the 2026
  generalised region layer.

## Places-of-worship layer

- OSM coverage assessment: not measured in this build. No governed place layer
  or place-density metric ships with the Italy practice product.
- Country-specific registers that could seed or verify the layer: Catholic
  diocesan and parish directories, Protestant and Orthodox directories,
  synagogue records, Muslim association directories, cultural-heritage
  inventories, and local histories.

## First visualisation

Built data product: weekly attendance at a place of worship, percent of the
resident population aged 6 and over, by region for 2001-2003 and 2005-2025.
The secondary metric is the percent reporting never attending a place of
worship. The region page and hub card are separate work.

## Build recipe

1. Extract: cache the Istat SDMX dataflow list, the AVQ DSD, the needed
   codelists, and one data CSV query under `data/raw/it_practice/`.
2. Governed product: `apps/regions/it/data/area_summary_region.{json,csv}`
   with `schema_version` `0.2.0`, plus
   `docs/manifests/it-attendance-2001-2025.json`.
3. Boundaries: download Istat 2026 generalised administrative boundaries,
   keep the 20-region layer, transform to EPSG:4326, and simplify with
   mapshaper weighted keep-shapes and `-clean` to
   `apps/regions/it/data/it_region_2026.geojson`.
4. Region page: deferred to the separate Italy region-page lane.
5. Verification: assert the dataflow id and DSD order, all 20 regions for
   every covered source year, values within `[0, 100]`, national source-row
   spot values for 2001, 2019, and 2022, and valid 20-feature boundary output
   below 800 KB.

## Risks and open questions

- The AVQ product is a sample-survey estimate with sampling error and the known
  upward bias of self-reported attendance. It should not be interpreted as a
  door count.
- Sampling-error band values were not present in the machine-readable SDMX
  pull. The row-level quality flag points readers to the annual *Nota
  metodologica* for regional sampling-error information.
- The current shared `area_summary` row schema has legacy metric keys. In the
  Italy product, `religious_affiliation_percent` carries weekly attendance and
  `no_religion_percent` carries never attending. The indicator and layer labels
  state the practice construct.

## Deep-history potential

Diocesan archives, parish registers, state archives, synagogue records, Muslim
association directories, Istituto Centrale per il Catalogo e la Documentazione,
local histories, and historic maps can support deeper site histories.
