# Revisions CLI

The first ingestion milestone is a local command-line tool named `pow`. It is
intended to validate research-assistant evidence batches and staged revision
events before any portal or backend writes exist.

## Current commands

```sh
cargo run -p pow-cli -- validate docs/templates/ra-historical-site-evidence/site_evidence_wide.csv
cargo run -p pow-cli -- stage docs/examples/revisions/nz-sample-change-events.jsonl
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
  ordering and required `payload_hash` values on accepted change events

## Intended next commands

The later pipeline should add:

```sh
pow diff <staged_batch_id>
pow accept <staged_batch_id>
pow rebuild-master
pow export nz --format geojson
```

Until `pow diff` exists, `pow validate` and `pow stage` are the safe handoff
points for RA evidence batches and agent-produced event proposals.

## Local staging store

The SQLite staging database stores:

- `stage_batches`: one row per staged file, including input path, format,
  SHA-256 checksum, byte count, validation summary JSON, and the raw input blob
- `stage_records`: parsed row or event records keyed by batch id and record
  index
- `validation_diagnostics`: warning and error diagnostics linked to the batch

This schema is deliberately plain SQLite. It should remain easy to inspect,
export, and migrate to another SQLite-compatible or server-backed store later.
