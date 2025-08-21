#!/usr/bin/env python3
"""
Global Places of Worship API
Based on proven religion repository architecture, extended for global coverage
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import geopandas as gpd
import pandas as pd
import time
import logging
from pathlib import Path
from typing import Optional
import json

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class GlobalPlacesAPI:
    def __init__(self, data_dir: str = "data/global"):
        self.data_dir = Path(data_dir)
        self.data_cache = {}
        self.load_data()
    
    def load_data(self):
        """Load global parquet files into memory for fast queries"""
        logger.info("Loading global places data...")
        start_time = time.time()
        
        try:
            # Primary churches data
            churches_file = self.data_dir / "churches.parquet"
            if churches_file.exists():
                self.data_cache['churches'] = gpd.read_parquet(churches_file)
                logger.info(f"Loaded {len(self.data_cache['churches']):,} churches")
            else:
                logger.warning(f"Churches file not found: {churches_file}")
                self.data_cache['churches'] = gpd.GeoDataFrame()
            
            # Future: schools and townhalls (create empty for now)
            self.data_cache['schools'] = gpd.GeoDataFrame()
            self.data_cache['townhalls'] = gpd.GeoDataFrame()
            
            # Add 'type' column for compatibility
            for dataset_name, gdf in self.data_cache.items():
                if not gdf.empty and 'type' not in gdf.columns:
                    gdf['type'] = dataset_name
            
            load_time = time.time() - start_time
            logger.info(f"Data loaded in {load_time:.2f} seconds")
            
        except Exception as e:
            logger.error(f"Error loading data: {e}")
            # Create empty dataframes as fallback
            for dataset in ['churches', 'schools', 'townhalls']:
                self.data_cache[dataset] = gpd.GeoDataFrame()

# Initialize data loader
places_api = GlobalPlacesAPI()

# Create FastAPI app
app = FastAPI(
    title="Global Places of Worship API",
    description="High-performance API for global places of worship mapping",
    version="1.0.0"
)

# CORS middleware for web frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def get_places(
    bounds: str = "-90,-180,90,180", 
    dataset: str = "churches", 
    limit: int = 100000
):
    """
    Get places of worship within bounding box
    Compatible with religion repository frontend
    
    Args:
        bounds: Bounding box as "minLat,minLng,maxLat,maxLng"
        dataset: Comma-separated datasets: "churches,schools,townhalls"
        limit: Maximum number of places to return per dataset
    """
    try:
        # Parse bounds
        bounds_list = list(map(float, bounds.split(",")))
        if len(bounds_list) != 4:
            raise ValueError("Bounds must have 4 values")
        min_lat, min_lng, max_lat, max_lng = bounds_list
        
        # Validate bounds
        if not (-90 <= min_lat <= max_lat <= 90):
            raise ValueError("Invalid latitude bounds")
        if not (-180 <= min_lng <= max_lng <= 180):
            raise ValueError("Invalid longitude bounds")
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid bounds: {e}")
    
    start_time = time.time()
    
    # Process each requested dataset
    datasets = [d.strip() for d in dataset.split(",")]
    result = {"meta": {}}
    
    for dataset_name in datasets:
        if dataset_name not in places_api.data_cache:
            result["meta"][dataset_name] = 0
            result[dataset_name] = []
            continue
        
        gdf = places_api.data_cache[dataset_name]
        
        if gdf.empty:
            result["meta"][dataset_name] = 0
            result[dataset_name] = []
            continue
        
        # Spatial filter using bounding box
        filtered_gdf = gdf[
            (gdf["lat"].between(min_lat, max_lat)) &
            (gdf["lng"].between(min_lng, max_lng))
        ]
        
        # Apply limit with sampling if needed
        total_in_bounds = len(filtered_gdf)
        if len(filtered_gdf) > limit:
            # Sample by confidence to get best quality places
            filtered_gdf = filtered_gdf.nlargest(limit, 'confidence')
        
        result["meta"][dataset_name] = total_in_bounds
        
        # Convert to records format (compatible with religion repo frontend)
        if not filtered_gdf.empty:
            # Drop geometry column for JSON serialization
            df_for_json = filtered_gdf.drop(columns=['geometry'], errors='ignore')
            result[dataset_name] = df_for_json.to_dict(orient="records")
        else:
            result[dataset_name] = []
    
    # Add query metadata
    query_time = time.time() - start_time
    result["meta"]["query_time_ms"] = round(query_time * 1000, 2)
    result["meta"]["bounds"] = bounds_list
    
    logger.info(f"Query completed in {query_time:.3f}s - returned {sum(result['meta'].get(d, 0) for d in datasets if isinstance(result['meta'].get(d, 0), int))} places")
    
    return result

@app.get("/api/v1/places")
def get_places_v1(
    bounds: str = "-90,-180,90,180",
    datasets: str = "churches", 
    limit: int = 100000,
    confidence_min: Optional[float] = None
):
    """
    Modern API endpoint with additional filtering options
    """
    # Use same logic as main endpoint but add confidence filtering
    result = get_places(bounds, datasets, limit)
    
    # Apply confidence filter if specified
    if confidence_min is not None:
        for dataset_name in datasets.split(","):
            if dataset_name in result:
                result[dataset_name] = [
                    place for place in result[dataset_name] 
                    if place.get('confidence', 0) >= confidence_min
                ]
                result["meta"][dataset_name] = len(result[dataset_name])
    
    return result

@app.get("/api/v1/places/{place_id}")
def get_place_details(place_id: str):
    """
    Get detailed information about a specific place
    """
    # Search across all datasets
    for dataset_name, gdf in places_api.data_cache.items():
        if gdf.empty:
            continue
            
        # Try to find place by ID
        place_data = gdf[gdf['id'] == place_id]
        if place_data.empty:
            # Try OSM ID as fallback
            place_data = gdf[gdf['osm_id'].astype(str) == place_id]
        
        if not place_data.empty:
            # Convert first match to detailed record
            place = place_data.iloc[0]
            
            detailed_record = {
                "place_id": place.get('id', place_id),
                "osm_id": place.get('osm_id'),
                "name": place.get('name'),
                "religion": place.get('religion'),
                "denomination": place.get('denomination'),
                "coordinates": [place.get('lng'), place.get('lat')],
                "country_code": place.get('country_code'),
                "confidence": place.get('confidence'),
                "address": place.get('address', ''),
                "website": place.get('website', ''),
                "phone": place.get('phone', ''),
                "tags": place.get('tags', {}),
                "data_source": dataset_name
            }
            
            return detailed_record
    
    raise HTTPException(status_code=404, detail="Place not found")

@app.get("/api/v1/stats")
def get_global_stats():
    """
    Get global statistics about the dataset
    """
    stats = {}
    total_places = 0
    
    for dataset_name, gdf in places_api.data_cache.items():
        if gdf.empty:
            stats[dataset_name] = {"count": 0}
            continue
            
        dataset_stats = {
            "count": len(gdf),
            "countries": gdf['country_code'].nunique() if 'country_code' in gdf.columns else 0,
            "religions": gdf['religion'].nunique() if 'religion' in gdf.columns else 0,
            "avg_confidence": float(gdf['confidence'].mean()) if 'confidence' in gdf.columns else 0
        }
        
        # Top countries by count
        if 'country_code' in gdf.columns:
            dataset_stats["top_countries"] = gdf['country_code'].value_counts().head(10).to_dict()
        
        # Top religions by count  
        if 'religion' in gdf.columns:
            dataset_stats["top_religions"] = gdf['religion'].value_counts().head(10).to_dict()
        
        stats[dataset_name] = dataset_stats
        total_places += dataset_stats["count"]
    
    stats["global"] = {
        "total_places": total_places,
        "datasets": len([d for d in places_api.data_cache.keys() if not places_api.data_cache[d].empty])
    }
    
    return stats

@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "datasets_loaded": len([d for d in places_api.data_cache.keys() if not places_api.data_cache[d].empty]),
        "total_places": sum(len(gdf) for gdf in places_api.data_cache.values())
    }

# Serve static files (for frontend)
if Path("frontend").exists():
    app.mount("/", StaticFiles(directory="frontend", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)