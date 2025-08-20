# API Specification

## Overview

The Places of Worship API provides optimized access to spatial-temporal data for map rendering, historical analysis, and research queries. The API is designed for read-heavy workloads with efficient caching and supports both real-time interactive applications and complex analytical queries.

## Architecture Principles

### 1. RESTful Design with GraphQL Extension
- **REST API**: Standard HTTP endpoints for common operations
- **GraphQL**: Complex queries and data composition for research use
- **Direct SQL**: Academic access for complex analytical queries

### 2. Performance Optimisation
- **Spatial Indexing**: Efficient geographic bounding box queries
- **Temporal Caching**: Aggressive caching for historical data
- **Progressive Loading**: Hierarchical detail levels for map rendering
- **Read Replicas**: Separate analytical workloads from operational queries

### 3. Academic Research Focus
- **Temporal Precision**: Point-in-time and range queries
- **Data Provenance**: Full source attribution in responses
- **Export Capabilities**: CSV, GeoJSON, and academic formats
- **Query Documentation**: Reproducible query examples

## Base URL Structure

```
Production:  https://api.places-of-worship.org/v1
Development: https://dev-api.places-of-worship.org/v1
Local:       http://localhost:3000/v1
```

## Authentication

### API Key Authentication
```http
GET /v1/places
Authorization: Bearer YOUR_API_KEY
```

### Academic Access Tokens
```http
GET /v1/research/temporal-analysis
Authorization: Academic YOUR_INSTITUTION_TOKEN
```

## Core Endpoints

### Places API

#### Get Places in Bounding Box
```http
GET /v1/places/bbox
```

**Parameters:**
- `north`, `south`, `east`, `west` (required): Bounding box coordinates
- `zoom` (optional): Detail level 1-18, affects clustering
- `timestamp` (optional): Point-in-time query (ISO 8601)
- `include_inactive` (optional): Include places no longer active
- `denomination` (optional): Filter by denomination
- `region` (optional): Filter by region code
- `data_sources` (optional): Comma-separated list of allowed sources

