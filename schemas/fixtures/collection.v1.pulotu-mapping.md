# Pulotu under collection.v1 — mapping exercise (2026-08-29)

Under the unit-of-analysis ruling (JB, 2026-08-29) Pulotu is the case that stands *outside* the places-of-worship family: its units are cultures, not sites, so it declares `meta.units_are_places_of_worship: false` and the never-merge rule keeps it out. The mapping below therefore also serves as the worked example of a non-PoW collection.

Exercise only: the live product `apps/regions/_shared/data/pulotu_cultures.geojson` is NOT converted; the runtime's hardcoded Pulotu path keeps reading it until the collections generalisation lands. This note records that the contract can express the product, and where the two shapes differ.

## What maps directly

| Pulotu product | collection.v1 |
|---|---|
| feature `culture_id` | `properties.unit_id` |
| feature `name` | `properties.name` |
| Point geometry | `geometry` (Point) |
| `values.<var>` `{code, label, sources}` | `properties.values.<metric_id>` `{code, label, sources}` |
| `values.dominant_world_religion.denomination_taxonomy_code` | `properties.values.<metric_id>.taxonomy_code` |
| `time_focus.traditional_state.year` / `.contemporary.year` | `properties.anchors.{traditional, current}` |
| `record_url` | `properties.record_url` |
| cultures are not sites | `meta.units_are_places_of_worship: false` (no `pow_site_ref` slot required) |
| `country_iso2` (derived modern-country tag) | `properties.country_iso2` |
| three time layers (Traditional / Post-contact / Current) | `meta.temporal_model {kind: stages, axis: ordinal, stops: [{id, label} × 3]}` |
| curated variables | `meta.metrics[]` with `kind: cat`, `codes[]`, and `stage_id` binding each metric to its stop |
| CC BY 4.0 credit (hardcoded in region-map.js L4684-4692 today) | `meta.credit` |

## What the exercise revealed (contract additions it forced)

1. **`values{}` beside `series{}`.** Pulotu units carry one coded state per variable with per-value sourcing, not year series. The first contract draft had only `series`; the mapping forced a `values` property (metric-id keyed `{code, label, sources, taxonomy_code}`). Stages renderers read `values`; interval renderers may too (Woodberry `tradition`).
2. **`anchors{}`.** Each culture declares its own calendar dates for the ordinal stops (traditional focus 1521–1983, contemporary mostly 2014–2020). Unit-level `anchors` carries them; the legend states that anchors are per-unit.
3. **`stage_id` on metrics.** The Pulotu metric select repopulates per active time point; the contract needed a metric→stop binding.
4. **`country_iso2` as a typed unit field.** Pulotu already computes a derived modern-country tag per culture, and country pages filter a global product on it; JB ruled on 2026-08-29 that the field be typed now rather than carried in `extensions`.

## What the ruling adds for this product

Each culture's time extent comes from its `anchors` (traditional and contemporary foci), which satisfies the time-extent invariant without a calendar interval. Every Pulotu culture is placed, so the null-geometry rule never bites here; the rule is aimed at the Anglican prototype's 344 unplaced parishes, which under the ruling belong in the portal's matching queue rather than a permanent tray.

## What the product lacks that the contract requires

The live geojson has no `meta` block at all: no collection_id, construct line, credit, source_datasets, temporal_model, or metric registry — all of that lives hardcoded in `region-map.js`. Conversion is therefore purely additive (wrap features, add meta), which is exactly the migration the collections build performs behind the `collections.pulotu` shim.
