# Measurement-regime vocabulary

> **PROVISIONAL:** Vocabulary v1, conductor-defined 2026-07-13, provisional pending PI review; the declarations table regenerates from scripts/build_measurement_regime_table.R.

The declarations table contains one row for each mapped country-product manifest. The extractor records an exact manifest key path, area-summary key path, or quality-flag token for every known value. It emits `unknown` when the committed metadata does not determine a field.

## `country_code`

`country_code` is the two-letter country code declared at `scope.country_codes[0]`. The New Zealand OSM product uses the country scope encoded by its dedicated manifest and regional product path.

## `manifest_path`

`manifest_path` is the repository-relative path of the manifest that keys the row.

## `instrument`

Allowed values are `census_affiliation`, `survey_estimate`, `administrative_register_membership`, `register_of_organisations`, `administrative_infrastructure`, `attendance_survey`, and `unknown`.

The extractor classifies instruments from `dataset_family` and explicit instrument declarations within manifest metadata. It uses `unknown` when those fields do not support one class. The current rules do not emit `administrative_infrastructure`; the value remains reserved in the conductor-defined vocabulary.

## `wave_count`, `year_min`, and `year_max`

`wave_count` is an integer. `year_min` and `year_max` are integer years or `unknown`.

The extractor uses distinct values from `rows[].year` in the country product. It falls back to `target_years` when the product rows declare no years. The minimum and maximum come from the same declared year set.

## `geography_grain`

Allowed values are `national`, `adm1`, `adm2`, `mixed`, and `other`.

The extractor maps each verbatim `rows[].boundary_level` label through the level table in the build script. It emits `mixed` when a country-product contains labels from more than one mapped grain. Unrecognised labels produce `other`.

## `grain_label_verbatim`

`grain_label_verbatim` contains the distinct `rows[].boundary_level` values in lexical order. The extractor separates multiple labels with ` | `. It emits `unknown` when no row declares a boundary level.

## `value_basis`

Allowed values are `counts`, `percent_only`, `counts_and_percent`, `weighted_estimates_with_uncertainty`, and `unknown`.

The extractor examines non-null count and percent indicator fields in `rows[]`. A product receives `weighted_estimates_with_uncertainty` only when `indicators[].method` or `indicators[].unit` declares both weighting and uncertainty. Products with neither type of published value receive `unknown`.

## `no_religion_category`

Allowed values are `present`, `absent_in_published_frame`, `reference_complement_only`, `not_applicable_register_construct`, and `unknown`.

The extractor first uses exact `quality_flag` tokens that declare a register construct, a reference-group complement, an absent category, or a present no-religion line. A non-null `rows[].no_religion_percent` supplies the final evidence for `present`. Conflicting declarations produce `unknown`.

## `not_stated_handling`

Allowed values are `separate_line_in_denominator`, `folded_or_prorated`, `absent`, `not_applicable`, and `unknown`.

The extractor uses exact `quality_flag` tokens that declare denominator retention, folding or proration, or category absence. Register constructs receive `not_applicable`. Conflicting or missing declarations produce `unknown`.

## `universe_basis_verbatim`

`universe_basis_verbatim` preserves one scalar `pipeline.parameters.universe`, `pipeline.parameters.denominator`, or `pipeline.parameters.construct.universe` value. When the manifest does not supply one, the extractor uses a single distinct `rows[].population_total_basis` value. Multiple distinct declarations produce `unknown` because the vocabulary has no mixed-universe value.

## `licence_posture`

Allowed values are `accepted_open`, `needs_review_build_then_ask`, `consent_first_hold`, `mixed`, and `unknown`.

The extractor uses only `licence_status` and `licence_basis`. Accepted or open statuses produce `accepted_open`. Review, pending, or build-then-ask declarations produce `needs_review_build_then_ask`. A consent-first or hold basis produces `consent_first_hold`. Explicit mixed declarations produce `mixed`.

## `small_cell_marks`

Allowed values are `present`, `absent`, and `unknown`.

The extractor uses exact `quality_flag` tokens that declare small-cell suppression, a small denominator, or the absence of small-cell treatment. Conflicting or missing declarations produce `unknown`.

## `boundary_licence_verbatim`

`boundary_licence_verbatim` preserves `source_datasets[].licence.name` when exactly one licence value belongs to source metadata explicitly labelled as a boundary or boundary provider. Multiple values or missing declarations produce `unknown`.

## Provenance

The JSON output has a parallel `provenance` object keyed by manifest path. Every known field names its manifest path, manifest key path, area-summary key path, derivation from a named key, or exact quality-flag token. The build stops when any known value lacks provenance.
