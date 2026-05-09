# Brainstorming

This file is for ideas we are still kicking around. Some may become part of the
project; others may be useful only as comparisons or short experiments.

Use it when an option looks promising but still needs a price check, security
review, migration plan, or small prototype. Once we choose a direction, move the
actual decision into `PLANNING.md`, `ROADMAP.md`, or `JOURNAL.md`.

## Evaluation Principles

- Prefer tools that store project data in open, documented formats.
- Keep canonical research data outside tools that are hard to leave.
- Make the exit path explicit before adoption: how we export, who owns the
  data, what could replace the tool, and what would break during migration.
- Use narrow adapters around external services so the core workflow can move if
  a service changes.
- Check pricing, support, security, and data residency before relying on a
  hosted service for RA or reviewer work.
- Treat young or low-adoption packages as useful prototypes unless their role is
  easy to replace.
- Do not let presentation tools define research semantics. For this project,
  `pow` and the accepted change-event contracts define what changed.

## Current Candidates

### Graphite

Question:
Could Graphite help us organise small reviewed implementation changes and avoid
agent conflicts?

Current understanding, checked 2026-05-08:
Graphite sits on top of GitHub and helps people work with stacked pull
requests. Its command-line interface can create, stack, and submit pull
requests without leaving the terminal.

Useful roles:

- Coordinating stacks of small implementation pull requests when a larger
  change needs staged review.
- Keeping Claude, Codex, and human review work separated into narrow branches.
- Making stacked UI, backend, schema, and documentation work easier to inspect.

Limits:

- Graphite should not define data changes, accepted diffs, task status, or
  research provenance.
- The repository is still single-maintainer, and small direct commits to `main`
  remain efficient for low-risk changes.
- Stacked pull requests add process overhead if the change is already small.

Migration path:

- Keep GitHub branches, pull requests, commits, and tags as the durable record.
- Do not depend on Graphite-only metadata for project history.
- If Graphite is later removed, ordinary GitHub PRs and local Git commands
  should still be enough to continue.

References:

- <https://graphite.com/docs/cli-overview>
- <https://graphite.com/docs/initialize-in-a-repo>
- <https://graphite.dev/pricing>

Provisional stance:
Worth considering for multi-agent development coordination, especially if we
return to stacked UI/backend pull requests. Not needed for the research data
pipeline.

### JSON Diff And Tree Rendering Libraries

Question:
Should we use libraries such as `@pierre/diffs` and `@pierre/trees` for
reviewer-facing diff displays?

Current understanding, checked 2026-05-08:
`@pierre/diffs` computes differences between JSON-like values. `@pierre/trees`
renders tree views for JavaScript, JSX, and terminal output. Together they
could make structural changes easier to read.

Useful roles:

- Showing a reviewer a readable before/after tree for one proposed change.
- Debugging whether a Convex export matches the event batch that `pow` will
  validate.
- Rendering a compact CLI or web view of `pow diff` output.

Limits:

- Generic JSON diffs do not know site identity, worship-use status, target-year
  affects, denomination sets, source licences, or correction versus observed
  change.
- They may overemphasise structural noise and hide the analytical meaning of a
  change.

Migration path:

- First define a stable semantic `pow diff` JSON report.
- Use tree renderers only as replaceable views over that report.
- Keep reviewer decisions tied to event ids and payload hashes, not to a
  library-specific display.

References:

- <https://www.npmjs.com/package/@pierre/diffs>
- <https://github.com/pvolok/diffs>
- <https://www.npmjs.com/package/@pierre/trees>
- <https://github.com/pvolok/trees>

Provisional stance:
Good candidate for a small display experiment. Do not install it into the
production toolchain until `pow diff` has a stable JSON output to render.

### Convex

Question:
Can Convex serve the shared RA task map, provisional task closure, evidence
drafts, reviewer comments, and exports?

Useful roles:

- Shared online task status across RAs and reviewers.
- Authenticated evidence drafts and review actions.
- Live task-map state without building a full custom backend immediately.

Limits:

- Convex is not the master database.
- It should not store raw OSM archives, accepted diffs, public map products, or
  quarantined media as the durable record.
- Pricing, backups, identity, and export guarantees need review before the
  hosted pilot becomes important infrastructure.

Migration path:

- Export task events, evidence drafts, review decisions, and export batches to
  standard JSON/JSONL/CSV.
- Feed accepted exports into `pow` validation, staging, diff, replay, and map
  rebuilds.
- Keep the static map and `pow` path able to continue if Convex is replaced.

Provisional stance:
Preferred near-term shared task layer for the New Zealand RA pilot, with strict
boundaries.

### PostgreSQL/PostGIS

Question:
When do we need a durable spatial database instead of files plus Convex?

Useful roles:

- Queryable spatial staging and reviewer search.
- Heavier geospatial joins, nearby-duplicate detection, and boundary-aware
  review.
- A longer-term bridge toward a public API.

Limits:

- Higher operational burden than files, Drive, or Convex.
- Requires explicit decisions about backup, migration, access control, and
  hosting.

Migration path:

- Keep schemas and exports provider-neutral.
- Treat PostgreSQL/PostGIS as one implementation of the accepted data model,
  not the model itself.

Provisional stance:
Defer until reviewers need live spatial queries that files plus Convex exports
cannot support.

### Leptos Or Rust-First Web UI

Question:
Should the country-level maps or data-entry portal move toward a Rust-first web
stack?

Useful roles:

- Sharing validation types and logic with Rust services.
- Building a richer authenticated task and review interface later.

Limits:

- More setup than the current static map.
- Premature if task vocabulary, evidence row shape, review decisions, and
  backend responsibilities are still moving.

Migration path:

- Keep current map outputs as static GeoJSON/JSON consumers.
- Move one bounded surface at a time: task panel, evidence form, reviewer
  summary, then richer spatial editing.

Provisional stance:
Revisit after the Convex task layer and `pow` export loop have been tested with
real RA work.

## Open Questions

- Which tools should be tested as small spikes rather than adopted?
- Which parts of the workflow need hosted live state, and which can remain
  file-based?
- What must remain reproducible if a hosted service disappears?
- What evidence would justify adding another package manager or frontend stack?
- Which tool choices affect grant reporting, RA onboarding, or long-term data
  preservation?
