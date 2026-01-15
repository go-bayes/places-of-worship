# Planning

## Decision log (draft)
Use this section to capture rationale for major choices so we do not revisit the same debates.
Each entry should include: decision, context, alternatives, risks, and follow-up actions.

### Decision: Rust feasibility spike (open)
- Context: We prefer Rust for performance/safety, but need to validate team capacity and adapter complexity.
- Alternatives: continue with Python/R ingestion/API; hybrid (Rust ingestion + Python API).
- Risks: higher upfront cost, slower iteration, reduced contributor pool.
- Follow-up: run a small Rust spike on 1–2 sources, compare effort / output parity.

### Decision: Regional data store strategy (open)
- Context: regional exports and queries may outgrow file-only storage.
- Alternatives: Parquet-only with caching; PostGIS; DuckDB/SQLite; cloud warehouse.
- Risks: operational overhead, costs, and query latency.
- Follow-up: define target regions, expected query patterns, and latency requirements.

### Decision: portal adapter strategy (open)
- Context: Government portals vary widely (CKAN, custom APIs, HTML downloads).
- Alternatives: one-off adapters per region; shared adapter framework; outsource to ETL tooling.
- Risks: maintenance burden, brittle scraping, inconsistent schemas.
- Follow-up: inventory target portals and choose the top 2 patterns to standardise first.
(see: https://crates.io/crates/data-gov-ckan/0.1.0; https://www.browserless.io/blog/state-of-web-scraping-2026; https://rustdaily.com/posts/3-powerful-features-in-rust-s-reqwest-library)


## Current state
- Global MapLibre storefront at `apps/global/` (GitHub Pages).
- Enhanced NZ map at `apps/regions/nz/` (Leaflet + census overlays).
- Custom tiles served via Martin on GCP VM (`tiles.placemap.org`).
- Basemap styles from MapTiler with CARTO fallback (free).

## Near-term priorities
- Complete frontend structure refactor with legacy URL shims.
- Audit and archive legacy API/scripts once refactor settles.
- Improve north icon (global map).
- Investigate Mapillary/KartaView for images.
- Review Overture Maps imagery pipeline (`scripts/extract_overture_images.R`).
- Use `scripts/extract_global_data.R` for improved filtering.
- Update data ingestion plan and track diffs.
- Global data audit deferred (track scope + cleanup once the Rust stack plan is clearer).

## Rust architecture direction (regional data services)
- Shared types in a `domain` crate used by API, pipelines, and UI.
- Versioned public API (`/api/v1/...`) with OpenAPI spec.
- Clear crate boundaries: `api`, `data`, `domain`, `web`, `cli`.
- Streaming exports (Arrow/Parquet), pagination, and explicit query limits.
- Deterministic pipelines with dataset versioning + metadata.
- Concurrency limits, timeouts, and memory guards by default.
- Structured logging + tracing + metrics from 'day one'...

## Rust migration plan (incremental)
1) Define target regions, data sources, auth, and update cadence.
2) Build a Rust ingestion CLI (`crates/cli`) using `reqwest` + `serde`:
   - Stream large datasets with `bytes_stream()` into Arrow/Polars.
   - Emit Parquet with the same schema as current outputs.
3) Introduce a Rust API (`crates/api`) that serves existing endpoints or `/api/v2`:
   - Read Parquet directly (Polars/Arrow) with paging and bounds filters.
   - Keep responses schema-compatible for the frontend.
4) Validate parity (row counts, query performance, output samples).
5) Deprecate Python ingestion/API once Rust path is stable.

## Rust ingestion notes
- Use `reqwest`, `serde`, `tokio`, `tracing`, `thiserror`.
- Consider CKAN crates per portal, but expect per-source adapters.
- Reserve AI-assisted extraction as an optional fallback with strict logging.

## Data quality
- Multi-source validation.
- Confidence scoring.
- Community feedback loops.
- Regular data freshness checks.

## Scalability
- Modular architecture.
- Partitioned storage strategy.
- Performance-first API design.

## Compatibility notes
- Legacy URLs are shimmed for redirects; some legacy data files remain for compatibility.
- Grace period: keep `enhanced-places.html` and `src/` shims until new regional paths are adopted.
- Plan to deprecate/remove legacy copies once new paths are widely adopted.
- NZ data now lives in `apps/regions/nz/data` only; root and `src/` data copies removed.
