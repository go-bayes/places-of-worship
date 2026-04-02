# Country Backend Scheme

Planning source of truth: `PLANNING.md`.

This document expands the country-backend scheme for implementation and records
the main design decision points.

## Purpose

The global map and country-specific maps solve different problems.

The global map needs:

- fast, broad place display
- lightweight filters
- limited per-place detail

Country-specific maps need:

- places nested within country-specific area units
- richer download products
- demographic and boundary overlays
- reproducible yearly comparisons

The backend design should support both without forcing country-specific logic
into the global storefront.

## Proposed model

### Core entities

#### 1. `site`

Stable internal identity for a place of worship.

This should outlive:

- OSM object changes
- denomination changes
- minor name changes
- geometry refinement

It should not be equated with a single source object id.

#### 2. `site_snapshot`

State of a site at a particular annual anchor date.

Minimum fields:

- `site_snapshot_id`
- `site_id`
- `snapshot_date`
- `name`
- `religion`
- `denomination`
- `status`
- `lat`
- `lng`
- `location_confidence`
- `source_bundle_id`
- `cleaning_rule_version`

#### 3. `boundary_set`

Defines a country-specific administrative geography and vintage.

Examples:

- NZ territorial authorities 2025
- NZ SA2 2018
- AU SA3 2021
- UK local authority districts 2023

Minimum fields:

- `boundary_set_id`
- `country_code`
- `level`
- `vintage`
- `source`
- `valid_from`
- `valid_to`

#### 4. `area_unit`

A single polygon or multipolygon in a boundary set.

Minimum fields:

- `area_unit_id`
- `boundary_set_id`
- `country_code`
- `level`
- `code`
- `name`
- `parent_area_unit_id`
- `geometry`

#### 5. `site_area_assignment`

Links a site snapshot to an area unit under a specific boundary set.

Minimum fields:

- `site_snapshot_id`
- `area_unit_id`
- `boundary_set_id`
- `assignment_method`
- `assignment_confidence`

#### 6. `manual_override`

Reviewed corrections that cannot be safely derived from generic rules.

Minimum fields:

- `override_id`
- `target_type`
- `target_id`
- `action`
- `reason`
- `reviewer`
- `reviewed_at`

#### 7. `run_manifest`

Records what was processed and how.

Minimum fields:

- `run_id`
- `snapshot_date`
- `pipeline_commit`
- `rule_version`
- `source_inputs`
- `row_counts`
- `checksums`
- `output_paths`

## Recommended backend responsibilities

The country backend should own:

- area assignment
- area-level aggregation
- downloadable country extracts
- provenance and metadata
- temporal comparison outputs

The frontend should not be responsible for:

- assigning sites to polygons
- deriving official counts from raw features
- guessing boundary versions
- reconstructing provenance

## Recommended country API shape

These endpoints are not final, but they describe the needed contract.

- `/api/v1/countries/{iso2}/boundary-sets`
- `/api/v1/countries/{iso2}/areas?level={level}&boundary_set_id={id}`
- `/api/v1/countries/{iso2}/areas/{area_id}/places?snapshot_date=YYYY-09-01`
- `/api/v1/countries/{iso2}/areas/{area_id}/summary?snapshot_date=YYYY-09-01`
- `/api/v1/countries/{iso2}/downloads/sites?snapshot_date=YYYY-09-01`
- `/api/v1/countries/{iso2}/downloads/area-summary?snapshot_date=YYYY-09-01`
- `/api/v1/countries/{iso2}/downloads/metadata?snapshot_date=YYYY-09-01`

## Download products

Minimum download set for the NZ pilot:

### 1. Cleaned site rows

Fields should include:

- site identifiers
- snapshot date
- names
- religion and denomination
- status
- coordinates
- country code
- area-unit ids for selected boundary sets
- confidence fields

### 2. Area summaries

Fields should include:

- area-unit id
- boundary-set id
- snapshot date
- total places of worship
- counts by religion
- counts by denomination where possible
- notes on uncertainty

### 3. Metadata bundle

Should include:

- source snapshot identifiers
- pipeline commit
- rule version
- counts before and after cleaning
- review queue counts
- override counts

## Key decision points

### 1. Boundary comparability over time

Question:
Should longitudinal comparison use fixed boundaries, native yearly boundaries,
or both?

Implications:

- fixed boundaries simplify comparison
- native boundaries preserve official geography
- both increase complexity but improve interpretability

### 2. Site identity across years

Question:
How should a stable `site_id` be assigned when source objects change?

Implications:

- this affects all longitudinal counts
- OSM ids alone are not sufficient
- matching rules must be auditable

### 3. Status model

Question:
Which status states are required for yearly tracking?

Likely set:

- `active`
- `inactive`
- `repurposed`
- `demolished`
- `historical`
- `uncertain`

### 4. Country hierarchy contract

Question:
How much hierarchy should be standardised across countries?

Implications:

- too little standardisation makes the backend messy
- too much standardisation erases country-specific meaning

### 5. Download contract

Question:
What must every country backend provide, regardless of local data richness?

Recommended minimum:

- cleaned site rows
- one area summary product
- one metadata product

## NZ pilot implications

NZ should be used to validate:

- the site and snapshot model
- one or more boundary sets
- area assignment logic
- downloadable extracts
- yearly `1 September` comparison outputs

NZ should not be used to assume that every country has:

- the same hierarchy depth
- the same census units
- the same boundary stability
- the same quality of supporting demographic data

## Suggested implementation sequence

1. Finalise the shared schema for `site`, `site_snapshot`, `boundary_set`,
   `area_unit`, `site_area_assignment`, `manual_override`, and `run_manifest`.
2. Implement the NZ boundary adapter and site-to-area assignment workflow.
3. Define the minimum NZ download products.
4. Add manifests and yearly snapshot metadata.
5. Extend the pattern to a second country to test generality.
