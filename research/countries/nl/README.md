# Country data map: Netherlands (NL)

## Status

- **Tier**: A
- **Build state**: Data extracted; separate annual province affiliation and attendance survey products built; region-page wiring remains open.
- **Last verified**: 2026-07-10

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [CBS StatLine 83288NED](https://opendata.cbs.nl/ODataApi/OData/83288NED) | Self-reported religious affiliation, people aged 15+ | Province | 2010-2015 annual | OData JSON | Open | CC BY 4.0 |
| [CBS StatLine 83288NED](https://opendata.cbs.nl/ODataApi/OData/83288NED) | Self-reported attendance at religious or worldview gatherings, total population aged 15+ | Province | 2010-2015 annual | OData JSON | Open | CC BY 4.0 |
| [CBS Religie naar regio](https://www.cbs.nl/nl-nl/maatwerk/2026/11/religie-naar-regio-2021-2025) | Self-reported religious affiliation, people aged 15+ | Province and most COROP regions | 2021-2025 five-year average | Workbook | Open | CBS website terms |
| [CBS StatLine 37850](https://www.cbs.nl/nl-nl/cijfers/detail/37850) and [Volkstellingen](https://www.volkstellingen.nl/) | Census affiliation through 1971; later survey estimates in table 37850 | Province; finer historical tables vary | 1849-1971 census context | StatLine/scans/tables | Open web | Context only; reuse not assessed |

Affiliation and attendance are separate constructs. The annual source publishes
rounded whole percentages and states that sampling uncertainty exists. It does
not publish standard errors or confidence intervals in the OData table.

## Access the data yourself

The repository contains derived province percentages and simplified boundaries.
The raw API responses remain in the gitignored local cache.

- **Source of record**: Statistics Netherlands (CBS) StatLine OData API; Kadaster / PDOK for current province boundaries.
- **Exact tables**: `83288NED` for the annual province series and `82904NED` for national comparisons.
- **Licence**: CBS StatLine and PDOK Bestuurlijke Gebieden are CC BY 4.0. Attribute CBS and Kadaster / PDOK, respectively.
- **Our extraction script**: `scripts/build_nl_area_summary.R`.
- **Retrieval recipe and hashes**: `docs/manifests/nl-survey-religion-2010-2015.json`.

## Boundaries

- Official boundary file: [PDOK Bestuurlijke Gebieden](https://api.pdok.nl/kadaster/brk-bestuurlijke-gebieden/ogc/v1?f=html), current `provinciegebied`, CC BY 4.0.
- StatLine `PV20` through `PV31` join directly to PDOK province codes `20` through `31`.
- The product uses current 2026 province areas to display 2010-2015 estimates. Province identities are stable, but small historical boundary corrections are not reconstructed.

## Places-of-worship layer

| Source | Role | Note |
| --- | --- | --- |
| [OpenStreetMap](https://www.openstreetmap.org) | Candidate site layer | OSM coverage was not counted in this source sweep. First build should assess Christian heritage buildings separately from active worship sites. |

## First visualisation

Map self-reported religious affiliation by province for 2010-2015. Offer the
attendance product as a separate practice view with weekly-or-more and
seldom-or-never attendance.

## Build recipe

1. Extract the 12 province rows for every 2010-2015 year from CBS `83288NED`.
2. Build separate affiliation and attendance `area_summary` products; never combine the constructs.
3. Retrieve and simplify the current PDOK `provinciegebied` collection.
4. Compare four national indicators with CBS `82904NED` for 2010, 2012, and 2015.
5. Validate 72 rows per product, 12 boundary joins per year, JSON structure, manifest schema, and output sizes.

## Risks and open questions

- CBS does not publish confidence intervals or standard errors in `83288NED`; every row carries a missing-interval survey flag.
- Whole-percentage rounding limits fine comparisons between provinces and adjacent years.
- The 2021-2025 regional release is a five-year average from a different survey and does not extend the annual panel.
- CBS marks table 83288NED as discontinued (ReasonDelivery: Stopgezet) with no further figures; the annual provincial panel therefore ends at 2015 at the source.
- Historical census categories and population universes require explicit harmonisation before comparison with modern survey categories.

## Deep-history potential

High. Digitised census tables, municipal archives, church registers, synagogue archives, cadastral records, monument registers, and historic address books can support deeper site histories.
