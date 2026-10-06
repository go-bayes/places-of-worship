// startup contract for the public maps (perf lane, 2026-10-06): the shared
// runtime requests a polygon tileset only where the page config names one, the
// border-handoff manifest loads after the map has loaded and the browser is
// idle, and the data-maps switcher warms the home country only after the
// overview source has loaded. these are source-level checks; the browser
// checks live in the pull request
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const appsDir = path.join(__dirname, "..", "..");
const read = (...parts) => fs.readFileSync(path.join(appsDir, ...parts), "utf8");
const runtime = read("regions", "_shared", "region-map.js");
const switcher = read("shared", "datamaps-switcher.js");
let checks = 0;
const ok = (value, message) => { assert.ok(value, message); checks += 1; };

// 1. polygons are gated on REGION_CONFIG.polygonsTileset, never on country
ok(!/nz-polygons/.test(runtime), "the shared runtime names no tileset");
ok(/polygons: RC\.polygonsTileset\s*\n?\s*\? `https:\/\/tiles\.placemap\.org\/\$\{RC\.polygonsTileset\}\/\{z\}\/\{x\}\/\{y\}`\s*\n?\s*: null/.test(runtime),
  "the polygon tile url derives from the config key");
ok(/function addPolygonsLayer\(\) \{\n[^\n]*\n\s*if \(!CONFIG\.tiles\.polygons\) return;\n\s*map\.addSource\(SOURCES\.polygons/.test(runtime),
  "addPolygonsLayer returns before adding the source when no tileset is configured");
ok(!/countryCode\s*(===|==|!==)\s*["']nz["']/i.test(runtime), "no country-conditional branch for the polygons");

const pagesWithTileset = [];
for (const entry of fs.readdirSync(path.join(appsDir, "regions"), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const page = path.join(appsDir, "regions", entry.name, "index.html");
  if (fs.existsSync(page) && /polygonsTileset/.test(fs.readFileSync(page, "utf8"))) pagesWithTileset.push(entry.name);
}
assert.deepEqual(pagesWithTileset, ["nz"], "only the NZ country page names the polygon tileset");
checks += 1;
ok(/polygonsTileset: "nz-polygons"/.test(read("regions", "nz", "index.html")), "NZ page names its tileset");
ok(/polygonsTileset: "nz-polygons"/.test(read("global", "index.html")), "the world map keeps the NZ outlines it always drew");

// every layer lookup that could meet an absent polygon layer is presence-guarded
ok(/CENSUS_POINT_ANCHORS\.includes\(layers\[i\]\.id\)/.test(runtime), "the census anchor scan matches ids present in the style");

// 2. the manifest waits for map load and an idle slot, and revalidates
const arm = runtime.slice(runtime.indexOf("const armOffers = () => {"));
ok(/fetch\(`\$\{REGIONS_BASE\}_shared\/data\/region-bboxes\.json`, HANDOFF_HOME \? \{ cache: "no-cache" \} : undefined\)/.test(arm),
  "the manifest fetch keeps no-cache on country pages");
ok(/requestIdleCallback\(armOffers/.test(arm) && /setTimeout\(armOffers/.test(arm), "idle callback with a timeout fallback");
ok(/map\.once\("load", armOffersWhenIdle\)/.test(arm), "arming waits for map load");
ok(!/^\s*armOffers\(\);/m.test(arm) && !/addEventListener\("load", armOffers/.test(arm), "no direct or window-load arming remains");
// late arrival: each consumer of the manifest copes with null
ok(/if \(!handoffRegions\) return null;/.test(runtime), "neighbour lookup tolerates a missing manifest");
ok(/function updateBorderHandoff\(\) \{\n\s*if \(!handoffRegions\) return;/.test(runtime), "handoff refresh tolerates a missing manifest");
ok(/if \(!handoffRegions \|\| !event \|\| !event\.coords\) return;/.test(runtime), "geolocate abroad check tolerates a missing manifest");
ok(/handoffRegions \? handoffRegions\.find/.test(runtime), "contribute decision tolerates a missing manifest");
ok(/if \(handoffRegions\) setOffer\(/.test(runtime), "reset tolerates a missing manifest");
ok(/\n\s+updateBorderHandoff\(\);\n\s+\}\)\n\s+\.catch/.test(runtime), "arrival re-derives the pill");

// 3. the switcher's home warm waits for the overview source and honours saveData
ok(/document\.addEventListener\("datamap:overview-loaded", markPrefetchReady/.test(switcher), "global map warms after the overview loads");
ok(!/addEventListener\("load", markPrefetchReady/.test(switcher), "no window-load gate remains");
ok(/!connection\.saveData/.test(switcher) && /function warmHome\(\) \{\n\s*if \(currentCode \|\| homeWarmed \|\| !connectionAllowsPrefetch\(\)\) return;/.test(switcher),
  "the home warm is skipped under saveData");
ok(/__DATAMAP_OVERVIEW_LOADED__/.test(runtime) && /datamap:overview-loaded/.test(runtime), "the runtime announces the overview load");

console.log(`region-map startup: ${checks} checks passed`);
