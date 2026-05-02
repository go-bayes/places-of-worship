# Schemas

JSON Schemas that define the core data structures used across the project.

- organisation.schema.json: organisation-level metadata.
- area-summary.schema.json: area-level portal/download product.
- change-event.schema.json: append-only staged or accepted revision event.
- geometry-history.schema.json: time-bounded site or structure geometry state.
- indicator.schema.json: reusable indicator definitions.
- indicator-observation.schema.json: indicator values attached to spatial and
  temporal units.
- site.schema.json: place-of-worship site record.
- source-dataset.schema.json: provenance for source datasets.
- structure.schema.json: physical structure details.
- visual-layer.schema.json: map and portal layer metadata.

Keep these schemas versioned and update them before changing any dataset shape
that depends on them.
