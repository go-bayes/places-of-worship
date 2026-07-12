# North Macedonia census-religion route probe

Verified 2026-07-12. North Macedonia asked religion in the 2021 census, and the State Statistical Office (SSO, `stat.gov.mk`) publishes a **count-valued religion-by-municipality table** for the 2021 wave across the 80-municipality frame. The build ships one clean wave: 2021 on 80 municipalities, thirteen verbatim religion categories, both margins closing exactly to the total resident population 1,836,713. The 2002 wave is **HELD**: the 2002 census religion table is published only on the pre-2004 (1996) 123-municipality frame, for which no licensed boundary exists, and the 2004 re-tabulation excludes religion. The brief's premises are corrected below.

## Build decision (recommendation to the conductor)

- **Recommendation: BUILD the 2021 municipality wave; HOLD 2002.** The 2021 product clears the subnational bar comfortably — 80 municipalities, count-valued, thirteen verbatim categories, exact-margin reconciliation, a licensed boundary that matches the census frame one-to-one. It ships under BUILD-THEN-ASK with attribution.
- **Licence: accepted under BUILD-THEN-ASK, staged pending an SSO courtesy ask.** The SSO asserts copyright ("© State Statistical Office") with no stated open-data licence; every census book carries the instruction "When using data contained here, please cite the source". This is the RO/SK/CI/MONSTAT/DCS derived-summaries-with-attribution posture, so the product ships with attribution and stages pending an SSO reuse-confirmation email — the clean courtesy unblock, recorded for the PI (do not send).
- **Map-worthy pattern.** The religious geography is legible directly in the counts. The Skopje Muslim-majority municipalities (Saraj 93.6% Muslim, Arachinovo, Lipkovo, Zhelino) contrast sharply with the Orthodox east and southeast (Berovo 95.3% affiliation Orthodox-dominated; Vevchani, Demir Hisar). Urban central Skopje (Centar) carries the highest non-believer share (4.5%), an order of magnitude above the national 0.48%. The administratively-sourced residual (7.20% nationally) concentrates in Skopje and is disclosed, never repaired.

## Published waves and geography