**Response:**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [174.7633, -41.2865]
      },
      "properties": {
        "place_id": "550e8400-e29b-41d4-a716-446655440000",
        "canonical_name": "St. Paul's Cathedral",
        "denomination": "Anglican",
        "status": "active",
        "confidence_score": 0.95,
        "data_sources": ["osm", "google_places"],
        "last_updated": "2024-01-15T10:30:00Z",
        "attributes": {
          "capacity": 800,
          "architectural_style": "Gothic Revival",
          "established": "1866"
        }
      }
    }
  ],
  "metadata": {
    "total_places": 1,
    "timestamp_queried": "2024-01-20T00:00:00Z",
    "cache_expires": "2024-01-20T01:00:00Z",
    "attribution": {
      "osm": "© OpenStreetMap contributors",
      "google_places": "© Google"
    }
  }
}
```

#### Get Single Place Details
```http
GET /v1/places/{place_id}
```

**Parameters:**
- `place_id` (required): UUID of the place
- `timestamp` (optional): Historical state at specific time
- `include_history` (optional): Include full change timeline

**Response:**
```json
{
  "place_id": "550e8400-e29b-41d4-a716-446655440000",
  "canonical_name": "St. Paul's Cathedral",
  "geometry": {
    "type": "Point", 
    "coordinates": [174.7633, -41.2865]
  },
  "current_attributes": {
    "denomination": {
      "value": "Anglican",
      "data_source": "osm",
      "confidence_score": 0.95,
      "valid_from": "2020-01-01T00:00:00Z",
      "last_verified": "2024-01-15T10:30:00Z"
    },
    "capacity": {
      "value": 800,
      "data_source": "manual",
      "confidence_score": 1.0,
      "valid_from": "2023-06-01T00:00:00Z"
    }
  },
  "regional_associations": [
    {
      "region_type": "nz_sa2",
      "region_code": "7024",
      "region_name": "Wellington Central",
      "relationship": "contains"
    }
  ],
  "quality_assessment": {
    "completeness": 0.85,
    "external_validation": true,
    "manual_review_status": "approved",
    "last_reviewed": "2024-01-10T00:00:00Z"
  }
}
```

### Temporal Analysis API

#### Get Historical Timeline
```http
GET /v1/places/{place_id}/timeline
```

**Parameters:**
- `place_id` (required): UUID of the place
- `attribute_type` (optional): Specific attribute to track
- `start_date`, `end_date` (optional): Date range filter

**Response:**
```json
{
  "place_id": "550e8400-e29b-41d4-a716-446655440000",
  "timeline": [
    {
      "valid_from": "2020-01-01T00:00:00Z",
      "valid_to": "2022-06-15T00:00:00Z",
      "changes": {
        "denomination": {
          "old_value": null,
          "new_value": "Anglican",
          "change_type": "initial",
          "data_source": "osm"
        }
      }
    },
    {
      "valid_from": "2022-06-15T00:00:00Z",
      "valid_to": null,
      "changes": {
        "capacity": {
          "old_value": null,
          "new_value": 800,
          "change_type": "addition",
          "data_source": "manual"
        }
      }
    }
  ],
  "summary": {
    "total_changes": 2,
    "first_recorded": "2020-01-01T00:00:00Z",
    "last_updated": "2022-06-15T00:00:00Z",
    "data_sources_used": ["osm", "manual"]
  }
}
```

#### Get Places Active During Period
```http
GET /v1/temporal/active-during
```

**Parameters:**
- `start_date`, `end_date` (required): Date range (ISO 8601)
- `region` (optional): Geographic region filter
- `denomination` (optional): Denomination filter
- `bbox` (optional): Bounding box filter

**Response:**
```json
{
  "query_period": {
    "start_date": "2018-01-01T00:00:00Z",
    "end_date": "2020-01-01T00:00:00Z"
  },
  "places": [
    {
      "place_id": "550e8400-e29b-41d4-a716-446655440000",
      "canonical_name": "St. Paul's Cathedral",
      "geometry": {...},
      "active_period": {
        "first_seen": "2015-03-01T00:00:00Z",
        "last_seen": "2024-01-01T00:00:00Z",
        "status_during_period": "active"
      },
      "attributes_during_period": {
        "denomination": "Anglican",
        "capacity": 650  // Historical value
      }
    }
  ],
  "summary": {
    "total_places": 1,
    "new_during_period": 0,
    "closed_during_period": 0,
    "changed_during_period": 1
  }
}
```

### Regional Analysis API

#### Get Regional Summary
```http
GET /v1/regions/{region_id}/summary
```

**Parameters:**
- `region_id` (required): UUID of the region
- `timestamp` (optional): Historical summary at specific time
- `include_trends` (optional): Include temporal trend data

**Response:**
```json
{
  "region_id": "region-uuid-here",
  "region_info": {
    "type": "nz_sa2",
    "code": "7024",
    "name": "Wellington Central",
    "country": "NZ"
  },
  "summary": {
    "total_places": 15,
    "denominations": {
      "Anglican": 4,
      "Catholic": 3,
      "Methodist": 2,
      "Presbyterian": 3,
      "Other": 3
    },
    "temporal_coverage": {
      "earliest_record": "2010-01-01T00:00:00Z",
      "latest_update": "2024-01-15T00:00:00Z",
      "coverage_span": "14 years"
    }
  },
  "quality_metrics": {
    "avg_confidence": 0.87,
    "verified_places": 12,
    "data_source_diversity": 3.2
  },
  "trends": {
    "places_added_last_year": 1,
    "places_modified_last_year": 3,
    "denomination_changes": 0
  }
}
```

#### Get Regional Comparisons
```http
GET /v1/regions/compare
```

**Parameters:**
- `regions` (required): Comma-separated region IDs
- `metrics` (optional): Specific metrics to compare
- `time_period` (optional): Temporal scope for comparison

### Map Rendering API

#### Get Map Tiles (Vector)
```http
GET /v1/tiles/{z}/{x}/{y}.pbf
```

**Parameters:**
- `z`, `x`, `y` (required): Tile coordinates
- `timestamp` (optional): Historical state
- `style` (optional): Rendering style preset

**Response:** Mapbox Vector Tile (Protocol Buffers)

#### Get Clustered Places
```http
GET /v1/clusters/bbox
```

**Parameters:**
- `north`, `south`, `east`, `west` (required): Bounding box
- `zoom` (required): Zoom level for clustering
- `cluster_radius` (optional): Clustering distance in pixels

**Response:**
```json
{
  "clusters": [
    {
      "type": "cluster",
      "coordinates": [174.7633, -41.2865],
      "place_count": 5,
      "denominations": ["Anglican", "Catholic", "Methodist"],
      "cluster_id": "cluster_001",
      "bounds": {
        "north": -41.280,
        "south": -41.290,
        "east": 174.770,
        "west": 174.756
      }
    }
  ],
  "individual_places": [
    {
      "place_id": "isolated-place-uuid",
      "coordinates": [174.8000, -41.3000],
      "canonical_name": "Isolated Chapel",
      "denomination": "Methodist"
    }
  ]
}
```

## Research and Analytics API

### Complex Query Interface
```http
POST /v1/research/query
```

**Request Body:**
```json
{
  "query_type": "temporal_analysis",
  "parameters": {
    "analysis_type": "denomination_changes",
    "geographic_scope": {
      "country": "NZ",
      "region_types": ["nz_sa2"]
    },
    "temporal_scope": {
      "start_date": "2010-01-01",
      "end_date": "2024-01-01",
      "granularity": "yearly"
    },
    "filters": {
      "min_confidence": 0.7,
      "exclude_sources": ["manual"]
    }
  },
  "output_format": "csv"
}
```

### Data Export API
```http
GET /v1/export/places
```

**Parameters:**
- `format` (required): 'csv', 'geojson', 'shapefile'
- `filters` (optional): JSON query filters
- `temporal_slice` (optional): Specific timestamp for historical export

## GraphQL API

### Endpoint
```
POST /v1/graphql
```

### Example Queries

#### Complex Place Query
```graphql
query GetPlaceWithHistory($placeId: UUID!, $includeHistory: Boolean = false) {
  place(id: $placeId) {
    id
    canonicalName
    geometry
    currentAttributes {
      type
      value
      dataSource
      confidenceScore
      validFrom
    }
    regionalAssociations {
      region {
        type
        code
        name
        country
      }
      relationship
    }
    qualityAssessment {
      completeness
      verificationStatus
      lastReviewed
    }
    
    history @include(if: $includeHistory) {
      validFrom
      validTo
      attributeChanges {
        type
        oldValue
        newValue
        changeType
        dataSource
      }
    }
  }
}
```

#### Regional Analysis Query
```graphql
query RegionalDenominationalAnalysis($regionType: String!, $country: String!) {
  regions(type: $regionType, country: $country) {
    id
    code
    name
    summary {
      totalPlaces
      denominations {
        name
        count
        percentageChange(period: LAST_5_YEARS)
      }
      temporalCoverage {
        earliestRecord
        latestUpdate
        dataQuality
      }
    }
    places {
      totalCount
      byDenomination {
        denomination
        places {
          id
          name
          establishedDate
          currentStatus
        }
      }
    }
  }
}
```

## Error Handling

### Standard Error Response
```json
{
  "error": {
    "code": "INVALID_BBOX",
    "message": "Bounding box coordinates are invalid",
    "details": {
      "field": "north",
      "value": "not_a_number",
      "expected": "float"
    },
    "request_id": "req_123456789"
  }
}
```

### Error Codes
- `400 BAD_REQUEST`: Invalid parameters
- `401 UNAUTHORIZED`: Authentication required
- `403 FORBIDDEN`: Insufficient permissions
- `404 NOT_FOUND`: Resource not found
- `422 UNPROCESSABLE_ENTITY`: Valid syntax but invalid data
- `429 RATE_LIMITED`: Too many requests
- `500 INTERNAL_ERROR`: Server error

## Rate Limiting

### Limits by Access Level
- **Free Tier**: 1,000 requests/day, 10 requests/minute
- **Academic**: 50,000 requests/day, 100 requests/minute  
- **Institutional**: 500,000 requests/day, 1,000 requests/minute

### Headers
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1609459200
```

