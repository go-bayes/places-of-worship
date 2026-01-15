# Data Storage and Tracking

This document inventories where data lives today and outlines a plan for
auditable, diff-friendly data tracking over time.

## Current Data Locations

### External Services (not stored in this repo)
- Basemap tiles and styles: MapTiler Cloud (subscription), consumed by
  MapLibre in the browser.
- Street View: Google Maps JS API (key in `apps/global/config.public.js`).
- Custom tiles hosting: Martin on a GCP VM (`tiles.placemap.org`).
  - Tile source files live on the VM at `/srv/tiles`.
  - Tiles are uploaded to GCS and manually synced to the VM.
  - Current tile artifacts in GCS include `places.mbtiles`,
    `places-overview.mbtiles`, `buildings.mbtiles`, and `nz-polygons.pmtiles`
    (bucket details are kept private).

### Repository (tracked)
- Regional app data (served directly by GitHub Pages):
  - `apps/regions/nz/data/*.json`, `apps/regions/nz/data/*.geojson`
- Global datasets and extracts:
  - `data/global/*_places.json`
  - `data/global/*.parquet`
- Raw extracts (provenance snapshots):
  - `data/raw/osm/*`

### Repository (documentation + schemas)
- Schemas: `schemas/*.schema.json`
- Pipeline docs: `docs/*.md`
- Script entry points: `scripts/*`

## How Data Flows Today

1) Raw data downloads land in `data/raw/`.
2) Processing scripts read from `data/raw/` and `data/global/`.
3) Regional app data is emitted to `apps/regions/<iso2>/data/`.
4) Custom tiles are generated locally (`.mbtiles`/`.pmtiles`), uploaded to GCS,
   and synced to `/srv/tiles` on the VM for Martin to serve.
5) The frontend consumes tiles and regional JSON/GeoJSON from GitHub Pages.

## Gaps / Uncertainties to Confirm
- GCS bucket name and sync command (keep in `ops/private-ops-notes.md`).
- Whether any automated sync exists (cron/systemd).
- Whether any global data should move off-repo to object storage.

## Planning Source of Truth

Data tracking and diff strategy decisions live in `PLANNING.md`. This document
is an inventory and operational reference only.

Related templates:
- `docs/data-manifest-template.snapshot.json`
- `docs/data-manifest-template.diff.json`
