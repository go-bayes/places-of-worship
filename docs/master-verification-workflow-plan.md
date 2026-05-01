# Master Verification Workflow Plan

Planning source of truth: `PLANNING.md`.

This document sketches how the project should expose data from the master
database for verification. The immediate New Zealand problem is roughly 3,000+
sites. The global problem may be around 2 million sites. At that scale,
verification must be mostly automated, with human and AI review focused on the
ambiguous or high-impact cases.

## Purpose

The master database should support read-only verification without letting
reviewers, contributors, scripts, or AI agents edit master records directly.
Verification should generate staged decisions, evidence, and proposed changes.
Only accepted and audited decisions should alter the master dataset.

The system should answer:

- what the master currently says about a site
- what source evidence supports the record
- which automated checks pass or fail
- whether the site needs human review, AI review, or no review
- what proposed change would result from review
- why a master record changed, if it changes
- which current or historical worship sites are missing from the master or OSM
- whether one building contains changing, shared, split, or merged worship uses

## Core Principle

Expose master data as evidence bundles, not as editable rows.

A verification bundle should include the master site record, current and
historical source references, geometry, area assignments, OSM metadata,
lifecycle evidence, target-year status, review history, and automated check
results. Review outputs should be written to staging or audit tables, not back
to the master row.

## Candidate Nominations And Building Complications

The verification workflow must handle evidence that does not attach neatly to
one current OSM-derived site. Reviewers and agents should be able to submit
staged nominations for:

- current places of worship that are absent from OSM or from the current master
  snapshot
- lost places of worship that were present in a target year, especially 2013,
  but no longer function as places of worship
- cases where a building changed denomination, tradition, name, or worship
  community over time
- shared buildings with multiple congregations, traditions, or time-specific
  worship uses
- split or merged records, where a single building, organisation, or OSM object
  represents multiple analytical sites, or several records represent one site
- organisation-level evidence, including charity records, that may support a
  site match but should not automatically be treated as building-level evidence

These nominations should be stored in staging with their own ids, even when
they are linked to an existing master site. Minimum fields:

- `nomination_id`
- `nomination_type`
- `candidate_site_name`
- `address_or_locality`
- `candidate_geometry`
- `target_years`
- `existence_status`
- `worship_use_status`
- `evidence_source_refs`
- `evidence_note`
- `linked_master_site_ids`
- `linked_osm_object_refs`
- `linked_building_refs`
- `linked_organisation_refs`
- `proposed_master_action`
- `review_status`

Charity records should be treated as organisation observations. Annual return,
registration, deregistration, activity, and address details can be valuable for
temporal inference, but they often describe an organisation rather than a
building. The durable model should therefore link charity observations to
organisations first, then attach those organisations to site observations with
explicit match confidence and date bounds.

## Verification Architecture

```text
Master snapshot
  - canonical sites
  - site states
  - source evidence
  - area assignments
  - lifecycle events

        |
        v

Read-only verification exports
  - site bundles
  - country/tile partitions
  - review queues
  - map verification layers

        |
        v

Automated checks
  - schema and required fields
  - geometry and area assignment
  - duplicate and near-duplicate risk
  - OSM history and lifecycle tags
  - source link and licence checks
  - target-year consistency
  - lifecycle date consistency
  - visual-evidence availability

        |
        v

Verification review
  - no-action accepted cases
  - human review queue
  - AI-assisted review queue
  - adjudication queue for disagreements

        |
        v

Staged verification decisions
  - accept current record
  - update field
  - merge/split candidate
  - exclude or defer
  - request evidence
  - nominate missing current site
  - nominate lost target-year site
  - flag building or organisation matching problem

        |
        v

Master change proposal
  - dry run
  - diff
  - reviewed commit
  - audit manifest
```

## Verification Bundle

Minimum fields for a site-level verification bundle:

- `master_site_id`
- `master_snapshot_id`
- `country_code`
- `site_name`
- `religion`
- `denomination`
- `site_type`
- `current_geometry`
- `current_address`
- `historical_addresses`
- `area_assignments`
- `osm_object_refs`
- `osm_version_refs`
- `source_dataset_refs`
- `lifecycle_events`
- `target_year_states`
- `visual_verification_refs`
- `prior_review_decisions`
- `automated_check_results`
- `verification_priority`
- `verification_status`

For reviewer ergonomics, the bundle should also include direct map links and
source links where licences permit:

- project map link centred on the site
- OSM object/history link
- Street View or street-imagery link where available
- aerial or historical imagery reference where available
- related candidate duplicates nearby
- source evidence excerpts or row references

## Automated Checks

Automated checks should classify most records before human review. A useful
first set:

- required master fields are present
- coordinates are valid and fall inside the assigned country
- site geometry has a valid area assignment
- site is not offshore unless expected
- OSM object id still resolves or has historical evidence
- OSM tags are compatible with a place of worship or historical worship use
- lifecycle dates are internally consistent
- bounded dates are internally consistent
- target-year states agree with lifecycle bounds where possible
- duplicate risk is low within a distance/name threshold
- address and locality are geocodable or marked for review
- source references are present and accessible
- licence and redistribution flags are compatible with the intended output
- restricted or personal information is absent from public-ready fields

