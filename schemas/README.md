# Schemas

JSON Schemas that define the core data structures used across the project.

- organisation.schema.json: organisation-level metadata.
- area-summary.schema.json: area-level portal/download product.
- change-event.schema.json: append-only staged or accepted revision event,
  including worship-function state changes needed for `pow diff`.
- data-manifest.schema.json: checksummed data artefact manifest for local cache,
  durable storage, global partitions, and supersession tracking.
- denomination-taxonomy.schema.json: contract for the versioned religion and
  denomination vocabulary.
- denomination-taxonomy.json: the versioned vocabulary instance itself (not a
  schema). Change events pin its `taxonomy_version`; update it by publishing a
  new version with supersession links, never by editing codes in place.
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

## area-summary validation state (2026-07-09)

Null is a legitimate value in three places, each meaning the release ships
no governed place-of-worship snapshot: `site_snapshot.source_dataset_id`,
`rows[].place_count`, and `rows[].place_count_basis`. The `site_snapshot`
block itself is required — every product states its place-layer position
explicitly, with the reason in `basis`.

A full validation of the 37 shipped country products against
`area-summary.schema.json` passes 23. The 14 failures are structural
generation differences, not data defects, and need a schema-versioning
ruling before they are reconciled:

- Canada (3 files): `area-summary.v1` row-array shape without the
  `boundary_set`/`source_datasets`/`indicators`/`visual_layers` blocks.
- US (6 files) and Romania (2): `0.2.0`-generation shape with extra
  top-level provenance fields and differing sub-object contracts.
- Vanuatu (2): the stray top-level `"1"` key and missing
  `schema_version`/`country_code` were fixed at the 2026-07-09 VU
  regeneration (loop-variable clobber in `build_vu_area_summary.R`).
  The remaining failure is a row-shape difference: the VU rows carry
  denomination-percent fields the schema does not admit and omit
  `NA`-valued fields the schema requires present-but-nullable. Same
  class as the US/Romania generation differences; awaiting the
  schema-versioning ruling.
- NZ SA2 (1): a single extra `service_url` property.
