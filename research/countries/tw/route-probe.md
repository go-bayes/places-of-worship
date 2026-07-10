# Taiwan route probe: MOI registered-religion administrative statistics

Rank 13 build lane. This probe pins the machine-readable Ministry of the
Interior (MOI) sources for registered religious organisations, records the
licence position from byte-matched captures, and documents the geography and
reconciliation. Built to a shipped product; see the country card and
`docs/manifests/tw-register-2020-2024.json`.

## Construct (the governing discipline)

The MOI religion statistics are an **administrative register of registered
religious organisations**: counts of registered temples (寺廟) and churches
(教會堂) and their reported temple followers (信徒人數). They are **never**
census religious affiliation, belief, or attendance. The reported followers
are the temples' own registered followers, not census respondents. The product
declares this in the manifest (`parameters.construct_declaration`), the
`area_summary` indicators, and every row's `quality_flag`.

A source-defined follower-series break bounds comparability. MOI states
verbatim (table 06-01, cached):
「信徒人數在102年以前含寺廟信徒人數與教(會)堂教徒人數，自103年起僅包括寺廟信徒人數」
— before ROC 102 (2013) followers include both temple followers and church
members; from ROC 103 (2014) followers include temple followers only. All five
shipped years (2020-2024) fall inside the post-2014 window; the shipped
follower series is therefore internally consistent; it is not comparable with pre-2014
followers. Churches report clergy and members in separate columns; the shipped
`religious_affiliation_count` is registered temple followers only.

## Sources pinned

### Religion counts — MOI statis yearbook table 06-01 (各宗教教務概況)

- Portal: `https://statis.moi.gov.tw/micst/webMain.aspx?k=menuy` (內政統計年報).
- Table id in the portal's `lrpt` array: `[type=33, rptid=1030, cycle=4]`,
  labelled `01.宗教教務概況`; the file renders as `06-01 各宗教教務概況
  General Conditions of Religions`.
- Download mechanism (two-step, replicated in the build script): (1) GET the
  regenerate URL
  `webMain.aspx?sys=99981&kind=7&cycle=4&funid=331030.ods` (kind=7 = ODF), which
  writes the file server-side, then (2) GET `report/331030.ods`.
- Coverage in the live file (updated 2026/06/30): yearly series **2016-2025**,
  with per-year `YYYY(區域別)` by-locality and `YYYY(宗教別)` by-religion sheets.
  This cleanly covers the requested 2020-2024 window (and 2016-2019 and 2025 sit
  in the same file for a future same-construct extension).
- Columns per locality sheet: `合計` Total (temples+churches), `寺廟` Temples,
  `教(會)堂` Churches, `信徒人數` Followers. English labels are published
  alongside the Chinese.
- Cached: `data/raw/tw_register/moi_religion_general_conditions_331030.ods`
  sha256 `cd39c676e04f088c9f4ecc75e8730ad20d213ab56e8fbea251a52d36f8ddc8a7`.

An archived earlier copy of the same table (`01-03`, through 2019) is at
`https://ws.moi.gov.tw/001/Upload/OldFile/site_stuff/321/2/year/y01-03.ods` and
confirms the identical county×measure structure back to 2001. It is recorded but
not used (the live 06-01 file supersedes it).

### Population denominator — MOI statis yearbook table 02-01 (人口年齡分配)

- Same portal and download mechanism; table id `[type=33, rptid=2010]`,
  `funid=332010.ods` → `report/332010.ods`.
- `02-01 人口年齡分配 Population by Age`, per-year sheets 2016-2025. The
  denominator taken is the both-sexes grand total (`計` / `T.` row, `總計`
  column) per county/city — MOI household-registration year-end resident
  population.
- Cached: `data/raw/tw_register/moi_population_by_age_332010.ods`
  sha256 `db49bab9a35bc4b7e85eb3114c01820ab3e7c9e2dd5a86af6b0c98c25e915ff7`.

### Boundary — geoBoundaries gbOpen TWN ADM1

- `https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/TWN/ADM1/geoBoundaries-TWN-ADM1.geojson`.
- **22 features = the 22 county/city units**, each with an ISO code (`TW-XXX`)
  used as the robust join key. Licence: ODbL 1.0 (from the geoBoundaries API).
- Cached geojson sha256 `deca94f3b490395e09081700860175bd6c217129373a9f77acefa7c1144be90e`;
  API metadata sha256 `156308c69c7754006d7962a4fd6eeea6fa5ca27c9a9c48f97b29a2e0274cca51`.

**Survey-row correction (trust the record over the brief).** The TW survey row
named geoBoundaries **ADM2**. ADM2 is 368 townships/districts; the MOI religion
statistics are county/city, which map to geoBoundaries **ADM1** (22 units).
ADM1 is therefore the correct join layer and is used. Recorded for the PI.

## Licence position

