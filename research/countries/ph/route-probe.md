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

## Build appendix (2026-07-11)

The 2020 province product was built by `scripts/build_ph_area_summary.R` from the cached PSA table and geoBoundaries gbOpen PHL ADM2 (simplified sibling, pinned commit 41af8f1). Deliverables: `apps/regions/ph/data/area_summary_adm2.{json,csv}`, `apps/regions/ph/data/ph_adm2_2020.geojson`, and `docs/manifests/ph-census-religion-2020.json`. The tree is left uncommitted for the conductor's review.

**None-category finding.** The 129-category frame contains a verbatim `None` column (no religious affiliation), 43,931 nationally (0.0%), separate from `Not reported` (15,186). The no-religion slot is wired to `None` verbatim; the affiliation share therefore varies across areas and is not flat by construction. The Philippines does **not** share the BD/KH/PW flat-affiliation gate. `religious_affiliation_count` is household population minus `None` minus `Not reported`; `no_religion_count` is `None`.

**Geography and HUC folding.** geoBoundaries PHL ADM2 has 87 features: 81 provinces, four NCR legislative-district polygons, and standalone `City of Isabela` and `Cotabato City` polygons. The build ships **86 mapped units**: 81 provinces (with 17 HUC census rows folded into their host provinces), the four NCR districts (16 NCR cities plus the Municipality of Pateros aggregated by legislative district), and `City of Isabela` (a separate ADM2 unit tabulated under Region IX, kept standalone). The `Cotabato City` polygon is merged into `Maguindanao` because the census tabulates Cotabato City inside `Maguindanao (including the City of Cotabato)` with no separate row. HUC→unit mapping records: **34** (17 HUC-to-host-province plus 17 NCR-city-to-district), all listed in the manifest `pipeline.parameters.huc_folding.mappings`.

**Name normalisations (all documented in the manifest).** `Davao de Oro (Compostela Valley)` → geoBoundaries `Compostela Valley` (2019 rename); `Cotabato (North Cotabato)` → `Cotabato`; `Samar (Western Samar)` → `Samar`; `Maguindanao (including the City of Cotabato)` → `Maguindanao` (plus Cotabato City polygon merge); `Basilan (excluding the City of Isabela)` → `Basilan` (Isabela City ships separately). The join after folding is one-to-one across all 86 units (no missing or extra names).

