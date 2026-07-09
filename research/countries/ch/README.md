# Country data map: Switzerland (CH)

One page per country, one consistent structure. This card records the
Switzerland canton products built from official FSO/BFS religion data and
swisstopo boundaries.

## Status

- **Tier**: A (buildable now)
- **Build state**: data extracted; UI/page/hub not built
- **Last verified**: 2026-07-10

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| FSO/BFS STAT-TAB PX cube `px-x-4001000000_122` | census affiliation count | canton | 1970, 1980, 1990, 2000 | PX-Web JSON-stat2 | open API | opendata.swiss `terms_by_ask` / OPEN-BY-ASK |
| FSO/BFS table `T 01.08.02.02`, asset `36347568` | structural survey affiliation estimate, resident population aged 15+ | canton | 2010-2024 | XLS workbook with annual sheets and confidence intervals | open DAM route | opendata.swiss `terms_by_ask` / OPEN-BY-ASK |

Constructs are not interchangeable. The 1970-2000 product is a federal
census full-count affiliation product. The 2010-2024 product is a sample
survey estimate for the permanent resident population aged 15+, with
confidence intervals in the source workbook.

## Access the data yourself

- **Source of record**: Federal Statistical Office (FSO/BFS), opendata.swiss,
  STAT-TAB/PX-Web, and the FSO DAM asset API.
- **Exact census table**: `Wohnbevölkerung am wirtschaftlichen Wohnsitz nach
  institutionellen Gliederungen und Religion, 1970-2000`, package
  `wohnbevolkerung-am-wirtschaftlichen-wohnsitz-nach-region-und-religion`,
  PX API endpoint
  `https://www.pxweb.bfs.admin.ch/api/v1/de/px-x-4001000000_122/px-x-4001000000_122.px`.
- **Exact survey table**: `Religionszugehörigkeit nach Grossregion und
  Kanton`, asset `36347568`, workbook route
  `https://dam-api.bfs.admin.ch/hub/api/dam/assets/36347568/master`.
- **Licence**: FSO religion resources use opendata.swiss `terms_by_ask`
  / OPEN-BY-ASK: non-commercial reuse with source attribution; commercial
  reuse requires data-owner permission.
- **Our extraction script**: `scripts/build_ch_area_summary.R`.
- **Retrieval recipe and hashes**:
  `docs/manifests/ch-census-religion-1970-2000.json` and
  `docs/manifests/ch-structural-survey-religion-2010-2024.json`.

## Boundaries

- Official boundary file: swisstopo `swissBOUNDARIES3D`, STAC item
  `swissboundaries3d_2026-01`, GeoPackage asset
  `swissboundaries3d_2026-01_2056_5728.gpkg.zip`, layer
  `tlm_kantonsgebiet`.
- Boundary licence: opendata.swiss `terms_by` / OPEN-BY, with swisstopo
  attribution.
- Harmonisation: both products use the current 26-canton swisstopo frame.
  The FSO census cube reports a Jura row in 1970; the product treats that row
  as a source-provided current-frame historical roll-up. The row does not
  describe the 1970 constitutional canton set.

## Places-of-worship layer

- No governed Switzerland place-of-worship snapshot is included in this data
  release.
- Place-count and place-density metrics remain null until a governed
  Switzerland place layer is built.

## First visualisation

Build two canton products. A spliced time series would merge incompatible
constructs:

1. Census affiliation counts and shares, 1970-2000.
2. Structural survey affiliation and no-religion estimates, 2010-2024,
   flagged `sample_survey_estimate`.

## Build recipe

1. Extract: `Rscript scripts/build_ch_area_summary.R`.
2. Governed products:
   `apps/regions/ch/data/area_summary_canton_census.json` and
   `apps/regions/ch/data/area_summary_canton_survey.json`.
3. Boundaries: `apps/regions/ch/data/ch_canton_2026.geojson`, simplified
   through `scripts/lib/simplify_boundary.R`.
4. Region page: not built in this task.
5. Verification: census canton sums reconcile exactly to the national row for
   every published religion category and wave. Survey canton total estimates
   match the national row within floating-point precision; no-religion
   estimates differ by at most three estimated persons before integer
   rounding, which the manifest records as a weighted-estimate residual.

## Risks and open questions

- Historical canton-level religion waves before 1970 were not found in a
  buildable STAT-TAB/PX-Web or opendata.swiss machine-readable route during
  this probe. Do not hand-transcribe PDFs for this lane.
- The structural survey source publishes category confidence intervals, but
  the current area-summary row schema has no confidence-interval fields.
- The survey workbook suppresses some canton `Religionszugehörigkeit
  unbekannt` cells. The survey product sets religious-affiliation fields to
  null for those affected canton-years rather than deriving a numerator that
  cannot exclude unknown affiliation precisely.

## Deep-history potential

No Switzerland-specific historical place-register source has been assessed in
this task.
