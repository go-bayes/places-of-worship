#!/usr/bin/env python3
"""
Places of Worship API - Proof of Concept
Flask-based REST API serving New Zealand religious demographics data.
"""

import json
import asyncio
from datetime import datetime
from typing import Dict, List, Optional, Any
import asyncpg
import redis
from flask import Flask, jsonify, request
from flask_cors import CORS
import logging
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend development

# Configuration
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://places_user:places_dev_password@localhost:5432/places_of_worship')
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')

# Global connection pool
db_pool: Optional[asyncpg.Pool] = None
cache_client: Optional[redis.Redis] = None

class NZReligiousDataAPI:
    """API handler for New Zealand religious demographics data."""
    
    def __init__(self, db_pool: asyncpg.Pool, cache_client: redis.Redis):
        self.db_pool = db_pool
        self.cache = cache_client
        
    async def get_sa2_boundaries_geojson(self) -> Dict[str, Any]:
        """Get SA2 boundaries as GeoJSON for map rendering."""
        cache_key = "nz_sa2_boundaries_geojson"
        
        # Check cache first
        cached = self.cache.get(cache_key)
        if cached:
            return json.loads(cached)
            
        async with self.db_pool.acquire() as conn:
            # Query SA2 boundaries with geometry
            rows = await conn.fetch("""
                SELECT 
                    region_code as sa2_code,
                    region_name as sa2_name,
                    ST_AsGeoJSON(geometry) as geometry
                FROM geographic_regions 
                WHERE region_type = 'nz_sa2' 
                  AND country_code = 'NZ'
                ORDER BY region_code
            """)
            
            # Build GeoJSON structure
            features = []
            for row in rows:
                feature = {
                    "type": "Feature",
                    "geometry": json.loads(row['geometry']),
                    "properties": {
                        "SA22018_V1_00": row['sa2_code'],
                        "SA22018_V1_NAME": row['sa2_name']
                    }
                }
                features.append(feature)
            
            geojson = {
                "type": "FeatureCollection",
                "features": features
            }
            
            # Cache for 1 hour (boundaries don't change often)
            self.cache.setex(cache_key, 3600, json.dumps(geojson))
            
            return geojson
    
    async def get_religious_demographics_json(self) -> Dict[str, Any]:
        """Get religious demographics in the same format as original religion.json."""
        cache_key = "nz_religious_demographics_json"
        
        # Check cache first
        cached = self.cache.get(cache_key)
        if cached:
            return json.loads(cached)
            
        async with self.db_pool.acquire() as conn:
            # Query religious demographics data
            rows = await conn.fetch("""
                SELECT 
                    gr.region_code as sa2_code,
                    EXTRACT(year FROM pa.valid_from)::integer as census_year,
                    pa.attribute_value as religious_data
                FROM geographic_regions gr
                JOIN place_region_associations pra ON gr.region_id = pra.region_id
                JOIN place_attributes pa ON pra.place_id = pa.place_id
                WHERE gr.region_type = 'nz_sa2'
                  AND pa.attribute_type = 'census_religious_affiliation'
                  AND gr.country_code = 'NZ'
                ORDER BY gr.region_code, census_year
            """)
            
            # Transform to match original religion.json structure
            religion_data = {}
            
            for row in rows:
                sa2_code = row['sa2_code']
                census_year = str(row['census_year'])
                year_data = json.loads(row['religious_data'])
                
                if sa2_code not in religion_data:
                    religion_data[sa2_code] = {}
                    
                religion_data[sa2_code][census_year] = year_data
            
            # Cache for 30 minutes
            self.cache.setex(cache_key, 1800, json.dumps(religion_data))
            
            return religion_data
    
    async def get_regional_summary(self, sa2_code: str) -> Optional[Dict[str, Any]]:
        """Get detailed summary for a specific SA2 region."""
        async with self.db_pool.acquire() as conn:
            # Get region info and all census years
            rows = await conn.fetch("""
                SELECT 
                    gr.region_code,
                    gr.region_name,
                    EXTRACT(year FROM pa.valid_from)::integer as census_year,
                    pa.attribute_value as religious_data,
                    pa.confidence_score,
                    pa.created_at
                FROM geographic_regions gr
                JOIN place_region_associations pra ON gr.region_id = pra.region_id
                JOIN place_attributes pa ON pra.place_id = pa.place_id
                WHERE gr.region_code = $1
                  AND gr.region_type = 'nz_sa2'
                  AND pa.attribute_type = 'census_religious_affiliation'
                ORDER BY census_year
            """, sa2_code)
            
            if not rows:
                return None
                
            # Build summary
            region_info = {
                'sa2_code': rows[0]['region_code'],
                'sa2_name': rows[0]['region_name'],
                'temporal_data': {},
                'summary_stats': {
                    'years_available': [],
                    'data_quality': 'high',  # Based on confidence scores
                    'last_updated': rows[-1]['created_at'].isoformat()
                }
            }
            
            for row in rows:
                year = str(row['census_year'])
                region_info['temporal_data'][year] = json.loads(row['religious_data'])
                region_info['summary_stats']['years_available'].append(row['census_year'])
            
            return region_info
    
    async def get_temporal_analysis(self, start_year: int = 2006, end_year: int = 2018) -> Dict[str, Any]:
        """Get temporal analysis of religious trends across all SA2 regions."""
        async with self.db_pool.acquire() as conn:
            # Query for temporal trends
            rows = await conn.fetch("""
                WITH yearly_data AS (
                    SELECT 
                        gr.region_code,
                        EXTRACT(year FROM pa.valid_from)::integer as census_year,
                        (pa.attribute_value->>'No religion')::integer as no_religion_count,
                        (pa.attribute_value->>'Total stated')::integer as total_stated
                    FROM geographic_regions gr
                    JOIN place_region_associations pra ON gr.region_id = pra.region_id
                    JOIN place_attributes pa ON pra.place_id = pa.place_id
                    WHERE gr.region_type = 'nz_sa2'
                      AND pa.attribute_type = 'census_religious_affiliation'
                      AND EXTRACT(year FROM pa.valid_from) BETWEEN $1 AND $2
                      AND (pa.attribute_value->>'Total stated')::integer > 0
                )
                SELECT 
                    region_code,
                    census_year,
                    no_religion_count,
                    total_stated,
                    (no_religion_count::float / total_stated * 100) as no_religion_pct
                FROM yearly_data
                ORDER BY region_code, census_year
            """, start_year, end_year)
            
            # Calculate trends
            regional_trends = {}
            
            for row in rows:
                sa2_code = row['region_code']
                
                if sa2_code not in regional_trends:
                    regional_trends[sa2_code] = {
                        'years': [],
                        'no_religion_percentages': [],
                        'total_population': []
                    }
                
                regional_trends[sa2_code]['years'].append(row['census_year'])
                regional_trends[sa2_code]['no_religion_percentages'].append(round(row['no_religion_pct'], 1))
                regional_trends[sa2_code]['total_population'].append(row['total_stated'])
            
            # Calculate change statistics
            trend_summary = {
                'total_regions': len(regional_trends),
                'analysis_period': f"{start_year}-{end_year}",
                'regional_changes': {}
            }
            
            for sa2_code, data in regional_trends.items():
                if len(data['no_religion_percentages']) >= 2:
                    first_pct = data['no_religion_percentages'][0]
                    last_pct = data['no_religion_percentages'][-1]
                    change = last_pct - first_pct
                    
                    trend_summary['regional_changes'][sa2_code] = {
                        'start_percentage': first_pct,
                        'end_percentage': last_pct,
                        'percentage_point_change': round(change, 1),
                        'trend': 'increasing' if change > 1 else 'decreasing' if change < -1 else 'stable'
                    }
            
            return {
                'temporal_analysis': trend_summary,
                'regional_data': regional_trends
            }


