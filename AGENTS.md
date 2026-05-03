# AGENTS.md

## Scope

- Applies to the `places-of-worship` repository.
- Direct user requests take precedence over this file.
- This is the canonical repo-local agent guidance. Do not create or rely on a
  repo-root `CLAUDE.md`.
- Use New Zealand English.

## Where To Look

- `ROADMAP.md`: high-level phases, non-goals, and long-horizon direction.
- `PLANNING.md`: active design, priorities, next steps, and open questions.
- `JOURNAL.md`: decisions and rationale that should be traceable later.
- `CHANGELOG.md`: durable progress. Update it for user-visible docs, schemas,
  scripts, data products, or deployment behaviour.
- `CRITIQUE.md`: review notes that motivated the revision-event pipeline.
- `schemas/`: data contracts. Update schemas before changing dependent shapes.
- `docs/ra-nz-pilot-task.md`: current RA-facing task instructions for the
  time-bounded New Zealand web/map-first pilot.
- `docs/ra-map-triage-guide.md`: RA-facing map-to-spreadsheet triage
  instructions for missing sites, duplicates, disappeared sites, priority
  tasks, and target-year states.
- `docs/development/`: implementation-facing CLI, staging, and proposal
  mapping notes. Keep these out of the default RA task path unless explicitly
  requested.
- `docs/templates/ra-historical-site-evidence/`: RA evidence-entry templates.
- `docs/master-verification-workflow-plan.md`: master verification and review.
- `docs/portal-data-entry-plan.md`: authenticated portal planning hub.
- `research/`: lightweight country-source feasibility notes only.
- `grant/`: ignored local reporting reference; do not commit it.
- The repository is not currently accepting external pull requests while the
  data contracts, RA validation workflow, and map products are still
  stabilising. Do not recreate `CONTRIBUTING.md` unless the user explicitly
  reopens GitHub contribution.
- GitHub Issues, Discussions, and Wiki are intentionally disabled during the
  pilot. `main` is protected against force-pushes and deletion, but direct
  maintainer commits remain acceptable for small, reviewed changes.

## Core Model

- The project maps places of worship in space and time.
- The lowest-level analytical unit is a mappable site with worship-function
  state, not merely a building record.
- Functional changes are data: appeared/disappeared worship use, denomination
  changes, multi-denominational use, multi-purpose use, shared buildings, and
  split or merged worship uses must be preserved with evidence and time bounds.
- `site_id` tracks the mappable place. Moving congregations normally create a
  new `site_id` linked by relocation and organisation evidence.
- New Zealand is the proof-of-concept country, not the universal template.

## Stack Defaults

- Research-facing pipelines and analysis: R.
- Governed data modification: Rust (`pow validate`, `pow stage`, later diff,
  review, replay, and export).
- Python: support/API tooling only; use `uv`.
- Frontend: static HTML/CSS/JavaScript map products until a secure backend is
  ready.
- Backend baseline for the portal: managed auth plus Rust API and staged
  storage; no direct master writes from public or RA interfaces.
- Defer web-based data management until `pow` validation, staging, diff, review,
  replay, and export contracts are stable.

## Working Rules

- Keep large, restricted, raw, or private data out of Git unless the repo
  already tracks that class of artefact and the licence permits it.
- Preserve source provenance: name, URL or file reference, licence, retrieval
  date, access limits, and source notes where possible.
- Treat incoming data as untrusted until validated, reviewed, and accepted
  through staging.
- Validate generated JSON, GeoJSON, manifests, schemas, review queues, and area
  summaries before replacing existing artefacts.
- For frontend changes, test the affected map page in a browser and check tiles,
  controls, legends, popups, and overlays.

## Agent And PR Coordination

- Prefer one focused branch or pull request from current `origin/main`.
- Do not stack pull requests unless the user explicitly asks for a stack.
- If a stack is necessary, state the stack order, base branch, changed files,
  and test plan in each pull request. After a lower branch is squash-merged,
  rebase or otherwise restack the next branch onto current `main` and retarget
  it before merge.
- Give agents narrow, non-overlapping ownership. A useful default is: one agent
  drafts an implementation PR; another performs a read-only review.
- Do not mix implementation and review on the same files at the same time
  unless the user asks for that coordination explicitly.

## Useful Commands

- Rust checks: `cargo fmt --all`, `cargo test`, `cargo clippy --all-targets -- -D warnings`.
- Python setup: `uv sync`; run scripts with `uv run <script>`.
- API prototype: `uv run uvicorn api.main:app --reload`.
- R scripts: run from the repo root unless the script documents another working
  directory.
