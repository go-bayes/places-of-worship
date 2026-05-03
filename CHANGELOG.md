# Changelog

## Unreleased

### 2026-05-03

- Removed implementation-facing command-line references from the RA pilot task
  guide so the first-pass instructions stay focused on the map and shared
  working Sheet.
- Updated portal and task-map planning to make Convex the preferred near-term
  backend spike for shared live RA/reviewer task state, while keeping accepted
  events, master rebuilds, and public map exports outside Convex.
- Defined `lifecycle` in RA-facing guidance and clarified that missing-place
  candidates may already exist in OSM; OSM ids should be recorded as source or
  matching evidence, not treated as project site ids.
- Added optional lifecycle/later-change fields to the NZ verification map so RA
  rows can capture source-backed dates outside 2013/2018/2023, including site
  opening, closure, first/last seen, relocation, demolition, and later
  shared-use or multi-denominational changes.
- Clarified that RAs should leave missing cells blank rather than entering
  `NA`/`N/A`, documented accepted date formats as `YYYY`, `YYYY-MM`, or
  `YYYY-MM-DD`, added map-side date checks for source/capture dates, and made
  `pow validate` reject common missing-value placeholders.
- Documented how RAs should avoid accidental duplicate work during the NZ
  pilot: local map badges are browser-only, the shared Sheet is the durable
  pilot record, multiple rows for one place are allowed when they carry
  different evidence, and the target design needs a shared provisional task
  store outside the master database.
- Updated the NZ verification map action builder to keep RAs on the map after
  copy/skip actions, mark copied tasks as tentatively closed in the local
  session, and expose controlled fields for existence status, worship-use
  status, assessment confidence, site-match confidence, and location
  confidence.
- Clarified the NZ verification map's missing-site prompt by adding an
  `Open draft nomination form` button and renaming the sidebar panel so RAs
  are not pointed to an ambiguous "form above".
- Clarified the RA session JSON export as a local reconstruction/debug log,
  changed active RA-facing instructions from "the project team" to "JB", and
  tightened the NZ place-density colour domain so low per-km² values render
  visibly on the map.
- Added a first-session briefing and post-session capture protocol to
  `docs/ra-nz-pilot-task.md`, including 5-10 varied demo-map cases, paste
  alignment checks, session JSON export, and five feedback questions.
- Treated `site_evidence_wide` header order as a data contract: protected the
  live Sheet header with an edit warning, clarified paste instructions, added a
  FAQ entry, and made `pow validate` reject known-template header reordering.
- Simplified `docs/ra-nz-pilot-task.md` so the current RA instruction is to
  sample varied tasks from the demo map rather than complete a fixed 50-row
  pilot batch.
- Added a second README pointer to `FAQ.md` near the project orientation links.
- Clarified the identity conflict lifecycle: accepted user-nominated sites keep
  durable project `site_id` values, later OSM matches attach as source
  identifiers after review, and conflicts become proposed change events rather
  than direct master overwrites.
- Added `FAQ.md` as a plain-language guide to site identity, candidate ids,
  OSM conflicts, RA spreadsheets, task generation, staged review, and visual
  evidence.
- Moved CLI and staging support docs into `docs/development/`, removed the CLI
  tutorial from the default RA task path, and added planning notes for
  UI-generated new PoW nominations and explicit 2013/2018/2023 evidence
  capture.
- Clarified that RA working spreadsheets should be project-owned Google Sheets,
  with later automated provisioning from a locked project template rather than
  RA-owned copies.
- Added `scripts/build_ra_working_sheet.py` to build the multi-tab RA working
  workbook from the repository templates for native Google Sheets import,
  including frozen headers, filters, and main-tab controlled-field dropdowns.
- Added `field_observation` to the RA evidence vocabulary and documented
  street-level imagery providers, capture dates, and RA field observations as
  explicit visual evidence sources.
- Updated the NZ verification map action builder to capture source provider,
  source/capture date, Street View or other street-imagery sources, and field
  observation rows without silently falling back to OSM as evidence.
