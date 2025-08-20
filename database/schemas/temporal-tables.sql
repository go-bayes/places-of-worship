-- =====================================================
-- Temporal Tables and Advanced Indexing Strategy
-- Optimized for historical analysis and performance
-- =====================================================

-- =====================================================
-- TEMPORAL PARTITIONING STRATEGY
-- =====================================================

-- Partition place_attributes by time for performance and storage management
-- Active data (recent 2 years) on fast storage
-- Historical data on slower, cheaper storage

-- Create partitioned table for large-scale temporal data
CREATE TABLE place_attributes_partitioned (
    LIKE place_attributes INCLUDING ALL
) PARTITION BY RANGE (valid_from);

-- Active partition (last 2 years) - high-performance storage
CREATE TABLE place_attributes_active 
PARTITION OF place_attributes_partitioned
FOR VALUES FROM ('2022-01-01'::timestamptz) TO ('2024-12-31'::timestamptz);

-- Recent historical partition (2-5 years back)
CREATE TABLE place_attributes_recent 
PARTITION OF place_attributes_partitioned
FOR VALUES FROM ('2019-01-01'::timestamptz) TO ('2022-01-01'::timestamptz);

-- Historical partition (5+ years back) - archival storage
CREATE TABLE place_attributes_historical 
PARTITION OF place_attributes_partitioned
FOR VALUES FROM ('2007-01-01'::timestamptz) TO ('2019-01-01'::timestamptz);

-- Future partition for ongoing data
CREATE TABLE place_attributes_future 
PARTITION OF place_attributes_partitioned
FOR VALUES FROM ('2024-12-31'::timestamptz) TO ('2030-01-01'::timestamptz);

-- =====================================================
-- ADVANCED TEMPORAL INDEXES
-- =====================================================

-- Temporal GiST index for efficient range queries
CREATE INDEX idx_place_attributes_temporal_gist 
ON place_attributes USING GIST (
    place_id, 
    attribute_type, 
    tstzrange(valid_from, COALESCE(valid_to, 'infinity'::timestamptz), '[)')
);

-- Composite index for current state queries
CREATE INDEX idx_place_attributes_current 
ON place_attributes (place_id, attribute_type, valid_from DESC) 
WHERE valid_to IS NULL;

-- Index for temporal overlap queries
CREATE INDEX idx_place_attributes_temporal_overlap
ON place_attributes USING GIST (
    tstzrange(valid_from, COALESCE(valid_to, 'infinity'::timestamptz), '[)')
) 
WHERE verification_status = 'verified';

-- Spatial-temporal composite index for geographic temporal queries
CREATE INDEX idx_places_spatial_temporal 
ON places USING GIST (
    geometry, 
    tstzrange(created_at, updated_at, '[]')
);

-- =====================================================
-- TEMPORAL QUERY FUNCTIONS
-- =====================================================

-- Function to get place state at specific point in time
CREATE OR REPLACE FUNCTION get_place_state_at_time(
    p_place_id UUID, 
    p_timestamp TIMESTAMPTZ
)
RETURNS TABLE (
    attribute_type TEXT,
    attribute_value JSONB,
    data_source TEXT,
    confidence_score FLOAT
)
LANGUAGE SQL STABLE
AS $$
    SELECT DISTINCT ON (pa.attribute_type)
        pa.attribute_type,
        pa.attribute_value,
        pa.data_source,
        pa.confidence_score
    FROM place_attributes pa
    WHERE pa.place_id = p_place_id
      AND pa.valid_from <= p_timestamp
      AND (pa.valid_to IS NULL OR pa.valid_to > p_timestamp)
    ORDER BY pa.attribute_type, pa.valid_from DESC;
$$;

