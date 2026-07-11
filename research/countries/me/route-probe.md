# Montenegro census-religion route probe

Verified 2026-07-11. Montenegro collected religion (vjeroispovijest) in the 2003, 2011, and 2023 population censuses, and the Statistical Office of Montenegro (MONSTAT) publishes a religion-by-municipality table for each wave. The route is clean and a three-wave municipality product was built and staged. This document records the routes, the exact URLs, the licence position verbatim, the geography each wave supports, the confidentiality-suppression finding for 2023, and the decision log.

The build ships one stable frame: the 21-municipality administrative division in force for the 2003 and 2011 censuses. The 2023 census reports 25 municipalities; the four units created after 2011 are summed back into their historical parents as complete partitions (Petnjica into Berane, Gusinje into Plav, and Tuzi and Zeta into Podgorica). Population totals reconcile exactly to the national total for every wave. Category counts reconcile exactly for 2003 and 2011; the 2023 municipal table applies statistical-confidentiality suppression to small cells, so its affiliation and no-religion counts are published-cell lower bounds, disclosed and never tuned.

## Institution and publication routes

MONSTAT (Uprava za statistiku / Statistical Office of Montenegro) produced and hosts all three census releases at `monstat.org`. The office is the accession-track national statistical authority and follows Eurostat dissemination practice.

