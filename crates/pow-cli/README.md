# `pow`: Places Of Worship Data Revision Tooling

`pow` (binary name `pow`, crate `pow-cli`) is the command-line half of the RA evidence and review pipeline. Run it with `cargo run -p pow-cli --` from the repository root, or build once and use `target/debug/pow`/`target/release/pow` directly. Every subcommand accepts `--report text` (default) or `--report json` where noted; a report format is not accepted by subcommands that do not produce one (`propose`).

## Commands

| Command | Purpose |
| --- | --- |
| `pow validate <input>` | Validate an RA evidence CSV or a revision JSON/JSONL file against the schemas in `schemas/`. `--for-public-export` applies the extra gates required before public map or download export. |
| `pow stage <input>` | Validate and write a batch into the local SQLite staging database (`.pow/staging.sqlite` by default). |
| `pow propose <batch_id>` | Emit draft change-event JSONL from a staged RA evidence batch; `--persist` also stores the events as a derived stage batch for `pow diff`. |
| `pow diff <batch_id>` | Render a reviewer report for a batch of staged or proposed change events. |
| `pow object hash \| verify` | Hash or verify a content-addressed review object (see below). |
| `pow export verify <dir>` | Verify a materialised frozen export bundle (see below). |

## `pow object`: The Canonical Hash Contract

`pow object` is the Rust half of the cross-language `pow-object.v1` / `pow-canonical-json.v1` hash contract described in `docs/development/evidence-versions.md`. The TypeScript reference lives at `convex/lib/canonicalJson.ts`; both implementations canonicalise with [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785) and are checked against the same fixtures in `schemas/fixtures/`.

```sh
cargo run -p pow-cli -- object hash path/to/document.json
cargo run -p pow-cli -- object verify path/to/evidence-version.json --report json
```

- `object hash` reads a JSON document, canonicalises it (rejecting anything outside the `pow-canonical-json.v1` domain: NaN/Infinity, duplicate member names, lone surrogates, trailing data), and prints its object hash, `sha256:` followed by the lowercase hex SHA-256 digest of the canonical bytes.
- `object verify` treats the input as a content-addressed envelope: it recomputes `object_hash` with that member removed (using the same canonicalisation), checks every required envelope member (`hash_contract`, `object_type`, `schema_version`, `logical_id`, `created_by`, `recorded_at`, `payload`, `parent_object_hashes`), and, for an `evidence_version` envelope, checks the payload's set-like ordering rules (`payload.occupancies` sorted and de-duplicated by `(segment_index, occupancy_id)`). It collects every failure rather than stopping at the first, and exits non-zero when the envelope is invalid.

Both subcommands are implemented in `crates/pow-cli/src/canonical.rs` (`object_hash`, `canonical_json`, `verify_envelope`).

## `pow export verify`: Frozen Export Bundles

`pow export verify <dir>` checks a materialised `pow-export-bundle.v1` directory (the output of `scripts/materialise_convex_export.py`) against its own frozen manifest, `export_manifest.json`, per `docs/development/frozen-exports-brief-2026-09-12.md` section 7.

```sh
cargo run -p pow-cli -- export verify exports/convex-roundtrip/<export_batch_id> --report json
```

It refuses a draft preview (a manifest with no `frozen_at` or `manifest_hash`) and, for a frozen bundle, runs six check groups, each error naming the offending file and value:

1. **Manifest**: `bundle_contract` is `pow-export-bundle.v1`, `hash_contract` is `pow-object.v1`, and `manifest_hash` reproduces from the manifest (with that member removed) via the same `canonical::object_hash` used by `pow object hash`.
2. **Files**: `files[]` is sorted by filename with no duplicates and never lists `export_manifest.json`; every listed file exists on disk with the declared `sha256` and `byte_length`; every other regular file in the directory (other than `SHA256SUMS`) is reported as not part of the bundle.
3. **Record counts**: `record_count` matches the file's JSONL line count, or its CSV data-row count with quoted newlines respected.
4. **Membership**: the `task_id` set in `tasks.jsonl` equals `included_task_ids`; the `review_decision_id` set in `review_decisions.jsonl` equals `included_review_decision_ids`; the `acceptance_id` set in `task_acceptances.jsonl` is a superset of `included_acceptance_ids`; every draft's `task_id` and every decision's `evidence_draft_id` name a row in the bundle.
5. **Pins**: each row of `evidence_versions.jsonl` is the stored Convex document, not a bare envelope: it wraps the `evidence-version.v1` envelope as a JSON string in `envelope_json`. That inner envelope is verified under the same envelope checker as `pow object verify`, and the row's own top-level `object_hash` must agree with the verified envelope's `object_hash`. A decision's `evidence_version_hash` matches its draft's, and names an envelope actually present (by verified `object_hash`) in `evidence_versions.jsonl`; the sorted set of verified envelope hashes equals `evidence_version_hashes`. A decision's `review_snapshot_hash` names a row in `review_snapshots.jsonl`, and the sorted set of `snapshot_hash` values equals `review_snapshot_hashes`. The snapshot hash itself is `sha256` over an older, pre-RFC-8785 `canonicalJson` form that this crate has never implemented; its content is reported as "not recomputed" (an informational note, not an error), and only its presence and cross-references are checked.
6. **Acceptance**: only the latest `accepted` row per task (greatest `created_at`, ties broken by `_creationTime`) carries export authority, matching `createExportBatch` in `convex/exports.ts`. An earlier `accepted` row that a later PI return and a fresh review superseded is retained history, not a live claim, so it is not checked. For every task in `included_task_ids`, that one latest accepted row must name a decision that is `accepted_for_export`, whose draft is `accepted_for_export`, whose task is `exported` or `pi_accepted`; a task with no accepted acceptance at all is its own error ("task has no accepted acceptance").

Implemented in `crates/pow-cli/src/export.rs`, which also carries the Rust test suite (one passing bundle and one failing case per check group, built from in-memory rows in a temp directory per test).
