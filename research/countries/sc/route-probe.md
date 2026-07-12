# Seychelles census-religion route probe

Verified 2026-07-12. The Seychelles National Bureau of Statistics (NBS, `nbs.gov.sc`) publishes religion **by region/district** as a count-valued cross-tab for **one** census wave — **2022** — in the Seychelles Population and Housing Census 2022 report, Table B4.1 "Population in all households by religion and region/district, 2022" (report page 94). The queue premise ("1994-2022 | region in public summaries; district table to verify | census affiliation | browser work | probe then build") is confirmed on the district table (it exists, with integer counts, for 2022) and on the census-affiliation construct; it is refuted on the multi-wave district span. The record refutes a multi-wave district religion series: religion by district is published only for 2022. The national religion table (Table 3.2) prints 2022 and 2010, so national religion is a two-wave series, but the 2010 report's district religion could not be confirmed within this probe and the 2010 district frame predates the Perseverance Island district; 2002 and 1994 religion appear in neither the 2022 report nor any retrieved product. The 2022 wave is the clean route: integer counts, an eight-category verbatim frame, closing integer-exact at both margins to the census total of 102,612. The boundary route is clean and official: the OCHA Common Operational Dataset — Administrative Boundaries (COD-AB, `cod-ab-syc` on HDX), sourced from the Seychelles National Bureau of Statistics itself, carries a stated Creative Commons Attribution for Intergovernmental Organisations (CC BY-IGO) licence and, at admin level 3, exactly the 27 census districts including Perseverance Island. The licence is the load-bearing caveat: NBS asserts an all-rights-reserved posture and requires "prior written consent" to reproduce site content, so the derived summaries ship **staged** under build-then-ask with NBS attribution and a courtesy reuse ask recorded for the PI (never sent).

## Build decision (recommendation to the conductor)

- **Recommendation**: BUILD a single-wave (2022), 27-district religious-affiliation product on the official NBS/OCHA COD-AB admin-3 frame, STAGED (page decision the conductor's, parallel to Barbados/Guyana/Antigua). The route is clean under the brief's build gate (at least one wave, counts, licensed boundary, exact-margin reconciliation).
- **Product shape**: 2022 single-wave district product (the Barbados/Guyana shape). Religion by district exists only for 2022, so this is not a multi-wave district series; the multi-wave premise is refuted and recorded. The national two-wave series (2010, 2022; Table 3.2) is documented as context, not shipped as the product, following the Guyana precedent (a subnational table present for one wave takes priority over an earlier national wave, which is documented as deferred context).
- **Wave and source**:
  - **2022**: Seychelles Population and Housing Census 2022, Table B4.1 "Population in all households by religion and region/district" (report page 94) — integer counts, eight religion categories plus Total, over 7 regions and their district/island leaves. Every district column and every religion row reconciles to the printed national total exactly (national 102,612; Catholic 62,952; Missing 11,772; Hindu 5,508).
- **Geography**: 27 districts on OCHA COD-AB SYC ADM3 (`syc_admbnda_adm3_nbs2010`), sourced from NBS. 25 granite-island districts (Mahé 23 + Praslin 2) plus La Digue join the census one-to-one under a short name crosswalk (`Ile Perseverance`->`Perseverance Island`, `Grand Anse Mahé`->`Grand Anse Mahe`, `Baie Ste Anne`->`Baie Sainte Anne`); the single official "Other Islands" district takes the exact aggregate of the census's inner-island (excluding La Digue) and outer-island leaf rows.
- **Construct**: census affiliation — each resident's reported religion (questionnaire Q.01.11 "What is [Name's] religion?", single-select), asked of the whole resident population; not practice, attendance, or membership.
- **Slot design** (extended two-slot). `religious_affiliation_percent` = (Catholic + Anglican + Islam + Hindu + Christian (Other)) / total — the five unambiguously-religious categories. `no_religion_percent` = **null**: the 2022 report publishes **no standalone No-religion line**. The questionnaire offered "No religion" and "Atheist", but the published tabulation folds the non-religious into the "Other (Specify)" category, whose note states it "includes religious denominations such as Baha'i, Buddhist, non-religious, etc." The three residual columns — Other (Specify), Unable to classify, and Missing — stay in the denominator and in neither slot, so the affiliation share is below 100 by construction and no clean no-religion share is assertable. This is disclosed, never repaired or invented.
- **Map-worthy pattern**: the affiliation and Catholic shares are legible by district and vary. Hindu concentration is striking on the plantation/outer geography — Cascade is 20.1% Hindu (1,337 / 6,659) against a 5.4% national share, and the Other Islands district is 49.4% Hindu (730 / 1,479), reflecting migrant labour on the outer coral islands (Platte, Darros, Desroches). Anglican strength is highest on Praslin (Grand Anse Praslin 21.4%, 772 / 3,610; Baie Sainte Anne 7.5%) against a 5.0% national share. The "Missing" non-response residual is large and uneven (national 11.5%; Cascade 23.7%, Beau Vallon 15.3%), a documented data-quality feature of the 2022 census (an estimated 5,000 households could not be accessed).
- **Rights position**: STAGED, needs_review. The NBS Terms and Conditions require prior written consent to reproduce content; under build-then-ask the derived aggregate summaries ship with NBS attribution while a reuse confirmation is sought (recorded as a courtesy ask, not sent). The boundary is CC BY-IGO (accepted; the Pakistan OCHA COD-AB precedent).

