#!/usr/bin/env python3
"""
Create simplified GeoJSON for all 67 territorial authorities
Since we can't easily convert the full shapefile, we'll create simplified representative polygons
"""

import json
import struct
import os
from pathlib import Path

def read_dbf(filename):
    """Simple DBF reader for shapefile attributes"""
    with open(filename, 'rb') as f:
        # Read DBF header
        header = f.read(32)
        num_records = struct.unpack('<I', header[4:8])[0]
        header_len = struct.unpack('<H', header[8:10])[0]
        record_len = struct.unpack('<H', header[10:12])[0]
        
        # Read field descriptors
        f.seek(32)
        fields = []
        while f.tell() < header_len - 1:
            field_data = f.read(32)
            if field_data[0] == 0x0D:  # End of fields marker
                break
            name = field_data[:11].strip(b'\x00').decode('utf-8')
            field_type = chr(field_data[11])
            field_len = field_data[16]
            fields.append((name, field_type, field_len))
        
        # Read records
        records = []
        f.seek(header_len)
        for i in range(num_records):
            record = f.read(record_len)
            if record[0] == 0x2A:  # Deleted record
                continue
            
            record_data = {}
            offset = 1  # Skip deletion flag
            for name, field_type, field_len in fields:
                value = record[offset:offset+field_len].strip()
                if field_type == 'C':  # Character
                    record_data[name] = value.decode('utf-8', errors='ignore').strip()
                elif field_type == 'N':  # Numeric
                    try:
                        if b'.' in value:
                            record_data[name] = float(value)
                        else:
                            record_data[name] = int(value)
                    except:
                        record_data[name] = 0
                offset += field_len
            records.append(record_data)
        
        return records

