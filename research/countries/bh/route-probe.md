# Bahrain census-religion route probe

Verified 2026-07-11. Bahrain publishes census religion nationally in a single machine-readable, openly licensed wave — the 2020 census — on the Information & eGovernment Authority (iGA) open data portal, `data.gov.bh`. The frame is exactly the queue premise: two lines, **Muslim / Others** (مسلم / أخرى), with no Sunni/Shia split. Two independent published cuts exist and reconcile exactly to the same margins: religion × nationality (Bahraini/Non-Bahraini) × sex, and religion × age-group × nationality × sex. Both close to Muslim 1,111,533 / Others 390,102, total 1,501,635. The portal binds every dataset to the **Bahrain Open Government Data License v1.0** (royalty-free share/adapt/commercialize with attribution) — a clean open-licence position, cleaner than the licence-vacuum cases. The catch is the deeper series. The 2010 census did publish a national Muslim/non-Muslim count (total 1,234,571; Muslim 866,888; non-Muslim 367,683), but its primary portal (`census2010.gov.bh`) is dead and the figure is not on `data.gov.bh` — only a documented national total survives in secondary and government-description sources, not a machine-readable open table. No wave publishes religion by governorate: many other 2020 tables carry a governorate dimension, but none crosses religion. The small-country clause therefore governs, and the honest first product is a **2020 national all-persons Muslim/Others series** on ADM0, with the 2010 national total available only as a caveated historical figure if the conductor accepts a non-machine-readable source.

## Build decision (recommendation to the conductor)

