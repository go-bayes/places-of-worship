# Tonga wave-extension probe (historical)

Last verified: 2026-07-10

This historical probe applied a multi-wave machine-readable gate and stopped before construction. The current build brief superseded that gate through the small-country clause. The shipped 2021 district decision, publication terms, validation record, and retrieval hashes now live in `research/countries/to/route-probe.md` and `docs/manifests/to-census-religion-2021.json`.

## Status

- **Historical build decision**: stopped after probe under the earlier multi-wave machine-readable gate.
- **Current decision**: the 2021 district snapshot has been built; `research/countries/to/route-probe.md` is authoritative.
- **Stop condition met**: only one open aggregate religion wave is machine-readable by the build gate used here.
- **Second stop condition (historical, since resolved for 2021)**: at probe time the census table reuse licence was unclear. The current build resolved the 2021 position: the census report volume permits partial scientific, educational, or research reproduction with acknowledgement (`route-probe.md` records the terms). The older report PDFs are public downloads whose reuse position for derived redistribution has not been separately verified. The Pacific Data Hub (PDH) pages provide access terms.
- **Boundary result**: district boundaries exist with a clear licence. Village boundaries were not found.

For this probe, machine-readable aggregate means an XLSX, CSV, JSON, or API aggregate table that can be read without reconstructing tables from PDF page layout. The 2016, 2011, and 2006 religion aggregates are public report PDFs. They are text-extractable, but they still require page-layout table reconstruction and are not counted as machine-readable aggregate inputs for the build gate.

## 2021 Census Workbook

| Item | Value |
| --- | --- |
| Source | Tonga Statistics Department, 2021 census tables, "4. Religion" |
| URL | `https://tongastats.gov.to/download/266/general-tables/7664/4-religion.xlsx` |
| Local probe file | `/private/tmp/pow-tonga-probe/2021-4-religion.xlsx` |
| SHA-256 | `e62242fffe0eefe5a238cb9b1c09786db1420c9d7733e1257ed925f39a4f3b0e` |
| Format | XLSX |
| Machine-readable aggregate status | yes |
| National total in religion table | 99,408 |

The workbook has four sheets: `Content`, `G 18`, `G 19`, and `G 20`.

| Sheet | Table title | Geography | Use |
| --- | --- | --- | --- |
| `G 18` | Population religious affiliation by sex and division | division and sex | division totals by sex |
| `G 19` | Population religious affiliation by division and district | division and district | district-level aggregate source |
| `G 20` | Population religious affiliation by division, district and village | village, district, and division | finest public table; no matching village boundary source was pinned |

`G 19` and `G 20` use these columns: `Total`, `FWC`, `RC`, `LDS`, `FCOT`, `COT`, `AOG`, `TOK`, `CCOT`, `GOS`, `AGC`, `SDA`, `MF`, `TSA`, `JW`, `OP`, `BF`, `BUDH`, `ISL`, `HND`, `NO Rel`, `REF`, and `Other`.

## Earlier Census Waves

| Year | Downloaded source | URL | SHA-256 | Religion table evidence | Smallest public geography | Build-gate status |
| --- | --- | --- | --- | --- | --- | --- |
| 2016 | `2016-census-report-volume-1-2nd-edition.pdf` | `https://tongastats.gov.to/download/60/2016/4062/2016-census-report-volume-1-2nd-edition.pdf` | `ba31b9f9fe3cd4db7913ae10896de79d9261b4cd4eb3be4e170feda2bd54b1aa` | Table G17 by sex and division; Table G18 by division and district; Table G19 by division, district, and village. The report note says visitor and non-resident populations are excluded. | village | public PDF; not counted as machine-readable aggregate |
| 2011 | `2011-basic-tables-admin.pdf` | `https://microdata.pacificdata.org/index.php/catalog/184/download/2684` | `dd07acad523cfc09c0aaae3de0d767bf4173de71bf9f7b164f07d8818c002ca0` | Table G17 by sex and division; Table G18 by division and district; Table G19 by division, district, and village. The report note says non-residents occupying institutions are excluded. | village | public PDF; not counted as machine-readable aggregate |
| 2006 | `2006-basic-tables-admin.pdf` | `https://microdata.pacificdata.org/index.php/catalog/183/download/935` | `4c89cbf26c0df812e466354b1f5fba9334073213ec0c8eab5f5035ac42d1852a` | Table G17 by sex and division; Table G18 is private-household population by division and district; Table G19 is total population by division, district, and village. | village | public PDF; not counted as machine-readable aggregate |

The 2016 Tonga Statistics Department census page lists report PDFs. No aggregate XLSX/CSV tables for 2016 religion were found. The 2011 and 2006 PDH catalogue records provide public report PDFs and Data Documentation Initiative (DDI) metadata. The 2011 `pc1.xls` related material is a questionnaire or listing form. It is not an aggregate table.

National rows observed during the probe:

| Year | Table | National total | Notes for a future extraction |
| --- | --- | ---: | --- |
| 2021 | `G 19` and `G 20` | 99,408 | XLSX rows reconcile to the printed national row before any product derivation. |
| 2016 | Table G18 | 100,266 | Table G19 prints the same total, but its national row differs from G18 for at least `AOG` and `NO Rel`; a future extraction must choose a reconciliation authority before publication. |
| 2011 | Table G18 and G19 | 103,043 | Public PDF pages carry both district and village rows. |
| 2006 | Table G19 | 101,991 | Use Table G19 for total population. Table G18 uses a private-household denominator and should not anchor a total-population product. |

