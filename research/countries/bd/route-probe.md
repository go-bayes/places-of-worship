# Bangladesh census-religion route probe

Verified 2026-07-10. Bangladesh collected religion in the 1974, 1981, 1991, 2001, 2011, and 2022 censuses. The Bangladesh Bureau of Statistics (BBS) frame is Muslim, Hindu, Christian, Buddhist, and Others, with no no-religion and no not-stated category. The verified record does not support the clean continuous 1981-2022 subnational series the audit row claims. Only two waves were pinned to an accessible publication that carries subnational religion: the 2022 National Report (Volume I) Table P08, at district (zila) level, and the 2011 Community Report series, at community (union) level. Subnational religion for 2001, 1991, and 1981 is unpinned in this probe: only national figures were located online.

The 2022 district wave passes every build gate cleanly and is built to staging. The build is held in staging, not shipped to production, because BBS asserts copyright over the report and no open-reuse licence was located; the census reuse terms are unresolved.

## Institution and publication routes

BBS, under the Statistics and Informatics Division of the Ministry of Planning, produces the census reports. The canonical `bbs.portal.gov.bd` host returned "Domain is not available" during this probe, and the `bbs.gov.bd` / `file.portal.gov.bd` hosts failed TLS chain validation or timed out. The 2022 National Report (Volume I) was retrieved from the BBS Oracle Cloud object-storage mirror linked from BBS search results; the 2011 Sherpur Community Report from the National Statistical Data System (`nsds.bbs.gov.bd`).

