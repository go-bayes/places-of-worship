# Country data map: Saint Vincent and the Grenadines (VC)

## Status

- **Tier**: B (national census-affiliation route verified and licensed; a subnational map is blocked by geography and format)
- **Build state**: probed; four-wave national religion series located; no census-division count series or division vector geometry located; no map product written
- **Last verified**: 2026-07-10

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| Statistical Office religion-by-denomination table | census affiliation | national | 1980, 1991, 2001, 2012 | HTML counts and percentages | open web | Statistical Office Open Licence Agreement |
| 2012 Population and Housing Census Report, Tables 2.12 and 2.13 | census affiliation | census division (13) | 2012, 2001 | percentages embedded as JPEG images | open web | Statistical Office Open Licence Agreement |

The national four-wave series is rich and licensed but carries no subnational breakdown. The only religion-by-census-division tables cover just two of the four waves, are percentage-valued, and are embedded as raster images with no text layer; they cannot enter a governed product. No division-level religion is published for 1980 or 1991.

## Access the data yourself

This project has not redistributed the census tables or produced a map product because the subnational religion layer is not published in a usable form.

- **Source of record**: [Statistical Office of St. Vincent and the Grenadines](https://stats.gov.vc/), Population and Demography subject area and Census reports.
- **Exact tables**: [Population by Religious Denomination and Sex, 1980 to 2012](https://stats.gov.vc/subjects/population-and-demography/population-by-religious-denomination-and-sex-1980-to-2012/) (national); [Population and Housing Census Report 2012](https://stats.gov.vc/wp-content/uploads/2018/11/Population-and-Housing-Census-Report-2012.pdf), Tables 2.12 and 2.13 (percentage religion by census division, image-only).
- **Licence**: Statistical Office information is licensed under the [Open Licence Agreement](https://stats.gov.vc/?page_id=1768), which grants a worldwide, royalty-free non-exclusive licence to create derivative and value-added products with its required acknowledgement.
- **Our extraction script**: none. No build script was written; there is no machine-readable division table to reconcile and no division geometry to join.
- **Retrieval recipe and hashes**: [`route-probe.md`](route-probe.md) records the URLs, SHA-256 hashes, category frames, denominators, licence quotes, and gate results. Cached inputs remain under git-ignored `data/raw/vc_census/`.

## Boundaries

- geoBoundaries publishes only [VCT ADM1](https://www.geoboundaries.org/api/current/gbOpen/VCT/ADM1/): six parishes (Charlotte, Saint Andrew, Saint David, Saint George, Saint Patrick, Grenadines), represented 2017, under ODbL 1.0. No ADM2 exists (the API returns 404).
- The census-division frame is 13 units and does not match the six parishes. The Statistical Office publishes census-division maps only as per-division raster PDFs, with no vector download. No licensed vector geometry at the census-division grain was located.

## Places-of-worship layer

- OpenStreetMap coverage assessment: not run during this census-source probe.
- Country-specific registers: not assessed during this census-source probe.

## First visualisation

Blocked: census religious-affiliation percentage by 13 census divisions for 2001 and 2012 would be the natural first product, but the division cells are percentage-only and image-only, and no division vector boundary is licensed. A national four-wave denomination series (1980–2012) is available and licensed but is not a subnational map.

## Build recipe

1. Obtain a machine-readable, count-valued religion-by-census-division table for 2001 and 2012 (and, if it exists, 1980 and 1991), so division cells can reconcile exactly to the national counts.
2. Obtain or construct a licensed census-division vector boundary at the 13-division grain; the geoBoundaries six-parish frame does not match the data.
3. Only after both, require every division category row to equal its printed total and require division values to reproduce every national value exactly.
4. Disclose Not Stated and None/No Religion per wave and any population outside the table basis.
5. Apply the Open Licence Agreement's value-added-product acknowledgement to every shipped surface.

## Risks and open questions

- The four-wave denomination table is national only; the audit's pointer premise, that this table breaks down by census division, does not hold.
- The only census-division religion tables (2012 report, Tables 2.12 and 2.13) are percentages embedded as JPEG images, cover only 2012 and 2001, and were not read by optical character recognition in this lane. Percentage cells cannot reconcile to counts.
- Table 2.15's contents-page title claims a census-division breakdown for 2001, but its body is religion by broad age group; the title is a misprint.
- No census-division vector geometry is published or located. geoBoundaries offers only a six-parish frame with no matching religion data.
- Whether a Redatam base or a count-valued division extract exists for VCT was not resolved; `prod.redatam.org` returned only the portal shell within the time box.

## Deep-history potential

Not surveyed during this route probe.
