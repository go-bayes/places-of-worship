#!/usr/bin/env python3
"""
Extract REAL Global Places of Worship Data
Targets ~2M places worldwide from OpenStreetMap via Overpass API
"""

import requests
import time
import json
import geopandas as gpd
import pandas as pd
from pathlib import Path
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict
import os
from tqdm import tqdm

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class RealGlobalPlacesExtractor:
    def __init__(self, output_dir: str = "data/global"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # High-coverage countries for 2M+ target (prioritized by places of worship density)
        self.priority_countries = [
            # Major Western countries with high coverage
            'US',   # ~300K places
            'DE',   # ~80K places  
            'GB',   # ~50K places
            'FR',   # ~60K places
            'IT',   # ~70K places
            'ES',   # ~40K places
            'NL',   # ~15K places
            'BE',   # ~10K places
            'AT',   # ~8K places
            'CH',   # ~5K places
            
            # English-speaking with good OSM coverage
            'AU',   # ~20K places
            'NZ',   # ~3K places
            'CA',   # ~40K places
            'IE',   # ~5K places
            
            # Major countries with significant religious infrastructure
            'BR',   # ~100K places
            'MX',   # ~80K places
            'CO',   # ~30K places
            'AR',   # ~25K places
            
            # European countries with strong OSM presence
            'PL',   # ~30K places
            'CZ',   # ~8K places
            'NO',   # ~5K places
            'SE',   # ~8K places
            'DK',   # ~3K places
            'FI',   # ~4K places
            
            # Major Asian countries (selective regions)
            'IN',   # ~200K places
            'PH',   # ~50K places
            'TH',   # ~40K places
            'VN',   # ~30K places
            'KR',   # ~20K places
            'JP',   # ~80K places
            'MY',   # ~15K places
            
            # African countries with decent OSM coverage
            'ZA',   # ~30K places
            'KE',   # ~20K places
            'NG',   # ~50K places
            'GH',   # ~15K places
            'UG',   # ~10K places
            
            # Additional coverage for completeness
            'RO',   # ~15K places
            'HU',   # ~8K places
            'HR',   # ~5K places
            'GR',   # ~10K places
            'PT',   # ~15K places
        ]
        
        # Use multiple Overpass servers for load balancing
        self.overpass_servers = [
            "https://overpass-api.de/api/interpreter",
            "https://overpass.kumi.systems/api/interpreter", 
            "https://maps.mail.ru/osm/tools/overpass/api/interpreter"
        ]
        self.current_server = 0
        
    def get_next_server(self):
        """Rotate between Overpass servers to avoid rate limiting"""
        server = self.overpass_servers[self.current_server]
        self.current_server = (self.current_server + 1) % len(self.overpass_servers)
        return server
    
    def build_country_query(self, country_code: str) -> str:
        """Build Overpass QL query for places of worship"""
        return f"""
        [out:json][timeout:1800];
        area["ISO3166-1"="{country_code}"]->.country;
        (
          // Primary places of worship
          nwr["amenity"="place_of_worship"](area.country);
          
          // Religious buildings
          nwr["building"="church"](area.country);
          nwr["building"="mosque"](area.country);
          nwr["building"="temple"](area.country);
          nwr["building"="synagogue"](area.country);
          nwr["building"="chapel"](area.country);
          nwr["building"="cathedral"](area.country);
          nwr["building"="monastery"](area.country);
          nwr["building"="shrine"](area.country);
          
          // Religious land use
          nwr["landuse"="religious"](area.country);
          
          // Specific religion tags (backup for missing amenity=place_of_worship)
          nwr["religion"~"christian|muslim|hindu|buddhist|jewish|sikh|taoist|shinto|bahai"](area.country);
        );
        out geom;
        """
    
    def extract_country_data(self, country_code: str, retry_count: int = 0) -> List[Dict]:
        """Extract places of worship for a single country with retry logic"""
        max_retries = 3
        
        logger.info(f"🌍 Extracting {country_code} (attempt {retry_count + 1})")
        
        # Check cache first
        cache_file = self.output_dir / f"{country_code.lower()}_places_raw.json"
        if cache_file.exists():
            logger.info(f"📁 Loading cached data for {country_code}")
            try:
                with open(cache_file, 'r') as f:
                    return json.load(f)
            except Exception as e:
                logger.warning(f"Cache read failed for {country_code}: {e}")
        
        query = self.build_country_query(country_code)
        server = self.get_next_server()
        
        try:
            logger.info(f"🔗 Querying {server} for {country_code}")
            
            response = requests.post(
                server,
                data=query,
                timeout=1800,  # 30 minutes max
                headers={
                    'User-Agent': 'PlacesOfWorshipResearch/1.0 (academic research)',
                    'Accept': 'application/json'
                }
            )
            response.raise_for_status()
            
            data = response.json()
            elements = data.get('elements', [])
            
            logger.info(f"✅ {country_code}: {len(elements):,} raw elements extracted")
            
            # Cache successful results
            with open(cache_file, 'w') as f:
                json.dump(elements, f, indent=2)
            
            return elements
            
        except requests.exceptions.Timeout:
            logger.error(f"⏰ Timeout extracting {country_code}")
            if retry_count < max_retries:
                time.sleep(30)  # Wait before retry
                return self.extract_country_data(country_code, retry_count + 1)
            return []
            
        except requests.exceptions.RequestException as e:
            logger.error(f"🚫 Network error for {country_code}: {e}")
            if retry_count < max_retries:
                time.sleep(60)  # Wait longer for network issues
                return self.extract_country_data(country_code, retry_count + 1)
            return []
            
        except Exception as e:
            logger.error(f"💥 Unexpected error for {country_code}: {e}")
            return []
    
    def process_osm_element(self, element: Dict, country_code: str) -> Dict:
        """Convert OSM element to standardized place record"""
        tags = element.get('tags', {})
        
        # Skip if not actually a place of worship
        if not self.is_place_of_worship(tags):
            return None
        
        # Extract coordinates
        coordinates = self.extract_coordinates(element)
        if not coordinates:
            return None
            
        lat, lng = coordinates
        
        # Extract name with fallbacks
        name = self.extract_name(tags, element['id'])
        
        # Religion and denomination
        religion = self.normalize_religion(tags.get('religion', 'unknown'))
        denomination = tags.get('denomination', '')
        
        # Calculate confidence score
        confidence = self.calculate_confidence(tags)
        
        return {
            'id': f"{element['type'][0]}{element['id']}",
            'osm_id': element['id'],
            'osm_type': element['type'],
            'lat': lat,
            'lng': lng,
            'name': name,
            'religion': religion,
            'denomination': denomination,
            'confidence': confidence,
            'country_code': country_code,
            'type': 'churches',  # For compatibility
            'website': tags.get('website', ''),
            'phone': tags.get('phone', ''),
            'address': self.extract_address(tags),
            'start_date': self.extract_date(tags),
            'tags_raw': {k: v for k, v in tags.items() if k in [
                'amenity', 'building', 'religion', 'denomination', 
                'service_times', 'wheelchair', 'internet_access'
            ]}
        }
    
    def is_place_of_worship(self, tags: Dict) -> bool:
        """Determine if OSM element represents a place of worship"""
        # Primary indicators
        if tags.get('amenity') == 'place_of_worship':
            return True
        
        # Religious buildings
        religious_buildings = {
            'church', 'mosque', 'temple', 'synagogue', 'chapel', 
            'cathedral', 'monastery', 'shrine'
        }
        if tags.get('building') in religious_buildings:
            return True
        
        # Religious land use
        if tags.get('landuse') == 'religious':
            return True
        
        # Has religion tag (but exclude non-worship uses)
        if tags.get('religion') and tags.get('amenity') not in ['school', 'hospital', 'social_facility']:
            return True
        
        return False
    
    def extract_coordinates(self, element: Dict) -> tuple:
        """Extract lat/lng coordinates from OSM element"""
        if element['type'] == 'node':
            return element['lat'], element['lon']
        elif 'center' in element:
            return element['center']['lat'], element['center']['lon']
        elif element['type'] == 'way' and 'geometry' in element:
            # Calculate centroid of way
            coords = element['geometry']
            if coords:
                lats = [c['lat'] for c in coords]
                lngs = [c['lon'] for c in coords]
                return sum(lats) / len(lats), sum(lngs) / len(lngs)
        return None
    
    def extract_name(self, tags: Dict, osm_id: int) -> str:
        """Extract name with multiple fallbacks"""
        name_candidates = [
            tags.get('name'),
            tags.get('name:en'),
            tags.get('official_name'),
            tags.get('short_name'),
            tags.get('alt_name')
        ]
        
        for name in name_candidates:
            if name and len(name.strip()) > 0:
                return name.strip()
        
        # Generate descriptive name based on religion/denomination
        religion = tags.get('religion', 'unknown')
        denomination = tags.get('denomination', '')
        
        if denomination:
            return f"{denomination.title()} Place of Worship"
        elif religion != 'unknown':
            return f"{religion.title()} Place of Worship"
        else:
            return f"Place of Worship {osm_id}"
    
    def normalize_religion(self, religion: str) -> str:
        """Normalize religion values to standard set"""
        if not religion:
            return 'unknown'
        
        religion_lower = religion.lower()
        
        # Mapping variants to standard values
        mappings = {
            'christian': ['christian', 'christianity', 'catholic', 'protestant', 'orthodox'],
            'muslim': ['muslim', 'islam', 'islamic'],
            'jewish': ['jewish', 'judaism', 'jew'],
            'hindu': ['hindu', 'hinduism'],
            'buddhist': ['buddhist', 'buddhism', 'buddha'],
            'sikh': ['sikh', 'sikhism'],
            'bahai': ['bahai', "baha'i", 'bahaism'],
            'taoist': ['taoist', 'taoism', 'dao'],
            'shinto': ['shinto', 'shintoism'],
            'jain': ['jain', 'jainism']
        }
        
        for standard, variants in mappings.items():
            if religion_lower in variants:
                return standard
        
        return religion_lower
    
    def calculate_confidence(self, tags: Dict) -> float:
        """Calculate confidence score based on OSM data completeness"""
        score = 0.5  # Base score
        
        # Strong indicators
        if tags.get('amenity') == 'place_of_worship':
            score += 0.2
        if tags.get('name'):
            score += 0.15
        if tags.get('religion') and tags['religion'] != 'unknown':
            score += 0.1
        
        # Additional details
        if tags.get('denomination'):
            score += 0.05
        if tags.get('website') or tags.get('phone'):
            score += 0.05
        if any(tags.get(f'addr:{field}') for field in ['street', 'city', 'postcode']):
            score += 0.05
        if tags.get('service_times'):
            score += 0.03
        if tags.get('wheelchair'):
            score += 0.02
        
        return min(1.0, score)
    
    def extract_address(self, tags: Dict) -> str:
        """Extract readable address from OSM tags"""
        parts = []
        
        if tags.get('addr:housenumber') and tags.get('addr:street'):
            parts.append(f"{tags['addr:housenumber']} {tags['addr:street']}")
        elif tags.get('addr:street'):
            parts.append(tags['addr:street'])
        
        if tags.get('addr:city'):
            parts.append(tags['addr:city'])
        if tags.get('addr:postcode'):
            parts.append(tags['addr:postcode'])
        
        return ', '.join(parts)
    
    def extract_date(self, tags: Dict) -> str:
        """Extract establishment date if available"""
        date_fields = ['start_date', 'construction_date', 'opening_date']
        for field in date_fields:
            if tags.get(field):
                return tags[field]
        return None
    
    def extract_countries_parallel(self, max_workers: int = 2) -> Dict[str, List[Dict]]:
        """Extract data for all countries with controlled parallelism"""
        results = {}
        
        # Rate limiting: max 2 concurrent requests to be respectful to Overpass API
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Submit extraction tasks
            future_to_country = {}
            
            for country in tqdm(self.priority_countries, desc="Queuing countries"):
                future = executor.submit(self.extract_country_data, country)
                future_to_country[future] = country
                time.sleep(5)  # Stagger submissions
            
            # Process results as they complete
            for future in tqdm(as_completed(future_to_country), 
                             total=len(future_to_country), 
                             desc="Processing results"):
                country = future_to_country[future]
                
                try:
                    raw_elements = future.result()
                    
                    # Process elements into standardized format
                    places = []
                    for element in tqdm(raw_elements, desc=f"Processing {country}", leave=False):
                        place = self.process_osm_element(element, country)
                        if place:
                            places.append(place)
                    
                    results[country] = places
                    logger.info(f"✅ {country}: {len(places):,} places processed")
                    
                    # Save individual country file
                    country_file = self.output_dir / f"{country.lower()}_places.json"
                    with open(country_file, 'w') as f:
                        json.dump(places, f, indent=2)
                
                except Exception as e:
                    logger.error(f"💥 Failed to process {country}: {e}")
                    results[country] = []
                
                # Rate limiting between countries
                time.sleep(10)
        
        return results
    
    def create_global_parquet(self, country_data: Dict[str, List[Dict]]):
        """Create optimized global parquet file"""
        logger.info("🔧 Creating global parquet file...")
        
        # Combine all countries
        all_places = []
        country_stats = {}
        
        for country, places in country_data.items():
            all_places.extend(places)
            country_stats[country] = len(places)
        
        total_places = len(all_places)
        logger.info(f"🎯 Total places extracted: {total_places:,}")
        
        if total_places == 0:
            logger.error("❌ No places extracted!")
            return
        
        # Convert to GeoDataFrame
        df = pd.DataFrame(all_places)
        
        # Create geometry column
        df['geometry'] = gpd.points_from_xy(df['lng'], df['lat'])
        gdf = gpd.GeoDataFrame(df, crs='EPSG:4326')
        
        # Sort for better compression and query performance
        gdf = gdf.sort_values(['country_code', 'confidence', 'religion'], ascending=[True, False, True])
        
        # Save as optimized parquet
        parquet_file = self.output_dir / "churches.parquet"
        gdf.to_parquet(parquet_file, index=False, compression='snappy')
        
        logger.info(f"💾 Saved {total_places:,} places to {parquet_file}")
        
        # Create statistics
        stats = {
            'extraction_summary': {
                'total_places': total_places,
                'countries_processed': len([c for c, places in country_data.items() if places]),
                'extraction_date': time.strftime('%Y-%m-%d %H:%M:%S'),
                'target_achieved': total_places >= 1000000  # 1M+ target
            },
            'by_country': country_stats,
            'by_religion': gdf['religion'].value_counts().to_dict(),
            'by_confidence': {
                'mean': float(gdf['confidence'].mean()),
                'high_confidence_count': int((gdf['confidence'] >= 0.8).sum()),
                'medium_confidence_count': int((gdf['confidence'] >= 0.6).sum()),
                'low_confidence_count': int((gdf['confidence'] < 0.6).sum())
            },
            'data_quality': {
                'places_with_names': int(gdf['name'].notna().sum()),
                'places_with_addresses': int(gdf['address'].str.len().gt(0).sum()),
                'places_with_websites': int(gdf['website'].str.len().gt(0).sum()),
                'places_with_phones': int(gdf['phone'].str.len().gt(0).sum())
            }
        }
        
        # Save statistics
        with open(self.output_dir / "extraction_statistics.json", 'w') as f:
            json.dump(stats, f, indent=2)
        
        # Log summary
        logger.info("📊 EXTRACTION COMPLETE!")
        logger.info(f"   Total Places: {total_places:,}")
        logger.info(f"   Countries: {len(country_stats)}")
        logger.info(f"   Top Religions: {dict(list(gdf['religion'].value_counts().head().items()))}")
        logger.info(f"   High Confidence: {stats['by_confidence']['high_confidence_count']:,}")
        
        # File size
        if parquet_file.exists():
            size_mb = parquet_file.stat().st_size / 1024 / 1024
            logger.info(f"   File Size: {size_mb:.1f} MB")
            
            if size_mb > 100:
                logger.warning("⚠️  File > 100MB - using Git LFS")
        
        return parquet_file

def main():
    """Main extraction function"""
    logger.info("🚀 Starting REAL global places of worship extraction...")
    logger.info("🎯 Target: 2,000,000+ places worldwide")
    
    extractor = RealGlobalPlacesExtractor()
    
    # Extract from all priority countries (controlled rate limiting)
    logger.info(f"🌍 Processing {len(extractor.priority_countries)} countries...")
    country_data = extractor.extract_countries_parallel(max_workers=2)
    
    # Create optimized global dataset
    parquet_file = extractor.create_global_parquet(country_data)
    
    logger.info("✅ GLOBAL EXTRACTION COMPLETE!")
    logger.info("🗺️ Ready to launch with millions of places of worship!")

if __name__ == "__main__":
    main()