-- Function to get all places active during time range
CREATE OR REPLACE FUNCTION get_places_active_during(
    p_start_time TIMESTAMPTZ,
    p_end_time TIMESTAMPTZ,
    p_region_id UUID DEFAULT NULL
)
RETURNS TABLE (
    place_id UUID,
    canonical_name TEXT,
    geometry GEOMETRY,
    first_seen TIMESTAMPTZ,
    last_seen TIMESTAMPTZ
)
LANGUAGE SQL STABLE
AS $$
    SELECT DISTINCT
        p.place_id,
        p.canonical_name,
        p.geometry,
        MIN(pa.valid_from) as first_seen,
        MAX(COALESCE(pa.valid_to, NOW())) as last_seen
    FROM places p
    JOIN place_attributes pa ON p.place_id = pa.place_id
    LEFT JOIN place_region_associations pra ON p.place_id = pra.place_id
    WHERE tstzrange(pa.valid_from, COALESCE(pa.valid_to, 'infinity'::timestamptz), '[)') 
          && tstzrange(p_start_time, p_end_time, '[)')
      AND (p_region_id IS NULL OR pra.region_id = p_region_id)
    GROUP BY p.place_id, p.canonical_name, p.geometry;
$$;

-- Function to track attribute changes over time
CREATE OR REPLACE FUNCTION get_attribute_timeline(
    p_place_id UUID,
    p_attribute_type TEXT
)
RETURNS TABLE (
    valid_from TIMESTAMPTZ,
    valid_to TIMESTAMPTZ,
    attribute_value JSONB,
    data_source TEXT,
    confidence_score FLOAT,
    change_type TEXT
)
LANGUAGE SQL STABLE
AS $$
    SELECT 
        pa.valid_from,
        pa.valid_to,
        pa.attribute_value,
        pa.data_source,
        pa.confidence_score,
        CASE 
            WHEN LAG(pa.attribute_value) OVER (ORDER BY pa.valid_from) IS NULL THEN 'initial'
            WHEN pa.attribute_value != LAG(pa.attribute_value) OVER (ORDER BY pa.valid_from) THEN 'changed'
            ELSE 'same'
        END as change_type
    FROM place_attributes pa
    WHERE pa.place_id = p_place_id
      AND pa.attribute_type = p_attribute_type
    ORDER BY pa.valid_from;
$$;

-- =====================================================
-- TEMPORAL AGGREGATION VIEWS
-- =====================================================

-- Monthly place creation timeline
CREATE MATERIALIZED VIEW places_creation_timeline AS
SELECT 
    DATE_TRUNC('month', pa.valid_from) as month,
    gr.region_type,
    gr.country_code,
    COUNT(DISTINCT pa.place_id) as places_created,
    COUNT(DISTINCT pa.attribute_value->>'denomination') as denominations_active
FROM place_attributes pa
JOIN places p ON pa.place_id = p.place_id
JOIN place_region_associations pra ON p.place_id = pra.place_id
JOIN geographic_regions gr ON pra.region_id = gr.region_id
WHERE pa.attribute_type = 'denomination'
  AND pa.valid_from >= '2007-01-01'::timestamptz
GROUP BY DATE_TRUNC('month', pa.valid_from), gr.region_type, gr.country_code
ORDER BY month, gr.country_code;

-- Index for timeline queries
CREATE INDEX idx_creation_timeline_date 
ON places_creation_timeline (month, country_code);

-- Annual denominational changes view
CREATE MATERIALIZED VIEW denominational_changes_annual AS
SELECT 
    EXTRACT(year FROM pa.valid_from) as year,
    gr.region_code,
    pa.attribute_value->>'denomination' as denomination,
    COUNT(*) as change_count,
    COUNT(CASE WHEN LAG(pa.attribute_value->>'denomination') 
          OVER (PARTITION BY pa.place_id ORDER BY pa.valid_from) IS NULL 
          THEN 1 END) as new_places,
    COUNT(CASE WHEN LAG(pa.attribute_value->>'denomination') 
          OVER (PARTITION BY pa.place_id ORDER BY pa.valid_from) != pa.attribute_value->>'denomination' 
          THEN 1 END) as conversions
FROM place_attributes pa
JOIN place_region_associations pra ON pa.place_id = pra.place_id
JOIN geographic_regions gr ON pra.region_id = gr.region_id
WHERE pa.attribute_type = 'denomination'
  AND pa.valid_from >= '2007-01-01'::timestamptz
GROUP BY EXTRACT(year FROM pa.valid_from), gr.region_code, pa.attribute_value->>'denomination'
ORDER BY year, gr.region_code, denomination;