- Added a selected-site task brief to the NZ verification map demo. The detail
  panel now turns priority, suggested action, target year, and automated checks
  into a concrete RA checklist before the findings form.
- Defaulted the NZ verification map to demo mode while the RA action builder
  is the only functional state. The page now lands with the action builder,
  session log, and nomination controls available; appending `?demo=0` opts in
  to the read-only feedback view that will become the default once secure
  staging exists. Updated the NZ README and RA pilot task doc to point at the
  bare URL as the canonical demo entry and to document the `?demo=0` opt-out.
- Added a Tier 2 self-audit and recovery layer to the NZ verification map
  demo: an RA-initials prompt and badge persisted at
  `localStorage.pow_ra_initials` and stamped on emitted evidence rows; a
  client-side session log at `localStorage.pow_ra_session_v1` capturing every
  copied or skipped task with the full TSV; a collapsible "My session" panel
  in the sidebar with re-copy, open-task, export-JSON, and clear-session
  controls; a Skip task collapsible with optional reason; and
  tentatively-closed/skipped status pills on the sidebar task list.
  All client-side; no schema or backend changes.
- Added a Tier 1 ergonomics pass to the NZ verification map demo: a numbered
  4-step indicator (Inspect, Decide, Evidence, Copy row) at the top of the
  detail panel; a reordered detail panel so the action builder sits directly
  below the source links; a dismissable quickstart banner explaining the
  6-step workflow; an explicit "Use OSM URL" button so the source URL no
  longer auto-fills with the OSM record itself; clearer post-copy clipboard
  guidance; larger body, label, input, button, and link fonts with primary
  buttons at least 44 to 48 pixels tall; and removal of the fragile
  note-overwrite heuristic so action changes never overwrite a touched note.
- Shortened the public README, added a direct roadmap link, and removed the
  detailed OpenStreetMap editing instructions while retaining OpenStreetMap
  attribution and contribution-status guidance.
- Updated the roadmap and planning notes after the `pow diff` v1 merge so the
  next priority is the minimal save/evaluate/review loop rather than the
  completed diff groundwork.
- Added `pow propose --persist` so emitted draft change events are written
  back into the local staging database as a derived batch linked to its
  source via `stage_batches.parent_batch_id`, and added `pow diff <batch_id>`
  reviewer report (text and JSON) covering per-site changesets, per-target-year
  transitions, validation warnings, and source coverage. Migration is
  idempotent for existing `.pow/staging.sqlite` files.
- Added `ROADMAP.md` as a directional phase map for the project and simplified
  `AGENTS.md` so future agents can find the roadmap, active planning, decision
  log, schemas, revision CLI docs, RA templates, verification plan, and portal
  plans quickly.
- Revised the roadmap and planning notes to pair evidence governance with
  research outputs, and recorded that web-based data management is deferred
  while the `pow` CLI, local staging, diff reports, and R-readable exports are
  stabilised first.
- Extended `change-event.schema.json` with pre-release worship-function event
  payloads for appeared/disappeared worship use, multi-denomination,
  multi-purpose use, organisation-site links, split/merge cases, and
  target-year effects, plus fixtures and CLI tests for the new contract.
- Scoped the first `pow diff` milestone to a reviewer report derived from staged
  events, with reconstructed snapshots, area summaries, density estimates, and
  map/export effects deferred to `pow rebuild-master` and export commands.
- Added an RA-facing CLI tutorial for validating and staging exported evidence
  CSV batches without editing repository templates or changing the public map.
- Added the first `pow propose` bridge and mapping contract for translating
  staged RA evidence rows into draft change-event JSONL before `pow diff`,
  including a golden CSV-to-JSONL fixture.
- Expanded the RA CLI tutorial into a step-by-step walkthrough with
  screenshot-style figures and explicit instructions not to submit pull
  requests, edit repository templates, or run staging/proposal steps without a
  project-team request during the pilot, plus a plain-language overview of the
  project aim and RA role. A fixture-based demo pass now aligns the tutorial
  with actual Cargo, validation, staging, and proposal output.
