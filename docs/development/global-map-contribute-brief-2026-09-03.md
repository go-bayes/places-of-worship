# PR-H build brief — the evidence portal for every country, and Contribute from the shop front (2026-09-03)

Status: BUILT 2026-09-03 (late evening): PR-H1 as PR #78 (`feat/portal-every-country`), PR-H2 on `feat/contribute-everywhere` stacked on it; R-H4 ruled as recommended, VectorGrid accepted, "unvalidated" replaces "context dots", "religionmap.org" replaces "Religion Map" (JB, same evening). Earlier: RULED IN PART 2026-09-03 (evening). JB's rulings on the first draft: R-H1 every country gets the evidence portal, without assignments (no inert row); R-H2 the route names the country; R-H3 Contribute shares the data pill's zoom gate. JB added scope the same evening: the portal shows every place-of-worship point for any country; every country gets a review lane now, ahead of global RA help; and the country pages must carry the Contribute routes uniformly (PR #75 reached only the 24 pages whose config named a portal). One ruling open: R-H4, the signed-out revise click (section 6). Ordered ahead of the NZ hash manifest lane (JB 2026-09-03).

## 1. The problem

The shop front, religionmap.org, is the global map at `apps/global/`. Its Contribute pill (PR #75) offers only "Improve OpenStreetMap" and "About the project", because the portal and review routes are read from each page's `wordmarkLinks` and the global page has none. The popup's "Revise this place" link is suppressed for the same reason. Seventy-six of the hundred country pages have the same gap: their configs never named a portal, so their Contribute panels are one-route too.

Behind the pill, the portal is one shared page, `apps/regions/nz/verification.html` with `?country=xx`, whose registry (`COUNTRY_CONFIGS` in `verification-map.js`) knows 24 countries; 23 of them reach it through redirect stubs. The registry entry supplies the country's name, camera, census target years, assignment batch, and a per-country `dated_places.geojson` from which the amber context dots (the places you can revise) are drawn. Nineteen countries have that product. A country outside the registry falls back to New Zealand; a country without the product shows no dots at all, so there is nothing to revise.

So three things stand between a visitor to the shop front and a submission: the map does not name the country under the view, the portal does not know most countries, and the portal has no dots for most countries. The review portal (`review-portal.js`) has its own 24-entry label table and the same fallback.

## 2. What the global map already knows

The global map resolves the country under the view centre already: the data-maps pill fetches `apps/regions/_shared/data/region-bboxes.json` (100 countries with outline rings) after window load and resolves the centre through `window.RegionResolve.resolveAt` on every moveend and zoomend (`handoffNeighbourAt`). That resolver is the one implementation for every surface (tribunal-reviewed 2026-07). Contribute reuses it; no new geometry code.

The places vector tiles (`tiles.placemap.org/places`, zoom 6–18) carry `osm_id`, `osm_type`, `name`, `religion`, `denomination`, `country_code`, `confidence`, `start_date` (probed 2026-09-03 at Wellington z14). They are the world's dots and every dot names its country. That settles two questions: the portal can draw every country's places from the tiles, and a popup on the global map knows its place's country without any resolve.

What is missing is a country table for the world: name, camera, and outline for the ~100 countries without a page. Natural Earth 1:110m admin-0 (already used by `scripts/osm_pow_country_counts.py`, 177 countries with ISO codes) supplies it; the page manifest keeps precedence for the 100 countries with exact boundaries, including the small island states 1:110m omits (Tuvalu, Nauru, Niue, Tokelau, the Cook Islands all have pages).

## 3. What ships, in two PRs

Both ahead of the hash manifest lane. PR-H1 builds the destination; PR-H2 builds the routes to it. H1 first, since a link to a portal that opens as New Zealand for a Fijian church is worse than no link.

### PR-H1: the evidence and review portal for every country (portal, no Convex change)

1. **A world country registry.** `scripts/build_country_registry.py` writes `apps/shared/data/country-registry.json`: for every country in the page manifest and in Natural Earth 1:110m, `code`, `name`, `centre`, `zoom` (from the extent), `bbox`, and `page` (true where a country page exists). The page manifest's name and extent win where both exist. Stable output, committed, rebuilt when a country page launches.
2. **Any country opens the portal.** `?country=fj` resolves through the hand-tuned `COUNTRY_CONFIGS` first, then the registry, which yields a generated config: name, camera, `targetYears: []`, no `datedPlaces`, no assignment batch, rapid current entry and nomination entry on. An unknown code opens a neutral world view rather than New Zealand. Every use of `targetYears` gains a no-census-years branch: the assignment copy names none, the census-year derivations skip (nothing to derive, nothing lost: the periods and the chain still record and the derivations run the day a census year is added to the registry), the export writes no year columns. The review portal reads the same registry and drops its private label table. The path convention (`/regions/xx/verification.html`) and the 23 stubs keep working unchanged.
3. **Every place-of-worship point, in every country.** A tile-backed context-dot layer: Leaflet.VectorGrid (protobuf, pinned 1.3.0 from unpkg beside Leaflet itself) over `tiles.placemap.org/places`, amber discs in the PR-G treatment, visible from the portal's working zooms, click opening the same context-dot popup and revise card as the geojson dots (the tile feature carries `osm_id`, `osm_type`, `name`; `country_code` is checked against the portal's country so a border dot in the neighbour is offered with its own country named). Rule: a country with a dated product keeps the geojson layer (it carries `start_year` and `end_year`, which the period points mode needs); a country without one draws from the tiles, and the period mode control reads "no dated product for this country yet". No dot is drawn twice.
4. **The signed-out revise click** per R-H4 (section 6).
5. **Stamps** on `verification.html` and `review.html` and their scripts; tests (section 5); guide and changelog.

