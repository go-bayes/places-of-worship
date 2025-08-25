#!/usr/bin/env python3
"""
Create web-optimised TA boundaries from the proper GeoJSON
Simplifies geometry and standardises property names
"""

import json
import os

def simplify_coordinates(coords, tolerance=0.01):
    """
    Simple coordinate simplification using Douglas-Peucker-like approach
    Remove points that are very close together
    """
    if not coords or len(coords) < 3:
        return coords
    
    simplified = [coords[0]]  # Always keep first point
    
    for i in range(1, len(coords) - 1):
        prev = simplified[-1]
        curr = coords[i]
        
        # Calculate distance between points
        if isinstance(curr, list) and len(curr) >= 2:
            dx = abs(curr[0] - prev[0])
            dy = abs(curr[1] - prev[1])
            distance = (dx**2 + dy**2)**0.5
            
            # Only keep point if it's far enough from previous
            if distance > tolerance:
                simplified.append(curr)
    
    simplified.append(coords[-1])  # Always keep last point
    return simplified

def simplify_geometry(geometry, tolerance=0.01):
    """Simplify a GeoJSON geometry"""
    if geometry['type'] == 'Polygon':
        simplified_coords = []
        for ring in geometry['coordinates']:
            simplified_ring = simplify_coordinates(ring, tolerance)
            if len(simplified_ring) >= 4:  # Minimum for a polygon
                simplified_coords.append(simplified_ring)
        
        if simplified_coords:
            return {
                'type': 'Polygon',
                'coordinates': simplified_coords
            }
    
    elif geometry['type'] == 'MultiPolygon':
        simplified_coords = []
        for polygon in geometry['coordinates']:
            simplified_polygon = []
            for ring in polygon:
                simplified_ring = simplify_coordinates(ring, tolerance)
                if len(simplified_ring) >= 4:
                    simplified_polygon.append(simplified_ring)
            
            if simplified_polygon:
                simplified_coords.append(simplified_polygon)
        
        if simplified_coords:
            return {
                'type': 'MultiPolygon', 
                'coordinates': simplified_coords
            }
    
    # Return original if can't simplify
    return geometry

def main():
    """Create simplified TA boundaries for web use"""
    
    input_path = '/Users/joseph/GIT/places-of-worship/nz_territorial_authorities_web.geojson'
    output_path = '/Users/joseph/GIT/places-of-worship/nz_territorial_authorities_simplified.geojson'
    
    print(f"Reading {input_path}...")
    
    # Check input file size
    input_size = os.path.getsize(input_path) / (1024 * 1024)
    print(f"Input file size: {input_size:.1f} MB")
    
    with open(input_path, 'r') as f:
        geojson = json.load(f)
    
    print(f"Processing {len(geojson['features'])} territorial authorities...")
    
    simplified_features = []
    
    for i, feature in enumerate(geojson['features']):
        props = feature['properties']
        
        # Skip invalid TAs
        ta_code = props.get('TA2025_V1_', '')
        ta_name = props.get('TA2025_V_1', '')
        
        if not ta_code or ta_code == '999' or 'outside' in ta_name.lower():
            continue
        
        # Standardise property names
        clean_props = {
            'TA2025_V1': ta_code,
            'TA2025_NAME': ta_name,
            'LAND_AREA': props.get('LAND_AREA_', 0)
        }
        
        # Simplify geometry aggressively
        simplified_geometry = simplify_geometry(feature['geometry'], tolerance=0.02)
        
        simplified_feature = {
            'type': 'Feature',
            'properties': clean_props,
            'geometry': simplified_geometry
        }
        
        simplified_features.append(simplified_feature)
        
        if (i + 1) % 10 == 0:
            print(f"  Processed {i + 1} features...")
    
    # Create final GeoJSON
    final_geojson = {
        'type': 'FeatureCollection',
        'features': simplified_features
    }
    
    print(f"Writing simplified GeoJSON with {len(simplified_features)} TAs...")
    
    with open(output_path, 'w') as f:
        json.dump(final_geojson, f, separators=(',', ':'))  # No spaces for smaller file
    
    # Check output file size
    output_size = os.path.getsize(output_path) / (1024 * 1024)
    compression_ratio = (1 - output_size / input_size) * 100
    
    print(f"✅ Created simplified TA boundaries: {output_path}")
    print(f"Output file size: {output_size:.1f} MB")
    print(f"Compression: {compression_ratio:.1f}% reduction")
    
    # Show sample TA names
    sample_names = []
    for feature in final_geojson['features'][:5]:
        props = feature['properties']
        sample_names.append(f"{props['TA2025_NAME']} ({props['TA2025_V1']})")
    
    print("Sample TAs:", ', '.join(sample_names))

if __name__ == '__main__':
    main()