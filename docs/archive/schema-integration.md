# Schema Integration - Existing Research Infrastructure with Global Architecture

## Overview

Integration strategy that preserves your existing research-grade JSON schemas (Site, Structure, Organisation) while enabling the high-performance global API architecture. This approach maintains academic rigor while delivering the speed needed for interactive mapping.

## Two-Layer Architecture

### Layer 1: High-Performance API (Map Rendering)
**Purpose**: Sub-second query times for interactive mapping
**Data Model**: Simplified, flat structure optimised for spatial queries
**Storage**: Parquet files with spatial indexing

### Layer 2: Research Database (Academic Analysis)  
**Purpose**: Rich temporal analysis with full audit trails
**Data Model**: Your existing Site/Structure/Organisation schemas
**Storage**: PostgreSQL with PostGIS and temporal tables

## Schema Mapping Strategy

### Core Places API Response (Fast Layer)
Based on your Site schema but optimised for map rendering:

```json
{
  "places": [
    {
      "place_id": "550e8400-e29b-41d4-a716-446655440000",
      "lat": -36.8485,
      "lng": 174.7633,
      "name": "St Patrick's Cathedral",
      "religion": "christian",
      "denomination": "catholic", 
      "confidence": 0.95,
      "country_code": "NZ",
      "established": "1850",
      "status": "active",
      "osm_id": 123456,
      "type": "churches"
    }
  ]
}
```

### Detailed Research Data (Rich Layer)
Full schema compliance with your Site/Structure/Organisation model:

```json
{
  "site": {
    "site_id": "550e8400-e29b-41d4-a716-446655440000",
    "names": [
      {
        "name": "St Patrick's Cathedral",
        "lang": "en",
        "type": "official"
      }
    ],
    "geometry": {
      "type": "Point",
      "coordinates": [174.7633, -36.8485]
    },
    "centroid": {
      "type": "Point", 
      "coordinates": [174.7633, -36.8485]
    },
    "address": {
      "street_address": "43 Wyndham Street",
      "locality": "Auckland",
      "region": "Auckland",
      "postal_code": "1010",
      "country_code": "NZ"
    },
    "admin": {
      "adm1_code": "AUK",
      "adm1_name": "Auckland Region",
      "adm2_code": "076",
      "adm2_name": "Auckland City"
    },
    "country_code": "NZ",
    "status": "active",
    "valid_from": "1850-01-01",
    "valid_to": null,
    "sameAs": [
      "https://www.wikidata.org/entity/Q7588259",
      "https://www.openstreetmap.org/way/123456"
    ],
    "tags_raw": {
      "amenity": "place_of_worship",
      "religion": "christian",
      "denomination": "catholic",
      "name": "St Patrick's Cathedral"
    },
    "created_at": "2024-08-20T10:30:00Z",
    "last_seen": "2024-08-20T15:45:00Z",
    "confidence": 0.95,
    "sources": [
      {
        "name": "openstreetmap",
        "source_id": "way/123456",
        "url": "https://www.openstreetmap.org/way/123456",
        "retrieved_at": "2024-08-20T10:30:00Z",
        "query_hash": "sha256:abc123...",
        "dataset_version": "2024-08-20",
        "licence": {
          "name": "ODbL-1.0",
          "url": "https://opendatacommons.org/licenses/odbl/1-0/",
          "attribution": "© OpenStreetMap contributors"
        }
      }
    ]
  },
  "organisations": [
    {
      "org_id": "660e8400-e29b-41d4-a716-446655440001",
      "site_id": "550e8400-e29b-41d4-a716-446655440000",
      "structure_ids": ["770e8400-e29b-41d4-a716-446655440002"],
      "names": [
        {
          "name": "Catholic Cathedral Parish",
          "lang": "en",
          "type": "official"
        }
      ],
      "religion": "christian",
      "denomination": "catholic",
      "affiliation": {
        "type": "diocese",
        "name": "Catholic Diocese of Auckland",
        "identifier": "auckland-diocese"
      },
      "languages": ["en", "mi"],
      "service_times": [
        {
          "day": "Sun",
          "time_local": "09:00",
          "rule": "FREQ=WEEKLY;BYDAY=SU",
          "timezone": "Pacific/Auckland"
        }
      ],
      "contact": {
        "phone": "+64 9 303 4509",
        "email": "info@stpatricks.org.nz"
      },
      "website": "https://www.stpatricks.org.nz",
      "status": "active",
      "active_from": "1850-01-01",
      "active_to": null,
      "sources": [
        {
          "name": "openstreetmap",
          "source_id": "way/123456", 
          "retrieved_at": "2024-08-20T10:30:00Z",
          "licence": {
            "name": "ODbL-1.0",
            "url": "https://opendatacommons.org/licenses/odbl/1-0/",
            "attribution": "© OpenStreetMap contributors"
          }
        }
      ]
    }
  ]
}
```

