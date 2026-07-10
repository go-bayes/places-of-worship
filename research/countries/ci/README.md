# Country data map: Côte d'Ivoire (CI)

## Status

- **Tier**: B (feasible with a source-verified boundary concordance; every other blocker is now resolved)
- **Build state**: disclosure, basis-constant, and verification rulings encoded and exercised; the geoBoundaries name-encoding defect is diagnosed and repaired and the Abidjan aggregate join is engineered; ship blocked only at the census-to-ADM3 join, where 22 census units and 21 ADM3 features cannot be matched 1:1 without an invented concordance or self-summing (see route-probe.md, Engineering fix lane 2026-07-11, and `join-residue.csv`)
- **Last verified**: 2026-07-11

Two PI rulings (2026-07-10) are encoded in `scripts/build_ci_area_summary.R`: the 31 source-arithmetic overrun rows ship unchanged with a disclosed, never-clamped negative outside-basis count; and derived category summaries publish with INS/ANStat attribution under PI approval, with the ANStat "Tous droits Reservés" footer recorded verbatim and raw PDFs kept git-ignored. Running the reworked builder to completion for the first time surfaced upstream blockers the held probe never validated, so no product was written.

The Institut National de la Statistique (INS), now succeeded by the Agence Nationale de la Statistique (ANStat), produced the Recensement général de la population et de l'habitat (RGPH) publications used here.

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| INS RGPH 1998 Volume IV, Tome 1, Tables 3.1–3.9, https://centredecalcul.anstat.ci/assets/rapports/RGPH_98/RGPH_TOME1.pdf | census affiliation | historical region, rounded percentages | 1988 context; 1998 | PDF | open web | no reuse licence stated; ANStat says all rights reserved |
| INS RGPH 2014 synthesis, Table 2.11, https://centredecalcul.anstat.ci/assets/rapports/RGPH_2014/Rapport_RGPH_2014.pdf | census affiliation | national | 2014 | PDF | open web | no reuse licence stated; ANStat says all rights reserved |
| INS RGPH 2021 Base Table 11, https://rp2021.anstat.ci/wp-content/uploads/2023/09/TABLEAUX-11_DE-BASES_RP-RELIGION.pdf | census affiliation | sub-prefecture or commune | 2021 | PDF | open web; local TLS chain failure recorded | no reuse licence stated; ANStat says all rights reserved |
| ANStat RGPH 2021 thematic report, Tome 1, Tables 2.2 and 4.9, https://www.anstat.ci/assets/publications/files/rgpg_tom1.pdf | census affiliation and denominator definitions | national | 1988, 1998, 2021 | PDF | open web | no reuse licence stated; ANStat says all rights reserved |

The census waves do not provide one comparable local series. The 1998 regional table uses 19 historical regions and rounded percentages. The 2014 verified table is national. The 2021 base table publishes exact category counts at local level, but 31 local rows fail exact reconciliation against their printed resident totals.

## Access the data yourself

The Côte d'Ivoire lane has not redistributed the source data or produced a map product because a hard validation gate failed. To inspect the source record:

