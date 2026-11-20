# Apps

GitHub Pages serves the static, browser-facing applications at `religionmap.org`. Cloudflare Pages serves the same repository at `places-of-worship.pages.dev` and its preview subdomains. The cutover of `religionmap.org` to Cloudflare Pages is planned. See the [hosting guide](../docs/development/cloudflare-pages-hosting.md).

Structure:
- global/ : global map experience (MapLibre GL JS)
- regions/<iso2>/ : regional apps and data (example: regions/nz)
- shared/ : cross-app modules (region switcher, region resolve, shell CSS)
- workbench/ : TypeScript RA ingestion app (not deployed)
- guides/ : static RA and PI guides

The legacy `frontend/` and `src/` redirect shims were removed on 2026-08-14 after a seven-month grace period; the root `enhanced-places.html` shim followed on 2026-08-25; only the root `index.html` redirect to `apps/global/` remains.