## Database Implementation

### Fast Query Tables (Optimised for API)
```sql
-- Flattened table for fast spatial queries (mirrors API response)
CREATE TABLE places_fast (
    place_id UUID PRIMARY KEY,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    geometry GEOMETRY(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng, lat), 4326)) STORED,
    name TEXT NOT NULL,
    religion TEXT,
    denomination TEXT,
    confidence REAL,
    country_code CHAR(2),
    established TEXT,
    status TEXT,
    osm_id BIGINT,
    place_type TEXT DEFAULT 'churches',
    
    -- Spatial indexing for fast bbox queries
    bbox_z8 TEXT GENERATED ALWAYS AS (
        CONCAT(
            8, '_',
            FLOOR((lng + 180) / 360 * POW(2, 8))::int, '_',
            FLOOR((1 - LN(TAN(RADIANS(lat)) + 1 / COS(RADIANS(lat))) / PI()) / 2 * POW(2, 8))::int
        )
    ) STORED,
    bbox_z12 TEXT GENERATED ALWAYS AS (
        CONCAT(
            12, '_',
            FLOOR((lng + 180) / 360 * POW(2, 12))::int, '_',
            FLOOR((1 - LN(TAN(RADIANS(lat)) + 1 / COS(RADIANS(lat))) / PI()) / 2 * POW(2, 12))::int
        )
    ) STORED,
    
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for maximum query performance
CREATE INDEX idx_places_fast_spatial ON places_fast USING GIST (geometry);
CREATE INDEX idx_places_fast_bbox_z8 ON places_fast (bbox_z8);
CREATE INDEX idx_places_fast_bbox_z12 ON places_fast (bbox_z12);
CREATE INDEX idx_places_fast_country ON places_fast (country_code);
CREATE INDEX idx_places_fast_religion ON places_fast (religion, denomination);
CREATE INDEX idx_places_fast_confidence ON places_fast (confidence) WHERE confidence >= 0.7;
```

### Research Tables (Your Full Schemas)
```sql
-- Sites table implementing your site.schema.json
CREATE TABLE sites (
    site_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    names JSONB, -- Array of Name objects per schema
    geometry GEOMETRY NOT NULL,
    centroid GEOMETRY(Point, 4326),
    address JSONB, -- PostalAddress object
    admin JSONB, -- Admin object  
    country_code CHAR(2) NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'closed', 'demolished', 'relocated', 'proposed', 'unknown')),
    valid_from DATE NOT NULL,
    valid_to DATE,
    same_as TEXT[], -- Array of URIs
    tags_raw JSONB, -- Raw OSM tags
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    confidence REAL CHECK (confidence >= 0 AND confidence <= 1),
    sources JSONB NOT NULL -- Array of Source objects
);

-- Organisations table implementing your organisation.schema.json
CREATE TABLE organisations (
    org_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(site_id),
    structure_ids UUID[], -- Array of structure references
    names JSONB, -- Array of Name objects
    religion TEXT,
    denomination TEXT,
    affiliation JSONB, -- Affiliation object
    languages TEXT[], -- BCP-47 language tags
    service_times JSONB, -- Array of service time objects
    contact JSONB, -- Contact object
    website TEXT,
    status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'relocated', 'unknown')),
    active_from DATE,
    active_to DATE,
    same_as TEXT[],
    tags_raw JSONB,
    sources JSONB NOT NULL
);

-- Structures table (referenced by organisations)
CREATE TABLE structures (
    structure_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(site_id),
    names JSONB,
    structure_type TEXT,
    geometry GEOMETRY,
    construction_date TEXT,
    architectural_style TEXT,
    capacity INTEGER,
    status TEXT NOT NULL,
    valid_from DATE NOT NULL,
    valid_to DATE,
    sources JSONB NOT NULL
);
```

### Synchronisation Between Layers
```sql
-- View that generates fast table data from research tables
CREATE OR REPLACE VIEW places_fast_sync AS
SELECT 
    s.site_id as place_id,
    ST_Y(s.centroid) as lat,
    ST_X(s.centroid) as lng,
    COALESCE(
        (s.names->0->>'name'),
        'Unknown Place'
    ) as name,
    o.religion,
    o.denomination,
    s.confidence,
    s.country_code,
    EXTRACT(year FROM s.valid_from)::text as established,
    s.status,
    (s.tags_raw->>'osm_id')::bigint as osm_id,
    'churches' as place_type
FROM sites s
LEFT JOIN organisations o ON s.site_id = o.site_id
WHERE s.status = 'active'
  AND s.confidence >= 0.5;

-- Function to sync changes from research to fast tables
CREATE OR REPLACE FUNCTION sync_places_fast()
RETURNS TRIGGER AS $$
BEGIN
    -- Delete old record if exists
    DELETE FROM places_fast WHERE place_id = NEW.site_id;
    
    -- Insert/update from view
    INSERT INTO places_fast (
        place_id, lat, lng, name, religion, denomination,
        confidence, country_code, established, status, osm_id
    )
    SELECT 
        place_id, lat, lng, name, religion, denomination,
        confidence, country_code, established, status, osm_id
    FROM places_fast_sync 
    WHERE place_id = NEW.site_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to maintain sync
CREATE TRIGGER sync_places_fast_trigger
    AFTER INSERT OR UPDATE ON sites
    FOR EACH ROW
    EXECUTE FUNCTION sync_places_fast();
```

