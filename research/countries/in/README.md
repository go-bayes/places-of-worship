# Country data map: India (IN)

## Status

- **Tier**: A
- **Build state**: Country product built for 2001 and 2011 district C-01 data; hub registration pending.
- **Last verified**: 2026-07-09

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [Census of India C-01: Population by religious community, 2011](https://censusindia.gov.in/nada/index.php/api/tables/data/global/census_tables/100/0/?ft_query=C-01%20Population%20by%20religious%20community&series_id=15&census_year=2011) | Census religious affiliation by community | District | 2011 | XLS by state | Open download | Government Open Data License - India attribution basis |
| [Census of India C-01: Population by religious community, 2001](https://censusindia.gov.in/nada/index.php/api/tables/data/global/census_tables/100/0/?ft_query=C-01%20Population%20by%20religious%20community&series_id=15&census_year=2001) | Census religious affiliation by community | District | 2001 | XLS by state | Open download | Government Open Data License - India attribution basis |
| [Census of India C-9: Religion, 1991](https://censusindia.gov.in/nada/index.php/catalog/35737/download/39400/1991-C09T-0100.xlsx) | Census religion | District in source workbook | 1991 | XLSX | Open download | Government Open Data License - India attribution basis |

The Census of India C-01 category set has no no-religion category. It has Hindu, Muslim, Christian, Sikh, Buddhist, Jain, Other religions and persuasions, and Religion not stated. Religion not stated is a non-response category. It is not no religion.

## Access the data yourself

- **Source of record**: Office of the Registrar General and Census Commissioner, India, through the [Census tables portal](https://censusindia.gov.in/census.website/data/census-tables) and NADA table API.
- **Exact tables**: `PC11_C01` and `PC01_C01`, both titled `C-01: Population by religious community`; deferred source `1991-C09T`, titled `C-9 Religion`.
- **Licence**: The build records the [Government Open Data License - India](https://www.data.gov.in/sites/default/files/Gazette_Notification_OGDL.pdf) as the attribution basis for public Census of India data.
- **Our extraction script**: `scripts/build_in_area_summary.R`.
- **Retrieval recipe and hashes**: `docs/manifests/in-census-religion-2001-2011.json`.

## Boundaries

- **2001 districts**: [DataMeet India community `Districts/Census_2001`](https://github.com/datameet/maps/tree/master/Districts/Census_2001), Creative Commons Attribution 2.5 India.
- **2011 districts**: [DataMeet India community `Districts/Census_2011`](https://github.com/datameet/maps/tree/master/Districts/Census_2011), Creative Commons Attribution 2.5 India.
- **Fallback assessed**: [geoBoundaries IND ADM2](https://www.geoboundaries.org/api/current/gbOpen/IND/ADM2/) is a current-boundary fallback, recorded as 2021 ADM2 under Open Database License 1.0. It is not used in the built product because DataMeet provides period district layers that match the 2001 and 2011 Census district codes.

## Places-of-worship layer

- OpenStreetMap coverage has not yet been counted for India.
- The country page hides place-density metrics until a governed India place-of-worship extract exists.

## First visualisation

The first built visualisation maps religious-affiliation percent by district for 2001 and 2011. The numerator is Hindu + Muslim + Christian + Sikh + Buddhist + Jain + Other religions and persuasions. The denominator is C-01 total persons; Religion not stated therefore lowers the percentage without being treated as no religion.

## Built map

- **App route**: `apps/regions/in/index.html`.
- **Product files**: `apps/regions/in/data/area_summary_district_2001.json`, `apps/regions/in/data/area_summary_district_2011.json`, `apps/regions/in/data/districts_2001.geojson`, and `apps/regions/in/data/districts_2011.geojson`.
- **Waves**: 2001 and 2011.
- **Boundary basis**: separate period district boundary sets, with no crosswalked change layer.
- **Validation**: 593/593 matched 2001 district rows and 640/640 matched 2011 district rows; district sums reconcile exactly to state rows and the all-India row for each built wave.

## Build recipe

1. Extract the 2001 and 2011 C-01 state XLS workbooks from the Census India API manifests.
2. Keep district `Total` rows only, sum the seven affiliation categories, and leave no-religion values null.
3. Join 2001 rows to DataMeet Census 2001 districts and 2011 rows to DataMeet Census 2011 districts by Census district code.
4. Simplify each boundary GeoJSON below 3 MB and write `area_summary` JSON/CSV files.
5. Reconcile district sums against state and all-India source totals before writing the manifest.

## Risks and open questions

- The 1991 C-9 workbook is pinned and cached, but the map defers it because Jammu and Kashmir was not enumerated in 1991 and the build does not include clean 1991 district boundaries or state-split harmonisation.
- The no-religion construct is absent. Public copy must never equate Religion not stated with no religion.
- District boundaries changed heavily between waves. The page switches boundary vintage by year and does not calculate a change layer.
- OpenStreetMap coverage and India-specific registers still need a separate site-layer assessment.

## Deep-history potential

Census of India printed volumes, administrative atlases, state gazetteers, National Archives of India holdings, waqf records, temple-trust records, missionary records, and Archaeological Survey of India monument registers can support future research on older places of worship.