- **Recommendation**: BUILD a **national single-wave (2020)** Muslim/Others religion series (all persons). The small-country clause applies — national-only is the record's ceiling (no subnational religion table in any wave), and Bahrain's clean, openly licensed, machine-readable 2020 census religion earns its place as a national-context product (the Mauritania/Andorra national-only tier of the audit's Section B, upgraded by an explicit open licence).
- **Candidate waves**: **2020** as a firmly buildable national wave (machine-readable, open-licensed, two independent reconciling cuts). **2010** only as an optional, clearly labelled historical national figure from a non-machine-readable source — not a portal table.
- **Candidate geography**: **ADM0 (national)** only. No wave supports a subnational religion layer.
- **Construct**: census religious affiliation, grouped. Each resident classified Muslim or Others; the census does not record denomination within Islam (no Sunni/Shia) and does not split the non-Muslim residual (Christian/Hindu/etc.) in the census religion table.
- **Change metric**: a 2010→2020 national Muslim-share comparison is possible only at the coarsest Muslim/non-Muslim grain, and only if the 2010 total is accepted from a documented but non-portal source. The comparable spine is a single grouped contrast (Muslim vs everyone else); finer denomination change is not available in either wave.
- **Rights position**: explicit open licence. The 2020 datasets are governed by the Bahrain Open Government Data License v1.0, which grants royalty-free rights to share, copy, distribute, adapt, and commercialize with attribution. Ship derived summaries with the required attribution string.
- **Deeper-wave decision**: HOLD a 2010 portal wave — its primary source is offline and it is absent from `data.gov.bh`. The 2010 national count can ship only as a caveated historical annotation, never as a machine-readable open wave equal to 2020.

## Published waves and geography

| Year | Public route | Religion table | Universe | Finest public geography | Decision |
| --- | --- | --- | --- | --- | --- |
| 2010 | primary portal `census2010.gov.bh` **dead (DNS gone)**; not on `data.gov.bh`; national total in secondary/government-description sources (Wikipedia citing CIO census; Ministry of Information page) | national Muslim / non-Muslim only (total 1,234,571; Muslim 866,888; non-Muslim 367,683) | all persons | national | HOLD as a caveated historical figure; no machine-readable open table pinned. |
| 2020 | [data.gov.bh: Population by Religion, Nationality and Sex – Census 2020](https://www.data.gov.bh/explore/dataset/population-by-religion-nationality-and-sex-census-2020/); second cut [Population by Sex, Age Groups and Religion – Census 2020](https://www.data.gov.bh/explore/dataset/population-by-sex-age-groups-and-religion-census-2020/) | **Muslim / Others** (مسلم / أخرى) × Bahraini/Non-Bahraini × sex (8 rows); and × 5-year age group (112 rows) | all persons (Total 1,501,635) | national (by nationality and sex; by age group) | **Ship the 2020 national wave.** |

The `data.gov.bh` Opendatasoft catalogue is the source of record. A full catalogue scan (`where="religion" OR "2010" OR "2001" OR "1991"`) returns exactly three religion datasets, all census-2020 or vital-registration: `population-by-religion-nationality-and-sex-census-2020`, `population-by-sex-age-groups-and-religion-census-2020`, and `18-live-births-by-religion-nationality-and-sex`. No dataset on the portal carries a 2010/2001/1991 census religion table, and no dataset crosses religion with governorate.

## Category frames (verbatim, no invented splits)

**2020 census religion frame (both cuts):** two lines only.

| English | Arabic (`ldyn`) | Product role |
| --- | --- | --- |
| Muslim | مسلم | grouped affiliation |
| Others | أخرى | grouped residual (all non-Muslim) |

The census does **not** split the "Others" residual and does **not** divide "Muslim" into Sunni/Shia. The queue premise ("grouped as Muslim/other") is confirmed exactly.

**Nationality dimension (verbatim):** Bahraini (بحريني) / Non-Bahraini (غير بحريني). **Sex:** Male (ذكر) / Female (أنثى).

**Frame contrast — vital registration, not census:** the sibling iGA dataset `18-live-births-by-religion-nationality-and-sex` uses a **finer four-line frame** — Christian, Jewish, Muslim, Others. This is a births (vital-statistics) product, not the census, and must not be conflated with the census religion frame. It is recorded here only to show that iGA can and does publish a finer religion frame elsewhere, while the **census religion table is deliberately grouped as Muslim/Others**.

## Published cuts (record exactly which cuts exist)

Two census religion cross-tabs are published for 2020, both national:

1. **Religion × Nationality × Sex** (`population-by-religion-nationality-and-sex-census-2020`) — 8 rows:

   | religion | nationality | sex | population |
   | --- | --- | --- | --- |
   | Muslim | Bahraini | Male | 360,202 |
   | Muslim | Bahraini | Female | 349,865 |
   | Muslim | Non-Bahraini | Male | 314,127 |
   | Muslim | Non-Bahraini | Female | 87,339 |
   | Others | Bahraini | Male | 938 |
   | Others | Bahraini | Female | 1,357 |
   | Others | Non-Bahraini | Male | 267,628 |
   | Others | Non-Bahraini | Female | 120,179 |

2. **Sex × Age-group × Religion × Nationality** (`population-by-sex-age-groups-and-religion-census-2020`) — 112 rows (Muslim/Others × 5-year age bands × Bahraini/Non-Bahraini × sex).

The **citizen/non-citizen dimension is the informative cut**: among Bahraini nationals, "Others" is tiny (938 M + 1,357 F = 2,295 of 712,362 Bahrainis, 0.3%), so Bahraini citizens are ~99.7% Muslim; the large non-Muslim population is almost entirely Non-Bahraini expatriates (387,807 of 789,273, 49%). This matches the external record's "99.8% of citizens Muslim; 70.2% of total population Muslim" characterisation.

## Universe and denominator

The 2020 table counts all persons: Total 1,501,635 (Bahraini 712,362; Non-Bahraini 789,273). Muslim 1,111,533 (74.0%); Others 390,102 (26.0%). No sub-universe restriction applies — this is total-population coverage, unlike the citizen-only or de-jure restrictions seen in some small-country cases.

The 2010 figure, if used, is a total-population count: 1,234,571 (Muslim 866,888, 70.2%; non-Muslim 367,683, 29.8%).

## Reconciliation gates (verified in the probe)

- **2020 religion × nationality × sex**: the 8 rows sum to the printed Total **1,501,635**; by religion Muslim 1,111,533 / Others 390,102; by nationality Bahraini 712,362 / Non-Bahraini 789,273. Closes exactly.
- **2020 age-group cut**: the 112 rows sum to **1,501,635**, and to the identical religion margins (Muslim 1,111,533 / Others 390,102). Two independently published cuts close to the same totals — a strong cross-source reconciliation gate.
- A build would stop and record any failing row on arithmetic mismatch; no value is allocated, inferred, rounded, or tuned.

## Boundary source and licence

For a national-only product the boundary is [geoBoundaries BHR ADM0](https://www.geoboundaries.org/api/current/gbOpen/BHR/ADM0/). The release metadata states `"boundaryType": "ADM0"`, `"admUnitCount": "1"`, `"boundaryYearRepresented": "2017"`, `"boundarySource": "OpenStreetMap, Wambacher"`, and `"boundaryLicense": "Open Data Commons Open Database License 1.0"`. The build uses that release metadata as the boundary-licence authority (ODbL 1.0, attribution + share-alike). Bahrain is an archipelago; a national ADM0 polygon needs no subnational concordance and no dateline handling. No governorate (ADM1) layer is needed because no wave publishes religion by governorate.

## Licence position

Bahrain has an explicit, recently issued open-government-data licence, byte-matched here from the licence PDF.

- **Portal terms** ([data.gov.bh/terms](https://www.data.gov.bh/terms), verbatim): "By using the government open data, you implicitly acknowledge your agreement to the terms and conditions stated in the Bahrain Government Open Data License", linking to `https://nea.gov.bh/Documents/OpenDataLicense.pdf`.
- **Bahrain Open Government Data License, Version 1.0 – 20 May 2025** (cached PDF, verbatim):
  - Scope (§1): "This license applies to all datasets officially published by the Government of Bahrain through its open data portal (www.data.gov.bh) or any other government website that published government open data."
  - Grant (§3.1): "this license allows you royalty-free, non-exclusive use of the datasets for the following purposes: (a) sharing, copying, distributing or transmitting the datasets. (b) adapting the datasets to suit your needs. (c) using the datasets for applications that you develop or integrate with. (d) commercializing the applications that you develop using the datasets."
  - Attribution (§3.3): "Include attribution by clearly stating in your applications, research, articles, or websites containing the datasets, the source of the datasets and the date the datasets were extracted." and (§3.3c) the required statement: "Datasets provided by the <entity name> via www.data.gov.bh are governed by the Bahrain Open Government Data License available at www.nea.gov.bh/Documents/OpenDataLicense.pdf. ..." The build must also (§3.3b) "Clearly indicate that any analysis or transformation of data is made by you and shall not be attributed to the Information and eGovernment Authority (iGA) or the concerned government entity."
- **Dataset-level metadata**: the per-dataset `metas.default.license` field is `null`, but publisher is recorded as "Information & eGovernment Authority" with `attributions: ["Information & eGovernment Authority"]` and `modified: 2023-06-07`. The absent per-dataset licence field does not create a vacuum — the portal terms (§1 above) bind all `data.gov.bh` datasets to the OGDL v1.0.

Net: the 2020 route is BUILDABLE under an explicit open licence. Ship derived national summaries with the §3.3c attribution string naming "Information & eGovernment Authority via www.data.gov.bh" and the extraction date (2026-07-11), plus the self-analysis disclaimer (§3.3b).

## Gaps recorded for the conductor's in-app byte-match

- **`census2010.gov.bh`**: DNS no longer resolves (`Could not resolve host`) — the 2010 census primary portal is offline. No machine-readable 2010 religion table is retrievable at a primary URL.
- **`mia.gov.bh` (Ministry of Information, Population and Demographics page)**: returns HTTP 405 to curl and WebFetch (CDN/bot protection), so the 2010 religion figures it carries could not be byte-matched from the command line. This government page cites "the official census for the year 2010 issued by the Central Informatics Organisation" for the Muslim/non-Muslim national split and is worth an in-app fetch if a 2010 government-source citation is wanted.
- **iGA statistical abstract / yearbook**: no abstract PDF with a pre-2020 religion series was located at a stable URL; the iGA "Statistics & Population" page routes only to the open-data portal, which carries 2020 alone. Whether the abstract extends a Muslim/non-Muslim series back across 1991/2001/2010 is unverified.

## Retrieval record

Every cached input is under `data/raw/bh_census/`, which `git check-ignore -v` confirms is excluded by `.gitignore:120` through the `data/` rule. Retrieval occurred on 2026-07-11.

| Cached input | Source URL | Hosting | SHA-256 |
| --- | --- | --- | --- |
| `bh_2020_religion_api.json` | <https://www.data.gov.bh/api/explore/v2.1/catalog/datasets/population-by-religion-nationality-and-sex-census-2020/records?limit=100> | official (iGA, Opendatasoft) | `54c9dd1fb2c209e26acfa29b938fde7ec33402d04327689b36f96690748abddc` |
| `bh_2020_religion.csv` | <https://www.data.gov.bh/api/explore/v2.1/catalog/datasets/population-by-religion-nationality-and-sex-census-2020/exports/csv> | official (iGA) | `f4c580528c1b704d9e27b7600c2db988e29d7e4c8617093a8900c93d942ba2c1` |
| `bh_2020_religion_agegroups.csv` | <https://www.data.gov.bh/api/explore/v2.1/catalog/datasets/population-by-sex-age-groups-and-religion-census-2020/exports/csv> | official (iGA) | `462dec28276312f196f55e5e90b057567957f98c66900f95c822b38be8bb6747` |
| `bh_2020_meta.json` | <https://www.data.gov.bh/api/explore/v2.1/catalog/datasets/population-by-religion-nationality-and-sex-census-2020/> | official (iGA) | `8f9ecd8e43b16fdd9a7ac80e569dec76b89f3d18b157fb51de2a97e91d9eadda` |
| `bh_open_data_license.pdf` | <https://nea.gov.bh/Documents/OpenDataLicense.pdf> | official (NEA/iGA) | `6af153b116ea1eb9abca76d9f6f5893d44ac64033e04a03f075bcbd7a66d6908` |
| `bh_cat_census.json` | <https://www.data.gov.bh/api/explore/v2.1/catalog/datasets?where="census"&limit=60> | official (iGA) | `7f96ee125b43a5fec52c5d2214437eecd2014af922e2f3bd4c2fc526f1b05a9c` |
| `bh_cat_rel.json` | <https://www.data.gov.bh/api/explore/v2.1/catalog/datasets?where="religion"&limit=40> | official (iGA) | `7b96433daf510ec41d4801912f1c788b948f75a7f2039f2ca5788e7ca8e1ec5d` |
| `gb_bhr_adm0_meta.json` | <https://www.geoboundaries.org/api/current/gbOpen/BHR/ADM0/> | geoBoundaries API | `3705338f4f9090e744463d398a1a06bffa3fc8ec972da5c409a9d9168a6ab979` |

Derived working file also present (not a source object): `bh_open_data_license.txt` (pdftotext extraction), plus `mia_pop.html` (the blocked 405 response body) and catalogue probe artefacts (`bh_cat_2010.json`, `bh_cat_years.json`, `bh_catalog_religion.json`).

## Premise divergences

- **"2010 and 2020 ... machine-readable"** — only 2020 is machine-readable and open-licensed (on `data.gov.bh`). The 2010 census religion figure exists in the record (national Muslim/non-Muslim) but its primary portal is dead and it is absent from the open-data portal; it survives only in secondary and government-description sources, not as a machine-readable open table. The deepest *machine-readable open* series is therefore **single-wave (2020)**, not two-wave.
- **"grouped as Muslim/other"** — confirmed exactly for the census (Muslim / Others). Note the iGA *births* dataset uses a finer Christian/Jewish/Muslim/Others frame; the census frame is strictly two lines.
- **"no subnational religion table (governorate religion unpublished)"** — confirmed. The 2020 catalogue carries many governorate-dimensioned tables (population, education, marital status, labour, buildings, households) but none crosses religion.
- **"citizen/non-citizen dimension (Bahraini/non-Bahraini by religion)"** — confirmed as a published cut, and it is the informative one (Bahraini ~99.7% Muslim; non-Muslim population almost entirely Non-Bahraini expatriates). The 2020 religion table is cut by nationality and sex; a second table adds age group.
- **"Sunni/Shia division"** — confirmed *not* published; the census groups all Muslims into one line.

## Product boundary

A build on this probe would stage a **national** Muslim/Others religion series for **2020** (all persons) on the geoBoundaries BHR ADM0 polygon, carrying the two published cuts (by nationality × sex, and by age group) as the detail views. It would not contain a governorate religion layer (none exists in any wave), a place-of-worship layer, place-density metrics, or a Sunni/Shia split (not published). The 2010 national Muslim/non-Muslim total would appear, if at all, only as a clearly labelled historical annotation from a non-machine-readable source — never as a portal-equal open wave. The small-country clause is the basis for shipping: Bahrain's openly licensed, machine-readable, reconciling 2020 national census religion is a legitimate national-context product in the audit's Section B national-only tier, upgraded above Mauritania/Andorra by the explicit open-government-data licence.

## Holds

- **HOLD the 2010 portal wave**: primary source (`census2010.gov.bh`) offline; absent from `data.gov.bh`. Only a documented national total (1,234,571 / Muslim 866,888 / non-Muslim 367,683) survives, in secondary and blocked-government-page sources. Not a machine-readable open wave.
- **No subnational product is possible**: no wave publishes religion by governorate; a governorate religion time series is out of reach.
- **`mia.gov.bh` byte-match pending**: the Ministry of Information page carrying the 2010 CIO-census religion figures blocks curl/WebFetch (HTTP 405); an in-app fetch would pin a government-source citation for the 2010 total if wanted.
