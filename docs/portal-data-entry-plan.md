# Portal Data Entry Plan

Public direction: `ROADMAP.md`. Detailed active planning and governance records are maintained in the private research tier.

Related designs:

- `docs/community-ingestion-api-plan.md`
- `docs/convex-task-layer-spec.md`
- `docs/master-verification-workflow-plan.md`
- `docs/portal-entry-ui-plan.md`
- `docs/portal-database-storage-plan.md`
- `docs/portal-submission-review-plan.md`
- `docs/portal-auth-security-plan.md`
- `docs/portal-media-and-provider-evaluation-plan.md`
- `docs/field-observation-packet-spec.md`

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

- Use managed authentication, likely an OpenID Connect-compatible provider with
  Google sign-in for the RA pilot.
- Spike Convex as the first live backend for shared task-map and reviewer
  workbench state: assignments, provisional closures, evidence drafts,
  reviewer comments, review decisions, and curator queues.
- Export reviewed Convex state weekly, or on curator request, into the Rust
  validation, proposal, diff, replay, and research-output path.
- Keep Google Cloud/PostgreSQL/PostGIS/Cloud Storage as the durable staging,
  geospatial storage, media quarantine, and provider-neutral export reference
  if the pilot needs responsibilities beyond Convex task coordination.
- Keep GitHub as an optional audit or export mirror, not the review backend or
  source of truth.
- Defer SpacetimeDB evaluation until task/review contracts are stable or a
  Rust-first realtime backend becomes a concrete need.
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
  - exact denomination or tradition label, label basis, and provisional relation to the project record
  - direct observation, interpretation, and uncertainty
  - source references
  - geometry source
  - optional internal field-observation packet when separately enabled

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

`docs/convex-task-layer-spec.md` defines the near-term live task-map backend:
Convex-owned task state, evidence drafts, review decisions, curator exports,
security boundaries, and the export contract to `pow`.

`docs/portal-database-storage-plan.md` defines the split backend direction:
Convex for live task/review state, with Cloud Run, Cloud SQL/PostGIS, Cloud
Storage, immutable raw submissions, audit tables, and provider-neutral contracts
retained for durable staging and storage when needed.

`docs/portal-submission-review-plan.md` defines review states, reviewer queue
behaviour, audit decisions, undo semantics, and the optional GitHub audit mirror.

`docs/portal-auth-security-plan.md` defines the security model: managed auth,
permission scopes, rate limits, validation, upload controls, quarantine, logs,
and launch gates.

`docs/portal-media-and-provider-evaluation-plan.md` defines the private-upload invariant and image quarantine for the pilot. Every later permitted image, PDF, spreadsheet, CSV, GeoJSON, or other file enters private project-controlled quarantine and remains private. File input remains disabled until the advertised types have authenticated upload, validation, safe processing, restricted review, retention, and deletion. The plan also records why Convex is the near-term task-map spike while Google Cloud/PostGIS remains the durable storage reference. SpacetimeDB is deferred, and Cloudflare is not in the active plan.

`docs/field-observation-packet-spec.md` defines the measurement object for internal images and guided dictation: capture evidence remains distinct from an observer account, provisional claims, review decisions, and accepted events.

## Scope Boundaries

The pilot should not expose a public global write path. It should not treat an
accepted review decision as a silent master edit. It should not allow video
uploads in the first version. It should not use GitHub issues or pull requests
as the primary review queue.

The authenticated portal can use the current global map as its visual and
interaction reference, but the public static map should remain decoupled from
the staging backend. Public map layers should continue to consume reviewed,
exported products rather than live unreviewed submissions.
