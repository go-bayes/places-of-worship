# Global Places of Worship Mapping - Planning (current)

## To do
- investigate Mapillary / KartaView for sourcing images
- Overture Maps (!)

## Current state
- MapLibre GL frontend (`frontend/maplibre-flat.html`) served via GitHub Pages.
- Basemap: MapTiler styles (Backdrop default) with CARTO fallback.
- Custom tiles (places, overview, buildings, NZ polygons) served by Martin on GCP VM from GCS tiles.
- Street View: inline on desktop (zoom gate), link-only on mobile.
- Mobile UI: dock toggle, counts/basemap selector hidden, min zoom guard.
- Domains: `www.placesmap.org` (frontend), `tiles.placemap.org` (Martin).

## Near-term priorities
- Geocoding autocomplete (MapTiler) with Nominatim fallback for search.
- Precomputed denomination counts tiles for fast viewport summaries (avoid client-side counting).
- Mobile polish: smaller controls, safe min zoom, optional hide city chips if space is tight.
- Harden HTTPS/DNS for tiles and custom domain; ensure certificates stable.
- Automate counts manifest via `scripts/update_counts.R` after data sync.
- See new R script for better filtering of places : `extract_global_data.R`


## Medium-term
- Add UI filters (religion/denomination) driven by vector tile attributes.
- Improve Street View UX (retry/backoff, interior detection) and optional link-only mode toggle.
- Optional WebView wrappers for iOS/Android if we need store presence.

## Notes
- Interior Street View remains deferred until exterior pano behavior is fully stable.
- Data counts should be regenerated whenever `data/global/*_places.json` is updated (run `scripts/update_counts.R`).


### User Experience
- Better ui's // 3-d? 
- Need to instruct users about how to add data, via OSM

### Data Quality
- Multi-source validation?
- Confidence scoring?
- Community feedback loops?
- Regular data freshness checks?

### Scalability
- Modular architecture
- Database partitioning



