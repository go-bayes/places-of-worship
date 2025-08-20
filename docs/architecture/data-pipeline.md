# Data Pipeline Architecture

## Overview

The data pipeline integrates multiple heterogeneous sources to create a comprehensive, temporally-aware database of places of worship. The system handles both current state imports and historical reconstruction while maintaining data quality and provenance tracking.

## Pipeline Architecture

### 1. Multi-Source Integration Strategy

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   OpenStreetMap │    │   Google Places  │    │  Manual/Census  │
│                 │    │      API         │    │      Data       │
│ • Current State │    │ • Current Info   │    │ • Curated Info  │
│ • Historical    │    │ • Rich Metadata  │    │ • Regional Data │
│ • Global Scale  │    │ • Verification   │    │ • Academic      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   Data Integration      │
                    │       Pipeline          │
                    │                         │
                    │ • Source Coordination   │
                    │ • Change Detection      │
                    │ • Quality Validation    │
                    │ • Conflict Resolution   │
                    └─────────────────────────┘
```

### 2. Processing Stages

1. **Extraction**: Pull data from external sources
2. **Transformation**: Normalize and enrich data
3. **Quality Assessment**: Validate and score confidence
4. **Change Detection**: Compare with existing data
5. **Conflict Resolution**: Handle discrepancies
6. **Loading**: Update database with versioned records

## OpenStreetMap Integration

### Current State Import

#### Overpass API Query
```javascript
// Extract places of worship for New Zealand
const overpassQuery = `
[out:json][timeout:300];
area["ISO3166-1"="NZ"]->.searchArea;
(
  nwr["amenity"="place_of_worship"](area.searchArea);
);
out geom;
`;
```

#### Data Processing Pipeline
```python
class OSMCurrentImporter:
    def __init__(self, region_config):
        self.region = region_config
        self.overpass_api = OverpassAPI()
        
    async def import_current_state(self):
        # Step 1: Extract data
        raw_data = await self.overpass_api.query(self.build_query())
        
        # Step 2: Transform to internal format
        places = [self.transform_osm_element(elem) for elem in raw_data]
        
        # Step 3: Quality validation
        validated_places = [self.validate_place(place) for place in places]
        
        # Step 4: Load to database
        await self.load_places(validated_places)
        
        return self.generate_import_report()
        
    def transform_osm_element(self, osm_element):
        return PlaceRecord(
            osm_id=osm_element['id'],
            geometry=Point(osm_element['lon'], osm_element['lat']),
            attributes={
                'denomination': osm_element.get('tags', {}).get('denomination'),
                'religion': osm_element.get('tags', {}).get('religion'),
                'name': osm_element.get('tags', {}).get('name'),
                'capacity': osm_element.get('tags', {}).get('capacity'),
                'wheelchair': osm_element.get('tags', {}).get('wheelchair'),
                'website': osm_element.get('tags', {}).get('website')
            },
            data_source='osm',
            source_timestamp=osm_element.get('timestamp'),
            confidence_score=self.calculate_osm_confidence(osm_element)
        )
```

### Historical Data Import

#### OSM History Processing
```python
class OSMHistoricalImporter:
    def __init__(self, region_bounds, date_range):
        self.bounds = region_bounds
        self.start_date = date_range[0]
        self.end_date = date_range[1]
        
    async def import_historical_timeline(self):
        # Strategy 1: Snapshot approach (annual captures)
        for year in range(2007, 2024):
            snapshot_date = f"{year}-01-01T00:00:00Z"
            await self.import_snapshot(snapshot_date)
            
        # Strategy 2: Change-based approach (detailed recent history)
        recent_cutoff = datetime.now() - timedelta(days=365*2)
        await self.import_detailed_changes(recent_cutoff)
        
    async def import_snapshot(self, snapshot_date):
        query = f"""
        [out:json][timeout:300][date:"{snapshot_date}"];
        ({self.bounds_query()});
        (
          nwr["amenity"="place_of_worship"](bbox);
        );
        out geom;
        """
        
        places = await self.overpass_api.query(query)
        
        # Create temporal records for this snapshot
        for place in places:
            await self.create_temporal_record(
                place=place,
                valid_from=snapshot_date,
                import_type='snapshot'
            )
    
    async def import_detailed_changes(self, since_date):
        # Use Overpass augmented diff queries for detailed change tracking
        query = f"""
        [out:json][timeout:900][diff:"{since_date.isoformat()}"];
        ({self.bounds_query()});
        (
          nwr["amenity"="place_of_worship"](bbox);
        );
        out geom;
        """
        
        changes = await self.overpass_api.query(query)
        await self.process_change_stream(changes)
