# Sri Lanka DSD-level product: build attempt record

Recorded 2026-07-12 by the conductor from a gate-verified Opus build lane. Verdict: **HELD on the boundary vintage** — the census side is done and gate-clean; no product shipped because no honest boundary exists yet.

## What the lane proved (census side, complete)

The small-cell rule's ratification (2026-07-12) unblocked the deferred Divisional Secretariat Division product recorded in `docs/manifests/lk-census-religion-1981-2024.json`. The lane extracted and reconciled both DSD waves in full:

- **2012**: all 25 per-district A4 PDFs cached in `data/raw/lk_census/` (`a4_<district>_2012.pdf`; Kandy and Moneragala need variant URLs — `Kandy/Table%20A4.pdf`, spelling `Monaragala`). 331 DSDs. Every district's DSD rows sum exactly to the published district total; DSD sums roll up to the national total 20,359,439 exactly; every row's six categories sum exactly to its own total.
- **2024**: Table A7. 340 DSDs, national total 21,781,800 exact, same within-row identities.
- **Category frame**: both waves print the district product's six-category convention verbatim (Buddhist, Hindu, Islam, Roman Catholic, Other Christian, Other). Eastern-district A4s carry a printed "Not reported" column that is zero throughout.
- **Small-cell tokens (computed, ready to emit)**: `small_denominator_under_100` fires on **zero** rows in either wave (smallest DSD is Jaffna/Delft, 3,824 in 2012 and 3,158 in 2024); `small_cell_under_10` fires on **240 of 331** rows in 2012 and **276 of 340** in 2024 (minority category cells routinely drop under ten at DSD grain; smallest numerator 0 in the Other slot). The rule's motivating case is therefore a numerator-marker case, never a wash case.
- **Source defect (record as published)**: the 2012 Mannar A4 omits the printed name of its fifth DSD (total 8,119, Islam-dominant) — the text layer and the rendered page image both show an unlabelled row. By position and profile it is Musali (named in the 2024 A7), but the 2012 source does not print it; carry the label as absent-in-source, never filled.

## The blocker (boundary, structural)

The cached geoBoundaries LKA ADM3 layer (330 features, 2020 vintage) matches neither census frame: 2012 has 331 DSDs (Ampara 20 vs the layer's 19), 2024 has 340 (Nuwara Eliya +5, Galle +3, Ampara +1, Ratnapura +1). No one-to-one join is possible by count alone, and the joinable subset would still need a hand-verified name concordance across roughly 68 transliteration divergences per wave (Matugama/Mathugama, Bentota/Benthota, Monaragala/Moneragala). The two census frames also differ from each other (Nuwara Eliya 5→10, Galle 19→22, Ratnapura 17→18; Ampara reshuffled at equal count), and no official 2012↔2024 DSD concordance was located — the product form, when built, is two per-vintage frames with cross-wave change withheld (the Kazakhstan precedent).

## The unblock

Per-vintage DSD geometry: a 2012-vintage layer (331 divisions) and a 2024-vintage layer (340), ideally official Survey Department layers per census year, plus a hand-verified census-name-to-feature concordance covering the transliteration divergences and the unnamed Mannar division. Once a boundary is ruled, the verified extraction and reconciliation feed straight into a build; margins and tokens are already proven.