-- =====================================================
-- HISTORICAL COVERAGE ANALYSIS
-- =====================================================

-- View to assess temporal data coverage quality
CREATE MATERIALIZED VIEW temporal_coverage_assessment AS
SELECT 
    p.place_id,
    p.canonical_name,
    MIN(pa.valid_from) as earliest_record,
    MAX(COALESCE(pa.valid_to, NOW())) as latest_record,
    AGE(MAX(COALESCE(pa.valid_to, NOW())), MIN(pa.valid_from)) as coverage_span,
    COUNT(DISTINCT pa.attribute_type) as attribute_types_count,
    COUNT(*) as total_versions,
    
    -- Calculate coverage gaps
    ARRAY_AGG(
        tstzrange(pa.valid_from, COALESCE(pa.valid_to, 'infinity'::timestamptz), '[)')
        ORDER BY pa.valid_from
    ) as temporal_ranges,
    
    -- Data quality metrics
    AVG(pa.confidence_score) as avg_confidence,
    COUNT(CASE WHEN pa.verification_status = 'verified' THEN 1 END)::FLOAT / COUNT(*) as verified_ratio,
    
    -- Source diversity
    COUNT(DISTINCT pa.data_source) as source_count,
    ARRAY_AGG(DISTINCT pa.data_source) as sources_used
    
FROM places p
JOIN place_attributes pa ON p.place_id = pa.place_id
GROUP BY p.place_id, p.canonical_name;

-- Index for coverage analysis
CREATE INDEX idx_temporal_coverage_span 
ON temporal_coverage_assessment (coverage_span DESC, avg_confidence DESC);

-- =====================================================
-- TEMPORAL DATA QUALITY FUNCTIONS
-- =====================================================

-- Function to detect temporal inconsistencies
CREATE OR REPLACE FUNCTION detect_temporal_anomalies()
RETURNS TABLE (
    place_id UUID,
    issue_type TEXT,
    description TEXT,
    attribute_ids UUID[]
)
LANGUAGE SQL
AS $$
    -- Overlapping valid periods for same attribute type
    SELECT DISTINCT
        pa1.place_id,
        'overlapping_periods' as issue_type,
        'Multiple valid periods overlap for same attribute type' as description,
        ARRAY[pa1.attribute_id, pa2.attribute_id] as attribute_ids
    FROM place_attributes pa1
    JOIN place_attributes pa2 ON (
        pa1.place_id = pa2.place_id 
        AND pa1.attribute_type = pa2.attribute_type
        AND pa1.attribute_id != pa2.attribute_id
    )
    WHERE tstzrange(pa1.valid_from, COALESCE(pa1.valid_to, 'infinity'::timestamptz), '[)')
          && tstzrange(pa2.valid_from, COALESCE(pa2.valid_to, 'infinity'::timestamptz), '[)')
    
    UNION ALL
    
    -- Gaps in temporal coverage
    SELECT 
        place_id,
        'temporal_gap' as issue_type,
        'Gap detected in temporal coverage' as description,
        ARRAY[attribute_id] as attribute_ids
    FROM (
        SELECT 
            place_id,
            attribute_id,
            attribute_type,
            valid_from,
            valid_to,
            LEAD(valid_from) OVER (
                PARTITION BY place_id, attribute_type 
                ORDER BY valid_from
            ) as next_valid_from
        FROM place_attributes
        WHERE attribute_type IN ('denomination', 'status')  -- Critical attributes
    ) t
    WHERE valid_to IS NOT NULL 
      AND next_valid_from IS NOT NULL 
      AND valid_to < next_valid_from
      AND AGE(next_valid_from, valid_to) > INTERVAL '1 day';
$$;

-- =====================================================
-- PERFORMANCE MONITORING VIEWS
-- =====================================================

-- View to monitor query performance on temporal data
CREATE VIEW temporal_query_performance AS
SELECT 
    schemaname,
    tablename,
    attname as column_name,
    n_distinct,
    correlation,
    most_common_vals[1:5] as top_values,
    most_common_freqs[1:5] as top_frequencies
FROM pg_stats 
WHERE tablename LIKE '%place_attributes%'
  AND attname IN ('valid_from', 'valid_to', 'attribute_type', 'data_source')
