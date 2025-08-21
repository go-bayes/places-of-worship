# Places of Worship API Specification

## Design Principles

### Performance-First Architecture
- **Core places endpoint optimised for WebGL rendering (100K+ points)**
- **Viewport-based queries for sub-second response times**
- **Separate endpoints for heavy regional data to prevent performance degradation**
- **Backwards compatible with existing religion repository frontend**

### Modular Structure
- **No refactoring required when adding regional features**
- **Independent scaling of different data types**
- **Clean separation of concerns between mapping and analytics**

## Core API Endpoints

### 1. Places Data (High Performance)

#### GET /api/v1/places
**Primary endpoint optimised for map rendering**

```bash
GET /api/v1/places?bounds=-90,-180,90,180&datasets=churches&limit=100000
```

**Parameters:**
- `bounds` (required): Bounding box as "minLat,minLng,maxLat,maxLng"
- `datasets` (optional): Comma-separated list: "churches,schools,townhalls"
- `limit` (optional): Max results (default: 100000)
- `zoom` (optional): Map zoom level for adaptive density
- `confidence_min` (optional): Minimum confidence score (0.0-1.0)

**Response Format:**
```json
{
  "meta": {
    "churches": 45230,
    "schools": 12450,
    "townhalls": 890,
    "query_time_ms": 156,
    "bounds": [-90, -180, 90, 180],
    "total_global": 1250000
  },
  "churches": [
    {
      "id": "uuid-here",
      "lat": -36.8485,
      "lng": 174.7633,
      "name": "St Patrick's Cathedral",
      "religion": "christian",
      "denomination": "catholic",
      "confidence": 0.95,
      "country_code": "NZ",
      "osm_id": 123456,
      "established": "1850",
      "type": "churches"
    }
  ],
  "schools": [...],
  "townhalls": [...]
}
```

### 2. Place Details (Individual Records)

#### GET /api/v1/places/{place_id}
**Detailed information for specific place**

```json
{
  "place_id": "uuid-here",
  "names": [
    {"name": "St Patrick's Cathedral", "lang": "en", "type": "official"},
    {"name": "Katedrala Svetog Patrika", "lang": "hr", "type": "local"}
  ],
  "geometry": {
    "type": "Point", 
    "coordinates": [174.7633, -36.8485]
  },
  "religion": "christian",
  "denomination": "catholic",
  "address": {
    "street": "43 Wyndham Street",
    "city": "Auckland",
    "country": "New Zealand",
    "postal_code": "1010"
  },
  "contact": {
    "website": "https://www.stpatricks.org.nz",
    "phone": "+64 9 303 4509"
  },
  "sources": [
    {
      "name": "openstreetmap",
      "source_id": "123456",
      "confidence": 0.95,
      "last_updated": "2024-08-20T10:30:00Z"
    }
  ],
  "temporal_data": {
    "established": "1850",
    "status": "active",
    "major_changes": [
      {"date": "1906", "type": "renovation", "description": "Major rebuild"}
    ]
  }
}
```

### 3. Historical Data (Temporal Analysis)

#### GET /api/v1/places/{place_id}/history
**Historical versions and changes**

```json
{
  "place_id": "uuid-here",
  "versions": [
    {
      "version_id": "uuid-version",
      "valid_from": "2020-01-15T09:00:00Z",
      "valid_to": "2023-06-10T14:30:00Z",
      "changes": {
        "denomination": {"old": "protestant", "new": "catholic"},
        "name": {"old": "Community Church", "new": "St Patrick's"}
      },
      "source": "osm",
      "changeset": 98765432,
      "confidence": 0.88
    }
  ],
  "timeline": [
    {"date": "1850", "event": "established"},
    {"date": "1906", "event": "major_renovation"},
    {"date": "2020", "event": "denomination_change"}
  ]
}
```

## Regional Data Endpoints (Future-Ready)

### 4. Administrative Boundaries

#### GET /api/v1/regions/boundaries
**Regional boundary data for overlays**

```bash
GET /api/v1/regions/boundaries?bounds=-41.5,-174.5,-41.0,-174.0&country=NZ&level=sa2
```

