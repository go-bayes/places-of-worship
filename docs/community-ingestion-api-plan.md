# Community Ingestion API Plan

Planning source of truth: `PLANNING.md`.

This document sketches a future contribution system for research assistants,
community contributors, scripts, and AI agents. The aim is to make broad
community contribution possible without allowing any contributor interface to
write directly to the master dataset.

## Purpose

The project will need more historical and country-specific evidence than the
core team can collect alone. Contributors should be able to submit evidence for
sites, source datasets, area assignments, historical observations, and review
decisions through familiar tools such as Google Sheets, while the backend
preserves provenance, validation, review, and reproducibility.

The durable design should be interface-neutral:

- Google Sheets can be the first research-assistant interface.
- Web forms can support community contribution.
- Bulk uploads can support institutional partners.
- Direct API clients can support scripts and trusted collaborators.
- AI agents can contribute extracted evidence and perform independent review.

All of these should feed the same staging contract.

## Guiding Principles

- Collect broadly, accept conservatively.
- Treat every submitted row as untrusted until validated and reviewed.
- Require evidence artifacts or source references for factual claims.
- Keep Google Sheets replaceable; it is an adapter, not the source of truth.
- Separate contribution, validation, review, adjudication, and master ingestion.
- Preserve an audit trail for raw input, parsed rows, validation output, AI
  suggestions, reviewer decisions, and final master changes.
- Keep sensitive or restricted data out of public repositories.
- Let AI assist with extraction, matching, summarising, and review, but never
  write accepted records directly to the master.

## Proposed Architecture

```text
Contributor interfaces
  - Google Sheets
  - web forms
  - bulk CSV/JSON upload
  - direct API clients
  - AI agents

        |
        v

Staging ingestion API
  - authenticate contributor
  - snapshot raw submission
  - validate schema
  - write staging rows
  - enqueue checks

        |
        v

Validation and enrichment jobs
  - source and licence checks
  - date and geography checks
  - duplicate and candidate-match checks
  - address and denomination normalisation
  - AI-assisted extraction or review where useful

        |
        v

Review and adjudication
  - RA review
  - community moderation
  - AI reviewer suggestions
  - human or rule-based acceptance decision

        |
        v

Master ingestion
  - canonical site/source/observation tables
  - area summaries
  - map products
  - downloads
  - run manifests
```

## First Adapter: Google Sheets

Google Sheets is a sensible first interface because research assistants already
understand it and can work collaboratively. It should be constrained with
templates rather than treated as a free-form database.

Recommended template tabs:

- `instructions`
- `sources`
- `site_observations`
- `candidate_matches`
- `review_notes`
- `controlled_vocabularies`

The first repo scaffold for this adapter lives in
`docs/templates/ra-historical-site-evidence/`. It is deliberately a CSV-based
Google Sheets import template so the RA can start immediately while the backend
staging API and workbook automation remain separate implementation steps.

Recommended spreadsheet controls:

- locked header rows
- data validation for enumerated fields
- protected formula/check columns
- hidden stable ids where needed
- one row per source claim, not one row per final site
- source URLs or file references required for factual claims
- "do not enter private contact details" warning in the instructions tab

Sheet ingestion should be pull-based at first:

1. RA marks a batch as ready for ingestion.
2. Ingestion job exports the sheet to immutable raw CSV/JSON.
3. Raw export is saved to object storage or `data/raw/...` when suitable.
4. Parsed rows are written to staging tables.
5. Validation results are written back to a review sheet or dashboard.

## Backend Options

The backend should be defined by responsibilities, not by one vendor. A Google
Cloud implementation is natural because Google Sheets and Cloud Storage fit the
first workflow, but the same contract should work with another cloud or a
self-hosted stack.

Possible Google Cloud pilot:

- Google Sheets API for RA templates
- Cloud Storage for immutable raw submissions and evidence files
- Cloud Run for ingestion and validation services
- Pub/Sub or Cloud Tasks for asynchronous validation and review jobs
- BigQuery or Cloud SQL/Postgres for staging and audit tables
- Secret Manager for API credentials
- IAM service accounts for least-privilege access

