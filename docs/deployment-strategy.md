# Deployment Strategy - Global Scale with Local Performance

## Overview

Deployment architecture that maintains the religion repository's sub-second query performance while scaling to global coverage. Designed for university research environments with flexibility for cloud deployment when needed.

## Performance Preservation Strategy

### Core Performance Characteristics to Maintain
- **Sub-500ms response times** for 100K+ points via WebGL
- **Viewport-based data loading** with spatial indexing
- **Client-side clustering** for smooth map interaction  
- **Concurrent user support** without performance degradation
- **Minimal bandwidth usage** through efficient data formats

### Architecture Principles
1. **Keep proven components**: FastAPI + Parquet + Leaflet.glify stack
2. **Add, don't replace**: Extend existing architecture rather than rebuild
3. **Performance isolation**: Heavy analytics separate from map rendering
4. **Progressive enhancement**: Start local, scale to cloud when needed

## Deployment Options

### Option 1: Local Development & Small Research Teams

#### Infrastructure Requirements
```yaml
# docker-compose.yml for local deployment
version: '3.8'
services:
  api:
    build: ./api
    ports:
      - "8000:8000"
    volumes:
      - ./data:/app/data:ro
      - ./cache:/app/cache
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/places
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis

  db:
    image: postgis/postgis:15-3.3
    environment:
      - POSTGRES_DB=places
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/schemas:/docker-entrypoint-initdb.d

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - API_BASE_URL=http://api:8000
    depends_on:
      - api

volumes:
  postgres_data:
  redis_data:
```

#### Resource Allocation
- **CPU**: 8 cores (4 for API, 2 for DB, 2 for processing)
- **RAM**: 32GB (16GB for data, 8GB for cache, 8GB for processing)
- **Storage**: 500GB SSD (100GB data, 400GB for temporal storage)
- **Network**: Standard university connection sufficient

#### Local Performance Optimisation
```python
# config/local.py
LOCAL_CONFIG = {
    'database': {
        'max_connections': 20,
        'shared_buffers': '8GB',
        'effective_cache_size': '16GB',
        'work_mem': '256MB'
    },
    'api': {
        'workers': 4,
        'max_concurrent_requests': 100,
        'query_timeout': 30
    },
    'cache': {
        'redis_maxmemory': '4GB',
        'spatial_cache_ttl': 3600,
        'api_cache_ttl': 300
    }
}
```

### Option 2: University Infrastructure Deployment

#### Kubernetes Configuration
```yaml
# k8s/places-api-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: places-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: places-api
  template:
    metadata:
      labels:
        app: places-api
    spec:
      containers:
      - name: api
        image: places-of-worship/api:latest
        ports:
        - containerPort: 8000
        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: url
        - name: REDIS_URL
          valueFrom:
            configMapKeyRef:
              name: cache-config
              key: redis-url
        volumeMounts:
        - name: data-volume
          mountPath: /app/data
          readOnly: true
      volumes:
      - name: data-volume
        persistentVolumeClaim:
          claimName: places-data-pvc
```

#### Load Balancing Strategy
```yaml
# k8s/places-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: places-api-service
spec:
  selector:
    app: places-api
  ports:
  - protocol: TCP
    port: 80
    targetPort: 8000
  type: LoadBalancer

---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: places-ingress
  annotations:
    nginx.ingress.kubernetes.io/rate-limit: "1000"
    nginx.ingress.kubernetes.io/enable-cors: "true"
spec:
  rules:
  - host: places.university.edu
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: places-api-service
            port:
              number: 80
      - path: /
        pathType: Prefix
        backend:
          service:
            name: places-frontend-service
            port:
              number: 80
```

### Option 3: Cloud Deployment (AWS/GCP/Azure)

#### Auto-Scaling Configuration
```yaml
# cloud/auto-scaling.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: places-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: places-api
  minReplicas: 2
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 120
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 25
        periodSeconds: 120
```

#### CDN & Caching Strategy
```python
# cloud/cdn_config.py
CDN_CONFIG = {
    'static_assets': {
        'provider': 'cloudflare',
        'cache_ttl': 86400,  # 24 hours
        'compression': True,
        'minification': True
    },
    'parquet_files': {
        'provider': 'aws_cloudfront',
        'cache_ttl': 3600,   # 1 hour
        'geographic_distribution': True,
        'edge_locations': ['us-east-1', 'eu-west-1', 'ap-southeast-1']
    },
    'api_responses': {
        'provider': 'fastly',
        'cache_ttl': 300,    # 5 minutes
        'vary_headers': ['Accept-Encoding', 'Origin'],
        'purge_tags': ['places', 'regions', 'demographics']
    }
}
```

