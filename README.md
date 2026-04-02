# Global Places of Worship Mapping Project

An open, research‑focused map of global places of worship. Built to support studies of how religion shapes, and is shaped by, its social and natural settings.

## Quick Links

- **Global Map:** [https://go-bayes.github.io/places-of-worship/index.html](https://go-bayes.github.io/places-of-worship/index.html)
- **Enhanced NZ Data Map:** [https://www.placesmap.org/enhanced-places.html](https://www.placesmap.org/enhanced-places.html)
- **Planning (single source of truth):** [PLANNING.md](PLANNING.md)

## Frequently Asked Questions (FAQ)

### How can I add or correct a place of worship on the map?

This map sources its data from **OpenStreetMap (OSM)**, a collaborative global mapping project. Like Wikipedia, OpenStreetMap is a free, open resource built and maintained by volunteers for the public good. To add a missing religious site, please follow these steps.

First, **create an OpenStreetMap account** at [https://www.openstreetmap.org](https://www.openstreetmap.org). 

Second, **navigate to the location** on the map where the place of worship is situated.

Third, **click "Edit"** to open the editor.

Fourth, **add a point** at the correct location and tag it appropriately, or select an existing place to revise details or remove incorrect entries.

When tagging the location, use `amenity=place_of_worship`. Add the religion (e.g., `religion=christian`, `religion=buddhist`, `religion=muslim`) and the denomination if applicable (e.g., `denomination=catholic`). Include the name and any other relevant details. If known, please add the construction date using `start_date=YYYY` (e.g., `start_date=1887`); this information is particularly valuable for scientific research on religious landscapes.

Finally, **save your changes** with a brief description. 

Your edits will be reviewed by the OSM community and typically appear on this map within a few days to weeks, depending on data update cycles.

For those new to the platform, the [OSM Beginners' Guide](https://wiki.openstreetmap.org/wiki/Beginners%27_guide) provides detailed instructions. 

Please note that all contributions must follow the [OpenStreetMap Licence (ODbL 1.0)](https://opendatacommons.org/licenses/odbl/) and be based on your own knowledge.

The most helpful contribution is fixing errors, revising details, removing incorrect places, or adding missing places directly in OpenStreetMap. If you want to contribute to this repository, please see [CONTRIBUTING.md](CONTRIBUTING.md).

### Current NZ scope

For the New Zealand dataset, the primary unit is the mapped place or building used for worship, not the congregation as a social group.

We currently include sites that are explicitly mapped in OpenStreetMap as `amenity=place_of_worship` or as clearly religious buildings. We exclude obviously non-worship records such as cemeteries, offices, residences, schools, childcare sites, and community facilities unless the worship space itself is mapped separately.

The current NZ regional boundary layer follows the official territorial authority geography used in `apps/regions/nz/data/territorial_authorities.geojson`. That includes Chatham Islands Territory. It does not currently extend to Cook Islands, Niue, or Tokelau.

### Who is involved?

This project is led by Professor Joseph Bulbulia (Victoria University of Wellington, New Zealand) and Dr Joseph Watts (University of Canterbury, New Zealand). 

We acknowledge Nick Young at the University of Auckland Centre for eResearch for providing the initial inspiration.

### Who funds this project?

This research is supported by a subgrant from the **Templeton Religion Trust (TRT-2022-30666)**, aimed at investigating the social consequences of religion. 

This is an independent, acadameic project. The funders have no roll in the design or implementation of this project. 

## Technical Architecture

The application utilises an open-source geospatial stack.

**Frontend and Visualisation:** the map interface is built with MapLibre GL JS, served as static HTML/CSS/JS via GitHub Pages. It features a mobile-friendly dock toggle and utilises Google Maps JS API for Street View integration (inline on desktop, link-only on mobile).

**Tile Services:** we use a custom tile generation workflow. Basemap styles are sourced from MapTiler (using the CARTO Light style as default, with Backdrop (and other themes, depending on whether you access via mobile or desktop) as fallbacks. Custom data tiles are processed using Tippecanoe and served via `Martin` (built in Rust) running in Docker from a Google Cloud VM. The underlying tile data (mbtiles/pmtiles) is stored in a Google Cloud Storage bucket.

**Data Processing:** R is the canonical language for the research-facing data pipeline. Python is retained for the API and supporting utilities, with Python environments and commands managed through `uv`.

## Data Sources and Licensing

### OpenStreetMap (OSM) Data

This project relies on OpenStreetMap data. All OSM data and derivative databases are subject to the [Open Database Licence (ODbL 1.0)](https://opendatacommons.org/licenses/odbl/). Databases derived from OSM are distributed under the ODbL, consistent with OSM licence terms.

**Attribution:** ©OpenStreetMap contributors.

### Additional Data Sources

We also incorporate data from Statistics New Zealand (CC BY 4.0) and various National Statistical Offices as attributed within the dataset.

## Licence

This project is licensed under the Open Database Licence (ODbL 1.0) to maintain compatibility with OpenStreetMap data.