Each check should return:

- `check_id`
- `severity` (`info`, `warning`, `error`, `blocker`)
- `message`
- `evidence_ref`
- `suggested_action`
- `created_at`

## Prioritisation

The review queue should be prioritised rather than flat. A record should move
up the queue when it:

- affects published counts or historical place density
- has conflicting lifecycle evidence
- has high duplicate or false-positive risk
- lacks source evidence
- has uncertain geocoding or area assignment
- is in a country, region, or tradition selected for a pilot
- is likely to improve an automated rule if reviewed

For global verification, use country, tile, and issue-type partitions so agents
and reviewers can work in bounded batches.

## Human, Scripted, And AI Review

The same verification contract should support:

- human reviewers using a dashboard, map, or Google Sheet export
- deterministic scripts that close obvious no-action cases
- AI agents that inspect evidence bundles and propose review decisions
- AI agents that independently review another agent's proposed decision

AI agents should receive read-only bundles or versioned data dumps. They should
return structured decisions with source citations, confidence, and rationale.
They should not write to the master database.

## Data Dumps For Agent Review

For large-scale review, the project should support versioned dumps that agents
can process offline:

- country-partitioned Parquet or GeoParquet
- tile-partitioned JSONL site bundles
- review-queue CSV/JSONL
- source-evidence manifests
- validation-result tables
- map vector tiles for visual context

Every dump should record:

- `master_snapshot_id`
- pipeline commit
- export timestamp
- schema version
- row counts
- checksums
- licence and access constraints

Agent outputs should cite the dump id, bundle id, source refs, and exact fields
used. This makes agent-assisted verification reproducible and reviewable.

## API Shape

Read-only master verification endpoints:

- `GET /api/v1/master/snapshots`
- `GET /api/v1/master/sites`
- `GET /api/v1/master/sites/{site_id}`
- `GET /api/v1/master/sites/{site_id}/verification-bundle`
- `GET /api/v1/master/verification-queues`
- `GET /api/v1/master/verification-tasks/{task_id}`
- `GET /api/v1/master/exports/{export_id}/manifest`

Validation and staging endpoints:

- `POST /api/v1/validation/master-snapshots/{snapshot_id}/run`
- `GET /api/v1/validation/master-snapshots/{snapshot_id}/results`
- `POST /api/v1/staging/verification-decisions`
- `POST /api/v1/ai-review/verification-tasks/{task_id}`
- `POST /api/v1/master-change-proposals`
- `POST /api/v1/master-change-proposals/{proposal_id}/dry-run`
- `POST /api/v1/master-change-proposals/{proposal_id}/commit`

## Map Presentation

The map should eventually expose verification layers:

- verified current sites
- needs-review sites
- nominated current sites not yet in the master or OSM
- nominated lost target-year sites
- duplicate-risk clusters
- building, denomination-switch, sharing, split, and merge complications
- target-year uncertainty
- OSM temporal evidence
- visual-verification coverage
- lifecycle conflicts

For NZ, this can begin as a reviewer-only layer. For the global map, it should
be served as precomputed tiles and summary overlays, not as live per-site
queries across millions of records.

Reviewer maps should use a quiet greyscale basemap where possible, so coloured
verification markers, uncertainty layers, and nominated-site overlays remain
legible.

## Phased Implementation

### Phase 1: NZ read-only bundle export

- define a `master_snapshot_id`
- export current NZ sites as site bundles
- generate automated checks for geometry, OSM refs, duplicates, and source gaps
- create a small reviewer queue for the highest-risk sites

### Phase 2: NZ review interface

- add a map-backed review layer or simple dashboard
- write verification decisions to staging
- capture missing-site, lost-site, and building-complication nominations in
  staging
- dry-run master diffs before accepting any change

### Phase 3: OSM temporal verification

- generate target-year tasks for 2013, 2018, and 2023
- attach OSM full-history and lifecycle-tag evidence
- add visual verification where possible
- estimate target-year states and optional probabilities
- distinguish OSM object history from real-world site, building, congregation,
  and organisation histories

### Phase 4: Global partitioned verification

- export country/tile partitions
- run automated checks globally
- prioritise country and issue-type queues
- support offline agent review over versioned data dumps

## Open Questions

- Should NZ verification begin with a static export, a local SQLite/PostGIS
  database, or a cloud-backed staging database?
- Which fields must be visible in a public verification view, and which should
  remain reviewer-only because of licence or privacy constraints?
- What threshold should let automated checks mark a record as no-action?
- Should AI reviewer disagreement block master-change proposals or only raise
  review priority?
- How should reviewer time be allocated between random audit samples and
  high-risk queued cases?
- What is the right unit model for buildings that host multiple congregations,
  change denomination, or map to one charity across several sites?
- Which charity details can be exposed publicly, which must remain
  reviewer-only, and which belong only in organisation-level tables?
