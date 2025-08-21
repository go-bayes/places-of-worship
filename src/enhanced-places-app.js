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
        this.demographicData = null;
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
        this.setupStreetView();
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
            'Google Satellite': L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
                attribution: '&copy; Google',
                maxZoom: 20,
                minZoom: 5,
            }),
            'Terrain': L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
                attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
                maxZoom: 17,
                minZoom: 5,
            })
        };
        
        // Add default base layer - start with grayscale
        this.baseLayers['Grayscale'].addTo(this.map);
        
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
            // Load places, census, and comprehensive demographic data
            const [placesResponse, censusResponse, demographicResponse, boundariesResponse] = await Promise.all([
                fetch('./data/nz_places_optimized.geojson'),
                fetch('./src/religion.json'),
                fetch('./src/demographics.json'),
                fetch('./data/sa2.geojson')
            ]);
            
            if (!placesResponse.ok || !censusResponse.ok || !demographicResponse.ok || !boundariesResponse.ok) {
                throw new Error('Failed to load data files');
            }
            
            this.placesData = await placesResponse.json();
            this.censusData = await censusResponse.json();
            this.demographicData = await demographicResponse.json();
            this.boundariesData = await boundariesResponse.json();
            
            console.log('Loaded data:', {
                places: this.placesData.features.length,
                censusRegions: Object.keys(this.censusData).length,
                demographicRegions: Object.keys(this.demographicData).length,
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
        marker.bindPopup(popupContent, { maxWidth: 600 });
        
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
                <p><strong>Confidence:</strong> ${(props.confidence * 100).toFixed(0)}% 
                   <small title="Based on OSM data completeness: name availability, address details, denomination specificity, and contact information">ⓘ</small></p>
                ${props.address ? `<p><strong>Address:</strong> ${props.address}</p>` : ''}
                ${props.phone ? `<p><strong>Phone:</strong> ${props.phone}</p>` : ''}
                ${props.website ? `<p><strong>Website:</strong> <a href="${props.website}" target="_blank">${props.website}</a></p>` : ''}
                <p><strong>Source:</strong> OpenStreetMap (OSM ID: ${props.osm_id})</p>
                <small>Data quality: ${props.confidence >= 0.8 ? 'High' : props.confidence >= 0.6 ? 'Medium' : 'Low'}</small>
                <div class="pano"></div>
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
            fillColor: 'transparent',
            fillOpacity: 0,
            weight: 1,
            color: "#666666",
            opacity: 0.4
        };
    }
    
    calculateCensusColor(sa2Code) {
        const sa2CodeStr = String(sa2Code); // Ensure string format
        const saData = this.censusData[sa2CodeStr];
        if (!saData) return "gray";
        
        // Use demographic data if available, fallback to census data
        const dataSource = this.demographicData[sa2CodeStr] || saData;
        
        switch (this.currentCensusMetric) {
            case 'no_religion_change':
                return this.calculateNoReligionChangeColor(dataSource);
            case 'christian_change':
                return this.calculateChristianChangeColor(dataSource);
            case 'total_population':
                return this.calculatePopulationColor(dataSource);
            case 'diversity_index':
                return this.calculateDiversityColor(dataSource);
            case 'median_age':
                return this.calculateMedianAgeColor(dataSource);
            case 'gender_ratio':
                return this.calculateGenderRatioColor(dataSource);
            case 'ethnicity_diversity':
                return this.calculateEthnicityDiversityColor(dataSource);
            case 'income_level':
                return this.calculateIncomeLevelColor(dataSource);
            case 'population_density':
                return this.calculatePopulationDensityColor(dataSource);
            case 'unemployment_rate':
                return this.calculateUnemploymentColor(dataSource);
            case 'home_ownership':
                return this.calculateHomeOwnershipColor(dataSource);
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
    
    calculateMedianAgeColor(saData) {
        const yearData = saData[String(this.currentYear)];
        if (!yearData || yearData.median_age === undefined) return "gray";
        
        const medianAge = yearData.median_age;
        if (medianAge < 30) return "#FFE5E5";      // Very young - light red
        if (medianAge < 35) return "#FFB3B3";      // Young - light pink
        if (medianAge < 40) return "#FF8080";      // Middle-young - pink
        if (medianAge < 45) return "#FFE5CC";      // Middle - light orange
        if (medianAge < 50) return "#FFCC99";      // Middle-older - orange
        return "#FF9966";                          // Older - dark orange
    }
    
    calculateGenderRatioColor(saData) {
        const yearData = saData[String(this.currentYear)];
        if (!yearData || !yearData.gender_profile) return "gray";
        
        const genderData = yearData.gender_profile;
        const total = genderData.Female + genderData.Male;
        if (total === 0) return "gray";
        
        const femaleRatio = genderData.Female / total;
        
        if (femaleRatio < 0.48) return "#4A90E2";      // More male - blue
        if (femaleRatio < 0.495) return "#A8CBEA";     // Slightly more male - light blue
        if (femaleRatio < 0.505) return "#E8E8E8";     // Balanced - light gray
        if (femaleRatio < 0.52) return "#F5A3C7";      // Slightly more female - light pink
        return "#E91E63";                              // More female - pink
    }
    
    calculateEthnicityDiversityColor(saData) {
        const yearData = saData[String(this.currentYear)];
        if (!yearData || !yearData.ethnicity_profile) return "gray";
        
        const ethnicityData = yearData.ethnicity_profile;
        const total = Object.values(ethnicityData).reduce((sum, count) => sum + count, 0);
        
        if (total === 0) return "gray";
        
        // Calculate diversity index (Shannon diversity)
        let diversity = 0;
        for (const count of Object.values(ethnicityData)) {
            if (count > 0) {
                const proportion = count / total;
                diversity -= proportion * Math.log(proportion);
            }
        }
        
        // Color based on diversity level
        if (diversity < 0.5) return "#FFF5E6";         // Low diversity - very light orange
        if (diversity < 1.0) return "#FFE0B3";         // Low-medium - light orange
        if (diversity < 1.5) return "#FFCC80";         // Medium - orange
        if (diversity < 2.0) return "#FF9800";         // High - darker orange
        return "#E65100";                              // Very high - deep orange
    }
    
    calculateIncomeLevelColor(saData) {
        const yearData = saData[String(this.currentYear)];
        if (!yearData || !yearData.income_profile) return "gray";
        
        const incomeData = yearData.income_profile;
        const total = Object.values(incomeData).reduce((sum, count) => sum + count, 0);
        
        if (total === 0) return "gray";
        
        // Calculate weighted average income (approximate)
        const incomeWeights = {
            "Under $15,000": 10000,
            "$15,000-$30,000": 22500,
            "$30,000-$50,000": 40000,
            "$50,000-$70,000": 60000,
            "$70,000-$100,000": 85000,
            "$100,000-$150,000": 125000,
            "$150,000+": 200000
        };
        
        let weightedSum = 0;
        for (const [bracket, count] of Object.entries(incomeData)) {
            weightedSum += (incomeWeights[bracket] || 0) * count;
        }
        
        const avgIncome = weightedSum / total;
        
        if (avgIncome < 30000) return "#FFEBEE";       // Low income - very light red
        if (avgIncome < 50000) return "#FFCDD2";       // Low-medium - light red
        if (avgIncome < 70000) return "#FFF3E0";       // Medium - light orange
        if (avgIncome < 100000) return "#C8E6C9";      // Medium-high - light green
        if (avgIncome < 130000) return "#4CAF50";      // High - green
        return "#2E7D32";                              // Very high - dark green
    }
    
    calculatePopulationDensityColor(saData) {
        const yearData = saData[String(this.currentYear)];
        if (!yearData || yearData.population_density === undefined) return "gray";
        
        const density = yearData.population_density;
        
        if (density < 10) return "#E8F5E8";            // Very low - very light green
        if (density < 50) return "#C8E6C9";            // Low - light green  
        if (density < 200) return "#81C784";           // Medium-low - green
        if (density < 500) return "#FFF3E0";           // Medium - light orange
        if (density < 1000) return "#FFCC80";          // Medium-high - orange
        if (density < 2000) return "#FF8A65";          // High - red-orange
        return "#D32F2F";                              // Very high - red
    }
    
    calculateUnemploymentColor(saData) {
        const yearData = saData[String(this.currentYear)];
        if (!yearData || yearData.unemployment_rate === undefined) return "gray";
        
        const unemploymentRate = yearData.unemployment_rate * 100; // Convert to percentage
        
        if (unemploymentRate < 2) return "#E8F5E8";    // Very low - light green
        if (unemploymentRate < 4) return "#C8E6C9";    // Low - green
        if (unemploymentRate < 6) return "#FFF3E0";    // Medium - light orange
        if (unemploymentRate < 8) return "#FFCC80";    // Medium-high - orange
        if (unemploymentRate < 12) return "#FF8A65";   // High - red-orange
        return "#D32F2F";                              // Very high - red
    }
    
    calculateHomeOwnershipColor(saData) {
        const yearData = saData[String(this.currentYear)];
        if (!yearData || yearData.home_ownership_rate === undefined) return "gray";
        
        const ownershipRate = yearData.home_ownership_rate;
        
        if (ownershipRate < 0.4) return "#FFEBEE";     // Very low - light red
        if (ownershipRate < 0.5) return "#FFCDD2";     // Low - red
        if (ownershipRate < 0.6) return "#FFF3E0";     // Medium-low - light orange
        if (ownershipRate < 0.7) return "#C8E6C9";     // Medium - light green
        if (ownershipRate < 0.8) return "#81C784";     // High - green
        return "#4CAF50";                              // Very high - dark green
    }
    
    onEachCensusFeature(feature, layer) {
        const sa2Code = String(feature.properties.SA22018_V1_00); // Convert to string
        const saData = this.censusData[sa2Code];
        
        if (saData) {
            const popupContent = this.createCensusPopupContent(feature.properties, saData);
            layer.bindPopup(popupContent, {minWidth: 600});
            
            // Add popup event handler for creating histogram
            layer.on('popupopen', (e) => {
                this.createReligiousHistogram(saData, feature.properties.SA22018_V1_NAME);
            });
            
            // Add hover effects like age_map
            layer.on('mouseover', (e) => {
                layer.setStyle({
                    color: 'orange',
                    weight: 3,
                    fillOpacity: 0.1,
                    fillColor: 'orange'
                });
                layer.bringToFront();
            });
            
            layer.on('mouseout', (e) => {
                layer.setStyle({
                    color: '#666666',
                    weight: 1,
                    fillOpacity: 0,
                    fillColor: 'transparent'
                });
            });
            
            // Add tooltip with region name
            layer.bindTooltip(feature.properties.SA22018_V1_NAME, {
                sticky: true,
                direction: 'auto'
            });
        }
    }
    
    createCensusPopupContent(properties, saData) {
        const sa2Code = String(properties.SA22018_V1_00);
        const yearData = saData[String(this.currentYear)] || {};
        
        // Check if we have comprehensive demographic data
        const demographicData = this.demographicData[sa2Code];
        const comprehensiveData = demographicData ? demographicData[String(this.currentYear)] : null;
        
        let popupContent = `
            <div class="census-popup">
                <h3>${properties.SA22018_V1_NAME}</h3>
                <p><strong>Year:</strong> ${this.currentYear}</p>
                <p><strong>SA2 Code:</strong> ${sa2Code}</p>
        `;
        
        // Basic population data
        if (yearData["Total"]) {
            popupContent += `<p><strong>Total Population:</strong> ${yearData["Total"].toLocaleString()}</p>`;
        }
        
        // Religious data with delta analysis
        popupContent += `<h4>Religion (${this.currentYear})</h4>`;
        const religions = ['Christian', 'No religion', 'Buddhism', 'Hinduism', 'Islam', 'Judaism', 'Sikhism'];
        
        // Calculate deltas if we have previous year data
        const previousYear = this.currentYear === 2018 ? 2013 : 2006;
        const previousYearData = saData[String(previousYear)] || {};
        
        religions.forEach(religion => {
            const current = yearData[religion] || 0;
            const previous = previousYearData[religion] || 0;
            const delta = current - previous;
            const deltaPercent = previous > 0 ? ((delta / previous) * 100).toFixed(1) : 'N/A';
            const deltaIcon = delta > 0 ? '↗' : delta < 0 ? '↘' : '→';
            const deltaColor = delta > 0 ? 'green' : delta < 0 ? 'red' : 'gray';
            
            popupContent += `<p>${religion}: ${current.toLocaleString()} <span style="color: ${deltaColor};">${deltaIcon} ${deltaPercent}%</span></p>`;
        });
        
        // Add histogram placeholder
        popupContent += `<div id="religion-chart" style="width: 100%; height: 300px; margin-top: 10px;"></div>`;
        
        // Comprehensive demographic data if available
        if (comprehensiveData) {
            // Age data
            if (comprehensiveData.median_age !== undefined) {
                popupContent += `<h4>Age Profile</h4>`;
                popupContent += `<p>Median Age: ${comprehensiveData.median_age.toFixed(1)} years</p>`;
                
                // Top age groups
                const ageProfile = comprehensiveData.age_profile;
                if (ageProfile) {
                    const sortedAges = Object.entries(ageProfile)
                        .sort(([,a], [,b]) => b - a)
                        .slice(0, 3);
                    popupContent += `<p>Largest Age Groups: ${sortedAges.map(([age, count]) => `${age} (${count})`).join(', ')}</p>`;
                }
            }
            
            // Gender data
            if (comprehensiveData.gender_profile) {
                const genderData = comprehensiveData.gender_profile;
                const total = genderData.Female + genderData.Male;
                if (total > 0) {
                    const femalePercent = ((genderData.Female / total) * 100).toFixed(1);
                    popupContent += `<h4>Gender</h4>`;
                    popupContent += `<p>Female: ${femalePercent}% (${genderData.Female})</p>`;
                    popupContent += `<p>Male: ${(100 - femalePercent).toFixed(1)}% (${genderData.Male})</p>`;
                }
            }
            
            // Ethnicity data
            if (comprehensiveData.ethnicity_profile) {
                popupContent += `<h4>Ethnicity (Top 3)</h4>`;
                const ethnicityData = Object.entries(comprehensiveData.ethnicity_profile)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 3);
                ethnicityData.forEach(([ethnicity, count]) => {
                    popupContent += `<p>${ethnicity}: ${count}</p>`;
                });
            }
            
            // Economic indicators
            if (comprehensiveData.unemployment_rate !== undefined) {
                popupContent += `<h4>Economic</h4>`;
                popupContent += `<p>Unemployment: ${(comprehensiveData.unemployment_rate * 100).toFixed(1)}%</p>`;
            }
            
            if (comprehensiveData.home_ownership_rate !== undefined) {
                popupContent += `<p>Home Ownership: ${(comprehensiveData.home_ownership_rate * 100).toFixed(1)}%</p>`;
            }
            
            // Area characteristics
            if (comprehensiveData.population_density !== undefined) {
                popupContent += `<p>Density: ${comprehensiveData.population_density} people/km²</p>`;
            }
            
            if (comprehensiveData.region_type) {
                popupContent += `<p>Type: ${comprehensiveData.region_type.charAt(0).toUpperCase() + comprehensiveData.region_type.slice(1)}</p>`;
            }
        }
        
        popupContent += `<small>Sources: Statistics New Zealand, OpenStreetMap</small>`;
        popupContent += `</div>`;
        
        return popupContent;
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
    
    setupStreetView() {
        // Alternative to Street View: provide useful links and information
        this.map.on('popupopen', (e) => {
            setTimeout(() => {
                const panoElem = e.popup._contentNode.querySelector('.pano');
                if (panoElem) {
                    const coords = e.popup._latlng;
                    const lat = coords.lat.toFixed(6);
                    const lng = coords.lng.toFixed(6);
                    
                    panoElem.innerHTML = `
                        <div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 6px; padding: 15px; margin-top: 10px;">
                            <h4 style="margin: 0 0 10px 0; color: #495057;">Location Services</h4>
                            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                <a href="https://www.google.com/maps/@${lat},${lng},19z" target="_blank" 
                                   style="background: #007bff; color: white; padding: 6px 12px; border-radius: 4px; text-decoration: none; font-size: 12px;">
                                   📍 Google Maps
                                </a>
                                <a href="https://www.google.com/maps?q=${lat},${lng}&layer=c&cbll=${lat},${lng}" target="_blank"
                                   style="background: #28a745; color: white; padding: 6px 12px; border-radius: 4px; text-decoration: none; font-size: 12px;">
                                   👁 Street View
                                </a>
                                <a href="https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=19" target="_blank"
                                   style="background: #6c757d; color: white; padding: 6px 12px; border-radius: 4px; text-decoration: none; font-size: 12px;">
                                   🗺 OpenStreetMap
                                </a>
                            </div>
                            <small style="color: #6c757d; margin-top: 8px; display: block;">
                                Coordinates: ${lat}, ${lng}
                            </small>
                        </div>
                    `;
                }
            }, 100);
        });
    }
    
    createReligiousHistogram(saData, regionName) {
        // Create religious change histogram using Plotly
        const religions = ['Christian', 'No religion', 'Buddhism', 'Hinduism', 'Islam', 'Judaism', 'Sikhism'];
        const currentYear = this.currentYear;
        const previousYear = currentYear === 2018 ? 2013 : 2006;
        
        const currentData = saData[String(currentYear)] || {};
        const previousData = saData[String(previousYear)] || {};
        
        const currentValues = religions.map(religion => currentData[religion] || 0);
        const previousValues = religions.map(religion => previousData[religion] || 0);
        
        const plotData = [
            {
                x: religions,
                y: previousValues,
                name: `${previousYear}`,
                type: 'bar',
                marker: { color: 'lightblue' }
            },
            {
                x: religions,
                y: currentValues,
                name: `${currentYear}`,
                type: 'bar',
                marker: { color: 'darkblue' }
            }
        ];
        
        const layout = {
            title: `Religious Affiliation in ${regionName}`,
            xaxis: { title: 'Religion' },
            yaxis: { title: 'Number of People' },
            barmode: 'group',
            height: 300,
            margin: { l: 60, r: 20, t: 60, b: 60 }
        };
        
        // Create the plot in the popup
        setTimeout(() => {
            const chartContainer = document.getElementById('religion-chart');
            if (chartContainer) {
                Plotly.newPlot(chartContainer, plotData, layout, {displayModeBar: false});
            }
        }, 100); // Small delay to ensure popup is fully rendered
    }
}

// Initialize the app when page loads
document.addEventListener('DOMContentLoaded', () => {
    new EnhancedPlacesOfWorshipApp();
});