# Initialize API handler
api_handler: Optional[NZReligiousDataAPI] = None

@app.route('/api/v1/health')
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'database': 'connected' if db_pool else 'disconnected',
        'cache': 'connected' if cache_client else 'disconnected'
    })

@app.route('/api/v1/nz/boundaries/sa2.geojson')
async def get_sa2_boundaries():
    """Get SA2 boundaries as GeoJSON - compatible with existing Leaflet code."""
    try:
        geojson = await api_handler.get_sa2_boundaries_geojson()
        
        response = jsonify(geojson)
        response.headers['Content-Type'] = 'application/geo+json'
        response.headers['Cache-Control'] = 'public, max-age=3600'
        
        return response
    except Exception as e:
        logger.error(f"Error fetching SA2 boundaries: {e}")
        return jsonify({'error': 'Failed to fetch boundaries'}), 500

@app.route('/api/v1/nz/demographics/religion.json')
async def get_religious_demographics():
    """Get religious demographics - compatible with existing religion.json format."""
    try:
        religion_data = await api_handler.get_religious_demographics_json()
        
        response = jsonify(religion_data)
        response.headers['Cache-Control'] = 'public, max-age=1800'
        
        # Add attribution header
        response.headers['X-Attribution'] = '© Statistics New Zealand, licensed under CC BY 4.0'
        
        return response
    except Exception as e:
        logger.error(f"Error fetching religious demographics: {e}")
        return jsonify({'error': 'Failed to fetch demographics data'}), 500

