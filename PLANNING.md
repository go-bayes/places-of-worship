# Planning

This file is the active planning source for the repository.

Use it for current priorities, design detail, sequencing, and open questions.
Use `ROADMAP.md` for high-level phases, `JOURNAL.md` for decisions and
rationale, and `CHANGELOG.md` for durable progress.

## Planning rules

- Put active priorities here before changing roadmap-related docs elsewhere.
- Keep `ROADMAP.md` directional. It should explain phases and non-goals, not
  duplicate this file's task list.
- Keep evidence governance and research outputs coupled. New ingestion or
  review work should also explain how the resulting changes will appear in
  maps, downloads, visualisations, and reproducible analysis workflows.
- Treat `docs/` as supporting reference unless a document explicitly replaces a
  section here.
- Prefer deterministic pipelines over one-off manual cleanup.
- Reserve manual review for ambiguous cases that cannot be resolved safely by
  rule.
- Record scope decisions here when they affect inclusion, exclusion, or
  interpretation of data.

## Current state

As of 30 April 2026:

- The global static app lives in `apps/global/`.
- The NZ regional app lives in `apps/regions/nz/`.
- NZ territorial authority codes now align with official boundary codes.
- The NZ places dataset has been reduced from 4,718 committed records to 3,618
  after staged cleanup passes.
- The NZ manual review queue currently contains 719 records in
  `docs/nz-manual-review-queue.md`.
- The NZ cleanup workflow is now documented and auditable:
  - `scripts/clean_nz_places.py`
  - `scripts/build_nz_review_queue.py`
  - `docs/nz-data-cleanup-audit.md`
- The legacy global extractor remains too permissive for research-grade use.
- `scripts/extract_global_data.R` is the best starting point for a replacement
  global pipeline, but it still needs explicit cleaning, deduplication, review
  queues, and run manifests.
- Some source extracts and intermediate files may currently only exist in
  Google Drive. Treat Google Drive as temporary holding, not the long-term
  system of record.
- The original grant materials are stored locally in `grant/`, which is ignored
  by Git. Use them as the reporting reference when planning deliverables,
  country expansion, and justified shifts in scope.
- A first New Zealand territorial-authority `area_summary` contract now exists
  through `schemas/area-summary.schema.json`,
  `scripts/build_nz_area_summary.R`, and
  `apps/regions/nz/data/area_summary_ta.json`. This first product combines
  current committed place counts with 2013, 2018, and 2023 Census religion
  denominators, and flags that the place counts are current rather than
  historical.
- A separate community and agent-assisted ingestion plan now lives in
  `docs/community-ingestion-api-plan.md`. It treats Google Sheets as a first
  research-assistant adapter and defines a future staging API for human,
  scripted, community, and AI-agent contributions.
- Any workflow that accepts incoming data must be designed with an explicit
  security and trust boundary. Submissions are untrusted input until validated,
  reviewed, permission-checked, and accepted through a staged audit path.
- The NZ verification page now defaults to the demo action-builder surface for
  the RA pilot. A `?demo=0` mode preserves the read-only view. Demo mode must
  continue to state clearly that data is not saved or submitted and should not
  contain private or sensitive information.
- A separate master-data verification plan now lives in
  `docs/master-verification-workflow-plan.md`. It defines read-only site
  bundles, automated checks, review queues, staged verification decisions,
  agent-readable data dumps, and map verification layers for NZ and global
  scale.
- Initial RA-facing historical site evidence templates now live in
  `docs/templates/ra-historical-site-evidence/`. They provide Google
  Sheets-ready CSV tabs, including a wide human-entry sheet for source-backed
  lifecycle evidence, source metadata, site observations, candidate matches,
  review notes, controlled vocabularies, and privacy/licence instructions.
- `docs/ra-map-triage-guide.md` now defines the interim RA map-to-spreadsheet
  workflow for missing current sites, duplicate records, disappeared sites,
  complicated worship functions, NZ verification priorities, and
  2013/2018/2023 target-year states. This is the current bridge until the map
  can accept authenticated staged proposals directly.
- The NZ verification map now includes provisional 2013, 2018, and 2023
  target-year controls. These controls use explicit target-year fields when
  available and otherwise derive a provisional status from OSM `start_date`,
  `old_start_date`, and `end_date`. This is an RA triage aid, not an accepted
  historical reconstruction.
- In demo mode, the NZ verification map now includes a local RA action builder
  that turns the selected task, target-year statuses, source details, related
  ids, and evidence note into a spreadsheet-ready wide evidence row plus review
  JSON. This is a usability bridge only: it does not save, submit, authenticate,
  or write to staging.
- Street-level imagery and direct field observations are first-class RA
  evidence sources. Use `source_type = street_imagery` for dated imagery
  providers such as Google Street View, Apple Look Around, Mapillary, KartaView,
  Bing Streetside, or equivalent services, and use
  `source_type = field_observation` for approved RA or project-team site visits.
  Record provider, link or agreed reference, capture or visit date, and a
  short site-level visual claim; do not store screenshots, photos, videos, or
  private observations in Git.
- Selected NZ verification tasks now display a concrete task brief before the
  findings form. The brief turns priority, suggested action, target year, and
  automated checks into an RA-facing checklist.
- `docs/ra-nz-pilot-task.md` now defines the current time-bounded RA task:
  start from the NZ verification map, build a small mixed pilot batch, use the
  action builder and spreadsheet for evidence, and leave command-line
  validation and staging to the project team unless explicitly asked. Until
  authenticated save exists, the persistent working surface is a
  project-controlled Google Sheet in the project team's private Google Drive
  workspace. The sheet link should be supplied directly to the RA and should
  not be committed to GitHub. CSV export comes from that spreadsheet only when
  requested.
- CLI and staging support docs that are not essential to RA map work now live
  under `docs/development/` so the RA path stays focused on the UI and working
  spreadsheet.
- Frontend path: prototype the RA workbench as controls on the current static
  map before committing to a Leptos or equivalent authenticated application.
  Revisit Leptos once the action vocabulary, staged event contract, and review
  ergonomics are stable enough to justify a persistent portal.
- A separate portal data-entry planning hub now lives in
  `docs/portal-data-entry-plan.md`. It defines the first authenticated
  New Zealand staging pilot, with Google Cloud as the backend baseline, managed
  Google OAuth/Identity Platform for auth, Cloud Run for a Rust API,
  Cloud SQL/PostGIS for staging and review data, Cloud Storage for quarantined
  images and raw submissions, no direct master writes, and GitHub only as an
  optional audit mirror.
- `CRITIQUE.md` records a critical review of the revisions pipeline for
  RA-submitted location and denomination evidence. The first schema response is
  `schemas/change-event.schema.json` plus
  `schemas/geometry-history.schema.json`, after deciding that `site_id` tracks
  a mappable place rather than a congregation that relocates.

## Near-term RA UI requirements

The RA pilot should keep the map as the starting point and make the spreadsheet
row an output of the UI, not a separate conceptual workflow.

### New places of worship

RAs need a clear way to nominate places of worship that are not already on the
map. The current nomination panel is only a local JSON preview. The next
iteration should make it behave like the selected-site action builder:

1. Add a visible `New place` or `Nominate place` control near the task list.
2. Let the RA choose the case type: current PoW missing from map, lost PoW
   present at a target year, approximate historical congregation, shared
   building, or uncertain candidate.
3. Let the RA place the candidate by clicking the map, entering latitude and
   longitude, or entering an address/locality. Store the geocoding basis and
   confidence explicitly.
