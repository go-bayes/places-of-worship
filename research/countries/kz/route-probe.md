# Kazakhstan census-religion route probe

Verified 2026-07-12. Kazakhstan asked religion in both the 2009 and the 2021 national censuses, and the Bureau of National Statistics (BNS, formerly the Agency of Statistics) openly publishes a **count-valued religion-by-region table for each wave** through stat.gov.kz. Both tables carry the identical seven-category top-level frame — Islam, Christianity, Judaism, Buddhism, Other, Non-believers, Refused-to-indicate — count every resident of every age, and close exactly at both margins (every region column sums to its printed total and every religion column sums to its printed national total). The build is clean and ships two waves.

The two waves ride **different region vintages**, and the difference is a genuine frame break, not the one the brief anticipated. The 2009 census used the 16-unit frame (14 oblasts including South Kazakhstan Region, plus Astana and Almaty cities). The 2021 census used the 17-unit frame, because in June 2018 South Kazakhstan Region was renamed Turkistan Region and the city of Shymkent was carved out as a third city of republican significance. The 2022 reorganisation the brief flagged (Abai, Jetisu, Ulytau created; 14 → 17 oblasts, effective 8 June 2022) happened **after** the October 2021 census, so it does not touch either census frame — it only affects the current boundary vintage. The record therefore refutes the brief's implied 2022 break at the census level: the operative break between the two census frames is the 2018 South Kazakhstan → Turkistan + Shymkent split. Each wave rides its own vintage boundary (per-vintage support, Estonia precedent); no concordance is invented, and no cross-wave change is claimed across the frame break (CHANGE-WITHHOLD).

## Build decision (recommendation to the conductor)

- **Recommendation: BUILD** a two-wave region-level religious-affiliation product (2009 on 16 regions, 2021 on 17 regions), shipping under BUILD-THEN-ASK. Both waves are open, count-valued, close exactly at both margins, and carry a licensed boundary. This is a strong subnational product — count-valued, 16–17 regions, a sharp published religious gradient.
- **Licence: ACCEPTED, no ask needed.** The BNS "About using the data" page grants free reuse for any purpose (including in full) with a reference to the source — an open licence with attribution, quoted verbatim below and captured in both English and Russian. This is the cleanest licence posture in the recent tranche; the census data need no PI ruling.
- **Map-worthy pattern.** The religious gradient is legible directly in the counts. In 2021 Turkistan is 92.4% Islam (1,897,485 of 2,054,021) and Kyzylorda 96.2% (784,051 of 814,931), while North Kazakhstan is only 38.7% Islam against 55.2% Christianity (298,288 of 540,786) and Kostanay is 44.0% Christianity. The 2009 wave shows the same north–south contrast on its own frame (South Kazakhstan 93.4% Islam; North Kazakhstan 58.9% Christianity). The Refused-to-indicate share jumps sharply between waves (0.5% in 2009 to 11.0% in 2021) — a within-wave signal to display, never a cross-wave affiliation change.

## Published waves and geography

