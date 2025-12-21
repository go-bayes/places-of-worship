# Global Places of Worship Mapping - Planning (current)

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

## Medium-term
- Add UI filters (religion/denomination) driven by vector tile attributes.
- Improve Street View UX (retry/backoff, interior detection) and optional link-only mode toggle.
- Optional WebView wrappers for iOS/Android if we need store presence.

## Notes
- Interior Street View remains deferred until exterior pano behavior is fully stable.
- Data counts should be regenerated whenever `data/global/*_places.json` is updated (run `scripts/update_counts.R`).

## Success Metrics

### Technical
- Handle 1M+ global places with <2s load times
- Support 50+ countries with regional data
- Maintain 99.9% API uptime
- Sub-second spatial queries at global scale

### User Experience
- Seamless transition from NZ prototype
- Intuitive global navigation
- Rich contextual information
- Responsive performance across devices

## Risk Mitigation

### Data Quality
- Multi-source validation
- Confidence scoring
- Community feedback loops
- Regular data freshness checks

### Performance
- Graduated loading strategies
- CDN distribution
- Client-side caching
- Fallback mechanisms

### Scalability
- Modular architecture
- Horizontal scaling
- Database partitioning
- Progressive enhancement

---

This plan balances immediate global deployment with future-ready architecture for regional data integration.
