# Global Data Pipeline Architecture

## Overview

Scalable data pipeline design that extends from the proven NZ implementation to global coverage, maintaining sub-second query performance while integrating multiple data sources with confidence scoring and temporal versioning.

## Architecture Principles

### 1. Performance-First Design
- **Pre-processed spatial indices** for instant bbox queries
- **Country-partitioned storage** for efficient regional access  
- **Incremental updates** to avoid full rebuilds
- **Parallel processing** for global-scale data extraction

### 2. Multi-Source Integration
- **OSM as primary source** with proven extraction methods
- **Government databases** as authoritative validation
- **Confidence scoring** across all sources
- **Automated conflict resolution** with manual review workflows

### 3. Temporal Data Management
- **Historical OSM data** via Overpass API with date filters
- **Change detection** between data source updates
- **Audit trails** for all modifications
- **Point-in-time queries** for research analysis

## Data Pipeline Components

### Stage 1: Raw Data Extraction

#### OSM Global Extraction
```python
# Scalable OSM extraction by region
class OSMExtractor:
    def extract_by_country(self, country_code: str):
        """Extract places of worship for entire country"""
        overpass_query = f"""
        [out:json][timeout:600];
        area["ISO3166-1"="{country_code}"]->.country;
        (
          nwr["amenity"="place_of_worship"](area.country);
          nwr["building"="church"](area.country);
          nwr["building"="mosque"](area.country);
          nwr["building"="temple"](area.country);
          nwr["building"="synagogue"](area.country);
        );
        out geom;
        """
        return self.execute_overpass_query(overpass_query)
    
    def extract_by_bbox_chunks(self, bounds: BoundingBox, chunk_size: float = 1.0):
        """Extract large regions in chunks to avoid timeouts"""
        chunks = self.divide_bbox_into_chunks(bounds, chunk_size)
        results = []
        
        for chunk in chunks:
            chunk_data = self.extract_by_bbox(chunk)
            results.extend(chunk_data)
            time.sleep(1)  # Rate limiting
            
        return self.deduplicate_results(results)
```

#### Historical Data Pipeline
```python
class OSMHistoricalExtractor:
    def extract_historical_snapshots(self, country_code: str, years: List[int]):
        """Extract historical snapshots for temporal analysis"""
        snapshots = {}
        
        for year in years:
            date_filter = f"{year}-12-31T23:59:59Z"
            overpass_query = f"""
            [out:json][timeout:900][date:"{date_filter}"];
            area["ISO3166-1"="{country_code}"]->.country;
            (
              nwr["amenity"="place_of_worship"](area.country);
            );
            out geom;
            """
            snapshots[year] = self.execute_overpass_query(overpass_query)
            
        return snapshots
    
    def detect_temporal_changes(self, snapshots: Dict[int, List]):
        """Identify places that appeared, disappeared, or changed"""
        changes = []
        
        for year_pair in zip(sorted(snapshots.keys())[:-1], sorted(snapshots.keys())[1:]):
            old_year, new_year = year_pair
            old_places = {p['id']: p for p in snapshots[old_year]}
            new_places = {p['id']: p for p in snapshots[new_year]}
            
            # Detect new places
            new_ids = set(new_places.keys()) - set(old_places.keys())
            for place_id in new_ids:
                changes.append({
                    'place_id': place_id,
                    'change_type': 'created',
                    'year': new_year,
                    'data': new_places[place_id]
                })
            
            # Detect modified places
            for place_id in set(old_places.keys()) & set(new_places.keys()):
                if self.places_differ(old_places[place_id], new_places[place_id]):
                    changes.append({
                        'place_id': place_id,
                        'change_type': 'modified',
                        'year': new_year,
                        'old_data': old_places[place_id],
                        'new_data': new_places[place_id]
                    })
                    
        return changes
```

### Stage 2: Data Processing & Validation

#### Multi-Source Validation
```python
class DataValidator:
    def __init__(self):
        self.validators = {
            'osm': OSMValidator(),
            'google_places': GooglePlacesValidator(),
            'government': GovernmentDBValidator()
        }
    
    def validate_place(self, place_data: Dict, source: str) -> ValidationResult:
        """Validate place data with source-specific rules"""
        validator = self.validators[source]
        
        # Basic validation
        issues = []
        if not self.is_valid_coordinates(place_data['coordinates']):
            issues.append('invalid_coordinates')
            
        if not self.is_valid_name(place_data['name']):
            issues.append('suspicious_name')
            
        # Source-specific validation
        source_issues = validator.validate(place_data)
        issues.extend(source_issues)
        
        # Calculate confidence score
        confidence = self.calculate_confidence(place_data, issues)
        
        return ValidationResult(
            valid=len(issues) == 0,
            issues=issues,
            confidence=confidence,
            requires_review=confidence < 0.7
        )
    
    def calculate_confidence(self, place_data: Dict, issues: List[str]) -> float:
        """Calculate confidence score based on data completeness and quality"""
        base_score = 1.0
        
        # Deduct for missing fields
        if not place_data.get('name'): base_score -= 0.2
        if not place_data.get('denomination'): base_score -= 0.1
        if not place_data.get('address'): base_score -= 0.1
        
        # Deduct for validation issues  
        base_score -= len(issues) * 0.15
        
        # Bonus for multiple source confirmation
        if place_data.get('confirmed_sources', 0) > 1:
            base_score += 0.1
            
        return max(0.0, min(1.0, base_score))
```