```

### Quality Assessment for OSM Data
```python
def calculate_osm_confidence(self, osm_element):
    """Calculate confidence score for OSM data based on multiple factors"""
    score = 1.0
    tags = osm_element.get('tags', {})
    
    # Factor 1: Tag completeness
    expected_tags = ['name', 'denomination', 'religion']
    completeness = sum(1 for tag in expected_tags if tag in tags) / len(expected_tags)
    score *= (0.5 + 0.5 * completeness)
    
    # Factor 2: Edit history stability
    version = osm_element.get('version', 1)
    if version == 1:
        score *= 0.8  # New objects are less reliable
    elif version > 10:
        score *= 0.9  # Too many edits might indicate instability
    
    # Factor 3: Mapper reputation (if available)
    user = osm_element.get('user')
    if user in self.trusted_mappers:
        score *= 1.1
    
    # Factor 4: Data freshness
    timestamp = datetime.fromisoformat(osm_element.get('timestamp'))
    age_days = (datetime.now() - timestamp).days
    if age_days > 365:
        score *= max(0.7, 1 - (age_days - 365) / (365 * 5))
    
    return min(1.0, score)
```

## Google Places Integration

### API Integration
```python
class GooglePlacesImporter:
    def __init__(self, api_key, region_bounds):
        self.client = googlemaps.Client(key=api_key)
        self.bounds = region_bounds
        
    async def import_places_of_worship(self):
        # Search for places of worship in region
        places = []
        
        # Use multiple search terms to ensure comprehensive coverage
        search_terms = [
            'place of worship',
            'church',
            'mosque',
            'synagogue', 
            'temple',
            'cathedral',
            'chapel'
        ]
        
        for term in search_terms:
            results = await self.search_places(term)
            places.extend(results)
            
        # Deduplicate and enrich
        unique_places = self.deduplicate_places(places)
        enriched_places = await self.enrich_place_details(unique_places)
        
        return enriched_places
        
    def transform_google_place(self, google_place):
        return PlaceRecord(
            google_place_id=google_place['place_id'],
            geometry=Point(
                google_place['geometry']['location']['lng'],
                google_place['geometry']['location']['lat']
            ),
            attributes={
                'name': google_place.get('name'),
                'denomination': self.extract_denomination(google_place),
                'phone_number': google_place.get('formatted_phone_number'),
                'website': google_place.get('website'),
                'opening_hours': google_place.get('opening_hours'),
                'rating': google_place.get('rating'),
                'user_ratings_total': google_place.get('user_ratings_total')
            },
            data_source='google_places',
            confidence_score=self.calculate_google_confidence(google_place)
        )
```

### Data Enrichment
```python
def extract_denomination(self, google_place):
    """Extract denomination from Google Places data"""
    
    # Method 1: Direct type mapping
    place_types = google_place.get('types', [])
    type_mapping = {
        'catholic_church': 'Catholic',
        'baptist_church': 'Baptist',
        'methodist_church': 'Methodist',
        'orthodox_church': 'Orthodox',
        'mosque': 'Islam',
        'synagogue': 'Judaism',
        'hindu_temple': 'Hinduism',
        'buddhist_temple': 'Buddhism'
    }
    
    for place_type in place_types:
        if place_type in type_mapping:
            return type_mapping[place_type]
    
    # Method 2: Name pattern matching
    name = google_place.get('name', '').lower()
    name_patterns = {
        r'(catholic|st\.|saint)': 'Catholic',
        r'(baptist)': 'Baptist', 
        r'(methodist|wesley)': 'Methodist',
        r'(anglican|church of england)': 'Anglican',
        r'(presbyterian)': 'Presbyterian',
        r'(mosque|masjid|islamic)': 'Islam',
        r'(synagogue|temple|jewish)': 'Judaism'
    }
    
    for pattern, denomination in name_patterns.items():
        if re.search(pattern, name):
            return denomination
    
    return 'Unknown'