@app.route('/api/v1/nz/regions/<sa2_code>/summary')
async def get_region_summary(sa2_code: str):
    """Get detailed summary for specific SA2 region."""
    try:
        summary = await api_handler.get_regional_summary(sa2_code)
        
        if not summary:
            return jsonify({'error': 'Region not found'}), 404
            
        return jsonify(summary)
    except Exception as e:
        logger.error(f"Error fetching region summary for {sa2_code}: {e}")
        return jsonify({'error': 'Failed to fetch region summary'}), 500

@app.route('/api/v1/nz/analysis/temporal')
async def get_temporal_analysis():
    """Get temporal analysis of religious trends."""
    start_year = request.args.get('start_year', 2006, type=int)
    end_year = request.args.get('end_year', 2018, type=int)
    
    try:
        analysis = await api_handler.get_temporal_analysis(start_year, end_year)
        return jsonify(analysis)
    except Exception as e:
        logger.error(f"Error performing temporal analysis: {e}")
        return jsonify({'error': 'Failed to perform analysis'}), 500

@app.route('/api/v1/nz/metadata')
def get_metadata():
    """Get dataset metadata and attribution information."""
    return jsonify({
        'dataset': 'New Zealand Religious Demographics',
        'geographic_scope': 'New Zealand SA2 Statistical Areas',
        'temporal_scope': '2006-2018 Census Years',
        'last_updated': '2024-01-01',  # Would be dynamic in production
        'attribution': {
            'data_source': 'Statistics New Zealand',
            'license': 'CC BY 4.0',
            'boundaries': 'New Zealand SA2 Statistical Area boundaries 2018',
            'demographics': 'New Zealand Census religious affiliation data'
        },
        'api_version': 'v1.0-proof-of-concept',
        'contact': 'places-of-worship-project@research.institution'
    })

async def init_app():
    """Initialize database connections and API handler."""
    global db_pool, cache_client, api_handler
    
    try:
        # Initialize database connection pool
        db_pool = await asyncpg.create_pool(
            DATABASE_URL,
            min_size=2,
            max_size=10,
            command_timeout=30
        )
        
        # Initialize Redis cache
        cache_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)
        
        # Test connections
        async with db_pool.acquire() as conn:
            await conn.fetchval('SELECT 1')
        cache_client.ping()
        
        # Initialize API handler
        api_handler = NZReligiousDataAPI(db_pool, cache_client)
        
        logger.info("API initialized successfully")
        
    except Exception as e:
        logger.error(f"Failed to initialize API: {e}")
        raise

if __name__ == '__main__':
    # Initialize the application
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(init_app())
    
    # Run Flask app
    app.run(host='0.0.0.0', port=3000, debug=True)