#!/bin/bash
set -e

# Places of Worship - Proof of Concept Cleanup Script
# This script cleanly shuts down the proof of concept environment

echo "🧹 Places of Worship - Proof of Concept Cleanup"
echo "=============================================="

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Stop Docker services
echo "🛑 Stopping Docker services..."
cd "$BASE_DIR/docker"
docker-compose down

echo "✅ Docker services stopped"

# Stop frontend server if it exists
if [ -f "$BASE_DIR/.frontend_pid" ]; then
    FRONTEND_PID=$(cat "$BASE_DIR/.frontend_pid")
    if kill -0 $FRONTEND_PID 2>/dev/null; then
        echo "🛑 Stopping frontend server (PID: $FRONTEND_PID)..."
        kill $FRONTEND_PID
        echo "✅ Frontend server stopped"
    fi
    rm -f "$BASE_DIR/.frontend_pid"
fi

# Optional: Remove Docker volumes (uncomment if you want to clean data)
read -p "🗑️  Do you want to remove all data volumes? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🗑️  Removing Docker volumes..."
    docker-compose down -v
    docker volume prune -f
    echo "✅ Docker volumes removed"
else
    echo "💾 Data volumes preserved"
fi

# Optional: Remove Docker images (uncomment if you want to clean everything)
read -p "🗑️  Do you want to remove Docker images? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🗑️  Removing Docker images..."
    docker image prune -f
    # Remove specific images if they exist
    docker rmi places-of-worship_api 2>/dev/null || true
    echo "✅ Docker images removed"
else
    echo "🖼️  Docker images preserved"
fi

echo ""
echo "🎉 Cleanup Complete!"
echo "==================="
echo ""
echo "To restart the proof of concept, run:"
echo "  ./scripts/setup_poc.sh"