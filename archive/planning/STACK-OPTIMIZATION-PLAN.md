# Stack Optimization Plan: R + Pure Static
*Created: 2025-08-27*
*Status: Ready for implementation*

**THIS PLAN IS NO LONGER RELEVANT**

## Current Assessment
Your project is already 90% optimal for academic research. You're using R for data processing (perfect) and have a clean static frontend (ideal). The Python FastAPI is the only unnecessary component.


## Final Stack Architecture
```
R Scripts           →  JSON Files      →  Static Frontend
├── Stats NZ APIs   →  ├── demographics.json   →  ├── HTML/CSS/JS
├── Data cleaning   →  ├── places.json        →  ├── Leaflet maps  
├── Calculations    →  ├── boundaries.json    →  ├── Plotly charts
└── Export JSON     →  └── metadata.json     →  └── GitHub Pages
```

## Current
existing R scripts are 

- `fetch_age_gender_nz.R` - Stats NZ API integration
- `fetch_employment_income_nz.R` - Economic indicators
- `fetch_ethnicity_density_nz.R` - Cultural demographics
- `fetch_ta_religion_data.R` - Religious affiliation data
- `convert_ta_data_format.R` - Data format standardization