4. Before producing a row, show nearby existing sites and ask the RA whether
   the candidate may match, duplicate, share a building with, or succeed one of
   them.
5. Produce the same wide evidence row shape as selected-site work, with a
   `candidate_site_id`, blank `matched_current_site_id` unless a plausible
   match exists, and `review_status = needs_review`.
6. Keep all output local until authenticated staging exists. Future backend
   staging should mint durable candidate ids only after validation and review.

### Working spreadsheet provisioning

The pilot should use project-owned Google Sheets, not RA-owned copies, as the
temporary evidence store. The simplest version is one project-controlled
working sheet shared directly with the RA. The next iteration should automate
sheet provisioning from a locked project-owned template:

1. Create one workbook or tab per RA, batch, or assigned work period in the
   project Google Drive workspace.
2. Keep project ownership and grant the RA edit access.
3. Lock headers and validation columns where possible so the wide evidence
   schema is not accidentally changed.
4. Prefill batch metadata such as RA id, batch id, assignment date, target
   country, and target-year set.
5. Keep the sheet link out of GitHub and revoke access when the work period
   ends.
6. Later, let the authenticated map/portal request or assign a project-owned
   working sheet automatically.

Avoid making RA-owned sheets the default system of record. RA-owned copies make
offboarding, retrieval, permissions, and audit trails harder.

The first provisioning helper is `scripts/build_ra_working_sheet.py`, which
builds a gitignored `.xlsx` import workbook from
`docs/templates/ra-historical-site-evidence/`, including frozen headers,
filters, and main-tab controlled-field dropdowns. Import that workbook into
Google Drive as a native Sheet, then share the project-owned Sheet directly
with the RA. Keep the private Sheet URL out of repository docs.

### Target-year and lifecycle evidence

For NZ estimation work, every row generated by the map should make the three
target years explicit:

1. For 2013, 2018, and 2023, record one of `present`, `absent`, `uncertain`, or
   `not_assessed`.
2. Require a short evidence note for every target year marked `present`,
   `absent`, or `uncertain`; do not infer target-year state from prose alone.
3. Keep building existence separate from worship use. A visible church building
   does not prove active worship use at a target date.
4. Preserve lifecycle evidence even when it does not settle a target year:
   organisation founded date, site opened date, building opened or dedicated
   date, first seen, last seen, closure, changed use, relocation, demolition,
   and the not-earlier-than/not-later-than bounds for origin and closure.
5. Capture date precision and evidence basis with each lifecycle date. Exact
   dates, years, bounded intervals, and source inferences should remain
   distinguishable for later reconstruction.
6. For future analysis, keep raw denomination/tradition, shared-use,
   multi-purpose, and organisation-site link evidence even if the current pilot
   cannot yet translate it into accepted schema events.

## Redevelopment objective

Rebuild the data pipeline so that global and regional outputs are:

- reproducible
- auditable
- deterministic by default
- conservative about inclusion
- explicit about ambiguous cases
- ready for temporal extension

The working model is:

1. extract raw source data
2. normalise to a stable schema
3. apply deterministic inclusion and exclusion rules
4. deduplicate obvious support buildings and weak duplicates
5. emit review queues for ambiguous residual cases
6. apply explicit reviewed overrides
7. attach research indicators to spatial and temporal units
8. publish app-ready outputs plus run metadata
9. present selected indicators through map layers, downloads, and portal views

## Immediate priorities

### 1. Stabilise NZ as the reference implementation

- Finish the remaining NZ manual review queue in staged batches.
- Convert ad hoc NZ cleaning logic into named rule groups.
- Write a clear NZ inclusion policy for edge cases:
  - school chapels
  - retreat centres
  - prayer houses
  - temporary worship sites
  - demolished or historical sites
- Keep NZ as the test case for any new global cleaning rule before wider use.

### 2. Rebuild the global extraction path

- Make `scripts/extract_global_data.R` the source of truth for new global
  extraction work.
- Stop relying on broad `religion=*` capture as a primary inclusion rule.
- Use a conservative global inclusion baseline:
  - `amenity=place_of_worship`
  - explicit religious buildings such as `church`, `mosque`, `temple`,
    `synagogue`, `chapel`, `cathedral`, `shrine`, and other clearly religious
    building types where justified
- Emit one raw extract per country and one cleaned output per country.
- Keep the legacy Python extractor only as archive/reference until parity is
  confirmed.
- Keep the research-facing global pipeline in R so collaborators can review,
  modify, and rerun it directly.
- Keep the default Python environment lightweight. Install the API prototype,
  Parquet fast path, or archived legacy dependencies only through explicit `uv`
  extras.

### 3. Build a deterministic cleaning pipeline

- Separate pipeline stages:
  - raw extract
  - normalised country dataset
  - cleaned country dataset
  - review queue
  - reviewed override layer
  - published output
- Add a shared cleaner for cross-country rules.
- Keep country-specific override files separate from shared logic.
- Add deterministic duplicate rules for obvious adjunct buildings:
  - halls
  - centres
  - houses
  - parish facilities
  - youth facilities
- Generate machine-readable review queues per country for ambiguous cases.

### 4. Add provenance and run tracking

- Record retrieval date, source, script path, and pipeline commit for each run.
- Emit counts and checksums per country.
- Keep lightweight manifests in-repo.
- Move from ad hoc Google Drive storage to immutable dated snapshots plus
  manifests.
- Store large immutable snapshots and diffs outside the repo when needed.
- Make it possible to answer:
  - what changed
  - when it changed
  - why it changed
  - which rule or review decision caused it

### 5. Define temporal scope before time-slice work begins

- Anchor annual snapshots to `1 September` each year.
- Decide how to represent:
  - demolished places
  - historical-only places
  - approximate locations
  - renamed congregations in the same structure
  - temporary displacement during reconstruction
- Reprocess all prior annual snapshots whenever the cleaning rules change, so
  measured differences reflect site change rather than pipeline drift.
- Keep temporal design compatible with static published outputs and future API
  work.

### 6. Keep frontend and backend expectations aligned

- Preserve current JSON output contracts for the NZ app unless there is a clear
  migration plan.
- Update manifests and counts whenever published data changes.
- Keep Martin tiles plus static JSON as the current delivery path.
- Treat any Rust API work as a later implementation option, not a prerequisite
  for data cleanup.

### 7. Design the country backend pattern before scaling beyond NZ

- Use NZ as the pilot country, but do not hard-code NZ boundary assumptions into
  the shared data model.
- Assume that countries may have multiple coexisting tessellations or area
  systems, including systems that are not strictly nested within one another.
- Define a generic country backend pattern that separates:
  - site identity
  - yearly site state
  - boundary definitions
  - site-to-area assignment
  - downloadable products
- Treat country-specific geography as adapter logic, not as the core schema.
- Make the backend able to serve both:
  - map-ready responses
  - downloadable tabular and spatial outputs
- Keep country-level downloads compatible with future temporal comparisons.

### 8. Align country expansion with the grant

- Maintain `research/` as the working directory for country-source audits and
  global feasibility notes.
- Evaluate candidate countries by:
  - places-of-worship coverage
  - religious affiliation, practice, membership, or congregation data
  - area-level social, demographic, economic, health, charity, conflict, or
    fertility data
  - temporal depth
  - boundary availability and stability
  - licence and access constraints
  - collaborator or validation feasibility
- Record when the project shifts away from an anticipated grant pathway, and
  explain whether the change follows from data access, measurement quality,
  ethics, collaborator availability, or technical feasibility.
- Keep New Zealand as the proof-of-concept country while the global survey
  identifies viable next countries.