ORDER BY tablename, attname;

-- =====================================================
-- MAINTENANCE PROCEDURES
-- =====================================================

-- Procedure to archive old temporal data
CREATE OR REPLACE FUNCTION archive_old_temporal_data(
    p_cutoff_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '10 years'
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    archived_count INTEGER;
BEGIN
    -- Move very old data to archive table (if created)
    -- This is a placeholder for future archival strategy
    
    -- For now, just count what would be archived
    SELECT COUNT(*) INTO archived_count
    FROM place_attributes
    WHERE valid_to IS NOT NULL 
      AND valid_to < p_cutoff_date;
    
    -- Log archival activity
    INSERT INTO data_sources (source_name, source_type, description)
    VALUES (
        'archival_process_' || TO_CHAR(NOW(), 'YYYY_MM_DD'),
        'manual',
        'Archived ' || archived_count || ' records older than ' || p_cutoff_date
    )
    ON CONFLICT (source_name) DO NOTHING;
    
    RETURN archived_count;
END;
$$;

-- Function to update temporal statistics
CREATE OR REPLACE FUNCTION update_temporal_statistics()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- Analyze temporal tables for query optimization
    ANALYZE place_attributes;
    ANALYZE places;
    ANALYZE geographic_regions;
    
    -- Refresh materialized views
    REFRESH MATERIALIZED VIEW CONCURRENTLY places_creation_timeline;
    REFRESH MATERIALIZED VIEW CONCURRENTLY denominational_changes_annual;
    REFRESH MATERIALIZED VIEW CONCURRENTLY temporal_coverage_assessment;
    
    -- Update table statistics
    PERFORM pg_stat_reset_single_table_counters('place_attributes'::regclass);
END;
$$;

-- =====================================================
-- TEMPORAL CONSTRAINTS AND TRIGGERS
-- =====================================================

-- Trigger to prevent temporal overlaps for critical attributes
CREATE OR REPLACE FUNCTION prevent_temporal_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Check for overlapping periods for critical attributes
    IF NEW.attribute_type IN ('denomination', 'status', 'location') THEN
        IF EXISTS (
            SELECT 1 FROM place_attributes pa
            WHERE pa.place_id = NEW.place_id
              AND pa.attribute_type = NEW.attribute_type
              AND pa.attribute_id != COALESCE(NEW.attribute_id, uuid_generate_v4())
              AND tstzrange(pa.valid_from, COALESCE(pa.valid_to, 'infinity'::timestamptz), '[)')
                  && tstzrange(NEW.valid_from, COALESCE(NEW.valid_to, 'infinity'::timestamptz), '[)')
        ) THEN
            RAISE EXCEPTION 'Temporal overlap detected for critical attribute % on place %', 
                NEW.attribute_type, NEW.place_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_prevent_temporal_overlap
    BEFORE INSERT OR UPDATE ON place_attributes
    FOR EACH ROW
    EXECUTE FUNCTION prevent_temporal_overlap();

-- =====================================================
-- COMMENTS AND DOCUMENTATION
-- =====================================================

COMMENT ON TABLE place_attributes_partitioned IS 'Partitioned temporal attributes table for improved performance';
COMMENT ON FUNCTION get_place_state_at_time IS 'Retrieve complete place state at specific point in time';
COMMENT ON FUNCTION get_places_active_during IS 'Find all places active during specified time range';
COMMENT ON FUNCTION get_attribute_timeline IS 'Track changes to specific attribute over time';
COMMENT ON MATERIALIZED VIEW places_creation_timeline IS 'Monthly aggregation of place creation events';
COMMENT ON MATERIALIZED VIEW denominational_changes_annual IS 'Annual summary of denominational changes and conversions';
COMMENT ON MATERIALIZED VIEW temporal_coverage_assessment IS 'Quality assessment of temporal data coverage per place';
COMMENT ON FUNCTION detect_temporal_anomalies IS 'Automated detection of temporal data inconsistencies';
COMMENT ON FUNCTION archive_old_temporal_data IS 'Archive old temporal data for storage management';
COMMENT ON FUNCTION update_temporal_statistics IS 'Update table statistics and refresh materialized views';