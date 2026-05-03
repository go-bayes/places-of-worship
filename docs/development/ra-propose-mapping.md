# RA Proposal Mapping

This document defines the first `pow propose` mapping from staged
research-assistant CSV evidence into draft `change-event.v1` JSONL.

The mapping is intentionally narrow. It exists so real RA evidence can become
draft events that a later `pow diff` reviewer report can read. It does not
approve evidence, mint accepted site ids, map denomination names to a taxonomy,
or write to the master database.

## Supported Inputs

`pow propose` reads one staged batch from `.pow/staging.sqlite`.

Version `pow-propose.v1` supports staged rows from:

- `site_observations.csv`
- `site_evidence_wide.csv`

Other RA template rows fail loudly until their mappings are specified.

## Required Match

Every row must include `matched_current_site_id`.

The current NZ map still uses source-like ids for many sites. `pow propose` does
not mint accepted UUID site ids. Instead, it writes the matched current id to:

```text
target.matched_current_site_id
```

Accepted master events can later replace this temporary target reference with a
stable `site_id` after identity rules have been applied.

## Event Shape

Each supported row emits one staged event:

- `event_type`: `worship_function_observed`
- `event_intent`: `evidence_observation`
- `payload.payload_type`: `worship_function_update`
- `review.review_status`: `staged`
- `payload_hash`: `null`

The event is validated against `schemas/change-event.schema.json` before it is
printed.

## Target-Year Mapping

For `site_observations.csv`:

- `target_year` becomes a snapshot date.
- A four-digit year becomes `YYYY-09-01`.
- A full `YYYY-MM-DD` date is kept as supplied.
- `existence_status` and `worship_use_status` are used to derive
  `target_year_status`.

The derivation is:

- `worship_use_status` of `confirmed_worship` or `probable_worship` means
  `present`, unless `existence_status` is `absent`, which is an error.
- `existence_status` of `absent` means `absent`.
- `worship_use_status` of `not_worship` means `absent`.
- `organisation_only`, `building_only`, `uncertain`, or missing status means
  `uncertain`.

For `site_evidence_wide.csv`:

- `target_year_2013_status`, `target_year_2018_status`, and
  `target_year_2023_status` become `target_year_affects` entries.
- Blank and `not_assessed` values are skipped.
- If all target-year fields are blank or `not_assessed`, `pow propose` fails.

## Deferred Fields

`denomination_or_tradition_raw` is not mapped into `denomination_set` in v1.

The raw field is free text, while `denomination_set` requires coded values. Until
`schemas/denomination-taxonomy.json` exists, `pow propose` emits a warning when
raw denomination or tradition text is present and omits `denomination_set`.

The first bridge also defers:

- lifecycle-event translation
- organisation-site start and end translation beyond target-year observation
- previous-state population
- accepted `site_id` assignment
- site creation for unmatched candidates

## Determinism

For the same staged batch, `pow propose` should emit byte-stable event content.

The deterministic fields are:

- `event_id`: hash-derived from `batch_id`, `stage_record` index, and
  `pow-propose.v1`
- `client_event_id`: `pow-propose.v1:{batch_id}:{stage_record}:worship_function_observed`
- `recorded_at`: copied from the staged batch's `staged_at`

This makes later idempotency checks simpler: the same staged row should produce
the same draft event.

## Source Chain

Every emitted event includes a source reference back to the staged row:

- `source_refs[].evidence_row_id`: `stage_record:{batch_id}:{record_index}`
- `source_refs[].stage_batch_id`
- `source_refs[].stage_record_index`
- `source_refs[].stage_input_sha256`

This preserves the chain from source file to staged batch to draft event.
