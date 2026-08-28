# Portal Media And Provider Evaluation Plan

Public direction: `ROADMAP.md`. Detailed active planning and governance records are maintained in the private research tier.

Portal hub: `docs/portal-data-entry-plan.md`.

## Media Policy

### Private upload invariant

Every file type later permitted by a portal must enter private project-controlled quarantine and remain private. The invariant applies to field images, HEIC or JPEG originals, PNG files, PDFs, spreadsheets, CSV or GeoJSON files, and any later allowlisted format. Allowing a type means that the private intake service can validate, scan, retain, restrict, review, and delete that type; it never means that the file may be stored in Git, Convex, a public bucket, a public derivative path, or a public export. Any future public derivative requires a new explicit publication decision, rights and privacy review, and its own export contract.

The portal must not expose a file input until authenticated private upload, quarantine, type and size validation, safe processing, audit events, restricted review access, retention, and deletion are operational for every advertised type. A configured MIME type, extension, or client-side metadata result is never sufficient validation. Bulk selection may improve contributor ergonomics, but each object remains independently identified, checksummed, validated, and reviewable; the first image pilot should accept multiple individual files rather than an unrestricted archive.

The first portal media pilot should allow internal image evidence only for invited users and only through private quarantine. Video should be deferred.

Images are internal evidence by design, not prospective public content. The pilot should prove that an image plus a guided, observer-confirmed account improves verification without weakening privacy, cultural governance, licensing, or measurement accuracy. It must not create a public media bucket, anonymous media endpoint, public derivative, public URL, or media field in public exports.

Minimum image metadata:

- submission id
- contributor id
- device or image capture time and timezone provenance
- portal capture time, server receipt time, and observer-confirmed time
- image metadata coordinates, one-time browser location and accuracy, expected task coordinates, discrepancy, provenance, and confidence
- original filename, restricted from routine display
- content type
- file size
- checksum
- cloud storage path or Drive file ID
- scan status
- licence status
- privacy status
- review status
- restricted original path or file ID
- internal review derivative path or file ID
- sensitivity and access state

The immutable original should retain its checksum and acquisition metadata in restricted storage. An internal review derivative may correct orientation and reduce size, but it should omit unnecessary embedded device metadata and expose relevant time and location through the controlled reviewer interface. Retention does not imply broad access; exact time or location may require restriction.

Convex may hold an opaque observation or media identifier, workflow state, guided text, and review events. It must not hold uploaded file bytes, image thumbnails, document derivatives, original filenames, full EXIF or document metadata payloads, durable signed URLs, exact restricted coordinates, or audio.

The first dictation pilot should use device dictation into separately prompted text fields. The contributor must review and correct the transcript before submission, and the project should not claim on-device-only processing without verifying the actual devices and settings.

The complete evidence-object and pilot contract is in `docs/field-observation-packet-spec.md`.

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