| Year | Official route | Religion-by-region table | Universe | Units | Decision |
| --- | --- | --- | --- | --- | --- |
| 2009 | [Итоги Национальной переписи населения РК 2009 года — Краткие итоги](https://stat.gov.kz/ru/national/2009/) (file `3-Перепись_краткие итоги.rar`) | **Section 7.1** "Население по вероисповеданию по полу" (region × religion × sex; the "Все население / Оба пола" block is used) | all persons, all ages | 16 (14 oblasts incl. South Kazakhstan + Astana + Almaty) | Ship the 16-region 2009 wave. |
| 2021 | [Итоги Национальной переписи населения РК 2021 года — Краткие итоги](https://stat.gov.kz/en/national/2021/) (BNS `getFile` docId ESTAT464825; live id now stale, durable via Wayback 2022-09-02) | **Section 7.1** "Население по вероисповеданию в разрезе регионов" (region × religion × sex; the "Все население / Оба пола" block is used) | all persons, all ages | 17 (14 oblasts incl. Turkistan + Astana + Almaty + Shymkent) | Ship the 17-region 2021 wave. |

Two source facts govern the routing. The first source fact is that the region × religion cross-tab lives only in each census's **"Краткие итоги" (brief results)** product, not in the big thematic collection: the 2021 English collection "National composition, religion and language proficiency" and the 2009 analytical report both cross-tab religion by nationality, age, and education, but neither prints religion by region. The second source fact is that the 2021 brief-results file was published through the BNS `getFile` API under docId ESTAT464825, whose live id is now stale (404); the authentic file survives at the Internet Archive capture of 2022-09-02 (`web.archive.org/web/20220902140633/https://stat.gov.kz/api/getFile/?docId=ESTAT464825`), which is the durable retrieval used here. The 2009 brief-results RAR downloads live from the current stat.gov.kz 2009 census page.

## Category frames (verbatim, per wave)

Both waves share the identical seven top-level categories. The 2021 table additionally prints a Christianity sub-breakdown (Orthodox / Catholic / Protestant) inside the Christianity total; those sub-columns are preserved verbatim in the per-region breakdown flag and are never treated as separate top-level categories.

| Top-level category | 2009 (RU, source order) | 2021 (RU/KK, source order) | Product role |
| --- | --- | --- | --- |
| Islam | ислам | ислам | religious affiliation |
| Christianity | христианство | христиан (православие / католицизм / протестантизм) | religious affiliation |
| Judaism | иудаизм | иудаизм | religious affiliation |
| Buddhism | буддизм | буддизм | religious affiliation |
| Other | другое | басқа / другое | residual affiliation |
| Non-believers | неверующие | дінге сенбейтіндер / неверующие | no-religion |
| Refused to indicate | отказались указать | көрсетуден бас тартты / отказались указать | non-response residual |

**Column-order trap (recorded).** The two waves print the last two residual columns in the opposite order. In 2009 the order is `другое, неверующие, отказались указать` (Other, Non-believers, Refused). In 2021 the order is `басқа, көрсетуден бас тартты, дінге сенбейтіндер` (Other, Refused, Non-believers). Each wave is transcribed in its own printed order; the build labels columns by wave, never by position across waves.

## Universe and denominator

Every wave counts all persons of all ages (the religion question was asked of the whole resident population), so there is no universe break and the region denominators are internally comparable within each wave. Each wave's religion table total equals the full census population: 2009 total 16,009,597; 2021 total 19,186,015. The population grows across the pair (+19.8%); shares are read within each region's own wave denominator and growth is never treated as a religion change. Because the region frame changes between waves (16 vs 17 units), no cross-wave change is claimed at region level.

## Slot design (ordinary two-slot, SB/FM precedent)

Kazakhstan has a real Non-believers category, so the product uses the ordinary two-slot design, not the minority-share design (no task-6 gate).

- `religious_affiliation_percent` = summed share of every religious-affiliation category (Islam + Christianity + Judaism + Buddhism + Other) / population. `religious_affiliation_count` = population − Non-believers − Refused.
- `no_religion_percent` = the single Non-believers line (неверующие) / population.
- Refused-to-indicate stays in the denominator and in neither slot, so the two shares need not sum to 100 (the SB Refuse-to-Answer precedent). This matters here because Refused is large in 2021 (11.0%).

## Reconciliation gates (verified in the probe)

- **2009 (Section 7.1, Все население / Оба пола)**: the 16 region totals sum to the printed national 16,009,597, and every religion column sums to its printed national total (e.g. Islam: the 16 regions sum to 11,237,947; the national row sums across the seven top-level categories to 16,009,597). Both margins close exactly.
- **2021 (Section 7.1, Все население / Оба пола)**: the 17 region totals sum to the printed national 19,186,015, and every religion column sums to its printed national total (e.g. Islam: the 17 regions sum to 13,297,775; the national row sums across the seven top-level categories to 19,186,015; the Orthodox+Catholic+Protestant sub-columns sum to the Christianity total 3,297,550). Both margins close exactly.
- The build stops on any margin mismatch; no value is allocated, inferred, rounded, or tuned. No cell suppression was observed in either table (values are printed integers).

## Boundary sources and licences (per vintage)

The two waves use two boundary providers, each licensed, each documented — the per-vintage pattern. Neither is a rejected null-licence layer.

- **2009 → geoBoundaries KAZ ADM1 (gbOpen), 16 units, boundaryYearRepresented 2017.** Licence recorded verbatim in the release metadata: `"boundaryLicense": "Open Data Commons Open Database License 1.0"`, `"licenseSource": "www.openstreetmap.org/copyright"`, `"boundarySource": "OpenStreetMap, Wambacher"`, `"admUnitCount": "16"`, pinned at commit `9469f09`. The 16 shapeNames carry "South Kazakhstan Region" (no Turkistan, no Shymkent city) and join the 2009 census one-to-one (Russian oblast names to English shapeNames; identity mapping on the stems). ODbL is accepted (Kiribati/Marshall Islands ODbL precedent); the derived boundary carries the ODbL share-alike and attribution notice.
- **2021 → OCHA COD-AB KAZ ADM1 (UNHCR from OpenStreetMap, 2023 vintage), 20 units, dissolved to the 17-unit 2021 frame.** Licence recorded verbatim from the HDX dataset: `license_id: cc-by-igo`, `license_title: "Creative Commons Attribution for Intergovernmental Organisations (CC BY-IGO)"`, `dataset_source: "UNHCR from Open Street Map"` (Pakistan COD-AB precedent). The 2023 COD carries the post-2022 20-unit frame (17 regions + Astana + Almaty + Shymkent; no separate Baikonur ADM1). The three 2022-created regions are dissolved back into their single pre-2022 parents — **Abay → East Kazakhstan Region, Jetisu → Almaty Region, Ulytau → Karaganda Region** — a documented reverse-reorganisation fold by exact complete-unit partition (Montenegro 2023 precedent). The union of each child polygon with its parent equals the pre-2022 parent by construction (the reorg moved whole districts), so the fold is geometric, not an invented concordance. The result is exactly the 17-unit 2021 census frame. Astana is labelled "Нұр-Сұлтан қаласы" in the 2021 census (renamed Nur-Sultan 2019, back to Astana 2022) and "Astana" in the 2023 COD; same city, name recorded.

The current OCHA COD-AB (post-2022) is the wrong vintage for a **direct** join to either census (it has 20 units), and the geoBoundaries gbOpen ADM1 (16 units, 2017) is the wrong vintage for the 2021 census. Matching each wave to its own vintage — geoBoundaries for 2009, COD-AB-dissolved for 2021 — is the clean route; inventing a 16↔17 concordance is forbidden and unnecessary.

## Licence position (accepted)

The census data ship under the BNS open-reuse grant. The BNS "About using the data" page (`stat.gov.kz/en/description/`, retrieved 2026-07-12) states verbatim:

> "Users may use official statistical information for any purposes (including reusing it in full) freely, free of charge, perpetually, and without territorial restrictions, including copying, publishing, distributing with a reference to the source, modifying, combining it with other information, as well as using it for the creation of software products and applications."

The Russian original (`stat.gov.kz/ru/description/`, retrieved 2026-07-12) states verbatim:

> "…использовать официальную статистическую информацию для любых целей (в том числе использовать повторно в полном объеме) свободно, бесплатно, бессрочно и без ограничения территории использования, в том числе копировать, публиковать, распространять со ссылкой на источник, видоизменять и объединять с другой информацией, а так же использовать с целью создания программных продуктов и приложений."

Both pages are captured under `data/raw/kz_census/` with SHA-256 in the retrieval record. This is an open licence conditioned only on source attribution: `licence_status: accepted`. The required attribution is the Bureau of National Statistics of the Agency for Strategic Planning and Reforms of the Republic of Kazakhstan. No courtesy ask is needed.

## Premise corrections (trust the record)

- **The 2022 reorganisation is not a census-level break.** The brief warned that the 2022 creation of Abai, Jetisu, and Ulytau (14 → 17 oblasts) differentiates the 2009 and 2021 frames. It does not: the 2021 census predates the June 2022 reorg. The actual census-frame break is the June 2018 South Kazakhstan → Turkistan Region + Shymkent city split (16 → 17 units). The reorg only shapes the current boundary vintage (the 2023 COD-AB), which is why the COD is dissolved back to the 2021 frame.
- **The region × religion table is not in the thematic collection.** The queue pointer ("Census releases and tables") and the README implied the big collection carries it. It does not — the region cross-tab lives only in each wave's "Краткие итоги" brief-results file. The README's "2009 linkage and download verification remain" is now resolved: the 2009 file is pinned and reconciles.
- **The licence is open, not "confirm reuse terms before republication".** The README recorded the licence as needing confirmation. The BNS "About using the data" page grants free reuse with attribution; the licence gate is cleared.
- **geoBoundaries ADM1 is not null-licence for KAZ.** Unlike Armenia, the KAZ gbOpen ADM1 release records ODbL (not null), so it is usable for 2009 (with the ODbL share-alike/attribution recorded).

## Retrieval record

Every cached input is under `data/raw/kz_census/`, which `git check-ignore` confirms is excluded by `.gitignore:120` (the `data/` rule). Retrieval occurred on 2026-07-12.

| Cached input | Source URL | Role | SHA-256 |
| --- | --- | --- | --- |
| `kz_2009_brief_results.rar` (→ `Перепись_краткие итоги.pdf`) | <https://stat.gov.kz/upload/medialibrary/e07/edrb65uwved0wmlee6fe701slvowygso/3-Перепись_краткие%20итоги.rar> | 2009 region × religion (Section 7.1) | `f01eef5f14364cdfd2267b0dda22320c31fa8057492a3d2df3e95def700f2f46` |
| `kz_2021_census_results_ESTAT464825.pdf` | <https://web.archive.org/web/20220902140633/https://stat.gov.kz/api/getFile/?docId=ESTAT464825> (orig `stat.gov.kz/api/getFile/?docId=ESTAT464825`) | 2021 region × religion (Section 7.1) | `fe5d405a495b79b718bc861e182816e154857c5bda878c999eaa685fd76dde13` |
| `geoBoundaries-KAZ-ADM1.geojson` | <https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/KAZ/ADM1/geoBoundaries-KAZ-ADM1.geojson> | 2009 boundary (16 units, ODbL) | `576783ee4b3739196ca0a52453704ec8d15c75385b24b594d0d9e03454f89221` |
| `gb_kaz_adm1_meta.json` | <https://www.geoboundaries.org/api/current/gbOpen/KAZ/ADM1/> | 2009 boundary licence metadata | `2b22054841ae849137f6ba51becd1a4ecd7e33dd360419cdd56ecfc7e0572ca6` |
| `kaz_adm_unhcr_2023_shp.zip` (→ `kaz_admbnda_adm1_unhcr_2023.shp`) | <https://data.humdata.org/dataset/afb05759-c3da-44f4-93a1-6bd2d8bcd431/resource/86cce6ba-4b79-4b4e-8961-3e6e04308395/download/kaz_adm_unhcr_2023_shp.zip> | 2021 boundary (COD-AB, CC BY-IGO) | `a66c1faeb318fd545c30e837dc5e6ab8697bf8791320323436e44fcae7351fca` |
| `hdx_kaz.json` | <https://data.humdata.org/api/3/action/package_show?id=cod-ab-kaz> | 2021 boundary licence metadata | `022300690676ae0f80109b0d13da78735c26c07944dd11ace24f46eb02bdce77` |
| `kz_stat_terms_en.html` | <https://stat.gov.kz/en/description/> | licence evidence (EN, verbatim) | `58fd0633d1fa39e029fd76705e4be5c1c8d102d452bc0297e82caeebdb5303f4` |
| `kz_stat_terms_ru.html` | <https://stat.gov.kz/ru/description/> | licence evidence (RU, verbatim) | `0aedc99a4966f95e169eaefd51a7df726c4ef978499cb716240c20c72b302f2c` |

Context files (not product sources, retained for provenance): `kz_2009_analytical_report.pdf` (religion by nationality/age, Section 4.4) `560f559b…`; `kz_2021_national_composition_religion_language.pdf` (religion by nationality/age/education, national) `7526d0ec…`. Derived working extractions: `kz_2009_brief.txt`, `kz_2021_results.txt` (pdftotext `-layout`).

## Blockers

None material. The build ships two waves, both waves reconcile exactly at both margins, both boundaries are licensed, and the census licence is an open reuse grant with attribution. Recorded caps: the region × religion cross-tab is published only for 2009 and 2021 (the two waves that asked religion), so the "2009-2024" span in the queue row is really a 2009 + 2021 two-wave product; the 2018 frame break bars cross-wave region change (documented, no change layer); the 2021 brief-results source is durable only via the Internet Archive capture (the live BNS docId is stale).

## Product boundary

A build on this probe stages region-level religious-affiliation summaries for 2009 (16 regions, geoBoundaries ADM1 ODbL) and 2021 (17 regions, OCHA COD-AB CC BY-IGO dissolved), each on its own vintage boundary, with the verbatim per-wave seven-category frame, fail-fast reconciliation at both margins (both waves close exactly), and the ordinary two-slot design (Refused-to-indicate as a disclosed denominator residual). It carries no place-of-worship layer, no cross-wave region change layer (the 2018 frame break), and no pre-2009 wave (religion was first asked in 2009). The census licence is an accepted open reuse grant; the product ships with attribution to the Bureau of National Statistics.
