# Schemas

JSON Schemas that define the core data structures used across the project.

- organisation.schema.json: organisation-level metadata.
- area-summary.schema.json: area-level portal/download product (legacy
  generations validate against this base schema).
- area-summary.v2.schema.json: the area-summary.v2 contract — structured
  per-row composition and optional service_url, declared-version validated.
- collection.v1.schema.json: the collection.v1 contract — a dated map
  collection (mission stations, cultural reconstructions, parish series):
  units with nullable point locations, dated presence with the
  site_lifespan_v1 basis vocabulary, metric series or coded state values,
  person tenures, and a collection passport (construct, credit,
  temporal_model, metric registry). Supersedes the prototype contract
  pow.unit-time-series.v1, whose consumer (the NZ Anglican parish feed) is
  being migrated to emit collection.v1. Defined 2026-08-29; first consumer
  pending (the VU Woodberry mission collection; the Pulotu product converts
  behind a shim when the collections runtime lands). Fixture and Pulotu
  mapping note under fixtures/; gated by scripts/validate_collections.sh.
  Under the unit-of-analysis ruling (2026-08-29), a collection declaring
  units_are_places_of_worship true is a governed view of site-level
  indicator observations inside the places-of-worship family, and carries a
  pow_site_ref slot on every unit; false marks units that are genuinely
  something else (Pulotu cultures). Attributes extend by declared metric,
  never by schema change. One known drift against indicator.schema.json:
  collection.v1 closes the unit enum (count, percent, rate, currency, code,
  year) where indicator.schema.json leaves unit an open string whose
  examples (places_per_10000_residents) name a whole indicator rather than a
  unit. The closed enum is the ruled position (2026-08-29), so
  indicator.schema.json should give way when that aspirational schema next
  gains a consumer.
  person_names_public governs publication, not retention: false means names
  must not be rendered on any public surface, while a private or
  access-controlled feed may still carry name for audit. The schema permits
  name under either setting deliberately. Stripping names from a private
  feed protects nobody — the protection comes from not rendering them — and
  destroys the audit trail.
  Known gap list for a future collection.v2, banked from the Anglican
  migration (pow-research 5f101a9, 941 features validating with no errors):
  the migration had to carry diocese, lifecycle events (kind, verbatim
  source_text, date_precision, source page), wave presence, aliases, matched
  place name, and collection-level counts in extensions, because the
  standalone renderer reads them and no typed field exists. They stay in
  extensions while the series engine mode is deferred; type them in v2 if
  that mode lands. The tenure item gained its own extensions object in v1
  because its absence forced a real data compromise — a starred marker had
  to be folded into the source string.
- change-event.schema.json: append-only staged or accepted revision event,
  including worship-function state changes needed for `pow diff`.
- data-manifest.schema.json: checksummed data artefact manifest for local cache,
  durable storage, global partitions, and supersession tracking.
- denomination-taxonomy.schema.json: contract for the versioned religion and
  denomination vocabulary (aspirational: no validator consumes it yet; the
  instance below is read directly by builders).
- denomination-taxonomy.json: the versioned vocabulary instance itself (not a
  schema). Change events pin its `taxonomy_version`; update it by publishing a
  new version with supersession links, never by editing codes in place.
- geometry-history.schema.json: time-bounded site or structure geometry state.
- indicator.schema.json: reusable indicator definitions (aspirational: no
  consumer yet).
- site.schema.json: place-of-worship site record.
- source-dataset.schema.json: provenance for source datasets (aspirational:
  no consumer yet; manifests carry provenance under data-manifest.v2).
- structure.schema.json: physical structure details.
- visual-layer.schema.json: map and portal layer metadata (aspirational: no
  consumer yet).

Keep these schemas versioned and update them before changing any dataset shape
that depends on them. Schemas marked aspirational (audit of 2026-08-25) have no
validator or builder reading them; either wire a consumer or retire them when
the relevant lane next opens.

## data-manifest.v2 (2026-07-11)

The manifest schema moved from `data-manifest.v1` to `data-manifest.v2`
after a full-corpus validation found 36 of 57 committed manifests failing
`v1` for dialect drift: builders had each evolved useful fields the strict
schema forbade. `v2` legitimises the information-bearing dialect and keeps
the contract strict everywhere it earns its keep. There are three parts to
the change.

The first part extends the schema. New optional top-level containers admit
the enriched provenance the builders already record: `construct_notes`,
`deferred_sources`, `derived_outputs`, `raw_sources`, `source_datasets`,
`target_years`, and a catch-all `extensions` object for builder-specific
extras relocated verbatim from the top level. `storage_provider` gains
`git_repository`; `pipeline.git_commit` may be null (not recorded);
`source` gains cache and licence-position fields; `stats` values may be
structured; durable files accept `notes` where older manifests lack
`content`; validation blocks accept structured gate evidence beyond the
typed keys.