- Added `docs/ra-map-triage-guide.md` to give RAs step-by-step instructions for
  missing sites, duplicate records, disappeared sites, complicated worship
  functions, NZ priority tasks, and the intended 2013/2018/2023 map workflow.
- Added provisional 2013/2018/2023 target-year controls to the NZ verification
  map, colouring markers by target-year status derived from reviewed status
  fields where available and otherwise from OSM lifecycle tags.
- Added a no-save RA action builder to the NZ verification map demo so selected
  tasks can produce a spreadsheet-ready evidence row and review JSON locally
  while secure authenticated staging remains future work.
- Added `docs/ra-nz-pilot-task.md` as the current RA-facing New Zealand web
  pilot tutorial, making the pilot map-first, time-bounded, and focused on a
  mixed validation batch rather than CLI-first data entry.
- Clarified for RAs that the map demo does not save work: pilot evidence is
  saved in the shared working spreadsheet, with CSV export from that sheet only
  when requested.
- Removed the repository contributor guide while development remains
  single-maintainer.
- Recorded the repository governance baseline: keep the repo public, disable
  GitHub Issues/Discussions/Wiki during the pilot, and protect `main` against
  force-pushes and deletion while allowing direct maintainer commits.
- Added the first Rust `pow` CLI scaffold with `validate` and `stage` commands
  for RA evidence CSVs and staged revision JSON/JSONL files, including
  schema-backed change-event and geometry-history validation,
  controlled-vocabulary checks, date/coordinate/probability checks,
  replay-safety checks, text/JSON reports, and a local SQLite staging store.
- Added `docs/development/revisions-cli.md` and a small NZ sample change-event
  batch to document how the local CLI relates to later map/API staging
  ergonomics.
- Recorded journal decisions that the edit/review maps should submit through an
  authenticated API rather than call the CLI directly, and that the first
  staging store should use SQLite-compatible tables while Turso remains a later
  evaluation candidate.
- Clarified in planning and the journal that functional changes in worship use
  are first-class analytical data: appeared/disappeared target-year states,
  denomination changes, multi-denomination, multi-purpose use, and split or
  merged worship uses must be preserved separately from building existence.
- Tightened `change-event.schema.json` so `event_type` discriminates the
  required `payload.payload_type` and the allowed `event_intent` via top-level
  `if/then` rules; added `name_update` and `structure_created` payloads so the
  full `event_type` enum has a coupled payload; promoted `Status` to `$defs` in
  `site.schema.json` and `structure.schema.json` and referenced the site
  variant from `SiteCreatedPayload.status` and `StatusPayload.{previous,new}_status`,
  and the structure variant from `StructureCreatedPayload.status`; removed the
  duplicated `taxonomy_version` from `DenominationPayload` so the top-level
  field is authoritative; and added a `^[a-z][a-z0-9._-]*$` pattern on
  `denomination_code` pending the taxonomy schema.
- Moved heavy Python packages out of the default `uv` environment into explicit
  `api`, `fast-parquet`, and `legacy` extras, and documented the narrower Python
  scope.
- Updated Python API dependencies to clear Dependabot alerts for `geopandas`
  and `starlette`, including the FastAPI bump required by the patched Starlette
  release.
- Merged the revisions-pipeline critique and added initial change-event and
  geometry-history schemas for RA-submitted location and denomination revisions.
- Recorded the identity-on-relocation rule: `site_id` tracks the mappable place,
  while congregations that move to materially different places are linked through
  relocation events and organisation evidence.
- Added a portal data-entry planning hub and focused UI, database/storage,
  submission-review, auth/security, media, and provider-evaluation plans for the
  first authenticated New Zealand staging pilot.
- Recorded Google Cloud as the first portal backend baseline, with Google
  OAuth/Identity Platform, Cloud Run, Cloud SQL/PostGIS, Cloud Storage, no direct
  master writes, GitHub only as an audit mirror, and Convex/SpacetimeDB deferred
  until contracts are stable.
