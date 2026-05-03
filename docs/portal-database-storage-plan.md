# Portal Database And Storage Plan

Planning source of truth: `PLANNING.md`.

Portal hub: `docs/portal-data-entry-plan.md`.

Task-layer contract: `docs/convex-task-layer-spec.md`.

## Baseline

Use a split backend for the authenticated New Zealand staging pilot:

- Convex is the preferred near-term spike for live task-map and reviewer
  workbench state.
- Google Cloud/PostgreSQL/PostGIS/Cloud Storage remains the durable staging and
  storage reference when the project needs heavy geospatial checks, raw
  snapshots, quarantined media, or provider-neutral archival exports.

This split is pragmatic. The immediate RA problem is shared task coordination:
multiple users need to see assignments, provisional closures, evidence drafts,
and review decisions update live. Convex fits that surface. Canonical master
state, accepted events, and public map products still need reproducible exports
and should remain downstream of the Rust/R pipeline.

## Reference Architecture

```text
Authenticated browser
  -> Convex task/review backend
  -> live task map and reviewer workbench
  -> weekly or curator-triggered export
  -> pow validate/propose/diff/replay
  -> reviewed exports for static map and downloads

Durable staging/storage path when needed:
  -> Rust staging API on Cloud Run
  -> Cloud SQL PostgreSQL/PostGIS
  -> Cloud Storage quarantine and raw snapshots
  -> reviewed exports for static map and downloads
```

Convex should hold shared task records, task-event logs, evidence drafts,
reviewer comments, provisional closures, review decisions, role metadata, and
curator export manifests. Cloud Run should host Rust services when validation,
heavy geospatial checks, export verification, or master-rebuild integration need
HTTP endpoints. Cloud SQL/PostGIS should hold durable staged submissions,
geometry references, and audit records only when Convex is not sufficient for
those responsibilities. Cloud Storage should hold immutable raw submission
payloads, source exports, quarantined images, and reviewed public derivatives
where publication is permitted.

## Data Boundary

The portal backend is a governed staging layer for the master database.

Minimum persisted record groups:

- contributor and permission records
- shared task records and task-event logs
- evidence drafts and linked spreadsheet/source row ids
- submission batches and raw payload snapshots
- staged site proposals
- staged source and evidence references
- geometry selections and geometry basis
- quarantined media references
- validation results
- review decisions
- master change proposals and dry-run diffs
- export manifests and checksums

Accepted submissions should become reviewed change proposals. A separate master
ingestion job should dry-run, diff, and apply accepted changes through audited
events.

For the Convex spike, "accepted" should mean accepted for export into the `pow`
pipeline, not accepted directly into the master.

## Provider-Neutral Contracts

Keep the contracts portable:

- use OpenID Connect identity claims rather than provider-specific account state
- store geometries as PostGIS types with GeoJSON export support
- store object references as URI plus checksum, not as provider-only handles
- export reviewed products as CSV, GeoJSON, metadata JSON, vector tiles, or
  GeoParquet as appropriate
- keep raw snapshots immutable and addressable by manifest
- avoid making GitHub, Google Sheets, Convex, or SpacetimeDB the only readable
  form of a submission
- make Convex exports explicit enough that the same accepted task/review state
  can be replayed by `pow` without calling Convex

## Public Map Separation

Public static map products should consume reviewed exports. The authenticated
portal can query staging data live, but public layers should not display
unreviewed submissions unless they are explicitly marked as moderated community
content in a later release.
