-- Database initialization script for Places of Worship proof of concept
-- This script sets up the core schema and creates initial database structure

-- Connect to the places_of_worship database
\c places_of_worship;

-- Create application roles
CREATE ROLE places_read_only;
CREATE ROLE places_read_write;
CREATE ROLE places_admin;

-- Grant basic permissions
GRANT USAGE ON SCHEMA public TO places_read_only, places_read_write, places_admin;
GRANT CREATE ON SCHEMA public TO places_admin;

-- Load core schema
\i /docker-entrypoint-initdb.d/schemas/core-schema.sql

-- Load temporal enhancements
\i /docker-entrypoint-initdb.d/schemas/temporal-tables.sql

-- Grant permissions to application roles
GRANT SELECT ON ALL TABLES IN SCHEMA public TO places_read_only;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO places_read_write;  
GRANT ALL ON ALL TABLES IN SCHEMA public TO places_admin;

-- Grant sequence permissions
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO places_read_write, places_admin;

-- Set default permissions for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO places_read_only;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE ON TABLES TO places_read_write;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO places_admin;

-- Create initial data sources for NZ proof of concept
INSERT INTO data_sources (source_name, source_type, description, license_info, attribution_required)
VALUES 
    ('nz_stats_census', 'government', 'New Zealand Census religious affiliation data', 'CC BY 4.0', TRUE),
    ('nz_stats_boundaries', 'government', 'New Zealand SA2 statistical area boundaries', 'CC BY 4.0', TRUE),
    ('manual_proof_of_concept', 'manual', 'Manual data entry for proof of concept validation', 'Academic use', FALSE);

-- Log successful initialization
INSERT INTO data_sources (source_name, source_type, description)
VALUES ('database_initialization', 'manual', 'Database successfully initialized on ' || NOW()::text);

-- Create views for proof of concept
CREATE VIEW nz_religious_trends AS
SELECT 
    gr.region_code as sa2_code,
    gr.region_name as sa2_name,
    EXTRACT(year FROM pa.valid_from)::integer as year,
    pa.attribute_value as religious_data
FROM geographic_regions gr
JOIN place_region_associations pra ON gr.region_id = pra.region_id  
JOIN place_attributes pa ON pra.place_id = pa.place_id
WHERE gr.region_type = 'nz_sa2' 
  AND pa.attribute_type = 'census_religious_affiliation'
  AND gr.country_code = 'NZ'
ORDER BY gr.region_code, year;