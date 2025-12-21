# Global Places of Worship Mapping Project


## Quick Links


### Global Map: 
https://www.placesmap.org or 
https://go-bayes.github.io/places-of-worship/frontend/maplibre-flat.html 

## Data Enhances Map
- Enhanced NZ: https://go-bayes.github.io/places-of-worship/index.html

## Stack

- NZ places + census overlays (historic)
- **Access**: [Enhanced NZ Map](https://go-bayes.github.io/places-of-worship/index.html)
- **Frontend**: MapLibre GL JS (static HTML/JS/CSS), mobile-friendly dock toggle
- **Basemap**: MapTiler styles (Backdrop default), CARTO Light fallback
- **Custom tiles**: Martin (Docker) serving mbtiles/pmtiles from Google Cloud VM + GCS bucket
- **Street View**: Google Maps JS API (inline desktop, link-only on mobile)
- **Deployment**: GitHub Pages (static frontend), Martin on GCP VM with tiles from GCS
- **Data processing**: Tippecanoe for tiles; R/Python utilities for counts and manifests

### MapLibre / MapTiler workflow
MapLibre GL renders the map in the browser. Basemap styles are sourced from MapTiler, while custom data tiles are served separately via Martin.

### OpenStreetMap (OSM) Data
This project makes use of OpenStreetMap data. All OSM data and derivative databases are subject to the [Open Database License (ODbL 1.0)](https://opendatacommons.org/licenses/odbl/).

**Attribution**: © OpenStreetMap contributors

**License Compliance**: Databases derived from OSM are distributed under ODbL, consistent with OSM licence terms.

### Additional Data Sources
- **Statistics New Zealand**: CC BY 4.0
- **Various National Statistical Offices**: As attributed

## License

This project is licensed under the Open Database License (ODbL 1.0) to maintain compatibility with OpenStreetMap data.

## Team

- Dr. Joseph Watts, University of Canterbury
- Prof. Joseph Bulbulia, Victoria University of Wellington

## Thanks

This project is funded through a subgrant funded by the Templeton Religion Trust (TRT-2022-30666).

Nick Young at the University of Auckland Centre for E-research provided the initial inspiration. 