## Caching Strategy

### Cache Headers
```http
Cache-Control: public, max-age=3600
ETag: "33a64df551425fcc55e4d42a148795d9f25f89d4"
Last-Modified: Wed, 15 Jan 2024 10:30:00 GMT
```

### Cache Invalidation
- **Current Data**: 1 hour TTL
- **Historical Data**: 24 hour TTL (mostly immutable)
- **Regional Summaries**: 6 hour TTL
- **Map Tiles**: 1 week TTL

## Attribution Requirements

### Automated Attribution
All responses include required attribution in metadata:
```json
{
  "attribution": {
    "osm": "© OpenStreetMap contributors, licensed under ODbL",
    "google_places": "© Google",
    "manual": "© Research Institution Name",
    "generated": "Data processing by Places of Worship Database Project"
  },
  "license": "ODbL",
  "citation": "Places of Worship Database (2024). Research Institution. https://places-of-worship.org"
}
```

## API Versioning

### URL Versioning
- `/v1/`: Current stable API
- `/v2/`: Future major version
- `/beta/`: Experimental endpoints

### Deprecation Policy
- 6 months notice for breaking changes
- Backward compatibility within major versions
- Migration guides provided for version changes

This API specification provides comprehensive access to the temporal-spatial data while maintaining performance and academic research requirements.