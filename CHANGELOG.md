# Changelog

## Unreleased
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
