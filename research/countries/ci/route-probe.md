# Côte d'Ivoire census-religion route probe

Verified 2026-07-10; corrected and extended 2026-07-11. Côte d'Ivoire collected religion in the 1988, 1998, 2014, and 2021 censuses. The verified publications do not provide one continuous subnational series. The 1998 analytical volume gives one-decimal percentages for 19 historical regions. The 2014 synthesis gives a national table. The 2021 base table gives exact category counts for 519 sub-prefecture-or-commune leaf rows plus department, region, district, and national aggregates.

The build stops at the census-to-boundary join. The documented-discrepancy and basis-constant rulings are resolved and encoded, the geoBoundaries name-encoding defect is diagnosed and repaired, and the Abidjan aggregate join is engineered; but the 519 census leaves do not join one-to-one to the 510 geoBoundaries ADM3 features, and the residue cannot be closed without an invented concordance or self-summing. The engineering resolution and the precise residue are recorded in the "Engineering fix lane" section below; the four earlier "Ship-lane execution" blockers are each dispositioned there.

## Institution and publication routes

The Institut National de la Statistique (INS) produced the cited census publications. The Agence Nationale de la Statistique (ANStat) replaced INS in June 2024 and now hosts the publications and data portals. The official government account records the institutional replacement, and the ANStat site links the RGPH 2021 portal and the INS-era calculation centre.

