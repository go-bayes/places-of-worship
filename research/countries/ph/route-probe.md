# Philippines census-religion route probe

Verified 2026-07-11 (build-queue rank 39). The Philippines collected religious affiliation in the 2010 Census of Population and Housing (CPH), the 2015 Census of Population (POPCEN), and the 2020 CPH. The 2020 wave is the strongest route by a wide margin: the Philippine Statistics Authority (PSA) publishes a single machine-readable spreadsheet giving exact household-population **counts** for a 129-category religion frame at the region, province, and highly urbanised city (HUC) level, under an explicit Creative Commons Attribution licence, and the table reconciles to the person against the press release. The 2010 and 2015 waves collected religion (confirmed against PSA metadata and the PSA microdata catalogue) but their consolidated province-level tables were not pinned to an exact URL in this session; recovering them is the one open action that would turn the Philippines from a clean single-wave province product into a three-wave series.

Under the waves-over-districts rule the ideal is the 2010/2015/2020 province series. The realistic recommendation is to **BUILD the 2020 province/HUC product now** (it is licence-clean, machine-readable, and fully reconciling) and open a short follow-up probe to pin the 2010 and 2015 province tables for the time-series extension. A 2020-only Philippines already outranks most single-wave rows because the licence is the cleanest possible (CC BY) and the data are count-valued and exhaustive.

## Institution and publication routes

The Philippine Statistics Authority (PSA) is the source of record. PSA was formed in 2013 (RA 10625) and absorbed the National Statistics Office (NSO), which ran the 2010 CPH; 2010 outputs therefore carry an NSO byline while the current custodian is PSA.

