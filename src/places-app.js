/**
 * Places of Worship Map Application
 * Displays individual places as point markers with clustering
 */

class PlacesOfWorshipApp {
    constructor() {
        this.map = null;
        this.placesLayer = null;
        this.markerClusterGroup = null;
        this.placesData = null;
        this.currentFilter = 'all';
        this.denominationColors = {};
        
        this.init();
    }
    
    async init() {
        this.setupMap();
        this.setupControls();
        await this.loadPlacesData();
        this.setupDenominationColors();
        this.displayPlaces();
        this.hideLoading();
    }
    
    setupMap() {
        // Initialize Leaflet map centred on New Zealand
        this.map = L.map('map').setView([-41.235726, 172.5118422], 6);
        
        // Add OpenStreetMap base layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
            minZoom: 5,
        }).addTo(this.map);
        
        // Initialize marker cluster group
        this.markerClusterGroup = L.markerClusterGroup({
            chunkedLoading: true,
            maxClusterRadius: 50,
            iconCreateFunction: (cluster) => this.createClusterIcon(cluster)
        });
        
        this.map.addLayer(this.markerClusterGroup);
    }
    
    setupControls() {
        // Denomination filter
        const filterSelect = document.getElementById('denominationFilter');
        filterSelect.addEventListener('change', (e) => {
            this.currentFilter = e.target.value;
            this.updateDisplay();
        });
        
        // Reset button
        document.getElementById('resetButton').addEventListener('click', () => {
            this.resetView();
        });
        
        // Toggle clustering
        document.getElementById('toggleClustering').addEventListener('click', () => {
            this.toggleClustering();
        });
    }
    
    async loadPlacesData() {
        try {
            const response = await fetch('https://www.dropbox.com/scl/fi/jss3eqlbkitemjb1bomjx/nz_places.geojson?rlkey=2iquuitdfcwq0u7lo3lounlnb&dl=1');
            if (!response.ok) {
                throw new Error('Failed to load places data');
            }
            
            this.placesData = await response.json();
            console.log(`Loaded ${this.placesData.features.length} places of worship`);
            
            // Populate filter dropdown
            this.populateFilterDropdown();
            
        } catch (error) {
            console.error('Error loading places data:', error);
            this.showError('Failed to load places data. Please check that nz_places.geojson is available.');
        }
    }
    
    setupDenominationColors() {
        // Create a colour palette for denominations
        const denominations = new Set();
        this.placesData.features.forEach(feature => {
            denominations.add(feature.properties.denomination);
        });
        
        const colors = [
            '#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#f39c12',
            '#e67e22', '#1abc9c', '#34495e', '#d35400', '#27ae60',
            '#8e44ad', '#2980b9', '#c0392b', '#16a085', '#f1c40f',
            '#e8950a', '#95a5a6', '#7f8c8d', '#bdc3c7', '#ecf0f1'
        ];
        
        Array.from(denominations).forEach((denom, index) => {
            this.denominationColors[denom] = colors[index % colors.length];
        });
    }
    
    populateFilterDropdown() {
        const filterSelect = document.getElementById('denominationFilter');
        const denominations = new Set();
        
        this.placesData.features.forEach(feature => {
            denominations.add(feature.properties.denomination);
        });
        
        // Clear existing options except 'All'
        while (filterSelect.children.length > 1) {
            filterSelect.removeChild(filterSelect.lastChild);
        }
        
        // Add denomination options
        Array.from(denominations).sort().forEach(denom => {
            const option = document.createElement('option');
            option.value = denom;
            option.textContent = `${denom} (${this.countDenomination(denom)})`;
            filterSelect.appendChild(option);
        });
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
        if (this.currentFilter === 'all') {
            return this.placesData.features;
        }
        
        return this.placesData.features.filter(
            feature => feature.properties.denomination === this.currentFilter
        );
    }
    
    createPlaceMarker(feature) {
        const props = feature.properties;
        const [lng, lat] = feature.geometry.coordinates;
        
        // Create custom icon based on denomination
        const color = this.denominationColors[props.denomination] || '#666666';
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
        return `
            <div class="place-popup">
                <h3>${props.name}</h3>
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
    
    updateDisplay() {
        this.displayPlaces();
    }
    
    updateInfoPanel(count) {
        document.getElementById('totalPlaces').textContent = count;
        document.getElementById('currentFilter').textContent = 
            this.currentFilter === 'all' ? 'All Denominations' : this.currentFilter;
    }
    
    resetView() {
        this.map.setView([-41.235726, 172.5118422], 6);
        document.getElementById('denominationFilter').value = 'all';
        this.currentFilter = 'all';
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
    new PlacesOfWorshipApp();
});