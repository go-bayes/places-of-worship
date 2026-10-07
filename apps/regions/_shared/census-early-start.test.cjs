// census early start (perf lane P3, 2026-10-07): the shared runtime starts the
// default level's boundary and summary download when the script runs, keeps
// layer insertion behind the first idle, fetches the two files at low priority,
// and shows the loading hint when the idle handler meets an in-flight load.
// source-level checks plus a behavioural run of the real loader and enable
// functions against stubs; the browser checks live in the pull request
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const runtime = fs.readFileSync(path.join(__dirname, "region-map.js"), "utf8");
let checks = 0;
const ok = (value, message) => { assert.ok(value, message); checks += 1; };

// 1. the prefetch sits after the carried-view IIFE and the state it reads,
// and before the map-less part of the script ends (no country branch)
const prefetch = "if (HAS_CENSUS) void loadCensusData(censusState.level, { quiet: true });";
const prefetchAt = runtime.indexOf(prefetch);
ok(prefetchAt > 0 && runtime.indexOf(prefetch, prefetchAt + 1) === -1, "exactly one early prefetch call");
ok(prefetchAt > runtime.indexOf("(function applyCarriedCensusView()"), "the prefetch follows the carried census view");
ok(prefetchAt > runtime.indexOf("const censusState = {"), "the prefetch follows censusState");
ok(prefetchAt > runtime.indexOf("let CENSUS_METRICS = buildCensusMetrics();"), "the prefetch follows CENSUS_METRICS");
ok(prefetchAt > runtime.indexOf("const HAS_CENSUS ="), "the prefetch follows HAS_CENSUS");
// showClickHint reads the clickHint binding, so the quiet path must not run before it
const clickHintAt = runtime.search(/\b(?:const|let) clickHint\b/);
ok(clickHintAt > 0 && prefetchAt > clickHintAt, "the prefetch follows the clickHint binding");
ok(!/countryCode\s*(===|==|!==)\s*["']\w\w["']/i.test(runtime.slice(prefetchAt - 600, prefetchAt + 200)), "no country-conditional logic near the prefetch");

// 2. layer insertion stays behind the first idle and reuses the promise
ok(/map\.once\("idle", async \(\) => \{\n\s*if \(HAS_CENSUS\) await setCensusEnabled\(true\);/.test(runtime),
  "the first-idle handler still enables the census");
ok(/const pending = loadCensusData\(censusState\.level\);/.test(runtime), "setCensusEnabled goes through loadCensusData");
ok(/fetch\(def\.boundaries, \{ priority: "low" \}\)/.test(runtime) && /fetch\(def\.summary, \{ priority: "low" \}\)/.test(runtime),
  "both census fetches are low priority");
ok(/if \(productDomain !== censusState\.domain\)/.test(runtime), "the declared-domain check remains");

// 3. behaviour: run the real functions against stubs
const slice = (from, to) => {
  const a = runtime.indexOf(from);
  const b = runtime.indexOf(to, a);
  assert.ok(a >= 0 && b > a, `slice ${from}`);
  return runtime.slice(a, b);
};
const loaderSource = slice("// quiet loads (the early prefetch)", "// reduce a partial-layer declaration");
const enableSource = slice("async function setCensusEnabled(on) {", "// switching geography swaps the source");

const make = ({ failing = false, deferred = false } = {}) => {
  const hints = [];
  const requests = [];
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const summary = { domain: "religion", rows: [{ area_code: "a", year: 2020 }] };
  const sandbox = {
    HAS_CENSUS: true,
    RC: { dataNoun: "Census" },
    censusState: { enabled: false, domain: "religion", level: "county", year: 2020, levels: {} },
    CENSUS_LEVELS: { county: { boundaries: "b.geojson", summary: "s.json" } },
    showClickHint: (m) => hints.push(m),
    normalisePartialLayer: () => null,
    rowFlagged: () => false,
    computeUniversalFlags: () => ({}),
    computeCensusDomains: () => {},
    censusActive: () => ({ years: [2020] }),
    syncCensusYearSelect: () => {},
    syncCensusTimeSlider: () => {},
    addCensusLayers: () => hints.push("layers"),
    applyCensusPaint: () => {},
    updateCensusLegend: () => {},
    removeCensusLayers: () => {},
    syncPlaceDotEra: () => {},
    writeCensusHash: () => {},
    offerMode: "none",
    renderOfferToggle: () => {},
    fetch: async (url, options) => {
      requests.push({ url, options });
      if (deferred) await gate;
      if (failing) return { ok: false };
      return { ok: true, json: async () => (url === "s.json" ? summary : { type: "FeatureCollection", features: [] }) };
    },
    hints,
    requests,
    release
  };
  vm.createContext(sandbox);
  vm.runInContext(`${loaderSource}\n${enableSource}\nthis.loadCensusData = loadCensusData; this.setCensusEnabled = setCensusEnabled;`, sandbox);
  return sandbox;
};

(async () => {
  {
    // the early prefetch is quiet, low priority, and shared with the enable
    const t = make({ deferred: true });
    const early = t.loadCensusData("county", { quiet: true });
    assert.equal(t.requests.length, 2); checks += 1;
    assert.ok(t.requests.every((r) => r.options.priority === "low"), "low priority"); checks += 1;
    assert.deepEqual(t.hints, [], "the quiet prefetch shows no hint"); checks += 1;
    const enabling = t.setCensusEnabled(true);
    assert.deepEqual(t.hints, ["Loading census boundaries…"], "the idle enable announces the in-flight load"); checks += 1;
    t.release();
    await Promise.all([early, enabling]);
    assert.equal(t.requests.length, 2, "the enable reuses the in-flight promise"); checks += 1;
    assert.equal(t.hints.at(-1), "layers", "layers insert after the data arrives"); checks += 1;
  }
  {
    // a finished prefetch needs no hint and no second request
    const t = make();
    await t.loadCensusData("county", { quiet: true });
    await t.setCensusEnabled(true);
    assert.equal(t.requests.length, 2); checks += 1;
    assert.deepEqual(t.hints, ["layers"]); checks += 1;
  }
  {
    // a failed quiet prefetch is announced once the enable meets it, then retried
    const t = make({ failing: true });
    await t.loadCensusData("county", { quiet: true });
    assert.deepEqual(t.hints, [], "no hint before the map is up"); checks += 1;
    await t.setCensusEnabled(true);
    assert.ok(t.hints.includes("Census data failed to load"), "failure announced at enable"); checks += 1;
    assert.equal(t.censusState.enabled, false); checks += 1;
  }
  {
    // a non-quiet load keeps the loading hint (level switches)
    const t = make();
    await t.loadCensusData("county");
    assert.deepEqual(t.hints, ["Loading census boundaries…"]); checks += 1;
  }
  console.log(`census early start: ${checks} checks passed`);
})().catch((err) => { console.error(err); process.exit(1); });
