# Country data map: United Kingdom (UK)

The United Kingdom card is split because census systems differ across
England and Wales, Scotland, and Northern Ireland.

## England and Wales

### Status

- **Tier**: A (buildable now)
- **Build state**: survey verified
- **Last verified**: 2026-07-07; verification URLs:
  <https://www.nomisweb.co.uk/datasets/c2021ts030> and
  <https://www.nomisweb.co.uk/census/2011/ks209ew>

### Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| Nomis, Census 2021 table `TS030` Religion | census religious affiliation | output area and above through Nomis | 2021 | web table, CSV download, API route | open | Open Government Licence |
| Nomis, Census 2011 table `KS209EW` Religion | census religious affiliation | output area and above | 2011 | web table and CSV download | open | Open Government Licence |
| Nomis, Census 2001 table `KS007` Religion | census religious affiliation | output area and above | 2001 | web table and CSV download | open | Open Government Licence |
| The National Archives, Home Office `HO 129`, Ecclesiastical Census Returns | places of worship, sittings, endowments, and attendance on 30 March 1851 | parish or place return; can aggregate to registration district or county | 1851 | catalogue records and digital microfilm/PDF | open catalogue; image access varies | Crown copyright or archive terms; confirm before publishing extracts |

### Boundaries

- Official boundary files: ONS Open Geography Portal output-area boundaries
  for 2001, 2011, and 2021, Open Government Licence.
- Use 2021 output areas first for a 2021 map. For 2001-2021 change, use ONS
  lookups or aggregate to local authority geography before comparing waves.

### Places-of-worship layer

- OSM coverage assessment (2026-07-07): not yet run for this survey card.
- Country-specific registers: Historic England, Cadw, Church Heritage Record,
  National Churches Trust, denominational directories, county record offices,
  British Newspaper Archive, TNA `HO 129`.

### First visualisation

Religious-affiliation percent by output area or lower-layer super output area,
censuses 2001, 2011, and 2021, using Nomis tables `KS007`, `KS209EW`, and
`TS030`.

### Build recipe

1. Extract: start with Nomis `C2021TS030` for 2021 output areas, then add
   `KS209EW` and `KS007`.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`,
   with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: join output-area codes to ONS 2021 output-area boundaries, or
   aggregate to lower-layer super output areas for a faster first map.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: compare output-area sums with Nomis local-authority and
   national totals, verify join coverage, and record ONS/Nomis attribution.

### Risks and open questions

- The census religion question is voluntary and measures affiliation.
- The 1851 Religious Census measures institutions and attendance rather than
  individual affiliation. Keep it in a separate layer.

### Deep-history potential

The 1851 Religious Census is the deepest official worship-source route for
England and Wales. It can be joined with county record society editions,
TNA `HO 129`, historical Ordnance Survey maps, listed-building records,
denominational yearbooks, diocesan archives, newspapers, and local directories.

## Scotland

### Status

- **Tier**: A (buildable now)
- **Build state**: survey verified
- **Last verified**: 2026-07-07; verification URLs:
  <https://www.scotlandscensus.gov.uk/search-the-census> and
  <https://services1.arcgis.com/etUJqgud3DEym3ls/arcgis/rest/services/OutputAreas2022_MHW/FeatureServer>

### Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| Scotland's Census search and flexible table builder, 2022 religion topic | census religious affiliation | output area through table builder | 2022 | web table and download route | open | Open Government Licence unless otherwise stated |
| Scotland's Census 2011 table `KS209SCb` Religion | census religious affiliation | output area and above through census tables | 2011 | web table/download route | open | Open Government Licence unless otherwise stated |
| Scotland's Census 2001 religion tables and Scottish Government 2001 religion analysis | census religious affiliation | output area and higher geographies | 2001 | web/PDF and table-builder route | open | Open Government Licence unless otherwise stated |

### Boundaries

- Official boundary files: Scotland's Census ArcGIS FeatureServer output-area
  services for 2022, 2011, and 2001, exportable as CSV, shapefile, GeoPackage,
  GeoJSON, and related formats.
- Anchor a first build on 2022 output areas. Use 2011 and 2001 output-area
  services or aggregate to council areas before comparing waves.

### Places-of-worship layer

- OSM coverage assessment (2026-07-07): not yet run for this survey card.
- Country-specific registers: Historic Environment Scotland, Canmore, Church
  of Scotland records, Catholic diocesan archives, Scottish Jewish Archives
  Centre, local authority historic environment records, National Library of
  Scotland maps, ScotlandsPeople kirk session and parish records.

### First visualisation

Religious-affiliation percent by output area or data zone, censuses 2001,
2011, and 2022, with source-era labels for 2001 and 2022 categories.

### Build recipe

1. Extract: use Scotland's Census table builder for the 2022 religion topic,
   then reproduce `KS209SCb` for 2011 and the 2001 religion table.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`,
   with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: join to `OutputAreas2022_MHW` first; add `Output_Area_2011`
   and `Output_Areas_2001` for historical views.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: compare output-area or data-zone sums with Scotland totals,
   verify join coverage, and record National Records of Scotland attribution.

