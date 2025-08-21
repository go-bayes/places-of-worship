# Deploy to GitHub Pages

## Quick Deployment Steps

### 1. Commit Current Changes
```bash
git add .
git commit -m "Add global places of worship proof of concept

🗺️ Global interactive mapping system
- FastAPI backend with 161K+ locations  
- Proven Leaflet.glify WebGL rendering
- Compatible with religion repository frontend
- Modular architecture for future 2M+ places

🚀 Generated with Claude Code"

git push origin main
```

### 2. Enable GitHub Pages
1. Go to **Settings** → **Pages** in your GitHub repository
2. Source: **Deploy from a branch**
3. Branch: **main** 
4. Folder: **/ (root)**
5. Click **Save**

### 3. Access Your Site
- **Main site**: `https://go-bayes.github.io/places-of-worship/`
- **Global demo**: `https://go-bayes.github.io/places-of-worship/global-demo.html`
- **Interactive map**: `https://go-bayes.github.io/places-of-worship/frontend/global-places.html`

## What Gets Deployed

### ✅ Static Files (Will Work)
- `global-demo.html` - Landing page with overview
- `frontend/global-places.html` - Interactive map (uses external API)
- `index.html` - Your original NZ places map
- All CSS, JS, and data files

### ❌ API Backend (Won't Work on GitHub Pages)
- `api/quick_api.py` - Requires Python server
- Local API endpoints won't be accessible

## API Options for Production

### Option 1: Use Existing API (Immediate)
The map now points to: `https://api-proxy.auckland-cer.cloud.edu.au/OSM_API_v2`
- **Pros**: Works immediately, proven reliable
- **Cons**: Uses existing data, not your custom global dataset

### Option 2: Deploy API Separately (Future)
Deploy FastAPI backend to:
- **Railway**: `railway.app` (easy Python deployment)
- **Render**: `render.com` (free tier available)  
- **Heroku**: Classic choice for APIs
- **University servers**: If available

### Option 3: Static Data Approach (Hybrid)
Generate static GeoJSON files for GitHub Pages:
```javascript
// Instead of API calls, load static files
fetch('./data/global-places.geojson')
```

## File Structure for GitHub Pages
```
places-of-worship/
├── index.html              # Original NZ map
├── global-demo.html         # New global overview  
├── frontend/
│   ├── global-places.html   # Global interactive map
│   └── style.css           # Styling
├── data/                   # Static data files
├── docs/                   # Documentation
└── README.md              # Project description
```

## Performance on GitHub Pages
- **Static files**: Served via CDN, very fast
- **Interactive map**: Proven to handle 100K+ points
- **WebGL rendering**: Client-side, no server needed
- **External API**: Reliable university infrastructure

## Next Steps
1. **Test locally**: Verify `frontend/global-places.html` works
2. **Commit & push**: Deploy to GitHub Pages
3. **Share URL**: `https://go-bayes.github.io/places-of-worship/global-demo.html`
4. **Plan API**: Decide on production API deployment strategy