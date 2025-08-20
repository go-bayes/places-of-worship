/**
 * Denomination Mapping Utility
 * Maps specific OSM denominations to major religious categories
 */

class DenominationMapper {
    constructor() {
        this.majorCategories = {
            'Christian': {
                color: '#e74c3c',
                denominations: [
                    'anglican', 'catholic', 'baptist', 'presbyterian', 'methodist',
                    'orthodox', 'evangelical', 'pentecostal', 'lutheran', 'reformed',
                    'salvation_army', 'brethren', 'congregational', 'apostolic',
                    'assemblies_of_god', 'church_of_christ', 'christian_science',
                    'coptic_orthodox', 'greek_orthodox', 'indian_orthodox',
                    'romanian_orthodox', 'russian_orthodox', 'serbian_orthodox',
                    'seventh_day_adventist', 'southern_baptist', 'reformed_baptist',
                    'independent_baptist', 'exclusive_brethren', 'plymouth_brethren',
                    'nazarene', 'wesleyan', 'quaker', 'unitarian', 'united church',
                    'vineyard', 'vibrant', 'marist', 'liberal_catholic',
                    'christ_scientist', 'charismatic', 'nondenominational',
                    'interdenominational', 'evangelical_non-denominational',
                    'neocharismatic_evangelical', 'protestant', 'anglo_catholic',
                    'c3', 'alliance', 'Anglican', 'Catholic', 'Baptist', 
                    'Presbyterian', 'Methodist', 'Orthodox', 'Evangelical',
                    'Reformed', 'Salvation Army', 'Brethren', 'Christian (Other)',
                    'Latter-day Saints', 'Jehovah\'s Witnesses', 'Quaker'
                ]
            },
            'Islam': {
                color: '#27ae60',
                denominations: [
                    'muslim', 'islam', 'sunni', 'shia', 'ahmadiyya', 'Islam'
                ]
            },
            'Buddhism': {
                color: '#f39c12',
                denominations: [
                    'buddhist', 'buddhism', 'theravada', 'mahayana', 'tibetan',
                    'gelug', 'rinzai', 'soka_gakkai', 'Buddhism'
                ]
            },
            'Judaism': {
                color: '#9b59b6',
                denominations: [
                    'jewish', 'judaism', 'Judaism'
                ]
            },
            'Hinduism': {
                color: '#e67e22',
                denominations: [
                    'hindu', 'hinduism', 'vaishnavism', 'swaminarayan', 'Hinduism'
                ]
            },
            'Sikhism': {
                color: '#1abc9c',
                denominations: [
                    'sikh', 'sikhism', 'Sikhism'
                ]
            },
            'Other Religions': {
                color: '#8e44ad',
                denominations: [
                    'bahai', 'ratana', 'masonic', 'iglesia_ni_cristo',
                    'jehovahs_witness', 'mormon', 'latter-day_saints',
                    'Baháʼí Faith', 'South_Indian_(_not_Buddhist_)'
                ]
            },
            'Unknown': {
                color: '#95a5a6',
                denominations: [
                    'unknown', 'Unknown'
                ]
            }
        };
        
        // Create reverse mapping for quick lookups
        this.denominationToCategory = {};
        Object.keys(this.majorCategories).forEach(category => {
            this.majorCategories[category].denominations.forEach(denom => {
                this.denominationToCategory[denom.toLowerCase()] = category;
            });
        });
    }
    
    /**
     * Get major category for a denomination
     */
    getMajorCategory(denomination) {
        if (!denomination) return 'Unknown';
        
        const lowerDenom = denomination.toLowerCase();
        
        // Handle compound denominations (e.g., "anglican;methodist")
        if (lowerDenom.includes(';') || lowerDenom.includes(',')) {
            const parts = lowerDenom.split(/[;,]/);
            for (const part of parts) {
                const trimmed = part.trim();
                if (this.denominationToCategory[trimmed]) {
                    return this.denominationToCategory[trimmed];
                }
            }
        }
        
        // Handle special cases with underscores or spaces
        const normalized = lowerDenom.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
        
        // Direct lookup
        if (this.denominationToCategory[lowerDenom]) {
            return this.denominationToCategory[lowerDenom];
        }
        
        // Partial matching for complex denominations
        for (const [category, data] of Object.entries(this.majorCategories)) {
            for (const denom of data.denominations) {
                if (lowerDenom.includes(denom.toLowerCase()) || 
                    normalized.includes(denom.toLowerCase())) {
                    return category;
                }
            }
        }
        
        return 'Unknown';
    }
    
    /**
     * Get color for a major category
     */
    getCategoryColor(category) {
        return this.majorCategories[category]?.color || '#95a5a6';
    }
    
    /**
     * Get all major categories
     */
    getMajorCategories() {
        return Object.keys(this.majorCategories);
    }
    
    /**
     * Get denomination count by major category
     */
    categorizeFeatures(features) {
        const categories = {};
        const denominationCounts = {};
        
        // Initialize counts
        Object.keys(this.majorCategories).forEach(cat => {
            categories[cat] = 0;
        });
        
        features.forEach(feature => {
            const denom = feature.properties.denomination;
            const category = this.getMajorCategory(denom);
            
            categories[category] = (categories[category] || 0) + 1;
            denominationCounts[denom] = (denominationCounts[denom] || 0) + 1;
        });
        
        return {
            categories,
            denominations: denominationCounts
        };
    }
    
    /**
     * Get denomination color with category fallback
     */
    getDenominationColor(denomination, denominationColors) {
        // Use specific denomination color if available
        if (denominationColors[denomination]) {
            return denominationColors[denomination];
        }
        
        // Fall back to category color
        const category = this.getMajorCategory(denomination);
        return this.getCategoryColor(category);
    }
}