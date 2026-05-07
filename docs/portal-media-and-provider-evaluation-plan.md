# Portal Media And Provider Evaluation Plan

Planning source of truth: `PLANNING.md`.

Portal hub: `docs/portal-data-entry-plan.md`.

## Media Policy

The first portal pilot should allow image uploads only for invited users, and
only into private quarantine. Video should be deferred.

Images can substantially improve the qualitative public experience later, but
they also introduce security, privacy, moderation, licence, and storage risks.
The pilot should prove that the project can receive and review images safely
before any media faces the public.

Minimum image metadata:

- submission id
- contributor id
- upload timestamp
- original filename, stored separately from public display name
- content type
- file size
- checksum
- storage URI
- scan status
- licence status
- privacy status
- review status
- public derivative URI, if approved

Public display should use reviewed derivatives, not original uploads. Strip
metadata such as EXIF where feasible before publication.

## Google Cloud Durable Staging Baseline

Use Google Cloud as the durable staging and storage reference, especially for
private media quarantine, geospatial staging, and provider-neutral archival
exports. Convex is the near-term backend spike for live task-map state, not for
quarantined media or canonical master storage.

Rationale:

- Google Identity Platform supports federated identity providers, OAuth 2.0,
  OpenID Connect, and multi-factor authentication paths.
- Cloud Run can run containerised Rust services without committing the project to
  a bespoke server platform.
- Cloud SQL for PostgreSQL supports PostGIS, which fits staging and review
  geometry needs.
- Cloud Storage supports private object storage and time-limited signed access
  patterns for uploads or downloads.
- The ecosystem is mature enough for a long-lived research infrastructure
  project.

Useful reference docs:

- Google Identity Platform:
  https://docs.cloud.google.com/identity-platform/docs/concepts-authentication
- Cloud Run:
  https://docs.cloud.google.com/run/docs
- Cloud SQL PostgreSQL extensions and PostGIS:
  https://docs.cloud.google.com/sql/docs/postgres/extensions
- Cloud Storage signed URLs:
  https://docs.cloud.google.com/storage/docs/access-control/signed-urls

## Provider Direction

Convex is no longer deferred for the task-map layer. It is the preferred
near-term spike for shared live RA/reviewer state: assignments, provisional
closures, evidence drafts, reviewer comments, review decisions, and curator
queues. The spike must still export reviewed task state into the Rust/R
validation and rebuild path, and it must not publish directly to the master or
public maps.

SpacetimeDB is promising because it is Rust-oriented, transactional, realtime,
and compatible with OpenID Connect authentication. It may be worth a later spike
if the portal needs collaborative realtime state or reducer-style governed
updates.

Google Cloud/PostgreSQL/PostGIS/Cloud Storage remains the durable staging,
geospatial storage, media quarantine, and provider-neutral export reference if
the task-map pilot needs responsibilities beyond Convex coordination.

Cloudflare is not part of the active storage plan. Revisit it only if the user
explicitly reopens that provider choice for a specific operational problem.

Reference docs:

- SpacetimeDB authentication:
  https://spacetimedb.com/docs/1.12.0/core-concepts/authentication/
- SpacetimeDB modules:
  https://spacetimedb.com/docs/modules/
- Convex authentication:
  https://docs.convex.dev/auth
- Convex file storage:
  https://docs.convex.dev/file-storage
