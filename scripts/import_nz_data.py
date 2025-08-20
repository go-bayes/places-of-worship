#!/usr/bin/env python3
"""
Import New Zealand religious census and boundary data for proof of concept.
This script transforms the existing /religion repo data into our temporal database schema.
"""

import json
import logging
import asyncio
import asyncpg
import geopandas as gpd
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Any, Optional
import uuid

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class NZDataImporter:
    """Import New Zealand religious census and geographical data."""
    
    def __init__(self, database_url: str):
        self.database_url = database_url
        self.pool: Optional[asyncpg.Pool] = None
        
    async def connect(self):
        """Establish database connection pool."""
        self.pool = await asyncpg.create_pool(
            self.database_url,
            min_size=1,
            max_size=10,
            command_timeout=60
        )
        logger.info("Database connection established")
    
    async def disconnect(self):
        """Close database connection pool."""
        if self.pool:
            await self.pool.close()
            
    async def import_sa2_boundaries(self, sa2_geojson_path: str) -> Dict[str, str]:
        """Import SA2 boundary data into geographic_regions table."""
        logger.info(f"Loading SA2 boundaries from {sa2_geojson_path}")
        
        # Load SA2 boundaries using geopandas
        gdf = gpd.read_file(sa2_geojson_path)
        logger.info(f"Loaded {len(gdf)} SA2 regions")
        
        region_id_map = {}
        
        async with self.pool.acquire() as conn:
            for _, row in gdf.iterrows():
                region_id = str(uuid.uuid4())
                sa2_code = str(row['SA22018_V1_00'])
                sa2_name = row['SA22018_V1_NAME']
                
                # Convert geometry to WKT for PostGIS
                geometry_wkt = row['geometry'].wkt
                
                await conn.execute("""
                    INSERT INTO geographic_regions (
                        region_id, region_type, region_code, region_name,
                        geometry, country_code, administrative_level,
                        valid_from, data_source, created_at
                    ) VALUES ($1, $2, $3, $4, ST_GeomFromText($5, 4326), $6, $7, $8, $9, $10)
                """, region_id, 'nz_sa2', sa2_code, sa2_name, geometry_wkt, 
                'NZ', 3, datetime(2018, 1, 1, tzinfo=timezone.utc), 
                'nz_stats_boundaries', datetime.now(timezone.utc))
                
                region_id_map[sa2_code] = region_id
                
                if len(region_id_map) % 100 == 0:
                    logger.info(f"Imported {len(region_id_map)} SA2 regions")
        
        logger.info(f"Successfully imported {len(region_id_map)} SA2 regions")
        return region_id_map
        
    async def import_religious_census_data(self, religion_json_path: str, region_id_map: Dict[str, str]):
        """Import religious census data into temporal attributes system."""
        logger.info(f"Loading religious census data from {religion_json_path}")
        
        with open(religion_json_path, 'r') as f:
            religion_data = json.load(f)
        
        logger.info(f"Loaded religious data for {len(religion_data)} SA2 regions")
        
        # Create place records for each SA2 region (representing the region itself as a "place")
        place_id_map = {}
        
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                for sa2_code, temporal_data in religion_data.items():
                    if sa2_code not in region_id_map:
                        logger.warning(f"SA2 code {sa2_code} not found in boundaries, skipping")
                        continue
                        
                    # Create a "place" record for this SA2 region
                    place_id = str(uuid.uuid4())
                    
                    # Get region centroid for place geometry
                    centroid_result = await conn.fetchrow("""
                        SELECT ST_AsText(ST_Centroid(geometry)) as centroid
                        FROM geographic_regions 
                        WHERE region_code = $1 AND region_type = 'nz_sa2'
                    """, sa2_code)
                    
                    if not centroid_result:
                        continue
                        
                    await conn.execute("""
                        INSERT INTO places (place_id, canonical_name, geometry, created_at, updated_at)
                        VALUES ($1, $2, ST_GeomFromText($3, 4326), $4, $5)
                    """, place_id, f"SA2 Region {sa2_code}", centroid_result['centroid'],
                    datetime.now(timezone.utc), datetime.now(timezone.utc))
                    
                    # Create place-region association
                    await conn.execute("""
                        INSERT INTO place_region_associations (
                            place_id, region_id, relationship_type, computed_at, computation_method
                        ) VALUES ($1, $2, $3, $4, $5)
                    """, place_id, region_id_map[sa2_code], 'contains', 
                    datetime.now(timezone.utc), 'manual')
                    
                    place_id_map[sa2_code] = place_id
                    
                    # Import temporal religious data
                    for year, year_data in temporal_data.items():
                        census_year = int(year)
                        valid_from = datetime(census_year, 3, 5, tzinfo=timezone.utc)  # NZ Census date
                        
                        # Create temporal attribute record for this census year
                        attribute_id = str(uuid.uuid4())
                        
                        await conn.execute("""
                            INSERT INTO place_attributes (
                                attribute_id, place_id, attribute_type, attribute_value,
                                data_source, valid_from, created_by, created_at,
                                confidence_score, verification_status
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                        """, attribute_id, place_id, 'census_religious_affiliation',
                        json.dumps(year_data), 'nz_stats_census', valid_from,
                        'import_script', datetime.now(timezone.utc), 1.0, 'verified')
                
                logger.info(f"Successfully imported religious census data for {len(place_id_map)} regions")
                
    async def create_materialized_views(self):
        """Create optimized views for proof of concept queries."""
        async with self.pool.acquire() as conn:
            # View for current religious demographics by SA2
            await conn.execute("""
                CREATE MATERIALIZED VIEW IF NOT EXISTS nz_current_religious_demographics AS
                SELECT 
                    gr.region_code as sa2_code,
                    gr.region_name as sa2_name,
                    ST_AsGeoJSON(gr.geometry)::json as geometry,
                    pa.attribute_value as religious_data,
                    EXTRACT(year FROM pa.valid_from)::integer as census_year,
                    pa.confidence_score,
                    pa.created_at as last_updated
                FROM geographic_regions gr
                JOIN place_region_associations pra ON gr.region_id = pra.region_id
                JOIN place_attributes pa ON pra.place_id = pa.place_id
                WHERE gr.region_type = 'nz_sa2'
                  AND pa.attribute_type = 'census_religious_affiliation'
                  AND gr.country_code = 'NZ'
                ORDER BY gr.region_code, census_year;
            """)
            
            # Create indexes for performance
            await conn.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS idx_nz_religious_demographics_unique
                ON nz_current_religious_demographics (sa2_code, census_year);
            """)
            
            logger.info("Created materialized views and indexes")
            
    async def validate_import(self) -> Dict[str, Any]:
        """Validate the imported data and return statistics."""
        async with self.pool.acquire() as conn:
            # Count regions
            region_count = await conn.fetchval("""
                SELECT COUNT(*) FROM geographic_regions WHERE region_type = 'nz_sa2'
            """)
            
            # Count places
            place_count = await conn.fetchval("""
                SELECT COUNT(*) FROM places
            """)
            
            # Count temporal attributes
            attribute_count = await conn.fetchval("""
                SELECT COUNT(*) FROM place_attributes 
                WHERE attribute_type = 'census_religious_affiliation'
            """)
            
            # Count census years
            census_years = await conn.fetch("""
                SELECT DISTINCT EXTRACT(year FROM valid_from)::integer as year
                FROM place_attributes 
                WHERE attribute_type = 'census_religious_affiliation'
                ORDER BY year
            """)
            
            # Sample data validation
            sample_data = await conn.fetchrow("""
                SELECT 
                    gr.region_code,
                    gr.region_name,
                    pa.attribute_value
                FROM geographic_regions gr
                JOIN place_region_associations pra ON gr.region_id = pra.region_id
                JOIN place_attributes pa ON pra.place_id = pa.place_id
                WHERE gr.region_type = 'nz_sa2'
                  AND pa.attribute_type = 'census_religious_affiliation'
                LIMIT 1
            """)
            
            return {
                'regions_imported': region_count,
                'places_created': place_count,
                'temporal_attributes': attribute_count,
                'census_years': [row['year'] for row in census_years],
                'sample_region': sample_data['region_code'] if sample_data else None,
                'sample_data_structure': list(json.loads(sample_data['attribute_value']).keys()) if sample_data else None
            }


async def main():
    """Main import process."""
    # Configuration
    DATABASE_URL = "postgresql://places_user:places_dev_password@localhost:5432/places_of_worship"
    
    # File paths (adjust as needed)
    base_path = Path(__file__).parent.parent
    religion_json_path = base_path / "../religion/religion.json"
    sa2_geojson_path = base_path / "../religion/sa2.geojson"
    
    # Validate file paths
    if not religion_json_path.exists():
        logger.error(f"Religion data file not found: {religion_json_path}")
        return
        
    if not sa2_geojson_path.exists():
        logger.error(f"SA2 boundary file not found: {sa2_geojson_path}")
        return
    
    logger.info("Starting New Zealand data import for proof of concept")
    
    importer = NZDataImporter(DATABASE_URL)
    
    try:
        await importer.connect()
        
        # Import geographical boundaries
        region_id_map = await importer.import_sa2_boundaries(str(sa2_geojson_path))
        
        # Import religious census data
        await importer.import_religious_census_data(str(religion_json_path), region_id_map)
        
        # Create optimized views
        await importer.create_materialized_views()
        
        # Validate import
        validation_results = await importer.validate_import()
        
        logger.info("Import validation results:")
        for key, value in validation_results.items():
            logger.info(f"  {key}: {value}")
        
        logger.info("New Zealand data import completed successfully!")
        
    except Exception as e:
        logger.error(f"Import failed: {e}")
        raise
        
    finally:
        await importer.disconnect()


if __name__ == "__main__":
    asyncio.run(main())