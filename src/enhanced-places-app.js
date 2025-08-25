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
        this.currentBaseLayer = null;
        
        // Place data
        this.placesData = null;
        this.markerClusterGroup = null;
        this.placesLayer = null;
        
        // Census data
        this.censusData = null;
        this.demographicData = null;
        this.censusLayer = null;
        this.boundariesData = null;
        this.territorialAuthorityData = null;
        this.taCensusData = null;
        this.showCensusOverlay = false;
        this.currentCensusMetric = 'no_religion_change';
        this.overlayYear = 2018;  // Fixed year for overlay colors
        this.useDetailedBoundaries = true;  // Default to SA2 boundaries
        
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
        this.currentBaseLayer = this.baseLayers['Grayscale'];
        this.currentBaseLayer.addTo(this.map);
        
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
            
            // Show/hide census controls
            const censusControls = document.getElementById('censusControls');
            if (e.target.checked) {
                censusControls.classList.add('active');
            } else {
                censusControls.classList.remove('active');
            }
        });
        
        
        // Census metric selector
        const censusMetricSelect = document.getElementById('censusMetricSelect');
        censusMetricSelect.addEventListener('change', (e) => {
            this.currentCensusMetric = e.target.value;
            this.updateCensusVisualization();
            this.updateDemographicLegend();
        });
        
        // Map style selector
        const mapStyleSelect = document.getElementById('mapStyleSelect');
        mapStyleSelect.addEventListener('change', (e) => {
            this.changeMapStyle(e.target.value);
        });
        
        
        // Reset button
        document.getElementById('resetButton').addEventListener('click', () => {
            this.resetView();
        });
        
        // Toggle clustering
        document.getElementById('toggleClustering').addEventListener('click', () => {
            this.toggleClustering();
        });
        
        // Geographic resolution toggle
        const geographicResolutionToggle = document.getElementById('geographicResolutionToggle');
        const geographicResolutionLabel = document.getElementById('geographicResolutionLabel');
        geographicResolutionToggle.addEventListener('change', (e) => {
            this.useDetailedBoundaries = !e.target.checked;
            
            // Update label
            if (e.target.checked) {
                geographicResolutionLabel.textContent = 'Territorial Authorities (Regional)';
            } else {
                geographicResolutionLabel.textContent = 'Statistical Areas (Detailed)';
            }
            
            // Refresh census overlay if it's currently shown
            if (this.showCensusOverlay) {
                this.removeCensusOverlay();
                this.addCensusOverlay();
                this.updateDemographicLegend();
            }
        });
    }
    
    async loadData() {
        try {
            console.log('Starting to load data files...');
            
            // Load places, census, and comprehensive demographic data
            const [placesResponse, censusResponse, demographicResponse, boundariesResponse, territorialAuthorityResponse, taCensusResponse] = await Promise.all([
                fetch('./src/nz_places.json'),
                fetch('./src/religion.json'),
                fetch('./src/demographics.json'),
                fetch('./sa2.geojson'),
                fetch('./ta_boundaries.geojson'),
                fetch('./ta_aggregated_data.json')
            ]);
            
            console.log('Fetch responses:', {
                places: placesResponse.status,
                census: censusResponse.status, 
                demographic: demographicResponse.status,
                boundaries: boundariesResponse.status,
                territorialAuthority: territorialAuthorityResponse.status,
                taCensus: taCensusResponse.status
            });
            
            // Check each response individually for better error reporting
            if (!placesResponse.ok) {
                throw new Error(`Failed to load places data: ${placesResponse.status} ${placesResponse.statusText}`);
            }
            if (!censusResponse.ok) {
                throw new Error(`Failed to load census data: ${censusResponse.status} ${censusResponse.statusText}`);
            }
            if (!demographicResponse.ok) {
                throw new Error(`Failed to load demographic data: ${demographicResponse.status} ${demographicResponse.statusText}`);
            }
            if (!boundariesResponse.ok) {
                throw new Error(`Failed to load SA2 boundaries: ${boundariesResponse.status} ${boundariesResponse.statusText}`);
            }
            if (!territorialAuthorityResponse.ok) {
                throw new Error(`Failed to load TA boundaries: ${territorialAuthorityResponse.status} ${territorialAuthorityResponse.statusText}`);
            }
            if (!taCensusResponse.ok) {
                throw new Error(`Failed to load TA census data: ${taCensusResponse.status} ${taCensusResponse.statusText}`);
            }
            
            this.placesData = await placesResponse.json();
            this.censusData = await censusResponse.json();
            this.demographicData = await demographicResponse.json();
            this.boundariesData = await boundariesResponse.json();
            this.territorialAuthorityData = await territorialAuthorityResponse.json();
            this.taCensusData = await taCensusResponse.json();
            
            console.log('Loaded data:', {
                places: this.placesData.length,
                censusRegions: Object.keys(this.censusData).length,
                demographicRegions: Object.keys(this.demographicData).length,
                boundaries: this.boundariesData.features.length,
                territorialAuthorityFeatures: this.territorialAuthorityData.features.length,
                taCensusRegions: Object.keys(this.taCensusData).length
            });
            
            // Debug TA boundaries - check if they're real or rectangular
            if (this.territorialAuthorityData.features.length > 0) {
                const firstTA = this.territorialAuthorityData.features[0];
                const coords = firstTA.geometry.coordinates[0];
                if (coords && coords.length > 0) {
                    const ring = coords[0];
                    console.log('First TA (' + firstTA.properties.TA2025_NAME + ') has', ring.length, 'coordinate points');
                    console.log('Sample coordinates:', ring.slice(0, 3));
                    
                    // Check if it's a rectangle (4-5 points with very simple coordinates)
                    if (ring.length <= 5) {
                        console.warn('WARNING: TA boundaries appear to be rectangles!');
                    } else {
                        console.log('✓ TA boundaries appear to be real geographic shapes');
                    }
                }
            }
            
            
            // Populate filter dropdowns
            this.populateFilterDropdowns();
            
        } catch (error) {
            console.error('Error loading data:', error);
            console.error('Error stack:', error.stack);
            this.hideLoading();
            this.showError(`Failed to load data files: ${error.message}. Please check the browser console for detailed error information.`);
        }
    }
    
    setupDenominationColors() {
        // Use denomination mapper for consistent coloring - convert to GeoJSON format
        const geoJsonFeatures = this.placesData.map(place => ({
            properties: {
                denomination: place.denomination
            }
        }));
        const categorizedData = this.denominationMapper.categorizeFeatures(geoJsonFeatures);
        
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
            this.placesData.forEach(place => {
                denominations.add(place.denomination);
            });
            return Array.from(denominations).sort();
        } else {
            // Return denominations within the major category
            const denominations = new Set();
            this.placesData.forEach(place => {
                const category = this.denominationMapper.getMajorCategory(place.denomination);
                if (category === this.currentMajorCategory) {
                    denominations.add(place.denomination);
                }
            });
            return Array.from(denominations).sort();
        }
    }
    
    countMajorCategory(category) {
        return this.placesData.filter(place => 
            this.denominationMapper.getMajorCategory(place.denomination) === category
        ).length;
    }
    
    countDenomination(denomination) {
        return this.placesData.filter(
            place => place.denomination === denomination
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
        let filtered = this.placesData;
        
        // Filter by major category
        if (this.currentMajorCategory !== 'all') {
            filtered = filtered.filter(place => 
                this.denominationMapper.getMajorCategory(place.denomination) === this.currentMajorCategory
            );
        }
        
        // Filter by specific denomination
        if (this.currentDenomination !== 'all') {
            filtered = filtered.filter(place => 
                place.denomination === this.currentDenomination
            );
        }
        
        return filtered;
    }
    
    createPlaceMarker(place) {
        const lat = place.lat;
        const lng = place.lng;
        
        // Get color using denomination mapper
        const color = this.denominationMapper.getDenominationColor(place.denomination, this.denominationColors);
        const icon = this.createDenominationIcon(color, place.confidence || 1.0);
        
        const marker = L.marker([lat, lng], { icon });
        
        // Create popup content
        const popupContent = this.createPopupContent(place);
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
            this.updateDemographicLegend();
        } else {
            this.removeCensusOverlay();
            this.hideDemographicLegend();
        }
    }
    
    addCensusOverlay() {
        // Check if we have the required data and layer doesn't already exist
        if (this.censusLayer) return;
        
        if (this.useDetailedBoundaries) {
            // Use SA2 boundaries and data (original behavior)
            if (!this.boundariesData) return;
            
            this.censusLayer = L.geoJSON(this.boundariesData, {
                style: (feature) => this.getCensusFeatureStyle(feature),
                onEachFeature: (feature, layer) => this.onEachCensusFeature(feature, layer)
            });
        } else {
            // Use territorial authority boundaries and data (new parallel behavior)
            if (!this.territorialAuthorityData) return;
            
            this.censusLayer = L.geoJSON(this.territorialAuthorityData, {
                style: (feature) => this.getTACensusFeatureStyle(feature),
                onEachFeature: (feature, layer) => this.onEachTACensusFeature(feature, layer)
            });
        }
        
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
            if (this.useDetailedBoundaries) {
                // Update SA2 styling
                this.censusLayer.setStyle((feature) => this.getCensusFeatureStyle(feature));
            } else {
                // Update TA styling
                this.censusLayer.setStyle((feature) => this.getTACensusFeatureStyle(feature));
            }
        }
    }
    
    getCensusFeatureStyle(feature) {
        const sa2Code = String(feature.properties.SA22018_V1_00); // Convert to string
        const color = this.calculateCensusColor(sa2Code);
        
        return {
            fillColor: color === 'gray' ? 'transparent' : color,
            fillOpacity: color === 'gray' ? 0 : 0.3,
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
    
    // Territorial Authority specific functions (parallel to SA2)
    getTACensusFeatureStyle(feature) {
        const taCode = String(feature.properties.TA2025_V1 || feature.properties.TA2025_NAME);
        const color = this.calculateTACensusColor(taCode);
        
        return {
            fillColor: color === 'gray' ? 'transparent' : color,
            fillOpacity: color === 'gray' ? 0 : 0.3,
            weight: 1,
            color: "#333333",
            opacity: 0.6
        };
    }
    
    calculateTACensusColor(taCode) {
        const taCodeStr = String(taCode);
        const taData = this.taCensusData ? this.taCensusData[taCodeStr] : null;
        if (!taData) return "gray";
        
        // Use TA census data directly with TA-specific color functions
        const dataSource = taData;
        
        switch (this.currentCensusMetric) {
            case 'no_religion_change':
                return this.calculateTANoReligionChangeColor(dataSource);
            case 'christian_change':
                return this.calculateTAChristianChangeColor(dataSource);
            case 'total_population':
                return this.calculateTAPopulationColor(dataSource);
            case 'diversity_index':
                return this.calculateTADiversityColor(dataSource);
            default:
                return "gray"; // Most demographic metrics not available for TA yet
        }
    }
    
    onEachTACensusFeature(feature, layer) {
        const taCode = String(feature.properties.TA2025_V1 || feature.properties.TA2025_NAME);
        const taData = this.taCensusData ? this.taCensusData[taCode] : null;
        
        if (taData) {
            const popupContent = this.createTACensusPopupContent(feature.properties, taData);
            layer.bindPopup(popupContent, {minWidth: 700, maxWidth: 800});
            
            // Add popup event handler for creating histogram
            layer.on('popupopen', (e) => {
                this.createReligiousHistogram(taData, feature.properties.TA2025_NAME);
            });
            
            // Add hover effects
            layer.on('mouseover', (e) => {
                layer.setStyle({
                    weight: 3,
                    color: '#666',
                    dashArray: '',
                    fillOpacity: 0.5
                });
            });
            
            layer.on('mouseout', (e) => {
                this.censusLayer.resetStyle(e.target);
            });
            
            // Add tooltip with region name
            layer.bindTooltip(feature.properties.TA2025_NAME, {
                sticky: true,
                direction: 'auto'
            });
        }
    }
    
    createTACensusPopupContent(properties, taData) {
        const taCode = String(properties.TA2025_V1 || properties.TA2025_NAME);
        const taName = properties.TA2025_NAME;
        
        // Get data for latest year (2018) for basic info
        const latestData = taData[String(2018)] || {};
        
        let popupContent = `
            <div class="census-popup">
                <h3>${taName}</h3>
                <p><strong>TA Code:</strong> ${taCode}</p>
                <p><strong>Census Timeline:</strong> 2006 → 2013 → 2018</p>
        `;
        
        // Basic population data from latest census
        if (latestData['Total stated']) {
            popupContent += `
                <p><strong>2018 Population (Stated Religion):</strong> ${latestData['Total stated'].toLocaleString()}</p>
            `;
            
            // Show top religions
            const religions = ['Christian', 'No religion', 'Buddhism', 'Hinduism', 'Islam'];
            religions.forEach(religion => {
                if (latestData[religion]) {
                    const percentage = (latestData[religion] / latestData['Total stated'] * 100).toFixed(1);
                    popupContent += `<p><strong>${religion}:</strong> ${latestData[religion].toLocaleString()} (${percentage}%)</p>`;
                }
            });
        }
        
        // Religious data timeline - show key religions only
        popupContent += `<h4>Religious Affiliation Timeline</h4>`;
        const keyReligions = ['Christian', 'No religion', 'Buddhism', 'Hinduism', 'Islam'];
        
        keyReligions.forEach(religion => {
            const data2006 = taData[String(2006)]?.[religion] || 0;
            const data2013 = taData[String(2013)]?.[religion] || 0;  
            const data2018 = taData[String(2018)]?.[religion] || 0;
            
            const trend = data2018 > data2006 ? '↗' : data2018 < data2006 ? '↘' : '→';
            const trendColor = data2018 > data2006 ? 'green' : data2018 < data2006 ? 'red' : 'gray';
            
            popupContent += `<p><strong>${religion}:</strong> ${data2006.toLocaleString()} → ${data2013.toLocaleString()} → ${data2018.toLocaleString()} <span style="color: ${trendColor};">${trend}</span></p>`;
        });
        
        // Add chart placeholder for histogram
        popupContent += `<div id="religion-chart" style="width: 100%; height: 450px; margin-top: 15px; border: 1px solid #ddd; border-radius: 5px;"></div>`;
        
        popupContent += `</div>`;
        return popupContent;
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
        const yearData = saData[String(this.overlayYear)];
        if (!yearData || !yearData["Total"]) return "gray";
        
        const population = yearData["Total"];
        if (population < 500) return "#FFF2CC";
        if (population < 1000) return "#FFE699";
        if (population < 2000) return "#FFD966";
        if (population < 5000) return "#F1C232";
        return "#B45F06";
    }
    
    calculateDiversityColor(saData) {
        const yearData = saData[String(this.overlayYear)];
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
        const yearData = saData[String(this.overlayYear)];
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
        const yearData = saData[String(this.overlayYear)];
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
        const yearData = saData[String(this.overlayYear)];
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
        const yearData = saData[String(this.overlayYear)];
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
        const yearData = saData[String(this.overlayYear)];
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
        const yearData = saData[String(this.overlayYear)];
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
        const yearData = saData[String(this.overlayYear)];
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
            layer.bindPopup(popupContent, {minWidth: 700, maxWidth: 800});
            
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
        // Get data for latest year (2018) for basic info
        const latestData = saData[String(2018)] || {};
        
        let popupContent = `
            <div class="census-popup">
                <h3>${properties.SA22018_V1_NAME}</h3>
                <p><strong>SA2 Code:</strong> ${sa2Code}</p>
                <p><strong>Census Timeline:</strong> 2006 → 2013 → 2018</p>
        `;
        
        // Basic population data from latest census
        if (latestData["Total"]) {
            popupContent += `<p><strong>Population (2018):</strong> ${latestData["Total"].toLocaleString()}</p>`;
        }
        
        // Religious data timeline - show key religions only
        popupContent += `<h4>Religious Affiliation Timeline</h4>`;
        const keyReligions = ['Christian', 'No religion', 'Buddhism', 'Hinduism', 'Islam'];
        
        keyReligions.forEach(religion => {
            const data2006 = saData[String(2006)]?.[religion] || 0;
            const data2013 = saData[String(2013)]?.[religion] || 0;  
            const data2018 = saData[String(2018)]?.[religion] || 0;
            
            const trend = data2018 > data2006 ? '↗' : data2018 < data2006 ? '↘' : '→';
            const trendColor = data2018 > data2006 ? 'green' : data2018 < data2006 ? 'red' : 'gray';
            
            popupContent += `<p><strong>${religion}:</strong> ${data2006.toLocaleString()} → ${data2013.toLocaleString()} → ${data2018.toLocaleString()} <span style="color: ${trendColor};">${trend}</span></p>`;
        });
        
        // Add histogram placeholder
        popupContent += `<div id="religion-chart" style="width: 100%; height: 450px; margin-top: 15px; border: 1px solid #ddd; border-radius: 5px;"></div>`;
        
        // Get comprehensive demographic data from latest year (2018)
        const demographicData = this.demographicData[sa2Code];
        const comprehensiveData = demographicData ? demographicData[String(2018)] : null;
        
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
        // Remove current base layer if it exists
        if (this.currentBaseLayer) {
            this.map.removeLayer(this.currentBaseLayer);
        }
        
        // Add new base layer
        if (this.baseLayers[styleKey]) {
            this.currentBaseLayer = this.baseLayers[styleKey];
            this.currentBaseLayer.addTo(this.map);
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
        // Create comprehensive 3-year religious timeline histogram using Plotly
        const religions = ['Christian', 'No religion', 'Buddhism', 'Hinduism', 'Islam', 'Judaism', 'Sikhism'];
        
        const data2006 = saData[String(2006)] || {};
        const data2013 = saData[String(2013)] || {};
        const data2018 = saData[String(2018)] || {};
        
        const values2006 = religions.map(religion => data2006[religion] || 0);
        const values2013 = religions.map(religion => data2013[religion] || 0);
        const values2018 = religions.map(religion => data2018[religion] || 0);
        
        // Debug: check data availability
        console.log('Histogram data for', regionName);
        console.log('2006 values:', values2006);
        console.log('2013 values:', values2013);  
        console.log('2018 values:', values2018);
        
        const plotData = [
            {
                x: religions,
                y: values2006,
                name: '2006 Census',
                type: 'bar',
                marker: { 
                    color: '#B3D9FF',
                    line: { color: '#4A90E2', width: 1 }
                },
                hovertemplate: '<b>%{x}</b><br>2006: %{y}<extra></extra>'
            },
            {
                x: religions,
                y: values2013,
                name: '2013 Census',
                type: 'bar',
                marker: { 
                    color: '#7CC7E8',
                    line: { color: '#5DADE2', width: 1 }
                },
                hovertemplate: '<b>%{x}</b><br>2013: %{y}<extra></extra>'
            },
            {
                x: religions,
                y: values2018,
                name: '2018 Census',
                type: 'bar',
                marker: { 
                    color: '#1F77B4',
                    line: { color: '#154A8A', width: 1 }
                },
                hovertemplate: '<b>%{x}</b><br>2018: %{y}<extra></extra>'
            }
        ];
        
        const layout = {
            title: {
                text: `Religious Change Timeline - ${regionName}`,
                font: { size: 16 }
            },
            xaxis: { 
                title: 'Religion',
                tickangle: -45
            },
            yaxis: { 
                title: 'Number of People'
            },
            barmode: 'group',
            height: 420,
            margin: { l: 70, r: 30, t: 70, b: 80 },
            showlegend: true,
            legend: {
                orientation: "h",
                x: 0.1,
                y: 1.1
            }
        };
        
        // Create the plot in the popup
        setTimeout(() => {
            const chartContainer = document.getElementById('religion-chart');
            if (chartContainer) {
                Plotly.newPlot(chartContainer, plotData, layout, {displayModeBar: false});
            }
        }, 100); // Small delay to ensure popup is fully rendered
    }
    
    updateDemographicLegend() {
        const legendSection = document.getElementById('demographicLegend');
        const legendTitle = document.getElementById('demographicLegendTitle');
        const legendContent = document.getElementById('demographicLegendContent');
        
        if (!this.showCensusOverlay) {
            legendSection.style.display = 'none';
            return;
        }
        
        legendSection.style.display = 'block';
        
        // Update title and content based on current metric
        const legendData = this.getDemographicLegendData();
        legendTitle.textContent = legendData.title;
        legendContent.innerHTML = legendData.content;
    }
    
    hideDemographicLegend() {
        const legendSection = document.getElementById('demographicLegend');
        legendSection.style.display = 'none';
    }
    
    getDemographicLegendData() {
        switch (this.currentCensusMetric) {
            case 'no_religion_change':
                return {
                    title: 'No Religion Change (2006-2018)',
                    content: `
                        <div class="legend-item">
                            <div class="legend-dot" style="background-color: purple; width: 12px; height: 12px;"></div>
                            More Religious (&lt;-1%)
                        </div>
                        <div class="legend-item">
                            <div class="legend-dot" style="background-color: lightgray; width: 12px; height: 12px;"></div>
                            Stable (-1% to +1%)
                        </div>
                        <div class="legend-item">
                            <div class="legend-dot" style="background-color: orange; width: 12px; height: 12px;"></div>
                            Less Religious (&gt;+1%)
                        </div>
                    `
                };
            
            case 'christian_change':
                return {
                    title: 'Christian Change (2006-2018)',
                    content: `
                        <div class="legend-item">
                            <div class="legend-dot" style="background-color: #2E8B57; width: 12px; height: 12px;"></div>
                            More Christian (&gt;+1%)
                        </div>
                        <div class="legend-item">
                            <div class="legend-dot" style="background-color: lightgray; width: 12px; height: 12px;"></div>
                            Stable (-1% to +1%)
                        </div>
                        <div class="legend-item">
                            <div class="legend-dot" style="background-color: #B22222; width: 12px; height: 12px;"></div>
                            Less Christian (&lt;-1%)
                        </div>
                    `
                };
            
            case 'median_age':
                return {
                    title: 'Median Age',
                    content: `
                        <div class="legend-item">
                            <div class="legend-dot" style="background-color: #FFE5E5; width: 12px; height: 12px;"></div>
                            Very Young (&lt;30)
                        </div>
                        <div class="legend-item">
                            <div class="legend-dot" style="background-color: #FFB3B3; width: 12px; height: 12px;"></div>
                            Young (30-35)
                        </div>
                        <div class="legend-item">
                            <div class="legend-dot" style="background-color: #FFE5CC; width: 12px; height: 12px;"></div>
                            Middle (35-45)
                        </div>
                        <div class="legend-item">
                            <div class="legend-dot" style="background-color: #FFCC99; width: 12px; height: 12px;"></div>
                            Middle-Older (45-50)
                        </div>
                        <div class="legend-item">
                            <div class="legend-dot" style="background-color: #FF9966; width: 12px; height: 12px;"></div>
                            Older (&gt;50)
                        </div>
                    `
                };
            
            case 'population_density':
                return {
                    title: 'Population Density (per km²)',
                    content: `
                        <div class="legend-item">
                            <div class="legend-dot" style="background-color: #E8F5E8; width: 12px; height: 12px;"></div>
                            Very Low (&lt;10)
                        </div>
                        <div class="legend-item">
                            <div class="legend-dot" style="background-color: #C8E6C9; width: 12px; height: 12px;"></div>
                            Low (10-50)
                        </div>
                        <div class="legend-item">
                            <div class="legend-dot" style="background-color: #A5D6A7; width: 12px; height: 12px;"></div>
                            Medium (50-100)
                        </div>
                        <div class="legend-item">
                            <div class="legend-dot" style="background-color: #FFCC80; width: 12px; height: 12px;"></div>
                            High (100-1000)
                        </div>
                        <div class="legend-item">
                            <div class="legend-dot" style="background-color: #FF8A65; width: 12px; height: 12px;"></div>
                            Very High (1000-2000)
                        </div>
                        <div class="legend-item">
                            <div class="legend-dot" style="background-color: #D32F2F; width: 12px; height: 12px;"></div>
                            Extreme (&gt;2000)
                        </div>
                    `
                };
            
            case 'income_level':
                return {
                    title: 'Average Income Level',
                    content: `
                        <div class="legend-item">
                            <div class="legend-dot" style="background-color: #FFCDD2; width: 12px; height: 12px;"></div>
                            Low (&lt;$40k)
                        </div>
                        <div class="legend-item">
                            <div class="legend-dot" style="background-color: #FFE0B2; width: 12px; height: 12px;"></div>
                            Medium-Low ($40k-$60k)
                        </div>
                        <div class="legend-item">
                            <div class="legend-dot" style="background-color: #FFF9C4; width: 12px; height: 12px;"></div>
                            Medium ($60k-$80k)
                        </div>
                        <div class="legend-item">
                            <div class="legend-dot" style="background-color: #C8E6C9; width: 12px; height: 12px;"></div>
                            Medium-High ($80k-$100k)
                        </div>
                        <div class="legend-item">
                            <div class="legend-dot" style="background-color: #4CAF50; width: 12px; height: 12px;"></div>
                            High ($100k-$130k)
                        </div>
                        <div class="legend-item">
                            <div class="legend-dot" style="background-color: #2E7D32; width: 12px; height: 12px;"></div>
                            Very High (&gt;$130k)
                        </div>
                    `
                };
            
            case 'unemployment_rate':
                return {
                    title: 'Unemployment Rate',
                    content: `
                        <div class="legend-item">
                            <div class="legend-dot" style="background-color: #E8F5E8; width: 12px; height: 12px;"></div>
                            Very Low (&lt;2%)
                        </div>
                        <div class="legend-item">
                            <div class="legend-dot" style="background-color: #C8E6C9; width: 12px; height: 12px;"></div>
                            Low (2-4%)
                        </div>
                        <div class="legend-item">
                            <div class="legend-dot" style="background-color: #FFF9C4; width: 12px; height: 12px;"></div>
                            Medium (4-6%)
                        </div>
                        <div class="legend-item">
                            <div class="legend-dot" style="background-color: #FFE0B2; width: 12px; height: 12px;"></div>
                            Medium-High (6-8%)
                        </div>
                        <div class="legend-item">
                            <div class="legend-dot" style="background-color: #FFCC80; width: 12px; height: 12px;"></div>
                            High (8-12%)
                        </div>
                        <div class="legend-item">
                            <div class="legend-dot" style="background-color: #D32F2F; width: 12px; height: 12px;"></div>
                            Very High (&gt;12%)
                        </div>
                    `
                };
            
            default:
                return {
                    title: 'Demographic Overlay',
                    content: '<div class="legend-item">Overlay active - colors represent selected metric</div>'
                };
        }
    }

    // TA-specific color calculation functions
    calculateTANoReligionChangeColor(taData) {
        if (!taData["2006"] || !taData["2018"] || 
            !taData["2006"]["Total stated"] || !taData["2018"]["Total stated"]) {
            return "gray";
        }
        
        const noReligion06Pct = taData["2006"]["No religion"] / taData["2006"]["Total stated"] * 100;
        const noReligion18Pct = taData["2018"]["No religion"] / taData["2018"]["Total stated"] * 100;
        const diff = noReligion18Pct - noReligion06Pct;
        
        if (diff < -1) {
            return "purple"; // More religious
        } else if (diff > 1) {
            return "pink"; // More secular
        } else {
            return "lightgray"; // Stable
        }
    }

    calculateTAChristianChangeColor(taData) {
        if (!taData["2006"] || !taData["2018"] || 
            !taData["2006"]["Total stated"] || !taData["2018"]["Total stated"]) {
            return "gray";
        }
        
        const christian06Pct = taData["2006"]["Christian"] / taData["2006"]["Total stated"] * 100;
        const christian18Pct = taData["2018"]["Christian"] / taData["2018"]["Total stated"] * 100;
        const diff = christian18Pct - christian06Pct;
        
        if (diff > 1) {
            return "#2E8B57"; // More Christian
        } else if (diff < -1) {
            return "#CD5C5C"; // Less Christian
        } else {
            return "#D3D3D3"; // Stable
        }
    }

    calculateTAPopulationColor(taData) {
        if (!taData["2018"] || !taData["2018"]["Total stated"]) {
            return "gray";
        }
        
        const population = taData["2018"]["Total stated"];
        
        if (population > 100000) {
            return "#FF4500"; // High population
        } else if (population > 50000) {
            return "#FF6347"; // Medium-high population
        } else if (population > 25000) {
            return "#FFA500"; // Medium population
        } else if (population > 10000) {
            return "#FFD700"; // Medium-low population
        } else {
            return "#FFFFE0"; // Low population
        }
    }

    calculateTADiversityColor(taData) {
        if (!taData["2018"] || !taData["2018"]["Total stated"]) {
            return "gray";
        }
        
        const data2018 = taData["2018"];
        const total = data2018["Total stated"];
        
        if (total === 0) return "gray";
        
        // Calculate Simpson diversity index
        let sum = 0;
        const religions = ["Christian", "No religion", "Buddhism", "Hinduism", "Islam", "Judaism", "Māori Christian", "Other religion"];
        
        for (const religion of religions) {
            const count = data2018[religion] || 0;
            const proportion = count / total;
            sum += proportion * proportion;
        }
        
        const diversity = 1 - sum;
        
        if (diversity > 0.7) {
            return "#4CAF50"; // Very diverse
        } else if (diversity > 0.6) {
            return "#8BC34A"; // Diverse
        } else if (diversity > 0.5) {
            return "#FFC107"; // Moderate diversity
        } else if (diversity > 0.3) {
            return "#FF9800"; // Low diversity
        } else {
            return "#FF5722"; // Very low diversity
        }
    }
}

// Initialize the app when page loads
document.addEventListener('DOMContentLoaded', () => {
    new EnhancedPlacesOfWorshipApp();
});