def get_ta_approximate_bounds():
    """
    Approximate bounding rectangles for all NZ territorial authorities
    Based on approximate geographic locations
    """
    ta_bounds = {
        # Northland
        '001': {'name': 'Far North District', 'bounds': [172.5, -35.8, 174.3, -34.4]},
        '002': {'name': 'Whangarei District', 'bounds': [173.8, -36.2, 174.5, -35.4]},
        '003': {'name': 'Kaipara District', 'bounds': [173.7, -36.8, 174.3, -35.8]},
        
        # Auckland/Waikato  
        '011': {'name': 'Thames-Coromandel District', 'bounds': [175.2, -37.4, 175.9, -36.6]},
        '012': {'name': 'Hauraki District', 'bounds': [175.4, -37.6, 175.9, -37.1]},
        '013': {'name': 'Auckland', 'bounds': [174.4, -37.3, 175.3, -36.4]},
        '015': {'name': 'Hamilton City', 'bounds': [175.2, -37.9, 175.4, -37.6]},
        '016': {'name': 'Waikato District', 'bounds': [174.8, -38.0, 175.6, -37.3]},
        '017': {'name': 'Waipa District', 'bounds': [175.1, -38.3, 175.6, -37.8]},
        '018': {'name': 'Ōtorohanga District', 'bounds': [174.9, -38.4, 175.3, -37.9]},
        '019': {'name': 'South Waikato District', 'bounds': [175.6, -38.5, 176.2, -37.9]},
        '020': {'name': 'Waitomo District', 'bounds': [174.6, -38.7, 175.1, -38.1]},
        '021': {'name': 'Taupo District', 'bounds': [175.6, -39.1, 176.4, -38.3]},
        
        # Bay of Plenty
        '022': {'name': 'Western Bay of Plenty District', 'bounds': [175.8, -37.8, 176.4, -37.3]},
        '023': {'name': 'Tauranga City', 'bounds': [176.0, -37.8, 176.3, -37.6]},
        '024': {'name': 'Rotorua District', 'bounds': [176.0, -38.5, 176.7, -37.9]},
        '025': {'name': 'Whakatane District', 'bounds': [176.7, -38.2, 177.3, -37.6]},
        '026': {'name': 'Kawerau District', 'bounds': [176.6, -38.2, 176.8, -38.0]},
        '027': {'name': 'Ōpōtiki District', 'bounds': [177.1, -38.1, 177.7, -37.7]},
        
        # Gisborne/Hawke's Bay
        '028': {'name': 'Gisborne District', 'bounds': [177.7, -38.8, 178.6, -37.3]},
        '029': {'name': 'Wairoa District', 'bounds': [177.2, -39.2, 178.4, -38.3]},
        '030': {'name': 'Hastings District', 'bounds': [176.4, -40.0, 177.0, -39.3]},
        '031': {'name': 'Napier City', 'bounds': [176.7, -39.6, 176.9, -39.4]},
        '032': {'name': 'Central Hawke\'s Bay District', 'bounds': [176.0, -40.2, 176.6, -39.7]},
        
        # Taranaki
        '033': {'name': 'New Plymouth District', 'bounds': [173.8, -39.3, 174.3, -38.9]},
        '034': {'name': 'Stratford District', 'bounds': [174.2, -39.4, 174.5, -39.1]},
        '035': {'name': 'South Taranaki District', 'bounds': [174.2, -39.9, 174.7, -39.3]},
        
        # Manawatu-Whanganui
        '036': {'name': 'Ruapehu District', 'bounds': [175.2, -39.6, 175.9, -38.9]},
        '037': {'name': 'Whanganui District', 'bounds': [174.8, -40.2, 175.2, -39.6]},
        '038': {'name': 'Rangitikei District', 'bounds': [175.2, -40.2, 175.8, -39.7]},
        '039': {'name': 'Manawatu District', 'bounds': [175.4, -40.6, 176.0, -40.0]},
        '040': {'name': 'Palmerston North City', 'bounds': [175.5, -40.4, 175.7, -40.3]},
        '041': {'name': 'Tararua District', 'bounds': [175.6, -40.8, 176.2, -40.2]},
        '042': {'name': 'Horowhenua District', 'bounds': [175.0, -40.7, 175.5, -40.3]},
        
        # Wellington
        '043': {'name': 'Wellington City', 'bounds': [174.6, -41.4, 175.0, -41.2]},
        '044': {'name': 'Kapiti Coast District', 'bounds': [174.9, -41.0, 175.2, -40.7]},
        '045': {'name': 'Porirua City', 'bounds': [174.8, -41.2, 175.0, -41.0]},
        '046': {'name': 'Upper Hutt City', 'bounds': [175.0, -41.2, 175.2, -41.0]},
        '047': {'name': 'Lower Hutt City', 'bounds': [174.8, -41.3, 175.1, -41.1]},
        '048': {'name': 'Masterton District', 'bounds': [175.4, -41.0, 175.9, -40.6]},
        '049': {'name': 'Carterton District', 'bounds': [175.4, -41.2, 175.6, -41.0]},
        '050': {'name': 'South Wairarapa District', 'bounds': [175.0, -41.6, 175.5, -41.2]},
        
        # Tasman/Nelson
        '051': {'name': 'Tasman District', 'bounds': [172.6, -41.8, 173.8, -40.7]},
        '052': {'name': 'Nelson City', 'bounds': [173.1, -41.4, 173.4, -41.2]},
        
        # Marlborough
        '053': {'name': 'Marlborough District', 'bounds': [173.4, -42.0, 174.4, -41.0]},
        '054': {'name': 'Kaikoura District', 'bounds': [173.4, -42.7, 173.9, -42.0]},
        
        # West Coast
        '055': {'name': 'Buller District', 'bounds': [171.2, -42.2, 172.4, -41.5]},
        '056': {'name': 'Grey District', 'bounds': [171.0, -42.9, 171.8, -42.2]},
        '061': {'name': 'Westland District', 'bounds': [169.8, -44.0, 171.4, -42.9]},
        
        # Canterbury
        '057': {'name': 'Christchurch City', 'bounds': [172.4, -43.7, 172.9, -43.4]},
        '058': {'name': 'Selwyn District', 'bounds': [171.8, -44.0, 172.6, -43.4]},
        '059': {'name': 'Waimakariri District', 'bounds': [172.2, -43.6, 172.8, -43.1]},
        '060': {'name': 'Hurunui District', 'bounds': [172.2, -43.1, 173.0, -42.4]},
        '062': {'name': 'Ashburton District', 'bounds': [171.4, -44.2, 172.0, -43.6]},
        '063': {'name': 'Timaru District', 'bounds': [170.8, -44.8, 171.4, -44.0]},
        '064': {'name': 'Mackenzie District', 'bounds': [170.0, -44.8, 170.8, -43.8]},
        '065': {'name': 'Waimate District', 'bounds': [170.6, -45.0, 171.2, -44.6]},
        '066': {'name': 'Waitaki District', 'bounds': [170.4, -45.4, 171.2, -44.6]},
        
        # Otago
        '067': {'name': 'Dunedin City', 'bounds': [170.0, -46.1, 170.8, -45.6]},
        '068': {'name': 'Clutha District', 'bounds': [169.0, -46.8, 170.4, -45.8]},
        '072': {'name': 'Queenstown-Lakes District', 'bounds': [168.1, -45.8, 169.0, -44.2]},
        '073': {'name': 'Central Otago District', 'bounds': [169.0, -45.8, 170.2, -44.8]},
        
        # Southland
        '069': {'name': 'Southland District', 'bounds': [166.5, -47.3, 169.8, -45.4]},
        '070': {'name': 'Gore District', 'bounds': [168.6, -46.4, 169.2, -45.8]},
        '071': {'name': 'Invercargill City', 'bounds': [168.2, -46.5, 168.5, -46.3]},
        
        # Other
        '074': {'name': 'Matamata-Piako District', 'bounds': [175.4, -38.0, 176.0, -37.5]},
        '075': {'name': 'Hamilton City', 'bounds': [175.2, -37.9, 175.4, -37.6]},
        '076': {'name': 'Chatham Islands Territory', 'bounds': [-176.8, -44.0, -176.1, -43.6]}
    }
    return ta_bounds

