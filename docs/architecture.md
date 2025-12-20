# Places of Worship - Architecture Overview

## High-level flow

ASCII diagram

User Browser
   |
   v
GitHub Pages (static frontend)
  |  - MapLibre GL JS
  |  - UI + controls
  v
MapTiler Cloud (basemap styles)
  ^
  |
Martin tile server (custom tiles) ----> Google VM (Docker)
  |
  v
Google Cloud Storage (tiles bucket)
  |
  v
Street View (Google Maps JS API)

User browser
  -> GitHub Pages (static frontend)
     -> MapLibre GL JS renders map
     -> MapTiler Cloud styles (basemap)
     -> Martin tile server (custom data layers)
     -> Google Maps JS API (Street View in popups)

## Components

Frontend (GitHub Pages)
- Files: `frontend/maplibre-flat.html`, `frontend/style.css`, `frontend/config.public.js`
- Role: UI, map controls, filters, popups, legend, counts

Basemap (MapTiler Cloud)
- Role: vector basemap styles (Backdrop, Toner, etc.)
- Key: `window.MAPTILER_API_KEY` in `frontend/config.public.js`
- Fallback: CARTO Light raster style when MapTiler fails

Custom data tiles (Martin + Google VM)
- Martin (Docker) serves vector tiles for:
  - `places` (full points)
  - `places-overview` (overview points)
  - `buildings`
  - `nz-polygons`
- Endpoint: `https://tiles.placemap.org`
- VM pulls tiles from Google Cloud Storage into `/srv/tiles`

Tile storage (Google Cloud Storage)
- Bucket: `places-tiles`
- Contains `.mbtiles` and `.pmtiles` files

Street View (Google Maps JS API)
- Used for popup panoramas
- Key: `window.GOOGLE_MAPS_API_KEY` in `frontend/config.public.js`

DNS
- `www.placesmap.org` -> GitHub Pages (CNAME to `go-bayes.github.io`)
- `placesmap.org` -> GitHub Pages (A records to GitHub IPs)
- `tiles.placemap.org` -> Google VM public IP (Martin)

## Data pipeline (local -> tiles -> server)

1) Build tiles locally (Tippecanoe)
2) Upload tiles to Google Cloud Storage
3) VM syncs tiles into `/srv/tiles`
4) Martin serves tiles over HTTPS
5) Frontend consumes tiles in MapLibre

## URLs used by the frontend

Basemap styles (MapTiler)
- `https://api.maptiler.com/maps/<style>/style.json?key=...`

Custom data tiles (Martin)
- `https://tiles.placemap.org/places/{z}/{x}/{y}`
- `https://tiles.placemap.org/places-overview/{z}/{x}/{y}`
- `https://tiles.placemap.org/buildings/{z}/{x}/{y}`
- `https://tiles.placemap.org/nz-polygons/{z}/{x}/{y}`

Street View
- `https://maps.googleapis.com/maps/api/js?key=...`
