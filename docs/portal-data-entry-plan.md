# Portal Data Entry Plan

Planning source of truth: `PLANNING.md`.

Related designs:

- `docs/community-ingestion-api-plan.md`
- `docs/master-verification-workflow-plan.md`
- `docs/portal-entry-ui-plan.md`
- `docs/portal-database-storage-plan.md`
- `docs/portal-submission-review-plan.md`
- `docs/portal-auth-security-plan.md`
- `docs/portal-media-and-provider-evaluation-plan.md`

This document is the hub for the future contribution portal. It covers the
authenticated website path that will eventually replace the current "fix errors
in OSM" route for project data corrections, nominations, and source-backed
modifications.

## First Milestone

Build an invite-only New Zealand staging pilot.

The pilot should let trusted research assistants and reviewers submit proposed
site changes through a map interface without writing directly to the master
database. It should prove the full path from authentication to staged
submission, validation, reviewer decision, audit record, and dry-run master
change proposal.

Default choices:

- Use managed authentication, likely Google OAuth through Google Identity
  Platform.
- Use a Rust API on Cloud Run for validation, staging, review, and audit
  endpoints.
- Use Cloud SQL for PostgreSQL with PostGIS for staged submissions, review
  queues, audit records, and geospatial queries.
- Use Cloud Storage for immutable raw submissions and quarantined images.
- Keep GitHub as an optional audit or export mirror, not the review backend or
  source of truth.
- Defer Convex and SpacetimeDB evaluation until the submission, review, audit,
  and master-ingestion contracts are stable.
- Do not allow portal submissions, scripts, or AI agents to mutate the master
  database directly.

## Target Flow

```text
Global map
  - "Fix or modify data" action

        |
        v

Managed authentication
  - invite allowlist
  - provider-issued identity token
  - project permission scope

        |
        v

Authenticated edit map
  - global-map visual language
  - address and coordinate search
  - existing point selection
  - building selection where clear
  - point fallback for absent or ambiguous buildings

        |
        v

Staged submission form
  - proposed action
  - site identity and status evidence
  - source references
  - geometry source
  - optional quarantined image

        |
        v

Validation and review
  - schema and permission checks
  - geometry and duplicate checks
  - licence, privacy, and media checks
  - reviewer accept, reject, or request-more-info decision

        |
        v

Master change proposal
  - dry run
  - diff
  - audit manifest
  - accepted change event
```

## Component Plans

`docs/portal-entry-ui-plan.md` defines the contributor and reviewer map
experience: the login handoff, global-style map, search, building or point
selection, form ergonomics, and submit confirmation.

`docs/portal-database-storage-plan.md` defines the staging and storage baseline:
Cloud Run, Cloud SQL/PostGIS, Cloud Storage, immutable raw submissions, audit
tables, and provider-neutral contracts.

`docs/portal-submission-review-plan.md` defines review states, reviewer queue
behaviour, audit decisions, undo semantics, and the optional GitHub audit mirror.

`docs/portal-auth-security-plan.md` defines the security model: managed auth,
permission scopes, rate limits, validation, upload controls, quarantine, logs,
and launch gates.

`docs/portal-media-and-provider-evaluation-plan.md` defines image quarantine for
the pilot and records why Google Cloud is the reference backend while Convex,
SpacetimeDB, and Cloudflare remain later evaluation paths.

## Scope Boundaries

The pilot should not expose a public global write path. It should not treat an
accepted review decision as a silent master edit. It should not allow video
uploads in the first version. It should not use GitHub issues or pull requests
as the primary review queue.

The authenticated portal can use the current global map as its visual and
interaction reference, but the public static map should remain decoupled from
the staging backend. Public map layers should continue to consume reviewed,
exported products rather than live unreviewed submissions.