### PR-H2: Contribute from the shop front and every country page (front end, no Convex change)

1. **Routes synthesised from the country, not from page config.** On a country page, when `wordmarkLinks` names no portal, `region-map.js` builds the routes from `RC.countryCode`: `${REGIONS_BASE}nz/verification.html?country=xx` and `…/review.html?country=xx`. All 100 country pages gain the two routes at once, with no page config edited, which is the module's stated contract ("every behaviour lives in the shared module and keys on this config"). This is the "template fix" for this feature: the feature leaves the per-page templates entirely. The wider question, whether the 100 hand-written `index.html` configs should be generated from a template, is a separate lane (section 7).
2. **Routes resolved when the panel opens, on the global map.** The second route is built from the country under the centre: page manifest first, then a world outline manifest (`apps/shared/data/world-outlines.json`, Natural Earth 1:110m rings in the region-bboxes format, fetched once after the page manifest, same resolver). Label "Submit evidence to Religion Map · Fiji" (R-H2), "Review evidence" beneath it. Below the offer zoom or over open water: the row reads "Zoom to a country to submit evidence" (R-H3, the pill's `HANDOFF_MIN_ZOOM`). The panel renders on open only; a country change while it is open takes effect on the next open.
3. **"Revise this place" in the global map's popups**, targeting the portal for the dot's own `country_code`, with the same parameters as the country pages' links. No resolve needed; a dot without a country code falls back to the point resolve. Every dot in the world gets the link.
4. **Stamp** on `region-map.js` in all 101 pages; tests; guide and changelog.

## 4. Files

PR-H1: `scripts/build_country_registry.py` (new), `apps/shared/data/country-registry.json` (new), `apps/regions/nz/verification.html` (VectorGrid script tag, stamps), `apps/regions/nz/js/verification-map.js` (registry fallback, no-census-years branches, tile dot layer, R-H4), `apps/regions/nz/js/review-portal.js`, `apps/regions/nz/review.html`, tests, `apps/guides/ra.html`, `CHANGELOG.md`.

PR-H2: `scripts/build_world_outlines.py` (new, sharing `build_region_bboxes.py`'s ring simplifier), `apps/shared/data/world-outlines.json` (new), `apps/regions/_shared/region-map.js`, `apps/shared/map-shell.css`, `apps/global/index.html` and `apps/regions/*/index.html` (stamp), tests, `apps/guides/ra.html`, `CHANGELOG.md`.

## 5. Tests

- Registry builder: unittest over the committed file: `nz` and `tv` present with `page: true`, `fj` present with `page: false`, no duplicate codes, every centre inside its bbox.
- Portal country resolution: extract `countryConfigFor(code, configs, registry)` as a pure function; cases: tuned country, registry country, unknown code, empty code. In the style of `deep-link-context.test.cjs`.
- No-census-years branches: a DOM test in the style of `portal-walkthrough-dom.test.cjs` opening the rapid form for a registry country and asserting no census-year row, no year columns in the export header.
- Contribute route decision: `contributeRoutesFor(region, zoom, routesConfig)` pure; cases: config portal wins; page country at offer zoom; world-outline country at offer zoom; below zoom; null region.
- Browser: global map at Wellington, Port Vila, Suva, open water; a popup in each of NZ and FJ; the portal opened as `?country=fj` showing tile dots and a revise card; the review portal as `?country=fj`. Screenshots into `.private/screens-<date>/`.

## 6. R-H4, the signed-out revise click (open)

Today a visitor who opens the portal, signed out, sees the amber dots and can press "Revise this place"; the card opens in the gated sidebar and nothing can be entered (the body carries `portal-signed-out` and the mode is null). The deep link from the public map already handles its own case: `?revise=1` waits as `pendingDeepLink`, the sign-in card says "You followed a link to revise X. Sign in and it opens here", and `applyPendingDeepLink` opens the card after sign-in.

Recommendation: make the in-portal click the same path. Signed out, the popup's primary button reads "Sign in to revise this place"; pressing it stores the place as the pending deep link, closes the popup, and focuses the sign-in card, which names the place as it does for the link. After sign-in the card opens. The popup's other rows (Street View, Open OSM, Copy coords, OSM history) stay available to everyone: the record is public and looking is free. One mechanism serves the link and the click, so there is one thing to test and one sentence in the guide. Alternative considered: hide the dots from signed-out visitors. Rejected: the dots are the shop front's promise made concrete, and a visitor deciding whether to join should see what they would be revising.

## 7. What it does not do

- No templating of the 100 country `index.html` files. Proposed as its own lane after H2: a generator from per-country config blocks, verified against the pages it replaces by a drift report in the manner of `apps/regions/_shared/DRIFT-REPORT.md`. The Contribute routes no longer depend on it.
- No per-country data products: the tiles are the dot source for a country until its dated product ships; the ohsome runner lane (next after this) produces those.
- No Convex change: `country_code` is a free string on every table already, and assignments are simply absent for a registry country.
- No world coverage below Natural Earth 1:110m: a territory absent from both the page manifest and 1:110m (a few small dependencies) resolves as open water on the global map; its dots still carry `country_code`, so the popup link works there regardless.
