// source-level checks for the tiles client (the openstreetmap edition of
// 2026-09-01): the shared runtime reads the grid-thinned overview and the
// places tier (z6-7 thinned), the counts panel says "places shown" below
// zoom 8, the possible or former archive is a separate source drawn only in
// its points mode, the RA and review portals read per-country ra-dots
// archives, and every page loading a changed script carries the bumped
// cache-busting query. browser behaviour is checked separately in the pull
// request; these checks stop the wiring regressing.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const apps = path.join(__dirname, "..", "..");
const read = (...parts) => fs.readFileSync(path.join(apps, ...parts), "utf8");

const runtime = read("regions", "_shared", "region-map.js");
const verification = read("regions", "nz", "js", "verification-map.js");
const review = read("regions", "nz", "js", "review-map.js");
const unvalidated = read("regions", "nz", "js", "unvalidated-places.js");

// shared runtime: versioned places tier (z6-7 grid-thinned, z8-18 identical to
// the live tier), source minzoom still 6 so nothing below z6 is requested
assert.match(runtime, /places: "https:\/\/tiles\.placemap\.org\/places-v2-20260901-grid\/\{z\}\/\{x\}\/\{y\}"/);
assert.doesNotMatch(runtime, /tiles\.placemap\.org\/places\/\{z\}/);
assert.doesNotMatch(runtime, /20260722/, "no july archive is read");
const placesSource = runtime.slice(runtime.indexOf("map.addSource(SOURCES.places"), runtime.indexOf("map.addLayer({\n    id: LAYERS.places"));
assert.match(placesSource, /tiles: \[CONFIG\.tiles\.places\],\s+minzoom: 6,\s+maxzoom: 18,/);

// the RA layers read the versioned grid places tier (immutable), from zoom 8 for a country with a set
assert.match(unvalidated, /const PLACES_TILE_URL = `https:\/\/tiles\.placemap\.org\/places-v2-\$\{TILES_VERSION\}-grid\/\{z\}\/\{x\}\/\{y\}`;/);
assert.match(unvalidated, /const PLACES_MIN_ZOOM = 8;/);

