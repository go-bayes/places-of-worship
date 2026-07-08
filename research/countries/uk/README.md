# Country data map: United Kingdom (UK)

The United Kingdom card is split because census systems differ across
England and Wales, Scotland, and Northern Ireland.

## Initial regional-map build

- **Built**: 2026-07-07.
- **Page**: `apps/regions/uk/index.html`.
- **Manifest**: `docs/manifests/uk-census-religion-2001-2022.json`.
- **Census levels**: `ew_ltla`, `sco_ca`, and `ni_lgd`.
- **Live count coverage**: England and Wales local authorities for 2001,
  2011, and 2021; Northern Ireland Local Government Districts for 2021.
- **Pending count coverage**: Scotland council areas for 2001, 2011, and
  2022; Northern Ireland Local Government Districts for 2001 and 2011.
- **Construct**: census current-religion affiliation everywhere. Religion or
  religion brought up in and community-background tables remain separate.
- **Default metric**: religious-affiliation percent among people with a stated
  current-religion response.

## Access the data yourself

This project does not redistribute source data; the map shows derived rates with attribution. To obtain the data from the source of record:

- **Source of record**: Office for National Statistics via Nomis, <https://www.nomisweb.co.uk/api/v01/dataset/nm_2049_1.bulk.csv?time=latest&measures=20100&c2021_religion_10=0,1,9&geography=TYPE154>; Northern Ireland Statistics and Research Agency, <https://www.nisra.gov.uk/system/files/statistics/census-2021-ms-b19.xlsx>; other UK source URLs are listed in the manifest.
- **Exact tables**: Nomis `C2021TS030` / `TS030`, `KS209EW`, and `KS007`; NISRA `MS-B19`; Scotland 2001/2011/2022 and Northern Ireland 2001/2011 extraction routes are pending in the manifest.
- **Licence**: Contains public sector information licensed under the Open Government Licence v3.0.
- **Our extraction script**: `scripts/build_uk_area_summary.R`.
- **Retrieval recipe and hashes**: `docs/manifests/uk-census-religion-2001-2022.json`.

## England and Wales

### Status

- **Tier**: A (buildable now)
- **Build state**: initial regional map built at local-authority level
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

- Initial product: ONS Open Geography Portal Local Authority Districts (May
  2021) Boundaries UK BGC, filtered to England and Wales.
- Earlier waves: Nomis local-authority rows are mapped to the 2021 boundary
  set with the ONS LAD11-to-LAD21 lookup, augmented with same-code 2021 local
  authorities where Nomis already uses the current code.
- Later refinement: output-area boundaries remain the route for a higher
  resolution England and Wales product.

### Places-of-worship layer

- OSM coverage assessment (2026-07-07): not yet run for this survey card.
- Country-specific registers: Historic England, Cadw, Church Heritage Record,
  National Churches Trust, denominational directories, county record offices,
  British Newspaper Archive, TNA `HO 129`.

### First visualisation

Religious-affiliation percent by 2021 local authority, censuses 2001, 2011,
and 2021, using Nomis tables `KS007`, `KS209EW`, and `TS030`.

### Build recipe

1. Extract: use Nomis `C2021TS030`, `KS209EW`, and `KS007` at
   local-authority level.
2. Governed product: `area_summary` per `schemas/area-summary.schema.json`,
   with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: join to ONS May 2021 local-authority districts; map 2001 and
   2011 rows through the ONS LAD11-to-LAD21 lookup.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: compare local-authority sums with Nomis national totals,
   verify join coverage, and record ONS/Nomis attribution.

### Risks and open questions

- The census religion question is voluntary and measures affiliation.
- Published local-authority sums differ from the published country row by one
  person in 2001 and by at most 24 people in 2021; the manifest records the
  residuals and the build fails if a residual exceeds 25 people.
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
- **Build state**: boundaries built; census table extraction pending
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

- Initial product: Scotland council-area 2019 boundaries from the Scotland's
  Census ArcGIS FeatureServer.
- Census rows: the UK page carries council-area placeholder rows for 2001,
  2011, and 2022 until a stable official table-builder export is pinned.
- Later refinement: output-area or data-zone geography remains the route for
  a higher resolution Scotland product.

### Places-of-worship layer

- OSM coverage assessment (2026-07-07): not yet run for this survey card.
- Country-specific registers: Historic Environment Scotland, Canmore, Church
  of Scotland records, Catholic diocesan archives, Scottish Jewish Archives
  Centre, local authority historic environment records, National Library of
  Scotland maps, ScotlandsPeople kirk session and parish records.

### First visualisation

The initial UK page includes Scotland council-area boundaries for 2001, 2011,
and 2022. Religious-affiliation counts remain pending because the official
table-builder export route was not pinned in this build.

### Build recipe

1. Extract: pin an unauthenticated Scotland's Census table-builder export for
   the 2022 religion topic, then reproduce `KS209SCb` for 2011 and the 2001
   religion table.
2. Governed product: `area_summary` per `schemas/area-summary.schema.json`,
   with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: the initial map joins to council-area 2019 boundaries; add
   `OutputAreas2022_MHW`, `Output_Area_2011`, and `Output_Areas_2001` for
   higher resolution historical views.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: compare council-area, output-area, or data-zone sums with
   Scotland totals, verify join coverage, and record National Records of
   Scotland attribution.

### Risks and open questions

- The Scotland extraction route should use the official table-builder
  download path or API session. Page scraping is out of scope.
- The initial UK page exposes Scotland boundaries but no Scotland census
  counts.
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
- **Build state**: 2021 Local Government District map built; 2001 and 2011
  extraction pending
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

Current-religion affiliation percent by Local Government District in 2021.
Religion or religion brought up in and the 1861-2021 Northern Ireland-level
series remain separate from the mapped affiliation layer.

### Build recipe

1. Extract: start with NISRA `MS-B19` for current religion at Local
   Government District level, then pin 2001 and 2011 Local Government
   District downloads through NINIS or the current table-lookup route.
2. Governed product: `area_summary` per `schemas/area-summary.schema.json`,
   with a tracked manifest per `docs/data-storage-pipeline.md`.
3. Boundaries: join Local Government District codes to the official NISRA/OSNI
   district boundary file; pin electoral ward boundaries before a ward map.
4. Region page: `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verification: compare Local Government District sums with Northern Ireland
   totals and keep community-background tables separate from current religion.

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
