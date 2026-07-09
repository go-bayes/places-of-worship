# Switzerland wave-extension probe

Date: 2026-07-10.

## Conclusion

Switzerland is buildable for two separate canton products. The census lane is
machine-readable for 1970, 1980, 1990, and 2000 through an FSO/BFS PX-Web cube.
The structural-survey lane is machine-readable for 2010-2024 through an FSO/BFS
annual workbook with canton confidence intervals. The two lanes must remain
separate because one is a federal census full-count affiliation construct and
the other is a sample survey estimate for the permanent resident population
aged 15+.

The probe did not find a buildable FSO STAT-TAB/PX-Web or opendata.swiss
canton-level religion route for 1850-1960. Those waves remain out of the build
lane unless an official machine-readable canton table is later pinned.

## Census affiliation route

| Item | Route |
| --- | --- |
| opendata.swiss package | `wohnbevolkerung-am-wirtschaftlichen-wohnsitz-nach-region-und-religion` |
| Title | `Wohnbevölkerung am wirtschaftlichen Wohnsitz nach institutionellen Gliederungen und Religion, 1970-2000` |
| PX service | `https://www.pxweb.bfs.admin.ch/pxweb/de/px-x-4001000000_122/px-x-4001000000_122/px-x-4001000000_122.px` |
| PX API endpoint | `https://www.pxweb.bfs.admin.ch/api/v1/de/px-x-4001000000_122/px-x-4001000000_122.px` |
| Machine-readable response | JSON-stat2 POST |
| Years in cube | 1970, 1980, 1990, 2000 |
| Geography in build | Switzerland national row plus 26 canton rows |
| Religion categories | Total, Protestant subgroups, Roman Catholic, Christian Catholic, Orthodox, other Christian, Jewish, Islamic, other religion, no affiliation, no response |
| Licence route | resource `rights` and `license` are `https://opendata.swiss/terms-of-use#terms_by_ask` |

The build query selects all four `Jahr` values, the national row `0`, and the
26 canton rows:

`1` ZH, `185` BE, `612` LU, `725` UR, `747` SZ, `784` OW, `793` NW, `806` GL,
`837` ZG, `850` FR, `1100` SO, `1237` BS, `1242` BL, `1334` SH, `1375` AR,
`1399` AI, `1407` SG, `1512` GR, `1739` AG, `1983` TG, `2072` TI, `2326` VD,
`2730` VS, `2904` NE, `2973` GE, and `3020` JU.

Secondary FSO packages cover narrower slices, including a 1990-2000 route and
a 2000 residence-type route. The build uses `px-x-4001000000_122` because it
covers all four machine-readable census waves in one cube.

## Structural survey route

| Item | Route |
| --- | --- |
| opendata.swiss package | `religionszugehorigkeit-nach-grossregion-und-kanton` |
| Title | `Religionszugehörigkeit nach Grossregion und Kanton` |
| FSO DAM asset | `36347568` |
| Workbook URL | `https://dam-api.bfs.admin.ch/hub/api/dam/assets/36347568/master` |
| Metadata URL | `https://dam-api.bfs.admin.ch/hub/api/dam/assets/36347568` |
| Machine-readable response | XLS workbook, one sheet per year |
| Years in workbook | 2010-2024 |
| Population | Permanent resident population aged 15+ |
| Survey status | FSO metadata identifies `Stichprobenerhebung` and `SE Strukturerhebung` |
| Confidence intervals | Each annual sheet has count and `Vertrauensintervall: ± (in %)` columns by category |
| Licence route | resource `rights` and `license` are `https://opendata.swiss/terms-of-use#terms_by_ask`; DAM metadata carries `OPEN-BY-ASK` |

The survey workbook is not a census continuation. Survey rows are weighted
estimates, and confidence intervals are in the source workbook. The legacy
area-summary schema can flag `sample_survey_estimate`, but it cannot carry the
category confidence intervals as row fields.

## Boundary route

| Item | Route |
| --- | --- |
| opendata.swiss package | `swissboundaries3d` |
| STAC item | `swissboundaries3d_2026-01` |
| Asset | `https://data.geo.admin.ch/ch.swisstopo.swissboundaries3d/swissboundaries3d_2026-01/swissboundaries3d_2026-01_2056_5728.gpkg.zip` |
| Layer | `tlm_kantonsgebiet` |
| Feature count | 26 cantons |
| Licence route | package resources use `https://opendata.swiss/terms-of-use#terms_by` |

The build script writes a simplified 26-feature GeoJSON through
`scripts/lib/simplify_boundary.R`.

## Build decision

The build ships two products. A single `area_summary` would imply one
continuous default change series, even though the denominator,
design, and uncertainty differ.

- Census product:
  `apps/regions/ch/data/area_summary_canton_census.json`.
- Structural survey product:
  `apps/regions/ch/data/area_summary_canton_survey.json`.
- Shared boundary:
  `apps/regions/ch/data/ch_canton_2026.geojson`.

The census product reconciles exactly: canton sums match the national row for
all 15 religion categories in all four waves. The survey product records a
sample-survey validation: canton total estimates match the national row within
floating-point precision, and no-religion estimates differ by at most three
estimated persons before integer rounding. The survey workbook suppresses
unknown-affiliation cells in 23 canton-years. The affiliation-excluding-unknown
fields are therefore null in those rows.