// shared runtime: versioned grid-thinned overview, source maxzoom 5, layer still to 6
assert.match(runtime, /overview: "https:\/\/tiles\.placemap\.org\/places-overview-v2-20260901-grid\/\{z\}\/\{x\}\/\{y\}"/);
assert.doesNotMatch(runtime, /tiles\.placemap\.org\/places-overview\//);
assert.doesNotMatch(unvalidated, /20260722/, "the portals read no july archive");

// the possible or former archive: its own source and layer name, from zoom
// 8, added only by the mode, and kept out of every count and the portals
assert.match(runtime, /possible: "https:\/\/tiles\.placemap\.org\/places-v2-20260901-possible\/\{z\}\/\{x\}\/\{y\}"/);
assert.match(runtime, /possible: "places_possible",/);
const possibleSource = runtime.slice(runtime.indexOf("map.addSource(SOURCES.possible"), runtime.indexOf("// beneath the place dots, whether"));
assert.match(possibleSource, /tiles: \[CONFIG\.tiles\.possible\],\s+minzoom: POSSIBLE_MIN_ZOOM,\s+maxzoom: 18,/);
assert.match(runtime, /const POSSIBLE_MIN_ZOOM = 8;/);
// the counts query one layer, the overview or the places, never the rings
assert.match(runtime, /const preferredLayer = zoom < 6 \? LAYERS\.overview : LAYERS\.places;\n\s*if \(!map\.getLayer\(preferredLayer\)\) return;\n\s*const features = map\.queryRenderedFeatures\(\{ layers: \[preferredLayer\] \}\);/);
assert.doesNotMatch(verification, /places_possible|-possible\//, "the ra portal never requests the rings");
assert.doesNotMatch(review, /places_possible|-possible\//, "the review portal never requests the rings");
// a grid-thinned dot counts the places it stands for, and a tap on one zooms in
assert.match(runtime, /const places = Number\.isFinite\(n\) && n > 1 \? n : 1;/);
assert.match(runtime, /function isRepresentativeDot\(props\)/);
assert.match(runtime, /if \(isRepresentativeDot\(props\)\) \{\n\s*zoomToRepresentative\(coords\);\n\s*return;/);
const source = runtime.slice(runtime.indexOf("map.addSource(SOURCES.overview"), runtime.indexOf("map.addLayer({\n    id: LAYERS.overview"));
assert.match(source, /maxzoom: 5,/);
const layer = runtime.slice(runtime.indexOf("id: LAYERS.overview,"), runtime.indexOf("if (IS_MOBILE && !overviewMobileHandlerAttached)"));
assert.match(layer, /maxzoom: 6,/);
// the module keeps no country-conditional logic for the tier
assert.doesNotMatch(runtime, /ra-dots/);

// the counts line: "places shown" below zoom 8 (the overview below 6, the
// places tier's sample at z6-7), "total" from 8; the layer still switches at 6
assert.match(runtime, /function renderCounts\(counts, sampled = false\)/);
assert.match(runtime, /\$\{sampled \? "Places shown" : "Total"\}: \$\{total\.toLocaleString\(\)\}/);
assert.match(runtime, /const SAMPLED_BELOW_ZOOM = 8;/);
assert.match(runtime, /placesCountsSampled\(zoom, drawnPlacesTileZooms\(\)\)/);
assert.match(runtime, /renderCounts\(counts, sampled\);/);
assert.doesNotMatch(runtime, /renderCounts\(counts, zoom < SAMPLED_BELOW_ZOOM\)/);
assert.doesNotMatch(runtime, /renderCounts\(counts, zoom < 6\)/);
assert.match(runtime, /const preferredLayer = zoom < 6 \? LAYERS\.overview : LAYERS\.places;/);

// portals: the country is handed to the module; the filter is gone
assert.doesNotMatch(verification, /overviewKeep/);
// (with the light streets edge test beside the country, 2026-11-20)
assert.match(verification, /createLayers\(L, \{\s*countryCode: ownIso === "ZZ" \? "" : ownIso,\s*edged: \(\) => this\.markEdgesWanted\(\),\s*\}\)/);
assert.match(review, /createLayers\(L, \{ countryCode: tileIso, edged: \(\) => places\.edgeWanted\(map\) \}\)/);
assert.match(review, /registry\?\.iso2 \|\| options\.countryCode/);
assert.doesNotMatch(unvalidated, /overviewKeep/);

const raGuide = read("guides", "ra.html");
assert.match(raGuide, /At zooms 0–6, a dot can represent several nearby places and tapping it zooms in\./);
assert.match(raGuide, /At zoom 7,[^.]+opens the popup for the OpenStreetMap record/);
assert.match(raGuide, /From zoom 8, every place has its own dot and popup\./);
assert.match(raGuide, /a popup shows the record’s name when OpenStreetMap supplies one/);
assert.match(runtime, /place dots show OpenStreetMap places as at 1 September 2026/);
assert.match(runtime, /the OpenStreetMap snapshot as at 1 September 2026 is hidden/);
assert.doesNotMatch(runtime, /census-legend-note[^\n]*today's/);

// every html page that loads a changed script carries the bumped query
// scripts with later changes carry their own stamps
const stamps = {
    "region-map.js": "20261124e", // accept only the expected override rule and count
    "datamaps-switcher.js": "20261013a", // switcher rows prerender; warming waits for activation
    "unvalidated-places.js": "20261124f", // september archives; theme edge redraw at the rounded zoom
    "verification-map.js": "20261124f", // typed osm hand-off; one rebuild of the fallback dots on a basemap switch
    "occupancy-contract.js": "20261019a", // relocation rules follow definition 0.1.6
    "occupancy-review.js": "20261019a", // move wording and successor in the reviewer's period summary
    "task-presentation.js": "20261015c", // decided-status and reopen-flag helpers
    "convex-task-client.js": "20261103a", // the sign-in button takes a width from its caller
    "review-portal.js": "20261123c", // report unresolved country codes
    "review-map.js": "20261124f", // osm type and id from a clicked dot; theme control and dot edges on light streets
};
// stylesheets that changed with a script, checked the same way
stamps["maplibre-flat.css"] = "20261123c"; // the key's possible-or-former row
const scripts = Object.keys(stamps);
const pages = [];
(function walk(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith(".html")) pages.push(full);
    });
})(apps);
let checked = 0;
pages.forEach(page => {
    const html = fs.readFileSync(page, "utf8");
    scripts.forEach(name => {
        const pattern = new RegExp(`${name.replace(".", "\\.")}\\?v=(\\w+)`, "g");
        for (const match of html.matchAll(pattern)) {
            assert.equal(match[1], stamps[name], `${path.relative(apps, page)}: ${name} is ?v=${match[1]}`);
            checked += 1;
        }
    });
});
assert.ok(checked >= 100, `only ${checked} script tags checked`);

console.log(`tiles-v2-client: ${checked} script tags and the wiring checked`);
