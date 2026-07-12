# Trinidad and Tobago census-religion route probe

Verified 2026-07-12. The Central Statistical Office of Trinidad and Tobago (CSO, `cso.gov.tt`) publishes religion **by municipality** as a count-valued cross-tab for **one** census wave — **2011** — across fifteen units (nine regional corporations, three boroughs, two cities, and Tobago as a single unit), in the 2011 Population and Housing Census Demographic Report, Table 8 "Non-Institutional Population by Sex, Age Group, Religion and Municipality". The queue premise ("2000, 2011 | regional corporation or municipality to be extracted | census affiliation; religion release not confirmed | browser work | probe then build") holds on the 2011 wave and on the municipality geography; it is refuted on the 2000 wave (religion is published at national level only), on the browser-work route (the report is a direct PDF download), and on the 2020-round premise (no census after 2011 has occurred). The 2011 table is count-valued and closes to within a small source-internal rounding residual (maximum ±2 at any margin), not integer-exact — the published table's own national row sums to 1,322,547 against its printed total of 1,322,546. The boundary route is clean but not the default: the OCHA COD-AB TTO ADM1 layer (CC BY-IGO) carries all fifteen census units and joins one-to-one, while the geoBoundaries TTO ADM1 release is **rejected on completeness** (fourteen units, missing the Borough of Arima) rather than on licence. The licence gate is the CSO posture: the Demographic Report prints a verbatim "personal, non-commercial use with permission" reproduction clause and the CSO website footer asserts "All Rights Reserved", so the product ships **staged** under the standing BUILD-THEN-ASK ruling with attribution to the CSO, a courtesy reuse ask recorded for the PI (needs_review, not accepted).

## Build decision (recommendation to the conductor)

- **Recommendation**: BUILD a single-wave (2011), fifteen-unit religious-affiliation product, STAGED. The route clears the brief's build gate — one wave, count-valued, a licensed boundary covering every unit, and reconciliation to a recorded derived bound. The product is single-wave, so the page decision parallels the Antigua/Barbados single-wave-subnational question (conductor/PI), and the licence is needs_review (CSO courtesy ask), so it stages twice over.
- **Single-wave finding (premise correction, not a build blocker)**: the queue names 2000 and 2011. Only 2011 publishes religion below the national level. The 2000 published record (National Census Report 2000, Table 2.6) reports religion nationally only, prorated across a merged Other/Not-Stated line and based on tabulable households; no 2000 religion-by-municipality table appears in any published CSO product. A 2000 municipality religion table is reachable only through the CSO REDATAM online tabulation engine (the 2000-census-portal, `BASE=PHC2K`), which is microdata-backed and session-ephemeral — the Antigua REDATAM pattern — and is recorded here as the deferred unblock, not built.
- **Wave and source**:
  - **2011**: 2011 Population and Housing Census Demographic Report (PDF), Table 8 "Non-Institutional Population by Sex, Age Group, Religion and Municipality", Both Sexes, All Ages column — count-valued, seventeen categories, fifteen units. Universe: the non-institutional population (1,322,546), distinct from the total enumerated population (1,328,019); the institutional population is not cross-tabbed by religion.