MOI website content — which includes these statistical-yearbook tables — is
released under the MOI **政府網站資料開放宣告** (Open Government Data
Declaration), captured at `https://www.moi.gov.tw/cp.aspx?n=10954`
(`data/raw/tw_register/moi_opendata_declaration.html` sha256
`d4f4ed7bc9c143fa02314a511f8fa59b19d4faa1a82afa5bdc62d9c76f9ea2e6`). Verbatim,
byte-matched to the capture:

> 為利各界廣為利用網站資料，內政部全球資訊網站上刊載之所有資料與素材，其得受著作權保護之範圍，以無償、非專屬，得再授權之方式提供公眾使用，使用者得不限時間及地域，重製、改作、編輯、公開傳輸或為其他方式之利用，開發各種產品或服務（簡稱加值衍生物），此一授權行為不會嗣後撤回，使用者亦無須取得本機關之書面或其他方式授權。然使用時，應註明出處。

This grants free (無償), non-exclusive (非專屬), sub-licensable, irrevocable,
worldwide reuse — reproduce, adapt, edit, publicly transmit — for derivative
products, with attribution required (應註明出處). It is functionally Taiwan's
Open Government Data License. Republishing this project's derived rates with MOI
attribution is clearly permitted. The `data.gov.tw` open-data platform likewise
lists MOI religion datasets under 政府資料開放授權條款-第1版; the canonical
licence text page at `https://data.gov.tw/license` is a JavaScript SPA and does
not serve the terms as static bytes; the MOI declaration capture therefore serves as
the byte-matched licence of record.

The boundary geometry is ODbL 1.0 (geoBoundaries), attribution and share-alike.

## Geography and reconciliation

22 mappable county/city units (6 直轄市 + 14 臺灣省 counties/cities + 2 福建省
counties). The MOI tables also print 臺灣省 and 福建省 provincial subtotals and a
national row; these are used only as reconciliation context, not mapped.

Hard reconciliation gate (stop-don't-tune): for every year the 22 county rows
sum **exactly** to the MOI published national row, for total places, temples,
churches, and followers, and the 22 county populations sum exactly to the
national population. All five years pass exactly:

| Year | Total | Temples | Churches | Followers | Population |
| --- | --- | --- | --- | --- | --- |
| 2020 | 15,216 | 12,303 | 2,913 | 944,938 | 23,561,236 |
| 2021 | 15,183 | 12,281 | 2,902 | 943,874 | 23,375,314 |
| 2022 | 15,165 | 12,288 | 2,877 | 941,895 | 23,264,640 |
| 2023 | 15,196 | 12,316 | 2,880 | 935,472 | 23,420,442 |
| 2024 | 15,206 | 12,361 | 2,845 | 938,504 | 23,400,220 |

## Field mapping (schema slots)

- `place_count` = 合計 total registered places (temples + churches). Primary
  headline; feeds `places_per_10000_residents`.
- `religious_affiliation_count` = 信徒人數 registered temple followers (legacy
  field slot, following the Norway/Denmark membership-construct precedent, with
  explicit construct declaration; not census affiliation).
- `population_total` = MOI household-registration year-end population; the
  per-10,000 denominator.
- `religious_affiliation_percent`, `no_religion_count`, `no_religion_percent`,
  `place_density_per_sq_km`, `land_area_sq_km` = null (no census share; no clean
  land area, geoBoundaries ADM1 includes coastal extents).
- `site_snapshot_date` = year-end (`YYYY-12-31`); `place_count_basis` states the
  register-not-OSM origin.

## Taiwan naming (for the PI, not resolved here)

Area names use the MOI published English names (source of record). geoBoundaries
labels differ for some units: Lienchiang County = Matsu Islands (`TW-LIE`),
Penghu County = Penghu (`TW-PEN`), Kinmen County = Kinmen (`TW-KIN`), and the
six special municipalities drop the "City" suffix. The ISO join is robust to
these. No mainland-China framing question arises in this source and none is
resolved here.

## Access blockers encountered

- `religion.moi.gov.tw` (全國宗教資訊網; ChartReport county tables and the
  temple registry XML `Report/temple.xml`) times out / refuses connection from
  this environment (geo/IP restricted). Not needed: the statis yearbook tables
  06-01 and 02-01 supply a cleaner county×year machine-readable panel.
- `data.gov.tw` v2 REST API requires an Authorization key; dataset pages render
  server-side and were browsable. The relevant statistics live on
  `statis.moi.gov.tw`, which is reachable.

## Reproduce

`Rscript scripts/build_tw_area_summary.R` from the repository root. It
fetches-if-missing into the git-ignored `data/raw/tw_register/`, parses the ODS
via `xml2`, runs the reconciliation and geometry gates, simplifies the boundary
through `scripts/lib/simplify_boundary.R` (mapshaper) below the 3 MB ceiling, and
writes the `area_summary`, boundary GeoJSON, CSV, and manifest.
