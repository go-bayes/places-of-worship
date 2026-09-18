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
  `tiles.placemap.org` (cutover 2026-07-22; the earlier Martin-on-GCP VM
  was deleted at the same time). The hostname is a Worker custom domain on
  the separate `placemap.org` zone, matching `tools/tiles-r2/worker/wrangler.jsonc`
  and the tile URLs in `apps/regions/_shared/region-map.js`.
  - Tilesets: `places`, `places-overview`, `buildings`, `nz-polygons`.
  - Local copies of the archives are kept outside the repo; the worker
    README records the upload and rebuild procedure.
- Site domain: `religionmap.org` is served by GitHub Pages (`CNAME` at the
  repo root) with DNS on Cloudflare. The apex A/AAAA records and the `www`
  CNAME must stay **DNS only** (grey cloud), never proxied. GitHub Pages
  issues and renews the site's Let's Encrypt certificate only while the
  domain's A records resolve to GitHub's addresses; proxying breaks renewal
  (`https_certificate.state = bad_authz` in the Pages API) and, once the last
  certificate expires, Cloudflare returns a 526 error for every visitor. If
  that happens: set the records to DNS only, remove and re-add the custom
  domain under Settings → Pages to restart issuance, wait for the state to
  read `approved`, then re-tick Enforce HTTPS. Check with
  `gh api repos/go-bayes/places-of-worship/pages --jq .https_certificate`.
  The redirect domains (`placesmap.org`, `powmap.org`) and the tiles host are
  Worker custom domains on their own zones and are not affected.

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
