/**
 * Enhanced Places of Worship Map Application
 * Combines individual places with census overlay, multiple map styles, and hierarchical filtering
 */

class EnhancedPlacesOfWorshipApp {
    constructor() {
        this.map = null;
        this.baseLayers = {};
        this.overlayLayers = {};
        this.layerControl = null;
        
        // Place data
        this.placesData = null;
        this.markerClusterGroup = null;
        this.placesLayer = null;
        
        // Census data
        this.censusData = null;
        this.censusLayer = null;
        this.boundariesData = null;
        this.showCensusOverlay = false;
        this.currentCensusMetric = 'no_religion_change';
        this.currentYear = 2018;
        
        // Filtering
        this.currentMajorCategory = 'all';
        this.currentDenomination = 'all';
        this.denominationMapper = new DenominationMapper();
        this.denominationColors = {};
        
        this.init();
    }
    
    async init() {
        this.setupMap();
        this.setupControls();
        await this.loadData();
        this.setupDenominationColors();
        this.displayPlaces();
        this.hideLoading();
    }
    
    setupMap() {
        // Initialize Leaflet map centred on New Zealand
        this.map = L.map('map').setView([-41.235726, 172.5118422], 6);
        
        // Define base tile layers
        this.baseLayers = {
            'OpenStreetMap': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                maxZoom: 19,
                minZoom: 5,
            }),
            'Grayscale': L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="http://cartodb.com/attributions">CartoDB</a>',
                subdomains: 'abcd',
                maxZoom: 19,
                minZoom: 5,
            }),
            'Dark': L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="http://cartodb.com/attributions">CartoDB</a>',
                subdomains: 'abcd',
                maxZoom: 19,
                minZoom: 5,
            }),
            'Satellite': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
                maxZoom: 19,
                minZoom: 5,
            }),
            'Terrain': L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
                attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
                maxZoom: 17,
                minZoom: 5,
            })
        };
        
        // Add default base layer
        this.baseLayers['OpenStreetMap'].addTo(this.map);
        
        // Initialize marker cluster group
        this.markerClusterGroup = L.markerClusterGroup({
            chunkedLoading: true,
            maxClusterRadius: 50,
            iconCreateFunction: (cluster) => this.createClusterIcon(cluster)
        });
        
        // Initialize overlay layers
        this.overlayLayers = {
            'Places of Worship': this.markerClusterGroup
        };
        
        this.map.addLayer(this.markerClusterGroup);
    }
    
    setupControls() {
        // Major category filter
        const majorCategorySelect = document.getElementById('majorCategoryFilter');
        majorCategorySelect.addEventListener('change', (e) => {
            this.currentMajorCategory = e.target.value;
            this.updateDenominationFilter();
            this.updateDisplay();
        });
        
        // Denomination filter
        const denominationSelect = document.getElementById('denominationFilter');
        denominationSelect.addEventListener('change', (e) => {
            this.currentDenomination = e.target.value;
            this.updateDisplay();
        });
        
        // Census overlay toggle
        const censusToggle = document.getElementById('censusOverlayToggle');
        censusToggle.addEventListener('change', (e) => {
            this.showCensusOverlay = e.target.checked;
            this.toggleCensusOverlay();
        });
        
        // Census metric selector
        const censusMetricSelect = document.getElementById('censusMetricSelect');
        censusMetricSelect.addEventListener('change', (e) => {
            this.currentCensusMetric = e.target.value;
            this.updateCensusVisualization();
        });
        
        // Map style selector
        const mapStyleSelect = document.getElementById('mapStyleSelect');
        mapStyleSelect.addEventListener('change', (e) => {
            this.changeMapStyle(e.target.value);
        });
        
        // Year slider for census data
        const yearSlider = document.getElementById('yearSlider');
        if (yearSlider) {
            yearSlider.addEventListener('input', (e) => {
                this.currentYear = parseInt(e.target.value);
                document.getElementById('currentYear').textContent = this.currentYear;
                this.updateCensusVisualization();
            });
        }
        
        // Reset button
        document.getElementById('resetButton').addEventListener('click', () => {
            this.resetView();
        });
        
        // Toggle clustering
        document.getElementById('toggleClustering').addEventListener('click', () => {
            this.toggleClustering();
        });
    }
    
    async loadData() {
        try {
            // Load both places and census data
            const [placesResponse, censusResponse, boundariesResponse] = await Promise.all([
                fetch('./data/nz_places.geojson'),
                fetch('./src/religion.json'),
                fetch('./src/sa2.geojson')
            ]);
            
            if (!placesResponse.ok || !censusResponse.ok || !boundariesResponse.ok) {
                throw new Error('Failed to load data files');
            }
            
            this.placesData = await placesResponse.json();
            this.censusData = await censusResponse.json();
            this.boundariesData = await boundariesResponse.json();
            
            console.log('Loaded data:', {
                places: this.placesData.features.length,
                censusRegions: Object.keys(this.censusData).length,
                boundaries: this.boundariesData.features.length
            });
            
            // Populate filter dropdowns
            this.populateFilterDropdowns();
            
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Failed to load data files. Please check that all data files are available.');
        }
    }
    
    setupDenominationColors() {
        // Use denomination mapper for consistent coloring
        const categorizedData = this.denominationMapper.categorizeFeatures(this.placesData.features);
        
        // Create colors for specific denominations within major categories
        Object.keys(categorizedData.denominations).forEach(denom => {
            this.denominationColors[denom] = this.denominationMapper.getDenominationColor(denom, {});
        });
    }
    
    populateFilterDropdowns() {
        // Populate major category filter
        const majorCategorySelect = document.getElementById('majorCategoryFilter');
        const majorCategories = this.denominationMapper.getMajorCategories();
        
        majorCategories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            const count = this.countMajorCategory(category);
            option.textContent = `${category} (${count})`;
            majorCategorySelect.appendChild(option);
        });
        
        // Initial population of denomination filter
        this.updateDenominationFilter();
    }
    
    updateDenominationFilter() {
        const denominationSelect = document.getElementById('denominationFilter');
        
        // Clear existing options except 'All'
        while (denominationSelect.children.length > 1) {
            denominationSelect.removeChild(denominationSelect.lastChild);
        }
        
        // Get denominations for current major category
        const relevantDenominations = this.getRelevantDenominations();
        
        relevantDenominations.forEach(denom => {
            const option = document.createElement('option');
            option.value = denom;
            option.textContent = `${denom} (${this.countDenomination(denom)})`;
            denominationSelect.appendChild(option);
        });
        
        // Reset denomination filter
        this.currentDenomination = 'all';
        denominationSelect.value = 'all';
    }
    
    getRelevantDenominations() {
        if (this.currentMajorCategory === 'all') {
            // Return all unique denominations
            const denominations = new Set();
            this.placesData.features.forEach(feature => {
                denominations.add(feature.properties.denomination);
            });
            return Array.from(denominations).sort();
        } else {
            // Return denominations within the major category
            const denominations = new Set();
            this.placesData.features.forEach(feature => {
                const category = this.denominationMapper.getMajorCategory(feature.properties.denomination);
                if (category === this.currentMajorCategory) {
                    denominations.add(feature.properties.denomination);
                }
            });
            return Array.from(denominations).sort();
        }
    }
    
    countMajorCategory(category) {
        return this.placesData.features.filter(feature => 
            this.denominationMapper.getMajorCategory(feature.properties.denomination) === category
        ).length;
    }
    
    countDenomination(denomination) {
        return this.placesData.features.filter(
            feature => feature.properties.denomination === denomination
        ).length;
    }
    
    displayPlaces() {
        if (!this.placesData) return;
        
        this.markerClusterGroup.clearLayers();
        
        const filteredPlaces = this.getFilteredPlaces();
        
        filteredPlaces.forEach(feature => {
            const marker = this.createPlaceMarker(feature);
            this.markerClusterGroup.addLayer(marker);
        });
        
        // Update info panel
        this.updateInfoPanel(filteredPlaces.length);
    }
    
    getFilteredPlaces() {
        let filtered = this.placesData.features;
        
        // Filter by major category
        if (this.currentMajorCategory !== 'all') {
            filtered = filtered.filter(feature => 
                this.denominationMapper.getMajorCategory(feature.properties.denomination) === this.currentMajorCategory
            );
        }
        
        // Filter by specific denomination
        if (this.currentDenomination !== 'all') {
            filtered = filtered.filter(feature => 
                feature.properties.denomination === this.currentDenomination
            );
        }
        
        return filtered;
    }
    
    createPlaceMarker(feature) {
        const props = feature.properties;
        const [lng, lat] = feature.geometry.coordinates;
        
        // Get color using denomination mapper
        const color = this.denominationMapper.getDenominationColor(props.denomination, this.denominationColors);
        const icon = this.createDenominationIcon(color, props.confidence);
        
        const marker = L.marker([lat, lng], { icon });
        
        // Create popup content
        const popupContent = this.createPopupContent(props);
        marker.bindPopup(popupContent);
        
        return marker;
    }
    
    createDenominationIcon(color, confidence) {
        // Much larger, more visible icons based on confidence
        const baseSize = confidence >= 0.8 ? 16 : confidence >= 0.6 ? 14 : 12;
        const pulseSize = baseSize + 6;
        
        return L.divIcon({
            className: 'place-marker',
            html: `
                <div class="marker-container">
                    <div class="marker-pulse" style="
                        width: ${pulseSize}px; 
                        height: ${pulseSize}px; 
                        background-color: ${color}; 
                        opacity: 0.3;
                        border-radius: 50%;
                        position: absolute;
                        animation: pulse 2s infinite;
                        top: -3px;
                        left: -3px;
                    "></div>
                    <div class="marker-core" style="
                        width: ${baseSize}px; 
                        height: ${baseSize}px; 
                        background-color: ${color}; 
                        border: 3px solid white; 
                        border-radius: 50%; 
                        box-shadow: 0 0 6px rgba(0,0,0,0.7);
                        position: relative;
                        z-index: 10;
                        opacity: ${confidence >= 0.6 ? 1.0 : 0.8};
                    "></div>
                    <div class="marker-inner" style="
                        width: ${Math.max(4, baseSize - 8)}px; 
                        height: ${Math.max(4, baseSize - 8)}px; 
                        background-color: rgba(255,255,255,0.8); 
                        border-radius: 50%; 
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        z-index: 11;
                    "></div>
                </div>`,
            iconSize: [pulseSize, pulseSize],
            iconAnchor: [pulseSize/2, pulseSize/2],
            popupAnchor: [0, -pulseSize/2]
        });
    }
    
    createClusterIcon(cluster) {
        const childCount = cluster.getChildCount();
        let className = 'marker-cluster-';
        
        if (childCount < 10) {
            className += 'small';
        } else if (childCount < 100) {
            className += 'medium';
        } else {
            className += 'large';
        }
        
        return new L.DivIcon({
            html: '<div><span>' + childCount + '</span></div>',
            className: 'marker-cluster ' + className,
            iconSize: new L.Point(40, 40)
        });
    }
    
    createPopupContent(props) {
        const majorCategory = this.denominationMapper.getMajorCategory(props.denomination);
        
        return `
            <div class="place-popup">
                <h3>${props.name}</h3>
                <p><strong>Category:</strong> ${majorCategory}</p>
                <p><strong>Denomination:</strong> ${props.denomination}</p>
                <p><strong>Confidence:</strong> ${(props.confidence * 100).toFixed(0)}%</p>
                ${props.address ? `<p><strong>Address:</strong> ${props.address}</p>` : ''}
                ${props.phone ? `<p><strong>Phone:</strong> ${props.phone}</p>` : ''}
                ${props.website ? `<p><strong>Website:</strong> <a href="${props.website}" target="_blank">${props.website}</a></p>` : ''}
                <p><strong>Source:</strong> OpenStreetMap (OSM ID: ${props.osm_id})</p>
                <small>Data quality: ${props.confidence >= 0.8 ? 'High' : props.confidence >= 0.6 ? 'Medium' : 'Low'}</small>
            </div>
        `;
    }
    
    // Census overlay functionality
    toggleCensusOverlay() {
        if (this.showCensusOverlay) {
            this.addCensusOverlay();
        } else {
            this.removeCensusOverlay();
        }
    }
    
    addCensusOverlay() {
        if (!this.boundariesData || this.censusLayer) return;
        
        this.censusLayer = L.geoJSON(this.boundariesData, {
            style: (feature) => this.getCensusFeatureStyle(feature),
            onEachFeature: (feature, layer) => this.onEachCensusFeature(feature, layer)
        });
        
        this.censusLayer.addTo(this.map);
        this.censusLayer.bringToBack(); // Ensure places are on top
    }
    
    removeCensusOverlay() {
        if (this.censusLayer) {
            this.map.removeLayer(this.censusLayer);
            this.censusLayer = null;
        }
    }
    
    updateCensusVisualization() {
        if (this.censusLayer) {
            this.censusLayer.setStyle((feature) => this.getCensusFeatureStyle(feature));
        }
    }
    
    getCensusFeatureStyle(feature) {
        const sa2Code = String(feature.properties.SA22018_V1_00); // Convert to string
        const color = this.calculateCensusColor(sa2Code);
        
        return {
            fillColor: color,
            fillOpacity: 0.6,
            weight: 0.5,
            color: "black",
            opacity: 0.8
        };
    }
    
    calculateCensusColor(sa2Code) {
        const sa2CodeStr = String(sa2Code); // Ensure string format
        const saData = this.censusData[sa2CodeStr];
        if (!saData) return "gray";
        
        switch (this.currentCensusMetric) {
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
        if (!saData["2006"] || !saData["2018"] || 
            !saData["2006"]["Total stated"] || !saData["2018"]["Total stated"]) {
            return "gray";
        }
        
        const noReligion06Pct = saData["2006"]["No religion"] / saData["2006"]["Total stated"] * 100;
        const noReligion18Pct = saData["2018"]["No religion"] / saData["2018"]["Total stated"] * 100;
        const diff = noReligion18Pct - noReligion06Pct;
        
        if (diff < -1) {
            return "purple"; // More religious
        } else if (diff > 1) {
            return "pink"; // More secular
        } else {
            return "lightgray"; // Stable
        }
    }
    
    calculateChristianChangeColor(saData) {
        if (!saData["2006"] || !saData["2018"] || 
            !saData["2006"]["Total stated"] || !saData["2018"]["Total stated"]) {
            return "gray";
        }
        
        const christian06Pct = saData["2006"]["Christian"] / saData["2006"]["Total stated"] * 100;
        const christian18Pct = saData["2018"]["Christian"] / saData["2018"]["Total stated"] * 100;
        const diff = christian18Pct - christian06Pct;
        
        if (diff > 1) {
            return "#2E8B57"; // More Christian
        } else if (diff < -1) {
            return "#CD5C5C"; // Less Christian
        } else {
            return "lightgray";
        }
    }
    
    calculatePopulationColor(saData) {
        const yearData = saData[String(this.currentYear)];
        if (!yearData || !yearData["Total"]) return "gray";
        
        const population = yearData["Total"];
        if (population < 500) return "#FFF2CC";
        if (population < 1000) return "#FFE699";
        if (population < 2000) return "#FFD966";
        if (population < 5000) return "#F1C232";
        return "#B45F06";
    }
    
    calculateDiversityColor(saData) {
        const yearData = saData[String(this.currentYear)];
        if (!yearData || !yearData["Total stated"]) return "gray";
        
        // Calculate Shannon diversity index
        const religions = ['Christian', 'Buddhism', 'Hinduism', 'Islam', 'Judaism', 'No religion'];
        let diversity = 0;
        
        religions.forEach(religion => {
            if (yearData[religion]) {
                const proportion = yearData[religion] / yearData["Total stated"];
                if (proportion > 0) {
                    diversity -= proportion * Math.log(proportion);
                }
            }
        });
        
        // Normalize and color
        if (diversity < 0.5) return "#F8F8FF";
        if (diversity < 1.0) return "#E6E6FA";
        if (diversity < 1.5) return "#DDA0DD";
        return "#9370DB";
    }
    
    onEachCensusFeature(feature, layer) {
        const sa2Code = String(feature.properties.SA22018_V1_00); // Convert to string
        const saData = this.censusData[sa2Code];
        
        if (saData) {
            const popupContent = this.createCensusPopupContent(feature.properties, saData);
            layer.bindPopup(popupContent);
        }
    }
    
    createCensusPopupContent(properties, saData) {
        const yearData = saData[String(this.currentYear)] || {};
        
        return `
            <div class="census-popup">
                <h3>Census Data - ${properties.SA22018_V1_00_NAME}</h3>
                <p><strong>Year:</strong> ${this.currentYear}</p>
                <p><strong>Total Population:</strong> ${yearData["Total"] || 'N/A'}</p>
                <p><strong>Christian:</strong> ${yearData["Christian"] || 0}</p>
                <p><strong>No Religion:</strong> ${yearData["No religion"] || 0}</p>
                <p><strong>Buddhism:</strong> ${yearData["Buddhism"] || 0}</p>
                <p><strong>Hinduism:</strong> ${yearData["Hinduism"] || 0}</p>
                <p><strong>Islam:</strong> ${yearData["Islam"] || 0}</p>
                <small>Source: Statistics New Zealand</small>
            </div>
        `;
    }
    
    // UI Control methods
    changeMapStyle(styleKey) {
        // Remove current base layer
        this.map.eachLayer((layer) => {
            if (this.baseLayers[layer.options.attribution]) {
                this.map.removeLayer(layer);
            }
        });
        
        // Add new base layer
        if (this.baseLayers[styleKey]) {
            this.baseLayers[styleKey].addTo(this.map);
        }
    }
    
    updateDisplay() {
        this.displayPlaces();
    }
    
    updateInfoPanel(count) {
        document.getElementById('totalPlaces').textContent = count;
        
        const majorCategoryText = this.currentMajorCategory === 'all' ? 'All Categories' : this.currentMajorCategory;
        const denominationText = this.currentDenomination === 'all' ? 'All Denominations' : this.currentDenomination;
        
        document.getElementById('currentFilter').textContent = 
            this.currentDenomination !== 'all' ? denominationText : majorCategoryText;
    }
    
    resetView() {
        this.map.setView([-41.235726, 172.5118422], 6);
        
        // Reset filters
        document.getElementById('majorCategoryFilter').value = 'all';
        document.getElementById('denominationFilter').value = 'all';
        this.currentMajorCategory = 'all';
        this.currentDenomination = 'all';
        
        // Reset census overlay
        document.getElementById('censusOverlayToggle').checked = false;
        this.showCensusOverlay = false;
        this.removeCensusOverlay();
        
        this.updateDenominationFilter();
        this.updateDisplay();
    }
    
    toggleClustering() {
        const button = document.getElementById('toggleClustering');
        
        if (this.map.hasLayer(this.markerClusterGroup)) {
            // Remove clustering
            this.map.removeLayer(this.markerClusterGroup);
            
            // Add individual markers
            this.placesLayer = L.layerGroup();
            const filteredPlaces = this.getFilteredPlaces();
            
            filteredPlaces.forEach(feature => {
                const marker = this.createPlaceMarker(feature);
                this.placesLayer.addLayer(marker);
            });
            
            this.map.addLayer(this.placesLayer);
            button.textContent = 'Enable Clustering';
            
        } else {
            // Add clustering back
            if (this.placesLayer) {
                this.map.removeLayer(this.placesLayer);
                this.placesLayer = null;
            }
            
            this.map.addLayer(this.markerClusterGroup);
            this.displayPlaces();
            button.textContent = 'Disable Clustering';
        }
    }
    
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.innerHTML = `
            <div style="background: #ffebee; border: 1px solid #f44336; padding: 15px; margin: 10px; border-radius: 4px;">
                <strong>Error:</strong> ${message}
            </div>
        `;
        
        const mapContainer = document.getElementById('map');
        mapContainer.parentNode.insertBefore(errorDiv, mapContainer);
    }
    
    hideLoading() {
        const loadingEl = document.getElementById('loading');
        if (loadingEl) {
            loadingEl.style.display = 'none';
        }
    }
}

// Initialize the app when page loads
document.addEventListener('DOMContentLoaded', () => {
    new EnhancedPlacesOfWorshipApp();
});