# Playbook: US deep past — 1850–1936 from NHGIS

Status: READY (not started). Authorised direction: JB wants the deepest
available history (2026-07-06). Sources verified by web research
2026-07-06; licence verification is step 1 and is BLOCKING.

## What exists (verified)

NHGIS (IPUMS, nhgis.org, free registration) holds county-level
machine-readable tables for the census **church statistics of 1850,
1860, 1870, 1890** (churches/edifices, seating accommodation, property
value, by denomination) and the **1906–1936 Census of Religious Bodies**
(the waves our Phase 2 correctly excluded from ARDA files for lacking
denominators — NHGIS's versions carry adjacent-census population
references). NHGIS also provides decennial county populations from 1790
and **period county boundary shapefiles** (1850–1940). ICPSR study 2896
(Haines) is the fallback source for the same tables.

Together with the live 1952–2020 series, this reaches **1850–2020**.

## Blocking step 1 — licence

NHGIS terms: free with registration; **redistribution requires
permission except publication subsets**. Publishing derived county
rates on the map with citation is likely a permitted publication use,
but VERIFY the current IPUMS NHGIS terms text, record it in the
manifest, and if ambiguous draft a permission request for JB to send
before anything deploys. If NHGIS terms fail, evaluate ICPSR 2896's
terms for the same tables. Attribution on the map and manifest either
way (binding rule).

## Decisions already made (do not reopen)

1. **Constructs stay separated by era, as distinct metrics.**
   - 1850–1890: "Church seating per 100 population" (accommodation —
     the era's standard measure) and optionally "Churches per 10,000
     residents". NOT adherents; label accordingly via `metricLabels`.
   - 1906–1936: "Members per 100 population" (bodies' own member
     counts; denominator = adjacent decennial census population as
     supplied/referenced by NHGIS — an explicit, documented relaxation
     of Phase 2's same-study rule, justified because the census bureau
     itself ran both collections).
   - 1952–2020: adherents, as live today. The module's per-metric
     pending behaviour handles years where a metric has no data.
2. **Period boundaries via a second census level, not crosswalks.**
   Nineteenth-century counties must NOT be crosswalked onto 2020
   geometry (many counties did not exist; the West was unformed). Add
   levels using the existing multi-level machinery — e.g. `county`
   (2020 boundaries; 1952–2020 data) and `county_1890` (NHGIS 1890
   boundaries; 1850–1890 data), and decide during the build whether
   1906–1936 reads better on period (1930) or 2020 boundaries — pick
   ONE and document why. No shared-module changes should be needed;
   levels are already config (boundary file + summary product per
   level).
3. **Simplify period shapefiles** to the size discipline of the 2020
   layer (~2.5 MB); NHGIS shapefiles ship detailed.
4. **Wave coverage caveats carry forward**: every pre-1952 row gets
   `wave_coverage_differs`; onboarding gains one line naming the
   construct shifts (seating → members → adherents).

## Build steps

Follow the Phase 2 pattern exactly (raw to `data/raw/us_nhgis/` with
sources.csv + hashes; archival copy to
`gs://places-of-worship-private-sync/raw_sources/us_nhgis/`; R build
extending `scripts/build_us_area_summary.R`; per-wave totals validation
against published state/national sums; manifest; country card; changelog;
browser verification including the slider now spanning up to 12 ticks —
the tick-thinning CSS handles ≥6, but VERIFY legibility at 375px with
~12 and thin further if needed).

## Later, separate: PRRI identity layer

PRRI American Values Atlas county estimates offer the self-identification
construct (the "why isn't it higher?" complement). Different construct,
different metric labels, licence unverified — one-page addendum to this
playbook when wanted.
