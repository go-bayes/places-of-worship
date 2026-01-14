#!/usr/bin/env python3

import requests
import json
import time
import logging
from pathlib import Path

# setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

def extract_places_by_bbox(country_code, country_name, bbox, religion="christian"):
    """extract places using bounding box"""
    logging.info(f"🌍 extracting {country_name} ({country_code})")
    
    # check if file already exists
    output_file = Path(f"data/global/{country_code.lower()}_places.json")
    if output_file.exists():
        logging.info(f"📁 file already exists for {country_code}")
        with open(output_file) as f:
            places = json.load(f)
        return len(places)
    
    # overpass query with bounding box
    overpass_url = "https://overpass-api.de/api/interpreter"
    
    south, west, north, east = bbox
    
    query = f"""
    [out:json][timeout:60];
    (
      nwr["amenity"="place_of_worship"]({south},{west},{north},{east});
      nwr["building"~"^(church|cathedral|chapel|mosque|synagogue|temple)$"]({south},{west},{north},{east});
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
                    'religion': element.get('tags', {}).get('religion', religion),
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

# territories with bounding boxes (south, west, north, east)
territories = [
    ('AS', 'American Samoa', (-14.7, -171.2, -14.1, -169.4)),
    ('AW', 'Aruba', (12.4, -70.1, 12.7, -69.8)), 
    ('AX', 'Åland Islands', (59.9, 19.3, 60.5, 21.4)),
    ('BL', 'Saint Barthélemy', (17.8, -62.95, 17.98, -62.79)),
    ('BQ', 'Caribbean Netherlands', (12.0, -68.5, 17.7, -62.9)),
    ('CW', 'Curaçao', (11.9, -69.2, 12.4, -68.7)),
    ('GF', 'French Guiana', (2.1, -54.6, 5.8, -51.6)),
    ('GP', 'Guadeloupe', (15.8, -61.9, 16.5, -61.0)),
    ('GU', 'Guam', (13.2, 144.6, 13.7, 145.0)),
    ('HK', 'Hong Kong', (22.15, 113.8, 22.6, 114.5)),
    ('MF', 'Saint Martin', (18.0, -63.2, 18.2, -62.95)),
    ('MO', 'Macao', (22.1, 113.5, 22.22, 113.6)),
    ('MP', 'Northern Mariana Islands', (14.1, 144.9, 20.6, 146.1)),
    ('MQ', 'Martinique', (14.4, -61.3, 14.9, -60.8)),
    ('NC', 'New Caledonia', (-22.7, 164.0, -19.5, 167.2)),
    ('PF', 'French Polynesia', (-27.9, -154.0, -7.9, -134.3)),
    ('PM', 'Saint Pierre and Miquelon', (46.7, -56.5, 47.2, -56.1)),
    ('PR', 'Puerto Rico', (17.9, -67.3, 18.5, -65.2)),
    ('PS', 'Palestine', (31.2, 34.2, 32.6, 35.6)),
    ('RE', 'Réunion', (-21.4, 55.2, -20.9, 55.8)),
    ('SH', 'Saint Helena', (-16.1, -5.8, -15.8, -5.6)),
    ('SX', 'Sint Maarten', (18.0, -63.2, 18.1, -62.95)),
    ('TK', 'Tokelau', (-9.7, -172.8, -8.3, -171.1)),
    ('VI', 'U.S. Virgin Islands', (17.6, -65.1, 18.5, -64.6)),
    ('WF', 'Wallis and Futuna', (-14.8, -178.3, -13.1, -176.1)),
    ('YT', 'Mayotte', (-13.0, 45.0, -12.6, 45.3))
]

def main():
    total_places = 0
    successful_extractions = 0
    
    for code, name, bbox in territories:
        places_count = extract_places_by_bbox(code, name, bbox)
        total_places += places_count
        if places_count > 0:
            successful_extractions += 1
        
        # small delay between requests
        time.sleep(3)
    
    logging.info(f"🎯 extraction complete!")
    logging.info(f"✅ successfully extracted from {successful_extractions}/{len(territories)} territories")
    logging.info(f"📊 total places: {total_places:,}")

if __name__ == "__main__":
    main()