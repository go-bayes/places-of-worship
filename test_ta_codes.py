#!/usr/bin/env python3
# language: python
# comments: lower case
# purpose: validate TA code mappings between GeoJSON boundaries and census data

import json
import os

def validate_ta_codes():
    """test TA code mappings between boundaries and census data"""
    print("🔍 validating TA code mappings...")
    
    # load territorial authority boundaries
    try:
        with open('territorial_authorities.geojson', 'r') as f:
            boundaries = json.load(f)
        print(f"✓ loaded {len(boundaries['features'])} territorial authorities from GeoJSON")
    except FileNotFoundError:
        print("❌ territorial_authorities.geojson not found")
        return False
    
    # load census data
    try:
        with open('ta_aggregated_data.json', 'r') as f:
            census = json.load(f)
        print(f"✓ loaded {len(census)} territorial authorities from census data")
    except FileNotFoundError:
        print("❌ ta_aggregated_data.json not found")
        return False
    
    # extract TA code mappings from app.js
    ta_code_mapping = {
        '001': '012',  # far north district -> far north
        '068': '058',  # waitaki district -> waitaki
        '069': '006',  # central otago district -> central otago
        '070': '038',  # queenstown-lakes district -> queenstown-lakes
        '071': '011',  # dunedin city -> dunedin
        '072': '010',  # clutha district -> clutha
        '073': '046',  # southland district -> southland
        '074': '014',  # gore district -> gore
        '075': '021',  # invercargill city -> invercargill
        '076': '002'   # auckland -> auckland
    }
    
    # get all TA codes from boundaries
    boundary_codes = set()
    boundary_names = {}
    for feature in boundaries['features']:
        ta_code = feature['properties'].get('TA2025_V1', 'unknown')
        ta_name = feature['properties'].get('TA2025_NAME', 'unknown')
        boundary_codes.add(ta_code)
        boundary_names[ta_code] = ta_name
    
    print(f"✓ found {len(boundary_codes)} unique TA codes in boundaries")
    
    # get all TA codes from census
    census_codes = set(census.keys())
    print(f"✓ found {len(census_codes)} TA codes in census data")
    
    # check mapping coverage
    print("\n🔍 checking TA code mappings...")
    missing_mappings = []
    working_mappings = []
    
    for boundary_code in sorted(boundary_codes):
        boundary_name = boundary_names[boundary_code]
        
        # check if code needs mapping
        if boundary_code in ta_code_mapping:
            census_code = ta_code_mapping[boundary_code]
            if census_code in census_codes:
                census_name = census[census_code]['2018']['name'] if '2018' in census[census_code] else 'unknown'
                working_mappings.append(f"  ✓ {boundary_code} ({boundary_name}) -> {census_code} ({census_name})")
            else:
                missing_mappings.append(f"  ❌ {boundary_code} ({boundary_name}) maps to {census_code} but no census data found")
        else:
            # check if direct match exists
            if boundary_code in census_codes:
                census_name = census[boundary_code]['2018']['name'] if '2018' in census[boundary_code] else 'unknown'
                working_mappings.append(f"  ✓ {boundary_code} ({boundary_name}) -> direct match ({census_name})")
            else:
                missing_mappings.append(f"  ❌ {boundary_code} ({boundary_name}) -> no mapping and no direct match")
    
    # report results
    print(f"\n✅ working mappings ({len(working_mappings)}):")
    for mapping in working_mappings:
        print(mapping)
    
    if missing_mappings:
        print(f"\n❌ missing mappings ({len(missing_mappings)}):")
        for mapping in missing_mappings:
            print(mapping)
        return False
    else:
        print(f"\n🎉 all {len(boundary_codes)} TA codes have valid mappings!")
        return True

if __name__ == "__main__":
    # change to project directory
    os.chdir('/Users/joseph/GIT/places-of-worship')
    
    if validate_ta_codes():
        print("\n✅ TA code validation passed")
        exit(0)
    else:
        print("\n❌ TA code validation failed")
        exit(1)