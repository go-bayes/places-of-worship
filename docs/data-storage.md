# Data Storage and Tracking

This document inventories where data lives today.

The operational storage pipeline is defined in
`docs/data-storage-pipeline.md`. That document is authoritative for the rule
that ignored local data is cache only and must be promoted to durable
project-controlled storage before it is used for analysis, review, or task
generation.

## Current Data Locations

### External Services (not stored in this repo)
- Basemap tiles and styles: MapTiler Cloud (subscription), consumed by
  MapLibre in the browser.
- Street View: Google Maps JS API (key in `apps/global/config.public.js`).
- Custom tiles hosting: a Cloudflare Worker (`tools/tiles-r2/`) serving
  `z/x/y` vector tiles from PMTiles archives in a Cloudflare R2 bucket at
  `tiles.religionmap.org` (cutover 2026-07-22; the earlier Martin-on-GCP VM
  was deleted at the same time).
  - Tilesets: `places`, `places-overview`, `buildings`, `nz-polygons`.
  - Local copies of the archives are kept outside the repo; the worker
    README records the upload and rebuild procedure.

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

Data tracking and diff strategy decisions live in `PLANNING.md`. The active
storage workflow lives in `docs/data-storage-pipeline.md`. This document is an
inventory reference only.

Related templates:
- `docs/data-manifest-template.snapshot.json`
- `docs/data-manifest-template.diff.json`
