# Deployment Strategy (Current + Planned)

## Overview

The project currently ships as a static frontend with a dedicated tile server. A
Rust-based data ingestion and API stack is planned but not yet deployed. This
document aligns the deployment story with the current architecture and the
staged Rust roadmap in `PLANNING.md`.

## Current Production Deployment

### Frontend (GitHub Pages)
- Static site hosted on GitHub Pages.
- Global map entry point: `apps/global/index.html`.
- Regional apps live under `apps/regions/<iso2>/` (example: `apps/regions/nz/`).
- Legacy URL shims in `frontend/`, `src/`, and root `index.html` keep old links
  working during the grace period.

### Basemap Styles
- MapTiler Cloud styles (Backdrop, Toner, etc.).
- Fallback to CARTO Light if MapTiler fails.
- API key stored in `apps/global/config.public.js`.

### Data Tiles (Martin on GCP VM)
- Tiles served by Martin running in Docker on a Google VM.
- Tiles stored in Google Cloud Storage and synced to `/srv/tiles` on the VM.
- Martin serves tiles at `https://tiles.placemap.org`.

### Street View
- Google Maps JS API for Street View in popups.
- Key stored in `apps/global/config.public.js`.

### DNS
- `www.placesmap.org` -> GitHub Pages (CNAME).
- `placesmap.org` (apex) -> GitHub Pages (A records).
- `tiles.placemap.org` -> GCP VM (A record).

## Data Pipeline & Release Flow

### Global/Regional App Data
- R and Python scripts generate GeoJSON/JSON for regional apps.
- Outputs land in `apps/regions/<iso2>/data/` for browser use.

### Tile Pipeline
1. Generate `.mbtiles`/`.pmtiles` locally (Tippecanoe).
2. Upload tiles to Google Cloud Storage.
3. Sync tiles to the VM (`/srv/tiles`).
4. Martin serves updated tiles at `tiles.placemap.org`.

## Local Development
- Serve the repo with a static web server (example: `uv run python -m http.server`).
- Access the global map at `http://localhost:<port>/apps/global/`.
- Access the enhanced NZ map at `http://localhost:<port>/apps/regions/nz/`.
- Keep API keys in `apps/global/config.public.js` (do not commit secrets).

## Performance & Reliability
- Vector tiles + MapLibre provide the primary performance path.
- GitHub Pages CDN caches static assets.
- Tile server caches and static file serving should stay lightweight.
- Keep payloads minimal and prefer precomputed data for regional overlays.

## Planned Evolution (Rust)

### Goals
- High-performance ingestion and regional exports.
- Type-safe shared data structures across backend and frontend.
- Streaming data processing for large datasets.

### Likely Components (Planned)
- Ingestion CLI using `reqwest`, `serde`, and streaming (`bytes_stream`).
- Data processing with Arrow/Polars.
- API using Axum or Actix-web, serving versioned endpoints (`/api/v1`).
- Shared `domain` crate for schema consistency.

### Deployment Options (Future)
- Single VM deployment for early API experiments.
- University infrastructure for research scaling.
- Managed Kubernetes for production-level scaling (if required).

## Change Management
- Planning decisions tracked in `PLANNING.md`.
- Refactor and deployment changes tracked in `CHANGELOG.md`.
