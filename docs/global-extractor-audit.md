# Global Extractor Audit And Workflow

Planning source of truth: `PLANNING.md`.

This document audits the current `scripts/extract_global_data.R` script and
defines a staged replacement workflow for global extraction, cleaning, review,
and publication.

## Summary

The current `scripts/extract_global_data.R` script is a reasonable prototype
for broad `amenity=place_of_worship` extraction, but it is not sufficient as
the research-grade global pipeline.

Its main limitations are:

- extraction is too narrow for some genuine worship sites
- outputs are too thin for audit, deduplication, and longitudinal tracking
- there is no explicit cleaning stage
- there is no review queue stage
- there is no manifest or run metadata
- there is no stable distinction between raw, normalised, cleaned, and
  published outputs

The script should therefore be treated as the extraction starting point, not as
the full global pipeline.

## Audit Of `scripts/extract_global_data.R`

### 1. Query scope is too narrow

The current query uses only:

- `amenity=place_of_worship`

This is cleaner than the older permissive extractor, but it will miss some
genuine worship sites that are mapped through explicit religious building tags
instead of `amenity=place_of_worship`.

For the replacement pipeline, extraction should use a conservative inclusion
baseline that starts with `amenity=place_of_worship` and selectively expands to
explicit religious building classes where justified.

### 2. Country lookup is not explicit enough

The script uses `opq(bbox = country_name)`.

That is too implicit for a long-term pipeline because:

- geocoded extents may not align cleanly with official country coverage
- territories may be inconsistently included
- reproducibility is weaker than using explicit area logic

The replacement pipeline should use explicit country identifiers and a stable
country extract strategy.

### 3. Raw and published outputs are conflated

The script writes directly to `data/global/<iso2>_places.json`.

That collapses several distinct stages into one:

- raw extraction
- normalisation
- cleaning
- deduplication
- publication

For longitudinal work, those stages need to be separate and auditable.

### 4. Output schema is too thin

The current output keeps only:

- latitude
- longitude
- name
- religion
- denomination
- country
- confidence

That is not enough for:

- duplicate resolution
- later review
- source tracing
- area assignment audits
- temporal identity matching

At minimum, normalised outputs should retain:

- source object id and type
- full relevant tags
- country code
- name variants if available
- religion and denomination
- confidence inputs
- address and contact fields where available
- geometry origin
- extraction date and source bundle id

### 5. Confidence scoring is too weak

The current confidence score depends only on:

- whether a name exists
- whether religion exists
- whether denomination exists

That is too shallow for a global research pipeline. Confidence should also be
informed by:

- inclusion path
- tag quality
- building or amenity support
- duplicate ambiguity
- override status

### 6. No deterministic cleaning stage

The script normalises religion labels, but it does not perform explicit
deterministic cleaning for:

- obvious non-worship records
- institutional false positives
- adjunct support buildings
- generic weak-name records
- known duplicate structures

That stage exists in NZ and must be generalised for global use.

### 7. No review queue generation

The script has no mechanism to isolate the ambiguous tail for human review.

That means the pipeline cannot clean conservatively while still surfacing the
records that need judgement.

### 8. No run manifests or snapshot metadata

The script does not write:

- run manifests
- row counts before and after cleaning
- source snapshot ids
- rule versions
- checksums

Without those, yearly tracking will mix data change with pipeline drift.

### 9. No explicit deduplication logic

The script combines points and polygon centroids but does not explicitly manage
duplicate representations of the same site.

That matters globally because the same place may appear as:

- node and polygon
- overlapping polygons
- multiple source objects with weakly different names

### 10. No explicit treatment of multiple output products

The script writes one country JSON file, but the full pipeline needs at least:

- raw extracts
- normalised country datasets
- cleaned country datasets
- review queues
- reviewed outputs
- published app files
- manifests

## Replacement Workflow

The recommended workflow is:

