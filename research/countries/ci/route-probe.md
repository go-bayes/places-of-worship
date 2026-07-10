# Côte d'Ivoire census-religion route probe

Verified 2026-07-10. Côte d'Ivoire collected religion in the 1988, 1998, 2014, and 2021 censuses. The verified publications do not provide one continuous subnational series. The 1998 analytical volume gives one-decimal percentages for 19 historical regions. The 2014 synthesis gives a national table. The 2021 base table gives exact category counts for 510 sub-prefecture-or-commune rows plus department, region, district, and national aggregates.

The build is blocked by the row-reconciliation gate. The extraction pairs all 677 rows across the two halves of 2021 Table 11, but 31 local rows contain category sums that exceed the row's printed resident total by one or two people. The combined excess is 41 people. The builder stops before joining or writing a product and makes no allocation.

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
| 2021 | [RGPH 2021 Base Table 11](https://rp2021.anstat.ci/wp-content/uploads/2023/09/TABLEAUX-11_DE-BASES_RP-RELIGION.pdf) | 510 sub-prefecture-or-commune rows; department, region, district, and national aggregates | Intended finest-geography product. Blocked because 31 local rows fail the row-reconciliation gate. |

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