- [Government account of the INS-to-ANStat replacement](https://www.gouv.ci/actualite/thiekoro-doumbia-directeur-general-de-lagence-nationale-de-la-statistique-anstat-2374)
- [ANStat website](https://www.anstat.ci/)
- [ANStat public administrative-boundary API documentation](https://anstat.ci/public/api)
- [ANStat calculation centre](https://centredecalcul.anstat.ci/)

## Waves and published geography

| Wave | Verified religion publication | Published geography | Build decision |
| --- | --- | --- | --- |
| 1988 | [RGPH 1998 Volume IV, Tome 1](https://centredecalcul.anstat.ci/assets/rapports/RGPH_98/RGPH_TOME1.pdf), Table 3.2; [RGPH 2021 thematic report, Tome 1](https://www.anstat.ci/assets/publications/files/rgpg_tom1.pdf), Table 4.9 | National percentages by sex in Table 3.2; exact national counts republished in Table 4.9 | National context only. No original official online 1988 subnational religion table was pinned. |
| 1998 | [RGPH 1998 Volume IV, Tome 1](https://centredecalcul.anstat.ci/assets/rapports/RGPH_98/RGPH_TOME1.pdf), Tables 3.1–3.9 | National results and one-decimal percentages for 19 historical regions in Table 3.6 | Withheld. The verified regional table has rounded percentages, and no licensed historical 19-region geometry with exact count reconciliation was pinned. |
| 2014 | [RGPH 2014 synthesis](https://centredecalcul.anstat.ci/assets/rapports/RGPH_2014/Rapport_RGPH_2014.pdf), Table 2.11 | National, split by Ivoirian and non-Ivoirian nationality | National context only. No subnational religion table appears in the verified synthesis volume. |
| 2021 | [RGPH 2021 Base Table 11](https://rp2021.anstat.ci/wp-content/uploads/2023/09/TABLEAUX-11_DE-BASES_RP-RELIGION.pdf) | 519 sub-prefecture-or-commune leaf rows; department, region, district, and national aggregates | Intended finest-geography product. Blocked at the census-to-ADM3 join (Engineering fix lane, below). |

The separate [RGPH 2021 global-results population table](https://plan.gouv.ci/assets/fichier/RGPH2021-RESULTATS-GLOBAUX-VF.pdf) confirms the printed local resident totals, including Nouamou at 17,403 people. It therefore does not resolve the Table 11 overrun for Nouamou, whose 16 religion categories sum to 17,405.

## Category frames

### 1988

The 1988 frame has seven mutually exclusive published categories: *Catholique* (Catholic), *Protestant* (Protestant), *Harriste* (Harrist), *Musulman* (Muslim), *Animiste* (Animist), *Autres Religions* (Other religions), and *Sans Religion* (No religion). *Ensemble chrétien* (All Christians) is a subtotal. The source note states that other Christians were combined with other religions in 1988. Table 4.9 gives a national total of 10,815,694.

### 1998

The 1998 frame has nine mutually exclusive categories: *Catholique* (Catholic), *Protestant* (Protestant), *Harriste* (Harrist), *Autres chrétiens* (Other Christians), *Musulman* (Muslim), *Animiste* (Animist), *Autres religions* (Other religions), *Sans religion* (No religion), and *Non déclaré* (Not declared). *Ensemble Chrétiens* (All Christians) is a subtotal. Table 4.9 gives a national total of 15,366,672, including 108,648 not-declared responses.

### 2014

The 2014 frame has 11 mutually exclusive categories: *Catholique* (Catholic), *Méthodiste* (Methodist), *Evangélique* (Evangelical), *Céleste* (Celestial Church), *Harriste* (Harrist), *Autres chrétiens* (Other Christians), *Musulmane* (Muslim), *Animistes* (Animist), *Autres religions* (Other religions), *Sans religion* (No religion), and *Non déclaré* (Not declared). *Ensemble Chrétiens* (All Christians) is a subtotal. Table 2.11 gives a national total of 22,671,331, including 5,652 not-declared responses.

### 2021

Base Table 11 has 16 mutually exclusive categories. French source spellings remain unchanged in the extraction record; English labels are display labels.

| French source category | English display label | Product role |
| --- | --- | --- |
| Sans réligion | No religion | no religion |
| Catholique | Catholic | religious affiliation |
| Méthodiste / Protestant | Methodist / Protestant | religious affiliation |
| Evangélique (Assemblée de Dieu, Baptiste, Pentecôte, CM, Etc.) | Evangelical | religious affiliation |
| Céleste | Celestial Church | religious affiliation |
| Harriste | Harrist | religious affiliation |
| Témoin de Jéhovah | Jehovah's Witness | religious affiliation |
| Papa nouveau | Papa Nouveau | religious affiliation |
| Autre Chrétien | Other Christian | religious affiliation |
| Musulman (e) | Muslim | religious affiliation |
| Animiste | Animist | religious affiliation |
| Boudhiste | Buddhist | religious affiliation |
| Déhima | Dehima | religious affiliation |
| Autres réligion (à préciser) | Other religion | religious affiliation |
| Ne sait pas | Does not know | unknown |
| Non déclarée | Not declared | non-response |

## Denominator and non-response decisions

RGPH 2021 distinguishes ordinary households, collective households, and people without housing. The thematic report states that individual characteristics were collected only for ordinary-household residents. Its Table 2.2 gives 29,276,660 ordinary-household residents, 106,743 collective-household residents, and 5,747 people without housing. The full resident total is 29,389,150.

The 16 national religion categories in Base Table 11 sum to 29,276,660. The displayed population column gives 29,389,150. A valid product denominator would therefore be the ordinary-household religion basis, derived exactly as the sum of the 16 categories. *Ne sait pas* and *Non déclarée* would remain inside that denominator and outside the two headline numerators. The displayed resident total would remain a disclosure field with an exact 112,490-person outside-basis count.

The source-level reconciliation failure prevents that denominator rule from being applied locally. Thirty-one rows have a negative outside-basis count: the categories exceed the full resident total by 41 people in aggregate. The overrun is one or two people per affected row. Department and national aggregates can still reconcile because positive residuals in other local rows offset these overruns; that cancellation cannot validate each local row.

Religious-affiliation change is withheld. The older waves lack a matching exact-count local frame, and the 2021 local product has not passed extraction validation.

## Boundaries and release metadata

The official [ANStat boundary API](https://anstat.ci/public/api) offers district, region, department, and sub-prefecture downloads. The page footer says “Tous droits Reservés” and provides no reuse licence. Those files therefore cannot support a permissive boundary claim.

The intended open boundary is [geoBoundaries Côte d'Ivoire administrative level 3 (ADM3) release metadata](https://www.geoboundaries.org/api/current/gbOpen/CIV/ADM3/). The actual release metadata records boundary ID `CIV-ADM3-97208781`, 510 units, represented year 2021, and Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO). The recorded sources are the Comité National de Télédétection et d'Information Géographique (CNTIG) and the United Nations Office for the Coordination of Humanitarian Affairs Regional Office for West and Central Africa (OCHA ROWCA). The pinned [ADM3 Geographic JavaScript Object Notation (GeoJSON)](https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/CIV/ADM3/geoBoundaries-CIV-ADM3.geojson) is the proposed shipped source.

The 510-feature source geometry passed the read-only source tests actually run. The layer has 510 non-empty valid features and 510 distinct geometry hashes. It has no interior gaps, feature below one square kilometre, or positive overlap above the one-square-metre tolerance. The smallest feature is 34.1213 square kilometres. A simplified output was not created because census reconciliation failed first.

The [geoBoundaries Côte d'Ivoire administrative level 2 (ADM2) release metadata](https://www.geoboundaries.org/api/current/gbOpen/CIV/ADM2/) records 33 region or autonomous-district features under Creative Commons Attribution 4.0 International. The builder would use the ADM2 layer only to disambiguate repeated local names by spatial containment.

## Publication terms

No named open licence was located for the census publications. The current ANStat website and its API page state that all rights are reserved. Raw PDFs remain in the git-ignored cache. Any complete derived table must remain staged until the project obtains permission or a rights review establishes a lawful release basis.

## Retrieval record

All inputs were retrieved on 2026-07-10. The `rp2021.anstat.ci` and `anstat.ci` certificate chains did not validate in the local environment. The four census PDFs were therefore retrieved from their exact Hypertext Transfer Protocol Secure (HTTPS) URLs with certificate verification disabled. The geoBoundaries downloads used ordinary certificate verification.

| Cached input | SHA-256 |
| --- | --- |
| `rgph1998_volume4_tome1.pdf` | `7912cd2c5230a991c4402d450a42d80688ffc8a87d01b69b15b3ea9622c0a119` |
| `rgph2014_synthesis.pdf` | `07ab34d73ab0e1a9fd2b4096f1ae64fce5484317de491c801bbe1e6ab595d12f` |
| `rgph2021_table_11_religion.pdf` | `60fcf96dd0044136c56a4646954809797ae28b82fb76bc3c8cbd1beab688a0da` |
| `rgph2021_tome1_state_structure.pdf` | `e34dd2f60badef59d99019b3b01a5ef3c1fa70cbab04dc13cc8d680195aa0cfa` |
| `geoboundaries_civ_adm3_metadata.json` | `dd91a6d185931f2a382d00c9710614bb4709f554a50b574003de586ae0be3059` |
| `geoboundaries_civ_adm3.geojson` | `7bf038dd0c666f76f5638289cf80991997a7f26e891578b57222d939e11b9da8` |
| `geoboundaries_civ_adm2_metadata.json` | `63cd804bada7a4763be9389b10cd12ff6daa8dea8100a7c78fd44c41e1d23aa3` |
| `geoboundaries_civ_adm2.geojson` | `a9035b8f759e54ae5f6c1289a7b06711d6cd4f0e9545f83e319388304e1a1403` |

## Hard-gate result

- **Wave documentation**: passed. Religion publication evidence is recorded for 1988, 1998, 2014, and 2021.
- **Paired PDF extraction**: passed. All 677 Table 11 row keys and displayed population totals agree across the paired sheets.
- **Every-row reconciliation**: failed. Thirty-one local category sums exceed their printed resident totals by a combined 41 people.
- **Local-to-national reconciliation**: not reached in the governed build because every-row reconciliation failed first.
- **Boundary release licence**: passed for the proposed geoBoundaries ADM3 source. The licence claim comes from the release metadata.
- **Source geometry**: passed for the unsimplified 510-feature input. Simplified-output tests were not run.
- **Census publication rights**: open. ANStat states that all rights are reserved.
- **Product writing**: stopped. No JSON, CSV, GeoJSON, or manifest product was written.

The fail-fast builder is [`scripts/build_ci_area_summary.R`](../../../scripts/build_ci_area_summary.R). It preserves the extraction route and stops on the 31 invalid local rows before any product output.

## Verification outcome (2026-07-10)

An independent image verification settled the gate question. All 31 failing rows were re-read from 300-dots-per-inch page renders, independently of `pdftotext`, and every printed cell matched the extraction; the overruns are the source's own arithmetic ([reconciliation-verification.md](reconciliation-verification.md)). The conductor's recommendation to the PI is to ship with the discrepancy documented on the shipped surface, following the Israel residuals precedent. The build stays held until the PI rules on that recommendation and on the ANStat all-rights-reserved publication terms.

## Ship-lane execution (2026-07-11)

The PI ruled on 2026-07-10 (research/build-queue.md) to SHIP with the documented-discrepancy treatment and to publish derived summaries with attribution under PI approval, notwithstanding the ANStat "Tous droits Reservés" footer (Iran licence-encoding precedent). Two rulings are recorded here: first ruling, the 31 source-arithmetic overrun rows ship unchanged with a disclosed, never-clamped negative outside-basis count; second ruling, derived category summaries (not raw source tables) publish with INS/ANStat attribution under PI approval, raw PDFs staying git-ignored.

The builder was reworked to encode both rulings: the negative-outside-basis hard stop is replaced by a disclosed field (per-row `quality_flag` and CSV columns), a 31-row/41-person integrity gate ties the disclosure to reconciliation-verification.md, the licence strings carry the PI-approval encoding, the manifest is renamed to `ci-census-religion-2021.json`, and `raw_cache_durable_uris` is added. Every other gate stays hard.

Running the reworked builder to completion — for the first time, because the former hard stop fired before these gates — surfaced blockers that the held probe never validated and that the disclosure ruling does not cover. These are performed verifications, not estimates:

- **Local unit count.** Table 11 yields 519 leaf sub-prefecture-or-commune rows, not 510. The 519 leaves partition the country (their resident totals sum to 29,389,156, six above the printed national 29,389,150, consistent with pervasive source rounding, not double counting). The earlier "510 local rows" figure was asserted, never produced by a completed parse.
- **Source does not internally reconcile.** Printed department totals differ from the sums of their printed sub-prefecture rows by one to three people across at least 48 departments. Verified directly against the rendered page: ADIAKE prints sub-prefectures 50,556 + 21,941 + 15,510 = 88,007 against a printed department total of 88,006 (+1). The pervasive discrepancy is the same class as the 31 local overruns, not a parse error.
- **National basis constant is wrong.** Table 11's national "Ensemble CÔTE D'IVOIRE" row sums its 16 categories to 29,276,658 (outside-basis 112,492), not the 29,276,660 (outside-basis 112,490) the probe took from Tome 1 Table 2.2. The hard national-basis gate therefore cannot pass, and the exact local-to-national reconciliation gate cannot pass on a source that does not internally reconcile.
- **Census-to-boundary join is not one-to-one.** Only 322 of the 519 census leaf names match a geoBoundaries ADM3 `shapeName` even ignoring region. Two causes: the geoBoundaries CIV ADM3 `shapeName` field is mojibake-corrupted for accented names (ADZOPÉ renders as "ADZOP..", ABOISSO COMOÉ as "ABOISSO COMO..", AFFÉRY, ALÉPÉ, ANNÉPÉ, ANDÉ, AMÉLÉKIA), which the current `repair_mojibake` (Ã/Â only) does not fix; and genuine geography differences, chiefly Abidjan, which the census splits into thirteen communes plus rural sub-prefectures while ADM3 carries a single ABIDJAN feature (Yamoussoukro similarly). No verified 519→510 concordance exists, and the strict 1:1 name-region join in `build_boundary` cannot be satisfied without one.

Consequently the lane is **BLOCKED-execution** at the local-count and national-basis gates. Nothing was written to `apps/regions/ci/data/` or `docs/manifests/`. The disclosure and licence rework is in place in `scripts/build_ci_area_summary.R` for when the upstream blockers are resolved. Shipping a valid 510-unit product requires, at minimum: a proper Unicode repair of the geoBoundaries ADM3 names; a verified concordance mapping the 519 census leaves to the 510 ADM3 features (resolving the Abidjan and Yamoussoukro commune splits, by aggregation or by a finer boundary layer); correction of the national-basis constant to the actually-extracted 29,276,658 (or an independent cell-level re-read of the national row); and a redefinition of the local-to-national gate to a documented-tolerance form that acknowledges the source's non-reconciling printed arithmetic. Each is a PI-level design decision beyond the disclosure ruling and none can be fabricated under the performed-verifications-only rule.

## Engineering fix lane (2026-07-11)

The conductor ruled on each ship-lane blocker (disclosure scope, basis constant, verification requirement, join engineering, and the 519-leaf correction). This section records the engineering resolution. Three of the four blockers are resolved and encoded in `scripts/build_ci_area_summary.R`; the fourth, the census-to-boundary join, has an irreducible residue and stops the build. The build now runs the corrected parse, passes every pinned discrepancy gate, and halts inside `build_boundary` with the residue written to `research/countries/ci/join-residue.csv`.

### Blocker 1 — local unit count (resolved). The 519-leaf finding replaces the probe's 510-leaf premise. Table 11 has 677 printed rows: 519 sub-prefecture-or-commune leaves, 110 department totals, 31 regions, 14 districts (12 ordinary "District du/des/de X" plus the two "District Autonome"), two Abidjan sub-aggregates ("Total-Ville ABIDJAN", "Total-S/P ABIDJAN"), and the national row. The earlier "510 local rows" figure double-counted nothing and mis-counted nothing structural; it simply had never been produced by a completed parse. The builder now asserts exactly 519 leaves.

### Blocker 2 — national basis constant (resolved, ruling 2). The product's national religion basis is Table 11's own national row: its 16 categories sum to 29 276 658, with a 112 492-person outside-basis count against the printed resident total of 29 389 150. The thematic report's Tome 1 Table 2.2 gives 29 276 660 ordinary-household residents; the 2-person difference is a between-publications discrepancy, disclosed and not corrected. The builder pins 29 276 658 / 112 492 and carries 29 276 660 as the disclosed Tome 1 figure.

### Blocker 3 — verification of the extended discrepancy set (resolved, ruling 3). The documented-discrepancy treatment covers every level of Table 11's printed arithmetic. All levels were image-verified at 300 dots per inch (`reconciliation-verification.md`): the 31 leaf overruns (prior), five department component-sum discrepancies spanning −3 to +2 (ADIAKE, BETTIE, BONON, ODIENNE, SASSANDRA), and the national row's 16 categories and printed total. Every image readback matched the extraction cell-for-cell. The full discrepancy set is pinned machine-derived and the builder stops on drift: 31 leaf overruns (41 persons); 48 of 110 departments failing component-sum reconciliation (signed sum −6, absolute sum 52 persons); and the leaf-to-national totals (+6 residents, −138 religion basis). The source's printed arithmetic does not internally reconcile at any level; every printed value ships unchanged.

### Blocker 4a — geoBoundaries name-encoding defect (diagnosed and repaired, ruling 4a). The `shapeName` field is doubly UTF-8-encoded. Raw-byte inspection shows that a correctly encoded accented byte pair, for example e-acute (`0xC3 0xA9`), was decoded once as Latin-1 (yielding the two characters "Ã©") and then re-encoded to UTF-8; the file therefore stores four bytes `0xC3 0x83 0xC2 0xA9` for a single "é". The repair reverses exactly one such layer: re-encode each string's code points to Latin-1 bytes, then reinterpret those bytes as UTF-8. The transform is gated on the mojibake signature (a string containing the "Ã"/"Â" lead characters) and never applied to clean strings, because the macOS `iconv` build silently drops invalid bytes rather than returning `NA`; an ungated round-trip would therefore strip real accents (for example "Aboudé" would become "Aboud"). The gate confines the round-trip to the 166 of 510 names that carry the signature; after repair the names contain only legitimate French letters (é, è, ï) and no residual "Ã". A second defect compounded the earlier 322-of-519 match figure: name normalisation used `iconv` `ASCII//TRANSLIT`, which on macOS renders "É" as "'E" (apostrophe-E) and thereby split accented names apart. The normaliser now transliterates with `stringi::stri_trans_general(x, "Latin-ASCII")`. After both fixes, 488 of the 510 census join units match a distinct ADM3 feature by normalised name.

### Blocker 4b — Abidjan and Yamoussoukro aggregate join (engineered, ruling 4b). The census prints its own aggregate rows for the two autonomous districts. For Abidjan, the ADM3 frame carries a single "Abidjan" feature for the autonomous city, while the census splits the city into 10 communes (ABOBO, ADJAME, ATTECOUBE, COCODY, KOUMASSI, MARCORY, PLATEAU, PORT-BOUET, TREICHVILLE, YOPOUGON) and prints a "Total-Ville ABIDJAN" city aggregate. The builder joins that one printed city aggregate to the single "Abidjan" feature and keeps the district's four sub-prefectures (ANYAMA → Anyama, BINGERVILLE → Bingerville, BROFODOUME → Brofodoumé, SONGON → Songon) as 1:1 leaves. This is the source's own re-tabulation, not an invented concordance or a sum computed here. Yamoussoukro needs no collapse: its four census leaves each have a distinct ADM3 feature (ATTIEGOUAKRO → Attiégouakro, LOLOBO → Lolobo, YAMOUSSOUKRO → Yamoussoukro, KOSSOU → Kossou), and its printed "Total ATTIEGOUAKRO"/"Total YAMOUSSOUKRO" rows are ordinary department totals, not used for the join. Collapsing the 10 Abidjan communes to the one printed city aggregate turns the 519 leaves into 510 census join units, matching the 510 ADM3 feature count.

### Blocker 4c — 1:1 join residue (STOP, ruling 4c). After the mojibake repair, the `stringi` transliteration, the Abidjan aggregate collapse, and ADM2-region attachment, the 510 census join units do not join one-to-one to the 510 ADM3 features. A residue of 22 census units and 21 ADM3 features remains, plus one duplicate-name collision. It falls into four classes, none closable by a permitted operation (no invented concordance, no self-summing, no name-pattern lists). The machine residue is in `research/countries/ci/join-residue.csv`.

- **Spelling and transcription variants (18 census leaves ↔ 18 ADM3 features).** The two sources spell the same place differently beyond accents: APPIMANDOUM ↔ Appimadoum; ASSINIE ↔ Assinie-Mafia; BEDY-GOAZON ↔ Bédi-Gaozon; DIBRI-ASRIKRO ↔ Dibri-Assirikro; DJANGOKRO ↔ Diangokro; GALEBRE ↔ Galébouo; GNAMANGUI ↔ Gnanmangui; GRAND-ZATTRY ↔ Grand-Zatry; KETTRO-BASSAM ↔ Kétro-Bassam; KOKUMBO ↔ Kokoumbo; KOTOUBA ↔ Koutouba; MARABADJASSA ↔ Marabadiassa; MARHANDALLAH ↔ Marandallah; NIAKARAMADOUGOU ↔ Niakaramandougou; NIEDEKAHA ↔ Niédiékaha; TIEDIO ↔ Tchèdio; TIENDENE-BAMBARASSO ↔ Tendéné-Bambarasso; TIENY-SIABLY ↔ Tiény-Séably. Each candidate pairing is plausible but unverified; accepting it is a concordance, which the ruling forbids.
- **Duplicate-name and name-form cases (2 census leaves).** The census disambiguates its two Guézon leaves as "GUEZON (DE FACOBLY)" and "GUEZON-DUEKOUE"; the ADM3 frame carries two identical "Guézon" features; the normalised name therefore collides and GUEZON-DUEKOUE is left unmatched. GAGORE (Lôh-Djiboua) has no same-name ADM3 feature; the region's unused feature is Kadéko, a genuinely different name whose identity is unverified.
- **Structural two-leaf-to-one-feature merge (2 census leaves → 1 ADM3 feature).** In Worodougou the census prints BOBI and DIARABANA as separate leaves; the ADM3 frame carries a single "Bobi-Diarabana" feature. Unlike Abidjan, the census prints no combined aggregate row for this pair (it is an ordinary department child pair, not an autonomous district); there is therefore no source-printed value to join, and self-summing is forbidden.
- **ADM3 feature with no census reporting unit (1 orphan feature).** The ADM3 frame includes "Parc National de Bona" (Bounkani), a national park, which is not a census sub-prefecture or commune and has no Table 11 row. This alone breaks the 1:1 premise: the ADM3 layer is not a clean partition of the census reporting units.

The last two classes are structural and hold even if every spelling variant were hand-mapped; the join therefore cannot reach 1:1 under the performed-verifications-only and no-invented-concordance rules. Per ruling 4c the builder stops and reports the residue. Closing it needs a PI-level decision: either a source-verified 519→510 (or 510→510) concordance for the spelling variants and the Bobi-Diarabana merge, or a different boundary layer whose features partition the census reporting units exactly (excluding the national-park polygon).

### State. The builder is corrected and ready upstream of the join: the mojibake repair, the `stringi` normaliser, the 519-leaf and national-basis (29 276 658) gates, the multi-level pinned discrepancy set, and the Abidjan aggregate join are all encoded and exercised. It halts in `build_boundary` with the residue above; no `area_summary`, CSV, GeoJSON, or manifest product is written, and none of `apps/regions/ci/data/` or `docs/manifests/` is touched. The Abidjan sub-prefecture ADM3 features are Anyama, Bingerville, Brofodoumé, and Songon, and the single autonomous-city feature is "Abidjan".

## Join-closure lane (2026-07-11)

The conductor ruled on each of the four residue classes under established precedent, and the closure is implemented in `build_boundary` as performed, pinned verifications; the builder stops on any drift. The build now runs to completion and writes the four staged products. This section records the rulings and the per-pair evidence.

One correction to the earlier residue account. The committed `join-residue.csv` lists 22 unmatched census units and 21 unused ADM3 features, but that machine listing under-reported the residue: the earlier naive `match()` silently assigned each duplicate-named ADM3 feature to its first occurrence, hiding five duplicate-name collisions (Guézon, Lolobo, N'Guessankro, Nafana, Santa). Four of the five resolve by ADM2-region agreement between the census unit and the same-named feature (Lolobo, N'Guessankro, Nafana, Santa each split across two regions); Guézon needs spatial evidence because both features sit in one region. After the duplicate-name region disambiguation, the residue is exactly the 18 spelling variants, the two Guézon leaves, GAGORE, and the BOBI/DIARABANA pair on the census side, against the 18 variant features, Kadéko, Bobi-Diarabana, and Parc National de Bona on the ADM3 side.

### Class A — spelling variants (18 pairs; Bangladesh nine-name precedent). Each unmatched census leaf is matched to the unused ADM3 feature in the SAME ADM2 region at minimum Levenshtein distance; the matching is injective and exhausts both pools, and every pair is an orthographic variant (edit distance ≤ 4, or one name is a prefix of the other) with no competing candidate. Evidence table (census leaf, ADM3 feature, ADM2 region, edit distance, margin to the next candidate in region):

| Census leaf | ADM3 feature | ADM2 region | Edit distance | Next-candidate margin |
| --- | --- | --- | ---: | ---: |
| GNAMANGUI | Gnanmangui | Nawa | 1 | 8 |
| GRAND-ZATTRY | Grand-Zatry | Nawa | 1 | 7 |
| ASSINIE | Assinie-Mafia | Sud-Comoé | 6 | sole candidate (ASSINIE is a prefix of ASSINIE MAFIA) |
| GALEBRE | Galébouo | Gôh | 3 | sole candidate |
| KOKUMBO | Kokoumbo | Bélier | 1 | sole candidate |
| DJANGOKRO | Diangokro | N'Zi | 1 | sole candidate |
| BEDY-GOAZON | Bédi-Gaozon | Cavally | 3 | sole candidate |
| TIENY-SIABLY | Tiény-Séably | Guémon | 1 | sole candidate |
| KETTRO-BASSAM | Kétro-Bassam | Haut-Sassandra | 1 | sole candidate |
| MARABADJASSA | Marabadiassa | Gbêkê | 1 | 12 |
| DIBRI-ASRIKRO | Dibri-Assirikro | Gbêkê | 2 | 9 |
| TIENDENE-BAMBARASSO | Tendéné-Bambarasso | Hambol | 1 | 12 |
| NIAKARAMADOUGOU | Niakaramandougou | Hambol | 1 | 11 |
| NIEDEKAHA | Niédiékaha | Hambol | 1 | 11 |
| MARHANDALLAH | Marandallah | Béré | 1 | sole candidate |
| APPIMANDOUM | Appimadoum | Gontougo | 1 | 9 |
| TIEDIO | Tchèdio | Gontougo | 2 | 6 |
| KOTOUBA | Koutouba | Bounkani | 1 | sole candidate |

### Class B — duplicate-name Guézon and the GAGORE↔Kadéko exhaustion identity. The census disambiguates its two Guézon leaves as GUEZON (DE FACOBLY) and GUEZON-DUEKOUE; the ADM3 frame carries two identical "Guézon" features, both in Guémon; region agreement therefore cannot separate them. Spatial evidence assigns each leaf to the Guézon polygon adjacent (`st_touches`) to its department town: the Facobly-adjacent polygon takes GUEZON (DE FACOBLY), the Duékoué-adjacent polygon takes GUEZON-DUEKOUE. Each Guézon polygon touches exactly one of the two anchors (Facobly 10.1 km, Duékoué 32.2 km by centroid); the assignment is therefore unambiguous. GAGORE↔Kadéko is a genuinely different name, not a spelling variant; it is closed not by edit distance but by ADM2 containment plus exhaustion: after every other unit in Lôh-Djiboua matches, GAGORE is the sole unmatched census leaf and Kadéko the sole unused ADM3 feature in that region, and the census's own department roster confirms the identity.

### Class C — BOBI + DIARABANA → Bobi-Diarabana (disclosed roll-up; Korea 1995 exact-partition and Saint Lucia Castries-summation precedents). The two complete disjoint census leaves in Worodougou are summed into the one ADM3 feature. This is aggregation of complete units to a coarser frame, not allocation or splitting. The feature's row carries the roll-up disclosure in its `quality_flag`, and each leaf's printed total (BOBI 7,138 resident / 7,137 basis; DIARABANA 25,063 / 25,065) is preserved in the record; the merged feature's outside-basis count is −1, disclosed like any other source-arithmetic row.

### Class D — Parc National de Bona (no-data feature). The ADM3 national-park polygon (Bounkani) is no census reporting unit and has no Table 11 row. It ships with null population and metrics; the popup has-data guard covers it at runtime. Its area-summary row carries only the boundary source dataset and a `no_data` quality flag.

### Accounting gate. Every one of the 519 census leaves is represented exactly once: 507 one-to-one, two rolled up into Bobi-Diarabana, and ten Abidjan communes carried by the printed Total-Ville ABIDJAN aggregate. The shipped 510 ADM3 features are 509 census-backed plus the one no-data feature. The closure conserves census value: the shipped religion basis is 29,276,522, which equals the 519 leaves' basis (29,276,520) minus the ten Abidjan commune bases plus the printed city aggregate. That total sits 136 below Table 11's national religion basis of 29,276,658 — by exactly the source's own pinned, image-verified residual (the 519 leaves sum 138 below the national basis, and the printed Abidjan city aggregate exceeds its ten communes by 2). Note for the conductor: the accounting gate as worded ("must equal the national basis exact") cannot hold at the religion-basis level, because the pinned discrepancy set already records the leaves as 138 below national; forcing equality would require altering printed values, which stop-don't-tune forbids. The gate is therefore implemented as exact value-conservation-through-closure with the −136 residual disclosed and decomposed, and every printed value ships unchanged.

### State. The builder runs to completion and writes the four staged products: `apps/regions/ci/data/area_summary_local.json` (510 rows), `apps/regions/ci/data/area_summary_local.csv`, `apps/regions/ci/data/ci_local_2021.geojson` (510 features, simplified to 1.14 MB, well within the 3 MB cap), and `docs/manifests/ci-census-religion-2021.json`. Both the area-summary and the manifest pass schema validation; source and simplified geometry pass the validity, distinct-hash, overlap, interior-gap, and sliver gates. The outputs are uncommitted and staged.

## Panel note (draft, for the map UI)

Draft public-facing note for the Côte d'Ivoire 2021 panel, carried here for the map-wiring lane:

> **Côte d'Ivoire — religious affiliation, 2021 census.** Shares come from the Institut National de la Statistique / Agence Nationale de la Statistique RGPH 2021 (Base Table 11), by sub-prefecture or commune. The denominator is each area's ordinary-household population, taken as the exact sum of the 16 published religion categories; "does not know" and "not declared" responses stay in the denominator and outside both headline shares. Collective-household residents and people without housing were not asked the religion question and sit outside this basis. In 31 areas the published category counts exceed the published resident total by one or two people — the source's own printed arithmetic, verified against the page images and shown unchanged. Two Worodougou sub-prefectures (Bobi and Diarabana) are reported together in one boundary unit; the Bona National Park polygon carries no census data and is drawn without a value. Boundaries: geoBoundaries CIV ADM3 (sources CNTIG and OCHA ROWCA), CC BY 3.0 IGO. Census figures are reproduced as derived summaries with INS/ANStat attribution under project approval; the source publication reserves all rights ("Tous droits Reservés"). 2021 only — no change over time is shown, because the earlier censuses do not publish a comparable local table.
