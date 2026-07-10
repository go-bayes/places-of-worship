# Country data map: Bangladesh (BD)

## Status

- **Tier**: A (2022 district product built to staging)
- **Build state**: 2022 district religion product built and held in staging (BBS reuse terms unresolved). Probe recorded in [route-probe.md](route-probe.md). Subnational religion is pinned only for 2022 (district) and 2011 (community); 2001, 1991, and 1981 subnational religion is unpinned (national figures only).
- **Last verified**: 2026-07-10

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [BBS Population and Housing Census 2022, National Report (Volume I), Table P08](https://bbs.gov.bd/site/page/47856ad0-7e1c-4aab-bd78-892733bc06eb/Population-and-Housing-Census) | Census religion by person | District (64 zila) | 2022 | PDF (text-extractable) | Open web (mirror) | BBS copyright asserted; reuse terms unresolved |
| [BBS Population and Housing Census 2011, Community Report series, Table C-13](https://bbs.gov.bd/site/page/47856ad0-7e1c-4aab-bd78-892733bc06eb/Population-and-Housing-Census) | Census religion by person | Community (union/ward); zila | 2011 | PDF per zila | Open web | BBS copyright asserted; reuse terms unresolved |
| [BBS census reports](https://bbs.gov.bd/) | Census religion by person | National figures located; subnational unpinned | 1981, 1991, 2001 | PDF/web | Open web | BBS copyright asserted; reuse terms unresolved |

The BBS census religion frame is Muslim, Hindu, Christian, Buddhist, and Others, with no no-religion and no not-stated category; affiliation is therefore 100% in every district and the informative signal is the per-category composition. Table P08 is the sex-classified basis and excludes the 8,124 hijra (third gender) persons, who are religion-classified only at division level (Table 3.2.15).

## Access the data yourself

- **Source of record**: Bangladesh Bureau of Statistics, [Population and Housing Census page](https://bbs.gov.bd/site/page/47856ad0-7e1c-4aab-bd78-892733bc06eb/Population-and-Housing-Census).
- **Exact table**: Table P08, "Population by Religion, Sex and District, 2022", in the 2022 National Report (Volume I).
- **Licence**: BBS asserts copyright (ISBN 978-984-475-201-6); no open-reuse licence located. The product is held in staging pending resolution.
- **Our extraction script**: `scripts/build_bd_area_summary.R`.
- **Retrieval recipe and hashes**: `docs/manifests/bd-census-religion-2022.json`.

## Boundaries

| Source | Unit | Match note |
| --- | --- | --- |
| [geoBoundaries BGD ADM2](https://www.geoboundaries.org/api/current/gbOpen/BGD/ADM2/) | District (64 zila) | Boundary ID `BGD-ADM2-16705992`, 64 features, CC BY 3.0 IGO (source BBS, OCHA ROAP). Joins the 2022 census districts exactly 64:64 after a nine-name anglicised-spelling concordance. Shipped simplified to `apps/regions/bd/data/bd_district_2022.geojson`. Add upazila or union only after a consistent official boundary source is selected. |

## Places-of-worship layer

| Source | Role | Note |
| --- | --- | --- |
| [OpenStreetMap](https://www.openstreetmap.org) | Candidate site layer | OSM coverage was not counted in this source sweep. First build should assess mosque saturation and under-tagging of temples, churches, and Buddhist sites. |

## First visualisation

Built: district religion composition for the 2022 census (64 zila) on geoBoundaries ADM2, held in staging. Because the frame has no no-religion or not-stated category, affiliation is 100% everywhere and the map's signal is the popup's per-district Muslim/Hindu/Christian/Buddhist/Others composition. Add 2011 community-level and earlier waves after further table extraction and rights resolution.

## Build recipe

1. Extract Table P08 from the 2022 National Report (Volume I) with `pdftotext -layout`; reconcile 64 districts to 8 divisions to the national row exactly (`scripts/build_bd_area_summary.R`).
2. Join to geoBoundaries BGD ADM2 (64 features) via the anglicised-spelling concordance; the join is exactly 64:64.
3. Product: `apps/regions/bd/data/area_summary_district_2022.{json,csv}` and `bd_district_2022.geojson`; manifest `docs/manifests/bd-census-religion-2022.json`; page `apps/regions/bd/index.html`.
4. Hold in staging (`downstream_status: staged`, `licence_status: needs_review`) until BBS census reuse terms are established.
5. Recover 2011 community/zila and earlier district statistics only after category and boundary comparability are documented.

## Risks and open questions

Public small-area religion maps can increase risk for Hindu, Buddhist, Christian, Ahmadi, and other local minorities. The main data risk is mixing census affiliation with administrative or media-reported minority counts.

## Deep-history potential

High. Bengal census volumes from 1872-1941, Bangladesh National Archives holdings, district gazetteers, waqf records, devottar and temple-trust records, church registers, and monastery records can support deeper histories.