### 9. Update NZ census inputs

- Add 2023 Census data to the existing New Zealand territorial-authority
  religion workflow.
- Prefer direct Stats NZ API access for the durable pipeline, but use the
  existing Figure.NZ extract as a short-term bridge where it preserves
  provenance and reproducibility.
- Treat 2023 as an added snapshot rather than a replacement for 2013 and 2018.
- Update the map interface after the data are available so users can select or
  clearly see the census year used in overlays and exports.

### 10. Plan community and agent-assisted ingestion

- Use `docs/community-ingestion-api-plan.md` as the supporting design note for
  contribution workflows.
- Treat Google Sheets as the first contributor interface for research
  assistants, but keep the durable contract in a staging API and validated data
  model.
- Make the ingestion path support:
  - human research assistants
  - community contributors
  - trusted scripts
  - institutional bulk uploads
  - AI agents that submit source-backed draft evidence
  - AI agents that review source-backed submissions
- Do not allow any contributor interface or AI agent to write directly to the
  master dataset.
- Treat every intake channel as a security surface. Before any public or
  semi-public write path exists, define authentication, authorisation, rate
  limits, spam/abuse handling, file-type and size limits, malware scanning for
  uploads, structured validation, logging, and a review quarantine for new or
  low-trust contributors.
- Use a managed authentication service for identity. Do not build or store
  passwords, password reset flows, multi-factor authentication, or login
  sessions ourselves. The project should consume standards-based identity
  tokens, then map authenticated contributors to project permission scopes such
  as submit-only, review, adjudicate, and master-commit.
- Keep private contact details, credentials, restricted source files, and raw
  uploads out of Git and public static products unless a reviewed source
  contract explicitly permits publication.
- Require raw source snapshots, source metadata, validation results, review
  states, adjudication decisions, and run manifests before accepted rows affect
  published outputs.

### 11. Build a scalable master-verification layer

- Use `docs/master-verification-workflow-plan.md` as the supporting design note
  for verifying records already in the master dataset.
- Expose master data through read-only site bundles rather than editable master
  rows.
- Generate automated checks for geometry, area assignment, duplicates, OSM
  history, source references, lifecycle consistency, target-year status,
  licence flags, and privacy flags.
- Write verification decisions to staging or audit tables before any master
  change is proposed.
- Support:
  - NZ reviewer workflows for roughly 3,000+ sites
  - country and tile partitions for global verification
  - agent-readable data dumps for offline or asynchronous review
  - map layers that show verification status, uncertainty, duplicate risk, and
    temporal evidence coverage
- Treat automated "no-action" decisions as auditable review outcomes, not as
  silent passes.
- Keep AI agents read-only against the master database. They may propose
  decisions with source citations, confidence, and rationale, but master changes
  require the same adjudication path as human reviews.

### 12. Define a Rust-backed data-modification pipeline

- Use Rust where strictness, auditability, and reproducible state changes matter:
  validation, staging, identity, event application, master rebuilding, and
  export generation.
- Keep R as the investigator-facing layer for research analysis, summaries,
  plots, reports, and exploratory workflows. Rust should support the research
  pipeline rather than replace it.
- Do not mutate the master directly. Incoming records, RA spreadsheets,
  community submissions, uploaded files, scripts, and AI proposals should become
  staged proposals with source evidence and validation output.
- Treat raw inputs as immutable snapshots. Preserve the source file or export,
  retrieval metadata, checksum, parser version, and schema version before any
  parsed row is accepted.
- Define typed contracts before implementation. First-class entities should
  include `site`, `site_snapshot`, `source_dataset`, `site_observation`,
  `lifecycle_event`, `change_event`, `geometry_history`, `review_decision`,
  `change_proposal`, `accepted_change`, and `run_manifest`.
- Prefer append-only change events over silent row overwrites. Examples include
  `site_created`, `site_location_corrected`, `site_closed`,
  `denomination_changed`, `duplicate_merged`, `proposal_retracted`, and
  `proposal_superseded`.
- Require dry-run and diff output before accepting a batch. The first `pow diff`
  should show reviewer-facing consequences that can be derived directly from
  staged events: records added, modified, retired, validation warnings, source
  coverage, per-site changesets, target-year affects, and identity-decision
  flags.
- Treat changes in worship function as analytical data, not only database
  maintenance. A diff that establishes that a place of worship appeared, ceased
  worship use, changed denomination, became multi-denominational, became
  multi-purpose, split across several worship uses, or merged uses within one
  site must be preserved as a reviewed event with effective time and evidence.
  These functional transitions are mission-critical for density estimates,
  target-year reconstructions, and longitudinal analysis.
- Separate evidence from conclusions. A source observation can state what a
  directory, OSM history, charity record, or visual check shows; a reviewed
  conclusion can then assign target-year status, confidence, and analytical
  meaning.
- Make temporal state first-class. The model must support exact and bounded
  dates, target-year status, openings, closures, moves, shared buildings,
  denomination changes, changed use, demolition, and uncertain locations.
- Focus lifecycle and diff semantics on worship use at a site, not merely on
  whether a building exists. Building existence, demolition, and rebuilding are
  evidence and structure-history facts; the analytical question is whether the
  site functioned as a place of worship for specified traditions, organisations,
  and target years.
- Treat `site_snapshot` rows as derived caches. Accepted change events should be
  replayed into snapshots by `pow rebuild-master`; consumers should not edit
  snapshots directly.
- Keep outputs researcher-friendly: CSV for simple downloads, GeoJSON for
  browser layers, GeoParquet or Parquet for larger analytical products, and
  plain validation reports that R can consume.

First Rust CLI sketch:

```sh
pow validate batch.csv
pow stage batch.csv
pow diff staged_batch_id
pow accept staged_batch_id
pow rebuild-master
pow export nz --format geojson
```

Start with invariants and event models before writing the implementation. The
first useful implementation target is a local CLI that validates and diffs a
small staged NZ evidence batch without writing to the master.

Implementation note: `pow validate`, `pow stage`, `pow propose`, and the
first `pow diff` reviewer report now exist under `crates/pow-cli`. They are
local and CI-facing validation, staging, propose, and diff surfaces, not
something the static HTML map should call directly. The eventual authenticated
map should submit to a backend API that reuses the same validation rules,
stages submissions, and returns reviewable proposal records. Static map
products should continue to consume reviewed exports. The first local staging
database is plain SQLite at `.pow/staging.sqlite` by default.

`pow propose --persist` writes its emitted events as a derived batch in the
same staging database, with each event stored as a `stage_records` row
(`record_kind = 'proposed_event'`) and the new batch linked to its source via
`stage_batches.parent_batch_id`. `pow diff <batch_id>` reads any batch whose
records are change events (proposed or staged JSONL) and produces a
reviewer-facing report covering per-site changesets, per-target-year
transitions, validation warnings, and source coverage; with `--report json`
it also produces a stable machine-readable artefact for downstream R
workflows. The `pow diff` v1 contract intentionally stops short of full
state reconstruction and identity-decision rendering.

Full reconstructed research artefacts such as `before.geojson`,
`after.geojson`, `area_summary_diff.csv`, density estimates, and map/export
effects belong with `pow rebuild-master` and later export commands, because
they require replaying accepted events into complete site snapshots. `pow diff`
v1 should still produce machine-readable JSON alongside the human report so the
later rebuild/export layer can reuse the same event interpretation.

Because this contract is still pre-release, do not preserve awkward schema
shapes for backward compatibility. Update examples, tests, and templates
together while portal intake, review decisions, accepted-event replay, and
master rebuilds are still absent. The priority is a coherent event model that
can represent worship-function change directly.