| Year | Official route | Religion-by-municipality table | Universe | Units | Decision |
| --- | --- | --- | --- | --- | --- |
| 2021 | [SSO 2021 Census book, EN edition](https://www.stat.gov.mk/publikacii/2022/POPIS_DZS_web_EN.pdf) | Table **T-06** "Total resident population by religious affiliation and sex, by municipalities" (thirteen categories) | total resident population (1,836,713) | 80 municipalities (+ City of Skopje aggregate) | **Ship** the 80-municipality 2021 wave. |
| 2002 | [SSO 2002 Census Book X](https://www.stat.gov.mk/Publikacii/knigaX.pdf) | "Total population according to ethnic affiliation, mother tongue and RELIGION, final data by settlements", Table 4 (five categories) | total population (2,022,547) | pre-2004 (1996) 123-municipality frame | **HELD** — no licensed 123-municipality boundary; the 2004 re-tabulation excludes religion. |

Two source facts govern the routing. The first source fact is that the 2021 religion-by-municipality cross-tab is the census book's table T-06, printed across seven column groups of two categories each (group one carries Population + Orthodox); the machine-readable MakStat PxWeb path exists but its folder-navigation API returns HTTP 400 to automated access (only the database root and `?config` respond), and its JS tree is invisible to non-browser fetch, so the durable published book is the transcription source. The second source fact is that the SSO's "first dataset" Excel (`2.1.22.10-mk-en.xlsx`) uses a table-numbering that does **not** match the book: its sheet "T-06en" is ethnic affiliation, not religion, and it carries no religion-by-municipality sheet — only the census book (and PxWeb) publish religion at municipality level.

## Category frames (verbatim, per wave)

The 2021 frame is thirteen categories; the 2002 frame is five. The frames are not comparable across the 2004 reorganisation and no cross-wave change is claimed.

**2021 (Table T-06; English edition parsed, Macedonian names from the Macedonian edition):**

| # | English (verbatim) | Macedonian (verbatim) | National total | Product role |
| ---: | --- | --- | ---: | --- |
| 1 | Orthodox | Православни | 847,390 | affiliation |
| 2 | Muslim (Islam) | Муслимани (ислам) | 590,878 | affiliation |
| 3 | Catholic | Католици | 6,746 | affiliation |
| 4 | Christian | Христијани | 242,579 | affiliation |
| 5 | Protestant | Протестанти | 1,313 | affiliation |
| 6 | Evangelical | Евангелисти | 678 | affiliation |
| 7 | Evangelical Methodist | Евангелисти-методисти | 889 | affiliation |
| 8 | Jehovah's Witnesses | Јеховини сведоци | 1,137 | affiliation |
| 9 | Other | Друго | 1,221 | residual affiliation |
| 10 | Non-believer (atheist) | Не е верник (атеист) | 8,764 | no-religion |
| 11 | Undeclared | Не се изјаснил | 1,964 | non-response residual |
| 12 | Unknown | Непознато | 894 | non-response residual |
| 13 | Persons for whom data are taken from administrative sources | Лица за кои податоците се преземени од административни извори | 132,260 | universe residual (no data) |

The thirteen national totals sum exactly to the total resident population 1,836,713. The English edition prints a footnote — "data on religious affiliation refer to occurrences over 500 at the country level" — which is a **category-selection** note (small bodies fold into Other), not cell suppression; no municipality cell is suppressed.

**2002 (Book X, Table 4; five categories, from the pre-2004 census PDF):** pravoslavni/Православни (Orthodox) 1,310,184; muslimani (islam)/Муслимани (Ислам) 674,015; katolici/Католици (Catholic) 7,008; protestanti/Протестанти (Protestant) 520; ostanati/Останати (Other) 30,820; total 2,022,547. The 2002 frame has no atheist, undeclared, or administrative-sources line — everyone is assigned to one of five religion categories.

## Universe and denominator

The 2021 universe is the **total resident population** (1,836,713), which is the total enumerated population (2,097,319) minus the non-resident population (260,606). Within the resident population, **132,260 persons (7.20%)** have their data — including religion — taken from administrative sources under the 2021 combined-census methodology; those persons form the distinct published category "Persons for whom data are taken from administrative sources". The build renders this component as published: it stays in each municipality's denominator as its own category and is never enumerated into a religion, never repaired, and never redistributed. The denominator is each municipality's printed total resident population; shares are read within each municipality's own denominator.

## Slot design (ordinary two-slot, SB/FM/KZ precedent)

North Macedonia has a real Non-believer (atheist) category, so the product uses the ordinary two-slot design, not the minority-share design (no task-6 gate).

- `religious_affiliation_percent` = summed share of the nine affiliation categories (Orthodox + Muslim (Islam) + Catholic + Christian + Protestant + Evangelical + Evangelical Methodist + Jehovah's Witnesses + Other) / total resident population. `religious_affiliation_count` = that sum.
- `no_religion_percent` = the single Non-believer (atheist) line / total resident population.
- Undeclared, Unknown, and Taken-from-administrative-sources stay in the denominator and in neither slot, so the two shares need not sum to 100 (the administratively-sourced residual is 7.20% nationally).

## Reconciliation gates (verified in the probe; re-checked fail-fast in the build)

- **Municipality rows**: each of the 80 municipalities' thirteen categories sum to its printed total resident population. All 80 close exactly.
- **Religion columns**: each of the thirteen categories sums across the 80 municipalities to its printed national total (Orthodox 847,390; Muslim 590,878; …; administrative-sources 132,260). All thirteen close exactly.
- **Grand total**: the 80 municipality populations sum to 1,836,713; the thirteen national categories sum to 1,836,713.
- **Skopje partition**: the "City of Skopje" aggregate row equals the sum of its ten constituent municipalities (Aerodrom, Butel, Gazi Baba, Gjorche Petrov, Karposh, Kisela Voda, Saraj, Centar, Chair, Shuto Orizari) in every category. The ten Skopje municipalities are the mappable units; the City of Skopje aggregate is excluded from the 80-unit product and used only as a partition check.
- The build parses table T-06 directly from the cached PDF (`pdftotext -layout`), locating the seven column groups by content markers (never fixed line numbers) and asserting each group's category headers; it stops on any margin mismatch and never allocates, infers, rounds, imputes, or tunes a value. A "-" reads as nil.

## Boundary source and licence

The 2021 boundary is **[OCHA COD-AB North Macedonia ADM2 (2025)](https://data.humdata.org/dataset/cod-ab-mkd)**, 80 municipalities, matching the 2021 census frame one-to-one. Licence recorded verbatim from the HDX metadata: `license_id: cc-by-igo`, `license_title: "Creative Commons Attribution for Intergovernmental Organisations (CC BY-IGO)"`, source "EuroGeographics and NTES (Nomenclature of Territorial Units for Statistics - Republic of Macedonia State Statistical Office)". The 80 COD `ADM2_EN` names join the 80 census municipalities through a **15-entry Cyrillic-to-Latin transliteration crosswalk** (the census renders Cyrillic ц as "c"/"ce"/"ci"; the COD renders it "ts"/"tse"/"tsi": Bogdanci→Bogdantsi, Brvenica→Brvenitsa, Debarca→Debartsa, Jegunovce→Jegunovtse, Karbinci→Karbintsi, Kavadarci→Kavadartsi, Makedonska Kamenica→Makedonska Kamenitsa, Novaci→Novatsi, Petrovec→Petrovets, Plasnica→Plasnitsa, Rankovce→Rankovtse, Strumica→Strumitsa, Tearce→Teartse, Vinica→Vinitsa, Zrnovci→Zrnovtsi). Every mapping is one-to-one; no geometry is merged or split. The other 65 names match exactly. The extent (lon ~20.4 to 23.1 E, lat ~40.8 to 42.4 N) is far from the antimeridian; no dateline handling is needed.

**geoBoundaries MKD ADM2** is the wrong vintage for a direct join: its release records **84 units** (`boundaryLicense` "Creative Commons Attribution 4.0 International (CC BY 4.0)", `boundaryYearRepresented` 2016, source EuroGeographics), which is the 2004 territorial organisation before the 2013 merger to 80. It is rejected for 2021 in favour of the frame-matching COD-AB 80; it is recorded here as the 2004-frame layer (relevant to any future 2002/2004 work).

## Licence position

No open-data licence is stated on any SSO census product. The rights posture, fetched and quoted verbatim:

- **SSO website copyright** (`stat.gov.mk/KopjrajtStatistika_en.aspx` and the Macedonian page, retrieved 2026-07-12): "© Државен завод за статистика" / "© State Statistical Office". No reuse terms are stated on the copyright page.
- **Census book citation clause** (2002 Book X front matter, verbatim; the same convention runs through the SSO census book series): "WHEN USING DATA CONTAINED HERE, PLEASE CITE THE SOURCE AS FOLLOWS: CENSUS OF POPULATION, HOUSEHOLDS AND DWELLINGS IN THE REPUBLIC OF MACEDONIA, 2002 - BOOK X".

The product is a derived aggregate summary (municipality religion shares) carrying full attribution to the SSO, built from an openly published census book, leaking no microdata. Under the standing BUILD-THEN-ASK ruling it ships with attribution; the census books' own "please cite the source" instruction supports the derived-aggregate use. Licence recorded as `accepted` on the build-then-ask attribution basis (the RO/SK/CI/MONSTAT/DCS derived-summaries line), with the product staged (`downstream_status: staged`, `pipeline_stage: staged`) pending an SSO reuse-confirmation email — the clean courtesy unblock, recorded for the PI (do not send), consistent with the MONSTAT/DCS/Sri Lanka staging line.

## Premise corrections (trust the record)

- **The 2002 wave cannot ship on any licensed frame — 2002 is HELD.** The brief expected "Book XIII carries religion by municipality on the then-123-municipality frame". The record refutes this twice. First, **Book XIII does not carry religion**: it is "Total population, households and dwellings according to the 2004 territorial organization", carrying total population, households, dwellings, and ethnic/educational/economic characteristics — not religion. Second, the 2002 religion table lives in **Book X** ("ethnic affiliation, mother tongue and religion, final data by settlements"), which is on the **pre-2004 (1996) 123-municipality frame**, not the 2004 frame. The 2004 reorganisation (123 → 84 municipalities, then a 2013 merger to 80) means the 2002 religion frame matches no licensed boundary (geoBoundaries = 84/2004; OCHA COD-AB = 80/current). Per the brief's own ruling, 2002 is HELD.
- **The 2021 frame is 80 municipalities, not "80+".** The 2021 census book table T-06 lists exactly 80 municipalities (the ten Skopje municipalities among them) plus a City of Skopje aggregate; OCHA COD-AB 2025 ADM2 carries exactly 80. The frame is settled.
- **The 2021 universe is the total resident population with an administratively-transferred component, rendered as published.** The 132,260 administratively-sourced persons (7.20%) are a distinct published religion category, not an enumeration gap to be filled; they stay in the denominator and outside both headline slots.
- **The MakStat PxWeb API navigation is disabled to automated access.** Only the database root list and `?config` respond; every folder and table path returns HTTP 400, and the JS tree is invisible to non-browser fetch. The durable published census book (English and Macedonian editions) is the transcription source; the book reconciles exactly.

## Retrieval record

Every cached input is under `data/raw/mk_census/`, which `git check-ignore` confirms is excluded by `.gitignore:120` (the `data/` rule). Retrieval occurred on 2026-07-12.

| Cached input | Source URL | Role | SHA-256 |
| --- | --- | --- | --- |
| `mk_2021_census_book_en.pdf` | <https://www.stat.gov.mk/publikacii/2022/POPIS_DZS_web_EN.pdf> | 2021 religion by municipality (table T-06), parsed | `a6a8f1d4ce8cbb36e5917d00a13caf8b962f1eff249c837c09c7ca04ad4531d5` |
| `mk_2021_census_book_mk.pdf` | <https://www.stat.gov.mk/publikacii/2022/POPIS_DZS_web_MK.pdf> | verbatim Macedonian category names | `429b588eb48a0f225581f1297d4bc636e75e11c1b0b3d71d21deb5038d9658f9` |
| `mkd_codab_2025_shp.zip` (→ `mkd_admbnda_adm2_2025_AB.shp`) | <https://data.humdata.org/dataset/f7b918d3-9633-4142-8ae5-2358ca87ff3f/resource/9ac00088-e0d1-47b0-a4cd-06500776e93b/download/mkd_adm_2025_ab_shp.zip> | 2021 boundary (80 units, CC BY-IGO) | `83d36558324e15ecb0733603863fb4d441b16b7e8791e5390baf1d3b64e1bf30` |
| `hdx_mkd_codab.json` | <https://data.humdata.org/api/3/action/package_show?id=cod-ab-mkd> | boundary licence metadata (cc-by-igo) | `f39a6958008d7b2aa89b610ccfbd12a87ac7351317e9de7402850a56f0c27a56` |
| `gb_mkd_adm2_meta.json` | <https://www.geoboundaries.org/api/current/gbOpen/MKD/ADM2/> | 84-unit 2004-frame layer metadata (rejected for 2021) | `f82e5a93a4871b1fb9e478c5e5d7eb18dde9d0eec1b813aac819e9e3ff4de2a2` |
| `mk_2002_knigaX.pdf` | <https://www.stat.gov.mk/Publikacii/knigaX.pdf> | 2002 religion by settlement/municipality (HELD) | `9b132f9ff72c11fa1c3e36cd896ad3301876a3699913bc0372de5d43421457f9` |

Context files (not build inputs, retained for provenance): `mk_2021_relig_national.xlsx` (SSO first-dataset national tables) `725858ce…`; `mk_2002_knigaXI.pdf` (sex/age) `ba061bfd…`; `mk_2002_knigaXII.pdf` (economic activity) `aaca5928…`; `mk_sso_copyright_{en,mk}.html` (copyright-page captures, 302-redirect stubs). The 2002 Book XIII (2004 territorial org, religion-excluded) was inspected via the SSO publication page (id=54) and `knigaXIII.pdf`.

## Blockers and held items

- **2002 (HELD).** The 2002 census religion table (Book X, five categories, total 2,022,547) is on the pre-2004 (1996) 123-municipality frame. No licensed 123-municipality boundary exists. **Exact unblock — any one of:** (a) a licensed 1996/123-municipality boundary layer matching the 2002 census frame; (b) an SSO re-tabulation of 2002 religious affiliation onto the 2004 (84) or current (80) municipal frame, parallel to Book XIII's re-tabulation of total population and ethnicity; or (c) an SSO-published settlement-to-current-municipality concordance permitting an exact re-aggregation of Book X's settlement-level religion (Book X publishes religion by settlement, and settlements are stable across the reorganisations). Building 2002 without one of these would require an invented concordance, which is forbidden.
- **Licence (needs_review, not a hard block under BUILD-THEN-ASK).** The SSO asserts copyright with a "please cite the source" clause and no open-data licence; the 2021 product ships with attribution and stages pending an SSO courtesy confirmation.
- **PxWeb API (documented).** The MakStat folder/table navigation API is disabled to automated access; the durable census book is used instead and reconciles exactly.

## Product boundary

A build on this probe stages municipality-level religious-affiliation summaries for 2021 (80 municipalities, OCHA COD-AB 2025 ADM2, CC BY-IGO) with the verbatim thirteen-category frame (English and Macedonian), the total-resident-population universe (administratively-sourced component rendered as published), fail-fast reconciliation at both margins and the Skopje partition (all close exactly), and the ordinary two-slot design (Undeclared / Unknown / administrative-sources as disclosed denominator residuals). It carries no place-of-worship layer, no 2002 wave (HELD), and no cross-wave change layer. The census data ship with attribution to the State Statistical Office of the Republic of North Macedonia under BUILD-THEN-ASK; the boundary ships under CC BY-IGO to OCHA.
