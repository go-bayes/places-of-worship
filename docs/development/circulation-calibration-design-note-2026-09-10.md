# Circulation calibration design — results note (2026-09-10)

Companion to section 8 of [circulation-signals-options-2026-09-10.md](circulation-signals-options-2026-09-10.md). This note records what `scripts/circulation_calibration_design.R` does with the data the repository holds today, and what it found. No presence signal was used, because none is openly available for New Zealand; the script builds the sampling frame and draws the probability sample that a future calibration study would use.

## Inputs

- `data/nz_places.geojson`: 3,370 OpenStreetMap-derived places (extraction 2025-08-20).
- `apps/regions/nz/data/sa2_2023.geojson`: 2023 SA2 boundaries, matched to the census summary's codes (the older `data/sa2.geojson` carries 2018 codes and was left aside).
- `apps/regions/nz/data/area_summary_sa2.json`: 2023 census rows with `population_total` and `land_area_sq_km` per SA2. `population_total` there is the count of people with a stated religious-affiliation response, so the density it yields is a proxy for residential density.

## Design choices the script fixes (all open for ruling R-C5)

- Denomination groups from the OSM `religion` and `denomination` tags: Anglican, Presbyterian, Catholic (`catholic` and `roman_catholic`), other Christian (every other Christian denomination, cooperating parishes tagged with `;`, and Christian sites without a denomination tag), non-Christian (any `religion` other than `christian`), and unknown (no `religion` tag).
- Urban or rural: SA2 residential density at or above 400 residents per square kilometre is urban. This is a proxy with a stated threshold, not the Stats NZ urban–rural classification.
- Mapping detail: a site mapped as a way with a `building` tag is `building_mapped`; otherwise `point_only`. This stands in for the size proxy the design wants, which the current data lack.
- Sample: 120 sites, proportional allocation across strata with a floor of eight per stratum, strata smaller than the floor taken whole, and any excess trimmed one site at a time from the stratum with the largest allocation above its floor. Seed 20260910.
- Placement: a point on a shared SA2 boundary joins once; 52 points that fall outside every 2023 polygon (coastal and offshore simplification) take their nearest SA2 and are flagged `nearest_sa2` in the sample file.

## Results

The frame holds 3,370 sites in 14 strata. By denomination group: other Christian 1,863; Anglican 472; Catholic 341; unknown 298; Presbyterian 242; non-Christian 154. By area class: urban 2,451; rural 917; unknown 2 (SA2s with no census row). By mapping detail: building-mapped 3,028; point-only 342.

| Stratum | Frame | Proportional | Allocated |
|---|---|---|---|
| other Christian × urban | 1,466 | 52 | 21 |
| other Christian × rural | 397 | 14 | 14 |
| Anglican × urban | 291 | 10 | 10 |
| Catholic × urban | 242 | 9 | 9 |
| Presbyterian × urban | 192 | 7 | 8 |
| Anglican × rural | 180 | 6 | 8 |
| unknown × rural | 153 | 5 | 8 |
| unknown × urban | 145 | 5 | 8 |
| non-Christian × urban | 115 | 4 | 8 |
| Catholic × rural | 99 | 4 | 8 |
| Presbyterian × rural | 49 | 2 | 8 |
| non-Christian × rural | 39 | 1 | 8 |
| Anglican × unknown | 1 | 0 | 1 |
| Presbyterian × unknown | 1 | 0 | 1 |
| total | 3,370 | 120 | 120 |

The floor moves 31 sites from the largest stratum into the small ones, so the sample over-represents rural, non-Christian and untagged sites relative to their share of the frame. That is the intent: the sites a presence signal is most likely to miss are the ones the calibration must include. Design weights (frame size over allocation, per stratum) restore the population estimates.

## Outputs

Written to `exports/circulation-calibration/` (git-ignored, regenerate with `Rscript scripts/circulation_calibration_design.R` from the repository root): `frame_summary.csv` (counts by group, area class and mapping detail), `allocation.csv` (the table above with stratum labels), `sample.csv` and `sample.geojson` (the 120 sampled sites with their strata, SA2, placement flag and coordinates).

## Gaps the data leave

1. **No W = 0 stratum from the review queue.** Candidate sites nominated through the portal live in Convex and are absent from the static frame; the unknown-religion group is the nearest substitute until an export lands.
2. **No size proxy.** Building footprint area would need the OSM way geometry or the buildings tile layer; the mapping-detail flag is a weak stand-in.
3. **Parish grain.** The Presbyterian and Christchurch Anglican returns are per parish, so the site-level calibration will use single-building parishes or an allocation rule; the sample file's denomination group lets that filter be applied later.
4. **Frame vintage.** The frame is the 2025 OSM extraction; the study frame at pilot time should be the accepted site set plus open candidates, with the same strata.