- [PSA main site](https://psa.gov.ph/) — behind a Cloudflare "Just a moment…" JavaScript challenge. `curl` and the WebFetch tool are blocked (HTTP 403, challenge HTML); a real browser session clears the challenge automatically within a few seconds. All PSA fetches in this probe used a browser session, then same-origin `fetch()` for the file bytes.
- [PSA OpenSTAT](https://openstat.psa.gov.ph/) — PxWeb open-data portal. Its census population database (`DB__1A__PO`) was enumerated via the PxWeb API (`/PXWeb/api/v1/en/DB/1A/PO`): nine tables on population, age, sex, housing, and projections, and **no religion cube**. OpenSTAT is therefore not the religion route; the religion route is the census special-release spreadsheet.
- [PSA microdata archive (PSADA)](https://psada.psa.gov.ph/) — catalogues the census microdata (restricted terms, see below); the study descriptions confirm which variables each census collected.

## Waves and published geography

| Wave | Verified religion publication | Published geography | Counts? | Build decision |
| --- | --- | --- | --- | --- |
| 2010 CPH | Religion confirmed as a collected variable ([PSA indicator metadata](https://psa.gov.ph/content/religious-affiliation) names "2010 Census of Population and Housing (CPH) & 2015 Population Census (POPCEN)" as the source; [IHSN catalogue 7171](https://catalog.ihsn.org/catalog/7171) confirms religion at national/region/province/city/municipality/barangay). National figure widely reported as 74,211,896 Roman Catholic (80.6%). | Province (72 of 80 provinces Roman-Catholic-majority per public reporting) | Yes (NSO special releases were count tables) | Extension candidate. **Exact consolidated province-table URL not pinned this session.** |
| 2015 POPCEN | Religion confirmed collected: [PSADA study notes](https://psada.psa.gov.ph/catalog/168) list "religious affiliation" among POPCEN 2015 variables; the 2020 press release compares the top three "In 2015"; regional POPCEN-2015 "Muslim Population" factsheets exist (ARMM RSSO). Referred to as "TABLE 8 Total Population by Religious Affiliation and Sex: 2015". | Total-population universe; region and province in the full table set; provincial Muslim counts confirmed via regional factsheets | Yes | Extension candidate. **Exact consolidated province-table URL not pinned this session.** Universe differs from 2020 (total population, not household population). |
| 2020 CPH | [Religious Affiliation release page](https://psa.gov.ph/content/religious-affiliation-philippines-2020-census-population-and-housing) (release date 22 Feb 2023, reference 2023-70) with three attachments: Press Release, **Statistical Tables (XLSX)**, Technical Notes | Region (17), province (83 province-level rows), HUC (~33 city rows); national | **Yes — exact counts** | **Intended product.** Cached, reconciles exactly (below). |
| 2024 POPCEN | Watch item. The 2024 Census of Population releases so far cover population counts, density, and urban population; **no religion release located.** POPCEN rounds historically carry a shorter form. | — | — | Not available; monitor. |

The single machine-readable file for 2020 is:

- **Table id / title:** `TABLE A. Household Population by Religious Affiliation, Region, Province, and Highly Urbanized City: Philippines, 2020` (first sheet, `A`, of the workbook).
- **URL:** `https://psa.gov.ph/system/files/phcd/3_Statistical Table for Religious Affiliation (for Posting)_RML_12082022_PMMJ_CRD_1.xlsx`
- **Companion documents:** Press Release `…/1_Press Release on Religious Affiliation_RML_01272023_FJRA_PMMJ_CRD-signed_0.pdf`; Technical Notes `…/2_Technical Notes for Religious Affiliation_RML_12082022_PMMJ_CRD_0.pdf`.
- The workbook's second sheet (`Country of Citizenship_w PH`, "TABLE D … by Foreign Country") is unrelated to religion and is ignored.

## 2020 category frame and universe

The universe is the **household population** (Technical Notes: "data on the Religious Affiliation of all household members were collected by asking the respondent, 'What is _____'s religious affiliation?'"). The frame in Table A has **129 mutually exclusive columns** that sum exactly to the household population: a "None" column (col 2, 43,931 nationally — no religious affiliation), 124 named denominations, four residual groups (`Other Baptists`, `Other Evangelical Churches`, `Other Methodists`, `Other Protestants`), `Other religious affiliations`, and `Not reported`. The frame is extremely granular — individual churches down to a few thousand adherents are separate columns.

Two frame subtleties the builder must encode:

- **Roman Catholic is split.** The column `Roman Catholic, excluding Catholic Charismatics` (85,645,362) is a separate column from `Catholic Charismatic` (74,096). The press-release headline "Roman Catholic … 78.8%" uses the *excluding-charismatics* column verbatim; it does not add the charismatic column. A build must decide whether to display Roman Catholic as the excluding-charismatics column (matches the headline) or as the sum.
- **Islam** is a single column (col 47, 6,981,710); `Iglesia ni Cristo` (col 62, 2,806,524) and `Iglesia Filipina Independiente`/Aglipay are distinct columns. Any collapse to a coarse map frame (Catholic / Muslim / INC / other Christian / other / none) is a build-time design choice, not a source feature.

Reconciling the 2020 frame to whatever coarser categories the 2010 and 2015 tables publish is the main comparability task for a multi-wave series.

## Licence position (verbatim)

PSA's terms are unusually permissive — the cleanest licence in the queue to date. Quoted byte-for-byte from [https://psa.gov.ph/terms-of-use](https://psa.gov.ph/terms-of-use) (retrieved 2026-07-11):

> The statistical tables (or datasets) including documents (collectively as material) on this site are classified under Open Data with Creative Commons Attribution License (cc-by). This means that you are free to share (copy and redistribute) the material in any medium or format; remix, transform and build upon the material for any purpose, non-commercial and even commercially under the following conditions:

> 1. Attribution - you must give appropriate credit by acknowledging the Philippine Statistics Authority (PSA) or the source agency as indicated in the datasets, provide a link to this page, and indicate if changes were made. …

> 2. No additional restrictions - you may not apply legal terms or technological measures that legally restrict others from doing anything the license permits.

The same page links the deed target: `Read the full license: https://creativecommons.org/licenses/by/4.0/legalcode` (i.e. CC BY 4.0). The site footer (every PSA page) adds:

> All content is in the public domain unless otherwise stated.

OpenSTAT states its own open-data position at [https://openstat.psa.gov.ph/](https://openstat.psa.gov.ph/) (retrieved 2026-07-11):

> This system allows the PSA to share data under an open data license where data can be freely used, re-used and redistributed by anyone without any restrictions other than proper source attribution.

**Microdata caveat (do not conflate with the published tables).** The census *microdata* in the PSADA / IHSN archive carry restrictive terms — the [IHSN 2010 CPH record](https://catalog.ihsn.org/catalog/7171) states users must not redistribute, "The NSO retains all intellectual property rights and copyright in the data," recommended citation `2010 Census of Population and Housing, v1.1, National Statistics Office, Manila, Philippines`. This probe's product uses only the **published aggregate tables**, which fall under the CC BY Terms of Use, not the microdata.

## Boundaries and reconfigurations

- **Provinces (ADM2):** [geoBoundaries PHL ADM2](https://www.geoboundaries.org/api/current/gbOpen/PHL/ADM2/) — boundaryID `PHL-ADM2-2640588`, year represented **2020**, **87 units**, licence `Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO)`, sources NAMRIA + PSA + OCHA Philippines. GeoJSON: `https://github.com/wmgeolab/geoBoundaries/raw/41af8f1/releaseData/gbOpen/PHL/ADM2/geoBoundaries-PHL-ADM2.geojson` (simplified sibling `…_simplified.geojson`).
- **Regions (ADM1):** [geoBoundaries PHL ADM1](https://www.geoboundaries.org/api/current/gbOpen/PHL/ADM1/) — boundaryID `PHL-ADM1-36201628`, year 2020, **17 units**, same CC BY 3.0 IGO licence. The 17 ADM1 regions match the 2020 census region frame exactly.

**Join feasibility (not 1:1 at province+HUC level).** The census tabulation frame is not a clean ADM2 partition:

- The census reports HUCs on their own rows and adjusts the host-province rows accordingly — e.g. `Basilan (excluding the City of Isabela)`, `Maguindanao (including the City of Cotabato)`, `Cebu` reported "excluding its three HUCs". geoBoundaries ADM2 (87 provinces) does not carve the 33 HUCs out as separate polygons. A build must therefore either (a) **aggregate each HUC back into its host province** to obtain a clean ~87-unit ADM2 choropleth (simplest; loses HUC granularity), or (b) source a boundary layer that separates HUCs (official PSA/NAMRIA city layer, or OSM city relations) for a finer map. Option (a) is the safe first product.
- **BARMM Special Geographic Area ("Interim Province 1", 215,348 persons).** A 2020-only unit of 63 barangays carved from six municipalities of Cotabato province (Region XII), tabulated as a province-level row in BARMM. It has **no ADM2 polygon** and no stable boundary; treat as a documented no-boundary residue (aggregate into its region for a clean map, or omit with disclosure).
- **Maguindanao split (2022):** the province split into Maguindanao del Norte and del Sur *after* the 2020 census, so 2020 uses undivided Maguindanao and matches the year-2020 ADM2 layer 1:1. A 2010/2015/2020 series should anchor on a single boundary vintage (undivided Maguindanao) and document the post-2020 split as out of period.
- **Negros Island Region (NIR):** created 2015, dissolved 2017, re-created 2024. The 2020 census places Negros Occidental under Region VI and Negros Oriental under Region VII — consistent with the year-2020 ADM1 layer. No NIR reconciliation is needed for 2020; a 2015 wave predates the dissolution and may show NIR, requiring a region-crosswalk for any region-level series.

## Reconciliation anchors (2020, all exact against the cached XLSX)

- National household population: **108,667,043**. The 129 religion columns sum to **108,667,043** (residual 0).
- The 17 region rows sum to **108,667,043** (residual 0).
- Headline categories match the press release to the person: Roman Catholic (excl. charismatics) 85,645,362 (78.8%); Islam 6,981,710 (6.4%); Iglesia ni Cristo 2,806,524 (2.6%).
- Regional check points from the press release for a builder's spot-test: BARMM Islam 4.49 million at 90.9% of 4,938,539 household population; Bicol (Region V) 93.5% Roman Catholic; Tawi-Tawi 97.2% Islam of 438,545. (Exact regional/provincial counts are recoverable directly from Table A once the builder parses it.)

The 2020 table therefore passes every-row and category-sum reconciliation trivially — no source-arithmetic discrepancy of the kind seen in Côte d'Ivoire.

## Retrieval and cache record

All 2020 files retrieved 2026-07-11 through an authenticated browser session (Cloudflare-cleared), then same-origin `fetch()` to obtain bytes; SHA-256 computed in-browser (SubtleCrypto) and re-verified locally after reconstruction. Cached under `data/raw/ph_census/` (git-ignored; confirmed via `git check-ignore`).

| Cached file | Bytes | SHA-256 |
| --- | --- | --- |
| `stat_table_2020_religion.xlsx` | 263,950 | `73d8fa9729dbed6a3b7fdab4bae64f43315fde09deaeaa66eda1a13c7fbe7709` |
| `pr_2020_religion.pdf` | 599,362 | `d8c4b3421d6e6e3a137adbae03432bf5d44fae457d151de4071f713acb96b1c2` |
| `tech_notes_2020_religion.pdf` | 169,617 | `f82f0dd86478a8ca2853498faa57c16206cacad7b40c86a78985ab20017b7677` |

## Blockers

1. **2010 and 2015 province tables not pinned to exact URLs.** Both waves collected religion (confirmed), but this session did not locate the consolidated province-level count spreadsheets/PDFs. The PSA site's "Statistical Tables" and release-index pages are JavaScript-rendered and slow through the browser bridge; the tables likely live under a 2010/2015 census special-release page or the PSA Digital Library. This is the gate for a multi-wave series, not for a 2020 build.
2. **Cross-wave frame comparability.** 2020 has 129 categories; 2010/2015 NSO/PSA releases used coarser frames and a different universe in 2015 (total population vs 2020 household population). A common map frame and denominator rule must be defined once the 2010/2015 tables are in hand — change-over-time should be withheld until the frames are reconciled (Croatia/Bulgaria precedent).
3. **Boundary join at HUC granularity.** The province+HUC census frame does not partition geoBoundaries ADM2. Ship the first product at the ~87-unit province level (HUCs aggregated into host provinces), and treat the BARMM Special Geographic Area as a no-boundary residue.
4. **Access friction.** PSA is Cloudflare-gated: automated fetchers are blocked; a browser session is required for every download. Not a licence problem, an operational one.

## Build / hold recommendation

**BUILD the 2020 province product now.** It is machine-readable, count-valued, exhaustive, reconciles to zero residual, and is covered by an explicit CC BY 4.0 Terms of Use plus a public-domain footer — the cleanest licence position in the queue. Ship at the province level on geoBoundaries PHL ADM2 (year 2020, CC BY 3.0 IGO), aggregating the 33 HUC rows into their host provinces and documenting the BARMM Special Geographic Area residue. Map a coarse religion frame (Roman Catholic excl. charismatics / Islam / Iglesia ni Cristo / other Christian / other / none / not reported) collapsed from the 129 columns, and record the Roman-Catholic-excluding-charismatics convention on the information surface.

**Then extend to a series (follow-up probe).** A focused pass to pin the 2010 CPH and 2015 POPCEN province religion tables would upgrade the Philippines to a 2010/2015/2020 three-wave province series — the waves-over-districts ideal. Hold change-over-time until those tables are located and the category frame and denominator are reconciled across waves. No PI licence ruling is required to ship 2020 (CC BY is unambiguous); the only PI-worthy design question is the coarse-frame category mapping, which follows existing precedent.
