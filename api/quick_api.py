#!/usr/bin/env python3
"""
Quick proof-of-concept API for global places of worship.
Fixes bbox parsing, uses churches dataset, and raises sensible default limits.
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

def _parse_bounds(bounds: str):
    """Parse bbox string and normalize to (min_lat, min_lng, max_lat, max_lng).

    Supports either order:
    - lat,lng,lat,lng  (minLat,minLng,maxLat,maxLng)
    - lng,lat,lng,lat  (Leaflet toBBoxString)
    """
    vals = list(map(float, bounds.split(",")))
    if len(vals) != 4:
        raise ValueError("Bounds must have 4 comma-separated values")

    a, b, c, d = vals
    # If first and third look like latitudes (within [-90, 90]) assume lat-first
    if abs(a) <= 90 and abs(c) <= 90:
        min_lat, min_lng, max_lat, max_lng = a, b, c, d
    else:
        # Assume Leaflet toBBoxString order (lng,lat,lng,lat)
        min_lng, min_lat, max_lng, max_lat = a, b, c, d
    # Validate ranges
    if not (-90 <= min_lat <= max_lat <= 90):
        raise ValueError("Invalid latitude bounds")
    if not (-180 <= min_lng <= max_lng <= 180):
        raise ValueError("Invalid longitude bounds")
    return min_lat, min_lng, max_lat, max_lng


# Load data
logger.info("Loading data...")
start_time = time.time()

try:
    data_file = Path("data/global/churches.parquet")
    if data_file.exists():
        df = gpd.read_parquet(data_file)
        # Ensure compatibility with frontend coloring/labels
        if "type" not in df.columns:
            df["type"] = "churches"
        logger.info(f"Loaded churches dataset: {len(df):,} rows from {data_file}")
    else:
        logger.warning(f"Dataset not found: {data_file} — returning empty dataset")
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
def get(bounds: str = "-90,-180,90,180", dataset: str = "churches", limit: int = 100000):
    """
    Compatible with religion repository frontend
    """
    try:
        min_lat, min_lng, max_lat, max_lng = _parse_bounds(bounds)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid bounds: {e}")

    t0 = time.time()

    result = {"meta": {}}
    requested = [d.strip() for d in dataset.split(",") if d.strip()]

    if not df.empty and ("churches" in requested):
        # Pre-limit total for meta
        pre = df[(df["lat"].between(min_lat, max_lat)) & (df["lng"].between(min_lng, max_lng))]
        total_in_bounds = int(len(pre))

        # Limit and prioritise by confidence if available
        if total_in_bounds > limit:
            if "confidence" in pre.columns:
                filtered_df = pre.nlargest(limit, "confidence")
            else:
                filtered_df = pre.head(limit)
        else:
            filtered_df = pre

        data_records = filtered_df.drop(columns=["geometry"], errors="ignore").to_dict(orient="records")

        result["churches"] = data_records
        result["meta"]["churches"] = total_in_bounds
    else:
        # No data or not requested
        result["churches"] = []
        result["meta"]["churches"] = 0

    # Always include keys for overlays the frontend expects
    if "schools" in requested:
        result["schools"] = []
    result["meta"]["schools"] = 0
    if "townhalls" in requested:
        result["townhalls"] = []
    result["meta"]["townhalls"] = 0

    result["meta"]["query_time_ms"] = round((time.time() - t0) * 1000)
    result["meta"]["bounds"] = [min_lat, min_lng, max_lat, max_lng]

    logger.info(
        f"Query completed in {result['meta']['query_time_ms']} ms — churches returned: {len(result.get('churches', []))} (total in bounds: {result['meta']['churches']})"
    )

    return result


@app.get("/api/v1/places")
def get_v1(bounds: str = "-90,-180,90,180", datasets: str = "churches", limit: int = 100000):
    """Compatibility endpoint used by the global frontend (expects 'datasets' param)."""
    return get(bounds=bounds, dataset=datasets, limit=limit)

@app.get("/health")
def health():
    return {"status": "ok", "places_loaded": len(df)}

# Serve static files
if Path("frontend").exists():
    app.mount("/frontend", StaticFiles(directory="frontend"), name="frontend")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
