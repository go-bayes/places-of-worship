# GitHub Pages Deployment

## Quick GitHub Pages Setup

GitHub Pages can host the frontend, but since it only serves static files, we need to modify the approach slightly. Here are your options:

### Option 1: Static GitHub Pages (Easiest)

For a demo version using your original static files:

1. **Create a `gh-pages` branch:**
   ```bash
   git checkout -b gh-pages
   ```

2. **Copy your original religion repo files:**
   ```bash
   # Copy from your religion repo
   cp ../religion/religion.json frontend/src/
   cp ../religion/sa2.geojson frontend/src/
   cp ../religion/style.css frontend/src/religion-original.css
   ```

3. **Create a simple static version:**
   ```bash
   # Create static index in root for GitHub Pages
   cp frontend/src/* .
   ```

4. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "GitHub Pages static demo"
   git push origin gh-pages
   ```

5. **Enable GitHub Pages:**
   - Go to your repository settings
   - Scroll to "Pages"
   - Select "Deploy from branch: gh-pages"
   - Your site will be at: `https://go-bayes.github.io/places-of-worship/`

### Option 2: GitHub Pages with API Simulation

Create a version that simulates the API using static files but demonstrates the enhanced interface:

1. **Create static API simulation:**