#### Conflict Resolution
```python
class ConflictResolver:
    def resolve_duplicate_places(self, places: List[Dict]) -> Dict:
        """Resolve conflicts when multiple sources have the same place"""
        
        # Group by proximity (within 50m assumed to be same place)
        clusters = self.cluster_by_proximity(places, radius_meters=50)
        
        resolved_places = []
        for cluster in clusters:
            if len(cluster) == 1:
                resolved_places.append(cluster[0])
            else:
                # Merge multiple sources for same place
                merged_place = self.merge_place_data(cluster)
                resolved_places.append(merged_place)
                
        return resolved_places
    
    def merge_place_data(self, similar_places: List[Dict]) -> Dict:
        """Merge data from multiple sources with source prioritisation"""
        
        # Source priority: government > osm > google_places > manual
        source_priority = {'government': 4, 'osm': 3, 'google_places': 2, 'manual': 1}
        
        merged = {
            'place_id': str(uuid.uuid4()),
            'sources': [],
            'confidence': 0.0
        }
        
        # Take highest quality name
        best_name = max(similar_places, 
                       key=lambda p: (source_priority.get(p['source'], 0), 
                                    len(p.get('name', ''))))
        merged['name'] = best_name['name']
        
        # Average coordinates weighted by confidence
        total_weight = sum(p['confidence'] for p in similar_places)
        weighted_lat = sum(p['lat'] * p['confidence'] for p in similar_places) / total_weight
        weighted_lng = sum(p['lng'] * p['confidence'] for p in similar_places) / total_weight
        
        merged['coordinates'] = [weighted_lng, weighted_lat]
        
        # Collect all sources
        for place in similar_places:
            merged['sources'].append({
                'source': place['source'],
                'source_id': place['source_id'],
                'confidence': place['confidence']
            })
            
        # Calculate combined confidence
        merged['confidence'] = min(1.0, sum(p['confidence'] for p in similar_places) / len(similar_places) + 0.1)
        
        return merged
```

### Stage 3: Optimised Storage Generation

#### Country-Partitioned Parquet Generation
```python
class ParquetGenerator:
    def generate_country_parquets(self, validated_places: List[Dict]):
        """Generate optimised parquet files for fast API queries"""
        
        # Group by country for efficient regional queries
        by_country = defaultdict(list)
        for place in validated_places:
            country = place.get('country_code', 'unknown')
            by_country[country].append(place)
        
        # Generate spatial indexes and parquet files
        for country_code, places in by_country.items():
            gdf = gpd.GeoDataFrame(places)
            
            # Add spatial indexes
            gdf['bbox_z12'] = gdf.geometry.apply(lambda g: self.get_tile_key(g, zoom=12))
            gdf['bbox_z8'] = gdf.geometry.apply(lambda g: self.get_tile_key(g, zoom=8))
            
            # Sort by spatial index for query performance
            gdf = gdf.sort_values(['bbox_z8', 'bbox_z12'])
            
            # Write to parquet with spatial partitioning
            output_path = f"data/parquet/places_{country_code.lower()}.parquet"
            gdf.to_parquet(output_path, index=False)
            
        # Generate global summary file
        global_summary = self.create_global_summary(by_country)
        global_summary.to_parquet("data/parquet/global_summary.parquet")
    
    def get_tile_key(self, geometry: Point, zoom: int) -> str:
        """Generate tile key for spatial indexing"""
        lat, lng = geometry.y, geometry.x
        x_tile = int((lng + 180) / 360 * (2 ** zoom))
        y_tile = int((1 - math.log(math.tan(math.radians(lat)) + 
                                  1 / math.cos(math.radians(lat))) / math.pi) / 2 * (2 ** zoom))
        return f"{zoom}_{x_tile}_{y_tile}"
```

### Stage 4: Update & Monitoring Pipeline