Possible vendor-neutral equivalents:

- object storage for raw submissions and evidence artifacts
- Postgres/PostGIS for staging and master tables
- scheduled workers for validation and aggregation
- OAuth/API keys for contributor authentication
- static exports for map products and downloads

## Core Staging Tables

### `contributor`

- `contributor_id`
- `contributor_type` (`ra`, `community`, `script`, `ai_agent`, `partner`)
- `display_name`
- `affiliation`
- `contact_reference`
- `permission_scope`
- `status`

### `submission_batch`

- `submission_batch_id`
- `contributor_id`
- `interface_type` (`google_sheet`, `web_form`, `api`, `bulk_upload`)
- `source_location`
- `submitted_at`
- `raw_snapshot_uri`
- `raw_snapshot_checksum`
- `schema_version`
- `status`

### `staged_source_dataset`

Fields should align with the planned `source_dataset` schema:

- `staged_source_dataset_id`
- `source_dataset_id`
- `provider`
- `url`
- `retrieval_date`
- `licence`
- `access_limits`
- `redistribution_limits`
- `coverage_dates`
- `coverage_geography`
- `submitted_by`
- `validation_status`
- `review_status`

### `staged_site_observation`

Fields should align with the historical source ingestion spec in `PLANNING.md`:

- identifiers and source references
- temporal evidence fields
- raw and normalised names
- raw and normalised addresses
- coordinates or geometry
- candidate match fields
- existence and worship-use status
- quality flags
- validation status
- review status

### `validation_result`

- `validation_result_id`
- `submission_batch_id`
- `target_table`
- `target_row_id`
- `check_id`
- `severity` (`info`, `warning`, `error`, `blocker`)
- `message`
- `suggested_fix`
- `created_at`

### `ai_review`

- `ai_review_id`
- `target_type`
- `target_id`
- `agent_id`
- `model_name`
- `prompt_or_policy_version`
- `review_task`
- `recommendation`
- `confidence`
- `rationale`
- `evidence_refs_used`
- `created_at`

### `adjudication_decision`

- `decision_id`
- `target_type`
- `target_id`
- `decision` (`accepted`, `rejected`, `needs_more_evidence`, `deferred`)
- `decision_rule_or_reviewer`
- `decision_note`
- `decided_at`

## API Shape

Initial staging endpoints:

- `POST /api/v1/staging/batches`
- `POST /api/v1/staging/source-datasets`
- `POST /api/v1/staging/site-observations`
- `POST /api/v1/staging/evidence-files`
- `GET /api/v1/staging/batches/{batch_id}`
- `GET /api/v1/staging/queues/needs-review`

Validation and review endpoints:

- `POST /api/v1/validation/batches/{batch_id}/run`
- `GET /api/v1/validation/batches/{batch_id}/results`
- `POST /api/v1/review/site-observations/{id}`
- `POST /api/v1/review/source-datasets/{id}`
- `POST /api/v1/ai-review/site-observations/{id}`
- `POST /api/v1/adjudication/{target_type}/{target_id}/decision`

Master ingestion endpoints or jobs:

- `POST /api/v1/master-ingestion/batches/{batch_id}/dry-run`
- `POST /api/v1/master-ingestion/batches/{batch_id}/commit`
- `GET /api/v1/audit/submissions/{submission_batch_id}`
- `GET /api/v1/audit/master-runs/{run_id}`

The commit endpoint should be restricted to maintainers or service accounts. It
should require that all rows are accepted and that the dry run has no blockers.

## AI Contribution and Review

AI agents can help in two distinct roles.

Contributor agents may:

- extract source metadata from public pages or documents
- suggest site-observation rows from a supplied source artifact
- normalise names and addresses
- propose candidate matches to existing sites
- flag likely duplicates
- summarise evidence for human review

Reviewer agents may:

- check whether the source artifact supports the submitted claim
- compare candidate matches and propose a best match
- identify conflicts with existing records
- detect unsupported historical claims
- recommend `accepted`, `needs_more_evidence`, `excluded`, or `deferred`