```

## Change Detection System

### Automated Change Detection
```python
class ChangeDetectionPipeline:
    def __init__(self, database):
        self.db = database
        self.detectors = [
            GeometryChangeDetector(),
            AttributeChangeDetector(), 
            StatusChangeDetector()
        ]
    
    async def detect_changes(self, new_data, source_name):
        detected_changes = []
        
        for new_record in new_data:
            # Find existing place by external ID
            existing_place = await self.find_existing_place(new_record)
            
            if not existing_place:
                # New place detected
                change = DetectedChange(
                    change_type='create',
                    place_id=None,
                    new_data=new_record,
                    source=source_name,
                    confidence=new_record.confidence_score
                )
                detected_changes.append(change)
                continue
            
            # Compare with existing data
            for detector in self.detectors:
                changes = detector.detect(existing_place, new_record)
                detected_changes.extend(changes)
                
        return detected_changes

class AttributeChangeDetector:
    def detect(self, existing_place, new_record):
        changes = []
        
        current_attrs = self.get_current_attributes(existing_place)
        new_attrs = new_record.attributes
        
        for attr_type, new_value in new_attrs.items():
            current_value = current_attrs.get(attr_type)
            
            if current_value != new_value:
                change = DetectedChange(
                    change_type='update',
                    place_id=existing_place.id,
                    attribute_type=attr_type,
                    old_value=current_value,
                    new_value=new_value,
                    source=new_record.data_source,
                    confidence=self.calculate_change_confidence(
                        current_value, new_value, new_record
                    )
                )
                changes.append(change)
                
        return changes
```

### Conflict Resolution
```python
class ConflictResolver:
    def __init__(self, resolution_rules):
        self.rules = resolution_rules
        
    def resolve_conflicts(self, detected_changes):
        """Resolve conflicts between multiple data sources"""
        
        # Group changes by place and attribute
        change_groups = self.group_changes(detected_changes)
        
        resolved_changes = []
        for group in change_groups:
            if len(group) == 1:
                # No conflict
                resolved_changes.extend(group)
            else:
                # Resolve conflict
                resolution = self.apply_resolution_rules(group)
                resolved_changes.append(resolution)
                
        return resolved_changes
    
    def apply_resolution_rules(self, conflicting_changes):
        """Apply resolution rules to conflicting changes"""
        
        # Rule 1: Source priority
        source_priority = {'manual': 3, 'google_places': 2, 'osm': 1}
        highest_priority = max(
            conflicting_changes, 
            key=lambda c: source_priority.get(c.source, 0)
        )
        
        # Rule 2: Confidence scoring
        highest_confidence = max(
            conflicting_changes,
            key=lambda c: c.confidence
        )
        
        # Rule 3: Temporal precedence (most recent)
        most_recent = max(
            conflicting_changes,
            key=lambda c: c.detected_at
        )
        
        # Combined resolution scoring
        scores = {}
        for change in conflicting_changes:
            score = 0
            if change == highest_priority:
                score += 3
            if change == highest_confidence:
                score += 2  
            if change == most_recent:
                score += 1
            scores[change] = score
            
        winner = max(scores.keys(), key=lambda c: scores[c])
        
        # Create resolved change record
        return ResolvedChange(
            base_change=winner,
            resolution_method='rule_based',
            alternatives=conflicting_changes,
            confidence=winner.confidence * 0.9  # Slight penalty for conflict
        )
```

## Manual Curation Pipeline

### Review Queue System
```python
class ManualReviewPipeline:
    def __init__(self, database):
        self.db = database
        self.review_queue = ReviewQueue()
        
    async def queue_for_review(self, detected_changes):
        """Queue changes requiring manual review"""
        
        for change in detected_changes:
            priority = self.calculate_review_priority(change)
            
            if self.requires_manual_review(change):
                await self.review_queue.add(
                    change=change,
                    priority=priority,
                    assigned_reviewer=self.assign_reviewer(change)
                )
            else:
                # Auto-apply high confidence changes
                await self.apply_change_automatically(change)
    
    def requires_manual_review(self, change):
        """Determine if change requires manual review"""
        
        # Low confidence changes
        if change.confidence < 0.7:
            return True
            
        # Conflicts between sources
        if hasattr(change, 'alternatives'):
            return True
            
        # Critical attribute changes
        if change.attribute_type in ['denomination', 'status', 'location']:
            return True
            
        # New places from uncertain sources
        if change.change_type == 'create' and change.source == 'osm':
            return True
            
        return False
        
    def calculate_review_priority(self, change):
        """Calculate priority for manual review queue"""
        
        priority = 50  # Base priority
        
        # Factors that increase priority
        if change.change_type == 'delete':
            priority += 30  # Deletions are high priority
        if change.attribute_type == 'denomination':
            priority += 20  # Denomination changes important
        if change.confidence < 0.5:
            priority += 15  # Very uncertain changes
            
        # Factors that decrease priority
        if change.change_type == 'create':
            priority -= 10  # New places less urgent
        if change.source == 'google_places':
            priority -= 5   # Generally more reliable
            
        return max(1, min(100, priority))
