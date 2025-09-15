#!/usr/bin/env python3
"""
Global Places of Worship API
Based on proven religion repository architecture, extended for global coverage
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.gzip import GZipMiddleware
import geopandas as gpd
import pandas as pd
import time
import logging
from pathlib import Path
from typing import Optional, List, Dict
import json
import os

# Optional fast path deps
try:
    import polars as pl  # type: ignore
except Exception:  # pragma: no cover
    pl = None  # type: ignore
try:
    import pyarrow.dataset as ds  # type: ignore
except Exception:  # pragma: no cover
    ds = None  # type: ignore

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MAX_LIMIT = int(os.getenv("MAX_QUERY_LIMIT", "100000"))
DUPLICATE_PRECISION = int(os.getenv("DEDUPLICATE_PRECISION", "6"))
NORMALIZE_RELIGION = os.getenv("NORMALIZE_RELIGION", "").lower() in ("1", "true", "yes")


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

class GlobalPlacesAPI:
    def __init__(self, data_dir: str = "data/global"):
        self.data_dir = Path(data_dir)
        self.data_cache = {}
        self.parquet_file = self.data_dir / "churches.parquet"
        # Opt-in fast query mode: stream Parquet using Polars/PyArrow
        self.fast_mode = os.getenv("FAST_QUERY_MODE", "").lower() in ("1", "true", "yes")
        self.load_data()

    @staticmethod
    def _normalize_religion(value: Optional[str]) -> str:
        if not value:
            return "unknown"
        v = str(value).strip().lower()
        # split on common separators and take first recognized
        parts = [p.strip() for p in v.replace("|", ";").replace("/", ";").split(";") if p.strip()]
        mapping = {
            # Christianity
            "christianity": "christian",
            "christian": "christian",
            # Islam
            "islam": "muslim",
            "muslim": "muslim",
            # Buddhism
            "buddhism": "buddhist",
            "buddhist": "buddhist",
            # Hinduism
            "hinduism": "hindu",
            "hindu": "hindu",
            # Judaism
            "judaism": "jewish",
            "jew": "jewish",
            "jewish": "jewish",
            # Sikhism
            "sikhism": "sikh",
            "sikh": "sikh",
            # Taoism / Shinto
            "taoism": "taoist",
            "taoist": "taoist",
            "daoism": "taoist",
            "shintoism": "shinto",
            "shinto": "shinto",
        }
        for p in parts or [v]:
            if p in mapping:
                return mapping[p]
            # simple contains checks for common words
            if "christian" in p:
                return "christian"
            if "islam" in p or "muslim" in p:
                return "muslim"
            if "buddh" in p:
                return "buddhist"
            if "hindu" in p:
                return "hindu"
            if "jew" in p:
                return "jewish"
            if "sikh" in p:
                return "sikh"
            if "tao" in p or "dao" in p:
                return "taoist"
            if "shinto" in p:
                return "shinto"
        return v if v in {"christian","muslim","buddhist","hindu","jewish","sikh","taoist","shinto"} else "unknown"

    @staticmethod
    def _dedupe_records(self, records: List[Dict], precision: int = 6) -> List[Dict]:
        """Deduplicate by rounded lat/lng, keeping highest-confidence record."""
        seen = {}
        for r in records:
            try:
                lat = round(float(r.get("lat")), precision)
                lng = round(float(r.get("lng")), precision)
            except Exception:
                continue
            key = (lat, lng)
            conf = r.get("confidence")
            try:
                conf_val = float(conf) if conf is not None else -1.0
            except Exception:
                conf_val = -1.0
            prev = seen.get(key)
            if prev is None:
                seen[key] = r
            else:
                prev_conf = prev.get("confidence")
                try:
                    prev_val = float(prev_conf) if prev_conf is not None else -1.0
                except Exception:
                    prev_val = -1.0
                if conf_val > prev_val:
                    seen[key] = r
        return list(seen.values())
    
    def load_data(self):
        """Load global parquet files into memory for fast queries"""
        logger.info("Loading global places data...")
        start_time = time.time()
        
        try:
            # If fast mode is on and we have Parquet, rely on streaming queries
            if self.fast_mode and self.parquet_file.exists():
                logger.info("FAST_QUERY_MODE enabled; deferring loads to Parquet scans")
                self.data_cache['churches'] = gpd.GeoDataFrame()
            else:
                # Primary churches data (in-memory GeoDataFrame)
                if self.parquet_file.exists():
                    self.data_cache['churches'] = gpd.read_parquet(self.parquet_file)
                    logger.info(f"Loaded {len(self.data_cache['churches']):,} churches")
                else:
                    logger.warning(f"Churches file not found: {self.parquet_file}")
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

    def _query_parquet_fast(
        self,
        bounds,
        limit: int,
        confidence_min: Optional[float] = None,
        *,
        offset: int = 0,
        religions: Optional[List[str]] = None,
        countries: Optional[List[str]] = None,
        fields: Optional[List[str]] = None,
        sort: str = "confidence_desc",
    ):
        """Query Parquet file with column pushdown using Polars/PyArrow.

        Returns: (records: List[dict], total_in_bounds: int)
        """
        if not self.parquet_file.exists():
            return [], 0

        min_lat, min_lng, max_lat, max_lng = bounds

        # Prefer Polars lazy scanning when available
        if pl is not None:
            try:
                lf = pl.scan_parquet(str(self.parquet_file))
                filt = (
                    (pl.col("lat") >= min_lat)
                    & (pl.col("lat") <= max_lat)
                    & (pl.col("lng") >= min_lng)
                    & (pl.col("lng") <= max_lng)
                )
                if confidence_min is not None:
                    filt = filt & (pl.col("confidence") >= confidence_min)
                if religions:
                    filt = filt & pl.col("religion").is_in(religions)
                if countries:
                    filt = filt & pl.col("country_code").is_in(countries)

                # Compute distinct count in-bounds (rounded lat/lng)
                dedup_count = (
                    lf.filter(filt)
                    .select([
                        pl.col("lat").round(DUPLICATE_PRECISION).alias("lat_r"),
                        pl.col("lng").round(DUPLICATE_PRECISION).alias("lng_r"),
                    ])
                    .unique()
                    .select(pl.len())
                    .collect()
                    .item()
                )

                # Fetch top-N for rendering
                base_cols = [
                    "id",
                    "osm_id",
                    "lat",
                    "lng",
                    "name",
                    "religion",
                    "denomination",
                    "confidence",
                    "country_code",
                    "address",
                    "website",
                    "phone",
                    "start_date",
                    "type",
                ]
                cols = base_cols if not fields else [c for c in base_cols if c in fields or c in ("lat","lng")]  # keep lat/lng for dedup

                lf2 = (
                    lf.filter(filt)
                    .select([c for c in cols if c in lf.columns])
                    .with_columns([
                        pl.col("lat").round(DUPLICATE_PRECISION).alias("lat_r"),
                        pl.col("lng").round(DUPLICATE_PRECISION).alias("lng_r"),
                    ])
                )

                # Sorting options
                sort_spec = None
                if sort == "confidence_asc":
                    sort_spec = ("confidence", False)
                elif sort == "name_asc":
                    sort_spec = ("name", False)
                elif sort == "name_desc":
                    sort_spec = ("name", True)
                else:  # default confidence_desc
                    sort_spec = ("confidence", True)

                if sort_spec[0] in lf2.columns:
                    lf2 = lf2.sort(sort_spec[0], descending=sort_spec[1], nulls_last=True)
                else:
                    # fallback: no-op if column absent
                    pass

                records = (
                    lf2
                    .unique(subset=["lat_r", "lng_r"], keep="first")
                    .slice(offset, limit)
                    .collect()
                    .to_dicts()
                )
                # Drop helper keys and apply normalization if enabled
                out = []
                for r in records:
                    r.pop("lat_r", None)
                    r.pop("lng_r", None)
                    if NORMALIZE_RELIGION and "religion" in r:
                        r["religion"] = self._normalize_religion(r.get("religion"))
                    out.append(r)
                return out, int(dedup_count)
            except Exception as e:  # pragma: no cover
                logger.warning(f"Polars scan failed, trying PyArrow: {e}")

        # Fallback: PyArrow dataset scan
        if ds is not None:
            try:
                dataset = ds.dataset(str(self.parquet_file))
                expr = (
                    (ds.field("lat") >= min_lat)
                    & (ds.field("lat") <= max_lat)
                    & (ds.field("lng") >= min_lng)
                    & (ds.field("lng") <= max_lng)
                )
                if confidence_min is not None:
                    expr = expr & (ds.field("confidence") >= confidence_min)

                table = dataset.to_table(filter=expr)
                # Convert to list of dicts for simplified dedup + normalization
                keep_cols = [
                    c
                    for c in [
                        "id",
                        "osm_id",
                        "lat",
                        "lng",
                        "name",
                        "religion",
                        "denomination",
                        "confidence",
                        "country_code",
                        "address",
                        "website",
                        "phone",
                        "start_date",
                        "type",
                    ]
                    if c in table.column_names
                ]
                if fields:
                    sel = [c for c in keep_cols if c in fields or c in ("lat","lng")]
                else:
                    sel = keep_cols
                table = table.select(sel)
                rows = table.to_pylist()
                # Sort by confidence desc to prefer high-quality
                if sort == "confidence_asc":
                    rows.sort(key=lambda x: (x.get("confidence") is None, (x.get("confidence") or 0)))
                elif sort == "name_asc":
                    rows.sort(key=lambda x: (x.get("name") is None, str(x.get("name") or "").lower()))
                elif sort == "name_desc":
                    rows.sort(key=lambda x: (x.get("name") is None, str(x.get("name") or "").lower()), reverse=True)
                else:
                    rows.sort(key=lambda x: (x.get("confidence") is None, -(x.get("confidence") or 0)))
                # Deduplicate
                deduped = self._dedupe_records(rows, precision=DUPLICATE_PRECISION)
                # Apply offset + limit
                if offset:
                    deduped = deduped[offset:]
                if limit and len(deduped) > limit:
                    deduped = deduped[:limit]
                # Normalize if requested
                if NORMALIZE_RELIGION:
                    for r in deduped:
                        if "religion" in r:
                            r["religion"] = self._normalize_religion(r.get("religion"))
                # Distinct count
                # We need distinct count before slicing; recompute on rows
                total_distinct = len(self._dedupe_records(rows, precision=DUPLICATE_PRECISION))
                return deduped, int(total_distinct)
            except Exception as e:  # pragma: no cover
                logger.error(f"PyArrow scan failed: {e}")

        # Last resort
        return [], 0

# Initialize data loader
places_api = GlobalPlacesAPI()

# Create FastAPI app
app = FastAPI(
    title="Global Places of Worship API",
    description="High-performance API for global places of worship mapping",
    version="1.0.0"
)

# Compression for large JSON responses
app.add_middleware(GZipMiddleware, minimum_size=1000)

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
    limit: int = 100000,
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
        min_lat, min_lng, max_lat, max_lng = _parse_bounds(bounds)
        bounds_list = [min_lat, min_lng, max_lat, max_lng]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid bounds: {e}")
    
    start_time = time.time()
    
    # Sanitize and clamp limit
    try:
        limit = int(limit)
    except Exception:
        limit = MAX_LIMIT
    limit = max(1, min(limit, MAX_LIMIT))

    # Process each requested dataset
    datasets = [d.strip() for d in dataset.split(",") if d.strip()]
    result = {"meta": {}}
    
    for dataset_name in datasets:
        if dataset_name not in places_api.data_cache:
            result["meta"][dataset_name] = 0
            result[dataset_name] = []
            continue
        
        # Fast path: stream Parquet when enabled
        if places_api.fast_mode and dataset_name == "churches":
            records, total_in_bounds = places_api._query_parquet_fast(
                (min_lat, min_lng, max_lat, max_lng), limit
            )
            result["meta"][dataset_name] = total_in_bounds
            result[dataset_name] = records
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
        ].copy()

        # Ensure confidence column exists for sorting
        if "confidence" not in filtered_gdf.columns:
            filtered_gdf["confidence"] = 0.0

        # Deduplicate by rounded lat/lng, keep highest confidence
        try:
            filtered_gdf = (
                filtered_gdf
                .assign(
                    _lat_r=filtered_gdf["lat"].round(DUPLICATE_PRECISION),
                    _lng_r=filtered_gdf["lng"].round(DUPLICATE_PRECISION),
                )
                .sort_values(by=["confidence"], ascending=False)
                .drop_duplicates(subset=["_lat_r", "_lng_r"], keep="first")
            )
        except Exception:
            # Fallback: no dedup if pandas ops fail
            pass

        total_distinct = len(filtered_gdf)
        # Apply limit after dedup
        if total_distinct > limit:
            filtered_gdf = filtered_gdf.head(limit)

        result["meta"][dataset_name] = total_distinct

        # Convert to records format (compatible with religion repo frontend)
        if not filtered_gdf.empty:
            # Drop geometry and helper columns for JSON serialization
            df_for_json = filtered_gdf.drop(columns=['geometry', '_lat_r', '_lng_r'], errors='ignore')
            records = df_for_json.to_dict(orient="records")
            # Optional normalization
            if NORMALIZE_RELIGION:
                for r in records:
                    if 'religion' in r:
                        r['religion'] = self._normalize_religion(r.get('religion'))
            result[dataset_name] = records
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
    confidence_min: Optional[float] = None,
    min_confidence: Optional[float] = None,
    religions: Optional[str] = None,
    countries: Optional[str] = None,
    fields: Optional[str] = None,
    sort: str = "confidence_desc",
    offset: int = 0,
):
    """
    Modern API endpoint with filtering, sorting, pagination and field selection.

    Query params:
    - bounds: bbox as "minLat,minLng,maxLat,maxLng" or Leaflet order "minLng,minLat,maxLng,maxLat"
    - datasets: comma-separated (e.g., "churches,schools")
    - limit, offset: pagination controls
    - confidence_min/min_confidence: minimum confidence filter
    - religions: comma-separated canonical religion keys (e.g., christian,muslim)
    - countries: comma-separated ISO country codes (e.g., NZ,AU)
    - fields: comma-separated fields to return (e.g., id,lat,lng,name,religion)
    - sort: confidence_desc|confidence_asc|name_asc|name_desc
    """
    try:
        min_lat, min_lng, max_lat, max_lng = _parse_bounds(bounds)
        bounds_list = [min_lat, min_lng, max_lat, max_lng]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid bounds: {e}")

    # Sanitize limit/offset
    try:
        limit = int(limit)
    except Exception:
        limit = MAX_LIMIT
    limit = max(1, min(limit, MAX_LIMIT))
    try:
        offset = int(offset)
    except Exception:
        offset = 0
    offset = max(0, offset)

    # Filters
    conf_min = min_confidence if min_confidence is not None else confidence_min
    rel_list = [r.strip() for r in religions.split(",")] if religions else None
    ctry_list = [c.strip().upper() for c in countries.split(",")] if countries else None
    field_list = [f.strip() for f in fields.split(",")] if fields else None

    start_time = time.time()

    result = {"meta": {}}
    datasets_list = [d.strip() for d in datasets.split(",") if d.strip()]

    total_returned = 0
    total_distinct = 0

    for dataset_name in datasets_list:
        # Fast path for churches via Parquet
        if places_api.fast_mode and dataset_name == "churches":
            try:
                recs, total_in_bounds = places_api._query_parquet_fast(
                    (min_lat, min_lng, max_lat, max_lng),
                    limit=limit,
                    confidence_min=conf_min,
                    offset=offset,
                    religions=rel_list,
                    countries=ctry_list,
                    fields=field_list,
                    sort=sort,
                )
            except Exception as e:
                logger.error(f"Fast query failed: {e}")
                recs, total_in_bounds = [], 0

            result[dataset_name] = recs
            result["meta"][dataset_name] = int(total_in_bounds)
            total_returned += len(recs)
            total_distinct += int(total_in_bounds)
            continue

        # Fallback to in-memory GeoDataFrame
        gdf = places_api.data_cache.get(dataset_name, gpd.GeoDataFrame())
        if gdf.empty:
            result[dataset_name] = []
            result["meta"][dataset_name] = 0
            continue

        # Spatial filter
        filtered = gdf[
            (gdf["lat"].between(min_lat, max_lat)) & (gdf["lng"].between(min_lng, max_lng))
        ].copy()

        # Apply filters
        if conf_min is not None and "confidence" in filtered.columns:
            filtered = filtered[filtered["confidence"] >= float(conf_min)]
        if rel_list and "religion" in filtered.columns:
            filtered = filtered[filtered["religion"].isin(rel_list)]
        if ctry_list and "country_code" in filtered.columns:
            filtered = filtered[filtered["country_code"].isin(ctry_list)]

        # Ensure confidence exists for sorting
        if "confidence" not in filtered.columns:
            filtered["confidence"] = 0.0

        # Deduplicate by rounded lat/lng, keep highest in sort order
        filtered = filtered.assign(
            _lat_r=filtered["lat"].round(DUPLICATE_PRECISION),
            _lng_r=filtered["lng"].round(DUPLICATE_PRECISION),
        )

        # Sorting
        ascending = False
        sort_col = "confidence"
        if sort == "confidence_asc":
            sort_col, ascending = "confidence", True
        elif sort == "name_asc":
            sort_col, ascending = "name", True
        elif sort == "name_desc":
            sort_col, ascending = "name", False
        else:
            sort_col, ascending = "confidence", False

        if sort_col in filtered.columns:
            filtered = filtered.sort_values(by=[sort_col], ascending=ascending, na_position="last")

        filtered = filtered.drop_duplicates(subset=["_lat_r", "_lng_r"], keep="first")
        total_after = len(filtered)

        # Pagination
        if offset:
            filtered = filtered.iloc[offset:]
        if limit and len(filtered) > limit:
            filtered = filtered.iloc[:limit]

        # Select fields
        drop_cols = ['geometry', '_lat_r', '_lng_r']
        filtered = filtered.drop(columns=drop_cols, errors='ignore')
        if field_list:
            keep = [c for c in field_list if c in filtered.columns]
            # Always keep lat/lng if present
            for base in ("lat", "lng"):
                if base in filtered.columns and base not in keep:
                    keep.append(base)
            # Preserve 'type' if present
            if "type" in filtered.columns and "type" not in keep:
                keep.append("type")
            try:
                filtered = filtered[keep]
            except Exception:
                pass

        records = filtered.to_dict(orient="records")
        # Optional normalization
        if NORMALIZE_RELIGION:
            for r in records:
                if 'religion' in r:
                    r['religion'] = places_api._normalize_religion(r.get('religion'))

        result[dataset_name] = records
        result["meta"][dataset_name] = int(total_after)
        total_returned += len(records)
        total_distinct += int(total_after)

    # Meta
    query_time = time.time() - start_time
    result["meta"].update({
        "query_time_ms": round(query_time * 1000, 2),
        "bounds": bounds_list,
        "limit": limit,
        "offset": offset,
        "total_distinct": int(total_distinct),
        "returned": int(total_returned),
        "sort": sort,
        "filters": {
            "confidence_min": conf_min,
            "religions": rel_list,
            "countries": ctry_list,
            "fields": field_list,
        },
    })

    logger.info(
        f"/api/v1/places in {query_time:.3f}s — returned {total_returned} of {total_distinct} across {','.join(datasets_list)}"
    )

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
    # Serve frontend under /frontend to avoid route conflicts with API
    app.mount("/frontend", StaticFiles(directory="frontend", html=True), name="static")

    # Convenience route for the global map
    @app.get("/global-places.html")
    def global_places_page():
        # Redirect so relative asset paths resolve under /frontend/
        fp = Path("frontend") / "global-places.html"
        if fp.exists():
            return RedirectResponse(url="/frontend/global-places.html", status_code=307)
        raise HTTPException(status_code=404, detail="global-places.html not found")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
