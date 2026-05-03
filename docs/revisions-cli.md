# Revisions CLI

The first ingestion milestone is a local command-line tool named `pow`. It is
intended to validate research-assistant evidence batches and staged revision
events before any portal or backend writes exist.

For a research-assistant walkthrough, see `docs/ra-cli-tutorial.md`.
For the staged CSV to draft event mapping, see `docs/ra-propose-mapping.md`.

## Current commands

```sh
cargo run -p pow-cli -- validate docs/templates/ra-historical-site-evidence/site_evidence_wide.csv
cargo run -p pow-cli -- stage docs/examples/revisions/nz-sample-change-events.jsonl
cargo run -p pow-cli -- propose <staged_batch_id>
```

This command is not intended to be called directly from the HTML map. The CLI is
the first local and CI-friendly validation surface for exported spreadsheets,
bulk files, and agent-produced event proposals. A future authenticated map
should submit to a backend API that reuses the same validation rules, stages
submissions, and returns reviewable proposal records. Static map pages should
consume reviewed exports only.

`pow stage` validates first. If the input has validation errors, no database
write is performed. Valid batches are written to `.pow/staging.sqlite` by
default. This file is local and ignored by Git.

The validator currently supports:

- RA evidence CSVs that match the templates in
  `docs/templates/ra-historical-site-evidence/`
- JSON or JSONL records with `schema_version` values for
  `change-event.v*` or `geometry-history.v*`
- controlled-vocabulary checks for the RA templates
- partial-date checks for CSV evidence dates (`YYYY`, `YYYY-MM`, or
  `YYYY-MM-DD`)
- latitude, longitude, probability, country-code, privacy, and licence checks
- JSON Schema validation against `schemas/change-event.schema.json` and
  `schemas/geometry-history.schema.json`
- first replay-safety checks that JSON Schema cannot express, including date
  ordering and bounded-date consistency
- schema-enforced `payload_hash` values on accepted change events and
  `taxonomy_version` values on denomination events

The change-event schema is still pre-release, so internal fixtures and tests may
change when the contract becomes clearer. We should not preserve awkward legacy
shapes merely for compatibility before `pow diff`, portal intake, or master
rebuilds exist.

Current schema decisions for `pow diff`:

- `site_created` records creation of a project site record; it does not by
  itself prove worship use began.
- `worship_use_appeared` and `worship_use_disappeared` record analytical
  worship-function onset and end, even when the building existed before or
  remains afterward.
- `denomination_added` and `denomination_removed` support concurrent
  multi-denominational site state. `denomination_changed` remains available for
  simple replacement events.
- `purpose_added` and `purpose_removed` support multi-purpose site state.
- `organisation_use_started` and `organisation_use_ended` record organisation
  use of a site separately from site identity and geometry.
- `target_year_affects` records which snapshot dates are affected by an event,
  so `pow diff` can report target-year state changes without inferring every
  consequence from prose.
- `date_precision` uses `bounded` for interval or one-sided date evidence.

## Intended next commands

The later pipeline should add:

```sh
pow accept <staged_batch_id>
pow rebuild-master
pow export nz --format geojson
```

`pow propose <staged_batch_id>` bridges real RA CSV evidence to draft
`change-event.v1` JSONL. It reads one staged batch, translates supported RA
template rows using `docs/ra-propose-mapping.md`, validates every generated
event, prints JSONL to stdout, and prints mapping warnings to stderr.

`pow propose --persist <staged_batch_id>` additionally writes the emitted
events back into the staging database as a derived batch (one stage record per
event with `record_kind = 'proposed_event'`). The new derived batch links to
its source via `stage_batches.parent_batch_id`. The derived batch id is
printed to stderr so the reviewer can pass it to `pow diff`.

`pow diff <batch_id>` produces a reviewer report for one batch of staged or
proposed change events (a derived batch from `pow propose --persist`, or any
batch staged directly as JSONL change events). It groups events by site,
renders per-site before/after using the schema's `previous_*` fields and
`target_year_affects`, aggregates per-target-year transitions, and reports
validation warnings and source coverage. Use `--report json` for a stable,
machine-readable artefact alongside the default text report.

The full RA → reviewer round-trip:

```sh
pow stage path/to/ra-batch.csv
# -> prints a `batch id`. Copy it.

pow propose <stage_batch_id> --persist
# -> prints draft JSONL events to stdout and a derived batch id to stderr.

pow diff <derived_batch_id>
# -> per-site changesets, per-target-year aggregate, warnings rollup.

pow diff <derived_batch_id> --report json > diff.json
# -> machine-readable artefact for downstream analysis.
```

`pow diff` v1 is intentionally narrow: it fails loudly on any
`worship_function_update` payload whose `target_year_affects` is empty, and it
will not infer target-year state from prose. It does not yet emit identity
decisions from `geometry-history` records.

Deferred until `pow rebuild-master` and export commands:

- `before.geojson` and `after.geojson` reconstructed snapshots
- `area_summary_diff.csv`
- density estimates
- full map-layer and download effects

## Local staging store

The SQLite staging database stores:

- `stage_batches`: one row per staged file, including input path, format,
  SHA-256 checksum, byte count, validation summary JSON, and the raw input blob
- `stage_records`: parsed row or event records keyed by batch id and record
  index
- `validation_diagnostics`: warning and error diagnostics linked to the batch

This schema is deliberately plain SQLite. It should remain easy to inspect,
export, and migrate to another SQLite-compatible or server-backed store later.