The second part splits the licence contract. `licence_status` stays the
strict four-value shipping decision (`accepted`, `needs_review`,
`restricted`, `unknown`). The terms identity — the slug vocabulary the
builders evolved, such as `kogl_type_1_attribution` — moves to the new
`licence_basis` field at both the product and durable-file levels. The
2026-07-11 migration relocated every slug verbatim and derived each
decision value from the slug text; `accepted_by_jb_pending_ipums_confirmation`
maps to `needs_review`, matching the standing IPUMS hold.

The third part guards against recurrence. `bash pipeline/validate_manifests.sh`
(in the private research tier, alongside the manifests and builders it
validates) validates every manifest and exits non-zero on any failure; review
gates run it before any commit touching the manifests or a manifest-writing
builder. Builders were patched to emit the `licence_status`/`licence_basis`
pair (21 scripts); the Tuvalu, Saint Lucia, and Bangladesh builders were
re-run as round-trip proof. Residual: builders using the variable-threading
pattern regenerate the product-level basis but not every per-file basis;
the validator catches any such regeneration at gate time, and per-file
wiring is routine follow-up when a builder is next touched.

## area-summary validation state (2026-07-09)

Null is a legitimate value in three places, each meaning the release ships
no governed place-of-worship snapshot: `site_snapshot.source_dataset_id`,
`rows[].place_count`, and `rows[].place_count_basis`. The `site_snapshot`
block itself is required — every product states its place-layer position
explicitly, with the reason in `basis`.

**RULING (project lead, 2026-07-11, second sitting): area-summary.v2 plus
declared-version validation, per the data-manifest.v2 playbook above.**
Three parts. First, `area-summary.v2` extends the contract with ONE
structured, optional per-row `composition` field — an array of
`{label_verbatim, count or percent, optional taxonomy_code}` — the
canonical home for denominational composition: it legitimises the Vanuatu
rows after a small regeneration, replaces flag-string carriage, and puts
`denomination-taxonomy.json` to work. Free-form per-denomination row
fields stay forbidden; the NZ `service_url` is admitted as optional.
Second, products declare their `schema_version` and the validator
validates each file against the version it declares — the legacy
generations (Canada v1, US/Romania 0.2.0) validate against their declared
versions and upgrade to v2 opportunistically when their builders are next
touched, leaving the frozen US pipeline untouched under the IPUMS hold.
Third, the guard: a `validate_area_summaries.sh` twin of
`validate_manifests.sh`, declared-version-resolving, wired into the same
commit gates. Popup rendering of the composition field is a separate
runtime change with its own tag bump and commit. Implementation is the
next structural lane; until it lands, the failure list below stands as
the work order.

**STATUS (implemented 2026-07-12, structural lane):** `schemas/area-summary.v2.schema.json`
and `scripts/validate_area_summaries.sh` (declared-version-resolving) are in
place. The guard gates `area-summary.v2` products and reports legacy
generations as non-gating advisory against the base schema. Vanuatu was
regenerated under `area-summary.v2` (`scripts/build_vu_area_summary.R`): the
five denomination shares moved into the structured `composition` field with
source-verbatim labels and `denomination-taxonomy.json` codes (customary
beliefs has no code), and the previously-dropped required-but-nullable row
fields now emit as null. Both VU products pass; no data value changed. Per the
data-manifest.v2 playbook, v2 also legitimises the Vanuatu builder dialect the
strict schema forbade — optional top-level `data_status`/`data_status_note`,
date-time accepted for the row `site_snapshot_date` and source-dataset
`retrieval_date`, and (conductor ruling at the 2026-07-12 gate) the legacy
flat per-denomination `*_percent` row fields the shared runtime's metric
select currently reads — the gate caught the first regeneration dropping them,
which broke the live Vanuatu denomination metrics; they stay legitimate until
the runtime reads `composition` directly, then retire. These dialect
legitimisations extend the ruling's named additions under its "per the
data-manifest.v2 playbook" clause and stand open to the project lead's veto. Legacy products (Canada, US, Romania, and others) stay on
their declared versions and upgrade opportunistically.

A provisional v1 measurement-regime declarations table exists in the private research tier (generated from the manifests and area-summary metadata by the pipeline's `build_measurement_regime_table.R`, vocabulary alongside it); it has no schema contract pending the project lead's vocabulary review, and it (or a display-safe subset) returns to the public repo when the measurement-regime map view ships.

The pre-ruling record: a full validation of the 37 shipped country
products against `area-summary.schema.json` passes 23. The 14 failures
are structural generation differences, not data defects:

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
