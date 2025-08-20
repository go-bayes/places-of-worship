#!/bin/bash
set -e

# GitHub Pages Setup Script
# Creates a static version of the enhanced map for GitHub Pages hosting

echo "🌐 Setting up GitHub Pages deployment"
echo "===================================="

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RELIGION_REPO="../religion"

# Check if religion repo data exists
if [ ! -f "$RELIGION_REPO/religion.json" ] || [ ! -f "$RELIGION_REPO/sa2.geojson" ]; then
    echo "❌ Religion repo data not found at $RELIGION_REPO"
    echo "   Please ensure the religion repository is available as a sibling directory"
    exit 1
fi

echo "✅ Found religion repo data"

# Create gh-pages branch
echo "📝 Creating gh-pages branch..."
cd "$BASE_DIR"

# Save current branch
CURRENT_BRANCH=$(git branch --show-current)

# Check if gh-pages branch exists
if git show-ref --verify --quiet refs/heads/gh-pages; then
    echo "   Switching to existing gh-pages branch"
    git checkout gh-pages
else
    echo "   Creating new gh-pages branch"
    git checkout --orphan gh-pages
    git rm -rf .
fi

# Copy frontend files
echo "📁 Copying frontend files..."
cp -r frontend/src/* .

# Copy original data files  
echo "📊 Copying data files..."
cp "$RELIGION_REPO/religion.json" .
cp "$RELIGION_REPO/sa2.geojson" .

# Create a static version of the app that doesn't need the API
echo "🔧 Creating static version..."

cat > app-static.js << 'EOF'
/**
 * Static version of Places of Worship app for GitHub Pages
 * Uses original static files instead of API calls
 */

class ReligiousDataAppStatic {
    constructor() {
        this.map = null;
        this.geojsonLayer = null;
        this.religionData = null;
        this.currentYear = 2018;
        this.currentMetric = 'no_religion_change';
        this.isPlaying = false;
        this.playInterval = null;
        this.chart = null;
        
        this.init();
    }
    
    async init() {
        this.setupMap();
        this.setupControls();
        await this.loadStaticData();
        this.hideLoading();
    }
    
