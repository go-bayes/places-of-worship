# Bosnia and Herzegovina census-religion route probe

Verified 2026-07-12. The Agency for Statistics of Bosnia and Herzegovina (BHAS, `popis.gov.ba` / `bhas.gov.ba`) published the final results of the **2013 Census of Population, Households and Dwellings** with a **count-valued religion-by-municipality cross-tab**: Book 2 (Ethnicity/nationality, Religion, Mother tongue), **Table 5.1 "Stanovništvo prema vjeroispovijesti i spolu, po općinama/gradovima"** (Population by religion and sex, by municipalities/cities), available as a direct open XLSX download. The table carries **21 verbatim religion categories** across **142 municipal units** (141 level-3 municipalities plus Brčko District) and reconciles **exactly at both margins** to the BHAS resident-population total **3,531,159**. The build ships one wave (2013) on the post-Dayton 142-unit municipal frame, on the geoBoundaries BIH ADM3 boundary (142 units, boundaryYearRepresented 2013, Public Domain), under the standing BUILD-THEN-ASK ruling with attribution to BHAS.

**The queue premise is refuted on two points, both material.** The first refuted premise is the wave count: **1991 carries no religion table.** The 1991 SFRY census measured ethnicity/nationality (nacionalna pripadnost), not religion (vjeroispovijest) — the queue row itself calls 1991 an "ethno-religious affiliation proxy". There is no 1991 municipality-level religion cross-tab to render, and no open licensed pre-war (~109-municipality) boundary vector exists; **1991 is HELD** (exact unblock below). The second refuted premise is the unit count: the record publishes **142** municipal units, not ~143 (141 level-3 municipalities — 79 in the Federation, 62 in Republika Srpska — plus Brčko District, which the census itself states: "all municipalities (142)").

## Build decision (recommendation to the conductor)

- **Recommendation: BUILT.** A single-wave (2013), 142-municipality, count-valued, 21-category religion product on a licensed 2013-vintage boundary, both margins reconciling exactly. This clears the subnational bar comfortably and is a far stronger single-wave case than the percentages-only precedents (Guinea 8-region, Antigua parish): integer counts, 142 fine-grained units, a legible religious geography. Ship one wave; hold 1991.
- **Licence: needs_review under BUILD-THEN-ASK, ships with attribution.** No open-data licence is stated on any BHAS census product; the 2013 Book 2 foreword requests source attribution (verbatim below). Derived municipality summaries ship with attribution to BHAS; a BHAS reuse-confirmation courtesy ask is recorded for the PI (do not send). The boundary is Public Domain.
- **Political sensitivity: rendered per RENDER-THE-RECORD.** The 2013 results were disputed — the Republika Srpska institute of statistics (RZS) rejected the BHAS residence-based methodology and published separate entity results. This product renders the **BHAS state-level publication** (resident total 3,531,159) as the official record and states the dispute neutrally on every surface; no number is repaired or reconciled to RZS.
- **Map-worthy pattern.** The religious geography is legible by municipality: the Sarajevo urban core is the most secular (Centar Sarajevo 8.60% Agnostic+Atheist, 86.90% affiliation; Novo Sarajevo 7.14%), Bosniak-majority northwest municipalities are near-uniformly religious (Bužim 99.82% affiliation), and the Muslim/Orthodox/Catholic split tracks the entity and canton lines. National shares: Islam 50.7%, Orthodox 30.7%, Catholic 15.2% of the resident total.

## Published wave and geography

