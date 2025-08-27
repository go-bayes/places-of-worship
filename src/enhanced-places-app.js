/**
 * Enhanced Places of Worship Map Application
 * Combines individual places with census overlay, multiple map styles, and hierarchical filtering
 */

console.log('🔥 DEBUG: enhanced-places-app.js file is being loaded');

// EMERGENCY TEST: Hide loading screen immediately when this script loads
setTimeout(() => {
    console.log('🔥 DEBUG: Emergency timeout attempting to hide loading screen');
    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
        console.log('🔥 DEBUG: Found loading element, hiding it');
        loadingEl.style.display = 'none';
    } else {
        console.log('🔥 DEBUG: Loading element not found!');
    }
}, 1000);

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
        this.showReligiousDensity = false;
        this.showCensusOverlay = false; // Keep for backward compatibility
        this.currentDemographicMode = 'religious_percentage';
        this.currentCensusMetric = 'no_religion_change'; // Keep for backward compatibility
        this.currentDemographic = 'none'; // Demographic toggle selection
        this.overlayYear = 2018;  // Fixed year for overlay colors
        this.useDetailedBoundaries = false;  // Default to TA boundaries (simplified view)
        
        // Additional demographic data containers
        this.birthRateData = null;  // Birth rates by SA2/TA
        this.migrationData = null;  // Migration rates by SA2/TA
        this.populationChangeData = null;  // Population change data
        this.ageGenderData = null;  // Age and gender demographics by TA
        this.employmentIncomeData = null;  // Employment and income data by TA
        this.ethnicityDensityData = null;  // Ethnicity and population density by TA
        
        // Color scaling system
        this.colorScale = null;
        this.religionColorDomain = [30, 65];  // Based on data analysis: 25th-90th percentiles
        
        // Filtering
        this.currentMajorCategory = 'all';
        this.currentDenomination = 'all';
        this.denominationMapper = new DenominationMapper();
        this.denominationColors = {};
        
        this.init();
    }
    
    async init() {
        try {
            console.log('🚀 Starting Enhanced Places app initialization...');
            
            // Step 1: Setup map and controls (no data needed)
            console.log('📍 Setting up map and controls...');
            try {
                this.setupMap();
                console.log('✅ Map setup completed');
            } catch (error) {
                console.error('❌ Map setup failed:', error);
                throw error;
            }
            
            try {
                this.setupControls();
                console.log('✅ Controls setup completed');
            } catch (error) {
                console.error('❌ Controls setup failed:', error);
                throw error;
            }
            
            // Step 2: Load all data files
            console.log('📊 Loading data files...');
            try {
                await this.loadData();
                console.log('✅ Data loading completed');
            } catch (error) {
                console.error('❌ Data loading failed:', error);
                throw error;
            }
            
            // Step 3: Initialize components that depend on loaded data
            console.log('🎨 Initializing color scales and denomination mapping...');
            try {
                this.initializeColorScale();
                console.log('✅ Color scale initialized');
            } catch (error) {
                console.error('❌ Color scale initialization failed:', error);
                throw error;
            }
            
            try {
                this.setupDenominationColors();
                console.log('✅ Denomination colors setup completed');
            } catch (error) {
                console.error('❌ Denomination colors setup failed:', error);
                throw error;
            }
            
            // Step 4: Display places on map
            console.log('🗺️  Displaying places on map...');
            try {
                this.displayPlaces();
                console.log('✅ Places displayed on map');
            } catch (error) {
                console.error('❌ Places display failed:', error);
                throw error;
            }
            
            // Step 5: All initialization complete - hide loading screen
            console.log('✅ App initialization completed successfully - hiding loading screen now');
            this.hideLoading();
            console.log('✅ Loading screen hidden');
            
        } catch (error) {
            console.error('❌ Failed to initialize application:', error);
            console.error('Error stack:', error.stack);
            this.hideLoading();
            this.showError(`Application failed to initialize: ${error.message}. Please check the browser console for detailed error information.`);
        }
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
        if (majorCategorySelect) {
            majorCategorySelect.addEventListener('change', (e) => {
            this.currentMajorCategory = e.target.value;
            this.updateDenominationFilter();
            this.updateDisplay();
            });
        }
        
        // Denomination filter
        const denominationSelect = document.getElementById('denominationFilter');
        if (denominationSelect) {
            denominationSelect.addEventListener('change', (e) => {
            this.currentDenomination = e.target.value;
            this.updateDisplay();
            });
        }
        
        // Census overlay toggle (Show regional demographics)
        const censusOverlayToggle = document.getElementById('censusOverlayToggle');
        if (censusOverlayToggle) {
            censusOverlayToggle.addEventListener('change', (e) => {
                console.log('Census overlay toggle changed:', e.target.checked);
                this.showReligiousDensity = e.target.checked;
                
                if (e.target.checked) {
                    // When enabling demographics, default to SA-2 level (more detailed)
                    this.useDetailedBoundaries = true;
                    
                    // Update the geographic resolution toggle to reflect SA-2 default
                    const geographicToggle = document.getElementById('geographicResolutionToggle');
                    const geographicLabel = document.getElementById('geographicResolutionLabel');
                    if (geographicToggle) {
                        geographicToggle.checked = false; // Unchecked = SA-2 level
                        if (geographicLabel) {
                            geographicLabel.textContent = 'Statistical Area 2 (Detailed)';
                        }
                    }
                    
                    // Refresh the overlay to show SA-2 level immediately
                    this.removeReligiousDensityOverlay();
                    setTimeout(() => {
                        this.addReligiousDensityOverlay();
                        this.showDemographicLegend(this.getReligiousDensityLegendData());
                    }, 50);
                    return; // Don't call toggleReligiousDensityOverlay again below
                } else {
                    this.hideDemographicLegend();
                }
                
                this.toggleReligiousDensityOverlay();
            });
        }
        
        // Geographic resolution toggle (Statistical Areas)
        const geographicToggle = document.getElementById('geographicResolutionToggle');
        if (geographicToggle) {
            const geographicLabel = document.getElementById('geographicResolutionLabel');
            geographicToggle.addEventListener('change', (e) => {
                this.useDetailedBoundaries = !e.target.checked;
                
                // Update label
                if (geographicLabel) {
                    if (e.target.checked) {
                        geographicLabel.textContent = 'Territorial Authority (Overview)';
                    } else {
                        geographicLabel.textContent = 'Statistical Area 2 (Detailed)';
                    }
                }
                
                // Refresh overlays if currently shown
                if (this.showReligiousDensity) {
                    this.removeReligiousDensityOverlay();
                    this.addReligiousDensityOverlay();
                    this.updateDemographicLegend();
                }
            });
        }
        
        // Religious density overlay toggle
        const religiousDensityToggle = document.getElementById('religiousDensityToggle');
        if (religiousDensityToggle) {
            religiousDensityToggle.addEventListener('change', (e) => {
            console.log('Religious density toggle changed:', e.target.checked);
            this.showReligiousDensity = e.target.checked;
            this.toggleReligiousDensityOverlay();
            
            // Show/hide demographic controls
            const demographicControls = document.getElementById('demographicControls');
            if (e.target.checked) {
                demographicControls.classList.add('active');
            } else {
                demographicControls.classList.remove('active');
            }
            });
        }
        
        // Demographic metric selector
        const demographicMetricSelect = document.getElementById('demographicMetricSelect');
        if (demographicMetricSelect) {
            demographicMetricSelect.addEventListener('change', (e) => {
            console.log('Demographic mode changed to:', e.target.value);
            this.currentDemographicMode = e.target.value;
            this.updateColorScale(); // Update color scale for new mode
            this.updateReligiousDensityVisualization(); // Refresh visualization
            this.updateDemographicLegend(); // Update legend
            });
        }
        
        // Map style selector
        const mapStyleSelect = document.getElementById('mapStyleSelect');
        if (mapStyleSelect) {
            mapStyleSelect.addEventListener('change', (e) => {
            this.changeMapStyle(e.target.value);
            });
        }
        
        // Initialize demographic toggle
        this.initializeDemographicToggle();
        
        // Reset button
        const resetButton = document.getElementById('resetButton');
        if (resetButton) {
            resetButton.addEventListener('click', () => {
            this.resetView();
            });
        }
        
        // Toggle clustering
        const toggleClustering = document.getElementById('toggleClustering');
        if (toggleClustering) {
            toggleClustering.addEventListener('click', () => {
            this.toggleClustering();
            });
        }
        
        // Export buttons
        const exportButton = document.getElementById('exportButton');
        if (exportButton) {
            exportButton.addEventListener('click', () => {
                this.exportData('all');
            });
        }
        
        const exportFilteredButton = document.getElementById('exportFilteredButton');
        if (exportFilteredButton) {
            exportFilteredButton.addEventListener('click', () => {
                this.exportData('filtered');
            });
        }
    }
    
    initializeDemographicToggle() {
        const demographicToggle = document.getElementById('demographicToggle');
        if (demographicToggle) {
            demographicToggle.addEventListener('change', (e) => {
                this.currentDemographic = e.target.value;
                this.updateDemographicDisplay();
            });
        } else {
            console.warn('demographicToggle element not found in HTML - skipping demographic toggle setup');
        }
        
        // Initialize with none selected
        this.currentDemographic = 'none';
    }
    
    updateDemographicDisplay() {
        // Add demographic data to popups when a region is clicked
        // This will be called when demographic toggle changes
        console.log('Demographic display updated to:', this.currentDemographic);
        
        // Update any open popup with new demographic data
        if (this.currentPopup && this.currentPopup.isOpen()) {
            const popupContent = this.currentPopup.getContent();
            // Re-generate popup content with demographic data if needed
            // This will be implemented when we add the demographic data integration
        }
    }
    
    async loadData() {
        try {
            console.log('Starting to load data files...');
            console.log('Current URL base:', window.location.href);
            
            // Load places, census, and comprehensive demographic data
            console.log('📂 Attempting to fetch all required files...');
            console.log('  - ./src/nz_places.json');
            console.log('  - ./src/religion.json'); 
            console.log('  - ./src/demographics.json');
            console.log('  - ./sa2.geojson');
            console.log('  - ./territorial_authorities.geojson');
            console.log('  - ./ta_aggregated_data.json');
            
            const [placesResponse, censusResponse, demographicResponse, boundariesResponse, territorialAuthorityResponse, taCensusResponse] = await Promise.all([
                fetch('./src/nz_places.json').then(response => {
                    console.log('📄 nz_places.json response:', response.status, response.statusText);
                    return response;
                }),
                fetch('./src/religion.json').then(response => {
                    console.log('📄 religion.json response:', response.status, response.statusText);
                    return response;
                }),
                fetch('./src/demographics.json').then(response => {
                    console.log('📄 demographics.json response:', response.status, response.statusText);
                    return response;
                }),
                fetch('./sa2.geojson').then(response => {
                    console.log('📄 sa2.geojson response:', response.status, response.statusText);
                    return response;
                }),
                fetch('./territorial_authorities.geojson').then(response => {
                    console.log('📄 territorial_authorities.geojson response:', response.status, response.statusText);
                    return response;
                }).catch(e => {
                    console.error('❌ Failed to fetch TA boundaries:', e);
                    console.log('Resolved TA boundaries URL:', new URL('./territorial_authorities.geojson', window.location.href).href);
                    throw e;
                }),
                fetch('./ta_aggregated_data.json').then(response => {
                    console.log('📄 ta_aggregated_data.json response:', response.status, response.statusText);
                    return response;
                })
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
            
            // All data loaded successfully - no API calls needed for static census data
            console.log('✓ All static census data loaded successfully');
            
            // Load additional demographic data files (optional - won't fail if not available)
            try {
                await this.loadAdditionalDemographicData();
            } catch (error) {
                console.warn('Failed to load additional demographic data, continuing without it:', error);
            }
            
            // Populate filter dropdowns
            this.populateFilterDropdowns();
            
            console.log('✅ All census and demographic data loaded successfully');
            
        } catch (error) {
            console.error('Error loading data:', error);
            console.error('Error stack:', error.stack);
            this.hideLoading();
            this.showError(`Failed to load data files: ${error.message}. Please check the browser console for detailed error information.`);
        }
    }
    
    async loadAdditionalDemographicData() {
        console.log('Loading additional demographic data...');
        
        try {
            const [ageGenderResponse, employmentIncomeResponse, ethnicityDensityResponse, birthRatesResponse, migrationResponse, populationChangeResponse] = await Promise.all([
                fetch('./src/age_gender_static.json').catch(e => null),
                fetch('./src/employment_income_static.json').catch(e => null),
                fetch('./src/ethnicity_density_static.json').catch(e => null),
                fetch('./src/birth_rates_static.json').catch(e => null),
                fetch('./src/migration_data_static.json').catch(e => null),
                fetch('./src/population_change_static.json').catch(e => null)
            ]);
            
            // Load age and gender data
            if (ageGenderResponse && ageGenderResponse.ok) {
                const ageGenderData = await ageGenderResponse.json();
                this.ageGenderData = ageGenderData.data || {};
                console.log('✓ Age/gender data loaded:', Object.keys(this.ageGenderData).length, 'areas');
            } else {
                console.log('⚠ Age/gender data not available');
            }
            
            // Load employment and income data
            if (employmentIncomeResponse && employmentIncomeResponse.ok) {
                const employmentIncomeData = await employmentIncomeResponse.json();
                this.employmentIncomeData = employmentIncomeData.data || {};
                console.log('✓ Employment/income data loaded:', Object.keys(this.employmentIncomeData).length, 'areas');
            } else {
                console.log('⚠ Employment/income data not available');
            }
            
            // Load ethnicity and population density data
            if (ethnicityDensityResponse && ethnicityDensityResponse.ok) {
                const ethnicityDensityData = await ethnicityDensityResponse.json();
                this.ethnicityDensityData = ethnicityDensityData.data || {};
                console.log('✓ Ethnicity/density data loaded:', Object.keys(this.ethnicityDensityData).length, 'areas');
            } else {
                console.log('⚠ Ethnicity/density data not available');
            }
            
            // Load birth rates data
            if (birthRatesResponse && birthRatesResponse.ok) {
                const birthRatesData = await birthRatesResponse.json();
                this.birthRateData = birthRatesData.data || {};
                console.log('✓ Birth rates data loaded:', Object.keys(this.birthRateData).length, 'areas');
            } else {
                console.log('⚠ Birth rates data not available');
            }
            
            // Load migration data
            if (migrationResponse && migrationResponse.ok) {
                const migrationData = await migrationResponse.json();
                this.migrationData = migrationData.data || {};
                console.log('✓ Migration data loaded:', Object.keys(this.migrationData).length, 'areas');
            } else {
                console.log('⚠ Migration data not available');
            }
            
            // Load population change data
            if (populationChangeResponse && populationChangeResponse.ok) {
                const populationChangeData = await populationChangeResponse.json();
                this.populationChangeData = populationChangeData.data || {};
                console.log('✓ Population change data loaded:', Object.keys(this.populationChangeData).length, 'areas');
            } else {
                console.log('⚠ Population change data not available');
            }
            
        } catch (error) {
            console.warn('Error loading additional demographic data:', error);
        }
    }
    
    addBirthRateMigrationData(taCode) {
        let content = '';
        
        // Add birth rate data if available
        if (this.birthRateData && this.birthRateData[taCode]) {
            content += `<h4>Birth Rate Profile</h4>`;
            const birthData = this.birthRateData[taCode];
            const latestYear = Math.max(...Object.keys(birthData).map(y => parseInt(y)));
            
            if (birthData[latestYear]) {
                const data = birthData[latestYear];
                content += `
                    <p><strong>Birth Rate (${latestYear}):</strong> ${data.birth_rate.toFixed(1)} births per 1,000 people</p>
                    <p><strong>Total Births:</strong> ${data.births.toLocaleString()}</p>
                `;
                
                // Show trend if multiple years available
                const years = Object.keys(birthData).map(y => parseInt(y)).sort();
                if (years.length > 1) {
                    const earliestYear = years[0];
                    const trendChange = birthData[latestYear].birth_rate - birthData[earliestYear].birth_rate;
                    const trendIcon = trendChange > 0 ? '↗' : trendChange < 0 ? '↘' : '→';
                    const trendColor = trendChange > 0 ? '#27ae60' : trendChange < 0 ? '#e74c3c' : '#666';
                    
                    content += `
                        <p><strong>Trend (${earliestYear}-${latestYear}):</strong> 
                        <span style="color: ${trendColor};">
                        ${trendChange > 0 ? '+' : ''}${trendChange.toFixed(1)} per 1,000 ${trendIcon}
                        </span></p>
                    `;
                }
            }
        }
        
        // Add migration data if available
        if (this.migrationData && this.migrationData[taCode]) {
            content += `<h4>Migration Profile</h4>`;
            const migrationData = this.migrationData[taCode];
            const latestYear = Math.max(...Object.keys(migrationData).map(y => parseInt(y)));
            
            if (migrationData[latestYear]) {
                const data = migrationData[latestYear];
                const netMigration = data.net_migration;
                const migrationIcon = netMigration > 0 ? '↗' : netMigration < 0 ? '↘' : '→';
                const migrationColor = netMigration > 0 ? '#27ae60' : netMigration < 0 ? '#e74c3c' : '#666';
                
                content += `
                    <p><strong>Net Migration (${latestYear}):</strong> 
                    <span style="color: ${migrationColor};">
                    ${netMigration > 0 ? '+' : ''}${netMigration.toLocaleString()} people ${migrationIcon}
                    </span></p>
                    <p><strong>Internal Migration:</strong> ${(data.internal_migration_in - data.internal_migration_out).toLocaleString()} (net)</p>
                    <p><strong>External Migration:</strong> ${(data.external_migration_in - data.external_migration_out).toLocaleString()} (net)</p>
                `;
            }
        }
        
        return content;
    }
    
    addAgeGenderData(taCode) {
        let content = '';
        
        try {
            // Add age data if available
            if (this.ageGenderData && this.ageGenderData[taCode]) {
                const taData = this.ageGenderData[taCode];
                const years = Object.keys(taData).filter(y => !isNaN(parseInt(y)));
                
                if (years.length === 0) {
                    return content;
                }
                
                const latestYear = Math.max(...years.map(y => parseInt(y)));
                
                if (taData[latestYear] && taData[latestYear].age) {
                const ageData = taData[latestYear].age;
                content += `<h4>Age Profile (${latestYear})</h4>`;
                content += `
                    <p><strong>Median Age:</strong> ${ageData.median_age} years</p>
                    <div style="margin: 10px 0;">
                        <p><strong>Age Distribution:</strong></p>
                        <p style="margin-left: 15px;">• 0-14 years: ${ageData.age_0_14_percent}% (${ageData.age_0_14.toLocaleString()})</p>
                        <p style="margin-left: 15px;">• 15-29 years: ${ageData.age_15_29_percent}% (${ageData.age_15_29.toLocaleString()})</p>
                        <p style="margin-left: 15px;">• 30-49 years: ${ageData.age_30_49_percent}% (${ageData.age_30_49.toLocaleString()})</p>
                        <p style="margin-left: 15px;">• 50-64 years: ${ageData.age_50_64_percent}% (${ageData.age_50_64.toLocaleString()})</p>
                        <p style="margin-left: 15px;">• 65+ years: ${ageData.age_65_plus_percent}% (${ageData.age_65_plus.toLocaleString()})</p>
                    </div>
                `;
                
                // Show trend if multiple years available
                const years = Object.keys(taData).map(y => parseInt(y)).sort();
                if (years.length > 1) {
                    const earliestYear = years[0];
                    const earliestAge = taData[earliestYear].age;
                    if (earliestAge) {
                        const agingTrend = ageData.median_age - earliestAge.median_age;
                        const trendIcon = agingTrend > 0 ? '↗' : agingTrend < 0 ? '↘' : '→';
                        const trendColor = agingTrend > 1 ? '#e74c3c' : agingTrend < -1 ? '#27ae60' : '#666';
                        
                        content += `
                            <p><strong>Aging Trend (${earliestYear}-${latestYear}):</strong> 
                            <span style="color: ${trendColor};">
                            ${agingTrend > 0 ? '+' : ''}${agingTrend.toFixed(1)} years ${trendIcon}
                            </span></p>
                        `;
                    }
                }
            }
            
                // Add gender data
                if (taData[latestYear] && taData[latestYear].gender) {
                    const genderData = taData[latestYear].gender;
                    content += `
                        <p><strong>Gender Split:</strong> ${genderData.male_percent}% male, ${genderData.female_percent}% female</p>
                    `;
                }
            }
        } catch (error) {
            console.warn('Error processing age/gender data for TA', taCode, ':', error);
            return '';
        }
        
        return content;
    }
    
    addEmploymentIncomeData(taCode) {
        let content = '';
        
        try {
            // Add employment data if available
            if (this.employmentIncomeData && this.employmentIncomeData[taCode]) {
                const taData = this.employmentIncomeData[taCode];
                const years = Object.keys(taData).filter(y => !isNaN(parseInt(y)));
                
                if (years.length === 0) {
                    return content;
                }
                
                const latestYear = Math.max(...years.map(y => parseInt(y)));
            
            if (taData[latestYear] && taData[latestYear].employment) {
                const empData = taData[latestYear].employment;
                content += `<h4>Employment Profile (${latestYear})</h4>`;
                content += `
                    <p><strong>Employment Rate:</strong> ${empData.employment_rate}%</p>
                    <p><strong>Unemployment Rate:</strong> ${empData.unemployment_rate}%</p>
                    <p><strong>Labour Force Participation:</strong> ${empData.participation_rate}%</p>
                    <p><strong>Working Age Population:</strong> ${empData.working_age_population.toLocaleString()}</p>
                `;
                
                // Show employment trend if multiple years available
                const years = Object.keys(taData).map(y => parseInt(y)).sort();
                if (years.length > 1) {
                    const earliestYear = years[0];
                    const earliestEmp = taData[earliestYear].employment;
                    if (earliestEmp) {
                        const unemploymentChange = empData.unemployment_rate - earliestEmp.unemployment_rate;
                        const trendIcon = unemploymentChange > 0 ? '↗' : unemploymentChange < 0 ? '↘' : '→';
                        const trendColor = unemploymentChange > 0 ? '#e74c3c' : unemploymentChange < 0 ? '#27ae60' : '#666';
                        
                        content += `
                            <p><strong>Unemployment Trend (${earliestYear}-${latestYear}):</strong> 
                            <span style="color: ${trendColor};">
                            ${unemploymentChange > 0 ? '+' : ''}${unemploymentChange.toFixed(1)}% ${trendIcon}
                            </span></p>
                        `;
                    }
                }
            }
            
            // Add income data
            if (taData[latestYear] && taData[latestYear].income) {
                const incomeData = taData[latestYear].income;
                content += `<h4>Income Profile (${latestYear})</h4>`;
                content += `
                    <p><strong>Median Income:</strong> $${incomeData.median_income.toLocaleString()}</p>
                    <div style="margin: 10px 0;">
                        <p><strong>Income Distribution:</strong></p>
                        <p style="margin-left: 15px;">• Under $20k: ${incomeData.income_under_20k_percent}% (${incomeData.income_under_20k.toLocaleString()})</p>
                        <p style="margin-left: 15px;">• $20k-$50k: ${incomeData.income_20k_50k_percent}% (${incomeData.income_20k_50k.toLocaleString()})</p>
                        <p style="margin-left: 15px;">• $50k-$100k: ${incomeData.income_50k_100k_percent}% (${incomeData.income_50k_100k.toLocaleString()})</p>
                        <p style="margin-left: 15px;">• Over $100k: ${incomeData.income_over_100k_percent}% (${incomeData.income_over_100k.toLocaleString()})</p>
                    </div>
                `;
                
                // Show income trend if multiple years available
                const years = Object.keys(taData).map(y => parseInt(y)).sort();
                if (years.length > 1) {
                    const earliestYear = years[0];
                    const earliestIncome = taData[earliestYear].income;
                    if (earliestIncome) {
                        const incomeChange = incomeData.median_income - earliestIncome.median_income;
                        const incomeChangePercent = (incomeChange / earliestIncome.median_income) * 100;
                        const trendIcon = incomeChange > 0 ? '↗' : incomeChange < 0 ? '↘' : '→';
                        const trendColor = incomeChange > 0 ? '#27ae60' : incomeChange < 0 ? '#e74c3c' : '#666';
                        
                        content += `
                            <p><strong>Income Growth (${earliestYear}-${latestYear}):</strong> 
                            <span style="color: ${trendColor};">
                            $${incomeChange.toLocaleString()} (+${incomeChangePercent.toFixed(1)}%) ${trendIcon}
                            </span></p>
                        `;
                    }
                }
            }
        }
        } catch (error) {
            console.warn('Error processing employment/income data for TA', taCode, ':', error);
            return '';
        }
        
        return content;
    }
    
    addEthnicityDensityData(taCode) {
        let content = '';
        
        try {
            // Add ethnicity and population density data if available
            if (this.ethnicityDensityData && this.ethnicityDensityData[taCode]) {
                const taData = this.ethnicityDensityData[taCode];
                const years = Object.keys(taData).filter(y => !isNaN(parseInt(y)));
                
                if (years.length === 0) {
                    return content;
                }
                
                const latestYear = Math.max(...years.map(y => parseInt(y)));
            
            if (taData[latestYear] && taData[latestYear].ethnicity) {
                const ethnicityData = taData[latestYear].ethnicity;
                content += `<h4>Ethnicity Profile (${latestYear})</h4>`;
                content += `
                    <div style="margin: 10px 0;">
                        <p><strong>Ethnic Composition:</strong></p>
                        <p style="margin-left: 15px;">• European: ${ethnicityData.european_percent}% (${ethnicityData.european.toLocaleString()})</p>
                        <p style="margin-left: 15px;">• Māori: ${ethnicityData.maori_percent}% (${ethnicityData.maori.toLocaleString()})</p>
                        <p style="margin-left: 15px;">• Pacific: ${ethnicityData.pacific_percent}% (${ethnicityData.pacific.toLocaleString()})</p>
                        <p style="margin-left: 15px;">• Asian: ${ethnicityData.asian_percent}% (${ethnicityData.asian.toLocaleString()})</p>
                        <p style="margin-left: 15px;">• MELAA: ${ethnicityData.melaa_percent}% (${ethnicityData.middle_eastern_latin_african.toLocaleString()})</p>
                        <p style="margin-left: 15px;">• Other: ${ethnicityData.other_percent}% (${ethnicityData.other.toLocaleString()})</p>
                    </div>
                `;
            }
            
            // Add population density data
            if (taData[latestYear] && taData[latestYear].geography) {
                const geographyData = taData[latestYear].geography;
                content += `<h4>Population Density</h4>`;
                content += `
                    <p><strong>Area:</strong> ${geographyData.area_km2.toLocaleString()} km²</p>
                    <p><strong>Population Density:</strong> ${geographyData.population_density} people/km² (${geographyData.population_density_category})</p>
                `;
            }
        }
        } catch (error) {
            console.warn('Error processing ethnicity/density data for TA', taCode, ':', error);
            return '';
        }
        
        return content;
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
    
    initializeColorScale() {
        // Initialize chroma.js color scale based on data distribution analysis
        // Using Spectral palette with domain based on religious identification percentiles
        if (typeof chroma !== 'undefined') {
            this.updateColorScale();
            console.log('Color scale initialized');
        } else {
            console.error('Chroma.js library not loaded');
        }
    }
    
    updateColorScale() {
        // Update color scale based on current demographic mode
        let domain, colors;
        
        switch (this.currentDemographicMode) {
            case 'religious_percentage':
                domain = [30, 65]; // Percentage range
                colors = ['#5e4fa2', '#3288bd', '#66c2a5', '#abdda4', '#e6f598', '#ffffbf', '#fee08b', '#fdae61', '#f46d43', '#d53e4f', '#9e0142'];
                break;
            case 'religious_counts':
                domain = [10, 50]; // Log-scaled count range
                colors = ['#f7f7f7', '#cccccc', '#969696', '#636363', '#252525']; // Grayscale for counts
                break;
            case 'temporal_change':
                domain = [0, 40]; // Change range (-20 to +20, shifted to 0-40)
                colors = ['#1a9850', '#66bd63', '#a6d96a', '#d9ef8b', '#ffffbf', '#fee08b', '#fdae61', '#f46d43', '#d73027']; // Diverging green-red (reversed)
                break;
            default:
                domain = [30, 65];
                colors = ['#5e4fa2', '#3288bd', '#66c2a5', '#abdda4', '#e6f598', '#ffffbf', '#fee08b', '#fdae61', '#f46d43', '#d53e4f', '#9e0142'];
        }
        
        this.colorScale = chroma.scale(colors).domain(domain);
        console.log(`Color scale updated for ${this.currentDemographicMode} with domain:`, domain);
    }
    
    toggleReligiousDensityOverlay() {
        console.log('toggleReligiousDensityOverlay called, showReligiousDensity:', this.showReligiousDensity);
        if (this.showReligiousDensity) {
            this.addReligiousDensityOverlay();
            this.updateDemographicLegend();
        } else {
            this.removeReligiousDensityOverlay();
            this.hideDemographicLegend();
        }
    }
    
    addReligiousDensityOverlay() {
        // Check if we have the required data and layer doesn't already exist
        if (!this.useDetailedBoundaries && this.taCensusData && this.territorialAuthorityData) {
            this.addTAReligiousDensityOverlay();
        } else if (this.useDetailedBoundaries && this.censusData && this.boundariesData) {
            this.addSA2ReligiousDensityOverlay();
        } else {
            console.warn('Required data not available for religious density overlay');
        }
    }
    
    removeReligiousDensityOverlay() {
        if (this.censusLayer) {
            this.map.removeLayer(this.censusLayer);
            this.censusLayer = null;
        }
    }
    
    addTAReligiousDensityOverlay() {
        // Add TA-based religious density overlay
        if (this.censusLayer) {
            this.map.removeLayer(this.censusLayer);
        }
        
        this.censusLayer = L.geoJSON(this.territorialAuthorityData, {
            style: (feature) => this.getTAReligiousDensityStyle(feature),
            onEachFeature: (feature, layer) => {
                layer.on({
                    mouseover: (e) => this.highlightFeature(e),
                    mouseout: (e) => this.resetHighlight(e),
                    click: (e) => this.showTAReligiousDensityPopup(e)
                });
            }
        }).addTo(this.map);
        
        // Move census layer behind places
        this.censusLayer.bringToBack();
    }
    
    addSA2ReligiousDensityOverlay() {
        // Add SA2-based religious density overlay  
        if (this.censusLayer) {
            this.map.removeLayer(this.censusLayer);
        }
        
        this.censusLayer = L.geoJSON(this.boundariesData, {
            style: (feature) => this.getSA2ReligiousDensityStyle(feature),
            onEachFeature: (feature, layer) => {
                layer.on({
                    mouseover: (e) => this.highlightFeature(e),
                    mouseout: (e) => this.resetHighlight(e),
                    click: (e) => this.showSA2ReligiousDensityPopup(e)
                });
            }
        }).addTo(this.map);
        
        // Move census layer behind places
        this.censusLayer.bringToBack();
    }
    
    getTAReligiousDensityStyle(feature) {
        let taCode = feature.properties.TA2025_V1 || feature.properties.TA2021_V1_ || feature.properties.TA2021_V1_00;
        const taName = feature.properties.TA2025_NAME || feature.properties.TA2021_V1_NAME || 'Unknown';
        
        // handle TA code mapping for mismatched GeoJSON and census codes
        const taCodeMapping = {
            '001': '012',  // Far North District -> Far North
            '068': '058',  // Waitaki District -> Waitaki
            '069': '006',  // Central Otago District -> Central Otago
            '070': '038',  // Queenstown-Lakes District -> Queenstown-Lakes
            '071': '011',  // Dunedin City -> Dunedin
            '072': '010',  // Clutha District -> Clutha
            '073': '046',  // Southland District -> Southland
            '074': '014',  // Gore District -> Gore
            '075': '021',  // Invercargill City -> Invercargill
            '076': '002'   // Auckland -> Auckland
        };
        
        // apply mapping if needed
        if (taCodeMapping[taCode]) {
            console.log(`🔄 Mapping TA code ${taCode} (${taName}) to census code ${taCodeMapping[taCode]}`);
            taCode = taCodeMapping[taCode];
        }
        
        const taData = this.taCensusData[taCode];
        
        // Enhanced debug logging for specific problem TAs
        if (!taData) {
            console.log(`❌ No TA data found for ${taName} (${taCode})`);
            console.log('Available TA codes in census data:', Object.keys(this.taCensusData));
            console.log('Feature properties:', feature.properties);
        } else {
            // Log successful matches for key areas
            if (['Queenstown', 'Southland', 'Gore', 'Dunedin'].some(name => taName.includes(name))) {
                console.log(`✅ Found data for ${taName} (${taCode}):`, Object.keys(taData));
            }
        }
        
        if (!taData || !taData[String(2018)]) {
            return {
                fillColor: '#cccccc',
                weight: 1,
                opacity: 0.3,
                color: '#666',
                fillOpacity: 0.1
            };
        }
        
        const yearData = taData[String(2018)];
        let colorValue = null;
        let fillColor = '#cccccc';
        let fillOpacity = 0.1;
        
        // Apply different color calculation based on display mode
        switch (this.currentDemographicMode) {
            case 'religious_percentage':
                colorValue = this.calculateReligiousPercentage(yearData);
                break;
            case 'religious_counts':
                colorValue = this.calculateReligiousCounts(yearData);
                break;
            case 'temporal_change':
                colorValue = this.calculateTemporalChange(taData);
                break;
        }
        
        if (this.colorScale && colorValue !== null) {
            fillColor = this.colorScale(colorValue).hex();
            fillOpacity = 0.6;
        }
        
        return {
            fillColor: fillColor,
            weight: 1.5,
            opacity: 0.8,
            color: '#333',
            fillOpacity: fillOpacity
        };
    }
    
    getSA2ReligiousDensityStyle(feature) {
        const sa2Code = feature.properties.SA22018_V1 || feature.properties.SA22018_V1_00;
        const sa2Data = this.censusData[sa2Code];
        
        if (!sa2Data || !sa2Data[String(2018)]) {
            return {
                fillColor: '#cccccc',
                weight: 0.5,
                opacity: 0.2,
                color: '#666',
                fillOpacity: 0.1
            };
        }
        
        const yearData = sa2Data[String(2018)];
        const religionPct = this.calculateReligiousPercentage(yearData);
        
        let fillColor = '#cccccc';
        let fillOpacity = 0.1;
        
        if (this.colorScale && religionPct !== null) {
            fillColor = this.colorScale(religionPct).hex();
            fillOpacity = 0.6;
        }
        
        return {
            fillColor: fillColor,
            weight: 0.5,
            opacity: 0.6,
            color: '#333',
            fillOpacity: fillOpacity
        };
    }
    
    calculateReligiousPercentage(yearData) {
        // Calculate percentage of people with religious identification (excluding no religion)
        // Formula: (Total stated - No religion) / Total stated * 100
        const totalStated = yearData['Total stated'] || 0;
        const noReligion = yearData['No religion'] || 0;
        
        if (totalStated === 0) return null;
        
        const religiousCount = totalStated - noReligion;
        return (religiousCount / totalStated) * 100;
    }
    
    calculateReligiousCounts(yearData) {
        // Calculate total religious population for count-based visualization
        const totalStated = yearData['Total stated'] || 0;
        if (totalStated === 0) return null;
        
        let religiousCount = 0;
        const religiousCategories = ['Christian', 'Buddhism', 'Hinduism', 'Islam', 'Judaism', 
                                   'Maori religions, beliefs, and philosophies', 
                                   'Other religions, beliefs, and philosophies',
                                   'Spiritualism and New Age religions'];
        
        religiousCategories.forEach(category => {
            const count = yearData[category];
            if (count && typeof count === 'number') {
                religiousCount += count;
            }
        });
        
        // Return log-scaled value for better visualization of count differences
        return religiousCount > 0 ? Math.log10(religiousCount + 1) * 10 : 0;
    }
    
    calculateTemporalChange(taData) {
        // Calculate change in religious percentage from 2013 to 2018 (2006 data not available)
        if (!taData['2013'] || !taData['2018']) return null;
        
        const pct2013 = this.calculateReligiousPercentage(taData['2013']);
        const pct2018 = this.calculateReligiousPercentage(taData['2018']);
        
        if (pct2013 === null || pct2018 === null) return null;
        
        // Return percentage point change, clamped to reasonable range for color scaling
        const change = pct2018 - pct2013;
        return Math.max(-20, Math.min(20, change)) + 20; // Shift to positive range (0-40) for color scale
    }
    
    updateReligiousDensityVisualization() {
        if (this.showReligiousDensity) {
            this.removeReligiousDensityOverlay();
            this.addReligiousDensityOverlay();
        }
    }
    
    showTAReligiousDensityPopup(e) {
        const feature = e.target.feature;
        let taCode = feature.properties.TA2025_V1 || feature.properties.TA2021_V1_ || feature.properties.TA2021_V1_00;
        const taName = feature.properties.TA2025_NAME || feature.properties.TA2021_V1_NAME || 'Unknown Area';
        
        // handle TA code mapping for mismatched GeoJSON and census codes
        const taCodeMapping = {
            '001': '012',  // Far North District -> Far North
            '068': '058',  // Waitaki District -> Waitaki
            '069': '006',  // Central Otago District -> Central Otago
            '070': '038',  // Queenstown-Lakes District -> Queenstown-Lakes
            '071': '011',  // Dunedin City -> Dunedin
            '072': '010',  // Clutha District -> Clutha
            '073': '046',  // Southland District -> Southland
            '074': '014',  // Gore District -> Gore
            '075': '021',  // Invercargill City -> Invercargill
            '076': '002'   // Auckland -> Auckland
        };
        
        // apply mapping if needed
        if (taCodeMapping[taCode]) {
            taCode = taCodeMapping[taCode];
        }
        
        const taData = this.taCensusData[taCode];
        
        if (!taData) {
            e.target.bindPopup(`
                <div class="census-popup">
                    <h3>${taName}</h3>
                    <p><strong>TA Code:</strong> ${taCode}</p>
                    <p><em>No census data available</em></p>
                </div>
            `);
            return;
        }
        
        const popupContent = this.formatReligiousDensityPopup(taData, taName, taCode, 'TA');
        e.target.bindPopup(popupContent, {minWidth: 900, maxWidth: 1000});
        
        // Add popup event handler for creating histogram
        e.target.on('popupopen', (popupEvent) => {
            this.createReligiousHistogram(taData, taName);
        });
    }
    
    showSA2ReligiousDensityPopup(e) {
        const feature = e.target.feature;
        const sa2Code = feature.properties.SA22018_V1 || feature.properties.SA22018_V1_00;
        const sa2Name = feature.properties.SA22018_V1_NAME || 'Unknown Area';
        const sa2Data = this.censusData[sa2Code];
        
        if (!sa2Data) {
            // check if this is a special uninhabited area
            const specialArea = this.detectSpecialAreaType(sa2Name, sa2Code, null);
            if (specialArea) {
                e.target.bindPopup(`
                    <div class="census-popup special-area">
                        <h3>${specialArea.icon} ${sa2Name}</h3>
                        <p><strong>SA2 Code:</strong> ${sa2Code}</p>
                        <p><strong>Area Type:</strong> ${specialArea.description}</p>
                        <div class="special-area-explanation">
                            <p><em>This area has no resident population data as it represents a ${specialArea.description.toLowerCase()}. Census data collection focuses on areas with permanent residential populations.</em></p>
                        </div>
                    </div>
                `);
            } else {
                e.target.bindPopup(`
                    <div class="census-popup">
                        <h3>${sa2Name}</h3>
                        <p><strong>SA2 Code:</strong> ${sa2Code}</p>
                        <p><em>No census data available</em></p>
                    </div>
                `);
            }
            return;
        }
        
        // check if area has data but is uninhabited
        const specialArea = this.detectSpecialAreaType(sa2Name, sa2Code, sa2Data);
        const popupContent = specialArea ? 
            this.formatSpecialAreaPopup(sa2Data, sa2Name, sa2Code, specialArea, 'SA2') :
            this.formatReligiousDensityPopup(sa2Data, sa2Name, sa2Code, 'SA2');
        e.target.bindPopup(popupContent, {minWidth: 900, maxWidth: 1000});
        
        // Add popup event handler for creating histogram
        e.target.on('popupopen', (popupEvent) => {
            this.createReligiousHistogram(sa2Data, sa2Name);
        });
    }
    
    detectSpecialAreaType(areaName, areaCode, censusData) {
        // detect uninhabited special areas based on name patterns and data characteristics
        const name = areaName.toLowerCase();
        
        // forest parks and conservation areas
        if (name.includes('forest park') || name.includes('forest reserve') || 
            name.includes('conservation area') || name.includes('national park')) {
            return { type: 'conservation', icon: '🌲', description: 'Protected Conservation Area' };
        }
        
        // water bodies
        if (name.includes('inland water') || name.includes('lake ') || name.includes('harbour') || 
            name.includes('inlet') || name.includes('bay') || name.includes('sound') || 
            name.includes('strait') || name.includes('river') || name.includes('creek')) {
            return { type: 'water', icon: '🌊', description: 'Water Body / Oceanic Area' };
        }
        
        // islands (inhabited or uninhabited)
        if (name.includes('island') || name.includes('islands')) {
            return { type: 'island', icon: '🏝️', description: 'Island Area' };
        }
        
        // remote areas with zero population
        if (censusData && this.isUninhabitedArea(censusData)) {
            return { type: 'remote', icon: '🏔️', description: 'Remote Uninhabited Area' };
        }
        
        return null;
    }
    
    isUninhabitedArea(censusData) {
        // check if area has consistent zero/null population across years
        const years = ['2006', '2013', '2018'];
        let totalZeroYears = 0;
        
        years.forEach(year => {
            const yearData = censusData[year];
            if (yearData) {
                const total = yearData['Total'] || yearData['Total stated'] || 0;
                if (total === 0) totalZeroYears++;
            }
        });
        
        // if 2+ years show zero population, likely uninhabited
        return totalZeroYears >= 2;
    }
    
    formatSpecialAreaPopup(censusData, areaName, areaCode, specialArea, areaType) {
        // create enhanced popup for special uninhabited areas
        const years = ['2006', '2013', '2018'];
        let timelineContent = '';
        
        // show census timeline to demonstrate consistent uninhabited status
        years.forEach(year => {
            const yearData = censusData[year];
            const total = yearData ? (yearData['Total'] || yearData['Total stated'] || 0) : 'N/A';
            const religious = yearData ? this.calculateReligiousPercentage(yearData) : 'N/A';
            timelineContent += `<strong>${year}:</strong> Total: ${total}, Religious: ${religious === 'N/A' ? 'N/A' : religious + '%'}<br>`;
        });
        
        return `
            <div class="census-popup special-area">
                <h3>${specialArea.icon} ${areaName}</h3>
                <p><strong>${areaType} Code:</strong> ${areaCode}</p>
                <p><strong>Area Type:</strong> ${specialArea.description}</p>
                
                <div class="census-timeline">
                    <h4>Census Timeline: 2006 → 2013 → 2018</h4>
                    <div class="timeline-data">${timelineContent}</div>
                </div>
                
                <div class="special-area-explanation">
                    <h4>Why No Religious Data?</h4>
                    <p><em>This ${specialArea.description.toLowerCase()} has no permanent resident population. Statistics New Zealand tracks these areas for geographic completeness, but census data collection focuses on areas with residential populations.</em></p>
                    
                    <div class="area-characteristics">
                        <strong>Area Characteristics:</strong>
                        <ul>
                            <li>Geographic boundary maintained for statistical purposes</li>
                            <li>Zero or minimal permanent residents across multiple census years</li>
                            <li>May include seasonal workers, visitors, or temporary populations not captured in residential census</li>
                        </ul>
                    </div>
                </div>
            </div>
        `;
    }

    formatReligiousDensityPopup(censusData, areaName, areaCode, areaType) {
        // Create comprehensive popup with temporal data and histogram placeholder
        const years = ['2006', '2013', '2018'];
        let summaryContent = '';
        let histogramDiv = '<div id="religious-histogram" style="width: 100%; height: 300px; margin-top: 15px;"></div>';
        
        // Add summary statistics for each year
        years.forEach(year => {
            if (year === '2006') {
                // Check if 2006 data exists (SA-2) or not (TA)
                if (censusData[year] && censusData[year]['Total stated'] > 0) {
                    const yearData = censusData[year];
                    const total = yearData['Total'] || yearData['Total stated'] || 0;
                    const religionPct = this.calculateReligiousPercentage(yearData);
                    
                    summaryContent += `
                        <div style="margin: 8px 0; padding: 8px; background: rgba(52, 152, 219, 0.1); border-left: 3px solid #3498db;">
                            <strong>${year}:</strong> 
                            Total: ${total.toLocaleString()}, 
                            Religious: ${religionPct ? religionPct.toFixed(1) + '%' : 'N/A'}
                        </div>
                    `;
                } else {
                    summaryContent += `
                        <div style="margin: 8px 0; padding: 8px; background: rgba(149, 149, 149, 0.1); border-left: 3px solid #999;">
                            <strong>${year}:</strong> 
                            Total: N/A, 
                            Religious: N/A
                        </div>
                    `;
                }
            } else if (censusData[year]) {
                const yearData = censusData[year];
                // handle both TA data ('Total stated' only) and SA2 data ('Total' + 'Total stated')
                const total = yearData['Total'] || yearData['Total stated'] || 0;
                const totalStated = yearData['Total stated'] || 0;
                const religionPct = this.calculateReligiousPercentage(yearData);
                
                summaryContent += `
                    <div style="margin: 8px 0; padding: 8px; background: rgba(52, 152, 219, 0.1); border-left: 3px solid #3498db;">
                        <strong>${year}:</strong> 
                        Total: ${total.toLocaleString()}, 
                        Religious: ${religionPct ? religionPct.toFixed(1) + '%' : 'N/A'}
                    </div>
                `;
            }
        });
        
        // Add demographic data section if selected
        let demographicContent = '';
        if (this.currentDemographic && this.currentDemographic !== 'none') {
            demographicContent = this.generateDemographicContent(areaName, areaCode, areaType);
        }

        return `
            <div class="census-popup">
                <h3>${areaName}</h3>
                <p><strong>${areaType} Code:</strong> ${areaCode}</p>
                <p><strong>Census Timeline:</strong> 2006 → 2013 → 2018</p>
                <div style="margin-top: 15px;">
                    <h4>Summary Statistics</h4>
                    ${summaryContent}
                </div>
                ${demographicContent}
                ${histogramDiv}
            </div>
        `;
    }
    
    generateDemographicContent(areaName, areaCode, areaType) {
        // Generate demographic information based on current selection
        const demographicType = this.currentDemographic;
        let content = `<div style="margin-top: 20px; padding: 15px; background: rgba(46, 125, 50, 0.1); border-left: 3px solid #2E7D32;">`;
        
        switch (demographicType) {
            case 'age':
                const ageContent = this.addAgeGenderData(areaCode);
                if (ageContent) {
                    content += ageContent;
                } else {
                    content += `
                        <h4>📊 Age Structure</h4>
                        <p><em>Age demographic data for ${areaName} not available.</em></p>
                        <p>• Median age, age groups, dependency ratios</p>
                        <p>• Young adult population (20-34 years)</p>
                        <p>• Aging population trends</p>
                    `;
                }
                break;
            case 'gender':
                const genderData = this.addAgeGenderData(areaCode);
                if (genderData) {
                    content += genderData;
                } else {
                    content += `
                        <h4>⚧ Gender Ratio</h4>
                        <p><em>Gender distribution data for ${areaName} not available.</em></p>
                        <p>• Male/female ratio</p>
                        <p>• Gender diversity indicators</p>
                    `;
                }
                break;
            case 'population_density':
                const densityData = this.addEthnicityDensityData(areaCode);
                if (densityData) {
                    content += densityData;
                } else {
                    content += `
                        <h4>🏘 Population Density</h4>
                        <p><em>Population density data for ${areaName} not available.</em></p>
                        <p>• People per km²</p>
                        <p>• Urban vs rural classification</p>
                        <p>• Housing density patterns</p>
                    `;
                }
                break;
            case 'home_ownership':
                content += `
                    <h4>🏠 Home Ownership</h4>
                    <p><em>Housing tenure data for ${areaName} not available.</em></p>
                    <p>• Ownership vs rental rates</p>
                    <p>• Housing affordability indicators</p>
                    <p>• Dwelling types</p>
                `;
                break;
            case 'income':
                const incomeData = this.addEmploymentIncomeData(areaCode);
                if (incomeData) {
                    content += incomeData;
                } else {
                    content += `
                        <h4>💰 Income Statistics</h4>
                        <p><em>Income data for ${areaName} not available.</em></p>
                        <p>• Median household income</p>
                        <p>• Income distribution quintiles</p>
                        <p>• Employment rates</p>
                    `;
                }
                break;
            case 'ethnicity':
                const ethnicityData = this.addEthnicityDensityData(areaCode);
                if (ethnicityData) {
                    content += ethnicityData;
                } else {
                    content += `
                        <h4>🌍 Ethnicity</h4>
                        <p><em>Ethnic composition data for ${areaName} not available.</em></p>
                        <p>• European, Māori, Pacific, Asian populations</p>
                        <p>• Cultural diversity indices</p>
                        <p>• Immigration patterns</p>
                    `;
                }
                break;
            case 'migration':
                const migrationData = this.addBirthRateMigrationData(areaCode);
                if (migrationData) {
                    content += migrationData;
                } else {
                    content += `
                        <h4>🚶 Migration Patterns</h4>
                        <p><em>Migration data for ${areaName} not available.</em></p>
                        <p>• Internal migration flows</p>
                        <p>• International migration</p>
                        <p>• Population mobility trends</p>
                    `;
                }
                break;
            case 'birth_rates':
                const birthData = this.addBirthRateMigrationData(areaCode);
                if (birthData) {
                    content += birthData;
                } else {
                    content += `
                        <h4>👶 Birth Rates</h4>
                        <p><em>Fertility and birth rate data for ${areaName} not available.</em></p>
                        <p>• Total fertility rate</p>
                    `;
                }
                break;
            case 'employment':
                const employmentData = this.addEmploymentIncomeData(areaCode);
                if (employmentData) {
                    content += employmentData;
                } else {
                    content += `
                        <h4>💼 Employment</h4>
                        <p><em>Employment data for ${areaName} not available.</em></p>
                        <p>• Employment rates</p>
                        <p>• Labour force participation</p>
                        <p>• Industry composition</p>
                    `;
                }
                break;
            case 'comprehensive':
                // Show all available demographic data for comprehensive view
                const allAgeGender = this.addAgeGenderData(areaCode);
                const allEmploymentIncome = this.addEmploymentIncomeData(areaCode);
                const allEthnicityDensity = this.addEthnicityDensityData(areaCode);
                const allBirthMigration = this.addBirthRateMigrationData(areaCode);
                
                content += `<h4>📊 Comprehensive Demographic Profile</h4>`;
                if (allAgeGender) content += allAgeGender;
                if (allEmploymentIncome) content += allEmploymentIncome;
                if (allEthnicityDensity) content += allEthnicityDensity;
                if (allBirthMigration) content += allBirthMigration;
                
                if (!allAgeGender && !allEmploymentIncome && !allEthnicityDensity && !allBirthMigration) {
                    content += `<p><em>Comprehensive demographic data for ${areaName} not available.</em></p>`;
                }
                break;
            case 'age_employment_income':
                const ageIncomeContent = this.addAgeGenderData(areaCode);
                const empIncContent = this.addEmploymentIncomeData(areaCode);
                if (ageIncomeContent || empIncContent) {
                    content += `<h4>👥💼 Age, Employment & Income Profile</h4>`;
                    if (ageIncomeContent) content += ageIncomeContent;
                    if (empIncContent) content += empIncContent;
                } else {
                    content += `
                        <h4>👥💼 Age, Employment & Income</h4>
                        <p><em>Age, employment and income data for ${areaName} not available.</em></p>
                        <p>• Age demographics and employment statistics would be shown here</p>
                    `;
                }
                break;
            default:
                return '';
        }
        
        content += `
            <p style="margin-top: 10px; font-size: 0.9em; color: #666;">
                📝 <em>Demographic data integration with Stats NZ APIs planned for future release</em>
            </p>
        </div>`;
        
        return content;
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
        const lat = props.lat || props.latitude;
        const lng = props.lng || props.longitude;
        
        // Create location services section
        const locationServices = lat && lng ? `
            <div class="location-services" style="margin-top: 15px; padding: 10px; background: #f8f9fa; border-radius: 5px; border-left: 3px solid #17a2b8;">
                <h5 style="margin: 0 0 8px 0; color: #333;">Location Services</h5>
                <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                    <a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" rel="noopener noreferrer" 
                       style="color: #007bff; text-decoration: none; display: flex; align-items: center; gap: 4px;">
                        📍 Google Maps
                    </a>
                    <a href="https://www.google.com/maps/@${lat},${lng},3a,75y,0h,90t/data=!3m4!1e1!3m2!1s0x0:0x0!2e0" target="_blank" rel="noopener noreferrer"
                       style="color: #007bff; text-decoration: none; display: flex; align-items: center; gap: 4px;">
                        👁 Street View
                    </a>
                    <a href="https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}" target="_blank" rel="noopener noreferrer"
                       style="color: #007bff; text-decoration: none; display: flex; align-items: center; gap: 4px;">
                        🗺 OpenStreetMap
                    </a>
                </div>
            </div>
        ` : '';
        
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
                ${locationServices}
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
        let taCode = String(feature.properties.TA2025_V1 || feature.properties.TA2025_NAME);
        
        // handle TA code mapping for mismatched GeoJSON and census codes
        const taCodeMapping = {
            '001': '012',  // Far North District -> Far North
            '068': '058',  // Waitaki District -> Waitaki
            '069': '006',  // Central Otago District -> Central Otago
            '070': '038',  // Queenstown-Lakes District -> Queenstown-Lakes
            '071': '011',  // Dunedin City -> Dunedin
            '072': '010',  // Clutha District -> Clutha
            '073': '046',  // Southland District -> Southland
            '074': '014',  // Gore District -> Gore
            '075': '021',  // Invercargill City -> Invercargill
            '076': '002'   // Auckland -> Auckland
        };
        
        if (taCodeMapping[taCode]) {
            taCode = taCodeMapping[taCode];
        }
        
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
        let taCode = String(feature.properties.TA2025_V1 || feature.properties.TA2025_NAME);
        
        // handle TA code mapping for mismatched GeoJSON and census codes
        const taCodeMapping = {
            '001': '012',  // Far North District -> Far North
            '068': '058',  // Waitaki District -> Waitaki
            '069': '006',  // Central Otago District -> Central Otago
            '070': '038',  // Queenstown-Lakes District -> Queenstown-Lakes
            '071': '011',  // Dunedin City -> Dunedin
            '072': '010',  // Clutha District -> Clutha
            '073': '046',  // Southland District -> Southland
            '074': '014',  // Gore District -> Gore
            '075': '021',  // Invercargill City -> Invercargill
            '076': '002'   // Auckland -> Auckland
        };
        
        if (taCodeMapping[taCode]) {
            taCode = taCodeMapping[taCode];
        }
        
        const taData = this.taCensusData ? this.taCensusData[taCode] : null;
        
        if (taData) {
            const popupContent = this.createTACensusPopupContent(feature.properties, taData);
            layer.bindPopup(popupContent, {minWidth: 900, maxWidth: 1000});
            
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
        let taCode = String(properties.TA2025_V1 || properties.TA2025_NAME);
        const taName = properties.TA2025_NAME;
        
        // handle TA code mapping for mismatched GeoJSON and census codes
        const taCodeMapping = {
            '001': '012',  // Far North District -> Far North
            '068': '058',  // Waitaki District -> Waitaki
            '069': '006',  // Central Otago District -> Central Otago
            '070': '038',  // Queenstown-Lakes District -> Queenstown-Lakes
            '071': '011',  // Dunedin City -> Dunedin
            '072': '010',  // Clutha District -> Clutha
            '073': '046',  // Southland District -> Southland
            '074': '014',  // Gore District -> Gore
            '075': '021',  // Invercargill City -> Invercargill
            '076': '002'   // Auckland -> Auckland
        };
        
        if (taCodeMapping[taCode]) {
            taCode = taCodeMapping[taCode];
        }
        
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
            const data2013 = taData[String(2013)]?.[religion] || 0;  
            const data2018 = taData[String(2018)]?.[religion] || 0;
            
            const total2013 = taData[String(2013)]?.['Total stated'] || 0;
            const total2018 = taData[String(2018)]?.['Total stated'] || 0;
            
            if (total2013 > 0 && total2018 > 0) {
                // Check if 2006 data is available (SA-2) or not (TA)
                const has2006Data = total2006 > 0;
                
                // Calculate percentages
                const pct2006 = has2006Data ? (data2006 / total2006 * 100) : null;
                const pct2013 = (data2013 / total2013 * 100);
                const pct2018 = (data2018 / total2018 * 100);
                
                // Calculate proportional changes from 2013 to 2018
                const pointChange = pct2018 - pct2013; // Percentage point change
                const relativeChange = pct2013 > 0 ? ((pct2018 - pct2013) / pct2013 * 100) : 0; // Relative change
                
                // Determine trend and colors
                const trend = pointChange > 0.5 ? '↗' : pointChange < -0.5 ? '↘' : '→';
                const trendColor = pointChange > 0.5 ? 'green' : pointChange < -0.5 ? 'red' : 'gray';
                const changeColor = pointChange > 0 ? '#2E8B57' : pointChange < 0 ? '#CD5C5C' : '#666';
                
                // Format the proportional change display
                const changeText = Math.abs(pointChange) > 0.1 ? 
                    `<span style="color: ${changeColor}; font-weight: bold;">
                        ${pointChange > 0 ? '+' : ''}${pointChange.toFixed(1)}pt (${data2018 > data2013 ? '+' : ''}${(data2018-data2013).toLocaleString()})
                    </span>` : 
                    '<span style="color: #666;">stable</span>';
                
                popupContent += `
                    <p><strong>${religion}:</strong><br>
                    <span style="font-size: 0.9em;">
                        ${has2006Data ? pct2006.toFixed(1) + '%' : 'N/A'} → ${pct2013.toFixed(1)}% → ${pct2018.toFixed(1)}% 
                        <span style="color: ${trendColor};">${trend}</span>
                    </span><br>
                    <span style="font-size: 0.85em; color: #555;">
                        Change 2013-2018: ${changeText}
                    </span>
                    </p>`;
            } else {
                // Fallback to absolute numbers if percentages can't be calculated
                const trend = data2018 > data2013 ? '↗' : data2018 < data2013 ? '↘' : '→';
                const trendColor = data2018 > data2013 ? 'green' : data2018 < data2013 ? 'red' : 'gray';
                
                popupContent += `<p><strong>${religion}:</strong> ${has2006Data ? data2006.toLocaleString() : 'N/A'} → ${data2013.toLocaleString()} → ${data2018.toLocaleString()} <span style="color: ${trendColor};">${trend}</span></p>`;
            }
        });
        
        // Add demographic context section
        popupContent += `<h4>Demographic Context</h4>`;
        
        // Calculate population change and density information
        const pop2013 = taData[String(2013)]?.['Total stated'] || 0;
        const pop2018 = taData[String(2018)]?.['Total stated'] || 0;
        const landArea = properties.LAND_AREA; // km²
        
        if (pop2013 > 0 && pop2018 > 0) {
            const popChange = pop2018 - pop2013;
            const popChangePercent = ((popChange / pop2013) * 100).toFixed(1);
            const changeColor = popChange > 0 ? '#27ae60' : '#e74c3c';
            const changeIcon = popChange > 0 ? '↗' : '↘';
            
            popupContent += `
                <p><strong>Population Change (2013-2018):</strong><br>
                <span style="color: ${changeColor};">
                ${popChange > 0 ? '+' : ''}${popChange.toLocaleString()} people (${popChangePercent}%) ${changeIcon}
                </span></p>
            `;
        }
        
        if (landArea && pop2018 > 0) {
            const density = (pop2018 / landArea).toFixed(1);
            popupContent += `
                <p><strong>Area:</strong> ${landArea.toLocaleString()} km²</p>
                <p><strong>Population Density (2018):</strong> ${density} people/km²</p>
            `;
        }
        
        // Add regional context
        const religiousPct2018 = this.calculateReligiousPercentage(taData[String(2018)]);
        if (religiousPct2018) {
            let regionalContext = '';
            if (religiousPct2018 > 65) {
                regionalContext = 'High religious identification (above national average)';
            } else if (religiousPct2018 < 50) {
                regionalContext = 'Lower religious identification (below national average)';
            } else {
                regionalContext = 'Moderate religious identification (near national average)';
            }
            popupContent += `<p><strong>Regional Profile:</strong> ${regionalContext}</p>`;
        }
        
        // Demographic data will be added via static files in future enhancement
        
        // Add data limitations note
        popupContent += `
            <div style="margin-top: 15px; padding: 8px; background: #f8f9fa; border-left: 3px solid #17a2b8; font-size: 0.85em; color: #666;">
                <strong>Note:</strong> Detailed demographic breakdowns (age, ethnicity, income) are available at SA2 level. 
                Switch to "Statistical Area 2" view for comprehensive demographics.
            </div>
        `;
        
        // Add chart placeholder for histogram
        popupContent += `<div id="religious-histogram" style="width: 100%; min-height: 400px; margin-top: 15px;"></div>`;
        
        popupContent += `</div>`;
        return popupContent;
    }
    
    calculateNoReligionChangeColor(saData) {
        // Use 2013→2018 change for consistency with TA level
        if (!saData["2013"] || !saData["2018"] || 
            !saData["2013"]["Total stated"] || !saData["2018"]["Total stated"]) {
            return "gray";
        }
        
        const noReligion13Pct = saData["2013"]["No religion"] / saData["2013"]["Total stated"] * 100;
        const noReligion18Pct = saData["2018"]["No religion"] / saData["2018"]["Total stated"] * 100;
        const diff = noReligion18Pct - noReligion13Pct;
        
        if (diff < -1) {
            return "purple"; // More religious
        } else if (diff > 1) {
            return "pink"; // More secular
        } else {
            return "lightgray"; // Stable
        }
    }
    
    calculateChristianChangeColor(saData) {
        // Use 2013→2018 change for consistency with TA level
        if (!saData["2013"] || !saData["2018"] || 
            !saData["2013"]["Total stated"] || !saData["2018"]["Total stated"]) {
            return "gray";
        }
        
        const christian13Pct = saData["2013"]["Christian"] / saData["2013"]["Total stated"] * 100;
        const christian18Pct = saData["2018"]["Christian"] / saData["2018"]["Total stated"] * 100;
        const diff = christian18Pct - christian13Pct;
        
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
            layer.bindPopup(popupContent, {minWidth: 900, maxWidth: 1000});
            
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
            
            const total2006 = saData[String(2006)]?.['Total stated'] || 0;
            const total2013 = saData[String(2013)]?.['Total stated'] || 0;
            const total2018 = saData[String(2018)]?.['Total stated'] || 0;
            
            if (total2013 > 0 && total2018 > 0) {
                // Check if 2006 data is available (SA-2) or not (TA)
                const has2006Data = total2006 > 0;
                
                // Calculate percentages
                const pct2006 = has2006Data ? (data2006 / total2006 * 100) : null;
                const pct2013 = (data2013 / total2013 * 100);
                const pct2018 = (data2018 / total2018 * 100);
                
                // Calculate proportional changes from 2013 to 2018
                const pointChange = pct2018 - pct2013; // Percentage point change
                const relativeChange = pct2013 > 0 ? ((pct2018 - pct2013) / pct2013 * 100) : 0; // Relative change
                
                // Determine trend and colors
                const trend = pointChange > 0.5 ? '↗' : pointChange < -0.5 ? '↘' : '→';
                const trendColor = pointChange > 0.5 ? 'green' : pointChange < -0.5 ? 'red' : 'gray';
                const changeColor = pointChange > 0 ? '#2E8B57' : pointChange < 0 ? '#CD5C5C' : '#666';
                
                // Format the proportional change display
                const changeText = Math.abs(pointChange) > 0.1 ? 
                    `<span style="color: ${changeColor}; font-weight: bold;">
                        ${pointChange > 0 ? '+' : ''}${pointChange.toFixed(1)}pt (${data2018 > data2013 ? '+' : ''}${(data2018-data2013).toLocaleString()})
                    </span>` : 
                    '<span style="color: #666;">stable</span>';
                
                popupContent += `
                    <p><strong>${religion}:</strong><br>
                    <span style="font-size: 0.9em;">
                        ${has2006Data ? pct2006.toFixed(1) + '%' : 'N/A'} → ${pct2013.toFixed(1)}% → ${pct2018.toFixed(1)}% 
                        <span style="color: ${trendColor};">${trend}</span>
                    </span><br>
                    <span style="font-size: 0.85em; color: #555;">
                        Change 2013-2018: ${changeText}
                    </span>
                    </p>`;
            } else {
                // Fallback to absolute numbers if percentages can't be calculated
                const trend = data2018 > data2013 ? '↗' : data2018 < data2013 ? '↘' : '→';
                const trendColor = data2018 > data2013 ? 'green' : data2018 < data2013 ? 'red' : 'gray';
                
                popupContent += `<p><strong>${religion}:</strong> ${has2006Data ? data2006.toLocaleString() : 'N/A'} → ${data2013.toLocaleString()} → ${data2018.toLocaleString()} <span style="color: ${trendColor};">${trend}</span></p>`;
            }
        });
        
        // Add histogram placeholder
        popupContent += `<div id="religious-histogram" style="width: 100%; height: 300px; margin-top: 15px;"></div>`;
        
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
            
            // Population change data will be added via static files in future enhancement
            
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
        
        // Reset religious density overlay
        document.getElementById('religiousDensityToggle').checked = false;
        this.showReligiousDensity = false;
        this.removeReligiousDensityOverlay();
        
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
    
    
    updateDemographicLegend() {
        const legendSection = document.getElementById('demographicLegend');
        const legendTitle = document.getElementById('demographicLegendTitle');
        const legendContent = document.getElementById('demographicLegendContent');
        
        // Check if religious density overlay is shown (new system) or old census overlay
        if (!this.showReligiousDensity && !this.showCensusOverlay) {
            legendSection.style.display = 'none';
            return;
        }
        
        legendSection.style.display = 'block';
        
        // Update title and content based on current mode
        let legendData;
        if (this.showReligiousDensity) {
            legendData = this.getReligiousDensityLegendData();
        } else {
            legendData = this.getDemographicLegendData();
        }
        
        legendTitle.textContent = legendData.title;
        legendContent.innerHTML = legendData.content;
    }
    
    hideDemographicLegend() {
        const legendSection = document.getElementById('demographicLegend');
        legendSection.style.display = 'none';
    }
    
    getReligiousDensityLegendData() {
        // Create dynamic legend based on chroma.js color scale and current demographic mode
        let title = 'Religious Identification';
        let content = '';
        
        switch (this.currentDemographicMode) {
            case 'religious_percentage':
                title = 'Religious Identification %';
                content = this.createColorScaleLegend('% of population with religious identification');
                break;
            case 'religious_counts':
                title = 'Religious Population Counts';  
                content = this.createCountBasedLegend();
                break;
            case 'temporal_change':
                title = 'Religious Change (2013→2018)';
                content = this.createTemporalChangeLegend();
                break;
        }
        
        // Add data source attribution
        content += `
            <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 0.8em; color: #666;">
                <strong>Data Sources:</strong><br>
                Statistics New Zealand (CC BY 4.0)<br>
                Census 2006, 2013, 2018
            </div>
        `;
        
        return { title, content };
    }
    
    createReligiousHistogram(censusData, areaName) {
        // Create simple HTML/CSS visualization instead of Plotly
        // Much more readable and larger display
        
        setTimeout(() => {
            const container = document.getElementById('religious-histogram');
            if (!container) {
                console.warn('Histogram container not found');
                return;
            }
            
            const years = ['2006', '2013', '2018'];
            const religionsToShow = ['Christian', 'No religion', 'Buddhism', 'Hinduism', 'Islam', 'Judaism'];
            
            // Enhanced color palette for denominations
            const religionColors = {
                'Christian': '#e74c3c',           // Vibrant red
                'No religion': '#95a5a6',        // Light grey
                'Buddhism': '#f39c12',           // Orange
                'Hinduism': '#e67e22',           // Dark orange  
                'Islam': '#27ae60',              // Green
                'Judaism': '#9b59b6'             // Purple
            };
            
            // Create HTML table with trend indicators
            let htmlContent = `
                <div style="width: 100%; background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <h3 style="text-align: center; margin-bottom: 20px; color: #2c3e50; font-size: 16px;">
                        Religious Affiliation Timeline - ${areaName}
                    </h3>
                    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                        <thead>
                            <tr style="background: #34495e; color: white;">
                                <th style="text-align: left; padding: 12px; border: 1px solid #ddd;">Religion</th>
                                <th style="text-align: right; padding: 12px; border: 1px solid #ddd;">2006</th>
                                <th style="text-align: right; padding: 12px; border: 1px solid #ddd;">2013</th>
                                <th style="text-align: right; padding: 12px; border: 1px solid #ddd;">2018</th>
                                <th style="text-align: center; padding: 12px; border: 1px solid #ddd;">Trend</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            religionsToShow.forEach((religion, index) => {
                const data2006 = censusData[String(2006)]?.[religion] || 0;
                const data2013 = censusData[String(2013)]?.[religion] || 0;  
                const data2018 = censusData[String(2018)]?.[religion] || 0;
                
                // Calculate proportions (percentages) - check if 2006 data available
                const total2006 = censusData[String(2006)]?.['Total stated'] || 0;
                const total2013 = censusData[String(2013)]?.['Total stated'] || 0;
                const total2018 = censusData[String(2018)]?.['Total stated'] || 0;
                const has2006Data = total2006 > 0;
                
                const pct2006 = has2006Data ? (data2006 / total2006 * 100) : 0;
                const pct2013 = total2013 > 0 ? (data2013 / total2013 * 100) : 0;
                const pct2018 = total2018 > 0 ? (data2018 / total2018 * 100) : 0;
                
                // Calculate percentage point change from 2013 to 2018
                const percentagePointChange = pct2018 - pct2013;
                const countChange = data2018 - data2013;
                
                // Use percentage points for trend direction (more meaningful for religious data)
                const trendIcon = percentagePointChange > 1.0 ? '↗' : percentagePointChange < -1.0 ? '↘' : '→';
                const trendColor = percentagePointChange > 1.0 ? '#27ae60' : percentagePointChange < -1.0 ? '#e74c3c' : '#666';
                
                // Show both percentage point change and count change
                const percentageText = percentagePointChange > 0 ? `+${percentagePointChange.toFixed(1)}pt` : `${percentagePointChange.toFixed(1)}pt`;
                const countText = countChange > 0 ? `(+${countChange.toLocaleString()})` : `(${countChange.toLocaleString()})`;
                const changeText = `${percentageText} ${countText}`;
                
                // Row background alternating
                const rowBg = index % 2 === 0 ? '#f8f9fa' : 'white';
                const religionColor = religionColors[religion] || '#34495e';
                
                htmlContent += `
                    <tr style="background: ${rowBg};">
                        <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">
                            <span style="display: inline-block; width: 12px; height: 12px; background: ${religionColor}; border-radius: 2px; margin-right: 8px;"></span>
                            ${religion}
                        </td>
                        <td style="text-align: right; padding: 10px; border: 1px solid #ddd;">
                            ${has2006Data ? data2006.toLocaleString() : 'N/A'}<br>
                            <small style="color: #666;">(${has2006Data ? pct2006.toFixed(1) + '%' : 'N/A'})</small>
                        </td>
                        <td style="text-align: right; padding: 10px; border: 1px solid #ddd;">
                            ${data2013.toLocaleString()}<br>
                            <small style="color: #666;">(${pct2013.toFixed(1)}%)</small>
                        </td>
                        <td style="text-align: right; padding: 10px; border: 1px solid #ddd;">
                            ${data2018.toLocaleString()}<br>
                            <small style="color: #666;">(${pct2018.toFixed(1)}%)</small>
                        </td>
                        <td style="text-align: center; padding: 10px; border: 1px solid #ddd;">
                            <span style="color: ${trendColor}; font-weight: bold; font-size: 16px;">${trendIcon}</span>
                            <br>
                            <span style="color: ${trendColor}; font-size: 11px;">${changeText}</span>
                        </td>
                    </tr>
                `;
            });
            
            htmlContent += `
                        </tbody>
                    </table>
                    <div style="margin-top: 15px; padding: 12px; background: #e8f6f3; border-left: 4px solid #27ae60; font-size: 12px; color: #2c3e50;">
                        <strong>Reading the trends (2013→2018):</strong><br>
                        ↗ Growing (+1.0+ percentage points) &nbsp;&nbsp; 
                        ↘ Declining (-1.0+ percentage points) &nbsp;&nbsp; 
                        → Stable (±1.0 percentage points)<br>
                        <em>Format: percentage point change (count change)</em>
                    </div>
                </div>
            `;
            
            container.innerHTML = htmlContent;
            
        }, 50); // Small delay to ensure popup is fully rendered
    }
    
    createColorScaleLegend(description) {
        if (!this.colorScale) return '<p>Color scale not available</p>';
        
        // Get appropriate thresholds based on current mode
        let thresholds, formatValue;
        
        switch (this.currentDemographicMode) {
            case 'religious_percentage':
                thresholds = [30, 35, 40, 45, 50, 55, 60, 65];
                formatValue = (val) => `${val}%`;
                break;
            case 'religious_counts':
                thresholds = [10, 20, 30, 40, 50];
                formatValue = (val) => {
                    const actualCount = Math.round(Math.pow(10, val/10) - 1);
                    return actualCount >= 1000 ? `${Math.round(actualCount/1000)}k` : actualCount.toString();
                };
                break;
            case 'temporal_change':
                thresholds = [5, 15, 20, 25, 35]; // Representing -15, -5, 0, +5, +15 percentage points
                formatValue = (val) => {
                    const change = val - 20; // Convert back to actual change
                    return change > 0 ? `+${change}pt` : `${change}pt`;
                };
                break;
            default:
                thresholds = [30, 35, 40, 45, 50, 55, 60, 65];
                formatValue = (val) => `${val}%`;
        }
        
        let legendHtml = `<p style="font-size: 0.9em; margin-bottom: 10px;">${description}</p>`;
        
        thresholds.forEach((threshold, index) => {
            const color = this.colorScale(threshold).hex();
            const nextThreshold = thresholds[index + 1];
            const range = nextThreshold ? 
                `${formatValue(threshold)} - ${formatValue(nextThreshold)}` : 
                `${formatValue(threshold)}+`;
            
            legendHtml += `
                <div class="legend-item" style="margin: 4px 0;">
                    <div class="legend-dot" style="background-color: ${color}; width: 16px; height: 16px; border: 1px solid #333;"></div>
                    <span style="font-size: 0.85em;">${range}</span>
                </div>
            `;
        });
        
        return legendHtml;
    }
    
    createCountBasedLegend() {
        return `
            <p style="font-size: 0.9em; margin-bottom: 10px;">Number of people with religious identification</p>
            <div class="legend-item">
                <div class="legend-dot" style="background-color: #3288bd; width: 16px; height: 16px;"></div>
                High population areas
            </div>
            <div class="legend-item">
                <div class="legend-dot" style="background-color: #66c2a5; width: 14px; height: 14px;"></div>
                Medium population areas
            </div>
            <div class="legend-item">
                <div class="legend-dot" style="background-color: #abdda4; width: 12px; height: 12px;"></div>
                Low population areas
            </div>
        `;
    }
    
    createTemporalChangeLegend() {
        return `
            <p style="font-size: 0.9em; margin-bottom: 10px;">Change in religious identification 2013→2018</p>
            <div class="legend-item">
                <div class="legend-dot" style="background-color: #1a9850; width: 16px; height: 16px;"></div>
                Large decrease (&gt;-5 points) - More secular
            </div>
            <div class="legend-item">
                <div class="legend-dot" style="background-color: #66bd63; width: 14px; height: 14px;"></div>
                Moderate decrease (-2 to -5 points)
            </div>
            <div class="legend-item">
                <div class="legend-dot" style="background-color: #ffffbf; width: 12px; height: 12px;"></div>
                Stable (-2 to +2 points)
            </div>
            <div class="legend-item">
                <div class="legend-dot" style="background-color: #f46d43; width: 14px; height: 14px;"></div>
                Moderate increase (+2 to +5 points)
            </div>
            <div class="legend-item">
                <div class="legend-dot" style="background-color: #d73027; width: 16px; height: 16px;"></div>
                Large increase (&gt;+5 points) - More religious
            </div>
        `;
    }
    
    getDemographicLegendData() {
        switch (this.currentCensusMetric) {
            case 'no_religion_change':
                return {
                    title: 'No Religion Change (2013-2018)',
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
                    title: 'Christian Change (2013-2018)',
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
    
    exportData(type = 'all') {
        console.log(`Exporting ${type} data...`);
        
        try {
            let dataToExport = [];
            const currentDate = new Date().toISOString().split('T')[0];
            
            if (type === 'all' || type === 'filtered') {
                // Export TA religious data
                if (this.taCensusData) {
                    dataToExport = this.prepareTADataForExport();
                }
            }
            
            if (dataToExport.length === 0) {
                alert('No data available for export');
                return;
            }
            
            // Convert to CSV
            const csvContent = this.convertToCSV(dataToExport);
            const filename = `nz_religious_data_${type}_${currentDate}.csv`;
            
            // Download CSV file
            this.downloadCSV(csvContent, filename);
            
        } catch (error) {
            console.error('Export failed:', error);
            alert('Export failed. Please try again.');
        }
    }
    
    prepareTADataForExport() {
        const exportData = [];
        
        Object.entries(this.taCensusData).forEach(([taCode, taData]) => {
            const taName = taData.name || `TA_${taCode}`;
            
            // Export data for each year
            ['2006', '2013', '2018'].forEach(year => {
                if (taData[year]) {
                    const yearData = taData[year];
                    const religiousPercentage = this.calculateReligiousPercentage(yearData);
                    const totalStated = yearData['Total stated'] || 0;
                    
                    exportData.push({
                        'TA_Code': taCode,
                        'TA_Name': taName,
                        'Year': year,
                        'Total_Population': yearData['Total'] || 0,
                        'Total_Stated': totalStated,
                        'Religious_Percentage': religiousPercentage ? religiousPercentage.toFixed(2) : 'N/A',
                        'Christian': yearData['Christian'] || 0,
                        'No_Religion': yearData['No religion'] || 0,
                        'Buddhism': yearData['Buddhism'] || 0,
                        'Hinduism': yearData['Hinduism'] || 0,
                        'Islam': yearData['Islam'] || 0,
                        'Judaism': yearData['Judaism'] || 0,
                        'Maori_Religions': yearData['Maori religions, beliefs, and philosophies'] || 0,
                        'Other_Religions': yearData['Other religions, beliefs, and philosophies'] || 0
                    });
                }
            });
        });
        
        return exportData;
    }
    
    convertToCSV(data) {
        if (data.length === 0) return '';
        
        // Get headers from the first object
        const headers = Object.keys(data[0]);
        const csvHeaders = headers.join(',');
        
        // Convert data rows
        const csvRows = data.map(row => {
            return headers.map(header => {
                const value = row[header];
                // Handle commas and quotes in values
                if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            }).join(',');
        });
        
        return [csvHeaders, ...csvRows].join('\n');
    }
    
    downloadCSV(csvContent, filename) {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            console.log(`CSV exported: ${filename}`);
        } else {
            alert('CSV export not supported in this browser');
        }
    }
}

// Initialize the app when page loads
console.log('🔥 DEBUG: Setting up DOMContentLoaded listener');

document.addEventListener('DOMContentLoaded', () => {
    console.log('🔥 DEBUG: DOMContentLoaded event fired, creating app');
    try {
        const app = new EnhancedPlacesOfWorshipApp();
        console.log('🔥 DEBUG: App created successfully:', app);
    } catch (error) {
        console.error('🔥 DEBUG: App creation failed:', error);
        // Emergency fallback - just hide loading
        const loadingEl = document.getElementById('loading');
        if (loadingEl) loadingEl.style.display = 'none';
    }
});

console.log('🔥 DEBUG: DOMContentLoaded listener set up');