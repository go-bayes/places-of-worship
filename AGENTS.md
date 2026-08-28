# AGENTS.md

## Scope

- Direct user requests take precedence over this file.
- Use New Zealand English.

## Where To Look

- HANDOVER (read first when conducting a work sitting):
  `~/GIT/pow-research/handover/` in the private tier. Start with the
  newest dated file (currently `handover-2026-08-22.md`); the earlier
  `pow-conductor-handover.md` carries the routing rulings, the project
  lead's blocking list, and the trap list, and the war log sits beside
  it as `pow-next-arc-global-databases.md`. These files travel with the
  private repo, so every machine with a `pow-research` clone has them;
  Claude memory directories are per-machine and no longer canonical.
- PRIVATE RESEARCH TIER (work-phase split, 2026-07-13): the research
  corpus lives in the private repo `go-bayes/pow-research`, cloned at
  `~/GIT/pow-research` — `research/` (build queue, probes, surveys),
  `manifests/`, `pipeline/` (area-summary builders, validators, lib),
  research-method docs, research playbooks, and the governance records
  (PLANNING, DECISIONS, JOURNAL, BRAINSTORMING, CRITIQUE). Research
  lanes read and write THERE; this public repo carries the map, the
  platform, and the RA-facing docs. Research-route detail never enters
  public commit messages or the public CHANGELOG.
- `ROADMAP.md`: high-level phases, non-goals, and long-horizon direction.
- `docs/system-map.md`: compact module map. Use it to place work inside the
  right part of the system before changing planning or task lists.
- `~/GIT/pow-research/PLANNING.md`: active design, priorities, next steps,
  and open questions (private tier).
- `~/GIT/pow-research/BRAINSTORMING.md`: tool and architecture ideas still
  being considered (private tier). Treat entries as options, not decisions,
  until they move into planning or the journal.
- `~/GIT/pow-research/JOURNAL.md`: decisions and rationale that should be
  traceable later (private tier). Write for collaborators and future
  readers, not as private agent instructions.
- `LEXICON.md`: plain-language project terms. Use it when editing reports,
  RA-facing docs, README copy, diagrams, and planning summaries.
- `docs/operational-definition.md`: stable public entry point for the current operational definition. Update this canonical page whenever the project adopts a revised definition, and preserve each adopted version as a dated snapshot under `docs/development/`. Link current instructions to the canonical page; link a dated snapshot only when a study or decision needs the historical rule. Keep every dated definition or discussion draft complete. Add supersession notices while retaining the original text.
- `CHANGELOG.md`: durable progress. Update it for user-visible docs, schemas,
  scripts, data products, or deployment behaviour. Add dated entries under
  `## Unreleased`, using ISO dates such as `### 2026-05-03`.
- `docs/documentation-health-check.md`: periodic staleness checklist for
  keeping README, roadmap, planning, FAQ, RA docs, storage docs, and Convex
  docs aligned.
- `docs/api/convex-functions.md`: human-readable inventory of Convex queries
  and mutations, their roles, and their workflow position.
- `docs/api/workflow-scripts.md`: human-readable catalogue of workflow-facing
  scripts that generate task seeds, RA workpacks, review exports, and `pow`
  handoff artefacts.
- `docs/ui-style-guide.md`: UI wording, status, colour, button, and form
  conventions for the map-first task interfaces.
- `~/GIT/pow-research/CRITIQUE.md`: review notes that motivated the
  revision-event pipeline (private tier).
- `~/GIT/pow-research/DECISIONS.md`: adjudicated standing rulings for the
  revisions pipeline, with rationale, what each forecloses, and the cost to
  reverse (private tier). Check it before reopening an identity, taxonomy,
  event-contract, or staging choice.
- `schemas/`: data contracts. Update schemas before changing dependent shapes.
- `docs/ra-nz-pilot-task.md`: current RA-facing task instructions for the
  time-bounded New Zealand web/map-first pilot.
- `docs/ra-map-triage-guide.md`: RA-facing map triage instructions for missing
  sites, duplicates, disappeared sites, priority tasks, target-year states, and
  the spreadsheet fallback.
- `docs/development/`: implementation-facing CLI, staging, and proposal
  mapping notes. Keep these out of the default RA task path unless explicitly
  requested.
- `docs/development/theme-primitives-to-research-maps.md`: ACTIVE porting
  brief for unifying the NZ research maps with the global map's design
  language (PLANNING.md step 31). Start here when asked to align the maps'
  look; it carries the primitives inventory, the live-pilot constraints,
  and the verification gotchas from the 2026-06-12/13 sessions.
- `docs/development/location-features-from-reliefmap.md`: HISTORICAL porting
  guide for the reliefmap location/UX features. The port completed on
  2026-06-13 and several features then deliberately diverged or were
  retired (strict near-me toggle, guide line on tap only, nearest banner
  removed) — see the dated `JOURNAL.md` entries. Do not rebuild inventory
  items from this guide without checking the journal first; its gotchas
  section remains useful.
- `~/GIT/pow-research/docs/development/adding-a-region.md`: how to add a
  country research map now that the country pages share one runtime
  (`apps/regions/_shared/region-map.js`) with thin per-country
  `REGION_CONFIG` loaders (private tier). UI changes happen once in
  `_shared/`; never add country-conditional logic to the module.
