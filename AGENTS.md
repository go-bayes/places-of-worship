# AGENTS.md

## Scope And Precedence

- instructions apply to the `places-of-worship` repository.
- user requests take precedence over this file.
- this file is the canonical repo-local agent guidance. 
- `PLANNING.md` is the planning source of truth. Update it when priorities,
  scope decisions, or sequencing change.
- `CHANGELOG.md` tracks durable project progress. Update it when a change adds
  or revises schemas, scripts, documentation, or deployment behaviour.

## Project

- the project is a research-facing geospatial portal for places of worship and
  related spatial and temporal indicators.
- the lowest-level unit of analysis is the mapped place or building used for
  worship.
- higher-level units are country-specific area systems such as territorial
  authorities, Statistical Area 2 units, counties, municipalities, regions, or
  other documented boundary sets.
- the local `grant/` directory is ignored by Git and should be treated as a
  reporting reference, not as source material to commit.
- use `research/` for lightweight, versioned country-source audits and global
  feasibility notes. Keep raw downloads, restricted data, and large extracts out
  of that directory.

## Stack

- frontend: static HTML, CSS, JavaScript, Leaflet/MapLibre-era map code, and
  static JSON/GeoJSON products served through GitHub Pages.
- backend/API: TBA. Currently Python with FastAPI and Uvicorn when API work is required.
- Data pipelines: R and Python; R is canonical for research-facing pipeline
  logic, source transformations, and country data products.
- Python environments and commands use `uv`. Prefer `uv run` over direct
  `python` invocation unless using the checked-in virtual environment is needed
  to work around local cache permissions.
- Prefer `extendr` for targeted acceleration of hot R bottlenecks after
  profiling. Do not move the research pipeline wholesale to Rust without an
  explicit planning decision.

## Commands

- Install Python dependencies with `uv sync`.
- Run Python scripts with `uv run <script>` where possible.
- Start the API with `uv run uvicorn api.main:app --reload` from the repo root.
- Run R scripts from the repo root unless the script explicitly supports
  another working directory. New scripts should resolve paths from either the
  repo root or `scripts/`.
- Serve static files with a simple local server when testing frontend pages.

## Data Contracts

- Update schemas in `schemas/` before changing dataset shapes that depend on
  them.
- Current research-layer contracts include:
  - `source_dataset`
  - `indicator`
  - `indicator_observation`
  - `visual_layer`
  - `area_summary`
- Preserve provenance for OpenStreetMap, Statistics New Zealand, national
  statistical offices, boundary providers, and any survey or administrative
  sources.
- Keep source name, URL, licence, retrieval date, local snapshot reference,
  citation, and access limits visible in generated metadata where possible.
- Do not mix raw, intermediate, and publication-ready data without clear
  filenames, manifests, or metadata notes.
- Keep large, restricted, or raw source snapshots out of Git unless the repo
  already tracks that class of artefact and the licence permits it.

## New Zealand Reference Implementation

- Treat New Zealand as the proof-of-concept country, not as the universal
  template for all countries.
- The current territorial-authority religion workflow includes 2013, 2018, and
  2023 Census data aligned to official TA boundary codes.
- Do not hard-code 2018 as the map overlay year. New frontend work should be
  year-aware and should display the census year, denominator, source, boundary
  set, and quality flag.
- The first TA `area_summary` product combines current committed place counts
  with census-year religion denominators. Preserve the quality flag that makes
  this limitation explicit.
- Site-to-area assignment belongs in reproducible backend or pipeline code, not
  as ad hoc frontend logic.
- Boundary vintages and non-assigned places should be documented in output
  metadata.

## Frontend

- Keep the map usable as the first screen. 
- Preserve mobile behaviour and dock/toggle ergonomics when editing the NZ map.
- Use restrained, accessible styling and colour-blind-friendly map overlays.
- Prefer layer metadata from generated data products over one-off frontend
  constants.
- Test changed map pages in a browser and verify that tiles, controls, popups,
  legends, and overlays render.

## API And Scripts

- Prefer Polars for new tabular Python work unless an existing script uses
  another library.
- Keep API responses stable unless the user asks for a schema change.
- Validate generated JSON, GeoJSON, manifests, schemas, review queues, and area
  summaries before replacing existing artefacts.
- For R outputs, prefer deterministic row ordering and explicit rounding.
- Record any unresolved data-quality issue in the product metadata or planning
  notes rather than silently hiding it.

## Prose

- Use New Zealand English.
