#!/usr/bin/env python3
"""
Process official Stats NZ territorial authority religious affiliation data
Converts CSV format to the JSON structure needed by the Enhanced NZ Map
"""

import csv
import json
import os

def process_stats_nz_ta_data(csv_file_path, output_path):
    """
    Process Stats NZ territorial authority religious affiliation CSV data
    
    Args:
        csv_file_path: Path to the Stats NZ CSV file
        output_path: Path to save the processed JSON file
    """
    print(f"Loading Stats NZ data from: {csv_file_path}")
    
    # Create mapping of religion names from Stats NZ to our app format
    religion_mapping = {
        'Christianity': 'Christian',
        'No religion': 'No religion', 
        'Buddhism': 'Buddhism',
        'Hinduism': 'Hinduism',
        'Islam': 'Islam',
        'Judaism': 'Judaism',
        'Māori religions': 'Māori Christian',
        'Other Religions': 'Other religion'
    }
    
    # Read CSV and process data
    ta_data = {}
    row_count = 0
    count_rows = 0
    years_found = set()
    tas_found = set()
    
    with open(csv_file_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            row_count += 1
            
            # Skip non-count data (percentages)
            if row['Unit'] != 'Count':
                continue
            
            count_rows += 1
            
            # Get row data
            ta_name = row['Territorial authority']
            year = str(row['Census Year'])
            religion_raw = row['Religious affiliation']
            
            # Track what we find
            years_found.add(year)
            tas_found.add(ta_name)
            
            # Skip religions we don't want
            if religion_raw not in religion_mapping:
                continue
                
            religion = religion_mapping[religion_raw]
            
            try:
                count = int(float(row['Value']))
            except (ValueError, TypeError):
                print(f"Warning: Could not parse count for {ta_name} {year} {religion}: {row['Value']}")
                continue
            
            # Initialize TA if not exists
            if ta_name not in ta_data:
                ta_data[ta_name] = {'name': ta_name}
            
            # Initialize year if not exists
            if year not in ta_data[ta_name]:
                ta_data[ta_name][year] = {}
            
            # Add religion count
            ta_data[ta_name][year][religion] = count
    
    print(f"Loaded {row_count} rows, {count_rows} count rows")
    print(f"Years found: {sorted(years_found)}")
    print(f"Territorial authorities found: {len(tas_found)}")
    
    # Calculate totals for each TA/year combination
    for ta_name, ta_info in ta_data.items():
        for year in ['2013', '2018', '2023']:
            if year in ta_info:
                # Calculate total stated (sum of all religions)
                religions = ['Christian', 'No religion', 'Buddhism', 'Hinduism', 'Islam', 'Judaism', 'Māori Christian', 'Other religion']
                total_stated = sum(ta_info[year].get(religion, 0) for religion in religions)
                ta_info[year]['Total stated'] = total_stated
    
    # Since our app expects 2006 data but we only have 2013/2018/2023, 
    # we'll use 2023 instead of 2006 for the timeline
    # Convert TA names to codes using the existing TA boundary data
    
    # Map TA names to codes (we'll need to match with existing territorial_authorities.geojson)
    print("\nSample territorial authorities found:")
    for i, ta_name in enumerate(sorted(ta_data.keys())):
        if i < 10:
            print(f"  - {ta_name}")
    
    # For now, let's create a simple mapping based on alphabetical order
    # This will need to be refined to match the actual TA codes in the boundaries file
    ta_code_mapping = {}
    sorted_ta_names = sorted(ta_data.keys())
    
    for i, ta_name in enumerate(sorted_ta_names):
        # Format as 3-digit code (001, 002, etc.)
        ta_code = f"{i+1:03d}"
        ta_code_mapping[ta_name] = ta_code
    
    # Convert to code-based structure for compatibility with app
    coded_ta_data = {}
    
    for ta_name, ta_info in ta_data.items():
        ta_code = ta_code_mapping[ta_name]
        coded_ta_data[ta_code] = {
            'name': ta_name,
            # Use 2023 as "2006" since we don't have 2006 data
            '2006': ta_info.get('2023', {}),  
            '2013': ta_info.get('2013', {}),
            '2018': ta_info.get('2018', {})
        }
    
    # Save the processed data
    print(f"\nSaving processed data to: {output_path}")
    with open(output_path, 'w') as f:
        json.dump(coded_ta_data, f, indent=2, ensure_ascii=False)
    
    # Print sample data for verification
    print(f"\nProcessed {len(coded_ta_data)} territorial authorities")
    
    # Find Auckland and show its data
    auckland_code = None
    for code, data in coded_ta_data.items():
        if 'auckland' in data['name'].lower():
            auckland_code = code
            break
    
    if auckland_code:
        auckland = coded_ta_data[auckland_code]
        print(f"\nAuckland TA ({auckland_code}) - {auckland['name']}:")
        for year in ['2006', '2013', '2018']:
            if year in auckland and 'Total stated' in auckland[year]:
                total = auckland[year]['Total stated']
                christian = auckland[year].get('Christian', 0)
                no_religion = auckland[year].get('No religion', 0)
                print(f"  {year}: Total={total:,}, Christian={christian:,}, No Religion={no_religion:,}")
    
    print(f"\n✅ Successfully processed Stats NZ territorial authority data")
    return output_path

def main():
    """Main processing function"""
    
    # File paths
    csv_path = '/Users/joseph/GIT/places-of-worship/stats_nz_religious_affiliation_by_ta.csv'
    output_path = '/Users/joseph/GIT/places-of-worship/ta_aggregated_data_real.json'
    
    if not os.path.exists(csv_path):
        print(f"❌ CSV file not found: {csv_path}")
        return
    
    try:
        process_stats_nz_ta_data(csv_path, output_path)
        print(f"\n🎉 Processing complete! Output saved to: {output_path}")
        
    except Exception as e:
        print(f"❌ Error processing data: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()