**Gate results (all exact, fail-fast).**
- 129 national category cells sum to 108,667,043 (residual 0).
- 17 regions sum to national per category; every region equals its printed component sum (total and per-category).
- Headline: Roman Catholic (excl. charismatics) 85,645,362; Islam 6,981,710; Iglesia ni Cristo 2,806,524 — match the press release to the person.
- Named-ten-plus-`Other categories`-plus-`None`-plus-`Not reported` decomposition sums to every area total. The named ten reproduce PSA press-release Table 1 (cut = the ten largest specific affiliations, excluding the source's five aggregate `Other …` grouping columns; equivalently every specific affiliation with national count ≥ 429,921, Church of Christ). `Other categories` residual = 8,954,291 nationally.
- 86 mapped units + SGA residue (215,348) = 108,667,043 per category. The BARMM Special Geographic Area (Interim Province 1) has no polygon; it is reconciled in the national roll-up only and never distributed (Norway Unknown-diocese precedent).
- Boundary: 86 valid, non-empty features with distinct geometry hashes; simplified via `scripts/lib/simplify_boundary.R` at 60% keep to 1,013,624 bytes (ceiling 1,900,000).

**Universe.** Household population (108,667,043), the universe of the religion table; disclosed in every row's `population_total_basis`, indicators, and construct notes. It differs from total population; change over time is withheld until the 2010 and 2015 waves are pinned.

**Validation commands and outputs (run from repo root).**
```
$ uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json apps/regions/ph/data/area_summary_adm2.json
ok -- validation done
$ uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/data-manifest.schema.json docs/manifests/ph-census-religion-2020.json
ok -- validation done
$ bash scripts/validate_manifests.sh
manifest validation: 61/61 pass
```

**Committed output sha256.**
```
b0bada46f634584257de03bf87e9e90117c1aaf5eaf482a392da833120f65b6c  apps/regions/ph/data/area_summary_adm2.json
e439d99185a570b3d682c3ab125f051d195ddaec0fa82df8515c78508b8e5189  apps/regions/ph/data/area_summary_adm2.csv
8f6280eb0d160d1c2e4bd95305df6491ed9ff5cfc714e5c3110362932fe674e2  apps/regions/ph/data/ph_adm2_2020.geojson
```

**Cache and GCS mirror.** `data/raw/ph_census/` (git-ignored) holds the PSA workbook, press release, technical notes (all with sha256 above), plus the geoBoundaries ADM2 metadata and simplified GeoJSON (fetched from GitHub, not Cloudflare-gated). GCS mirror of `data/raw/ph_census/` is **pending** (recorded in the manifest `source.raw_redistribution`).

**Open questions for the conductor.**
1. Page not built (out of scope): `apps/regions/ph/index.html` and hub wiring remain. The area-summary carries `metricsAvailable`-ready indicators (`religious_affiliation_percent`, `no_religion_percent`); place-density metrics are hidden (no governed PH place layer). geojson join keys: `codeProp = "area_code"` (geoBoundaries shapeID), `nameProp = "area_name"`.
2. Display names keep the census verbatim parentheticals where accurate (`Maguindanao (including the City of Cotabato)`, `Basilan (excluding the City of Isabela)`) since the mapped unit genuinely includes/excludes those cities after folding. Confirm this is the preferred surface wording, or switch to bare province names.
3. Two-wave extension (2010 CPH, 2015 POPCEN) stays deferred: province tables not pinned, and the 2015 universe (total population) differs from 2020 (household population). Recorded in the manifest `deferred_sources`.

## Wave-extension probe (2010/2015)

Verified 2026-07-11 (probe-only follow-up; the 2020 product and page are shipped and untouched). Both earlier waves are now pinned to exact downloadable tables. The 2010 CPH and 2015 POPCEN province religion tables are published only as per-province PDF publications in the PSA Library — the Philippines has no single machine-readable religion-by-province file for either earlier wave, unlike the 2020 XLSX. Each publication carries a printed "Religious Affiliation and Sex" table with a recoverable text layer (not a scanned image), giving province and city/municipality counts. The recommendation is to **HOLD** a 2010/2015/2020 multi-wave upgrade until the province set is harvested from the PDFs and the frame and universe are reconciled; the 2020-only province product remains the correct thing to ship now.

The pinning changes three things the first probe left open: the 2010 category frame is now recorded verbatim (98 codes, plus the coarser presentation frame the printed tables actually use); the universes are confirmed against the tables themselves (2010 household population, 2015 total population, 2020 household population); and the retrieval route is a per-province PDF series in the PSA Library rather than a special-release spreadsheet.

### 2010 CPH — pinned

- **Table identity:** `Table 9. Household Population by Religious Affiliation and Sex: 2010` (byline "National Statistics Office, 2010 Census of Population and Housing"; footer "NSO").
- **Universe:** **Household population** (matches 2020, differs from 2015). Religion is a sample (20%) variable in 2010, so the counts are sample-based estimates rather than a complete enumeration — a comparability caveat against 2015's total-population complete count.
- **Publication route:** PSA Library (Koha) per-province/city series `2010 Census of Population and Housing: Demographic and Housing Characteristics (<Province or City>)`. Search index: `https://library.psa.gov.ph/cgi-bin/koha/opac-search.pl?q=2010+census+population+housing+demographic` (100 catalogue hits covering all provinces and independent/component cities; biblionumbers run alphabetically from Abra = 2833). Each record exposes a `Download` / `View Digital Copy` link resolving to `https://library.psa.gov.ph/cgi-bin/koha/opac-retrieve-file.pl?id=<file-hash>`.
- **Sample pins (verified this session):** Batanes biblionumber `2846` → `…/opac-retrieve-file.pl?id=9875ee3a9840718bc60ba1383bc37a2e` (`2846_BATANES_FINAL PDF.pdf`, 14,817,618 bytes, 160 pp, cached). Abra biblionumber `2833` → `…?id=5ae20008a4ada8f6de7e8bf7111e43cd` (`2833_ABRA_FINAL PDF.pdf`, 17,643,300 bytes, sha256 `b9fe242648171ca56290b2cfbe0780d4411722d90545ea70d0ca75a785c6494d`; not cached — one sample per wave was cached).
- **Format and geography:** searchable-text PDF; the religion table gives province total then a city/municipality breakdown (Batanes p. 88 province total, p. 91 the six municipalities Basco/Itbayat/Ivana/Mahatao/Sabtang/Uyugan). Counts by sex (`Both Sexes`, `Male`, `Female`); **no percentages**.
- **Verified anchor (Batanes, from the cached PDF):** total household population 16,530; Roman Catholic (incl. Catholic Charismatic) 15,496; Association of Fundamental Baptist Churches 666; Iglesia ni Cristo 70; None 1.
- **Category frame — two layers.**
  - The **classification codelist** (PSA "Religious Affiliation" classification for the 2010 CPH, release 2017-07-01) is pinned verbatim at `https://psa.gov.ph/node/120289`: 98 codes, `00 None`, `01 Aglipay` … `40 Iglesia ni Cristo` … `45 Islam` … `69 Roman Catholic, including Catholic Charismatic` … `92 Other Baptists`, `93 Other Evangelical Churches`, `94 Other Methodists`, `95 Other Protestants`, `96 Tribal religions`, `97 Other religious affiliations`. Two structural differences from the 2020 129-column frame: Roman Catholic is a **single** code that **includes** Catholic Charismatic (2020 splits `Roman Catholic, excluding Catholic Charismatics` from `Catholic Charismatic`), and `96 Tribal religions` is an explicit code (2020 carries no standalone tribal column).
  - The **printed-table presentation frame** is coarser than the codelist and adds aggregate reporting groups that are not codes — e.g. `Evangelicals (Philippine Council of Evangelical Churches)` and `Non-Roman Catholic and Protestant (National Council of Churches in the Philippines)` — while suppressing zero-count denominations province by province. A cross-wave build must map to the printed frame actually present in each PDF, not to the 98-code list.
- **Negative finding (records a trap).** The machine-readable per-province `Statistical Tables on Sample Variables from the Results of 2010 CPH` XLSX series (landing pages `https://psa.gov.ph/content/statistical-tables-sample-variables-results-2010-census-population-and-housing-<province>`; files `https://psa.gov.ph/system/files/phcd/2022-12/s<code>%2520<Province>.xlsx`, note the literal double-encoded `%2520` in the stored path) does **not** contain religion. Its 11 person-tables (P1–P11) cover age/sex, literacy, schooling, gainful workers, and fertility only. The Batangas file `s0410%2520Batangas.xlsx` was cached to document this. There is therefore no 2010 religion **spreadsheet**; the PDF publication is the only province route.

### 2015 POPCEN — pinned

- **Table identity:** `TABLE 8. Total Population by Religious Affiliation and Sex: 2015` (byline "Philippine Statistics Authority, 2015 Census of Population").
- **Universe:** **Total population** (complete enumeration; POPCEN 2015 was a total-population inventory with Census Day 1 August 2015). This differs from both 2010 and 2020, which use household population — the central comparability obstacle for a three-wave series.
- **Publication route:** PSA Library (Koha) per-province/city series `2015 Census of Population : Demographic and Socioeconomic Characteristics : <Province or City>` (also catalogued as `2015 Report No. 2 – Socio Economic and Demographic Characteristics (<Province>)`). Same `opac-retrieve-file.pl?id=<hash>` download mechanism.
- **Sample pins (verified this session):** Batanes biblionumber `25534` → `…?id=e6914b77e81adf2ca1b3feb8627cf53a` (`02_Batanes.pdf`, 13,641,808 bytes, 136 pp, cached; the `02_` prefix indicates region II, implying a systematic region-numbered per-province set). Cebu City biblionumber `5015` → `…?id=9a5eccc26c5f628c68133814bfce9533` (`2015 CPH REPORT 2 - CEBU CITY.pdf`, 13,147,970 bytes, sha256 `5f07c2ddb1366725ea881a5cf2c75f2abde145ae97456689d7366bbb93241a1a`; not cached). Other biblionumbers seen: Masbate 5066, Tawi-Tawi 13534, Batanes alternate 4887.
- **Format and geography:** searchable-text PDF; province total then city/municipality breakdown; counts by sex; **no percentages**.
- **Verified anchor (Batanes, from the cached PDF):** total population 17,246; Roman Catholic (incl. Catholic Charismatic) 16,164; Association of Fundamental Baptist Churches 618; Iglesia ni Cristo 108; Other Religious Affiliations 161. The province total 17,246 (total population) exceeds the 2010 household-population total 16,530 for the same province, illustrating the universe gap directly.
- **Category frame:** the same coarse printed frame as 2010 — `Roman Catholic, including Catholic Charismatic` as one line, `Iglesia ni Cristo`, `Tribal Religions`, `Other Baptists`/`Other Protestants`/`Other Religious Affiliations`, plus the `Evangelicals (Philippine Council of Evangelical Churches)` and `National Council of Churches in the Philippines` aggregate groups. Islam is a single line where present. The `None` line appears when nonzero (present in 2010 Batanes, absent from 2015 Batanes).
- **Open metadata (microdata restricted, catalogue open):** PSADA `Census of Population 2015` `https://psada.psa.gov.ph/catalog/168` (Reference `PHL-PSA-POPCEN-2015-v1`; study notes list "religious affiliation" among the collected variables). The PSADA record's copyright clause covers the **microdata** ("intellectual property rights, including copyright in the data are owned by the PSA") and must not be conflated with the CC BY position on the published tables.

### Frame and universe comparability picture

| Wave | Universe | Enumeration | Roman Catholic | Tribal | Percentages | Machine-readable? |
| --- | --- | --- | --- | --- | --- | --- |
| 2010 CPH | Household population | 20% sample (estimates) | single line, **incl.** Charismatic | explicit line | no (counts by sex) | no — PDF only |
| 2015 POPCEN | **Total** population | complete count | single line, **incl.** Charismatic | explicit line | no (counts by sex) | no — PDF only |
| 2020 CPH | Household population | complete count | split: excl. Charismatic + Catholic Charismatic | no standalone line | no (counts) | **yes — XLSX** |

For a change layer the three reconciliations are: (1) **universe** — 2015 is total population against 2010/2020 household population, so any 2015↔2020 change is contaminated by the institutional/homeless population unless restated; (2) **Roman Catholic definition** — collapse the 2020 `excluding Catholic Charismatics` and `Catholic Charismatic` columns to one `Roman Catholic, including Catholic Charismatic` line to match 2010/2015; (3) **frame granularity** — map the 2020 129-column frame down to the coarse printed 2010/2015 frame (Catholic / Islam / INC / Aglipay-IFI / named Protestant-evangelical groups / tribal / other / none / not reported), harvested per PDF rather than from the codelist.

Geography changes across the three waves: **Davao Occidental** was created in 2013, so it is a distinct province in 2015 and 2020 but folded inside Davao del Sur in 2010; the **Negros Island Region (NIR)** existed 2015–2017, so 2015 region-level tabulations may file Negros Occidental/Oriental under NIR while 2010 and 2020 place them under Regions VI/VII; the **Maguindanao** split (del Norte/del Sur) is 2022 and postdates all three waves, so undivided Maguindanao is the common ADM2 anchor. Anchor a series on a single 2020-vintage boundary layer and crosswalk 2010 (no Davao Occidental) and any 2015 NIR region labels into it.

### Licence (re-verified, byte-matched)

The PSA Terms of Use at `https://psa.gov.ph/terms-of-use` (retrieved 2026-07-11) still opens the operative clause byte-for-byte as quoted in the 2020 probe: "The statistical tables (or datasets) including documents (collectively as material) on this site are classified under Open Data with Creative Commons Attribution License (cc-by)." The deed target `https://creativecommons.org/licenses/by/4.0/legalcode` and the site footer "All content is in the public domain unless otherwise stated." are unchanged. The clause covers "documents … on this site," which reaches these published PDF tables; the same public-domain footer renders on `library.psa.gov.ph`. The CC BY position that clears the 2020 build therefore also clears the 2010 and 2015 tables. The only licence line to keep separate is the PSADA/IHSN **microdata** copyright, which does not touch the published aggregate tables used here.

### Cache and retrieval record

All files retrieved 2026-07-11 through the Cloudflare-cleared browser session (both `psa.gov.ph` and `library.psa.gov.ph` return HTTP 403 to plain `curl`); bytes fetched by same-origin `fetch()`, SHA-256 computed in-browser (SubtleCrypto), reconstructed locally, and re-verified byte-for-byte before writing. Cached under `data/raw/ph_census/` (git-ignored). One representative province PDF was cached per earlier wave (Batanes, the smallest province set) rather than the full ~100-file series, which stays out of scope for a probe.

| Cached file | Wave | Bytes | SHA-256 |
| --- | --- | --- | --- |
| `cph2010_demog_housing_batanes.pdf` | 2010 | 14,817,618 | `f0d722aa658fca086e21fe9b515b1b21bac9e4a0767cc246ed531530be11ef42` |
| `popcen2015_report2_batanes.pdf` | 2015 | 13,641,808 | `4646078409efdecb779ed6d8b2e6a8df4dcd46e24ee2fabef23995b561a6d5f5` |
| `s0410_batangas_2010_sample.xlsx` | 2010 (negative — no religion) | 559,755 | `1179c91f6f9387c749e73caf334d36776be88b49e997522942b31b9d1a95ebf0` |

**Trap logged.** `https://psa.gov.ph/sites/default/files/dhsd/Statistical Tables_2.xlsx` (1,300,038 bytes, sha256 `5385d5…97f62`) is surfaced by search as a "2010 sample variables" file but is in fact an NDHS 2025 family-planning table (the `dhsd` = Demographic and Health Statistics Division path). It contains no census religion data; do not re-fetch it.

### Build / hold recommendation (multi-wave)

**HOLD the 2010/2015/2020 multi-wave upgrade; keep the shipped 2020 province product as the standing deliverable.** The blocker is not access or licence — both earlier waves are pinned, downloadable, and CC BY — it is the cost and comparability of the earlier waves. Three facts drive the hold. First, neither earlier wave has a machine-readable province table; harvesting religion requires parsing a per-province PDF series (roughly 100 files per wave, 13–18 MB each, text-layer tables) and stitching the province/city rows, a substantial extraction job with per-file validation. Second, the 2015 universe is total population against 2010/2020 household population, so a headline 2015→2020 change would mix a universe shift with real change unless restated. Third, the printed 2010/2015 frame is coarser than and structurally different from the 2020 129-column frame (Roman Catholic including-vs-excluding Charismatic; explicit tribal line), so change-over-time must wait on a single reconciled map frame and denominator, per the Croatia/Bulgaria precedent already invoked for 2020. If the series is greenlit, the path is clear: harvest `Table 9` (2010) and `TABLE 8` (2015) from the PSA Library per-province PDFs, collapse 2020 to the coarse "Roman Catholic incl. Charismatic / Islam / INC / Aglipay-IFI / other Christian / tribal / other / none / not reported" frame, restate on a single 2020-vintage boundary (undivided Maguindanao; crosswalk 2010's missing Davao Occidental and any 2015 NIR region labels), and present counts only (no source percentages) with the universe disclosed per wave.
