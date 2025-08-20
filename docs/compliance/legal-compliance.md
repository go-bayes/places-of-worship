# Legal Compliance and Attribution Guide

## Overview

This document outlines the legal requirements, licensing obligations, and attribution standards for the Places of Worship database system. Compliance with data licensing and academic research ethics is essential for sustainable operation and publication of research findings.

## Data Source Licensing

### OpenStreetMap (ODbL - Open Database License)

#### License Summary
- **Full Name**: Open Database License v1.0
- **Key Requirements**: Attribution, Share-Alike for databases
- **Academic Use**: Permitted with proper attribution
- **Commercial Use**: Permitted with proper attribution

#### Specific Requirements

**Attribution Text**:
```
© OpenStreetMap contributors, licensed under the Open Database License (ODbL)
```

**Database Licensing Obligations**:
- If you create a "Derivative Database" (substantially based on OSM), it must be licensed under ODbL
- "Produced Works" (research papers, maps, analysis) do not trigger Share-Alike requirements
- Academic publications and research outputs are considered "Produced Works"

**Technical Implementation**:
```sql
-- Track OSM data provenance
INSERT INTO data_provenance (
    record_id,
    original_source,
    osm_changeset,
    license_type,
    attribution_required,
    share_alike_obligation
) VALUES (
    record_uuid,
    'openstreetmap',
    changeset_id,
    'ODbL-1.0',
    TRUE,
    database_derived -- TRUE if substantial portion of our DB is OSM-derived
);
```

#### Compliance Strategy for Academic Use
1. **Clear Attribution**: Include OSM attribution in all outputs
2. **Methodology Documentation**: Document OSM usage in research papers
3. **Database Classification**: Our enhanced database qualifies as "Derivative Database"
4. **Share-Alike Compliance**: Make database available under ODbL if requested

### Google Places API

#### License Summary
- **Type**: Proprietary commercial license
- **Key Requirements**: Attribution, usage restrictions, no redistribution
- **Academic Use**: Permitted with proper licensing agreement

#### Specific Requirements

**Attribution Text**:
```
© Google
```

**Usage Restrictions**:
- Cannot redistribute raw Google Places data
- Can use for research analysis and publication
- Must include Google attribution in outputs
- Subject to API terms of service and usage limits

**Technical Implementation**:
```python
class GooglePlacesCompliance:
    def validate_usage(self, request_type, data_usage):
        """Ensure Google Places usage complies with TOS"""
        
        # Check usage type
        if request_type == 'redistribution':
            raise ComplianceError("Cannot redistribute Google Places data")
            
        # Validate academic research use
        if data_usage in ['academic_research', 'publication']:
            return True
            
        return self.check_commercial_license(request_type)
    
    def generate_attribution(self, data_sources):
        """Generate proper attribution for mixed-source data"""
        attributions = []
        
        if 'google_places' in data_sources:
            attributions.append("© Google")
        if 'osm' in data_sources:
            attributions.append("© OpenStreetMap contributors")
            
        return " | ".join(attributions)
```

### Census and Government Data

#### New Zealand Statistics
- **License**: Creative Commons Attribution 4.0 International (CC BY 4.0)
- **Attribution**: "Statistics New Zealand"
- **Usage**: Very permissive, allows all uses with attribution

#### Other Government Sources
- Most government statistical data uses open licenses (CC BY, OGL)
- Always check specific licensing for each dataset
- Maintain attribution records for all sources

## Academic Research Ethics

### Institutional Review Board (IRB) Requirements

#### When IRB Approval is Required
- **Human Subjects Research**: If analyzing religious communities as human subjects
- **Sensitive Data**: Information that could identify religious practices of individuals
- **Community Impact**: Research that might affect religious communities

#### When IRB Approval is NOT Required
- **Public Data Analysis**: Using publicly available data (OSM, census)
- **Geographic Analysis**: Studying spatial patterns without human subjects
- **Historical Trends**: Analyzing temporal changes in place data