- Added planning and journal notes for a Rust-backed data-modification pipeline
  that governs validation, staged proposals, append-only change events, dry-run
  diffs, master rebuilds, and researcher-friendly exports while keeping R as the
  investigator-facing analysis layer.
- Made the NZ verification demo-entry path more visible by linking to demo mode
  from the read-only page and showing an initial mock-entry preview panel before
  a task is selected.
- Renamed the visible NZ verification action label from "Review when sampling"
  to "Spot-check in sample" while preserving the stored
  `review_when_sampling` value.
- Fixed the NZ verification popup `Open task` control so it binds through the
  app code and focuses the sidebar task detail instead of relying on an inline
  handler.
- Added an explicit `?demo=1` mode for the NZ verification page so the RA can
  inspect draft decision and nomination controls while the default public page
  remains read-only and no demo data is saved or submitted.
- Recorded the decision to use a managed authentication service for future
  intake and audit workflows rather than implementing password or session
  handling in the project.
- Added security and trust-boundary requirements for any future data intake
  path, including authentication, permissions, rate limits, upload controls,
  quarantine, validation, privacy/licence checks, abuse handling, and audit
  logs.
- Made the public NZ verification feedback pilot read-only until secure staging
  exists.
- Added `JOURNAL.md` as a decision log for methodological and architectural
  choices that need rationale beyond the release changelog.
- Disabled clustering on the NZ verification map so RA review shows individual
  candidate points by default.
- Ignored the local Darbyshire thesis PDF and noted that congregation-rich
  historical sources without addresses may later support fuzzy regional
  placement or uncertain back-propagated maps.
- Switched the NZ verification map to a greyscale basemap and added staged
  nomination controls for current places missing from OSM, lost target-year
  places, denomination/building complications, and charity-record site matching.
- Added a static NZ OSM verification map and generated
  `verification_tasks.geojson` layer so reviewers can inspect current master
  sites against OSM links, automated checks, priority filters, and copyable
  staged review decisions.
- Added `docs/master-verification-workflow-plan.md` to plan read-only master
  site bundles, automated verification checks, review queues, staged decisions,
  agent-readable data dumps, and map verification layers for NZ and global
  scale.
- Added RA-facing historical site evidence CSV templates in
  `docs/templates/ra-historical-site-evidence/` for Google Sheets import,
  including source metadata, site observations, candidate matches, review notes,
  controlled vocabularies, and privacy/licence instructions.
- Added a wide RA evidence-entry template with first-class lifecycle date
  fields for founding, opening, first seen, last seen, closure, demolition,
  change of use, relocation, and target-year status checks.
- Added a normalised lifecycle-event CSV scaffold for later ingestion once the
  wide RA entry sheet is split into backend tables.
- Added historical-address and geocoding-basis fields to the RA evidence
  templates so changed streets, renamed localities, demolished buildings, and
  uncertain modern matches can be reviewed explicitly.
- Added bounded origin and closure date fields so sources that establish
  "not earlier than" or "not later than" evidence can be recorded without
  inventing exact dates.
- Added OpenStreetMap lifecycle-tag, visual-verification, and target-year
  probability fields to support later temporal verification of 2013, 2018, and
  2023 place existence.
- Added `docs/community-ingestion-api-plan.md` to plan Google Sheets, web,
  bulk-upload, API, and AI-agent contribution paths through staging,
  validation, review, adjudication, and master ingestion.
- Added a proposed ingestion spec for historical NZ place-density evidence so
  research assistants can source data while the pipeline preserves manifests,
  site-observation fields, review states, privacy checks, and aggregation rules.
- Added a planning note on the problem of reconstructing true 2013 and 2018 NZ
  place density, including evidence-tiered source paths through OSM history,
  Charities Services, Incorporated Societies, LINZ building/property data, and
  denominational or local records.