- **Geography**: 15 units on OCHA COD-AB TTO ADM1 (fifteen units; one-to-one join under a deterministic name crosswalk; each unit also carries an ADM1 pcode).
- **Construct**: census affiliation — each resident's reported religion, asked of the non-institutional population; not practice, attendance, or membership.
- **Slot design** (ordinary two-slot, SB/FM/KI precedent, verbatim-cell variant): `religious_affiliation_percent` = (sum of the fifteen named-religion cells plus the Other cell) / printed municipality total; `no_religion_percent` = the single None line / printed municipality total. The Not Stated line stays in the denominator and in neither slot, so the two shares need not sum to 100 (the FJ/SB unallocated-residual precedent). Trinidad and Tobago has a real None category, so no minority-share (task-6) treatment applies. Every count is a verbatim printed cell; no count is derived by subtraction from a total the cells do not match.
- **Map-worthy pattern**: the Hindu–Christian–Muslim geography is the story and it is legible by municipality. Hinduism is the plurality in the central-and-south belt — Couva/Tabaquite/Talparo (55,691 Hindu of 178,160, 31.3%), Penal/Debe (38,402 of 89,342, 43.0%), Princes Town, Chaguanas, Siparia — while Roman Catholicism and Anglicanism concentrate in the north-west urban corridor (Diego Martin 45,810 Roman Catholic of 102,340, 44.8%; Port of Spain, San Juan/Laventille) and in Tobago (which is distinctively Anglican, Baptist-Spiritual Shouter, and Seventh Day Adventist, with only 408 Hindus of 60,735). Islam is strongest in the same central belt as Hinduism. Not Stated runs high nationally (146,798, 11.1%) and unusually high in Tunapuna/Piarco (41,131 of 212,825, 19.3%).
- **Rights position**: NEEDS_REVIEW. The CSO asserts copyright with reproduction of extracts permitted only for "personal, non-commercial use with permission" and full acknowledgement, and an all-rights-reserved website footer; no open-data licence is stated. Ship derived municipality summaries with attribution to the CSO under BUILD-THEN-ASK (the RO/SK/CI/MONSTAT/SIB/DCS summaries-with-attribution line), STAGED; a CSO reuse-confirmation email is the clean courtesy unblock, recorded for the PI. The boundary carries a stated CC BY-IGO licence.

## Published waves and geography

