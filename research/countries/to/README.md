# Country data map: Tonga (TO)

## Status

- **Tier**: A (buildable now)
- **Build state**: data extracted (2021 district product; country page pending)
- **Last verified**: 2026-07-10

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [Tonga Statistics Department 2021 religion workbook](https://tongastats.gov.to/download/266/general-tables/7664/4-religion.xlsx), `G 19` | census affiliation | district (village rows also published in `G 20`) | 2021 | XLSX | open download | partial scientific, educational, or research reproduction authorised with acknowledgement; commercial reproduction reserved |
| [Tonga 2021 Census of Population and Housing, Volume 1](https://tongastats.gov.to/download/272/census-report-and-factsheet/7647/census-report-vol1-2021.pdf), `G 17` | census affiliation and table definitions | district (village rows also published in `G 18`) | 2021 | PDF | open download | publication-specific TSD terms |
| [Tonga 2016 Census report, Volume 1](https://tongastats.gov.to/download/60/2016/4062/2016-census-report-volume-1-2nd-edition.pdf) | census affiliation | village | 2016 | PDF | open download | TSD publication terms; not shipped |
| [PDH-hosted Tonga 2011 basic tables](https://microdata.pacificdata.org/index.php/catalog/184/download/2684) | census affiliation | village | 2011 | PDF | open download | publication terms; not shipped |
| [PDH-hosted Tonga 2006 basic tables](https://microdata.pacificdata.org/index.php/catalog/183/download/935) | census affiliation | village | 2006 | PDF | open download | publication terms; not shipped |
| [PDH Tonga 1996 Population and Housing Census](https://microdata.pacificdata.org/index.php/catalog/182) | census affiliation metadata | aggregate subnational table not pinned | 1996 | metadata | open metadata; microdata access varies | PDH terms |

The shipped snapshot maps census affiliation. It does not measure religious practice, attendance, or registered membership. Earlier official reports contain district and village religion tables, but their category frames and denominators require a separate extraction before they can support a defensible change series.

## Access the data yourself

This project does not redistribute the source workbook or reports; the governed product contains derived district rates with attribution. To obtain the source data:

- **Source of record**: [Tonga Statistics Department census report and factsheet hub](https://tongastats.gov.to/census-2/population-census-3/census-report-and-factsheet/).
- **Exact tables**: 2021 religion workbook `G 19`, *Population religious affiliation by division and district*, with `G 20` as the village route; Census Volume 1 `G 17` and `G 18` print the corresponding district and village tables.
- **Licence**: the 2021 report authorises partial reproduction for scientific, educational, or research purposes with acknowledgement and reserves commercial or for-profit reproduction. The project does not describe these terms as an unrestricted open licence.
- **Our extraction script**: `scripts/build_to_area_summary.R`.
- **Retrieval recipe and hashes**: `docs/manifests/to-census-religion-2021.json`; the full probe record is `research/countries/to/route-probe.md`.

## Boundaries

- The product uses [geoBoundaries TON ADM2](https://www.geoboundaries.org/api/current/gbOpen/TON/ADM2/): 23 districts, represented year 2020, sourced from Pacific Data Hub, and licensed under Creative Commons Attribution 4.0 International (CC BY 4.0) according to the release metadata.
- All 23 census districts join one-to-one. Three explicit spelling concordances preserve the census and boundary labels. No district is split or merged.
- No licensed village boundary layer was pinned. The 2021 village counts remain a future route rather than a polygon product.
- Earlier-wave boundary stability has not been verified. The 2020 district frame therefore supports the 2021 snapshot only.

## Places-of-worship layer

- No governed Tonga place-of-worship snapshot ships with this product. Place counts and density metrics remain null.
- OSM coverage has not been verified in this build.
- Free Wesleyan, Catholic, Latter-day Saints, and other church directories could seed later site verification, subject to source and licence review.

## First visualisation

Staged: 2021 religious-affiliation percent and no-religious-affiliation percent by district on the 2020 geoBoundaries ADM2 frame. Refused responses remain in the denominator and outside both headline numerators. A country page is outside this build lane.

## Build recipe

1. Extract workbook `G 19` and retain all 22 verbatim source categories.
2. Require every row's categories to sum exactly to its printed `Total`, every district group to sum exactly to its division, and all 23 districts to sum exactly to the national row.
3. Join the 23 district rows one-to-one to geoBoundaries TON ADM2, simplify with `scripts/lib/simplify_boundary.R`, and re-run validity, distinct-geometry, overlap, interior-gap, and size gates.
4. Write the governed `area_summary` JSON and CSV, simplified boundary GeoJSON, and the tracked manifest.
5. Add a country `REGION_CONFIG` page in the separate UI lane and display the denominator, exclusion, source, and licence notes on the shipped surface.

## Risks and open questions

- The 2016 district and village national rows disagree for at least two categories. A later extraction must identify the correct reconciliation authority before using that wave.
- The 2006 district and village tables use different population bases. A longitudinal product must retain the total-population basis and must not substitute the private-household district table.
- Village counts are public for 2006, 2011, 2016, and 2021, but licensed village geometry remains unpinned.
- The 2021 publication terms permit partial research reuse with attribution and reserve commercial reproduction. Commercial downstream use requires separate permission.

## Deep-history potential

Free Wesleyan, Catholic, Latter-day Saints, and other denominational archives can document longer site histories. Tonga National Archives and Wesleyan missionary records are likely starting points, subject to a dedicated source and access survey.