    setupMap() {
        // Initialize Leaflet map
        this.map = L.map('map').setView([-41.235726, 172.5118422], 6);
        
        // Add CartoDB base layer
        L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="http://cartodb.com/attributions">CartoDB</a>',
            subdomains: 'abcd',
            maxZoom: 19,
            minZoom: 6,
        }).addTo(this.map);
        
        // Set map bounds for New Zealand
        const bounds = this.map.getBounds();
        bounds._northEast.lat += 10;
        bounds._northEast.lng += 10;
        bounds._southWest.lat -= 10;
        bounds._southWest.lng -= 10;
        this.map.setMaxBounds(bounds);
    }
    
    setupControls() {
        // Year slider
        const yearSlider = document.getElementById('yearSlider');
        yearSlider.addEventListener('input', (e) => {
            this.currentYear = parseInt(e.target.value);
            document.getElementById('currentYear').textContent = this.currentYear;
            this.updateVisualization();
        });
        
        // Metric selector
        const metricSelect = document.getElementById('metricSelect');
        metricSelect.addEventListener('change', (e) => {
            this.currentMetric = e.target.value;
            this.updateVisualization();
            this.updateLegend();
        });
        
        // Play button
        document.getElementById('playButton').addEventListener('click', () => {
            this.togglePlayback();
        });
        
        // Reset button
        document.getElementById('resetButton').addEventListener('click', () => {
            this.resetView();
        });
    }
    
    async loadStaticData() {
        try {
            // Load data from static files (original approach)
            const [religionResponse, boundariesResponse] = await Promise.all([
                fetch('./religion.json'),
                fetch('./sa2.geojson')
            ]);
            
            if (!religionResponse.ok || !boundariesResponse.ok) {
                throw new Error('Failed to load static data files');
            }
            
            this.religionData = await religionResponse.json();
            const boundariesData = await boundariesResponse.json();
            
            console.log('Loaded static data:', {
                regions: Object.keys(this.religionData).length,
                boundaries: boundariesData.features.length
            });
            
            this.addGeoJsonLayer(boundariesData);
            this.updateVisualization();
            
        } catch (error) {
            console.error('Error loading static data:', error);
            this.showError('Failed to load data files. Please check that religion.json and sa2.geojson are available.');
        }
    }
    
    // [Include all the other methods from the original app.js, with API calls removed]
    // ... (copying the rest of the functionality)
    
    addGeoJsonLayer(geojsonData) {
        this.geojsonLayer = L.geoJSON(geojsonData, {
            style: (feature) => this.getFeatureStyle(feature),
            onEachFeature: (feature, layer) => this.onEachFeature(feature, layer)
        }).addTo(this.map);
    }
    
    getFeatureStyle(feature) {
        const sa2Code = feature.properties.SA22018_V1_00;
        const color = this.calculateColor(sa2Code);
        
        return {
            fillColor: color,
            fillOpacity: 0.7,
            weight: 0.5,
            color: "black",
        };
    }
    
    calculateColor(sa2Code) {
        const saData = this.religionData[sa2Code];
        if (!saData) return "gray";
        
        switch (this.currentMetric) {
            case 'no_religion_change':
                return this.calculateNoReligionChangeColor(saData);
            case 'christian_change':
                return this.calculateChristianChangeColor(saData);
            case 'total_population':
                return this.calculatePopulationColor(saData);
            case 'diversity_index':
                return this.calculateDiversityColor(saData);
            default:
                return "gray";
        }
    }
    
    calculateNoReligionChangeColor(saData) {
        if (!saData[2006] || !saData[2018] || 
            !saData[2006]["Total stated"] || !saData[2018]["Total stated"]) {
            return "gray";
        }
        
        const noReligion06Pct = saData[2006]["No religion"] / saData[2006]["Total stated"] * 100;
        const noReligion18Pct = saData[2018]["No religion"] / saData[2018]["Total stated"] * 100;
        const diff = noReligion18Pct - noReligion06Pct;
        
        if (diff < -1) {
            return "purple";
        } else if (diff > 1) {
            return "pink";
        } else {
            return "gray";
        }
    }
    
    calculateChristianChangeColor(saData) {
        if (!saData[2006] || !saData[2018] || 
            !saData[2006]["Total stated"] || !saData[2018]["Total stated"]) {
            return "gray";
        }
        
        const christian06Pct = saData[2006]["Christian"] / saData[2006]["Total stated"] * 100;
        const christian18Pct = saData[2018]["Christian"] / saData[2018]["Total stated"] * 100;
        const diff = christian18Pct - christian06Pct;
        
        if (diff > 1) {
            return "#2E8B57";
        } else if (diff < -1) {
            return "#CD5C5C";
        } else {
            return "gray";
        }
    }
    
    calculatePopulationColor(saData) {
        const yearData = saData[this.currentYear];
        if (!yearData || !yearData["Total"]) return "gray";
        
        const population = yearData["Total"];
        if (population < 500) return "#FFF2CC";
        if (population < 1000) return "#FFE699";
        if (population < 2000) return "#FFD966";
        if (population < 5000) return "#F1C232";
        return "#B45F06";
    }
    
    calculateDiversityColor(saData) {
        const yearData = saData[this.currentYear];
        if (!yearData || !yearData["Total stated"]) return "gray";
        
        const religions = ["Buddhism", "Christian", "Hinduism", "Islam", "Judaism", "Other religions, beliefs, and philosophies"];
        let diversity = 0;
        const total = yearData["Total stated"];
        
        for (const religion of religions) {
            const count = yearData[religion] || 0;
            if (count > 0) {
                const p = count / total;
                diversity -= p * Math.log2(p);
            }
        }
        
        if (diversity < 0.5) return "#F8F8FF";
        if (diversity < 1.0) return "#E6E6FA";
        if (diversity < 1.5) return "#DDA0DD";
        if (diversity < 2.0) return "#DA70D6";
        return "#BA55D3";
    }
    
    onEachFeature(feature, layer) {
        const sa2Code = feature.properties.SA22018_V1_00;
        const sa2Name = feature.properties.SA22018_V1_NAME;
        const saData = this.religionData[sa2Code];
        
        layer.bindPopup(this.formatPopupData(sa2Name, saData));
        
        layer.on('mouseover', () => {
            layer.setStyle({color: "orange", weight: 2});
            layer.bringToFront();
        });
        
        layer.on('mouseout', () => {
            layer.setStyle({color: "black", weight: 0.5});
        });
        
        layer.on('click', () => {
            this.showRegionDetails(sa2Code, sa2Name, saData);
        });
    }
    
    formatPopupData(name, data) {
        if (!data) return `<h2>${name}</h2><p>No data available</p>`;
        
        let html = `<h2>${name}</h2>`;
        
        const hasData = data[2006] && data[2013] && data[2018] &&
                       data[2006]["Total stated"] && data[2013]["Total stated"] && data[2018]["Total stated"];
        
        if (!hasData) {
            return html + "<p>No complete data available</p>";
        }
        
        html += '<table><thead><tr><th></th><th>2006</th><th>2013</th><th>2018</th></tr></thead><tbody>';
        
        const religions = Object.keys(data[2006]).filter(r => !r.includes("Total"));
        
        for (const religion of religions) {
            html += `<tr><td>${religion}</td>`;
            for (const year of ["2006", "2013", "2018"]) {
                const pct = this.getPctForReligion(religion, data[year]);
                html += `<td>${pct}</td>`;
            }
            html += '</tr>';
        }
        
        html += '</tbody></table>';
        return html;
    }
    
    getPctForReligion(religion, yearData) {
        if (!yearData || !yearData["Total stated"] || yearData["Total stated"] === 0) {
            return "No data";
        }
        const pct = (yearData[religion] || 0) / yearData["Total stated"] * 100;
        return Math.round(pct * 10) / 10 + "%";
    }
    
    showRegionDetails(sa2Code, sa2Name, saData) {
        const statsPanel = document.getElementById('regionStats');
        statsPanel.style.display = 'block';
        this.updateRegionChart(sa2Name, saData);
    }
    
    updateRegionChart(regionName, data) {
        const ctx = document.getElementById('chartCanvas');
        
        if (this.chart) {
            this.chart.destroy();
        }
        
        const years = ['2006', '2013', '2018'];
        const noReligionData = years.map(year => {
            if (data[year] && data[year]["Total stated"] && data[year]["Total stated"] > 0) {
                return Math.round((data[year]["No religion"] || 0) / data[year]["Total stated"] * 100 * 10) / 10;
            }
            return 0;
        });
        
        const christianData = years.map(year => {
            if (data[year] && data[year]["Total stated"] && data[year]["Total stated"] > 0) {
                return Math.round((data[year]["Christian"] || 0) / data[year]["Total stated"] * 100 * 10) / 10;
            }
            return 0;
        });
        
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: years,
                datasets: [{
                    label: 'No Religion %',
                    data: noReligionData,
                    borderColor: '#FF6B9D',
                    backgroundColor: 'rgba(255, 107, 157, 0.1)',
                    tension: 0.4
                }, {
                    label: 'Christian %',
                    data: christianData,
                    borderColor: '#4ECDC4',
                    backgroundColor: 'rgba(78, 205, 196, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: regionName
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                }
            }
        });
    }
    
    updateVisualization() {
        if (this.geojsonLayer) {
            this.geojsonLayer.eachLayer((layer) => {
                const feature = layer.feature;
                layer.setStyle(this.getFeatureStyle(feature));
            });
        }
    }
    
    updateLegend() {
        const legendElement = document.querySelector('.legend h4');
        const legendItems = document.querySelector('.legend-items');
        
        switch (this.currentMetric) {
            case 'no_religion_change':
                legendElement.textContent = 'Change in persons reporting "No religion" between 2006 and 2018';
                legendItems.innerHTML = `
                    <div class="legend-item"><i style="background:purple"></i> Up 1% or more</div>
                    <div class="legend-item"><i style="background:gray"></i> Between -1% to 1%</div>
                    <div class="legend-item"><i style="background:pink"></i> Down 1% or more</div>
                `;
                break;
            case 'christian_change':
                legendElement.textContent = 'Change in persons reporting "Christian" between 2006 and 2018';
                legendItems.innerHTML = `
                    <div class="legend-item"><i style="background:#2E8B57"></i> Up 1% or more</div>
                    <div class="legend-item"><i style="background:gray"></i> Between -1% to 1%</div>
                    <div class="legend-item"><i style="background:#CD5C5C"></i> Down 1% or more</div>
                `;
                break;
            case 'total_population':
                legendElement.textContent = `Total population by region (${this.currentYear})`;
                legendItems.innerHTML = `
                    <div class="legend-item"><i style="background:#FFF2CC"></i> < 500</div>
                    <div class="legend-item"><i style="background:#FFE699"></i> 500-1,000</div>
                    <div class="legend-item"><i style="background:#FFD966"></i> 1,000-2,000</div>
                    <div class="legend-item"><i style="background:#F1C232"></i> 2,000-5,000</div>
                    <div class="legend-item"><i style="background:#B45F06"></i> 5,000+</div>
                `;
                break;
            case 'diversity_index':
                legendElement.textContent = `Religious diversity index (${this.currentYear})`;
                legendItems.innerHTML = `
                    <div class="legend-item"><i style="background:#F8F8FF"></i> Low diversity</div>
                    <div class="legend-item"><i style="background:#E6E6FA"></i> Low-medium</div>
                    <div class="legend-item"><i style="background:#DDA0DD"></i> Medium</div>
                    <div class="legend-item"><i style="background:#DA70D6"></i> High</div>
                    <div class="legend-item"><i style="background:#BA55D3"></i> Very high</div>
                `;
                break;
        }
    }
    
    togglePlayback() {
        const playButton = document.getElementById('playButton');
        
        if (this.isPlaying) {
            clearInterval(this.playInterval);
            this.isPlaying = false;
            playButton.textContent = 'Play Timeline';
        } else {
            this.isPlaying = true;
            playButton.textContent = 'Stop';
            
            const years = [2006, 2013, 2018];
            let currentIndex = years.indexOf(this.currentYear);
            
            this.playInterval = setInterval(() => {
                currentIndex = (currentIndex + 1) % years.length;
                this.currentYear = years[currentIndex];
                
                document.getElementById('yearSlider').value = this.currentYear;
                document.getElementById('currentYear').textContent = this.currentYear;
                
                this.updateVisualization();
            }, 2000);
        }
    }
    
    resetView() {
        this.currentYear = 2018;
        this.currentMetric = 'no_religion_change';
        
        document.getElementById('yearSlider').value = 2018;
        document.getElementById('currentYear').textContent = '2018';
        document.getElementById('metricSelect').value = 'no_religion_change';
        
        this.map.setView([-41.235726, 172.5118422], 6);
        document.getElementById('regionStats').style.display = 'none';
        
        if (this.isPlaying) {
            this.togglePlayback();
        }
        
        this.updateVisualization();
        this.updateLegend();
    }
    
    showError(message) {
        const loadingElement = document.getElementById('loading');
        loadingElement.innerHTML = `
            <div style="color: #dc3545; text-align: center;">
                <h3>Error</h3>
                <p>${message}</p>
                <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Reload Page</button>
            </div>
        `;
    }
    
    hideLoading() {
        document.getElementById('loading').classList.add('hidden');
    }
}

