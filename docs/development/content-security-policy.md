# Content-Security-Policy

Status: in force from 2026-10-15 on every served HTML page except the workbench development entry.

## What the policy does

Each page carries a `<meta http-equiv="Content-Security-Policy">` line directly after its `<meta charset>` line. GitHub Pages cannot send response headers, so the policy travels in the page. The policy names the hosts a page may load scripts, styles, images, fonts, frames and workers from, and the hosts it may fetch from. Scripts run only from the site itself, from the pinned MapLibre release on unpkg, from Google sign-in and from the Google Maps API; inline scripts run only when the policy carries their SHA-256 hash. Injected markup cannot run script: an inline `<script>`, an `onerror=` handler or a `javascript:` link is refused.

The MapLibre tags on unpkg carry subresource-integrity hashes (`integrity`, `crossorigin="anonymous"`), checked against the npm tarball of `maplibre-gl@3.6.1`. A changed file on the CDN is refused and the map does not load.

Styles keep `'unsafe-inline'`, because the runtime builds `style=` attributes into HTML strings and several pages carry `<style>` blocks.

## Maintaining it

`scripts/stamp_csp.mjs` writes the policy into every page; `--check` reports stale pages and runs in CI.

- After editing an inline `<script>` in any page (a `REGION_CONFIG`, an overview config, a redirect stub), run `node scripts/stamp_csp.mjs`. A stale hash blocks the script and the page stops working; CI fails until the stamp is rerun.
- A new page needs only a `<meta charset>` line; the stamp adds the rest.
- A new external host (a tile server, an API, a script) is added to `SOURCES` in the script, after which the stamp rewrites every page. Without it the browser refuses the request.
- A MapLibre upgrade changes the URL prefix and both `SRI` hashes in the script. Take the hashes from the files inside the npm tarball, not from the CDN alone.

## Limits of the meta form

A `<meta>` policy cannot set `frame-ancestors`, `report-uri` or `report-to`, and it has no report-only mode. When the site moves to Cloudflare Pages (see `cloudflare-pages-hosting.md`), the same policy can move into `_headers` with `frame-ancestors 'none'` added, and the page meta can go.

## Verification of 2026-10-15

Headless Chromium served the working tree under the production origin, so the referrer-locked keys and the sign-in client behaved as in production:

- every page loaded with no policy violation and the same rendered map features as the unstamped pages;
- an injected inline script and an injected `onerror` handler were refused;
- all nine basemaps, Photon and Nominatim search, Street View, the Google sign-in button on the portal and review pages, and the portal's Leaflet tiles worked.
