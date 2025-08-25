#!/usr/bin/env python3
"""
Convert actual territorial authority shapefile to proper GeoJSON
Uses GDAL/OGR to read real geometry instead of rectangular approximations
"""

import json
import subprocess
import os
from pathlib import Path

def convert_shapefile_to_geojson():
    """Convert the TA shapefile to GeoJSON using ogr2ogr"""
    
    shapefile_dir = '/Users/joseph/GIT/places-of-worship/statsnz-territorial-authority-2025-SHP'
    shapefile_path = os.path.join(shapefile_dir, 'territorial-authority-2025.shp')
    output_path = '/Users/joseph/GIT/places-of-worship/nz_territorial_authorities_real.geojson'
    
    # Check if shapefile exists
    if not os.path.exists(shapefile_path):
        raise FileNotFoundError(f"Shapefile not found: {shapefile_path}")
    
    print(f"Converting {shapefile_path} to GeoJSON...")
    
    # Use ogr2ogr to convert shapefile to GeoJSON with simplification
    cmd = [
        'ogr2ogr',
        '-f', 'GeoJSON',
        '-t_srs', 'EPSG:4326',  # Ensure WGS84 coordinates
        '-simplify', '0.001',   # Simplify geometry to reduce file size
        '-where', "TA2025_V1_ != '999'",  # Exclude "Area Outside Territorial Authority"
        output_path,
        shapefile_path
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        print(f"Successfully converted shapefile to: {output_path}")
        print(f"ogr2ogr output: {result.stdout}")
        
        # Read and validate the GeoJSON
        with open(output_path, 'r') as f:
            geojson_data = json.load(f)
        
        feature_count = len(geojson_data['features'])
        print(f"Created GeoJSON with {feature_count} territorial authorities")
        
        # Show some sample TA names
        sample_names = []
        for feature in geojson_data['features'][:5]:
            props = feature['properties']
            ta_code = props.get('TA2025_V1_', 'Unknown')
            ta_name = props.get('TA2025_V_1', 'Unknown')
            sample_names.append(f"{ta_name} ({ta_code})")
        
        print("Sample TAs:", ', '.join(sample_names))
        
        # Check file size
        file_size = os.path.getsize(output_path) / 1024
        print(f"File size: {file_size:.1f} KB")
        
        return output_path
        
    except subprocess.CalledProcessError as e:
        print(f"Error running ogr2ogr: {e}")
        print(f"stdout: {e.stdout}")
        print(f"stderr: {e.stderr}")
        return None

def clean_and_standardise_geojson(input_path, output_path):
    """Clean the GeoJSON and standardise property names"""
    
    print(f"Cleaning and standardising {input_path}...")
    
    with open(input_path, 'r') as f:
        geojson = json.load(f)
    
    cleaned_features = []
    
    for feature in geojson['features']:
        props = feature['properties']
        
        # Standardise property names to match our app expectations
        cleaned_props = {
            'TA2025_V1': props.get('TA2025_V1_', ''),
            'TA2025_NAME': props.get('TA2025_V_1', ''),
            'LAND_AREA': props.get('LAND_AREA_', 0)
        }
        
        # Skip invalid entries
        if not cleaned_props['TA2025_V1'] or cleaned_props['TA2025_V1'] == '999':
            continue
        
        cleaned_feature = {
            'type': 'Feature',
            'properties': cleaned_props,
            'geometry': feature['geometry']
        }
        
        cleaned_features.append(cleaned_feature)
    
    # Create final GeoJSON
    final_geojson = {
        'type': 'FeatureCollection',
        'features': cleaned_features
    }
    
    # Save cleaned version
    with open(output_path, 'w') as f:
        json.dump(final_geojson, f, indent=2, ensure_ascii=False)
    
    print(f"Saved cleaned GeoJSON with {len(cleaned_features)} TAs to: {output_path}")
    file_size = os.path.getsize(output_path) / 1024
    print(f"Final file size: {file_size:.1f} KB")
    
    return output_path

def main():
    """Main conversion process"""
    
    print("Converting territorial authority shapefile to proper GeoJSON boundaries...")
    
    try:
        # Convert shapefile to raw GeoJSON
        raw_geojson = convert_shapefile_to_geojson()
        if not raw_geojson:
            print("Failed to convert shapefile")
            return
        
        # Clean and standardise the GeoJSON
        final_output = '/Users/joseph/GIT/places-of-worship/nz_territorial_authorities_proper.geojson'
        clean_and_standardise_geojson(raw_geojson, final_output)
        
        print(f"\n✅ Successfully created proper TA boundaries: {final_output}")
        print("This file contains real territorial authority shapes, not rectangular approximations")
        
        # Clean up intermediate file
        if os.path.exists(raw_geojson):
            os.remove(raw_geojson)
            print("Cleaned up intermediate file")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()