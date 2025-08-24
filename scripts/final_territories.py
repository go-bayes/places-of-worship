#!/usr/bin/env python3

import requests
import json
import time
import logging
from pathlib import Path
import sys

# setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

def extract_places(country_code, country_name):
    """extract places for a specific country"""
    logging.info(f"🌍 extracting {country_name} ({country_code})")
    
    # check if file already exists
    output_file = Path(f"data/global/{country_code.lower()}_places.json")
    if output_file.exists():
        logging.info(f"📁 file already exists for {country_code}")
        with open(output_file) as f:
            places = json.load(f)
        return len(places)
    
    # overpass query
    overpass_url = "https://overpass-api.de/api/interpreter"
    
    query = f"""
    [out:json][timeout:60];
    (
      nwr["amenity"~"^(place_of_worship)$"]["ISO3166-1"="{country_code}"];
      nwr["landuse"="cemetery"]["ISO3166-1"="{country_code}"];
      nwr["amenity"="grave_yard"]["ISO3166-1"="{country_code}"];
      nwr["building"="church"]["ISO3166-1"="{country_code}"];
      nwr["building"="cathedral"]["ISO3166-1"="{country_code}"];
      nwr["building"="chapel"]["ISO3166-1"="{country_code}"];
      nwr["building"="mosque"]["ISO3166-1"="{country_code}"];
      nwr["building"="synagogue"]["ISO3166-1"="{country_code}"];
      nwr["building"="temple"]["ISO3166-1"="{country_code}"];
    );
    out center;
    """
    
    try:
        response = requests.post(overpass_url, data=query, timeout=120)
        response.raise_for_status()
        data = response.json()
        
        places = []
        for element in data.get('elements', []):
            if 'lat' in element and 'lng' in element:
                place = {
                    'lat': element['lat'],
                    'lng': element['lng'],
                    'name': element.get('tags', {}).get('name', 'Unnamed'),
                    'religion': element.get('tags', {}).get('religion', 'unknown'),
                    'country': country_code
                }
                
                denomination = element.get('tags', {}).get('denomination')
                if denomination:
                    place['denomination'] = denomination
                
                places.append(place)
        
        # save to file
        output_file.parent.mkdir(parents=True, exist_ok=True)
        with open(output_file, 'w') as f:
            json.dump(places, f, indent=2)
        
        logging.info(f"✅ {country_code}: {len(places)} places extracted")
        return len(places)
        
    except Exception as e:
        logging.error(f"❌ failed to extract {country_code}: {e}")
        return 0

# remaining territories to extract
territories = [
    ('AS', 'American Samoa'),
    ('AW', 'Aruba'), 
    ('AX', 'Åland Islands'),
    ('BL', 'Saint Barthélemy'),
    ('BQ', 'Caribbean Netherlands'),
    ('CW', 'Curaçao'),
    ('GF', 'French Guiana'),
    ('GP', 'Guadeloupe'),
    ('GU', 'Guam'),
    ('HK', 'Hong Kong'),
    ('MF', 'Saint Martin'),
    ('MO', 'Macao'),
    ('MP', 'Northern Mariana Islands'),
    ('MQ', 'Martinique'),
    ('NC', 'New Caledonia'),
    ('PF', 'French Polynesia'),
    ('PM', 'Saint Pierre and Miquelon'),
    ('PR', 'Puerto Rico'),
    ('PS', 'Palestine'),
    ('RE', 'Réunion'),
    ('SH', 'Saint Helena'),
    ('SX', 'Sint Maarten'),
    ('TK', 'Tokelau'),
    ('VI', 'U.S. Virgin Islands'),
    ('WF', 'Wallis and Futuna'),
    ('YT', 'Mayotte')
]

def main():
    total_places = 0
    successful_extractions = 0
    
    for code, name in territories:
        places_count = extract_places(code, name)
        total_places += places_count
        if places_count > 0:
            successful_extractions += 1
        
        # small delay between requests
        time.sleep(2)
    
    logging.info(f"🎯 extraction complete!")
    logging.info(f"✅ successfully extracted from {successful_extractions}/{len(territories)} territories")
    logging.info(f"📊 total places: {total_places:,}")

if __name__ == "__main__":
    main()