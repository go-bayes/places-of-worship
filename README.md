# Global Places of Worship Mapping Project

This is a global map for places of faith. It's primary purpose is to provide users with an experience of interconnection with people around the world through an exploration of the diversity and distribution of faiths. In the years a head, we will be integrating open data with this resource so that people can understand how religion affects and is affected by the world around it. 

## Frequently Asked Questions (FAQ)

### How can I add a missing place of worship to the map?

This map sources its data from **OpenStreetMap (OSM)**, a collaborative global mapping project similar to Wikipedia. Like Wikipedia, OpenStreetMap is a free, open resource with no commercial purposes—it's built and maintained by volunteers worldwide for the public good.

To add a missing religious site:

1. **Create an OpenStreetMap account** at https://www.openstreetmap.org
2. **Navigate to the location** where the place of worship is located
3. **Click "Edit"** to open the editor
4. **Add a point** at the correct location and tag it appropriately:
   - For the amenity tag, use `amenity=place_of_worship`
   - Add the religion (e.g., `religion=christian`, `religion=buddhist`, `religion=muslim`)
   - Add the denomination if applicable (e.g., `denomination=catholic`)
   - Include the name and any other relevant details
   - **If known, please add the construction date** using `start_date=YYYY` (e.g., `start_date=1887`). This information is valuable for scientific research on religious landscapes.
5. **Save your changes** with a brief description

Your edits will be reviewed by the OSM community and typically appear on this map within a few days to weeks, depending on data update cycles.

**New to OpenStreetMap?** Check out the [OSM Beginners' Guide](https://wiki.openstreetmap.org/wiki/Beginners%27_guide) for detailed instructions.

**Note**: All contributions to OpenStreetMap must follow the [OpenStreetMap License (ODbL 1.0)](https://opendatacommons.org/licenses/odbl/) and be based on your own knowledge or compatible data sources.

### Who is involved?

- Professor Joseph Bulbulia, Victoria University of Wellington, New Zealand
- Dr Joseph Watts, University of Canterbury, New Zealand


### Who funds this project? 

This project is funded through a subgrant funded by the Templeton Religion Trust (TRT-2022-30666) to investigate the social consequences of religion.


## Quick links

### Data Enhanced Map
- Enhanced NZ: https://go-bayes.github.io/places-of-worship/index.html

### Stack (main map)

- **Frontend**: MapLibre GL JS (static HTML/JS/CSS), mobile-friendly dock toggle
- **Basemap**: MapTiler styles (Backdrop default), CARTO Light fallback
- **Custom tiles**: Martin (Docker) serving mbtiles/pmtiles from Google Cloud VM + GCS bucket
- **Street View**: Google Maps JS API (inline desktop, link-only on mobile)
- **Deployment**: GitHub Pages (static frontend), Martin on GCP VM with tiles from GCS
- **Data processing**: Tippecanoe for tiles; R/Python utilities for counts and manifests


### MapLibre / MapTiler workflow

MapLibre GL renders the map in the browser. Basemap styles are sourced from MapTiler, custom data tiles are served separately via `Martin`.

### OpenStreetMap (OSM) Data

This project makes use of OpenStreetMap data. All OSM data and derivative databases are subject to the [Open Database License (ODbL 1.0)](https://opendatacommons.org/licenses/odbl/).

### **License Compliance**: 

Databases derived from OSM are distributed under ODbL, consistent with OSM licence terms: **Attribution**: ©OpenStreetMap contributors


### Additional Data Sources

- **Statistics New Zealand**: CC BY 4.0
- **Various National Statistical Offices**: As attributed

## License

This project is licensed under the Open Database License (ODbL 1.0) to maintain compatibility with OpenStreetMap data.

## Thanks

Funding: Templeton Religion Trust (TRT-2022-30666).

Nick Young at the University of Auckland Centre for E-research provided the initial inspiration.

