// source-level checks for the tiles v2 client switch (build 20260722): the
// shared runtime reads the slim overview sample and the places-v2 tier (z6-7
// sampled), the counts panel says "places shown" below zoom 8, the RA and review portals read per-country
// ra-dots archives, and every page loading a changed script carries the
// bumped cache-busting query. browser behaviour is checked separately in
// the pull request; these checks stop the wiring regressing.
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
assert.match(runtime, /places: "https:\/\/tiles\.placemap\.org\/places-v2-20260722-grid\/\{z\}\/\{x\}\/\{y\}"/);
assert.doesNotMatch(runtime, /tiles\.placemap\.org\/places\/\{z\}/);
assert.doesNotMatch(runtime, /tiles\.placemap\.org\/places-v2-20260722\/\{z\}/, "the fraction-sampled places tier is retired");
const placesSource = runtime.slice(runtime.indexOf("map.addSource(SOURCES.places"), runtime.indexOf("map.addLayer({\n    id: LAYERS.places"));
assert.match(placesSource, /tiles: \[CONFIG\.tiles\.places\],\s+minzoom: 6,\s+maxzoom: 18,/);

// the RA layers read the versioned grid places tier (immutable), from zoom 8 for a country with a set
assert.match(unvalidated, /const PLACES_TILE_URL = `https:\/\/tiles\.placemap\.org\/places-v2-\$\{TILES_VERSION\}-grid\/\{z\}\/\{x\}\/\{y\}`;/);
assert.match(unvalidated, /const PLACES_MIN_ZOOM = 8;/);

// shared runtime: versioned grid-thinned overview, source maxzoom 5, layer still to 6
assert.match(runtime, /overview: "https:\/\/tiles\.placemap\.org\/places-overview-v2-20260722-grid\/\{z\}\/\{x\}\/\{y\}"/);
assert.doesNotMatch(runtime, /tiles\.placemap\.org\/places-overview\//);
assert.doesNotMatch(runtime, /tiles\.placemap\.org\/places-overview-v2-20260722\/\{z\}/, "the fraction-sampled overview is retired");
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
assert.match(verification, /createLayers\(L, \{ countryCode: ownIso === "ZZ" \? "" : ownIso \}\)/);
assert.match(review, /createLayers\(L, \{ countryCode: tileIso \}\)/);
assert.match(review, /registry\?\.iso2 \|\| options\.countryCode/);
assert.doesNotMatch(unvalidated, /overviewKeep/);

// every html page that loads a changed script carries the bumped query
// one stamp per script: a script's stamp moves only when that script changes
const stamps = {
    "region-map.js": "20261015e", // street view resizes from its corner, no expand button
    "datamaps-switcher.js": "20261013a", // switcher rows prerender; warming waits for activation
    "unvalidated-places.js": "20261013b", // versioned grid places url; us, de and it use the grid tier from zoom 6
    "verification-map.js": "20261019a", // two kinds of move on a period card, successor field (definition 0.1.6)
    "occupancy-contract.js": "20261019a", // relocation rules follow definition 0.1.6
    "occupancy-review.js": "20261019a", // move wording and successor in the reviewer's period summary
    "task-presentation.js": "20261015c", // decided-status and reopen-flag helpers
    "convex-task-client.js": "20261015d", // revertReopen client method
    "review-portal.js": "20261019a", // identity bases of definition 0.1.6
    "review-map.js": "20261013a", // tap on a grid-thinned fallback dot zooms in
};
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
            assert.equal(match[1], stamps[name],`${path.relative(apps, page)}: ${name} is ?v=${match[1]}`);
            checked += 1;
        }
    });
});
assert.ok(checked >= 100, `only ${checked} script tags checked`);

console.log(`tiles-v2-client: ${checked} script tags and the wiring checked`);
