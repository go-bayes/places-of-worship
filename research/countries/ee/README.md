# Country data map: Estonia (EE)

## Status

- **Tier**: A
- **Build state**: Data extracted; three-wave county census-affiliation product built; region-page wiring remains open.
- **Last verified**: 2026-07-10

## Religious data over time

| Source | Construct | Smallest public unit used | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [Statistics Estonia RL229](https://andmed.stat.ee/en/stat/rahvaloendus__rel2000__usk/RL229) | Census religious affiliation, population aged 15+ | County | 2000 | PXWeb API | Open | CC BY-SA 4.0 |
| [Statistics Estonia RL0453](https://andmed.stat.ee/en/stat/rahvaloendus__rel2011__rahvastiku-demograafilised-ja-etno-kultuurilised-naitajad__usk/RL0453) | Census religious affiliation, population aged 15+ | County | 2011 | PXWeb API | Open | CC BY-SA 4.0 |
| [Statistics Estonia RL21452](https://andmed.stat.ee/en/stat/rahvaloendus__rel2021__rahvastiku-demograafilised-ja-etno-kultuurilised-naitajad__usk/RL21452) | Census sample-survey religious affiliation generalised to the population aged 15+ | Municipality; county used for the three-wave product | 2021 | PXWeb API | Open | CC BY-SA 4.0 |

The construct is self-reported religious affiliation. It does not measure church membership, belief intensity, practice, or attendance. Every percentage divides by the published population aged 15 and over for the same county and wave. Total population is never the denominator.

The 2021 religion characteristic comes from the census sample survey because religion was unavailable in registers. Statistics Estonia generalised the survey responses to the population aged 15 and over. Religion itself was not register-supplemented, and published 2021 counts remain rounded to tens.

## Access the data yourself

This project publishes derived county counts, shares, and simplified official boundaries with attribution. To obtain the source data:

- **Source of record**: Statistics Estonia [statistical database](https://andmed.stat.ee/en/stat) and PXWeb API.
- **Exact tables**: `RL229.PX` ([2000 English API](https://andmed.stat.ee/api/v1/en/stat/rahvaloendus/rel2000/usk/RL229.PX)), `RL0453.PX` ([2011 English API](https://andmed.stat.ee/api/v1/en/stat/rahvaloendus/rel2011/rahvastiku-demograafilised-ja-etno-kultuurilised-naitajad/usk/RL0453.PX)), and `RL21452.px` ([2021 English API](https://andmed.stat.ee/api/v1/en/stat/rahvaloendus/rel2021/rahvastiku-demograafilised-ja-etno-kultuurilised-naitajad/usk/RL21452.px)).
- **Licence**: Statistics Estonia open data are Creative Commons Attribution-ShareAlike 4.0 International. Cite Statistics Estonia as the source.
- **Our extraction script**: `scripts/build_ee_area_summary.R`.
- **Retrieval recipe and hashes**: `docs/manifests/ee-census-religion-2000-2021.json` records the POST bodies, URLs, retrieval date, and SHA-256 for every raw input.
- **Probe record**: `research/countries/ee/route-probe.md` records the source-tree inventory, complete category mappings, response treatment, rounding, and geography decision.

## Boundaries

| Wave | Official layer | Product file | Match note |
| --- | --- | --- | --- |
| 2000 | Maa-amet (Estonian Land Board) historical WFS (Web Feature Service) `maakonnad_2000`, 4 December 2000 | `apps/regions/ee/data/ee_county_2000.geojson` | 15 period counties joined by EHAK (Estonian Administrative and Settlement Classification) county code |
| 2011 | Maa-amet historical WFS `maakonnad_2011`, 8 June 2011 | `apps/regions/ee/data/ee_county_2011.geojson` | 15 period counties joined by EHAK county code |
| 2021 | Maa-amet historical WFS `maakonnad_2021`, 1 January 2021 | `apps/regions/ee/data/ee_county_2021.geojson` | 15 period counties joined by EHAK county code |

The Estonian Land and Spatial Development Board permits derivatives and redistribution under its open-data licence when the source and data vintage are cited. The project assigns no Creative Commons identifier to the boundary data.

Statistics Estonia does not publish the earlier religion waves rebased to the current 79 municipalities or the 2021 counties. The product therefore keeps three boundary files and a wave-specific `boundary_set_id` on every row. It does not report county-level change across boundary vintages.

## Places-of-worship layer

| Source | Role | Note |
| --- | --- | --- |
| [OpenStreetMap](https://www.openstreetmap.org) | Candidate site layer only | A governed Estonia place-of-worship snapshot is outside this census-affiliation release. |

## First visualisation

Religious-affiliation percentage among the population aged 15 and over by county for 2000, 2011, and 2021. The year selector must switch to the matching period boundary. A separate layer can show no religious affiliation using the same age-15-plus denominator.

## Build recipe

1. Run `Rscript scripts/build_ee_area_summary.R` from the repository root. The script queries every religion category for the national row and 15 counties in each wave.
2. The script uses the published affiliation parent row. The 2000 no-religion field sums `Has no religious affiliation` and `Atheist`; the 2011 and 2021 fields use `Does not feel an affiliation to any religion`.
3. Refusal, cannot-define, and relationship-unknown categories remain in the published age-15-plus denominator and outside both headline numerators.
4. The script retains 2021 counts in their published tens, records unavailable minor categories, and distributes no residual.
5. The script downloads the three official historical county layers, normalises coastal polygons to valid multipolygons, and simplifies each layer through `scripts/lib/simplify_boundary.R`.
6. The build writes `apps/regions/ee/data/area_summary_county.json`, its CSV companion, three period boundary files, and the tracked manifest.
7. The build stops if a wave or headline cell is absent, reconciliation exceeds the source rounding rule, boundary codes fail to join, geometries are invalid, geometry hashes repeat, or provenance is incomplete.

## Risks and open questions

- The 2021 values are sample-survey estimates published in tens. Forty-one minor-religion county cells are too uncertain for publication, but all headline fields are present.
- The 2000 universe includes people aged 15 and over and people whose age was unknown. The product records the source definition and uses the published age-15-plus table total.
- The county polygons differ across waves. The product supports period maps and withholds a same-boundary county change metric.
- A later 2021-only municipality product can use the 79 municipality rows in `RL21452`; it cannot create a three-wave municipality series without an official source rebase.

## Deep-history potential

Lutheran parish registers, Orthodox and Old Believer records, the Estonian National Archives, Jewish community archives, Baltic German and Swedish church records, and interwar census volumes can support a separate historical source survey.
