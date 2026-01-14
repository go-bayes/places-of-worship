#!/usr/bin/env python3

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import simdjson as json
import shapely
from tqdm.auto import tqdm
import time
from osm2geojson import json2shapes
import geopandas as gpd
import pandas as pd

s = time.time()
churches = gpd.read_parquet("churches.parquet")
churches["type"] = "churches"
schools = gpd.read_parquet("schools.parquet")
schools["type"] = "schools"
townhalls = gpd.read_parquet("townhalls.parquet")
townhalls["type"] = "townhalls"
df = gpd.GeoDataFrame(pd.concat([churches, schools, townhalls]))
print(f"Loaded data in {time.time() - s} seconds")

app = FastAPI(root_path="/OSM_API_v2")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def get(bounds:str = "-90,-180,90,180", dataset:str = "churches", limit:int = 100):
    try:
        bounds = list(map(float, bounds.split(",")))
        if len(bounds) != 4:
            raise ValueError
    except:
        raise HTTPException(status_code=400, detail="Invalid bounds")
    s = time.time()
    filtered_df = df[
        df["lng"].between(bounds[0], bounds[2]) &
        df["lat"].between(bounds[1], bounds[3])
    ]
    print(f"Filtered data in {time.time() - s} seconds")
    result = {
        "meta": filtered_df["type"].value_counts().to_dict()
    }
    for dset in dataset.split(","):
        subset = filtered_df[filtered_df["type"] == dset]
        if len(subset) > limit:
            subset = subset.sample(limit)
        result[dset] = subset.drop(columns="geometry").replace({pd.NA: None}).to_dict(orient="records")
    print(f"Converted data in {time.time() - s} seconds")
    return result