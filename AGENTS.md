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
- Images, screenshots, renders and other large files handed to Joseph go to
  the project heap in his Dropbox (Joseph, 2026-09-19):
  `/Users/joseph/v-project Dropbox/Joseph Bulbulia/HEAP/places-of-worship`
  (the Dropbox client's own sync root, from `~/.dropbox/info.json`; the
  `~/Library/CloudStorage/Dropbox-v-project` mount is stale and does not
  carry it).
  Its `README.md` sets the layout: `screens/<date>-<topic>/` for
  screenshots and walkthrough captures, `renders/` for figures and PDFs,
  `exports/` for bulk data with its manifest, `incoming/` for collaborator
  files. Name files by pull request or lane. Give Joseph the full absolute
  path. The heap is the hand-over copy Joseph reads; a workflow that names
  its own place (`.private/`, synced to GCS, or a git-ignored `local/review/`
  render folder) keeps that place as the working copy, and the heap gets a
  copy of what Joseph is asked to look at. `.private/` stays for
  credentials and per-person material.
  Joseph mostly works over ssh to this machine and cannot open claude.ai artifact links, so the heap is the default hand-over for anything he needs to see: screenshots, rendered HTML, PDFs and figures (Joseph, 2026-09-24).
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
- Any change to contributor-portal UI (`apps/regions/*/verification.html`,
  `apps/regions/nz/js/verification-map.js`, portal styles, or the rapid-entry
  contract's RA-facing surface) must update the RA guide
  (`apps/guides/ra.html`) in the same change, or state in the PR why the guide
  is unaffected. The guide is the RA's contract with the UI; drift between
  them wastes RA time and corrupts training (JB ruling, 2026-08-31).

## Agent And PR Coordination

- Start each substantive unit on one focused branch created from current `origin/main` after the preflight below. Push the branch after its first coherent commit so active work has an off-machine ref.
- Apply the branch safeguards below even when Joseph is the only maintainer: another agent, worktree, or merged pull request can advance `main` while a branch is idle.
- Configure every clone with `git config --local pull.ff only` and `git config --local fetch.prune true`. These repository-local settings make `git pull` refuse non-fast-forward integration and remove deleted remote-tracking refs during fetch.
- Before beginning or resuming a topic branch, run `git fetch --prune origin`, account for every working-tree change, and inspect `git rev-list --left-right --count origin/main...HEAD`. Do not infer the branch relationship from a stale local `main`.
- Treat a topic branch as inactive after its pull request merges or its tip becomes an ancestor of `origin/main`. Start later work on a new branch from current `origin/main`; retain the inactive branch only until the updated checkout and merged work are verified.
- When `origin/main` and a topic branch both contain unique commits, create a dated local archive ref and push that ref before rebasing, merging, or cherry-picking. Reconcile on a new branch from current `origin/main`; never rewrite the only copy of unpublished commits.
- Ahead/behind counts describe commit ancestry. Before replaying branch-only commits, use `git range-diff` and compare the changed files and their content against `origin/main`, because a squash or consolidated commit may already contain the work under different hashes.
- Before advancing `main`, fetch again and require `git merge-base --is-ancestor origin/main <branch>` to succeed. Switch to `main`, integrate with `git merge --ff-only <branch>`, push `main`, and verify local, upstream, and live-remote hashes. Stop if `git merge-base` or `git merge --ff-only` returns a non-zero status.
- After verified integration, leave `main` checked out. Delete an ordinary merged branch only after confirming that `main` contains its tip; retain a dated archive branch until Joseph explicitly releases it.
- Do not stack pull requests unless the user explicitly asks for a stack.
- If a stack is necessary, state the stack order, base branch, changed files,
  and test plan in each pull request. After a lower branch is squash-merged,
  rebase or otherwise restack the next branch onto current `main` and retarget
  it before merge.
- End each work sitting by pushing every commit and recording the repository, branch, upstream, `HEAD`, `origin/main`, ahead/behind counts, and working-tree state in the applicable private handover.
- Give agents narrow, non-overlapping ownership. A useful default is: one agent
  drafts an implementation PR; another performs a read-only review.
- Do not mix implementation and review on the same files at the same time
  unless the user asks for that coordination explicitly.

## Agent Signature On Pull Requests

Several agents and people collaborate on this repository, so every pull request body, review, and comment an agent writes ends with the agent's model identity (Joseph, 2026-09-19). Sign with the model name and version as the provider reports it, for example `— Claude Fable 5.1` or `— gpt-6-astra`; a generic product name is not enough. Commits stay unsigned and carry no AI attribution. The signature lets the team see which model produced a review or a claim when reading a thread later.

## Pull Request Closure

An assigned pull request is carried to closure by one agent, so no merged change waits on a backend deployment nobody owns (Joseph, 2026-09-13). The closure owner is the agent that authored the pull request unless Joseph assigns another; a reviewing agent stays read-only.

- Closure authority is given per pull request, in writing: Joseph says "carry to closure" in the session or on the pull request, or adds the `closure-authorised` label. Record the instruction and its date in the private handover. Without it, carry the pull request to a mergeable state and stop.
- Babysit the pull request until it merges. Keep it rebased on current `origin/main`; keep the description's test plan current; answer every review thread from Codex, Greptile, or a person by verifying the finding against the code first, then repairing it, or replying with the reason it does not hold.
- Merge only after review (Joseph, 2026-09-24). Model tiers (Joseph, 2026-09-24): `gpt-6-astra`, Claude Fable 5.1 and Claude Opus 5.5 are reserved for planning, design and security-sensitive judgment; `gpt-6-sol` is the default reviewer of pull requests and the default for implementation and repair work; `gpt-6-luna` handles cheap bulk passes; interface work uses Fable 5.1 or Opus 5.5 or later, alone or together. The merge review is therefore a Codex review on `gpt-6-sol` (or a later release in the same Sol tier, never a Luna-tier model) at reasoning effort medium or above. Three cases need, in addition, a review by one of the reserved models, and both reviews must clear before merging: a design brief, a security- or privacy-sensitive change (authentication, authorisation, or the handling of restricted, personal or culturally sensitive data), and a finding the `gpt-6-sol` review and the author dispute. If `gpt-6-sol` is unavailable, a reserved model's review replaces it. A model outside these families needs Joseph's approval. The review covers the final head: a substantive change after it (anything beyond a typo or a repair the review itself asked for, verified against the finding) needs a fresh review. Record the reviewing model, its reasoning effort, the reviewed head, and the reason for any fallback in the pull request. Read and answer Greptile's comments first. Joseph's instruction to merge presupposes this review; it does not replace it.
- Merge only when every condition holds: CI is green on the final head; every review thread is answered; no finding the closure owner assesses as blocking remains open; closure authority is recorded. Integrate by the fast-forward procedure above.
- Pages publishes the static site when `main` advances, so backend changes go live first. When the pull request changes anything under `convex/`, classify the change before merging. An additive change (new tables, new optional fields, new functions, widened validators) is deployed from the reviewed head with the target named explicitly, `CONVEX_DEPLOYMENT=dev:pastel-goshawk-398 npx convex dev --once`, because the bare command takes its target from the clone's ignored `.env.local` or the shell environment. Continue only if the CLI's "Developing against deployment" line names `pastel-goshawk-398`, the deployment the live portals use (`apps/regions/nz/js/convex-config.js`); any other name stops closure. Then read that deployment's function list and schema back and compare them with the head before fast-forwarding `main`. A non-additive change (removed or renamed fields or functions, narrowed validators, anything requiring a data migration) stops closure; Joseph runs it or rules the sequence.
- If Joseph merges the pull request himself, the closure owner still owes the deployment and its record in the same sitting. When a sitting ends before closure, the private task page carries the item as "closure owed" until the deployment record exists, and the next session takes it up first.
- Record every closure in the private handover: pull request, merged hash, deployment name, time, and how the deployment was verified. Update the task page in the same commit.
- Halt and hand over on any surprise: CI red after a rebase, a new blocking finding, a deployment error, or a mismatch between the deployed functions and the head. A halted closure is recorded, never retried silently.
- Closure never includes data mutations (migration versions, acceptances, freezes, imports), secrets or environment variables, `npx convex deploy` to the production deployment, Pages or tile configuration, or outward messages. Each of those needs its own instruction.

## Development Methods Record

Joseph intends to publish an account of how this site was developed (Joseph, 2026-09-24), so agents record their methods as they work. The public repository is the record that is always present; the private handovers in `pow-research` keep the operational detail.

- At the end of each sitting in which work is merged, deployed or designed, the closure owner (the agent that carried the work to closure; reviewing agents stay read-only) appends a dated entry to `docs/development/methods-log.md`. Write at summary grain, one line per paragraph, New Zealand English.
- Each entry states: what was built or decided and why; which roles did the work (the human rulings, the implementing agent and model, the reviewing models and their tier under the review rule above); the number of review rounds and findings by severity for each pull request, stating which reviewers' findings are counted; how the work was verified (continuous integration, isolated local backends, read-back of the live deployment after a deploy); and any deviation from the rules in this file, such as a merge made before its review, with how it was remedied.
- Record costs, credentials, private research data and personal details nowhere in the log. Name people only as the project already credits them.
- A later correction appends a new entry rather than rewriting an earlier one.

## Useful Commands

- Rust checks: `cargo fmt --all`, `cargo test`, `cargo clippy --all-targets -- -D warnings`.
- Python setup: `uv sync`; run scripts with `uv run <script>`.
- Convex task-map backend: `npm install`, `npm run convex:dev`, and
  `uv run scripts/build_convex_task_seed.py --limit 100 --output exports/convex-task-seed/nz-sample.json`.
- R scripts: run from the repo root unless the script documents another working
  directory.
