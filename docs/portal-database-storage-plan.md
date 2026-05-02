# Portal Database And Storage Plan

Planning source of truth: `PLANNING.md`.

Portal hub: `docs/portal-data-entry-plan.md`.

## Baseline

Use Google Cloud as the first backend baseline for the authenticated New Zealand
staging pilot.

This choice is conservative. Google Cloud gives the project mature managed auth,
Rust-friendly container deployment, PostgreSQL/PostGIS, private object storage,
service accounts, and long-term operational durability. The design should still
use provider-neutral contracts so the project can migrate later if needed.

## Reference Architecture

```text
Authenticated browser
  -> Rust staging API on Cloud Run
  -> Cloud SQL PostgreSQL/PostGIS
  -> Cloud Storage quarantine and raw snapshots
  -> Pub/Sub or Cloud Tasks validation jobs
  -> reviewed exports for static map and downloads
```

Cloud Run should host the Rust API and any small validation or review services
that need HTTP endpoints. Cloud SQL/PostGIS should hold staged submissions,
review queues, contributor permissions, geometry references, and audit records.
Cloud Storage should hold immutable raw submission payloads, source exports,
quarantined images, and reviewed public derivatives where publication is
permitted.

## Data Boundary

The portal backend is a governed staging layer for the master database.

Minimum persisted record groups:

- contributor and permission records
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

## Public Map Separation

Public static map products should consume reviewed exports. The authenticated
portal can query staging data live, but public layers should not display
unreviewed submissions unless they are explicitly marked as moderated community
content in a later release.