// Initialize the static application
document.addEventListener('DOMContentLoaded', () => {
    new ReligiousDataAppStatic();
});
EOF

# Update the HTML to use the static version
sed -i.bak 's/src="app.js"/src="app-static.js"/' index.html
rm index.html.bak

# Update the title to indicate this is the static demo
sed -i.bak 's/<title>Religious Trends in NZ - Enhanced<\/title>/<title>Religious Trends in NZ - Enhanced (GitHub Pages Demo)<\/title>/' index.html
sed -i.bak 's/<p class="subtitle">Enhanced with temporal database architecture<\/p>/<p class="subtitle">GitHub Pages Demo - Enhanced Interface with Original Data<\/p>/' index.html
rm index.html.bak

# Create a README for the GitHub Pages version
cat > README.md << 'EOF'
# Religious Trends in New Zealand - Enhanced Demo

This is a GitHub Pages demonstration of the enhanced religious trends visualization, built on the original religion.json data but with improved interface and temporal controls.

## Features

- **Interactive Map**: Explore religious demographics across New Zealand SA2 regions
- **Temporal Controls**: Slider to explore different census years (2006, 2013, 2018)
- **Multiple Metrics**: Switch between visualization modes:
  - Change in "No Religion" percentage (original)
  - Change in "Christian" percentage
  - Total population by region
  - Religious diversity index
