#!/usr/bin/env python3
"""
Quick proof of concept API for global places of worship
Uses existing townhalls data as placeholder for churches
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import geopandas as gpd
import pandas as pd
import time
import logging
from pathlib import Path

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load data
logger.info("Loading data...")
start_time = time.time()

try:
    # Use townhalls data as churches placeholder for proof of concept
    townhalls_file = Path("data/global/townhalls.parquet")
    if townhalls_file.exists():
        churches_df = gpd.read_parquet(townhalls_file)
        churches_df["type"] = "churches"  # Change type for frontend compatibility
        
        # Create empty dataframes for schools and townhalls
        schools_df = gpd.GeoDataFrame()
        townhalls_df = gpd.GeoDataFrame()
        
        # Combine all data
        df = churches_df  # Just churches for now
        
        logger.info(f"Loaded {len(df):,} places as churches (using townhalls data)")
        
    else:
        logger.warning("No data files found - creating empty dataset")
        df = gpd.GeoDataFrame()
        
except Exception as e:
    logger.error(f"Error loading data: {e}")
    df = gpd.GeoDataFrame()

load_time = time.time() - start_time
logger.info(f"Data loaded in {load_time:.2f} seconds")

# Create FastAPI app
app = FastAPI(title="Global Places of Worship - Quick Demo")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def get(bounds: str = "-90,-180,90,180", dataset: str = "churches", limit: int = 100):
    """
    Compatible with religion repository frontend
    """
    try:
        bounds_list = list(map(float, bounds.split(",")))
        if len(bounds_list) != 4:
            raise ValueError
    except:
        raise HTTPException(status_code=400, detail="Invalid bounds")
    
    start_time = time.time()
    
    # Filter by bounds
    if not df.empty:
        filtered_df = df[
            df["lng"].between(bounds_list[0], bounds_list[2]) &
            df["lat"].between(bounds_list[1], bounds_list[3])
        ]
        
        # Apply limit
        if len(filtered_df) > limit:
            filtered_df = filtered_df.sample(limit)
            
        # Convert to records
        result_data = filtered_df.drop(columns=['geometry'], errors='ignore').to_dict(orient="records")
        
    else:
        filtered_df = gpd.GeoDataFrame()
        result_data = []
    
    # Format response to match religion repository
    result = {
        "meta": {
            "churches": len(result_data) if dataset == "churches" else 0,
            "schools": 0,
            "townhalls": 0
        }
    }
    
    # Add data for requested datasets
    for dataset_name in dataset.split(","):
        if dataset_name == "churches":
            result["churches"] = result_data
        else:
            result[dataset_name] = []
    
    query_time = time.time() - start_time
    logger.info(f"Query completed in {query_time:.3f}s - returned {len(result_data)} places")
    
    return result

@app.get("/health")
def health():
    return {"status": "ok", "places_loaded": len(df)}

# Serve static files
if Path("frontend").exists():
    app.mount("/frontend", StaticFiles(directory="frontend"), name="frontend")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)