# Database Architecture Design

## Overview

The Places of Worship database is designed around a **place-centric temporal data model** that prioritises flexibility, extensibility, and rigorous temporal analysis capabilities. This document details the architectural decisions and their rationale.

## Core Design Principles

### 1. Place-Centric Architecture

**Decision**: Use places as the fundamental unit of analysis rather than administrative regions.

**Rationale**:
- Administrative boundaries change over time, making longitudinal analysis difficult
- Different countries use different regional systems (SA2, Census tracts, postcodes)
- Places are more stable anchor points for attaching regional and temporal data
- Enables future extensibility to non-administrative spatial frameworks

**Implementation**:
```sql
-- Immutable place identifiers
places (
    place_id UUID,     -- Internal canonical identifier
    osm_id BIGINT,     -- External source linking
    geometry POINT,    -- WGS84 coordinates
    canonical_name TEXT
)
```

### 2. Temporal Versioning System

**Decision**: Full temporal versioning with valid-from/valid-to semantics for all attributes.

**Rationale**:
- Academic research requires precise temporal analysis capabilities
- Multiple data sources provide conflicting information at different times
- Historical trend analysis is a core research objective
- Enables point-in-time queries and change detection

**Implementation**:
```sql
place_attributes (
    place_id UUID,
    attribute_type TEXT,    -- 'denomination', 'capacity', etc.
    attribute_value JSONB,  -- Flexible schema
    valid_from TIMESTAMPTZ,
    valid_to TIMESTAMPTZ,   -- NULL = currently valid
    data_source TEXT,
    confidence_score FLOAT
)
```

### 3. Multi-Source Data Integration

**Decision**: Native support for multiple, potentially conflicting data sources.

**Rationale**:
- OpenStreetMap alone is incomplete for research purposes
- Commercial APIs (Google Places) provide complementary data
- Manual curation is necessary for academic standards
- Automated conflict detection enables quality control

**Implementation**:
- Source tracking in every attribute record
- Confidence scoring for automated conflict resolution
- Change detection system for automated import processing
- Manual review workflows for disputed information

## Schema Design Details

### Core Tables Structure

#### Places Table
- **Purpose**: Immutable identifiers and basic geographic information
- **Key Features**: 
  - UUID primary keys for internal consistency
  - External ID mapping (OSM, Google Places)
  - PostGIS geometry for spatial operations
  - Minimal, stable schema to avoid migration issues

#### Place Attributes Table
- **Purpose**: All descriptive information with temporal versioning
- **Key Features**:
  - JSONB for flexible attribute storage
  - Temporal ranges with efficient indexing
  - Data provenance tracking
  - Confidence scoring for quality assessment

#### Geographic Regions Framework
- **Purpose**: Flexible support for different regional boundary systems
- **Key Features**:
  - Multi-level administrative hierarchies
  - Temporal validity for changing boundaries
  - Country-agnostic design for global deployment
  - Cached spatial relationships for performance

### Temporal Data Model

#### Time Representation
- **Valid Time**: When the information was true in the real world
- **Transaction Time**: When the information was recorded in our system
- **Bitemporal Support**: Full support for both temporal dimensions

#### Temporal Queries
```sql
-- Point-in-time state
SELECT * FROM get_place_state_at_time('place-uuid', '2020-01-01'::timestamptz);

-- Active during period
SELECT * FROM get_places_active_during('2018-01-01', '2020-01-01');

-- Change timeline
SELECT * FROM get_attribute_timeline('place-uuid', 'denomination');
```

#### Performance Optimization
- Partitioned tables by temporal ranges (active/historical/archive)
- GiST indexes for temporal range queries
- Materialized views for common aggregations
- Selective historical import (full detail recent, snapshots historical)

## Data Quality Framework

### Quality Assessment Dimensions

1. **Completeness**: Percentage of expected attributes present
2. **Accuracy**: Cross-validation against multiple sources
3. **Consistency**: Temporal and logical consistency checks
4. **Currency**: How up-to-date the information is
5. **Provenance**: Clear source attribution and confidence

### Quality Control Processes

#### Automated Validation
```sql
-- Detect obvious inconsistencies
SELECT * FROM detect_temporal_anomalies();

-- Quality scoring
place_data_quality (
    place_id UUID,
    osm_confidence FLOAT,
    external_validation BOOLEAN,
    quality_issues TEXT[]
)
```

#### Manual Review Workflow
- Flagging system for suspicious changes
- Review queue with priority scoring
- Reviewer tracking and audit trails
- Approval/rejection with explanatory notes

### Change Detection System