Next priority after `pow diff` v1:
wire the minimal save/evaluate/review loop for the New Zealand RA pilot. The
near-term flow is shared spreadsheet or map-assisted row -> `pow stage` ->
`pow propose --persist` -> `pow diff` reviewer report -> explicit reviewer
decision. This still must not write directly to the master database.

### 13. Plan the authenticated portal data-entry pilot

- Use `docs/portal-data-entry-plan.md` as the hub for the authenticated
  contribution portal.
- Split the design into focused supporting plans:
  - `docs/portal-entry-ui-plan.md`
  - `docs/portal-database-storage-plan.md`
  - `docs/portal-submission-review-plan.md`
  - `docs/portal-auth-security-plan.md`
  - `docs/portal-media-and-provider-evaluation-plan.md`
- Treat the first milestone as an invite-only New Zealand staging pilot.
- Replace the current external correction route with a project "Fix or modify
  data" path that sends authorised users through managed auth before reaching a
  global-map-style edit surface.
- Let contributors search by address, place name, locality, or coordinates;
  select an existing point or clear building outline; and fall back to a point
  when building selection is absent or ambiguous.
- Allow image uploads only into private quarantine in the first version. Defer
  video until upload security, review, storage cost, licence, and moderation
  rules are proven.
- Use Google Cloud as the backend baseline: Google OAuth/Identity Platform,
  Cloud Run, Cloud SQL/PostgreSQL with PostGIS, Cloud Storage, and asynchronous
  validation jobs through Pub/Sub or Cloud Tasks.
- Defer Convex and SpacetimeDB evaluation until the submission, review, audit,
  and master-ingestion contracts are stable.
- Keep public map products downstream of reviewed exports. Unreviewed portal
  submissions should not appear on the public map or in the master database.

## Deterministic cleaning strategy

The default policy should be:

- deterministic rules for obvious false positives and obvious duplicates
- manual review only for the ambiguous tail

This means:

- no broad manual editing of published JSON as the main workflow
- no irreversible cleanup steps without an audit trail
- no country-by-country eyeballing except as validation or queue resolution

The deterministic rule classes should be:

- hard exclusion
  - cemeteries
  - schools without separately mapped worship space
  - childcare
  - offices
  - residences
  - pubs
  - clearly non-worship community facilities
- hard inclusion
  - `amenity=place_of_worship`
  - explicit religious buildings where naming and tags agree
- duplicate-support-building removal
  - halls, centres, houses, and adjunct facilities beside a clearly mapped
    primary worship site
- review-queue classification
  - weak names
  - missing core tags
  - institutional edge cases
  - retreat and prayer sites
  - historically ambiguous records

## Country backend scheme

Detailed reference: `docs/country-backend-scheme.md`.

The country-specific backend should be organised around the following entities:

- `site`
  - stable internal identifier for the place of worship
  - should not depend solely on a current OSM object id
- `site_snapshot`
  - the state of a site as of `1 September YYYY`
  - includes name, denomination, status, geometry, confidence, and source links
- `boundary_set`
  - identifies a country-specific administrative geography and vintage
  - examples: NZ TA 2025, NZ SA2 2018, UK LAD 2023
- `area_unit`
  - a single area within a boundary set
  - includes code, name, level, parent linkage, and geometry
- `site_area_assignment`
  - links a site snapshot to an area unit under a specific boundary set
  - must be date-aware or boundary-set-aware
- `manual_override`
  - reviewed corrections, inclusions, exclusions, and status fixes
- `run_manifest`
  - records source snapshot, pipeline version, counts, checksums, and outputs
- `source_dataset`
  - records source name, provider, licence, URL, retrieval date, citation,
    access limits, redistribution limits, and local snapshot reference
- `indicator`
  - defines a measured quantity, unit, denominator, method, temporal coverage,
    spatial coverage, and quality notes
- `indicator_observation`
  - links an indicator value to a `site`, `site_snapshot`, `area_unit`,
    country, or grid cell for a specific time period
  - records value, denominator where relevant, quality flag, suppression flag,
    and `source_dataset_id`
- `visual_layer`
  - defines how an indicator is exposed on the map or portal
  - records layer type, legend, colour scale, time control, aggregation rule,
    uncertainty display, and default visibility

The backend should produce these kinds of country outputs:

- cleaned site rows
- source and indicator catalogues
- site-to-area assignments
- area-level summaries
- area-level indicator observations
- map layer products
- downloadable extracts
- metadata and provenance files

The backend should support at least these output forms:

- CSV for downloads and statistical work
- GeoJSON for simple browser-facing spatial layers
- Parquet or GeoParquet for analytical spatial outputs
- precomputed JSON or vector tiles for map layers where this is faster or
  smaller than live queries
- metadata JSON for provenance and reproducibility

## Storage and serving defaults

- Keep immutable raw source snapshots outside the Git repository when they are
  too large, sensitive, or licence-restricted for Git.
- Keep lightweight manifests, schema definitions, source citations, checksums,
  and transformation code in Git.
- Treat Google Drive as working storage only. The durable system of record
  should be immutable dated snapshots plus manifests.
- Use CSV for analyst-facing downloads where tabular structure is enough.
- Use GeoParquet for spatial analytical products once outputs are larger or
  richer than simple GeoJSON.
- Use static JSON, GeoJSON, or vector tiles for the map while the required
  products can be precomputed reproducibly.
- Add PostGIS only when the portal needs live spatial queries, authenticated
  research workspaces, or query combinations that are too expensive to
  precompute.

## Country backend design principles

- The global map and country maps can share site data, but country backends need
  richer area and download functionality.
- Area assignment must be explicit and reproducible. Do not derive it ad hoc in
  the frontend.
- Countries may have multiple coexisting area tessellations for different
  purposes such as administration, census, health, education, or electoral
  analysis.
- These tessellations may be nested, partially nested, or non-nested.
- Boundary changes over time must be treated as a methodological issue, not an
  implementation detail.
- Country-specific geography should be provided by adapters with a shared
  contract.
- NZ is the pilot implementation, not the universal template.
- Research indicators should attach to explicit units and time periods rather
  than being hard-coded into country frontends.
- Visual layers should be generated from backend metadata so the same indicator
  can appear consistently in map, portal, and download contexts.

## Research data and visualisation layer

The portal should treat research data as observations on explicit units of
analysis. The lowest-level unit remains the place of worship, but the same
model should also support observations on site snapshots, area units, countries,
and regular grids where appropriate.

### Initial source families

- Places of worship:
  - OSM and OSM-derived extracts as the global site backbone
  - Geofabrik/current extracts for efficient country snapshots
  - ohsome or equivalent historical OSM services for later temporal work
- Boundaries:
  - official national boundary products where available
  - geoBoundaries as a global fallback where licensing and quality permit
- Population and settlement context:
  - national censuses for country pilots
  - WorldPop and Global Human Settlement Layer (GHSL) for global covariates
- Religion and social indicators:
  - official census or statistical-office tables where available
  - research-use survey or administrative sources only when licensing,
    geography, and comparability are clear

### Initial NZ product target

Build an `area_summary` product for New Zealand that joins cleaned places of
worship to territorial authority and Statistical Area 2 geographies, then adds
2013, 2018, and 2023 Census religion indicators where available.

Minimum fields:

- `country_code`
- `boundary_set_id`
- `area_unit_id`
- `area_name`
- `year`
- `population_total`
- `religious_affiliation_count`
- `religious_affiliation_percent`
- `no_religion_count`
- `no_religion_percent`
- `place_count`
- `places_per_10000_residents`
- `place_density_per_sq_km`
- `source_dataset_id`
- `quality_flag`

