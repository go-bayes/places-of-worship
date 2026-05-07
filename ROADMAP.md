# Roadmap

This roadmap gives directional guidance for the Places of Worship project. It
groups work into design phases so we can keep near-term engineering choices
aligned with the long-term research objective. It is not a release schedule, and
the phases are not version numbers.

The roadmap has two coupled tracks:

- Evidence and governance: how data are obtained, validated, staged, reviewed,
  accepted, replayed, and audited.
- Research outputs and analysis: how reviewed or clearly provisional data are
  surfaced for maps, downloads, visualisations, density estimates, temporal
  comparisons, and reproducible investigator workflows.

## How To Read This

Status markers:

- `[x]` substantially in place
- `[~]` in progress or partially proven
- `[ ]` not started or not yet stable

Use this file for the broad phase map. Use `PLANNING.md` for active design and
next steps, `JOURNAL.md` for decisions and rationale, and `CHANGELOG.md` for
durable progress.

Each phase should advance both tracks where possible. A data-management phase is
not complete merely because intake works; it must also make the consequences of
new evidence visible to investigators. A research-output phase is not complete
merely because a map renders; it must rest on documented, reproducible, and
auditable data products.

## North Star

Build a global, research-grade database and map of places of worship located in
space and time.

The core analytical object is a worship-function state at a mappable site. The
project must therefore preserve not only current places, but also functional
changes: worship use appearing or disappearing, denomination or tradition
changes, multi-denominational use, multi-purpose use, shared buildings, split or
merged worship uses, and uncertainty about dates or locations.

The first stable surface for governed modification is the `pow` command-line
interface and local staging store. Web-based data management should remain
deferred until validation, staging, diff, review, replay, and export contracts
are stable enough to protect the master database and explain analytical changes.

## Roadmap Principles

- Keep evidence governance and research outputs coupled. Every accepted or
  staged change should be capable of producing an investigator-facing summary of
  what it would change.
- Surface research-facing outputs first through CLI reports, SQLite staging,
  JSON/CSV/GeoJSON exports, and R-readable summaries.
- Prioritise `pow diff` before rich editors. The mission-critical diffs are
  whether a place of worship appeared or disappeared at a target date, whether
  denomination or tradition changed, whether a site became multi-denominational
  or multi-purpose, and how these changes alter area counts, densities, map
  layers, downloads, and uncertainty statements.
- Keep web maps as consumers of reviewed or explicitly provisional products.
  They should not become direct write surfaces for the master database.
- Treat public, RA, community, and AI-assisted inputs as untrusted until they
  pass validation, review, and acceptance.

## Phase 0: Baseline Map And Data

Status: `[~]` in progress.

Goal:
Maintain usable global and New Zealand map products while we rebuild the data
model around provenance, temporal state, and review.

Evidence And Governance:

- `[x]` Initial New Zealand cleanup audit and manual review queue.
- `[x]` Initial schemas for sites, structures, indicators, visual layers, source
  datasets, change events, and geometry history.
- `[~]` Continued global extractor cleanup and country-source feasibility work.

Research Outputs And Analysis:

- `[x]` Static global map and New Zealand regional map.
- `[x]` First area-summary schema and New Zealand territorial-authority product.
- `[~]` Current inventory overlays that clearly distinguish present inventory
  from historical density.
- `[~]` Investigator-facing notes on what the current products can and cannot
  support.

Non-goals:

- Do not treat current OpenStreetMap-derived records as historical truth.
- Do not make the current map a direct write surface for the master database.

## Phase 1: Governed Local Ingestion

Status: `[~]` in progress.

Goal:
Make research-assistant and agent-produced evidence batches validate, stage, and
diff locally before any live portal backend exists.

Evidence And Governance:

- `[x]` `pow validate` for RA CSVs and change-event or geometry-history JSON.
- `[x]` `pow stage` for writing validated batches into local SQLite staging.
- `[x]` `pow propose --persist` for writing draft change events back into
  SQLite as a derived stage batch.
- `[x]` `pow diff` v1 reviewer report with per-site changesets,
  per-target-year affects, validation/warning rollups, source coverage, and
  JSON output derived directly from staged or proposed events.