## API Integration Patterns

### Fast Endpoint Implementation
```python
# api/places.py
from fastapi import FastAPI, Query
from typing import List, Optional

@app.get("/api/v1/places")
async def get_places(
    bounds: str = Query(..., description="Bounding box: minLat,minLng,maxLat,maxLng"),
    datasets: str = Query("churches", description="Comma-separated: churches,schools,townhalls"),
    limit: int = Query(100000, le=100000),
    confidence_min: Optional[float] = Query(None, ge=0.0, le=1.0)
):
    """Fast spatial query optimised for map rendering"""
    
    # Parse bounds
    min_lat, min_lng, max_lat, max_lng = map(float, bounds.split(','))
    
    # Build optimised query using spatial indexes
    query = """
    SELECT place_id, lat, lng, name, religion, denomination, 
           confidence, country_code, established, status, osm_id, place_type
    FROM places_fast 
    WHERE lat BETWEEN %s AND %s 
      AND lng BETWEEN %s AND %s
      AND place_type = ANY(%s)
    """
    
    params = [min_lat, max_lat, min_lng, max_lng, datasets.split(',')]
    
    if confidence_min:
        query += " AND confidence >= %s"
        params.append(confidence_min)
    
    query += " ORDER BY confidence DESC LIMIT %s"
    params.append(limit)
    
    # Execute with connection pooling
    results = await execute_query(query, params)
    
    # Format response matching religion repository format
    response = {
        "meta": {
            "churches": len([r for r in results if r['place_type'] == 'churches']),
            "query_time_ms": query_duration * 1000,
            "bounds": [min_lat, min_lng, max_lat, max_lng]
        },
        "churches": [format_place_record(r) for r in results if r['place_type'] == 'churches']
    }
    
    return response

def format_place_record(row: dict) -> dict:
    """Format database row to match API specification"""
    return {
        "id": str(row['place_id']),
        "lat": row['lat'],
        "lng": row['lng'], 
        "name": row['name'],
        "religion": row['religion'],
        "denomination": row['denomination'],
        "confidence": row['confidence'],
        "country_code": row['country_code'],
        "established": row['established'],
        "status": row['status'],
        "osm_id": row['osm_id'],
        "type": row['place_type']
    }
```

### Research Endpoint Implementation
```python
@app.get("/api/v1/places/{place_id}/research")
async def get_place_research_data(place_id: str):
    """Full research data conforming to your JSON schemas"""
    
    # Query full research tables
    site_query = """
    SELECT s.*, 
           array_agg(DISTINCT o.*) as organisations,
           array_agg(DISTINCT st.*) as structures
    FROM sites s
    LEFT JOIN organisations o ON s.site_id = o.site_id  
    LEFT JOIN structures st ON s.site_id = st.site_id
    WHERE s.site_id = %s
    GROUP BY s.site_id
    """
    
    result = await execute_query(site_query, [place_id])
    
    if not result:
        raise HTTPException(status_code=404, detail="Place not found")
    
    # Format according to your schemas
    site_data = format_site_schema(result[0])
    
    return {
        "site": site_data,
        "organisations": [format_organisation_schema(org) for org in result[0]['organisations'] if org],
        "structures": [format_structure_schema(struct) for struct in result[0]['structures'] if struct]
    }

def format_site_schema(row: dict) -> dict:
    """Format to match site.schema.json exactly"""
    return {
        "site_id": str(row['site_id']),
        "names": row['names'] or [],
        "geometry": json.loads(row['geometry']) if row['geometry'] else None,
        "centroid": json.loads(row['centroid']) if row['centroid'] else None,
        "address": row['address'] or {},
        "admin": row['admin'] or {},
        "country_code": row['country_code'],
        "status": row['status'],
        "valid_from": row['valid_from'].isoformat() if row['valid_from'] else None,
        "valid_to": row['valid_to'].isoformat() if row['valid_to'] else None,
        "sameAs": row['same_as'] or [],
        "tags_raw": row['tags_raw'] or {},
        "created_at": row['created_at'].isoformat(),
        "last_seen": row['last_seen'].isoformat(), 
        "confidence": row['confidence'],
        "sources": row['sources'] or []
    }
```

