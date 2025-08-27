# Global Places of Worship Mapping Project

A mapping infrastructure for religious sites, educational institutions, and civic buildings, built using OpenStreetMap data from 247 countries and territories.

**Live Demo**: [https://go-bayes.github.io/places-of-worship/landing.html](https://go-bayes.github.io/places-of-worship/landing.html)

## Dataset Overview

- 3,524,540 places of worship extracted from OpenStreetMap
- 247 countries and territories included
- WebGL-accelerated interactive mapping
- OpenStreetMap attribution and licensing compliance
- Multi-dataset architecture supporting places, schools, and civic buildings

## Three Mapping Systems

### 1. Production Global Map
- 2m+ global locations with temporal data
- WebGL-accelerated rendering via Leaflet.glify  
- Timeline-based historical analysis
- Viewport-based dynamic loading
- Based on Nick Young & Joseph Bulbulia's prototype (University of Auckland, Centre for E-research)
- **Access**: [Global Interactive Map](https://go-bayes.github.io/places-of-worship/frontend/global-places.html)

### 2. Enhanced New Zealand Map  
- 4k+ NZ places with census integration
- Census data overlays (2006-2018)
- Religious change analysis with delta calculations
- Interactive regional demographics
- **Access**: [Enhanced NZ Map](https://go-bayes.github.io/places-of-worship/index.html)

### 3. Development Global Database
- 3.5M+ extracted places from 247 countries
- Country-specific JSON files with consistent schema
- Multi-dataset architecture (places/schools/civic)
- **Data**: [Browse Global Data](https://go-bayes.github.io/places-of-worship/data/global/)

## Architecture

```
places-of-worship/
├── data/
│   ├── global/              # 247 country JSON files (3.5M+ places)
│   ├── nz_places_optimized.geojson  # NZ GeoJSON data
│   └── sa2.geojson          # Census boundaries
├── frontend/
│   └── global-places.html   # Production global map
├── src/
│   ├── enhanced-places-app.js      # Enhanced NZ application
│   ├── denomination-mapper.js      # Religion categorisation
│   ├── religion.json        # Census religion data
│   └── demographics.json    # Regional demographics
├── scripts/
│   └── extract_real_global_data.py # Global extraction engine
├── api/
│   └── main.py             # FastAPI backend
├── index.html              # Enhanced NZ map (main)
└── landing.html            # Project overview
```

## Getting Started

### View Maps Online
1. **Landing Page**: [https://go-bayes.github.io/places-of-worship/landing.html](https://go-bayes.github.io/places-of-worship/landing.html)
2. **Global Map**: [https://go-bayes.github.io/places-of-worship/frontend/global-places.html](https://go-bayes.github.io/places-of-worship/frontend/global-places.html)  
3. **Enhanced NZ**: [https://go-bayes.github.io/places-of-worship/index.html](https://go-bayes.github.io/places-of-worship/index.html)

### Local Development
```bash
# Clone repository
git clone https://github.com/go-bayes/places-of-worship.git
cd places-of-worship

# Set up Python environment for data extraction
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install requests geopandas pandas

# Run local API server (optional)
cd api
python -m pip install fastapi uvicorn
uvicorn main:app --reload --port 8000

# Serve static files for development
python -m http.server 8000
```

## Data Schema

Each country file (`data/global/{country_code}_places.json`) follows this schema:

```json
[
  {
    "lat": -36.8485,
    "lng": 174.7633,
    "name": "St Patrick's Cathedral",
    "religion": "christian",
    "denomination": "catholic",
    "country": "NZ"
  }
]
```

## Data Coverage

### Sample Country Statistics
- USA: 342,655 places
- Germany: 45,123 places  
- Brazil: 78,234 places
- India: 89,456 places
- China: 24,318 places
- Russia: 67,123 places
- France: 52,891 places

### Data Sources
- **Primary**: OpenStreetMap (ODbL License)
- **NZ Demographics**: Statistics New Zealand (CC BY 4.0)
- **Extraction**: Overpass API with systematic country-by-country queries

## Technology Stack

- **Frontend**: Leaflet.js, WebGL, HTML5/CSS3/JavaScript
- **Backend**: FastAPI, Python 3.8+
- **Database**: JSON files, PostGIS-ready
- **Data Processing**: GeoPandas, Pandas
- **Deployment**: GitHub Pages (static), Railway/Render (API)

## Development Roadmap

### Phase 1: Places Database
- ✅ 3.5M+ places of worship extracted
- ✅ 247/249 countries and territories processed
- 🔄 Quality validation and duplicate detection
- 🔄 Spatial indexing for performance

### Phase 2: Multi-Asset Integration
- Extract 5M+ schools globally
- Expand civic buildings database  
- Unified API with asset type filtering
- Cross-asset spatial analysis

### Phase 3: Global Demographics
- Integrate census APIs (USA, Canada, Australia, UK)
- Regional demographic overlays
- Socioeconomic indicator mapping
- Cross-country comparative analysis

### Phase 4: Production Deployment
- Cloud API deployment
- Performance optimisation for 7M+ assets
- Advanced filtering and search
- Research-grade data export tools

## Data Licensing & Attribution

### OpenStreetMap (OSM) Data
This project makes use of OpenStreetMap data. All OSM data and derivative databases are subject to the [Open Database License (ODbL 1.0)](https://opendatacommons.org/licenses/odbl/).

**Attribution**: © OpenStreetMap contributors

**License Compliance**: Databases derived from OSM are distributed under ODbL, consistent with OSM licence terms.

### Additional Data Sources
- **Statistics New Zealand**: CC BY 4.0
- **Various National Statistical Offices**: As attributed

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

This project is licensed under the Open Database License (ODbL 1.0) to maintain compatibility with OpenStreetMap data.

## Links

- **OpenStreetMap**: [https://www.openstreetmap.org/](https://www.openstreetmap.org/)
- **ODbL License**: [https://opendatacommons.org/licenses/odbl/](https://opendatacommons.org/licenses/odbl/)
- **Prototype Site**:[https://uoa-eresearch.github.io/religion/churches](https://uoa-eresearch.github.io/religion/churches)
---

**A research tool for studying global distribution of palces of worship, demographic, and social change**