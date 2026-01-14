# Planning

## Current state
- Global MapLibre storefront at `apps/global/` (GitHub Pages).
- Enhanced NZ map at `apps/nz-enhanced/` (Leaflet + census overlays).
- Custom tiles served via Martin on GCP VM (`tiles.placemap.org`).
- Basemap styles from MapTiler with CARTO fallback.

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
- Structured logging + tracing + metrics from day one.

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
- Plan to deprecate/remove legacy copies once new paths are widely adopted.