- [MONSTAT English site](https://www.monstat.org/eng/)
- [2023 Census landing page (English)](http://monstat.org/eng/page.php?id=1990&pageid=1758)
- [2011 Census data page (English)](http://www.monstat.org/eng/page.php?id=393&pageid=57)
- [2011 Census municipality-level data (Podaci na nivou opština)](http://www.monstat.org/cg/page.php?id=535&pageid=322)
- [2003 Census publications (Publikacije)](https://www.monstat.org/cg/page.php?id=222)

## Waves and published geography

| Wave | Verified religion publication | Direct source | Published geography | Build decision |
| --- | --- | --- | --- | --- |
| 2003 | Book 3, "Vjeroispovijest, maternji jezik i nacionalna ili etnička pripadnost prema starosti i polu — Podaci po opštinama", Podgorica, November 2004; section 1 "Stanovništvo prema vjeroispovijesti" | [Popis03.zip](http://www.monstat.org/userfiles/file/popis03/Popis03.zip) → `knjiga3SVE.pdf` | National + 21 municipalities (each split urban/rural); national total 620,145 | Shipped. Cyrillic layout-PDF; section-1 municipality total rows parse exactly and reconcile to national. |
| 2011 | Table O19, "Stanovništvo prema vjeroispovijesti po opštinama / Population by religion, per municipalities" | [tabela O19.xls](https://www.monstat.org/userfiles/file/popis2011/PODACI%20OPSTINE/nove/tabela%20O19.xls) | National + 21 municipalities; national total 620,029 | Shipped. Clean bilingual Excel, no suppression, exact reconciliation. |
| 2023 | Release II, "Population of Montenegro by national i.e. ethnical affiliation, religion, mother tongue and language", Table 2 "Population of Montenegro by religion, by municipalities" | [TABELA_Popis stanovnistva 2023 II_ENG.xlsx](https://www.monstat.org/uploads/files/popis%202021/saopstenja/TABELA_Popis%20stanovnistva%202023%20II_ENG.xlsx) | National + 25 municipalities; national total 623,633 | Shipped, aggregated to the 21-municipality frame. National row fully published; 18 of 25 municipalities carry confidentiality-suppressed ("z") small cells. |

The administrative division is the pivotal geography fact. Montenegro had 21 municipalities for both the 2003 and 2011 censuses. Petnjica (from Berane, 2013), Gusinje (from Plav, 2014), Tuzi (from Podgorica, 2018), and Zeta (from Podgorica, 2024) were created afterwards, so the 2023 census reports 25 municipalities. Because each new unit was carved wholly from one parent, the 25 units aggregate to the historical 21 as an exact complete partition, which is the change frame the product uses.

## Category frames (source labels are the record)

Each wave preserves its own published categories. Named religions are summed for the affiliation headline; the wave-specific no-religion category is the no-religion headline; non-response stays in the denominator and outside both headlines.

- **2003 (Cyrillic, 10 categories + Total):** Исламска (Islamic), Јудаистичка (Judaic), Католичка (Catholic), Православна (Orthodox), Протестантска (Protestant), Прооријенталних култова (Pro-oriental cults), Друге вјероисповијести (Other religions) — affiliation; Није вјерник (Not a believer) — no religion; Неизјашњен (Undeclared) and Непознато (Unknown) — non-response.
- **2011 (Montenegrin Latin / English, 12 categories + Total):** Pravoslavna/Orthodox, Katolička/Catholics, Islamska/Islam, Adventist, Budisti/Buddhist, Hrišćani/Christians, Jehovini svjedoci/Jehovah witness, Protestant/Protestants, Ostale vjeroispovijesti/Other religions — affiliation; Agnostik/Agnostic and Ateista/Atheist — no religion; Ne želi da se izjasni/Does not want to declare — non-response.
- **2023 (MONSTAT English, 12 leaf categories + Total; spelling "Ortodox" kept as published):** Ortodox, Catholics, Protestant, Jehovah witness, Other christian, Islam, Buddhist, Other religion — affiliation; Atheist and Agnostic — no religion; Does not want to declare and the residual Other — outside both headlines. The "Christianity" header spans the five Christian detail columns and is a visual grouping, not a separate numeric column, so no value is double-counted.

Cross-wave change is shipped because all three waves share the total-population denominator and the affiliation/no-religion split; the differing non-response categories all stay inside the denominator. The residual 2023 "Other" (989 nationally) is held outside both headlines because a distinct "Other religion" category already exists and "Other" is not a named religion.

## 2023 confidentiality suppression (disclosed, not tuned)

The 2023 municipal table masks small category cells with "z" (statistical confidentiality). The national row carries no suppression and reconciles exactly. Across the 25 published municipalities, 18 carry at least one suppressed religion cell; after aggregation to the 21-municipality frame, 17 of 21 carry suppression, and the total suppressed mass is 247 persons (the exact difference between each municipality's published total and the sum of its published category cells). The build computes affiliation and no-religion from the published cells, records the suppressed mass, flags affected municipality-years with `monstat_confidentiality_suppression_z`, and never redistributes or estimates the masked cells. Municipality population totals are published in full and reconcile exactly, so the population-denominator choropleth is exact everywhere; only the 2023 category numerators are lower bounds where suppression applies. The affected shares are understated by at most about one percent in the smallest municipalities (Šavnik, gap 20/1,569) and far less elsewhere.

## Boundaries and release metadata

The intended open boundary is [geoBoundaries Montenegro ADM1](https://www.geoboundaries.org/api/current/gbOpen/MNE/ADM1/). The release metadata records boundary ID `MNE-ADM1-59799669`, 23 units, represented year 2017, source "OpenStreetMap, Wambacher", and licence `licenseDetail` = "Open Data Commons Open Database License 1.0" with `licenseSource` = "www.openstreetmap.org/copyright". The 23-feature layer has Petnjica and Gusinje as separate features but keeps Tuzi and Zeta inside Podgorica (both post-date the 2017 vintage). The build dissolves Petnjica into Berane and Gusinje into Plav to reach the 21 pre-2013 municipalities, reproducing the external and internal boundaries of the 2003–2011 division. The pinned GeoJSON is [geoBoundaries-MNE-ADM1.geojson](https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/MNE/ADM1/geoBoundaries-MNE-ADM1.geojson). The dissolved 21-feature layer passed the validity, non-empty, and distinct-geometry-hash gates (21 valid features, 21 distinct SHA-256 WKB hashes) and simplified to 432,791 bytes, well within the cap. No official MONSTAT or state-geoportal vector was located under an open licence; the ODbL geoBoundaries release is the boundary of record (Ghana ODbL share-alike precedent).

## Publication terms (verbatim)

No open-data licence or reproduction clause was located for the MONSTAT census publications. The English site footer reserves all rights. The byte-exact string, read from the cached page HTML (`data/raw/me_census/monstat_home_eng.html`), is:

> Copyrights © 2025 All Rights Reserved by MONSTAT.

This is the same all-rights-reserved position handled for Serbia (needs_review) and Côte d'Ivoire (shipped under PI approval). The build ships derived category summaries with MONSTAT attribution, keeps the raw sources git-ignored, sets `licence_status` = `needs_review` and `licence_basis` = `monstat_all_rights_reserved_attribution`, and defers the reuse ruling to the conductor/PI. The boundary source is separately ODbL (geoBoundaries / OpenStreetMap), recorded with attribution.

## Retrieval record

All inputs were retrieved on 2026-07-11 with ordinary certificate verification. Raw sources are cached under `data/raw/me_census/` (git-ignored) and mirrored to `gs://pow-research-data/raw_sources/me_census/` (8 objects).

| Cached input | SHA-256 |
| --- | --- |
| `me_2003_book3_religion.zip` | `9444879335f72565e53e36de974a69acf68d4467b089225d0283fb3b3a876f8c` |
| `knjiga3SVE.pdf` | `6949414ad089b967ff76498877a17eb13b5d9f2505e5bbe8ab44150da2c2ba4f` |
| `knjiga3SVE.txt` (derived, pdftotext -layout) | `1065316fd50621205f14f08b0a2bc4d8325cb22b5625f40a4ebc563e5da8ac8a` |
| `me_2011_O19_religion_by_municipality.xls` | `e2a6002ddbdbdb478304d73a76a836c9cb2d4f3055c85a8da124aff5b3f4405f` |
| `me_2023_II_ethnicity_religion_language_ENG.xlsx` | `7fca1d35f8fc5577d4672f6323da18541b6ccbcc7ff7137f9f647274949642cd` |
| `monstat_home_eng.html` | `4de83112319593ceabe587cfe098526599e0a89ae0eb78792cca868b783729fb` |
| `geoboundaries_mne_adm1_metadata.json` | `1dea6ff792e2885513a2d688b29b076bec4c94ff983a102bfd540120879a6244` |
| `geoboundaries_mne_adm1.geojson` | `9674292fbc0a50c68c6584a2ae23fae768e76cc796bdb7e3e009c0197aec6ae3` |

## Hard-gate result

- **Wave documentation**: passed. A religion-by-municipality publication is pinned for 2003, 2011, and 2023.
- **Population-total reconciliation**: passed, exact. The 21 municipality totals sum to the published national total for every wave (2003 = 620,145; 2011 = 620,029; 2023 = 623,633).
- **Category reconciliation (2003, 2011)**: passed, exact. Every category sums within municipality to the row total and from the 21 municipalities to the national row.
- **Category reconciliation (2023)**: not exact by construction. MONSTAT confidentiality suppression masks small municipal cells; the suppressed mass (247 persons across 17 municipalities) is disclosed and flagged, and no value is tuned or redistributed. The national 2023 row is fully published and reconciles exactly.
- **Boundary release licence**: passed. geoBoundaries MNE ADM1 is ODbL per the release metadata.
- **Source geometry**: passed. The dissolved 21-feature layer is valid, non-empty, has 21 distinct geometry hashes, and simplifies within the byte cap.
- **Census publication rights**: all rights reserved (verbatim above); `needs_review`, derived summaries shipped with attribution pending a conductor/PI ruling.
- **Product writing**: complete. The four staged outputs are written and uncommitted.

## Validation (named)

Area summary, against `schemas/area-summary.schema.json`:

```
uvx check-jsonschema --base-uri "file://$PWD/schemas/" --schemafile schemas/area-summary.schema.json apps/regions/me/data/area_summary_municipality.json
ok -- validation done
```

Manifest, against `schemas/data-manifest.schema.json` via the repository validator:

```
bash scripts/validate_manifests.sh
manifest validation: 58/58 pass
```

## Staged products

- `scripts/build_me_area_summary.R` — the fail-fast builder.
- `apps/regions/me/data/area_summary_municipality.json` — 63 municipality-year rows (21 × 3), sha256 `1c1b8e62bc6ecaafd5258b48a7c6fcc8647176448797ba3062be55514461714b`.
- `apps/regions/me/data/area_summary_municipality.csv` — CSV companion, sha256 `78cf0c57056cbe6c183f99c9f025f421a4ad43597f915868b2958856a9ecf4cf`.
- `apps/regions/me/data/me_municipality_2003_2011_frame.geojson` — 21 simplified features, sha256 `a90fa617ff511fdfd06bf8bddf813b02b2bd95377ec67941d8264d2ff63a6844`.
- `docs/manifests/me-census-religion-2003-2023.json` — data-manifest.v2, sha256 `66fd84288a634535118ab32185956930b7a79641a0bec2669b2c4ab9efb1cdc3`.

## Decision log

1. **Three-wave stable frame.** The product ships all three waves on the 21-municipality 2003–2011 division. This is the coarsest official frame that preserves every wave's published claim (adding-a-region companion guidance; Serbia/Slovakia precedent), and it lets the 2023 census aggregate onto it exactly.
2. **2023 aggregation.** The 25 published 2023 municipalities aggregate to the 21-frame by complete-unit sums (Petnjica→Berane, Gusinje→Plav, Tuzi→Podgorica, Zeta→Podgorica). No allocation or splitting is performed; the aggregated totals reconcile to the national total exactly.
3. **2023 suppression.** Confidentiality suppression is disclosed and flagged, not tuned. The exact-reconciliation gate is enforced on the population denominator (all waves) and on the category detail for the two unsuppressed waves; for 2023 the category numerators are published-cell lower bounds, following the NZ rr3 flagged-suppression precedent rather than fabricating masked cells.
4. **Category frames.** Preserved verbatim per wave (Bulgaria precedent). The headline affiliation/no-religion split is comparable across waves because all waves share the total-population denominator and the named-religion versus non-response distinction.
5. **Boundary.** geoBoundaries MNE ADM1 under ODbL, dissolved to 21; no open official vector was found.
6. **Licence.** MONSTAT reserves all rights (verbatim); `needs_review`; derived summaries with attribution; reuse ruling deferred.

## Open questions for the conductor

1. **2023 suppression — ship or hold.** The 2023 wave carries confidentiality-suppressed municipal category cells (247 persons across 17 municipalities), so its affiliation and no-religion shares are marginally understated where masked. The recommendation is to ship with the disclosure and the `monstat_confidentiality_suppression_z` flag (NZ rr3 precedent, and the runtime already washes flagged rows). Confirm, or hold 2023 and ship the exact two-wave 2003→2011 product.
2. **MONSTAT reuse position.** The census terms are all-rights-reserved with no reproduction clause. Confirm the ship-derived-summaries-with-attribution stance (Serbia/Côte d'Ivoire precedent), or direct a reuse ask to MONSTAT before the page goes live.
3. **25-municipality 2023 detail level.** The current-division 25-municipality 2023 table is recorded in `deferred_sources`. A second, current-frame level would need a licensed 25-unit boundary (Tuzi and Zeta separate) and a companion design. Rule on whether to pursue it now or leave it deferred.
4. **`monstat_confidentiality_suppression_z` wash-out.** If the 2023 flag should trigger the same wash-colour treatment as `rr3_small_denominator`, the substring must be added to the shared module's `rowFlagged()` chain during page wiring (out of scope for this data lane).