**Parameters:**
- `bounds`: Geographic bounding box
- `country`: ISO country code
- `level`: Administrative level (sa2, census_tract, postcode, etc.)

**Response:**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "region_id": "sa2_7001",
        "name": "Auckland Central",
        "level": "sa2",
        "country": "NZ",
        "population": 12450
      },
      "geometry": {"type": "Polygon", "coordinates": [...]}
    }
  ]
}
```

### 5. Demographics & Census Data

#### GET /api/v1/regions/{region_id}/demographics
**Regional demographic data for analysis**

```json
{
  "region_id": "sa2_7001",
  "region_name": "Auckland Central",
  "data": {
    "2018": {
      "population": 12450,
      "religion": {
        "christian": 4500,
        "no_religion": 6200,
        "buddhist": 800,
        "muslim": 450,
        "hindu": 300,
        "other": 200
      },
      "demographics": {
        "median_age": 34.2,
        "median_income": 75000,
        "ethnicity": {
          "european": 6800,
          "maori": 1200,
          "pacific": 900,
          "asian": 3200,
          "other": 350
        }
      }
    },
    "2013": {...},
    "2006": {...}
  },
  "places_of_worship": {
    "total": 8,
    "by_religion": {
      "christian": 5,
      "buddhist": 2,
      "muslim": 1
    }
  }
}
```

### 6. Spatial Analysis

#### GET /api/v1/analysis/nearby
**Find places near geographic point or another place**

```bash
GET /api/v1/analysis/nearby?lat=-36.8485&lng=174.7633&radius=5km&religion=christian
```

```json
{
  "center": {"lat": -36.8485, "lng": 174.7633},
  "radius_km": 5,
  "results": [
    {
      "place_id": "uuid-here",
      "name": "St Paul's Church",
      "distance_km": 1.2,
      "religion": "christian",
      "denomination": "anglican"
    }
  ],
  "statistics": {
    "total_found": 15,
    "by_religion": {"christian": 12, "buddhist": 2, "muslim": 1},
    "density_per_km2": 3.2
  }
}
```

## Performance & Caching Strategy

### Response Time Targets
- **Places endpoint**: <500ms for 100K points
- **Regional boundaries**: <1s for country-level
- **Demographics**: <2s for detailed regional data
- **Individual place details**: <200ms

### Caching Layers
```python
# Redis caching strategy
cache_keys = {
    "places:{bounds}:{datasets}:{zoom}": 300,  # 5 minutes
    "boundaries:{country}:{level}": 3600,      # 1 hour  
    "demographics:{region_id}": 86400,         # 24 hours
    "place_detail:{place_id}": 1800           # 30 minutes
}
```

### Database Optimisation
- Spatial indexes on geometry columns
- Composite indexes on (bounds, religion, confidence)
- Read replicas for analytical queries
- Connection pooling for concurrent requests

## Authentication & Rate Limiting

### Public Access
- **Anonymous**: 1000 requests/hour for places endpoint
- **Registered**: 10000 requests/hour with API key
- **Academic**: Unlimited with approved research credentials

### API Key Format
```bash
# Include in header
Authorization: Bearer your-api-key-here

# Or as parameter  
GET /api/v1/places?api_key=your-key&bounds=...
```

## Error Handling

### Standard Error Response
```json
{
  "error": {
    "code": "INVALID_BOUNDS",
    "message": "Bounding box coordinates are invalid",
    "details": "Longitude must be between -180 and 180",
    "request_id": "req_abc123"
  }
}
```

### HTTP Status Codes
- `200`: Success
- `400`: Invalid parameters  
- `404`: Resource not found
- `429`: Rate limit exceeded
- `500`: Server error

## Versioning & Migration Strategy

### API Versioning
- Current: `/api/v1/`
- Future: `/api/v2/` (when major changes needed)
- Deprecation: 12-month notice for breaking changes

### Backwards Compatibility
- All v1 endpoints remain stable
- New features added as optional parameters
- Religion repository frontend continues working unchanged

This API design maintains the proven performance of your existing system while providing clear extension points for regional data integration without requiring any refactoring of the core mapping functionality.