```

### Batch Processing System
```python
class BatchProcessor:
    """Handle large-scale data imports and updates"""
    
    def __init__(self, database, batch_size=1000):
        self.db = database
        self.batch_size = batch_size
        
    async def process_large_import(self, data_source, data_iterator):
        """Process large datasets in manageable batches"""
        
        batch = []
        total_processed = 0
        
        async for record in data_iterator:
            batch.append(record)
            
            if len(batch) >= self.batch_size:
                await self.process_batch(batch, data_source)
                total_processed += len(batch)
                batch = []
                
                # Log progress
                logger.info(f"Processed {total_processed} records from {data_source}")
                
        # Process remaining records
        if batch:
            await self.process_batch(batch, data_source)
            total_processed += len(batch)
            
        return total_processed
        
    async def process_batch(self, batch, data_source):
        """Process a single batch of records"""
        
        # Step 1: Transform data
        transformed = [self.transform_record(record, data_source) for record in batch]
        
        # Step 2: Quality validation
        validated = [self.validate_record(record) for record in transformed]
        
        # Step 3: Change detection
        changes = await self.detect_batch_changes(validated, data_source)
        
        # Step 4: Apply changes
        await self.apply_batch_changes(changes)
        
        # Step 5: Update statistics
        await self.update_import_statistics(data_source, len(batch))
```

## Data Quality Pipeline

### Validation Rules
```python
class DataValidator:
    def __init__(self):
        self.validation_rules = [
            GeometryValidator(),
            AttributeValidator(),
            ConsistencyValidator(),
            CompletenessValidator()
        ]
        
    def validate_record(self, record):
        """Run all validation rules on a record"""
        
        validation_result = ValidationResult(record=record)
        
        for rule in self.validation_rules:
            result = rule.validate(record)
            validation_result.add_result(result)
            
        return validation_result

class GeometryValidator:
    def validate(self, record):
        """Validate geographic data"""
        issues = []
        
        if not record.geometry:
            issues.append("Missing geometry")
            return ValidationResult(status='invalid', issues=issues)
        
        # Check coordinate validity
        lon, lat = record.geometry.coords[0]
        if not (-180 <= lon <= 180):
            issues.append(f"Invalid longitude: {lon}")
        if not (-90 <= lat <= 90):
            issues.append(f"Invalid latitude: {lat}")
            
        # Check if coordinates are in expected region
        if hasattr(record, 'expected_region'):
            if not record.expected_region.contains(record.geometry):
                issues.append("Geometry outside expected region")
                
        return ValidationResult(
            status='invalid' if issues else 'valid',
            issues=issues
        )
```

## Monitoring and Alerting

### Pipeline Health Monitoring
```python
class PipelineMonitor:
    def __init__(self, metrics_backend):
        self.metrics = metrics_backend
        
    async def monitor_import_job(self, job):
        """Monitor data import job progress and health"""
        
        # Track processing metrics
        start_time = time.time()
        
        try:
            result = await job.execute()
            
            # Success metrics
            duration = time.time() - start_time
            self.metrics.record('import_duration', duration, tags={
                'source': job.source_name,
                'status': 'success'
            })
            
            self.metrics.record('records_processed', result.records_processed)
            self.metrics.record('changes_detected', result.changes_detected)
            
        except Exception as e:
            # Error metrics
            self.metrics.record('import_errors', 1, tags={
                'source': job.source_name,
                'error_type': type(e).__name__
            })
            
            # Alert on critical errors
            if isinstance(e, (ConnectionError, AuthenticationError)):
                await self.send_alert(f"Import job failed: {str(e)}")
                
            raise
```

This data pipeline architecture provides robust, scalable data integration while maintaining academic research standards for quality and provenance tracking.