#### Recommended Approach
```python
class EthicsCompliance:
    def assess_research_ethics(self, research_plan):
        """Assess whether research requires ethics approval"""
        
        risk_factors = []
        
        # Check for sensitive religious data
        if 'individual_practices' in research_plan.data_types:
            risk_factors.append("individual_religious_data")
        
        # Check for community identification
        if research_plan.granularity == 'individual_places':
            if research_plan.includes_sensitive_analysis:
                risk_factors.append("community_identification")
        
        # Generate recommendation
        if risk_factors:
            return EthicsRecommendation(
                approval_required=True,
                risk_factors=risk_factors,
                suggested_modifications=self.suggest_anonymization(risk_factors)
            )
        
        return EthicsRecommendation(approval_required=False)
```

### Data Anonymization Guidelines

#### Geographic Anonymization
```python
def apply_geographic_anonymization(places_data, sensitivity_level):
    """Apply appropriate geographic anonymization"""
    
    if sensitivity_level == 'high':
        # Aggregate to larger regions only
        return aggregate_to_regions(places_data, min_region_size=10000)
    
    elif sensitivity_level == 'medium':
        # Remove precise coordinates, keep general area
        return fuzzy_coordinates(places_data, radius_km=1)
    
    else:
        # Standard precision acceptable
        return places_data
```

#### Temporal Anonymization
```python
def apply_temporal_anonymization(temporal_data, sensitivity_level):
    """Anonymize temporal data appropriately"""
    
    if sensitivity_level == 'high':
        # Aggregate to yearly data only
        return aggregate_temporal(temporal_data, granularity='yearly')
    
    else:
        # Monthly granularity acceptable
        return aggregate_temporal(temporal_data, granularity='monthly')
```

## Publication and Sharing Requirements

### Academic Papers

#### Required Attribution Section
```markdown
## Data Sources and Attribution

This research uses data from multiple sources:

- **OpenStreetMap**: © OpenStreetMap contributors, licensed under the Open Database License (ODbL). Available at https://www.openstreetmap.org/copyright
- **Google Places**: © Google. Data used under academic research licensing.
- **New Zealand Statistics**: © Statistics New Zealand, licensed under CC BY 4.0
- **Manual Curation**: Research team manual data collection and validation

The Places of Worship database used in this research is available under the Open Database License at [repository URL].
```

#### Methodology Section Requirements
- Document all data sources and their usage
- Explain data integration and quality control procedures
- Describe any geographic or temporal anonymization applied
- Provide reproducibility information

### Data Sharing and Repository Publication

#### Database Licensing Decision
**Recommended License**: Open Database License (ODbL)
- **Rationale**: Maintains compatibility with OSM data
- **Requirements**: Recipients must share derivative databases under same license
- **Academic Benefit**: Encourages open research collaboration

#### Data Package Structure
```
places-of-worship-dataset-v1.0/
├── LICENSE.txt                 # ODbL license text
├── README.md                   # Dataset description and usage
├── ATTRIBUTION.md              # Complete attribution requirements
├── data/
│   ├── places-current.geojson  # Current state data
│   ├── places-temporal.csv     # Historical change data
│   └── regional-summaries.csv  # Aggregated regional statistics
├── metadata/
│   ├── schema-description.md   # Data schema documentation
│   ├── quality-assessment.csv  # Data quality metrics
│   └── source-provenance.csv   # Source attribution per record
└── code/
    ├── validation-scripts/     # Data validation code
    └── analysis-examples/      # Reproducible analysis examples
```

## Technical Implementation

### Automated Compliance Tracking

#### Database Schema for Compliance
```sql
-- Legal compliance tracking
CREATE TABLE legal_compliance (
    record_id UUID,
    data_source TEXT,
    license_type TEXT,
    attribution_text TEXT,
    share_alike_required BOOLEAN,
    redistribution_allowed BOOLEAN,
    commercial_use_allowed BOOLEAN,
    expiration_date TIMESTAMPTZ,
    compliance_notes TEXT,
    last_reviewed TIMESTAMPTZ
);

-- Attribution generation
CREATE VIEW required_attributions AS
SELECT DISTINCT
    license_type,
    attribution_text,
    COUNT(*) as record_count
FROM legal_compliance lc
JOIN place_attributes pa ON lc.record_id = pa.attribute_id
WHERE pa.valid_to IS NULL  -- Current data only
GROUP BY license_type, attribution_text;
```