- **Timeline Playback**: Animated progression through census years
- **Regional Analysis**: Click regions for detailed charts
- **Responsive Design**: Works on desktop and mobile

## Data Sources

- **Religious Demographics**: Statistics New Zealand Census data (2006, 2013, 2018)
- **Geographic Boundaries**: New Zealand SA2 Statistical Areas 2018
- **License**: Data used under Statistics New Zealand's open data license (CC BY 4.0)

## Technical Architecture

This GitHub Pages version demonstrates the enhanced interface capabilities while using static data files. The full implementation includes:

- PostgreSQL database with temporal versioning
- REST API for programmatic access
- Real-time data integration capabilities
- Extended analysis and export features

For the complete technical documentation and database implementation, see the [main repository](https://github.com/go-bayes/places-of-worship).

## Attribution

© Statistics New Zealand, licensed under CC BY 4.0  
Enhanced visualization developed for academic research into religious geography patterns.
EOF

# Add GitHub Pages specific files
echo "web: python -m http.server \$PORT" > Procfile

# Commit to gh-pages
echo "💾 Committing to gh-pages..."
git add .
git commit -m "GitHub Pages static demo

- Enhanced interface with temporal controls and multiple metrics
- Uses original religion.json and sa2.geojson data files
- Maintains all interactive features from full implementation
- Responsive design for mobile and desktop viewing
- Ready for GitHub Pages hosting at go-bayes.github.io/places-of-worship"

# Push to GitHub
echo "🚀 Pushing to GitHub..."
git push origin gh-pages

# Switch back to original branch
git checkout "$CURRENT_BRANCH"

echo ""
echo "🎉 GitHub Pages Setup Complete!"
echo "==============================="
echo ""
echo "Your enhanced map will be available at:"
echo "  https://go-bayes.github.io/places-of-worship/"
echo ""
echo "Note: GitHub Pages may take a few minutes to deploy."
echo "Enable GitHub Pages in your repository settings if not already enabled:"
echo "  Repository Settings → Pages → Deploy from branch: gh-pages"
echo ""
echo "To update the GitHub Pages version:"
echo "  git checkout gh-pages"
echo "  # Make changes"
echo "  git commit -am \"Update demo\""
echo "  git push origin gh-pages"
EOF

chmod +x setup_github_pages.sh