Rules for AI use:

- an AI claim without a source artifact is a lead, not data
- contributor and reviewer agents should be logically independent
- AI review should produce a short rationale and cite the evidence references it
  used
- model name, prompt or policy version, agent identity, and timestamp should be
  stored
- accepted master rows should depend on evidence and adjudication, not model
  confidence alone

## Validation Checks

Minimum checks before review:

- required fields are present
- controlled vocabulary values are valid
- dates parse and include precision or basis
- source dataset exists or is submitted in the same batch
- licence and access fields are present
- raw source snapshot or evidence reference exists
- coordinates are valid, or address geocoding/matching is marked as needed
- candidate site matches include confidence and method
- private personal contact details are absent from public-ready fields
- duplicate source rows are flagged
- likely duplicate site observations are grouped

Minimum checks before master ingestion:

- every accepted row has an accepted or approved source dataset
- every counted site observation has a physical site match or acceptable
  geometry
- organisation-only evidence is not counted as a place unless linked to a
  physical worship site
- conflicting evidence is resolved or explicitly flagged
- all accepted rows have reviewer or adjudication metadata
- aggregation dry run reports counts by source, status, evidence type, and
  quality flag
- output manifests include input checksums and pipeline commit

## Privacy, Licence, and Abuse Controls

The system should be designed for public-interest research, not uncontrolled
data harvesting.

- Do not collect officer names, private emails, phone numbers, or personal
  addresses unless the source contract and research need are explicit.
- Store raw files with personal contact information outside public Git.
- Record licence and redistribution constraints before any source is used in a
  public product.
- Keep source artifacts and accepted derived fields separate.
- Rate-limit public and agent submissions.
- Require authentication for direct API submission.
- Use permission scopes: submit-only, review, adjudicate, master-commit.
- Quarantine submissions from new or low-trust contributors until reviewed.
- Preserve abuse reports and moderator decisions.

## Master Ingestion Contract

Accepted records should flow into canonical project products, not remain trapped
in the contribution system.

Likely master targets:

- `source_dataset`
- `site`
- `site_snapshot`
- `site_observation`
- `site_area_assignment`
- `indicator_observation`
- `area_summary`
- run manifests and download metadata

The master ingestion job should:

1. read accepted staging rows
2. apply deterministic transforms
3. assign or update stable internal ids
4. rebuild affected area summaries
5. regenerate app/download products
6. emit a run manifest
7. produce a human-readable change summary

## Milestones

### Milestone 1: RA Spreadsheet Pilot

- draft Google Sheet templates
- draft JSON/CSV schemas for submitted source and site-observation rows
- build a script that exports a sheet to immutable raw CSV/JSON
- validate rows locally
- emit a review queue
- manually merge a tiny accepted batch into a derived `area_summary` prototype

### Milestone 2: Staging Backend

- create staging tables
- add batch submission and audit records
- add validation results
- store raw exports in object storage
- make dry-run aggregation reproducible

### Milestone 3: Review Workflow

- add reviewer decisions
- add adjudication rules
- add reviewer-facing dashboard or review sheet
- write change summaries for accepted batches

### Milestone 4: AI-Assisted Extraction and Review

- add AI contribution endpoint for source-backed draft observations
- add AI reviewer endpoint for independent checks
- store model, prompt/policy version, confidence, and rationale
- route disagreements to human review

### Milestone 5: Community Contribution

- add public or partner web forms
- add contributor accounts and permission scopes
- add moderation and abuse handling
- publish contributor guidance and source-quality rules

## Open Decisions

- Which backend should pilot staging: BigQuery, Cloud SQL/Postgres, or local
  Postgres first?
- Should the first RA workflow write validation results back to Google Sheets,
  or to a separate review dashboard?
- Which source types may be stored in Git, and which require private object
  storage?
- What minimum evidence rule is required before an observation can change a
  historical place count?
- Should AI reviewer disagreement automatically block ingestion, or only route
  to review?
- What contributor identity model is acceptable for community contributors?
- How should partner institutions submit large or restricted datasets?
