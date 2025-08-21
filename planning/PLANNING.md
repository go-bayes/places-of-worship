# Global Places of Worship Mapping - Planning Document

## Overview

Building on the successful NZ prototype and the religion repository's global architecture, this plan outlines a fast path to creating a global places of worship mapping platform that maintains performance while being future-ready for regional data integration.

## Fast Path Strategy

### Phase 1: Global Foundation (Immediate)
- Extend the proven religion repository architecture globally
- Maintain existing performance characteristics (100K+ points via WebGL)
- Use modular API design that supports future regional data without refactoring

### Phase 2: Regional Data Integration (Future)
- Add demographic overlays without impacting core performance
- Integrate country-specific administrative boundaries
- Multi-source data validation and confidence scoring

## Architecture Design Principles

### 1. Performance First
- **WebGL Point Rendering**: Use Leaflet.glify for smooth 100K+ point display
- **Viewport-based Loading**: Only fetch data for current map bounds
- **Efficient Backend**: FastAPI + GeoPandas + Parquet for sub-second queries
- **Minimal Payload**: Send only essential data, defer heavy processing

### 2. Modular API Design
```
/api/v1/places/          # Core places data (bbox queries)
/api/v1/regions/         # Administrative boundaries (future)
/api/v1/demographics/    # Census/demographic data (future)
/api/v1/sources/         # Data source metadata and provenance
```

### 3. Data Architecture
- **Core Places**: Global point data (OSM + authoritative sources)
- **Regional Layers**: Country-specific demographic/census data
- **Boundaries**: Multi-level administrative divisions
- **Metadata**: Source tracking, confidence scoring, temporal data

## Technical Implementation

### Backend Architecture

#### Core API (FastAPI)
```python
# Primary endpoint - optimised for speed
@app.get("/api/v1/places/")
def get_places(bounds: str, datasets: str = "churches", limit: int = 100000):
    # Spatial query on pre-processed parquet files
    # Returns: {places: [...], meta: {...}}

# Future endpoint - regional data
@app.get("/api/v1/regions/{country_code}/demographics")
def get_demographics(country_code: str, bounds: str, level: str = "sa2"):
    # Returns census/demographic overlays
    # Separate from core places for performance isolation
```

#### Data Storage Strategy
```
data/
├── parquet/
│   ├── global_places.parquet      # Global places (WebMercator indexed)
│   ├── places_by_country/         # Country-specific optimised files
│   └── sources_metadata.parquet   # Provenance and confidence
├── regional/
│   ├── boundaries/                # Administrative boundaries by country
│   └── demographics/              # Census data by country/year
└── cache/                         # Computed spatial indices
```

### Frontend Architecture

#### Layered Approach
```javascript
// Core layer - always loaded
const placesLayer = L.glify.points({
    // Fast WebGL rendering of places
});

// Regional layers - loaded on demand
const demographicsLayer = L.geoJSON({
    // Census overlays, loaded separately
    style: feature => getDemographicStyle(feature)
});

// Timeline layer - historical data
const timelineData = new vis.DataSet();
```

## Data Sources Strategy

### Phase 1: Extend OSM Foundation
1. **Global OSM Extract**: Use existing religion repo approach globally
2. **Country-specific Validation**: Cross-reference with national databases
3. **Confidence Scoring**: Implement per-source confidence metrics

### Phase 2: Multi-source Integration
1. **Government Databases**: National religious registries
2. **Religious Directories**: Denominational databases
3. **Academic Sources**: Research institution datasets
4. **Crowdsourced**: Validated community contributions

## Schema Evolution

### Core Place Schema (Immediate)
```json
{
  "place_id": "uuid",
  "coordinates": [lng, lat],
  "name": "string",
  "religion": "controlled_vocab",
  "denomination": "string",
  "confidence": 0.85,
  "sources": ["osm:12345", "gov:abc"],
  "country_code": "NZ",
  "established": "1850",
  "status": "active"
}
```

### Extended Schema (Future-ready)
```json
{
  // Core fields above, plus:
  "administrative_codes": {
    "country": "NZ",
    "region": "Auckland",
    "sa2": "7001"
  },
  "demographic_context": {
    // Populated from regional API
    "local_religion_percent": 45.2,
    "population_density": 1250
  }
}
```

## Performance Targets

### Core Metrics
- **Point Loading**: <2 seconds for 100K points
- **Map Interaction**: <100ms pan/zoom response
- **Regional Overlays**: <3 seconds for demographic layers
- **Global Coverage**: Support for 1M+ places worldwide

### Scalability Approach
1. **Spatial Indexing**: Pre-computed spatial indices per zoom level
2. **CDN Distribution**: Global edge caching for parquet files
3. **Progressive Loading**: Load high-density areas progressively
4. **Client-side Caching**: Cache viewport data for offline use

## Migration Path

### From Religion Repository
1. **Copy Architecture**: Use proven FastAPI + Parquet approach
2. **Extend Data Pipeline**: Add confidence scoring and multi-source support
3. **Enhance Frontend**: Add temporal controls and better filtering
4. **Maintain Performance**: Preserve sub-second query times

### Future Regional Integration
1. **Separate API Endpoints**: Keep regional data isolated from core places
2. **Lazy Loading**: Load demographic overlays only when requested
3. **Cached Boundaries**: Pre-compute administrative boundary intersections
4. **Modular Frontend**: Add/remove regional layers without affecting core

## Implementation Priority

### Sprint 1: Global Foundation
- [ ] Set up global data pipeline using religion repo architecture
- [ ] Implement multi-country parquet generation
- [ ] Create modular API structure
- [ ] Deploy global frontend with timeline

### Sprint 2: Enhanced Features
- [ ] Add confidence scoring system
- [ ] Implement multi-source validation
- [ ] Create administrative boundary framework
- [ ] Add basic demographic API endpoints

### Sprint 3: Regional Integration
- [ ] Country-specific demographic overlays
- [ ] Advanced filtering and search
- [ ] Historical change analysis
- [ ] Performance optimisation

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