### Rationale for the first NZ overlay wiring

The first territorial-authority overlay now reads from
`apps/regions/nz/data/area_summary_ta.json`. This wiring gives every mapped
area value an explicit unit, census year, boundary set, denominator, source
dataset, and quality flag. That makes the NZ app a test of the portal contract
we need globally: map layers should consume reproducible, validated analytical
products that can also support downloads, citations, and grant reporting.

The previous frontend path drew directly from legacy census-shaped files and
kept several 2018-specific assumptions in controls, legends, and popups. The
new path moves those assumptions into a named data product and makes the
frontend consume the same fields researchers would download. It also keeps the
current limitation visible: place counts come from the current committed
`nz_places.json` snapshot and are repeated across census years, while the
religion denominators are census-year specific. Until dated site snapshots are
available, temporal overlays should therefore be interpreted as changes in
census religion composition and rates against a current place inventory.

### Historical NZ place-density problem

True 2013 and 2018 place density requires a dated count of places of worship in
each area at those dates. The current `area_summary_ta.json` product does not
have that. It calculates `place_density_per_sq_km` from the current committed
`nz_places.json` count divided by fixed territorial-authority land area. This is
useful as a current inventory density, but it should not be interpreted as the
number of places of worship that existed in 2013 or 2018.

For New Zealand, the practical reconstruction path should be evidence-tiered:

- Start with OpenStreetMap full-history data or the ohsome/OSHDB toolchain to
  recover features that were already mapped as places of worship at census
  dates. This gives a reproducible lower-bound series for "known in OSM at the
  date", but not real-world existence.
- Link current and historical OSM candidates to the Charities Services open
  data service where possible. The Charities Register provides registration
  status, registration and deregistration dates, annual returns, activities,
  and address fields, but it describes organisations rather than worship sites.
  One charity may run multiple sites, one site may house several congregations,
  and some worship communities will not be registered charities.
- Use the Incorporated Societies Register as a secondary organisation-history
  source. It can supply incorporation date, status, registered office address,
  documents, annual financial statements and change-of-address filings for
  societies, including many religious or cultural associations. It is still an
  organisation register, so it needs careful site matching and does not cover
  all places of worship.
- Use LINZ NZ Building Outlines, especially the "All Sources" and lifecycle
  tables, to test whether a matched building was visible in aerial imagery near
  the target period. This helps verify built-form existence and changes over
  time, but building outlines do not identify worship use reliably and imagery
  dates vary by region.
- Investigate restricted or application-based property sources, especially the
  National District Valuation Roll / NZ Properties data through LINZ, for land
  use or rating categories. This may be the best national administrative source
  for property-use classification, but access is limited and would require a
  clear research-use request and licence review.
- Add denominational yearbooks, directories, archived websites, local council
  records, and heritage lists as targeted validation sources for ambiguous or
  high-value cases. These sources are likely to be uneven across traditions and
  regions, so they should enrich confidence rather than silently define the
  national denominator.

### OSM temporal verification subproject

OpenStreetMap should become a separate but related temporal verification work
stream. The aim is to estimate whether candidate places of worship existed and
were in worship use in target years such as 2013, 2018, and 2023. This should
not be treated as a direct count from current OSM. It should combine OSM object
history, OSM lifecycle tags, visual evidence, and human or model-assisted review.

Evidence to retain:

- OSM full-history object versions and timestamps for `node`, `way`, and
  `relation` objects tagged as places of worship or likely worship buildings
- OSM lifecycle tags, especially `start_date=*`, `old_start_date=*`, and, where
  used carefully, `end_date=*`
- the fact that previous map iterations used OSM-supplied birth dates, so these
  values should be migrated or re-extracted rather than discarded
- visual aids such as street maps, street-level imagery, aerial imagery, and
  historical maps, with capture dates and source references where available
- target-year state judgements for 2013, 2018, and 2023, with optional
  probabilities and review notes

The output should be a staged evidence layer, not an automatic master update.
For each candidate site and target year, store the evidence basis, OSM version
or tag source, visual verification source, target-year status, optional
probability, and reviewer decision. OSM evidence can then contribute to area
summaries only through the same validation and review gates as other sources.

The verification interface also needs a nomination path for evidence that is
not already represented by a current master/OSM row. This covers current places
of worship absent from OSM, lost places of worship that were present in 2013 or
another target year, and building-level cases where denominations switch,
several congregations share one building, or one building needs to be split
into multiple analytical site records. These nominations should enter staging
with their own ids, source evidence, target-year status, proposed master action,
and links to any nearby master, OSM, building, or organisation records.

For this subproject, "appeared" and "disappeared" should mean appeared or
disappeared as a worship-function observation at the relevant site and time.
A building may continue to exist after worship use ends, and a building may be
visible before a documented worship use begins. Diffs should therefore report
functional changes separately from structure changes: worship use present or
absent, denomination or tradition set, multi-denominational use,
multi-purpose use, organisation links, and confidence for each target year.

Annual charity details may become useful temporal evidence, but they should be
handled as organisation-level observations rather than building-level facts.
Registration, deregistration, annual return, activity, and address fields can
support a site match, yet one charity may operate multiple sites and one
building may host several communities. The ingestion model should therefore
link charity observations to organisations first, then link organisations to
site observations with explicit match confidence and date bounds.

Some historical sources, including theses, denominational histories, and
regional church histories, may contain substantial congregation evidence without
street addresses. These sources should not be forced into precise point
geometry. They may support fuzzy regional placement, such as territorial
authority, parish, town, or locality, and may help back-propagated maps show
probable historical coverage or regional counts. Treat this as a later
evidence-modelling problem: preserve source wording and regional cues now, but
do not let fuzzy placement enter site-level density products until we have
explicit confidence rules and uncertainty visualisation.

The preferred pilot is a 2018 reconstruction for one or two territorial
authorities with mixed urban and rural coverage. Build a `site_observation`
table with `site_id`, `observation_date`, `evidence_source_id`, `evidence_type`,
`matched_address`, `matched_geometry`, `existence_status`, `worship_use_status`,
and `quality_flag`. Then aggregate only observations that meet a stated
evidence rule into historical `place_count`, `places_per_10000_residents`, and
`place_density_per_sq_km`. The area summary should preserve separate quality
flags such as `osm_known_at_date`, `administrative_org_matched`,
`building_visible_use_unconfirmed`, `directory_confirmed`, and
`current_inventory_back_projected`.

Candidate source references to evaluate:

- OpenStreetMap full history:
  <https://wiki.openstreetmap.org/wiki/Planet.osm/full>
- OpenStreetMap places of worship tagging:
  <https://wiki.openstreetmap.org/wiki/Tag:amenity%3Dplace_of_worship>
- OpenStreetMap lifecycle date tags:
  <https://wiki.openstreetmap.org/wiki/Key:start_date>
  <https://wiki.openstreetmap.org/wiki/Key:old_start_date>
  <https://wiki.openstreetmap.org/wiki/Key:end_date>
- Charities Services open data:
  <https://www.charities.govt.nz/charities-in-new-zealand/the-charities-register/open-data/>
- Incorporated Societies Register search:
  <https://is-register.companiesoffice.govt.nz/help-centre/searching-the-incorporated-societies-register/how-to-search/>
- LINZ NZ Building Outlines data dictionary:
  <https://nz-buildings.readthedocs.io/en/latest/>