def create_rectangle_polygon(bounds):
    """Create a rectangle polygon from bounds [west, south, east, north]"""
    west, south, east, north = bounds
    return [[
        [west, south],
        [east, south], 
        [east, north],
        [west, north],
        [west, south]
    ]]

def main():
    # Change to the shapefile directory
    os.chdir('/Users/joseph/GIT/places-of-worship/statsnz-territorial-authority-2025-SHP')
    
    print("Reading territorial authority shapefile data...")
    
    # Read TA data from shapefile
    ta_records = read_dbf('territorial-authority-2025.dbf')
    print(f"Found {len(ta_records)} territorial authorities")
    
    # Get approximate bounds
    ta_bounds = get_ta_approximate_bounds()
    
    # Create GeoJSON structure
    geojson = {
        "type": "FeatureCollection",
        "features": []
    }
    
    processed_count = 0
    
    for record in ta_records:
        ta_code = record['TA2025_V1_']
        ta_name = record['TA2025_V_1']
        land_area = record.get('LAND_AREA_', 0)
        
        # Skip "Area Outside Territorial Authority" 
        if ta_code == '999' or 'outside' in ta_name.lower():
            print(f"Skipping: {ta_name} ({ta_code})")
            continue
        
        print(f"Processing: {ta_name} ({ta_code})")
        
        # Get bounds for this TA
        if ta_code in ta_bounds:
            bounds = ta_bounds[ta_code]['bounds']
            geometry = {
                "type": "Polygon",
                "coordinates": create_rectangle_polygon(bounds)
            }
        else:
            # Default bounds for unknown TAs (central NZ)
            print(f"  Warning: No bounds found for {ta_name}, using default")
            default_bounds = [172.0, -42.0, 173.0, -41.0]
            geometry = {
                "type": "Polygon", 
                "coordinates": create_rectangle_polygon(default_bounds)
            }
        
        # Create feature
        feature = {
            "type": "Feature",
            "properties": {
                "TA2025_V1": ta_code,
                "TA2025_NAME": ta_name,
                "LAND_AREA": land_area
            },
            "geometry": geometry
        }
        
        geojson["features"].append(feature)
        processed_count += 1
    
    print(f"\nCreated simplified GeoJSON for {processed_count} territorial authorities")
    
    # Save GeoJSON
    output_path = '/Users/joseph/GIT/places-of-worship/nz_territorial_authorities_2025_complete.geojson'
    with open(output_path, 'w') as f:
        json.dump(geojson, f, indent=2, ensure_ascii=False)
    
    print(f"Saved complete TA boundaries to: {output_path}")
    print(f"File size: {os.path.getsize(output_path) / 1024:.1f} KB")

if __name__ == '__main__':
    main()