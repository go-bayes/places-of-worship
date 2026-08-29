# Pulotu under collection.v1 — mapping exercise (2026-08-29)

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
| three time layers (Traditional / Post-contact / Current) | `meta.temporal_model {kind: stages, axis: ordinal, stops: [{id, label} × 3]}` |
| curated variables | `meta.metrics[]` with `kind: cat`, `codes[]`, and `stage_id` binding each metric to its stop |
| CC BY 4.0 credit (hardcoded in region-map.js L4684-4692 today) | `meta.credit` |

## What the exercise revealed (contract additions it forced)

1. **`values{}` beside `series{}`.** Pulotu units carry one coded state per variable with per-value sourcing, not year series. The first contract draft had only `series`; the mapping forced a `values` property (metric-id keyed `{code, label, sources, taxonomy_code}`). Stages renderers read `values`; interval renderers may too (Woodberry `tradition`).
2. **`anchors{}`.** Each culture declares its own calendar dates for the ordinal stops (traditional focus 1521–1983, contemporary mostly 2014–2020). Unit-level `anchors` carries them; the legend states that anchors are per-unit.
3. **`stage_id` on metrics.** The Pulotu metric select repopulates per active time point; the contract needed a metric→stop binding.
4. **`country_iso2` per feature** has no dedicated field: `meta.country_codes` lists the covered countries, and the runtime's country filtering would read a per-unit extension. If per-unit country filtering survives the generalisation, promote it from `extensions` to a typed field — one-line schema change, noted for the collections build (step 4).

## What the product lacks that the contract requires

The live geojson has no `meta` block at all: no collection_id, construct line, credit, source_datasets, temporal_model, or metric registry — all of that lives hardcoded in `region-map.js`. Conversion is therefore purely additive (wrap features, add meta), which is exactly the migration the collections build performs behind the `collections.pulotu` shim.
