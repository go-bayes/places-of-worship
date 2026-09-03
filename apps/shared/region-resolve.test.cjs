// the shared resolver's contribute decision (jb rulings r-h1 to r-h3,
// 2026-09-03) and the world outline manifest it reads for countries
// without a page: a config portal wins; a country routes to the shared
// portal by code with its name; below the offer zoom the centre names
// nothing; open water names nothing. resolveAt over world-outlines.json
// finds a page-less country and returns null at sea
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const window = {};
const context = vm.createContext({ window, Map, Set, Array, Object, Number, String, Math, JSON, console });
vm.runInContext(fs.readFileSync(path.join(__dirname, "region-resolve.js"), "utf8"), context, { filename: "region-resolve.js" });
const R = window.RegionResolve;
let checks = 0;
function check(condition, message) { checks += 1; if (!condition) throw new Error(message); }

const config = R.contributeRoutesFor({ configPortal: "verification.html", configReview: "review.html", country: { code: "fj", name: "Fiji" }, zoom: 1, minZoom: 3, portalBase: "../nz/" });
check(config.kind === "config" && config.portal === "verification.html" && config.review === "review.html", "A page's own config links must win.");

const fiji = R.contributeRoutesFor({ country: { code: "FJ", name: "Fiji" }, zoom: 6, minZoom: 3, portalBase: "../regions/nz/" });
check(fiji.kind === "country" && fiji.portal === "../regions/nz/verification.html?country=fj" && fiji.review === "../regions/nz/review.html?country=fj" && fiji.name === "Fiji", `A country routes to the shared portal by code: ${JSON.stringify(fiji)}`);

const unnamed = R.contributeRoutesFor({ country: { code: "pg" }, zoom: 6, minZoom: 3, portalBase: "" });
check(unnamed.name === "PG" && unnamed.portal === "verification.html?country=pg", "A country without a name falls back to its code.");

const low = R.contributeRoutesFor({ country: null, zoom: 2.2, minZoom: 3, portalBase: "../nz/" });
check(low.kind === "zoom" && low.portal === "" && low.review === "", "Below the offer zoom there is no route to name.");

const water = R.contributeRoutesFor({ country: null, zoom: 5, minZoom: 3, portalBase: "../nz/" });
check(water.kind === "none" && water.portal === "", "Open water names no country.");

// the world outlines: page-less countries resolve, page countries are absent, the sea is null
const world = JSON.parse(fs.readFileSync(path.join(__dirname, "data", "world-outlines.json"), "utf8")).regions;
const pages = new Set(JSON.parse(fs.readFileSync(path.join(__dirname, "..", "regions", "_shared", "data", "region-bboxes.json"), "utf8")).regions.map((r) => r.code));
check(world.length > 80 && world.every((r) => !pages.has(r.code)), "The world outlines must cover only countries without a page.");
const portMoresby = R.resolveAt(world, 147.18, -9.44);
check(portMoresby && portMoresby.code === "pg", `Port Moresby must resolve to Papua New Guinea: ${portMoresby && portMoresby.code}`);
const paris = R.resolveAt(world, 2.35, 48.86);
check(paris && paris.code === "fr", `Paris must resolve to France: ${paris && paris.code}`);
const wellington = R.resolveAt(world, 174.78, -41.29);
check(wellington === null, "New Zealand has a page, so the world outlines must not claim Wellington.");
const pacific = R.resolveAt(world, -150.0, -30.0);
check(pacific === null, "The open Pacific resolves to nothing.");

console.log(`region resolve: ${checks} checks passed`);
