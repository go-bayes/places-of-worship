# Global Places of Worship Mapping - Planning (current)

## Current state
- MapLibre GL frontend (`frontend/maplibre-flat.html`) served via GitHub Pages.
- Basemap: MapTiler styles (Backdrop default) with CARTO fallback.
- Custom tiles (places, overview, buildings, NZ polygons) served by Martin on GCP VM from GCS tiles.
- Street View: inline on desktop (zoom gate), link-only on mobile.
- Mobile UI: dock toggle, counts/basemap selector hidden, min zoom guard.
- Domains: `www.placesmap.org` (frontend), `tiles.placemap.org` (Martin).

## To do
- improve north icon. 
- investigate Mapillary / KartaView for sourcing images
- Overture Maps (!) REVIEW - `scripts/extract_overture_images` pipleline. 
- mappillary for images.
- See new R script for better filtering of places : `extract_global_data.R`
- update data ingestion plan/ tracking diffs. 

### Data Quality
- Multi-source validation?
- Confidence scoring?
- Community feedback loops?
- Regular data freshness checks?

### Scalability
- Modular architecture
- Database partitioning
- SPEED