1. extract
2. normalise
3. clean
4. deduplicate
5. classify for review
6. apply overrides
7. publish
8. record manifests

Current implementation status:

- stages 1 and 2 are now implemented in `scripts/extract_global_data.R` and
  `scripts/normalize_global_places.R`
- stage 3 is now scaffolded in `scripts/clean_global_places.py`
- stage 5 is now scaffolded in `scripts/build_global_review_queue.py`
- stages 4, 6, and 7 still need explicit implementation

## Proposed Stages

### Stage 1. Raw extraction

Purpose:

- capture source data without cleaning decisions

Outputs:

- `data/raw/osm/<snapshot_date>/<iso2>_places_raw.json`
- raw source manifest for the country

Requirements:

- explicit snapshot date
- stable country identifier
- reproducible query strategy
- source metadata captured at extraction time

### Stage 2. Normalisation

Purpose:

- convert raw source objects into a stable internal schema

Outputs:

- `data/intermediate/global/<snapshot_date>/<iso2>_places_normalized.parquet`
- optional JSON for inspection

Requirements:

- preserve source ids and tags
- preserve enough metadata for later review
- compute preliminary religion and denomination normalisation
- assign extraction provenance fields

### Stage 3. Deterministic cleaning

Purpose:

- remove obvious false positives using shared rules

Outputs:

- cleaned country dataset
- rule-level removal summary

Rule classes:

- hard exclusion
- hard inclusion confirmation
- institutional filtering
- support-building filtering
- weak-name handling

### Stage 4. Deduplication

Purpose:

- collapse obvious duplicate source representations of the same site within a
  snapshot

Outputs:

- deduplicated cleaned country dataset
- duplicate resolution summary

Requirements:

- record which source objects were merged
- record deduplication method and confidence

### Stage 5. Review queue generation

Purpose:

- isolate ambiguous retained records for manual review

Outputs:

- machine-readable review queue per country
- human-readable summary per country

Suggested queue classes:

- generic weak names
- missing core tags
- institutional edge cases
- retreat and prayer sites
- weak centres, halls, and houses
- historically uncertain records

### Stage 6. Reviewed overrides

Purpose:

- apply explicit reviewed inclusions, exclusions, and identity fixes

Outputs:

- reviewed cleaned country dataset
- override log

Requirements:

- each override has a reason
- each override has a reviewer and date
- overrides are kept separate from shared cleaning code

### Stage 7. Publication

Purpose:

- emit the app-facing country outputs and global combined products

Outputs:

- `data/global/<iso2>_places.json`
- global combined parquet and summary products
- app-ready metadata

### Stage 8. Run manifests

Purpose:

- make the run auditable and reproducible

Outputs:

- snapshot manifest
- country manifest
- counts before and after cleaning
- review queue counts
- override counts
- checksums

## Proposed Script Layout

These are draft script responsibilities, not yet implemented contracts.

- `scripts/extract_global_data.R`
  - raw extraction only
- `scripts/normalize_global_places.R`
  - raw to normalised schema
- `scripts/clean_global_places.R`
  - deterministic global cleaning
- `scripts/build_global_review_queue.R`
  - review-queue generation
- `scripts/apply_global_overrides.R`
  - reviewed overrides
- `scripts/publish_global_places.R`
  - published outputs and manifests

## Pilot Recommendation

Do not roll the first cleaning rules directly across the whole globe.

Pilot the workflow on a small mixed set first:

- NZ
- AU
- GB or IE
- one non-Christian-majority case such as MY or TH

The goal is to test whether rules are:

- too NZ-specific
- too permissive
- too narrow
- too dependent on one tagging culture

## Current status

The first refactor step is now in place:

- `scripts/extract_global_data.R` has been rewritten as a raw extractor
- `scripts/normalize_global_places.R` has been added as the first
  normalisation stage

## Immediate Next Step

Add the first deterministic global cleaning stage behind normalisation, then
generate per-country review queues from the cleaned residual ambiguity.
