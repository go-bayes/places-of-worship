# Country data map: Denmark (DK)

## Status

- **Tier**: A
- **Build state**: Data extracted; parish and municipality membership products built; region-page wiring remains open.
- **Last verified**: 2026-07-10

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [Statistics Denmark StatBank KM1](https://api.statbank.dk/v1/tableinfo/KM1?lang=en) | Church of Denmark administrative membership | Parish | 2007Q1-2026Q1 extracted; 2023Q1-2026Q1 shipped on current parish boundaries | API/CSV | Open | StatBank free reuse; CC BY 4.0 correspondence |
| [Statistics Denmark StatBank KM6](https://api.statbank.dk/v1/tableinfo/KM6?lang=en) | Church of Denmark administrative membership | Municipality | 2011-2026, 1 January | API/CSV | Open | StatBank free reuse; CC BY 4.0 correspondence |
| [Ministry of Ecclesiastical Affairs church statistics](https://www.km.dk/folkekirken/kirkestatistik/folkekirkens-medlemstal/) | Church of Denmark administrative membership | National and church geography | 1984 and 1990-2026 in public summaries | HTML/PDF | Open web | Ministry terms |
| [sogn.dk parish facts](https://www.sogn.dk/odder/fakta-om-sognet/) | Church of Denmark administrative membership | Parish | Current parish page values | HTML | Open web | Church website terms |

Church of Denmark membership is an administrative register construct. It is not census religious affiliation, all-religion membership, belief, or attendance. The map share is member divided by member plus non-member in the same source row, expressed as a percentage.

## Access the data yourself

This project does not commit the raw StatBank CSVs; the public membership products contain derived counts, rates, and simplified boundary files with attribution. To obtain the data from the sources of record:

- **Source of record**: Statistics Denmark StatBank API for KM1 and KM6; DAWA/DAGI for current parish and municipality boundaries.
- **Exact tables**: `KM1` (`SOGN`, `FKMED`, `Tid`) and `KM6` (`KOMK`, `KØN`, `ALDER`, `FKMED`, `Tid`).
- **Licence**: StatBank data are free to reuse with source reference, corresponding to Creative Commons Attribution 4.0 International; KDS geographical data are Creative Commons Attribution 4.0 International with Klimadatastyrelsen attribution.
- **Our extraction script**: `scripts/build_dk_area_summary.R`.
- **Retrieval recipe and hashes**: `docs/manifests/dk-membership-2011-2026.json`.

## Boundaries

- Official boundary files: DAWA/DAGI current `sogne` and `kommuner` GeoJSON from Dataforsyningen, recorded as KDS geographical data under CC BY 4.0.
- The parish product uses current DAWA/DAGI sogn boundaries. The parish product ships 2023-2026 only because those years have dropped non-zero source parish-code rates below 3% against the current boundary codes.
- KM1 parish waves before 2023 are deferred. Parish mergers and code churn require a governed parish concordance layer before those years can be interpreted on current geometries.
- The municipality companion uses current DAWA/DAGI kommune boundaries for 99 municipalities and ships 2011-2026; every year reconciles exactly to the national total derived from the full KM6 municipality extract.

## Places-of-worship layer

- [OpenStreetMap](https://www.openstreetmap.org) remains the candidate site layer. OSM coverage has not yet been counted for Denmark. Church buildings need active-use review before a governed site layer ships.

## First visualisation

Map Church of Denmark membership share by parish for 2023-2026 Q1 on current sogn boundaries. Use the 2011-2026 kommune companion for the longer change story.

## Build recipe

1. Extract KM1 parish Q1 rows for 2007-2026 and KM6 municipality rows for 2011-2026 from the StatBank API.
2. Build `area_summary_sogn.{json,csv}` for 2023-2026 only, retaining full member and non-member counts on every matched row.
3. Record dropped source parish codes and member/non-member counts in the manifest, and defer pre-2023 parish waves until a concordance layer is available.
4. Build `area_summary_kommune.{json,csv}` for 99 municipalities, 2011-2026, by summing KM6 sex and age groups.
5. Simplify current DAWA/DAGI boundaries with mapshaper weighted keep-shapes: `dk_sogn_2026.geojson` at 3% keep and `dk_kommune_2026.geojson` at 1% keep.
6. Verify national reconciliation, year coverage, boundary feature counts, and JSON validity before wiring a Denmark region page.

## Risks and open questions

- The source covers Church of Denmark membership only. It does not measure all religious affiliation.
- Parish mergers and splits need a concordance layer before pre-2023 parish waves ship.
- DAWA/DAGI API access should be monitored because the current route is a legacy current-boundary service.
- No governed Denmark place-of-worship layer is included yet.

## Deep-history potential

High. Danish church books, parish registers, kirkestatistik, National Archives holdings, local histories, cemetery records, and historic maps can support deeper site histories.