## PDH Microdata And SPC StatHub

PDH catalogue API route used to enumerate Tonga census records:

```sh
curl -Ls 'https://microdata.pacificdata.org/index.php/api/catalog/search?country[]=TON&ps=100'
```

Relevant PDH records:

| Year | PDH record | DDI evidence | Access note |
| --- | --- | --- | --- |
| 2021 | `https://microdata.pacificdata.org/index.php/catalog/861` | Variable `religion`, question "What is %rostertitle%'s church congregation or religious affiliation?" | microdata record; related materials did not include the public 2021 religion workbook |
| 2016 | `https://microdata.pacificdata.org/index.php/catalog/201` | Variable `a5_religion`, label `Religion` | licensed microdata, accessible under conditions |
| 2011 | `https://microdata.pacificdata.org/index.php/catalog/184` | Variable `religion`, question "P08. What is this person's Religion?" | licensed microdata, accessible under conditions |
| 2006 | `https://microdata.pacificdata.org/index.php/catalog/183` | Variable `religion`, question "What is this person's Religion?" | licensed microdata, accessible under conditions |
| 1996 | `https://microdata.pacificdata.org/index.php/catalog/182` | Variable `religion`, label `RELIGION` | context only for this task |

The SPC StatHub search did not expose a religion-specific aggregate dataflow for Tonga. The search call below returned zero dataflows whose title, name, or description matched `religion` or `religious`:

```sh
curl -Ls 'https://stats-sfs.pacificdata.org/api/search?query=religion&lang=en&rows=200'
```

No `.Stat` API call serving Tonga religion aggregates was found.

## Boundaries

| Source | Level | Units | URL or API route | Licence | Probe result |
| --- | --- | ---: | --- | --- | --- |
| geoBoundaries `gbOpen` TON ADM1 | division | 5 | `https://www.geoboundaries.org/api/current/gbOpen/TON/ADM1/` | Open Data Commons Open Database License 1.0; source OpenStreetMap and Wambacher | obtainable, but coarser than district |
| geoBoundaries `gbOpen` TON ADM2 | district | 23 | `https://www.geoboundaries.org/api/current/gbOpen/TON/ADM2/` | Creative Commons Attribution 4.0 International (CC BY 4.0); source Pacific Data Hub | obtainable and matches the district geography |
| geoBoundaries `gbOpen` TON ADM3 | village | n/a | `https://www.geoboundaries.org/api/current/gbOpen/TON/ADM3/` | n/a | HTTP 404; no village boundary product |

The ADM2 response identifies `boundaryCanonical` as `district`, `boundaryYearRepresented` as `2020`, `boundarySource` as `Pacific Data Hub`, and `admUnitCount` as `23`. The GeoJSON download URL is `https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/TON/ADM2/geoBoundaries-TON-ADM2.geojson`.

The 2006 PDH DDI notes that geographic identifiers could be used for PopGIS dissemination and that digitised maps were used for the 2006 census. I did not pin a public PopGIS boundary download during this probe. District boundaries are therefore obtainable through geoBoundaries/PDH, while village boundaries remain unavailable for this build.

## Prospective Product Mapping

The historical probe built no product; the 2021 district product now exists and `route-probe.md` is its record. For the earlier waves, if a later decision treats the report PDFs as buildable source material and verifies their reuse terms, the finest clean geography is district. Village remains unavailable without a boundary source.

The broad area-summary mapping should be:

| Source category | Product group | Notes |
| --- | --- | --- |
| `FWC`, `RC`, `LDS`, `FCOT`, `COT`, `AOG`, `TOK`, `CCOT`, `GOS`, `AGC`, `SDA`, `MF`, `TSA`, `JW`, `OP`, `OPD`, `BF`, `BUDH`, `ISL`, `HND`, `HD`, `Other`, `Others` | `religious_affiliation_count` | Includes every named religion, other Pentecostal, other minor religious groups, Islam, Hinduism, Buddhism, and Baha'i. The 2016 report folds Islam and Hindu into `Others`; 2021 separates them. |
| `NO Rel`, `No Rel` | `no_religion_count` | Stated no-religion response. |
| `REF`, `Ref`, `Ref.` | excluded response | Refused to answer. Retain separately in reconciliation tables. |
| `N/S` | excluded response | Not stated. Present in 2011 and 2006, absent from the 2021 workbook and 2016 G18/G19 tables. |
| `Total` | source total | Use for exact national reconciliation and for recording each table's own denominator. |

For the existing `area_summary` schema, `population_total_basis` should state the chosen denominator. A likely denominator is stated religion response, computed as `Total - Ref - N/S` where those columns exist; `No Rel` remains inside the denominator as a stated response. A census-total denominator would be a different product decision and should be recorded before construction.

Category detail changes across waves, especially the 2016 `Others` category and the later separation of Islam and Hinduism. A first product should publish only broad religious-affiliation and no-religion metrics unless a separate denomination concordance is approved.

## Historical stop record

The earlier build did not proceed because:

1. The only open machine-readable aggregate religion wave pinned here is the 2021 XLSX workbook.
2. The older district and village tables are available as PDF report tables. No aggregate XLSX/CSV/API outputs were found.
3. The census table reuse licence remains website/PDH terms rather than an explicit open-data licence.
4. Village tables have no pinned village boundary source; district boundaries are available if the data-source conditions are resolved later.