- **Source of record**: Institut National de la Statistique (INS), now succeeded by the [Agence Nationale de la Statistique (ANStat)](https://www.anstat.ci/).
- **Exact 2021 table**: [RGPH 2021 Base Table 11, “Répartition de la population résidente selon la religion”](https://rp2021.anstat.ci/wp-content/uploads/2023/09/TABLEAUX-11_DE-BASES_RP-RELIGION.pdf).
- **Exact historical tables**: [RGPH 1998 Volume IV, Tome 1](https://centredecalcul.anstat.ci/assets/rapports/RGPH_98/RGPH_TOME1.pdf), Tables 3.1–3.9; [RGPH 2014 synthesis](https://centredecalcul.anstat.ci/assets/rapports/RGPH_2014/Rapport_RGPH_2014.pdf), Table 2.11; [RGPH 2021 thematic report, Tome 1](https://www.anstat.ci/assets/publications/files/rgpg_tom1.pdf), Tables 2.2 and 4.9.
- **Licence**: no census-publication reuse licence was located. The current ANStat site says that all rights are reserved.
- **Our extraction script**: [`scripts/build_ci_area_summary.R`](../../../scripts/build_ci_area_summary.R) — pairs the 2021 PDF sheets and stops before product writing when any local row fails reconciliation.
- **Probe record and hashes**: [`research/countries/ci/route-probe.md`](route-probe.md) records the routes, category frames, denominator decision, boundary metadata, and failed gate. Cached inputs and SHA-256 sidecars remain under git-ignored `data/raw/ci_census/`.

## Boundaries

- Proposed shipped source: [geoBoundaries Côte d'Ivoire administrative level 3 (ADM3) metadata](https://www.geoboundaries.org/api/current/gbOpen/CIV/ADM3/), 510 units, represented year 2021, source Comité National de Télédétection et d'Information Géographique (CNTIG) and the United Nations Office for the Coordination of Humanitarian Affairs Regional Office for West and Central Africa (OCHA ROWCA), Creative Commons Attribution 3.0 Intergovernmental Organisations.
- Source geometry tests passed for 510 valid, non-empty, distinct features with no interior gap, positive overlap above one square metre, or sub-one-square-kilometre sliver.
- The official [ANStat boundary API](https://anstat.ci/public/api) offers sub-prefecture files but states no reuse licence. The site footer says that all rights are reserved.
- No licensed historical 19-region geometry was pinned for the rounded 1998 regional table.

## Places-of-worship layer

- OpenStreetMap (OSM) coverage assessment: not run during this census-source probe.
- Country-specific registers: not assessed during this census-source probe.

## First visualisation

Blocked: 2021 census religious-affiliation percent and no-religion percent by sub-prefecture or commune. The proposed denominator is the exact sum of the 16 ordinary-household religion categories. Product construction must wait for an INS or ANStat correction, clarification, or replacement table that resolves the 31 impossible local rows.

## Build recipe

1. Extract: `scripts/build_ci_area_summary.R` uses Poppler `pdftotext -layout` and pairs the two Table 11 sheets by row key.
2. Validate: require every category sum to fit within the printed resident total and require all 510 local rows to reconcile to published aggregates.
3. Governed product: write `area_summary` only after the every-row gate passes, then validate against `schemas/area-summary.schema.json`.
4. Boundaries: join the 510 census rows to geoBoundaries CIV ADM3 and rerun validity, distinct-hash, overlap, gap, and sliver tests after simplification.
5. Rights: keep the derived table staged until the census-publication reuse position is resolved.

## Risks and open questions

- The census yields 519 leaf sub-prefecture-or-commune rows (corrected from the probe's asserted 510). Collapsing the 10 Abidjan city communes to the census's own printed "Total-Ville ABIDJAN" aggregate, which serves the single ADM3 "Abidjan" feature, gives 510 census join units against the 510 ADM3 features; Yamoussoukro needs no collapse. This is engineered in the builder.
- The remaining and now sole ship blocker is the join residue: after the name-encoding repair, `stringi` transliteration, and the Abidjan collapse, 488 of 510 census join units match a distinct ADM3 feature by name, but 22 census units and 21 ADM3 features cannot be matched 1:1. The residue is spelling variants, a two-leaf-to-one-feature merge (BOBI + DIARABANA → Bobi-Diarabana, with no census-printed aggregate), and an ADM3 national-park polygon (Parc National de Bona) that is not a census unit. Closing it needs a source-verified concordance or a boundary layer that partitions the census units exactly; both are PI-level decisions (route-probe.md, `join-residue.csv`).
- The source does not internally reconcile at any level, all confirmed source arithmetic by 300 dpi image readback: 31 leaf overruns (41 people); 48 of 110 departments differ from the sum of their child sub-prefectures by −3 to +2 (ADIAKE 88,007 vs printed 88,006); and the 519 leaves sum to 6 above the national resident total and 138 below the national religion basis. The builder pins this full set and stops on drift; every printed value ships unchanged (documented-discrepancy ruling).
- The product's national religion basis is Table 11's own 16-category sum, 29,276,658 (outside-basis 112,492 against the printed resident total 29,389,150). Tome 1 Table 2.2's 29,276,660 differs by two people; that is disclosed as a between-publications discrepancy, not corrected. The builder is now pinned to 29,276,658.
- The geoBoundaries CIV ADM3 `shapeName` field was doubly UTF-8-encoded (é stored as the four bytes for "Ã©"); the repair reverses one Latin-1→UTF-8 layer, gated on the "Ã"/"Â" signature so clean accents survive. 166 of 510 names are repaired with zero residue.
- Thirty-one 2021 local rows have category sums one or two people above their printed resident totals (41 people combined). Under the PI ruling these ship unchanged with a disclosed negative outside-basis count; the builder now reaches and exercises this disclosure (it blocks downstream, at the join, not upstream).
- The 2021 religion universe is the ordinary-household population. Collective-household residents and people without housing lack the individual characteristics collected through the ordinary-household questionnaire.
- The 1998 regional percentages use a historical 19-region frame and one-decimal rounding; 1988, 1998, and 2014 remain national context only.
- No named open licence was located for the census publications; the ANStat footer records "Tous droits Reservés". Derived summaries are cleared to publish with attribution under PI approval 2026-07-10.

## Deep-history potential

Not surveyed during this route probe.