- LINZ New Zealand Property Spine and NZ Properties access:
  <https://www.linz.govt.nz/our-work/property-information-system/new-zealand-property-spine>

### Historical source ingestion spec

Once research assistants source candidate historical evidence, ingestion should
separate raw capture, source metadata, extracted site observations, human review,
and aggregation. The aim is to let RAs collect heterogeneous evidence while the
pipeline preserves a narrow, reproducible contract.

Proposed storage layout:

- Raw or restricted source files:
  - `data/raw/nz/historical_site_evidence/<source_dataset_id>/<retrieval_date>/`
  - keep out of Git when files are large, licence-restricted, or contain
    personal contact details
  - store only a manifest in Git when the raw data cannot be committed
- Source manifests:
  - `data/raw/nz/historical_site_evidence/<source_dataset_id>/<retrieval_date>/manifest.json`
  - fields: `source_dataset_id`, `provider`, `url`, `retrieval_date`,
    `retrieved_by`, `licence`, `access_limits`, `redistribution_limits`,
    `raw_file_names`, `checksums`, `coverage_dates`, `coverage_geography`,
    `contact_person_or_request_id`, and `notes`
- Extracted evidence table:
  - `data/intermediate/nz/historical_site_evidence/<retrieval_date>/site_observations.csv`
  - one row per source claim about one site at one date, before aggregation
- Extracted lifecycle event table:
  - `data/intermediate/nz/historical_site_evidence/<retrieval_date>/site_lifecycle_events.csv`
  - optional normalised split from the wide RA intake sheet when source evidence
    supports distinct founding, opening, first-seen, last-seen, closure,
    demolition, change-of-use, or relocation events
- Review queue:
  - `docs/review_queues/historical_site_evidence/<retrieval_date>/`
  - used for uncertain site matches, ambiguous addresses, conflicting dates,
    and evidence that confirms an organisation but not a physical worship site
- Publication-ready products:
  - `apps/regions/nz/data/site_observations_YYYY.json` only after review
  - updated `area_summary_ta.json` rows with historical `site_snapshot_date`,
    `place_count_basis`, and quality flags

Minimum `site_observation` fields:

- Identifiers:
  - `site_observation_id`
  - `site_id` or `candidate_site_id`
  - `source_dataset_id`
  - `source_record_id`
  - `source_url_or_file`
  - `retrieval_date`
- Temporal evidence:
  - `observation_date`
  - `observation_date_basis` (for example `census_date`, `directory_year`,
    `registration_date`, `imagery_capture_date`, `annual_return_year`)
  - `evidence_start_date`
  - `evidence_end_date`
  - `date_precision` (`day`, `month`, `year`, `range`, `unknown`)
- Lifecycle evidence, where available:
  - `organisation_founded_date`
  - `site_opened_date`
  - `building_opened_or_dedicated_date`
  - `origin_not_earlier_than_date`
  - `origin_not_later_than_date`
  - `first_seen_date`
  - `last_seen_date`
  - `site_closed_date`
  - `closure_not_earlier_than_date`
  - `closure_not_later_than_date`
  - `building_demolished_date`
  - `use_changed_date`
  - `relocated_date`
  - separate precision fields and raw source wording for each date where
    needed
  - `not_later_than` means the event is known by that date; `not_earlier_than`
    means the event cannot have occurred before that date
- Site matching:
  - `name_raw`
  - `name_standardised`
  - `denomination_or_tradition_raw`
  - `address_raw`
  - `historical_address_raw`
  - `historical_locality_raw`
  - `modern_address_candidate`
  - `address_standardised`
  - `locality_raw`
  - `address_change_note`
  - `geocoding_basis` (`source_coordinates`, `historical_map`,
    `modern_geocoder`, `manual_match`, `existing_osm_site`,
    `gazetteer_or_road_rename`, `property_record`, `unknown`)
  - `geocoding_confidence`
  - `latitude`
  - `longitude`
  - `geometry_wkt` or `geometry_geojson`
  - `matched_osm_id`
  - `osm_object_type`
  - `osm_version_timestamp`
  - `osm_tags_raw`
  - `osm_start_date`
  - `osm_old_start_date`
  - `osm_end_date`
  - `matched_current_site_id`
  - `match_method`
  - `match_confidence`
  - `visual_verification_source`
  - `visual_verification_url_or_file`
  - `visual_verification_capture_date`
  - `visual_verification_summary`
- Status coding:
  - `existence_status` (`present`, `absent`, `uncertain`)
  - `worship_use_status` (`confirmed_worship`, `probable_worship`,
    `organisation_only`, `building_only`, `not_worship`, `uncertain`)
  - `public_access_status` where available
  - `site_type` (`place_of_worship`, `chapel`, `mosque`, `temple`,
    `synagogue`, `marae_church`, `multi_use`, `other`)
  - `quality_flag`
  - `review_status` (`unreviewed`, `needs_review`, `accepted`, `excluded`,
    `deferred`)
  - optional `target_year_probability` for probabilistic review outputs, scaled
    from 0 to 1 and left blank when no explicit probability has been assigned
- Audit fields:
  - `extracted_by`
  - `extracted_at`
  - `reviewed_by`
  - `reviewed_at`
  - `review_note`
  - `exclusion_reason`

RA workflow:

1. Create or update the `source_dataset` metadata before extracting rows.
2. Save raw downloads, screenshots, PDFs, or exported tables in the dated raw
   source folder, or outside Git with a manifest if the source is restricted.
3. Extract fields needed for site existence, worship use, lifecycle dating, and
   matching. Record all source-backed founding, first-seen, opening, closure,
   last-seen, demolition, change-of-use, and relocation evidence rather than
   collapsing it into a single birth or death date.
4. Use bounded date fields when a source supports an interval or limit, such as
   "opened by 2013" or "closed after 2018", without giving an exact event date.
   Do not invent exact dates to make these cases fit a single date field.
5. Do not transcribe officer names, private email addresses, phone numbers, or
   other personal contact details unless a specific approved source contract
   requires them.
6. Normalise names and addresses lightly, preserving raw values beside the
   cleaned fields.
7. Preserve historical addresses separately from modern/geocoded
   interpretation. If streets have been renamed, road alignments have shifted,
   localities have changed, or buildings have been demolished, record the
   address-change note, geocoding basis, and geocoding confidence rather than
   silently replacing the historical address with a modern one.
8. Assign provisional match confidence and review status. Low-confidence
   matches should go to the review queue, not directly into site counts.
9. A second reviewer should resolve rows that affect historical counts. The
   reviewer should record whether the evidence confirms a physical site, only
   an organisation, only a building, or neither.
10. Aggregation scripts should count only observations satisfying the declared
   evidence rule for that product. For example, a conservative 2018 count might
   require `worship_use_status` in `confirmed_worship` or `probable_worship`,
   `existence_status = present`, and `review_status = accepted`.

Template support:

- Use `docs/templates/ra-historical-site-evidence/` as the first spreadsheet
  scaffold for RA evidence collection. `site_evidence_wide.csv` is the primary
  human-entry sheet because it keeps source, place, lifecycle, target-year,
  matching, and review fields in one row. The more normalised CSV tabs are
  reference scaffolds for later ingestion and review splitting. All CSV tabs
  should be treated as a working adapter to this ingestion spec, rather than as
  the durable database.

Validation before aggregation:

- every row has a valid `source_dataset_id` and manifest reference
- every accepted row has a date basis and date precision
- coordinates or matched site identifiers are present for accepted site-level
  rows
- organisation-only evidence is not counted as a place unless linked to a
  physical site
