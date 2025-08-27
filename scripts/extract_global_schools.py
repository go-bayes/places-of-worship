#!/usr/bin/env python3
"""
Global Schools Database Extraction
Extract schools from OpenStreetMap globally using Overpass API
Target: ~5M schools worldwide for educational infrastructure mapping
"""

import json
import requests
import time
import os
from typing import Dict, List, Optional

class GlobalSchoolsExtractor:
    def __init__(self):
        self.base_url = "http://overpass-api.de/api/interpreter"
        self.output_dir = "data/global/schools"
        self.timeout = 600  # 10 minutes for large countries
        
        # Ensure output directory exists
        os.makedirs(self.output_dir, exist_ok=True)
        
        # Regional education defaults for missing amenity tags
        self.regional_defaults = {
            # European countries - diverse education systems
            'DE': 'Public School', 'FR': 'Public School', 'ES': 'Public School',
            'IT': 'Public School', 'GB': 'State School', 'NL': 'Primary School',
            'PL': 'Public School', 'SE': 'Municipal School', 'NO': 'Public School',
            
            # North American countries - standardised systems
            'US': 'Public School', 'CA': 'Public School', 'MX': 'Primary School',
            
            # Asian countries - mixed systems
            'CN': 'Primary School', 'IN': 'Government School', 'JP': 'Public School',
            'KR': 'Public School', 'ID': 'State School', 'TH': 'Government School',
            'VN': 'Public School', 'PH': 'Public School', 'MY': 'National School',
            
            # African countries - developing education systems
            'NG': 'Primary School', 'EG': 'Government School', 'ZA': 'Public School',
            'KE': 'Primary School', 'GH': 'Basic School', 'MA': 'Public School',
            
            # Oceania
            'AU': 'State School', 'NZ': 'State School', 'PG': 'Community School',
            
            # South America
            'BR': 'Public School', 'AR': 'State School', 'CL': 'Municipal School',
            'CO': 'Public School', 'PE': 'State School', 'VE': 'National School'
        }
    
    def build_overpass_query(self, country_code: str) -> str:
        """Build Overpass query for schools in a country"""
        return f"""
        [out:json][timeout:{self.timeout}];
        area["ISO3166-1"="{country_code}"]["admin_level"="2"]->.country;
        (
          // Schools by amenity tag
          nwr["amenity"="school"](area.country);
          nwr["amenity"="kindergarten"](area.country);
          nwr["amenity"="college"](area.country);
          nwr["amenity"="university"](area.country);
          
          // Schools by building type
          nwr["building"="school"](area.country);
          nwr["building"="kindergarten"](area.country);
          nwr["building"="university"](area.country);
          
          // Educational facilities
          nwr["leisure"="educational_activity"](area.country);
          nwr["office"="educational_institution"](area.country);
          
          // Specific education types
          nwr["isced:level"](area.country);
          nwr["school:type"](area.country);
          
          // Alternative tags for international schools
          nwr["name"~"[Ss]chool"](area.country);
          nwr["name"~"[Uu]niversity"](area.country);
          nwr["name"~"[Cc]ollege"](area.country);
          nwr["name"~"[Kk]indergarten"](area.country);
          nwr["name"~"[Aa]cademy"](area.country);
          nwr["name"~"[Ii]nstitute"](area.country);
          
        );
        out geom;
        """
    
    def extract_schools_for_country(self, country_code: str) -> Optional[List[Dict]]:
        """Extract all schools for a specific country"""
        print(f"Extracting schools for {country_code}...")
        
        query = self.build_overpass_query(country_code)
        
        try:
            response = requests.post(
                self.base_url,
                data=query,
                timeout=self.timeout,
                headers={'User-Agent': 'Global Schools Database/1.0'}
            )
            
            if response.status_code != 200:
                print(f"Error {response.status_code} for {country_code}: {response.text}")
                return None
                
            data = response.json()
            schools = []
            
            for element in data.get('elements', []):
                school_data = self.process_school_element(element, country_code)
                if school_data:
                    schools.append(school_data)
            
            print(f"Found {len(schools)} schools in {country_code}")
            return schools
            
        except requests.Timeout:
            print(f"Timeout extracting schools for {country_code}")
            return None
        except Exception as e:
            print(f"Error extracting schools for {country_code}: {e}")
            return None
    
    def process_school_element(self, element: Dict, country_code: str) -> Optional[Dict]:
        """Process individual school element from OSM data"""
        # Get coordinates
        lat, lng = None, None
        
        if element.get('type') == 'node':
            lat, lng = element.get('lat'), element.get('lon')
        elif element.get('center'):
            lat, lng = element['center']['lat'], element['center']['lon']
        elif element.get('lat') and element.get('lon'):
            lat, lng = element.get('lat'), element.get('lon')
        
        if not (lat and lng):
            return None
        
        # Validate coordinates
        if not (-90 <= lat <= 90 and -180 <= lng <= 180):
            return None
        
        tags = element.get('tags', {})
        
        # Extract school information
        name = (tags.get('name') or 
                tags.get('name:en') or 
                tags.get('official_name') or 
                'Unnamed School')
        
        # Determine school type/level
        school_type = self.determine_school_type(tags, country_code)
        
        # Get education level
        education_level = self.get_education_level(tags)
        
        # Get operator (public/private)
        operator = self.get_operator_type(tags)
        
        # Get capacity if available
        capacity = self.get_capacity(tags)
        
        return {
            'lat': lat,
            'lng': lng,
            'name': name,
            'school_type': school_type,
            'education_level': education_level,
            'operator': operator,
            'capacity': capacity,
            'country': country_code,
            'osm_id': element.get('id'),
            'osm_type': element.get('type'),
            'tags': {k: v for k, v in tags.items() if k in [
                'amenity', 'building', 'school:type', 'isced:level',
                'operator', 'operator:type', 'addr:city', 'addr:postcode'
            ]}
        }
    
    def determine_school_type(self, tags: Dict, country_code: str) -> str:
        """Determine school type from OSM tags"""
        # Direct amenity mapping
        amenity = tags.get('amenity', '').lower()
        if amenity == 'kindergarten':
            return 'Kindergarten'
        elif amenity == 'university':
            return 'University'
        elif amenity == 'college':
            return 'College'
        elif amenity == 'school':
            # Check for more specific school type
            school_type = tags.get('school:type', '').lower()
            if school_type:
                return school_type.title()
            
            # Check ISCED level
            isced = tags.get('isced:level', '')
            if isced:
                if '0' in isced:
                    return 'Kindergarten'
                elif '1' in isced:
                    return 'Primary School'
                elif '2' in isced:
                    return 'Secondary School'
                elif '3' in isced:
                    return 'Upper Secondary'
                elif any(x in isced for x in ['5', '6', '7', '8']):
                    return 'Higher Education'
        
        # Building type
        building = tags.get('building', '').lower()
        if building == 'kindergarten':
            return 'Kindergarten'
        elif building == 'university':
            return 'University'
        
        # Name-based detection
        name = tags.get('name', '').lower()
        if any(term in name for term in ['kindergarten', 'preschool', 'nursery']):
            return 'Kindergarten'
        elif any(term in name for term in ['university', 'institut']):
            return 'University'
        elif any(term in name for term in ['college', 'academy']):
            return 'College'
        elif any(term in name for term in ['primary', 'elementary']):
            return 'Primary School'
        elif any(term in name for term in ['secondary', 'high school', 'grammar']):
            return 'Secondary School'
        
        # Default by region
        return self.regional_defaults.get(country_code, 'School')
    
    def get_education_level(self, tags: Dict) -> str:
        """Get education level from ISCED or other tags"""
        isced = tags.get('isced:level', '')
        if isced:
            levels = []
            if '0' in isced:
                levels.append('Pre-primary')
            if '1' in isced:
                levels.append('Primary')
            if '2' in isced:
                levels.append('Lower Secondary')
            if '3' in isced:
                levels.append('Upper Secondary')
            if any(x in isced for x in ['5', '6']):
                levels.append('Tertiary')
            if any(x in isced for x in ['7', '8']):
                levels.append('Advanced Tertiary')
            
            return ';'.join(levels) if levels else 'Unknown'
        
        # Fallback based on amenity
        amenity = tags.get('amenity', '').lower()
        if amenity == 'kindergarten':
            return 'Pre-primary'
        elif amenity == 'university':
            return 'Tertiary'
        elif amenity == 'college':
            return 'Tertiary'
        
        return 'Unknown'
    
    def get_operator_type(self, tags: Dict) -> str:
        """Determine if school is public, private, or other"""
        operator_type = tags.get('operator:type', '').lower()
        if operator_type:
            if 'government' in operator_type or 'public' in operator_type:
                return 'Public'
            elif 'private' in operator_type:
                return 'Private'
            elif 'religious' in operator_type:
                return 'Religious'
            elif 'community' in operator_type:
                return 'Community'
        
        # Check operator field
        operator = tags.get('operator', '').lower()
        if any(term in operator for term in ['government', 'ministry', 'state', 'public']):
            return 'Public'
        elif any(term in operator for term in ['private', 'ltd', 'inc']):
            return 'Private'
        elif any(term in operator for term in ['church', 'religious', 'catholic', 'christian']):
            return 'Religious'
        
        return 'Unknown'
    
    def get_capacity(self, tags: Dict) -> Optional[int]:
        """Extract school capacity if available"""
        capacity_fields = ['capacity', 'capacity:students', 'student_count']
        
        for field in capacity_fields:
            if field in tags:
                try:
                    return int(tags[field])
                except ValueError:
                    continue
        
        return None
    
    def save_schools_data(self, country_code: str, schools: List[Dict]):
        """Save schools data to JSON file"""
        output_file = os.path.join(self.output_dir, f"{country_code.lower()}_schools.json")
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(schools, f, ensure_ascii=False, indent=2)
        
        print(f"Saved {len(schools)} schools to {output_file}")

def main():
    """Extract schools for test countries"""
    extractor = GlobalSchoolsExtractor()
    
    # Test with diverse education systems
    test_countries = [
        'NZ',  # Small country, good data quality
        'SG',  # City-state, high density
        'FI',  # Excellent education system
        'KE',  # Developing country example
        'CR'   # Central America example
    ]
    
    total_schools = 0
    
    for country_code in test_countries:
        schools = extractor.extract_schools_for_country(country_code)
        
        if schools:
            extractor.save_schools_data(country_code, schools)
            total_schools += len(schools)
        
        # Rate limiting
        time.sleep(2)
    
    print(f"\nTotal schools extracted: {total_schools}")
    print("Test extraction complete!")

if __name__ == "__main__":
    main()