- `[x]` Initial functional-state payloads for worship use,
  denomination sets, multi-denomination, multi-purpose use, organisation-site
  links, and target-year appeared/disappeared states.
- `[ ]` Reviewer decision events and accept/reject/defer/revise semantics.
- `[ ]` Deterministic payload hashing and accepted-event replay checks.

Research Outputs And Analysis:

- `[~]` Text and JSON validation, proposal, and diff reports suitable for RA
  feedback, reviewer inspection, and audit.
- `[~]` Staged-batch summaries that R workflows can read without inspecting the
  SQLite store manually.
- `[x]` First `pow diff` reports showing proposed changes to target-year
  worship-function states and denomination, purpose, organisation, geometry, and
  uncertainty fields carried by staged events.
- `[ ]` Clear labelling of provisional outputs so investigators can inspect
  effects without mistaking staged data for reviewed data.
- `[ ]` Defer `before.geojson`, `after.geojson`, `area_summary_diff.csv`, and
  full map/export effects until `pow rebuild-master` can reconstruct state.

Non-goals:

- Do not accept direct master writes.
- Do not build rich terminal or web-based data management before the save,
  review, and accepted-event contracts are clear.

## Phase 2: Human Review Workbench

Status: `[ ]` not started.

Goal:
Give reviewers a fast way to inspect staged batches, validation warnings,
evidence, proposed changes, and dry-run effects.

Evidence And Governance:

- `[ ]` Decide whether to add `pow-tui` as a separate binary in this workspace.
- `[ ]` Split shared validation, staging, and diff logic into `pow-core`.
- `[ ]` Browse staged batches and records from SQLite.
- `[ ]` Show existing master values, proposed values, evidence trail, validation
  warnings, nearby duplicates, linked OSM objects, and linked building geometry.
- `[ ]` Record reviewer decisions: accept, reject, defer, revise, or needs
  source.

Research Outputs And Analysis:

- `[ ]` Reviewer summaries that explain analytical consequences before
  acceptance.
- `[ ]` Decision logs and accepted/rejected/deferred counts by batch, source,
  country, target year, denomination/tradition, and warning class.
- `[ ]` R-readable review exports for method notes, quality reports, and grant
  reporting.

Non-goals:

- Do not make the TUI the only review interface.
- Do not replace the map where spatial building-level judgement is necessary.
- Do not treat the workbench as a public portal.

## Phase 3: New Zealand Temporal Reconstruction

Status: `[ ]` not started.

Goal:
Use New Zealand as the proof-of-concept country for target-year worship-function
reconstruction.

Evidence And Governance:

- `[~]` Generate cleaned OpenStreetMap temporal candidate diffs for 2013,
  2018, and 2023 before RA review.
- `[~]` Ask RAs to contact church bodies for source-backed site records,
  openings, closures, relocations, mergers, and changed-use cases.
- `[ ]` Pilot RA evidence collection for one or two curated source batches.
- `[ ]` Reconstruct 2013, 2018, and 2023 target-year worship-function states.
- `[ ]` Preserve appeared/disappeared states separately from building existence.
- `[ ]` Track denomination changes, multi-denominational use, multi-purpose use,
  shared buildings, and split or merged worship uses.

Research Outputs And Analysis:

- `[ ]` Target-year site-state tables for 2013, 2018, and 2023.
- `[ ]` Area counts and density estimates with explicit denominators, boundary
  versions, uncertainty, and source coverage.
- `[ ]` Appeared/disappeared map layers that represent worship-function change,
  not merely building visibility.
- `[ ]` Denomination/tradition and multi-use change summaries.
- `[ ]` Reviewed New Zealand downloads and reproducible R workflows for
  investigator analysis.

Non-goals:

- Do not generalise New Zealand boundary or source assumptions to all countries.
- Do not use building visibility alone as evidence of worship use.

## Phase 4: Authenticated Portal Pilot

Status: `[ ]` not started.

Goal:
Create an invite-only New Zealand staging pilot with managed authentication,
live shared task state, map-first entry, validation exports, secure storage
boundaries, and reviewer workflows.

Evidence And Governance:

- `[ ]` Managed auth, likely Google OAuth or Identity Platform.
- `[~]` Convex task-map spike for shared assignments, provisional closures,
  evidence drafts, reviewer comments, review decisions, and curator queues.