## Database Deployment Strategy

### Master-Replica Configuration
```sql
-- Master database configuration
-- postgresql.conf optimisations for write-heavy workloads
shared_buffers = 8GB
effective_cache_size = 24GB
maintenance_work_mem = 2GB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200

-- Read replica configuration  
-- Optimised for analytical queries
shared_buffers = 16GB
effective_cache_size = 48GB
work_mem = 512MB
max_parallel_workers_per_gather = 4
max_parallel_workers = 8
```

### Partitioning Strategy
```sql
-- Partition place_attributes by country for performance
CREATE TABLE place_attributes_us PARTITION OF place_attributes
FOR VALUES IN ('US');

CREATE TABLE place_attributes_nz PARTITION OF place_attributes  
FOR VALUES IN ('NZ');

CREATE TABLE place_attributes_gb PARTITION OF place_attributes
FOR VALUES IN ('GB');

-- Partition by date for historical data
CREATE TABLE place_attributes_recent PARTITION OF place_attributes
FOR VALUES FROM ('2020-01-01') TO ('2025-01-01');

CREATE TABLE place_attributes_historical PARTITION OF place_attributes
FOR VALUES FROM ('2000-01-01') TO ('2020-01-01');
```

### Backup & Recovery Strategy
```bash
#!/bin/bash
# backup/daily_backup.sh

# Full database backup (weekly)
if [ $(date +%u) -eq 7 ]; then
    pg_basebackup -D /backups/full/$(date +%Y%m%d) -Ft -z -P
fi

# Incremental WAL shipping (continuous)
archive_command = 'rsync %p backup-server:/backups/wal/%f'

# Point-in-time recovery capability
recovery_target_time = '2024-08-20 10:30:00 UTC'
```

## API Performance Optimisation

### Connection Pooling
```python
# api/db.py
from sqlalchemy.pool import QueuePool
from sqlalchemy import create_engine

# Production database connection
engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=20,
    max_overflow=30,
    pool_recycle=3600,
    pool_pre_ping=True,
    echo=False
)

# Read replica for analytics
read_engine = create_engine(
    READ_REPLICA_URL,
    poolclass=QueuePool,
    pool_size=10,
    max_overflow=20,
    pool_recycle=3600
)
```

### Async Query Processing
```python
# api/handlers.py
from fastapi import FastAPI, BackgroundTasks
import asyncio

app = FastAPI()

@app.get("/api/v1/places")
async def get_places(bounds: str, datasets: str = "churches"):
    # Parse and validate parameters
    bbox = parse_bounds(bounds)
    
    # Async spatial query
    query_task = asyncio.create_task(
        execute_spatial_query(bbox, datasets)
    )
    
    # Parallel cache check
    cache_task = asyncio.create_task(
        check_cache(bounds, datasets)
    )
    
    # Wait for fastest response
    cache_result = await cache_task
    if cache_result:
        return cache_result
    
    # Otherwise wait for database query
    db_result = await query_task
    
    # Cache result for future requests
    await cache_result_async(bounds, datasets, db_result)
    
    return db_result
```

### Caching Strategy
```python
# api/cache.py
import redis
import json
from typing import Dict, Optional

class SpatialCache:
    def __init__(self):
        self.redis = redis.Redis(
            host='redis',
            port=6379,
            decode_responses=True,
            max_connections=50
        )
    
    def cache_key(self, bounds: str, datasets: str, zoom: int) -> str:
        """Generate consistent cache key for spatial queries"""
        return f"places:{bounds}:{datasets}:z{zoom}"
    
    async def get_cached_result(self, bounds: str, datasets: str, zoom: int) -> Optional[Dict]:
        """Retrieve cached query result"""
        key = self.cache_key(bounds, datasets, zoom)
        cached = self.redis.get(key)
        
        if cached:
            return json.loads(cached)
        return None
    
    async def cache_result(self, bounds: str, datasets: str, zoom: int, result: Dict):
        """Cache query result with appropriate TTL"""
        key = self.cache_key(bounds, datasets, zoom)
        
        # Longer cache for stable areas, shorter for high-change areas
        ttl = 3600 if zoom < 10 else 300  # 1 hour vs 5 minutes
        
        self.redis.setex(
            key,
            ttl,
            json.dumps(result, separators=(',', ':'))
        )
```