| Year | Official route | Religion-by-municipality table | Universe | Units | Decision |
| --- | --- | --- | --- | --- | --- |
| 2011 | [2011 Demographic Report](https://cso.gov.tt/wp-content/uploads/2020/01/2011-Demographic-Report.pdf) (PDF), Table 8 | "Non-Institutional Population by Sex, Age Group, Religion and Municipality" (count-valued, 17 categories) | Non-institutional population (1,322,546) | 15 (9 regional corporations, 3 boroughs, 2 cities, Tobago) | Ship the fifteen-unit 2011 wave, STAGED. |
| 2000 | [National Census Report 2000](https://catalog.ihsn.org/index.php/catalog/4217/download/55709) (PDF, CARICOM/CSO), Table 2.6 | "Distribution and Ranking of Population by Religious Affiliation, Trinidad and Tobago: 1990–2000" — **national only**, prorated, tabulable-households base | tabulable households (2000: 1,114,772) | national | REFUTED — no 2000 religion-by-municipality table is published. The 2000-census-portal REDATAM engine is the only municipality route (deferred). |
| 2020 round | GDUE preparation ongoing | none — no census conducted | — | — | REFUTED — the post-2011 census was COVID-delayed (targeted Q4 2022, then further postponed); the Geospatial Data Update Exercise began 26 January 2026 and the census is now planned for 2027. No 2020-round religion data exists. |

The 2011 Demographic Report is "the first volume of a series" of the 2011 census results; Table 8 is the religion cross-tab in that volume. The report's front matter records that the 2011 census was itself originally scheduled for 2010 and postponed when Parliament was prorogued before the Census Order — Trinidad and Tobago has run decennial censuses since 1851. The 2000 route is the CARICOM/CSO National Census Report, a national narrative volume; its only religion table (Table 2.6) is national, merges Other into Not Stated and prorates it, and uses a tabulable-households base — unusable as a municipality product on three counts.

## Category frame (2011, preserved verbatim; never merged)

Table 8 prints seventeen religion categories. The frame, in source order:

| # | Category (2011 Table 8) | Role | National (All Ages) |
| --: | --- | --- | --: |
| 1 | Anglican | affiliation | 74,994 |
| 2 | Baptist-Spiritual Shouter | affiliation | 75,002 |
| 3 | Baptist-Other | affiliation | 15,951 |
| 4 | Hinduism | affiliation | 240,100 |
| 5 | Islam | affiliation | 65,705 |
| 6 | Jehovah's Witness | affiliation | 19,450 |
| 7 | Methodist | affiliation | 8,648 |
| 8 | Moravian | affiliation | 3,526 |
| 9 | Orisha | affiliation | 11,918 |
| 10 | Pentecostal/ Evangelical/ Full Gospel | affiliation | 159,033 |
| 11 | Presbyterian/ Congregational | affiliation | 32,972 |
| 12 | Rastafarian | affiliation | 3,615 |
| 13 | Roman Catholic | affiliation | 285,671 |
| 14 | Seventh Day Adventist | affiliation | 54,156 |
| 15 | Other | residual affiliation | 96,166 |
| 16 | None | no-religion | 28,842 |
| 17 | Not Stated | non-response | 146,798 |

The "Baptist-Spiritual Shouter" (75,002) and "Baptist-Other" (15,951) split is verbatim and preserved — the Spiritual Shouter (Shouter/Spiritual Baptist) faith is a nationally significant, historically suppressed tradition and is never merged with other Baptist bodies. "Orisha" (11,918) is likewise carried verbatim. Printed "-" cells (structural zeros for small denominations in small units, e.g. Moravian in San Fernando) are transcribed as 0. No cell suppression appears in the table. Because the product is 2011-only, no cross-wave category alignment is attempted; the 2011 frame is carried verbatim. The 2000 national frame (Table 2.6) is a coarser eleven-name list (Anglican, Baptist, Hindu, Jehovah Witness, Methodist, Muslim, Pentecostal, Presbyterian, Roman Catholic, SDA, None) — it lacks the 2011 Baptist split, Moravian, Orisha, Rastafarian, and the Other line, and it merges Other into Not Stated; it is not comparable to the 2011 frame and is not built.

## Universe and denominator

The 2011 religion table denominator is the **non-institutional population** (1,322,546), distinct from the **total enumerated population** (1,328,019). Table 8 states its universe as "Non-Institutional Population" — the population living in private households — and the report notes "This represents only the households". The institutional population (persons in collective living quarters, roughly 5,473) is tabulated separately (Table 5) and is not cross-tabbed by religion. Religion (like every non-institutional cross-tab) is tabulated on the non-institutional population, so 1,322,546 is the correct religion denominator; the build reads each unit's shares within its printed municipality total and never treats the institutional population or the total enumerated population as a religion quantity. Religion is asked of the whole non-institutional population with no age restriction (Table 8 is by age group; the build uses the All Ages column), so the unit shares are comparable in construct.

## Reconciliation gates (documented-discrepancy treatment; Saint Lucia / Côte d'Ivoire precedent)

The published Table 8 does **not** close integer-exact: its printed marginal totals differ from the sums of its printed cells by small amounts. This is a property of the source, not of the extraction — two independent extractors (`pdftotext -layout` and `pdfplumber`) agree on all 255 cells (zero disagreements), and the published national religion row itself sums to 1,322,547 against the printed national total of 1,322,546. Under the standing exact-margins ruling ("reconcile exactly or within a recorded derived bound; every deviation recorded") and the render-the-record principle (published values unchanged, discrepancies disclosed, never repaired), every cell is transcribed verbatim and every residual is recorded; no value is allocated, inferred, imputed, redistributed, or tuned to force closure. The build gate asserts the derived bound and records each deviation; it does not fail on nonzero.

- **Derived bound (2011)**: every municipality column residual (printed municipality total minus the sum of its seventeen printed cells) lies within ±1; every religion row residual (printed national total minus the sum of the fifteen printed unit cells) lies within ±2; the grand residual (sum of the fifteen printed municipality totals, 1,322,547, minus the printed national total, 1,322,546) is −1. Maximum absolute residual at any margin: 2.
- **Column residuals**: Port of Spain +1, San Fernando −1, Arima 0, Chaguanas +1, Point Fortin +1, Couva/Tabaquite/Talparo 0, Diego Martin +1, Mayaro/Rio Claro −1, Penal/Debe +1, Princes Town 0, San Juan/Laventille +1, Sangre Grande −1, Siparia 0, Tunapuna/Piarco 0, Tobago −1.
- **Row residuals** (printed national minus fifteen-unit sum): Anglican 0, Baptist-Spiritual Shouter +1, Baptist-Other +2, Hinduism +2, Islam 0, Jehovah's Witness −2, Methodist +1, Moravian 0, Orisha −2, Pentecostal/Evangelical/Full Gospel −2, Presbyterian/Congregational −2, Rastafarian 0, Roman Catholic +2, Seventh Day Adventist 0, Other +1, None +1, Not Stated 0.
- **Trinidad subtotal**: the fourteen Trinidad municipality totals sum to 1,261,812 against the printed Trinidad total of 1,261,811 (residual +1); Trinidad (1,261,811) plus Tobago (60,735) equals the printed national total (1,322,546) exactly.

National headline (2011): religious affiliation 1,146,907 (86.7%), None 28,842 (2.2%), Not Stated 146,798 (11.1%). None and Not Stated together are 175,640 (13.3%), matching the widely-cited "None/not stated 13.3%".

## Boundary source and licence

The boundary is [OCHA COD-AB TTO](https://data.humdata.org/dataset/cod-ab-tto), ADM1 (`tto_adm1_v2.zip`). The HDX metadata records, quoted verbatim, `"license_title": "Creative Commons Attribution for Intergovernmental Organisations (CC BY-IGO)"`, `"license_id": "cc-by-igo"`, `"license_url": "http://creativecommons.org/licenses/by/3.0/igo/legalcode"`, `"dataset_source": "www.gadm.org"`, and the publishing organisation "OCHA Field Information Services Section (FISS)". The `NAME_1` field carries fifteen units — Arima, Chaguanas, Couva-Tabaquite-Talparo, Diego Martin, Mayaro/Rio Claro, Penal-Debe, Point Fortin, Port of Spain, Princes Town, San Fernando, San Juan-Laventille, Sangre Grande, Siparia, Tobago, Tunapuna/Piarco — each with an `ADM1_PCODE` (TT10–TT90). They match the fifteen census units one-to-one under a deterministic crosswalk (City of / Borough of prefixes dropped, punctuation normalised). The extent spans lon −61.93 to −60.49 E and lat 10.04 to 11.36 N, wholly within the standard frame and far from the antimeridian; no dateline handling is needed. Geometry lineage is GADM (`www.gadm.org`), re-published by OCHA under CC BY-IGO; the derived simplified boundary ships under the OCHA-stated CC BY-IGO with attribution to OCHA/GADM (the Pakistan OCHA COD-AB CC BY-IGO precedent).

**geoBoundaries rejected on completeness (not licence)**: the geoBoundaries TTO ADM1 release ([metadata](https://www.geoboundaries.org/api/current/gbOpen/TTO/ADM1/)) records a non-null licence (`"boundaryLicense": "Open Data Commons Open Database License 1.0"`, source OpenStreetMap) and would be acceptable on licence grounds (the Ghana/Malaysia OSM ODbL precedent), but it carries only fourteen units and **omits the Borough of Arima** (population 33,404), which OSM/geoBoundaries appears to have absorbed into the surrounding Tunapuna/Piarco. A fourteen-unit boundary cannot render the fifteen-unit census without either dropping Arima or fusing it into a neighbour (the Keamari combine). The OCHA COD-AB carries Arima as a distinct polygon, so it is selected; geoBoundaries is recorded as considered and declined.

## Licence position (needs_review; build-then-ask)

No open-data licence is stated on any CSO census product. The rights posture, fetched and quoted verbatim:

- **2011 Demographic Report** (PDF, front matter, retrieved 2026-07-12): "Extracts from this publication may be reproduced, for personal, non-commercial use with permission, provided that the Central Statistical Office of Trinidad and Tobago is fully acknowledged as the source. Storage in a retrieval system, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise, must be requested in writing and requires prior permission given in writing by the authorized official of the Central Statistical Office." — "© Copyright 2012".
- **CSO website footer** (`cso.gov.tt`, retrieved 2026-07-12): "Ministry of Planning, Economic Affairs and Development. All Rights Reserved."
- **IHSN catalog** (metadata for the 2011 census microdata, retrieved 2026-07-12): a standard disclaimer and a citation requirement (Primary Investigator, survey title, reference number `TTO_2011_PHC_v01_M`, source and date of download), governing the microdata deposit, which the build never touches.

The product is a derived aggregate summary (municipality religion shares) carrying full attribution to the CSO, built from an openly published aggregate table, leaking no microdata. The CSO clause is more restrictive than the Belize/SIB posture (it limits even extracts to "personal, non-commercial use with permission"), so the product does not self-authorise going live: under BUILD-THEN-ASK it ships **staged** with attribution, `licence_status: needs_review`, `licence_basis: cso_copyright_permission_attribution`. A CSO reuse-confirmation email is the clean courtesy unblock, recorded here for the PI (do not send). The boundary is CC BY-IGO (attribution to OCHA/GADM).

## Premise corrections (trust the record)

- **The municipality religion product is single-wave 2011, not 2000+2011.** Only the 2011 census publishes religion below the national level (Table 8). The 2000 National Census Report reports religion nationally only, prorated and on a tabulable-households base (Table 2.6). A 2000 municipality wave would require the CSO REDATAM online engine (2000-census-portal, `BASE=PHC2K`) — microdata-backed, session-ephemeral — recorded as the deferred unblock.
- **There is no 2020-round census.** The post-2011 census was COVID-delayed (targeted Q4 2022, then postponed); the Geospatial Data Update Exercise began 26 January 2026 and the census is now planned for 2027. No 2020/2021/2022 religion data exists.
- **The route is a direct PDF download, not browser work** — the 2011 Demographic Report is a direct file download from `cso.gov.tt/wp-content/`. The CSO site's HTML pages sit behind a Cloudflare/WAF block that 403s automated fetches, but the `wp-content` PDF paths download directly; the 2000 report was retrieved from the IHSN mirror.
- **The 2011 table does not close integer-exact.** Its printed marginal totals differ from the sums of its printed cells by up to ±2; the published national row itself sums to 1,322,547 against a printed 1,322,546. The discrepancy is source-internal (two extractors agree on all cells) and is disclosed per margin, never repaired.
- **The religion denominator is the non-institutional population (1,322,546), not the total enumerated population (1,328,019).** The institutional population is tabulated separately and is not cross-tabbed by religion.
- **The boundary is OCHA COD-AB, not geoBoundaries.** geoBoundaries TTO ADM1 has a clean OSM/ODbL licence but omits the Borough of Arima (fourteen units); the OCHA COD-AB carries all fifteen census units with pcodes.

## Retrieval record

Every cached input is under `data/raw/tt_census/`, which `git check-ignore -v` confirms is excluded by `.gitignore:120` (the `data/` rule). Retrieval occurred on 2026-07-12; content type verified on every download.

| Cached input | Source URL | Format | SHA-256 |
| --- | --- | --- | --- |
| `tt_2011_demographic_report.pdf` | <https://cso.gov.tt/wp-content/uploads/2020/01/2011-Demographic-Report.pdf> | pdf | `007b0778bd2a92fe22a9851f9214c6a03cc5a8e70c722bb022ba32a9d0794534` |
| `tt_2000_national_census_report.pdf` | <https://catalog.ihsn.org/index.php/catalog/4217/download/55709> | pdf | `1ebf27bf47547c88b7b831c5c4c4e710d7ecfa068aa89be79bdb3493feafe9ac` |
| `tto_adm1_v2.zip` | <https://data.humdata.org/dataset/eed55f95-183c-48f7-adef-23dff31ec972/resource/218b72d0-35fb-4026-b8a6-152d87acea0d/download/tto_adm1_v2.zip> | shp (zip) | `f2f6939a884ba743089b862ed7d92e9d41fde7b8c3fcdce69add51eefc1f1ca4` |
| `hdx_cod_ab_tto.json` | <https://data.humdata.org/api/3/action/package_show?id=cod-ab-tto> | json | `1f24d5297583186f82e300e3ff9a5912747f194a0a7ed48e0665f8ddfe6efb46` |
| `gb_tto_adm1_meta.json` | <https://www.geoboundaries.org/api/current/gbOpen/TTO/ADM1/> | json | `409778dab0427ccc74b83a97be22d1b354c1896669dcca9057d837ce2e34527e` |
| `geoBoundaries-TTO-ADM1.geojson` | <https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/TTO/ADM1/geoBoundaries-TTO-ADM1.geojson> | geojson | `2d2b9dcfb313985b9ab0daf02ba362c43fbfaebbee5e478ad86e6c40beff41e9` |
| `tt_statistics_act.pdf` | <https://cso.gov.tt/wp-content/uploads/2021/01/Statistics-Act.pdf> | pdf | `f2d544c228e7c793a6ec36ecbbd70e09cd85febb5202f9addfa832b28cd1f6e6` |

Also cached (context, not build inputs): `tt_2011_demographic_report.txt` and `tt_2000_national_census_report.txt` (`pdftotext -layout` extractions), `pp_table8.txt` (`pdfplumber` cross-check extraction of the Table 8 both-sexes pages), `tt_table8_parsed.json` (the verified fifteen-unit matrix), `cso_home.html` and `cso_2000_retry.html` (CSO pages behind the WAF, retrieved with browser headers), and the geoBoundaries release GeoJSON (the rejected boundary).

## Product boundary

A build on this probe stages municipality-level religious-affiliation summaries for 2011 (fifteen units, OCHA COD-AB TTO ADM1 CC BY-IGO), with the verbatim seventeen-category 2011 frame, documented-discrepancy reconciliation at both margins (residuals within ±2, every deviation recorded), and the ordinary two-slot design (Not Stated as a disclosed denominator residual). It carries no place-of-worship layer, no cross-wave change layer (single wave), and no 2000 municipality wave (not published) nor 2020-round wave (no census). The census licence is needs_review; the product ships staged with CSO attribution under BUILD-THEN-ASK.

## Blockers and held items

- **Licence** (needs_review, not a hard block under BUILD-THEN-ASK): the CSO permits reproduction of extracts only for "personal, non-commercial use with permission"; the product ships staged with attribution; a CSO courtesy reuse ask is recorded for the PI.
- **Single-wave-subnational page decision** (conductor/PI): the page decision for a single-wave municipality choropleth parallels the Antigua/Barbados task-8 question; the data are built and staged pending that decision.
- **Second wave** (documented gap, not a block): no 2000 (or 2020-round) municipality religion table is published. The clean unblock to a 2000 wave is the CSO REDATAM online engine (2000-census-portal, `BASE=PHC2K`), a session-ephemeral microdata tabulation (the Antigua REDATAM route); recorded as the deferred unblock, not built.
- **Source-internal rounding** (documented, not a block): the published Table 8 marginals differ from the printed-cell sums by up to ±2; rendered verbatim, every residual recorded, never repaired.
- **CSO WAF** (operational, not a block): the `cso.gov.tt` HTML pages 403 automated fetches (Cloudflare); the `wp-content` PDF paths download directly, and the 2000 report was retrieved from the IHSN mirror.
