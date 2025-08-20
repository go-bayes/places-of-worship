#!/usr/bin/env python3
"""
Optimize places of worship dataset for web loading
Reduces file size by removing verbose properties and reducing coordinate precision
"""

import json
import math

def optimize_places_data(input_file, output_file):
    """
    Optimize GeoJSON for web loading by:
    1. Removing verbose OSM metadata
    2. Reducing coordinate precision
    3. Keeping only essential properties
    """
    
    with open(input_file, 'r') as f:
        data = json.load(f)
    
    # Keep essential metadata but make it more concise
    optimized_data = {
        "type": "FeatureCollection",
        "metadata": {
            "title": "Places of Worship - New Zealand", 
            "total_places": data['metadata']['total_places'],
            "source": "OpenStreetMap",
            "license": "ODbL"
        },
        "features": []
    }
    
    for feature in data['features']:
        # Round coordinates to 6 decimal places (~1m precision)
        coords = feature['geometry']['coordinates']
        rounded_coords = [round(coords[0], 6), round(coords[1], 6)]
        
        # Keep only essential properties
        optimized_feature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": rounded_coords
            },
            "properties": {
                "name": feature['properties'].get('name', 'Unknown'),
                "denomination": feature['properties']['denomination'],
                "confidence": round(feature['properties']['confidence'], 2),
                "osm_id": feature['properties']['osm_id']
            }
        }
        
        # Add optional properties if they exist
        if feature['properties'].get('website'):
            optimized_feature['properties']['website'] = feature['properties']['website']
        
        if feature['properties'].get('phone'):
            optimized_feature['properties']['phone'] = feature['properties']['phone']
            
        optimized_data['features'].append(optimized_feature)
    
    # Save optimized data
    with open(output_file, 'w') as f:
        json.dump(optimized_data, f, separators=(',', ':'))  # Compact JSON
    
    # Report size reduction
    original_size = len(json.dumps(data, separators=(',', ':')))
    optimized_size = len(json.dumps(optimized_data, separators=(',', ':')))
    reduction = (1 - optimized_size / original_size) * 100
    
    print(f"Original size: {original_size:,} bytes ({original_size/1024/1024:.1f} MB)")
    print(f"Optimized size: {optimized_size:,} bytes ({optimized_size/1024/1024:.1f} MB)")
    print(f"Size reduction: {reduction:.1f}%")
    print(f"Saved optimized data to: {output_file}")

if __name__ == "__main__":
    optimize_places_data(
        "data/nz_places.geojson",
        "data/nz_places_optimized.geojson"
    )