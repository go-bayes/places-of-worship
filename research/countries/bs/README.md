# Country data map: Bahamas (BS)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: map live (2010 island level)
- **Last verified**: 2026-07-09

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| BNSI 2010 Census island reports (eighteen volumes), Table 7.0 total population by sex, age group and religion, <https://stats.gov.bs/subjects/population-and-demography/> | census affiliation | island (18) | 2010 | PDF tables | open download | BNSI terms (attribution requested, no explicit reuse licence) |
| BNSI 2010 Census First Release Report, Table 7.0 (All Bahamas) | census affiliation | national | 2010 | PDF | open download | BNSI terms |
| BNSI 2022 Census First Release Report, Table 6.0 (All Bahamas) | census affiliation | national only | 2022 | PDF | open download | BNSI terms |

The 2010 island reports carry a per-island religion table (Table 7.0), so the
2010 wave is mappable subnationally. The 2022 census publishes religion for All
Bahamas only, so 2022 is national context, not a map layer.

## Build state (2026-07-09)

The map ships the 2010 wave at island level: eighteen islands, two headline
metrics (religious affiliation %, no religion %) on the stated-response
denominator. The eighteen islands reconcile exactly to the national 2010 First
Release Report (total 351,461; no religion 6,561; not stated 9,050; affiliation
335,850), and each island report reconciles internally (named religions + none
+ not stated = island total). Boundaries are geoBoundaries BHS ADM1 (32 local
government districts) dissolved up to the census islands.

- Extraction script: `scripts/build_bs_area_summary.R`
- Manifest: `docs/manifests/bs-census-religion-2010.json`
- Region page: `apps/regions/bs/index.html`; overview: `apps/regions/bs/overview.html`

## Probe trail

The central survey risk was whether any SUBNATIONAL religion release exists.
Every probe below was run on 2026-07-09.

- **2010 island census reports** (<https://stats.gov.bs/subjects/population-and-demography/>):
  eighteen island reports, each with Table 7.0 (total population by sex, age
  group and religion). SUBNATIONAL RELIGION FOUND. Report URLs follow
  `https://stats.gov.bs/wp-content/uploads/2020/08/<ISLAND>-2010-CENSUS-REPORT.pdf`
  for Abaco, Acklins, Andros, Berry Islands, Bimini (BIMINIS), Cat Island,
  Crooked Island, Eleuthera, Exuma and Cays (EXUMA-CAYS), Grand Bahama, Harbour
  Island, Inagua, Long Island, Mayaguana, New Providence, Ragged Island, San
  Salvador, and Spanish Wells. These eighteen are the shipped 2010 source.
- **2010 Census First Release Report** (national),
  <https://stats.gov.bs/wp-content/uploads/2020/08/Microsoft-Word-2010-CENSUS-FIRST-RELEASE-REPORT.pdf>:
  Table 7.0 gives All Bahamas religion (total 351,461). Used as the national
  reconciliation authority. Its Table 7.0 is national only (religion is not
  cross-tabulated by island in this report; the island detail lives in the
  eighteen island reports).
- **2022 Census First Release Report**,
  <https://cdn.bahamas.gov.bs/tenant/tenantbnsi/documents/2022-Census-Report-1st-Release-12-February-2025-FINAL-20250526040559.pdf>:
  Table 6.0 gives All Bahamas religion (total 398,165). The report states
  plainly (page i) that "the other Census topics (such as Religion, Marital
  Status, etc.) are reported by Age group and Sex and are for All Bahamas." NO
  2022 SUBNATIONAL RELIGION. Population, by contrast, is tabulated by island and
  supervisory district. Recorded as national context.
- **2022 Census Population Highlights presentation**,
  <https://cdn.bahamas.gov.bs/tenant/tenantbnsi/documents/2022censusofpopulationandhousingpresentation15november2024-20250526040724.pdf>:
  leading denominations shown nationally only; no island religion table.