#### Automated Import Processing
1. **Data Ingestion**: Scheduled imports from external sources
2. **Change Detection**: Compare new data with existing records
3. **Confidence Assessment**: Score changes based on source reliability
4. **Review Routing**: Flag uncertain changes for manual review
5. **Automated Application**: Apply high-confidence changes automatically

#### Conflict Resolution
- **Source Prioritization**: Configurable source reliability ranking
- **Temporal Precedence**: More recent information preferred
- **Confidence Weighted**: Combine confidence scores for decisions
- **Manual Override**: Human reviewers can override automated decisions

## Performance Architecture

### Storage Strategy

#### Tiered Storage Approach
- **Active Data** (0-2 years): SSD storage, full indexing
- **Recent Historical** (2-5 years): Standard storage, selective indexing  
- **Historical Archive** (5+ years): Cold storage, minimal indexing
- **Compressed Archive** (10+ years): Highly compressed, rare access

#### Partitioning Strategy
```sql
-- Temporal partitions
CREATE TABLE place_attributes_active 
PARTITION OF place_attributes 
FOR VALUES FROM ('2022-01-01') TO ('2024-12-31');

-- Geographic partitions for global scaling
CREATE TABLE places_oceania
PARTITION OF places
FOR VALUES IN ('AU', 'NZ', 'FJ', 'TO', 'VU', 'SB', 'PW');
```

### Indexing Strategy

#### Spatial Indexes
- PostGIS R-tree indexes for geographic queries
- Spatial-temporal composite indexes
- Geographic clustering for regional queries

#### Temporal Indexes
- GiST indexes for temporal range operations
- B-tree indexes for point-in-time queries
- Composite indexes for common query patterns

#### Materialized Views
- Current state view (most recent valid attributes)
- Regional summaries with aggregated statistics
- Historical timeline views for trend analysis
- Query performance monitoring views

### Read Optimization

#### Query Patterns
- **Map Rendering**: Geographic bounding box with current state
- **Regional Analysis**: Aggregated statistics by administrative area
- **Temporal Analysis**: Change detection and trend analysis
- **Research Queries**: Complex analytical queries with full SQL access

#### Caching Strategy
- Redis cache for map tile data
- Application-level caching for common aggregations
- Database result caching for expensive analytical queries
- CDN caching for static geographic boundaries

## Extensibility Design

### Regional Extensibility

#### New Country Integration
1. **Boundary Data**: Import administrative boundaries
2. **Regional Types**: Configure region type classifications
3. **Data Sources**: Set up country-specific data source integrations
4. **Quality Rules**: Configure validation rules for local data patterns

#### Administrative Systems Support
- Flexible region type framework
- Hierarchical boundary relationships
- Country-specific validation rules
- Localized data quality assessment

### Data Source Extensibility

#### New Source Integration
1. **Source Registration**: Configure API endpoints and authentication
2. **Import Pipeline**: Define data transformation and mapping rules
3. **Quality Assessment**: Configure confidence scoring algorithms
4. **Review Workflows**: Set up manual review processes for source-specific issues

#### Future-Proofing
- Abstract data source interface
- Pluggable import pipeline architecture
- Configurable validation and quality rules
- Version-controlled schema migrations

### Analytical Extensibility

#### New Analysis Types
- Pluggable spatial analysis algorithms
- Custom temporal aggregation functions
- Configurable quality metrics and reporting
- Integration points for external analytical tools

#### Research Integration
- Direct SQL access for complex queries
- Export capabilities for statistical analysis tools
- API endpoints for real-time analytical applications
- Integration with academic research workflows

## Risk Mitigation

### Storage Scalability
- **Problem**: Historical versioning increases storage requirements exponentially
- **Solution**: Tiered storage with selective detail levels, automated archival processes

### Performance Degradation
- **Problem**: Temporal queries can be expensive on large datasets
- **Solution**: Partitioned tables, optimized indexing, materialized views, read replicas

### Data Quality Issues
- **Problem**: Multiple sources provide conflicting or erroneous information
- **Solution**: Confidence scoring, automated validation, manual review workflows

### Legal and Licensing
- **Problem**: Complex attribution requirements across multiple data sources
- **Solution**: Comprehensive provenance tracking, automated attribution generation

## Migration Strategy

### From Existing Implementations
1. **Data Mapping**: Map existing NZ religion and age_map data to new schema
2. **Historical Reconstruction**: Recreate temporal records from available snapshots
3. **Quality Assessment**: Evaluate and score existing data quality
4. **Validation**: Cross-validate with current external sources

### Deployment Phases
1. **Single Region**: New Zealand proof-of-concept
2. **Multi-Source**: Integrate Google Places and census data
3. **Historical**: Add OSM historical data import
4. **Global**: Extend to additional countries and regions

This architecture provides a robust foundation for academic research while maintaining flexibility for future requirements and global scaling.