- [BBS Population and Housing Census page](https://bbs.gov.bd/site/page/47856ad0-7e1c-4aab-bd78-892733bc06eb/Population-and-Housing-Census)
- [BBS website](https://bbs.gov.bd/)

## Waves and published geography

| Wave | Verified religion publication | Published geography | Build decision |
| --- | --- | --- | --- |
| 1981 | National figures only located (Hindu 12.1%). | National | Unpinned. No machine-readable subnational religion file located online in this probe. The audit's 1981 subnational claim is unverified. |
| 1991 | National figures only located (Muslim 88.3%, Hindu 10.5%, Buddhist 0.59%, Christian 0.32%, Others 0.26%; total 106,314,992). | National | Unpinned. No subnational religion file located online in this probe. |
| 2001 | National figures only located (Muslim 111,397,444; Hindu 11,614,781; Buddhist 771,002; Christian 385,501; Others 186,532; total 124,355,263). | National | Unpinned. Subnational religion was published historically in the 2001 zila/community series, but no machine-readable district file was located. |
| 2011 | [Community Report series](https://bbs.gov.bd/site/page/47856ad0-7e1c-4aab-bd78-892733bc06eb/Population-and-Housing-Census) (one PDF per zila), Table C-13 "Distribution of population by religion, residence and community". Sherpur cached as a frame witness. | Community (union/ward) and zila | Deferred. Same 5-category frame verified. A consolidated 64-zila product would require assembling 64 community reports or locating a single machine-readable national volume; not done in this probe. |
| 2022 | [Population and Housing Census 2022, National Report (Volume I)](https://bbs.gov.bd/site/page/47856ad0-7e1c-4aab-bd78-892733bc06eb/Population-and-Housing-Census), Table P08 "Population by Religion, Sex and District". | 64 districts (zila) in 8 divisions, plus a national row | Built to staging. Passes every gate: clean extraction, exact reconciliation, and a licensed boundary joining exactly 64:64. |

The 2022 report also carries division-level religion in Table 3.2.15 (Population by Religion, Division and Location) and a division-by-sex table (Table 3.2.16). Table 3.2.15 uses the full 165,158,616 population; Table P08's sex-classified basis is 165,150,492, the 8,124-person difference being the hijra (third gender) population, which Table 3.2.15 classifies by religion but Table P08 does not classify by sex.

## Category frame

The BBS census frame is five mutually exclusive categories, printed verbatim in Table P08 column order: **Muslim**, **Hindu**, **Christian**, **Buddhist**, **Others**. There is no no-religion category and no not-stated (non-response) category; every enumerated person is therefore classified into one of the five. "Others" carries other religions. The 2011 Community Report Table C-13 uses the identical five categories. The 2022 national composition is 91.08% Muslim, 7.96% Hindu, 0.61% Buddhist, 0.30% Christian, and 0.06% Others (Table 3.2.15).

Because no no-religion or not-stated category exists, religious affiliation is 100 percent in every district. The product renders this honestly: `religious_affiliation_percent` is 100 for every row, and the informative per-district composition (the five category counts) is carried verbatim in each row's `quality_flag`, following the Iran precedent. The product names the recognised categories neutrally, with no editorial framing.

## Denominator and non-response

Table P08 has no separate total-population column and no not-stated category; the district total is the sum of the five religion Total columns. The product denominator is therefore that sum, the sex-classified (male + female) population. It excludes the 8,124 hijra (third gender) persons nationally, who appear only in the religion-by-division Table 3.2.15. Any shipped surface must state that the district table is the sex-classified basis and excludes hijra, and that the census frame carries no no-religion or not-stated category.

## Geography across waves

Bangladesh reorganised its districts extensively, from 20 greater districts in the 1980s to the current 64 zila. This probe does not invent any cross-wave concordance: only a source's own re-tabulation would license one. The 2022 district table and the geoBoundaries ADM2 layer both carry the same current 64-district set; the 2022 product therefore needs no cross-wave harmonisation. A 1981-2022 time series would require each earlier wave restated on a stable frame by the source, which was not located.

## Boundaries and release metadata

The shipped boundary is [geoBoundaries BGD ADM2 release metadata](https://www.geoboundaries.org/api/current/gbOpen/BGD/ADM2/). The cached metadata records boundary ID `BGD-ADM2-16705992`, canonical level `district`, represented year 2020, 64 units, source "Bangladesh Bureau of Statistics (BBS), OCHA ROAP", and licence "Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO)". The pinned [ADM2 GeoJSON](https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/BGD/ADM2/geoBoundaries-BGD-ADM2.geojson) is the shipped source (release commit 9469f09).

The 64 boundary features join the 64 census districts exactly after an anglicised-spelling concordance that maps nine names and invents no geography: Barishal→Barisal, Chattogram→Chittagong, Cumilla→Comilla, Brahmanbaria→Brahamanbaria, Bogura→Bogra, Jashore→Jessore, Moulvibazar→Maulvibazar, Netrokona→Netrakona, and Chapainawabganj→Nawabganj. The remaining 55 names match verbatim.

## Publication terms

The 2022 National Report front matter asserts copyright (Bengali "কর্পোইট ©") and carries ISBN 978-984-475-201-6. No named open-reuse licence was located for the BBS census publications. The derived product is therefore held in staging: the governed area summary, simplified boundary, and manifest are written, but the product is marked `downstream_status: staged` and `licence_status: needs_review` and must not ship to production until BBS reuse terms are established or a rights review sets a lawful release basis. The boundary licence (CC BY 3.0 IGO) is independent and clean. Raw PDFs remain in the git-ignored cache.

A conductor follow-up (2026-07-11) examined the Bangladesh Open Data portal (data.gov.bd), whose footer names BBS among the implementers ("Planning and Implementation: PMO, Cabinet, BCC, BBS and SID"). Its [Terms of Use](https://data.gov.bd/terms-of-use) (cached: `datagovbd_terms_of_use.html`, SHA-256 `52528afa99899534ca150f0864ec8e9c0de5b41cb6b6d7e856ec73aaefcf61a1`) grant permission "to print all the information available in the websites without any deletion, addition or modification" and grant nothing further; the terms establish no derivative-product or redistribution basis, and the modification clause cuts against one. The portal route does not resolve the census reuse question.

## Retrieval record

All inputs were retrieved 2026-07-10. `git check-ignore -v` confirms `.gitignore` line 120 ignores `data/`, including every file under `data/raw/bd_census/`. Each cached input has a sibling `.meta.json`.

| Cached input | SHA-256 |
| --- | --- |
| `phc2022_national_report_vol1.pdf` | `1c315d497629a71df9805b0ff7b3debec033a174dbf8418e4b5912326f86eac6` |
| `phc2011_community_sherpur.pdf` | `97da896179df3d4bf96d426c8a36aeb1bb850f4bf57554273ee23c8a21aed92d` |
| `geoboundaries_bgd_adm2.geojson` | `54379ccc77f6f59dab3569ecc5f9b3850dbed2d65a5f43a034bdf92179f5621b` |
| `geoboundaries_bgd_adm2_metadata.json` | `1f12fb2c5827799d5802b4b8672cf99953fa4ef21f6bee3ffd405a31b77f75ab` |

## Hard-gate result

- **Wave documentation**: partial. Subnational religion is pinned for 2022 (district) and 2011 (community). 2001, 1991, and 1981 subnational religion is unpinned; only national figures were located.
- **Table P08 extraction**: passed. Poppler `pdftotext -layout` extracts the 73-row table (1 national + 8 divisions + 64 districts) with a clean fifteen-column parse and no optical character recognition.
- **Sex-total reconciliation**: passed. Every Male + Female cell equals its printed Total across all five categories and all 73 rows.
- **District-to-division reconciliation**: passed. Every district sums to its division for all fifteen count columns.
- **Division-to-national reconciliation**: passed. All eight divisions sum to the national row for all fifteen count columns.
- **National anchor**: passed. National category totals match the verified values Muslim 150,415,066; Hindu 13,143,749; Christian 488,555; Buddhist 1,001,927; Others 101,195 (sum 165,150,492).
- **Boundary release licence**: passed. geoBoundaries BGD ADM2, CC BY 3.0 IGO, from the release metadata.
- **Boundary join**: passed. Exactly 64:64 after the anglicised-spelling concordance.
- **Simplified boundary**: passed. 64 features, 569,648 bytes at 250 m simplification (under the three-megabyte cap).
- **Census publication rights**: unresolved. BBS asserts copyright and no open-reuse licence was located. The product is held in staging.
- **Product writing**: written to staging. Area summary (JSON and CSV), simplified boundary GeoJSON, and manifest are written under `apps/regions/bd/data/` and `docs/manifests/`.

The builder is [`scripts/build_bd_area_summary.R`](../../../scripts/build_bd_area_summary.R). It stops before any product output on any reconciliation, join, or size-cap failure.

## Minority-share re-emit (2026-07-11)

The product was re-emitted under the ratified minority-share design (project-lead ruling 2026-07-11, task 6; normative document `docs/development/minority-share-metric.md`). The flat five-category BBS frame sums to 100 percent by construction, so the earlier headline `religious_affiliation_percent = 100` choropleth carried no signal. The two legacy metric slots now carry declared constructs. `religious_affiliation_percent` is the reference-group share, the Muslim share, with the reference group declared as Bangladesh's largest published national category in the most recent wave (2022) and held constant across every district. `no_religion_percent` is the minority share, the exact complement: the summed share of Hindu, Christian, Buddhist, and Others. The two slots sum to 100 in every district, and the no-religion slot key is the legacy runtime field name only and carries no no-religion, belief, practice, or secularity meaning. The per-district composition mechanism, the exact district-to-division-to-national reconciliations, the national count anchor, the 64:64 boundary join, and the staged/dark status are all unchanged.

Two gates were added to the builder alongside the existing ones. The complement gate requires the reference-group share and the minority share to sum to exactly 100 in every row. The national reference-group anchor requires the Muslim share on the Table P08 sex-classified basis, 150,415,066 / 165,150,492 = 91.0776%, to reproduce the published national figure of 91.08% (Table 3.2.15) at printed two-decimal rounding. Both pass. The minority share is highest where the map is most informative: Rangamati at 63.74%, Bandarban at 47.26%, against Dhaka at 5.12%.

The re-emit was verified end to end. The build runs clean through every gate; the regenerated `area_summary_district_2022.{json,csv}`, `bd_district_2022.geojson`, and the manifest are written; every row's two slots are exact complements; `scripts/validate_manifests.sh` reports 65/65 pass; and `uvx check-jsonschema --base-uri "file://$PWD/schemas/" --schemafile schemas/data-manifest.schema.json docs/manifests/bd-census-religion-2022.json` returns `ok -- validation done`. The dark, unlinked page `apps/regions/bd/index.html` was relabelled to match: `metricsAvailable` now exposes both slots, `metricLabels` reads "Muslim (%)" and "Minority share (%)" with the design's declarations, and the popup denominator note, onboarding bullets, and census flag note drop the former flat-100 claims. The task-6 metric gate is cleared (ruling 2026-07-11); the page going live additionally awaits the BBS reuse ask the project lead holds (task 1), so the product stays staged and the page stays unlinked from the hub.
