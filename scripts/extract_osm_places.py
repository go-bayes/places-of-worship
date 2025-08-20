#!/usr/bin/env python3
"""
Extract places of worship from OpenStreetMap for New Zealand.
Downloads current OSM data and processes it into our standardized format.
"""

import json
import logging
import requests
import asyncio
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Any, Optional
import uuid
import argparse

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class OSMPlacesExtractor:
    """Extract places of worship from OpenStreetMap."""
    
    def __init__(self, output_dir: str = "data/raw/osm"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.overpass_url = "https://overpass-api.de/api/interpreter"
        
    def build_overpass_query(self, country_code: str = "NZ") -> str:
        """Build Overpass API query for places of worship."""
        query = f"""
        [out:json][timeout:300];
        area["ISO3166-1"="{country_code}"]->.country;
        (
          nwr["amenity"="place_of_worship"](area.country);
        );
        out geom;
        """
        return query.strip()
    
    def extract_denomination(self, tags: Dict[str, str]) -> str:
        """Extract denomination from OSM tags."""
        
        # Direct denomination tag
        if 'denomination' in tags:
            return tags['denomination']
        
        # Religion-based mapping
        religion = tags.get('religion', '').lower()
        religion_mapping = {
            'christian': self._extract_christian_denomination(tags),
            'muslim': 'Islam',
            'islamic': 'Islam', 
            'jewish': 'Judaism',
            'buddhist': 'Buddhism',
            'hindu': 'Hinduism',
            'sikh': 'Sikhism',
            'bahai': 'Baháʼí Faith',
            'shinto': 'Shinto',
            'taoist': 'Taoism',
            'jain': 'Jainism'
        }
        
        if religion in religion_mapping:
            return religion_mapping[religion]
        
        # Building type mapping
        building = tags.get('building', '').lower()
        building_mapping = {
            'church': 'Christian',
            'cathedral': 'Christian',
            'chapel': 'Christian',
            'mosque': 'Islam',
            'synagogue': 'Judaism',
            'temple': 'Unknown', # Could be various religions
        }
        
        if building in building_mapping:
            result = building_mapping[building]
            if result == 'Christian':
                return self._extract_christian_denomination(tags)
            return result
        
        return 'Unknown'
    
    def _extract_christian_denomination(self, tags: Dict[str, str]) -> str:
        """Extract specific Christian denomination."""
        
        # Check denomination tag first
        denom = tags.get('denomination', '').lower()
        
        christian_mapping = {
            'anglican': 'Anglican',
            'catholic': 'Catholic',
            'roman_catholic': 'Catholic',
            'orthodox': 'Orthodox',
            'presbyterian': 'Presbyterian',
            'methodist': 'Methodist',
            'baptist': 'Baptist',
            'lutheran': 'Lutheran',
            'pentecostal': 'Pentecostal',
            'reformed': 'Reformed',
            'evangelical': 'Evangelical',
            'uniting': 'Uniting Church',
            'salvation_army': 'Salvation Army',
            'seventh_day_adventist': 'Seventh-day Adventist',
            'jehovahs_witness': "Jehovah's Witnesses",
            'mormon': 'Latter-day Saints',
            'quaker': 'Quaker',
            'brethren': 'Brethren'
        }
        
        for key, value in christian_mapping.items():
            if key in denom:
                return value
        
        # Check name for denomination clues
        name = tags.get('name', '').lower()
        for key, value in christian_mapping.items():
            if key.replace('_', ' ') in name:
                return value
        
        # Check operator tag
        operator = tags.get('operator', '').lower()
        for key, value in christian_mapping.items():
            if key.replace('_', ' ') in operator:
                return value
        
        return 'Christian (Other)'
    
    def calculate_confidence_score(self, element: Dict[str, Any]) -> float:
        """Calculate confidence score for OSM element."""
        score = 1.0
        tags = element.get('tags', {})
        
        # Factor 1: Tag completeness
        required_tags = ['name', 'amenity']
        helpful_tags = ['denomination', 'religion', 'addr:street', 'addr:city', 'website', 'phone']
        
        required_present = sum(1 for tag in required_tags if tag in tags)
        helpful_present = sum(1 for tag in helpful_tags if tag in tags)
        
        completeness = (required_present / len(required_tags)) * 0.7 + (helpful_present / len(helpful_tags)) * 0.3
        score *= (0.5 + 0.5 * completeness)
        
        # Factor 2: Element type (nodes are less reliable than ways/relations)
        if element['type'] == 'node':
            score *= 0.9
        elif element['type'] == 'way':
            score *= 1.0
        elif element['type'] == 'relation':
            score *= 1.1
        
        # Factor 3: Version (more edits = more reliable)
        version = element.get('version', 1)
        if version == 1:
            score *= 0.8  # New, unverified
        elif version > 10:
            score *= 0.95  # Potentially unstable from too many edits
        else:
            score *= 1.0  # Good edit history
        
        # Factor 4: Data freshness
        timestamp = element.get('timestamp')
        if timestamp:
            try:
                edit_date = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                age_days = (datetime.now(timezone.utc) - edit_date).days
                
                if age_days < 365:
                    score *= 1.0  # Recent data
                elif age_days < 365 * 3:
                    score *= 0.95  # Moderately old
                else:
                    score *= 0.9  # Old data
            except:
                score *= 0.9  # Invalid timestamp
        
        # Factor 5: Specific quality indicators
        if 'fixme' in tags or 'FIXME' in tags:
            score *= 0.6  # Marked for fixing
        
        if tags.get('name') in ['Unknown', 'unknown', '', 'TBD', 'TODO']:
            score *= 0.5  # Poor name quality
        
        return min(1.0, max(0.0, score))
    
    def extract_geometry(self, element: Dict[str, Any]) -> Optional[List[float]]:
        """Extract coordinates from OSM element."""
        
        if element['type'] == 'node':
            return [element['lon'], element['lat']]
        
        elif element['type'] == 'way':
            # Calculate centroid of way
            if 'geometry' in element:
                coords = element['geometry']
                if coords:
                    avg_lon = sum(coord['lon'] for coord in coords) / len(coords)
                    avg_lat = sum(coord['lat'] for coord in coords) / len(coords)
                    return [avg_lon, avg_lat]
        
        elif element['type'] == 'relation':
            # For relations, we'd need to process members - for now skip
            return None
        
        return None
    
    def process_osm_element(self, element: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Convert OSM element to our standardized format."""
        
        tags = element.get('tags', {})
        
        # Skip if not a place of worship
        if tags.get('amenity') != 'place_of_worship':
            return None
        
        # Extract coordinates
        coordinates = self.extract_geometry(element)
        if not coordinates:
            logger.warning(f"Could not extract coordinates for OSM {element['type']} {element['id']}")
            return None
        
        # Extract basic information
        name = tags.get('name', f"Unnamed {element['type']} {element['id']}")
        denomination = self.extract_denomination(tags)
        confidence = self.calculate_confidence_score(element)
        
        # Build standardized record
        place_record = {
            'place_id': str(uuid.uuid4()),
            'osm_id': element['id'],
            'osm_type': element['type'],
            'name': name,
            'denomination': denomination,
            'coordinates': coordinates,
            'data_sources': ['osm'],
            'confidence': round(confidence, 3),
            
            # Additional OSM-specific data
            'osm_tags': tags,
            'osm_version': element.get('version'),
            'osm_timestamp': element.get('timestamp'),
            'osm_changeset': element.get('changeset'),
            'osm_user': element.get('user'),
            
            # Extracted fields
            'address': self._extract_address(tags),
            'phone': tags.get('phone'),
            'website': tags.get('website'),
            'opening_hours': tags.get('opening_hours'),
            
            # Metadata
            'extracted_at': datetime.now(timezone.utc).isoformat(),
            'extraction_method': 'overpass_api'
        }
        
        return place_record
    
    def _extract_address(self, tags: Dict[str, str]) -> Optional[str]:
        """Extract address from OSM tags."""
        address_parts = []
        
        # Street address
        if 'addr:housenumber' in tags and 'addr:street' in tags:
            address_parts.append(f"{tags['addr:housenumber']} {tags['addr:street']}")
        elif 'addr:street' in tags:
            address_parts.append(tags['addr:street'])
        
        # City/suburb
        if 'addr:city' in tags:
            address_parts.append(tags['addr:city'])
        elif 'addr:suburb' in tags:
            address_parts.append(tags['addr:suburb'])
        
        # State/region
        if 'addr:state' in tags:
            address_parts.append(tags['addr:state'])
        
        # Postcode
        if 'addr:postcode' in tags:
            address_parts.append(tags['addr:postcode'])
        
        # Country
        if 'addr:country' in tags:
            address_parts.append(tags['addr:country'])
        
        return ', '.join(address_parts) if address_parts else None
    
    async def fetch_osm_data(self, country_code: str) -> List[Dict[str, Any]]:
        """Fetch places of worship data from OSM via Overpass API."""
        
        query = self.build_overpass_query(country_code)
        logger.info(f"Fetching OSM data for {country_code}...")
        logger.debug(f"Overpass query: {query}")
        
        try:
            response = requests.post(
                self.overpass_url,
                data={'data': query},
                timeout=600  # 10 minute timeout
            )
            response.raise_for_status()
            
            data = response.json()
            elements = data.get('elements', [])
            
            logger.info(f"Retrieved {len(elements)} elements from OSM")
            return elements
            
        except requests.RequestException as e:
            logger.error(f"Error fetching OSM data: {e}")
            raise
        except json.JSONDecodeError as e:
            logger.error(f"Error parsing OSM response: {e}")
            raise
    
    def save_raw_data(self, data: List[Dict[str, Any]], country_code: str) -> Path:
        """Save raw OSM data to file."""
        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        filename = f"osm_raw_{country_code.lower()}_{timestamp}.json"
        filepath = self.output_dir / filename
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Saved raw OSM data to {filepath}")
        return filepath
    
    def save_processed_data(self, places: List[Dict[str, Any]], country_code: str) -> Path:
        """Save processed places data as GeoJSON."""
        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        filename = f"osm_places_{country_code.lower()}_{timestamp}.geojson"
        filepath = self.output_dir / filename
        
        # Convert to GeoJSON format
        geojson = {
            "type": "FeatureCollection",
            "metadata": {
                "title": f"Places of Worship - {country_code}",
                "description": "Extracted from OpenStreetMap",
                "source": "OpenStreetMap contributors",
                "license": "ODbL",
                "extraction_date": datetime.now(timezone.utc).isoformat(),
                "total_places": len(places)
            },
            "features": []
        }
        
        for place in places:
            feature = {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": place['coordinates']
                },
                "properties": {k: v for k, v in place.items() if k != 'coordinates'}
            }
            geojson["features"].append(feature)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(geojson, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Saved processed places to {filepath}")
        return filepath
    
    async def extract_places(self, country_code: str) -> Dict[str, Any]:
        """Main extraction process."""
        logger.info(f"Starting OSM places extraction for {country_code}")
        
        # Fetch raw data
        raw_elements = await self.fetch_osm_data(country_code)
        
        # Save raw data
        raw_file = self.save_raw_data(raw_elements, country_code)
        
        # Process elements
        places = []
        skipped = 0
        
        for element in raw_elements:
            processed = self.process_osm_element(element)
            if processed:
                places.append(processed)
            else:
                skipped += 1
        
        logger.info(f"Processed {len(places)} places, skipped {skipped} elements")
        
        # Save processed data
        processed_file = self.save_processed_data(places, country_code)
        
        # Generate summary statistics
        summary = self.generate_summary(places, country_code)
        
        return {
            'summary': summary,
            'raw_file': str(raw_file),
            'processed_file': str(processed_file),
            'total_places': len(places)
        }
    
    def generate_summary(self, places: List[Dict[str, Any]], country_code: str) -> Dict[str, Any]:
        """Generate summary statistics."""
        
        # Denomination breakdown
        denominations = {}
        confidence_distribution = {'high': 0, 'medium': 0, 'low': 0}
        has_address = 0
        has_phone = 0
        has_website = 0
        
        for place in places:
            # Count denominations
            denom = place['denomination']
            denominations[denom] = denominations.get(denom, 0) + 1
            
            # Confidence distribution
            conf = place['confidence']
            if conf >= 0.8:
                confidence_distribution['high'] += 1
            elif conf >= 0.6:
                confidence_distribution['medium'] += 1
            else:
                confidence_distribution['low'] += 1
            
            # Data completeness
            if place.get('address'):
                has_address += 1
            if place.get('phone'):
                has_phone += 1
            if place.get('website'):
                has_website += 1
        
        summary = {
            'country': country_code,
            'total_places': len(places),
            'denominations': dict(sorted(denominations.items(), key=lambda x: x[1], reverse=True)),
            'confidence_distribution': confidence_distribution,
            'data_completeness': {
                'has_address': f"{has_address}/{len(places)} ({has_address/len(places)*100:.1f}%)",
                'has_phone': f"{has_phone}/{len(places)} ({has_phone/len(places)*100:.1f}%)",
                'has_website': f"{has_website}/{len(places)} ({has_website/len(places)*100:.1f}%)"
            },
            'extraction_date': datetime.now(timezone.utc).isoformat()
        }
        
        return summary


async def main():
    """Main execution function."""
    parser = argparse.ArgumentParser(description='Extract places of worship from OpenStreetMap')
    parser.add_argument('--country', '-c', default='NZ', help='Country code (default: NZ)')
    parser.add_argument('--output', '-o', default='data/raw/osm', help='Output directory')
    parser.add_argument('--verbose', '-v', action='store_true', help='Enable verbose logging')
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Create extractor
    extractor = OSMPlacesExtractor(args.output)
    
    try:
        # Extract places
        result = await extractor.extract_places(args.country)
        
        # Print summary
        summary = result['summary']
        print(f"\n🎉 OSM Extraction Complete for {summary['country']}")
        print(f"📊 Total places: {summary['total_places']}")
        print(f"📁 Processed file: {result['processed_file']}")
        print(f"📁 Raw file: {result['raw_file']}")
        print(f"\n📈 Top denominations:")
        for denom, count in list(summary['denominations'].items())[:5]:
            print(f"   {denom}: {count}")
        
        print(f"\n✅ Data quality:")
        conf_dist = summary['confidence_distribution']
        print(f"   High confidence (≥0.8): {conf_dist['high']}")
        print(f"   Medium confidence (≥0.6): {conf_dist['medium']}")
        print(f"   Low confidence (<0.6): {conf_dist['low']}")
        
    except Exception as e:
        logger.error(f"Extraction failed: {e}")
        return 1
    
    return 0


if __name__ == "__main__":
    exit(asyncio.run(main()))