## Monitoring & Alerting

### Application Monitoring
```python
# monitoring/metrics.py
from prometheus_client import Counter, Histogram, Gauge
import time

# Custom metrics
api_requests_total = Counter('api_requests_total', 'Total API requests', ['endpoint', 'method'])
query_duration = Histogram('query_duration_seconds', 'Database query duration')
active_connections = Gauge('db_connections_active', 'Active database connections')
cache_hit_rate = Gauge('cache_hit_rate', 'Cache hit rate percentage')

class PerformanceMonitor:
    def track_api_request(self, endpoint: str, method: str):
        """Track API request metrics"""
        api_requests_total.labels(endpoint=endpoint, method=method).inc()
    
    def track_query_time(self, query_func):
        """Decorator to track database query performance"""
        def wrapper(*args, **kwargs):
            start_time = time.time()
            result = query_func(*args, **kwargs)
            duration = time.time() - start_time
            query_duration.observe(duration)
            
            # Alert if query takes too long
            if duration > 5.0:
                self.alert_slow_query(query_func.__name__, duration)
                
            return result
        return wrapper
    
    def alert_slow_query(self, query_name: str, duration: float):
        """Alert administrators of slow queries"""
        alert_message = f"Slow query detected: {query_name} took {duration:.2f}s"
        # Send to monitoring system (PagerDuty, Slack, etc.)
        self.send_alert(alert_message, severity='warning')
```

### Health Checks
```python
# monitoring/health.py
from fastapi import HTTPException
import asyncio

class HealthChecker:
    async def check_database_health(self) -> bool:
        """Verify database connectivity and performance"""
        try:
            start_time = time.time()
            result = await execute_query("SELECT 1")
            duration = time.time() - start_time
            
            return duration < 1.0 and result is not None
        except Exception:
            return False
    
    async def check_cache_health(self) -> bool:
        """Verify Redis connectivity"""
        try:
            response = self.redis.ping()
            return response is True
        except Exception:
            return False
    
    async def check_spatial_query_performance(self) -> bool:
        """Test actual query performance"""
        test_bounds = "-41.5,-174.5,-41.0,-174.0"  # Small NZ area
        
        start_time = time.time()
        result = await get_places(test_bounds, limit=1000)
        duration = time.time() - start_time
        
        return duration < 0.5 and len(result.get('churches', [])) > 0
```

## Migration Strategy

### From Religion Repository to Global System

#### Phase 1: Parallel Deployment
```bash
# deployment/migration.sh

# 1. Deploy new system alongside existing religion repo
kubectl apply -f k8s/places-deployment.yaml

# 2. Import existing religion repo data
python migration/import_religion_data.py

# 3. Test API compatibility
python migration/test_compatibility.py

# 4. Gradually migrate traffic
nginx_conf="
upstream religion_backend {
    server religion-api:8000 weight=90;
    server places-api:8000 weight=10;
}
"
```

#### Phase 2: Data Synchronisation
```python
# migration/sync_data.py
def sync_with_religion_repo():
    """Keep both systems in sync during migration"""
    
    # Export from religion repository
    religion_data = fetch_from_religion_api()
    
    # Import to new system with validation
    for place in religion_data:
        validated = validate_place_data(place)
        if validated:
            import_to_new_system(validated)
    
    # Verify data consistency
    assert verify_data_consistency()
```

### Zero-Downtime Deployment
```yaml
# deployment/rolling-update.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: places-api
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 25%
      maxSurge: 25%
  template:
    spec:
      containers:
      - name: api
        image: places-api:latest
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 10
          periodSeconds: 5
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
```

## Cost Optimisation

### Resource Efficiency
- **Development**: Single machine deployment (~$100/month cloud)
- **University**: Existing infrastructure utilisation (minimal cost)
- **Production**: Auto-scaling prevents over-provisioning (~$500-2000/month depending on usage)

### Data Storage Optimisation
- **Parquet compression**: 70% size reduction over JSON
- **Tiered storage**: Recent data on SSD, historical on cheaper storage
- **Cache hit rates**: 80%+ reduces database load significantly

This deployment strategy maintains your proven performance characteristics while providing clear scaling paths from local development to global production deployment.