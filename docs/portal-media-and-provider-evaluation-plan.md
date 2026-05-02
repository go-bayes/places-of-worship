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

## Google Cloud Baseline

Use Google Cloud as the first backend baseline.

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

## Deferred Providers

Do not evaluate Convex or SpacetimeDB deeply before the project has stable
submission, review, audit, and master-ingestion contracts.

SpacetimeDB is promising because it is Rust-oriented, transactional, realtime,
and compatible with OpenID Connect authentication. It may be worth a later spike
if the portal needs collaborative realtime state or reducer-style governed
updates.

Convex is promising for rapid realtime application development and supports
OpenID Connect-based authentication and file storage. It may be worth a later
spike if the review interface needs rapid app iteration that outweighs the
project's Rust-first backend preference.

Cloudflare remains useful to track as an alternate edge, access, and object
storage path, especially for static hosting, access policy, R2 storage, Images,
or Stream. It should not displace the Google baseline unless it solves a
specific operational problem better.

Reference docs:

- SpacetimeDB authentication:
  https://spacetimedb.com/docs/1.12.0/core-concepts/authentication/
- SpacetimeDB modules:
  https://spacetimedb.com/docs/modules/
- Convex authentication:
  https://docs.convex.dev/auth
- Convex file storage:
  https://docs.convex.dev/file-storage
- Cloudflare Access identity providers:
  https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/
- Cloudflare R2:
  https://developers.cloudflare.com/r2/
