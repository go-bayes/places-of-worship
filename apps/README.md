# Apps

Static, browser-facing applications served via GitHub Pages.

Structure:
- global/ : global map experience (MapLibre GL JS)
- regions/<iso2>/ : regional apps and data (example: regions/nz)
- shared/ : cross-app modules (region switcher, region resolve, shell CSS)
- workbench/ : TypeScript RA ingestion app (not deployed)
- guides/ : static RA and PI guides

The legacy `frontend/` and `src/` redirect shims were removed on 2026-08-14 after a seven-month grace period; the root `enhanced-places.html` shim followed on 2026-08-25; only the root `index.html` redirect to `apps/global/` remains.