- duplicate evidence from the same source is collapsed before counting
- conflicting evidence is retained but flagged for review
- all outputs report counts by `source_dataset_id`, evidence type, quality flag,
  and review status before replacing `area_summary` products
- any target-year probabilities are bounded between 0 and 1 and trace back to a
  declared evidence rule, reviewer decision, or model-assisted review record

### Map presentation modes

- Site mode:
  - point map of places of worship
  - filters for religion, denomination, confidence, status, source, and
    snapshot date
  - popups that show site provenance and available area assignments
- Area mode:
  - choropleth or bivariate overlays for area-level indicators
  - initial layers should include religious affiliation percentage,
    no-religion percentage, population density, places per 10,000 residents,
    and place density per square kilometre
  - legends should expose census year, denominator, source, and suppression or
    quality flags
- Comparison mode:
  - time slider or year selector for changes across census or snapshot years
  - difference layers for area-level change
  - optional uncertainty or coverage overlays where source quality varies

For the NZ app, remove the current 2018-specific assumptions from overlays,
labels, and popups before presenting 2023 data. Users should always be able to
see which census year, boundary set, and denominator are being displayed.

After the NZ area-summary overlay is stable, align the NZ map interface with
the global map. This should be a restrained UI pass rather than a rewrite:
reuse the global map's basemap defaults, control density, typography, legend
treatment, popup styling, and attribution patterns while preserving the
country-specific TA/SA2 controls and census-year selector. Longer term, extract
shared map-shell CSS and small frontend helpers so country apps and the global
map do not drift apart.

## Country backend pilot plan

### NZ pilot scope

- One cleaned NZ place dataset
- Multiple NZ boundary sets, including systems that may not be strictly nested
  within one another
- One reproducible site-to-area assignment step
- One country download path
- One yearly snapshot comparison path anchored to `1 September`

### Proposed NZ pilot defaults

- Use fixed-boundary outputs as the default longitudinal comparison product.
- Use a hybrid site-identity strategy:
  - deterministic matching first
  - reviewed overrides for difficult cases
- Publish a minimum three-part NZ download contract:
  - cleaned site rows
  - area summaries
  - metadata bundle
- Keep richer or alternative products optional until the pilot is stable.

### Shared contract to define now

- `country_code`
- `boundary_level`
- `boundary_set_id`
- `area_unit_id`
- `site_id`
- `site_snapshot_id`
- `snapshot_date`
- `status`
- `location_confidence`
- `assignment_method`

### Backend product types to support

- raw country place download
- cleaned country place download
- area summary download
- area-by-religion summary download
- source catalogue download
- indicator catalogue download
- indicator-observation download
- map-layer metadata export
- review-queue export
- run manifest and metadata export

## Scope decisions

### Decided: unit of analysis

- The primary unit is the mapped place or building used for worship, not the
  congregation as a social group.

### Decided: current NZ geographic scope

- NZ regional outputs follow the territorial authority geography used in
  `apps/regions/nz/data/territorial_authorities.geojson`.
- This includes Chatham Islands Territory.
- It does not currently include Cook Islands, Niue, or Tokelau.

### Decided: annual snapshot anchor

- Annual longitudinal tracking will be indexed to `1 September`.
- This is intended to align with the timing of the current data pull, which was
  likely completed at the end of August.
- The exact anchor date should remain fixed across years unless there is a
  documented methodological reason to change it.

### Decided: country backend strategy

- Country-specific backends will be built around a shared schema plus
  country-specific boundary adapters.
- NZ will be used as the pilot implementation.
- Area assignment and download products belong in the backend, not only in the
  frontend.
- The shared model must support multiple coexisting area systems within a
  country, including non-nested tessellations.

### Decided: multiple area systems within countries

- The project will treat country geography as potentially multi-tessellation.
- This includes NZ, where different official geographies may coexist for
  different analytical purposes.
- A site may therefore need assignments to more than one boundary set for the
  same snapshot date.

### Decided: NZ pilot boundary comparison default

- The NZ pilot will use fixed-boundary outputs as the default longitudinal
  comparison product.
- Native-boundary outputs may be added later as supplementary products, but
  they will not be the primary comparison series for the pilot.
- The purpose is to minimise measurement error introduced by changing boundary
  definitions across years.

### Decided: NZ pilot site identity strategy

- The NZ pilot will use a hybrid site identity strategy:
  - deterministic matching across years as the default
  - explicit reviewed overrides for difficult matches
- OSM ids will be stored as source references, but they will not be treated as
  the stable longitudinal site identifier.

### Decided: identity on relocation and geometry correction

- `site_id` identifies a mappable place of worship: a building, parcel,
  compound, or otherwise locatable worship site.
- If a congregation, organisation, or worship community relocates to a
  materially different place, create a new `site_id` for the destination and
  link the origin and destination through a `site_relocated` change event,
  `successor_of` relation, and organisation evidence where available.
- If the physical place is the same but the project geometry improves, an
  address is renumbered, a street is renamed, or the building outline is refined,
  keep the same `site_id` and append a geometry-history state.
- If a building is demolished and rebuilt on the same site, preserve the
  `site_id` when the place-level worship use is continuous enough, and use
  `structure_id` or geometry-history records to represent the physical change.
- Ambiguous cases should be routed to review rather than forced into a same-site
  or new-site decision.

### Decided: functional change events are data

- The project treats changes in place-of-worship function as first-class data
  for analysis. The most important diffs are not only row additions or edits,
  but reviewed claims that a site began worship use, ceased worship use, changed
  denomination or tradition, became shared by several worship communities,
  became multi-purpose, split into several analytical worship uses, or merged
  previously separate uses.
- These events should carry effective time, source evidence, review status,
  confidence, and target-year implications.
- Building existence is a related but distinct evidence stream. Structure
  history can support a worship-use claim, but the analytical state is the
  worship function at the site for a specified time.
- The current `change-event` schema is a start. Before `pow diff` becomes a
  decision surface, we should add or specify functional-state payloads for
  worship use, denomination sets, multi-denomination, multi-purpose use,
  organisation-site links, and target-year state changes.

### Decided: NZ pilot minimum download contract

- Every NZ pilot release should include:
  - cleaned site rows
  - area summaries
  - metadata bundle
- Additional download products such as raw extracts, review queues, and
  area-by-religion tables can be added, but they are not required for the first
  backend milestone.

### Decided: research indicator model

- Research data will be represented as indicators observed on explicit spatial
  and temporal units.
- Indicators will be defined separately from their observations so that
  denominators, methods, sources, and quality flags remain visible.
- This model will support site-level, area-level, country-level, and grid-based
  data without forcing all countries into a single geography.

### Decided: first portal visualisation modes

- The initial map interface should support:
  - site mode for point-level places of worship
  - area mode for choropleth and bivariate indicator overlays
  - comparison mode for time and change views
- Layer metadata should come from backend `visual_layer` definitions rather
  than one-off frontend constants.

### Decided: pilot storage and serving strategy

- Use static, precomputed map products for the first portal-facing milestones.
- Use CSV and metadata JSON for minimum downloads.
- Use GeoJSON for small browser-facing spatial products.
- Move larger analytical spatial products to GeoParquet as the data volume and
  country coverage grow.
- Defer PostGIS for public map products until live query requirements justify
  the operational cost.

### Decided: authenticated portal backend baseline

- Use Google Cloud as the reference backend for the first authenticated
  New Zealand staging pilot.
- Use managed Google OAuth/Identity Platform for contributor identity and
  project permission mapping.
- Use a Rust API on Cloud Run for staging, validation, review, and audit
  endpoints.
