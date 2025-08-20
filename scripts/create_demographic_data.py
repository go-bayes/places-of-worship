#!/usr/bin/env python3
"""
Create comprehensive demographic data for NZ SA2 regions
Generates realistic age, gender, ethnicity, and income data for demonstration
"""

import json
import random
import numpy as np
from pathlib import Path

class DemographicDataGenerator:
    def __init__(self):
        self.age_groups = [
            "0-4", "5-9", "10-14", "15-19", "20-24", "25-29", "30-34",
            "35-39", "40-44", "45-49", "50-54", "55-59", "60-64", 
            "65-69", "70-74", "75-79", "80-84", "85+"
        ]
        
        self.ethnicities = [
            "European", "Māori", "Pacific", "Asian", "MELAA", "Other"
        ]
        
        self.income_brackets = [
            "Under $15,000", "$15,000-$30,000", "$30,000-$50,000",
            "$50,000-$70,000", "$70,000-$100,000", "$100,000-$150,000",
            "$150,000+"
        ]
        
        # Load existing religious data to get SA2 codes and populations
        with open("frontend/src/religion.json", "r") as f:
            self.religion_data = json.load(f)
    
    def generate_age_profile(self, total_population):
        """Generate realistic age distribution"""
        # NZ age distribution patterns (approximately)
        age_weights = [
            6.2, 6.0, 5.8, 5.6, 6.8, 7.2, 7.1,  # 0-34
            7.3, 7.1, 6.8, 6.5, 6.2, 5.8, 5.4,  # 35-69
            4.2, 3.1, 2.1, 1.4, 1.6              # 70+
        ]
        
        # Normalize weights
        total_weight = sum(age_weights)
        proportions = [w / total_weight for w in age_weights]
        
        # Generate counts with some random variation
        age_profile = {}
        remaining_pop = total_population
        
        for i, (age_group, prop) in enumerate(zip(self.age_groups[:-1], proportions[:-1])):
            count = max(0, int(prop * total_population + random.gauss(0, prop * total_population * 0.1)))
            age_profile[age_group] = min(count, remaining_pop)
            remaining_pop -= age_profile[age_group]
        
        # Last group gets remaining
        age_profile[self.age_groups[-1]] = max(0, remaining_pop)
        
        return age_profile
    
    def generate_gender_profile(self, total_population):
        """Generate gender distribution (slightly more females in NZ)"""
        # NZ has approximately 51.1% female, 48.9% male
        female_ratio = random.gauss(0.511, 0.02)  # Add some variation
        female_ratio = max(0.48, min(0.53, female_ratio))  # Clamp
        
        female_count = int(total_population * female_ratio)
        male_count = total_population - female_count
        
        return {
            "Female": female_count,
            "Male": male_count,
            "Gender_diverse": max(0, int(total_population * 0.002))  # Small proportion
        }
    
    def generate_ethnicity_profile(self, total_population, region_type="general"):
        """Generate ethnicity distribution with regional variation"""
        # Base NZ proportions (people can select multiple ethnicities)
        base_proportions = {
            "European": 0.701,
            "Māori": 0.164,
            "Pacific": 0.084,
            "Asian": 0.152,
            "MELAA": 0.014,  # Middle Eastern/Latin American/African
            "Other": 0.025
        }
        
        # Add regional variation
        if region_type == "urban":
            # More diverse in cities
            base_proportions["European"] *= 0.9
            base_proportions["Asian"] *= 1.4
            base_proportions["Pacific"] *= 1.2
        elif region_type == "rural":
            # More European/Māori in rural areas
            base_proportions["European"] *= 1.1
            base_proportions["Māori"] *= 1.3
            base_proportions["Asian"] *= 0.6
            base_proportions["Pacific"] *= 0.7
        
        ethnicity_profile = {}
        for ethnicity, base_prop in base_proportions.items():
            # Add random variation
            actual_prop = random.gauss(base_prop, base_prop * 0.15)
            actual_prop = max(0.01, min(0.95, actual_prop))  # Clamp
            
            count = int(total_population * actual_prop)
            ethnicity_profile[ethnicity] = count
        
        return ethnicity_profile
    
    def generate_income_profile(self, total_population, region_type="general"):
        """Generate household income distribution"""
        # Base NZ income distribution (approximate)
        base_proportions = {
            "Under $15,000": 0.08,
            "$15,000-$30,000": 0.15,
            "$30,000-$50,000": 0.18,
            "$50,000-$70,000": 0.16,
            "$70,000-$100,000": 0.18,
            "$100,000-$150,000": 0.15,
            "$150,000+": 0.10
        }
        
        # Regional variation
        if region_type == "urban":
            # Higher incomes in cities
            base_proportions["Under $15,000"] *= 0.8
            base_proportions["$15,000-$30,000"] *= 0.9
            base_proportions["$100,000-$150,000"] *= 1.3
            base_proportions["$150,000+"] *= 1.8
        elif region_type == "rural":
            # More lower-middle income in rural
            base_proportions["Under $15,000"] *= 1.2
            base_proportions["$30,000-$50,000"] *= 1.3
            base_proportions["$100,000-$150,000"] *= 0.7
            base_proportions["$150,000+"] *= 0.4
        
        income_profile = {}
        remaining_pop = total_population
        
        for bracket, base_prop in list(base_proportions.items())[:-1]:
            actual_prop = random.gauss(base_prop, base_prop * 0.1)
            actual_prop = max(0.02, min(0.4, actual_prop))
            
            count = int(total_population * actual_prop)
            count = min(count, remaining_pop)
            income_profile[bracket] = count
            remaining_pop -= count
        
        # Last bracket gets remainder
        income_profile[list(base_proportions.keys())[-1]] = max(0, remaining_pop)
        
        return income_profile
    
    def determine_region_type(self, sa2_code):
        """Classify SA2 as urban/rural based on code patterns"""
        # This is simplified - in reality you'd use official classifications
        sa2_int = int(sa2_code)
        
        # Major urban areas (rough approximation)
        urban_ranges = [
            (100000, 120000),  # Northland urban
            (121000, 180000),  # Auckland
            (200000, 230000),  # Waikato urban
            (240000, 270000),  # Bay of Plenty urban
            (300000, 350000),  # Wellington
            (530000, 580000),  # Canterbury urban
            (590000, 620000),  # Otago urban
        ]
        
        for start, end in urban_ranges:
            if start <= sa2_int <= end:
                return "urban"
        
        return "rural"
    
    def generate_comprehensive_demographics(self):
        """Generate full demographic dataset"""
        demographics = {}
        
        print("Generating comprehensive demographic data...")
        
        for sa2_code, religion_temporal_data in self.religion_data.items():
            # Skip non-SA2 keys
            if not sa2_code.isdigit():
                continue
                
            # Get 2018 population as base
            base_data = religion_temporal_data.get("2018", {})
            total_population = base_data.get("Total", 1000)
            
            if total_population < 50:  # Skip very small populations
                continue
            
            region_type = self.determine_region_type(sa2_code)
            
            # Generate demographics for each census year
            demographics[sa2_code] = {}
            
            for year in ["2006", "2013", "2018"]:
                year_religion_data = religion_temporal_data.get(year, {})
                year_population = year_religion_data.get("Total", total_population)
                
                if year_population < 50:
                    continue
                
                demographics[sa2_code][year] = {
                    # Copy existing religion data
                    **year_religion_data,
                    
                    # Add comprehensive demographics
                    "age_profile": self.generate_age_profile(year_population),
                    "gender_profile": self.generate_gender_profile(year_population),
                    "ethnicity_profile": self.generate_ethnicity_profile(year_population, region_type),
                    "income_profile": self.generate_income_profile(year_population // 2, region_type),  # Households
                    
                    # Population density (rough estimate)
                    "population_density": random.randint(50, 5000) if region_type == "urban" else random.randint(1, 100),
                    
                    # Additional metrics
                    "median_age": random.gauss(37.4, 5),  # NZ median age ~37.4
                    "unemployment_rate": random.gauss(0.04, 0.02) if region_type == "urban" else random.gauss(0.05, 0.02),
                    "home_ownership_rate": random.gauss(0.65, 0.15),
                    
                    # Region classification
                    "region_type": region_type
                }
        
        return demographics
    
    def save_demographic_data(self, demographics, output_path):
        """Save comprehensive demographic data"""
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(demographics, f, indent=2, ensure_ascii=False)
        
        print(f"Saved demographic data for {len(demographics)} regions to {output_path}")
        
        # Generate summary statistics
        total_regions = len(demographics)
        urban_regions = sum(1 for data in demographics.values() 
                           if data.get("2018", {}).get("region_type") == "urban")
        rural_regions = total_regions - urban_regions
        
        print(f"Summary: {total_regions} regions ({urban_regions} urban, {rural_regions} rural)")
        
        return demographics

def main():
    generator = DemographicDataGenerator()
    demographics = generator.generate_comprehensive_demographics()
    
    # Save to frontend directory
    output_path = Path("frontend/src/demographics.json")
    generator.save_demographic_data(demographics, output_path)
    
    print("\n✅ Comprehensive demographic data generated successfully!")
    print(f"📁 File: {output_path}")
    print("📊 Includes: Age, Gender, Ethnicity, Income, Population Density")
    print("📅 Years: 2006, 2013, 2018")
    print("🗺️  Compatible with existing SA2 boundaries")

if __name__ == "__main__":
    main()