## Published waves and geography

| Year | Official route | Religion table | Universe | Units | Decision |
| --- | --- | --- | --- | --- | --- |
| 2022 | [Seychelles PHC 2022](https://www.nbs.gov.sc/downloads/1555-seychelles-population-and-housing-census-2022) (PDF, p. 94) | Table B4.1 "Population in all households by religion and region/district" (integer, 8 categories) | all persons in all households (102,612) | 7 regions -> 27 districts | Ship the 27-district 2022 wave. |
| 2010 | Seychelles PHC 2010 report (not retrieved in this probe) | Table 3.2 prints **national** 2010 religion (total 90,945); 2010 district religion unconfirmed | all persons (90,945) | national confirmed; district unconfirmed | National context only; a 2010 district wave would need the 2010 report and a pre-Perseverance frame. |
| 2002 | Seychelles PHC 2002 report (not retrieved) | no religion table in the 2022 report or any retrieved product | — | — | Not shippable from retrieved sources. |
| 1994 | Seychelles PHC 1994 report (not retrieved) | none retrieved | — | — | Not shippable from retrieved sources. |

The 2022 report also prints Table 3.2 "Population distribution by religious denomination, Census 2022 and Census 2010" (national, both waves) and Table B4.2 "Population in conventional households by religion and region/district" (89,273; the conventional-household sub-universe, excluding collective households). Table B4.1 (all households, 102,612) matches the census total population and is the shipped source; B4.2 is recorded as a documented sub-universe, never the product.

## Category frame (2022 Table B4.1, preserved verbatim; never merged)

Table B4.1 prints eight religion categories plus the Total column. The frame, in source order:

| # | Category (2022 Table B4.1) | Role | National count |
| --: | --- | --- | --: |
| 1 | Catholic | affiliation | 62,952 |
| 2 | Anglican | affiliation | 5,180 |
| 3 | Islam | affiliation | 2,498 |
| 4 | Hindu | affiliation | 5,508 |
| 5 | Christian (Other) | residual affiliation | 8,810 |
| 6 | Unable to classify | non-response residual | 649 |
| 7 | Other (Specify) | mixed (Baha'i, Buddhist, non-religious) | 5,243 |
| 8 | Missing | non-response residual | 11,772 |

Note 1 (verbatim): the category "Christian (other)" includes Christian denominations or groups such as Assembly of God, born again Christian, Pentecostal Assemblies, etc. Note 2 (verbatim): the category "Other" includes religious denominations such as Baha'i, Buddhist, non-religious, etc. Because "Other (Specify)" mixes minority religions with the non-religious, and because there is no standalone No-religion line, the build places only the five clearly-religious categories in the affiliation numerator and leaves Other/Unable/Missing as disclosed residuals; no-religion is null.

A **5-person internal discrepancy** between Table 3.2 (national) and Table B4.1 (region/district) is recorded, not repaired: Table 3.2 prints Christian (other) 8,805 and Unable to classify 654, while Table B4.1 prints 8,810 and 649; both sum to 102,612 and the split of the same 9,459 persons differs by 5. The build renders Table B4.1's values (the district source) verbatim and documents the discrepancy (the Saint Lucia / Côte d'Ivoire documented-discrepancy treatment).

## Universe, denominator, and the district aggregation

The 2022 religion-table denominator is the **all-households population** (102,612), which equals the census total population and the Table 3.2 religion total. Religion is asked of the whole resident population with no age restriction, so the district shares are comparable in construct. The census presents religion over 7 regions (Central, East-South, West, North, Praslin, La Digue & Inner Islands, Outer Islands) with district and island leaf rows beneath each. The official administrative districts (COD-AB ADM3) number 27: 23 on Mahé, 2 on Praslin, La Digue, and one "Other Islands" district covering every remaining inner and outer island. The build maps the census as follows: the 25 granite-island district rows and the La Digue leaf row (3,133) join one-to-one to their COD districts; the single "Other Islands" district takes the exact sum of the census's inner-island leaves other than La Digue (Bird 1, Denis 86, Fregate 13, North 88, Silhouette 303 = 491) and the twelve outer-island leaves (Outer Islands region 988), i.e. 1,479. Every value summed is a published census leaf; the aggregation is an exact partition to the official district frame (the Montenegro complete-unit-partition precedent), never a redistribution.

## Reconciliation gates (verified in the probe; re-checked fail-fast in the build)

- **2022 (Table B4.1)**: every printed district/region row equals the sum of its eight categories; the 7 region totals (30,145 + 27,072 + 15,058 + 17,843 + 7,882 + 3,624 + 988) sum to the printed national 102,612; the 27-district partition (26 direct district rows + the Other Islands aggregate) sums, per category, to the printed national category totals (Catholic 62,952; Anglican 5,180; Islam 2,498; Hindu 5,508; Christian (Other) 8,810; Unable to classify 649; Other (Specify) 5,243; Missing 11,772) and, in total, to 102,612. Integer-exact at every margin. The build stops on any nonzero deviation; no value is allocated, inferred, imputed, or tuned.

National headline (2022, B4.1 frame): named-religion affiliation 84,948 (82.8%); no standalone No-religion line (null); residuals Other (Specify) 5,243 + Unable to classify 649 + Missing 11,772 = 17,664 (17.2%).

## Boundary source and licence

The boundary is the **OCHA Common Operational Dataset — Administrative Boundaries for Seychelles** (`cod-ab-syc`), retrieved from HDX on 2026-07-12. The dataset metadata records `dataset_source: "Seychelles National Bureau of Statistics"` and `license_title: "Creative Commons Attribution for Intergovernmental Organisations (CC BY-IGO)"` (`license_id: cc-by-igo`), vetted by ITOS with USAID funding. The shapefile `syc_admbnda_adm3_nbs2010.shp` carries 27 valid ADM3 district features with `ADM3_EN`/`ADM3_PCODE` attributes and includes `Perseverance Island` (SC1127PI), the reclaimed-island district the 2018 geoBoundaries release lacks. The extent spans lon 46.20 to 56.29 E and lat -10.21 to -3.71 N (the outer coral islands stretch the western edge), wholly within the standard frame and far from the antimeridian; no dateline handling is needed. The COD ADM3 names join the census district rows one-to-one under a short crosswalk (`Ile Perseverance`->`Perseverance Island`; `Grand Anse Mahé`->`Grand Anse Mahe`; `Baie Ste Anne`->`Baie Sainte Anne`; all others identical), with the single `Other Islands` district taking the census island aggregate.

**geoBoundaries alternatives (considered, not used)**: geoBoundaries SYC ADM1 (26 districts, `boundaryLicense` "Creative Commons Attribution-ShareAlike 3.0 Unported", Wikimedia, 2018) is missing Perseverance Island and carries French-form names truncated to ten characters; geoBoundaries SYC ADM2 (8 units, CC BY 4.0, derived from this same NBS/OCHA source) uses a Central-1/Central-2/East/North/West regionalization that does not match the census's 7 regions. The COD-AB ADM3 is the official NBS frame, cleaner in licence and provenance, and the deepest match; it is preferred.

## Licence position (staged; build-then-ask)

The census data are governed by an all-rights-reserved posture with a prior-consent reproduction clause, so the derived summaries ship **staged** with attribution while a reuse confirmation is sought. The load-bearing text, fetched and quoted verbatim (via the WebFetch fetcher; the `/downloads` component WAF-blocks scripted curl):

- **NBS Terms and Conditions** (`nbs.gov.sc/terms-and-conditions`, retrieved 2026-07-12): "You may reproduce short extracts from the content appearing on the site provided that the source is stated and prior written consent is obtained from the NBS." And: "All rights not expressly granted are reserved. Rights granted do not extend to any material on this site which is identified as being the copyright of a third party."
- **NBS website footer** (`nbs.gov.sc`, retrieved 2026-07-12): "Copyright © 2026 National Bureau of Statistics Seychelles. All Rights Reserved."
- Contact for permissions: CEO, ceo@nbs.gov.sc.

The product is a derived aggregate summary (district religion shares) built from a published aggregate table, leaking no microdata, carrying NBS attribution. Under the standing build-then-ask ruling (2026-07-11), derived summaries ship with attribution while reuse asks go out; the prior-consent wording is a clear-risk warning that places this in the STAGED tier (the MONSTAT / Sri Lanka DCS pattern: build and stage pending PI confirmation of the derived-summaries-with-attribution stance, or an NBS consent). `licence_status: needs_review`; `licence_basis: nbs_all_rights_reserved_prior_consent`. The boundary is CC BY-IGO (`licence_status: accepted`), attribution to OCHA/NBS.

## Premise corrections (trust the record)

- **The district religion product is single-wave 2022, not a 1994-2022 multi-wave district series.** Religion by district is published only for 2022 (Table B4.1). The 2022 report prints national religion for 2010 and 2022 (Table 3.2); 2010 district religion is unconfirmed and would sit on a pre-Perseverance frame, and 2002/1994 religion appears in no retrieved product.
- **The smallest public unit is the district, not the region.** The queue said "region in public summaries; district table to verify"; the district table exists (Table B4.1) at the finest published grain, and the official COD-AB provides matching district polygons. The small-country national-series clause is therefore **not** triggered; the district product is the shipped shape.
- **There is no standalone No-religion category.** The questionnaire collected "No religion"/"Atheist", but the published tabulation folds the non-religious into "Other (Specify)" (with Baha'i and Buddhist). No-religion is null and disclosed; it is not derived from "Other".
- **The licence is an all-rights-reserved posture with a prior-consent clause, not an open grant** (unlike the Barbados/Guyana Open Licence Agreements). The product ships staged with attribution under build-then-ask, with an NBS reuse ask recorded for the PI.
- **The route is a WAF-gated large PDF, not open browser work.** The 2022 report (a 10.5 MB PDF) 403s to scripted curl on the `/downloads` component; it was retrieved from the Internet Archive (a byte-faithful `id_` snapshot) and the licence pages via the WebFetch fetcher. The COD-AB boundary and its metadata are direct HDX downloads.

## Retrieval record

Every cached input is under `data/raw/sc_census/`, which `git check-ignore -v` confirms is excluded by `.gitignore:120` (the `data/` rule). Retrieval occurred on 2026-07-12; content type verified on every download.

| Cached input | Source | Format | SHA-256 |
| --- | --- | --- | --- |
| `sc_2022_census_report.pdf` | Internet Archive snapshot 20260703110307 of <https://www.nbs.gov.sc/downloads/1555-seychelles-population-and-housing-census-2022/download> | pdf | `7a9c1ec3f7458c69f042da9f4789c668fc82a2264cab8644b80d60b12f05fefa` |
| `syc_adm_nbs2010_SHP.zip` | <https://data.humdata.org/dataset/9ac1737f-cd33-4458-86e8-aec90eeffda2/resource/de3bca8b-f522-46ba-b4d2-e1c52034fcc0/download/syc_adm_nbs2010_shp.zip> | shapefile zip | `15752ee8b6b81b29103bb43c83b8874111c44d2327bcd597f0ada8656f47886c` |
| `syc_admgz_nbs2010.xlsx` | <https://data.humdata.org/dataset/9ac1737f-cd33-4458-86e8-aec90eeffda2/resource/00d9b051-9938-4220-aa29-e64adcad946d/download/syc_admgz_nbs2010.xlsx> | xlsx | `8014697af2ca344b96370929a2e2cec6002b34b131edb629dc5f17aefc0a6bec` |
| `hdx_cod_ab_syc.json` | <https://data.humdata.org/api/3/action/package_show?id=cod-ab-syc> | json | `db08948c82ba5b9dbe298505e0812ad3963a6afd6315e874871bcf2955a09bb8` |
| `nbs_terms_verbatim.txt` | <https://www.nbs.gov.sc/terms-and-conditions> (WebFetch) | text | `2b361967a2b4cb110138d2c64b2769758200bf65acc11741646062ebdf00e31b` |
| `cod_ab_syc_licence.txt` | HDX cod-ab-syc metadata transcript | text | `0836a3945bdc3c984118bacd678c85a244184dea1bde749a24eecd93b4841150` |

Also cached (context, not build inputs): `sc_2022_plain.txt` (pdftotext extraction), the COD-AB EMF/GDB were not downloaded, `gb_syc_ADM1_meta.json` / `gb_syc_ADM2_meta.json` and the geoBoundaries geojsons (the rejected boundary alternatives).

## Product boundary

A build on this probe stages district-level religious-affiliation summaries for 2022 (27 districts, OCHA COD-AB SYC ADM3, CC BY-IGO), with the verbatim eight-category 2022 frame, fail-fast reconciliation at both margins (the wave closes integer-exact to 102,612), and the extended two-slot design (affiliation = the five clearly-religious categories; no_religion null and disclosed; Other/Unable/Missing as disclosed residuals). It carries no place-of-worship layer, no cross-wave district change layer (single wave), and no pre-2022 district wave (not published). The census licence is staged (needs_review) under build-then-ask with NBS attribution; the boundary is CC BY-IGO.

## Blockers and held items

- **Second and earlier district waves (documented gaps, not blocks)**: religion by district is published only for 2022. A 2010 district wave would require the 2010 census report and a pre-Perseverance boundary; 2002 and 1994 religion appear in no retrieved product. The clean unblock is an NBS data request for the historic district religion cross-tabs (recorded as a courtesy ask, not sent).
- **Licence (needs_review; the shipping caveat)**: NBS Terms require prior written consent to reproduce content. The build stages the derived summaries with attribution under build-then-ask; the unblock is a PI ruling extending the derived-summaries-with-attribution stance to NBS (the CI/MONSTAT/DCS line) or an NBS reuse confirmation (ceo@nbs.gov.sc). The boundary licence (CC BY-IGO) is clean and accepted.
- **No standalone No-religion share (documented)**: the published table folds the non-religious into "Other (Specify)"; no-religion is null. The unblock to a genuine no-religion share is an NBS data request for the unfolded religion tabulation (the questionnaire collected it).
- **`nbs.gov.sc/downloads` WAF (operational, not a block)**: the download component 403s to scripted curl; the report was retrieved from a byte-faithful Internet Archive snapshot and the licence pages via the WebFetch fetcher.
