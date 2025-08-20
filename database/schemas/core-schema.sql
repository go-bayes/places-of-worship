-- =====================================================
-- Places of Worship Database Schema
-- Core tables for place-centric temporal data model
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- =====================================================
-- CORE PLACES TABLE
-- =====================================================

-- Immutable place identifiers with basic geographic information
CREATE TABLE places (
    place_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- External identifiers for data source linking
    osm_id BIGINT UNIQUE, -- OpenStreetMap node/way/relation ID
    google_place_id TEXT UNIQUE, -- Google Places API ID
    
    -- Core identifying information
    canonical_name TEXT NOT NULL, -- Standardised name for the place
    geometry GEOMETRY(Point, 4326) NOT NULL, -- WGS84 coordinates
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure we have at least one external identifier
    CONSTRAINT places_has_external_id CHECK (
        osm_id IS NOT NULL OR google_place_id IS NOT NULL
    )
);

-- Spatial index for geographic queries
CREATE INDEX idx_places_geometry ON places USING GIST (geometry);

-- Indexes for external ID lookups
CREATE INDEX idx_places_osm_id ON places (osm_id) WHERE osm_id IS NOT NULL;
CREATE INDEX idx_places_google_id ON places (google_place_id) WHERE google_place_id IS NOT NULL;

-- =====================================================
-- TEMPORAL ATTRIBUTES SYSTEM
-- =====================================================

-- All attribute changes tracked with full temporal versioning
CREATE TABLE place_attributes (
    attribute_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    place_id UUID NOT NULL REFERENCES places(place_id) ON DELETE CASCADE,
    
    -- Attribute classification
    attribute_type TEXT NOT NULL, -- e.g., 'denomination', 'capacity', 'architectural_style'
    attribute_value JSONB NOT NULL, -- Flexible value storage
    
    -- Data provenance
    data_source TEXT NOT NULL, -- 'osm', 'google_places', 'manual', 'census'
    source_reference TEXT, -- Changeset ID, API call ID, manual entry reference
    
    -- Temporal validity
    valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_to TIMESTAMPTZ, -- NULL indicates current/active record
    
    -- Quality and confidence
    confidence_score FLOAT DEFAULT 1.0 CHECK (confidence_score >= 0 AND confidence_score <= 1),
    verification_status TEXT DEFAULT 'unverified' CHECK (
        verification_status IN ('unverified', 'verified', 'disputed', 'deprecated')
    ),
    
    -- Audit trail
    created_by TEXT NOT NULL, -- User/system that created this record
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT, -- Additional context or manual annotations
    
    -- Ensure temporal consistency
    CONSTRAINT valid_temporal_range CHECK (valid_to IS NULL OR valid_to > valid_from)
);

-- Composite index for efficient temporal queries
CREATE INDEX idx_place_attributes_temporal 
ON place_attributes (place_id, attribute_type, valid_from DESC, valid_to DESC NULLS FIRST);

-- Index for provenance queries
CREATE INDEX idx_place_attributes_source 
ON place_attributes (data_source, source_reference) 
WHERE source_reference IS NOT NULL;

-- Index for quality filtering
CREATE INDEX idx_place_attributes_quality 
ON place_attributes (verification_status, confidence_score);

-- =====================================================
-- GEOGRAPHIC REGIONS FRAMEWORK
-- =====================================================

-- Flexible framework supporting different regional boundary systems
CREATE TABLE geographic_regions (
    region_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Region classification
    region_type TEXT NOT NULL, -- 'nz_sa2', 'us_census_tract', 'uk_postcode', etc.
    region_code TEXT NOT NULL, -- Official code within the region type
    region_name TEXT NOT NULL, -- Human-readable name
    
    -- Geographic extent
    geometry GEOMETRY(MultiPolygon, 4326) NOT NULL,
    centroid GEOMETRY(Point, 4326), -- Computed centroid for efficiency
    
    -- Administrative hierarchy
    country_code CHAR(2) NOT NULL, -- ISO 3166-1 alpha-2
    parent_region_id UUID REFERENCES geographic_regions(region_id),
    administrative_level INTEGER, -- 1=country, 2=state/province, 3=district, etc.
    
    -- Temporal validity for changing boundaries
    valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to DATE, -- NULL indicates current boundaries
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data_source TEXT NOT NULL,
    
    -- Ensure unique regions within type and time
    CONSTRAINT unique_region_temporal UNIQUE (region_type, region_code, valid_from, valid_to)
);

-- Spatial index for geographic operations
CREATE INDEX idx_geographic_regions_geometry 
ON geographic_regions USING GIST (geometry);

-- Index for region lookups
CREATE INDEX idx_geographic_regions_lookup 
ON geographic_regions (region_type, region_code, country_code);

-- Index for temporal region queries
CREATE INDEX idx_geographic_regions_temporal 
ON geographic_regions (valid_from, valid_to);