### Risks and open questions

- The Scotland extraction route should use the official table-builder
  download path or API session. Page scraping is out of scope.
- Religion categories differ across 2001, 2011, and 2022; publish raw source
  labels alongside broad recodes.

### Deep-history potential

Scotland has no equivalent repeat of the 1851 England and Wales Religious
Census. Older reconstruction should use Statistical Accounts of Scotland,
Church of Scotland records, ScotlandsPeople parish and kirk session records,
Catholic and Free Church archives, National Library of Scotland maps, Canmore,
newspapers, and local directories.

## Northern Ireland

### Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07; verification URL:
  <https://www.nisra.gov.uk/publications/census-2021-main-statistics-religion-tables>

### Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| Northern Ireland Statistics and Research Agency (NISRA), Census 2021 main statistics religion tables `MS-B19` to `MS-B31` | census religious affiliation; separate community-background tables | electoral ward and settlement for selected 2021 tables; Local Government District for core tables | 2021 | XLSX downloads and table lookup | open | Open Government Licence |
| NISRA, `MS-B22 Religion - 1861-2021` | census religious affiliation | Northern Ireland | 1861-2021 | XLSX | open | Open Government Licence |
| NISRA/NINIS historical census outputs | census religious affiliation and community background | district, ward, or small-area route to verify | 2001, 2011 | table lookup or legacy downloads | open, route needs extraction pass | Open Government Licence |

### Boundaries

- Official boundary files: NISRA/OSNI geography products for Local Government
  Districts, electoral wards, Super Output Areas, and settlements; exact 2021
  ward boundary download needs pinning during extraction.
- Use Local Government District first, because 2021 core tables and a
  historical Northern Ireland series are already verified. Ward-level output
  can follow once the boundary download is pinned.

### Places-of-worship layer

- OSM coverage assessment (2026-07-07): not yet run for this survey card.
- Country-specific registers: Historic Environment Record of Northern Ireland,
  PRONI church records, Presbyterian Historical Society of Ireland, Catholic
  parish registers, Church of Ireland records, Methodist Historical Society,
  OSNI historic maps, British Newspaper Archive.

### First visualisation

Religion and religion-background percent by Local Government District in 2021,
with a separate Northern Ireland-level line chart for the 1861-2021 series.

### Build recipe

1. Extract: start with NISRA `MS-B19` and `MS-B23` XLSX files for Local
   Government Districts, then add `MS-B22` for the 1861-2021 Northern Ireland
   series.
2. Governed product: `area_summary` per `schemas/area_summary.schema.json`,
   with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: join Local Government District codes to the official NISRA/OSNI
   district boundary file; pin electoral ward boundaries before a ward map.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: compare Local Government District sums with Northern Ireland
   totals and keep religion-background tables separate from current religion.

### Risks and open questions

- Religion and religion or religion brought up in are separate constructs.
  The second construct is community background.
- Multi-wave subnational downloads for 2001 and 2011 need a NINIS/table-lookup
  extraction pass before this section can move to tier A.
- Northern Ireland religion data are politically sensitive; map labels must
  avoid implying affiliation, community background, attendance, and site
  density measure the same thing.

### Deep-history potential

NISRA provides a Northern Ireland religion series from 1861 to 2021. Site-level
deep history can use PRONI church collections, Presbyterian Historical Society
of Ireland holdings, Catholic parish registers, Church of Ireland parish
records, Methodist archives, OSNI historical maps, valuation records,
newspapers, and local histories.