- Added a planning rationale for the first NZ `area_summary_ta.json` frontend
  wiring, documenting why overlays now consume a provenance-rich analytical
  product rather than browser-derived legacy census tables.
- Added a planned NZ interface-alignment pass so the regional map can adopt
  the global map's basemap, control, legend, popup, and attribution style after
  the area-summary overlay stabilises.
- Wired the New Zealand territorial-authority map overlay to
  `area_summary_ta.json`, including census-year controls, area-summary metrics,
  and denominator/source/boundary/quality context in popups and legends.
- Defaulted the global map on `placesmap.org` to the MapTiler Backdrop basemap
  when available, with CARTO retained as the fallback.
- Made `AGENTS.md` the canonical repo-local agent guidance and removed the
  repo-root `CLAUDE.md` symlink.
- Added the first New Zealand territorial-authority `area_summary` contract,
  generator, and static JSON/CSV outputs for portal layers and downloads.
- Added JSON Schemas for `source_dataset`, `indicator`,
  `indicator_observation`, `visual_layer`, and `area_summary`.
- Added 2023 Census religious-affiliation data to the New Zealand territorial
  authority workflow while preserving 2013 and 2018 snapshots.
- Added grant-aligned planning notes and a versioned `research/` workspace for
  global country-source feasibility audits.
- Ignored local `grant/` materials while allowing lightweight `research/` notes
  to be tracked.
- Reworked the top of `README.md` to better describe the project as a research portal in development, fixed external-facing wording errors, and moved OpenStreetMap editing guidance lower in the document.
- Added a planning note that `extendr` is the preferred optimisation path for future R bottlenecks, rather than rewriting the research pipeline away from R.
- Ported the global cleaning, deduplication, and review-queue stages to R as `scripts/clean_global_places.R`, `scripts/deduplicate_global_places.R`, and `scripts/build_global_review_queue.R`.
- Confirmed R-stage parity on the existing NZ `undated` snapshot: `4,632` cleaned records, `0` deduplicated removals, and `1,438` queued records.
- Marked the R scripts as the canonical research-facing global pipeline, with the equivalent Python scripts retained only as transitional references.
- Added a root `pyproject.toml`, `.python-version`, tracked `uv.lock`, and a `uv`-managed Python dependency workflow for scripts and the API.
- Removed the incompatible explicit `starlette` pin from `api/requirements.txt` and the new `pyproject.toml`, allowing `fastapi` to resolve a compatible version.
- Moved `pyarrow` to an optional `fast-parquet` extra because it is only used as an optional API fast path and does not currently build cleanly in the default Python 3.14 environment.
- Added `scripts/deduplicate_global_places.py` as a conservative global deduplication stage between cleaning and review-queue generation.
- Updated `scripts/build_global_review_queue.py` to consume deduplicated country outputs when present, while still falling back to cleaned outputs.
- Added `scripts/clean_global_places.py` for conservative deterministic cleaning of normalised global country datasets and `scripts/build_global_review_queue.py` for per-country review queues.
- Added the first global intermediate outputs from the existing NZ normalised snapshot:
  - `data/intermediate/global/undated/nz_places_cleaned.json`
  - `data/intermediate/global/undated/nz_places_deduplicated.json`
  - `data/intermediate/global/undated/nz_duplicate_resolutions.json`
  - `docs/review_queues/undated/nz_review_queue.csv`
  - `docs/review_queues/undated/nz_review_queue.md`
