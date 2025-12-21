# Places of Worship - Architecture Overview

## High-level flow (current)

```
User browser
  -> GitHub Pages (static frontend, MapLibre GL)
     -> Basemap: MapTiler styles (Backdrop default) or CARTO fallback
     -> Custom tiles: Martin @ https://tiles.placemap.org (places, overview, buildings, NZ polygons)
     -> Street View: Google Maps JS API (inline desktop, link-only mobile)

Tile origin
  GCS bucket (places-tiles) -> Google VM (Docker) -> Martin -> HTTPS

Domains
  www.placesmap.org  -> GitHub Pages
  tiles.placemap.org -> Google VM (Martin)
```

## Components

Frontend (GitHub Pages)
- File: `frontend/maplibre-flat.html` (+ `config.public.js`, optional `config.js`)
- Features: MapLibre layers, desktop Street View, mobile link-out, mobile dock toggle, basemap selector (desktop only), counts (desktop only), city chips/search.

Basemap (MapTiler Cloud)
- Styles: Backdrop (default), Streets, Aquarelle, Dataviz, Satellite, Toner, Topo, Winter
- Key: `window.MAPTILER_API_KEY` in `frontend/config.public.js`
- Fallback: CARTO Light raster when MapTiler is unavailable

Custom data tiles (Martin on GCP VM)
- Layers:
  - `places` (full detail points)
  - `places-overview` (low-zoom overview points)
  - `buildings`
  - `nz-polygons`
- Endpoint: `https://tiles.placemap.org`
- VM pulls tiles from GCS into `/srv/tiles` and serves via Dockerised Martin

Tile storage (Google Cloud Storage)
- Bucket: `places-tiles` (mbtiles/pmtiles)
- Synced to VM; Martin reads from local `/srv/tiles`

Street View (Google Maps JS API)
- Inline pano on desktop (zoom gate)
- External link on mobile
- Key: `window.GOOGLE_MAPS_API_KEY` in `frontend/config.public.js`

DNS
- `www.placesmap.org` -> GitHub Pages (CNAME to `go-bayes.github.io`)
- `placesmap.org` -> GitHub Pages (A records to GitHub IPs)
- `tiles.placemap.org` -> Google VM public IP (Martin)

## Data pipeline (local -> tiles -> server)

1) Build tiles locally with Tippecanoe (`places.mbtiles`, `places-overview.mbtiles`, `buildings.mbtiles`, `nz-polygons.pmtiles`).
2) Upload tiles to GCS bucket `places-tiles`.
3) VM syncs/copies tiles into `/srv/tiles`.
4) Martin (Docker) serves tiles at `https://tiles.placemap.org`.
5) Frontend consumes tiles in MapLibre; MapTiler provides basemap.

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
