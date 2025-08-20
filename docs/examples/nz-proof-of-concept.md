# New Zealand Proof of Concept

## Overview

This document outlines the New Zealand proof-of-concept implementation that validates our architectural approach using existing data and provides a foundation for global expansion.

## Existing Data Integration

### Current NZ Implementations to Migrate

#### 1. Religion Repository (`/religion`)
**Current Features:**
- SA2-level religious census data visualization
- Change detection between 2006, 2013, 2018 census periods
- Leaflet-based interactive mapping
- Regional aggregation by SA2 boundaries

**Migration Strategy:**
```python
# Extract existing religion.json data
religion_data = load_json('/religion/religion.json')
sa2_boundaries = load_geojson('/religion/sa2.geojson')

# Transform to new schema
for sa2_code, temporal_data in religion_data.items():
    # Create region record
    region = create_geographic_region(
        region_type='nz_sa2',
        region_code=sa2_code,
        geometry=extract_geometry(sa2_boundaries, sa2_code),
        country_code='NZ'
    )
    
    # Create temporal census records
    for year, census_data in temporal_data.items():
        create_regional_attributes(
            region_id=region.id,
            attribute_type='census_religion',
            attribute_value=census_data,
            valid_from=f'{year}-01-01',
            data_source='nz_stats'
        )
```

#### 2. Age Map Repository (`/age_map`)
**Current Features:**
- DHB (District Health Board) boundary visualisation
- Hospital location mapping
- Demographic overlay capabilities
- Multi-layer interactive controls

**Integration Points:**
- DHB boundaries as additional regional framework
- Hospital data as potential validation for place locations
- Demographic data for regional correlation analysis

### New Data Sources for NZ PoC

#### OpenStreetMap New Zealand
```python
# OSM Overpass query for NZ places of worship
overpass_query = """
[out:json][timeout:300];
area["ISO3166-1"="NZ"]->.nz;
(
  nwr["amenity"="place_of_worship"](area.nz);
);
out geom;
"""

# Expected coverage: ~2,500-3,000 places of worship
# Data quality: Generally good in urban areas, sparse in rural regions
```

#### Google Places API Integration
```python
# Search parameters for comprehensive coverage
search_config = {
    'country': 'NZ',
    'search_terms': [
        'place of worship', 'church', 'mosque', 'synagogue', 
        'temple', 'cathedral', 'chapel', 'marae'
    ],
    'regions': nz_major_cities + nz_districts,
    'expected_total': 4000  # Estimated total places
}
```

## Implementation Timeline

### Phase 1: Database Setup (Week 1)
**Goals:**
- Deploy PostgreSQL with PostGIS locally
- Import NZ geographic boundaries (SA2, DHB, territorial authorities)
- Create initial place records from OSM current state

**Deliverables:**
```bash
# Database setup
docker-compose up -d postgres
psql -f database/schemas/core-schema.sql
psql -f database/schemas/temporal-tables.sql

# Initial data import
python scripts/import_nz_boundaries.py
python scripts/import_osm_current.py --country=NZ
```

### Phase 2: Data Integration (Week 2)
**Goals:**
- Import Google Places data for NZ
- Integrate existing census religious data
- Implement change detection pipeline

**Key Metrics:**
- Total places imported: ~4,000
- Source coverage: OSM (60%), Google Places (85%), Census regions (100%)
- Data quality score: >0.8 average confidence

### Phase 3: Temporal Analysis (Week 3)
**Goals:**
- Import OSM historical data (2010-2024)
- Create temporal analysis functions
- Validate historical reconstruction accuracy

**Historical Data Strategy:**
```python
# Annual snapshots for comprehensive coverage
historical_imports = [
    '2010-01-01', '2012-01-01', '2014-01-01', 
    '2016-01-01', '2018-01-01', '2020-01-01', 
    '2022-01-01', '2024-01-01'
]

# Detailed change tracking for recent period
detailed_period = ('2020-01-01', '2024-01-01')
```

### Phase 4: API and Frontend (Week 4)
**Goals:**
- Deploy REST API with NZ data
- Migrate existing Leaflet implementations
- Create historical timeline controls

## Validation Studies

### 1. Cross-Source Validation
**Objective:** Validate data integration accuracy

**Method:**
```python
def validate_cross_source_accuracy():
    """Compare OSM and Google Places data for same locations"""
    
    # Find places within 100m with similar names
    matches = find_potential_matches(
        osm_places, google_places, 
        max_distance=100, name_similarity=0.8
    )
    
    # Analyze agreement rates
    agreement_metrics = calculate_agreement(matches, attributes=[
        'denomination', 'name', 'status', 'location'
    ])
    
    return ValidationReport(
        total_matches=len(matches),
        agreement_rate=agreement_metrics,
        confidence_distribution=calculate_confidence_distribution(matches)
    )
```