- Recorded the first strict deduplication test result for NZ: `0` records removed from `4,632` cleaned records, indicating that the current rules are not collapsing co-located but distinct congregations.
- Refactored `scripts/extract_global_data.R` into a raw extractor and added `scripts/normalize_global_places.R` as the first explicit global normalisation stage.
- Added an audit of `scripts/extract_global_data.R` and a staged draft workflow for global extraction, cleaning, review queues, and publication.
- Clarified that countries, including NZ, may have multiple coexisting boundary tessellations that are not strictly nested.
- Added proposed NZ pilot defaults for fixed-boundary comparison outputs, hybrid site matching, and the minimum country download contract.
- Added a country backend scheme and decision log for country-specific downloads, area assignment, and temporal tracking.
- Set `1 September` as the planning anchor date for annual longitudinal snapshots and noted Google Drive as temporary holding rather than the long-term record.
- Rewrote `PLANNING.md` as the active redevelopment roadmap and planning source of truth.
- Marked `docs/data-pipeline-architecture.md` as technical reference rather than the active roadmap.
- Added `docs/nz-data-cleanup-audit.md` to record the first NZ false-positive cleanup pass.
- Added `docs/nz-manual-review-queue.md` and `docs/nz-manual-review-queue.csv` for ambiguous NZ records that need human review.
- Applied a second NZ cleanup pass to remove low-information placeholder and generic worship-label records.
- Applied a third NZ cleanup pass to remove seven `Masonic Centre` records from the `hall_centre_house_site` review bucket.
- Applied a fourth NZ cleanup pass to remove church-hall and parish/community-centre support buildings that duplicated nearby mapped churches.
- Applied a fifth NZ cleanup pass to remove generic hall support buildings that duplicated nearby mapped churches, plus one `Masonic Hall` false positive.
- Applied a sixth NZ cleanup pass to remove weak generic centre records that duplicated nearby mapped worship sites.
- Rebuilt `apps/regions/nz/data/ta_aggregated_data.json` from official TA boundaries and Stats NZ religion data.
- Removed NZ frontend TA code remapping now that TA keys align with official boundary codes.
- Added a conservative NZ place-cleaning script and removed obvious non-worship records from published NZ datasets.
- Added a review-queue generator for staged NZ manual cleanup work.
- Tightened the legacy OSM extractor to reject obvious non-worship facilities with weak religious tags.
- Clarified NZ inclusion scope in `README.md`, including Chatham Islands coverage and current exclusions.
- Introduced `apps/global` and `apps/regions/nz` structure for frontends.
- Added legacy URL shims for `/`, `/enhanced-places.html`, and `frontend/` + `src/` paths.
- Added root `PLANNING.md` and consolidated planning notes.
- Added README guides for `apps/`, `apps/regions/nz/`, `data/`, `scripts/`, and `schemas/`.
- Aligned deployment strategy doc with the current static + tile server architecture and Rust plan.
- Added an operations runbook for GitHub Pages + Martin tile server workflows.
- Expanded the runbook with a step-by-step tile refresh guide and a forensics checklist.
- Redacted DNS record values in the runbook and replaced them with placeholders.
- Added a git-ignored `ops/private-ops-notes.md` template for sensitive details.
- Documented current data storage locations and an auditable tracking plan.
- Added an OSM snapshot/diff strategy to the data storage plan.
- Added JSON templates for snapshot and diff manifests.
- Consolidated planning content into `PLANNING.md` and reduced `docs/data-storage.md` to inventory-only.
- Noted `PLANNING.md` as the single planning source in `README.md`.
- Allowed `apps/regions/**/data` to be tracked and prepared NZ data files for deployment.
- Tracked NZ boundary GeoJSON files in `apps/regions/nz/data` to fix 404s.
- Updated Enhanced NZ data pipeline scripts to emit into `apps/regions/nz/data` while preserving legacy outputs.
- Switched global map Enhanced NZ link to a relative path for local and production parity.
- Made Enhanced NZ data loading resilient to `/apps/regions/nz/` and legacy URL entry points.
- Normalised coordinates from vector tiles to restore Street View links at low zoom.
- Added a Rust migration plan for data ingestion + API in `PLANNING.md`.
- Added a draft decision log section to `PLANNING.md`.
- Added an initial open decision entry for the Rust feasibility test (aka 'Spike').
- Added decision placeholders for regional data storage and portal adapter strategy.
- Renamed Enhanced NZ app path to `apps/regions/nz` for scalable regional naming.
- Removed root-level NZ data files and legacy `src/` data copies (now only in `apps/regions/nz/data`).
