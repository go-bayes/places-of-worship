# Critique — revisions pipeline for places of worship

**Date:** 2026-05-02

## Repo aim (one paragraph)

The Global Places of Worship Project tracks individual religious sites
across countries and over time, anchored to annual snapshots at 1 September
each year. The canonical data source is OpenStreetMap (ODbL-1.0),
supplemented by national registers and Wikidata. Records use stable UUIDv4
`site_id`s (not OSM ids) with GeoJSON geometry, controlled status enums,
free-text denomination mapped to major categories, and a required `sources`
array. Outputs are CSV, GeoJSON, and (Geo)Parquet for research, plus
mbtiles/pmtiles for the map. R is the analyst-facing layer; Rust is
intended for strict, auditable data-modification (validation, staging,
event application, master rebuild). The repo is mid-transition from
pipeline-only to a contribution portal, with an invite-only NZ pilot as
the first milestone.

## Context for this task

We want a pipeline that accepts revisions to **locations** and
**denominations** at **different timepoints**. We have decided the first
audience is **trusted research assistants via spreadsheets**, not the
portal and not the public. That matches [PLANNING.md:342](PLANNING.md) —
a local CLI that validates and diffs a small staged NZ evidence batch.
The notes below are critical advice on what our existing plans get right,
where they are under-specified, and where they are risky for this specific
task.

## What our existing plans already get right (do not redo)

- Append-only event log with explicit event types: `site_created`,
  `site_location_corrected`, `site_closed`, `denomination_changed`,
  `duplicate_merged`, `proposal_retracted`, `proposal_superseded`
  ([PLANNING.md:311-314](PLANNING.md)).
- No direct master writes; everything stages, validates, dry-runs, then
  produces an `accepted_change` ([PLANNING.md:301-303](PLANNING.md)).
- Stable UUIDv4 `site_id` independent of OSM ids
  ([schemas/site.schema.json](schemas/site.schema.json)).
- Required source citation per record, with retrieval timestamp, query
  hash, licence, and attribution
  ([schemas/source-dataset.schema.json](schemas/source-dataset.schema.json)).
- Existing RA evidence templates encode the right shape:
  [docs/templates/ra-historical-site-evidence/site_evidence_wide.csv](docs/templates/ra-historical-site-evidence/site_evidence_wide.csv),
  with separate sheets for observations, lifecycle events, sources, and
  candidate matches. The pipeline can read these today.

These are sound; we should build on them rather than relitigating.

## Eight critical gaps to fix before the pipeline accepts revisions

### 1. Geometry-over-time has no schema yet — blocks location revisions

[schemas/site.schema.json](schemas/site.schema.json) holds **one**
geometry per site. The status enum includes `relocated`, but there is no
field to record a prior location with its own `valid_from`/`valid_to`.
The pipeline cannot honestly accept a 1923 relocation until we decide:

- (A) Same `site_id`, with a `site_geometry_history` table keyed by
  `(site_id, valid_from, valid_to)`. Continuity preserved; lookups for
  "what was at this point in 1981?" work cleanly.
- (B) New `site_id` with a `successor_of` link in `sameAs` or a
  dedicated relation table. Discontinuity preserved; analytical work on
  "is this the same congregation?" is explicit.

Recommendation: **(A) for buildings, (B) for organisations.** A
congregation that moves to a new building is two `site` rows linked by
`successor_of`; a building that is renumbered or geocoded more precisely
is one `site` with corrected geometry. We should commit this rule in
writing before accepting any location revision; otherwise reviewers will
encode it inconsistently and the data will be unmineable.

### 2. Denomination taxonomy is JavaScript, not a schema — blocks denomination revisions

The only controlled vocabulary lives in
[apps/regions/nz/js/denomination-mapper.js](apps/regions/nz/js/denomination-mapper.js).
Submissions cannot be validated against a JS file from a Rust CLI or any
non-browser validator. We should promote it to
`schemas/denomination-taxonomy.json` with:

- a stable code per denomination (e.g., `christian.anglican`),
- supersession links between codes (when a denomination splits, merges,
  or renames), so historical series remain comparable,
- locale variants (Māori, English, etc.) for display, separate from the
  canonical code,
- a `taxonomy_version` field on every revision event so old snapshots
  remain reproducible after a taxonomy update.

This is a **prerequisite**, not a parallel task.

### 3. Make the temporal model explicitly bitemporal

[PLANNING.md:311-324](PLANNING.md) lists event types but does not say
each event must carry both:

- `effective_date` — when the world changed (or when the corrected fact
  became true),
- `recorded_at` — when the event was logged in our system.

Without both, we cannot reproduce the 1 Sept 1981 NZ snapshot after a
2027 correction lands. Reproducible annual snapshots are our stated
research contract; bitemporality is what makes that contract keepable.
We should add both to the event contract before writing any consumer.

### 4. Distinguish "corrected" from "changed" events

`site_location_corrected` says "we were wrong"; we also need
`site_relocated` for "the building moved". Same for denomination:
`denomination_corrected` vs `denomination_changed`. Collapsing these
poisons historical analysis — a relocation in 1987 must not retroactively
rewrite the 1981 snapshot, but a correction must. The RA templates
already separate observations from conclusions
([PLANNING.md:318-321](PLANNING.md)); we should carry that separation
into the event types.

### 5. Snapshots are caches, not records — say so

