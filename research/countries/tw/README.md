# Country data map: Taiwan (TW)

## Status

- **Tier**: B
- **Build state**: Built; the public product ships MOI registered temples and churches, reported temple followers, and registered-places-per-10,000-residents for 22 county/city units, 2020-2024, on geoBoundaries ADM1. Region-page wiring remains open.
- **Last verified**: 2026-07-11

## Construct discipline

This is an **administrative register of registered religious organisations**. It
counts registered temples (寺廟) and churches (教會堂) and their reported temple
followers (信徒人數). It is **never** census religious affiliation, belief, or
attendance. Reported followers are the temples' own registered followers, not
census respondents. From ROC 103 (2014) the MOI follower column counts temple
followers only (church members are reported separately); all shipped years
(2020-2024) are inside that stable window. See [route-probe.md](route-probe.md)
for the verbatim source note and the licence capture.

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [MOI statis yearbook table 06-01 各宗教教務概況](https://statis.moi.gov.tw/micst/webMain.aspx?k=menuy) | Registered temples, churches, and reported temple followers | County/city (22 units) | 2016-2025 (2020-2024 shipped) | ODS | Open (regenerate-then-download) | MOI Open Government Data Declaration |
| [MOI statis yearbook table 02-01 人口年齡分配](https://statis.moi.gov.tw/micst/webMain.aspx?k=menuy) | Year-end household-registration population (denominator only) | County/city (22 units) | 2016-2025 | ODS | Open | MOI Open Government Data Declaration |

Constructs are not interchangeable. These are administrative register counts,
not census affiliation, and are never merged with a census-affiliation layer.

## Access the data yourself

This project does not redistribute the source tables; the map shows derived
counts and rates with attribution. To obtain the data from the source of record:

- **Source of record**: MOI Department of Statistics yearbook portal,
  `https://statis.moi.gov.tw/micst/webMain.aspx?k=menuy`.
- **Exact tables**: `06-01 各宗教教務概況` (portal `funid=331030`) and
  `02-01 人口年齡分配` (portal `funid=332010`). Each is regenerated server-side
  (`kind=7` ODF) and then downloaded from `report/<funid>.ods`.
- **Licence**: MOI **政府網站資料開放宣告** (Open Government Data Declaration):
  free, non-exclusive, sub-licensable, irrevocable, worldwide reuse with
  attribution. Verbatim text and hash in [route-probe.md](route-probe.md).
- **Our extraction script**: `scripts/build_tw_area_summary.R`.
- **Retrieval recipe and hashes**: `docs/manifests/tw-register-2020-2024.json`.

## Boundaries

| Source | Unit | Match note |
| --- | --- | --- |
| [geoBoundaries gbOpen TWN ADM1](https://www.geoboundaries.org/api/current/gbOpen/TWN/ADM1/) | County/city (22 units) | Joined to the MOI county/city rows by ISO code (`TW-XXX`). ODbL 1.0. |

The TW survey row named geoBoundaries ADM2; ADM2 is 368 townships/districts,
while the MOI religion statistics are county/city, which map to ADM1 (22 units).
ADM1 is therefore the correct join layer and is used. geoBoundaries names differ
for some units (Lienchiang County = Matsu Islands; Penghu/Kinmen drop "County";
special municipalities drop "City"); MOI published English names are retained as
`area_name` and the ISO code is the join key. Recorded for the PI.

## Places-of-worship layer

| Source | Role | Note |
| --- | --- | --- |
| MOI register (table 06-01) | Registered-place count | `place_count` is the MOI administrative count of registered temples plus churches per county/city and year-end. It is an administrative register count, not an OpenStreetMap or point-in-time site extraction. |
| [OpenStreetMap](https://www.openstreetmap.org) | Candidate site layer | Not counted in this build. A future OSM pass could compare temple density against the MOI register. |

## First visualisation

Registered temples and churches per 10,000 residents by county/city, 2020-2024,
on geoBoundaries ADM1, with a clear administrative-register title. Registered
temple followers (信徒人數) ship as a secondary count.

## Build recipe

1. Fetch MOI statis tables 06-01 and 02-01 (regenerate-then-download ODS) and
   geoBoundaries TWN ADM1; cache under the git-ignored `data/raw/tw_register/`.
2. Parse the per-year locality sheets (via `xml2`) into the 22 county/city
   rows; take the both-sexes year-end population as the per-10,000 denominator.
3. Reconcile: the 22 county rows must sum exactly to the MOI published national
   totals for temples, churches, total places, and followers, and populations
   to the national population, every year (stop-don't-tune).
4. Join geoBoundaries ADM1 by ISO code; validate 22 valid, distinct geometries;
   simplify through `scripts/lib/simplify_boundary.R` below 3 MB.
5. Write `area_summary_county.{json,csv}`, `tw_county_2024.geojson`, and the
   manifest.

Products: `apps/regions/tw/data/area_summary_county.json` (110 rows: 22
county/city units for every year 2020-2024), `apps/regions/tw/data/area_summary_county.csv`,
`apps/regions/tw/data/tw_county_2024.geojson` (22 features), and
`docs/manifests/tw-register-2020-2024.json`.

## Risks and open questions

- Register construct, not census affiliation. Registered temples/churches and
  reported followers can double-count adherents and miss unregistered folk
  practice. No official household or census source provides personal affiliation
  at county/city level in this build.
- The follower column excludes church members from 2014; the shipped series is
  internally consistent but not comparable with pre-2014 followers.
- The MOI followers column is temple followers only; the product does not report
  a church-member or clergy count.
- geoBoundaries ADM1 geometry includes coastal extents; `land_area_sq_km` and
  `place_density_per_sq_km` are therefore left null.
- Taiwan naming of county/city units is taken from the MOI English tables; any
  naming question is recorded for the PI, not resolved here.

## Deep-history potential

High. Japanese colonial census and temple materials, Taiwan Historica holdings,
MOI registration series, temple registers, church records, and local gazetteers
can support long-run site histories.