- `~/GIT/pow-research/docs/development/regional-map-consistency.md`:
  COMPLETED 2026-07-04 migration plan that unified the forked NZ/VU maps
  onto the shared runtime (private tier), with the parity-verification
  record and the link to `apps/regions/_shared/DRIFT-REPORT.md`.
- `docs/templates/ra-historical-site-evidence/`: RA evidence-entry templates.
- `docs/master-verification-workflow-plan.md`: master verification and review.
- `docs/portal-data-entry-plan.md`: authenticated portal planning hub.
- `docs/convex-task-layer-spec.md`: near-term Convex task-map backend contract
  for shared RA/reviewer task status, evidence drafts, review decisions, and
  exports to `pow`.
- `docs/data-storage-pipeline.md`: storage policy for local caches, durable
  project-controlled copies, tracked manifests, checksums, and provenance.
- `docs/development/convex-task-layer-setup.md`: maintainer setup notes for
  the Convex task-map backend scaffold, seeding static NZ tasks, and testing export
  boundaries.
- `convex/`: provisional task-map backend scaffold. It owns shared task status
  only and must not write to the master database or public map exports.
- `~/GIT/pow-research/research/`: country-source feasibility notes, the
  build queue, and probes (private tier; nothing research-shaped lands in
  this public repo any more).
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
- Accepted diffs are primary longitudinal data. Losses, gains, target-year
  states, density changes, and appeared/disappeared map layers must be derived
  from accepted change events and accepted-diff manifests, not from unreviewed
  snapshot comparisons alone.
- Use the wording `Nominate missing PoW`, not `Add to map`, for RA or public
  candidate intake. A nomination is a provisional claim for review; adding to
  the map happens only after validation, reviewer acceptance, export to `pow`,
  and governed rebuild.
- `site_id` tracks the mappable place. Moving congregations normally create a
  new `site_id` linked by relocation and organisation evidence.
- New Zealand is the proof-of-concept country, not the universal template.

## Stack Defaults

- Research-facing pipelines and analysis: R.
- Governed data modification: Rust (`pow validate`, `pow stage`, later diff,
  review, replay, and export).
- Python: support/API tooling only; use `uv`.
- Frontend: the current static HTML/CSS/JavaScript map products remain the
  live pilot surface, but new shared task, review, nomination, export, and
  country-configuration UI should be TypeScript-first with strict types
  wherever practical.
- Backend direction for the RA task map: Convex spike for shared live
  task/review state, exported into `pow`; no direct master writes from public
  or RA interfaces.
- Prefer strict TypeScript over new vanilla JavaScript for Convex-backed
  prototypes, live task/review workflow glue, schemas, exports, and frontend
  integrations that speak directly to Convex. Keep small vanilla JavaScript
  patches only when they are narrowly scoped to the existing static pilot page
  or avoid disrupting active RA work.
- Durable staging/storage reference: managed auth plus Rust API,
  PostgreSQL/PostGIS, and object storage when Convex is not sufficient for
  geospatial storage, media quarantine, or archival exports.
- Web-based task management may proceed only as a provisional task/review layer;
  accepted data changes still flow through `pow` validation, staging, diff,
  replay, and export contracts.

## Working Rules

- The repository is public and audience-addressed: `docs/people/` maps
  who reads what (RAs, JW, Guy) and states the public/private rule.
  Personal contact details, credentials, API keys, per-person
  assignment tracking, and unpublished collaborator material never
  enter git — they belong in `.private/` (git-ignored, synced across
  JB's machines via `.private-sync.env` to the private GCS bucket).
  Named credit in manifests/changelog is public by design.
- Keep large, restricted, raw, or private data out of Git unless the repo
  already tracks that class of artefact and the licence permits it.
- Treat ignored local data as cache only. Before using generated data for RA
  tasks, analysis, public products, or publication, make sure it has durable
  project-controlled storage and a tracked manifest as described in
  `docs/data-storage-pipeline.md`.
- Use `schemas/data-manifest.schema.json` for reusable data artefacts. Global
  outputs should be partitioned by snapshot date, pipeline stage, and country,
  with SHA-256 hashes, row or feature counts, immutable version IDs, and
  supersession links.
- When editing or reviewing planning, schema, RA, roadmap, FAQ, or changelog
  documents, check nearby cross-references for drift. If documents disagree on
  identity rules, RA workflow, data ownership, source/licence handling,
  backend direction, or task/review process, either reconcile the documents
  in the same change or flag the inconsistency clearly for the user.
- When the user asks a question whose answer clarifies durable project
  behaviour, especially around identity, task generation, RA workflow, staging,
  review, source handling, or master rebuilds, consider whether the answer
  should be added to `FAQ.md`. Add it when it would likely help future RAs,
  collaborators, reviewers, or agents; otherwise note the reason not to.
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
- Convex task-map backend: `npm install`, `npm run convex:dev`, and
  `uv run scripts/build_convex_task_seed.py --limit 100 --output exports/convex-task-seed/nz-sample.json`.
- R scripts: run from the repo root unless the script documents another working
  directory.
