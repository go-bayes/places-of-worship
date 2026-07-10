# Country data map: Iran (IR)

## Status

- **Tier**: B
- **Build state**: Survey verified; a three-wave province route is technically buildable, while public release awaits a project-lead sensitivity ruling and confirmation of Statistical Centre of Iran reuse terms.
- **Last verified**: 2026-07-10

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [Statistical Centre of Iran (SCI) table 2.17, “Population, by Religion and Ostan: the 1375 Census”](https://web.archive.org/web/20130618134922/http://amar.sci.org.ir/Detail.aspx?Ln=E&no=91751&S=GW) | Census religious affiliation | Province (`ostan`); 28 published rows, including retrospective Qazvin and Golestan rows | 1996 | Archived HTML portal table | Open through the Internet Archive | No explicit SCI reuse licence located |
| [SCI table 18, “Population by Religion and Ostan, 1385 Census (2006)”](https://irandataportal.syr.edu/wp-content/uploads/18-population-by-religion-and-ostan-1385-census-2006.xlsx) | Census religious affiliation | Province; 30 provinces | 2006 | XLSX institutional mirror; Persian province volumes are PDF | Open institutional mirror | No explicit SCI reuse licence located |
| [SCI Statistical Yearbook 1390, table 2.18, “Population by Religion and Ostan, 1390 Census”](https://istmat.org/files/uploads/44180/iran_statistical_yearbook_2011-2012_1390.pdf) | Census religious affiliation | Province; 31 provinces | 2011 | Text-bearing PDF; separate Persian and English province workbooks also survive | Open institutional mirrors; current SCI route unavailable from this sandbox | No explicit SCI reuse licence located |
| [SCI Statistical Yearbook 1399, table 3.18, “Population by Religion and Ostan, 1395 Census”](https://www.iranopendata.org/res/get/datasets/Sources/iod451.pdf) | Census religious affiliation | Province; 31 provinces | 2016 | Persian text-bearing PDF; extracted CSV is indexed by Iran Open Data | Secondary mirror is browser-readable; direct SCI portal unavailable from this sandbox | No explicit SCI reuse licence located; mirror terms do not replace SCI terms |

The verified province series begins in 1996. The best initial wave set is 2006, 2011, and 2016 because all three waves use the same seven-output publication frame and post-date the three-way Khorasan split. The 1996 table can extend the series after a coarser concordance is accepted. Archived SCI evidence for 1976 and 1986 contains national counts by sex. No province-by-religion table was verified for 1956, 1966, 1976, or 1986.

## Access the data yourself

- **Source of record**: Statistical Centre of Iran (SCI), <https://amar.org.ir>. HTTPS requests from this sandbox failed during the probe with an SSL connection error, and HTTP returned an empty response.
- **Exact tables**: 1996 table 2.17; 2006 table 18; 2011 Statistical Yearbook 1390 table 2.18, page 125; 2016 Statistical Yearbook 1399 table 3.18, printed page 154. The [United Nations Statistics Division 2011 results PDF](https://unstats.un.org/unsd/demographic-social/census/documents/Iran/Iran-2011-Census-Results.pdf) and [UNdata religion table](https://data.un.org/Data.aspx?d=POP&f=tableCode%3A28%3BcountryCode%3A364) provide official secondary confirmation of the national totals and categories.
- **Language availability**: Archived SCI English tables survive for 1976/1986 and 1996. Iran Data Portal supplies an English XLSX for 2006 and English and Persian province workbooks for 2011. The 2016 SCI table is readily recoverable in Persian; an English SCI yearbook table is indexed through secondary copies. The current SCI Persian and English portals could not be tested because `amar.org.ir` was unreachable.
- **Licence**: The [SCI law described by the International Monetary Fund](https://dsbb.imf.org/e-gdds/data-integrity-report/country/IRN/category/IRNNSO00) authorises collection and dissemination, but no portal terms or open-data licence governing republication were located. [Iran's public-information law does not settle republication or reuse](https://www.article19.org/wp-content/uploads/2017/09/Iran-FOI-review-English-.pdf). Treat reuse permission as unknown and obtain written confirmation before publishing extracted cells. [Iran Open Data applies its own restrictive terms](https://iranopendata.org/en/copyright/) to its copies; those terms do not establish the SCI source licence.
- **Our extraction script**: None; this was a probe-only task.
- **Retrieval recipe and hashes**: None; a future build must create a tracked manifest for every archived or mirrored object.

## Boundaries

- No official source was located for the administrative structures reported for the 1956, 1966, 1976, or 1986 censuses; those exact structures are not verified in this probe. The [Encyclopaedia Iranica census history](https://www.iranicaonline.org/articles/census-i/) is the secondary source used for the 1966 description.
- The archived 1996 religion table publishes 28 province rows. Qazvin and Golestan appear as separate rows even though their provincial establishment followed the October 1996 census. The [administrative change history](https://statoids.com/uir.html) dates both changes after census night. A multi-wave product must therefore label this table as a retrospective reporting geography unless SCI documentation establishes another effective date.
- The 2006 table has 30 provinces after Khorasan divided into North, Razavi, and South Khorasan in 2004. The 2011 and 2016 tables have 31 provinces after Alborz separated from Tehran in 2010.
- Two cross-wave transfers prevent a direct 2006–2016 province comparison from province totals alone. Ferdows moved from Razavi Khorasan to South Khorasan in 2007. [Tabas was in South Khorasan in 2006, in Yazd for the 2011 census, and back in South Khorasan by 2016](https://www.iranicaonline.org/articles/khorasan-xxix-population-of-modern-khorasan/).
- The defensible 2006–2016 concordance merges Tehran with Alborz and merges Razavi Khorasan, South Khorasan, and Yazd. A 1996 extension must merge North, Razavi, and South Khorasan with Yazd because the 1996 table contains one Khorasan row and Tabas was then within Khorasan.
- The Integrated Public Use Microdata Series (IPUMS) project [documents a harmonised 2006–2011 province geography](https://catalog.ihsn.org/catalog/13278/variable/H/GEO1_IR?name=GEO1_IR) and combines Tehran with Alborz. Its GIS route is useful evidence for a future concordance. It cannot reallocate province-only religion counts across the Ferdows and Tabas transfers.
- [geoBoundaries IRN ADM1](https://www.geoboundaries.org/api/current/gbOpen/IRN/ADM1/) is unsuitable without repair: its 2017 OpenStreetMap-derived release reports 33 units, while the census tables require 31. A future build should prefer an SCI, National Cartographic Centre of Iran, or verified IPUMS vintage layer and record the geometry licence separately.

## Places-of-worship layer

- OpenStreetMap and country-register coverage were outside this probe. Any future site layer must remain separate from census affiliation and receive its own minority-site safety review.

## First visualisation

If the project lead approves a build, start with published religion-category percentages for 2006, 2011, and 2016 on the harmonised 2006 reporting frame. Merge Tehran with Alborz and merge Razavi Khorasan, South Khorasan, and Yazd. Display the official residual categories as `Other` and `Not stated`; do not infer their internal composition.

## Build recipe

1. Extract the three official province tables from the surviving SCI-derived XLSX or PDF objects and record every source URL, retrieval date, file hash, table label, and language.
2. Preserve each wave's source labels and column order in the raw extraction. Map the common outputs to `Total`, `Muslim`, `Christian`, `Zoroastrian`, `Jew`, `Other`, and `Not stated`, while retaining the Persian labels `جمع`, `مسلمان`, `مسیحی`, `زرتشتی`, `کلیمی`, `سایر`, and `اظهار نشده`.
3. Produce governed `area_summary` rows per `schemas/area_summary.schema.json`, with a tracked manifest per `docs/data-storage-pipeline.md`.
4. Apply the aggregate concordance described above. Cross-check every category sum against the published national total and document the population denominator.
5. Reconcile a verified boundary file against every reporting unit before adding `REGION_CONFIG` per `docs/development/adding-a-region.md`.
6. Obtain SCI reuse confirmation and the project-lead sensitivity ruling before any public release.

## Risks and open questions

The official province tables separately publish Muslim, Christian, Zoroastrian, and Jewish counts, followed by `Other` and `Not stated`. They do not separately identify the [Bahá’í faith, Iran's largest unrecognised religious minority](https://www.refworld.org/sites/default/files/legacy-pdf/en/2016-11/583eea134.pdf), or other unrecognised identities. The tables do not establish which identities enter either residual column. A render-the-record product would show the six published religion and non-response columns and the population total. Unrecognised identities would remain unnamed, and the official frame could appear to describe the full religious composition. Subnational display may also expose small recognised-minority populations. The build decision awaits a project-lead ruling.

The technical open questions are SCI reuse permission, an authoritative vintage-boundary route, and confirmation that the 1996 table's post-census province rows are an intentional retrospective tabulation.

## Deep-history potential

The 1956 and 1966 printed census programmes, the archived SCI national table for 1976 and 1986, province census volumes, National Cartographic Centre holdings, and local religious archives could support a later historical study. The online probe did not establish province religion tables before 1996, and no earlier wave should enter a map until its table and geography are recovered from the source record.