#### Incremental Updates
```python
class IncrementalUpdater:
    def __init__(self):
        self.last_update_times = self.load_update_timestamps()
    
    def check_for_updates(self, country_code: str) -> bool:
        """Check if country data needs updating"""
        last_update = self.last_update_times.get(country_code)
        if not last_update:
            return True  # Never updated
            
        # Check for OSM changes since last update
        osm_changes = self.check_osm_changes_since(country_code, last_update)
        
        # Update if significant changes detected
        change_threshold = 50  # Number of places changed
        return len(osm_changes) > change_threshold
    
    def incremental_update(self, country_code: str):
        """Update only changed data rather than full rebuild"""
        last_update = self.last_update_times.get(country_code)
        
        # Get recent changes from OSM
        recent_changes = self.get_osm_changes_since(country_code, last_update)
        
        # Load existing data
        existing_data = self.load_country_parquet(country_code)
        
        # Apply changes
        updated_data = self.apply_changes(existing_data, recent_changes)
        
        # Regenerate parquet with updates
        self.generate_country_parquet(country_code, updated_data)
        
        # Update timestamp
        self.last_update_times[country_code] = datetime.now()
        self.save_update_timestamps()
```

## Global Pipeline Orchestration

### Daily Update Workflow
```python
class GlobalPipelineOrchestrator:
    def daily_update_workflow(self):
        """Orchestrate daily updates across all countries"""
        
        # Priority countries (high-change areas)
        priority_countries = ['US', 'DE', 'GB', 'FR', 'AU', 'NZ', 'CA']
        
        # Check all countries for updates needed
        countries_needing_update = []
        for country in priority_countries:
            if self.updater.check_for_updates(country):
                countries_needing_update.append(country)
        
        # Process updates in parallel
        with ThreadPoolExecutor(max_workers=4) as executor:
            futures = []
            for country in countries_needing_update:
                future = executor.submit(self.process_country_update, country)
                futures.append(future)
            
            # Wait for completion and handle errors
            for future in as_completed(futures):
                try:
                    result = future.result()
                    self.log_success(result)
                except Exception as e:
                    self.log_error(f"Update failed: {e}")
                    self.alert_administrators(e)
    
    def process_country_update(self, country_code: str):
        """Complete update pipeline for single country"""
        
        # Extract latest data
        raw_data = self.extractor.extract_by_country(country_code)
        
        # Validate and clean
        validated_data = []
        for place in raw_data:
            validation = self.validator.validate_place(place, 'osm')
            if validation.valid or validation.confidence > 0.5:
                validated_data.append(place)
        
        # Resolve conflicts with existing data
        resolved_data = self.resolver.resolve_with_existing(validated_data, country_code)
        
        # Generate optimised storage
        self.parquet_generator.update_country_parquet(country_code, resolved_data)
        
        return {
            'country': country_code,
            'places_processed': len(raw_data),
            'places_accepted': len(validated_data),
            'update_time': datetime.now()
        }
```

## Performance Monitoring

### Pipeline Metrics
```python
class PipelineMonitor:
    def track_performance_metrics(self):
        """Monitor pipeline performance and data quality"""
        
        metrics = {
            'extraction_time_by_country': {},
            'validation_pass_rate': 0.0,
            'conflict_resolution_rate': 0.0,
            'api_query_performance': {},
            'data_freshness': {}
        }
        
        # Track extraction performance
        for country in self.active_countries:
            start_time = time.time()
            place_count = self.count_places_in_country(country)
            extraction_time = time.time() - start_time
            
            metrics['extraction_time_by_country'][country] = {
                'places': place_count,
                'time_seconds': extraction_time,
                'places_per_second': place_count / extraction_time
            }
        
        # Test API performance
        test_queries = [
            {'bounds': '-41.5,-174.5,-41.0,-174.0', 'expected_response_time': 0.5},
            {'bounds': '40.0,-75.0,41.0,-74.0', 'expected_response_time': 0.8}  # NYC area
        ]
        
        for query in test_queries:
            response_time = self.test_api_query(query['bounds'])
            metrics['api_query_performance'][query['bounds']] = {
                'response_time': response_time,
                'meets_target': response_time < query['expected_response_time']
            }
        
        return metrics
```

## Deployment Strategy

The pipeline is designed for:

1. **Local Development**: Single-machine processing for testing
2. **Cloud Deployment**: Kubernetes/Docker for production scale
3. **Academic Infrastructure**: University computing resources
4. **Hybrid Approach**: Local processing with cloud storage

### Resource Requirements

- **Storage**: 100GB for global coverage (compressed parquet)
- **Processing**: 16GB RAM, 8 cores for efficient country-level updates
- **Database**: PostgreSQL 15+ with PostGIS for temporal/audit data
- **API**: FastAPI with Redis caching for sub-second responses

This architecture maintains the proven performance characteristics of your religion repository while scaling to global coverage and providing the foundation for regional data integration.