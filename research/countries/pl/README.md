# Country data map: Poland (PL)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: data extracted
- **Last verified**: 2026-07-10

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [Statistics Poland NSP 2021 final ethno-cultural tables](https://stat.gov.pl/spisy-powszechne/nsp-2021/nsp-2021-wyniki-ostateczne/) | census affiliation | voivodeship for public religion detail found in this sweep | 2011, 2021; historical national series farther back | XLSX/PDF/web | open | Statistics Poland reuse terms |
| [ISKK e-Dominicantes](https://iskk.pl/dominicantes/) | Catholic attendance counts: dominicantes and communicantes | parish input, public reporting by diocese | annual, current workflow 2025; dashboard/report shows 2014-2024 series | web/PDF/report | partly open; parish panel requires codes | ISKK terms |

Constructs are not interchangeable: ISKK dominicantes and communicantes
measure Catholic practice over obliged Catholics. The rates do not measure
census affiliation, religious identity, or population shares.

## Access the data yourself

This project does not redistribute the source PDFs; the area-summary
product stores derived diocese-year rates with attribution. To obtain the
data from the source of record:

- **Source of record**: ISKK Annuarium Statisticum Ecclesiae in Polonia
  PDFs, indexed through [ISKK publications](https://iskk.pl/publikacje/)
  and the [e-Dominicantes](https://iskk.pl/dominicantes/) reporting page.
- **Exact tables**: annual diocese-level tables headed
  `Wskaźniki dominicantes i communicantes ... według diecezji`.
- **PDF URLs**:
  [2014](https://iskk.pl/wp-content/uploads/2023/09/AnnuariumStatisticum2015.pdf),
  [2015](https://iskk.pl/wp-content/uploads/2023/09/AnnuariumStatisticum2016.pdf),
  [2016](https://iskk.pl/wp-content/uploads/2023/09/Annuarium_Statisticum_2018.pdf),
  [2017](https://iskk.pl/wp-content/uploads/2023/09/Annuarium_Statisticum_2019.pdf),
  [2018](https://iskk.pl/wp-content/uploads/2023/09/Annuarium_Statisticum_2020_07.01.pdf),
  [2019](https://iskk.pl/wp-content/uploads/2023/09/Annuarium_Statisticum_DANE_2019_FINAL_KOREKTA_26012021.pdf),
  [2020](https://iskk.pl/wp-content/uploads/2023/09/annuarium-statisticum-ecclesiae-in-polonia-dane-za-rok-2020.pdf)
  (no count because of COVID-19),
  [2021](https://iskk.pl/wp-content/uploads/2023/09/ISKK_Annuarium_dane_za_2021_www.pdf),
  [2022](https://iskk.pl/wp-content/uploads/2023/12/Annuarium_Statisticum_DANE_za-2022_19.12.pdf),
  [2023](https://iskk.pl/wp-content/uploads/2024/12/Annuarium_Statisticum_2023.pdf),
  and [2024](https://iskk.pl/wp-content/uploads/2025/12/Annuarium_Statisticum_2024.pdf).
- **Licence**: ISKK reuse terms still need review before broad
  redistribution; the committed product uses derived aggregate rates with
  attribution.
- **Our extraction script**: `scripts/build_pl_area_summary.R`.
- **Retrieval recipe and hashes**:
  `docs/manifests/pl-attendance-2014-2024.json`.

## Boundaries

- Official boundary files: Statistics Poland TERYT and state geodetic boundaries; Eurostat GISCO LAU can support gmina and voivodeship joins.
- Current practice-lane boundary file:
  `apps/regions/pl/data/pl_diocese_2004.geojson`, 41 Catholic dioceses
  on post-2004 boundaries. The layer combines 24 OpenStreetMap religious
  administration polygons with 17 Eurostat/GISCO LAU 2024 gmina-derived
  digitised polygons. Seven digitised dioceses are flagged low confidence
  in the data rows.
- Boundary changes between waves and the harmonisation plan: the first
  practice product is anchored on Catholic diocese boundaries from
  2004-present. Pre-2004 practice series need period boundaries and a
  diocese concordance.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): Overpass count did not complete reliably in this sweep; run a country extract before build.
- Country-specific registers that could seed or verify the layer: ISKK parish reporting, Catholic diocesan directories, Ministry of Interior register of churches and religious associations.

## First visualisation

Built data product: Catholic practice by diocese, annual dominicantes and
communicantes series from ISKK for 2014-2019 and 2021-2024. Census
affiliation by voivodeship remains a context layer beside the practice
product. The census layer should not share the same map axis.

## Build recipe

1. Extract: transcribe ISKK Annuarium diocese tables with source document,
   table, page, URL, and SHA-256 provenance.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`,
   using `scripts/build_pl_area_summary.R` and
   `docs/manifests/pl-attendance-2014-2024.json`.
3. Boundaries: join ISKK names to `area_code` on the 41-feature
   post-2004 diocese layer; carry `boundary_basis` and `confidence` into
   every row's `quality_flag`.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: require 41/41 diocese joins for every counted year,
   retain `Ogółem` only as national context, and record the Wikipedia
   comparison from the raw metadata.

## Risks and open questions

- ISKK measures Catholic practice rather than affiliation for all religious groups.
- Parish-level panel data are not publicly downloadable.
- Diocese and civil boundaries do not align.
- The diocesan boundary layer is provisional until authoritative
  GIS-Expert/KUL polygons are available.

## Deep-history potential

Diocesan and parish archives, Catholic schematisms, state archive parish-register holdings, Jewish Historical Institute materials, Lutheran and Orthodox consistory records, and pre-war statistical yearbooks.
