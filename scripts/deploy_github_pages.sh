#!/bin/bash
"""
Deploy Enhanced Places of Worship Map to GitHub Pages
Creates a complete static deployment with all features
"""

set -e  # Exit on any error

# Configuration
REPO_NAME="places-of-worship"
GITHUB_USERNAME="go-bayes"  # Update this to your GitHub username
FRONTEND_DIR="frontend"
TEMP_DEPLOY_DIR="gh-pages-temp"

echo "🚀 Deploying Enhanced Places of Worship Map to GitHub Pages"
echo "=================================================="

# Check if we're in the right directory
if [ ! -d "$FRONTEND_DIR" ]; then
    echo "❌ Error: Must run from repository root (frontend/ directory not found)"
    exit 1
fi

# Create temporary deployment directory
echo "📁 Creating temporary deployment directory..."
rm -rf $TEMP_DEPLOY_DIR
mkdir -p $TEMP_DEPLOY_DIR

# Copy frontend files
echo "📋 Copying frontend files..."
cp -r $FRONTEND_DIR/* $TEMP_DEPLOY_DIR/

# Create optimized index.html (main entry point)
echo "🏠 Creating main index.html..."
cat > $TEMP_DEPLOY_DIR/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Places of Worship - New Zealand</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #2c3e50, #3498db);
            color: white;
            min-height: 100vh;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            text-align: center;
        }
        h1 {
            font-size: 3em;
            margin-bottom: 20px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        .subtitle {
            font-size: 1.3em;
            margin-bottom: 40px;
            opacity: 0.9;
        }
        .map-options {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin: 40px 0;
        }
        .map-card {
            background: rgba(255, 255, 255, 0.95);
            color: #2c3e50;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
            transition: transform 0.3s ease;
            text-decoration: none;
        }
        .map-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 8px 30px rgba(0,0,0,0.3);
        }
        .map-card h2 {
            margin: 0 0 15px 0;
            color: #2c3e50;
        }
        .map-card p {
            margin: 10px 0;
            line-height: 1.6;
        }
        .features {
            list-style: none;
            padding: 0;
            text-align: left;
        }
        .features li {
            margin: 8px 0;
            padding-left: 20px;
            position: relative;
        }
        .features li:before {
            content: "✓";
            position: absolute;
            left: 0;
            color: #27ae60;
            font-weight: bold;
        }
        .footer {
            margin-top: 60px;
            padding-top: 20px;
            border-top: 1px solid rgba(255,255,255,0.2);
            font-size: 0.9em;
            opacity: 0.8;
        }
        .github-link {
            color: white;
            text-decoration: none;
            margin: 0 10px;
        }
        .github-link:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Places of Worship</h1>
        <p class="subtitle">Interactive mapping of religious communities across New Zealand</p>
        
        <div class="map-options">
            <a href="enhanced-places.html" class="map-card">
                <h2>🗺️ Enhanced Demographic Map</h2>
                <p><strong>Complete visualization with comprehensive demographic overlays</strong></p>
                <ul class="features">
                    <li>3,370 places of worship from OpenStreetMap</li>
                    <li>Age, gender, ethnicity & income demographics</li>
                    <li>Religious category filtering (Christian, Islam, Buddhism, etc.)</li>
                    <li>Multiple map styles (satellite, terrain, grayscale)</li>
                    <li>Regional census data overlay (2006-2018)</li>
                    <li>Interactive clustering & detailed popups</li>
                </ul>
            </a>
            
            <a href="places.html" class="map-card">
                <h2>📍 Simple Places Map</h2>
                <p><strong>Clean, focused view of places of worship</strong></p>
                <ul class="features">
                    <li>Individual place markers with clustering</li>
                    <li>Denomination filtering & search</li>
                    <li>Data quality indicators</li>
                    <li>Fast loading & mobile-friendly</li>
                    <li>OpenStreetMap data attribution</li>
                </ul>
            </a>
        </div>
        
        <div class="footer">
            <p>
                <strong>Data Sources:</strong> 
                <a href="https://www.openstreetmap.org/copyright" target="_blank" class="github-link">OpenStreetMap</a> |
                <a href="https://www.stats.govt.nz/" target="_blank" class="github-link">Statistics New Zealand</a>
            </p>
            <p>
                <a href="https://github.com/go-bayes/places-of-worship" target="_blank" class="github-link">📱 View on GitHub</a> |
                <a href="https://claude.ai/code" target="_blank" class="github-link">🤖 Built with Claude Code</a>
            </p>
        </div>
    </div>
</body>
</html>
EOF

# Create README for GitHub Pages
echo "📖 Creating GitHub Pages README..."
cat > $TEMP_DEPLOY_DIR/README.md << 'EOF'
# Places of Worship - New Zealand

Interactive mapping application showing places of worship across New Zealand with comprehensive demographic analysis.

## 🗺️ Live Maps

- **[Enhanced Demographic Map](enhanced-places.html)** - Full-featured visualization with age, gender, ethnicity, and income overlays
- **[Simple Places Map](places.html)** - Clean view focused on place locations and denominations

## 📊 Features

### Data Coverage
- **3,370 places of worship** extracted from OpenStreetMap
- **2,128 SA2 regions** with comprehensive demographics
- **Religious denominations** including Christian, Islam, Buddhism, Judaism, Hinduism, Sikhism
- **Temporal data** from 2006, 2013, and 2018 New Zealand Census

### Interactive Features
- **Hierarchical filtering** by major religion and specific denomination
- **Multiple map styles** (standard, grayscale, dark, satellite, terrain)
- **Demographic overlays** showing age, gender, ethnicity, income patterns
- **Clustering** for performance with thousands of markers
- **Rich popups** with detailed place and regional information

### Technical Implementation
- **Client-side rendering** with Leaflet.js
- **Responsive design** works on desktop and mobile
- **Static deployment** compatible with GitHub Pages
- **Open data** with proper attribution

## 🎯 Use Cases

- **Academic research** into religious communities and demographics
- **Community planning** and resource allocation
- **Cultural analysis** of religious diversity patterns
- **Educational** exploration of New Zealand's religious landscape

## 📈 Data Quality

- **High confidence**: ≥80% data quality (340 places)
- **Medium confidence**: ≥60% data quality (2,703 places)  
- **Low confidence**: <60% data quality (327 places)

Confidence scores based on data completeness, source reliability, and cross-validation.

## 🔗 Attribution

- **Places Data**: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) under ODbL
- **Census Data**: © [Statistics New Zealand](https://www.stats.govt.nz/) under CC BY 4.0
- **Map Tiles**: Various providers (OpenStreetMap, CartoDB, Esri, OpenTopoMap)

---

**Built with**: Leaflet.js, JavaScript ES6+, HTML5, CSS3  
**Generated with**: [Claude Code](https://claude.ai/code)  
**Repository**: [github.com/go-bayes/places-of-worship](https://github.com/go-bayes/places-of-worship)
EOF

# Create a deployment info file
echo "ℹ️  Creating deployment info..."
cat > $TEMP_DEPLOY_DIR/deployment-info.json << EOF
{
    "deployed_at": "$(date -Iseconds)",
    "version": "1.0.0",
    "features": {
        "places_count": 3370,
        "regions_count": 2128,
        "demographic_metrics": [
            "median_age", "gender_ratio", "ethnicity_diversity",
            "income_level", "unemployment_rate", "home_ownership",
            "population_density", "no_religion_change", "christian_change"
        ],
        "map_styles": [
            "OpenStreetMap", "Grayscale", "Dark", "Satellite", "Terrain"
        ],
        "years_covered": [2006, 2013, 2018]
    },
    "data_sources": {
        "places": "OpenStreetMap (ODbL)",
        "demographics": "Statistics New Zealand (CC BY 4.0)",
        "boundaries": "Statistics New Zealand SA2 2018"
    }
}
EOF

# Switch to deployment branch
echo "🌿 Switching to gh-pages branch..."
if git show-ref --verify --quiet refs/heads/gh-pages; then
    git checkout gh-pages
    echo "✅ Switched to existing gh-pages branch"
else
    git checkout --orphan gh-pages
    echo "✅ Created new gh-pages branch"
fi

# Clear any existing content
echo "🧹 Clearing existing content..."
rm -rf ./*
rm -rf .github/  # Remove GitHub workflows from pages branch

# Copy deployment files
echo "📋 Copying deployment files..."
cp -r $TEMP_DEPLOY_DIR/* .

# Add and commit
echo "💾 Committing to gh-pages..."
git add .
git add -f data/nz_places.geojson  # Force add data file
git add -f src/demographics.json   # Force add demographics (may be large)

git commit -m "Deploy enhanced places of worship map

- 3,370 places of worship with denomination filtering
- Comprehensive demographic overlays (age, gender, ethnicity, income)
- Multiple map styles and interactive controls
- Mobile-responsive design
- Generated with Claude Code

🤖 Generated with Claude Code (https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# Push to GitHub
echo "⬆️  Pushing to GitHub..."
if git remote get-url origin > /dev/null 2>&1; then
    git push --force origin gh-pages
    echo "✅ Pushed to origin/gh-pages"
else
    echo "⚠️  No remote 'origin' found. Add your GitHub remote:"
    echo "    git remote add origin https://github.com/$GITHUB_USERNAME/$REPO_NAME.git"
    echo "    git push -u origin gh-pages"
fi

# Switch back to main branch
echo "🔄 Switching back to main branch..."
git checkout main || git checkout master

# Cleanup
echo "🧹 Cleaning up temporary files..."
rm -rf $TEMP_DEPLOY_DIR

echo ""
echo "🎉 GitHub Pages Deployment Complete!"
echo "=================================================="
echo ""
echo "📱 Your map will be available at:"
echo "   https://$GITHUB_USERNAME.github.io/$REPO_NAME/"
echo ""
echo "🗺️  Direct links:"
echo "   Enhanced Map: https://$GITHUB_USERNAME.github.io/$REPO_NAME/enhanced-places.html"
echo "   Simple Map:   https://$GITHUB_USERNAME.github.io/$REPO_NAME/places.html"
echo ""
echo "⚙️  Next steps:"
echo "   1. Go to GitHub.com → Your Repository → Settings → Pages"
echo "   2. Set source to 'Deploy from branch: gh-pages'"
echo "   3. Wait 5-10 minutes for deployment"
echo "   4. Visit your live map!"
echo ""
echo "📊 Deployment includes:"
echo "   • 3,370 places of worship with OpenStreetMap data"
echo "   • 2,128 SA2 regions with comprehensive demographics"
echo "   • Age, gender, ethnicity, income overlays"
echo "   • Religious denomination filtering"
echo "   • Multiple map styles (satellite, terrain, etc.)"
echo "   • Mobile-responsive design"
echo ""