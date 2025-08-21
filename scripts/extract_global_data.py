#!/usr/bin/env python3
"""
Global Places of Worship Data Extraction
Fast afternoon implementation - extract ~2M places worldwide
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

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class GlobalPlacesExtractor:
    def __init__(self, output_dir: str = "data/global"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # High-coverage countries for 2M target
        self.priority_countries = [
            'US',   # ~300K places
            'DE',   # ~80K places  
            'GB',   # ~50K places
            'FR',   # ~60K places
            'IT',   # ~70K places
            'ES',   # ~40K places
            'PL',   # ~30K places
            'NL',   # ~15K places
            'BE',   # ~10K places
            'AU',   # ~20K places
            'NZ',   # ~3K places (we have this)
            'CA',   # ~40K places
            'BR',   # ~100K places
            'MX',   # ~80K places
            'IN',   # ~200K places
            'PH',   # ~50K places
            'ZA',   # ~30K places
            'KE',   # ~20K places
            'NG',   # ~50K places
            'TH',   # ~40K places
            'VN',   # ~30K places
            'KR',   # ~20K places
            'JP',   # ~80K places
        ]
        
        self.base_overpass_url = "https://overpass-api.de/api/interpreter"
        
    def build_country_query(self, country_code: str) -> str:
        """Build Overpass QL query for places of worship in a country"""
        return f"""
        [out:json][timeout:900];
        area["ISO3166-1"="{country_code}"]->.country;
        (
          nwr["amenity"="place_of_worship"](area.country);
          nwr["building"="church"](area.country);
          nwr["building"="mosque"](area.country);
          nwr["building"="temple"](area.country);
          nwr["building"="synagogue"](area.country);
          nwr["building"="chapel"](area.country);
          nwr["landuse"="religious"](area.country);
        );
        out geom;
        """
    
    def extract_country_data(self, country_code: str) -> List[Dict]:
        """Extract places of worship for a single country"""
        logger.info(f"Starting extraction for {country_code}")
        
        # Check if we already have this data
        cache_file = self.output_dir / f"{country_code.lower()}_raw.json"
        if cache_file.exists():
            logger.info(f"Loading cached data for {country_code}")
            with open(cache_file, 'r') as f:
                return json.load(f)
        
        query = self.build_country_query(country_code)
        
        try:
            response = requests.post(
                self.base_overpass_url,
                data=query,
                timeout=1200,  # 20 minutes max
                headers={'User-Agent': 'PlacesOfWorshipResearch/1.0'}
            )
            response.raise_for_status()
            
            data = response.json()
            elements = data.get('elements', [])
            
            logger.info(f"Extracted {len(elements)} raw elements for {country_code}")
            
            # Cache raw data
            with open(cache_file, 'w') as f:
                json.dump(elements, f)
            
            return elements
            
        except requests.exceptions.Timeout:
            logger.error(f"Timeout extracting {country_code}")
            return []
        except Exception as e:
            logger.error(f"Error extracting {country_code}: {e}")
            return []
    
    def process_osm_element(self, element: Dict, country_code: str) -> Dict:
        """Convert OSM element to standardized place record"""
        tags = element.get('tags', {})
        
        # Extract coordinates based on element type
        if element['type'] == 'node':
            lat, lng = element['lat'], element['lon']
        elif element['type'] == 'way' and 'center' in element:
            lat, lng = element['center']['lat'], element['center']['lon']
        elif element['type'] == 'relation' and 'center' in element:
            lat, lng = element['center']['lat'], element['center']['lon']
        else:
            return None
        
        # Extract name with fallbacks
        name = (tags.get('name') or 
                tags.get('name:en') or 
                tags.get('official_name') or 
                f"Place of Worship {element['id']}")
        
        # Determine religion and denomination
        religion = tags.get('religion', 'unknown')
        denomination = tags.get('denomination', '')
        
        # Calculate confidence score
        confidence = self.calculate_confidence(tags)
        
        return {
            'id': f"{element['type'][0]}{element['id']}",  # n123, w456, r789
            'osm_id': element['id'],
            'osm_type': element['type'],
            'lat': lat,
            'lng': lng,
            'name': name,
            'religion': religion,
            'denomination': denomination,
            'confidence': confidence,
            'country_code': country_code,
            'type': 'churches',  # Consistent with religion repo
            'tags': tags,
            'website': tags.get('website', ''),
            'phone': tags.get('phone', ''),
            'address': self.extract_address(tags)
        }
    
    def calculate_confidence(self, tags: Dict) -> float:
        """Calculate confidence score based on OSM data completeness"""
        score = 0.5  # Base score
        
        # Name availability
        if tags.get('name'):
            score += 0.2
        
        # Religion specified
        if tags.get('religion') and tags['religion'] != 'unknown':
            score += 0.1
        
        # Denomination specified
        if tags.get('denomination'):
            score += 0.1
        
        # Contact information
        if tags.get('website') or tags.get('phone'):
            score += 0.05
        
        # Address information
        if any(tags.get(f'addr:{field}') for field in ['street', 'city', 'postcode']):
            score += 0.05
        
        return min(1.0, score)
    
    def extract_address(self, tags: Dict) -> str:
        """Extract readable address from OSM tags"""
        address_parts = []
        
        if tags.get('addr:housenumber') and tags.get('addr:street'):
            address_parts.append(f"{tags['addr:housenumber']} {tags['addr:street']}")
        elif tags.get('addr:street'):
            address_parts.append(tags['addr:street'])
        
        if tags.get('addr:city'):
            address_parts.append(tags['addr:city'])
        
        if tags.get('addr:postcode'):
            address_parts.append(tags['addr:postcode'])
        
        return ', '.join(address_parts)
    
    def extract_all_countries(self, max_workers: int = 3) -> Dict[str, List[Dict]]:
        """Extract data for all priority countries in parallel"""
        results = {}
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Submit all country extractions
            future_to_country = {
                executor.submit(self.extract_country_data, country): country 
                for country in self.priority_countries
            }
            
            # Collect results as they complete
            for future in as_completed(future_to_country):
                country = future_to_country[future]
                try:
                    raw_elements = future.result()
                    
                    # Process elements into standardized format
                    places = []
                    for element in raw_elements:
                        place = self.process_osm_element(element, country)
                        if place:
                            places.append(place)
                    
                    results[country] = places
                    logger.info(f"Processed {len(places)} places for {country}")
                    
                    # Save country-specific file
                    country_file = self.output_dir / f"{country.lower()}_places.json"
                    with open(country_file, 'w') as f:
                        json.dump(places, f, indent=2)
                    
                except Exception as e:
                    logger.error(f"Failed to process {country}: {e}")
                    results[country] = []
                
                # Rate limiting between countries
                time.sleep(2)
        
        return results
    
    def create_global_parquet(self, country_data: Dict[str, List[Dict]]):
        """Create global parquet file compatible with religion repository API"""
        logger.info("Creating global parquet files...")
        
        # Combine all countries
        all_places = []
        for country, places in country_data.items():
            all_places.extend(places)
        
        logger.info(f"Total places extracted: {len(all_places):,}")
        
        # Convert to GeoDataFrame
        if not all_places:
            logger.error("No places extracted!")
            return
        
        df = pd.DataFrame(all_places)
        
        # Create geometry column
        df['geometry'] = gpd.points_from_xy(df['lng'], df['lat'])
        gdf = gpd.GeoDataFrame(df, crs='EPSG:4326')
        
        # Sort by country and confidence for better query performance
        gdf = gdf.sort_values(['country_code', 'confidence'], ascending=[True, False])
        
        # Save as parquet (compatible with religion repo API)
        parquet_file = self.output_dir / "churches.parquet"
        gdf.to_parquet(parquet_file, index=False)
        
        logger.info(f"Saved {len(gdf):,} places to {parquet_file}")
        
        # Create summary statistics
        stats = {
            'total_places': len(gdf),
            'by_country': gdf['country_code'].value_counts().to_dict(),
            'by_religion': gdf['religion'].value_counts().to_dict(),
            'confidence_stats': {
                'mean': float(gdf['confidence'].mean()),
                'min': float(gdf['confidence'].min()), 
                'max': float(gdf['confidence'].max()),
                'high_confidence': int((gdf['confidence'] >= 0.8).sum())
            },
            'extraction_date': time.strftime('%Y-%m-%d %H:%M:%S')
        }
        
        with open(self.output_dir / "extraction_stats.json", 'w') as f:
            json.dump(stats, f, indent=2)
        
        logger.info("Extraction statistics:")
        logger.info(f"  Total places: {stats['total_places']:,}")
        logger.info(f"  Countries: {len(stats['by_country'])}")
        logger.info(f"  Mean confidence: {stats['confidence_stats']['mean']:.2f}")
        logger.info(f"  High confidence (≥0.8): {stats['confidence_stats']['high_confidence']:,}")
        
        return parquet_file

def main():
    """Main extraction function"""
    logger.info("Starting global places of worship extraction...")
    
    extractor = GlobalPlacesExtractor()
    
    # Extract from all priority countries
    country_data = extractor.extract_all_countries(max_workers=3)
    
    # Create global parquet file
    parquet_file = extractor.create_global_parquet(country_data)
    
    # File size check for git LFS consideration
    if parquet_file and parquet_file.exists():
        size_mb = parquet_file.stat().st_size / 1024 / 1024
        logger.info(f"Final parquet file size: {size_mb:.1f} MB")
        
        if size_mb > 100:
            logger.warning("⚠️  File > 100MB - consider git LFS or external hosting")
            logger.info("Git LFS setup: git lfs track '*.parquet'")
        
    logger.info("✅ Global extraction complete!")

if __name__ == "__main__":
    main()