#### Automated Attribution Generation
```python
class AttributionGenerator:
    def __init__(self, database):
        self.db = database
        
    async def generate_attribution(self, data_request):
        """Generate proper attribution for data request"""
        
        # Identify data sources used
        sources = await self.identify_sources(data_request)
        
        # Generate attribution text
        attributions = []
        license_requirements = []
        
        for source in sources:
            source_info = await self.get_source_compliance(source)
            
            attributions.append(source_info.attribution_text)
            
            if source_info.share_alike_required:
                license_requirements.append(source_info.license_type)
        
        return AttributionPackage(
            attribution_text=" | ".join(attributions),
            required_licenses=license_requirements,
            redistribution_allowed=all(s.redistribution_allowed for s in sources),
            commercial_use_allowed=all(s.commercial_use_allowed for s in sources)
        )
    
    async def validate_usage(self, usage_request):
        """Validate proposed data usage against licensing"""
        
        attribution_pkg = await self.generate_attribution(usage_request.data_scope)
        
        violations = []
        
        # Check redistribution
        if usage_request.involves_redistribution:
            if not attribution_pkg.redistribution_allowed:
                violations.append("Redistribution not permitted")
        
        # Check commercial use
        if usage_request.commercial_use:
            if not attribution_pkg.commercial_use_allowed:
                violations.append("Commercial use not permitted")
        
        # Check share-alike compliance
        if attribution_pkg.required_licenses:
            if usage_request.output_license not in attribution_pkg.required_licenses:
                violations.append(f"Output must be licensed under: {attribution_pkg.required_licenses}")
        
        return UsageValidation(
            permitted=len(violations) == 0,
            violations=violations,
            required_attribution=attribution_pkg.attribution_text
        )
```

### API Compliance Headers
```python
@app.route('/api/v1/places')
async def get_places():
    """API endpoint with automated compliance headers"""
    
    # Process request
    places_data = await query_places(request.args)
    
    # Generate attribution
    attribution = await attribution_generator.generate_attribution(places_data)
    
    # Add compliance headers
    response_headers = {
        'X-Attribution': attribution.attribution_text,
        'X-License': 'ODbL-1.0',
        'X-Share-Alike': 'required' if attribution.share_alike_required else 'not-required',
        'X-Redistribution': 'allowed' if attribution.redistribution_allowed else 'restricted'
    }
    
    return jsonify(places_data), 200, response_headers
```

## Compliance Monitoring

### Regular Compliance Reviews
```python
class ComplianceMonitor:
    def __init__(self, database):
        self.db = database
        
    async def run_compliance_audit(self):
        """Run regular compliance audit"""
        
        issues = []
        
        # Check for missing attributions
        missing_attributions = await self.find_missing_attributions()
        if missing_attributions:
            issues.append(ComplianceIssue(
                type='missing_attribution',
                severity='high',
                records_affected=len(missing_attributions)
            ))
        
        # Check for expired licenses
        expired_licenses = await self.find_expired_licenses()
        if expired_licenses:
            issues.append(ComplianceIssue(
                type='expired_license',
                severity='critical',
                records_affected=len(expired_licenses)
            ))
        
        # Check for licensing conflicts
        conflicts = await self.detect_license_conflicts()
        if conflicts:
            issues.append(ComplianceIssue(
                type='license_conflict',
                severity='high',
                conflicts=conflicts
            ))
        
        return ComplianceAuditReport(
            audit_date=datetime.now(),
            issues_found=issues,
            overall_status='compliant' if not issues else 'non_compliant'
        )
```

## Emergency Compliance Procedures

### Data Removal Process
```python
class EmergencyCompliance:
    async def emergency_data_removal(self, removal_request):
        """Handle emergency data removal requests"""
        
        # Log the request
        await self.log_removal_request(removal_request)
        
        # Validate authority to request removal
        if not await self.validate_removal_authority(removal_request):
            raise UnauthorizedRemovalRequest()
        
        # Execute removal
        affected_records = await self.remove_data(removal_request.criteria)
        
        # Update compliance tracking
        await self.update_compliance_records(
            removal_type=removal_request.reason,
            records_affected=affected_records
        )
        
        # Notify stakeholders
        await self.notify_removal_completion(removal_request, affected_records)
        
        return RemovalReport(
            request_id=removal_request.id,
            records_removed=len(affected_records),
            compliance_status='compliant'
        )
```

This comprehensive compliance framework ensures academic research standards while respecting all data source licensing requirements and maintaining legal compliance for sustainable operation.