**Expected Results:**
- Location agreement: >95% (high GPS accuracy)
- Name agreement: >80% (variations in formal/common names)
- Denomination agreement: >70% (classification differences)

### 2. Temporal Reconstruction Accuracy
**Objective:** Validate historical data reconstruction

**Method:**
```python
def validate_temporal_reconstruction():
    """Compare reconstructed timeline with known events"""
    
    # Known events: church closures, new constructions, denomination changes
    known_events = load_validation_events('nz_church_events_2010_2024.csv')
    
    # Compare with our temporal records
    matches = []
    for event in known_events:
        our_record = find_temporal_record(
            place_name=event.place_name,
            change_type=event.change_type,
            date_range=(event.date - timedelta(days=30), 
                       event.date + timedelta(days=30))
        )
        matches.append((event, our_record))
    
    # Calculate accuracy metrics
    return TemporalValidation(
        event_detection_rate=calculate_detection_rate(matches),
        false_positive_rate=calculate_false_positives(matches),
        temporal_precision=calculate_temporal_accuracy(matches)
    )
```

### 3. Regional Correlation Analysis
**Objective:** Demonstrate research capabilities

**Research Question:** How do regional demographic changes correlate with changes in places of worship?

**Analysis:**
```sql
-- Correlation between regional population changes and place changes
WITH regional_changes AS (
    SELECT 
        gr.region_code,
        gr.region_name,
        
        -- Population change (from census data)
        (census_2018.total_population - census_2013.total_population) 
        / census_2013.total_population::float AS population_change_rate,
        
        -- Religious affiliation change  
        (census_2018.no_religion - census_2013.no_religion) 
        / census_2013.total_stated::float AS secularisation_rate,
        
        -- Places of worship changes
        COUNT(CASE WHEN pa.valid_from BETWEEN '2013-01-01' AND '2018-12-31' 
                   AND pa.change_type = 'create' THEN 1 END) AS new_places,
        COUNT(CASE WHEN pa.valid_to BETWEEN '2013-01-01' AND '2018-12-31' 
                   THEN 1 END) AS closed_places
        
    FROM geographic_regions gr
    JOIN place_region_associations pra ON gr.region_id = pra.region_id
    JOIN place_attributes pa ON pra.place_id = pa.place_id
    WHERE gr.region_type = 'nz_sa2'
    GROUP BY gr.region_code, gr.region_name
)
SELECT 
    corr(population_change_rate, new_places - closed_places) AS demographic_correlation,
    corr(secularisation_rate, new_places - closed_places) AS secularisation_correlation
FROM regional_changes;
```

## Performance Benchmarks

### Query Performance Targets
- **Current state query** (bbox): <200ms for 1000 places
- **Historical timeline**: <500ms for single place, 10-year span  
- **Regional aggregation**: <1s for national summary
- **Temporal analysis**: <5s for complex correlation queries

### Storage Estimates
- **Current places**: ~4,000 records = 2MB
- **Historical versions** (15 years): ~50,000 versions = 25MB
- **Regional data**: SA2 (2,253 regions) + DHB (20 regions) = 50MB
- **Total database**: ~100MB for complete NZ dataset

### Scaling Projections
- **Global scale**: ~10M places × 25 = 250GB for comprehensive global coverage
- **Storage tiers**: Active (SSD): 50GB, Historical (HDD): 200GB  
- **Query performance**: Expect 10x slower for global scale, still sub-second for most queries

## Success Criteria

### Technical Success
- [ ] All NZ places of worship imported with >90% coverage
- [ ] Cross-source validation showing >80% agreement  
- [ ] Temporal reconstruction detecting >70% of known events
- [ ] API performance meeting benchmark targets
- [ ] Successful integration of existing NZ implementations

### Research Success
- [ ] Demonstrated correlation analysis capabilities
- [ ] Reproducible research methodology documented
- [ ] Historical trend analysis producing meaningful insights
- [ ] Regional comparison framework validated

### Operational Success  
- [ ] Automated import pipelines functioning reliably
- [ ] Data quality monitoring detecting issues
- [ ] Legal compliance framework implemented
- [ ] Documentation sufficient for research collaboration

## Next Steps

### Immediate (Post-PoC)
1. **Publication**: Academic paper on methodology and NZ findings
2. **Community Engagement**: Present to NZ religious studies researchers
3. **Data Sharing**: Make NZ dataset available under ODbL

### Medium-term
1. **Australia Extension**: Similar dataset for cultural comparison
2. **Historical Depth**: Extend temporal coverage back to 1900s using archival sources
3. **Denominational Detail**: Enhanced classification system for diverse traditions

### Long-term
1. **Global Deployment**: Systematic expansion to additional countries
2. **Real-time Updates**: Live integration with OSM changesets
3. **Research Platform**: Full-featured research collaboration platform

This proof-of-concept approach validates our architecture with real data while providing immediate research value and establishing the foundation for global expansion.