| Year | Official route | Religion-by-municipality table | Universe | Units | Decision |
| --- | --- | --- | --- | --- | --- |
| 2013 | [BHAS 2013 Census, Book 2](https://www.popis.gov.ba/popis2013/knjigePregled.html?lang=bos) (Ethnicity/nationality, Religion, Mother tongue) | **Table 5.1** "Stanovništvo prema vjeroispovijesti i spolu, po općinama/gradovima" — [XLSX](https://www.popis.gov.ba/popis2013/doc/Knjiga2/BOS/K2_T5-1_B.xlsx) (count-valued, 21 categories) | all persons, all ages | 142 (141 level-3 municipalities + Brčko District) | Ship the 142-municipality 2013 wave. |
| 1991 | [Federal Institute of Statistics / FZS](https://fzs.ba/) 1991 SFRY census | none — 1991 measured **ethnicity/nationality**, not religion | — | pre-war ~109 opština frame | **HELD** (no religion table; no licensed pre-war boundary). |

The XLSX is the extraction route: the build reads Table 5.1 directly from the cached `K2_T5-1_B.xlsx` (the same file the printed Book 2 Table 5.1, page 990, renders). The main results book ([RezultatiPopisa_BS.pdf](https://www.popis.gov.ba/popis2013/doc/RezultatiPopisa_BS.pdf)) and the national religion graphs in Book 2 are corroborating context, not the route.

## Category frame (21 lines, preserved verbatim in source column order; never merged)

| # | Bosnian (verbatim) | Published English | Slot role |
| ---: | --- | --- | --- |
| 1 | Islamska | Islam | affiliation |
| 2 | Pravoslavna | Orthodox | affiliation |
| 3 | Katolička | Catholic | affiliation |
| 4 | Muslimanska | Muslim | affiliation |
| 5 | Rimokatolička | Roman Catholic | affiliation |
| 6 | Srpska | Serbian | affiliation |
| 7 | Jehovini svjedoci | Jehovah's Witnesses | affiliation |
| 8 | Grkokatolička | Greek Catholic | affiliation |
| 9 | Protestantska | Protestant | affiliation |
| 10 | Romska | Romani | affiliation |
| 11 | Hrišćanska | Christian | affiliation |
| 12 | Bošnjačka | Bosniak | affiliation |
| 13 | Hrvat | Croat | affiliation |
| 14 | Adventistička | Adventist | affiliation |
| 15 | Bosanac | Bosnian | affiliation |
| 16 | Agnostik | Agnostic | **no-religion** |
| 17 | Ateist | Atheist | **no-religion** |
| 18 | Ostali | Others | affiliation (residual) |
| 19 | Ne izjašnjava se | Undeclared | non-response residual |
| 20 | Nepoznato | Unknown | non-response residual |

Two frame facts govern the treatment. The first frame fact is the ethnonym-in-religion-field lines: Romska, Bošnjačka, Hrvat, and Bosanac are ethnic self-identifications entered in the religion box; they are rendered verbatim as declared-religion lines and counted in affiliation, never invented, merged, or redistributed. The second frame fact is that the census has no single "no religion" line: the two explicitly non-religious declared lines (Agnostik, Ateist) form the no-religion slot, while the two non-response lines (Ne izjašnjava se, Nepoznato) are a denominator residual in neither slot. All 21 categories are preserved per municipality on the quality flag (`source_categories_verbatim`).

## Slot design (ordinary two-slot, KZ/BZ precedent)

- `religious_affiliation_percent` = summed share of every named-religion line (categories 1–15, 18) / population. `religious_affiliation_count` = population − Agnostic − Atheist − Undeclared − Unknown.
- `no_religion_percent` = (Agnostik + Ateist) / population. National no-religion = 38,669 (1.10%).
- The two non-response lines (Undeclared 32,700 + Unknown 6,588 = 39,288 nationally) stay in the denominator and in neither slot, so the two shares need not sum to 100 (the KZ Refused / SB Refuse-to-Answer precedent). National affiliation = 3,453,202 (97.79%).

## Universe and denominator

Religion was asked of the whole resident population in 2013 (no age restriction; the question recorded "whether a person considered him/herself a member of a religion or not"), so each municipality's denominator is its printed resident total and the shares are directly comparable across municipalities within the wave. The single-wave product asserts no cross-wave change.

## Reconciliation gates (verified in the probe; re-checked fail-fast in the build)

- **2013 (Table 5.1, Ukupno/Total)**: every one of the 142 municipality rows' 21 categories sums to its printed Total (0 mismatches); every one of the 21 religion columns sums to its printed national total (Islamska 1,790,454; Pravoslavna 1,085,760; Katolička 536,333; Agnostik 10,816; Ateist 27,853; Ne izjašnjava se 32,700; Nepoznato 6,588; …); the 142 leaf Totals sum to the printed national 3,531,159; the 21 national category totals sum to 3,531,159. Both margins close exactly, integer-exact.
- **Dash convention**: 1,062 of the 2,982 category cells are printed "-" (dash); they read as nil (0). Every municipality row still closes exactly with dashes as zero, confirming the dashes are true zeros, not suppressed cells. No `**`/`z`-style suppression appears in the table.
- The build stops on any margin mismatch; no value is allocated, inferred, rounded, imputed, redistributed, or tuned.

## Boundary source and licence

The boundary is [geoBoundaries BIH ADM3](https://www.geoboundaries.org/api/current/gbOpen/BIH/ADM3/) (gbOpen, pinned commit `f549eab`). The release metadata records, verbatim: `"boundaryLicense": "Public Domain"`, `"licenseSource": "commons.wikimedia.org/wiki/File"`, `"boundarySource": "Wikimedia Commons"`, `"boundaryType": "ADM3"`, `"admUnitCount": "142"`, `"boundaryYearRepresented": "2013"` (retrieved 2026-07-12). The licence field is non-null (Public Domain), so the boundary is accepted (Belize/Dominica precedent for a stated CC/PD field); this is the exact post-Dayton municipal frame of the 2013 census. No official BiH open COD-AB municipal vector exists — HDX carries only the geoBoundaries/Wikimedia mirror (listed there under ODbL, tracing to the same Wikimedia source); the geoBoundaries.org gbOpen per-release Public Domain field is used as the authoritative licence, with attribution to geoBoundaries and Wikimedia Commons carried on the derived boundary.

**Documented name/shapeID crosswalk (join is 142/142).** The geoBoundaries ADM3 shapeNames are English/alternate municipality names, and the layer carries three data-quality quirks, all resolved here by centroid inspection (not by guesswork):

- **16 name-mapped entries**: Doboj East→Doboj-Istok, Doboj Jug→Doboj-Jug, Foča-Ustikolina→Foča-FBiH, Foča→Foča-RS, Pale-Prača→Pale-FBiH, Pale→Pale-RS, Trnovo (BiH)→Trnovo-FBiH, Trnovo (RS)→Trnovo-RS, Kupres (BiH)→Kupres-FBiH, Kupres→Kupres-RS, Mostar→Grad Mostar, Prozor-Rama→Prozor, Centar→Centar Sarajevo, Stari Grad→Stari Grad Sarajevo, **Kupra na Uni** (typo)→Krupa na Uni, Ustiprača→Novo Goražde.
- **3 shapeID-keyed entries** (name alone is ambiguous or wrong): a polygon **mislabelled "Republika Srpska"** whose centroid (19.30°E, 43.82°N) is **Višegrad** (`shapeID 43093233B37160773543814`); two polygons both named **"Novi Grad"** — the western one at 16.47°E is the RS municipality **Novi Grad** (`…B49947296698025`), the Sarajevo one at 18.34°E is **Novi Grad Sarajevo** (`…B94913651340481`).
- Every other municipality joins by shapeName after accent/space normalisation. No municipality is missing; the join is one-to-one and exhaustive.

**Territorial note.** The layer renders the official BiH administrative extent, including the IEBL-split municipalities (Foča, Pale, Trnovo, Kupres each in FBiH and RS forms; the Istočno Sarajevo units) as distinct 2013 municipalities, and Brčko District as its own unit. The build takes no position on the entity dispute; the boundaries and counts are those the 2013 census enumerates.

## Licence position

No open-data licence is stated on any BHAS census product. The rights posture, fetched and quoted verbatim:

- **2013 Census Book 2** (`K2_B_E.pdf`, Director's foreword, retrieved 2026-07-12): "**Molimo korisnike da prilikom upotrebe podataka obavezno navedu izvor.**" / "**Users are kindly requested to mention data source.**" Publisher (Izdavač): "Agencija za statistiku Bosne i Hercegovine / Agency for Statistics of Bosnia and Herzegovina, Zelenih beretki 26, Sarajevo."
- The `popis.gov.ba` census pages carry no separate copyright or terms-of-use text.

The product is a derived aggregate summary (municipality religion shares) carrying full attribution to BHAS, built from an openly published aggregate table, leaking no microdata. BHAS's explicit request is only that the source be cited — an attribution-only posture, favourable but not a formal open licence. Under the standing BUILD-THEN-ASK ruling it ships with attribution (the RO/SK/CI/MONSTAT summaries-with-attribution line); `licence_status: needs_review`, `licence_basis: ba_bhas_attribution_request_build_then_ask`. A BHAS reuse-confirmation email is the clean courtesy unblock, recorded here for the PI (do not send). The boundary carries a stated Public Domain licence.

## The 1991 HOLD (exact unblock)

1991 is HELD on two independent grounds, either sufficient. The first ground is construct: the 1991 SFRY census asked **nationality/ethnicity (nacionalna pripadnost)**, an open-ended question yielding Muslims/Serbs/Croats/Yugoslavs and ~100 minority categories — **not religion (vjeroispovijest)**. There is no 1991 municipality religion cross-tab to render; mapping 1991 ethnicity onto 2013 religion categories would be an invented cross-construct backcast, forbidden by RENDER-THE-RECORD. The second ground is geometry: the 1991 frame is the pre-war ~109-municipality opština frame, a hard break from the post-Dayton 142-unit frame (Dayton split many municipalities along the Inter-Entity Boundary Line and war displacement changed populations), and **no open, licensed pre-war municipal boundary vector exists** — the only dedicated 1991 layer is an academic reconstruction (Beger, from coastline/World Data Bank II), not an official licensed vector; geoBoundaries and HDX carry only the current 2013 frame. The standing CHANGE-WITHHOLD ruling independently bars any 1991↔2013 cross-wave change metric.

**Exact unblock for 1991**: (1) an official BHAS/FZS 1991 municipality-level **religion** cross-tab under a stated open licence — which likely does not exist, since the 1991 census did not ask religion, so a 1991 lane could at most be an *ethnicity* product (a different construct, out of scope for this religion product); **and** (2) a licensed pre-war (~109-municipality) boundary vector. Both are absent.

## Premise corrections (trust the record)

- **1991 has no religion table.** The queue premise "1991-2013 | census religion; census/ethno-religious affiliation proxy" is refuted for 1991: the 1991 census measured ethnicity, not religion. Held; the product is single-wave (2013).
- **142 units, not ~143.** The record publishes 141 level-3 municipalities (79 FBiH + 62 RS) plus Brčko District = 142, exactly as the census states.
- **Route quality is a direct XLSX download, not browser work.** Table 5.1 is a clean open XLSX on popis.gov.ba; no browser session, JS rendering, or CAPTCHA was needed.
- **The licence is an attribution request, not silent/all-rights-reserved.** BHAS explicitly asks only that the source be cited; ships under BUILD-THEN-ASK with attribution.

## Retrieval record

Every cached input is under `data/raw/ba_census/`, which `git check-ignore -v` confirms is excluded by `.gitignore:120` (the `data/` rule). Retrieval occurred on 2026-07-12; content type verified on every download.

| Cached input | Source URL | Format | SHA-256 |
| --- | --- | --- | --- |
| `K2_T5-1_B.xlsx` | <https://www.popis.gov.ba/popis2013/doc/Knjiga2/BOS/K2_T5-1_B.xlsx> | xlsx | `01b0494eaa9dcd4dac35117138ba1e0d9f54496f4848629c00c384221e8e4733` |
| `K2_B_E.pdf` | <https://www.popis.gov.ba/popis2013/doc/Knjiga2/K2_B_E.pdf> | pdf | `8d5f3aee0472b33dda62566be29bb1275243bbe281c4b8e0bdfe065ae968a3be` |
| `RezultatiPopisa_BS.pdf` | <https://www.popis.gov.ba/popis2013/doc/RezultatiPopisa_BS.pdf> | pdf | `d797381149a5020c82a8dfd0b7b5a38078d05029139a0ed70345c1e957a978aa` |
| `geoBoundaries-BIH-ADM3.geojson` | <https://github.com/wmgeolab/geoBoundaries/raw/f549eab/releaseData/gbOpen/BIH/ADM3/geoBoundaries-BIH-ADM3.geojson> | geojson | `d0196a097d9d517f7db6a8013889892c0ab5aab3d7dfd2e74fd5b22152ff8857` |
| `gb_bih_adm3_meta.json` | <https://www.geoboundaries.org/api/current/gbOpen/BIH/ADM3/> | json | `fa56c9960401976a4649d23bca0e94ef12bf2d0b1aab661ff8e7e4f32ef6fa4d` |

`RezultatiPopisa_BS.pdf` and `K2_B_E.pdf` are context/licence evidence (not the extraction source); the product reads `K2_T5-1_B.xlsx` directly.

## Committed outputs

- `scripts/build_ba_area_summary.R` — the builder (reads the cached XLSX, reconciles fail-fast, joins the boundary via the documented crosswalk).
- `apps/regions/ba/data/area_summary_municipality.json` (+ `.csv`) — 142 rows, 2013, three headline fields per municipality plus the verbatim 21-category flag.
- `apps/regions/ba/data/ba_municipality_2013.geojson` — 142 simplified municipality features.
- `docs/manifests/ba-census-religion-2013.json` — data-manifest.v2, validated.

## Blockers and held items

- **1991** (HELD): no religion table (ethnicity only) and no licensed pre-war boundary; exact unblock above.
- **Licence** (needs_review, not a hard block under BUILD-THEN-ASK): BHAS attribution-only request; ships with attribution; BHAS courtesy ask recorded for the PI.
- **Political dispute** (rendered, not a block): the RS institute (RZS) rejected the BHAS methodology; the BHAS state publication is rendered as the official record and the dispute stated neutrally.
- **Boundary provenance** (documented, not a block): geoBoundaries ADM3 (Wikimedia Commons, Public Domain) with three data-quality quirks resolved by a documented name/shapeID crosswalk; no official BiH COD-AB municipal vector is published.