- **BNSI reports portal** (<https://www.bnsi.stats.gov.bs/reports>): returned
  HTTP 403 to automated retrieval; the population-and-demography subject page
  served the report list instead.
- **geoBoundaries BHS ADM1**,
  <https://www.geoboundaries.org/api/current/gbOpen/BHS/ADM1/>: 32 local
  government districts, CC BY 4.0. The `boundarySource` metadata field reads
  "Haiti GeoPortal", which appears to be a metadata error; the source URL
  resolves to the Caribbean GeoPortal. The 32 districts nest within the census
  islands and were dissolved up to the eighteen island units the reports use.

## Category mapping

- `religious_affiliation` = every named religion in Table 7.0 (Anglican,
  Assemblies of God, Baptist, Brethren, Church of God, Greek Orthodox, Jehovah's
  Witnesses, Pentecostal, Roman Catholic, Seventh Day Adventist, Mormon,
  Methodist, Lutheran, Presbyterian, Bahai, Hindu, Islam, Judaism, Rastafarian,
  Other Christian and Other Non-Christian Denomination, plus each report's Other
  catch-all). Smaller islands collapse the minor denominations into Other, which
  does not affect the headline metric.
- `no_religion` = the census's None category.
- Not stated is excluded from the stated-response denominator (island total
  minus not stated).

## Boundaries

- geoBoundaries BHS ADM1 (32 local government districts, CC BY 4.0), dissolved
  to the eighteen census islands. Rum Cay carries no separate 2010 report and is
  dissolved into San Salvador (the census's historical "San Salvador & Rum Cay"
  unit), so all 32 districts map disjointly onto 18 islands with none left over.

## Access the data yourself

This project does not redistribute source data; the map shows derived rates with
attribution. To obtain the data from the source of record:

- **Source of record**: Bahamas National Statistical Institute,
  <https://stats.gov.bs/subjects/population-and-demography/>.
- **Exact tables**: 2010 island reports, Table 7.0 (total population by sex, age
  group and religion) for each of the eighteen islands; 2010 Census First
  Release Report, Table 7.0 (All Bahamas) as the reconciliation authority.
- **Licence**: BNSI census reports are open downloads with attribution requested
  and no explicit reuse licence stated; boundaries are geoBoundaries BHS ADM1
  (CC BY 4.0, source Caribbean GeoPortal).
- **Our extraction script**: `scripts/build_bs_area_summary.R`.
- **Retrieval recipe and hashes**: `docs/manifests/bs-census-religion-2010.json`.

## BNSI data request recommendation

To add a mappable 2022 wave (and a 2010&ndash;2022 change layer), a BNSI data
request should ask for the **2022 religion tabulation by island and by
supervisory district** &mdash; the same geography the 2022 population tables
already use. The 2022 First Release notes that "more detailed Census data will
be forthcoming", so this cross-tabulation may exist internally or be planned.
The request should specify the full denomination breakdown (not only leading
denominations), the None and Not stated categories, and the geography (island,
then supervisory district).

## Places-of-worship layer

- OSM coverage assessment: not measured in this build; run ohsome or Overpass
  before adding a place layer. No governed place layer or place metric ships
  yet; place-density metrics are hidden on the page.
- Country-specific registers that could seed or verify the layer: Baptist,
  Anglican, Catholic, Methodist, Pentecostal, and Seventh-day Adventist
  directories plus heritage inventories.

## First visualisation

Shipped: religious-affiliation percent and no-religion percent by island for
2010, on geoBoundaries ADM1 dissolved to islands.

## Risks and open questions

- 2022 religion is national only; a subnational 2022 wave depends on a BNSI data
  request (see recommendation above).
- A 2000 subnational religion wave was not located in this sweep.
- The island reports collapse minor denominations into Other on smaller islands,
  so denomination-level maps below the affiliation/no-religion split are not
  uniformly available across islands.

## Deep-history potential

Anglican and Baptist archives, Catholic records, Bahamas National Archives,
Loyalist settlement records, Methodist mission records, and newspapers support
longer site histories.