We should state this loudly in [PLANNING.md](PLANNING.md) and in the
CLI design: the 1 Sept YYYY `site_snapshot` rows are **derived** by
replaying the event log up to that date against the `source_dataset`
version pinned for that snapshot. Accepted corrections trigger snapshot
regeneration. Treating snapshots as mutable records is the path to
silent provenance loss. The CLI should refuse to write to a
`site_snapshot` row directly; only `pow rebuild-master` populates them.

### 6. First deliverable is the CLI on RA spreadsheets, not the portal

We have decided on RA-spreadsheet input. PLANNING.md:342 already points
here. We should build:

```sh
pow validate evidence_batch.csv     # schema, geometry, dates, sources
pow stage    evidence_batch.csv     # writes staged proposals + raw snapshot
pow diff     <staged_batch_id>      # dry run against current master
pow accept   <staged_batch_id>      # emits accepted_change events
pow rebuild-master                  # replays events into snapshots
pow export   nz --format geojson    # produces published artefacts
```

Substrate for milestone one: SQLite + Spatialite for the staging tables,
GeoParquet for the event log, JSON for raw snapshots. Same logical
schemas as the eventual Cloud SQL / PostGIS portal backend, much less
infrastructure. PostGIS on day one is over-engineered for CSV input.

### 7. Diff and dry-run are the leverage point

PLANNING.md:315-317 lists what the dry-run should show: records added,
modified, retired, validation warnings, source coverage, area/year
count changes. Most of the engineering value of this pipeline lives in
this surface. A reviewer who can see "accepting this batch changes the
1981 NZ Anglican count from 412 to 411 and shifts one SA2 area summary"
can make an informed decision in seconds. We should plan to spend more
here than on the submission form.

For the CLI, that means `pow diff` should produce a structured report:

- per-event: before/after JSON, validation warnings, duplicate-risk
  flags;
- per-batch: counts changed at each annual snapshot, sources added,
  taxonomy_version implications, geometry-history additions;
- machine-readable (JSONL) and human-readable (Markdown) outputs.

### 8. Validation gates that must exist on day one

- **Schema** — JSON Schema per event type, versioned with the event.
- **Geometry plausibility** — WGS84, point inside declared
  `country_code`, no impossible coordinates, plausible distance from
  prior geometry on a relocation.
- **Date plausibility** — `valid_from <= valid_to`, no future
  `effective_date` for completed events, no `effective_date` before
  the source's known coverage.
- **Identity collision** — proposed new site within N metres of an
  existing site → flag as duplicate-risk, route to manual review.
- **Source presence** — every event must cite at least one
  `source_dataset_id` or contributor-attested observation; no source,
  auto-reject at validation.
- **Taxonomy membership** — denomination codes must resolve in the
  current `taxonomy_version`.
- **Idempotency** — each event has a stable client-supplied id; replay
  must not double-apply.

## Things to NOT do first

- Do not open a public-facing edit path; PLANNING.md defers it for good
  reason (spam, identity, sourcing).
- Do not let any consumer write to `site_snapshot` directly.
- Do not start with denomination revisions; they are subtle (taxonomy,
  splits, mergers). Start with location corrections — they are
  geometric, easy to validate, and exercise the full pipeline.
- Do not use last-write-wins or majority voting for conflicting
  proposals; route to adjudication and leave both events on the
  superseded chain.

## Critical files to read or modify

- [PLANNING.md](PLANNING.md) §12 (lines 293-342) and §13 (lines
  344-371) — primary contract.
- [docs/portal-data-entry-plan.md](docs/portal-data-entry-plan.md) —
  flow diagram is the right shape, even for the CLI milestone.
- [docs/portal-submission-review-plan.md](docs/portal-submission-review-plan.md) —
  state machine and decision types.
- [schemas/site.schema.json](schemas/site.schema.json) — needs a
  geometry-history companion schema.
- [apps/regions/nz/js/denomination-mapper.js](apps/regions/nz/js/denomination-mapper.js)
  — promote to `schemas/denomination-taxonomy.json`.
- [docs/templates/ra-historical-site-evidence/site_evidence_wide.csv](docs/templates/ra-historical-site-evidence/site_evidence_wide.csv)
  — CLI's first input format.
- New file recommended:
  `schemas/change-event.schema.json` — JSON Schema for each event type,
  carrying `event_type`, `effective_date`, `recorded_at`,
  `taxonomy_version`, `source_dataset_id[]`, `contributor_id`,
  `client_event_id`, payload union by `event_type`.

## How to verify the pipeline end-to-end (when implemented)

1. Take a five-row slice of `site_evidence_wide.csv` containing two
   location corrections, one relocation, one denomination correction,
   and one denomination change with effective_date in 1987.
2. `pow validate` → expect a clean report.
3. `pow stage` → expect five staged proposals with stable ids and a
   raw snapshot copy in the staging store.
4. `pow diff` → inspect Markdown and JSONL output; confirm 1981 and
   2018 snapshot deltas match expectations.
5. `pow accept` → emits five `accepted_change` events.
6. `pow rebuild-master` → regenerates `site_snapshot` rows for every
   affected year.
7. `pow export nz --format geojson` → published artefact reflects the
   corrections.
8. Replay test: drop the staging DB, replay the event log → identical
   master.

The replay test is our acceptance gate. If step 8 fails, the pipeline
is not yet research-grade.