## Data Pipeline Integration

### Import Pipeline with Schema Validation
```python
# pipeline/import_with_schemas.py
import jsonschema
import json

class SchemaValidatedImporter:
    def __init__(self):
        # Load your JSON schemas
        with open('schemas/site.schema.json') as f:
            self.site_schema = json.load(f)
        with open('schemas/organisation.schema.json') as f:
            self.org_schema = json.load(f)
    
    def import_osm_place(self, osm_data: dict):
        """Import OSM data validating against your schemas"""
        
        # Create site record conforming to site.schema.json
        site_record = {
            "site_id": str(uuid.uuid4()),
            "names": [{"name": osm_data.get('name', ''), "type": "official"}],
            "geometry": {
                "type": "Point",
                "coordinates": [osm_data['lon'], osm_data['lat']]
            },
            "centroid": {
                "type": "Point", 
                "coordinates": [osm_data['lon'], osm_data['lat']]
            },
            "country_code": osm_data.get('country_code', 'XX'),
            "status": "active",
            "valid_from": datetime.now().date().isoformat(),
            "confidence": self.calculate_confidence(osm_data),
            "sources": [{
                "name": "openstreetmap",
                "source_id": f"way/{osm_data['id']}",
                "retrieved_at": datetime.now().isoformat(),
                "licence": {
                    "name": "ODbL-1.0",
                    "url": "https://opendatacommons.org/licenses/odbl/1-0/",
                    "attribution": "© OpenStreetMap contributors"
                }
            }],
            "tags_raw": osm_data.get('tags', {})
        }
        
        # Validate against schema
        try:
            jsonschema.validate(site_record, self.site_schema)
        except jsonschema.ValidationError as e:
            self.log_validation_error(osm_data['id'], e)
            return None
        
        # Insert to research database
        site_id = self.insert_site(site_record)
        
        # Create organisation record if religion data available
        if osm_data.get('tags', {}).get('religion'):
            org_record = {
                "org_id": str(uuid.uuid4()),
                "site_id": site_id,
                "religion": osm_data['tags']['religion'],
                "denomination": osm_data['tags'].get('denomination'),
                "status": "active",
                "sources": site_record['sources']
            }
            
            # Validate organisation schema
            try:
                jsonschema.validate(org_record, self.org_schema)
                self.insert_organisation(org_record)
            except jsonschema.ValidationError as e:
                self.log_validation_error(f"org_{osm_data['id']}", e)
        
        # Sync to fast table (via trigger)
        return site_id
```

## Migration Strategy

### From Current NZ Implementation
```python
# migration/nz_to_global.py
def migrate_nz_data():
    """Migrate existing NZ places to new schema structure"""
    
    # Load existing NZ GeoJSON
    with open('data/nz_places_optimized.geojson') as f:
        nz_data = json.load(f)
    
    for feature in nz_data['features']:
        props = feature['properties']
        
        # Create research-grade site record
        site_record = {
            "site_id": str(uuid.uuid4()),
            "names": [{"name": props['name'], "type": "official"}],
            "geometry": feature['geometry'],
            "centroid": feature['geometry'],  # Point geometry
            "country_code": "NZ",
            "status": "active", 
            "valid_from": "2024-01-01",  # Approximate
            "confidence": props['confidence'],
            "sources": [{
                "name": "openstreetmap",
                "source_id": f"osm/{props['osm_id']}",
                "retrieved_at": "2024-08-20T10:30:00Z",
                "licence": {
                    "name": "ODbL-1.0",
                    "url": "https://opendatacommons.org/licenses/odbl/1-0/",
                    "attribution": "© OpenStreetMap contributors"
                }
            }]
        }
        
        # Validate and insert
        if validate_against_schema(site_record, 'site'):
            insert_site(site_record)
```

## Benefits of Integration

### For Interactive Mapping
- **Maintains proven performance**: Sub-second queries via optimised fast tables
- **Backwards compatible**: Existing religion repository frontend works unchanged
- **Scalable**: Spatial indexing handles global dataset efficiently

### For Academic Research  
- **Schema compliance**: Full adherence to your research-grade JSON schemas
- **Temporal analysis**: Complete audit trails and versioning
- **Data quality**: Validation against schemas ensures consistency
- **Extensibility**: Easy to add new sources and attributes

### For Development
- **Clear separation**: Fast API vs rich research data
- **Automatic sync**: Triggers maintain consistency between layers
- **Validation**: Schema validation prevents data corruption
- **Future-proof**: Can extend schemas without breaking existing code

This integration approach gives you the best of both worlds: the interactive performance needed for global mapping and the academic rigor required for research analysis.