- `[~]` Implement the task/event/evidence/review/export contract in
  `docs/convex-task-layer-spec.md`.
- `[ ]` Weekly or curator-triggered export from Convex task state into `pow`
  validation, diff, replay, and reviewed map-output workflows.
- `[ ]` Rust API on Cloud Run or an equivalent backend where schema validation,
  heavy geospatial checks, or durable staging need a separate service.
- `[ ]` Staged submissions in Cloud SQL/PostgreSQL/PostGIS or a compatible
  provider-neutral schema if Convex is not sufficient for canonical staging.
- `[ ]` Raw submissions and media in quarantined object storage before any
  public display.
- `[ ]` Map-first edit UI with clear staged/rejected/demo-only states.
- `[ ]` Reviewer map with validation warnings, evidence trail, existing and
  proposed values, linked geometry, and duplicate risk.

Research Outputs And Analysis:

- `[ ]` Portal views that expose reviewed and explicitly provisional research
  products without making unreviewed submissions public.
- `[ ]` Map-first visualisations for target-year state, appeared/disappeared
  changes, density, denomination/tradition, multi-use, and uncertainty.
- `[ ]` Secure download surfaces for reviewed or permissioned outputs.
- `[ ]` Clear audit links from map layers back to source batches, review
  decisions, and rebuild manifests.

Non-goals:

- Do not implement custom password or session handling.
- Do not expose unreviewed submissions on public map products.
- Do not shift data-management authority from the CLI/backend contracts to
  frontend convenience.

## Phase 5: Reviewed Public Products

Status: `[ ]` not started.

Goal:
Publish reviewed, reproducible data products for maps, downloads, and research
analysis.

Evidence And Governance:

- `[ ]` Accepted change-event log and deterministic rebuild path.
- `[ ]` Rebuilt master snapshots and target-year site snapshots.
- `[ ]` Versioned manifests that connect accepted events, source evidence,
  rebuild code, and exported products.

Research Outputs And Analysis:

- `[ ]` Public GeoJSON, CSV, and larger analytical exports.
- `[ ]` Map visualisations for site, area, and comparison modes.
- `[ ]` Provenance and quality metadata visible in popups, legends, and
  downloads.
- `[ ]` Reproducible R analysis workflows and summary reports for investigators.
- `[ ]` Funding- and partner-facing outputs that explain coverage, uncertainty,
  and justified shifts from the original plan.

Non-goals:

- Do not make public exports depend on live unreviewed portal state.
- Do not hide data-quality limitations in frontend-only code.

## Phase 6: Global Community Scale

Status: `[ ]` not started.

Goal:
Extend the governed intake, review, and publication model beyond the New
Zealand pilot.

Evidence And Governance:

- `[ ]` Country-source matrix and feasibility survey.
- `[ ]` Country adapters for boundaries, sources, licences, and denominational
  taxonomies.
- `[ ]` Community and partner contribution paths.
- `[ ]` AI-assisted proposal generation and AI-assisted review under scoped
  credentials and audit.
- `[ ]` Provider migration options, including SQLite-compatible, PostGIS, and
  object-storage backends.
- `[~]` Convex-to-`pow` export contract for task state, evidence drafts, and
  reviewed decisions.

Research Outputs And Analysis:

- `[ ]` Country-level feasibility and coverage reports.
- `[ ]` Comparable cross-country site-state and area-summary products where
  source quality permits them.
- `[ ]` Global and country-specific map layers that expose uncertainty rather
  than hiding source gaps.
- `[ ]` Download and visualisation contracts that can survive provider migration
  or a future move away from GitHub-hosted static products.

Non-goals:

- Do not assume one country model fits all.
- Do not automate acceptance of community or AI contributions without review.

## Continuous Investments

These concerns apply across all phases:

- Security and trust boundaries for every intake path.
- Provenance, licences, privacy, and raw-source retention.
- Functional-state modelling for worship use over time.
- Denomination and tradition taxonomy.
- Reproducible R research outputs and investigator-facing summaries.
- Rust validation, staging, diff, replay, and export correctness.
- Accessibility and ergonomics for RA, reviewer, and public-facing interfaces.
- Testing, fixtures, smoke checks, and schema validation.
- Grant alignment and clear explanation of justified scope shifts.