- Use Cloud SQL/PostgreSQL with PostGIS for authenticated staging and review
  data, where live geometry checks and queue queries are useful.
- Use Cloud Storage for immutable raw submissions, source snapshots, and
  quarantined images.
- Keep GitHub as an optional audit or export mirror, not the primary review
  backend.
- Defer Convex and SpacetimeDB evaluation until the project has stable
  submission, review, audit, and master-ingestion contracts.

## Open decisions

### Open: historical and demolished places

- Context: time-slice work will need a rule for sites that no longer exist or
  no longer have an identifiable address.
- Options:
  - keep exact historical coordinates where known
  - keep approximate coordinates with an uncertainty flag
  - exclude sites below a location-confidence threshold
- Risks:
  - false precision
  - inconsistent historical coverage
  - confusion between present and past landscapes
- Next step:
  - define a location-confidence field and a publication rule.

### Open: boundary comparability over time beyond the NZ pilot

- Context: country area units change across years, but longitudinal analysis
  needs comparability.
- Options:
  - use fixed boundary sets for all yearly comparisons
  - use year-specific boundaries plus crosswalks
  - publish both fixed-boundary and native-boundary outputs
- Risks:
  - false comparability
  - complicated interpretation
  - duplicated maintenance burden
- Next step:
  - decide whether the NZ fixed-boundary default should generalise to other
    countries or whether country-specific policies are needed.

### Open: site identity matching across years beyond the NZ pilot

- Context: OSM objects can split, merge, move, or be renamed, so a stable
  longitudinal site identity cannot rely on a single source id.
- Options:
  - derive internal site ids from matching rules
  - curate manual identity links for difficult cases
  - hybrid model with deterministic matching plus reviewed overrides
- Risks:
  - false splits or false merges
  - unstable longitudinal counts
  - hidden manual judgement
- Next step:
  - test the hybrid NZ strategy and document where country-specific matching
    rules are still required.

### Open: country download contract beyond the NZ pilot

- Context: country maps will need downloadable data for sites nested within
  country-specific area units.
- Options:
  - provide raw sites only
  - provide cleaned sites plus precomputed area summaries
  - provide both machine-oriented and analyst-oriented download products
- Risks:
  - oversized downloads
  - unclear provenance
  - inconsistent country coverage
- Next step:
  - decide what should be mandatory across all countries beyond the NZ pilot
    minimum of cleaned sites, area summaries, and metadata.

### Open: boundary hierarchy contract

- Context: countries have different administrative hierarchies, names, and
  vintages, and may also have multiple coexisting tessellations that are not
  strictly hierarchical.
- Options:
  - free-form per-country hierarchies
  - standard shared levels plus local aliases
  - strict canonical hierarchy classes with adapter mapping
  - support parallel boundary families within the same country
- Risks:
  - loss of country-specific meaning
  - awkward cross-country comparisons
  - brittle backend code
  - forced false nesting where none exists
- Next step:
  - choose the boundary metadata fields required across all country adapters.

### Open: long-term snapshot storage

- Context: some current source material may only be stored in Google Drive,
  which is not suitable as the authoritative long-term archive for yearly
  tracking.
- Options:
  - continue with Google Drive plus manifests
  - move immutable yearly snapshots to object storage
  - keep a hybrid model with Drive for working files and object storage for
    published snapshots
- Risks:
  - accidental overwrite
  - unclear provenance
  - weak reproducibility
- Next step:
  - inventory what currently exists only in Drive and define the canonical
    snapshot layout.

### Open: school chapels and institutional worship spaces

- Context: some school or college chapels are genuine worship sites; others are
  internal facilities that should not appear in the main map.
- Options:
  - include all named chapels
  - include only publicly accessible worship spaces
  - include but flag institutional context
- Risks:
  - inconsistent treatment across countries
  - inflated counts in school-dense areas
- Next step:
  - write a rule and test it on the NZ review queue.

### Open: global override format

- Context: some edge cases will always need country or source-specific fixes.
- Options:
  - CSV override files
  - YAML rule files
  - reviewed JSON patch files
- Risks:
  - unreviewed drift
  - duplicate logic between code and overrides
- Next step:
  - choose one human-readable format and enforce review comments in the file.

### Open: Rust adoption timing

- Context: Rust may be useful for ingestion and API performance, but it is not
  required to complete the data cleanup rebuild.
- Preferred acceleration path:
  - keep pipeline orchestration and data policy in R
  - use `extendr` for targeted Rust acceleration of R bottlenecks when profiling
    shows a clear need
  - prefer this over a wholesale rewrite when the goal is to speed up a small
    number of hot loops such as deduplication or candidate matching
- Options:
  - keep the research pipeline in R and the API/support tooling in Python for now
  - build a Rust ingestion spike after pipeline rules stabilise
  - move directly to a hybrid Rust stack now
- Risks:
  - architecture churn before data policy is settled
  - slower cleanup progress
- Next step:
  - defer major Rust work until the deterministic pipeline design is stable.

## Next concrete steps

1. Finish the next NZ cleanup slices from the remaining review queue.
2. Design the shared global cleaner and review-queue schema.
3. Refactor `scripts/extract_global_data.R` into explicit extract, normalise,
   clean, and export stages.
4. Inventory what is currently stored only in Google Drive and migrate it into
   a dated snapshot structure.
5. Add run manifests and per-country counts.
6. Define the shared country backend schema and NZ boundary adapter contract.
7. Validate the first NZ territorial-authority `area_summary` product against
   frontend layer and download needs.
8. Pilot the RA-facing historical evidence templates in
   `docs/templates/ra-historical-site-evidence/` with one or two NZ 2018 source
   batches, then refine the controlled vocabularies and validation rules before
   broader data entry.
9. Define the first read-only NZ master site-bundle export and automated
   verification checks described in
   `docs/master-verification-workflow-plan.md`.
10. Continue converting the RA map-triage guide into the first map-first
   workflow design: current non-OSM sites, duplicate/merge candidates, lost
   2013 sites, 2013-present/2018-absent cases, denomination or shared-building
   complications, and target-year status changes should be selectable from the
   map. The static demo can generate local rows for testing; authenticated
   staging remains a later backend step.
11. Scope the OSM temporal verification subproject for 2013, 2018, and 2023,
   including OSM history extraction, lifecycle-tag parsing, visual evidence
   review, and target-year probability rules.
12. Draft the Google Sheets to staging API pilot described in
   `docs/community-ingestion-api-plan.md`.
13. Extend the initial CLI-first RA revisions pipeline from `CRITIQUE.md`,
   using `schemas/change-event.schema.json` and
   `schemas/geometry-history.schema.json` as the first event and geometry
   contracts. The first scaffolds are `pow validate` and `pow stage`; next add
   dry-run diff output from the local SQLite staging store.
14. Draft the authenticated NZ portal staging pilot described in
   `docs/portal-data-entry-plan.md`, starting with the UI, auth/security,
   database/storage, and review contracts before implementation.
15. Extend the NZ `area_summary` product to SA2 geography after checking
   boundary metadata and point-to-area assignment quality.
16. Replace 2018-specific NZ overlay assumptions with year-aware map controls,
   legends, popups, and export metadata.
17. Align the NZ map interface with the global map after the data overlay is
   stable, preserving NZ-specific analysis controls.
18. Prototype site, area, and comparison modes using precomputed layers before
    adding live portal queries.
19. Pilot the new global pipeline on a small country set before full rollout.
20. Expand `research/` into a country-source matrix for global feasibility
    assessment.
