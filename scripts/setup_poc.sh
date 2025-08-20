#!/bin/bash
set -e

# Places of Worship - Proof of Concept Setup Script
# This script sets up the complete proof of concept environment

echo "🏛️  Places of Worship - Proof of Concept Setup"
echo "=============================================="

# Check if Docker is installed and running
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! docker info &> /dev/null; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

echo "✅ Docker is available"

# Check if required source data exists
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RELIGION_DATA="../religion/religion.json"
SA2_DATA="../religion/sa2.geojson"

if [ ! -f "$RELIGION_DATA" ]; then
    echo "❌ Required data file not found: $RELIGION_DATA"
    echo "   Please ensure the /religion repository is available as a sibling directory"
    exit 1
fi

if [ ! -f "$SA2_DATA" ]; then
    echo "❌ Required data file not found: $SA2_DATA"
    echo "   Please ensure the /religion repository is available as a sibling directory"
    exit 1
fi

echo "✅ Required data files found"

# Create necessary directories
mkdir -p "$BASE_DIR/docker/volumes/postgres"
mkdir -p "$BASE_DIR/docker/volumes/redis"

# Build and start services
echo ""
echo "📦 Building and starting services..."
cd "$BASE_DIR/docker"

# Start database and cache services first
docker-compose up -d postgres redis

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
until docker-compose exec -T postgres pg_isready -U places_user -d places_of_worship; do
    echo "   Waiting for PostgreSQL..."
    sleep 2
done

echo "✅ PostgreSQL is ready"

# Install Python dependencies for import script
echo ""
echo "📥 Installing Python dependencies..."
cd "$BASE_DIR"

if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
else
    echo "❌ Python 3 is required but not found"
    exit 1
fi

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "   Creating Python virtual environment..."
    $PYTHON_CMD -m venv venv
fi

# Activate virtual environment and install dependencies
source venv/bin/activate
pip install --upgrade pip
pip install -r api/requirements.txt

echo "✅ Python dependencies installed"

# Import data
echo ""
echo "📊 Importing New Zealand data..."
cd scripts
$PYTHON_CMD import_nz_data.py

if [ $? -eq 0 ]; then
    echo "✅ Data import completed successfully"
else
    echo "❌ Data import failed"
    exit 1
fi

# Start API service
echo ""
echo "🚀 Starting API service..."
cd "$BASE_DIR/docker"
docker-compose up -d api

# Wait for API to be ready
echo "⏳ Waiting for API to be ready..."
sleep 10

# Test API health
API_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/v1/health || echo "000")
if [ "$API_HEALTH" = "200" ]; then
    echo "✅ API is running and healthy"
else
    echo "⚠️  API may not be fully ready yet (HTTP $API_HEALTH)"
    echo "   You can check the logs with: docker-compose logs api"
fi

# Start simple HTTP server for frontend
echo ""
echo "🌐 Starting frontend server..."
cd "$BASE_DIR/frontend/src"

# Find available Python HTTP server
if $PYTHON_CMD -m http.server --help &> /dev/null; then
    echo "   Starting Python HTTP server on port 8080..."
    nohup $PYTHON_CMD -m http.server 8080 > /dev/null 2>&1 &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > "$BASE_DIR/.frontend_pid"
elif command -v npx &> /dev/null && command -v serve &> /dev/null; then
    echo "   Starting Node.js serve on port 8080..."
    nohup npx serve -p 8080 . > /dev/null 2>&1 &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > "$BASE_DIR/.frontend_pid"
else
    echo "⚠️  Could not start frontend server automatically."
    echo "   Please serve the files in frontend/src/ on http://localhost:8080"
fi

echo ""
echo "🎉 Proof of Concept Setup Complete!"
echo "=================================="
echo ""
echo "📍 Access Points:"
echo "   Frontend:  http://localhost:8080"
echo "   API:       http://localhost:3000/api/v1"
echo "   Database:  postgresql://places_user:places_dev_password@localhost:5432/places_of_worship"
echo ""
echo "🔧 Management Commands:"
echo "   View logs:    docker-compose -f docker/docker-compose.yml logs"
echo "   Stop services: docker-compose -f docker/docker-compose.yml down"
echo "   Restart API:  docker-compose -f docker/docker-compose.yml restart api"
echo ""
echo "📊 Test API endpoints:"
echo "   curl http://localhost:3000/api/v1/health"
echo "   curl http://localhost:3000/api/v1/nz/metadata"
echo ""
echo "Happy exploring! 🗺️"