-- =====================================================
-- PLACE-REGION ASSOCIATIONS
-- =====================================================

-- Spatial relationships between places and regions (computed and cached)
CREATE TABLE place_region_associations (
    association_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    place_id UUID NOT NULL REFERENCES places(place_id) ON DELETE CASCADE,
    region_id UUID NOT NULL REFERENCES geographic_regions(region_id) ON DELETE CASCADE,
    
    -- Spatial relationship type
    relationship_type TEXT NOT NULL DEFAULT 'contains' CHECK (
        relationship_type IN ('contains', 'intersects', 'nearest')
    ),
    
    -- Distance for nearest relationships
    distance_meters FLOAT,
    
    -- When this association was computed
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    computation_method TEXT NOT NULL, -- 'spatial_query', 'geocoding', 'manual'
    
    -- Ensure unique place-region relationships
    CONSTRAINT unique_place_region UNIQUE (place_id, region_id, relationship_type)
);

-- Index for place -> regions queries
CREATE INDEX idx_place_region_place ON place_region_associations (place_id);

-- Index for region -> places queries  
CREATE INDEX idx_place_region_region ON place_region_associations (region_id);

-- =====================================================
-- DATA SOURCE MANAGEMENT
-- =====================================================

-- Track all external data sources and import history
CREATE TABLE data_sources (
    source_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Source identification
    source_name TEXT NOT NULL UNIQUE, -- 'osm', 'google_places', 'nz_census_2018'
    source_type TEXT NOT NULL CHECK (
        source_type IN ('osm', 'commercial_api', 'government', 'academic', 'manual')
    ),
    
    -- Access configuration
    api_endpoint TEXT, -- For API sources
    api_config JSONB, -- API keys, rate limits, etc.
    
    -- Import scheduling
    import_frequency INTERVAL, -- How often to check for updates
    last_import TIMESTAMPTZ,
    next_scheduled_import TIMESTAMPTZ,
    
    -- Status tracking
    active BOOLEAN DEFAULT TRUE,
    
    -- Metadata
    description TEXT,
    contact_info TEXT,
    license_info TEXT,
    attribution_required BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- CHANGE DETECTION SYSTEM
-- =====================================================

-- Automated detection of changes between data sources
CREATE TABLE detected_changes (
    change_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- What changed
    place_id UUID REFERENCES places(place_id) ON DELETE CASCADE,
    attribute_type TEXT NOT NULL,
    
    -- Source of change
    source_id UUID NOT NULL REFERENCES data_sources(source_id),
    source_reference TEXT, -- Changeset, API response ID, etc.
    
    -- Change details
    change_type TEXT NOT NULL CHECK (
        change_type IN ('create', 'update', 'delete', 'conflict')
    ),
    old_value JSONB,
    new_value JSONB,
    
    -- Detection metadata
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    detection_method TEXT NOT NULL, -- 'scheduled_import', 'manual_check', 'api_webhook'
    confidence_score FLOAT DEFAULT 1.0,
    
    -- Review status
    reviewed BOOLEAN DEFAULT FALSE,
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    action_taken TEXT, -- 'applied', 'rejected', 'manual_override', 'needs_investigation'
    reviewer_notes TEXT
);

-- Index for change review workflows
CREATE INDEX idx_detected_changes_review 
ON detected_changes (reviewed, detected_at DESC);

-- Index for place change history
CREATE INDEX idx_detected_changes_place 
ON detected_changes (place_id, detected_at DESC);

-- =====================================================
-- DATA QUALITY TRACKING
-- =====================================================

-- Track data quality metrics and validation results
CREATE TABLE place_data_quality (
    quality_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    place_id UUID NOT NULL REFERENCES places(place_id) ON DELETE CASCADE,
    
    -- Quality metrics
    osm_confidence FLOAT, -- Based on edit stability, mapper reputation
    external_validation BOOLEAN, -- Confirmed by external sources
    attribute_completeness FLOAT, -- Percentage of expected attributes present
    temporal_coverage_score FLOAT, -- How complete is historical coverage
    
    -- Issue tracking
    quality_issues TEXT[], -- Array of detected problems
    missing_attributes TEXT[], -- Attributes we expect but don't have
    
    -- Review status
    manual_review_status TEXT DEFAULT 'pending' CHECK (
        manual_review_status IN ('pending', 'approved', 'flagged', 'needs_work')
    ),
    last_reviewed TIMESTAMPTZ,
    reviewer_notes TEXT,
    
    -- Temporal tracking
    assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_until TIMESTAMPTZ -- When this assessment expires
);

-- Index for quality-based filtering
CREATE INDEX idx_place_quality_status 
ON place_data_quality (manual_review_status, osm_confidence);

-- =====================================================
-- HISTORICAL OSM IMPORT TRACKING
-- =====================================================

-- Track progress of OSM historical data imports
CREATE TABLE osm_historical_imports (
    import_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Geographic scope
    region_bounds GEOMETRY(Polygon, 4326), -- Area covered by this import
    country_code CHAR(2),
    
    -- Temporal scope
    osm_date_range TSTZRANGE NOT NULL, -- Time period imported from OSM
    
    -- Import results
    total_changesets BIGINT,
    total_versions_processed BIGINT,
    places_created INTEGER,
    places_updated INTEGER,
    places_deleted INTEGER,
    
    -- Processing status
    import_status TEXT NOT NULL DEFAULT 'pending' CHECK (
        import_status IN ('pending', 'running', 'completed', 'failed', 'cancelled')
    ),
    
    -- Metadata
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    processing_notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for tracking import progress
CREATE INDEX idx_osm_imports_status 
ON osm_historical_imports (import_status, started_at DESC);

-- Spatial index for import coverage
CREATE INDEX idx_osm_imports_bounds 
ON osm_historical_imports USING GIST (region_bounds);

-- =====================================================
-- MATERIALIZED VIEWS FOR PERFORMANCE
-- =====================================================

-- Current state view (most recent valid attributes per place)
CREATE MATERIALIZED VIEW places_current_state AS
SELECT DISTINCT ON (pa.place_id, pa.attribute_type)
    p.place_id,
    p.canonical_name,
    p.geometry,
    pa.attribute_type,
    pa.attribute_value,
    pa.data_source,
    pa.valid_from,
    pa.confidence_score,
    pa.verification_status
FROM places p
JOIN place_attributes pa ON p.place_id = pa.place_id
WHERE pa.valid_to IS NULL OR pa.valid_to > NOW()
ORDER BY pa.place_id, pa.attribute_type, pa.valid_from DESC;

-- Unique index for efficient current state queries
CREATE UNIQUE INDEX idx_places_current_state_unique 
ON places_current_state (place_id, attribute_type);

-- Spatial index for current state geographic queries
CREATE INDEX idx_places_current_state_geom 
ON places_current_state USING GIST (geometry);

-- Regional summaries view
CREATE MATERIALIZED VIEW regional_place_summaries AS
SELECT 
    gr.region_id,
    gr.region_type,
    gr.region_code,
    gr.region_name,
    gr.country_code,
    COUNT(pra.place_id) as total_places,
    COUNT(DISTINCT pcs.attribute_value->>'denomination') as denomination_count,
    MIN(pa.valid_from) as earliest_record,
    MAX(pa.valid_from) as latest_record
FROM geographic_regions gr
LEFT JOIN place_region_associations pra ON gr.region_id = pra.region_id
LEFT JOIN places_current_state pcs ON pra.place_id = pcs.place_id
LEFT JOIN place_attributes pa ON pra.place_id = pa.place_id
WHERE gr.valid_to IS NULL OR gr.valid_to > CURRENT_DATE
GROUP BY gr.region_id, gr.region_type, gr.region_code, gr.region_name, gr.country_code;

-- Index for regional summary queries
CREATE INDEX idx_regional_summaries_lookup 
ON regional_place_summaries (region_type, country_code, total_places);

-- =====================================================
-- AUTOMATED MAINTENANCE
-- =====================================================

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_summary_views()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY places_current_state;
    REFRESH MATERIALIZED VIEW CONCURRENTLY regional_place_summaries;
END;
$$;

-- Function to update place updated_at timestamp
CREATE OR REPLACE FUNCTION update_place_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE places 
    SET updated_at = NOW() 
    WHERE place_id = NEW.place_id;
    RETURN NEW;
END;
$$;

-- Trigger to update place timestamp when attributes change
CREATE TRIGGER trigger_update_place_timestamp
    AFTER INSERT OR UPDATE ON place_attributes
    FOR EACH ROW
    EXECUTE FUNCTION update_place_timestamp();

-- =====================================================
-- COMMENTS AND DOCUMENTATION
-- =====================================================

COMMENT ON TABLE places IS 'Core places table with immutable identifiers for places of worship';
COMMENT ON TABLE place_attributes IS 'Temporal attribute storage with full versioning and provenance tracking';
COMMENT ON TABLE geographic_regions IS 'Flexible regional boundary framework supporting multiple administrative systems';
COMMENT ON TABLE place_region_associations IS 'Cached spatial relationships between places and regions';
COMMENT ON TABLE data_sources IS 'Registry of external data sources with import configuration';
COMMENT ON TABLE detected_changes IS 'Automated change detection system for multi-source data integration';
COMMENT ON TABLE place_data_quality IS 'Data quality assessment and manual review tracking';
COMMENT ON TABLE osm_historical_imports IS 'Progress tracking for OSM historical data imports';

COMMENT ON MATERIALIZED VIEW places_current_state IS 'Current state of all places with most recent valid attributes';
COMMENT ON MATERIALIZED VIEW regional_place_summaries IS 'Aggregated statistics by geographic region';

-- Grant permissions for application roles (to be created during deployment)
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO places_read_only;
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO places_read_write;
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO places_admin;