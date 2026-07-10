# Country data map: Norway (NO)

## Status

- **Tier**: B
- **Build state**: Built; the public product ships annual Church of Norway administrative membership counts for 11 dioceses on the direct Geonorge 2025 diocese frame.
- **Last verified**: 2026-07-10

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [SSB table 06929, Church of Norway members](https://data.ssb.no/api/v0/en/table/DNKMedlemmer) | Church of Norway administrative membership register | Diocese | 2005-2025 | JSON-stat API | Open API | [CC BY 4.0](https://www.ssb.no/en/diverse/lisens) |
| [SSB table 06339, Christian communities outside the Church of Norway](https://data.ssb.no/api/v0/en/table/MedlemKristTrus) | Registered Christian community membership | National | 2006-2026 | JSON-stat API | Open API | [CC BY 4.0](https://www.ssb.no/en/diverse/lisens) |

Table 06339 is deferred national-context work. Its national values must remain separate from the diocese product.

## Boundaries

| Source | Unit | Match note |
| --- | --- | --- |
| [Kartverket Geonorge `Soknegrenser`](https://kartkatalog.geonorge.no/Metadata/uuid/289d459c-0390-4000-84f3-88982f2cdb0c) | Diocese | The nationwide SOSI package contains 11 direct `Bispedømme` surfaces effective from 1 January 2025. The metadata records `No conditions apply to access and use`. |

The [boundary probe](diocese-boundary-probe.md) records the catalogue search, source topology, fixed tolerance, geometry hashes, and boundary-vintage ruling. The successful direct-polygon route requires no municipality concordance.

## Places-of-worship layer

| Source | Role | Note |
| --- | --- | --- |
| [OpenStreetMap](https://www.openstreetmap.org) | Candidate site layer | OSM coverage was not counted in this source sweep. First build should review rural church completeness and non-Lutheran under-tagging. |

## First visualisation

Map Church of Norway administrative member-register counts by diocese for 2005-2025. Use proportional symbols because table 06929 publishes counts and no diocese population percentage. A later national chart may show registered-community membership from table 06339 as separate context.

## Build recipe

Run `Rscript scripts/build_no_area_summary.R` from the repository root. When the raw cache is absent, the script makes two SSB data POST requests plus metadata and licence GET requests. One data POST covers all diocese categories; the other omits the optional diocese dimension to obtain the published national totals. The script also orders the nationwide Geonorge SOSI package, reconstructs the 11 direct diocese surfaces from their own curve references, simplifies through `scripts/lib/simplify_boundary.R`, and writes the area-summary JSON/CSV, boundary GeoJSON, and manifest.

The products are `apps/regions/no/data/area_summary_diocese.json`, `apps/regions/no/data/area_summary_diocese.csv`, `apps/regions/no/data/no_diocese_2025.geojson`, and `docs/manifests/no-membership-2005-2025.json`. The area-summary file contains 231 mapped rows: 11 dioceses for every year from 2005 through 2025.

The build preserves SSB's published category and English geography labels verbatim. The membership label currently contains duplicated wording in the SSB API metadata; the product does not silently rewrite it. `Unknown diocese` remains unallocated. For every year, the 11 mapped counts plus `Unknown diocese` equal SSB's published national total exactly.

## Risks and open questions

Diocese is an ecclesiastical unit rather than a standard statistical geography. The construct is administrative Church of Norway register membership. It is never census affiliation, belief, or attendance. SSB changes the membership definition in 2021: through 2020 the variable includes members and an unbaptised child under 18 of a member; from 2021 it includes members only. SSB also warns that national totals from 2011 cannot be compared with earlier years because `Unknown diocese` is included from 2011.

The product applies the one Geonorge boundary frame effective 1 January 2025 to the full time series. Counts follow SSB's published diocese assignment for each reference year. The boundary probe records the resulting boundary-vintage limitation, Svalbard exclusion, and size of the unallocated `Unknown diocese` category. The direct surfaces extend through coastal waters. The product therefore leaves land area and density fields null.

## Deep-history potential

High. Church books, Digitalarkivet, parish histories, National Archives holdings, cultural heritage registers, local newspapers, and historic maps can support deeper site histories.
